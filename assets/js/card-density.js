/**
 * Catalog Card Density Switcher Controller (#1538)
 * Toggles catalog card layout between Cozy, Standard, and Compact modes.
 * Persists user preference in localStorage (arcadeverse_card_density).
 */

class CardDensityManager {
    static STORAGE_KEY = 'arcadeverse_card_density';
    static MODES = ['cozy', 'standard', 'compact'];
    static DEFAULT_MODE = 'standard';

    constructor() {
        this.currentMode = this.loadPreference();
    }

    loadPreference() {
        if (typeof localStorage === 'undefined') {
            return CardDensityManager.DEFAULT_MODE;
        }
        const saved = localStorage.getItem(CardDensityManager.STORAGE_KEY);
        return CardDensityManager.MODES.includes(saved) ? saved : CardDensityManager.DEFAULT_MODE;
    }

    setMode(mode) {
        if (!CardDensityManager.MODES.includes(mode)) {
            return false;
        }
        this.currentMode = mode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(CardDensityManager.STORAGE_KEY, mode);
        }
        this.applyToDOM();
        return true;
    }

    getMode() {
        return this.currentMode;
    }

    applyToDOM() {
        if (typeof document === 'undefined') return;
        const grid = document.getElementById('games-grid') || document.querySelector('.games-grid');
        if (grid) {
            CardDensityManager.MODES.forEach((m) => {
                grid.classList.remove(`density-${m}`);
            });
            grid.classList.add(`density-${this.currentMode}`);
        }

        const buttons = document.querySelectorAll('.density-btn');
        buttons.forEach((btn) => {
            const btnMode = btn.getAttribute('data-density');
            if (btnMode === this.currentMode) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    renderControls(container) {
        if (!container || typeof document === 'undefined') return null;

        const nav = document.createElement('div');
        nav.className = 'density-control-bar';
        nav.setAttribute('role', 'group');
        nav.setAttribute('aria-label', 'Card Grid Density');

        CardDensityManager.MODES.forEach((mode) => {
            const btn = document.createElement('button');
            btn.className = `density-btn ${mode === this.currentMode ? 'active' : ''}`;
            btn.setAttribute('data-density', mode);
            btn.setAttribute('aria-pressed', mode === this.currentMode ? 'true' : 'false');
            btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);

            btn.addEventListener('click', () => {
                this.setMode(mode);
            });
            nav.appendChild(btn);
        });

        container.appendChild(nav);
        return nav;
    }

    init() {
        this.applyToDOM();
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const mgr = new CardDensityManager();
        mgr.init();
        window.arcadeVerseCardDensity = mgr;
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardDensityManager };
}
