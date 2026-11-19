/**
 * Quantum Sokoban
 * Cybernetic Mainframe Puzzle Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const levelDisplay = document.getElementById('level-display');
  const movesDisplay = document.getElementById('moves-display');
  const pushesDisplay = document.getElementById('pushes-display');
  const coresDisplay = document.getElementById('cores-display');
  const levelClearOverlay = document.getElementById('level-clear-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const finalMoves = document.getElementById('final-moves');
  const finalPushes = document.getElementById('final-pushes');
  const undoBtn = document.getElementById('undo-btn');
  const resetBtn = document.getElementById('reset-btn');
  const nextLevelBtn = document.getElementById('next-level-btn');
  const replayLevelBtn = document.getElementById('replay-level-btn');
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

  // Audio Synthesizer via Web Audio API
  let audioCtx = null;
  let soundEnabled = localStorage.getItem('quantum-sokoban-sound') !== 'false';

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

      if (type === 'step') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'push') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'target') {
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          gain.gain.setValueAtTime(0.12, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.18);
        });
      } else if (type === 'clear') {
        const notes = [440, 554, 659, 880, 1108];
        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.18, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.25);
        });
      }
    } catch (_) {}
  }

  // Handcrafted Mainframe Chambers (5 levels)
  // Symbols:
  // '#' = Wall
  // ' ' = Empty Floor
  // '.' = Target Pad
  // '$' = Core
  // '*' = Core on Target Pad
  // '@' = Player Drone
  // '+' = Player on Target Pad
  const LEVELS = [
    // Level 1: Intro (2 cores)
    [
      "  ##### ",
      "###   # ",
      "# $ # ##",
      "# #  . #",
      "# @ $  #",
      "#  # . #",
      "########"
    ],
    // Level 2: Narrow Corridor (3 cores)
    [
      "########",
      "#      #",
      "# .$$@ #",
      "#  #$  #",
      "#  ..  #",
      "#      #",
      "########"
    ],
    // Level 3: Crossway (3 cores)
    [
      "  ##### ",
      "###   # ",
      "#   $ # ",
      "### #$##",
      "# . #  #",
      "# . $  #",
      "# . @###",
      "######  "
    ],
    // Level 4: Quantum Chamber (4 cores)
    [
      "######  ",
      "#   .#  ",
      "# #$ #  ",
      "# .  ###",
      "# $ $  #",
      "### .# #",
      "  # .  #",
      "  #  @ #",
      "  ######"
    ],
    // Level 5: Master Nexus (4 cores)
    [
      "  #######",
      "  #     #",
      "###$# # #",
      "#  $  # #",
      "# .#$ # #",
      "# .   $ #",
      "# .#  # #",
      "# .  @  #",
      "#########"
    ]
  ];

  let currentLevelIndex = 0;
  let grid = [];
  let playerX = 0;
  let playerY = 0;
  let moves = 0;
  let pushes = 0;
  let historyStack = [];
  let isLevelCompleted = false;

  function loadLevel(index) {
    currentLevelIndex = index;
    const raw = LEVELS[index];
    const height = raw.length;
    let width = 0;
    for (let row of raw) {
      if (row.length > width) width = row.length;
    }

    grid = [];
    moves = 0;
    pushes = 0;
    historyStack = [];
    isLevelCompleted = false;
    levelClearOverlay.classList.add('hidden');

    for (let r = 0; r < height; r++) {
      const row = [];
      for (let c = 0; c < width; c++) {
        const char = raw[r][c] || ' ';
        if (char === '@') {
          playerX = c;
          playerY = r;
          row.push(' ');
        } else if (char === '+') {
          playerX = c;
          playerY = r;
          row.push('.');
        } else {
          row.push(char);
        }
      }
      grid.push(row);
    }

    updateHUD();
    render();
  }

  function countCores() {
    let onTarget = 0;
    let total = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        if (cell === '$') total++;
        else if (cell === '*') {
          total++;
          onTarget++;
        }
      }
    }
    return { onTarget, total };
  }

  function isWalkable(c, r) {
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[r].length) return false;
    const cell = grid[r][c];
    return cell === ' ' || cell === '.';
  }

  function isCore(c, r) {
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[r].length) return false;
    const cell = grid[r][c];
    return cell === '$' || cell === '*';
  }

  const MAX_HISTORY_MOVES = 50;

  function recordHistory() {
    // Deep state serialization of grid matrix and entangled crate states
    const serializedGrid = JSON.stringify(grid);
    historyStack.push({
      gridJson: serializedGrid,
      playerX,
      playerY,
      moves,
      pushes,
      timestamp: Date.now()
    });
    // Keep stack capacity strictly bounded to avoid memory desync
    if (historyStack.length > MAX_HISTORY_MOVES) {
      historyStack.shift();
    }
  }

  function undo() {
    if (historyStack.length === 0 || isLevelCompleted) return;
    const prev = historyStack.pop();
    // Atomic state deserialization restores all entangled crate references synchronously
    grid = JSON.parse(prev.gridJson);
    playerX = prev.playerX;
    playerY = prev.playerY;
    moves = prev.moves;
    pushes = prev.pushes;
    playSound('step');
    updateHUD();
    render();
  }

  function movePlayer(dx, dy) {
    if (isLevelCompleted) return;

    const nextX = playerX + dx;
    const nextY = playerY + dy;

    if (nextY < 0 || nextY >= grid.length || nextX < 0 || nextX >= grid[nextY].length) return;

    const targetCell = grid[nextY][nextX];
    if (targetCell === '#') return; // Hit wall

    // If pushing a core
    if (isCore(nextX, nextY)) {
      const boxNextX = nextX + dx;
      const boxNextY = nextY + dy;

      if (!isWalkable(boxNextX, boxNextY)) return; // Core blocked

      recordHistory();

      // Move core
      const targetIsPad = grid[boxNextY][boxNextX] === '.';
      grid[boxNextY][boxNextX] = targetIsPad ? '*' : '$';

      // Vacate previous core position
      grid[nextY][nextX] = targetCell === '*' ? '.' : ' ';

      // Move player
      playerX = nextX;
      playerY = nextY;
      moves++;
      pushes++;

      if (targetIsPad) playSound('target');
      else playSound('push');

      updateHUD();
      render();
      checkWin();
      return;
    }

    // Regular movement
    if (isWalkable(nextX, nextY)) {
      recordHistory();
      playerX = nextX;
      playerY = nextY;
      moves++;
      playSound('step');
      updateHUD();
      render();
    }
  }

  function checkWin() {
    const { onTarget, total } = countCores();
    if (total > 0 && onTarget === total) {
      isLevelCompleted = true;
      playSound('clear');
      finalMoves.textContent = moves;
      finalPushes.textContent = pushes;
      setTimeout(() => {
        levelClearOverlay.classList.remove('hidden');
      }, 350);
    }
  }

  function updateHUD() {
    levelDisplay.textContent = `${currentLevelIndex + 1} / ${LEVELS.length}`;
    movesDisplay.textContent = moves;
    pushesDisplay.textContent = pushes;
    const { onTarget, total } = countCores();
    coresDisplay.textContent = `${onTarget} / ${total}`;
    if (onTarget === total && total > 0) {
      coresDisplay.style.color = '#00ffaa';
    } else {
      coresDisplay.style.color = 'var(--cyan)';
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rows = grid.length;
    const cols = grid[0].length;
    const tileSize = Math.min(canvas.width / cols, canvas.height / rows);
    const offsetX = (canvas.width - cols * tileSize) / 2;
    const offsetY = (canvas.height - rows * tileSize) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * tileSize;
        const y = offsetY + r * tileSize;
        const cell = grid[r][c];

        // Draw floor tile
        ctx.fillStyle = '#060c18';
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Grid floor border
        ctx.strokeStyle = 'rgba(0, 255, 170, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);

        if (cell === '#') {
          // Futuristic Cyber Wall
          ctx.fillStyle = '#0f223d';
          ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
          ctx.strokeStyle = 'rgba(0, 255, 170, 0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, tileSize - 6, tileSize - 6);

          // Center wall rivet
          ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === '.' || cell === '*') {
          // Target Pad (Neon containment circle)
          ctx.strokeStyle = 'rgba(0, 255, 170, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize * 0.28, 0, Math.PI * 2);
          ctx.stroke();

          // Pad inner pulse
          ctx.fillStyle = 'rgba(0, 255, 170, 0.18)';
          ctx.fill();
        }

        // Draw Cores
        if (cell === '$') {
          // Unpowered Core (Cyan)
          const pad = tileSize * 0.18;
          ctx.fillStyle = '#00a8ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 8;
          ctx.fillRect(x + pad, y + pad, tileSize - pad * 2, tileSize - pad * 2);

          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + pad, y + pad, tileSize - pad * 2, tileSize - pad * 2);
          ctx.shadowBlur = 0;
        } else if (cell === '*') {
          // Energized Core on Target Pad (Bright Neon Green)
          const pad = tileSize * 0.16;
          ctx.fillStyle = '#00ffaa';
          ctx.shadowColor = '#00ffaa';
          ctx.shadowBlur = 14;
          ctx.fillRect(x + pad, y + pad, tileSize - pad * 2, tileSize - pad * 2);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + pad, y + pad, tileSize - pad * 2, tileSize - pad * 2);
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw Player Drone
    const px = offsetX + playerX * tileSize + tileSize / 2;
    const py = offsetY + playerY * tileSize + tileSize / 2;
    const pr = tileSize * 0.32;

    ctx.save();
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    // Drone visor
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py - pr * 0.15, pr * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Event Listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      movePlayer(0, -1);
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      movePlayer(0, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      movePlayer(-1, 0);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      movePlayer(1, 0);
    } else if (e.key === 'z' || e.key === 'Z') {
      undo();
    } else if (e.key === 'r' || e.key === 'R') {
      loadLevel(currentLevelIndex);
    }
  });

  // Mobile D-Pad Touch Actions
  dpadUp.addEventListener('click', () => movePlayer(0, -1));
  dpadDown.addEventListener('click', () => movePlayer(0, 1));
  dpadLeft.addEventListener('click', () => movePlayer(-1, 0));
  dpadRight.addEventListener('click', () => movePlayer(1, 0));

  undoBtn.addEventListener('click', undo);
  resetBtn.addEventListener('click', () => loadLevel(currentLevelIndex));
  replayLevelBtn.addEventListener('click', () => loadLevel(currentLevelIndex));

  nextLevelBtn.addEventListener('click', () => {
    const nextIdx = (currentLevelIndex + 1) % LEVELS.length;
    loadLevel(nextIdx);
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('quantum-sokoban-sound', soundEnabled.toString());
    updateSoundUI();
    if (soundEnabled) playSound('step');
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Initialize
  updateSoundUI();
  loadLevel(0);
})();
