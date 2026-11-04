/* Astro Defense Turret - game.js */
(function() {
  'use strict';

  // Sound Engine
  class SoundFX {
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
    laser() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) {}
    }
    boom() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
      } catch (e) {}
    }
    shieldHit() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      } catch (e) {}
    }
    gameOver() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.6);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  // Canvas
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const statScoreEl = document.getElementById('statScore');
  const statWaveEl = document.getElementById('statWave');
  const statShieldEl = document.getElementById('statShield');
  const statHighEl = document.getElementById('statHigh');

  const startScreen = document.getElementById('startScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnResume = document.getElementById('btnResume');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  const finalScoreEl = document.getElementById('finalScore');
  const finalWaveEl = document.getElementById('finalWave');
  const finalKillsEl = document.getElementById('finalKills');

  // Virtual buttons
  const btnRotateLeft = document.getElementById('btnRotateLeft');
  const btnRotateRight = document.getElementById('btnRotateRight');
  const btnFire = document.getElementById('btnFire');

  // State
  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let score = 0;
  let wave = 1;
  let shieldHp = 100;
  let kills = 0;
  let highScore = parseInt(localStorage.getItem('astro_turret_highscore') || '0', 10);
  statHighEl.textContent = highScore;

  // Turret Center Hub
  const hub = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 36,
    angle: 0,
    barrelLen: 34
  };

  // Bullets & Drones & FX
  let bullets = [];
  let enemies = [];
  let particles = [];
  let stars = [];

  let fireCooldown = 0;
  let spawnTimer = 0;

  // Controls
  const keys = {
    left: false,
    right: false,
    fire: false
  };

  // Generate starfield
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3
    });
  }

  function resetGame() {
    score = 0;
    wave = 1;
    shieldHp = 100;
    kills = 0;
    bullets = [];
    enemies = [];
    particles = [];
    hub.angle = 0;
    fireCooldown = 0;
    spawnTimer = 0;

    statScoreEl.textContent = '0';
    statWaveEl.textContent = '1';
    statShieldEl.textContent = '100%';
  }

  function shootLaser() {
    if (fireCooldown > 0) return;
    fireCooldown = 12; // Cooldown frames
    sfx.laser();

    const tipX = hub.x + Math.cos(hub.angle) * hub.barrelLen;
    const tipY = hub.y + Math.sin(hub.angle) * hub.barrelLen;
    const speed = 12;

    bullets.push({
      x: tipX,
      y: tipY,
      vx: Math.cos(hub.angle) * speed,
      vy: Math.sin(hub.angle) * speed,
      radius: 4,
      life: 60
    });
  }

  function spawnEnemy() {
    // Spawn outside boundary
    const spawnAngle = Math.random() * Math.PI * 2;
    const dist = 340;
    const spawnX = hub.x + Math.cos(spawnAngle) * dist;
    const spawnY = hub.y + Math.sin(spawnAngle) * dist;

    // Direct toward hub center
    const speed = 1.2 + Math.random() * 0.8 + (wave * 0.15);
    const angleToHub = Math.atan2(hub.y - spawnY, hub.x - spawnX);

    const type = Math.random() < 0.25 ? 'fast' : 'scout';

    enemies.push({
      x: spawnX,
      y: spawnY,
      vx: Math.cos(angleToHub) * (type === 'fast' ? speed * 1.6 : speed),
      vy: Math.sin(angleToHub) * (type === 'fast' ? speed * 1.6 : speed),
      radius: type === 'fast' ? 10 : 14,
      hp: type === 'fast' ? 1 : 2,
      type: type,
      color: type === 'fast' ? '#facc15' : '#ef4444'
    });
  }

  function createExplosion(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 1;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        radius: Math.random() * 3 + 1,
        color: color,
        life: 25,
        maxLife: 25
      });
    }
  }

  function update() {
    if (!isRunning || isPaused) return;

    // Turret rotation via keys
    const rotSpeed = 0.07;
    if (keys.left) hub.angle -= rotSpeed;
    if (keys.right) hub.angle += rotSpeed;
    if (keys.fire) shootLaser();

    if (fireCooldown > 0) fireCooldown--;

    // Spawn waves
    spawnTimer++;
    const interval = Math.max(35, 90 - wave * 6);
    if (spawnTimer > interval) {
      spawnEnemy();
      spawnTimer = 0;
    }

    // Bullets update
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      if (b.life <= 0 || b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
        bullets.splice(i, 1);
      }
    }

    // Enemies update
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x += e.vx;
      e.y += e.vy;

      // Check collision with bullets
      let hit = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        const dist = Math.hypot(e.x - b.x, e.y - b.y);
        if (dist < e.radius + b.radius) {
          bullets.splice(j, 1);
          e.hp--;
          hit = true;
          createExplosion(b.x, b.y, '#f97316', 6);
          if (e.hp <= 0) {
            sfx.boom();
            createExplosion(e.x, e.y, e.color, 16);
            score += e.type === 'fast' ? 150 : 100;
            kills++;
            enemies.splice(i, 1);
            if (kills % 10 === 0) {
              wave++;
              statWaveEl.textContent = wave;
            }
            statScoreEl.textContent = score;
          }
          break;
        }
      }

      if (hit) continue;

      // Check collision with hub shield
      const distToHub = Math.hypot(e.x - hub.x, e.y - hub.y);
      if (distToHub < hub.radius + e.radius) {
        shieldHp -= e.type === 'fast' ? 10 : 20;
        sfx.shieldHit();
        createExplosion(e.x, e.y, '#ef4444', 18);
        enemies.splice(i, 1);

        if (shieldHp <= 0) {
          shieldHp = 0;
          statShieldEl.textContent = '0%';
          endGame();
          return;
        }
        statShieldEl.textContent = `${shieldHp}%`;
      }
    }

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function endGame() {
    isRunning = false;
    sfx.gameOver();
    if (animId) cancelAnimationFrame(animId);

    if (score > highScore) {
      highScore = score;
      localStorage.setItem('astro_turret_highscore', highScore.toString());
      statHighEl.textContent = highScore;
    }

    finalScoreEl.textContent = score;
    finalWaveEl.textContent = wave;
    finalKillsEl.textContent = kills;

    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Starfield
    for (const s of stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Radar Range Rings
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.lineWidth = 1;
    [100, 180, 260].forEach(r => {
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Particles
    for (const p of particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Bullets
    for (const b of bullets) {
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Enemies
    for (const e of enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const angle = Math.atan2(e.vy, e.vx);
      ctx.rotate(angle);

      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 12;

      // Triangle drone
      ctx.beginPath();
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.7);
      ctx.lineTo(-e.radius * 0.5, 0);
      ctx.lineTo(-e.radius, e.radius * 0.7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Draw Shield Ring
    ctx.save();
    ctx.strokeStyle = `rgba(6, 182, 212, ${shieldHp / 100 * 0.7 + 0.2})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, hub.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw Turret Base Hub
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, hub.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Turret Rotating Cannon
    ctx.translate(hub.x, hub.y);
    ctx.rotate(hub.angle);

    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur = 8;
    ctx.fillRect(0, -5, hub.barrelLen, 10);

    // Cannon Core
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function loop() {
    update();
    render();
    if (isRunning) {
      animId = requestAnimationFrame(loop);
    }
  }

  function startGame() {
    sfx.init();
    resetGame();
    isRunning = true;
    isPaused = false;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    animId = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!isRunning) return;
    isPaused = !isPaused;
    if (isPaused) {
      pauseScreen.classList.remove('hidden');
    } else {
      pauseScreen.classList.add('hidden');
    }
  }

  // Mouse & Touch aiming on canvas
  canvas.addEventListener('mousemove', (e) => {
    if (!isRunning || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    hub.angle = Math.atan2(mouseY - hub.y, mouseX - hub.x);
  });

  canvas.addEventListener('mousedown', () => {
    sfx.init();
    if (isRunning && !isPaused) {
      shootLaser();
    }
  });

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    sfx.init();
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') {
      keys.left = true;
      e.preventDefault();
    }
    if (k === 'arrowright' || k === 'd') {
      keys.right = true;
      e.preventDefault();
    }
    if (k === ' ' || k === 'f') {
      keys.fire = true;
      e.preventDefault();
    }
    if (k === 'p') {
      togglePause();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    if (k === 'arrowright' || k === 'd') keys.right = false;
    if (k === ' ' || k === 'f') keys.fire = false;
  });

  // Touch virtual buttons
  function bindTouch(btn, prop) {
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      sfx.init();
      keys[prop] = true;
    };
    const end = (e) => {
      e.preventDefault();
      keys[prop] = false;
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
  }

  bindTouch(btnRotateLeft, 'left');
  bindTouch(btnRotateRight, 'right');
  bindTouch(btnFire, 'fire');

  // UI Event bindings
  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnResume.addEventListener('click', togglePause);
  btnPause.addEventListener('click', togglePause);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
  });
  btnCloseRules.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
  });

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });

})();
