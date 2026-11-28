/**
 * Interactive Game Card Pin-to-Top Sticky Showcase Controller (#1557)
 * Allows players to pin up to 3 favorite games into a dedicated showcase tray
 * above the catalog grid, persisted in localStorage (arcadeverse_pinned_games).
 */

class PinnedShowcaseManager {
    static STORAGE_KEY = 'arcadeverse_pinned_games';
    static MAX_PINNED = 3;

    constructor() {
        this.pinnedIds = this.loadPinned();
    }

    loadPinned() {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(PinnedShowcaseManager.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    savePinned() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PinnedShowcaseManager.STORAGE_KEY, JSON.stringify(this.pinnedIds));
        }
    }

    isPinned(gameId) {
        return this.pinnedIds.includes(gameId);
    }

    togglePin(gameId) {
        if (!gameId) return false;
        const idx = this.pinnedIds.indexOf(gameId);
        if (idx !== -1) {
            this.pinnedIds.splice(idx, 1);
            this.savePinned();
            return false;
        }

        if (this.pinnedIds.length >= PinnedShowcaseManager.MAX_PINNED) {
            return null; // Quota full
        }

        this.pinnedIds.push(gameId);
        this.savePinned();
        return true;
    }

    getPinnedIds() {
        return [...this.pinnedIds];
    }

    renderShowcase(container, allGames, onLaunchGame) {
        if (!container || typeof document === 'undefined') return null;

        container.innerHTML = '';
        if (this.pinnedIds.length === 0) return null;

        const tray = document.createElement('div');
        tray.className = 'pinned-showcase-tray';
        tray.innerHTML = `
            <div class="pinned-showcase-header">
                <span class="pinned-showcase-title">Pinned Showcase (${this.pinnedIds.length}/${PinnedShowcaseManager.MAX_PINNED})</span>
            </div>
            <div class="pinned-showcase-grid"></div>
        `;

        const grid = tray.querySelector('.pinned-showcase-grid');
        this.pinnedIds.forEach((id) => {
            const game = (allGames || []).find((g) => g.id === id || g.title === id) || { id, title: id };
            const card = document.createElement('div');
            card.className = 'pinned-card-item';
            card.innerHTML = `
                <span class="pinned-card-title">${game.title || id}</span>
                <button class="pin-toggle-btn pinned" aria-label="Unpin ${game.title || id}">Unpin</button>
            `;

            card.querySelector('.pin-toggle-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePin(id);
                this.renderShowcase(container, allGames, onLaunchGame);
            });

            card.addEventListener('click', () => {
                if (typeof onLaunchGame === 'function') onLaunchGame(game);
            });

            grid.appendChild(card);
        });

        container.appendChild(tray);
        return tray;
    }
}

if (typeof document !== 'undefined') {
    window.arcadeVersePinnedShowcase = new PinnedShowcaseManager();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PinnedShowcaseManager };
}
