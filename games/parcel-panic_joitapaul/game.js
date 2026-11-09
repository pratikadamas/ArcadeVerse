"use strict";

(() => {
  const DIRECTIONS = ["up", "right", "down", "left"];
  const OFFSETS = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
  };
  const ARROW_ROTATION = { up: 0, right: 90, down: 180, left: 270 };
  const STEP_DELAY_MS = 370;
  const STARTING_LIVES = 3;
  const PARCEL_COLORS = ["#ffc974", "#75dce2", "#a9e687"];
  const ARROW_SVG = '<svg class="conveyor-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';

  const STAGES = [
    {
      columns: 5,
      parcels: [
        { label: "A", name: "Amber parcel", source: [2, 0], route: [[2, 1], [3, 1], [3, 2], [3, 3], [2, 3]], destination: [1, 3] }
      ]
    },
    {
      columns: 6,
      parcels: [
        { label: "A", name: "Amber parcel", source: [1, 0], route: [[1, 1], [1, 2], [2, 2], [3, 2]], destination: [3, 3] },
        { label: "B", name: "Blue parcel", source: [5, 5], route: [[4, 5], [4, 4], [3, 4], [2, 4]], destination: [2, 5] }
      ]
    },
    {
      columns: 7,
      parcels: [
        { label: "A", name: "Amber parcel", source: [0, 2], route: [[1, 2], [1, 1]], destination: [0, 1] },
        { label: "B", name: "Blue parcel", source: [2, 0], route: [[2, 1], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4], [4, 3], [4, 2]], destination: [4, 1] },
        { label: "C", name: "Green parcel", source: [6, 3], route: [[5, 3], [5, 4], [5, 5], [4, 5], [3, 5]], destination: [3, 6] }
      ]
    }
  ];

  const gridElement = document.querySelector("#factory-grid");
  const stageCountElement = document.querySelector("#stage-count");
  const stageTotalElement = document.querySelector("#stage-total");
  const deliveredCountElement = document.querySelector("#delivered-count");
  const parcelTotalElement = document.querySelector("#parcel-total");
  const livesCountElement = document.querySelector("#lives-count");
  const progressElement = document.querySelector("#stage-progress");
  const manifestElement = document.querySelector("#parcel-manifest");
  const statusElement = document.querySelector("#game-status");
  const selectionElement = document.querySelector("#selection-status");
  const selectionDot = document.querySelector(".selection-dot");
  const dispatchButton = document.querySelector("#dispatch-button");
  const restartButton = document.querySelector("#restart-button");

  let stageIndex = 0;
  let lives = STARTING_LIVES;
  let stage;
  let cells = [];
  let parcels = [];
  let selectedTile = null;
  let isRunning = false;
  let gameState = "playing";
  let stepTimer = null;

  function toIndex(position) {
    return position[0] * stage.columns + position[1];
  }

  function getDirection(from, to) {
    const dx = to[1] - from[1];
    const dy = to[0] - from[0];
    return Object.entries(OFFSETS).find(([, offset]) => offset.x === dx && offset.y === dy)?.[0];
  }

  function createStageData() {
    const rows = stage.parcels.map((parcel, parcelIndex) => {
      const source = toIndex(parcel.source);
      const route = parcel.route.map(toIndex);
      const destination = toIndex(parcel.destination);
      const fullRoute = [parcel.source, ...parcel.route, parcel.destination];

      route.forEach((cellIndex, routeIndex) => {
        const direction = getDirection(fullRoute[routeIndex + 1], fullRoute[routeIndex + 2]);
        const previous = cells[cellIndex];
        if (previous.type === "conveyor" && previous.solution !== direction) {
          throw new Error(`Conflicting conveyor routes at cell ${cellIndex}.`);
        }
        if (previous.type !== "conveyor") {
          const directionIndex = DIRECTIONS.indexOf(direction);
          const offset = (cellIndex + parcelIndex + stageIndex) % 2 === 0 ? 1 : 3;
          cells[cellIndex] = { type: "conveyor", solution: direction, direction: DIRECTIONS[(directionIndex + offset) % DIRECTIONS.length] };
        }
      });

      cells[source] = { type: "source", parcelIndex, exit: getDirection(parcel.source, parcel.route[0]) };
      cells[destination] = { type: "destination", parcelIndex };

      return {
        label: parcel.label,
        name: parcel.name,
        color: PARCEL_COLORS[parcelIndex],
        source,
        route: route.slice(),
        destination,
        position: source,
        state: "waiting"
      };
    });

    parcels = rows;
  }

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function setSelectionMessage() {
    if (selectedTile === null) {
      selectionElement.textContent = "Select a conveyor tile to rotate it.";
      selectionDot.classList.remove("active");
      return;
    }
    const cell = cells[selectedTile];
    const row = Math.floor(selectedTile / stage.columns) + 1;
    const column = selectedTile % stage.columns + 1;
    selectionElement.textContent = `Tile at row ${row}, column ${column} points ${cell.direction}. Select again or press Enter to rotate clockwise.`;
    selectionDot.classList.add("active");
  }

  function updateGrid() {
    const markers = new Map();
    parcels.forEach((parcel) => {
      if (parcel.state === "waiting" || parcel.state === "moving" || parcel.state === "delivered") {
        if (!markers.has(parcel.position)) markers.set(parcel.position, []);
        markers.get(parcel.position).push(parcel);
      }
    });

    cells.forEach((cell, index) => {
      const element = cell.element;
      element.classList.toggle("selected", index === selectedTile);
      element.querySelectorAll(".parcel-marker").forEach((marker) => marker.remove());

      const arrow = element.querySelector(".conveyor-icon");
      if (arrow && cell.direction) arrow.style.transform = `rotate(${ARROW_ROTATION[cell.direction]}deg)`;
      if (element.matches(".conveyor-cell")) {
        const row = Math.floor(index / stage.columns) + 1;
        const column = index % stage.columns + 1;
        element.setAttribute("aria-label", `Conveyor at row ${row}, column ${column}, pointing ${cell.direction}. Press Enter or Space to rotate clockwise.`);
        element.setAttribute("aria-pressed", String(index === selectedTile));
        element.disabled = gameState !== "playing" || isRunning;
      }

      (markers.get(index) || []).forEach((parcel) => {
        const marker = document.createElement("span");
        marker.className = `parcel-marker${parcel.state === "delivered" ? " delivered" : ""}`;
        marker.textContent = parcel.label;
        marker.style.setProperty("--parcel-color", parcel.color);
        marker.setAttribute("aria-label", `${parcel.name}${parcel.state === "delivered" ? ", delivered" : ""}`);
        element.append(marker);
      });
    });
  }

  function updateManifest() {
    manifestElement.replaceChildren();
    parcels.forEach((parcel) => {
      const row = document.createElement("div");
      row.className = `manifest-item${parcel.state === "delivered" ? " delivered" : parcel.state === "failed" ? " failed" : ""}`;
      const badge = document.createElement("span");
      badge.className = "manifest-badge";
      badge.textContent = parcel.label;
      badge.style.setProperty("--parcel-color", parcel.color);
      const label = document.createElement("span");
      label.textContent = `${parcel.name} to OUT ${parcel.label}`;
      const state = document.createElement("strong");
      state.textContent = parcel.state === "delivered" ? "Delivered" : parcel.state === "failed" ? "Jammed" : "Waiting";
      row.append(badge, label, state);
      manifestElement.append(row);
    });
  }

  function updateDisplay() {
    stageCountElement.textContent = String(Math.min(stageIndex + 1, STAGES.length));
    stageTotalElement.textContent = String(STAGES.length);
    deliveredCountElement.textContent = String(parcels.filter((parcel) => parcel.state === "delivered").length);
    parcelTotalElement.textContent = String(parcels.length);
    livesCountElement.textContent = String(lives);
    progressElement.max = parcels.length;
    progressElement.value = parcels.filter((parcel) => parcel.state === "delivered").length;
    progressElement.textContent = `${progressElement.value} of ${parcels.length}`;
    dispatchButton.disabled = gameState !== "playing" || isRunning;
    dispatchButton.textContent = parcels.some((parcel) => parcel.state === "failed") ? "Retry parcels" : "Run parcels";
    updateGrid();
    updateManifest();
    setSelectionMessage();
  }

  function selectTile(index) {
    if (gameState !== "playing" || isRunning) return;
    selectedTile = index;
    const cell = cells[index];
    const directionIndex = DIRECTIONS.indexOf(cell.direction);
    cell.direction = DIRECTIONS[(directionIndex + 1) % DIRECTIONS.length];
    setStatus("Conveyor rotated clockwise. Select another tile or run the parcels.");
    updateDisplay();
  }

  function createGrid() {
    gridElement.replaceChildren();
    gridElement.style.setProperty("--columns", String(stage.columns));
    cells.forEach((cell, index) => {
      let element;
      if (cell.type === "conveyor") {
        element = document.createElement("button");
        element.type = "button";
        element.className = "factory-cell conveyor-cell";
        element.innerHTML = ARROW_SVG;
        element.addEventListener("click", () => selectTile(index));
      } else {
        element = document.createElement("div");
        element.className = `factory-cell ${cell.type}-cell`;
        if (cell.type === "source") {
          const parcel = parcels[cell.parcelIndex];
          element.style.setProperty("--parcel-color", parcel.color);
          element.innerHTML = `<svg class="source-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg><span>IN ${parcel.label}</span>`;
          element.setAttribute("aria-label", `Parcel entry ${parcel.label}`);
        } else if (cell.type === "destination") {
          const parcel = parcels[cell.parcelIndex];
          element.style.setProperty("--parcel-color", parcel.color);
          element.innerHTML = `<span class="destination-ring" aria-hidden="true"></span><span class="destination-label">OUT ${parcel.label}</span>`;
          element.setAttribute("aria-label", `Destination for parcel ${parcel.label}`);
        } else {
          element.setAttribute("aria-label", "Empty floor");
        }
      }
      element.setAttribute("role", "gridcell");
      cell.element = element;
      gridElement.append(element);
    });
  }

  function loadStage() {
    stage = STAGES[stageIndex];
    cells = Array(stage.columns * stage.columns).fill(null).map(() => ({ type: "floor" }));
    selectedTile = null;
    createStageData();
    createGrid();
    setStatus(`Stage ${stageIndex + 1}: route each parcel to its matching destination.`);
    updateDisplay();
  }

  function resolveFailure(parcel, reason) {
    if (parcel.state === "failed" || parcel.state === "delivered") return;
    parcel.state = "failed";
    lives -= 1;
    setStatus(`${parcel.name} ${reason}. One mistake used.`);
  }

  function nextCell(position, direction) {
    const offset = OFFSETS[direction];
    const x = position % stage.columns;
    const y = Math.floor(position / stage.columns);
    const nextX = x + offset.x;
    const nextY = y + offset.y;
    if (nextX < 0 || nextX >= stage.columns || nextY < 0 || nextY >= stage.columns) return -1;
    return nextY * stage.columns + nextX;
  }

  function advanceParcels() {
    const active = parcels.filter((parcel) => parcel.state === "moving");
    const proposals = active.map((parcel) => {
      const cell = cells[parcel.position];
      const direction = cell.type === "source" ? cell.exit : cell.type === "conveyor" ? cell.direction : null;
      if (!direction) return { parcel, next: -1, error: "reached an invalid conveyor" };

      const next = nextCell(parcel.position, direction);
      if (next < 0) return { parcel, next, error: "jammed at the edge of the sorting floor" };
      const target = cells[next];
      if (target.type === "floor") return { parcel, next, error: "jammed on an empty floor tile" };
      if (target.type === "source") return { parcel, next, error: "jammed at a parcel entry" };
      if (target.type === "destination" && target.parcelIndex !== parcels.indexOf(parcel)) {
        return { parcel, next, error: `reached the wrong destination, OUT ${parcels[target.parcelIndex].label}` };
      }
      return { parcel, next, error: null };
    });

    const collisions = new Set();
    proposals.forEach((proposal, index) => {
      if (proposal.next < 0 || proposal.error) return;
      proposals.slice(index + 1).forEach((other) => {
        if (proposal.next === other.next ||
          (proposal.next === other.parcel.position && other.next === proposal.parcel.position)) {
          collisions.add(proposal.parcel);
          collisions.add(other.parcel);
        }
      });
    });

    proposals.forEach((proposal) => {
      if (proposal.error) {
        resolveFailure(proposal.parcel, proposal.error);
      } else if (collisions.has(proposal.parcel)) {
        resolveFailure(proposal.parcel, "collided with another parcel");
      } else if (cells[proposal.next].type === "destination") {
        proposal.parcel.position = proposal.next;
        proposal.parcel.state = "delivered";
        setStatus(`${proposal.parcel.name} delivered to OUT ${proposal.parcel.label}.`);
      } else {
        proposal.parcel.position = proposal.next;
      }
    });

    updateDisplay();
    if (lives <= 0) {
      finishGame();
      return;
    }
    if (parcels.every((parcel) => parcel.state === "delivered" || parcel.state === "failed")) {
      finishRun();
    }
  }

  function finishRun() {
    isRunning = false;
    if (stepTimer !== null) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    if (parcels.every((parcel) => parcel.state === "delivered")) {
      if (stageIndex === STAGES.length - 1) {
        gameState = "won";
        setStatus("Every parcel reached its matching destination. All three stages cleared!");
      } else {
        stageIndex += 1;
        loadStage();
        setStatus(`Stage cleared. Stage ${stageIndex + 1} is ready; route the next manifest.`);
      }
    } else {
      parcels.forEach((parcel) => {
        if (parcel.state === "failed" || parcel.state === "delivered") {
          parcel.position = parcel.source;
          parcel.state = "waiting";
        }
      });
      selectedTile = null;
      setStatus(`Run ended with a routing error. ${lives} ${lives === 1 ? "mistake remains" : "mistakes remain"}. Adjust the conveyors and retry.`);
    }
    updateDisplay();
  }

  function finishGame() {
    isRunning = false;
    gameState = "lost";
    if (stepTimer !== null) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    setStatus("No mistakes remain. The shift is over. Restart the game to try again.");
    updateDisplay();
  }

  function runParcels() {
    if (gameState !== "playing" || isRunning) return;
    parcels.forEach((parcel) => {
      if (parcel.state === "failed" || parcel.state === "delivered") {
        parcel.position = parcel.source;
        parcel.state = "waiting";
      }
      parcel.state = "moving";
    });
    selectedTile = null;
    isRunning = true;
    setStatus("Parcels are moving. Watch each route through the sorting floor.");
    updateDisplay();
    stepTimer = setInterval(advanceParcels, STEP_DELAY_MS);
  }

  function restartGame() {
    if (stepTimer !== null) {
      clearInterval(stepTimer);
      stepTimer = null;
    }
    stageIndex = 0;
    lives = STARTING_LIVES;
    gameState = "playing";
    isRunning = false;
    loadStage();
    setStatus("Game restarted. Rotate the conveyor tiles, then run the parcels.");
  }

  dispatchButton.addEventListener("click", runParcels);
  restartButton.addEventListener("click", restartGame);
  loadStage();
})();
