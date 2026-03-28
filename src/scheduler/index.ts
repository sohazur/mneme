import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface Schedule {
    id: string;
    chatId: string;
    name: string;
    message: string;
    type: "once" | "recurring";
    at?: string;         // ISO 8601 for one-shot
    cron?: string;        // cron expression for recurring
    createdAt: string;
    lastRun?: string;
    active: boolean;
}

const STORE_PATH = join(process.cwd(), "data", "schedules.json");

function loadStore(): Schedule[] {
    try {
        if (existsSync(STORE_PATH)) {
            return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as Schedule[];
        }
    } catch { /* ignore */ }
    return [];
}

function saveStore(schedules: Schedule[]): void {
    const dir = dirname(STORE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(schedules, null, 2));
}

let schedules: Schedule[] = loadStore();

export function addSchedule(
    chatId: string,
    name: string,
    message: string,
    type: "once" | "recurring",
    at?: string,
    cron?: string,
): Schedule {
    const schedule: Schedule = {
        id: crypto.randomUUID(),
        chatId,
        name,
        message,
        type,
        at,
        cron,
        createdAt: new Date().toISOString(),
        active: true,
    };
    schedules.push(schedule);
    saveStore(schedules);
    return schedule;
}

export function listSchedules(chatId: string): Schedule[] {
    return schedules.filter((s) => s.chatId === chatId && s.active);
}

export function removeSchedule(id: string): boolean {
    const idx = schedules.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    schedules[idx].active = false;
    saveStore(schedules);
    return true;
}

export function checkDue(): Schedule[] {
    const now = new Date();
    const due: Schedule[] = [];

    for (const s of schedules) {
        if (!s.active) continue;

        if (s.type === "once" && s.at) {
            const target = new Date(s.at);
            if (target <= now && !s.lastRun) {
                due.push(s);
                s.lastRun = now.toISOString();
                s.active = false; // one-shot, done
            }
        }

        if (s.type === "recurring" && s.cron) {
            // Simple interval check: if last run was > 1 minute ago or never, it's due
            // Full cron parsing would use node-cron; keeping it simple for hackathon
            const lastRun = s.lastRun ? new Date(s.lastRun) : new Date(0);
            const minutesSince = (now.getTime() - lastRun.getTime()) / 60_000;
            if (minutesSince >= 1) {
                due.push(s);
                s.lastRun = now.toISOString();
            }
        }
    }

    if (due.length > 0) saveStore(schedules);
    return due;
}
