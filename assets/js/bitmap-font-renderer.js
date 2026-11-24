/**
 * BitmapFontRenderer - Interactive Pixel-Art Glyph Matrix & Custom Bitmap Font Renderer
 * 
 * Encodes ASCII and arcade symbols into compact 3x5 and 5x5 binary bitmasks,
 * providing zero-dependency integer-scaling typography without Web Font FOUT or blurry text.
 */

class BitmapFontRenderer {
  constructor() {
    // 3x5 Bitmask matrix representation (each number is a row bitmask, 5 rows per char)
    this.FONT_3x5 = {
      ' ': [0, 0, 0, 0, 0],
      'A': [2, 5, 7, 5, 5],
      'B': [6, 5, 6, 5, 6],
      'C': [3, 4, 4, 4, 3],
      'D': [6, 5, 5, 5, 6],
      'E': [7, 4, 6, 4, 7],
      'F': [7, 4, 6, 4, 4],
      'G': [3, 4, 5, 5, 3],
      'H': [5, 5, 7, 5, 5],
      'I': [7, 2, 2, 2, 7],
      'J': [1, 1, 1, 5, 2],
      'K': [5, 5, 6, 5, 5],
      'L': [4, 4, 4, 4, 7],
      'M': [5, 7, 5, 5, 5],
      'N': [6, 5, 5, 5, 5],
      'O': [2, 5, 5, 5, 2],
      'P': [6, 5, 6, 4, 4],
      'Q': [2, 5, 5, 6, 3],
      'R': [6, 5, 6, 5, 5],
      'S': [3, 4, 2, 1, 6],
      'T': [7, 2, 2, 2, 2],
      'U': [5, 5, 5, 5, 7],
      'V': [5, 5, 5, 5, 2],
      'W': [5, 5, 5, 7, 5],
      'X': [5, 5, 2, 5, 5],
      'Y': [5, 5, 2, 2, 2],
      'Z': [7, 1, 2, 4, 7],
      '0': [7, 5, 5, 5, 7],
      '1': [2, 6, 2, 2, 7],
      '2': [7, 1, 7, 4, 7],
      '3': [7, 1, 3, 1, 7],
      '4': [5, 5, 7, 1, 1],
      '5': [7, 4, 7, 1, 7],
      '6': [7, 4, 7, 5, 7],
      '7': [7, 1, 2, 2, 2],
      '8': [7, 5, 7, 5, 7],
      '9': [7, 5, 7, 1, 7],
      ':': [0, 2, 0, 2, 0],
      '.': [0, 0, 0, 0, 2],
      '!': [2, 2, 2, 0, 2],
      '?': [6, 1, 2, 0, 2],
      '-': [0, 0, 7, 0, 0],
      '<3': [5, 7, 7, 2, 0], // Heart glyph
      '#': [5, 7, 2, 7, 5]   // Coin / Token glyph
    };
  }

  measureText(text, scale = 1, charSpacing = 1) {
    const chars = text.toUpperCase();
    const charWidth = 3 * scale;
    const spacing = charSpacing * scale;
    const width = chars.length > 0 ? chars.length * charWidth + (chars.length - 1) * spacing : 0;
    const height = 5 * scale;
    return { width, height };
  }

  drawPixelText(ctx, text, startX, startY, options = {}) {
    if (!ctx) return;
    const scale = options.scale || 2;
    const color = options.color || '#00f5ff';
    const shadowColor = options.shadowColor || null;
    const charSpacing = options.spacing !== undefined ? options.spacing : 1;

    const chars = text.toUpperCase();
    let currentX = startX;

    for (let c = 0; c < chars.length; c++) {
      const char = chars[c];
      const rows = this.FONT_3x5[char] || this.FONT_3x5['?'];

      // Render optional drop shadow
      if (shadowColor) {
        ctx.fillStyle = shadowColor;
        for (let r = 0; r < 5; r++) {
          const rowBits = rows[r];
          for (let bit = 2; bit >= 0; bit--) {
            if ((rowBits & (1 << bit)) !== 0) {
              const px = currentX + (2 - bit) * scale + scale;
              const py = startY + r * scale + scale;
              ctx.fillRect(px, py, scale, scale);
            }
          }
        }
      }

      // Render primary pixel text
      ctx.fillStyle = color;
      for (let r = 0; r < 5; r++) {
        const rowBits = rows[r];
        for (let bit = 2; bit >= 0; bit--) {
          if ((rowBits & (1 << bit)) !== 0) {
            const px = currentX + (2 - bit) * scale;
            const py = startY + r * scale;
            ctx.fillRect(px, py, scale, scale);
          }
        }
      }

      currentX += 3 * scale + charSpacing * scale;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BitmapFontRenderer };
}
