import "dotenv/config";
import express from "express";
import cors from "cors";
import { join } from "node:path";
import { chatRouter } from "./routes/chat.js";
import { scheduleRouter } from "./routes/schedule.js";
import { healthRouter } from "./routes/health.js";
import { integrationsRouter } from "./routes/integrations.js";
import { realtimeRouter } from "./routes/realtime.js";
import { requireAuth } from "./middleware/auth.js";
import { checkDue } from "./firestore/schedules.js";
import "./firebase.js"; // ensure Firebase Admin initializes

const PORT = parseInt(process.env.PORT || "3001", 10);
const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(join(process.cwd(), "public")));

// Public API routes
app.use("/api", healthRouter);

// Protected API routes (require Firebase Auth)
app.use("/api", requireAuth, chatRouter);
app.use("/api", requireAuth, scheduleRouter);
app.use("/api", requireAuth, integrationsRouter);
app.use("/api", requireAuth, realtimeRouter);

// Scheduler heartbeat (check every 30s)
setInterval(async () => {
    try {
        const due = await checkDue();
        for (const s of due) {
            console.log(`[Scheduler] Due: "${s.name}" → ${s.message}`);
        }
    } catch (err) {
        console.warn("[Scheduler] Error:", (err as Error).message);
    }
}, 30_000);

app.listen(PORT, () => {
    console.log(`\n  Mneme is running at http://localhost:${PORT}\n`);
    if (!process.env.LLM_API_KEY) console.warn("  LLM_API_KEY not set");
    if (!process.env.HYDRA_OPENCLAW_API_KEY) console.warn("  HYDRA_OPENCLAW_API_KEY not set");
    if (!process.env.FIREBASE_PROJECT_ID) console.warn("  FIREBASE_PROJECT_ID not set");
    if (!process.env.OPENAI_API_KEY) console.warn("  OPENAI_API_KEY not set (voice disabled)");
    console.log("");
});
