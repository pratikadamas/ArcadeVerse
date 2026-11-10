/**
 * DINO DIG — Complete Visual Redesign & Functional Gameplay
 * NSOC Winter Edition 2026 | Contributor: mistu7debnath
 * Pure Vanilla HTML5 Canvas + Web Audio API. 100% self-contained.
 */

(function () {
  'use strict';

  // =========================================================================
  // CONSTANTS & GAME DEFINITIONS
  // =========================================================================

  const CANVAS_WIDTH = 670;
  const CANVAS_HEIGHT = 420;
  const STORAGE_KEY = 'dinoDig_progress';
  const STORAGE_KEY_MUTED = 'dinoDig_muted';

  const TILE_TYPE = {
    SOIL_SURFACE: 0,
    SOIL_DEEP: 1,
    ROCK: 2
  };

  const CONTENT_TYPE = {
    EMPTY: 'empty',
    FOSSIL: 'fossil',
    COIN: 'coin',
    GEM: 'gem',
    CANTEEN: 'canteen'
  };

  const TOOLS = {
    BRUSH: { id: 'brush', name: 'Brush', cost: 2 },
    SHOVEL: { id: 'shovel', name: 'Shovel', cost: 4 },
    PICKAXE: { id: 'pickaxe', name: 'Pickaxe', cost: 6 },
    RADAR: { id: 'radar', name: 'Radar', cost: 8 }
  };

  const CHAR_STATE = {
    IDLE: 'idle',
    WALKING: 'walking',
    BRUSHING: 'brushing',
    SHOVELING: 'shoveling',
    PICKING: 'picking',
    SCANNING: 'scanning',
    CELEBRATING: 'celebrating'
  };

  // Dinosaur Species & Bone Anatomy
  const DINOSAURS = {
    triceratops: {
      id: 'triceratops',
      name: 'Triceratops Prorsus',
      commonName: 'Triceratops',
      diet: 'Herbivore',
      era: 'Late Cretaceous',
      desc: 'Three-horned ceratopsian possessing a solid frill shield and heavy parrot-like beak.',
      bones: [
        { id: 'tri_skull', name: 'Triple-Horned Skull', points: 150, part: 'head' },
        { id: 'tri_ribs', name: 'Massive Ribcage', points: 100, part: 'body' },
        { id: 'tri_frill', name: 'Neck Frill Shield', points: 120, part: 'frill' },
        { id: 'tri_leg', name: 'Pillar Foreleg', points: 90, part: 'leg' }
      ]
    },
    stegosaurus: {
      id: 'stegosaurus',
      name: 'Stegosaurus Stenops',
      commonName: 'Stegosaurus',
      diet: 'Armored Herbivore',
      era: 'Late Jurassic',
      desc: 'Famous armored quadruped sporting double dorsal alternating plates and spiked tail.',
      bones: [
        { id: 'stego_plates', name: 'Dorsal Spine Plates', points: 180, part: 'plates' },
        { id: 'stego_tail', name: 'Spiked Thagomizer Tail', points: 160, part: 'tail' },
        { id: 'stego_skull', name: 'Beaked Skull', points: 120, part: 'head' },
        { id: 'stego_ribs', name: 'Armored Ribcage', points: 110, part: 'body' }
      ]
    },
    trex: {
      id: 'trex',
      name: 'Tyrannosaurus rex',
      commonName: 'T-Rex',
      diet: 'Apex Carnivore',
      era: 'Late Cretaceous',
      desc: 'The apex tyrant king featuring 8-inch serrated teeth and immense crushing jaw strength.',
      bones: [
        { id: 'trex_skull', name: 'Massive Apex Skull', points: 250, part: 'head' },
        { id: 'trex_leg', name: 'Powerful Hind Leg', points: 150, part: 'leg' },
        { id: 'trex_ribs', name: 'Serrated Ribcage', points: 140, part: 'body' },
        { id: 'trex_tail', name: 'Counterbalance Tail', points: 130, part: 'tail' }
      ]
    },
    brachiosaurus: {
      id: 'brachiosaurus',
      name: 'Brachiosaurus Altithorax',
      commonName: 'Brachiosaurus',
      diet: 'Sauropod Titan',
      era: 'Late Jurassic',
      desc: 'Towering high-browsing titan with front legs longer than hind legs and soaring vertebrae.',
      bones: [
        { id: 'brach_skull', name: 'Crested High Skull', points: 160, part: 'head' },
        { id: 'brach_neck', name: 'Soaring Neck Vertebrae', points: 220, part: 'neck' },
        { id: 'brach_ribs', name: 'Colossal Barrel Ribs', points: 180, part: 'body' },
        { id: 'brach_leg', name: 'Giraffe-Like Foreleg', points: 150, part: 'leg' }
      ]
    }
  };

  // Exactly 5 Progressively Challenging Excavation Sites
  // Every site requires finding 2 dinosaur fossils to complete!
  const SITES = [
    {
      id: 1,
      name: 'Shallow Meadows',
      sub: 'Site 1/5: Beginner Dig',
      cols: 6,
      rows: 5,
      maxEnergy: 100,
      targetFossils: ['tri_skull', 'tri_ribs'],
      coinsCount: 3,
      gemsCount: 1,
      canteensCount: 2,
      rockRatio: 0.1
    },
    {
      id: 2,
      name: 'Woodland Basin',
      sub: 'Site 2/5: Forest Excavation',
      cols: 6,
      rows: 5,
      maxEnergy: 100,
      targetFossils: ['stego_plates', 'stego_tail'],
      coinsCount: 4,
      gemsCount: 2,
      canteensCount: 2,
      rockRatio: 0.2
    },
    {
      id: 3,
      name: 'Arid Canyon',
      sub: 'Site 3/5: Rocky Valley',
      cols: 7,
      rows: 5,
      maxEnergy: 105,
      targetFossils: ['tri_frill', 'tri_leg'],
      coinsCount: 4,
      gemsCount: 2,
      canteensCount: 2,
      rockRatio: 0.28
    },
    {
      id: 4,
      name: 'Badlands Dunes',
      sub: 'Site 4/5: Ancient Desert',
      cols: 7,
      rows: 5,
      maxEnergy: 110,
      targetFossils: ['trex_skull', 'trex_leg'],
      coinsCount: 5,
      gemsCount: 3,
      canteensCount: 2,
      rockRatio: 0.32
    },
    {
      id: 5,
      name: 'Volcanic Caldera',
      sub: 'Site 5/5: Prehistoric Discovery',
      cols: 7,
      rows: 5,
      maxEnergy: 120,
      targetFossils: ['brach_skull', 'brach_neck'],
      coinsCount: 6,
      gemsCount: 3,
      canteensCount: 3,
      rockRatio: 0.38
    }
  ];

  // =========================================================================
  // PROCEDURAL AUDIO SYNTHESIZER (Web Audio API)
  // =========================================================================

  class DinoAudio {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.loadMuteState();
    }

    loadMuteState() {
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
      } catch (e) {}
      return this.isMuted;
    }

    ensureContext() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
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

    playNoise(duration, filterFreq = 500, gainLevel = 0.18) {
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

    playBrush() {
      this.playNoise(0.18, 750, 0.14);
    }

    playShovel() {
      this.playNoise(0.24, 450, 0.22);
      this.playTone(130, 'triangle', 0.16, 0.14);
    }

    playPickaxe() {
      this.playTone(720, 'sine', 0.08, 0.22);
      this.playNoise(0.2, 900, 0.24);
    }

    playRadar() {
      if (this.isMuted || !this.ensureContext()) return;
      const now = this.ctx.currentTime;
      [880, 1175, 1480].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.12, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.14);
      });
    }

    playFossilFound() {
      if (this.isMuted || !this.ensureContext()) return;
      const notes = [440, 554, 659, 880, 1108];
      const now = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.16, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.28);
      });
    }

    playCoin() {
      this.playTone(987, 'sine', 0.12, 0.14);
      setTimeout(() => this.playTone(1318, 'sine', 0.16, 0.14), 70);
    }

    playCanteen() {
      this.playTone(330, 'triangle', 0.16, 0.16);
      setTimeout(() => this.playTone(440, 'triangle', 0.22, 0.18), 100);
    }

    playMountBone() {
      this.playTone(523, 'triangle', 0.12, 0.16);
      setTimeout(() => this.playTone(659, 'triangle', 0.18, 0.18), 90);
    }

    playSiteComplete() {
      if (this.isMuted || !this.ensureContext()) return;
      const notes = [523, 659, 784, 1046, 1318];
      const now = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    }

    playFail() {
      this.playTone(280, 'sawtooth', 0.25, 0.16);
      setTimeout(() => this.playTone(160, 'sawtooth', 0.35, 0.16), 180);
    }
  }

  // =========================================================================
  // PARTICLES & FLOATING FEEDBACK TEXTS
  // =========================================================================

  class FloatingText {
    constructor(x, y, text, color = '#fef08a', size = 15, sub = '') {
      this.x = x;
      this.y = y;
      this.text = text;
      this.sub = sub;
      this.color = color;
      this.size = size;
      this.alpha = 1;
      this.life = 1.1;
      this.maxLife = 1.1;
      this.vy = -34;
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
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillText(this.text, this.x, this.y);

      if (this.sub) {
        ctx.font = `bold ${Math.max(10, this.size - 4)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.sub, this.x, this.y + 14);
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
      this.gravity = 130;
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
        ctx.rect(this.x - this.size * 0.5, this.y - this.size * 0.5, this.size, this.size);
      } else {
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  // =========================================================================
  // ANIMATED FEMALE ARCHAEOLOGIST CHARACTER CLASS
  // =========================================================================

  class ArchaeologistCharacter {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.targetX = x;
      this.targetY = y;
      this.state = CHAR_STATE.IDLE;
      this.stateTimer = 0;
      this.facing = 1; // 1 = right, -1 = left
      this.walkSpeed = 160;
      this.walkCycle = 0;
      this.blinkTimer = 2.5;
      this.isBlinking = false;
      this.actionTargetTile = null;
      this.onActionComplete = null;
    }

    setTarget(tx, ty, actionTile, onComplete) {
      this.actionTargetTile = actionTile;
      this.onActionComplete = onComplete;

      // Position character slightly to the left or right of the tile
      const targetSideOffset = tx > this.x ? -36 : 36;
      this.targetX = Math.max(40, Math.min(CANVAS_WIDTH - 40, tx + targetSideOffset));
      this.targetY = ty;
      this.facing = tx >= this.x ? 1 : -1;

      const dist = Math.hypot(this.targetX - this.x, this.targetY - this.y);
      if (dist > 10) {
        this.state = CHAR_STATE.WALKING;
      } else {
        this.startExcavationAction();
      }
    }

    startExcavationAction() {
      if (!this.actionTargetTile) return;
      const toolId = this.actionTargetTile.toolId;

      if (toolId === 'brush') this.state = CHAR_STATE.BRUSHING;
      else if (toolId === 'shovel') this.state = CHAR_STATE.SHOVELING;
      else if (toolId === 'pickaxe') this.state = CHAR_STATE.PICKING;
      else if (toolId === 'radar') this.state = CHAR_STATE.SCANNING;
      else this.state = CHAR_STATE.IDLE;

      this.stateTimer = 0;
    }

    celebrate() {
      this.state = CHAR_STATE.CELEBRATING;
      this.stateTimer = 0;
    }

    update(dt) {
      this.stateTimer += dt;

      // Eye Blinking logic
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        if (this.blinkTimer <= -0.15) {
          this.isBlinking = false;
          this.blinkTimer = 2.5 + Math.random() * 2.5;
        }
      }

      // State handling
      if (this.state === CHAR_STATE.WALKING) {
        this.walkCycle += dt * 10;
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= 6) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.startExcavationAction();
        } else {
          this.x += (dx / dist) * this.walkSpeed * dt;
          this.y += (dy / dist) * this.walkSpeed * dt;
          this.facing = dx >= 0 ? 1 : -1;
        }
      } else if (
        this.state === CHAR_STATE.BRUSHING ||
        this.state === CHAR_STATE.SHOVELING ||
        this.state === CHAR_STATE.PICKING ||
        this.state === CHAR_STATE.SCANNING
      ) {
        // Digging Action duration is 0.45 seconds
        if (this.stateTimer >= 0.45) {
          if (this.onActionComplete) {
            this.onActionComplete();
            this.onActionComplete = null;
          }
          this.state = CHAR_STATE.IDLE;
          this.stateTimer = 0;
        }
      } else if (this.state === CHAR_STATE.CELEBRATING) {
        if (this.stateTimer >= 1.2) {
          this.state = CHAR_STATE.IDLE;
          this.stateTimer = 0;
        }
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing, 1);

      // Character Shadow on ground
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 36, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Idle breathing / bobbing offset
      let bobY = 0;
      let armAngle = 0;
      let legOffset = 0;

      if (this.state === CHAR_STATE.IDLE) {
        bobY = Math.sin(this.stateTimer * 3.5) * 2;
      } else if (this.state === CHAR_STATE.WALKING) {
        bobY = Math.abs(Math.sin(this.walkCycle)) * 4;
        legOffset = Math.sin(this.walkCycle) * 8;
      } else if (this.state === CHAR_STATE.CELEBRATING) {
        bobY = -Math.abs(Math.sin(this.stateTimer * 8)) * 14;
      } else if (this.state === CHAR_STATE.BRUSHING) {
        bobY = 4; // Kneeling
        armAngle = Math.sin(this.stateTimer * 20) * 0.4;
      } else if (this.state === CHAR_STATE.SHOVELING) {
        bobY = 2;
        armAngle = Math.sin(this.stateTimer * 14) * 0.6;
      } else if (this.state === CHAR_STATE.PICKING) {
        armAngle = -Math.cos(this.stateTimer * 16) * 0.8;
      }

      ctx.translate(0, bobY);

      // 1. Backpack (Brown leather explorer pack)
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-22, -8, 12, 24, 4);
      ctx.fill();
      ctx.stroke();

      // Canteen bottle attached to backpack
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(-16, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // 2. Legs & Boots (Explorer khaki shorts + leather boots)
      // Left Leg
      ctx.fillStyle = '#b45309'; // Khaki shorts
      ctx.fillRect(-8, 12, 6, 12);
      ctx.fillStyle = '#54260a'; // Leather Boots
      ctx.fillRect(-9 + legOffset * 0.5, 24, 8, 12);

      // Right Leg
      ctx.fillStyle = '#b45309';
      ctx.fillRect(2, 12, 6, 12);
      ctx.fillStyle = '#54260a';
      ctx.fillRect(1 - legOffset * 0.5, 24, 8, 12);

      // 3. Body / Safari Vest & Belt
      ctx.fillStyle = '#d97706'; // Safari jacket
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-10, -10, 20, 24, 4);
      ctx.fill();
      ctx.stroke();

      // Inner cream explorer shirt
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(4, -10);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Brown Explorer Utility Belt & Buckle
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-10, 8, 20, 4);
      ctx.fillStyle = '#fbbf24'; // Brass buckle
      ctx.fillRect(-3, 7, 6, 6);

      // 4. Head, Face & Hair
      ctx.save();
      ctx.translate(0, -22);

      // Adventurer Hair (Chestnut brown ponytail behind head)
      ctx.fillStyle = '#54260a';
      ctx.beginPath();
      ctx.arc(-12, 2, 8, 0, Math.PI * 2);
      ctx.fill();

      // Cute Cartoon Face
      ctx.fillStyle = '#fde68a'; // Warm skin tone
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();

      // Expressive Eyes with Highlights
      if (!this.isBlinking) {
        // Sclera / Pupil
        ctx.fillStyle = '#1e1008';
        ctx.beginPath();
        ctx.ellipse(3, -1, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // White Catchlight sparkle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(4, -2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Blinking line
        ctx.strokeStyle = '#1e1008';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(1, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
      }

      // Rosy Cheeks
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.beginPath();
      ctx.arc(5, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Friendly smile
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(3, 4, 3, 0.1, Math.PI * 0.8);
      ctx.stroke();

      // 5. Explorer Hat with Goggles
      ctx.fillStyle = '#92400e'; // Hat brim
      ctx.beginPath();
      ctx.ellipse(0, -10, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#b45309'; // Hat crown
      ctx.beginPath();
      ctx.roundRect(-10, -22, 20, 13, [6, 6, 0, 0]);
      ctx.fill();

      // Hat Band
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-10, -12, 20, 3);

      // Explorer Goggles resting on hat
      ctx.fillStyle = '#d97706'; // Leather strap
      ctx.fillRect(-11, -17, 22, 3);

      // Goggle Lenses (brass rims + cyan glass reflection)
      [-4, 4].forEach(gx => {
        ctx.fillStyle = '#fbbf24'; // Brass rim
        ctx.beginPath();
        ctx.arc(gx, -16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8'; // Glass lens
        ctx.beginPath();
        ctx.arc(gx, -16, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff'; // Glint
        ctx.beginPath();
        ctx.arc(gx - 1, -17, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore(); // restore head

      // 6. Arms and Active Tool in Hand
      ctx.save();
      ctx.translate(6, -2);
      ctx.rotate(armAngle);

      // Arm / Sleeve
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-2, 0, 5, 14);
      // Hand / Glove
      ctx.fillStyle = '#54260a';
      ctx.beginPath();
      ctx.arc(0, 15, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Render Active Held Tool
      this.drawHeldTool(ctx);

      ctx.restore();

      ctx.restore();
    }

    drawHeldTool(ctx) {
      if (this.state === CHAR_STATE.BRUSHING) {
        // Archaeological Brush
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(8, 26);
        ctx.stroke();
        // Bristles
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(6, 26, 6, 6);
      } else if (this.state === CHAR_STATE.SHOVELING) {
        // Shovel
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-2, 10);
        ctx.lineTo(10, 30);
        ctx.stroke();
        // Metal Blade
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(8, 28);
        ctx.lineTo(16, 36);
        ctx.lineTo(12, 40);
        ctx.lineTo(4, 32);
        ctx.closePath();
        ctx.fill();
      } else if (this.state === CHAR_STATE.PICKING) {
        // Heavy Pickaxe
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        ctx.lineTo(12, 32);
        ctx.stroke();
        // Pick Head
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(4, 26);
        ctx.lineTo(20, 22);
        ctx.lineTo(12, 38);
        ctx.closePath();
        ctx.fill();
      } else if (this.state === CHAR_STATE.SCANNING) {
        // Georadar Device with glowing beacon
        ctx.fillStyle = '#10b981';
        ctx.fillRect(4, 12, 8, 12);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, 12);
        ctx.lineTo(8, 4);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(8, 4, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.state === CHAR_STATE.CELEBRATING) {
        // Holding a glowing golden fossil piece up!
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(8, 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // =========================================================================
  // MAIN GAME ENGINE
  // =========================================================================

  class DinoDigGame {
    constructor() {
      this.canvas = document.getElementById('dd-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.skeletonCanvas = document.getElementById('dd-skeleton-canvas');
      this.skeletonCtx = this.skeletonCanvas ? this.skeletonCanvas.getContext('2d') : null;

      this.audio = new DinoAudio();

      // State Data
      this.score = 0;
      this.bestScore = 0;
      this.coins = 0;
      this.currentSiteIndex = 0;
      this.energy = 100;
      this.maxEnergy = 100;
      this.activeTool = TOOLS.BRUSH;

      // Persistence tracking
      this.discoveredBones = new Set();
      this.assembledBones = new Set();
      this.completedSites = new Set();
      this.selectedMuseumDino = 'triceratops';

      // Grid Model
      this.grid = [];
      this.gridCols = 6;
      this.gridRows = 5;
      this.tileSize = 64;
      this.gridStartX = 0;
      this.gridStartY = 0;

      // Archaeologist Character
      this.character = new ArchaeologistCharacter(120, 200);

      // Interaction & Animation
      this.hoverCol = -1;
      this.hoverRow = -1;
      this.particles = [];
      this.floatingTexts = [];
      this.lastTimestamp = 0;
      this.animTime = 0;

      // Dom cache
      this.initDom();

      // Load save file
      this.loadProgress();

      // Attach event listeners
      this.initListeners();

      // Immediately launch Site 1 (Active gameplay on load!)
      this.startSite(0);

      // Start rendering loop
      requestAnimationFrame(this.loop.bind(this));
    }

    // -----------------------------------------------------------------------
    // DOM CACHING & SETUP
    // -----------------------------------------------------------------------

    initDom() {
      // Modals
      this.museumScreen = document.getElementById('dd-museum-screen');
      this.pauseScreen = document.getElementById('dd-pause-screen');
      this.clearScreen = document.getElementById('dd-clear-screen');
      this.failScreen = document.getElementById('dd-fail-screen');
      this.helpScreen = document.getElementById('dd-help-screen');

      // Top HUD elements
      this.hudScore = document.getElementById('dd-hud-score');
      this.hudCoins = document.getElementById('dd-hud-coins');
      this.hudFossils = document.getElementById('dd-hud-fossils');
      this.hudStage = document.getElementById('dd-hud-stage');
      this.hudEnergyText = document.getElementById('dd-hud-energy-text');
      this.hudEnergyFill = document.getElementById('dd-hud-energy-fill');
      this.energyWrap = document.getElementById('dd-energy-wrap');

      // Right Information Panel Elements
      this.objProgress = document.getElementById('dd-obj-progress');
      this.objBarFill = document.getElementById('dd-obj-bar-fill');

      // Slots
      this.slotElements = [
        {
          wrap: document.getElementById('dd-slot-0'),
          iconBox: document.getElementById('dd-slot-icon-0'),
          name: document.getElementById('dd-slot-name-0'),
          sub: document.getElementById('dd-slot-sub-0')
        },
        {
          wrap: document.getElementById('dd-slot-1'),
          iconBox: document.getElementById('dd-slot-icon-1'),
          name: document.getElementById('dd-slot-name-1'),
          sub: document.getElementById('dd-slot-sub-1')
        }
      ];

      // Audio & Pause buttons
      this.btnSound = document.getElementById('dd-btn-sound');
      this.soundOnIcon = this.btnSound.querySelector('.dd-icon-sound-on');
      this.soundOffIcon = this.btnSound.querySelector('.dd-icon-sound-off');
      this.btnPause = document.getElementById('dd-btn-pause');
      this.pauseIcon = this.btnPause.querySelector('.dd-icon-pause');
      this.resumeIcon = this.btnPause.querySelector('.dd-icon-resume');

      // Tool Buttons
      this.toolBtns = {
        brush: document.getElementById('dd-tool-brush'),
        shovel: document.getElementById('dd-tool-shovel'),
        pickaxe: document.getElementById('dd-tool-pickaxe'),
        radar: document.getElementById('dd-tool-radar')
      };

      // Top Museum Navigation
      this.btnNavMuseum = document.getElementById('dd-btn-nav-museum');

      // Announcer
      this.announcer = document.getElementById('dd-live-announcer');

      // Sync sound UI
      this.refreshSoundUI();
    }

    refreshSoundUI() {
      if (this.audio.isMuted) {
        this.soundOnIcon.classList.add('dd-hidden');
        this.soundOffIcon.classList.remove('dd-hidden');
      } else {
        this.soundOnIcon.classList.remove('dd-hidden');
        this.soundOffIcon.classList.add('dd-hidden');
      }
    }

    announce(text) {
      if (this.announcer) this.announcer.textContent = text;
    }

    // -----------------------------------------------------------------------
    // LOCALSTORAGE PERSISTENCE
    // -----------------------------------------------------------------------

    loadProgress() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          this.bestScore = data.bestScore || 0;
          this.coins = data.coins || 0;
          if (Array.isArray(data.discoveredBones)) {
            this.discoveredBones = new Set(data.discoveredBones);
          }
          if (Array.isArray(data.assembledBones)) {
            this.assembledBones = new Set(data.assembledBones);
          }
          if (Array.isArray(data.completedSites)) {
            this.completedSites = new Set(data.completedSites);
          }
        }
      } catch (e) {
        this.bestScore = 0;
        this.coins = 0;
      }
      this.updateHud();
    }

    saveProgress() {
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
      }
      try {
        const data = {
          bestScore: this.bestScore,
          coins: this.coins,
          discoveredBones: Array.from(this.discoveredBones),
          assembledBones: Array.from(this.assembledBones),
          completedSites: Array.from(this.completedSites)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {}
    }

    // -----------------------------------------------------------------------
    // INPUT & INTERACTION
    // -----------------------------------------------------------------------

    initListeners() {
      // Keyboard input
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;

        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          this.selectTool(TOOLS.BRUSH);
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.selectTool(TOOLS.SHOVEL);
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          this.selectTool(TOOLS.PICKAXE);
        } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
          this.selectTool(TOOLS.RADAR);
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          this.togglePause();
        } else if (e.code === 'KeyM') {
          this.audio.toggleMute();
          this.refreshSoundUI();
        }
      });

      // Canvas pointer motion & clicking
      this.canvas.addEventListener('pointermove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        this.updateHoverTile(mouseX, mouseY);
      });

      this.canvas.addEventListener('pointerleave', () => {
        this.hoverCol = -1;
        this.hoverRow = -1;
      });

      this.canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        this.updateHoverTile(mouseX, mouseY);
        if (this.hoverCol >= 0 && this.hoverRow >= 0) {
          this.orderExcavation(this.hoverCol, this.hoverRow);
        }
      });

      // Tool bar button clicks
      Object.entries(this.toolBtns).forEach(([key, btn]) => {
        if (!btn) return;
        btn.addEventListener('click', () => {
          if (key === 'brush') this.selectTool(TOOLS.BRUSH);
          else if (key === 'shovel') this.selectTool(TOOLS.SHOVEL);
          else if (key === 'pickaxe') this.selectTool(TOOLS.PICKAXE);
          else if (key === 'radar') this.selectTool(TOOLS.RADAR);
        });
      });

      // Top HUD Buttons
      this.btnSound.addEventListener('click', () => {
        this.audio.toggleMute();
        this.refreshSoundUI();
      });

      this.btnPause.addEventListener('click', () => this.togglePause());
      this.btnNavMuseum.addEventListener('click', () => this.openMuseum());

      // Museum Modal Buttons & Tabs
      document.getElementById('dd-btn-museum-back').addEventListener('click', () => this.closeMuseum());
      const museumTabs = document.querySelectorAll('.dd-tab-btn');
      museumTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          museumTabs.forEach(t => t.classList.remove('dd-tab-active'));
          tab.classList.add('dd-tab-active');
          this.selectedMuseumDino = tab.dataset.dino;
          this.renderMuseumExhibit();
        });
      });

      // Pause Modal Buttons
      document.getElementById('dd-btn-resume').addEventListener('click', () => this.resume());
      document.getElementById('dd-btn-pause-museum').addEventListener('click', () => this.openMuseum());
      document.getElementById('dd-btn-pause-restart').addEventListener('click', () => {
        this.pauseScreen.classList.add('dd-hidden');
        this.startSite(this.currentSiteIndex);
      });
      document.getElementById('dd-btn-pause-help').addEventListener('click', () => {
        this.pauseScreen.classList.add('dd-hidden');
        this.openHelp();
      });

      // Stage Clear Modal Buttons
      document.getElementById('dd-btn-next-stage').addEventListener('click', () => {
        this.clearScreen.classList.add('dd-hidden');
        const nextIdx = (this.currentSiteIndex + 1) % SITES.length;
        this.startSite(nextIdx);
      });
      document.getElementById('dd-btn-clear-museum').addEventListener('click', () => {
        this.clearScreen.classList.add('dd-hidden');
        this.openMuseum();
      });

      // Fail Modal Buttons
      document.getElementById('dd-btn-retry-stage').addEventListener('click', () => {
        this.failScreen.classList.add('dd-hidden');
        this.startSite(this.currentSiteIndex);
      });
      document.getElementById('dd-btn-fail-museum').addEventListener('click', () => {
        this.failScreen.classList.add('dd-hidden');
        this.openMuseum();
      });

      // Help Modal Close Button
      document.getElementById('dd-btn-help-close').addEventListener('click', () => {
        this.helpScreen.classList.add('dd-hidden');
      });
    }

    selectTool(tool) {
      this.activeTool = tool;
      Object.entries(this.toolBtns).forEach(([key, btn]) => {
        if (!btn) return;
        if (key === tool.id) {
          btn.classList.add('dd-tool-active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('dd-tool-active');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
      this.announce(`Equipped ${tool.name}. Energy cost: ${tool.cost}`);
    }

    updateHoverTile(mx, my) {
      if (
        mx >= this.gridStartX &&
        mx < this.gridStartX + this.gridCols * this.tileSize &&
        my >= this.gridStartY &&
        my < this.gridStartY + this.gridRows * this.tileSize
      ) {
        this.hoverCol = Math.floor((mx - this.gridStartX) / this.tileSize);
        this.hoverRow = Math.floor((my - this.gridStartY) / this.tileSize);
      } else {
        this.hoverCol = -1;
        this.hoverRow = -1;
      }
    }

    // -----------------------------------------------------------------------
    // SITE EXCAVATION GENERATION
    // -----------------------------------------------------------------------

    startSite(siteIdx) {
      this.currentSiteIndex = siteIdx;
      const site = SITES[siteIdx];

      // Hide modals
      this.museumScreen.classList.add('dd-hidden');
      this.pauseScreen.classList.add('dd-hidden');
      this.clearScreen.classList.add('dd-hidden');
      this.failScreen.classList.add('dd-hidden');
      this.helpScreen.classList.add('dd-hidden');

      this.gridCols = site.cols;
      this.gridRows = site.rows;
      this.maxEnergy = site.maxEnergy;
      this.energy = site.maxEnergy;

      // Fit grid inside excavation area nicely
      this.tileSize = 64;
      const totalWidth = this.gridCols * this.tileSize;
      const totalHeight = this.gridRows * this.tileSize;
      this.gridStartX = Math.round((CANVAS_WIDTH - totalWidth) * 0.5);
      this.gridStartY = Math.round((CANVAS_HEIGHT - totalHeight) * 0.5) + 10;

      // Place Character at comfortable initial standing position
      this.character.x = this.gridStartX + 40;
      this.character.y = this.gridStartY - 10;
      this.character.targetX = this.character.x;
      this.character.targetY = this.character.y;
      this.character.state = CHAR_STATE.IDLE;

      // Generate Grid Layout
      this.grid = [];
      for (let r = 0; r < this.gridRows; r++) {
        const row = [];
        for (let c = 0; c < this.gridCols; c++) {
          let tileType = TILE_TYPE.SOIL_SURFACE;
          let durability = 1;

          if (r >= 2) {
            tileType = Math.random() < 0.6 ? TILE_TYPE.SOIL_DEEP : TILE_TYPE.SOIL_SURFACE;
            durability = tileType === TILE_TYPE.SOIL_DEEP ? 2 : 1;
          }

          if (Math.random() < site.rockRatio && r >= 1) {
            tileType = TILE_TYPE.ROCK;
            durability = 3;
          }

          row.push({
            col: c,
            row: r,
            type: tileType,
            durability: durability,
            maxDurability: durability,
            content: CONTENT_TYPE.EMPTY,
            fossilId: null,
            isRevealed: false,
            isRadarPinged: false,
            wobble: 0
          });
        }
        this.grid.push(row);
      }

      // Distribute Fossil Placements (Every fossil guaranteed placed!)
      const unplacedCells = [];
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          unplacedCells.push(this.grid[r][c]);
        }
      }
      this.shuffleArray(unplacedCells);

      site.targetFossils.forEach(fossilId => {
        if (unplacedCells.length > 0) {
          const cell = unplacedCells.pop();
          cell.content = CONTENT_TYPE.FOSSIL;
          cell.fossilId = fossilId;
        }
      });

      // Distribute Canteens, Coins, and Gems
      for (let i = 0; i < site.canteensCount && unplacedCells.length > 0; i++) {
        unplacedCells.pop().content = CONTENT_TYPE.CANTEEN;
      }
      for (let i = 0; i < site.gemsCount && unplacedCells.length > 0; i++) {
        unplacedCells.pop().content = CONTENT_TYPE.GEM;
      }
      for (let i = 0; i < site.coinsCount && unplacedCells.length > 0; i++) {
        unplacedCells.pop().content = CONTENT_TYPE.COIN;
      }

      this.updateHud();
      this.announce(`Arrived at ${site.name}. Excavate soil to uncover the 2 hidden dinosaur fossils.`);
    }

    shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    // -----------------------------------------------------------------------
    // EXCAVATION ACTION DISPATCHER & CHARACTER MOVEMENT
    // -----------------------------------------------------------------------

    orderExcavation(col, row) {
      const cell = this.grid[row][col];
      if (cell.isRevealed) return; // Already cleared

      const cost = this.activeTool.cost;
      if (this.energy < cost) {
        this.audio.playFail();
        this.floatingTexts.push(new FloatingText(
          this.gridStartX + (col + 0.5) * this.tileSize,
          this.gridStartY + row * this.tileSize,
          'NO ENERGY!',
          '#ef4444'
        ));
        this.checkEnergyExhaustion();
        return;
      }

      const tileX = this.gridStartX + (col + 0.5) * this.tileSize;
      const tileY = this.gridStartY + (row + 0.5) * this.tileSize;

      // Send archaeologist walking over to the tile and execute the tool animation
      this.character.setTarget(tileX, tileY, { col, row, toolId: this.activeTool.id }, () => {
        this.executeExcavation(col, row);
      });
    }

    executeExcavation(col, row) {
      const cell = this.grid[row][col];
      if (cell.isRevealed) return;

      const cost = this.activeTool.cost;
      this.energy -= cost;
      this.updateHud();

      const tileX = this.gridStartX + (col + 0.5) * this.tileSize;
      const tileY = this.gridStartY + (row + 0.5) * this.tileSize;

      if (this.activeTool === TOOLS.RADAR) {
        // Georadar Scanner (Pings 3x3 surrounding sector)
        this.audio.playRadar();
        this.spawnRadarWaves(tileX, tileY);

        let bonesDetected = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < this.gridRows && nc >= 0 && nc < this.gridCols) {
              const target = this.grid[nr][nc];
              target.isRadarPinged = true;
              if (target.content === CONTENT_TYPE.FOSSIL && !target.isRevealed) {
                bonesDetected++;
              }
            }
          }
        }
        this.floatingTexts.push(new FloatingText(
          tileX, tileY - 20,
          bonesDetected > 0 ? `${bonesDetected} FOSSIL ECHO!` : 'NO ECHO',
          bonesDetected > 0 ? '#10b981' : '#cbd5e1'
        ));
        return;
      }

      // Physical Excavation
      let damage = 1;
      let effective = true;

      if (this.activeTool === TOOLS.BRUSH) {
        this.audio.playBrush();
        this.spawnDustParticles(tileX, tileY);
        if (cell.type === TILE_TYPE.ROCK) {
          damage = 0;
          effective = false;
          this.floatingTexts.push(new FloatingText(tileX, tileY - 10, 'TOO HARD FOR BRUSH', '#ef4444', 12));
        }
      } else if (this.activeTool === TOOLS.SHOVEL) {
        this.audio.playShovel();
        this.spawnDirtParticles(tileX, tileY);
        if (cell.type === TILE_TYPE.ROCK) {
          damage = 0;
          effective = false;
          this.floatingTexts.push(new FloatingText(tileX, tileY - 10, 'NEED PICKAXE', '#ef4444', 12));
        } else {
          damage = 2;
        }
      } else if (this.activeTool === TOOLS.PICKAXE) {
        this.audio.playPickaxe();
        this.spawnRockSparks(tileX, tileY);
        damage = 2;
      }

      if (effective) {
        cell.durability -= damage;
        cell.wobble = 8;

        if (cell.durability <= 0) {
          cell.isRevealed = true;
          this.score += 15;
          this.revealTileContent(cell, tileX, tileY);
        }
      }

      this.checkSiteCompletion();
      this.checkEnergyExhaustion();
      this.updateHud();
    }

    revealTileContent(cell, x, y) {
      if (cell.content === CONTENT_TYPE.FOSSIL) {
        // Fossil Discovery!
        this.audio.playFossilFound();
        this.discoveredBones.add(cell.fossilId);
        this.character.celebrate();

        const boneMeta = this.getBoneMetadata(cell.fossilId);
        const pts = boneMeta ? boneMeta.points : 150;
        const name = boneMeta ? boneMeta.name : 'Dinosaur Fossil';

        this.score += pts;
        this.coins += 25;

        this.spawnStarburst(x, y, '#fbbf24');
        this.floatingTexts.push(new FloatingText(x, y - 20, `+${pts} PTS!`, '#fbbf24', 18, name));
        this.announce(`Fossil uncovered: ${name}! +${pts} points.`);
        this.saveProgress();
      } else if (cell.content === CONTENT_TYPE.COIN) {
        this.audio.playCoin();
        this.coins += 15;
        this.score += 25;
        this.spawnStarburst(x, y, '#f59e0b');
        this.floatingTexts.push(new FloatingText(x, y - 20, '+15 COINS', '#f59e0b', 15, 'Gold Deposit'));
      } else if (cell.content === CONTENT_TYPE.GEM) {
        this.audio.playCoin();
        this.coins += 35;
        this.score += 60;
        this.spawnStarburst(x, y, '#06b6d4');
        this.floatingTexts.push(new FloatingText(x, y - 20, '+35 COINS', '#06b6d4', 15, 'Amber Gem'));
      } else if (cell.content === CONTENT_TYPE.CANTEEN) {
        this.audio.playCanteen();
        this.energy = Math.min(this.maxEnergy, this.energy + 25);
        this.floatingTexts.push(new FloatingText(x, y - 20, '+25 ENERGY!', '#10b981', 15, 'Field Canteen'));
      }
    }

    getBoneMetadata(fossilId) {
      for (const dino of Object.values(DINOSAURS)) {
        const found = dino.bones.find(b => b.id === fossilId);
        if (found) return found;
      }
      return null;
    }

    checkSiteCompletion() {
      const site = SITES[this.currentSiteIndex];
      // Target: uncover both 2 fossils for this site
      const foundCount = site.targetFossils.filter(fid => this.discoveredBones.has(fid)).length;

      if (foundCount >= 2) {
        this.completedSites.add(site.id);
        const savedEnergyBonus = this.energy * 10;
        this.score += (600 + savedEnergyBonus);
        this.coins += 50;

        this.saveProgress();
        this.audio.playSiteComplete();
        this.character.celebrate();

        // Populate Site Clear Modal
        document.getElementById('dd-clear-bonus').textContent = `+${600 + savedEnergyBonus} PTS`;
        document.getElementById('dd-clear-fossils').textContent = '2/2';
        document.getElementById('dd-clear-energy-saved').textContent = `${this.energy} NRG`;
        document.getElementById('dd-clear-total-score').textContent = this.score;

        setTimeout(() => {
          this.clearScreen.classList.remove('dd-hidden');
          this.announce(`Site completed! 2 dinosaur fossils recovered. Bonus: ${600 + savedEnergyBonus} points.`);
        }, 700);
      }
    }

    checkEnergyExhaustion() {
      if (this.energy <= 0) {
        const site = SITES[this.currentSiteIndex];
        const foundCount = site.targetFossils.filter(fid => this.discoveredBones.has(fid)).length;
        if (foundCount < 2) {
          this.audio.playFail();
          document.getElementById('dd-fail-score').textContent = this.score;
          document.getElementById('dd-fail-fossils').textContent = `${foundCount}/2`;

          setTimeout(() => {
            this.failScreen.classList.remove('dd-hidden');
            this.announce('Expedition crew exhausted. Out of energy.');
          }, 400);
        }
      }
    }

    // -----------------------------------------------------------------------
    // PARTICLE & SPLASH GENERATORS
    // -----------------------------------------------------------------------

    spawnDustParticles(x, y) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 30 + Math.random() * 50;
        this.particles.push(new Particle(
          x, y,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd - 30,
          'rgba(245, 158, 11, 0.6)',
          Math.random() * 3 + 1,
          0.4 + Math.random() * 0.2
        ));
      }
    }

    spawnDirtParticles(x, y) {
      for (let i = 0; i < 12; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
        const spd = 60 + Math.random() * 80;
        this.particles.push(new Particle(
          x, y,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd,
          'rgba(120, 53, 15, 0.85)',
          Math.random() * 4 + 2,
          0.5 + Math.random() * 0.2
        ));
      }
    }

    spawnRockSparks(x, y) {
      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 90;
        this.particles.push(new Particle(
          x, y,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd - 40,
          Math.random() < 0.5 ? '#f59e0b' : '#cbd5e1',
          Math.random() * 3 + 1,
          0.5,
          'star'
        ));
      }
    }

    spawnStarburst(x, y, color = '#fbbf24') {
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 110;
        this.particles.push(new Particle(
          x, y,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd - 30,
          color,
          Math.random() * 4 + 2,
          0.7,
          'star'
        ));
      }
    }

    spawnRadarWaves(x, y) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        this.particles.push(new Particle(
          x, y,
          Math.cos(angle) * 75,
          Math.sin(angle) * 75,
          '#10b981',
          3,
          0.45
        ));
      }
    }

    // -----------------------------------------------------------------------
    // MUSEUM & SKELETON ASSEMBLY SYSTEM
    // -----------------------------------------------------------------------

    openMuseum() {
      this.pauseScreen.classList.add('dd-hidden');
      this.clearScreen.classList.add('dd-hidden');
      this.failScreen.classList.add('dd-hidden');
      this.helpScreen.classList.add('dd-hidden');
      this.museumScreen.classList.remove('dd-hidden');

      this.renderMuseumExhibit();
      this.announce('Entered Paleontology Museum Exhibit Hall');
    }

    closeMuseum() {
      this.museumScreen.classList.add('dd-hidden');
    }

    renderMuseumExhibit() {
      const dino = DINOSAURS[this.selectedMuseumDino];
      if (!dino) return;

      document.getElementById('dd-exhibit-name').textContent = dino.name;
      document.getElementById('dd-exhibit-desc').textContent = `${dino.desc} (${dino.era} • ${dino.diet})`;

      // Count mounted vs total
      const mountedCount = dino.bones.filter(b => this.assembledBones.has(b.id)).length;
      const statusEl = document.getElementById('dd-exhibit-status');
      if (mountedCount === dino.bones.length) {
        statusEl.textContent = 'EXHIBIT COMPLETE!';
        statusEl.style.color = '#10b981';
      } else {
        statusEl.textContent = `${mountedCount}/${dino.bones.length} BONES ASSEMBLED`;
        statusEl.style.color = '#f59e0b';
      }

      // Populate Discovered Bones Tray
      const tray = document.getElementById('dd-bones-tray');
      tray.innerHTML = '';

      dino.bones.forEach(bone => {
        const isDiscovered = this.discoveredBones.has(bone.id);
        const isMounted = this.assembledBones.has(bone.id);

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dd-bone-chip';

        if (isMounted) {
          chip.classList.add('dd-bone-chip-mounted');
          chip.innerHTML = `<span>${bone.name} (MOUNTED)</span>`;
        } else if (isDiscovered) {
          chip.innerHTML = `<span>MOUNT: ${bone.name}</span>`;
          chip.addEventListener('click', () => {
            this.mountBoneToSkeleton(bone.id);
          });
        } else {
          chip.classList.add('dd-bone-chip-mounted');
          chip.innerHTML = `<span>[UNEXCAVATED BONE]</span>`;
        }
        tray.appendChild(chip);
      });

      this.drawSkeletonShowcase(dino);
    }

    mountBoneToSkeleton(boneId) {
      this.assembledBones.add(boneId);
      this.audio.playMountBone();
      this.saveProgress();

      const dino = DINOSAURS[this.selectedMuseumDino];
      const isComplete = dino.bones.every(b => this.assembledBones.has(b.id));

      if (isComplete) {
        this.audio.playSiteComplete();
        this.score += 1000;
        this.coins += 100;
        this.saveProgress();
        this.announce(`Congratulations! Complete skeleton of ${dino.name} assembled! +1000 points!`);
      }

      this.renderMuseumExhibit();
    }

    drawSkeletonShowcase(dino) {
      if (!this.skeletonCtx) return;
      const sctx = this.skeletonCtx;
      sctx.clearRect(0, 0, 600, 240);

      // Museum Floor
      sctx.fillStyle = '#0f0803';
      sctx.fillRect(0, 195, 600, 45);

      // Wooden Plinth Stand
      sctx.fillStyle = '#3b1d08';
      sctx.fillRect(80, 180, 440, 16);
      sctx.strokeStyle = '#f59e0b';
      sctx.lineWidth = 1.5;
      sctx.strokeRect(80, 180, 440, 16);

      // Brass Nameplate
      sctx.fillStyle = '#fbbf24';
      sctx.fillRect(240, 184, 120, 8);
      sctx.fillStyle = '#1e293b';
      sctx.font = 'bold 8px monospace';
      sctx.textAlign = 'center';
      sctx.fillText(dino.commonName.toUpperCase(), 300, 191);

      // Metal armature stands
      sctx.strokeStyle = '#64748b';
      sctx.lineWidth = 2.5;
      [200, 310, 400].forEach(sx => {
        sctx.beginPath();
        sctx.moveTo(sx, 180);
        sctx.lineTo(sx, 110);
        sctx.stroke();
      });

      // Render Dinosaur Silhouette & Bones
      sctx.save();
      sctx.translate(100, 20);

      if (dino.id === 'triceratops') {
        this.drawTriceratopsBones(sctx);
      } else if (dino.id === 'stegosaurus') {
        this.drawStegosaurusBones(sctx);
      } else if (dino.id === 'trex') {
        this.drawTrexBones(sctx);
      } else if (dino.id === 'brachiosaurus') {
        this.drawBrachiosaurusBones(sctx);
      }

      sctx.restore();
    }

    drawTriceratopsBones(ctx) {
      const hasSkull = this.assembledBones.has('tri_skull');
      const hasFrill = this.assembledBones.has('tri_frill');
      const hasRibs = this.assembledBones.has('tri_ribs');
      const hasLeg = this.assembledBones.has('tri_leg');

      // Frill
      ctx.fillStyle = hasFrill ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasFrill ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(140, 60, 32, -Math.PI * 0.7, Math.PI * 0.4);
      ctx.lineTo(120, 80);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Skull & Horns
      ctx.fillStyle = hasSkull ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasSkull ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(110, 85, 24, 16, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (hasSkull) {
        ctx.beginPath();
        ctx.moveTo(115, 75); ctx.lineTo(85, 40);
        ctx.moveTo(125, 75); ctx.lineTo(100, 36);
        ctx.stroke();
      }

      // Ribcage
      ctx.fillStyle = hasRibs ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasRibs ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(220, 90, 48, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Legs
      ctx.fillStyle = hasLeg ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasLeg ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(160, 110, 14, 52);
      ctx.fillRect(250, 110, 16, 52);
      ctx.strokeRect(160, 110, 14, 52);
      ctx.strokeRect(250, 110, 16, 52);
    }

    drawStegosaurusBones(ctx) {
      const hasPlates = this.assembledBones.has('stego_plates');
      const hasTail = this.assembledBones.has('stego_tail');
      const hasSkull = this.assembledBones.has('stego_skull');
      const hasRibs = this.assembledBones.has('stego_ribs');

      // Dorsal Plates
      ctx.fillStyle = hasPlates ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasPlates ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      [140, 175, 215, 255, 290].forEach((px, i) => {
        ctx.beginPath();
        ctx.moveTo(px, 75);
        ctx.lineTo(px + 12, 35 - (i % 2) * 10);
        ctx.lineTo(px + 24, 75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // Ribcage
      ctx.fillStyle = hasRibs ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasRibs ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(210, 95, 52, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Skull
      ctx.fillStyle = hasSkull ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasSkull ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(110, 110, 18, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tail & Spikes
      ctx.strokeStyle = hasTail ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(260, 95);
      ctx.quadraticCurveTo(310, 100, 360, 120);
      ctx.stroke();
    }

    drawTrexBones(ctx) {
      const hasSkull = this.assembledBones.has('trex_skull');
      const hasLeg = this.assembledBones.has('trex_leg');
      const hasRibs = this.assembledBones.has('trex_ribs');
      const hasTail = this.assembledBones.has('trex_tail');

      // T-Rex Skull
      ctx.fillStyle = hasSkull ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasSkull ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(110, 45);
      ctx.lineTo(170, 40);
      ctx.lineTo(165, 80);
      ctx.lineTo(115, 75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ribcage
      ctx.fillStyle = hasRibs ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasRibs ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(220, 80, 40, 24, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Leg
      ctx.fillStyle = hasLeg ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasLeg ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(230, 95, 18, 70);
      ctx.strokeRect(230, 95, 18, 70);

      // Tail
      ctx.strokeStyle = hasTail ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(250, 75);
      ctx.quadraticCurveTo(310, 65, 370, 70);
      ctx.stroke();
    }

    drawBrachiosaurusBones(ctx) {
      const hasSkull = this.assembledBones.has('brach_skull');
      const hasNeck = this.assembledBones.has('brach_neck');
      const hasRibs = this.assembledBones.has('brach_ribs');
      const hasLeg = this.assembledBones.has('brach_leg');

      // Neck
      ctx.strokeStyle = hasNeck ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(180, 90);
      ctx.quadraticCurveTo(150, 40, 110, 20);
      ctx.stroke();

      // Skull
      ctx.fillStyle = hasSkull ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasSkull ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(105, 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ribs
      ctx.fillStyle = hasRibs ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasRibs ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(230, 95, 52, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Leg
      ctx.fillStyle = hasLeg ? '#fef3c7' : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = hasLeg ? '#d97706' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(190, 115, 16, 52);
      ctx.strokeRect(190, 115, 16, 52);
    }

    // -----------------------------------------------------------------------
    // HUD & GENERAL STATE HELPERS
    // -----------------------------------------------------------------------

    updateHud() {
      if (this.hudScore) this.hudScore.textContent = this.score;
      if (this.hudCoins) this.hudCoins.textContent = this.coins;

      const site = SITES[this.currentSiteIndex];
      if (this.hudStage && site) {
        this.hudStage.textContent = `${this.currentSiteIndex + 1}/${SITES.length}`;
      }

      if (site) {
        const foundCount = site.targetFossils.filter(fid => this.discoveredBones.has(fid)).length;
        if (this.hudFossils) {
          this.hudFossils.textContent = `${foundCount}/2`;
        }

        // Update Right Info Panel
        if (this.objProgress) {
          this.objProgress.textContent = `${foundCount} OF 2 DISCOVERED`;
        }
        if (this.objBarFill) {
          this.objBarFill.style.width = `${(foundCount / 2) * 100}%`;
        }

        // Update 2 Fossil Slots in Right Panel
        site.targetFossils.forEach((fid, idx) => {
          const slot = this.slotElements[idx];
          if (!slot) return;
          const isFound = this.discoveredBones.has(fid);
          const meta = this.getBoneMetadata(fid);

          if (isFound && meta) {
            slot.wrap.classList.add('dd-slot-discovered');
            slot.iconBox.innerHTML = `
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 10c.7-.7 1.6-1 2.5-1 2 0 3.5 1.5 3.5 3.5 0 .9-.3 1.8-1 2.5l-8 8c-.7.7-1.6 1-2.5 1-2 0-3.5-1.5-3.5-3.5 0-.9.3-1.8 1-2.5l8-8Z"></path>
              </svg>
            `;
            slot.name.textContent = meta.name;
            slot.sub.textContent = `+${meta.points} Pts • Collected`;
          } else {
            slot.wrap.classList.remove('dd-slot-discovered');
            slot.iconBox.innerHTML = '<span class="dd-slot-placeholder">?</span>';
            slot.name.textContent = 'Undiscovered Fossil';
            slot.sub.textContent = 'Dig deeper to uncover';
          }
        });
      }

      if (this.hudEnergyText) {
        this.hudEnergyText.textContent = `${Math.max(0, this.energy)} / ${this.maxEnergy}`;
      }

      if (this.hudEnergyFill) {
        const pct = Math.max(0, Math.min(100, (this.energy / this.maxEnergy) * 100));
        this.hudEnergyFill.style.width = `${pct}%`;
      }

      if (this.energyWrap) {
        if (this.energy <= 20) {
          this.energyWrap.classList.add('dd-energy-low');
        } else {
          this.energyWrap.classList.remove('dd-energy-low');
        }
      }
    }

    togglePause() {
      if (this.pauseScreen.classList.contains('dd-hidden')) {
        document.getElementById('dd-pause-score').textContent = this.score;
        document.getElementById('dd-pause-energy').textContent = this.energy;
        document.getElementById('dd-pause-coins').textContent = this.coins;
        this.pauseScreen.classList.remove('dd-hidden');
        this.pauseIcon.classList.add('dd-hidden');
        this.resumeIcon.classList.remove('dd-hidden');
        this.announce('Excavation paused');
      } else {
        this.resume();
      }
    }

    resume() {
      this.pauseScreen.classList.add('dd-hidden');
      this.pauseIcon.classList.remove('dd-hidden');
      this.resumeIcon.classList.add('dd-hidden');
      this.announce('Excavation resumed');
    }

    openHelp() {
      this.helpScreen.classList.remove('dd-hidden');
    }

    // -----------------------------------------------------------------------
    // CANVAS RENDERING
    // -----------------------------------------------------------------------

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Excavation Site Backdrop & Frame
      this.drawExcavationSiteTrench(ctx);

      // 2. Render Grid Cells & Stratified Underground
      this.drawGridCells(ctx);

      // 3. Render Animated Archaeologist Character
      this.character.draw(ctx);

      // 4. Render Particles
      for (const p of this.particles) {
        p.draw(ctx);
      }

      // 5. Render Floating Text Feedback
      for (const ft of this.floatingTexts) {
        ft.draw(ctx);
      }
    }

    drawExcavationSiteTrench(ctx) {
      // Deep Quarry earth backdrop gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGrad.addColorStop(0, '#1c0e05');
      bgGrad.addColorStop(0.5, '#29180c');
      bgGrad.addColorStop(1, '#170b04');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Wooden border of dig trench
      const pad = 10;
      const gx = this.gridStartX - pad;
      const gy = this.gridStartY - pad;
      const gw = this.gridCols * this.tileSize + pad * 2;
      const gh = this.gridRows * this.tileSize + pad * 2;

      ctx.fillStyle = '#3b1d08';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx, gy, gw, gh);

      // Archaeological String Grid Pegs
      ctx.fillStyle = '#fbbf24';
      [-pad, gw - pad].forEach(px => {
        [-pad, gh - pad].forEach(py => {
          ctx.beginPath();
          ctx.arc(this.gridStartX + px, this.gridStartY + py, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    drawGridCells(ctx) {
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          const cell = this.grid[r][c];
          const x = this.gridStartX + c * this.tileSize;
          const y = this.gridStartY + r * this.tileSize;
          const sz = this.tileSize - 2;

          ctx.save();
          if (cell.wobble > 0) {
            ctx.translate(x + sz * 0.5, y + sz * 0.5);
            ctx.rotate((Math.sin(this.animTime * 40) * cell.wobble * Math.PI) / 180);
            ctx.translate(-(x + sz * 0.5), -(y + sz * 0.5));
          }

          if (cell.isRevealed) {
            // Cleared Soil: Dark bedrock foundation with revealed artifact/fossil
            ctx.fillStyle = '#1c0e05';
            ctx.fillRect(x, y, sz, sz);

            // Revealed Content
            this.drawCellContent(ctx, cell, x + sz * 0.5, y + sz * 0.5);
          } else {
            // Unexcavated Soil / Rock Tile with rich earthy textures
            if (cell.type === TILE_TYPE.SOIL_SURFACE) {
              ctx.fillStyle = '#b45309';
            } else if (cell.type === TILE_TYPE.SOIL_DEEP) {
              ctx.fillStyle = '#78350f';
            } else if (cell.type === TILE_TYPE.ROCK) {
              ctx.fillStyle = '#475569';
            }

            ctx.fillRect(x, y, sz, sz);

            // Pebble texture speckles
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(x + 10, y + 14, 5, 3);
            ctx.fillRect(x + 38, y + 22, 6, 4);
            ctx.fillRect(x + 20, y + 42, 4, 3);

            // Soil highlight top line
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(x, y, sz, 3);

            // Crack patterns if partially damaged
            if (cell.durability < cell.maxDurability) {
              ctx.strokeStyle = '#1c0e05';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x + 10, y + 10);
              ctx.lineTo(x + sz - 10, y + sz - 10);
              ctx.moveTo(x + sz - 14, y + 12);
              ctx.lineTo(x + 15, y + sz - 15);
              ctx.stroke();
            }

            // Radar Ping outline
            if (cell.isRadarPinged && cell.content === CONTENT_TYPE.FOSSIL) {
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 2.5;
              ctx.strokeRect(x + 2, y + 2, sz - 4, sz - 4);
            }
          }

          // Tile Border
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, sz, sz);

          // Hover Target Reticle
          if (this.hoverCol === c && this.hoverRow === r && !cell.isRevealed) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x, y, sz, sz);

            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(x - 2, y - 2, 6, 6);
            ctx.fillRect(x + sz - 4, y - 2, 6, 6);
            ctx.fillRect(x - 2, y + sz - 4, 6, 6);
            ctx.fillRect(x + sz - 4, y + sz - 4, 6, 6);
          }

          ctx.restore();
        }
      }
    }

    drawCellContent(ctx, cell, cx, cy) {
      if (cell.content === CONTENT_TYPE.FOSSIL) {
        ctx.save();
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(cx - 12, cy - 8, 6, 0, Math.PI * 2);
        ctx.arc(cx - 12, cy + 8, 6, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 8, 6, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy + 8, 6, 0, Math.PI * 2);
        ctx.rect(cx - 10, cy - 4, 20, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (cell.content === CONTENT_TYPE.COIN) {
        ctx.save();
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('C', cx, cy);
        ctx.restore();
      } else if (cell.content === CONTENT_TYPE.GEM) {
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 14, cy);
        ctx.lineTo(cx, cy + 14);
        ctx.lineTo(cx - 14, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (cell.content === CONTENT_TYPE.CANTEEN) {
        ctx.save();
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#d1fae5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 12, 0, Math.PI * 2);
        ctx.rect(cx - 4, cy - 14, 8, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // -----------------------------------------------------------------------
    // MAIN RAF LOOP
    // -----------------------------------------------------------------------

    loop(timestamp) {
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const rawDt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      const dt = Math.min(rawDt, 0.1);
      this.animTime += dt;

      // Update Character
      this.character.update(dt);

      // Update particles & texts
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.update(dt);
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.update(dt);
        if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }

      // Decay wobble
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          if (this.grid[r] && this.grid[r][c] && this.grid[r][c].wobble > 0) {
            this.grid[r][c].wobble = Math.max(0, this.grid[r][c].wobble - dt * 25);
          }
        }
      }

      this.draw();

      requestAnimationFrame(this.loop.bind(this));
    }
  }

  // =========================================================================
  // BOOTSTRAP INITIALIZATION ON DOM READY
  // =========================================================================

  window.addEventListener('DOMContentLoaded', () => {
    window.dinoDig = new DinoDigGame();
  });

})();
