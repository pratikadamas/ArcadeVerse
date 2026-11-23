/**
 * Game Card Favorite Star Micro-Interaction & Sparkle Burst Engine (#1388)
 * Handles star pop animations, dynamic radial particle bursts, and screen reader live region alerts.
 */

class FavoriteAnimationManager {
    constructor() {
        this.announcerElement = null;
    }

    init() {
        if (typeof document === 'undefined') return;

        let announcer = document.getElementById('favorite-a11y-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'favorite-a11y-announcer';
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.className = 'sr-only';
            document.body.appendChild(announcer);
        }
        this.announcerElement = announcer;
    }

    animateFavorite(buttonElement, isFavorited, gameTitle = 'Game') {
        if (!buttonElement) return;

        // Toggle state classes
        buttonElement.classList.remove('star-pop-active');
        // Force reflow
        void buttonElement.offsetWidth;
        buttonElement.classList.add('star-pop-active');

        if (isFavorited) {
            buttonElement.classList.add('favorited');
            this.spawnSparkleBurst(buttonElement);
            this.announce(`${gameTitle} added to favorites`);
        } else {
            buttonElement.classList.remove('favorited');
            this.announce(`${gameTitle} removed from favorites`);
        }
    }

    spawnSparkleBurst(parentElement) {
        if (!parentElement || typeof document === 'undefined') return;

        const burstContainer = document.createElement('div');
        burstContainer.className = 'favorite-sparkle-burst';

        const particleCount = 6;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = 24; // px
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            const p = document.createElement('span');
            p.className = 'sparkle-particle';
            p.style.setProperty('--tx', `${tx.toFixed(1)}px`);
            p.style.setProperty('--ty', `${ty.toFixed(1)}px`);
            burstContainer.appendChild(p);
        }

        parentElement.appendChild(burstContainer);

        setTimeout(() => {
            if (burstContainer.parentNode) {
                burstContainer.parentNode.removeChild(burstContainer);
            }
        }, 450);
    }

    announce(message) {
        if (this.announcerElement) {
            this.announcerElement.textContent = message;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FavoriteAnimationManager };
}

if (typeof window !== 'undefined') {
    window.FavoriteAnimationManager = FavoriteAnimationManager;
}
