/**
 * Neon Rhythm Blaster - 4-Lane Precision Synthesizer Engine
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const canvas = document.getElementById('rhythm-canvas');
  const ctx = canvas.getContext('2d');
  const scoreDisplay = document.getElementById('score-display');
  const comboDisplay = document.getElementById('combo-display');
  const accuracyDisplay = document.getElementById('accuracy-display');
  const bestDisplay = document.getElementById('best-display');
  const judgmentBanner = document.getElementById('judgment-banner');

  const startOverlay = document.getElementById('start-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const finalComboEl = document.getElementById('final-combo');
  const finalAccEl = document.getElementById('final-acc');

  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnSound = document.getElementById('btn-sound');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const btnHelp = document.getElementById('btn-help');
  const helpModal = document.getElementById('help-modal');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const touchPads = document.querySelectorAll('.nrb-pad-btn');

  const WIDTH = 480;
  const HEIGHT = 640;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const LANES = 4;
  const LANE_WIDTH = WIDTH / LANES;
  const TARGET_Y = HEIGHT - 80;
  const NOTE_SPEED = 480; // pixels per second

  // Sound Engine
  let soundEnabled = true;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  const LANE_PITCHES = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 pentatonic

  function playNoteTone(lane, duration = 0.12) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const freq = LANE_PITCHES[lane];
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function playMissTone() {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (_) {}
  }

  // Storage
  const BEST_KEY = 'nrb_arcade_best_score';
  let bestScore = 0;
  try {
    bestScore = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (_) {
    bestScore = 0;
  }
  bestDisplay.textContent = bestScore;

  // Game State
  let gameState = 'start';
  let rafId = null;
  let flashTimers = [];
  function clearFlashTimers() {
    flashTimers.forEach(t => clearTimeout(t));
    flashTimers = [];
  }
  let score = 0;
  let level = 1;
  let totalHits = 0;
  const levelDisplay = document.getElementById('level-display');
  if (levelDisplay) levelDisplay.textContent = level;
  let combo = 0;
  let maxCombo = 0;
  let totalNotesSpawned = 0;
  let totalNotesHit = 0;
  let notes = [];
  let particles = [];
  let laneFlash = [0, 0, 0, 0];

  // Song Chart Generation
  let spawnTimer = 0;
  let songDuration = 60; // 60 seconds session
  let songTimer = 0;

  class Note {
    constructor(lane, y = -30) {
      this.lane = lane;
      this.y = y;
      this.width = LANE_WIDTH - 20;
      this.height = 18;
      this.hit = false;
    }

    update(dt) {
      this.y += (NOTE_SPEED + (level - 1) * 35) * dt;
    }

    draw() {
      if (this.hit) return;
      const x = this.lane * LANE_WIDTH + 10;
      ctx.save();
      const laneColors = ['#00f5ff', '#38bdf8', '#a855f7', '#ec4899'];
      const color = laneColors[this.lane];

      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, this.y, this.width, this.height, 6);
      ctx.fill();

      // Top glowing slit
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8, this.y + 4, this.width - 16, 3);
      ctx.restore();
    }
  }

  class BeatParticle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 60;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1;
      this.decay = Math.random() * 2 + 1.5;
      this.radius = Math.random() * 3 + 2;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.alpha -= this.decay * dt;
    }

    draw() {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnExplosion(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      particles.push(new BeatParticle(x, y, color));
    }
  }

  function showJudgment(text, type) {
    judgmentBanner.textContent = text;
    judgmentBanner.className = `judgment-banner flash ${type}`;
    flashTimers.push(setTimeout(() => {
      judgmentBanner.classList.remove('flash');
    }, 220));
  }

  function triggerHit(lane) {
    if (gameState !== 'playing') return;
    laneFlash[lane] = 0.15;

    // Highlight pad
    if (touchPads[lane]) {
      touchPads[lane].classList.add('pressed');
      flashTimers.push(setTimeout(() => touchPads[lane].classList.remove('pressed'), 120));
    }

    // Find nearest note in this lane
    let closestNote = null;
    let closestDist = Infinity;

    for (const note of notes) {
      if (note.lane === lane && !note.hit) {
        const dist = Math.abs(note.y - TARGET_Y);
        if (dist < closestDist) {
          closestDist = dist;
          closestNote = note;
        }
      }
    }

    if (closestNote && closestDist < 85) {
      closestNote.hit = true;
      totalNotesHit++;
      totalHits++;
      if (totalHits % 15 === 0) level++;
      playNoteTone(lane);

      const x = lane * LANE_WIDTH + LANE_WIDTH / 2;
      const laneColors = ['#00f5ff', '#38bdf8', '#a855f7', '#ec4899'];
      const color = laneColors[lane];

      let multiplier = 1;
      if (combo >= 50) multiplier = 4;
      else if (combo >= 25) multiplier = 3;
      else if (combo >= 10) multiplier = 2;

      if (closestDist < 35) {
        combo++;
        score += 100 * multiplier;
        showJudgment('PERFECT', 'perfect');
        spawnExplosion(x, TARGET_Y, color, 20);
      } else {
        combo++;
        score += 50 * multiplier;
        showJudgment('GREAT', 'great');
        spawnExplosion(x, TARGET_Y, color, 12);
      }

      if (combo > maxCombo) maxCombo = combo;
      updateHUD();
    } else if (!closestNote || closestDist > 120) {
      // Empty tap miss
      combo = 0;
      playMissTone();
      showJudgment('MISS', 'miss');
      updateHUD();
    }
  }

  function updateHUD() {
    scoreDisplay.textContent = score;
    if (levelDisplay) levelDisplay.textContent = level;
    comboDisplay.textContent = combo > 0 ? `${combo}x` : '0';

    const acc = totalNotesSpawned > 0 ? Math.round((totalNotesHit / totalNotesSpawned) * 100) : 100;
    accuracyDisplay.textContent = `${acc}%`;

    if (score > bestScore) {
      bestScore = score;
      bestDisplay.textContent = bestScore;
      try {
        localStorage.setItem(BEST_KEY, bestScore);
      } catch (_) {}
    }
  }

  // Keyboard binds
  const KEY_LANES = {
    KeyD: 0,
    KeyF: 1,
    KeyJ: 2,
    KeyK: 3
  };

  window.addEventListener('keydown', (e) => {
    if (['KeyD', 'KeyF', 'KeyJ', 'KeyK'].includes(e.code)) {
      e.preventDefault();
      triggerHit(KEY_LANES[e.code]);
    }
  });

  // Touch pads
  touchPads.forEach(pad => {
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const lane = parseInt(pad.dataset.lane, 10);
      triggerHit(lane);
    });
  });

  function startSession() {
    clearFlashTimers();
    initAudio();
    gameState = 'playing';
    score = 0;
    level = 1;
    totalHits = 0;
    if (levelDisplay) levelDisplay.textContent = level;
    combo = 0;
    maxCombo = 0;
    totalNotesSpawned = 0;
    totalNotesHit = 0;
    songTimer = songDuration;
    spawnTimer = 0;
    notes = [];
    particles = [];
    updateHUD();

    startOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function endSession() {
    gameState = 'gameover';
    clearFlashTimers();
    finalScoreEl.textContent = score;
    finalComboEl.textContent = `${maxCombo}x`;
    const acc = totalNotesSpawned > 0 ? Math.round((totalNotesHit / totalNotesSpawned) * 100) : 100;
    finalAccEl.textContent = `${acc}%`;
    gameOverOverlay.classList.add('active');

    try {
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: score }, '*');
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER' }, '*');
    } catch (_) {}
  }

  let lastTime = 0;

  function loop(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    update(dt);
    draw();

    if (gameState === 'playing' || gameState === 'start') {
      rafId = requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    if (gameState !== 'playing') return;

    songTimer -= dt;
    if (songTimer <= 0) {
      endSession();
      return;
    }

    // Lane Flash Decay
    for (let l = 0; l < LANES; l++) {
      if (laneFlash[l] > 0) laneFlash[l] -= dt;
    }

    // Note Spawning (BPM-synced pseudo pattern)
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const activeLanes = [0, 1, 2, 3];
      const count = Math.random() < 0.25 ? 2 : 1; // Double notes occasionally
      for (let i = 0; i < count; i++) {
        const laneIdx = Math.floor(Math.random() * activeLanes.length);
        const lane = activeLanes.splice(laneIdx, 1)[0];
        notes.push(new Note(lane));
        totalNotesSpawned++;
      }
      spawnTimer = Math.max(0.35, 0.65 - (1 - (songTimer / songDuration)) * 0.25);
    }

    // Update Notes
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      note.update(dt);

      // Dropped past target line
      if (!note.hit && note.y > TARGET_Y + 70) {
        note.hit = true;
        combo = 0;
        showJudgment('MISS', 'miss');
        playMissTone();
        updateHUD();
      }

      if (note.y > HEIGHT + 40) {
        notes.splice(i, 1);
      }
    }

    // Update Particles
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.alpha > 0);
  }

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Track Lane Backgrounds & Dividers
    for (let l = 0; l < LANES; l++) {
      const x = l * LANE_WIDTH;

      // Lane flash glow
      if (laneFlash[l] > 0) {
        ctx.fillStyle = `rgba(0, 245, 255, ${laneFlash[l] * 1.5})`;
        ctx.fillRect(x, 0, LANE_WIDTH, HEIGHT);
      }

      // Lane separator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + LANE_WIDTH, 0);
      ctx.lineTo(x + LANE_WIDTH, HEIGHT);
      ctx.stroke();
    }

    // Target Judgment Beam Line
    ctx.save();
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, TARGET_Y + 9);
    ctx.lineTo(WIDTH, TARGET_Y + 9);
    ctx.stroke();

    // Target Hit Rings
    for (let l = 0; l < LANES; l++) {
      const cx = l * LANE_WIDTH + LANE_WIDTH / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(l * LANE_WIDTH + 8, TARGET_Y - 2, LANE_WIDTH - 16, 22, 6);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Draw Notes
    notes.forEach(note => note.draw());

    // Draw Particles
    particles.forEach(p => p.draw());
  }

  // Buttons
  btnStart.addEventListener('click', startSession);
  btnRestart.addEventListener('click', startSession);

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    iconSoundOn.classList.toggle('hidden', !soundEnabled);
    iconSoundOff.classList.toggle('hidden', soundEnabled);
    if (soundEnabled) initAudio();
  });

  btnHelp.addEventListener('click', () => helpModal.classList.add('active'));
  btnCloseHelp.addEventListener('click', () => helpModal.classList.remove('active'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('active');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      if ((gameState === 'playing' || gameState === 'start') && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    }
  });

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const type = e.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (type === 'ARCADEVERSE_RESUME') {
      if ((gameState === 'playing' || gameState === 'start') && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      clearFlashTimers();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (type === 'AV_RESIZE') {
      const d = e.data;
      if (d.width && d.height && canvas) {
        canvas.width = d.width;
        canvas.height = d.height;
      }
    }
  });

  rafId = requestAnimationFrame(loop);
})();
