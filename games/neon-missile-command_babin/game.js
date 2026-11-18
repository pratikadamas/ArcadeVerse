/**
 * Neon Missile Command
 * Tactical Airspace Defense Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const waveDisplay = document.getElementById('wave-display');
  const scoreDisplay = document.getElementById('score-display');
  const bestDisplay = document.getElementById('best-display');
  const ammoDisplay = document.getElementById('ammo-display');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const waveClearOverlay = document.getElementById('wave-clear-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const nextWaveBtn = document.getElementById('next-wave-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const finalScore = document.getElementById('final-score');
  const finalWave = document.getElementById('final-wave');
  const finalIntercepts = document.getElementById('final-intercepts');
  const bonusCities = document.getElementById('bonus-cities');
  const bonusAmmo = document.getElementById('bonus-ammo');
  const bonusPoints = document.getElementById('bonus-points');

  // Audio Synthesizer via Web Audio API
  let audioCtx = null;
  let soundEnabled = true;
  try {
    soundEnabled = localStorage.getItem('neon-missile-sound') !== 'false';
  } catch (_) {}

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function updateSoundUI() {
    if (soundEnabled) {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      soundBtn.setAttribute('aria-label', 'Mute Sound');
    } else {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
      soundBtn.setAttribute('aria-label', 'Unmute Sound');
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      if (type === 'launch') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'explode') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.28);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'city_loss') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'wave_clear') {
        [440, 554, 659, 880].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.15, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.2);
        });
      }
    } catch (_) {}
  }

  // Game Constants & State
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = HEIGHT - 25;

  let gameState = 'ready'; // ready, playing, wave_clear, gameover
  let score = 0;
  let bestScore = 0;
  try {
    bestScore = parseInt(localStorage.getItem('neon-missile-best') || '0', 10);
  } catch (_) {}
  let wave = 1;
  let ammo = 30;
  let totalIntercepts = 0;
  let rafId = null;
  let lastTime = performance.now();

  let enemyMissiles = [];
  let playerMissiles = [];
  let explosions = [];
  let particles = [];

  // Ground installations
  // 3 Batteries: Left, Center, Right
  let batteries = [
    { x: 45, y: GROUND_Y - 10, alive: true },
    { x: WIDTH / 2, y: GROUND_Y - 10, alive: true },
    { x: WIDTH - 45, y: GROUND_Y - 10, alive: true }
  ];

  // 4 Cities
  let cities = [
    { x: 135, y: GROUND_Y - 6, alive: true },
    { x: 215, y: GROUND_Y - 6, alive: true },
    { x: 345, y: GROUND_Y - 6, alive: true },
    { x: 425, y: GROUND_Y - 6, alive: true }
  ];

  let waveSpawnQueue = [];
  let spawnTimer = 0;

  function initWave(waveNum) {
    wave = waveNum;
    ammo = 30;
    enemyMissiles = [];
    playerMissiles = [];
    explosions = [];
    particles = [];

    // Scale wave difficulty
    const count = 12 + waveNum * 4;
    const baseSpeed = 0.55 + Math.min(1.4, waveNum * 0.12);

    waveSpawnQueue = [];
    for (let i = 0; i < count; i++) {
      // Pick random destination (alive city or battery)
      const targets = [...cities, ...batteries].filter(t => t.alive);
      const target = targets.length > 0 
        ? targets[Math.floor(Math.random() * targets.length)]
        : { x: Math.random() * (WIDTH - 40) + 20, y: GROUND_Y };

      const startX = Math.random() * (WIDTH - 60) + 30;
      const startY = -10;
      const dx = target.x - startX;
      const dy = target.y - startY;
      const dist = Math.hypot(dx, dy);
      const speed = baseSpeed * (Math.random() * 0.4 + 0.8);
      const safeDist = dist < 1e-4 ? 1 : dist;

      waveSpawnQueue.push({
        x: startX,
        y: startY,
        vx: (dx / safeDist) * speed,
        vy: (dy / safeDist) * speed,
        targetX: target.x,
        targetY: target.y,
        delay: i * (120 - Math.min(60, waveNum * 8)) + Math.random() * 40
      });
    }

    updateHUD();
    gameState = 'playing';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    waveClearOverlay.classList.add('hidden');
  }

  function fireInterceptor(targetX, targetY) {
    if (gameState !== 'playing' || ammo <= 0) return;

    // Restrict target above ground
    if (targetY > GROUND_Y - 20) targetY = GROUND_Y - 20;

    // Find best available battery (closest with ammo)
    const availableBatteries = batteries.filter(b => b.alive);
    if (availableBatteries.length === 0) return;

    availableBatteries.sort((a, b) => {
      const distA = Math.hypot(a.x - targetX, a.y - targetY);
      const distB = Math.hypot(b.x - targetX, b.y - targetY);
      return distA - distB;
    });

    const origin = availableBatteries[0];
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return;
    const speed = 7.5;

    playerMissiles.push({
      x: origin.x,
      y: origin.y,
      startX: origin.x,
      startY: origin.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      targetX,
      targetY
    });

    ammo--;
    playSound('launch');
    updateHUD();
  }

  function spawnExplosion(x, y, isEnemy = false) {
    explosions.push({
      x,
      y,
      radius: 2,
      maxRadius: isEnemy ? 28 : 38,
      growing: true,
      alpha: 1,
      color: isEnemy ? '#ff7700' : '#00f0ff'
    });
    playSound('explode');

    // Spawn sparks
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: isEnemy ? '#ff0077' : '#00ff88',
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  function triggerGameOver() {
    gameState = 'gameover';
    if (score > bestScore) {
      bestScore = score;
      try {
        localStorage.setItem('neon-missile-best', bestScore.toString());
      } catch (_) {}
    }
    updateHUD();

    finalScore.textContent = score;
    finalWave.textContent = wave;
    finalIntercepts.textContent = totalIntercepts;
    gameoverOverlay.classList.remove('hidden');
  }

  function checkWaveClear() {
    const survivingCities = cities.filter(c => c.alive).length;
    if (survivingCities === 0) {
      triggerGameOver();
      return;
    }

    gameState = 'wave_clear';
    const cityBonus = survivingCities * 100;
    const ammoBonus = ammo * 10;
    const totalBonus = cityBonus + ammoBonus;

    score += totalBonus;
    if (score > bestScore) {
      bestScore = score;
      try {
        localStorage.setItem('neon-missile-best', bestScore.toString());
      } catch (_) {}
    }
    updateHUD();
    playSound('wave_clear');

    bonusCities.textContent = `${survivingCities} (x100)`;
    bonusAmmo.textContent = `${ammo} (x10)`;
    bonusPoints.textContent = `+${totalBonus}`;
    waveClearOverlay.classList.remove('hidden');
  }

  function update(dt = 1) {
    if (gameState !== 'playing') return;

    spawnTimer += dt;

    // Spawn enemy missiles from queue
    for (let i = waveSpawnQueue.length - 1; i >= 0; i--) {
      const item = waveSpawnQueue[i];
      if (spawnTimer >= item.delay) {
        enemyMissiles.push({
          x: item.x,
          y: item.y,
          startX: item.x,
          startY: item.y,
          vx: item.vx,
          vy: item.vy,
          targetX: item.targetX,
          targetY: item.targetY
        });
        waveSpawnQueue.splice(i, 1);
      }
    }

    // Update player interceptor missiles
    for (let i = playerMissiles.length - 1; i >= 0; i--) {
      const m = playerMissiles[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Check if missile reached target
      const distToTarget = Math.hypot(m.targetX - m.x, m.targetY - m.y);
      if (distToTarget <= 7 || m.y <= m.targetY) {
        spawnExplosion(m.targetX, m.targetY, false);
        playerMissiles.splice(i, 1);
      }
    }

    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      const exp = explosions[i];
      if (exp.growing) {
        exp.radius += 1.6 * dt;
        if (exp.radius >= exp.maxRadius) exp.growing = false;
      } else {
        exp.radius -= 0.8 * dt;
        exp.alpha = exp.radius / exp.maxRadius;
        if (exp.radius <= 0) {
          explosions.splice(i, 1);
          continue;
        }
      }

      // Check collision with enemy missiles
      for (let j = enemyMissiles.length - 1; j >= 0; j--) {
        const em = enemyMissiles[j];
        const dist = Math.hypot(em.x - exp.x, em.y - exp.y);
        if (dist <= exp.radius) {
          spawnExplosion(em.x, em.y, true);
          enemyMissiles.splice(j, 1);
          score += 25;
          totalIntercepts++;
          updateHUD();
        }
      }
    }

    // Update enemy missiles
    for (let i = enemyMissiles.length - 1; i >= 0; i--) {
      const em = enemyMissiles[i];
      em.x += em.vx * dt;
      em.y += em.vy * dt;

      // Check if hit ground or target
      if (em.y >= GROUND_Y) {
        spawnExplosion(em.x, GROUND_Y, true);

        // Check if city was hit
        for (let city of cities) {
          if (city.alive && Math.abs(em.x - city.x) < 26) {
            city.alive = false;
            playSound('city_loss');
            spawnExplosion(city.x, GROUND_Y - 5, true);
          }
        }

        // Check if battery was hit
        for (let bat of batteries) {
          if (bat.alive && Math.abs(em.x - bat.x) < 22) {
            bat.alive = false;
            playSound('city_loss');
            spawnExplosion(bat.x, GROUND_Y - 5, true);
          }
        }

        enemyMissiles.splice(i, 1);

        // Check loss condition
        if (cities.every(c => !c.alive)) {
          triggerGameOver();
          return;
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Check wave completion
    if (waveSpawnQueue.length === 0 && enemyMissiles.length === 0 && explosions.length === 0) {
      checkWaveClear();
    }
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Deep space grid background
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GROUND_Y);
      ctx.stroke();
    }
    for (let y = 0; y < GROUND_Y; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // Draw Ground Terrain
    ctx.fillStyle = '#0a101f';
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(WIDTH, GROUND_Y);
    ctx.stroke();

    // Draw Cities
    for (let city of cities) {
      if (city.alive) {
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        // Draw cyber city cluster
        ctx.fillRect(city.x - 14, GROUND_Y - 14, 8, 14);
        ctx.fillRect(city.x - 4, GROUND_Y - 20, 10, 20);
        ctx.fillRect(city.x + 8, GROUND_Y - 12, 6, 12);
        ctx.shadowBlur = 0;
      } else {
        // Destroyed city ruins
        ctx.fillStyle = '#445566';
        ctx.fillRect(city.x - 12, GROUND_Y - 4, 24, 4);
      }
    }

    // Draw Missile Batteries
    for (let bat of batteries) {
      if (bat.alive) {
        ctx.fillStyle = '#ff0077';
        ctx.shadowColor = '#ff0077';
        ctx.shadowBlur = 10;
        // Battery turret base
        ctx.beginPath();
        ctx.arc(bat.x, GROUND_Y - 2, 14, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(bat.x - 3, GROUND_Y - 14, 6, 8);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#445566';
        ctx.beginPath();
        ctx.arc(bat.x, GROUND_Y - 2, 10, Math.PI, 0);
        ctx.fill();
      }
    }

    // Draw Enemy Missiles and Trails
    for (let em of enemyMissiles) {
      ctx.strokeStyle = 'rgba(255, 0, 119, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(em.startX, em.startY);
      ctx.lineTo(em.x, em.y);
      ctx.stroke();

      // Glowing missile head
      ctx.fillStyle = '#ff3366';
      ctx.shadowColor = '#ff0077';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(em.x, em.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Player Interceptor Missiles
    for (let pm of playerMissiles) {
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pm.startX, pm.startY);
      ctx.lineTo(pm.x, pm.y);
      ctx.stroke();

      // Interceptor head
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pm.x, pm.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Small target marker X
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pm.targetX - 3, pm.targetY - 3, 6, 6);
    }

    // Draw Explosions
    for (let exp of explosions) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, exp.alpha);
      ctx.fillStyle = exp.color;
      ctx.shadowColor = exp.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner white core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Particles
    for (let p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateHUD() {
    waveDisplay.textContent = wave;
    scoreDisplay.textContent = score;
    bestDisplay.textContent = bestScore;
    ammoDisplay.textContent = ammo;
    if (ammo <= 5) {
      ammoDisplay.style.color = '#ff0077';
    } else {
      ammoDisplay.style.color = 'var(--cyan)';
    }
  }

  function gameLoop(timestamp = performance.now()) {
    const deltaMs = Math.min(100, timestamp - lastTime);
    lastTime = timestamp;
    const dt = deltaMs / 16.667;

    update(dt);
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  // Canvas Click / Touch to Target
  function handleTargetAction(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const targetX = (clientX - rect.left) * scaleX;
    const targetY = (clientY - rect.top) * scaleY;
    fireInterceptor(targetX, targetY);
  }

  canvas.addEventListener('mousedown', (e) => {
    handleTargetAction(e.clientX, e.clientY);
  });

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      handleTargetAction(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  // Buttons & Controls
  startBtn.addEventListener('click', () => {
    initAudio();
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    batteries.forEach(b => b.alive = true);
    cities.forEach(c => c.alive = true);
    score = 0;
    totalIntercepts = 0;
    initWave(1);
    gameLoop();
  });

  restartBtn.addEventListener('click', () => {
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    batteries.forEach(b => b.alive = true);
    cities.forEach(c => c.alive = true);
    score = 0;
    totalIntercepts = 0;
    initWave(1);
    gameLoop();
  });

  nextWaveBtn.addEventListener('click', () => {
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    initWave(wave + 1);
    gameLoop();
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem('neon-missile-sound', soundEnabled.toString());
    } catch (_) {}
    updateSoundUI();
    if (soundEnabled) playSound('launch');
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Lifecycle & Messages
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'playing') {
      gameState = 'paused';
    } else if (!document.hidden && gameState === 'paused') {
      gameState = 'playing';
      lastTime = performance.now();
    }
  });

  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    const type = event.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      if (gameState === 'playing') gameState = 'paused';
    } else if (type === 'ARCADEVERSE_RESUME') {
      if (gameState === 'paused') {
        gameState = 'playing';
        lastTime = performance.now();
      }
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch (_) {}
      }
    }
  });

  // Initialize
  updateSoundUI();
  updateHUD();
  gameLoop();
})();
