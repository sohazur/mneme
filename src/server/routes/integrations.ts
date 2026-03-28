import { Router } from "express";
import {
    getIntegrations,
    connectIntegration,
    disconnectIntegration,
} from "../../integrations/one.js";

export const integrationsRouter = Router();

const ONE_API_KEY = process.env.ONE_API_KEY || "";

// List all integrations with connection status
integrationsRouter.get("/integrations", async (req, res) => {
    try {
        const integrations = await getIntegrations(req.uid!);
        res.json({
            integrations,
            oneConfigured: !!ONE_API_KEY,
        });
    } catch (err) {
        console.error("[/api/integrations] Error:", (err as Error).message);
        // Return the integration list with all disconnected as fallback
        const fallback = [
            { name: "gmail", label: "Gmail", icon: "\u2709\uFE0F", description: "Draft & send emails, search inbox, read emails", actions: [], connected: false },
            { name: "google_calendar", label: "Google Calendar", icon: "\uD83D\uDCC5", description: "Schedule meetings, find free time", actions: [], connected: false },
            { name: "github", label: "GitHub", icon: "\uD83D\uDCBB", description: "Create issues, open PRs, manage repos", actions: [], connected: false },
            { name: "slack", label: "Slack", icon: "\uD83D\uDCAC", description: "Send messages, search channels", actions: [], connected: false },
        ];
        res.json({ integrations: fallback, oneConfigured: !!ONE_API_KEY });
    }
});

// Connect an integration
integrationsRouter.post("/integrations/connect", async (req, res) => {
    const uid = req.uid!;
    const { integration } = req.body;
    if (!integration) {
        res.status(400).json({ error: "integration is required" });
        return;
    }

    try {
        await connectIntegration(uid, integration);
    } catch (err) {
        console.warn("[/api/integrations/connect] Firestore error, proceeding:", (err as Error).message);
    }

    res.json({
        connected: true,
        integration,
        via: ONE_API_KEY ? "one" : "local",
    });
});

// Disconnect an integration
integrationsRouter.post("/integrations/disconnect", async (req, res) => {
    const uid = req.uid!;
    const { integration } = req.body;
    if (!integration) {
        res.status(400).json({ error: "integration is required" });
        return;
    }

    try {
        await disconnectIntegration(uid, integration);
    } catch (err) {
        console.warn("[/api/integrations/disconnect] Firestore error:", (err as Error).message);
    }

    res.json({ disconnected: true, integration });
});
