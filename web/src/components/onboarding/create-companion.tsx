"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";

type OnboardingState = "input" | "creating" | "done";

interface CreateCompanionProps {
  onComplete: () => void;
}

const SHAPING_MESSAGES = [
  "Shaping your character...",
  "Adding personality...",
  "Bringing it to life...",
];

const GREETING = "Oh, hello there! Did you see that little butterfly? It fluttered right past my nose. I just love exploring all the pretty flowers in the forest. Everything feels so sparkly today, doesn't it? I wonder what new adventures we'll find around the next bend. Come on, let's go see!";

async function startGreetingTTS(): Promise<HTMLAudioElement | null> {
  try {
    // Get Firebase token
    const { auth } = await import("@/lib/firebase");
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

    const res = await fetch("/api/realtime/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: GREETING }),
    });

    if (!res.ok) return null;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;

    // Start playing immediately (we're still in user gesture context from Create click)
    await audio.play();
    return audio;
  } catch (err) {
    console.warn("[Greeting] TTS prefetch failed:", err);
    return null;
  }
}

export function CreateCompanion({ onComplete }: CreateCompanionProps) {
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<OnboardingState>("input");
  const [shapingMsg, setShapingMsg] = useState(SHAPING_MESSAGES[0]);

  const handleCreate = async () => {
    if (!description.trim()) return;
    setPhase("creating");

    // Cycle through shaping messages
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < SHAPING_MESSAGES.length) {
        setShapingMsg(SHAPING_MESSAGES[i]);
      }
    }, 1200);

    // Start TTS fetch NOW while we still have user gesture from the Create click
    // This is critical — browsers only allow audio.play() in user gesture context
    const ttsPromise = startGreetingTTS();

    // Wait for the animation
    await new Promise((r) => setTimeout(r, 3500));
    clearInterval(interval);

    setPhase("done");

    // Wait for TTS to start playing (it already started during "creating" phase)
    const audio = await ttsPromise;

    // Brief pause to show "ready" state, then transition
    await new Promise((r) => setTimeout(r, 400));

    // Store the playing audio globally so VoicePanel can track it
    if (audio) {
      (window as unknown as Record<string, unknown>).__mneme_greeting_audio = audio;
      (window as unknown as Record<string, unknown>).__mneme_greeting_text = GREETING;
    }

    onComplete();
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-[#FAFAFA] px-6">
      <AnimatePresence mode="wait">
        {phase === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-2xl flex-col items-center gap-8"
          >
            <div className="text-center">
              <h1 className="text-4xl font-light tracking-tight text-neutral-900 sm:text-5xl">
                Create your AI companion{" "}
                <em className="font-serif font-normal italic">with a soul</em>
              </h1>
              <p className="mt-4 text-base font-light text-neutral-400">
                Describe your companion, and bring it to life
              </p>
            </div>

            <div className="flex w-full max-w-xl items-center gap-3 rounded-full border border-neutral-200 bg-white px-6 py-4 shadow-sm transition-shadow focus-within:shadow-md">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="e.g. a cute panda with flowers on its head"
                autoFocus
                className="flex-1 bg-transparent text-base font-light text-neutral-900 placeholder:text-neutral-300 focus:outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={!description.trim()}
                className="flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900"
              >
                Create
                <Sparkles size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {phase === "creating" && (
          <motion.div
            key="creating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative">
              <motion.div
                className="size-20 rounded-full bg-neutral-900"
                animate={{
                  scale: [1, 1.15, 1],
                  borderRadius: ["50%", "40%", "50%"],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full bg-neutral-400/20"
                animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <motion.p
              key={shapingMsg}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-light text-neutral-400"
            >
              {shapingMsg}
            </motion.p>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              className="size-16 rounded-full bg-neutral-900"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 10 }}
            />
            <p className="text-sm font-light text-neutral-400">
              Your companion is ready
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
