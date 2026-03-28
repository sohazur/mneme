import { Router } from "express";
import { MnemeAgent } from "../../agent/index.js";
import type { AgentRequest } from "../../agent/types.js";

export const chatRouter = Router();
const agent = new MnemeAgent();

chatRouter.post("/chat", async (req, res) => {
    try {
        const { chatId, message, history } = req.body as AgentRequest;

        if (!chatId || !message) {
            res.status(400).json({ error: "chatId and message are required" });
            return;
        }

        const response = await agent.processMessage({
            chatId,
            message,
            history: history || [],
        });

        res.json(response);
    } catch (err) {
        console.error("[/api/chat] Error:", err);
        res.status(500).json({
            error: "Internal server error",
            detail: (err as Error).message,
        });
    }
});
