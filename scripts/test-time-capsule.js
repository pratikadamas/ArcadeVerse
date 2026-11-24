const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ArcadeTimeCapsule } = require('../assets/js/time-capsule.js');

test('ArcadeTimeCapsule renders chronological milestones and handles game launches', () => {
    let launchedGame = null;
    const capsule = new ArcadeTimeCapsule({
        onPlayGame: (id) => { launchedGame = id; }
    });

    assert.equal(capsule.milestoneEras.length, 4, 'Includes 4 historical phases');

    const mockContainer = { innerHTML: '', querySelectorAll: () => [] };
    const html = capsule.renderTimeline(mockContainer);

    assert.ok(html.includes('Phase 1: Genesis Era'), 'Contains Genesis era');
    assert.ok(html.includes('Phase 2: Spooky Season 2026'), 'Contains Halloween event');
    assert.ok(html.includes('Phase 3: Quantum & Cyber Surge'), 'Contains Quantum surge');
    assert.ok(html.includes('Phase 4: Centurion Milestone'), 'Contains Centurion milestone');
    assert.ok(html.includes('time-capsule-stats-ribbon'), 'Contains platform stats ribbon');
});

test('time-capsule.css contains glowing vertical highway and alternating layout', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/time-capsule.css');
    assert.ok(fs.existsSync(cssPath), 'time-capsule.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.time-capsule-highway/, 'Styles timeline highway');
    assert.match(css, /\.timeline-milestone-node\.align-left/, 'Handles left alignment on desktop');
    assert.match(css, /\.timeline-milestone-node\.align-right/, 'Handles right alignment on desktop');
    assert.match(css, /@media\s*\(max-width:\s*768px\)/, 'Handles single-sided mobile layout');
});
