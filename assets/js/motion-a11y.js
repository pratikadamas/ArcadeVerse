/**
 * Global Accessibility Motion Preference & SDK Bridge (#698)
 * WCAG 2.3.3 (Animation from Interactions) compliance module.
 * Exposes arcadeverse.a11y.prefersReducedMotion() helper, broadcasts
 * reduced motion flags to game iframes, and manages screen-shake suppression.
 */

class MotionAccessibilityManager {
    constructor() {
        this.mediaQuery = typeof window !== 'undefined' && window.matchMedia
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;
        this.isReduced = this.mediaQuery ? this.mediaQuery.matches : false;
        this.listeners = new Set();
    }

    init() {
        if (!this.mediaQuery) return;

        this.isReduced = this.mediaQuery.matches;

        // Modern and legacy event listener fallback
        if (typeof this.mediaQuery.addEventListener === 'function') {
            this.mediaQuery.addEventListener('change', (e) => this.handleMotionChange(e.matches));
        } else if (typeof this.mediaQuery.addListener === 'function') {
            this.mediaQuery.addListener((e) => this.handleMotionChange(e.matches));
        }

        this.applyGlobalMotionState(this.isReduced);
    }

    handleMotionChange(matches) {
        this.isReduced = Boolean(matches);
        this.applyGlobalMotionState(this.isReduced);
        this.listeners.forEach(cb => {
            try { cb(this.isReduced); } catch (e) {}
        });
        this.broadcastToActiveIframes();
    }

    applyGlobalMotionState(reduced) {
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.setAttribute('data-reduced-motion', reduced.toString());
            if (reduced) {
                document.body.classList.add('reduce-motion-active');
            } else {
                document.body.classList.remove('reduce-motion-active');
            }
        }
    }

    prefersReducedMotion() {
        if (this.mediaQuery) {
            return this.mediaQuery.matches;
        }
        return this.isReduced;
    }

    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
            callback(this.prefersReducedMotion());
            return () => this.listeners.delete(callback);
        }
        return () => {};
    }

    broadcastToActiveIframes() {
        if (typeof document === 'undefined') return;
        const iframes = document.querySelectorAll('iframe.game-iframe, #game-iframe');
        const message = {
            type: 'ARCADEVERSE_A11Y_SETTINGS',
            prefersReducedMotion: this.prefersReducedMotion()
        };

        iframes.forEach(frame => {
            if (frame.contentWindow && typeof frame.contentWindow.postMessage === 'function') {
                frame.contentWindow.postMessage(message, '*');
            }
        });
    }

    applyScreenShake(element, intensity = 5) {
        if (this.prefersReducedMotion() || !element) {
            // Completely bypass screen-shake when reduced motion is preferred
            return;
        }

        element.style.transform = `translate(${(Math.random() - 0.5) * intensity}px, ${(Math.random() - 0.5) * intensity}px)`;
        setTimeout(() => {
            if (element) element.style.transform = '';
        }, 50);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MotionAccessibilityManager };
}

if (typeof window !== 'undefined') {
    window.MotionAccessibilityManager = MotionAccessibilityManager;
    window.ArcadeVerse = window.ArcadeVerse || {};
    window.ArcadeVerse.a11y = window.ArcadeVerse.a11y || {};
    window.ArcadeVerse.a11y.motion = new MotionAccessibilityManager();
    window.ArcadeVerse.a11y.prefersReducedMotion = () => window.ArcadeVerse.a11y.motion.prefersReducedMotion();
}
