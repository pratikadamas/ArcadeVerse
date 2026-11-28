/**
 * 1998 Bondi Blue Aqua Gloss Theme Studio Controller (#1569)
 * Registers theme under ID 'bondi-blue-aqua', manages optional
 * glossy CTA pulse animations, and handles localStorage state persistence.
 */

class BondiAquaThemeManager {
    static THEME_ID = 'bondi-blue-aqua';
    static STORAGE_KEY = 'arcadeverse_bondi_aqua_pref';

    static TOKENS = {
        bondiBlue: '#0095b6',
        inkDark: '#12222a',
        cardSurface: 'rgba(235, 245, 250, 0.92)'
    };

    constructor() {
        this.glossPulseEnabled = true;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${BondiAquaThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', BondiAquaThemeManager.THEME_ID);

        if (this.glossPulseEnabled) {
            document.body.classList.add('gloss-pulse-active');
        } else {
            document.body.classList.remove('gloss-pulse-active');
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(BondiAquaThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${BondiAquaThemeManager.THEME_ID}`);
        document.body.classList.remove('gloss-pulse-active');
        if (document.documentElement.getAttribute('data-theme') === BondiAquaThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(BondiAquaThemeManager.STORAGE_KEY);
        }
    }

    toggleGlossPulse(state) {
        this.glossPulseEnabled = typeof state === 'boolean' ? state : !this.glossPulseEnabled;
        if (typeof document !== 'undefined') {
            if (this.glossPulseEnabled) {
                document.body.classList.add('gloss-pulse-active');
            } else {
                document.body.classList.remove('gloss-pulse-active');
            }
        }
        return this.glossPulseEnabled;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseBondi = new BondiAquaThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(BondiAquaThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVerseBondi.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BondiAquaThemeManager };
}
