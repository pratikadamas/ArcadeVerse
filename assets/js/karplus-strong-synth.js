/**
 * Interactive Web Audio Karplus-Strong Plucked String Synthesizer (#1565)
 * Synthesizes acoustic guitar and harp strings via noise burst excitation
 * through a feedback delay line with low-pass filtering:
 * Delay length N = sampleRate / frequency.
 */

class KarplusStrongSynth {
    static SCALES = {
        pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], // C D E G A C
        acoustic: [82.41, 110.00, 146.83, 196.00, 246.94, 329.63], // E2 A2 D3 G3 B3 E4
        hirajoshi: [261.63, 277.18, 349.23, 392.00, 415.30, 523.25] // C C# F G G# C
    };

    constructor(options = {}) {
        this.scale = options.scale || 'pentatonic';
        this.damping = options.damping || 0.985;
        this.audioContext = null;
    }

    getFrequencies() {
        return KarplusStrongSynth.SCALES[this.scale] || KarplusStrongSynth.SCALES.pentatonic;
    }

    static calculateDelaySamples(sampleRate, frequency) {
        if (!frequency || frequency <= 0) return 100;
        return Math.round(sampleRate / frequency);
    }

    pluckString(stringIndex = 0) {
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
            const freqs = this.getFrequencies();
            const freq = freqs[stringIndex % freqs.length];

            const now = ctx.currentTime;
            const delayTime = 1 / freq;

            // Excitation noise burst (short attack pluck)
            const burstDuration = Math.min(0.015, delayTime);
            const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * burstDuration));
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;

            // Feedback delay loop simulating string reflection
            const delay = ctx.createDelay(1.0);
            delay.delayTime.setValueAtTime(delayTime, now);

            // Lowpass dampening filter simulating string decay
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(freq * 3.5, now);

            // Feedback attenuation gain
            const feedbackGain = ctx.createGain();
            feedbackGain.gain.setValueAtTime(this.damping, now);

            // Master envelope output
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.3, now);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

            // Connect feedback loop: delay -> filter -> feedbackGain -> delay
            whiteNoise.connect(delay);
            delay.connect(filter);
            filter.connect(feedbackGain);
            feedbackGain.connect(delay);

            delay.connect(masterGain);
            masterGain.connect(ctx.destination);

            whiteNoise.start(now);
            whiteNoise.stop(now + burstDuration);

            return true;
        } catch (e) {
            return false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KarplusStrongSynth };
}
