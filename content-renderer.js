/**
 * Content Renderer — renders Anthropic API content blocks into DOM elements.
 *
 * Handles: text (with basic Markdown), tool_use, tool_result, and thinking blocks.
 * Supports incremental (streaming) text updates.
 */
const ContentRenderer = (() => {
  "use strict";

  // ── Markdown-lite parser ────────────────────────────────────────────────
  // Converts a subset of Markdown to HTML. No dependencies.

  function markdownToHtml(text) {
    if (!text) return "";

    const lines = text.split("\n");
    const out = [];
    let inCodeBlock = false;
    let codeLang = "";
    let codeLines = [];
    let inList = null; // "ul" or "ol"

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced code blocks
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          out.push(`<pre><code${codeLang ? ` data-lang="${esc(codeLang)}"` : ""}>${esc(codeLines.join("\n"))}</code></pre>`);
          codeLines = [];
          codeLang = "";
          inCodeBlock = false;
        } else {
          closeList();
          inCodeBlock = true;
          codeLang = line.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Blank line — close list, add spacing
      if (line.trim() === "") {
        closeList();
        continue;
      }

      // Headers
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        out.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        closeList();
        out.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^(\s*)[*\-+]\s+(.+)$/);
      if (ulMatch) {
        if (inList !== "ul") {
          closeList();
          inList = "ul";
          out.push("<ul>");
        }
        out.push(`<li>${inlineMarkdown(ulMatch[2])}</li>`);
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      if (olMatch) {
        if (inList !== "ol") {
          closeList();
          inList = "ol";
          out.push("<ol>");
        }
        out.push(`<li>${inlineMarkdown(olMatch[2])}</li>`);
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(line.trim())) {
        closeList();
        out.push("<hr>");
        continue;
      }

      // Regular paragraph
      closeList();
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }

    // Close any open code block
    if (inCodeBlock) {
      out.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`);
    }

    closeList();
    return out.join("\n");

    function closeList() {
      if (inList) {
        out.push(`</${inList}>`);
        inList = null;
      }
    }
  }

  /** Inline Markdown: bold, italic, code, links */
  function inlineMarkdown(text) {
    let s = esc(text);
    // Code (backtick) — must come first to avoid processing inside code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // Italic
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/_(.+?)_/g, "<em>$1</em>");
    // Links
    s = s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    return s;
  }

  /** Escape HTML special characters */
  function esc(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Block Renderers ─────────────────────────────────────────────────────

  /** Render a text content block */
  function renderTextBlock(block) {
    const el = document.createElement("div");
    el.className = "content-block content-text";
    el.innerHTML = markdownToHtml(block.text);
    return el;
  }

  /** Render a tool_use content block */
  function renderToolUseBlock(block) {
    const el = document.createElement("div");
    el.className = "content-block content-tool-use";

    const header = document.createElement("div");
    header.className = "tool-header";
    header.innerHTML = `
      <span class="tool-icon">⚡</span>
      <span class="tool-name">${esc(block.name)}</span>
      <span class="tool-id">${esc(block.id)}</span>
    `;

    const inputEl = document.createElement("div");
    inputEl.className = "tool-input";
    inputEl.textContent = JSON.stringify(block.input, null, 2);

    // Toggle collapse on click
    header.addEventListener("click", () => {
      inputEl.classList.toggle("collapsed");
    });

    el.appendChild(header);
    el.appendChild(inputEl);
    return el;
  }

  /** Render a tool_result content block */
  function renderToolResultBlock(block) {
    const el = document.createElement("div");
    el.className = "content-block content-tool-result";

    const header = document.createElement("div");
    header.className = `tool-result-header${block.is_error ? " error" : ""}`;
    header.textContent = block.is_error ? "Tool Error" : "Tool Result";

    const content = document.createElement("div");
    content.className = "tool-result-content";

    if (typeof block.content === "string") {
      content.textContent = block.content;
    } else if (Array.isArray(block.content)) {
      content.textContent = block.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    }

    el.appendChild(header);
    el.appendChild(content);
    return el;
  }

  // ── Message Renderers ───────────────────────────────────────────────────

  /**
   * Render a complete message (user or assistant) into a DOM element.
   * @param {Object} message — { role, content }
   * @returns {HTMLElement}
   */
  function renderMessage(message) {
    const wrapper = document.createElement("div");
    wrapper.className = `message message-${message.role}`;

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = message.role;
    wrapper.appendChild(roleLabel);

    const contentArr = normalizeContent(message.content);
    for (const block of contentArr) {
      wrapper.appendChild(renderBlock(block));
    }

    return wrapper;
  }

  /** Render a single content block by type */
  function renderBlock(block) {
    switch (block.type) {
      case "text":
        return renderTextBlock(block);
      case "tool_use":
        return renderToolUseBlock(block);
      case "tool_result":
        return renderToolResultBlock(block);
      default: {
        // Unknown block — render as JSON
        const el = document.createElement("div");
        el.className = "content-block content-text";
        el.innerHTML = `<pre><code>${esc(JSON.stringify(block, null, 2))}</code></pre>`;
        return el;
      }
    }
  }

  /** Normalize content to an array of blocks */
  function normalizeContent(content) {
    if (typeof content === "string") {
      return [{ type: "text", text: content }];
    }
    if (Array.isArray(content)) return content;
    return [];
  }

  // ── Streaming Support ───────────────────────────────────────────────────

  /**
   * Create a streaming message element that can be incrementally updated.
   * Returns an object with update methods.
   */
  function createStreamingMessage() {
    const wrapper = document.createElement("div");
    wrapper.className = "message message-assistant";

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = "assistant";
    wrapper.appendChild(roleLabel);

    // Track content blocks being built
    const blocks = [];
    let currentBlockEl = null;
    let currentText = "";

    return {
      element: wrapper,

      /** Start a new content block */
      startBlock(index, block) {
        if (block.type === "text") {
          currentBlockEl = document.createElement("div");
          currentBlockEl.className = "content-block content-text streaming-cursor";
          currentText = "";
          wrapper.appendChild(currentBlockEl);
          blocks[index] = { type: "text", el: currentBlockEl, text: "" };
        } else if (block.type === "tool_use") {
          const data = { name: block.name, id: block.id, input: {}, partialJson: "" };
          const el = renderToolUseBlock({ ...block, input: {} });
          wrapper.appendChild(el);
          blocks[index] = { type: "tool_use", el, data };
          currentBlockEl = null;
        }
      },

      /** Append a delta to an existing block */
      applyDelta(index, delta) {
        const b = blocks[index];
        if (!b) return;

        if (delta.type === "text_delta" && b.type === "text") {
          b.text += delta.text;
          b.el.innerHTML = markdownToHtml(b.text);
          b.el.classList.add("streaming-cursor");
        } else if (delta.type === "input_json_delta" && b.type === "tool_use") {
          b.data.partialJson += delta.partial_json;
          // Try to parse and update the input display
          try {
            b.data.input = JSON.parse(b.data.partialJson);
            const inputEl = b.el.querySelector(".tool-input");
            if (inputEl) {
              inputEl.textContent = JSON.stringify(b.data.input, null, 2);
            }
          } catch {
            // Partial JSON, show raw
            const inputEl = b.el.querySelector(".tool-input");
            if (inputEl) {
              inputEl.textContent = b.data.partialJson;
            }
          }
        }
      },

      /** Mark a block as complete */
      stopBlock(index) {
        const b = blocks[index];
        if (b && b.type === "text" && b.el) {
          b.el.classList.remove("streaming-cursor");
        }
      },

      /** Finalize the message (remove cursors) */
      finalize() {
        wrapper.querySelectorAll(".streaming-cursor").forEach((el) => {
          el.classList.remove("streaming-cursor");
        });
      },
    };
  }

  /**
   * Render an error message.
   * @param {string} message
   * @returns {HTMLElement}
   */
  function renderError(message) {
    const el = document.createElement("div");
    el.className = "message message-error";
    el.textContent = message;
    return el;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  return {
    renderMessage,
    renderBlock,
    renderError,
    createStreamingMessage,
    markdownToHtml,
  };
})();