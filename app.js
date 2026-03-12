/* Fake Claude API — Dashboard Script */
(function () {
  "use strict";

  // ── DOM References ──────────────────────────────────────────────
  const statusEl = document.getElementById("status");
  const statusTextEl = document.getElementById("status-text");
  const baseUrlEl = document.getElementById("base-url");
  const copyBtn = document.getElementById("copy-config");
  const configCode = document.getElementById("config-code");
  const logEl = document.getElementById("log");

  // ── Detect base URL from current page ──────────────────────────
  const baseUrl = window.location.origin;
  baseUrlEl.textContent = baseUrl;

  // ── Health check (ping /v1/messages with bad data to confirm 400) ──
  let online = false;

  async function checkHealth() {
    try {
      const res = await fetch(baseUrl + "/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      // A 400 means the server is alive (it rejected invalid input)
      online = res.status === 400 || res.status === 200;
    } catch {
      online = false;
    }
    updateStatus();
  }

  function updateStatus() {
    if (online) {
      statusEl.className = "status status--online";
      statusTextEl.textContent = "Online";
    } else {
      statusEl.className = "status status--offline";
      statusTextEl.textContent = "Offline";
    }
  }

  // Check immediately and then every 10 seconds
  checkHealth();
  setInterval(checkHealth, 10000);

  // ── Copy config to clipboard ───────────────────────────────────
  copyBtn.addEventListener("click", function () {
    const text = configCode.textContent;
    navigator.clipboard.writeText(text).then(function () {
      copyBtn.textContent = "Copied!";
      setTimeout(function () {
        copyBtn.textContent = "Copy";
      }, 2000);
    });
  });

  // ── Log display ────────────────────────────────────────────────
  const MAX_LOG_ENTRIES = 100;
  let logEntries = [];

  /**
   * Add a log entry to the display.
   * @param {string} text - The log message
   * @param {"request"|"error"|"success"|""} type - Entry type for styling
   */
  function addLogEntry(text, type) {
    if (logEntries.length === 0 && logEl.children.length === 1) {
      // Remove the "Waiting for requests..." placeholder
      logEl.innerHTML = "";
    }

    logEntries.push({ text: text, type: type });
    if (logEntries.length > MAX_LOG_ENTRIES) {
      logEntries.shift();
    }

    var entry = document.createElement("div");
    entry.className = "log__entry" + (type ? " log__entry--" + type : "");
    entry.textContent = text;
    logEl.appendChild(entry);

    // Remove oldest DOM entry if over limit
    while (logEl.children.length > MAX_LOG_ENTRIES) {
      logEl.removeChild(logEl.firstChild);
    }

    // Auto-scroll to bottom
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Expose for potential future use by server-sent events or polling
  window.__fakeClaude = {
    addLogEntry: addLogEntry,
  };
})();