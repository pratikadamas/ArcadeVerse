(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const levelEl = document.getElementById("level");
  const movesEl = document.getElementById("moves");
  const timeEl = document.getElementById("time");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const pauseOverlay = document.getElementById("pause-overlay");
  const completeOverlay = document.getElementById("complete-overlay");
  const completeTitle = document.getElementById("complete-title");
  const completeCopy = document.getElementById("complete-copy");
  const rulesModal = document.getElementById("rules-modal");

  const SIZE = 5;
  const INSET = 34;
  const CELL = (canvas.width - INSET * 2) / SIZE;
  const N = 1;
  const E = 2;
  const S = 4;
  const W = 8;
  const TOTAL_LEVELS = 20;

  let level = 1;
  let moves = 0;
  let score = 0;
  let elapsed = 0;
  let timerId = null;
  let paused = false;
  let complete = false;
  let selected = { r: 2, c: 2 };
  let targets = [];
  let states = [];
  let powered = new Set();
  let particles = [];

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function random() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function rotateMask(mask) {
    const rotated = ((mask << 1) & 15) | (mask & 8 ? 1 : 0);
    return rotated;
  }

  function createTargetGrid(levelNumber) {
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    const positions = [];

    for (let r = 0; r < SIZE; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < SIZE; c++) positions.push({ r, c });
      } else {
        for (let c = SIZE - 1; c >= 0; c--) positions.push({ r, c });
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      let mask = 0;
      if (i > 0) {
        const previous = positions[i - 1];
        if (previous.r < pos.r) mask |= N;
        if (previous.c > pos.c) mask |= E;
        if (previous.r > pos.r) mask |= S;
        if (previous.c < pos.c) mask |= W;
      }
      if (i < positions.length - 1) {
        const next = positions[i + 1];
        if (next.r < pos.r) mask |= N;
        if (next.c > pos.c) mask |= E;
        if (next.r > pos.r) mask |= S;
        if (next.c < pos.c) mask |= W;
      }
      grid[pos.r][pos.c] = mask;
    }

    const extraSpots = [
      { r: 1, c: 1, side: S },
      { r: 2, c: 3, side: N },
      { r: 3, c: 1, side: E },
      { r: 1, c: 3, side: W },
      { r: 3, c: 3, side: S }
    ];
    const spot = extraSpots[(levelNumber - 1) % extraSpots.length];
    grid[spot.r][spot.c] |= spot.side;
    const opposite = spot.side === N ? S : spot.side === S ? N : spot.side === E ? W : E;
    const neighbor = {
      r: spot.r + (spot.side === N ? -1 : spot.side === S ? 1 : 0),
      c: spot.c + (spot.side === W ? -1 : spot.side === E ? 1 : 0)
    };
    if (neighbor.r >= 0 && neighbor.r < SIZE && neighbor.c >= 0 && neighbor.c < SIZE) {
      grid[neighbor.r][neighbor.c] |= opposite;
    }

    return grid;
  }

  function getTerminalPositions() {
    return [
      { r: 0, c: 0 },
      { r: 0, c: SIZE - 1 },
      { r: SIZE - 1, c: SIZE - 1 }
    ];
  }

  function startLevel() {
    targets = createTargetGrid(level);
    const random = seededRandom(1346 + level * 7919);
    states = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        let state = targets[r][c];
        const scramble = Math.floor(random() * 4);
        for (let i = 0; i < scramble; i++) state = rotateMask(state);
        states[r][c] = state;
      }
    }

    const centerMask = targets[2][2];
    if (getMaskDegree(states[2][2]) === 1) {
      states[2][2] = centerMask;
    }

    moves = 0;
    elapsed = 0;
    paused = false;
    complete = false;
    particles = [];
    selected = { r: 2, c: 2 };
    updateHUD();
    pauseOverlay.classList.add("hidden");
    completeOverlay.classList.add("hidden");
    calculatePowered();
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (!paused && !complete) {
        elapsed++;
        updateHUD();
      }
    }, 1000);
    draw();
  }

  function getMaskDegree(mask) {
    let degree = 0;
    for (let bit = 1; bit <= 8; bit *= 2) if (mask & bit) degree++;
    return degree;
  }

  function calculatePowered() {
    powered = new Set();
    const queue = [{ r: 2, c: 2 }];
    powered.add("2,2");

    while (queue.length) {
      const pos = queue.shift();
      const mask = states[pos.r][pos.c];
      const neighbors = [
        { r: pos.r - 1, c: pos.c, bit: N, opposite: S },
        { r: pos.r, c: pos.c + 1, bit: E, opposite: W },
        { r: pos.r + 1, c: pos.c, bit: S, opposite: N },
        { r: pos.r, c: pos.c - 1, bit: W, opposite: E }
      ];

      neighbors.forEach(neighbor => {
        if (neighbor.r < 0 || neighbor.r >= SIZE || neighbor.c < 0 || neighbor.c >= SIZE) return;
        if (!(mask & neighbor.bit)) return;
        const key = `${neighbor.r},${neighbor.c}`;
        if (powered.has(key)) return;
        if (!(states[neighbor.r][neighbor.c] & neighbor.opposite)) return;
        powered.add(key);
        queue.push({ r: neighbor.r, c: neighbor.c });
      });
    }

    const allTilesAligned = targets.every((row, r) =>
      row.every((target, c) => states[r][c] === target)
    );
    if (allTilesAligned && getTerminalPositions().every(pos => powered.has(`${pos.r},${pos.c}`))) {
      finishLevel();
    }
  }

  function finishLevel() {
    if (complete) return;
    complete = true;
    clearInterval(timerId);

    const timeBonus = Math.max(0, 600 - elapsed * 2);
    const moveBonus = Math.max(0, 400 - moves * 8);
    const levelScore = 1000 + timeBonus + moveBonus + level * 100;
    score += levelScore;

    let bestTime = 0;
    let bestMoves = 0;
    try {
      bestTime = Number(localStorage.getItem("cipher-garden-best-time") || 0);
      bestMoves = Number(localStorage.getItem("cipher-garden-best-moves") || 0);
    } catch (_) {}

    if (!bestTime || elapsed < bestTime) {
      try { localStorage.setItem("cipher-garden-best-time", String(elapsed)); } catch (_) {}
    }
    if (!bestMoves || moves < bestMoves) {
      try { localStorage.setItem("cipher-garden-best-moves", String(moves)); } catch (_) {}
    }
    updateHUD();

    completeTitle.textContent = level === TOTAL_LEVELS ? "Garden Fully Awakened" : "Garden Restored";
    completeCopy.textContent = `${levelScore} points - ${formatTime(elapsed)} - ${moves} moves`;
    completeOverlay.classList.remove("hidden");
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function updateHUD() {
    levelEl.textContent = `${level} / ${TOTAL_LEVELS}`;
    movesEl.textContent = String(moves);
    timeEl.textContent = formatTime(elapsed);
    scoreEl.textContent = String(score);

    let bestTime = "";
    let bestMoves = "";
    try {
      bestTime = localStorage.getItem("cipher-garden-best-time") || "";
      bestMoves = localStorage.getItem("cipher-garden-best-moves") || "";
    } catch (_) {}
    bestEl.textContent = bestTime && bestMoves ? `${formatTime(Number(bestTime))} / ${bestMoves}` : "--";
  }

  function rotateSelected() {
    if (paused || complete) return;
    const tile = states[selected.r][selected.c];
    states[selected.r][selected.c] = rotateMask(tile);
    moves++;
    spawnParticles(selected.c, selected.r);
    updateHUD();
    calculatePowered();
    draw();
  }

  function spawnParticles(c, r) {
    const centerX = INSET + c * CELL + CELL / 2;
    const centerY = INSET + r * CELL + CELL / 2;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * (1.4 + Math.random()),
        vy: Math.sin(angle) * (1.4 + Math.random()),
        life: 28
      });
    }
  }

  function cellCenter(r, c) {
    return {
      x: INSET + c * CELL + CELL / 2,
      y: INSET + r * CELL + CELL / 2
    };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#09130f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(136, 247, 194, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= SIZE; i++) {
      const offset = INSET + i * CELL;
      ctx.beginPath();
      ctx.moveTo(offset, INSET);
      ctx.lineTo(offset, INSET + SIZE * CELL);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(INSET, offset);
      ctx.lineTo(INSET + SIZE * CELL, offset);
      ctx.stroke();
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        drawTile(r, c, states[r][c]);
      }
    }

    drawParticles();
    drawSelection();
  }

  function drawTile(r, c, mask) {
    const center = cellCenter(r, c);
    const radius = CELL * 0.34;
    const isPowered = powered.has(`${r},${c}`);
    const isTerminal = getTerminalPositions().some(pos => pos.r === r && pos.c === c);
    const isSeed = r === 2 && c === 2;

    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isPowered ? "rgba(136, 247, 194, 0.13)" : "rgba(16, 29, 24, 0.95)";
    ctx.fill();
    ctx.strokeStyle = isPowered ? "#88f7c2" : "#2d5142";
    ctx.lineWidth = isPowered ? 3 : 1.5;
    ctx.stroke();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = isPowered ? "#d8ff83" : "#557768";
    const arms = [
      { bit: N, x: center.x, y: center.y - radius },
      { bit: E, x: center.x + radius, y: center.y },
      { bit: S, x: center.x, y: center.y + radius },
      { bit: W, x: center.x - radius, y: center.y }
    ];
    arms.forEach(arm => {
      if (mask & arm.bit) {
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(arm.x, arm.y);
        ctx.stroke();
      }
    });

    ctx.beginPath();
    ctx.arc(center.x, center.y, isSeed ? 14 : 7, 0, Math.PI * 2);
    ctx.fillStyle = isSeed ? "#d8ff83" : isTerminal && isPowered ? "#d8ff83" : "#88f7c2";
    ctx.fill();

    if (isSeed) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, 21, 0, Math.PI * 2);
      ctx.strokeStyle = "#d8ff83";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (isTerminal) {
      ctx.beginPath();
      ctx.moveTo(center.x - 14, center.y - 8);
      ctx.quadraticCurveTo(center.x - 16, center.y - 24, center.x, center.y - 28);
      ctx.quadraticCurveTo(center.x + 16, center.y - 24, center.x + 14, center.y - 8);
      ctx.fillStyle = isPowered ? "#d8ff83" : "#3d6655";
      ctx.fill();
    }
  }

  function drawSelection() {
    const center = cellCenter(selected.r, selected.c);
    ctx.beginPath();
    ctx.arc(center.x, center.y, CELL * 0.43, 0, Math.PI * 2);
    ctx.strokeStyle = "#72d9ca";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      ctx.globalAlpha = Math.max(0, particle.life / 28);
      ctx.fillStyle = "#d8ff83";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  canvas.addEventListener("click", event => {
    if (paused || complete) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const c = Math.floor((x - INSET) / CELL);
    const r = Math.floor((y - INSET) / CELL);
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      selected = { r, c };
      rotateSelected();
    }
  });

  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (key === "p") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (key === "r") {
      event.preventDefault();
      startLevel();
      return;
    }
    if (paused || complete) return;

    if (["arrowup", "w"].includes(key)) selected.r = Math.max(0, selected.r - 1);
    if (["arrowdown", "s"].includes(key)) selected.r = Math.min(SIZE - 1, selected.r + 1);
    if (["arrowleft", "a"].includes(key)) selected.c = Math.max(0, selected.c - 1);
    if (["arrowright", "d"].includes(key)) selected.c = Math.min(SIZE - 1, selected.c + 1);
    if (key === "enter" || key === " ") {
      event.preventDefault();
      rotateSelected();
    } else {
      draw();
    }
  });

  function togglePause() {
    if (complete) return;
    paused = !paused;
    pauseOverlay.classList.toggle("hidden", !paused);
  }

  document.getElementById("pause-btn").addEventListener("click", togglePause);
  document.getElementById("resume-btn").addEventListener("click", togglePause);
  document.getElementById("restart-btn").addEventListener("click", startLevel);
  document.getElementById("rules-btn").addEventListener("click", () => rulesModal.classList.remove("hidden"));
  document.getElementById("close-rules-btn").addEventListener("click", () => rulesModal.classList.add("hidden"));

  document.getElementById("next-btn").addEventListener("click", () => {
    if (level < TOTAL_LEVELS) {
      level++;
      startLevel();
    } else {
      level = 1;
      score = 0;
      startLevel();
    }
  });

  window.addEventListener("message", event => {
    if (event.data && event.data.type === "AV_RESIZE") {
      draw();
    }
  });

  rulesModal.classList.remove("hidden");
  startLevel();
  rulesModal.classList.remove("hidden");
})();
