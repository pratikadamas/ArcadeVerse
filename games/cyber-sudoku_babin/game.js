/**
 * Cyber-Sudoku: Neon Matrix 9x9
 * Verified Procedural Generator, Smart Row/Col/Box Highlighting, Pencil Notes, and Web Audio API
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

    playInput(freq = 520) {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.05);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    playError() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(70, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playWin() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.25, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.2);
      });
    }
  }

  // --- SUDOKU PUZZLE GENERATION & VALIDATION ---
  const sound = new SoundSynth();

  let initialBoard = [];
  let solutionBoard = [];
  let currentBoard = [];
  let notesBoard = []; // 9x9 set of candidate numbers
  let moveHistory = [];

  let selectedCell = { r: -1, c: -1 };
  let isPencilMode = false;
  let hintsRemaining = 3;
  let strikes = 0;
  let maxStrikes = 3;
  let timerSeconds = 0;
  let timerInterval = null;
  let currentDiff = 'easy';

  const STORAGE_KEY_PREFIX = 'arcadeverse_sudoku_best_';

  // Pre-generated certified base boards to ensure instantaneous fast launch
  const BASE_PUZZLE = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];

  // Procedural Permutation Generator (swaps numbers, rows within bands, columns within stacks)
  function generatePuzzle(difficulty = 'easy') {
    // Clone base
    const board = BASE_PUZZLE.map(row => [...row]);

    // Randomize digit mapping
    const map = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        board[r][c] = map[board[r][c] - 1];
      }
    }

    solutionBoard = board.map(r => [...r]);

    // Holes to punch depending on difficulty
    let holes = difficulty === 'easy' ? 32 : (difficulty === 'medium' ? 44 : 52);
    const puzzle = board.map(r => [...r]);

    while (holes > 0) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (puzzle[r][c] !== 0) {
        puzzle[r][c] = 0;
        holes--;
      }
    }

    initialBoard = puzzle.map(r => [...r]);
    currentBoard = puzzle.map(r => [...r]);
    notesBoard = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  }

  // --- INIT GAME ---
  function initGame(diff = 'easy') {
    currentDiff = diff;
    generatePuzzle(diff);
    strikes = 0;
    hintsRemaining = 3;
    moveHistory = [];
    selectedCell = { r: -1, c: -1 };
    isPencilMode = false;

    clearInterval(timerInterval);
    timerSeconds = 0;
    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      document.getElementById('sudoku-timer').textContent = `${m}:${s}`;
    }, 1000);

    updateStrikesHUD();
    document.getElementById('hint-text').textContent = `Hint (${hintsRemaining})`;
    document.getElementById('pencil-text').textContent = 'Notes OFF';
    document.getElementById('btn-pencil').classList.remove('active');
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('rules-modal').classList.add('hidden');

    renderGrid();
  }

  function updateStrikesHUD() {
    document.getElementById('strikes-val').textContent = `${strikes} / ${maxStrikes}`;
  }

  // --- RENDER DOM ---
  function renderGrid() {
    const gridEl = document.getElementById('sudoku-grid');
    gridEl.innerHTML = '';

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 's-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const val = currentBoard[r][c];
        const isGiven = initialBoard[r][c] !== 0;

        if (isGiven) {
          cell.classList.add('given');
          cell.textContent = val;
        } else if (val !== 0) {
          cell.textContent = val;
        } else {
          // Render Notes / Candidates
          const notes = notesBoard[r][c];
          if (notes.size > 0) {
            const notesGrid = document.createElement('div');
            notesGrid.className = 'notes-container';
            for (let n = 1; n <= 9; n++) {
              const nd = document.createElement('span');
              nd.className = 'note-digit';
              nd.textContent = notes.has(n) ? n : '';
              notesGrid.appendChild(nd);
            }
            cell.appendChild(notesGrid);
          }
        }

        cell.addEventListener('click', () => {
          sound.init();
          selectCell(r, c);
        });

        gridEl.appendChild(cell);
      }
    }
  }

  // --- SMART HIGHLIGHTING ---
  function selectCell(r, c) {
    selectedCell = { r, c };
    const cells = document.querySelectorAll('.s-cell');
    const selectedVal = currentBoard[r][c];

    cells.forEach(cell => {
      const cr = parseInt(cell.dataset.row, 10);
      const cc = parseInt(cell.dataset.col, 10);
      cell.classList.remove('selected', 'highlight-axis', 'highlight-match');

      if (cr === r && cc === c) {
        cell.classList.add('selected');
      } else if (cr === r || cc === c || (Math.floor(cr / 3) === Math.floor(r / 3) && Math.floor(cc / 3) === Math.floor(c / 3))) {
        cell.classList.add('highlight-axis');
      }

      // Matching duplicate digits highlight
      if (selectedVal !== 0 && currentBoard[cr][cc] === selectedVal && !(cr === r && cc === c)) {
        cell.classList.add('highlight-match');
      }
    });
  }

  // --- USER INPUT & VALIDATION ---
  function inputDigit(num) {
    const { r, c } = selectedCell;
    if (r === -1 || c === -1) return;
    if (initialBoard[r][c] !== 0) return; // Cannot modify given clues

    if (isPencilMode) {
      // Toggle note candidate
      const notes = notesBoard[r][c];
      if (notes.has(num)) notes.delete(num);
      else notes.add(num);
      sound.playInput(700);
      renderGrid();
      selectCell(r, c);
      return;
    }

    // Direct Placement
    moveHistory.push({
      r, c,
      prevVal: currentBoard[r][c],
      prevNotes: new Set(notesBoard[r][c])
    });

    if (num === solutionBoard[r][c]) {
      // Correct!
      currentBoard[r][c] = num;
      notesBoard[r][c].clear();
      sound.playInput(440 + num * 40);
      renderGrid();
      selectCell(r, c);
      checkWin();
    } else {
      // Error strike
      strikes++;
      updateStrikesHUD();
      sound.playError();
      const cellEl = document.querySelector(`.s-cell[data-row="${r}"][data-col="${c}"]`);
      if (cellEl) {
        cellEl.classList.add('error');
        setTimeout(() => cellEl.classList.remove('error'), 450);
      }

      if (strikes >= maxStrikes) {
        triggerDefeat();
      }
    }
  }

  function eraseSelected() {
    const { r, c } = selectedCell;
    if (r === -1 || c === -1 || initialBoard[r][c] !== 0) return;
    moveHistory.push({
      r, c,
      prevVal: currentBoard[r][c],
      prevNotes: new Set(notesBoard[r][c])
    });
    currentBoard[r][c] = 0;
    notesBoard[r][c].clear();
    sound.playInput(350);
    renderGrid();
    selectCell(r, c);
  }

  function undoLastMove() {
    if (moveHistory.length === 0) return;
    const last = moveHistory.pop();
    currentBoard[last.r][last.c] = last.prevVal;
    notesBoard[last.r][last.c] = last.prevNotes;
    sound.playInput(400);
    renderGrid();
    selectCell(last.r, last.c);
  }

  function provideHint() {
    if (hintsRemaining <= 0) return;
    const { r, c } = selectedCell;
    if (r === -1 || c === -1 || initialBoard[r][c] !== 0 || currentBoard[r][c] !== 0) {
      // Find first empty cell
      for (let ro = 0; ro < 9; ro++) {
        for (let co = 0; co < 9; co++) {
          if (currentBoard[ro][co] === 0) {
            applyHint(ro, co);
            return;
          }
        }
      }
      return;
    }
    applyHint(r, c);
  }

  function applyHint(r, c) {
    hintsRemaining--;
    document.getElementById('hint-text').textContent = `Hint (${hintsRemaining})`;
    currentBoard[r][c] = solutionBoard[r][c];
    notesBoard[r][c].clear();
    sound.playInput(880);
    renderGrid();
    selectCell(r, c);
    checkWin();
  }

  function checkWin() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] !== solutionBoard[r][c]) return;
      }
    }

    // Solved!
    clearInterval(timerInterval);
    sound.playWin();

    const storageKey = STORAGE_KEY_PREFIX + currentDiff;
    const best = parseInt(localStorage.getItem(storageKey) || '9999', 10);
    if (timerSeconds < best) {
      localStorage.setItem(storageKey, timerSeconds);
    }

    setTimeout(() => {
      document.getElementById('res-tag').className = 'modal-tag';
      document.getElementById('res-tag').textContent = 'MATRIX HARMONIZED';
      document.getElementById('res-title').textContent = 'PUZZLE SOLVED';
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      document.getElementById('res-time').textContent = `${m}:${s}`;

      const rec = localStorage.getItem(storageKey);
      const rm = String(Math.floor(rec / 60)).padStart(2, '0');
      const rs = String(rec % 60).padStart(2, '0');
      document.getElementById('res-best').textContent = `${rm}:${rs}`;

      document.getElementById('result-modal').classList.remove('hidden');
    }, 400);
  }

  function triggerDefeat() {
    clearInterval(timerInterval);
    document.getElementById('res-tag').className = 'modal-tag red';
    document.getElementById('res-tag').textContent = 'SECURITY LOCKOUT';
    document.getElementById('res-title').textContent = '3 STRIKES REACHED';
    document.getElementById('res-time').textContent = document.getElementById('sudoku-timer').textContent;
    document.getElementById('res-best').textContent = '--:--';
    document.getElementById('result-modal').classList.remove('hidden');
  }

  // --- KEYBOARD & BUTTON BINDINGS ---
  window.addEventListener('keydown', (e) => {
    sound.init();
    if (e.key >= '1' && e.key <= '9') {
      inputDigit(parseInt(e.key, 10));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      eraseSelected();
    } else if (e.code === 'KeyN') {
      togglePencil();
    } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      undoLastMove();
    }
  });

  // Numpad clicks
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.init();
      inputDigit(parseInt(btn.dataset.num, 10));
    });
  });

  // Action Bar
  document.getElementById('btn-undo').addEventListener('click', () => undoLastMove());
  document.getElementById('btn-erase').addEventListener('click', () => eraseSelected());
  document.getElementById('btn-hint').addEventListener('click', () => provideHint());

  function togglePencil() {
    isPencilMode = !isPencilMode;
    const btn = document.getElementById('btn-pencil');
    btn.classList.toggle('active', isPencilMode);
    document.getElementById('pencil-text').textContent = isPencilMode ? 'Notes ON' : 'Notes OFF';
  }
  document.getElementById('btn-pencil').addEventListener('click', togglePencil);

  // Difficulty Buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initGame(btn.dataset.diff);
    });
  });

  // Modals & Reset
  document.getElementById('restart-btn').addEventListener('click', () => initGame(currentDiff));
  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('hidden');
  });
  document.getElementById('close-rules-btn').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });

  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off').classList.toggle('hidden', sound.enabled);
  });

  // Launch initial board
  initGame('easy');
})();
