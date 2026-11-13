/**
 * Space Invaders 2026
 * Pure HTML5 Canvas + Web Audio API alien invasion defense
 */

(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const scoreDisplay = document.getElementById("score-display");
  const waveDisplay = document.getElementById("wave-display");
  const livesDisplay = document.getElementById("lives-display");
  const hiScoreDisplay = document.getElementById("hi-score-display");

  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const finalScoreEl = document.getElementById("final-score");
  const finalWaveEl = document.getElementById("final-wave");
  const finalKillsEl = document.getElementById("final-kills");
  const gameoverTitle = document.getElementById("gameover-title");
  const gameoverIcon = document.getElementById("gameover-icon");

  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnFire = document.getElementById("btn-fire");

  const rulesBtn = document.getElementById("rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  const CANVAS_WIDTH = 480;
  const CANVAS_HEIGHT = 600;

  // Web Audio Context for synthesizer sound effects
  let audioCtx = null;
  function playTone(freq, type = "square", duration = 0.08) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent
    }
  }

  let isPlaying = false;
  let score = 0;
  let wave = 1;
  let lives = 3;
  let kills = 0;
  let hiScore = 0;
  try {
    hiScore = parseInt(localStorage.getItem("arcadeverse_space_invaders_hi") || "0", 10) || 0;
  } catch (e) {
    hiScore = 0;
  }
  let animId = null;
  let gameOverTimer = null;

  hiScoreDisplay.textContent = String(hiScore).padStart(4, "0");

  // Player Cannon
  const player = {
    x: CANVAS_WIDTH / 2 - 16,
    y: CANVAS_HEIGHT - 45,
    width: 32,
    height: 20,
    speed: 5.5,
    isMovingLeft: false,
    isMovingRight: false,
    canShoot: true,
    lastShootTime: 0
  };

  let playerBullets = [];
  let alienBullets = [];
  let aliens = [];
  let bunkers = [];
  let particles = [];
  let ufo = null;
  let ufoTimer = 0;

  let alienDirection = 1;
  let alienStepDown = false;
  let alienSpeed = 1.0;

  function initBunkers() {
    bunkers = [];
    const bunkerCount = 3;
    const bunkerWidth = 60;
    const bunkerHeight = 36;
    const spacing = (CANVAS_WIDTH - bunkerCount * bunkerWidth) / (bunkerCount + 1);

    for (let b = 0; b < bunkerCount; b++) {
      const bx = spacing + b * (bunkerWidth + spacing);
      const by = CANVAS_HEIGHT - 120;
      const blocks = [];
      const rows = 4;
      const cols = 6;
      const bw = bunkerWidth / cols;
      const bh = bunkerHeight / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Arch cutout in the middle bottom
          if (r >= 2 && (c === 2 || c === 3)) continue;
          blocks.push({
            x: bx + c * bw,
            y: by + r * bh,
            width: bw,
            height: bh,
            health: 3
          });
        }
      }
      bunkers.push(blocks);
    }
  }

  function spawnAliens() {
    aliens = [];
    const rows = 4;
    const cols = 8;
    const startX = 40;
    const startY = 65;
    const xSpacing = 44;
    const ySpacing = 34;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type = "octopus";
        let points = 10;
        let color = "#38bdf8";

        if (r === 0) {
          type = "squid";
          points = 30;
          color = "#ec4899";
        } else if (r === 1 || r === 2) {
          type = "crab";
          points = 20;
          color = "#a855f7";
        }

        aliens.push({
          x: startX + c * xSpacing,
          y: startY + r * ySpacing,
          width: 28,
          height: 20,
          type,
          points,
          color,
          frame: 0
        });
      }
    }

    alienDirection = 1;
    alienSpeed = 1.0 + (wave - 1) * 0.35;
  }

  function initGame() {
    score = 0;
    wave = 1;
    lives = 3;
    kills = 0;
    playerBullets = [];
    alienBullets = [];
    particles = [];
    ufo = null;
    ufoTimer = 0;

    player.x = CANVAS_WIDTH / 2 - player.width / 2;

    updateHUD();
    initBunkers();
    spawnAliens();

    isPlaying = true;
    startOverlay.classList.remove("active");
    gameoverOverlay.classList.remove("active");

    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function updateHUD() {
    scoreDisplay.textContent = String(score).padStart(4, "0");
    waveDisplay.textContent = wave;
    const shipSvg = '<svg class="life-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>';
    livesDisplay.innerHTML = Array(lives).fill(shipSvg).join("");

    if (score > hiScore) {
      hiScore = score;
      hiScoreDisplay.textContent = String(hiScore).padStart(4, "0");
      try {
        localStorage.setItem("arcadeverse_space_invaders_hi", hiScore);
      } catch (e) {}
    }
  }

  function shootLaser() {
    if (!isPlaying) return;
    const now = Date.now();
    if (now - player.lastShootTime < 280) return; // Fire rate limit

    playerBullets.push({
      x: player.x + player.width / 2 - 2,
      y: player.y - 6,
      width: 4,
      height: 12,
      speed: 8
    });
    player.lastShootTime = now;
    playTone(880, "square", 0.05);
  }

  function spawnUfo() {
    if (ufo || !isPlaying) return;
    ufo = {
      x: 0,
      y: 35,
      width: 40,
      height: 18,
      speed: 2.2,
      points: Math.floor(Math.random() * 3 + 1) * 100
    };
    playTone(550, "sine", 0.2);
  }

  function createExplosion(x, y, color = "#f43f5e", count = 16) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color
      });
    }
  }

  function gameOver(won = false) {
    isPlaying = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (gameOverTimer) {
      clearTimeout(gameOverTimer);
      gameOverTimer = null;
    }
    finalScoreEl.textContent = score;
    finalWaveEl.textContent = wave;
    finalKillsEl.textContent = kills;

    if (won) {
      gameoverTitle.textContent = "Galaxy Liberated!";
      gameoverIcon.innerHTML = `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
    } else {
      gameoverTitle.textContent = "Defense Pierced";
      gameoverIcon.innerHTML = `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }

    try {
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: score }, '*');
      window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER' }, '*');
    } catch (_) {}

    gameOverTimer = setTimeout(() => {
      gameoverOverlay.classList.add("active");
    }, 600);
  }

  function update() {
    if (!isPlaying) return;

    // Move player
    if (player.isMovingLeft) player.x = Math.max(10, player.x - player.speed);
    if (player.isMovingRight) player.x = Math.min(CANVAS_WIDTH - player.width - 10, player.x + player.speed);

    // Player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.y -= b.speed;

      // Check hit UFO
      if (ufo && b.x < ufo.x + ufo.width && b.x + b.width > ufo.x && b.y < ufo.y + ufo.height && b.y + b.height > ufo.y) {
        score += ufo.points;
        createExplosion(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, "#f43f5e", 25);
        playTone(990, "sine", 0.2);
        ufo = null;
        playerBullets.splice(i, 1);
        updateHUD();
        continue;
      }

      // Check hit aliens
      let hitAlien = false;
      for (let j = aliens.length - 1; j >= 0; j--) {
        const a = aliens[j];
        if (b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y) {
          score += a.points;
          kills++;
          createExplosion(a.x + a.width / 2, a.y + a.height / 2, a.color, 14);
          playTone(330, "sawtooth", 0.08);
          aliens.splice(j, 1);
          playerBullets.splice(i, 1);
          hitAlien = true;
          updateHUD();
          break;
        }
      }
      if (hitAlien) continue;

      // Check hit bunkers
      let hitBunker = false;
      for (const bunker of bunkers) {
        for (let k = bunker.length - 1; k >= 0; k--) {
          const block = bunker[k];
          if (b.x < block.x + block.width && b.x + b.width > block.x && b.y < block.y + block.height && b.y + b.height > block.y) {
            block.health--;
            if (block.health <= 0) bunker.splice(k, 1);
            playerBullets.splice(i, 1);
            hitBunker = true;
            break;
          }
        }
        if (hitBunker) break;
      }
      if (hitBunker) continue;

      if (b.y < -10) playerBullets.splice(i, 1);
    }

    // Alien Armada Movement
    let hitEdge = false;
    let lowestAlienY = 0;

    for (const a of aliens) {
      if (a.y + a.height > lowestAlienY) lowestAlienY = a.y + a.height;
      if (alienDirection > 0 && a.x + a.width >= CANVAS_WIDTH - 15) hitEdge = true;
      else if (alienDirection < 0 && a.x <= 15) hitEdge = true;
    }

    if (hitEdge) {
      alienDirection *= -1;
      for (const a of aliens) {
        a.y += 18;
      }
      // Speed accelerates as aliens are eliminated
      const remainingRatio = aliens.length / 32;
      alienSpeed = Math.min(4.5, (1.0 + (wave - 1) * 0.3) + (1 - remainingRatio) * 2.5);
    } else {
      for (const a of aliens) {
        a.x += alienSpeed * alienDirection;
      }
    }

    // Check invasion reached bunkers
    if (lowestAlienY >= CANVAS_HEIGHT - 130) {
      gameOver(false);
      return;
    }

    // Check wave cleared (Infinite Level Scaling)
    if (aliens.length === 0) {
      wave++;
      score += 500 * wave;
      // Bunker durability recovery
      for (const cluster of bunkers) {
        for (const cell of cluster) {
          if (cell.health < 3) cell.health++;
        }
      }
      updateHUD();
      playTone(660, "triangle", 0.3);
      spawnAliens();
    }

    // Alien Shooting
    if (Math.random() < 0.035 && aliens.length > 0 && alienBullets.length < 5) {
      const shooter = aliens[Math.floor(Math.random() * aliens.length)];
      alienBullets.push({
        x: shooter.x + shooter.width / 2 - 2,
        y: shooter.y + shooter.height,
        width: 4,
        height: 10,
        speed: 4.0 + wave * 0.2
      });
    }

    // Alien bullets update
    for (let i = alienBullets.length - 1; i >= 0; i--) {
      const ab = alienBullets[i];
      ab.y += ab.speed;

      // Hit player
      if (ab.x < player.x + player.width && ab.x + ab.width > player.x && ab.y < player.y + player.height && ab.y + ab.height > player.y) {
        createExplosion(player.x + player.width / 2, player.y + player.height / 2, "#00f0ff", 25);
        playTone(150, "sawtooth", 0.3);
        lives--;
        alienBullets.splice(i, 1);
        updateHUD();

        if (lives <= 0) {
          gameOver(false);
          return;
        }
        continue;
      }

      // Hit bunkers
      let hitBunker = false;
      for (const bunker of bunkers) {
        for (let k = bunker.length - 1; k >= 0; k--) {
          const block = bunker[k];
          if (ab.x < block.x + block.width && ab.x + ab.width > block.x && ab.y < block.y + block.height && ab.y + ab.height > block.y) {
            block.health--;
            if (block.health <= 0) bunker.splice(k, 1);
            alienBullets.splice(i, 1);
            hitBunker = true;
            break;
          }
        }
        if (hitBunker) break;
      }
      if (hitBunker) continue;

      if (ab.y > CANVAS_HEIGHT + 10) alienBullets.splice(i, 1);
    }

    // UFO update
    ufoTimer++;
    if (!ufo && ufoTimer > 700) {
      spawnUfo();
      ufoTimer = 0;
    }
    if (ufo) {
      ufo.x += ufo.speed;
      if (ufo.x > CANVAS_WIDTH + 50) ufo = null;
    }

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stars background
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 73) % CANVAS_WIDTH;
      const sy = (i * 109) % CANVAS_HEIGHT;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Draw Bunkers
    for (const bunker of bunkers) {
      for (const block of bunker) {
        const alpha = block.health / 3;
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.fillRect(block.x, block.y, block.width - 1, block.height - 1);
      }
    }

    // Draw Aliens
    for (const a of aliens) {
      ctx.save();
      ctx.fillStyle = a.color;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 8;

      // Alien body & antennae
      ctx.fillRect(a.x + 4, a.y + 4, a.width - 8, a.height - 6);
      ctx.fillRect(a.x + 2, a.y + a.height - 4, 6, 4);
      ctx.fillRect(a.x + a.width - 8, a.y + a.height - 4, 6, 4);
      ctx.fillRect(a.x + 6, a.y, 4, 4);
      ctx.fillRect(a.x + a.width - 10, a.y, 4, 4);

      // Alien glowing eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(a.x + 8, a.y + 8, 3, 3);
      ctx.fillRect(a.x + a.width - 11, a.y + 8, 3, 3);
      ctx.restore();
    }

    // Draw UFO
    if (ufo) {
      ctx.save();
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, ufo.width / 2, ufo.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(ufo.x + 12, ufo.y + 4, 16, 4);
      ctx.restore();
    }

    // Draw Player Cannon
    ctx.save();
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 12;
    ctx.fillRect(player.x + 2, player.y + 8, player.width - 4, player.height - 8);
    ctx.fillRect(player.x + player.width / 2 - 3, player.y, 6, 8);
    ctx.restore();

    // Draw Player Bullets
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 6;
    for (const b of playerBullets) {
      ctx.fillRect(b.x, b.y, b.width, b.height);
    }

    // Draw Alien Bullets
    ctx.fillStyle = "#f43f5e";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 6;
    for (const ab of alienBullets) {
      ctx.fillRect(ab.x, ab.y, ab.width, ab.height);
    }

    // Draw Particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.restore();
    }
  }

  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  // Keyboard Event Handlers
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      player.isMovingLeft = true;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      player.isMovingRight = true;
    } else if (e.code === "Space") {
      e.preventDefault();
      if (isPlaying) shootLaser();
      else if (startOverlay.classList.contains("active")) initGame();
      else if (gameoverOverlay.classList.contains("active")) initGame();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") player.isMovingLeft = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") player.isMovingRight = false;
  });

  // Mobile Touch Controls
  btnLeft.addEventListener("pointerdown", () => player.isMovingLeft = true);
  btnLeft.addEventListener("pointerup", () => player.isMovingLeft = false);
  btnLeft.addEventListener("pointerleave", () => player.isMovingLeft = false);

  btnRight.addEventListener("pointerdown", () => player.isMovingRight = true);
  btnRight.addEventListener("pointerup", () => player.isMovingRight = false);
  btnRight.addEventListener("pointerleave", () => player.isMovingRight = false);

  btnFire.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (isPlaying) shootLaser();
  });

  startBtn.addEventListener("click", initGame);
  restartBtn.addEventListener("click", initGame);

  // Modal Handlers
  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("active");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying) {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    } else if (!document.hidden && isPlaying && !animId) {
      animId = requestAnimationFrame(loop);
    }
  });

  window.addEventListener("message", (e) => {
    if (!e.data || typeof e.data !== "object") return;
    const type = e.data.type;
    if (type === "ARCADEVERSE_PAUSE") {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    } else if (type === "ARCADEVERSE_RESUME") {
      if (isPlaying && !animId) {
        animId = requestAnimationFrame(loop);
      }
    } else if (type === "ARCADEVERSE_TEARDOWN") {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      if (gameOverTimer) {
        clearTimeout(gameOverTimer);
        gameOverTimer = null;
      }
    } else if (type === "AV_RESIZE") {
      const d = e.data;
      if (d.width && d.height && canvas) {
        canvas.width = d.width;
        canvas.height = d.height;
      }
    }
  });
})();
