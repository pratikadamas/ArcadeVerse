/**
 * Cryptic Code Breaker: Mastermind Terminal
 * Procedural Randomized Cipher, Feedback Logic Pegs, Accessible Shape Badges, and Web Audio API
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

    playClick(id = 1) {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      const f = 350 + id * 60;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.3, now + 0.05);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    playSubmit() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [400, 600].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        gain.gain.setValueAtTime(0.2, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.08);
      });
    }

    playWin() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.22, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.18);
      });
    }

    playDefeat() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  // --- GLYPH SPECIFICATIONS ---
  const GLYPHS = {
    1: { id: 1, color: 'cyan', shape: 'square' },
    2: { id: 2, color: 'pink', shape: 'diamond' },
    3: { id: 3, color: 'yellow', shape: 'triangle' },
    4: { id: 4, color: 'purple', shape: 'circle' },
    5: { id: 5, color: 'green', shape: 'hex' },
    6: { id: 6, color: 'orange', shape: 'star' }
  };

  const sound = new SoundSynth();
  const STORAGE_KEY_STREAK = 'arcadeverse_code_breaker_streak';

  let currentMode = 'standard'; // 'standard' (4 glyphs, 10 turns) or 'hardcore' (5 glyphs, 8 turns)
  let codeLength = 4;
  let maxTurns = 10;

  let secretCode = [];
  let currentGuess = [];
  let currentTurn = 1;
  let winStreak = parseInt(localStorage.getItem(STORAGE_KEY_STREAK) || '0', 10);
  let isGameOver = false;

  // --- INIT GAME ---
  function initGame(mode = 'standard') {
    currentMode = mode;
    codeLength = mode === 'standard' ? 4 : 5;
    maxTurns = mode === 'standard' ? 10 : 8;

    currentTurn = 1;
    currentGuess = [];
    isGameOver = false;

    // Generate Secret Sequence
    secretCode = [];
    for (let i = 0; i < codeLength; i++) {
      const pick = Math.floor(Math.random() * 6) + 1;
      secretCode.push(pick);
    }

    document.getElementById('turn-counter').textContent = `${currentTurn} / ${maxTurns}`;
    document.getElementById('streak-val').textContent = winStreak;
    document.getElementById('ai-status-text').textContent = 'NEO-NET REPOSITORY LOCKED // DECODE CIPHER TO PROCEED';
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('rules-modal').classList.add('hidden');

    renderSlots();
    renderHistory();
  }

  function renderSlots() {
    const container = document.getElementById('active-slots');
    container.innerHTML = '';

    for (let i = 0; i < codeLength; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';

      const val = currentGuess[i];
      if (val) {
        slot.appendChild(createGlyphElement(val));
      }

      slot.addEventListener('click', () => {
        sound.init();
        if (currentGuess[i]) {
          currentGuess.splice(i, 1);
          renderSlots();
        }
      });

      container.appendChild(slot);
    }
  }

  function createGlyphElement(id) {
    const g = GLYPHS[id];
    const el = document.createElement('div');
    el.className = 'palette-glyph';
    el.setAttribute('data-color', g.color);
    el.style.width = '36px';
    el.style.height = '36px';
    el.style.cursor = 'default';

    const s = document.createElement('span');
    s.className = `glyph-shape ${g.shape}`;
    const n = document.createElement('span');
    n.className = 'glyph-num';
    n.textContent = g.id;

    el.appendChild(s);
    el.appendChild(n);
    return el;
  }

  function renderHistory() {
    const board = document.getElementById('history-board');
    board.innerHTML = '';
  }

  // --- SUBMIT GUESS & FEEDBACK LOGIC ---
  function submitGuess() {
    if (isGameOver) return;
    if (currentGuess.length < codeLength) {
      sound.playClick(1);
      return;
    }

    sound.playSubmit();

    // Calculate Mastermind feedback:
    // Bulls (Green): correct symbol & position
    // Cows (Yellow): correct symbol, wrong position
    let bulls = 0;
    let cows = 0;

    const secretCopy = [...secretCode];
    const guessCopy = [...currentGuess];

    // First pass for exact matches
    for (let i = 0; i < codeLength; i++) {
      if (guessCopy[i] === secretCopy[i]) {
        bulls++;
        secretCopy[i] = null;
        guessCopy[i] = null;
      }
    }

    // Second pass for color matches in wrong spot
    for (let i = 0; i < codeLength; i++) {
      if (guessCopy[i] !== null) {
        const foundIdx = secretCopy.indexOf(guessCopy[i]);
        if (foundIdx !== -1) {
          cows++;
          secretCopy[foundIdx] = null;
        }
      }
    }

    addHistoryRow(currentTurn, currentGuess, bulls, cows);

    // Win condition check
    if (bulls === codeLength) {
      triggerVictory();
      return;
    }

    // Defeat check
    if (currentTurn >= maxTurns) {
      triggerDefeat();
      return;
    }

    currentTurn++;
    currentGuess = [];
    document.getElementById('turn-counter').textContent = `${currentTurn} / ${maxTurns}`;
    renderSlots();
  }

  function addHistoryRow(turn, guess, bulls, cows) {
    const board = document.getElementById('history-board');
    const row = document.createElement('div');
    row.className = 'history-row';

    const idx = document.createElement('div');
    idx.className = 'row-index';
    idx.textContent = `#${turn}`;

    const pegs = document.createElement('div');
    pegs.className = 'row-pegs';
    guess.forEach(val => pegs.appendChild(createGlyphElement(val)));

    const fb = document.createElement('div');
    fb.className = 'row-feedback';

    for (let i = 0; i < bulls; i++) {
      const p = document.createElement('span');
      p.className = 'f-peg green';
      fb.appendChild(p);
    }
    for (let i = 0; i < cows; i++) {
      const p = document.createElement('span');
      p.className = 'f-peg yellow';
      fb.appendChild(p);
    }
    const remainingNulls = codeLength - bulls - cows;
    for (let i = 0; i < remainingNulls; i++) {
      const p = document.createElement('span');
      p.className = 'f-peg null';
      fb.appendChild(p);
    }

    row.appendChild(idx);
    row.appendChild(pegs);
    row.appendChild(fb);

    board.appendChild(row);
    board.scrollTop = board.scrollHeight;
  }

  function triggerVictory() {
    isGameOver = true;
    winStreak++;
    localStorage.setItem(STORAGE_KEY_STREAK, winStreak);
    document.getElementById('streak-val').textContent = winStreak;
    sound.playWin();

    renderRevealedCode();
    document.getElementById('res-badge').className = 'badge-tag';
    document.getElementById('res-badge').textContent = 'SECURITY CORE OVERRIDDEN';
    document.getElementById('res-title').textContent = 'ACCESS GRANTED';
    document.getElementById('res-desc').textContent = `Decoded secret cipher in ${currentTurn} attempt${currentTurn > 1 ? 's' : ''}! Current win streak: ${winStreak}.`;
    document.getElementById('result-modal').classList.remove('hidden');
  }

  function triggerDefeat() {
    isGameOver = true;
    winStreak = 0;
    localStorage.setItem(STORAGE_KEY_STREAK, 0);
    document.getElementById('streak-val').textContent = 0;
    sound.playDefeat();

    renderRevealedCode();
    document.getElementById('res-badge').className = 'badge-tag red';
    document.getElementById('res-badge').textContent = 'CORE LOCKDOWN';
    document.getElementById('res-title').textContent = 'SYSTEM PURGED';
    document.getElementById('res-desc').textContent = `Exhausted ${maxTurns} decryption attempts. The rogue AI locked down the system core.`;
    document.getElementById('result-modal').classList.remove('hidden');
  }

  function renderRevealedCode() {
    const container = document.getElementById('revealed-code');
    container.innerHTML = '';
    secretCode.forEach(val => container.appendChild(createGlyphElement(val)));
  }

  // --- BUTTON CLICKS ---
  document.querySelectorAll('.palette-glyph').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.init();
      if (isGameOver) return;
      if (currentGuess.length < codeLength) {
        const id = parseInt(btn.dataset.id, 10);
        currentGuess.push(id);
        sound.playClick(id);
        renderSlots();
      }
    });
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    sound.init();
    currentGuess = [];
    renderSlots();
  });

  document.getElementById('btn-submit').addEventListener('click', () => submitGuess());

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initGame(btn.dataset.mode);
    });
  });

  document.getElementById('retry-btn').addEventListener('click', () => initGame(currentMode));

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

  // Launch initial game
  initGame('standard');
})();
