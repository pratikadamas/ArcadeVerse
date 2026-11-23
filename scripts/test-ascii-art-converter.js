/**
 * Automated Unit Tests for Retro ASCII / ANSI Canvas Art Terminal Converter (#1107)
 * Run via: node --test scripts/test-ascii-art-converter.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const converter = require('../assets/js/ascii-art-converter.js');

test('computeLuminance computes standard ITU-R BT.709 perceived luminance', () => {
  // Pure black
  assert.equal(converter.computeLuminance(0, 0, 0), 0);

  // Pure white
  assert.equal(converter.computeLuminance(255, 255, 255), 1);

  // Primaries according to coefficients
  const redLum = converter.computeLuminance(255, 0, 0);
  assert.ok(Math.abs(redLum - 0.2126) < 0.001);

  const greenLum = converter.computeLuminance(0, 255, 0);
  assert.ok(Math.abs(greenLum - 0.7152) < 0.001);

  const blueLum = converter.computeLuminance(0, 0, 255);
  assert.ok(Math.abs(blueLum - 0.0722) < 0.001);
});

test('mapToAnsiColor maps RGB colors to closest 16-color ANSI palette entries', () => {
  const redMatch = converter.mapToAnsiColor(240, 20, 20);
  assert.ok(redMatch.ansiCode.endsWith('31'), `Expected red ansiCode, got ${redMatch.ansiCode}`);
  assert.ok(redMatch.hex.startsWith('#'));

  const cyanMatch = converter.mapToAnsiColor(0, 240, 255);
  assert.ok(cyanMatch.ansiCode.endsWith('36'), `Expected cyan ansiCode, got ${cyanMatch.ansiCode}`);

  const greenMatch = converter.mapToAnsiColor(20, 230, 40);
  assert.ok(greenMatch.ansiCode.endsWith('32'), `Expected green ansiCode, got ${greenMatch.ansiCode}`);

  const blackMatch = converter.mapToAnsiColor(10, 10, 10);
  assert.ok(blackMatch.ansiCode.endsWith('30'), `Expected black ansiCode, got ${blackMatch.ansiCode}`);
});

test('convertPixelBuffer downscales and converts RGBA buffer to ASCII rows', () => {
  // Create a 4x2 test pixel buffer:
  // Row 0: White (255,255,255,255), Black (0,0,0,255), Red (255,0,0,255), Transparent (0,0,0,0)
  // Row 1: Green (0,255,0,255), Blue (0,0,255,255), Gray (128,128,128,255), White (255,255,255,255)
  const pixels = new Uint8ClampedArray([
    // Row 0
    255, 255, 255, 255,
    0, 0, 0, 255,
    255, 0, 0, 255,
    0, 0, 0, 0,
    // Row 1
    0, 255, 0, 255,
    0, 0, 255, 255,
    128, 128, 128, 255,
    255, 255, 255, 255
  ]);

  const result = converter.convertPixelBuffer(pixels, 4, 2);

  assert.equal(result.width, 4);
  assert.equal(result.height, 2);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].length, 4);
  assert.equal(result.rows[1].length, 4);

  // In dark-background mode (invert=false), pure white maps to '@' (dense)
  assert.equal(result.rows[0][0].char, '@');

  // Pure black maps to ' ' (space)
  assert.equal(result.rows[0][1].char, ' ');

  // Transparent pixel maps to ' '
  assert.equal(result.rows[0][3].char, ' ');

  // Raw text has 2 lines joined by newline
  const lines = result.rawText.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].length, 4);
  assert.equal(lines[1].length, 4);
});

test('convertPixelBuffer honors invert, contrast, and custom ramps', () => {
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255,
    0, 0, 0, 255
  ]);

  // Normal: White -> '@', Black -> ' '
  const normal = converter.convertPixelBuffer(pixels, 2, 1, { invert: false });
  assert.equal(normal.rows[0][0].char, '@');
  assert.equal(normal.rows[0][1].char, ' ');

  // Inverted: White -> ' ', Black -> '@'
  const inverted = converter.convertPixelBuffer(pixels, 2, 1, { invert: true });
  assert.equal(inverted.rows[0][0].char, ' ');
  assert.equal(inverted.rows[0][1].char, '@');

  // Custom minimal ramp
  const custom = converter.convertPixelBuffer(pixels, 2, 1, { ramp: '#. ' });
  assert.equal(custom.rows[0][0].char, '#');
  assert.equal(custom.rows[0][1].char, ' ');
});

test('formatDiscord generates valid Discord code blocks with ANSI or monochrome styling', () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 255
  ]);
  const art = converter.convertPixelBuffer(pixels, 2, 1);

  // ANSI colored block
  const discordColor = converter.formatDiscord(art, { color: true });
  assert.ok(discordColor.startsWith('```ansi\n'));
  assert.ok(discordColor.endsWith('\n```'));
  assert.ok(discordColor.includes('\u001b['));

  // Monochrome block
  const discordMono = converter.formatDiscord(art, { color: false });
  assert.ok(discordMono.startsWith('```\n'));
  assert.ok(discordMono.endsWith('\n```'));
  assert.equal(discordMono.includes('\u001b['), false);

  // Metadata header inclusion
  const withHeader = converter.formatDiscord(art, {
    color: false,
    includeHeader: true,
    metadata: { title: 'Cyber Snake', score: 9990, author: 'Babin' }
  });
  assert.ok(withHeader.includes('CYBER SNAKE'));
  assert.ok(withHeader.includes('Score: 9990'));
  assert.ok(withHeader.includes('Babin'));
});

test('formatRawAscii and formatTerminalAnsi generate clean text representations', () => {
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255,
    0, 0, 0, 255
  ]);
  const art = converter.convertPixelBuffer(pixels, 2, 1);

  const raw = converter.formatRawAscii(art);
  assert.equal(raw, '@ ');

  const term = converter.formatTerminalAnsi(art);
  assert.ok(term.includes('\x1b['));
  assert.ok(term.includes('@'));
  assert.ok(term.endsWith('\x1b[0m\n') || term.endsWith('\n'));
});

test('renderHtmlPreview escapes special characters and outputs color spans', () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 240, 255, 255
  ]);
  const art = converter.convertPixelBuffer(pixels, 2, 1);

  const htmlColored = converter.renderHtmlPreview(art, true);
  assert.ok(htmlColored.includes('<span style="color:'));
  assert.ok(htmlColored.includes('</span>'));

  // Test HTML escaping for dangerous characters
  const mockArt = {
    rows: [[
      { char: '<', color: { hex: '#ff0000' } },
      { char: '>', color: { hex: '#00ff00' } },
      { char: '&', color: { hex: '#0000ff' } }
    ]]
  };
  const escaped = converter.renderHtmlPreview(mockArt, true);
  assert.ok(escaped.includes('&lt;'));
  assert.ok(escaped.includes('&gt;'));
  assert.ok(escaped.includes('&amp;'));
  assert.equal(escaped.includes('<script>'), false);
});

test('handles empty or malformed inputs without throwing', () => {
  const empty = converter.convertPixelBuffer(null, 0, 0);
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.rawText, '');

  const noRows = converter.formatDiscord(null);
  assert.equal(noRows, '');

  const noRaw = converter.formatRawAscii(null);
  assert.equal(noRaw, '');

  const noHtml = converter.renderHtmlPreview(null);
  assert.equal(noHtml, '');
});

test('ensures zero unicode emojis exist in the converter codebase', () => {
  const fs = require('fs');
  const code = fs.readFileSync(require.resolve('../assets/js/ascii-art-converter.js'), 'utf8');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(code), false, 'Found unicode emoji in assets/js/ascii-art-converter.js');
});
