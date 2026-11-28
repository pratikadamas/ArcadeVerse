/**
 * Per-Game Personal Best Score Split History Log Controller (#1553)
 * Records incremental high score improvements, computes score delta improvements (+XYZ points),
 * timestamps record progression, and caps per-game log at 20 entries.
 */

class ScoreHistoryManager {
    static STORAGE_PREFIX = 'arcadeverse_score_history_';
    static MAX_ENTRIES = 20;

    constructor() {}

    getStorageKey(gameId) {
        return `${ScoreHistoryManager.STORAGE_PREFIX}${gameId || 'default'}`;
    }

    getHistory(gameId) {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(this.getStorageKey(gameId));
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    recordScore(gameId, score) {
        const numScore = Number(score) || 0;
        const history = this.getHistory(gameId);
        const lastBest = history.length > 0 ? history[0].score : 0;

        // Only log if it's a new personal milestone (higher than previous best)
        if (history.length > 0 && numScore <= lastBest) {
            return { recorded: false, reason: 'Not a personal best', history };
        }

        const delta = history.length > 0 ? numScore - lastBest : numScore;
        const entry = {
            id: Date.now().toString(36),
            score: numScore,
            delta,
            timestamp: Date.now(),
            dateFormatted: new Date().toLocaleDateString()
        };

        history.unshift(entry);
        if (history.length > ScoreHistoryManager.MAX_ENTRIES) {
            history.length = ScoreHistoryManager.MAX_ENTRIES;
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.getStorageKey(gameId), JSON.stringify(history));
        }

        return { recorded: true, entry, history };
    }

    clearHistory(gameId) {
        if (typeof localStorage === 'undefined') return false;
        localStorage.removeItem(this.getStorageKey(gameId));
        return true;
    }
}

if (typeof document !== 'undefined') {
    window.arcadeVerseScoreHistory = new ScoreHistoryManager();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScoreHistoryManager };
}
