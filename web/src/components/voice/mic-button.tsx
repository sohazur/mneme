"use client";

import { MicIcon, MicOffIcon } from "lucide-react";
import type { ConnectionState } from "@/hooks/use-realtime";

interface MicButtonProps {
  active: boolean;
  onClick: () => void;
  state: ConnectionState;
}

const STATE_LABELS: Record<ConnectionState, string> = {
  idle: "Tap to talk",
  connecting: "Connecting...",
  listening: "Listening...",
  hearing: "Hearing you...",
  processing: "Thinking...",
  speaking: "Speaking...",
  error: "Error — tap to retry",
};

export function MicButton({ active, onClick, state }: MicButtonProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onClick}
        className={`relative flex size-16 items-center justify-center rounded-full transition-all duration-300 ${
          active
            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
            : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
        }`}
      >
        {active && state !== "error" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/15" />
        )}
        {active ? <MicOffIcon className="relative size-6" /> : <MicIcon className="size-6" />}
      </button>
      <span className="text-xs text-muted-foreground">{STATE_LABELS[state]}</span>
    </div>
  );
}
