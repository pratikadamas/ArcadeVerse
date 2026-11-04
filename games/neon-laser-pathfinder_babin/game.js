// Neon Laser Pathfinder - ArcadeVerse
// Audio Synthesizer via Web Audio API
class SoundFx {
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

  playPlace() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playRotate() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(480, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playPowerOn() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.14, now + i * 0.07);
      gain.gain.linearRampToValueAtTime(0.001, now + i * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.2);
    });
  }

  playLevelComplete() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.18, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.35);
    });
  }
}

// Game State & Optical Engine
const GRID_SIZE = 8;
const LEVELS = [
  {
    level: 1,
    emitters: [{ x: 1, y: 3, dir: { dx: 1, dy: 0 }, color: '#06b6d4' }],
    targets: [{ x: 6, y: 3, powered: false }],
    blockers: [{ x: 3, y: 3 }]
  },
  {
    level: 2,
    emitters: [{ x: 0, y: 1, dir: { dx: 1, dy: 0 }, color: '#38bdf8' }],
    targets: [{ x: 7, y: 6, powered: false }],
    blockers: [{ x: 4, y: 1 }, { x: 4, y: 6 }]
  },
  {
    level: 3,
    emitters: [{ x: 2, y: 0, dir: { dx: 0, dy: 1 }, color: '#a855f7' }],
    targets: [{ x: 1, y: 7, powered: false }, { x: 6, y: 7, powered: false }],
    blockers: [{ x: 2, y: 4 }, { x: 4, y: 4 }]
  },
  {
    level: 4,
    emitters: [{ x: 0, y: 4, dir: { dx: 1, dy: 0 }, color: '#10b981' }],
    targets: [{ x: 7, y: 1, powered: false }, { x: 7, y: 6, powered: false }, { x: 3, y: 7, powered: false }],
    blockers: [{ x: 3, y: 4 }, { x: 5, y: 3 }]
  },
  {
    level: 5,
    emitters: [{ x: 1, y: 1, dir: { dx: 1, dy: 0 }, color: '#f43f5e' }],
    targets: [{ x: 6, y: 1, powered: false }, { x: 6, y: 6, powered: false }, { x: 1, y: 6, powered: false }],
    blockers: [{ x: 4, y: 1 }, { x: 4, y: 6 }, { x: 3, y: 3 }]
  }
];

class NeonLaserPathfinder {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundFx();

    this.currentLevelIdx = 0;
    this.selectedTool = 'slash'; // 'slash', 'backslash', 'splitter', 'eraser'
    this.grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    this.emitters = [];
    this.targets = [];
    this.blockers = [];
    this.laserSegments = [];
    this.moves = 0;
    this.isCompleted = false;

    // Pulse animations
    this.animTime = 0;

    this.initDOM();
    this.loadLevel(this.currentLevelIdx);
    this.setupEvents();
    this.animate();
  }

  initDOM() {
    this.levelVal = document.getElementById('levelVal');
    this.nodesVal = document.getElementById('nodesVal');
    this.movesVal = document.getElementById('movesVal');
    this.toast = document.getElementById('toastMessage');
    this.soundBtn = document.getElementById('soundBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.rulesBtn = document.getElementById('rulesBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeRulesBtn = document.getElementById('closeRulesBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
    this.resetLevelBtn = document.getElementById('resetLevelBtn');
    this.nextLevelBtn = document.getElementById('nextLevelBtn');

    this.toolButtons = document.querySelectorAll('.tool-btn');
  }

  loadLevel(idx) {
    const lvl = LEVELS[idx % LEVELS.length];
    this.grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    this.emitters = JSON.parse(JSON.stringify(lvl.emitters));
    this.targets = JSON.parse(JSON.stringify(lvl.targets));
    this.blockers = JSON.parse(JSON.stringify(lvl.blockers));
    this.moves = 0;
    this.isCompleted = false;

    // Apply fixed elements to grid
    this.blockers.forEach(b => {
      this.grid[b.y][b.x] = { type: 'blocker' };
    });

    this.emitters.forEach(e => {
      this.grid[e.y][e.x] = { type: 'emitter', dir: e.dir, color: e.color };
    });

    this.targets.forEach(t => {
      this.grid[t.y][t.x] = { type: 'target', powered: false };
    });

    this.nextLevelBtn.disabled = true;
    this.updateStats();
    this.recalculateLasers();
    this.showToast(`Sector ${idx + 1} Calibrated`);
  }

  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add('hidden');
    }, 2200);
  }

  setupEvents() {
    // Tool buttons
    this.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTool = btn.dataset.tool;
      });
    });

    // Reset & Next Level
    this.resetLevelBtn.addEventListener('click', () => {
      this.loadLevel(this.currentLevelIdx);
      this.sound.playRotate();
    });

    this.nextLevelBtn.addEventListener('click', () => {
      if (this.isCompleted) {
        this.currentLevelIdx = (this.currentLevelIdx + 1) % LEVELS.length;
        this.loadLevel(this.currentLevelIdx);
      }
    });

    // Sound toggle
    this.soundBtn.addEventListener('click', () => {
      this.sound.muted = !this.sound.muted;
      this.soundIcon.innerHTML = this.sound.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Rules modal
    this.rulesBtn.addEventListener('click', () => this.rulesModal.classList.remove('hidden'));
    this.closeRulesBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));

    // Canvas click & tap
    const handleCellInteraction = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX === undefined || clientY === undefined) return;

      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      const cellSize = this.canvas.width / GRID_SIZE;
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);

      if (cellX >= 0 && cellX < GRID_SIZE && cellY >= 0 && cellY < GRID_SIZE) {
        this.interactCell(cellX, cellY);
      }
    };

    this.canvas.addEventListener('click', handleCellInteraction);
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleCellInteraction(e);
    }, { passive: false });
  }

  interactCell(x, y) {
    const item = this.grid[y][x];

    // Cannot modify fixed elements
    if (item && (item.type === 'emitter' || item.type === 'target' || item.type === 'blocker')) {
      return;
    }

    if (this.selectedTool === 'eraser') {
      if (item) {
        this.grid[y][x] = null;
        this.moves++;
        this.sound.playRotate();
        this.recalculateLasers();
      }
      return;
    }

    // Placing or rotating prism
    if (!item) {
      this.grid[y][x] = { type: 'prism', kind: this.selectedTool };
      this.moves++;
      this.sound.playPlace();
    } else if (item.type === 'prism') {
      // Cycle prism types on repeated clicks
      if (item.kind === 'slash') item.kind = 'backslash';
      else if (item.kind === 'backslash') item.kind = 'splitter';
      else if (item.kind === 'splitter') item.kind = 'slash';
      this.moves++;
      this.sound.playRotate();
    }

    this.recalculateLasers();
  }

  recalculateLasers() {
    this.laserSegments = [];
    this.targets.forEach(t => t.powered = false);

    // Cast light from each emitter
    this.emitters.forEach(emitter => {
      this.traceRay(emitter.x, emitter.y, emitter.dir.dx, emitter.dir.dy, emitter.color);
    });

    const poweredCount = this.targets.filter(t => t.powered).length;
    this.updateStats();

    if (poweredCount === this.targets.length && !this.isCompleted) {
      this.isCompleted = true;
      this.nextLevelBtn.disabled = false;
      this.sound.playLevelComplete();
      this.showToast('All Power Nodes Online! Sector Cleared.');
    }
  }

  traceRay(startX, startY, dirX, dirY, color) {
    let currX = startX;
    let currY = startY;
    let dx = dirX;
    let dy = dirY;
    let maxSteps = 45;
    let visited = new Set();

    while (maxSteps-- > 0) {
      const stateKey = `${currX},${currY},${dx},${dy}`;
      if (visited.has(stateKey)) break;
      visited.add(stateKey);

      const nextX = currX + dx;
      const nextY = currY + dy;

      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        this.laserSegments.push({
          x1: currX, y1: currY,
          x2: nextX, y2: nextY,
          color: color
        });
        break;
      }

      this.laserSegments.push({
        x1: currX, y1: currY,
        x2: nextX, y2: nextY,
        color: color
      });

      currX = nextX;
      currY = nextY;

      const obstacle = this.grid[currY][currX];
      if (obstacle) {
        if (obstacle.type === 'blocker') {
          break; // Beam absorbed
        } else if (obstacle.type === 'target') {
          obstacle.powered = true;
          const targetRef = this.targets.find(t => t.x === currX && t.y === currY);
          if (targetRef && !targetRef.powered) {
            targetRef.powered = true;
            this.sound.playPowerOn();
          }
          break;
        } else if (obstacle.type === 'emitter') {
          break; // Absorbed on emitter body
        } else if (obstacle.type === 'prism') {
          if (obstacle.kind === 'slash') {
            // Reflect: /
            // dx=1, dy=0 -> dx=0, dy=-1
            // dx=-1, dy=0 -> dx=0, dy=1
            // dx=0, dy=1 -> dx=-1, dy=0
            // dx=0, dy=-1 -> dx=1, dy=0
            const tempDx = dx;
            dx = -dy;
            dy = -tempDx;
          } else if (obstacle.kind === 'backslash') {
            // Reflect: \
            // dx=1, dy=0 -> dx=0, dy=1
            // dx=-1, dy=0 -> dx=0, dy=-1
            // dx=0, dy=1 -> dx=1, dy=0
            // dx=0, dy=-1 -> dx=-1, dy=0
            const tempDx = dx;
            dx = dy;
            dy = tempDx;
          } else if (obstacle.kind === 'splitter') {
            // Beam splitter creates orthogonal branch
            const branchDx = -dy;
            const branchDy = dx;
            this.traceRay(currX, currY, branchDx, branchDy, color);
            // Main beam continues forward uninterrupted
          }
        }
      }
    }
  }

  updateStats() {
    this.levelVal.textContent = this.currentLevelIdx + 1;
    const poweredCount = this.targets.filter(t => t.powered).length;
    this.nodesVal.textContent = `${poweredCount} / ${this.targets.length}`;
    this.movesVal.textContent = this.moves;
  }

  animate() {
    this.animTime += 0.04;
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cellSize = width / GRID_SIZE;

    this.ctx.clearRect(0, 0, width, height);

    // Draw Grid Lines
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * cellSize, 0);
      this.ctx.lineTo(i * cellSize, height);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, i * cellSize);
      this.ctx.lineTo(width, i * cellSize);
      this.ctx.stroke();
    }

    // Draw Laser Beams
    this.ctx.lineCap = 'round';
    this.laserSegments.forEach(seg => {
      const cx1 = (seg.x1 + 0.5) * cellSize;
      const cy1 = (seg.y1 + 0.5) * cellSize;
      const cx2 = (seg.x2 + 0.5) * cellSize;
      const cy2 = (seg.y2 + 0.5) * cellSize;

      // Outer glow
      this.ctx.strokeStyle = seg.color;
      this.ctx.lineWidth = 5 + Math.sin(this.animTime * 3) * 1.5;
      this.ctx.shadowColor = seg.color;
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.moveTo(cx1, cy1);
      this.ctx.lineTo(cx2, cy2);
      this.ctx.stroke();

      // Inner intense core
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 0;
      this.ctx.beginPath();
      this.ctx.moveTo(cx1, cy1);
      this.ctx.lineTo(cx2, cy2);
      this.ctx.stroke();
    });

    // Draw Elements
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const item = this.grid[r][c];
        const cx = (c + 0.5) * cellSize;
        const cy = (r + 0.5) * cellSize;

        if (!item) continue;

        if (item.type === 'blocker') {
          this.ctx.fillStyle = '#0f172a';
          this.ctx.strokeStyle = '#334155';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.roundRect(c * cellSize + 6, r * cellSize + 6, cellSize - 12, cellSize - 12, 6);
          this.ctx.fill();
          this.ctx.stroke();

          // Obsidian Core Hatching
          this.ctx.strokeStyle = '#1e293b';
          this.ctx.beginPath();
          this.ctx.moveTo(c * cellSize + 12, r * cellSize + 12);
          this.ctx.lineTo((c + 1) * cellSize - 12, (r + 1) * cellSize - 12);
          this.ctx.stroke();
        } else if (item.type === 'emitter') {
          this.ctx.fillStyle = '#1e1b4b';
          this.ctx.strokeStyle = item.color;
          this.ctx.lineWidth = 2.5;
          this.ctx.shadowColor = item.color;
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, cellSize * 0.32, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;

          // Pointer nozzle
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(cx, cy);
          this.ctx.lineTo(cx + item.dir.dx * cellSize * 0.42, cy + item.dir.dy * cellSize * 0.42);
          this.ctx.stroke();
        } else if (item.type === 'target') {
          const isPow = item.powered;
          this.ctx.fillStyle = isPow ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.5)';
          this.ctx.strokeStyle = isPow ? '#10b981' : '#64748b';
          this.ctx.lineWidth = isPow ? 3 : 1.5;
          if (isPow) {
            this.ctx.shadowColor = '#10b981';
            this.ctx.shadowBlur = 14 + Math.sin(this.animTime * 4) * 4;
          }
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;

          // Target node icon
          this.ctx.fillStyle = isPow ? '#34d399' : '#94a3b8';
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, cellSize * 0.12, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (item.type === 'prism') {
          // Prism housing
          this.ctx.fillStyle = '#1e293b';
          this.ctx.strokeStyle = '#38bdf8';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.roundRect(c * cellSize + 8, r * cellSize + 8, cellSize - 16, cellSize - 16, 8);
          this.ctx.fill();
          this.ctx.stroke();

          // Prism glyph
          this.ctx.strokeStyle = '#38bdf8';
          this.ctx.shadowColor = '#06b6d4';
          this.ctx.shadowBlur = 8;
          this.ctx.lineWidth = 3;

          if (item.kind === 'slash') {
            this.ctx.beginPath();
            this.ctx.moveTo((c + 1) * cellSize - 16, r * cellSize + 16);
            this.ctx.lineTo(c * cellSize + 16, (r + 1) * cellSize - 16);
            this.ctx.stroke();
          } else if (item.kind === 'backslash') {
            this.ctx.beginPath();
            this.ctx.moveTo(c * cellSize + 16, r * cellSize + 16);
            this.ctx.lineTo((c + 1) * cellSize - 16, (r + 1) * cellSize - 16);
            this.ctx.stroke();
          } else if (item.kind === 'splitter') {
            this.ctx.beginPath();
            this.ctx.moveTo(cx, r * cellSize + 14);
            this.ctx.lineTo(cx, (r + 1) * cellSize - 14);
            this.ctx.moveTo(c * cellSize + 14, cy);
            this.ctx.lineTo((c + 1) * cellSize - 14, cy);
            this.ctx.stroke();
          }
          this.ctx.shadowBlur = 0;
        }
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new NeonLaserPathfinder();
});
