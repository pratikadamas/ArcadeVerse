/**
 * Interactive Volume Slider HUD with Real-Time Percentage Meter (#1386)
 * Connects directly to Web Audio masterGainNode and persists chosen level in localStorage.
 */

class VolumeControlManager {
    constructor(audioContext = null, masterGainNode = null) {
        this.ctx = audioContext;
        this.gainNode = masterGainNode;
        this.storageKey = 'av_master_volume';
        this.volume = 0.7; // Default 70%
        this.isMuted = false;
        this.previousVolume = 0.7;
    }

    init() {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(this.storageKey);
            if (saved !== null) {
                const parsed = parseFloat(saved);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                    this.volume = parsed;
                }
            }
        }
        this.applyVolume(this.volume);
    }

    setGainNode(node, ctx = null) {
        this.gainNode = node;
        if (ctx) this.ctx = ctx;
        this.applyVolume(this.volume);
    }

    setVolume(value) {
        const clamped = Math.max(0, Math.min(1, parseFloat(value) || 0));
        this.volume = clamped;
        this.isMuted = clamped === 0;

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(this.storageKey, clamped.toString());
            } catch (e) {}
        }

        this.applyVolume(this.volume);
        return {
            volume: this.volume,
            percentage: Math.round(this.volume * 100),
            db: this.volume > 0 ? (20 * Math.log10(this.volume)).toFixed(1) : '-inf'
        };
    }

    toggleMute() {
        if (this.isMuted || this.volume === 0) {
            this.setVolume(this.previousVolume || 0.7);
        } else {
            this.previousVolume = this.volume;
            this.setVolume(0);
        }
        return this.isMuted;
    }

    applyVolume(val) {
        if (this.gainNode && this.gainNode.gain) {
            const time = this.ctx ? this.ctx.currentTime : 0;
            if (typeof this.gainNode.gain.setValueAtTime === 'function') {
                this.gainNode.gain.setValueAtTime(val, time);
            } else {
                this.gainNode.gain.value = val;
            }
        }
    }

    bindUI(sliderInput, labelOutput) {
        if (!sliderInput) return;
        sliderInput.value = this.volume;

        const updateReadout = () => {
            const pct = Math.round(this.volume * 100);
            if (labelOutput) {
                labelOutput.textContent = this.volume === 0 ? 'Muted' : `${pct}%`;
            }
            sliderInput.setAttribute('aria-valuenow', pct.toString());
        };

        updateReadout();

        sliderInput.addEventListener('input', (e) => {
            this.setVolume(e.target.value);
            updateReadout();
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VolumeControlManager };
}

if (typeof window !== 'undefined') {
    window.VolumeControlManager = VolumeControlManager;
}
