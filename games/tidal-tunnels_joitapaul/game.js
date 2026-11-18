"use strict";

(() => {
  const WIDTH = 960;
  const HEIGHT = 540;
  const WORLD_LENGTH = 6900;
  const EXIT_X = WORLD_LENGTH - 150;
  const DIVER_RADIUS = 18;
  const SWIM_SPEED = 260;
  const OXYGEN_DRAIN = 7.2;
  const BUBBLE_REFILL = 30;
  const keys = new Set();
  const directions = {
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "d"],
    up: ["ArrowUp", "w"],
    down: ["ArrowDown", "s"]
  };
  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const elements = {
    oxygenValue: document.getElementById("oxygen-value"),
    oxygenMeter: document.getElementById("oxygen-meter"),
    oxygenFill: document.getElementById("oxygen-fill"),
    score: document.getElementById("score-value"),
    distance: document.getElementById("distance-value"),
    status: document.getElementById("status-message"),
    startOverlay: document.getElementById("start-overlay"),
    pauseOverlay: document.getElementById("pause-overlay"),
    gameoverOverlay: document.getElementById("gameover-overlay"),
    completeOverlay: document.getElementById("complete-overlay"),
    pauseButton: document.getElementById("pause-button")
  };

  let state = "ready";
  let diver;
  let oxygen = 100;
  let score = 0;
  let bubbleScore = 0;
  let maxDistance = 0;
  let cameraX = 0;
  let elapsedTime = 0;
  let lastFrame = 0;
  let invulnerable = 0;
  let bubbles = [];
  let mines = [];
  let particles = [];

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function approach(value, target, amount) {
    if (value < target) return Math.min(value + amount, target);
    return Math.max(value - amount, target);
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function updateHud() {
    const roundedOxygen = Math.ceil(oxygen);
    const progress = Math.floor(Math.min(100, ((diver.x - 150) / (EXIT_X - 150)) * 100));
    elements.oxygenValue.textContent = `${roundedOxygen}%`;
    elements.oxygenMeter.setAttribute("aria-valuenow", String(roundedOxygen));
    elements.oxygenFill.style.width = `${oxygen}%`;
    elements.oxygenMeter.classList.toggle("is-low", oxygen <= 28);
    elements.score.textContent = String(score).padStart(4, "0");
    elements.distance.textContent = `${progress}%`;
    elements.pauseButton.disabled = state !== "running";
    canvas.setAttribute(
      "aria-label",
      `Tidal Tunnels. Oxygen ${roundedOxygen} percent. Score ${score}. Route ${progress} percent complete.`
    );
  }

  function makeCourse() {
    bubbles = [];
    for (let index = 0, x = 430; x < EXIT_X - 90; index += 1, x += 430) {
      bubbles.push({
        x,
        y: 112 + ((index * 97) % 310),
        radius: 15,
        collected: false,
        phase: index * 1.7
      });
    }

    mines = [];
    for (let index = 0, x = 780; x < EXIT_X - 240; index += 1, x += 560) {
      mines.push({
        baseX: x,
        baseY: 105 + ((index * 83) % 315),
        x,
        y: 105 + ((index * 83) % 315),
        radius: 23 + (index % 2) * 3,
        phase: index * 1.4,
        speed: 0.7 + (index % 3) * 0.12
      });
    }

    particles = Array.from({ length: 92 }, (_, index) => ({
      x: (index * 137 + 41) % WORLD_LENGTH,
      y: 28 + ((index * 83) % (HEIGHT - 56)),
      radius: 0.8 + (index % 4) * 0.42,
      alpha: 0.15 + (index % 5) * 0.1
    }));
  }

  function resetDive() {
    keys.clear();
    oxygen = 100;
    score = 0;
    bubbleScore = 0;
    maxDistance = 0;
    cameraX = 0;
    elapsedTime = 0;
    invulnerable = 0;
    diver = {
      x: 150,
      y: HEIGHT / 2,
      vx: 0,
      vy: 0
    };
    makeCourse();
    elements.startOverlay.hidden = true;
    elements.pauseOverlay.hidden = true;
    elements.gameoverOverlay.hidden = true;
    elements.completeOverlay.hidden = true;
    state = "running";
    setStatus("The current is moving. Find the first air bubble.");
    updateHud();
    canvas.focus();
    lastFrame = 0;
  }

  function pauseDive() {
    if (state !== "running") return;
    keys.clear();
    state = "paused";
    elements.pauseOverlay.hidden = false;
    updateHud();
    document.getElementById("resume-button").focus();
  }

  function resumeDive() {
    if (state !== "paused") return;
    elements.pauseOverlay.hidden = true;
    state = "running";
    updateHud();
    canvas.focus();
    lastFrame = 0;
  }

  function finishDive() {
    if (state !== "running") return;
    keys.clear();
    state = "complete";
    elements.completeOverlay.hidden = false;
    document.getElementById("complete-summary").textContent =
      `You reached the reef exit with ${Math.ceil(oxygen)}% oxygen and scored ${score} points.`;
    document.getElementById("play-again-button").focus();
    setStatus("Dive complete. You reached the surface.");
    updateHud();
  }

  function endDive(reason) {
    if (state !== "running") return;
    keys.clear();
    state = "gameover";
    elements.gameoverOverlay.hidden = false;
    document.getElementById("gameover-summary").textContent =
      `${reason} Final score: ${score}. You reached ${Math.floor(((maxDistance - 150) / (EXIT_X - 150)) * 100)}% of the route.`;
    document.getElementById("retry-button").focus();
    setStatus(reason);
    updateHud();
  }

  function hitMine() {
    if (invulnerable > 0) return;
    oxygen = Math.max(0, oxygen - 18);
    invulnerable = 1.35;
    diver.vx = Math.min(diver.vx, -65);
    setStatus("Reef mine collision. Oxygen dropped by 18 points.");
    if (oxygen <= 0) {
      endDive("The reef drained your last oxygen.");
    }
  }

  function update(delta) {
    const horizontal = Number(keys.has("right")) - Number(keys.has("left"));
    const vertical = Number(keys.has("down")) - Number(keys.has("up"));
    const targetX = horizontal * SWIM_SPEED;
    const targetY = vertical * SWIM_SPEED * 0.82;
    diver.vx = approach(diver.vx, targetX, 760 * delta);
    diver.vy = approach(diver.vy, targetY, 690 * delta);
    diver.x = clamp(diver.x + diver.vx * delta, DIVER_RADIUS + 14, WORLD_LENGTH - DIVER_RADIUS - 12);
    diver.y = clamp(diver.y + diver.vy * delta, 72, HEIGHT - 70);

    elapsedTime += delta;
    oxygen = Math.max(0, oxygen - OXYGEN_DRAIN * delta);
    maxDistance = Math.max(maxDistance, diver.x);
    score = Math.floor((maxDistance - 150) / 5) + bubbleScore;

    for (const mine of mines) {
      mine.x = mine.baseX + Math.sin(elapsedTime * mine.speed + mine.phase) * 22;
      mine.y = mine.baseY + Math.sin(elapsedTime * mine.speed * 1.3 + mine.phase) * 51;
      const dx = diver.x - mine.x;
      const dy = diver.y - mine.y;
      if (dx * dx + dy * dy < (DIVER_RADIUS + mine.radius - 3) ** 2) {
        hitMine();
        break;
      }
    }

    if (invulnerable > 0) invulnerable = Math.max(0, invulnerable - delta);

    for (const bubble of bubbles) {
      if (bubble.collected) continue;
      const dx = diver.x - bubble.x;
      const dy = diver.y - bubble.y;
      if (dx * dx + dy * dy < (DIVER_RADIUS + bubble.radius + 14) ** 2) {
        bubble.collected = true;
        oxygen = Math.min(100, oxygen + BUBBLE_REFILL);
        bubbleScore += 100;
        score += 100;
        setStatus(`Air bubble collected. Oxygen restored to ${Math.ceil(oxygen)}%.`);
      }
    }

    if (oxygen <= 0) {
      endDive("Your oxygen ran out.");
      return;
    }

    if (diver.x >= EXIT_X) {
      finishDive();
      return;
    }

    const targetCamera = clamp(diver.x - WIDTH * 0.37, 0, WORLD_LENGTH - WIDTH);
    cameraX += (targetCamera - cameraX) * Math.min(1, delta * 5);
    updateHud();
  }

  function drawBackground(time) {
    const water = context.createLinearGradient(0, 0, 0, HEIGHT);
    water.addColorStop(0, "#0b3751");
    water.addColorStop(0.52, "#0b5265");
    water.addColorStop(1, "#0b293f");
    context.fillStyle = water;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    context.globalAlpha = 0.1;
    context.fillStyle = "#b4fff3";
    for (let index = 0; index < 7; index += 1) {
      const x = ((index * 186 - cameraX * 0.12) % (WIDTH + 180)) - 80;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 24, 0);
      context.lineTo(x + 150, HEIGHT);
      context.lineTo(x + 76, HEIGHT);
      context.closePath();
      context.fill();
    }
    context.restore();

    context.save();
    context.translate(-cameraX * 0.17, 0);
    for (const particle of particles) {
      const drift = (time * 0.012 + particle.x) % WORLD_LENGTH;
      context.globalAlpha = particle.alpha;
      context.fillStyle = "#d5fff7";
      context.beginPath();
      context.arc(drift, particle.y + Math.sin(time / 800 + particle.x) * 4, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    drawReefLine(472, "#123a4a", 0);
    drawReefLine(505, "#0b293c", 1);
    context.restore();

    const vignette = context.createLinearGradient(0, 0, 0, HEIGHT);
    vignette.addColorStop(0, "rgba(2, 15, 29, 0.05)");
    vignette.addColorStop(1, "rgba(2, 15, 29, 0.42)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawReefLine(baseY, color, offset) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(-80, HEIGHT);
    for (let x = -80; x <= WORLD_LENGTH + 100; x += 90) {
      const wave = Math.sin((x + offset * 115) / 155) * 18 + Math.cos(x / 82) * 11;
      context.lineTo(x - cameraX * (offset ? 0.35 : 0.25), baseY + wave);
    }
    context.lineTo(WIDTH + 100, HEIGHT);
    context.closePath();
    context.fill();
  }

  function drawBubble(bubble, time) {
    if (bubble.collected) return;
    const screenX = bubble.x - cameraX;
    if (screenX < -35 || screenX > WIDTH + 35) return;
    const bob = Math.sin(time / 380 + bubble.phase) * 4;
    context.save();
    context.shadowColor = "rgba(120, 255, 242, 0.78)";
    context.shadowBlur = 17;
    context.strokeStyle = "rgba(177, 255, 247, 0.92)";
    context.lineWidth = 2;
    context.fillStyle = "rgba(92, 224, 221, 0.2)";
    context.beginPath();
    context.arc(screenX, bubble.y + bob, bubble.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "rgba(222, 255, 251, 0.86)";
    context.beginPath();
    context.arc(screenX - 5, bubble.y + bob - 5, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMine(mine, time) {
    const x = mine.x - cameraX;
    if (x < -55 || x > WIDTH + 55) return;
    context.save();
    context.translate(x, mine.y);
    context.rotate(Math.sin(time / 900 + mine.phase) * 0.18);
    context.shadowColor = "rgba(255, 106, 94, 0.48)";
    context.shadowBlur = 16;
    context.fillStyle = "#ed786c";
    context.strokeStyle = "#ffb08c";
    context.lineWidth = 2;
    for (let spike = 0; spike < 8; spike += 1) {
      context.rotate(Math.PI / 4);
      context.beginPath();
      context.moveTo(-4, -mine.radius + 4);
      context.lineTo(0, -mine.radius - 8);
      context.lineTo(4, -mine.radius + 4);
      context.closePath();
      context.fill();
    }
    context.beginPath();
    context.arc(0, 0, mine.radius - 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#552f48";
    context.beginPath();
    context.arc(-7, -2, 3, 0, Math.PI * 2);
    context.arc(7, -2, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawDiver(time) {
    if (invulnerable > 0 && Math.floor(time / 80) % 2 === 0) return;
    const x = diver.x - cameraX;
    const y = diver.y;
    const facing = diver.vx < -25 ? -1 : 1;
    context.save();
    context.translate(x, y);
    context.scale(facing, 1);
    context.shadowColor = "rgba(110, 251, 224, 0.38)";
    context.shadowBlur = 14;
    context.fillStyle = "#b7f5d9";
    context.beginPath();
    context.ellipse(-4, 3, 15, 19, -0.13, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    context.fillStyle = "#d7f0e3";
    context.beginPath();
    context.arc(8, -15, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#193b50";
    context.beginPath();
    context.fillRect(11, -20, 13, 10);
    context.fill();
    context.strokeStyle = "rgba(197, 255, 239, 0.9)";
    context.lineWidth = 2;
    context.strokeRect(12, -19, 11, 8);

    context.fillStyle = "#f4c778";
    context.beginPath();
    context.moveTo(-8, 19);
    context.lineTo(-22, 27 + Math.sin(time / 95) * 3);
    context.lineTo(-4, 24);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(13, 72, 81, 0.8)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-6, 5);
    context.lineTo(-18, 8 + Math.sin(time / 110) * 3);
    context.stroke();
    context.restore();
  }

  function drawExit() {
    const x = EXIT_X - cameraX;
    if (x < -70 || x > WIDTH + 90) return;
    context.save();
    context.shadowColor = "rgba(255, 215, 136, 0.7)";
    context.shadowBlur = 22;
    context.strokeStyle = "#ffd181";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(x - 24, 445);
    context.lineTo(x - 24, 378);
    context.quadraticCurveTo(x - 24, 345, x + 8, 345);
    context.lineTo(x + 36, 345);
    context.quadraticCurveTo(x + 68, 345, x + 68, 378);
    context.lineTo(x + 68, 445);
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 214, 137, 0.12)";
    context.fillRect(x - 16, 384, 55, 60);
    context.fillStyle = "#ffe6b4";
    context.font = "800 12px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("SURFACE", x + 20, 374);
    context.restore();
  }

  function draw(time) {
    drawBackground(time);
    for (const bubble of bubbles) drawBubble(bubble, time);
    for (const mine of mines) drawMine(mine, time);
    drawExit();
    drawDiver(time);

    context.fillStyle = "rgba(210, 249, 246, 0.72)";
    context.font = "700 11px system-ui, sans-serif";
    context.textAlign = "left";
    context.fillText("CURRENT FLOW", 18, 28);
  }

  function frame(time) {
    if (state === "running") {
      const delta = lastFrame ? Math.min((time - lastFrame) / 1000, 0.05) : 0;
      update(delta);
    }
    lastFrame = state === "running" ? time : 0;
    draw(time);
    requestAnimationFrame(frame);
  }

  function keyDirection(key) {
    const normalized = key.toLowerCase();
    for (const [direction, codes] of Object.entries(directions)) {
      if (codes.some((code) => code.toLowerCase() === normalized)) return direction;
    }
    return null;
  }

  document.addEventListener("keydown", (event) => {
    const direction = keyDirection(event.key);
    if (direction) {
      event.preventDefault();
      if (state === "running") keys.add(direction);
      return;
    }

    if (event.repeat) return;

    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      if (state === "running") pauseDive();
      else if (state === "paused") resumeDive();
      return;
    }

    if (event.key.toLowerCase() === "r") {
      resetDive();
    }
  });

  document.addEventListener("keyup", (event) => {
    const direction = keyDirection(event.key);
    if (direction) keys.delete(direction);
  });

  window.addEventListener("blur", () => keys.clear());

  for (const button of document.querySelectorAll(".touch-button[data-direction]")) {
    const direction = button.dataset.direction;
    button.addEventListener("pointerdown", (event) => {
      if (state !== "running") return;
      event.preventDefault();
      keys.add(direction);
      button.classList.add("is-pressed");
      button.setPointerCapture(event.pointerId);
    });
    const release = () => {
      keys.delete(direction);
      button.classList.remove("is-pressed");
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  document.getElementById("start-button").addEventListener("click", resetDive);
  document.getElementById("restart-button").addEventListener("click", resetDive);
  document.getElementById("retry-button").addEventListener("click", resetDive);
  document.getElementById("play-again-button").addEventListener("click", resetDive);
  document.getElementById("pause-button").addEventListener("click", pauseDive);
  document.getElementById("resume-button").addEventListener("click", resumeDive);

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "AV_RESIZE") draw(performance.now());
  });

  makeCourse();
  diver = { x: 150, y: HEIGHT / 2, vx: 0, vy: 0 };
  updateHud();
  requestAnimationFrame(frame);
})();
