/**
 * Gravity Well: Singularity Slingshot
 * Author: Babin Bid (@Babin123456)
 * ArcadeVerse HTML5 Canvas Game
 */
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreVal = document.getElementById('scoreVal');
  const levelVal = document.getElementById('levelVal');
  const overlayScreen = document.getElementById('overlayScreen');
  const overlayHeading = document.getElementById('overlayHeading');
  const overlayDesc = document.getElementById('overlayDesc');
  const btnActionStart = document.getElementById('btnActionStart');

  const tLeft = document.getElementById('tLeft');
  const tRight = document.getElementById('tRight');
  const tAction = document.getElementById('tAction');

  let animationId = null;
  let isPlaying = false;
  let score = 0;
  let level = 1;
  let orbsLeft = 10;

  // Web Audio Synth
  let audioCtx = null;
  function playBeep(freq, type, duration) {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // Black Hole Singularities
  let singularities = [
    { x: 300, y: 300, mass: 1400, radius: 24 },
    { x: 550, y: 220, mass: 1800, radius: 30 }
  ];

  // Goals / Targets
  let targets = [];
  let probe = null;
  let aimAngle = -Math.PI / 4;
  let aimPower = 10;
  let particles = [];

  function spawnLevel(lvl) {
    targets = [];
    singularities = [];

    if (lvl === 1) {
      singularities.push({ x: 400, y: 300, mass: 1600, radius: 26 });
      targets.push({ x: 650, y: 150, radius: 22, collected: false });
      targets.push({ x: 650, y: 450, radius: 22, collected: false });
    } else if (lvl === 2) {
      singularities.push({ x: 320, y: 250, mass: 1500, radius: 25 });
      singularities.push({ x: 520, y: 380, mass: 1700, radius: 28 });
      targets.push({ x: 680, y: 200, radius: 20, collected: false });
      targets.push({ x: 420, y: 500, radius: 20, collected: false });
      targets.push({ x: 700, y: 480, radius: 20, collected: false });
    } else {
      singularities.push({ x: 300, y: 200, mass: 1600, radius: 25 });
      singularities.push({ x: 500, y: 400, mass: 2000, radius: 32 });
      singularities.push({ x: 350, y: 480, mass: 1400, radius: 22 });
      targets.push({ x: 720, y: 120, radius: 18, collected: false });
      targets.push({ x: 620, y: 280, radius: 18, collected: false });
      targets.push({ x: 720, y: 520, radius: 18, collected: false });
    }
  }

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') aimAngle -= 0.05;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') aimAngle += 0.05;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') aimPower = Math.max(5, aimPower - 0.5);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') aimPower = Math.min(18, aimPower + 0.5);
      if (e.code === 'Space') {
        e.preventDefault();
        launchProbe();
      }
    });

    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); aimAngle -= 0.08; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); aimAngle += 0.08; });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); launchProbe(); });

    btnActionStart.addEventListener('click', startGame);
  }

  function launchProbe() {
    if (!isPlaying || probe) return;
    if (orbsLeft <= 0) {
      gameOver();
      return;
    }

    orbsLeft--;
    probe = {
      x: 100,
      y: 450,
      vx: Math.cos(aimAngle) * aimPower,
      vy: Math.sin(aimAngle) * aimPower,
      radius: 6,
      trail: []
    };
    playBeep(520, 'triangle', 0.15);
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    level = 1;
    orbsLeft = 8;
    probe = null;
    particles = [];
    spawnLevel(1);
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    overlayHeading.textContent = 'PROBES EXHAUSTED';
    overlayDesc.textContent = 'All gravitational probes were lost in event horizons! Final Resonance Score: ' + score;
    btnActionStart.textContent = 'LAUNCH NEW EXPEDITION';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = orbsLeft + ' Left';
  }

  function update() {
    if (!isPlaying) return;

    if (probe) {
      probe.trail.push({ x: probe.x, y: probe.y });
      if (probe.trail.length > 35) probe.trail.shift();

      // Gravitational physics toward all singularities
      for (const s of singularities) {
        const dx = s.x - probe.x;
        const dy = s.y - probe.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < s.radius) {
          // Swallowed by black hole
          playBeep(90, 'sawtooth', 0.3);
          for (let p = 0; p < 16; p++) {
            particles.push({
              x: probe.x,
              y: probe.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              color: '#8b5cf6',
              alpha: 1
            });
          }
          probe = null;
          if (orbsLeft <= 0) gameOver();
          return;
        }

        const force = s.mass / Math.max(300, distSq);
        probe.vx += (dx / dist) * force;
        probe.vy += (dy / dist) * force;
      }

      probe.x += probe.vx;
      probe.y += probe.vy;

      // Bounds check
      if (probe.x < 0 || probe.x > 800 || probe.y < 0 || probe.y > 600) {
        probe = null;
        if (orbsLeft <= 0) gameOver();
        return;
      }

      // Check Targets collection
      for (const t of targets) {
        if (!t.collected && Math.hypot(probe.x - t.x, probe.y - t.y) < probe.radius + t.radius) {
          t.collected = true;
          score += 250;
          playBeep(880, 'sine', 0.2);

          for (let p = 0; p < 14; p++) {
            particles.push({
              x: t.x,
              y: t.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: '#00f5ff',
              alpha: 1
            });
          }
        }
      }

      // Next level check
      if (targets.every(t => t.collected)) {
        score += 500;
        level++;
        orbsLeft += 5;
        probe = null;
        playBeep(1200, 'triangle', 0.35);
        spawnLevel(level);
      }
    }

    // Particles
    for (let p = particles.length - 1; p >= 0; p--) {
      const pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.03;
      if (pt.alpha <= 0) particles.splice(p, 1);
    }

    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Singularities (Black Holes)
    for (const s of singularities) {
      const g = ctx.createRadialGradient(s.x, s.y, 5, s.x, s.y, s.radius * 2);
      g.addColorStop(0, '#000000');
      g.addColorStop(0.5, '#4c1d95');
      g.addColorStop(1, 'rgba(76, 29, 149, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Accretion Disk
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#050308';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Targets (Energy Beacons)
    for (const t of targets) {
      if (t.collected) continue;
      ctx.fillStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Slingshot Cannon
    const cannonX = 100;
    const cannonY = 450;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cannonX, cannonY);
    ctx.lineTo(cannonX + Math.cos(aimAngle) * (aimPower * 4), cannonY + Math.sin(aimAngle) * (aimPower * 4));
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cannonX, cannonY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Active Probe & Trail
    if (probe) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < probe.trail.length; i++) {
        const pt = probe.trail[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(probe.x, probe.y, probe.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Particles
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  function gameLoop() {
    if (!isPlaying) return;
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  // Lifecycle Bridge
  if (window.ArcadeVerse) {
    ArcadeVerse.onPause(() => { isPlaying = false; });
    ArcadeVerse.onResume(() => { if (overlayScreen.classList.contains('hidden')) { isPlaying = true; gameLoop(); } });
    ArcadeVerse.onTeardown(() => {
      isPlaying = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) audioCtx.close().catch(() => {});
    });
  }

  initInputs();
})();
