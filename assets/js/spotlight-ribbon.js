/**
 * New Releases & Spotlight Ribbon Controller (#1540)
 * Evaluates game metadata (release date, play counts, featured flags)
 * and attaches styled corner spotlight ribbons to qualifying game cards.
 */

class SpotlightRibbonManager {
    constructor(options = {}) {
        this.newThresholdDays = options.newThresholdDays || 14;
        this.hotPlaysThreshold = options.hotPlaysThreshold || 500;
    }

    isNewRelease(dateString) {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return false;
        const diffMs = Date.now() - date.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= this.newThresholdDays;
    }

    determineRibbonType(game) {
        if (!game) return null;
        if (game.featured) {
            return { type: 'featured', text: 'FEATURED', class: 'ribbon-featured' };
        }
        if (game.dateAdded && this.isNewRelease(game.dateAdded)) {
            return { type: 'new', text: 'NEW', class: 'ribbon-new ribbon-animated' };
        }
        if (typeof game.plays === 'number' && game.plays >= this.hotPlaysThreshold) {
            return { type: 'hot', text: 'HOT', class: 'ribbon-hot' };
        }
        return null;
    }

    createRibbonElement(ribbonData) {
        if (!ribbonData || typeof document === 'undefined') return null;

        const ribbon = document.createElement('div');
        ribbon.className = `game-spotlight-ribbon ${ribbonData.class || ''}`;
        ribbon.setAttribute('aria-label', ribbonData.text);
        ribbon.textContent = ribbonData.text;
        return ribbon;
    }

    applyToCard(cardElement, game) {
        if (!cardElement || !game || typeof document === 'undefined') return false;

        cardElement.classList.add('game-card-ribbon-wrapper');
        const existing = cardElement.querySelector('.game-spotlight-ribbon');
        if (existing) {
            existing.remove();
        }

        const ribbonData = this.determineRibbonType(game);
        if (!ribbonData) return false;

        const ribbonElem = this.createRibbonElement(ribbonData);
        if (ribbonElem) {
            cardElement.appendChild(ribbonElem);
            return true;
        }
        return false;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseSpotlight = new SpotlightRibbonManager();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpotlightRibbonManager };
}
