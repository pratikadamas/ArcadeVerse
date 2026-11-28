/**
 * Dynamic Interactive Web Audio Dual-Oscillator FM Synthesizer Studio (#1515)
 * Constructs an authentic FM synthesis graph:
 * Modulator Oscillator -> Modulator Gain Node -> Carrier Oscillator Frequency Param -> Output Gain Node.
 * Supports factory presets, ADSR timing, and responsive keyboard triggering.
 */

class FMSynthStudio {
    static PRESETS = {
        slapBass: {
            carrierType: 'sawtooth',
            modulatorType: 'sine',
            harmonicRatio: 1.0,
            modulationIndex: 250,
            attack: 0.01,
            decay: 0.25,
            sustain: 0.2,
            release: 0.2
        },
        metallicBell: {
            carrierType: 'sine',
            modulatorType: 'sine',
            harmonicRatio: 3.5,
            modulationIndex: 600,
            attack: 0.005,
            decay: 0.8,
            sustain: 0.05,
            release: 0.6
        },
        laserZap: {
            carrierType: 'square',
            modulatorType: 'sawtooth',
            harmonicRatio: 0.5,
            modulationIndex: 800,
            attack: 0.01,
            decay: 0.15,
            sustain: 0.0,
            release: 0.1
        },
        cyberChime: {
            carrierType: 'sine',
            modulatorType: 'triangle',
            harmonicRatio: 2.0,
            modulationIndex: 350,
            attack: 0.02,
            decay: 0.5,
            sustain: 0.3,
            release: 0.4
        }
    };

    static KEY_MAP = {
        a: 261.63, // C4
        w: 277.18, // C#4
        s: 293.66, // D4
        e: 311.13, // D#4
        d: 329.63, // E4
        f: 349.23, // F4
        t: 369.99, // F#4
        g: 392.00, // G4
        y: 415.30, // G#4
        h: 440.00, // A4
        u: 466.16, // A#4
        j: 493.88, // B4
        k: 523.25  // C5
    };

    constructor(options = {}) {
        this.preset = options.preset || 'slapBass';
        this.params = { ...FMSynthStudio.PRESETS[this.preset] };
        this.audioContext = null;
    }

    setPreset(name) {
        if (!FMSynthStudio.PRESETS[name]) return false;
        this.preset = name;
        this.params = { ...FMSynthStudio.PRESETS[name] };
        return true;
    }

    triggerNote(carrierFreq = 440, duration = 0.4) {
        if (typeof window === 'undefined') return true;
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
            const p = this.params;

            // 1. Modulator Oscillator & Gain
            const modOsc = ctx.createOscillator();
            const modGain = ctx.createGain();
            modOsc.type = p.modulatorType;
            modOsc.frequency.setValueAtTime(carrierFreq * p.harmonicRatio, now);
            modGain.gain.setValueAtTime(p.modulationIndex, now);
            modGain.gain.exponentialRampToValueAtTime(0.01, now + p.decay + p.release);

            // 2. Carrier Oscillator
            const carrierOsc = ctx.createOscillator();
            carrierOsc.type = p.carrierType;
            carrierOsc.frequency.setValueAtTime(carrierFreq, now);

            // Modulator connects into Carrier Frequency
            modOsc.connect(modGain);
            modGain.connect(carrierOsc.frequency);

            // 3. Master Envelope Output Gain
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.0001, now);
            masterGain.gain.linearRampToValueAtTime(0.2, now + p.attack);
            masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.2 * p.sustain), now + p.attack + p.decay);
            masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + p.release);

            carrierOsc.connect(masterGain);
            masterGain.connect(ctx.destination);

            modOsc.start(now);
            carrierOsc.start(now);

            const stopTime = now + duration + p.release + 0.05;
            modOsc.stop(stopTime);
            carrierOsc.stop(stopTime);

            return true;
        } catch (e) {
            return false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FMSynthStudio };
}
