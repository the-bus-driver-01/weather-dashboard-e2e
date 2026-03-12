/**
 * Fake Claude API — Dashboard Client
 *
 * Sends requests to the Fake Claude API proxy and displays responses.
 * Works standalone — open index.html and point at the running server.
 */

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  entries: [],
  nextId: 1,
  sending: false,
};

// ── DOM References ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const statusDot = $('#statusDot');
const statusText = $('#statusText');
const serverUrlInput = $('#serverUrl');
const form = $('#requestForm');
const sendBtn = $('#sendBtn');
const clearBtn = $('#clearBtn');
const logEntries = $('#logEntries');
const logEmpty = $('#logEmpty');
const logCount = $('#logCount');
const modelSelect = $('#model');
const maxTokensInput = $('#maxTokens');
const streamToggle = $('#streamToggle');
const systemPromptInput = $('#systemPrompt');
const userMessageInput = $('#userMessage');

// ── API Base URL ─────────────────────────────────────────────────────────────

/** Get the server URL from the input field */
function getBaseUrl() {
  return serverUrlInput.value.replace(/\/+$/, '');
}

// ── Server Health Check ──────────────────────────────────────────────────────

async function checkServerStatus() {
  const base = getBaseUrl();

  try {
    const res = await fetch(`${base}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'fake-key',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    if (res.ok) {
      statusDot.className = 'status-dot status-dot--online';
      statusText.textContent = 'Online';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    statusDot.className = 'status-dot status-dot--offline';
    statusText.textContent = 'Offline';
  }
}

// ── Request Sending ──────────────────────────────────────────────────────────

/** Build the request body from form inputs */
function buildRequestBody() {
  const body = {
    model: modelSelect.value,
    max_tokens: parseInt(maxTokensInput.value, 10) || 1024,
    messages: [{ role: 'user', content: userMessageInput.value.trim() }],
  };

  if (streamToggle.checked) {
    body.stream = true;
  }

  const system = systemPromptInput.value.trim();
  if (system) {
    body.system = system;
  }

  return body;
}

/** Send a non-streaming request */
async function sendNonStreaming(body) {
  const res = await fetch(`${getBaseUrl()}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'fake-key',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

/** Send a streaming request, updating the log entry live */
async function sendStreaming(body, entryId) {
  const res = await fetch(`${getBaseUrl()}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'fake-key',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let messageData = null;
  const contentBlocks = [];
  let stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }

      switch (event.type) {
        case 'message_start':
          messageData = event.message;
          break;

        case 'content_block_start':
          contentBlocks[event.index] = { ...event.content_block };
          if (event.content_block.type === 'text') {
            contentBlocks[event.index].text = '';
          }
          break;

        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            contentBlocks[event.index].text += event.delta.text;
            updateEntryContent(entryId, contentBlocks);
          } else if (event.delta.type === 'input_json_delta') {
            if (!contentBlocks[event.index]._rawJson) {
              contentBlocks[event.index]._rawJson = '';
            }
            contentBlocks[event.index]._rawJson += event.delta.partial_json;
          }
          break;

        case 'content_block_stop':
          if (contentBlocks[event.index]?._rawJson) {
            try {
              contentBlocks[event.index].input = JSON.parse(contentBlocks[event.index]._rawJson);
            } catch { /* keep empty input */ }
            delete contentBlocks[event.index]._rawJson;
          }
          break;

        case 'message_delta':
          stopReason = event.delta?.stop_reason || null;
          break;
      }
    }
  }

  return {
    id: messageData?.id || `msg_stream_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: contentBlocks,
    model: messageData?.model || body.model,
    stop_reason: stopReason || 'end_turn',
    stop_sequence: null,
    usage: messageData?.usage || { input_tokens: 0, output_tokens: 0 },
  };
}

/** Handle form submission */
async function handleSubmit(e) {
  e.preventDefault();
  if (state.sending) return;

  const message = userMessageInput.value.trim();
  if (!message) return;

  state.sending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  const body = buildRequestBody();
  const streaming = !!body.stream;
  const entryId = state.nextId++;
  const startTime = performance.now();

  const entry = {
    id: entryId,
    timestamp: new Date(),
    request: body,
    response: null,
    error: null,
    duration: 0,
    streaming,
  };
  state.entries.unshift(entry);
  renderEntries();

  try {
    const response = streaming
      ? await sendStreaming(body, entryId)
      : await sendNonStreaming(body);

    entry.response = response;
    entry.duration = Math.round(performance.now() - startTime);
  } catch (err) {
    entry.error = err.message;
    entry.duration = Math.round(performance.now() - startTime);
  }

  state.sending = false;
  sendBtn.disabled = false;
  sendBtn.textContent = 'Send';
  renderEntries();
}

// ── Rendering ────────────────────────────────────────────────────────────────

/** Extract display text from response content blocks */
function extractResponseText(content) {
  if (!Array.isArray(content)) return String(content);

  return content.map((block) => {
    if (block.type === 'text') return block.text;
    if (block.type === 'tool_use') {
      return `[Tool: ${block.name}]\n${JSON.stringify(block.input, null, 2)}`;
    }
    return JSON.stringify(block);
  }).join('\n\n');
}

/** Format timestamp as HH:MM:SS */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

/** Escape HTML to prevent XSS */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Live-update a streaming entry's response content */
function updateEntryContent(entryId, contentBlocks) {
  const el = document.querySelector(`[data-entry-id="${entryId}"] .log-entry__response`);
  if (el) {
    el.textContent = extractResponseText(contentBlocks);
  }
}

/** Create a DOM element for a log entry */
function createEntryElement(entry) {
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.dataset.entryId = entry.id;

  let badgeClass = 'log-entry__badge';
  let badgeText = '';
  if (entry.error) {
    badgeClass += ' log-entry__badge--error';
    badgeText = 'Error';
  } else if (entry.response) {
    badgeClass += ' log-entry__badge--success';
    badgeText = entry.streaming ? 'Streamed' : 'OK';
  } else {
    badgeClass += ' log-entry__badge--streaming';
    badgeText = 'Pending...';
  }

  const responseText = entry.error
    ? entry.error
    : entry.response
      ? extractResponseText(entry.response.content)
      : 'Waiting for response...';

  const usage = entry.response?.usage;
  const usageText = usage
    ? `in: ${usage.input_tokens} tok | out: ${usage.output_tokens} tok`
    : '';

  div.innerHTML = `
    <div class="log-entry__header">
      <span>${formatTime(entry.timestamp)} &mdash; ${escapeHtml(entry.request.model)}</span>
      <span class="${badgeClass}">${badgeText}</span>
    </div>
    <div class="log-entry__body">
      <div class="log-entry__section">
        <div class="log-entry__label">Prompt</div>
        <div class="log-entry__content">${escapeHtml(entry.request.messages[0].content)}</div>
      </div>
      <div class="log-entry__section">
        <div class="log-entry__label">Response</div>
        <div class="log-entry__content log-entry__response">${escapeHtml(responseText)}</div>
      </div>
      ${entry.duration || usageText ? `
      <div class="log-entry__meta">
        ${entry.duration ? `<span>${entry.duration}ms</span>` : ''}
        ${usageText ? `<span>${usageText}</span>` : ''}
        ${entry.response?.stop_reason ? `<span>stop: ${escapeHtml(entry.response.stop_reason)}</span>` : ''}
      </div>` : ''}
    </div>
  `;

  return div;
}

/** Re-render all log entries */
function renderEntries() {
  logCount.textContent = state.entries.length;

  if (state.entries.length === 0) {
    logEmpty.style.display = '';
    logEntries.querySelectorAll('.log-entry').forEach((el) => el.remove());
    return;
  }

  logEmpty.style.display = 'none';
  logEntries.querySelectorAll('.log-entry').forEach((el) => el.remove());

  for (const entry of state.entries) {
    logEntries.appendChild(createEntryElement(entry));
  }
}

// ── Event Listeners ──────────────────────────────────────────────────────────

form.addEventListener('submit', handleSubmit);

clearBtn.addEventListener('click', () => {
  state.entries = [];
  renderEntries();
});

// Ctrl+Enter / Cmd+Enter to submit from textarea
userMessageInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    form.requestSubmit();
  }
});

// Re-check status when server URL changes
serverUrlInput.addEventListener('change', checkServerStatus);

// ── Init ─────────────────────────────────────────────────────────────────────

checkServerStatus();
setInterval(checkServerStatus, 30_000);