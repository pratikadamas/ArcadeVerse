(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const distDisplay = document.getElementById('dist-val');
  const speedDisplay = document.getElementById('speed-val');
  const nitroDisplay = document.getElementById('nitro-val');
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
  const steerLeftBtn = document.getElementById('steer-left-btn');
  const steerRightBtn = document.getElementById('steer-right-btn');
  const nitroBtn = document.getElementById('nitro-btn');

  // Audio Synth
  let audioCtx = null;
  const activeNodes = new Set();

  function trackNode(osc) {
    activeNodes.add(osc);
    osc.onended = () => {
      activeNodes.delete(osc);
    };
    return osc;
  }

  function stopAllAudio() {
    activeNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (_) {}
    });
    activeNodes.clear();
  }

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
      trackNode(osc);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // State
  let isRunning = false;
  let isPaused = false;
  let rafId = null;
  let lastTime = performance.now();
  let distance = 0;
  let speed = 120; // km/h
  let nitro = 100;
  let isNitroActive = false;
  let bestDist = 0;
  try { bestDist = parseInt(localStorage.getItem('synthwave_racer_best') || '0', 10); } catch (_) {}
  bestDisplay.textContent = `${bestDist} KM`;

  // Player Car
  const player = {
    x: 300,
    y: 560,
    width: 38,
    height: 64,
    vx: 0
  };

  const keys = { left: false, right: false, nitro: false };

  // Road geometry
  const roadLeft = 100;
  const roadRight = 500;
  const roadWidth = 400;

  let trafficCars = [];
  let batteries = [];
  let particles = [];
  let roadLines = [];
  for (let i = 0; i < 14; i++) {
    roadLines.push(i * 55);
  }

  let lastTrafficSpawn = 0;
  let lastBatterySpawn = 0;

  function resetGame() {
    stopAllAudio();
    distance = 0;
    speed = 120;
    nitro = 100;
    player.x = 300;
    player.vx = 0;
    trafficCars = [];
    batteries = [];
    particles = [];
    isNitroActive = false;
    updateHUD();
    gameoverOverlay.classList.remove('active');
    startOverlay.classList.remove('active');
    isRunning = true;
    isPaused = false;
    lastTrafficSpawn = performance.now();
    lastBatterySpawn = performance.now();
  }

  function updateHUD() {
    distDisplay.textContent = `${(distance / 10).toFixed(1)} KM`;
    speedDisplay.textContent = `${Math.floor(speed)} KM/H`;
    nitroDisplay.textContent = `${Math.floor(nitro)}%`;
    nitroDisplay.style.color = nitro > 30 ? '#06b6d4' : '#ef4444';
  }

  function spawnTraffic() {
    const lanes = [160, 250, 350, 440];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    const colors = ['#6366f1', '#eab308', '#14b8a6', '#f43f5e'];
    trafficCars.push({
      x: laneX,
      y: -80,
      width: 36,
      height: 60,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 40 + Math.random() * 30
    });
  }

  function spawnBattery() {
    const lanes = [160, 250, 350, 440];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    batteries.push({
      x: laneX,
      y: -50,
      radius: 12
    });
  }

  function createParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 4;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
        size: 2 + Math.random() * 3
      });
    }
  }

  function gameOver() {
    isRunning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    stopAllAudio();
    const finalDist = Math.floor(distance / 10);
    if (finalDist > bestDist) {
      bestDist = finalDist;
      try { localStorage.setItem('synthwave_racer_best', bestDist); } catch (_) {}
      bestDisplay.textContent = `${bestDist} KM`;
    }
    gameoverStats.textContent = `Distance: ${finalDist} KM - Max Speed: ${Math.floor(speed)} KM/H`;
    gameoverOverlay.classList.add('active');
    playTone(140, 'sawtooth', 0.5, 0.3);
    try {
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: finalDist }, '*');
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER' }, '*');
    } catch (_) {}
  }

  function update(dt) {
    if (!isRunning || isPaused) return;

    // Nitro Logic
    if ((keys.nitro || isNitroActive) && nitro > 0) {
      speed = Math.min(240, speed + 1.2 * dt);
      nitro = Math.max(0, nitro - 0.45 * dt);
      createParticles(player.x - 12, player.y + 32, '#06b6d4', 2);
      createParticles(player.x + 12, player.y + 32, '#06b6d4', 2);
    } else {
      speed = Math.max(120, speed - 0.8 * dt);
      nitro = Math.min(100, nitro + 0.05 * dt);
    }

    distance += speed * 0.003 * dt;
    updateHUD();

    // Steering
    if (keys.left) player.x -= 5.5 * dt;
    if (keys.right) player.x += 5.5 * dt;

    // Boundary constraints
    player.x = Math.max(roadLeft + 24, Math.min(roadRight - 24, player.x));

    // Road markings scroll
    const scrollDelta = speed * 0.08 * dt;
    for (let i = 0; i < roadLines.length; i++) {
      roadLines[i] += scrollDelta;
      if (roadLines[i] > 700) {
        roadLines[i] = -20;
      }
    }

    // Spawning
    if (performance.now() - lastTrafficSpawn > Math.max(900, 2000 - (speed - 120) * 8)) {
      spawnTraffic();
      lastTrafficSpawn = performance.now();
    }
    if (performance.now() - lastBatterySpawn > 3200) {
      spawnBattery();
      lastBatterySpawn = performance.now();
    }

    // Update Traffic
    for (let i = trafficCars.length - 1; i >= 0; i--) {
      const car = trafficCars[i];
      const relativeSpeed = (speed - car.speed) * 0.06 * dt;
      car.y += relativeSpeed;

      if (
        player.x - player.width / 2 < car.x + car.width / 2 &&
        player.x + player.width / 2 > car.x - car.width / 2 &&
        player.y - player.height / 2 < car.y + car.height / 2 &&
        player.y + player.height / 2 > car.y - car.height / 2
      ) {
        createParticles(player.x, player.y, '#ec4899', 30);
        gameOver();
        return;
      }

      if (car.y > 750 || car.y < -150) {
        trafficCars.splice(i, 1);
      }
    }

    // Update Batteries
    for (let i = batteries.length - 1; i >= 0; i--) {
      const b = batteries[i];
      b.y += speed * 0.06 * dt;

      const dx = player.x - b.x;
      const dy = player.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < 32) {
        nitro = Math.min(100, nitro + 30);
        createParticles(b.x, b.y, '#06b6d4', 16);
        playTone(680, 'sine', 0.12, 0.2);
        batteries.splice(i, 1);
        updateHUD();
        continue;
      }

      if (b.y > 750) {
        batteries.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, 600, 700);

    const skyGrd = ctx.createLinearGradient(0, 0, 0, 240);
    skyGrd.addColorStop(0, '#1e0533');
    skyGrd.addColorStop(1, '#07010f');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, 600, 240);

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(300, 150, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(roadLeft, 0, roadWidth, 700);

    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, 700);
    ctx.moveTo(roadRight, 0); ctx.lineTo(roadRight, 700);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    const dividerLanes = [200, 300, 400];
    dividerLanes.forEach(lx => {
      roadLines.forEach(ly => {
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + 28);
        ctx.stroke();
      });
    });

    batteries.forEach(b => {
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    trafficCars.forEach(car => {
      ctx.fillStyle = car.color;
      ctx.shadowColor = car.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(car.x - car.width / 2, car.y - car.height / 2, car.width, car.height, 6);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(car.x - car.width / 2 + 4, car.y + car.height / 2 - 6, 8, 4);
      ctx.fillRect(car.x + car.width / 2 - 12, car.y + car.height / 2 - 6, 8, 4);
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ec4899';
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(player.x - player.width / 2, player.y - player.height / 2, player.width, player.height, 8);
    ctx.fill();

    ctx.fillStyle = '#030712';
    ctx.fillRect(player.x - 12, player.y - 12, 24, 18);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(player.x - 14, player.y - player.height / 2 + 2, 7, 5);
    ctx.fillRect(player.x + 7, player.y - player.height / 2 + 2, 7, 5);
    ctx.shadowBlur = 0;

    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }

  function loop(timestamp) {
    if (timestamp === undefined) timestamp = performance.now();
    const deltaMs = Math.min(100, timestamp - lastTime);
    lastTime = timestamp;
    const dt = deltaMs / 16.667;
    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  // Keyboard Handlers
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      keys.nitro = true;
      initAudio();
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.nitro = false;
  });

  steerLeftBtn.addEventListener('pointerdown', () => { initAudio(); keys.left = true; });
  steerLeftBtn.addEventListener('pointerup', () => { keys.left = false; });
  steerLeftBtn.addEventListener('pointerleave', () => { keys.left = false; });

  steerRightBtn.addEventListener('pointerdown', () => { initAudio(); keys.right = true; });
  steerRightBtn.addEventListener('pointerup', () => { keys.right = false; });
  steerRightBtn.addEventListener('pointerleave', () => { keys.right = false; });

  nitroBtn.addEventListener('pointerdown', () => { initAudio(); isNitroActive = true; });
  nitroBtn.addEventListener('pointerup', () => { isNitroActive = false; });
  nitroBtn.addEventListener('pointerleave', () => { isNitroActive = false; });

  startBtn.addEventListener('click', () => { initAudio(); resetGame(); startLoop(); });
  restartBtn.addEventListener('click', () => { initAudio(); resetGame(); startLoop(); });
  rulesBtn.addEventListener('click', () => rulesModal.classList.add('active'));
  closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('active'));
  rulesConfirmBtn.addEventListener('click', () => rulesModal.classList.remove('active'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) isPaused = true;
    else if (!document.hidden && isPaused) isPaused = false;
  });

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const t = e.data.type;
    if (t === 'ARCADEVERSE_PAUSE') { isPaused = true; stopAllAudio(); }
    else if (t === 'ARCADEVERSE_RESUME') { isPaused = false; }
    else if (t === 'ARCADEVERSE_TEARDOWN') {
      isRunning = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      stopAllAudio();
    } else if (t === 'AV_RESIZE') {
      if (e.data.width && e.data.height) {
        canvas.width = e.data.width;
        canvas.height = e.data.height;
      }
    }
  });

  startLoop();
})();

