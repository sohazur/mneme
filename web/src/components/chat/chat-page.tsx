"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useChat, type DisplayMessage } from "@/hooks/use-chat";
import { Conversation, ConversationContent } from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageInput } from "./message-input";
import { WelcomeScreen } from "./welcome-screen";
import { TypingIndicator } from "./typing-indicator";
import { TrustReceipt } from "./trust-receipt";
import { ModeToggle, type ChatMode } from "./mode-toggle";
import { VoicePanel } from "@/components/voice/voice-panel";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">$1</code>')
    .replace(/\n/g, "<br>");
}

function ChatMessage({ msg }: { msg: DisplayMessage }) {
  return (
    <Message
      from={msg.role}
      className={`flex flex-col gap-1 ${msg.role === "assistant" ? "items-start" : "items-end"}`}
    >
      <div>
        <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
          {msg.role === "user" ? "You" : "Mneme"}
        </div>
        <MessageContent>
          <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
        </MessageContent>
        {msg.trustReceipt && <TrustReceipt receipt={msg.trustReceipt} />}
      </div>
    </Message>
  );
}

export function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { messages, isLoading, sendMessage, loadHistory, historyLoaded } = useChat();
  const [mode, setMode] = useState<ChatMode>("chat");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && !historyLoaded) {
      loadHistory();
    }
  }, [user, historyLoaded, loadHistory]);

  if (authLoading || !user) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight">Mneme</h1>
        <div className="flex items-center gap-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <span className="text-xs text-muted-foreground">
            {user.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => signOut(auth)}
          >
            <LogOutIcon className="size-3.5" />
          </Button>
        </div>
      </header>

      {mode === "chat" ? (
        <>
          {/* Text Chat */}
          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen onPrompt={sendMessage} />
          ) : (
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto max-w-3xl">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} msg={msg} />
                ))}
                {isLoading && <TypingIndicator />}
              </ConversationContent>
            </Conversation>
          )}
          <MessageInput onSend={sendMessage} disabled={isLoading} />
        </>
      ) : (
        /* Voice + 3D Panda */
        <VoicePanel />
      )}
    </div>
  );
}
