/**
 * App — Demo UI for the data persistence layer.
 * Connects the Storage API to the DOM.
 */

// ── DOM References ───────────────────────────────────────────────────────────

const saveForm = document.getElementById('save-form');
const keyInput = document.getElementById('key-input');
const valueInput = document.getElementById('value-input');
const ttlInput = document.getElementById('ttl-input');
const dataBody = document.getElementById('data-body');
const emptyMsg = document.getElementById('empty-msg');
const refreshBtn = document.getElementById('refresh-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const activityLog = document.getElementById('activity-log');
const storageStatus = document.getElementById('storage-status');
const storageSize = document.getElementById('storage-size');
const entryCount = document.getElementById('entry-count');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a user-entered value as JSON, falling back to a plain string. */
function parseValue(str) {
  const trimmed = str.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/** Format a value for display in the table. */
function formatValue(val) {
  if (typeof val === 'string') return `"${val}"`;
  return JSON.stringify(val);
}

/** Format a timestamp as a relative time string. */
function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── UI Updates ───────────────────────────────────────────────────────────────

/** Refresh the status bar. */
function updateStatus() {
  const available = Storage.isAvailable();
  storageStatus.textContent = available ? 'localStorage: available' : 'localStorage: unavailable';
  storageSize.textContent = `Size: ${(Storage.size() / 1024).toFixed(1)} KB`;
  entryCount.textContent = `Entries: ${Storage.keys().length}`;
}

/** Render the data table from current storage contents. */
function renderTable() {
  dataBody.innerHTML = '';
  const keys = Storage.keys().sort();

  if (keys.length === 0) {
    emptyMsg.style.display = 'block';
    document.getElementById('data-table').style.display = 'none';
    updateStatus();
    return;
  }

  emptyMsg.style.display = 'none';
  document.getElementById('data-table').style.display = 'table';

  for (const key of keys) {
    // Read raw entry to get timestamp
    const raw = localStorage.getItem(Storage._prefix() + key);
    let timestamp = null;
    try {
      const entry = JSON.parse(raw);
      timestamp = entry.timestamp;
    } catch { /* ignore */ }

    const value = Storage.get(key);
    if (value === null && !Storage.has(key)) continue;

    const tr = document.createElement('tr');

    // Key cell
    const tdKey = document.createElement('td');
    tdKey.textContent = key;
    tr.appendChild(tdKey);

    // Value cell
    const tdVal = document.createElement('td');
    tdVal.className = 'value-cell';
    tdVal.textContent = formatValue(value);
    tdVal.title = JSON.stringify(value, null, 2);
    tr.appendChild(tdVal);

    // Time cell
    const tdTime = document.createElement('td');
    tdTime.className = 'time-cell';
    tdTime.textContent = timestamp ? timeAgo(timestamp) : '—';
    tr.appendChild(tdTime);

    // Actions cell
    const tdActions = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      keyInput.value = key;
      valueInput.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      keyInput.focus();
    });
    tdActions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-small';
    delBtn.textContent = 'Delete';
    delBtn.style.marginLeft = '0.25rem';
    delBtn.addEventListener('click', () => {
      Storage.remove(key);
      renderTable();
    });
    tdActions.appendChild(delBtn);

    tr.appendChild(tdActions);
    dataBody.appendChild(tr);
  }

  updateStatus();
}

/** Add an entry to the activity log. */
function logActivity(action, key, value) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  let text = `[${time}] `;

  if (action === 'set') {
    li.className = 'action-set';
    text += `SET "${key}" = ${formatValue(value)}`;
  } else if (action === 'remove') {
    li.className = 'action-remove';
    text += `REMOVE "${key}"`;
  } else if (action === 'clear') {
    li.className = 'action-clear';
    text += 'CLEAR ALL';
  }

  li.textContent = text;
  activityLog.insertBefore(li, activityLog.firstChild);

  // Keep log to 50 entries
  while (activityLog.children.length > 50) {
    activityLog.removeChild(activityLog.lastChild);
  }
}

// ── Expose internal prefix for raw access in renderTable ─────────────────────

Storage._prefix = () => StorageConfig.prefix;

// ── Event Handlers ───────────────────────────────────────────────────────────

// Save form submission
saveForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const key = keyInput.value.trim();
  if (!key) return;

  const value = parseValue(valueInput.value);
  const ttlSeconds = parseInt(ttlInput.value, 10) || 0;
  const options = ttlSeconds > 0 ? { ttl: ttlSeconds * 1000 } : {};

  Storage.set(key, value, options);
  renderTable();

  // Reset form
  keyInput.value = '';
  valueInput.value = '';
  ttlInput.value = '0';
  keyInput.focus();
});

// Refresh button
refreshBtn.addEventListener('click', renderTable);

// Clear all button
clearBtn.addEventListener('click', () => {
  if (confirm('Remove all stored data?')) {
    Storage.clear();
    renderTable();
  }
});

// Export button
exportBtn.addEventListener('click', () => {
  const json = Storage.export();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'storage-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

// Import button
importBtn.addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const count = Storage.import(reader.result, true);
    alert(`Imported ${count} entries.`);
    renderTable();
  };
  reader.readAsText(file);
  importFile.value = '';
});

// Listen for storage changes to update the activity log
Storage.onChange(logActivity);

// ── Init ─────────────────────────────────────────────────────────────────────

renderTable();