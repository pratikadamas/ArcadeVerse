const test = require('node:test');
const assert = require('node:assert/strict');
const { AmbientStormSynthesizer } = require('../assets/js/ambient-storm-synthesizer.js');

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
                    exponentialRampToValueAtTime: (v) => { this.value = v; },
                    setTargetAtTime: (v) => { this.value = v; }
                },
                connect() {}
            };
        },
        createBiquadFilter() {
            return {
                type: 'lowpass',
                frequency: {
                    value: 1000,
                    setValueAtTime: (v) => { this.value = v; }
                },
                Q: {
                    value: 1,
                    setValueAtTime: (v) => { this.value = v; }
                },
                connect() {}
            };
        },
        createOscillator() {
            return {
                frequency: {
                    value: 440,
                    setValueAtTime: (v) => { this.value = v; }
                },
                connect() {},
                start() {},
                stop() {}
            };
        },
        createBuffer(channels, length, sampleRate) {
            const data = new Float32Array(length);
            return {
                numberOfChannels: channels,
                length,
                sampleRate,
                getChannelData: () => data
            };
        },
        createBufferSource() {
            return {
                buffer: null,
                loop: false,
                connect() {},
                start() {},
                stop() {}
            };
        },
        resume() {}
    };
}

test('AmbientStormSynthesizer initializes rain, wind, and master nodes', () => {
    const mockCtx = createMockAudioContext();
    const storm = new AmbientStormSynthesizer(mockCtx);
    const success = storm.init();

    assert.equal(success, true, 'Initialization should succeed');
    assert.ok(storm.masterGain, 'Master gain node should be created');
    assert.ok(storm.rainGain, 'Rain gain node should be created');
    assert.ok(storm.windGain, 'Wind gain node should be created');
    assert.ok(storm.windFilter, 'Wind bandpass filter should be created');
});

test('AmbientStormSynthesizer starts and triggers thunder rumble with acoustic delay', () => {
    const mockCtx = createMockAudioContext();
    const storm = new AmbientStormSynthesizer(mockCtx);
    storm.start();
    assert.equal(storm.isPlaying, true, 'Synthesizer should be marked active');

    const thunderResult = storm.triggerThunder(3.5);
    assert.ok(thunderResult, 'Thunder event should return metadata');
    assert.ok(thunderResult.delay > 0, 'Flash-to-bang acoustic delay should be positive');
    assert.ok(thunderResult.intensity < 1, 'Intensity should decrease with distance');

    storm.stop();
    assert.equal(storm.isPlaying, false, 'Synthesizer should be stopped');
});
