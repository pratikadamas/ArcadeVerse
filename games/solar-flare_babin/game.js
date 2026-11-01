/**
 * Solar Flare: Stellar Shield Defense
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
  let waves = 1;
  let coreHealth = 100;

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

      if (type === 'deflect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (_) {}
  }

  // Core & Orbital Shield
  const core = { x: 400, y: 300, radius: 45 };
  const shield = {
    angle: 0,
    angularWidth: Math.PI * 0.4, // Arc size
    radius: 95,
    speed: 0.08
  };

  const keys = { left: false, right: false, boost: false };
  let flares = [];
  let sparks = [];

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space') keys.boost = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space') keys.boost = false;
    });

    // Touch controls
    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
    tLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
    tRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); keys.boost = true; });
    tAction.addEventListener('touchend', (e) => { e.preventDefault(); keys.boost = false; });

    btnActionStart.addEventListener('click', startGame);
  }

  function spawnFlare() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 450;
    flares.push({
      x: core.x + Math.cos(angle) * distance,
      y: core.y + Math.sin(angle) * distance,
      speed: 2.2 + Math.min(3, score / 1500),
      radius: 8 + Math.random() * 6,
      color: Math.random() > 0.3 ? '#ff4500' : '#ffaa00'
    });
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    waves = 1;
    coreHealth = 100;
    flares = [];
    sparks = [];
    shield.angle = 0;
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    playSound('hit');
    overlayHeading.textContent = 'STELLAR CORE BREACH';
    overlayDesc.textContent = 'Solar flares pierced the containment shield! Radiation score protected: ' + score;
    btnActionStart.textContent = 'REIGNITE SHIELD';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = Math.round(coreHealth) + '%';
  }

  function update() {
    if (!isPlaying) return;

    const currentSpeed = keys.boost ? shield.speed * 1.8 : shield.speed;
    if (keys.left) shield.angle -= currentSpeed;
    if (keys.right) shield.angle += currentSpeed;

    // Flare Spawner
    if (Math.random() < 0.045 + Math.min(0.04, score / 4000)) {
      spawnFlare();
    }

    // Move flares toward core
    for (let i = flares.length - 1; i >= 0; i--) {
      const fl = flares[i];
      const dx = core.x - fl.x;
      const dy = core.y - fl.y;
      const dist = Math.hypot(dx, dy);

      fl.x += (dx / dist) * fl.speed;
      fl.y += (dy / dist) * fl.speed;

      // Check Shield Collision
      if (Math.abs(dist - shield.radius) < fl.radius + 6) {
        // Calculate flare angle from center
        let flareAngle = Math.atan2(fl.y - core.y, fl.x - core.x);
        // Normalize angles between -PI and PI
        let diff = Math.atan2(Math.sin(flareAngle - shield.angle), Math.cos(flareAngle - shield.angle));

        if (Math.abs(diff) < shield.angularWidth / 2) {
          // Deflected!
          score += 50;
          playSound('deflect');

          // Sparks
          for (let s = 0; s < 10; s++) {
            sparks.push({
              x: fl.x,
              y: fl.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              alpha: 1,
              color: '#00f5ff'
            });
          }

          flares.splice(i, 1);
          continue;
        }
      }

      // Hit Core
      if (dist < core.radius + fl.radius) {
        coreHealth = Math.max(0, coreHealth - 14);
        playSound('hit');

        for (let s = 0; s < 14; s++) {
          sparks.push({
            x: fl.x,
            y: fl.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            alpha: 1,
            color: '#ff3300'
          });
        }

        flares.splice(i, 1);
        if (coreHealth <= 0) {
          gameOver();
          return;
        }
      }
    }

    // Sparks
    for (let s = sparks.length - 1; s >= 0; s--) {
      const sp = sparks[s];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= 0.035;
      if (sp.alpha <= 0) sparks.splice(s, 1);
    }

    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Glowing Stellar Core
    const sunGrad = ctx.createRadialGradient(core.x, core.y, 10, core.x, core.y, core.radius + 20);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.3, '#ffcc00');
    sunGrad.addColorStop(0.7, '#ff3b00');
    sunGrad.addColorStop(1, 'rgba(255, 59, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.radius + 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffeedd';
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.radius, 0, Math.PI * 2);
    ctx.fill();

    // Orbital Path
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(core.x, core.y, shield.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Orbital Energy Shield
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(core.x, core.y, shield.radius, shield.angle - shield.angularWidth / 2, shield.angle + shield.angularWidth / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';

    // Solar Flares
    for (const fl of flares) {
      ctx.fillStyle = fl.color;
      ctx.shadowColor = fl.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Sparks
    for (const sp of sparks) {
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
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
