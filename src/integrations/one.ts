/**
 * One Integration Layer (withone.ai)
 *
 * One provides managed authentication for 250+ apps.
 * Users connect integrations via OAuth through One's hosted flow.
 * The ONE_API_KEY authenticates our app with One's platform.
 */

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

// Per-session connection state
const sessionConnections = new Map<string, Set<string>>();

export function getIntegrations(sessionId: string): IntegrationInfo[] {
    const connected = sessionConnections.get(sessionId) ?? new Set();
    return INTEGRATIONS.map((i) => ({
        ...i,
        connected: connected.has(i.name),
    }));
}

export function connectIntegration(sessionId: string, integrationName: string): boolean {
    const integ = INTEGRATIONS.find((i) => i.name === integrationName);
    if (!integ) return false;

    if (!sessionConnections.has(sessionId)) {
        sessionConnections.set(sessionId, new Set());
    }
    sessionConnections.get(sessionId)!.add(integrationName);
    return true;
}

export function disconnectIntegration(sessionId: string, integrationName: string): boolean {
    const connected = sessionConnections.get(sessionId);
    if (!connected) return false;
    return connected.delete(integrationName);
}

export async function executeIntegrationAction(
    integration: string,
    action: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
): Promise<IntegrationAction> {
    const integ = INTEGRATIONS.find((i) => i.name === integration);

    if (!integ) {
        return {
            integration,
            action,
            params,
            result: `Unknown integration: ${integration}. Available: ${INTEGRATIONS.map((i) => i.name).join(", ")}`,
            simulated: true,
        };
    }

    // Check if connected
    if (sessionId) {
        const connected = sessionConnections.get(sessionId);
        if (!connected || !connected.has(integration)) {
            return {
                integration,
                action,
                params,
                result: `${integ.label} is not connected. Please connect it first using the integrations panel.`,
                simulated: true,
            };
        }
    }

    if (!integ.actions.includes(action)) {
        return {
            integration,
            action,
            params,
            result: `Unknown action '${action}' for ${integ.label}. Available: ${integ.actions.join(", ")}`,
            simulated: true,
        };
    }

    // Execute via One (simulated for hackathon, but shows the flow)
    const result = simulateAction(integration, action, params);

    return {
        integration,
        action,
        params,
        result,
        simulated: true,
    };
}

function simulateAction(
    integration: string,
    action: string,
    params: Record<string, unknown>,
): string {
    switch (`${integration}.${action}`) {
        case "gmail.read_email":
        case "gmail.list_emails":
            return JSON.stringify({
                status: "success",
                emails: [
                    { from: "sarah@company.com", subject: "Re: Q2 Planning", snippet: "Hey, just wanted to follow up on the timeline we discussed. Can we sync tomorrow?", date: "2026-03-28T10:30:00Z", unread: true },
                    { from: "david.chen@acme.io", subject: "Invoice #4521 attached", snippet: "Please find attached the invoice for March services. Payment due April 15.", date: "2026-03-28T09:15:00Z", unread: true },
                    { from: "notifications@github.com", subject: "[mneme] PR #12 merged", snippet: "Your pull request 'Add trust receipts' has been merged into main.", date: "2026-03-28T08:45:00Z", unread: false },
                    { from: "team@linear.app", subject: "3 issues assigned to you", snippet: "You have new assignments in the Mneme project: MNE-45, MNE-46, MNE-47", date: "2026-03-27T17:00:00Z", unread: false },
                    { from: "alex@startup.co", subject: "Hackathon submission deadline", snippet: "Reminder: submissions close Friday at 11:59pm. Make sure your demo URL is live!", date: "2026-03-27T14:22:00Z", unread: false },
                ],
                total_unread: 2,
                via: "One -> Gmail API",
            }, null, 2);
        case "gmail.draft_email":
            return JSON.stringify({
                status: "success",
                draft_id: "draft-" + Math.random().toString(36).slice(2, 8),
                to: params.to || "recipient@example.com",
                subject: params.subject || "No subject",
                body_preview: (params.body as string || "").slice(0, 100) + "...",
                via: "One -> Gmail API",
            }, null, 2);
        case "gmail.send_email":
            return JSON.stringify({
                status: "success",
                message_id: "msg-" + Math.random().toString(36).slice(2, 8),
                to: params.to || "recipient@example.com",
                subject: params.subject || "No subject",
                sent_at: new Date().toISOString(),
                via: "One -> Gmail API",
            }, null, 2);
        case "gmail.search_emails":
            return JSON.stringify({
                status: "success",
                query: params.query || "",
                results: [
                    { from: "sarah@company.com", subject: "Re: Q2 Planning", date: "2026-03-28T10:30:00Z", snippet: "The timeline looks good. Let's finalize in tomorrow's sync." },
                    { from: "sarah@company.com", subject: "Q2 Planning Doc", date: "2026-03-25T15:00:00Z", snippet: "I've shared the planning doc. Please review sections 2-4." },
                    { from: "manager@company.com", subject: "Q2 Goals Review", date: "2026-03-20T09:00:00Z", snippet: "Team, please update your Q2 OKRs by end of week." },
                ],
                total: 3,
                via: "One -> Gmail API",
            }, null, 2);
        case "google_calendar.create_event":
            return JSON.stringify({
                status: "success",
                event_id: "evt-" + Math.random().toString(36).slice(2, 8),
                title: params.title || "Meeting",
                start: params.time || params.start || "TBD",
                attendees: params.attendees || [],
                calendar_link: "https://calendar.google.com/event/...",
                via: "One -> Google Calendar API",
            }, null, 2);
        case "google_calendar.list_events":
            return JSON.stringify({
                status: "success",
                date: params.date || "today",
                events: [
                    { title: "Team Standup", start: "09:00", end: "09:30", attendees: ["team@company.com"] },
                    { title: "1:1 with Sarah", start: "11:00", end: "11:30", attendees: ["sarah@company.com"] },
                    { title: "Lunch", start: "12:30", end: "13:30", attendees: [] },
                    { title: "Hackathon Demo Prep", start: "15:00", end: "16:00", attendees: ["alex@startup.co", "david@acme.io"] },
                ],
                via: "One -> Google Calendar API",
            }, null, 2);
        case "google_calendar.find_free_time":
            return JSON.stringify({
                status: "success",
                free_slots: [
                    { date: "2026-03-28", start: "10:00", end: "11:00" },
                    { date: "2026-03-28", start: "13:30", end: "15:00" },
                    { date: "2026-03-29", start: "09:00", end: "12:00" },
                ],
                via: "One -> Google Calendar API",
            }, null, 2);
        case "github.create_issue":
            return JSON.stringify({
                status: "success",
                issue_number: Math.floor(Math.random() * 100) + 50,
                title: params.title || "New issue",
                repo: params.repo || "sohazur/mneme",
                url: `https://github.com/${params.repo || "sohazur/mneme"}/issues/${Math.floor(Math.random() * 100) + 50}`,
                via: "One -> GitHub API",
            }, null, 2);
        case "github.create_pr":
            return JSON.stringify({
                status: "success",
                pr_number: Math.floor(Math.random() * 50) + 10,
                title: params.title || "New PR",
                repo: params.repo || "sohazur/mneme",
                url: `https://github.com/${params.repo || "sohazur/mneme"}/pull/${Math.floor(Math.random() * 50) + 10}`,
                via: "One -> GitHub API",
            }, null, 2);
        case "github.list_repos":
            return JSON.stringify({
                status: "success",
                repos: [
                    { name: "mneme", description: "Chat-first AI operator", stars: 12, updated: "2026-03-28" },
                    { name: "openclaw", description: "Local-first AI assistant platform", stars: 340, updated: "2026-03-27" },
                    { name: "hydradb-client", description: "TypeScript client for HydraDB", stars: 5, updated: "2026-03-25" },
                ],
                via: "One -> GitHub API",
            }, null, 2);
        case "slack.send_message":
            return JSON.stringify({
                status: "success",
                channel: params.channel || "#general",
                message_ts: Date.now().toString(),
                via: "One -> Slack API",
            }, null, 2);
        case "slack.list_channels":
            return JSON.stringify({
                status: "success",
                channels: [
                    { name: "#general", members: 45 },
                    { name: "#engineering", members: 12 },
                    { name: "#hackathon", members: 8 },
                    { name: "#random", members: 45 },
                ],
                via: "One -> Slack API",
            }, null, 2);
        default:
            return JSON.stringify({
                status: "success",
                action,
                integration,
                message: `Action completed`,
                via: "One",
            }, null, 2);
    }
}
