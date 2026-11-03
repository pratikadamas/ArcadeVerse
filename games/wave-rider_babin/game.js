/**
 * Wave Rider: Frequency Pulse Surfer
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
  let distance = 0;
  let multiplier = 1;

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

  // Rider Wave State
  const rider = {
    x: 180,
    y: 300,
    vy: 0,
    freq: 0.02,
    targetFreq: 0.02,
    radius: 12
  };

  let orbs = [];
  let obstacles = [];
  let trail = [];
  let time = 0;

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') rider.targetFreq = 0.04;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') rider.targetFreq = 0.01;
      if (e.code === 'Space') {
        // Boost phase
        rider.y = 300 + Math.sin(time * 0.06) * 180;
        playBeep(700, 'triangle', 0.1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
        rider.targetFreq = 0.02;
      }
    });

    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); rider.targetFreq = 0.01; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); rider.targetFreq = 0.02; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); rider.targetFreq = 0.04; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); rider.targetFreq = 0.02; });
    tAction.addEventListener('touchstart', (e) => {
      e.preventDefault();
      rider.y = 300 + Math.sin(time * 0.06) * 180;
      playBeep(700, 'triangle', 0.1);
    });

    btnActionStart.addEventListener('click', startGame);
  }

  function spawnOrb() {
    orbs.push({
      x: 840,
      y: 120 + Math.random() * 360,
      radius: 10,
      collected: false
    });
  }

  function spawnObstacle() {
    obstacles.push({
      x: 840,
      y: 100 + Math.random() * 400,
      w: 18,
      h: 70
    });
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    distance = 0;
    multiplier = 1;
    rider.y = 300;
    orbs = [];
    obstacles = [];
    trail = [];
    time = 0;
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    playBeep(120, 'sawtooth', 0.35);
    overlayHeading.textContent = 'SIGNAL DAMPENED';
    overlayDesc.textContent = 'Harmonic wave disrupted! Distance Surfed: ' + Math.floor(distance) + 'm | Score: ' + score;
    btnActionStart.textContent = 'SURF AGAIN';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = Math.floor(distance) + 'm';
  }

  function update() {
    if (!isPlaying) return;

    time += 2;
    distance += 0.4;
    score += Math.round(multiplier);

    rider.freq += (rider.targetFreq - rider.freq) * 0.1;
    rider.y = 300 + Math.sin(time * rider.freq) * 160;

    trail.push({ x: rider.x, y: rider.y });
    if (trail.length > 50) trail.shift();
    for (const pt of trail) pt.x -= 3;

    // Spawners
    if (Math.random() < 0.04) spawnOrb();
    if (Math.random() < 0.025) spawnObstacle();

    // Orbs
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.x -= 4.5;

      if (!o.collected && Math.hypot(rider.x - o.x, rider.y - o.y) < rider.radius + o.radius) {
        o.collected = true;
        score += 200 * multiplier;
        multiplier = Math.min(5, multiplier + 1);
        playBeep(520 + multiplier * 80, 'sine', 0.1);
        orbs.splice(i, 1);
        continue;
      }

      if (o.x < -20) orbs.splice(i, 1);
    }

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];
      ob.x -= 4.5;

      // Box collision
      if (
        rider.x + rider.radius > ob.x &&
        rider.x - rider.radius < ob.x + ob.w &&
        rider.y + rider.radius > ob.y &&
        rider.y - rider.radius < ob.y + ob.h
      ) {
        gameOver();
        return;
      }

      if (ob.x < -30) obstacles.splice(i, 1);
    }

    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Audio Oscilloscope Horizon Lines
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 100; y <= 500; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // Carrier Wave Ribbon
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Harmonic Orbs
    for (const o of orbs) {
      ctx.fillStyle = '#00ff66';
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Obstacles (Glitch Blocks)
    for (const ob of obstacles) {
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 8;
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      ctx.shadowBlur = 0;
    }

    // Wave Rider Vehicle
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(rider.x, rider.y, rider.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
