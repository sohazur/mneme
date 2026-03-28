"use client";

import dynamic from "next/dynamic";
import { useRealtime } from "@/hooks/use-realtime";
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer";
import { MicButton } from "./mic-button";
import { VoiceTranscript } from "./voice-transcript";

// Dynamic import to avoid SSR issues with Three.js
const PandaScene = dynamic(
  () => import("./panda-scene").then((m) => ({ default: m.PandaScene })),
  { ssr: false, loading: () => (
    <div className="flex flex-1 items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  )},
);

export function VoicePanel() {
  const { state, transcripts, error, remoteStream, start, stop } = useRealtime();
  const volumeRef = useAudioAnalyzer(remoteStream);
  const isActive = state !== "idle" && state !== "error";

  return (
    <div className="flex flex-1 flex-col">
      {/* 3D Panda Scene */}
      <div className="relative flex-1 min-h-0">
        <PandaScene volumeRef={volumeRef} state={state} />
        {/* Gradient fade at bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center py-4">
        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
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
