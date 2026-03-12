/**
 * Data Persistence Layer
 * Provides a clean API for saving and loading data using localStorage.
 * Supports JSON serialization, namespacing, expiration, and event callbacks.
 */

// ── Storage Configuration ────────────────────────────────────────────────────

const StorageConfig = {
  prefix: 'app_',
  version: 1,
};

// ── Core Storage API ─────────────────────────────────────────────────────────

const Storage = {
  /**
   * Save a value to localStorage.
   * @param {string} key - The storage key
   * @param {*} value - Any JSON-serializable value
   * @param {object} [options] - Optional settings
   * @param {number} [options.ttl] - Time-to-live in milliseconds
   * @returns {boolean} True if saved successfully
   */
  set(key, value, options = {}) {
    try {
      const prefixedKey = StorageConfig.prefix + key;
      const entry = {
        value,
        timestamp: Date.now(),
        version: StorageConfig.version,
      };

      if (options.ttl && options.ttl > 0) {
        entry.expires = Date.now() + options.ttl;
      }

      localStorage.setItem(prefixedKey, JSON.stringify(entry));
      this._notify('set', key, value);
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to save "${key}":`, e.message);
      return false;
    }
  },

  /**
   * Retrieve a value from localStorage.
   * @param {string} key - The storage key
   * @param {*} [defaultValue=null] - Value to return if key is not found or expired
   * @returns {*} The stored value or defaultValue
   */
  get(key, defaultValue = null) {
    try {
      const prefixedKey = StorageConfig.prefix + key;
      const raw = localStorage.getItem(prefixedKey);
      if (raw === null) return defaultValue;

      const entry = JSON.parse(raw);

      // Check expiration
      if (entry.expires && Date.now() > entry.expires) {
        this.remove(key);
        return defaultValue;
      }

      return entry.value !== undefined ? entry.value : defaultValue;
    } catch (e) {
      console.warn(`[Storage] Failed to read "${key}":`, e.message);
      return defaultValue;
    }
  },

  /**
   * Remove a value from localStorage.
   * @param {string} key - The storage key
   * @returns {boolean} True if removed successfully
   */
  remove(key) {
    try {
      const prefixedKey = StorageConfig.prefix + key;
      localStorage.removeItem(prefixedKey);
      this._notify('remove', key, null);
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to remove "${key}":`, e.message);
      return false;
    }
  },

  /**
   * Check if a key exists and is not expired.
   * @param {string} key - The storage key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key, undefined) !== undefined;
  },

  /**
   * Get all keys managed by this storage layer.
   * @returns {string[]} Array of unprefixed keys
   */
  keys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(StorageConfig.prefix)) {
        result.push(fullKey.slice(StorageConfig.prefix.length));
      }
    }
    return result;
  },

  /**
   * Get all stored entries as a plain object.
   * @returns {object} Key-value pairs of all stored data
   */
  getAll() {
    const data = {};
    for (const key of this.keys()) {
      const value = this.get(key);
      if (value !== null) {
        data[key] = value;
      }
    }
    return data;
  },

  /**
   * Clear all data managed by this storage layer.
   * Other localStorage entries are not affected.
   * @returns {number} Number of entries removed
   */
  clear() {
    const keys = this.keys();
    let count = 0;
    for (const key of keys) {
      if (this.remove(key)) count++;
    }
    this._notify('clear', null, null);
    return count;
  },

  // ── Collection helpers ───────────────────────────────────────────────────

  /**
   * Push an item onto an array stored at key.
   * Creates the array if it doesn't exist.
   * @param {string} key - The storage key
   * @param {*} item - Item to append
   * @returns {number} New array length
   */
  push(key, item) {
    const arr = this.get(key, []);
    if (!Array.isArray(arr)) {
      console.warn(`[Storage] "${key}" is not an array`);
      return -1;
    }
    arr.push(item);
    this.set(key, arr);
    return arr.length;
  },

  /**
   * Update a stored object by merging in new properties.
   * @param {string} key - The storage key
   * @param {object} updates - Properties to merge
   * @returns {object} The updated object
   */
  update(key, updates) {
    const obj = this.get(key, {});
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      console.warn(`[Storage] "${key}" is not a plain object`);
      return obj;
    }
    const merged = { ...obj, ...updates };
    this.set(key, merged);
    return merged;
  },

  // ── Change listeners ─────────────────────────────────────────────────────

  _listeners: [],

  /**
   * Register a callback for storage changes.
   * @param {function} callback - Called with (action, key, value)
   * @returns {function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((cb) => cb !== callback);
    };
  },

  /**
   * Notify all listeners of a storage change.
   * @private
   */
  _notify(action, key, value) {
    for (const cb of this._listeners) {
      try {
        cb(action, key, value);
      } catch (e) {
        console.warn('[Storage] Listener error:', e.message);
      }
    }
  },

  // ── Utilities ────────────────────────────────────────────────────────────

  /**
   * Get the approximate size of stored data in bytes.
   * @returns {number} Size in bytes
   */
  size() {
    let total = 0;
    for (const key of this.keys()) {
      const prefixedKey = StorageConfig.prefix + key;
      const value = localStorage.getItem(prefixedKey);
      if (value) {
        total += prefixedKey.length + value.length;
      }
    }
    return total * 2; // UTF-16 characters = 2 bytes each
  },

  /**
   * Export all data as a JSON string (for backup).
   * @returns {string} JSON string of all stored data
   */
  export() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  /**
   * Import data from a JSON string (for restore).
   * @param {string} json - JSON string to import
   * @param {boolean} [merge=false] - If true, merge with existing data; if false, replace
   * @returns {number} Number of entries imported
   */
  import(json, merge = false) {
    try {
      const data = JSON.parse(json);
      if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid data format');
      }

      if (!merge) {
        this.clear();
      }

      let count = 0;
      for (const [key, value] of Object.entries(data)) {
        if (this.set(key, value)) count++;
      }
      return count;
    } catch (e) {
      console.warn('[Storage] Import failed:', e.message);
      return 0;
    }
  },

  /**
   * Check if localStorage is available.
   * @returns {boolean}
   */
  isAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },
};