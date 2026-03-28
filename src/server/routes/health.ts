import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "mneme",
        timestamp: new Date().toISOString(),
        config: {
            llm: process.env.LLM_MODEL || "moonshotai/Kimi-K2.5",
            llmConfigured: !!process.env.LLM_API_KEY,
            hydraConfigured: !!process.env.HYDRA_OPENCLAW_API_KEY,
        },
    });
});
