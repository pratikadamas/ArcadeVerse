/**
 * TIME WARP: CHRONO SHIFT
 * 2D Puzzle-Platformer with Time Rewind and Ghost Replay Mechanics
 * Pure Vanilla JavaScript & HTML5 Canvas — ArcadeVerse
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 600;
  const FIXED_DELTA = 1 / 60;
  const MAX_HISTORY_FRAMES = 360; // 6.0 seconds of rewind buffer at 60Hz
  const GHOST_RECORD_SECONDS = 5;

  const STORAGE_KEYS = {
    BEST_SCORE: 'timeWarp_bestScore',
    UNLOCKED_LEVEL: 'timeWarp_unlockedLevel',
    SOUND: 'timeWarp_soundEnabled',
    STATS: 'timeWarp_chamberStats'
  };

  // ==========================================================================
  // 2. WEB AUDIO SYNTHESIZER
  // ==========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.initFromStorage();
    }

    initFromStorage() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.SOUND);
        this.enabled = stored !== null ? stored === 'true' : true;
      } catch (e) {
        this.enabled = true;
      }
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      try {
        localStorage.setItem(STORAGE_KEYS.SOUND, String(this.enabled));
      } catch (e) {}
      if (this.enabled) {
        this.ensureContext();
        this.playBlip(580, 0.08, 'sine');
      }
      return this.enabled;
    }

    playTone(freq, duration, type = 'sine', gainVal = 0.15) {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }

    playJump() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.14);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}
    }

    playLand() {
      this.playTone(85, 0.08, 'triangle', 0.22);
    }

    playBlip(freq = 440, dur = 0.06, type = 'sine') {
      this.playTone(freq, dur, type, 0.12);
    }

    playSwitch(pressed) {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const f1 = pressed ? 440 : 330;
        const f2 = pressed ? 660 : 220;
        this.playTone(f1, 0.06, 'sine', 0.16);
        setTimeout(() => this.playTone(f2, 0.08, 'sine', 0.14), 50);
      } catch (e) {}
    }

    playDoor(open) {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sawtooth';
        const startF = open ? 140 : 260;
        const endF = open ? 260 : 120;
        osc.frequency.setValueAtTime(startF, now);
        osc.frequency.linearRampToValueAtTime(endF, now + 0.22);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } catch (e) {}
    }

    playFragment() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6 arpeggio
      notes.forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 0.14, 'sine', 0.14), idx * 45);
      });
    }

    playGhostSpawn() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch (e) {}
    }

    playRewindTick() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      this.playTone(280 + Math.random() * 80, 0.03, 'triangle', 0.08);
    }

    playHazard() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.25);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      } catch (e) {}
    }

    playVictory() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      const melody = [
        { f: 440, d: 0.12, t: 0 },
        { f: 554.37, d: 0.12, t: 110 },
        { f: 659.25, d: 0.16, t: 220 },
        { f: 880, d: 0.35, t: 360 }
      ];
      melody.forEach(item => {
        setTimeout(() => this.playTone(item.f, item.d, 'sine', 0.2), item.t);
      });
    }
  }

  // ==========================================================================
  // 3. STORAGE MANAGER
  // ==========================================================================
  class StorageManager {
    static getBestScore() {
      try {
        return parseInt(localStorage.getItem(STORAGE_KEYS.BEST_SCORE) || '0', 10);
      } catch (e) {
        return 0;
      }
    }

    static saveBestScore(score) {
      try {
        const current = this.getBestScore();
        if (score > current) {
          localStorage.setItem(STORAGE_KEYS.BEST_SCORE, String(score));
          return true;
        }
      } catch (e) {}
      return false;
    }

    static getUnlockedLevel() {
      try {
        const val = parseInt(localStorage.getItem(STORAGE_KEYS.UNLOCKED_LEVEL) || '1', 10);
        return Math.max(1, Math.min(5, isNaN(val) ? 1 : val));
      } catch (e) {
        return 1;
      }
    }

    static unlockLevel(levelNum) {
      try {
        const current = this.getUnlockedLevel();
        if (levelNum > current) {
          localStorage.setItem(STORAGE_KEYS.UNLOCKED_LEVEL, String(Math.min(5, levelNum)));
        }
      } catch (e) {}
    }

    static getStats() {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.STATS);
        return data ? JSON.parse(data) : {};
      } catch (e) {
        return {};
      }
    }

    static saveLevelStat(levelIdx, timeSec, shardsCount) {
      try {
        const stats = this.getStats();
        const prev = stats[levelIdx] || { bestTime: 9999, shards: 0 };
        stats[levelIdx] = {
          bestTime: Math.min(prev.bestTime, timeSec),
          shards: Math.max(prev.shards, shardsCount)
        };
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
      } catch (e) {}
    }
  }

  // ==========================================================================
  // 4. INPUT CONTROLLER
  // ==========================================================================
  class InputController {
    constructor(game) {
      this.game = game;
      this.keys = {
        left: false,
        right: false,
        jump: false,
        rewind: false,
        ghost: false
      };

      this.jumpBuffered = false;
      this.jumpBufferTimer = 0;
      this.preventScrollKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar']);

      this.initKeyboard();
      this.initTouch();
    }

    initKeyboard() {
      window.addEventListener('keydown', (e) => {
        if (this.preventScrollKeys.has(e.key) && this.game.state === 'PLAYING') {
          e.preventDefault();
        }

        const k = e.key.toLowerCase();

        if (k === 'arrowleft' || k === 'a') {
          this.keys.left = true;
        } else if (k === 'arrowright' || k === 'd') {
          this.keys.right = true;
        } else if (k === ' ' || k === 'arrowup' || k === 'w') {
          if (!this.keys.jump) {
            this.jumpBuffered = true;
            this.jumpBufferTimer = 0.14; // 140ms jump buffer
          }
          this.keys.jump = true;
        } else if (k === 'r') {
          this.keys.rewind = true;
        } else if (k === 'e') {
          if (!e.repeat) {
            this.game.triggerGhostAction();
          }
        } else if (k === 'p' || k === 'escape') {
          this.game.togglePause();
        } else if (k === 'm') {
          this.game.toggleSound();
        }
      });

      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') {
          this.keys.left = false;
        } else if (k === 'arrowright' || k === 'd') {
          this.keys.right = false;
        } else if (k === ' ' || k === 'arrowup' || k === 'w') {
          this.keys.jump = false;
          // Variable jump height cut
          if (this.game.player.vy < -160) {
            this.game.player.vy *= 0.5;
          }
        } else if (k === 'r') {
          this.keys.rewind = false;
        }
      });
    }

    initTouch() {
      const bindTouch = (id, onDown, onUp) => {
        const el = document.getElementById(id);
        if (!el) return;
        const downHandler = (e) => {
          e.preventDefault();
          onDown();
        };
        const upHandler = (e) => {
          e.preventDefault();
          onUp();
        };
        el.addEventListener('pointerdown', downHandler);
        el.addEventListener('pointerup', upHandler);
        el.addEventListener('pointercancel', upHandler);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      };

      bindTouch('tw-touch-left', () => { this.keys.left = true; }, () => { this.keys.left = false; });
      bindTouch('tw-touch-right', () => { this.keys.right = true; }, () => { this.keys.right = false; });
      bindTouch('tw-touch-jump', () => {
        this.keys.jump = true;
        this.jumpBuffered = true;
        this.jumpBufferTimer = 0.14;
      }, () => {
        this.keys.jump = false;
        if (this.game.player.vy < -160) {
          this.game.player.vy *= 0.5;
        }
      });
      bindTouch('tw-touch-rewind', () => { this.keys.rewind = true; }, () => { this.keys.rewind = false; });
      bindTouch('tw-touch-ghost', () => { this.game.triggerGhostAction(); }, () => {});
    }

    update(dt) {
      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer -= dt;
        if (this.jumpBufferTimer <= 0) {
          this.jumpBuffered = false;
        }
      }
    }

    consumeJump() {
      const can = this.jumpBuffered || this.keys.jump;
      this.jumpBuffered = false;
      this.jumpBufferTimer = 0;
      return can;
    }

    reset() {
      this.keys.left = false;
      this.keys.right = false;
      this.keys.jump = false;
      this.keys.rewind = false;
      this.jumpBuffered = false;
      this.jumpBufferTimer = 0;
    }
  }

  // ==========================================================================
  // 5. PARTICLE SYSTEM
  // ==========================================================================
  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.maxParticles = 160;
    }

    emit(x, y, count, options = {}) {
      const color = options.color || '#00f0ff';
      const speed = options.speed || 80;
      const size = options.size || 3;
      const life = options.life || 0.45;
      const shape = options.shape || 'circle';

      for (let i = 0; i < count; i++) {
        if (this.particles.length >= this.maxParticles) {
          this.particles.shift();
        }
        const angle = options.angle !== undefined ? options.angle + (Math.random() - 0.5) * (options.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);

        this.particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * s,
          vy: Math.sin(angle) * s,
          size: size * (0.6 + Math.random() * 0.6),
          life: life * (0.6 + Math.random() * 0.6),
          maxLife: life,
          color: color,
          shape: shape,
          gravity: options.gravity || 0
        });
      }
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    draw(ctx) {
      ctx.save();
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;

        if (p.shape === 'square') {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    clear() {
      this.particles = [];
    }
  }

  // ==========================================================================
  // 6. LEVEL DEFINITIONS (5 PROGRESSIVE CHAMBERS)
  // ==========================================================================
  const CHAMBERS = [
    // ------------------------------------------------------------------------
    // Chamber 1: First Moment (Basics, Movement, Jump, Exit Portal)
    // ------------------------------------------------------------------------
    {
      id: 1,
      title: "Chamber 01: First Moment",
      subtitle: "Temporal calibration & basic locomotive synchronization",
      spawn: { x: 70, y: 490 },
      portal: { x: 860, y: 460, width: 44, height: 64 },
      platforms: [
        // Borders
        { x: 0, y: 0, w: 960, h: 20 },
        { x: 0, y: 580, w: 960, h: 20 },
        { x: 0, y: 0, w: 20, h: 600 },
        { x: 940, y: 0, w: 20, h: 600 },
        // Stepping stones
        { x: 20, y: 540, w: 240, h: 40 },
        { x: 330, y: 480, w: 160, h: 24 },
        { x: 550, y: 430, w: 160, h: 24 },
        { x: 770, y: 530, w: 170, h: 50 },
        // Decorative high ledge
        { x: 380, y: 310, w: 200, h: 20 }
      ],
      hazards: [
        // Pit at bottom middle
        { x: 260, y: 570, w: 510, h: 10, type: 'laser' }
      ],
      plates: [],
      doors: [],
      movingPlatforms: [],
      fragments: [
        { x: 410, y: 440, collected: false },
        { x: 480, y: 270, collected: false },
        { x: 630, y: 390, collected: false }
      ]
    },

    // ------------------------------------------------------------------------
    // Chamber 2: The Switch (Pressure Plate & Blast Door)
    // ------------------------------------------------------------------------
    {
      id: 2,
      title: "Chamber 02: The Switch",
      subtitle: "Environmental logic & weighted switch mechanics",
      spawn: { x: 70, y: 490 },
      portal: { x: 880, y: 220, width: 44, height: 64 },
      platforms: [
        // Borders
        { x: 0, y: 0, w: 960, h: 20 },
        { x: 0, y: 580, w: 960, h: 20 },
        { x: 0, y: 0, w: 20, h: 600 },
        { x: 940, y: 0, w: 20, h: 600 },
        // Lower ground
        { x: 20, y: 540, w: 420, h: 40 },
        // Upper floor with portal
        { x: 520, y: 290, w: 420, h: 24 },
        // Middle wall partition
        { x: 500, y: 20, w: 24, h: 270 },
        // Mid-jump stepping ledges
        { x: 260, y: 410, w: 140, h: 20 },
        { x: 120, y: 310, w: 120, h: 20 }
      ],
      hazards: [
        { x: 440, y: 570, w: 500, h: 10, type: 'laser' }
      ],
      plates: [
        // Stepping on this plate opens Door 1
        { id: 'plate1', x: 160, y: 300, w: 40, h: 10, doorId: 'door1', pressed: false }
      ],
      doors: [
        // Blast door blocking passage on upper platform
        { id: 'door1', x: 680, y: 190, w: 22, h: 100, openOffset: 95, state: 0 }
      ],
      movingPlatforms: [],
      fragments: [
        { x: 330, y: 370, collected: false },
        { x: 180, y: 260, collected: false },
        { x: 780, y: 250, collected: false }
      ]
    },

    // ------------------------------------------------------------------------
    // Chamber 3: Echo Chamber (Introducing Ghost Replay)
    // ------------------------------------------------------------------------
    {
      id: 3,
      title: "Chamber 03: Echo Chamber",
      subtitle: "Summon past chronoghost to hold remote pressure terminals",
      spawn: { x: 70, y: 490 },
      portal: { x: 880, y: 480, width: 44, height: 64 },
      platforms: [
        // Borders
        { x: 0, y: 0, w: 960, h: 20 },
        { x: 0, y: 580, w: 960, h: 20 },
        { x: 0, y: 0, w: 20, h: 600 },
        { x: 940, y: 0, w: 20, h: 600 },
        // Starting platform
        { x: 20, y: 540, w: 220, h: 40 },
        // Central high tower
        { x: 320, y: 420, w: 180, h: 24 },
        // Remote switch outpost (far left high)
        { x: 60, y: 280, w: 180, h: 20 },
        // Far right exit ground
        { x: 580, y: 540, w: 360, h: 40 },
        // Intermediate pillar
        { x: 420, y: 220, w: 120, h: 20 }
      ],
      hazards: [
        { x: 240, y: 570, w: 340, h: 10, type: 'laser' }
      ],
      plates: [
        // High remote plate: requires ghost weight while player crosses right!
        { id: 'plate1', x: 130, y: 270, w: 44, h: 10, doorId: 'door1', pressed: false }
      ],
      doors: [
        // Blast door on exit platform
        { id: 'door1', x: 720, y: 440, w: 24, h: 100, openOffset: 95, state: 0 }
      ],
      movingPlatforms: [],
      fragments: [
        { x: 150, y: 230, collected: false },
        { x: 480, y: 180, collected: false },
        { x: 660, y: 490, collected: false }
      ]
    },

    // ------------------------------------------------------------------------
    // Chamber 4: Split Second (Moving Platform & Laser Hazard Coordination)
    // ------------------------------------------------------------------------
    {
      id: 4,
      title: "Chamber 04: Split Second",
      subtitle: "Temporal platform synchronization across oscillating beams",
      spawn: { x: 70, y: 490 },
      portal: { x: 880, y: 190, width: 44, height: 64 },
      platforms: [
        // Borders
        { x: 0, y: 0, w: 960, h: 20 },
        { x: 0, y: 580, w: 960, h: 20 },
        { x: 0, y: 0, w: 20, h: 600 },
        { x: 940, y: 0, w: 20, h: 600 },
        // Left base
        { x: 20, y: 540, w: 220, h: 40 },
        // Center lower switch deck
        { x: 340, y: 480, w: 160, h: 20 },
        // Top right exit deck
        { x: 680, y: 260, w: 260, h: 24 },
        // Divider ceiling wall
        { x: 660, y: 20, w: 20, h: 240 }
      ],
      hazards: [
        // Pit at base
        { x: 240, y: 570, w: 700, h: 10, type: 'laser' },
        // Pulsing barrier guarding top portal
        { x: 760, y: 80, w: 16, h: 180, type: 'laser', cycle: true, period: 3.5, activeTime: 1.8 }
      ],
      plates: [
        // Center plate opens Door 1
        { id: 'plate1', x: 400, y: 470, w: 44, h: 10, doorId: 'door1', pressed: false }
      ],
      doors: [
        // Door 1 blocks moving platform access to upper portal
        { id: 'door1', x: 680, y: 160, w: 20, h: 100, openOffset: 95, state: 0 }
      ],
      movingPlatforms: [
        // Patrols between center deck and upper platform
        { x: 480, y: 380, w: 120, h: 18, x1: 440, y1: 380, x2: 600, y2: 300, speed: 65, progress: 0 }
      ],
      fragments: [
        { x: 420, y: 430, collected: false },
        { x: 560, y: 240, collected: false },
        { x: 820, y: 210, collected: false }
      ]
    },

    // ------------------------------------------------------------------------
    // Chamber 5: Temporal Core (Master Challenge: Dual Terminals & Rift Core)
    // ------------------------------------------------------------------------
    {
      id: 5,
      title: "Chamber 05: Temporal Core",
      subtitle: "Quantum anomaly apex: Coordinate multi-stage containment override",
      spawn: { x: 70, y: 490 },
      portal: { x: 860, y: 130, width: 48, height: 68 },
      platforms: [
        // Borders
        { x: 0, y: 0, w: 960, h: 20 },
        { x: 0, y: 580, w: 960, h: 20 },
        { x: 0, y: 0, w: 20, h: 600 },
        { x: 940, y: 0, w: 20, h: 600 },
        // Ground stage
        { x: 20, y: 540, w: 200, h: 40 },
        // Far left high terminal
        { x: 60, y: 280, w: 160, h: 20 },
        // Central island
        { x: 380, y: 420, w: 200, h: 24 },
        // High central platform
        { x: 420, y: 230, w: 140, h: 20 },
        // Apex right portal platform
        { x: 740, y: 200, w: 200, h: 24 },
        // Lower right safety step
        { x: 760, y: 460, w: 180, h: 24 }
      ],
      hazards: [
        // Bottom void
        { x: 220, y: 570, w: 720, h: 10, type: 'laser' },
        // Center laser grid
        { x: 580, y: 230, w: 16, h: 190, type: 'laser', cycle: true, period: 3.0, activeTime: 1.5 }
      ],
      plates: [
        // High left terminal plate (Door 1)
        { id: 'plate1', x: 120, y: 270, w: 44, h: 10, doorId: 'door1', pressed: false },
        // Center plate (Door 2)
        { id: 'plate2', x: 470, y: 220, w: 44, h: 10, doorId: 'door2', pressed: false }
      ],
      doors: [
        // Door 1 seals access to upper central island
        { id: 'door1', x: 380, y: 320, w: 22, h: 100, openOffset: 95, state: 0 },
        // Door 2 seals the final Core Portal
        { id: 'door2', x: 740, y: 105, w: 24, h: 95, openOffset: 90, state: 0 }
      ],
      movingPlatforms: [
        // Carries player across the void
        { x: 240, y: 460, w: 110, h: 18, x1: 220, y1: 460, x2: 360, y2: 440, speed: 50, progress: 0 }
      ],
      fragments: [
        { x: 140, y: 230, collected: false },
        { x: 490, y: 180, collected: false },
        { x: 800, y: 410, collected: false }
      ]
    }
  ];

  // ==========================================================================
  // 7. TIME WARP CORE GAME ENGINE
  // ==========================================================================
  class TimeWarpGame {
    constructor() {
      this.canvas = document.getElementById('tw-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.sound = new SoundEngine();
      this.input = new InputController(this);
      this.particles = new ParticleSystem();

      this.state = 'MENU'; // MENU, PLAYING, PAUSED, LEVEL_COMPLETE, PARADOX
      this.currentLevelIdx = 0;
      this.levelData = null;

      // Player entity
      this.player = {
        x: 100,
        y: 400,
        vx: 0,
        vy: 0,
        width: 22,
        height: 34,
        facing: 1, // 1: right, -1: left
        grounded: false,
        coyoteTimer: 0,
        squashY: 1,
        animTimer: 0
      };

      // Ghost entity
      this.ghost = {
        active: false,
        frames: [],
        elapsed: 0,
        cursor: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        facing: 1,
        width: 22,
        height: 34,
        duration: 0,
        maxDuration: 0
      };

      // Time Rewind System
      this.historyBuffer = [];
      this.historyTime = 0;
      this.rewindEnergy = 6.0; // Seconds available
      this.maxRewindEnergy = 6.0;
      this.isRewinding = false;
      this.rewindsUsedInChamber = 0;

      // Gameplay session stats
      this.chamberStartTime = 0;
      this.chamberElapsed = 0;
      this.score = 0;
      this.collectedInChamber = 0;

      // Timestep loop variables
      this.lastTimestamp = 0;
      this.accumulator = 0;

      this.initDomElements();
      this.bindEvents();
      this.updateMenuStats();
      this.renderLevelSelectGrid();

      // Start animation loop
      requestAnimationFrame(this.loop.bind(this));
    }

    // ------------------------------------------------------------------------
    // UI & DOM Binding
    // ------------------------------------------------------------------------
    initDomElements() {
      // HUD readouts
      this.hudLevel = document.getElementById('tw-hud-level');
      this.hudTime = document.getElementById('tw-hud-time');
      this.hudFragments = document.getElementById('tw-hud-fragments');
      this.hudScore = document.getElementById('tw-hud-score');
      this.hudRewindBar = document.getElementById('tw-hud-rewind-bar');
      this.hudRewindVal = document.getElementById('tw-hud-rewind-val');
      this.hudGhostStatus = document.getElementById('tw-hud-ghost-status');
      this.hudGhostPill = document.getElementById('tw-ghost-pill');

      // In-game overlays
      this.rewindOverlay = document.getElementById('tw-rewind-overlay');
      this.ghostBanner = document.getElementById('tw-ghost-banner');
      this.ghostBannerText = document.getElementById('tw-ghost-banner-text');

      // Modals
      this.menuModal = document.getElementById('tw-menu-modal');
      this.howModal = document.getElementById('tw-how-modal');
      this.levelsModal = document.getElementById('tw-levels-modal');
      this.pauseModal = document.getElementById('tw-pause-modal');
      this.completeModal = document.getElementById('tw-complete-modal');
      this.failedModal = document.getElementById('tw-failed-modal');
    }

    bindEvents() {
      // Sound Toggle
      const soundBtn = document.getElementById('tw-btn-sound');
      if (soundBtn) {
        soundBtn.addEventListener('click', () => this.toggleSound());
      }

      // HUD buttons
      document.getElementById('tw-btn-restart')?.addEventListener('click', () => this.restartChamber());
      document.getElementById('tw-btn-pause')?.addEventListener('click', () => this.togglePause());

      // Menu buttons
      document.getElementById('tw-btn-play')?.addEventListener('click', () => {
        this.startLevel(StorageManager.getUnlockedLevel() - 1);
      });
      document.getElementById('tw-btn-levels')?.addEventListener('click', () => this.openLevelSelect());
      document.getElementById('tw-btn-how')?.addEventListener('click', () => this.openHowToPlay());

      // How to Play buttons
      document.getElementById('tw-btn-close-how')?.addEventListener('click', () => this.closeHowToPlay());
      document.getElementById('tw-btn-how-start')?.addEventListener('click', () => {
        this.closeHowToPlay();
        if (this.state === 'MENU') {
          this.startLevel(StorageManager.getUnlockedLevel() - 1);
        }
      });

      // Level select close
      document.getElementById('tw-btn-close-levels')?.addEventListener('click', () => this.closeLevelSelect());

      // Pause modal buttons
      document.getElementById('tw-btn-resume')?.addEventListener('click', () => this.togglePause());
      document.getElementById('tw-btn-pause-restart')?.addEventListener('click', () => {
        this.togglePause();
        this.restartChamber();
      });
      document.getElementById('tw-btn-pause-how')?.addEventListener('click', () => {
        this.pauseModal.classList.add('tw-hidden');
        this.openHowToPlay();
      });
      document.getElementById('tw-btn-pause-menu')?.addEventListener('click', () => this.exitToMenu());

      // Complete modal buttons
      document.getElementById('tw-btn-next-level')?.addEventListener('click', () => this.nextLevel());
      document.getElementById('tw-btn-replay-level')?.addEventListener('click', () => this.restartChamber());
      document.getElementById('tw-btn-complete-menu')?.addEventListener('click', () => this.exitToMenu());

      // Failed modal buttons
      document.getElementById('tw-btn-fail-rewind')?.addEventListener('click', () => {
        this.failedModal.classList.add('tw-hidden');
        this.state = 'PLAYING';
        this.input.keys.rewind = true;
      });
      document.getElementById('tw-btn-fail-restart')?.addEventListener('click', () => this.restartChamber());
      document.getElementById('tw-btn-fail-menu')?.addEventListener('click', () => this.exitToMenu());

      // Sound initial visual sync
      this.updateSoundIcons();
    }

    toggleSound() {
      const active = this.sound.toggle();
      this.updateSoundIcons();
    }

    updateSoundIcons() {
      const onIcon = document.querySelector('.tw-icon-sound-on');
      const offIcon = document.querySelector('.tw-icon-sound-off');
      if (onIcon && offIcon) {
        if (this.sound.enabled) {
          onIcon.classList.remove('tw-hidden');
          offIcon.classList.add('tw-hidden');
        } else {
          onIcon.classList.add('tw-hidden');
          offIcon.classList.remove('tw-hidden');
        }
      }
    }

    updateMenuStats() {
      const best = StorageManager.getBestScore();
      const unlocked = StorageManager.getUnlockedLevel();
      const stats = StorageManager.getStats();

      let totalShards = 0;
      Object.values(stats).forEach(s => { totalShards += (s.shards || 0); });

      const elBest = document.getElementById('tw-menu-best-score');
      const elUnlocked = document.getElementById('tw-menu-unlocked');
      const elShards = document.getElementById('tw-menu-shards');

      if (elBest) elBest.textContent = best.toLocaleString();
      if (elUnlocked) elUnlocked.textContent = `${unlocked} / ${CHAMBERS.length}`;
      if (elShards) elShards.textContent = `${totalShards} / ${CHAMBERS.length * 3}`;
    }

    renderLevelSelectGrid() {
      const grid = document.getElementById('tw-levels-grid');
      if (!grid) return;
      grid.innerHTML = '';

      const unlockedLevel = StorageManager.getUnlockedLevel();
      const stats = StorageManager.getStats();

      CHAMBERS.forEach((ch, idx) => {
        const isUnlocked = idx + 1 <= unlockedLevel;
        const stat = stats[idx] || { bestTime: 9999, shards: 0 };

        const tile = document.createElement('div');
        tile.className = `tw-chamber-tile ${isUnlocked ? '' : 'locked'} ${idx === this.currentLevelIdx ? 'active-level' : ''}`;
        tile.setAttribute('role', 'button');
        tile.setAttribute('tabindex', isUnlocked ? '0' : '-1');

        let footerText = isUnlocked
          ? (stat.bestTime < 9999 ? `PB: ${stat.bestTime.toFixed(1)}s &bull; ${stat.shards}/3 SHARDS` : 'UNCOMPLETED')
          : 'LOCKED';

        tile.innerHTML = `
          <div class="tw-tile-top">
            <span class="tw-tile-num">${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              ${isUnlocked
                ? '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'
                : '<rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>'}
            </svg>
          </div>
          <div class="tw-tile-title">${ch.title.split(': ')[1] || ch.title}</div>
          <div class="tw-tile-sub">${ch.subtitle}</div>
          <div class="tw-tile-footer">
            <span>${footerText}</span>
          </div>
        `;

        if (isUnlocked) {
          tile.addEventListener('click', () => {
            this.closeLevelSelect();
            this.startLevel(idx);
          });
        }

        grid.appendChild(tile);
      });
    }

    openHowToPlay() {
      this.howModal?.classList.remove('tw-hidden');
    }

    closeHowToPlay() {
      this.howModal?.classList.add('tw-hidden');
      if (this.state === 'PAUSED') {
        this.pauseModal?.classList.remove('tw-hidden');
      }
    }

    openLevelSelect() {
      this.renderLevelSelectGrid();
      this.levelsModal?.classList.remove('tw-hidden');
    }

    closeLevelSelect() {
      this.levelsModal?.classList.add('tw-hidden');
    }

    togglePause() {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.pauseModal?.classList.remove('tw-hidden');
        this.sound.playBlip(320, 0.08, 'triangle');
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.pauseModal?.classList.add('tw-hidden');
        this.sound.playBlip(480, 0.08, 'sine');
      }
    }

    exitToMenu() {
      this.state = 'MENU';
      this.pauseModal?.classList.add('tw-hidden');
      this.completeModal?.classList.add('tw-hidden');
      this.failedModal?.classList.add('tw-hidden');
      this.menuModal?.classList.remove('tw-hidden');
      this.ghost.active = false;
      this.historyBuffer = [];
      this.updateMenuStats();
    }

    // ------------------------------------------------------------------------
    // Chamber Lifecycle
    // ------------------------------------------------------------------------
    startLevel(index) {
      if (index < 0 || index >= CHAMBERS.length) index = 0;
      this.currentLevelIdx = index;

      // Deep clone level definition
      const raw = CHAMBERS[index];
      this.levelData = {
        id: raw.id,
        title: raw.title,
        subtitle: raw.subtitle,
        spawn: { ...raw.spawn },
        portal: { ...raw.portal },
        platforms: raw.platforms.map(p => ({ ...p })),
        hazards: raw.hazards.map(h => ({ ...h, timer: 0 })),
        plates: raw.plates.map(p => ({ ...p, pressed: false, currentOffsetY: 0 })),
        doors: raw.doors.map(d => ({ ...d, currentOffset: 0 })),
        movingPlatforms: raw.movingPlatforms.map(m => ({ ...m })),
        fragments: raw.fragments.map(f => ({ ...f, anim: Math.random() * Math.PI * 2 }))
      };

      // Reset entities
      this.player.x = this.levelData.spawn.x;
      this.player.y = this.levelData.spawn.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.grounded = true;
      this.player.facing = 1;
      this.player.coyoteTimer = 0;
      this.player.animTimer = 0;

      // Reset ghost & history
      this.ghost.active = false;
      this.ghost.frames = [];
      this.ghost.elapsed = 0;
      this.ghost.cursor = 0;
      this.historyBuffer = [];
      this.historyTime = 0;
      this.rewindEnergy = this.maxRewindEnergy;
      this.rewindsUsedInChamber = 0;
      this.isRewinding = false;
      this.collectedInChamber = 0;

      this.chamberStartTime = performance.now();
      this.chamberElapsed = 0;

      this.input.reset();
      this.particles.clear();

      // UI reset
      this.menuModal?.classList.add('tw-hidden');
      this.pauseModal?.classList.add('tw-hidden');
      this.completeModal?.classList.add('tw-hidden');
      this.failedModal?.classList.add('tw-hidden');
      this.rewindOverlay?.classList.add('tw-hidden');
      this.ghostBanner?.classList.add('tw-hidden');

      this.updateHud();
      this.state = 'PLAYING';
      this.sound.playBlip(540, 0.12, 'sine');
    }

    restartChamber() {
      this.startLevel(this.currentLevelIdx);
    }

    nextLevel() {
      if (this.currentLevelIdx + 1 < CHAMBERS.length) {
        this.startLevel(this.currentLevelIdx + 1);
      } else {
        this.exitToMenu();
      }
    }

    triggerParadox(reason = 'Quantum Hazard Contact') {
      if (this.state !== 'PLAYING') return;
      this.sound.playHazard();
      this.state = 'PARADOX';

      const reasonEl = document.getElementById('tw-failed-reason');
      if (reasonEl) reasonEl.textContent = reason;

      this.failedModal?.classList.remove('tw-hidden');
    }

    triggerLevelComplete() {
      if (this.state !== 'PLAYING') return;
      this.state = 'LEVEL_COMPLETE';
      this.sound.playVictory();

      // Calculate score
      const elapsedSec = this.chamberElapsed;
      const baseScore = 1000;
      const shardBonus = this.collectedInChamber * 400;
      const timeBonus = Math.max(0, Math.floor(1200 - elapsedSec * 25));
      const efficiencyBonus = Math.max(0, 500 - this.rewindsUsedInChamber * 60);
      const chamberScore = baseScore + shardBonus + timeBonus + efficiencyBonus;
      this.score += chamberScore;

      // Save unlocks & high score
      StorageManager.unlockLevel(this.currentLevelIdx + 2);
      StorageManager.saveBestScore(this.score);
      StorageManager.saveLevelStat(this.currentLevelIdx, elapsedSec, this.collectedInChamber);

      // Populate completion dialog
      const elTitle = document.getElementById('tw-complete-level-title');
      const elTime = document.getElementById('tw-res-time');
      const elShards = document.getElementById('tw-res-shards');
      const elRewinds = document.getElementById('tw-res-rewinds');
      const elScore = document.getElementById('tw-res-score');
      const elNextBtn = document.getElementById('tw-next-btn-text');

      if (elTitle) elTitle.textContent = this.levelData.title;
      if (elTime) elTime.textContent = this.formatTime(elapsedSec);
      if (elShards) elShards.textContent = `${this.collectedInChamber} / ${this.levelData.fragments.length}`;
      if (elRewinds) elRewinds.textContent = String(this.rewindsUsedInChamber);
      if (elScore) elScore.textContent = `+${chamberScore.toLocaleString()}`;

      if (elNextBtn) {
        elNextBtn.textContent = this.currentLevelIdx + 1 >= CHAMBERS.length
          ? 'COMPLETE CHRONO CAMPAIGN'
          : 'ADVANCE TO NEXT CHAMBER';
      }

      this.completeModal?.classList.remove('tw-hidden');
      this.particles.emit(this.levelData.portal.x + 22, this.levelData.portal.y + 32, 60, {
        color: '#fbbf24',
        speed: 160,
        life: 0.9
      });
    }

    // ------------------------------------------------------------------------
    // Ghost Replay Activation
    // ------------------------------------------------------------------------
    triggerGhostAction() {
      if (this.state !== 'PLAYING') return;

      // Extract past recorded actions from the history buffer
      if (this.historyBuffer.length < 20) {
        // Not enough history recorded yet
        this.sound.playBlip(200, 0.08, 'sawtooth');
        return;
      }

      // Copy a duration-bounded timeline. Rewind can mutate the history buffer
      // while this ghost continues replaying its detached recording.
      const end = this.historyBuffer[this.historyBuffer.length - 1].timestamp;
      const slice = this.historyBuffer.filter(frame => frame.timestamp >= end - GHOST_RECORD_SECONDS)
        .map(frame => ({ ...frame }));

      this.ghost.frames = slice;
      this.ghost.elapsed = 0;
      this.ghost.cursor = 0;
      this.ghost.active = true;
      this.ghost.x = slice[0].x;
      this.ghost.y = slice[0].y;
      this.ghost.vx = slice[0].vx;
      this.ghost.vy = slice[0].vy;
      this.ghost.facing = slice[0].facing;
      this.ghost.duration = slice[slice.length - 1].timestamp - slice[0].timestamp;
      this.ghost.maxDuration = this.ghost.duration;

      this.sound.playGhostSpawn();
      this.particles.emit(this.ghost.x + 11, this.ghost.y + 17, 30, {
        color: '#b026ff',
        speed: 120,
        life: 0.6
      });
    }

    // ------------------------------------------------------------------------
    // Physics & Time Update Loop
    // ------------------------------------------------------------------------
    update(dt) {
      if (this.state !== 'PLAYING') return;

      this.chamberElapsed += dt;
      this.input.update(dt);
      this.particles.update(dt);

      // Handle Rewind vs Normal Simulation
      if (this.input.keys.rewind && this.historyBuffer.length > 0 && this.rewindEnergy > 0) {
        this.stepRewind(dt);
      } else {
        this.stepForward(dt);
      }

      // Update Moving Platforms
      this.updateMovingPlatforms(dt);

      // Update Laser Hazards
      this.updateHazards(dt);

      // Update Ghost Replay
      this.updateGhost(dt);

      // Update Pressure Plates & Blast Doors
      this.updatePuzzles(dt);

      // Check Collectibles
      this.updateFragments();

      // Check Portal
      this.checkPortal();

      // Update HUD
      this.updateHud();
    }

    stepForward(dt) {
      this.isRewinding = false;
      this.rewindOverlay?.classList.add('tw-hidden');

      // Recover rewind energy gradually while not rewinding
      this.rewindEnergy = Math.min(this.maxRewindEnergy, this.rewindEnergy + dt * 0.85);

      const p = this.player;
      const moveX = (this.input.keys.right ? 1 : 0) - (this.input.keys.left ? 1 : 0);

      // Horizontal acceleration & friction
      const accel = p.grounded ? 2400 : 1600;
      const maxSpeed = 240;
      const friction = p.grounded ? 1900 : 700;

      if (moveX !== 0) {
        p.vx += moveX * accel * dt;
        p.facing = moveX;
        if (Math.abs(p.vx) > maxSpeed) {
          p.vx = Math.sign(p.vx) * maxSpeed;
        }
      } else {
        if (p.vx > 0) {
          p.vx = Math.max(0, p.vx - friction * dt);
        } else if (p.vx < 0) {
          p.vx = Math.min(0, p.vx + friction * dt);
        }
      }

      // Coyote time update
      if (p.grounded) {
        p.coyoteTimer = 0.1; // 100ms grace period
      } else {
        p.coyoteTimer -= dt;
      }

      // Gravity
      p.vy += 1350 * dt;
      if (p.vy > 750) p.vy = 750; // Terminal velocity

      // Jump execution
      if (this.input.consumeJump() && p.coyoteTimer > 0) {
        p.vy = -530;
        p.coyoteTimer = 0;
        p.grounded = false;
        this.sound.playJump();
        this.particles.emit(p.x + p.width / 2, p.y + p.height, 12, {
          color: '#00f0ff',
          speed: 60,
          angle: Math.PI / 2,
          spread: Math.PI * 0.6,
          life: 0.35
        });
      }

      // Resolve Horizontal Movement
      p.x += p.vx * dt;
      this.resolveCollisionX(p);

      // Resolve Vertical Movement
      const wasGrounded = p.grounded;
      p.grounded = false;
      p.y += p.vy * dt;
      this.resolveCollisionY(p);

      // Landing sound & particle
      if (!wasGrounded && p.grounded && p.vy === 0) {
        this.sound.playLand();
        this.particles.emit(p.x + p.width / 2, p.y + p.height, 8, {
          color: '#ffffff',
          speed: 40,
          angle: -Math.PI / 2,
          spread: Math.PI * 0.8,
          life: 0.25
        });
      }

      // Animation & squashing
      p.animTimer += dt * (Math.abs(p.vx) > 10 ? 12 : 2);

      // Boundary clamp
      if (p.x < 20) p.x = 20;
      if (p.x + p.width > CANVAS_WIDTH - 20) p.x = CANVAS_WIDTH - 20 - p.width;

      // Bottom pit death
      if (p.y > CANVAS_HEIGHT - 30) {
        this.triggerParadox('Fell into temporal vacuum chasm');
        return;
      }

      // Record snapshot to circular history buffer
      this.recordSnapshot(dt);
    }

    recordSnapshot(dt = FIXED_DELTA) {
      this.historyTime += dt;
      const snap = {
        timestamp: this.historyTime,
        x: this.player.x,
        y: this.player.y,
        vx: this.player.vx,
        vy: this.player.vy,
        facing: this.player.facing,
        grounded: this.player.grounded,
        time: this.chamberElapsed
      };

      this.historyBuffer.push(snap);
      if (this.historyBuffer.length > MAX_HISTORY_FRAMES) {
        this.historyBuffer.shift();
      }
    }

    stepRewind(dt) {
      if (!this.isRewinding) {
        this.isRewinding = true;
        this.rewindsUsedInChamber++;
        this.sound.playRewindTick();
      }

      this.rewindOverlay?.classList.remove('tw-hidden');

      // Consume energy
      this.rewindEnergy = Math.max(0, this.rewindEnergy - dt * 2.2);

      // Step back 2 snapshots per tick for brisk, responsive rewind
      for (let s = 0; s < 2; s++) {
        if (this.historyBuffer.length > 0) {
          const snap = this.historyBuffer.pop();
          // Resume new recordings on the restored simulation timeline, not
          // the ever-increasing chamber timer (which would introduce a gap).
          this.historyTime = snap.timestamp;
          this.player.x = snap.x;
          this.player.y = snap.y;
          this.player.vx = snap.vx;
          this.player.vy = snap.vy;
          this.player.facing = snap.facing;
          this.player.grounded = snap.grounded;

          // Rewind particles
          if (Math.random() < 0.3) {
            this.particles.emit(snap.x + 11, snap.y + 17, 1, {
              color: '#b026ff',
              speed: 30,
              life: 0.2
            });
          }
        }
      }

      // If rewind energy depleted, force release
      if (this.rewindEnergy <= 0 || this.historyBuffer.length === 0) {
        this.input.keys.rewind = false;
        this.isRewinding = false;
        this.rewindOverlay?.classList.add('tw-hidden');
      }
    }

    updateGhost(dt) {
      if (!this.ghost.active) {
        this.hudGhostStatus.textContent = 'GHOST: READY [E]';
        this.hudGhostPill.classList.remove('active');
        this.ghostBanner?.classList.add('tw-hidden');
        return;
      }

      this.ghost.elapsed += Math.max(0, dt);
      this.ghost.duration = Math.max(0, this.ghost.maxDuration - this.ghost.elapsed);
      if (this.ghost.elapsed > this.ghost.maxDuration + 1e-9) {
        // Ghost timeline finished
        this.ghost.active = false;
        this.particles.emit(this.ghost.x + 11, this.ghost.y + 17, 24, {
          color: '#c084fc',
          speed: 80,
          life: 0.4
        });
        return;
      }

      // Sample elapsed simulation time, independent of the number of calls.
      // The existing fixed-step loop remains unchanged for puzzle physics.
      const frames = this.ghost.frames;
      const target = frames[0].timestamp + Math.min(this.ghost.elapsed, this.ghost.maxDuration);
      while (this.ghost.cursor + 1 < frames.length && frames[this.ghost.cursor + 1].timestamp <= target + 1e-9) {
        this.ghost.cursor++;
      }
      const from = frames[this.ghost.cursor];
      const to = frames[Math.min(this.ghost.cursor + 1, frames.length - 1)];
      const span = to.timestamp - from.timestamp;
      const alpha = span > 0 ? Math.max(0, Math.min(1, (target - from.timestamp) / span)) : 0;
      for (const key of ['x', 'y', 'vx', 'vy']) this.ghost[key] = from[key] + (to[key] - from[key]) * alpha;
      this.ghost.facing = from.facing;

      // Update UI Pill & Floating Banner
      const secRem = Math.max(0, this.ghost.duration).toFixed(1);
      this.hudGhostStatus.textContent = `GHOST: ACTIVE (${secRem}s)`;
      this.hudGhostPill.classList.add('active');

      if (this.ghostBanner && this.ghostBannerText) {
        this.ghostBanner.classList.remove('tw-hidden');
        this.ghostBannerText.textContent = `CHRONO GHOST ACTIVE (${secRem}s)`;
      }

      // Ghost trail particles
      if (Math.random() < 0.25) {
        this.particles.emit(this.ghost.x + 11, this.ghost.y + 17, 1, {
          color: 'rgba(176, 38, 255, 0.4)',
          speed: 15,
          life: 0.3
        });
      }
    }

    updateMovingPlatforms(dt) {
      if (!this.levelData || !this.levelData.movingPlatforms) return;

      this.levelData.movingPlatforms.forEach(mp => {
        mp.progress = (mp.progress || 0) + (dt * mp.speed) / 100;
        const t = (Math.sin(mp.progress) + 1) / 2; // Smooth ping-pong oscillation
        const prevX = mp.x;
        const prevY = mp.y;

        mp.x = mp.x1 + (mp.x2 - mp.x1) * t;
        mp.y = mp.y1 + (mp.y2 - mp.y1) * t;

        const deltaX = mp.x - prevX;
        const deltaY = mp.y - prevY;

        // Carry player if standing on platform
        const p = this.player;
        if (p.grounded && p.x + p.width > mp.x && p.x < mp.x + mp.w && Math.abs((p.y + p.height) - mp.y) < 6) {
          p.x += deltaX;
          p.y += deltaY;
        }
      });
    }

    updateHazards(dt) {
      if (!this.levelData || !this.levelData.hazards) return;

      const pBox = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };

      this.levelData.hazards.forEach(h => {
        let isActive = true;
        if (h.cycle) {
          h.timer = (h.timer + dt) % h.period;
          isActive = h.timer < h.activeTime;
        }

        if (isActive) {
          if (this.checkOverlap(pBox, h)) {
            this.triggerParadox('Lethal energy beam disintegration');
          }
        }
      });
    }

    updatePuzzles(dt) {
      if (!this.levelData) return;

      const pBox = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };
      const gBox = this.ghost.active
        ? { x: this.ghost.x, y: this.ghost.y, w: this.ghost.width, h: this.ghost.height }
        : null;

      // Evaluate pressure plates
      const activeDoorIds = new Set();

      this.levelData.plates.forEach(plate => {
        const pOn = this.checkOverlap(pBox, plate);
        const gOn = gBox ? this.checkOverlap(gBox, plate) : false;
        const isDepressed = pOn || gOn;

        if (isDepressed !== plate.pressed) {
          plate.pressed = isDepressed;
          this.sound.playSwitch(isDepressed);
          this.particles.emit(plate.x + plate.w / 2, plate.y + 4, 10, {
            color: isDepressed ? '#00f0ff' : '#a855f7',
            speed: 50,
            life: 0.25
          });
        }

        // Animate depression offset
        const targetOffset = plate.pressed ? 4 : 0;
        plate.currentOffsetY += (targetOffset - plate.currentOffsetY) * dt * 18;

        if (plate.pressed && plate.doorId) {
          activeDoorIds.add(plate.doorId);
        }
      });

      // Update blast doors
      this.levelData.doors.forEach(door => {
        const shouldOpen = activeDoorIds.has(door.id);
        const targetOffset = shouldOpen ? door.openOffset : 0;
        const prevOffset = door.currentOffset;

        door.currentOffset += (targetOffset - door.currentOffset) * dt * 8;

        if (Math.abs(door.currentOffset - prevOffset) > 0.5) {
          if (!door.soundPlayed) {
            this.sound.playDoor(shouldOpen);
            door.soundPlayed = true;
          }
        } else {
          door.soundPlayed = false;
        }
      });
    }

    updateFragments() {
      if (!this.levelData || !this.levelData.fragments) return;

      const pBox = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };

      this.levelData.fragments.forEach((frag, idx) => {
        if (!frag.collected) {
          frag.anim = (frag.anim || 0) + FIXED_DELTA * 3;
          const fBox = { x: frag.x - 12, y: frag.y - 12, w: 24, h: 24 };

          if (this.checkOverlap(pBox, fBox)) {
            frag.collected = true;
            this.collectedInChamber++;
            this.score += 300;
            this.sound.playFragment();
            this.particles.emit(frag.x, frag.y, 25, {
              color: '#00f0ff',
              speed: 90,
              life: 0.6
            });
          }
        }
      });
    }

    checkPortal() {
      if (!this.levelData) return;
      const pBox = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };
      const portal = this.levelData.portal;

      if (this.checkOverlap(pBox, portal)) {
        this.triggerLevelComplete();
      }
    }

    // ------------------------------------------------------------------------
    // Collision Resolutions (Tile Platforms & Closed Doors)
    // ------------------------------------------------------------------------
    getSolids() {
      const solids = [...this.levelData.platforms];

      // Add closed blast doors
      if (this.levelData.doors) {
        this.levelData.doors.forEach(d => {
          // Effective solid height reduces as door slides open
          const effectiveH = Math.max(0, d.h - d.currentOffset);
          if (effectiveH > 8) {
            solids.push({
              x: d.x,
              y: d.y,
              w: d.w,
              h: effectiveH
            });
          }
        });
      }

      // Add moving platforms
      if (this.levelData.movingPlatforms) {
        this.levelData.movingPlatforms.forEach(mp => {
          solids.push({
            x: mp.x,
            y: mp.y,
            w: mp.w,
            h: mp.h
          });
        });
      }

      return solids;
    }

    resolveCollisionX(entity) {
      const solids = this.getSolids();
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (this.checkOverlap(entity, s)) {
          if (entity.vx > 0) {
            entity.x = s.x - entity.width;
            entity.vx = 0;
          } else if (entity.vx < 0) {
            entity.x = s.x + s.w;
            entity.vx = 0;
          }
        }
      }
    }

    resolveCollisionY(entity) {
      const solids = this.getSolids();
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (this.checkOverlap(entity, s)) {
          if (entity.vy > 0) {
            entity.y = s.y - entity.height;
            entity.vy = 0;
            entity.grounded = true;
          } else if (entity.vy < 0) {
            entity.y = s.y + s.h;
            entity.vy = 0;
          }
        }
      }
    }

    checkOverlap(r1, r2) {
      const r1w = r1.width || r1.w;
      const r1h = r1.height || r1.h;
      const r2w = r2.width || r2.w;
      const r2h = r2.height || r2.h;
      return (
        r1.x < r2.x + r2w &&
        r1.x + r1w > r2.x &&
        r1.y < r2.y + r2h &&
        r1.y + r1h > r2.y
      );
    }

    // ------------------------------------------------------------------------
    // HUD Update
    // ------------------------------------------------------------------------
    updateHud() {
      if (this.hudLevel) this.hudLevel.textContent = `0${this.currentLevelIdx + 1}`;
      if (this.hudTime) this.hudTime.textContent = this.formatTime(this.chamberElapsed);
      if (this.hudFragments) {
        const total = this.levelData ? this.levelData.fragments.length : 3;
        this.hudFragments.textContent = `${this.collectedInChamber} / ${total}`;
      }
      if (this.hudScore) this.hudScore.textContent = this.score.toLocaleString();

      if (this.hudRewindBar && this.hudRewindVal) {
        const pct = Math.max(0, Math.min(100, (this.rewindEnergy / this.maxRewindEnergy) * 100));
        this.hudRewindBar.style.width = `${pct}%`;
        this.hudRewindVal.textContent = `${this.rewindEnergy.toFixed(1)}s`;
      }
    }

    formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 10);
      return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}.${ms}`;
    }

    // ------------------------------------------------------------------------
    // RENDER ENGINE
    // ------------------------------------------------------------------------
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Background: Sci-fi temporal laboratory grid
      this.drawBackground(ctx);

      if (!this.levelData) return;

      // Draw Platforms & Architecture
      this.drawPlatforms(ctx);

      // Draw Pressure Plates
      this.drawPlates(ctx);

      // Draw Blast Doors
      this.drawDoors(ctx);

      // Draw Moving Platforms
      this.drawMovingPlatforms(ctx);

      // Draw Laser Hazards
      this.drawHazards(ctx);

      // Draw Chrono Shards
      this.drawFragments(ctx);

      // Draw Exit Portal
      this.drawPortal(ctx);

      // Draw Ghost Replay
      if (this.ghost.active) {
        this.drawGhost(ctx);
      }

      // Draw Real Player
      this.drawPlayer(ctx);

      // Draw Particles
      this.particles.draw(ctx);
    }

    drawBackground(ctx) {
      // Cosmic navy gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, '#060a1d');
      grad.addColorStop(1, '#02040b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Temporal perspective grid lines
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.lineWidth = 1;

      const gridSize = 40;
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Background reactor columns
      ctx.fillStyle = 'rgba(176, 38, 255, 0.025)';
      ctx.fillRect(140, 40, 48, CANVAS_HEIGHT - 80);
      ctx.fillRect(460, 40, 56, CANVAS_HEIGHT - 80);
      ctx.fillRect(780, 40, 48, CANVAS_HEIGHT - 80);

      ctx.restore();
    }

    drawPlatforms(ctx) {
      ctx.save();
      this.levelData.platforms.forEach(p => {
        // Platform body
        ctx.fillStyle = '#0a102b';
        ctx.fillRect(p.x, p.y, p.w, p.h);

        // Platform top neon edge
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.shadowBlur = 0;

        // Platform border
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      });
      ctx.restore();
    }

    drawPlates(ctx) {
      ctx.save();
      this.levelData.plates.forEach(pl => {
        const depress = pl.currentOffsetY || 0;
        const color = pl.pressed ? '#00f0ff' : '#8b5cf6';

        // Plate base
        ctx.fillStyle = '#11183c';
        ctx.fillRect(pl.x, pl.y + 6, pl.w, pl.h - 6);

        // Depressed pressure bar
        ctx.fillStyle = color;
        ctx.shadowColor = pl.pressed ? 'rgba(0, 240, 255, 0.8)' : 'rgba(139, 92, 246, 0.4)';
        ctx.shadowBlur = pl.pressed ? 12 : 6;
        ctx.fillRect(pl.x + 2, pl.y + depress, pl.w - 4, 6);
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    }

    drawDoors(ctx) {
      ctx.save();
      this.levelData.doors.forEach(d => {
        const effectiveH = Math.max(0, d.h - d.currentOffset);
        if (effectiveH > 0) {
          // Closed door barrier
          ctx.fillStyle = '#151e48';
          ctx.fillRect(d.x, d.y, d.w, effectiveH);

          // Energy warning stripes
          ctx.strokeStyle = '#f59e0b';
          ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, effectiveH - 2);
          ctx.shadowBlur = 0;

          // Diagonal chevron accents
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.lineWidth = 1.5;
          for (let cy = d.y + 8; cy < d.y + effectiveH - 8; cy += 14) {
            ctx.beginPath();
            ctx.moveTo(d.x + 3, cy);
            ctx.lineTo(d.x + d.w / 2, cy + 4);
            ctx.lineTo(d.x + d.w - 3, cy);
            ctx.stroke();
          }
        }
      });
      ctx.restore();
    }

    drawMovingPlatforms(ctx) {
      if (!this.levelData.movingPlatforms) return;
      ctx.save();
      this.levelData.movingPlatforms.forEach(mp => {
        // Guideway line
        ctx.strokeStyle = 'rgba(176, 38, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(mp.x1 + mp.w / 2, mp.y1 + mp.h / 2);
        ctx.lineTo(mp.x2 + mp.w / 2, mp.y2 + mp.h / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Platform block
        ctx.fillStyle = '#181f4a';
        ctx.fillRect(mp.x, mp.y, mp.w, mp.h);

        // Violet neon hover rim
        ctx.fillStyle = '#b026ff';
        ctx.shadowColor = 'rgba(176, 38, 255, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillRect(mp.x, mp.y, mp.w, 3);
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    }

    drawHazards(ctx) {
      if (!this.levelData.hazards) return;
      ctx.save();
      this.levelData.hazards.forEach(h => {
        let isActive = true;
        if (h.cycle) {
          isActive = h.timer < h.activeTime;
        }

        if (isActive) {
          // Animated laser beam
          const glow = ctx.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
          glow.addColorStop(0, '#ff3366');
          glow.addColorStop(0.5, '#ffffff');
          glow.addColorStop(1, '#ff3366');

          ctx.fillStyle = glow;
          ctx.shadowColor = 'rgba(255, 51, 102, 0.9)';
          ctx.shadowBlur = 14;
          ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.shadowBlur = 0;
        } else {
          // Inactive warning indicator
          ctx.strokeStyle = 'rgba(255, 51, 102, 0.2)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.strokeRect(h.x, h.y, h.w, h.h);
          ctx.setLineDash([]);
        }
      });
      ctx.restore();
    }

    drawFragments(ctx) {
      if (!this.levelData.fragments) return;
      ctx.save();
      this.levelData.fragments.forEach(frag => {
        if (!frag.collected) {
          const hoverY = frag.y + Math.sin(frag.anim) * 5;

          // Glowing diamond chrono shard
          ctx.save();
          ctx.translate(frag.x, hoverY);
          ctx.rotate(frag.anim * 0.5);

          ctx.fillStyle = '#00f0ff';
          ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
          ctx.shadowBlur = 14;

          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(8, 0);
          ctx.lineTo(0, 10);
          ctx.lineTo(-8, 0);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      });
      ctx.restore();
    }

    drawPortal(ctx) {
      const p = this.levelData.portal;
      const t = performance.now() * 0.003;
      ctx.save();

      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;

      // Swirling temporal rift portal
      for (let r = 24; r >= 6; r -= 6) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 1.35, t * (r % 2 === 0 ? 1 : -1), 0, Math.PI * 2);
        ctx.strokeStyle = r > 12 ? 'rgba(0, 240, 255, 0.8)' : 'rgba(245, 158, 11, 0.9)';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
        ctx.shadowBlur = 15;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Center singularity
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawPlayer(ctx) {
      const p = this.player;
      ctx.save();
      ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

      // Running tilt / squash
      const tilt = p.vx * 0.0006;
      ctx.rotate(tilt);
      ctx.scale(p.facing, 1);

      // Body (Sci-fi jumper suit)
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
      ctx.shadowBlur = 10;

      // Torso & legs
      ctx.beginPath();
      ctx.roundRect(-10, -16, 20, 32, 6);
      ctx.fill();

      // Glowing visor
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillRect(1, -12, 8, 5);

      // Jetpack thruster core
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(-9, -8, 4, 14);

      ctx.restore();
    }

    drawGhost(ctx) {
      const g = this.ghost;
      ctx.save();
      ctx.translate(g.x + g.width / 2, g.y + g.height / 2);
      ctx.scale(g.facing, 1);

      // Translucent violet holographic ghost
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#b026ff';
      ctx.shadowColor = 'rgba(176, 38, 255, 0.9)';
      ctx.shadowBlur = 16;

      ctx.beginPath();
      ctx.roundRect(-10, -16, 20, 32, 6);
      ctx.fill();

      // Holographic scanlines across ghost
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(1, -12, 8, 5);

      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // Main Game Loop
    // ------------------------------------------------------------------------
    loop(timestamp) {
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      let frameDelta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      // Cap delta time to prevent spiral of death on tab switch
      if (frameDelta > 0.1) frameDelta = 0.1;

      this.accumulator += frameDelta;
      while (this.accumulator >= FIXED_DELTA) {
        this.update(FIXED_DELTA);
        this.accumulator -= FIXED_DELTA;
      }

      this.render();
      requestAnimationFrame(this.loop.bind(this));
    }
  }

  // ==========================================================================
  // 8. LAUNCH ENTRYPOINT
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    window.timeWarpInstance = new TimeWarpGame();
  });

})();
