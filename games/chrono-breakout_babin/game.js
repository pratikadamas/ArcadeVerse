/**
 * Chrono Breakout: Quantum Time Shatter
 * Author: Babin Bid (@Babin123456)
 * ArcadeVerse HTML5 Canvas Game
 */
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreVal = document.getElementById('scoreVal');
  const levelVal = document.getElementById('levelVal');
  const overlayScreen = document.getElementById('overlayScreen');
  const overlayHeading = document.getElementById('overlayHeading');
  const overlayDesc = document.getElementById('overlayDesc');
  const btnActionStart = document.getElementById('btnActionStart');

  const tLeft = document.getElementById('tLeft');
  const tRight = document.getElementById('tRight');
  const tAction = document.getElementById('tAction');

  let animationId = null;
  let isPlaying = false;
  let score = 0;
  let lives = 3;
  let rewindEnergy = 100;
  let isRewinding = false;

  // Web Audio Synth
  let audioCtx = null;
  function playBeep(freq, type, duration) {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // Paddle & Ball
  const paddle = { x: 350, y: 550, w: 100, h: 14, speed: 8 };
  const ball = { x: 400, y: 500, vx: 4, vy: -5, radius: 8 };

  // Bricks Matrix
  const BRICK_ROWS = 5;
  const BRICK_COLS = 10;
  const BRICK_W = 70;
  const BRICK_H = 22;
  const BRICK_PAD = 8;
  const BRICK_TOP = 80;
  const BRICK_LEFT = (800 - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;

  let bricks = [];
  let particles = [];
  let history = []; // Circular history buffer for time rewind (120 frames = 2 secs)

  function initBricks() {
    bricks = [];
    const colors = ['#00f5ff', '#ff007f', '#00ff66', '#f59e0b', '#a855f7'];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_PAD),
          y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
          w: BRICK_W,
          h: BRICK_H,
          color: colors[r % colors.length],
          alive: true
        });
      }
    }
  }

  const keys = { left: false, right: false };

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space' || e.code === 'KeyR') {
        isRewinding = true;
        playBeep(300, 'sawtooth', 0.1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space' || e.code === 'KeyR') isRewinding = false;
    });

    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); isRewinding = true; });
    tAction.addEventListener('touchend', (e) => { e.preventDefault(); isRewinding = false; });

    btnActionStart.addEventListener('click', startGame);
  }

  function resetBall() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - 20;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * 4;
    ball.vy = -5;
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    lives = 3;
    rewindEnergy = 100;
    isRewinding = false;
    history = [];
    particles = [];
    paddle.x = 350;
    initBricks();
    resetBall();
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    overlayHeading.textContent = 'TIMELINE CRUMBLED';
    overlayDesc.textContent = 'All chrono echoes drained! Quantum Shatter Score: ' + score;
    btnActionStart.textContent = 'REBUILD TIMELINE';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = 'Lives: ' + lives + ' | ' + Math.round(rewindEnergy) + '%';
  }

  function update() {
    if (!isPlaying) return;

    // Time Rewind State
    if (isRewinding && history.length > 0 && rewindEnergy > 0) {
      const snap = history.pop();
      paddle.x = snap.px;
      ball.x = snap.bx;
      ball.y = snap.by;
      ball.vx = snap.bvx;
      ball.vy = snap.bvy;
      rewindEnergy = Math.max(0, rewindEnergy - 1.2);
      updateHUD();
      return;
    }

    // Normal forward simulation
    rewindEnergy = Math.min(100, rewindEnergy + 0.08);

    if (keys.left) paddle.x -= paddle.speed;
    if (keys.right) paddle.x += paddle.speed;
    if (paddle.x < 10) paddle.x = 10;
    if (paddle.x + paddle.w > 790) paddle.x = 790 - paddle.w;

    // Record timeline snapshot
    history.push({
      px: paddle.x,
      bx: ball.x,
      by: ball.y,
      bvx: ball.vx,
      bvy: ball.vy
    });
    if (history.length > 120) history.shift();

    // Ball movement
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounces
    if (ball.x - ball.radius < 10) {
      ball.x = 10 + ball.radius;
      ball.vx = -ball.vx;
      playBeep(480, 'sine', 0.05);
    }
    if (ball.x + ball.radius > 790) {
      ball.x = 790 - ball.radius;
      ball.vx = -ball.vx;
      playBeep(480, 'sine', 0.05);
    }
    if (ball.y - ball.radius < 10) {
      ball.y = 10 + ball.radius;
      ball.vy = -ball.vy;
      playBeep(480, 'sine', 0.05);
    }

    // Paddle collision
    if (
      ball.y + ball.radius >= paddle.y &&
      ball.y - ball.radius <= paddle.y + paddle.h &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.w
    ) {
      ball.vy = -Math.abs(ball.vy);
      // Angle based on hit location
      const hitOffset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      ball.vx = hitOffset * 6.5;
      playBeep(640, 'triangle', 0.08);
    }

    // Brick collisions
    for (const br of bricks) {
      if (!br.alive) continue;
      if (
        ball.x + ball.radius > br.x &&
        ball.x - ball.radius < br.x + br.w &&
        ball.y + ball.radius > br.y &&
        ball.y - ball.radius < br.y + br.h
      ) {
        br.alive = false;
        ball.vy = -ball.vy;
        score += 100;
        playBeep(880, 'triangle', 0.1);

        for (let p = 0; p < 8; p++) {
          particles.push({
            x: ball.x,
            y: ball.y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            color: br.color,
            alpha: 1
          });
        }
        break;
      }
    }

    // Missed ball
    if (ball.y > 610) {
      lives--;
      playBeep(150, 'sawtooth', 0.25);
      if (lives <= 0) {
        gameOver();
        return;
      } else {
        resetBall();
      }
    }

    // Particles
    for (let p = particles.length - 1; p >= 0; p--) {
      const pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.035;
      if (pt.alpha <= 0) particles.splice(p, 1);
    }

    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Rewind Vignette Effect
    if (isRewinding) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#c084fc';
      ctx.font = '14px monospace';
      ctx.fillText('<< TIME REWIND ACTIVE >>', 310, 40);
    }

    // Bricks
    for (const br of bricks) {
      if (!br.alive) continue;
      ctx.fillStyle = br.color;
      ctx.shadowColor = br.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(br.x, br.y, br.w, br.h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(br.x, br.y, br.w, br.h);
    }

    // Paddle
    ctx.fillStyle = '#00f5ff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.shadowBlur = 0;

    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Particles
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  function gameLoop() {
    if (!isPlaying) return;
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  // Lifecycle Bridge
  if (window.ArcadeVerse) {
    ArcadeVerse.onPause(() => { isPlaying = false; });
    ArcadeVerse.onResume(() => { if (overlayScreen.classList.contains('hidden')) { isPlaying = true; gameLoop(); } });
    ArcadeVerse.onTeardown(() => {
      isPlaying = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) audioCtx.close().catch(() => {});
    });
  }

  initInputs();
})();
