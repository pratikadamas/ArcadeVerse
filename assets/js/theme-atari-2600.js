/**
 * 1979 Atari 2600 Woodgrain Theme Studio Controller (#1559)
 * Handles registration of 'atari-2600-woodgrain', manages the optional RF static overlay,
 * and maintains persistent preferences in localStorage.
 */

class Atari2600ThemeManager {
    static THEME_ID = 'atari-2600-woodgrain';
    static STORAGE_KEY = 'arcadeverse_atari_2600_pref';

    static TOKENS = {
        woodDark: '#2a1810',
        woodMid: '#4a2d1b',
        woodLight: '#6a4028',
        chrome: '#c0c0c0',
        tiaRed: '#e02020',
        tiaOrange: '#f07010',
        tiaYellow: '#f0d010',
        tiaGreen: '#30b030',
        tiaCyan: '#2090d0',
        tiaPurple: '#8020a0'
    };

    constructor() {
        this.rfStaticEnabled = false;
        this.staticElement = null;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${Atari2600ThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', Atari2600ThemeManager.THEME_ID);

        if (this.rfStaticEnabled) {
            this.enableRFStatic();
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(Atari2600ThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${Atari2600ThemeManager.THEME_ID}`);
        if (document.documentElement.getAttribute('data-theme') === Atari2600ThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        this.disableRFStatic();
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(Atari2600ThemeManager.STORAGE_KEY);
        }
    }

    toggleRFStatic(state) {
        this.rfStaticEnabled = typeof state === 'boolean' ? state : !this.rfStaticEnabled;
        if (this.rfStaticEnabled) {
            this.enableRFStatic();
        } else {
            this.disableRFStatic();
        }
        return this.rfStaticEnabled;
    }

    enableRFStatic() {
        if (typeof document === 'undefined') return;
        if (!this.staticElement) {
            this.staticElement = document.createElement('div');
            this.staticElement.className = 'atari-rf-static';
            document.body.appendChild(this.staticElement);
        }
    }

    disableRFStatic() {
        if (this.staticElement && this.staticElement.parentNode) {
            this.staticElement.parentNode.removeChild(this.staticElement);
            this.staticElement = null;
        }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseAtari2600 = new Atari2600ThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(Atari2600ThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVerseAtari2600.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Atari2600ThemeManager };
}
