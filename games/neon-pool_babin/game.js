// Neon Pool DX - Top-Down Billiards Physics & Cue Ball Engine

class PoolAudio {
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

  playCueHit(strength = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18 * strength, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playBallClack(speed = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700 + Math.random() * 300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(Math.min(0.2, 0.05 + speed * 0.02), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  playPocketDrop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
}

// 2D Vector Physics Simulator
class NeonPoolGame {
  constructor() {
    this.canvas = document.getElementById('poolCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new PoolAudio();

    // Table Felt Boundaries
    this.feltX = 40;
    this.feltY = 40;
    this.feltW = 620;
    this.feltH = 340;
    this.ballRadius = 10;

    // Pockets: 4 corners + 2 side centers
    this.pockets = [
      { x: this.feltX + 12, y: this.feltY + 12, r: 18 },
      { x: this.feltX + this.feltW / 2, y: this.feltY + 6, r: 16 },
      { x: this.feltX + this.feltW - 12, y: this.feltY + 12, r: 18 },
      { x: this.feltX + 12, y: this.feltY + this.feltH - 12, r: 18 },
      { x: this.feltX + this.feltW / 2, y: this.feltY + this.feltH - 6, r: 16 },
      { x: this.feltX + this.feltW - 12, y: this.feltY + this.feltH - 12, r: 18 }
    ];

    // Cue ball + 9 object balls
    this.balls = [];
    this.cueBall = null;

    // Shot charging & Aiming state
    this.aimAngle = 0;
    this.power = 0;
    this.isChargingPower = false;
    this.chargeDir = 1;
    this.shotsCount = 0;
    this.pocketedCount = 0;
    this.score = 0;

    this.initDOM();
    this.setupEvents();
    this.rackBalls();

    this.animate();
  }

  initDOM() {
    this.shotsVal = document.getElementById('shotsVal');
    this.pocketedVal = document.getElementById('pocketedVal');
    this.scoreVal = document.getElementById('scoreVal');
    this.powerBar = document.getElementById('powerBar');
    this.toastMessage = document.getElementById('toastMessage');
    this.strikeBtn = document.getElementById('strikeBtn');
    this.resetRackBtn = document.getElementById('resetRackBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.rulesBtn = document.getElementById('rulesBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  rackBalls() {
    this.balls = [];
    this.shotsCount = 0;
    this.pocketedCount = 0;
    this.score = 0;

    // Cue Ball on Left
    this.cueBall = {
      id: 0,
      x: this.feltX + 140,
      y: this.feltY + this.feltH / 2,
      vx: 0,
      vy: 0,
      color: '#ffffff',
      isCue: true,
      pocketed: false
    };
    this.balls.push(this.cueBall);

    // 9 Object Balls in Diamond Rack on Right
    const rackStartX = this.feltX + 460;
    const rackCenterY = this.feltY + this.feltH / 2;
    const colors = [
      '#facc15', '#3b82f6', '#ef4444', '#a855f7',
      '#f97316', '#10b981', '#ec4899', '#06b6d4', '#1e293b'
    ];

    const rackLayout = [
      [{ c: 0, r: 0 }],
      [{ c: 1, r: -0.5 }, { c: 1, r: 0.5 }],
      [{ c: 2, r: -1 }, { c: 2, r: 0 }, { c: 2, r: 1 }],
      [{ c: 3, r: -0.5 }, { c: 3, r: 0.5 }],
      [{ c: 4, r: 0 }]
    ];

    let colorIdx = 0;
    const rDist = this.ballRadius * 2 + 1;
    rackLayout.forEach(rowArr => {
      rowArr.forEach(p => {
        if (colorIdx < 9) {
          this.balls.push({
            id: colorIdx + 1,
            x: rackStartX + p.c * (rDist * 0.866),
            y: rackCenterY + p.r * rDist,
            vx: 0,
            vy: 0,
            color: colors[colorIdx],
            isCue: false,
            pocketed: false
          });
          colorIdx++;
        }
      });
    });

    this.updateHUD();
  }

  setupEvents() {
    this.resetRackBtn.addEventListener('click', () => {
      this.rackBalls();
      this.showToast('TABLE RE-RACKED');
    });

    // Aim via mouse movement
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.areBallsMoving() || !this.cueBall || this.cueBall.pocketed) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      this.aimAngle = Math.atan2(my - this.cueBall.y, mx - this.cueBall.x);
    });

    // Touch aim
    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 0 || this.areBallsMoving() || !this.cueBall || this.cueBall.pocketed) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mx = (e.touches[0].clientX - rect.left) * scaleX;
      const my = (e.touches[0].clientY - rect.top) * scaleY;
      this.aimAngle = Math.atan2(my - this.cueBall.y, mx - this.cueBall.x);
    }, { passive: true });

    // Hold Strike button to charge
    const startCharge = () => {
      if (this.areBallsMoving() || this.cueBall.pocketed) return;
      this.isChargingPower = true;
    };
    const releaseCharge = () => {
      if (!this.isChargingPower) return;
      this.isChargingPower = false;
      this.shootCueBall();
    };

    this.strikeBtn.addEventListener('mousedown', startCharge);
    window.addEventListener('mouseup', releaseCharge);
    this.strikeBtn.addEventListener('touchstart', startCharge, { passive: true });
    window.addEventListener('touchend', releaseCharge);

    // Keyboard Space trigger
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        startCharge();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        releaseCharge();
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
    this.rulesBtn.addEventListener('click', () => this.rulesModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
  }

  shootCueBall() {
    if (!this.cueBall || this.cueBall.pocketed) return;
    const impulse = 3 + this.power * 22;
    this.cueBall.vx = Math.cos(this.aimAngle) * impulse;
    this.cueBall.vy = Math.sin(this.aimAngle) * impulse;
    this.audio.playCueHit(this.power);
    this.shotsCount++;
    this.power = 0;
    this.powerBar.style.width = '0%';
    this.updateHUD();
  }

  areBallsMoving() {
    return this.balls.some(b => !b.pocketed && (Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05));
  }

  showToast(msg) {
    this.toastMessage.textContent = msg;
    this.toastMessage.classList.remove('hidden');
    setTimeout(() => {
      this.toastMessage.classList.add('hidden');
    }, 1800);
  }

  updateHUD() {
    this.shotsVal.textContent = this.shotsCount;
    this.pocketedVal.textContent = `${this.pocketedCount} / 9`;
    this.scoreVal.textContent = this.score;
  }

  animate() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  update() {
    // Power meter oscillation while charging
    if (this.isChargingPower) {
      this.power += 0.03 * this.chargeDir;
      if (this.power >= 1) {
        this.power = 1;
        this.chargeDir = -1;
      } else if (this.power <= 0.1) {
        this.power = 0.1;
        this.chargeDir = 1;
      }
      this.powerBar.style.width = `${Math.floor(this.power * 100)}%`;
    }

    // Ball movement & felt friction
    this.balls.forEach(b => {
      if (b.pocketed) return;

      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.985;
      b.vy *= 0.985;

      if (Math.abs(b.vx) < 0.03) b.vx = 0;
      if (Math.abs(b.vy) < 0.03) b.vy = 0;

      // Cushion rebounds
      const minX = this.feltX + this.ballRadius;
      const maxX = this.feltX + this.feltW - this.ballRadius;
      const minY = this.feltY + this.ballRadius;
      const maxY = this.feltY + this.feltH - this.ballRadius;

      if (b.x < minX) {
        b.x = minX;
        b.vx = -b.vx * 0.88;
        this.audio.playBallClack(Math.abs(b.vx));
      } else if (b.x > maxX) {
        b.x = maxX;
        b.vx = -b.vx * 0.88;
        this.audio.playBallClack(Math.abs(b.vx));
      }

      if (b.y < minY) {
        b.y = minY;
        b.vy = -b.vy * 0.88;
        this.audio.playBallClack(Math.abs(b.vy));
      } else if (b.y > maxY) {
        b.y = maxY;
        b.vy = -b.vy * 0.88;
        this.audio.playBallClack(Math.abs(b.vy));
      }

      // Pocket check
      this.pockets.forEach(p => {
        const dist = Math.hypot(b.x - p.x, b.y - p.y);
        if (dist < p.r) {
          b.pocketed = true;
          b.vx = 0;
          b.vy = 0;
          this.audio.playPocketDrop();

          if (b.isCue) {
            // Scratch!
            this.showToast('SCRATCH! CUE RESPAWN');
            setTimeout(() => {
              this.cueBall.pocketed = false;
              this.cueBall.x = this.feltX + 140;
              this.cueBall.y = this.feltY + this.feltH / 2;
            }, 800);
          } else {
            this.pocketedCount++;
            this.score += 250;
            this.showToast('BALL POCKETED!');
            this.updateHUD();

            if (this.pocketedCount === 9) {
              this.showToast('TABLE CLEARED! PERFECT!');
            }
          }
        }
      });
    });

    // Ball-to-ball elastic collisions
    for (let i = 0; i < this.balls.length; i++) {
      const b1 = this.balls[i];
      if (b1.pocketed) continue;

      for (let j = i + 1; j < this.balls.length; j++) {
        const b2 = this.balls[j];
        if (b2.pocketed) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.ballRadius * 2) {
          // Collision normal
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate overlap
          const overlap = this.ballRadius * 2 - dist;
          b1.x -= nx * (overlap / 2);
          b1.y -= ny * (overlap / 2);
          b2.x += nx * (overlap / 2);
          b2.y += ny * (overlap / 2);

          // Relative velocity
          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          b1.vx -= p * nx;
          b1.vy -= p * ny;
          b2.vx += p * nx;
          b2.vy += p * ny;

          const relSpeed = Math.hypot(b1.vx, b1.vy) + Math.hypot(b2.vx, b2.vy);
          this.audio.playBallClack(relSpeed);
        }
      }
    }
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Table Rail Wooden/Cyber Border
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(10, 10, w - 20, h - 20);

    // Synthwave Felt Table Bed
    const feltGrad = this.ctx.createLinearGradient(this.feltX, this.feltY, this.feltX + this.feltW, this.feltY + this.feltH);
    feltGrad.addColorStop(0, '#064e3b');
    feltGrad.addColorStop(1, '#022c22');
    this.ctx.fillStyle = feltGrad;
    this.ctx.fillRect(this.feltX, this.feltY, this.feltW, this.feltH);

    // Neon table edge glow
    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#10b981';
    this.ctx.shadowBlur = 10;
    this.ctx.strokeRect(this.feltX, this.feltY, this.feltW, this.feltH);
    this.ctx.shadowBlur = 0;

    // Headstring line & kitchen spot
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.feltX + 160, this.feltY);
    this.ctx.lineTo(this.feltX + 160, this.feltY + this.feltH);
    this.ctx.stroke();

    // Render Pockets
    this.pockets.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = '#020617';
      this.ctx.shadowColor = '#064e3b';
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#334155';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });

    // Cue Stick Aim Line
    if (!this.areBallsMoving() && this.cueBall && !this.cueBall.pocketed) {
      this.ctx.save();
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([6, 6]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.cueBall.x, this.cueBall.y);
      this.ctx.lineTo(
        this.cueBall.x + Math.cos(this.aimAngle) * 350,
        this.cueBall.y + Math.sin(this.aimAngle) * 350
      );
      this.ctx.stroke();

      // Cue Stick Graphic Behind Ball
      const cueOffset = 25 + this.power * 25;
      const cueStartX = this.cueBall.x - Math.cos(this.aimAngle) * cueOffset;
      const cueStartY = this.cueBall.y - Math.sin(this.aimAngle) * cueOffset;
      const cueEndX = this.cueBall.x - Math.cos(this.aimAngle) * (cueOffset + 180);
      const cueEndY = this.cueBall.y - Math.sin(this.aimAngle) * (cueOffset + 180);

      this.ctx.setLineDash([]);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 4;
      this.ctx.shadowColor = '#f59e0b';
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(cueStartX, cueStartY);
      this.ctx.lineTo(cueEndX, cueEndY);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Render Balls
    this.balls.forEach(b => {
      if (b.pocketed) return;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, this.ballRadius, 0, Math.PI * 2);

      const grad = this.ctx.createRadialGradient(
        b.x - 3, b.y - 3, 2,
        b.x, b.y, this.ballRadius
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, b.color);
      grad.addColorStop(1, '#000000');
      this.ctx.fillStyle = grad;
      this.ctx.shadowColor = b.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fill();

      // Ball Number text for object balls
      if (!b.isCue) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 8px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(b.id, b.x, b.y);
      }
      this.ctx.restore();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new NeonPoolGame();
});
