// Cyber Curling - Kinetic Ice Shuffleboard Friction Engine

class CurlingAudio {
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

  playStoneGlide() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playSweep() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playStoneClack(speed = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(Math.min(0.2, 0.05 + speed * 0.03), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }
}

class CyberCurlingGame {
  constructor() {
    this.canvas = document.getElementById('curlingCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new CurlingAudio();

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Rink Sheet & House Target (Top of sheet)
    this.house = {
      x: 230,
      y: 130,
      rButton: 16,  // 500 Pts
      rFourFoot: 48, // 300 Pts
      rEightFoot: 80 // 150 Pts
    };

    // Stones on the ice
    this.stones = [];
    this.currentEnd = 1; // 1 to 4 ends
    this.maxEnds = 4;
    this.stonesPerEnd = 4; // 2 player + 2 AI
    this.stonesDeliveredThisEnd = 0;

    this.playerScore = 0;
    this.aiScore = 0;

    // Delivery Controls
    this.isPlayerTurn = true;
    this.isStoneMoving = false;
    this.aimX = 230;
    this.power = 0.5;
    this.powerDir = 1;
    this.isCharging = false;
    this.sweeping = false;

    this.initDOM();
    this.setupEvents();
    this.startNewEnd();

    this.animate();
  }

  initDOM() {
    this.endVal = document.getElementById('endVal');
    this.playerScoreVal = document.getElementById('playerScoreVal');
    this.aiScoreVal = document.getElementById('aiScoreVal');
    this.stonesLeftVal = document.getElementById('stonesLeftVal');
    this.forceFill = document.getElementById('forceFill');
    this.toastMessage = document.getElementById('toastMessage');

    this.sweepBtn = document.getElementById('sweepBtn');
    this.launchStoneBtn = document.getElementById('launchStoneBtn');
    this.resetMatchBtn = document.getElementById('resetMatchBtn');

    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.rulesBtn = document.getElementById('rulesBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  startNewEnd() {
    this.stones = [];
    this.stonesDeliveredThisEnd = 0;
    this.isPlayerTurn = true;
    this.isStoneMoving = false;
    this.aimX = 230;
    this.updateHUD();
    this.showToast(`END ${this.currentEnd} OF ${this.maxEnds}`);
  }

  setupEvents() {
    // Aim line following mouse / touch on lower hack
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isStoneMoving || !this.isPlayerTurn) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.aimX = Math.max(80, Math.min(380, (e.clientX - rect.left) * scaleX));
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isStoneMoving || !this.isPlayerTurn || e.touches.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.aimX = Math.max(80, Math.min(380, (e.touches[0].clientX - rect.left) * scaleX));
    }, { passive: true });

    // Delivery Button / Charging
    const startCharge = () => {
      if (this.isStoneMoving || !this.isPlayerTurn) return;
      this.isCharging = true;
    };
    const releaseCharge = () => {
      if (!this.isCharging) return;
      this.isCharging = false;
      this.deliverPlayerStone();
    };

    this.launchStoneBtn.addEventListener('mousedown', startCharge);
    window.addEventListener('mouseup', releaseCharge);
    this.launchStoneBtn.addEventListener('touchstart', startCharge, { passive: true });
    window.addEventListener('touchend', releaseCharge);

    // Sweeping Trigger (Tapping sweeps ice)
    const doSweep = () => {
      if (!this.isStoneMoving) return;
      this.sweeping = true;
      this.audio.playSweep();
      setTimeout(() => { this.sweeping = false; }, 200);
    };

    this.sweepBtn.addEventListener('click', doSweep);
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (this.isStoneMoving) doSweep();
        else startCharge();
      }
    });
    window.addEventListener('keyup', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !this.isStoneMoving) {
        releaseCharge();
      }
    });

    this.resetMatchBtn.addEventListener('click', () => {
      this.currentEnd = 1;
      this.playerScore = 0;
      this.aiScore = 0;
      this.startNewEnd();
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

  deliverPlayerStone() {
    this.isStoneMoving = true;
    const speed = 9 + this.power * 8;
    const angle = Math.atan2(this.house.y - 580, this.aimX - 230);

    this.stones.push({
      x: 230,
      y: 580,
      vx: Math.cos(angle) * (speed * 0.4),
      vy: -speed,
      r: 13,
      isPlayer: true,
      color: '#06b6d4',
      settled: false
    });

    this.stonesDeliveredThisEnd++;
    this.audio.playStoneGlide();
    this.power = 0;
    this.forceFill.style.width = '0%';
    this.updateHUD();
  }

  deliverAiStone() {
    this.isStoneMoving = true;
    this.showToast('AI DELIVERING STONE...');

    setTimeout(() => {
      // AI aims near center with slight variance
      const targetX = this.house.x + (Math.random() - 0.5) * 50;
      const targetY = this.house.y + (Math.random() - 0.5) * 40;
      const speed = 11.5 + (Math.random() - 0.5) * 2;
      const angle = Math.atan2(targetY - 580, targetX - 230);

      this.stones.push({
        x: 230,
        y: 580,
        vx: Math.cos(angle) * (speed * 0.35),
        vy: -speed,
        r: 13,
        isPlayer: false,
        color: '#f59e0b',
        settled: false
      });

      this.stonesDeliveredThisEnd++;
      this.audio.playStoneGlide();
      this.updateHUD();
    }, 800);
  }

  showToast(text) {
    this.toastMessage.textContent = text;
    this.toastMessage.classList.remove('hidden');
    setTimeout(() => {
      this.toastMessage.classList.add('hidden');
    }, 1800);
  }

  updateHUD() {
    this.endVal.textContent = `${this.currentEnd} / ${this.maxEnds}`;
    this.playerScoreVal.textContent = this.playerScore;
    this.aiScoreVal.textContent = this.aiScore;
    const remaining = this.stonesPerEnd - this.stonesDeliveredThisEnd;
    this.stonesLeftVal.textContent = `${remaining} / ${this.stonesPerEnd}`;
  }

  animate() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  update() {
    // Power sweep while charging
    if (this.isCharging) {
      this.power += 0.03 * this.powerDir;
      if (this.power >= 1) {
        this.power = 1;
        this.powerDir = -1;
      } else if (this.power <= 0.1) {
        this.power = 0.1;
        this.powerDir = 1;
      }
      this.forceFill.style.width = `${Math.floor(this.power * 100)}%`;
    }

    // Move Stones
    let anyMoving = false;
    this.stones.forEach(s => {
      if (s.settled) return;

      // Friction: normal 0.985, sweeping reduces friction to 0.995 (longer glide!)
      let friction = (this.sweeping && s.isPlayer) ? 0.994 : 0.984;

      s.x += s.vx;
      s.y += s.vy;
      s.vx *= friction;
      s.vy *= friction;

      if (Math.abs(s.vx) < 0.04 && Math.abs(s.vy) < 0.04) {
        s.vx = 0;
        s.vy = 0;
        s.settled = true;
      } else {
        anyMoving = true;
      }

      // Sheet boundary cushions
      if (s.x - s.r < 40) {
        s.x = 40 + s.r;
        s.vx = -s.vx * 0.7;
        this.audio.playStoneClack(Math.abs(s.vx));
      } else if (s.x + s.r > this.width - 40) {
        s.x = this.width - 40 - s.r;
        s.vx = -s.vx * 0.7;
        this.audio.playStoneClack(Math.abs(s.vx));
      }

      // Backboard boundary
      if (s.y - s.r < 40) {
        s.y = 40 + s.r;
        s.vy = -s.vy * 0.5;
      }
    });

    // Stone-to-stone collisions
    for (let i = 0; i < this.stones.length; i++) {
      const s1 = this.stones[i];
      for (let j = i + 1; j < this.stones.length; j++) {
        const s2 = this.stones[j];
        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < s1.r + s2.r) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = s1.r + s2.r - dist;

          s1.x -= nx * (overlap / 2);
          s1.y -= ny * (overlap / 2);
          s2.x += nx * (overlap / 2);
          s2.y += ny * (overlap / 2);

          const kx = s1.vx - s2.vx;
          const ky = s1.vy - s2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          s1.vx -= p * nx;
          s1.vy -= p * ny;
          s2.vx += p * nx;
          s2.vy += p * ny;

          s1.settled = false;
          s2.settled = false;

          const rel = Math.hypot(s1.vx, s1.vy) + Math.hypot(s2.vx, s2.vy);
          this.audio.playStoneClack(rel);
        }
      }
    }

    // Turn transition when all stones stop
    if (this.isStoneMoving && !anyMoving) {
      this.isStoneMoving = false;

      if (this.stonesDeliveredThisEnd < this.stonesPerEnd) {
        this.isPlayerTurn = !this.isPlayerTurn;
        if (!this.isPlayerTurn) {
          this.deliverAiStone();
        }
      } else {
        // End Complete: Score the house
        this.scoreEnd();
      }
    }
  }

  scoreEnd() {
    let pEndScore = 0;
    let aiEndScore = 0;

    this.stones.forEach(s => {
      const d = Math.hypot(s.x - this.house.x, s.y - this.house.y);
      if (d <= this.house.rEightFoot) {
        let pts = 150;
        if (d <= this.house.rFourFoot) pts = 300;
        if (d <= this.house.rButton) pts = 500;

        if (s.isPlayer) pEndScore += pts;
        else aiEndScore += pts;
      }
    });

    this.playerScore += pEndScore;
    this.aiScore += aiEndScore;
    this.updateHUD();

    if (pEndScore > aiEndScore) this.showToast(`YOU WON END: +${pEndScore} PTS`);
    else if (aiEndScore > pEndScore) this.showToast(`AI WON END: +${aiEndScore} PTS`);
    else this.showToast('TIED END!');

    setTimeout(() => {
      if (this.currentEnd < this.maxEnds) {
        this.currentEnd++;
        this.startNewEnd();
      } else {
        const winner = this.playerScore > this.aiScore ? 'YOU WIN THE MATCH!' : 'AI WINS THE MATCH!';
        alert(`Match Complete!\n${winner}\nFinal Score - You: ${this.playerScore} | AI: ${this.aiScore}`);
      }
    }, 2200);
  }

  render() {
    const w = this.width;
    const h = this.height;
    this.ctx.clearRect(0, 0, w, h);

    // Ice Rink Sheet
    this.ctx.fillStyle = '#06132b';
    this.ctx.fillRect(30, 20, w - 60, h - 40);

    // Glowing Neon Side Rails
    this.ctx.strokeStyle = '#06b6d4';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#06b6d4';
    this.ctx.shadowBlur = 10;
    this.ctx.strokeRect(30, 20, w - 60, h - 40);
    this.ctx.shadowBlur = 0;

    // Center Sheet T-Line & Hog Lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, 20);
    this.ctx.lineTo(w / 2, h - 20);
    this.ctx.moveTo(30, this.house.y);
    this.ctx.lineTo(w - 30, this.house.y);
    this.ctx.moveTo(30, 480); // Hog line
    this.ctx.lineTo(w - 30, 480);
    this.ctx.stroke();

    // Render Scoring House Rings
    // 8-Foot Outer Blue Ring
    this.ctx.beginPath();
    this.ctx.arc(this.house.x, this.house.y, this.house.rEightFoot, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(37, 99, 235, 0.35)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.stroke();

    // 4-Foot White Ring
    this.ctx.beginPath();
    this.ctx.arc(this.house.x, this.house.y, this.house.rFourFoot, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fill();

    // Center Button (Red / Magenta)
    this.ctx.beginPath();
    this.ctx.arc(this.house.x, this.house.y, this.house.rButton, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ec4899';
    this.ctx.shadowColor = '#ec4899';
    this.ctx.shadowBlur = 12;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Delivery Aim Line
    if (this.isPlayerTurn && !this.isStoneMoving) {
      this.ctx.save();
      this.ctx.strokeStyle = '#06b6d4';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 6]);
      this.ctx.beginPath();
      this.ctx.moveTo(230, 580);
      this.ctx.lineTo(this.aimX, this.house.y);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Sweeping Frost Particles when sweeping
    if (this.sweeping) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let i = 0; i < 15; i++) {
        this.ctx.fillRect(
          this.house.x + (Math.random() - 0.5) * 80,
          250 + Math.random() * 200,
          2, 2
        );
      }
    }

    // Render Stones
    this.stones.forEach(s => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);

      const grad = this.ctx.createRadialGradient(s.x - 3, s.y - 3, 2, s.x, s.y, s.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, s.color);
      grad.addColorStop(1, '#0f172a');
      this.ctx.fillStyle = grad;
      this.ctx.shadowColor = s.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();

      // Stone Handle
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(s.x - 5, s.y);
      this.ctx.lineTo(s.x + 5, s.y);
      this.ctx.stroke();
      this.ctx.restore();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CyberCurlingGame();
});
