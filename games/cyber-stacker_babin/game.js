/**
 * Cyber Tower Stacker
 * Pure HTML5 Canvas + Vanilla JS precision slicing physics
 */

(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const currentScoreEl = document.getElementById("current-score");
  const comboStreakEl = document.getElementById("combo-streak");
  const bestScoreEl = document.getElementById("best-score");

  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const finalScoreEl = document.getElementById("final-score");
  const finalComboEl = document.getElementById("final-combo");
  const finalBestEl = document.getElementById("final-best");

  const rulesBtn = document.getElementById("rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 560;
  const BLOCK_HEIGHT = 28;
  const INITIAL_WIDTH = 220;

  // Safe storage helpers
  function getStorage(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  }

  function setStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch {}
  }

  let stack = [];
  let level = 1;
  const levelDisplay = document.getElementById('level-display');
  let debris = [];
  let particles = [];
  let currentBlock = null;
  let blockSpeed = 3.5;
  let direction = 1;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let bestScore = parseInt(getStorage("arcadeverse_cyber_stacker_best", "0"), 10) || 0;
  let isPlaying = false;
  let animId = null;
  let gameOverTimeoutId = null;
  let lastTime = performance.now();

  function clearGameOverTimer() {
    if (gameOverTimeoutId) {
      clearTimeout(gameOverTimeoutId);
      gameOverTimeoutId = null;
    }
  }

  function stopLoop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  bestScoreEl.textContent = bestScore;

  function getHue(layer) {
    return (180 + layer * 9) % 360;
  }

  function initGame() {
    clearGameOverTimer();
    stopLoop();
    stack = [];
    debris = [];
    particles = [];
    score = 0;
    combo = 0;
    maxCombo = 0;
    blockSpeed = 3.5;
    direction = 1;

    currentScoreEl.textContent = "0";
    comboStreakEl.textContent = "0x";

    // Base block at the bottom
    const baseBlock = {
      x: (CANVAS_WIDTH - INITIAL_WIDTH) / 2,
      y: CANVAS_HEIGHT - BLOCK_HEIGHT * 2,
      width: INITIAL_WIDTH,
      hue: getHue(0)
    };
    stack.push(baseBlock);

    spawnNextBlock();
    isPlaying = true;
    startOverlay.classList.remove("active");
    gameoverOverlay.classList.remove("active");

    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function spawnNextBlock() {
    const prevBlock = stack[stack.length - 1];
    const layer = stack.length;
    const targetY = prevBlock.y - BLOCK_HEIGHT;

    // Camera shift down if tower climbs high
    if (targetY < 180) {
      const shift = BLOCK_HEIGHT;
      stack.forEach(b => b.y += shift);
      debris.forEach(d => d.y += shift);
    }

    currentBlock = {
      x: direction > 0 ? 0 : CANVAS_WIDTH - prevBlock.width,
      y: stack[stack.length - 1].y - BLOCK_HEIGHT,
      width: prevBlock.width,
      hue: getHue(layer)
    };

    blockSpeed = Math.min(8.5, 3.5 + layer * 0.12);
  }

  function placeBlock() {
    if (!isPlaying || !currentBlock) return;

    const prevBlock = stack[stack.length - 1];
    const diff = currentBlock.x - prevBlock.x;
    const tolerance = 4; // Perfect alignment threshold

    if (Math.abs(diff) <= tolerance) {
      // Perfect alignment!
      currentBlock.x = prevBlock.x;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      // Slight width recovery reward on combo
      if (combo % 3 === 0 && currentBlock.width < INITIAL_WIDTH) {
        currentBlock.width = Math.min(INITIAL_WIDTH, currentBlock.width + 10);
      }

      createPerfectSparks(currentBlock.x, currentBlock.y, currentBlock.width);
    } else if (Math.abs(diff) >= currentBlock.width) {
      // Complete miss!
      createFallingDebris(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.hue, diff > 0 ? 3 : -3);
      gameOver();
      return;
    } else {
      // Partial overhang slice
      combo = 0;
      let newWidth, newX, debrisX, debrisWidth, debrisDir;

      if (diff > 0) {
        // Overhang to the right
        newWidth = currentBlock.width - diff;
        newX = currentBlock.x;
        debrisX = currentBlock.x + newWidth;
        debrisWidth = diff;
        debrisDir = 2;
      } else {
        // Overhang to the left
        newWidth = currentBlock.width + diff;
        newX = prevBlock.x;
        debrisX = currentBlock.x;
        debrisWidth = -diff;
        debrisDir = -2;
      }

      currentBlock.x = newX;
      currentBlock.width = newWidth;
      createFallingDebris(debrisX, currentBlock.y, debrisWidth, currentBlock.hue, debrisDir);
    }

    stack.push(currentBlock);
    score++;
    currentScoreEl.textContent = score;
    comboStreakEl.textContent = `${combo}x`;

    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      try {
        localStorage.setItem("arcadeverse_cyber_stacker_best", bestScore);
      } catch (e) {}
    }

    direction = direction > 0 ? -1 : 1;
    spawnNextBlock();
  }

  function createFallingDebris(x, y, width, hue, vx) {
    debris.push({
      x,
      y,
      width,
      height: BLOCK_HEIGHT,
      hue,
      vx,
      vy: 1,
      rotation: 0,
      vRot: (Math.random() - 0.5) * 0.15,
      alpha: 1
    });
  }

  function createPerfectSparks(x, y, width) {
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: x + Math.random() * width,
        y: y + BLOCK_HEIGHT,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 4 - 2,
        life: 1,
        color: "#00f0ff"
      });
    }
  }

  function gameOver() {
    isPlaying = false;
    stopLoop();
    clearGameOverTimer();
    currentBlock = null;

    if (score > bestScore) {
      bestScore = score;
      setStorage("arcadeverse_cyber_stacker_best", bestScore);
      bestScoreEl.textContent = bestScore;
    }

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_SCORE',
        score: score,
        combo: maxCombo
      }, '*');
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_OVER',
        score: score,
        combo: maxCombo
      }, '*');
    }

    finalScoreEl.textContent = score;
    finalComboEl.textContent = `${maxCombo}x`;
    finalBestEl.textContent = bestScore;

    gameOverTimeoutId = setTimeout(() => {
      gameOverTimeoutId = null;
      gameoverOverlay.classList.add("active");
    }, 600);
  }

  function update(deltaMs = 16.67) {
    const dtScale = Math.min(2.0, Math.max(0.2, deltaMs / 16.667));

    if (isPlaying && currentBlock) {
      currentBlock.x += blockSpeed * direction * dtScale;
      if (currentBlock.x + currentBlock.width >= CANVAS_WIDTH) {
        currentBlock.x = CANVAS_WIDTH - currentBlock.width;
        direction = -1;
      } else if (currentBlock.x <= 0) {
        currentBlock.x = 0;
        direction = 1;
      }
    }

    // Update debris
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.x += d.vx * dtScale;
      d.y += d.vy * dtScale;
      d.vy += 0.4 * dtScale; // gravity
      d.rotation += d.vRot * dtScale;
      d.alpha -= 0.015 * dtScale;

      if (d.y > CANVAS_HEIGHT + 50 || d.alpha <= 0) {
        debris.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dtScale;
      p.y += p.vy * dtScale;
      p.life -= 0.03 * dtScale;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Draw stacked blocks
    stack.forEach((b, index) => {
      ctx.save();
      ctx.fillStyle = `hsl(${b.hue}, 85%, 55%)`;
      ctx.shadowColor = `hsl(${b.hue}, 85%, 65%)`;
      ctx.shadowBlur = 10;
      ctx.fillRect(b.x, b.y, b.width, BLOCK_HEIGHT - 2);

      // Top edge highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(b.x, b.y, b.width, 3);
      ctx.restore();
    });

    // Draw current active moving block
    if (currentBlock) {
      ctx.save();
      ctx.fillStyle = `hsl(${currentBlock.hue}, 95%, 60%)`;
      ctx.shadowColor = `hsl(${currentBlock.hue}, 95%, 70%)`;
      ctx.shadowBlur = 15;
      ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, BLOCK_HEIGHT - 2);

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, 3);
      ctx.restore();
    }

    // Draw falling debris
    debris.forEach(d => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.translate(d.x + d.width / 2, d.y + d.height / 2);
      ctx.rotate(d.rotation);
      ctx.fillStyle = `hsl(${d.hue}, 70%, 50%)`;
      ctx.fillRect(-d.width / 2, -d.height / 2, d.width, d.height);
      ctx.restore();
    });

    // Draw sparks
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.restore();
    });
  }

  function loop(now = performance.now()) {
    const deltaMs = Math.min(64, now - lastTime);
    lastTime = now;

    update(deltaMs);
    draw();
    if (isPlaying) {
      animId = requestAnimationFrame(loop);
    }
  }

  // Event Listeners
  startBtn.addEventListener("click", initGame);
  restartBtn.addEventListener("click", initGame);

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (isPlaying) placeBlock();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (isPlaying) placeBlock();
      else if (startOverlay.classList.contains("active")) initGame();
      else if (gameoverOverlay.classList.contains("active")) initGame();
    }
  });

  // Modal Handlers
  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("active");
  });

  // Modal lifecycle hooks
  window.addEventListener('pagehide', () => {
    stopLoop();
    clearGameOverTimer();
  });

  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'ARCADEVERSE_TEARDOWN') {
      isPlaying = false;
      stopLoop();
      clearGameOverTimer();
    }
  });
})();
