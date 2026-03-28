"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { apiPost } from "@/lib/api";
import { auth } from "@/lib/firebase";

export type ConnectionState = "idle" | "connecting" | "listening" | "hearing" | "processing" | "speaking" | "error";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
}

interface RealtimeSession {
  client_secret: { value: string };
}

export function useRealtime() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);

  // Mutable transcript accumulators (don't need re-renders)
  const userBuf = useRef("");
  const assistantBuf = useRef("");
  const pendingCalls = useRef<Record<string, { name: string; args: string }>>({});

  const addOrUpdateTranscript = useCallback(
    (role: "user" | "assistant", text: string, final: boolean) => {
      setTranscripts((prev) => {
        const liveIdx = prev.findIndex((t) => t.role === role && !t.final);
        if (liveIdx >= 0) {
          const copy = [...prev];
          copy[liveIdx] = { ...copy[liveIdx], text, final };
          return copy;
        }
        return [...prev, { id: `${role}-${Date.now()}`, role, text, final }];
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (ev: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }

      const type = data.type as string;

      switch (type) {
        // User transcript
        case "conversation.item.input_audio_transcription.delta":
          userBuf.current += (data.delta as string) || "";
          addOrUpdateTranscript("user", userBuf.current, false);
          setState("hearing");
          break;

        case "conversation.item.input_audio_transcription.completed":
          userBuf.current = (data.transcript as string) || userBuf.current;
          addOrUpdateTranscript("user", userBuf.current, true);
          userBuf.current = "";
          break;

        // Assistant transcript
        case "response.audio_transcript.delta":
          assistantBuf.current += (data.delta as string) || "";
          addOrUpdateTranscript("assistant", assistantBuf.current, false);
          setState("speaking");
          break;

        case "response.audio_transcript.done":
          assistantBuf.current = (data.transcript as string) || assistantBuf.current;
          addOrUpdateTranscript("assistant", assistantBuf.current, true);
          assistantBuf.current = "";
          setState("listening");
          break;

        // Text responses (fallback)
        case "response.text.delta":
          assistantBuf.current += (data.delta as string) || "";
          addOrUpdateTranscript("assistant", assistantBuf.current, false);
          setState("speaking");
          break;

        case "response.text.done":
          assistantBuf.current = (data.text as string) || assistantBuf.current;
          addOrUpdateTranscript("assistant", assistantBuf.current, true);
          assistantBuf.current = "";
          setState("listening");
          break;

        // Function calls
        case "response.output_item.added": {
          const item = data.item as Record<string, unknown> | undefined;
          if (item?.type === "function_call") {
            pendingCalls.current[item.call_id as string] = {
              name: item.name as string,
              args: "",
            };
          }
          break;
        }

        case "response.function_call_arguments.delta": {
          const callId = data.call_id as string;
          if (callId && pendingCalls.current[callId]) {
            pendingCalls.current[callId].args += (data.delta as string) || "";
          }
          break;
        }

        case "response.function_call_arguments.done": {
          const callId = data.call_id as string;
          if (callId) {
            const fc = pendingCalls.current[callId] || {
              name: data.name as string,
              args: (data.arguments as string) || "",
            };
            delete pendingCalls.current[callId];
            executeFunctionCall(callId, fc.name || (data.name as string), fc.args || (data.arguments as string) || "{}");
          }
          break;
        }

        // VAD states
        case "input_audio_buffer.speech_started":
          setState("hearing");
          break;
        case "input_audio_buffer.speech_stopped":
          setState("processing");
          break;

        // Errors
        case "error":
          setError((data.error as Record<string, string>)?.message || "Unknown error");
          setState("error");
          break;

        case "response.done":
          // Only go back to listening if not already speaking
          setState((s) => (s === "speaking" ? s : "listening"));
          break;
      }
    },
    [addOrUpdateTranscript],
  );

  const executeFunctionCall = useCallback(
    async (callId: string, name: string, argsStr: string) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(argsStr); } catch { /* empty */ }

      try {
        const result = await apiPost<{ result: string }>("/api/realtime/tool-call", { name, args });
        const dc = dcRef.current;
        if (dc && dc.readyState === "open") {
          dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: callId, output: result.result },
          }));
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      } catch (err) {
        const dc = dcRef.current;
        if (dc && dc.readyState === "open") {
          dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: callId, output: `Error: ${(err as Error).message}` },
          }));
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      }
    },
    [],
  );

  const start = useCallback(async () => {
    setState("connecting");
    setError(null);

    try {
      // 1. Mic permission
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;

      // 2. Get ephemeral token
      const session = await apiPost<RealtimeSession>("/api/realtime/session", {
        model: "gpt-4o-realtime-preview-2025-06-03",
        voice: "shimmer",
      });
      const ephemeralKey = session.client_secret?.value;
      if (!ephemeralKey) throw new Error("No ephemeral key");

      // 3. WebRTC
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        setRemoteStream(ev.streams[0]);
      };

      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // 4. Data channel
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => setState("listening");
      dc.onmessage = handleEvent;
      dc.onclose = () => setState("idle");

      // 5. SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/sdp",
            Authorization: `Bearer ${ephemeralKey}`,
          },
          body: offer.sdp,
        },
      );

      if (!sdpRes.ok) throw new Error(`SDP exchange failed: ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (err) {
      setError((err as Error).message);
      setState("error");
      stop();
    }
  }, [handleEvent]);

  const stop = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    setRemoteStream(null);
    setState("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { state, transcripts, error, remoteStream, start, stop };
}
