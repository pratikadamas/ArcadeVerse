// Cyber Tanks - 2D Turn-Based Destructible Artillery Duel Engine

class TankAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCannonFire() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playExplosion() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
}

class CyberTanksGame {
  constructor() {
    this.canvas = document.getElementById('tankCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new TankAudio();

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Destructible terrain heightmap array (1 value per column)
    this.terrain = new Float32Array(this.width);

    // Tanks
    this.player = { x: 80, y: 0, hp: 100, angle: 45, power: 60 };
    this.ai = { x: 560, y: 0, hp: 100, angle: 45, power: 55, lastAimError: 0 };

    this.turn = 'PLAYER'; // 'PLAYER', 'PROJECTILE', 'AI'
    this.wind = 0; // -3 to +3
    this.projectiles = [];
    this.particles = [];

    this.initDOM();
    this.generateTerrain();
    this.setupEvents();

    this.animate();
  }

  initDOM() {
    this.playerHpBar = document.getElementById('playerHpBar');
    this.playerHpNum = document.getElementById('playerHpNum');
    this.enemyHpBar = document.getElementById('enemyHpBar');
    this.enemyHpNum = document.getElementById('enemyHpNum');
    this.windVal = document.getElementById('windVal');
    this.turnBanner = document.getElementById('turnBanner');

    this.angleSlider = document.getElementById('angleSlider');
    this.angleVal = document.getElementById('angleVal');
    this.powerSlider = document.getElementById('powerSlider');
    this.powerVal = document.getElementById('powerVal');
    this.weaponSelect = document.getElementById('weaponSelect');

    this.fireBtn = document.getElementById('fireBtn');
    this.restartDuelBtn = document.getElementById('restartDuelBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.guideBtn = document.getElementById('guideBtn');
    this.guideModal = document.getElementById('guideModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  generateTerrain() {
    // Multi-octave sinusoidal rolling hills
    const baseHeight = 260;
    const amp1 = 50 + Math.random() * 30;
    const freq1 = 0.006 + Math.random() * 0.004;
    const amp2 = 25 + Math.random() * 15;
    const freq2 = 0.015;

    for (let x = 0; x < this.width; x++) {
      this.terrain[x] = baseHeight + Math.sin(x * freq1) * amp1 + Math.cos(x * freq2) * amp2;
    }

    // Place Tanks on ground
    this.updateTankPositions();
    this.updateWind();
  }

  updateTankPositions() {
    this.player.y = this.terrain[Math.floor(this.player.x)];
    this.ai.y = this.terrain[Math.floor(this.ai.x)];
  }

  updateWind() {
    this.wind = (Math.random() - 0.5) * 4;
    const dir = this.wind >= 0 ? 'EAST >' : '< WEST';
    this.windVal.textContent = `${Math.abs(this.wind * 4).toFixed(1)} MPH ${dir}`;
  }

  setupEvents() {
    this.angleSlider.addEventListener('input', (e) => {
      this.player.angle = parseInt(e.target.value, 10);
      this.angleVal.textContent = `${this.player.angle}°`;
    });

    this.powerSlider.addEventListener('input', (e) => {
      this.player.power = parseInt(e.target.value, 10);
      this.powerVal.textContent = `${this.player.power}%`;
    });

    this.fireBtn.addEventListener('click', () => {
      if (this.turn !== 'PLAYER') return;
      this.firePlayerShell();
    });

    this.restartDuelBtn.addEventListener('click', () => {
      this.player.hp = 100;
      this.ai.hp = 100;
      this.turn = 'PLAYER';
      this.turnBanner.textContent = 'PLAYER TURN';
      this.fireBtn.disabled = false;
      this.generateTerrain();
      this.updateHUD();
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.guideBtn.addEventListener('click', () => this.guideModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.guideModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.guideModal.classList.add('hidden'));
  }

  firePlayerShell() {
    this.turn = 'PROJECTILE';
    this.fireBtn.disabled = true;
    this.turnBanner.textContent = 'SHELL IN FLIGHT...';

    const rad = (this.player.angle * Math.PI) / 180;
    const speed = (this.player.power / 100) * 16;
    const barrelLen = 18;

    this.projectiles.push({
      x: this.player.x + Math.cos(rad) * barrelLen,
      y: this.player.y - 12 - Math.sin(rad) * barrelLen,
      vx: Math.cos(rad) * speed,
      vy: -Math.sin(rad) * speed,
      type: this.weaponSelect.value,
      isPlayer: true
    });

    this.audio.playCannonFire();
  }

  fireAiShell() {
    this.turn = 'PROJECTILE';
    this.turnBanner.textContent = 'AI FIRING...';

    // AI targeting logic with iterative adjustment
    const dx = this.player.x - this.ai.x;
    const dist = Math.abs(dx);
    const rad = ((45 + (Math.random() - 0.5) * 10) * Math.PI) / 180;
    // Ballistic calculation estimating power
    const estimatedSpeed = Math.sqrt((dist * 0.22) / Math.sin(2 * rad)) + (this.wind * 0.8) + this.ai.lastAimError;
    const speed = Math.max(8, Math.min(18, estimatedSpeed));

    this.projectiles.push({
      x: this.ai.x - Math.cos(rad) * 18,
      y: this.ai.y - 12 - Math.sin(rad) * 18,
      vx: -Math.cos(rad) * speed,
      vy: -Math.sin(rad) * speed,
      type: 'standard',
      isPlayer: false
    });

    this.audio.playCannonFire();
  }

  carveCrater(cx, cy, radius) {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));

    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      if (Math.abs(dx) <= radius) {
        const dy = Math.sqrt(radius * radius - dx * dx);
        const craterBottom = cy + dy;
        if (this.terrain[x] < craterBottom) {
          this.terrain[x] = Math.min(this.height - 20, Math.max(this.terrain[x], craterBottom));
        }
      }
    }

    // Spawn sparks
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1
      });
    }

    this.updateTankPositions();
  }

  updateHUD() {
    this.playerHpBar.style.width = `${Math.max(0, this.player.hp)}%`;
    this.playerHpNum.textContent = `${Math.max(0, this.player.hp)} HP`;
    this.enemyHpBar.style.width = `${Math.max(0, this.ai.hp)}%`;
    this.enemyHpNum.textContent = `${Math.max(0, this.ai.hp)} HP`;
  }

  animate() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  update() {
    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      p.vx += this.wind * 0.015; // Wind acceleration
      p.vy += 0.22; // Gravity
      p.x += p.vx;
      p.y += p.vy;

      // Cluster Bomb split mid-air at apex
      if (p.type === 'cluster' && p.vy > 0 && !p.hasSplit) {
        p.hasSplit = true;
        this.projectiles.push({
          x: p.x, y: p.y, vx: p.vx - 2, vy: p.vy, type: 'standard', isPlayer: p.isPlayer
        });
        this.projectiles.push({
          x: p.x, y: p.y, vx: p.vx + 2, vy: p.vy, type: 'standard', isPlayer: p.isPlayer
        });
      }

      // Check terrain collision
      const colX = Math.floor(p.x);
      let hitTerrain = false;
      if (colX >= 0 && colX < this.width && p.y >= this.terrain[colX]) {
        hitTerrain = true;
      }

      // Check Tank collisions
      const targetTank = p.isPlayer ? this.ai : this.player;
      const distTank = Math.hypot(p.x - targetTank.x, p.y - (targetTank.y - 8));

      if (distTank < 18 || hitTerrain || p.y > this.height) {
        const radius = p.type === 'piercer' ? 36 : 24;
        this.carveCrater(p.x, p.y, radius);
        this.audio.playExplosion();

        // Damage assessment
        if (distTank < 32) {
          const dmg = p.type === 'piercer' ? 35 : 50;
          targetTank.hp = Math.max(0, targetTank.hp - dmg);
          this.updateHUD();
        }

        // AI learning feedback
        if (!p.isPlayer) {
          const missDist = p.x - this.player.x;
          this.ai.lastAimError = -missDist * 0.02;
        }

        this.projectiles.splice(i, 1);
      }
    }

    // When projectiles resolve, alternate turns
    if (this.turn === 'PROJECTILE' && this.projectiles.length === 0) {
      if (this.player.hp <= 0) {
        this.turnBanner.textContent = 'AI DRONE WINS! DEFEAT';
      } else if (this.ai.hp <= 0) {
        this.turnBanner.textContent = 'VICTORY! ENEMY DESTROYED';
      } else {
        this.updateWind();
        if (this.fireBtn.disabled) {
          // Switch to AI
          this.turn = 'AI';
          setTimeout(() => this.fireAiShell(), 1200);
        } else {
          // Back to Player
          this.turn = 'PLAYER';
          this.turnBanner.textContent = 'PLAYER TURN';
        }
      }
    }

    if (this.turn === 'AI' && this.projectiles.length === 0 && !this.fireBtn.disabled) {
      this.turn = 'PLAYER';
      this.turnBanner.textContent = 'PLAYER TURN';
    } else if (this.turn === 'PLAYER') {
      this.fireBtn.disabled = false;
    }

    // Particle decay
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.04;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  render() {
    const w = this.width;
    const h = this.height;
    this.ctx.clearRect(0, 0, w, h);

    // Neon Sky Grid Background
    this.ctx.fillStyle = '#060a1d';
    this.ctx.fillRect(0, 0, w, h);

    // Draw Destructible Terrain
    this.ctx.beginPath();
    this.ctx.moveTo(0, h);
    for (let x = 0; x < w; x++) {
      this.ctx.lineTo(x, this.terrain[x]);
    }
    this.ctx.lineTo(w, h);
    this.ctx.closePath();

    const terrainGrad = this.ctx.createLinearGradient(0, 200, 0, h);
    terrainGrad.addColorStop(0, '#1e293b');
    terrainGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = terrainGrad;
    this.ctx.fill();

    // Fluorescent Green Terrain Ridge Line
    this.ctx.beginPath();
    for (let x = 0; x < w; x++) {
      if (x === 0) this.ctx.moveTo(x, this.terrain[x]);
      else this.ctx.lineTo(x, this.terrain[x]);
    }
    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#10b981';
    this.ctx.shadowBlur = 8;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Render Player Tank (Cyan)
    this.renderTank(this.player.x, this.player.y, this.player.angle, '#06b6d4', true);

    // Render AI Tank (Red)
    this.renderTank(this.ai.x, this.ai.y, this.ai.angle, '#ef4444', false);

    // Render Projectiles
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.shadowColor = '#f59e0b';
    this.ctx.shadowBlur = 10;
    this.projectiles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.shadowBlur = 0;

    // Render Explosion Particles
    this.particles.forEach(pt => {
      this.ctx.fillStyle = `rgba(239, 68, 68, ${pt.life})`;
      this.ctx.fillRect(pt.x, pt.y, 3, 3);
    });
  }

  renderTank(x, y, angleDeg, color, isPlayer) {
    this.ctx.save();
    // Tank Chassis
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.fillRect(x - 14, y - 8, 28, 8);
    // Treads
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(x - 16, y - 4, 32, 5);
    // Turret Dome
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(x, y - 8, 6, Math.PI, 0);
    this.ctx.fill();

    // Turret Barrel
    const rad = (angleDeg * Math.PI) / 180;
    const dir = isPlayer ? 1 : -1;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - 8);
    this.ctx.lineTo(x + Math.cos(rad) * 16 * dir, (y - 8) - Math.sin(rad) * 16);
    this.ctx.stroke();
    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CyberTanksGame();
});
