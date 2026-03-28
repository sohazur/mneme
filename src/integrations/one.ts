/**
 * One Integration Layer (withone.ai)
 *
 * One provides managed authentication for 250+ apps.
 * For the hackathon demo, this layer simulates integration actions
 * and logs what *would* happen through One's infrastructure.
 * The trust receipt transparently shows each action.
 */

export interface IntegrationAction {
    integration: string;
    action: string;
    params: Record<string, unknown>;
    result: string;
    simulated: boolean;
}

const AVAILABLE_INTEGRATIONS = [
    {
        name: "gmail",
        label: "Gmail",
        actions: ["draft_email", "send_email", "search_emails", "read_email"],
    },
    {
        name: "google_calendar",
        label: "Google Calendar",
        actions: ["create_event", "list_events", "update_event", "find_free_time"],
    },
    {
        name: "github",
        label: "GitHub",
        actions: ["create_issue", "create_pr", "list_repos", "search_code"],
    },
    {
        name: "slack",
        label: "Slack",
        actions: ["send_message", "list_channels", "search_messages"],
    },
];

export function getAvailableIntegrations() {
    return AVAILABLE_INTEGRATIONS;
}

export async function executeIntegrationAction(
    integration: string,
    action: string,
    params: Record<string, unknown> = {},
): Promise<IntegrationAction> {
    const integ = AVAILABLE_INTEGRATIONS.find((i) => i.name === integration);

    if (!integ) {
        return {
            integration,
            action,
            params,
            result: `Unknown integration: ${integration}. Available: ${AVAILABLE_INTEGRATIONS.map((i) => i.name).join(", ")}`,
            simulated: true,
        };
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

    // Simulate the action with realistic output
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
            return `Draft created → To: ${params.to || "recipient"}, Subject: "${params.subject || "No subject"}" [via One → Gmail API]`;
        case "gmail.send_email":
            return `Email sent → To: ${params.to || "recipient"}, Subject: "${params.subject || "No subject"}" [via One → Gmail API]`;
        case "gmail.search_emails":
            return `Found 3 matching emails for query: "${params.query || ""}" [via One → Gmail API]`;
        case "google_calendar.create_event":
            return `Event created → "${params.title || "Meeting"}" at ${params.time || "TBD"} [via One → Google Calendar API]`;
        case "google_calendar.list_events":
            return `Retrieved upcoming events for ${params.date || "today"} [via One → Google Calendar API]`;
        case "google_calendar.find_free_time":
            return `Found 3 available slots this week [via One → Google Calendar API]`;
        case "github.create_issue":
            return `Issue created → "${params.title || "New issue"}" in ${params.repo || "repo"} [via One → GitHub API]`;
        case "github.create_pr":
            return `PR created → "${params.title || "New PR"}" in ${params.repo || "repo"} [via One → GitHub API]`;
        case "slack.send_message":
            return `Message sent to ${params.channel || "#general"} [via One → Slack API]`;
        default:
            return `Action ${action} executed on ${integration} [via One]`;
    }
}
