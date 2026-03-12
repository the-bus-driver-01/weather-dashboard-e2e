/**
 * app.js — Chat UI for the Fake Claude API proxy
 *
 * Sends messages to the local proxy at localhost:4321 using the
 * Anthropic Messages API format and displays streamed responses.
 */

const API_BASE = "http://localhost:4321";
const API_URL = `${API_BASE}/v1/messages`;

// ── DOM refs ────────────────────────────────────────────────────────────────
const chat = document.getElementById("chat");
const form = document.getElementById("input-form");
const input = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const statusDot = document.querySelector(".status-dot");
const statusText = document.querySelector(".status-text");

// ── Conversation state ──────────────────────────────────────────────────────
let messages = [];
let isStreaming = false;

// ── Server health check ─────────────────────────────────────────────────────

async function checkServer() {
  try {
    const res = await fetch(API_BASE, { method: "GET", signal: AbortSignal.timeout(3000) });
    const online = res.ok || res.status === 404; // server is up either way
    setStatus(online);
  } catch {
    setStatus(false);
  }
}

function setStatus(online) {
  statusDot.className = `status-dot ${online ? "status-dot--online" : "status-dot--offline"}`;
  statusText.textContent = online ? "Connected" : "Offline";
}

// Check immediately, then every 10s
checkServer();
setInterval(checkServer, 10_000);

// ── Auto-resize textarea ────────────────────────────────────────────────────

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
});

// Submit on Enter (Shift+Enter for newline)
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ── Send message ────────────────────────────────────────────────────────────

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || isStreaming) return;

  // Clear welcome message on first send
  const welcome = chat.querySelector(".chat__welcome");
  if (welcome) welcome.remove();

  // Show user bubble
  appendMessage("user", text);
  messages.push({ role: "user", content: text });

  // Reset input
  input.value = "";
  input.style.height = "auto";

  await sendToAPI();
});

async function sendToAPI() {
  isStreaming = true;
  sendBtn.disabled = true;

  const thinkingEl = appendMessage("thinking", "Thinking…");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "fake-key",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "sonnet",
        max_tokens: 4096,
        stream: true,
        messages,
      }),
    });

    thinkingEl.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      appendMessage("error", `Error ${res.status}: ${err.error?.message || "Unknown error"}`);
      return;
    }

    // Parse SSE stream
    const assistantText = await readSSEStream(res);

    if (assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
  } catch (err) {
    thinkingEl.remove();
    appendMessage("error", `Connection failed: ${err.message}`);
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// ── SSE stream reader ───────────────────────────────────────────────────────

async function readSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let currentBubble = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const event = JSON.parse(data);
        const eventType = event.type;

        if (eventType === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = event.delta.text;
          fullText += text;

          if (!currentBubble) {
            currentBubble = appendMessage("assistant", text);
          } else {
            currentBubble.textContent = fullText;
          }
          scrollToBottom();
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  // If we got no streamed content, show the full text (non-streaming fallback)
  if (!currentBubble && fullText) {
    appendMessage("assistant", fullText);
  }

  return fullText;
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message message--${role}`;
  el.textContent = text;
  chat.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}