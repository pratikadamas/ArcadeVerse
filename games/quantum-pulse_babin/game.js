/**
 * Quantum Pulse: Cyber Rhythm Blaster
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
  let combo = 0;
  let multiplier = 1;
  let energy = 100;

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

  // 4 Target Lanes (X Coordinates)
  const LANES = [220, 340, 460, 580];
  const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  const LANE_COLORS = ['#00f5ff', '#ff007f', '#00ff66', '#ffaa00'];

  let notes = [];
  let particles = [];
  let pulseRadius = 0;
  let spawnTimer = 0;

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      for (let i = 0; i < 4; i++) {
        if (e.code === LANE_KEYS[i] || (i === 0 && e.code === 'ArrowLeft') || (i === 1 && e.code === 'ArrowDown') || (i === 2 && e.code === 'ArrowUp') || (i === 3 && e.code === 'ArrowRight')) {
          hitLane(i);
        }
      }
    });

    // Touch Support
    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); hitLane(0); });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); hitLane(1); });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); hitLane(3); });

    btnActionStart.addEventListener('click', startGame);
  }

  function hitLane(laneIdx) {
    if (!isPlaying) return;
    const targetY = 500;
    let hit = false;

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.lane === laneIdx && Math.abs(n.y - targetY) < 55) {
        hit = true;
        const accuracy = Math.abs(n.y - targetY);
        let pts = 100;
        let noteRating = 'PERFECT';

        if (accuracy < 18) {
          pts = 150;
          playBeep(880, 'triangle', 0.15);
        } else if (accuracy < 35) {
          pts = 100;
          noteRating = 'GREAT';
          playBeep(660, 'sine', 0.12);
        } else {
          pts = 50;
          noteRating = 'GOOD';
          playBeep(440, 'sine', 0.1);
        }

        combo++;
        if (combo % 10 === 0) multiplier = Math.min(4, multiplier + 1);
        score += pts * multiplier;
        energy = Math.min(100, energy + 3);

        // Spawn spark burst
        for (let p = 0; p < 12; p++) {
          particles.push({
            x: LANES[laneIdx],
            y: targetY,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: LANE_COLORS[laneIdx],
            alpha: 1,
            size: 3.5
          });
        }

        notes.splice(i, 1);
        break;
      }
    }

    if (!hit) {
      combo = 0;
      multiplier = 1;
      energy = Math.max(0, energy - 4);
      playBeep(180, 'sawtooth', 0.1);
      if (energy <= 0) gameOver();
    }
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    combo = 0;
    multiplier = 1;
    energy = 100;
    notes = [];
    particles = [];
    spawnTimer = 0;
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    overlayHeading.textContent = 'SYSTEM OVERLOAD';
    overlayDesc.textContent = 'Signal desynchronized! Final Rhythm Score: ' + score + ' (Max Multiplier: ' + multiplier + 'x)';
    btnActionStart.textContent = 'RE-ENGAGE PULSE';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = combo + 'x';
  }

  function update() {
    if (!isPlaying) return;

    spawnTimer++;
    if (spawnTimer > 32) {
      spawnTimer = 0;
      const lane = Math.floor(Math.random() * 4);
      notes.push({
        lane: lane,
        y: 0,
        speed: 5.5 + Math.min(4, score / 2000),
        color: LANE_COLORS[lane]
      });
    }

    // Move notes
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.y += n.speed;

      // Missed note
      if (n.y > 580) {
        notes.splice(i, 1);
        combo = 0;
        multiplier = 1;
        energy = Math.max(0, energy - 6);
        playBeep(120, 'square', 0.15);
        if (energy <= 0) {
          gameOver();
          return;
        }
      }
    }

    // Particles
    for (let p = particles.length - 1; p >= 0; p--) {
      const pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.03;
      if (pt.alpha <= 0) particles.splice(p, 1);
    }

    pulseRadius = (pulseRadius + 1) % 60;
    updateHUD();
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Track Highway
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(160, 0, 480, 600);

    // Lane Dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let x = 160; x <= 640; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }

    // Hit Zone Bar
    const targetY = 500;
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(160, targetY - 20, 480, 40);

    // Target Strike Pads
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = LANE_COLORS[i];
      ctx.shadowColor = LANE_COLORS[i];
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(LANES[i], targetY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Descending Notes
    for (const n of notes) {
      ctx.fillStyle = n.color;
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(LANES[n.lane], n.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(LANES[n.lane], n.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparks
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Energy Gauge Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(660, 150, 16, 300);
    ctx.fillStyle = energy > 30 ? '#00f5ff' : '#ef4444';
    const gaugeH = (energy / 100) * 300;
    ctx.fillRect(660, 150 + (300 - gaugeH), 16, gaugeH);
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
