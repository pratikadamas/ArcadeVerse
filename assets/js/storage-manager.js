/**
 * ArcadeVerse Local Game Storage Manager & Individual Save Data Cleaner Modal
 * Author: Babin123456
 * Scans localStorage keys per game, calculates memory footprint in bytes,
 * allows selective game data resets, exports and imports JSON backup archives.
 */

(function () {
  'use strict';

  let storageModal = null;
  let gamesListContainer = null;
  let totalBytesElem = null;

  // Known storage patterns per game ID or prefix
  const GAME_STORAGE_PREFIXES = [
    'av_',
    'arcadeverse_',
    'highscore_',
    'island_',
    'haunted_',
    'cyber_',
    'neon_',
    'quantum_',
    'chrono_',
    'astro_',
    'brick_',
    'bubble_',
    'dino_',
    'flappy_',
    'gravity_',
    'gridlock_',
    'lunar_',
    'midnight_',
    'potion_',
    'prism_',
    'pumpkin_',
    'solar_',
    'synth_',
    'time_',
    'wave_',
    'whack_'
  ];

  function initStorageManager() {
    createModalDOM();
    addFooterTriggerLink();
    attachGlobalShortcut();
  }

  // Create Modal DOM Elements
  function createModalDOM() {
    if (document.getElementById('storage-manager-modal')) return;

    storageModal = document.createElement('div');
    storageModal.id = 'storage-manager-modal';
    storageModal.className = 'storage-manager-modal hidden';
    storageModal.setAttribute('role', 'dialog');
    storageModal.setAttribute('aria-modal', 'true');
    storageModal.setAttribute('aria-label', 'Game Save Data Manager');

    storageModal.innerHTML = `
      <div class="storage-modal-overlay" id="storage-modal-overlay"></div>
      <div class="storage-modal-window">
        <!-- Topbar -->
        <div class="storage-modal-header">
          <div class="storage-brand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <h3>LOCAL GAME STORAGE MANAGER</h3>
          </div>
          <button class="btn-close-storage" id="btn-close-storage" aria-label="Close Storage Modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body / Summary Info -->
        <div class="storage-modal-body">
          <div class="storage-summary-deck">
            <div class="summary-card">
              <span class="sum-label">STORAGE DETECTED</span>
              <span id="storage-total-bytes" class="sum-val">0 KB</span>
            </div>
            <div class="summary-card">
              <span class="sum-label">GAMES WITH SAVES</span>
              <span id="storage-games-count" class="sum-val">0</span>
            </div>
            <div class="summary-actions">
              <button id="btn-export-all-saves" class="btn-storage-tool">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                EXPORT ALL SAVES
              </button>
              <label class="btn-storage-tool file-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                IMPORT BACKUP
                <input type="file" id="input-import-saves" accept=".json" style="display: none;">
              </label>
            </div>
          </div>

          <!-- Table Container -->
          <div class="storage-table-wrapper">
            <table class="storage-table">
              <thead>
                <tr>
                  <th>GAME / KEY PATTERN</th>
                  <th>KEYS STORED</th>
                  <th>FOOTPRINT</th>
                  <th style="text-align: right;">ACTION</th>
                </tr>
              </thead>
              <tbody id="storage-table-body">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="storage-modal-footer">
          <span class="storage-footer-note">Clearing individual game data resets high scores and checkpoints for that specific game without affecting other titles or your favorites.</span>
        </div>
      </div>
    `;

    document.body.appendChild(storageModal);

    // Bind event listeners
    document.getElementById('btn-close-storage').addEventListener('click', closeStorageModal);
    document.getElementById('storage-modal-overlay').addEventListener('click', closeStorageModal);
    document.getElementById('btn-export-all-saves').addEventListener('click', exportAllSaves);
    document.getElementById('input-import-saves').addEventListener('change', importSaves);

    injectStorageCSS();
  }

  // Add Trigger Link in Footer
  function addFooterTriggerLink() {
    const footerLinks = document.querySelector('.footer-links') || document.querySelector('footer');
    if (footerLinks && !document.getElementById('link-manage-storage')) {
      const link = document.createElement('a');
      link.id = 'link-manage-storage';
      link.href = '#';
      link.className = 'storage-trigger-link';
      link.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        Manage Game Data
      `;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openStorageModal();
      });
      footerLinks.appendChild(link);
    }
  }

  // Keyboard shortcut listener
  function attachGlobalShortcut() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && storageModal && !storageModal.classList.contains('hidden')) {
        closeStorageModal();
      }
    });
  }

  // Scan localStorage and build game data model
  function scanGameStorage() {
    const registry = (typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY)) ? GAMES_REGISTRY : [];
    const storageMap = {};

    let totalBytes = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const val = localStorage.getItem(key) || '';
      const byteSize = (key.length + val.length) * 2; // UTF-16 byte estimation
      totalBytes += byteSize;

      // Identify corresponding game
      let matchedGameId = null;
      let matchedGameTitle = null;

      // 1. Direct registry ID match
      for (let g = 0; g < registry.length; g++) {
        const game = registry[g];
        if (key.includes(game.id) || key.startsWith(game.id)) {
          matchedGameId = game.id;
          matchedGameTitle = game.title;
          break;
        }
      }

      // 2. Prefix fallback
      if (!matchedGameId) {
        for (let p = 0; p < GAME_STORAGE_PREFIXES.length; p++) {
          const prefix = GAME_STORAGE_PREFIXES[p];
          if (key.startsWith(prefix) && key !== 'arcadeverse_favorites' && key !== 'arcadeverse_theme') {
            matchedGameId = prefix.replace(/_$/, '');
            matchedGameTitle = matchedGameId.toUpperCase().replace('-', ' ') + ' (Save Group)';
            break;
          }
        }
      }

      // 3. Misc application state
      if (!matchedGameId) {
        matchedGameId = 'platform_shared';
        matchedGameTitle = 'Platform Shared State';
      }

      if (!storageMap[matchedGameId]) {
        storageMap[matchedGameId] = {
          id: matchedGameId,
          title: matchedGameTitle,
          keys: [],
          bytes: 0
        };
      }

      storageMap[matchedGameId].keys.push(key);
      storageMap[matchedGameId].bytes += byteSize;
    }

    return {
      games: Object.values(storageMap),
      totalBytes: totalBytes
    };
  }

  // Render Table
  function renderStorageTable() {
    const tableBody = document.getElementById('storage-table-body');
    const totalBytesDisplay = document.getElementById('storage-total-bytes');
    const gamesCountDisplay = document.getElementById('storage-games-count');

    if (!tableBody) return;

    const audit = scanGameStorage();

    totalBytesDisplay.textContent = formatBytes(audit.totalBytes);
    gamesCountDisplay.textContent = audit.games.length;

    tableBody.innerHTML = '';

    if (audit.games.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #94a3b8; padding: 24px;">
            No local game saves or cached states currently detected.
          </td>
        </tr>
      `;
      return;
    }

    audit.games.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="storage-game-name">${escapeHTML(item.title)}</div>
          <div class="storage-keys-preview">${escapeHTML(item.keys.slice(0, 3).join(', '))}${item.keys.length > 3 ? '...' : ''}</div>
        </td>
        <td><span class="badge-count">${item.keys.length} keys</span></td>
        <td><span class="badge-bytes">${formatBytes(item.bytes)}</span></td>
        <td style="text-align: right;">
          <button class="btn-clear-game" data-game-id="${escapeHTML(item.id)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            CLEAR DATA
          </button>
        </td>
      `;

      const clearBtn = tr.querySelector('.btn-clear-game');
      clearBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete all saved data and high scores for "${item.title}"?`)) {
          item.keys.forEach((k) => localStorage.removeItem(k));
          renderStorageTable();
        }
      });

      tableBody.appendChild(tr);
    });
  }

  // Export All Saves to JSON
  function exportAllSaves() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key);
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ArcadeVerse-Saves-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ========================================================
  // ATOMIC BACKUP SCHEMA VALIDATOR & CORRUPTED JSON RECOVERY (#495)
  // Prevents mid-write corruptions and guarantees atomic rollback on parse failure
  // ========================================================
  const BACKUP_SCHEMA = {
    ALLOWED_TYPE_KEYS: ['string', 'number', 'boolean'],
    MAX_ENTRY_SIZE_BYTES: 1048576, // 1MB per individual save key
    MAX_TOTAL_KEYS: 2000
  };

  /**
   * Validate integrity and format of imported JSON backup
   * @param {any} data
   * @returns {{isValid: boolean, error?: string, sanitized?: Object}}
   */
  function validateBackupPayload(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { isValid: false, error: 'Backup payload must be a non-null JSON object mapping keys to values.' };
    }

    const keys = Object.keys(data);
    if (keys.length === 0) {
      return { isValid: false, error: 'Backup file contains an empty dataset with zero keys.' };
    }

    if (keys.length > BACKUP_SCHEMA.MAX_TOTAL_KEYS) {
      return { isValid: false, error: Dataset exceeds maximum key capacity of  keys. };
    }

    const sanitized = {};
    for (const key of keys) {
      if (typeof key !== 'string' || key.trim().length === 0) {
        return { isValid: false, error: 'Malformed key identifier detected.' };
      }

      // Check for illegal prototype pollution keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return { isValid: false, error: 'Dangerous object property detected in backup payload.' };
      }

      const val = data[key];
      const valType = typeof val;

      if (!BACKUP_SCHEMA.ALLOWED_TYPE_KEYS.includes(valType) && val !== null) {
        return { isValid: false, error: Invalid value type '' detected for key ''. Must be primitive string/number/boolean. };
      }

      const stringifiedVal = val === null ? '' : String(val);
      if (stringifiedVal.length > BACKUP_SCHEMA.MAX_ENTRY_SIZE_BYTES) {
        return { isValid: false, error: Key '' exceeds individual payload limit (1MB). };
      }

      sanitized[key] = stringifiedVal;
    }

    return { isValid: true, sanitized };
  }

  /**
   * Surface non-blocking error banner inside Storage Modal
   * @param {string} message
   * @param {'error'|'warning'|'success'} type
   */
  function showStorageBanner(message, type = 'error') {
    const existing = document.getElementById('storage-modal-feedback-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'storage-modal-feedback-banner';
    banner.className = storage-banner storage-banner-;
    banner.innerHTML = 
      <div class="storage-banner-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          
        </svg>
      </div>
      <div class="storage-banner-text"></div>
      <button type="button" class="storage-banner-close" aria-label="Dismiss banner">&times;</button>
    ;

    const body = storageModal ? storageModal.querySelector('.storage-modal-body') : null;
    if (body) {
      body.insertBefore(banner, body.firstChild);
      banner.querySelector('.storage-banner-close').addEventListener('click', () => banner.remove());
      if (type === 'success') {
        setTimeout(() => banner.remove(), 4000);
      }
    }
  }

  // Import Saves from JSON with Atomic Rollback & Corrupted Recovery
  function importSaves(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let rawText = event.target.result;
      let parsed = null;

      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr) {
        console.warn('[ArcadeStorageManager] JSON parse failed, attempting heuristic cleanup...', parseErr);
        // Attempt basic heuristic recovery for trailing commas or single quotes
        try {
          const cleanedText = rawText
            .replace(/,\s*([}\]])/g, '') // remove trailing commas
            .replace(/'/g, '"');          // replace single quotes
          parsed = JSON.parse(cleanedText);
          showStorageBanner('Recovered corrupted JSON syntax (repaired trailing commas/quotes).', 'warning');
        } catch (recoveryErr) {
          showStorageBanner(Corrupted JSON file: . Import aborted safely., 'error');
          return;
        }
      }

      // Step 2: Validate against Schema
      const validation = validateBackupPayload(parsed);
      if (!validation.isValid) {
        showStorageBanner(Validation Error: , 'error');
        return;
      }

      // Step 3: Atomic Transaction with Rollback Snapshot
      const rollbackSnapshot = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) rollbackSnapshot[k] = localStorage.getItem(k);
        }

        const dataToApply = validation.sanitized;
        let appliedCount = 0;

        for (const targetKey of Object.keys(dataToApply)) {
          localStorage.setItem(targetKey, dataToApply[targetKey]);
          appliedCount++;
        }

        renderStorageTable();
        showStorageBanner(Backup restored successfully!  keys committed atomically., 'success');
      } catch (txErr) {
        console.error('[ArcadeStorageManager] Write transaction failed, initiating atomic rollback...', txErr);
        // Rollback to prior clean state
        try {
          localStorage.clear();
          Object.keys(rollbackSnapshot).forEach(k => {
            localStorage.setItem(k, rollbackSnapshot[k]);
          });
          renderStorageTable();
          showStorageBanner(Quota or Write error during import: . All settings rolled back to previous state., 'error');
        } catch (rollbackErr) {
          console.error('[ArcadeStorageManager] Critical: Rollback failed!', rollbackErr);
        }
      }
    };

    reader.onerror = () => {
      showStorageBanner('Unable to read selected backup file from disk.', 'error');
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }

  function openStorageModal() {
    if (!storageModal) createModalDOM();
    renderStorageTable();
    storageModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeStorageModal() {
    if (storageModal) {
      storageModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // Inject CSS Styles
  function injectStorageCSS() {
    if (document.getElementById('storage-manager-css')) return;

    const style = document.createElement('style');
    style.id = 'storage-manager-css';
    style.textContent = `
      .storage-manager-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .storage-manager-modal.hidden {
        display: none !important;
      }
      .storage-modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(8, 12, 20, 0.85);
        backdrop-filter: blur(6px);
      }
      .storage-modal-window {
        position: relative;
        width: 90vw;
        max-width: 820px;
        max-height: 85vh;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid #00f0ff;
        border-radius: 12px;
        box-shadow: 0 0 30px rgba(0, 240, 255, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: 'Segoe UI', system-ui, monospace;
      }
      .storage-modal-header {
        padding: 16px 24px;
        background: rgba(8, 12, 20, 0.9);
        border-bottom: 1px solid #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .storage-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #00f0ff;
      }
      .storage-brand h3 {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: 1.5px;
        color: #fff;
        margin: 0;
      }
      .btn-close-storage {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
      }
      .btn-close-storage:hover {
        color: #fff;
      }
      .storage-modal-body {
        padding: 20px 24px;
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .storage-summary-deck {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(8, 12, 20, 0.6);
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 12px 18px;
      }
      .summary-card {
        display: flex;
        flex-direction: column;
      }
      .sum-label {
        font-size: 0.65rem;
        color: #94a3b8;
        letter-spacing: 1px;
      }
      .sum-val {
        font-size: 1.2rem;
        font-weight: bold;
        color: #00f0ff;
      }
      .summary-actions {
        display: flex;
        gap: 8px;
      }
      .btn-storage-tool {
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid #1e293b;
        color: #f8fafc;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .btn-storage-tool:hover {
        border-color: #00f0ff;
        color: #00f0ff;
      }
      .storage-table-wrapper {
        border: 1px solid #1e293b;
        border-radius: 8px;
        overflow: hidden;
      }
      .storage-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
      }
      .storage-table th {
        background: rgba(8, 12, 20, 0.8);
        padding: 10px 14px;
        color: #94a3b8;
        font-weight: 600;
        text-align: left;
        border-bottom: 1px solid #1e293b;
      }
      .storage-table td {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(30, 41, 59, 0.4);
        color: #f8fafc;
      }
      .storage-game-name {
        font-weight: bold;
        color: #fff;
      }
      .storage-keys-preview {
        font-size: 0.7rem;
        color: #94a3b8;
        margin-top: 2px;
      }
      .badge-count {
        background: rgba(30, 41, 59, 0.6);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.72rem;
        color: #94a3b8;
      }
      .badge-bytes {
        color: #00f0ff;
        font-family: monospace;
      }
      .btn-clear-game {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #ef4444;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: bold;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
      }
            .storage-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 0.8rem;
        line-height: 1.4;
        animation: fadeIn 0.2s ease-out;
      }
      .storage-banner-error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
      .storage-banner-warning {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.4);
        color: #fcd34d;
      }
      .storage-banner-success {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #6ee7b7;
      }
      .storage-banner-icon {
        flex-shrink: 0;
        display: flex;
      }
      .storage-banner-text {
        flex: 1;
      }
      .storage-banner-close {
        background: transparent;
        border: none;
        color: inherit;
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        opacity: 0.7;
      }
      .storage-banner-close:hover {
        opacity: 1;
      }
      .btn-clear-game:hover {
        background: #ef4444;
        color: #fff;
      }
      .storage-modal-footer {
        padding: 10px 24px;
        background: rgba(8, 12, 20, 0.9);
        border-top: 1px solid #1e293b;
        font-size: 0.75rem;
        color: #94a3b8;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStorageManager);
  } else {
    initStorageManager();
  }

  // Export Global API
  window.ArcadeStorageManager = {
    open: openStorageModal,
    close: closeStorageModal,
    scan: scanGameStorage,
    export: exportAllSaves
  };
})();
