/**
 * Automated Unit Tests for WCAG Contrast Checker & Custom Neon Palette Theme Studio (#1103)
 * Run via: node --test scripts/test-theme-studio.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const studio = require('../assets/js/theme-studio.js');

test('parseColor parses 3-digit, 6-digit, 8-digit hex and rgb/rgba formats', () => {
  // 3-digit hex
  const c3 = studio.parseColor('#fff');
  assert.equal(c3.r, 255);
  assert.equal(c3.g, 255);
  assert.equal(c3.b, 255);
  assert.equal(c3.a, 1);

  // 6-digit hex
  const c6 = studio.parseColor('#0c0e14');
  assert.equal(c6.r, 12);
  assert.equal(c6.g, 14);
  assert.equal(c6.b, 20);
  assert.equal(c6.a, 1);

  // 8-digit hex with alpha
  const c8 = studio.parseColor('#0c0e1480');
  assert.equal(c8.r, 12);
  assert.equal(c8.g, 14);
  assert.equal(c8.b, 20);
  assert.ok(c8.a >= 0.49 && c8.a <= 0.51);

  // RGB and RGBA strings
  const crgb = studio.parseColor('rgb(255, 0, 128)');
  assert.equal(crgb.r, 255);
  assert.equal(crgb.g, 0);
  assert.equal(crgb.b, 128);

  const crgba = studio.parseColor('rgba(10, 20, 30, 0.75)');
  assert.equal(crgba.r, 10);
  assert.equal(crgba.g, 20);
  assert.equal(crgba.b, 30);
  assert.equal(crgba.a, 0.75);

  // Invalid fallback
  const cInvalid = studio.parseColor('invalid-color');
  assert.equal(cInvalid.r, 0);
  assert.equal(cInvalid.g, 0);
  assert.equal(cInvalid.b, 0);
});

test('getRelativeLuminance computes standard WCAG 2.1 relative luminance', () => {
  // Pure black
  assert.equal(studio.getRelativeLuminance('#000000'), 0);

  // Pure white
  assert.equal(studio.getRelativeLuminance('#ffffff'), 1);

  // Standard sRGB primaries
  const redLum = studio.getRelativeLuminance('#ff0000');
  assert.ok(Math.abs(redLum - 0.2126) < 0.001);

  const greenLum = studio.getRelativeLuminance('#00ff00');
  assert.ok(Math.abs(greenLum - 0.7152) < 0.001);

  const blueLum = studio.getRelativeLuminance('#0000ff');
  assert.ok(Math.abs(blueLum - 0.0722) < 0.001);
});

test('getContrastRatio computes exact contrast ratio (L1 + 0.05) / (L2 + 0.05)', () => {
  // Pure black on pure white (maximum possible contrast 21:1)
  const maxRatio = studio.getContrastRatio('#ffffff', '#000000');
  assert.equal(maxRatio, 21);

  // Inverted order should give identical ratio
  const maxRatioInverted = studio.getContrastRatio('#000000', '#ffffff');
  assert.equal(maxRatioInverted, 21);

  // Identical colors should give minimum ratio 1:1
  const sameRatio = studio.getContrastRatio('#123456', '#123456');
  assert.equal(sameRatio, 1);

  // White text on dark platform background (#0c0e14)
  const platformRatio = studio.getContrastRatio('#f8fafc', '#0c0e14');
  assert.ok(platformRatio > 16.0);
});

test('evaluateCompliance categorizes contrast into WCAG AAA, AA, and Fail tiers', () => {
  // High contrast (>= 7:1) -> Pass AAA
  const aaa = studio.evaluateCompliance(15.2);
  assert.equal(aaa.overallRating, 'PASS (AAA)');
  assert.equal(aaa.normalTextAAA, true);
  assert.equal(aaa.normalTextAA, true);
  assert.equal(aaa.isValidForBody, true);

  // Medium contrast (4.5 <= CR < 7.0) -> Pass AA
  const aa = studio.evaluateCompliance(5.2);
  assert.equal(aa.overallRating, 'PASS (AA)');
  assert.equal(aa.normalTextAAA, false);
  assert.equal(aa.normalTextAA, true);
  assert.equal(aa.isValidForBody, true);

  // Failing contrast (< 4.5:1) -> Fail
  const fail = studio.evaluateCompliance(3.2);
  assert.ok(fail.overallRating.includes('FAIL'));
  assert.equal(fail.normalTextAA, false);
  assert.equal(fail.isValidForBody, false);
});

test('All built-in PRESET_PALETTES pass WCAG AA and AAA accessibility standards', () => {
  for (const preset of studio.PRESET_PALETTES) {
    const check = studio.validateThemeAccessibility(preset);
    assert.equal(check.isValid, true, `Preset "${preset.name}" must pass WCAG AA: ${check.failureReason}`);
    assert.ok(check.mainRatio >= 4.5);
    assert.ok(check.cardRatio >= 4.5);
  }
});

test('validateThemeAccessibility blocks inaccessible color combinations', () => {
  // Inaccessible palette: dark gray text on black background (CR ~ 2.8:1)
  const badPalette = {
    bgMain: '#050505',
    bgCard: '#101010',
    accentPrimary: '#00f0ff',
    textPrimary: '#444444' // Failing dark gray text
  };

  const check = studio.validateThemeAccessibility(badPalette);
  assert.equal(check.isValid, false);
  assert.ok(check.failureReason.includes('minimum 4.5:1 required'));
});

test('autoFixContrast adjusts text color luminance to achieve passing WCAG contrast', () => {
  const badText = '#333333';
  const darkBg = '#0c0e14';

  const initialRatio = studio.getContrastRatio(badText, darkBg);
  assert.ok(initialRatio < 4.5);

  const fixedColor = studio.autoFixContrast(badText, darkBg, 4.5);
  const fixedRatio = studio.getContrastRatio(fixedColor, darkBg);

  assert.ok(fixedRatio >= 4.5, `Expected fixed ratio >= 4.5, got ${fixedRatio}`);
});

test('exportToCssVariables formats CSS custom properties', () => {
  const palette = {
    bgMain: '#0c0e14',
    bgCard: '#131722',
    accentPrimary: '#00f0ff',
    textPrimary: '#f8fafc'
  };

  const css = studio.exportToCssVariables(palette);
  assert.ok(css.includes(':root {'));
  assert.ok(css.includes('--bg-main: #0c0e14;'));
  assert.ok(css.includes('--bg-card: #131722;'));
  assert.ok(css.includes('--accent-primary: #00f0ff;'));
  assert.ok(css.includes('--text-primary: #f8fafc;'));
});

test('exportToJson and importFromJson support safe bidirectional export/import with validation', () => {
  const palette = {
    name: 'Test Neon Palette',
    bgMain: '#050508',
    bgCard: '#101018',
    accentPrimary: '#ff007f',
    textPrimary: '#ffffff'
  };

  const jsonStr = studio.exportToJson(palette);
  const res = studio.importFromJson(jsonStr);

  assert.equal(res.ok, true);
  assert.equal(res.palette.bgMain, '#050508');
  assert.equal(res.palette.accentPrimary, '#ff007f');

  // Rejects inaccessible imported payload
  const badJson = JSON.stringify({
    colors: {
      '--bg-main': '#000000',
      '--bg-card': '#050505',
      '--accent-primary': '#00f0ff',
      '--text-primary': '#333333'
    }
  });

  const badRes = studio.importFromJson(badJson);
  assert.equal(badRes.ok, false);
  assert.ok(badRes.error.includes('Theme rejected'));
});

test('Ensures zero Unicode emojis in theme studio script and stylesheet', () => {
  const jsPath = require.resolve('../assets/js/theme-studio.js');
  const cssPath = require.resolve('../assets/css/theme-studio.css');
  const customizerJsPath = require.resolve('../assets/js/theme-customizer.js');
  const solarizedCssPath = require.resolve('../assets/css/theme-solarized-cyber.css');

  const jsContent = fs.readFileSync(jsPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const customizerJsContent = fs.readFileSync(customizerJsPath, 'utf8');
  const solarizedCssContent = fs.readFileSync(solarizedCssPath, 'utf8');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  assert.equal(emojiRegex.test(jsContent), false, 'Found emoji in theme-studio.js');
  assert.equal(emojiRegex.test(cssContent), false, 'Found emoji in theme-studio.css');
  assert.equal(emojiRegex.test(customizerJsContent), false, 'Found emoji in theme-customizer.js');
  assert.equal(emojiRegex.test(solarizedCssContent), false, 'Found emoji in theme-solarized-cyber.css');
});

test('Solarized Cyber Dark and Light palettes guarantee strict WCAG 2.1 AAA contrast compliance', () => {
  const customizer = require('../assets/js/theme-customizer.js');
  assert.ok(customizer.SOLARIZED_PALETTES);

  const dark = customizer.SOLARIZED_PALETTES.dark;
  const light = customizer.SOLARIZED_PALETTES.light;

  // Dark Mode Contrast
  assert.equal(dark.bgMain, '#002b36');
  assert.equal(dark.bgCard, '#073642');
  assert.equal(dark.accentPrimary, '#2aa198');
  assert.equal(dark.accentSecondary, '#b58900');

  const darkTextMainCR = studio.getContrastRatio(dark.textPrimary, dark.bgMain);
  const darkTextCardCR = studio.getContrastRatio(dark.textPrimary, dark.bgCard);
  const darkSecMainCR = studio.getContrastRatio(dark.textSecondary, dark.bgMain);
  const darkSecCardCR = studio.getContrastRatio(dark.textSecondary, dark.bgCard);

  assert.ok(darkTextMainCR >= 7.0, `Dark textPrimary on bgMain must be >= 7.0 (AAA): got ${darkTextMainCR}`);
  assert.ok(darkTextCardCR >= 7.0, `Dark textPrimary on bgCard must be >= 7.0 (AAA): got ${darkTextCardCR}`);
  assert.ok(darkSecMainCR >= 7.0, `Dark textSecondary on bgMain must be >= 7.0 (AAA): got ${darkSecMainCR}`);
  assert.ok(darkSecCardCR >= 7.0, `Dark textSecondary on bgCard must be >= 7.0 (AAA): got ${darkSecCardCR}`);

  // Dark badge and button states
  const darkBadgeCR = studio.getContrastRatio(dark.badgeText, dark.badgeBg);
  assert.ok(darkBadgeCR >= 7.0, `Dark badge text must be >= 7.0 (AAA): got ${darkBadgeCR}`);

  // Light Mode Contrast
  assert.equal(light.bgMain, '#fdf6e3');
  assert.equal(light.bgCard, '#eee8d5');
  assert.equal(light.accentPrimary, '#2aa198');
  assert.equal(light.accentSecondary, '#cb4b16');

  const lightTextMainCR = studio.getContrastRatio(light.textPrimary, light.bgMain);
  const lightTextCardCR = studio.getContrastRatio(light.textPrimary, light.bgCard);
  const lightSecMainCR = studio.getContrastRatio(light.textSecondary, light.bgMain);
  const lightSecCardCR = studio.getContrastRatio(light.textSecondary, light.bgCard);

  assert.ok(lightTextMainCR >= 7.0, `Light textPrimary on bgMain must be >= 7.0 (AAA): got ${lightTextMainCR}`);
  assert.ok(lightTextCardCR >= 7.0, `Light textPrimary on bgCard must be >= 7.0 (AAA): got ${lightTextCardCR}`);
  assert.ok(lightSecMainCR >= 7.0, `Light textSecondary on bgMain must be >= 7.0 (AAA): got ${lightSecMainCR}`);
  assert.ok(lightSecCardCR >= 7.0, `Light textSecondary on bgCard must be >= 7.0 (AAA): got ${lightSecCardCR}`);

  // Light badge and button states
  const lightBadgeCR = studio.getContrastRatio(light.badgeText, light.badgeBg);
  assert.ok(lightBadgeCR >= 7.0, `Light badge text must be >= 7.0 (AAA): got ${lightBadgeCR}`);

  // Sub-toggle switching API integrity
  assert.equal(typeof customizer.applySolarizedMode, 'function');
  assert.equal(typeof customizer.toggleSolarizedMode, 'function');
  assert.equal(typeof customizer.createSubToggleDOM, 'function');
});
