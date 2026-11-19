/**
 * ==========================================================================
 * FLAPPY CYBER JET — Core Game Engine
 * NSOC Winter Edition 2026 | Contributor: mistu7debnath
 * Pure Vanilla JavaScript • High Performance Canvas 60+ FPS Engine
 * ==========================================================================
 */

(() => {
  'use strict';

  // --- Virtual Coordinate System Constants ---
  const V_WIDTH = 480;
  const V_HEIGHT = 640;
  const CEILING_H = 16;
  const FLOOR_H = 48;

  // --- Physics Tuning ---
  const GRAVITY = 920;            // px/s^2
  const BOOST_IMPULSE = -315;     // px/s upward burst
  const MAX_FALL_VELOCITY = 460;  // px/s max downward speed
  const MAX_RISE_VELOCITY = -370; // px/s max upward speed

  // --- Obstacle Tuning ---
  const INITIAL_GAP = 175;        // px initial clearance
  const MIN_GAP = 135;            // px minimum challenging clearance
  const OBSTACLE_WIDTH = 64;      // px width of cyber pylon
  const SPAWN_DISTANCE = 260;     // px travel between new obstacle pairs
  const INITIAL_SPEED = 145;      // px/s initial obstacle horizontal speed
  const MAX_SPEED = 210;          // px/s maximum obstacle speed

  // --- Game States ---
  const STATE = {
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER',
    LEVEL_SELECT: 'LEVEL_SELECT',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE',
    VICTORY: 'VICTORY'
  };

  // --- 20-Level Mission Manifest ---
  const TOTAL_LEVELS = 20;
  const LEVEL_CONFIGS = [
    { level: 1,  name: "Neon Alley",        target: 5,  speed: 140, gap: 175, theme: 'cyan' },
    { level: 2,  name: "Grid Entry",        target: 6,  speed: 143, gap: 173, theme: 'cyan' },
    { level: 3,  name: "Data Stream",       target: 7,  speed: 146, gap: 171, theme: 'cyan' },
    { level: 4,  name: "Circuit Break",     target: 8,  speed: 150, gap: 169, theme: 'cyan' },
    { level: 5,  name: "Pulse Core",        target: 9,  speed: 153, gap: 167, theme: 'cyan' },
    { level: 6,  name: "Sub-Net Void",      target: 10, speed: 157, gap: 165, theme: 'cyan' },
    { level: 7,  name: "Cyber Pylon",       target: 11, speed: 160, gap: 163, theme: 'magenta' },
    { level: 8,  name: "Laser Canyon",      target: 12, speed: 164, gap: 161, theme: 'magenta' },
    { level: 9,  name: "Firewall Breach",   target: 13, speed: 167, gap: 159, theme: 'magenta' },
    { level: 10, name: "Synth Overdrive",   target: 14, speed: 171, gap: 157, theme: 'magenta' },
    { level: 11, name: "Vector Horizon",    target: 15, speed: 174, gap: 155, theme: 'magenta' },
    { level: 12, name: "Quantum Surge",     target: 16, speed: 178, gap: 153, theme: 'magenta' },
    { level: 13, name: "Plasma Gateway",    target: 17, speed: 181, gap: 151, theme: 'magenta' },
    { level: 14, name: "Neon Eclipse",      target: 18, speed: 185, gap: 149, theme: 'amber' },
    { level: 15, name: "Solar Storm",       target: 19, speed: 188, gap: 147, theme: 'amber' },
    { level: 16, name: "Orbital Nexus",     target: 20, speed: 192, gap: 145, theme: 'amber' },
    { level: 17, name: "Zero-Day Run",      target: 21, speed: 195, gap: 143, theme: 'amber' },
    { level: 18, name: "Hyper Warp",        target: 22, speed: 199, gap: 141, theme: 'amber' },
    { level: 19, name: "Singularity",       target: 23, speed: 202, gap: 139, theme: 'amber' },
    { level: 20, name: "Cyber Flight Omega", target: 25, speed: 206, gap: 137, theme: 'amber' }
  ];

  // --- Safe LocalStorage Manager ---
  const Storage = {
    get(key, fallback) {
      try {
        const val = localStorage.getItem(key);
        return val !== null ? JSON.parse(val) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {
        // Fallback for private browsing or disabled storage
      }
    }
  };

  // --- Central Progression & Persistence Model ---
  class ProgressionManager {
    constructor() {
      this.storageKey = 'fcj_progression_v1';
      this.inMemoryData = null;
      this.data = this.load();
    }

    load() {
      let raw = null;
      try {
        raw = localStorage.getItem(this.storageKey);
      } catch (e) {
        if (this.inMemoryData) return this.inMemoryData;
      }

      let parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          parsed = null;
        }
      }

      return this.validateAndRecover(parsed);
    }

    validateAndRecover(stored) {
      const defaultData = {
        version: 1,
        unlockedLevels: [1],
        completedLevels: [],
        bestScores: {},
        selectedLevel: 1
      };

      if (!stored || typeof stored !== 'object') {
        return defaultData;
      }

      // 1. Sanitize unlockedLevels
      let unlocked = Array.isArray(stored.unlockedLevels) ? stored.unlockedLevels : [1];
      unlocked = unlocked
        .map(n => parseInt(n, 10))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL_LEVELS);

      // Level 1 is ALWAYS unlocked
      if (!unlocked.includes(1)) {
        unlocked.push(1);
      }

      // 2. Sanitize completedLevels
      let completed = Array.isArray(stored.completedLevels) ? stored.completedLevels : [];
      completed = completed
        .map(n => parseInt(n, 10))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL_LEVELS);

      // Monotonic Progression Recovery Rule:
      // If Level K is unlocked, all preceding levels 1..(K-1) are guaranteed unlocked.
      const maxUnlocked = Math.max(...unlocked, 1);
      for (let i = 1; i <= maxUnlocked; i++) {
        if (!unlocked.includes(i)) {
          unlocked.push(i);
        }
      }

      // Any level marked as completed must also be in unlocked
      completed.forEach(lvl => {
        if (!unlocked.includes(lvl)) {
          unlocked.push(lvl);
        }
      });

      // Deduplicate and sort
      unlocked = Array.from(new Set(unlocked)).sort((a, b) => a - b);
      completed = Array.from(new Set(completed)).sort((a, b) => a - b);

      // 3. Sanitize bestScores
      const bestScores = {};
      if (stored.bestScores && typeof stored.bestScores === 'object') {
        for (const [k, v] of Object.entries(stored.bestScores)) {
          const lvl = parseInt(k, 10);
          const score = parseInt(v, 10);
          if (Number.isInteger(lvl) && lvl >= 1 && lvl <= TOTAL_LEVELS && Number.isInteger(score) && score >= 0) {
            bestScores[lvl] = score;
          }
        }
      }

      // 4. Sanitize selectedLevel
      let selected = parseInt(stored.selectedLevel, 10);
      if (!Number.isInteger(selected) || !unlocked.includes(selected)) {
        selected = unlocked[unlocked.length - 1] || 1;
      }

      const recovered = {
        version: 1,
        unlockedLevels: unlocked,
        completedLevels: completed,
        bestScores: bestScores,
        selectedLevel: selected
      };

      this.inMemoryData = recovered;
      return recovered;
    }

    save() {
      this.inMemoryData = this.data;
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      } catch (e) {
        // Fallback for private browsing or disabled storage
      }
    }

    isUnlocked(level) {
      return this.data.unlockedLevels.includes(level);
    }

    isCompleted(level) {
      return this.data.completedLevels.includes(level);
    }

    getBestScore(level) {
      return this.data.bestScores[level] || 0;
    }

    recordScore(level, score) {
      const prev = this.getBestScore(level);
      if (score > prev) {
        this.data.bestScores[level] = score;
        this.save();
        return true;
      }
      return false;
    }

    getSelectedLevel() {
      return this.data.selectedLevel;
    }

    setSelectedLevel(level) {
      if (this.isUnlocked(level)) {
        this.data.selectedLevel = level;
        this.save();
        return true;
      }
      return false;
    }

    completeLevel(level, score) {
      this.recordScore(level, score);

      if (!this.data.completedLevels.includes(level)) {
        this.data.completedLevels.push(level);
        this.data.completedLevels.sort((a, b) => a - b);
      }

      let newlyUnlocked = false;
      if (level < TOTAL_LEVELS) {
        const nextLevel = level + 1;
        if (!this.data.unlockedLevels.includes(nextLevel)) {
          this.data.unlockedLevels.push(nextLevel);
          this.data.unlockedLevels.sort((a, b) => a - b);
          newlyUnlocked = true;
        }
      }

      this.save();
      return { newlyUnlocked, completedCount: this.getCompletedCount() };
    }

    getCompletedCount() {
      return this.data.completedLevels.length;
    }

    getOverallBest() {
      const scores = Object.values(this.data.bestScores);
      return scores.length > 0 ? Math.max(...scores) : 0;
    }
  }

  // --- Web Audio API Synthesizer (Zero External Dependencies) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.isMuted = Storage.get('fcj_sound_muted', false);
      this.activeNodes = new Set();
    }

    init() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    trackNode(osc) {
      if (!this.activeNodes) this.activeNodes = new Set();
      this.activeNodes.add(osc);
      osc.onended = () => {
        if (this.activeNodes) this.activeNodes.delete(osc);
      };
      return osc;
    }

    stopAll() {
      if (this.activeNodes) {
        this.activeNodes.forEach(node => {
          try {
            node.stop();
            node.disconnect();
          } catch (_) {}
        });
        this.activeNodes.clear();
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        this.stopAll();
      }
      Storage.set('fcj_sound_muted', this.isMuted);
      return this.isMuted;
    }

    playThrust() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.12);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.12);
      } catch (e) {}
    }

    playScore() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        // Two-tone bright cyber chime
        [587.33, 880].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteTime = t + i * 0.05;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.18, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          this.trackNode(osc);
          osc.start(noteTime);
          osc.stop(noteTime + 0.18);
        });
      } catch (e) {}
    }

    playCrash() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.35);
      } catch (e) {}
    }

    playNewRecord() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteTime = t + i * 0.08;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.25, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          this.trackNode(osc);
          osc.start(noteTime);
          osc.stop(noteTime + 0.22);
        });
      } catch (e) {}
    }

    playClick() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        this.trackNode(osc);
        osc.start(t);
        osc.stop(t + 0.04);
      } catch (e) {}
    }

    playLevelComplete() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteTime = t + i * 0.08;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.24, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          this.trackNode(osc);
          osc.start(noteTime);
          osc.stop(noteTime + 0.25);
        });
      } catch (e) {}
    }

    playVictory() {
      if (this.isMuted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const noteTime = t + i * 0.11;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, noteTime);

          gain.gain.setValueAtTime(0.26, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          this.trackNode(osc);
          osc.start(noteTime);
          osc.stop(noteTime + 0.4);
        });
      } catch (e) {}
    }
  }

  // --- Cyber Jet Player Entity ---
  class CyberJet {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = 110;
      this.y = 280;
      this.width = 44;
      this.height = 22;
      this.radiusX = 18;
      this.radiusY = 10;
      this.vy = 0;
      this.rotation = 0;
      this.targetRotation = 0;
      this.thrustPulse = 0;
      this.trailTimer = 0;
    }

    boost() {
      this.vy = BOOST_IMPULSE;
      this.thrustPulse = 1.0;
    }

    update(dt, particles) {
      // Gravity acceleration
      this.vy += GRAVITY * dt;

      // Clamp velocities
      if (this.vy > MAX_FALL_VELOCITY) this.vy = MAX_FALL_VELOCITY;
      if (this.vy < MAX_RISE_VELOCITY) this.vy = MAX_RISE_VELOCITY;

      // Apply vertical movement
      this.y += this.vy * dt;

      // Smooth dynamic rotation based on velocity
      // Negative rotation = pitch up (-26 deg), Positive rotation = pitch down (+45 deg)
      this.targetRotation = Math.max(-0.45, Math.min(0.75, this.vy * 0.0018));
      this.rotation += (this.targetRotation - this.rotation) * Math.min(1, dt * 14);

      // Decay thrust pulse
      if (this.thrustPulse > 0) {
        this.thrustPulse = Math.max(0, this.thrustPulse - dt * 4.5);
      }

      // Spawn afterburner trail particles
      this.trailTimer += dt;
      const trailInterval = this.thrustPulse > 0.2 ? 0.015 : 0.04;
      if (this.trailTimer >= trailInterval) {
        this.trailTimer = 0;
        const tailOffsetDist = 20;
        const tailX = this.x - Math.cos(this.rotation) * tailOffsetDist;
        const tailY = this.y - Math.sin(this.rotation) * tailOffsetDist;

        particles.addThrusterParticle(
          tailX,
          tailY,
          -120 - Math.random() * 80,
          (Math.random() - 0.5) * 40,
          this.thrustPulse > 0.3
        );
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // 1. Afterburner Flame Jet
      const flameLength = 16 + this.thrustPulse * 24 + Math.random() * 6;
      const flameWidth = 7 + this.thrustPulse * 5;

      // Outer plasma flame
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = this.thrustPulse > 0.3 ? '#f59e0b' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-18, -flameWidth * 0.5);
      ctx.lineTo(-18 - flameLength, 0);
      ctx.lineTo(-18, flameWidth * 0.5);
      ctx.closePath();
      ctx.fill();

      // Inner intense core flame
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-18, -flameWidth * 0.25);
      ctx.lineTo(-18 - flameLength * 0.6, 0);
      ctx.lineTo(-18, flameWidth * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Main Wings & Delta Fuselage (Stealth Jet Shape)
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;

      // Wings base
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(22, 0);       // Nose cone
      ctx.lineTo(-6, -18);     // Right wing tip
      ctx.lineTo(-14, -14);    // Right wing corner
      ctx.lineTo(-10, -6);     // Right intake
      ctx.lineTo(-18, -5);     // Right engine nozzle
      ctx.lineTo(-18, 5);      // Left engine nozzle
      ctx.lineTo(-10, 6);      // Left intake
      ctx.lineTo(-14, 14);     // Left wing corner
      ctx.lineTo(-6, 18);      // Left wing tip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top fuselage armor plate
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-4, -7);
      ctx.lineTo(-16, -4);
      ctx.lineTo(-16, 4);
      ctx.lineTo(-4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit glowing glass canopy
      const canopyGrad = ctx.createLinearGradient(-2, 0, 16, 0);
      canopyGrad.addColorStop(0, '#0284c7');
      canopyGrad.addColorStop(0.5, '#00f0ff');
      canopyGrad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = canopyGrad;
      ctx.beginPath();
      ctx.ellipse(4, 0, 9, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wingtip Neon Light Beacons (Magenta)
      ctx.fillStyle = '#ec4899';
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-6, -17, 2, 0, Math.PI * 2);
      ctx.arc(-6, 17, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
    }
  }

  // --- Obstacle Pair (Cyber Neon Energy Pylons) ---
  class ObstaclePair {
    constructor(x, gap, speed, theme) {
      this.x = x;
      this.width = OBSTACLE_WIDTH;
      this.gap = gap;
      this.speed = speed;
      this.theme = theme; // 'cyan' | 'magenta' | 'amber'
      this.passed = false;
      this.pulseTime = Math.random() * 10;

      // Calculate safe randomized vertical gap position
      const minTop = CEILING_H + 45;
      const maxTop = V_HEIGHT - FLOOR_H - this.gap - 45;
      this.topHeight = Math.floor(minTop + Math.random() * (maxTop - minTop));
      this.bottomY = this.topHeight + this.gap;
      this.bottomHeight = V_HEIGHT - FLOOR_H - this.bottomY;
    }

    update(dt) {
      this.x -= this.speed * dt;
      this.pulseTime += dt;
    }

    draw(ctx) {
      const pulse = 0.75 + Math.sin(this.pulseTime * 4) * 0.25;
      const primaryColor = this.theme === 'magenta' ? '#ec4899' : (this.theme === 'amber' ? '#f59e0b' : '#00f0ff');
      const dimColor = this.theme === 'magenta' ? 'rgba(236,72,153,0.3)' : (this.theme === 'amber' ? 'rgba(245,158,11,0.3)' : 'rgba(0,240,255,0.3)');

      // Draw Top Pylon
      this.drawPylon(ctx, this.x, 0, this.width, this.topHeight, true, primaryColor, dimColor, pulse);

      // Draw Bottom Pylon
      this.drawPylon(ctx, this.x, this.bottomY, this.width, this.bottomHeight, false, primaryColor, dimColor, pulse);

      // Draw Faint Energy Barrier Hazard Arcs across the gap edges
      ctx.save();
      ctx.strokeStyle = primaryColor;
      ctx.globalAlpha = 0.2 + pulse * 0.2;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(this.x + this.width * 0.5, this.topHeight);
      ctx.lineTo(this.x + this.width * 0.5, this.bottomY);
      ctx.stroke();
      ctx.restore();
    }

    drawPylon(ctx, x, y, w, h, isTop, primaryColor, dimColor, pulse) {
      if (h <= 0) return;

      ctx.save();
      // 1. Solid gunmetal pillar body
      ctx.fillStyle = '#090f1d';
      ctx.fillRect(x, y, w, h);

      // 2. Interior Circuit/Energy Conduit
      const conduitX = x + w * 0.5;
      ctx.strokeStyle = dimColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(conduitX, y);
      ctx.lineTo(conduitX, y + h);
      ctx.stroke();

      // Pulsing energy nodes on conduit
      const nodeStep = 32;
      ctx.fillStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8 * pulse;
      for (let ny = y + 16; ny < y + h - 16; ny += nodeStep) {
        ctx.beginPath();
        ctx.arc(conduitX, ny, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Neon Border Edges
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 10 * pulse;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();

      // 4. Emitter Cap facing the gap
      const capH = 14;
      const capY = isTop ? y + h - capH : y;

      // Heavy emitter bracket
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x - 3, capY, w + 6, capH);

      // Emitter lip highlight
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (isTop) {
        ctx.moveTo(x - 3, capY + capH);
        ctx.lineTo(x + w + 3, capY + capH);
      } else {
        ctx.moveTo(x - 3, capY);
        ctx.lineTo(x + w + 3, capY);
      }
      ctx.stroke();

      // Emitter glowing diodes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const diodeY = isTop ? capY + capH - 4 : capY + 4;
      ctx.arc(x + 12, diodeY, 2.5, 0, Math.PI * 2);
      ctx.arc(x + w * 0.5, diodeY, 3, 0, Math.PI * 2);
      ctx.arc(x + w - 12, diodeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // --- Particle FX Engine ---
  class ParticleEngine {
    constructor() {
      this.particles = [];
      this.floatingTexts = [];
      this.rings = [];
    }

    reset() {
      this.particles = [];
      this.floatingTexts = [];
      this.rings = [];
    }

    addThrusterParticle(x, y, vx, vy, isBoost) {
      this.particles.push({
        type: 'exhaust',
        x,
        y,
        vx,
        vy,
        size: isBoost ? 4 + Math.random() * 3 : 2 + Math.random() * 2,
        alpha: 1,
        life: 0,
        maxLife: isBoost ? 0.45 : 0.28,
        color: isBoost ? (Math.random() > 0.5 ? '#f59e0b' : '#00f0ff') : '#38bdf8'
      });
    }

    addScoreRing(x, y) {
      this.rings.push({
        x,
        y,
        radius: 10,
        maxRadius: 45,
        alpha: 1,
        color: '#00f0ff'
      });
      this.floatingTexts.push({
        x,
        y: y - 10,
        vy: -55,
        text: '+1',
        alpha: 1,
        life: 0,
        maxLife: 0.8
      });
    }

    addExplosion(x, y) {
      // 50 colorful sparks & shrapnel
      const colors = ['#ffffff', '#00f0ff', '#38bdf8', '#ec4899', '#f59e0b'];
      for (let i = 0; i < 55; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 220;
        this.particles.push({
          type: 'spark',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3.5,
          alpha: 1,
          life: 0,
          maxLife: 0.5 + Math.random() * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }

      // Explosion Shockwave Ring
      this.rings.push({
        x,
        y,
        radius: 8,
        maxRadius: 75,
        alpha: 1,
        color: '#f43f5e'
      });
    }

    addVictorySparks(x, y) {
      const colors = ['#fde047', '#00f0ff', '#10b981', '#ffffff', '#ec4899'];
      for (let i = 0; i < 65; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 250;
        this.particles.push({
          type: 'spark',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 60,
          size: 2.5 + Math.random() * 4,
          alpha: 1,
          life: 0,
          maxLife: 0.8 + Math.random() * 0.5,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }

      this.rings.push({
        x,
        y,
        radius: 10,
        maxRadius: 100,
        alpha: 1,
        color: '#00f0ff'
      });
    }

    update(dt) {
      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha = 1 - (p.life / p.maxLife);
        if (p.type === 'spark') {
          p.vy += 300 * dt; // gravity on sparks
        }
      }

      // Update rings
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.radius += (r.maxRadius - r.radius) * dt * 8;
        r.alpha -= dt * 2.2;
        if (r.alpha <= 0 || r.radius >= r.maxRadius - 1) {
          this.rings.splice(i, 1);
        }
      }

      // Update floating texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.life += dt;
        if (ft.life >= ft.maxLife) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        ft.y += ft.vy * dt;
        ft.alpha = 1 - (ft.life / ft.maxLife);
      }
    }

    draw(ctx) {
      // Draw Expanding Rings
      this.rings.forEach(r => {
        ctx.save();
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.lineWidth = 3;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // Draw Particles
      this.particles.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Floating Scores
      this.floatingTexts.forEach(ft => {
        ctx.save();
        ctx.font = 'bold 20px ui-monospace, Consolas, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });
    }
  }

  // --- Environment & Background Renderer ---
  class CyberEnvironment {
    constructor() {
      this.gridOffset = 0;
      this.cityOffset = 0;
      this.stars = [];
      this.initStars();
    }

    initStars() {
      this.stars = [];
      for (let i = 0; i < 60; i++) {
        this.stars.push({
          x: Math.random() * V_WIDTH,
          y: Math.random() * (V_HEIGHT - FLOOR_H),
          size: 0.8 + Math.random() * 1.6,
          speed: 15 + Math.random() * 35,
          alpha: 0.3 + Math.random() * 0.7
        });
      }
    }

    update(dt, speed) {
      const activeSpeed = speed || INITIAL_SPEED;

      // Scroll stars
      this.stars.forEach(s => {
        s.x -= s.speed * dt;
        if (s.x < 0) {
          s.x = V_WIDTH;
          s.y = Math.random() * (V_HEIGHT - FLOOR_H);
        }
      });

      // Scroll city skyline
      this.cityOffset = (this.cityOffset + activeSpeed * 0.35 * dt) % 180;

      // Scroll grid floor
      this.gridOffset = (this.gridOffset + activeSpeed * dt) % 30;
    }

    draw(ctx) {
      // 1. Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
      skyGrad.addColorStop(0, '#040711');
      skyGrad.addColorStop(0.6, '#090f23');
      skyGrad.addColorStop(1, '#11182e');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      // 2. Stars / Cyber Dust
      ctx.fillStyle = '#ffffff';
      this.stars.forEach(s => {
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1.0;

      // 3. Distant City Skyline Silhouettes
      ctx.save();
      ctx.fillStyle = '#0c1222';
      const buildingWidth = 36;
      const startX = -this.cityOffset;
      for (let bx = startX; bx < V_WIDTH + buildingWidth * 2; bx += buildingWidth) {
        const heightFactor = Math.abs(Math.sin((bx + this.cityOffset) * 0.05));
        const bHeight = 50 + heightFactor * 90;
        const bY = V_HEIGHT - FLOOR_H - bHeight;
        ctx.fillRect(bx, bY, buildingWidth - 3, bHeight);

        // Cyber window grid
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        for (let wy = bY + 10; wy < V_HEIGHT - FLOOR_H - 10; wy += 14) {
          ctx.fillRect(bx + 6, wy, 4, 6);
          ctx.fillRect(bx + 16, wy, 4, 6);
          ctx.fillRect(bx + 26, wy, 4, 6);
        }
        ctx.fillStyle = '#0c1222';

        // Rooftop antenna strobe beacon
        if (heightFactor > 0.6) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx + buildingWidth * 0.5, bY);
          ctx.lineTo(bx + buildingWidth * 0.5, bY - 14);
          ctx.stroke();

          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(bx + buildingWidth * 0.5, bY - 14, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 4. Floor Grid (Synthwave Perspective Grid)
      const floorY = V_HEIGHT - FLOOR_H;
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, floorY, V_WIDTH, FLOOR_H);

      // Horizon glowing laser line
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(V_WIDTH, floorY);
      ctx.stroke();
      ctx.restore();

      // Floor vertical scrolling grid lines
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 1.2;
      for (let gx = -this.gridOffset; gx < V_WIDTH + 30; gx += 30) {
        ctx.beginPath();
        ctx.moveTo(gx, floorY);
        ctx.lineTo(gx - 20, V_HEIGHT);
        ctx.stroke();
      }
      // Floor horizontal depth lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      [floorY + 12, floorY + 26, floorY + 40].forEach(hy => {
        ctx.beginPath();
        ctx.moveTo(0, hy);
        ctx.lineTo(V_WIDTH, hy);
        ctx.stroke();
      });
      ctx.restore();

      // 5. Ceiling Boundary Warning Stripe
      ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
      ctx.fillRect(0, 0, V_WIDTH, CEILING_H);
      ctx.save();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, CEILING_H);
      ctx.lineTo(V_WIDTH, CEILING_H);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ==========================================================================
  // Main Flappy Cyber Jet Game Controller
  // ==========================================================================
  class GameController {
    constructor() {
      // DOM Elements
      this.canvas = document.getElementById('fcj-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.app = document.getElementById('fcj-app');
      this.container = document.getElementById('fcj-game-container');

      // HUD & Overlays
      this.hudScore = document.getElementById('fcj-hud-score');
      this.hudGoal = document.getElementById('fcj-hud-goal');
      this.hudBest = document.getElementById('fcj-hud-best');
      this.hudLevel = document.getElementById('fcj-hud-level');
      this.btnSound = document.getElementById('fcj-btn-sound');
      this.btnPause = document.getElementById('fcj-btn-pause');
      this.soundIcon = document.getElementById('fcj-sound-icon');
      this.pauseIcon = document.getElementById('fcj-pause-icon');

      // Screens & Cards
      this.startScreen = document.getElementById('fcj-start-screen');
      this.pauseScreen = document.getElementById('fcj-pause-screen');
      this.gameOverScreen = document.getElementById('fcj-gameover-screen');
      this.levelScreen = document.getElementById('fcj-level-screen');
      this.completeScreen = document.getElementById('fcj-complete-screen');
      this.victoryScreen = document.getElementById('fcj-victory-screen');

      // Screen Data Bindings
      this.startBestVal = document.getElementById('fcj-start-best');
      this.startProgressVal = document.getElementById('fcj-start-progress-val');
      this.btnStartText = document.getElementById('fcj-btn-start-text');
      this.btnOpenLevels = document.getElementById('fcj-btn-open-levels');

      // Level Selection Screen Elements
      this.levelGrid = document.getElementById('fcj-level-grid');
      this.levelProgressCount = document.getElementById('fcj-level-progress-count');
      this.progressBarFill = document.getElementById('fcj-progress-bar-fill');
      this.selectedName = document.getElementById('fcj-selected-name');
      this.selectedMeta = document.getElementById('fcj-selected-meta');
      this.btnLevelLaunch = document.getElementById('fcj-btn-level-launch');
      this.btnLevelLaunchText = document.getElementById('fcj-level-launch-text');
      this.btnLevelBack = document.getElementById('fcj-btn-level-back');

      // Pause Screen Data Bindings
      this.pauseScoreVal = document.getElementById('fcj-pause-score');
      this.pauseGoalVal = document.getElementById('fcj-pause-goal');
      this.btnResume = document.getElementById('fcj-btn-resume');
      this.btnPauseRestart = document.getElementById('fcj-btn-pause-restart');
      this.btnPauseLevels = document.getElementById('fcj-btn-pause-levels');

      // Level Complete Screen Data Bindings
      this.completeTitle = document.getElementById('fcj-complete-title');
      this.completeTagline = document.getElementById('fcj-complete-tagline');
      this.completeScoreVal = document.getElementById('fcj-complete-score');
      this.completeBestVal = document.getElementById('fcj-complete-best');
      this.btnCompleteNext = document.getElementById('fcj-btn-complete-next');
      this.btnCompleteReplay = document.getElementById('fcj-btn-complete-replay');
      this.btnCompleteLevels = document.getElementById('fcj-btn-complete-levels');

      // Victory Screen Data Bindings
      this.victoryScoreVal = document.getElementById('fcj-victory-score');
      this.btnVictoryReplay = document.getElementById('fcj-btn-victory-replay');
      this.btnVictoryLevels = document.getElementById('fcj-btn-victory-levels');
      this.btnVictoryMenu = document.getElementById('fcj-btn-victory-menu');

      // Game Over Screen Data Bindings
      this.gameoverScoreVal = document.getElementById('fcj-gameover-score');
      this.gameoverGoalVal = document.getElementById('fcj-gameover-goal');
      this.newRecordBadge = document.getElementById('fcj-new-record-badge');
      this.btnRestart = document.getElementById('fcj-btn-restart');
      this.btnGameoverLevels = document.getElementById('fcj-btn-gameover-levels');
      this.btnMenu = document.getElementById('fcj-btn-menu');
      this.btnStart = document.getElementById('fcj-btn-start');
      this.liveAnnouncer = document.getElementById('fcj-live-announcer');

      // Engine Subsystems
      this.sound = new SoundFX();
      this.jet = new CyberJet();
      this.particles = new ParticleEngine();
      this.env = new CyberEnvironment();
      this.progression = new ProgressionManager();

      // State Management
      this.state = STATE.START;
      this.score = 0;
      this.currentLevel = this.progression.getSelectedLevel() || 1;
      this.levelCompletedInRound = false;
      this.bestScore = Storage.get('fcj_best_score', 0);
      this.isNewRecord = false;

      // Obstacle management
      this.obstacles = [];
      this.obstacleTravelSinceLastSpawn = 0;

      // Animation Loop Control
      this.lastTime = 0;
      this.rafId = null;
      this.screenShake = 0;

      // Canvas DPI / Scale Matrix
      this.scale = 1;
      this.offsetX = 0;
      this.offsetY = 0;

      this.init();
    }

    init() {
      this.updateBestScoreDisplay();
      this.updateProgressionUI();
      this.updateSoundButtonUI();
      this.handleResize();

      // Attach Event Listeners
      window.addEventListener('resize', () => this.handleResize());
      this.bindInputs();

      // Announce initial screen
      this.announce('Flappy Cyber Jet ready. Select Launch Level to begin.');

      // Start the core render loop
      this.lastTime = performance.now();
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame((ts) => this.loop(ts));
    }

    getLevelConfig(level) {
      const lvl = Math.max(1, Math.min(TOTAL_LEVELS, parseInt(level, 10) || 1));
      return LEVEL_CONFIGS[lvl - 1];
    }

    // --- High-DPI Canvas Sizing ---
    handleResize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      // Fit virtual 480x640 within container rect while preserving 3:4 aspect
      const containerAspect = rect.width / rect.height;
      const gameAspect = V_WIDTH / V_HEIGHT;

      let displayW, displayH;
      if (containerAspect > gameAspect) {
        displayH = rect.height;
        displayW = displayH * gameAspect;
      } else {
        displayW = rect.width;
        displayH = displayW / gameAspect;
      }

      this.scale = displayW / V_WIDTH;

      this.canvas.width = Math.round(displayW * dpr);
      this.canvas.height = Math.round(displayH * dpr);

      // Internal transform to virtual coordinate space
      this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, 0, 0);
    }

    // --- Inputs & Event Listeners ---
    bindInputs() {
      // Primary Action Trigger (Space, ArrowUp, KeyW)
      window.addEventListener('keydown', (e) => {
        // Unlock audio context on initial keypress
        this.sound.init();

        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          // Prevent page scrolling on Space / ArrowUp
          e.preventDefault();
          this.handleActionTrigger();
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          this.handlePauseToggle();
        } else if (e.code === 'KeyM') {
          this.handleSoundToggle();
        } else if (e.code === 'Enter') {
          if (this.state === STATE.GAMEOVER) {
            this.startRound(this.currentLevel);
          } else if (this.state === STATE.START) {
            this.startRound(this.progression.getSelectedLevel());
          } else if (this.state === STATE.LEVEL_SELECT) {
            this.startRound(this.progression.getSelectedLevel());
          } else if (this.state === STATE.LEVEL_COMPLETE) {
            if (this.currentLevel < TOTAL_LEVELS) {
              this.startRound(this.currentLevel + 1);
            } else {
              this.startRound(this.currentLevel);
            }
          } else if (this.state === STATE.VICTORY) {
            this.showLevelSelection();
          }
        }
      });

      // Canvas Pointer/Touch Input (only boosts during gameplay)
      this.canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === STATE.PLAYING) {
          this.handleActionTrigger();
        }
      });

      // --- Start Screen UI Buttons ---
      this.btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.init();
        this.sound.playClick();
        this.startRound(this.progression.getSelectedLevel());
      });

      if (this.btnOpenLevels) {
        this.btnOpenLevels.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.init();
          this.sound.playClick();
          this.showLevelSelection();
        });
      }

      // --- Level Selection Screen Buttons ---
      if (this.btnLevelLaunch) {
        this.btnLevelLaunch.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.init();
          this.sound.playClick();
          this.startRound(this.progression.getSelectedLevel());
        });
      }

      if (this.btnLevelBack) {
        this.btnLevelBack.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.init();
          this.sound.playClick();
          this.showStartScreen();
        });
      }

      // --- Pause Screen Buttons ---
      this.btnResume.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.playClick();
        this.resumeGame();
      });

      this.btnPauseRestart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.playClick();
        this.startRound(this.currentLevel);
      });

      if (this.btnPauseLevels) {
        this.btnPauseLevels.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.showLevelSelection();
        });
      }

      // --- Game Over Screen Buttons ---
      this.btnRestart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.playClick();
        this.startRound(this.currentLevel);
      });

      if (this.btnGameoverLevels) {
        this.btnGameoverLevels.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.showLevelSelection();
        });
      }

      this.btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.playClick();
        this.showStartScreen();
      });

      // --- Level Complete Screen Buttons ---
      if (this.btnCompleteNext) {
        this.btnCompleteNext.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.startRound(this.currentLevel + 1);
        });
      }

      if (this.btnCompleteReplay) {
        this.btnCompleteReplay.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.startRound(this.currentLevel);
        });
      }

      if (this.btnCompleteLevels) {
        this.btnCompleteLevels.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.showLevelSelection();
        });
      }

      // --- Victory Screen Buttons ---
      if (this.btnVictoryReplay) {
        this.btnVictoryReplay.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.startRound(TOTAL_LEVELS);
        });
      }

      if (this.btnVictoryLevels) {
        this.btnVictoryLevels.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.showLevelSelection();
        });
      }

      if (this.btnVictoryMenu) {
        this.btnVictoryMenu.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.playClick();
          this.showStartScreen();
        });
      }

      // --- HUD Top Buttons ---
      this.btnPause.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.playClick();
        this.handlePauseToggle();
      });

      this.btnSound.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSoundToggle();
      });
    }

    handleActionTrigger() {
      if (this.state === STATE.PLAYING) {
        this.jet.boost();
        this.sound.playThrust();
      } else if (this.state === STATE.START) {
        this.startRound(this.progression.getSelectedLevel());
      } else if (this.state === STATE.GAMEOVER) {
        this.startRound(this.currentLevel);
      }
    }

    handlePauseToggle() {
      if (this.state === STATE.PLAYING) {
        this.pauseGame();
      } else if (this.state === STATE.PAUSED) {
        this.resumeGame();
      }
    }

    handleSoundToggle() {
      this.sound.init();
      const muted = this.sound.toggleMute();
      this.updateSoundButtonUI();
      if (!muted) this.sound.playClick();
    }

    updateSoundButtonUI() {
      const SVG_VOL_ON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';
      const SVG_VOL_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
      if (this.sound.isMuted) {
        this.soundIcon.innerHTML = SVG_VOL_OFF;
        this.btnSound.setAttribute('aria-label', 'Unmute sound');
      } else {
        this.soundIcon.innerHTML = SVG_VOL_ON;
        this.btnSound.setAttribute('aria-label', 'Mute sound');
      }
    }

    updateBestScoreDisplay() {
      const overall = Math.max(this.bestScore, this.progression.getOverallBest());
      this.bestScore = overall;
      this.hudBest.textContent = overall;
      this.startBestVal.textContent = overall;
    }

    announce(text) {
      if (this.liveAnnouncer) {
        this.liveAnnouncer.textContent = text;
      }
    }

    // --- Progression UI & Level Grid Synchronization ---
    updateProgressionUI() {
      const completedCount = this.progression.getCompletedCount();
      if (this.startProgressVal) {
        this.startProgressVal.textContent = `${completedCount}/20`;
      }

      const selectedLvl = this.progression.getSelectedLevel();
      const numStr = String(selectedLvl).padStart(2, '0');
      if (this.btnStartText) {
        this.btnStartText.textContent = `LAUNCH LEVEL ${numStr}`;
      }

      if (this.levelProgressCount) {
        this.levelProgressCount.textContent = `${completedCount}/20 COMPLETED`;
      }

      if (this.progressBarFill) {
        const pct = Math.min(100, Math.round((completedCount / TOTAL_LEVELS) * 100));
        this.progressBarFill.style.width = `${pct}%`;
        const pb = document.getElementById('fcj-progress-bar');
        if (pb) pb.setAttribute('aria-valuenow', completedCount);
      }

      this.updateSelectedInfoBanner();
    }

    updateSelectedInfoBanner() {
      const selected = this.progression.getSelectedLevel();
      const cfg = this.getLevelConfig(selected);
      const numStr = String(selected).padStart(2, '0');
      const best = this.progression.getBestScore(selected);

      if (this.selectedName) {
        this.selectedName.textContent = `LEVEL ${numStr}: ${cfg.name.toUpperCase()}`;
      }

      if (this.selectedMeta) {
        const statusText = this.progression.isCompleted(selected) ? 'COMPLETED' : 'INCOMPLETE';
        this.selectedMeta.textContent = `TARGET: ${cfg.target} PYLONS • BEST: ${best} • ${statusText}`;
      }

      if (this.btnLevelLaunchText) {
        this.btnLevelLaunchText.textContent = `START MISSION ${numStr}`;
      }
    }

    renderLevelGrid() {
      if (!this.levelGrid) return;
      this.levelGrid.innerHTML = '';

      const selectedLvl = this.progression.getSelectedLevel();

      // Exactly 20 tiles rendered
      for (let i = 1; i <= TOTAL_LEVELS; i++) {
        const isUnlocked = this.progression.isUnlocked(i);
        const isCompleted = this.progression.isCompleted(i);
        const isSelected = (i === selectedLvl);
        const cfg = this.getLevelConfig(i);

        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'fcj-level-tile';
        tile.dataset.level = String(i);

        if (!isUnlocked) {
          tile.classList.add('fcj-tile-locked');
          tile.setAttribute('aria-disabled', 'true');
          tile.tabIndex = -1;
        } else if (isCompleted) {
          tile.classList.add('fcj-tile-completed');
          tile.setAttribute('aria-disabled', 'false');
          tile.tabIndex = 0;
        } else {
          tile.classList.add('fcj-tile-unlocked');
          tile.setAttribute('aria-disabled', 'false');
          tile.tabIndex = 0;
        }

        if (isSelected) {
          tile.classList.add('fcj-tile-selected');
          tile.setAttribute('aria-current', 'true');
        }

        const numStr = String(i).padStart(2, '0');
        let statusIcon = '';
        let statusDesc = '';

        if (!isUnlocked) {
          statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
          statusDesc = 'Locked';
        } else if (isCompleted) {
          statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 12 4 16"></polyline></svg>';
          statusDesc = `Completed, Best score ${this.progression.getBestScore(i)}`;
        } else {
          statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
          statusDesc = 'Unlocked';
        }

        tile.setAttribute('aria-label', `Level ${numStr}: ${cfg.name}, ${statusDesc}`);
        tile.innerHTML = `
          <span class="fcj-tile-num">${numStr}</span>
          <span class="fcj-tile-status">${statusIcon}</span>
        `;

        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sound.init();
          if (!isUnlocked) {
            this.sound.playClick();
            return;
          }
          this.sound.playClick();
          this.selectLevel(i);
        });

        this.levelGrid.appendChild(tile);
      }

      this.updateProgressionUI();
    }

    selectLevel(level) {
      if (!this.progression.isUnlocked(level)) return;
      this.progression.setSelectedLevel(level);

      // Update tile selection highlights
      if (this.levelGrid) {
        const tiles = this.levelGrid.querySelectorAll('.fcj-level-tile');
        tiles.forEach(t => {
          if (parseInt(t.dataset.level, 10) === level) {
            t.classList.add('fcj-tile-selected');
            t.setAttribute('aria-current', 'true');
          } else {
            t.classList.remove('fcj-tile-selected');
            t.removeAttribute('aria-current');
          }
        });
      }

      this.updateProgressionUI();
      const cfg = this.getLevelConfig(level);
      this.announce(`Selected Level ${level}: ${cfg.name}`);
    }

    // --- State Transitions ---
    showLevelSelection() {
      this.state = STATE.LEVEL_SELECT;
      this.startScreen.classList.add('fcj-hidden');
      this.pauseScreen.classList.add('fcj-hidden');
      this.gameOverScreen.classList.add('fcj-hidden');
      this.completeScreen.classList.add('fcj-hidden');
      this.victoryScreen.classList.add('fcj-hidden');

      this.renderLevelGrid();
      this.levelScreen.classList.remove('fcj-hidden');
      this.announce('Mission selection screen open. Select a mission.');
    }

    showStartScreen() {
      this.state = STATE.START;
      this.updateBestScoreDisplay();
      this.updateProgressionUI();

      this.startScreen.classList.remove('fcj-hidden');
      this.pauseScreen.classList.add('fcj-hidden');
      this.gameOverScreen.classList.add('fcj-hidden');
      this.levelScreen.classList.add('fcj-hidden');
      this.completeScreen.classList.add('fcj-hidden');
      this.victoryScreen.classList.add('fcj-hidden');

      this.jet.reset();
      this.obstacles = [];
      this.particles.reset();
      this.announce('Returned to main menu.');
    }

    startRound(levelNum) {
      // Resolve level to launch
      const targetLevel = (typeof levelNum === 'number' && this.progression.isUnlocked(levelNum))
        ? levelNum
        : (this.progression.getSelectedLevel() || 1);

      this.currentLevel = targetLevel;
      this.progression.setSelectedLevel(this.currentLevel);

      // Fresh round state initialization
      this.sound.stopAll();
      this.state = STATE.PLAYING;
      this.score = 0;
      this.levelCompletedInRound = false;
      this.isNewRecord = false;

      const config = this.getLevelConfig(this.currentLevel);
      this.hudScore.textContent = '0';
      if (this.hudGoal) this.hudGoal.textContent = config.target;
      if (this.hudLevel) this.hudLevel.textContent = String(this.currentLevel).padStart(2, '0');
      this.hudBest.textContent = this.progression.getBestScore(this.currentLevel);

      this.obstacleTravelSinceLastSpawn = SPAWN_DISTANCE; // trigger immediate obstacle
      this.obstacles = [];
      this.particles.reset();
      this.jet.reset();
      this.screenShake = 0;

      // Hide all overlays
      this.startScreen.classList.add('fcj-hidden');
      this.pauseScreen.classList.add('fcj-hidden');
      this.gameOverScreen.classList.add('fcj-hidden');
      this.levelScreen.classList.add('fcj-hidden');
      this.completeScreen.classList.add('fcj-hidden');
      this.victoryScreen.classList.add('fcj-hidden');
      this.newRecordBadge.classList.add('fcj-hidden');

      this.announce(`Mission ${this.currentLevel}: ${config.name} launched! Clear ${config.target} obstacles.`);
      this.lastTime = performance.now();
    }

    pauseGame() {
      if (this.state !== STATE.PLAYING) return;
      this.state = STATE.PAUSED;

      this.pauseScoreVal.textContent = this.score;
      if (this.pauseGoalVal) {
        this.pauseGoalVal.textContent = this.getLevelConfig(this.currentLevel).target;
      }
      this.pauseScreen.classList.remove('fcj-hidden');
      this.announce('Flight paused.');
    }

    resumeGame() {
      if (this.state !== STATE.PAUSED) return;
      this.state = STATE.PLAYING;
      this.pauseScreen.classList.add('fcj-hidden');
      this.lastTime = performance.now();
      this.announce('Flight resumed.');
    }

    triggerLevelComplete() {
      this.sound.playScore();

      // Persist completion and unlock next level
      this.progression.completeLevel(this.currentLevel, this.score);
      this.updateBestScoreDisplay();
      this.updateProgressionUI();

      if (this.currentLevel === TOTAL_LEVELS) {
        // Level 20 Final Victory!
        this.state = STATE.VICTORY;
        this.sound.playVictory();
        this.particles.addVictorySparks(this.jet.x, this.jet.y);
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'ARCADEVERSE_GAME_OVER',
              score: this.score,
              details: { score: this.score, level: this.currentLevel, cleared: true, victory: true }
            }, '*');
          }
        } catch (_) {}

        if (this.victoryScoreVal) {
          this.victoryScoreVal.textContent = this.score;
        }

        setTimeout(() => {
          if (this.state === STATE.VICTORY) {
            this.victoryScreen.classList.remove('fcj-hidden');
            this.announce('CYBER FLIGHT COMPLETE! All 20 missions conquered! You are the ultimate cyber pilot!');
          }
        }, 300);
      } else {
        // Level 1-19 Completion
        this.state = STATE.LEVEL_COMPLETE;
        this.sound.playLevelComplete();
        this.particles.addVictorySparks(this.jet.x, this.jet.y);

        const nextLvl = this.currentLevel + 1;
        const nextCfg = this.getLevelConfig(nextLvl);
        const curNumStr = String(this.currentLevel).padStart(2, '0');

        if (this.completeTitle) {
          this.completeTitle.textContent = `LEVEL ${curNumStr} COMPLETE`;
        }
        if (this.completeTagline) {
          this.completeTagline.textContent = `Sector cleared! Level ${String(nextLvl).padStart(2, '0')}: ${nextCfg.name} unlocked!`;
        }
        if (this.completeScoreVal) {
          this.completeScoreVal.textContent = this.score;
        }
        if (this.completeBestVal) {
          this.completeBestVal.textContent = this.progression.getBestScore(this.currentLevel);
        }

        setTimeout(() => {
          if (this.state === STATE.LEVEL_COMPLETE) {
            this.completeScreen.classList.remove('fcj-hidden');
            this.announce(`Level ${this.currentLevel} complete! Level ${nextLvl} unlocked.`);
          }
        }, 300);
      }
    }

    triggerGameOver() {
      this.state = STATE.GAMEOVER;
      this.sound.stopAll();
      this.sound.playCrash();
      this.screenShake = 0.35; // 350ms shake
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'ARCADEVERSE_GAME_OVER',
            score: this.score,
            details: { score: this.score, level: this.currentLevel, cleared: false }
          }, '*');
        }
      } catch (_) {}

      // Explosion sparks
      this.particles.addExplosion(this.jet.x, this.jet.y);

      // Check record for this level
      const recordBroken = this.progression.recordScore(this.currentLevel, this.score);
      this.updateBestScoreDisplay();
      this.updateProgressionUI();

      if (recordBroken) {
        this.newRecordBadge.classList.remove('fcj-hidden');
        setTimeout(() => this.sound.playNewRecord(), 400);
      } else {
        this.newRecordBadge.classList.add('fcj-hidden');
      }

      // Populate game over modal
      this.gameoverScoreVal.textContent = this.score;
      if (this.gameoverGoalVal) {
        this.gameoverGoalVal.textContent = this.getLevelConfig(this.currentLevel).target;
      }

      // Reveal game over overlay after brief impact pause
      setTimeout(() => {
        if (this.state === STATE.GAMEOVER) {
          this.gameOverScreen.classList.remove('fcj-hidden');
          this.announce(`Mission over. Final score: ${this.score}. Level target was: ${this.getLevelConfig(this.currentLevel).target}.`);
        }
      }, 350);
    }

    // --- Dynamic Difficulty Progression per Level ---
    getCurrentSpeed() {
      const cfg = this.getLevelConfig(this.currentLevel);
      return Math.min(MAX_SPEED, cfg.speed + this.score * 1.5);
    }

    getCurrentGap() {
      const cfg = this.getLevelConfig(this.currentLevel);
      return Math.max(MIN_GAP, cfg.gap - this.score * 1.0);
    }

    getCurrentTheme() {
      return this.getLevelConfig(this.currentLevel).theme;
    }

    // --- Collision Detection ---
    checkCollisions() {
      const jx = this.jet.x;
      const jy = this.jet.y;
      const rx = this.jet.radiusX;
      const ry = this.jet.radiusY;

      // 1. Boundary Collisions (Ceiling & Floor)
      if (jy - ry <= CEILING_H) {
        return true;
      }
      if (jy + ry >= V_HEIGHT - FLOOR_H) {
        return true;
      }

      // 2. Obstacle Collisions
      // Inset obstacle hitbox by 3px for player-friendly collision feel
      const inset = 3;
      for (let i = 0; i < this.obstacles.length; i++) {
        const obs = this.obstacles[i];
        const ox = obs.x + inset;
        const ow = obs.width - inset * 2;

        // Quick AABB horizontal check
        if (jx + rx > ox && jx - rx < ox + ow) {
          // Check collision with top pylon
          const topH = obs.topHeight;
          if (jy - ry < topH) {
            return true;
          }
          // Check collision with bottom pylon
          const botY = obs.bottomY;
          if (jy + ry > botY) {
            return true;
          }
        }
      }

      return false;
    }

    // --- Core Game Loop ---
    loop(timestamp) {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame((ts) => this.loop(ts));

      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      this.update(dt);
      this.render();
    }

    update(dt) {
      if (this.state === STATE.PLAYING) {
        const currentSpeed = this.getCurrentSpeed();

        // Update Environment background
        this.env.update(dt, currentSpeed);

        // Update Jet Physics
        this.jet.update(dt, this.particles);

        // Spawn & Update Obstacles
        this.obstacleTravelSinceLastSpawn += currentSpeed * dt;
        if (this.obstacleTravelSinceLastSpawn >= SPAWN_DISTANCE) {
          this.obstacleTravelSinceLastSpawn = 0;
          const newGap = this.getCurrentGap();
          const newTheme = this.getCurrentTheme();
          this.obstacles.push(new ObstaclePair(V_WIDTH + 10, newGap, currentSpeed, newTheme));
        }

        // Update Obstacles position & scoring
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
          const obs = this.obstacles[i];
          obs.update(dt);

          // Score detection: once jet passes center of obstacle
          if (!obs.passed && this.jet.x > obs.x + obs.width * 0.5) {
            obs.passed = true;
            this.score++;
            this.hudScore.textContent = this.score;
            this.sound.playScore();
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: this.score, level: this.currentLevel }, '*');
              }
            } catch (_) {}

            // Spawn score ring & floating +1 at gap center
            const gapCenterY = obs.topHeight + obs.gap * 0.5;
            this.particles.addScoreRing(this.jet.x, gapCenterY);

            // Level completion check
            const targetScore = this.getLevelConfig(this.currentLevel).target;
            if (!this.levelCompletedInRound && this.score >= targetScore) {
              this.levelCompletedInRound = true;
              this.triggerLevelComplete();
              return;
            }

            // Announce milestone every 10 points
            if (this.score % 10 === 0) {
              this.announce(`Score ${this.score}`);
            }
          }

          // Cull off-screen obstacles
          if (obs.x + obs.width < -20) {
            this.obstacles.splice(i, 1);
          }
        }

        // Check for collisions
        if (this.checkCollisions()) {
          this.triggerGameOver();
        }
      } else if (this.state === STATE.START || this.state === STATE.LEVEL_SELECT) {
        // Idle environment animation
        this.env.update(dt, 50);
        // Idle hover animation for jet
        this.jet.y = 280 + Math.sin(performance.now() * 0.003) * 12;
      }

      // Update screen shake
      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt);
      }

      // Update Particles & FX
      this.particles.update(dt);
    }

    render() {
      this.ctx.save();

      // Screen Shake Displacement
      if (this.screenShake > 0) {
        const intensity = this.screenShake * 16;
        const sx = (Math.random() - 0.5) * intensity;
        const sy = (Math.random() - 0.5) * intensity;
        this.ctx.translate(sx, sy);
      }

      // 1. Draw Background Environment (Stars, Skyline, Horizon, Floor)
      this.env.draw(this.ctx);

      // 2. Draw Obstacles
      this.obstacles.forEach(obs => obs.draw(this.ctx));

      // 3. Draw Particles & FX
      this.particles.draw(this.ctx);

      // 4. Draw Jet (if not completely crashed or destroyed)
      if (this.state !== STATE.GAMEOVER || this.screenShake > 0.15) {
        this.jet.draw(this.ctx);
      }

      this.ctx.restore();
    }
  }

  // --- Bootstrap Engine on DOM Load ---
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new GameController();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && controller && controller.state === STATE.PLAYING) {
        controller.pauseGame();
      }
    });

    window.addEventListener('message', (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      const type = e.data.type;
      if (type === 'ARCADEVERSE_PAUSE') {
        if (controller && controller.state === STATE.PLAYING) controller.pauseGame();
      } else if (type === 'ARCADEVERSE_RESUME') {
        if (controller && controller.state === STATE.PAUSED) controller.resumeGame();
      } else if (type === 'ARCADEVERSE_TEARDOWN') {
        if (controller) {
          if (controller.sound) controller.sound.stopAll();
          if (controller.rafId) { cancelAnimationFrame(controller.rafId); controller.rafId = null; }
        }
      } else if (type === 'AV_RESIZE') {
        if (controller) controller.handleResize();
      }
    });
  });

})();
