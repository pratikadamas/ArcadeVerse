/**
 * High-Contrast Focus Ring Controller (#1489)
 * Manages keyboard focus indicator customization: width (2px, 3px, 4px),
 * color presets (neon-gold, cyber-cyan, high-vis-white), and pulse animation.
 * Persists user preference under 'arcadeverse_focus_ring_pref'.
 */

class A11yFocusRingManager {
    constructor() {
        this.storageKey = 'arcadeverse_focus_ring_pref';
        this.defaults = {
            width: '3px',
            preset: 'cyber-cyan',
            pulse: true
        };
        this.currentSettings = { ...this.defaults };
    }

    init() {
        this.loadSettings();
        this.applySettings();
        this.bindKeyboardDetection();
    }

    loadSettings() {
        if (typeof localStorage === 'undefined') return;
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (['2px', '3px', '4px'].includes(parsed.width)) {
                        this.currentSettings.width = parsed.width;
                    }
                    if (['neon-gold', 'cyber-cyan', 'high-vis-white'].includes(parsed.preset)) {
                        this.currentSettings.preset = parsed.preset;
                    }
                    if (typeof parsed.pulse === 'boolean') {
                        this.currentSettings.pulse = parsed.pulse;
                    }
                }
            }
        } catch (e) {
            // Fallback to defaults on error
        }
    }

    saveSettings() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentSettings));
        } catch (e) {}
    }

    setWidth(width) {
        if (!['2px', '3px', '4px'].includes(width)) return false;
        this.currentSettings.width = width;
        this.saveSettings();
        this.applySettings();
        return true;
    }

    setPreset(preset) {
        if (!['neon-gold', 'cyber-cyan', 'high-vis-white'].includes(preset)) return false;
        this.currentSettings.preset = preset;
        this.saveSettings();
        this.applySettings();
        return true;
    }

    setPulse(enabled) {
        this.currentSettings.pulse = Boolean(enabled);
        this.saveSettings();
        this.applySettings();
        return true;
    }

    applySettings() {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        if (!root) return;

        root.setAttribute('data-focus-width', this.currentSettings.width);
        root.setAttribute('data-focus-preset', this.currentSettings.preset);

        if (this.currentSettings.pulse) {
            root.classList.add('a11y-focus-pulse-enabled');
        } else {
            root.classList.remove('a11y-focus-pulse-enabled');
        }
    }

    bindKeyboardDetection() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
            if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (document.body) {
                    document.body.classList.add('keyboard-nav-active');
                }
            }
        });

        window.addEventListener('mousedown', () => {
            if (document.body) {
                document.body.classList.remove('keyboard-nav-active');
            }
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { A11yFocusRingManager };
}

if (typeof window !== 'undefined') {
    window.A11yFocusRingManager = A11yFocusRingManager;
}
