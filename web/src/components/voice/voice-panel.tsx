"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { useRealtime, type TranscriptEntry } from "@/hooks/use-realtime";
import { MicButton } from "./mic-button";
import { VoiceTranscript } from "./voice-transcript";

const GREETING = "Oh, hello there! Did you see that little butterfly? It fluttered right past my nose. I just love exploring all the pretty flowers in the forest. Everything feels so sparkly today, doesn't it? I wonder what new adventures we'll find around the next bend. Come on, let's go see!";

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
      <div className="absolute inset-0 scale-110 rounded-3xl bg-neutral-200 opacity-30 blur-3xl" />
      <div className="relative size-64 overflow-hidden rounded-3xl border border-neutral-100 bg-white/50 shadow-2xl shadow-neutral-200/50 backdrop-blur-sm">
        <Image
          src="/panda.jpeg"
          alt="Mneme Panda"
          fill
          className="object-cover"
          priority
        />
        <motion.div
          className="absolute inset-0 bg-white/10"
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

async function playGreetingTTS(text: string): Promise<void> {
  // Get Firebase token for authenticated TTS call
  const { auth } = await import("@/lib/firebase");
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

  const res = await fetch("/api/realtime/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Audio playback failed")); };
    audio.play().catch(reject);
  });
}

export function VoicePanel() {
  const { state, transcripts, error, start, stop } = useRealtime();
  const isActive = state !== "idle" && state !== "error";
  const [greeting, setGreeting] = useState(false);
  const isSpeaking = state === "speaking" || greeting;
  const greetedRef = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;

  // Merge greeting transcript with realtime transcripts
  const [greetingTranscript, setGreetingTranscript] = useState<TranscriptEntry | null>(null);
  const allTranscripts = greetingTranscript
    ? [greetingTranscript, ...transcripts]
    : transcripts;

  // Play greeting on mount, then auto-start mic
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;

    const run = async () => {
      // Show transcript immediately
      setGreetingTranscript({
        id: "greeting",
        role: "assistant",
        text: GREETING,
        final: true,
      });

      // Play TTS
      setGreeting(true);
      try {
        await playGreetingTTS(GREETING);
      } catch (err) {
        console.warn("[Greeting] TTS failed:", err);
      }
      setGreeting(false);

      // Auto-start the voice session after greeting
      try {
        await startRef.current();
      } catch (err) {
        console.warn("[Greeting] Auto-start failed:", err);
      }
    };

    // Small delay so UI renders first
    const timer = setTimeout(run, 500);
    return () => clearTimeout(timer);
  }, []);

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
          active={isActive || greeting}
          onClick={isActive ? stop : start}
          state={greeting ? "speaking" : state}
        />
      </div>

      {/* Transcripts */}
      <VoiceTranscript transcripts={allTranscripts} />
    </div>
  );
}
