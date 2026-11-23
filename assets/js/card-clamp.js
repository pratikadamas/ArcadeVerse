/**
 * Game Description Expandable Accordion Helper (#1392)
 * Inspects description paragraphs, attaches 'More...' expanders when overflowing 2 lines,
 * and manages aria-expanded accessibility states.
 */

class CardClampManager {
    constructor(selector = '.card-desc-container') {
        this.selector = selector;
    }

    init() {
        if (typeof document === 'undefined') return;
        const containers = document.querySelectorAll(this.selector);
        containers.forEach(c => this.enhance(c));
    }

    enhance(container) {
        if (!container) return;
        const p = container.querySelector('.card-desc-clamped');
        if (!p) return;

        // Check if text overflows 2 lines (approx 45px or scrollHeight > clientHeight)
        const isOverflowing = p.scrollHeight > (p.clientHeight + 4);

        if (isOverflowing && !container.querySelector('.card-read-more-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-read-more-btn';
            btn.setAttribute('aria-expanded', 'false');
            btn.textContent = 'More...';

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = container.classList.toggle('expanded');
                btn.setAttribute('aria-expanded', isExpanded.toString());
                btn.textContent = isExpanded ? 'Less' : 'More...';
            });

            container.appendChild(btn);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardClampManager };
}

if (typeof window !== 'undefined') {
    window.CardClampManager = CardClampManager;
}
