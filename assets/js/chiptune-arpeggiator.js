/**
 * Dynamic 8-Bit Chiptune Arpeggiator & Chords Generator (#1511)
 * Built on Web Audio API AudioContext with scheduled oscillator nodes,
 * accurate musical note frequency math, arpeggio pattern engines, and real-time waveform analysis.
 */

class ChiptuneArpeggiator {
    static CHORD_INTERVALS = {
        major: [0, 4, 7, 12],
        minor: [0, 3, 7, 12],
        diminished: [0, 3, 6, 12],
        pentatonic: [0, 2, 4, 7, 9],
        seventh: [0, 4, 7, 10, 12]
    };

    static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    constructor(options = {}) {
        this.bpm = options.bpm || 135;
        this.chordType = options.chordType || 'major';
        this.rootNote = options.rootNote || 'C';
        this.rootOctave = options.rootOctave || 4;
        this.waveform = options.waveform || 'square';
        this.pattern = options.pattern || 'up'; // up, down, up-down, random, fast-strum

        this.isPlaying = false;
        this.audioContext = null;
        this.analyser = null;
        this.timerId = null;
        this.currentNoteIndex = 0;
    }

    static noteToFrequency(noteName, octave = 4) {
        const noteIdx = ChiptuneArpeggiator.NOTE_NAMES.indexOf(noteName);
        if (noteIdx === -1) return 440; // Fallback A4
        // A4 = noteIndex 9 in octave 4 = 440 Hz
        const semitonesFromA4 = (octave - 4) * 12 + (noteIdx - 9);
        return 440 * Math.pow(2, semitonesFromA4 / 12);
    }

    getChordFrequencies() {
        const intervals = ChiptuneArpeggiator.CHORD_INTERVALS[this.chordType] || ChiptuneArpeggiator.CHORD_INTERVALS.major;
        const rootIdx = ChiptuneArpeggiator.NOTE_NAMES.indexOf(this.rootNote);
        const baseOctave = this.rootOctave;

        return intervals.map((interval) => {
            const totalIndex = rootIdx + interval;
            const noteName = ChiptuneArpeggiator.NOTE_NAMES[totalIndex % 12];
            const noteOctave = baseOctave + Math.floor(totalIndex / 12);
            return ChiptuneArpeggiator.noteToFrequency(noteName, noteOctave);
        });
    }

    getNextFrequency(chordFreqs) {
        if (!chordFreqs || chordFreqs.length === 0) return 440;

        if (this.pattern === 'up') {
            const freq = chordFreqs[this.currentNoteIndex % chordFreqs.length];
            this.currentNoteIndex++;
            return freq;
        }

        if (this.pattern === 'down') {
            const idx = (chordFreqs.length - 1) - (this.currentNoteIndex % chordFreqs.length);
            this.currentNoteIndex++;
            return chordFreqs[idx];
        }

        if (this.pattern === 'random') {
            const randIdx = Math.floor(Math.random() * chordFreqs.length);
            return chordFreqs[randIdx];
        }

        // Default up
        return chordFreqs[this.currentNoteIndex++ % chordFreqs.length];
    }

    playTone(freq, duration) {
        if (!this.audioContext) return;
        const now = this.audioContext.currentTime;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = this.waveform;
        osc.frequency.setValueAtTime(freq, now);

        // Crisp 8-bit chip envelope
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

        osc.connect(gain);
        if (this.analyser) {
            gain.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        } else {
            gain.connect(this.audioContext.destination);
        }

        osc.start(now);
        osc.stop(now + duration);
    }

    start() {
        if (this.isPlaying) return;
        if (typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx && !this.audioContext) {
                this.audioContext = new AudioCtx();
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
            }
        }

        this.isPlaying = true;
        this.currentNoteIndex = 0;
        const stepMs = (60 / this.bpm) * 250; // Sixteenth note arpeggio

        const chordFreqs = this.getChordFrequencies();

        this.timerId = setInterval(() => {
            const freq = this.getNextFrequency(chordFreqs);
            this.playTone(freq, stepMs / 1000);
        }, stepMs);
    }

    stop() {
        this.isPlaying = false;
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChiptuneArpeggiator };
}
