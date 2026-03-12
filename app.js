/**
 * Keyboard Shortcuts — vanilla JS implementation
 *
 * Features:
 *  - Keyboard event handling with modifier support
 *  - Visual feedback (toast + center indicator)
 *  - Undo / Redo for notepad and item list
 *  - Help modal (F1)
 *  - High-contrast toggle
 *  - Accessible focus management
 */

(function () {
  'use strict';

  // ── Shortcut Registry ──

  const shortcuts = [
    { keys: 'F1',              description: 'Show / hide help',       category: 'General',  action: toggleHelp },
    { keys: 'Ctrl+Z',         description: 'Undo',                   category: 'Editing',  action: undo },
    { keys: 'Ctrl+Y',         description: 'Redo',                   category: 'Editing',  action: redo },
    { keys: 'Ctrl+Shift+Z',   description: 'Redo (alt)',             category: 'Editing',  action: redo },
    { keys: 'Ctrl+N',         description: 'New item',               category: 'Items',    action: focusNewItem },
    { keys: 'Delete',         description: 'Delete selected items',  category: 'Items',    action: deleteSelected },
    { keys: 'Ctrl+A',         description: 'Select all items',       category: 'Items',    action: selectAllItems },
    { keys: 'Escape',         description: 'Deselect / close modal', category: 'General',  action: handleEscape },
    { keys: 'Ctrl+Shift+H',   description: 'Toggle high contrast',   category: 'General',  action: toggleContrast },
    { keys: 'ArrowUp',        description: 'Move selection up',      category: 'Items',    action: () => moveSelection(-1) },
    { keys: 'ArrowDown',      description: 'Move selection down',    category: 'Items',    action: () => moveSelection(1) },
  ];

  // ── DOM References ──

  const $ = (sel) => document.querySelector(sel);
  const notepad       = $('#notepad');
  const itemList      = $('#item-list');
  const itemInput     = $('#item-input');
  const btnAddItem    = $('#btn-add-item');
  const btnUndo       = $('#btn-undo');
  const btnRedo       = $('#btn-redo');
  const btnHelp       = $('#btn-help');
  const btnCloseHelp  = $('#btn-close-help');
  const btnContrast   = $('#btn-contrast');
  const helpModal     = $('#help-modal');
  const helpBody      = $('#help-body');
  const toastContainer = $('#toast-container');
  const indicator     = $('#shortcut-indicator');
  const shortcutGrid  = $('#shortcut-grid');

  // ── Undo / Redo State ──

  /** @type {{ notepad: string, items: string[] }[]} */
  let history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 100;
  let lastSnapshotTimer = null;

  function currentState() {
    return {
      notepad: notepad.value,
      items: Array.from(itemList.children).map((li) => li.dataset.value),
    };
  }

  function pushState() {
    // Debounce rapid typing — snapshot after 400ms of inactivity
    clearTimeout(lastSnapshotTimer);
    lastSnapshotTimer = setTimeout(() => {
      const state = currentState();
      // Skip duplicate consecutive states
      if (historyIndex >= 0) {
        const prev = history[historyIndex];
        if (prev.notepad === state.notepad && prev.items.join(',') === state.items.join(',')) return;
      }
      // Truncate any future states
      history = history.slice(0, historyIndex + 1);
      history.push(state);
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length - 1;
      updateUndoRedoButtons();
    }, 400);
  }

  /** Force an immediate snapshot (for discrete actions like add/delete). */
  function pushStateImmediate() {
    clearTimeout(lastSnapshotTimer);
    const state = currentState();
    history = history.slice(0, historyIndex + 1);
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

  function restoreState(state) {
    notepad.value = state.notepad;
    // Rebuild item list
    itemList.innerHTML = '';
    state.items.forEach((val) => addItemToDOM(val));
  }

  function undo() {
    if (historyIndex <= 0) { toast('Nothing to undo'); return; }
    historyIndex--;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
    showIndicator('Undo');
    toast('Undo');
  }

  function redo() {
    if (historyIndex >= history.length - 1) { toast('Nothing to redo'); return; }
    historyIndex++;
    restoreState(history[historyIndex]);
    updateUndoRedoButtons();
    showIndicator('Redo');
    toast('Redo');
  }

  function updateUndoRedoButtons() {
    btnUndo.disabled = historyIndex <= 0;
    btnRedo.disabled = historyIndex >= history.length - 1;
  }

  // ── Item List ──

  let itemCounter = 0;

  function addItemToDOM(text) {
    const li = document.createElement('li');
    li.role = 'option';
    li.setAttribute('aria-selected', 'false');
    li.dataset.value = text;
    li.textContent = text;
    li.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        const sel = li.getAttribute('aria-selected') === 'true';
        li.setAttribute('aria-selected', String(!sel));
      } else {
        // Single select
        deselectAll();
        li.setAttribute('aria-selected', 'true');
      }
    });
    itemList.appendChild(li);
  }

  function addItem() {
    const text = itemInput.value.trim() || `Item ${++itemCounter}`;
    addItemToDOM(text);
    itemInput.value = '';
    pushStateImmediate();
    showIndicator('+ Item');
    toast(`Added "${text}"`);
  }

  function deleteSelected() {
    const selected = itemList.querySelectorAll('[aria-selected="true"]');
    if (!selected.length) { toast('No items selected'); return; }
    selected.forEach((li) => li.remove());
    pushStateImmediate();
    showIndicator('Delete');
    toast(`Deleted ${selected.length} item(s)`);
  }

  function selectAllItems() {
    if (!itemList.children.length) return;
    // Only act when focus is inside the items section (not notepad)
    Array.from(itemList.children).forEach((li) => li.setAttribute('aria-selected', 'true'));
    itemList.focus();
    showIndicator('Select All');
    toast('All items selected');
  }

  function deselectAll() {
    itemList.querySelectorAll('[aria-selected="true"]').forEach((li) => li.setAttribute('aria-selected', 'false'));
  }

  function moveSelection(dir) {
    const items = Array.from(itemList.children);
    if (!items.length) return;
    const current = items.findIndex((li) => li.getAttribute('aria-selected') === 'true');
    deselectAll();
    let next = current + dir;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    items[next].setAttribute('aria-selected', 'true');
    items[next].scrollIntoView({ block: 'nearest' });
  }

  function focusNewItem() {
    itemInput.focus();
    showIndicator('New Item');
    toast('New item — start typing');
  }

  // ── Help Modal ──

  let helpOpen = false;

  function toggleHelp() {
    helpOpen ? closeHelp() : openHelp();
  }

  function openHelp() {
    helpOpen = true;
    helpModal.hidden = false;
    buildHelpTable();
    btnCloseHelp.focus();
    // Trap focus inside modal
    document.addEventListener('keydown', trapFocus);
  }

  function closeHelp() {
    helpOpen = false;
    helpModal.hidden = true;
    document.removeEventListener('keydown', trapFocus);
    btnHelp.focus();
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = helpModal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function buildHelpTable() {
    const categories = {};
    shortcuts.forEach((s) => {
      if (!categories[s.category]) categories[s.category] = [];
      categories[s.category].push(s);
    });

    let html = '';
    for (const [cat, items] of Object.entries(categories)) {
      html += `<table><thead><tr><th colspan="2">${cat}</th></tr></thead><tbody>`;
      items.forEach((s) => {
        const kbds = s.keys.split('+').map((k) => `<kbd>${k}</kbd>`).join(' + ');
        html += `<tr><td>${s.description}</td><td>${kbds}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    helpBody.innerHTML = html;
  }

  function handleEscape() {
    if (helpOpen) { closeHelp(); return; }
    deselectAll();
    toast('Deselected');
  }

  // ── High Contrast ──

  function toggleContrast() {
    document.body.classList.toggle('high-contrast');
    const on = document.body.classList.contains('high-contrast');
    showIndicator(on ? 'High Contrast ON' : 'High Contrast OFF');
    toast(on ? 'High contrast enabled' : 'High contrast disabled');
  }

  // ── Visual Feedback ──

  function toast(message, duration = 2000) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  let indicatorTimer;
  function showIndicator(text) {
    clearTimeout(indicatorTimer);
    indicator.textContent = text;
    indicator.classList.add('visible');
    indicatorTimer = setTimeout(() => indicator.classList.remove('visible'), 600);
  }

  // ── Keyboard Event Handling ──

  /** Parse a key descriptor like "Ctrl+Shift+Z" into a matchable object. */
  function parseKeys(str) {
    const parts = str.split('+');
    return {
      ctrl: parts.includes('Ctrl'),
      shift: parts.includes('Shift'),
      alt: parts.includes('Alt'),
      key: parts.filter((p) => !['Ctrl', 'Shift', 'Alt'].includes(p))[0],
    };
  }

  document.addEventListener('keydown', (e) => {
    // Don't intercept inside the notepad for most shortcuts (allow normal typing)
    const inNotepad = document.activeElement === notepad;

    for (const shortcut of shortcuts) {
      const parsed = parseKeys(shortcut.keys);

      // Match modifier keys — treat Meta (⌘) as Ctrl on Mac
      const ctrlMatch = parsed.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = parsed.alt ? e.altKey : !e.altKey;
      const keyMatch = e.key === parsed.key || e.code === parsed.key || e.key.toLowerCase() === parsed.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        // Special handling: let Ctrl+A/Z/Y work normally inside the textarea
        if (inNotepad && ['Ctrl+A'].includes(shortcut.keys)) continue;
        // Let normal undo/redo pass through in the textarea (browser handles it)
        // but still track state changes
        if (inNotepad && ['Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z'].includes(shortcut.keys)) continue;

        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  });

  // ── Build Quick Reference Grid ──

  function buildQuickReference() {
    shortcuts.forEach((s) => {
      const div = document.createElement('div');
      div.className = 'shortcut-entry';
      const kbds = s.keys.split('+').map((k) => `<kbd>${k}</kbd>`).join('+');
      div.innerHTML = `<span>${s.description}</span><span class="keys">${kbds}</span>`;
      shortcutGrid.appendChild(div);
    });
  }

  // ── Button Bindings ──

  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);
  btnHelp.addEventListener('click', toggleHelp);
  btnCloseHelp.addEventListener('click', closeHelp);
  btnContrast.addEventListener('click', toggleContrast);
  btnAddItem.addEventListener('click', addItem);
  itemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });

  // Close modal on backdrop click
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

  // Track notepad changes for undo history
  notepad.addEventListener('input', pushState);

  // ── Init ──

  function init() {
    // Seed initial state
    pushStateImmediate();
    updateUndoRedoButtons();
    buildQuickReference();

    // Add a few demo items
    ['Learn shortcuts', 'Build something cool', 'Ship it'].forEach((t) => addItemToDOM(t));
    pushStateImmediate();
  }

  init();
})();