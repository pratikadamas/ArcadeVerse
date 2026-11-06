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
          <div class="playlist-drawer-panel" role="dialog" aria-label="Game Playlists & Collections">
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

        const close = () => {
          drawer.classList.remove('open');
          drawer.setAttribute('aria-hidden', 'true');
        };

        if (closeBtn) closeBtn.addEventListener('click', close);
        if (backdrop) backdrop.addEventListener('click', close);
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
      }

      this.updateDrawerList();
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

        const viewBtn = item.querySelector('.btn-filter-pl');
        if (viewBtn) {
          viewBtn.addEventListener('click', () => {
            this.activePlaylistId = pl.id;
            window.dispatchEvent(new CustomEvent('arcadeverse:filter-playlist', { detail: pl }));
            const drawer = document.getElementById('playlist-drawer');
            if (drawer) drawer.classList.remove('open');
          });
        }

        const delBtn = item.querySelector('.btn-delete-pl');
        if (delBtn) {
          delBtn.addEventListener('click', () => {
            if (confirm(`Delete playlist "${pl.name}"?`)) {
              this.deletePlaylist(pl.id);
              this.updateDrawerList();
            }
          });
        }

        container.appendChild(item);
      });

      if (window.lucide) lucide.createIcons();
    }

    openDrawer() {
      const drawer = document.getElementById('playlist-drawer');
      if (drawer) {
        this.updateDrawerList();
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
      }
    }
  }

  window.ArcadePlaylists = new PlaylistManager();
})();
