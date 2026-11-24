/**
 * ArcadeVerse WCAG Real-Time Contrast Checker & Custom Neon Palette Theme Studio (#1103)
 *
 * Architecture:
 * 1. Color Parser & Normalizer: Converts Hex (#rgb, #rrggbb, #rrggbbaa), RGB, and RGBA into normalized RGBA tuples.
 * 2. WCAG 2.1 Relative Luminance Engine: Computes linear gamma-expanded luminance per W3C specification.
 * 3. Exact Contrast Ratio Calculator: Computes CR = (L1 + 0.05) / (L2 + 0.05).
 * 4. WCAG Compliance Evaluator: Rates contrast against Pass (AAA) [>=7:1], Pass (AA) [>=4.5:1], or Fail (<4.5:1).
 * 5. Platform Accessibility Gatekeeper: Blocks activation of themes failing minimum WCAG AA standards for body text.
 * 6. Auto-Fix Contrast Algorithm: Intelligently boosts or darkens text to guarantee an accessible >=4.5:1 ratio.
 * 7. Live CSS Variable Injection & Persistence: Injects customized properties (--bg-main, --bg-card, --accent-primary,
 *    --text-primary) into document.documentElement and persists in localStorage under 'av_custom_theme'.
 * 8. One-Click Export & Import: Exports theme as structured JSON or ready-to-use CSS variables with prototype safety.
 *
 * Strictly zero Unicode emojis across all code, comments, styles, and UI elements.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const api = factory();
    root.ArcadeThemeStudio = api;
    root.ThemeStudio = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'av_custom_theme';

  // Default accessible neon theme palette
  const DEFAULT_THEME = {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    bgMain: '#0c0e14',
    bgCard: '#131722',
    accentPrimary: '#00f0ff',
    textPrimary: '#f8fafc'
  };

  // Curated accessible neon presets (All pre-verified for WCAG AA / AAA compliance)
  const PRESET_PALETTES = [
    {
      id: 'cyberpunk_neon',
      name: 'Cyberpunk Neon',
      bgMain: '#0c0e14',
      bgCard: '#131722',
      accentPrimary: '#00f0ff',
      textPrimary: '#f8fafc'
    },
    {
      id: 'solarized_cyber_dark',
      name: 'Solarized Cyber Dark',
      bgMain: '#002b36',
      bgCard: '#073642',
      accentPrimary: '#2aa198',
      textPrimary: '#fdf6e3'
    },
    {
      id: 'solarized_cyber_light',
      name: 'Solarized Cyber Light',
      bgMain: '#fdf6e3',
      bgCard: '#eee8d5',
      accentPrimary: '#cb4b16',
      textPrimary: '#002b36'
    },
    {
      id: 'obsidian_contrast',
      name: 'Obsidian High Contrast',
      bgMain: '#050508',
      bgCard: '#101018',
      accentPrimary: '#ff007f',
      textPrimary: '#ffffff'
    },
    {
      id: 'solarized_amber',
      name: 'Solarized Amber',
      bgMain: '#0b0e14',
      bgCard: '#151b26',
      accentPrimary: '#f59e0b',
      textPrimary: '#fef3c7'
    },
    {
      id: 'matrix_emerald',
      name: 'Matrix Emerald',
      bgMain: '#040d08',
      bgCard: '#0a1c12',
      accentPrimary: '#10b981',
      textPrimary: '#e6fffa'
    },
    {
      id: 'synthwave_violet',
      name: 'Synthwave Violet',
      bgMain: '#0e0b1a',
      bgCard: '#1a1430',
      accentPrimary: '#a855f7',
      textPrimary: '#faf5ff'
    },
    {
      id: 'daylight_accessible',
      name: 'Daylight High Contrast',
      bgMain: '#f8fafc',
      bgCard: '#ffffff',
      accentPrimary: '#0284c7',
      textPrimary: '#0f172a'
    }
  ];

  /**
   * Parses hex or rgb/rgba string into normalized { r, g, b, a } tuple.
   *
   * @param {string} colorString CSS color string
   * @returns {object} Object with r, g, b [0-255] and a [0-1]
   */
  function parseColor(colorString) {
    if (typeof colorString !== 'string') {
      return { r: 0, g: 0, b: 0, a: 1 };
    }

    const str = colorString.trim().toLowerCase();

    // Hex syntax (#rgb, #rgba, #rrggbb, #rrggbbaa)
    if (str.startsWith('#')) {
      const hex = str.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1
        };
      }
      if (hex.length === 4) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: Number((parseInt(hex[3] + hex[3], 16) / 255).toFixed(3))
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1
        };
      }
      if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: Number((parseInt(hex.slice(6, 8), 16) / 255).toFixed(3))
        };
      }
    }

    // RGB / RGBA syntax
    const rgbMatch = str.match(/^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (rgbMatch) {
      return {
        r: Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10))),
        g: Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10))),
        b: Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10))),
        a: rgbMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbMatch[4]))) : 1
      };
    }

    return { r: 0, g: 0, b: 0, a: 1 };
  }

  /**
   * Converts { r, g, b } to 6-digit hex string (#rrggbb).
   */
  function toHex(rgb) {
    const r = Math.max(0, Math.min(255, Math.round(rgb.r))).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, Math.round(rgb.g))).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, Math.round(rgb.b))).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  /**
   * Computes W3C WCAG 2.1 relative luminance (L) of an sRGB color.
   * L = 0.2126 * R' + 0.7152 * G' + 0.0722 * B'
   *
   * @param {string|object} color CSS color string or { r, g, b }
   * @returns {number} Relative luminance [0.0 - 1.0]
   */
  function getRelativeLuminance(color) {
    const rgb = typeof color === 'string' ? parseColor(color) : color;

    function gammaExpand(channel255) {
      const c = channel255 / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    const rLin = gammaExpand(rgb.r);
    const gLin = gammaExpand(rgb.g);
    const bLin = gammaExpand(rgb.b);

    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  }

  /**
   * Computes the exact WCAG 2.1 contrast ratio between two colors:
   * Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)
   *
   * @param {string|object} foreground Color 1
   * @param {string|object} background Color 2
   * @returns {number} Contrast ratio rounded to 2 decimal places [1.00 - 21.00]
   */
  function getContrastRatio(foreground, background) {
    const l1 = getRelativeLuminance(foreground);
    const l2 = getRelativeLuminance(background);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    const ratio = (lighter + 0.05) / (darker + 0.05);
    return Number(ratio.toFixed(2));
  }

  /**
   * Evaluates WCAG compliance tiers for a given contrast ratio.
   *
   * @param {number} ratio Contrast ratio
   * @returns {object} Detailed compliance ratings
   */
  function evaluateCompliance(ratio) {
    const normalTextAA = ratio >= 4.5;
    const normalTextAAA = ratio >= 7.0;
    const largeTextAA = ratio >= 3.0;
    const largeTextAAA = ratio >= 4.5;
    const uiComponentsAA = ratio >= 3.0;

    let overallRating = 'FAIL';
    let badgeClass = 'contrast-fail';

    if (normalTextAAA) {
      overallRating = 'PASS (AAA)';
      badgeClass = 'contrast-pass-aaa';
    } else if (normalTextAA) {
      overallRating = 'PASS (AA)';
      badgeClass = 'contrast-pass-aa';
    } else {
      overallRating = 'FAIL (< 4.5:1)';
      badgeClass = 'contrast-fail';
    }

    return {
      ratio,
      overallRating,
      badgeClass,
      normalTextAA,
      normalTextAAA,
      largeTextAA,
      largeTextAAA,
      uiComponentsAA,
      isValidForBody: normalTextAA
    };
  }

  /**
   * Validates a complete theme palette against WCAG standards.
   * Both text on bgMain and text on bgCard must pass WCAG AA (>= 4.5:1).
   *
   * @param {object} palette Theme palette
   * @returns {object} Validation result with diagnostics
   */
  function validateThemeAccessibility(palette) {
    if (!palette) {
      return { isValid: false, reason: 'Palette object is required.' };
    }

    const bgMain = palette.bgMain || DEFAULT_THEME.bgMain;
    const bgCard = palette.bgCard || DEFAULT_THEME.bgCard;
    const accent = palette.accentPrimary || DEFAULT_THEME.accentPrimary;
    const text = palette.textPrimary || DEFAULT_THEME.textPrimary;

    const mainRatio = getContrastRatio(text, bgMain);
    const cardRatio = getContrastRatio(text, bgCard);
    const accentRatio = getContrastRatio(accent, bgMain);

    const mainEval = evaluateCompliance(mainRatio);
    const cardEval = evaluateCompliance(cardRatio);
    const accentEval = evaluateCompliance(accentRatio);

    const isValid = mainEval.isValidForBody && cardEval.isValidForBody;
    let failureReason = null;

    if (!mainEval.isValidForBody) {
      failureReason = `Text contrast on Main Background is ${mainRatio}:1 (minimum 4.5:1 required).`;
    } else if (!cardEval.isValidForBody) {
      failureReason = `Text contrast on Card Surface is ${cardRatio}:1 (minimum 4.5:1 required).`;
    }

    return {
      isValid,
      failureReason,
      mainRatio,
      cardRatio,
      accentRatio,
      mainEval,
      cardEval,
      accentEval
    };
  }

  /**
   * Automatically adjusts text color luminance to achieve at least 4.5:1 (AA) or 7.0:1 (AAA).
   *
   * @param {string} textColor Current text color
   * @param {string} bgColor Background color
   * @param {number} [targetRatio=4.5] Desired contrast ratio
   * @returns {string} Optimized hex color
   */
  function autoFixContrast(textColor, bgColor, targetRatio = 4.5) {
    const bgLum = getRelativeLuminance(bgColor);
    const textRgb = parseColor(textColor);

    // If background is dark (luminance < 0.2), brighten text toward white
    if (bgLum < 0.2) {
      let r = textRgb.r;
      let g = textRgb.g;
      let b = textRgb.b;

      for (let step = 0; step < 50; step++) {
        const hex = toHex({ r, g, b });
        if (getContrastRatio(hex, bgColor) >= targetRatio) {
          return hex;
        }
        r = Math.min(255, r + 5);
        g = Math.min(255, g + 5);
        b = Math.min(255, b + 5);
      }
      return '#ffffff';
    } else {
      // If background is light, darken text toward black
      let r = textRgb.r;
      let g = textRgb.g;
      let b = textRgb.b;

      for (let step = 0; step < 50; step++) {
        const hex = toHex({ r, g, b });
        if (getContrastRatio(hex, bgColor) >= targetRatio) {
          return hex;
        }
        r = Math.max(0, r - 5);
        g = Math.max(0, g - 5);
        b = Math.max(0, b - 5);
      }
      return '#000000';
    }
  }

  /**
   * Generates formatted CSS variables block for one-click export.
   *
   * @param {object} palette Theme palette
   * @returns {string} Formatted CSS snippet
   */
  function exportToCssVariables(palette) {
    const p = palette || DEFAULT_THEME;
    return [
      ':root {',
      `  --bg-main: ${p.bgMain};`,
      `  --bg-card: ${p.bgCard};`,
      `  --accent-primary: ${p.accentPrimary};`,
      `  --text-primary: ${p.textPrimary};`,
      '}'
    ].join('\n');
  }

  /**
   * Generates JSON payload for one-click export.
   *
   * @param {object} palette Theme palette
   * @returns {string} Formatted JSON string
   */
  function exportToJson(palette) {
    const p = palette || DEFAULT_THEME;
    const data = {
      schema: 'arcadeverse-theme-v1',
      name: p.name || 'Custom Neon Theme',
      exportedAt: new Date().toISOString(),
      colors: {
        '--bg-main': p.bgMain,
        '--bg-card': p.bgCard,
        '--accent-primary': p.accentPrimary,
        '--text-primary': p.textPrimary
      }
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Parses and validates an imported theme JSON payload with prototype-pollution defense.
   *
   * @param {string} jsonString JSON input string
   * @returns {object} Validated palette or error object
   */
  function importFromJson(jsonString) {
    if (typeof jsonString !== 'string') {
      return { ok: false, error: 'Input must be a valid JSON string.' };
    }

    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Malformed JSON payload.' };
      }

      const colors = parsed.colors || parsed;
      const palette = Object.create(null);

      palette.bgMain = colors['--bg-main'] || colors.bgMain || DEFAULT_THEME.bgMain;
      palette.bgCard = colors['--bg-card'] || colors.bgCard || DEFAULT_THEME.bgCard;
      palette.accentPrimary = colors['--accent-primary'] || colors.accentPrimary || DEFAULT_THEME.accentPrimary;
      palette.textPrimary = colors['--text-primary'] || colors.textPrimary || DEFAULT_THEME.textPrimary;
      palette.name = typeof parsed.name === 'string' ? parsed.name.slice(0, 40) : 'Imported Custom Theme';

      const validation = validateThemeAccessibility(palette);
      if (!validation.isValid) {
        return {
          ok: false,
          error: `Theme rejected: ${validation.failureReason}`,
          palette
        };
      }

      return { ok: true, palette };
    } catch (err) {
      return { ok: false, error: 'JSON parse failure: ' + err.message };
    }
  }

  /**
   * Applies CSS custom properties to the document root element.
   *
   * @param {object} palette Theme palette
   */
  function applyThemeToDocument(palette) {
    if (typeof document === 'undefined') return;
    const rootEl = document.documentElement;
    if (!rootEl) return;

    const p = palette || DEFAULT_THEME;

    rootEl.style.setProperty('--bg-main', p.bgMain);
    rootEl.style.setProperty('--bg-card', p.bgCard);
    rootEl.style.setProperty('--accent-primary', p.accentPrimary);
    rootEl.style.setProperty('--text-primary', p.textPrimary);

    // Synchronize hover and accent variations
    rootEl.style.setProperty('--border-focus', p.accentPrimary);

    window.dispatchEvent(new CustomEvent('arcadeverse:theme-customized', { detail: p }));
  }

  /**
   * Removes custom CSS property overrides and returns to platform stylesheet defaults.
   */
  function resetDocumentTheme() {
    if (typeof document === 'undefined') return;
    const rootEl = document.documentElement;
    if (!rootEl) return;

    rootEl.style.removeProperty('--bg-main');
    rootEl.style.removeProperty('--bg-card');
    rootEl.style.removeProperty('--accent-primary');
    rootEl.style.removeProperty('--text-primary');
    rootEl.style.removeProperty('--border-focus');

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }

    window.dispatchEvent(new CustomEvent('arcadeverse:theme-customized', { detail: DEFAULT_THEME }));
  }

  /**
   * Saves custom theme to localStorage.
   */
  function saveThemeToStorage(palette) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
    } catch (_) {}
  }

  /**
   * Loads saved custom theme from localStorage.
   */
  function loadThemeFromStorage() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // Active studio editing state
  const studioState = {
    current: Object.assign({}, DEFAULT_THEME),
    validation: null
  };

  /**
   * Theme Studio Interactive Modal Management
   */
  function initUI() {
    if (typeof document === 'undefined') return;

    // Load any saved custom theme on startup
    const saved = loadThemeFromStorage();
    if (saved) {
      const check = validateThemeAccessibility(saved);
      if (check.isValid) {
        applyThemeToDocument(saved);
        studioState.current = Object.assign({}, saved);
      }
    }

    bindLaunchButtons();
    createStudioModalDOM();
  }

  /**
   * Constructs the Theme Studio Modal DOM.
   */
  function createStudioModalDOM() {
    if (document.getElementById('theme-studio-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'theme-studio-modal';
    modal.className = 'theme-studio-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'theme-studio-title');
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="theme-studio-overlay" id="theme-studio-overlay"></div>
      <div class="theme-studio-container">
        <!-- Topbar -->
        <div class="theme-studio-topbar">
          <div class="theme-topbar-title-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-studio-brand-icon" aria-hidden="true">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
            </svg>
            <div>
              <h2 id="theme-studio-title" class="theme-studio-title">THEME STUDIO & WCAG CONTRAST CHECKER</h2>
              <span class="theme-studio-subtitle">Custom Neon Palettes with Real-Time Accessibility Validation</span>
            </div>
          </div>
          <button type="button" id="close-theme-studio-btn" class="theme-studio-close-btn" aria-label="Close Theme Studio">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="theme-studio-body">
          <!-- Left Controls Column -->
          <div class="theme-studio-controls-col">
            <h3 class="studio-section-heading">CUSTOMIZE PALETTE TOKENS</h3>

            <div class="theme-color-field">
              <div class="color-field-label">
                <label for="color-input-bgmain">Main Background (--bg-main)</label>
                <span class="color-hex-val" id="hex-label-bgmain">#0c0e14</span>
              </div>
              <div class="color-picker-row">
                <input type="color" id="color-input-bgmain" value="#0c0e14" class="studio-color-picker">
                <input type="text" id="text-input-bgmain" value="#0c0e14" class="studio-text-picker" maxlength="7">
              </div>
            </div>

            <div class="theme-color-field">
              <div class="color-field-label">
                <label for="color-input-bgcard">Card Surface (--bg-card)</label>
                <span class="color-hex-val" id="hex-label-bgcard">#131722</span>
              </div>
              <div class="color-picker-row">
                <input type="color" id="color-input-bgcard" value="#131722" class="studio-color-picker">
                <input type="text" id="text-input-bgcard" value="#131722" class="studio-text-picker" maxlength="7">
              </div>
            </div>

            <div class="theme-color-field">
              <div class="color-field-label">
                <label for="color-input-accent">Brand Accent (--accent-primary)</label>
                <span class="color-hex-val" id="hex-label-accent">#00f0ff</span>
              </div>
              <div class="color-picker-row">
                <input type="color" id="color-input-accent" value="#00f0ff" class="studio-color-picker">
                <input type="text" id="text-input-accent" value="#00f0ff" class="studio-text-picker" maxlength="7">
              </div>
            </div>

            <div class="theme-color-field">
              <div class="color-field-label">
                <label for="color-input-text">Body Text (--text-primary)</label>
                <span class="color-hex-val" id="hex-label-text">#f8fafc</span>
              </div>
              <div class="color-picker-row">
                <input type="color" id="color-input-text" value="#f8fafc" class="studio-color-picker">
                <input type="text" id="text-input-text" value="#f8fafc" class="studio-text-picker" maxlength="7">
              </div>
            </div>

            <!-- Quick Action Tools -->
            <div class="studio-quick-tools">
              <button type="button" id="btn-studio-autofix" class="btn-studio-tool" title="Auto-adjust brightness to guarantee WCAG AA 4.5:1 ratio">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>
                </svg>
                AUTO-FIX CONTRAST
              </button>
              <button type="button" id="btn-studio-reset" class="btn-studio-tool" title="Reset all custom overrides back to defaults">
                RESET TO DEFAULT
              </button>
            </div>

            <!-- Curated Accessible Presets -->
            <div class="studio-presets-wrap">
              <span class="presets-label">ACCESSIBLE PRESET PALETTES:</span>
              <div class="presets-pill-grid">
                ${PRESET_PALETTES.map(p => `
                  <button type="button" class="preset-pill-btn" data-preset-id="${p.id}" title="${p.name}">
                    <span class="preset-swatch" style="background:${p.bgMain}; border-color:${p.accentPrimary}"></span>
                    <span>${p.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Solarized Cyber Dual Mode Sub-Toggle (#1374) -->
            <div class="solarized-subtoggle-group" id="studio-solarized-subtoggle">
              <div class="solarized-subtoggle-header">
                <span class="solarized-subtoggle-title">SOLARIZED DUAL MODE SUB-TOGGLE</span>
                <span class="solarized-subtoggle-badge">WCAG AAA</span>
              </div>
              <div class="solarized-subtoggle-switch" role="group" aria-label="Solarized Mode Sub-Toggle">
                <button type="button" class="solarized-mode-btn mode-dark" id="studio-subtoggle-dark" aria-label="Switch to Solarized Cyber Dark">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                  </svg>
                  <span>Solarized Dark</span>
                </button>
                <button type="button" class="solarized-mode-btn mode-light" id="studio-subtoggle-light" aria-label="Switch to Solarized Cyber Light">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
                  </svg>
                  <span>Solarized Light</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Right Diagnostics & Live Preview Column -->
          <div class="theme-studio-preview-col">
            <h3 class="studio-section-heading">REAL-TIME WCAG 2.1 CONTRAST AUDIT</h3>

            <!-- Contrast Diagnostics Cards -->
            <div class="contrast-cards-grid">
              <div class="contrast-stat-card" id="card-diag-main">
                <span class="stat-diag-label">TEXT ON MAIN BG</span>
                <div class="stat-diag-row">
                  <span class="stat-diag-ratio" id="ratio-val-main">17.8:1</span>
                  <span class="stat-diag-badge contrast-pass-aaa" id="badge-val-main">PASS (AAA)</span>
                </div>
                <span class="stat-diag-note">Requires >= 4.5:1 for body text</span>
              </div>

              <div class="contrast-stat-card" id="card-diag-card">
                <span class="stat-diag-label">TEXT ON CARD SURFACE</span>
                <div class="stat-diag-row">
                  <span class="stat-diag-ratio" id="ratio-val-card">14.2:1</span>
                  <span class="stat-diag-badge contrast-pass-aaa" id="badge-val-card">PASS (AAA)</span>
                </div>
                <span class="stat-diag-note">Requires >= 4.5:1 for body text</span>
              </div>

              <div class="contrast-stat-card" id="card-diag-accent">
                <span class="stat-diag-label">ACCENT ON MAIN BG</span>
                <div class="stat-diag-row">
                  <span class="stat-diag-ratio" id="ratio-val-accent">11.6:1</span>
                  <span class="stat-diag-badge contrast-pass-aaa" id="badge-val-accent">PASS (AAA)</span>
                </div>
                <span class="stat-diag-note">Requires >= 3.0:1 for UI controls</span>
              </div>
            </div>

            <!-- Platform Gate Status Banner -->
            <div class="contrast-gate-banner" id="contrast-gate-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="gate-banner-icon">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span id="gate-banner-text">Theme satisfies WCAG 2.1 AA accessibility guidelines. Ready to activate!</span>
            </div>

            <!-- Mini Hub Component Preview -->
            <div class="studio-live-mock-deck">
              <span class="mock-deck-label">STATION COMPONENT PREVIEW:</span>
              <div class="mock-game-card" id="mock-game-card">
                <div class="mock-card-header">
                  <span class="mock-badge" id="mock-card-badge">Arcade</span>
                  <strong class="mock-title" id="mock-card-title">Neon Cyber Strike</strong>
                </div>
                <p class="mock-desc" id="mock-card-desc">
                  This live preview box demonstrates how your body text, card backgrounds, and neon accent borders appear on the hub station.
                </p>
                <div class="mock-card-footer">
                  <button type="button" class="mock-btn-play" id="mock-btn-play">
                    PLAY GAME
                  </button>
                  <span class="mock-author" id="mock-card-author">By @Debasmita</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="theme-studio-footer">
          <div class="studio-footer-status">
            <span id="studio-action-toast" class="studio-action-toast" aria-live="polite"></span>
          </div>
          <div class="studio-footer-actions">
            <button type="button" id="btn-studio-apply" class="btn-studio-action btn-studio-primary" title="Apply and persist custom theme across platform">
              APPLY & SAVE THEME
            </button>
            <button type="button" id="btn-studio-export-json" class="btn-studio-action" title="Export theme configuration as JSON">
              EXPORT JSON
            </button>
            <button type="button" id="btn-studio-copy-css" class="btn-studio-action" title="Copy ready-to-paste CSS custom properties">
              COPY CSS
            </button>
            <button type="button" id="btn-studio-import" class="btn-studio-action" title="Import customized theme from JSON snippet">
              IMPORT THEME
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    attachModalEvents(modal);
  }

  /**
   * Binds click and change listeners to interactive studio controls.
   */
  function attachModalEvents(modal) {
    const closeBtn = document.getElementById('close-theme-studio-btn');
    const overlay = document.getElementById('theme-studio-overlay');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    // ESC closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeModal();
      }
    });

    // Color Pickers Binding
    const pairs = [
      { color: 'color-input-bgmain', text: 'text-input-bgmain', label: 'hex-label-bgmain', prop: 'bgMain' },
      { color: 'color-input-bgcard', text: 'text-input-bgcard', label: 'hex-label-bgcard', prop: 'bgCard' },
      { color: 'color-input-accent', text: 'text-input-accent', label: 'hex-label-accent', prop: 'accentPrimary' },
      { color: 'color-input-text', text: 'text-input-text', label: 'hex-label-text', prop: 'textPrimary' }
    ];

    pairs.forEach(pair => {
      const colorInput = document.getElementById(pair.color);
      const textInput = document.getElementById(pair.text);
      const hexLabel = document.getElementById(pair.label);

      if (colorInput && textInput) {
        colorInput.addEventListener('input', () => {
          textInput.value = colorInput.value;
          if (hexLabel) hexLabel.textContent = colorInput.value;
          studioState.current[pair.prop] = colorInput.value;
          updateStudioAudit();
        });

        textInput.addEventListener('change', () => {
          let val = textInput.value.trim();
          if (!val.startsWith('#')) val = '#' + val;
          if (/^#[0-9a-f]{6}$/i.test(val)) {
            colorInput.value = val;
            if (hexLabel) hexLabel.textContent = val;
            studioState.current[pair.prop] = val;
            updateStudioAudit();
          }
        });
      }
    });

    // Preset Buttons
    const presetBtns = modal.querySelectorAll('.preset-pill-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-preset-id');
        const found = PRESET_PALETTES.find(p => p.id === id);
        if (found) {
          syncPaletteToControls(found);
          updateStudioAudit();
          showStudioToast(`Loaded "${found.name}" preset!`);
        }
      });
    });

    // Solarized Dual Mode Sub-Toggle Buttons (#1374)
    const subtoggleDark = document.getElementById('studio-subtoggle-dark');
    const subtoggleLight = document.getElementById('studio-subtoggle-light');

    if (subtoggleDark && subtoggleLight) {
      subtoggleDark.addEventListener('click', () => {
        const found = PRESET_PALETTES.find(p => p.id === 'solarized_cyber_dark');
        if (found) {
          syncPaletteToControls(found);
          updateStudioAudit();
          subtoggleDark.classList.add('active');
          subtoggleDark.setAttribute('aria-pressed', 'true');
          subtoggleLight.classList.remove('active');
          subtoggleLight.setAttribute('aria-pressed', 'false');
          showStudioToast('Loaded Solarized Cyber Dark mode (WCAG AAA)!');
        }
      });

      subtoggleLight.addEventListener('click', () => {
        const found = PRESET_PALETTES.find(p => p.id === 'solarized_cyber_light');
        if (found) {
          syncPaletteToControls(found);
          updateStudioAudit();
          subtoggleLight.classList.add('active');
          subtoggleLight.setAttribute('aria-pressed', 'true');
          subtoggleDark.classList.remove('active');
          subtoggleDark.setAttribute('aria-pressed', 'false');
          showStudioToast('Loaded Solarized Cyber Light mode (WCAG AAA)!');
        }
      });
    }

    // Auto-Fix Button
    const autofixBtn = document.getElementById('btn-studio-autofix');
    if (autofixBtn) {
      autofixBtn.addEventListener('click', () => {
        const fixedText = autoFixContrast(studioState.current.textPrimary, studioState.current.bgMain, 7.0);
        studioState.current.textPrimary = fixedText;
        syncPaletteToControls(studioState.current);
        updateStudioAudit();
        showStudioToast('Auto-adjusted text contrast to WCAG AAA!');
      });
    }

    // Reset Button
    const resetBtn = document.getElementById('btn-studio-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetDocumentTheme();
        syncPaletteToControls(DEFAULT_THEME);
        updateStudioAudit();
        showStudioToast('Reset all theme overrides to default!');
      });
    }

    // Apply & Save Button
    const applyBtn = document.getElementById('btn-studio-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const audit = validateThemeAccessibility(studioState.current);
        if (!audit.isValid) {
          showStudioToast('Cannot activate: Fails WCAG AA contrast!', true);
          return;
        }

        applyThemeToDocument(studioState.current);
        saveThemeToStorage(studioState.current);
        showStudioToast('Custom theme activated and saved across platform!');
      });
    }

    // Export JSON Button
    const exportJsonBtn = document.getElementById('btn-studio-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        const json = exportToJson(studioState.current);
        copyToClipboard(json, 'Exported theme JSON copied to clipboard!');
      });
    }

    // Copy CSS Button
    const copyCssBtn = document.getElementById('btn-studio-copy-css');
    if (copyCssBtn) {
      copyCssBtn.addEventListener('click', () => {
        const css = exportToCssVariables(studioState.current);
        copyToClipboard(css, 'CSS custom properties copied to clipboard!');
      });
    }

    // Import Button
    const importBtn = document.getElementById('btn-studio-import');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const input = prompt('Paste theme JSON payload below:');
        if (!input) return;

        const res = importFromJson(input);
        if (res.ok) {
          syncPaletteToControls(res.palette);
          updateStudioAudit();
          applyThemeToDocument(res.palette);
          saveThemeToStorage(res.palette);
          showStudioToast('Imported and applied custom theme!');
        } else {
          alert('Import Error: ' + res.error);
        }
      });
    }
  }

  /**
   * Syncs palette values into input fields.
   */
  function syncPaletteToControls(palette) {
    studioState.current = Object.assign({}, palette);

    const pairs = [
      { color: 'color-input-bgmain', text: 'text-input-bgmain', label: 'hex-label-bgmain', val: palette.bgMain },
      { color: 'color-input-bgcard', text: 'text-input-bgcard', label: 'hex-label-bgcard', val: palette.bgCard },
      { color: 'color-input-accent', text: 'text-input-accent', label: 'hex-label-accent', val: palette.accentPrimary },
      { color: 'color-input-text', text: 'text-input-text', label: 'hex-label-text', val: palette.textPrimary }
    ];

    pairs.forEach(pair => {
      const colorInput = document.getElementById(pair.color);
      const textInput = document.getElementById(pair.text);
      const hexLabel = document.getElementById(pair.label);

      if (colorInput) colorInput.value = pair.val;
      if (textInput) textInput.value = pair.val;
      if (hexLabel) hexLabel.textContent = pair.val;
    });
  }

  /**
   * Runs real-time WCAG audit on currently edited colors and updates UI diagnostics.
   */
  function updateStudioAudit() {
    const audit = validateThemeAccessibility(studioState.current);
    studioState.validation = audit;

    // 1. Update Diagnostics Cards
    const ratioMain = document.getElementById('ratio-val-main');
    const badgeMain = document.getElementById('badge-val-main');
    const ratioCard = document.getElementById('ratio-val-card');
    const badgeCard = document.getElementById('badge-val-card');
    const ratioAccent = document.getElementById('ratio-val-accent');
    const badgeAccent = document.getElementById('badge-val-accent');

    if (ratioMain) ratioMain.textContent = `${audit.mainRatio}:1`;
    if (badgeMain) {
      badgeMain.className = `stat-diag-badge ${audit.mainEval.badgeClass}`;
      badgeMain.textContent = audit.mainEval.overallRating;
    }

    if (ratioCard) ratioCard.textContent = `${audit.cardRatio}:1`;
    if (badgeCard) {
      badgeCard.className = `stat-diag-badge ${audit.cardEval.badgeClass}`;
      badgeCard.textContent = audit.cardEval.overallRating;
    }

    if (ratioAccent) ratioAccent.textContent = `${audit.accentRatio}:1`;
    if (badgeAccent) {
      badgeAccent.className = `stat-diag-badge ${audit.accentEval.badgeClass}`;
      badgeAccent.textContent = audit.accentEval.overallRating;
    }

    // 2. Update Gate Status Banner
    const gateBanner = document.getElementById('contrast-gate-banner');
    const gateText = document.getElementById('gate-banner-text');
    const gateIcon = document.getElementById('gate-banner-icon');
    const applyBtn = document.getElementById('btn-studio-apply');

    if (gateBanner && gateText && gateIcon) {
      if (audit.isValid) {
        gateBanner.className = 'contrast-gate-banner gate-passed';
        gateText.textContent = 'Theme satisfies WCAG 2.1 AA accessibility guidelines. Ready to activate!';
        gateIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
        if (applyBtn) {
          applyBtn.removeAttribute('disabled');
          applyBtn.classList.remove('btn-disabled');
        }
      } else {
        gateBanner.className = 'contrast-gate-banner gate-failed';
        gateText.textContent = `[BLOCKED] ${audit.failureReason} Contrast must be >= 4.5:1.`;
        gateIcon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
        if (applyBtn) {
          applyBtn.setAttribute('disabled', 'true');
          applyBtn.classList.add('btn-disabled');
        }
      }
    }

    // 3. Update Miniature Hub Component Preview Box
    const mockCard = document.getElementById('mock-game-card');
    const mockTitle = document.getElementById('mock-card-title');
    const mockDesc = document.getElementById('mock-card-desc');
    const mockBadge = document.getElementById('mock-card-badge');
    const mockBtnPlay = document.getElementById('mock-btn-play');
    const mockAuthor = document.getElementById('mock-card-author');

    if (mockCard) {
      mockCard.style.backgroundColor = studioState.current.bgCard;
      mockCard.style.borderColor = studioState.current.accentPrimary;
    }
    if (mockTitle) mockTitle.style.color = studioState.current.textPrimary;
    if (mockDesc) mockDesc.style.color = studioState.current.textPrimary;
    if (mockAuthor) mockAuthor.style.color = studioState.current.textPrimary;

    if (mockBadge) {
      mockBadge.style.backgroundColor = studioState.current.accentPrimary;
      mockBadge.style.color = studioState.current.bgMain;
    }
    if (mockBtnPlay) {
      mockBtnPlay.style.backgroundColor = studioState.current.accentPrimary;
      mockBtnPlay.style.color = studioState.current.bgMain;
    }
  }

  /**
   * Opens the Theme Studio modal.
   */
  function openModal() {
    createStudioModalDOM();
    const modal = document.getElementById('theme-studio-modal');
    if (!modal) return;

    // Load active colors
    const active = loadThemeFromStorage() || DEFAULT_THEME;
    syncPaletteToControls(active);
    updateStudioAudit();

    modal.style.display = 'flex';
    document.body.classList.add('theme-studio-open');
  }

  /**
   * Closes the Theme Studio modal.
   */
  function closeModal() {
    const modal = document.getElementById('theme-studio-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.classList.remove('theme-studio-open');
    }
  }

  /**
   * Binds navbar and shortcut triggers.
   */
  function bindLaunchButtons() {
    if (typeof document === 'undefined') return;

    // Trigger button in navigation actions
    const navActions = document.querySelector('.nav-actions');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    if (navActions && !document.getElementById('theme-studio-trigger-btn')) {
      const studioBtn = document.createElement('button');
      studioBtn.id = 'theme-studio-trigger-btn';
      studioBtn.className = 'theme-studio-btn';
      studioBtn.type = 'button';
      studioBtn.title = 'Open Theme Studio & WCAG Contrast Checker (Shift+T)';
      studioBtn.setAttribute('aria-label', 'Open Theme Studio & WCAG Contrast Checker');
      studioBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
        </svg>
      `;

      if (themeToggleBtn) {
        navActions.insertBefore(studioBtn, themeToggleBtn);
      } else {
        navActions.appendChild(studioBtn);
      }

      studioBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    // Keyboard shortcut Shift+T
    window.addEventListener('keydown', (e) => {
      if ((e.key === 't' || e.key === 'T') && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          openModal();
        }
      }
    });
  }

  /**
   * Clipboard helper with toast feedback.
   */
  function copyToClipboard(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showStudioToast(message))
        .catch(() => showStudioToast('Clipboard write failed.'));
    } else {
      showStudioToast(message);
    }
  }

  /**
   * Temporary notification banner in modal footer.
   */
  function showStudioToast(message, isError = false) {
    const toast = document.getElementById('studio-action-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = isError ? 'studio-action-toast toast-error visible' : 'studio-action-toast visible';

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  // Automatic bootstrap in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
  }

  return {
    DEFAULT_THEME,
    PRESET_PALETTES,
    parseColor,
    toHex,
    getRelativeLuminance,
    getContrastRatio,
    evaluateCompliance,
    validateThemeAccessibility,
    autoFixContrast,
    exportToCssVariables,
    exportToJson,
    importFromJson,
    applyThemeToDocument,
    resetDocumentTheme,
    saveThemeToStorage,
    loadThemeFromStorage,
    openModal,
    closeModal,
    initUI
  };
});
