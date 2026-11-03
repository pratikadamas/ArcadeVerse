/**
 * Quantum Minesweeper DX: Grid Defusal
 * Guaranteed Safe First Click, Dynamic Flood Fill Cascade, Flagging Engine, and Web Audio API Synthesizer
 * Author: Babin Bid (Babin123456)
 */

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER ---
  class SoundSynth {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playReveal(pitch = 500) {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    playFlag() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playBomb() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }

    playWin() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [440, 554, 659, 880].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.2, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.2);
      });
    }
  }

  // --- CONFIG & STATE ---
  const PRESETS = {
    novice: { rows: 9, cols: 9, mines: 10 },
    specialist: { rows: 16, cols: 16, mines: 40 },
    overlord: { rows: 16, cols: 24, mines: 99 }
  };

  const sound = new SoundSynth();
  let currentDifficulty = 'novice';
  let rows = 9;
  let cols = 9;
  let totalMines = 10;

  let grid = []; // 2D array of cells
  let isFirstClick = true;
  let isGameOver = false;
  let isWon = false;
  let flagsRemaining = 10;
  let timer = 0;
  let timerInterval = null;
  let isFlagModeMobile = false;

  const STORAGE_KEY_PREFIX = 'arcadeverse_minesweeper_best_';

  // --- INIT & RESET ---
  function initGame(diff = 'novice') {
    currentDifficulty = diff;
    const cfg = PRESETS[diff];
    rows = cfg.rows;
    cols = cfg.cols;
    totalMines = cfg.mines;

    isFirstClick = true;
    isGameOver = false;
    isWon = false;
    flagsRemaining = totalMines;
    timer = 0;
    clearInterval(timerInterval);
    timerInterval = null;

    updateHUD();
    buildEmptyGrid();
    renderGridDOM();

    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('tutorial-modal').classList.add('hidden');
  }

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      timer++;
      if (timer > 999) timer = 999;
      document.getElementById('timer-counter').textContent = String(timer).padStart(3, '0');
    }, 1000);
  }

  function updateHUD() {
    document.getElementById('mines-counter').textContent = String(Math.max(0, flagsRemaining)).padStart(3, '0');
    document.getElementById('timer-counter').textContent = String(timer).padStart(3, '0');
  }

  function buildEmptyGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = {
          row: r,
          col: c,
          mine: false,
          revealed: false,
          flagged: false,
          adjacent: 0,
          element: null
        };
      }
    }
  }

  // Guaranteed Safe First Click (Spawns mines avoiding first clicked cell and its 8 neighbors)
  function populateMines(firstRow, firstCol) {
    let planted = 0;
    while (planted < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Safe zone: cell itself and surrounding 8 neighbors
      const isSafeZone = Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1;

      if (!grid[r][c].mine && !isSafeZone) {
        grid[r][c].mine = true;
        planted++;
      }
    }

    // Calculate adjacency numbers
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c].mine) {
          let count = 0;
          forEachNeighbor(r, c, (nr, nc) => {
            if (grid[nr][nc].mine) count++;
          });
          grid[r][c].adjacent = count;
        }
      }
    }
  }

  function forEachNeighbor(r, c, callback) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          callback(nr, nc);
        }
      }
    }
  }

  // --- DOM RENDERING ---
  function renderGridDOM() {
    const board = document.getElementById('mines-grid');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${cols}, 32px)`;
    board.style.gridTemplateRows = `repeat(${rows}, 32px)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellData = grid[r][c];
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.row = r;
        el.dataset.col = c;

        // Desktop Click
        el.addEventListener('click', (e) => {
          sound.init();
          if (isFlagModeMobile) {
            toggleFlag(r, c);
          } else {
            handleCellClick(r, c);
          }
        });

        // Right-Click Flagging
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          sound.init();
          toggleFlag(r, c);
        });

        cellData.element = el;
        board.appendChild(el);
      }
    }
  }

  // --- ACTIONS ---
  function handleCellClick(r, c) {
    if (isGameOver || isWon) return;
    const cell = grid[r][c];
    if (cell.flagged || cell.revealed) return;

    if (isFirstClick) {
      isFirstClick = false;
      populateMines(r, c);
      startTimer();
    }

    if (cell.mine) {
      // Trigger Game Over
      triggerDefeat(r, c);
      return;
    }

    // Cascade Flood Fill
    revealCell(r, c);
    checkWinCondition();
  }

  function revealCell(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged) return;

    cell.revealed = true;
    cell.element.classList.add('revealed');

    if (cell.adjacent > 0) {
      cell.element.textContent = cell.adjacent;
      cell.element.setAttribute('data-num', cell.adjacent);
      sound.playReveal(400 + cell.adjacent * 50);
    } else {
      sound.playReveal(320);
      // Zero adjacent cascade flood fill
      forEachNeighbor(r, c, (nr, nc) => {
        if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) {
          revealCell(nr, nc);
        }
      });
    }
  }

  function toggleFlag(r, c) {
    if (isGameOver || isWon) return;
    const cell = grid[r][c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    sound.playFlag();

    if (cell.flagged) {
      flagsRemaining--;
      cell.element.classList.add('flagged');
      cell.element.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
          <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2.5"></line>
        </svg>
      `;
    } else {
      flagsRemaining++;
      cell.element.classList.remove('flagged');
      cell.element.innerHTML = '';
    }

    updateHUD();
  }

  function triggerDefeat(hitRow, hitCol) {
    isGameOver = true;
    clearInterval(timerInterval);
    sound.playBomb();

    // Reveal all mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.mine) {
          cell.element.classList.add('revealed');
          if (r === hitRow && c === hitCol) {
            cell.element.classList.add('mine-hit');
          }
          cell.element.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="8"></circle>
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
            </svg>
          `;
        }
      }
    }

    setTimeout(() => {
      document.getElementById('res-badge').className = 'result-badge red';
      document.getElementById('res-badge').textContent = 'GRID COMPROMISED';
      document.getElementById('res-title').textContent = 'ANOMALY DETONATED';
      document.getElementById('res-time').textContent = `${timer}s`;

      const best = localStorage.getItem(STORAGE_KEY_PREFIX + currentDifficulty) || '--';
      document.getElementById('res-best').textContent = best === '--' ? '--' : `${best}s`;
      document.getElementById('result-modal').classList.remove('hidden');
    }, 900);
  }

  function checkWinCondition() {
    let unrevealedSafe = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c].mine && !grid[r][c].revealed) {
          unrevealedSafe++;
        }
      }
    }

    if (unrevealedSafe === 0) {
      isWon = true;
      clearInterval(timerInterval);
      sound.playWin();

      // Store Best Time
      const storageKey = STORAGE_KEY_PREFIX + currentDifficulty;
      const currentBest = parseInt(localStorage.getItem(storageKey) || '9999', 10);
      if (timer < currentBest) {
        localStorage.setItem(storageKey, timer);
      }

      setTimeout(() => {
        document.getElementById('res-badge').className = 'result-badge';
        document.getElementById('res-badge').textContent = 'SECTOR SECURED';
        document.getElementById('res-title').textContent = 'ALL MINES DEFUSED';
        document.getElementById('res-time').textContent = `${timer}s`;
        const best = localStorage.getItem(storageKey);
        document.getElementById('res-best').textContent = `${best}s`;
        document.getElementById('result-modal').classList.remove('hidden');
      }, 500);
    }
  }

  // --- BUTTON EVENT LISTENERS ---
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initGame(btn.dataset.diff);
    });
  });

  document.getElementById('face-reset-btn').addEventListener('click', () => initGame(currentDifficulty));
  document.getElementById('modal-retry-btn').addEventListener('click', () => initGame(currentDifficulty));

  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off').classList.toggle('hidden', sound.enabled);
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('tutorial-modal').classList.remove('hidden');
  });

  document.getElementById('close-tut-btn').addEventListener('click', () => {
    document.getElementById('tutorial-modal').classList.add('hidden');
  });

  // Mobile Flag Toggle Button
  const flagToggle = document.getElementById('flag-toggle-btn');
  flagToggle.addEventListener('click', () => {
    isFlagModeMobile = !isFlagModeMobile;
    flagToggle.classList.toggle('active', isFlagModeMobile);
    document.getElementById('mode-text').textContent = isFlagModeMobile ? 'FLAG ON' : 'FLAG OFF';
  });

  // Start game on load
  initGame('novice');
})();
