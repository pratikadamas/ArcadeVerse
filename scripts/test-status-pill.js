const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SystemStatusPill } = require('../assets/js/status-pill.js');

test('SystemStatusPill renders online/offline states and version tag', () => {
    let container = { className: '', innerHTML: '' };
    global.navigator = { onLine: true, serviceWorker: { controller: {} } };

    const pill = new SystemStatusPill({ version: 'v2.4.0' });
    pill.init(container);

    assert.ok(container.innerHTML.includes('status-online'), 'Renders online dot class');
    assert.ok(container.innerHTML.includes('Vault Online'), 'Renders online text');
    assert.ok(container.innerHTML.includes('v2.4.0'), 'Renders version number');

    // Simulate going offline with active service worker
    pill.isOnline = false;
    pill.hasPwa = true;
    pill.render();
    assert.ok(container.innerHTML.includes('status-offline'), 'Renders offline dot class');
    assert.ok(container.innerHTML.includes('Offline Ready (PWA Active)'), 'Renders PWA offline status');
});

test('status-pill.css contains pulsing keyframes and version tag styling', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/status-pill.css');
    assert.ok(fs.existsSync(cssPath), 'status-pill.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.arcade-status-pill-container/, 'Styles status pill container');
    assert.match(css, /@keyframes statusPulseGreen/, 'Defines green pulse keyframe');
    assert.match(css, /@keyframes statusPulseAmber/, 'Defines amber pulse keyframe');
    assert.match(css, /\.status-version-badge/, 'Styles version badge');
});
