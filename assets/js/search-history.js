/**
 * Recent Search History Pills with One-Click Clear & Local Storage (#1384)
 * Stores non-empty search queries (minimum 3 characters) up to 5 items,
 * rendering accessible pill chips below the search bar with instant click-to-apply and reset.
 */

class SearchHistoryManager {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'av_recent_searches';
        this.maxItems = options.maxItems || 5;
        this.onSelect = options.onSelect || null;
    }

    getHistory() {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(this.storageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    addQuery(query) {
        if (!query || typeof query !== 'string') return false;
        const trimmed = query.trim();
        if (trimmed.length < 3) return false;

        let history = this.getHistory();
        // Remove duplicate if exists
        history = history.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        // Prepend to top
        history.unshift(trimmed);

        if (history.length > this.maxItems) {
            history = history.slice(0, this.maxItems);
        }

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(history));
            } catch (e) {}
        }
        return true;
    }

    clearHistory() {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(this.storageKey);
            } catch (e) {}
        }
    }

    renderPills(container) {
        if (!container) return;
        const history = this.getHistory();

        if (history.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.className = 'recent-searches-bar';

        let html = `<span class="recent-searches-label">Recent:</span><div class="recent-pills-list">`;
        for (const item of history) {
            html += `<button type="button" class="recent-search-pill" data-query="${encodeURIComponent(item)}">${item}</button>`;
        }
        html += `</div><button type="button" class="recent-clear-btn" title="Clear Search History">&times; Clear</button>`;

        container.innerHTML = html;

        const pills = container.querySelectorAll('.recent-search-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                const query = decodeURIComponent(e.target.getAttribute('data-query'));
                if (typeof this.onSelect === 'function') {
                    this.onSelect(query);
                }
            });
        });

        const clearBtn = container.querySelector('.recent-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearHistory();
                this.renderPills(container);
            });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SearchHistoryManager };
}

if (typeof window !== 'undefined') {
    window.SearchHistoryManager = SearchHistoryManager;
}
