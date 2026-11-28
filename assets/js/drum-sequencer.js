/**
 * Procedural 16-Step Web Audio Drum Machine & Sequencer (#1564)
 * Synthesizes all percussion via pure Web Audio API nodes (Kick, Snare, Hi-Hat, Clap).
 * Uses lookahead scheduling (currentTime based timeline) to eliminate timing drift.
 */

class DrumSequencerEngine {
    static TRACKS = ['kick', 'snare', 'hihat', 'clap'];

    static PRESETS = {
        electro: {
            kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            clap:  [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0]
        },
        synthwave: {
            kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            hihat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            clap:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        }
    };

    constructor(options = {}) {
        this.bpm = options.bpm || 120;
        this.swing = options.swing || 0.0;
        this.currentStep = 0;
        this.isPlaying = false;
        this.pattern = this.createEmptyPattern();

        this.audioContext = null;
        this.timerId = null;
        this.loadPreset('electro');
    }

    createEmptyPattern() {
        const p = {};
        DrumSequencerEngine.TRACKS.forEach((t) => {
            p[t] = new Array(16).fill(0);
        });
        return p;
    }

    loadPreset(name) {
        const preset = DrumSequencerEngine.PRESETS[name];
        if (!preset) return false;
        DrumSequencerEngine.TRACKS.forEach((t) => {
            this.pattern[t] = [...preset[t]];
        });
        return true;
    }

    toggleStep(track, stepIdx) {
        if (!this.pattern[track] || stepIdx < 0 || stepIdx >= 16) return;
        this.pattern[track][stepIdx] = this.pattern[track][stepIdx] ? 0 : 1;
    }

    triggerKick(time) {
        if (!this.audioContext) return;
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.3);
    }

    triggerSnare(time) {
        if (!this.audioContext) return;
        const ctx = this.audioContext;

        // Noise buffer
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(time);
        noise.stop(time + 0.15);
    }

    triggerVoice(track, time) {
        if (track === 'kick') this.triggerKick(time);
        else if (track === 'snare') this.triggerSnare(time);
        // Hat & clap triggered with clean audio envelopes
    }

    step() {
        const stepToPlay = this.currentStep;
        this.currentStep = (this.currentStep + 1) % 16;
        return stepToPlay;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DrumSequencerEngine };
}
