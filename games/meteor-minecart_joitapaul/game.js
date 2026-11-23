(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const distanceEl = document.getElementById("distance");
  const speedEl = document.getElementById("speed");
  const multiplierEl = document.getElementById("multiplier");
  const healthEl = document.getElementById("health");
  const shieldCountEl = document.getElementById("shield-count");
  const pauseOverlay = document.getElementById("pause-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const gameoverCopy = document.getElementById("gameover-copy");
  const rulesModal = document.getElementById("rules-modal");

  const laneCenters = [175, 350, 525];
  let lane = 1;
  let targetLane = 1;
  let cartX = laneCenters[lane];
  let score = 0;
  let distance = 0;
  let health = 3;
  let multiplier = 1;
  let crystalStreak = 0;
  let speed = 280;
  let shields = 3;
  let shieldTimer = 0;
  let paused = true;
  let gameOver = false;
  let lastTime = 0;
  let spawnMeteorTimer = 0;
  let spawnCrystalTimer = 0;
  let trackOffset = 0;
  let meteors = [];
  let crystals = [];
  let particles = [];
  let touchStartX = null;

  function formatNumber(value) {
    return Math.max(0, Math.floor(value)).toLocaleString("en-US");
  }

  function updateHUD() {
    scoreEl.textContent = formatNumber(score);
    distanceEl.textContent = `${formatNumber(distance)}m`;
    speedEl.textContent = `${(speed / 280).toFixed(1)}x`;
    multiplierEl.textContent = `x${multiplier}`;
    healthEl.textContent = String(health);
    shieldCountEl.textContent = String(shields);
  }

  function resetGame() {
    lane = 1;
    targetLane = 1;
    cartX = laneCenters[lane];
    score = 0;
    distance = 0;
    health = 3;
    multiplier = 1;
    crystalStreak = 0;
    speed = 280;
    shields = 3;
    shieldTimer = 0;
    paused = false;
    gameOver = false;
    lastTime = performance.now();
    spawnMeteorTimer = 0.7;
    spawnCrystalTimer = 0.25;
    trackOffset = 0;
    meteors = [];
    crystals = [];
    particles = [];
    pauseOverlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    updateHUD();
  }

  function moveLane(direction) {
    if (paused || gameOver) return;
    targetLane = Math.max(0, Math.min(2, targetLane + direction));
  }

  function activateShield() {
    if (paused || gameOver || shieldTimer > 0 || shields <= 0) return;
    shields--;
    shieldTimer = 4;
    updateHUD();
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    pauseOverlay.classList.toggle("hidden", !paused);
    if (!paused) lastTime = performance.now();
  }

  function endGame() {
    gameOver = true;
    paused = true;

    let best = 0;
    try {
      best = Number(localStorage.getItem("meteor-minecart-best") || 0);
      if (score > best) localStorage.setItem("meteor-minecart-best", String(Math.floor(score)));
    } catch (_) {}

    gameoverCopy.textContent = `${formatNumber(score)} points - ${formatNumber(distance)}m - Best ${formatNumber(Math.max(best, score))}`;
    gameoverOverlay.classList.remove("hidden");
  }

  function spawnMeteor() {
    const laneIndex = Math.floor(Math.random() * 3);
    meteors.push({
      lane: laneIndex,
      y: -70,
      radius: 26 + Math.random() * 10,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2
    });
  }

  function spawnCrystal() {
    const laneIndex = Math.floor(Math.random() * 3);
    crystals.push({
      lane: laneIndex,
      y: -40,
      radius: 18,
      rotation: Math.random() * Math.PI
    });
  }

  function spawnBurst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * (70 + Math.random() * 100),
        vy: Math.sin(angle) * (70 + Math.random() * 100),
        life: 0.5,
        color
      });
    }
  }

  function collides(item) {
    const itemX = laneCenters[item.lane];
    const cartY = 590;
    return Math.abs(cartX - itemX) < 58 &&
      Math.abs(cartY - item.y) < (item.radius + 28);
  }

  function update(delta) {
    if (paused || gameOver) return;

    cartX += (laneCenters[targetLane] - cartX) * Math.min(1, delta * 10);
    lane = targetLane;

    speed = Math.min(620, 280 + distance * 0.7);
    distance += speed * delta * 0.025;
    score += delta * 18 * multiplier;
    trackOffset = (trackOffset + speed * delta) % 120;

    if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - delta);

    spawnMeteorTimer -= delta;
    if (spawnMeteorTimer <= 0) {
      spawnMeteor();
      const minimum = Math.max(0.38, 0.95 - distance / 2200);
      spawnMeteorTimer = minimum + Math.random() * 0.45;
    }

    spawnCrystalTimer -= delta;
    if (spawnCrystalTimer <= 0) {
      spawnCrystal();
      spawnCrystalTimer = 0.55 + Math.random() * 0.55;
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const meteor = meteors[i];
      meteor.y += speed * delta;
      meteor.rotation += meteor.spin * delta;

      if (collides(meteor)) {
        meteors.splice(i, 1);
        if (shieldTimer > 0) {
          spawnBurst(cartX, 590, "#62e7ff");
        } else {
          health--;
          crystalStreak = 0;
          multiplier = 1;
          spawnBurst(cartX, 590, "#ff6d7a");
          updateHUD();
          if (health <= 0) endGame();
        }
      } else if (meteor.y > 760) {
        meteors.splice(i, 1);
      }
    }

    for (let i = crystals.length - 1; i >= 0; i--) {
      const crystal = crystals[i];
      crystal.y += speed * delta;
      crystal.rotation += delta * 2;

      if (collides(crystal)) {
        crystals.splice(i, 1);
        crystalStreak++;
        if (crystalStreak >= 12) multiplier = 5;
        else if (crystalStreak >= 8) multiplier = 4;
        else if (crystalStreak >= 5) multiplier = 3;
        else if (crystalStreak >= 3) multiplier = 2;
        score += 100 * multiplier;
        spawnBurst(laneCenters[crystal.lane], crystal.y, "#ffc86b");
        updateHUD();
      } else if (crystal.y > 760) {
        crystals.splice(i, 1);
        crystalStreak = 0;
        multiplier = 1;
        updateHUD();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      if (particle.life <= 0) particles.splice(i, 1);
    }

    updateHUD();
  }

  function drawTrack() {
    ctx.fillStyle = "#070914";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const trackLeft = 85;
    const trackWidth = 530;
    ctx.fillStyle = "#11182c";
    ctx.fillRect(trackLeft, 0, trackWidth, canvas.height);

    ctx.strokeStyle = "rgba(98, 231, 255, 0.22)";
    ctx.lineWidth = 3;
    for (let i = 1; i < 3; i++) {
      const x = trackLeft + (trackWidth / 3) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(158, 134, 255, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([24, 18]);
    ctx.lineDashOffset = -trackOffset;
    for (let i = 0; i < 3; i++) {
      const x = laneCenters[i];
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = "#26304f";
    ctx.fillRect(trackLeft - 18, 0, 18, canvas.height);
    ctx.fillRect(trackLeft + trackWidth, 0, 18, canvas.height);

    ctx.fillStyle = "rgba(255, 200, 107, 0.8)";
    for (let y = -120 + trackOffset; y < canvas.height + 120; y += 120) {
      ctx.fillRect(trackLeft - 13, y, 8, 42);
      ctx.fillRect(trackLeft + trackWidth + 5, y, 8, 42);
    }
  }

  function drawMeteor(meteor) {
    const x = laneCenters[meteor.lane];
    ctx.save();
    ctx.translate(x, meteor.y);
    ctx.rotate(meteor.rotation);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const angle = (Math.PI * 2 * i) / 9;
      const radius = meteor.radius * (i % 2 === 0 ? 1 : 0.78);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#7a5a69";
    ctx.fill();
    ctx.strokeStyle = "#ff8c74";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawCrystal(crystal) {
    const x = laneCenters[crystal.lane];
    ctx.save();
    ctx.translate(x, crystal.y);
    ctx.rotate(crystal.rotation);
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(-16, 0);
    ctx.closePath();
    ctx.fillStyle = "#ffc86b";
    ctx.fill();
    ctx.strokeStyle = "#fff2a8";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawCart() {
    ctx.save();
    ctx.translate(cartX, 590);

    if (shieldTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(98, 231, 255, 0.9)";
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.fillStyle = "#9e86ff";
    ctx.strokeStyle = "#62e7ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-42, -25);
    ctx.lineTo(42, -25);
    ctx.lineTo(32, 28);
    ctx.lineTo(-32, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#11182c";
    ctx.fillRect(-22, -12, 44, 24);
    ctx.fillStyle = "#62e7ff";
    ctx.fillRect(-10, -8, 20, 16);

    ctx.fillStyle = "#090b16";
    ctx.beginPath();
    ctx.arc(-29, 30, 9, 0, Math.PI * 2);
    ctx.arc(29, 30, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(particle => {
      ctx.globalAlpha = Math.max(0, particle.life / 0.5);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawTrack();
    meteors.forEach(drawMeteor);
    crystals.forEach(drawCrystal);
    drawParticles();
    drawCart();
  }

  function gameLoop(timestamp) {
    const delta = Math.min(0.033, Math.max(0, (timestamp - lastTime) / 1000));
    lastTime = timestamp;
    update(delta);
    draw();
    requestAnimationFrame(gameLoop);
  }

  canvas.addEventListener("touchstart", event => {
    if (event.changedTouches.length) touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  canvas.addEventListener("touchend", event => {
    if (touchStartX === null || !event.changedTouches.length) return;
    const endX = event.changedTouches[0].clientX;
    const difference = endX - touchStartX;
    if (Math.abs(difference) > 28) moveLane(difference > 0 ? 1 : -1);
    touchStartX = null;
  }, { passive: true });

  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (key === "p") {
      event.preventDefault();
      togglePause();
    } else if (key === "r") {
      event.preventDefault();
      resetGame();
    } else if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      moveLane(-1);
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      moveLane(1);
    } else if (key === "arrowdown" || key === "s") {
      event.preventDefault();
      activateShield();
    }
  });

  document.getElementById("left-btn").addEventListener("click", () => moveLane(-1));
  document.getElementById("right-btn").addEventListener("click", () => moveLane(1));
  document.getElementById("shield-btn").addEventListener("click", activateShield);
  document.getElementById("pause-btn").addEventListener("click", togglePause);
  document.getElementById("resume-btn").addEventListener("click", togglePause);
  document.getElementById("restart-btn").addEventListener("click", resetGame);
  document.getElementById("playagain-btn").addEventListener("click", resetGame);
  document.getElementById("rules-btn").addEventListener("click", () => rulesModal.classList.remove("hidden"));
  document.getElementById("close-rules-btn").addEventListener("click", () => {
    rulesModal.classList.add("hidden");
    if (paused && !gameOver) {
      paused = false;
      lastTime = performance.now();
    }
  });

  window.addEventListener("message", event => {
    if (event.data && event.data.type === "AV_RESIZE") draw();
  });

  rulesModal.classList.remove("hidden");
  resetGame();
  paused = true;
  pauseOverlay.classList.add("hidden");
  updateHUD();
  requestAnimationFrame(gameLoop);
})();
