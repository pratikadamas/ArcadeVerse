/**
 * Auto-Scroll to Active Filtered Category Section (#1390)
 * Intelligently scrolls viewport to #games-grid with sticky navbar offset compensation
 * only when the catalog is outside the visible viewport window.
 */

class CatalogAutoScroll {
    constructor(options = {}) {
        this.targetSelector = options.targetSelector || '#games-grid';
        this.navbarOffset = options.navbarOffset !== undefined ? options.navbarOffset : 80;
    }

    shouldScroll(targetElement) {
        if (!targetElement || typeof targetElement.getBoundingClientRect !== 'function') return false;
        const rect = targetElement.getBoundingClientRect();
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

        // If top of grid is above the navbar or below 75% of viewport, scrolling is beneficial
        return rect.top < this.navbarOffset || rect.top > (vh * 0.75);
    }

    scrollToGrid(force = false) {
        if (typeof document === 'undefined') return false;
        const target = document.querySelector(this.targetSelector);
        if (!target) return false;

        if (force || this.shouldScroll(target)) {
            const rect = target.getBoundingClientRect();
            const currentScrollY = typeof window !== 'undefined' ? (window.pageYOffset || window.scrollY || 0) : 0;
            const targetY = currentScrollY + rect.top - this.navbarOffset;

            // Check reduced motion
            const prefersReduced = typeof window !== 'undefined' &&
                window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                window.scrollTo({
                    top: Math.max(0, targetY),
                    behavior: prefersReduced ? 'auto' : 'smooth'
                });
            }
            return true;
        }
        return false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CatalogAutoScroll };
}

if (typeof window !== 'undefined') {
    window.CatalogAutoScroll = CatalogAutoScroll;
}
