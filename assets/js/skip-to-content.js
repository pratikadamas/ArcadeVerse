/**
 * Skip-to-Content Navigation Link & Focus Trapping Indicator (#1379)
 * WCAG 2.4.1 (Bypass Blocks) and WCAG 2.4.7 (Focus Visible) compliance module.
 * Provides accessible skip-navigation targeting #games-grid, high-contrast
 * focus indicators, and accessible keyboard focus trapping for open modals.
 */

class AccessibilitySkipLink {
    constructor(options = {}) {
        this.targetId = options.targetId || 'games-grid';
        this.linkId = options.linkId || 'skip-to-content';
        this.linkText = options.linkText || 'Skip to Game Catalog';
        this.activeModal = null;
        this.previousFocusedElement = null;
    }

    init() {
        if (typeof document === 'undefined') return false;

        let skipLink = document.getElementById(this.linkId);
        if (!skipLink) {
            skipLink = document.createElement('a');
            skipLink.id = this.linkId;
            skipLink.href = `#${this.targetId}`;
            skipLink.className = 'arcade-skip-link';
            skipLink.textContent = this.linkText;
            skipLink.setAttribute('aria-label', this.linkText);
            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.focusTarget();
        });

        skipLink.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.focusTarget();
            }
        });

        return true;
    }

    focusTarget() {
        if (typeof document === 'undefined') return false;
        const target = document.getElementById(this.targetId);
        if (!target) return false;

        if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1');
        }

        target.focus();
        if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return true;
    }

    trapFocusInModal(modalElement) {
        if (!modalElement) return null;
        this.activeModal = modalElement;
        this.previousFocusedElement = typeof document !== 'undefined' ? document.activeElement : null;

        const focusableSelectors = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        const focusableElements = Array.from(modalElement.querySelectorAll(focusableSelectors));
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        const handleKeyDown = (e) => {
            if (e.key !== 'Tab' || !this.activeModal) return;

            const currentFocusables = Array.from(modalElement.querySelectorAll(focusableSelectors));
            if (currentFocusables.length === 0) {
                e.preventDefault();
                return;
            }

            const firstElement = currentFocusables[0];
            const lastElement = currentFocusables[currentFocusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        modalElement.addEventListener('keydown', handleKeyDown);

        return () => {
            modalElement.removeEventListener('keydown', handleKeyDown);
            this.releaseFocus();
        };
    }

    releaseFocus() {
        if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
            this.previousFocusedElement.focus();
        }
        this.activeModal = null;
        this.previousFocusedElement = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AccessibilitySkipLink };
}

if (typeof window !== 'undefined') {
    window.AccessibilitySkipLink = AccessibilitySkipLink;
}
