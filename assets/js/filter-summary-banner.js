/**
 * Catalog Empty Filter Reset Banner & Summary Chips (#1547)
 * Tracks active category, tag, and search query filters, renders removable chips,
 * and presents a 1-click reset banner when filtered results match zero games.
 */

class FilterSummaryManager {
    constructor(options = {}) {
        this.activeFilters = {
            search: '',
            category: '',
            tag: ''
        };
        this.onResetCallback = options.onReset || null;
    }

    setFilter(type, value) {
        if (type in this.activeFilters) {
            this.activeFilters[type] = (value || '').trim();
            return true;
        }
        return false;
    }

    removeFilter(type) {
        if (type in this.activeFilters) {
            this.activeFilters[type] = '';
            return true;
        }
        return false;
    }

    clearAll() {
        Object.keys(this.activeFilters).forEach((k) => {
            this.activeFilters[k] = '';
        });
        if (typeof this.onResetCallback === 'function') {
            this.onResetCallback();
        }
    }

    hasActiveFilters() {
        return Object.values(this.activeFilters).some((v) => Boolean(v));
    }

    renderSummaryChips(container, onFilterChange) {
        if (!container || typeof document === 'undefined') return null;

        container.innerHTML = '';
        if (!this.hasActiveFilters()) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'active-filters-bar';

        Object.entries(this.activeFilters).forEach(([type, value]) => {
            if (!value) return;

            const chip = document.createElement('div');
            chip.className = 'active-filter-chip';
            chip.innerHTML = `
                <span>${type}: <strong>${value}</strong></span>
                <button class="filter-chip-remove" aria-label="Remove ${type} filter">&times;</button>
            `;

            chip.querySelector('.filter-chip-remove').addEventListener('click', () => {
                this.removeFilter(type);
                if (typeof onFilterChange === 'function') onFilterChange(this.activeFilters);
            });

            wrapper.appendChild(chip);
        });

        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-all-filters-btn';
        clearBtn.textContent = 'Clear All';
        clearBtn.addEventListener('click', () => {
            this.clearAll();
            if (typeof onFilterChange === 'function') onFilterChange(this.activeFilters);
        });

        wrapper.appendChild(clearBtn);
        container.appendChild(wrapper);
        return wrapper;
    }

    renderEmptyBanner(container, onReset) {
        if (!container || typeof document === 'undefined') return null;

        const banner = document.createElement('div');
        banner.className = 'empty-results-banner';
        banner.innerHTML = `
            <div class="empty-results-title">No Arcade Games Found</div>
            <div class="empty-results-desc">No games match your active filters. Try broadening your criteria or reset all filters.</div>
            <button class="empty-results-reset-btn">Reset All Filters</button>
        `;

        banner.querySelector('.empty-results-reset-btn').addEventListener('click', () => {
            this.clearAll();
            if (typeof onReset === 'function') onReset();
        });

        container.appendChild(banner);
        return banner;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseFilterSummary = new FilterSummaryManager();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FilterSummaryManager };
}
