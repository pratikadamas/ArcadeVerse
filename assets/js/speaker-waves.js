/**
 * Sound Toggle Speaker Wave Animation Controller (#1391)
 * Mounts interactive SVG speaker with 3 acoustic wave arcs and animated mute slash.
 */

class SpeakerWaveToggle {
    constructor(buttonElement = null) {
        this.button = buttonElement;
        this.isMuted = false;
        this.isPlaying = true;
    }

    renderSvg() {
        return `
            <svg class="speaker-svg" viewBox="0 0 24 24">
                <!-- Speaker Body -->
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <!-- Arc Wave 1 -->
                <path class="speaker-wave speaker-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <!-- Arc Wave 2 -->
                <path class="speaker-wave speaker-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                <!-- Diagonal Mute Slash -->
                <line class="speaker-slash" x1="2" y1="2" x2="22" y2="22"></line>
            </svg>
        `;
    }

    init() {
        if (!this.button) return;
        this.button.innerHTML = this.renderSvg();
        this.button.classList.add('speaker-toggle-btn');
        this.updateAria();
    }

    setMuteState(muted) {
        this.isMuted = Boolean(muted);
        if (!this.button) return;

        if (this.isMuted) {
            this.button.classList.add('muted');
            this.button.classList.remove('playing');
        } else {
            this.button.classList.remove('muted');
            if (this.isPlaying) {
                this.button.classList.add('playing');
            }
        }
        this.updateAria();
    }

    updateAria() {
        if (!this.button) return;
        const label = this.isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)';
        this.button.setAttribute('aria-label', label);
        this.button.setAttribute('title', label);
        this.button.setAttribute('aria-pressed', (!this.isMuted).toString());
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeakerWaveToggle };
}

if (typeof window !== 'undefined') {
    window.SpeakerWaveToggle = SpeakerWaveToggle;
}
