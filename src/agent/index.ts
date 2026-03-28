import { HydraDBClient } from "../memory/hydradb.js";
import { callLLM, TOOL_DEFINITIONS } from "./llm.js";
import { addSchedule, listSchedules } from "../scheduler/index.js";
import { executeIntegrationAction } from "../integrations/one.js";
import type {
    AgentRequest,
    AgentResponse,
    TrustReceipt,
    ToolCall,
    MemorySnippet,
} from "./types.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const SYSTEM_PROMPT = `You are Mneme, a personal AI operator. You help users manage their work, communications, and schedule.

You have access to these capabilities:
- **Memory**: You recall context from past conversations automatically. Relevant memories are injected below.
- **Integrations** (via One): Gmail, Google Calendar, GitHub, Slack — you can draft emails, schedule meetings, create issues, etc.
- **Scheduling**: You can set reminders and recurring tasks that fire proactively.

Be concise, helpful, and action-oriented. When the user asks you to do something (email, meeting, reminder), use the appropriate tool. Always confirm what you did.

If you have recalled memories, use them to provide context-aware responses.`;

export class MnemeAgent {
    private hydra: HydraDBClient | null;

    constructor() {
        const hydraKey = process.env.HYDRA_OPENCLAW_API_KEY;
        this.hydra = hydraKey ? new HydraDBClient(hydraKey) : null;

        if (!this.hydra) {
            console.warn("[MnemeAgent] No HYDRA_OPENCLAW_API_KEY — running without memory");
        }
        if (!process.env.LLM_API_KEY) {
            console.warn("[MnemeAgent] No LLM_API_KEY — LLM calls will fail");
        }
    }

    async processMessage(req: AgentRequest): Promise<AgentResponse> {
        const start = Date.now();
        const memoriesRecalled: MemorySnippet[] = [];
        const toolsCalled: ToolCall[] = [];
        const actionsPerformed: string[] = [];
        let memoryStored = false;

        // 1. Recall from HydraDB
        if (this.hydra) {
            const recall = await this.hydra.recall(req.message, req.chatId, 8);
            for (const r of recall.results) {
                memoriesRecalled.push({
                    text: r.text.slice(0, 200),
                    score: r.score,
                });
            }
            if (memoriesRecalled.length > 0) {
                actionsPerformed.push(
                    `Recalled ${memoriesRecalled.length} memories from HydraDB`,
                );
            }
        }

        // 2. Build messages
        const memoryContext =
            memoriesRecalled.length > 0
                ? `\n\n## Recalled Memories\n${memoriesRecalled.map((m) => `- [score: ${m.score.toFixed(2)}] ${m.text}`).join("\n")}`
                : "";

        const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: SYSTEM_PROMPT + memoryContext },
            ...req.history.slice(-18).map(
                (m) =>
                    ({
                        role: m.role as "user" | "assistant",
                        content: m.content,
                    }) satisfies ChatCompletionMessageParam,
            ),
            { role: "user", content: req.message },
        ];

        // 3. Call LLM (with tool definitions)
        let llmResponse = await callLLM(messages, TOOL_DEFINITIONS);
        let reply = llmResponse.content ?? "";

        // 4. Handle tool calls (single round)
        if (llmResponse.toolCalls.length > 0) {
            const toolMessages: ChatCompletionMessageParam[] = [...messages];

            // Add assistant message with tool calls
            toolMessages.push({
                role: "assistant",
                content: llmResponse.content,
                tool_calls: llmResponse.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: "function" as const,
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args),
                    },
                })),
            });

            for (const tc of llmResponse.toolCalls) {
                const result = await this.executeTool(
                    req.chatId,
                    tc.name,
                    tc.args,
                );
                toolsCalled.push({
                    name: tc.name,
                    args: tc.args,
                    result: result.message,
                });
                actionsPerformed.push(result.message);

                toolMessages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: result.message,
                });
            }

            // Get final response after tool execution
            const finalResponse = await callLLM(toolMessages);
            reply = finalResponse.content ?? reply;
        }

        // 5. Store exchange in HydraDB
        if (this.hydra && reply) {
            memoryStored = await this.hydra.addMemory(
                req.chatId,
                req.message,
                reply,
                { timestamp: new Date().toISOString() },
            );
            if (memoryStored) {
                actionsPerformed.push("Stored exchange in HydraDB memory");
            }
        }

        // 6. Build trust receipt
        const trustReceipt: TrustReceipt = {
            timestamp: new Date().toISOString(),
            model: process.env.LLM_MODEL || "moonshotai/Kimi-K2.5",
            latencyMs: Date.now() - start,
            memoriesRecalled,
            toolsCalled,
            actionsPerformed,
            memoryStored,
        };

        return { reply, trustReceipt };
    }

    private async executeTool(
        chatId: string,
        name: string,
        args: Record<string, unknown>,
    ): Promise<{ message: string }> {
        switch (name) {
            case "schedule_reminder": {
                const schedule = addSchedule(
                    chatId,
                    (args.name as string) || "Reminder",
                    (args.message as string) || "",
                    (args.schedule_type as "once" | "recurring") || "once",
                    args.at as string | undefined,
                    args.cron as string | undefined,
                );
                return {
                    message: `Reminder "${schedule.name}" scheduled (${schedule.type}${schedule.at ? ` at ${schedule.at}` : ""}${schedule.cron ? ` cron: ${schedule.cron}` : ""})`,
                };
            }
            case "list_reminders": {
                const list = listSchedules(chatId);
                if (list.length === 0) {
                    return { message: "No active reminders." };
                }
                const formatted = list
                    .map(
                        (s) =>
                            `- ${s.name}: "${s.message}" (${s.type}${s.at ? `, at ${s.at}` : ""}${s.cron ? `, cron: ${s.cron}` : ""})`,
                    )
                    .join("\n");
                return { message: `Active reminders:\n${formatted}` };
            }
            case "integration_action": {
                const result = await executeIntegrationAction(
                    (args.integration as string) || "",
                    (args.action as string) || "",
                    (args.params as Record<string, unknown>) || {},
                );
                return { message: result.result };
            }
            default:
                return { message: `Unknown tool: ${name}` };
        }
    }
}
