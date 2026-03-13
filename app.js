/**
 * Data Export Tool — vanilla JS application
 * Provides data entry, table display, and export in CSV, JSON, TSV, and XML formats.
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let data = [];
let currentExport = { content: '', filename: '', mimeType: '' };

// ── DOM References ─────────────────────────────────────────────────────────
const form = document.getElementById('data-form');
const tableBody = document.getElementById('table-body');
const emptyMessage = document.getElementById('empty-message');
const previewSection = document.getElementById('preview-section');
const previewContent = document.getElementById('preview-content');
const btnClear = document.getElementById('btn-clear');
const btnLoadSample = document.getElementById('btn-load-sample');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const btnClosePreview = document.getElementById('btn-close-preview');
const toast = document.getElementById('toast');

// ── Sample Data ────────────────────────────────────────────────────────────
const SAMPLE_DATA = [
  { name: 'Alice Johnson', email: 'alice@example.com', role: 'Engineer' },
  { name: 'Bob Smith', email: 'bob@example.com', role: 'Designer' },
  { name: 'Carol Williams', email: 'carol@example.com', role: 'Product Manager' },
  { name: 'David Brown', email: 'david@example.com', role: 'QA Lead' },
  { name: 'Eva Martinez', email: 'eva@example.com', role: 'DevOps' },
];

// ── Toast Notifications ────────────────────────────────────────────────────
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2500);
}

// ── Table Rendering ────────────────────────────────────────────────────────
function renderTable() {
  tableBody.innerHTML = '';
  emptyMessage.hidden = data.length > 0;
  document.getElementById('data-table').querySelector('thead').hidden = data.length === 0;

  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.email)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td><button class="btn-delete" data-index="${index}" title="Remove entry">Remove</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

/** Prevent XSS in table cell values */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Data Entry ─────────────────────────────────────────────────────────────
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = document.getElementById('field-name').value.trim();
  const email = document.getElementById('field-email').value.trim();
  const role = document.getElementById('field-role').value.trim();

  if (!name || !email) return;

  data.push({ name, email, role: role || '—' });
  renderTable();
  form.reset();
  document.getElementById('field-name').focus();
  showToast('Entry added');
});

// ── Table Actions ──────────────────────────────────────────────────────────

// Delete row via event delegation
tableBody.addEventListener('click', (e) => {
  if (!e.target.classList.contains('btn-delete')) return;
  const index = parseInt(e.target.dataset.index, 10);
  data.splice(index, 1);
  renderTable();
  showToast('Entry removed');
});

btnClear.addEventListener('click', () => {
  if (data.length === 0) return;
  if (!confirm('Clear all data?')) return;
  data = [];
  renderTable();
  hidePreview();
  showToast('All data cleared');
});

btnLoadSample.addEventListener('click', () => {
  data = SAMPLE_DATA.map((d) => ({ ...d }));
  renderTable();
  showToast('Sample data loaded');
});

// ── Export Formatters ──────────────────────────────────────────────────────

/** Escape a value for CSV (wrap in quotes if it contains comma, quote, or newline) */
function csvEscape(value) {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportCSV(rows) {
  const headers = ['Name', 'Email', 'Role'];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push([csvEscape(r.name), csvEscape(r.email), csvEscape(r.role)].join(','));
  });
  return lines.join('\n');
}

function exportTSV(rows) {
  const headers = ['Name', 'Email', 'Role'];
  const lines = [headers.join('\t')];
  rows.forEach((r) => {
    lines.push([r.name, r.email, r.role].join('\t'));
  });
  return lines.join('\n');
}

function exportJSON(rows) {
  return JSON.stringify(rows, null, 2);
}

function exportXML(rows) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<records>\n';
  rows.forEach((r) => {
    xml += '  <record>\n';
    xml += `    <name>${escapeXml(r.name)}</name>\n`;
    xml += `    <email>${escapeXml(r.email)}</email>\n`;
    xml += `    <role>${escapeXml(r.role)}</role>\n`;
    xml += '  </record>\n';
  });
  xml += '</records>';
  return xml;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format config: mime type and file extension
const FORMAT_CONFIG = {
  csv:  { mime: 'text/csv',               ext: 'csv' },
  json: { mime: 'application/json',       ext: 'json' },
  tsv:  { mime: 'text/tab-separated-values', ext: 'tsv' },
  xml:  { mime: 'application/xml',        ext: 'xml' },
};

const FORMAT_FN = {
  csv: exportCSV,
  json: exportJSON,
  tsv: exportTSV,
  xml: exportXML,
};

// ── Export Trigger ──────────────────────────────────────────────────────────
document.querySelectorAll('.btn-export').forEach((btn) => {
  btn.addEventListener('click', () => {
    const format = btn.dataset.format;
    if (data.length === 0) {
      showToast('No data to export. Add some entries first.');
      return;
    }
    doExport(format);
  });
});

function doExport(format) {
  const fn = FORMAT_FN[format];
  const config = FORMAT_CONFIG[format];
  if (!fn || !config) return;

  const content = fn(data);
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `data-export-${timestamp}.${config.ext}`;

  currentExport = { content, filename, mimeType: config.mime };

  // Show preview
  previewContent.textContent = content;
  previewSection.hidden = false;
  previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  showToast(`${format.toUpperCase()} export ready`);
}

// ── Preview Actions ────────────────────────────────────────────────────────
btnCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(currentExport.content).then(() => {
    showToast('Copied to clipboard');
  }).catch(() => {
    // Fallback for older browsers
    fallbackCopy(currentExport.content);
  });
});

/** Fallback copy using a temporary textarea */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Copied to clipboard');
  } catch {
    showToast('Copy failed — please copy manually');
  }
  document.body.removeChild(ta);
}

btnDownload.addEventListener('click', () => {
  if (!currentExport.content) return;
  downloadFile(currentExport.content, currentExport.filename, currentExport.mimeType);
});

/** Trigger a file download via Blob URL */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename}`);
}

function hidePreview() {
  previewSection.hidden = true;
  currentExport = { content: '', filename: '', mimeType: '' };
}

btnClosePreview.addEventListener('click', hidePreview);

// ── Initialize ─────────────────────────────────────────────────────────────
renderTable();