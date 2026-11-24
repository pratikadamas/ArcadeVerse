// Neon Bowling DX - Authentic 10-Frame Top-Down 2D Physics Bowling Engine

class BowlingAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastCrashTime = 0;
    this.activeCrashVoices = 0;
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

  playRoll() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 1.2);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  }

  playPinCrash(count = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastCrashTime < 35) return;
    if (this.activeCrashVoices >= 4) return;
    this.lastCrashTime = nowMs;

    const now = this.ctx.currentTime;
    const voicesToPlay = Math.min(count, 3);
    for (let i = 0; i < voicesToPlay; i++) {
      this.activeCrashVoices++;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + Math.random() * 600, now + i * 0.03);
      gain.gain.setValueAtTime(0.15, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.16);
      osc.onended = () => {
        this.activeCrashVoices = Math.max(0, this.activeCrashVoices - 1);
      };
    }
  }

  playStrikeCheer() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.15, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.35);
    });
  }
}

// 10-Frame Bowling Score Engine
class BowlingScoreEngine {
  constructor() {
    this.frames = [];
    this.currentFrameIdx = 0; // 0 to 9
    this.currentRollIdx = 0;  // 0, 1, or 2 (in 10th frame)
    this.rolls = [];
    this.initFrames();
  }

  initFrames() {
    this.frames = Array(10).fill(null).map((_, i) => ({
      frameNum: i + 1,
      rolls: [],
      score: null,
      isStrike: false,
      isSpare: false
    }));
    this.currentFrameIdx = 0;
    this.currentRollIdx = 0;
    this.rolls = [];
  }

  recordRoll(pinsKnocked) {
    this.rolls.push(pinsKnocked);
    const curr = this.frames[this.currentFrameIdx];
    curr.rolls.push(pinsKnocked);

    if (this.currentFrameIdx < 9) {
      if (curr.rolls.length === 1 && pinsKnocked === 10) {
        curr.isStrike = true;
        this.currentFrameIdx++;
        this.currentRollIdx = 0;
      } else if (curr.rolls.length === 2) {
        if (curr.rolls[0] + curr.rolls[1] === 10) {
          curr.isSpare = true;
        }
        this.currentFrameIdx++;
        this.currentRollIdx = 0;
      } else {
        this.currentRollIdx = 1;
      }
    } else {
      // 10th Frame
      if (curr.rolls.length === 1) {
        if (pinsKnocked === 10) curr.isStrike = true;
        this.currentRollIdx = 1;
      } else if (curr.rolls.length === 2) {
        if (curr.rolls[0] + curr.rolls[1] === 10) curr.isSpare = true;
        if (curr.rolls[0] === 10 || curr.rolls[0] + curr.rolls[1] >= 10) {
          this.currentRollIdx = 2; // Earned bonus 3rd ball
        } else {
          this.currentRollIdx = 2; // Finished
        }
      } else {
        this.currentRollIdx = 3; // Game Over
      }
    }

    this.computeScores();
  }

  computeScores() {
    let rollIdx = 0;
    let runningTotal = 0;

    for (let f = 0; f < 10; f++) {
      if (rollIdx >= this.rolls.length) break;

      if (f < 9) {
        // Regular frame
        if (this.rolls[rollIdx] === 10) {
          // Strike
          if (rollIdx + 2 < this.rolls.length) {
            runningTotal += 10 + this.rolls[rollIdx + 1] + this.rolls[rollIdx + 2];
            this.frames[f].score = runningTotal;
          }
          rollIdx += 1;
        } else if (rollIdx + 1 < this.rolls.length && this.rolls[rollIdx] + this.rolls[rollIdx + 1] === 10) {
          // Spare
          if (rollIdx + 2 < this.rolls.length) {
            runningTotal += 10 + this.rolls[rollIdx + 2];
            this.frames[f].score = runningTotal;
          }
          rollIdx += 2;
        } else if (rollIdx + 1 < this.rolls.length) {
          // Open Frame
          runningTotal += this.rolls[rollIdx] + this.rolls[rollIdx + 1];
          this.frames[f].score = runningTotal;
          rollIdx += 2;
        } else {
          break;
        }
      } else {
        // 10th Frame
        const f10Rolls = this.frames[9].rolls;
        if (f10Rolls.length === 2 && f10Rolls[0] + f10Rolls[1] < 10) {
          runningTotal += f10Rolls[0] + f10Rolls[1];
          this.frames[9].score = runningTotal;
        } else if (f10Rolls.length === 3) {
          runningTotal += f10Rolls[0] + f10Rolls[1] + f10Rolls[2];
          this.frames[9].score = runningTotal;
        }
      }
    }
  }

  isGameOver() {
    if (this.currentFrameIdx < 9) return false;
    const f10 = this.frames[9].rolls;
    if (f10.length === 2 && f10[0] + f10[1] < 10) return true;
    if (f10.length >= 3) return true;
    return false;
  }

  getTotalScore() {
    let lastKnown = 0;
    for (let f = 0; f < 10; f++) {
      if (this.frames[f].score !== null) lastKnown = this.frames[f].score;
    }
    return lastKnown;
  }
}

// 2D Pin and Ball Vector Simulation
class NeonBowlingGame {
  constructor() {
    this.canvas = document.getElementById('alleyCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new BowlingAudio();
    this.scoreEngine = new BowlingScoreEngine();

    // Lane Dimensions
    this.laneLeft = 70;
    this.laneRight = 410;
    this.laneTop = 80;
    this.laneBottom = 660;

    // Ball state
    this.ball = {
      x: 240,
      y: 600,
      vx: 0,
      vy: 0,
      radius: 16,
      spin: 0,
      active: false
    };

    // Approach and Aiming Controls
    this.aimAngle = 0; // -0.25 to 0.25 radians
    this.aimSweepSpeed = 0.035;
    this.aimSweepDir = 1;
    this.power = 0.5;
    this.powerSweepSpeed = 0.03;
    this.powerSweepDir = 1;
    this.state = 'AIMING'; // 'AIMING', 'POWER', 'ROLLING', 'RESOLVING', 'GAMEOVER'

    // Pins: 10 pins in triangle
    this.pins = [];
    this.initPinFormation();
    this.resolveTimer = null;
    this.rafId = null;

    this.initDOM();
    this.setupEvents();
    this.updateScorecardUI();

    this.lastTime = performance.now();
    this.animate();
  }

  initPinFormation() {
    this.pins = [];
    const pinStartX = 240;
    const pinStartY = 130;
    const rowSpacing = 28;
    const colSpacing = 28;

    const layout = [
      [{ col: 0, row: 0 }],                                    // Pin 1
      [{ col: -0.5, row: 1 }, { col: 0.5, row: 1 }],           // Pins 2, 3
      [{ col: -1, row: 2 }, { col: 0, row: 2 }, { col: 1, row: 2 }], // Pins 4, 5, 6
      [{ col: -1.5, row: 3 }, { col: -0.5, row: 3 }, { col: 0.5, row: 3 }, { col: 1.5, row: 3 }] // Pins 7, 8, 9, 10
    ];

    layout.forEach((rowArr) => {
      rowArr.forEach(p => {
        this.pins.push({
          x: pinStartX + p.col * colSpacing,
          y: pinStartY + p.row * rowSpacing,
          vx: 0,
          vy: 0,
          radius: 9,
          standing: true,
          knockedDown: false,
          opacity: 1
        });
      });
    });
  }

  initDOM() {
    this.frameDisplay = document.getElementById('frameDisplay');
    this.ballDisplay = document.getElementById('ballDisplay');
    this.totalScoreDisplay = document.getElementById('totalScoreDisplay');
    this.powerFill = document.getElementById('powerFill');
    this.spinSlider = document.getElementById('spinSlider');
    this.spinVal = document.getElementById('spinVal');
    this.launchBtn = document.getElementById('launchBtn');
    this.launchBtnText = document.getElementById('launchBtnText');
    this.moveLeftBtn = document.getElementById('moveLeftBtn');
    this.moveRightBtn = document.getElementById('moveRightBtn');
    this.resetAlleyBtn = document.getElementById('resetAlleyBtn');
    this.toastBanner = document.getElementById('toastBanner');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.howToPlayBtn = document.getElementById('howToPlayBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.gotItBtn = document.getElementById('gotItBtn');
  }

  setupEvents() {
    this.spinSlider.addEventListener('input', (e) => {
      this.spinVal.textContent = e.target.value;
      this.ball.spin = parseFloat(e.target.value) * 0.08;
    });

    this.moveLeftBtn.addEventListener('click', () => {
      if (this.state === 'AIMING' || this.state === 'POWER') {
        this.ball.x = Math.max(this.laneLeft + 30, this.ball.x - 15);
      }
    });

    this.moveRightBtn.addEventListener('click', () => {
      if (this.state === 'AIMING' || this.state === 'POWER') {
        this.ball.x = Math.min(this.laneRight - 30, this.ball.x + 15);
      }
    });

    this.launchBtn.addEventListener('click', () => this.handleActionStep());

    this.resetAlleyBtn.addEventListener('click', () => {
      if (this.resolveTimer) {
        clearTimeout(this.resolveTimer);
        this.resolveTimer = null;
      }
      this.scoreEngine.initFrames();
      this.resetBall();
      this.initPinFormation();
      this.state = 'AIMING';
      this.launchBtnText.textContent = 'LOCK & ROLL';
      this.updateScorecardUI();
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.howToPlayBtn.addEventListener('click', () => this.rulesModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
    this.gotItBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        if (this.state === 'AIMING' || this.state === 'POWER') {
          this.ball.x = Math.max(this.laneLeft + 30, this.ball.x - 12);
        }
      } else if (e.key === 'ArrowRight') {
        if (this.state === 'AIMING' || this.state === 'POWER') {
          this.ball.x = Math.min(this.laneRight - 30, this.ball.x + 12);
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.handleActionStep();
      }
    });

    // Mouse / Touch Drag approach position
    let isDragging = false;
    const startDrag = (clientX) => {
      if (this.state !== 'AIMING' && this.state !== 'POWER') return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const x = (clientX - rect.left) * scaleX;
      if (Math.abs(x - this.ball.x) < 40) isDragging = true;
    };
    const moveDrag = (clientX) => {
      if (!isDragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const x = (clientX - rect.left) * scaleX;
      this.ball.x = Math.max(this.laneLeft + 25, Math.min(this.laneRight - 25, x));
    };
    const endDrag = () => { isDragging = false; };

    this.canvas.addEventListener('mousedown', (e) => startDrag(e.clientX));
    window.addEventListener('mousemove', (e) => moveDrag(e.clientX));
    window.addEventListener('mouseup', endDrag);

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) startDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) moveDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', endDrag);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.resolveTimer) {
        // Paused in background
      }
    });

    window.addEventListener('message', (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      const type = event.data.type;
      if (type === 'ARCADEVERSE_PAUSE') {
        if (this.state === 'ROLLING' || this.state === 'AIMING' || this.state === 'POWER') {
          this.savedState = this.state;
          this.state = 'PAUSED';
        }
      } else if (type === 'ARCADEVERSE_RESUME') {
        if (this.state === 'PAUSED') {
          this.state = this.savedState || 'AIMING';
        }
      } else if (type === 'ARCADEVERSE_TEARDOWN') {
        if (this.resolveTimer) {
          clearTimeout(this.resolveTimer);
          this.resolveTimer = null;
        }
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.audio && this.audio.ctx) {
          try { this.audio.ctx.close(); } catch (_) {}
        }
      }
    });
  }

  handleActionStep() {
    if (this.state === 'AIMING') {
      this.state = 'POWER';
      this.launchBtnText.textContent = 'RELEASE BALL!';
    } else if (this.state === 'POWER') {
      this.state = 'ROLLING';
      this.launchBtnText.textContent = 'ROLLING...';

      // Ball Velocity
      const speed = 11 + this.power * 10;
      this.ball.vx = Math.sin(this.aimAngle) * speed;
      this.ball.vy = -Math.cos(this.aimAngle) * speed;
      this.ball.active = true;
      this.audio.playRoll();
    }
  }

  resetBall() {
    this.ball.x = 240;
    this.ball.y = 600;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.active = false;
    this.aimAngle = 0;
    this.state = 'AIMING';
    this.launchBtnText.textContent = 'LOCK & ROLL';
  }

  showToast(text) {
    this.toastBanner.textContent = text;
    this.toastBanner.classList.remove('hidden');
    setTimeout(() => {
      this.toastBanner.classList.add('hidden');
    }, 1800);
  }

  updateScorecardUI() {
    this.frameDisplay.textContent = `${this.scoreEngine.currentFrameIdx + 1} / 10`;
    this.ballDisplay.textContent = `${this.scoreEngine.currentRollIdx + 1} / ${this.scoreEngine.currentFrameIdx === 9 ? 3 : 2}`;
    this.totalScoreDisplay.textContent = this.scoreEngine.getTotalScore();

    // Update each frame card
    const frameCards = document.querySelectorAll('.frame-card');
    frameCards.forEach((card, idx) => {
      card.classList.toggle('active-frame', idx === this.scoreEngine.currentFrameIdx);
      const fData = this.scoreEngine.frames[idx];
      const r1Span = card.querySelector('.roll.r1');
      const r2Span = card.querySelector('.roll.r2');
      const r3Span = card.querySelector('.roll.r3');
      const scoreDiv = card.querySelector('.frame-score');

      if (idx < 9) {
        if (fData.rolls.length > 0) {
          if (fData.isStrike) {
            r1Span.textContent = '';
            r2Span.textContent = 'X';
          } else {
            r1Span.textContent = fData.rolls[0];
            if (fData.rolls.length > 1) {
              r2Span.textContent = fData.isSpare ? '/' : fData.rolls[1];
            } else {
              r2Span.textContent = '-';
            }
          }
        } else {
          r1Span.textContent = '-';
          r2Span.textContent = '-';
        }
      } else {
        // 10th frame
        if (fData.rolls.length > 0) {
          r1Span.textContent = fData.rolls[0] === 10 ? 'X' : fData.rolls[0];
          if (fData.rolls.length > 1) {
            if (fData.rolls[1] === 10) r2Span.textContent = 'X';
            else if (fData.rolls[0] + fData.rolls[1] === 10) r2Span.textContent = '/';
            else r2Span.textContent = fData.rolls[1];
          }
          if (fData.rolls.length > 2 && r3Span) {
            r3Span.textContent = fData.rolls[2] === 10 ? 'X' : fData.rolls[2];
          }
        }
      }

      scoreDiv.textContent = fData.score !== null ? fData.score : '-';
    });
  }

  animate(timestamp = performance.now()) {
    const deltaMs = Math.min(100, timestamp - this.lastTime);
    this.lastTime = timestamp;
    const dt = deltaMs / 16.667;

    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame((ts) => this.animate(ts));
  }

  update(dt = 1) {
    if (this.state === 'PAUSED') return;

    // Oscillate Aim Line
    if (this.state === 'AIMING') {
      this.aimAngle += this.aimSweepSpeed * this.aimSweepDir * dt;
      if (this.aimAngle > 0.28) {
        this.aimAngle = 0.28;
        this.aimSweepDir = -1;
      } else if (this.aimAngle < -0.28) {
        this.aimAngle = -0.28;
        this.aimSweepDir = 1;
      }
    }

    // Oscillate Power Gauge
    if (this.state === 'POWER') {
      this.power += this.powerSweepSpeed * this.powerSweepDir * dt;
      if (this.power > 1) {
        this.power = 1;
        this.powerSweepDir = -1;
      } else if (this.power < 0.15) {
        this.power = 0.15;
        this.powerSweepDir = 1;
      }
      this.powerFill.style.width = `${Math.floor(this.power * 100)}%`;
    }

    // Ball Rolling Physics
    if (this.state === 'ROLLING' && this.ball.active) {
      // Apply oil pattern spin hook
      this.ball.vx += this.ball.spin * dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      // Gutter detection
      if (this.ball.x - this.ball.radius < this.laneLeft) {
        this.ball.x = this.laneLeft - 5;
        this.ball.vx = 0; // Gutter ball
      } else if (this.ball.x + this.ball.radius > this.laneRight) {
        this.ball.x = this.laneRight + 5;
        this.ball.vx = 0;
      }

      // Ball to pin collisions
      let hitCount = 0;
      this.pins.forEach(pin => {
        if (!pin.standing) return;
        const dist = Math.hypot(this.ball.x - pin.x, this.ball.y - pin.y);
        if (dist < this.ball.radius + pin.radius) {
          pin.standing = false;
          pin.knockedDown = true;
          const angle = Math.atan2(pin.y - this.ball.y, pin.x - this.ball.x);
          pin.vx = Math.cos(angle) * (6 + Math.random() * 6);
          pin.vy = Math.sin(angle) * (6 + Math.random() * 6);
          hitCount++;
        }
      });

      if (hitCount > 0) {
        this.audio.playPinCrash(hitCount);
      }

      // End of alley reached
      if (this.ball.y < this.laneTop - 30) {
        this.ball.active = false;
        this.resolveRoll();
      }
    }

    // Pin-to-pin chain reactions
    this.pins.forEach(pin => {
      if (pin.knockedDown) {
        pin.x += pin.vx * dt;
        pin.y += pin.vy * dt;
        pin.vx *= Math.pow(0.92, dt);
        pin.vy *= Math.pow(0.92, dt);

        this.pins.forEach(other => {
          if (other !== pin && other.standing) {
            const dist = Math.hypot(pin.x - other.x, pin.y - other.y);
            if (dist < pin.radius + other.radius + 3) {
              other.standing = false;
              other.knockedDown = true;
              other.vx = pin.vx * 0.75 + (Math.random() - 0.5) * 4;
              other.vy = pin.vy * 0.75 + (Math.random() - 0.5) * 4;
              this.audio.playPinCrash(1);
            }
          }
        });
      }
    });
  }

  resolveRoll() {
    this.state = 'RESOLVING';
    if (this.resolveTimer) clearTimeout(this.resolveTimer);

    this.resolveTimer = setTimeout(() => {
      this.resolveTimer = null;
      const pinsDownThisRoll = this.pins.filter(p => !p.standing).length;
      const prevPinsDown = this.scoreEngine.frames[this.scoreEngine.currentFrameIdx].rolls.reduce((a, b) => a + b, 0);
      const newlyKnocked = pinsDownThisRoll - (this.scoreEngine.currentRollIdx > 0 ? prevPinsDown : 0);

      this.scoreEngine.recordRoll(newlyKnocked);
      this.updateScorecardUI();

      // Emit score update telemetry
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'ARCADEVERSE_GAME_SCORE',
            score: this.scoreEngine.getTotalScore(),
            frame: this.scoreEngine.currentFrameIdx + 1
          }, '*');
        }
      } catch (_) {}

      // Celebration sound
      if (newlyKnocked === 10 && this.scoreEngine.currentRollIdx === 0) {
        this.audio.playStrikeCheer();
        this.showToast('STRIKE!');
      } else if (pinsDownThisRoll === 10 && this.scoreEngine.currentRollIdx === 1) {
        this.showToast('SPARE!');
      }

      if (this.scoreEngine.isGameOver()) {
        this.state = 'GAMEOVER';
        this.launchBtnText.textContent = 'MATCH COMPLETE';
        this.showToast(`FINAL: ${this.scoreEngine.getTotalScore()}`);
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'ARCADEVERSE_GAME_OVER',
              score: this.scoreEngine.getTotalScore(),
              details: {
                totalScore: this.scoreEngine.getTotalScore(),
                frames: this.scoreEngine.frames
              }
            }, '*');
          }
        } catch (_) {}
      } else {
        // Next roll setup
        if (this.scoreEngine.currentRollIdx === 0) {
          // Fresh frame
          this.initPinFormation();
        } else {
          // Clean up fallen pins for second ball
          this.pins = this.pins.filter(p => p.standing);
        }
        this.resetBall();
      }
    }, 900);
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Dark Alley Floor
    this.ctx.fillStyle = '#060919';
    this.ctx.fillRect(0, 0, w, h);

    // Gutters
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(this.laneLeft - 30, this.laneTop, 30, this.laneBottom - this.laneTop);
    this.ctx.fillRect(this.laneRight, this.laneTop, 30, this.laneBottom - this.laneTop);

    // Hardwood Maple Lane with Neon Synthwave Hue
    const grad = this.ctx.createLinearGradient(this.laneLeft, 0, this.laneRight, 0);
    grad.addColorStop(0, '#11183c');
    grad.addColorStop(0.5, '#17204d');
    grad.addColorStop(1, '#11183c');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(this.laneLeft, this.laneTop, this.laneRight - this.laneLeft, this.laneBottom - this.laneTop);

    // Lane Board Stripes & Range Arrows
    this.ctx.strokeStyle = '#202b5e';
    this.ctx.lineWidth = 1;
    for (let x = this.laneLeft + 20; x < this.laneRight; x += 20) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.laneTop);
      this.ctx.lineTo(x, this.laneBottom);
      this.ctx.stroke();
    }

    // Range Marker Chevrons
    const chevronY = 440;
    this.ctx.fillStyle = '#38bdf8';
    [-80, -40, 0, 40, 80].forEach(offset => {
      this.ctx.beginPath();
      this.ctx.moveTo(240 + offset, chevronY);
      this.ctx.lineTo(240 + offset - 6, chevronY + 12);
      this.ctx.lineTo(240 + offset + 6, chevronY + 12);
      this.ctx.fill();
    });

    // Foul Line
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(this.laneLeft, 550);
    this.ctx.lineTo(this.laneRight, 550);
    this.ctx.stroke();

    // Aim Laser Vector
    if (this.state === 'AIMING' || this.state === 'POWER') {
      this.ctx.save();
      this.ctx.strokeStyle = '#ec4899';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([8, 6]);
      this.ctx.shadowColor = '#ec4899';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.moveTo(this.ball.x, this.ball.y);
      this.ctx.lineTo(
        this.ball.x + Math.sin(this.aimAngle) * 400,
        this.ball.y - Math.cos(this.aimAngle) * 400
      );
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Render Pins
    this.pins.forEach(pin => {
      if (!pin.standing && !pin.knockedDown) return;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);

      if (pin.standing) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#38bdf8';
        this.ctx.shadowBlur = 12;
        this.ctx.fill();
        // Red pin neck stripe
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fillRect(pin.x - pin.radius + 2, pin.y - 2, pin.radius * 2 - 4, 4);
      } else {
        this.ctx.fillStyle = '#64748b';
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    // Render Bowling Ball
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    const ballGrad = this.ctx.createRadialGradient(
      this.ball.x - 4, this.ball.y - 4, 2,
      this.ball.x, this.ball.y, this.ball.radius
    );
    ballGrad.addColorStop(0, '#f472b6');
    ballGrad.addColorStop(1, '#db2777');
    this.ctx.fillStyle = ballGrad;
    this.ctx.shadowColor = '#ec4899';
    this.ctx.shadowBlur = 18;
    this.ctx.fill();

    // Finger Holes
    this.ctx.fillStyle = '#1e1b4b';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x - 4, this.ball.y - 4, 2.5, 0, Math.PI * 2);
    this.ctx.arc(this.ball.x + 4, this.ball.y - 4, 2.5, 0, Math.PI * 2);
    this.ctx.arc(this.ball.x, this.ball.y + 4, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new NeonBowlingGame();
});
