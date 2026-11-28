/**
 * 1989 Sega Genesis 16-Bit Theme Studio Controller (#1518)
 * Registers theme under ID 'genesis-16bit', provides toggleable
 * Blast Processing speed glow effect, and manages localStorage preference persistence.
 */

class Genesis16BitThemeManager {
    static THEME_ID = 'genesis-16bit';
    static STORAGE_KEY = 'arcadeverse_genesis_16bit_pref';

    static COLOR_TOKENS = {
        sonicBlue: '#0038ce',
        darkBlue: '#001f7a',
        chromeLight: '#ffffff',
        chromeMid: '#a8a8a8',
        chromeDark: '#484848',
        goldRing: '#f8b800',
        carbon: '#121216'
    };

    constructor() {
        this.blastProcessingEnabled = true;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${Genesis16BitThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', Genesis16BitThemeManager.THEME_ID);

        if (this.blastProcessingEnabled) {
            document.body.classList.add('blast-processing-active');
        } else {
            document.body.classList.remove('blast-processing-active');
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(Genesis16BitThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${Genesis16BitThemeManager.THEME_ID}`);
        document.body.classList.remove('blast-processing-active');
        if (document.documentElement.getAttribute('data-theme') === Genesis16BitThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(Genesis16BitThemeManager.STORAGE_KEY);
        }
    }

    toggleBlastProcessing(state) {
        this.blastProcessingEnabled = typeof state === 'boolean' ? state : !this.blastProcessingEnabled;
        if (typeof document !== 'undefined') {
            if (this.blastProcessingEnabled) {
                document.body.classList.add('blast-processing-active');
            } else {
                document.body.classList.remove('blast-processing-active');
            }
        }
        return this.blastProcessingEnabled;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseGenesis = new Genesis16BitThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(Genesis16BitThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVerseGenesis.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Genesis16BitThemeManager };
}
