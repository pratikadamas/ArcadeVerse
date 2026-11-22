/**
 * ===================================================================
 * FRUIT FURY - Fast-Paced Fruit Slicing Arcade Game
 * ArcadeVerse Contribution
 * 100% Vanilla JS (ES6+), Canvas API, Web Audio API
 * Zero External Dependencies, Zero CDNs, Zero Unicode Emojis
 * ===================================================================
 */

(function () {
  'use strict';

  /* ===================================================================
     1. AUDIO SYNTHESIZER (WEB AUDIO API)
     =================================================================== */

  class SoundSynthesizer {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.isMuted = false;
      this.masterVolume = 0.7;

      this.initStorage();
    }

    initStorage() {
      try {
        const savedMute = localStorage.getItem('av_sound_muted');
        if (savedMute !== null) {
          this.isMuted = JSON.parse(savedMute) === true;
        }
        const savedVol = localStorage.getItem('av_master_volume');
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.masterVolume = parsed;
          }
        }
      } catch (e) {
        // Fallback silently if localStorage is restricted
      }
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    setMute(mute) {
      this.isMuted = mute;
      try {
        localStorage.setItem('av_sound_muted', JSON.stringify(mute));
      } catch (e) {}

      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime);
      }
    }

    setVolume(vol) {
      this.masterVolume = Math.max(0, Math.min(1, vol));
      if (!this.isMuted && this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      }
    }

    playSwipe() {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.13);
    }

    playSlice(pitchMod = 1.0) {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // High transient squish
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(550 * pitchMod, now);
      osc.frequency.exponentialRampToValueAtTime(180 * pitchMod, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.1);

      // Noise splat burst
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1200, now);
      noiseFilter.Q.setValueAtTime(2.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
    }

    playBombExplosion() {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Heavy sub-bass thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(160, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.55);

      subGain.gain.setValueAtTime(0.8, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 0.56);

      // Noise explosion burst
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.45);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
    }

    playCombo(comboCount) {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      const count = Math.min(notes.length, Math.max(3, comboCount));

      for (let i = 0; i < count; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[i], now + i * 0.06);

        gain.gain.setValueAtTime(0.3, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.23);
      }
    }

    playPowerUp() {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.25);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.27);
    }

    playLifeLost() {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.26);
    }

    playClick() {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    }

    playGameOver() {
      if (this.isMuted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const freqs = [392, 349.23, 311.13, 261.63];

      for (let i = 0; i < freqs.length; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqs[i], now + i * 0.12);

        gain.gain.setValueAtTime(0.35, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.32);
      }
    }
  }

  /* ===================================================================
     2. PARTICLE & FLOATING TEXT SYSTEM
     =================================================================== */

  class Particle {
    constructor() {
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.size = 0;
      this.color = '#fff';
      this.alpha = 1;
      this.decay = 0.02;
      this.gravity = 0;
      this.isPulp = false;
    }

    spawn(x, y, vx, vy, size, color, decay, gravity = 250, isPulp = false) {
      this.active = true;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.size = size;
      this.color = color;
      this.alpha = 1;
      this.decay = decay;
      this.gravity = gravity;
      this.isPulp = isPulp;
    }

    update(dt) {
      if (!this.active) return;
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.alpha -= this.decay * (dt * 60);

      if (this.alpha <= 0) {
        this.active = false;
      }
    }

    draw(ctx) {
      if (!this.active || this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      if (this.isPulp) {
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      } else {
        ctx.arc(this.x, this.y, this.size * this.alpha, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  class FloatingText {
    constructor() {
      this.active = false;
      this.text = '';
      this.x = 0;
      this.y = 0;
      this.vy = -70;
      this.color = '#fff';
      this.size = 18;
      this.alpha = 1;
      this.decay = 0.025;
    }

    spawn(text, x, y, color = '#ff7b25', size = 20) {
      this.active = true;
      this.text = text;
      this.x = x;
      this.y = y;
      this.vy = -80;
      this.color = color;
      this.size = size;
      this.alpha = 1;
    }

    update(dt) {
      if (!this.active) return;
      this.y += this.vy * dt;
      this.alpha -= this.decay * (dt * 60);
      if (this.alpha <= 0) {
        this.active = false;
      }
    }

    draw(ctx) {
      if (!this.active || this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.font = `800 ${this.size}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  class ParticlePool {
    constructor(maxParticles = 250, maxTexts = 30) {
      this.particles = Array.from({ length: maxParticles }, () => new Particle());
      this.texts = Array.from({ length: maxTexts }, () => new FloatingText());
    }

    spawnSplatter(x, y, color, count = 16) {
      for (let i = 0; i < count; i++) {
        const p = this.particles.find(item => !item.active);
        if (!p) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 260;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const size = 3 + Math.random() * 5;
        const decay = 0.015 + Math.random() * 0.02;
        p.spawn(x, y, vx, vy, size, color, decay, 380, true);
      }
    }

    spawnExplosion(x, y, count = 35) {
      const colors = ['#ef4444', '#f97316', '#facc15', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const p = this.particles.find(item => !item.active);
        if (!p) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 380;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const size = 4 + Math.random() * 7;
        const col = colors[Math.floor(Math.random() * colors.length)];
        const decay = 0.02 + Math.random() * 0.025;
        p.spawn(x, y, vx, vy, size, col, decay, 150, false);
      }
    }

    spawnText(text, x, y, color, size) {
      const t = this.texts.find(item => !item.active);
      if (t) {
        t.spawn(text, x, y, color, size);
      }
    }

    update(dt) {
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].active) this.particles[i].update(dt);
      }
      for (let i = 0; i < this.texts.length; i++) {
        if (this.texts[i].active) this.texts[i].update(dt);
      }
    }

    draw(ctx) {
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].active) this.particles[i].draw(ctx);
      }
      for (let i = 0; i < this.texts.length; i++) {
        if (this.texts[i].active) this.texts[i].draw(ctx);
      }
    }

    clear() {
      this.particles.forEach(p => p.active = false);
      this.texts.forEach(t => t.active = false);
    }
  }

  /* ===================================================================
     3. SLICE BLADE TRAIL SYSTEM
     =================================================================== */

  class SliceTrail {
    constructor() {
      this.points = [];
      this.maxLife = 0.18; // Seconds of glow trail
      this.isSwiping = false;
    }

    addPoint(x, y) {
      this.points.push({ x, y, time: performance.now() / 1000 });
      this.isSwiping = true;
    }

    clear() {
      this.points = [];
      this.isSwiping = false;
    }

    update() {
      const now = performance.now() / 1000;
      this.points = this.points.filter(pt => now - pt.time <= this.maxLife);
      if (this.points.length === 0) {
        this.isSwiping = false;
      }
    }

    draw(ctx) {
      if (this.points.length < 2) return;

      const now = performance.now() / 1000;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Outer vibrant glow pass
      for (let i = 1; i < this.points.length; i++) {
        const pt1 = this.points[i - 1];
        const pt2 = this.points[i];
        const age = now - pt2.time;
        const progress = Math.max(0, 1 - age / this.maxLife);
        const width = progress * 14;

        ctx.strokeStyle = 'rgba(255, 123, 37, 0.45)';
        ctx.shadowColor = '#ff7b25';
        ctx.shadowBlur = 14;
        ctx.lineWidth = width + 4;
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      // Inner razor core pass
      for (let i = 1; i < this.points.length; i++) {
        const pt1 = this.points[i - 1];
        const pt2 = this.points[i];
        const age = now - pt2.time;
        const progress = Math.max(0, 1 - age / this.maxLife);
        const width = progress * 7;

        ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.95})`;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /* ===================================================================
     4. FRUIT DEFINITIONS AND HALVES
     =================================================================== */

  const FRUIT_TYPES = [
    {
      id: 'watermelon',
      name: 'Watermelon',
      radius: 46,
      points: 10,
      juiceColor: '#ef4444',
      pulpColor: '#22c55e',
      pitch: 0.85
    },
    {
      id: 'orange',
      name: 'Orange',
      radius: 38,
      points: 10,
      juiceColor: '#f97316',
      pulpColor: '#fed7aa',
      pitch: 1.05
    },
    {
      id: 'apple',
      name: 'Apple',
      radius: 36,
      points: 10,
      juiceColor: '#dc2626',
      pulpColor: '#fef08a',
      pitch: 1.15
    },
    {
      id: 'banana',
      name: 'Banana',
      radius: 35,
      points: 10,
      juiceColor: '#facc15',
      pulpColor: '#fef9c3',
      pitch: 1.2
    },
    {
      id: 'pineapple',
      name: 'Pineapple',
      radius: 44,
      points: 15,
      juiceColor: '#eab308',
      pulpColor: '#16a34a',
      pitch: 0.9
    },
    {
      id: 'strawberry',
      name: 'Strawberry',
      radius: 30,
      points: 12,
      juiceColor: '#e11d48',
      pulpColor: '#f43f5e',
      pitch: 1.35
    },
    {
      id: 'coconut',
      name: 'Coconut',
      radius: 40,
      points: 15,
      juiceColor: '#ffffff',
      pulpColor: '#78350f',
      pitch: 0.8
    },
    {
      id: 'kiwi',
      name: 'Kiwi',
      radius: 34,
      points: 12,
      juiceColor: '#84cc16',
      pulpColor: '#a16207',
      pitch: 1.25
    },
    {
      id: 'grapes',
      name: 'Grapes',
      radius: 38,
      points: 15,
      juiceColor: '#9333ea',
      pulpColor: '#c084fc',
      pitch: 1.4
    },
    {
      id: 'dragonfruit',
      name: 'Dragon Fruit',
      radius: 42,
      points: 20,
      juiceColor: '#ec4899',
      pulpColor: '#ffffff',
      pitch: 1.0
    }
  ];

  class FruitHalf {
    constructor(fruitType, x, y, vx, vy, angle, vRot, isLeft) {
      this.type = fruitType;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.angle = angle;
      this.vRot = vRot;
      this.isLeft = isLeft;
      this.radius = fruitType.radius;
      this.alpha = 1;
      this.active = true;
    }

    update(dt) {
      this.vy += 850 * dt; // Gravity
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.angle += this.vRot * dt;

      // Start fading when dropping low
      if (this.vy > 400) {
        this.alpha -= 0.6 * dt;
        if (this.alpha <= 0) {
          this.active = false;
        }
      }
    }

    draw(ctx) {
      if (!this.active || this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Clip to semi-circle based on half
      ctx.beginPath();
      if (this.isLeft) {
        ctx.arc(0, 0, this.radius, -Math.PI / 2, Math.PI / 2, true);
      } else {
        ctx.arc(0, 0, this.radius, -Math.PI / 2, Math.PI / 2, false);
      }
      ctx.closePath();
      ctx.clip();

      // Draw inside cross section & skin
      Fruit.drawFruitBody(ctx, this.type, true);

      // Draw slice cut face highlight line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(0, this.radius);
      ctx.stroke();

      ctx.restore();
    }
  }

  class Fruit {
    constructor(type, x, y, vx, vy, vRot) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.angle = Math.random() * Math.PI * 2;
      this.vRot = vRot;
      this.radius = type.radius;
      this.sliced = false;
      this.active = true;
      this.hasPeaked = false;
    }

    update(dt, timeScale = 1.0) {
      const effDt = dt * timeScale;
      this.vy += 760 * effDt; // Gravity
      this.x += this.vx * effDt;
      this.y += this.vy * effDt;
      this.angle += this.vRot * effDt;

      if (this.vy > 0) {
        this.hasPeaked = true;
      }
    }

    draw(ctx) {
      if (!this.active || this.sliced) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      Fruit.drawFruitBody(ctx, this.type, false);

      ctx.restore();
    }

    static drawFruitBody(ctx, type, isCutView) {
      const r = type.radius;

      switch (type.id) {
        case 'watermelon': {
          if (isCutView) {
            // Cut View: Green rind, white pith, crimson pulp, black seeds
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#bbf7d0';
            ctx.beginPath();
            ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(0, 0, r - 9, 0, Math.PI * 2);
            ctx.fill();

            // Black seeds
            ctx.fillStyle = '#0f172a';
            const seedOffsets = [[-10, -12], [8, -8], [-5, 12], [12, 14]];
            seedOffsets.forEach(([sx, sy]) => {
              ctx.beginPath();
              ctx.ellipse(sx, sy, 2.5, 4, 0.4, 0, Math.PI * 2);
              ctx.fill();
            });
          } else {
            // Whole: Dark green with vertical forest-green stripes
            const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
            grad.addColorStop(0, '#22c55e');
            grad.addColorStop(1, '#14532d');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Rind Stripes
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 4;
            for (let i = -2; i <= 2; i++) {
              ctx.beginPath();
              ctx.ellipse(i * 14, 0, 8, r - 2, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          break;
        }

        case 'orange': {
          if (isCutView) {
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffedd5';
            ctx.beginPath();
            ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
            ctx.fill();

            // Segment lines
            ctx.strokeStyle = '#ffedd5';
            ctx.lineWidth = 1.5;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7));
              ctx.stroke();
            }
          } else {
            const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
            grad.addColorStop(0, '#fdba74');
            grad.addColorStop(0.7, '#ea580c');
            grad.addColorStop(1, '#c2410c');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Green top stem nub
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.arc(0, -r + 2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

        case 'apple': {
          if (isCutView) {
            ctx.fillStyle = '#b91c1c';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fef9c3';
            ctx.beginPath();
            ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
            ctx.fill();

            // Apple core seeds
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.ellipse(-4, 0, 2, 4, -0.3, 0, Math.PI * 2);
            ctx.ellipse(4, 0, 2, 4, 0.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
            grad.addColorStop(0, '#f87171');
            grad.addColorStop(0.6, '#dc2626');
            grad.addColorStop(1, '#7f1d1d');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Apple stem & green leaf
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -r + 4);
            ctx.quadraticCurveTo(4, -r - 10, 8, -r - 12);
            ctx.stroke();

            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.ellipse(8, -r - 6, 6, 3, 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

        case 'banana': {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Green tip
          ctx.fillStyle = '#65a30d';
          ctx.beginPath();
          ctx.arc(0, -r + 3, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'pineapple': {
          if (isCutView) {
            ctx.fillStyle = '#854d0e';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 5, 0, 0, r);
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.5, '#eab308');
            grad.addColorStop(1, '#a16207');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Diamond criss-cross pattern
            ctx.strokeStyle = 'rgba(113, 63, 18, 0.45)';
            ctx.lineWidth = 2;
            for (let d = -r; d <= r; d += 12) {
              ctx.beginPath();
              ctx.moveTo(d, -r);
              ctx.lineTo(d + r, r);
              ctx.moveTo(d, r);
              ctx.lineTo(d + r, -r);
              ctx.stroke();
            }

            // Crown spikes
            ctx.fillStyle = '#15803d';
            for (let a = -0.5; a <= 0.5; a += 0.25) {
              ctx.beginPath();
              ctx.moveTo(0, -r + 4);
              ctx.lineTo(Math.sin(a) * 22, -r - 18);
              ctx.lineTo(Math.sin(a + 0.15) * 16, -r + 2);
              ctx.fill();
            }
          }
          break;
        }

        case 'strawberry': {
          if (isCutView) {
            ctx.fillStyle = '#9f1239';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fda4af';
            ctx.beginPath();
            ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
            grad.addColorStop(0, '#fb7185');
            grad.addColorStop(0.6, '#e11d48');
            grad.addColorStop(1, '#881337');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Golden seeds
            ctx.fillStyle = '#fef08a';
            const strawberrySeeds = [[-10, -8], [8, -6], [-4, 6], [10, 8], [-12, 10]];
            strawberrySeeds.forEach(([sx, sy]) => {
              ctx.beginPath();
              ctx.ellipse(sx, sy, 1.5, 2.5, 0.2, 0, Math.PI * 2);
              ctx.fill();
            });

            // Green top leaves
            ctx.fillStyle = '#16a34a';
            for (let a = -0.4; a <= 0.4; a += 0.25) {
              ctx.beginPath();
              ctx.ellipse(Math.sin(a) * 14, -r + 2, 8, 3, a, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }

        case 'coconut': {
          if (isCutView) {
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#5c2d12';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Fibrous hairs
            ctx.strokeStyle = 'rgba(254, 215, 170, 0.25)';
            ctx.lineWidth = 1.5;
            for (let a = 0; a < Math.PI * 2; a += 0.4) {
              ctx.beginPath();
              ctx.arc(0, 0, r - 3, a, a + 0.2);
              ctx.stroke();
            }

            // 3 Dark eyes
            ctx.fillStyle = '#291307';
            ctx.beginPath();
            ctx.arc(-8, -10, 4, 0, Math.PI * 2);
            ctx.arc(8, -10, 4, 0, Math.PI * 2);
            ctx.arc(0, -2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

        case 'kiwi': {
          if (isCutView) {
            ctx.fillStyle = '#78350f';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#84cc16';
            ctx.beginPath();
            ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ecfccb';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
            ctx.fill();

            // Tiny black seeds ring
            ctx.fillStyle = '#0f172a';
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
              const sx = Math.cos(a) * (r * 0.48);
              const sy = Math.sin(a) * (r * 0.48);
              ctx.beginPath();
              ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 5, 0, 0, r);
            grad.addColorStop(0, '#a16207');
            grad.addColorStop(1, '#593006');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

        case 'grapes': {
          ctx.fillStyle = '#7e22ce';
          const grapePositions = [
            [0, -10], [-10, 0], [10, 0], [-6, 12], [6, 12], [0, 22]
          ];
          grapePositions.forEach(([gx, gy]) => {
            ctx.beginPath();
            ctx.arc(gx, gy, 12, 0, Math.PI * 2);
            ctx.fill();

            // Grape highlight dot
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.arc(gx - 3, gy - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7e22ce';
          });
          break;
        }

        case 'dragonfruit': {
          if (isCutView) {
            ctx.fillStyle = '#db2777';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
            ctx.fill();

            // Dragon fruit speckled seeds
            ctx.fillStyle = '#0f172a';
            for (let i = 0; i < 18; i++) {
              const a = (i * 0.35) * Math.PI;
              const dist = (i % 4 + 1) * (r * 0.18);
              ctx.beginPath();
              ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Green flame scale accents
            ctx.fillStyle = '#4ade80';
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
              ctx.beginPath();
              ctx.ellipse(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2), 6, 12, a + 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }
      }
    }
  }

  /* ===================================================================
     5. BOMB CLASS
     =================================================================== */

  class Bomb {
    constructor(x, y, vx, vy, vRot) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.vRot = vRot;
      this.angle = 0;
      this.radius = 36;
      this.active = true;
      this.sliced = false;
      this.fuseTimer = 0;
    }

    update(dt, timeScale = 1.0) {
      const effDt = dt * timeScale;
      this.vy += 760 * effDt;
      this.x += this.vx * effDt;
      this.y += this.vy * effDt;
      this.angle += this.vRot * effDt;
      this.fuseTimer += effDt * 8;
    }

    draw(ctx) {
      if (!this.active || this.sliced) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const r = this.radius;

      // Dark metallic sphere with glow
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 4, 0, 0, r);
      grad.addColorStop(0, '#64748b');
      grad.addColorStop(0.4, '#334155');
      grad.addColorStop(0.9, '#0f172a');
      grad.addColorStop(1, '#020617');

      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Metallic collar cap
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.rect(-6, -r - 4, 12, 6);
      ctx.fill();

      // Curved fuse rope
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r - 4);
      ctx.quadraticCurveTo(8, -r - 14, 14, -r - 18);
      ctx.stroke();

      // Animated burning spark
      const sparkRadius = 4 + Math.sin(this.fuseTimer) * 2;
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(14, -r - 18, sparkRadius, 0, Math.PI * 2);
      ctx.fill();

      // Skull or Hazard mark
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 2, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-3, 0, 2, 0, Math.PI * 2);
      ctx.arc(3, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.restore();
    }
  }

  /* ===================================================================
     6. POWER-UP SYSTEM
     =================================================================== */

  const POWER_TYPES = [
    { id: 'freeze', name: 'Freeze Field', duration: 6, color: '#38bdf8', icon: 'snow' },
    { id: 'double', name: 'Double Score', duration: 8, color: '#facc15', icon: '2x' },
    { id: 'frenzy', name: 'Fruit Frenzy', duration: 4, color: '#4ade80', icon: 'frenzy' },
    { id: 'shield', name: 'Bomb Shield', duration: 15, color: '#a855f7', icon: 'shield' },
    { id: 'heart', name: 'Extra Life', duration: 0, color: '#ef4444', icon: 'heart' }
  ];

  class PowerUpOrb {
    constructor(type, x, y, vx, vy) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.radius = 32;
      this.active = true;
      this.sliced = false;
      this.pulseTimer = 0;
    }

    update(dt) {
      this.vy += 620 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.pulseTimer += dt * 4;
    }

    draw(ctx) {
      if (!this.active || this.sliced) return;

      ctx.save();
      ctx.translate(this.x, this.y);

      const r = this.radius;
      const pulseScale = 1 + Math.sin(this.pulseTimer) * 0.08;

      // Glowing outer ring
      ctx.fillStyle = this.type.color;
      ctx.shadowColor = this.type.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, r * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      // Core sphere
      ctx.globalAlpha = 0.95;
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 3, 0, 0, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, this.type.color);
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Icon symbol inside
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 16px system-ui, sans-serif';

      if (this.type.id === 'double') {
        ctx.fillText('2X', 0, 1);
      } else if (this.type.id === 'freeze') {
        ctx.fillText('*', 0, 3);
      } else if (this.type.id === 'frenzy') {
        ctx.fillText('!', 0, 1);
      } else if (this.type.id === 'shield') {
        ctx.fillText('S', 0, 1);
      } else if (this.type.id === 'heart') {
        ctx.fillText('+', 0, 0);
      }

      ctx.restore();
    }
  }

  /* ===================================================================
     7. LINE INTERSECTION COLLISION HELPER
     =================================================================== */

  function distToSegmentSquared(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
  }

  function checkLineCircleCollision(p1, p2, circleCenter, radius) {
    const d2 = distToSegmentSquared(circleCenter, p1, p2);
    return d2 <= radius * radius;
  }

  /* ===================================================================
     8. MAIN GAME CONTROLLER
     =================================================================== */

  class FruitFuryGame {
    constructor() {
      // DOM Elements
      this.container = document.getElementById('game-container');
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.hud = document.getElementById('hud');
      this.hudScore = document.getElementById('hud-score');
      this.hudBest = document.getElementById('hud-best');
      this.hudModeBadge = document.getElementById('hud-mode-badge');
      this.hudLives = document.getElementById('hud-lives');
      this.hudTimerContainer = document.getElementById('hud-timer-container');
      this.hudTimer = document.getElementById('hud-timer');
      this.hudBuffs = document.getElementById('hud-buffs');

      this.comboBanner = document.getElementById('combo-banner');
      this.comboTitle = document.getElementById('combo-title');
      this.comboSub = document.getElementById('combo-sub');
      this.screenFlash = document.getElementById('screen-flash');

      this.screenMenu = document.getElementById('screen-menu');
      this.screenHow = document.getElementById('screen-how-to-play');
      this.screenPause = document.getElementById('screen-pause');
      this.screenGameOver = document.getElementById('screen-game-over');

      this.menuBestScore = document.getElementById('menu-best-score');
      this.resultFinalScore = document.getElementById('result-final-score');
      this.resultBestScore = document.getElementById('result-best-score');
      this.resultSlicedCount = document.getElementById('result-sliced-count');
      this.resultMaxCombo = document.getElementById('result-max-combo');
      this.gameOverReason = document.getElementById('game-over-reason');

      this.btnSoundToggle = document.getElementById('btn-sound-toggle');
      this.btnPauseToggle = document.getElementById('btn-pause-toggle');
      this.iconVolOn = document.getElementById('icon-volume-on');
      this.iconVolOff = document.getElementById('icon-volume-off');

      // Systems
      this.sound = new SoundSynthesizer();
      this.particles = new ParticlePool();
      this.trail = new SliceTrail();

      // State
      this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
      this.mode = 'CLASSIC'; // CLASSIC, ARCADE, ZEN
      this.score = 0;
      this.bestScore = 0;
      this.lives = 3;
      this.gameTimeRemaining = 60;
      this.totalSliced = 0;
      this.highestCombo = 0;

      // Entities
      this.fruits = [];
      this.halves = [];
      this.bombs = [];
      this.powerups = [];

      // Spawning
      this.spawnTimer = 0;
      this.spawnInterval = 2.0;
      this.waveCounter = 0;

      // Combos
      this.currentSwipeFruits = [];
      this.comboTimeout = null;

      // Active Buffs
      this.activeBuffs = {
        freeze: 0,
        double: 0,
        shield: false
      };

      // Timing
      this.lastTime = performance.now();
      this.screenShakeTime = 0;

      // Pointer State
      this.isPointerDown = false;
      this.lastPointer = null;

      this.init();
    }

    init() {
      this.setupCanvas();
      this.loadHighScores();
      this.setupEvents();
      this.updateSoundIcons();

      window.requestAnimationFrame((time) => this.gameLoop(time));
    }

    setupCanvas() {
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = Math.floor(this.width * dpr);
        this.canvas.height = Math.floor(this.height * dpr);
        this.ctx.scale(dpr, dpr);
      };

      window.addEventListener('resize', resize);
      resize();
    }

    loadHighScores() {
      try {
        const key = `arcadeverse_ff_highscore_${this.mode.toLowerCase()}`;
        const val = localStorage.getItem(key);
        this.bestScore = val ? parseInt(val, 10) || 0 : 0;
        this.hudBest.textContent = this.bestScore.toLocaleString();
        this.menuBestScore.textContent = this.bestScore.toLocaleString();
      } catch (e) {
        this.bestScore = 0;
      }
    }

    saveHighScore() {
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          const key = `arcadeverse_ff_highscore_${this.mode.toLowerCase()}`;
          localStorage.setItem(key, JSON.stringify(this.bestScore));
        } catch (e) {}
      }
    }

    updateSoundIcons() {
      if (this.sound.isMuted) {
        this.iconVolOn.classList.add('hidden');
        this.iconVolOff.classList.remove('hidden');
      } else {
        this.iconVolOn.classList.remove('hidden');
        this.iconVolOff.classList.add('hidden');
      }
    }

    setupEvents() {
      // Mode selection buttons
      const modeButtons = document.querySelectorAll('.mode-card');
      modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.sound.playClick();
          modeButtons.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-checked', 'true');
          this.mode = btn.dataset.mode;
          this.hudModeBadge.textContent = this.mode;
          this.loadHighScores();
        });
      });

      // Menu Actions
      document.getElementById('btn-play').addEventListener('click', () => {
        this.sound.playClick();
        this.startRun();
      });

      document.getElementById('btn-how-to-play').addEventListener('click', () => {
        this.sound.playClick();
        this.screenHow.classList.remove('hidden');
      });

      document.getElementById('btn-close-how').addEventListener('click', () => {
        this.sound.playClick();
        this.screenHow.classList.add('hidden');
      });

      document.getElementById('btn-back-from-how').addEventListener('click', () => {
        this.sound.playClick();
        this.screenHow.classList.add('hidden');
      });

      // Pause & Resume
      this.btnPauseToggle.addEventListener('click', () => {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      });

      document.getElementById('btn-resume').addEventListener('click', () => {
        this.sound.playClick();
        this.resumeGame();
      });

      document.getElementById('btn-restart-pause').addEventListener('click', () => {
        this.sound.playClick();
        this.startRun();
      });

      document.getElementById('btn-menu-pause').addEventListener('click', () => {
        this.sound.playClick();
        this.openMenu();
      });

      // Game Over Actions
      document.getElementById('btn-play-again').addEventListener('click', () => {
        this.sound.playClick();
        this.startRun();
      });

      document.getElementById('btn-menu-from-over').addEventListener('click', () => {
        this.sound.playClick();
        this.openMenu();
      });

      // Sound Toggle Button
      this.btnSoundToggle.addEventListener('click', () => {
        this.sound.setMute(!this.sound.isMuted);
        this.updateSoundIcons();
        if (!this.sound.isMuted) this.sound.playClick();
      });

      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          if (this.state === 'PLAYING') this.pauseGame();
          else if (this.state === 'PAUSED') this.resumeGame();
        }
      });

      // Pointer Slicing Handling
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.sound.ensureContext();
        this.isPointerDown = true;
        const pos = getPos(e);
        this.lastPointer = pos;
        this.trail.addPoint(pos.x, pos.y);
        this.currentSwipeFruits = [];
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.isPointerDown) return;
        e.preventDefault();
        const pos = getPos(e);
        this.trail.addPoint(pos.x, pos.y);

        if (this.lastPointer) {
          this.sound.playSwipe();
          this.checkSliceCollisions(this.lastPointer, pos);
        }
        this.lastPointer = pos;
      });

      const onPointerEnd = (e) => {
        e.preventDefault();
        this.isPointerDown = false;
        this.lastPointer = null;
        this.evaluateSwipeCombo();
      };

      this.canvas.addEventListener('pointerup', onPointerEnd);
      this.canvas.addEventListener('pointercancel', onPointerEnd);

      // ArcadeVerse Bridge
      window.addEventListener('message', (e) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'ARCADEVERSE_PAUSE') {
          if (this.state === 'PLAYING') this.pauseGame();
        } else if (e.data.type === 'ARCADEVERSE_RESUME') {
          if (this.state === 'PAUSED') this.resumeGame();
        } else if (e.data.type === 'ARCADEVERSE_TEARDOWN') {
          this.pauseGame();
          this.sound.setMute(true);
        } else if (e.data.type === 'ARCADEVERSE_VOLUME_SYNC') {
          if (typeof e.data.volume === 'number') this.sound.setVolume(e.data.volume);
          if (typeof e.data.muted === 'boolean') {
            this.sound.setMute(e.data.muted);
            this.updateSoundIcons();
          }
        }
      });
    }

    startRun() {
      this.score = 0;
      this.lives = 3;
      this.totalSliced = 0;
      this.highestCombo = 0;
      this.gameTimeRemaining = this.mode === 'ARCADE' ? 60 : 90;
      this.spawnTimer = 0.5;
      this.waveCounter = 0;
      this.activeBuffs = { freeze: 0, double: 0, shield: false };

      this.fruits = [];
      this.halves = [];
      this.bombs = [];
      this.powerups = [];
      this.particles.clear();
      this.trail.clear();

      this.updateHUD();

      // Configure HUD modes
      if (this.mode === 'CLASSIC') {
        this.hudLives.classList.remove('hidden');
        this.hudTimerContainer.classList.add('hidden');
        this.renderLives();
      } else {
        this.hudLives.classList.add('hidden');
        this.hudTimerContainer.classList.remove('hidden');
      }

      this.screenMenu.classList.remove('active');
      this.screenMenu.classList.add('hidden');
      this.screenPause.classList.add('hidden');
      this.screenGameOver.classList.add('hidden');
      this.hud.classList.remove('hidden');

      this.state = 'PLAYING';
    }

    pauseGame() {
      if (this.state !== 'PLAYING') return;
      this.state = 'PAUSED';
      this.screenPause.classList.remove('hidden');
      this.screenPause.classList.add('active');
    }

    resumeGame() {
      if (this.state !== 'PAUSED') return;
      this.screenPause.classList.add('hidden');
      this.screenPause.classList.remove('active');
      this.lastTime = performance.now();
      this.state = 'PLAYING';
    }

    openMenu() {
      this.state = 'MENU';
      this.screenMenu.classList.remove('hidden');
      this.screenMenu.classList.add('active');
      this.screenPause.classList.add('hidden');
      this.screenGameOver.classList.add('hidden');
      this.hud.classList.add('hidden');
      this.loadHighScores();
    }

    endGame(reason) {
      this.state = 'GAMEOVER';
      this.saveHighScore();
      this.sound.playGameOver();

      this.gameOverReason.textContent = reason;
      this.resultFinalScore.textContent = this.score.toLocaleString();
      this.resultBestScore.textContent = this.bestScore.toLocaleString();
      this.resultSlicedCount.textContent = this.totalSliced.toLocaleString();
      this.resultMaxCombo.textContent = this.highestCombo.toLocaleString();

      this.screenGameOver.classList.remove('hidden');
      this.screenGameOver.classList.add('active');

      // Post score to ArcadeVerse hub
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_SCORE_SUBMIT',
          game: 'fruit-fury',
          score: this.score,
          mode: this.mode
        }, '*');
      }
    }

    renderLives() {
      const strikeBoxes = this.hudLives.querySelectorAll('.strike-box');
      strikeBoxes.forEach((box, idx) => {
        if (idx < this.lives) {
          box.classList.remove('lost');
        } else {
          box.classList.add('lost');
        }
      });
    }

    loseLife(reason = 'Missed Fruit') {
      if (this.mode !== 'CLASSIC') return;
      this.lives--;
      this.sound.playLifeLost();
      this.triggerFlash('flash-red');
      this.renderLives();

      if (this.lives <= 0) {
        this.endGame(reason);
      }
    }

    triggerFlash(className = 'flash-red') {
      this.screenFlash.className = `screen-flash ${className}`;
      setTimeout(() => {
        this.screenFlash.className = 'screen-flash';
      }, 100);
    }

    updateHUD() {
      this.hudScore.textContent = this.score.toLocaleString();

      if (this.mode === 'ARCADE' || this.mode === 'ZEN') {
        this.hudTimer.textContent = `${Math.ceil(this.gameTimeRemaining)}s`;
      }

      // Update Buff Badges
      this.hudBuffs.innerHTML = '';
      if (this.activeBuffs.freeze > 0) {
        const badge = document.createElement('div');
        badge.className = 'buff-badge freeze';
        badge.textContent = `FREEZE ${Math.ceil(this.activeBuffs.freeze)}s`;
        this.hudBuffs.appendChild(badge);
      }
      if (this.activeBuffs.double > 0) {
        const badge = document.createElement('div');
        badge.className = 'buff-badge double';
        badge.textContent = `2X SCORE ${Math.ceil(this.activeBuffs.double)}s`;
        this.hudBuffs.appendChild(badge);
      }
      if (this.activeBuffs.shield) {
        const badge = document.createElement('div');
        badge.className = 'buff-badge shield';
        badge.textContent = 'SHIELD ACTIVE';
        this.hudBuffs.appendChild(badge);
      }
    }

    /* ===================================================================
       SPAWNING LOGIC
       =================================================================== */

    spawnFruitWave(forcedFrenzy = false) {
      this.waveCounter++;
      const count = forcedFrenzy ? 12 : Math.min(6, 2 + Math.floor(this.score / 150));

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (this.state !== 'PLAYING') return;

          const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
          const margin = this.width * 0.15;
          const x = margin + Math.random() * (this.width - margin * 2);
          const y = this.height + 40;

          // Velocity trajectory targeting upper center
          const targetX = this.width * 0.3 + Math.random() * (this.width * 0.4);
          const targetY = this.height * 0.15 + Math.random() * (this.height * 0.3);

          const vx = (targetX - x) * (0.8 + Math.random() * 0.4);
          const vy = -(720 + Math.random() * 240);
          const vRot = (Math.random() * 2 - 1) * 3;

          this.fruits.push(new Fruit(type, x, y, vx, vy, vRot));
        }, i * (forcedFrenzy ? 60 : 180));
      }

      // Occasional Bomb Spawning (Classic and Arcade only)
      if (!forcedFrenzy && this.mode !== 'ZEN') {
        const bombChance = this.mode === 'ARCADE' ? 0.45 : 0.3;
        if (Math.random() < bombChance) {
          setTimeout(() => {
            if (this.state !== 'PLAYING') return;
            const x = this.width * 0.2 + Math.random() * (this.width * 0.6);
            const vx = (Math.random() * 2 - 1) * 120;
            const vy = -(700 + Math.random() * 220);
            this.bombs.push(new Bomb(x, this.height + 40, vx, vy, (Math.random() * 2 - 1) * 4));
          }, 240);
        }
      }

      // Occasional Power-up Spawning (Arcade has higher chance)
      const powerChance = this.mode === 'ARCADE' ? 0.35 : 0.18;
      if (!forcedFrenzy && Math.random() < powerChance) {
        setTimeout(() => {
          if (this.state !== 'PLAYING') return;
          const type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
          const x = this.width * 0.25 + Math.random() * (this.width * 0.5);
          const vx = (Math.random() * 2 - 1) * 80;
          const vy = -(680 + Math.random() * 200);
          this.powerups.push(new PowerUpOrb(type, x, this.height + 40, vx, vy));
        }, 400);
      }
    }

    /* ===================================================================
       COLLISION & SLICING DETECTION
       =================================================================== */

    checkSliceCollisions(p1, p2) {
      if (this.state !== 'PLAYING') return;

      // 1. Check Fruits
      for (let i = 0; i < this.fruits.length; i++) {
        const fruit = this.fruits[i];
        if (!fruit.active || fruit.sliced) continue;

        if (checkLineCircleCollision(p1, p2, fruit, fruit.radius)) {
          this.sliceFruit(fruit, p1, p2);
        }
      }

      // 2. Check Bombs
      for (let i = 0; i < this.bombs.length; i++) {
        const bomb = this.bombs[i];
        if (!bomb.active || bomb.sliced) continue;

        if (checkLineCircleCollision(p1, p2, bomb, bomb.radius)) {
          this.sliceBomb(bomb);
        }
      }

      // 3. Check Power-ups
      for (let i = 0; i < this.powerups.length; i++) {
        const pow = this.powerups[i];
        if (!pow.active || pow.sliced) continue;

        if (checkLineCircleCollision(p1, p2, pow, pow.radius)) {
          this.slicePowerUp(pow);
        }
      }
    }

    sliceFruit(fruit, p1, p2) {
      fruit.sliced = true;
      fruit.active = false;
      this.totalSliced++;

      // Points calculation
      let points = fruit.type.points;
      if (this.activeBuffs.double > 0) points *= 2;
      this.score += points;

      // Audio & Visual FX
      this.sound.playSlice(fruit.type.pitch);
      this.particles.spawnSplatter(fruit.x, fruit.y, fruit.type.juiceColor, 20);
      this.particles.spawnText(`+${points}`, fruit.x, fruit.y - 12, fruit.type.juiceColor, 22);

      // Create Two Sliced Halves with Perpendicular Impulse
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const impulse = 180 + Math.random() * 80;
      const half1 = new FruitHalf(
        fruit.type,
        fruit.x,
        fruit.y,
        fruit.vx + nx * impulse,
        fruit.vy + ny * impulse - 60,
        fruit.angle,
        fruit.vRot + 3,
        true
      );
      const half2 = new FruitHalf(
        fruit.type,
        fruit.x,
        fruit.y,
        fruit.vx - nx * impulse,
        fruit.vy - ny * impulse - 60,
        fruit.angle,
        fruit.vRot - 3,
        false
      );

      this.halves.push(half1, half2);

      // Add to current swipe list for combo checking
      this.currentSwipeFruits.push(fruit);
      this.updateHUD();
    }

    sliceBomb(bomb) {
      bomb.sliced = true;
      bomb.active = false;

      this.sound.playBombExplosion();
      this.screenShakeTime = 0.35;
      this.particles.spawnExplosion(bomb.x, bomb.y, 45);

      if (this.activeBuffs.shield) {
        this.activeBuffs.shield = false;
        this.triggerFlash('flash-cyan');
        this.particles.spawnText('SHIELD BLOCKED BOMB!', bomb.x, bomb.y - 20, '#38bdf8', 22);
        this.updateHUD();
        return;
      }

      this.triggerFlash('flash-red');

      if (this.mode === 'CLASSIC') {
        this.loseLife('Critical Bomb Detonation!');
      } else if (this.mode === 'ARCADE') {
        this.score = Math.max(0, this.score - 50);
        this.gameTimeRemaining = Math.max(1, this.gameTimeRemaining - 10);
        this.particles.spawnText('-10s & -50 PTS', bomb.x, bomb.y - 20, '#ef4444', 24);
        this.updateHUD();
      }
    }

    slicePowerUp(pow) {
      pow.sliced = true;
      pow.active = false;

      this.sound.playPowerUp();
      this.triggerFlash('flash-gold');
      this.particles.spawnSplatter(pow.x, pow.y, pow.type.color, 25);
      this.particles.spawnText(`${pow.type.name.toUpperCase()}!`, pow.x, pow.y - 20, pow.type.color, 22);

      if (pow.type.id === 'freeze') {
        this.activeBuffs.freeze = pow.type.duration;
      } else if (pow.type.id === 'double') {
        this.activeBuffs.double = pow.type.duration;
      } else if (pow.type.id === 'frenzy') {
        this.spawnFruitWave(true);
      } else if (pow.type.id === 'shield') {
        this.activeBuffs.shield = true;
      } else if (pow.type.id === 'heart') {
        if (this.mode === 'CLASSIC' && this.lives < 3) {
          this.lives++;
          this.renderLives();
          this.particles.spawnText('+1 LIFE', pow.x, pow.y - 45, '#ef4444', 24);
        }
      }

      this.updateHUD();
    }

    evaluateSwipeCombo() {
      const count = this.currentSwipeFruits.length;
      if (count >= 3) {
        let bonus = 0;
        let title = 'NICE COMBO!';

        if (count === 3) {
          bonus = 30;
          title = 'COMBO x3';
        } else if (count === 4) {
          bonus = 50;
          title = 'GREAT COMBO x4';
        } else if (count === 5) {
          bonus = 80;
          title = 'AMAZING COMBO x5';
        } else {
          bonus = 120;
          title = 'FRUIT MASTER!';
        }

        if (this.activeBuffs.double > 0) bonus *= 2;
        this.score += bonus;
        if (count > this.highestCombo) this.highestCombo = count;

        this.sound.playCombo(count);
        this.showComboBanner(title, `+${bonus} BONUS`);
        this.updateHUD();
      }

      this.currentSwipeFruits = [];
    }

    showComboBanner(title, subtitle) {
      this.comboTitle.textContent = title;
      this.comboSub.textContent = subtitle;
      this.comboBanner.classList.remove('hidden');
      this.comboBanner.classList.add('visible');

      clearTimeout(this.comboTimeout);
      this.comboTimeout = setTimeout(() => {
        this.comboBanner.classList.remove('visible');
        setTimeout(() => {
          this.comboBanner.classList.add('hidden');
        }, 250);
      }, 1000);
    }

    /* ===================================================================
       MAIN UPDATE & RENDER LOOP
       =================================================================== */

    update(dt) {
      // Screen shake decay
      if (this.screenShakeTime > 0) {
        this.screenShakeTime -= dt;
      }

      this.trail.update();
      this.particles.update(dt);

      if (this.state !== 'PLAYING') return;

      // Update Active Power-ups Countdown
      if (this.activeBuffs.freeze > 0) {
        this.activeBuffs.freeze = Math.max(0, this.activeBuffs.freeze - dt);
      }
      if (this.activeBuffs.double > 0) {
        this.activeBuffs.double = Math.max(0, this.activeBuffs.double - dt);
      }

      const timeScale = this.activeBuffs.freeze > 0 ? 0.45 : 1.0;

      // Timer countdown for Arcade & Zen modes
      if (this.mode === 'ARCADE' || this.mode === 'ZEN') {
        this.gameTimeRemaining -= dt;
        if (this.gameTimeRemaining <= 0) {
          this.gameTimeRemaining = 0;
          this.updateHUD();
          this.endGame("Time's Up!");
          return;
        }
      }

      // Spawning updates
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnFruitWave();
        const intervalModifier = Math.max(1.1, 2.2 - this.score / 600);
        this.spawnTimer = intervalModifier;
      }

      // Update Fruits
      for (let i = this.fruits.length - 1; i >= 0; i--) {
        const fruit = this.fruits[i];
        fruit.update(dt, timeScale);

        // Check if fruit fell off bottom
        if (fruit.y > this.height + 80 && fruit.hasPeaked) {
          if (!fruit.sliced && this.mode === 'CLASSIC') {
            this.loseLife('Fruit escaped untouched');
          }
          this.fruits.splice(i, 1);
        }
      }

      // Update Halves
      for (let i = this.halves.length - 1; i >= 0; i--) {
        const half = this.halves[i];
        half.update(dt);
        if (!half.active || half.y > this.height + 100) {
          this.halves.splice(i, 1);
        }
      }

      // Update Bombs
      for (let i = this.bombs.length - 1; i >= 0; i--) {
        const bomb = this.bombs[i];
        bomb.update(dt, timeScale);
        if (bomb.y > this.height + 80) {
          this.bombs.splice(i, 1);
        }
      }

      // Update Power-ups
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pow = this.powerups[i];
        pow.update(dt);
        if (pow.y > this.height + 80) {
          this.powerups.splice(i, 1);
        }
      }

      this.updateHUD();
    }

    render() {
      this.ctx.save();
      this.ctx.clearRect(0, 0, this.width, this.height);

      // Screen Shake
      if (this.screenShakeTime > 0) {
        const mag = this.screenShakeTime * 24;
        const offsetX = (Math.random() * 2 - 1) * mag;
        const offsetY = (Math.random() * 2 - 1) * mag;
        this.ctx.translate(offsetX, offsetY);
      }

      // 1. Draw Halves
      for (let i = 0; i < this.halves.length; i++) {
        this.halves[i].draw(this.ctx);
      }

      // 2. Draw Active Fruits
      for (let i = 0; i < this.fruits.length; i++) {
        this.fruits[i].draw(this.ctx);
      }

      // 3. Draw Bombs
      for (let i = 0; i < this.bombs.length; i++) {
        this.bombs[i].draw(this.ctx);
      }

      // 4. Draw Power-Ups
      for (let i = 0; i < this.powerups.length; i++) {
        this.powerups[i].draw(this.ctx);
      }

      // 5. Draw Particles & Popups
      this.particles.draw(this.ctx);

      // 6. Draw Slice Blade Trail
      this.trail.draw(this.ctx);

      this.ctx.restore();
    }

    gameLoop(time) {
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      this.update(dt);
      this.render();

      window.requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  // Launch when DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    new FruitFuryGame();
  });

})();

