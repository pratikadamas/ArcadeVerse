// Quantum Mini Golf - 9-Hole Futuristic Obstacle Course Engine

class GolfAudio {
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

  playPutt(power = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15 * power, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playWallBounce() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playBoost() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playPortalWarp() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  playCupSink() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const notes = [440, 554.37, 659.25, 880];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.14, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.25);
    });
  }
}

// 9 Distinct Putting Holes
const HOLES = [
  {
    hole: 1, par: 2,
    tee: { x: 100, y: 240 }, cup: { x: 500, y: 240 },
    walls: [], sand: [], boosters: [], portals: []
  },
  {
    hole: 2, par: 3,
    tee: { x: 80, y: 120 }, cup: { x: 520, y: 360 },
    walls: [{ x: 280, y: 80, w: 24, h: 200 }],
    sand: [{ x: 340, y: 280, w: 90, h: 70 }],
    boosters: [], portals: []
  },
  {
    hole: 3, par: 3,
    tee: { x: 80, y: 240 }, cup: { x: 520, y: 240 },
    walls: [{ x: 260, y: 140, w: 20, h: 200 }],
    sand: [],
    boosters: [{ x: 160, y: 220, w: 40, h: 40, vx: 5, vy: 0 }],
    portals: [{ inX: 200, inY: 100, outX: 420, outY: 380 }]
  },
  {
    hole: 4, par: 4,
    tee: { x: 80, y: 400 }, cup: { x: 520, y: 100 },
    walls: [{ x: 180, y: 180, w: 240, h: 24 }],
    sand: [{ x: 340, y: 80, w: 100, h: 60 }],
    boosters: [{ x: 80, y: 260, w: 40, h: 40, vx: 0, vy: -6 }],
    portals: []
  },
  {
    hole: 5, par: 3,
    tee: { x: 100, y: 240 }, cup: { x: 500, y: 240 },
    walls: [{ x: 240, y: 40, w: 24, h: 160 }, { x: 340, y: 280, w: 24, h: 160 }],
    sand: [{ x: 280, y: 210, w: 50, h: 60 }],
    boosters: [], portals: []
  },
  {
    hole: 6, par: 4,
    tee: { x: 80, y: 80 }, cup: { x: 520, y: 400 },
    walls: [{ x: 200, y: 80, w: 20, h: 240 }, { x: 380, y: 160, w: 20, h: 240 }],
    sand: [{ x: 240, y: 340, w: 120, h: 60 }],
    boosters: [{ x: 280, y: 100, w: 40, h: 40, vx: 6, vy: 0 }],
    portals: []
  },
  {
    hole: 7, par: 3,
    tee: { x: 80, y: 240 }, cup: { x: 520, y: 240 },
    walls: [{ x: 290, y: 120, w: 20, h: 240 }],
    sand: [],
    boosters: [],
    portals: [{ inX: 180, inY: 240, outX: 420, outY: 240 }]
  },
  {
    hole: 8, par: 4,
    tee: { x: 80, y: 400 }, cup: { x: 80, y: 100 },
    walls: [{ x: 160, y: 40, w: 20, h: 360 }],
    sand: [{ x: 240, y: 180, w: 100, h: 100 }],
    boosters: [{ x: 480, y: 380, w: 40, h: 40, vx: 0, vy: -7 }],
    portals: []
  },
  {
    hole: 9, par: 5,
    tee: { x: 60, y: 240 }, cup: { x: 540, y: 240 },
    walls: [{ x: 180, y: 100, w: 20, h: 180 }, { x: 380, y: 200, w: 20, h: 180 }],
    sand: [{ x: 260, y: 120, w: 60, h: 60 }, { x: 260, y: 300, w: 60, h: 60 }],
    boosters: [{ x: 120, y: 220, w: 40, h: 40, vx: 6, vy: 0 }],
    portals: [{ inX: 280, inY: 240, outX: 460, outY: 240 }]
  }
];

class QuantumMiniGolfGame {
  constructor() {
    this.canvas = document.getElementById('golfCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new GolfAudio();

    this.currentHoleIdx = 0;
    this.strokesThisHole = 0;
    this.totalStrokes = 0;
    this.holeCompleted = false;

    // Golf Ball State
    this.ball = {
      x: 100, y: 240,
      vx: 0, vy: 0,
      r: 8, inCup: false,
      warpCooldown: 0,
      boostCooldown: 0
    };
    this.lastTime = performance.now();
    this.rafId = null;
    this.isPaused = false;

    // Slingshot Aim & Drag
    this.isAiming = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragCurrentX = 0;
    this.dragCurrentY = 0;

    this.initDOM();
    this.loadHole(0);
    this.setupEvents();

    this.animate();
  }

  initDOM() {
    this.holeVal = document.getElementById('holeVal');
    this.parVal = document.getElementById('parVal');
    this.strokesVal = document.getElementById('strokesVal');
    this.totalStrokesVal = document.getElementById('totalStrokesVal');
    this.powerBar = document.getElementById('powerBar');
    this.toastMessage = document.getElementById('toastMessage');

    this.resetHoleBtn = document.getElementById('resetHoleBtn');
    this.nextHoleBtn = document.getElementById('nextHoleBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.rulesBtn = document.getElementById('rulesBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  loadHole(idx) {
    this.currentHoleIdx = idx;
    const h = HOLES[idx];
    this.strokesThisHole = 0;
    this.holeCompleted = false;

    this.ball.x = h.tee.x;
    this.ball.y = h.tee.y;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.inCup = false;

    this.nextHoleBtn.disabled = true;
    this.updateHUD();
    this.showToast(`HOLE ${idx + 1} - PAR ${h.par}`);
  }

  setupEvents() {
    this.resetHoleBtn.addEventListener('click', () => {
      this.loadHole(this.currentHoleIdx);
    });

    this.nextHoleBtn.addEventListener('click', () => {
      if (this.holeCompleted) {
        if (this.currentHoleIdx < HOLES.length - 1) {
          this.loadHole(this.currentHoleIdx + 1);
        } else {
          this.showToast(`MATCH COMPLETE! TOTAL: ${this.totalStrokes}`);
          try {
            window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: Math.max(0, 1000 - this.totalStrokes * 20) }, '*');
            window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER' }, '*');
          } catch (_) {}
        }
      }
    });

    // Slingshot Drag Aiming
    const getCoords = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startAim = (e) => {
      if (this.isBallMoving() || this.ball.inCup) return;
      const pos = getCoords(e);
      const dist = Math.hypot(pos.x - this.ball.x, pos.y - this.ball.y);
      if (dist < 45) {
        this.isAiming = true;
        this.dragStartX = this.ball.x;
        this.dragStartY = this.ball.y;
        this.dragCurrentX = pos.x;
        this.dragCurrentY = pos.y;
      }
    };

    const moveAim = (e) => {
      if (!this.isAiming) return;
      const pos = getCoords(e);
      this.dragCurrentX = pos.x;
      this.dragCurrentY = pos.y;

      const pullDist = Math.min(140, Math.hypot(this.dragCurrentX - this.dragStartX, this.dragCurrentY - this.dragStartY));
      const powerPct = Math.floor((pullDist / 140) * 100);
      this.powerBar.style.width = `${powerPct}%`;
    };

    const releaseAim = () => {
      if (!this.isAiming) return;
      this.isAiming = false;

      const dx = this.dragStartX - this.dragCurrentX;
      const dy = this.dragStartY - this.dragCurrentY;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        const power = Math.min(1, dist / 140);
        const speed = power * 18;
        const angle = Math.atan2(dy, dx);
        this.ball.vx = Math.cos(angle) * speed;
        this.ball.vy = Math.sin(angle) * speed;

        this.strokesThisHole++;
        this.totalStrokes++;
        this.audio.playPutt(power);
        this.updateHUD();
      }
      this.powerBar.style.width = '0%';
    };

    this.canvas.addEventListener('mousedown', startAim);
    window.addEventListener('mousemove', moveAim);
    window.addEventListener('mouseup', releaseAim);

    this.canvas.addEventListener('touchstart', startAim, { passive: true });
    window.addEventListener('touchmove', moveAim, { passive: true });
    window.addEventListener('touchend', releaseAim);

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.rulesBtn.addEventListener('click', () => this.rulesModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
  }

  isBallMoving() {
    return Math.abs(this.ball.vx) > 0.05 || Math.abs(this.ball.vy) > 0.05;
  }

  showToast(text) {
    this.toastMessage.textContent = text;
    this.toastMessage.classList.remove('hidden');
    setTimeout(() => {
      this.toastMessage.classList.add('hidden');
    }, 1800);
  }

  updateHUD() {
    const h = HOLES[this.currentHoleIdx];
    this.holeVal.textContent = `${this.currentHoleIdx + 1} / 9`;
    this.parVal.textContent = h.par;
    this.strokesVal.textContent = this.strokesThisHole;
    this.totalStrokesVal.textContent = this.totalStrokes;
  }

  animate(timestamp) {
    if (this.isPaused) return;
    if (timestamp === undefined) timestamp = performance.now();
    const deltaMs = Math.min(100, timestamp - this.lastTime);
    this.lastTime = timestamp;
    const dt = deltaMs / 16.667;

    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame((t) => this.animate(t));
  }

  update(dt = 1) {
    if (this.ball.inCup) return;
    const h = HOLES[this.currentHoleIdx];

    if (this.ball.warpCooldown > 0) this.ball.warpCooldown -= dt;
    if (this.ball.boostCooldown > 0) this.ball.boostCooldown -= dt;

    // Standard Felt Rolling Friction
    let friction = Math.pow(0.982, dt);

    // Sand Traps (Higher friction)
    h.sand.forEach(s => {
      if (this.ball.x >= s.x && this.ball.x <= s.x + s.w &&
          this.ball.y >= s.y && this.ball.y <= s.y + s.h) {
        friction = Math.pow(0.91, dt); // High drag
      }
    });

    // Booster Pads
    h.boosters.forEach(b => {
      if (this.ball.boostCooldown <= 0 &&
          this.ball.x >= b.x && this.ball.x <= b.x + b.w &&
          this.ball.y >= b.y && this.ball.y <= b.y + b.h) {
        this.ball.vx += b.vx * 0.4;
        this.ball.vy += b.vy * 0.4;
        this.ball.boostCooldown = 15;
        this.audio.playBoost();
      }
    });

    // Quantum Portals
    h.portals.forEach(p => {
      if (this.ball.warpCooldown <= 0 && Math.hypot(this.ball.x - p.inX, this.ball.y - p.inY) < 18) {
        this.ball.x = p.outX;
        this.ball.y = p.outY;
        this.ball.warpCooldown = 25;
        this.audio.playPortalWarp();
        this.showToast('WARP JUMP!');
      }
    });

    // Ball movement
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.vx *= friction;
    this.ball.vy *= friction;

    if (Math.abs(this.ball.vx) < 0.04) this.ball.vx = 0;
    if (Math.abs(this.ball.vy) < 0.04) this.ball.vy = 0;

    // Outer Boundary Collisions
    const minX = 25, maxX = 575, minY = 25, maxY = 455;
    if (this.ball.x - this.ball.r < minX) {
      this.ball.x = minX + this.ball.r;
      this.ball.vx = -this.ball.vx * 0.85;
      this.audio.playWallBounce();
    } else if (this.ball.x + this.ball.r > maxX) {
      this.ball.x = maxX - this.ball.r;
      this.ball.vx = -this.ball.vx * 0.85;
      this.audio.playWallBounce();
    }

    if (this.ball.y - this.ball.r < minY) {
      this.ball.y = minY + this.ball.r;
      this.ball.vy = -this.ball.vy * 0.85;
      this.audio.playWallBounce();
    } else if (this.ball.y + this.ball.r > maxY) {
      this.ball.y = maxY - this.ball.r;
      this.ball.vy = -this.ball.vy * 0.85;
      this.audio.playWallBounce();
    }

    // Inner Obstacle Wall Collisions (Closest-point separation)
    h.walls.forEach(w => {
      const closestX = Math.max(w.x, Math.min(this.ball.x, w.x + w.w));
      const closestY = Math.max(w.y, Math.min(this.ball.y, w.y + w.h));
      const distX = this.ball.x - closestX;
      const distY = this.ball.y - closestY;
      const dist = Math.hypot(distX, distY);

      if (dist < this.ball.r) {
        if (dist > 1e-4) {
          const nx = distX / dist;
          const ny = distY / dist;
          const penetration = this.ball.r - dist;
          this.ball.x += nx * penetration;
          this.ball.y += ny * penetration;

          const dot = this.ball.vx * nx + this.ball.vy * ny;
          if (dot < 0) {
            this.ball.vx = (this.ball.vx - 2 * dot * nx) * 0.85;
            this.ball.vy = (this.ball.vy - 2 * dot * ny) * 0.85;
            this.audio.playWallBounce();
          }
        } else {
          // Inside wall center fallback
          this.ball.vx = -this.ball.vx * 0.85;
          this.ball.vy = -this.ball.vy * 0.85;
          this.audio.playWallBounce();
        }
      }
    });

    // Cup detection
    const cupDist = Math.hypot(this.ball.x - h.cup.x, this.ball.y - h.cup.y);
    if (cupDist < 12 && Math.hypot(this.ball.vx, this.ball.vy) < 4.5) {
      this.ball.inCup = true;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.x = h.cup.x;
      this.ball.y = h.cup.y;
      this.holeCompleted = true;
      this.nextHoleBtn.disabled = false;
      this.audio.playCupSink();

      if (this.strokesThisHole === 1) this.showToast('HOLE IN ONE!');
      else if (this.strokesThisHole < h.par) this.showToast('BIRDIE!');
      else if (this.strokesThisHole === h.par) this.showToast('PAR!');
      else this.showToast('HOLE CLEARED!');
    }
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const hole = HOLES[this.currentHoleIdx];

    // Neon Green Putting Felt
    this.ctx.fillStyle = '#064e3b';
    this.ctx.fillRect(20, 20, w - 40, h - 40);

    // Neon Course Wall Border
    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#10b981';
    this.ctx.shadowBlur = 10;
    this.ctx.strokeRect(20, 20, w - 40, h - 40);
    this.ctx.shadowBlur = 0;

    // Render Sand Traps
    hole.sand.forEach(s => {
      this.ctx.fillStyle = '#b45309';
      this.ctx.fillRect(s.x, s.y, s.w, s.h);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(s.x, s.y, s.w, s.h);
    });

    // Render Booster Pads
    hole.boosters.forEach(b => {
      this.ctx.fillStyle = '#0891b2';
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(b.x, b.y, b.w, b.h);
    });

    // Render Portals
    hole.portals.forEach(p => {
      // Blue Entrance
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.beginPath();
      this.ctx.arc(p.inX, p.inY, 14, 0, Math.PI * 2);
      this.ctx.fill();

      // Orange Exit
      this.ctx.fillStyle = '#f97316';
      this.ctx.beginPath();
      this.ctx.arc(p.outX, p.outY, 14, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Render Walls
    hole.walls.forEach(wl => {
      this.ctx.fillStyle = '#1e293b';
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(wl.x, wl.y, wl.w, wl.h);
      this.ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
    });

    // Render Cup & Flag
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    this.ctx.arc(hole.cup.x, hole.cup.y, 11, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#64748b';
    this.ctx.stroke();

    // Flagstick
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(hole.cup.x, hole.cup.y);
    this.ctx.lineTo(hole.cup.x, hole.cup.y - 30);
    this.ctx.stroke();
    // Flag cloth
    this.ctx.fillStyle = '#ef4444';
    this.ctx.beginPath();
    this.ctx.moveTo(hole.cup.x, hole.cup.y - 30);
    this.ctx.lineTo(hole.cup.x + 14, hole.cup.y - 23);
    this.ctx.lineTo(hole.cup.x, hole.cup.y - 16);
    this.ctx.fill();

    // Aim Slingshot Trajectory
    if (this.isAiming) {
      this.ctx.save();
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 6]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.ball.x, this.ball.y);
      this.ctx.lineTo(this.dragCurrentX, this.dragCurrentY);
      this.ctx.stroke();

      // Reverse shot arrow
      const angle = Math.atan2(this.ball.y - this.dragCurrentY, this.ball.x - this.dragCurrentX);
      this.ctx.strokeStyle = '#10b981';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.ball.x, this.ball.y);
      this.ctx.lineTo(this.ball.x + Math.cos(angle) * 70, this.ball.y + Math.sin(angle) * 70);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Render Golf Ball
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = '#10b981';
    this.ctx.shadowBlur = 10;
    this.ctx.fill();
    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new QuantumMiniGolfGame();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.isPaused = true;
      if (game.rafId) {
        cancelAnimationFrame(game.rafId);
        game.rafId = null;
      }
    } else {
      if (game.isPaused) {
        game.isPaused = false;
        game.lastTime = performance.now();
        game.animate();
      }
    }
  });

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const type = e.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      game.isPaused = true;
      if (game.rafId) {
        cancelAnimationFrame(game.rafId);
        game.rafId = null;
      }
    } else if (type === 'ARCADEVERSE_RESUME') {
      if (game.isPaused) {
        game.isPaused = false;
        game.lastTime = performance.now();
        game.animate();
      }
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      game.isPaused = true;
      if (game.rafId) {
        cancelAnimationFrame(game.rafId);
        game.rafId = null;
      }
    } else if (type === 'AV_RESIZE') {
      const d = e.data;
      if (d.width && d.height && game.canvas) {
        game.canvas.width = d.width;
        game.canvas.height = d.height;
      }
    }
  });
});
