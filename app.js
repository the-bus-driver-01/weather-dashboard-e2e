/**
 * Theme Switcher
 * Supports light, dark, and system (auto) themes with localStorage persistence.
 */
'use strict';

const STORAGE_KEY = 'theme-preference';

/** Resolve effective theme from a preference ('light', 'dark', or 'system'). */
function resolveTheme(preference) {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/** Apply a theme preference to the document and update button states. */
function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', resolved);

  // Update active button
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === preference);
  });
}

/** Save preference and apply it. */
function setTheme(preference) {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}

/** Read stored preference, defaulting to 'system'. */
function getStoredPreference() {
  return localStorage.getItem(STORAGE_KEY) || 'system';
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved preference immediately
  applyTheme(getStoredPreference());

  // Bind click handlers
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  // React to OS theme changes when in system mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredPreference() === 'system') {
      applyTheme('system');
    }
  });
});