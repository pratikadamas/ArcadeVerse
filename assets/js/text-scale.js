/**
 * Dynamic Text Size Scale Adjuster (#1389)
 * Segmented scale switcher (Small 0.875, Default 1.0, Large 1.15, Extra Large 1.3)
 * mapped to CSS custom property --base-text-scale and persisted in localStorage.
 */

class TextScaleManager {
    constructor() {
        this.storageKey = 'av_text_scale';
        this.scales = {
            'small': 0.875,
            'default': 1.0,
            'large': 1.15,
            'xlarge': 1.3
        };
        this.currentScale = 'default';
    }

    init() {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && this.scales[saved]) {
                this.currentScale = saved;
            }
        }
        this.applyScale(this.currentScale);
    }

    setScale(scaleKey) {
        if (!this.scales[scaleKey]) return false;
        this.currentScale = scaleKey;

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(this.storageKey, scaleKey);
            } catch (e) {}
        }

        this.applyScale(scaleKey);
        return true;
    }

    applyScale(scaleKey) {
        const factor = this.scales[scaleKey] || 1.0;
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--base-text-scale', factor.toString());
            document.documentElement.setAttribute('data-text-scale', scaleKey);
        }
    }

    bindControls(containerElement) {
        if (!containerElement) return;

        const buttons = containerElement.querySelectorAll('[data-scale]');
        buttons.forEach(btn => {
            const key = btn.getAttribute('data-scale');
            if (key === this.currentScale) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }

            btn.addEventListener('click', () => {
                this.setScale(key);
                buttons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            });
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TextScaleManager };
}

if (typeof window !== 'undefined') {
    window.TextScaleManager = TextScaleManager;
}
