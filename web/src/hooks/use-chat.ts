"use client";

import { useState, useCallback } from "react";
import { apiPost, apiGet } from "@/lib/api";
import type { ChatMessage, AgentResponse, TrustReceipt } from "@/lib/types";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  trustReceipt?: TrustReceipt;
}

export function useChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const data = await apiGet<{ history: ChatMessage[] }>("/api/chat/history");
      if (data.history && data.history.length > 0) {
        const loaded: DisplayMessage[] = data.history.map((entry, i) => ({
          id: `hist-${i}`,
          role: entry.role as "user" | "assistant",
          content: entry.content,
          trustReceipt: entry.trustReceipt,
        }));
        setMessages(loaded);
      }
    } catch {
      // History load failed, start fresh
    }
    setHistoryLoaded(true);
  }, [historyLoaded]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const data = await apiPost<AgentResponse>("/api/chat", {
          message: trimmed,
          history,
        });

        const assistantMsg: DisplayMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          trustReceipt: data.trustReceipt,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: DisplayMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading],
  );

  return { messages, isLoading, sendMessage, loadHistory, historyLoaded };
}
