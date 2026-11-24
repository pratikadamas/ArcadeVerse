/**
 * Circuit Connect – Logic puzzle game
 * Rotate tiles to connect Power Source → Destination
 */

(() => {
  "use strict";

  // ---------- Tile types (bit flags: N=1, E=2, S=4, W=8) ----------
  const DIR = { N: 1, E: 2, S: 4, W: 8 };
  const OPP = {
    [DIR.N]: DIR.S,
    [DIR.E]: DIR.W,
    [DIR.S]: DIR.N,
    [DIR.W]: DIR.E,
  };
  const DELTA = {
    [DIR.N]: [-1, 0],
    [DIR.E]: [0, 1],
    [DIR.S]: [1, 0],
    [DIR.W]: [0, -1],
  };

  // Shape definitions: initial open directions (before rotation)
  const SHAPES = {
    I: DIR.E | DIR.W, // straight horizontal
    L: DIR.N | DIR.E, // corner
    T: DIR.N | DIR.E | DIR.W, // T-junction
    X: DIR.N | DIR.E | DIR.S | DIR.W, // cross
    end: DIR.N, // dead-end
  };

  // ---------- Level data ----------
  const LEVELS = [
    // Level 1 – 3x3 simple
    {
      rows: 3,
      cols: 3,
      power: [0, 0],
      dest: [2, 2],
      cells: [
        [
          { shape: "L", rot: 1 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 0 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 3 },
        ],
      ],
    },
    // Level 2 – 4x4
    {
      rows: 4,
      cols: 4,
      power: [0, 0],
      dest: [3, 3],
      cells: [
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 1 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 1 },
          { shape: "I", rot: 1 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "T", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 3 },
        ],
      ],
    },
    // Level 3 – 4x4 tangled
    {
      rows: 4,
      cols: 4,
      power: [0, 1],
      dest: [3, 2],
      cells: [
        [
          { shape: "L", rot: 1 },
          { shape: "T", rot: 2 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 3 },
          { shape: "L", rot: 1 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 3 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 3 },
          { shape: "L", rot: 1 },
        ],
      ],
    },
    // Level 4 – 5x5
    {
      rows: 5,
      cols: 5,
      power: [0, 0],
      dest: [4, 4],
      cells: [
        [
          { shape: "L", rot: 1 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 1 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 0 },
          { shape: "I", rot: 1 },
          { shape: "L", rot: 1 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "T", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "X", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 3 },
          { shape: "I", rot: 1 },
          { shape: "L", rot: 2 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 3 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 3 },
        ],
      ],
    },
    // Level 5 – 5x5 harder
    {
      rows: 5,
      cols: 5,
      power: [2, 0],
      dest: [2, 4],
      cells: [
        [
          { shape: "L", rot: 1 },
          { shape: "T", rot: 1 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 2 },
          { shape: "L", rot: 1 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 3 },
          { shape: "L", rot: 1 },
          { shape: "I", rot: 1 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "T", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "X", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 0 },
          { shape: "I", rot: 1 },
          { shape: "L", rot: 2 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "T", rot: 3 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 3 },
          { shape: "L", rot: 0 },
        ],
      ],
    },
    // Level 6 – 6x6
    {
      rows: 6,
      cols: 6,
      power: [0, 0],
      dest: [5, 5],
      cells: [
        [
          { shape: "L", rot: 1 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 1 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 1 },
          { shape: "L", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 0 },
          { shape: "I", rot: 1 },
          { shape: "L", rot: 1 },
          { shape: "I", rot: 1 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "T", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "X", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 2 },
          { shape: "T", rot: 2 },
        ],
        [
          { shape: "I", rot: 1 },
          { shape: "L", rot: 3 },
          { shape: "I", rot: 1 },
          { shape: "T", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 3 },
          { shape: "I", rot: 1 },
          { shape: "L", rot: 1 },
          { shape: "I", rot: 1 },
        ],
        [
          { shape: "L", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "I", rot: 0 },
          { shape: "T", rot: 3 },
          { shape: "I", rot: 0 },
          { shape: "L", rot: 3 },
        ],
      ],
    },
  ];

  // ---------- State ----------
  let levelIndex = 0;
  let grid = [];
  let rows = 0;
  let cols = 0;
  let powerPos = [0, 0];
  let destPos = [0, 0];
  let moves = 0;
  let score = 0;
  let totalScore = 0;
  let startTime = 0;
  let timerId = null;
  let solved = false;
  let hintUsed = false;

  // DOM
  const boardEl = document.getElementById("board");
  const levelNumEl = document.getElementById("level-num");
  const moveCountEl = document.getElementById("move-count");
  const timerEl = document.getElementById("timer");
  const scoreEl = document.getElementById("score");
  const completeOverlay = document.getElementById("complete-overlay");
  const howtoOverlay = document.getElementById("howto-overlay");
  const winOverlay = document.getElementById("win-overlay");

  // ---------- Helpers ----------
  function rotateMask(mask, times) {
    times = ((times % 4) + 4) % 4;
    let m = mask;
    for (let i = 0; i < times; i++) {
      let next = 0;
      if (m & DIR.N) next |= DIR.E;
      if (m & DIR.E) next |= DIR.S;
      if (m & DIR.S) next |= DIR.W;
      if (m & DIR.W) next |= DIR.N;
      m = next;
    }
    return m;
  }

  function getOpen(cell) {
    const base = SHAPES[cell.shape] || 0;
    return rotateMask(base, cell.rot);
  }

  function inBounds(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  // BFS from power source
  function computeConnected() {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const queue = [];
    const [pr, pc] = powerPos;
    queue.push([pr, pc]);
    visited[pr][pc] = true;

    while (queue.length) {
      const [r, c] = queue.shift();
      const open = getOpen(grid[r][c]);

      for (const d of [DIR.N, DIR.E, DIR.S, DIR.W]) {
        if (!(open & d)) continue;
        const [dr, dc] = DELTA[d];
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc) || visited[nr][nc]) continue;
        const nOpen = getOpen(grid[nr][nc]);
        if (nOpen & OPP[d]) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }
    return visited;
  }

  function isSolved(connected) {
    const [dr, dc] = destPos;
    return connected[dr][dc];
  }

  // ---------- Rendering ----------
  function createTileElement(r, c, cell) {
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.r = r;
    div.dataset.c = c;

    const isPower = r === powerPos[0] && c === powerPos[1];
    const isDest = r === destPos[0] && c === destPos[1];

    if (isPower) {
      div.classList.add("power", "fixed");
      const lbl = document.createElement("span");
      lbl.className = "label";
      lbl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
      div.appendChild(lbl);
    } else if (isDest) {
      div.classList.add("dest", "fixed");
      const lbl = document.createElement("span");
      lbl.className = "label";
      lbl.textContent = "◎";
      div.appendChild(lbl);
    }

    const hub = document.createElement("div");
    hub.className = "hub";
    div.appendChild(hub);

    const open = getOpen(cell);
    for (const [name, flag] of Object.entries({
      n: DIR.N,
      e: DIR.E,
      s: DIR.S,
      w: DIR.W,
    })) {
      if (open & flag) {
        const pipe = document.createElement("div");
        pipe.className = `pipe ${name}`;
        div.appendChild(pipe);
      }
    }

    if (!isPower && !isDest) {
      div.addEventListener("click", () => onTileClick(r, c));
      div.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTileClick(r, c);
        }
      });
      div.tabIndex = 0;
      div.setAttribute("role", "button");
      div.setAttribute(
        "aria-label",
        `Rotate tile at row ${r + 1}, column ${c + 1}`,
      );
    }

    return div;
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, auto)`;

    const connected = computeConnected();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const tile = createTileElement(r, c, cell);
        if (connected[r][c]) tile.classList.add("connected");
        boardEl.appendChild(tile);
      }
    }
  }

  function updateStats() {
    levelNumEl.textContent = levelIndex + 1;
    moveCountEl.textContent = moves;
    scoreEl.textContent = totalScore;
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function tickTimer() {
    if (solved) return;
    timerEl.textContent = formatTime(Date.now() - startTime);
  }

  // ---------- Game actions ----------
  function onTileClick(r, c) {
    if (solved) return;
    const cell = grid[r][c];
    if (cell.fixed) return;

    cell.rot = (cell.rot + 1) % 4;
    moves++;
    updateStats();
    renderBoard();

    const connected = computeConnected();
    if (isSolved(connected)) {
      onLevelComplete();
    }
  }

  function calcLevelScore() {
    const elapsed = (Date.now() - startTime) / 1000;
    let s = Math.max(100, 1000 - moves * 15 - Math.floor(elapsed) * 2);
    if (!hintUsed) s += 150;
    return s;
  }

  function onLevelComplete() {
    solved = true;
    clearInterval(timerId);
    boardEl.classList.add("success");
    setTimeout(() => boardEl.classList.remove("success"), 700);

    const levelScore = calcLevelScore();
    score = levelScore;
    totalScore += levelScore;
    updateStats();

    document.getElementById("final-moves").textContent = moves;
    document.getElementById("final-time").textContent = formatTime(
      Date.now() - startTime,
    );
    document.getElementById("final-score").textContent = totalScore;
    document.getElementById("complete-msg").textContent =
      levelIndex < LEVELS.length - 1
        ? "Circuit complete! Ready for the next challenge?"
        : "Final circuit solved!";

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_SCORE",
          score: totalScore
        }, "*");
      }
    } catch (_) {}

    if (levelIndex >= LEVELS.length - 1) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: "ARCADEVERSE_GAME_OVER",
            score: totalScore,
            levelsCompleted: LEVELS.length,
            details: {
              score: totalScore,
              levelsCompleted: LEVELS.length
            }
          }, "*");
        }
      } catch (_) {}
    }

    setTimeout(() => {
      completeOverlay.classList.remove("hidden");
    }, 400);
  }

  function loadLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;
    levelIndex = index;
    const lvl = LEVELS[index];
    rows = lvl.rows;
    cols = lvl.cols;
    powerPos = lvl.power.slice();
    destPos = lvl.dest.slice();

    grid = lvl.cells.map((row, r) =>
      row.map((cell, c) => {
        const copy = { shape: cell.shape, rot: cell.rot, fixed: false };
        if (
          (r === powerPos[0] && c === powerPos[1]) ||
          (r === destPos[0] && c === destPos[1])
        ) {
          copy.fixed = true;
        }
        return copy;
      }),
    );

    moves = 0;
    score = 0;
    solved = false;
    hintUsed = false;
    startTime = Date.now();
    clearInterval(timerId);
    timerId = setInterval(tickTimer, 250);
    timerEl.textContent = "0:00";

    completeOverlay.classList.add("hidden");
    winOverlay.classList.add("hidden");
    updateStats();
    renderBoard();
  }

  function restartLevel() {
    loadLevel(levelIndex);
  }

  function nextLevel() {
    if (levelIndex < LEVELS.length - 1) {
      loadLevel(levelIndex + 1);
    } else {
      document.getElementById("total-score").textContent = totalScore;
      completeOverlay.classList.add("hidden");
      winOverlay.classList.remove("hidden");
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: "ARCADEVERSE_GAME_OVER",
            score: totalScore,
            levelsCompleted: LEVELS.length,
            details: {
              score: totalScore,
              levelsCompleted: LEVELS.length
            }
          }, "*");
        }
      } catch (_) {}
    }
  }

  function prevLevel() {
    if (levelIndex > 0) loadLevel(levelIndex - 1);
  }

  function giveHint() {
    if (solved) return;
    hintUsed = true;

    let best = null;
    let bestGain = 0;
    const current = computeConnected();
    const currentCount = current.flat().filter(Boolean).length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].fixed) continue;
        const orig = grid[r][c].rot;
        for (let rot = 0; rot < 4; rot++) {
          if (rot === orig) continue;
          grid[r][c].rot = rot;
          const conn = computeConnected();
          const count = conn.flat().filter(Boolean).length;
          const gain = count - currentCount;
          if (gain > bestGain) {
            bestGain = gain;
            best = [r, c];
          }
        }
        grid[r][c].rot = orig;
      }
    }

    if (!best) {
      outer: for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!grid[r][c].fixed && !current[r][c]) {
            best = [r, c];
            break outer;
          }
        }
      }
    }

    if (best) {
      const [hr, hc] = best;
      const tiles = boardEl.querySelectorAll(".tile");
      const idx = hr * cols + hc;
      if (tiles[idx]) {
        tiles[idx].classList.add("hint");
        setTimeout(() => tiles[idx].classList.remove("hint"), 2000);
      }
    }
  }

  // ---------- Event listeners ----------
  document.getElementById("btn-hint").addEventListener("click", giveHint);
  document
    .getElementById("btn-restart")
    .addEventListener("click", restartLevel);
  document.getElementById("btn-prev").addEventListener("click", prevLevel);
  document.getElementById("btn-next").addEventListener("click", () => {
    if (
      solved ||
      confirm("Skip to next level? Progress on this level will be lost.")
    ) {
      nextLevel();
    }
  });
  document.getElementById("btn-howto").addEventListener("click", () => {
    howtoOverlay.classList.remove("hidden");
  });
  document.getElementById("btn-close-howto").addEventListener("click", () => {
    howtoOverlay.classList.add("hidden");
  });
  document.getElementById("btn-replay").addEventListener("click", () => {
    completeOverlay.classList.add("hidden");
    restartLevel();
  });
  document.getElementById("btn-continue").addEventListener("click", nextLevel);
  document.getElementById("btn-play-again").addEventListener("click", () => {
    totalScore = 0;
    loadLevel(0);
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.closest(".tile")) return;
    if (e.key === "r" || e.key === "R") restartLevel();
    if (e.key === "h" || e.key === "H") giveHint();
  });

  // ---------- Boot ----------
  loadLevel(0);
})();
