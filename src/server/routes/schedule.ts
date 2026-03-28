import { Router } from "express";
import { addSchedule, listSchedules, removeSchedule } from "../firestore/schedules.js";

export const scheduleRouter = Router();

scheduleRouter.post("/schedule", async (req, res) => {
    const uid = req.uid!;
    const { name, message, type, at, cron } = req.body;

    if (!name || !message || !type) {
        res.status(400).json({ error: "name, message, and type are required" });
        return;
    }

    const schedule = await addSchedule(uid, name, message, type, at, cron);
    res.json({ schedule });
});

scheduleRouter.get("/schedules", async (req, res) => {
    const schedules = await listSchedules(req.uid!);
    res.json({ schedules });
});

scheduleRouter.delete("/schedule/:id", async (req, res) => {
    const removed = await removeSchedule(req.params.id);
    res.json({ removed });
});
