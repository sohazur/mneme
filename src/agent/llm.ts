import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const BASE_URL = process.env.LLM_BASE_URL || "https://api.gmi-serving.com/v1";
const API_KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "moonshotai/Kimi-K2.5";

let client: OpenAI | null = null;

function getClient(): OpenAI {
    if (!client) {
        client = new OpenAI({ baseURL: BASE_URL, apiKey: API_KEY });
    }
    return client;
}

export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "schedule_reminder",
            description:
                "Schedule a reminder or recurring task for the user. Use this when the user asks to be reminded about something or wants to schedule a recurring task.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Short name for the reminder" },
                    message: {
                        type: "string",
                        description: "The reminder message to deliver",
                    },
                    schedule_type: {
                        type: "string",
                        enum: ["once", "recurring"],
                        description: "One-time or recurring",
                    },
                    at: {
                        type: "string",
                        description:
                            "ISO 8601 datetime for one-time reminders (e.g. 2026-03-28T15:00:00Z)",
                    },
                    cron: {
                        type: "string",
                        description:
                            "Cron expression for recurring tasks (e.g. '0 9 * * *' for daily at 9am)",
                    },
                },
                required: ["name", "message", "schedule_type"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_reminders",
            description: "List all active reminders and scheduled tasks for this chat session.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "integration_action",
            description:
                "Perform an action via a connected integration (Gmail, Google Calendar, GitHub, etc.). Use this when the user asks you to send an email, schedule a meeting, create a PR, etc.",
            parameters: {
                type: "object",
                properties: {
                    integration: {
                        type: "string",
                        enum: ["gmail", "google_calendar", "github", "slack"],
                        description: "Which integration to use",
                    },
                    action: {
                        type: "string",
                        description:
                            "The action to perform (e.g. 'draft_email', 'create_event', 'create_issue')",
                    },
                    params: {
                        type: "object",
                        description: "Action-specific parameters",
                    },
                },
                required: ["integration", "action"],
            },
        },
    },
];

export interface LLMResponse {
    content: string | null;
    toolCalls: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
    }>;
    model: string;
}

export async function callLLM(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
): Promise<LLMResponse> {
    const oai = getClient();
    const response = await oai.chat.completions.create({
        model: MODEL,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        temperature: 0.7,
        max_tokens: 2048,
    });

    const choice = response.choices[0];
    const msg = choice?.message;

    return {
        content: msg?.content ?? null,
        toolCalls: (msg?.tool_calls ?? []).map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
        })),
        model: MODEL,
    };
}
