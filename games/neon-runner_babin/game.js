/**
 * Neon Beat Runner
 * Pure Vanilla JavaScript 4-lane procedural rhythm runner with Web Audio API
 */

(() => {
  const canvas = document.getElementById("rhythm-canvas");
  const ctx = canvas.getContext("2d");

  const scoreDisplay = document.getElementById("score-display");
  const comboDisplay = document.getElementById("combo-display");
  const bestScoreEl = document.getElementById("best-score");
  const feedbackBanner = document.getElementById("feedback-banner");

  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const finalScoreEl = document.getElementById("final-score");
  const finalComboEl = document.getElementById("final-combo");
  const finalPerfectsEl = document.getElementById("final-perfects");

  const rulesBtn = document.getElementById("rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  const touchLanes = [
    document.getElementById("touch-0"),
    document.getElementById("touch-1"),
    document.getElementById("touch-2"),
    document.getElementById("touch-3")
  ];

  const CANVAS_WIDTH = 360;
  const CANVAS_HEIGHT = 520;
  const NUM_LANES = 4;
  const LANE_WIDTH = CANVAS_WIDTH / NUM_LANES;
  const TARGET_Y = CANVAS_HEIGHT - 65;
  const PULSE_SPEED = 4.2;

  const LANE_COLORS = ["#00f0ff", "#f43f5e", "#fbbf24", "#a855f7"];
  const LANE_FREQUENCIES = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4 chords

  let audioCtx = null;
  function playHitSound(freq) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  let pulses = [];
  let score = 0;
  let level = 1;
  let totalHits = 0;
  const levelDisplay = document.getElementById('level-display');
  if (levelDisplay) levelDisplay.textContent = level;
  let combo = 0;
  let maxCombo = 0;
  let perfects = 0;
  let isPlaying = false;
  let animId = null;
  let spawnTimer = 0;
  let songDuration = 1800; // ~40 seconds of gameplay
  let songProgress = 0;
  let bestScore = 0;
  try {
    bestScore = parseInt(localStorage.getItem("arcadeverse_neon_runner_best") || "0", 10) || 0;
  } catch (e) {}

  bestScoreEl.textContent = bestScore;

  function setFeedback(text, type) {
    feedbackBanner.textContent = text;
    feedbackBanner.className = `feedback-banner ${type}`;
    setTimeout(() => {
      if (feedbackBanner.textContent === text) {
        feedbackBanner.className = "feedback-banner";
      }
    }, 350);
  }

  function spawnPulse() {
    const lane = Math.floor(Math.random() * NUM_LANES);
    pulses.push({
      lane,
      y: -20,
      width: LANE_WIDTH - 12,
      height: 18,
      hit: false
    });
  }

  function handleHit(lane) {
    if (!isPlaying) return;

    // Find pulse closest to target line in this lane
    let closestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < pulses.length; i++) {
      const p = pulses[i];
      if (p.lane === lane && !p.hit) {
        const dist = Math.abs(p.y - TARGET_Y);
        if (dist < minDistance && dist < 70) {
          minDistance = dist;
          closestIndex = i;
        }
      }
    }

    if (closestIndex !== -1) {
      const p = pulses[closestIndex];
      p.hit = true;
      playHitSound(LANE_FREQUENCIES[lane]);

      totalHits++;
      level = Math.floor(totalHits / 15) + 1;
      if (levelDisplay) levelDisplay.textContent = level;

      totalHits++;
      level = Math.floor(totalHits / 15) + 1;
      if (levelDisplay) levelDisplay.textContent = level;

      if (minDistance <= 22) {
        // PERFECT!
        combo++;
        perfects++;
        const multiplier = combo > 20 ? 4 : (combo > 10 ? 2 : 1);
        score += 100 * multiplier;
        setFeedback("PERFECT!", "perfect");
      } else {
        // GOOD!
        combo++;
        score += 50;
        setFeedback("GOOD", "good");
      }

      if (combo > maxCombo) maxCombo = combo;
      scoreDisplay.textContent = score;
      comboDisplay.textContent = `${combo}x`;

      if (score > bestScore) {
        bestScore = score;
        bestScoreEl.textContent = bestScore;
        try {
          localStorage.setItem("arcadeverse_neon_runner_best", bestScore);
        } catch (e) {}
      }
    }
  }

  function update() {
    if (!isPlaying) return;

    songProgress++;
    if (songProgress >= songDuration && pulses.length === 0) {
      gameOver();
      return;
    }

    // Spawn rhythmic pulses
    spawnTimer++;
    if (spawnTimer > 36 && songProgress < songDuration) {
      spawnPulse();
      spawnTimer = 0;
    }

    // Update pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.y += PULSE_SPEED;

      // Missed pulse passes bottom line
      if (p.y > TARGET_Y + 55 && !p.hit) {
        p.hit = true;
        combo = 0;
        comboDisplay.textContent = "0x";
        setFeedback("MISS", "miss");
      }

      if (p.y > CANVAS_HEIGHT + 30) {
        pulses.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw lane dividers
    for (let i = 1; i < NUM_LANES; i++) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i * LANE_WIDTH, 0);
      ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT);
      ctx.stroke();
    }

    // Draw Target Hit Line
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, TARGET_Y);
    ctx.lineTo(CANVAS_WIDTH, TARGET_Y);
    ctx.stroke();

    // Target lane catchers
    for (let i = 0; i < NUM_LANES; i++) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(i * LANE_WIDTH + 6, TARGET_Y - 10, LANE_WIDTH - 12, 20);
    }
    ctx.restore();

    // Draw falling pulses
    for (const p of pulses) {
      if (p.hit) continue;
      const color = LANE_COLORS[p.lane];
      const x = p.lane * LANE_WIDTH + 6;

      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(x, p.y, p.width, p.height, 6);
      ctx.fill();

      // Top pulse shine
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(x + 4, p.y + 2, p.width - 8, 3);
      ctx.restore();
    }
  }

  // Multi-Monitor Refresh Rate Decoupling (Fixed Timestep Accumulator #560)
  const FIXED_DT = 1 / 60;
  let accumulator = 0;
  let lastTime = performance.now();

  function loop(now) {
    if (now === undefined) now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += dt;

    while (accumulator >= FIXED_DT) {
      update();
      accumulator -= FIXED_DT;
    }

    draw();
    animId = requestAnimationFrame(loop);
  }

  function gameOver() {
    isPlaying = false;
    finalScoreEl.textContent = score;
    finalComboEl.textContent = `${maxCombo}x`;
    finalPerfectsEl.textContent = perfects;

    setTimeout(() => {
      gameoverOverlay.classList.add("active");
    }, 600);
  }

  function initGame() {
    pulses = [];
    score = 0;
    level = 1;
    totalHits = 0;
    if (levelDisplay) levelDisplay.textContent = level;
    combo = 0;
    maxCombo = 0;
    perfects = 0;
    songProgress = 0;
    spawnTimer = 0;
    isPlaying = true;

    scoreDisplay.textContent = "0";
    comboDisplay.textContent = "0x";
    feedbackBanner.className = "feedback-banner";
    feedbackBanner.textContent = "SYNCED";

    startOverlay.classList.remove("active");
    gameoverOverlay.classList.remove("active");

    if (animId) cancelAnimationFrame(animId);
    accumulator = 0;
    lastTime = performance.now();
    loop();
  }

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "d" || key === "1") handleHit(0);
    else if (key === "f" || key === "2") handleHit(1);
    else if (key === "j" || key === "3") handleHit(2);
    else if (key === "k" || key === "4") handleHit(3);
    else if ((e.code === "Space" || e.code === "Enter") && !isPlaying) {
      e.preventDefault();
      initGame();
    } else if (e.code === "Escape") {
      if (rulesModal && rulesModal.classList.contains("active")) {
        rulesModal.classList.remove("active");
      }
    }
  });

  // Touch lane triggers
  touchLanes.forEach((btn, index) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handleHit(index);
    });
  });

  startBtn.addEventListener("click", initGame);
  restartBtn.addEventListener("click", initGame);

  // Modal Handlers
  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("active");
  });
})();
