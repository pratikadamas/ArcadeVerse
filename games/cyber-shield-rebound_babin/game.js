/* Cyber Shield Rebound - game.js */
(function() {
  'use strict';

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
    rebound() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    }
    destroy() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      } catch (e) {}
    }
    coreHit() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statScoreEl = document.getElementById('statScore');
  const statWaveEl = document.getElementById('statWave');
  const statShieldEl = document.getElementById('statShield');
  const statDronesEl = document.getElementById('statDrones');

  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  const btnShieldLeft = document.getElementById('btnShieldLeft');
  const btnShieldRight = document.getElementById('btnShieldRight');

  const finalWaveEl = document.getElementById('finalWave');
  const finalDronesEl = document.getElementById('finalDrones');
  const finalScoreEl = document.getElementById('finalScore');

  let isRunning = false;
  let isPaused = false;
  let animId = null;
  let lastTime = performance.now();

  let score = 0;
  let wave = 1;
  let shieldHp = 100;
  let dronesKilled = 0;

  const core = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 30
  };

  const shield = {
    radius: 65,
    angle: 0,
    arcLength: Math.PI / 3 // 60 degrees arc
  };

  const keys = { left: false, right: false };

  let bullets = [];
  let drones = [];
  let particles = [];
  let spawnCooldown = 0;

  function resetGame() {
    score = 0;
    wave = 1;
    shieldHp = 100;
    dronesKilled = 0;
    shield.angle = 0;
    bullets = [];
    drones = [];
    particles = [];
    spawnCooldown = 0;
    updateUI();
  }

  function updateUI() {
    statScoreEl.textContent = score;
    statWaveEl.textContent = wave;
    statShieldEl.textContent = `${shieldHp}%`;
    statDronesEl.textContent = dronesKilled;
  }

  function spawnDrone() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 260;
    drones.push({
      x: core.x + Math.cos(angle) * dist,
      y: core.y + Math.sin(angle) * dist,
      angle: angle,
      radius: 12,
      shootTimer: Math.random() * 60 + 30
    });
  }

  function update(deltaMs = 16.67) {
    if (!isRunning || isPaused) return;
    const dtScale = Math.min(2.0, Math.max(0.2, deltaMs / 16.667));

    if (keys.left) shield.angle -= 0.08 * dtScale;
    if (keys.right) shield.angle += 0.08 * dtScale;

    spawnCooldown += dtScale;
    if (spawnCooldown > Math.max(40, 100 - wave * 8)) {
      if (drones.length < 5 + wave) {
        spawnDrone();
      }
      spawnCooldown = 0;
    }

    // Update drones
    for (const d of drones) {
      d.shootTimer -= dtScale;
      if (d.shootTimer <= 0) {
        // Fire bullet toward core
        const bulletAngle = Math.atan2(core.y - d.y, core.x - d.x);
        bullets.push({
          x: d.x,
          y: d.y,
          vx: Math.cos(bulletAngle) * 3,
          vy: Math.sin(bulletAngle) * 3,
          isRebounded: false,
          radius: 5
        });
        d.shootTimer = Math.random() * 80 + 60;
      }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const prevX = b.x;
      const prevY = b.y;
      const prevDist = Math.hypot(prevX - core.x, prevY - core.y);

      b.x += b.vx * dtScale;
      b.y += b.vy * dtScale;

      const currDist = Math.hypot(b.x - core.x, b.y - core.y);

      // Swept radial crossing check with shield arc
      const pad = 10 * Math.max(1, dtScale);
      const crossedShield = (!b.isRebounded) && (
        (prevDist >= shield.radius - pad && currDist <= shield.radius + pad) ||
        (currDist >= shield.radius - pad && prevDist <= shield.radius + pad) ||
        Math.abs(currDist - shield.radius) < pad
      );

      if (crossedShield) {
        const bulletAngle = Math.atan2(b.y - core.y, b.x - core.x);
        let diff = Math.abs(bulletAngle - shield.angle);
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

        if (Math.abs(diff) < shield.arcLength / 2) {
          // Rebound back outward
          b.isRebounded = true;
          b.vx = -b.vx * 1.5;
          b.vy = -b.vy * 1.5;
          sfx.rebound();
          score += 25;
          continue;
        }
      }

      // Hit Central Core
      if (!b.isRebounded && currDist < core.radius) {
        shieldHp -= 10;
        sfx.coreHit();
        bullets.splice(i, 1);
        if (shieldHp <= 0) {
          shieldHp = 0;
          updateUI();
          endGame();
          return;
        }
        updateUI();
        continue;
      }

      // Rebounded bullet hitting enemy drones
      if (b.isRebounded) {
        for (let j = drones.length - 1; j >= 0; j--) {
          const d = drones[j];
          if (Math.hypot(b.x - d.x, b.y - d.y) < d.radius + b.radius) {
            drones.splice(j, 1);
            bullets.splice(i, 1);
            dronesKilled++;
            score += 100;
            sfx.destroy();
            if (dronesKilled % 8 === 0) {
              wave++;
            }
            updateUI();
            break;
          }
        }
      }

      if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
        bullets.splice(i, 1);
      }
    }
  }

  function endGame() {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_SCORE',
        score: score,
        wave: wave,
        dronesKilled: dronesKilled
      }, '*');
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_OVER',
        score: score,
        wave: wave,
        dronesKilled: dronesKilled
      }, '*');
    }

    finalWaveEl.textContent = wave;
    finalDronesEl.textContent = dronesKilled;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Radar Rings
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    [120, 180, 240].forEach(r => {
      ctx.beginPath();
      ctx.arc(core.x, core.y, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Central Core
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shield Arc
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(core.x, core.y, shield.radius, shield.angle - shield.arcLength / 2, shield.angle + shield.arcLength / 2);
    ctx.stroke();
    ctx.restore();

    // Drones
    for (const d of drones) {
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    for (const b of bullets) {
      ctx.save();
      ctx.fillStyle = b.isRebounded ? '#00f0ff' : '#f97316';
      ctx.shadowColor = b.isRebounded ? '#38bdf8' : '#fb923c';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function loop(now = performance.now()) {
    const deltaMs = Math.min(64, now - lastTime);
    lastTime = now;

    update(deltaMs);
    render();
    if (isRunning) {
      animId = requestAnimationFrame(loop);
    }
  }

  function startGame() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    sfx.init();
    resetGame();
    isRunning = true;
    isPaused = false;
    lastTime = performance.now();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    animId = requestAnimationFrame(loop);
  }

  canvas.addEventListener('mousemove', (e) => {
    if (!isRunning || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    shield.angle = Math.atan2(mouseY - core.y, mouseX - core.x);
  });

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  function bindTouch(btn, prop) {
    if (!btn) return;
    const start = (e) => { e.preventDefault(); sfx.init(); keys[prop] = true; };
    const end = (e) => { e.preventDefault(); keys[prop] = false; };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }

  bindTouch(btnShieldLeft, 'left');
  bindTouch(btnShieldRight, 'right');

  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });

  // Modal lifecycle hooks
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isPaused = true;
    } else {
      lastTime = performance.now();
    }
  });

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'ARCADEVERSE_PAUSE') {
      isPaused = true;
    } else if (e.data.type === 'ARCADEVERSE_RESUME') {
      isPaused = false;
      lastTime = performance.now();
    } else if (e.data.type === 'ARCADEVERSE_TEARDOWN') {
      isRunning = false;
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }
  });

  window.addEventListener('pagehide', () => {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  });
})();
