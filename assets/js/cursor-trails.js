/**
 * ArcadeVerse - Dynamic Canvas Cursor Particle Trail Studio & Retro Comet Spark Tail (#1364)
 * 
 * Features & Architectural Requirements:
 * - High-performance Canvas 2D overlay pointer tracking at silky-smooth 60 FPS.
 * - Built-in trail styles:
 *     1. 'pixel-sparkles' - Retro 8-Bit Pixel Sparkles (blocky pixels, neon gold/amber/cyan palette)
 *     2. 'neon-comet'     - Neon Comet Tail (smooth cyan-magenta comet spark tail with high speed stretch)
 *     3. 'rainbow-star'   - Rainbow Starlight (prismatic spectrum hue cycles and 4-point star shapes)
 *     4. 'electric-arc'   - Electric Arc Discharges (jittering electric discharge bolts and plasma sparks)
 * - Physics Damping & Velocity Scaling:
 *     - Emission count, velocity, and jitter scale dynamically with pointer movement speed.
 *     - Stationary cursors emit gentle ambient twinkling.
 * - Performance & Accessibility Guardrails:
 *     - Pre-allocated object pool of strictly 60 particles with zero per-frame garbage collection.
 *     - Automatically halts rendering and unbinds listeners when prefers-reduced-motion is active
 *       or on touch-only mobile devices (PointerEvent pointerType === 'touch' or matchMedia('(pointer: coarse)')).
 * - Settings & Lifecycle Integration:
 *     - User preference toggle in settings to enable/disable or choose trail styles.
 *     - Persisted in localStorage ('arcadeverse_cursor_trail_settings').
 *     - Automatic teardown and halt when modal games launch (#game-modal active) to prevent
 *       distracting active gameplay, resuming automatically when closed.
 * - Strictly zero Unicode emojis.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.ArcadeCursorTrailStudio = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const POOL_SIZE = 60;
  const STORAGE_KEY = 'arcadeverse_cursor_trail_settings';

  const TRAIL_STYLES = {
    'pixel-sparkles': {
      id: 'pixel-sparkles',
      name: 'Retro 8-Bit Pixel Sparkles',
      description: 'Classic arcade pixel clusters with gold, amber, and cyan retro sparkle glow'
    },
    'neon-comet': {
      id: 'neon-comet',
      name: 'Neon Comet Tail',
      description: 'Luminous cyan-magenta hyperdrive comet sparks trailing pointer momentum'
    },
    'rainbow-star': {
      id: 'rainbow-star',
      name: 'Rainbow Starlight',
      description: 'Prismatic spectral starlight twinkles with 4-point glittering stars'
    },
    'electric-arc': {
      id: 'electric-arc',
      name: 'Electric Arc Discharges',
      description: 'High-voltage plasma sparks with jittering lightning discharges'
    }
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    style: 'pixel-sparkles'
  };

  /**
   * Pre-allocated particle structure
   */
  function createParticle() {
    return {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 30,
      size: 3,
      color: '#00f0ff',
      hue: 0,
      rotation: 0,
      vRot: 0,
      style: 'pixel-sparkles',
      jitter: 0,
      historyX: 0,
      historyY: 0
    };
  }

  class CursorTrailEngine {
    constructor(options = {}) {
      this.poolSize = POOL_SIZE;
      this.particles = new Array(this.poolSize);
      for (let i = 0; i < this.poolSize; i++) {
        this.particles[i] = createParticle();
      }

      this.activeCount = 0;
      this.settings = Object.assign({}, DEFAULT_SETTINGS, options);

      // Mouse tracking & physics telemetry
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.prevPointerX = -1000;
      this.prevPointerY = -1000;
      this.velocity = 0;
      this.hasPointerMoved = false;
      this.stationaryTicks = 0;
      this.lastStationaryEmit = 0;
      this.rainbowHueCounter = 0;

      // Lifecycle flags
      this.isRunning = false;
      this.isModalActive = false;
      this.isTouchDevice = false;
      this.prefersReducedMotion = false;
      this.rafId = null;

      // Canvas elements
      this.canvas = null;
      this.ctx = null;
      this.dpr = 1;

      // Bound listeners
      this._boundOnPointerMove = this.onPointerMove.bind(this);
      this._boundOnPointerLeave = this.onPointerLeave.bind(this);
      this._boundOnResize = this.onResize.bind(this);
      this._boundOnVisibilityChange = this.onVisibilityChange.bind(this);
      this._boundLoop = this.loop.bind(this);
      this._motionMediaQuery = null;
      this._touchMediaQuery = null;
      this._modalObserver = null;

      this.loadSettings();
    }

    loadSettings() {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.enabled === 'boolean') {
              this.settings.enabled = parsed.enabled;
            }
            if (parsed.style && TRAIL_STYLES[parsed.style]) {
              this.settings.style = parsed.style;
            }
          }
        }
      } catch (_) {}
      return this.settings;
    }

    saveSettings() {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        }
      } catch (_) {}
    }

    setEnabled(enabled) {
      this.settings.enabled = Boolean(enabled);
      this.saveSettings();
      if (!this.settings.enabled) {
        this.clearParticles();
        this.stop();
      } else {
        this.checkEnvironmentAndStart();
      }
      this.syncUI();
    }

    setStyle(styleId) {
      if (TRAIL_STYLES[styleId]) {
        this.settings.style = styleId;
        this.saveSettings();
        this.clearParticles();
        this.syncUI();
      }
    }

    getSettings() {
      return Object.assign({}, this.settings);
    }

    getAvailableStyles() {
      return Object.keys(TRAIL_STYLES).map(k => TRAIL_STYLES[k]);
    }

    /**
     * Particle Pool Allocation
     */
    allocateParticle() {
      for (let i = 0; i < this.poolSize; i++) {
        const p = this.particles[i];
        if (!p.active) {
          p.active = true;
          this.activeCount++;
          return p;
        }
      }
      return null; // Pool exhausted, zero dynamic allocations
    }

    clearParticles() {
      for (let i = 0; i < this.poolSize; i++) {
        this.particles[i].active = false;
      }
      this.activeCount = 0;
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    /**
     * Physics Emission
     */
    emit(x, y, vx, vy, speed) {
      if (!this.settings.enabled || this.prefersReducedMotion || this.isTouchDevice || this.isModalActive) {
        return;
      }

      const style = this.settings.style;
      // Scale emission count based on movement speed: 1 particle when slow, up to 4 on rapid flicks
      const count = Math.min(4, Math.max(1, Math.floor(speed * 0.12) + 1));

      for (let i = 0; i < count; i++) {
        const p = this.allocateParticle();
        if (!p) break;

        p.style = style;
        p.life = 0;
        p.historyX = x;
        p.historyY = y;

        // Slight spread offset around pointer
        const spreadOffset = (Math.random() - 0.5) * 6;
        p.x = x + spreadOffset;
        p.y = y + spreadOffset;

        if (style === 'pixel-sparkles') {
          // Retro 8-Bit Pixel Sparkles: blocky square particles with slight drag
          p.maxLife = Math.floor(Math.random() * 18 + 14);
          p.size = Math.floor(Math.random() * 3 + 3); // 3, 4, 5px crisp square pixels
          const angle = Math.random() * Math.PI * 2;
          const spd = (Math.random() * 1.5 + 0.5) + speed * 0.05;
          p.vx = Math.cos(angle) * spd - (vx * 0.1);
          p.vy = Math.sin(angle) * spd - (vy * 0.1);
          const palette = ['#00f0ff', '#ffe600', '#ff0055', '#ff9900', '#00ff88'];
          p.color = palette[Math.floor(Math.random() * palette.length)];
          p.rotation = 0;
          p.vRot = 0;
        } else if (style === 'neon-comet') {
          // Neon Comet Tail: elongated sparks following pointer velocity vector opposite direction
          p.maxLife = Math.floor(Math.random() * 20 + 20);
          p.size = Math.random() * 3 + 2.5;
          const angleOffset = (Math.random() - 0.5) * 0.7;
          const baseAngle = Math.atan2(vy || 0.1, vx || 0.1) + Math.PI + angleOffset;
          const spd = (Math.random() * 2 + 1) + speed * 0.15;
          p.vx = Math.cos(baseAngle) * spd;
          p.vy = Math.sin(baseAngle) * spd;
          p.color = Math.random() > 0.4 ? '#00f0ff' : '#ff0077';
          p.rotation = 0;
          p.vRot = 0;
        } else if (style === 'rainbow-star') {
          // Rainbow Starlight: prismatic hue cycle with 4-point rotating glittering star
          p.maxLife = Math.floor(Math.random() * 22 + 16);
          p.size = Math.random() * 4 + 4;
          this.rainbowHueCounter = (this.rainbowHueCounter + 18) % 360;
          p.hue = this.rainbowHueCounter;
          p.color = `hsl(${p.hue}, 100%, 65%)`;
          const angle = Math.random() * Math.PI * 2;
          const spd = Math.random() * 1.8 + 0.4;
          p.vx = Math.cos(angle) * spd - (vx * 0.08);
          p.vy = Math.sin(angle) * spd - (vy * 0.08);
          p.rotation = Math.random() * Math.PI;
          p.vRot = (Math.random() - 0.5) * 0.15;
        } else if (style === 'electric-arc') {
          // Electric Arc Discharges: sharp jittering sparks with lightning offsets
          p.maxLife = Math.floor(Math.random() * 14 + 10);
          p.size = Math.random() * 2.5 + 2;
          const angle = Math.random() * Math.PI * 2;
          const spd = (Math.random() * 3 + 1) + speed * 0.1;
          p.vx = Math.cos(angle) * spd;
          p.vy = Math.sin(angle) * spd;
          p.jitter = Math.random() * 4 + 2;
          const electricColors = ['#00f0ff', '#7000ff', '#ffffff', '#38bdf8'];
          p.color = electricColors[Math.floor(Math.random() * electricColors.length)];
          p.rotation = 0;
          p.vRot = 0;
        }
      }
    }

    /**
     * Stationary Twinkling Emission
     */
    emitStationaryTwinkle(x, y) {
      if (!this.settings.enabled || this.prefersReducedMotion || this.isTouchDevice || this.isModalActive) {
        return;
      }
      const p = this.allocateParticle();
      if (!p) return;

      const style = this.settings.style;
      p.style = style;
      p.life = 0;
      p.maxLife = Math.floor(Math.random() * 24 + 18);
      p.historyX = x;
      p.historyY = y;

      const rad = Math.random() * 14 + 4;
      const angle = Math.random() * Math.PI * 2;
      p.x = x + Math.cos(angle) * rad;
      p.y = y + Math.sin(angle) * rad;
      p.vx = (Math.random() - 0.5) * 0.3;
      p.vy = (Math.random() - 0.5) * 0.3 - 0.2; // slight upward drift

      if (style === 'pixel-sparkles') {
        p.size = Math.floor(Math.random() * 2 + 2);
        p.color = Math.random() > 0.5 ? '#ffe600' : '#00f0ff';
      } else if (style === 'neon-comet') {
        p.size = Math.random() * 2 + 1.5;
        p.color = '#00f0ff';
      } else if (style === 'rainbow-star') {
        p.size = Math.random() * 3 + 3;
        this.rainbowHueCounter = (this.rainbowHueCounter + 35) % 360;
        p.hue = this.rainbowHueCounter;
        p.color = `hsl(${p.hue}, 100%, 70%)`;
        p.rotation = Math.random() * Math.PI;
        p.vRot = 0.08;
      } else if (style === 'electric-arc') {
        p.size = Math.random() * 2 + 1.5;
        p.color = '#7000ff';
        p.jitter = 1.5;
      }
    }

    /**
     * Physics Simulation Update Tick
     */
    update() {
      // Check stationary ambient twinkle
      if (this.hasPointerMoved && this.pointerX > 0 && this.pointerY > 0) {
        if (this.velocity < 1.2) {
          this.stationaryTicks++;
          if (this.stationaryTicks > 8) { // After resting ~8 frames (~130ms)
            const now = Date.now();
            if (now - this.lastStationaryEmit > 120) {
              this.lastStationaryEmit = now;
              this.emitStationaryTwinkle(this.pointerX, this.pointerY);
            }
          }
        } else {
          this.stationaryTicks = 0;
        }
      }

      if (this.activeCount === 0) return;

      for (let i = 0; i < this.poolSize; i++) {
        const p = this.particles[i];
        if (!p.active) continue;

        p.life++;
        if (p.life >= p.maxLife) {
          p.active = false;
          this.activeCount--;
          continue;
        }

        p.historyX = p.x;
        p.historyY = p.y;

        // Physics damping
        if (p.style === 'pixel-sparkles') {
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.x += p.vx;
          p.y += p.vy;
        } else if (p.style === 'neon-comet') {
          p.vx *= 0.92;
          p.vy *= 0.92;
          p.x += p.vx;
          p.y += p.vy;
        } else if (p.style === 'rainbow-star') {
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.vRot;
        } else if (p.style === 'electric-arc') {
          p.vx *= 0.88;
          p.vy *= 0.88;
          // Apply high-frequency electrical jitter
          const jx = (Math.random() - 0.5) * p.jitter;
          const jy = (Math.random() - 0.5) * p.jitter;
          p.x += p.vx + jx;
          p.y += p.vy + jy;
        }
      }
    }

    /**
     * Render Canvas Overlay
     */
    render() {
      if (!this.ctx || !this.canvas) return;

      const w = this.canvas.width;
      const h = this.canvas.height;
      this.ctx.clearRect(0, 0, w, h);

      if (this.activeCount === 0) return;

      for (let i = 0; i < this.poolSize; i++) {
        const p = this.particles[i];
        if (!p.active) continue;

        const lifeRatio = p.life / p.maxLife;
        const alpha = Math.max(0, 1 - lifeRatio);

        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        if (p.style === 'pixel-sparkles') {
          // Render crisp 8-bit square pixel
          this.ctx.fillStyle = p.color;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 6;
          const sz = Math.max(1, p.size * (1 - lifeRatio * 0.3));
          this.ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), Math.round(sz), Math.round(sz));
        } else if (p.style === 'neon-comet') {
          // Render comet spark with stretch line towards historical position
          this.ctx.strokeStyle = p.color;
          this.ctx.fillStyle = p.color;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 10;
          this.ctx.lineWidth = Math.max(1, p.size * (1 - lifeRatio * 0.5));
          this.ctx.lineCap = 'round';

          this.ctx.beginPath();
          this.ctx.moveTo(p.historyX, p.historyY);
          this.ctx.lineTo(p.x, p.y);
          this.ctx.stroke();

          // Spark head
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, Math.max(0.5, p.size * 0.4), 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.style === 'rainbow-star') {
          // Render 4-point glittering star
          this.ctx.fillStyle = p.color;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 8;
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rotation);

          const r = Math.max(1, p.size * (1 - lifeRatio * 0.4));
          const innerR = r * 0.25;

          this.ctx.beginPath();
          for (let step = 0; step < 8; step++) {
            const rad = step % 2 === 0 ? r : innerR;
            const a = (step * Math.PI) / 4;
            const sx = Math.cos(a) * rad;
            const sy = Math.sin(a) * rad;
            if (step === 0) {
              this.ctx.moveTo(sx, sy);
            } else {
              this.ctx.lineTo(sx, sy);
            }
          }
          this.ctx.closePath();
          this.ctx.fill();
        } else if (p.style === 'electric-arc') {
          // Render electric zigzag segment
          this.ctx.strokeStyle = p.color;
          this.ctx.shadowColor = p.color;
          this.ctx.shadowBlur = 12;
          this.ctx.lineWidth = Math.max(1, p.size * (1 - lifeRatio * 0.6));
          this.ctx.lineCap = 'butt';

          this.ctx.beginPath();
          this.ctx.moveTo(p.historyX, p.historyY);
          const midX = (p.historyX + p.x) / 2 + (Math.random() - 0.5) * p.jitter;
          const midY = (p.historyY + p.y) / 2 + (Math.random() - 0.5) * p.jitter;
          this.ctx.lineTo(midX, midY);
          this.ctx.lineTo(p.x, p.y);
          this.ctx.stroke();
        }

        this.ctx.restore();
      }
    }

    loop() {
      if (!this.isRunning) return;

      this.update();
      this.render();

      this.rafId = requestAnimationFrame(this._boundLoop);
    }

    start() {
      if (this.isRunning) return;
      if (!this.settings.enabled || this.prefersReducedMotion || this.isTouchDevice || this.isModalActive) {
        return;
      }
      this.isRunning = true;
      this.rafId = requestAnimationFrame(this._boundLoop);
    }

    stop() {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.clearParticles();
    }

    /**
     * Pointer Event Handlers
     */
    onPointerMove(e) {
      // Accessibility guardrail: Ignore touch pointers or when motion is reduced
      if (e.pointerType === 'touch' || this.isTouchDevice || this.prefersReducedMotion || this.isModalActive) {
        return;
      }

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (!this.hasPointerMoved) {
        this.prevPointerX = clientX;
        this.prevPointerY = clientY;
        this.pointerX = clientX;
        this.pointerY = clientY;
        this.hasPointerMoved = true;
        this.velocity = 0;
        return;
      }

      const dx = clientX - this.prevPointerX;
      const dy = clientY - this.prevPointerY;
      const speed = Math.sqrt(dx * dx + dy * dy);

      this.velocity = speed;
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.pointerX = clientX;
      this.pointerY = clientY;

      if (speed > 1) {
        this.emit(clientX, clientY, dx, dy, speed);
      }
    }

    onPointerLeave() {
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.prevPointerX = -1000;
      this.prevPointerY = -1000;
      this.hasPointerMoved = false;
      this.velocity = 0;
    }

    onResize() {
      if (!this.canvas || typeof window === 'undefined') return;
      this.dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.canvas.width = Math.floor(width * this.dpr);
      this.canvas.height = Math.floor(height * this.dpr);
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';

      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
      }
    }

    onVisibilityChange() {
      if (typeof document !== 'undefined' && document.hidden) {
        this.stop();
      } else {
        this.checkEnvironmentAndStart();
      }
    }

    checkEnvironmentAndStart() {
      if (!this.settings.enabled) {
        this.stop();
        return;
      }

      // Check prefers-reduced-motion
      if (typeof window !== 'undefined' && window.matchMedia) {
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }

      // Check touch-only mobile devices
      if (typeof window !== 'undefined') {
        const hasTouchQuery = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const maxTouchPoints = navigator.maxTouchPoints || 0;
        this.isTouchDevice = hasTouchQuery && maxTouchPoints > 0;
      }

      // Check modal gameplay active
      if (typeof document !== 'undefined') {
        const modal = document.getElementById('game-modal');
        this.isModalActive = Boolean(modal && modal.classList.contains('active'));
      }

      if (this.prefersReducedMotion || this.isTouchDevice || this.isModalActive) {
        this.stop();
      } else {
        this.start();
      }
    }

    /**
     * DOM Canvas Overlay Mounting
     */
    mountCanvas() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('arcade-cursor-trail-canvas')) {
        this.canvas = document.getElementById('arcade-cursor-trail-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.onResize();
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.id = 'arcade-cursor-trail-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '999990'; // Sits above catalog background, beneath interactive dialogs/modals
      canvas.style.opacity = '1';
      canvas.style.transition = 'opacity 0.25s ease';

      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onResize();
    }

    /**
     * Lifecycle Listeners & Modal Teardown Guardrail
     */
    bindListeners() {
      if (typeof window === 'undefined') return;

      window.addEventListener('pointermove', this._boundOnPointerMove, { passive: true });
      window.addEventListener('pointerleave', this._boundOnPointerLeave, { passive: true });
      window.addEventListener('resize', this._boundOnResize, { passive: true });
      document.addEventListener('visibilitychange', this._boundOnVisibilityChange);

      // Listen for prefers-reduced-motion changes
      if (window.matchMedia) {
        this._motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (this._motionMediaQuery.addEventListener) {
          this._motionMediaQuery.addEventListener('change', (e) => {
            this.prefersReducedMotion = e.matches;
            this.checkEnvironmentAndStart();
          });
        }
      }

      // Automatic teardown when modal games launch (#game-modal active)
      const modal = document.getElementById('game-modal');
      if (modal && typeof MutationObserver !== 'undefined') {
        this._modalObserver = new MutationObserver((mutations) => {
          for (let i = 0; i < mutations.length; i++) {
            if (mutations[i].attributeName === 'class') {
              const active = modal.classList.contains('active');
              if (active !== this.isModalActive) {
                this.isModalActive = active;
                if (active) {
                  this.clearParticles();
                  this.stop();
                } else {
                  this.checkEnvironmentAndStart();
                }
              }
              break;
            }
          }
        });
        this._modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
      }
    }

    /**
     * Accessibility Hub / Settings UI Integration
     */
    ensureSettingsUI() {
      if (typeof document === 'undefined') return;
      const list = document.getElementById('a11y-options-list') || document.querySelector('.a11y-options-list');
      if (!list) return;

      if (!document.getElementById('a11y-cursor-trail-toggle-row')) {
        // Master Toggle Row
        const toggleRow = document.createElement('label');
        toggleRow.id = 'a11y-cursor-trail-toggle-row';
        toggleRow.className = 'a11y-toggle-row';
        toggleRow.htmlFor = 'a11y-opt-cursor-trail';
        toggleRow.innerHTML = `
          <div>
            <strong class="a11y-toggle-title">Interactive Cursor Trails</strong>
            <span class="a11y-toggle-sub">Dynamic Canvas particle sparks following pointer coordinates</span>
          </div>
          <input type="checkbox" id="a11y-opt-cursor-trail" class="a11y-checkbox" ${this.settings.enabled ? 'checked' : ''}>
        `;
        list.appendChild(toggleRow);

        // Style Selector Row
        const styleRow = document.createElement('div');
        styleRow.id = 'a11y-cursor-trail-style-row';
        styleRow.className = 'a11y-toggle-row a11y-select-row';
        styleRow.innerHTML = `
          <div>
            <strong class="a11y-toggle-title">Cursor Trail Style</strong>
            <span class="a11y-toggle-sub">Retro 8-Bit, Neon Comet, Rainbow Star, or Electric Arc</span>
          </div>
          <select id="a11y-opt-cursor-style" class="a11y-select" aria-label="Cursor Trail Style">
            <option value="pixel-sparkles" ${this.settings.style === 'pixel-sparkles' ? 'selected' : ''}>Retro 8-Bit Pixel Sparkles</option>
            <option value="neon-comet" ${this.settings.style === 'neon-comet' ? 'selected' : ''}>Neon Comet Tail</option>
            <option value="rainbow-star" ${this.settings.style === 'rainbow-star' ? 'selected' : ''}>Rainbow Starlight</option>
            <option value="electric-arc" ${this.settings.style === 'electric-arc' ? 'selected' : ''}>Electric Arc Discharges</option>
          </select>
        `;
        list.appendChild(styleRow);

        // Bind UI Events
        const toggleInput = document.getElementById('a11y-opt-cursor-trail');
        if (toggleInput) {
          toggleInput.addEventListener('change', (e) => {
            this.setEnabled(e.target.checked);
          });
        }

        const styleSelect = document.getElementById('a11y-opt-cursor-style');
        if (styleSelect) {
          styleSelect.addEventListener('change', (e) => {
            this.setStyle(e.target.value);
          });
        }
      }
    }

    syncUI() {
      if (typeof document === 'undefined') return;
      const toggle = document.getElementById('a11y-opt-cursor-trail');
      if (toggle) {
        toggle.checked = this.settings.enabled;
      }
      const select = document.getElementById('a11y-opt-cursor-style');
      if (select) {
        select.value = this.settings.style;
      }
    }

    init() {
      if (typeof window === 'undefined') return;
      this.mountCanvas();
      this.bindListeners();
      this.ensureSettingsUI();
      this.checkEnvironmentAndStart();

      // Hook into a11y drawer open if drawer is mounted asynchronously
      const a11yBtn = document.getElementById('a11y-toggle-btn');
      if (a11yBtn) {
        a11yBtn.addEventListener('click', () => {
          setTimeout(() => this.ensureSettingsUI(), 50);
        });
      }
    }

    destroy() {
      this.stop();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', this._boundOnPointerMove);
        window.removeEventListener('pointerleave', this._boundOnPointerLeave);
        window.removeEventListener('resize', this._boundOnResize);
        document.removeEventListener('visibilitychange', this._boundOnVisibilityChange);
      }
      if (this._modalObserver) {
        this._modalObserver.disconnect();
        this._modalObserver = null;
      }
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.canvas = null;
      this.ctx = null;
    }
  }

  // Create singleton instance
  const instance = new CursorTrailEngine();

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
      instance.init();
    }
  }

  return {
    TRAIL_STYLES,
    CursorTrailEngine,
    instance
  };
});
