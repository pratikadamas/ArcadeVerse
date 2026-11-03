(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const startButton = document.getElementById("start-button");
  const keyCount = document.getElementById("key-count");
  const lifeCount = document.getElementById("life-count");
  const energyValue = document.getElementById("energy-value");
  const energyMeter = document.getElementById("energy-meter");
  const gameStatus = document.getElementById("game-status");
  const lanternButton = document.getElementById("lantern-button");
  const rechargeButton = document.getElementById("recharge-button");

  const tileSize = 40;
  const grid = [
    "#####################",
    "#.....#.....#.......#",
    "#.###.#.###.#.#####.#",
    "#.#...#...#.#.....#.#",
    "#.#.#####.#.#####.#.#",
    "#.#.....#.#.....#...#",
    "#.#####.#.#####.###.#",
    "#.....#.#.....#.....#",
    "###.#.#.#####.#####.#",
    "#...#.#.....#.....#.#",
    "#.###.#####.###.#.#.#",
    "#.....#.....#...#...#",
    "#.#####.#####.###...#",
    "#.................E.#",
    "#####################"
  ];
  const keyLocations = [
    { x: 5, y: 1, collected: false },
    { x: 9, y: 9, collected: false },
    { x: 18, y: 11, collected: false }
  ];
  const shrineLocations = [{ x: 9, y: 5 }, { x: 1, y: 3 }];
  const ghostRoutes = [
    [{ x: 13, y: 1 }, { x: 17, y: 1 }],
    [{ x: 9, y: 7 }, { x: 13, y: 7 }],
    [{ x: 13, y: 11 }, { x: 15, y: 11 }]
  ];
  const maxLives = 3;
  const maxEnergy = 100;
  const playerSpawn = { x: 1, y: 1 };
  const pressedDirections = new Set();
  const ghosts = ghostRoutes.map((route, index) => ({
    route,
    routeIndex: 1,
    direction: index % 2 === 0 ? 1 : -1,
    x: (route[0].x + 0.5) * tileSize,
    y: (route[0].y + 0.5) * tileSize,
    speed: 40 + index * 6
  }));
  const player = { x: 0, y: 0, radius: 10, speed: 150 };

  let state = "ready";
  let lives = maxLives;
  let energy = maxEnergy;
  let keysFound = 0;
  let lanternOn = true;
  let invulnerability = 0;
  let lastFrame = 0;
  let animationFrame = 0;
  let statusTimeout = 0;
  let ambientTime = 0;
  let nearLockedGate = false;

  function centerOf(cell) {
    return { x: (cell.x + 0.5) * tileSize, y: (cell.y + 0.5) * tileSize };
  }

  function isWall(column, row) {
    if (row < 0 || row >= grid.length || column < 0 || column >= grid[0].length) return true;
    const tile = grid[row][column];
    if (tile === "#") return true;
    return tile === "E" && keysFound < keyLocations.length;
  }

  function canOccupy(x, y) {
    const radius = player.radius;
    const left = Math.floor((x - radius) / tileSize);
    const right = Math.floor((x + radius) / tileSize);
    const top = Math.floor((y - radius) / tileSize);
    const bottom = Math.floor((y + radius) / tileSize);

    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        if (isWall(column, row)) return false;
      }
    }
    return true;
  }

  function updateHud() {
    keyCount.textContent = `${keysFound} / ${keyLocations.length}`;
    lifeCount.textContent = String(lives);
    energyValue.textContent = `${Math.ceil(energy)}%`;
    energyMeter.value = energy;
    lanternButton.textContent = `Lantern: ${lanternOn ? "on" : "off"}`;
    lanternButton.setAttribute("aria-pressed", String(lanternOn));
  }

  function setStatus(message, duration = 2200) {
    gameStatus.textContent = message;
    window.clearTimeout(statusTimeout);
    if (duration > 0) {
      statusTimeout = window.setTimeout(() => {
        if (state === "playing") {
          gameStatus.textContent = keysFound === keyLocations.length
            ? "All keys found. The iron gate is open."
            : "Find all three crypt keys and watch for ghosts.";
        }
      }, duration);
    }
  }

  function resetRun() {
    window.cancelAnimationFrame(animationFrame);
    pressedDirections.clear();
    keyLocations.forEach((key) => { key.collected = false; });
    ghosts.forEach((ghost, index) => {
      const start = centerOf(ghost.route[0]);
      ghost.x = start.x;
      ghost.y = start.y;
      ghost.routeIndex = 1;
      ghost.direction = index % 2 === 0 ? 1 : -1;
    });
    const spawn = centerOf(playerSpawn);
    player.x = spawn.x;
    player.y = spawn.y;
    lives = maxLives;
    energy = maxEnergy;
    keysFound = 0;
    lanternOn = true;
    invulnerability = 0;
    ambientTime = 0;
    nearLockedGate = false;
    lastFrame = 0;
    state = "playing";
    overlay.hidden = true;
    gameStatus.textContent = "The gate is sealed. Find all three keys.";
    updateHud();
    drawScene();
    animationFrame = window.requestAnimationFrame(frame);
  }

  function showInstructions() {
    if (state === "playing") {
      state = "paused";
      window.cancelAnimationFrame(animationFrame);
      pressedDirections.clear();
    }
    overlayTitle.textContent = "How to play";
    overlayMessage.textContent = "The fog hides the paths ahead. Collect all three crypt keys, then find the iron gate. Ghosts roam the lanes, so keep moving.";
    startButton.textContent = state === "paused" ? "Resume the run" : "Start the run";
    overlay.hidden = false;
  }

  function showEndState(won) {
    state = won ? "won" : "over";
    window.cancelAnimationFrame(animationFrame);
    pressedDirections.clear();
    overlayTitle.textContent = won ? "You escaped the graveyard" : "Lost in the fog";
    overlayMessage.textContent = won
      ? "All three crypt keys turned in the lock. You made it beyond the iron gate."
      : `The graveyard claimed your last ward. You recovered ${keysFound} of ${keyLocations.length} keys.`;
    startButton.textContent = "Run again";
    overlay.hidden = false;
  }

  function advanceGhost(ghost, delta) {
    const targetCell = ghost.route[ghost.routeIndex];
    const target = centerOf(targetCell);
    const dx = target.x - ghost.x;
    const dy = target.y - ghost.y;
    const distance = Math.hypot(dx, dy);
    const travel = ghost.speed * delta;

    if (distance <= travel || distance === 0) {
      ghost.x = target.x;
      ghost.y = target.y;
      ghost.routeIndex += ghost.direction;
      if (ghost.routeIndex >= ghost.route.length || ghost.routeIndex < 0) {
        ghost.direction *= -1;
        ghost.routeIndex += ghost.direction * 2;
      }
      return;
    }
    ghost.x += dx / distance * travel;
    ghost.y += dy / distance * travel;
  }

  function movePlayer(delta) {
    const horizontal = Number(pressedDirections.has("right")) - Number(pressedDirections.has("left"));
    const vertical = Number(pressedDirections.has("down")) - Number(pressedDirections.has("up"));
    if (horizontal === 0 && vertical === 0) return;

    const magnitude = Math.hypot(horizontal, vertical);
    const dx = horizontal / magnitude * player.speed * delta;
    const dy = vertical / magnitude * player.speed * delta;

    if (canOccupy(player.x + dx, player.y)) player.x += dx;
    if (canOccupy(player.x, player.y + dy)) player.y += dy;
  }

  function collectKeys() {
    keyLocations.forEach((key) => {
      if (key.collected) return;
      const point = centerOf(key);
      if (Math.hypot(player.x - point.x, player.y - point.y) < tileSize * 0.45) {
        key.collected = true;
        keysFound++;
        setStatus(keysFound === keyLocations.length
          ? "The final key turns. The iron gate is open!"
          : `Crypt key found. ${keyLocations.length - keysFound} remain.`);
        updateHud();
      }
    });
  }

  function checkShrine() {
    const nearbyShrine = shrineLocations.some((shrine) => {
      const point = centerOf(shrine);
      return Math.hypot(player.x - point.x, player.y - point.y) < tileSize * 0.62;
    });
    return nearbyShrine;
  }

  function rechargeLantern() {
    if (!checkShrine()) {
      setStatus("Find a glowing lantern shrine to recharge.");
      return;
    }
    if (energy >= maxEnergy) {
      setStatus("Your lantern is already fully charged.");
      return;
    }
    energy = Math.min(maxEnergy, energy + 55);
    lanternOn = true;
    updateHud();
    setStatus("Lantern recharged at the shrine.");
  }

  function checkGhostContact() {
    if (invulnerability > 0) return;
    const collisionDistance = player.radius + 11;
    const touchedGhost = ghosts.some((ghost) =>
      Math.hypot(player.x - ghost.x, player.y - ghost.y) < collisionDistance
    );
    if (!touchedGhost) return;

    lives--;
    invulnerability = 1.6;
    const spawn = centerOf(playerSpawn);
    player.x = spawn.x;
    player.y = spawn.y;
    updateHud();
    if (lives <= 0) {
      showEndState(false);
    } else {
      setStatus(`A ghost drained one ward. ${lives} ${lives === 1 ? "ward" : "wards"} remain.`);
    }
  }

  function update(delta) {
    ambientTime += delta;
    if (lanternOn) {
      energy = Math.max(0, energy - delta * 4.2);
      if (energy === 0) {
        lanternOn = false;
        setStatus("Lantern energy depleted. Reach a glowing shrine.");
      }
    }
    invulnerability = Math.max(0, invulnerability - delta);
    movePlayer(delta);
    ghosts.forEach((ghost) => advanceGhost(ghost, delta));
    collectKeys();
    checkGhostContact();
    updateGateHint();
    updateHud();

    if (state === "playing" && keysFound === keyLocations.length) {
      const exit = centerOf({ x: 18, y: 13 });
      if (Math.hypot(player.x - exit.x, player.y - exit.y) < tileSize * 0.38) {
        showEndState(true);
      }
    }
  }

  function updateGateHint() {
    if (keysFound === keyLocations.length) {
      nearLockedGate = false;
      return;
    }

    const exit = centerOf({ x: 18, y: 13 });
    const isNearGate = Math.hypot(player.x - exit.x, player.y - exit.y) < tileSize * 1.25;
    if (isNearGate && !nearLockedGate) {
      const remaining = keyLocations.length - keysFound;
      setStatus(`The iron gate is locked. Find ${remaining} more ${remaining === 1 ? "key" : "keys"}.`);
    }
    nearLockedGate = isNearGate;
  }

  function drawFloor(column, row) {
    const x = column * tileSize;
    const y = row * tileSize;
    context.fillStyle = (column + row) % 2 === 0 ? "#283329" : "#263128";
    context.fillRect(x, y, tileSize, tileSize);
    context.fillStyle = "#8b9b7420";
    context.fillRect(x + 4, y + 6 + ((column * 7 + row * 3) % 20), 2, 2);
    context.fillRect(x + 26, y + 13 + ((column * 5 + row * 11) % 15), 1.5, 1.5);
  }

  function drawWall(column, row) {
    const x = column * tileSize;
    const y = row * tileSize;
    const gradient = context.createLinearGradient(x, y, x + tileSize, y + tileSize);
    gradient.addColorStop(0, "#475143");
    gradient.addColorStop(0.52, "#353f34");
    gradient.addColorStop(1, "#283229");
    context.fillStyle = gradient;
    context.fillRect(x, y, tileSize, tileSize);
    context.strokeStyle = "#7380663d";
    context.lineWidth = 1;
    context.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
    context.fillStyle = "#b4c09229";
    context.fillRect(x + 5, y + 6, 11, 2);
    context.fillRect(x + 22, y + 25, 9, 2);
    context.fillStyle = "#141a14";
    context.fillRect(x + 2, y + tileSize - 4, tileSize - 4, 4);
  }

  function drawGravestone(column, row) {
    const x = (column + 0.5) * tileSize;
    const y = (row + 0.5) * tileSize;
    context.save();
    context.fillStyle = "#1b241e";
    context.strokeStyle = "#78806b";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x - 9, y + 11);
    context.lineTo(x - 9, y - 4);
    context.quadraticCurveTo(x - 9, y - 14, x, y - 14);
    context.quadraticCurveTo(x + 9, y - 14, x + 9, y - 4);
    context.lineTo(x + 9, y + 11);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = "#a9b18b";
    context.beginPath();
    context.moveTo(x, y - 8);
    context.lineTo(x, y + 2);
    context.moveTo(x - 4, y - 5);
    context.lineTo(x + 4, y - 5);
    context.stroke();
    context.restore();
  }

  function drawKey(key) {
    if (key.collected) return;
    const point = centerOf(key);
    const pulse = 1 + Math.sin(ambientTime * 3 + key.x) * 0.1;
    context.save();
    context.translate(point.x, point.y);
    context.scale(pulse, pulse);
    context.shadowColor = "#f4d276";
    context.shadowBlur = 12;
    context.strokeStyle = "#f3d37e";
    context.fillStyle = "#e9c66c";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(-4, 0, 5, 0, Math.PI * 2);
    context.moveTo(1, 0);
    context.lineTo(11, 0);
    context.lineTo(11, 5);
    context.moveTo(7, 0);
    context.lineTo(7, 4);
    context.stroke();
    context.restore();
  }

  function drawShrine(shrine) {
    const point = centerOf(shrine);
    const pulse = 0.65 + Math.sin(ambientTime * 2.5 + shrine.x) * 0.12;
    context.save();
    context.globalAlpha = pulse;
    context.shadowColor = "#d9c477";
    context.shadowBlur = 17;
    context.fillStyle = "#d8c278";
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#eee0a1";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(point.x, point.y, 11, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawExit() {
    const point = centerOf({ x: 18, y: 13 });
    const open = keysFound === keyLocations.length;
    context.save();
    context.strokeStyle = open ? "#d9c279" : "#66705d";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(point.x - 12, point.y + 12);
    context.lineTo(point.x - 12, point.y - 7);
    context.quadraticCurveTo(point.x - 12, point.y - 17, point.x, point.y - 17);
    context.quadraticCurveTo(point.x + 12, point.y - 17, point.x + 12, point.y - 7);
    context.lineTo(point.x + 12, point.y + 12);
    context.stroke();
    context.fillStyle = open ? "#d9c279" : "#9ca08a";
    context.beginPath();
    context.arc(point.x + 6, point.y, 1.6, 0, Math.PI * 2);
    context.fill();
    if (open) {
      context.globalAlpha = 0.38 + Math.sin(ambientTime * 3) * 0.18;
      context.fillStyle = "#e0c87b";
      context.beginPath();
      context.arc(point.x, point.y, 19, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawGhost(ghost) {
    context.save();
    context.translate(ghost.x, ghost.y);
    context.shadowColor = "#b4d9c2";
    context.shadowBlur = 12;
    context.fillStyle = "#b4c9bd";
    context.beginPath();
    context.arc(0, -2, 11, Math.PI, 0);
    context.lineTo(11, 9);
    context.lineTo(6, 6);
    context.lineTo(1, 10);
    context.lineTo(-4, 6);
    context.lineTo(-11, 10);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "#333c35";
    context.beginPath();
    context.arc(-4, -2, 1.4, 0, Math.PI * 2);
    context.arc(4, -2, 1.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPlayer() {
    context.save();
    if (invulnerability > 0 && Math.floor(invulnerability * 10) % 2 === 0) {
      context.globalAlpha = 0.45;
    }
    context.shadowColor = "#d9c57e";
    context.shadowBlur = lanternOn ? 19 : 6;
    context.fillStyle = "#d8c27d";
    context.beginPath();
    context.arc(player.x, player.y, 5, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "#c8d2a6";
    context.beginPath();
    context.ellipse(player.x, player.y + 4, 8, 10, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ecdda7";
    context.beginPath();
    context.arc(player.x, player.y - 3, 4.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawFog() {
    const radius = lanternOn ? tileSize * (4.4 + energy / maxEnergy) : tileSize * 2.1;
    const gradient = context.createRadialGradient(player.x, player.y, tileSize * 0.35, player.x, player.y, radius);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.96)");
    gradient.addColorStop(0.68, "rgba(0, 0, 0, 0.77)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.save();
    context.fillStyle = "rgba(5, 9, 7, 0.91)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(player.x, player.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const vignette = context.createRadialGradient(player.x, player.y, radius * 0.3, player.x, player.y, radius * 1.25);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(2, 5, 4, 0.34)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawScene() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row].length; column++) {
        if (grid[row][column] === "#") drawWall(column, row);
        else drawFloor(column, row);
      }
    }

    [[3, 2], [9, 3], [15, 5], [2, 9], [9, 11], [3, 13], [14, 13]].forEach(([column, row]) => {
      if (!isWall(column, row) && grid[row][column] !== "E") drawGravestone(column, row);
    });
    shrineLocations.forEach(drawShrine);
    keyLocations.forEach(drawKey);
    drawExit();
    ghosts.forEach(drawGhost);
    drawFog();
    drawPlayer();
  }

  function frame(timestamp) {
    if (state !== "playing") return;
    const delta = lastFrame === 0 ? 0 : Math.min((timestamp - lastFrame) / 1000, 0.04);
    lastFrame = timestamp;
    update(delta);
    drawScene();
    if (state === "playing") animationFrame = window.requestAnimationFrame(frame);
  }

  function normalizeDirection(key) {
    if (key === "arrowup" || key === "w") return "up";
    if (key === "arrowleft" || key === "a") return "left";
    if (key === "arrowdown" || key === "s") return "down";
    if (key === "arrowright" || key === "d") return "right";
    return "";
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const direction = normalizeDirection(key);
    if (direction && state === "playing") {
      event.preventDefault();
      pressedDirections.add(direction);
    } else if (!event.repeat && key === "f" && state === "playing") {
      lanternOn = !lanternOn && energy > 0;
      updateHud();
      setStatus(lanternOn ? "Lantern lit." : "Lantern extinguished to conserve energy.");
    } else if (!event.repeat && key === "e" && state === "playing") {
      event.preventDefault();
      rechargeLantern();
    } else if (key === "escape") {
      if (state === "playing") showInstructions();
      else if (state === "paused") {
        overlay.hidden = true;
        state = "playing";
        lastFrame = 0;
        animationFrame = window.requestAnimationFrame(frame);
      }
    } else if (!event.repeat && key === "r") {
      resetRun();
    } else if (key === "enter" && state === "ready") {
      resetRun();
    }
  });

  document.addEventListener("keyup", (event) => {
    const direction = normalizeDirection(event.key.toLowerCase());
    if (direction) pressedDirections.delete(direction);
  });

  window.addEventListener("blur", () => pressedDirections.clear());

  document.querySelectorAll("[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (state === "playing") pressedDirections.add(direction);
      button.setPointerCapture(event.pointerId);
    });
    const releaseDirection = () => pressedDirections.delete(direction);
    button.addEventListener("pointerup", releaseDirection);
    button.addEventListener("pointercancel", releaseDirection);
    button.addEventListener("lostpointercapture", releaseDirection);
  });

  startButton.addEventListener("click", () => {
    if (state === "paused") {
      state = "playing";
      overlay.hidden = true;
      lastFrame = 0;
      animationFrame = window.requestAnimationFrame(frame);
    } else {
      resetRun();
    }
  });
  document.getElementById("help-button").addEventListener("click", showInstructions);
  document.getElementById("restart-button").addEventListener("click", resetRun);
  rechargeButton.addEventListener("click", () => {
    if (state === "playing") rechargeLantern();
  });
  lanternButton.addEventListener("click", () => {
    if (state !== "playing") return;
    lanternOn = !lanternOn && energy > 0;
    updateHud();
    setStatus(lanternOn ? "Lantern lit." : "Lantern extinguished to conserve energy.");
  });

  const initialPosition = centerOf(playerSpawn);
  player.x = initialPosition.x;
  player.y = initialPosition.y;
  updateHud();
  drawScene();
})();
