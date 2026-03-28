// ── Firebase Auth State ──

const auth = firebase.auth();
let currentUser = null;
let idToken = null;

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
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

// ── Auth Guard ──

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }
    currentUser = user;
    idToken = await user.getIdToken();

    // Show user info
    userEmailEl.textContent = user.email || user.displayName || "User";

    // Refresh token every 50 minutes (tokens expire after 1 hour)
    setInterval(async () => {
        if (currentUser) {
            idToken = await currentUser.getIdToken(true);
        }
    }, 50 * 60 * 1000);

    // Initialize chat
    initChat();
});

// Logout
logoutBtn.addEventListener("click", () => {
    auth.signOut();
});

// ── Authenticated Fetch Helper ──

async function apiFetch(url, options = {}) {
    if (currentUser) {
        idToken = await currentUser.getIdToken();
    }
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
        },
    });
}

// ── Init Chat (called after auth) ──

async function initChat() {
    // Load persisted chat history
    try {
        const res = await apiFetch("/api/chat/history");
        if (res.ok) {
            const data = await res.json();
            if (data.history && data.history.length > 0) {
                // Remove welcome state if we have history
                const welcome = document.getElementById("welcome-state");
                if (welcome) welcome.remove();

                for (const entry of data.history) {
                    appendMessage(entry.role, entry.content, entry.trustReceipt);
                    history.push({ role: entry.role, content: entry.content });
                }
            }
        }
    } catch (err) {
        console.warn("Could not load chat history:", err);
    }

    // Load integrations
    loadIntegrations();
}

// ── Welcome State — Prompt Chips ──

document.querySelectorAll(".prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        const prompt = chip.dataset.prompt;
        input.value = prompt;
        form.dispatchEvent(new Event("submit"));
    });
});

// ── Integrations Panel — Smooth Toggle ──

integrationsToggle.addEventListener("click", () => {
    const isVisible = integrationsPanel.classList.toggle("visible");
    integrationsToggle.classList.toggle("active", isVisible);
    if (isVisible) loadIntegrations();
});

async function loadIntegrations() {
    if (!idToken) return;
    try {
        const res = await apiFetch("/api/integrations");
        const data = await res.json();
        if (data.integrations && data.integrations.length > 0) {
            renderIntegrations(data.integrations);
        } else {
            console.warn("[integrations] Empty response:", data);
            // Render default list as fallback
            renderIntegrations([
                { name: "gmail", label: "Gmail", icon: "\u2709\uFE0F", description: "Draft & send emails, search inbox, read emails", connected: false },
                { name: "google_calendar", label: "Google Calendar", icon: "\uD83D\uDCC5", description: "Schedule meetings, find free time", connected: false },
                { name: "github", label: "GitHub", icon: "\uD83D\uDCBB", description: "Create issues, open PRs, manage repos", connected: false },
                { name: "slack", label: "Slack", icon: "\uD83D\uDCAC", description: "Send messages, search channels", connected: false },
            ]);
        }
    } catch (err) {
        console.error("[integrations] Failed:", err);
        renderIntegrations([
            { name: "gmail", label: "Gmail", icon: "\u2709\uFE0F", description: "Draft & send emails, search inbox, read emails", connected: false },
            { name: "google_calendar", label: "Google Calendar", icon: "\uD83D\uDCC5", description: "Schedule meetings, find free time", connected: false },
            { name: "github", label: "GitHub", icon: "\uD83D\uDCBB", description: "Create issues, open PRs, manage repos", connected: false },
            { name: "slack", label: "Slack", icon: "\uD83D\uDCAC", description: "Send messages, search channels", connected: false },
        ]);
    }
}

function renderIntegrations(integrations) {
    const count = integrations.filter(i => i.connected).length;
    connectedCount.textContent = count;
    connectedCount.classList.toggle("none", count === 0);

    integrationsList.innerHTML = integrations.map(i => `
        <div class="integration-card ${i.connected ? 'connected' : ''}">
            <span class="integration-icon">${i.icon}</span>
            <div class="integration-info">
                <div class="integration-name">${i.label}</div>
                <div class="integration-desc">${i.description}</div>
            </div>
            <button class="integration-btn ${i.connected ? 'disconnect' : 'connect'}"
                    onclick="toggleIntegration('${i.name}', ${i.connected})">
                ${i.connected ? 'Connected' : 'Connect'}
            </button>
        </div>
    `).join("");
}

async function toggleIntegration(name, isConnected) {
    const endpoint = isConnected ? "/api/integrations/disconnect" : "/api/integrations/connect";
    try {
        await apiFetch(endpoint, {
            method: "POST",
            body: JSON.stringify({ integration: name }),
        });
        await loadIntegrations();
    } catch (err) {
        console.error("Integration toggle failed:", err);
    }
}

// ── Chat Form ──

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
        const res = await apiFetch("/api/chat", {
            method: "POST",
            body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
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

// ── Message Rendering ──

function appendMessage(role, content, trustReceipt) {
    // Remove welcome state on first message
    const welcome = document.getElementById("welcome-state");
    if (welcome) welcome.remove();

    const msg = document.createElement("div");
    msg.className = `message ${role}`;

    // Role indicator
    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "You" : "Mneme";
    msg.appendChild(roleLabel);

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

// ── Trust Receipt — Smooth Expandable Card ──

function renderTrustReceipt(receipt) {
    const wrapper = document.createElement("div");
    wrapper.className = "trust-receipt";

    // Summary bar (always visible)
    const summaryBar = document.createElement("div");
    summaryBar.className = "trust-receipt-summary";

    const modelShort = receipt.model ? receipt.model.split('/').pop() : 'unknown';

    summaryBar.innerHTML = `
        <div class="receipt-summary-left">
            <svg class="receipt-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Trust Receipt</span>
        </div>
        <div class="receipt-summary-pills">
            <span class="receipt-pill">${receipt.latencyMs}ms</span>
            <span class="receipt-pill">${modelShort}</span>
            ${receipt.memoryStored ? '<span class="receipt-pill pill-success">Memory stored</span>' : ''}
            ${receipt.toolsCalled && receipt.toolsCalled.length ? `<span class="receipt-pill pill-accent">${receipt.toolsCalled.length} tool${receipt.toolsCalled.length > 1 ? 's' : ''}</span>` : ''}
            ${receipt.memoriesRecalled && receipt.memoriesRecalled.length ? `<span class="receipt-pill pill-accent">${receipt.memoriesRecalled.length} recalled</span>` : ''}
        </div>
    `;

    // Expandable body
    const bodyOuter = document.createElement("div");
    bodyOuter.className = "trust-receipt-collapse";

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

    // Tools called (timeline style)
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
        const actionsRow = document.createElement("div");
        actionsRow.style.marginTop = "6px";
        actionsRow.style.display = "flex";
        actionsRow.style.flexWrap = "wrap";
        actionsRow.style.gap = "4px";
        for (const action of receipt.actionsPerformed) {
            const chip = document.createElement("span");
            chip.className = "receipt-action";
            chip.textContent = action;
            actionsRow.appendChild(chip);
        }
        body.appendChild(actionsRow);
    }

    bodyOuter.appendChild(body);
    wrapper.appendChild(summaryBar);
    wrapper.appendChild(bodyOuter);

    // Click to toggle with smooth height animation
    summaryBar.addEventListener("click", () => {
        const isOpen = wrapper.classList.toggle("open");
        if (isOpen) {
            bodyOuter.style.maxHeight = body.scrollHeight + "px";
        } else {
            bodyOuter.style.maxHeight = "0";
        }
    });

    return wrapper;
}

function addRow(parent, label, value, cls) {
    const row = document.createElement("div");
    row.className = "receipt-row";
    row.innerHTML = `<span class="receipt-label">${label}</span><span class="receipt-value ${cls || ""}">${value}</span>`;
    parent.appendChild(row);
}

// ── Utilities ──

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
    if (on) {
        loadingEl.classList.remove("hidden");
    } else {
        loadingEl.classList.add("hidden");
    }
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
