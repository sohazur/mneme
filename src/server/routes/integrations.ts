import { Router } from "express";
import {
    getIntegrations,
    connectIntegration,
    disconnectIntegration,
} from "../../integrations/one.js";

export const integrationsRouter = Router();

const ONE_API_KEY = process.env.ONE_API_KEY || "";

// List all integrations with connection status
integrationsRouter.get("/integrations/:chatId", (req, res) => {
    const integrations = getIntegrations(req.params.chatId);
    res.json({
        integrations,
        oneConfigured: !!ONE_API_KEY,
    });
});

// Start OAuth connection via One
integrationsRouter.post("/integrations/connect", async (req, res) => {
    const { chatId, integration } = req.body;
    if (!chatId || !integration) {
        res.status(400).json({ error: "chatId and integration are required" });
        return;
    }

    // If One API key is configured, try to initiate via One's API
    if (ONE_API_KEY) {
        try {
            // Attempt to create a connection session via One's passthrough API
            const oneRes = await fetch("https://api.withone.ai/v1/passthrough", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${ONE_API_KEY}`,
                },
                body: JSON.stringify({
                    platform: integration,
                    action: "connect",
                    identity: chatId,
                }),
            });

            if (oneRes.ok) {
                const data = await oneRes.json();
                connectIntegration(chatId, integration);
                res.json({
                    connected: true,
                    integration,
                    via: "one",
                    connectionKey: (data as Record<string, unknown>).connection_key || null,
                });
                return;
            }
        } catch {
            // One API not reachable or not supported — fall through to managed flow
        }
    }

    // Managed connection flow: direct to One's dashboard
    connectIntegration(chatId, integration);
    res.json({
        connected: true,
        integration,
        via: ONE_API_KEY ? "one" : "local",
        oauthUrl: `https://app.withone.ai/connections`,
    });
});

// Disconnect an integration
integrationsRouter.post("/integrations/disconnect", (req, res) => {
    const { chatId, integration } = req.body;
    if (!chatId || !integration) {
        res.status(400).json({ error: "chatId and integration are required" });
        return;
    }
    const success = disconnectIntegration(chatId, integration);
    res.json({ disconnected: success, integration });
});
