(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const scoreDisplay = document.getElementById('score-val');
  const comboDisplay = document.getElementById('combo-val');
  const accuracyDisplay = document.getElementById('accuracy-val');
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
  const laneBtns = [
    document.getElementById('btn-lane-0'),
    document.getElementById('btn-lane-1'),
    document.getElementById('btn-lane-2'),
    document.getElementById('btn-lane-3')
  ];

  // Web Audio Synth
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  const LANE_FREQS = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 Musical Chord
  const LANE_COLORS = ['#06b6d4', '#a855f7', '#ec4899', '#10b981'];

  function playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2) {
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
  let combo = 0;
  let maxCombo = 0;
  let totalNotesSpawned = 0;
  let totalNotesHit = 0;
  let bestScore = parseInt(localStorage.getItem('cyber_pulse_best') || '0', 10);
  bestDisplay.textContent = bestScore;

  // Track lanes geometry
  const numLanes = 4;
  const laneWidth = 600 / numLanes; // 150px
  const targetBaselineY = 550;
  const hitTolerance = 45; // px

  let notes = [];
  let particles = [];
  let hitFeedbacks = [];
  let lastBeatTime = 0;
  let beatInterval = 550; // ms

  function resetGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    totalNotesSpawned = 0;
    totalNotesHit = 0;
    notes = [];
    particles = [];
    hitFeedbacks = [];
    updateHUD();
    gameoverOverlay.classList.remove('active');
    startOverlay.classList.remove('active');
    isRunning = true;
    lastBeatTime = performance.now();
  }

  function updateHUD() {
    scoreDisplay.textContent = score;
    comboDisplay.textContent = `${combo}x`;
    const acc = totalNotesSpawned > 0 ? Math.round((totalNotesHit / totalNotesSpawned) * 100) : 100;
    accuracyDisplay.textContent = `${acc}%`;
  }

  function spawnNote() {
    const lane = Math.floor(Math.random() * numLanes);
    totalNotesSpawned++;
    notes.push({
      lane: lane,
      y: -20,
      speed: 5.5,
      hit: false,
      color: LANE_COLORS[lane]
    });
  }

  function triggerLane(laneIndex) {
    if (!isRunning) return;
    initAudio();

    // Visual button flash
    laneBtns[laneIndex].classList.add('active');
    setTimeout(() => laneBtns[laneIndex].classList.remove('active'), 100);

    playTone(LANE_FREQS[laneIndex], 'triangle', 0.18, 0.22);

    // Check hit candidates
    let hitFound = false;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.lane === laneIndex && !n.hit) {
        const diff = Math.abs(n.y - targetBaselineY);
        if (diff < hitTolerance) {
          n.hit = true;
          hitFound = true;
          totalNotesHit++;
          combo++;
          if (combo > maxCombo) maxCombo = combo;

          let rating = 'PERFECT';
          let points = 100;
          let ratingColor = '#10b981';

          if (diff > 25) {
            rating = 'GOOD';
            points = 60;
            ratingColor = '#38bdf8';
          }

          const multiplier = Math.min(4, 1 + Math.floor(combo / 10));
          score += points * multiplier;

          createParticles(laneIndex * laneWidth + laneWidth / 2, targetBaselineY, n.color, 16);
          addFeedback(rating, laneIndex * laneWidth + laneWidth / 2, targetBaselineY - 30, ratingColor);
          updateHUD();
          break;
        }
      }
    }

    if (!hitFound) {
      combo = 0;
      updateHUD();
    }
  }

  function addFeedback(text, x, y, color) {
    hitFeedbacks.push({ text, x, y, color, life: 1 });
  }

  function createParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 4;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
        size: 2 + Math.random() * 3
      });
    }
  }

  function gameOver() {
    isRunning = false;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('cyber_pulse_best', bestScore);
      bestDisplay.textContent = bestScore;
    }
    gameoverStats.textContent = `Score: ${score} • Max Combo: ${maxCombo}x • Accuracy: ${accuracyDisplay.textContent}`;
    gameoverOverlay.classList.add('active');
    playTone(180, 'sawtooth', 0.45, 0.3);
  }

  function update() {
    if (!isRunning) return;

    // Rhythm beat timer
    if (performance.now() - lastBeatTime > beatInterval) {
      spawnNote();
      lastBeatTime = performance.now();
    }

    // Update notes
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.y += n.speed;

      // Missed note
      if (n.y > targetBaselineY + hitTolerance && !n.hit) {
        combo = 0;
        addFeedback('MISS', n.lane * laneWidth + laneWidth / 2, targetBaselineY + 20, '#ef4444');
        updateHUD();
        notes.splice(i, 1);
        continue;
      }

      if (n.y > 670 || n.hit) {
        notes.splice(i, 1);
      }
    }

    // Feedback texts
    for (let i = hitFeedbacks.length - 1; i >= 0; i--) {
      const f = hitFeedbacks[i];
      f.y -= 0.8;
      f.life -= 0.04;
      if (f.life <= 0) hitFeedbacks.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, 600, 650);

    // Lane dividing lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numLanes; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, 650);
      ctx.stroke();
    }

    // Target Baseline Bar
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, targetBaselineY);
    ctx.lineTo(600, targetBaselineY);
    ctx.stroke();

    // Target rings on baseline
    for (let i = 0; i < numLanes; i++) {
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.beginPath();
      ctx.arc(i * laneWidth + laneWidth / 2, targetBaselineY, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Render falling notes
    notes.forEach(n => {
      ctx.fillStyle = n.color;
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(n.lane * laneWidth + 18, n.y - 12, laneWidth - 36, 24, 8);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Hit feedbacks
    ctx.font = 'bold 16px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    hitFeedbacks.forEach(f => {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1.0;

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

  // Keyboard Handlers (D, F, J, K)
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === 'd' || e.key === 'D') triggerLane(0);
    if (e.key === 'f' || e.key === 'F') triggerLane(1);
    if (e.key === 'j' || e.key === 'J') triggerLane(2);
    if (e.key === 'k' || e.key === 'K') triggerLane(3);
  });

  // Buttons
  laneBtns.forEach((btn, idx) => {
    btn.addEventListener('pointerdown', () => triggerLane(idx));
  });

  startBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  restartBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  rulesBtn.addEventListener('click', () => rulesModal.classList.add('active'));
  closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('active'));
  rulesConfirmBtn.addEventListener('click', () => rulesModal.classList.remove('active'));

  render();
  loop();
})();
