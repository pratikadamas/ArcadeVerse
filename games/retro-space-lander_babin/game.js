/**
 * Retro Space Lander: Apollo Lunar Descent
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
  let fuel = 100;
  let landings = 0;

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

      if (type === 'land') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (_) {}
  }

  // Lander Physics
  const lander = {
    x: 100,
    y: 80,
    vx: 1.2,
    vy: 0,
    angle: 0,
    thrust: 0.16,
    gravity: 0.05,
    rotSpeed: 0.05,
    width: 24,
    height: 20
  };

  const keys = { left: false, right: false, thrust: false };
  let terrain = [];
  let landingPads = [];
  let exhaust = [];

  function generateTerrain() {
    terrain = [];
    landingPads = [];
    const points = 25;
    const step = 800 / (points - 1);

    // Pick 2 flat landing zones
    const pad1Idx = 5;
    const pad2Idx = 16;

    for (let i = 0; i < points; i++) {
      let y = 420 + Math.sin(i * 0.8) * 100 + (Math.random() - 0.5) * 50;
      if (i === pad1Idx || i === pad1Idx + 1) y = 480;
      if (i === pad2Idx || i === pad2Idx + 1) y = 520;
      terrain.push({ x: i * step, y: y });
    }

    landingPads.push({ x1: terrain[pad1Idx].x, x2: terrain[pad1Idx + 1].x, y: 480, mult: 2 });
    landingPads.push({ x1: terrain[pad2Idx].x, x2: terrain[pad2Idx + 1].x, y: 520, mult: 3 });
  }

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.thrust = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.thrust = false;
    });

    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); keys.thrust = true; });
    tAction.addEventListener('touchend', (e) => { e.preventDefault(); keys.thrust = false; });

    btnActionStart.addEventListener('click', startGame);
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    fuel = 100;
    landings = 0;
    lander.x = 100;
    lander.y = 80;
    lander.vx = 1.2;
    lander.vy = 0;
    lander.angle = 0;
    exhaust = [];
    generateTerrain();
    updateHUD();
    gameLoop();
  }

  function gameOver(crashed) {
    isPlaying = false;
    if (crashed) {
      playSound('crash');
      overlayHeading.textContent = 'MODULE CRUSHED';
      overlayDesc.textContent = 'Descent velocity or orientation exceeded safety limits! Final Score: ' + score;
    } else {
      overlayHeading.textContent = 'OUT OF FUEL';
      overlayDesc.textContent = 'Thruster fuel depleted in zero gravity! Final Score: ' + score;
    }
    btnActionStart.textContent = 'RESTART DESCENT';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = 'Fuel: ' + Math.round(fuel) + '% | V: ' + lander.vy.toFixed(1);
  }

  function update() {
    if (!isPlaying) return;

    if (keys.left) lander.angle -= lander.rotSpeed;
    if (keys.right) lander.angle += lander.rotSpeed;

    if (keys.thrust && fuel > 0) {
      lander.vx += Math.sin(lander.angle) * lander.thrust;
      lander.vy -= Math.cos(lander.angle) * lander.thrust;
      fuel = Math.max(0, fuel - 0.15);

      exhaust.push({
        x: lander.x - Math.sin(lander.angle) * 14,
        y: lander.y + Math.cos(lander.angle) * 14,
        vx: -Math.sin(lander.angle) * 3 + (Math.random() - 0.5),
        vy: Math.cos(lander.angle) * 3 + (Math.random() - 0.5),
        alpha: 1
      });
    }

    lander.vy += lander.gravity;
    lander.x += lander.vx;
    lander.y += lander.vy;

    // Boundary wrap
    if (lander.x < 0) lander.x = 800;
    if (lander.x > 800) lander.x = 0;

    // Check Landing on Pad
    for (const pad of landingPads) {
      if (lander.x >= pad.x1 && lander.x <= pad.x2 && Math.abs(lander.y + 12 - pad.y) < 6) {
        // Check landing conditions: low vertical & horizontal speed, upright angle
        if (Math.abs(lander.vy) < 1.8 && Math.abs(lander.vx) < 1.2 && Math.abs(lander.angle) < 0.25) {
          // Success landing!
          score += 300 * pad.mult;
          landings++;
          fuel = Math.min(100, fuel + 40);
          playSound('land');

          // Reset to top
          lander.x = 100 + Math.random() * 600;
          lander.y = 80;
          lander.vx = (Math.random() - 0.5) * 2;
          lander.vy = 0;
          lander.angle = 0;
          updateHUD();
          return;
        } else {
          gameOver(true);
          return;
        }
      }
    }

    // Check Terrain collision
    for (let i = 0; i < terrain.length - 1; i++) {
      const p1 = terrain[i];
      const p2 = terrain[i + 1];
      if (lander.x >= p1.x && lander.x <= p2.x) {
        // Interpolate ground Y
        const t = (lander.x - p1.x) / (p2.x - p1.x);
        const groundY = p1.y + t * (p2.y - p1.y);
        if (lander.y + 12 >= groundY) {
          gameOver(true);
          return;
        }
      }
    }

    // Exhaust particles
    for (let p = exhaust.length - 1; p >= 0; p--) {
      const ex = exhaust[p];
      ex.x += ex.vx;
      ex.y += ex.vy;
      ex.alpha -= 0.04;
      if (ex.alpha <= 0) exhaust.splice(p, 1);
    }

    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Lunar Surface Terrain
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 600);
    ctx.lineTo(terrain[0].x, terrain[0].y);
    for (let i = 1; i < terrain.length; i++) {
      ctx.lineTo(terrain[i].x, terrain[i].y);
    }
    ctx.lineTo(800, 600);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Landing Pads
    for (const pad of landingPads) {
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(pad.x1, pad.y);
      ctx.lineTo(pad.x2, pad.y);
      ctx.stroke();

      ctx.fillStyle = '#00f5ff';
      ctx.font = '10px monospace';
      ctx.fillText(pad.mult + 'X BONUS', pad.x1 + 10, pad.y + 16);
    }

    // Exhaust
    for (const ex of exhaust) {
      ctx.fillStyle = '#f59e0b';
      ctx.globalAlpha = Math.max(0, ex.alpha);
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Lunar Lander
    ctx.save();
    ctx.translate(lander.x, lander.y);
    ctx.rotate(lander.angle);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-10, -10, 20, 16);

    // Legs
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-14, 14);
    ctx.moveTo(10, 6);
    ctx.lineTo(14, 14);
    ctx.stroke();

    // Capsule Window
    ctx.fillStyle = '#00f5ff';
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();

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
