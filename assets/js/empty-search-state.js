/**
 * Empty Search State with Smart Did-You-Mean Suggestions & Randomizer (#1382)
 * Pure vanilla JavaScript Levenshtein distance matcher and retro empty state generator.
 */

class EmptySearchManager {
    constructor(gameRegistry = []) {
        this.games = gameRegistry;
    }

    setRegistry(games) {
        this.games = Array.isArray(games) ? games : [];
    }

    levenshtein(a, b) {
        const al = a.length;
        const bl = b.length;
        if (al === 0) return bl;
        if (bl === 0) return al;

        const matrix = [];
        for (let i = 0; i <= al; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= bl; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= al; i++) {
            for (let j = 1; j <= bl; j++) {
                const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,       // deletion
                    matrix[i][j - 1] + 1,       // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        return matrix[al][bl];
    }

    findDidYouMean(query, maxDistance = 3) {
        if (!query || typeof query !== 'string' || !this.games.length) return null;
        const q = query.trim().toLowerCase();
        if (q.length < 2) return null;

        let closestMatch = null;
        let lowestDist = Infinity;

        for (const game of this.games) {
            const title = (game.title || game.name || '').toLowerCase();
            if (!title) continue;

            const dist = this.levenshtein(q, title);
            if (dist < lowestDist && dist <= maxDistance) {
                lowestDist = dist;
                closestMatch = game.title || game.name;
            }

            // Also check individual words in titles
            const words = title.split(/\s+/);
            for (const w of words) {
                if (w.length >= 3) {
                    const wDist = this.levenshtein(q, w);
                    if (wDist < lowestDist && wDist <= Math.min(2, maxDistance)) {
                        lowestDist = wDist;
                        closestMatch = game.title || game.name;
                    }
                }
            }
        }

        return closestMatch;
    }

    getRandomGame() {
        if (!this.games.length) return null;
        const index = Math.floor(Math.random() * this.games.length);
        return this.games[index];
    }

    generateEmptyStateHtml(query) {
        const suggestion = this.findDidYouMean(query);
        const randomGame = this.getRandomGame();

        return `
            <div class="empty-search-container" role="status">
                <div class="empty-search-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ff0055" stroke-width="1.5">
                        <rect x="2" y="3" width="20" height="18" rx="2"></rect>
                        <line x1="6" y1="8" x2="18" y2="8"></line>
                        <line x1="6" y1="12" x2="18" y2="12"></line>
                        <line x1="6" y1="16" x2="12" y2="16"></line>
                    </svg>
                </div>
                <h3 class="empty-search-title">NO MATCHING GAMES FOUND</h3>
                <p class="empty-search-desc">We couldn't find any games matching "<strong>${query || ''}</strong>".</p>
                ${suggestion ? `
                    <div class="empty-search-suggestion">
                        <span>Did you mean:</span>
                        <button class="suggestion-link" data-query="${suggestion}">${suggestion}</button>
                    </div>
                ` : ''}
                <div class="empty-search-actions">
                    <button class="empty-action-reset">Clear Search</button>
                    ${randomGame ? `<button class="empty-action-random" data-id="${randomGame.id || ''}">Play Random Game</button>` : ''}
                </div>
            </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EmptySearchManager };
}

if (typeof window !== 'undefined') {
    window.EmptySearchManager = EmptySearchManager;
}
