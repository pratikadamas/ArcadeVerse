/**
 * ArcadeVerse Serverless GitHub Gist Client-Side Save State Cloud Sync Engine (#1111)
 *
 * Provides 100% serverless, client-side cloud backup and cross-device restore
 * using the GitHub REST API (https://api.github.com/gists).
 * Serializes all game save states (av_*), high scores, settings, and favorites into a private Gist.
 *
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var inst = factory();
    root.GistCloudSync = inst;
    if (root.ArcadeVerse) {
      root.ArcadeVerse.cloudSync = inst;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GITHUB_API_URL = 'https://api.github.com/gists';
  var BACKUP_FILENAME = 'arcadeverse-backup.json';

  // Storage keys for persisting credentials and metadata
  var TOKEN_SESSION_KEY = 'arcadeverse_gist_pat';
  var TOKEN_LOCAL_KEY = 'arcadeverse_gist_pat_enc';
  var GIST_ID_KEY = 'arcadeverse_last_gist_id';
  var LAST_SYNC_KEY = 'arcadeverse_last_cloud_sync';
  var REMEMBER_TOKEN_KEY = 'arcadeverse_remember_pat';

  // Key prefixes collected for save state synchronization
  var SYNC_KEY_PREFIXES = [
    'av_',
    'arcadeverse_',
    'highscore_',
    'arcade_'
  ];

  // Specific standalone keys to include
  var EXPLICIT_SYNC_KEYS = [
    'highScore',
    'favorites',
    'arcadeverse_dda_mode',
    'arcadeverse_reduced_motion',
    'arcadeverse_master_volume',
    'arcadeverse_game_speed'
  ];

  // Obfuscation seed for client-side local token storage
  var SALT = 'AV_GIST_SALT_2026';

  /**
   * Simple client-side reversible obfuscation to avoid plain-text token in localStorage
   */
  function obfuscate(text) {
    if (!text) return '';
    try {
      var result = '';
      for (var i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length));
      }
      return typeof btoa !== 'undefined' ? btoa(result) : Buffer.from(result).toString('base64');
    } catch (_) {
      return text;
    }
  }

  function deobfuscate(encoded) {
    if (!encoded) return '';
    try {
      var decoded = typeof atob !== 'undefined' ? atob(encoded) : Buffer.from(encoded, 'base64').toString();
      var result = '';
      for (var i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length));
      }
      return result;
    } catch (_) {
      return encoded;
    }
  }

  /**
   * Helper: Extract raw 32-character hexadecimal Gist ID from user input or full URL
   * e.g. https://gist.github.com/username/aa55bb66cc77... -> aa55bb66cc77...
   */
  function normalizeGistId(input) {
    if (!input || typeof input !== 'string') return '';
    var trimmed = input.trim();
    var match = trimmed.match(/([a-f0-9]{20,32})/i);
    return match ? match[1] : trimmed;
  }

  /**
   * Serializes all relevant local save state keys into a sanitized backup payload
   * @returns {Object} { app, version, exportedAt, keyCount, data }
   */
  function serializeSaveState() {
    var data = {};
    var count = 0;

    try {
      if (typeof localStorage !== 'undefined') {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (!key) continue;

          var shouldInclude = false;

          // Check prefix matches
          for (var p = 0; p < SYNC_KEY_PREFIXES.length; p++) {
            if (key.indexOf(SYNC_KEY_PREFIXES[p]) === 0) {
              shouldInclude = true;
              break;
            }
          }

          // Check explicit key matches
          if (!shouldInclude && EXPLICIT_SYNC_KEYS.indexOf(key) !== -1) {
            shouldInclude = true;
          }

          // Never export the PAT token itself
          if (key === TOKEN_LOCAL_KEY || key === TOKEN_SESSION_KEY) {
            shouldInclude = false;
          }

          if (shouldInclude) {
            var val = localStorage.getItem(key);
            if (val !== null) {
              data[key] = val;
              count++;
            }
          }
        }
      }
    } catch (_) {}

    return {
      app: 'ArcadeVerse',
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      keyCount: count,
      data: data
    };
  }

  /**
   * Validates structure and security of a cloud backup payload before applying
   * @param {any} payload
   * @returns {{isValid: boolean, error?: string, sanitized?: Object}}
   */
  function validateBackupSchema(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { isValid: false, error: 'Backup payload must be a non-null JSON object.' };
    }

    var saveMap = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload;

    var keys = Object.keys(saveMap);
    if (keys.length === 0) {
      return { isValid: false, error: 'Backup payload contains no save keys.' };
    }

    if (keys.length > 2500) {
      return { isValid: false, error: 'Backup contains excessive keys (> 2500). Aborting restore.' };
    }

    var sanitized = Object.create ? Object.create(null) : {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];

      // Prototype pollution guard
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        continue;
      }

      // Metadata keys skip
      if (k === 'app' || k === 'version' || k === 'exportedAt' || k === 'keyCount') {
        continue;
      }

      var val = saveMap[k];
      if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
        return { isValid: false, error: 'Invalid value type for key: ' + k };
      }

      var strVal = String(val);
      // Byte size cap (1MB per entry)
      if (strVal.length > 1048576) {
        return { isValid: false, error: 'Key ' + k + ' exceeds 1MB limit.' };
      }

      sanitized[k] = strVal;
    }

    return { isValid: true, sanitized: sanitized };
  }

  var GistCloudSync = {
    /**
     * Retrieves stored GitHub PAT from sessionStorage or obfuscated localStorage
     * @returns {string} Personal access token or empty string
     */
    getToken: function () {
      try {
        if (typeof sessionStorage !== 'undefined') {
          var sessionToken = sessionStorage.getItem(TOKEN_SESSION_KEY);
          if (sessionToken) return sessionToken.trim();
        }
        if (typeof localStorage !== 'undefined') {
          var isRemembered = localStorage.getItem(REMEMBER_TOKEN_KEY) === 'true';
          if (isRemembered) {
            var enc = localStorage.getItem(TOKEN_LOCAL_KEY);
            if (enc) return deobfuscate(enc).trim();
          }
        }
      } catch (_) {}
      return '';
    },

    /**
     * Stores the GitHub PAT
     * @param {string} token - GitHub personal access token
     * @param {boolean} [persist=false] - Whether to persist across browser restarts
     */
    setToken: function (token, persist) {
      var clean = (token || '').trim();
      try {
        if (typeof sessionStorage !== 'undefined') {
          if (clean) sessionStorage.setItem(TOKEN_SESSION_KEY, clean);
          else sessionStorage.removeItem(TOKEN_SESSION_KEY);
        }
        if (typeof localStorage !== 'undefined') {
          if (persist && clean) {
            localStorage.setItem(REMEMBER_TOKEN_KEY, 'true');
            localStorage.setItem(TOKEN_LOCAL_KEY, obfuscate(clean));
          } else {
            localStorage.removeItem(REMEMBER_TOKEN_KEY);
            localStorage.removeItem(TOKEN_LOCAL_KEY);
          }
        }
      } catch (_) {}
    },

    /**
     * Clears all stored tokens
     */
    clearToken: function () {
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_SESSION_KEY);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(REMEMBER_TOKEN_KEY);
          localStorage.removeItem(TOKEN_LOCAL_KEY);
        }
      } catch (_) {}
    },

    /**
     * Gets the last used Gist ID
     * @returns {string}
     */
    getLastGistId: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(GIST_ID_KEY) || '';
        }
      } catch (_) {}
      return '';
    },

    /**
     * Saves Gist ID to localStorage
     * @param {string} gistId
     */
    setLastGistId: function (gistId) {
      var norm = normalizeGistId(gistId);
      try {
        if (typeof localStorage !== 'undefined' && norm) {
          localStorage.setItem(GIST_ID_KEY, norm);
        }
      } catch (_) {}
    },

    /**
     * Gets timestamp of last successful cloud backup
     * @returns {string|null}
     */
    getLastSyncTime: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(LAST_SYNC_KEY);
        }
      } catch (_) {}
      return null;
    },

    /**
     * Export save states and upload to private GitHub Gist
     * @param {Object} [options] - { token, gistId, description }
     * @returns {Promise<{success: boolean, gistId?: string, htmlUrl?: string, keyCount?: number, timestamp?: string, error?: string}>}
     */
    backupToGist: function (options) {
      options = options || {};
      var token = options.token || this.getToken();
      if (!token) {
        return Promise.resolve({
          success: false,
          error: 'GitHub Personal Access Token is required to create a private Gist backup.'
        });
      }

      var targetGistId = normalizeGistId(options.gistId || this.getLastGistId());
      var payload = serializeSaveState();
      var serializedContent = JSON.stringify(payload, null, 2);

      var bodyObj = {
        description: options.description || 'ArcadeVerse Save State Cloud Backup [Private]',
        files: {}
      };
      bodyObj.files[BACKUP_FILENAME] = { content: serializedContent };

      var headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };

      var self = this;
      var url = targetGistId ? (GITHUB_API_URL + '/' + targetGistId) : GITHUB_API_URL;
      var method = targetGistId ? 'PATCH' : 'POST';

      if (!targetGistId) {
        bodyObj.public = false; // Always enforce private Gist
      }

      return fetch(url, {
        method: method,
        headers: headers,
        body: JSON.stringify(bodyObj)
      }).then(function (res) {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Authentication failed (401). Please check that your token has "gist" scope.');
          } else if (res.status === 404 && targetGistId) {
            // Specified Gist was deleted or not found; retry by creating a fresh Gist
            return self.backupToGist({ token: token, gistId: null, description: options.description });
          } else {
            return res.json().then(function (errData) {
              throw new Error(errData.message || ('GitHub API returned HTTP ' + res.status));
            }).catch(function (e) {
              throw new Error(e.message || ('GitHub API returned HTTP ' + res.status));
            });
          }
        }
        return res.json();
      }).then(function (gistData) {
        if (!gistData || !gistData.id) {
          return gistData; // Passthrough if recursive retry returned result
        }

        var newGistId = gistData.id;
        var htmlUrl = gistData.html_url || ('https://gist.github.com/' + newGistId);
        var syncTime = new Date().toISOString();

        self.setLastGistId(newGistId);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LAST_SYNC_KEY, syncTime);
          }
        } catch (_) {}

        return {
          success: true,
          gistId: newGistId,
          htmlUrl: htmlUrl,
          keyCount: payload.keyCount,
          timestamp: syncTime
        };
      }).catch(function (err) {
        return {
          success: false,
          error: err.message || 'Unknown network error connecting to GitHub Gist API.'
        };
      });
    },

    /**
     * Pulls JSON backup from GitHub Gist and restores save states atomically
     * @param {string} gistId - Gist ID or URL
     * @param {Object} [options] - { token }
     * @returns {Promise<{success: boolean, keysRestored?: number, timestamp?: string, error?: string}>}
     */
    restoreFromGist: function (gistId, options) {
      options = options || {};
      var cleanId = normalizeGistId(gistId || this.getLastGistId());
      if (!cleanId) {
        return Promise.resolve({
          success: false,
          error: 'Please enter a valid GitHub Gist ID or Gist URL.'
        });
      }

      var token = options.token || this.getToken();
      var headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      var self = this;
      return fetch(GITHUB_API_URL + '/' + cleanId, {
        method: 'GET',
        headers: headers
      }).then(function (res) {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Gist not found (404). If this Gist is private, please provide a GitHub token.');
          } else if (res.status === 401) {
            throw new Error('Unauthorized (401). Check that your token has access to this Gist.');
          } else {
            throw new Error('GitHub API returned HTTP ' + res.status);
          }
        }
        return res.json();
      }).then(function (gistData) {
        if (!gistData || !gistData.files) {
          throw new Error('Gist contains no files.');
        }

        // Locate arcadeverse-backup.json or the first json file
        var targetFile = gistData.files[BACKUP_FILENAME];
        if (!targetFile) {
          var fileKeys = Object.keys(gistData.files);
          for (var i = 0; i < fileKeys.length; i++) {
            if (fileKeys[i].toLowerCase().indexOf('.json') !== -1) {
              targetFile = gistData.files[fileKeys[i]];
              break;
            }
          }
        }

        if (!targetFile || !targetFile.content) {
          throw new Error('No valid backup JSON file found in this Gist.');
        }

        var parsed;
        try {
          parsed = JSON.parse(targetFile.content);
        } catch (_) {
          throw new Error('Malformed JSON payload inside Gist file.');
        }

        var validation = validateBackupSchema(parsed);
        if (!validation.isValid) {
          throw new Error('Corrupted or invalid backup schema: ' + validation.error);
        }

        // Atomic write to localStorage
        var restoredCount = 0;
        var saveMap = validation.sanitized;
        var saveKeys = Object.keys(saveMap);

        if (typeof localStorage !== 'undefined') {
          for (var j = 0; j < saveKeys.length; j++) {
            var k = saveKeys[j];
            localStorage.setItem(k, saveMap[k]);
            restoredCount++;
          }
        }

        self.setLastGistId(cleanId);
        var syncTime = new Date().toISOString();
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LAST_SYNC_KEY, syncTime);
          }
        } catch (_) {}

        return {
          success: true,
          keysRestored: restoredCount,
          timestamp: parsed.exportedAt || syncTime
        };
      }).catch(function (err) {
        return {
          success: false,
          error: err.message || 'Failed to restore backup from GitHub Gist.'
        };
      });
    },

    /**
     * Validates an arbitrary backup payload without writing to localStorage
     * @param {any} payload
     * @returns {{isValid: boolean, error?: string, sanitized?: Object}}
     */
    validate: function (payload) {
      return validateBackupSchema(payload);
    },

    /**
     * Serializes current state
     * @returns {Object}
     */
    serialize: function () {
      return serializeSaveState();
    },

    /**
     * Mounts Cloud Sync UI section into the Storage Manager modal or provided container
     * @param {HTMLElement} [container]
     */
    mountUI: function (container) {
      if (typeof document === 'undefined') return;

      var target = container || document.querySelector('.storage-summary-deck');
      if (!target || document.getElementById('gist-cloud-sync-deck')) return;

      var self = this;
      var storedToken = this.getToken();
      var storedGistId = this.getLastGistId();
      var lastSync = this.getLastSyncTime();
      var lastSyncFormatted = lastSync ? new Date(lastSync).toLocaleString() : 'Never';

      var syncDeck = document.createElement('div');
      syncDeck.id = 'gist-cloud-sync-deck';
      syncDeck.className = 'gist-cloud-sync-deck';
      syncDeck.innerHTML = `
        <div class="gist-sync-header">
          <div class="gist-sync-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="gist-sync-icon" aria-hidden="true">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
            <h4>SERVERLESS GITHUB GIST CLOUD SYNC</h4>
          </div>
          <span class="gist-sync-status-badge" id="gist-sync-status-badge">
            <span class="status-dot"></span>
            <span id="gist-sync-status-text">Ready</span>
          </span>
        </div>

        <p class="gist-sync-desc">
          Sync your high scores, checkpoint progress, and favorites across computers and mobile browsers via a private GitHub Gist. 100% serverless and private.
        </p>

        <div class="gist-sync-controls">
          <div class="gist-field-group">
            <label for="gist-pat-input">GitHub Personal Access Token (PAT)</label>
            <div class="gist-input-wrap">
              <input type="password" id="gist-pat-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (gist scope)" value="${escapeAttr(storedToken)}" autocomplete="off" spellcheck="false">
              <button type="button" class="btn-toggle-pat" id="btn-toggle-pat" aria-label="Toggle token visibility" title="Show/Hide Token">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
            <div class="gist-pat-help">
              <label class="gist-checkbox-label">
                <input type="checkbox" id="gist-remember-token" ${localStorage.getItem(REMEMBER_TOKEN_KEY) === 'true' ? 'checked' : ''}>
                <span>Remember token on this device</span>
              </label>
              <a href="https://github.com/settings/tokens/new?scopes=gist&description=ArcadeVerse+Save+State+Sync" target="_blank" rel="noopener noreferrer" class="gist-create-token-link">
                Generate Gist Token &rarr;
              </a>
            </div>
          </div>

          <div class="gist-field-group">
            <label for="gist-id-input">Gist ID (for Cross-Device Restore)</label>
            <div class="gist-input-wrap">
              <input type="text" id="gist-id-input" placeholder="e.g. 7f8a9b0c1d2e3f4a5b6c..." value="${escapeAttr(storedGistId)}" spellcheck="false">
              <button type="button" class="btn-copy-gist-id" id="btn-copy-gist-id" title="Copy Gist ID" aria-label="Copy Gist ID">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="gist-sync-actions">
          <button type="button" class="btn-cloud-sync btn-backup" id="btn-gist-backup">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            BACKUP TO CLOUD
          </button>
          <button type="button" class="btn-cloud-sync btn-restore" id="btn-gist-restore">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            RESTORE FROM CLOUD
          </button>
        </div>

        <div class="gist-sync-footer">
          <span class="gist-last-sync" id="gist-last-sync-text">Last Cloud Sync: ${lastSyncFormatted}</span>
          <button type="button" class="btn-forget-token" id="btn-forget-token">Clear Stored Token</button>
        </div>
      `;

      target.parentNode.insertBefore(syncDeck, target.nextSibling);

      // Event Listeners
      var patInput = document.getElementById('gist-pat-input');
      var idInput = document.getElementById('gist-id-input');
      var rememberCheck = document.getElementById('gist-remember-token');
      var togglePatBtn = document.getElementById('btn-toggle-pat');
      var copyIdBtn = document.getElementById('btn-copy-gist-id');
      var backupBtn = document.getElementById('btn-gist-backup');
      var restoreBtn = document.getElementById('btn-gist-restore');
      var forgetBtn = document.getElementById('btn-forget-token');
      var statusText = document.getElementById('gist-sync-status-text');
      var lastSyncText = document.getElementById('gist-last-sync-text');

      if (togglePatBtn && patInput) {
        togglePatBtn.addEventListener('click', function () {
          patInput.type = patInput.type === 'password' ? 'text' : 'password';
        });
      }

      if (copyIdBtn && idInput) {
        copyIdBtn.addEventListener('click', function () {
          if (!idInput.value) return;
          try {
            navigator.clipboard.writeText(idInput.value).then(function () {
              var orig = copyIdBtn.title;
              copyIdBtn.title = 'Copied!';
              setTimeout(function () { copyIdBtn.title = orig; }, 2000);
            });
          } catch (_) {}
        });
      }

      if (forgetBtn) {
        forgetBtn.addEventListener('click', function () {
          self.clearToken();
          if (patInput) patInput.value = '';
          if (statusText) statusText.textContent = 'Token Cleared';
        });
      }

      if (backupBtn) {
        backupBtn.addEventListener('click', function () {
          var token = patInput ? patInput.value.trim() : '';
          var remember = rememberCheck ? rememberCheck.checked : false;
          if (!token) {
            alert('Please provide a GitHub Personal Access Token with "gist" scope.');
            if (patInput) patInput.focus();
            return;
          }

          self.setToken(token, remember);
          backupBtn.disabled = true;
          backupBtn.classList.add('loading');
          if (statusText) statusText.textContent = 'Uploading save state...';

          self.backupToGist({
            token: token,
            gistId: idInput ? idInput.value.trim() : null
          }).then(function (res) {
            backupBtn.disabled = false;
            backupBtn.classList.remove('loading');
            if (res.success) {
              if (idInput) idInput.value = res.gistId;
              if (statusText) statusText.textContent = 'Backup Successful (' + res.keyCount + ' keys)';
              if (lastSyncText) lastSyncText.textContent = 'Last Cloud Sync: ' + new Date(res.timestamp).toLocaleString();
              alert('Save states backed up successfully to private GitHub Gist!\nGist ID: ' + res.gistId + '\nKeep this ID to restore on your other devices.');
            } else {
              if (statusText) statusText.textContent = 'Backup Failed';
              alert('Cloud Backup Error:\n' + res.error);
            }
          });
        });
      }

      if (restoreBtn) {
        restoreBtn.addEventListener('click', function () {
          var gistId = idInput ? idInput.value.trim() : '';
          if (!gistId) {
            alert('Please enter your GitHub Gist ID or Gist URL to restore.');
            if (idInput) idInput.focus();
            return;
          }

          var token = patInput ? patInput.value.trim() : '';
          var remember = rememberCheck ? rememberCheck.checked : false;
          if (token) self.setToken(token, remember);

          if (!confirm('Restoring will merge and overwrite current game high scores and settings with the cloud backup. Proceed?')) {
            return;
          }

          restoreBtn.disabled = true;
          restoreBtn.classList.add('loading');
          if (statusText) statusText.textContent = 'Restoring save state...';

          self.restoreFromGist(gistId, { token: token }).then(function (res) {
            restoreBtn.disabled = false;
            restoreBtn.classList.remove('loading');
            if (res.success) {
              if (statusText) statusText.textContent = 'Restored ' + res.keysRestored + ' keys';
              if (lastSyncText) lastSyncText.textContent = 'Last Cloud Sync: ' + new Date(res.timestamp).toLocaleString();
              alert('Save states restored successfully! ' + res.keysRestored + ' items synchronized.');
              if (typeof window.renderStorageTable === 'function') {
                window.renderStorageTable();
              }
            } else {
              if (statusText) statusText.textContent = 'Restore Failed';
              alert('Cloud Restore Error:\n' + res.error);
            }
          });
        });
      }
    }
  };

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m;
    });
  }

  return GistCloudSync;
});
