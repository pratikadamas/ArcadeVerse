/**
 * CYBER BRICK BREAKER — NEON VELOCITY ENGINE
 * 100% Pure Vanilla JavaScript (Canvas 2D + Web Audio API)
 * Zero External Dependencies • 60 FPS Multi-Angle Physics
 */

(() => {
  "use strict";

  // ========================================================
  // 1. PROCEDURAL WEB AUDIO SYNTHESIZER
  // ========================================================
  class CyberAudioSynthesizer {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.limiter = null;
      this.activeVoices = new Set();
      this.maxVoices = 6;
      this.muted = localStorage.getItem("cyber_brick_breaker_sound") === "muted";
    }

    init() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && !this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        try {
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-0.5, this.ctx.currentTime);
          comp.knee.setValueAtTime(0, this.ctx.currentTime);
          comp.ratio.setValueAtTime(20.0, this.ctx.currentTime);
          comp.attack.setValueAtTime(0.001, this.ctx.currentTime);
          comp.release.setValueAtTime(0.05, this.ctx.currentTime);
          this.limiter = comp;
          this.masterGain.connect(this.limiter);
          this.limiter.connect(this.ctx.destination);
        } catch (_) {
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    trackVoice(node) {
      if (!node) return node;
      while (this.activeVoices.size >= this.maxVoices) {
        const oldest = this.activeVoices.values().next().value;
        if (oldest) {
          try {
            if (typeof oldest.stop === 'function') oldest.stop();
            if (typeof oldest.disconnect === 'function') oldest.disconnect();
          } catch (_) {}
          this.activeVoices.delete(oldest);
        } else {
          break;
        }
      }
      this.activeVoices.add(node);
      const onEnded = () => {
        this.activeVoices.delete(node);
      };
      if (typeof node.addEventListener === 'function') {
        node.addEventListener('ended', onEnded, { once: true });
      } else {
        node.onended = onEnded;
      }
      return node;
    }

    stopAll() {
      if (this.activeVoices) {
        this.activeVoices.forEach((node) => {
          try {
            if (typeof node.stop === 'function') node.stop();
            if (typeof node.disconnect === 'function') node.disconnect();
          } catch (_) {}
        });
        this.activeVoices.clear();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      localStorage.setItem("cyber_brick_breaker_sound", this.muted ? "muted" : "active");
      return !this.muted;
    }

    isMuted() {
      return this.muted;
    }

    // Dynamic paddle bounce tone modulated by strike position
    playPaddleBounce(offsetFactor = 0) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Frequency scales from 380Hz (center) to 720Hz (outer edge)
        const baseFreq = 420 + Math.abs(offsetFactor) * 320;
        osc.type = "sine";
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.08);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) {
        // Fallback for audio context issues
      }
    }

    // Boundary wall reflection chirp
    playWallBounce() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(560, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.06);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.07);
      } catch (e) {}
    }

    // Armored brick impact hit
    playBrickHit(durability = 1) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "square";
        const freq = 260 + durability * 140;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.07);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.08);
      } catch (e) {}
    }

    // Brick shattered
    playBrickDestroy() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.13);
      } catch (e) {}
    }

    // EMP blast detonator
    playExplosion() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.38);
      } catch (e) {}
    }

    // Plasma laser bolt discharge
    playLaserShot() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) {}
    }

    // Power-up collected chime (major arpeggio)
    playPowerupCollect() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.05);

          gain.gain.setValueAtTime(0.14, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.12);

          osc.connect(gain);
          gain.connect(this.masterGain || this.ctx.destination);
          this.trackVoice(osc);

          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.12);
        });
      } catch (e) {}
    }

    // Energy shield breach
    playLifeLost() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.4);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now);
        osc.stop(now + 0.42);
      } catch (e) {}
    }

    // Sector victory fanfare
    playVictory() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);

          gain.gain.setValueAtTime(0.2, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.28);

          osc.connect(gain);
          gain.connect(this.masterGain || this.ctx.destination);
          this.trackVoice(osc);

          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.28);
        });
      } catch (e) {}
    }
  }

  // ========================================================
  // 2. MASTER GAME ENGINE CLASS
  // ========================================================
  class CyberBrickBreakerGame {
    constructor() {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.audio = new CyberAudioSynthesizer();

      // Viewport Reference Dimensions (Logical Grid: 800 x 540)
      this.width = 800;
      this.height = 540;

      // Game States: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER', 'VICTORY'
      this.state = "START";

      // Persistent Storage
      this.highScore = parseInt(localStorage.getItem("cyber_brick_breaker_highscore") || "0", 10);
      this.score = 0;
      this.combo = 1.0;
      this.level = 1;
      this.maxLives = 3;
      this.lives = this.maxLives;
      this.bricksDestroyed = 0;
      this.maxComboAchieved = 1.0;

      // Paddle Architecture
      this.paddle = {
        x: this.width / 2 - 60,
        y: this.height - 38,
        width: 120,
        baseWidth: 120,
        height: 14,
        speed: 10,
        vx: 0,
        targetX: this.width / 2 - 60,
        hasLasers: false,
        laserTimer: 0,
        wideTimer: 0,
        slowTimer: 0,
        lastLaserShot: 0
      };

      // Entities Collections
      this.balls = [];
      this.bricks = [];
      this.particles = [];
      this.powerups = [];
      this.lasers = [];
      this.floatingTexts = [];

      // Input Controls State
      this.keys = {
        left: false,
        right: false,
        space: false
      };
      this.isTouchDevice = false;

      // DOM UI Elements
      this.dom = {
        scoreDisplay: document.getElementById("score-display"),
        comboDisplay: document.getElementById("combo-display"),
        levelDisplay: document.getElementById("level-display"),
        highScoreDisplay: document.getElementById("high-score-display"),
        shieldsContainer: document.getElementById("shields-display"),
        powerupBadgeContainer: document.getElementById("powerup-badge-container"),
        soundBtn: document.getElementById("sound-btn"),
        soundIconOn: document.getElementById("sound-icon-on"),
        soundIconOff: document.getElementById("sound-icon-off"),
        pauseBtn: document.getElementById("pause-btn"),
        rulesBtn: document.getElementById("rules-btn"),
        startRulesBtn: document.getElementById("start-rules-btn"),
        closeRulesBtn: document.getElementById("close-rules-btn"),
        gotItRulesBtn: document.getElementById("got-it-rules-btn"),
        rulesModal: document.getElementById("rules-modal"),
        startOverlay: document.getElementById("start-overlay"),
        pauseOverlay: document.getElementById("pause-overlay"),
        gameoverOverlay: document.getElementById("gameover-overlay"),
        victoryOverlay: document.getElementById("victory-overlay"),
        startBtn: document.getElementById("start-btn"),
        resumeBtn: document.getElementById("resume-btn"),
        restartFromPauseBtn: document.getElementById("restart-from-pause-btn"),
        retryBtn: document.getElementById("retry-btn"),
        nextLevelBtn: document.getElementById("next-level-btn"),
        finalScore: document.getElementById("final-score"),
        finalCombo: document.getElementById("final-combo"),
        finalBricks: document.getElementById("final-bricks"),
        finalSector: document.getElementById("final-sector"),
        victoryScore: document.getElementById("victory-score"),
        victoryBonus: document.getElementById("victory-bonus"),
        touchLeft: document.getElementById("touch-left"),
        touchRight: document.getElementById("touch-right"),
        touchLaunch: document.getElementById("touch-launch")
      };

      this.initEventListeners();
      this.updateHUD();
      this.syncSoundUI();

      // Initial ball attached to paddle
      this.resetBall();

      // Start 60fps Loop
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.gameLoop(t));
    }

    // ========================================================
    // 3. EVENT LISTENERS & CONTROLS
    // ========================================================
    initEventListeners() {
      // Audio activation on first interaction
      const resumeAudio = () => {
        this.audio.init();
        window.removeEventListener("pointerdown", resumeAudio);
        window.removeEventListener("keydown", resumeAudio);
      };
      window.addEventListener("pointerdown", resumeAudio);
      window.addEventListener("keydown", resumeAudio);

      // Keyboard Controls
      window.addEventListener("keydown", (e) => {
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          this.keys.left = true;
        } else if (e.code === "ArrowRight" || e.code === "KeyD") {
          this.keys.right = true;
        } else if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          if (this.state === "START") {
            this.startGame();
          } else if (this.state === "VICTORY") {
            this.advanceLevel();
          } else if (this.state === "GAMEOVER") {
            this.restartGame();
          } else if (this.state === "PLAYING") {
            this.handleActionTrigger();
          }
        } else if (e.code === "KeyP" || e.code === "Escape") {
          this.togglePause();
        } else if (e.code === "KeyM") {
          this.toggleSound();
        }
      });

      window.addEventListener("keyup", (e) => {
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          this.keys.left = false;
        } else if (e.code === "ArrowRight" || e.code === "KeyD") {
          this.keys.right = false;
        }
      });

      // Canvas Mouse Move (1:1 tracking)
      this.canvas.addEventListener("mousemove", (e) => {
        if (this.state !== "PLAYING") return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const mouseX = (e.clientX - rect.left) * scaleX;
        this.paddle.targetX = mouseX - this.paddle.width / 2;
      });

      this.canvas.addEventListener("click", () => {
        if (this.state === "PLAYING") {
          this.handleActionTrigger();
        }
      });

      // Touch & Drag Handling on Canvas
      this.canvas.addEventListener("touchstart", (e) => {
        this.isTouchDevice = true;
        if (this.state === "PLAYING" && e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const scaleX = this.width / rect.width;
          const touchX = (e.touches[0].clientX - rect.left) * scaleX;
          this.paddle.targetX = touchX - this.paddle.width / 2;
        }
      }, { passive: true });

      this.canvas.addEventListener("touchmove", (e) => {
        if (this.state === "PLAYING" && e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const scaleX = this.width / rect.width;
          const touchX = (e.touches[0].clientX - rect.left) * scaleX;
          this.paddle.targetX = touchX - this.paddle.width / 2;
        }
      }, { passive: true });

      // Touch UI Buttons
      if (this.dom.touchLeft) {
        this.dom.touchLeft.addEventListener("touchstart", (e) => {
          e.preventDefault();
          this.keys.left = true;
        });
        this.dom.touchLeft.addEventListener("touchend", () => {
          this.keys.left = false;
        });
      }
      if (this.dom.touchRight) {
        this.dom.touchRight.addEventListener("touchstart", (e) => {
          e.preventDefault();
          this.keys.right = true;
        });
        this.dom.touchRight.addEventListener("touchend", () => {
          this.keys.right = false;
        });
      }
      if (this.dom.touchLaunch) {
        this.dom.touchLaunch.addEventListener("touchstart", (e) => {
          e.preventDefault();
          this.handleActionTrigger();
        });
      }

      // UI Buttons
      this.dom.soundBtn.addEventListener("click", () => this.toggleSound());
      this.dom.pauseBtn.addEventListener("click", () => this.togglePause());

      // Rules Modal Open / Close
      const openRules = () => {
        this.dom.rulesModal.classList.add("active");
        if (this.state === "PLAYING") this.togglePause();
      };
      const closeRules = () => {
        this.dom.rulesModal.classList.remove("active");
      };

      this.dom.rulesBtn.addEventListener("click", openRules);
      this.dom.startRulesBtn.addEventListener("click", openRules);
      this.dom.closeRulesBtn.addEventListener("click", closeRules);
      this.dom.gotItRulesBtn.addEventListener("click", closeRules);

      // Overlay Action Buttons
      this.dom.startBtn.addEventListener("click", () => this.startGame());
      this.dom.resumeBtn.addEventListener("click", () => this.togglePause());
      this.dom.restartFromPauseBtn.addEventListener("click", () => this.restartGame());
      this.dom.retryBtn.addEventListener("click", () => this.restartGame());
      this.dom.nextLevelBtn.addEventListener("click", () => this.advanceLevel());
    }

    handleActionTrigger() {
      // 1. Launch ball if stuck to paddle
      let launched = false;
      this.balls.forEach((ball) => {
        if (ball.stuck) {
          ball.stuck = false;
          // Initial upward trajectory angled slightly based on paddle offset
          ball.vx = (Math.random() - 0.5) * 4;
          ball.vy = -ball.speed;
          launched = true;
        }
      });

      if (launched) {
        this.audio.playPaddleBounce(0);
        return;
      }

      // 2. Fire mounted plasma lasers if active
      if (this.paddle.hasLasers && performance.now() - this.paddle.lastLaserShot > 160) {
        this.fireLasers();
      }
    }

    fireLasers() {
      this.paddle.lastLaserShot = performance.now();
      const gunOffset = 14;
      this.lasers.push({
        x: this.paddle.x + gunOffset,
        y: this.paddle.y - 6,
        width: 4,
        height: 14,
        vy: -13
      });
      this.lasers.push({
        x: this.paddle.x + this.paddle.width - gunOffset,
        y: this.paddle.y - 6,
        width: 4,
        height: 14,
        vy: -13
      });
      this.audio.playLaserShot();
    }

    toggleSound() {
      this.audio.init();
      const isActive = this.audio.toggleMute();
      this.syncSoundUI();
    }

    syncSoundUI() {
      const isMuted = this.audio.isMuted();
      if (isMuted) {
        this.dom.soundIconOn.classList.add("hidden");
        this.dom.soundIconOff.classList.remove("hidden");
      } else {
        this.dom.soundIconOn.classList.remove("hidden");
        this.dom.soundIconOff.classList.add("hidden");
      }
    }

    togglePause() {
      if (this.state === "PLAYING") {
        this.state = "PAUSED";
        this.dom.pauseOverlay.classList.add("active");
      } else if (this.state === "PAUSED") {
        this.state = "PLAYING";
        this.dom.pauseOverlay.classList.remove("active");
        this.lastTime = performance.now();
      }
    }

    // ========================================================
    // 4. GAME FLOW & SECTOR INITIALIZATION
    // ========================================================
    startGame() {
      this.audio.stopAll();
      this.audio.init();
      this.score = 0;
      this.combo = 1.0;
      this.level = 1;
      this.lives = this.maxLives;
      this.bricksDestroyed = 0;
      this.maxComboAchieved = 1.0;
      this.dom.startOverlay.classList.remove("active");
      this.initLevel(this.level);
      this.state = "PLAYING";
      this.updateHUD();
    }

    restartGame() {
      this.dom.gameoverOverlay.classList.remove("active");
      this.dom.pauseOverlay.classList.remove("active");
      this.startGame();
    }

    advanceLevel() {
      this.dom.victoryOverlay.classList.remove("active");
      this.level += 1;
      this.initLevel(this.level);
      this.state = "PLAYING";
      this.updateHUD();
    }

    resetBall() {
      const baseSpeed = 6.5 + Math.min(this.level * 0.4, 2.5);
      this.balls = [
        {
          x: this.paddle.x + this.paddle.width / 2,
          y: this.paddle.y - 9,
          radius: 7,
          vx: 0,
          vy: 0,
          speed: baseSpeed,
          stuck: true,
          trail: []
        }
      ];
    }

    initLevel(lvl) {
      this.bricks = [];
      this.lasers = [];
      this.powerups = [];
      this.floatingTexts = [];
      this.resetBall();

      // Reset paddle buffs
      this.paddle.width = this.paddle.baseWidth;
      this.paddle.hasLasers = false;
      this.paddle.laserTimer = 0;
      this.paddle.wideTimer = 0;
      this.paddle.slowTimer = 0;

      const cols = 10;
      const brickWidth = 70;
      const brickHeight = 22;
      const padX = 8;
      const padY = 8;
      const startX = (this.width - (cols * brickWidth + (cols - 1) * padX)) / 2;
      const startY = 65;

      // Layout Patterns per Sector
      if (lvl === 1) {
        // Sector 1: Matrix Crest
        const rows = 5;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            let type = "standard";
            let durability = 1;
            let color = "#00f0ff"; // Cyan

            if (r === 0 || r === 1) {
              if (c % 3 === 0) {
                type = "armored";
                durability = 2;
                color = "#ff007f"; // Magenta
              }
            } else if (r === 2 && (c === 4 || c === 5)) {
              type = "emp";
              durability = 1;
              color = "#ff3366"; // Crimson
            }

            this.createBrick(startX + c * (brickWidth + padX), startY + r * (brickHeight + padY), brickWidth, brickHeight, type, durability, color);
          }
        }
      } else if (lvl === 2) {
        // Sector 2: Quantum Diamond
        const rows = 7;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const distFromCenter = Math.abs(c - 4.5) + Math.abs(r - 3);
            if (distFromCenter <= 5) {
              let type = "standard";
              let durability = 1;
              let color = "#00f0ff";

              if (distFromCenter <= 2) {
                type = "reinforced";
                durability = 3;
                color = "#ffbe0b"; // Gold
              } else if (distFromCenter === 3) {
                type = "armored";
                durability = 2;
                color = "#ff007f";
              }

              if (r === 3 && (c === 1 || c === 8)) {
                type = "emp";
                durability = 1;
                color = "#ff3366";
              }

              this.createBrick(startX + c * (brickWidth + padX), startY + r * (brickHeight + padY), brickWidth, brickHeight, type, durability, color);
            }
          }
        }
      } else {
        // Sector 3+: Cyber Fortress
        const rows = 8;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r + c) % 2 === 0 || r === 0 || r === 7) {
              let type = "armored";
              let durability = 2;
              let color = "#ff007f";

              if (r <= 1 && (c === 2 || c === 7)) {
                type = "reinforced";
                durability = 3;
                color = "#ffbe0b";
              } else if (r === 4 && (c === 3 || c === 6)) {
                type = "emp";
                durability = 1;
                color = "#ff3366";
              }

              this.createBrick(startX + c * (brickWidth + padX), startY + r * (brickHeight + padY), brickWidth, brickHeight, type, durability, color);
            }
          }
        }
      }
    }

    createBrick(x, y, w, h, type, durability, color) {
      this.bricks.push({
        x,
        y,
        width: w,
        height: h,
        type,
        durability,
        maxDurability: durability,
        color,
        destroyed: false,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    // ========================================================
    // 5. PHYSICS & LOGIC LOOP
    // ========================================================
    gameLoop(timestamp) {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
      this.lastTime = timestamp;

      if (this.state === "PLAYING") {
        this.update(dt);
      }

      this.render();
      requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
      // 1. Paddle Movement (Smooth interpolation)
      if (this.keys.left) {
        this.paddle.targetX -= this.paddle.speed;
      }
      if (this.keys.right) {
        this.paddle.targetX += this.paddle.speed;
      }

      // Clamp target within canvas
      this.paddle.targetX = Math.max(8, Math.min(this.width - this.paddle.width - 8, this.paddle.targetX));
      // Ease toward target
      this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.28;

      // 2. Paddle Power-Up Timers
      const now = performance.now();
      if (this.paddle.wideTimer > 0) {
        this.paddle.wideTimer -= dt;
        if (this.paddle.wideTimer <= 0) {
          this.paddle.width = this.paddle.baseWidth;
        }
      }
      if (this.paddle.laserTimer > 0) {
        this.paddle.laserTimer -= dt;
        if (this.paddle.laserTimer <= 0) {
          this.paddle.hasLasers = false;
        }
      }
      if (this.paddle.slowTimer > 0) {
        this.paddle.slowTimer -= dt;
      }

      this.updatePowerUpBadges();

      // 3. Update Lasers
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        const laser = this.lasers[i];
        laser.y += laser.vy;

        // Laser - Brick Collisions
        let hit = false;
        for (let j = 0; j < this.bricks.length; j++) {
          const b = this.bricks[j];
          if (!b.destroyed && this.checkRectCollision(laser, b)) {
            this.damageBrick(b, 1, laser.x, laser.y);
            hit = true;
            break;
          }
        }

        if (hit || laser.y < 0) {
          this.lasers.splice(i, 1);
        }
      }

      // 4. Update Power-Up Capsules
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const p = this.powerups[i];
        p.y += p.vy;

        // Catch with paddle
        if (
          p.y + p.radius >= this.paddle.y &&
          p.y - p.radius <= this.paddle.y + this.paddle.height &&
          p.x >= this.paddle.x &&
          p.x <= this.paddle.x + this.paddle.width
        ) {
          this.collectPowerup(p.type);
          this.powerups.splice(i, 1);
          continue;
        }

        // Dropped past bottom
        if (p.y > this.height + 20) {
          this.powerups.splice(i, 1);
        }
      }

      // 5. Update Balls (Multi-Angle Deflection Physics)
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const ball = this.balls[i];

        if (ball.stuck) {
          ball.x = this.paddle.x + this.paddle.width / 2;
          ball.y = this.paddle.y - ball.radius - 2;
          continue;
        }

        // Ball particle trail
        ball.trail.push({ x: ball.x, y: ball.y, alpha: 0.6 });
        if (ball.trail.length > 8) ball.trail.shift();

        // Speed calculation (with Slow Overdrive buff)
        const currentSpeed = this.paddle.slowTimer > 0 ? ball.speed * 0.7 : ball.speed;
        const normalizedVel = Math.hypot(ball.vx, ball.vy);
        if (normalizedVel > 0) {
          ball.vx = (ball.vx / normalizedVel) * currentSpeed;
          ball.vy = (ball.vy / normalizedVel) * currentSpeed;
        }

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall Collisions (Left & Right)
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = Math.abs(ball.vx);
          this.audio.playWallBounce();
          this.spawnSparks(ball.x, ball.y, "#00f0ff", 6);
        } else if (ball.x + ball.radius >= this.width) {
          ball.x = this.width - ball.radius;
          ball.vx = -Math.abs(ball.vx);
          this.audio.playWallBounce();
          this.spawnSparks(ball.x, ball.y, "#00f0ff", 6);
        }

        // Ceiling Collision
        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = Math.abs(ball.vy);
          this.audio.playWallBounce();
          this.spawnSparks(ball.x, ball.y, "#00f0ff", 6);
        }

        // Paddle Collision (Multi-Angle Deflection Physics)
        if (
          ball.vy > 0 &&
          ball.y + ball.radius >= this.paddle.y &&
          ball.y - ball.radius <= this.paddle.y + this.paddle.height &&
          ball.x >= this.paddle.x - 4 &&
          ball.x <= this.paddle.x + this.paddle.width + 4
        ) {
          // Normalize impact offset: -1.0 (far left) to +1.0 (far right)
          const paddleCenter = this.paddle.x + this.paddle.width / 2;
          const hitOffset = Math.max(-1, Math.min(1, (ball.x - paddleCenter) / (this.paddle.width / 2)));

          // Max deflection angle: 72 degrees in radians
          const maxBounceAngle = (72 * Math.PI) / 180;
          const bounceAngle = hitOffset * maxBounceAngle;

          ball.vx = ball.speed * Math.sin(bounceAngle);
          ball.vy = -ball.speed * Math.cos(bounceAngle);

          // Guarantee minimum upward velocity
          if (Math.abs(ball.vy) < 2) {
            ball.vy = -2.5;
          }

          ball.y = this.paddle.y - ball.radius - 1;

          // Reset combo streak on paddle catch
          this.combo = 1.0;
          this.updateHUD();

          this.audio.playPaddleBounce(hitOffset);
          this.spawnSparks(ball.x, ball.y, "#00f0ff", 10);
        }

        // Brick Collisions
        for (let j = 0; j < this.bricks.length; j++) {
          const b = this.bricks[j];
          if (b.destroyed) continue;

          if (this.checkBallBrickCollision(ball, b)) {
            // Determine bounce axis
            const prevX = ball.x - ball.vx;
            const prevY = ball.y - ball.vy;

            const hitFromLeftOrRight = prevX + ball.radius <= b.x || prevX - ball.radius >= b.x + b.width;
            if (hitFromLeftOrRight) {
              ball.vx = -ball.vx;
            } else {
              ball.vy = -ball.vy;
            }

            this.damageBrick(b, 1, ball.x, ball.y);
            break;
          }
        }

        // Bottom Boundary / Shield Breach
        if (ball.y - ball.radius > this.height) {
          this.balls.splice(i, 1);
        }
      }

      // Check if all balls were lost
      if (this.balls.length === 0) {
        this.loseShield();
      }

      // 6. Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy += p.gravity || 0.12;
        p.alpha -= p.fade || 0.025;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // 7. Update Floating Score Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const t = this.floatingTexts[i];
        t.y += t.vy;
        t.alpha -= 0.02;
        if (t.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }

      // 8. Check Sector Completion
      const remainingBricks = this.bricks.filter((b) => !b.destroyed).length;
      if (remainingBricks === 0) {
        this.sectorVictory();
      }
    }

    // ========================================================
    // 6. COLLISION & BRICK DAMAGE ENGINE
    // ========================================================
    checkRectCollision(r1, r2) {
      return (
        r1.x < r2.x + r2.width &&
        r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height &&
        r1.y + r1.height > r2.y
      );
    }

    checkBallBrickCollision(ball, brick) {
      const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
      const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
      const distX = ball.x - closestX;
      const distY = ball.y - closestY;
      return distX * distX + distY * distY < ball.radius * ball.radius;
    }

    damageBrick(brick, amount = 1, hitX, hitY) {
      brick.durability -= amount;

      if (brick.durability <= 0) {
        brick.destroyed = true;
        this.bricksDestroyed += 1;

        // Score award based on type
        let basePts = 100;
        if (brick.type === "armored") basePts = 250;
        else if (brick.type === "reinforced") basePts = 450;
        else if (brick.type === "emp") basePts = 500;

        const earned = Math.round(basePts * this.combo);
        this.score += earned;
        this.addFloatingText(`+${earned}`, brick.x + brick.width / 2, brick.y, brick.color);

        // Increase combo multiplier
        this.combo = Math.min(5.0, parseFloat((this.combo + 0.2).toFixed(1)));
        if (this.combo > this.maxComboAchieved) {
          this.maxComboAchieved = this.combo;
        }

        // Particle Shatter Burst
        this.spawnSparks(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 16);

        // EMP Blast Detonation
        if (brick.type === "emp") {
          this.triggerEMPBlast(brick.x + brick.width / 2, brick.y + brick.height / 2);
        } else {
          this.audio.playBrickDestroy();
        }

        // Chance to spawn power-up (24% chance)
        if (Math.random() < 0.24) {
          this.spawnPowerup(brick.x + brick.width / 2, brick.y + brick.height / 2);
        }
      } else {
        // Armored brick absorbed hit
        this.audio.playBrickHit(brick.durability);
        this.spawnSparks(hitX || brick.x, hitY || brick.y, brick.color, 7);
      }

      this.updateHUD();
    }

    triggerEMPBlast(centerX, centerY) {
      this.audio.playExplosion();
      const radius = 110;

      // Shockwave Ring Particle
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 10,
        maxRadius: radius,
        color: "#ff3366",
        alpha: 0.9,
        isShockwave: true,
        fade: 0.04
      });

      // Detonate adjacent bricks
      this.bricks.forEach((b) => {
        if (!b.destroyed) {
          const bx = b.x + b.width / 2;
          const by = b.y + b.height / 2;
          const dist = Math.hypot(centerX - bx, centerY - by);
          if (dist <= radius) {
            this.damageBrick(b, 2, bx, by);
          }
        }
      });
    }

    // ========================================================
    // 7. POWER-UP SUBSYSTEM
    // ========================================================
    spawnPowerup(x, y) {
      const types = ["LASER", "MULTI", "WIDE", "SLOW", "SHIELD"];
      const weights = [0.25, 0.25, 0.25, 0.15, 0.10];

      let r = Math.random();
      let selectedType = types[0];
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (r <= acc) {
          selectedType = types[i];
          break;
        }
      }

      const colors = {
        LASER: "#ff3366",
        MULTI: "#00f0ff",
        WIDE: "#ffbe0b",
        SLOW: "#3b82f6",
        SHIELD: "#00ff88"
      };

      this.powerups.push({
        x,
        y,
        radius: 12,
        type: selectedType,
        color: colors[selectedType],
        vy: 2.8
      });
    }

    collectPowerup(type) {
      this.audio.playPowerupCollect();
      this.addFloatingText(`BUFF: ${type}`, this.paddle.x + this.paddle.width / 2, this.paddle.y - 15, "#00f0ff");

      switch (type) {
        case "LASER":
          this.paddle.hasLasers = true;
          this.paddle.laserTimer = 12; // 12 seconds
          break;
        case "WIDE":
          this.paddle.width = this.paddle.baseWidth * 1.4;
          this.paddle.wideTimer = 14; // 14 seconds
          break;
        case "SLOW":
          this.paddle.slowTimer = 10; // 10 seconds
          break;
        case "MULTI":
          // Triple active balls
          const newBalls = [];
          this.balls.forEach((b) => {
            if (!b.stuck) {
              newBalls.push({
                x: b.x,
                y: b.y,
                radius: b.radius,
                vx: b.vx * 0.8 + 2.5,
                vy: b.vy,
                speed: b.speed,
                stuck: false,
                trail: []
              });
              newBalls.push({
                x: b.x,
                y: b.y,
                radius: b.radius,
                vx: b.vx * 0.8 - 2.5,
                vy: b.vy,
                speed: b.speed,
                stuck: false,
                trail: []
              });
            }
          });
          this.balls.push(...newBalls);
          break;
        case "SHIELD":
          if (this.lives < this.maxLives) {
            this.lives += 1;
            this.updateHUD();
          }
          break;
      }
    }

    updatePowerUpBadges() {
      if (!this.dom.powerupBadgeContainer) return;
      let html = "";
      if (this.paddle.laserTimer > 0) {
        html += `<div class="powerup-active-chip" style="border-color:#ff3366;color:#ff3366;">LASERS: ${Math.ceil(this.paddle.laserTimer)}s</div>`;
      }
      if (this.paddle.wideTimer > 0) {
        html += `<div class="powerup-active-chip" style="border-color:#ffbe0b;color:#ffbe0b;">WIDE: ${Math.ceil(this.paddle.wideTimer)}s</div>`;
      }
      if (this.paddle.slowTimer > 0) {
        html += `<div class="powerup-active-chip" style="border-color:#3b82f6;color:#3b82f6;">SLOW: ${Math.ceil(this.paddle.slowTimer)}s</div>`;
      }
      this.dom.powerupBadgeContainer.innerHTML = html;
    }

    loseShield() {
      this.lives -= 1;
      this.audio.playLifeLost();
      this.combo = 1.0;
      this.updateHUD();

      if (this.lives <= 0) {
        this.gameOver();
      } else {
        // Reset ball on paddle
        this.resetBall();
      }
    }

    gameOver() {
      this.state = "GAMEOVER";
      this.audio.playLifeLost();

      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem("cyber_brick_breaker_highscore", this.highScore.toString());
      }

      this.dom.finalScore.textContent = this.score.toLocaleString();
      this.dom.finalCombo.textContent = `x${this.maxComboAchieved.toFixed(1)}`;
      this.dom.finalBricks.textContent = this.bricksDestroyed.toString();
      this.dom.finalSector.textContent = `0${this.level}`;
      this.dom.gameoverOverlay.classList.add("active");
    }

    sectorVictory() {
      this.state = "VICTORY";
      this.audio.playVictory();

      const shieldBonus = this.lives * 500;
      this.score += shieldBonus;

      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem("cyber_brick_breaker_highscore", this.highScore.toString());
      }

      this.dom.victoryScore.textContent = this.score.toLocaleString();
      this.dom.victoryBonus.textContent = `+${shieldBonus}`;
      this.dom.victoryOverlay.classList.add("active");
    }

    // ========================================================
    // 8. VISUAL PARTICLES & FLOATING HUD
    // ========================================================
    spawnSparks(x, y, color, count = 12) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4.5 + 1.5;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3 + 1.5,
          color,
          alpha: 1.0,
          fade: Math.random() * 0.03 + 0.02,
          gravity: 0.1
        });
      }
    }

    addFloatingText(text, x, y, color) {
      this.floatingTexts.push({
        text,
        x,
        y,
        vy: -1.2,
        alpha: 1.0,
        color
      });
    }

    updateHUD() {
      this.dom.scoreDisplay.textContent = this.score.toString().padStart(5, "0");
      this.dom.comboDisplay.textContent = `x${this.combo.toFixed(1)}`;
      this.dom.levelDisplay.textContent = this.level.toString().padStart(2, "0");
      this.dom.highScoreDisplay.textContent = this.highScore.toString().padStart(5, "0");

      // Update Shield units
      const shieldUnits = this.dom.shieldsContainer.querySelectorAll(".shield-unit");
      shieldUnits.forEach((unit, index) => {
        if (index < this.lives) {
          unit.classList.add("active");
        } else {
          unit.classList.remove("active");
        }
      });
    }

    // ========================================================
    // 9. RENDERING (CANVAS 2D 60FPS)
    // ========================================================
    render() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      // 1. Neon Matrix Background Grid
      this.ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
      this.ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < this.width; x += gridSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
      }
      for (let y = 0; y < this.height; y += gridSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.width, y);
        this.ctx.stroke();
      }

      // 2. Render Bricks
      this.bricks.forEach((b) => {
        if (b.destroyed) return;

        this.ctx.save();
        this.ctx.fillStyle = b.color;
        this.ctx.shadowColor = b.color;
        this.ctx.shadowBlur = b.durability > 1 ? 14 : 8;

        // Brick body
        this.ctx.beginPath();
        this.ctx.roundRect(b.x, b.y, b.width, b.height, 4);
        this.ctx.fill();

        // Inner highlight
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
        this.ctx.fillRect(b.x + 3, b.y + 2, b.width - 6, 3);

        // Armor Cracks for multi-hit bricks
        if (b.durability < b.maxDurability) {
          this.ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(b.x + b.width * 0.3, b.y + 3);
          this.ctx.lineTo(b.x + b.width * 0.5, b.y + b.height * 0.6);
          this.ctx.lineTo(b.x + b.width * 0.7, b.y + b.height - 3);
          this.ctx.stroke();
        }

        // EMP Symbol Indicator
        if (b.type === "emp") {
          this.ctx.fillStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(b.x + b.width / 2, b.y + b.height / 2, 4, 0, Math.PI * 2);
          this.ctx.fill();
        }

        this.ctx.restore();
      });

      // 3. Render Lasers
      this.ctx.save();
      this.ctx.fillStyle = "#ff3366";
      this.ctx.shadowColor = "#ff3366";
      this.ctx.shadowBlur = 12;
      this.lasers.forEach((l) => {
        this.ctx.fillRect(l.x, l.y, l.width, l.height);
      });
      this.ctx.restore();

      // 4. Render Power-Up Capsules
      this.powerups.forEach((p) => {
        this.ctx.save();
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 10;

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = "#030712";
        this.ctx.font = "bold 9px 'Space Grotesk', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(p.type[0], p.x, p.y);

        this.ctx.restore();
      });

      // 5. Render Paddle
      this.ctx.save();
      // Paddle Glow & Gradient
      const paddleGrad = this.ctx.createLinearGradient(this.paddle.x, this.paddle.y, this.paddle.x + this.paddle.width, this.paddle.y);
      paddleGrad.addColorStop(0, "#00d2ff");
      paddleGrad.addColorStop(0.5, "#00f0ff");
      paddleGrad.addColorStop(1, "#00d2ff");

      this.ctx.fillStyle = paddleGrad;
      this.ctx.shadowColor = "#00f0ff";
      this.ctx.shadowBlur = 16;

      this.ctx.beginPath();
      this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 6);
      this.ctx.fill();

      // Core Energy Line
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(this.paddle.x + 8, this.paddle.y + 4, this.paddle.width - 16, 2);

      // Mounted Lasers Cannons (Visual)
      if (this.paddle.hasLasers) {
        this.ctx.fillStyle = "#ff3366";
        this.ctx.fillRect(this.paddle.x + 8, this.paddle.y - 7, 8, 7);
        this.ctx.fillRect(this.paddle.x + this.paddle.width - 16, this.paddle.y - 7, 8, 7);
      }
      this.ctx.restore();

      // 6. Render Balls & Trails
      this.balls.forEach((ball) => {
        // Trail render
        ball.trail.forEach((t) => {
          this.ctx.save();
          this.ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.4})`;
          this.ctx.beginPath();
          this.ctx.arc(t.x, t.y, ball.radius * 0.8, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
        });

        // Ball core
        this.ctx.save();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.shadowColor = "#00f0ff";
        this.ctx.shadowBlur = 14;

        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });

      // 7. Render Particles & Shockwaves
      this.particles.forEach((p) => {
        this.ctx.save();
        if (p.isShockwave) {
          p.radius += (p.maxRadius - p.radius) * 0.18;
          this.ctx.strokeStyle = p.color;
          this.ctx.globalAlpha = p.alpha;
          this.ctx.lineWidth = 4;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          this.ctx.stroke();
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.globalAlpha = p.alpha;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 8;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();
      });

      // 8. Render Floating Texts
      this.floatingTexts.forEach((t) => {
        this.ctx.save();
        this.ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        this.ctx.fillStyle = t.color;
        this.ctx.globalAlpha = t.alpha;
        this.ctx.shadowColor = t.color;
        this.ctx.shadowBlur = 10;
        this.ctx.textAlign = "center";
        this.ctx.fillText(t.text, t.x, t.y);
        this.ctx.restore();
      });
    }
  }

  // Initialize once DOM is ready
  let activeInstance = null;
  document.addEventListener("DOMContentLoaded", () => {
    activeInstance = new CyberBrickBreakerGame();
  });

  // Clean audio on teardown (#507)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ARCADEVERSE_TEARDOWN') {
      if (activeInstance && activeInstance.audio) {
        activeInstance.audio.stopAll();
        if (activeInstance.audio.ctx && activeInstance.audio.ctx.state !== 'closed') {
          try { activeInstance.audio.ctx.close(); } catch (_) {}
        }
      }
    }
  });
})();
