/**
 * ArcadeVerse Custom Playlists & Collections Engine
 * Allows players to create named playlists, add/remove games,
 * and filter the catalog or export/import their collections.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_user_playlists';
  const SHARE_PREFIX = 'AVPL:';
  const MAX_SHARE_LENGTH = 64 * 1024;

  class PlaylistManager {
    constructor() {
      this.playlists = this.loadPlaylists();
      this.activePlaylistId = null;
      this.lastFocused = null;
      this.keyboardTrapBound = false;
      this.initEvents();
    }

    loadPlaylists() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Failed to load playlists from storage:', e);
      }

      // Default Starter Playlists
      return [
        {
          id: 'quick-breaks',
          name: 'Quick Coffee Breaks',
          description: 'Fast-paced arcade games under 5 minutes',
          icon: 'coffee',
          games: ['cyber-snake_babin', 'whack-a-bug_babin', 'quantum-slide_babin'],
          createdAt: Date.now()
        },
        {
          id: 'mind-benders',
          name: 'Mind Benders',
          description: 'Challenging puzzle & logic gauntlets',
          icon: 'brain',
          games: ['cryptic-wordle_babin', 'code-breaker_babin', 'quantum-2048_babin'],
          createdAt: Date.now()
        }
      ];
    }

    savePlaylists(playlists = this.playlists) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
        this.playlists = playlists;
        window.dispatchEvent(new CustomEvent('arcadeverse:playlists-updated', { detail: this.playlists }));
        return true;
      } catch (e) {
        console.error('Failed to save playlists:', e);
        return false;
      }
    }

    getPlaylists() {
      return this.playlists;
    }

    getPlaylist(id) {
      return this.playlists.find(p => p.id === id);
    }

    createPlaylist(name, description = '', icon = 'list-music') {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const id = 'playlist-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4);
      const newPlaylist = {
        id,
        name: trimmed,
        description: description.trim(),
        icon,
        games: [],
        createdAt: Date.now()
      };
      this.playlists.push(newPlaylist);
      this.savePlaylists();
      return newPlaylist;
    }

    deletePlaylist(id) {
      this.playlists = this.playlists.filter(p => p.id !== id);
      if (this.activePlaylistId === id) this.activePlaylistId = null;
      this.savePlaylists();
    }

    addGameToPlaylist(playlistId, gameId) {
      const pl = this.getPlaylist(playlistId);
      if (!pl) return false;
      if (!pl.games.includes(gameId)) {
        pl.games.push(gameId);
        this.savePlaylists();
        return true;
      }
      return false;
    }

    removeGameFromPlaylist(playlistId, gameId) {
      const pl = this.getPlaylist(playlistId);
      if (!pl) return false;
      pl.games = pl.games.filter(id => id !== gameId);
      this.savePlaylists();
      return true;
    }

    toggleGameInPlaylist(playlistId, gameId) {
      const pl = this.getPlaylist(playlistId);
      if (!pl) return false;
      if (pl.games.includes(gameId)) {
        this.removeGameFromPlaylist(playlistId, gameId);
        return false;
      } else {
        this.addGameToPlaylist(playlistId, gameId);
        return true;
      }
    }

    exportCollectionsJSON() {
      return JSON.stringify(this.playlists, null, 2);
    }

    validateSharedPlaylist(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.keys(value).some(key => key !== 'name' && key !== 'games') ||
          typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100 ||
          !Array.isArray(value.games) || value.games.length > 1000) {
        throw new Error('Invalid playlist code: expected a name and a game list.');
      }
      if (typeof GAMES_REGISTRY === 'undefined' || !Array.isArray(GAMES_REGISTRY)) {
        throw new Error('The game catalog is not ready. Please try again.');
      }
      const knownIds = new Set(GAMES_REGISTRY.map(game => game.id));
      if (value.games.some(id => typeof id !== 'string' || !knownIds.has(id))) {
        throw new Error('This playlist contains games that are not in the catalog.');
      }
      return { name: value.name.trim(), games: [...new Set(value.games)] };
    }

    exportPlaylistCode(id) {
      const playlist = this.getPlaylist(id);
      if (!playlist) throw new Error('Playlist not found.');
      const value = this.validateSharedPlaylist({ name: playlist.name, games: playlist.games });
      // Base64 works on bytes, not JavaScript's UTF-16 strings.
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const code = SHARE_PREFIX + btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
      if (code.length > MAX_SHARE_LENGTH) throw new Error('This playlist is too large to share.');
      return code;
    }

    importPlaylistCode(code) {
      if (typeof code !== 'string' || code.length > MAX_SHARE_LENGTH) {
        throw new Error('Invalid playlist code: the code is too large.');
      }
      const encoded = code.trim().slice(SHARE_PREFIX.length);
      let value;
      try {
        if (!code.trim().startsWith(SHARE_PREFIX) || !encoded || encoded.length % 4 !== 0 ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error();
        const binary = atob(encoded);
        if (btoa(binary) !== encoded) throw new Error();
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(binary, char => char.charCodeAt(0))
        ));
      } catch {
        throw new Error('Invalid or corrupted playlist code. Please check the AVPL: code.');
      }
      const shared = this.validateSharedPlaylist(value);
      const playlist = {
        id: 'playlist-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
        ...shared,
        description: '',
        icon: 'list-music',
        createdAt: Date.now()
      };
      // Persist before changing memory or the drawer: failed imports save nothing.
      if (!this.savePlaylists([...this.playlists, playlist])) {
        throw new Error('Could not save the playlist. Browser storage may be full or unavailable.');
      }
      this.updateDrawerList();
      return playlist;
    }

    showShareStatus(message, isError = false) {
      const status = document.getElementById('playlist-share-status');
      if (!status) return;
      status.textContent = message;
      status.dataset.kind = isError ? 'error' : 'success';
      status.hidden = false;
    }

    async copyPlaylistCode(id) {
      try {
        const code = this.exportPlaylistCode(id);
        try {
          await navigator.clipboard.writeText(code);
          this.showShareStatus('Playlist code copied. Share it with a friend!');
        } catch {
          // HTTP origins or denied permissions still allow manual copying.
          window.prompt('Clipboard unavailable. Copy this playlist code:', code);
          this.showShareStatus('Clipboard unavailable. Copy the code from the dialog.', true);
        }
      } catch (error) {
        this.showShareStatus(error.message, true);
      }
    }

    importCollectionsJSON(jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          this.playlists = parsed;
          this.savePlaylists();
          return true;
        }
      } catch (e) {
        console.error('Import failed:', e);
      }
      return false;
    }

    initEvents() {
      document.addEventListener('DOMContentLoaded', () => {
        this.renderDrawerUI();
      });
    }

    renderDrawerUI() {
      // Create Playlist Drawer Container
      let drawer = document.getElementById('playlist-drawer');
      if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'playlist-drawer';
        drawer.className = 'playlist-drawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.innerHTML = `
          <div class="playlist-drawer-backdrop" id="playlist-drawer-backdrop"></div>
          <div class="playlist-drawer-panel" role="dialog" aria-label="Game Playlists & Collections" aria-modal="true">
            <div class="playlist-drawer-header">
              <div class="playlist-header-left">
                <i data-lucide="library" class="playlist-header-icon"></i>
                <h3 class="playlist-drawer-title">Game Playlists</h3>
              </div>
              <button class="btn-close-playlist" id="close-playlist-drawer-btn" aria-label="Close playlists drawer">
                <i data-lucide="x"></i>
              </button>
            </div>
            <div class="playlist-drawer-body">
              <div class="playlist-create-form">
                <input type="text" id="new-playlist-name" placeholder="New Playlist Title..." class="playlist-input" aria-label="Playlist Name">
                <button type="button" class="btn btn-primary btn-sm" id="create-playlist-btn">
                  <span><i data-lucide="plus"></i> Create</span>
                </button>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="import-playlist-btn">
                <i data-lucide="download"></i> Import Playlist
              </button>
              <div id="playlist-share-status" class="playlist-share-status" role="status" aria-live="polite" aria-atomic="true" hidden></div>
              <div class="playlist-list" id="playlist-list-items">
                <!-- Injected dynamically -->
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(drawer);

        const closeBtn = drawer.querySelector('#close-playlist-drawer-btn');
        const backdrop = drawer.querySelector('#playlist-drawer-backdrop');
        const createBtn = drawer.querySelector('#create-playlist-btn');
        const input = drawer.querySelector('#new-playlist-name');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
        if (backdrop) backdrop.addEventListener('click', () => this.closeDrawer());
        drawer.querySelector('#import-playlist-btn').addEventListener('click', () => {
          const code = window.prompt('Paste a playlist code starting with AVPL:');
          if (code === null) return;
          try {
            const playlist = this.importPlaylistCode(code);
            this.showShareStatus(`Imported "${playlist.name}" (${playlist.games.length} games).`);
          } catch (error) {
            this.showShareStatus(error.message, true);
          }
        });

        if (createBtn && input) {
          createBtn.addEventListener('click', () => {
            if (input.value.trim()) {
              this.createPlaylist(input.value.trim());
              input.value = '';
              this.updateDrawerList();
            }
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
              this.createPlaylist(input.value.trim());
              input.value = '';
              this.updateDrawerList();
            }
          });
        }

        this.bindKeyboardTrap(drawer);
      }

      this.updateDrawerList();
    }

    bindKeyboardTrap(drawer) {
      if (this.keyboardTrapBound) return;
      this.keyboardTrapBound = true;

      document.addEventListener('keydown', (e) => {
        if (!drawer || !drawer.classList.contains('open')) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          const activeConfirm = drawer.querySelector('.playlist-delete-confirm-box');
          if (activeConfirm) {
            const cardItem = activeConfirm.closest('.playlist-card-item');
            if (cardItem) {
              const actions = cardItem.querySelector('.playlist-actions-row');
              const delBtn = cardItem.querySelector('.btn-delete-pl');
              activeConfirm.remove();
              if (actions) actions.style.display = '';
              if (delBtn) delBtn.focus();
              return;
            }
          }
          this.closeDrawer();
          return;
        }

        if (e.key === 'Tab') {
          const focusables = this.getFocusableElements(drawer);
          if (focusables.length === 0) {
            e.preventDefault();
            return;
          }
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first || !drawer.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !drawer.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      });
    }

    getFocusableElements(container) {
      if (!container) return [];
      const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(container.querySelectorAll(selector)).filter((el) => {
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
      });
    }

    updateDrawerList() {
      const container = document.getElementById('playlist-list-items');
      if (!container) return;

      container.innerHTML = '';
      if (this.playlists.length === 0) {
        container.innerHTML = `
          <div class="playlist-empty-state">
            <i data-lucide="folder-plus"></i>
            <p>No custom playlists yet. Create one above to organize your favorite arcade gems!</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      this.playlists.forEach((pl) => {
        const item = document.createElement('div');
        item.className = 'playlist-card-item';
        item.innerHTML = `
          <div class="playlist-card-info">
            <div class="playlist-title-row">
              <span class="playlist-name"></span>
              <span class="playlist-count-pill"></span>
            </div>
            <p class="playlist-desc"></p>
          </div>
          <div class="playlist-actions-row">
            <button type="button" class="btn btn-secondary btn-xs btn-filter-pl">
              <i data-lucide="play-circle"></i> View Games
            </button>
            <button type="button" class="btn btn-secondary btn-xs btn-export-pl">
              <i data-lucide="copy"></i> Export Code
            </button>
            <button type="button" class="btn btn-secondary btn-xs btn-share-qr-pl">
              <i data-lucide="qr-code"></i> Share / QR
            </button>
            <button type="button" class="btn btn-icon btn-xs btn-delete-pl" title="Delete Playlist" aria-label="Delete Playlist">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        // Shared names are untrusted text, never HTML.
        item.querySelector('.playlist-name').textContent = pl.name;
        item.querySelector('.playlist-count-pill').textContent = `${pl.games.length} games`;
        const description = item.querySelector('.playlist-desc');
        description.textContent = pl.description || '';
        description.hidden = !pl.description;
        item.querySelector('.btn-export-pl').addEventListener('click', () => this.copyPlaylistCode(pl.id));
        const shareQrBtn = item.querySelector('.btn-share-qr-pl');
        if (shareQrBtn) {
          shareQrBtn.addEventListener('click', () => {
            if (window.ArcadePlaylistShare && typeof window.ArcadePlaylistShare.openShareModal === 'function') {
              window.ArcadePlaylistShare.openShareModal(pl);
            }
          });
        }

        const viewBtn = item.querySelector('.btn-filter-pl');
        if (viewBtn) {
          viewBtn.addEventListener('click', () => {
            this.activePlaylistId = pl.id;
            window.dispatchEvent(new CustomEvent('arcadeverse:filter-playlist', { detail: pl }));
            this.closeDrawer();
          });
        }

        const delBtn = item.querySelector('.btn-delete-pl');
        const actionsRow = item.querySelector('.playlist-actions-row');
        if (delBtn && actionsRow) {
          delBtn.addEventListener('click', () => {
            if (item.querySelector('.playlist-delete-confirm-box')) return;

            actionsRow.style.display = 'none';

            const confirmBox = document.createElement('div');
            confirmBox.className = 'playlist-delete-confirm-box';
            confirmBox.setAttribute('role', 'alert');

            const promptSpan = document.createElement('span');
            promptSpan.className = 'playlist-delete-prompt';
            promptSpan.textContent = `Delete "${pl.name}"?`;

            const btnsWrapper = document.createElement('div');
            btnsWrapper.className = 'playlist-delete-buttons';

            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = 'btn btn-confirm-delete';
            confirmBtn.textContent = 'Delete';
            confirmBtn.setAttribute('aria-label', `Confirm delete playlist ${pl.name}`);

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-cancel-delete';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.setAttribute('aria-label', 'Cancel deletion');

            confirmBtn.addEventListener('click', () => {
              this.deletePlaylist(pl.id);
              this.updateDrawerList();
            });

            cancelBtn.addEventListener('click', () => {
              confirmBox.remove();
              actionsRow.style.display = '';
              delBtn.focus();
            });

            btnsWrapper.appendChild(confirmBtn);
            btnsWrapper.appendChild(cancelBtn);
            confirmBox.appendChild(promptSpan);
            confirmBox.appendChild(btnsWrapper);
            item.appendChild(confirmBox);

            cancelBtn.focus();
          });
        }

        container.appendChild(item);
      });

      if (window.lucide) lucide.createIcons();
    }

    openDrawer(triggerEl) {
      const drawer = document.getElementById('playlist-drawer');
      if (drawer) {
        this.lastFocused = triggerEl || document.activeElement;
        this.updateDrawerList();
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');

        const trigger = document.getElementById('trigger-playlists-btn');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'true');
        }

        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            const focusables = this.getFocusableElements(drawer);
            if (focusables.length > 0) {
              focusables[0].focus();
            }
          });
        }
      }
    }

    closeDrawer() {
      const drawer = document.getElementById('playlist-drawer');
      if (drawer) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
      }

      const trigger = document.getElementById('trigger-playlists-btn');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }

      const targetFocus = (this.lastFocused && typeof this.lastFocused.focus === 'function' && typeof document !== 'undefined' && document.contains && document.contains(this.lastFocused))
        ? this.lastFocused
        : trigger;

      if (targetFocus && typeof targetFocus.focus === 'function') {
        try {
          targetFocus.focus();
        } catch (_) {}
      }
      this.lastFocused = null;
    }
  }

  window.ArcadePlaylists = new PlaylistManager();
})();
