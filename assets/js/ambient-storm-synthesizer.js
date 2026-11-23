/**
 * Ambient Storm & Thunder Synthesizer (#1411)
 * Pure Web Audio API procedural atmospheric storm generator.
 * Synthesizes continuous pink/white rain noise, resonant bandpass wind howling,
 * and low-frequency exponential decay thunder strike rumbles without external audio files.
 */

class AmbientStormSynthesizer {
    constructor(audioContext = null) {
        this.ctx = audioContext || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null);
        this.isPlaying = false;
        this.masterGain = null;
        this.rainGain = null;
        this.windGain = null;
        this.windFilter = null;
        this.windLfo = null;
        this.rainNode = null;
        this.thunderGain = null;
    }

    init() {
        if (!this.ctx) return false;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Rain Channel: Pink noise generator through highpass/lowpass filter
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

        const rainHighpass = this.ctx.createBiquadFilter();
        rainHighpass.type = 'highpass';
        rainHighpass.frequency.setValueAtTime(800, this.ctx.currentTime);

        const rainLowpass = this.ctx.createBiquadFilter();
        rainLowpass.type = 'lowpass';
        rainLowpass.frequency.setValueAtTime(8500, this.ctx.currentTime);

        this.rainNode = this.createNoiseBufferNode(true);
        if (this.rainNode) {
            this.rainNode.connect(rainHighpass);
            rainHighpass.connect(rainLowpass);
            rainLowpass.connect(this.rainGain);
            this.rainGain.connect(this.masterGain);
        }

        // Wind Channel: Low-pass filtered noise modulated by slow LFO
        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
        this.windFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        const windSource = this.createNoiseBufferNode(false);
        if (windSource) {
            windSource.connect(this.windFilter);
            this.windFilter.connect(this.windGain);
            this.windGain.connect(this.masterGain);
        }

        // Wind modulation LFO
        if (typeof this.ctx.createOscillator === 'function') {
            this.windLfo = this.ctx.createOscillator();
            this.windLfo.frequency.setValueAtTime(0.2, this.ctx.currentTime); // 0.2 Hz slow sweep
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.setValueAtTime(250, this.ctx.currentTime);
            this.windLfo.connect(lfoGain);
            if (this.windFilter && this.windFilter.frequency) {
                lfoGain.connect(this.windFilter.frequency);
            }
        }

        // Thunder Channel
        this.thunderGain = this.ctx.createGain();
        this.thunderGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.thunderGain.connect(this.masterGain);

        return true;
    }

    createNoiseBufferNode(isPink = false) {
        if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;

        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (isPink) {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        } else {
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }

    triggerThunder(distanceKm = 2.0) {
        if (!this.ctx) return null;
        const now = this.ctx.currentTime;
        const delaySeconds = Math.max(0.1, distanceKm * 0.3); // acoustic flash-to-bang delay

        const thunderBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
        const output = thunderBuffer.getChannelData(0);
        let lastOut = 0.0;

        for (let i = 0; i < output.length; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise low-frequency integration
            lastOut = output[i];
            output[i] *= 3.5;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = thunderBuffer;

        const thunderFilter = this.ctx.createBiquadFilter();
        thunderFilter.type = 'lowpass';
        thunderFilter.frequency.setValueAtTime(200 / (1 + distanceKm * 0.5), now + delaySeconds);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.setValueAtTime(0.001, now + delaySeconds);
        env.gain.exponentialRampToValueAtTime(0.9 / (1 + distanceKm * 0.3), now + delaySeconds + 0.08);
        env.gain.exponentialRampToValueAtTime(0.0001, now + delaySeconds + 3.5);

        source.connect(thunderFilter);
        thunderFilter.connect(env);
        env.connect(this.thunderGain || this.masterGain);

        source.start(now + delaySeconds);
        source.stop(now + delaySeconds + 4.0);

        return { delay: delaySeconds, intensity: 1 / (1 + distanceKm) };
    }

    start() {
        if (this.isPlaying) return;
        if (!this.masterGain) this.init();

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.rainNode && typeof this.rainNode.start === 'function') {
            try { this.rainNode.start(); } catch (e) {}
        }
        if (this.windLfo && typeof this.windLfo.start === 'function') {
            try { this.windLfo.start(); } catch (e) {}
        }

        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        }
        this.isPlaying = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AmbientStormSynthesizer };
}

if (typeof window !== 'undefined') {
    window.AmbientStormSynthesizer = AmbientStormSynthesizer;
}
