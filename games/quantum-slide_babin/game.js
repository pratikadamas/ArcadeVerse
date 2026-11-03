/**
 * Quantum Slide: 15-Matrix Shift
 * Reverse-Move Random Scramble Engine, Multi-Tile Line Shift, Touch Swipe, and Web Audio API Synthesizer
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

    playSlide() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playShuffle() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [220, 330, 440, 550].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.04);
        gain.gain.setValueAtTime(0.15, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.08);
      });
    }

    playWin() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
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

  // --- CONFIG & STATE ---
  const sound = new SoundSynth();
  const STORAGE_KEY_MOVES = 'arcadeverse_quantum_slide_best_moves';

  let board = []; // 16 elements (0 is empty slot)
  let moveCount = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let isArtMode = false;
  let isSolving = false;

  const WIN_STATE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

  // Guaranteed Solvable Board Generator:
  // Starts from solved matrix and applies 160 random valid moves backwards
  function generateSolvableBoard() {
    board = [...WIN_STATE];
    let emptyIdx = 15;
    let prevMove = -1;

    for (let i = 0; i < 160; i++) {
      const neighbors = getValidNeighbors(emptyIdx).filter(n => n !== prevMove);
      const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
      board[emptyIdx] = board[chosen];
      board[chosen] = 0;
      prevMove = emptyIdx;
      emptyIdx = chosen;
    }
  }

  function getValidNeighbors(idx) {
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    const list = [];
    if (r > 0) list.push(idx - 4); // Up
    if (r < 3) list.push(idx + 4); // Down
    if (c > 0) list.push(idx - 1); // Left
    if (c < 3) list.push(idx + 1); // Right
    return list;
  }

  // --- INIT & RESET ---
  function initGame() {
    generateSolvableBoard();
    moveCount = 0;
    isSolving = false;
    clearInterval(timerInterval);
    timerSeconds = 0;

    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      document.getElementById('slide-timer').textContent = `${m}:${s}`;
    }, 1000);

    document.getElementById('moves-counter').textContent = moveCount;
    document.getElementById('victory-modal').classList.add('hidden');
    document.getElementById('help-modal').classList.add('hidden');

    renderTiles();
  }

  // --- TILE RENDERING ---
  function renderTiles() {
    const box = document.getElementById('puzzle-box');
    box.innerHTML = '';
    box.classList.toggle('art-mode', isArtMode);

    const isSmall = window.innerWidth <= 440;
    const tileSize = isSmall ? 68 : 82;
    const gap = isSmall ? 6 : 8;

    for (let i = 0; i < 16; i++) {
      const val = board[i];
      if (val === 0) continue; // Empty slot is not rendered

      const r = Math.floor(i / 4);
      const c = i % 4;

      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.textContent = val;
      tile.dataset.val = val;
      tile.style.transform = `translate(${c * (tileSize + gap)}px, ${r * (tileSize + gap)}px)`;

      // If art mode, calculate background position slice
      if (isArtMode) {
        const origR = Math.floor((val - 1) / 4);
        const origC = (val - 1) % 4;
        tile.style.backgroundPosition = `-${origC * (tileSize + gap)}px -${origR * (tileSize + gap)}px`;
      }

      tile.addEventListener('click', () => {
        sound.init();
        tryMoveTile(i);
      });

      box.appendChild(tile);
    }
  }

  // --- MULTI-TILE LINE SLIDE LOGIC ---
  function tryMoveTile(clickedIdx) {
    const emptyIdx = board.indexOf(0);
    const cr = Math.floor(clickedIdx / 4);
    const cc = clickedIdx % 4;
    const er = Math.floor(emptyIdx / 4);
    const ec = emptyIdx % 4;

    // Same row slide
    if (cr === er) {
      const dir = cc < ec ? 1 : -1;
      let curr = ec;
      while (curr !== cc) {
        const next = curr - dir;
        board[curr] = board[next];
        curr = next;
      }
      board[clickedIdx] = 0;
      moveCount++;
      sound.playSlide();
      onBoardChanged();
    }
    // Same column slide
    else if (cc === ec) {
      const dir = cr < er ? 1 : -1;
      let curr = er;
      while (curr !== cr) {
        const next = curr - dir;
        board[curr * 4 + cc] = board[next * 4 + cc];
        curr = next;
      }
      board[clickedIdx] = 0;
      moveCount++;
      sound.playSlide();
      onBoardChanged();
    }
  }

  function onBoardChanged() {
    document.getElementById('moves-counter').textContent = moveCount;
    renderTiles();
    checkVictory();
  }

  function checkVictory() {
    for (let i = 0; i < 16; i++) {
      if (board[i] !== WIN_STATE[i]) return;
    }

    // Solved!
    clearInterval(timerInterval);
    sound.playWin();

    const bestMoves = parseInt(localStorage.getItem(STORAGE_KEY_MOVES) || '9999', 10);
    if (moveCount < bestMoves) {
      localStorage.setItem(STORAGE_KEY_MOVES, moveCount);
    }

    setTimeout(() => {
      document.getElementById('final-moves').textContent = moveCount;
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      document.getElementById('final-time').textContent = `${m}:${s}`;
      const rec = localStorage.getItem(STORAGE_KEY_MOVES);
      document.getElementById('best-moves').textContent = rec;
      document.getElementById('victory-modal').classList.remove('hidden');
    }, 300);
  }

  // --- ARROW KEYBOARD SUPPORT ---
  window.addEventListener('keydown', (e) => {
    sound.init();
    const emptyIdx = board.indexOf(0);
    const er = Math.floor(emptyIdx / 4);
    const ec = emptyIdx % 4;

    if (e.code === 'ArrowUp' && er < 3) {
      tryMoveTile((er + 1) * 4 + ec);
    } else if (e.code === 'ArrowDown' && er > 0) {
      tryMoveTile((er - 1) * 4 + ec);
    } else if (e.code === 'ArrowLeft' && ec < 3) {
      tryMoveTile(er * 4 + (ec + 1));
    } else if (e.code === 'ArrowRight' && ec > 0) {
      tryMoveTile(er * 4 + (ec - 1));
    }
  });

  // --- TOUCH SWIPE SUPPORT ---
  let touchStartX = 0;
  let touchStartY = 0;
  const puzzleBox = document.getElementById('puzzle-box');

  puzzleBox.addEventListener('touchstart', (e) => {
    sound.init();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  puzzleBox.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const emptyIdx = board.indexOf(0);
    const er = Math.floor(emptyIdx / 4);
    const ec = emptyIdx % 4;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      if (dx > 0 && ec > 0) tryMoveTile(er * 4 + (ec - 1));
      else if (dx < 0 && ec < 3) tryMoveTile(er * 4 + (ec + 1));
    } else if (Math.abs(dy) > 30) {
      if (dy > 0 && er > 0) tryMoveTile((er - 1) * 4 + ec);
      else if (dy < 0 && er < 3) tryMoveTile((er + 1) * 4 + ec);
    }
  }, { passive: true });

  // --- BUTTONS & MODALS ---
  document.getElementById('btn-mode-num').addEventListener('click', () => {
    isArtMode = false;
    document.getElementById('btn-mode-num').classList.add('active');
    document.getElementById('btn-mode-art').classList.remove('active');
    renderTiles();
  });

  document.getElementById('btn-mode-art').addEventListener('click', () => {
    isArtMode = true;
    document.getElementById('btn-mode-art').classList.add('active');
    document.getElementById('btn-mode-num').classList.remove('active');
    renderTiles();
  });

  document.getElementById('shuffle-btn').addEventListener('click', () => {
    sound.playShuffle();
    initGame();
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    sound.playShuffle();
    initGame();
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
  });

  document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
  });

  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off').classList.toggle('hidden', sound.enabled);
  });

  window.addEventListener('resize', renderTiles);

  // Initialize
  initGame();
})();
