/**
 * Cosmic Orbit Slingshot
 * Orbital Gravity Assist Simulation Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const sectorDisplay = document.getElementById('sector-display');
  const attemptsDisplay = document.getElementById('attempts-display');
  const stardustDisplay = document.getElementById('stardust-display');
  const scoreDisplay = document.getElementById('score-display');
  const startOverlay = document.getElementById('start-overlay');
  const sectorClearOverlay = document.getElementById('sector-clear-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const nextSectorBtn = document.getElementById('next-sector-btn');
  const resetLevelBtn = document.getElementById('reset-level-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const finalStardust = document.getElementById('final-stardust');
  const finalAttempts = document.getElementById('final-attempts');
  const sectorScoreDisplay = document.getElementById('sector-score');

  // Storage helper
  function getStoredSound() {
    try {
      return localStorage.getItem('cosmic-orbit-sound') !== 'false';
    } catch (_) {
      return true;
    }
  }

  function setStoredSound(enabled) {
    try {
      localStorage.setItem('cosmic-orbit-sound', enabled ? 'true' : 'false');
    } catch (_) {}
  }

  // Audio Synthesizer via Web Audio API
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

      if (type === 'launch') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.14);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'pickup') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'dock') {
        [440, 554, 659, 880, 1108].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.18, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.28);
        });
      } else if (type === 'crash') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
      }
    } catch (_) {}
  }

  // 5 Celestial Sectors Configuration
  const SECTORS = [
    // Sector 1: Single Terra Giant assist
    {
      start: { x: 70, y: 340 },
      target: { x: 470, y: 90, radius: 24 },
      planets: [
        { x: 260, y: 220, radius: 46, mass: 2800, color: '#38bdf8', glow: '#0ea5e9' }
      ],
      stardust: [
        { x: 220, y: 130, collected: false },
        { x: 340, y: 180, collected: false },
        { x: 380, y: 110, collected: false }
      ]
    },
    // Sector 2: Binary Gravity Well
    {
      start: { x: 60, y: 210 },
      target: { x: 480, y: 210, radius: 24 },
      planets: [
        { x: 230, y: 130, radius: 36, mass: 2100, color: '#c084fc', glow: '#a855f7' },
        { x: 310, y: 290, radius: 38, mass: 2400, color: '#f43f5e', glow: '#e11d48' }
      ],
      stardust: [
        { x: 190, y: 190, collected: false },
        { x: 270, y: 210, collected: false },
        { x: 360, y: 230, collected: false }
      ]
    },
    // Sector 3: Triple Slingshot Loop
    {
      start: { x: 70, y: 80 },
      target: { x: 470, y: 350, radius: 24 },
      planets: [
        { x: 190, y: 210, radius: 34, mass: 1900, color: '#00ffaa', glow: '#00cc88' },
        { x: 350, y: 150, radius: 40, mass: 2600, color: '#38bdf8', glow: '#0284c7' },
        { x: 290, y: 330, radius: 32, mass: 1700, color: '#fbbf24', glow: '#f59e0b' }
      ],
      stardust: [
        { x: 230, y: 120, collected: false },
        { x: 340, y: 260, collected: false },
        { x: 430, y: 280, collected: false }
      ]
    },
    // Sector 4: Event Horizon Singularity
    {
      start: { x: 60, y: 360 },
      target: { x: 480, y: 70, radius: 24 },
      planets: [
        // Black Hole Core
        { x: 270, y: 210, radius: 28, mass: 4200, color: '#090a12', glow: '#ff0077', isSingularity: true },
        { x: 160, y: 140, radius: 28, mass: 1400, color: '#00f0ff', glow: '#00c4d4' }
      ],
      stardust: [
        { x: 210, y: 270, collected: false },
        { x: 360, y: 150, collected: false },
        { x: 420, y: 110, collected: false }
      ]
    },
    // Sector 5: Grand Cosmic Nexus
    {
      start: { x: 60, y: 210 },
      target: { x: 480, y: 360, radius: 24 },
      planets: [
        { x: 200, y: 110, radius: 32, mass: 1800, color: '#ec4899', glow: '#db2777' },
        { x: 270, y: 320, radius: 42, mass: 2800, color: '#38bdf8', glow: '#0284c7' },
        { x: 380, y: 180, radius: 35, mass: 2200, color: '#a855f7', glow: '#9333ea' }
      ],
      stardust: [
        { x: 180, y: 230, collected: false },
        { x: 320, y: 210, collected: false },
        { x: 440, y: 240, collected: false }
      ]
    }
  ];

  let currentSectorIndex = 0;
  let score = 0;
  let attempts = 0;
  let gameState = 'ready'; // ready, aiming, in_flight, sector_clear
  let lastFrameTime = performance.now();
  let rafId = null;
  let overlayTimer = null;

  // Probe entity
  let probe = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 5,
    trail: []
  };

  // Slingshot drag state
  let isDragging = false;
  let dragCurrentX = 0;
  let dragCurrentY = 0;

  function loadSector(index) {
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    currentSectorIndex = index;
    const sector = SECTORS[index];
    attempts = 0;

    probe.x = sector.start.x;
    probe.y = sector.start.y;
    probe.vx = 0;
    probe.vy = 0;
    probe.trail = [];

    // Reset stardust
    sector.stardust.forEach(s => s.collected = false);

    isDragging = false;
    gameState = 'aiming';
    sectorClearOverlay.classList.add('hidden');
    updateHUD();
    render();
  }

  function launchProbe(vx, vy) {
    if (gameState !== 'aiming') return;
    probe.vx = vx;
    probe.vy = vy;
    probe.trail = [];
    attempts++;
    gameState = 'in_flight';
    lastFrameTime = performance.now();
    playSound('launch');
    updateHUD();
  }

  function resetToStart() {
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    const sector = SECTORS[currentSectorIndex];
    probe.x = sector.start.x;
    probe.y = sector.start.y;
    probe.vx = 0;
    probe.vy = 0;
    probe.trail = [];
    gameState = 'aiming';
    updateHUD();
    render();
  }

  function simulateStep(p, stepScale = 1.0) {
    const sector = SECTORS[currentSectorIndex];
    let totalAx = 0;
    let totalAy = 0;

    for (let planet of sector.planets) {
      const dx = planet.x - p.x;
      const dy = planet.y - p.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist > planet.radius) {
        // Gravitational force: a = G * mass / dist^2
        const force = planet.mass / (distSq + 200);
        totalAx += (dx / dist) * force * 0.0035;
        totalAy += (dy / dist) * force * 0.0035;
      }
    }

    p.vx += totalAx * stepScale;
    p.vy += totalAy * stepScale;
    p.x += p.vx * stepScale;
    p.y += p.vy * stepScale;
  }

  function update(dtScale = 1.0) {
    if (gameState !== 'in_flight') return;

    const sector = SECTORS[currentSectorIndex];

    // Record trail
    probe.trail.push({ x: probe.x, y: probe.y });
    if (probe.trail.length > 80) probe.trail.shift();

    // Physics step scaled by dtScale
    simulateStep(probe, dtScale);

    // Check Stardust collection
    for (let s of sector.stardust) {
      if (!s.collected && Math.hypot(probe.x - s.x, probe.y - s.y) < 18) {
        s.collected = true;
        score += 100;
        playSound('pickup');
        updateHUD();
      }
    }

    // Check Target Nexus Docking
    const distToTarget = Math.hypot(probe.x - sector.target.x, probe.y - sector.target.y);
    if (distToTarget <= sector.target.radius + probe.radius) {
      // Success!
      gameState = 'sector_clear';
      playSound('dock');
      const harvestCount = sector.stardust.filter(s => s.collected).length;
      const attemptBonus = Math.max(100, 500 - (attempts - 1) * 80);
      const sectorScore = 400 + harvestCount * 100 + attemptBonus;
      score += sectorScore;

      finalStardust.textContent = `${harvestCount} / ${sector.stardust.length}`;
      finalAttempts.textContent = attempts;
      sectorScoreDisplay.textContent = `+${sectorScore}`;
      updateHUD();

      try {
        window.dispatchEvent(new CustomEvent('ARCADEVERSE_GAME_SCORE', {
          detail: { gameId: 'cosmic-orbit-slingshot', score, sector: currentSectorIndex + 1 }
        }));
      } catch (_) {}

      if (overlayTimer) clearTimeout(overlayTimer);
      overlayTimer = setTimeout(() => {
        sectorClearOverlay.classList.remove('hidden');
      }, 400);
      return;
    }

    // Check Planet Collisions
    for (let planet of sector.planets) {
      const dist = Math.hypot(probe.x - planet.x, probe.y - planet.y);
      if (dist <= planet.radius + probe.radius) {
        playSound('crash');
        resetToStart();
        return;
      }
    }

    // Check Out of Bounds
    if (probe.x < -40 || probe.x > canvas.width + 40 || probe.y < -40 || probe.y > canvas.height + 40) {
      resetToStart();
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sector = SECTORS[currentSectorIndex];

    // Starfield Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 83 + 17) % canvas.width;
      const sy = (i * 59 + 29) % canvas.height;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Render Celestial Bodies
    for (let planet of sector.planets) {
      ctx.save();
      // Gravitational Atmosphere Glow
      ctx.shadowColor = planet.glow;
      ctx.shadowBlur = 25;
      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner details
      if (planet.isSingularity) {
        // Black Hole ring
        ctx.strokeStyle = '#ff0077';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Target Nexus Station
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sector.target.x, sector.target.y, sector.target.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center docking icon
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(sector.target.x, sector.target.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render Stardust Energy Orbs
    for (let s of sector.stardust) {
      if (!s.collected) {
        ctx.save();
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Render Probe Flight Trail
    if (probe.trail.length > 1) {
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(probe.trail[0].x, probe.trail[0].y);
      for (let i = 1; i < probe.trail.length; i++) {
        ctx.lineTo(probe.trail[i].x, probe.trail[i].y);
      }
      ctx.stroke();
    }

    // Render Launch Station Base
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sector.start.x, sector.start.y, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Render Aiming Slingshot Indicator
    if (isDragging && gameState === 'aiming') {
      const pullX = sector.start.x - dragCurrentX;
      const pullY = sector.start.y - dragCurrentY;
      const launchVx = pullX * 0.07;
      const launchVy = pullY * 0.07;

      // Draw slingshot band
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sector.start.x, sector.start.y);
      ctx.lineTo(dragCurrentX, dragCurrentY);
      ctx.stroke();

      // Draw Projected Trajectory Dots (forward 40 steps)
      let simP = { x: sector.start.x, y: sector.start.y, vx: launchVx, vy: launchVy };
      ctx.fillStyle = 'rgba(255, 230, 0, 0.7)';
      for (let step = 0; step < 40; step++) {
        simulateStep(simP);
        if (step % 3 === 0) {
          ctx.beginPath();
          ctx.arc(simP.x, simP.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Render Probe
    ctx.save();
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(probe.x, probe.y, probe.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function updateHUD() {
    const sector = SECTORS[currentSectorIndex];
    sectorDisplay.textContent = `${currentSectorIndex + 1} / ${SECTORS.length}`;
    attemptsDisplay.textContent = attempts;
    const collectedCount = sector.stardust.filter(s => s.collected).length;
    stardustDisplay.textContent = `${collectedCount} / ${sector.stardust.length}`;
    scoreDisplay.textContent = score;
  }

  function gameLoop(now) {
    if (!now) now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
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

  // Mouse & Touch Slingshot Drag Handlers
  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function handleStartDrag(clientX, clientY) {
    if (gameState !== 'aiming') return;
    const pos = getCanvasPos(clientX, clientY);
    const sector = SECTORS[currentSectorIndex];
    const dist = Math.hypot(pos.x - sector.start.x, pos.y - sector.start.y);

    if (dist < 45) {
      isDragging = true;
      dragCurrentX = pos.x;
      dragCurrentY = pos.y;
    }
  }

  function handleMoveDrag(clientX, clientY) {
    if (!isDragging) return;
    const pos = getCanvasPos(clientX, clientY);
    dragCurrentX = pos.x;
    dragCurrentY = pos.y;
  }

  function handleEndDrag() {
    if (!isDragging) return;
    isDragging = false;
    const sector = SECTORS[currentSectorIndex];
    const pullX = sector.start.x - dragCurrentX;
    const pullY = sector.start.y - dragCurrentY;
    const pullDist = Math.hypot(pullX, pullY);

    if (pullDist > 12) {
      const maxPull = 120;
      const clampedPull = Math.min(pullDist, maxPull);
      const ratio = clampedPull / pullDist;
      launchProbe(pullX * ratio * 0.07, pullY * ratio * 0.07);
    }
  }

  canvas.addEventListener('mousedown', (e) => handleStartDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => handleMoveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', handleEndDrag);

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length > 0) {
      handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchend', handleEndDrag);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      resetToStart();
    }
  });

  resetLevelBtn.addEventListener('click', resetToStart);

  startBtn.addEventListener('click', () => {
    initAudio();
    score = 0;
    loadSector(0);
  });

  nextSectorBtn.addEventListener('click', () => {
    const nextIdx = (currentSectorIndex + 1) % SECTORS.length;
    loadSector(nextIdx);
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    setStoredSound(soundEnabled);
    updateSoundUI();
    if (soundEnabled) playSound('launch');
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Lifecycle listeners
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLoop();
    } else {
      startLoop();
    }
  });

  window.addEventListener('ARCADEVERSE_PAUSE', () => {
    stopLoop();
  });

  window.addEventListener('ARCADEVERSE_RESUME', () => {
    startLoop();
  });

  window.addEventListener('ARCADEVERSE_TEARDOWN', () => {
    stopLoop();
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      try { audioCtx.close(); } catch (_) {}
    }
  });

  // Initialize
  updateSoundUI();
  loadSector(0);
  startLoop();
})();
