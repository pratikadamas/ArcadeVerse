const test = require('node:test');
const assert = require('node:assert/strict');
const { FormantVocoderSynthesizer } = require('../assets/js/formant-vocoder-synth.js');

function createMockAudioContext() {
    return {
        currentTime: 0,
        sampleRate: 44100,
        destination: {},
        state: 'running',
        createGain() {
            return {
                gain: {
                    value: 1,
                    setValueAtTime: (v) => { this.value = v; },
                    setTargetAtTime: (v) => { this.value = v; }
                },
                connect() {}
            };
        },
        createBiquadFilter() {
            return {
                type: 'bandpass',
                frequency: {
                    value: 1000,
                    setValueAtTime: (v) => { this.value = v; },
                    setTargetAtTime: (v) => { this.value = v; }
                },
                Q: {
                    value: 1,
                    setValueAtTime: (v) => { this.value = v; },
                    setTargetAtTime: (v) => { this.value = v; }
                },
                connect() {}
            };
        },
        createOscillator() {
            return {
                type: 'sawtooth',
                frequency: {
                    value: 110,
                    setValueAtTime: (v) => { this.value = v; },
                    setTargetAtTime: (v) => { this.value = v; }
                },
                connect() {},
                start() {},
                stop() {}
            };
        },
        resume() {}
    };
}

test('FormantVocoderSynthesizer initializes 3 parallel formant filter resonators', () => {
    const mockCtx = createMockAudioContext();
    const synth = new FormantVocoderSynthesizer(mockCtx);
    const success = synth.init();

    assert.equal(success, true, 'Synthesizer should initialize cleanly');
    assert.equal(synth.formantFilters.length, 3, 'Should create 3 parallel formant bandpass filters (F1, F2, F3)');
    assert.equal(synth.formantGains.length, 3, 'Should create 3 formant attenuator gains');
    assert.ok(synth.carrier, 'Carrier oscillator should be initialized');
});

test('FormantVocoderSynthesizer switches vocal formants accurately across vowels', () => {
    const mockCtx = createMockAudioContext();
    const synth = new FormantVocoderSynthesizer(mockCtx);
    synth.init();

    assert.equal(synth.setVowel('o'), true, 'Should switch to /o/ formant');
    assert.equal(synth.currentVowel, 'o');
    assert.equal(synth.vowelPresets['o'].f1, 500);
    assert.equal(synth.vowelPresets['o'].f2, 900);

    assert.equal(synth.setVowel('i'), true, 'Should switch to /i/ formant');
    assert.equal(synth.currentVowel, 'i');
    assert.equal(synth.vowelPresets['i'].f1, 300);

    assert.equal(synth.setVowel('z'), false, 'Non-existent vowel should return false');
});

test('FormantVocoderSynthesizer modulates carrier pitch', () => {
    const mockCtx = createMockAudioContext();
    const synth = new FormantVocoderSynthesizer(mockCtx);
    synth.init();

    synth.setPitch(220);
    assert.equal(synth.pitch, 220, 'Pitch should be updated to 220Hz');

    synth.start();
    assert.equal(synth.active, true);

    synth.stop();
    assert.equal(synth.active, false);
});
