/**
 * 1983 MSX2 & PC-9801 Dithered Theme Studio Controller (#1568)
 * Registers theme under ID 'pc98-msx2-dither', manages the toggleable
 * 400-line CRT interlace overlay, and persists settings in localStorage.
 */

class PC98ThemeManager {
    static THEME_ID = 'pc98-msx2-dither';
    static STORAGE_KEY = 'arcadeverse_pc98_theme_pref';

    static TOKENS = {
        navy: '#080828',
        cyan: '#44ffee',
        amber: '#ffaa22',
        ivory: '#f4f4ee',
        magenta: '#ee4499',
        green: '#22dd55'
    };

    constructor() {
        this.interlaceEnabled = true;
        this.interlaceElement = null;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${PC98ThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', PC98ThemeManager.THEME_ID);

        if (this.interlaceEnabled) {
            this.enableInterlace();
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PC98ThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${PC98ThemeManager.THEME_ID}`);
        if (document.documentElement.getAttribute('data-theme') === PC98ThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        this.disableInterlace();
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(PC98ThemeManager.STORAGE_KEY);
        }
    }

    toggleInterlace(state) {
        this.interlaceEnabled = typeof state === 'boolean' ? state : !this.interlaceEnabled;
        if (this.interlaceEnabled) {
            this.enableInterlace();
        } else {
            this.disableInterlace();
        }
        return this.interlaceEnabled;
    }

    enableInterlace() {
        if (typeof document === 'undefined') return;
        if (!this.interlaceElement) {
            this.interlaceElement = document.createElement('div');
            this.interlaceElement.className = 'pc98-crt-interlace';
            document.body.appendChild(this.interlaceElement);
        }
    }

    disableInterlace() {
        if (this.interlaceElement && this.interlaceElement.parentNode) {
            this.interlaceElement.parentNode.removeChild(this.interlaceElement);
            this.interlaceElement = null;
        }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVersePC98 = new PC98ThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(PC98ThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVersePC98.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PC98ThemeManager };
}
