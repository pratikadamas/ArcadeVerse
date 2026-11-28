/**
 * 1995 Sony PlayStation Classic Grey Theme Studio Controller (#1560)
 * Registers theme under ID 'ps1-classic-grey', synthesizes optional
 * warm Web Audio resonant boot chime, and handles state persistence.
 */

class PS1ClassicThemeManager {
    static THEME_ID = 'ps1-classic-grey';
    static STORAGE_KEY = 'arcadeverse_ps1_classic_pref';

    static TOKENS = {
        surfaceGrey: '#a8abb0',
        inkDark: '#2a2d34',
        greenTriangle: '#00d26a',
        redCircle: '#ff4d4d',
        blueCross: '#3d8bff',
        pinkSquare: '#ff70ba'
    };

    constructor() {
        this.audioChimeEnabled = true;
        this.audioContext = null;
    }

    applyTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.add(`theme-${PS1ClassicThemeManager.THEME_ID}`);
        document.documentElement.setAttribute('data-theme', PS1ClassicThemeManager.THEME_ID);

        if (this.audioChimeEnabled) {
            this.playStartupPadChime();
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PS1ClassicThemeManager.STORAGE_KEY, 'active');
        }
    }

    removeTheme() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove(`theme-${PS1ClassicThemeManager.THEME_ID}`);
        if (document.documentElement.getAttribute('data-theme') === PS1ClassicThemeManager.THEME_ID) {
            document.documentElement.removeAttribute('data-theme');
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(PS1ClassicThemeManager.STORAGE_KEY);
        }
    }

    playStartupPadChime() {
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

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Warm resonant chord pad
            const chord = [130.81, 164.81, 196.00, 246.94]; // C major 7
            chord.forEach((freq) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(0.04, now + 0.4);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 1.9);
            });

            return true;
        } catch (e) {
            return false;
        }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVersePS1 = new PS1ClassicThemeManager();
        if (typeof localStorage !== 'undefined' && localStorage.getItem(PS1ClassicThemeManager.STORAGE_KEY) === 'active') {
            window.arcadeVersePS1.applyTheme();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PS1ClassicThemeManager };
}
