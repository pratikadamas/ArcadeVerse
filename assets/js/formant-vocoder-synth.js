/**
 * Formant Filter Vocal Synthesizer (#1417)
 * Pure Web Audio API vocal formant speech synthesizer.
 * Routes a pulse carrier wave through 3 parallel BiquadFilter bandpass
 * resonators (F1, F2, F3) to synthesize robotic vowel sounds (/a/, /e/, /i/, /o/, /u/).
 */

class FormantVocoderSynthesizer {
    constructor(audioContext = null) {
        this.ctx = audioContext || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null);
        this.carrier = null;
        this.masterGain = null;
        this.formantFilters = [];
        this.formantGains = [];
        this.active = false;

        // Vowel formant frequencies (Hz) and relative gains (dB approx converted)
        this.vowelPresets = {
            'a': { f1: 800,  f2: 1200, f3: 2500, q: 8 },
            'e': { f1: 500,  f2: 1800, f3: 2500, q: 8 },
            'i': { f1: 300,  f2: 2300, f3: 3000, q: 9 },
            'o': { f1: 500,  f2: 900,  f3: 2400, q: 7 },
            'u': { f1: 350,  f2: 800,  f3: 2300, q: 7 }
        };

        this.currentVowel = 'a';
        this.pitch = 110; // A2 robot pitch
    }

    init() {
        if (!this.ctx) return false;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Carrier pulse wave oscillator
        this.carrier = this.ctx.createOscillator();
        this.carrier.type = 'sawtooth';
        this.carrier.frequency.setValueAtTime(this.pitch, this.ctx.currentTime);

        this.formantFilters = [];
        this.formantGains = [];

        const preset = this.vowelPresets[this.currentVowel];
        const freqs = [preset.f1, preset.f2, preset.f3];
        const gainWeights = [1.0, 0.5, 0.25];

        for (let i = 0; i < 3; i++) {
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(freqs[i], this.ctx.currentTime);
            bp.Q.setValueAtTime(preset.q, this.ctx.currentTime);

            const g = this.ctx.createGain();
            g.gain.setValueAtTime(gainWeights[i], this.ctx.currentTime);

            this.carrier.connect(bp);
            bp.connect(g);
            g.connect(this.masterGain);

            this.formantFilters.push(bp);
            this.formantGains.push(g);
        }

        return true;
    }

    start() {
        if (this.active) return;
        if (!this.carrier) this.init();

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx ? this.ctx.currentTime : 0;
        if (this.carrier && typeof this.carrier.start === 'function') {
            try { this.carrier.start(now); } catch (e) {}
        }
        this.active = true;
    }

    stop() {
        if (!this.active) return;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        }
        this.active = false;
    }

    setVowel(vowelChar, transitionTime = 0.08) {
        const v = vowelChar.toLowerCase();
        if (!this.vowelPresets[v]) return false;
        this.currentVowel = v;

        const preset = this.vowelPresets[v];
        const freqs = [preset.f1, preset.f2, preset.f3];

        if (this.ctx && this.formantFilters.length === 3) {
            const now = this.ctx.currentTime;
            for (let i = 0; i < 3; i++) {
                this.formantFilters[i].frequency.setTargetAtTime(freqs[i], now, transitionTime);
                this.formantFilters[i].Q.setTargetAtTime(preset.q, now, transitionTime);
            }
        }
        return true;
    }

    setPitch(freqHz) {
        this.pitch = Math.max(40, Math.min(880, freqHz));
        if (this.carrier && this.ctx) {
            this.carrier.frequency.setTargetAtTime(this.pitch, this.ctx.currentTime, 0.03);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FormantVocoderSynthesizer };
}

if (typeof window !== 'undefined') {
    window.FormantVocoderSynthesizer = FormantVocoderSynthesizer;
}
