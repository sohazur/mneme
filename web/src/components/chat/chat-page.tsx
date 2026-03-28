"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Link2 } from "lucide-react";
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
import { CreateCompanion } from "@/components/onboarding/create-companion";
import { IntegrationsPanel } from "@/components/integrations/integrations-panel";

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs text-neutral-600">$1</code>')
    .replace(/\n/g, "<br>");
}

function ChatMessage({ msg }: { msg: DisplayMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Message
        from={msg.role}
        className={`flex flex-col gap-1 ${msg.role === "assistant" ? "items-start" : "items-end"}`}
      >
        <div>
          <div className="mb-1 px-1 text-[10px] font-light uppercase tracking-widest text-neutral-300">
            {msg.role === "user" ? "You" : "Mneme"}
          </div>
          <MessageContent>
            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
          </MessageContent>
          {msg.trustReceipt && <TrustReceipt receipt={msg.trustReceipt} />}
        </div>
      </Message>
    </motion.div>
  );
}

export function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { messages, isLoading, sendMessage, loadHistory, historyLoaded } = useChat();
  const [mode, setMode] = useState<ChatMode>("voice");
  const [onboarded, setOnboarded] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

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
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#FAFAFA]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl font-light tracking-tight text-neutral-900">Mneme</h1>
          <p className="mt-2 text-sm font-light text-neutral-400">Loading your session...</p>
        </motion.div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="size-5 rounded-full border-2 border-neutral-200 border-t-neutral-400"
        />
      </div>
    );
  }

  // Always show onboarding first on every login
  if (!onboarded) {
    return (
      <CreateCompanion
        onComplete={() => {
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#FAFAFA]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-sm font-medium tracking-tight text-neutral-900">
          Mneme
        </h1>
        <div className="flex items-center gap-4">
          <ModeToggle mode={mode} onChange={setMode} />
          <button
            onClick={() => setShowIntegrations(!showIntegrations)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
              showIntegrations
                ? "bg-neutral-900 text-white"
                : "border border-neutral-200 bg-white text-neutral-400 shadow-sm hover:text-neutral-600"
            }`}
          >
            <Link2 size={12} />
            Integrations
          </button>
          <span className="text-xs font-light text-neutral-400">
            {user.email}
          </span>
          <button
            onClick={() => signOut(auth)}
            className="rounded-full p-2 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-500"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Integrations Panel */}
      <AnimatePresence>
        {showIntegrations && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-neutral-100"
          >
            <IntegrationsPanel />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {mode === "chat" ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
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
          </motion.div>
        ) : (
          <motion.div
            key="voice"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <VoicePanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
