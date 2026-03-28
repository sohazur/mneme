"use client";

import { useEffect, useRef } from "react";

/**
 * Analyzes a MediaStream's audio volume in real-time.
 * Returns a ref (not state) with a 0-1 volume value updated at ~60fps.
 * Safe to read in useFrame() without causing re-renders.
 */
export function useAudioAnalyzer(stream: MediaStream | null) {
  const volumeRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) {
      volumeRef.current = 0;
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      // RMS volume normalized to 0-1
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      volumeRef.current = Math.min(1, Math.sqrt(sum / dataArray.length) / 128);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      ctx.close();
      ctxRef.current = null;
      volumeRef.current = 0;
    };
  }, [stream]);

  return volumeRef;
}
