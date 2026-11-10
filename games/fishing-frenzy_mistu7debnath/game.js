/**
 * FISHING FRENZY — Arcade Fishing Simulator
 * NSOC Winter Edition 2026 | Contributor: mistu7debnath
 * Pure Vanilla HTML5 Canvas + Web Audio API. 100% self-contained.
 */

(function () {
  'use strict';

  // =========================================================================
  // CONSTANTS & ENUMS
  // =========================================================================

  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 540;
  const SESSION_DURATION = 75; // 75-second timed expedition

  const STORAGE_KEY_BEST = 'arcadeverse_fishing_frenzy_best';
  const STORAGE_KEY_MUTED = 'arcadeverse_fishing_frenzy_muted';

  const GAME_STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
  };

  const FISHING_STATE = {
    IDLE: 'IDLE',         // Standing on dock, waiting to cast
    CASTING: 'CASTING',   // Rod swings, bobber flies through air
    WAITING: 'WAITING',   // Bobber floating on water, fish swimming around
    NIBBLING: 'NIBBLING', // Fish approaching, slight ripples & bobber dip
    BITE: 'BITE',         // Strike! Active reaction timing window
    REELING: 'REELING',   // Hook set, pulling fish up
    CAUGHT: 'CAUGHT',     // Fish leaps out, celebrating catch
    MISSED: 'MISSED'      // Fish got away, resetting line
  };

  // Data-driven Fish Species
  const FISH_SPECIES = [
    {
      id: 'minnow',
      name: 'Small Minnow',
      rarity: 'Common',
      rarityClass: 'ff-rarity-common',
      points: 10,
      color: '#38bdf8',
      accentColor: '#e0f2fe',
      biteWindow: 1.4, // seconds to react
      weightMin: 0.2,
      weightMax: 0.6,
      bodyLength: 26,
      bodyHeight: 12,
      finStyle: 'slender',
      probability: 0.35,
      swimSpeed: 70
    },
    {
      id: 'perch',
      name: 'Blue Perch',
      rarity: 'Common',
      rarityClass: 'ff-rarity-common',
      points: 25,
      color: '#06b6d4',
      accentColor: '#f97316',
      biteWindow: 1.2,
      weightMin: 0.8,
      weightMax: 1.8,
      bodyLength: 36,
      bodyHeight: 18,
      finStyle: 'spiny',
      probability: 0.25,
      swimSpeed: 85
    },
    {
      id: 'carp',
      name: 'Golden Carp',
      rarity: 'Uncommon',
      rarityClass: 'ff-rarity-uncommon',
      points: 50,
      color: '#f59e0b',
      accentColor: '#fef08a',
      biteWindow: 1.0,
      weightMin: 2.5,
      weightMax: 5.5,
      bodyLength: 48,
      bodyHeight: 24,
      finStyle: 'fan',
      probability: 0.18,
      swimSpeed: 95
    },
    {
      id: 'puffer',
      name: 'Spiny Pufferfish',
      rarity: 'Rare',
      rarityClass: 'ff-rarity-rare',
      points: 80,
      color: '#a855f7',
      accentColor: '#f472b6',
      biteWindow: 0.85,
      weightMin: 1.2,
      weightMax: 3.0,
      bodyLength: 38,
      bodyHeight: 32,
      finStyle: 'round',
      probability: 0.12,
      swimSpeed: 105
    },
    {
      id: 'trout',
      name: 'Rainbow Trout',
      rarity: 'Rare',
      rarityClass: 'ff-rarity-rare',
      points: 110,
      color: '#10b981',
      accentColor: '#ec4899',
      biteWindow: 1.05,
      weightMin: 3.0,
      weightMax: 7.0,
      bodyLength: 52,
      bodyHeight: 20,
      finStyle: 'sleek',
      probability: 0.12,
      swimSpeed: 120
    },
    {
      id: 'koi',
      name: 'Legendary Koi',
      rarity: 'Legendary',
      rarityClass: 'ff-rarity-legendary',
      points: 200,
      color: '#ef4444',
      accentColor: '#fbbf24',
      biteWindow: 0.95,
      weightMin: 6.0,
      weightMax: 14.0,
      bodyLength: 60,
      bodyHeight: 26,
      finStyle: 'ribbon',
      probability: 0.08,
      swimSpeed: 140
    }
  ];

  // =========================================================================
  // PROCEDURAL AUDIO SYNTHESIZER (Web Audio API)
  // =========================================================================

  class SoundFX {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.initFromStorage();
    }

    initFromStorage() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_MUTED);
        this.isMuted = stored === 'true';
      } catch (e) {
        this.isMuted = false;
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      try {
        localStorage.setItem(STORAGE_KEY_MUTED, String(this.isMuted));
      } catch (e) {
        // ignore storage errors
      }
      return this.isMuted;
    }

    ensureContext() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => { });
        }
        return true;
      }
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        return true;
      } catch (e) {
        return false;
      }
    }

    playTone(freq, type, duration, gainStart = 0.15, gainEnd = 0.001) {
      if (this.isMuted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gainStart, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    playNoise(duration, filterFreq = 600, gainLevel = 0.2) {
      if (this.isMuted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainLevel, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    }

    playCast() {
      if (this.isMuted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    }

    playSplash() {
      this.playNoise(0.24, 700, 0.18);
      this.playTone(180, 'triangle', 0.18, 0.14);
    }

    playNibble() {
      this.playTone(520, 'sine', 0.08, 0.08);
    }

    playBite() {
      if (this.isMuted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      [740, 980].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.2, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.15);
      });
    }

    playCatchSuccess(isLegendary = false) {
      if (this.isMuted || !this.ensureContext()) return;
      const notes = isLegendary ? [523, 659, 784, 1046, 1318] : [440, 554, 659, 880];
      const now = this.ctx.currentTime;

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isLegendary ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(isLegendary ? 0.12 : 0.16, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    }

    playMiss() {
      if (this.isMuted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    }

    playTick() {
      this.playTone(800, 'sine', 0.04, 0.06);
    }

    playGameOver() {
      if (this.isMuted || !this.ensureContext()) return;
      const notes = [587, 523, 440, 392, 330];
      const now = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.14, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
    }
  }

  // =========================================================================
  // FLOATING TEXT & PARTICLE SYSTEMS
  // =========================================================================

  class FloatingText {
    constructor(x, y, text, color = '#f8fafc', size = 16, subtext = '') {
      this.x = x;
      this.y = y;
      this.text = text;
      this.subtext = subtext;
      this.color = color;
      this.size = size;
      this.alpha = 1;
      this.life = 1.2;
      this.maxLife = 1.2;
      this.vy = -38;
    }

    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt;
      this.alpha = Math.max(0, this.life / this.maxLife);
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.font = `bold ${this.size}px monospace`;
      ctx.fillStyle = this.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(this.text, this.x, this.y);

      if (this.subtext) {
        ctx.font = `bold ${Math.max(10, this.size - 4)}px sans-serif`;
        ctx.fillStyle = '#fef08a';
        ctx.fillText(this.subtext, this.x, this.y + 16);
      }
      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, vx, vy, color, size, life, shape = 'circle') {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size;
      this.life = life;
      this.maxLife = life;
      this.shape = shape;
      this.gravity = 80;
    }

    update(dt) {
      this.vy += this.gravity * dt;
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
      if (this.shape === 'star') {
        ctx.rect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      } else {
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  class Ripple {
    constructor(x, y, maxRadius = 35, speed = 40, color = 'rgba(56, 189, 248, 0.6)') {
      this.x = x;
      this.y = y;
      this.radius = 4;
      this.maxRadius = maxRadius;
      this.speed = speed;
      this.color = color;
      this.alpha = 1;
    }

    update(dt) {
      this.radius += this.speed * dt;
      this.alpha = Math.max(0, 1 - (this.radius / this.maxRadius));
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Elliptical perspective ripple on water surface
      ctx.ellipse(this.x, this.y, this.radius, this.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // =========================================================================
  // AMBIENT FISH SIMULATION (Underwater)
  // =========================================================================

  class AmbientFish {
    constructor(species, minX, maxX, minY, maxY) {
      this.species = species;
      this.minX = minX;
      this.maxX = maxX;
      this.minY = minY;
      this.maxY = maxY;

      this.x = minX + Math.random() * (maxX - minX);
      this.y = minY + Math.random() * (maxY - minY);
      this.direction = Math.random() < 0.5 ? 1 : -1;
      this.speed = species.swimSpeed * (0.6 + Math.random() * 0.5);
      this.baseY = this.y;
      this.wigglePhase = Math.random() * Math.PI * 2;
      this.isTargeting = false;
      this.targetX = 0;
      this.targetY = 0;
      this.escapeSpeed = 240;
      this.isEscaping = false;
    }

    update(dt, bobber) {
      this.wigglePhase += dt * 8;

      if (this.isEscaping) {
        this.x += this.direction * this.escapeSpeed * dt;
        this.y += 30 * dt;
        if (this.x < this.minX - 100 || this.x > this.maxX + 100) {
          this.resetFish();
        }
        return;
      }

      if (this.isTargeting && bobber) {
        // Move purposefully toward bobber
        const dx = bobber.x - this.x;
        const dy = bobber.y + 20 - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          this.direction = dx >= 0 ? 1 : -1;
          this.x += (dx / dist) * this.speed * 1.3 * dt;
          this.y += (dy / dist) * this.speed * 1.3 * dt;
        }
        return;
      }

      // Normal cruising behavior
      this.x += this.direction * this.speed * dt;
      this.y = this.baseY + Math.sin(this.wigglePhase * 0.4) * 8;

      // Boundary turnarounds
      if (this.direction === 1 && this.x > this.maxX) {
        this.direction = -1;
        this.baseY = this.minY + Math.random() * (this.maxY - this.minY);
      } else if (this.direction === -1 && this.x < this.minX) {
        this.direction = 1;
        this.baseY = this.minY + Math.random() * (this.maxY - this.minY);
      }
    }

    resetFish() {
      this.isEscaping = false;
      this.isTargeting = false;
      this.direction = Math.random() < 0.5 ? 1 : -1;
      this.x = this.direction === 1 ? this.minX - 40 : this.maxX + 40;
      this.baseY = this.minY + Math.random() * (this.maxY - this.minY);
      this.y = this.baseY;
    }

    draw(ctx) {
      const len = this.species.bodyLength;
      const h = this.species.bodyHeight;
      const dir = this.direction;
      const wiggle = Math.sin(this.wigglePhase) * 4;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(dir, 1);

      // Fish Body Shadow / Silhouette
      ctx.fillStyle = 'rgba(0, 20, 40, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 4, len * 0.5, h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fish Body
      ctx.fillStyle = this.species.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.5, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(len * 0.05, h * 0.18, len * 0.35, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail with wagging offset
      ctx.fillStyle = this.species.accentColor || this.species.color;
      ctx.beginPath();
      const tailX = -len * 0.45;
      ctx.moveTo(tailX, 0);
      ctx.lineTo(tailX - 14, -h * 0.45 + wiggle);
      ctx.lineTo(tailX - 10, wiggle * 0.5);
      ctx.lineTo(tailX - 14, h * 0.45 + wiggle);
      ctx.closePath();
      ctx.fill();

      // Pectoral Fin
      ctx.beginPath();
      ctx.ellipse(-len * 0.05, 2, 6, 3, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = this.species.accentColor;
      ctx.fill();

      // Eye
      const eyeX = len * 0.28;
      const eyeY = -h * 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(eyeX + 0.8, eyeY, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Distinctive Species Patterns
      if (this.species.id === 'perch') {
        // Vertical stripes
        ctx.strokeStyle = 'rgba(8, 47, 73, 0.65)';
        ctx.lineWidth = 2;
        [-4, 3, 10].forEach(sx => {
          ctx.beginPath();
          ctx.moveTo(sx, -h * 0.4);
          ctx.lineTo(sx - 2, h * 0.3);
          ctx.stroke();
        });
      } else if (this.species.id === 'puffer') {
        // Spines / spots
        ctx.fillStyle = '#fef08a';
        [-8, 0, 8].forEach(px => {
          ctx.beginPath();
          ctx.arc(px, -6, 2, 0, Math.PI * 2);
          ctx.arc(px, 6, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (this.species.id === 'koi') {
        // Calico patches & golden shimmer
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-len * 0.1, -2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(len * 0.1, 1, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // =========================================================================
  // MAIN GAME ENGINE CLASS
  // =========================================================================

  class FishingFrenzyGame {
    constructor() {
      this.canvas = document.getElementById('ff-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.sound = new SoundFX();

      // Session & Game State
      this.gameState = GAME_STATE.MENU;
      this.fishingState = FISHING_STATE.IDLE;

      this.score = 0;
      this.bestScore = 0;
      this.timeRemaining = SESSION_DURATION;
      this.totalCatches = 0;
      this.totalCasts = 0;
      this.currentCombo = 0;
      this.maxCombo = 0;
      this.caughtSpeciesRecord = {};

      // Timing & Animation Variables
      this.lastTimestamp = 0;
      this.gameTime = 0;
      this.waterTime = 0;

      // Fishing Cycle Timers
      this.stateTimer = 0;
      this.biteWindowDuration = 1.0;
      this.biteWindowTimer = 0;
      this.nextBiteDelay = 2.0;
      this.currentFish = null;
      this.biteAccuracy = 0; // 0 to 1

      // Physical Coordinates
      this.dockX = 140;
      this.dockY = 270;
      this.waterLevel = 295;

      this.rodTip = { x: 195, y: 190 };
      this.bobber = {
        x: 480,
        y: 295,
        targetX: 480,
        targetY: 295,
        startX: 195,
        startY: 190,
        progress: 0,
        vy: 0,
        isInWater: false,
        bobOffset: 0
      };

      // Caught Fish Arc Animation
      this.caughtFishAnim = {
        active: false,
        x: 0,
        y: 0,
        startX: 0,
        startY: 0,
        targetX: 160,
        targetY: 250,
        progress: 0,
        fish: null
      };

      // Particle & Simulation Collections
      this.floatingTexts = [];
      this.particles = [];
      this.ripples = [];
      this.ambientFish = [];
      this.targetedFish = null;

      // Cache DOM Elements
      this.initDomElements();

      // Read Best Score from localStorage
      this.loadBestScore();

      // Populate Ambient Underwater Fauna
      this.initAmbientFish();

      // Attach Event Listeners
      this.initInputListeners();

      // Initial HUD Update
      this.updateHud();

      // Start Master Animation Loop
      requestAnimationFrame(this.loop.bind(this));
    }

    // -----------------------------------------------------------------------
    // DOM & STORAGE INITIALIZATION
    // -----------------------------------------------------------------------

    initDomElements() {
      // Screens
      this.startScreen = document.getElementById('ff-start-screen');
      this.helpScreen = document.getElementById('ff-help-screen');
      this.pauseScreen = document.getElementById('ff-pause-screen');
      this.gameOverScreen = document.getElementById('ff-gameover-screen');

      // Top HUD Elements
      this.scoreDisplay = document.getElementById('ff-hud-score');
      this.timerDisplay = document.getElementById('ff-hud-time');
      this.timerWrap = document.getElementById('ff-hud-timer-wrap');
      this.catchesDisplay = document.getElementById('ff-hud-catches');
      this.bestDisplay = document.getElementById('ff-hud-best');
      this.comboBadge = document.getElementById('ff-hud-combo');
      this.comboVal = document.getElementById('ff-hud-combo-val');

      // Action Bar Button
      this.actionBtn = document.getElementById('ff-btn-action');
      this.actionText = document.getElementById('ff-action-text');

      // Audio & Pause Icon Buttons
      this.btnSound = document.getElementById('ff-btn-sound');
      this.soundOnIcon = this.btnSound.querySelector('.ff-icon-sound-on');
      this.soundOffIcon = this.btnSound.querySelector('.ff-icon-sound-off');
      this.btnPause = document.getElementById('ff-btn-pause');
      this.pauseIcon = this.btnPause.querySelector('.ff-icon-pause');
      this.resumeIcon = this.btnPause.querySelector('.ff-icon-resume');

      // Menu / Modal Buttons
      this.btnStart = document.getElementById('ff-btn-start');
      this.btnOpenHelp = document.getElementById('ff-btn-open-help');
      this.btnHelpPlay = document.getElementById('ff-btn-help-play');
      this.btnHelpBack = document.getElementById('ff-btn-help-back');

      this.btnResume = document.getElementById('ff-btn-resume');
      this.btnPauseRestart = document.getElementById('ff-btn-pause-restart');
      this.btnPauseHelp = document.getElementById('ff-btn-pause-help');
      this.btnPauseMenu = document.getElementById('ff-btn-pause-menu');

      this.btnPlayAgain = document.getElementById('ff-btn-play-again');
      this.btnGameOverMenu = document.getElementById('ff-btn-gameover-menu');

      // Announcer
      this.announcer = document.getElementById('ff-live-announcer');

      // Update audio icon state
      this.refreshSoundButtonUI();
    }

    loadBestScore() {
      try {
        const val = localStorage.getItem(STORAGE_KEY_BEST);
        this.bestScore = val ? parseInt(val, 10) || 0 : 0;
      } catch (e) {
        this.bestScore = 0;
      }
      if (this.bestDisplay) this.bestDisplay.textContent = this.bestScore;
      const startBest = document.getElementById('ff-start-best');
      if (startBest) startBest.textContent = this.bestScore;
    }

    saveBestScore() {
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          localStorage.setItem(STORAGE_KEY_BEST, String(this.bestScore));
        } catch (e) {
          // ignore storage errors
        }
        if (this.bestDisplay) this.bestDisplay.textContent = this.bestScore;
        return true;
      }
      return false;
    }

    initAmbientFish() {
      this.ambientFish = [];
      const waterMinX = 220;
      const waterMaxX = 920;
      const waterMinY = 320;
      const waterMaxY = 510;

      // Populate 9 diverse ambient fish swimming around
      FISH_SPECIES.forEach(species => {
        const count = species.rarity === 'Common' ? 2 : 1;
        for (let i = 0; i < count; i++) {
          this.ambientFish.push(new AmbientFish(species, waterMinX, waterMaxX, waterMinY, waterMaxY));
        }
      });
    }

    refreshSoundButtonUI() {
      if (this.sound.isMuted) {
        this.soundOnIcon.classList.add('ff-hidden');
        this.soundOffIcon.classList.remove('ff-hidden');
      } else {
        this.soundOnIcon.classList.remove('ff-hidden');
        this.soundOffIcon.classList.add('ff-hidden');
      }
    }

    announce(text) {
      if (this.announcer) {
        this.announcer.textContent = text;
      }
    }

    // -----------------------------------------------------------------------
    // INPUT HANDLING
    // -----------------------------------------------------------------------

    initInputListeners() {
      // Keyboard input
      window.addEventListener('keydown', (e) => {
        // Prevent default scrolling for Space
        if (e.code === 'Space' && e.target === document.body) {
          e.preventDefault();
        }

        if (e.repeat) return; // Disallow key repeat spam

        if (e.code === 'Space' || e.code === 'Enter') {
          if (this.gameState === GAME_STATE.PLAYING) {
            this.handlePlayerAction();
          } else if (this.gameState === GAME_STATE.MENU) {
            this.startNewSession();
          }
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.gameState === GAME_STATE.PLAYING) {
            this.pauseSession();
          } else if (this.gameState === GAME_STATE.PAUSED) {
            this.resumeSession();
          }
        } else if (e.code === 'KeyR') {
          if (this.gameState === GAME_STATE.PLAYING || this.gameState === GAME_STATE.PAUSED) {
            this.startNewSession();
          }
        } else if (e.code === 'KeyM') {
          this.sound.toggleMute();
          this.refreshSoundButtonUI();
        }
      });

      // Canvas clicks for interactive casting / hooking
      this.canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.gameState === GAME_STATE.PLAYING) {
          this.handlePlayerAction();
        }
      });

      // Quick action button
      this.actionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.gameState === GAME_STATE.PLAYING) {
          this.handlePlayerAction();
        }
      });

      // Sound toggle
      this.btnSound.addEventListener('click', () => {
        this.sound.toggleMute();
        this.refreshSoundButtonUI();
      });

      // Pause button
      this.btnPause.addEventListener('click', () => {
        if (this.gameState === GAME_STATE.PLAYING) {
          this.pauseSession();
        } else if (this.gameState === GAME_STATE.PAUSED) {
          this.resumeSession();
        }
      });

      // Start Screen Buttons
      this.btnStart.addEventListener('click', () => this.startNewSession());
      this.btnOpenHelp.addEventListener('click', () => this.openHelp());

      // Help Screen Buttons
      this.btnHelpPlay.addEventListener('click', () => {
        this.helpScreen.classList.add('ff-hidden');
        this.startNewSession();
      });
      this.btnHelpBack.addEventListener('click', () => {
        this.helpScreen.classList.add('ff-hidden');
        if (this.gameState === GAME_STATE.PAUSED) {
          this.pauseScreen.classList.remove('ff-hidden');
        } else {
          this.startScreen.classList.remove('ff-hidden');
        }
      });

      // Pause Screen Buttons
      this.btnResume.addEventListener('click', () => this.resumeSession());
      this.btnPauseRestart.addEventListener('click', () => this.startNewSession());
      this.btnPauseHelp.addEventListener('click', () => {
        this.pauseScreen.classList.add('ff-hidden');
        this.helpScreen.classList.remove('ff-hidden');
      });
      this.btnPauseMenu.addEventListener('click', () => this.returnToMenu());

      // Game Over Screen Buttons
      this.btnPlayAgain.addEventListener('click', () => this.startNewSession());
      this.btnGameOverMenu.addEventListener('click', () => this.returnToMenu());
    }

    // -----------------------------------------------------------------------
    // SESSION STATE FLOW
    // -----------------------------------------------------------------------

    startNewSession() {
      // Clear overlays
      this.startScreen.classList.add('ff-hidden');
      this.helpScreen.classList.add('ff-hidden');
      this.pauseScreen.classList.add('ff-hidden');
      this.gameOverScreen.classList.add('ff-hidden');

      // Reset session metrics
      this.score = 0;
      this.timeRemaining = SESSION_DURATION;
      this.totalCatches = 0;
      this.totalCasts = 0;
      this.currentCombo = 0;
      this.maxCombo = 0;
      this.caughtSpeciesRecord = {};

      // Reset fishing cycle
      this.resetFishingCycle();

      this.gameState = GAME_STATE.PLAYING;
      this.pauseIcon.classList.remove('ff-hidden');
      this.resumeIcon.classList.add('ff-hidden');

      this.updateHud();
      this.announce('Expedition started. 75 seconds on the clock. Press Space to cast line.');
    }

    pauseSession() {
      if (this.gameState !== GAME_STATE.PLAYING) return;
      this.gameState = GAME_STATE.PAUSED;

      document.getElementById('ff-pause-score').textContent = this.score;
      document.getElementById('ff-pause-time').textContent = this.formatTime(this.timeRemaining);
      document.getElementById('ff-pause-catches').textContent = this.totalCatches;

      this.pauseScreen.classList.remove('ff-hidden');
      this.pauseIcon.classList.add('ff-hidden');
      this.resumeIcon.classList.remove('ff-hidden');
      this.announce('Game paused');
    }

    resumeSession() {
      if (this.gameState !== GAME_STATE.PAUSED) return;
      this.pauseScreen.classList.add('ff-hidden');
      this.gameState = GAME_STATE.PLAYING;
      this.pauseIcon.classList.remove('ff-hidden');
      this.resumeIcon.classList.add('ff-hidden');
      this.announce('Game resumed');
    }

    returnToMenu() {
      this.pauseScreen.classList.add('ff-hidden');
      this.gameOverScreen.classList.add('ff-hidden');
      this.helpScreen.classList.add('ff-hidden');
      this.startScreen.classList.remove('ff-hidden');

      this.gameState = GAME_STATE.MENU;
      this.resetFishingCycle();
      this.loadBestScore();
      this.updateHud();
      this.announce('Returned to main menu');
    }

    openHelp() {
      this.startScreen.classList.add('ff-hidden');
      this.helpScreen.classList.remove('ff-hidden');
    }

    endSession() {
      this.gameState = GAME_STATE.GAMEOVER;
      this.sound.playGameOver();

      const isNewBest = this.saveBestScore();

      // Populate game over summary
      document.getElementById('ff-gameover-score').textContent = this.score;
      document.getElementById('ff-gameover-catches').textContent = this.totalCatches;
      document.getElementById('ff-gameover-combo').textContent = `x${this.maxCombo}`;
      document.getElementById('ff-gameover-best').textContent = this.bestScore;

      const accuracy = this.totalCasts > 0
        ? Math.round((this.totalCatches / this.totalCasts) * 100)
        : 100;
      document.getElementById('ff-gameover-acc').textContent = `${accuracy}%`;

      const ribbon = document.getElementById('ff-record-ribbon');
      if (isNewBest && this.score > 0) {
        ribbon.classList.remove('ff-hidden');
      } else {
        ribbon.classList.add('ff-hidden');
      }

      // Populate species caught list
      const summaryList = document.getElementById('ff-caught-summary');
      summaryList.innerHTML = '';

      const speciesKeys = Object.keys(this.caughtSpeciesRecord);
      if (speciesKeys.length === 0) {
        summaryList.innerHTML = '<span class="ff-modal-sub">No fish caught this trip. The waters were quiet!</span>';
      } else {
        speciesKeys.forEach(name => {
          const count = this.caughtSpeciesRecord[name];
          const chip = document.createElement('div');
          chip.className = 'ff-summary-chip';
          chip.innerHTML = `<strong>${name}:</strong> ${count}`;
          summaryList.appendChild(chip);
        });
      }

      this.gameOverScreen.classList.remove('ff-hidden');
      this.announce(`Expedition complete. Final score: ${this.score}. Catches: ${this.totalCatches}.`);
    }

    // -----------------------------------------------------------------------
    // FISHING CYCLE MECHANICS
    // -----------------------------------------------------------------------

    handlePlayerAction() {
      switch (this.fishingState) {
        case FISHING_STATE.IDLE:
          this.castLine();
          break;

        case FISHING_STATE.CASTING:
          // Ignore input during line extension
          break;

        case FISHING_STATE.WAITING:
        case FISHING_STATE.NIBBLING:
          // Hooked too early!
          this.triggerMiss('TOO EARLY!');
          break;

        case FISHING_STATE.BITE:
          // Reaction within timing window!
          this.evaluateCatchTiming();
          break;

        case FISHING_STATE.REELING:
        case FISHING_STATE.CAUGHT:
        case FISHING_STATE.MISSED:
          // In transition, ignore spam
          break;
      }
    }

    castLine() {
      this.totalCasts++;
      this.fishingState = FISHING_STATE.CASTING;
      this.stateTimer = 0;
      this.sound.playCast();

      // Choose cast landing distance (420 to 760)
      const targetDistance = 440 + Math.random() * 280;
      this.bobber.startX = this.rodTip.x;
      this.bobber.startY = this.rodTip.y;
      this.bobber.targetX = targetDistance;
      this.bobber.targetY = this.waterLevel;
      this.bobber.x = this.bobber.startX;
      this.bobber.y = this.bobber.startY;
      this.bobber.progress = 0;
      this.bobber.isInWater = false;

      this.updateActionButton();
      this.announce('Casting line');
    }

    selectFishForBite() {
      // Dynamic weighted fish selection
      // Progression: as score increases or session nears end, rare fish get slight probability boost
      const scoreBonus = Math.min(0.2, this.score / 1000);
      let rand = Math.random();

      // Weighted random roll
      let cumulative = 0;
      let chosen = FISH_SPECIES[0];

      for (let i = FISH_SPECIES.length - 1; i >= 0; i--) {
        const fish = FISH_SPECIES[i];
        let p = fish.probability;
        if (fish.rarity === 'Legendary' || fish.rarity === 'Rare') {
          p += scoreBonus * 0.05;
        }
        cumulative += p;
        if (rand <= cumulative) {
          chosen = fish;
          break;
        }
      }

      this.currentFish = chosen;
      this.biteWindowDuration = chosen.biteWindow;

      // Assign nearest ambient fish to target bobber
      if (this.ambientFish.length > 0) {
        this.targetedFish = this.ambientFish.find(f => f.species.id === chosen.id) || this.ambientFish[0];
        if (this.targetedFish) {
          this.targetedFish.isTargeting = true;
        }
      }
    }

    triggerBite() {
      this.fishingState = FISHING_STATE.BITE;
      this.biteWindowTimer = this.biteWindowDuration;
      this.sound.playBite();

      // Dramatic water splash & bobber plunge
      this.spawnWaterSplash(this.bobber.x, this.waterLevel, 14);
      this.ripples.push(new Ripple(this.bobber.x, this.waterLevel, 50, 60, 'rgba(239, 68, 68, 0.8)'));

      this.updateActionButton();
      this.announce('Strike! Press Space to hook now!');
    }

    evaluateCatchTiming() {
      // Single trigger protection: switch to REELING immediately
      this.fishingState = FISHING_STATE.REELING;
      this.stateTimer = 0;

      // Accuracy ratio: 1 = instant reaction (ideal), 0 = last millisecond
      const fractionRemaining = this.biteWindowTimer / this.biteWindowDuration;
      let accuracyRating = 'GOOD';
      let multiplier = 1.0;

      // Sweet spot timing evaluation (center 40% of bite window)
      if (fractionRemaining >= 0.35 && fractionRemaining <= 0.85) {
        accuracyRating = 'PERFECT!';
        multiplier = 1.5;
        this.biteAccuracy = 1.0;
      } else {
        accuracyRating = 'GOOD!';
        multiplier = 1.0;
        this.biteAccuracy = 0.7;
      }

      // Combo progression
      this.currentCombo++;
      if (this.currentCombo > this.maxCombo) {
        this.maxCombo = this.currentCombo;
      }

      const comboBonusMultiplier = 1 + (this.currentCombo - 1) * 0.15;
      const pointsEarned = Math.round(this.currentFish.points * multiplier * comboBonusMultiplier);

      this.score += pointsEarned;
      this.totalCatches++;

      // Track species caught
      this.caughtSpeciesRecord[this.currentFish.name] = (this.caughtSpeciesRecord[this.currentFish.name] || 0) + 1;

      // Play success audio & launch catch visuals
      const isLegendary = this.currentFish.rarity === 'Legendary';
      this.sound.playCatchSuccess(isLegendary);

      // Launch fish arc animation
      this.caughtFishAnim.active = true;
      this.caughtFishAnim.fish = this.currentFish;
      this.caughtFishAnim.startX = this.bobber.x;
      this.caughtFishAnim.startY = this.waterLevel;
      this.caughtFishAnim.x = this.bobber.x;
      this.caughtFishAnim.y = this.waterLevel;
      this.caughtFishAnim.progress = 0;

      // Celebration floating text
      const comboText = this.currentCombo > 1 ? `COMBO x${this.currentCombo}!` : '';
      this.floatingTexts.push(new FloatingText(
        this.bobber.x,
        this.waterLevel - 40,
        `+${pointsEarned} PTS`,
        isLegendary ? '#fbbf24' : '#38bdf8',
        20,
        `${accuracyRating} ${comboText}`
      ));

      // Sparkles and splash
      this.spawnWaterSplash(this.bobber.x, this.waterLevel, 20);
      for (let i = 0; i < 15; i++) {
        this.particles.push(new Particle(
          this.bobber.x,
          this.waterLevel - 20,
          (Math.random() - 0.5) * 140,
          -Math.random() * 120 - 40,
          isLegendary ? '#fbbf24' : '#38bdf8',
          Math.random() * 3 + 2,
          0.8,
          'star'
        ));
      }

      this.updateHud();
      this.announce(`Caught ${this.currentFish.name}! ${pointsEarned} points. Total score ${this.score}.`);
    }

    triggerMiss(reason = 'GOT AWAY!') {
      this.fishingState = FISHING_STATE.MISSED;
      this.stateTimer = 0;
      this.currentCombo = 0; // Reset combo on miss

      this.sound.playMiss();

      // Fish darts away in fright
      if (this.targetedFish) {
        this.targetedFish.isEscaping = true;
        this.targetedFish.direction = Math.random() < 0.5 ? 1 : -1;
      }

      this.floatingTexts.push(new FloatingText(
        this.bobber.x,
        this.waterLevel - 30,
        reason,
        '#ef4444',
        17,
        'Combo Broken'
      ));

      this.ripples.push(new Ripple(this.bobber.x, this.waterLevel, 40, 50, 'rgba(239, 68, 68, 0.7)'));

      this.updateHud();
      this.updateActionButton();
      this.announce(`${reason}. Fish got away.`);
    }

    resetFishingCycle() {
      this.fishingState = FISHING_STATE.IDLE;
      this.stateTimer = 0;
      this.currentFish = null;
      if (this.targetedFish) {
        this.targetedFish.isTargeting = false;
        this.targetedFish = null;
      }
      this.bobber.progress = 0;
      this.bobber.isInWater = false;
      this.bobber.x = this.rodTip.x;
      this.bobber.y = this.rodTip.y;
      this.caughtFishAnim.active = false;
      this.updateActionButton();
    }

    // -----------------------------------------------------------------------
    // PARTICLES & SPLASH HELPERS
    // -----------------------------------------------------------------------

    spawnWaterSplash(x, y, count = 12) {
      this.sound.playSplash();
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.4;
        const speed = 70 + Math.random() * 130;
        this.particles.push(new Particle(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'rgba(224, 242, 254, 0.85)',
          Math.random() * 3 + 1.5,
          0.6 + Math.random() * 0.3
        ));
      }
    }

    // -----------------------------------------------------------------------
    // MASTER UPDATE LOOP (Fixed Timestep & Delta time)
    // -----------------------------------------------------------------------

    update(dt) {
      if (this.gameState !== GAME_STATE.PLAYING) return;

      this.gameTime += dt;
      this.waterTime += dt;

      // 1. Session Countdown Timer
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.updateHud();
        this.endSession();
        return;
      }

      // Audio tick during final 10 seconds
      if (this.timeRemaining <= 10 && Math.floor(this.timeRemaining) !== Math.floor(this.timeRemaining + dt)) {
        this.sound.playTick();
      }

      // 2. Fishing Cycle State Machine
      this.stateTimer += dt;

      switch (this.fishingState) {
        case FISHING_STATE.IDLE:
          // Waiting for player cast
          break;

        case FISHING_STATE.CASTING:
          // Animate bobber trajectory
          this.bobber.progress += dt * 1.5;
          if (this.bobber.progress >= 1) {
            this.bobber.progress = 1;
            this.bobber.x = this.bobber.targetX;
            this.bobber.y = this.waterLevel;
            this.bobber.isInWater = true;

            this.fishingState = FISHING_STATE.WAITING;
            this.stateTimer = 0;
            this.nextBiteDelay = 1.8 + Math.random() * 2.2; // 1.8s to 4s delay

            this.spawnWaterSplash(this.bobber.x, this.waterLevel, 10);
            this.ripples.push(new Ripple(this.bobber.x, this.waterLevel, 45, 40));

            this.selectFishForBite();
            this.updateActionButton();
          } else {
            // Parabolic arc formula
            const p = this.bobber.progress;
            this.bobber.x = this.bobber.startX + (this.bobber.targetX - this.bobber.startX) * p;
            const arcHeight = 110;
            this.bobber.y = this.bobber.startY + (this.bobber.targetY - this.bobber.startY) * p - Math.sin(p * Math.PI) * arcHeight;
          }
          break;

        case FISHING_STATE.WAITING:
          // Subtle bobber floating
          this.bobber.bobOffset = Math.sin(this.waterTime * 3) * 3;

          // Transition to Nibble phase
          if (this.stateTimer >= this.nextBiteDelay) {
            this.fishingState = FISHING_STATE.NIBBLING;
            this.stateTimer = 0;
            this.sound.playNibble();
            this.ripples.push(new Ripple(this.bobber.x, this.waterLevel, 25, 30));
          }
          break;

        case FISHING_STATE.NIBBLING:
          // Agitated twitching
          this.bobber.bobOffset = Math.sin(this.waterTime * 14) * 4;
          if (Math.random() < 0.08) {
            this.ripples.push(new Ripple(this.bobber.x, this.waterLevel, 20, 35));
          }

          // Trigger active strike window after 0.8s nibble
          if (this.stateTimer >= 0.8) {
            this.triggerBite();
          }
          break;

        case FISHING_STATE.BITE:
          // Active reaction timing window counting down
          this.biteWindowTimer -= dt;
          this.bobber.bobOffset = 8 + Math.sin(this.waterTime * 20) * 3; // Bobber pulled underwater

          if (this.biteWindowTimer <= 0) {
            this.triggerMiss('ESCAPED!');
          }
          break;

        case FISHING_STATE.REELING:
          // Pulling fish up
          if (this.stateTimer >= 0.3) {
            this.fishingState = FISHING_STATE.CAUGHT;
            this.stateTimer = 0;
          }
          break;

        case FISHING_STATE.CAUGHT:
          // Celebratory pause before next cast
          if (this.stateTimer >= 1.6) {
            this.resetFishingCycle();
          }
          break;

        case FISHING_STATE.MISSED:
          // Brief pause after miss before reset
          if (this.stateTimer >= 1.2) {
            this.resetFishingCycle();
          }
          break;
      }

      // 3. Caught Fish Arc Animation
      if (this.caughtFishAnim.active) {
        this.caughtFishAnim.progress += dt * 1.6;
        const p = Math.min(1, this.caughtFishAnim.progress);
        const sx = this.caughtFishAnim.startX;
        const sy = this.caughtFishAnim.startY;
        const tx = this.caughtFishAnim.targetX;
        const ty = this.caughtFishAnim.targetY;

        this.caughtFishAnim.x = sx + (tx - sx) * p;
        const arcY = 160;
        this.caughtFishAnim.y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * arcY;

        if (this.caughtFishAnim.progress >= 1) {
          this.caughtFishAnim.active = false;
        }
      }

      // 4. Update Ambient Fish
      for (const fish of this.ambientFish) {
        fish.update(dt, this.bobber.isInWater ? this.bobber : null);
      }

      // 5. Update Particle Collections
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.update(dt);
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.update(dt);
        if (r.alpha <= 0) {
          this.ripples.splice(i, 1);
        }
      }

      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.update(dt);
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }

      // 6. Refresh HUD
      this.updateHud();
    }

    // -----------------------------------------------------------------------
    // HUD & UI UPDATES
    // -----------------------------------------------------------------------

    updateHud() {
      if (this.scoreDisplay) this.scoreDisplay.textContent = this.score;
      if (this.catchesDisplay) this.catchesDisplay.textContent = this.totalCatches;

      if (this.timerDisplay) {
        this.timerDisplay.textContent = this.formatTime(this.timeRemaining);
      }

      if (this.timerWrap) {
        if (this.timeRemaining <= 15 && this.gameState === GAME_STATE.PLAYING) {
          this.timerWrap.classList.add('ff-timer-urgent');
        } else {
          this.timerWrap.classList.remove('ff-timer-urgent');
        }
      }

      // Combo badge
      if (this.comboBadge) {
        if (this.currentCombo >= 2) {
          this.comboBadge.classList.remove('ff-hidden');
          this.comboVal.textContent = `x${this.currentCombo}`;
        } else {
          this.comboBadge.classList.add('ff-hidden');
        }
      }
    }

    updateActionButton() {
      if (!this.actionBtn) return;

      this.actionBtn.classList.remove('ff-action-strike');

      switch (this.fishingState) {
        case FISHING_STATE.IDLE:
          this.actionText.textContent = 'CAST LINE';
          break;
        case FISHING_STATE.CASTING:
          this.actionText.textContent = 'CASTING...';
          break;
        case FISHING_STATE.WAITING:
          this.actionText.textContent = 'WAITING FOR BITE...';
          break;
        case FISHING_STATE.NIBBLING:
          this.actionText.textContent = 'NIBBLE! READY...';
          break;
        case FISHING_STATE.BITE:
          this.actionText.textContent = 'HOOK NOW!';
          this.actionBtn.classList.add('ff-action-strike');
          break;
        case FISHING_STATE.REELING:
          this.actionText.textContent = 'REELING IN!';
          break;
        case FISHING_STATE.CAUGHT:
          this.actionText.textContent = 'GREAT CATCH!';
          break;
        case FISHING_STATE.MISSED:
          this.actionText.textContent = 'MISSED!';
          break;
      }
    }

    formatTime(seconds) {
      const s = Math.max(0, Math.ceil(seconds));
      const mins = Math.floor(s / 60);
      const rem = s % 60;
      return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
    }

    // -----------------------------------------------------------------------
    // CANVAS RENDERING PIPELINE
    // -----------------------------------------------------------------------

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Draw Environment (Sky, Mountains, Sun, Clouds)
      this.drawSky(ctx);

      // 2. Draw Distant Scenery
      this.drawMountains(ctx);

      // 3. Draw Deep Water Background
      this.drawUnderwaterBase(ctx);

      // 4. Draw Ambient Fish (Behind Front Water Waves)
      for (const fish of this.ambientFish) {
        fish.draw(ctx);
      }

      // 5. Draw Water Surface Waves
      this.drawWaterWaves(ctx);

      // 6. Draw Water Surface Ripples
      for (const ripple of this.ripples) {
        ripple.draw(ctx);
      }

      // 7. Draw Fishing Pier & Pier Pilings
      this.drawFishingPier(ctx);

      // 8. Draw Fisherman & Rod
      this.drawFisherman(ctx);

      // 9. Draw Fishing Line & Bobber
      this.drawFishingLine(ctx);

      // 10. Draw Caught Fish Leaping Arc
      if (this.caughtFishAnim.active && this.caughtFishAnim.fish) {
        this.drawLeapingFish(ctx);
      }

      // 11. Draw Strike Timing Ring & Indicators
      if (this.fishingState === FISHING_STATE.BITE) {
        this.drawBiteIndicator(ctx);
      }

      // 12. Draw Particles & Splashes
      for (const p of this.particles) {
        p.draw(ctx);
      }

      // 13. Draw Floating Texts
      for (const ft of this.floatingTexts) {
        ft.draw(ctx);
      }
    }

    drawSky(ctx) {
      // Warm gradient sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, this.waterLevel);
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.55, '#38bdf8');
      skyGrad.addColorStop(0.85, '#fef08a');
      skyGrad.addColorStop(1, '#fed7aa');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, this.waterLevel);

      // Radiant Sun
      const sunX = 780;
      const sunY = 90;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 120);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
      sunGlow.addColorStop(0.3, 'rgba(251, 191, 36, 0.45)');
      sunGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
      ctx.fill();

      // Drifting Fluffy Clouds
      this.drawCloud(ctx, (160 + this.waterTime * 6) % (CANVAS_WIDTH + 200) - 100, 70, 70);
      this.drawCloud(ctx, (540 + this.waterTime * 4) % (CANVAS_WIDTH + 200) - 100, 110, 55);

      // Distant soaring birds
      this.drawBird(ctx, 320 + Math.sin(this.waterTime * 0.5) * 40, 60);
      this.drawBird(ctx, 350 + Math.sin(this.waterTime * 0.5 + 1) * 40, 75);
    }

    drawCloud(ctx, x, y, size) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
      ctx.arc(x + size * 0.35, y - size * 0.15, size * 0.45, 0, Math.PI * 2);
      ctx.arc(x + size * 0.75, y, size * 0.38, 0, Math.PI * 2);
      ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawBird(ctx, x, y) {
      ctx.save();
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const wing = Math.sin(this.waterTime * 4) * 4;
      ctx.moveTo(x - 8, y + wing);
      ctx.quadraticCurveTo(x - 4, y - 4, x, y);
      ctx.quadraticCurveTo(x + 4, y - 4, x + 8, y + wing);
      ctx.stroke();
      ctx.restore();
    }

    drawMountains(ctx) {
      // Distant rolling mountain silhouette
      ctx.fillStyle = 'rgba(12, 74, 110, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, this.waterLevel);
      ctx.lineTo(0, 220);
      ctx.quadraticCurveTo(240, 150, 480, 230);
      ctx.quadraticCurveTo(700, 170, 960, 210);
      ctx.lineTo(CANVAS_WIDTH, this.waterLevel);
      ctx.closePath();
      ctx.fill();

      // Foreground lush pine ridge
      ctx.fillStyle = 'rgba(7, 89, 133, 0.7)';
      ctx.beginPath();
      ctx.moveTo(180, this.waterLevel);
      ctx.lineTo(260, 250);
      ctx.lineTo(340, 265);
      ctx.lineTo(460, 240);
      ctx.lineTo(600, 275);
      ctx.lineTo(760, 245);
      ctx.lineTo(CANVAS_WIDTH, 260);
      ctx.lineTo(CANVAS_WIDTH, this.waterLevel);
      ctx.closePath();
      ctx.fill();
    }

    drawUnderwaterBase(ctx) {
      // Deep tropical water gradient
      const waterGrad = ctx.createLinearGradient(0, this.waterLevel, 0, CANVAS_HEIGHT);
      waterGrad.addColorStop(0, '#0284c7');
      waterGrad.addColorStop(0.3, '#0369a1');
      waterGrad.addColorStop(0.7, '#075985');
      waterGrad.addColorStop(1, '#082f49');

      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, this.waterLevel, CANVAS_WIDTH, CANVAS_HEIGHT - this.waterLevel);

      // Light Caustic Beams
      ctx.save();
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 6; i++) {
        const rayX = 280 + i * 110 + Math.sin(this.waterTime * 0.8 + i) * 20;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(rayX, this.waterLevel);
        ctx.lineTo(rayX + 60, CANVAS_HEIGHT);
        ctx.lineTo(rayX + 90, CANVAS_HEIGHT);
        ctx.lineTo(rayX + 25, this.waterLevel);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Sandy Seabed with swaying kelp
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      ctx.lineTo(0, CANVAS_HEIGHT - 25);
      ctx.quadraticCurveTo(300, CANVAS_HEIGHT - 45, 600, CANVAS_HEIGHT - 30);
      ctx.quadraticCurveTo(800, CANVAS_HEIGHT - 20, CANVAS_WIDTH, CANVAS_HEIGHT - 35);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Swaying seaweed
      this.drawSeaweed(ctx, 360, CANVAS_HEIGHT - 25, 60);
      this.drawSeaweed(ctx, 375, CANVAS_HEIGHT - 25, 75);
      this.drawSeaweed(ctx, 620, CANVAS_HEIGHT - 30, 80);
      this.drawSeaweed(ctx, 640, CANVAS_HEIGHT - 30, 65);
      this.drawSeaweed(ctx, 840, CANVAS_HEIGHT - 20, 90);
    }

    drawSeaweed(ctx, x, y, height) {
      ctx.save();
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      const sway = Math.sin(this.waterTime * 2 + x) * 16;
      ctx.quadraticCurveTo(x + sway * 0.5, y - height * 0.5, x + sway, y - height);
      ctx.stroke();
      ctx.restore();
    }

    drawWaterWaves(ctx) {
      ctx.save();
      // Wave layer 1 (Translucent background wave)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, this.waterLevel);
      for (let x = 0; x <= CANVAS_WIDTH; x += 15) {
        const y = this.waterLevel + Math.sin(x * 0.02 + this.waterTime * 2.5) * 4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.lineTo(0, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Wave crest highlight line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= CANVAS_WIDTH; x += 15) {
        const y = this.waterLevel + Math.sin(x * 0.02 + this.waterTime * 2.5) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawFishingPier(ctx) {
      ctx.save();
      // Wooden Pilings into water
      ctx.fillStyle = '#1e293b';
      [40, 80, 130].forEach(px => {
        ctx.fillRect(px, 240, 16, CANVAS_HEIGHT - 240);
        // Wood post highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(px + 2, 240, 3, CANVAS_HEIGHT - 240);
        ctx.fillStyle = '#1e293b';
      });

      // Cross struts
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(40, 280);
      ctx.lineTo(146, 340);
      ctx.moveTo(146, 280);
      ctx.lineTo(40, 340);
      ctx.stroke();

      // Wooden Deck Platform
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 230, 150, 18);

      // Deck planks lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      for (let x = 15; x < 150; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, 230);
        ctx.lineTo(x, 248);
        ctx.stroke();
      }

      // Fishing Tackle Bucket on Pier
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(25, 230);
      ctx.lineTo(28, 208);
      ctx.lineTo(48, 208);
      ctx.lineTo(51, 230);
      ctx.closePath();
      ctx.fill();

      // Bucket handle
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(38, 208, 11, Math.PI, 0);
      ctx.stroke();

      ctx.restore();
    }

    drawFisherman(ctx) {
      ctx.save();
      const fx = 100;
      const fy = 230;

      // Fisherman Silhouette
      ctx.fillStyle = '#0f172a';

      // Legs / Seated figure
      ctx.beginPath();
      ctx.arc(fx + 8, fy - 36, 12, 0, Math.PI * 2); // Body
      ctx.rect(fx, fy - 26, 18, 26); // Torso & Legs
      ctx.fill();

      // Fisherman Head & Hat
      ctx.beginPath();
      ctx.arc(fx + 9, fy - 46, 9, 0, Math.PI * 2); // Head
      ctx.fill();

      // Wide-brim hat
      ctx.beginPath();
      ctx.ellipse(fx + 9, fy - 52, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arms extending to hold fishing rod
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fx + 8, fy - 34);
      ctx.lineTo(fx + 22, fy - 30);
      ctx.lineTo(fx + 30, fy - 34);
      ctx.stroke();

      // Fishing Rod (Animated flex based on line tension)
      let bend = 0;
      if (this.fishingState === FISHING_STATE.BITE) {
        bend = 28 + Math.sin(this.waterTime * 20) * 8; // Heavy dynamic bend on strike
      } else if (this.fishingState === FISHING_STATE.REELING || this.fishingState === FISHING_STATE.CAUGHT) {
        bend = 38; // High tension arc
      }

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx + 20, fy - 28);
      // Rod curves from handle to tip
      ctx.quadraticCurveTo(fx + 65, fy - 65, this.rodTip.x, this.rodTip.y + bend);
      ctx.stroke();

      // Reel on rod
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(fx + 32, fy - 35, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawFishingLine(ctx) {
      if (this.fishingState === FISHING_STATE.IDLE) return;

      const tx = this.rodTip.x;
      let ty = this.rodTip.y;
      if (this.fishingState === FISHING_STATE.BITE) ty += 28;
      else if (this.fishingState === FISHING_STATE.REELING) ty += 38;

      const bx = this.bobber.x;
      const by = this.bobber.y + (this.bobber.bobOffset || 0);

      // Draw Fishing Line (Smooth curved line)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);

      // Sag or tension curve
      let sag = 30;
      if (this.fishingState === FISHING_STATE.BITE || this.fishingState === FISHING_STATE.REELING) {
        sag = 5; // Tight line under tension
      } else if (this.fishingState === FISHING_STATE.CASTING) {
        sag = -20; // Arcing through air
      }

      const midX = (tx + bx) * 0.5;
      const midY = (ty + by) * 0.5 + sag;
      ctx.quadraticCurveTo(midX, midY, bx, by);
      ctx.stroke();

      // Draw Red-and-White Floating Bobber
      ctx.translate(bx, by);

      // Bobber Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bobber Top Half (Bright Red/Orange)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -2, 7, Math.PI, 0);
      ctx.fill();

      // Bobber Bottom Half (Crisp White)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -2, 7, 0, Math.PI);
      ctx.fill();

      // Bobber Center band & pin
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-7, -2);
      ctx.lineTo(7, -2);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 4);
      ctx.stroke();

      ctx.restore();
    }

    drawLeapingFish(ctx) {
      const anim = this.caughtFishAnim;
      const fish = anim.fish;

      ctx.save();
      ctx.translate(anim.x, anim.y);

      // Rotate fish along trajectory tangent
      const rot = Math.sin(anim.progress * Math.PI) * 0.8 - 0.4;
      ctx.rotate(rot);

      const len = fish.bodyLength * 1.2;
      const h = fish.bodyHeight * 1.2;

      // Glow aura for rare / legendary
      if (fish.rarity === 'Legendary' || fish.rarity === 'Rare') {
        ctx.shadowColor = fish.accentColor || '#fbbf24';
        ctx.shadowBlur = 15;
      }

      // Fish Body
      ctx.fillStyle = fish.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.5, h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Accent belly
      ctx.fillStyle = fish.accentColor || '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.15, len * 0.4, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.beginPath();
      ctx.moveTo(-len * 0.4, 0);
      ctx.lineTo(-len * 0.7, -h * 0.5);
      ctx.lineTo(-len * 0.55, 0);
      ctx.lineTo(-len * 0.7, h * 0.5);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(len * 0.3, -h * 0.15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(len * 0.32, -h * 0.15, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawBiteIndicator(ctx) {
      const bx = this.bobber.x;
      const by = this.bobber.y - 45;

      ctx.save();
      // 1. Exclamation Strike Badge
      const pulse = 1 + Math.sin(this.waterTime * 25) * 0.12;
      ctx.translate(bx, by);
      ctx.scale(pulse, pulse);

      // Glowing Badge Background
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;

      ctx.beginPath();
      ctx.roundRect(-42, -18, 84, 30, 8);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Strike Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STRIKE!', 0, -3);

      ctx.restore();

      // 2. Shrinking Timing Circle Meter
      ctx.save();
      const progress = Math.max(0, this.biteWindowTimer / this.biteWindowDuration);
      const ringRadius = 14 + progress * 32;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, this.bobber.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Target Sweet Spot Ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(bx, this.bobber.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // -----------------------------------------------------------------------
    // MAIN LOOP DRIVER
    // -----------------------------------------------------------------------

    loop(timestamp) {
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const rawDt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      // Cap delta time to prevent large steps when tab loses focus
      const dt = Math.min(rawDt, 0.1);

      this.update(dt);
      this.draw();

      requestAnimationFrame(this.loop.bind(this));
    }
  }

  // =========================================================================
  // BOOTSTRAP INITIALIZATION ON DOM READY
  // =========================================================================

  window.addEventListener('DOMContentLoaded', () => {
    window.fishingFrenzy = new FishingFrenzyGame();
  });

})();

