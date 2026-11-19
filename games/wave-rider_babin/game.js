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

  // Physics & Hydrofoil Constants
  const GRAVITY = 0.42;
  const JUMP_IMPULSE = -9.5;
  const OCEAN_FLOOR = 540;
  const CEILING = 40;

  // Web Audio Synth with graceful node teardown
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

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (_) {}
      };

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // Rider Hydrofoil State
  const rider = {
    x: 180,
    y: 300,
    vy: 0,
    freq: 0.02,
    targetFreq: 0.02,
    radius: 12,
    normal: { x: 0, y: 1 }
  };

  let isAirborne = false;
  let isBoosting = false;
  const touchAccel = { x: 0, y: 0 };
  const targetTouchAccel = { x: 0, y: 0 };

  let orbs = [];
  let obstacles = [];
  let trail = [];
  let time = 0;

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') rider.targetFreq = 0.04;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') rider.targetFreq = 0.01;
      if (e.code === 'Space') {
        e.preventDefault();
        isBoosting = true;
        targetTouchAccel.y = -3.5;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
        rider.targetFreq = 0.02;
      }
      if (e.code === 'Space') {
        isBoosting = false;
        targetTouchAccel.y = 0;
      }
    });

    // Touch controls with continuous smoothing
    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); rider.targetFreq = 0.01; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); rider.targetFreq = 0.02; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); rider.targetFreq = 0.04; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); rider.targetFreq = 0.02; });

    tAction.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isBoosting = true;
      targetTouchAccel.y = -3.5;
    });
    tAction.addEventListener('touchend', (e) => {
      e.preventDefault();
      isBoosting = false;
      targetTouchAccel.y = 0;
    });
    tAction.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      isBoosting = false;
      targetTouchAccel.y = 0;
    });

    // Mouse fallback for virtual action buttons
    tAction.addEventListener('mousedown', () => {
      isBoosting = true;
      targetTouchAccel.y = -3.5;
    });
    window.addEventListener('mouseup', () => {
      if (isBoosting) {
        isBoosting = false;
        targetTouchAccel.y = 0;
      }
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
    rider.vy = 0;
    isAirborne = false;
    isBoosting = false;
    touchAccel.x = 0;
    touchAccel.y = 0;
    targetTouchAccel.x = 0;
    targetTouchAccel.y = 0;
    orbs = [];
    obstacles = [];
    trail = [];
    time = 0;
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    isAirborne = false;
    isBoosting = false;
    playBeep(120, 'sawtooth', 0.35);
    overlayHeading.textContent = 'SIGNAL DAMPENED';
    overlayDesc.textContent = 'Harmonic wave disrupted! Distance Surfed: ' + Math.floor(distance) + 'm | Score: ' + score;
    btnActionStart.textContent = 'SURF AGAIN';
    overlayScreen.classList.remove('hidden');

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_OVER',
          score: score,
          details: {
            score: score,
            distance: Math.floor(distance),
            multiplier: multiplier
          }
        }, '*');
      }
    } catch (_) {}
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

    // Smooth frequency transitions
    rider.freq += (rider.targetFreq - rider.freq) * 0.1;

    // Smooth touch input acceleration vectors across frame transitions
    touchAccel.y += (targetTouchAccel.y - touchAccel.y) * 0.18;
    touchAccel.x += (targetTouchAccel.x - touchAccel.x) * 0.18;

    // Current and previous wave surface height
    const waveY = 300 + Math.sin(time * rider.freq) * 160;
    const prevWaveY = 300 + Math.sin((time - 2) * rider.freq) * 160;
    const waveVelocityY = waveY - prevWaveY;

    // Calculate hydrofoil surface normal using derivative
    const waveDerivative = Math.cos(time * rider.freq) * 160 * rider.freq;
    const normalLen = Math.hypot(1, waveDerivative);
    const nx = -waveDerivative / normalLen;
    // Enforce strictly upward-pointing surface normal (Ny >= 0) to prevent inverted gravity
    let ny = 1 / normalLen;
    ny = Math.max(0, ny);
    rider.normal = { x: nx, y: ny };

    // Handle boost launch from touch acceleration
    if (isBoosting) {
      if (!isAirborne) {
        isAirborne = true;
        rider.vy = Math.min(JUMP_IMPULSE, waveVelocityY - 5);
        playBeep(700, 'triangle', 0.1);
      } else {
        // Continuous smooth lift assist while airborne
        rider.vy += touchAccel.y * 0.35;
      }
    }

    // Natural wave crest launch: when approaching a steep crest at high upward velocity
    if (!isAirborne && waveVelocityY < -3.5 && rider.freq >= 0.025) {
      const nextWaveY = 300 + Math.sin((time + 2) * rider.freq) * 160;
      const nextWaveVel = nextWaveY - waveY;
      if (nextWaveVel > waveVelocityY) {
        isAirborne = true;
        rider.vy = waveVelocityY * 1.1;
        playBeep(600, 'sine', 0.08);
      }
    }

    // Trajectory physics
    if (isAirborne) {
      // Ballistic parabolic trajectory physics
      rider.vy += GRAVITY;
      rider.y += rider.vy;

      // Smooth water re-entry when craft altitude meets or falls below wave height
      if (rider.y >= waveY) {
        isAirborne = false;
        rider.y = waveY;
        rider.vy = rider.vy * 0.2; // Damped landing impact
        playBeep(380, 'sine', 0.06);
      }
    } else {
      // Surface riding: conform smoothly to wave height
      rider.y = waveY;
      rider.vy = waveVelocityY;
    }

    // Clamp craft altitude so it never clips or plunges beneath the ocean floor
    if (rider.y > OCEAN_FLOOR - rider.radius) {
      rider.y = OCEAN_FLOOR - rider.radius;
      rider.vy = Math.min(0, rider.vy);
      isAirborne = false;
    }
    if (rider.y < CEILING + rider.radius) {
      rider.y = CEILING + rider.radius;
      rider.vy = Math.max(0, rider.vy);
    }

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

    try {
      if (window.parent && window.parent !== window && Math.round(distance) % 25 === 0) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_SCORE',
          score: score
        }, '*');
      }
    } catch (_) {}
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

    // Ocean Floor Safety Boundary
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, OCEAN_FLOOR);
    ctx.lineTo(800, OCEAN_FLOOR);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 245, 255, 0.03)';
    ctx.fillRect(0, OCEAN_FLOOR, 800, 600 - OCEAN_FLOOR);

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

    // Hydrofoil Wave Rider Craft
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = isAirborne ? '#ffe600' : '#00f5ff';
    ctx.shadowBlur = isAirborne ? 18 : 14;
    ctx.beginPath();
    ctx.arc(rider.x, rider.y, rider.radius, 0, Math.PI * 2);
    ctx.fill();

    // Hydrofoil stabilizer wings dynamically angled with vertical velocity
    ctx.strokeStyle = isAirborne ? '#ffe600' : '#00f5ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const tilt = Math.max(-0.4, Math.min(0.4, rider.vy * 0.035));
    ctx.translate(rider.x, rider.y);
    ctx.rotate(tilt);
    ctx.moveTo(-rider.radius - 6, 2);
    ctx.lineTo(rider.radius + 6, 2);
    ctx.stroke();
    ctx.restore();
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
