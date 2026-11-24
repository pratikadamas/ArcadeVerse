const test = require('node:test');
const assert = require('node:assert/strict');
const { VirtualTheremin } = require('../assets/js/virtual-theremin.js');

function createMockAudioContext() {
    return {
        currentTime: 0,
        sampleRate: 44100,
        destination: {},
        state: 'running',
        createGain() {
            return {
                gain: {
                    value: 0,
                    setValueAtTime: (v) => { this.value = v; },
                    setTargetAtTime: (v) => { this.value = v; }
                },
                connect() {}
            };
        },
        createOscillator() {
            return {
                type: 'sine',
                frequency: {
                    value: 440,
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

test('VirtualTheremin initializes oscillator and gain circuits', () => {
    const mockCtx = createMockAudioContext();
    const theremin = new VirtualTheremin(mockCtx);
    const ready = theremin.init();

    assert.equal(ready, true, 'Initialization succeeds');
    assert.ok(theremin.oscillator, 'Main oscillator should be instantiated');
    assert.ok(theremin.gainNode, 'Main gain node should be instantiated');
    assert.ok(theremin.vibratoOsc, 'Vibrato LFO oscillator instantiated');
});

test('VirtualTheremin maps 2D pointer coordinates to frequency and amplitude', () => {
    const mockCtx = createMockAudioContext();
    const theremin = new VirtualTheremin(mockCtx);
    theremin.start();

    // Bottom left corner: min frequency, zero volume
    const low = theremin.setPointer(0.0, 1.0);
    assert.ok(Math.abs(low.frequency - 65.41) < 1.0, 'Frequency should match minFreq at X=0');
    assert.equal(low.volume, 0, 'Volume should be 0 at Y=1');

    // Top right corner: max frequency, max volume
    const high = theremin.setPointer(1.0, 0.0);
    assert.ok(Math.abs(high.frequency - 1046.50) < 1.0, 'Frequency should match maxFreq at X=1');
    assert.ok(high.volume > 0.5, 'Volume should be peak at Y=0');

    theremin.stop();
    assert.equal(theremin.active, false);
});

test('VirtualTheremin updates waveform and vibrato parameters', () => {
    const mockCtx = createMockAudioContext();
    const theremin = new VirtualTheremin(mockCtx);
    theremin.init();

    theremin.setWaveform('triangle');
    assert.equal(theremin.waveform, 'triangle');
    assert.equal(theremin.oscillator.type, 'triangle');

    theremin.setVibrato(7.0, 12.0);
    assert.equal(theremin.vibratoRate, 7.0);
    assert.equal(theremin.vibratoDepth, 12.0);
});
