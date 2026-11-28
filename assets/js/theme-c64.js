/**
 * Commodore 64 Theme Studio Controller (#1509)
 * Handles registration of the 1982 C64 theme, CRT raster scanline overlays,
 * NTSC color bleed artifacts, and authentic startup sound synthesis.
 */

class Commodore64ThemeManager {
    static THEME_ID = 'commodore-64';
    static STORAGE_KEY = 'arcadeverse_c64_theme_pref';

    static VIC_II_PALETTE = {
        black: '#000000',
        white: '#ffffff',
        red: '#880000',
        cyan: '#aabee5',
        purple: '#880088',
        green: '#00cc55',
        blue: '#0000aa',
        yellow: '#eeee77',
        orange: '#dd8855',
        brown: '#664400',
        lightRed: '#ff7777',
        darkGrey: '#333333',
        grey: '#777777',
        lightGreen: '#aaff66',
        lightBlue: '#0088ff',
        lightGrey: '#bbbbbb'
    };

    constructor() {
        this.scanlinesEnabled = true;
        this.ntscBleedEnabled = false;
        this.scanlineElement = null;
        this.audioContext = null;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${Commodore64ThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', Commodore64ThemeManager.THEME_ID);

        if (this.scanlinesEnabled) {
            this.enableScanlines();
        }
        if (this.ntscBleedEnabled) {
            document.body.classList.add('c64-ntsc-bleed');
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(Commodore64ThemeManager.STORAGE_KEY, 'active');
        }

        this.playStartupBeep();
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${Commodore64ThemeManager.THEME_ID}`);
        document.body.classList.remove('c64-ntsc-bleed');
        if (document.documentElement.getAttribute('data-theme') === Commodore64ThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        this.disableScanlines();
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(Commodore64ThemeManager.STORAGE_KEY);
        }
    }

    toggleScanlines(state) {
        this.scanlinesEnabled = typeof state === 'boolean' ? state : !this.scanlinesEnabled;
        if (this.scanlinesEnabled) {
            this.enableScanlines();
        } else {
            this.disableScanlines();
        }
        return this.scanlinesEnabled;
    }

    enableScanlines() {
        if (typeof document === 'undefined') return;
        if (!this.scanlineElement) {
            this.scanlineElement = document.createElement('div');
            this.scanlineElement.className = 'c64-crt-scanlines';
            document.body.appendChild(this.scanlineElement);
        }
    }

    disableScanlines() {
        if (this.scanlineElement && this.scanlineElement.parentNode) {
            this.scanlineElement.parentNode.removeChild(this.scanlineElement);
            this.scanlineElement = null;
        }
    }

    playStartupBeep() {
        if (typeof window === 'undefined') return false;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return false;
            if (!this.audioContext) {
                this.audioContext = new AudioCtx();
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(987.77, this.audioContext.currentTime); // B5 tone
            gain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.26);
            return true;
        } catch (e) {
            return false;
        }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseC64 = new Commodore64ThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(Commodore64ThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVerseC64.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Commodore64ThemeManager };
}
