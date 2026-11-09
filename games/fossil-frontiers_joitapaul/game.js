"use strict";

(() => {
  const GRID_SIZE = 8;
  const TOTAL_DIG_CHARGES = 19;
  const TOTAL_SCANS = 3;
  const CLUE_DIGS = 2;
  const FOSSIL_CELLS = [
    [1, 1], [1, 2], [2, 2], [3, 2],
    [3, 3], [4, 3], [5, 3], [5, 4]
  ];
  const FOSSIL_SVG = '<svg class="fragment-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M7.1 3.8a4.7 4.7 0 0 1 4.7 4.7v1.2h4.5a3 3 0 0 1 0 6h-4.5v3.1a4.7 4.7 0 1 1-6 4.4 4.7 4.7 0 0 1-1.6-8.5V9.7a4.7 4.7 0 0 1 2.9-5.9Z" transform="rotate(-35 14 16)"/></svg>';

  const gridElement = document.querySelector("#excavation-grid");
  const statusElement = document.querySelector("#game-status");
  const selectionElement = document.querySelector("#selection-status");
  const digCountElement = document.querySelector("#dig-count");
  const scanCountElement = document.querySelector("#scan-count");
  const fragmentCountElement = document.querySelector("#fragment-count");
  const fragmentTotalElement = document.querySelector("#fragment-total");
  const progressElement = document.querySelector("#excavation-progress");
  const digModeButton = document.querySelector("#dig-mode");
  const surveyModeButton = document.querySelector("#survey-mode");
  const modeDescription = document.querySelector("#mode-description");
  const restartButton = document.querySelector("#restart-button");

  let cells = [];
  let selectedIndex = 0;
  let mode = "dig";
  let digCharges = TOTAL_DIG_CHARGES;
  let scans = TOTAL_SCANS;
  let recovered = 0;
  let gameState = "playing";

  function toIndex(row, column) {
    return row * GRID_SIZE + column;
  }

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function getCellLabel(cell, index) {
    const row = Math.floor(index / GRID_SIZE) + 1;
    const column = index % GRID_SIZE + 1;
    const parts = [`Row ${row}, column ${column}`];
    if (cell.dug) parts.push(cell.fragment ? "fossil fragment recovered" : "excavated, no fragment");
    else if (cell.clue !== null) parts.push(`survey clue: ${cell.clue} fragments nearby, visible for ${cell.clueDigs} more excavations`);
    else if (cell.surveyed) parts.push("surveyed ground");
    else parts.push("undisturbed ground");
    return parts.join(", ");
  }

  function updateSelection() {
    const row = Math.floor(selectedIndex / GRID_SIZE) + 1;
    const column = selectedIndex % GRID_SIZE + 1;
    const action = mode === "dig" ? "Excavate" : "Survey";
    selectionElement.textContent = `Selected: row ${row}, column ${column}. ${action} mode. Use arrow keys to move, then Enter to act.`;
  }

  function updateGrid() {
    cells.forEach((cell, index) => {
      const element = cell.element;
      element.classList.toggle("surveyed", cell.surveyed);
      element.classList.toggle("dug", cell.dug);
      element.classList.toggle("has-fragment", cell.dug && cell.fragment);
      element.setAttribute("aria-label", getCellLabel(cell, index));
      element.setAttribute("aria-selected", String(index === selectedIndex));
      element.disabled = gameState !== "playing" || (mode === "dig" && cell.dug);
      element.replaceChildren();

      const coordinate = document.createElement("span");
      coordinate.className = "cell-coordinate";
      coordinate.setAttribute("aria-hidden", "true");
      coordinate.textContent = String(index + 1).padStart(2, "0");
      element.append(coordinate);

      if (cell.surveyed && !cell.dug) {
        const shade = document.createElement("span");
        shade.className = "survey-shade";
        shade.setAttribute("aria-hidden", "true");
        element.append(shade);
      }

      if (cell.dug && cell.fragment) {
        element.insertAdjacentHTML("beforeend", FOSSIL_SVG);
      } else if (cell.dug) {
        const emptyMark = document.createElement("span");
        emptyMark.className = "empty-mark";
        emptyMark.setAttribute("aria-hidden", "true");
        element.append(emptyMark);
      } else if (cell.clue !== null) {
        const clue = document.createElement("span");
        clue.className = `clue-badge${cell.clueDigs === 1 ? " expiring" : ""}`;
        clue.setAttribute("aria-hidden", "true");
        clue.textContent = String(cell.clue);
        element.append(clue);
      }
    });
  }

  function updateDisplay() {
    digCountElement.textContent = String(digCharges);
    scanCountElement.textContent = String(scans);
    fragmentCountElement.textContent = String(recovered);
    fragmentTotalElement.textContent = String(FOSSIL_CELLS.length);
    progressElement.max = FOSSIL_CELLS.length;
    progressElement.value = recovered;
    progressElement.textContent = `${recovered} of ${FOSSIL_CELLS.length} fragments`;
    digModeButton.setAttribute("aria-pressed", String(mode === "dig"));
    surveyModeButton.setAttribute("aria-pressed", String(mode === "survey"));
    digModeButton.classList.toggle("active", mode === "dig");
    surveyModeButton.classList.toggle("active", mode === "survey");
    digModeButton.disabled = gameState !== "playing";
    surveyModeButton.disabled = gameState !== "playing" || scans === 0;
    modeDescription.textContent = mode === "dig"
      ? "Select untouched ground to spend one dig charge and check for a fossil fragment."
      : `Select a site to reveal its 3 × 3 fragment count for your next ${CLUE_DIGS} excavations.`;
    updateSelection();
    updateGrid();
  }

  function createGrid() {
    gridElement.replaceChildren();
    cells.forEach((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "soil-cell";
      button.setAttribute("role", "gridcell");
      button.addEventListener("focus", () => {
        selectedIndex = index;
        updateSelection();
        cells.forEach((entry, cellIndex) => {
          entry.element.setAttribute("aria-selected", String(cellIndex === selectedIndex));
        });
      });
      button.addEventListener("click", () => {
        selectedIndex = index;
        performAction(index);
      });
      cell.element = button;
      gridElement.append(button);
    });
  }

  function expireClues() {
    cells.forEach((cell) => {
      if (cell.clueDigs === null) return;
      cell.clueDigs -= 1;
      if (cell.clueDigs <= 0) {
        cell.clue = null;
        cell.clueDigs = null;
      }
    });
  }

  function survey(index) {
    if (scans <= 0) {
      setStatus("No survey scans remain. Choose an untouched cell to excavate.");
      return;
    }

    const centerRow = Math.floor(index / GRID_SIZE);
    const centerColumn = index % GRID_SIZE;
    const centerCell = cells[index];
    if (centerCell.scanUsed) {
      setStatus("This site has already been scanned. Select a different cell for a new survey.");
      return;
    }

    let nearbyFragments = 0;
    for (let row = Math.max(0, centerRow - 1); row <= Math.min(GRID_SIZE - 1, centerRow + 1); row += 1) {
      for (let column = Math.max(0, centerColumn - 1); column <= Math.min(GRID_SIZE - 1, centerColumn + 1); column += 1) {
        const nearbyCell = cells[toIndex(row, column)];
        nearbyCell.surveyed = true;
        if (nearbyCell.fragment && !nearbyCell.dug) nearbyFragments += 1;
      }
    }

    centerCell.scanUsed = true;
    centerCell.clue = nearbyFragments;
    centerCell.clueDigs = CLUE_DIGS;
    scans -= 1;
    setStatus(`Survey complete: ${nearbyFragments} fossil ${nearbyFragments === 1 ? "fragment lies" : "fragments lie"} in this 3 × 3 area. The clue lasts for your next ${CLUE_DIGS} excavations.`);
    updateDisplay();
  }

  function excavate(index) {
    const cell = cells[index];
    if (cell.dug) {
      setStatus("That plot has already been excavated. Select undisturbed ground.");
      return;
    }
    if (digCharges <= 0) {
      loseGame();
      return;
    }

    cell.dug = true;
    digCharges -= 1;
    if (cell.fragment) {
      recovered += 1;
      setStatus(`Fossil fragment recovered. ${FOSSIL_CELLS.length - recovered} ${FOSSIL_CELLS.length - recovered === 1 ? "fragment remains" : "fragments remain"}.`);
    } else {
      setStatus("Only compacted soil here. One dig charge used; choose your next plot carefully.");
    }

    expireClues();
    if (recovered === FOSSIL_CELLS.length) {
      gameState = "won";
      setStatus("Complete specimen recovered! The excavation is a success.");
      updateDisplay();
    } else if (digCharges === 0) {
      loseGame();
    } else {
      updateDisplay();
      if (cell.element.disabled) {
        const nextAvailable = cells.find((candidate) => !candidate.dug);
        if (nextAvailable) nextAvailable.element.focus();
      }
    }
  }

  function loseGame() {
    gameState = "lost";
    setStatus("The dig charges are depleted before the specimen was complete. Expedition over; restart to try again.");
    updateDisplay();
  }

  function performAction(index) {
    if (gameState !== "playing") return;
    selectedIndex = index;
    if (mode === "survey") survey(index);
    else excavate(index);
  }

  function setMode(nextMode) {
    if (gameState !== "playing") return;
    if (nextMode === "survey" && scans === 0) {
      setStatus("No survey scans remain. Choose an untouched cell to excavate.");
      return;
    }
    mode = nextMode;
    updateDisplay();
    setStatus(mode === "dig" ? "Excavation mode selected. Choose an undisturbed plot." : "Survey mode selected. Choose a new site to scan.");
  }

  function moveSelection(key) {
    const row = Math.floor(selectedIndex / GRID_SIZE);
    const column = selectedIndex % GRID_SIZE;
    const nextRow = key === "ArrowUp" ? Math.max(0, row - 1) : key === "ArrowDown" ? Math.min(GRID_SIZE - 1, row + 1) : row;
    const nextColumn = key === "ArrowLeft" ? Math.max(0, column - 1) : key === "ArrowRight" ? Math.min(GRID_SIZE - 1, column + 1) : column;
    selectedIndex = toIndex(nextRow, nextColumn);
    cells[selectedIndex].element.focus();
  }

  function handleGridKeydown(event) {
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      moveSelection(event.key);
      return;
    }
    if (event.key === "1") {
      event.preventDefault();
      setMode("dig");
      return;
    }
    if (event.key === "2") {
      event.preventDefault();
      setMode("survey");
      return;
    }
  }

  function restartGame() {
    const fossilPositions = new Set(FOSSIL_CELLS.map(([row, column]) => toIndex(row, column)));
    cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
      fragment: fossilPositions.has(index),
      dug: false,
      surveyed: false,
      scanUsed: false,
      clue: null,
      clueDigs: null,
      element: null
    }));
    selectedIndex = 0;
    mode = "dig";
    digCharges = TOTAL_DIG_CHARGES;
    scans = TOTAL_SCANS;
    recovered = 0;
    gameState = "playing";
    createGrid();
    setStatus("Expedition restarted. Survey carefully, then excavate the buried specimen.");
    updateDisplay();
  }

  gridElement.addEventListener("keydown", handleGridKeydown);
  digModeButton.addEventListener("click", () => setMode("dig"));
  surveyModeButton.addEventListener("click", () => setMode("survey"));
  restartButton.addEventListener("click", restartGame);
  restartGame();
})();
