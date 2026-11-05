/* Hyper Spin Blaster - game.js */
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
    laser() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (e) {}
    }
    hit() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    }
    playerHit() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
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
  const statLivesEl = document.getElementById('statLives');
  const statHitsEl = document.getElementById('statHits');

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

  const btnSpinLeft = document.getElementById('btnSpinLeft');
  const btnSpinRight = document.getElementById('btnSpinRight');
  const btnFire = document.getElementById('btnFire');

  const finalWaveEl = document.getElementById('finalWave');
  const finalHitsEl = document.getElementById('finalHits');
  const finalScoreEl = document.getElementById('finalScore');

  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let score = 0;
  let wave = 1;
  let lives = 3;
  let hits = 0;

  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  const trackRadius = 240;

  const cannon = {
    angle: 0,
    speed: 0.05
  };

  const keys = { left: false, right: false };

  let shots = [];
  let targets = [];
  let spawnTimer = 0;

  function resetGame() {
    score = 0;
    wave = 1;
    lives = 3;
    hits = 0;
    cannon.angle = 0;
    shots = [];
    targets = [];
    spawnTimer = 0;
    updateUI();
  }

  function updateUI() {
    statScoreEl.textContent = score;
    statWaveEl.textContent = wave;
    statLivesEl.textContent = lives;
    statHitsEl.textContent = hits;
  }

  function shoot() {
    if (!isRunning || isPaused) return;
    sfx.init();
    sfx.laser();

    const cannonX = center.x + Math.cos(cannon.angle) * trackRadius;
    const cannonY = center.y + Math.sin(cannon.angle) * trackRadius;

    // Fire inward toward center
    const speed = 10;
    shots.push({
      x: cannonX,
      y: cannonY,
      vx: -Math.cos(cannon.angle) * speed,
      vy: -Math.sin(cannon.angle) * speed,
      radius: 4
    });
  }

  function spawnTarget() {
    const angle = Math.random() * Math.PI * 2;
    targets.push({
      angle: angle,
      radius: 12,
      distFromCenter: 20,
      expandSpeed: 0.7 + wave * 0.15,
      hp: 1
    });
  }

  function update() {
    if (!isRunning || isPaused) return;

    if (keys.left) cannon.angle -= cannon.speed;
    if (keys.right) cannon.angle += cannon.speed;

    spawnTimer++;
    if (spawnTimer > Math.max(30, 80 - wave * 5)) {
      spawnTarget();
      spawnTimer = 0;
    }

    // Update shots
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx;
      s.y += s.vy;

      // Check collision with targets
      let hitTarget = false;
      for (let j = targets.length - 1; j >= 0; j--) {
        const t = targets[j];
        const tx = center.x + Math.cos(t.angle) * t.distFromCenter;
        const ty = center.y + Math.sin(t.angle) * t.distFromCenter;

        if (Math.hypot(s.x - tx, s.y - ty) < t.radius + s.radius) {
          targets.splice(j, 1);
          shots.splice(i, 1);
          hits++;
          score += 100 * wave;
          sfx.hit();
          if (hits % 10 === 0) {
            wave++;
          }
          updateUI();
          hitTarget = true;
          break;
        }
      }

      if (hitTarget) continue;

      if (Math.hypot(s.x - center.x, s.y - center.y) > trackRadius + 40) {
        shots.splice(i, 1);
      }
    }

    // Update targets expanding outward
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      t.distFromCenter += t.expandSpeed;

      if (t.distFromCenter >= trackRadius) {
        // Breached outer perimeter
        lives--;
        sfx.playerHit();
        targets.splice(i, 1);
        updateUI();

        if (lives <= 0) {
          endGame();
          return;
        }
      }
    }
  }

  function endGame() {
    isRunning = false;
    if (animId) cancelAnimationFrame(animId);

    finalWaveEl.textContent = wave;
    finalHitsEl.textContent = hits;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Orbital Track
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, trackRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Central Core Pulse
    ctx.save();
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Targets
    for (const t of targets) {
      const tx = center.x + Math.cos(t.angle) * t.distFromCenter;
      const ty = center.y + Math.sin(t.angle) * t.distFromCenter;

      ctx.save();
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(tx, ty, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Shots
    for (const s of shots) {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Cannon on Outer Ring
    const cx = center.x + Math.cos(cannon.angle) * trackRadius;
    const cy = center.y + Math.sin(cannon.angle) * trackRadius;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cannon.angle + Math.PI); // Facing inward

    ctx.fillStyle = '#fff1f2';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.fillRect(-6, -6, 12, 12);

    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(0, -3, 14, 6); // Barrel pointing toward center
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
    animId = requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') {
      shoot();
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  canvas.addEventListener('click', shoot);

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

  bindTouch(btnSpinLeft, 'left');
  bindTouch(btnSpinRight, 'right');
  btnFire.addEventListener('click', shoot);

  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });
})();
