(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const distDisplay = document.getElementById('dist-val');
  const cellsDisplay = document.getElementById('cells-val');
  const speedDisplay = document.getElementById('speed-val');
  const bestDisplay = document.getElementById('best-val');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverStats = document.getElementById('gameover-stats');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const rulesBtn = document.getElementById('how-to-play-btn');
  const closeRulesBtn = document.getElementById('close-rules');
  const rulesConfirmBtn = document.getElementById('rules-confirm-btn');
  const rulesModal = document.getElementById('rules-modal');
  const laneLeftBtn = document.getElementById('lane-left-btn');
  const laneMidBtn = document.getElementById('lane-mid-btn');
  const laneRightBtn = document.getElementById('lane-right-btn');

  // Audio Synth
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // State
  let isRunning = false;
  let distance = 0;
  let cellsCollected = 0;
  let warpFactor = 1;
  let bestDist = parseInt(localStorage.getItem('stellar_warp_best') || '0', 10);
  bestDisplay.textContent = `${bestDist} LY`;

  // Lanes (0: Left, 1: Center, 2: Right)
  const lanesX = [130, 300, 470];
  let currentLane = 1;
  let playerX = lanesX[1];
  const playerY = 560;

  // Starfield parallax
  let stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * 600,
      y: Math.random() * 700,
      speed: 2 + Math.random() * 6,
      size: 1 + Math.random() * 2
    });
  }

  // Obstacles & Cells
  let obstacles = [];
  let energyCells = [];
  let particles = [];
  let lastObstacleSpawn = 0;
  let lastCellSpawn = 0;

  function resetGame() {
    distance = 0;
    cellsCollected = 0;
    warpFactor = 1;
    currentLane = 1;
    playerX = lanesX[1];
    obstacles = [];
    energyCells = [];
    particles = [];
    updateHUD();
    gameoverOverlay.classList.remove('active');
    startOverlay.classList.remove('active');
    isRunning = true;
    lastObstacleSpawn = performance.now();
    lastCellSpawn = performance.now();
  }

  function updateHUD() {
    distDisplay.textContent = `${Math.floor(distance)} LY`;
    cellsDisplay.textContent = cellsCollected;
    speedDisplay.textContent = `WARP ${warpFactor}`;
  }

  function spawnObstacle() {
    const laneIndex = Math.floor(Math.random() * 3);
    obstacles.push({
      lane: laneIndex,
      x: lanesX[laneIndex],
      y: -50,
      width: 100,
      height: 24,
      color: '#f43f5e'
    });
  }

  function spawnEnergyCell() {
    const laneIndex = Math.floor(Math.random() * 3);
    energyCells.push({
      lane: laneIndex,
      x: lanesX[laneIndex],
      y: -50,
      radius: 12,
      color: '#fbbf24',
      pulse: 0
    });
  }

  function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
        size: 2 + Math.random() * 3
      });
    }
  }

  function gameOver() {
    isRunning = false;
    const finalDist = Math.floor(distance);
    if (finalDist > bestDist) {
      bestDist = finalDist;
      localStorage.setItem('stellar_warp_best', bestDist);
      bestDisplay.textContent = `${bestDist} LY`;
    }
    gameoverStats.textContent = `Distance: ${finalDist} LY • Energy Cells: ${cellsCollected}`;
    gameoverOverlay.classList.add('active');
    playTone(150, 'sawtooth', 0.45, 0.3);
  }

  function update() {
    if (!isRunning) return;

    // Smooth lane interpolation
    const targetX = lanesX[currentLane];
    playerX += (targetX - playerX) * 0.22;

    // Advance distance
    const baseSpeed = 5 + warpFactor * 1.5;
    distance += baseSpeed * 0.06;

    // Increase warp factor as distance increases
    warpFactor = 1 + Math.floor(distance / 150);
    updateHUD();

    // Starfield
    stars.forEach(s => {
      s.y += s.speed * (1 + warpFactor * 0.25);
      if (s.y > 700) {
        s.y = 0;
        s.x = Math.random() * 600;
      }
    });

    // Spawn hazards & cells
    const spawnRate = Math.max(750, 1500 - warpFactor * 120);
    if (performance.now() - lastObstacleSpawn > spawnRate) {
      spawnObstacle();
      lastObstacleSpawn = performance.now();
    }
    if (performance.now() - lastCellSpawn > 2200) {
      spawnEnergyCell();
      lastCellSpawn = performance.now();
    }

    // Update Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.y += baseSpeed;

      // Hit test with player
      if (
        obs.y + obs.height >= playerY - 24 &&
        obs.y <= playerY + 24 &&
        Math.abs(playerX - obs.x) < 48
      ) {
        createParticles(playerX, playerY, '#f43f5e', 24);
        gameOver();
        return;
      }

      if (obs.y > 720) {
        obstacles.splice(i, 1);
      }
    }

    // Update Energy Cells
    for (let i = energyCells.length - 1; i >= 0; i--) {
      const cell = energyCells[i];
      cell.y += baseSpeed;
      cell.pulse += 0.08;

      // Collection
      const dx = playerX - cell.x;
      const dy = playerY - cell.y;
      if (Math.sqrt(dx * dx + dy * dy) < 36) {
        cellsCollected++;
        distance += 15; // bonus distance leap
        createParticles(cell.x, cell.y, '#fbbf24', 16);
        playTone(740, 'triangle', 0.12, 0.2);
        energyCells.splice(i, 1);
        updateHUD();
        continue;
      }

      if (cell.y > 720) {
        energyCells.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, 600, 700);

    // Warp Grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(215, 0); ctx.lineTo(215, 700);
    ctx.moveTo(385, 0); ctx.lineTo(385, 700);
    ctx.stroke();

    // Stars
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
      ctx.globalAlpha = Math.min(1, s.speed / 6);
      ctx.fillRect(s.x, s.y, s.size, s.size * (1 + warpFactor * 0.4));
    });
    ctx.globalAlpha = 1.0;

    // Obstacles
    obstacles.forEach(o => {
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(o.x - o.width / 2, o.y, o.width, o.height, 6);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Energy Cells
    energyCells.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius + Math.sin(c.pulse) * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Player Vessel
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#60a5fa';

    // Ship Delta Wing
    ctx.beginPath();
    ctx.moveTo(playerX, playerY - 26);
    ctx.lineTo(playerX + 22, playerY + 20);
    ctx.lineTo(playerX, playerY + 12);
    ctx.lineTo(playerX - 22, playerY + 20);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(playerX, playerY - 4, 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thruster Trail
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(playerX - 8, playerY + 14);
    ctx.lineTo(playerX, playerY + 28 + Math.random() * 8);
    ctx.lineTo(playerX + 8, playerY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    requestAnimationFrame(render);
  }

  function loop() {
    update();
    requestAnimationFrame(loop);
  }

  // Controls
  function shiftLeft() {
    initAudio();
    if (currentLane > 0) {
      currentLane--;
      playTone(480, 'sine', 0.08, 0.15);
    }
  }

  function shiftRight() {
    initAudio();
    if (currentLane < 2) {
      currentLane++;
      playTone(560, 'sine', 0.08, 0.15);
    }
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') shiftLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') shiftRight();
  });

  laneLeftBtn.addEventListener('click', () => { currentLane = 0; playTone(440, 'sine', 0.08, 0.15); });
  laneMidBtn.addEventListener('click', () => { currentLane = 1; playTone(520, 'sine', 0.08, 0.15); });
  laneRightBtn.addEventListener('click', () => { currentLane = 2; playTone(600, 'sine', 0.08, 0.15); });

  // Direct touch on canvas
  canvas.addEventListener('pointerdown', e => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    if (x < 200) currentLane = 0;
    else if (x < 400) currentLane = 1;
    else currentLane = 2;
  });

  // UI buttons
  startBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  restartBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  rulesBtn.addEventListener('click', () => { rulesModal.classList.add('active'); });
  closeRulesBtn.addEventListener('click', () => { rulesModal.classList.remove('active'); });
  rulesConfirmBtn.addEventListener('click', () => { rulesModal.classList.remove('active'); });

  render();
  loop();
})();
