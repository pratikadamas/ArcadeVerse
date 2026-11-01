/**
 * ArcadeVerse Custom Playlists & Collections Engine
 * Allows players to create named playlists, add/remove games,
 * and filter the catalog or export/import their collections.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_user_playlists';

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

    savePlaylists() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.playlists));
        window.dispatchEvent(new CustomEvent('arcadeverse:playlists-updated', { detail: this.playlists }));
      } catch (e) {
        console.error('Failed to save playlists:', e);
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
              <span class="playlist-name">${pl.name}</span>
              <span class="playlist-count-pill">${pl.games.length} games</span>
            </div>
            ${pl.description ? `<p class="playlist-desc">${pl.description}</p>` : ''}
          </div>
          <div class="playlist-actions-row">
            <button class="btn btn-secondary btn-xs btn-filter-pl" data-id="${pl.id}">
              <i data-lucide="play-circle"></i> View Games
            </button>
            <button class="btn btn-icon btn-xs btn-delete-pl" data-id="${pl.id}" title="Delete Playlist" aria-label="Delete Playlist">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;

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
