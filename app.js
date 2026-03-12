/**
 * Chat application — sends messages to the local Fake Claude API
 * and renders responses using ContentRenderer.
 */
(() => {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────
  const API_BASE = window.location.origin;
  const MODEL = "claude-sonnet-4-20250514";

  // ── DOM refs ──────────────────────────────────────────────────────────
  const messagesEl = document.getElementById("messages");
  const emptyState = document.getElementById("empty-state");
  const inputForm = document.getElementById("input-form");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const clearBtn = document.getElementById("clear-btn");
  const streamToggle = document.getElementById("stream-toggle");
  const statusEl = document.getElementById("status");
  const usageEl = document.getElementById("usage");

  // ── State ─────────────────────────────────────────────────────────────
  /** @type {Array<{role: string, content: string|Array}>} */
  let conversationHistory = [];
  let isLoading = false;

  // ── Auto-resize textarea ──────────────────────────────────────────────
  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 200) + "px";
  });

  // Submit on Enter (Shift+Enter for newline)
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      inputForm.dispatchEvent(new Event("submit"));
    }
  });

  // ── Clear button ──────────────────────────────────────────────────────
  clearBtn.addEventListener("click", () => {
    conversationHistory = [];
    messagesEl.innerHTML = "";
    messagesEl.appendChild(emptyState);
    emptyState.style.display = "";
    usageEl.textContent = "";
    setStatus("Ready");
  });

  // ── Form submission ───────────────────────────────────────────────────
  inputForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text || isLoading) return;

    // Hide empty state
    emptyState.style.display = "none";

    // Add user message
    const userMsg = { role: "user", content: text };
    conversationHistory.push(userMsg);
    messagesEl.appendChild(ContentRenderer.renderMessage(userMsg));

    // Clear input
    userInput.value = "";
    userInput.style.height = "auto";
    scrollToBottom();

    // Send request
    const useStreaming = streamToggle.checked;
    setLoading(true);

    try {
      if (useStreaming) {
        await sendStreaming();
      } else {
        await sendNonStreaming();
      }
    } catch (err) {
      messagesEl.appendChild(ContentRenderer.renderError(err.message));
      setStatus("Error");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  });

  // ── Non-streaming request ─────────────────────────────────────────────
  async function sendNonStreaming() {
    setStatus("Waiting for response…");

    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "fake-key",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: conversationHistory,
        stream: false,
      }),
    });

    const data = await res.json();

    if (data.type === "error") {
      throw new Error(data.error?.message || "API error");
    }

    // Add assistant response to history
    conversationHistory.push({ role: "assistant", content: data.content });

    // Render the message
    const msgEl = ContentRenderer.renderMessage({
      role: "assistant",
      content: data.content,
    });
    messagesEl.appendChild(msgEl);

    // Update usage
    if (data.usage) {
      usageEl.textContent = `in: ${data.usage.input_tokens} / out: ${data.usage.output_tokens}`;
    }

    setStatus("Ready");
  }

  // ── Streaming request (SSE) ───────────────────────────────────────────
  async function sendStreaming() {
    setStatus("Streaming…");

    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "fake-key",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: conversationHistory,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error?.message || `HTTP ${res.status}`);
    }

    const streamingMsg = ContentRenderer.createStreamingMessage();
    messagesEl.appendChild(streamingMsg.element);

    // Parse SSE from response body
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last partial line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            handleSSEEvent(event, streamingMsg, fullContent);
          } catch {
            // Skip malformed JSON
          }
        }
      }

      scrollToBottom();
    }

    // Process any remaining buffer
    if (buffer.startsWith("data: ")) {
      try {
        const event = JSON.parse(buffer.slice(6));
        handleSSEEvent(event, streamingMsg, fullContent);
      } catch {
        // Skip
      }
    }

    streamingMsg.finalize();

    // Add to conversation history
    if (fullContent.length > 0) {
      conversationHistory.push({ role: "assistant", content: fullContent });
    }

    setStatus("Ready");
  }

  /**
   * Handle a single SSE event from the streaming response.
   */
  function handleSSEEvent(event, streamingMsg, fullContent) {
    switch (event.type) {
      case "content_block_start":
        streamingMsg.startBlock(event.index, event.content_block);
        // Track content for history
        if (event.content_block.type === "text") {
          fullContent[event.index] = { type: "text", text: "" };
        } else if (event.content_block.type === "tool_use") {
          fullContent[event.index] = {
            type: "tool_use",
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          };
        }
        break;

      case "content_block_delta":
        streamingMsg.applyDelta(event.index, event.delta);
        // Update tracked content
        if (event.delta.type === "text_delta" && fullContent[event.index]) {
          fullContent[event.index].text += event.delta.text;
        }
        break;

      case "content_block_stop":
        streamingMsg.stopBlock(event.index);
        break;

      case "message_delta":
        if (event.usage) {
          usageEl.textContent = `out: ${event.usage.output_tokens}`;
        }
        break;

      case "message_start":
        if (event.message?.usage) {
          usageEl.textContent = `in: ${event.message.usage.input_tokens}`;
        }
        break;

      // ping, message_stop — no action needed
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function setLoading(loading) {
    isLoading = loading;
    sendBtn.disabled = loading;
    userInput.disabled = loading;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
})();