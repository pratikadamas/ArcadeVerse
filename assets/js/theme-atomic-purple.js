/**
 * 1993 Game Boy Color Atomic Purple Theme Studio Controller (#1514)
 * Registers theme 'atomic-purple', controls translucent shell styling,
 * toggleable internal motherboard LED glow, and state persistence in localStorage.
 */

class AtomicPurpleThemeManager {
    static THEME_ID = 'atomic-purple';
    static STORAGE_KEY = 'arcadeverse_atomic_purple_pref';

    static COLOR_TOKENS = {
        shellPurple: 'rgba(82, 38, 122, 0.88)',
        lcdEmerald: '#9bbc0f',
        lcdOlive: '#8bac0f',
        lcdSage: '#306230',
        lcdCharcoal: '#0f380f',
        copperTrace: 'rgba(220, 140, 60, 0.28)'
    };

    constructor() {
        this.internalGlowEnabled = true;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${AtomicPurpleThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', AtomicPurpleThemeManager.THEME_ID);

        if (this.internalGlowEnabled) {
            document.body.classList.add('internal-glow-active');
        } else {
            document.body.classList.remove('internal-glow-active');
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(AtomicPurpleThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${AtomicPurpleThemeManager.THEME_ID}`);
        document.body.classList.remove('internal-glow-active');
        if (document.documentElement.getAttribute('data-theme') === AtomicPurpleThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(AtomicPurpleThemeManager.STORAGE_KEY);
        }
    }

    toggleInternalGlow(state) {
        this.internalGlowEnabled = typeof state === 'boolean' ? state : !this.internalGlowEnabled;
        if (typeof document !== 'undefined') {
            if (this.internalGlowEnabled) {
                document.body.classList.add('internal-glow-active');
            } else {
                document.body.classList.remove('internal-glow-active');
            }
        }
        return this.internalGlowEnabled;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseAtomicPurple = new AtomicPurpleThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(AtomicPurpleThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVerseAtomicPurple.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AtomicPurpleThemeManager };
}
