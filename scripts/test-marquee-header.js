/**
 * Automated Unit Test Suite for ArcadeMarqueeHeader
 * Issue #1367 - Floating Retro Arcade Marquee Header Banner with Dynamic Sound Waves
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MarqueeHeader = require('../assets/js/marquee-header.js');

test('ArcadeMarqueeHeader exports all required API methods', () => {
  assert.equal(typeof MarqueeHeader.init, 'function');
  assert.equal(typeof MarqueeHeader.renderBulbTrack, 'function');
  assert.equal(typeof MarqueeHeader.render, 'function');
  assert.equal(typeof MarqueeHeader.bindEvents, 'function');
  assert.equal(typeof MarqueeHeader.setChaseMode, 'function');
  assert.equal(typeof MarqueeHeader.updateLifecycleState, 'function');
  assert.equal(typeof MarqueeHeader.initAudioHook, 'function');
  assert.equal(typeof MarqueeHeader.attachAnalyser, 'function');
  assert.equal(typeof MarqueeHeader.startWaveformLoop, 'function');
  assert.equal(typeof MarqueeHeader.renderWaveform, 'function');
  assert.equal(typeof MarqueeHeader.destroy, 'function');
});

test('renderBulbTrack generates correct number of neon bulbs with accessibility attributes', () => {
  const count = 28;
  const trackHtml = MarqueeHeader.renderBulbTrack(count, 'test-track');

  assert.ok(trackHtml.includes('arcade-marquee-chase-track test-track'));
  assert.ok(trackHtml.includes('aria-hidden="true"'));
  assert.ok(trackHtml.includes('role="presentation"'));

  const bulbMatches = trackHtml.match(/class="marquee-bulb"/g);
  assert.equal(bulbMatches ? bulbMatches.length : 0, count, 'Should produce exact bulb count');
});

test('setChaseMode updates component data attribute and active states', () => {
  const dummyFrame = {
    mode: '',
    setAttribute(attr, val) {
      if (attr === 'data-chase-mode') this.mode = val;
    }
  };

  const oldFrame = MarqueeHeader.frame;
  MarqueeHeader.frame = dummyFrame;

  MarqueeHeader.setChaseMode('alternating');
  assert.equal(dummyFrame.mode, 'alternating');
  assert.equal(MarqueeHeader.currentMode, 'alternating');

  MarqueeHeader.setChaseMode('pulse');
  assert.equal(dummyFrame.mode, 'pulse');
  assert.equal(MarqueeHeader.currentMode, 'pulse');

  MarqueeHeader.setChaseMode('sequential');
  assert.equal(dummyFrame.mode, 'sequential');
  assert.equal(MarqueeHeader.currentMode, 'sequential');

  MarqueeHeader.frame = oldFrame;
});

test('updateLifecycleState properly applies is-paused class during tab inactive or reduced-motion', () => {
  const dummyClassList = new Set();
  const dummyFrame = {
    classList: {
      add(cls) { dummyClassList.add(cls); },
      remove(cls) { dummyClassList.delete(cls); },
      contains(cls) { return dummyClassList.has(cls); }
    }
  };

  const oldFrame = MarqueeHeader.frame;
  MarqueeHeader.frame = dummyFrame;

  // Active tab, no reduced motion -> not paused
  MarqueeHeader.isTabActive = true;
  MarqueeHeader.isReducedMotion = false;
  MarqueeHeader.updateLifecycleState();
  assert.equal(dummyFrame.classList.contains('is-paused'), false);

  // Inactive tab -> is-paused added
  MarqueeHeader.isTabActive = false;
  MarqueeHeader.isReducedMotion = false;
  MarqueeHeader.updateLifecycleState();
  assert.equal(dummyFrame.classList.contains('is-paused'), true);

  // Active tab, but user prefers reduced motion -> is-paused added
  MarqueeHeader.isTabActive = true;
  MarqueeHeader.isReducedMotion = true;
  MarqueeHeader.updateLifecycleState();
  assert.equal(dummyFrame.classList.contains('is-paused'), true);

  MarqueeHeader.frame = oldFrame;
});

test('attachAnalyser safely configures AudioContext analyser and frequency bins', () => {
  const dummyCtx = {
    createAnalyser() {
      return {
        fftSize: 0,
        frequencyBinCount: 32
      };
    }
  };

  MarqueeHeader.audioConnected = false;
  MarqueeHeader.attachAnalyser(dummyCtx);
  assert.equal(MarqueeHeader.audioConnected, true);
  assert.ok(MarqueeHeader.analyser);
  assert.equal(MarqueeHeader.analyser.fftSize, 64);
  assert.equal(MarqueeHeader.dataArray.length, 32);
});

test('CSS file contains container queries, rivet styles, and reduced-motion rules', () => {
  const cssPath = path.resolve(__dirname, '../assets/css/marquee-header.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert.ok(cssContent.includes('container-type: inline-size;'), 'Must support CSS container queries');
  assert.ok(cssContent.includes('@container arcade-marquee'), 'Must define responsive @container query rules');
  assert.ok(cssContent.includes('arcade-rivet'), 'Must include metallic rivet styling');
  assert.ok(cssContent.includes('arcade-marquee-acrylic-plate'), 'Must include back-lit acrylic plate styling');
  assert.ok(cssContent.includes('data-chase-mode="sequential"'), 'Must define sequential chase animation');
  assert.ok(cssContent.includes('data-chase-mode="alternating"'), 'Must define alternating blink animation');
  assert.ok(cssContent.includes('data-chase-mode="pulse"'), 'Must define sound-reactive pulse mode');
  assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Must pause keyframes when user prefers reduced motion');
  assert.ok(cssContent.includes('.is-paused'), 'Must support paused state when user tabs out');
});

test('index.html includes marquee stylesheet and script tags', () => {
  const indexPath = path.resolve(__dirname, '../index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  assert.ok(indexContent.includes('assets/css/marquee-header.css'), 'index.html should link marquee-header.css');
  assert.ok(indexContent.includes('assets/js/marquee-header.js'), 'index.html should load marquee-header.js');
});

test('Ensures zero Unicode emojis in marquee-header script and stylesheet', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
  const jsContent = fs.readFileSync(path.resolve(__dirname, '../assets/js/marquee-header.js'), 'utf8');
  const cssContent = fs.readFileSync(path.resolve(__dirname, '../assets/css/marquee-header.css'), 'utf8');

  assert.equal(emojiRegex.test(jsContent), false, 'Found forbidden Unicode emoji in marquee-header.js');
  assert.equal(emojiRegex.test(cssContent), false, 'Found forbidden Unicode emoji in marquee-header.css');
});
