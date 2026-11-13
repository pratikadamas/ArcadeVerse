const boardElement = document.getElementById("board");
const levelLabel = document.getElementById("level-label");
const movesLabel = document.getElementById("moves-label");
const statusElement = document.getElementById("game-status");
const resetButton = document.getElementById("reset-button");
const nextButton = document.getElementById("next-button");

if (!boardElement || !levelLabel || !movesLabel || !statusElement || !resetButton || !nextButton) {
  throw new Error("Prism Pulse could not find all required game elements.");
}

const SIZE = 6;
const DIRECTIONS = [
  { row: -1, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 0, col: -1 }
];

const LEVELS = [
  {
    name: "First Refraction",
    emitter: { row: 3, col: 0, direction: 1 },
    receiver: { row: 5, col: 5 },
    mirrors: [
      { row: 3, col: 2, solved: "\\" },
      { row: 5, col: 2, solved: "/" },
      { row: 5, col: 0, solved: "\\" },
      { row: 1, col: 0, solved: "/" },
      { row: 1, col: 5, solved: "\\" }
    ],
    blockers: [{ row: 2, col: 3 }, { row: 4, col: 4 }]
  },
  {
    name: "Split Horizon",
    emitter: { row: 1, col: 0, direction: 1 },
    receiver: { row: 0, col: 5 },
    mirrors: [
      { row: 1, col: 4, solved: "\\" },
      { row: 4, col: 4, solved: "/" },
      { row: 4, col: 1, solved: "\\" },
      { row: 0, col: 1, solved: "/" }
    ],
    blockers: [{ row: 2, col: 2 }, { row: 3, col: 3 }, { row: 2, col: 5 }]
  },
  {
    name: "Core Convergence",
    emitter: { row: 4, col: 0, direction: 1 },
    receiver: { row: 3, col: 5 },
    mirrors: [
      { row: 4, col: 1, solved: "/" },
      { row: 1, col: 1, solved: "\\" },
      { row: 1, col: 0, solved: "/" },
      { row: 3, col: 0, solved: "\\" }
    ],
    blockers: [{ row: 2, col: 2 }, { row: 2, col: 4 }, { row: 0, col: 3 }]
  },
  {
    name: "Prism Matrix",
    emitter: { row: 0, col: 0, direction: 1 },
    receiver: { row: 5, col: 5 },
    mirrors: [
      { row: 0, col: 4, solved: "\\" },
      { row: 2, col: 4, solved: "/" },
      { row: 2, col: 2, solved: "/" },
      { row: 5, col: 2, solved: "\\" }
    ],
    blockers: [{ row: 1, col: 2 }, { row: 3, col: 4 }, { row: 4, col: 1 }]
  },
  {
    name: "Quantum Zigzag",
    emitter: { row: 1, col: 0, direction: 1 },
    receiver: { row: 4, col: 5 },
    mirrors: [
      { row: 1, col: 3, solved: "\\" },
      { row: 3, col: 3, solved: "/" },
      { row: 3, col: 1, solved: "/" },
      { row: 5, col: 1, solved: "\\" },
      { row: 5, col: 4, solved: "/" },
      { row: 4, col: 4, solved: "/" }
    ],
    blockers: [{ row: 0, col: 3 }, { row: 2, col: 2 }, { row: 4, col: 2 }]
  },
  {
    name: "Photon Cascade",
    emitter: { row: 5, col: 0, direction: 0 },
    receiver: { row: 0, col: 5 },
    mirrors: [
      { row: 2, col: 0, solved: "/" },
      { row: 2, col: 2, solved: "\\" },
      { row: 4, col: 2, solved: "\\" },
      { row: 4, col: 4, solved: "/" },
      { row: 1, col: 4, solved: "\\" },
      { row: 1, col: 1, solved: "/" },
      { row: 3, col: 1, solved: "\\" },
      { row: 3, col: 5, solved: "/" }
    ],
    blockers: [{ row: 0, col: 2 }, { row: 2, col: 3 }, { row: 5, col: 3 }, { row: 5, col: 5 }]
  }
];

// Sound Synthesizer via Web Audio API
let audioCtx = null;
let soundEnabled = localStorage.getItem("prism-pulse-sound-enabled") !== "false";

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function updateSoundUI() {
  const iconOn = document.getElementById("sound-icon-on");
  const iconOff = document.getElementById("sound-icon-off");
  const soundBtn = document.getElementById("sound-toggle-btn");
  if (iconOn && iconOff && soundBtn) {
    if (soundEnabled) {
      iconOn.classList.remove("hidden");
      iconOff.classList.add("hidden");
      soundBtn.setAttribute("aria-label", "Mute sound");
      soundBtn.setAttribute("title", "Mute sound");
    } else {
      iconOn.classList.add("hidden");
      iconOff.classList.remove("hidden");
      soundBtn.setAttribute("aria-label", "Unmute sound");
      soundBtn.setAttribute("title", "Unmute sound");
    }
  }
}

function playRotateSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (_) {}
}

function playLitSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.15, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + 0.35);
    });
  } catch (_) {}
}

function playWinSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch (_) {}
}

let levelIndex = 0;
let moves = 0;
let totalMoves = 0;
let mirrors = [];
let beamCells = new Set();
let receiverLit = false;
let levelComplete = false;

function keyFor(row, col) {
  return `${row},${col}`;
}

function getLevel() {
  return LEVELS[levelIndex];
}

function resetLevel(isNextStage = false) {
  const level = getLevel();
  if (isNextStage) {
    moves = 0;
  } else {
    totalMoves -= moves;
    moves = 0;
  }
  levelComplete = false;
  receiverLit = false;
  mirrors = level.mirrors.map((mirror) => ({
    ...mirror,
    orientation: mirror.solved === "/" ? "\\" : "/"
  }));
  levelLabel.textContent = `${levelIndex + 1} / ${LEVELS.length}`;
  movesLabel.textContent = totalMoves;
  statusElement.textContent = `${level.name}: rotate mirrors to guide the beam.`;
  statusElement.classList.remove("success");
  nextButton.hidden = true;
  traceBeam();
  renderBoard();
}

function reflect(direction, orientation) {
  if (orientation === "/") return direction % 2 === 0 ? direction + 1 : direction - 1;
  return 3 - direction;
}

function traceBeam() {
  const level = getLevel();
  const mirrorByPosition = new Map(mirrors.map((mirror) => [keyFor(mirror.row, mirror.col), mirror]));
  const blockers = new Set(level.blockers.map(({ row, col }) => keyFor(row, col)));
  const visited = new Set();
  const cells = new Set();
  let row = level.emitter.row;
  let col = level.emitter.col;
  let direction = level.emitter.direction;
  let reachedReceiver = false;

  for (let step = 0; step < SIZE * SIZE * 4; step++) {
    const state = `${row},${col},${direction}`;
    if (visited.has(state)) break;
    visited.add(state);

    const position = keyFor(row, col);
    cells.add(position);
    if (row === level.receiver.row && col === level.receiver.col) {
      reachedReceiver = true;
      break;
    }
    if (blockers.has(position)) break;

    const mirror = mirrorByPosition.get(position);
    if (mirror) direction = reflect(direction, mirror.orientation);

    row += DIRECTIONS[direction].row;
    col += DIRECTIONS[direction].col;
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) break;
  }

  beamCells = cells;
  receiverLit = reachedReceiver;
}

function showVictoryDialog(totalRotations, score) {
  let dialog = document.getElementById("victory-dialog");
  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "victory-dialog";
    dialog.className = "victory-overlay";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "victory-title");

    if (!document.getElementById("prism-pulse-victory-style")) {
      const style = document.createElement("style");
      style.id = "prism-pulse-victory-style";
      style.textContent = `
        .victory-overlay {
          position: fixed;
          inset: 0;
          background: rgba(8, 11, 20, 0.88);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1.5rem;
        }
        .victory-overlay.hidden {
          display: none !important;
        }
        .victory-card {
          background: rgba(16, 22, 37, 0.98);
          border: 1px solid rgba(99, 212, 255, 0.35);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 212, 255, 0.15);
          border-radius: 1rem;
          padding: 2rem;
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        .victory-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(99, 212, 255, 0.1);
          border: 1.5px solid #63d4ff;
          margin-bottom: 0.8rem;
          color: #63d4ff;
        }
        .victory-card h2 {
          margin: 0 0 0.4rem;
          font-size: 1.5rem;
          color: #f4f7ff;
        }
        .victory-desc {
          color: #98a7c1;
          font-size: 0.88rem;
          margin: 0 0 1.25rem;
          line-height: 1.45;
        }
        .victory-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
          background: rgba(8, 11, 20, 0.6);
          padding: 0.8rem 1rem;
          border-radius: 0.75rem;
          margin-bottom: 1.4rem;
          border: 1px solid rgba(130, 158, 205, 0.12);
        }
        .victory-stats .v-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #63d4ff;
          display: block;
        }
        .victory-stats .v-value {
          font-size: 1.35rem;
          color: #f4f7ff;
          display: block;
          margin-top: 0.2rem;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(dialog);
  }

  dialog.innerHTML = `
    <div class="victory-card">
      <div class="victory-icon" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="6"/>
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
        </svg>
      </div>
      <h2 id="victory-title">Campaign Solved!</h2>
      <p class="victory-desc">All labyrinths completed. The prism is stable and perfectly aligned!</p>
      <div class="victory-stats">
        <div class="v-stat">
          <span class="v-label">ROTATIONS</span>
          <strong class="v-value">${totalRotations}</strong>
        </div>
        <div class="v-stat">
          <span class="v-label">SCORE</span>
          <strong class="v-value">${score}</strong>
        </div>
      </div>
      <div class="victory-actions">
        <button id="btn-play-again" class="primary-button" type="button">Play Again</button>
      </div>
    </div>
  `;

  dialog.classList.remove("hidden");

  const playAgainBtn = dialog.querySelector("#btn-play-again");
  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      dialog.classList.add("hidden");
      levelIndex = 0;
      totalMoves = 0;
      moves = 0;
      resetLevel(true);
    });
    playAgainBtn.focus();
  }
}

function rotateMirror(index) {
  if (levelComplete) return;

  playRotateSound();
  mirrors[index].orientation = mirrors[index].orientation === "/" ? "\\" : "/";
  moves++;
  totalMoves++;
  movesLabel.textContent = totalMoves;
  traceBeam();
  renderBoard();

  if (receiverLit) {
    levelComplete = true;
    playLitSound();
    playWinSound();

    const isFinalLevel = levelIndex === LEVELS.length - 1;
    const totalCampaignScore = Math.max(500, (LEVELS.length * 1000) - (totalMoves * 35));

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_SCORE",
          score: Math.max(100, ((levelIndex + 1) * 1000) - (totalMoves * 35))
        }, "*");
      }
    } catch (_) {}

    if (isFinalLevel) {
      statusElement.textContent = `All labyrinths solved in ${totalMoves} rotations! Score: ${totalCampaignScore}`;
      statusElement.classList.add("success");
      nextButton.hidden = true;

      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: "ARCADEVERSE_GAME_OVER",
            score: totalCampaignScore,
            details: {
              score: totalCampaignScore,
              totalMoves: totalMoves,
              levelsCompleted: LEVELS.length
            }
          }, "*");
        }
      } catch (_) {}

      setTimeout(() => {
        showVictoryDialog(totalMoves, totalCampaignScore);
      }, 450);
    } else {
      statusElement.textContent = `${getLevel().name} complete in ${moves} rotations.`;
      statusElement.classList.add("success");
      nextButton.hidden = false;
      nextButton.textContent = "Next labyrinth ->";
    }
  } else {
    statusElement.textContent = "The beam is moving. Try another mirror to change its route.";
  }
}

function createCell(row, col, level) {
  const cell = document.createElement("div");
  const position = keyFor(row, col);
  cell.className = "cell";
  cell.setAttribute("role", "gridcell");

  if (beamCells.has(position)) cell.classList.add("beam");

  if (row === level.emitter.row && col === level.emitter.col) {
    cell.classList.add("emitter");
    cell.setAttribute("aria-label", "Laser emitter");
    cell.innerHTML = '<span class="endpoint-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9"/></svg></span>';
    return cell;
  }

  if (row === level.receiver.row && col === level.receiver.col) {
    cell.classList.add("receiver");
    if (receiverLit) cell.classList.add("lit");
    cell.setAttribute("aria-label", receiverLit ? "Receiver lit" : "Laser receiver");
    cell.innerHTML = '<span class="endpoint-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg></span>';
    return cell;
  }

  const mirrorIndex = mirrors.findIndex((mirror) => mirror.row === row && mirror.col === col);
  if (mirrorIndex !== -1) {
    const mirror = mirrors[mirrorIndex];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell mirror";
    if (beamCells.has(position)) button.classList.add("beam");
    button.textContent = mirror.orientation;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `Mirror at row ${row + 1}, column ${col + 1}, angled ${mirror.orientation === "/" ? "slash" : "backslash"}. Rotate mirror.`);
    button.disabled = levelComplete;
    button.addEventListener("click", () => rotateMirror(mirrorIndex));
    button.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        rotateMirror(mirrorIndex);
      }
    });
    return button;
  }

  if (level.blockers.some((blocker) => blocker.row === row && blocker.col === col)) {
    cell.classList.add("blocker");
    cell.setAttribute("aria-label", "Blocked tile");
    cell.innerHTML = '<span class="blocker-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
    return cell;
  }

  cell.setAttribute("aria-label", "Empty tile");
  return cell;
}

function renderBoard() {
  const level = getLevel();
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      fragment.appendChild(createCell(row, col, level));
    }
  }
  boardElement.replaceChildren(fragment);
}

resetButton.addEventListener("click", () => resetLevel(false));
nextButton.addEventListener("click", () => {
  if (!levelComplete || levelIndex >= LEVELS.length - 1) return;
  levelIndex++;
  resetLevel(true);
});

const soundToggleBtn = document.getElementById("sound-toggle-btn");
if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("prism-pulse-sound-enabled", soundEnabled);
    updateSoundUI();
    if (soundEnabled) playRotateSound();
  });
}
updateSoundUI();

resetLevel();
