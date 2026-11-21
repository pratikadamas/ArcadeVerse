/**
 * Cyber Light Cycle
 * High-Speed Gladiatorial Grid Duel
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const playerScoreDisplay = document.getElementById('player-score-display');
  const aiScoreDisplay = document.getElementById('ai-score-display');
  const roundDisplay = document.getElementById('round-display');
  const diffSelect = document.getElementById('difficulty-select');
  const startOverlay = document.getElementById('start-overlay');
  const roundResultOverlay = document.getElementById('round-result-overlay');
  const matchGameoverOverlay = document.getElementById('match-gameover-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const nextRoundBtn = document.getElementById('next-round-btn');
  const rematchBtn = document.getElementById('rematch-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');

  // D-Pad buttons
  const dpadUp = document.getElementById('dpad-up');
  const dpadDown = document.getElementById('dpad-down');
  const dpadLeft = document.getElementById('dpad-left');
  const dpadRight = document.getElementById('dpad-right');

  // Safe localStorage helpers
  function getStorage(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  }

  function setStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch {
      // In-memory fallback
    }
  }

  // Audio Synthesizer via Web Audio API
  let audioCtx = null;
  let soundEnabled = getStorage('cyber-cycle-sound', 'true') !== 'false';
  let roundTimeoutId = null;
  let animRafId = null;

  function clearRoundTimeout() {
    if (roundTimeoutId) {
      clearTimeout(roundTimeoutId);
      roundTimeoutId = null;
    }
  }

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function updateSoundUI() {
    if (soundEnabled) {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      soundBtn.setAttribute('aria-label', 'Mute Sound');
    } else {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
      soundBtn.setAttribute('aria-label', 'Unmute Sound');
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      if (type === 'turn') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'crash') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === 'win_round') {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.14, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.18);
        });
      }
    } catch (_) {}
  }

  // Grid Constants
  const GRID_SIZE = 80;
  const CELL_SIZE = canvas.width / GRID_SIZE;
  const WIN_SCORE = 3;

  let gameState = 'ready'; // ready, playing, round_over, match_over
  let playerScore = 0;
  let aiScore = 0;
  let currentRound = 1;

  // Grid State (0 = empty, 1 = player trail, 2 = AI trail)
  let grid = [];

  // Cycles
  let player = {
    x: 20,
    y: 40,
    dir: 'right',
    nextDir: 'right',
    color: '#00f0ff',
    trailColor: 'rgba(0, 240, 255, 0.75)'
  };

  let ai = {
    x: 60,
    y: 40,
    dir: 'left',
    nextDir: 'left',
    color: '#ff0077',
    trailColor: 'rgba(255, 0, 119, 0.75)'
  };

  let explosionSparks = [];
  let gameInterval = null;

  function initGrid() {
    grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      grid.push(new Uint8Array(GRID_SIZE));
    }
  }

  function resetRound() {
    clearRoundTimeout();
    initGrid();
    explosionSparks = [];

    player.x = 18;
    player.y = Math.floor(GRID_SIZE / 2);
    player.dir = 'right';
    player.nextDir = 'right';

    ai.x = GRID_SIZE - 18;
    ai.y = Math.floor(GRID_SIZE / 2);
    ai.dir = 'left';
    ai.nextDir = 'left';

    grid[player.y][player.x] = 1;
    grid[ai.y][ai.x] = 2;

    updateHUD();
    render();

    gameState = 'playing';
    startOverlay.classList.add('hidden');
    roundResultOverlay.classList.add('hidden');
    matchGameoverOverlay.classList.add('hidden');

    if (gameInterval) clearInterval(gameInterval);
    const speedMs = diffSelect.value === 'hard' ? 45 : diffSelect.value === 'normal' ? 55 : 68;
    gameInterval = setInterval(gameStep, speedMs);
  }

  function resetMatch() {
    clearRoundTimeout();
    playerScore = 0;
    aiScore = 0;
    currentRound = 1;
    resetRound();
  }

  function isCellBlocked(x, y) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return true;
    return grid[y][x] !== 0;
  }

  // AI Decision Logic
  function chooseAIDirection() {
    const diff = diffSelect.value;
    const dirs = ['up', 'down', 'left', 'right'];
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };

    // Valid turns (exclude opposite)
    const validDirs = dirs.filter(d => d !== opposite[ai.dir]);

    // Score each direction by open clearance distance
    const candidates = [];

    for (let d of validDirs) {
      let dx = 0, dy = 0;
      if (d === 'up') dy = -1;
      else if (d === 'down') dy = 1;
      else if (d === 'left') dx = -1;
      else if (d === 'right') dx = 1;

      let steps = 0;
      const maxCheck = diff === 'hard' ? 14 : diff === 'normal' ? 8 : 4;

      for (let s = 1; s <= maxCheck; s++) {
        const testX = ai.x + dx * s;
        const testY = ai.y + dy * s;
        if (isCellBlocked(testX, testY)) break;
        steps++;
      }

      if (steps > 0) {
        // Preference for continuing straight unless blocked
        const straightBonus = d === ai.dir ? 2 : 0;
        candidates.push({ dir: d, score: steps + straightBonus });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      ai.nextDir = candidates[0].dir;
    }
  }

  function spawnSparks(gridX, gridY, color) {
    const cx = (gridX + 0.5) * CELL_SIZE;
    const cy = (gridY + 0.5) * CELL_SIZE;

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      explosionSparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  function handleRoundEnd(winner, reason) {
    gameState = 'round_over';
    clearInterval(gameInterval);
    playSound('crash');

    if (winner === 'player') {
      playerScore++;
      playSound('win_round');
      document.getElementById('round-result-title').textContent = 'Round Won!';
      document.getElementById('round-result-title').style.color = 'var(--cyan)';
      document.getElementById('round-result-desc').textContent = reason;
    } else if (winner === 'ai') {
      aiScore++;
      document.getElementById('round-result-title').textContent = 'Round Lost';
      document.getElementById('round-result-title').style.color = 'var(--neon-magenta)';
      document.getElementById('round-result-desc').textContent = reason;
    } else {
      document.getElementById('round-result-title').textContent = 'Simultaneous Crash';
      document.getElementById('round-result-title').style.color = '#ffaa00';
      document.getElementById('round-result-desc').textContent = 'Both cycles impacted ribbons at the same moment!';
    }

    document.getElementById('match-standings').textContent = `Player ${playerScore} - ${aiScore} AI`;
    updateHUD();

    // Check if match won
    if (playerScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
      roundTimeoutId = setTimeout(() => {
        roundTimeoutId = null;
        gameState = 'match_over';
        const playerWon = playerScore >= WIN_SCORE;
        document.getElementById('match-gameover-title').textContent = playerWon ? 'Grid Championship Victory!' : 'Match Defeat';
        document.getElementById('match-gameover-title').style.color = playerWon ? 'var(--cyan)' : 'var(--neon-magenta)';
        document.getElementById('match-gameover-desc').textContent = playerWon 
          ? `Outstanding tactical dominance! You vanquished the ${diffSelect.options[diffSelect.selectedIndex].text} AI.`
          : 'The cyber drone outmaneuvered your ribbon defenses.';
        document.getElementById('final-match-score').textContent = `${playerScore} - ${aiScore}`;
        matchGameoverOverlay.classList.remove('hidden');

        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'ARCADEVERSE_GAME_OVER',
            score: playerScore,
            playerScore: playerScore,
            aiScore: aiScore,
            winner: playerWon ? 'player' : 'ai'
          }, '*');
        }
      }, 700);
    } else {
      roundTimeoutId = setTimeout(() => {
        roundTimeoutId = null;
        currentRound++;
        roundResultOverlay.classList.remove('hidden');
      }, 700);
    }
  }

  function gameStep() {
    if (gameState !== 'playing') return;

    // Apply player queued direction
    player.dir = player.nextDir;

    // AI selects direction
    chooseAIDirection();
    ai.dir = ai.nextDir;

    // Calculate player new coordinate
    let pNextX = player.x;
    let pNextY = player.y;
    if (player.dir === 'up') pNextY--;
    else if (player.dir === 'down') pNextY++;
    else if (player.dir === 'left') pNextX--;
    else if (player.dir === 'right') pNextX++;

    // Calculate AI new coordinate
    let aiNextX = ai.x;
    let aiNextY = ai.y;
    if (ai.dir === 'up') aiNextY--;
    else if (ai.dir === 'down') aiNextY++;
    else if (ai.dir === 'left') aiNextX--;
    else if (ai.dir === 'right') aiNextX++;

    const playerCrashed = isCellBlocked(pNextX, pNextY);
    const aiCrashed = isCellBlocked(aiNextX, aiNextY);

    if (playerCrashed && aiCrashed) {
      spawnSparks(player.x, player.y, player.color);
      spawnSparks(ai.x, ai.y, ai.color);
      handleRoundEnd('draw', 'Both cycles crashed simultaneously!');
      return;
    } else if (playerCrashed) {
      spawnSparks(player.x, player.y, player.color);
      handleRoundEnd('ai', 'Player cycle impacted a light trail!');
      return;
    } else if (aiCrashed) {
      spawnSparks(ai.x, ai.y, ai.color);
      handleRoundEnd('player', 'AI cycle impacted a light trail!');
      return;
    }

    // Move cycles forward
    player.x = pNextX;
    player.y = pNextY;
    grid[player.y][player.x] = 1;

    ai.x = aiNextX;
    ai.y = aiNextY;
    grid[ai.y][ai.x] = 2;

    render();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle arena grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_SIZE; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Render Trails
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = grid[r][c];
        if (val === 1) {
          ctx.fillStyle = player.trailColor;
          ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else if (val === 2) {
          ctx.fillStyle = ai.trailColor;
          ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Render Player Cycle Head
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(player.x * CELL_SIZE - 1, player.y * CELL_SIZE - 1, CELL_SIZE + 2, CELL_SIZE + 2);
    ctx.restore();

    // Render AI Cycle Head
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = ai.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(ai.x * CELL_SIZE - 1, ai.y * CELL_SIZE - 1, CELL_SIZE + 2, CELL_SIZE + 2);
    ctx.restore();

    // Render Sparks
    for (let i = explosionSparks.length - 1; i >= 0; i--) {
      const s = explosionSparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= s.decay;

      if (s.alpha <= 0) {
        explosionSparks.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateHUD() {
    playerScoreDisplay.textContent = playerScore;
    aiScoreDisplay.textContent = aiScore;
    roundDisplay.textContent = `${currentRound} / 5`;
  }

  function setPlayerDirection(newDir) {
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (newDir !== opposite[player.dir]) {
      player.nextDir = newDir;
      playSound('turn');
    }
  }

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      setPlayerDirection('up');
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      setPlayerDirection('down');
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      setPlayerDirection('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      setPlayerDirection('right');
    }
  });

  // Mobile D-Pad Touch
  dpadUp.addEventListener('click', () => setPlayerDirection('up'));
  dpadDown.addEventListener('click', () => setPlayerDirection('down'));
  dpadLeft.addEventListener('click', () => setPlayerDirection('left'));
  dpadRight.addEventListener('click', () => setPlayerDirection('right'));

  // Swipe on canvas
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (e.changedTouches.length > 0) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 25) setPlayerDirection('right');
        else if (dx < -25) setPlayerDirection('left');
      } else {
        if (dy > 25) setPlayerDirection('down');
        else if (dy < -25) setPlayerDirection('up');
      }
    }
  }, { passive: true });

  startBtn.addEventListener('click', () => {
    initAudio();
    resetMatch();
  });

  nextRoundBtn.addEventListener('click', () => {
    resetRound();
  });

  rematchBtn.addEventListener('click', () => {
    resetMatch();
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    setStorage('cyber-cycle-sound', soundEnabled.toString());
    updateSoundUI();
    if (soundEnabled) playSound('turn');
  });

  // Teardown / cleanup on unmount
  window.addEventListener('pagehide', () => {
    clearRoundTimeout();
    if (gameInterval) clearInterval(gameInterval);
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Initialize
  updateSoundUI();
  updateHUD();
  initGrid();
  render();
})();
