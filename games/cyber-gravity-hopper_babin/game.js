(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const scoreDisplay = document.getElementById('score-val');
  const gravDisplay = document.getElementById('grav-val');
  const orbsDisplay = document.getElementById('orbs-val');
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
  const invertBtn = document.getElementById('invert-btn');

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
  let score = 0;
  let orbs = 0;
  let bestScore = parseInt(localStorage.getItem('cyber_gravity_best') || '0', 10);
  bestDisplay.textContent = bestScore;

  // Physics
  const player = {
    x: 80,
    y: 380,
    width: 26,
    height: 32,
    vy: 0,
    gravity: 0.85,
    isGrounded: false
  };

  const FLOOR_Y = 410;
  const CEIL_Y = 40;

  let obstacles = [];
  let energyOrbs = [];
  let particles = [];
  let lastObstacle = 0;
  let lastOrb = 0;
  let gameSpeed = 4.5;

  function resetGame() {
    score = 0;
    orbs = 0;
    player.y = FLOOR_Y - player.height;
    player.vy = 0;
    player.gravity = 0.85;
    gameSpeed = 4.5;
    obstacles = [];
    energyOrbs = [];
    particles = [];
    updateHUD();
    gameoverOverlay.classList.remove('active');
    startOverlay.classList.remove('active');
    isRunning = true;
    lastObstacle = performance.now();
    lastOrb = performance.now();
  }

  function updateHUD() {
    scoreDisplay.textContent = Math.floor(score);
    orbsDisplay.textContent = orbs;
    gravDisplay.textContent = player.gravity > 0 ? 'DOWN (1G)' : 'UP (-1G)';
    gravDisplay.style.color = player.gravity > 0 ? '#10b981' : '#06b6d4';
  }

  function invertGravity() {
    if (!isRunning) return;
    initAudio();
    player.gravity = -player.gravity;
    playTone(player.gravity > 0 ? 380 : 540, 'triangle', 0.12, 0.2);
    updateHUD();
    createParticles(player.x + player.width / 2, player.y + player.height / 2, '#10b981', 8);
  }

  function spawnObstacle() {
    const isCeil = Math.random() > 0.5;
    const height = 40 + Math.random() * 30;
    obstacles.push({
      x: 620,
      y: isCeil ? CEIL_Y : FLOOR_Y - height,
      width: 24,
      height: height,
      isCeil: isCeil,
      color: '#ef4444'
    });
  }

  function spawnOrb() {
    const isCeil = Math.random() > 0.5;
    energyOrbs.push({
      x: 620,
      y: isCeil ? CEIL_Y + 40 : FLOOR_Y - 50,
      radius: 10,
      color: '#10b981'
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
    const finalScore = Math.floor(score);
    if (finalScore > bestScore) {
      bestScore = finalScore;
      localStorage.setItem('cyber_gravity_best', bestScore);
      bestDisplay.textContent = bestScore;
    }
    gameoverStats.textContent = `Score: ${finalScore} • Energy Orbs: ${orbs}`;
    gameoverOverlay.classList.add('active');
    playTone(160, 'sawtooth', 0.45, 0.3);
  }

  function update() {
    if (!isRunning) return;

    score += 0.15;
    gameSpeed += 0.0008;
    updateHUD();

    // Physics
    player.vy += player.gravity;
    player.y += player.vy;

    // Floor collision
    if (player.y >= FLOOR_Y - player.height) {
      player.y = FLOOR_Y - player.height;
      player.vy = 0;
      player.isGrounded = true;
    } else if (player.y <= CEIL_Y) {
      // Ceiling collision
      player.y = CEIL_Y;
      player.vy = 0;
      player.isGrounded = true;
    } else {
      player.isGrounded = false;
    }

    // Spawning
    if (performance.now() - lastObstacle > Math.max(900, 1800 - gameSpeed * 100)) {
      spawnObstacle();
      lastObstacle = performance.now();
    }
    if (performance.now() - lastOrb > 2400) {
      spawnOrb();
      lastOrb = performance.now();
    }

    // Update Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= gameSpeed;

      // AABB Hit Detection
      if (
        player.x < o.x + o.width &&
        player.x + player.width > o.x &&
        player.y < o.y + o.height &&
        player.y + player.height > o.y
      ) {
        createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ef4444', 24);
        gameOver();
        return;
      }

      if (o.x + o.width < 0) {
        obstacles.splice(i, 1);
      }
    }

    // Update Orbs
    for (let i = energyOrbs.length - 1; i >= 0; i--) {
      const orb = energyOrbs[i];
      orb.x -= gameSpeed;

      const dx = (player.x + player.width / 2) - orb.x;
      const dy = (player.y + player.height / 2) - orb.y;
      if (Math.sqrt(dx * dx + dy * dy) < 28) {
        orbs++;
        score += 50;
        createParticles(orb.x, orb.y, '#10b981', 14);
        playTone(720, 'sine', 0.1, 0.2);
        energyOrbs.splice(i, 1);
        updateHUD();
        continue;
      }

      if (orb.x < -20) {
        energyOrbs.splice(i, 1);
      }
    }

    // Particles
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
    ctx.clearRect(0, 0, 600, 450);

    // Ceiling & Floor Platforms
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 600, CEIL_Y);
    ctx.fillRect(0, FLOOR_Y, 600, 450 - FLOOR_Y);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CEIL_Y); ctx.lineTo(600, CEIL_Y);
    ctx.moveTo(0, FLOOR_Y); ctx.lineTo(600, FLOOR_Y);
    ctx.stroke();

    // Obstacles (Spikes)
    obstacles.forEach(o => {
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      if (o.isCeil) {
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
    });
    ctx.shadowBlur = 0;

    // Orbs
    energyOrbs.forEach(orb => {
      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Player (Cyber Jumper Cube)
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.width, player.height, 6);
    ctx.fill();

    // Eye visor
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const eyeY = player.gravity > 0 ? player.y + 8 : player.y + player.height - 14;
    ctx.roundRect(player.x + 12, eyeY, 10, 6, 2);
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

  // Input Listeners
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      invertGravity();
    }
  });

  canvas.addEventListener('pointerdown', () => invertGravity());
  invertBtn.addEventListener('click', () => invertGravity());

  startBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  restartBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  rulesBtn.addEventListener('click', () => rulesModal.classList.add('active'));
  closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('active'));
  rulesConfirmBtn.addEventListener('click', () => rulesModal.classList.remove('active'));

  render();
  loop();
})();
