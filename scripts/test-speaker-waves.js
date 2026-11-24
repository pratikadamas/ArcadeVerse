const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SpeakerWaveToggle } = require('../assets/js/speaker-waves.js');

test('SpeakerWaveToggle updates button classes and accessibility attributes', () => {
    const classList = new Set();
    const attributes = {};
    const mockBtn = {
        innerHTML: '',
        classList: {
            add: (c) => classList.add(c),
            remove: (c) => classList.delete(c),
            contains: (c) => classList.has(c)
        },
        setAttribute: (k, v) => { attributes[k] = v; }
    };

    const toggle = new SpeakerWaveToggle(mockBtn);
    toggle.init();

    assert.ok(mockBtn.innerHTML.includes('speaker-svg'), 'Inserts SVG markup');
    assert.equal(attributes['aria-label'], 'Mute Audio (M)');

    // Toggle mute ON
    toggle.setMuteState(true);
    assert.equal(classList.has('muted'), true);
    assert.equal(attributes['aria-label'], 'Unmute Audio (M)');
    assert.equal(attributes['aria-pressed'], 'false');

    // Toggle mute OFF
    toggle.setMuteState(false);
    assert.equal(classList.has('muted'), false);
    assert.equal(classList.has('playing'), true);
    assert.equal(attributes['aria-label'], 'Mute Audio (M)');
    assert.equal(attributes['aria-pressed'], 'true');
});

test('speaker-waves.css contains wave pulse keyframes and diagonal slash styles', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/speaker-waves.css');
    assert.ok(fs.existsSync(cssPath), 'speaker-waves.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /@keyframes speakerPulse/, 'Defines staggered sound wave pulse keyframes');
    assert.match(css, /\.speaker-slash/, 'Styles diagonal mute slash');
    assert.match(css, /stroke-dasharray:\s*32/, 'Uses stroke-dasharray for animated slash');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Honors prefers-reduced-motion');
});
