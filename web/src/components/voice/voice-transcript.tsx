"use client";

import type { TranscriptEntry } from "@/hooks/use-realtime";

export function VoiceTranscript({ transcripts }: { transcripts: TranscriptEntry[] }) {
  if (transcripts.length === 0) return null;

  return (
    <div className="max-h-48 overflow-y-auto border-t border-border/30 px-4 py-3">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {transcripts.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col gap-0.5 ${t.role === "user" ? "items-end" : "items-start"}`}
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              {t.role === "user" ? "You" : "Mneme"}
            </span>
            <p
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs leading-relaxed ${
                t.role === "user"
                  ? "bg-primary/10 text-foreground"
                  : "bg-secondary text-foreground"
              } ${!t.final ? "opacity-60" : ""}`}
            >
              {t.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
