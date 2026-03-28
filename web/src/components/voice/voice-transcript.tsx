"use client";

import { useRef, useEffect } from "react";
import type { TranscriptEntry } from "@/hooks/use-realtime";

export function VoiceTranscript({ transcripts }: { transcripts: TranscriptEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  if (transcripts.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="max-h-48 overflow-y-auto border-t border-neutral-200 px-4 py-3"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {transcripts.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col gap-0.5 ${t.role === "user" ? "items-end" : "items-start"}`}
          >
            <span className="text-[10px] font-light uppercase tracking-widest text-neutral-300">
              {t.role === "user" ? "You" : "Mneme"}
            </span>
            <p
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                t.role === "user"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 bg-white text-neutral-700 shadow-sm"
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
