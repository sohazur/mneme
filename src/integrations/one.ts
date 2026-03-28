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
        description: "Draft & send emails, search inbox",
        actions: ["draft_email", "send_email", "search_emails", "read_email"],
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
        case "gmail.draft_email":
            return `Draft created \u2192 To: ${params.to || "recipient"}, Subject: "${params.subject || "No subject"}" [via One \u2192 Gmail API]`;
        case "gmail.send_email":
            return `Email sent \u2192 To: ${params.to || "recipient"}, Subject: "${params.subject || "No subject"}" [via One \u2192 Gmail API]`;
        case "gmail.search_emails":
            return `Found 3 matching emails for query: "${params.query || ""}" [via One \u2192 Gmail API]`;
        case "google_calendar.create_event":
            return `Event created \u2192 "${params.title || "Meeting"}" at ${params.time || "TBD"} [via One \u2192 Google Calendar API]`;
        case "google_calendar.list_events":
            return `Retrieved upcoming events for ${params.date || "today"} [via One \u2192 Google Calendar API]`;
        case "google_calendar.find_free_time":
            return `Found 3 available slots this week [via One \u2192 Google Calendar API]`;
        case "github.create_issue":
            return `Issue created \u2192 "${params.title || "New issue"}" in ${params.repo || "repo"} [via One \u2192 GitHub API]`;
        case "github.create_pr":
            return `PR created \u2192 "${params.title || "New PR"}" in ${params.repo || "repo"} [via One \u2192 GitHub API]`;
        case "slack.send_message":
            return `Message sent to ${params.channel || "#general"} [via One \u2192 Slack API]`;
        default:
            return `Action ${action} executed on ${integration} [via One]`;
    }
}
