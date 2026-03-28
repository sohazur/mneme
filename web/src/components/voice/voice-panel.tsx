"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useRealtime } from "@/hooks/use-realtime";
import { MicButton } from "./mic-button";
import { VoiceTranscript } from "./voice-transcript";

function PandaAvatar({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      animate={{
        y: [0, -8, 0],
        scale: isSpeaking ? [1, 1.03, 1] : 1,
      }}
      transition={{
        y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        scale: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {/* Soft glow */}
      <div className="absolute inset-0 scale-110 rounded-3xl bg-neutral-200 opacity-30 blur-3xl" />

      {/* Frame */}
      <div className="relative size-64 overflow-hidden rounded-3xl border border-neutral-100 bg-white/50 shadow-2xl shadow-neutral-200/50 backdrop-blur-sm">
        <Image
          src="/panda.jpeg"
          alt="Mneme Panda"
          fill
          className="object-cover"
          priority
        />
        {/* Breathing overlay */}
        <motion.div
          className="absolute inset-0 bg-white/10"
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

export function VoicePanel() {
  const { state, transcripts, error, start, stop } = useRealtime();
  const isActive = state !== "idle" && state !== "error";
  const isSpeaking = state === "speaking";

  return (
    <div className="flex flex-1 flex-col">
      {/* Panda Avatar */}
      <div className="flex flex-1 items-center justify-center">
        <PandaAvatar isSpeaking={isSpeaking} />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center py-6">
        {error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-500">{error}</p>
        )}
        <MicButton
          active={isActive}
          onClick={isActive ? stop : start}
          state={state}
        />
      </div>

      {/* Transcripts */}
      <VoiceTranscript transcripts={transcripts} />
    </div>
  );
}
