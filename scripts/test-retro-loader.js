const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RetroLoaderManager } = require('../assets/js/retro-loader.js');

test('RetroLoaderManager calculates block segments and transitions stage texts', () => {
    let stageText = '';
    let pctText = '';
    const blocks = [];

    for (let i = 0; i < 10; i++) {
        const classSet = new Set();
        blocks.push({
            classList: {
                add: (c) => classSet.add(c),
                remove: (c) => classSet.delete(c),
                contains: (c) => classSet.has(c)
            }
        });
    }

    const mockContainer = {
        setAttribute: () => {},
        querySelector: (sel) => {
            if (sel === '.retro-loader-stage-text') return { set textContent(v) { stageText = v; } };
            if (sel === '.retro-loader-percent') return { set textContent(v) { pctText = v; } };
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel === '.retro-loader-block') return blocks;
            return [];
        }
    };

    const loader = new RetroLoaderManager({ segments: 10 });
    loader.containerElement = mockContainer;

    // 20% progress
    loader.setProgress(20);
    assert.equal(loader.currentProgress, 20);
    assert.equal(stageText, 'Loading ROM Cartridge...');
    assert.equal(pctText, '20%');
    assert.equal(blocks[0].classList.contains('active'), true);
    assert.equal(blocks[1].classList.contains('active'), true);
    assert.equal(blocks[2].classList.contains('active'), false);

    // 70% progress
    loader.setProgress(70);
    assert.equal(stageText, 'Mounting Audio Synth...');

    // 100% progress
    loader.setProgress(100);
    assert.equal(stageText, 'READY!');
    assert.equal(blocks[9].classList.contains('active'), true);
});

test('retro-loader.css contains neon block styles and fade transition', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/retro-loader.css');
    assert.ok(fs.existsSync(cssPath), 'retro-loader.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.retro-loader-container/, 'Styles container');
    assert.match(css, /\.retro-loader-block\.active/, 'Styles active neon glowing segment block');
    assert.match(css, /\.retro-loader-container\.fade-out/, 'Handles fade-out dismissal');
});
