import { db } from "../firebase.js";

export async function getConnectedIntegrations(uid: string): Promise<Set<string>> {
    const snap = await db.collection("users").doc(uid)
        .collection("integrations")
        .where("connected", "==", true)
        .get();
    return new Set(snap.docs.map(d => d.id));
}

export async function setIntegrationConnected(
    uid: string,
    name: string,
    connected: boolean,
): Promise<void> {
    await db.collection("users").doc(uid)
        .collection("integrations").doc(name).set(
            { connected, updatedAt: new Date().toISOString() },
            { merge: true },
        );
}
