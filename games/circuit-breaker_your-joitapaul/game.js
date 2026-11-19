const directions = ["north", "east", "south", "west"];
const oppositeDirection = {
  north: "south",
  east: "west",
  south: "north",
  west: "east"
};
const directionDelta = {
  north: [-1, 0],
  east: [0, 1],
  south: [1, 0],
  west: [0, -1]
};
const basePorts = {
  endpoint: ["north"],
  stub: ["north"],
  straight: ["north", "south"],
  corner: ["north", "east"],
  tee: ["north", "east", "west"],
  cross: ["north", "east", "south", "west"]
};
const levels = [
  {
    name: "Warm-up Loop",
    size: 4,
    path: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]],
    decoys: [[1, 3], [3, 1]]
  },
  {
    name: "Crossed Wires",
    size: 5,
    path: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3], [4, 4]],
    decoys: [[0, 4], [3, 4], [4, 0]]
  },
  {
    name: "Double Switchback",
    size: 6,
    path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [4, 5], [5, 5]],
    decoys: [[0, 5], [3, 0], [5, 3], [5, 1]]
  },
  {
    name: "Grid Master",
    size: 7,
    path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5], [2, 5], [2, 4], [2, 3], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [5, 6], [6, 6]],
    decoys: [[1, 1], [1, 6], [3, 0], [5, 2], [6, 3]]
  }
];

const boardElement = document.getElementById("board");
const levelNumberElement = document.getElementById("level-number");
const levelNameElement = document.getElementById("level-name");
const moveCountElement = document.getElementById("move-count");
const scoreElement = document.getElementById("score");
const poweredCountElement = document.getElementById("powered-count");
const boardStateElement = document.getElementById("board-state");
const feedbackElement = document.getElementById("feedback");
const startOverlay = document.getElementById("start-overlay");
const helpOverlay = document.getElementById("help-overlay");
const pauseOverlay = document.getElementById("pause-overlay");
const completeOverlay = document.getElementById("complete-overlay");
const pauseButton = document.getElementById("pause-button");

let gameState = {
  started: false,
  paused: false,
  solved: false,
  levelIndex: 0,
  moves: 0,
  score: 0,
  tiles: new Map(),
  elements: new Map(),
  feedback: "Start the series to energize the first board."
};
let resumeAfterHelp = false;
let returnToPause = false;

function rotateDirection(direction, turns) {
  return directions[(directions.indexOf(direction) + turns) % directions.length];
}

function portsFor(tile) {
  return new Set(basePorts[tile.type].map((port) => rotateDirection(port, tile.rotation)));
}

function samePorts(first, second) {
  return first.size === second.size && [...first].every((port) => second.has(port));
}

function rotationForPorts(type, desiredPorts) {
  const desired = new Set(desiredPorts);
  for (let rotation = 0; rotation < directions.length; rotation += 1) {
    const candidate = new Set(basePorts[type].map((port) => rotateDirection(port, rotation)));
    if (samePorts(candidate, desired)) return rotation;
  }
  throw new Error(`No ${type} rotation matches the requested circuit connections.`);
}

function directionBetween(from, to) {
  if (to[0] < from[0]) return "north";
  if (to[0] > from[0]) return "south";
  if (to[1] < from[1]) return "west";
  return "east";
}

function tileId(row, column) {
  return `${row}-${column}`;
}

function addTile(tiles, row, column, type, rotation, role = "", rotatable = true) {
  const id = tileId(row, column);
  tiles.set(id, { id, row, column, type, rotation, role, rotatable });
}

function scrambleRotation(type, solutionRotation, row, column, levelIndex, requiredPorts) {
  let rotation = (solutionRotation + 1 + ((row + column + levelIndex) % 3)) % directions.length;
  for (let attempt = 0; attempt < directions.length; attempt += 1) {
    const candidate = new Set(basePorts[type].map((port) => rotateDirection(port, rotation)));
    if (!samePorts(candidate, new Set(requiredPorts))) return rotation;
    rotation = (rotation + 1) % directions.length;
  }
  throw new Error(`Unable to scramble the ${type} tile at row ${row + 1}, column ${column + 1}.`);
}

function makeTiles(level, levelIndex) {
  const tiles = new Map();
  const path = level.path;

  path.forEach((point, index) => {
    if (index === 0) {
      const output = directionBetween(point, path[index + 1]);
      addTile(tiles, point[0], point[1], "endpoint", rotationForPorts("endpoint", [output]), "source", false);
      return;
    }

    if (index === path.length - 1) {
      const input = directionBetween(point, path[index - 1]);
      addTile(tiles, point[0], point[1], "endpoint", rotationForPorts("endpoint", [input]), "target", false);
      return;
    }

    const incoming = directionBetween(point, path[index - 1]);
    const outgoing = directionBetween(point, path[index + 1]);
    const requiredPorts = [incoming, outgoing];
    const isStraight = oppositeDirection[incoming] === outgoing;
    const type = isStraight ? "straight" : "corner";
    const solutionRotation = rotationForPorts(type, requiredPorts);
    const rotation = scrambleRotation(type, solutionRotation, point[0], point[1], levelIndex, requiredPorts);
    addTile(tiles, point[0], point[1], type, rotation);
  });

  level.decoys.forEach(([row, column]) => {
    addTile(tiles, row, column, "stub", (row + column + levelIndex) % directions.length, "", true);
  });

  return tiles;
}

function getConnectedTiles() {
  const first = [...gameState.tiles.values()].find((tile) => tile.role === "source");
  if (!first) return new Set();

  const visited = new Set([first.id]);
  const queue = [first];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentPorts = portsFor(current);

    currentPorts.forEach((direction) => {
      const [rowDelta, columnDelta] = directionDelta[direction];
      const neighbor = gameState.tiles.get(tileId(current.row + rowDelta, current.column + columnDelta));
      if (!neighbor || visited.has(neighbor.id)) return;
      if (!portsFor(neighbor).has(oppositeDirection[direction])) return;
      visited.add(neighbor.id);
      queue.push(neighbor);
    });
  }

  return visited;
}

function tileDescription(tile) {
  const ports = [...portsFor(tile)].join(", ");
  if (tile.role === "source") return `Power source, row ${tile.row + 1}, column ${tile.column + 1}, output ${ports}.`;
  if (tile.role === "target") return `Target, row ${tile.row + 1}, column ${tile.column + 1}, input ${ports}.`;
  return `${tile.type} tile, row ${tile.row + 1}, column ${tile.column + 1}, open to ${ports}. Press Enter or Space to rotate clockwise.`;
}

function makeWireSvg(tile) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const pathByDirection = {
    north: "M32 32 L32 4",
    east: "M32 32 L60 32",
    south: "M32 32 L32 60",
    west: "M32 32 L4 32"
  };
  svg.setAttribute("class", "wire-svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  directions.forEach((direction) => {
    const arm = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arm.setAttribute("class", "wire-arm");
    arm.setAttribute("data-direction", direction);
    arm.setAttribute("d", pathByDirection[direction]);
    svg.appendChild(arm);
  });

  const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  core.setAttribute("class", "wire-core");
  core.setAttribute("cx", "32");
  core.setAttribute("cy", "32");
  core.setAttribute("r", "7");
  svg.appendChild(core);

  if (tile.role) {
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("class", "endpoint-icon");
    use.setAttribute("href", tile.role === "source" ? "#icon-source" : "#icon-target");
    use.setAttribute("x", "10");
    use.setAttribute("y", "10");
    use.setAttribute("width", "44");
    use.setAttribute("height", "44");
    svg.appendChild(use);
  }

  return svg;
}

function makeBoardElement(tile) {
  const element = document.createElement(tile.rotatable ? "button" : "div");
  element.className = `tile tile-${tile.type}${tile.role ? ` tile-${tile.role}` : ""}`;
  element.dataset.row = String(tile.row);
  element.dataset.column = String(tile.column);
  element.dataset.tileId = tile.id;

  if (tile.rotatable) {
    element.type = "button";
    element.classList.add("tile-button");
    element.setAttribute("aria-keyshortcuts", "Enter Space ArrowUp ArrowRight ArrowDown ArrowLeft");
    element.addEventListener("click", () => rotateTile(tile.id));
  } else {
    element.setAttribute("role", "img");
  }

  element.appendChild(makeWireSvg(tile));
  element.setAttribute("aria-label", tileDescription(tile));
  return element;
}

function renderBoard() {
  const level = levels[gameState.levelIndex];
  const connected = getConnectedTiles();
  const target = [...gameState.tiles.values()].find((tile) => tile.role === "target");
  const isConnected = target && connected.has(target.id);

  gameState.elements.forEach((element, id) => {
    const tile = gameState.tiles.get(id);
    const openPorts = portsFor(tile);
    element.classList.toggle("is-powered", connected.has(id));
    element.setAttribute("aria-label", tileDescription(tile));

    if (tile.rotatable) element.disabled = gameState.paused || gameState.solved;
    element.querySelectorAll(".wire-arm").forEach((arm) => {
      arm.classList.toggle("is-open", openPorts.has(arm.dataset.direction));
    });
  });

  boardElement.classList.toggle("is-paused", gameState.paused);
  levelNumberElement.textContent = `${String(gameState.levelIndex + 1).padStart(2, "0")} / ${String(levels.length).padStart(2, "0")}`;
  levelNameElement.textContent = level.name.toUpperCase();
  moveCountElement.textContent = String(gameState.moves);
  scoreElement.textContent = String(gameState.score).padStart(4, "0");
  poweredCountElement.textContent = String(connected.size);
  boardStateElement.textContent = isConnected ? "SIGNAL ONLINE" : "SIGNAL LOST";
  boardStateElement.classList.toggle("is-connected", Boolean(isConnected));
  pauseButton.disabled = !gameState.started || gameState.solved;
  document.getElementById("next-button").disabled = !gameState.solved;
  document.getElementById("next-button").textContent =
    gameState.levelIndex === levels.length - 1 ? "Replay series" : "Next puzzle";
  feedbackElement.textContent = gameState.feedback;
  feedbackElement.className = `feedback${gameState.solved ? " is-success" : ""}`;
}

function buildLevel(levelIndex) {
  gameState.levelIndex = levelIndex;
  gameState.moves = 0;
  gameState.solved = false;
  gameState.paused = false;
  gameState.feedback = `${levels[levelIndex].name} - rotate the tiles to connect the source to the target.`;
  gameState.tiles = makeTiles(levels[levelIndex], levelIndex);
  gameState.elements = new Map();
  boardElement.replaceChildren();
  boardElement.style.setProperty("--grid-size", String(levels[levelIndex].size));

  for (let row = 0; row < levels[levelIndex].size; row += 1) {
    for (let column = 0; column < levels[levelIndex].size; column += 1) {
      const tile = gameState.tiles.get(tileId(row, column));
      if (!tile) {
        const blank = document.createElement("div");
        blank.className = "tile-blank";
        blank.setAttribute("role", "presentation");
        boardElement.appendChild(blank);
        continue;
      }

      const element = makeBoardElement(tile);
      gameState.elements.set(tile.id, element);
      boardElement.appendChild(element);
    }
  }

  renderBoard();
  const firstRotatable = boardElement.querySelector(".tile-button");
  if (firstRotatable) firstRotatable.focus();
}

function beginSeries() {
  gameState.started = true;
  gameState.score = 0;
  startOverlay.hidden = true;
  helpOverlay.hidden = true;
  pauseOverlay.hidden = true;
  completeOverlay.hidden = true;
  buildLevel(0);
}

function restartPuzzle() {
  if (!gameState.started) {
    beginSeries();
    return;
  }
  pauseOverlay.hidden = true;
  completeOverlay.hidden = true;
  buildLevel(gameState.levelIndex);
}

function rotateTile(id) {
  const tile = gameState.tiles.get(id);
  if (!tile || !tile.rotatable || gameState.paused || gameState.solved || !gameState.started) return;

  tile.rotation = (tile.rotation + 1) % directions.length;
  gameState.moves += 1;
  gameState.feedback = `Rotated row ${tile.row + 1}, column ${tile.column + 1} clockwise.`;

  const connected = getConnectedTiles();
  const target = [...gameState.tiles.values()].find((item) => item.role === "target");
  if (connected.has(target.id)) {
    gameState.solved = true;
    const points = Math.max(100, 500 - gameState.moves * 10);
    gameState.score += points;
    gameState.feedback = `Circuit connected in ${gameState.moves} moves. +${points} points.`;
    showCompletion(points);
  }

  renderBoard();
}

function showCompletion(points) {
  const isFinalPuzzle = gameState.levelIndex === levels.length - 1;
  document.getElementById("complete-title").textContent =
    isFinalPuzzle ? "All circuits restored" : "Circuit restored";
  document.getElementById("complete-summary").textContent = isFinalPuzzle
    ? `Series complete. This board earned ${points} points. Total score: ${gameState.score}.`
    : `The signal reached its target in ${gameState.moves} moves. This board earned ${points} points.`;
  document.getElementById("advance-button").textContent = isFinalPuzzle ? "Replay series" : "Next puzzle";
  completeOverlay.hidden = false;
  document.getElementById("advance-button").focus();
}

function advancePuzzle() {
  if (!gameState.solved) return;
  completeOverlay.hidden = true;
  if (gameState.levelIndex === levels.length - 1) {
    beginSeries();
    return;
  }
  buildLevel(gameState.levelIndex + 1);
}

function pauseGame() {
  if (!gameState.started || gameState.solved || gameState.paused) return;
  gameState.paused = true;
  pauseOverlay.hidden = false;
  renderBoard();
  document.getElementById("resume-button").focus();
}

function resumeGame() {
  if (!gameState.paused) return;
  gameState.paused = false;
  pauseOverlay.hidden = true;
  renderBoard();
  pauseButton.focus();
}

function openHelp() {
  if (gameState.started && !gameState.solved && !gameState.paused) {
    resumeAfterHelp = true;
    returnToPause = false;
    gameState.paused = true;
    pauseOverlay.hidden = true;
    renderBoard();
  } else {
    resumeAfterHelp = false;
    returnToPause = gameState.paused;
    if (gameState.paused) pauseOverlay.hidden = true;
  }
  helpOverlay.hidden = false;
  document.getElementById("close-help-button").focus();
}

function closeHelp() {
  helpOverlay.hidden = true;
  if (resumeAfterHelp && gameState.paused) {
    gameState.paused = false;
  } else if (returnToPause && gameState.paused) {
    pauseOverlay.hidden = false;
  }
  resumeAfterHelp = false;
  returnToPause = false;
  renderBoard();

  if (!gameState.started) document.getElementById("start-button").focus();
  else if (gameState.paused) document.getElementById("resume-button").focus();
  else pauseButton.focus();
}

function focusAdjacentTile(currentButton, direction) {
  const row = Number(currentButton.dataset.row);
  const column = Number(currentButton.dataset.column);
  const [rowDelta, columnDelta] = directionDelta[direction];
  const size = levels[gameState.levelIndex].size;
  let nextRow = row + rowDelta;
  let nextColumn = column + columnDelta;

  while (nextRow >= 0 && nextRow < size && nextColumn >= 0 && nextColumn < size) {
    const candidate = gameState.elements.get(tileId(nextRow, nextColumn));
    if (candidate && candidate.classList.contains("tile-button") && !candidate.disabled) {
      candidate.focus();
      return;
    }
    nextRow += rowDelta;
    nextColumn += columnDelta;
  }
}

function handleBoardKeydown(event) {
  const tileButton = event.target.closest(".tile-button");
  if (!tileButton) return;

  if (event.key === "ArrowUp" || event.key === "ArrowRight" ||
      event.key === "ArrowDown" || event.key === "ArrowLeft") {
    event.preventDefault();
    const keyDirections = {
      ArrowUp: "north",
      ArrowRight: "east",
      ArrowDown: "south",
      ArrowLeft: "west"
    };
    focusAdjacentTile(tileButton, keyDirections[event.key]);
  }
}

function handleDocumentKeydown(event) {
  if (!helpOverlay.hidden) {
    if (event.key === "Escape") closeHelp();
    return;
  }

  if (event.key === "Escape" || event.key.toLowerCase() === "p") {
    if (gameState.paused) resumeGame();
    else pauseGame();
    return;
  }

  if (event.key.toLowerCase() === "r") {
    restartPuzzle();
    return;
  }

  if (event.key.toLowerCase() === "n" && gameState.solved) advancePuzzle();
}

document.getElementById("start-button").addEventListener("click", beginSeries);
document.getElementById("help-button").addEventListener("click", openHelp);
document.getElementById("close-help-button").addEventListener("click", closeHelp);
document.getElementById("pause-button").addEventListener("click", pauseGame);
document.getElementById("resume-button").addEventListener("click", resumeGame);
document.getElementById("restart-button").addEventListener("click", restartPuzzle);
document.getElementById("panel-restart-button").addEventListener("click", restartPuzzle);
document.getElementById("next-button").addEventListener("click", advancePuzzle);
document.getElementById("advance-button").addEventListener("click", advancePuzzle);
boardElement.addEventListener("keydown", handleBoardKeydown);
document.addEventListener("keydown", handleDocumentKeydown);

boardElement.style.setProperty("--grid-size", String(levels[0].size));
