(() => {
  "use strict";

  const canvas = document.getElementById("flight-canvas");
  const context = canvas.getContext("2d");
  const altitudeElement = document.getElementById("altitude");
  const verticalSpeedElement = document.getElementById("vertical-speed");
  const horizontalSpeedElement = document.getElementById("horizontal-speed");
  const fuelValueElement = document.getElementById("fuel-value");
  const fuelBarElement = document.getElementById("fuel-bar");
  const fuelTrackElement = document.querySelector(".fuel-track");
  const missionOverlay = document.getElementById("mission-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const launchButton = document.getElementById("launch-button");
  const width = canvas.width;
  const height = canvas.height;
  const landerSize = { width: 30, height: 38 };
  const pad = { left: 500, right: 620, top: 420 };
  const gravity = 64;
  const mainThrust = 145;
  const sideThrust = 72;
  const maxSafeVerticalSpeed = 38;
  const maxSafeHorizontalSpeed = 42;
  const terrain = [
    { x: 0, y: 430 },
    { x: 70, y: 402 },
    { x: 132, y: 429 },
    { x: 212, y: 390 },
    { x: 285, y: 430 },
    { x: 354, y: 398 },
    { x: 438, y: 428 },
    { x: pad.left, y: pad.top },
    { x: pad.right, y: pad.top },
    { x: 671, y: 396 },
    { x: 720, y: 426 }
  ];
  const keys = new Set();
  const controls = { main: false, left: false, right: false };

  let lander;
  let fuel;
  let missionState = "ready";
  let elapsed = 0;
  let previousFrame = 0;
  let animationFrame = 0;

  function resetMission() {
    cancelAnimationFrame(animationFrame);
    lander = { x: 132, y: 76, vx: 10, vy: 0 };
    fuel = 100;
    elapsed = 0;
    previousFrame = 0;
    missionState = "ready";
    clearControls();
    overlayTitle.textContent = "Make a soft landing";
    overlayCopy.textContent = "Touch down on the blue pad with low vertical and horizontal speed. Conserve fuel while you steer.";
    launchButton.textContent = "Begin descent";
    missionOverlay.hidden = false;
    updateTelemetry();
    draw();
  }

  function beginDescent() {
    if (missionState !== "ready") return;
    missionState = "flying";
    previousFrame = 0;
    missionOverlay.hidden = true;
    animationFrame = requestAnimationFrame(frame);
  }

  function readControls() {
    return {
      main: controls.main || keys.has("ArrowUp") || keys.has("w") || keys.has("W"),
      left: controls.left || keys.has("ArrowLeft") || keys.has("a") || keys.has("A"),
      right: controls.right || keys.has("ArrowRight") || keys.has("d") || keys.has("D")
    };
  }

  function frame(timestamp) {
    if (missionState !== "flying") return;
    const delta = previousFrame
      ? Math.min((timestamp - previousFrame) / 1000, 0.035)
      : 0;
    previousFrame = timestamp;
    elapsed += delta;
    updatePhysics(delta);
    updateTelemetry();
    draw();
    checkLanding();

    if (missionState === "flying") {
      animationFrame = requestAnimationFrame(frame);
    }
  }

  function updatePhysics(delta) {
    const input = readControls();
    lander.vy += gravity * delta;

    if (input.main && fuel > 0) {
      lander.vy -= mainThrust * delta;
      fuel = Math.max(0, fuel - 19 * delta);
    }
    if (input.left && fuel > 0) {
      lander.vx -= sideThrust * delta;
      fuel = Math.max(0, fuel - 9 * delta);
    }
    if (input.right && fuel > 0) {
      lander.vx += sideThrust * delta;
      fuel = Math.max(0, fuel - 9 * delta);
    }

    lander.vy = Math.max(-180, Math.min(215, lander.vy));
    lander.vx = Math.max(-125, Math.min(125, lander.vx));
    lander.x += lander.vx * delta;
    lander.y += lander.vy * delta;
    lander.x = Math.max(landerSize.width / 2, Math.min(width - landerSize.width / 2, lander.x));
  }

  function terrainHeightAt(x) {
    for (let index = 0; index < terrain.length - 1; index++) {
      const start = terrain[index];
      const end = terrain[index + 1];
      if (x >= start.x && x <= end.x) {
        const ratio = (x - start.x) / (end.x - start.x);
        return start.y + (end.y - start.y) * ratio;
      }
    }
    return terrain[terrain.length - 1].y;
  }

  function checkLanding() {
    if (lander.y < -landerSize.height) {
      finishMission(false, "The module left the flight zone. Restart and keep the descent under control.");
      return;
    }

    const footY = lander.y + landerSize.height / 2;
    const groundY = terrainHeightAt(lander.x);
    if (footY < groundY) return;

    const onPad = lander.x >= pad.left + 5 && lander.x <= pad.right - 5;
    const safeVerticalSpeed = lander.vy >= 0 && lander.vy <= maxSafeVerticalSpeed;
    const safeHorizontalSpeed = Math.abs(lander.vx) <= maxSafeHorizontalSpeed;
    if (onPad && safeVerticalSpeed && safeHorizontalSpeed) {
      finishMission(true);
      return;
    }

    const reason = !onPad
      ? "The module missed the landing pad and struck the surrounding terrain."
      : !safeVerticalSpeed
        ? "Vertical impact speed was too high. Use the main thruster to slow your descent."
        : "Lateral speed was too high. Use the steering jets to line up before touchdown.";
    finishMission(false, reason);
  }

  function finishMission(success, reason = "") {
    missionState = success ? "landed" : "crashed";
    clearControls();
    overlayTitle.textContent = success ? "Touchdown confirmed" : "Mission failed";
    overlayCopy.textContent = success
      ? `Safe landing in ${elapsed.toFixed(1)} seconds with ${Math.ceil(fuel)}% fuel remaining.`
      : reason;
    launchButton.textContent = "Restart mission";
    missionOverlay.hidden = false;
  }

  function updateTelemetry() {
    const altitude = Math.max(0, Math.round(terrainHeightAt(lander.x) - (lander.y + landerSize.height / 2)));
    altitudeElement.textContent = `${altitude} m`;
    verticalSpeedElement.textContent = `${Math.round(Math.abs(lander.vy))} m/s ${lander.vy < 0 ? "UP" : "DOWN"}`;
    verticalSpeedElement.classList.toggle("warning", lander.vy > maxSafeVerticalSpeed);
    horizontalSpeedElement.textContent = `${Math.round(Math.abs(lander.vx))} m/s`;
    horizontalSpeedElement.classList.toggle("warning", Math.abs(lander.vx) > maxSafeHorizontalSpeed);
    fuelValueElement.textContent = `${Math.ceil(fuel)}%`;
    fuelBarElement.style.width = `${fuel}%`;
    fuelBarElement.classList.toggle("low", fuel < 25);
    fuelTrackElement.setAttribute("aria-valuenow", Math.round(fuel));
  }

  function drawStars() {
    for (let index = 0; index < 58; index++) {
      const x = (index * 127 + 41) % width;
      const y = (index * 79 + 19) % 345;
      const size = index % 8 === 0 ? 2 : 1;
      context.fillStyle = index % 5 === 0 ? "#a8d7ff" : "#e4edff";
      context.globalAlpha = index % 3 === 0 ? 0.9 : 0.48;
      context.fillRect(x, y, size, size);
    }
    context.globalAlpha = 1;
  }

  function drawTerrain() {
    context.beginPath();
    context.moveTo(terrain[0].x, height);
    terrain.forEach((point) => context.lineTo(point.x, point.y));
    context.lineTo(width, height);
    context.closePath();
    const ground = context.createLinearGradient(0, 385, 0, height);
    ground.addColorStop(0, "#47516a");
    ground.addColorStop(1, "#222b3c");
    context.fillStyle = ground;
    context.fill();

    context.beginPath();
    terrain.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = "#94a9c5";
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.shadowColor = "#51c8ff";
    context.shadowBlur = 18;
    context.fillStyle = "#43bfff";
    context.fillRect(pad.left, pad.top - 3, pad.right - pad.left, 5);
    context.restore();

    context.fillStyle = "#b8c5d9";
    context.font = "700 12px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText("LANDING ZONE", (pad.left + pad.right) / 2, pad.top - 12);
  }

  function drawModule() {
    const centerX = lander.x;
    const centerY = lander.y;
    const input = readControls();

    context.save();
    context.translate(centerX, centerY);

    if (missionState === "flying" && fuel > 0 && input.main) {
      context.fillStyle = "#ffb454";
      context.beginPath();
      context.moveTo(-7, landerSize.height / 2 - 4);
      context.lineTo(0, landerSize.height / 2 + 13 + Math.sin(elapsed * 38) * 4);
      context.lineTo(7, landerSize.height / 2 - 4);
      context.closePath();
      context.fill();
    }

    context.fillStyle = "#dce9f7";
    context.strokeStyle = "#6f8eae";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-13, 4);
    context.lineTo(-10, -13);
    context.lineTo(-6, -19);
    context.lineTo(6, -19);
    context.lineTo(10, -13);
    context.lineTo(13, 4);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = "#347bb0";
    context.beginPath();
    context.arc(0, -9, 5, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#bed1e7";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-12, 4);
    context.lineTo(-17, 15);
    context.moveTo(12, 4);
    context.lineTo(17, 15);
    context.moveTo(-18, 15);
    context.lineTo(-12, 15);
    context.moveTo(12, 15);
    context.lineTo(18, 15);
    context.stroke();

    context.restore();
  }

  function draw() {
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#0b1429");
    sky.addColorStop(0.72, "#17243a");
    sky.addColorStop(1, "#202b3d");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    drawStars();
    drawTerrain();
    drawModule();
  }

  function clearControls() {
    keys.clear();
    controls.main = false;
    controls.left = false;
    controls.right = false;
    document.querySelectorAll("[data-control]").forEach((button) => button.classList.remove("pressed"));
  }

  function setControl(button, isPressed) {
    const control = button.dataset.control;
    controls[control] = isPressed;
    button.classList.toggle("pressed", isPressed);
  }

  document.addEventListener("keydown", (event) => {
    const handledKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "W", "a", "A", "d", "D", " "];
    if (handledKeys.includes(event.key)) event.preventDefault();
    if (event.code === "Space" && missionState === "ready") beginDescent();
    keys.add(event.key);
  });

  document.addEventListener("keyup", (event) => keys.delete(event.key));
  window.addEventListener("blur", clearControls);

  document.querySelectorAll("[data-control]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (missionState === "ready") beginDescent();
      button.setPointerCapture(event.pointerId);
      setControl(button, true);
    });
    const release = () => setControl(button, false);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  launchButton.addEventListener("click", () => {
    if (missionState === "ready") beginDescent();
    else resetMission();
  });

  resetMission();
})();
