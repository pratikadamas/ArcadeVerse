/**
 * Cyber-Katana: Neon Deflector
 * 60 FPS Canvas Game Engine with Blade Deflection Physics, Ghosting Dash, and Web Audio API Synthesizer
 * Author: Babin Bid (Babin123456)
 */

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER (Pure Web Audio API) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = true;
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

    playSlash() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playDeflect() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(2400, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    playDash() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    playHit() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    playCombo() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.18, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.04 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.15);
      });
    }

    playBossAlert() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.4);
      osc.frequency.linearRampToValueAtTime(110, now + 0.8);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    }
  }

  // --- GAME STATE & ENTITIES ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const sound = new SoundFX();

  const STORAGE_KEY = 'arcadeverse_cyber_katana_best';
  let bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

  let state = {
    running: false,
    paused: false,
    score: 0,
    wave: 1,
    combo: 1,
    comboTimer: 0,
    deflectedCount: 0,
    timeScale: 1.0,
    bulletTimeGauge: 100,
    isBulletTime: false,
    cameraShake: 0
  };

  const player = {
    x: 0,
    y: 0,
    radius: 16,
    hp: 100,
    maxHp: 100,
    speed: 5.5,
    vx: 0,
    vy: 0,
    angle: 0,
    // Blade
    isSwinging: false,
    swingProgress: 0,
    swingDuration: 12, // frames
    bladeLength: 68,
    bladeArc: Math.PI * 0.85,
    swingDir: 1,
    trail: [],
    // Dash
    isDashing: false,
    dashFrames: 0,
    dashDuration: 9,
    dashCooldown: 0,
    dashSpeed: 17,
    dashVx: 0,
    dashVy: 0,
    ghosts: []
  };

  const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
    Space: false, Shift: false
  };

  let mousePos = { x: 0, y: 0 };
  let bullets = [];
  let enemies = [];
  let particles = [];
  let floatingTexts = [];
  let boss = null;
  let waveTimer = 0;
  let waveEnemiesSpawned = 0;
  let waveEnemiesTotal = 8;

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    if (!state.running && player.x === 0 && player.y === 0) {
      player.x = canvas.width / 2;
      player.y = canvas.height / 2;
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- CONTROLS & LISTENERS ---
  window.addEventListener('keydown', (e) => {
    sound.init();
    if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
      return;
    }
    if (keys.hasOwnProperty(e.code) || keys.hasOwnProperty(e.key)) {
      keys[e.code] = true;
      keys[e.key] = true;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      executeSlash();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      executeDash();
    }
    if (e.code === 'KeyE') {
      toggleBulletTime();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code) || keys.hasOwnProperty(e.key)) {
      keys[e.code] = false;
      keys[e.key] = false;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mousedown', (e) => {
    sound.init();
    if (!state.running || state.paused) return;
    if (e.button === 0) {
      executeSlash();
    } else if (e.button === 2) {
      e.preventDefault();
      executeDash();
    } else if (e.button === 1) {
      e.preventDefault();
      toggleBulletTime();
    }
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Touch Support
  function setupTouch() {
    const bindTouch = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sound.init();
        onDown();
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (onUp) onUp();
      }, { passive: false });
    };

    bindTouch('btn-up', () => { keys.w = true; }, () => { keys.w = false; });
    bindTouch('btn-down', () => { keys.s = true; }, () => { keys.s = false; });
    bindTouch('btn-left', () => { keys.a = true; }, () => { keys.a = false; });
    bindTouch('btn-right', () => { keys.d = true; }, () => { keys.d = false; });
    bindTouch('touch-slash', () => executeSlash());
    bindTouch('touch-dash', () => executeDash());
  }
  setupTouch();

  // HUD Buttons
  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on-icon').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off-icon').classList.toggle('hidden', sound.enabled);
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    const modal = document.getElementById('help-modal');
    modal.classList.remove('hidden');
    if (state.running && !state.paused) togglePause();
  });

  document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
  });

  document.getElementById('pause-btn').addEventListener('click', () => togglePause());
  document.getElementById('start-btn').addEventListener('click', () => startGame());
  document.getElementById('restart-btn').addEventListener('click', () => startGame());

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    document.getElementById('pause-icon').classList.toggle('hidden', state.paused);
    document.getElementById('play-icon').classList.toggle('hidden', !state.paused);
  }

  function toggleBulletTime() {
    if (!state.isBulletTime && state.bulletTimeGauge > 25) {
      state.isBulletTime = true;
      state.timeScale = 0.35;
      document.getElementById('bullet-time-vignette').classList.add('active');
    } else {
      state.isBulletTime = false;
      state.timeScale = 1.0;
      document.getElementById('bullet-time-vignette').classList.remove('active');
    }
  }

  function executeSlash() {
    if (player.isSwinging) return;
    player.isSwinging = true;
    player.swingProgress = 0;
    player.swingDir *= -1;
    sound.playSlash();
  }

  function executeDash() {
    if (player.isDashing || player.dashCooldown > 0) return;
    let dx = 0, dy = 0;
    if (keys.w || keys.ArrowUp) dy -= 1;
    if (keys.s || keys.ArrowDown) dy += 1;
    if (keys.a || keys.ArrowLeft) dx -= 1;
    if (keys.d || keys.ArrowRight) dx += 1;

    if (dx === 0 && dy === 0) {
      dx = Math.cos(player.angle);
      dy = Math.sin(player.angle);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    player.isDashing = true;
    player.dashFrames = player.dashDuration;
    player.dashCooldown = 35;
    player.dashVx = dx * player.dashSpeed;
    player.dashVy = dy * player.dashSpeed;
    sound.playDash();

    // Create dash burst particles
    for (let i = 0; i < 16; i++) {
      particles.push(new Particle(player.x, player.y, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, '#ff007f', 18));
    }
  }

  // --- PARTICLE & FLOATING TEXT ENGINE ---
  class Particle {
    constructor(x, y, vx, vy, color, life, size = 3) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.maxLife = life;
      this.life = life;
      this.size = size;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.94;
      this.vy *= 0.94;
      this.life -= dt;
      return this.life > 0;
    }
    draw(c) {
      const alpha = Math.max(0, this.life / this.maxLife);
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = this.color;
      c.shadowColor = this.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  class FloatingText {
    constructor(text, x, y, color) {
      this.text = text;
      this.x = x;
      this.y = y;
      this.color = color;
      this.life = 40;
    }
    update(dt) {
      this.y -= 1.2 * dt;
      this.life -= dt;
      return this.life > 0;
    }
    draw(c) {
      c.save();
      c.globalAlpha = Math.max(0, this.life / 40);
      c.font = 'bold 16px monospace';
      c.fillStyle = this.color;
      c.shadowColor = this.color;
      c.shadowBlur = 10;
      c.textAlign = 'center';
      c.fillText(this.text, this.x, this.y);
      c.restore();
    }
  }

  // --- ENEMY & BOSS CLASSES ---
  class Drone {
    constructor(x, y, type = 'drone') {
      this.x = x;
      this.y = y;
      this.type = type;
      this.radius = type === 'turret' ? 20 : 14;
      this.hp = type === 'turret' ? 4 : 2;
      this.fireTimer = Math.random() * 40;
      this.fireRate = type === 'turret' ? 70 : 90;
      this.speed = type === 'turret' ? 0.6 : 1.8;
      this.color = type === 'turret' ? '#ff0055' : '#a855f7';
      this.rot = 0;
    }

    update(dt) {
      this.rot += 0.05 * dt;
      // Movement
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > (this.type === 'turret' ? 240 : 160)) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      }

      // Shooting
      this.fireTimer += dt;
      if (this.fireTimer >= this.fireRate) {
        this.fireTimer = 0;
        this.shoot();
      }
    }

    shoot() {
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      bullets.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * 4.8,
        vy: Math.sin(angle) * 4.8,
        radius: 5,
        color: this.color,
        isPlayer: false,
        speed: 4.8
      });
    }

    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      c.strokeStyle = this.color;
      c.lineWidth = 2.5;
      c.shadowColor = this.color;
      c.shadowBlur = 12;

      if (this.type === 'turret') {
        c.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        c.fillStyle = '#1e1b4b';
        c.fillRect(-this.radius + 3, -this.radius + 3, (this.radius - 3) * 2, (this.radius - 3) * 2);
        c.beginPath();
        c.arc(0, 0, 6, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(0, -this.radius);
        c.lineTo(this.radius, this.radius);
        c.lineTo(-this.radius, this.radius);
        c.closePath();
        c.stroke();
      }
      c.restore();
    }
  }

  class CyberSentinel {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 42;
      this.hp = 35;
      this.maxHp = 35;
      this.sweepAngle = 0;
      this.fireTimer = 0;
      this.missileTimer = 0;
      this.color = '#ff007f';
    }

    update(dt) {
      this.sweepAngle += 0.02 * dt;
      this.fireTimer += dt;
      this.missileTimer += dt;

      // Gentle hover towards center
      const cx = canvas.width / 2;
      const cy = canvas.height / 3;
      this.x += (cx - this.x) * 0.02 * dt;
      this.y += (cy - this.y) * 0.02 * dt;

      // Quad laser bolt spread
      if (this.fireTimer >= 45) {
        this.fireTimer = 0;
        for (let i = 0; i < 4; i++) {
          const a = this.sweepAngle + (i * Math.PI / 2);
          bullets.push({
            x: this.x + Math.cos(a) * 30,
            y: this.y + Math.sin(a) * 30,
            vx: Math.cos(a) * 4.2,
            vy: Math.sin(a) * 4.2,
            radius: 6,
            color: '#00f3ff',
            isPlayer: false,
            speed: 4.2
          });
        }
      }

      // Seeker missile targeted at player
      if (this.missileTimer >= 110) {
        this.missileTimer = 0;
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        bullets.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(a) * 3.5,
          vy: Math.sin(a) * 3.5,
          radius: 8,
          color: '#ffe600',
          isPlayer: false,
          speed: 3.5,
          isMissile: true
        });
      }
    }

    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.strokeStyle = this.color;
      c.lineWidth = 3.5;
      c.shadowColor = this.color;
      c.shadowBlur = 20;

      // Outer rotating segmented armor
      c.rotate(this.sweepAngle);
      c.beginPath();
      c.arc(0, 0, this.radius, 0, Math.PI * 1.5);
      c.stroke();

      c.rotate(-this.sweepAngle * 2);
      c.beginPath();
      c.arc(0, 0, this.radius - 12, 0, Math.PI * 2);
      c.strokeStyle = '#00f3ff';
      c.stroke();

      // Core
      c.fillStyle = '#ff0055';
      c.beginPath();
      c.arc(0, 0, 14, 0, Math.PI * 2);
      c.fill();

      // Boss HP Bar above
      c.restore();
      c.save();
      const barW = 120;
      const barH = 8;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(this.x - barW / 2, this.y - this.radius - 24, barW, barH);
      c.fillStyle = '#ff007f';
      c.fillRect(this.x - barW / 2, this.y - this.radius - 24, barW * (this.hp / this.maxHp), barH);
      c.strokeStyle = '#00f3ff';
      c.lineWidth = 1;
      c.strokeRect(this.x - barW / 2, this.y - this.radius - 24, barW, barH);
      c.restore();
    }
  }

  // --- START & SPAWN WAVE LOGIC ---
  function startGame() {
    sound.init();
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.wave = 1;
    state.combo = 1;
    state.comboTimer = 0;
    state.deflectedCount = 0;
    state.bulletTimeGauge = 100;
    state.isBulletTime = false;
    state.cameraShake = 0;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.hp = 100;
    player.isSwinging = false;
    player.isDashing = false;
    player.ghosts = [];

    bullets = [];
    enemies = [];
    particles = [];
    floatingTexts = [];
    boss = null;
    waveTimer = 0;
    waveEnemiesSpawned = 0;
    waveEnemiesTotal = 6;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('help-modal').classList.add('hidden');
    document.getElementById('bullet-time-vignette').classList.remove('active');
    updateHUD();
  }

  function spawnWave() {
    waveEnemiesSpawned = 0;
    waveEnemiesTotal = 5 + state.wave * 3;
    document.getElementById('wave-badge').textContent = `WAVE ${state.wave}`;

    // Boss Wave check
    if (state.wave % 5 === 0) {
      sound.playBossAlert();
      const banner = document.getElementById('boss-banner');
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 2800);
      boss = new CyberSentinel(canvas.width / 2, -50);
    }
  }

  function gameOver() {
    state.running = false;
    sound.playHit();
    if (state.score > bestScore) {
      bestScore = state.score;
      localStorage.setItem(STORAGE_KEY, bestScore);
    }

    document.getElementById('final-score').textContent = state.score;
    document.getElementById('final-wave').textContent = state.wave;
    document.getElementById('final-deflected').textContent = state.deflectedCount;
    document.getElementById('final-combo').textContent = `${state.combo}x`;
    document.getElementById('best-val').textContent = bestScore;
    document.getElementById('gameover-screen').classList.remove('hidden');
  }

  function updateHUD() {
    document.getElementById('score-val').textContent = state.score;
    document.getElementById('best-val').textContent = bestScore;
    document.getElementById('hp-bar').style.width = `${Math.max(0, player.hp)}%`;
    document.getElementById('hp-text').textContent = `${Math.max(0, Math.round(player.hp))} / 100`;
    document.getElementById('combo-badge').textContent = `${state.combo}x COMBO`;
  }

  // --- MAIN LOOP ---
  let lastTime = performance.now();

  function gameLoop(now) {
    const rawDt = Math.min((now - lastTime) / 16.666, 2.5);
    lastTime = now;

    if (state.running && !state.paused) {
      const dt = rawDt * state.timeScale;
      update(dt);
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    // Bullet time depletion & recovery
    if (state.isBulletTime) {
      state.bulletTimeGauge -= 0.65 * dt;
      if (state.bulletTimeGauge <= 0) toggleBulletTime();
    } else if (state.bulletTimeGauge < 100) {
      state.bulletTimeGauge += 0.15 * dt;
    }

    // Camera shake decay
    if (state.cameraShake > 0) state.cameraShake -= 0.8 * dt;

    // Combo timer decay
    if (state.combo > 1) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 1;
        updateHUD();
      }
    }

    // Player Aim Angle
    player.angle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);

    // Player Movement
    if (player.isDashing) {
      player.x += player.dashVx * dt;
      player.y += player.dashVy * dt;
      player.dashFrames -= dt;

      // Ghost trail
      player.ghosts.push({ x: player.x, y: player.y, angle: player.angle, alpha: 0.8 });
      if (player.dashFrames <= 0) player.isDashing = false;
    } else {
      let mx = 0, my = 0;
      if (keys.w || keys.ArrowUp) my -= 1;
      if (keys.s || keys.ArrowDown) my += 1;
      if (keys.a || keys.ArrowLeft) mx -= 1;
      if (keys.d || keys.ArrowRight) mx += 1;

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        player.x += (mx / len) * player.speed * dt;
        player.y += (my / len) * player.speed * dt;
      }
    }

    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    // Keep player in bounds
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius + 60, Math.min(canvas.height - player.radius, player.y));

    // Update Ghost Trails
    player.ghosts = player.ghosts.filter(g => {
      g.alpha -= 0.08 * dt;
      return g.alpha > 0;
    });

    // Katana Swing Animation & Blade Collision
    if (player.isSwinging) {
      player.swingProgress += dt;
      const progress = player.swingProgress / player.swingDuration;

      // Arc calculation
      const startAngle = player.angle - (player.bladeArc / 2) * player.swingDir;
      const currentBladeAngle = startAngle + (player.bladeArc * progress) * player.swingDir;
      const tipX = player.x + Math.cos(currentBladeAngle) * player.bladeLength;
      const tipY = player.y + Math.sin(currentBladeAngle) * player.bladeLength;

      player.trail.push({ x: tipX, y: tipY, alpha: 1.0 });

      // Check blade intersection with incoming enemy bullets
      bullets.forEach(b => {
        if (!b.isPlayer) {
          const dToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
          if (dToPlayer <= player.bladeLength + b.radius) {
            const bAngle = Math.atan2(b.y - player.y, b.x - player.x);
            let diff = Math.abs(bAngle - currentBladeAngle);
            while (diff > Math.PI) diff = Math.PI * 2 - diff;

            if (diff < 0.6) {
              // DEFLECTED!
              b.isPlayer = true;
              const defAngle = player.angle + (Math.random() - 0.5) * 0.2;
              b.vx = Math.cos(defAngle) * b.speed * 1.8;
              b.vy = Math.sin(defAngle) * b.speed * 1.8;
              b.color = '#00f3ff';

              state.deflectedCount++;
              state.combo = Math.min(8, state.combo + 1);
              state.comboTimer = 140;
              const pts = 100 * state.combo;
              state.score += pts;
              state.cameraShake = 5;

              sound.playDeflect();
              if (state.combo >= 4) sound.playCombo();

              floatingTexts.push(new FloatingText(`+${pts} (${state.combo}x)`, b.x, b.y, '#00f3ff'));

              for (let i = 0; i < 12; i++) {
                particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, '#00f3ff', 20));
              }
              updateHUD();
            }
          }
        }
      });

      if (player.swingProgress >= player.swingDuration) {
        player.isSwinging = false;
      }
    }

    // Blade trail decay
    player.trail = player.trail.filter(t => {
      t.alpha -= 0.15 * dt;
      return t.alpha > 0;
    });

    // Wave Spawning
    waveTimer += dt;
    if (waveEnemiesSpawned < waveEnemiesTotal && waveTimer >= 55) {
      waveTimer = 0;
      waveEnemiesSpawned++;
      const edge = Math.floor(Math.random() * 4);
      let sx, sy;
      if (edge === 0) { sx = Math.random() * canvas.width; sy = 60; }
      else if (edge === 1) { sx = canvas.width + 20; sy = Math.random() * canvas.height; }
      else if (edge === 2) { sx = Math.random() * canvas.width; sy = canvas.height + 20; }
      else { sx = -20; sy = Math.random() * canvas.height; }

      const type = Math.random() > 0.65 ? 'turret' : 'drone';
      enemies.push(new Drone(sx, sy, type));
    }

    // Update Enemies
    enemies.forEach(e => e.update(dt));

    // Update Boss
    if (boss) {
      boss.update(dt);
      if (boss.hp <= 0) {
        state.score += 2500 * state.combo;
        sound.playCombo();
        floatingTexts.push(new FloatingText(`SENTINEL DESTROYED! +${2500 * state.combo}`, boss.x, boss.y, '#ffe600'));
        for (let i = 0; i < 40; i++) {
          particles.push(new Particle(boss.x, boss.y, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, '#ff007f', 45, 5));
        }
        boss = null;
        updateHUD();
      }
    }

    // Next Wave Check
    if (waveEnemiesSpawned >= waveEnemiesTotal && enemies.length === 0 && !boss) {
      state.wave++;
      state.score += 500;
      spawnWave();
      updateHUD();
    }

    // Update Bullets
    bullets = bullets.filter(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Particle sparks behind deflected bullets
      if (b.isPlayer && Math.random() > 0.4) {
        particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, b.color, 12, 2));
      }

      // Check collision with Player (if enemy bullet)
      if (!b.isPlayer && !player.isDashing) {
        const d = Math.hypot(b.x - player.x, b.y - player.y);
        if (d < player.radius + b.radius) {
          player.hp -= 15;
          state.cameraShake = 12;
          sound.playHit();
          floatingTexts.push(new FloatingText('-15 HP', player.x, player.y - 15, '#ff0055'));
          updateHUD();
          if (player.hp <= 0) gameOver();
          return false;
        }
      }

      // Check collision with Enemies (if deflected by Player)
      if (b.isPlayer) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
            e.hp -= 2;
            sound.playHit();
            if (e.hp <= 0) {
              const pts = 250 * state.combo;
              state.score += pts;
              floatingTexts.push(new FloatingText(`+${pts}`, e.x, e.y, '#ffe600'));
              for (let p = 0; p < 18; p++) {
                particles.push(new Particle(e.x, e.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, e.color, 25));
              }
              enemies.splice(i, 1);
              updateHUD();
            }
            return false;
          }
        }

        // Check collision with Boss
        if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < boss.radius + b.radius) {
          boss.hp -= 2.5;
          state.cameraShake = 4;
          sound.playHit();
          return false;
        }
      }

      return b.x >= -50 && b.x <= canvas.width + 50 && b.y >= -50 && b.y <= canvas.height + 50;
    });

    // Update Particles & Texts
    particles = particles.filter(p => p.update(dt));
    floatingTexts = floatingTexts.filter(t => t.update(dt));
  }

  // --- RENDER ---
  function render() {
    ctx.save();
    // Screen shake
    if (state.cameraShake > 0) {
      const sx = (Math.random() - 0.5) * state.cameraShake;
      const sy = (Math.random() - 0.5) * state.cameraShake;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Cyber Grid
    drawGrid();

    // Draw Ghosts
    player.ghosts.forEach(g => {
      ctx.save();
      ctx.globalAlpha = g.alpha * 0.45;
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(g.x, g.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Blade Trail
    if (player.trail.length > 1) {
      ctx.save();
      for (let i = 0; i < player.trail.length - 1; i++) {
        const p1 = player.trail[i];
        const p2 = player.trail[i + 1];
        ctx.strokeStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 18;
        ctx.lineWidth = 6 * p1.alpha;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Enemies
    enemies.forEach(e => e.draw(ctx));

    // Draw Boss
    if (boss) boss.draw(ctx);

    // Draw Bullets
    bullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.isPlayer ? 16 : 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Player Ninja
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Ninja Body
    ctx.fillStyle = player.isDashing ? '#ff007f' : '#00f3ff';
    ctx.shadowColor = player.isDashing ? '#ff007f' : '#00f3ff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.radius * 0.3, -4, 6, 8);

    // Katana (when not swinging, drawn sheathed at side)
    if (!player.isSwinging) {
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(player.bladeLength * 0.75, 0);
      ctx.stroke();
    }

    ctx.restore();

    // Draw Active Blade Slice
    if (player.isSwinging) {
      ctx.save();
      const progress = player.swingProgress / player.swingDuration;
      const startAngle = player.angle - (player.bladeArc / 2) * player.swingDir;
      const currentAngle = startAngle + (player.bladeArc * progress) * player.swingDir;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(
        player.x + Math.cos(currentAngle) * player.bladeLength,
        player.y + Math.sin(currentAngle) * player.bladeLength
      );
      ctx.stroke();
      ctx.restore();
    }

    // Particles & Floating Text
    particles.forEach(p => p.draw(ctx));
    floatingTexts.forEach(t => t.draw(ctx));

    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    ctx.lineWidth = 1;
    const step = 45;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Start animation loop
  requestAnimationFrame(gameLoop);
})();
