const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { VolumeControlManager } = require('../assets/js/volume-control.js');

test('VolumeControlManager updates gain, calculates dB percentage, and handles mute', () => {
    let mockGainValue = 0;
    const mockGain = {
        gain: {
            value: 0,
            setValueAtTime: (v) => { mockGainValue = v; }
        }
    };

    let store = {};
    global.localStorage = {
        getItem(k) { return store[k] || null; },
        setItem(k, v) { store[k] = String(v); }
    };

    const manager = new VolumeControlManager(null, mockGain);
    manager.init();

    // Set 50%
    const res50 = manager.setVolume(0.5);
    assert.equal(res50.percentage, 50);
    assert.equal(mockGainValue, 0.5);
    assert.equal(store['av_master_volume'], '0.5');

    // Mute toggle
    manager.toggleMute();
    assert.equal(manager.volume, 0, 'Volume is 0 when muted');
    assert.equal(mockGainValue, 0);

    // Unmute restores previous level
    manager.toggleMute();
    assert.equal(manager.volume, 0.5, 'Unmute restores previous 0.5 volume');
    assert.equal(mockGainValue, 0.5);
});

test('volume-slider.css contains neon slider track and glowing thumb styling', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/volume-slider.css');
    assert.ok(fs.existsSync(cssPath), 'volume-slider.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.volume-control-hud/, 'Styles HUD container');
    assert.match(css, /\.volume-slider-input/, 'Styles range input');
    assert.match(css, /::-webkit-slider-thumb/, 'Styles webkit thumb tracker');
    assert.match(css, /\.volume-readout/, 'Styles percentage readout text');
});
