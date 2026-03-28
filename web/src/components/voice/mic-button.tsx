"use client";

import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Loader2, Circle } from "lucide-react";
import type { ConnectionState } from "@/hooks/use-realtime";

interface MicButtonProps {
  active: boolean;
  onClick: () => void;
  state: ConnectionState;
}

const STATE_LABELS: Record<ConnectionState, string> = {
  idle: "Start talking",
  connecting: "Connecting...",
  listening: "Listening...",
  hearing: "Hearing you...",
  processing: "Thinking...",
  speaking: "Speaking...",
  error: "Error — tap to retry",
};

export function MicButton({ active, onClick, state }: MicButtonProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[10px] font-light uppercase tracking-widest text-neutral-400">
        {STATE_LABELS[state]}
      </p>
      <motion.button
        onClick={onClick}
        className={`relative flex size-20 items-center justify-center rounded-full transition-all duration-500 ${
          active
            ? "bg-neutral-900 border-none"
            : "bg-white border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300"
        }`}
        whileTap={{ scale: 0.9 }}
      >
        <AnimatePresence mode="wait">
          {!active ? (
            <motion.div
              key="mic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Mic size={24} className="text-neutral-400" />
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="relative"
            >
              {(state === "listening" || state === "hearing") && (
                <motion.div
                  className="absolute -inset-2 rounded-full bg-white/20"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              {state === "processing" || state === "connecting" ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : state === "error" ? (
                <MicOff size={24} className="text-red-400" />
              ) : (
                <Circle size={12} fill="white" className="text-white" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
