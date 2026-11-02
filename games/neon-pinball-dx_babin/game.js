/**
 * Neon Pinball DX: Cybernetic Table
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
  let ballsLeft = 3;

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
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // Pinball Physics State
  const ball = { x: 400, y: 150, vx: 2, vy: 4, radius: 9 };
  const gravity = 0.22;

  // Flippers
  const leftFlipper = { x: 260, y: 520, length: 90, angle: 0.35, targetAngle: 0.35, restAngle: 0.35, upAngle: -0.45 };
  const rightFlipper = { x: 540, y: 520, length: 90, angle: Math.PI - 0.35, targetAngle: Math.PI - 0.35, restAngle: Math.PI - 0.35, upAngle: Math.PI + 0.45 };

  // Bumpers & Targets
  const bumpers = [
    { x: 320, y: 220, radius: 32, points: 250, color: '#ff007f' },
    { x: 480, y: 220, radius: 32, points: 250, color: '#00f5ff' },
    { x: 400, y: 320, radius: 36, points: 500, color: '#f59e0b' },
    { x: 250, y: 370, radius: 24, points: 150, color: '#00ff66' },
    { x: 550, y: 370, radius: 24, points: 150, color: '#00ff66' }
  ];

  let particles = [];

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyZ' || e.code === 'ArrowLeft' || e.code === 'KeyA') {
        leftFlipper.targetAngle = leftFlipper.upAngle;
        playBeep(320, 'triangle', 0.08);
      }
      if (e.code === 'Slash' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        rightFlipper.targetAngle = rightFlipper.upAngle;
        playBeep(320, 'triangle', 0.08);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyZ' || e.code === 'ArrowLeft' || e.code === 'KeyA') {
        leftFlipper.targetAngle = leftFlipper.restAngle;
      }
      if (e.code === 'Slash' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        rightFlipper.targetAngle = rightFlipper.restAngle;
      }
    });

    // Touch controls
    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); leftFlipper.targetAngle = leftFlipper.upAngle; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); leftFlipper.targetAngle = leftFlipper.restAngle; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); rightFlipper.targetAngle = rightFlipper.upAngle; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); rightFlipper.targetAngle = rightFlipper.restAngle; });
    tAction.addEventListener('touchstart', (e) => {
      e.preventDefault();
      leftFlipper.targetAngle = leftFlipper.upAngle;
      rightFlipper.targetAngle = rightFlipper.upAngle;
    });
    tAction.addEventListener('touchend', (e) => {
      e.preventDefault();
      leftFlipper.targetAngle = leftFlipper.restAngle;
      rightFlipper.targetAngle = rightFlipper.restAngle;
    });

    btnActionStart.addEventListener('click', startGame);
  }

  function resetBall() {
    ball.x = 400 + (Math.random() - 0.5) * 80;
    ball.y = 80;
    ball.vx = (Math.random() - 0.5) * 5;
    ball.vy = 2;
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    ballsLeft = 3;
    particles = [];
    resetBall();
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    overlayHeading.textContent = 'TABLE DRAINFOUT';
    overlayDesc.textContent = 'All cybernetic balls drained! High Arcade Score: ' + score;
    btnActionStart.textContent = 'INSERT COIN / PLAY';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = ballsLeft + ' Balls';
  }

  function update() {
    if (!isPlaying) return;

    // Flipper interpolation
    leftFlipper.angle += (leftFlipper.targetAngle - leftFlipper.angle) * 0.45;
    rightFlipper.angle += (rightFlipper.targetAngle - rightFlipper.angle) * 0.45;

    // Ball gravity & physics
    ball.vy += gravity;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounces (Table bounds)
    if (ball.x - ball.radius < 180) {
      ball.x = 180 + ball.radius;
      ball.vx = Math.abs(ball.vx) * 0.85;
      playBeep(400, 'square', 0.05);
    }
    if (ball.x + ball.radius > 620) {
      ball.x = 620 - ball.radius;
      ball.vx = -Math.abs(ball.vx) * 0.85;
      playBeep(400, 'square', 0.05);
    }
    if (ball.y - ball.radius < 20) {
      ball.y = 20 + ball.radius;
      ball.vy = Math.abs(ball.vy) * 0.85;
      playBeep(400, 'square', 0.05);
    }

    // Bumper collisions
    for (const b of bumpers) {
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const dist = Math.hypot(dx, dy);

      if (dist < b.radius + ball.radius) {
        const nx = dx / dist;
        const ny = dy / dist;
        const bounceForce = 12;
        ball.vx = nx * bounceForce;
        ball.vy = ny * bounceForce;
        score += b.points;
        playBeep(b.points * 1.5, 'triangle', 0.12);

        // Sparks
        for (let p = 0; p < 12; p++) {
          particles.push({
            x: ball.x,
            y: ball.y,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            color: b.color,
            alpha: 1
          });
        }
      }
    }

    // Flipper collision check (Left Flipper)
    const lTipX = leftFlipper.x + Math.cos(leftFlipper.angle) * leftFlipper.length;
    const lTipY = leftFlipper.y + Math.sin(leftFlipper.angle) * leftFlipper.length;
    if (ball.y > 490 && ball.y < 560 && ball.x > leftFlipper.x && ball.x < lTipX + 15) {
      if (ball.vy > 0) {
        ball.vy = -12;
        ball.vx += 3;
        playBeep(580, 'sawtooth', 0.1);
      }
    }

    // Right Flipper
    const rTipX = rightFlipper.x + Math.cos(rightFlipper.angle) * rightFlipper.length;
    const rTipY = rightFlipper.y + Math.sin(rightFlipper.angle) * rightFlipper.length;
    if (ball.y > 490 && ball.y < 560 && ball.x < rightFlipper.x && ball.x > rTipX - 15) {
      if (ball.vy > 0) {
        ball.vy = -12;
        ball.vx -= 3;
        playBeep(580, 'sawtooth', 0.1);
      }
    }

    // Ball drained below flippers
    if (ball.y > 620) {
      ballsLeft--;
      playBeep(140, 'sine', 0.3);
      if (ballsLeft <= 0) {
        gameOver();
        return;
      } else {
        resetBall();
      }
    }

    // Update sparks
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

    // Pinball Table Outer Border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(178, 18, 444, 582);

    // Bumpers
    for (const b of bumpers) {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Flippers
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';

    // Left flipper
    ctx.beginPath();
    ctx.moveTo(leftFlipper.x, leftFlipper.y);
    ctx.lineTo(leftFlipper.x + Math.cos(leftFlipper.angle) * leftFlipper.length, leftFlipper.y + Math.sin(leftFlipper.angle) * leftFlipper.length);
    ctx.stroke();

    // Right flipper
    ctx.beginPath();
    ctx.moveTo(rightFlipper.x, rightFlipper.y);
    ctx.lineTo(rightFlipper.x + Math.cos(rightFlipper.angle) * rightFlipper.length, rightFlipper.y + Math.sin(rightFlipper.angle) * rightFlipper.length);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sparks
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
