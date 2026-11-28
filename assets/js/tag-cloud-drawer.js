/**
 * Game Tag Cloud Discovery Drawer (#1545)
 * Analyzes frequency distributions across catalog tags, assigns 4 size tiers,
 * and allows rapid tag filtering via an accessible bottom drawer.
 */

class TagCloudManager {
    constructor() {
        this.tagCounts = new Map();
        this.activeTag = null;
    }

    calculateFrequencies(games) {
        this.tagCounts.clear();
        if (!Array.isArray(games)) return this.tagCounts;

        games.forEach((game) => {
            const tags = Array.isArray(game.tags) ? game.tags : (game.category ? [game.category] : []);
            tags.forEach((tag) => {
                const norm = String(tag).trim().toLowerCase();
                if (norm) {
                    this.tagCounts.set(norm, (this.tagCounts.get(norm) || 0) + 1);
                }
            });
        });

        return this.tagCounts;
    }

    getTier(count, maxCount) {
        if (!maxCount || count <= 0) return 'tier-1';
        const ratio = count / maxCount;
        if (ratio > 0.75) return 'tier-4';
        if (ratio > 0.50) return 'tier-3';
        if (ratio > 0.25) return 'tier-2';
        return 'tier-1';
    }

    renderChips(container, onSelectTag) {
        if (!container || typeof document === 'undefined') return [];

        container.innerHTML = '';
        let maxCount = 0;
        for (const count of this.tagCounts.values()) {
            if (count > maxCount) maxCount = count;
        }

        const sortedTags = Array.from(this.tagCounts.entries()).sort((a, b) => b[1] - a[1]);
        const chips = [];

        sortedTags.forEach(([tag, count]) => {
            const tier = this.getTier(count, maxCount);
            const chip = document.createElement('button');
            chip.className = `tag-chip ${tier} ${this.activeTag === tag ? 'active' : ''}`;
            chip.setAttribute('data-tag', tag);
            chip.setAttribute('aria-pressed', this.activeTag === tag ? 'true' : 'false');
            chip.innerHTML = `${tag} <span class="tag-count">(${count})</span>`;

            chip.addEventListener('click', () => {
                if (this.activeTag === tag) {
                    this.activeTag = null;
                } else {
                    this.activeTag = tag;
                }
                if (typeof onSelectTag === 'function') {
                    onSelectTag(this.activeTag);
                }
            });

            container.appendChild(chip);
            chips.push(chip);
        });

        return chips;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseTagCloud = new TagCloudManager();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TagCloudManager };
}
