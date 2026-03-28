"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

const prompts = [
  "Remind me to review the PR tomorrow at 9am",
  "Draft an email to the team about the launch",
  "What do you remember about me?",
];

export function WelcomeScreen({ onPrompt }: { onPrompt: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-1 flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-xl space-y-12 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-light tracking-tight text-neutral-900 md:text-5xl">
            Your AI operator{" "}
            <span className="italic font-serif">with memory</span>
          </h1>
          <p className="text-neutral-500 text-lg font-light">
            Ask anything, and Mneme remembers
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {prompts.map((p, i) => (
            <motion.button
              key={p}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onPrompt(p)}
              className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-4 text-left text-base font-light text-neutral-500 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md hover:text-neutral-700 active:scale-[0.98]"
            >
              <Sparkles size={14} className="shrink-0 text-neutral-300 group-hover:text-neutral-400 transition-colors" />
              {p}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
