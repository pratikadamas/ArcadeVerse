const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const auditor = require('../assets/js/dev-asset-auditor.js');
const root = 'https://arcade.example/ArcadeVerse/';
const game = root + 'games/example/index.html';

test('redacts query strings, fragments and embedded credentials from report URLs', () => {
  assert.equal(auditor.publicUrl('https://user:password@arcade.example/a.png?token=secret#key'), 'https://arcade.example/a.png');
  assert.equal(auditor.publicUrl('data:image/png;base64,private-data'), 'data:[inline or unsupported]');
  assert.equal(auditor.publicUrl('javascript:secret()'), 'javascript:[inline or unsupported]');
  assert.equal(auditor.publicUrl('image.png?key=secret', game), root + 'games/example/image.png');
});
test('restricts probes to same-origin public assets and games inside the deployment prefix', () => {
  assert.equal(auditor.classifyUrl('style.css', game, root).allowed, true);
  assert.equal(auditor.classifyUrl('../../assets/js/arcadeverse-sdk.js', game, root).allowed, true);
  for (const value of ['https://external.example/font.woff2', '/api/session', '/games/outside-prefix.js', '../../assets/../../../api/me', 'javascript:alert(1)', 'data:text/html,private', 'https://u:p@arcade.example/ArcadeVerse/assets/x.js']) {
    assert.equal(auditor.classifyUrl(value, game, root).allowed, false, value);
  }
});
test('external and opaque resources stay unknown rather than becoming fake 404s', () => {
  const result = auditor.classifyUrl('https://fonts.example/font.woff2?key=secret', game, root);
  assert.equal(result.allowed, false); assert.match(result.note, /not verified/);
  assert.equal(result.label.includes('secret'), false);
  assert.equal(result.note.includes('404'), false);
});
test('flags unencoded characters while preserving the actual normalized probe URL', () => {
  const result = auditor.classifyUrl('my image.png?size=2', game, root);
  assert.equal(result.allowed, true); assert.match(result.note, /Unencoded/);
  assert.match(result.url, /my%20image\.png\?size=2/);
  assert.equal(result.label.includes('?'), false);
  assert.match(auditor.classifyUrl('image%ZZ.png', game, root).note, /Unencoded/);
});
test('discovers CSS imports and URL assets without executing inline data or fragment references', () => {
  assert.deepEqual(auditor.cssUrls('@import "theme.css"; @import url("other.css"); .x{background:url(../img/a.png)} @font-face{src:url(font.woff2)} .y{filter:url(#filter);background:url(data:image/png;base64,abc)}'), [
    { value: 'theme.css', kind: 'style' }, { value: 'other.css', kind: 'style' },
    { value: '../img/a.png', kind: 'asset' }, { value: 'font.woff2', kind: 'asset' }
  ]);
});
test('normal mode installs no observers, event listeners, globals or UI', () => {
  const source = fs.readFileSync(require.resolve('../assets/js/dev-asset-auditor.js'), 'utf8');
  for (const search of ['', '?debug=other', '?debug=ASSETS']) {
    let installed = 0;
    const window = { location: { href: root + 'index.html' + search }, addEventListener() { installed++; } };
    const document = { addEventListener() { installed++; }, createElement() { installed++; throw new Error('UI in normal mode'); } };
    vm.runInNewContext(source, { URL, window, document, PerformanceObserver: class { constructor() { installed++; } } });
    assert.equal(installed, 0); assert.equal(window.ArcadeAssetAuditor, undefined);
  }
});
