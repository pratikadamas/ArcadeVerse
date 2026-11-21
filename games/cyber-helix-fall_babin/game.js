/**
 * Cyber Helix Fall
 * A procedural 3D-perspective cylinder drop arcade game
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const floorDisplay = document.getElementById('floor-display');
  const scoreDisplay = document.getElementById('score-display');
  const bestDisplay = document.getElementById('best-display');
  const comboDisplay = document.getElementById('combo-display');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const leftBtn = document.getElementById('rotate-left-btn');
  const rightBtn = document.getElementById('rotate-right-btn');
  const finalScore = document.getElementById('final-score');
  const finalFloors = document.getElementById('final-floors');
  const finalCombo = document.getElementById('final-combo');

  // Safe Storage
  function getStoredBestScore() {
    try {
      const val = localStorage.getItem('cyber-helix-best-score');
      return val ? parseInt(val, 10) || 0 : 0;
    } catch (_) {
      return 0;
    }
  }

  function setStoredBestScore(scoreVal) {
    try {
      localStorage.setItem('cyber-helix-best-score', String(scoreVal));
    } catch (_) {}
  }

  function getStoredSound() {
    try {
      return localStorage.getItem('cyber-helix-sound') !== 'false';
    } catch (_) {
      return true;
    }
  }

  function setStoredSound(soundVal) {
    try {
      localStorage.setItem('cyber-helix-sound', soundVal ? 'true' : 'false');
    } catch (_) {}
  }

  // Audio System via Web Audio API
  let audioCtx = null;
  let soundEnabled = getStoredSound();

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

      if (type === 'bounce') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'pass') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'smash') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'gameover') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.48);
      }
    } catch (_) {}
  }

  // Game Constants & State
  const CYLINDER_RADIUS = 130;
  const TOWER_X = canvas.width / 2;
  const BALL_X = canvas.width / 2;
  const BALL_SCREEN_Y = 190;
  const BALL_RADIUS = 10;
  const PLATFORM_SPACING = 150;
  const GRAVITY = 0.45;
  const BOUNCE_FORCE = -9.2;

  let gameState = 'ready'; // ready, playing, gameover
  let score = 0;
  let bestScore = getStoredBestScore();
  let floor = 1;
  let combo = 0;
  let maxCombo = 0;

  let ballY = 0;
  let ballVy = 0;
  let cylinderAngle = 0;
  let cylinderAngularVelocity = 0;
  let platforms = [];
  let particles = [];
  let cameraY = 0;
  let consecutiveDrops = 0;
  let isFireball = false;

  let rafId = null;
  let lastFrameTime = performance.now();

  // Input Handling
  const keys = { left: false, right: false };
  let touchStartX = null;
  let isTouching = false;

  function createPlatform(index) {
    const sectors = [];
    const numSectors = 12;
    const gapCount = Math.min(3, 1 + Math.floor(index / 10));
    const hazardCount = index === 0 ? 0 : Math.min(4, 1 + Math.floor(index / 5));

    // Choose gap starting index
    const gapStart = Math.floor(Math.random() * numSectors);
    const gapIndices = new Set();
    for (let g = 0; g < gapCount; g++) {
      gapIndices.add((gapStart + g) % numSectors);
    }

    // Choose hazards
    const hazardIndices = new Set();
    while (hazardIndices.size < hazardCount) {
      const idx = Math.floor(Math.random() * numSectors);
      if (!gapIndices.has(idx)) {
        hazardIndices.add(idx);
      }
    }

    for (let i = 0; i < numSectors; i++) {
      if (gapIndices.has(i)) {
        sectors.push('gap');
      } else if (hazardIndices.has(i)) {
        sectors.push('hazard');
      } else {
        sectors.push('safe');
      }
    }

    return {
      index,
      y: index * PLATFORM_SPACING,
      sectors,
      smashed: false
    };
  }

  function resetGame() {
    score = 0;
    floor = 1;
    combo = 0;
    maxCombo = 0;
    consecutiveDrops = 0;
    isFireball = false;
    ballY = -30;
    ballVy = 0;
    cameraY = 0;
    cylinderAngle = 0;
    cylinderAngularVelocity = 0;
    particles = [];
    platforms = [];

    for (let i = 0; i < 8; i++) {
      platforms.push(createPlatform(i));
    }

    updateHUD();
    gameState = 'playing';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    startLoop();
  }

  function spawnParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 2,
        color,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  function checkPlatformCollisions(dtScale = 1.0) {
    const ballWorldY = ballY;

    for (let p of platforms) {
      if (p.smashed) continue;
      const dist = ballWorldY - p.y;
      const collisionPad = Math.max(4, Math.abs(ballVy) * dtScale);

      // Check if ball hits platform surface going downward with swept distance
      if (dist >= -BALL_RADIUS && dist <= BALL_RADIUS + collisionPad && ballVy >= 0) {
        // Determine which sector the ball lands on
        // Ball is at X = TOWER_X, top edge of disk
        // Calculate sector angle relative to cylinder
        let hitAngle = (Math.PI / 2 - cylinderAngle) % (Math.PI * 2);
        if (hitAngle < 0) hitAngle += Math.PI * 2;

        const numSectors = p.sectors.length;
        const sectorIndex = Math.floor((hitAngle / (Math.PI * 2)) * numSectors) % numSectors;
        const sectorType = p.sectors[sectorIndex];

        if (sectorType === 'gap') {
          // Ball drops cleanly through gap
          continue;
        }

        if (isFireball) {
          // Smashes through this platform!
          p.smashed = true;
          score += 50 * (combo + 1);
          floor = Math.max(floor, p.index + 2);
          combo++;
          maxCombo = Math.max(maxCombo, combo);
          consecutiveDrops++;
          playSound('smash');
          spawnParticles(BALL_X, BALL_SCREEN_Y, '#ffe600', 25);
          updateHUD();
          // Maintain downward momentum slightly
          ballVy = 3.5;
          return;
        }

        if (sectorType === 'hazard') {
          // Shattered! Game over
          playSound('gameover');
          spawnParticles(BALL_X, BALL_SCREEN_Y, '#ff0077', 35);
          triggerGameOver('Sphere shattered on a hazard sector!');
          return;
        }

        // Safe landing: bounce back up
        ballVy = BOUNCE_FORCE;
        ballY = p.y - BALL_RADIUS;
        consecutiveDrops = 0;
        isFireball = false;
        playSound('bounce');
        spawnParticles(BALL_X, BALL_SCREEN_Y, '#00f0ff', 12);
        return;
      }

      // Check if ball successfully descended below platform
      if (ballWorldY > p.y + BALL_RADIUS + 8 && !p.cleared) {
        p.cleared = true;
        consecutiveDrops++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        score += 15 * combo;
        floor = Math.max(floor, p.index + 2);

        if (consecutiveDrops >= 2) {
          isFireball = true;
        }

        playSound('pass');
        updateHUD();
      }
    }
  }

  function triggerGameOver(reason) {
    gameState = 'gameover';
    if (score > bestScore) {
      bestScore = score;
      setStoredBestScore(bestScore);
    }
    updateHUD();

    try {
      window.dispatchEvent(new CustomEvent('ARCADEVERSE_GAME_OVER', {
        detail: { gameId: 'cyber-helix-fall', score: score, floor: floor, combo: maxCombo }
      }));
    } catch (_) {}

    finalScore.textContent = score;
    finalFloors.textContent = floor;
    finalCombo.textContent = `${maxCombo}x`;
    document.getElementById('gameover-reason').textContent = reason;
    gameoverOverlay.classList.remove('hidden');
  }

  function updateHUD() {
    floorDisplay.textContent = floor;
    scoreDisplay.textContent = score;
    bestDisplay.textContent = bestScore;
    comboDisplay.textContent = `${combo}x`;
    if (combo >= 3) {
      comboDisplay.style.color = '#ffe600';
    } else {
      comboDisplay.style.color = 'var(--cyan)';
    }
  }

  function update(dtScale = 1.0) {
    if (gameState !== 'playing') return;

    // Cylinder rotation input
    if (keys.left) cylinderAngularVelocity = -0.065;
    else if (keys.right) cylinderAngularVelocity = 0.065;
    else cylinderAngularVelocity *= Math.pow(0.86, dtScale);

    cylinderAngle += cylinderAngularVelocity * dtScale;

    // Ball physics with dtScale
    ballVy += GRAVITY * dtScale;
    ballY += ballVy * dtScale;

    // Smooth camera tracking ball
    const targetCameraY = ballY - BALL_SCREEN_Y;
    cameraY += (targetCameraY - cameraY) * Math.min(1.0, 0.18 * dtScale);

    // Collision detection
    checkPlatformCollisions(dtScale);

    // Recycle platforms as player descends
    const highestPlatform = platforms[platforms.length - 1];
    if (ballY + 600 > highestPlatform.y) {
      platforms.push(createPlatform(highestPlatform.index + 1));
    }

    // Remove old platforms far above
    if (platforms.length > 12 && platforms[0].y < cameraY - 200) {
      platforms.shift();
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dtScale;
      p.y += p.vy * dtScale;
      p.alpha -= p.decay * dtScale;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw central neon pillar
    const pillarGradient = ctx.createLinearGradient(TOWER_X - 25, 0, TOWER_X + 25, 0);
    pillarGradient.addColorStop(0, '#020b18');
    pillarGradient.addColorStop(0.5, '#0c2242');
    pillarGradient.addColorStop(1, '#020b18');

    ctx.fillStyle = pillarGradient;
    ctx.fillRect(TOWER_X - 25, 0, 50, canvas.height);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(TOWER_X - 25, 0, 50, canvas.height);

    // Render platforms from back to front using pseudo-3D perspective
    const sortedPlatforms = [...platforms].sort((a, b) => b.y - a.y);

    for (let p of sortedPlatforms) {
      if (p.smashed) continue;
      const screenY = p.y - cameraY;
      if (screenY < -60 || screenY > canvas.height + 60) continue;

      const numSectors = p.sectors.length;
      const sectorAngle = (Math.PI * 2) / numSectors;

      for (let i = 0; i < numSectors; i++) {
        const type = p.sectors[i];
        if (type === 'gap') continue;

        const startAngle = cylinderAngle + i * sectorAngle;
        const endAngle = startAngle + sectorAngle;

        // Render platform sector as 3D ellipse slice
        ctx.beginPath();
        ctx.ellipse(TOWER_X, screenY, CYLINDER_RADIUS, CYLINDER_RADIUS * 0.35, 0, startAngle, endAngle);

        if (type === 'hazard') {
          ctx.fillStyle = '#ff0055';
          ctx.strokeStyle = '#ff3388';
        } else {
          ctx.fillStyle = '#00a8ff';
          ctx.strokeStyle = '#00f0ff';
        }

        ctx.lineWidth = 3;
        ctx.stroke();

        // Fill inner sector toward pillar
        ctx.lineTo(TOWER_X, screenY);
        ctx.closePath();
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }

    // Render ball
    const ballScreenY = ballY - cameraY;
    ctx.save();

    if (isFireball) {
      // Fiery glowing aura
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#ffaa00';
    } else {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#00f0ff';
    }

    ctx.beginPath();
    ctx.arc(BALL_X, ballScreenY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(BALL_X - 3, ballScreenY - 3, BALL_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render particles
    for (let p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function gameLoop(now = performance.now()) {
    const rawDt = (now - lastFrameTime) / 1000;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.1);
    lastFrameTime = now;
    const dtScale = Math.min(Math.max(dt * 60, 0.2), 3.0);

    update(dtScale);
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  function startLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Event Listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = false;
    }
  });

  // Mobile Drag on Canvas
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      isTouching = true;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!isTouching || e.touches.length === 0) return;
    const currentX = e.touches[0].clientX;
    const dx = currentX - touchStartX;
    cylinderAngle += dx * 0.012;
    touchStartX = currentX;
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    isTouching = false;
  });

  // Mobile Action Buttons
  const setupHoldBtn = (btn, dirKey) => {
    const startPress = (e) => {
      e.preventDefault();
      keys[dirKey] = true;
    };
    const endPress = (e) => {
      e.preventDefault();
      keys[dirKey] = false;
    };
    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', endPress);
    btn.addEventListener('mouseleave', endPress);
    btn.addEventListener('touchstart', startPress, { passive: false });
    btn.addEventListener('touchend', endPress, { passive: false });
  };

  setupHoldBtn(leftBtn, 'left');
  setupHoldBtn(rightBtn, 'right');

  // Sound Toggle
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    setStoredSound(soundEnabled);
    updateSoundUI();
    if (soundEnabled) playSound('bounce');
  });

  // Help Modal
  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Game Start & Restart
  startBtn.addEventListener('click', () => {
    initAudio();
    resetGame();
  });

  restartBtn.addEventListener('click', () => {
    resetGame();
  });

  // Visibility and Lifecycle
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLoop();
    } else {
      if (gameState === 'playing') startLoop();
    }
  });

  window.addEventListener('ARCADEVERSE_PAUSE', () => {
    stopLoop();
  });

  window.addEventListener('ARCADEVERSE_RESUME', () => {
    if (gameState === 'playing') startLoop();
  });

  window.addEventListener('ARCADEVERSE_TEARDOWN', () => {
    stopLoop();
    if (audioCtx && audioCtx.state !== 'closed') {
      try { audioCtx.close(); } catch (_) {}
    }
  });

  // Initialize
  updateSoundUI();
  updateHUD();
  startLoop();
})();
