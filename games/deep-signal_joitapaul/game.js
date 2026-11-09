"use strict";

(() => {
  const MAP_ROWS = [
    "###############",
    "#S....#....B..#",
    "#.##..#.......#",
    "#....H.....##.#",
    "###.#...#.....#",
    "#...#..B#..H..#",
    "#.H.#...#.....#",
    "#....##.......#",
    "#B......##....#",
    "#..H..........#",
    "###############"
  ];
  const SONAR_SUPPLY = 5;
  const MAX_INTEGRITY = 4;
  const SONAR_RADIUS = 4;
  const SONAR_DURATION_MS = 2500;
  const WIDTH = MAP_ROWS[0].length;
  const HEIGHT = MAP_ROWS.length;
  const CELLS = MAP_ROWS.join("");
  const START_INDEX = CELLS.indexOf("S");
  const BEACON_TOTAL = [...CELLS].filter((cell) => cell === "B").length;
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  const mapElement = document.querySelector("#map");
  const statusElement = document.querySelector("#game-status");
  const sonarStateElement = document.querySelector("#sonar-state");
  const sonarButton = document.querySelector("#sonar-button");
  const restartButton = document.querySelector("#restart-button");
  const integrityCountElement = document.querySelector("#integrity-count");
  const integrityMeter = document.querySelector("#integrity-meter");
  const sonarCountElement = document.querySelector("#sonar-count");
  const beaconsCountElement = document.querySelector("#beacons-count");
  const beaconsTotalElement = document.querySelector("#beacons-total");
  const directionButtons = document.querySelectorAll("[data-direction]");

  let cellElements = [];
  let submarinePosition = START_INDEX;
  let integrity = MAX_INTEGRITY;
  let sonarPulses = SONAR_SUPPLY;
  let collectedBeacons = new Set();
  let surveyedCells = new Set();
  let activePulseCells = new Set();
  let pulseTimeout = null;
  let gameState = "playing";

  function getCoordinates(index) {
    return { x: index % WIDTH, y: Math.floor(index / WIDTH) };
  }

  function getCellDescription(index, revealed) {
    if (index === submarinePosition) return "Research submarine";
    if (!revealed) return "Uncharted water";
    if (collectedBeacons.has(index)) return "Reached rescue beacon";
    const terrain = CELLS[index];
    if (terrain === "#") return "Rock wall";
    if (terrain === "H") return "Hazard";
    if (terrain === "B") return "Rescue beacon";
    return "Open water";
  }

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function updateMap() {
    cellElements.forEach((element, index) => {
      const terrain = CELLS[index];
      const revealed = surveyedCells.has(index) || activePulseCells.has(index);
      const visible = index === submarinePosition || revealed;
      const coordinates = getCoordinates(index);
      const classes = ["map-cell"];

      if (!visible) {
        classes.push("unknown");
      } else if (index === submarinePosition) {
        classes.push("submarine");
      } else if (terrain === "#") {
        classes.push("wall");
      } else if (terrain === "H") {
        classes.push("hazard");
      } else if (terrain === "B" && !collectedBeacons.has(index)) {
        classes.push("beacon");
      } else if (collectedBeacons.has(index)) {
        classes.push("reached");
      } else {
        classes.push("water");
      }

      if (activePulseCells.has(index)) classes.push("sonar-lit");
      element.className = classes.join(" ");
      element.textContent = !visible ? "?" :
        index === submarinePosition ? "S" :
          terrain === "#" ? "#" :
            terrain === "H" ? "!" :
              terrain === "B" && !collectedBeacons.has(index) ? "B" :
                collectedBeacons.has(index) ? "+" : "";
      element.setAttribute("aria-label", `Row ${coordinates.y + 1}, column ${coordinates.x + 1}: ${getCellDescription(index, visible)}`);
    });
  }

  function updateControls() {
    const active = gameState === "playing";
    sonarButton.disabled = !active || sonarPulses === 0;
    directionButtons.forEach((button) => {
      button.disabled = !active;
    });
    integrityMeter.classList.toggle("low", integrity <= 1);
    sonarStateElement.classList.toggle("active", activePulseCells.size > 0);
    sonarStateElement.textContent = activePulseCells.size > 0 ? "Signal active" : "Sonar idle";
  }

  function updateDisplay() {
    integrityCountElement.textContent = String(integrity);
    integrityMeter.max = MAX_INTEGRITY;
    integrityMeter.value = integrity;
    integrityMeter.textContent = `${integrity} of ${MAX_INTEGRITY}`;
    sonarCountElement.textContent = String(sonarPulses);
    beaconsCountElement.textContent = String(collectedBeacons.size);
    beaconsTotalElement.textContent = String(BEACON_TOTAL);
    updateMap();
    updateControls();
  }

  function finishGame(won) {
    gameState = won ? "won" : "lost";
    activePulseCells.clear();
    if (pulseTimeout !== null) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
    setStatus(won
      ? "All rescue beacons reached. Subsea mission complete."
      : "Submarine integrity is gone. Mission failed. Restart to launch again.");
    updateDisplay();
  }

  function moveSubmarine(directionName) {
    if (gameState !== "playing") return;
    const direction = DIRECTIONS[directionName];
    if (!direction) return;

    const current = getCoordinates(submarinePosition);
    const nextX = current.x + direction.x;
    const nextY = current.y + direction.y;
    if (nextX < 0 || nextX >= WIDTH || nextY < 0 || nextY >= HEIGHT) return;

    const nextPosition = nextY * WIDTH + nextX;
    if (CELLS[nextPosition] === "#") {
      setStatus("Rock wall ahead. Send sonar to chart another route.");
      return;
    }

    submarinePosition = nextPosition;
    const terrain = CELLS[nextPosition];

    if (terrain === "H") {
      integrity -= 1;
      if (integrity <= 0) {
        finishGame(false);
        return;
      }
      setStatus(`Hazard impact. Submarine integrity is now ${integrity} of ${MAX_INTEGRITY}.`);
    } else if (terrain === "B" && !collectedBeacons.has(nextPosition)) {
      collectedBeacons.add(nextPosition);
      if (collectedBeacons.size === BEACON_TOTAL) {
        finishGame(true);
        return;
      }
      setStatus(`Rescue beacon reached. ${BEACON_TOTAL - collectedBeacons.size} more to go.`);
    } else {
      setStatus("Course updated. Send sonar to reveal nearby waters.");
    }

    updateDisplay();
  }

  function sendSonarPulse() {
    if (gameState !== "playing") return;
    if (sonarPulses <= 0) {
      setStatus("No sonar pulses remain. Navigate using your surveyed chart.");
      updateControls();
      return;
    }

    sonarPulses -= 1;
    activePulseCells.clear();
    const submarine = getCoordinates(submarinePosition);
    CELLS.split("").forEach((_, index) => {
      const coordinates = getCoordinates(index);
      const distance = Math.abs(coordinates.x - submarine.x) + Math.abs(coordinates.y - submarine.y);
      if (distance <= SONAR_RADIUS) {
        activePulseCells.add(index);
        surveyedCells.add(index);
      }
    });

    if (pulseTimeout !== null) clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => {
      activePulseCells.clear();
      pulseTimeout = null;
      updateDisplay();
    }, SONAR_DURATION_MS);

    setStatus(`Sonar pulse sent. Nearby terrain revealed for ${SONAR_DURATION_MS / 1000} seconds.`);
    updateDisplay();
  }

  function resetMission() {
    if (pulseTimeout !== null) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
    submarinePosition = START_INDEX;
    integrity = MAX_INTEGRITY;
    sonarPulses = SONAR_SUPPLY;
    collectedBeacons = new Set();
    surveyedCells = new Set();
    activePulseCells = new Set();
    gameState = "playing";
    setStatus("The water is dark. Send a sonar pulse to chart nearby terrain and rescue beacons.");
    updateDisplay();
  }

  function createMap() {
    cellElements = Array.from({ length: WIDTH * HEIGHT }, (_, index) => {
      const element = document.createElement("div");
      const coordinates = getCoordinates(index);
      element.className = "map-cell unknown";
      element.setAttribute("role", "gridcell");
      element.setAttribute("aria-label", `Row ${coordinates.y + 1}, column ${coordinates.x + 1}: Uncharted water`);
      mapElement.append(element);
      return element;
    });
  }

  directionButtons.forEach((button) => {
    button.addEventListener("click", () => moveSubmarine(button.dataset.direction));
  });
  sonarButton.addEventListener("click", sendSonarPulse);
  restartButton.addEventListener("click", resetMission);

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, a, [contenteditable='true']")) return;

    const key = event.key.toLowerCase();
    const directionByKey = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right"
    };

    if (directionByKey[key]) {
      event.preventDefault();
      if (!event.repeat) moveSubmarine(directionByKey[key]);
    } else if (key === " " || key === "spacebar") {
      if (target instanceof Element && target.closest("button")) return;
      event.preventDefault();
      if (!event.repeat) sendSonarPulse();
    }
  });

  createMap();
  resetMission();
})();
