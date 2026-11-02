/**
 * Hex Match: Prismatic Tile Connect
 * Author: Babin Bid (@Babin123456)
 * ArcadeVerse HTML5 Canvas Game
 */
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreVal = document.getElementById('scoreVal');
  const levelVal = document.getElementById('levelVal');
  const overlayScreen = document.getElementById('overlayScreen');
  const overlayHeading = document.getElementById('overlayHeading');
  const overlayDesc = document.getElementById('overlayDesc');
  const btnActionStart = document.getElementById('btnActionStart');

  const tLeft = document.getElementById('tLeft');
  const tRight = document.getElementById('tRight');
  const tAction = document.getElementById('tAction');

  let animationId = null;
  let isPlaying = false;
  let score = 0;
  let movesLeft = 25;

  // Web Audio Synth
  let audioCtx = null;
  function playBeep(freq, type, duration) {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // Hex Colors
  const COLORS = ['#00f5ff', '#ff007f', '#00ff66', '#f59e0b', '#a855f7'];

  // Grid Config (7 cols x 7 rows)
  const COLS = 7;
  const ROWS = 7;
  const HEX_R = 26;
  const ORIGIN_X = 230;
  const ORIGIN_Y = 120;

  let grid = [];
  let selected = null;
  let particles = [];

  function hexCenter(c, r) {
    const x = ORIGIN_X + c * (HEX_R * 1.732) + (r % 2 === 1 ? (HEX_R * 1.732) / 2 : 0);
    const y = ORIGIN_Y + r * (HEX_R * 1.5);
    return { x, y };
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = Math.floor(Math.random() * COLORS.length);
      }
    }
  }

  function initInputs() {
    canvas.addEventListener('click', (e) => {
      if (!isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      // Find nearest hex cell
      let clickedCell = null;
      let minDist = HEX_R;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const pt = hexCenter(c, r);
          const d = Math.hypot(mx - pt.x, my - pt.y);
          if (d < minDist) {
            minDist = d;
            clickedCell = { c, r };
          }
        }
      }

      if (clickedCell) {
        handleCellClick(clickedCell);
      }
    });

    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); rotateSelected(-1); });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); rotateSelected(1); });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); triggerRandomSwap(); });

    btnActionStart.addEventListener('click', startGame);
  }

  function handleCellClick(cell) {
    if (!selected) {
      selected = cell;
      playBeep(440, 'triangle', 0.1);
    } else {
      // Check adjacency
      const d = Math.hypot(cell.c - selected.c, cell.r - selected.r);
      if (d <= 1.5 && (cell.c !== selected.c || cell.r !== selected.r)) {
        // Swap
        const temp = grid[cell.r][cell.c];
        grid[cell.r][cell.c] = grid[selected.r][selected.c];
        grid[selected.r][selected.c] = temp;
        movesLeft--;
        playBeep(620, 'sine', 0.12);

        checkMatches();
        selected = null;
        updateHUD();

        if (movesLeft <= 0) gameOver();
      } else {
        selected = cell;
      }
    }
  }

  function rotateSelected(dir) {
    if (!selected) return;
    grid[selected.r][selected.c] = (grid[selected.r][selected.c] + dir + COLORS.length) % COLORS.length;
    playBeep(520, 'sine', 0.08);
  }

  function triggerRandomSwap() {
    if (movesLeft <= 0) return;
    movesLeft--;
    checkMatches();
    updateHUD();
  }

  function checkMatches() {
    let matched = new Set();

    // Check horizontal runs
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 2; c++) {
        const val = grid[r][c];
        if (val !== -1 && val === grid[r][c + 1] && val === grid[r][c + 2]) {
          matched.add(`${c},${r}`);
          matched.add(`${c + 1},${r}`);
          matched.add(`${c + 2},${r}`);
        }
      }
    }

    if (matched.size > 0) {
      score += matched.size * 100;
      playBeep(880, 'triangle', 0.2);

      matched.forEach(key => {
        const [c, r] = key.split(',').map(Number);
        const pt = hexCenter(c, r);

        for (let p = 0; p < 8; p++) {
          particles.push({
            x: pt.x,
            y: pt.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: COLORS[grid[r][c]],
            alpha: 1
          });
        }
        grid[r][c] = Math.floor(Math.random() * COLORS.length);
      });
    }
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    movesLeft = 25;
    selected = null;
    particles = [];
    initGrid();
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    overlayHeading.textContent = 'MOVES EXHAUSTED';
    overlayDesc.textContent = 'Hex matrix cleared! Final Prismatic Score: ' + score;
    btnActionStart.textContent = 'PLAY AGAIN';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = movesLeft + ' Moves';
  }

  function update() {
    if (!isPlaying) return;

    for (let p = particles.length - 1; p >= 0; p--) {
      const pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.035;
      if (pt.alpha <= 0) particles.splice(p, 1);
    }
  }

  function drawHexagon(x, y, r, fillColor, isSel) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = x + r * Math.cos(angle);
      const py = y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = isSel ? 16 : 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = isSel ? '#ffffff' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = isSel ? 3 : 1;
    ctx.stroke();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Draw Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const pt = hexCenter(c, r);
        const isSel = selected && selected.c === c && selected.r === r;
        drawHexagon(pt.x, pt.y, HEX_R, COLORS[grid[r][c]], isSel);
      }
    }

    // Particles
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  function gameLoop() {
    if (!isPlaying) return;
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  // Lifecycle Bridge
  if (window.ArcadeVerse) {
    ArcadeVerse.onPause(() => { isPlaying = false; });
    ArcadeVerse.onResume(() => { if (overlayScreen.classList.contains('hidden')) { isPlaying = true; gameLoop(); } });
    ArcadeVerse.onTeardown(() => {
      isPlaying = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) audioCtx.close().catch(() => {});
    });
  }

  initInputs();
})();
