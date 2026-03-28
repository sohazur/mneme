// ── OpenAI Realtime + ElevenLabs TTS Voice Module ──
// OpenAI handles conversation (STT + AI reasoning)
// ElevenLabs handles voice output (TTS)

let peerConnection = null;
let dataChannel = null;
let localStream = null;
let isVoiceActive = false;
let isSpeaking = false;

// Audio queue for ElevenLabs TTS
let ttsQueue = [];
let ttsPlaying = false;

// Track current transcripts
let currentUserTranscript = "";
let currentAssistantTranscript = "";
let currentUserMsgEl = null;
let currentAssistantMsgEl = null;

// Track function call arguments (streamed in deltas)
let pendingFunctionCalls = {}; // call_id -> { name, args_str }

// DOM
const voiceBtn = document.getElementById("voice-btn");
const voiceStatus = document.getElementById("voice-status");
const audioEl = document.getElementById("voice-audio");

// ── Start Voice Session ──

async function startVoiceSession() {
    if (isVoiceActive) {
        stopVoiceSession();
        return;
    }

    voiceBtn.classList.add("active");
    voiceBtn.setAttribute("aria-label", "Stop voice");
    voiceStatus.textContent = "Connecting...";
    voiceStatus.classList.remove("hidden");

    try {
        // 1. Get mic permission
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 2. Get ephemeral token from backend
        const selectedModel = document.querySelector(".model-chip.active")?.dataset.model;
        const res = await apiFetch("/api/realtime/session", {
            method: "POST",
            body: JSON.stringify({
                model: selectedModel || "gpt-4o-realtime-preview-2025-06-03",
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to create session");
        }

        const session = await res.json();
        const ephemeralKey = session.client_secret?.value;
        if (!ephemeralKey) throw new Error("No ephemeral key returned");

        // 3. Create WebRTC peer connection
        peerConnection = new RTCPeerConnection();

        // 4. Mute OpenAI's audio — we use ElevenLabs instead
        peerConnection.ontrack = (event) => {
            // Attach but mute OpenAI's audio track
            audioEl.srcObject = event.streams[0];
            audioEl.volume = 0;
            audioEl.muted = true;
        };

        // 5. Add local mic track
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // 6. Create data channel for events
        dataChannel = peerConnection.createDataChannel("oai-events");
        dataChannel.onopen = () => {
            voiceStatus.textContent = "Listening...";
            isVoiceActive = true;
        };
        dataChannel.onmessage = handleRealtimeEvent;
        dataChannel.onclose = () => {
            if (isVoiceActive) stopVoiceSession();
        };

        // 7. Create SDP offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // 8. Send offer to OpenAI Realtime API
        const model = selectedModel || "gpt-4o-realtime-preview-2025-06-03";
        const sdpRes = await fetch(
            `https://api.openai.com/v1/realtime?model=${model}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/sdp",
                    "Authorization": `Bearer ${ephemeralKey}`,
                },
                body: offer.sdp,
            }
        );

        if (!sdpRes.ok) {
            throw new Error(`SDP exchange failed: ${sdpRes.status}`);
        }

        // 9. Set remote description
        const answerSdp = await sdpRes.text();
        await peerConnection.setRemoteDescription({
            type: "answer",
            sdp: answerSdp,
        });

    } catch (err) {
        console.error("[Voice] Error:", err);
        voiceStatus.textContent = `Error: ${err.message}`;
        setTimeout(() => stopVoiceSession(), 2000);
    }
}

// ── Stop Voice Session ──

function stopVoiceSession() {
    isVoiceActive = false;

    // Finalize any pending transcripts
    finalizeTranscripts();

    // Clean up WebRTC
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    // Reset audio
    audioEl.srcObject = null;
    audioEl.src = "";
    ttsQueue = [];
    ttsPlaying = false;
    isSpeaking = false;

    // Reset UI
    voiceBtn.classList.remove("active");
    voiceBtn.setAttribute("aria-label", "Start voice");
    voiceStatus.classList.add("hidden");
    voiceStatus.textContent = "";
}

// ── Handle Realtime Events from Data Channel ──

function handleRealtimeEvent(event) {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch {
        return;
    }

    // Debug: log all events to help troubleshoot
    if (data.type && !data.type.includes("audio.delta") && !data.type.includes("audio_transcript.delta")) {
        console.log(`[Voice Event] ${data.type}`, data.type.includes("function") || data.type.includes("output_item") ? data : "");
    }

    switch (data.type) {
        // User speech transcript (partial)
        case "conversation.item.input_audio_transcription.delta":
            currentUserTranscript += data.delta || "";
            updateLiveTranscript("user", currentUserTranscript);
            break;

        // User speech transcript (final)
        case "conversation.item.input_audio_transcription.completed":
            currentUserTranscript = data.transcript || currentUserTranscript;
            finalizeLiveTranscript("user", currentUserTranscript);
            currentUserTranscript = "";
            currentUserMsgEl = null;
            break;

        // Assistant response text (partial)
        case "response.audio_transcript.delta":
            currentAssistantTranscript += data.delta || "";
            updateLiveTranscript("assistant", currentAssistantTranscript);
            voiceStatus.textContent = "Speaking...";
            break;

        // Assistant response text (final) — send to ElevenLabs
        case "response.audio_transcript.done": {
            const finalText = data.transcript || currentAssistantTranscript;
            finalizeLiveTranscript("assistant", finalText);
            currentAssistantTranscript = "";
            currentAssistantMsgEl = null;

            // Speak via ElevenLabs
            if (finalText.trim()) {
                speakWithElevenLabs(finalText);
            }
            break;
        }

        // Also handle text-only responses
        case "response.text.delta":
            currentAssistantTranscript += data.delta || "";
            updateLiveTranscript("assistant", currentAssistantTranscript);
            voiceStatus.textContent = "Speaking...";
            break;

        case "response.text.done": {
            const finalText = data.text || currentAssistantTranscript;
            finalizeLiveTranscript("assistant", finalText);
            currentAssistantTranscript = "";
            currentAssistantMsgEl = null;

            if (finalText.trim()) {
                speakWithElevenLabs(finalText);
            }
            break;
        }

        // Speech started (user is talking)
        case "input_audio_buffer.speech_started":
            voiceStatus.textContent = "Hearing you...";
            // Stop current TTS if user starts talking
            stopTTS();
            break;

        // Speech stopped
        case "input_audio_buffer.speech_stopped":
            voiceStatus.textContent = "Processing...";
            break;

        // ── Function Call Handling ──

        // Function call started — track it
        case "response.output_item.added":
            if (data.item?.type === "function_call") {
                pendingFunctionCalls[data.item.call_id] = {
                    name: data.item.name,
                    args_str: "",
                };
                voiceStatus.textContent = `Calling ${data.item.name}...`;
            }
            break;

        // Function call arguments streaming
        case "response.function_call_arguments.delta":
            if (data.call_id && pendingFunctionCalls[data.call_id]) {
                pendingFunctionCalls[data.call_id].args_str += data.delta || "";
            }
            break;

        // Function call complete — execute it
        case "response.function_call_arguments.done":
            if (data.call_id) {
                const fc = pendingFunctionCalls[data.call_id] || { name: data.name, args_str: data.arguments || "" };
                delete pendingFunctionCalls[data.call_id];
                handleFunctionCall(data.call_id, fc.name || data.name, fc.args_str || data.arguments);
            }
            break;

        // Session errors
        case "error":
            console.error("[Voice] Realtime error:", data.error);
            voiceStatus.textContent = `Error: ${data.error?.message || "Unknown"}`;
            break;

        // Response done
        case "response.done":
            if (!isSpeaking) {
                voiceStatus.textContent = "Listening...";
            }
            break;
    }
}

// ── Function Call Execution ──

async function handleFunctionCall(callId, name, argsStr) {
    console.log(`[Voice] Function call: ${name}(${argsStr})`);
    voiceStatus.textContent = `Running ${name}...`;

    let args = {};
    try {
        args = JSON.parse(argsStr || "{}");
    } catch {
        args = {};
    }

    try {
        // Call our backend to execute the tool
        const res = await apiFetch("/api/realtime/tool-call", {
            method: "POST",
            body: JSON.stringify({ name, args }),
        });

        const data = await res.json();
        const result = data.result || "No result";

        console.log(`[Voice] Tool result: ${result.slice(0, 200)}`);

        // Send the function call output back to GPT-4o via the data channel
        if (dataChannel && dataChannel.readyState === "open") {
            // 1. Send the function call output
            dataChannel.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: result,
                },
            }));

            // 2. Tell GPT-4o to generate a response using the tool result
            dataChannel.send(JSON.stringify({
                type: "response.create",
            }));
        }

        voiceStatus.textContent = "Speaking...";
    } catch (err) {
        console.error("[Voice] Function call error:", err);
        voiceStatus.textContent = "Listening...";

        // Send error result back so GPT-4o can respond
        if (dataChannel && dataChannel.readyState === "open") {
            dataChannel.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: `Error: ${err.message}`,
                },
            }));
            dataChannel.send(JSON.stringify({
                type: "response.create",
            }));
        }
    }
}

// ── ElevenLabs TTS ──

async function speakWithElevenLabs(text) {
    console.log(`[TTS] Queuing: "${text.slice(0, 80)}..."`);
    ttsQueue.push(text);
    if (!ttsPlaying) {
        playNextTTS();
    }
}

async function playNextTTS() {
    if (ttsQueue.length === 0) {
        ttsPlaying = false;
        isSpeaking = false;
        if (isVoiceActive) {
            voiceStatus.textContent = "Listening...";
        }
        return;
    }

    ttsPlaying = true;
    isSpeaking = true;
    const text = ttsQueue.shift();

    try {
        const res = await apiFetch("/api/realtime/tts", {
            method: "POST",
            body: JSON.stringify({ text }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("[TTS] Failed:", res.status, errText);
            playNextTTS();
            return;
        }

        const audioBlob = await res.blob();
        console.log(`[TTS] Received audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        const audioUrl = URL.createObjectURL(audioBlob);

        // Use a separate audio element for ElevenLabs
        const ttsAudio = new Audio(audioUrl);
        ttsAudio.volume = 1.0;

        ttsAudio.onended = () => {
            console.log("[TTS] Playback ended");
            URL.revokeObjectURL(audioUrl);
            playNextTTS();
        };

        ttsAudio.onerror = (e) => {
            console.error("[TTS] Playback error:", e);
            URL.revokeObjectURL(audioUrl);
            playNextTTS();
        };

        console.log("[TTS] Playing audio...");
        await ttsAudio.play();
    } catch (err) {
        console.error("[TTS] Error:", err);
        playNextTTS();
    }
}

function stopTTS() {
    ttsQueue = [];
    ttsPlaying = false;
    isSpeaking = false;
}

// ── Live Transcript Rendering ──

function updateLiveTranscript(role, text) {
    if (!text.trim()) return;

    // Remove welcome state
    const welcome = document.getElementById("welcome-state");
    if (welcome) welcome.remove();

    if (role === "user") {
        if (!currentUserMsgEl) {
            currentUserMsgEl = createMessageEl("user", text);
            messagesEl.appendChild(currentUserMsgEl);
        } else {
            currentUserMsgEl.querySelector(".message-content").innerHTML = formatMarkdown(text);
        }
    } else {
        if (!currentAssistantMsgEl) {
            currentAssistantMsgEl = createMessageEl("assistant", text);
            messagesEl.appendChild(currentAssistantMsgEl);
        } else {
            currentAssistantMsgEl.querySelector(".message-content").innerHTML = formatMarkdown(text);
        }
    }
    scrollToBottom();
}

function finalizeLiveTranscript(role, text) {
    if (!text.trim()) return;

    if (role === "user" && currentUserMsgEl) {
        currentUserMsgEl.querySelector(".message-content").innerHTML = formatMarkdown(text);
        currentUserMsgEl.classList.remove("live");
    } else if (role === "assistant" && currentAssistantMsgEl) {
        currentAssistantMsgEl.querySelector(".message-content").innerHTML = formatMarkdown(text);
        currentAssistantMsgEl.classList.remove("live");
    }
    scrollToBottom();
}

function finalizeTranscripts() {
    if (currentUserMsgEl) {
        currentUserMsgEl.classList.remove("live");
        currentUserMsgEl = null;
        currentUserTranscript = "";
    }
    if (currentAssistantMsgEl) {
        currentAssistantMsgEl.classList.remove("live");
        currentAssistantMsgEl = null;
        currentAssistantTranscript = "";
    }
}

function createMessageEl(role, text) {
    const msg = document.createElement("div");
    msg.className = `message ${role} live`;

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "You" : "Mneme";

    // Add voice indicator
    const voiceIcon = document.createElement("span");
    voiceIcon.className = "voice-indicator";
    voiceIcon.innerHTML = ' <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M3 7a1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V15a1 1 0 1 0 2 0v-1.07A7 7 0 0 0 15 7a1 1 0 1 0-2 0 5 5 0 0 1-10 0z"/></svg>';
    roleLabel.appendChild(voiceIcon);

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    contentEl.innerHTML = formatMarkdown(text);

    msg.appendChild(roleLabel);
    msg.appendChild(contentEl);

    return msg;
}

// ── Model Selector Logic ──

function initModelSelector() {
    const chips = document.querySelectorAll(".model-chip");
    const inputWrapper = document.querySelector(".input-wrapper");

    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            // Update active state
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            const isVoice = chip.dataset.type === "voice";

            // Show/hide voice button
            voiceBtn.classList.toggle("hidden", !isVoice);

            // Show/hide text input
            if (isVoice) {
                inputWrapper.classList.add("voice-mode");
            } else {
                inputWrapper.classList.remove("voice-mode");
                // Stop voice if switching away
                if (isVoiceActive) stopVoiceSession();
            }
        });
    });
}

// ── Init ──

if (voiceBtn) {
    voiceBtn.addEventListener("click", startVoiceSession);
    initModelSelector();
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
    if (isVoiceActive) stopVoiceSession();
});
