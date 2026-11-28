/**
 * 1987 Amiga Workbench 1.3 Theme Studio Controller (#1558)
 * Manages theme activation, Topaz scanline overlays, Guru Meditation banner preview,
 * and state persistence in localStorage.
 */

class AmigaWorkbenchThemeManager {
    static THEME_ID = 'amiga-workbench-13';
    static STORAGE_KEY = 'arcadeverse_amiga_wb_pref';

    static PALETTE = {
        workbenchBlue: '#0055aa',
        crispWhite: '#ffffff',
        pitchBlack: '#000020',
        copperOrange: '#ff8800'
    };

    constructor() {
        this.scanlinesEnabled = false;
        this.scanlineElement = null;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${AmigaWorkbenchThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', AmigaWorkbenchThemeManager.THEME_ID);

        if (this.scanlinesEnabled) {
            this.enableScanlines();
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(AmigaWorkbenchThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${AmigaWorkbenchThemeManager.THEME_ID}`);
        if (document.documentElement.getAttribute('data-theme') === AmigaWorkbenchThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        this.disableScanlines();
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(AmigaWorkbenchThemeManager.STORAGE_KEY);
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
            this.scanlineElement.className = 'amiga-scanlines';
            document.body.appendChild(this.scanlineElement);
        }
    }

    disableScanlines() {
        if (this.scanlineElement && this.scanlineElement.parentNode) {
            this.scanlineElement.parentNode.removeChild(this.scanlineElement);
            this.scanlineElement = null;
        }
    }

    createGuruMeditationBanner(errorCode = '00000004.00004845') {
        if (typeof document === 'undefined') return null;
        const banner = document.createElement('div');
        banner.className = 'guru-meditation-banner';
        banner.innerHTML = `Software Failure. Press left mouse button to continue.<br>Guru Meditation #${errorCode}`;
        return banner;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseAmigaWB = new AmigaWorkbenchThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(AmigaWorkbenchThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVerseAmigaWB.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AmigaWorkbenchThemeManager };
}
