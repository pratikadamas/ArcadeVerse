/**
 * NEON BLASTER - Futuristic Cyberpunk Space Shooter
 * Pure Vanilla HTML5 Canvas & JavaScript (ES6+)
 * 100% Self-Contained, Zero External CDNs, Zero Unicode Emojis
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 * Author: Manisha Debnath (@mistu7debnath)
 */

(function () {
  'use strict';

  // ========================================================
  // CONFIGURATION & CONSTANTS
  // ========================================================
  const STORAGE_KEYS = {
    HIGH_SCORE: 'arcadeverse_neon_blaster_highscore',
    STATS: 'arcadeverse_neon_blaster_stats',
    AUDIO_MUTED: 'arcadeverse_neon_blaster_muted'
  };

  const GAME_MODES = {
    SURVIVAL: 'survival',
    TIME_ATTACK: 'timeattack',
    BOSS_RUSH: 'bossrush'
  };

  const WEAPON_TYPES = {
    BASIC: {
      id: 'basic',
      name: 'BASIC LASER',
      cooldown: 0.18,
      speed: 820,
      damage: 18,
      color: '#00f3ff',
      spread: 0,
      count: 2,
      pierce: 1
    },
    RAPID: {
      id: 'rapid',
      name: 'RAPID BLASTER',
      cooldown: 0.09,
      speed: 950,
      damage: 11,
      color: '#fbbf24',
      spread: 0.05,
      count: 2,
      pierce: 1
    },
    PLASMA: {
      id: 'plasma',
      name: 'PLASMA CANNON',
      cooldown: 0.35,
      speed: 620,
      damage: 48,
      splashRadius: 75,
      color: '#ff007f',
      spread: 0,
      count: 1,
      pierce: 1
    },
    TRIPLE: {
      id: 'triple',
      name: 'TRIPLE LASER',
      cooldown: 0.22,
      speed: 800,
      damage: 16,
      color: '#8b5cf6',
      spread: 0.28,
      count: 3,
      pierce: 1
    },
    BEAM: {
      id: 'beam',
      name: 'ENERGY BEAM',
      cooldown: 0.28,
      speed: 1200,
      damage: 32,
      color: '#3b82f6',
      spread: 0,
      count: 1,
      pierce: 4
    }
  };

  const POWERUP_TYPES = {
    HEALTH: { id: 'health', name: 'HEALTH', color: '#10b981', duration: 0 },
    SHIELD: { id: 'shield', name: 'SHIELD', color: '#00f3ff', duration: 12 },
    RAPID_FIRE: { id: 'rapid_fire', name: 'RAPID FIRE', color: '#fbbf24', duration: 10 },
    DOUBLE_DAMAGE: { id: 'double_damage', name: '2X DAMAGE', color: '#ef4444', duration: 10 },
    WEAPON_UPGRADE: { id: 'upgrade', name: 'UPGRADE', color: '#8b5cf6', duration: 0 },
    SLOW_MO: { id: 'slow_mo', name: 'SLOW-MO', color: '#06b6d4', duration: 7 },
    ENERGY: { id: 'energy', name: 'OVERDRIVE', color: '#ff007f', duration: 0 }
  };

  // ========================================================
  // PROCEDURAL WEB AUDIO SYNTHESIZER
  // ========================================================
  class SoundSynthesizer {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.muted = false;
      this.unlocked = false;

      try {
        const saved = localStorage.getItem(STORAGE_KEYS.AUDIO_MUTED);
        this.muted = saved === 'true';
      } catch (_) {}
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) {
          this.ctx = new AudioClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.26, 0);
          this.masterGain.connect(this.ctx.destination);
          this.unlocked = true;
        }
      } catch (_) {}
    }

    toggleMute() {
      this.muted = !this.muted;
      try {
        localStorage.setItem(STORAGE_KEYS.AUDIO_MUTED, String(this.muted));
      } catch (_) {}

      if (this.masterGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.26, now);
      }
      return this.muted;
    }

    playLaser(type = 'basic') {
      if (this.muted || !this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        let startFreq = 880;
        let endFreq = 220;
        let duration = 0.12;

        if (type === 'rapid') {
          startFreq = 1200;
          endFreq = 340;
          duration = 0.07;
        } else if (type === 'plasma') {
          startFreq = 320;
          endFreq = 65;
          duration = 0.22;
        } else if (type === 'beam') {
          startFreq = 1450;
          endFreq = 420;
          duration = 0.16;
        }

        osc.type = type === 'plasma' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration);
      } catch (_) {}
    }

    playExplosion(isLarge = false) {
      if (this.muted || !this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        const now = this.ctx.currentTime;
        const duration = isLarge ? 0.45 : 0.22;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-3.5 * (i / bufferSize));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isLarge ? 420 : 750, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isLarge ? 0.35 : 0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + duration);
      } catch (_) {}
    }

    playHit() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
      } catch (_) {}
    }

    playPowerup() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const start = now + idx * 0.045;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.18, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(start);
          osc.stop(start + 0.12);
        });
      } catch (_) {}
    }

    playOverdrive() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(980, now + 0.35);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
      } catch (_) {}
    }

    playWaveClear() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const chords = [523.25, 659.25, 783.99, 1046.5];
        chords.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          gain.gain.setValueAtTime(0.2, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
      } catch (_) {}
    }

    teardown() {
      if (this.ctx && typeof this.ctx.close === 'function') {
        try {
          this.ctx.close();
        } catch (_) {}
      }
      this.ctx = null;
    }
  }

  // ========================================================
  // PARTICLE SYSTEM
  // ========================================================
  class ParticlePool {
    constructor() {
      this.particles = [];
      this.maxParticles = 650;
    }

    spawn(x, y, color, count = 12, speedMult = 1, lifeMult = 1) {
      for (let i = 0; i < count; i++) {
        if (this.particles.length >= this.maxParticles) {
          this.particles.shift();
        }
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 180 + 40) * speedMult;
        const maxLife = (Math.random() * 0.4 + 0.25) * lifeMult;
        const size = Math.random() * 3.5 + 1.5;

        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: size,
          color: color,
          alpha: 1,
          life: maxLife,
          maxLife: maxLife
        });
      }
    }

    spawnTrail(x, y, color, size = 3) {
      if (this.particles.length >= this.maxParticles) return;
      this.particles.push({
        x: x + (Math.random() * 4 - 2),
        y: y + (Math.random() * 4 - 2),
        vx: (Math.random() * 20 - 10),
        vy: (Math.random() * 20 - 10),
        size: size,
        color: color,
        alpha: 0.8,
        life: 0.2,
        maxLife: 0.2
      });
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha = Math.max(0, p.life / p.maxLife);
      }
    }

    draw(ctx) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    clear() {
      this.particles.length = 0;
    }
  }

  // ========================================================
  // FLOATING TEXT SYSTEM
  // ========================================================
  class FloatingTextManager {
    constructor() {
      this.texts = [];
    }

    add(text, x, y, color = '#00f3ff', size = 14) {
      this.texts.push({
        text: text,
        x: x,
        y: y,
        color: color,
        size: size,
        alpha: 1,
        life: 0.75,
        maxLife: 0.75
      });
    }

    update(dt) {
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        if (t.life <= 0) {
          this.texts.splice(i, 1);
          continue;
        }
        t.y -= 45 * dt;
        t.alpha = Math.max(0, t.life / t.maxLife);
      }
    }

    draw(ctx) {
      ctx.save();
      for (let i = 0; i < this.texts.length; i++) {
        const t = this.texts[i];
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 8;
        ctx.font = `800 ${t.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.restore();
    }

    clear() {
      this.texts.length = 0;
    }
  }

  // ========================================================
  // STARFIELD BACKGROUND (Multi-Layer Parallax)
  // ========================================================
  class Starfield {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.stars = [];
      this.nebulae = [];
      this.initStars();
    }

    resize(w, h) {
      this.width = w;
      this.height = h;
      this.initStars();
    }

    initStars() {
      this.stars.length = 0;
      const count = 160;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: Math.random() * 1.8 + 0.4,
          speed: Math.random() * 45 + 15,
          alpha: Math.random() * 0.8 + 0.2,
          color: Math.random() > 0.65 ? '#00f3ff' : (Math.random() > 0.5 ? '#ff007f' : '#ffffff')
        });
      }

      this.nebulae = [
        { x: this.width * 0.2, y: this.height * 0.3, radius: 240, color: 'rgba(139, 92, 246, 0.08)' },
        { x: this.width * 0.8, y: this.height * 0.7, radius: 280, color: 'rgba(0, 243, 255, 0.06)' },
        { x: this.width * 0.5, y: this.height * 0.85, radius: 220, color: 'rgba(255, 0, 127, 0.07)' }
      ];
    }

    update(dt) {
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.y += s.speed * dt;
        if (s.y > this.height) {
          s.y = 0;
          s.x = Math.random() * this.width;
        }
      }
    }

    draw(ctx) {
      // Draw Nebulae
      for (let i = 0; i < this.nebulae.length; i++) {
        const neb = this.nebulae[i];
        const grad = ctx.createRadialGradient(neb.x, neb.y, 10, neb.x, neb.y, neb.radius);
        grad.addColorStop(0, neb.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Stars
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ========================================================
  // PROJECTILE SYSTEM
  // ========================================================
  class Projectile {
    constructor(x, y, vx, vy, weapon, isEnemy = false) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.weapon = weapon;
      this.isEnemy = isEnemy;
      this.damage = weapon.damage || 15;
      this.color = weapon.color || (isEnemy ? '#ff0055' : '#00f3ff');
      this.radius = weapon.radius || (isEnemy ? 4.5 : 4);
      this.pierce = weapon.pierce || 1;
      this.splashRadius = weapon.splashRadius || 0;
      this.isDead = false;
      this.life = 3.5;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.isDead = true;
    }

    draw(ctx) {
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = this.color;

      if (this.weapon.id === 'plasma') {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.weapon.id === 'beam') {
        const angle = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.fillRect(-16, -3, 32, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-12, -1.5, 24, 3);
      } else {
        const angle = Math.atan2(this.vy, this.vx);
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ========================================================
  // POWER-UP ENTITY
  // ========================================================
  class PowerUp {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.radius = 16;
      this.vy = 28;
      this.life = 14;
      this.isDead = false;
      this.pulse = 0;
    }

    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt;
      this.pulse += dt * 4;
      if (this.life <= 0) this.isDead = true;
    }

    draw(ctx) {
      ctx.save();
      const scale = 1 + Math.sin(this.pulse) * 0.12;
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);

      ctx.shadowColor = this.type.color;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = this.type.color;
      ctx.lineWidth = 2.5;

      // Outer Rotating Hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + this.pulse * 0.5;
        const hx = Math.cos(a) * this.radius;
        const hy = Math.sin(a) * this.radius;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 16, 32, 0.85)';
      ctx.fill();
      ctx.stroke();

      // Inner Symbol
      ctx.fillStyle = this.type.color;
      if (this.type.id === 'health') {
        // Cross Plus Shape
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else if (this.type.id === 'shield') {
        // Shield Shape
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(6, -2);
        ctx.lineTo(4, 7);
        ctx.lineTo(0, 9);
        ctx.lineTo(-4, 7);
        ctx.lineTo(-6, -2);
        ctx.closePath();
        ctx.fill();
      } else if (this.type.id === 'rapid_fire') {
        // Dual Lightning Bolts
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(-3, 0);
        ctx.lineTo(1, 0);
        ctx.lineTo(-2, 8);
        ctx.lineTo(4, -1);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();
      } else if (this.type.id === 'double_damage') {
        // Dual Chevrons
        ctx.beginPath();
        ctx.moveTo(-7, -4); ctx.lineTo(0, -8); ctx.lineTo(7, -4);
        ctx.moveTo(-7, 3); ctx.lineTo(0, -1); ctx.lineTo(7, 3);
        ctx.stroke();
      } else if (this.type.id === 'upgrade') {
        // Star Chevron
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(7, 6); ctx.lineTo(0, 2); ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.fill();
      } else if (this.type.id === 'slow_mo') {
        // Chrono Circle Ring
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(-1, -5, 2, 6);
        ctx.fillRect(-1, -1, 5, 2);
      } else {
        // Energy Bolt (Overdrive)
        ctx.beginPath();
        ctx.moveTo(3, -7); ctx.lineTo(-4, 1); ctx.lineTo(1, 1); ctx.lineTo(-2, 7); ctx.lineTo(5, -1); ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ========================================================
  // PLAYER SPACESHIP
  // ========================================================
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.radius = 18;
      this.angle = -Math.PI / 2;
      this.speed = 360;
      this.friction = 0.88;

      this.maxHp = 100;
      this.hp = 100;
      this.shield = 0;
      this.maxShield = 100;

      this.weapon = WEAPON_TYPES.BASIC;
      this.weaponTier = 1;
      this.shootCooldown = 0;

      // Special Ability (NEON OVERDRIVE)
      this.overdriveEnergy = 0;
      this.isOverdriveActive = false;
      this.overdriveTimer = 0;

      // Invulnerability after damage
      this.invulnerableTimer = 0;

      // Active Buffs
      this.buffs = {
        rapidFire: 0,
        doubleDamage: 0,
        slowMo: 0
      };
    }

    reset(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.hp = this.maxHp;
      this.shield = 0;
      this.weapon = WEAPON_TYPES.BASIC;
      this.weaponTier = 1;
      this.shootCooldown = 0;
      this.overdriveEnergy = 0;
      this.isOverdriveActive = false;
      this.overdriveTimer = 0;
      this.invulnerableTimer = 0;
      this.buffs.rapidFire = 0;
      this.buffs.doubleDamage = 0;
      this.buffs.slowMo = 0;
    }

    upgradeWeapon() {
      const keys = Object.keys(WEAPON_TYPES);
      const nextIndex = Math.min(keys.length - 1, this.weaponTier);
      this.weapon = WEAPON_TYPES[keys[nextIndex].toUpperCase()];
      this.weaponTier = Math.min(5, this.weaponTier + 1);
    }

    activateOverdrive(soundEngine, particlePool) {
      if (this.overdriveEnergy < 100 || this.isOverdriveActive) return false;
      this.isOverdriveActive = true;
      this.overdriveTimer = 5.0;
      this.overdriveEnergy = 0;

      if (soundEngine) soundEngine.playOverdrive();
      if (particlePool) {
        particlePool.spawn(this.x, this.y, '#ff007f', 48, 2.2, 1.5);
        particlePool.spawn(this.x, this.y, '#00f3ff', 36, 1.8, 1.2);
      }
      return true;
    }

    takeDamage(amount, soundEngine, particlePool) {
      if (this.invulnerableTimer > 0 || this.isOverdriveActive) return false;

      let remaining = amount;
      if (this.shield > 0) {
        if (this.shield >= remaining) {
          this.shield -= remaining;
          remaining = 0;
        } else {
          remaining -= this.shield;
          this.shield = 0;
        }
      }

      this.hp -= remaining;
      this.invulnerableTimer = 0.85;

      if (soundEngine) soundEngine.playHit();
      if (particlePool) particlePool.spawn(this.x, this.y, '#ef4444', 16, 1.2);

      return this.hp <= 0;
    }

    update(dt, input, canvasWidth, canvasHeight, particlePool) {
      // Movement acceleration
      let moveX = 0;
      let moveY = 0;

      if (input.keys['KeyW'] || input.keys['ArrowUp']) moveY -= 1;
      if (input.keys['KeyS'] || input.keys['ArrowDown']) moveY += 1;
      if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 1;
      if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;

      // Virtual Joystick touch input
      if (input.joystick.active) {
        moveX = input.joystick.dx;
        moveY = input.joystick.dy;
      }

      const len = Math.hypot(moveX, moveY);
      if (len > 0) {
        const speedMult = this.isOverdriveActive ? 1.45 : 1.0;
        const currentSpeed = this.speed * speedMult;
        this.vx += (moveX / (input.joystick.active ? 1 : len)) * currentSpeed * 6 * dt;
        this.vy += (moveY / (input.joystick.active ? 1 : len)) * currentSpeed * 6 * dt;

        // Exhaust particles
        if (particlePool && Math.random() < 0.6) {
          const rearX = this.x - Math.cos(this.angle) * 16;
          const rearY = this.y - Math.sin(this.angle) * 16;
          particlePool.spawnTrail(rearX, rearY, this.isOverdriveActive ? '#ff007f' : '#00f3ff', 3);
        }
      }

      this.vx *= Math.pow(this.friction, dt * 60);
      this.vy *= Math.pow(this.friction, dt * 60);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Boundary Clamping
      const pad = this.radius + 6;
      this.x = Math.max(pad, Math.min(canvasWidth - pad, this.x));
      this.y = Math.max(pad + 50, Math.min(canvasHeight - pad - 10, this.y));

      // Aim angle
      if (input.isTouchDevice && input.joystick.active && Math.hypot(input.joystick.dx, input.joystick.dy) > 0.1) {
        this.angle = Math.atan2(input.joystick.dy, input.joystick.dx);
      } else {
        this.angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
      }

      // Timers & Buffs
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

      if (this.isOverdriveActive) {
        this.overdriveTimer -= dt;
        if (this.overdriveTimer <= 0) {
          this.isOverdriveActive = false;
        }
      }

      if (this.buffs.rapidFire > 0) this.buffs.rapidFire -= dt;
      if (this.buffs.doubleDamage > 0) this.buffs.doubleDamage -= dt;
      if (this.buffs.slowMo > 0) this.buffs.slowMo -= dt;
    }

    shoot(projectiles, soundEngine) {
      if (this.shootCooldown > 0) return false;

      let cd = this.weapon.cooldown;
      if (this.buffs.rapidFire > 0) cd *= 0.5;
      if (this.isOverdriveActive) cd *= 0.45;
      this.shootCooldown = cd;

      const damageMult = (this.buffs.doubleDamage > 0 ? 2.0 : 1.0) * (this.isOverdriveActive ? 1.75 : 1.0);
      const count = this.isOverdriveActive ? Math.max(3, this.weapon.count + 2) : this.weapon.count;
      const baseSpread = this.isOverdriveActive ? 0.35 : this.weapon.spread;

      const halfSpread = baseSpread / 2;
      for (let i = 0; i < count; i++) {
        let spreadAngle = 0;
        if (count > 1) {
          spreadAngle = -halfSpread + (baseSpread / (count - 1)) * i;
        }
        const finalAngle = this.angle + spreadAngle;
        const speed = this.weapon.speed;
        const vx = Math.cos(finalAngle) * speed;
        const vy = Math.sin(finalAngle) * speed;

        const tipX = this.x + Math.cos(finalAngle) * 20;
        const tipY = this.y + Math.sin(finalAngle) * 20;

        const clonedWeapon = Object.assign({}, this.weapon, {
          damage: this.weapon.damage * damageMult
        });

        projectiles.push(new Projectile(tipX, tipY, vx, vy, clonedWeapon, false));
      }

      if (soundEngine) soundEngine.playLaser(this.weapon.id);
      return true;
    }

    draw(ctx) {
      ctx.save();

      // Invulnerability flicker
      if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
        ctx.globalAlpha = 0.35;
      }

      ctx.translate(this.x, this.y);

      // Neon Overdrive Aura
      if (this.isOverdriveActive) {
        ctx.save();
        ctx.strokeStyle = '#ff007f';
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 24;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Shield Bubble
      if (this.shield > 0) {
        ctx.save();
        ctx.strokeStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 18;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
        ctx.fill();
        ctx.restore();
      }

      // Rotate to aim angle
      ctx.rotate(this.angle);

      // Ship Geometry
      ctx.shadowColor = this.isOverdriveActive ? '#ff007f' : '#00f3ff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = this.isOverdriveActive ? '#ff007f' : '#00f3ff';
      ctx.lineWidth = 2.2;
      ctx.fillStyle = '#0a1020';

      ctx.beginPath();
      ctx.moveTo(22, 0);       // Nose
      ctx.lineTo(-14, -16);    // Left wing
      ctx.lineTo(-8, -6);      // Left indent
      ctx.lineTo(-12, 0);      // Engine core
      ctx.lineTo(-8, 6);       // Right indent
      ctx.lineTo(-14, 16);     // Right wing
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit Glow
      ctx.fillStyle = this.isOverdriveActive ? '#ff007f' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(2, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Engine Thruster Glow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-11, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ========================================================
  // ENEMY CLASSES (Scout, Heavy, Swarm, Sniper, Elite)
  // ========================================================
  class Enemy {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.vx = 0;
      this.vy = 0;
      this.radius = type.radius || 15;
      this.hp = type.hp || 30;
      this.maxHp = this.hp;
      this.speed = type.speed || 160;
      this.scoreVal = type.score || 100;
      this.color = type.color || '#ff0055';
      this.isDead = false;
      this.shootTimer = Math.random() * (type.shootCooldown || 2.5);
      this.angle = 0;
      this.time = Math.random() * 10;
    }

    takeDamage(amount) {
      this.hp -= amount;
      if (this.hp <= 0) {
        this.isDead = true;
        return true;
      }
      return false;
    }

    update(dt, player, projectiles, soundEngine) {
      this.time += dt;

      // Base orientation towards player
      this.angle = Math.atan2(player.y - this.y, player.x - this.x);

      if (this.type.id === 'scout') {
        // Fast direct pursuit
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
        }
      } else if (this.type.id === 'swarm') {
        // Sinusoidal wave flight towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const wave = Math.sin(this.time * 6) * 110;

        this.vx = (dx / dist) * this.speed + perpX * wave;
        this.vy = (dy / dist) * this.speed + perpY * wave;
      } else if (this.type.id === 'heavy') {
        // Slow advance + spread shots
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 180) {
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
        } else {
          this.vx *= 0.9;
          this.vy *= 0.9;
        }

        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = this.type.shootCooldown || 2.8;
          // Fire 3 spread bolts
          for (let i = -1; i <= 1; i++) {
            const spreadAngle = this.angle + i * 0.22;
            const pSpeed = 380;
            projectiles.push(new Projectile(
              this.x, this.y,
              Math.cos(spreadAngle) * pSpeed,
              Math.sin(spreadAngle) * pSpeed,
              { damage: 14, color: '#ff0055', radius: 4 },
              true
            ));
          }
          if (soundEngine) soundEngine.playLaser('plasma');
        }
      } else if (this.type.id === 'sniper') {
        // Keeps perimeter distance + sniper rail shot
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const targetDist = 320;

        if (dist < targetDist - 30) {
          this.vx = -(dx / dist) * this.speed;
          this.vy = -(dy / dist) * this.speed;
        } else if (dist > targetDist + 30) {
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
        } else {
          // Orbit slightly
          this.vx = (-dy / dist) * (this.speed * 0.6);
          this.vy = (dx / dist) * (this.speed * 0.6);
        }

        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = this.type.shootCooldown || 3.2;
          const pSpeed = 750;
          projectiles.push(new Projectile(
            this.x, this.y,
            Math.cos(this.angle) * pSpeed,
            Math.sin(this.angle) * pSpeed,
            { damage: 26, color: '#ff00ff', radius: 4.5, id: 'beam' },
            true
          ));
          if (soundEngine) soundEngine.playLaser('beam');
        }
      } else if (this.type.id === 'elite') {
        // Advanced evasive + burst attack
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        const circleX = -dy / dist;
        const circleY = dx / dist;

        this.vx = (dx / dist) * (this.speed * 0.6) + circleX * Math.sin(this.time * 3) * 120;
        this.vy = (dy / dist) * (this.speed * 0.6) + circleY * Math.sin(this.time * 3) * 120;

        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = this.type.shootCooldown || 1.8;
          // Dual burst
          for (let i = -1; i <= 1; i += 2) {
            const spreadAngle = this.angle + i * 0.15;
            const pSpeed = 520;
            projectiles.push(new Projectile(
              this.x, this.y,
              Math.cos(spreadAngle) * pSpeed,
              Math.sin(spreadAngle) * pSpeed,
              { damage: 18, color: '#fbbf24', radius: 4 },
              true
            ));
          }
          if (soundEngine) soundEngine.playLaser('rapid');
        }
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = '#0f172a';

      if (this.type.id === 'scout') {
        // Fast Dart
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, -9);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.type.id === 'swarm') {
        // Diamond Drone
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, -8);
        ctx.lineTo(-10, 0);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.type.id === 'heavy') {
        // Armored Cruiser
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(8, -18);
        ctx.lineTo(-18, -16);
        ctx.lineTo(-12, 0);
        ctx.lineTo(-18, 16);
        ctx.lineTo(8, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff0055';
        ctx.fillRect(-2, -5, 4, 10);
      } else if (this.type.id === 'sniper') {
        // Needle Stalker
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-12, -10);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(32, 0);
        ctx.stroke();
      } else if (this.type.id === 'elite') {
        // Flagship Destroyer
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(6, -16);
        ctx.lineTo(-16, -14);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-16, 14);
        ctx.lineTo(6, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Pulsing core
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Health Bar (if damaged)
      if (this.hp < this.maxHp) {
        ctx.save();
        const barW = this.radius * 2;
        const barH = 3;
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(this.x - barW / 2, this.y - this.radius - 8, barW, barH);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - barW / 2, this.y - this.radius - 8, barW * pct, barH);
        ctx.restore();
      }
    }
  }

  // ========================================================
  // FINAL BOSS: VOID DESTROYER
  // ========================================================
  class VoidDestroyer {
    constructor(canvasWidth, canvasHeight) {
      this.canvasWidth = canvasWidth;
      this.canvasHeight = canvasHeight;
      this.x = canvasWidth / 2;
      this.y = -120;
      this.targetY = 160;
      this.radius = 65;

      this.maxHp = 1800;
      this.hp = 1800;
      this.phase = 1; // 1, 2, or 3
      this.time = 0;
      this.shootTimer = 1.0;
      this.specialTimer = 4.0;
      this.isDead = false;
      this.isEntering = true;
      this.vx = 80;
    }

    takeDamage(amount) {
      this.hp -= amount;

      // Update Phase
      const hpPct = this.hp / this.maxHp;
      if (hpPct <= 0.28) {
        this.phase = 3;
      } else if (hpPct <= 0.65) {
        this.phase = 2;
      } else {
        this.phase = 1;
      }

      if (this.hp <= 0) {
        this.isDead = true;
        return true;
      }
      return false;
    }

    update(dt, player, projectiles, enemies, soundEngine, particlePool) {
      this.time += dt;

      // Entrance animation
      if (this.isEntering) {
        this.y += 110 * dt;
        if (this.y >= this.targetY) {
          this.y = this.targetY;
          this.isEntering = false;
        }
        return;
      }

      // Horizontal patrol
      this.x += this.vx * dt;
      const pad = this.radius + 30;
      if (this.x > this.canvasWidth - pad) {
        this.x = this.canvasWidth - pad;
        this.vx = -Math.abs(this.vx);
      } else if (this.x < pad) {
        this.x = pad;
        this.vx = Math.abs(this.vx);
      }

      // Phase 3 speed boost
      if (this.phase === 3) {
        this.vx = (this.vx > 0 ? 1 : -1) * 160;
      }

      // Main Attack Timers
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.executeAttack(player, projectiles, soundEngine);
      }

      // Special Pattern Timers
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        this.executeSpecial(enemies, projectiles, soundEngine, particlePool);
      }
    }

    executeAttack(player, projectiles, soundEngine) {
      if (this.phase === 1) {
        // Dual Heavy Plasma Turrets
        this.shootTimer = 1.2;
        [-35, 35].forEach(offset => {
          const angle = Math.atan2(player.y - this.y, player.x - (this.x + offset));
          projectiles.push(new Projectile(
            this.x + offset, this.y + 30,
            Math.cos(angle) * 440, Math.sin(angle) * 440,
            { damage: 18, color: '#ff007f', radius: 6 },
            true
          ));
        });
        if (soundEngine) soundEngine.playLaser('plasma');
      } else if (this.phase === 2) {
        // Radial Bullet Rings
        this.shootTimer = 0.9;
        const bullets = 10;
        for (let i = 0; i < bullets; i++) {
          const angle = (i * Math.PI * 2) / bullets + this.time * 0.5;
          projectiles.push(new Projectile(
            this.x, this.y + 20,
            Math.cos(angle) * 360, Math.sin(angle) * 360,
            { damage: 16, color: '#ef4444', radius: 5 },
            true
          ));
        }
        if (soundEngine) soundEngine.playLaser('basic');
      } else {
        // Phase 3: Enraged Rapid Barrage
        this.shootTimer = 0.45;
        for (let i = -2; i <= 2; i++) {
          const angle = Math.atan2(player.y - this.y, player.x - this.x) + i * 0.16;
          projectiles.push(new Projectile(
            this.x + i * 15, this.y + 35,
            Math.cos(angle) * 580, Math.sin(angle) * 580,
            { damage: 20, color: '#fbbf24', radius: 5 },
            true
          ));
        }
        if (soundEngine) soundEngine.playLaser('rapid');
      }
    }

    executeSpecial(enemies, projectiles, soundEngine, particlePool) {
      if (this.phase === 2) {
        // Spawn Swarm Escorts
        this.specialTimer = 5.5;
        for (let i = -1; i <= 1; i += 2) {
          enemies.push(new Enemy(this.x + i * 70, this.y, {
            id: 'swarm',
            hp: 20,
            speed: 210,
            score: 75,
            color: '#fbbf24',
            radius: 12
          }));
        }
      } else if (this.phase === 3) {
        // EMP Shockwave Pulse
        this.specialTimer = 4.2;
        const total = 16;
        for (let i = 0; i < total; i++) {
          const angle = (i * Math.PI * 2) / total;
          projectiles.push(new Projectile(
            this.x, this.y,
            Math.cos(angle) * 420, Math.sin(angle) * 420,
            { damage: 22, color: '#ff007f', radius: 5.5, id: 'beam' },
            true
          ));
        }
        if (soundEngine) soundEngine.playExplosion(true);
        if (particlePool) particlePool.spawn(this.x, this.y, '#ff007f', 32, 2.0);
      } else {
        this.specialTimer = 5.0;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Core Glowing Aura
      const auraColor = this.phase === 3 ? '#ef4444' : (this.phase === 2 ? '#ff007f' : '#8b5cf6');
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 28;
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 3;
      ctx.fillStyle = '#060a17';

      // Dreadnought Hull
      ctx.beginPath();
      ctx.moveTo(0, 55);          // Front Tip
      ctx.lineTo(45, 25);
      ctx.lineTo(85, 35);        // Right Wing Tip
      ctx.lineTo(65, -30);
      ctx.lineTo(35, -45);
      ctx.lineTo(0, -35);         // Rear
      ctx.lineTo(-35, -45);
      ctx.lineTo(-65, -30);
      ctx.lineTo(-85, 35);       // Left Wing Tip
      ctx.lineTo(-45, 25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Plasma Cannons
      ctx.fillStyle = auraColor;
      ctx.fillRect(-38, 20, 8, 18);
      ctx.fillRect(30, 20, 8, 18);

      // Pulsing Reactor Core
      const corePulse = Math.sin(this.time * 6) * 3;
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + corePulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ========================================================
  // WAVE PROGRESSION DEFINITIONS
  // ========================================================
  const WAVE_DEFINITIONS = [
    {
      wave: 1,
      title: 'WAVE 1',
      subtitle: 'SCOUT INTRUSION',
      spawns: [
        { type: 'scout', count: 8, interval: 1.4 },
        { type: 'swarm', count: 4, interval: 2.0 }
      ]
    },
    {
      wave: 2,
      title: 'WAVE 2',
      subtitle: 'SWARM ESCALATION',
      spawns: [
        { type: 'scout', count: 10, interval: 1.2 },
        { type: 'swarm', count: 12, interval: 1.0 },
        { type: 'heavy', count: 2, interval: 4.0 }
      ]
    },
    {
      wave: 3,
      title: 'WAVE 3',
      subtitle: 'HEAVY ASSAULT',
      spawns: [
        { type: 'heavy', count: 4, interval: 2.5 },
        { type: 'scout', count: 12, interval: 1.0 },
        { type: 'sniper', count: 2, interval: 3.5 }
      ]
    },
    {
      wave: 4,
      title: 'WAVE 4',
      subtitle: 'ELITE BARRAGE',
      spawns: [
        { type: 'sniper', count: 4, interval: 2.5 },
        { type: 'elite', count: 3, interval: 3.5 },
        { type: 'heavy', count: 3, interval: 3.0 },
        { type: 'swarm', count: 14, interval: 0.8 }
      ]
    },
    {
      wave: 5,
      title: 'WAVE 5',
      subtitle: 'FLAGSHIP ENGAGEMENT',
      isBossWave: true,
      spawns: []
    }
  ];

  // ========================================================
  // MAIN GAME ENGINE
  // ========================================================
  class NeonBlasterGame {
    constructor() {
      this.canvas = document.getElementById('nb-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.sound = new SoundSynthesizer();
      this.particles = new ParticlePool();
      this.floatTexts = new FloatingTextManager();
      this.starfield = new Starfield(window.innerWidth, window.innerHeight);

      this.player = new Player(window.innerWidth / 2, window.innerHeight * 0.78);
      this.projectiles = [];
      this.enemies = [];
      this.powerups = [];
      this.boss = null;

      // Game States: 'menu', 'playing', 'paused', 'gameover', 'victory'
      this.state = 'menu';
      this.mode = GAME_MODES.SURVIVAL;

      this.score = 0;
      this.highScore = 0;
      this.kills = 0;
      this.currentWaveIndex = 0;
      this.waveTimer = 0;
      this.spawnQueue = [];
      this.isWaveClearing = false;

      // Time Attack Mode timer (3 minutes = 180s)
      this.timeAttackTimer = 180;

      // Combo System
      this.combo = 1;
      this.comboTimer = 0;
      this.comboMaxTime = 2.5;
      this.maxComboAchieved = 1;

      // Input State
      this.input = {
        keys: {},
        mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2, isDown: false },
        joystick: { active: false, startX: 0, startY: 0, dx: 0, dy: 0, touchId: null },
        fireTouchId: null,
        isTouchDevice: false
      };

      // Screen Shake
      this.shakeDuration = 0;
      this.shakeIntensity = 0;

      // Statistics
      this.stats = {
        totalKills: 0,
        maxCombo: 1,
        gamesPlayed: 0
      };

      this.lastTime = performance.now();
      this.animationFrameId = null;

      this.initDOM();
      this.initEvents();
      this.loadStorage();
      this.resizeCanvas();
      this.updateUI();

      // Lifecycle Bridge
      this.initArcadeVerseBridge();

      // Start loop
      this.loop = this.loop.bind(this);
      this.animationFrameId = requestAnimationFrame(this.loop);
    }

    initDOM() {
      this.dom = {
        score: document.getElementById('nb-hud-score'),
        best: document.getElementById('nb-hud-best'),
        waveLabel: document.getElementById('nb-wave-label'),
        modeBadge: document.getElementById('nb-mode-badge'),
        timerBadge: document.getElementById('nb-timer-badge'),
        hpNum: document.getElementById('nb-hud-hp-num'),
        hpFill: document.getElementById('nb-hud-hp-fill'),
        shieldGroup: document.getElementById('nb-group-shield'),
        shieldNum: document.getElementById('nb-hud-shield-num'),
        shieldFill: document.getElementById('nb-hud-shield-fill'),
        odNum: document.getElementById('nb-hud-od-num'),
        odFill: document.getElementById('nb-hud-od-fill'),
        odPrompt: document.getElementById('nb-od-prompt'),
        weaponName: document.getElementById('nb-hud-weapon-name'),
        weaponTier: document.getElementById('nb-hud-weapon-tier'),
        buffsTray: document.getElementById('nb-buffs-tray'),
        comboBox: document.getElementById('nb-combo-box'),
        comboNum: document.getElementById('nb-combo-num'),
        comboTimerFill: document.getElementById('nb-combo-timer-fill'),
        bossContainer: document.getElementById('nb-boss-container'),
        bossName: document.getElementById('nb-boss-name'),
        bossPhase: document.getElementById('nb-boss-phase'),
        bossHpText: document.getElementById('nb-boss-hp-text'),
        bossHpFill: document.getElementById('nb-boss-bar-fill'),
        announcementOverlay: document.getElementById('nb-announcement-overlay'),
        announcementTitle: document.getElementById('nb-announcement-title'),
        announcementSubtitle: document.getElementById('nb-announcement-subtitle'),
        modalMenu: document.getElementById('nb-modal-menu'),
        modalBriefing: document.getElementById('nb-modal-briefing'),
        modalPause: document.getElementById('nb-modal-pause'),
        modalGameOver: document.getElementById('nb-modal-gameover'),
        modalVictory: document.getElementById('nb-modal-victory'),
        menuHighScore: document.getElementById('nb-menu-high-score'),
        menuKills: document.getElementById('nb-menu-enemies-purged'),
        menuMaxCombo: document.getElementById('nb-menu-max-combo'),
        goScore: document.getElementById('nb-go-score'),
        goKills: document.getElementById('nb-go-kills'),
        goWaves: document.getElementById('nb-go-waves'),
        goCombo: document.getElementById('nb-go-combo'),
        goNewHigh: document.getElementById('nb-go-new-high'),
        vicScore: document.getElementById('nb-vic-score'),
        vicKills: document.getElementById('nb-vic-kills'),
        vicTime: document.getElementById('nb-vic-time'),
        vicRank: document.getElementById('nb-vic-rank'),
        btnAudio: document.getElementById('nb-btn-audio'),
        soundOnIcon: document.querySelector('.nb-icon-sound-on'),
        soundOffIcon: document.querySelector('.nb-icon-sound-off'),
        btnPause: document.getElementById('nb-btn-pause'),
        btnStart: document.getElementById('nb-btn-start'),
        btnHowToPlay: document.getElementById('nb-btn-how-to-play'),
        btnCloseBriefing: document.getElementById('nb-btn-close-briefing'),
        btnBriefingOk: document.getElementById('nb-btn-briefing-ok'),
        btnResume: document.getElementById('nb-btn-resume'),
        btnRestart: document.getElementById('nb-btn-restart'),
        btnMenu: document.getElementById('nb-btn-menu'),
        btnGoRetry: document.getElementById('nb-btn-go-retry'),
        btnGoMenu: document.getElementById('nb-btn-go-menu'),
        btnVicRestart: document.getElementById('nb-btn-vic-restart'),
        btnVicMenu: document.getElementById('nb-btn-vic-menu'),
        mobileControls: document.getElementById('nb-mobile-controls'),
        joystickZone: document.getElementById('nb-touch-joystick-zone'),
        joystickBase: document.getElementById('nb-joystick-base'),
        joystickThumb: document.getElementById('nb-joystick-thumb'),
        touchFire: document.getElementById('nb-touch-fire'),
        touchOd: document.getElementById('nb-touch-od'),
        modeCards: document.querySelectorAll('.nb-mode-card')
      };
    }

    initEvents() {
      // Window Resize
      window.addEventListener('resize', () => {
        this.resizeCanvas();
      });

      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        this.sound.init();
        this.input.keys[e.code] = true;

        // Prevent browser scrolling on gaming keys
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
          e.preventDefault();
        }

        // Pause Shortcut
        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.state === 'playing') this.pauseGame();
          else if (this.state === 'paused') this.resumeGame();
        }

        // Special Ability (Shift)
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          if (this.state === 'playing') {
            this.player.activateOverdrive(this.sound, this.particles);
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        this.input.keys[e.code] = false;
      });

      // Mouse Aiming & Shooting
      window.addEventListener('mousemove', (e) => {
        this.input.mouse.x = e.clientX;
        this.input.mouse.y = e.clientY;
      });

      window.addEventListener('mousedown', (e) => {
        this.sound.init();
        if (e.button === 0) {
          this.input.mouse.isDown = true;
        } else if (e.button === 2) {
          // Right-click activates Overdrive
          e.preventDefault();
          if (this.state === 'playing') {
            this.player.activateOverdrive(this.sound, this.particles);
          }
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
          this.input.mouse.isDown = false;
        }
      });

      window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      // Mode Selector Cards
      this.dom.modeCards.forEach(card => {
        card.addEventListener('click', () => {
          this.dom.modeCards.forEach(c => c.classList.remove('nb-mode-active'));
          card.classList.add('nb-mode-active');
          this.mode = card.getAttribute('data-mode') || GAME_MODES.SURVIVAL;
        });
      });

      // Button Listeners
      this.dom.btnStart.addEventListener('click', () => this.startGame(this.mode));
      this.dom.btnHowToPlay.addEventListener('click', () => this.showBriefing(true));
      this.dom.btnCloseBriefing.addEventListener('click', () => this.showBriefing(false));
      this.dom.btnBriefingOk.addEventListener('click', () => this.showBriefing(false));

      this.dom.btnAudio.addEventListener('click', () => {
        this.sound.init();
        const isMuted = this.sound.toggleMute();
        this.updateAudioIcons(isMuted);
      });

      this.dom.btnPause.addEventListener('click', () => {
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused') this.resumeGame();
      });

      this.dom.btnResume.addEventListener('click', () => this.resumeGame());
      this.dom.btnRestart.addEventListener('click', () => this.startGame(this.mode));
      this.dom.btnMenu.addEventListener('click', () => this.showMenu());

      this.dom.btnGoRetry.addEventListener('click', () => this.startGame(this.mode));
      this.dom.btnGoMenu.addEventListener('click', () => this.showMenu());

      this.dom.btnVicRestart.addEventListener('click', () => this.startGame(this.mode));
      this.dom.btnVicMenu.addEventListener('click', () => this.showMenu());

      // Mobile Touch Handling
      this.initTouchControls();
    }

    initTouchControls() {
      const zone = this.dom.joystickZone;
      const thumb = this.dom.joystickThumb;
      const maxRadius = 45;

      const handleTouchStart = (e) => {
        this.input.isTouchDevice = true;
        this.sound.init();
        const touch = e.changedTouches[0];
        this.input.joystick.active = true;
        this.input.joystick.touchId = touch.identifier;
        const rect = zone.getBoundingClientRect();
        this.input.joystick.startX = rect.left + rect.width / 2;
        this.input.joystick.startY = rect.top + rect.height / 2;
      };

      const handleTouchMove = (e) => {
        if (!this.input.joystick.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.input.joystick.touchId) {
            let dx = t.clientX - this.input.joystick.startX;
            let dy = t.clientY - this.input.joystick.startY;
            const dist = Math.hypot(dx, dy);

            if (dist > maxRadius) {
              dx = (dx / dist) * maxRadius;
              dy = (dy / dist) * maxRadius;
            }

            thumb.style.transform = `translate(${dx}px, ${dy}px)`;
            this.input.joystick.dx = dx / maxRadius;
            this.input.joystick.dy = dy / maxRadius;
            break;
          }
        }
      };

      const handleTouchEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.input.joystick.touchId) {
            this.input.joystick.active = false;
            this.input.joystick.dx = 0;
            this.input.joystick.dy = 0;
            this.input.joystick.touchId = null;
            thumb.style.transform = 'translate(0px, 0px)';
            break;
          }
        }
      };

      zone.addEventListener('touchstart', handleTouchStart, { passive: false });
      zone.addEventListener('touchmove', handleTouchMove, { passive: false });
      zone.addEventListener('touchend', handleTouchEnd);
      zone.addEventListener('touchcancel', handleTouchEnd);

      // Fire Touch Button
      this.dom.touchFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.input.isTouchDevice = true;
        this.sound.init();
        this.input.mouse.isDown = true;
      });

      this.dom.touchFire.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.input.mouse.isDown = false;
      });

      // Overdrive Touch Button
      this.dom.touchOd.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'playing') {
          this.player.activateOverdrive(this.sound, this.particles);
        }
      });
    }

    initArcadeVerseBridge() {
      // Listen for parent iframe postMessages
      window.addEventListener('message', (e) => {
        if (!e || !e.data || typeof e.data !== 'object') return;
        const type = e.data.type || '';

        if (type === 'ARCADEVERSE_PAUSE') {
          if (this.state === 'playing') this.pauseGame();
        } else if (type === 'ARCADEVERSE_RESUME') {
          if (this.state === 'paused') this.resumeGame();
        } else if (type === 'ARCADEVERSE_TEARDOWN') {
          this.teardown();
        } else if (type === 'ARCADEVERSE_VOLUME_SYNC' || type === 'ARCADEVERSE_AUDIO_CONFIG') {
          if (typeof e.data.muted === 'boolean' && this.sound) {
            if (this.sound.muted !== e.data.muted) {
              this.sound.toggleMute();
              this.updateAudioIcons(this.sound.muted);
            }
          }
        }
      });

      // Register with global SDK if bundled
      if (window.ArcadeVerse) {
        if (typeof window.ArcadeVerse.onPause === 'function') {
          window.ArcadeVerse.onPause(() => this.pauseGame());
        }
        if (typeof window.ArcadeVerse.onResume === 'function') {
          window.ArcadeVerse.onResume(() => this.resumeGame());
        }
        if (typeof window.ArcadeVerse.onTeardown === 'function') {
          window.ArcadeVerse.onTeardown(() => this.teardown());
        }
      }
    }

    resizeCanvas() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.starfield.resize(this.canvas.width, this.canvas.height);

      if (this.boss) {
        this.boss.canvasWidth = this.canvas.width;
        this.boss.canvasHeight = this.canvas.height;
      }
    }

    loadStorage() {
      try {
        const savedScore = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
        if (savedScore) {
          const parsed = parseInt(savedScore, 10);
          if (!isNaN(parsed)) this.highScore = parsed;
        }

        const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);
        if (savedStats) {
          const parsedStats = JSON.parse(savedStats);
          if (parsedStats && typeof parsedStats === 'object') {
            this.stats = Object.assign(this.stats, parsedStats);
          }
        }
      } catch (_) {}

      this.updateAudioIcons(this.sound.muted);
      this.dom.menuHighScore.textContent = this.highScore.toLocaleString();
      this.dom.menuKills.textContent = this.stats.totalKills.toLocaleString();
      this.dom.menuMaxCombo.textContent = `x${this.stats.maxCombo || 1}`;
      this.dom.best.textContent = this.highScore.toLocaleString();
    }

    saveStorage() {
      try {
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(this.highScore));
        }

        this.stats.totalKills += this.kills;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.maxComboAchieved);
        this.stats.gamesPlayed += 1;
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(this.stats));
      } catch (_) {}
    }

    updateAudioIcons(muted) {
      if (muted) {
        this.dom.soundOnIcon.classList.add('nb-hidden');
        this.dom.soundOffIcon.classList.remove('nb-hidden');
      } else {
        this.dom.soundOnIcon.classList.remove('nb-hidden');
        this.dom.soundOffIcon.classList.add('nb-hidden');
      }
    }

    triggerShake(intensity = 8, duration = 0.25) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
    }

    showBriefing(show) {
      if (show) {
        this.dom.modalBriefing.classList.remove('nb-hidden');
      } else {
        this.dom.modalBriefing.classList.add('nb-hidden');
      }
    }

    showMenu() {
      this.state = 'menu';
      this.saveStorage();
      this.dom.modalMenu.classList.remove('nb-hidden');
      this.dom.modalPause.classList.add('nb-hidden');
      this.dom.modalGameOver.classList.add('nb-hidden');
      this.dom.modalVictory.classList.add('nb-hidden');
      this.dom.announcementOverlay.classList.add('nb-hidden');
      this.loadStorage();
    }

    startGame(mode = GAME_MODES.SURVIVAL) {
      this.sound.init();
      this.state = 'playing';
      this.mode = mode;

      this.score = 0;
      this.kills = 0;
      this.combo = 1;
      this.comboTimer = 0;
      this.maxComboAchieved = 1;
      this.currentWaveIndex = 0;
      this.isWaveClearing = false;
      this.timeAttackTimer = 180;

      this.projectiles.length = 0;
      this.enemies.length = 0;
      this.powerups.length = 0;
      this.boss = null;
      this.particles.clear();
      this.floatTexts.clear();

      this.player.reset(this.canvas.width / 2, this.canvas.height * 0.78);

      // Hide all modals
      this.dom.modalMenu.classList.add('nb-hidden');
      this.dom.modalPause.classList.add('nb-hidden');
      this.dom.modalGameOver.classList.add('nb-hidden');
      this.dom.modalVictory.classList.add('nb-hidden');
      this.dom.modalBriefing.classList.add('nb-hidden');

      // Update Mode Badges
      if (this.mode === GAME_MODES.TIME_ATTACK) {
        this.dom.modeBadge.textContent = 'TIME ATTACK';
        this.dom.timerBadge.classList.remove('nb-hidden');
      } else if (this.mode === GAME_MODES.BOSS_RUSH) {
        this.dom.modeBadge.textContent = 'BOSS RUSH';
        this.dom.timerBadge.classList.add('nb-hidden');
      } else {
        this.dom.modeBadge.textContent = 'SURVIVAL';
        this.dom.timerBadge.classList.add('nb-hidden');
      }

      if (this.mode === GAME_MODES.BOSS_RUSH) {
        this.initBossRush();
      } else {
        this.startWave(0);
      }

      this.updateUI();
    }

    initBossRush() {
      this.dom.waveLabel.textContent = 'BOSS RUSH';
      this.dom.bossContainer.classList.remove('nb-hidden');
      this.boss = new VoidDestroyer(this.canvas.width, this.canvas.height);
      this.boss.maxHp = 2400;
      this.boss.hp = 2400;

      // Spawn 2 Elite escorts
      for (let i = -1; i <= 1; i += 2) {
        this.enemies.push(new Enemy(this.canvas.width / 2 + i * 140, 100, {
          id: 'elite',
          hp: 80,
          speed: 160,
          score: 350,
          color: '#fbbf24',
          shootCooldown: 1.5,
          radius: 18
        }));
      }

      this.announceWave('BOSS ENGAGEMENT', 'VOID DESTROYER DETECTED');
    }

    startWave(index) {
      if (index >= WAVE_DEFINITIONS.length) {
        this.victory();
        return;
      }

      this.currentWaveIndex = index;
      const def = WAVE_DEFINITIONS[index];
      this.dom.waveLabel.textContent = `WAVE ${def.wave}`;

      if (def.isBossWave) {
        this.dom.bossContainer.classList.remove('nb-hidden');
        this.boss = new VoidDestroyer(this.canvas.width, this.canvas.height);
        this.announceWave('FINAL WAVE', 'VOID DESTROYER INCOMING');
      } else {
        this.dom.bossContainer.classList.add('nb-hidden');
        this.spawnQueue.length = 0;

        def.spawns.forEach(group => {
          for (let i = 0; i < group.count; i++) {
            this.spawnQueue.push({
              type: group.type,
              delay: i * group.interval + Math.random() * 0.5
            });
          }
        });

        this.spawnQueue.sort((a, b) => a.delay - b.delay);
        this.waveTimer = 0;
        this.announceWave(def.title, def.subtitle);
      }
    }

    announceWave(title, subtitle) {
      this.dom.announcementTitle.textContent = title;
      this.dom.announcementSubtitle.textContent = subtitle;
      this.dom.announcementOverlay.classList.remove('nb-hidden');

      setTimeout(() => {
        this.dom.announcementOverlay.classList.add('nb-hidden');
      }, 2200);

      this.sound.playWaveClear();
    }

    pauseGame() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.dom.modalPause.classList.remove('nb-hidden');
    }

    resumeGame() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      this.dom.modalPause.classList.add('nb-hidden');
      this.lastTime = performance.now();
    }

    gameOver(reason = 'Hull breached.') {
      this.state = 'gameover';
      this.triggerShake(16, 0.45);
      this.sound.playExplosion(true);
      this.saveStorage();

      this.dom.goScore.textContent = this.score.toLocaleString();
      this.dom.goKills.textContent = this.kills.toLocaleString();
      this.dom.goWaves.textContent = (this.currentWaveIndex + 1).toString();
      this.dom.goCombo.textContent = `x${this.maxComboAchieved}`;

      if (this.score > this.highScore) {
        this.dom.goNewHigh.classList.remove('nb-hidden');
      } else {
        this.dom.goNewHigh.classList.add('nb-hidden');
      }

      this.dom.modalGameOver.classList.remove('nb-hidden');

      // Report score to ArcadeVerse hub
      if (window.ArcadeVerse && typeof window.ArcadeVerse.postScore === 'function') {
        window.ArcadeVerse.postScore(this.score);
      }
    }

    victory() {
      this.state = 'victory';
      this.saveStorage();

      this.dom.vicScore.textContent = this.score.toLocaleString();
      this.dom.vicKills.textContent = this.kills.toLocaleString();

      let rank = 'S-RANK';
      if (this.score < 8000) rank = 'B-RANK';
      else if (this.score < 14000) rank = 'A-RANK';
      this.dom.vicRank.textContent = rank;

      const elapsed = 180 - Math.max(0, this.timeAttackTimer);
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      this.dom.vicTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      this.dom.modalVictory.classList.remove('nb-hidden');
      this.sound.playWaveClear();

      if (window.ArcadeVerse && typeof window.ArcadeVerse.postScore === 'function') {
        window.ArcadeVerse.postScore(this.score);
      }
    }

    addScore(basePoints, x, y) {
      const points = basePoints * this.combo;
      this.score += points;
      this.kills += 1;

      // Extend Combo
      this.combo = Math.min(8, this.combo + 1);
      this.comboTimer = this.comboMaxTime;
      this.maxComboAchieved = Math.max(this.maxComboAchieved, this.combo);

      // Charge Overdrive
      this.player.overdriveEnergy = Math.min(100, this.player.overdriveEnergy + 4);

      if (x !== undefined && y !== undefined) {
        this.floatTexts.add(`+${points}`, x, y, this.combo > 3 ? '#ff007f' : '#00f3ff');
      }

      this.updateUI();
    }

    spawnPowerup(x, y) {
      // 22% chance of dropping a power-up
      if (Math.random() > 0.24) return;
      const types = Object.values(POWERUP_TYPES);
      const chosen = types[Math.floor(Math.random() * types.length)];
      this.powerups.push(new PowerUp(x, y, chosen));
    }

    spawnEnemy(typeId) {
      const pad = 30;
      const x = Math.random() * (this.canvas.width - pad * 2) + pad;
      const y = -30;

      let config = { id: 'scout', hp: 24, speed: 190, score: 100, color: '#00f3ff', radius: 14 };

      if (typeId === 'swarm') {
        config = { id: 'swarm', hp: 16, speed: 220, score: 80, color: '#fbbf24', radius: 12 };
      } else if (typeId === 'heavy') {
        config = { id: 'heavy', hp: 110, speed: 85, score: 300, color: '#ef4444', radius: 24, shootCooldown: 2.5 };
      } else if (typeId === 'sniper') {
        config = { id: 'sniper', hp: 45, speed: 140, score: 250, color: '#a855f7', radius: 16, shootCooldown: 3.0 };
      } else if (typeId === 'elite') {
        config = { id: 'elite', hp: 140, speed: 170, score: 450, color: '#ff007f', radius: 22, shootCooldown: 1.6 };
      }

      this.enemies.push(new Enemy(x, y, config));
    }

    updateUI() {
      this.dom.score.textContent = this.score.toLocaleString();
      this.dom.best.textContent = Math.max(this.score, this.highScore).toLocaleString();

      // Health bar
      const hpPct = Math.max(0, Math.min(1, this.player.hp / this.player.maxHp));
      this.dom.hpFill.style.width = `${hpPct * 100}%`;
      this.dom.hpNum.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

      // Shield bar
      if (this.player.shield > 0) {
        this.dom.shieldGroup.classList.remove('nb-hidden');
        const shieldPct = Math.min(1, this.player.shield / this.player.maxShield);
        this.dom.shieldFill.style.width = `${shieldPct * 100}%`;
        this.dom.shieldNum.textContent = `${Math.ceil(this.player.shield)}%`;
      } else {
        this.dom.shieldGroup.classList.add('nb-hidden');
      }

      // Overdrive bar
      const odPct = Math.min(1, this.player.overdriveEnergy / 100);
      this.dom.odFill.style.width = `${odPct * 100}%`;
      this.dom.odNum.textContent = `${Math.floor(this.player.overdriveEnergy)}%`;

      if (this.player.overdriveEnergy >= 100 && !this.player.isOverdriveActive) {
        this.dom.odPrompt.classList.remove('nb-hidden');
      } else {
        this.dom.odPrompt.classList.add('nb-hidden');
      }

      // Weapon
      this.dom.weaponName.textContent = this.player.weapon.name;
      this.dom.weaponTier.textContent = `MK ${'I'.repeat(this.player.weaponTier)}`;

      // Buffs Tray
      this.dom.buffsTray.innerHTML = '';
      if (this.player.buffs.rapidFire > 0) {
        this.addBuffBadge('RAPID', '#fbbf24');
      }
      if (this.player.buffs.doubleDamage > 0) {
        this.addBuffBadge('2X DMG', '#ef4444');
      }
      if (this.player.buffs.slowMo > 0) {
        this.addBuffBadge('SLOW-MO', '#06b6d4');
      }
      if (this.player.isOverdriveActive) {
        this.addBuffBadge('OVERDRIVE', '#ff007f');
      }

      // Combo Box
      if (this.combo > 1) {
        this.dom.comboBox.classList.remove('nb-hidden');
        this.dom.comboNum.textContent = `x${this.combo}`;
        const timerPct = Math.max(0, this.comboTimer / this.comboMaxTime);
        this.dom.comboTimerFill.style.width = `${timerPct * 100}%`;
      } else {
        this.dom.comboBox.classList.add('nb-hidden');
      }

      // Boss Bar
      if (this.boss && !this.boss.isDead) {
        this.dom.bossContainer.classList.remove('nb-hidden');
        const bPct = Math.max(0, Math.min(1, this.boss.hp / this.boss.maxHp));
        this.dom.bossHpFill.style.width = `${bPct * 100}%`;
        this.dom.bossHpText.textContent = `${Math.ceil(bPct * 100)}%`;
        this.dom.bossPhase.textContent = `PHASE ${this.boss.phase}`;
      }
    }

    addBuffBadge(name, color) {
      const badge = document.createElement('div');
      badge.className = 'nb-buff-badge';
      badge.style.borderColor = color;
      badge.style.color = color;
      badge.textContent = name;
      this.dom.buffsTray.appendChild(badge);
    }

    update(dt) {
      if (this.state !== 'playing') return;

      // Handle Screen Shake
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
      }

      // Time Attack mode timer
      if (this.mode === GAME_MODES.TIME_ATTACK) {
        this.timeAttackTimer -= dt;
        if (this.timeAttackTimer <= 0) {
          this.timeAttackTimer = 0;
          this.victory();
          return;
        }
        const mins = Math.floor(this.timeAttackTimer / 60);
        const secs = Math.floor(this.timeAttackTimer % 60);
        this.dom.timerBadge.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      // Combo Timer
      if (this.combo > 1) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 1;
        }
      }

      // Update Starfield
      this.starfield.update(dt);

      // Update Player
      this.player.update(dt, this.input, this.canvas.width, this.canvas.height, this.particles);

      // Auto Shooting on Mouse Down or Space
      if (this.input.mouse.isDown || this.input.keys['Space']) {
        this.player.shoot(this.projectiles, this.sound);
      }

      // Wave Spawning Management
      if (!this.boss) {
        this.waveTimer += dt;
        while (this.spawnQueue.length > 0 && this.waveTimer >= this.spawnQueue[0].delay) {
          const item = this.spawnQueue.shift();
          this.spawnEnemy(item.type);
        }

        // Check Wave Completion
        if (this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.isWaveClearing) {
          this.isWaveClearing = true;
          setTimeout(() => {
            if (this.state === 'playing') {
              this.isWaveClearing = false;
              this.startWave(this.currentWaveIndex + 1);
            }
          }, 1400);
        }
      }

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.update(dt);
        if (
          p.isDead ||
          p.x < -20 || p.x > this.canvas.width + 20 ||
          p.y < -20 || p.y > this.canvas.height + 20
        ) {
          this.projectiles.splice(i, 1);
        }
      }

      // Update Power-ups
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        pu.update(dt);

        // Collision with Player
        if (Math.hypot(this.player.x - pu.x, this.player.y - pu.y) < this.player.radius + pu.radius) {
          this.applyPowerup(pu.type);
          this.particles.spawn(pu.x, pu.y, pu.type.color, 24, 1.5);
          this.floatTexts.add(pu.type.name, pu.x, pu.y, pu.type.color, 16);
          this.sound.playPowerup();
          this.powerups.splice(i, 1);
          continue;
        }

        if (pu.isDead || pu.y > this.canvas.height + 40) {
          this.powerups.splice(i, 1);
        }
      }

      // Effective Delta Time for Enemies (Slow Motion buff)
      const enemyDt = (this.player.buffs.slowMo > 0) ? dt * 0.5 : dt;

      // Update Enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(enemyDt, this.player, this.projectiles, this.sound);

        // Player Collision
        if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < this.player.radius + enemy.radius) {
          const dead = this.player.takeDamage(25, this.sound, this.particles);
          this.triggerShake(10, 0.2);
          enemy.takeDamage(999);
          this.particles.spawn(enemy.x, enemy.y, enemy.color, 24);
          this.sound.playExplosion(false);

          if (dead) {
            this.gameOver('Hull breached by ramming collision.');
            return;
          }
        }

        if (enemy.isDead || enemy.y > this.canvas.height + 60) {
          this.enemies.splice(i, 1);
        }
      }

      // Update Boss
      if (this.boss && !this.boss.isDead) {
        this.boss.update(enemyDt, this.player, this.projectiles, this.enemies, this.sound, this.particles);

        // Player Collision with Boss
        if (Math.hypot(this.player.x - this.boss.x, this.player.y - this.boss.y) < this.player.radius + this.boss.radius) {
          const dead = this.player.takeDamage(40, this.sound, this.particles);
          this.triggerShake(14, 0.35);
          if (dead) {
            this.gameOver('Crushed by Void Destroyer dreadnought.');
            return;
          }
        }

        if (this.boss.isDead) {
          this.particles.spawn(this.boss.x, this.boss.y, '#ff007f', 64, 2.5);
          this.particles.spawn(this.boss.x, this.boss.y, '#fbbf24', 48, 2.0);
          this.sound.playExplosion(true);
          this.addScore(5000, this.boss.x, this.boss.y);
          this.boss = null;
          this.dom.bossContainer.classList.add('nb-hidden');

          setTimeout(() => {
            this.victory();
          }, 1200);
        }
      }

      // Projectile Collisions
      this.handleCollisions();

      // Update Particles & Floating Text
      this.particles.update(dt);
      this.floatTexts.update(dt);

      this.updateUI();
    }

    handleCollisions() {
      // 1. Player Projectiles vs Enemies & Boss
      for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
        const p = this.projectiles[pIdx];
        if (p.isEnemy || p.isDead) continue;

        // Check vs Normal Enemies
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];
          const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
          if (dist < p.radius + enemy.radius) {
            const isKilled = enemy.takeDamage(p.damage);
            p.pierce -= 1;
            if (p.pierce <= 0) p.isDead = true;

            this.particles.spawn(p.x, p.y, p.color, 6, 0.7);

            // Splash damage
            if (p.splashRadius > 0) {
              this.applySplashDamage(p.x, p.y, p.splashRadius, p.damage * 0.6);
            }

            if (isKilled) {
              this.particles.spawn(enemy.x, enemy.y, enemy.color, 18, 1.2);
              this.sound.playExplosion(false);
              this.addScore(enemy.scoreVal, enemy.x, enemy.y);
              this.spawnPowerup(enemy.x, enemy.y);
              this.enemies.splice(eIdx, 1);
            }
            break;
          }
        }

        // Check vs Boss
        if (this.boss && !this.boss.isDead && !this.boss.isEntering) {
          const bDist = Math.hypot(p.x - this.boss.x, p.y - this.boss.y);
          if (bDist < p.radius + this.boss.radius) {
            p.isDead = true;
            this.boss.takeDamage(p.damage);
            this.particles.spawn(p.x, p.y, p.color, 6, 0.8);
            this.floatTexts.add(String(Math.ceil(p.damage)), p.x, p.y - 10, '#ff007f', 12);
          }
        }
      }

      // 2. Enemy Projectiles vs Player
      for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
        const p = this.projectiles[pIdx];
        if (!p.isEnemy || p.isDead) continue;

        const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (dist < p.radius + this.player.radius) {
          p.isDead = true;
          const dead = this.player.takeDamage(p.damage, this.sound, this.particles);
          this.triggerShake(8, 0.18);
          if (dead) {
            this.gameOver('Destroyed by enemy energy discharge.');
            return;
          }
        }
      }
    }

    applySplashDamage(x, y, radius, damage) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (Math.hypot(enemy.x - x, enemy.y - y) <= radius + enemy.radius) {
          const isKilled = enemy.takeDamage(damage);
          if (isKilled) {
            this.particles.spawn(enemy.x, enemy.y, enemy.color, 16);
            this.addScore(enemy.scoreVal, enemy.x, enemy.y);
            this.enemies.splice(i, 1);
          }
        }
      }
    }

    applyPowerup(type) {
      if (type.id === 'health') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
      } else if (type.id === 'shield') {
        this.player.shield = this.player.maxShield;
      } else if (type.id === 'rapid_fire') {
        this.player.buffs.rapidFire = type.duration;
      } else if (type.id === 'double_damage') {
        this.player.buffs.doubleDamage = type.duration;
      } else if (type.id === 'upgrade') {
        this.player.upgradeWeapon();
      } else if (type.id === 'slow_mo') {
        this.player.buffs.slowMo = type.duration;
      } else if (type.id === 'energy') {
        this.player.overdriveEnergy = 100;
      }
    }

    draw() {
      // Clear
      this.ctx.fillStyle = '#030509';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.save();

      // Apply Screen Shake
      if (this.shakeDuration > 0) {
        const sx = (Math.random() * 2 - 1) * this.shakeIntensity;
        const sy = (Math.random() * 2 - 1) * this.shakeIntensity;
        this.ctx.translate(sx, sy);
      }

      // Starfield Background
      this.starfield.draw(this.ctx);

      // Power-ups
      for (let i = 0; i < this.powerups.length; i++) {
        this.powerups[i].draw(this.ctx);
      }

      // Projectiles
      for (let i = 0; i < this.projectiles.length; i++) {
        this.projectiles[i].draw(this.ctx);
      }

      // Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].draw(this.ctx);
      }

      // Boss
      if (this.boss && !this.boss.isDead) {
        this.boss.draw(this.ctx);
      }

      // Player
      if (this.state === 'playing' || this.state === 'paused') {
        this.player.draw(this.ctx);
      }

      // Particle explosions & engine glow
      this.particles.draw(this.ctx);

      // Floating Score Text
      this.floatTexts.draw(this.ctx);

      this.ctx.restore();
    }

    loop(timestamp) {
      const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
      this.lastTime = timestamp;

      this.update(dt);
      this.draw();

      this.animationFrameId = requestAnimationFrame(this.loop);
    }

    teardown() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.sound) {
        this.sound.teardown();
      }
      this.particles.clear();
      this.floatTexts.clear();
    }
  }

  // ========================================================
  // INITIALIZATION ON DOM READY
  // ========================================================
  document.addEventListener('DOMContentLoaded', () => {
    window.NeonBlasterGameInstance = new NeonBlasterGame();
  });

})();

