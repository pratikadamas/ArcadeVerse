/**
 * Asteroid Miner: Deep Space Extraction
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
  let cargo = 0;
  let fuel = 100;

  // Web Audio Synth
  let audioCtx = null;
  function playSound(type) {
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

      if (type === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'mine') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (_) {}
  }

  // Ship State
  const ship = {
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    angle: 0,
    rotSpeed: 0.065,
    thrust: 0.18,
    radius: 14
  };

  const keys = { left: false, right: false, thrust: false, mine: false };
  let lasers = [];
  let asteroids = [];
  let particles = [];
  let stars = [];

  for (let s = 0; s < 60; s++) {
    stars.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      size: Math.random() * 1.8 + 0.5,
      alpha: Math.random() * 0.8 + 0.2
    });
  }

  function spawnAsteroids(count) {
    for (let i = 0; i < count; i++) {
      const radius = 22 + Math.random() * 26;
      let x = Math.random() * 800;
      let y = Math.random() * 600;
      if (Math.hypot(x - ship.x, y - ship.y) < 180) {
        x = (x + 400) % 800;
      }
      asteroids.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: radius,
        ore: Math.floor(radius * 1.5),
        maxOre: Math.floor(radius * 1.5),
        color: Math.random() > 0.4 ? '#38bdf8' : '#a855f7'
      });
    }
  }

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.thrust = true;
      if (e.code === 'Space') {
        e.preventDefault();
        fireMiningLaser();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.thrust = false;
    });

    // Touch controls
    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); keys.thrust = true; fireMiningLaser(); });
    tAction.addEventListener('touchend', (e) => { e.preventDefault(); keys.thrust = false; });

    btnActionStart.addEventListener('click', startGame);
  }

  function fireMiningLaser() {
    if (!isPlaying) return;
    lasers.push({
      x: ship.x + Math.cos(ship.angle) * ship.radius,
      y: ship.y + Math.sin(ship.angle) * ship.radius,
      vx: Math.cos(ship.angle) * 8 + ship.vx * 0.5,
      vy: Math.sin(ship.angle) * 8 + ship.vy * 0.5,
      life: 45
    });
    playSound('laser');
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    cargo = 0;
    fuel = 100;
    ship.x = 400;
    ship.y = 300;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    asteroids = [];
    lasers = [];
    particles = [];
    spawnAsteroids(6);
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    playSound('hit');
    overlayHeading.textContent = 'SHIP CRITICAL';
    overlayDesc.textContent = 'Your vessel collided with a crystalline asteroid! Total Ore Extracted: ' + score;
    btnActionStart.textContent = 'RE-DEPLOY SHIP';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = Math.round(fuel) + '%';
  }

  function update() {
    if (!isPlaying) return;

    if (keys.left) ship.angle -= ship.rotSpeed;
    if (keys.right) ship.angle += ship.rotSpeed;

    if (keys.thrust) {
      ship.vx += Math.cos(ship.angle) * ship.thrust;
      ship.vy += Math.sin(ship.angle) * ship.thrust;
      fuel = Math.max(0, fuel - 0.05);

      // Engine particles
      particles.push({
        x: ship.x - Math.cos(ship.angle) * ship.radius,
        y: ship.y - Math.sin(ship.angle) * ship.radius,
        vx: -Math.cos(ship.angle) * 2 + (Math.random() - 0.5),
        vy: -Math.sin(ship.angle) * 2 + (Math.random() - 0.5),
        size: 3,
        alpha: 1,
        color: '#f59e0b'
      });
    }

    // Drag
    ship.vx *= 0.985;
    ship.vy *= 0.985;
    ship.x += ship.vx;
    ship.y += ship.vy;

    // Screen wrap
    if (ship.x < 0) ship.x = 800;
    if (ship.x > 800) ship.x = 0;
    if (ship.y < 0) ship.y = 600;
    if (ship.y > 600) ship.y = 0;

    // Lasers
    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];
      laser.x += laser.vx;
      laser.y += laser.vy;
      laser.life--;

      // Check asteroid hits
      for (let a = asteroids.length - 1; a >= 0; a--) {
        const ast = asteroids[a];
        if (Math.hypot(laser.x - ast.x, laser.y - ast.y) < ast.radius) {
          ast.ore -= 5;
          score += 15;
          playSound('mine');
          lasers.splice(l, 1);

          for (let p = 0; p < 5; p++) {
            particles.push({
              x: laser.x,
              y: laser.y,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              size: 2.5,
              alpha: 1,
              color: ast.color
            });
          }

          if (ast.ore <= 0) {
            score += 100;
            asteroids.splice(a, 1);
            if (asteroids.length < 3) spawnAsteroids(3);
          }
          break;
        }
      }

      if (laser && laser.life <= 0) {
        lasers.splice(l, 1);
      }
    }

    // Asteroids
    for (let ast of asteroids) {
      ast.x += ast.vx;
      ast.y += ast.vy;
      if (ast.x < -40) ast.x = 840;
      if (ast.x > 840) ast.x = -40;
      if (ast.y < -40) ast.y = 640;
      if (ast.y > 640) ast.y = -40;

      // Collision with ship
      if (Math.hypot(ship.x - ast.x, ship.y - ast.y) < ship.radius + ast.radius - 4) {
        gameOver();
        return;
      }
    }

    // Particles
    for (let p = particles.length - 1; p >= 0; p--) {
      const pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.025;
      if (pt.alpha <= 0) particles.splice(p, 1);
    }

    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Stars
    for (const star of stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // Asteroids
    for (const ast of asteroids) {
      ctx.save();
      ctx.translate(ast.x, ast.y);
      ctx.fillStyle = ast.color;
      ctx.shadowColor = ast.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Health ring
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius + 4, 0, (Math.PI * 2) * (ast.ore / ast.maxOre));
      ctx.stroke();
      ctx.restore();
    }

    // Lasers
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 8;
    for (const l of lasers) {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x - l.vx * 1.5, l.y - l.vy * 1.5);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Particles
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1.0;

    // Ship
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.strokeStyle = '#f8fafc';
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ship.radius, 0);
    ctx.lineTo(-ship.radius * 0.7, -ship.radius * 0.6);
    ctx.lineTo(-ship.radius * 0.4, 0);
    ctx.lineTo(-ship.radius * 0.7, ship.radius * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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
