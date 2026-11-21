"use strict";

(() => {
  const WIDTH = 960;
  const HEIGHT = 540;
  const PLAYER_WIDTH = 30;
  const PLAYER_HEIGHT = 42;
  const GRAVITY = 1550;
  const JUMP_SPEED = 610;
  const MOVE_SPEED = 325;
  const ACCELERATION = 2100;
  const FRICTION = 1900;
  const directions = {
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "d"],
    jump: ["ArrowUp", "w", " "]
  };
  const levels = [
    {
      name: "Cloudline Depot",
      width: 1480,
      platforms: [
        [0, 476, 220], [285, 410, 150], [505, 345, 150], [700, 402, 220],
        [965, 330, 180], [1185, 405, 155], [1345, 455, 135]
      ],
      packages: [[345, 374], [558, 309], [1080, 294]],
      hazards: [[715, 375, 38, 27, 710, 770, 78]],
      goal: [1438, 383]
    },
    {
      name: "Crosswind Express",
      width: 1760,
      platforms: [
        [0, 476, 220], [250, 416, 180], [485, 350, 180], [720, 400, 200],
        [970, 325, 180], [1200, 400, 180], [1410, 455, 300]
      ],
      packages: [[375, 380], [558, 314], [830, 364], [1020, 289], [1285, 364]],
      hazards: [
        [730, 373, 36, 26, 725, 785, 96]
      ],
      goal: [1650, 383]
    },
    {
      name: "High Altitude Route",
      width: 2110,
      platforms: [
        [0, 476, 220], [250, 418, 180], [485, 350, 180], [720, 400, 200],
        [960, 322, 180], [1195, 385, 185], [1435, 305, 185], [1675, 380, 185],
        [1870, 455, 230]
      ],
      packages: [[375, 382], [558, 314], [1040, 286], [1290, 349], [1490, 269], [2005, 419]],
      hazards: [
        [730, 373, 36, 26, 725, 785, 112],
        [1810, 346, 36, 26, 1810, 1860, 100]
      ],
      goal: [2010, 383]
    }
  ];

  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const keys = new Set();
  const elements = {
    level: document.getElementById("level-value"),
    packages: document.getElementById("package-value"),
    deliveries: document.getElementById("delivery-value"),
    score: document.getElementById("score-value"),
    lives: document.getElementById("lives-value"),
    status: document.getElementById("status-message"),
    startOverlay: document.getElementById("start-overlay"),
    pauseOverlay: document.getElementById("pause-overlay"),
    levelOverlay: document.getElementById("level-overlay"),
    seriesOverlay: document.getElementById("series-overlay"),
    gameoverOverlay: document.getElementById("gameover-overlay"),
    pauseButton: document.getElementById("pause-button")
  };

  let state = "ready";
  let levelIndex = 0;
  let score = 0;
  let deliveries = 0;
  let lives = 3;
  let scoreAtLevelStart = 0;
  let player;
  let platforms = [];
  let packages = [];
  let hazards = [];
  let stars = [];
  let goal;
  let worldWidth = WIDTH;
  let cameraX = 0;
  let previousTime = 0;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function approach(value, target, amount) {
    if (value < target) return Math.min(value + amount, target);
    return Math.max(value - amount, target);
  }

  function overlaps(first, second) {
    return first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y;
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function updateHud() {
    const level = levels[levelIndex];
    const collected = packages.filter((parcel) => parcel.collected).length;
    elements.level.textContent = `${String(levelIndex + 1).padStart(2, "0")} / ${String(levels.length).padStart(2, "0")}`;
    elements.packages.textContent = `${collected} / ${packages.length}`;
    elements.deliveries.textContent = String(deliveries);
    elements.score.textContent = String(score).padStart(4, "0");
    elements.lives.textContent = String(lives);
    elements.pauseButton.disabled = state !== "playing";
    canvas.setAttribute("aria-label", `${level.name}. ${collected} of ${packages.length} parcels collected. Reach the delivery gate.`);
  }

  function createStars() {
    stars = Array.from({ length: Math.ceil(worldWidth / 42) }, () => ({
      x: Math.random() * worldWidth,
      y: 24 + Math.random() * 230,
      radius: 0.6 + Math.random() * 1.6,
      alpha: 0.22 + Math.random() * 0.58
    }));
  }

  function loadLevel(index, newRun) {
    levelIndex = index;
    const level = levels[levelIndex];
    worldWidth = level.width;
    platforms = level.platforms.map(([x, y, width]) => ({ x, y, width, height: 22 }));
    packages = level.packages.map(([x, y]) => ({ x, y, width: 24, height: 25, collected: false }));
    hazards = level.hazards.map(([x, y, width, height, minimum, maximum, speed]) => ({
      x,
      y,
      width,
      height,
      minimum,
      maximum,
      speed,
      direction: 1
    }));
    goal = { x: level.goal[0], y: level.goal[1], width: 52, height: 72 };
    player = {
      x: 42,
      y: platforms[0].y - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      velocityX: 0,
      velocityY: 0,
      grounded: true,
      invulnerable: 0
    };
    if (newRun) {
      score = 0;
      deliveries = 0;
      lives = 3;
    }
    scoreAtLevelStart = score;
    cameraX = 0;
    keys.clear();
    createStars();
    updateHud();
    draw();
  }

  function hideOverlays() {
    elements.startOverlay.hidden = true;
    elements.pauseOverlay.hidden = true;
    elements.levelOverlay.hidden = true;
    elements.seriesOverlay.hidden = true;
    elements.gameoverOverlay.hidden = true;
  }

  function startSeries() {
    if (state !== "ready" && state !== "complete") return;
    hideOverlays();
    loadLevel(0, true);
    state = "playing";
    updateHud();
    setStatus(`${levels[0].name}: pick up every parcel and reach the delivery gate.`);
    canvas.focus();
    previousTime = 0;
  }

  function restartLevel() {
    if (state === "ready") {
      startSeries();
      return;
    }
    score = scoreAtLevelStart;
    lives = 3;
    hideOverlays();
    loadLevel(levelIndex, false);
    state = "playing";
    updateHud();
    canvas.focus();
    previousTime = 0;
    setStatus("District restarted. Collect the parcels and watch the patrol routes.");
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    keys.clear();
    elements.pauseOverlay.hidden = false;
    updateHud();
    document.getElementById("resume-button").focus();
  }

  function resumeGame() {
    if (state !== "paused") return;
    elements.pauseOverlay.hidden = true;
    state = "playing";
    updateHud();
    canvas.focus();
    previousTime = 0;
  }

  function completeLevel() {
    state = "level-complete";
    keys.clear();
    deliveries += 1;
    const bonus = 250 + lives * 50;
    score += bonus;
    updateHud();
    setStatus(`${levels[levelIndex].name} delivered. Shipment bonus: ${bonus} points.`);

    if (levelIndex === levels.length - 1) {
      document.getElementById("series-summary").textContent =
        `${deliveries} districts cleared and ${score} points earned. Every parcel made it home.`;
      elements.seriesOverlay.hidden = false;
      document.getElementById("play-again-button").focus();
      state = "complete";
      updateHud();
      return;
    }

    document.getElementById("level-summary").textContent =
      `All ${packages.length} parcels delivered. The shipment earned a ${bonus}-point bonus.`;
    elements.levelOverlay.hidden = false;
    document.getElementById("next-level-button").focus();
    updateHud();
  }

  function advanceLevel() {
    if (state !== "level-complete") return;
    elements.levelOverlay.hidden = true;
    loadLevel(levelIndex + 1, false);
    state = "playing";
    updateHud();
    canvas.focus();
    previousTime = 0;
    setStatus(`${levels[levelIndex].name}: pick up every parcel and reach the delivery gate.`);
  }

  function hitHazard(reason) {
    if (player.invulnerable > 0 || state !== "playing") return;
    lives -= 1;
    keys.clear();

    if (lives <= 0) {
      state = "gameover";
      document.getElementById("gameover-summary").textContent =
        `You delivered ${deliveries} districts and earned ${score} points. Retry this district to try again.`;
      elements.gameoverOverlay.hidden = false;
      document.getElementById("retry-button").focus();
      updateHud();
      return;
    }

    player.x = 42;
    player.y = platforms[0].y - PLAYER_HEIGHT;
    player.velocityX = 0;
    player.velocityY = 0;
    player.grounded = true;
    player.invulnerable = 1.4;
    cameraX = 0;
    setStatus(`${reason} One life used; ${lives} ${lives === 1 ? "life" : "lives"} remain.`);
    updateHud();
  }

  function update(delta) {
    const movingLeft = keys.has("left");
    const movingRight = keys.has("right");
    const horizontal = Number(movingRight) - Number(movingLeft);
    const targetSpeed = horizontal * MOVE_SPEED;
    player.velocityX = horizontal
      ? approach(player.velocityX, targetSpeed, ACCELERATION * delta)
      : approach(player.velocityX, 0, FRICTION * delta);
    player.x = clamp(player.x + player.velocityX * delta, 0, worldWidth - player.width);

    if (keys.has("jump") && player.grounded) {
      player.velocityY = -JUMP_SPEED;
      player.grounded = false;
      keys.delete("jump");
    }

    const previousBottom = player.y + player.height;
    player.velocityY = Math.min(player.velocityY + GRAVITY * delta, 900);
    player.y += player.velocityY * delta;
    player.grounded = false;

    if (player.velocityY >= 0) {
      const currentBottom = player.y + player.height;
      for (const platform of platforms) {
        const horizontalOverlap = player.x + player.width > platform.x &&
          player.x < platform.x + platform.width;
        if (horizontalOverlap && previousBottom <= platform.y && currentBottom >= platform.y) {
          player.y = platform.y - player.height;
          player.velocityY = 0;
          player.grounded = true;
          break;
        }
      }
    }

    for (const hazard of hazards) {
      hazard.x += hazard.speed * hazard.direction * delta;
      if (hazard.x < hazard.minimum || hazard.x + hazard.width > hazard.maximum) {
        hazard.direction *= -1;
        hazard.x = clamp(hazard.x, hazard.minimum, hazard.maximum - hazard.width);
      }
    }

    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - delta);

    for (const parcel of packages) {
      if (!parcel.collected && overlaps(player, parcel)) {
        parcel.collected = true;
        score += 100;
        setStatus(`Parcel collected. ${packages.filter((item) => item.collected).length} of ${packages.length} secured.`);
        updateHud();
      }
    }

    if (player.invulnerable === 0) {
      for (const hazard of hazards) {
        if (overlaps(player, hazard)) {
          hitHazard("A patrol drone clipped your route.");
          break;
        }
      }
    }

    if (player.y > HEIGHT + 90) hitHazard("The courier missed a cloud deck.");

    if (state !== "playing") return;
    const desiredCamera = clamp(player.x + player.width * 0.48 - WIDTH * 0.42, 0, worldWidth - WIDTH);
    cameraX += (desiredCamera - cameraX) * Math.min(1, delta * 7);
    const allCollected = packages.every((parcel) => parcel.collected);
    if (allCollected && overlaps(player, goal)) completeLevel();
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawBackground() {
    const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#17214a");
    sky.addColorStop(0.58, "#344b79");
    sky.addColorStop(1, "#7ca7b7");
    context.fillStyle = sky;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    context.translate(-cameraX * 0.18, 0);
    for (const star of stars) {
      context.globalAlpha = star.alpha;
      context.fillStyle = "#eaf6ff";
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    context.fillStyle = "rgba(223, 242, 249, 0.16)";
    for (let x = -120; x < worldWidth + 180; x += 310) {
      const offset = (x - cameraX * 0.32) % 310;
      context.beginPath();
      context.ellipse(offset + 120, 470, 160, 30, 0, Math.PI, Math.PI * 2);
      context.ellipse(offset + 240, 473, 185, 26, 0, Math.PI, Math.PI * 2);
      context.fill();
    }
    context.restore();

    const shade = context.createLinearGradient(0, 0, 0, HEIGHT);
    shade.addColorStop(0, "rgba(8, 14, 35, 0.04)");
    shade.addColorStop(1, "rgba(12, 27, 46, 0.2)");
    context.fillStyle = shade;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawPlatform(platform, index) {
    const gradient = context.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
    gradient.addColorStop(0, index % 2 ? "#4c8daa" : "#5087a4");
    gradient.addColorStop(1, "#263e64");
    roundedRect(platform.x, platform.y, platform.width, platform.height, 9);
    context.fillStyle = gradient;
    context.fill();
    roundedRect(platform.x + 2, platform.y, platform.width - 4, 5, 3);
    context.fillStyle = "#b4f1eb";
    context.fill();
    context.fillStyle = "rgba(222, 251, 250, 0.17)";
    for (let x = platform.x + 16; x < platform.x + platform.width - 8; x += 34) {
      context.fillRect(x, platform.y + 12, 14, 2);
    }
  }

  function drawParcel(parcel, time) {
    if (parcel.collected) return;
    const bob = Math.sin(time / 300 + parcel.x) * 3;
    context.save();
    context.translate(parcel.x, parcel.y + bob);
    context.shadowColor = "rgba(255, 202, 111, 0.55)";
    context.shadowBlur = 12;
    roundedRect(2, 4, 20, 19, 4);
    context.fillStyle = "#ffd077";
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "#a85d36";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(12, 4);
    context.lineTo(12, 23);
    context.moveTo(2, 10);
    context.lineTo(22, 10);
    context.stroke();
    context.restore();
  }

  function drawHazard(hazard, time) {
    const bob = Math.sin(time / 190 + hazard.minimum) * 3;
    const y = hazard.y + bob;
    context.save();
    context.shadowColor = "rgba(255, 110, 97, 0.55)";
    context.shadowBlur = 15;
    roundedRect(hazard.x, y + 5, hazard.width, hazard.height - 5, 9);
    context.fillStyle = "#ff735f";
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "#472c55";
    context.beginPath();
    context.arc(hazard.x + 11, y + 16, 3, 0, Math.PI * 2);
    context.arc(hazard.x + hazard.width - 11, y + 16, 3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#ffd1a0";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(hazard.x + 7, y + 4);
    context.lineTo(hazard.x + 1, y - 2);
    context.moveTo(hazard.x + hazard.width - 7, y + 4);
    context.lineTo(hazard.x + hazard.width - 1, y - 2);
    context.stroke();
    context.restore();
  }

  function drawGoal() {
    const ready = packages.every((parcel) => parcel.collected);
    context.save();
    context.lineWidth = 7;
    context.strokeStyle = ready ? "#9df2c5" : "rgba(208, 222, 245, 0.55)";
    context.shadowColor = ready ? "rgba(112, 246, 193, 0.7)" : "transparent";
    context.shadowBlur = ready ? 18 : 0;
    context.beginPath();
    context.moveTo(goal.x, goal.y + goal.height);
    context.lineTo(goal.x, goal.y + 18);
    context.quadraticCurveTo(goal.x, goal.y, goal.x + 18, goal.y);
    context.lineTo(goal.x + goal.width - 18, goal.y);
    context.quadraticCurveTo(goal.x + goal.width, goal.y, goal.x + goal.width, goal.y + 18);
    context.lineTo(goal.x + goal.width, goal.y + goal.height);
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = ready ? "#d9fff0" : "#c3d0e4";
    context.font = "700 11px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(ready ? "DROP" : "LOCKED", goal.x + goal.width / 2, goal.y + 42);
    context.restore();
  }

  function drawPlayer(time) {
    if (player.invulnerable > 0 && Math.floor(time / 90) % 2 === 0) return;
    const x = player.x;
    const y = player.y;
    context.save();
    context.fillStyle = "rgba(16, 29, 49, 0.24)";
    context.beginPath();
    context.ellipse(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT + 3, 19, 5, 0, 0, Math.PI * 2);
    context.fill();

    roundedRect(x + 2, y + 17, 26, 24, 8);
    context.fillStyle = "#47c2c2";
    context.fill();
    roundedRect(x - 4, y + 21, 10, 17, 4);
    context.fillStyle = "#f4a96b";
    context.fill();
    roundedRect(x + 8, y + 36, 7, 6, 3);
    context.fillStyle = "#263450";
    context.fill();
    roundedRect(x + 20, y + 36, 7, 6, 3);
    context.fillStyle = "#263450";
    context.fill();

    context.beginPath();
    context.arc(x + 16, y + 11, 11, 0, Math.PI * 2);
    context.fillStyle = "#f5c99c";
    context.fill();
    context.beginPath();
    context.arc(x + 16, y + 8, 11, Math.PI, Math.PI * 2);
    context.fillStyle = "#e9f4f3";
    context.fill();
    context.fillRect(x + 7, y + 7, 18, 4);
    context.fillStyle = "#2d3f60";
    context.beginPath();
    context.arc(x + 20, y + 12, 1.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function draw() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();

    context.save();
    context.translate(-cameraX, 0);
    platforms.forEach(drawPlatform);
    hazards.forEach((hazard) => drawHazard(hazard, performance.now()));
    packages.forEach((parcel) => drawParcel(parcel, performance.now()));
    drawGoal();
    drawPlayer(performance.now());
    context.restore();
  }

  function frame(time) {
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 0;
    previousTime = time;
    if (state === "playing") update(delta);
    draw();
    window.requestAnimationFrame(frame);
  }

  function keyAction(key, code) {
    if (code === "Space") return "jump";
    const normalized = key.toLowerCase();
    for (const [action, bindings] of Object.entries(directions)) {
      if (bindings.includes(key) || bindings.includes(normalized)) return action;
    }
    return "";
  }

  function onKeyDown(event) {
    const action = keyAction(event.key, event.code);
    if (action && state === "playing") {
      event.preventDefault();
      if (!event.repeat) keys.add(action);
    }
    if (event.repeat) return;

    const key = event.key.toLowerCase();
    if ((key === "p" || key === "escape") && state === "playing") {
      event.preventDefault();
      pauseGame();
    } else if ((key === "p" || key === "escape") && state === "paused") {
      event.preventDefault();
      resumeGame();
    } else if (key === "r" && state !== "complete") {
      event.preventDefault();
      restartLevel();
    } else if (key === "n" && state === "level-complete") {
      event.preventDefault();
      advanceLevel();
    } else if (key === "enter" && state === "ready") {
      startSeries();
    }
  }

  function onKeyUp(event) {
    const action = keyAction(event.key, event.code);
    if (action) keys.delete(action);
  }

  function bindTouchControls() {
    document.querySelectorAll("[data-control]").forEach((button) => {
      const action = button.dataset.control;
      const release = (event) => {
        if (event) event.preventDefault();
        keys.delete(action);
      };
      button.addEventListener("pointerdown", (event) => {
        if (state !== "playing") return;
        event.preventDefault();
        keys.add(action);
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  }

  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * pixelRatio);
    canvas.height = Math.round(HEIGHT * pixelRatio);
    draw();
  }

  document.getElementById("start-button").addEventListener("click", startSeries);
  document.getElementById("restart-button").addEventListener("click", restartLevel);
  document.getElementById("pause-button").addEventListener("click", pauseGame);
  document.getElementById("resume-button").addEventListener("click", resumeGame);
  document.getElementById("next-level-button").addEventListener("click", advanceLevel);
  document.getElementById("play-again-button").addEventListener("click", startSeries);
  document.getElementById("retry-button").addEventListener("click", restartLevel);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener("resize", resizeCanvas);
  bindTouchControls();
  loadLevel(0, false);
  resizeCanvas();
  window.requestAnimationFrame(frame);
})();
