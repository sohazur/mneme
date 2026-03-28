"use client";

import { MessageSquare, Mic } from "lucide-react";

export type ChatMode = "chat" | "voice";

interface ModeToggleProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex overflow-hidden rounded-full border border-neutral-200 bg-white text-xs shadow-sm">
      <button
        className={`flex items-center gap-1.5 px-4 py-1.5 transition-all ${
          mode === "chat"
            ? "bg-neutral-900 text-white"
            : "text-neutral-400 hover:text-neutral-600"
        }`}
        onClick={() => onChange("chat")}
      >
        <MessageSquare size={12} />
        Chat
      </button>
      <button
        className={`flex items-center gap-1.5 px-4 py-1.5 transition-all ${
          mode === "voice"
            ? "bg-neutral-900 text-white"
            : "text-neutral-400 hover:text-neutral-600"
        }`}
        onClick={() => onChange("voice")}
      >
        <Mic size={12} />
        Voice
      </button>
    </div>
  );
}
