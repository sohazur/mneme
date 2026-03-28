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

export function VoicePanel() {
  const { state, transcripts, error, start, stop } = useRealtime();
  const isActive = state !== "idle" && state !== "error";
  const [greetingSpeaking, setGreetingSpeaking] = useState(false);
  const isSpeaking = state === "speaking" || greetingSpeaking;
  const initRef = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;

  // Greeting transcript
  const [greetingTranscript, setGreetingTranscript] = useState<TranscriptEntry | null>(null);
  const allTranscripts = greetingTranscript
    ? [greetingTranscript, ...transcripts]
    : transcripts;

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Check if onboarding already started the greeting audio
    const win = window as unknown as Record<string, unknown>;
    const greetingAudio = win.__mneme_greeting_audio as HTMLAudioElement | undefined;
    const greetingText = (win.__mneme_greeting_text as string) || GREETING;

    // Show transcript immediately
    setGreetingTranscript({
      id: "greeting",
      role: "assistant",
      text: greetingText,
      final: true,
    });

    if (greetingAudio && !greetingAudio.ended) {
      // Audio is already playing from onboarding — just wait for it to finish
      setGreetingSpeaking(true);

      const onEnd = async () => {
        setGreetingSpeaking(false);
        // Clean up global refs
        delete win.__mneme_greeting_audio;
        delete win.__mneme_greeting_text;
        // Auto-start mic
        try { await startRef.current(); } catch { /* ok */ }
      };

      greetingAudio.addEventListener("ended", onEnd, { once: true });
      // If it already ended between mount and this effect
      if (greetingAudio.ended) {
        onEnd();
      }
    } else {
      // No greeting audio from onboarding (e.g. direct navigation)
      // Try to play it now and then start mic
      delete win.__mneme_greeting_audio;
      delete win.__mneme_greeting_text;

      const run = async () => {
        setGreetingSpeaking(true);
        try {
          const { auth } = await import("@/lib/firebase");
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
          const res = await fetch("/api/realtime/tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ text: greetingText }),
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 1.0;
            await new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
              audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
              audio.play().catch(() => resolve());
            });
          }
        } catch { /* ok */ }
        setGreetingSpeaking(false);
        try { await startRef.current(); } catch { /* ok */ }
      };

      run();
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center">
        <PandaAvatar isSpeaking={isSpeaking} />
      </div>

      <div className="flex flex-col items-center py-6">
        {error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-500">{error}</p>
        )}
        <MicButton
          active={isActive || greetingSpeaking}
          onClick={isActive ? stop : start}
          state={greetingSpeaking ? "speaking" : state}
        />
      </div>

      <VoiceTranscript transcripts={allTranscripts} />
    </div>
  );
}
