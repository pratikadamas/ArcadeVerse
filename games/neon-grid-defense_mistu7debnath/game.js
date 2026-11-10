/**
 * ============================================================================
 * NEON GRID DEFENSE: CORE PROTOCOL — PURE JAVASCRIPT GAME ENGINE
 * ArcadeVerse Standalone Architecture
 * Author: mistu7debnath
 * ============================================================================
 */

(function () {
  "use strict";

  // --- CONFIGURATION & CONSTANTS ---
  const CONFIG = {
    CANVAS_WIDTH: 960,
    CANVAS_HEIGHT: 600,
    GRID_COLS: 16,
    GRID_ROWS: 10,
    CELL_SIZE: 60,
    START_CREDITS: 300,
    CORE_MAX_HEALTH: 100,
    SELL_REFUND_RATIO: 0.70,
    STORAGE_KEYS: {
      BEST_WAVE: "neonGridDefense_bestWave",
      BEST_SCORE: "neonGridDefense_bestScore",
      SOUND_ENABLED: "neonGridDefense_soundEnabled"
    }
  };

  // Predefined Path Waypoints (col, row)
  const WAYPOINTS = [
    { col: 0, row: 2 },
    { col: 4, row: 2 },
    { col: 4, row: 6 },
    { col: 8, row: 6 },
    { col: 8, row: 1 },
    { col: 12, row: 1 },
    { col: 12, row: 7 },
    { col: 14, row: 7 },
    { col: 15, row: 7 } // Energy Core Vault
  ];

  // Tower Type Definitions
  const TOWER_TYPES = {
    pulse: {
      id: "pulse",
      name: "Pulse Turret",
      color: "#00f0ff",
      accent: "#38bdf8",
      cost: 100,
      description: "Balanced rate of fire & damage. Reliable defense.",
      levels: [
        { level: 1, damage: 26, range: 135, rate: 0.9, upgradeCost: 80, projSpeed: 620 },
        { level: 2, damage: 42, range: 150, rate: 0.8, upgradeCost: 140, projSpeed: 660 },
        { level: 3, damage: 68, range: 165, rate: 0.7, upgradeCost: 220, projSpeed: 700 },
        { level: 4, damage: 102, range: 185, rate: 0.6, upgradeCost: null, projSpeed: 760 }
      ]
    },
    rapid: {
      id: "rapid",
      name: "Rapid Blaster",
      color: "#38bdf8",
      accent: "#00f0ff",
      cost: 125,
      description: "High firing rate, low damage. Anti-swarm specialist.",
      levels: [
        { level: 1, damage: 9, range: 115, rate: 0.28, upgradeCost: 95, projSpeed: 750 },
        { level: 2, damage: 15, range: 125, rate: 0.24, upgradeCost: 160, projSpeed: 800 },
        { level: 3, damage: 23, range: 135, rate: 0.20, upgradeCost: 250, projSpeed: 850 },
        { level: 4, damage: 34, range: 150, rate: 0.16, upgradeCost: null, projSpeed: 920 }
      ]
    },
    nova: {
      id: "nova",
      name: "Nova Cannon",
      color: "#a855f7",
      accent: "#e056fd",
      cost: 175,
      description: "Slow heavy plasma mortars with area shockwave damage.",
      levels: [
        { level: 1, damage: 65, splashRadius: 55, splashDamage: 40, range: 165, rate: 2.2, upgradeCost: 120, projSpeed: 340 },
        { level: 2, damage: 105, splashRadius: 65, splashDamage: 65, range: 180, rate: 2.0, upgradeCost: 190, projSpeed: 360 },
        { level: 3, damage: 165, splashRadius: 75, splashDamage: 105, range: 195, rate: 1.8, upgradeCost: 290, projSpeed: 380 },
        { level: 4, damage: 260, splashRadius: 90, splashDamage: 165, range: 215, rate: 1.6, upgradeCost: null, projSpeed: 410 }
      ]
    }
  };

  // Enemy Type Definitions
  const ENEMY_TYPES = {
    basic: {
      type: "basic",
      name: "Basic Drone",
      baseHp: 75,
      hpGrowth: 22,
      baseSpeed: 62,
      damage: 8,
      bounty: 15,
      score: 50,
      size: 14,
      color: "#00f0ff",
      glowColor: "rgba(0, 240, 255, 0.4)"
    },
    scout: {
      type: "scout",
      name: "Scout Skimmer",
      baseHp: 48,
      hpGrowth: 15,
      baseSpeed: 115,
      damage: 6,
      bounty: 20,
      score: 70,
      size: 12,
      color: "#fbbf24",
      glowColor: "rgba(251, 191, 36, 0.4)"
    },
    armored: {
      type: "armored",
      name: "Titan Mech",
      baseHp: 260,
      hpGrowth: 85,
      baseSpeed: 34,
      damage: 20,
      bounty: 40,
      score: 140,
      size: 18,
      color: "#f43f5e",
      glowColor: "rgba(244, 63, 94, 0.4)"
    }
  };

  // --- AUDIO SYNTHESIS ENGINE (Web Audio API) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = this.loadPreference();
    }

    loadPreference() {
      try {
        const val = localStorage.getItem(CONFIG.STORAGE_KEYS.SOUND_ENABLED);
        return val === null ? true : val === "true";
      } catch (e) {
        return true;
      }
    }

    savePreference() {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.SOUND_ENABLED, String(this.enabled));
      } catch (e) {}
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      this.savePreference();
      if (this.enabled) this.init();
      return this.enabled;
    }

    playShootPulse() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
      } catch (e) {}
    }

    playShootRapid() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.07);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.07);
      } catch (e) {}
    }

    playShootNova() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    }

    playHit() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
      } catch (e) {}
    }

    playEnemyDestroyed() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.22);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.22);
      } catch (e) {}
    }

    playCoreDamaged() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.setValueAtTime(90, now + 0.15);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    }

    playBuild() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.setValueAtTime(720, now + 0.07);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) {}
    }

    playUpgrade() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.28);
      } catch (e) {}
    }

    playSell() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1180, now + 0.07);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);
      } catch (e) {}
    }

    playWaveClear() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const startTime = now + idx * 0.09;

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.22, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.22);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.22);
        });
      } catch (e) {}
    }

    playGameOver() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 392, 349, 293];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const startTime = now + idx * 0.16;

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.25, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.28);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.28);
        });
      } catch (e) {}
    }
  }

  // --- FLOATING TEXT & PARTICLES ---
  class FloatingText {
    constructor(x, y, text, color) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.opacity = 1;
      this.life = 0.9; // seconds
      this.elapsed = 0;
    }

    update(dt) {
      this.elapsed += dt;
      this.y -= 26 * dt;
      this.opacity = Math.max(0, 1 - this.elapsed / this.life);
      return this.elapsed < this.life;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, color, size, speed, dir, life, isRing = false) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.size = size;
      this.vx = Math.cos(dir) * speed;
      this.vy = Math.sin(dir) * speed;
      this.life = life;
      this.elapsed = 0;
      this.isRing = isRing;
      this.ringRadius = 4;
    }

    update(dt) {
      this.elapsed += dt;
      if (this.isRing) {
        this.ringRadius += 90 * dt;
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.96;
        this.vy *= 0.96;
      }
      return this.elapsed < this.life;
    }

    draw(ctx) {
      const alpha = Math.max(0, 1 - this.elapsed / this.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color;
      ctx.fillStyle = this.color;

      if (this.isRing) {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(1, this.size * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- PROJECTILE CLASS ---
  class Projectile {
    constructor(x, y, target, tower, levelData) {
      this.x = x;
      this.y = y;
      this.target = target;
      this.tower = tower;
      this.levelData = levelData;
      this.speed = levelData.projSpeed;
      this.color = tower.def.color;
      this.type = tower.def.id;
      this.damage = levelData.damage;
      this.active = true;
      this.trail = [];
    }

    update(dt, enemies, game) {
      if (!this.target || this.target.hp <= 0) {
        // Retarget nearest enemy or explode at last known location
        this.active = false;
        return false;
      }

      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);

      // Record trail
      this.trail.push({ x: this.x, y: this.y, alpha: 0.8 });
      if (this.trail.length > 5) this.trail.shift();

      const moveDist = this.speed * dt;
      if (dist <= moveDist || dist < 12) {
        // Hit target!
        this.onHit(enemies, game);
        this.active = false;
        return false;
      }

      this.x += (dx / dist) * moveDist;
      this.y += (dy / dist) * moveDist;
      return true;
    }

    onHit(enemies, game) {
      game.audio.playHit();

      if (this.type === "nova") {
        // AOE Splash Detonation
        game.audio.playShootNova();
        game.createNovaExplosion(this.x, this.y, this.levelData.splashRadius);
        game.triggerScreenShake(4, 0.18);

        // Direct damage
        this.target.takeDamage(this.damage, game, this.tower);

        // Splash to nearby enemies
        const radius = this.levelData.splashRadius;
        const splashDmg = this.levelData.splashDamage;
        enemies.forEach((enemy) => {
          if (enemy !== this.target && enemy.hp > 0) {
            const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (d <= radius) {
              const falloff = 1 - (d / radius) * 0.4; // up to 40% falloff at edge
              enemy.takeDamage(splashDmg * falloff, game, this.tower);
            }
          }
        });
      } else {
        // Single target hit
        this.target.takeDamage(this.damage, game, this.tower);
        game.createSparks(this.x, this.y, this.color, 7);
      }
    }

    draw(ctx) {
      // Draw trails
      ctx.save();
      for (let i = 0; i < this.trail.length; i++) {
        const pt = this.trail[i];
        const a = (i / this.trail.length) * 0.5;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;

      if (this.type === "nova") {
        // Glowing heavy orb
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.type === "rapid") {
        // High-velocity plasma needle
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Pulse laser core
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- ENEMY CLASS ---
  class Enemy {
    constructor(def, waveNumber, waypoints) {
      this.def = def;
      this.type = def.type;
      this.maxHp = Math.round(def.baseHp + (waveNumber - 1) * def.hpGrowth);
      this.hp = this.maxHp;
      this.speed = def.baseSpeed;
      this.damage = def.damage;
      this.bounty = def.bounty;
      this.score = def.score;
      this.size = def.size;
      this.color = def.color;
      this.glowColor = def.glowColor;

      this.waypoints = waypoints;
      this.wpIndex = 0;
      
      // Spawn slightly off-screen to the left of the start waypoint
      const startWp = waypoints[0];
      const startCenter = getCellCenter(startWp.col, startWp.row);
      this.x = startCenter.x - 40;
      this.y = startCenter.y;
      this.angle = 0;
      this.distanceTraveled = 0;
      this.active = true;
    }

    update(dt, game) {
      if (this.hp <= 0 || !this.active) return false;

      const targetWp = this.waypoints[this.wpIndex];
      const targetCenter = getCellCenter(targetWp.col, targetWp.row);
      const dx = targetCenter.x - this.x;
      const dy = targetCenter.y - this.y;
      const dist = Math.hypot(dx, dy);

      this.angle = Math.atan2(dy, dx);
      const move = this.speed * dt;
      this.distanceTraveled += move;

      if (dist <= move) {
        this.x = targetCenter.x;
        this.y = targetCenter.y;
        this.wpIndex++;

        // Reached end of path (Core Vault!)
        if (this.wpIndex >= this.waypoints.length) {
          this.active = false;
          game.damageCore(this.damage, this);
          return false;
        }
      } else {
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;
      }

      return true;
    }

    takeDamage(amount, game, sourceTower) {
      if (this.hp <= 0) return;
      this.hp -= amount;

      if (this.hp <= 0) {
        this.hp = 0;
        this.active = false;
        if (sourceTower) sourceTower.kills++;
        game.onEnemyDefeated(this);
      }
    }

    draw(ctx) {
      if (this.hp <= 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Distinct visuals per enemy type
      if (this.type === "basic") {
        // Diamond shaped cyber drone
        ctx.fillStyle = "rgba(12, 20, 51, 0.9)";
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(this.size, 0);
        ctx.lineTo(0, -this.size * 0.75);
        ctx.lineTo(-this.size * 0.75, 0);
        ctx.lineTo(0, this.size * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eye Scanner
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(this.size * 0.3, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === "scout") {
        // Needle aerodynamic skimmer
        ctx.fillStyle = "rgba(12, 20, 51, 0.9)";
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(this.size * 1.3, 0);
        ctx.lineTo(-this.size, -this.size * 0.85);
        ctx.lineTo(-this.size * 0.5, 0);
        ctx.lineTo(-this.size, this.size * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Thruster glow
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(-this.size * 0.6, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Titan Mech: Heavy armored octagon
        ctx.fillStyle = "rgba(18, 24, 58, 0.95)";
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        const s = this.size;
        ctx.moveTo(s, s * 0.4);
        ctx.lineTo(s * 0.4, s);
        ctx.lineTo(-s * 0.4, s);
        ctx.lineTo(-s, s * 0.4);
        ctx.lineTo(-s, -s * 0.4);
        ctx.lineTo(-s * 0.4, -s);
        ctx.lineTo(s * 0.4, -s);
        ctx.lineTo(s, -s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Core shield reactor
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Health Bar (unrotated)
      if (this.hp < this.maxHp) {
        ctx.save();
        const barW = 28;
        const barH = 4;
        const barX = this.x - barW / 2;
        const barY = this.y - this.size - 9;
        const healthPercent = Math.max(0, this.hp / this.maxHp);

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        ctx.fillStyle = healthPercent > 0.5 ? "#10b981" : (healthPercent > 0.25 ? "#fbbf24" : "#f43f5e");
        ctx.fillRect(barX, barY, barW * healthPercent, barH);
        ctx.restore();
      }
    }
  }

  // --- TOWER CLASS ---
  class Tower {
    constructor(def, col, row) {
      this.def = def;
      this.col = col;
      this.row = row;
      const center = getCellCenter(col, row);
      this.x = center.x;
      this.y = center.y;
      this.levelIndex = 0; // Level 1 is index 0
      this.totalInvested = def.cost;
      this.kills = 0;
      this.cooldown = 0;
      this.angle = 0;
      this.barrelRecoil = 0;
      this.target = null;
    }

    getLevelData() {
      return this.def.levels[this.levelIndex];
    }

    canUpgrade() {
      const cur = this.getLevelData();
      return cur.upgradeCost !== null;
    }

    getUpgradeCost() {
      const cur = this.getLevelData();
      return cur.upgradeCost;
    }

    upgrade() {
      if (this.canUpgrade()) {
        const cost = this.getUpgradeCost();
        this.levelIndex++;
        this.totalInvested += cost;
        return cost;
      }
      return 0;
    }

    getSellValue() {
      return Math.floor(this.totalInvested * CONFIG.SELL_REFUND_RATIO);
    }

    update(dt, enemies, projectiles, game) {
      const levelData = this.getLevelData();
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.barrelRecoil = Math.max(0, this.barrelRecoil - dt * 10);

      // Find best target in range (target furthest along the path)
      let bestEnemy = null;
      let maxDistTraveled = -1;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d <= levelData.range) {
          if (e.distanceTraveled > maxDistTraveled) {
            maxDistTraveled = e.distanceTraveled;
            bestEnemy = e;
          }
        }
      }

      this.target = bestEnemy;

      if (this.target) {
        // Aim toward target
        this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

        // Fire if cooldown ready
        if (this.cooldown <= 0) {
          this.cooldown = levelData.rate;
          this.barrelRecoil = 3;
          projectiles.push(new Projectile(this.x, this.y, this.target, this, levelData));

          // Play sound
          if (this.def.id === "pulse") game.audio.playShootPulse();
          else if (this.def.id === "rapid") game.audio.playShootRapid();
          else if (this.def.id === "nova") game.audio.playShootNova();

          // Muzzle flash particles
          const muzzleX = this.x + Math.cos(this.angle) * 18;
          const muzzleY = this.y + Math.sin(this.angle) * 18;
          game.createSparks(muzzleX, muzzleY, this.def.color, 4);
        }
      }
    }

    draw(ctx, isSelected) {
      const levelData = this.getLevelData();

      // Range Circle when selected
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = this.def.color;
        ctx.fillStyle = this.def.color;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(this.x, this.y, levelData.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, levelData.range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Base Platform
      ctx.save();
      ctx.translate(this.x, this.y);

      // Level Indicator pips on base
      ctx.fillStyle = "#0a1128";
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.shadowColor = this.def.color;
      ctx.shadowBlur = isSelected ? 12 : 6;

      // Base Octagon/Rounded Square
      const r = 20;
      ctx.beginPath();
      ctx.moveTo(-r + 4, -r);
      ctx.lineTo(r - 4, -r);
      ctx.lineTo(r, -r + 4);
      ctx.lineTo(r, r - 4);
      ctx.lineTo(r - 4, r);
      ctx.lineTo(-r + 4, r);
      ctx.lineTo(-r, r - 4);
      ctx.lineTo(-r, -r + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw Level Dots
      const lvl = this.levelIndex + 1;
      const dotSpacing = 5;
      const startX = -((lvl - 1) * dotSpacing) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      for (let i = 0; i < lvl; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotSpacing, 14, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rotating Turret Top
      ctx.rotate(this.angle);

      // Recoil shift
      const recoilX = -this.barrelRecoil;

      if (this.def.id === "pulse") {
        // Pulse Turret: Sleek barrel with glow capacitor
        ctx.fillStyle = this.def.accent;
        ctx.fillRect(recoilX, -3, 18, 6);

        ctx.fillStyle = "#0c1538";
        ctx.strokeStyle = this.def.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(recoilX, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(recoilX, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.def.id === "rapid") {
        // Rapid Blaster: Twin side-by-side barrels
        ctx.fillStyle = this.def.accent;
        ctx.fillRect(recoilX, -6, 17, 3);
        ctx.fillRect(recoilX, 3, 17, 3);

        ctx.fillStyle = "#0c1538";
        ctx.strokeStyle = this.def.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(recoilX - 7, -8, 14, 16);
        ctx.fill();
        ctx.stroke();
      } else {
        // Nova Cannon: Heavy large-bore mortar barrel
        ctx.fillStyle = this.def.accent;
        ctx.fillRect(recoilX, -5, 20, 10);

        ctx.fillStyle = "#0c1538";
        ctx.strokeStyle = this.def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(recoilX, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(recoilX, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Helper: Get coordinate of cell center
  function getCellCenter(col, row) {
    return {
      x: col * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
      y: row * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2
    };
  }

  // --- MAIN GAME MANAGER ---
  class NeonGridDefense {
    constructor() {
      // DOM Elements
      this.canvas = document.getElementById("ngd-canvas");
      this.ctx = this.canvas.getContext("2d");

      this.hudWave = document.getElementById("ngd-hud-wave");
      this.hudCoreHealth = document.getElementById("ngd-hud-core-health");
      this.hudCoreHealthFill = document.getElementById("ngd-core-health-fill");
      this.hudCredits = document.getElementById("ngd-hud-credits");
      this.hudEnemies = document.getElementById("ngd-hud-enemies");
      this.hudScore = document.getElementById("ngd-hud-score");
      this.speedText = document.getElementById("ngd-speed-text");

      this.menuScreen = document.getElementById("ngd-menu-screen");
      this.pauseOverlay = document.getElementById("ngd-pause-overlay");
      this.gameoverOverlay = document.getElementById("ngd-gameover-overlay");
      this.guideDialog = document.getElementById("ngd-guide-dialog");

      this.menuBestWave = document.getElementById("ngd-menu-best-wave");
      this.menuBestScore = document.getElementById("ngd-menu-best-score");
      this.goWave = document.getElementById("ngd-go-wave");
      this.goScore = document.getElementById("ngd-go-score");
      this.goKills = document.getElementById("ngd-go-kills");
      this.goBest = document.getElementById("ngd-go-best");

      this.inspector = document.getElementById("ngd-inspector");
      this.insType = document.getElementById("ngd-ins-type");
      this.insLevel = document.getElementById("ngd-ins-level");
      this.insDmg = document.getElementById("ngd-ins-dmg");
      this.insRate = document.getElementById("ngd-ins-rate");
      this.insRange = document.getElementById("ngd-ins-range");
      this.insKills = document.getElementById("ngd-ins-kills");
      this.btnUpgrade = document.getElementById("ngd-btn-upgrade");
      this.btnSell = document.getElementById("ngd-btn-sell");
      this.insUpgradeText = document.getElementById("ngd-ins-upgrade-text");
      this.insSellText = document.getElementById("ngd-ins-sell-text");

      this.waveStatus = document.getElementById("ngd-wave-status");
      this.btnStartWave = document.getElementById("ngd-btn-start-wave");
      this.btnWaveText = document.getElementById("ngd-btn-wave-text");

      this.toastEl = document.getElementById("ngd-toast");
      this.toastMsg = document.getElementById("ngd-toast-msg");
      this.announcer = document.getElementById("ngd-announcer");

      this.iconSoundOn = document.getElementById("ngd-icon-sound-on");
      this.iconSoundOff = document.getElementById("ngd-icon-sound-off");
      this.iconPause = document.getElementById("ngd-icon-pause");
      this.iconPlay = document.getElementById("ngd-icon-play");

      // Audio System
      this.audio = new SoundEngine();
      this.updateAudioIcons();

      // State
      this.gameState = "MENU"; // MENU, PLAYING, PAUSED, GAMEOVER
      this.gameSpeed = 1; // 1 or 2
      this.lastTime = 0;
      this.rafId = null;

      // Gameplay Data
      this.wave = 1;
      this.coreHealth = CONFIG.CORE_MAX_HEALTH;
      this.credits = CONFIG.START_CREDITS;
      this.score = 0;
      this.totalKills = 0;

      // Best Records
      this.bestWave = this.loadBestWave();
      this.bestScore = this.loadBestScore();
      this.updateMenuRecords();

      // Grid Model
      this.grid = []; // 2D array [col][row]
      this.pathCells = new Set();
      this.buildGrid();

      // Entities
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.particles = [];
      this.floatingTexts = [];

      // Wave Mechanics
      this.wavePhase = "PREP"; // PREP, SPAWNING, COMBAT
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.spawnInterval = 0.8;
      this.prepCountdown = 15; // seconds

      // Selection & Interaction
      this.selectedBuildType = null; // 'pulse', 'rapid', 'nova' or null
      this.selectedTower = null; // Tower instance or null
      this.hoverCol = -1;
      this.hoverRow = -1;

      // Screen Shake
      this.shakeIntensity = 0;
      this.shakeDuration = 0;

      // Path flow animation
      this.pathPulseOffset = 0;

      // Toast Timer
      this.toastTimeout = null;

      // Setup Event Listeners
      this.initEvents();
    }

    // --- GRID GENERATION ---
    buildGrid() {
      this.grid = [];
      this.pathCells.clear();

      // Trace waypoints to mark path cells
      for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const from = WAYPOINTS[i];
        const to = WAYPOINTS[i + 1];

        const minCol = Math.min(from.col, to.col);
        const maxCol = Math.max(from.col, to.col);
        const minRow = Math.min(from.row, to.row);
        const maxRow = Math.max(from.row, to.row);

        for (let c = minCol; c <= maxCol; c++) {
          for (let r = minRow; r <= maxRow; r++) {
            this.pathCells.add(`${c},${r}`);
          }
        }
      }

      // Initialize grid cells
      for (let c = 0; c < CONFIG.GRID_COLS; c++) {
        this.grid[c] = [];
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
          const key = `${c},${r}`;
          const isPath = this.pathCells.has(key);
          const isSpawn = c === WAYPOINTS[0].col && r === WAYPOINTS[0].row;
          const isCore = c === WAYPOINTS[WAYPOINTS.length - 1].col && r === WAYPOINTS[WAYPOINTS.length - 1].row;

          this.grid[c][r] = {
            col: c,
            row: r,
            isPath: isPath,
            isSpawn: isSpawn,
            isCore: isCore,
            tower: null
          };
        }
      }
    }

    isCellBuildable(col, row) {
      if (col < 0 || col >= CONFIG.GRID_COLS || row < 0 || row >= CONFIG.GRID_ROWS) return false;
      const cell = this.grid[col][row];
      return !cell.isPath && !cell.isCore && !cell.isSpawn && cell.tower === null;
    }

    // --- RECORDS & PERSISTENCE ---
    loadBestWave() {
      try {
        const val = localStorage.getItem(CONFIG.STORAGE_KEYS.BEST_WAVE);
        return val ? parseInt(val, 10) || 0 : 0;
      } catch (e) {
        return 0;
      }
    }

    loadBestScore() {
      try {
        const val = localStorage.getItem(CONFIG.STORAGE_KEYS.BEST_SCORE);
        return val ? parseInt(val, 10) || 0 : 0;
      } catch (e) {
        return 0;
      }
    }

    saveBestRecords() {
      if (this.wave > this.bestWave) {
        this.bestWave = this.wave;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.BEST_WAVE, String(this.bestWave));
        } catch (e) {}
      }
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.BEST_SCORE, String(this.bestScore));
        } catch (e) {}
      }
      this.updateMenuRecords();
    }

    updateMenuRecords() {
      if (this.menuBestWave) this.menuBestWave.textContent = String(this.bestWave);
      if (this.menuBestScore) this.menuBestScore.textContent = this.bestScore.toLocaleString();
    }

    // --- TOAST NOTIFICATIONS ---
    showToast(message, type = "info") {
      if (!this.toastEl || !this.toastMsg) return;
      this.toastMsg.textContent = message;
      this.toastEl.className = "ngd-toast ngd-show";
      if (type === "danger") this.toastEl.classList.add("ngd-toast-danger");
      if (type === "success") this.toastEl.classList.add("ngd-toast-success");

      if (this.announcer) this.announcer.textContent = message;

      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        this.toastEl.classList.remove("ngd-show");
      }, 2600);
    }

    // --- SCREEN SHAKE & FX ---
    triggerScreenShake(intensity, duration) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
    }

    createSparks(x, y, color, count = 6) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 90;
        const size = 1.5 + Math.random() * 2;
        const life = 0.25 + Math.random() * 0.25;
        this.particles.push(new Particle(x, y, color, size, speed, angle, life));
      }
    }

    createNovaExplosion(x, y, radius) {
      // Ring particle
      this.particles.push(new Particle(x, y, "#a855f7", 0, 0, 0, 0.45, true));
      // Sparks
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 60 + Math.random() * 120;
        this.particles.push(new Particle(x, y, "#e056fd", 2.5, speed, angle, 0.4));
      }
    }

    createFloatingText(x, y, text, color = "#00f0ff") {
      this.floatingTexts.push(new FloatingText(x, y, text, color));
    }

    // --- GAME CONTROL & FLOW ---
    startGame() {
      this.audio.init();
      this.resetGame();
      this.gameState = "PLAYING";
      this.menuScreen.classList.add("ngd-hidden");
      this.gameoverOverlay.classList.add("ngd-hidden");
      this.pauseOverlay.classList.add("ngd-hidden");
      this.showToast("Sector Defense Initialized! Deploy your perimeter turrets.");
      this.lastTime = performance.now();
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(this.gameLoop.bind(this));
      }
    }

    resetGame() {
      this.wave = 1;
      this.coreHealth = CONFIG.CORE_MAX_HEALTH;
      this.credits = CONFIG.START_CREDITS;
      this.score = 0;
      this.totalKills = 0;
      this.gameSpeed = 1;

      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.particles = [];
      this.floatingTexts = [];

      this.buildGrid();
      this.deselectTower();
      this.selectedBuildType = null;
      this.updateBuildTrayUI();

      this.wavePhase = "PREP";
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.prepCountdown = 12;

      this.updateHUD();
      this.updateSpeedUI();
    }

    togglePause() {
      if (this.gameState === "PLAYING") {
        this.gameState = "PAUSED";
        // Issue #537: Reset turret placement ghost on pause to prevent wave corruption
        this.selectedBuildType = null;
        this.hoverCol = -1;
        this.hoverRow = -1;
        this.updateBuildTrayUI();
        this.pauseOverlay.classList.remove("ngd-hidden");
        this.iconPause.classList.add("ngd-hidden");
        this.iconPlay.classList.remove("ngd-hidden");
        this.showToast("System Paused.");
      } else if (this.gameState === "PAUSED") {
        this.gameState = "PLAYING";
        this.pauseOverlay.classList.add("ngd-hidden");
        this.iconPlay.classList.add("ngd-hidden");
        this.iconPause.classList.remove("ngd-hidden");
        this.lastTime = performance.now();
        this.showToast("Protocol Resumed.");
      }
    }

    toggleSpeed() {
      this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
      this.updateSpeedUI();
      this.showToast(`Speed: ${this.gameSpeed}X`);
    }

    updateSpeedUI() {
      if (this.speedText) this.speedText.textContent = `${this.gameSpeed}X`;
    }

    updateAudioIcons() {
      if (this.audio.enabled) {
        this.iconSoundOn.classList.remove("ngd-hidden");
        this.iconSoundOff.classList.add("ngd-hidden");
      } else {
        this.iconSoundOn.classList.add("ngd-hidden");
        this.iconSoundOff.classList.remove("ngd-hidden");
      }
    }

    // --- WAVE PROGRESSION ---
    startNextWave() {
      if (this.wavePhase !== "PREP") return;

      this.wavePhase = "SPAWNING";
      this.spawnTimer = 0;
      this.generateWaveQueue(this.wave);

      this.audio.playShootPulse();
      this.showToast(`Wave ${this.wave} Incursion Detected!`);
      this.updateWaveStatusUI();
    }

    generateWaveQueue(waveNumber) {
      this.spawnQueue = [];
      let basicCount = 0;
      let scoutCount = 0;
      let armoredCount = 0;

      if (waveNumber === 1) {
        basicCount = 7;
      } else if (waveNumber === 2) {
        basicCount = 6;
        scoutCount = 3;
      } else if (waveNumber === 3) {
        basicCount = 8;
        scoutCount = 5;
        armoredCount = 1;
      } else if (waveNumber === 4) {
        basicCount = 9;
        scoutCount = 7;
        armoredCount = 3;
      } else if (waveNumber === 5) {
        basicCount = 12;
        scoutCount = 9;
        armoredCount = 5;
      } else {
        // Endless formulaic scaling
        basicCount = 8 + waveNumber * 2;
        scoutCount = 4 + Math.floor(waveNumber * 1.5);
        armoredCount = Math.max(1, Math.floor(waveNumber * 1.2));
      }

      // Interleave enemies for engaging tactical variety
      const pool = [];
      for (let i = 0; i < basicCount; i++) pool.push(ENEMY_TYPES.basic);
      for (let i = 0; i < scoutCount; i++) pool.push(ENEMY_TYPES.scout);
      for (let i = 0; i < armoredCount; i++) pool.push(ENEMY_TYPES.armored);

      // Controlled shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
      }

      this.spawnQueue = pool;
      this.spawnInterval = Math.max(0.4, 0.85 - waveNumber * 0.02);
    }

    onEnemyDefeated(enemy) {
      this.audio.playEnemyDestroyed();
      this.credits += enemy.bounty;
      this.score += enemy.score;
      this.totalKills++;

      this.createFloatingText(enemy.x, enemy.y, `+${enemy.bounty} CR`, "#38bdf8");
      this.createSparks(enemy.x, enemy.y, enemy.color, 12);
      this.updateHUD();
      this.checkWaveCompletion();
    }

    damageCore(damage, enemy) {
      this.audio.playCoreDamaged();
      this.coreHealth = Math.max(0, this.coreHealth - damage);
      this.triggerScreenShake(7, 0.28);

      const coreCenter = getCellCenter(WAYPOINTS[WAYPOINTS.length - 1].col, WAYPOINTS[WAYPOINTS.length - 1].row);
      this.createSparks(coreCenter.x, coreCenter.y, "#f43f5e", 16);
      this.createFloatingText(coreCenter.x, coreCenter.y - 15, `-${damage} HP`, "#f43f5e");

      this.showToast(`Warning: Core Integrity at ${this.coreHealth}%!`, "danger");
      this.updateHUD();

      if (this.coreHealth <= 0) {
        this.gameOver();
      } else {
        this.checkWaveCompletion();
      }
    }

    checkWaveCompletion() {
      if (this.wavePhase !== "PREP" && this.spawnQueue.length === 0 && this.enemies.length === 0) {
        // Wave fully cleared!
        const bonus = 50 + this.wave * 12;
        this.credits += bonus;
        this.score += 200 + this.wave * 50;

        this.audio.playWaveClear();
        this.showToast(`Wave ${this.wave} Cleared! Bonus: +${bonus} CR`, "success");

        this.saveBestRecords();

        this.wave++;
        this.wavePhase = "PREP";
        this.prepCountdown = 12;
        this.updateHUD();
        this.updateWaveStatusUI();
      }
    }

    gameOver() {
      this.gameState = "GAMEOVER";
      this.audio.playGameOver();
      this.saveBestRecords();

      if (this.goWave) this.goWave.textContent = String(this.wave);
      if (this.goScore) this.goScore.textContent = this.score.toLocaleString();
      if (this.goKills) this.goKills.textContent = String(this.totalKills);
      if (this.goBest) this.goBest.textContent = this.bestScore.toLocaleString();

      this.gameoverOverlay.classList.remove("ngd-hidden");
      this.showToast("Core Protocol Collapsed. Sector Lost.", "danger");
    }

    // --- TOWER MANAGEMENT ---
    selectBuildType(typeKey) {
      if (this.selectedBuildType === typeKey) {
        this.selectedBuildType = null;
      } else {
        this.selectedBuildType = typeKey;
        this.deselectTower();
      }
      this.updateBuildTrayUI();
    }

    updateBuildTrayUI() {
      const cards = document.querySelectorAll(".ngd-tower-card");
      cards.forEach((card) => {
        const type = card.dataset.tower;
        if (type === this.selectedBuildType) {
          card.classList.add("ngd-selected");
        } else {
          card.classList.remove("ngd-selected");
        }

        const cost = TOWER_TYPES[type].cost;
        card.disabled = this.credits < cost;
      });
    }

    placeTower(col, row) {
      if (!this.selectedBuildType) return;
      const def = TOWER_TYPES[this.selectedBuildType];

      if (this.credits < def.cost) {
        this.showToast("Insufficient Credits for Turret Construction!", "danger");
        return;
      }

      if (!this.isCellBuildable(col, row)) {
        this.showToast("Invalid Grid Sector: Path or Cell Obstructed!", "danger");
        return;
      }

      // Build tower
      this.credits -= def.cost;
      const tower = new Tower(def, col, row);
      this.towers.push(tower);
      this.grid[col][row].tower = tower;

      this.audio.playBuild();
      this.createSparks(tower.x, tower.y, def.color, 12);
      this.createFloatingText(tower.x, tower.y - 12, `-${def.cost} CR`, "#00f0ff");
      this.showToast(`${def.name} Deployed.`);

      // Select newly placed tower
      this.selectTower(tower);
      this.selectedBuildType = null;
      this.updateBuildTrayUI();
      this.updateHUD();
    }

    selectTower(tower) {
      this.selectedTower = tower;
      this.selectedBuildType = null;
      this.updateBuildTrayUI();
      this.updateInspectorUI();
    }

    deselectTower() {
      this.selectedTower = null;
      if (this.inspector) this.inspector.classList.add("ngd-hidden");
    }

    upgradeSelectedTower() {
      if (!this.selectedTower) return;
      if (!this.selectedTower.canUpgrade()) {
        this.showToast("Turret Already At Maximum MK. IV Specification!");
        return;
      }

      const cost = this.selectedTower.getUpgradeCost();
      if (this.credits < cost) {
        this.showToast("Insufficient Credits for Upgrade!", "danger");
        return;
      }

      this.credits -= cost;
      this.selectedTower.upgrade();
      this.audio.playUpgrade();
      this.createSparks(this.selectedTower.x, this.selectedTower.y, "#10b981", 14);
      this.createFloatingText(this.selectedTower.x, this.selectedTower.y - 14, `-${cost} CR`, "#10b981");
      this.showToast(`${this.selectedTower.def.name} Upgraded to MK. ${this.selectedTower.levelIndex + 1}!`);

      this.updateInspectorUI();
      this.updateHUD();
    }

    sellSelectedTower() {
      if (!this.selectedTower) return;
      const refund = this.selectedTower.getSellValue();
      this.credits += refund;

      // Free grid cell
      this.grid[this.selectedTower.col][this.selectedTower.row].tower = null;

      // Remove from towers list
      const idx = this.towers.indexOf(this.selectedTower);
      if (idx !== -1) this.towers.splice(idx, 1);

      this.audio.playSell();
      this.createSparks(this.selectedTower.x, this.selectedTower.y, "#fb7185", 10);
      this.createFloatingText(this.selectedTower.x, this.selectedTower.y - 10, `+${refund} CR`, "#38bdf8");
      this.showToast(`Turret Recycled: +${refund} Credits.`);

      this.deselectTower();
      this.updateHUD();
    }

    updateInspectorUI() {
      if (!this.selectedTower) {
        if (this.inspector) this.inspector.classList.add("ngd-hidden");
        return;
      }

      this.inspector.classList.remove("ngd-hidden");
      const lvlData = this.selectedTower.getLevelData();

      this.insType.textContent = this.selectedTower.def.name.toUpperCase();
      this.insLevel.textContent = `MK. ${this.selectedTower.levelIndex + 1}`;
      this.insDmg.textContent = lvlData.damage;
      this.insRate.textContent = `${(1 / lvlData.rate).toFixed(1)}/s`;
      this.insRange.textContent = `${lvlData.range}px`;
      this.insKills.textContent = String(this.selectedTower.kills);

      const refund = this.selectedTower.getSellValue();
      this.insSellText.textContent = `SELL (+${refund} CR)`;

      if (this.selectedTower.canUpgrade()) {
        const cost = this.selectedTower.getUpgradeCost();
        this.insUpgradeText.textContent = `UPGRADE (${cost} CR)`;
        this.btnUpgrade.disabled = this.credits < cost;
      } else {
        this.insUpgradeText.textContent = "MAX LEVEL";
        this.btnUpgrade.disabled = true;
      }
    }

    // --- HUD REFRESH ---
    updateHUD() {
      if (this.hudWave) this.hudWave.textContent = String(this.wave);
      if (this.hudCoreHealth) this.hudCoreHealth.textContent = `${this.coreHealth}%`;
      if (this.hudCoreHealthFill) {
        this.hudCoreHealthFill.style.width = `${Math.max(0, this.coreHealth)}%`;
        if (this.coreHealth < 30) {
          this.hudCoreHealthFill.className = "ngd-health-bar-fill ngd-health-danger";
        } else if (this.coreHealth < 60) {
          this.hudCoreHealthFill.className = "ngd-health-bar-fill ngd-health-warn";
        } else {
          this.hudCoreHealthFill.className = "ngd-health-bar-fill";
        }
      }

      if (this.hudCredits) this.hudCredits.textContent = String(this.credits);
      if (this.hudEnemies) this.hudEnemies.textContent = String(this.enemies.length + this.spawnQueue.length);
      if (this.hudScore) this.hudScore.textContent = this.score.toLocaleString();

      this.updateBuildTrayUI();
      if (this.selectedTower) this.updateInspectorUI();
    }

    updateWaveStatusUI() {
      if (this.wavePhase === "PREP") {
        this.waveStatus.textContent = `PREPARATION: ${Math.ceil(this.prepCountdown)}S`;
        this.btnStartWave.disabled = false;
        this.btnWaveText.textContent = `START WAVE ${this.wave}`;
      } else {
        const remaining = this.enemies.length + this.spawnQueue.length;
        this.waveStatus.textContent = `WAVE ${this.wave} ACTIVE: ${remaining} BOTS`;
        this.btnStartWave.disabled = true;
        this.btnWaveText.textContent = `INCURSION ENGAGED`;
      }
    }

    // --- COORDINATE & INPUT HELPER ---
    getCanvasCoordinates(e) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CONFIG.CANVAS_WIDTH / rect.width;
      const scaleY = CONFIG.CANVAS_HEIGHT / rect.height;

      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      const col = Math.floor(x / CONFIG.CELL_SIZE);
      const row = Math.floor(y / CONFIG.CELL_SIZE);

      return { x, y, col, row };
    }

    // --- EVENT LISTENERS ---
    initEvents() {
      // Buttons
      document.getElementById("ngd-btn-start").addEventListener("click", () => this.startGame());
      document.getElementById("ngd-btn-restart").addEventListener("click", () => this.startGame());
      document.getElementById("ngd-btn-restart-from-pause").addEventListener("click", () => this.startGame());
      document.getElementById("ngd-btn-back-menu").addEventListener("click", () => {
        this.gameoverOverlay.classList.add("ngd-hidden");
        this.menuScreen.classList.remove("ngd-hidden");
        this.gameState = "MENU";
      });

      document.getElementById("ngd-btn-pause").addEventListener("click", () => this.togglePause());
      document.getElementById("ngd-btn-resume").addEventListener("click", () => this.togglePause());
      document.getElementById("ngd-btn-speed").addEventListener("click", () => this.toggleSpeed());
      document.getElementById("ngd-btn-audio").addEventListener("click", () => {
        this.audio.toggle();
        this.updateAudioIcons();
        this.showToast(this.audio.enabled ? "Audio Enabled" : "Audio Muted");
      });

      // Wave launch button
      this.btnStartWave.addEventListener("click", () => this.startNextWave());

      // Tower Tray Buttons
      const cards = document.querySelectorAll(".ngd-tower-card");
      cards.forEach((card) => {
        card.addEventListener("click", () => {
          this.selectBuildType(card.dataset.tower);
        });
      });

      // Inspector buttons
      this.btnUpgrade.addEventListener("click", () => this.upgradeSelectedTower());
      this.btnSell.addEventListener("click", () => this.sellSelectedTower());
      document.getElementById("ngd-ins-close").addEventListener("click", () => this.deselectTower());

      // Help Modal Dialog
      const openHelp = () => {
        this.guideDialog.showModal();
      };
      const closeHelp = () => {
        this.guideDialog.close();
      };

      document.getElementById("ngd-btn-how-to-play").addEventListener("click", openHelp);
      document.getElementById("ngd-btn-help").addEventListener("click", openHelp);
      document.getElementById("ngd-btn-pause-help").addEventListener("click", openHelp);
      document.getElementById("ngd-guide-close").addEventListener("click", closeHelp);
      document.getElementById("ngd-guide-ok").addEventListener("click", closeHelp);

      // Light dismiss for dialog (clicking backdrop closes dialog)
      this.guideDialog.addEventListener("click", (e) => {
        const rect = this.guideDialog.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX && e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
          this.guideDialog.close();
        }
      });

      // Canvas Pointer Interactions
      this.canvas.addEventListener("mousemove", (e) => {
        const pos = this.getCanvasCoordinates(e);
        this.hoverCol = pos.col;
        this.hoverRow = pos.row;
      });

      this.canvas.addEventListener("mouseleave", () => {
        this.hoverCol = -1;
        this.hoverRow = -1;
      });

      const handleCanvasClick = (e) => {
        if (this.gameState !== "PLAYING") return;
        const pos = this.getCanvasCoordinates(e);
        const c = pos.col;
        const r = pos.row;

        if (c < 0 || c >= CONFIG.GRID_COLS || r < 0 || r >= CONFIG.GRID_ROWS) return;

        const cell = this.grid[c][r];

        if (this.selectedBuildType) {
          // Attempt tower placement
          this.placeTower(c, r);
        } else if (cell.tower) {
          // Select existing tower
          this.selectTower(cell.tower);
        } else {
          // Clicked empty area -> deselect
          this.deselectTower();
        }
      };

      this.canvas.addEventListener("click", handleCanvasClick);

      // Keyboard Controls
      window.addEventListener("keydown", (e) => {
        // Ignore if user is interacting with form elements
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

        if (e.key === "Escape") {
          if (this.guideDialog.open) {
            this.guideDialog.close();
          } else if (this.selectedTower) {
            this.deselectTower();
          } else if (this.selectedBuildType) {
            this.selectedBuildType = null;
            this.updateBuildTrayUI();
          } else if (this.gameState === "PLAYING") {
            this.togglePause();
          }
          return;
        }

        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          if (this.gameState === "PLAYING" || this.gameState === "PAUSED") {
            this.togglePause();
          }
          return;
        }

        if (e.key === "1") {
          this.selectBuildType("pulse");
        } else if (e.key === "2") {
          this.selectBuildType("rapid");
        } else if (e.key === "3") {
          this.selectBuildType("nova");
        } else if (e.key === "n" || e.key === "N") {
          this.startNextWave();
        } else if (e.key === "u" || e.key === "U") {
          this.upgradeSelectedTower();
        } else if (e.key === "s" || e.key === "S") {
          this.sellSelectedTower();
        } else if (e.key === "m" || e.key === "M") {
          this.audio.toggle();
          this.updateAudioIcons();
          this.showToast(this.audio.enabled ? "Audio Enabled" : "Audio Muted");
        } else if (e.key === "r" || e.key === "R") {
          if (this.gameState === "GAMEOVER" || this.gameState === "PAUSED") {
            this.startGame();
          }
        }
      });
    }

    // --- GAME LOOP & UPDATES ---
    gameLoop(now) {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1) * this.gameSpeed;
      this.lastTime = now;

      if (this.gameState === "PLAYING") {
        this.update(dt);
      }
      this.render();

      this.rafId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(dt) {
      // Screen shake decay
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
        if (this.shakeDuration <= 0) this.shakeIntensity = 0;
      }

      // Path cyber pulse offset
      this.pathPulseOffset = (this.pathPulseOffset + dt * 45) % 40;

      // Wave Spawning & Prep logic
      if (this.wavePhase === "PREP") {
        this.prepCountdown -= dt;
        this.updateWaveStatusUI();
        if (this.prepCountdown <= 0) {
          this.startNextWave();
        }
      } else if (this.wavePhase === "SPAWNING") {
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          if (this.spawnQueue.length > 0) {
            const nextDef = this.spawnQueue.shift();
            this.enemies.push(new Enemy(nextDef, this.wave, WAYPOINTS));
            this.updateHUD();
          } else {
            this.wavePhase = "COMBAT";
          }
        }
        this.updateWaveStatusUI();
      }

      // Update Enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const alive = this.enemies[i].update(dt, this);
        if (!alive) {
          this.enemies.splice(i, 1);
        }
      }

      // Update Towers
      for (let i = 0; i < this.towers.length; i++) {
        this.towers[i].update(dt, this.enemies, this.projectiles, this);
      }

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const active = this.projectiles[i].update(dt, this.enemies, this);
        if (!active) {
          this.projectiles.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const alive = this.particles[i].update(dt);
        if (!alive) {
          this.particles.splice(i, 1);
        }
      }

      // Update Floating Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const alive = this.floatingTexts[i].update(dt);
        if (!alive) {
          this.floatingTexts.splice(i, 1);
        }
      }

      // Check wave completion after updates
      this.checkWaveCompletion();
    }

    // --- RENDERING PIPELINE ---
    render() {
      const ctx = this.ctx;
      ctx.save();

      // Screen shake translation
      if (this.shakeIntensity > 0) {
        const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 2;
        const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 2;
        ctx.translate(shakeX, shakeY);
      }

      // 1. Background Grid & Sectors
      this.renderBackground(ctx);

      // 2. Predefined Enemy Path & Chevrons
      this.renderPath(ctx);

      // 3. Spawn Portal & Energy Core Vault
      this.renderPortals(ctx);

      // 4. Hover Grid Preview & Selection
      this.renderGridHover(ctx);

      // 5. Towers
      for (let i = 0; i < this.towers.length; i++) {
        const isSelected = this.towers[i] === this.selectedTower;
        this.towers[i].draw(ctx, isSelected);
      }

      // 6. Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].draw(ctx);
      }

      // 7. Projectiles
      for (let i = 0; i < this.projectiles.length; i++) {
        this.projectiles[i].draw(ctx);
      }

      // 8. Particles
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i].draw(ctx);
      }

      // 9. Floating Texts
      for (let i = 0; i < this.floatingTexts.length; i++) {
        this.floatingTexts[i].draw(ctx);
      }

      ctx.restore();
    }

    renderBackground(ctx) {
      // Deep cyber background
      ctx.fillStyle = "#060a1e";
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // Grid Lines
      ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      ctx.lineWidth = 1;

      for (let c = 0; c <= CONFIG.GRID_COLS; c++) {
        const x = c * CONFIG.CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
      }

      for (let r = 0; r <= CONFIG.GRID_ROWS; r++) {
        const y = r * CONFIG.CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Subtle circuit nodes at intersections
      ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
      for (let c = 1; c < CONFIG.GRID_COLS; c++) {
        for (let r = 1; r < CONFIG.GRID_ROWS; r++) {
          if ((c + r) % 3 === 0) {
            ctx.beginPath();
            ctx.arc(c * CONFIG.CELL_SIZE, r * CONFIG.CELL_SIZE, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    renderPath(ctx) {
      // 1. Path conduit floor
      ctx.fillStyle = "rgba(10, 16, 42, 0.95)";
      this.pathCells.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        ctx.fillRect(c * CONFIG.CELL_SIZE, r * CONFIG.CELL_SIZE, CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);
      });

      // 2. Neon Conduit Center Track
      ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      for (let i = 0; i < WAYPOINTS.length; i++) {
        const center = getCellCenter(WAYPOINTS[i].col, WAYPOINTS[i].row);
        if (i === 0) ctx.moveTo(center.x, center.y);
        else ctx.lineTo(center.x, center.y);
      }
      ctx.stroke();

      // Inner bright wire
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Animated pulses traveling along path
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 32]);
      ctx.lineDashOffset = -this.pathPulseOffset;

      ctx.beginPath();
      for (let i = 0; i < WAYPOINTS.length; i++) {
        const center = getCellCenter(WAYPOINTS[i].col, WAYPOINTS[i].row);
        if (i === 0) ctx.moveTo(center.x, center.y);
        else ctx.lineTo(center.x, center.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    renderPortals(ctx) {
      // Spawn Portal (Col 0, Row 2)
      const spawnCenter = getCellCenter(WAYPOINTS[0].col, WAYPOINTS[0].row);
      ctx.save();
      ctx.translate(spawnCenter.x, spawnCenter.y);

      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#f43f5e";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
      ctx.fill();

      // Inner vortex bars
      const t = performance.now() * 0.003;
      ctx.rotate(t);
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI);
      ctx.stroke();
      ctx.restore();

      // Core Protocol Vault (Col 15, Row 7)
      const coreWp = WAYPOINTS[WAYPOINTS.length - 1];
      const coreCenter = getCellCenter(coreWp.col, coreWp.row);
      ctx.save();
      ctx.translate(coreCenter.x, coreCenter.y);

      // Rotating protective rings
      const tCore = performance.now() * 0.002;
      ctx.rotate(tCore);
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-tCore * 2);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Core pulsating reactor
      const pulseScale = 1 + Math.sin(performance.now() * 0.006) * 0.12;
      ctx.fillStyle = this.coreHealth < 30 ? "#f43f5e" : "#00f0ff";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, 9 * pulseScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    renderGridHover(ctx) {
      if (this.hoverCol < 0 || this.hoverCol >= CONFIG.GRID_COLS || this.hoverRow < 0 || this.hoverRow >= CONFIG.GRID_ROWS) {
        return;
      }

      const x = this.hoverCol * CONFIG.CELL_SIZE;
      const y = this.hoverRow * CONFIG.CELL_SIZE;
      const center = getCellCenter(this.hoverCol, this.hoverRow);
      const isBuildable = this.isCellBuildable(this.hoverCol, this.hoverRow);

      if (this.selectedBuildType) {
        const def = TOWER_TYPES[this.selectedBuildType];
        const range = def.levels[0].range;

        ctx.save();
        if (isBuildable) {
          // Valid placement hover
          ctx.strokeStyle = "#00f0ff";
          ctx.fillStyle = "rgba(0, 240, 255, 0.15)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, CONFIG.CELL_SIZE - 4, CONFIG.CELL_SIZE - 4);
          ctx.fillRect(x + 2, y + 2, CONFIG.CELL_SIZE - 4, CONFIG.CELL_SIZE - 4);

          // Projected Range Circle
          ctx.strokeStyle = def.color;
          ctx.fillStyle = def.color;
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Invalid cell warning
          ctx.strokeStyle = "#f43f5e";
          ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, CONFIG.CELL_SIZE - 4, CONFIG.CELL_SIZE - 4);
          ctx.fillRect(x + 2, y + 2, CONFIG.CELL_SIZE - 4, CONFIG.CELL_SIZE - 4);

          // Diagonal slash
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 8);
          ctx.lineTo(x + CONFIG.CELL_SIZE - 8, y + CONFIG.CELL_SIZE - 8);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Standard cell highlight
        ctx.save();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
        ctx.strokeRect(x + 1, y + 1, CONFIG.CELL_SIZE - 2, CONFIG.CELL_SIZE - 2);
        ctx.restore();
      }
    }
  }

  // --- INITIALIZE ON DOM READY ---
  window.addEventListener("DOMContentLoaded", () => {
    window.gameInstance = new NeonGridDefense();
  });
})();
