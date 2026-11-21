/**
 * Automated Unit Test Suite for ArcadeCardFlipManual
 * Issue #1102 - Dynamic 3D Flip Card with Vector Controls Schematic & Quick Manual
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manualEngine = require('../assets/js/card-flip-manual.js');

test('ArcadeCardFlipManual exports all required API methods', () => {
  assert.equal(typeof manualEngine.analyzeControls, 'function');
  assert.equal(typeof manualEngine.extractManualSummary, 'function');
  assert.equal(typeof manualEngine.renderVectorKeyboardHtml, 'function');
  assert.equal(typeof manualEngine.renderFlipButtonHtml, 'function');
  assert.equal(typeof manualEngine.renderCardBackHtml, 'function');
  assert.equal(typeof manualEngine.flipCard, 'function');
  assert.equal(typeof manualEngine.bindCard, 'function');
  assert.equal(typeof manualEngine.enhanceCard, 'function');
  assert.equal(typeof manualEngine.enhanceGrid, 'function');
  assert.equal(typeof manualEngine.init, 'function');
});

test('analyzeControls correctly deduces controls for action/arcade shooter games', () => {
  const game = {
    id: 'cyber-assault',
    title: 'Cyber Assault 2026',
    category: 'Action',
    tags: ['arcade', 'shooter', 'space', 'action'],
    description: 'Shoot enemy drones and dodge projectile barrages.'
  };

  const controls = manualEngine.analyzeControls(game);
  assert.equal(controls.arrows, true, 'Arrow keys should be active for arcade shooter');
  assert.equal(controls.wasd, true, 'WASD should be active for action shooter');
  assert.equal(controls.space, true, 'Spacebar should be active for shooting');
  assert.ok(controls.schemeText.toLowerCase().includes('move') || controls.schemeText.toLowerCase().includes('steer') || controls.schemeText.toLowerCase().includes('fire'));
});

test('analyzeControls correctly deduces controls for puzzle/board games', () => {
  const game = {
    id: 'cyber-chess',
    title: 'Cyber Chess DX',
    category: 'Puzzle',
    tags: ['puzzle', 'board', 'strategy', 'click'],
    description: 'Select pieces and execute strategic chess maneuvers on a holographic board.'
  };

  const controls = manualEngine.analyzeControls(game);
  assert.equal(controls.mouse, true, 'Mouse should be active for puzzle/chess');
  assert.equal(controls.touch, true, 'Touch should be enabled for puzzle/mouse games');
});

test('analyzeControls respects explicitly defined controls in game.json', () => {
  const game = {
    id: 'custom-controller-game',
    title: 'Custom Controller Simulator',
    category: 'Simulation',
    controls: {
      wasd: true,
      arrows: false,
      space: true,
      mouse: false
    }
  };

  const controls = manualEngine.analyzeControls(game);
  assert.equal(controls.wasd, true);
  assert.equal(controls.arrows, false);
  assert.equal(controls.space, true);
  assert.equal(controls.mouse, false);
});

test('extractManualSummary formats strictly 2 sentences from explicit manual string', () => {
  const game = {
    id: 'astro-miner',
    title: 'Astro Miner',
    category: 'Arcade',
    manual: 'Navigate asteroid belts with care. Blast cosmic crystals to maximize score.'
  };

  const summary = manualEngine.extractManualSummary(game);
  assert.equal(summary.sentence1, 'Navigate asteroid belts with care.');
  assert.equal(summary.sentence2, 'Blast cosmic crystals to maximize score.');
  assert.equal(summary.fullSummary, 'Navigate asteroid belts with care. Blast cosmic crystals to maximize score.');
});

test('extractManualSummary extracts objective and rules from manual object in game.json', () => {
  const game = {
    id: 'laser-strike',
    title: 'Laser Strike',
    category: 'Action',
    manual: {
      objective: 'Eliminate incoming alien fighters before they reach Earth',
      rules: 'Dodge laser fire and collect fuel canisters to stay powered'
    }
  };

  const summary = manualEngine.extractManualSummary(game);
  assert.equal(summary.sentence1, 'Eliminate incoming alien fighters before they reach Earth.');
  assert.equal(summary.sentence2, 'Dodge laser fire and collect fuel canisters to stay powered.');
});

test('extractManualSummary synthesizes 2-sentence manual when game.description has 1 sentence', () => {
  const game = {
    id: 'neon-pinball',
    title: 'Neon Pinball DX',
    category: 'Physics',
    tags: ['pinball', 'arcade', 'physics'],
    description: 'Launch pinballs and bounce off neon bumpers to trigger multiball modes.'
  };

  const summary = manualEngine.extractManualSummary(game);
  assert.ok(summary.sentence1.startsWith('Launch pinballs'));
  assert.ok(summary.sentence1.endsWith('.'));
  assert.ok(summary.sentence2.length > 10, 'Synthesized strategy guideline exists');
  assert.ok(summary.sentence2.endsWith('.'));
});

test('renderVectorKeyboardHtml renders SVG diagram with active and dimmed keycaps', () => {
  const controls = {
    wasd: true,
    arrows: true,
    space: true,
    mouse: false,
    legendItems: [
      { key: 'WASD / ARROWS', label: 'Move & Steer' },
      { key: 'SPACE', label: 'Jump / Action' }
    ]
  };

  const html = manualEngine.renderVectorKeyboardHtml(controls);
  assert.ok(html.includes('class="keycap keycap-active" data-key="W"'));
  assert.ok(html.includes('class="keycap keycap-space keycap-active"'));
  assert.ok(html.includes('class="keycap keycap-mouse keycap-dim"'));
  assert.ok(html.includes('WASD / ARROWS'));
  assert.ok(html.includes('role="img"'));
});

test('renderCardBackHtml generates complete retro blueprint markup', () => {
  const game = {
    id: 'retro-racer',
    title: 'Retro Highway Racer',
    category: 'Racing',
    difficulty: 'Hard',
    tags: ['arcade', 'racer', 'action'],
    description: 'Outrun highway patrols at extreme speeds. Collect nitrous canisters to sustain turbo velocity.'
  };

  const html = manualEngine.renderCardBackHtml(game);
  assert.ok(html.includes('id="card-manual-retro-racer"'));
  assert.ok(html.includes('BLUEPRINT // 01'));
  assert.ok(html.includes('Retro Highway Racer'));
  assert.ok(html.includes('INPUT SCHEMATIC'));
  assert.ok(html.includes('MISSION PROTOCOL'));
  assert.ok(html.includes('btn-blueprint-launch'));
  assert.ok(html.includes('btn-card-flip-back'));
  assert.ok(html.includes('DIFFICULTY:'));
  assert.ok(html.includes('Hard'));
});

test('renderFlipButtonHtml generates accessible button with aria attributes', () => {
  const game = {
    id: 'cyber-snake',
    title: 'Cyber Snake'
  };

  const html = manualEngine.renderFlipButtonHtml(game);
  assert.ok(html.includes('class="btn-card-manual-flip"'));
  assert.ok(html.includes('data-id="cyber-snake"'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes('aria-controls="card-manual-cyber-snake"'));
  assert.ok(html.includes('title="Controls &amp; Manual (Flip Card)"'));
});

test('flipCard correctly toggles is-flipped class and aria states', () => {
  // Mock DOM Card Element
  const card = {
    classList: {
      _classes: new Set(['game-card']),
      contains: function (c) { return this._classes.has(c); },
      add: function (c) { this._classes.add(c); },
      remove: function (c) { this._classes.delete(c); }
    },
    querySelector: function (sel) {
      if (sel === '.btn-card-manual-flip') return flipBtn;
      if (sel === '.game-card-back') return back;
      if (sel === '.game-card-front') return front;
      return null;
    }
  };

  const flipBtn = {
    attrs: {},
    setAttribute: function (k, v) { this.attrs[k] = String(v); },
    focus: function () {}
  };
  const back = {
    attrs: {},
    setAttribute: function (k, v) { this.attrs[k] = String(v); }
  };
  const front = {
    attrs: {},
    setAttribute: function (k, v) { this.attrs[k] = String(v); }
  };

  manualEngine.flipCard(card, true);
  assert.equal(card.classList.contains('is-flipped'), true);
  assert.equal(flipBtn.attrs['aria-expanded'], 'true');
  assert.equal(back.attrs['aria-hidden'], 'false');
  assert.equal(front.attrs['aria-hidden'], 'true');

  manualEngine.flipCard(card, false);
  assert.equal(card.classList.contains('is-flipped'), false);
  assert.equal(flipBtn.attrs['aria-expanded'], 'false');
  assert.equal(back.attrs['aria-hidden'], 'true');
  assert.equal(front.attrs['aria-hidden'], 'false');
});

test('Ensures zero Unicode emojis in card-flip script and stylesheet', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const jsContent = fs.readFileSync(path.join(__dirname, '../assets/js/card-flip-manual.js'), 'utf8');
  const cssContent = fs.readFileSync(path.join(__dirname, '../assets/css/card-flip-manual.css'), 'utf8');

  assert.equal(emojiRegex.test(jsContent), false, 'Found forbidden Unicode emoji in card-flip-manual.js');
  assert.equal(emojiRegex.test(cssContent), false, 'Found forbidden Unicode emoji in card-flip-manual.css');
});
