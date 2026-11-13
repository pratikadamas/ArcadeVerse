/* Cyber Sub Abyss - game.js */
(function() {
  'use strict';

  // Sound Engine
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.activeNodes = new Set();
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
    trackNode(osc) {
      if (!this.activeNodes) this.activeNodes = new Set();
      this.activeNodes.add(osc);
      osc.onended = () => {
        if (this.activeNodes) this.activeNodes.delete(osc);
      };
      return osc;
    }
    stopAll() {
      if (this.activeNodes) {
        this.activeNodes.forEach(node => {
          try {
            node.stop();
            node.disconnect();
          } catch (_) {}
        });
        this.activeNodes.clear();
      }
    }
    playTone(freq, type, duration, vol = 0.1) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        this.trackNode(osc);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }
    thrust() {
      this.playTone(80, 'sine', 0.1, 0.05);
    }
    crystal() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.exponentialRampToValueAtTime(1174, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        this.trackNode(osc);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}
    }
    oxygen() {
      this.playTone(440, 'sine', 0.25, 0.1);
    }
    hit() {
      this.playTone(110, 'sawtooth', 0.3, 0.2);
    }
    sonar() {
      this.playTone(880, 'sine', 0.4, 0.08);
    }
    gameOver() {
      this.playTone(60, 'sawtooth', 0.6, 0.25);
    }
  }

  const sfx = new SoundFX();

  // DOM Elements
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const depthEl = document.getElementById('statDepth');
  const scoreEl = document.getElementById('statScore');
  const oxygenEl = document.getElementById('statOxygen');
  const hullEl = document.getElementById('statHull');
  const highDepthEl = document.getElementById('statHighDepth');
  const sonarStatusEl = document.getElementById('sonarStatus');

  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnResume = document.getElementById('btnResume');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  const finalDepthEl = document.getElementById('finalDepth');
  const finalCrystalsEl = document.getElementById('finalCrystals');
  const finalScoreEl = document.getElementById('finalScore');
  const gameOverTitle = document.getElementById('gameOverTitle');
  const gameOverDesc = document.getElementById('gameOverDesc');

  // Virtual Controls
  const btnUp = document.getElementById('btnUp');
  const btnDown = document.getElementById('btnDown');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnSonar = document.getElementById('btnSonar');

  // Game state
  let isRunning = false;
  let isPaused = false;
  let animFrameId = null;

  let depth = 0;
  let score = 0;
  let crystalsCollected = 0;
  let oxygen = 100;
  let hull = 100;
  let highDepth = parseInt(localStorage.getItem('cyber_sub_highdepth') || '0', 10);
  highDepthEl.textContent = `${highDepth}m`;

  let sonarCooldown = 0;
  let sonarWaveRadius = 0;
  let sonarActive = false;

  // Submarine physics
  const sub = {
    x: 320,
    y: 120,
    width: 44,
    height: 24,
    vx: 0,
    vy: 0,
    facing: 1, // 1 right, -1 left
    engineParticles: []
  };

  // Keyboard input state
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    sonar: false
  };

  // World objects
  let terrainSlices = [];
  let pickups = []; // crystals, oxygen pods
  let vents = [];   // hydrothermal vents shooting bubbles/debris
  let bubbles = [];

  function resetGame() {
    depth = 0;
    score = 0;
    crystalsCollected = 0;
    oxygen = 100;
    hull = 100;
    sonarCooldown = 0;
    sonarActive = false;
    sonarWaveRadius = 0;

    sub.x = canvas.width / 2;
    sub.y = 100;
    sub.vx = 0;
    sub.vy = 0;
    sub.facing = 1;
    sub.engineParticles = [];

    terrainSlices = [];
    pickups = [];
    vents = [];
    bubbles = [];

    // Initialize terrain
    const totalSlices = Math.ceil(canvas.height / 20) + 15;
    for (let i = 0; i < totalSlices; i++) {
      terrainSlices.push(generateSlice(i * 20));
    }

    updateUI();
  }

  function generateSlice(yPos) {
    const minCorridorWidth = Math.max(160, 360 - (depth * 0.1));
    const centerX = canvas.width / 2 + Math.sin(yPos * 0.01 + depth * 0.005) * (canvas.width * 0.25);
    const leftWall = Math.max(20, centerX - minCorridorWidth / 2);
    const rightWall = Math.min(canvas.width - 20, centerX + minCorridorWidth / 2);

    return {
      y: yPos,
      left: leftWall,
      right: rightWall
    };
  }

  function spawnObjects() {
    // Random crystals or oxygen pods
    if (Math.random() < 0.035) {
      const type = Math.random() < 0.28 ? 'oxygen' : 'crystal';
      pickups.push({
        x: 60 + Math.random() * (canvas.width - 120),
        y: canvas.height + 20,
        type: type,
        radius: type === 'oxygen' ? 14 : 10,
        pulse: 0
      });
    }

    // Random hydrothermal vents
    if (Math.random() < 0.015 && vents.length < 4) {
      vents.push({
        x: 80 + Math.random() * (canvas.width - 160),
        y: canvas.height + 30,
        width: 32,
        height: 20,
        eruptTimer: Math.random() * 80
      });
    }
  }

  function triggerSonar() {
    if (sonarCooldown <= 0) {
      sonarCooldown = 300; // 5 seconds
      sonarActive = true;
      sonarWaveRadius = 10;
      sfx.sonar();
    }
  }

  function update() {
    if (!isRunning || isPaused) return;

    // Submarine controls & physics
    const accel = 0.35;
    const friction = 0.94;

    if (keys.up) {
      sub.vy -= accel;
      sfx.thrust();
    }
    if (keys.down) {
      sub.vy += accel;
    }
    if (keys.left) {
      sub.vx -= accel;
      sub.facing = -1;
      sfx.thrust();
    }
    if (keys.right) {
      sub.vx += accel;
      sub.facing = 1;
      sfx.thrust();
    }
    if (keys.sonar) {
      triggerSonar();
    }

    // Passive gravity sink
    sub.vy += 0.04;

    sub.vx *= friction;
    sub.vy *= friction;

    sub.x += sub.vx;
    sub.y += sub.vy;

    // Depth scroll speed based on descent velocity and base descent
    const descentSpeed = Math.max(1.2, 1.8 + (sub.vy > 0 ? sub.vy * 0.8 : 0));
    depth += Math.round(descentSpeed * 0.6);
    score += Math.round(descentSpeed * 0.2);

    // Keep sub vertically contained in middle screen
    if (sub.y < 60) sub.y = 60;
    if (sub.y > canvas.height - 80) sub.y = canvas.height - 80;

    // Deplete oxygen gradually
    oxygen -= 0.035;
    if (oxygen <= 0) {
      oxygen = 0;
      endGame('Oxygen Exhausted', 'Your life support failed in the abyssal trench.');
      return;
    }

    // Engine bubble particles
    if (Math.abs(sub.vx) > 0.4 || Math.abs(sub.vy) > 0.4) {
      sub.engineParticles.push({
        x: sub.facing === 1 ? sub.x - 20 : sub.x + 20,
        y: sub.y + 4 + (Math.random() - 0.5) * 6,
        r: Math.random() * 3 + 1,
        life: 25
      });
    }

    for (let i = sub.engineParticles.length - 1; i >= 0; i--) {
      const p = sub.engineParticles[i];
      p.life--;
      p.y -= 0.8;
      p.x += (Math.random() - 0.5) * 1;
      if (p.life <= 0) sub.engineParticles.splice(i, 1);
    }

    // Update sonar
    if (sonarActive) {
      sonarWaveRadius += 6;
      if (sonarWaveRadius > 350) {
        sonarActive = false;
      }
    }
    if (sonarCooldown > 0) {
      sonarCooldown--;
    }

    // Terrain scroll & update
    for (let i = 0; i < terrainSlices.length; i++) {
      terrainSlices[i].y -= descentSpeed;
    }
    while (terrainSlices.length > 0 && terrainSlices[0].y < -40) {
      terrainSlices.shift();
      const lastSlice = terrainSlices[terrainSlices.length - 1];
      terrainSlices.push(generateSlice(lastSlice ? lastSlice.y + 20 : canvas.height));
    }

    // Wall collision
    const curSlice = terrainSlices.find(s => Math.abs(s.y - sub.y) < 15);
    if (curSlice) {
      if (sub.x - sub.width / 2 < curSlice.left) {
        sub.x = curSlice.left + sub.width / 2;
        sub.vx = 2.5;
        damageHull(6);
      } else if (sub.x + sub.width / 2 > curSlice.right) {
        sub.x = curSlice.right - sub.width / 2;
        sub.vx = -2.5;
        damageHull(6);
      }
    }

    // Pickups update & collection
    spawnObjects();
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y -= descentSpeed;
      p.pulse += 0.08;

      // Distance to sub
      const dx = p.x - sub.x;
      const dy = p.y - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < p.radius + 18) {
        if (p.type === 'crystal') {
          score += 150;
          crystalsCollected++;
          sfx.crystal();
        } else if (p.type === 'oxygen') {
          oxygen = Math.min(100, oxygen + 25);
          sfx.oxygen();
        }
        pickups.splice(i, 1);
      } else if (p.y < -30) {
        pickups.splice(i, 1);
      }
    }

    // Vents & Hazards
    for (let i = vents.length - 1; i >= 0; i--) {
      const v = vents[i];
      v.y -= descentSpeed;
      v.eruptTimer++;

      if (v.eruptTimer > 100) {
        // Erupt magma blast bubble
        bubbles.push({
          x: v.x + (Math.random() - 0.5) * 16,
          y: v.y - 10,
          vy: -4.5,
          vx: (Math.random() - 0.5) * 1.5,
          radius: Math.random() * 8 + 6,
          hazard: true
        });
        if (v.eruptTimer > 160) v.eruptTimer = 0;
      }

      if (v.y < -50) vents.splice(i, 1);
    }

    // Ambient/Hazard bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y += b.vy - descentSpeed * 0.4;
      b.x += b.vx;

      if (b.hazard) {
        const dx = b.x - sub.x;
        const dy = b.y - sub.y;
        if (Math.hypot(dx, dy) < b.radius + 16) {
          damageHull(12);
          bubbles.splice(i, 1);
          continue;
        }
      }

      if (b.y < -30) bubbles.splice(i, 1);
    }

    updateUI();
  }

  function damageHull(amt) {
    hull -= amt;
    sfx.hit();
    if (hull <= 0) {
      hull = 0;
      endGame('Hull Implosion', 'Catastrophic water pressure crushed the submarine.');
    }
  }

  function updateUI() {
    depthEl.textContent = `${depth}m`;
    scoreEl.textContent = score;
    oxygenEl.textContent = `${Math.ceil(oxygen)}%`;
    hullEl.textContent = `${Math.ceil(hull)}%`;

    if (sonarCooldown > 0) {
      sonarStatusEl.textContent = `CHARGING (${Math.ceil(sonarCooldown / 60)}s)`;
      sonarStatusEl.className = 'val warn';
    } else {
      sonarStatusEl.textContent = 'READY';
      sonarStatusEl.className = 'val pulse';
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep water abyss gradient
    const abyssGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const darkRatio = Math.min(1, depth / 2000);
    abyssGrad.addColorStop(0, `rgb(${Math.max(4, 10 - darkRatio * 8)}, ${Math.max(10, 24 - darkRatio * 18)}, ${Math.max(25, 45 - darkRatio * 30)})`);
    abyssGrad.addColorStop(1, '#020611');
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Abyss Cavern Walls
    if (terrainSlices.length > 1) {
      // Left Wall
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(terrainSlices[0].left, terrainSlices[0].y);
      for (let i = 1; i < terrainSlices.length; i++) {
        ctx.lineTo(terrainSlices[i].left, terrainSlices[i].y);
      }
      ctx.lineTo(0, canvas.height);
      ctx.closePath();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Right Wall
      ctx.beginPath();
      ctx.moveTo(canvas.width, 0);
      ctx.lineTo(terrainSlices[0].right, terrainSlices[0].y);
      for (let i = 1; i < terrainSlices.length; i++) {
        ctx.lineTo(terrainSlices[i].right, terrainSlices[i].y);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Vents
    for (const v of vents) {
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.fillRect(v.x - v.width / 2, v.y, v.width, v.height);
      // Vent glow
      ctx.fillStyle = v.eruptTimer > 100 ? '#ef4444' : '#f97316';
      ctx.beginPath();
      ctx.arc(v.x, v.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Pickups
    for (const p of pickups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.type === 'crystal') {
        ctx.rotate(p.pulse);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -p.radius);
        ctx.lineTo(p.radius * 0.7, 0);
        ctx.lineTo(0, p.radius);
        ctx.lineTo(-p.radius * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Oxygen Capsule
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#022c22';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('O2', 0, 0);
      }
      ctx.restore();
    }

    // Draw Hazard Bubbles
    for (const b of bubbles) {
      ctx.save();
      ctx.fillStyle = b.hazard ? 'rgba(239, 68, 68, 0.75)' : 'rgba(56, 189, 248, 0.4)';
      ctx.shadowColor = b.hazard ? '#f87171' : '#38bdf8';
      ctx.shadowBlur = b.hazard ? 15 : 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Submarine Engine Particles
    for (const p of sub.engineParticles) {
      ctx.save();
      ctx.fillStyle = `rgba(56, 189, 248, ${p.life / 25})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Sonar Pulse Wave
    if (sonarActive) {
      ctx.save();
      ctx.strokeStyle = `rgba(6, 182, 212, ${1 - sonarWaveRadius / 350})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sub.x, sub.y, sonarWaveRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Submarine
    ctx.save();
    ctx.translate(sub.x, sub.y);
    if (sub.facing === -1) ctx.scale(-1, 1);

    // Submarine Hull
    ctx.fillStyle = '#0284c7';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, sub.width / 2, sub.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Conning Tower
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(-6, -sub.height / 2 - 8, 12, 10);

    // Cockpit Porthole
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(sub.width / 4, -2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Front Searchlight Beam
    const lightGrad = ctx.createRadialGradient(sub.width / 2, 0, 2, sub.width / 2 + 120, 30, 160);
    lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    lightGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(sub.width / 2, -4);
    ctx.lineTo(sub.width / 2 + 140, -40);
    ctx.lineTo(sub.width / 2 + 140, 60);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function loop() {
    update();
    render();
    if (isRunning) {
      animFrameId = requestAnimationFrame(loop);
    }
  }

  function startGame() {
    sfx.init();
    sfx.stopAll();
    resetGame();
    isRunning = true;
    isPaused = false;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    animFrameId = requestAnimationFrame(loop);
  }

  function endGame(title, desc) {
    isRunning = false;
    sfx.stopAll();
    sfx.gameOver();
    if (animFrameId) cancelAnimationFrame(animFrameId);

    if (depth > highDepth) {
      highDepth = depth;
      localStorage.setItem('cyber_sub_highdepth', highDepth.toString());
      highDepthEl.textContent = `${highDepth}m`;
    }

    gameOverTitle.textContent = title;
    gameOverDesc.textContent = desc;
    finalDepthEl.textContent = `${depth}m`;
    finalCrystalsEl.textContent = crystalsCollected;
    finalScoreEl.textContent = score;

    gameOverScreen.classList.remove('hidden');
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

  // Keyboard Event Listeners
  window.addEventListener('keydown', (e) => {
    sfx.init();
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') {
      keys.up = true;
      e.preventDefault();
    }
    if (k === 'arrowdown' || k === 's') {
      keys.down = true;
      e.preventDefault();
    }
    if (k === 'arrowleft' || k === 'a') {
      keys.left = true;
      e.preventDefault();
    }
    if (k === 'arrowright' || k === 'd') {
      keys.right = true;
      e.preventDefault();
    }
    if (k === ' ' || k === 'f' || k === 'e') {
      keys.sonar = true;
      e.preventDefault();
    }
    if (k === 'p') {
      togglePause();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') keys.up = false;
    if (k === 'arrowdown' || k === 's') keys.down = false;
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    if (k === 'arrowright' || k === 'd') keys.right = false;
    if (k === ' ' || k === 'f' || k === 'e') keys.sonar = false;
  });

  // Touch & On-screen buttons
  function bindTouch(btn, keyProp) {
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      sfx.init();
      keys[keyProp] = true;
    };
    const end = (e) => {
      e.preventDefault();
      keys[keyProp] = false;
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
  }

  bindTouch(btnUp, 'up');
  bindTouch(btnDown, 'down');
  bindTouch(btnLeft, 'left');
  bindTouch(btnRight, 'right');

  if (btnSonar) {
    btnSonar.addEventListener('click', () => {
      sfx.init();
      triggerSonar();
    });
  }

  // UI Button Bindings
  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnResume.addEventListener('click', togglePause);
  btnPause.addEventListener('click', togglePause);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
  });
  btnCloseRules.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
  });

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    if (sfx.muted) {
      sfx.stopAll();
    }
    btnMute.classList.toggle('active', sfx.muted);
  });

  window.addEventListener('message', (e) => {
    if (e.data && (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE')) {
      sfx.stopAll();
    }
  });

})();
