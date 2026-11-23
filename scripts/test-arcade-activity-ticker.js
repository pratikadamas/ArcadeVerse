const test = require('node:test');
const assert = require('node:assert');
const { ArcadeActivityTicker } = require('../assets/js/arcade-activity-ticker.js');

test('ArcadeActivityTicker manages events list and bounds', () => {
  const ticker = new ArcadeActivityTicker({ maxEvents: 5 });
  assert.strictEqual(ticker.events.length, 2); // Initial demo feed

  ticker.addEvent({ type: 'highScore', user: 'Nova', game: 'Cyber Snake', score: 990 });
  assert.strictEqual(ticker.events.length, 3);
  assert.strictEqual(ticker.events[0].user, 'Nova');
});

test('ArcadeActivityTicker formats event announcements and toggles pause/collapse', () => {
  const ticker = new ArcadeActivityTicker();
  const text = ticker.formatEventText({ type: 'achievement', user: 'Viper', game: 'Tetris', achievement: 'Line Clearer' });
  assert.ok(text.includes('Viper'));
  assert.ok(text.includes('Line Clearer'));

  assert.strictEqual(ticker.paused, false);
  ticker.setPaused(true);
  assert.strictEqual(ticker.paused, true);

  assert.strictEqual(ticker.collapsed, false);
  ticker.toggleCollapse();
  assert.strictEqual(ticker.collapsed, true);

  const html = ticker.renderHtml();
  assert.ok(html.includes('collapsed'));
});
