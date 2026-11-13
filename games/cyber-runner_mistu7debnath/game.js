/**
 * ===================================================================
 * CYBER RUNNER: NEON RUSH
 * ArcadeVerse Open-Source Game Contribution
 * 100% Pure Vanilla HTML5 Canvas + Web Audio API + Modern JavaScript
 * ===================================================================
 */

(() => {
  'use strict';

  // --- Safe LocalStorage & Persistence Engine ---
  const STORAGE_KEY = 'crnr_save_v1';

  const StorageManager = {
    data: {
      bestScore: 0,
      bestDistance: 0,
      totalCoins: 0,
      runsPlayed: 0,
      soundMuted: false
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.data.bestScore = Number(parsed.bestScore) || 0;
            this.data.bestDistance = Number(parsed.bestDistance) || 0;
            this.data.totalCoins = Number(parsed.totalCoins) || 0;
            this.data.runsPlayed = Number(parsed.runsPlayed) || 0;
            this.data.soundMuted = Boolean(parsed.soundMuted);
          }
        }
      } catch (err) {
        // Fallback to in-memory data for private browsing or restricted iframes
      }
      return this.data;
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (err) {
        // Graceful fallback
      }
    },

    updateBest(score, distance, coins) {
      let isNewRecord = false;
      if (score > this.data.bestScore) {
        this.data.bestScore = score;
        isNewRecord = true;
      }
      if (distance > this.data.bestDistance) {
        this.data.bestDistance = distance;
      }
      this.data.totalCoins += coins;
      this.data.runsPlayed += 1;
      this.save();
      return isNewRecord;
    }
  };

  // --- Procedural Web Audio API Sound Engine (#507) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.limiter = null;
      this.muted = false;
      this.initialized = false;
      this.activeVoices = new Set();
      this.maxVoices = 6;
    }

    init() {
      if (this.initialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.initialized = true;
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
      } catch (e) {
        console.warn('Web Audio API not supported on this browser.');
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    trackVoice(node) {
      if (!node) return node;
      if (!this.activeVoices) this.activeVoices = new Set();
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
        if (this.activeVoices) this.activeVoices.delete(node);
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

    setMuted(mute) {
      this.muted = mute;
    }

    playStart() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;
      // Dual-tone cyber synth chime
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.08, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.35);
      });
    }

    playLaneSwitch() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.09);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);

      osc.start(now);
      osc.stop(now + 0.09);
    }

    playJump() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.22);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);

      osc.start(now);
      osc.stop(now + 0.22);
    }

    playSlide() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;
      // High-pass friction sizzle
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.linearRampToValueAtTime(600, now + 0.15);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(noise);

      noise.start(now);
      noise.stop(now + 0.15);
    }

    playCoin() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;
      // Sparkling arpeggio (C6 - E6 - G6)
      [1046.5, 1318.51, 1567.98].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.12, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.2);
      });
    }

    playCrash() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;

      // Heavy explosion boom
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);

      osc.start(now);
      osc.stop(now + 0.45);

      // Glitch noise burst
      try {
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.8;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.linearRampToValueAtTime(100, now + 0.3);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.2, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(noise);

        noise.start(now);
        noise.stop(now + 0.3);
      } catch (err) {}
    }

    playClick() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  // --- Central Configuration Constants ---
  const CONFIG = {
    CANVAS_WIDTH: 480,
    CANVAS_HEIGHT: 640,
    HORIZON_Y: 185,
    BASELINE_Y: 560,
    ROAD_TOP_WIDTH: 74,
    ROAD_BOT_WIDTH: 420,
    LANES: 3,

    // Speeds & Accelerations
    INITIAL_SPEED: 0.65,          // Z units per second
    MAX_SPEED: 1.45,             // Maximum speed cap
    SPEED_ACCELERATION: 0.00008, // Gradual acceleration rate

    // Action Durations
    JUMP_DURATION: 0.65,         // Seconds
    JUMP_MAX_HEIGHT: 88,         // Pixels
    SLIDE_DURATION: 0.58,        // Seconds
    LANE_LERP_SPEED: 18.0,       // Lane transition stiffness

    // Obstacle & Coin Spawning
    MIN_SPAWN_GAP: 0.36,         // Minimum Z-gap between successive obstacles
    BASE_SPAWN_INTERVAL: 1.35,   // Seconds between waves
    MIN_SPAWN_INTERVAL: 0.72,    // Minimum seconds between waves at top speed

    // Collision Margins in Z depth
    COLLISION_Z_MIN: 0.01,
    COLLISION_Z_MAX: 0.08,

    // Scoring
    POINTS_PER_METER: 1,
    POINTS_PER_COIN: 50
  };

  // --- Game State Constants ---
  const STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER'
  };

  // --- Helper Math & Easing Functions ---
  const MathUtils = {
    clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    // 2.5D Perspective Projection Formulas
    // z ranges from 0 (at player's feet, y=BASELINE_Y) to 1 (at horizon, y=HORIZON_Y)
    getScreenY(z) {
      const depthFactor = Math.pow(1 - z, 1.45);
      return CONFIG.HORIZON_Y + (CONFIG.BASELINE_Y - CONFIG.HORIZON_Y) * depthFactor;
    },

    getRoadWidth(z) {
      const depthFactor = Math.pow(1 - z, 1.3);
      return CONFIG.ROAD_TOP_WIDTH + (CONFIG.ROAD_BOT_WIDTH - CONFIG.ROAD_TOP_WIDTH) * depthFactor;
    },

    getLaneX(laneIndex, z) {
      const roadW = this.getRoadWidth(z);
      const laneOffset = (laneIndex - 1) * (roadW / 3);
      return (CONFIG.CANVAS_WIDTH / 2) + laneOffset;
    },

    getScale(z) {
      return Math.pow(1 - z, 1.1) * 0.88 + 0.12;
    }
  };

  // --- Obstacle & Collectible Models ---
  const OBSTACLE_TYPES = {
    BARRIER: 'BARRIER', // Ground hurdle: must JUMP
    LASER: 'LASER',     // Overhead laser beam: must SLIDE
    BLOCKER: 'BLOCKER'  // Firewall drone / tall pylon: must STEER
  };

  class Obstacle {
    constructor(type, laneIndex, z = 1.0) {
      this.type = type;
      this.laneIndex = laneIndex;
      this.z = z;
      this.prevZ = z;
      this.passed = false;
    }

    update(dt, speed) {
      this.prevZ = this.z;
      this.z -= speed * dt;
    }
  }

  class EnergyCoin {
    constructor(laneIndex, z = 1.0) {
      this.laneIndex = laneIndex;
      this.z = z;
      this.collected = false;
      this.animAngle = Math.random() * Math.PI * 2;
    }

    update(dt, speed) {
      this.z -= speed * dt;
      this.animAngle += dt * 4;
    }
  }

  class Particle {
    constructor(x, y, vx, vy, color, life, size) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.life = life;
      this.maxLife = life;
      this.size = size;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class FloatingText {
    constructor(text, x, y, color = '#00f0ff') {
      this.text = text;
      this.x = x;
      this.y = y;
      this.vy = -50;
      this.color = color;
      this.life = 0.8;
      this.maxLife = 0.8;
    }

    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.font = 'bold 15px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // --- Main Cyber Runner Game Class ---
  class CyberRunnerGame {
    constructor() {
      // DOM Elements
      this.canvas = document.getElementById('crnr-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.appContainer = document.getElementById('crnr-container');

      // Screens & Overlays
      this.startScreen = document.getElementById('crnr-start-screen');
      this.pauseScreen = document.getElementById('crnr-pause-screen');
      this.gameoverScreen = document.getElementById('crnr-gameover-screen');
      this.howToPlayModal = document.getElementById('crnr-how-to-play-modal');
      this.newRecordBadge = document.getElementById('crnr-new-record-badge');
      this.announcer = document.getElementById('crnr-live-announcer');

      // In-Game HUD Elements
      this.hudScore = document.getElementById('crnr-hud-score');
      this.hudDistance = document.getElementById('crnr-hud-distance');
      this.hudCoins = document.getElementById('crnr-hud-coins');
      this.hudBest = document.getElementById('crnr-hud-best');
      this.soundIcon = document.getElementById('crnr-sound-icon');
      this.pauseIcon = document.getElementById('crnr-pause-icon');

      // Screen Score Elements
      this.startBestScore = document.getElementById('crnr-start-best');
      this.pauseScore = document.getElementById('crnr-pause-score');
      this.pauseDist = document.getElementById('crnr-pause-dist');
      this.pauseCoins = document.getElementById('crnr-pause-coins');
      this.finalScore = document.getElementById('crnr-final-score');
      this.finalBest = document.getElementById('crnr-final-best');
      this.finalDist = document.getElementById('crnr-final-dist');
      this.finalCoins = document.getElementById('crnr-final-coins');

      // Sound Engine & Storage
      this.sound = new SoundEngine();
      this.saveData = StorageManager.load();
      this.sound.setMuted(this.saveData.soundMuted);

      // Core Game State
      this.state = STATE.MENU;
      this.previousStateBeforeModal = STATE.MENU;
      this.lastFrameTime = performance.now();
      this.animationFrameId = null;

      // Gameplay Variables
      this.score = 0;
      this.distance = 0;
      this.coins = 0;
      this.speed = CONFIG.INITIAL_SPEED;
      this.trackOffset = 0; // For moving road stripes

      // Player State
      this.player = {
        lane: 1,            // 0: Left, 1: Center, 2: Right
        targetLane: 1,
        x: CONFIG.CANVAS_WIDTH / 2,
        y: CONFIG.BASELINE_Y,
        isJumping: false,
        jumpTimer: 0,
        jumpHeight: 0,
        isSliding: false,
        slideTimer: 0,
        runCycle: 0,
        invulnerableTimer: 0
      };

      // Spawning Queues & Active Entities
      this.obstacles = [];
      this.coinsList = [];
      this.particles = [];
      this.floatingTexts = [];
      this.spawnTimer = 0;
      this.billboardCycle = 0;
      this.billboardTexts = ['CYBER RUNNER', 'NEON RUSH', 'ARCADEVERSE', 'HYPER DRIVE', 'SYS: ONLINE'];
      this.billboardIndex = 0;

      // Touch Tracking
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchStartTime = 0;

      // Initialize
      this.bindEvents();
      this.updateHudBest();
      this.updateSoundButtonUI();

      // Trigger initial Lucide icons compilation
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }

      // Start background render loop for attractive menu
      this.startLoop();
    }

    announce(text) {
      if (this.announcer) {
        this.announcer.textContent = text;
      }
    }

    updateHudBest() {
      if (this.hudBest) this.hudBest.textContent = this.saveData.bestScore;
      if (this.startBestScore) this.startBestScore.textContent = this.saveData.bestScore;
    }

    updateSoundButtonUI() {
      if (!this.soundIcon) return;
      const iconName = this.sound.muted ? 'volume-x' : 'volume-2';
      this.soundIcon.innerHTML = `<i data-lucide="${iconName}"></i>`;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    toggleSound() {
      const newMuted = !this.sound.muted;
      this.sound.setMuted(newMuted);
      this.saveData.soundMuted = newMuted;
      StorageManager.save();
      this.updateSoundButtonUI();
      if (!newMuted) {
        this.sound.playClick();
      }
    }

    // --- Screen & Overlay Transitions ---
    showStartScreen() {
      this.state = STATE.MENU;
      this.startScreen.style.display = 'flex';
      this.pauseScreen.style.display = 'none';
      this.gameoverScreen.style.display = 'none';
      this.howToPlayModal.style.display = 'none';
      this.updateHudBest();
      this.announce('Main menu. Press Initiate Run or press Enter to start.');
      if (window.lucide) lucide.createIcons();
    }

    showPauseScreen() {
      if (this.state !== STATE.PLAYING) return;
      this.state = STATE.PAUSED;
      this.pauseScore.textContent = Math.floor(this.score);
      this.pauseDist.textContent = `${Math.floor(this.distance)}m`;
      this.pauseCoins.textContent = this.coins;
      this.pauseScreen.style.display = 'flex';
      this.announce('Game paused. Press Resume or P to continue.');
      if (window.lucide) lucide.createIcons();
    }

    resumeGame() {
      if (this.state !== STATE.PAUSED) return;
      this.state = STATE.PLAYING;
      this.pauseScreen.style.display = 'none';
      this.lastFrameTime = performance.now();
      this.sound.playClick();
      this.announce('Game resumed.');
    }

    showGameOverScreen(isNewRecord) {
      this.state = STATE.GAME_OVER;
      this.finalScore.textContent = Math.floor(this.score);
      this.finalBest.textContent = this.saveData.bestScore;
      this.finalDist.textContent = `${Math.floor(this.distance)}m`;
      this.finalCoins.textContent = this.coins;

      if (this.newRecordBadge) {
        this.newRecordBadge.style.display = isNewRecord ? 'inline-flex' : 'none';
      }

      this.gameoverScreen.style.display = 'flex';
      this.announce(`Run terminated. Final score: ${Math.floor(this.score)}. Distance: ${Math.floor(this.distance)} meters.`);
      if (window.lucide) lucide.createIcons();
    }

    openHowToPlayModal() {
      this.sound.playClick();
      this.previousStateBeforeModal = this.state;
      this.howToPlayModal.style.display = 'flex';
      this.announce('How to play instructions dialog opened.');
      if (window.lucide) lucide.createIcons();
    }

    closeHowToPlayModal() {
      this.sound.playClick();
      this.howToPlayModal.style.display = 'none';
      this.state = this.previousStateBeforeModal;
      this.lastFrameTime = performance.now();
      this.announce('Instructions closed.');
    }

    // --- Game Lifecycle ---
    startNewGame() {
      this.sound.stopAll();
      this.sound.init();
      this.sound.playStart();

      // Reset values
      this.score = 0;
      this.distance = 0;
      this.coins = 0;
      this.speed = CONFIG.INITIAL_SPEED;
      this.trackOffset = 0;

      // Reset Player
      this.player.lane = 1;
      this.player.targetLane = 1;
      this.player.x = CONFIG.CANVAS_WIDTH / 2;
      this.player.y = CONFIG.BASELINE_Y;
      this.player.isJumping = false;
      this.player.jumpTimer = 0;
      this.player.jumpHeight = 0;
      this.player.isSliding = false;
      this.player.slideTimer = 0;
      this.player.runCycle = 0;
      this.player.invulnerableTimer = 0.5;

      // Clear Entities
      this.obstacles = [];
      this.coinsList = [];
      this.particles = [];
      this.floatingTexts = [];
      this.spawnTimer = 0.6; // Brief initial runway

      // Hide Overlays
      this.startScreen.style.display = 'none';
      this.pauseScreen.style.display = 'none';
      this.gameoverScreen.style.display = 'none';
      this.howToPlayModal.style.display = 'none';

      // Set State
      this.state = STATE.PLAYING;
      this.lastFrameTime = performance.now();
      this.announce('Run initiated! Good luck, Cyber Runner.');

      // Refresh HUD
      this.updateHud();
    }

    // --- Player Action Handlers ---
    moveLane(direction) {
      if (this.state !== STATE.PLAYING) return;
      const target = this.player.targetLane + direction;
      if (target >= 0 && target < CONFIG.LANES) {
        this.player.targetLane = target;
        this.sound.playLaneSwitch();
      }
    }

    jump() {
      if (this.state !== STATE.PLAYING) return;
      // Cannot jump if already airborne
      if (this.player.isJumping) return;

      // If sliding, cancel slide immediately and jump
      if (this.player.isSliding) {
        this.player.isSliding = false;
        this.player.slideTimer = 0;
      }

      this.player.isJumping = true;
      this.player.jumpTimer = 0;
      this.sound.playJump();

      // Thruster spark particles
      for (let i = 0; i < 8; i++) {
        this.particles.push(new Particle(
          this.player.x + (Math.random() * 16 - 8),
          this.player.y - 10,
          (Math.random() - 0.5) * 60,
          Math.random() * 50 + 40,
          '#00f0ff',
          0.35,
          3.5
        ));
      }
    }

    slide() {
      if (this.state !== STATE.PLAYING) return;
      // Cannot slide while airborne
      if (this.player.isJumping) return;

      this.player.isSliding = true;
      this.player.slideTimer = 0;
      this.sound.playSlide();

      // Road friction sparks
      for (let i = 0; i < 10; i++) {
        this.particles.push(new Particle(
          this.player.x + (Math.random() * 20 - 10),
          this.player.y + 4,
          (Math.random() - 0.5) * 80,
          -Math.random() * 30,
          '#ec4899',
          0.3,
          2.5
        ));
      }
    }

    // --- Spawner Logic (Fair, Varied, Solvable Waves) ---
    updateSpawner(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnWave();

        // Calculate next spawn interval based on current speed and distance
        const speedRatio = (this.speed - CONFIG.INITIAL_SPEED) / (CONFIG.MAX_SPEED - CONFIG.INITIAL_SPEED);
        const interval = MathUtils.lerp(CONFIG.BASE_SPAWN_INTERVAL, CONFIG.MIN_SPAWN_INTERVAL, speedRatio);
        this.spawnTimer = interval + Math.random() * 0.25;
      }
    }

    spawnWave() {
      // Pick a solvable pattern template
      const roll = Math.random();

      if (this.distance < 250) {
        // Early Game: Gentle Single Obstacles + Frequent Coins
        const lane = Math.floor(Math.random() * 3);
        const type = Math.random() < 0.6 ? OBSTACLE_TYPES.BARRIER : OBSTACLE_TYPES.BLOCKER;
        this.obstacles.push(new Obstacle(type, lane, 1.0));

        // Place coins in an adjacent open lane
        const coinLane = (lane + (Math.random() < 0.5 ? 1 : 2)) % 3;
        this.spawnCoinSequence(coinLane, 1.05, 3);
      }
      else if (this.distance < 750) {
        // Mid Game: Introduce Overhead Lasers & Double Obstacles with Guaranteed Safe Lane
        if (roll < 0.45) {
          // Single obstacle with coin arc
          const lane = Math.floor(Math.random() * 3);
          const type = Math.random() < 0.5 ? OBSTACLE_TYPES.LASER : OBSTACLE_TYPES.BARRIER;
          this.obstacles.push(new Obstacle(type, lane, 1.0));
          const openLane = (lane + 1) % 3;
          this.spawnCoinSequence(openLane, 1.05, 4);
        } else {
          // Double Obstacle Wave: 2 lanes blocked, 1 lane completely free
          const safeLane = Math.floor(Math.random() * 3);
          for (let l = 0; l < 3; l++) {
            if (l !== safeLane) {
              const type = Math.random() < 0.4 ? OBSTACLE_TYPES.BARRIER : OBSTACLE_TYPES.BLOCKER;
              this.obstacles.push(new Obstacle(type, l, 1.0));
            }
          }
          // Spawn coins leading through the safe lane!
          this.spawnCoinSequence(safeLane, 1.0, 3);
        }
      }
      else {
        // Late Game / Endless Overdrive: Diverse challenge combinations
        if (roll < 0.35) {
          // Action Choice: e.g. Lane 0 Jump, Lane 1 Blocker, Lane 2 Slide
          const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
          this.obstacles.push(new Obstacle(OBSTACLE_TYPES.BARRIER, lanes[0], 1.0));
          this.obstacles.push(new Obstacle(OBSTACLE_TYPES.LASER, lanes[1], 1.0));
          // Lane 2 is completely open or has coins!
          this.spawnCoinSequence(lanes[2], 1.0, 3);
        }
        else if (roll < 0.70) {
          // Split Blockers: 2 lanes blocked, 1 open
          const safeLane = Math.floor(Math.random() * 3);
          for (let l = 0; l < 3; l++) {
            if (l !== safeLane) {
              const type = Math.random() < 0.5 ? OBSTACLE_TYPES.BLOCKER : OBSTACLE_TYPES.BARRIER;
              this.obstacles.push(new Obstacle(type, l, 1.0));
            }
          }
          this.spawnCoinSequence(safeLane, 1.0, 4);
        }
        else {
          // Staggered Wave: Obstacle in lane A, then slight delay obstacle in lane B
          const laneA = Math.floor(Math.random() * 3);
          const laneB = (laneA + (Math.random() < 0.5 ? 1 : 2)) % 3;
          this.obstacles.push(new Obstacle(OBSTACLE_TYPES.BARRIER, laneA, 1.0));
          this.obstacles.push(new Obstacle(OBSTACLE_TYPES.LASER, laneB, 1.25));
        }
      }
    }

    spawnCoinSequence(lane, startZ, count) {
      for (let i = 0; i < count; i++) {
        this.coinsList.push(new EnergyCoin(lane, startZ + i * 0.08));
      }
    }

    // --- Main Game Loop & Updates ---
    startLoop() {
      const loop = (timestamp) => {
        const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1); // Cap delta time to prevent spiral
        this.lastFrameTime = timestamp;

        this.update(dt);
        this.render();

        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    }

    update(dt) {
      // Background animation during Menu or Paused states
      if (this.state === STATE.MENU || this.state === STATE.PAUSED) {
        this.trackOffset = (this.trackOffset + 0.15 * dt) % 1.0;
        this.billboardCycle += dt;
        if (this.billboardCycle > 3.0) {
          this.billboardCycle = 0;
          this.billboardIndex = (this.billboardIndex + 1) % this.billboardTexts.length;
        }
        return;
      }

      if (this.state !== STATE.PLAYING) return;

      // Update Progressive Speed & Distance
      this.speed = Math.min(CONFIG.MAX_SPEED, this.speed + CONFIG.SPEED_ACCELERATION * dt * 60);
      const forwardMeters = this.speed * 85 * dt;
      this.distance += forwardMeters;
      this.score += forwardMeters * CONFIG.POINTS_PER_METER;

      // Update Road Stripe Offset
      this.trackOffset = (this.trackOffset + this.speed * dt * 1.8) % 1.0;

      // Billboard Text Cycler
      this.billboardCycle += dt;
      if (this.billboardCycle > 3.0) {
        this.billboardCycle = 0;
        this.billboardIndex = (this.billboardIndex + 1) % this.billboardTexts.length;
      }

      // Update Player Lane Interpolation
      const targetX = MathUtils.getLaneX(this.player.targetLane, 0);
      this.player.x = MathUtils.lerp(this.player.x, targetX, CONFIG.LANE_LERP_SPEED * dt);
      if (Math.abs(this.player.x - targetX) < 1.0) {
        this.player.x = targetX;
        this.player.lane = this.player.targetLane;
      }

      // Update Jump Physics
      if (this.player.isJumping) {
        this.player.jumpTimer += dt;
        const jumpProgress = this.player.jumpTimer / CONFIG.JUMP_DURATION;
        if (jumpProgress >= 1.0) {
          this.player.isJumping = false;
          this.player.jumpTimer = 0;
          this.player.jumpHeight = 0;
        } else {
          // Smooth parabolic arc: 4 * h * t * (1 - t)
          this.player.jumpHeight = 4 * CONFIG.JUMP_MAX_HEIGHT * jumpProgress * (1 - jumpProgress);
        }
      }

      // Update Slide Physics
      if (this.player.isSliding) {
        this.player.slideTimer += dt;
        if (this.player.slideTimer >= CONFIG.SLIDE_DURATION) {
          this.player.isSliding = false;
          this.player.slideTimer = 0;
        }
      }

      // Update Run Cycle
      this.player.runCycle += dt * (12 + this.speed * 8);

      // Decrement Invulnerability
      if (this.player.invulnerableTimer > 0) {
        this.player.invulnerableTimer -= dt;
      }

      // Update Spawner
      this.updateSpawner(dt);

      // Update Obstacles
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.update(dt, this.speed);

        // Continuous Collision Swept Volume Check (#534)
        // Prevents obstacle collision box desync / tunnel-through at high speeds
        const entersWindow = obs.prevZ >= CONFIG.COLLISION_Z_MIN && obs.z <= CONFIG.COLLISION_Z_MAX;
        const inWindow = obs.z >= CONFIG.COLLISION_Z_MIN && obs.z <= CONFIG.COLLISION_Z_MAX;
        if (
          this.player.invulnerableTimer <= 0 &&
          (inWindow || entersWindow) &&
          this.isPlayerInLane(obs.laneIndex)
        ) {
          if (this.checkCollision(obs)) {
            this.handleCollision();
            return;
          }
        }

        // Cleanup expired obstacles
        if (obs.z < -0.15) {
          this.obstacles.splice(i, 1);
        }
      }

      // Update Energy Coins
      for (let i = this.coinsList.length - 1; i >= 0; i--) {
        const coin = this.coinsList[i];
        coin.update(dt, this.speed);

        // Pickup Check
        if (
          !coin.collected &&
          coin.z >= 0.00 &&
          coin.z <= 0.12 &&
          this.isPlayerInLane(coin.laneIndex)
        ) {
          coin.collected = true;
          this.coins += 1;
          this.score += CONFIG.POINTS_PER_COIN;
          this.sound.playCoin();

          // Spawn floating text & sparkles
          const pickupX = MathUtils.getLaneX(coin.laneIndex, coin.z);
          const pickupY = MathUtils.getScreenY(coin.z) - 20;
          this.floatingTexts.push(new FloatingText(`+${CONFIG.POINTS_PER_COIN}`, pickupX, pickupY));

          for (let p = 0; p < 12; p++) {
            this.particles.push(new Particle(
              pickupX,
              pickupY,
              (Math.random() - 0.5) * 120,
              (Math.random() - 0.5) * 120,
              '#00f0ff',
              0.4,
              3.0
            ));
          }
        }

        // Cleanup expired coins
        if (coin.z < -0.15 || (coin.collected && coin.z < 0)) {
          this.coinsList.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update(dt);
        if (this.particles[i].life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update Floating Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        this.floatingTexts[i].update(dt);
        if (this.floatingTexts[i].life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }

      // Update In-Game HUD
      this.updateHud();
    }

    isPlayerInLane(targetLaneIndex) {
      const laneCenter = MathUtils.getLaneX(targetLaneIndex, 0);
      const laneWidth = MathUtils.getRoadWidth(0) / 3;
      return Math.abs(this.player.x - laneCenter) < laneWidth * 0.42;
    }

    checkCollision(obstacle) {
      if (obstacle.type === OBSTACLE_TYPES.BARRIER) {
        // Must jump to avoid ground barrier!
        // Collision occurs if NOT jumping or jump height is too low
        return !this.player.isJumping || this.player.jumpHeight < 28;
      }
      else if (obstacle.type === OBSTACLE_TYPES.LASER) {
        // Must slide to duck under laser beam!
        // Collision occurs if NOT sliding
        return !this.player.isSliding;
      }
      else if (obstacle.type === OBSTACLE_TYPES.BLOCKER) {
        // Tall drone / firewall: cannot be jumped over or slid under
        return true;
      }
      return false;
    }

    handleCollision() {
      this.sound.playCrash();

      // Spawn collision burst
      for (let i = 0; i < 28; i++) {
        this.particles.push(new Particle(
          this.player.x,
          this.player.y - this.player.jumpHeight - 15,
          (Math.random() - 0.5) * 220,
          (Math.random() - 0.5) * 220,
          Math.random() < 0.5 ? '#ef4444' : '#00f0ff',
          0.65,
          4.5
        ));
      }

      // Save Best Score
      const isNewRecord = StorageManager.updateBest(
        Math.floor(this.score),
        Math.floor(this.distance),
        this.coins
      );

      this.updateHudBest();

      // Show Game Over Overlay
      setTimeout(() => {
        this.showGameOverScreen(isNewRecord);
      }, 350);
    }

    updateHud() {
      if (this.hudScore) this.hudScore.textContent = Math.floor(this.score);
      if (this.hudDistance) this.hudDistance.textContent = `${Math.floor(this.distance)}m`;
      if (this.hudCoins) this.hudCoins.textContent = this.coins;
    }

    // --- Rendering Engine (2.5D Pseudo-3D Perspective) ---
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // 1. Cyberpunk Sky & Skyline
      this.renderSkyAndCity(ctx);

      // 2. Neon Highway & Moving Track Lines
      this.renderHighway(ctx);

      // 3. Render In-World Entities (Sorted by Z depth from farthest to closest)
      this.renderWorldEntities(ctx);

      // 4. Render Player Character
      this.renderPlayer(ctx);

      // 5. Render Floating Particles & Text Popups
      this.particles.forEach(p => p.draw(ctx));
      this.floatingTexts.forEach(ft => ft.draw(ctx));

      // 6. Speed Vignette / Motion Glow at High Speeds
      if (this.speed > 1.0 && this.state === STATE.PLAYING) {
        this.renderSpeedVignette(ctx);
      }
    }

    renderSkyAndCity(ctx) {
      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CONFIG.HORIZON_Y);
      skyGrad.addColorStop(0, '#030712');
      skyGrad.addColorStop(0.5, '#0a0f24');
      skyGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.HORIZON_Y);

      // Distant Synthwave Sun on the Horizon
      const sunY = CONFIG.HORIZON_Y - 35;
      const sunGrad = ctx.createLinearGradient(240, sunY - 45, 240, sunY + 45);
      sunGrad.addColorStop(0, '#ec4899');
      sunGrad.addColorStop(0.6, '#a855f7');
      sunGrad.addColorStop(1, '#00f0ff');

      ctx.save();
      ctx.beginPath();
      ctx.arc(240, sunY, 45, Math.PI, 0, false);
      ctx.fillStyle = sunGrad;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 20;
      ctx.fill();

      // Horizontal Sun Scanline Slits
      ctx.fillStyle = '#0a0f24';
      for (let s = 1; s <= 5; s++) {
        const slitY = sunY - 25 + s * 7;
        ctx.fillRect(190, slitY, 100, 2.5);
      }
      ctx.restore();

      // Cyber City Skyline Silhouettes
      const buildings = [
        { x: 10, w: 32, h: 80, c: '#0b1120', glow: '#00f0ff' },
        { x: 48, w: 42, h: 110, c: '#0f172a', glow: '#a855f7' },
        { x: 96, w: 28, h: 70, c: '#0b1120', glow: '#38bdf8' },
        { x: 130, w: 38, h: 95, c: '#0f172a', glow: '#ec4899' },
        { x: 312, w: 40, h: 100, c: '#0f172a', glow: '#00f0ff' },
        { x: 358, w: 30, h: 75, c: '#0b1120', glow: '#a855f7' },
        { x: 394, w: 44, h: 115, c: '#0f172a', glow: '#38bdf8' },
        { x: 444, w: 26, h: 65, c: '#0b1120', glow: '#ec4899' }
      ];

      buildings.forEach(b => {
        const by = CONFIG.HORIZON_Y - b.h;
        ctx.fillStyle = b.c;
        ctx.fillRect(b.x, by, b.w, b.h);

        // Building Neon Antennas & Roof Lights
        ctx.strokeStyle = b.glow;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, by);
        ctx.lineTo(b.x + b.w / 2, by - 12);
        ctx.stroke();

        ctx.fillStyle = b.glow;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, by - 12, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Building Windows Matrix
        ctx.fillStyle = b.glow;
        ctx.globalAlpha = 0.35;
        for (let r = 0; r < Math.floor(b.h / 14); r++) {
          for (let c = 0; c < Math.floor(b.w / 10); c++) {
            if ((r + c + Math.floor(b.x)) % 3 !== 0) {
              ctx.fillRect(b.x + 4 + c * 9, by + 8 + r * 12, 4, 6);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      });

      // Holographic Digital Billboard above Horizon
      ctx.save();
      const bbW = 140;
      const bbH = 26;
      const bbX = 240 - bbW / 2;
      const bbY = CONFIG.HORIZON_Y - 45;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.strokeRect(bbX, bbY, bbW, bbH);
      ctx.fillRect(bbX, bbY, bbW, bbH);

      // Billboard Text
      ctx.font = 'bold 11px "Space Grotesk", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'center';
      ctx.fillText(this.billboardTexts[this.billboardIndex], 240, bbY + 17);
      ctx.restore();
    }

    renderHighway(ctx) {
      const topW = CONFIG.ROAD_TOP_WIDTH;
      const botW = CONFIG.ROAD_BOT_WIDTH;
      const horizY = CONFIG.HORIZON_Y;
      const botY = CONFIG.CANVAS_HEIGHT;

      // Road Bed Asphalt with Gradient
      const roadGrad = ctx.createLinearGradient(0, horizY, 0, botY);
      roadGrad.addColorStop(0, '#0f172a');
      roadGrad.addColorStop(0.4, '#090e1a');
      roadGrad.addColorStop(1, '#030712');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(240 - topW / 2, horizY);
      ctx.lineTo(240 + topW / 2, horizY);
      ctx.lineTo(240 + botW / 2, botY);
      ctx.lineTo(240 - botW / 2, botY);
      ctx.closePath();
      ctx.fillStyle = roadGrad;
      ctx.fill();

      // Outer Guardrails / Neon Shoulders
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;

      // Left Guardrail
      ctx.beginPath();
      ctx.moveTo(240 - topW / 2, horizY);
      ctx.lineTo(240 - botW / 2, botY);
      ctx.stroke();

      // Right Guardrail
      ctx.beginPath();
      ctx.moveTo(240 + topW / 2, horizY);
      ctx.lineTo(240 + botW / 2, botY);
      ctx.stroke();
      ctx.restore();

      // Moving Cross-Section Road Grid Slices (creates rushing forward speed)
      ctx.save();
      const numSlices = 14;
      for (let i = 0; i < numSlices; i++) {
        // Compute cyclic Z position moving from 1.0 (horizon) down to 0.0 (camera)
        let z = (i / numSlices - this.trackOffset / numSlices);
        if (z < 0) z += 1.0;

        const sy = MathUtils.getScreenY(z);
        const rw = MathUtils.getRoadWidth(z);
        const alpha = Math.pow(1 - z, 1.5) * 0.45;

        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.lineWidth = Math.max(1, (1 - z) * 2.5);
        ctx.beginPath();
        ctx.moveTo(240 - rw / 2, sy);
        ctx.lineTo(240 + rw / 2, sy);
        ctx.stroke();
      }
      ctx.restore();

      // Neon Lane Dividers (Dashed stripes between Lane 0-1 and Lane 1-2)
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;

      const numDashes = 12;
      for (let i = 0; i < numDashes; i++) {
        let z = (i / numDashes - this.trackOffset / numDashes);
        if (z < 0) z += 1.0;

        const zNext = Math.max(0, z - 0.045);
        const sy1 = MathUtils.getScreenY(z);
        const sy2 = MathUtils.getScreenY(zNext);
        const alpha = Math.pow(1 - z, 1.2) * 0.9;
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.lineWidth = Math.max(1.2, (1 - z) * 3);

        // Divider 1 (between Lane 0 and 1)
        const lx1 = 240 - MathUtils.getRoadWidth(z) / 6;
        const lx2 = 240 - MathUtils.getRoadWidth(zNext) / 6;
        ctx.beginPath();
        ctx.moveTo(lx1, sy1);
        ctx.lineTo(lx2, sy2);
        ctx.stroke();

        // Divider 2 (between Lane 1 and 2)
        const rx1 = 240 + MathUtils.getRoadWidth(z) / 6;
        const rx2 = 240 + MathUtils.getRoadWidth(zNext) / 6;
        ctx.beginPath();
        ctx.moveTo(rx1, sy1);
        ctx.lineTo(rx2, sy2);
        ctx.stroke();
      }
      ctx.restore();
    }

    renderWorldEntities(ctx) {
      // Merge obstacles and coins into a depth-sorted list (farthest z=1.0 drawn first)
      const entities = [
        ...this.obstacles.map(o => ({ type: 'obstacle', data: o, z: o.z })),
        ...this.coinsList.filter(c => !c.collected).map(c => ({ type: 'coin', data: c, z: c.z }))
      ];

      entities.sort((a, b) => b.z - a.z);

      entities.forEach(ent => {
        if (ent.z < 0 || ent.z > 1.0) return;
        if (ent.type === 'obstacle') {
          this.renderObstacle(ctx, ent.data);
        } else {
          this.renderCoin(ctx, ent.data);
        }
      });
    }

    renderObstacle(ctx, obs) {
      const x = MathUtils.getLaneX(obs.laneIndex, obs.z);
      const y = MathUtils.getScreenY(obs.z);
      const scale = MathUtils.getScale(obs.z);
      const laneW = (MathUtils.getRoadWidth(obs.z) / 3) * 0.88;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      if (obs.type === OBSTACLE_TYPES.BARRIER) {
        // Ground barrier (electrified hurdle requiring JUMP)
        const bw = laneW / scale;
        const bh = 32;

        // Base Hurdles Posts
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-bw / 2, -bh, 8, bh);
        ctx.fillRect(bw / 2 - 8, -bh, 8, bh);

        // Warning Hazard Stripes
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-bw / 2 + 8, -bh + 4, bw - 16, 12);
        ctx.fillStyle = '#0f172a';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-bw / 2 + 14 + i * 16, -bh + 4);
          ctx.lineTo(-bw / 2 + 22 + i * 16, -bh + 4);
          ctx.lineTo(-bw / 2 + 16 + i * 16, -bh + 16);
          ctx.lineTo(-bw / 2 + 8 + i * 16, -bh + 16);
          ctx.fill();
        }

        // Oscillating Electric Arc
        ctx.strokeStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-bw / 2 + 4, -bh - 4);
        const steps = 6;
        for (let s = 1; s <= steps; s++) {
          const sx = -bw / 2 + 4 + (bw - 8) * (s / steps);
          const sy = -bh - 4 + (Math.random() * 8 - 4);
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Warning Icon in Center
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -bh + 10, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      else if (obs.type === OBSTACLE_TYPES.LASER) {
        // Overhead Laser Barrier (floating beam requiring SLIDE)
        const lw = laneW / scale;
        const beamY = -62; // High overhead beam height

        // Floating Pylon Emitters
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;

        // Left emitter pylon
        ctx.strokeRect(-lw / 2, beamY - 12, 10, 24);
        ctx.fillRect(-lw / 2, beamY - 12, 10, 24);

        // Right emitter pylon
        ctx.strokeRect(lw / 2 - 10, beamY - 12, 10, 24);
        ctx.fillRect(lw / 2 - 10, beamY - 12, 10, 24);

        // High-Energy Pulsating Laser Beam
        const beamGrad = ctx.createLinearGradient(0, beamY - 6, 0, beamY + 6);
        beamGrad.addColorStop(0, '#ec4899');
        beamGrad.addColorStop(0.5, '#ffffff');
        beamGrad.addColorStop(1, '#a855f7');

        ctx.fillStyle = beamGrad;
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 16;
        ctx.fillRect(-lw / 2 + 8, beamY - 4, lw - 16, 8);

        // Laser Warning Chevron
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[!] LASER GRID [!]', 0, beamY - 14);
      }
      else if (obs.type === OBSTACLE_TYPES.BLOCKER) {
        // Tall Firewall Drone / Pylon (requires STEER to open lane)
        const pw = (laneW / scale) * 0.72;
        const ph = 84;

        // Pylon Outer Body
        ctx.fillStyle = '#090e1a';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.rect(-pw / 2, -ph, pw, ph);
        ctx.stroke();
        ctx.fill();

        // Digital Grid Lines on Pylon Face
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        for (let g = 1; g <= 4; g++) {
          ctx.beginPath();
          ctx.moveTo(-pw / 2, -ph + g * 16);
          ctx.lineTo(pw / 2, -ph + g * 16);
          ctx.stroke();
        }

        // Flashing Warning Chevron Shield
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -ph + 20);
        ctx.lineTo(-12, -ph + 36);
        ctx.lineTo(12, -ph + 36);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BLOCK', 0, -ph + 54);
      }

      ctx.restore();
    }

    renderCoin(ctx, coin) {
      const x = MathUtils.getLaneX(coin.laneIndex, coin.z);
      const y = MathUtils.getScreenY(coin.z) - 22;
      const scale = MathUtils.getScale(coin.z);

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // Rotating Octagonal Energy Core
      const rot = coin.animAngle;
      const radius = 14;

      ctx.save();
      ctx.rotate(rot);

      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;

      // Draw Octagon
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const px = Math.cos(ang) * radius;
        const py = Math.sin(ang) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Inner Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
    }

    renderPlayer(ctx) {
      const px = this.player.x;
      const py = this.player.y;
      const jumpH = this.player.jumpHeight;
      const isSlide = this.player.isSliding;

      // 1. Player Road Shadow
      ctx.save();
      const shadowScale = Math.max(0.4, 1.0 - jumpH / (CONFIG.JUMP_MAX_HEIGHT * 1.5));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(px, py + 2, 22 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Player Character Model
      ctx.save();
      ctx.translate(px, py - jumpH);

      if (isSlide) {
        // --- Sliding Pose ---
        // Crouched aerodynamic cyber-slide
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;

        // Low Torso
        ctx.beginPath();
        ctx.roundRect(-18, -22, 36, 18, 6);
        ctx.stroke();
        ctx.fill();

        // Low Cyber Visor
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-12, -26, 24, 6);

        // Sliding Skid Boots
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-22, -6, 18, 6);
        ctx.fillRect(4, -6, 18, 6);

        // Ground Friction Sparks
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(-18, 0, 3, 0, Math.PI * 2);
        ctx.arc(18, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      else {
        // --- Running or Jumping Pose ---
        const legCycle = Math.sin(this.player.runCycle);

        // Jet Thruster Flames from Cyber-Pack
        ctx.save();
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;

        const flameH = this.player.isJumping ? 18 : 8 + Math.abs(legCycle) * 6;
        ctx.beginPath();
        ctx.moveTo(-7, -28);
        ctx.lineTo(-4, -28 + flameH);
        ctx.lineTo(-1, -28);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(1, -28);
        ctx.lineTo(4, -28 + flameH);
        ctx.lineTo(7, -28);
        ctx.fill();
        ctx.restore();

        // Cybernetic Legs
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        // Left Leg
        const leftLegY = this.player.isJumping ? -10 : -4 + legCycle * 8;
        ctx.beginPath();
        ctx.moveTo(-8, -26);
        ctx.lineTo(-9, leftLegY);
        ctx.stroke();

        // Right Leg
        const rightLegY = this.player.isJumping ? -10 : -4 - legCycle * 8;
        ctx.beginPath();
        ctx.moveTo(8, -26);
        ctx.lineTo(9, rightLegY);
        ctx.stroke();

        // Cyber Backpack / Chassis
        ctx.fillStyle = '#090e1a';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(-14, -48, 28, 24, 6);
        ctx.stroke();
        ctx.fill();

        // Glowing Spine Power Conduit
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -46);
        ctx.lineTo(0, -26);
        ctx.stroke();

        // Helmet & Neon Cyan Visor
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -56, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();

        // Visor Bar
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-9, -59, 18, 6);
      }

      ctx.restore();
    }

    renderSpeedVignette(ctx) {
      const intensity = ((this.speed - 1.0) / (CONFIG.MAX_SPEED - 1.0)) * 0.35;
      const vigGrad = ctx.createRadialGradient(240, 320, 180, 240, 320, 320);
      vigGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      vigGrad.addColorStop(1, `rgba(0, 240, 255, ${intensity})`);

      ctx.save();
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
      ctx.restore();
    }

    // --- Input & Event Listeners ---
    bindEvents() {
      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        // Prevent default scrolling for game controls
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        if (e.code === 'KeyM') {
          this.toggleSound();
          return;
        }

        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.state === STATE.PLAYING) {
            this.showPauseScreen();
          } else if (this.state === STATE.PAUSED) {
            this.resumeGame();
          }
          return;
        }

        if (e.code === 'Enter') {
          if (this.state === STATE.MENU || this.state === STATE.GAME_OVER) {
            this.startNewGame();
          }
          return;
        }

        if (this.state !== STATE.PLAYING) return;

        // Lane Switching
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.moveLane(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.moveLane(1);
        }

        // Jump
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
          this.jump();
        }

        // Slide
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.slide();
        }
      });

      // In-Game HUD Buttons
      document.getElementById('crnr-btn-sound')?.addEventListener('click', () => this.toggleSound());
      document.getElementById('crnr-btn-pause')?.addEventListener('click', () => {
        if (this.state === STATE.PLAYING) {
          this.showPauseScreen();
        } else if (this.state === STATE.PAUSED) {
          this.resumeGame();
        }
      });

      // Start Screen Buttons
      document.getElementById('crnr-btn-play')?.addEventListener('click', () => this.startNewGame());
      document.getElementById('crnr-btn-how-to-play')?.addEventListener('click', () => this.openHowToPlayModal());

      // Pause Screen Buttons
      document.getElementById('crnr-btn-resume')?.addEventListener('click', () => this.resumeGame());
      document.getElementById('crnr-btn-restart-pause')?.addEventListener('click', () => this.startNewGame());
      document.getElementById('crnr-btn-instructions-pause')?.addEventListener('click', () => this.openHowToPlayModal());
      document.getElementById('crnr-btn-menu-pause')?.addEventListener('click', () => this.showStartScreen());

      // Game Over Screen Buttons
      document.getElementById('crnr-btn-restart')?.addEventListener('click', () => this.startNewGame());
      document.getElementById('crnr-btn-how-to-play-gameover')?.addEventListener('click', () => this.openHowToPlayModal());
      document.getElementById('crnr-btn-menu-gameover')?.addEventListener('click', () => this.showStartScreen());

      // How to Play Modal Buttons
      document.getElementById('crnr-btn-close-modal')?.addEventListener('click', () => this.closeHowToPlayModal());
      document.getElementById('crnr-btn-confirm-modal')?.addEventListener('click', () => this.closeHowToPlayModal());

      // Mobile Touch Virtual D-Pad Buttons
      document.getElementById('crnr-touch-left')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.moveLane(-1);
      });
      document.getElementById('crnr-touch-right')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.moveLane(1);
      });
      document.getElementById('crnr-touch-jump')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.jump();
      });
      document.getElementById('crnr-touch-slide')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.slide();
      });

      // Mobile Touch Swipe Gestures on Canvas
      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
          this.touchStartTime = performance.now();
        }
      }, { passive: true });

      this.canvas.addEventListener('touchend', (e) => {
        if (this.state !== STATE.PLAYING) return;
        if (!e.changedTouches || e.changedTouches.length === 0) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - this.touchStartX;
        const dy = touchEndY - this.touchStartY;
        const duration = performance.now() - this.touchStartTime;

        // Require swift swipe (< 400ms) with minimum travel distance (25px)
        if (duration < 400) {
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
            // Horizontal swipe: lane switch
            if (dx < 0) {
              this.moveLane(-1);
            } else {
              this.moveLane(1);
            }
          } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 25) {
            // Vertical swipe: jump or slide
            if (dy < 0) {
              this.jump();
            } else {
              this.slide();
            }
          }
        }
      }, { passive: true });
    }
  }

  // --- Bootstrap on DOM Ready ---
  let activeGameInstance = null;
  window.addEventListener('DOMContentLoaded', () => {
    activeGameInstance = new CyberRunnerGame();
  });

  // Clean audio on teardown (#507)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ARCADEVERSE_TEARDOWN') {
      if (activeGameInstance && activeGameInstance.sound) {
        activeGameInstance.sound.stopAll();
        if (activeGameInstance.sound.ctx && activeGameInstance.sound.ctx.state !== 'closed') {
          try { activeGameInstance.sound.ctx.close(); } catch (_) {}
        }
      }
    }
  });

})();
