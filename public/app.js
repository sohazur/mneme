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
const integrationsToggle = document.getElementById("integrations-toggle");
const integrationsPanel = document.getElementById("integrations-panel");
const integrationsList = document.getElementById("integrations-list");
const connectedCount = document.getElementById("connected-count");

// ── Integrations Panel ──

integrationsToggle.addEventListener("click", () => {
    const isHidden = integrationsPanel.classList.toggle("hidden");
    integrationsToggle.classList.toggle("active", !isHidden);
    if (!isHidden) loadIntegrations();
});

async function loadIntegrations() {
    try {
        const res = await fetch(`/api/integrations/${chatId}`);
        const data = await res.json();
        renderIntegrations(data.integrations);
    } catch (err) {
        integrationsList.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;">Failed to load integrations</div>';
    }
}

function renderIntegrations(integrations) {
    const count = integrations.filter(i => i.connected).length;
    connectedCount.textContent = count;
    connectedCount.classList.toggle("none", count === 0);

    integrationsList.innerHTML = integrations.map(i => `
        <div class="integration-card ${i.connected ? 'connected' : ''}" id="card-${i.name}">
            <span class="integration-icon">${i.icon}</span>
            <div class="integration-info">
                <div class="integration-name">${i.label}</div>
                <div class="integration-desc">${i.description}</div>
            </div>
            ${i.connected
                ? `<button class="integration-btn disconnect"
                        onclick="disconnectIntegration('${i.name}')">Connected</button>`
                : `<button class="integration-btn connect" id="btn-${i.name}"
                        onclick="startOAuthFlow('${i.name}', '${i.label}')">Connect</button>`
            }
        </div>
    `).join("");
}

// OAuth flow labels for One
const OAUTH_LABELS = {
    gmail: "Google",
    google_calendar: "Google",
    github: "GitHub",
    slack: "Slack",
};

async function startOAuthFlow(name, label) {
    const btn = document.getElementById(`btn-${name}`);
    const card = document.getElementById(`card-${name}`);
    if (!btn || !card) return;

    // Phase 1: Show "Connecting..." with spinner
    btn.disabled = true;
    btn.classList.remove("connect");
    btn.classList.add("connecting");
    btn.innerHTML = '<span class="btn-spinner"></span>Connecting...';
    card.classList.add("connecting");

    // Phase 2: Open One's OAuth in a popup
    const provider = OAUTH_LABELS[name] || label;
    const popup = window.open(
        `https://app.withone.ai/connections`,
        `one-oauth-${name}`,
        "width=500,height=700,left=200,top=100"
    );

    // Phase 3: Call backend to register the connection via One's API
    try {
        const res = await fetch("/api/integrations/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, integration: name }),
        });
        const data = await res.json();

        if (data.connected) {
            // Show success briefly
            btn.innerHTML = 'Authorized!';
            btn.classList.remove("connecting");
            btn.classList.add("authorized");
            card.classList.remove("connecting");
            card.classList.add("connected");

            // Close popup after short delay if still open
            setTimeout(() => {
                if (popup && !popup.closed) popup.close();
            }, 2000);

            // Refresh the panel
            setTimeout(() => loadIntegrations(), 1500);
        }
    } catch (err) {
        btn.innerHTML = 'Failed - Retry';
        btn.classList.remove("connecting");
        btn.classList.add("connect");
        btn.disabled = false;
        card.classList.remove("connecting");
        console.error("OAuth flow failed:", err);
    }
}

async function disconnectIntegration(name) {
    try {
        await fetch("/api/integrations/disconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, integration: name }),
        });
        await loadIntegrations();
    } catch (err) {
        console.error("Disconnect failed:", err);
    }
}

// Load integrations on startup to show count
loadIntegrations();

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
