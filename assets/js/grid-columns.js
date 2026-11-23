/**
 * Responsive Grid Column Density Switcher (#1395)
 * Controls 2, 3, or 4 column grid density via CSS variable --catalog-columns,
 * persisted in localStorage under av_catalog_columns.
 */

class GridColumnsManager {
    constructor() {
        this.storageKey = 'av_catalog_columns';
        this.currentColumns = 3; // Default 3 columns on desktop
    }

    init() {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && ['2', '3', '4'].includes(saved)) {
                this.currentColumns = parseInt(saved, 10);
            }
        }
        this.applyColumns(this.currentColumns);
    }

    setColumns(cols) {
        const count = parseInt(cols, 10);
        if (![2, 3, 4].includes(count)) return false;
        this.currentColumns = count;

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(this.storageKey, count.toString());
            } catch (e) {}
        }

        this.applyColumns(count);
        return true;
    }

    applyColumns(count) {
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--catalog-col-count', count.toString());
            document.documentElement.setAttribute('data-grid-cols', count.toString());
        }
    }

    bindControls(containerElement) {
        if (!containerElement) return;

        const buttons = containerElement.querySelectorAll('[data-cols]');
        buttons.forEach(btn => {
            const cols = parseInt(btn.getAttribute('data-cols'), 10);
            if (cols === this.currentColumns) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }

            btn.addEventListener('click', () => {
                this.setColumns(cols);
                buttons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            });
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GridColumnsManager };
}

if (typeof window !== 'undefined') {
    window.GridColumnsManager = GridColumnsManager;
}
