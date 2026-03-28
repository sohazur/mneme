// Session ID — persists per tab
const chatId = sessionStorage.getItem("mneme-chat-id") || crypto.randomUUID();
sessionStorage.setItem("mneme-chat-id", chatId);

// State
const history = [];
const MAX_HISTORY = 20;

// DOM
const messagesEl = document.getElementById("messages");
const loadingEl = document.getElementById("loading");
const form = document.getElementById("input-form");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    appendMessage("user", text);
    history.push({ role: "user", content: text });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    setLoading(true);

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, message: text, history: history.slice(0, -1) }),
        });

        const data = await res.json();

        if (!res.ok) {
            appendMessage("assistant", `Error: ${data.error || "Something went wrong"}`);
            return;
        }

        appendMessage("assistant", data.reply, data.trustReceipt);
        history.push({ role: "assistant", content: data.reply });
        if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    } catch (err) {
        appendMessage("assistant", `Connection error: ${err.message}`);
    } finally {
        setLoading(false);
    }
});

function appendMessage(role, content, trustReceipt) {
    const msg = document.createElement("div");
    msg.className = `message ${role}`;

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    contentEl.innerHTML = formatMarkdown(content);
    msg.appendChild(contentEl);

    if (trustReceipt) {
        msg.appendChild(renderTrustReceipt(trustReceipt));
    }

    messagesEl.appendChild(msg);
    scrollToBottom();
}

function renderTrustReceipt(receipt) {
    const details = document.createElement("details");
    details.className = "trust-receipt";

    const summary = document.createElement("summary");
    summary.textContent = `Trust Receipt — ${receipt.latencyMs}ms | ${receipt.model}`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "trust-receipt-body";

    // Timestamp
    addRow(body, "Timestamp", new Date(receipt.timestamp).toLocaleString());

    // Model
    addRow(body, "Model", receipt.model);

    // Latency
    addRow(body, "Latency", `${receipt.latencyMs}ms`);

    // Memory stored
    addRow(body, "Memory", receipt.memoryStored ? "Stored" : "Not stored",
        receipt.memoryStored ? "success" : "warning");

    // Memories recalled
    if (receipt.memoriesRecalled && receipt.memoriesRecalled.length > 0) {
        addRow(body, "Recalled", `${receipt.memoriesRecalled.length} memories`);
        for (const mem of receipt.memoriesRecalled) {
            const memEl = document.createElement("div");
            memEl.className = "receipt-memory";
            memEl.textContent = `[${mem.score.toFixed(2)}] ${mem.text}`;
            body.appendChild(memEl);
        }
    } else {
        addRow(body, "Recalled", "No prior memories", "warning");
    }

    // Tools called
    if (receipt.toolsCalled && receipt.toolsCalled.length > 0) {
        addRow(body, "Tools", `${receipt.toolsCalled.length} called`);
        for (const tool of receipt.toolsCalled) {
            const toolEl = document.createElement("div");
            toolEl.className = "receipt-tool";
            toolEl.innerHTML = `<strong>${tool.name}</strong>(${JSON.stringify(tool.args)})<br>${tool.result || ""}`;
            body.appendChild(toolEl);
        }
    }

    // Actions performed
    if (receipt.actionsPerformed && receipt.actionsPerformed.length > 0) {
        addRow(body, "Actions", receipt.actionsPerformed.join(" | "));
    }

    details.appendChild(body);
    return details;
}

function addRow(parent, label, value, cls) {
    const row = document.createElement("div");
    row.className = "receipt-row";
    row.innerHTML = `<span class="receipt-label">${label}</span><span class="receipt-value ${cls || ""}">${value}</span>`;
    parent.appendChild(row);
}

function formatMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
}

function setLoading(on) {
    loadingEl.classList.toggle("hidden", !on);
    sendBtn.disabled = on;
    if (!on) input.focus();
}

function scrollToBottom() {
    const chatArea = document.getElementById("chat-area");
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Keyboard: Enter to send
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});
