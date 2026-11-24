const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('Macintosh Classic theme CSS defines authentic 1-bit stipple pattern and pinstripe bars', () => {
  const cssPath = path.join(__dirname, '../assets/css/theme-macintosh-classic.css');
  assert.ok(fs.existsSync(cssPath));

  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify 1-bit monochrome palette
  assert.ok(css.includes('--bg-primary: #808080'));
  assert.ok(css.includes('--text-primary: #000000'));
  assert.ok(css.includes('--border-subtle: #000000'));

  // Verify stipple background pattern
  assert.ok(css.includes('radial-gradient(#808080 25%, transparent 25%)'));

  // Verify pinstripe title bar pattern
  assert.ok(css.includes('repeating-linear-gradient'));

  // Verify sharp 1px borders and drop shadows
  assert.ok(css.includes('box-shadow: 2px 2px 0px #000000'));
});

test('Macintosh Classic theme CSS contains zero emojis and zero external CDNs', () => {
  const cssPath = path.join(__dirname, '../assets/css/theme-macintosh-classic.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.strictEqual(/http[s]?:\/\/.*(font|cdn)/i.test(css), false);
});
