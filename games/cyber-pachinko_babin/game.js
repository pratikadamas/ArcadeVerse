// Cyber Pachinko - Quantum Drop Pegboard Physics Arcade

class PachinkoAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastPingTime = 0;
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

  playPinballPing(freq = 1400) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastPingTime < 0.015) return;
      this.lastPingTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const actualFreq = freq + (Math.random() - 0.5) * 200;
      osc.frequency.setValueAtTime(actualFreq, now);
      osc.frequency.exponentialRampToValueAtTime(actualFreq * 1.35, now + 0.04);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  playPegClick(speed = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800 + Math.random() * 800, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (e) {}
  }

  playBumperBounce() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }

  playVortexTeleport() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }

  playJackpot() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    } catch (e) {}
  }
}

// 2D Multi-Sphere Particle Pegboard
class CyberPachinkoGame {
  constructor() {
    this.canvas = document.getElementById('pachinkoCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new PachinkoAudio();

    this.spheres = [];
    this.pegs = [];
    this.bumpers = [];
    this.vortex = { x: 230, y: 310, r: 24, pulse: 0 };
    this.bins = [];

    // Economy & Scoring
    this.spheresRemaining = 50;
    this.score = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;

    // Plunger power sweep
    this.plungerPower = 0.5;
    this.plungerDir = 1;
    this.isChargingPlunger = false;

    this.initDOM();
    this.buildBoard();
    this.setupEvents();

    this.animate();
  }

  initDOM() {
    this.spheresCount = document.getElementById('spheresCount');
    this.scoreCount = document.getElementById('scoreCount');
    this.multCount = document.getElementById('multCount');
    this.powerPercent = document.getElementById('powerPercent');
    this.plungerFill = document.getElementById('plungerFill');
    this.toastMessage = document.getElementById('toastMessage');

    this.launchSingleBtn = document.getElementById('launchSingleBtn');
    this.rapidFireBtn = document.getElementById('rapidFireBtn');
    this.resetBoardBtn = document.getElementById('resetBoardBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.guideBtn = document.getElementById('guideBtn');
    this.guideModal = document.getElementById('guideModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  buildBoard() {
    this.pegs = [];
    const rows = 12;
    const startY = 120;
    const ySpacing = 36;

    for (let r = 0; r < rows; r++) {
      const isEven = r % 2 === 0;
      const count = isEven ? 11 : 10;
      const startX = isEven ? 45 : 62;
      const xSpacing = 35;

      for (let c = 0; c < count; c++) {
        const px = startX + c * xSpacing;
        const py = startY + r * ySpacing;
        // Don't place pegs inside vortex zone
        if (Math.hypot(px - 230, py - 310) > 34) {
          this.pegs.push({ x: px, y: py, r: 3.5, hitFlash: 0 });
        }
      }
    }

    // Interactive Bumpers
    this.bumpers = [
      { x: 130, y: 220, r: 18, color: '#f43f5e', points: 150, hitFlash: 0 },
      { x: 330, y: 220, r: 18, color: '#f43f5e', points: 150, hitFlash: 0 },
      { x: 230, y: 190, r: 20, color: '#38bdf8', points: 250, hitFlash: 0 }
    ];

    // Bottom Catch Bins (7 slots)
    this.bins = [
      { x: 25, w: 58, mult: 1, label: 'x1' },
      { x: 85, w: 58, mult: 2, label: 'x2' },
      { x: 145, w: 58, mult: 5, label: 'x5' },
      { x: 205, w: 50, mult: 20, label: 'JACKPOT', isJackpot: true },
      { x: 257, w: 58, mult: 5, label: 'x5' },
      { x: 317, w: 58, mult: 2, label: 'x2' },
      { x: 377, w: 58, mult: 1, label: 'x1' }
    ];
  }

  setupEvents() {
    // Plunger Charge & Fire
    const startPlunge = () => { this.isChargingPlunger = true; };
    const releasePlunge = () => {
      if (!this.isChargingPlunger) return;
      this.isChargingPlunger = false;
      this.dropSphere();
    };

    this.launchSingleBtn.addEventListener('mousedown', startPlunge);
    window.addEventListener('mouseup', releasePlunge);
    this.launchSingleBtn.addEventListener('touchstart', startPlunge, { passive: true });
    window.addEventListener('touchend', releasePlunge);

    // Burst Drop (x5)
    this.rapidFireBtn.addEventListener('click', () => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => this.dropSphere(), i * 160);
      }
    });

    // Reset / Refill
    this.resetBoardBtn.addEventListener('click', () => {
      this.spheresRemaining = 50;
      this.score = 0;
      this.multiplier = 1;
      this.updateHUD();
      this.showToast('RESERVE REFILLED!');
    });

    // Spacebar control
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        startPlunge();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        releasePlunge();
      }
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.guideBtn.addEventListener('click', () => this.guideModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.guideModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.guideModal.classList.add('hidden'));
  }

  dropSphere() {
    if (this.spheresRemaining <= 0) {
      this.showToast('OUT OF SPHERES! REFILL');
      return;
    }

    this.spheresRemaining--;
    this.updateHUD();

    // Launch from top chute
    const launchSpeed = 8 + this.plungerPower * 12;
    this.spheres.push({
      x: 435,
      y: 520,
      vx: -1.5,
      vy: -launchSpeed,
      r: 6,
      color: '#d946ef'
    });
  }

  showToast(text) {
    this.toastMessage.textContent = text;
    this.toastMessage.classList.remove('hidden');
    setTimeout(() => {
      this.toastMessage.classList.add('hidden');
    }, 1600);
  }

  updateHUD() {
    this.spheresCount.textContent = this.spheresRemaining;
    this.scoreCount.textContent = this.score;
    this.multCount.textContent = `x${this.multiplier}`;
  }

  animate() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  update() {
    // Plunger power oscillation
    if (this.isChargingPlunger) {
      this.plungerPower += 0.03 * this.plungerDir;
      if (this.plungerPower >= 1) {
        this.plungerPower = 1;
        this.plungerDir = -1;
      } else if (this.plungerPower <= 0.1) {
        this.plungerPower = 0.1;
        this.plungerDir = 1;
      }
      this.powerPercent.textContent = `${Math.floor(this.plungerPower * 100)}%`;
      this.plungerFill.style.width = `${Math.floor(this.plungerPower * 100)}%`;
    }

    // Multiplier cooldown
    if (this.multiplierTimer > 0) {
      this.multiplierTimer -= 0.016;
      if (this.multiplierTimer <= 0) {
        this.multiplier = 1;
        this.updateHUD();
      }
    }

    // Vortex pulse
    this.vortex.pulse += 0.05;

    // Sub-stepping continuous swept-collision detection integration
    // Divide physics step into 4 sub-iterations per animation frame for high-speed balls
    const SUB_STEPS = 4;
    const dt = 1 / SUB_STEPS;
    const gravity = 0.28 * dt;

    for (let i = this.spheres.length - 1; i >= 0; i--) {
      const s = this.spheres[i];
      let sphereRemoved = false;

      for (let sub = 0; sub < SUB_STEPS; sub++) {
        const prevX = s.x;
        const prevY = s.y;

        // Apply fractional gravity and sub-step velocity
        s.vy += gravity;

        // Clamp excessive velocity to prevent numerical instability at extreme drop speeds
        const speed = Math.hypot(s.vx, s.vy);
        const maxSpeed = 24;
        if (speed > maxSpeed) {
          s.vx = (s.vx / speed) * maxSpeed;
          s.vy = (s.vy / speed) * maxSpeed;
        }

        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Outer chute guide curve
        if (s.x > 410 && s.y > 60) {
          s.vx *= Math.pow(0.98, dt);
          if (s.y < 90) {
            s.vx = -4 - Math.random() * 2; // Curve over the top arch
          }
        }

        // Walls
        if (s.x < 18 + s.r) {
          s.x = 18 + s.r;
          s.vx = Math.abs(s.vx) * 0.7;
          this.audio.playPinballPing(700);
        } else if (s.x > 440 - s.r) {
          s.x = 440 - s.r;
          s.vx = -Math.abs(s.vx) * 0.7;
          this.audio.playPinballPing(700);
        }

        // Ceiling collision
        if (s.y < 20 + s.r) {
          s.y = 20 + s.r;
          s.vy = Math.abs(s.vy) * 0.7;
          this.audio.playPinballPing(750);
        }

        // Swept-collision detection for Pegs
        const moveX = s.x - prevX;
        const moveY = s.y - prevY;
        const moveDistSq = moveX * moveX + moveY * moveY;

        for (let pIdx = 0; pIdx < this.pegs.length; pIdx++) {
          const p = this.pegs[pIdx];
          const minDistance = s.r + p.r;

          let collided = false;
          let nx = 0;
          let ny = 0;

          if (moveDistSq > 0) {
            const t = Math.max(0, Math.min(1, ((p.x - prevX) * moveX + (p.y - prevY) * moveY) / moveDistSq));
            const closeX = prevX + t * moveX;
            const closeY = prevY + t * moveY;
            const closeDist = Math.hypot(closeX - p.x, closeY - p.y);

            if (closeDist < minDistance) {
              collided = true;
              if (closeDist > 0.001) {
                nx = (closeX - p.x) / closeDist;
                ny = (closeY - p.y) / closeDist;
              } else {
                nx = 0;
                ny = -1;
              }
            }
          } else {
            const dist = Math.hypot(s.x - p.x, s.y - p.y);
            if (dist < minDistance) {
              collided = true;
              nx = dist > 0.001 ? (s.x - p.x) / dist : 0;
              ny = dist > 0.001 ? (s.y - p.y) / dist : -1;
            }
          }

          if (collided) {
            s.x = p.x + nx * (minDistance + 0.2);
            s.y = p.y + ny * (minDistance + 0.2);

            const dot = s.vx * nx + s.vy * ny;
            if (dot < 0) {
              s.vx = (s.vx - 2 * dot * nx) * 0.65 + (Math.random() - 0.5) * 0.5;
              s.vy = (s.vy - 2 * dot * ny) * 0.65;
            }

            p.hitFlash = 1;
            this.score += 10 * this.multiplier;
            this.audio.playPinballPing(1050 + Math.random() * 500);
            this.audio.playPegClick();
            break; // Collision resolved for this sub-step
          }
        }

        // Swept-collision detection for Bumpers
        for (let bIdx = 0; bIdx < this.bumpers.length; bIdx++) {
          const b = this.bumpers[bIdx];
          const minDistance = s.r + b.r;

          let collided = false;
          let nx = 0;
          let ny = 0;

          if (moveDistSq > 0) {
            const t = Math.max(0, Math.min(1, ((b.x - prevX) * moveX + (b.y - prevY) * moveY) / moveDistSq));
            const closeX = prevX + t * moveX;
            const closeY = prevY + t * moveY;
            const closeDist = Math.hypot(closeX - b.x, closeY - b.y);

            if (closeDist < minDistance) {
              collided = true;
              if (closeDist > 0.001) {
                nx = (closeX - b.x) / closeDist;
                ny = (closeY - b.y) / closeDist;
              } else {
                nx = 0;
                ny = -1;
              }
            }
          } else {
            const dist = Math.hypot(s.x - b.x, s.y - b.y);
            if (dist < minDistance) {
              collided = true;
              nx = dist > 0.001 ? (s.x - b.x) / dist : 0;
              ny = dist > 0.001 ? (s.y - b.y) / dist : -1;
            }
          }

          if (collided) {
            s.x = b.x + nx * (minDistance + 1);
            s.y = b.y + ny * (minDistance + 1);
            s.vx = nx * 8;
            s.vy = ny * 8;
            b.hitFlash = 1;
            this.score += b.points * this.multiplier;
            this.audio.playPinballPing(1600);
            this.audio.playBumperBounce();
            break; // Bumper deflection resolved for this sub-step
          }
        }

        // Vortex teleport
        const vDist = Math.hypot(s.x - this.vortex.x, s.y - this.vortex.y);
        if (vDist < this.vortex.r) {
          s.x = 230 + (Math.random() - 0.5) * 60;
          s.y = 80;
          s.vy = 2;
          s.vx = (Math.random() - 0.5) * 3;
          this.audio.playVortexTeleport();
          this.audio.playPinballPing(1900);
          this.multiplier = 2;
          this.multiplierTimer = 10;
          this.updateHUD();
          this.showToast('WARP! x2 MULTIPLIER!');
          break;
        }

        // Bottom Collection Bin Catch
        if (s.y > 580) {
          this.bins.forEach(bin => {
            if (s.x >= bin.x && s.x <= bin.x + bin.w) {
              const gained = 100 * bin.mult * this.multiplier;
              this.score += gained;

              if (bin.isJackpot) {
                this.spheresRemaining += 15;
                this.audio.playJackpot();
                this.showToast('JACKPOT! +15 SPHERES!');
              } else {
                this.showToast(`+${gained} PTS`);
              }
            }
          });
          this.spheres.splice(i, 1);
          this.updateHUD();
          sphereRemoved = true;
          break;
        }
      }

      if (sphereRemoved) continue;
    }
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Cabinet Backplate
    this.ctx.fillStyle = '#060a1d';
    this.ctx.fillRect(0, 0, w, h);

    // Launch Chute Channel on right
    this.ctx.strokeStyle = '#20306b';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(420, 560);
    this.ctx.lineTo(420, 100);
    this.ctx.arc(380, 100, 40, 0, Math.PI, true);
    this.ctx.stroke();

    // Render Bins at bottom
    this.bins.forEach(bin => {
      this.ctx.fillStyle = bin.isJackpot ? 'rgba(217, 70, 239, 0.25)' : 'rgba(30, 41, 59, 0.5)';
      this.ctx.strokeStyle = bin.isJackpot ? '#d946ef' : '#334155';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(bin.x, 560, bin.w, 70);
      this.ctx.strokeRect(bin.x, 560, bin.w, 70);

      this.ctx.fillStyle = bin.isJackpot ? '#d946ef' : '#94a3b8';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(bin.label, bin.x + bin.w / 2, 600);
    });

    // Render Vortex
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.vortex.x, this.vortex.y, this.vortex.r + Math.sin(this.vortex.pulse) * 3, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
    this.ctx.strokeStyle = '#06b6d4';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#06b6d4';
    this.ctx.shadowBlur = 12;
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Render Bumpers
    this.bumpers.forEach(b => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      this.ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : b.color;
      this.ctx.shadowColor = b.color;
      this.ctx.shadowBlur = b.hitFlash > 0 ? 25 : 12;
      this.ctx.fill();
      if (b.hitFlash > 0) b.hitFlash -= 0.1;
      this.ctx.restore();
    });

    // Render Pegs
    this.pegs.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#38bdf8';
      this.ctx.fill();
      if (p.hitFlash > 0) p.hitFlash -= 0.15;
    });

    // Render Spheres
    this.spheres.forEach(s => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      const grad = this.ctx.createRadialGradient(s.x - 2, s.y - 2, 1, s.x, s.y, s.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, s.color);
      grad.addColorStop(1, '#9333ea');
      this.ctx.fillStyle = grad;
      this.ctx.shadowColor = s.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.restore();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new CyberPachinkoGame();

  window.addEventListener('message', (e) => {
    if (!e || !e.data) return;
    if (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE') {
      if (game.audio && game.audio.ctx && typeof game.audio.ctx.suspend === 'function') {
        game.audio.ctx.suspend().catch(() => {});
      }
    }
  });
});
