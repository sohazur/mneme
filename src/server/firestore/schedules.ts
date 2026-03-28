import { db } from "../firebase.js";

export interface Schedule {
    id: string;
    uid: string;
    name: string;
    message: string;
    type: "once" | "recurring";
    at?: string;
    cron?: string;
    createdAt: string;
    lastRun?: string;
    active: boolean;
}

const col = () => db.collection("schedules");

export async function addSchedule(
    uid: string,
    name: string,
    message: string,
    type: "once" | "recurring",
    at?: string,
    cron?: string,
): Promise<Schedule> {
    const id = crypto.randomUUID();
    const schedule: Schedule = {
        id,
        uid,
        name,
        message,
        type,
        at,
        cron,
        createdAt: new Date().toISOString(),
        active: true,
    };
    await col().doc(id).set(schedule);
    return schedule;
}

export async function listSchedules(uid: string): Promise<Schedule[]> {
    const snap = await col()
        .where("uid", "==", uid)
        .where("active", "==", true)
        .get();
    return snap.docs.map(d => d.data() as Schedule);
}

export async function removeSchedule(id: string): Promise<boolean> {
    const doc = col().doc(id);
    const snap = await doc.get();
    if (!snap.exists) return false;
    await doc.update({ active: false });
    return true;
}

export async function checkDue(): Promise<Schedule[]> {
    const now = new Date();
    const due: Schedule[] = [];

    const snap = await col().where("active", "==", true).get();

    for (const docSnap of snap.docs) {
        const s = docSnap.data() as Schedule;

        if (s.type === "once" && s.at) {
            const target = new Date(s.at);
            if (target <= now && !s.lastRun) {
                due.push(s);
                await col().doc(s.id).update({
                    lastRun: now.toISOString(),
                    active: false,
                });
            }
        }

        if (s.type === "recurring" && s.cron) {
            const lastRun = s.lastRun ? new Date(s.lastRun) : new Date(0);
            const minutesSince = (now.getTime() - lastRun.getTime()) / 60_000;
            if (minutesSince >= 1) {
                due.push(s);
                await col().doc(s.id).update({
                    lastRun: now.toISOString(),
                });
            }
        }
    }

    return due;
}
