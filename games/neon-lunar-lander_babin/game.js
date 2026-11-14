/**
 * Neon Lunar Lander
 * Planetary Physics Descent Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const altDisplay = document.getElementById('alt-display');
  const vspeedDisplay = document.getElementById('vspeed-display');
  const fuelDisplay = document.getElementById('fuel-display');
  const scoreDisplay = document.getElementById('score-display');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const landingClearOverlay = document.getElementById('landing-clear-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const nextLandingBtn = document.getElementById('next-landing-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const leftBtn = document.getElementById('thrust-left-btn');
  const rightBtn = document.getElementById('thrust-right-btn');
  const mainThrustBtn = document.getElementById('main-thrust-btn');
  const finalScore = document.getElementById('final-score');
  const finalLandings = document.getElementById('final-landings');
  const padMultiplier = document.getElementById('pad-multiplier');
  const fuelBonus = document.getElementById('fuel-bonus');
  const landingScore = document.getElementById('landing-score');

  // Audio Synthesizer via Web Audio API
  let audioCtx = null;
  let soundEnabled = true;
  try {
    const stored = localStorage.getItem('neon-lander-sound');
    soundEnabled = stored !== 'false';
  } catch (_) {}

  let rafId = null;
  let lastTime = performance.now();

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

      if (type === 'thrust') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'crash') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.48);
      } else if (type === 'touchdown') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.16, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.22);
        });
      }
    } catch (_) {}
  }

  // Game Constants & State
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GRAVITY = 0.024;
  const THRUST_POWER = 0.062;
  const ROTATE_SPEED = 0.045;
  const MAX_SAFE_VSPEED = 1.45;
  const MAX_SAFE_HSPEED = 0.95;
  const MAX_SAFE_ANGLE = 0.22; // ~12 degrees

  let gameState = 'ready'; // ready, flying, landed, crashed
  let score = 0;
  let landingsCount = 0;

  // Lander Entity
  let lander = {
    x: 80,
    y: 60,
    vx: 1.2,
    vy: 0,
    angle: 0, // 0 = pointing straight up
    fuel: 100,
    width: 20,
    height: 22
  };

  // Controls
  const keys = { main: false, left: false, right: false };

  // Terrain & Landing Pads
  let terrainPoints = [];
  let landingPads = [];
  let exhaustParticles = [];
  let explosionParticles = [];

  function generateTerrain() {
    terrainPoints = [];
    landingPads = [];

    // Define terrain segments with 3 landing zones
    // Pad 1 (wide, 1x): x 110 to 180
    // Pad 2 (medium, 2x): x 270 to 330
    // Pad 3 (narrow, 3x): x 430 to 470
    landingPads = [
      { x1: 110, x2: 180, y: 350, multiplier: 1, label: '1X' },
      { x1: 270, x2: 325, y: 320, multiplier: 2, label: '2X' },
      { x1: 435, x2: 475, y: 290, multiplier: 3, label: '3X' }
    ];

    terrainPoints = [
      { x: 0, y: 370 },
      { x: 50, y: 340 },
      { x: 90, y: 380 },
      // Pad 1
      { x: 110, y: 350 },
      { x: 180, y: 350 },
      // Mountain 1
      { x: 215, y: 250 },
      { x: 250, y: 340 },
      // Pad 2
      { x: 270, y: 320 },
      { x: 325, y: 320 },
      // Ridge
      { x: 360, y: 375 },
      { x: 400, y: 310 },
      // Pad 3
      { x: 435, y: 290 },
      { x: 475, y: 290 },
      // Crater
      { x: 510, y: 390 },
      { x: WIDTH, y: 360 }
    ];
  }

  function resetFlight() {
    lander.x = Math.random() * (WIDTH - 250) + 60;
    lander.y = 50;
    lander.vx = (Math.random() * 0.8 + 0.4) * (Math.random() > 0.5 ? 1 : -1);
    lander.vy = 0.2;
    lander.angle = 0;
    lander.fuel = 100;
    exhaustParticles = [];
    explosionParticles = [];
    generateTerrain();

    gameState = 'flying';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    landingClearOverlay.classList.add('hidden');
    updateHUD();
  }

  function spawnExhaust() {
    const angle = lander.angle;
    // Bottom nozzle position
    const bottomX = lander.x - Math.sin(angle) * (lander.height / 2);
    const bottomY = lander.y + Math.cos(angle) * (lander.height / 2);

    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.4;
      const speed = Math.random() * 2.5 + 2.5;
      exhaustParticles.push({
        x: bottomX,
        y: bottomY,
        vx: lander.vx - Math.sin(angle + spread) * speed,
        vy: lander.vy + Math.cos(angle + spread) * speed,
        radius: Math.random() * 3 + 2,
        alpha: 1,
        color: Math.random() > 0.4 ? '#ffaa00' : '#ff0077',
        decay: Math.random() * 0.05 + 0.03
      });
    }
  }

  function spawnExplosion(x, y) {
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      explosionParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3.5 + 1.5,
        alpha: 1,
        color: Math.random() > 0.5 ? '#ff0077' : '#ffaa00',
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  function getTerrainHeightAt(x) {
    for (let i = 0; i < terrainPoints.length - 1; i++) {
      const p1 = terrainPoints[i];
      const p2 = terrainPoints[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const dx = p2.x - p1.x;
        if (dx === 0) return p1.y;
        const t = (x - p1.x) / dx;
        return p1.y + t * (p2.y - p1.y);
      }
    }
    return HEIGHT;
  }

  function checkTouchdown() {
    const cosA = Math.cos(lander.angle);
    const sinA = Math.sin(lander.angle);

    // Left and right landing foot positions in world coordinates
    const leftFootX = lander.x - (lander.width / 2 + 4) * cosA - (lander.height / 2) * -sinA;
    const leftFootY = lander.y - (lander.width / 2 + 4) * sinA + (lander.height / 2) * cosA;

    const rightFootX = lander.x + (lander.width / 2 + 4) * cosA - (lander.height / 2) * -sinA;
    const rightFootY = lander.y + (lander.width / 2 + 4) * sinA + (lander.height / 2) * cosA;

    const centerFootY = lander.y + (lander.height / 2) * cosA;

    // Check if both feet contact the same flat landing pad
    for (let pad of landingPads) {
      const leftOnPad = leftFootX >= pad.x1 - 4 && leftFootX <= pad.x2 + 4;
      const rightOnPad = rightFootX >= pad.x1 - 4 && rightFootX <= pad.x2 + 4;
      const centerTouching = centerFootY >= pad.y - 2 && centerFootY <= pad.y + 8;
      const feetTouching = (leftFootY >= pad.y - 4 && leftFootY <= pad.y + 8) || (rightFootY >= pad.y - 4 && rightFootY <= pad.y + 8);

      if ((leftOnPad || rightOnPad) && (centerTouching || feetTouching)) {
        if (leftOnPad && rightOnPad) {
          const absVspeed = Math.abs(lander.vy);
          const absHspeed = Math.abs(lander.vx);
          const absAngle = Math.abs(lander.angle);

          if (absVspeed <= MAX_SAFE_VSPEED && absHspeed <= MAX_SAFE_HSPEED && absAngle <= MAX_SAFE_ANGLE) {
            // Touchdown Success!
            gameState = 'landed';
            landingsCount++;
            const pointsFromPad = 150 * pad.multiplier;
            const pointsFromFuel = Math.floor(lander.fuel * 2.5);
            const totalGain = pointsFromPad + pointsFromFuel;
            score += totalGain;

            playSound('touchdown');
            updateHUD();

            padMultiplier.textContent = `${pad.multiplier}x`;
            fuelBonus.textContent = `+${pointsFromFuel}`;
            landingScore.textContent = `+${totalGain}`;
            landingClearOverlay.classList.remove('hidden');

            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'ARCADEVERSE_GAME_SCORE',
                  score,
                  landings: landingsCount,
                  fuelRemaining: Math.floor(lander.fuel)
                }, '*');
              }
            } catch (_) {}
            return;
          } else {
            // Crash due to bad landing telemetry
            triggerCrash(
              absVspeed > MAX_SAFE_VSPEED ? 'Touchdown velocity was too fast!' :
              absAngle > MAX_SAFE_ANGLE ? 'Probe was tilted at excessive angle!' :
              'Horizontal drift velocity too high!'
            );
            return;
          }
        } else {
          // One leg on pad, one hanging off/uneven pad crash
          triggerCrash('Lander missed pad boundary with outer landing leg!');
          return;
        }
      }
    }

    // Check terrain collision for left leg, center, and right leg
    const samplePoints = [
      { x: leftFootX, y: leftFootY, name: 'Left landing leg' },
      { x: lander.x, y: centerFootY, name: 'Lander hull' },
      { x: rightFootX, y: rightFootY, name: 'Right landing leg' }
    ];

    for (let sample of samplePoints) {
      const groundY = getTerrainHeightAt(sample.x);
      if (sample.y >= groundY - 2) {
        triggerCrash(`${sample.name} impacted jagged lunar crags!`);
        return;
      }
    }

    // Check boundary limits
    if (lander.x < 10 || lander.x > WIDTH - 10 || lander.y < 0) {
      triggerCrash('Probe lost out of telemetry operational boundary!');
    }
  }

  function triggerCrash(reason) {
    gameState = 'crashed';
    playSound('crash');
    spawnExplosion(lander.x, lander.y);
    document.getElementById('gameover-reason').textContent = reason;
    finalScore.textContent = score;
    finalLandings.textContent = landingsCount;
    gameoverOverlay.classList.remove('hidden');

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_OVER',
          score,
          details: {
            score,
            landings: landingsCount,
            reason
          }
        }, '*');
      }
    } catch (_) {}
  }

  function update(dt = 1) {
    if (gameState !== 'flying') return;

    // Apply Gravity
    lander.vy += GRAVITY * dt;

    // Attitude Rotation
    if (keys.left) lander.angle -= ROTATE_SPEED * dt;
    if (keys.right) lander.angle += ROTATE_SPEED * dt;

    // Main Thruster
    if (keys.main && lander.fuel > 0) {
      lander.vx += Math.sin(lander.angle) * THRUST_POWER * dt;
      lander.vy -= Math.cos(lander.angle) * THRUST_POWER * dt;
      lander.fuel = Math.max(0, lander.fuel - 0.22 * dt);
      spawnExhaust();
      playSound('thrust');
    }

    // Apply velocity
    lander.x += lander.vx * dt;
    lander.y += lander.vy * dt;

    // Update exhaust particles
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
      const p = exhaustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) exhaustParticles.splice(i, 1);
    }

    // Update explosion particles
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) explosionParticles.splice(i, 1);
    }

    // Check Touchdown / Crash
    checkTouchdown();
    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Starfield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 35; i++) {
      const sx = (i * 73 + 12) % WIDTH;
      const sy = (i * 47 + 5) % (HEIGHT - 120);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Draw Terrain
    ctx.beginPath();
    ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y);
    for (let i = 1; i < terrainPoints.length; i++) {
      ctx.lineTo(terrainPoints[i].x, terrainPoints[i].y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();

    ctx.fillStyle = '#060d1a';
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Highlighted Landing Pads
    for (let pad of landingPads) {
      ctx.strokeStyle = pad.multiplier === 3 ? '#ff0077' : pad.multiplier === 2 ? '#ffaa00' : '#00ff88';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pad.x1, pad.y);
      ctx.lineTo(pad.x2, pad.y);
      ctx.stroke();

      // Pad text
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '700 11px "Space Grotesk", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pad.label, (pad.x1 + pad.x2) / 2, pad.y + 16);
    }

    // Draw Exhaust
    for (let p of exhaustParticles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Lander (if alive)
    if (gameState === 'flying' || gameState === 'landed') {
      ctx.save();
      ctx.translate(lander.x, lander.y);
      ctx.rotate(lander.angle);

      // Main module body
      ctx.fillStyle = '#ffaa00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -lander.height / 2);
      ctx.lineTo(lander.width / 2, lander.height / 4);
      ctx.lineTo(-lander.width / 2, lander.height / 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cockpit window
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(0, -lander.height / 6, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Landing legs
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Left leg
      ctx.moveTo(-lander.width / 2, lander.height / 4);
      ctx.lineTo(-lander.width / 2 - 4, lander.height / 2);
      // Right leg
      ctx.moveTo(lander.width / 2, lander.height / 4);
      ctx.lineTo(lander.width / 2 + 4, lander.height / 2);
      ctx.stroke();

      ctx.restore();
    }

    // Draw Explosions
    for (let p of explosionParticles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateHUD() {
    const alt = Math.max(0, Math.floor(HEIGHT - (lander.y + lander.height / 2)));
    altDisplay.textContent = `${alt}m`;

    const vSpeed = (lander.vy * 10).toFixed(1);
    vspeedDisplay.textContent = `${vSpeed} m/s`;
    if (Math.abs(lander.vy) > MAX_SAFE_VSPEED) {
      vspeedDisplay.classList.remove('speed-safe');
      vspeedDisplay.classList.add('speed-danger');
    } else {
      vspeedDisplay.classList.remove('speed-danger');
      vspeedDisplay.classList.add('speed-safe');
    }

    fuelDisplay.textContent = `${Math.floor(lander.fuel)}%`;
    scoreDisplay.textContent = score;
  }

  function gameLoop(timestamp = performance.now()) {
    const deltaMs = Math.min(100, timestamp - lastTime);
    lastTime = timestamp;
    const dt = deltaMs / 16.667;

    update(dt);
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  // Event Listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      keys.main = true;
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      keys.main = false;
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = false;
    }
  });

  // Mobile Touch Hold Setup
  const setupFlightTouch = (btn, actionKey) => {
    const press = (e) => {
      e.preventDefault();
      keys[actionKey] = true;
    };
    const release = (e) => {
      e.preventDefault();
      keys[actionKey] = false;
    };
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
  };

  setupFlightTouch(leftBtn, 'left');
  setupFlightTouch(rightBtn, 'right');
  setupFlightTouch(mainThrustBtn, 'main');

  startBtn.addEventListener('click', () => {
    initAudio();
    score = 0;
    landingsCount = 0;
    resetFlight();
  });

  restartBtn.addEventListener('click', () => {
    score = 0;
    landingsCount = 0;
    resetFlight();
  });

  nextLandingBtn.addEventListener('click', () => {
    resetFlight();
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem('neon-lander-sound', soundEnabled.toString());
    } catch (_) {}
    updateSoundUI();
    if (soundEnabled) playSound('thrust');
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Lifecycle & Messages
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'flying') {
      keys.main = false;
      keys.left = false;
      keys.right = false;
    }
  });

  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    const type = event.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      if (gameState === 'flying') {
        keys.main = false;
        keys.left = false;
        keys.right = false;
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
  generateTerrain();
  gameLoop();
})();
