import { db } from "../firebase.js";

interface ChatEntry {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    trustReceipt?: Record<string, unknown>;
}

export async function appendChatEntry(uid: string, entry: ChatEntry): Promise<void> {
    await db.collection("users").doc(uid)
        .collection("chatHistory").add(entry);
}

export async function getChatHistory(uid: string, limit = 50): Promise<ChatEntry[]> {
    const snap = await db.collection("users").doc(uid)
        .collection("chatHistory")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();
    return snap.docs.map(d => d.data() as ChatEntry).reverse();
}
