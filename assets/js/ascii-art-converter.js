/**
 * ArcadeVerse Retro ASCII / ANSI Canvas Art Terminal Converter & Shareable Text Cards
 *
 * Architectural Scope:
 * 1. Real-Time Canvas Sampling: Downscales game frames into a 80x40 (or custom) luminance buffer.
 * 2. Retro Character Density Ramp: Maps pixel brightness to "@%#*+=-:. " with optional inversion & contrast.
 * 3. ANSI 16-Color Terminal Support: Quantizes RGB pixels to standard retro ANSI colors with optimized escape sequences.
 * 4. Discord Shareable Blocks: Formats output for Discord (```ansi or monospace ```) with character length indicators.
 * 5. One-Click Clipboard & Download: One-click Discord copy, Raw ASCII copy, Terminal ANSI copy, and .txt export.
 * 6. Standalone & Embedded: Runs 100% client-side with zero external dependencies; supports CommonJS in Node.js.
 *
 * Strictly zero Unicode emojis across all code, comments, and DOM strings.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const api = factory();
    root.AsciiArtConverter = api;
    root.ArcadeAsciiArt = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Standard Retro Density Character Ramp (Dark background: index 0 is most dense, end is least dense)
  const DEFAULT_RAMP = '@%#*+=-:. ';
  const BLOCK_RAMP = '█▓▒░ ';
  const MINIMAL_RAMP = '#+-. ';

  // Standard 16-color retro ANSI palette with Discord ANSI and Terminal ANSI mappings
  const ANSI_16_PALETTE = [
    // Standard intensity (0;30 to 0;37)
    { name: 'black',        ansiCode: '0;30', termCode: '30', hex: '#4f545c', r: 79,  g: 84,  b: 92  },
    { name: 'red',          ansiCode: '0;31', termCode: '31', hex: '#dc322f', r: 220, g: 50,  b: 47  },
    { name: 'green',        ansiCode: '0;32', termCode: '32', hex: '#859900', r: 133, g: 153, b: 0   },
    { name: 'yellow',       ansiCode: '0;33', termCode: '33', hex: '#b58900', r: 181, g: 137, b: 0   },
    { name: 'blue',         ansiCode: '0;34', termCode: '34', hex: '#268bd2', r: 38,  g: 139, b: 210 },
    { name: 'magenta',      ansiCode: '0;35', termCode: '35', hex: '#d33682', r: 211, g: 54,  b: 130 },
    { name: 'cyan',         ansiCode: '0;36', termCode: '36', hex: '#2aa198', r: 42,  g: 161, b: 152 },
    { name: 'white',        ansiCode: '0;37', termCode: '37', hex: '#dcdfe4', r: 220, g: 223, b: 228 },

    // Bright / High intensity (1;30 to 1;37 for Discord, 90-97 for terminal)
    { name: 'bright_black',   ansiCode: '1;30', termCode: '90', hex: '#72767d', r: 114, g: 118, b: 125 },
    { name: 'bright_red',     ansiCode: '1;31', termCode: '91', hex: '#f04747', r: 240, g: 71,  b: 71  },
    { name: 'bright_green',   ansiCode: '1;32', termCode: '92', hex: '#43b581', r: 67,  g: 181, b: 129 },
    { name: 'bright_yellow',  ansiCode: '1;33', termCode: '93', hex: '#faa61a', r: 250, g: 166, b: 26  },
    { name: 'bright_blue',    ansiCode: '1;34', termCode: '94', hex: '#7289da', r: 114, g: 137, b: 218 },
    { name: 'bright_magenta', ansiCode: '1;35', termCode: '95', hex: '#f47fff', r: 244, g: 127, b: 255 },
    { name: 'bright_cyan',    ansiCode: '1;36', termCode: '96', hex: '#00f0ff', r: 0,   g: 240, b: 255 },
    { name: 'bright_white',   ansiCode: '1;37', termCode: '97', hex: '#ffffff', r: 255, g: 255, b: 255 }
  ];

  /**
   * Computes perceived photometric luminance using standard ITU-R BT.709 coefficients.
   * @param {number} r Red channel [0-255]
   * @param {number} g Green channel [0-255]
   * @param {number} b Blue channel [0-255]
   * @returns {number} Normalized luminance [0.0 - 1.0]
   */
  function computeLuminance(r, g, b) {
    if (r >= 255 && g >= 255 && b >= 255) return 1.0;
    if (r <= 0 && g <= 0 && b <= 0) return 0.0;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return Math.max(0, Math.min(1, lum));
  }

  /**
   * Maps an RGB color to the closest standard ANSI 16 color via Euclidean distance.
   * @param {number} r Red channel [0-255]
   * @param {number} g Green channel [0-255]
   * @param {number} b Blue channel [0-255]
   * @returns {object} Matching ANSI palette entry
   */
  function mapToAnsiColor(r, g, b) {
    let minDistance = Infinity;
    let closestColor = ANSI_16_PALETTE[7]; // Default to white

    for (let i = 0; i < ANSI_16_PALETTE.length; i++) {
      const palette = ANSI_16_PALETTE[i];
      const dr = r - palette.r;
      const dg = g - palette.g;
      const db = b - palette.b;
      // Perceptually weighted Euclidean color distance
      const distance = 0.3 * (dr * dr) + 0.59 * (dg * dg) + 0.11 * (db * db);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = palette;
      }
    }

    return closestColor;
  }

  /**
   * Converts a 1D pixel buffer (RGBA) into structured ASCII/ANSI art data.
   *
   * @param {Uint8ClampedArray|Array<number>} pixels Flat RGBA byte array
   * @param {number} width Buffer width in pixels
   * @param {number} height Buffer height in pixels
   * @param {object} [options] Conversion settings
   * @returns {object} Result with characters, colors, rows, and raw text
   */
  function convertPixelBuffer(pixels, width, height, options = {}) {
    if (!pixels || width <= 0 || height <= 0) {
      return { rows: [], rawText: '', width: 0, height: 0, charCount: 0 };
    }

    const ramp = options.ramp || DEFAULT_RAMP;
    const invert = Boolean(options.invert);
    const contrast = typeof options.contrast === 'number' ? options.contrast : 1.0;
    const brightness = typeof options.brightness === 'number' ? options.brightness : 0.0;
    const rampLength = ramp.length;

    const rows = [];
    const textLines = [];

    for (let y = 0; y < height; y++) {
      const rowTokens = [];
      let lineText = '';

      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const r = pixels[offset] || 0;
        const g = pixels[offset + 1] || 0;
        const b = pixels[offset + 2] || 0;
        const a = pixels[offset + 3] !== undefined ? pixels[offset + 3] : 255;

        // Fully or mostly transparent pixels map to blank space
        if (a < 64) {
          rowTokens.push({
            char: ' ',
            color: ANSI_16_PALETTE[0],
            r, g, b, a
          });
          lineText += ' ';
          continue;
        }

        // Calculate base luminance
        const baseLuminance = computeLuminance(r, g, b);

        // Apply contrast and brightness adjustments
        let adjustedLuminance = (baseLuminance - 0.5) * contrast + 0.5 + brightness;
        adjustedLuminance = Math.max(0, Math.min(1, adjustedLuminance));

        // In dark backgrounds: high luminance = dense character (e.g. '@')
        // Invert flips this: low luminance = dense character
        let rampIndex;
        if (!invert) {
          rampIndex = Math.round((1 - adjustedLuminance) * (rampLength - 1));
        } else {
          rampIndex = Math.round(adjustedLuminance * (rampLength - 1));
        }

        rampIndex = Math.max(0, Math.min(rampLength - 1, rampIndex));
        const char = ramp[rampIndex];
        const ansiColor = mapToAnsiColor(r, g, b);

        rowTokens.push({
          char,
          color: ansiColor,
          r, g, b, a,
          luminance: adjustedLuminance
        });
        lineText += char;
      }

      rows.push(rowTokens);
      textLines.push(lineText);
    }

    const rawText = textLines.join('\n');

    return {
      rows,
      rawText,
      width,
      height,
      charCount: rawText.length
    };
  }

  /**
   * Samples an active HTML Canvas element and converts it to ASCII/ANSI art.
   *
   * @param {HTMLCanvasElement} canvas Source canvas
   * @param {object} [options] Conversion options
   * @returns {object} Conversion result
   */
  function convertCanvas(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('Invalid canvas element provided to convertCanvas');
    }

    const targetWidth = Math.max(10, Math.min(200, options.width || 80));
    const targetHeight = Math.max(10, Math.min(120, options.height || 40));

    // Create an offscreen buffer canvas for hardware-accelerated downscaling
    const offscreen = typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;

    if (!offscreen) {
      throw new Error('Canvas execution requires a DOM environment or pixel buffer.');
    }

    offscreen.width = targetWidth;
    offscreen.height = targetHeight;

    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Unable to acquire 2D rendering context from offscreen canvas.');
    }

    // Optional smoothing filter for retro pixel preservation vs smooth downsampling
    ctx.imageSmoothingEnabled = options.smooth !== false;
    ctx.imageSmoothingQuality = 'medium';

    // Draw downscaled frame
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    return convertPixelBuffer(imgData.data, targetWidth, targetHeight, options);
  }

  /**
   * Generates formatted Discord code block text with optional ANSI escape colors.
   *
   * @param {object} artResult Output from convertPixelBuffer or convertCanvas
   * @param {object} [options] Format settings
   * @returns {string} Ready-to-paste Discord Markdown snippet
   */
  function formatDiscord(artResult, options = {}) {
    if (!artResult || !Array.isArray(artResult.rows)) return '';

    const useColor = options.color !== false;
    const includeHeader = Boolean(options.includeHeader);
    const metadata = options.metadata || {};

    let output = '';

    if (includeHeader) {
      const title = metadata.title || 'ArcadeVerse Game';
      const score = metadata.score !== undefined ? metadata.score : 'N/A';
      const author = metadata.author || 'Contributor';

      output += `[ ARCADEVERSE // ${title.toUpperCase()} ]\n`;
      output += `Score: ${score} | Developer: @${author}\n`;
      output += `Launch: https://arcadeverse.vercel.app\n`;
      output += `${'-'.repeat(Math.min(artResult.width, 40))}\n`;
    }

    if (!useColor) {
      // Plain text monospace block
      return '```\n' + output + artResult.rawText + '\n```';
    }

    // ANSI Colored Discord block
    let ansiBody = '';
    const ESC = '\u001b[';
    const RESET = '\u001b[0m';

    for (let y = 0; y < artResult.rows.length; y++) {
      const row = artResult.rows[y];
      let currentCode = null;

      for (let x = 0; x < row.length; x++) {
        const token = row[x];
        const tokenCode = token.color.ansiCode;

        if (tokenCode !== currentCode) {
          ansiBody += `${ESC}${tokenCode}m`;
          currentCode = tokenCode;
        }

        ansiBody += token.char;
      }

      if (currentCode) {
        ansiBody += RESET;
      }
      ansiBody += '\n';
    }

    return '```ansi\n' + output + ansiBody + '```';
  }

  /**
   * Generates raw plain-text ASCII art (without markdown backticks or ANSI escapes).
   *
   * @param {object} artResult Output from convertPixelBuffer
   * @param {object} [options] Format settings
   * @returns {string} Raw ASCII characters
   */
  function formatRawAscii(artResult, options = {}) {
    if (!artResult || !Array.isArray(artResult.rows)) return '';

    const includeHeader = Boolean(options.includeHeader);
    const metadata = options.metadata || {};

    let output = '';
    if (includeHeader) {
      const title = metadata.title || 'ArcadeVerse Game';
      const score = metadata.score !== undefined ? metadata.score : 'N/A';
      const author = metadata.author || 'Contributor';
      output += `========================================================\n`;
      output += `   ARCADEVERSE // ${title.toUpperCase()}\n`;
      output += `   Score: ${score} | Author: @${author}\n`;
      output += `========================================================\n\n`;
    }

    output += artResult.rawText;
    return output;
  }

  /**
   * Generates standard ANSI escape sequence string for retro terminals (PowerShell, Bash, Zsh, MOTD).
   *
   * @param {object} artResult Output from convertPixelBuffer
   * @param {object} [options] Format settings
   * @returns {string} Terminal ANSI string
   */
  function formatTerminalAnsi(artResult, options = {}) {
    if (!artResult || !Array.isArray(artResult.rows)) return '';

    const includeHeader = Boolean(options.includeHeader);
    const metadata = options.metadata || {};
    const ESC = '\x1b[';
    const RESET = '\x1b[0m';

    let output = '';

    if (includeHeader) {
      const title = metadata.title || 'ArcadeVerse';
      output += `${ESC}1;36m[ ARCADEVERSE // ${title.toUpperCase()} ]${RESET}\n`;
    }

    for (let y = 0; y < artResult.rows.length; y++) {
      const row = artResult.rows[y];
      let currentTermCode = null;

      for (let x = 0; x < row.length; x++) {
        const token = row[x];
        const termCode = token.color.termCode;

        if (termCode !== currentTermCode) {
          output += `${ESC}${termCode}m`;
          currentTermCode = termCode;
        }

        output += token.char;
      }

      if (currentTermCode) {
        output += RESET;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Renders the art result as an HTML preview with colored spans matching the retro palette.
   *
   * @param {object} artResult Output from convertPixelBuffer
   * @param {boolean} [showColor=true] Whether to apply palette hex colors
   * @returns {string} Safe HTML string for insertion into a pre/code tag
   */
  function renderHtmlPreview(artResult, showColor = true) {
    if (!artResult || !Array.isArray(artResult.rows)) return '';

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    let html = '';

    for (let y = 0; y < artResult.rows.length; y++) {
      const row = artResult.rows[y];

      if (!showColor) {
        // Monochrome line
        let line = '';
        for (let x = 0; x < row.length; x++) {
          line += row[x].char;
        }
        html += escapeHtml(line) + '\n';
        continue;
      }

      // Group consecutive characters of the same hex color into single spans for speed
      let currentColor = null;
      let buffer = '';

      for (let x = 0; x < row.length; x++) {
        const token = row[x];
        const hex = token.color.hex;

        if (hex !== currentColor) {
          if (buffer.length > 0) {
            html += `<span style="color:${currentColor}">${escapeHtml(buffer)}</span>`;
            buffer = '';
          }
          currentColor = hex;
        }

        buffer += token.char;
      }

      if (buffer.length > 0) {
        html += `<span style="color:${currentColor}">${escapeHtml(buffer)}</span>`;
      }
      html += '\n';
    }

    return html;
  }

  /**
   * Procedural retro pixel canvas generator for demo previews when no active game canvas is found.
   *
   * @param {string} [title='ARCADEVERSE'] Title to render
   * @returns {HTMLCanvasElement|null} Generated canvas
   */
  function generateDemoCanvas(title = 'ARCADEVERSE') {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 320, 160);
    grad.addColorStop(0, '#060a12');
    grad.addColorStop(0.5, '#131e33');
    grad.addColorStop(1, '#060a12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 160);

    // Retro Grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 320; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }
    for (let y = 0; y < 160; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(320, y);
      ctx.stroke();
    }

    // Draw 8-Bit Space Invader Alien
    const invader = [
      '  #     #  ',
      '   #   #   ',
      '  #######  ',
      ' ## ### ## ',
      '###########',
      '# ####### #',
      '# #     # #',
      '   ## ##   '
    ];

    const pixelSize = 8;
    const startX = 160 - (invader[0].length * pixelSize) / 2;
    const startY = 32;

    for (let r = 0; r < invader.length; r++) {
      const row = invader[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '#') {
          // Color gradation
          ctx.fillStyle = r < 3 ? '#ff007f' : (r < 6 ? '#00f0ff' : '#10b981');
          ctx.fillRect(startX + c * pixelSize, startY + r * pixelSize, pixelSize - 1, pixelSize - 1);
        }
      }
    }

    // Title banner
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title.toUpperCase(), 160, 134);

    ctx.fillStyle = '#00f0ff';
    ctx.font = '10px monospace';
    ctx.fillText('INSERT COIN // 1984', 160, 150);

    return canvas;
  }

  // State management for the interactive modal
  const studioState = {
    sourceCanvas: null,
    metadata: {
      title: 'ArcadeVerse Game',
      author: 'Contributor',
      score: '0',
      category: 'Arcade'
    },
    width: 80,
    height: 40,
    colorMode: true,
    rampName: 'standard',
    invert: false,
    contrast: 1.0,
    brightness: 0.0,
    includeHeader: false,
    fontSize: 10,
    lastResult: null
  };

  /**
   * Mounts and initializes the Retro ASCII Studio UI inside the DOM.
   */
  function initUI() {
    if (typeof document === 'undefined') return;

    // Check if modal container already exists
    if (document.getElementById('ascii-art-modal')) return;

    createModalDOM();
    bindGameModalTriggers();
  }

  /**
   * Constructs the ASCII Studio Modal DOM structure.
   */
  function createModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'ascii-art-modal';
    modal.className = 'ascii-modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ascii-modal-heading');
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="ascii-modal-overlay" id="ascii-modal-overlay"></div>
      <div class="ascii-modal-container">
        <!-- Topbar -->
        <div class="ascii-modal-topbar">
          <div class="ascii-topbar-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ascii-brand-icon" aria-hidden="true">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            <div>
              <h2 id="ascii-modal-heading" class="ascii-modal-title">RETRO ASCII & ANSI CONVERTER</h2>
              <span class="ascii-modal-subtitle">Canvas-to-Terminal Share Card Studio</span>
            </div>
          </div>
          <button type="button" id="close-ascii-modal-btn" class="ascii-btn-close" aria-label="Close ASCII Studio">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Controls Toolbar -->
        <div class="ascii-toolbar">
          <!-- Resolution Presets -->
          <div class="ascii-toolbar-group">
            <label class="ascii-toolbar-label">Resolution:</label>
            <div class="ascii-btn-toggle-group" role="radiogroup" aria-label="Resolution Presets">
              <button type="button" class="ascii-btn-toggle active" data-res="80x40" title="80x40 Terminal Standard">80x40</button>
              <button type="button" class="ascii-btn-toggle" data-res="60x30" title="60x30 Forum Post">60x30</button>
              <button type="button" class="ascii-btn-toggle" data-res="40x20" title="40x20 Discord 2K Safe">40x20</button>
            </div>
          </div>

          <!-- Color Mode -->
          <div class="ascii-toolbar-group">
            <label class="ascii-toolbar-label">Color:</label>
            <div class="ascii-btn-toggle-group" role="radiogroup" aria-label="Color Mode">
              <button type="button" class="ascii-btn-toggle active" id="ascii-toggle-color" data-color="ansi" title="ANSI 16-Color">ANSI Color</button>
              <button type="button" class="ascii-btn-toggle" id="ascii-toggle-mono" data-color="mono" title="Monochrome Plain Text">Mono</button>
            </div>
          </div>

          <!-- Density Ramp -->
          <div class="ascii-toolbar-group">
            <label class="ascii-toolbar-label" for="ascii-select-ramp">Ramp:</label>
            <select id="ascii-select-ramp" class="ascii-select" aria-label="Character Density Ramp">
              <option value="standard" selected>Standard (@%#*+=-:. )</option>
              <option value="blocks">Blocks (█▓▒░ )</option>
              <option value="minimal">Minimal (#+-. )</option>
            </select>
          </div>

          <!-- Invert & Header Toggles -->
          <div class="ascii-toolbar-group ascii-checkboxes">
            <label class="ascii-checkbox-label">
              <input type="checkbox" id="ascii-check-invert">
              <span>Invert</span>
            </label>
            <label class="ascii-checkbox-label">
              <input type="checkbox" id="ascii-check-header">
              <span>Metadata Header</span>
            </label>
          </div>

          <!-- Font Size Zoom -->
          <div class="ascii-toolbar-group ascii-zoom-controls">
            <label class="ascii-toolbar-label">Zoom:</label>
            <button type="button" id="ascii-zoom-out" class="ascii-btn-sm" title="Decrease Preview Font Size">A-</button>
            <span id="ascii-zoom-display" class="ascii-zoom-display">10px</span>
            <button type="button" id="ascii-zoom-in" class="ascii-btn-sm" title="Increase Preview Font Size">A+</button>
          </div>
        </div>

        <!-- Live Terminal Preview -->
        <div class="ascii-preview-deck">
          <div class="ascii-preview-header">
            <div class="ascii-terminal-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
            </div>
            <span class="ascii-terminal-title" id="ascii-terminal-status">TERMINAL PREVIEW // READY</span>
            <div class="ascii-preview-badges">
              <span id="ascii-badge-dimensions" class="ascii-badge">80x40 COLS</span>
              <span id="ascii-badge-chars" class="ascii-badge">3200 CHARS</span>
              <span id="ascii-badge-discord" class="ascii-badge ascii-badge-safe">DISCORD READY</span>
            </div>
          </div>
          <div class="ascii-preview-viewport">
            <pre id="ascii-preview-content" class="ascii-preview-box" tabindex="0" aria-label="ASCII Art Preview"></pre>
          </div>
        </div>

        <!-- Bottom Action Bar -->
        <div class="ascii-modal-footer">
          <div class="ascii-footer-info">
            <span id="ascii-copy-toast" class="ascii-copy-toast" aria-live="polite"></span>
          </div>
          <div class="ascii-footer-buttons">
            <button type="button" id="btn-copy-discord" class="ascii-btn-action ascii-btn-discord" title="Copy formatted Discord code block">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              COPY DISCORD CODE BLOCK
            </button>
            <button type="button" id="btn-copy-raw" class="ascii-btn-action" title="Copy clean raw ASCII characters">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              COPY RAW ASCII
            </button>
            <button type="button" id="btn-copy-terminal" class="ascii-btn-action" title="Copy ANSI escape sequences for bash or MOTD">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              COPY ANSI TERMINAL
            </button>
            <button type="button" id="btn-download-txt" class="ascii-btn-action" title="Download ASCII art as .txt file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              DOWNLOAD .TXT
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind event handlers
    attachModalEvents(modal);
  }

  /**
   * Binds click and change listeners to interactive studio controls.
   */
  function attachModalEvents(modal) {
    const closeBtn = document.getElementById('close-ascii-modal-btn');
    const overlay = document.getElementById('ascii-modal-overlay');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    // ESC key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeModal();
      }
    });

    // Resolution Presets
    const resButtons = modal.querySelectorAll('.ascii-btn-toggle[data-res]');
    resButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        resButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const [w, h] = btn.getAttribute('data-res').split('x').map(Number);
        studioState.width = w;
        studioState.height = h;
        renderStudioOutput();
      });
    });

    // Color Toggle
    const colorBtn = document.getElementById('ascii-toggle-color');
    const monoBtn = document.getElementById('ascii-toggle-mono');

    if (colorBtn && monoBtn) {
      colorBtn.addEventListener('click', () => {
        colorBtn.classList.add('active');
        monoBtn.classList.remove('active');
        studioState.colorMode = true;
        renderStudioOutput();
      });

      monoBtn.addEventListener('click', () => {
        monoBtn.classList.add('active');
        colorBtn.classList.remove('active');
        studioState.colorMode = false;
        renderStudioOutput();
      });
    }

    // Ramp Selector
    const rampSelect = document.getElementById('ascii-select-ramp');
    if (rampSelect) {
      rampSelect.addEventListener('change', () => {
        studioState.rampName = rampSelect.value;
        renderStudioOutput();
      });
    }

    // Invert Checkbox
    const checkInvert = document.getElementById('ascii-check-invert');
    if (checkInvert) {
      checkInvert.addEventListener('change', () => {
        studioState.invert = checkInvert.checked;
        renderStudioOutput();
      });
    }

    // Header Checkbox
    const checkHeader = document.getElementById('ascii-check-header');
    if (checkHeader) {
      checkHeader.addEventListener('change', () => {
        studioState.includeHeader = checkHeader.checked;
        renderStudioOutput();
      });
    }

    // Zoom Controls
    const zoomIn = document.getElementById('ascii-zoom-in');
    const zoomOut = document.getElementById('ascii-zoom-out');
    const zoomDisplay = document.getElementById('ascii-zoom-display');

    if (zoomIn && zoomOut && zoomDisplay) {
      zoomIn.addEventListener('click', () => {
        studioState.fontSize = Math.min(18, studioState.fontSize + 1);
        updateFontSize();
      });
      zoomOut.addEventListener('click', () => {
        studioState.fontSize = Math.max(6, studioState.fontSize - 1);
        updateFontSize();
      });
    }

    function updateFontSize() {
      const preview = document.getElementById('ascii-preview-content');
      if (preview) {
        preview.style.fontSize = `${studioState.fontSize}px`;
        preview.style.lineHeight = `${studioState.fontSize * 1.1}px`;
      }
      if (zoomDisplay) {
        zoomDisplay.textContent = `${studioState.fontSize}px`;
      }
    }

    // Action Buttons
    const btnDiscord = document.getElementById('btn-copy-discord');
    const btnRaw = document.getElementById('btn-copy-raw');
    const btnTerminal = document.getElementById('btn-copy-terminal');
    const btnDownload = document.getElementById('btn-download-txt');

    if (btnDiscord) {
      btnDiscord.addEventListener('click', () => {
        if (!studioState.lastResult) return;
        const text = formatDiscord(studioState.lastResult, {
          color: studioState.colorMode,
          includeHeader: studioState.includeHeader,
          metadata: studioState.metadata
        });
        copyToClipboard(text, 'Copied Discord Code Block to clipboard!');
      });
    }

    if (btnRaw) {
      btnRaw.addEventListener('click', () => {
        if (!studioState.lastResult) return;
        const text = formatRawAscii(studioState.lastResult, {
          includeHeader: studioState.includeHeader,
          metadata: studioState.metadata
        });
        copyToClipboard(text, 'Copied Raw ASCII to clipboard!');
      });
    }

    if (btnTerminal) {
      btnTerminal.addEventListener('click', () => {
        if (!studioState.lastResult) return;
        const text = formatTerminalAnsi(studioState.lastResult, {
          includeHeader: studioState.includeHeader,
          metadata: studioState.metadata
        });
        copyToClipboard(text, 'Copied ANSI Terminal escape string!');
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        if (!studioState.lastResult) return;
        const text = formatRawAscii(studioState.lastResult, {
          includeHeader: studioState.includeHeader,
          metadata: studioState.metadata
        });
        const safeTitle = (studioState.metadata.title || 'game')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
        const filename = `arcadeverse-${safeTitle}-${studioState.width}x${studioState.height}.txt`;
        downloadTextFile(filename, text);
        showStudioToast('Saved ASCII card to downloads!');
      });
    }
  }

  /**
   * Re-computes ASCII conversion based on current studio settings and updates preview DOM.
   */
  function renderStudioOutput() {
    let sourceCanvas = studioState.sourceCanvas;
    if (!sourceCanvas) {
      sourceCanvas = generateDemoCanvas(studioState.metadata.title || 'ARCADEVERSE');
      studioState.sourceCanvas = sourceCanvas;
    }

    let ramp = DEFAULT_RAMP;
    if (studioState.rampName === 'blocks') ramp = BLOCK_RAMP;
    if (studioState.rampName === 'minimal') ramp = MINIMAL_RAMP;

    try {
      const result = convertCanvas(sourceCanvas, {
        width: studioState.width,
        height: studioState.height,
        ramp,
        invert: studioState.invert,
        contrast: studioState.contrast,
        brightness: studioState.brightness
      });

      studioState.lastResult = result;

      // Update HTML Preview
      const preview = document.getElementById('ascii-preview-content');
      if (preview) {
        preview.innerHTML = renderHtmlPreview(result, studioState.colorMode);
      }

      // Update Badges
      const dimBadge = document.getElementById('ascii-badge-dimensions');
      const charBadge = document.getElementById('ascii-badge-chars');
      const discordBadge = document.getElementById('ascii-badge-discord');
      const terminalStatus = document.getElementById('ascii-terminal-status');

      if (dimBadge) dimBadge.textContent = `${result.width}x${result.height} COLS`;
      if (charBadge) charBadge.textContent = `${result.charCount} CHARS`;

      // Discord character limit evaluation:
      // Formatted discord length estimation (with ```ansi wrappers)
      const discordText = formatDiscord(result, {
        color: studioState.colorMode,
        includeHeader: studioState.includeHeader,
        metadata: studioState.metadata
      });
      const discordLen = discordText.length;

      if (discordBadge) {
        if (discordLen <= 2000) {
          discordBadge.className = 'ascii-badge ascii-badge-safe';
          discordBadge.textContent = `DISCORD READY (${discordLen}/2000)`;
        } else {
          discordBadge.className = 'ascii-badge ascii-badge-warn';
          discordBadge.textContent = `EXCEEDS 2K (${discordLen}c) - USE 40x20 OR NITRO`;
        }
      }

      if (terminalStatus) {
        terminalStatus.textContent = `TERMINAL PREVIEW // ${studioState.metadata.title.toUpperCase()}`;
      }
    } catch (err) {
      console.error('[AsciiArtConverter] Conversion error:', err);
      const preview = document.getElementById('ascii-preview-content');
      if (preview) {
        preview.textContent = 'Error rendering ASCII frame: ' + err.message;
      }
    }
  }

  /**
   * Opens the ASCII Studio modal and loads the specified or currently active game canvas.
   *
   * @param {HTMLCanvasElement} [canvas] Source canvas
   * @param {object} [metadata] Game metadata
   */
  function openModal(canvas, metadata = {}) {
    initUI();
    const modal = document.getElementById('ascii-art-modal');
    if (!modal) return;

    let targetCanvas = canvas;
    let targetMeta = Object.assign({}, studioState.metadata, metadata);

    // If no canvas provided, attempt extraction from active game iframe
    if (!targetCanvas && typeof document !== 'undefined') {
      const gameIframe = document.getElementById('game-iframe');
      if (gameIframe) {
        try {
          const doc = gameIframe.contentDocument || gameIframe.contentWindow.document;
          if (doc) {
            targetCanvas = doc.querySelector('canvas');
          }
        } catch (e) {
          console.warn('[AsciiArtConverter] Cross-origin iframe prevented canvas read:', e);
        }
      }

      // Read active game modal info
      const titleElem = document.getElementById('modal-game-title');
      const authorElem = document.getElementById('modal-game-author');
      const badgeElem = document.getElementById('modal-game-badge');

      if (titleElem) targetMeta.title = titleElem.textContent.trim();
      if (authorElem) targetMeta.author = authorElem.textContent.replace(/^By\s+@?/, '').trim();
      if (badgeElem) targetMeta.category = badgeElem.textContent.trim();
    }

    studioState.sourceCanvas = targetCanvas;
    studioState.metadata = targetMeta;

    modal.style.display = 'flex';
    document.body.classList.add('ascii-modal-open');

    renderStudioOutput();
  }

  /**
   * Closes the ASCII Studio modal.
   */
  function closeModal() {
    const modal = document.getElementById('ascii-art-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.classList.remove('ascii-modal-open');
    }
  }

  /**
   * Injects the ASCII Art Converter button into the game modal controls and registers shortcuts.
   */
  function bindGameModalTriggers() {
    if (typeof document === 'undefined') return;

    const modalControls = document.querySelector('#game-modal .modal-controls');
    const gameModal = document.getElementById('game-modal');

    // Add button if modal controls exist and button is not yet injected
    if (modalControls && !document.getElementById('modal-ascii-art-btn')) {
      const asciiBtn = document.createElement('button');
      asciiBtn.id = 'modal-ascii-art-btn';
      asciiBtn.className = 'btn btn-sm btn-icon';
      asciiBtn.title = 'Convert Canvas to Retro ASCII Art (A)';
      asciiBtn.setAttribute('aria-label', 'Convert Game Canvas to Retro ASCII Art');
      asciiBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-ascii-icon" aria-hidden="true">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      `;

      // Insert before reload button or append
      const reloadBtn = document.getElementById('reload-btn');
      if (reloadBtn) {
        modalControls.insertBefore(asciiBtn, reloadBtn);
      } else {
        modalControls.appendChild(asciiBtn);
      }

      asciiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    // Connect with modal share score button
    const shareBtn = document.getElementById('modal-share-score-btn');
    if (shareBtn && !shareBtn.dataset.asciiBound) {
      shareBtn.dataset.asciiBound = 'true';
      shareBtn.addEventListener('click', (e) => {
        // Open ASCII share card directly for sharing high scores
        e.preventDefault();
        openModal();
      });
    }

    // Keyboard shortcut [A] when game modal is open
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (gameModal && gameModal.classList.contains('active')) {
          const activeTag = document.activeElement ? document.activeElement.tagName : '';
          if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            e.preventDefault();
            openModal();
          }
        }
      }
    });
  }

  /**
   * Copies text to clipboard and displays user feedback toast.
   */
  function copyToClipboard(text, successMessage) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      // Fallback using textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showStudioToast(successMessage);
      } catch (err) {
        showStudioToast('Could not copy to clipboard.');
      }
      document.body.removeChild(ta);
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        showStudioToast(successMessage);
      })
      .catch((err) => {
        console.error('Clipboard error:', err);
        showStudioToast('Clipboard write error.');
      });
  }

  /**
   * Displays temporary feedback notification in the studio footer.
   */
  function showStudioToast(message) {
    const toast = document.getElementById('ascii-copy-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('visible');

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  /**
   * Triggers client-side text file download.
   */
  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Automatic DOM initialization in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
  }

  // Public API Export
  return {
    DEFAULT_RAMP,
    BLOCK_RAMP,
    MINIMAL_RAMP,
    ANSI_16_PALETTE,
    computeLuminance,
    mapToAnsiColor,
    convertPixelBuffer,
    convertCanvas,
    formatDiscord,
    formatRawAscii,
    formatTerminalAnsi,
    renderHtmlPreview,
    generateDemoCanvas,
    openModal,
    closeModal,
    initUI
  };
});
