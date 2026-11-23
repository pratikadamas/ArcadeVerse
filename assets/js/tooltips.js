/**
 * Arcade Badge Tooltip Micro-Animations & Dynamic Arrow Positioning (#1383)
 * Dynamic viewport boundary collision detection for data-tooltip badges.
 * Flips tooltips from top to bottom when near viewport edges and synchronizes aria-label.
 */

class TooltipEngine {
    constructor(selector = '[data-tooltip]') {
        this.selector = selector;
        this.activeElements = new Set();
    }

    init() {
        if (typeof document === 'undefined') return;

        const elements = document.querySelectorAll(this.selector);
        elements.forEach(el => this.bind(el));

        // Global event delegation for dynamically inserted cards
        document.body.addEventListener('mouseenter', (e) => {
            const target = e.target.closest(this.selector);
            if (target && !this.activeElements.has(target)) {
                this.bind(target);
                this.calculatePlacement(target);
            } else if (target) {
                this.calculatePlacement(target);
            }
        }, true);

        document.body.addEventListener('focusin', (e) => {
            const target = e.target.closest(this.selector);
            if (target) {
                this.calculatePlacement(target);
            }
        }, true);
    }

    bind(element) {
        if (!element) return;
        this.activeElements.add(element);

        // Ensure accessibility
        const text = element.getAttribute('data-tooltip');
        if (text && !element.hasAttribute('aria-label')) {
            element.setAttribute('aria-label', text);
        }
    }

    calculatePlacement(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') return 'top';

        const rect = element.getBoundingClientRect();
        const topSpace = rect.top;
        const bottomSpace = (typeof window !== 'undefined' ? window.innerHeight : 800) - rect.bottom;

        // If less than 45px clearance above, flip placement to bottom
        let placement = 'top';
        if (topSpace < 45 && bottomSpace >= 45) {
            placement = 'bottom';
        } else if (rect.left < 50) {
            placement = 'right';
        } else if ((typeof window !== 'undefined' ? window.innerWidth : 1200) - rect.right < 50) {
            placement = 'left';
        }

        element.setAttribute('data-tooltip-pos', placement);
        return placement;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TooltipEngine };
}

if (typeof window !== 'undefined') {
    window.TooltipEngine = TooltipEngine;
}
