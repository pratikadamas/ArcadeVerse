/* Orbital Gravity Lasso - game.js */
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
    tether() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    }
    slingshot() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      } catch (e) {}
    }
    lost() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statScoreEl = document.getElementById('statScore');
  const statDistanceEl = document.getElementById('statDistance');
  const statMultiplierEl = document.getElementById('statMultiplier');
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
  const btnTether = document.getElementById('btnTether');

  const finalDistanceEl = document.getElementById('finalDistance');
  const finalScoreEl = document.getElementById('finalScore');
  const finalMultiEl = document.getElementById('finalMulti');

  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let score = 0;
  let distance = 0;
  let maxAltitude = 0;
  let multiplier = 1.0;
  let maxMultiplier = 1.0;
  let highDistance = 0;
  try {
    highDistance = parseInt(localStorage.getItem('orbital_lasso_high') || '0', 10);
  } catch (_) {
    highDistance = 0;
  }
  statHighEl.textContent = `${highDistance}m`;

  const probe = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    radius: 7,
    vx: 0,
    vy: -6,
    tetheredBeacon: null,
    tetherAngle: 0,
    tetherRadius: 0,
    angularSpeed: 0,
    trail: []
  };

  let isTetherRequested = false;
  let beacons = [];
  let stars = [];
  let cameraY = 0;

  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3
    });
  }

  function spawnBeacons(startY, count = 8) {
    for (let i = 0; i < count; i++) {
      const beaconY = startY - i * 160 - Math.random() * 40;
      beacons.push({
        x: 80 + Math.random() * (canvas.width - 160),
        y: beaconY,
        radius: 14,
        pulse: Math.random() * Math.PI,
        color: '#00f0ff'
      });
    }
  }

  function resetGame() {
    score = 0;
    distance = 0;
    maxAltitude = 0;
    multiplier = 1.0;
    maxMultiplier = 1.0;
    cameraY = 0;

    probe.x = canvas.width / 2;
    probe.y = canvas.height - 120;
    probe.vx = 2.5;
    probe.vy = -6;
    probe.tetheredBeacon = null;
    probe.trail = [];

    beacons = [];
    beacons.push({
      x: canvas.width / 2,
      y: canvas.height - 240,
      radius: 14,
      pulse: 0,
      color: '#00f0ff'
    });
    spawnBeacons(canvas.height - 400, 10);

    updateStats();
  }

  function updateStats() {
    statScoreEl.textContent = score;
    statDistanceEl.textContent = `${distance}m`;
    statMultiplierEl.textContent = `${multiplier.toFixed(1)}x`;
  }

  function update() {
    if (!isRunning || isPaused) return;

    if (isTetherRequested && !probe.tetheredBeacon) {
      let nearest = null;
      let minDist = 220;
      for (const b of beacons) {
        const d = Math.hypot(b.x - probe.x, b.y - probe.y);
        if (d < minDist) {
          minDist = d;
          nearest = b;
        }
      }
      if (nearest) {
        probe.tetheredBeacon = nearest;
        probe.tetherRadius = Math.max(18, minDist);
        probe.tetherAngle = Math.atan2(probe.y - nearest.y, probe.x - nearest.x);
        const cross = (probe.x - nearest.x) * probe.vy - (probe.y - nearest.y) * probe.vx;
        const dir = cross > 0 ? 1 : -1;
        const currentSpeed = Math.hypot(probe.vx, probe.vy);
        probe.angularSpeed = dir * Math.max(0.04, Math.min(0.12, currentSpeed / probe.tetherRadius));
        sfx.tether();
      }
    } else if (!isTetherRequested && probe.tetheredBeacon) {
      const b = probe.tetheredBeacon;
      const speed = Math.abs(probe.angularSpeed) * probe.tetherRadius;
      const launchAngle = probe.tetherAngle + (probe.angularSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
      probe.vx = Math.cos(launchAngle) * speed * 1.15;
      probe.vy = Math.sin(launchAngle) * speed * 1.15;
      probe.tetheredBeacon = null;
      multiplier = Math.min(5.0, multiplier + 0.2);
      if (multiplier > maxMultiplier) maxMultiplier = multiplier;
      score += Math.round(50 * multiplier);
      sfx.slingshot();
    }

    if (probe.tetheredBeacon) {
      const b = probe.tetheredBeacon;
      probe.angularSpeed *= 1.008;
      probe.tetherAngle += probe.angularSpeed;
      probe.x = b.x + Math.cos(probe.tetherAngle) * probe.tetherRadius;
      probe.y = b.y + Math.sin(probe.tetherAngle) * probe.tetherRadius;
    } else {
      probe.vy += 0.12; // Gravity
      probe.x += probe.vx;
      probe.y += probe.vy;
      multiplier = Math.max(1.0, multiplier - 0.003);
    }

    probe.trail.push({ x: probe.x, y: probe.y });
    if (probe.trail.length > 14) probe.trail.shift();

    const currentAltitude = Math.max(0, Math.round((canvas.height - 120 - probe.y) / 5));
    if (currentAltitude > maxAltitude) {
      const gained = currentAltitude - maxAltitude;
      distance = currentAltitude;
      maxAltitude = currentAltitude;
      score += Math.round(gained * multiplier);
    }

    const targetCamY = probe.y - canvas.height * 0.6;
    if (targetCamY < cameraY) {
      cameraY += (targetCamY - cameraY) * 0.1;
    }

    const highestBeaconY = beacons.reduce((min, b) => Math.min(min, b.y), canvas.height);
    if (highestBeaconY > cameraY - 400) {
      spawnBeacons(highestBeaconY - 60, 6);
    }

    beacons = beacons.filter(b => b.y < cameraY + canvas.height + 150);

    for (const b of beacons) {
      b.pulse += 0.05;
    }

    if (probe.x < 10 || probe.x > canvas.width - 10) {
      probe.vx = -probe.vx * 0.7;
      probe.x = Math.max(10, Math.min(canvas.width - 10, probe.x));
    }

    if (probe.y > cameraY + canvas.height + 60) {
      endGame();
    }

    updateStats();
  }

  function endGame() {
    isRunning = false;
    sfx.lost();
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    if (distance > highDistance) {
      highDistance = distance;
      try {
        localStorage.setItem('orbital_lasso_high', highDistance.toString());
      } catch (_) {}
      statHighEl.textContent = `${highDistance}m`;
    }

    finalDistanceEl.textContent = `${distance}m`;
    finalScoreEl.textContent = score;
    finalMultiEl.textContent = `${maxMultiplier.toFixed(1)}x`;

    gameOverScreen.classList.remove('hidden');

    try {
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: score }, '*');
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER' }, '*');
    } catch (_) {}
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const s of stars) {
      const starY = (s.y - cameraY * 0.3) % canvas.height;
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, (starY + canvas.height) % canvas.height, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(0, -cameraY);

    for (const b of beacons) {
      ctx.save();
      const glow = Math.sin(b.pulse) * 4 + 10;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0284c7';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (probe.tetheredBeacon) {
      const b = probe.tetheredBeacon;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(probe.x, probe.y);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < probe.trail.length; i++) {
      const p = probe.trail[i];
      const a = (i + 1) / (probe.trail.length * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, probe.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(probe.x, probe.y, probe.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') {
      isTetherRequested = true;
      e.preventDefault();
    }
    if (e.key === 'p' || e.key === 'P') togglePause();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') {
      isTetherRequested = false;
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sfx.init();
    isTetherRequested = true;
  });

  window.addEventListener('mouseup', () => {
    isTetherRequested = false;
  });

  function bindTetherTouch(btn) {
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      sfx.init();
      isTetherRequested = true;
    };
    const end = (e) => {
      e.preventDefault();
      isTetherRequested = false;
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }

  bindTetherTouch(btnTether);

  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnResume.addEventListener('click', togglePause);
  btnPause.addEventListener('click', togglePause);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning && !isPaused) {
      togglePause();
    }
  });

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const type = e.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      if (isRunning && !isPaused) togglePause();
    } else if (type === 'ARCADEVERSE_RESUME') {
      if (isPaused) togglePause();
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    } else if (type === 'AV_RESIZE') {
      const d = e.data;
      if (d.width && d.height && canvas) {
        canvas.width = d.width;
        canvas.height = d.height;
      }
    }
  });
})();
