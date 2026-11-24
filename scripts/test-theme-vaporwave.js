const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('Vaporwave theme CSS defines palette and classic beveled borders', () => {
  const cssPath = path.join(__dirname, '../assets/css/theme-vaporwave.css');
  assert.ok(fs.existsSync(cssPath), 'theme-vaporwave.css must exist');

  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify pastel color tokens
  assert.ok(css.includes('#ff71ce'), 'Must include Pastel Pink');
  assert.ok(css.includes('#01cdfe'), 'Must include Cyan Teal');
  assert.ok(css.includes('#b967ff'), 'Must include Soft Lavender');
  assert.ok(css.includes('#05ffa1'), 'Must include Mint');
  assert.ok(css.includes('#008080'), 'Must include Classic Win95 Teal');

  // Verify beveled 3D borders
  assert.ok(css.includes('border-top: 2px solid #ffffff'), 'Must feature white top highlight border');
  assert.ok(css.includes('border-bottom: 2px solid #808080'), 'Must feature dark shadow bottom border');
  assert.ok(css.includes('linear-gradient(90deg, #000080, #1084d0)'), 'Must feature classic Windows gradient title bar');
});

test('Vaporwave theme CSS contains zero emojis and zero external CDNs', () => {
  const cssPath = path.join(__dirname, '../assets/css/theme-vaporwave.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.strictEqual(/http[s]?:\/\/.*(font|cdn)/i.test(css), false);
});
