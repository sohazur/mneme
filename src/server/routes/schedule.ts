import { Router } from "express";
import { addSchedule, listSchedules, removeSchedule } from "../../scheduler/index.js";

export const scheduleRouter = Router();

scheduleRouter.post("/schedule", (req, res) => {
    const { chatId, name, message, type, at, cron } = req.body;

    if (!chatId || !name || !message || !type) {
        res.status(400).json({ error: "chatId, name, message, and type are required" });
        return;
    }

    const schedule = addSchedule(chatId, name, message, type, at, cron);
    res.json({ schedule });
});

scheduleRouter.get("/schedules/:chatId", (req, res) => {
    const schedules = listSchedules(req.params.chatId);
    res.json({ schedules });
});

scheduleRouter.delete("/schedule/:id", (req, res) => {
    const removed = removeSchedule(req.params.id);
    res.json({ removed });
});
