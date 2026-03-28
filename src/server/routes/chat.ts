import { Router } from "express";
import { MnemeAgent } from "../../agent/index.js";
import { appendChatEntry, getChatHistory } from "../firestore/chatHistory.js";

export const chatRouter = Router();
const agent = new MnemeAgent();

chatRouter.post("/chat", async (req, res) => {
    try {
        const uid = req.uid!;
        const { message, history } = req.body;

        if (!message) {
            res.status(400).json({ error: "message is required" });
            return;
        }

        const response = await agent.processMessage({
            chatId: uid,
            message,
            history: history || [],
        });

        // Persist both messages to Firestore
        const timestamp = new Date().toISOString();
        await Promise.all([
            appendChatEntry(uid, { role: "user", content: message, timestamp }),
            appendChatEntry(uid, {
                role: "assistant",
                content: response.reply,
                timestamp,
                trustReceipt: response.trustReceipt as unknown as Record<string, unknown>,
            }),
        ]);

        res.json(response);
    } catch (err) {
        console.error("[/api/chat] Error:", err);
        res.status(500).json({
            error: "Internal server error",
            detail: (err as Error).message,
        });
    }
});

chatRouter.get("/chat/history", async (req, res) => {
    try {
        const history = await getChatHistory(req.uid!, 50);
        res.json({ history });
    } catch (err) {
        console.error("[/api/chat/history] Error:", err);
        res.status(500).json({ error: "Failed to load history" });
    }
});
