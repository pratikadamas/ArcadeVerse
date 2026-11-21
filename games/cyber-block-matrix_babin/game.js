/**
 * Cyber Block Matrix — Pure Vanilla JS Arcade Engine
 * 10x20 Grid, Ghost Projection, Hold Buffer, Web Audio Synthesis
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30; // 300x600 canvas resolution
  const STORAGE_KEY = 'arcadeverse_matrix_highscore';

  // 7 Standard Tetromino Shapes and Cyber Neon Colors
  const SHAPES = {
    I: {
      color: '#00f5ff',
      matrix: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]
    },
    J: {
      color: '#3b82f6',
      matrix: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
      ]
    },
    L: {
      color: '#f97316',
      matrix: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
      ]
    },
    O: {
      color: '#fbbf24',
      matrix: [
        [1, 1],
        [1, 1]
      ]
    },
    S: {
      color: '#10b981',
      matrix: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
      ]
    },
    T: {
      color: '#a855f7',
      matrix: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
      ]
    },
    Z: {
      color: '#f43f5e',
      matrix: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
      ]
    }
  };

  const SHAPE_KEYS = Object.keys(SHAPES);

  // Web Audio Synthesizer
  const AudioEngine = {
    ctx: null,
    muted: false,

    init() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !this.ctx) {
        this.ctx = new AudioCtx();
      }
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    playTone(freq, type = 'sine', duration = 0.08, vol = 0.15) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (_) {}
    },

    playMove() { this.playTone(280, 'sine', 0.04, 0.08); },
    playRotate() { this.playTone(480, 'triangle', 0.06, 0.12); },
    playDrop() { this.playTone(180, 'square', 0.12, 0.2); },
    playHold() { this.playTone(340, 'sine', 0.09, 0.15); },
    playLine() {
      this.playTone(523.25, 'triangle', 0.18, 0.25);
      setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.25), 60);
      setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.3), 120);
    },
    playGameOver() {
      this.playTone(200, 'sawtooth', 0.3, 0.3);
      setTimeout(() => this.playTone(140, 'sawtooth', 0.4, 0.35), 200);
    }
  };

  class MatrixGame {
    constructor() {
      this.canvas = document.getElementById('matrix-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.holdCanvas = document.getElementById('hold-canvas');
      this.holdCtx = this.holdCanvas.getContext('2d');
      this.nextCanvas = document.getElementById('next-canvas');
      this.nextCtx = this.nextCanvas.getContext('2d');

      this.scoreEl = document.getElementById('score-display');
      this.linesEl = document.getElementById('lines-display');
      this.levelEl = document.getElementById('level-display');
      this.highscoreEl = document.getElementById('highscore-display');
      this.overlay = document.getElementById('game-overlay');
      this.overlayTitle = document.getElementById('overlay-title');
      this.overlaySubtitle = document.getElementById('overlay-subtitle');
      this.btnStart = document.getElementById('btn-start');

      this.grid = [];
      this.currentPiece = null;
      this.nextPieceKey = null;
      this.heldPieceKey = null;
      this.canHold = true;

      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.highScore = this.getStoredHighScore();
      this.highscoreEl.textContent = this.highScore;

      this.dropCounter = 0;
      this.dropInterval = 800; // ms
      this.lastTime = 0;
      this.gameState = 'READY'; // READY, PLAYING, PAUSED, GAMEOVER
      this.rafId = null;

      this.initGrid();
      this.bindInputs();
    }

    getStoredHighScore() {
      try {
        const val = localStorage.getItem(STORAGE_KEY);
        return val ? parseInt(val, 10) || 0 : 0;
      } catch (_) {
        return 0;
      }
    }

    setStoredHighScore(val) {
      try {
        localStorage.setItem(STORAGE_KEY, String(val));
      } catch (_) {}
    }

    initGrid() {
      this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    start() {
      AudioEngine.init();
      AudioEngine.resume();
      this.initGrid();
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.dropInterval = 800;
      this.heldPieceKey = null;
      this.canHold = true;
      this.updateHUD();

      this.nextPieceKey = this.getRandomPieceKey();
      this.spawnPiece();

      this.gameState = 'PLAYING';
      this.overlay.classList.add('hidden');

      this.startLoop();
    }

    getRandomPieceKey() {
      return SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    }

    spawnPiece() {
      const key = this.nextPieceKey || this.getRandomPieceKey();
      this.nextPieceKey = this.getRandomPieceKey();
      this.drawMiniPiece(this.nextCtx, this.nextPieceKey, this.nextCanvas.width);

      const shapeData = SHAPES[key];
      this.currentPiece = {
        key,
        color: shapeData.color,
        matrix: shapeData.matrix.map(row => [...row]),
        x: Math.floor(COLS / 2) - Math.ceil(shapeData.matrix[0].length / 2),
        y: 0
      };

      this.canHold = true;

      // Game over collision check
      if (this.collides(this.currentPiece, this.grid)) {
        this.gameOver();
      }
    }

    collides(piece, grid, offsetX = 0, offsetY = 0) {
      const m = piece.matrix;
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (m[y][x] !== 0) {
            const nextX = piece.x + x + offsetX;
            const nextY = piece.y + y + offsetY;
            if (nextX < 0 || nextX >= COLS || nextY >= ROWS) return true;
            if (nextY >= 0 && grid[nextY][nextX] !== 0) return true;
          }
        }
      }
      return false;
    }

    rotateMatrix(matrix) {
      const N = matrix.length;
      const result = Array.from({ length: N }, () => Array(N).fill(0));
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          result[x][N - 1 - y] = matrix[y][x];
        }
      }
      return result;
    }

    rotate() {
      if (this.gameState !== 'PLAYING' || !this.currentPiece) return;
      const rotated = this.rotateMatrix(this.currentPiece.matrix);
      const prevMatrix = this.currentPiece.matrix;
      this.currentPiece.matrix = rotated;

      // Wall kick test
      let kick = 0;
      if (this.collides(this.currentPiece, this.grid)) {
        kick = this.currentPiece.x > COLS / 2 ? -1 : 1;
        if (this.collides(this.currentPiece, this.grid, kick, 0)) {
          this.currentPiece.matrix = prevMatrix; // revert
          return;
        }
        this.currentPiece.x += kick;
      }
      AudioEngine.playRotate();
    }

    move(dir) {
      if (this.gameState !== 'PLAYING' || !this.currentPiece) return;
      if (!this.collides(this.currentPiece, this.grid, dir, 0)) {
        this.currentPiece.x += dir;
        AudioEngine.playMove();
      }
    }

    softDrop() {
      if (this.gameState !== 'PLAYING' || !this.currentPiece) return;
      if (!this.collides(this.currentPiece, this.grid, 0, 1)) {
        this.currentPiece.y += 1;
        this.score += 1;
        this.updateHUD();
      } else {
        this.lockPiece();
      }
    }

    hardDrop() {
      if (this.gameState !== 'PLAYING' || !this.currentPiece) return;
      let dropDist = 0;
      while (!this.collides(this.currentPiece, this.grid, 0, 1)) {
        this.currentPiece.y += 1;
        dropDist++;
      }
      this.score += dropDist * 2;
      this.updateHUD();
      AudioEngine.playDrop();
      this.lockPiece();
    }

    hold() {
      if (this.gameState !== 'PLAYING' || !this.canHold || !this.currentPiece) return;

      const currentKey = this.currentPiece.key;
      if (!this.heldPieceKey) {
        this.heldPieceKey = currentKey;
        this.drawMiniPiece(this.holdCtx, this.heldPieceKey, this.holdCanvas.width);
        this.spawnPiece();
      } else {
        const swapKey = this.heldPieceKey;
        this.heldPieceKey = currentKey;
        this.drawMiniPiece(this.holdCtx, this.heldPieceKey, this.holdCanvas.width);

        const shapeData = SHAPES[swapKey];
        this.currentPiece = {
          key: swapKey,
          color: shapeData.color,
          matrix: shapeData.matrix.map(row => [...row]),
          x: Math.floor(COLS / 2) - Math.ceil(shapeData.matrix[0].length / 2),
          y: 0
        };
      }
      this.canHold = false;
      AudioEngine.playHold();
    }

    lockPiece() {
      const p = this.currentPiece;
      for (let y = 0; y < p.matrix.length; y++) {
        for (let x = 0; x < p.matrix[y].length; x++) {
          if (p.matrix[y][x] !== 0) {
            const gy = p.y + y;
            const gx = p.x + x;
            if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
              this.grid[gy][gx] = p.color;
            }
          }
        }
      }

      this.clearLines();
      this.spawnPiece();
    }

    clearLines() {
      let linesCleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.grid[y].every(cell => cell !== 0)) {
          this.grid.splice(y, 1);
          this.grid.unshift(Array(COLS).fill(0));
          linesCleared++;
          y++; // check same row again
        }
      }

      if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800];
        this.score += (points[linesCleared] || 800) * this.level;
        this.lines += linesCleared;
        this.level = Math.floor(this.lines / 10) + 1;
        this.dropInterval = Math.max(120, 800 - (this.level - 1) * 70);

        AudioEngine.playLine();
        this.updateHUD();
      }
    }

    updateHUD() {
      this.scoreEl.textContent = this.score;
      this.linesEl.textContent = this.lines;
      this.levelEl.textContent = this.level;

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.highscoreEl.textContent = this.highScore;
        this.setStoredHighScore(this.highScore);
      }
    }

    gameOver() {
      this.gameState = 'GAMEOVER';
      AudioEngine.playGameOver();
      this.overlayTitle.textContent = 'RUN TERMINATED';
      this.overlaySubtitle.textContent = `Score: ${this.score} • Lines: ${this.lines} • Level: ${this.level}`;
      this.btnStart.textContent = 'RETRY RUN';
      this.overlay.classList.remove('hidden');

      try {
        window.dispatchEvent(new CustomEvent('ARCADEVERSE_GAME_OVER', {
          detail: { gameId: 'cyber-block-matrix', score: this.score, lines: this.lines, level: this.level }
        }));
      } catch (_) {}
    }

    togglePause() {
      if (this.gameState === 'PLAYING') {
        this.gameState = 'PAUSED';
        this.stopLoop();
        this.overlayTitle.textContent = 'SYSTEM PAUSED';
        this.overlaySubtitle.textContent = 'Matrix simulation suspended. Press P or Resume to continue.';
        this.btnStart.textContent = 'RESUME RUN';
        this.overlay.classList.remove('hidden');
      } else if (this.gameState === 'PAUSED') {
        this.gameState = 'PLAYING';
        this.overlay.classList.add('hidden');
        this.startLoop();
      }
    }

    drawMiniPiece(ctx, shapeKey, size) {
      ctx.clearRect(0, 0, size, size);
      if (!shapeKey) return;
      const shape = SHAPES[shapeKey];
      const m = shape.matrix;
      const bSize = 16;
      const offX = (size - m[0].length * bSize) / 2;
      const offY = (size - m.length * bSize) / 2;

      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (m[y][x] !== 0) {
            ctx.fillStyle = shape.color;
            ctx.fillRect(offX + x * bSize, offY + y * bSize, bSize - 1, bSize - 1);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(offX + x * bSize, offY + y * bSize, bSize - 1, bSize - 1);
          }
        }
      }
    }

    render() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. Draw Background Grid Lines
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      this.ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        this.ctx.beginPath();
        this.ctx.moveTo(x * BLOCK_SIZE, 0);
        this.ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        this.ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y * BLOCK_SIZE);
        this.ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
        this.ctx.stroke();
      }

      // 2. Draw Locked Grid Blocks
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (this.grid[y][x] !== 0) {
            this.drawBlock(this.ctx, x, y, this.grid[y][x]);
          }
        }
      }

      if (this.currentPiece && this.gameState === 'PLAYING') {
        // 3. Draw Ghost Projection Piece
        let ghostY = this.currentPiece.y;
        while (!this.collides(this.currentPiece, this.grid, 0, ghostY - this.currentPiece.y + 1)) {
          ghostY++;
        }

        const p = this.currentPiece;
        for (let y = 0; y < p.matrix.length; y++) {
          for (let x = 0; x < p.matrix[y].length; x++) {
            if (p.matrix[y][x] !== 0) {
              const gx = (p.x + x) * BLOCK_SIZE;
              const gy = (ghostY + y) * BLOCK_SIZE;
              this.ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
              this.ctx.fillRect(gx + 1, gy + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
              this.ctx.strokeStyle = p.color;
              this.ctx.lineWidth = 1;
              this.ctx.strokeRect(gx + 1, gy + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
            }
          }
        }

        // 4. Draw Active Piece
        for (let y = 0; y < p.matrix.length; y++) {
          for (let x = 0; x < p.matrix[y].length; x++) {
            if (p.matrix[y][x] !== 0) {
              this.drawBlock(this.ctx, p.x + x, p.y + y, p.color);
            }
          }
        }
      }
    }

    drawBlock(ctx, x, y, color) {
      const px = x * BLOCK_SIZE;
      const py = y * BLOCK_SIZE;
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

      // Inner neon bevel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 4, 3);
      ctx.fillRect(px + 2, py + 2, 3, BLOCK_SIZE - 4);
    }

    gameLoop(time = 0) {
      if (this.gameState !== 'PLAYING') return;
      const rawDelta = time - this.lastTime;
      const deltaTime = Math.min(Math.max(rawDelta, 0), 100);
      this.lastTime = time;

      this.dropCounter += deltaTime;
      if (this.dropCounter > this.dropInterval) {
        this.softDrop();
        this.dropCounter = 0;
      }

      this.render();
      this.rafId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    startLoop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    stopLoop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    bindInputs() {
      // Keyboard
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }

        if (this.gameState === 'READY' || this.gameState === 'GAMEOVER') {
          if (e.key === ' ' || e.key === 'Enter') {
            this.start();
          }
          return;
        }

        switch (e.key) {
          case 'ArrowLeft':
          case 'a':
          case 'A':
            this.move(-1);
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            this.move(1);
            break;
          case 'ArrowUp':
          case 'w':
          case 'W':
          case 'x':
          case 'X':
            this.rotate();
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            this.softDrop();
            break;
          case ' ':
            this.hardDrop();
            break;
          case 'c':
          case 'C':
          case 'Shift':
            this.hold();
            break;
          case 'p':
          case 'P':
            this.togglePause();
            break;
        }
      });

      // Start/Restart button
      this.btnStart.addEventListener('click', () => {
        if (this.gameState === 'PAUSED') {
          this.togglePause();
        } else {
          this.start();
        }
      });

      // Mobile Touch Controls
      document.getElementById('btn-touch-left').addEventListener('click', () => this.move(-1));
      document.getElementById('btn-touch-right').addEventListener('click', () => this.move(1));
      document.getElementById('btn-touch-rotate').addEventListener('click', () => this.rotate());
      document.getElementById('btn-touch-down').addEventListener('click', () => this.softDrop());
      document.getElementById('btn-touch-drop').addEventListener('click', () => this.hardDrop());
      document.getElementById('btn-touch-hold').addEventListener('click', () => this.hold());

      // Audio Mute Toggle
      const btnSound = document.getElementById('btn-sound-toggle');
      btnSound.addEventListener('click', () => {
        AudioEngine.muted = !AudioEngine.muted;
        btnSound.style.opacity = AudioEngine.muted ? '0.4' : '1';
      });

      // Rules Modal
      const modalRules = document.getElementById('modal-rules');
      document.getElementById('btn-how-to-play').addEventListener('click', () => {
        if (this.gameState === 'PLAYING') this.togglePause();
        modalRules.classList.add('active');
        modalRules.setAttribute('aria-hidden', 'false');
      });

      document.getElementById('btn-close-rules').addEventListener('click', () => {
        modalRules.classList.remove('active');
        modalRules.setAttribute('aria-hidden', 'true');
      });

      // Visibility and platform listeners
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.gameState === 'PLAYING') {
            this.togglePause();
          } else {
            this.stopLoop();
          }
        }
      });

      window.addEventListener('ARCADEVERSE_PAUSE', () => {
        if (this.gameState === 'PLAYING') {
          this.togglePause();
        } else {
          this.stopLoop();
        }
      });

      window.addEventListener('ARCADEVERSE_RESUME', () => {
        if (this.gameState === 'PAUSED') {
          this.togglePause();
        }
      });

      window.addEventListener('ARCADEVERSE_TEARDOWN', () => {
        this.stopLoop();
        if (AudioEngine.ctx && AudioEngine.ctx.state !== 'closed') {
          try { AudioEngine.ctx.close(); } catch (_) {}
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    new MatrixGame();
  });
})();
