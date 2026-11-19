/**
 * Neon Gravity Rush
 * Pure Vanilla JavaScript 60 FPS gravity-inversion runner with Web Audio API synthesis
 * Author: Babin Bid (@Babin123456)
 * NSOC Winter Edition 2026
 */

(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const sectorDisplay = document.getElementById('sector-display');
  const scoreDisplay = document.getElementById('score-display');
  const distanceDisplay = document.getElementById('distance-display');
  const multiplierDisplay = document.getElementById('multiplier-display');
  const bestDisplay = document.getElementById('best-display');

  const warpBanner = document.getElementById('warp-banner');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const touchFlipBtn = document.getElementById('touch-flip-btn');

  const finalScoreEl = document.getElementById('final-score');
  const finalSectorEl = document.getElementById('final-sector');
  const finalDistanceEl = document.getElementById('final-distance');
  const finalCoresEl = document.getElementById('final-cores');
  const finalBestEl = document.getElementById('final-best');

  const soundBtn = document.getElementById('sound-btn');
  const soundOnIcon = document.getElementById('sound-on-icon');
  const soundOffIcon = document.getElementById('sound-off-icon');

  const rulesBtn = document.getElementById('rules-btn');
  const closeRulesBtn = document.getElementById('close-rules-btn');
  const rulesModal = document.getElementById('rules-modal');

  // Constants
  const WIDTH = 720;
  const HEIGHT = 400;
  const CEILING_Y = 28;
  const FLOOR_Y = 372;
  const GRAVITY_ACCEL = 0.85;
  const FLIP_FORCE = 13.5;
  const BEST_STORAGE_KEY = 'arcadeverse_neon_gravity_best';

  // Audio System
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.12, gainLevel = 0.15) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function playFlipTone(toCeiling) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      const startFreq = toCeiling ? 260 : 540;
      const endFreq = toCeiling ? 580 : 240;
      osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (_) {}
  }

  function playCorePickupSound() {
    playTone(880, 'sine', 0.08, 0.15);
    setTimeout(() => playTone(1320, 'triangle', 0.1, 0.12), 60);
  }

  function playCrashSound() {
    playTone(110, 'sawtooth', 0.35, 0.22);
  }

  function playWarpSound() {
    playTone(330, 'square', 0.25, 0.15);
    setTimeout(() => playTone(660, 'sine', 0.3, 0.18), 100);
  }

  // Best Score Cache
  let bestScore = 0;
  try {
    bestScore = parseInt(localStorage.getItem(BEST_STORAGE_KEY), 10) || 0;
  } catch (_) {
    bestScore = 0;
  }
  bestDisplay.textContent = bestScore;

  // Game State
  let isPlaying = false;
  let score = 0;
  let distance = 0;
  let sector = 1;
  let coresCollected = 0;
  let speed = 6.0;
  let animId = null;

  // Parallax Stars & Grid
  const stars = Array.from({ length: 45 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * (HEIGHT - 60) + 30,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 1.5 + 0.5
  }));

  // Player Entity
  const player = {
    x: 110,
    y: FLOOR_Y - 24,
    width: 28,
    height: 24,
    vy: 0,
    gravityDir: 1, // 1 = down (floor), -1 = up (ceiling)
    onGround: true,
    rotation: 0,
    targetRotation: 0
  };

  // World Elements
  let obstacles = [];
  let energyCores = [];
  let particles = [];
  let spawnCooldown = 0;
  let warpTimer = null;
  let animId = null;
  let lastTime = performance.now();

  function spawnWorldObjects(dt = 1) {
    if (spawnCooldown > 0) {
      spawnCooldown -= dt;
      return;
    }

    const minGap = Math.max(35, 75 - sector * 4);
    spawnCooldown = minGap + Math.floor(Math.random() * 25);

    const type = Math.random();
    if (type < 0.65) {
      // Plasma Spike (Floor or Ceiling)
      const isCeiling = Math.random() > 0.5;
      const spikeHeight = 32;
      const spikeWidth = 26;
      obstacles.push({
        type: 'spike',
        isCeiling,
        x: WIDTH + 20,
        y: isCeiling ? CEILING_Y : FLOOR_Y - spikeHeight,
        width: spikeWidth,
        height: spikeHeight
      });
    } else if (type < 0.85) {
      // Floating Energy Core
      const coreY = Math.random() > 0.5 ? CEILING_Y + 70 : FLOOR_Y - 70;
      energyCores.push({
        x: WIDTH + 20,
        y: coreY,
        radius: 10,
        bob: 0
      });
    } else {
      // Dual Split Spikes (One on floor, core in center)
      obstacles.push({
        type: 'spike',
        isCeiling: false,
        x: WIDTH + 20,
        y: FLOOR_Y - 32,
        width: 26,
        height: 32
      });
      energyCores.push({
        x: WIDTH + 40,
        y: (CEILING_Y + FLOOR_Y) / 2,
        radius: 10,
        bob: 0
      });
    }
  }

  function flipGravity() {
    if (!isPlaying) return;
    initAudio();
    player.gravityDir = -player.gravityDir;
    player.vy = player.gravityDir * FLIP_FORCE * 0.45;
    player.targetRotation = player.gravityDir === 1 ? 0 : Math.PI;
    playFlipTone(player.gravityDir === -1);

    // Spawn burst trail
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        vx: (Math.random() - 0.5) * 4 - 2,
        vy: -player.gravityDir * (Math.random() * 3 + 1),
        size: Math.random() * 3 + 2,
        color: '#00f0ff',
        alpha: 1
      });
    }
  }

  function triggerWarp() {
    sector++;
    speed = Math.min(13, 6.0 + (sector - 1) * 0.8);
    playWarpSound();

    if (warpTimer) clearTimeout(warpTimer);
    warpBanner.textContent = `WARPING TO SECTOR ${sector}`;
    warpBanner.classList.add('active');
    warpTimer = setTimeout(() => {
      warpBanner.classList.remove('active');
      warpTimer = null;
    }, 1800);

    // Warp flash particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        vx: (Math.random() * 8 + 4) * -1,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 4 + 2,
        color: '#a855f7',
        alpha: 1
      });
    }
  }

  function update(dt = 1) {
    if (!isPlaying) return;

    distance += Math.round((speed / 2.5) * dt);
    score += Math.round(1 * (1 + (sector - 1) * 0.5) * dt);

    // Check Sector Progression every 300m
    const currentTargetSector = Math.floor(distance / 300) + 1;
    if (currentTargetSector > sector) {
      triggerWarp();
    }

    // Player Physics
    player.vy += player.gravityDir * GRAVITY_ACCEL * dt;
    player.y += player.vy * dt;

    // Floor collision
    if (player.gravityDir === 1 && player.y + player.height >= FLOOR_Y) {
      player.y = FLOOR_Y - player.height;
      player.vy = 0;
      player.onGround = true;
    } else if (player.gravityDir === -1 && player.y <= CEILING_Y) {
      // Ceiling collision
      player.y = CEILING_Y;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // Smooth craft rotation towards target orientation
    player.rotation += (player.targetRotation - player.rotation) * (1 - Math.pow(0.75, dt));

    // Thruster Trail
    if (Math.random() < 0.75 * dt) {
      particles.push({
        x: player.x,
        y: player.y + player.height / 2,
        vx: -speed * 0.8 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 1.5,
        size: Math.random() * 3 + 1,
        color: player.gravityDir === 1 ? '#00f0ff' : '#ec4899',
        alpha: 1
      });
    }

    // Spawn obstacles
    spawnWorldObjects(dt);

    // Update Obstacles & Check Collisions
    const pBounds = {
      left: player.x + 4,
      right: player.x + player.width - 4,
      top: player.y + 4,
      bottom: player.y + player.height - 4
    };

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;

      // Spike Hitbox
      if (
        pBounds.right > o.x + 4 &&
        pBounds.left < o.x + o.width - 4 &&
        pBounds.bottom > o.y + 4 &&
        pBounds.top < o.y + o.height - 4
      ) {
        gameOver();
        return;
      }

      if (o.x + o.width < -50) {
        obstacles.splice(i, 1);
      }
    }

    // Update Energy Cores
    for (let i = energyCores.length - 1; i >= 0; i--) {
      const c = energyCores[i];
      c.x -= speed * dt;
      c.bob += 0.08 * dt;

      const cy = c.y + Math.sin(c.bob) * 5;
      const dist = Math.hypot(
        player.x + player.width / 2 - c.x,
        player.y + player.height / 2 - cy
      );

      if (dist < c.radius + player.width / 2) {
        coresCollected++;
        score += 50 * sector;
        playCorePickupSound();

        // Core Spark Burst
        for (let p = 0; p < 12; p++) {
          particles.push({
            x: c.x,
            y: cy,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            size: Math.random() * 3 + 2,
            color: '#fbbf24',
            alpha: 1
          });
        }

        energyCores.splice(i, 1);
        continue;
      }

      if (c.x < -40) {
        energyCores.splice(i, 1);
      }
    }

    // Update Stars
    stars.forEach(s => {
      s.x -= s.speed * (speed / 6) * dt;
      if (s.x < 0) s.x = WIDTH;
    });

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha -= 0.035 * dt;
      if (pt.alpha <= 0) particles.splice(i, 1);
    }

    updateHUD();
  }

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Parallax Starfield
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
      ctx.globalAlpha = 0.4 + (s.size / 3) * 0.4;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.globalAlpha = 1;

    // Floor and Ceiling Rails
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // Ceiling Rail
    ctx.beginPath();
    ctx.moveTo(0, CEILING_Y);
    ctx.lineTo(WIDTH, CEILING_Y);
    ctx.stroke();

    // Floor Rail
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(WIDTH, FLOOR_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Rail Guideline Accents
    ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.fillRect(0, 0, WIDTH, CEILING_Y);
    ctx.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);

    // Draw Energy Cores
    energyCores.forEach(c => {
      const cy = c.y + Math.sin(c.bob) * 5;
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(c.x, cy, c.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner Core Ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, cy, c.radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Draw Plasma Spikes
    obstacles.forEach(o => {
      ctx.save();
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      if (o.isCeiling) {
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(o.x + o.width, o.y);
        ctx.lineTo(o.x + o.width / 2, o.y + o.height);
      } else {
        ctx.moveTo(o.x, o.y + o.height);
        ctx.lineTo(o.x + o.width, o.y + o.height);
        ctx.lineTo(o.x + o.width / 2, o.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Draw Particles
    particles.forEach(pt => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.restore();
    });

    // Draw Player Craft
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.rotate(player.rotation);

    // Glowing Craft Body
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.moveTo(player.width / 2, 0);
    ctx.lineTo(-player.width / 2, -player.height / 2);
    ctx.lineTo(-player.width / 3, 0);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.fill();

    // Craft Cockpit Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function loop(timestamp = performance.now()) {
    const deltaMs = Math.min(100, timestamp - lastTime);
    lastTime = timestamp;
    const dt = deltaMs / 16.667;

    update(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  function updateHUD() {
    sectorDisplay.textContent = sector;
    scoreDisplay.textContent = score;
    distanceDisplay.textContent = `${distance}m`;
    multiplierDisplay.textContent = `${(1 + (sector - 1) * 0.5).toFixed(1)}x`;

    if (score > bestScore) {
      bestScore = score;
      bestDisplay.textContent = bestScore;
      try {
        localStorage.setItem(BEST_STORAGE_KEY, bestScore);
      } catch (_) {}
    }
  }

  function startNewGame() {
    initAudio();
    if (warpTimer) {
      clearTimeout(warpTimer);
      warpTimer = null;
    }
    isPlaying = true;
    score = 0;
    distance = 0;
    sector = 1;
    coresCollected = 0;
    speed = 6.0;

    player.y = FLOOR_Y - player.height;
    player.vy = 0;
    player.gravityDir = 1;
    player.rotation = 0;
    player.targetRotation = 0;

    obstacles = [];
    energyCores = [];
    particles = [];
    spawnCooldown = 40;

    startOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
    warpBanner.classList.remove('active');

    updateHUD();
    lastTime = performance.now();
    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function gameOver() {
    isPlaying = false;
    playCrashSound();
    if (warpTimer) {
      clearTimeout(warpTimer);
      warpTimer = null;
    }
    warpBanner.classList.remove('active');

    // Emit score & game over telemetry
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_SCORE',
          score,
          sector,
          distance
        }, '*');
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_OVER',
          score,
          details: {
            score,
            sector,
            distance,
            coresCollected
          }
        }, '*');
      }
    } catch (_) {}

    // Death explosion
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? '#f43f5e' : '#00f0ff',
        alpha: 1
      });
    }

    finalScoreEl.textContent = score;
    finalSectorEl.textContent = sector;
    finalDistanceEl.textContent = `${distance}m`;
    finalCoresEl.textContent = coresCollected;
    finalBestEl.textContent = bestScore;

    setTimeout(() => {
      gameoverOverlay.classList.add('active');
    }, 550);
  }

  // Keyboard Navigation & Accessibility
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
      e.preventDefault();
      if (isPlaying) {
        flipGravity();
      } else if (startOverlay.classList.contains('active') || gameoverOverlay.classList.contains('active')) {
        startNewGame();
      }
    } else if (e.code === 'Enter') {
      e.preventDefault();
      if (!isPlaying) startNewGame();
    } else if (e.code === 'KeyM') {
      toggleSound();
    } else if (e.code === 'Escape') {
      if (rulesModal.classList.contains('active')) {
        rulesModal.classList.remove('active');
      }
    }
  });

  // Mouse / Pointer click on canvas to flip gravity
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (isPlaying) {
      flipGravity();
    }
  });

  // Mobile Touch Flip Button
  touchFlipBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (isPlaying) {
      flipGravity();
    }
  });

  function toggleSound() {
    soundEnabled = !soundEnabled;
    soundOnIcon.classList.toggle('hidden', !soundEnabled);
    soundOffIcon.classList.toggle('hidden', soundEnabled);
    if (soundEnabled) initAudio();
  }

  // Event Listeners
  startBtn.addEventListener('click', startNewGame);
  restartBtn.addEventListener('click', startNewGame);
  soundBtn.addEventListener('click', toggleSound);

  // Modal Handlers
  rulesBtn.addEventListener('click', () => rulesModal.classList.add('active'));
  closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('active'));
  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove('active');
  });

  // Lifecycle & Messages
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) {
      isPlaying = false;
      if (animId) cancelAnimationFrame(animId);
      startOverlay.classList.add('active');
    }
  });

  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    const type = event.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      if (isPlaying) {
        isPlaying = false;
        if (animId) cancelAnimationFrame(animId);
      }
    } else if (type === 'ARCADEVERSE_RESUME') {
      if (!isPlaying && !startOverlay.classList.contains('active') && !gameoverOverlay.classList.contains('active')) {
        isPlaying = true;
        lastTime = performance.now();
        loop();
      }
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      isPlaying = false;
      if (animId) cancelAnimationFrame(animId);
      if (warpTimer) clearTimeout(warpTimer);
      if (audioCtx) {
        try { audioCtx.close(); } catch (_) {}
      }
    }
  });

  // Initial draw
  draw();
  updateHUD();
})();

