import "dotenv/config";
import express from "express";
import cors from "cors";
import { join } from "node:path";
import { chatRouter } from "./routes/chat.js";
import { scheduleRouter } from "./routes/schedule.js";
import { healthRouter } from "./routes/health.js";
import { integrationsRouter } from "./routes/integrations.js";
import { checkDue } from "../scheduler/index.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(join(process.cwd(), "public")));

// API routes
app.use("/api", healthRouter);
app.use("/api", chatRouter);
app.use("/api", scheduleRouter);
app.use("/api", integrationsRouter);

// Scheduler heartbeat (check every 30s)
setInterval(() => {
    const due = checkDue();
    for (const s of due) {
        console.log(`[Scheduler] Due: "${s.name}" → ${s.message}`);
    }
}, 30_000);

app.listen(PORT, () => {
    console.log(`\n  🧠 Mneme is running at http://localhost:${PORT}\n`);
    if (!process.env.LLM_API_KEY) console.warn("  ⚠  LLM_API_KEY not set");
    if (!process.env.HYDRA_OPENCLAW_API_KEY) console.warn("  ⚠  HYDRA_OPENCLAW_API_KEY not set");
    console.log("");
});
