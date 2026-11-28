/**
 * Web Audio Fade-In/Out Smooth Ramp Controller (#1554)
 * Provides exponential and linear gain ramping for Web Audio contexts
 * to eliminate abrupt clicks, pops, and sudden bursts when pausing/starting audio.
 */

class AudioRampManager {
    static ZERO_FLOOR = 0.0001; // Avoid 0 in exponentialRampToValueAtTime

    constructor(audioContext = null) {
        this.ctx = audioContext;
        this.masterGain = null;
        if (this.ctx && typeof this.ctx.createGain === 'function') {
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
        }
    }

    setGainInstantly(gainNode, targetVal) {
        if (!gainNode || !gainNode.gain) return;
        const clamped = Math.max(0, Math.min(1, targetVal));
        if (this.ctx && typeof gainNode.gain.cancelScheduledValues === 'function') {
            gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
            gainNode.gain.setValueAtTime(clamped, this.ctx.currentTime);
        } else {
            gainNode.gain.value = clamped;
        }
    }

    fadeIn(gainNode, targetVal = 1.0, durationSec = 0.3) {
        if (!gainNode || !gainNode.gain) return false;
        const target = Math.max(AudioRampManager.ZERO_FLOOR, Math.min(1.0, targetVal));

        if (!this.ctx) {
            gainNode.gain.value = target;
            return true;
        }

        const now = this.ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(AudioRampManager.ZERO_FLOOR, now);
        gainNode.gain.exponentialRampToValueAtTime(target, now + durationSec);
        return true;
    }

    fadeOut(gainNode, durationSec = 0.3) {
        if (!gainNode || !gainNode.gain) return false;

        if (!this.ctx) {
            gainNode.gain.value = 0;
            return true;
        }

        const now = this.ctx.currentTime;
        const currentVal = Math.max(AudioRampManager.ZERO_FLOOR, gainNode.gain.value || AudioRampManager.ZERO_FLOOR);
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(currentVal, now);
        gainNode.gain.exponentialRampToValueAtTime(AudioRampManager.ZERO_FLOOR, now + durationSec);
        // Clean zero floor at end
        gainNode.gain.setValueAtTime(0, now + durationSec + 0.01);
        return true;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioRampManager };
}
