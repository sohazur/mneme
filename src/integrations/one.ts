/**
 * One Integration Layer (withone.ai)
 *
 * Real passthrough API calls to connected integrations via One.
 * One manages OAuth tokens, rate limits, and credential injection.
 *
 * Integration state is persisted per-user in Firestore.
 */

import {
    getConnectedIntegrations,
    setIntegrationConnected,
} from "../server/firestore/integrations.js";

const ONE_API_KEY = process.env.ONE_API_KEY || "";
const ONE_BASE = "https://api.withone.ai/v1/passthrough";

// Real connection keys from One (via `one list`)
const CONNECTION_KEYS: Record<string, string> = {
    gmail: "live::gmail::default::80b4a27166bf4483b2862dd76eeae017",
    google_calendar: "live::google-calendar::default::af127731cddc48fdbcdb4e527e8ec265",
    github: "live::github::default::2b8bb445711e4deebedc738bd6e8aefd",
    slack: "live::slack::default::73d716fc5b004c3f8e425adb5c440476",
};

export interface IntegrationInfo {
    name: string;
    label: string;
    icon: string;
    description: string;
    actions: string[];
    connected: boolean;
}

export interface IntegrationAction {
    integration: string;
    action: string;
    params: Record<string, unknown>;
    result: string;
    simulated: boolean;
}

const INTEGRATIONS: IntegrationInfo[] = [
    {
        name: "gmail",
        label: "Gmail",
        icon: "\u2709\uFE0F",
        description: "Draft & send emails, search inbox, read emails",
        actions: ["draft_email", "send_email", "search_emails", "read_email", "list_emails"],
        connected: false,
    },
    {
        name: "google_calendar",
        label: "Google Calendar",
        icon: "\uD83D\uDCC5",
        description: "Schedule meetings, find free time",
        actions: ["create_event", "list_events", "update_event", "find_free_time"],
        connected: false,
    },
    {
        name: "github",
        label: "GitHub",
        icon: "\uD83D\uDCBB",
        description: "Create issues, open PRs, manage repos",
        actions: ["create_issue", "create_pr", "list_repos", "search_code"],
        connected: false,
    },
    {
        name: "slack",
        label: "Slack",
        icon: "\uD83D\uDCAC",
        description: "Send messages, search channels",
        actions: ["send_message", "list_channels", "search_messages"],
        connected: false,
    },
];

export async function getIntegrations(uid: string): Promise<IntegrationInfo[]> {
    const connected = await getConnectedIntegrations(uid);
    return INTEGRATIONS.map((i) => ({
        ...i,
        connected: connected.has(i.name),
    }));
}

export async function connectIntegration(uid: string, integrationName: string): Promise<boolean> {
    const integ = INTEGRATIONS.find((i) => i.name === integrationName);
    if (!integ) return false;
    await setIntegrationConnected(uid, integrationName, true);
    return true;
}

export async function disconnectIntegration(uid: string, integrationName: string): Promise<boolean> {
    const integ = INTEGRATIONS.find((i) => i.name === integrationName);
    if (!integ) return false;
    await setIntegrationConnected(uid, integrationName, false);
    return true;
}

// Action IDs from One (via `one actions search`)
const ACTION_IDS: Record<string, string> = {
    // Gmail
    "gmail.list_messages": "conn_mod_def::GJ3odOE-fdw::ijLww5s-SCSplLQtLpxkrw",
    "gmail.get_message": "conn_mod_def::GJ3ocvMGOS8::D__3BgQSSzWtDUoOqLuX2A",
    "gmail.send_message": "conn_mod_def::GJ3odB0xmWo::q4zXVfyJSuiqzRIFjn0rQg",
    "gmail.create_draft": "conn_mod_def::GJ3oaW93Bqo::4mz--d8KSJyLHN3MnxWQWQ",
    // Google Calendar
    "gcal.list_events": "conn_mod_def::GJ6RlnIYK20::YzuWSmaVQgurletRDNJavA",
    "gcal.create_event": "conn_mod_def::GJ6RlR8_N5w::ydGdfN8dSYKGwZr4rQ2UjQ",
    // GitHub
    "github.list_repos": "conn_mod_def::GJ3aI7VUveU::c9xSM0j9SZKohYowBNP9tQ",
    "github.create_issue": "conn_mod_def::GJ3aREAqN_M::w8sP2EcoRfWxYFMlWrm0EA",
    // Slack
    "slack.conversations_list": "conn_mod_def::GJ7H51GYpG0::7LpQ3sJYSIq-1F-_8lB7Gw",
    "slack.chat_post": "conn_mod_def::GJ7H8OOQCII::0Kg2OkmDR1q9u-HRv6QMTQ",
};

// ── One Passthrough API ──

async function onePassthrough(
    connectionKey: string,
    method: string,
    path: string,
    actionId: string,
    body?: unknown,
): Promise<unknown> {
    const url = `${ONE_BASE}${path}`;
    const headers: Record<string, string> = {
        "x-one-secret": ONE_API_KEY,
        "x-one-connection-key": connectionKey,
        "x-one-action-id": actionId,
        Accept: "application/json",
    };
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`One API ${res.status}: ${text.slice(0, 300)}`);
    }

    return res.json();
}

// ── Execute Integration Actions (REAL via One passthrough) ──

export async function executeIntegrationAction(
    integration: string,
    action: string,
    params: Record<string, unknown> = {},
    uid?: string,
): Promise<IntegrationAction> {
    const integ = INTEGRATIONS.find((i) => i.name === integration);

    if (!integ) {
        return {
            integration, action, params,
            result: `Unknown integration: ${integration}`,
            simulated: true,
        };
    }

    if (uid) {
        const connected = await getConnectedIntegrations(uid);
        if (!connected.has(integration)) {
            return {
                integration, action, params,
                result: `${integ.label} is not connected. Connect it using the integrations panel.`,
                simulated: true,
            };
        }
    }

    const connKey = CONNECTION_KEYS[integration];
    if (!connKey || !ONE_API_KEY) {
        return {
            integration, action, params,
            result: `One API not configured for ${integ.label}.`,
            simulated: true,
        };
    }

    try {
        const result = await executeReal(integration, action, params, connKey);
        return {
            integration, action, params,
            result: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            simulated: false,
        };
    } catch (err) {
        return {
            integration, action, params,
            result: `Error calling ${integ.label}: ${(err as Error).message}`,
            simulated: false,
        };
    }
}

async function executeReal(
    integration: string,
    action: string,
    params: Record<string, unknown>,
    connKey: string,
): Promise<unknown> {
    switch (`${integration}.${action}`) {

        // ── Gmail ──
        case "gmail.read_email":
        case "gmail.list_emails": {
            const maxResults = params.max_results || params.maxResults || 5;
            const listRes = await onePassthrough(connKey, "GET",
                `/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
                ACTION_IDS["gmail.list_messages"],
            ) as { messages?: { id: string }[] };

            if (!listRes.messages?.length) {
                return { emails: [], message: "No emails found" };
            }

            const emails = await Promise.all(
                listRes.messages.slice(0, Number(maxResults)).map(async (m) => {
                    const msg = await onePassthrough(connKey, "GET",
                        `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                        ACTION_IDS["gmail.get_message"],
                    ) as {
                        id: string; snippet: string; labelIds?: string[];
                        payload?: { headers?: { name: string; value: string }[] };
                    };
                    const hdrs = msg.payload?.headers ?? [];
                    const h = (name: string) => hdrs.find((x) => x.name === name)?.value || "";
                    return { id: msg.id, from: h("From"), subject: h("Subject"), date: h("Date"), snippet: msg.snippet, unread: msg.labelIds?.includes("UNREAD") ?? false };
                })
            );

            return { emails, total: emails.length, unread: emails.filter((e) => e.unread).length, via: "One -> Gmail API (real)" };
        }

        case "gmail.search_emails": {
            const q = params.query || params.q || "";
            const listRes = await onePassthrough(connKey, "GET",
                `/gmail/v1/users/me/messages?q=${encodeURIComponent(String(q))}&maxResults=5`,
                ACTION_IDS["gmail.list_messages"],
            ) as { messages?: { id: string }[] };

            if (!listRes.messages?.length) return { results: [], query: q, message: "No matching emails" };

            const results = await Promise.all(
                listRes.messages.slice(0, 5).map(async (m) => {
                    const msg = await onePassthrough(connKey, "GET",
                        `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                        ACTION_IDS["gmail.get_message"],
                    ) as { snippet: string; payload?: { headers?: { name: string; value: string }[] } };
                    const hdrs = msg.payload?.headers ?? [];
                    const h = (name: string) => hdrs.find((x) => x.name === name)?.value || "";
                    return { from: h("From"), subject: h("Subject"), date: h("Date"), snippet: msg.snippet };
                })
            );
            return { results, query: q, total: results.length, via: "One -> Gmail API (real)" };
        }

        case "gmail.draft_email": {
            const raw = btoa(`To: ${params.to || ""}\r\nSubject: ${params.subject || ""}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${params.body || params.message || ""}`)
                .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            const result = await onePassthrough(connKey, "POST", `/gmail/v1/users/me/drafts`, ACTION_IDS["gmail.create_draft"], { message: { raw } });
            return { status: "Draft created", draft: result, via: "One -> Gmail API (real)" };
        }

        case "gmail.send_email": {
            const raw = btoa(`To: ${params.to || ""}\r\nSubject: ${params.subject || ""}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${params.body || params.message || ""}`)
                .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            const result = await onePassthrough(connKey, "POST", `/gmail/v1/users/me/messages/send`, ACTION_IDS["gmail.send_message"], { raw });
            return { status: "Email sent", result, via: "One -> Gmail API (real)" };
        }

        // ── Google Calendar ──
        case "google_calendar.list_events": {
            const now = new Date();
            const timeMin = params.timeMin || now.toISOString();
            const timeMax = params.timeMax || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
            const result = await onePassthrough(connKey, "GET",
                `/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(String(timeMin))}&timeMax=${encodeURIComponent(String(timeMax))}&singleEvents=true&orderBy=startTime&maxResults=10`,
                ACTION_IDS["gcal.list_events"],
            );
            return { ...(result as object), via: "One -> Google Calendar API (real)" };
        }

        case "google_calendar.create_event": {
            const result = await onePassthrough(connKey, "POST", `/calendar/v3/calendars/primary/events`, ACTION_IDS["gcal.create_event"], {
                summary: params.title || params.summary || "Meeting",
                start: { dateTime: params.start || params.time, timeZone: params.timezone || "America/New_York" },
                end: { dateTime: params.end || params.time, timeZone: params.timezone || "America/New_York" },
                attendees: Array.isArray(params.attendees) ? (params.attendees as string[]).map((e) => ({ email: e })) : [],
            });
            return { status: "Event created", event: result, via: "One -> Google Calendar API (real)" };
        }

        case "google_calendar.find_free_time": {
            const now = new Date();
            const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const result = await onePassthrough(connKey, "GET",
                `/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(weekLater.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=20`,
                ACTION_IDS["gcal.list_events"],
            );
            return { busy_events: result, note: "Review these events to find free slots", via: "One -> Google Calendar API (real)" };
        }

        // ── GitHub ──
        case "github.list_repos": {
            const result = await onePassthrough(connKey, "GET", `/user/repos?sort=updated&per_page=10`, ACTION_IDS["github.list_repos"]);
            return { repos: result, via: "One -> GitHub API (real)" };
        }

        case "github.create_issue": {
            const repo = params.repo || "sohazur/mneme";
            const result = await onePassthrough(connKey, "POST", `/repos/${repo}/issues`, ACTION_IDS["github.create_issue"], {
                title: params.title || "New issue", body: params.body || "", labels: params.labels || [],
            });
            return { status: "Issue created", issue: result, via: "One -> GitHub API (real)" };
        }

        case "github.create_pr": {
            const repo = params.repo || "sohazur/mneme";
            const result = await onePassthrough(connKey, "POST", `/repos/${repo}/pulls`, ACTION_IDS["github.create_issue"], {
                title: params.title || "New PR", head: params.head || "main", base: params.base || "main", body: params.body || "",
            });
            return { status: "PR created", pr: result, via: "One -> GitHub API (real)" };
        }

        case "github.search_code": {
            const q = params.query || params.q || "";
            const result = await onePassthrough(connKey, "GET", `/search/code?q=${encodeURIComponent(String(q))}&per_page=5`, ACTION_IDS["github.list_repos"]);
            return { results: result, via: "One -> GitHub API (real)" };
        }

        // ── Slack ──
        case "slack.list_channels": {
            const result = await onePassthrough(connKey, "GET", `/api/conversations.list?types=public_channel&limit=20`, ACTION_IDS["slack.conversations_list"]);
            return { ...(result as object), via: "One -> Slack API (real)" };
        }

        case "slack.send_message": {
            const result = await onePassthrough(connKey, "POST", `/api/chat.postMessage`, ACTION_IDS["slack.chat_post"], {
                channel: params.channel || "", text: params.text || params.message || "",
            });
            return { status: "Message sent", result, via: "One -> Slack API (real)" };
        }

        case "slack.search_messages": {
            const q = params.query || params.q || "";
            const result = await onePassthrough(connKey, "GET", `/api/search.messages?query=${encodeURIComponent(String(q))}&count=5`, ACTION_IDS["slack.conversations_list"]);
            return { results: result, via: "One -> Slack API (real)" };
        }

        default:
            return { error: `Unknown action '${action}' for ${integration}` };
    }
}
