/**
 * DEEP SEA EXPLORER - Sunken Ruins Archaeology & Submarine Adventure
 * ArcadeVerse HTML5 Game
 * 
 * Features:
 * - Expansive 3800x1200 scrolling deep ocean world with smooth tracking camera
 * - Sector 1: The Sunken Agora (the reference image ruins: columns, cobblestones, whale skeleton, amphorae)
 * - Sector 2: The Boulder Field & Jellyfish Trench
 * - Sector 3: The Abyssal Shark Trench & Naval Minefield
 * - Sector 4: The Atlantis Sunken Gateway & Extraction Beacon
 * - Abundant floating collectible golden Ocean Coins with spinning animations (+10 Coins, +50 Pts)
 * - Massive craggy stone boulders with impact physics, collision damage, and debris particles
 * - Dangerous Marine Species:
 *   - Hunter Sharks: aggressive predators with patrolling & chasing AI
 *   - Electric Jellyfish: pulsing bioluminescent bells with shocking tentacles
 *   - Spiky Sea Urchins: sharp venomous hazards on rocks
 *   - Submerged Naval Mines: anchored explosive spheres with blinking sensors
 * - Dual-mode gameplay: Pilot the Brass Nautilus or explore on foot as the Deep-Sea Diver [F]
 * - Interactive archaeology: Excavate ancient amphorae, giant leviathan fossils, and chests [E]
 * - Procedural water caustics, sun rays, floating marine snow, and bubble vents
 * - Persistent upgrades workshop (Oxygen, Thruster, Hull, Sonar)
 * - Pure Web Audio API procedural sound engine
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURATION & CONSTANTS
  // ==========================================================================

  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 720;

  const WORLD_WIDTH = 3800;
  const WORLD_HEIGHT = 1200;

  const EXPLORER_MODE = {
    SUBMARINE: 'submarine',
    DIVER: 'diver'
  };

  const RELIC_TYPE = {
    AMPHORA: 'amphora',
    FOSSIL: 'fossil',
    CHEST: 'chest',
    BARREL: 'barrel',
    TABLET: 'tablet',
    CRYSTAL: 'crystal'
  };

  // ==========================================================================
  // 2. PROCEDURAL WEB AUDIO SYNTHESIS
  // ==========================================================================

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      try {
        const stored = localStorage.getItem('deepsea_sound_muted');
        if (stored !== null) this.enabled = stored !== 'true';
      } catch (e) {}
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      try {
        localStorage.setItem('deepsea_sound_muted', (!this.enabled).toString());
      } catch (e) {}
      if (this.enabled) this.playTone(520, 'sine', 0.05, 0.08, 660);
      return this.enabled;
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1, slideFreq = null) {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideFreq), now + duration);
        }

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }

    playCoin() {
      if (!this.enabled) return;
      this.playTone(987, 'sine', 0.08, 0.12, 1318);
      setTimeout(() => this.playTone(1318, 'sine', 0.1, 0.1, 1568), 50);
    }

    playSonar() {
      if (!this.enabled) return;
      this.playTone(880, 'sine', 0.6, 0.15, 1200);
      setTimeout(() => this.playTone(1320, 'sine', 0.4, 0.08, 1400), 120);
    }

    playBubble() {
      if (!this.enabled) return;
      const f = 400 + Math.random() * 300;
      this.playTone(f, 'sine', 0.08, 0.06, f + 250);
    }

    playExcavate() {
      if (!this.enabled) return;
      this.playTone(330, 'triangle', 0.15, 0.12, 440);
      setTimeout(() => this.playTone(440, 'triangle', 0.15, 0.12, 550), 100);
      setTimeout(() => this.playTone(660, 'sine', 0.35, 0.15, 880), 200);
    }

    playRefill() {
      if (!this.enabled) return;
      this.playTone(400, 'sine', 0.25, 0.1, 750);
    }

    playThruster() {
      if (!this.enabled) return;
      this.playTone(90, 'triangle', 0.12, 0.05, 110);
    }

    playCollision() {
      if (!this.enabled) return;
      this.playTone(120, 'sawtooth', 0.22, 0.18, 45);
    }

    playShock() {
      if (!this.enabled) return;
      this.playTone(280, 'sawtooth', 0.2, 0.16, 140);
      setTimeout(() => this.playTone(550, 'square', 0.15, 0.1, 200), 60);
    }

    playBite() {
      if (!this.enabled) return;
      this.playTone(150, 'sawtooth', 0.25, 0.2, 50);
      setTimeout(() => this.playTone(90, 'square', 0.2, 0.2, 30), 80);
    }

    playVictory() {
      if (!this.enabled) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'triangle', 0.3, 0.12), i * 140);
      });
    }
  }

  const audio = new SoundEngine();

  // ==========================================================================
  // 3. UNDERWATER CAUSTICS & LIGHTING SYSTEM
  // ==========================================================================

  class CausticsEngine {
    constructor() {
      this.time = 0;
      this.gridSize = 36;
      this.cols = Math.ceil(CANVAS_WIDTH / this.gridSize) + 1;
      this.rows = Math.ceil(CANVAS_HEIGHT / this.gridSize) + 1;
    }

    update(dt) {
      this.time += dt * 1.4;
    }

    render(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = 1.5;

      const t = this.time;
      ctx.strokeStyle = 'rgba(67, 232, 249, 0.15)';

      for (let y = 0; y < this.rows; y += 2) {
        ctx.beginPath();
        for (let x = 0; x < this.cols; x++) {
          const px = x * this.gridSize;
          const wave1 = Math.sin(x * 0.25 + t) * 12;
          const wave2 = Math.cos(y * 0.3 + t * 0.8) * 10;
          const py = y * this.gridSize + wave1 + wave2;

          if (x === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Diagonal cross-wave
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
      for (let x = 0; x < this.cols; x += 3) {
        ctx.beginPath();
        for (let y = 0; y < this.rows; y++) {
          const py = y * this.gridSize;
          const wave1 = Math.cos(y * 0.22 + t * 0.9) * 10;
          const wave2 = Math.sin(x * 0.28 - t * 0.7) * 8;
          const px = x * this.gridSize + wave1 + wave2;

          if (y === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Volumetric Sun Rays (God Rays)
      const rayGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH * 0.7, CANVAS_HEIGHT);
      rayGrad.addColorStop(0, 'rgba(103, 232, 249, 0.12)');
      rayGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.07)');
      rayGrad.addColorStop(0.8, 'rgba(14, 165, 233, 0.02)');
      rayGrad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

      ctx.fillStyle = rayGrad;
      const rayOffset = Math.sin(t * 0.4) * 30;

      ctx.beginPath();
      ctx.moveTo(100 + rayOffset, 0);
      ctx.lineTo(460 + rayOffset, 0);
      ctx.lineTo(780 + rayOffset, CANVAS_HEIGHT);
      ctx.lineTo(320 + rayOffset, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // ==========================================================================
  // 4. PLAYER: BRASS NAUTILUS SUBMARINE & VINTAGE DIVER
  // ==========================================================================

  class Submarine {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.targetAngle = 0;
      this.facingRight = true;
      this.propellerAngle = 0;

      this.width = 110;
      this.height = 54;
      this.radius = 34;

      this.speed = 175;
      this.boostMultiplier = 1.75;
      this.friction = 0.94;
      this.isBoosting = false;

      // Telemetry
      this.oxygen = 100;
      this.maxOxygen = 100;
      this.fuel = 100;
      this.maxFuel = 100;
      this.hull = 100;
      this.maxHull = 100;

      // Sonar
      this.sonarCooldown = 0;
      this.sonarCooldownMax = 4.0;
      this.sonarRadius = 400;

      this.invulnerableTimer = 0;
      this.bubbleTimer = 0;
    }

    applyUpgrades(upgrades) {
      this.maxOxygen = 100 + upgrades.oxygen * 25;
      this.oxygen = this.maxOxygen;
      this.speed = 175 + upgrades.thruster * 25;
      this.maxHull = 100 + upgrades.hull * 25;
      this.hull = this.maxHull;
      this.sonarRadius = 400 + upgrades.sonar * 80;
      this.sonarCooldownMax = Math.max(1.8, 4.0 - upgrades.sonar * 0.6);
    }

    takeDamage(amount, game, reason = '') {
      if (this.invulnerableTimer > 0) return;
      this.hull = Math.max(0, this.hull - amount);
      this.invulnerableTimer = 1.2;
      game.triggerDamageFlash();
      game.screenShake = 10;

      for (let i = 0; i < 10; i++) {
        game.world.createBubble(
          this.x + (Math.random() - 0.5) * 40,
          this.y + (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 60,
          Math.random() * 4 + 2
        );
      }

      if (this.hull <= 0) {
        game.handleGameOver(reason || 'Catastrophic hull breach! Emergency rescue pod ejected.');
      }
    }

    update(dt, input, world, game) {
      if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
      if (this.sonarCooldown > 0) this.sonarCooldown -= dt;

      // O2 drain
      this.oxygen = Math.max(0, this.oxygen - dt * 1.0);

      let ax = 0;
      let ay = 0;

      if (input.left) ax -= 1;
      if (input.right) ax += 1;
      if (input.up) ay -= 1;
      if (input.down) ay += 1;

      if (ax !== 0 && ay !== 0) {
        ax *= 0.7071;
        ay *= 0.7071;
      }

      this.isBoosting = input.shift && this.fuel > 0 && (ax !== 0 || ay !== 0);
      const curSpeed = this.isBoosting ? this.speed * this.boostMultiplier : this.speed;

      if (ax !== 0 || ay !== 0) {
        this.vx += ax * curSpeed * dt * 4.5;
        this.vy += ay * curSpeed * dt * 4.5;
        this.targetAngle = Math.atan2(ay, ax);

        if (ax > 0) this.facingRight = true;
        else if (ax < 0) this.facingRight = false;

        const fuelCost = this.isBoosting ? 14 : 4.5;
        this.fuel = Math.max(0, this.fuel - dt * fuelCost);

        this.propellerAngle += dt * (this.isBoosting ? 32 : 16);

        this.bubbleTimer += dt;
        if (this.bubbleTimer > (this.isBoosting ? 0.04 : 0.12)) {
          this.bubbleTimer = 0;
          audio.playThruster();
          const pOffset = this.facingRight ? -48 : 48;
          world.createBubble(
            this.x + pOffset,
            this.y + 6,
            (Math.random() - 0.5) * 20 - (this.facingRight ? 40 : -40),
            (Math.random() - 0.5) * 20,
            Math.random() * 4 + 2
          );
        }
      }

      // Smooth turning
      let angleDiff = this.targetAngle - this.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      this.angle += angleDiff * dt * 6;

      this.vx *= this.friction;
      this.vy *= this.friction;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // World bounds
      this.x = Math.max(60, Math.min(WORLD_WIDTH - 60, this.x));
      this.y = Math.max(60, Math.min(WORLD_HEIGHT - 60, this.y));

      // Boulder Collisions
      world.boulders.forEach(b => {
        const dist = Math.hypot(this.x - b.x, this.y - b.y);
        const minDist = this.radius + b.radius;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = (this.x - b.x) / (dist || 1);
          const ny = (this.y - b.y) / (dist || 1);

          this.x += nx * overlap;
          this.y += ny * overlap;

          const speed = Math.hypot(this.vx, this.vy);
          this.vx = nx * speed * 0.5;
          this.vy = ny * speed * 0.5;

          if (speed > 55) {
            audio.playCollision();
            this.takeDamage(15, game, 'Crushed against deep ocean boulders!');
            game.showToast('IMPACT: HULL SCRAPED BY BOULDER (-15 HP)', 'danger');
          }
        }
      });
    }

    activateSonar(world) {
      if (this.sonarCooldown > 0) return false;
      this.sonarCooldown = this.sonarCooldownMax;
      audio.playSonar();
      world.createSonarPulse(this.x, this.y, this.sonarRadius);
      return true;
    }

    render(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      if (this.invulnerableTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      ctx.rotate(this.angle);
      if (!this.facingRight) ctx.scale(1, -1);

      // Searchlight Beam
      const lightGrad = ctx.createRadialGradient(48, 0, 10, 220, 0, 240);
      lightGrad.addColorStop(0, 'rgba(34, 211, 238, 0.45)');
      lightGrad.addColorStop(0.35, 'rgba(34, 211, 238, 0.18)');
      lightGrad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');

      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(42, -6);
      ctx.lineTo(260, -90);
      ctx.lineTo(260, 90);
      ctx.lineTo(42, 6);
      ctx.closePath();
      ctx.fill();

      // Shadow
      ctx.fillStyle = 'rgba(3, 10, 20, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 28, 48, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ballast Pontoons Underneath
      const ballastGrad = ctx.createLinearGradient(0, 8, 0, 26);
      ballastGrad.addColorStop(0, '#fef08a');
      ballastGrad.addColorStop(0.5, '#ca8a04');
      ballastGrad.addColorStop(1, '#713f12');

      ctx.fillStyle = ballastGrad;
      ctx.strokeStyle = '#522e07';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect(-34, 12, 68, 13, [6, 10, 10, 6]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#854d0e';
      ctx.fillRect(-18, 6, 6, 7);
      ctx.fillRect(12, 6, 6, 7);

      // Main Hull
      const hullGrad = ctx.createLinearGradient(0, -18, 0, 16);
      hullGrad.addColorStop(0, '#fef08a');
      hullGrad.addColorStop(0.3, '#eab308');
      hullGrad.addColorStop(0.7, '#a16207');
      hullGrad.addColorStop(1, '#522e07');

      ctx.fillStyle = hullGrad;
      ctx.strokeStyle = '#3d2204';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Plate Seams & Rivets
      ctx.strokeStyle = 'rgba(61, 34, 4, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-16, -16);
      ctx.lineTo(-16, 16);
      ctx.moveTo(14, -16);
      ctx.lineTo(14, 16);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      [-16, 14].forEach(rx => {
        [-10, -4, 4, 10].forEach(ry => {
          ctx.beginPath();
          ctx.arc(rx, ry, 1, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Conning Tower & Glowing Cyan Porthole
      ctx.fillStyle = '#a16207';
      ctx.strokeStyle = '#3d2204';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(8, -26, 20, 10, [4, 4, 0, 0]);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.arc(18, -21, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const glassGrad = ctx.createRadialGradient(17, -22, 1, 18, -21, 7);
      glassGrad.addColorStop(0, '#ffffff');
      glassGrad.addColorStop(0.4, '#38bdf8');
      glassGrad.addColorStop(1, '#0284c7');

      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.arc(18, -21, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Propeller
      ctx.fillStyle = '#854d0e';
      ctx.strokeStyle = '#3d2204';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(-40, -4);
      ctx.lineTo(-54, -16);
      ctx.lineTo(-44, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-40, 4);
      ctx.lineTo(-54, 16);
      ctx.lineTo(-44, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const propH = Math.cos(this.propellerAngle) * 14;
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-52, -propH);
      ctx.lineTo(-52, propH);
      ctx.stroke();

      ctx.restore();
    }
  }

  class Diver {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.facingRight = true;
      this.walkCycle = 0;
      this.bubbleTimer = 0;
      this.radius = 18;

      this.speed = 115;
      this.width = 30;
      this.height = 48;
    }

    update(dt, input, world, game) {
      let ax = 0;
      let ay = 0;

      if (input.left) ax -= 1;
      if (input.right) ax += 1;
      if (input.up) ay -= 1;
      if (input.down) ay += 1;

      if (ax !== 0 && ay !== 0) {
        ax *= 0.7071;
        ay *= 0.7071;
      }

      if (ax > 0) this.facingRight = true;
      else if (ax < 0) this.facingRight = false;

      const isMoving = ax !== 0 || ay !== 0;
      const moveSpeed = input.shift ? this.speed * 1.5 : this.speed;

      this.vx = ax * moveSpeed;
      this.vy = ay * moveSpeed;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (isMoving) {
        this.walkCycle += dt * 8;
      }

      this.bubbleTimer += dt;
      if (this.bubbleTimer > 1.2) {
        this.bubbleTimer = 0;
        audio.playBubble();
        world.createBubble(
          this.x + (this.facingRight ? 6 : -6),
          this.y - 18,
          (Math.random() - 0.5) * 10,
          -Math.random() * 20 - 15,
          Math.random() * 3 + 1.5
        );
      }

      this.x = Math.max(40, Math.min(WORLD_WIDTH - 40, this.x));
      this.y = Math.max(80, Math.min(WORLD_HEIGHT - 60, this.y));

      // Boulder Collisions
      world.boulders.forEach(b => {
        const dist = Math.hypot(this.x - b.x, this.y - b.y);
        const minDist = this.radius + b.radius;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = (this.x - b.x) / (dist || 1);
          const ny = (this.y - b.y) / (dist || 1);

          this.x += nx * overlap;
          this.y += ny * overlap;
        }
      });
    }

    render(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      if (!this.facingRight) ctx.scale(-1, 1);

      // Shadow
      ctx.fillStyle = 'rgba(3, 10, 20, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const legOffset = Math.sin(this.walkCycle) * 6;

      ctx.fillStyle = '#b45309';
      ctx.fillRect(-8, 8, 6, 12 + legOffset);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-10, 20 + legOffset, 10, 5);

      ctx.fillStyle = '#b45309';
      ctx.fillRect(2, 8, 6, 12 - legOffset);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 20 - legOffset, 10, 5);

      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.roundRect(-10, -6, 20, 16, 4);
      ctx.fill();

      // Lead weight
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-3, -2, 6, 8);

      // Arm & Flashlight
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(10, -3, 8, 4);

      const beamGrad = ctx.createRadialGradient(20, -1, 2, 100, -1, 120);
      beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0.4)');
      beamGrad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(20, -2);
      ctx.lineTo(130, -35);
      ctx.lineTo(130, 35);
      ctx.lineTo(20, 2);
      ctx.closePath();
      ctx.fill();

      // Mark V Helmet
      const helmetGrad = ctx.createRadialGradient(-2, -18, 2, 0, -16, 13);
      helmetGrad.addColorStop(0, '#fef08a');
      helmetGrad.addColorStop(0.5, '#eab308');
      helmetGrad.addColorStop(1, '#854d0e');

      ctx.fillStyle = helmetGrad;
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(0, -15, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(4, -15, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ==========================================================================
  // 5. CAMERA SYSTEM (SMOOTH SCROLLING TRACKING)
  // ==========================================================================

  class Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
    }

    update(target, dt) {
      const targetX = target.x - CANVAS_WIDTH / 2;
      const targetY = target.y - CANVAS_HEIGHT / 2;

      this.x += (targetX - this.x) * dt * 4.5;
      this.y += (targetY - this.y) * dt * 4.5;

      this.x = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, this.x));
      this.y = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, this.y));
    }
  }

  // ==========================================================================
  // 6. EXPANDED WORLD: COINS, BOULDERS, DANGEROUS SPECIES & RUINS
  // ==========================================================================

  class SunkenRuinsWorld {
    constructor() {
      this.relics = [];
      this.coins = [];
      this.boulders = [];
      this.hazards = []; // Sharks, Jellyfish, Sea Urchins, Mines
      this.fish = [];
      this.bubbles = [];
      this.sonarPulses = [];
      this.ventBubblesTimer = 0;
      this.gatewayBeacon = null;

      this.initWorld();
    }

    initWorld() {
      // 1. Interactive Archaeological Relics
      this.relics = [
        { id: 1, type: RELIC_TYPE.AMPHORA, name: 'Terracotta Amphora', x: 430, y: 580, radius: 20, excavated: false, value: 80, points: 150 },
        { id: 2, type: RELIC_TYPE.FOSSIL, name: 'Leviathan Whale Ribcage', x: 180, y: 620, radius: 40, excavated: false, value: 200, points: 400 },
        { id: 3, type: RELIC_TYPE.AMPHORA, name: 'Gilded Temple Urn', x: 640, y: 430, radius: 20, excavated: false, value: 90, points: 180 },
        { id: 4, type: RELIC_TYPE.BARREL, name: 'Sunken Cargo Barrel', x: 560, y: 620, radius: 22, excavated: false, value: 120, points: 250 },
        { id: 5, type: RELIC_TYPE.CHEST, name: 'Atlantis Royal Chest', x: 1950, y: 850, radius: 26, excavated: false, value: 250, points: 500 },
        { id: 6, type: RELIC_TYPE.TABLET, name: 'Inscribed Atlantean Stele', x: 3100, y: 520, radius: 24, excavated: false, value: 160, points: 300 }
      ];

      // 2. Abundant Collectible Golden Coins (60+ across the map)
      for (let i = 0; i < 65; i++) {
        const cx = 280 + (i / 65) * (WORLD_WIDTH - 500) + (Math.sin(i * 1.7) * 90);
        const cy = 120 + Math.abs(Math.sin(i * 0.8)) * (WORLD_HEIGHT - 320);
        this.coins.push({
          id: i + 1,
          x: cx,
          y: cy,
          radius: 12,
          value: 10,
          points: 50,
          spinAngle: Math.random() * Math.PI * 2,
          collected: false
        });
      }

      // 3. Massive Boulders & Rock Formations (Rugged terrain)
      const boulderCoords = [
        // Sector 1-2 boundary
        { x: 1250, y: 300, r: 55 },
        { x: 1320, y: 420, r: 68 },
        { x: 1280, y: 850, r: 75 },
        { x: 1400, y: 950, r: 60 },
        // Sector 2 (The Boulder Trench)
        { x: 1680, y: 220, r: 70 },
        { x: 1800, y: 580, r: 85 },
        { x: 1750, y: 720, r: 65 },
        { x: 2050, y: 350, r: 80 },
        { x: 2180, y: 640, r: 90 },
        { x: 2100, y: 920, r: 75 },
        // Sector 3 (Abyssal Reefs)
        { x: 2550, y: 280, r: 65 },
        { x: 2620, y: 780, r: 80 },
        { x: 2880, y: 420, r: 90 },
        { x: 2950, y: 880, r: 85 },
        { x: 3250, y: 320, r: 70 },
        { x: 3320, y: 750, r: 75 }
      ];

      boulderCoords.forEach((b, idx) => {
        this.boulders.push({
          id: idx,
          x: b.x,
          y: b.y,
          radius: b.r,
          color: idx % 2 === 0 ? '#1e3852' : '#182f45',
          highlight: '#2a4d70'
        });
      });

      // 4. Dangerous Marine Species & Hazards
      // A) Hunter Sharks
      const sharkSpawns = [
        { x: 1600, y: 450, minX: 1400, maxX: 1950 },
        { x: 2350, y: 720, minX: 2150, maxX: 2700 },
        { x: 2750, y: 380, minX: 2500, maxX: 3050 },
        { x: 3150, y: 650, minX: 2900, maxX: 3450 }
      ];

      sharkSpawns.forEach((s, idx) => {
        this.hazards.push({
          id: `shark_${idx}`,
          kind: 'shark',
          x: s.x,
          y: s.y,
          minX: s.minX,
          maxX: s.maxX,
          vx: 55,
          vy: 0,
          length: 64,
          radius: 26,
          facingRight: true,
          aggro: false,
          tailAngle: Math.random() * Math.PI * 2
        });
      });

      // B) Electrified Bioluminescent Jellyfish
      const jellySpawns = [
        { x: 1450, y: 600 },
        { x: 1900, y: 320 },
        { x: 2250, y: 820 },
        { x: 2480, y: 450 },
        { x: 2700, y: 600 },
        { x: 3000, y: 350 },
        { x: 3400, y: 550 }
      ];

      jellySpawns.forEach((j, idx) => {
        this.hazards.push({
          id: `jelly_${idx}`,
          kind: 'jellyfish',
          x: j.x,
          y: j.y,
          baseY: j.y,
          radius: 22,
          pulseTimer: Math.random() * Math.PI * 2,
          pulseSpeed: 2.2,
          sparkTimer: 0
        });
      });

      // C) Sunken Naval Sea Mines
      const mineSpawns = [
        { x: 1520, y: 380 },
        { x: 2020, y: 780 },
        { x: 2600, y: 520 },
        { x: 2820, y: 700 },
        { x: 3200, y: 480 }
      ];

      mineSpawns.forEach((m, idx) => {
        this.hazards.push({
          id: `mine_${idx}`,
          kind: 'mine',
          x: m.x,
          y: m.y,
          radius: 20,
          blink: 0
        });
      });

      // 5. Ambient Friendly Fish
      for (let i = 0; i < 20; i++) {
        this.fish.push({
          type: i % 2 === 0 ? 'crimson' : 'angelfish',
          x: 200 + Math.random() * (WORLD_WIDTH - 400),
          y: 100 + Math.random() * (WORLD_HEIGHT - 200),
          vx: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 30 + 20),
          vy: (Math.random() - 0.5) * 10,
          length: 16,
          wiggle: Math.random() * Math.PI * 2
        });
      }

      // 6. Final Atlantis Gateway Extraction Beacon
      this.gatewayBeacon = {
        x: WORLD_WIDTH - 220,
        y: WORLD_HEIGHT / 2,
        radius: 46,
        pulseAngle: 0
      };
    }

    createBubble(x, y, vx, vy, size) {
      if (this.bubbles.length > 220) return;
      this.bubbles.push({
        x,
        y,
        vx,
        vy,
        size,
        alpha: 0.85,
        life: Math.random() * 2.0 + 1.0
      });
    }

    createSonarPulse(originX, originY, maxRadius) {
      this.sonarPulses.push({
        x: originX,
        y: originY,
        radius: 10,
        maxRadius,
        alpha: 1.0,
        speed: 420
      });

      this.relics.forEach(rel => {
        if (!rel.excavated) {
          const d = Math.hypot(rel.x - originX, rel.y - originY);
          if (d <= maxRadius) rel.sonarGlow = 4.0;
        }
      });
    }

    update(dt, player, game) {
      // 1. Natural Bubble Vents (Sector 1 at x:700, Sector 2 at x:2100)
      this.ventBubblesTimer += dt;
      if (this.ventBubblesTimer > 0.16) {
        this.ventBubblesTimer = 0;
        [700, 2100, 3100].forEach(vx => {
          this.createBubble(
            vx + (Math.random() - 0.5) * 14,
            WORLD_HEIGHT - 120,
            (Math.random() - 0.5) * 12,
            -Math.random() * 35 - 30,
            Math.random() * 4 + 2
          );
        });
      }

      // 2. Coin Rotations & Collection
      this.coins.forEach(c => {
        if (c.collected) return;
        c.spinAngle += dt * 3.5;

        // Player Coin Pickup Detection
        const dist = Math.hypot(player.x - c.x, player.y - c.y);
        if (dist < player.radius + c.radius + 6) {
          c.collected = true;
          game.coins += c.value;
          game.score += c.points;
          audio.playCoin();

          for (let i = 0; i < 6; i++) {
            this.createBubble(
              c.x, c.y,
              (Math.random() - 0.5) * 35,
              (Math.random() - 0.5) * 35,
              Math.random() * 3 + 1.5
            );
          }
        }
      });

      // 3. Bubbles & Sonar
      this.bubbles.forEach(b => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.alpha -= dt / b.life;
      });
      this.bubbles = this.bubbles.filter(b => b.alpha > 0);

      this.sonarPulses.forEach(p => {
        p.radius += p.speed * dt;
        p.alpha = Math.max(0, 1.0 - (p.radius / p.maxRadius));
      });
      this.sonarPulses = this.sonarPulses.filter(p => p.alpha > 0);

      this.relics.forEach(r => {
        if (r.sonarGlow > 0) r.sonarGlow = Math.max(0, r.sonarGlow - dt);
      });

      // 4. Dangerous Species AI & Collisions
      this.hazards.forEach(h => {
        if (h.kind === 'shark') {
          h.tailAngle += dt * 10;
          const distToPlayer = Math.hypot(player.x - h.x, player.y - h.y);

          // Shark Aggro Chase
          if (distToPlayer < 240) {
            h.aggro = true;
            const angle = Math.atan2(player.y - h.y, player.x - h.x);
            h.vx = Math.cos(angle) * 110;
            h.vy = Math.sin(angle) * 110;
            h.facingRight = h.vx > 0;
          } else {
            h.aggro = false;
            h.vy *= 0.9;
            if (h.facingRight) {
              h.vx = 55;
              if (h.x > h.maxX) h.facingRight = false;
            } else {
              h.vx = -55;
              if (h.x < h.minX) h.facingRight = true;
            }
          }

          h.x += h.vx * dt;
          h.y += h.vy * dt;

          // Attack Player
          if (distToPlayer < player.radius + h.radius) {
            audio.playBite();
            player.takeDamage(25, game, 'Mauled by a fierce deep-sea Hunter Shark!');
            game.showToast('ALERT: HUNTER SHARK ATTACK! (-25 HP)', 'danger');
          }
        } else if (h.kind === 'jellyfish') {
          h.pulseTimer += dt * h.pulseSpeed;
          h.y = h.baseY + Math.sin(h.pulseTimer) * 55;

          const distToPlayer = Math.hypot(player.x - h.x, player.y - h.y);
          if (distToPlayer < player.radius + h.radius) {
            audio.playShock();
            player.takeDamage(18, game, 'Electrocuted by deep-sea jellyfish sting!');
            game.showToast('WARNING: ELECTRIC JELLYFISH DISCHARGE! (-18 HP)', 'danger');
          }
        } else if (h.kind === 'mine') {
          h.blink += dt * 4;
          const distToPlayer = Math.hypot(player.x - h.x, player.y - h.y);
          if (distToPlayer < player.radius + h.radius) {
            audio.playCollision();
            player.takeDamage(35, game, 'Detonated a submerged naval explosive mine!');
            game.showToast('WARNING: NAVAL MINE EXPLOSION! (-35 HP)', 'danger');
          }
        }
      });

      // 5. Friendly Fish
      this.fish.forEach(f => {
        f.wiggle += dt * 8;
        f.x += f.vx * dt;
        f.y += Math.sin(f.wiggle) * 10 * dt + f.vy * dt;

        if (f.x < 100) { f.x = 100; f.vx = Math.abs(f.vx); }
        else if (f.x > WORLD_WIDTH - 100) { f.x = WORLD_WIDTH - 100; f.vx = -Math.abs(f.vx); }
      });

      // 6. Extraction Gateway Trigger
      if (this.gatewayBeacon) {
        this.gatewayBeacon.pulseAngle += dt * 3;
        const distToGateway = Math.hypot(player.x - this.gatewayBeacon.x, player.y - this.gatewayBeacon.y);
        if (distToGateway < this.gatewayBeacon.radius + player.radius) {
          game.handleVictory();
        }
      }
    }

    render(ctx, camera) {
      // 1. Water Background
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
      oceanGrad.addColorStop(0, '#10395c');
      oceanGrad.addColorStop(0.5, '#0a233d');
      oceanGrad.addColorStop(1, '#051426');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Silt Bed
      ctx.fillStyle = '#1c3d5a';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // 2. SECTOR 1: THE SUNKEN AGORA (REFERENCE IMAGE RUINS)
      this.renderAgoraRuins(ctx);

      // 3. SECTOR 2-4: BOULDERS & ROCK FORMATIONS
      this.renderBoulders(ctx);

      // 4. GOLDEN COINS
      this.renderCoins(ctx);

      // 5. RELICS
      this.relics.forEach(rel => {
        if (!rel.excavated) this.renderRelic(ctx, rel);
      });

      // 6. HAZARDS (SHARKS, JELLYFISH, MINES)
      this.renderHazards(ctx);

      // 7. FISH
      this.fish.forEach(f => this.renderFish(ctx, f));

      // 8. BUBBLES
      this.bubbles.forEach(b => {
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha})`;
        ctx.fillStyle = `rgba(34, 211, 238, ${b.alpha * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // 9. SONAR PULSES
      this.sonarPulses.forEach(p => {
        ctx.strokeStyle = `rgba(34, 211, 238, ${p.alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 10. ATLANTIS GATEWAY BEACON
      if (this.gatewayBeacon) {
        this.renderGateway(ctx, this.gatewayBeacon);
      }
    }

    renderAgoraRuins(ctx) {
      // Courtyard square tiles
      for (let y = 60; y < 510; y += 60) {
        for (let x = 650; x < 1140; x += 60) {
          ctx.fillStyle = '#22476b';
          ctx.fillRect(x, y, 57, 57);
          ctx.fillStyle = '#2d5a85';
          ctx.fillRect(x, y, 57, 2);
          ctx.fillRect(x, y, 2, 57);
        }
      }

      // Cobblestone path
      const cobbleSegments = [
        { x: 300, y: 690, w: 100, h: 40 },
        { x: 340, y: 550, w: 130, h: 46 },
        { x: 400, y: 400, w: 150, h: 50 },
        { x: 430, y: 250, w: 130, h: 48 },
        { x: 410, y: 100, w: 100, h: 44 }
      ];

      cobbleSegments.forEach(seg => {
        ctx.fillStyle = '#173652';
        ctx.beginPath();
        ctx.roundRect(seg.x, seg.y, seg.w, seg.h, 8);
        ctx.fill();
      });

      // Elevated Terrace (Left)
      ctx.fillStyle = '#1a334d';
      ctx.strokeStyle = '#0c1b2b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(40, 40, 230, 400, [0, 8, 8, 0]);
      ctx.fill();
      ctx.stroke();

      this.renderColumn(ctx, 160, 240, 180);
      this.renderColumn(ctx, 630, 310, 190);

      // Prehistoric Whale Ribcage (Lower Left)
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3.5;
      [
        { x: 140, y: 635, h: 42 },
        { x: 170, y: 630, h: 48 },
        { x: 200, y: 632, h: 44 }
      ].forEach(rib => {
        ctx.beginPath();
        ctx.moveTo(rib.x, rib.y);
        ctx.quadraticCurveTo(rib.x - 18, rib.y - rib.h / 2, rib.x, rib.y - rib.h);
        ctx.stroke();
      });

      // Archway at bottom right of Agora
      ctx.fillStyle = '#112236';
      ctx.fillRect(570, 560, 80, 140);
      ctx.fillRect(760, 560, 80, 140);
      ctx.beginPath();
      ctx.arc(705, 560, 55, Math.PI, 0);
      ctx.fillStyle = '#162e47';
      ctx.fill();
    }

    renderColumn(ctx, x, y, height) {
      ctx.save();
      ctx.translate(x, y);

      const colGrad = ctx.createLinearGradient(-14, 0, 14, 0);
      colGrad.addColorStop(0, '#1c3d5a');
      colGrad.addColorStop(0.3, '#325d88');
      colGrad.addColorStop(0.7, '#234a6e');
      colGrad.addColorStop(1, '#0e2338');

      ctx.fillStyle = colGrad;
      ctx.fillRect(-12, -height, 24, height);

      ctx.fillStyle = '#234a6e';
      ctx.fillRect(-18, -6, 36, 10);
      ctx.fillRect(-18, -height - 8, 36, 10);

      ctx.restore();
    }

    renderBoulders(ctx) {
      ctx.save();
      this.boulders.forEach(b => {
        // Boulder Base Shadow
        ctx.fillStyle = 'rgba(3, 10, 20, 0.5)';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y + b.radius * 0.4, b.radius * 1.1, b.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Craggy Boulder Body
        const rGrad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.1, b.x, b.y, b.radius);
        rGrad.addColorStop(0, b.highlight);
        rGrad.addColorStop(0.6, b.color);
        rGrad.addColorStop(1, '#0b1622');

        ctx.fillStyle = rGrad;
        ctx.strokeStyle = '#09121a';
        ctx.lineWidth = 3;

        ctx.beginPath();
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const radOffset = (a % 2 === 0 ? 1 : 0.88);
          const px = b.x + Math.cos(ang) * b.radius * radOffset;
          const py = b.y + Math.sin(ang) * b.radius * radOffset;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Boulder Fissure / Crack Line
        ctx.strokeStyle = '#09121a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x - b.radius * 0.4, b.y - b.radius * 0.2);
        ctx.lineTo(b.x, b.y + b.radius * 0.2);
        ctx.lineTo(b.x + b.radius * 0.4, b.y + b.radius * 0.3);
        ctx.stroke();
      });
      ctx.restore();
    }

    renderCoins(ctx) {
      ctx.save();
      this.coins.forEach(c => {
        if (c.collected) return;
        const scaleX = Math.cos(c.spinAngle);

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(scaleX, 1);

        // Golden Outer Ring
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner Embossed Star
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, c.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
      ctx.restore();
    }

    renderHazards(ctx) {
      this.hazards.forEach(h => {
        if (h.kind === 'shark') {
          ctx.save();
          ctx.translate(h.x, h.y);
          if (!h.facingRight) ctx.scale(-1, 1);

          // Shark Body (Dark Slate Blue)
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.ellipse(0, 0, h.length * 0.5, 16, 0, 0, Math.PI * 2);
          ctx.fill();

          // White Underbelly
          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.ellipse(4, 6, h.length * 0.4, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Dorsal Fin
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(-6, -15);
          ctx.lineTo(10, -32);
          ctx.lineTo(20, -14);
          ctx.closePath();
          ctx.fill();

          // Menacing Tail Fin (Swishing)
          const tailSway = Math.sin(h.tailAngle) * 6;
          ctx.beginPath();
          ctx.moveTo(-h.length * 0.5, 0);
          ctx.lineTo(-h.length * 0.5 - 18, -18 + tailSway);
          ctx.lineTo(-h.length * 0.5 - 18, 18 + tailSway);
          ctx.closePath();
          ctx.fill();

          // Eye & Razor Teeth
          ctx.fillStyle = '#facc15'; // Predator eye
          ctx.beginPath();
          ctx.arc(h.length * 0.35, -4, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff'; // Teeth
          ctx.beginPath();
          ctx.moveTo(h.length * 0.4, 4);
          ctx.lineTo(h.length * 0.45, 8);
          ctx.lineTo(h.length * 0.35, 8);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        } else if (h.kind === 'jellyfish') {
          ctx.save();
          ctx.translate(h.x, h.y);

          // Translucent Bioluminescent Bell
          ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, -4, h.radius, Math.PI, 0);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Electric Tentacles
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          for (let t = -12; t <= 12; t += 6) {
            ctx.beginPath();
            ctx.moveTo(t, 0);
            ctx.quadraticCurveTo(t + Math.sin(h.pulseTimer * 3 + t) * 8, 18, t, 34);
            ctx.stroke();
          }

          ctx.restore();
        } else if (h.kind === 'mine') {
          ctx.save();
          ctx.translate(h.x, h.y);

          // Anchor chain
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, h.radius);
          ctx.lineTo(0, h.radius + 60);
          ctx.stroke();

          // Spiked Naval Sphere
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Horn spikes
          for (let s = 0; s < 6; s++) {
            const ang = (s / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * h.radius, Math.sin(ang) * h.radius);
            ctx.lineTo(Math.cos(ang) * (h.radius + 8), Math.sin(ang) * (h.radius + 8));
            ctx.stroke();
          }

          // Blinking red sensor
          ctx.fillStyle = Math.sin(h.blink) > 0 ? '#ef4444' : '#7f1d1d';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      });
    }

    renderRelic(ctx, rel) {
      ctx.save();
      ctx.translate(rel.x, rel.y);

      if (rel.sonarGlow > 0) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, rel.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (rel.type === RELIC_TYPE.AMPHORA) {
        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (rel.type === RELIC_TYPE.CHEST) {
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.fillRect(-14, -10, 28, 20);
        ctx.strokeRect(-14, -10, 28, 20);
      } else if (rel.type === RELIC_TYPE.BARREL) {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    renderFish(ctx, f) {
      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.vx < 0) ctx.scale(-1, 1);

      if (f.type === 'crimson') {
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.ellipse(0, 0, f.length, f.length * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -f.length * 0.45, 3, f.length * 0.9);
      } else {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(f.length, 0);
        ctx.lineTo(-f.length * 0.5, -f.length * 0.8);
        ctx.lineTo(-f.length * 0.5, f.length * 0.8);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    renderGateway(ctx, beacon) {
      ctx.save();
      ctx.translate(beacon.x, beacon.y);

      // Colossal Gateway Columns
      ctx.fillStyle = '#334155';
      ctx.fillRect(-60, -180, 24, 360);
      ctx.fillRect(36, -180, 24, 360);

      // Arch Header
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-70, -195, 140, 25);

      // Energy Portal Core
      const portalGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, beacon.radius);
      portalGrad.addColorStop(0, '#ffffff');
      portalGrad.addColorStop(0.4, '#22d3ee');
      portalGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = portalGrad;
      ctx.beginPath();
      ctx.arc(0, 0, beacon.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Energy Rings
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, beacon.radius * 0.75 + Math.sin(beacon.pulseAngle) * 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ==========================================================================
  // 7. CORE GAME STATE MANAGER
  // ==========================================================================

  class DeepSeaGame {
    constructor() {
      this.canvas = document.getElementById('ocean-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.caustics = new CausticsEngine();
      this.camera = new Camera();
      this.world = new SunkenRuinsWorld();

      // Player vessels
      this.sub = new Submarine(920, 240);
      this.diver = new Diver(570, 380);
      this.activeMode = EXPLORER_MODE.SUBMARINE;

      this.score = 0;
      this.coins = 0;
      this.relicsExcavatedCount = 0;
      this.isPaused = false;
      this.isGameOver = false;
      this.screenShake = 0;

      // Upgrades system
      this.upgrades = {
        oxygen: 0,
        thruster: 0,
        hull: 0,
        sonar: 0
      };

      this.input = {
        up: false,
        down: false,
        left: false,
        right: false,
        shift: false,
        space: false
      };

      this.nearbyRelic = null;
      this.lastTime = performance.now();

      this.loadStorage();
      this.initDom();
      this.initEvents();
    }

    loadStorage() {
      try {
        const storedCoins = localStorage.getItem('deepsea_total_coins');
        if (storedCoins) this.coins = parseInt(storedCoins, 10) || 0;

        const storedUp = localStorage.getItem('deepsea_upgrades');
        if (storedUp) this.upgrades = Object.assign(this.upgrades, JSON.parse(storedUp));
      } catch (e) {}
      this.sub.applyUpgrades(this.upgrades);
    }

    saveStorage() {
      try {
        localStorage.setItem('deepsea_total_coins', this.coins.toString());
        localStorage.setItem('deepsea_upgrades', JSON.stringify(this.upgrades));
      } catch (e) {}
    }

    initDom() {
      this.dom = {
        coins: document.getElementById('coins-display'),
        score: document.getElementById('score-display'),
        relics: document.getElementById('relics-display'),
        depth: document.getElementById('depth-display'),
        progressFill: document.getElementById('ocean-progress-fill'),
        progressText: document.getElementById('ocean-progress-text'),
        modeBtn: document.getElementById('btn-mode-switch'),
        modeBtnText: document.getElementById('mode-btn-text'),
        activeVessel: document.getElementById('active-vessel-text'),
        barO2: document.getElementById('bar-oxygen'),
        valO2: document.getElementById('val-oxygen'),
        barFuel: document.getElementById('bar-fuel'),
        valFuel: document.getElementById('val-fuel'),
        barHull: document.getElementById('bar-hull'),
        valHull: document.getElementById('val-hull'),
        sonarDial: document.getElementById('sonar-dial'),
        promptBox: document.getElementById('interaction-prompt'),
        promptLabel: document.getElementById('prompt-label'),
        alerts: document.getElementById('ocean-alerts-container'),
        flashOverlay: document.getElementById('damage-flash-overlay'),
        // Modals
        modalMenu: document.getElementById('modal-menu'),
        modalHangar: document.getElementById('modal-hangar'),
        modalGuide: document.getElementById('modal-guide'),
        modalGameOver: document.getElementById('modal-gameover'),
        modalVictory: document.getElementById('modal-victory'),
        hangarCoins: document.getElementById('hangar-coins'),
        sumArtifacts: document.getElementById('sum-artifacts'),
        // Audio Icons
        soundOn: document.getElementById('sound-icon-on'),
        soundOff: document.getElementById('sound-icon-off'),
        pauseIcon: document.getElementById('pause-icon'),
        playIcon: document.getElementById('play-icon')
      };
      this.updateHud();
    }

    initEvents() {
      window.addEventListener('keydown', e => {
        if (['ArrowUp', 'KeyW'].includes(e.code)) this.input.up = true;
        if (['ArrowDown', 'KeyS'].includes(e.code)) this.input.down = true;
        if (['ArrowLeft', 'KeyA'].includes(e.code)) this.input.left = true;
        if (['ArrowRight', 'KeyD'].includes(e.code)) this.input.right = true;
        if (['ShiftLeft', 'ShiftRight'].includes(e.code)) this.input.shift = true;

        if (e.code === 'Space') {
          e.preventDefault();
          this.triggerSonar();
        }

        if (e.code === 'KeyE') {
          this.triggerExcavation();
        }

        if (e.code === 'KeyF') {
          this.toggleExplorerMode();
        }

        if (e.code === 'KeyP' || e.code === 'Escape') {
          this.togglePause();
        }

        if (e.code === 'KeyM') {
          this.toggleAudio();
        }

        if (e.code === 'KeyU') {
          this.openHangar();
        }

        if (e.code === 'KeyR' && this.isGameOver) {
          this.restart();
        }
      });

      window.addEventListener('keyup', e => {
        if (['ArrowUp', 'KeyW'].includes(e.code)) this.input.up = false;
        if (['ArrowDown', 'KeyS'].includes(e.code)) this.input.down = false;
        if (['ArrowLeft', 'KeyA'].includes(e.code)) this.input.left = false;
        if (['ArrowRight', 'KeyD'].includes(e.code)) this.input.right = false;
        if (['ShiftLeft', 'ShiftRight'].includes(e.code)) this.input.shift = false;
      });

      document.getElementById('menu-btn-play').addEventListener('click', () => {
        this.dom.modalMenu.classList.add('hidden');
        this.isPaused = false;
        audio.ensureContext();
      });

      this.dom.modeBtn.addEventListener('click', () => this.toggleExplorerMode());

      document.getElementById('btn-sound').addEventListener('click', () => this.toggleAudio());
      document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
      document.getElementById('btn-hangar').addEventListener('click', () => this.openHangar());
      document.getElementById('menu-btn-hangar').addEventListener('click', () => this.openHangar());
      document.getElementById('btn-close-hangar').addEventListener('click', () => this.dom.modalHangar.classList.add('hidden'));

      document.getElementById('btn-guide').addEventListener('click', () => this.dom.modalGuide.classList.remove('hidden'));
      document.getElementById('menu-btn-guide').addEventListener('click', () => this.dom.modalGuide.classList.remove('hidden'));
      document.getElementById('btn-close-guide').addEventListener('click', () => this.dom.modalGuide.classList.add('hidden'));
      document.getElementById('btn-guide-ok').addEventListener('click', () => this.dom.modalGuide.classList.add('hidden'));

      document.getElementById('btn-restart').addEventListener('click', () => this.restart());
      document.getElementById('btn-next-dive').addEventListener('click', () => this.restart());
      document.getElementById('btn-vic-hangar').addEventListener('click', () => {
        this.dom.modalVictory.classList.add('hidden');
        this.openHangar();
      });

      ['oxygen', 'thruster', 'hull', 'sonar'].forEach(type => {
        const btn = document.getElementById(`btn-upgrade-${type}`);
        if (btn) btn.addEventListener('click', () => this.buyUpgrade(type));
      });
    }

    triggerDamageFlash() {
      if (this.dom.flashOverlay) {
        this.dom.flashOverlay.classList.add('active');
        setTimeout(() => this.dom.flashOverlay.classList.remove('active'), 200);
      }
    }

    toggleExplorerMode() {
      if (this.activeMode === EXPLORER_MODE.SUBMARINE) {
        this.activeMode = EXPLORER_MODE.DIVER;
        this.diver.x = this.sub.x - 20;
        this.diver.y = this.sub.y + 20;
        this.showToast('EXPLORING ON FOOT AS DEEP-SEA DIVER', 'warning');
      } else {
        this.activeMode = EXPLORER_MODE.SUBMARINE;
        this.showToast('BOARDED BRASS NAUTILUS SUBMARINE', 'warning');
      }
      this.updateHud();
      audio.playRefill();
    }

    triggerSonar() {
      const activeEntity = this.activeMode === EXPLORER_MODE.SUBMARINE ? this.sub : this.diver;
      if (this.sub.activateSonar(this.world)) {
        this.showToast('SONAR RADAR ACTIVE: COINS & RELICS HIGHLIGHTED', 'info');
      }
    }

    triggerExcavation() {
      if (!this.nearbyRelic) return;
      const rel = this.nearbyRelic;
      rel.excavated = true;
      this.relicsExcavatedCount++;
      this.score += rel.points;
      this.coins += rel.value;
      this.saveStorage();

      audio.playExcavate();
      this.showToast(`EXCAVATED: ${rel.name.toUpperCase()} (+${rel.value} COINS)`, 'success');

      for (let i = 0; i < 15; i++) {
        this.world.createBubble(
          rel.x + (Math.random() - 0.5) * 20,
          rel.y + (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 50,
          Math.random() * 4 + 2
        );
      }

      this.updateHud();
    }

    buyUpgrade(type) {
      const costs = { oxygen: 120, thruster: 150, hull: 180, sonar: 140 };
      const cost = costs[type];

      if (this.upgrades[type] >= 3) {
        this.showToast('MODULE ALREADY AT MAXIMUM TIER!', 'warning');
        return;
      }

      if (this.coins < cost) {
        this.showToast(`INSUFFICIENT RESEARCH CREDITS (NEEDS ${cost})`, 'danger');
        return;
      }

      this.coins -= cost;
      this.upgrades[type]++;
      this.sub.applyUpgrades(this.upgrades);
      this.saveStorage();
      audio.playVictory();
      this.showToast(`UPGRADE INSTALLED: TIER ${this.upgrades[type]}!`, 'success');
      this.updateHangarModal();
      this.updateHud();
    }

    openHangar() {
      this.updateHangarModal();
      this.dom.modalHangar.classList.remove('hidden');
    }

    updateHangarModal() {
      this.dom.hangarCoins.textContent = `${this.coins} OCEAN COINS`;
      ['oxygen', 'thruster', 'hull', 'sonar'].forEach(t => {
        const tierElem = document.getElementById(`tier-${t}`);
        const btn = document.getElementById(`btn-upgrade-${t}`);
        const tier = this.upgrades[t];
        if (tierElem) tierElem.textContent = `Tier ${tier}/3`;
        if (btn) {
          if (tier >= 3) {
            btn.textContent = 'MAX TIER';
            btn.disabled = true;
          } else {
            const costs = { oxygen: 120, thruster: 150, hull: 180, sonar: 140 };
            btn.textContent = `UPGRADE: ${costs[t]} COINS`;
            btn.disabled = false;
          }
        }
      });
    }

    showToast(msg, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `ocean-toast ${type}`;
      toast.textContent = msg;
      this.dom.alerts.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 2600);
    }

    toggleAudio() {
      const enabled = audio.toggle();
      this.dom.soundOn.classList.toggle('hidden', !enabled);
      this.dom.soundOff.classList.toggle('hidden', enabled);
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      if (!this.isPaused) {
        this.lastTime = performance.now();
      }
      this.dom.pauseIcon.classList.toggle('hidden', this.isPaused);
      this.dom.playIcon.classList.toggle('hidden', !this.isPaused);
    }

    handleVictory() {
      audio.playVictory();
      document.getElementById('vic-score').textContent = this.score;
      this.dom.modalVictory.classList.remove('hidden');
    }

    handleGameOver(reason) {
      this.isGameOver = true;
      audio.playCollision();
      document.getElementById('gameover-reason').textContent = reason;
      document.getElementById('go-score').textContent = this.score;
      document.getElementById('go-coins').textContent = this.coins;
      this.dom.modalGameOver.classList.remove('hidden');
    }

    restart() {
      this.isGameOver = false;
      this.isPaused = false;
      this.dom.modalGameOver.classList.add('hidden');
      this.dom.modalVictory.classList.add('hidden');

      this.score = 0;
      this.relicsExcavatedCount = 0;
      this.world = new SunkenRuinsWorld();
      this.sub = new Submarine(920, 240);
      this.sub.applyUpgrades(this.upgrades);
      this.diver = new Diver(570, 380);
      this.activeMode = EXPLORER_MODE.SUBMARINE;

      this.updateHud();
      audio.playRefill();
    }

    updateHud() {
      this.dom.coins.textContent = this.coins;
      this.dom.score.textContent = this.score;
      this.dom.relics.textContent = `${this.relicsExcavatedCount}/${this.world.relics.length}`;

      const active = this.activeMode === EXPLORER_MODE.SUBMARINE ? this.sub : this.diver;
      const isSub = this.activeMode === EXPLORER_MODE.SUBMARINE;
      this.dom.activeVessel.textContent = isSub ? 'BRASS NAUTILUS' : 'DEEP-SEA DIVER';
      this.dom.modeBtnText.textContent = isSub ? 'DIVER MODE [F]' : 'SUBMARINE [F]';

      // Ocean Exploration Distance Progress
      const progressPct = Math.min(100, Math.round((active.x / WORLD_WIDTH) * 100));
      if (this.dom.progressFill) this.dom.progressFill.style.width = `${progressPct}%`;
      if (this.dom.progressText) this.dom.progressText.textContent = `${Math.round(active.x)}m / ${WORLD_WIDTH}m`;

      // Depth
      const depthMeters = Math.round(100 + (active.y / WORLD_HEIGHT) * 600);
      this.dom.depth.textContent = `${depthMeters}m`;

      // Telemetry Bars
      const o2Pct = Math.round((this.sub.oxygen / this.sub.maxOxygen) * 100);
      this.dom.barO2.style.width = `${o2Pct}%`;
      this.dom.valO2.textContent = `${o2Pct}%`;

      const fuelPct = Math.round((this.sub.fuel / this.sub.maxFuel) * 100);
      this.dom.barFuel.style.width = `${fuelPct}%`;
      this.dom.valFuel.textContent = `${fuelPct}%`;

      const hullPct = Math.round((this.sub.hull / this.sub.maxHull) * 100);
      this.dom.barHull.style.width = `${hullPct}%`;
      this.dom.valHull.textContent = `${hullPct}%`;

      if (this.sub.sonarCooldown <= 0) {
        this.dom.sonarDial.textContent = 'READY';
        this.dom.sonarDial.classList.remove('charging');
      } else {
        this.dom.sonarDial.textContent = `${this.sub.sonarCooldown.toFixed(1)}s`;
        this.dom.sonarDial.classList.add('charging');
      }
    }

    update(dt) {
      if (this.isPaused || this.isGameOver) return;

      this.caustics.update(dt);

      const activePlayer = this.activeMode === EXPLORER_MODE.SUBMARINE ? this.sub : this.diver;
      this.world.update(dt, activePlayer, this);

      if (this.activeMode === EXPLORER_MODE.SUBMARINE) {
        this.sub.update(dt, this.input, this.world, this);
      } else {
        this.diver.update(dt, this.input, this.world, this);
      }

      // Smooth Camera tracking
      this.camera.update(activePlayer, dt);

      // Bubble Vent Oxygen Recharge Check
      [700, 2100, 3100].forEach(vx => {
        const distToVent = Math.hypot(activePlayer.x - vx, activePlayer.y - (WORLD_HEIGHT - 120));
        if (distToVent < 80) {
          if (this.sub.oxygen < this.sub.maxOxygen) {
            this.sub.oxygen = Math.min(this.sub.maxOxygen, this.sub.oxygen + dt * 25);
            if (Math.random() < 0.1) audio.playRefill();
          }
        }
      });

      // Relic Excavation Proximity Check
      this.nearbyRelic = null;
      for (const rel of this.world.relics) {
        if (!rel.excavated) {
          const d = Math.hypot(activePlayer.x - rel.x, activePlayer.y - rel.y);
          if (d < rel.radius + 38) {
            this.nearbyRelic = rel;
            break;
          }
        }
      }

      if (this.nearbyRelic) {
        this.dom.promptLabel.textContent = `EXCAVATE ${this.nearbyRelic.name.toUpperCase()}`;
        this.dom.promptBox.classList.remove('hidden');
      } else {
        this.dom.promptBox.classList.add('hidden');
      }

      if (this.sub.oxygen <= 0) {
        this.handleGameOver('Oxygen reserves fully depleted! Emergency ascent triggered.');
      }

      this.updateHud();
    }

    render() {
      this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.save();
      // Apply Screen Shake
      if (this.screenShake > 0) {
        this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        this.screenShake = Math.max(0, this.screenShake - 0.5);
      }

      // Camera view transform
      this.ctx.translate(-this.camera.x, -this.camera.y);

      // 1. Sunken Ruins, Boulders, Hazards & Sea Life
      this.world.render(this.ctx, this.camera);

      // 2. Render Inactive and Active Player Vessels
      if (this.activeMode === EXPLORER_MODE.SUBMARINE) {
        this.diver.render(this.ctx);
        this.sub.render(this.ctx);
      } else {
        this.sub.render(this.ctx);
        this.diver.render(this.ctx);
      }

      this.ctx.restore();

      // 3. Screen-Space Caustics & Sun Rays
      this.caustics.render(this.ctx);
    }
  }

  // ==========================================================================
  // 8. INITIALIZATION & GAME LOOP
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', () => {
    const game = new DeepSeaGame();

    function mainLoop(timestamp) {
      const dt = Math.min(0.08, (timestamp - game.lastTime) / 1000);
      game.lastTime = timestamp;

      game.update(dt);
      game.render();

      requestAnimationFrame(mainLoop);
    }

    requestAnimationFrame(mainLoop);
  });
})();
