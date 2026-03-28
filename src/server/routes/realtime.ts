import { Router } from "express";
import { executeIntegrationAction } from "../../integrations/one.js";
import { addSchedule, listSchedules } from "../firestore/schedules.js";

export const realtimeRouter = Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "J6hZGZUVxGqz5rKOBBCK";

const SYSTEM_INSTRUCTIONS = `You are Mneme, a personal AI operator. You help users manage their work, communications, and schedule by taking actions on their behalf.

CRITICAL RULES:
1. ALWAYS respond in English. Never respond in any other language, regardless of what language the user speaks in.
2. When the user asks ANYTHING about emails, calendar events, GitHub, or Slack — you MUST call the integration_action tool FIRST. Do NOT make up or fabricate any data. Do NOT respond until you have the real tool result.
3. For reminders and scheduling, use the schedule_reminder tool.
4. Keep responses brief and conversational since you are speaking out loud.
5. After receiving tool results, summarize them naturally in English.`;

// Tool definitions for OpenAI Realtime API format
const REALTIME_TOOLS = [
    {
        type: "function",
        name: "integration_action",
        description: "Perform an action via a connected integration. ALWAYS use this when the user asks about emails, calendar, GitHub, or Slack. Actions: gmail: read_email, list_emails, draft_email, send_email, search_emails. google_calendar: list_events, create_event, find_free_time. github: create_issue, create_pr, list_repos. slack: send_message, list_channels.",
        parameters: {
            type: "object",
            properties: {
                integration: { type: "string", enum: ["gmail", "google_calendar", "github", "slack"] },
                action: { type: "string", description: "Gmail: read_email, list_emails, draft_email, send_email, search_emails. Calendar: list_events, create_event, find_free_time. GitHub: create_issue, create_pr, list_repos. Slack: send_message, list_channels." },
                params: { type: "object", description: "Action-specific parameters" },
            },
            required: ["integration", "action"],
        },
    },
    {
        type: "function",
        name: "schedule_reminder",
        description: "Schedule a reminder or recurring task for the user.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string" },
                message: { type: "string" },
                schedule_type: { type: "string", enum: ["once", "recurring"] },
                at: { type: "string", description: "ISO 8601 datetime for one-time reminders" },
                cron: { type: "string", description: "Cron expression for recurring tasks" },
            },
            required: ["name", "message", "schedule_type"],
        },
    },
    {
        type: "function",
        name: "list_reminders",
        description: "List all active reminders and scheduled tasks.",
        parameters: { type: "object", properties: {} },
    },
];

// Create OpenAI Realtime session (text output only — voice via ElevenLabs)
realtimeRouter.post("/realtime/session", async (req, res) => {
    if (!OPENAI_API_KEY) {
        res.status(500).json({ error: "OPENAI_API_KEY not configured" });
        return;
    }

    const { model } = req.body || {};

    try {
        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: model || "gpt-4o-realtime-preview-2025-06-03",
                modalities: ["text", "audio"],
                voice: "shimmer",
                instructions: SYSTEM_INSTRUCTIONS,
                tools: REALTIME_TOOLS,
                input_audio_transcription: {
                    model: "gpt-4o-mini-transcribe",
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("[Realtime] Session creation failed:", response.status, err);
            res.status(response.status).json({ error: "Failed to create realtime session", detail: err });
            return;
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("[Realtime] Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Execute tool calls from Realtime voice session
realtimeRouter.post("/realtime/tool-call", async (req, res) => {
    const uid = req.uid!;
    const { name, args } = req.body;

    if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
    }

    try {
        let result: string;

        switch (name) {
            case "integration_action": {
                const r = await executeIntegrationAction(
                    (args?.integration as string) || "",
                    (args?.action as string) || "",
                    (args?.params as Record<string, unknown>) || {},
                    uid,
                );
                result = r.result;
                break;
            }
            case "schedule_reminder": {
                const schedule = await addSchedule(
                    uid,
                    (args?.name as string) || "Reminder",
                    (args?.message as string) || "",
                    (args?.schedule_type as "once" | "recurring") || "once",
                    args?.at as string | undefined,
                    args?.cron as string | undefined,
                );
                result = `Reminder "${schedule.name}" scheduled (${schedule.type}${schedule.at ? ` at ${schedule.at}` : ""})`;
                break;
            }
            case "list_reminders": {
                const list = await listSchedules(uid);
                result = list.length === 0
                    ? "No active reminders."
                    : `Active reminders:\n${list.map((s) => `- ${s.name}: "${s.message}" (${s.type})`).join("\n")}`;
                break;
            }
            default:
                result = `Unknown tool: ${name}`;
        }

        console.log(`[Realtime] Tool: ${name} → ${result.slice(0, 100)}...`);
        res.json({ result });
    } catch (err) {
        console.error("[Realtime] Tool error:", err);
        res.json({ result: `Error: ${(err as Error).message}` });
    }
});

// Stream TTS from ElevenLabs — returns audio/mpeg
realtimeRouter.post("/realtime/tts", async (req, res) => {
    if (!ELEVENLABS_API_KEY) {
        res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
        return;
    }

    const { text } = req.body || {};
    if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
    }

    try {
        const ttsRes = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream?output_format=mp3_44100_128`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "xi-api-key": ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_v3",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true,
                    },
                }),
            },
        );

        console.log(`[ElevenLabs] TTS request for: "${text.slice(0, 60)}..." → ${ttsRes.status}`);

        if (!ttsRes.ok) {
            const err = await ttsRes.text();
            console.error("[ElevenLabs] TTS failed:", ttsRes.status, err);
            res.status(ttsRes.status).json({ error: "TTS failed", detail: err });
            return;
        }

        // Stream the audio back to the client
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Transfer-Encoding", "chunked");

        const reader = ttsRes.body?.getReader();
        if (!reader) {
            res.status(500).json({ error: "No response body from ElevenLabs" });
            return;
        }

        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();
        };

        await pump();
    } catch (err) {
        console.error("[ElevenLabs] Error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});
