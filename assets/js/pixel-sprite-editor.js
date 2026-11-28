/**
 * Interactive Pixel-Art Sprite Editor & CSS Box-Shadow Exporter
 * 16x16 / 32x32 grid editor, scanline flood fill, undo/redo history stack,
 * mirror drawing, PNG data URL, and CSS box-shadow code exporter.
 * Pure Vanilla JS, zero dependencies, zero emojis.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PixelSpriteEditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  const PALETTE = [
    '#000000', '#1d2b53', '#7e2553', '#008751',
    '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436',
    '#29adff', '#83769c', '#ff77a8', '#ffccaa'
  ];

  class SpriteBuffer {
    constructor(size = 16) {
      this.size = size;
      this.pixels = new Array(size * size).fill(null);
    }

    clone() {
      const copy = new SpriteBuffer(this.size);
      copy.pixels = this.pixels.slice();
      return copy;
    }

    get(x, y) {
      if (x < 0 || x >= this.size || y < 0 || y >= this.size) return null;
      return this.pixels[y * this.size + x];
    }

    set(x, y, color) {
      if (x < 0 || x >= this.size || y < 0 || y >= this.size) return;
      this.pixels[y * this.size + x] = color;
    }

    floodFill(startX, startY, targetColor, fillColor) {
      if (startX < 0 || startX >= this.size || startY < 0 || startY >= this.size) return;
      if (targetColor === fillColor) return;

      const queue = [[startX, startY]];
      const visited = new Uint8Array(this.size * this.size);

      while (queue.length > 0) {
        const [cx, cy] = queue.pop();
        const idx = cy * this.size + cx;

        if (visited[idx]) continue;
        visited[idx] = 1;

        if (this.pixels[idx] === targetColor) {
          this.pixels[idx] = fillColor;

          if (cx > 0) queue.push([cx - 1, cy]);
          if (cx < this.size - 1) queue.push([cx + 1, cy]);
          if (cy > 0) queue.push([cx, cy - 1]);
          if (cy < this.size - 1) queue.push([cx, cy + 1]);
        }
      }
    }

    toBoxShadowString(pixelSize = 10) {
      const shadows = [];
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          const color = this.get(x, y);
          if (color) {
            const posX = (x + 1) * pixelSize;
            const posY = (y + 1) * pixelSize;
            shadows.push(`${posX}px ${posY}px ${color}`);
          }
        }
      }

      if (shadows.length === 0) {
        return 'box-shadow: none;';
      }

      return `/* Width: ${this.size * pixelSize}px, Height: ${this.size * pixelSize}px */\nbox-shadow:\n  ${shadows.join(',\n  ')};`;
    }

    clear() {
      this.pixels.fill(null);
    }
  }

  class EditorEngine {
    constructor(size = 16) {
      this.size = size;
      this.buffer = new SpriteBuffer(size);
      this.history = [this.buffer.clone()];
      this.historyIndex = 0;
      this.maxHistory = 30;

      this.currentTool = 'pencil'; // pencil, eraser, fill, eyedropper
      this.currentColor = PALETTE[0];
      this.mirrorX = false;
    }

    pushHistory() {
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      this.history.push(this.buffer.clone());
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      } else {
        this.historyIndex++;
      }
    }

    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.buffer = this.history[this.historyIndex].clone();
        return true;
      }
      return false;
    }

    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.buffer = this.history[this.historyIndex].clone();
        return true;
      }
      return false;
    }

    applyTool(x, y) {
      if (x < 0 || x >= this.size || y < 0 || y >= this.size) return;

      if (this.currentTool === 'eyedropper') {
        const color = this.buffer.get(x, y);
        if (color) this.currentColor = color;
        return;
      }

      if (this.currentTool === 'fill') {
        const targetColor = this.buffer.get(x, y);
        this.buffer.floodFill(x, y, targetColor, this.currentColor);
        this.pushHistory();
        return;
      }

      const drawColor = this.currentTool === 'eraser' ? null : this.currentColor;
      this.buffer.set(x, y, drawColor);

      if (this.mirrorX) {
        const mirrorX = this.size - 1 - x;
        this.buffer.set(mirrorX, y, drawColor);
      }
    }
  }

  function createStudio(container, options = {}) {
    if (!container) return null;

    const size = options.size || 16;
    const engine = new EditorEngine(size);

    container.innerHTML = `
      <div class="pixel-editor-container">
        <div class="pixel-editor-header">
          <h2 class="pixel-editor-title">Pixel-Art Sprite Editor & CSS Exporter</h2>
          <span style="font-size:0.85rem;color:var(--pixel-muted);">${size}x${size} Grid Matrix</span>
        </div>
        <div class="pixel-editor-workspace">
          <div class="pixel-canvas-panel">
            <div class="pixel-canvas-wrapper">
              <canvas class="pixel-canvas" width="384" height="384"></canvas>
            </div>
            <div class="pixel-toolbar">
              <button class="pixel-tool-btn active" data-tool="pencil">Pencil</button>
              <button class="pixel-tool-btn" data-tool="eraser">Eraser</button>
              <button class="pixel-tool-btn" data-tool="fill">Flood Fill</button>
              <button class="pixel-tool-btn" data-tool="eyedropper">Eyedropper</button>
              <button class="pixel-tool-btn" id="pixel-toggle-mirror">Mirror X: OFF</button>
              <button class="pixel-tool-btn" id="pixel-btn-undo">Undo</button>
              <button class="pixel-tool-btn" id="pixel-btn-redo">Redo</button>
            </div>
          </div>
          <div class="pixel-sidebar">
            <div>
              <div class="pixel-section-title">Color Palette</div>
              <div class="pixel-palette-grid" id="pixel-palette"></div>
            </div>
            <div>
              <div class="pixel-section-title">1:1 Sprite Preview</div>
              <div class="pixel-preview-row">
                <div class="pixel-preview-box">
                  <canvas class="pixel-preview-canvas" width="${size}" height="${size}"></canvas>
                </div>
                <div style="font-size:0.8rem;color:var(--pixel-muted);">
                  Pure native rendering.<br/>No blur / antialiasing.
                </div>
              </div>
            </div>
            <div>
              <div class="pixel-section-title">CSS Box-Shadow Output</div>
              <textarea class="pixel-export-area" id="pixel-box-shadow-code" readonly></textarea>
            </div>
            <div class="pixel-btn-row">
              <button class="pixel-btn" id="pixel-btn-export-png">Export PNG</button>
              <button class="pixel-btn pixel-btn-secondary" id="pixel-btn-clear">Clear</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const canvas = container.querySelector('.pixel-canvas');
    const ctx = canvas.getContext('2d');
    const previewCanvas = container.querySelector('.pixel-preview-canvas');
    const prevCtx = previewCanvas.getContext('2d');
    const paletteGrid = container.querySelector('#pixel-palette');
    const codeArea = container.querySelector('#pixel-box-shadow-code');
    const btnMirror = container.querySelector('#pixel-toggle-mirror');
    const btnUndo = container.querySelector('#pixel-btn-undo');
    const btnRedo = container.querySelector('#pixel-btn-redo');
    const btnExportPng = container.querySelector('#pixel-btn-export-png');
    const btnClear = container.querySelector('#pixel-btn-clear');

    const cellSize = canvas.width / engine.size;
    let isDrawing = false;

    // Build Palette
    PALETTE.forEach((col, idx) => {
      const swatch = document.createElement('div');
      swatch.className = `pixel-color-swatch ${idx === 0 ? 'active' : ''}`;
      swatch.style.backgroundColor = col;
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.pixel-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        engine.currentColor = col;
      });
      paletteGrid.appendChild(swatch);
    });

    // Tool switching
    container.querySelectorAll('.pixel-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.pixel-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.currentTool = btn.dataset.tool;
      });
    });

    btnMirror.addEventListener('click', () => {
      engine.mirrorX = !engine.mirrorX;
      btnMirror.textContent = `Mirror X: ${engine.mirrorX ? 'ON' : 'OFF'}`;
      btnMirror.classList.toggle('active', engine.mirrorX);
    });

    btnUndo.addEventListener('click', () => {
      if (engine.undo()) render();
    });

    btnRedo.addEventListener('click', () => {
      if (engine.redo()) render();
    });

    btnClear.addEventListener('click', () => {
      engine.buffer.clear();
      engine.pushHistory();
      render();
    });

    btnExportPng.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `sprite-${size}x${size}.png`;
      link.href = previewCanvas.toDataURL('image/png');
      link.click();
    });

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / engine.size));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / engine.size));
      return { x, y };
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      prevCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

      // Draw grid pixels
      for (let y = 0; y < engine.size; y++) {
        for (let x = 0; x < engine.size; x++) {
          const color = engine.buffer.get(x, y);
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

            prevCtx.fillStyle = color;
            prevCtx.fillRect(x, y, 1, 1);
          }

          // Subtle grid guide lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }

      // Update box shadow code
      codeArea.value = engine.buffer.toBoxShadowString(10);
    }

    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const { x, y } = getCoords(e);
      engine.applyTool(x, y);
      render();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      if (engine.currentTool === 'fill' || engine.currentTool === 'eyedropper') return;
      const { x, y } = getCoords(e);
      engine.applyTool(x, y);
      render();
    });

    window.addEventListener('mouseup', () => {
      if (isDrawing) {
        isDrawing = false;
        if (engine.currentTool !== 'fill' && engine.currentTool !== 'eyedropper') {
          engine.pushHistory();
        }
      }
    });

    render();

    return {
      engine,
      render
    };
  }

  return {
    PALETTE,
    SpriteBuffer,
    EditorEngine,
    createStudio
  };
}));
