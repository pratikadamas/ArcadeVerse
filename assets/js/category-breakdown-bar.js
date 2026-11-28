/**
 * Catalog Header Game Count & Category Breakdown Bar Controller (#1555)
 * Analyzes total game counts and category distribution proportions,
 * rendering a colorful segmented horizontal bar and interactive category legend.
 */

class CategoryBreakdownManager {
    static GENRE_COLORS = {
        action: '#ff0055',
        arcade: '#00f0ff',
        puzzle: '#a371f7',
        racing: '#ff9900',
        retro: '#2ea043',
        strategy: '#e3b341',
        other: '#58a6ff'
    };

    static calculateBreakdown(games) {
        if (!Array.isArray(games) || games.length === 0) {
            return { total: 0, categories: [] };
        }

        const counts = {};
        games.forEach((game) => {
            const cat = (game.category || game.genre || 'other').trim().toLowerCase();
            const key = CategoryBreakdownManager.GENRE_COLORS[cat] ? cat : 'other';
            counts[key] = (counts[key] || 0) + 1;
        });

        const total = games.length;
        const categories = Object.entries(counts).map(([name, count]) => {
            const percentage = Math.round((count / total) * 100);
            return {
                name,
                count,
                percentage,
                color: CategoryBreakdownManager.GENRE_COLORS[name] || CategoryBreakdownManager.GENRE_COLORS.other
            };
        }).sort((a, b) => b.count - a.count);

        return { total, categories };
    }

    render(container, games) {
        if (!container || typeof document === 'undefined') return null;

        const { total, categories } = CategoryBreakdownManager.calculateBreakdown(games);

        const card = document.createElement('div');
        card.className = 'category-breakdown-card';

        let barSegmentsHtml = '';
        let legendItemsHtml = '';

        categories.forEach((cat) => {
            barSegmentsHtml += `<div class="breakdown-segment" style="width: ${cat.percentage}%; background-color: ${cat.color};" title="${cat.name}: ${cat.count} (${cat.percentage}%)"></div>`;
            legendItemsHtml += `
                <div class="breakdown-legend-item">
                    <span class="breakdown-legend-dot" style="background-color: ${cat.color};"></span>
                    <span>${cat.name} <strong>(${cat.count})</strong></span>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="breakdown-header">
                <span class="breakdown-total-count">Catalog Overview: ${total} Games</span>
            </div>
            <div class="breakdown-segmented-bar">${barSegmentsHtml}</div>
            <div class="breakdown-legend">${legendItemsHtml}</div>
        `;

        container.appendChild(card);
        return card;
    }
}

if (typeof document !== 'undefined') {
    window.arcadeVerseBreakdown = new CategoryBreakdownManager();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CategoryBreakdownManager };
}
