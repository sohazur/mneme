import { Router } from "express";
import {
    getIntegrations,
    connectIntegration,
    disconnectIntegration,
} from "../../integrations/one.js";

export const integrationsRouter = Router();

// List all integrations with connection status
integrationsRouter.get("/integrations/:chatId", (req, res) => {
    const integrations = getIntegrations(req.params.chatId);
    res.json({ integrations });
});

// Connect an integration
integrationsRouter.post("/integrations/connect", (req, res) => {
    const { chatId, integration } = req.body;
    if (!chatId || !integration) {
        res.status(400).json({ error: "chatId and integration are required" });
        return;
    }
    const success = connectIntegration(chatId, integration);
    if (!success) {
        res.status(404).json({ error: `Unknown integration: ${integration}` });
        return;
    }
    res.json({ connected: true, integration });
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
