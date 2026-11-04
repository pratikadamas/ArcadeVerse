/* Neon Pong Smash - game.js */
(function() {
  'use strict';

  // Audio System using Web Audio API
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
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
    hit(pitch = 300) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (e) {}
    }
    wall() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      } catch (e) {}
    }
    scorePoint() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    }
    smash() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      } catch (e) {}
    }
    win() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554, 659, 880];
        notes.forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.1);
          gain.gain.setValueAtTime(0.15, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.25);
        });
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  // Canvas and Context
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const playerScoreEl = document.getElementById('playerScore');
  const aiScoreEl = document.getElementById('aiScore');
  const rallyCountEl = document.getElementById('rallyCount');
  const maxRallyEl = document.getElementById('maxRally');

  const startScreen = document.getElementById('startScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const matchResultTitle = document.getElementById('matchResultTitle');
  const finalScoreDisplay = document.getElementById('finalScoreDisplay');
  const finalMaxRally = document.getElementById('finalMaxRally');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnResume = document.getElementById('btnResume');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const rulesModal = document.getElementById('rulesModal');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  // Touch controls
  const btnMoveUp = document.getElementById('btnMoveUp');
  const btnMoveDown = document.getElementById('btnMoveDown');
  const btnSmash = document.getElementById('btnSmash');

  // Game Parameters
  const WINNING_SCORE = 7;
  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let playerScore = 0;
  let aiScore = 0;
  let rallyCount = 0;
  let maxRally = 0;

  // Paddles
  const PADDLE_WIDTH = 14;
  const PADDLE_HEIGHT = 80;
  const PLAYER_SPEED = 7;
  const AI_SPEED = 5.2;

  const player = {
    x: 30,
    y: canvas.height / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    vy: 0,
    color: '#00f0ff',
    turbo: false
  };

  const ai = {
    x: canvas.width - 30 - PADDLE_WIDTH,
    y: canvas.height / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: '#ec4899',
    reactionOffset: 0
  };

  // Ball
  const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 8,
    vx: 5,
    vy: 3,
    baseSpeed: 5,
    speed: 5,
    spin: 0,
    color: '#facc15',
    trail: []
  };

  // Visual particles
  let particles = [];

  // Keys
  const keys = {
    up: false,
    down: false,
    smash: false
  };

  function resetBall(servingPlayer) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = ball.baseSpeed;
    ball.spin = 0;
    ball.trail = [];

    const dir = servingPlayer === 1 ? 1 : -1;
    const angle = (Math.random() * 0.8 - 0.4) * Math.PI; // -36 deg to +36 deg
    ball.vx = dir * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);

    rallyCount = 0;
    rallyCountEl.textContent = rallyCount;
  }

  function addHitParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 4 + 1.5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 20,
        maxLife: 20
      });
    }
  }

  function update() {
    if (!isRunning || isPaused) return;

    // Player Movement
    let moveSpeed = player.turbo || keys.smash ? PLAYER_SPEED * 1.5 : PLAYER_SPEED;
    if (keys.up) {
      player.y -= moveSpeed;
      player.vy = -moveSpeed;
    } else if (keys.down) {
      player.y += moveSpeed;
      player.vy = moveSpeed;
    } else {
      player.vy = 0;
    }

    // Clamp Player
    if (player.y < 10) player.y = 10;
    if (player.y + player.height > canvas.height - 10) {
      player.y = canvas.height - 10 - player.height;
    }

    // AI Adaptive Movement
    // Target ball with a minor human-like tracking delay
    const targetY = ball.y - ai.height / 2 + ai.reactionOffset;
    if (ai.y < targetY - 4) {
      ai.y += AI_SPEED;
    } else if (ai.y > targetY + 4) {
      ai.y -= AI_SPEED;
    }

    // Clamp AI
    if (ai.y < 10) ai.y = 10;
    if (ai.y + ai.height > canvas.height - 10) {
      ai.y = canvas.height - 10 - ai.height;
    }

    // Ball Trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();

    // Ball movement with spin curve
    ball.x += ball.vx;
    ball.y += ball.vy + ball.spin * 0.2;

    // Spin decay
    ball.spin *= 0.98;

    // Bounce off Top / Bottom boundaries
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = -ball.vy;
      sfx.wall();
    } else if (ball.y + ball.radius > canvas.height) {
      ball.y = canvas.height - ball.radius;
      ball.vy = -ball.vy;
      sfx.wall();
    }

    // Paddle Hit Detection: Player
    if (
      ball.vx < 0 &&
      ball.x - ball.radius <= player.x + player.width &&
      ball.x + ball.radius >= player.x &&
      ball.y >= player.y &&
      ball.y <= player.y + player.height
    ) {
      // Calculate impact point relative to center (-1 to 1)
      const hitPoint = (ball.y - (player.y + player.height / 2)) / (player.height / 2);
      const smashActive = keys.smash || player.turbo;

      // Increase speed slightly with each rally
      ball.speed = Math.min(14, ball.speed + (smashActive ? 1.5 : 0.4));
      const bounceAngle = hitPoint * (Math.PI / 3); // Max 60 deg

      ball.vx = ball.speed * Math.cos(bounceAngle);
      ball.vy = ball.speed * Math.sin(bounceAngle);
      ball.spin = player.vy * 0.8;

      rallyCount++;
      if (rallyCount > maxRally) {
        maxRally = rallyCount;
        maxRallyEl.textContent = maxRally;
      }
      rallyCountEl.textContent = rallyCount;

      if (smashActive) {
        sfx.smash();
        addHitParticles(ball.x, ball.y, '#00f0ff', 20);
      } else {
        sfx.hit(360 + rallyCount * 15);
        addHitParticles(ball.x, ball.y, '#00f0ff', 8);
      }

      // Add a small randomized inaccuracy to AI tracking for next rally
      ai.reactionOffset = (Math.random() - 0.5) * 40;
    }

    // Paddle Hit Detection: AI
    if (
      ball.vx > 0 &&
      ball.x + ball.radius >= ai.x &&
      ball.x - ball.radius <= ai.x + ai.width &&
      ball.y >= ai.y &&
      ball.y <= ai.y + ai.height
    ) {
      const hitPoint = (ball.y - (ai.y + ai.height / 2)) / (ai.height / 2);
      ball.speed = Math.min(14, ball.speed + 0.4);
      const bounceAngle = hitPoint * (Math.PI / 3);

      ball.vx = -ball.speed * Math.cos(bounceAngle);
      ball.vy = ball.speed * Math.sin(bounceAngle);

      rallyCount++;
      if (rallyCount > maxRally) {
        maxRally = rallyCount;
        maxRallyEl.textContent = maxRally;
      }
      rallyCountEl.textContent = rallyCount;

      sfx.hit(480 + rallyCount * 15);
      addHitParticles(ball.x, ball.y, '#ec4899', 8);
    }

    // Score: AI Scores
    if (ball.x + ball.radius < 0) {
      aiScore++;
      aiScoreEl.textContent = aiScore;
      sfx.scorePoint();
      checkMatchOver(2);
    }

    // Score: Player Scores
    if (ball.x - ball.radius > canvas.width) {
      playerScore++;
      playerScoreEl.textContent = playerScore;
      sfx.scorePoint();
      checkMatchOver(1);
    }

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function checkMatchOver(lastScorer) {
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
      endMatch();
    } else {
      resetBall(lastScorer === 1 ? 2 : 1);
    }
  }

  function endMatch() {
    isRunning = false;
    if (animId) cancelAnimationFrame(animId);

    const playerWon = playerScore >= WINNING_SCORE;
    if (playerWon) sfx.win();

    matchResultTitle.textContent = playerWon ? 'VICTORY ACHIEVED!' : 'CYBER AI PREVAILED';
    matchResultTitle.style.color = playerWon ? '#00f0ff' : '#ec4899';
    finalScoreDisplay.textContent = `${playerScore} - ${aiScore}`;
    finalMaxRally.textContent = maxRally;

    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Background
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Center Net Line
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Particles
    for (const p of particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Ball Trail
    for (let i = 0; i < ball.trail.length; i++) {
      const pos = ball.trail[i];
      const alpha = (i + 1) / (ball.trail.length * 2);
      ctx.save();
      ctx.fillStyle = ball.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ball.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Ball
    ctx.save();
    ctx.fillStyle = ball.color;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Player Paddle
    ctx.save();
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.width, player.height, 6);
    ctx.fill();
    ctx.restore();

    // Draw AI Paddle
    ctx.save();
    ctx.fillStyle = ai.color;
    ctx.shadowColor = ai.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(ai.x, ai.y, ai.width, ai.height, 6);
    ctx.fill();
    ctx.restore();
  }

  function loop() {
    update();
    render();
    if (isRunning) {
      animId = requestAnimationFrame(loop);
    }
  }

  function startMatch() {
    sfx.init();
    playerScore = 0;
    aiScore = 0;
    rallyCount = 0;
    maxRally = 0;
    playerScoreEl.textContent = '0';
    aiScoreEl.textContent = '0';
    rallyCountEl.textContent = '0';
    maxRallyEl.textContent = '0';

    player.y = canvas.height / 2 - player.height / 2;
    ai.y = canvas.height / 2 - ai.height / 2;

    resetBall(1);

    isRunning = true;
    isPaused = false;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');

    animId = requestAnimationFrame(loop);
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

  // Keyboard events
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
    if (k === ' ' || k === 'shift') {
      keys.smash = true;
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
    if (k === ' ' || k === 'shift') keys.smash = false;
  });

  // Touch button bindings
  function bindTouch(btn, prop) {
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      sfx.init();
      keys[prop] = true;
    };
    const end = (e) => {
      e.preventDefault();
      keys[prop] = false;
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
  }

  bindTouch(btnMoveUp, 'up');
  bindTouch(btnMoveDown, 'down');
  bindTouch(btnSmash, 'smash');

  // UI Event bindings
  btnStart.addEventListener('click', startMatch);
  btnRestart.addEventListener('click', startMatch);
  btnResume.addEventListener('click', togglePause);
  btnPause.addEventListener('click', togglePause);
  btnRestartNav.addEventListener('click', startMatch);

  btnRules.addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
  });
  btnCloseRules.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
  });

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });

})();
