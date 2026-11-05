/**
 * Coolant Flow — Fusion Reactor Conduit Grid
 * Author: Babin123456
 * Pure Vanilla JS, Canvas Fluid Propagation & Web Audio Synthesizer
 */

(function () {
  'use strict';

  // --- Tile Types & Directions ---
  // Directions: 0: TOP, 1: RIGHT, 2: BOTTOM, 3: LEFT
  const DIRS = [
    { dx: 0, dy: -1 }, // 0: UP
    { dx: 1, dy: 0 },  // 1: RIGHT
    { dx: 0, dy: 1 },  // 2: DOWN
    { dx: -1, dy: 0 }  // 3: LEFT
  ];

  const OPPOSITE = [2, 3, 0, 1];

  // Tile definitions: connections array [top, right, bottom, left]
  const TILE_DEFS = {
    EMPTY: [false, false, false, false],
    STRAIGHT: [true, false, true, false],      // North-South default
    ELBOW: [true, true, false, false],         // North-East default
    TEE: [false, true, true, true],            // East-South-West default
    CROSS: [true, true, true, true],           // 4-way
    BLOCK: [false, false, false, false]        // Locked obstacle
  };

  // Levels Configuration
  const STAGES = [
    { grid: 5, time: 30, obstacles: 2, pump: { x: 0, y: 0, dir: 1 }, core: { x: 4, y: 4, dir: 0 } },
    { grid: 5, time: 26, obstacles: 3, pump: { x: 0, y: 2, dir: 1 }, core: { x: 4, y: 2, dir: 3 } },
    { grid: 6, time: 26, obstacles: 4, pump: { x: 0, y: 0, dir: 1 }, core: { x: 5, y: 5, dir: 0 } },
    { grid: 6, time: 24, obstacles: 5, pump: { x: 1, y: 0, dir: 2 }, core: { x: 4, y: 5, dir: 0 } },
    { grid: 6, time: 22, obstacles: 6, pump: { x: 0, y: 3, dir: 1 }, core: { x: 5, y: 2, dir: 3 } },
    { grid: 7, time: 22, obstacles: 7, pump: { x: 0, y: 0, dir: 1 }, core: { x: 6, y: 6, dir: 0 } },
    { grid: 7, time: 20, obstacles: 8, pump: { x: 3, y: 0, dir: 2 }, core: { x: 3, y: 6, dir: 0 } },
    { grid: 7, time: 18, obstacles: 9, pump: { x: 0, y: 6, dir: 0 }, core: { x: 6, y: 0, dir: 2 } }
  ];

  // Game State
  let currentStageIndex = 0;
  let score = 0;
  let coreIntegrity = 100;
  let grid = [];
  let gridSize = 6;
  let timerRemaining = 25;
  let timerInterval = null;
  let isFlowing = false;
  let flowStepIndex = 0;
  let fluidPath = [];
  let isSpill = false;
  let isCoreReached = false;
  let soundEnabled = true;
  let audioCtx = null;
  let animFrameId = null;

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const levelDisplay = document.getElementById('level-display');
  const timerDisplay = document.getElementById('timer-display');
  const integrityDisplay = document.getElementById('integrity-display');
  const scoreDisplay = document.getElementById('score-display');
  const coolantFillBar = document.getElementById('coolant-fill-bar');
  const pumpStatusLabel = document.getElementById('pump-status-label');
  const tempDisplay = document.getElementById('temp-display');
  const logText = document.getElementById('log-text');
  const overlay = document.getElementById('grid-status-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const btnRetry = document.getElementById('btn-overlay-retry');
  const btnNext = document.getElementById('btn-overlay-next');
  const btnRestart = document.getElementById('btn-restart');
  const btnFastForward = document.getElementById('btn-fast-forward');
  const btnSound = document.getElementById('btn-sound');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');

  // Audio Engine
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;

      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);

      const now = actx.currentTime;

      if (type === 'rotate') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'flow') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260 + (flowStepIndex * 25), now);
        osc.frequency.linearRampToValueAtTime(320 + (flowStepIndex * 25), now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'spill') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      // Audio fallback silent
    }
  }

  // Rotate tile connections clockwise: [top, right, bottom, left] -> [left, top, right, bottom]
  function rotateConnections(conns) {
    return [conns[3], conns[0], conns[1], conns[2]];
  }

  // Tile generation
  function createRandomTile(typeOverride) {
    const types = ['STRAIGHT', 'ELBOW', 'TEE', 'CROSS'];
    const chosenType = typeOverride || types[Math.floor(Math.random() * types.length)];
    let connections = [...TILE_DEFS[chosenType]];
    const rotations = Math.floor(Math.random() * 4);
    for (let i = 0; i < rotations; i++) {
      connections = rotateConnections(connections);
    }
    return {
      type: chosenType,
      connections: connections,
      rotations: rotations,
      liquidFill: 0, // 0 to 1
      isFilled: false,
      flowDirections: []
    };
  }

  // Init Level
  function initStage(stageIdx) {
    currentStageIndex = stageIdx % STAGES.length;
    const stage = STAGES[currentStageIndex];
    gridSize = stage.grid;
    timerRemaining = stage.time;
    isFlowing = false;
    isSpill = false;
    isCoreReached = false;
    flowStepIndex = 0;
    fluidPath = [];

    // Build Grid
    grid = [];
    for (let y = 0; y < gridSize; y++) {
      const row = [];
      for (let x = 0; x < gridSize; x++) {
        row.push(createRandomTile());
      }
      grid.push(row);
    }

    // Place Obstacles
    let placedObstacles = 0;
    while (placedObstacles < stage.obstacles) {
      const rx = Math.floor(Math.random() * gridSize);
      const ry = Math.floor(Math.random() * gridSize);
      const isPump = (rx === stage.pump.x && ry === stage.pump.y);
      const isCore = (rx === stage.core.x && ry === stage.core.y);
      if (!isPump && !isCore && grid[ry][rx].type !== 'BLOCK') {
        grid[ry][rx] = {
          type: 'BLOCK',
          connections: [false, false, false, false],
          rotations: 0,
          liquidFill: 0,
          isFilled: false,
          flowDirections: []
        };
        placedObstacles++;
      }
    }

    // Update HUD
    levelDisplay.textContent = `${currentStageIndex + 1} / ${STAGES.length}`;
    timerDisplay.textContent = `${timerRemaining}s`;
    timerDisplay.className = 'stat-val';
    coolantFillBar.style.height = '0%';
    pumpStatusLabel.textContent = 'PRESSURIZING';
    tempDisplay.textContent = `${(5000 + currentStageIndex * 850).toLocaleString()} K`;
    logText.textContent = `Sector ${currentStageIndex + 1}: Rotate conduits to create safe passage from Pump to Reactor Core.`;

    overlay.classList.add('hidden');
    btnNext.classList.add('hidden');
    btnRetry.classList.remove('hidden');

    clearInterval(timerInterval);
    timerInterval = setInterval(onTimerTick, 1000);
  }

  function onTimerTick() {
    if (isFlowing) return;

    timerRemaining--;
    timerDisplay.textContent = `${timerRemaining}s`;

    const stage = STAGES[currentStageIndex];
    const fillPercent = ((stage.time - timerRemaining) / stage.time) * 100;
    coolantFillBar.style.height = `${Math.min(100, fillPercent)}%`;

    if (timerRemaining <= 5) {
      timerDisplay.className = 'stat-val warning';
      pumpStatusLabel.textContent = 'WARNING: FLUSH IMMINENT';
    }

    if (timerRemaining <= 0) {
      triggerCoolantRelease();
    }
  }

  function triggerCoolantRelease() {
    if (isFlowing) return;
    isFlowing = true;
    clearInterval(timerInterval);
    pumpStatusLabel.textContent = 'ACTIVE FLUID DISCHARGE';
    coolantFillBar.style.height = '100%';
    calculateFluidPath();
    startFluidAnimation();
  }

  // Pathfinding algorithm tracking coolant fluid flow
  function calculateFluidPath() {
    const stage = STAGES[currentStageIndex];
    fluidPath = [];

    let curX = stage.pump.x;
    let curY = stage.pump.y;
    let enterDir = stage.pump.dir; // Entering from direction

    // Fluid enters the first tile from opposite of enterDir
    let inConn = OPPOSITE[enterDir];

    while (true) {
      if (curX < 0 || curX >= gridSize || curY < 0 || curY >= gridSize) {
        // Spill over grid edge!
        fluidPath.push({ x: curX, y: curY, spill: true, reason: 'EDGE_SPILL' });
        break;
      }

      const tile = grid[curY][curX];

      // Check if tile has a connection receiving the flow
      if (!tile.connections[inConn]) {
        // Spill: no inlet at this tile edge
        fluidPath.push({ x: curX, y: curY, spill: true, reason: 'CLOSED_INLET' });
        break;
      }

      // Find an exit direction that isn't the inlet
      // Standard pipes: find available outgoing connections
      let outDir = -1;
      for (let d = 0; d < 4; d++) {
        if (d !== inConn && tile.connections[d]) {
          outDir = d;
          break; // First valid branch chosen
        }
      }

      if (outDir === -1) {
        // Dead-end pipe
        fluidPath.push({ x: curX, y: curY, inDir: inConn, outDir: -1, spill: true, reason: 'DEAD_END' });
        break;
      }

      fluidPath.push({ x: curX, y: curY, inDir: inConn, outDir: outDir, spill: false });

      // Check if current tile connects directly to reactor core
      if (curX === stage.core.x && curY === stage.core.y && outDir === stage.core.dir) {
        isCoreReached = true;
        break;
      }

      // Move to next tile
      curX += DIRS[outDir].dx;
      curY += DIRS[outDir].dy;
      inConn = OPPOSITE[outDir];
    }
  }

  function startFluidAnimation() {
    let step = 0;
    const interval = setInterval(() => {
      if (step >= fluidPath.length) {
        clearInterval(interval);
        handleFlowConclusion();
        return;
      }

      const point = fluidPath[step];
      if (point.x >= 0 && point.x < gridSize && point.y >= 0 && point.y < gridSize) {
        const tile = grid[point.y][point.x];
        tile.isFilled = true;
        tile.liquidFill = 1;
      }

      playSound('flow');
      flowStepIndex++;

      if (point.spill) {
        isSpill = true;
        clearInterval(interval);
        handleFlowConclusion();
        return;
      }

      step++;
    }, 280);
  }

  function handleFlowConclusion() {
    if (isCoreReached) {
      playSound('success');
      score += 1000 + (timerRemaining * 50);
      scoreDisplay.textContent = String(score).padStart(5, '0');
      overlayTitle.textContent = 'SECTOR SECURED';
      overlayMsg.textContent = 'Coolant successfully flooded the reactor core. Thermal stabilization achieved!';
      btnRetry.classList.add('hidden');
      btnNext.classList.remove('hidden');
      overlay.classList.remove('hidden');
    } else {
      playSound('spill');
      coreIntegrity = Math.max(0, coreIntegrity - 25);
      integrityDisplay.textContent = `${coreIntegrity}%`;
      if (coreIntegrity <= 25) integrityDisplay.className = 'stat-val warning';
      if (coreIntegrity === 0) integrityDisplay.className = 'stat-val danger';

      overlayTitle.textContent = 'CONTAINMENT FAILURE';
      overlayMsg.textContent = 'Coolant spill detected! Pipe path broken before reaching core.';
      btnRetry.classList.remove('hidden');
      btnNext.classList.add('hidden');
      overlay.classList.remove('hidden');
    }
  }

  // Grid Tile Interaction
  function rotateTileAt(gx, gy) {
    if (isFlowing) return;
    if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return;

    const tile = grid[gy][gx];
    if (tile.type === 'BLOCK') return;

    tile.connections = rotateConnections(tile.connections);
    tile.rotations = (tile.rotations + 1) % 4;
    playSound('rotate');
  }

  // Canvas Rendering
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellSize = canvas.width / gridSize;
    const stage = STAGES[currentStageIndex];

    // Background Grid
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const px = x * cellSize;
        const py = y * cellSize;
        const tile = grid[y][x];

        // Tile base card
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);

        // Draw Conduit Elements
        drawTileConduit(ctx, px, py, cellSize, tile);

        // Mark Pump & Core
        if (x === stage.pump.x && y === stage.pump.y) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 3, py + 3, cellSize - 6, cellSize - 6);
        }
        if (x === stage.core.x && y === stage.core.y) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 3, py + 3, cellSize - 6, cellSize - 6);
        }
      }
    }

    // Spill indicator
    if (isSpill && fluidPath.length > 0) {
      const lastPoint = fluidPath[fluidPath.length - 1];
      const sx = lastPoint.x * cellSize + cellSize / 2;
      const sy = lastPoint.y * cellSize + cellSize / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, cellSize / 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    animFrameId = requestAnimationFrame(render);
  }

  function drawTileConduit(c, x, y, size, tile) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const pipeWidth = size * 0.28;

    if (tile.type === 'BLOCK') {
      c.fillStyle = '#334155';
      c.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
      c.strokeStyle = '#ef4444';
      c.lineWidth = 2;
      c.strokeRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
      return;
    }

    // Outer pipe border
    c.strokeStyle = '#475569';
    c.lineWidth = pipeWidth + 4;
    c.lineCap = 'square';

    // Center hub for multi-connection
    const activeConns = tile.connections.filter(Boolean).length;
    if (activeConns > 0) {
      c.fillStyle = '#334155';
      c.beginPath();
      c.arc(cx, cy, pipeWidth / 2 + 2, 0, Math.PI * 2);
      c.fill();
    }

    // Draw base pipe channels
    tile.connections.forEach((conn, dir) => {
      if (conn) {
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + DIRS[dir].dx * (size / 2), cy + DIRS[dir].dy * (size / 2));
        c.stroke();
      }
    });

    // Inner pipe lumen
    c.strokeStyle = tile.isFilled ? '#38bdf8' : '#1e293b';
    c.lineWidth = pipeWidth;
    tile.connections.forEach((conn, dir) => {
      if (conn) {
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + DIRS[dir].dx * (size / 2), cy + DIRS[dir].dy * (size / 2));
        c.stroke();
      }
    });

    // Glowing fluid highlight if filled
    if (tile.isFilled) {
      c.strokeStyle = '#ffffff';
      c.lineWidth = pipeWidth * 0.35;
      tile.connections.forEach((conn, dir) => {
        if (conn) {
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + DIRS[dir].dx * (size / 2), cy + DIRS[dir].dy * (size / 2));
          c.stroke();
        }
      });
    }
  }

  // Pointer & Click Listeners
  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const cellSize = canvas.width / gridSize;
    const gridX = Math.floor(clickX / cellSize);
    const gridY = Math.floor(clickY / cellSize);

    rotateTileAt(gridX, gridY);
  }

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      triggerCoolantRelease();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      initStage(currentStageIndex);
    }
  });

  // Event Listeners
  canvas.addEventListener('click', handleCanvasClick);
  btnFastForward.addEventListener('click', triggerCoolantRelease);
  btnRestart.addEventListener('click', () => initStage(currentStageIndex));
  btnRetry.addEventListener('click', () => initStage(currentStageIndex));
  btnNext.addEventListener('click', () => initStage(currentStageIndex + 1));

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    iconSoundOn.classList.toggle('hidden', !soundEnabled);
    iconSoundOff.classList.toggle('hidden', soundEnabled);
  });

  // Responsive Canvas Sizing
  function resizeCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight) - 16;
    if (size > 200) {
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }
  }

  window.addEventListener('resize', resizeCanvas);

  // Initialize
  initStage(0);
  resizeCanvas();
  animFrameId = requestAnimationFrame(render);
})();
