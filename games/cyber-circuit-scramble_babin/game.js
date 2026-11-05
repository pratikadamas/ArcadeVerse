/* Cyber Circuit Scramble - game.js */
(function() {
  'use strict';

  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
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
    rotate() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
      } catch (e) {}
    }
    connected() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.12, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.2);
        });
      } catch (e) {}
    }
    over() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statLevelEl = document.getElementById('statLevel');
  const statFlowEl = document.getElementById('statFlow');
  const statTimeEl = document.getElementById('statTime');
  const statScoreEl = document.getElementById('statScore');

  const startScreen = document.getElementById('startScreen');
  const winScreen = document.getElementById('winScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnNextLevel = document.getElementById('btnNextLevel');
  const btnRestart = document.getElementById('btnRestart');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  const finalLevelEl = document.getElementById('finalLevel');
  const finalScoreEl = document.getElementById('finalScore');

  const GRID_SIZE = 5;
  let level = 1;
  let score = 0;
  let timeLeft = 45;
  let timerInterval = null;
  let isRunning = false;
  let isPaused = false;

  // Directions: 0: Up, 1: Right, 2: Down, 3: Left
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  let grid = [];

  // Tile types:
  // 'line': connects [0, 2] (up-down)
  // 'elbow': connects [0, 1] (up-right)
  // 't-junction': connects [0, 1, 3] (up-right-left)
  // 'cross': connects [0, 1, 2, 3]

  function createLevel() {
    grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const types = ['line', 'elbow', 't-junction', 'cross'];
        const type = types[Math.floor(Math.random() * types.length)];
        const rot = Math.floor(Math.random() * 4);
        row.push({
          type: type,
          rotation: rot,
          powered: false
        });
      }
      row[row.length - 1];
      grid.push(row);
    }

    // Force solvable path or verify connection
    grid[2][0].type = 'line';
    grid[2][0].rotation = 1; // Left-to-right line
    grid[2][GRID_SIZE - 1].type = 'line';
    grid[2][GRID_SIZE - 1].rotation = 1;

    evaluateCircuit();
  }

  function getConnections(tile) {
    let base = [];
    if (tile.type === 'line') base = [0, 2];
    else if (tile.type === 'elbow') base = [0, 1];
    else if (tile.type === 't-junction') base = [0, 1, 3];
    else if (tile.type === 'cross') base = [0, 1, 2, 3];

    return base.map(dir => (dir + tile.rotation) % 4);
  }

  function evaluateCircuit() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        grid[r][c].powered = false;
      }
    }

    // BFS from start terminal (Row 2, Col 0, entering from Left: direction 3)
    const queue = [];
    const visited = new Set();

    const startConns = getConnections(grid[2][0]);
    if (startConns.includes(3)) {
      grid[2][0].powered = true;
      queue.push({ r: 2, c: 0 });
      visited.add('2,0');
    }

    let completed = false;

    while (queue.length > 0) {
      const cur = queue.shift();
      const curConns = getConnections(grid[cur.r][cur.c]);

      if (cur.r === 2 && cur.c === GRID_SIZE - 1 && curConns.includes(1)) {
        completed = true;
      }

      for (const dir of curConns) {
        const nr = cur.r + DY[dir];
        const nc = cur.c + DX[dir];
        const oppositeDir = (dir + 2) % 4;

        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          const neighborConns = getConnections(grid[nr][nc]);
          if (neighborConns.includes(oppositeDir) && !visited.has(`${nr},${nc}`)) {
            grid[nr][nc].powered = true;
            visited.add(`${nr},${nc}`);
            queue.push({ r: nr, c: nc });
          }
        }
      }
    }

    let poweredCount = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c].powered) poweredCount++;
      }
    }

    const flowPct = Math.round((poweredCount / (GRID_SIZE * GRID_SIZE)) * 100);
    statFlowEl.textContent = `${flowPct}%`;

    render();

    if (completed && isRunning) {
      levelWon();
    }
  }

  function levelWon() {
    isRunning = false;
    clearInterval(timerInterval);
    sfx.connected();
    score += level * 200 + timeLeft * 10;
    statScoreEl.textContent = score;

    winScreen.classList.remove('hidden');
  }

  function startTimer() {
    clearInterval(timerInterval);
    timeLeft = Math.max(25, 50 - level * 2);
    statTimeEl.textContent = `${timeLeft}s`;

    timerInterval = setInterval(() => {
      if (!isPaused && isRunning) {
        timeLeft--;
        statTimeEl.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
          endGame();
        }
      }
    }, 1000);
  }

  function endGame() {
    isRunning = false;
    clearInterval(timerInterval);
    sfx.over();

    finalLevelEl.textContent = level - 1;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 40;
    const tileSize = (canvas.width - pad * 2) / GRID_SIZE;

    // Draw Source and Target Terminals
    const startY = pad + 2 * tileSize + tileSize / 2;
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.fillRect(10, startY - 14, 24, 28);

    const endY = pad + 2 * tileSize + tileSize / 2;
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.fillRect(canvas.width - 34, endY - 14, 24, 28);
    ctx.shadowBlur = 0;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = pad + c * tileSize;
        const y = pad + r * tileSize;
        const tile = grid[r][c];

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = tile.powered ? '#10b981' : '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, tileSize - 8, tileSize - 8, 8);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(x + tileSize / 2, y + tileSize / 2);

        const conns = getConnections(tile);
        ctx.strokeStyle = tile.powered ? '#10b981' : '#475569';
        ctx.shadowColor = tile.powered ? '#34d399' : 'transparent';
        ctx.shadowBlur = tile.powered ? 12 : 0;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        for (const dir of conns) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(DX[dir] * (tileSize / 2 - 8), DY[dir] * (tileSize / 2 - 8));
          ctx.stroke();
        }

        ctx.restore();
      }
    }
  }

  canvas.addEventListener('click', (e) => {
    if (!isRunning || isPaused) return;
    sfx.init();

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const pad = 40;
    const tileSize = (canvas.width - pad * 2) / GRID_SIZE;

    const c = Math.floor((clickX - pad) / tileSize);
    const r = Math.floor((clickY - pad) / tileSize);

    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      grid[r][c].rotation = (grid[r][c].rotation + 1) % 4;
      sfx.rotate();
      evaluateCircuit();
    }
  });

  function startNewGame() {
    sfx.init();
    level = 1;
    score = 0;
    statLevelEl.textContent = '1';
    statScoreEl.textContent = '0';
    startScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    isRunning = true;
    isPaused = false;
    createLevel();
    startTimer();
  }

  function advanceLevel() {
    level++;
    statLevelEl.textContent = level;
    winScreen.classList.add('hidden');
    isRunning = true;
    isPaused = false;
    createLevel();
    startTimer();
  }

  btnStart.addEventListener('click', startNewGame);
  btnNextLevel.addEventListener('click', advanceLevel);
  btnRestart.addEventListener('click', startNewGame);
  btnRestartNav.addEventListener('click', () => {
    createLevel();
  });

  btnPause.addEventListener('click', () => {
    if (!isRunning) return;
    isPaused = !isPaused;
    btnPause.classList.toggle('active', isPaused);
  });

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });
})();
