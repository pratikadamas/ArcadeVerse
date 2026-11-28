/**
 * Catalog Sort Direction Inverter & Multi-Field Sorter (#1539)
 * Supports multi-field sorting (title, plays, rating, dateAdded)
 * and ASC / DESC inversion with localStorage persistence.
 */

class CatalogSortManager {
    static STORAGE_KEY = 'arcadeverse_catalog_sort';
    static DEFAULT_CONFIG = {
        field: 'title',
        direction: 'asc'
    };

    static VALID_FIELDS = ['title', 'plays', 'rating', 'dateAdded'];

    constructor() {
        this.config = this.loadConfig();
    }

    loadConfig() {
        if (typeof localStorage === 'undefined') {
            return { ...CatalogSortManager.DEFAULT_CONFIG };
        }
        try {
            const raw = localStorage.getItem(CatalogSortManager.STORAGE_KEY);
            if (!raw) return { ...CatalogSortManager.DEFAULT_CONFIG };
            const parsed = JSON.parse(raw);
            return {
                field: CatalogSortManager.VALID_FIELDS.includes(parsed.field) ? parsed.field : 'title',
                direction: parsed.direction === 'desc' ? 'desc' : 'asc'
            };
        } catch (e) {
            return { ...CatalogSortManager.DEFAULT_CONFIG };
        }
    }

    saveConfig() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(CatalogSortManager.STORAGE_KEY, JSON.stringify(this.config));
        }
    }

    setField(field) {
        if (!CatalogSortManager.VALID_FIELDS.includes(field)) return false;
        this.config.field = field;
        this.saveConfig();
        return true;
    }

    toggleDirection() {
        this.config.direction = this.config.direction === 'asc' ? 'desc' : 'asc';
        this.saveConfig();
        return this.config.direction;
    }

    getSortConfig() {
        return { ...this.config };
    }

    sortGames(gamesList) {
        if (!Array.isArray(gamesList)) return [];
        const { field, direction } = this.config;
        const multiplier = direction === 'asc' ? 1 : -1;

        return [...gamesList].sort((a, b) => {
            const valA = a[field];
            const valB = b[field];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return multiplier * valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            }

            const numA = Number(valA) || 0;
            const numB = Number(valB) || 0;
            return multiplier * (numA - numB);
        });
    }

    renderControls(container, onSortChange) {
        if (!container || typeof document === 'undefined') return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'catalog-sort-container';

        const select = document.createElement('select');
        select.className = 'catalog-sort-select';
        select.setAttribute('aria-label', 'Sort games by');

        CatalogSortManager.VALID_FIELDS.forEach((f) => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f.charAt(0).toUpperCase() + f.slice(1);
            if (f === this.config.field) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            this.setField(e.target.value);
            if (typeof onSortChange === 'function') onSortChange(this.getSortConfig());
        });

        const invertBtn = document.createElement('button');
        invertBtn.className = 'catalog-sort-invert-btn';
        invertBtn.setAttribute('data-direction', this.config.direction);
        invertBtn.setAttribute('aria-label', `Toggle sort direction, currently ${this.config.direction.toUpperCase()}`);
        invertBtn.innerHTML = `Sort <span class="sort-arrow">^</span>`;

        invertBtn.addEventListener('click', () => {
            const newDir = this.toggleDirection();
            invertBtn.setAttribute('data-direction', newDir);
            invertBtn.setAttribute('aria-label', `Toggle sort direction, currently ${newDir.toUpperCase()}`);
            if (typeof onSortChange === 'function') onSortChange(this.getSortConfig());
        });

        wrapper.appendChild(select);
        wrapper.appendChild(invertBtn);
        container.appendChild(wrapper);

        return wrapper;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseCatalogSort = new CatalogSortManager();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CatalogSortManager };
}
