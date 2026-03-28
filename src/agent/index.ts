import { HydraDBClient } from "../memory/hydradb.js";
import { callLLM, TOOL_DEFINITIONS } from "./llm.js";
import { addSchedule, listSchedules } from "../server/firestore/schedules.js";
import { executeIntegrationAction, getIntegrations } from "../integrations/one.js";
import type {
    AgentRequest,
    AgentResponse,
    TrustReceipt,
    ToolCall,
    MemorySnippet,
} from "./types.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

function buildSystemPrompt(connectedIntegrations: string[]): string {
    const integrationStatus = connectedIntegrations.length > 0
        ? `\n\n## Connected Integrations (ACTIVE — you MUST use these via the integration_action tool)\nThe user has connected the following integrations via One. You have FULL access to them:\n${connectedIntegrations.map((name) => {
            switch (name) {
                case "gmail": return "- **Gmail** (CONNECTED): You can read emails, search inbox, draft emails, and send emails. Use integration_action with integration='gmail'.";
                case "google_calendar": return "- **Google Calendar** (CONNECTED): You can list events, create events, find free time, and update events. Use integration_action with integration='google_calendar'.";
                case "github": return "- **GitHub** (CONNECTED): You can create issues, create PRs, list repos, and search code. Use integration_action with integration='github'.";
                case "slack": return "- **Slack** (CONNECTED): You can send messages, list channels, and search messages. Use integration_action with integration='slack'.";
                default: return `- **${name}** (CONNECTED)`;
            }
        }).join("\n")}\n\nIMPORTANT: When the user asks you to do ANYTHING related to a connected integration (read emails, check calendar, send messages, etc.), you MUST call the integration_action tool. Do NOT say you can't do it — you CAN because the integration is connected. Always use the tool first, then summarize the results.`
        : "\n\nNo integrations are connected yet. If the user asks about email, calendar, etc., tell them to connect the integration using the Integrations panel in the top-right corner.";

    return `You are Mneme, a personal AI operator. You help users manage their work, communications, and schedule by taking ACTIONS on their behalf.

## Your Capabilities
- **Memory**: You recall context from past conversations automatically. Relevant memories are injected below.
- **Integrations** (via One): You can perform real actions on connected apps — reading, writing, searching.
- **Scheduling**: You can set reminders and recurring tasks that fire proactively.

## Rules
1. When the user asks you to DO something (read emails, schedule meeting, send message, create issue), ALWAYS call the appropriate tool. Never just describe what you would do — DO IT.
2. Be concise and action-oriented. Confirm what you did after doing it.
3. If you have recalled memories, use them to provide context-aware responses.
4. Show the user real results from their integrations.${integrationStatus}`;
}

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

        // 2. Get connected integrations for this session
        const integrations = await getIntegrations(req.chatId);
        const connectedNames = integrations
            .filter((i) => i.connected)
            .map((i) => i.name);

        // 3. Build messages with dynamic system prompt
        const memoryContext =
            memoriesRecalled.length > 0
                ? `\n\n## Recalled Memories\n${memoriesRecalled.map((m) => `- [score: ${m.score.toFixed(2)}] ${m.text}`).join("\n")}`
                : "";

        const systemPrompt = buildSystemPrompt(connectedNames) + memoryContext;

        const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...req.history.slice(-18).map(
                (m) =>
                    ({
                        role: m.role as "user" | "assistant",
                        content: m.content,
                    }) satisfies ChatCompletionMessageParam,
            ),
            { role: "user", content: req.message },
        ];

        // 4. Call LLM (with tool definitions)
        let llmResponse = await callLLM(messages, TOOL_DEFINITIONS);
        let reply = llmResponse.content ?? "";

        // 5. Handle tool calls (single round)
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

        // 6. Store exchange in HydraDB
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

        // 7. Build trust receipt
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
                const schedule = await addSchedule(
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
                const list = await listSchedules(chatId);
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
                    chatId,
                );
                return { message: result.result };
            }
            default:
                return { message: `Unknown tool: ${name}` };
        }
    }
}
