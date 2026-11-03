(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const scoreDisplay = document.getElementById('score-val');
  const waveDisplay = document.getElementById('wave-val');
  const healthDisplay = document.getElementById('health-val');
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
  const touchLeft = document.getElementById('touch-left');
  const touchRight = document.getElementById('touch-right');

  // Audio Synth (Zero-dependency Web Audio API)
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
  let score = 0;
  let wave = 1;
  let coreHealth = 100;
  let bestScore = parseInt(localStorage.getItem('cyber_orbit_best') || '0', 10);
  bestDisplay.textContent = bestScore;

  // Geometry
  const center = { x: 300, y: 300 };
  const coreRadius = 36;
  const orbitRadius = 160;
  let shieldAngle = 0;
  const shieldArc = Math.PI * 0.45; // 81 degrees
  let rotationSpeed = 0.08;

  // Key tracking
  const keys = { left: false, right: false };

  // Game entities
  let meteors = [];
  let particles = [];
  let lastSpawn = 0;
  let spawnInterval = 1400;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = 600;
    canvas.height = 600;
  }
  resizeCanvas();

  function spawnEntity() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 340;
    const isHealthPack = Math.random() < 0.15;
    const speed = 1.6 + wave * 0.25 + (Math.random() * 0.6);

    meteors.push({
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance,
      angle: angle,
      speed: speed,
      radius: isHealthPack ? 10 : 8 + Math.random() * 4,
      isHealth: isHealthPack,
      color: isHealthPack ? '#38bdf8' : (Math.random() > 0.3 ? '#f97316' : '#ef4444')
    });
  }

  function createParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pSpeed = 1 + Math.random() * 4;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        color: color,
        life: 1,
        decay: 0.03 + Math.random() * 0.03,
        size: 2 + Math.random() * 3
      });
    }
  }

  function resetGame() {
    score = 0;
    wave = 1;
    coreHealth = 100;
    meteors = [];
    particles = [];
    shieldAngle = 0;
    spawnInterval = 1400;
    updateHUD();
    gameoverOverlay.classList.remove('active');
    startOverlay.classList.remove('active');
    isRunning = true;
    lastSpawn = performance.now();
  }

  function updateHUD() {
    scoreDisplay.textContent = score;
    waveDisplay.textContent = wave;
    healthDisplay.textContent = `${coreHealth}%`;
    healthDisplay.style.color = coreHealth > 50 ? '#00f5ff' : (coreHealth > 25 ? '#f59e0b' : '#ef4444');
  }

  function checkDeflection(meteor) {
    const dx = meteor.x - center.x;
    const dy = meteor.y - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Within shield ring distance
    if (Math.abs(dist - orbitRadius) < 16) {
      let mAngle = Math.atan2(dy, dx);
      if (mAngle < 0) mAngle += Math.PI * 2;

      let sStart = (shieldAngle - shieldArc / 2) % (Math.PI * 2);
      let sEnd = (shieldAngle + shieldArc / 2) % (Math.PI * 2);
      if (sStart < 0) sStart += Math.PI * 2;
      if (sEnd < 0) sEnd += Math.PI * 2;

      let isHit = false;
      if (sStart <= sEnd) {
        isHit = mAngle >= sStart && mAngle <= sEnd;
      } else {
        isHit = mAngle >= sStart || mAngle <= sEnd;
      }

      // Opposite auxiliary shield
      let oppAngle = (shieldAngle + Math.PI) % (Math.PI * 2);
      let oStart = (oppAngle - shieldArc / 3) % (Math.PI * 2);
      let oEnd = (oppAngle + shieldArc / 3) % (Math.PI * 2);
      if (oStart < 0) oStart += Math.PI * 2;
      if (oEnd < 0) oEnd += Math.PI * 2;

      let isHitOpp = false;
      if (oStart <= oEnd) {
        isHitOpp = mAngle >= oStart && mAngle <= oEnd;
      } else {
        isHitOpp = mAngle >= oStart || mAngle <= oEnd;
      }

      if (isHit || isHitOpp) {
        createParticles(meteor.x, meteor.y, '#00f5ff', 16);
        playTone(660, 'triangle', 0.12, 0.2);
        score += 25;
        if (score % 200 === 0) {
          wave++;
          spawnInterval = Math.max(500, spawnInterval - 100);
          playTone(880, 'sine', 0.25, 0.25);
        }
        updateHUD();
        return true;
      }
    }
    return false;
  }

  function gameOver() {
    isRunning = false;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('cyber_orbit_best', bestScore);
      bestDisplay.textContent = bestScore;
    }
    gameoverStats.textContent = `Score: ${score} • Wave: ${wave} • Best: ${bestScore}`;
    gameoverOverlay.classList.add('active');
    playTone(180, 'sawtooth', 0.4, 0.3);
  }

  function update(delta) {
    if (!isRunning) return;

    // Shield rotation
    if (keys.left) shieldAngle -= rotationSpeed;
    if (keys.right) shieldAngle += rotationSpeed;

    // Keep angle positive
    shieldAngle = (shieldAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    // Spawning
    if (performance.now() - lastSpawn > spawnInterval) {
      spawnEntity();
      lastSpawn = performance.now();
    }

    // Update meteors
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      const toCenterX = center.x - m.x;
      const toCenterY = center.y - m.y;
      const dist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

      m.x += (toCenterX / dist) * m.speed;
      m.y += (toCenterY / dist) * m.speed;

      // Check Shield Collision
      if (!m.isHealth && checkDeflection(m)) {
        meteors.splice(i, 1);
        continue;
      }

      // Check Core Impact
      if (dist <= coreRadius + m.radius) {
        if (m.isHealth) {
          coreHealth = Math.min(100, coreHealth + 15);
          createParticles(center.x, center.y, '#38bdf8', 20);
          playTone(520, 'sine', 0.2, 0.2);
        } else {
          coreHealth = Math.max(0, coreHealth - 20);
          createParticles(center.x, center.y, '#ef4444', 24);
          playTone(140, 'square', 0.2, 0.25);
        }
        updateHUD();
        meteors.splice(i, 1);

        if (coreHealth <= 0) {
          gameOver();
          return;
        }
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
    ctx.clearRect(0, 0, 600, 600);

    // Radar/Orbit background guides
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center.x, center.y, orbitRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Central Core Pulse
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
    const radGrd = ctx.createRadialGradient(center.x, center.y, 4, center.x, center.y, coreRadius * pulse);
    radGrd.addColorStop(0, '#00f5ff');
    radGrd.addColorStop(0.7, '#1e40af');
    radGrd.addColorStop(1, 'rgba(30, 64, 175, 0)');

    ctx.fillStyle = radGrd;
    ctx.beginPath();
    ctx.arc(center.x, center.y, coreRadius * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, coreRadius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // Primary Shield Arc
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(center.x, center.y, orbitRadius, shieldAngle - shieldArc / 2, shieldAngle + shieldArc / 2);
    ctx.stroke();

    // Secondary Minor Arc
    const opp = (shieldAngle + Math.PI) % (Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, orbitRadius, opp - shieldArc / 3, opp + shieldArc / 3);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Meteors
    meteors.forEach(m => {
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
    });
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

  // Keyboard handlers
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
  });

  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  // Touch / Button listeners
  touchLeft.addEventListener('pointerdown', () => { initAudio(); keys.left = true; });
  touchLeft.addEventListener('pointerup', () => { keys.left = false; });
  touchLeft.addEventListener('pointerleave', () => { keys.left = false; });

  touchRight.addEventListener('pointerdown', () => { initAudio(); keys.right = true; });
  touchRight.addEventListener('pointerup', () => { keys.right = false; });
  touchRight.addEventListener('pointerleave', () => { keys.right = false; });

  // Mouse / Touch drag on canvas to orient shield directly
  let isDragging = false;
  function handlePointer(e) {
    if (!isRunning) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX || !clientY) return;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    shieldAngle = Math.atan2(y - center.y, x - center.x);
  }

  canvas.addEventListener('pointerdown', e => {
    isDragging = true;
    initAudio();
    handlePointer(e);
  });
  window.addEventListener('pointermove', e => {
    if (isDragging) handlePointer(e);
  });
  window.addEventListener('pointerup', () => { isDragging = false; });

  // UI buttons
  startBtn.addEventListener('click', () => {
    initAudio();
    resetGame();
  });

  restartBtn.addEventListener('click', () => {
    initAudio();
    resetGame();
  });

  rulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('active');
  });

  closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.remove('active');
  });

  rulesConfirmBtn.addEventListener('click', () => {
    rulesModal.classList.remove('active');
  });

  // Start animation loop
  render();
  loop();
})();
