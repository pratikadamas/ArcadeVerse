/**
 * ArcadeVerse — Recently Played & Quick Resume Drawer
 * Tracks recently played games in localStorage and provides instant resume buttons
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_recently_played_v2';
  const MAX_HISTORY = 6;

  const ArcadeRecent = {
    getRecent() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },

    saveRecent(list) {
      const payload = JSON.stringify(list.slice(0, MAX_HISTORY));
      if (window.ArcadeStorageResilience && typeof window.ArcadeStorageResilience.safeSetItem === 'function') {
        window.ArcadeStorageResilience.safeSetItem(STORAGE_KEY, payload);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, payload);
        } catch (e) {
          console.warn('Could not save recently played history:', e);
        }
      }
    },

    recordPlayed(gameId, title, category) {
      if (!gameId) return;
      let history = this.getRecent();

      // Deduplicate: remove existing entry for this game
      history = history.filter(item => item.id !== gameId);

      // Prepend to top with current timestamp
      history.unshift({
        id: gameId,
        title: title || gameId,
        category: category || 'Arcade',
        timestamp: Date.now()
      });

      this.saveRecent(history);
      this.render();
    },

    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      this.render();
    },

    formatTimeAgo(timestamp) {
      if (!timestamp) return 'Recent';
      const diffSec = Math.floor((Date.now() - timestamp) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.floor(diffHour / 24);
      return `${diffDays}d ago`;
    },

    render() {
      const mount = document.getElementById('recently-played-mount');
      if (!mount) return;

      const items = this.getRecent();

      if (items.length === 0) {
        mount.innerHTML = '';
        mount.style.display = 'none';
        return;
      }

      mount.style.display = 'block';
      mount.innerHTML = `
        <section class="recently-played-section" aria-label="Recently Played Games">
          <div class="recently-played-container">
            <div class="recently-played-header">
              <div class="recent-header-left">
                <span class="recent-pulse-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </span>
                <h2 class="recently-played-title">
                  Quick Resume <span class="recent-badge-count">${items.length}</span>
                </h2>
              </div>
              <div class="recent-header-actions">
                <button type="button" class="btn-clear-recent" id="btn-clear-recent-history" title="Clear Recently Played History">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                  <span>Clear History</span>
                </button>
              </div>
            </div>

            <div class="recently-played-grid">
              ${items.map(item => `
                <div class="recent-game-card" data-game-id="${item.id}">
                  <div class="recent-card-top">
                    <span class="recent-game-tag">${item.category}</span>
                    <span class="recent-game-time">${this.formatTimeAgo(item.timestamp)}</span>
                  </div>
                  <h3 class="recent-game-title" title="${item.title}">${item.title}</h3>
                  <button type="button" class="btn-recent-play" data-game-id="${item.id}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Resume</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      `;

      // Clear button listener
      const clearBtn = mount.querySelector('#btn-clear-recent-history');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (confirm('Clear your recently played arcade history?')) {
            this.clear();
          }
        });
      }

      // Resume button listeners
      mount.querySelectorAll('.btn-recent-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const gameId = btn.getAttribute('data-game-id');
          if (window.ArcadeApp && typeof window.ArcadeApp.openGame === 'function') {
            window.ArcadeApp.openGame(gameId);
          } else if (typeof window.openGameModal === 'function' && typeof GAMES_REGISTRY !== 'undefined') {
            const found = GAMES_REGISTRY.find(g => g.id === gameId);
            if (found) window.openGameModal(found, btn);
          }
        });
      });
    }
  };

  window.ArcadeRecent = ArcadeRecent;

  document.addEventListener('DOMContentLoaded', () => {
    ArcadeRecent.render();
  });
})();
