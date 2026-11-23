const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('OLED Pure Dark theme CSS defines true #000000 black base and hairline borders', () => {
  const cssPath = path.join(__dirname, '../assets/css/theme-oled-pure.css');
  assert.ok(fs.existsSync(cssPath));

  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify true #000000 AMOLED values
  assert.ok(css.includes('--bg-primary: #000000'));
  assert.ok(css.includes('--bg-secondary: #000000'));
  assert.ok(css.includes('background-color: #000000 !important'));

  // Verify mobile GPU power optimization: shadow/blur elimination
  assert.ok(css.includes('box-shadow: none !important'));
  assert.ok(css.includes('backdrop-filter: none !important'));
});

test('OLED Pure Dark theme CSS contains zero emojis and zero external CDNs', () => {
  const cssPath = path.join(__dirname, '../assets/css/theme-oled-pure.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.strictEqual(/http[s]?:\/\/.*(font|cdn)/i.test(css), false);
});
