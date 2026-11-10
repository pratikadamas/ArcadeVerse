/**
 * ============================================================================
 * Bubble Pop: Bubble Burst Arena — Core Game Engine
 * High-Performance Vanilla JS • Hexagonal Physics • Web Audio API
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const CONFIG = {
    CANVAS_WIDTH: 440,
    CANVAS_HEIGHT: 660,
    BUBBLE_RADIUS: 22,
    BUBBLE_DIAMETER: 44,
    GRID_COLS_EVEN: 10,
    GRID_COLS_ODD: 9,
    GRID_MAX_ROWS: 14,
    ROW_HEIGHT: 38.105, // 44 * sqrt(3)/2
    LAUNCHER_X: 220,
    LAUNCHER_Y: 605,
    DANGER_Y: 510,
    PROJECTILE_SPEED: 1100, // Logical pixels per second
    STORAGE_KEY_BEST: 'bubbleBurstArena_bestScore',
    STORAGE_KEY_POPS: 'bubbleBurstArena_totalPopped',
    STORAGE_KEY_SOUND: 'bubbleBurstArena_sound',

    // Bubble Color Palette
    COLORS: [
      { id: 'cyan', hex: '#00f0ff', glow: '#00e5ff', dark: '#0284c7' },
      { id: 'pink', hex: '#ff2a85', glow: '#f43f5e', dark: '#9f1239' },
      { id: 'violet', hex: '#a855f7', glow: '#c084fc', dark: '#6b21a8' },
      { id: 'gold', hex: '#f59e0b', glow: '#fbbf24', dark: '#b45309' },
      { id: 'green', hex: '#10b981', glow: '#34d399', dark: '#047857' },
      { id: 'blue', hex: '#3b82f6', glow: '#60a5fa', dark: '#1d4ed8' }
    ],

    // Sector Progression Definitions
    LEVELS: [
      {
        sector: 1,
        name: 'Sector 01: Neon Cradle',
        colorsCount: 4,
        shots: 32,
        targetPops: 24,
        allowBomb: false,
        allowRainbow: false,
        descentInterval: 0,
        initialRows: 4
      },
      {
        sector: 2,
        name: 'Sector 02: Pulse Matrix',
        colorsCount: 5,
        shots: 28,
        targetPops: 36,
        allowBomb: true,
        allowRainbow: false,
        descentInterval: 0,
        initialRows: 5
      },
      {
        sector: 3,
        name: 'Sector 03: Prism Nexus',
        colorsCount: 5,
        shots: 26,
        targetPops: 45,
        allowBomb: true,
        allowRainbow: true,
        descentInterval: 7,
        initialRows: 6
      },
      {
        sector: 4,
        name: 'Sector 04: Quantum Cascade',
        colorsCount: 6,
        shots: 24,
        targetPops: 55,
        allowBomb: true,
        allowRainbow: true,
        descentInterval: 5,
        initialRows: 6
      },
      {
        sector: 5,
        name: 'Sector 05: Supernova Core',
        colorsCount: 6,
        shots: 22,
        targetPops: 65,
        allowBomb: true,
        allowRainbow: true,
        descentInterval: 4,
        initialRows: 7
      }
    ]
  };

  // --- Game State Enum ---
  const GameState = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    LEVEL_CLEAR: 'LEVEL_CLEAR',
    GAME_OVER: 'GAME_OVER'
  };

  // --- Sound Synthesizer (Native Web Audio API) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY_SOUND);
        if (saved !== null) {
          this.enabled = saved === '1';
        }
      } catch (e) {
        this.enabled = true;
      }
    }

    init() {
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
        localStorage.setItem(CONFIG.STORAGE_KEY_SOUND, this.enabled ? '1' : '0');
      } catch (e) {}
      return this.enabled;
    }

    playShoot() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playBounce() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }

    playAttach() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playPop(combo = 1) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const baseFreq = 400 + Math.min(combo * 90, 600);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.15);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playBomb() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Low punch oscillator
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    playRainbow() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.18, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.18);
      });
    }

    playAvalanche() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [440, 370, 311, 260].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.16, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.14);
      });
    }

    playLevelClear() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const chord = [392, 523.25, 659.25, 783.99]; // G, C, E, G
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);
      });
    }

    playGameOver() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [311.13, 293.66, 277.18, 261.63];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.2, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.3);
      });
    }
  }

  // --- Main Game Engine ---
  class BubbleBurstArena {
    constructor() {
      // DOM Elements
      this.canvas = document.getElementById('bba-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.container = document.getElementById('bba-container');

      // HUD Elements
      this.hudScore = document.getElementById('bba-hud-score');
      this.hudLevel = document.getElementById('bba-hud-level');
      this.hudShots = document.getElementById('bba-hud-shots');
      this.hudBest = document.getElementById('bba-hud-best');
      this.hudObjective = document.getElementById('bba-hud-objective');
      this.hudObjLabel = document.getElementById('bba-hud-obj-label');
      this.nextCircle = document.getElementById('bba-next-circle');
      this.comboIndicator = document.getElementById('bba-combo-indicator');
      this.comboText = document.getElementById('bba-combo-text');
      this.dangerBanner = document.getElementById('bba-danger-banner');
      this.soundBtn = document.getElementById('bba-btn-sound');
      this.pauseBtn = document.getElementById('bba-btn-pause');
      this.announcer = document.getElementById('bba-live-announcer');

      // Overlays
      this.startScreen = document.getElementById('bba-start-screen');
      this.howModal = document.getElementById('bba-how-modal');
      this.pauseScreen = document.getElementById('bba-pause-screen');
      this.levelClearScreen = document.getElementById('bba-level-clear-screen');
      this.gameOverScreen = document.getElementById('bba-game-over-screen');

      // Overlay Stat Displays
      this.menuBest = document.getElementById('bba-menu-best');
      this.menuPopped = document.getElementById('bba-menu-popped');
      this.pauseScore = document.getElementById('bba-pause-score');
      this.pauseShots = document.getElementById('bba-pause-shots');
      this.clearBase = document.getElementById('bba-clear-base');
      this.clearShotsBonus = document.getElementById('bba-clear-shots-bonus');
      this.clearMaxCombo = document.getElementById('bba-clear-max-combo');
      this.clearTotalScore = document.getElementById('bba-clear-total-score');
      this.overFinalScore = document.getElementById('bba-over-final-score');
      this.overSector = document.getElementById('bba-over-sector');
      this.overHighScore = document.getElementById('bba-over-high-score');
      this.overReason = document.getElementById('bba-over-reason');

      // Sound Engine
      this.sound = new SoundFX();
      this.updateSoundIcon();

      // State Variables
      this.state = GameState.MENU;
      this.score = 0;
      this.bestScore = this.loadBestScore();
      this.totalPopped = this.loadTotalPopped();
      this.currentLevelIndex = 0;
      this.currentLevel = CONFIG.LEVELS[0];
      this.remainingShots = this.currentLevel.shots;
      this.levelPops = 0;
      this.comboStreak = 1;
      this.maxComboStreak = 1;
      this.shotsWithoutMatch = 0;

      // Aiming & Launcher
      this.aimAngle = -Math.PI / 2; // Straight up by default
      this.keyAimDirection = 0; // -1 for left, 1 for right
      this.isAiming = false;
      this.currentBubble = null;
      this.nextBubble = null;
      this.projectile = null;

      // Hexagonal Grid
      this.grid = []; // 2D array of rows
      this.gridOffsetRows = 0; // Descending ceiling count

      // Particles & Floating Scores
      this.particles = [];
      this.floatingTexts = [];
      this.fallingBubbles = [];
      this.screenShake = 0;

      // Timing & Animation
      this.lastTime = 0;
      this.animId = null;

      // Initialize Level 1 grid, shots, and loaded projectile immediately
      this.setupCanvasDPI();
      this.bindEvents();
      this.startLevel(0); // Populates grid, currentBubble, nextBubble, and HUD before frame 1!
      this.state = GameState.MENU; // Keep in MENU state until player enters arena
      this.renderMenuStats();

      // Start the Master Render Loop
      this.loop = this.loop.bind(this);
      this.animId = requestAnimationFrame(this.loop);
    }

    // --- High DPI Canvas Configuration ---
    setupCanvasDPI() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = CONFIG.CANVAS_WIDTH * dpr;
      this.canvas.height = CONFIG.CANVAS_HEIGHT * dpr;
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }

    // --- LocalStorage Safekeeping ---
    loadBestScore() {
      try {
        const val = localStorage.getItem(CONFIG.STORAGE_KEY_BEST);
        return val ? parseInt(val, 10) || 0 : 0;
      } catch (e) {
        return 0;
      }
    }

    saveBestScore(val) {
      if (val > this.bestScore) {
        this.bestScore = val;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEY_BEST, this.bestScore.toString());
        } catch (e) {}
      }
    }

    loadTotalPopped() {
      try {
        const val = localStorage.getItem(CONFIG.STORAGE_KEY_POPS);
        return val ? parseInt(val, 10) || 0 : 0;
      } catch (e) {
        return 0;
      }
    }

    saveTotalPopped(count) {
      this.totalPopped += count;
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY_POPS, this.totalPopped.toString());
      } catch (e) {}
    }

    announce(message) {
      if (this.announcer) {
        this.announcer.textContent = message;
      }
    }

    // --- Sound Icon UI Sync ---
    updateSoundIcon() {
      const iconOn = this.soundBtn.querySelector('.bba-icon-sound-on');
      const iconOff = this.soundBtn.querySelector('.bba-icon-sound-off');
      if (this.sound.enabled) {
        iconOn.classList.remove('bba-hidden');
        iconOff.classList.add('bba-hidden');
        this.soundBtn.setAttribute('title', 'Mute Sound (M)');
      } else {
        iconOn.classList.add('bba-hidden');
        iconOff.classList.remove('bba-hidden');
        this.soundBtn.setAttribute('title', 'Unmute Sound (M)');
      }
    }

    // --- Event Listeners Setup ---
    bindEvents() {
      // Resize Handler for Crisp Rendering
      window.addEventListener('resize', () => {
        this.setupCanvasDPI();
      });

      // Pointer / Mouse Aiming
      const updateAimFromPointer = (clientX, clientY) => {
        if (this.state !== GameState.PLAYING) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CONFIG.CANVAS_WIDTH / rect.width;
        const scaleY = CONFIG.CANVAS_HEIGHT / rect.height;
        const pointerX = (clientX - rect.left) * scaleX;
        const pointerY = (clientY - rect.top) * scaleY;

        const dx = pointerX - CONFIG.LAUNCHER_X;
        const dy = pointerY - CONFIG.LAUNCHER_Y;

        let angle = Math.atan2(dy, dx);
        // Clamp aiming angle so player shoots upwards only (between -165deg and -15deg)
        const minAngle = -Math.PI + 0.26;
        const maxAngle = -0.26;
        if (angle > 0) {
          angle = dx < 0 ? minAngle : maxAngle;
        } else {
          angle = Math.max(minAngle, Math.min(maxAngle, angle));
        }
        this.aimAngle = angle;
      };

      this.canvas.addEventListener('pointermove', (e) => {
        updateAimFromPointer(e.clientX, e.clientY);
      });

      this.canvas.addEventListener('pointerdown', (e) => {
        if (this.state !== GameState.PLAYING) return;
        this.sound.init();
        updateAimFromPointer(e.clientX, e.clientY);
        this.fireProjectile();
      });

      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        // Prevent key events while typing in an input
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
          return;
        }

        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            this.keyAimDirection = -1;
            break;
          case 'ArrowRight':
          case 'KeyD':
            this.keyAimDirection = 1;
            break;
          case 'Space':
          case 'Enter':
          case 'ArrowUp':
          case 'KeyW':
            e.preventDefault();
            if (this.state === GameState.PLAYING) {
              this.fireProjectile();
            }
            break;
          case 'KeyP':
          case 'Escape':
            e.preventDefault();
            this.togglePause();
            break;
          case 'KeyR':
            if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
              e.preventDefault();
              this.restartLevel();
            }
            break;
          case 'KeyM':
            e.preventDefault();
            this.sound.toggle();
            this.updateSoundIcon();
            break;
        }
      });

      window.addEventListener('keyup', (e) => {
        if (
          (e.code === 'ArrowLeft' || e.code === 'KeyA') && this.keyAimDirection === -1 ||
          (e.code === 'ArrowRight' || e.code === 'KeyD') && this.keyAimDirection === 1
        ) {
          this.keyAimDirection = 0;
        }
      });

      // UI Buttons
      this.soundBtn.addEventListener('click', () => {
        this.sound.toggle();
        this.updateSoundIcon();
      });

      this.pauseBtn.addEventListener('click', () => {
        this.togglePause();
      });

      document.getElementById('bba-btn-help-mini').addEventListener('click', () => {
        this.openHowToPlay();
      });

      document.getElementById('bba-btn-play').addEventListener('click', () => {
        this.sound.init();
        this.startGameSession();
      });

      document.getElementById('bba-btn-how').addEventListener('click', () => {
        this.openHowToPlay();
      });

      document.getElementById('bba-btn-close-how').addEventListener('click', () => {
        this.closeHowToPlay();
      });

      document.getElementById('bba-btn-how-start').addEventListener('click', () => {
        this.closeHowToPlay();
        if (this.state === GameState.MENU) {
          this.startGameSession();
        }
      });

      document.getElementById('bba-btn-resume').addEventListener('click', () => {
        this.resumeGame();
      });

      document.getElementById('bba-btn-pause-restart').addEventListener('click', () => {
        this.restartLevel();
      });

      document.getElementById('bba-btn-pause-menu').addEventListener('click', () => {
        this.returnToMenu();
      });

      document.getElementById('bba-btn-next-level').addEventListener('click', () => {
        this.advanceToNextLevel();
      });

      document.getElementById('bba-btn-clear-menu').addEventListener('click', () => {
        this.returnToMenu();
      });

      document.getElementById('bba-btn-retry').addEventListener('click', () => {
        this.restartLevel();
      });

      document.getElementById('bba-btn-over-menu').addEventListener('click', () => {
        this.returnToMenu();
      });
    }

    // --- State Transitions ---
    startGameSession() {
      this.score = 0;
      this.currentLevelIndex = 0;
      this.startLevel(this.currentLevelIndex);
      this.hideAllOverlays();
      this.state = GameState.PLAYING;
      this.announce('Sector 1 started. Good luck!');
    }

    startLevel(levelIdx) {
      this.currentLevelIndex = levelIdx;
      this.currentLevel = CONFIG.LEVELS[this.currentLevelIndex % CONFIG.LEVELS.length];
      this.remainingShots = this.currentLevel.shots;
      this.levelPops = 0;
      this.comboStreak = 1;
      this.maxComboStreak = 1;
      this.shotsWithoutMatch = 0;
      this.projectile = null;
      this.gridOffsetRows = 0;
      this.particles = [];
      this.floatingTexts = [];
      this.fallingBubbles = [];
      this.dangerBanner.classList.add('bba-hidden');

      this.generateInitialGrid();
      this.nextBubble = this.generateRandomBubble();
      this.prepareNextShot();
      this.updateHUD();
    }

    restartLevel() {
      this.hideAllOverlays();
      this.startLevel(this.currentLevelIndex);
      this.state = GameState.PLAYING;
      this.announce('Sector restarted.');
    }

    returnToMenu() {
      this.state = GameState.MENU;
      this.projectile = null;
      this.hideAllOverlays();
      this.renderMenuStats();
      this.startScreen.classList.remove('bba-hidden');
    }

    togglePause() {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
        this.pauseScore.textContent = this.score.toLocaleString();
        this.pauseShots.textContent = this.remainingShots.toString();
        this.pauseScreen.classList.remove('bba-hidden');
        this.pauseBtn.querySelector('.bba-icon-pause').classList.add('bba-hidden');
        this.pauseBtn.querySelector('.bba-icon-play').classList.remove('bba-hidden');
      } else if (this.state === GameState.PAUSED) {
        this.resumeGame();
      }
    }

    resumeGame() {
      if (this.state === GameState.PAUSED) {
        this.state = GameState.PLAYING;
        this.pauseScreen.classList.add('bba-hidden');
        this.pauseBtn.querySelector('.bba-icon-pause').classList.remove('bba-hidden');
        this.pauseBtn.querySelector('.bba-icon-play').classList.add('bba-hidden');
      }
    }

    openHowToPlay() {
      this.howModal.classList.remove('bba-hidden');
    }

    closeHowToPlay() {
      this.howModal.classList.add('bba-hidden');
    }

    hideAllOverlays() {
      this.startScreen.classList.add('bba-hidden');
      this.howModal.classList.add('bba-hidden');
      this.pauseScreen.classList.add('bba-hidden');
      this.levelClearScreen.classList.add('bba-hidden');
      this.gameOverScreen.classList.add('bba-hidden');
      this.pauseBtn.querySelector('.bba-icon-pause').classList.remove('bba-hidden');
      this.pauseBtn.querySelector('.bba-icon-play').classList.add('bba-hidden');
    }

    renderMenuStats() {
      this.menuBest.textContent = this.bestScore.toLocaleString();
      this.menuPopped.textContent = this.totalPopped.toLocaleString();
      this.hudBest.textContent = this.bestScore.toLocaleString();
    }

    // --- Hexagonal Grid Generation & Helpers ---
    generateInitialGrid() {
      this.grid = [];
      const numRows = this.currentLevel.initialRows;
      const availableColors = CONFIG.COLORS.slice(0, this.currentLevel.colorsCount);

      for (let r = 0; r < CONFIG.GRID_MAX_ROWS; r++) {
        const isEven = r % 2 === 0;
        const cols = isEven ? CONFIG.GRID_COLS_EVEN : CONFIG.GRID_COLS_ODD;
        const row = [];

        for (let c = 0; c < cols; c++) {
          if (r < numRows) {
            // Assign sensible colors, avoiding impossible clusters
            const color = availableColors[Math.floor(Math.random() * availableColors.length)];
            let type = 'normal';

            // Occasionally place special bubbles in Sector 2+
            if (this.currentLevel.allowBomb && Math.random() < 0.05 && r > 1) {
              type = 'bomb';
            } else if (this.currentLevel.allowRainbow && Math.random() < 0.04 && r > 1) {
              type = 'rainbow';
            }

            row.push({
              color: color.id,
              type: type,
              r: r,
              c: c
            });
          } else {
            row.push(null);
          }
        }
        this.grid.push(row);
      }
    }

    getCellCenter(r, c) {
      const isEven = r % 2 === 0;
      const x = isEven
        ? CONFIG.BUBBLE_RADIUS + c * CONFIG.BUBBLE_DIAMETER
        : CONFIG.BUBBLE_DIAMETER + c * CONFIG.BUBBLE_DIAMETER;
      const y = CONFIG.BUBBLE_RADIUS + r * CONFIG.ROW_HEIGHT;
      return { x, y };
    }

    getNeighbors(r, c) {
      const neighbors = [];
      const isEven = r % 2 === 0;

      // Left & Right
      const offsets = [
        { r: 0, c: -1 },
        { r: 0, c: 1 }
      ];

      // Vertical Staggered Offsets
      if (isEven) {
        offsets.push(
          { r: -1, c: -1 },
          { r: -1, c: 0 },
          { r: 1, c: -1 },
          { r: 1, c: 0 }
        );
      } else {
        offsets.push(
          { r: -1, c: 0 },
          { r: -1, c: 1 },
          { r: 1, c: 0 },
          { r: 1, c: 1 }
        );
      }

      offsets.forEach((off) => {
        const nr = r + off.r;
        const nc = c + off.c;
        if (nr >= 0 && nr < CONFIG.GRID_MAX_ROWS) {
          const maxCols = nr % 2 === 0 ? CONFIG.GRID_COLS_EVEN : CONFIG.GRID_COLS_ODD;
          if (nc >= 0 && nc < maxCols) {
            neighbors.push({ r: nr, c: nc });
          }
        }
      });

      return neighbors;
    }

    // --- Color Distribution & Projectile Preparation ---
    getActiveColorsOnBoard() {
      const active = new Set();
      if (!this.grid || !Array.isArray(this.grid)) return [];
      for (let r = 0; r < this.grid.length; r++) {
        const row = this.grid[r];
        if (!row || !Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const bubble = row[c];
          if (bubble && bubble.type === 'normal') {
            active.add(bubble.color);
          }
        }
      }
      return Array.from(active);
    }

    generateRandomBubble() {
      // Check board colors to avoid useless projectiles
      const activeColors = this.getActiveColorsOnBoard();
      const colorChoices = activeColors.length > 0
        ? activeColors
        : CONFIG.COLORS.slice(0, this.currentLevel.colorsCount).map(c => c.id);

      // Check for special bubble roll
      let type = 'normal';
      if (this.currentLevel.allowBomb && Math.random() < 0.12) {
        type = 'bomb';
      } else if (this.currentLevel.allowRainbow && Math.random() < 0.10) {
        type = 'rainbow';
      }

      const selectedColor = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      return {
        type: type,
        color: selectedColor
      };
    }

    prepareNextShot() {
      this.currentBubble = this.nextBubble || this.generateRandomBubble();
      this.nextBubble = this.generateRandomBubble();

      // Update Bottom Bar Preview UI
      this.updateNextBubblePreview();
    }

    updateNextBubblePreview() {
      if (!this.nextBubble) return;
      if (this.nextBubble.type === 'bomb') {
        this.nextCircle.style.background = 'radial-gradient(circle at 35% 35%, #f59e0b, #b45309, #18181b)';
        this.nextCircle.setAttribute('title', 'Next: Explosive Bomb');
      } else if (this.nextBubble.type === 'rainbow') {
        this.nextCircle.style.background = 'linear-gradient(135deg, #ff2a85, #f59e0b, #10b981, #00f0ff, #a855f7)';
        this.nextCircle.setAttribute('title', 'Next: Prism Rainbow');
      } else {
        const colDef = CONFIG.COLORS.find(c => c.id === this.nextBubble.color) || CONFIG.COLORS[0];
        this.nextCircle.style.background = `radial-gradient(circle at 35% 35%, #ffffff 0%, ${colDef.hex} 40%, ${colDef.dark} 100%)`;
        this.nextCircle.setAttribute('title', `Next: ${colDef.id.toUpperCase()}`);
      }
    }

    // --- Shooting Projectile ---
    fireProjectile() {
      if (this.projectile !== null || this.state !== GameState.PLAYING) return;
      if (this.remainingShots <= 0) return;

      const vx = CONFIG.PROJECTILE_SPEED * Math.cos(this.aimAngle);
      const vy = CONFIG.PROJECTILE_SPEED * Math.sin(this.aimAngle);

      this.projectile = {
        x: CONFIG.LAUNCHER_X,
        y: CONFIG.LAUNCHER_Y,
        vx: vx,
        vy: vy,
        color: this.currentBubble.color,
        type: this.currentBubble.type
      };

      this.remainingShots--;
      this.sound.playShoot();
      this.updateHUD();
    }

    // --- Physics & Collision Resolution ---
    updateProjectile(dt) {
      if (!this.projectile) return;

      // Sub-stepping for ultra-stable high-speed collision
      const steps = 4;
      const subDt = dt / steps;

      for (let s = 0; s < steps; s++) {
        this.projectile.x += this.projectile.vx * subDt;
        this.projectile.y += this.projectile.vy * subDt;

        // Side Wall Bouncing
        const r = CONFIG.BUBBLE_RADIUS;
        if (this.projectile.x - r <= 0) {
          this.projectile.x = r;
          this.projectile.vx = -this.projectile.vx;
          this.sound.playBounce();
          this.createBounceParticles(this.projectile.x, this.projectile.y);
        } else if (this.projectile.x + r >= CONFIG.CANVAS_WIDTH) {
          this.projectile.x = CONFIG.CANVAS_WIDTH - r;
          this.projectile.vx = -this.projectile.vx;
          this.sound.playBounce();
          this.createBounceParticles(this.projectile.x, this.projectile.y);
        }

        // Ceiling Collision
        if (this.projectile.y - r <= 0) {
          this.attachProjectileToGrid();
          return;
        }

        // Attached Bubble Collision
        if (this.grid && Array.isArray(this.grid)) {
          for (let row = 0; row < this.grid.length; row++) {
            const rowData = this.grid[row];
            if (!rowData || !Array.isArray(rowData)) continue;
            for (let col = 0; col < rowData.length; col++) {
              const bubble = rowData[col];
              if (bubble) {
                const center = this.getCellCenter(row, col);
                const distSq = (this.projectile.x - center.x) ** 2 + (this.projectile.y - center.y) ** 2;
                // Collision threshold: 2 * radius - slight overlap tolerance
                if (distSq <= (CONFIG.BUBBLE_DIAMETER - 2) ** 2) {
                  this.attachProjectileToGrid();
                  return;
                }
              }
            }
          }
        }
      }
    }

    // --- Grid Snapping Algorithm ---
    attachProjectileToGrid() {
      if (!this.projectile) return;

      let bestCell = null;
      let minDistanceSq = Infinity;

      // Candidate search: must be an empty cell adjacent to an existing bubble or in row 0
      for (let r = 0; r < this.grid.length; r++) {
        const rowData = this.grid[r];
        if (!rowData || !Array.isArray(rowData)) continue;
        for (let c = 0; c < rowData.length; c++) {
          if (rowData[c] === null) {
            // Check if cell has neighbor or is ceiling
            const neighbors = this.getNeighbors(r, c);
            const hasNeighbor = neighbors.some(n => this.grid[n.r] && this.grid[n.r][n.c] !== null);
            if (r === 0 || hasNeighbor) {
              const center = this.getCellCenter(r, c);
              const distSq = (this.projectile.x - center.x) ** 2 + (this.projectile.y - center.y) ** 2;
              if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestCell = { r, c };
              }
            }
          }
        }
      }

      if (bestCell) {
        const newBubble = {
          color: this.projectile.color,
          type: this.projectile.type,
          r: bestCell.r,
          c: bestCell.c
        };
        this.grid[bestCell.r][bestCell.c] = newBubble;
        this.sound.playAttach();

        const center = this.getCellCenter(bestCell.r, bestCell.c);
        this.createAttachPuff(center.x, center.y);

        const firedBubbleType = this.projectile.type;
        this.projectile = null;

        // Process Matches, Bombs, and Falling Clusters
        this.handleMatchesAndChains(bestCell, firedBubbleType);
      } else {
        // Fallback safety if no valid cell found
        this.projectile = null;
        this.prepareNextShot();
      }
    }

    // --- Match & Cascade Processing ---
    handleMatchesAndChains(placedCell, bubbleType) {
      let matchedAny = false;

      // 1. Explosive Bomb Logic
      if (bubbleType === 'bomb') {
        matchedAny = true;
        this.detonateBomb(placedCell.r, placedCell.c);
      }
      // 2. Prism Rainbow Logic
      else if (bubbleType === 'rainbow') {
        const neighbors = this.getNeighbors(placedCell.r, placedCell.c);
        const adjacentColors = new Set();
        neighbors.forEach(n => {
          const b = this.grid[n.r][n.c];
          if (b && b.type === 'normal') adjacentColors.add(b.color);
        });

        const totalMatchedCells = new Set();
        adjacentColors.forEach(col => {
          const group = this.findMatchingCluster(placedCell.r, placedCell.c, col);
          if (group.length >= 3) {
            group.forEach(pt => totalMatchedCells.add(`${pt.r},${pt.c}`));
          }
        });

        if (totalMatchedCells.size >= 3) {
          matchedAny = true;
          const cellsToPop = Array.from(totalMatchedCells).map(key => {
            const [r, c] = key.split(',').map(Number);
            return { r, c };
          });
          this.popBubbleGroup(cellsToPop, 'rainbow');
        }
      }
      // 3. Standard Color Match Logic
      else {
        const targetColor = this.grid[placedCell.r][placedCell.c].color;
        const matchingGroup = this.findMatchingCluster(placedCell.r, placedCell.c, targetColor);

        if (matchingGroup.length >= 3) {
          matchedAny = true;
          this.popBubbleGroup(matchingGroup, 'normal');
        }
      }

      // Combo & Streak Handling
      if (matchedAny) {
        this.comboStreak++;
        if (this.comboStreak > this.maxComboStreak) {
          this.maxComboStreak = this.comboStreak;
        }
        this.shotsWithoutMatch = 0;
        this.showComboBanner(this.comboStreak);
      } else {
        this.comboStreak = 1;
        this.shotsWithoutMatch++;
        this.hideComboBanner();

        // Check for periodic descending ceiling
        if (this.currentLevel.descentInterval > 0 && this.shotsWithoutMatch >= this.currentLevel.descentInterval) {
          this.descendCeiling();
          this.shotsWithoutMatch = 0;
        }
      }

      // 4. Detach Floating Disconnected Clusters (Avalanche)
      const fallingCount = this.dropFloatingClusters();

      // Update Scoring and Check Objectives
      this.updateHUD();

      // Check Lose Conditions (Danger Line or Shots Depleted)
      if (this.checkLoseConditions()) {
        return;
      }

      // Check Win Condition (Objective Met or Board Cleared)
      if (this.checkWinConditions()) {
        return;
      }

      // Load Next Shot
      this.prepareNextShot();
    }

    // --- Flood Fill Matching ---
    findMatchingCluster(startR, startC, targetColor) {
      const visited = new Set();
      const cluster = [];
      const queue = [{ r: startR, c: startC }];
      visited.add(`${startR},${startC}`);

      while (queue.length > 0) {
        const curr = queue.shift();
        const bubble = this.grid[curr.r][curr.c];
        if (!bubble) continue;

        // Match condition: same color OR wildcard rainbow
        if (bubble.color === targetColor || bubble.type === 'rainbow') {
          cluster.push({ r: curr.r, c: curr.c });

          const neighbors = this.getNeighbors(curr.r, curr.c);
          neighbors.forEach(n => {
            const key = `${n.r},${n.c}`;
            if (!visited.has(key)) {
              const nb = this.grid[n.r][n.c];
              if (nb && (nb.color === targetColor || nb.type === 'rainbow')) {
                visited.add(key);
                queue.push(n);
              }
            }
          });
        }
      }

      return cluster;
    }

    // --- Bomb Detonation Explosion ---
    detonateBomb(bombR, bombC) {
      const bombCenter = this.getCellCenter(bombR, bombC);
      this.sound.playBomb();
      this.screenShake = 12;

      // Blast radius: approx 2.2 bubble diameters
      const blastRadiusSq = (CONFIG.BUBBLE_DIAMETER * 2.2) ** 2;
      const destroyed = [];

      if (this.grid && Array.isArray(this.grid)) {
        for (let r = 0; r < this.grid.length; r++) {
          const rowData = this.grid[r];
          if (!rowData || !Array.isArray(rowData)) continue;
          for (let c = 0; c < rowData.length; c++) {
            const bubble = rowData[c];
            if (bubble) {
              const center = this.getCellCenter(r, c);
              const distSq = (bombCenter.x - center.x) ** 2 + (bombCenter.y - center.y) ** 2;
              if (distSq <= blastRadiusSq) {
                destroyed.push({ r, c, bubble });
              }
            }
          }
        }
      }

      // Remove destroyed bubbles
      destroyed.forEach(item => {
        const center = this.getCellCenter(item.r, item.c);
        this.createPopParticles(center.x, center.y, item.bubble.color, true);
        this.grid[item.r][item.c] = null;
      });

      const pointsEarned = destroyed.length * 150 * this.comboStreak;
      this.score += pointsEarned;
      this.levelPops += destroyed.length;
      this.saveTotalPopped(destroyed.length);

      this.addFloatingText(bombCenter.x, bombCenter.y, `+${pointsEarned} BLAST!`, '#f59e0b');
    }

    // --- Popping Group Animation & Points ---
    popBubbleGroup(cells, reason = 'normal') {
      let sumX = 0;
      let sumY = 0;

      cells.forEach(pt => {
        const bubble = this.grid[pt.r][pt.c];
        if (bubble) {
          const center = this.getCellCenter(pt.r, pt.c);
          sumX += center.x;
          sumY += center.y;
          this.createPopParticles(center.x, center.y, bubble.color, false);
          this.grid[pt.r][pt.c] = null;
        }
      });

      const count = cells.length;
      const avgX = sumX / count;
      const avgY = sumY / count;

      if (reason === 'rainbow') {
        this.sound.playRainbow();
      } else {
        this.sound.playPop(this.comboStreak);
      }

      const basePoints = count * 100 * this.comboStreak;
      this.score += basePoints;
      this.levelPops += count;
      this.saveTotalPopped(count);

      const label = this.comboStreak > 1 ? `+${basePoints} x${this.comboStreak}!` : `+${basePoints}`;
      this.addFloatingText(avgX, avgY, label, '#00f0ff');
    }

    // --- Avalanche Detection & Drop ---
    dropFloatingClusters() {
      // Find all anchored bubbles via flood fill starting from Row 0
      const anchored = new Set();
      const queue = [];

      if (!this.grid || !this.grid[0] || !Array.isArray(this.grid[0])) return 0;

      // Add all populated bubbles in row 0
      for (let c = 0; c < this.grid[0].length; c++) {
        if (this.grid[0][c] !== null) {
          anchored.add(`0,${c}`);
          queue.push({ r: 0, c: c });
        }
      }

      // BFS to mark all connected bubbles
      while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = this.getNeighbors(curr.r, curr.c);

        neighbors.forEach(n => {
          const key = `${n.r},${n.c}`;
          if (!anchored.has(key) && this.grid[n.r] && this.grid[n.r][n.c] !== null) {
            anchored.add(key);
            queue.push(n);
          }
        });
      }

      // Any remaining bubble on board is unanchored (floating)
      const floating = [];
      for (let r = 0; r < this.grid.length; r++) {
        const rowData = this.grid[r];
        if (!rowData || !Array.isArray(rowData)) continue;
        for (let c = 0; c < rowData.length; c++) {
          if (rowData[c] !== null && !anchored.has(`${r},${c}`)) {
            floating.push({
              r,
              c,
              bubble: rowData[c]
            });
            this.grid[r][c] = null; // Detach from grid
          }
        }
      }

      if (floating.length > 0) {
        this.sound.playAvalanche();
        floating.forEach(item => {
          const center = this.getCellCenter(item.r, item.c);
          this.fallingBubbles.push({
            x: center.x,
            y: center.y,
            vx: (Math.random() - 0.5) * 120,
            vy: -40 - Math.random() * 80,
            gravity: 800,
            color: item.bubble.color,
            type: item.bubble.type,
            rotation: 0,
            vRot: (Math.random() - 0.5) * 10
          });
        });

        const bonus = floating.length * 250 * this.comboStreak;
        this.score += bonus;
        this.levelPops += floating.length;
        this.saveTotalPopped(floating.length);

        this.addFloatingText(CONFIG.CANVAS_WIDTH / 2, 220, `+${bonus} AVALANCHE!`, '#ff2a85');
      }

      return floating.length;
    }

    // --- Descending Ceiling Mechanism ---
    descendCeiling() {
      // Shift all grid rows downwards by 1 row
      this.gridOffsetRows++;
      const newGrid = [];

      // Create new top row populated with random bubbles
      const availableColors = CONFIG.COLORS.slice(0, this.currentLevel.colorsCount);
      const topRow = [];
      for (let c = 0; c < CONFIG.GRID_COLS_EVEN; c++) {
        topRow.push({
          color: availableColors[Math.floor(Math.random() * availableColors.length)].id,
          type: 'normal',
          r: 0,
          c: c
        });
      }
      newGrid.push(topRow);

      // Shift existing rows down
      for (let r = 0; r < CONFIG.GRID_MAX_ROWS - 1; r++) {
        const shiftedRow = [];
        const isNextEven = (r + 1) % 2 === 0;
        const targetCols = isNextEven ? CONFIG.GRID_COLS_EVEN : CONFIG.GRID_COLS_ODD;

        for (let c = 0; c < targetCols; c++) {
          const orig = this.grid[r][c] || null;
          if (orig) {
            orig.r = r + 1;
            orig.c = c;
          }
          shiftedRow.push(orig);
        }
        newGrid.push(shiftedRow);
      }

      this.grid = newGrid;
      this.sound.playBounce();
      this.screenShake = 6;
      this.announce('Ceiling descended!');
      this.dropFloatingClusters();
      this.checkDangerThreshold();
    }

    checkDangerThreshold() {
      let isNearDanger = false;
      if (this.grid && Array.isArray(this.grid)) {
        for (let r = 0; r < this.grid.length; r++) {
          const rowData = this.grid[r];
          if (!rowData || !Array.isArray(rowData)) continue;
          for (let c = 0; c < rowData.length; c++) {
            if (rowData[c] !== null) {
              const center = this.getCellCenter(r, c);
              if (center.y + CONFIG.BUBBLE_RADIUS >= CONFIG.DANGER_Y - 50) {
                isNearDanger = true;
                break;
              }
            }
          }
          if (isNearDanger) break;
        }
      }

      if (isNearDanger) {
        this.dangerBanner.classList.remove('bba-hidden');
      } else {
        this.dangerBanner.classList.add('bba-hidden');
      }
    }

    // --- Win & Lose Conditions ---
    checkLoseConditions() {
      // 1. Cluster breached danger line
      if (this.grid && Array.isArray(this.grid)) {
        for (let r = 0; r < this.grid.length; r++) {
          const rowData = this.grid[r];
          if (!rowData || !Array.isArray(rowData)) continue;
          for (let c = 0; c < rowData.length; c++) {
            if (rowData[c] !== null) {
              const center = this.getCellCenter(r, c);
              if (center.y + CONFIG.BUBBLE_RADIUS >= CONFIG.DANGER_Y) {
                this.triggerGameOver('The bubble cluster breached the perimeter line.');
                return true;
              }
            }
          }
        }
      }

      // 2. Out of shots before meeting objective
      if (this.remainingShots <= 0 && this.levelPops < this.currentLevel.targetPops) {
        this.triggerGameOver('Energy depleted. Out of projectile shots.');
        return true;
      }

      this.checkDangerThreshold();
      return false;
    }

    checkWinConditions() {
      if (!this.grid || !Array.isArray(this.grid)) return false;
      // Condition A: Objective pop count reached OR whole board cleared
      const remainingBubbles = this.grid.reduce((acc, row) => acc + (row ? row.filter(b => b !== null).length : 0), 0);

      if (this.levelPops >= this.currentLevel.targetPops || (remainingBubbles === 0 && this.levelPops > 0)) {
        this.triggerLevelClear();
        return true;
      }
      return false;
    }

    triggerLevelClear() {
      this.state = GameState.LEVEL_CLEAR;
      this.sound.playLevelClear();

      const clearBaseBonus = 1000 * (this.currentLevelIndex + 1);
      const shotsBonus = this.remainingShots * 100;
      this.score += clearBaseBonus + shotsBonus;
      this.saveBestScore(this.score);

      // Populate Summary Overlay
      this.clearBase.textContent = `+${clearBaseBonus.toLocaleString()}`;
      this.clearShotsBonus.textContent = `+${shotsBonus.toLocaleString()} (${this.remainingShots} left)`;
      this.clearMaxCombo.textContent = `x${this.maxComboStreak}`;
      this.clearTotalScore.textContent = this.score.toLocaleString();

      const nextBtnText = document.getElementById('bba-btn-next-text');
      if (this.currentLevelIndex < CONFIG.LEVELS.length - 1) {
        nextBtnText.textContent = `ADVANCE TO SECTOR 0${this.currentLevelIndex + 2}`;
      } else {
        nextBtnText.textContent = 'ENTER ENDLESS ARENA';
      }

      this.levelClearScreen.classList.remove('bba-hidden');
      this.announce(`Sector cleared! Total score: ${this.score}`);
    }

    advanceToNextLevel() {
      this.hideAllOverlays();
      this.startLevel(this.currentLevelIndex + 1);
      this.state = GameState.PLAYING;
    }

    triggerGameOver(reason) {
      this.state = GameState.GAME_OVER;
      this.sound.playGameOver();
      this.saveBestScore(this.score);

      this.overReason.textContent = reason;
      this.overFinalScore.textContent = this.score.toLocaleString();
      this.overSector.textContent = `Sector 0${this.currentLevelIndex + 1}`;
      this.overHighScore.textContent = this.bestScore.toLocaleString();

      this.gameOverScreen.classList.remove('bba-hidden');
      this.announce(`Game Over: ${reason}. Score: ${this.score}`);
    }

    // --- Particle Effects & Floating Visuals ---
    createPopParticles(x, y, colorId, isExplosion = false) {
      const colDef = CONFIG.COLORS.find(c => c.id === colorId) || CONFIG.COLORS[0];
      const count = isExplosion ? 24 : 12;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = isExplosion ? 100 + Math.random() * 220 : 60 + Math.random() * 120;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: isExplosion ? (Math.random() < 0.5 ? '#f59e0b' : '#ef4444') : colDef.hex,
          size: Math.random() * 4 + 2,
          life: 1.0,
          decay: Math.random() * 2 + 2.5
        });
      }
    }

    createAttachPuff(x, y) {
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 25 + Math.random() * 40;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ffffff',
          size: 2,
          life: 0.6,
          decay: 3.0
        });
      }
    }

    createBounceParticles(x, y) {
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          color: '#38bdf8',
          size: 2,
          life: 0.5,
          decay: 3.5
        });
      }
    }

    addFloatingText(x, y, text, color = '#00f0ff') {
      this.floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1.0,
        vy: -45
      });
    }

    showComboBanner(streak) {
      if (streak >= 2) {
        this.comboText.textContent = `COMBO x${streak}`;
        this.comboIndicator.classList.add('bba-combo-active');
      }
    }

    hideComboBanner() {
      this.comboIndicator.classList.remove('bba-combo-active');
    }

    // --- HUD Synchronization ---
    updateHUD() {
      this.hudScore.textContent = this.score.toLocaleString();
      this.hudLevel.textContent = (this.currentLevelIndex + 1).toString();
      this.hudShots.textContent = this.remainingShots.toString();
      this.hudObjective.textContent = `${this.levelPops} / ${this.currentLevel.targetPops}`;
      this.saveBestScore(this.score);
      this.hudBest.textContent = this.bestScore.toLocaleString();
    }

    // --- Main Game Loop ---
    loop(timestamp) {
      // Always schedule next frame first to guarantee loop persistence
      this.animId = requestAnimationFrame(this.loop);

      if (!this.lastTime) this.lastTime = timestamp;
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      try {
        this.update(dt);
        this.render();
      } catch (err) {
        console.error('[Bubble Burst Arena] Game loop render error:', err);
      }
    }

    update(dt) {
      // Smooth Keyboard Aiming
      if (this.state === GameState.PLAYING && this.keyAimDirection !== 0) {
        const aimSpeed = 2.2; // Radians per sec
        this.aimAngle += this.keyAimDirection * aimSpeed * dt;
        const minAngle = -Math.PI + 0.26;
        const maxAngle = -0.26;
        this.aimAngle = Math.max(minAngle, Math.min(maxAngle, this.aimAngle));
      }

      // Update Screen Shake
      if (this.screenShake > 0) {
        this.screenShake -= dt * 30;
        if (this.screenShake < 0) this.screenShake = 0;
      }

      // Update In-Flight Projectile
      if (this.state === GameState.PLAYING && this.projectile) {
        this.updateProjectile(dt);
      }

      // Update Falling Bubbles
      for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
        const fb = this.fallingBubbles[i];
        fb.vy += fb.gravity * dt;
        fb.x += fb.vx * dt;
        fb.y += fb.vy * dt;
        fb.rotation += fb.vRot * dt;

        if (fb.y > CONFIG.CANVAS_HEIGHT + 50) {
          this.fallingBubbles.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update Floating Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt * 1.5;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    // --- Master Render Pipeline ---
    render() {
      const ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      // Ensure exact logical scaling on every frame
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Screen Shake Transform
      if (this.screenShake > 0) {
        const ox = (Math.random() - 0.5) * this.screenShake;
        const oy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(ox, oy);
      }

      // Clear Canvas Background
      ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // 1. Draw Ambient Grid Lines & Danger Boundary
      this.drawPlayfieldGrid(ctx);

      // 2. Draw Attached Cluster Bubbles
      this.drawGridBubbles(ctx);

      // 3. Draw Trajectory Line & Aim Guide (visible when actively playing)
      if (this.state === GameState.PLAYING && !this.projectile) {
        this.drawAimTrajectory(ctx);
      }

      // 4. Draw Falling Avalanche Bubbles
      this.drawFallingBubbles(ctx);

      // 5. Draw In-Flight Projectile
      if (this.projectile) {
        this.drawBubble(ctx, this.projectile.x, this.projectile.y, this.projectile.color, this.projectile.type);
      }

      // 6. Draw Turret / Launcher
      this.drawLauncher(ctx);

      // 7. Draw Visual Particles
      this.drawParticles(ctx);

      // 8. Draw Floating Score Notifications
      this.drawFloatingTexts(ctx);

      ctx.restore();
    }

    // --- Rendering Subroutines ---
    drawPlayfieldGrid(ctx) {
      // Subtle background grid
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CONFIG.CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
      }

      // Danger Perimeter Line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, CONFIG.DANGER_Y);
      ctx.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.DANGER_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Danger text warning
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText('CRITICAL PERIMETER', 10, CONFIG.DANGER_Y - 6);

      ctx.restore();
    }

    drawGridBubbles(ctx) {
      if (!this.grid || !Array.isArray(this.grid)) return;
      for (let r = 0; r < this.grid.length; r++) {
        const row = this.grid[r];
        if (!row || !Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const bubble = row[c];
          if (bubble) {
            const center = this.getCellCenter(r, c);
            this.drawBubble(ctx, center.x, center.y, bubble.color, bubble.type);
          }
        }
      }
    }

    drawBubble(ctx, x, y, colorId, type = 'normal') {
      const r = CONFIG.BUBBLE_RADIUS;
      ctx.save();

      if (type === 'bomb') {
        // Explosive Bomb Rendering (Pulsing dark core with hazard aura)
        const pulse = Math.sin(Date.now() * 0.008) * 0.15 + 1;
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, '#ff7700');
        grad.addColorStop(0.4, '#dc2626');
        grad.addColorStop(0.85, '#18181b');
        grad.addColorStop(1, '#000000');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Bomb Symbol (Sparks & Ring)
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'rainbow') {
        // Prism Rainbow Rendering (Animated spectrum)
        const angleShift = (Date.now() * 0.002) % (Math.PI * 2);
        const grad = ctx.createConicGradient(angleShift, x, y);
        grad.addColorStop(0, '#ff2a85');
        grad.addColorStop(0.2, '#f59e0b');
        grad.addColorStop(0.4, '#10b981');
        grad.addColorStop(0.6, '#00f0ff');
        grad.addColorStop(0.8, '#a855f7');
        grad.addColorStop(1, '#ff2a85');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner Sheen Glass Overlay
        const glass = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
        glass.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        glass.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
        glass.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Star Prism Center
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Standard Glossy Bubble Rendering
        const colDef = CONFIG.COLORS.find(c => c.id === colorId) || CONFIG.COLORS[0];

        // Outer Glow
        ctx.shadowColor = colDef.glow;
        ctx.shadowBlur = 8;

        // Base Spherical Gradient
        const grad = ctx.createRadialGradient(
          x - r * 0.35,
          y - r * 0.35,
          r * 0.1,
          x,
          y,
          r
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, colDef.hex);
        grad.addColorStop(0.85, colDef.dark);
        grad.addColorStop(1, '#050a14');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Crisp glowing neon border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = colDef.hex;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Crescent Highlight for True 3D Glass Gloss
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.28, y - r * 0.32, r * 0.45, r * 0.25, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    drawAimTrajectory(ctx) {
      ctx.save();

      let currX = CONFIG.LAUNCHER_X;
      let currY = CONFIG.LAUNCHER_Y;
      let dirX = Math.cos(this.aimAngle);
      let dirY = Math.sin(this.aimAngle);
      const step = 8;
      const maxDistance = 750;
      let traversed = 0;
      let bounceCount = 0;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.fillStyle = '#00f0ff';
      ctx.lineWidth = 1.5;

      while (traversed < maxDistance && bounceCount < 2) {
        currX += dirX * step;
        currY += dirY * step;
        traversed += step;

        // Draw dotted laser node
        if (traversed % 18 < 6) {
          ctx.beginPath();
          ctx.arc(currX, currY, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Left / Right Wall Bounces
        const r = CONFIG.BUBBLE_RADIUS;
        if (currX <= r) {
          currX = r;
          dirX = -dirX;
          bounceCount++;
        } else if (currX >= CONFIG.CANVAS_WIDTH - r) {
          currX = CONFIG.CANVAS_WIDTH - r;
          dirX = -dirX;
          bounceCount++;
        }

        // Ceiling Hit
        if (currY <= r) {
          break;
        }

        // Check Collision With Existing Bubble
        let collided = false;
        if (this.grid && Array.isArray(this.grid)) {
          for (let row = 0; row < this.grid.length; row++) {
            const rowData = this.grid[row];
            if (!rowData || !Array.isArray(rowData)) continue;
            for (let col = 0; col < rowData.length; col++) {
              if (rowData[col] !== null) {
                const center = this.getCellCenter(row, col);
                const distSq = (currX - center.x) ** 2 + (currY - center.y) ** 2;
                if (distSq <= (CONFIG.BUBBLE_DIAMETER - 2) ** 2) {
                  collided = true;
                  break;
                }
              }
            }
            if (collided) break;
          }
        }

        if (collided) {
          break;
        }
      }

      // Draw Reticle Target at Impact Spot
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(currX, currY, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    drawLauncher(ctx) {
      const lx = CONFIG.LAUNCHER_X;
      const ly = CONFIG.LAUNCHER_Y;

      ctx.save();

      // Cybernetic Turret Base Platform
      ctx.fillStyle = 'rgba(11, 17, 36, 0.9)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Outer Dial Markings
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(lx, ly, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating Barrel Cannon
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(this.aimAngle + Math.PI / 2);

      // Barrel Prongs
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-8, -48, 16, 26, 4);
      ctx.fill();
      ctx.stroke();

      // Energy Guide Lines on Barrel
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -44);
      ctx.lineTo(-4, -26);
      ctx.moveTo(4, -44);
      ctx.lineTo(4, -26);
      ctx.stroke();

      ctx.restore();

      // Loaded Bubble Ready Inside Turret Core
      if (this.currentBubble && !this.projectile) {
        this.drawBubble(ctx, lx, ly, this.currentBubble.color, this.currentBubble.type);
      }

      ctx.restore();
    }

    drawFallingBubbles(ctx) {
      this.fallingBubbles.forEach(fb => {
        ctx.save();
        ctx.translate(fb.x, fb.y);
        ctx.rotate(fb.rotation);
        this.drawBubble(ctx, 0, 0, fb.color, fb.type);
        ctx.restore();
      });
    }

    drawParticles(ctx) {
      ctx.save();
      this.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    drawFloatingTexts(ctx) {
      ctx.save();
      this.floatingTexts.forEach(ft => {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(ft.text, ft.x, ft.y);
      });
      ctx.restore();
    }
  }

  // --- Bootstrapping on DOM Load ---
  function initGame() {
    if (!window.__bbaGame) {
      window.__bbaGame = new BubbleBurstArena();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();
