/**
 * Tactical Fleet Commander
 * Pure Vanilla JavaScript turn-based naval battle radar simulation
 */

(() => {
  const radarGridEl = document.getElementById("radar-grid");
  const shipsLeftDisplay = document.getElementById("ships-left-display");
  const baseHpDisplay = document.getElementById("base-hp-display");
  const turnsDisplay = document.getElementById("turns-display");
  const sonarScanBtn = document.getElementById("sonar-scan-btn");
  const sonarChargesEl = document.getElementById("sonar-charges");
  const statusIntelEl = document.getElementById("status-intel");
  const battleLogEl = document.getElementById("battle-log");

  const resultModal = document.getElementById("result-modal");
  const resultTitle = document.getElementById("result-title");
  const resultIcon = document.getElementById("result-icon");
  const resultMessage = document.getElementById("result-message");
  const finalTurnsEl = document.getElementById("final-turns");
  const finalHpEl = document.getElementById("final-hp");
  const closeResultBtn = document.getElementById("close-result-btn");
  const modalRestartBtn = document.getElementById("modal-restart-btn");

  const rulesBtn = document.getElementById("rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  const GRID_SIZE = 7;
  const FLEET_SPECS = [
    { name: "Carrier", size: 4 },
    { name: "Battleship", size: 3 },
    { name: "Cruiser", size: 2 },
    { name: "Submarine", size: 2 }
  ];

  let ships = [];
  let board = [];
  let baseHp = 100;
  let turns = 0;
  let sonarCharges = 1;
  let isSonarActive = false;
  let isGameOver = false;
  let sectorLevel = 1;
  const levelDisplay = document.getElementById('level-display');

  function logEntry(text, type = "system") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = text;
    battleLogEl.prepend(entry);
  }

  function initBoard() {
    radarGridEl.innerHTML = "";
    board = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      board[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = {
          r,
          c,
          hasShip: null,
          isTargeted: false,
          element: null
        };

        const cellEl = document.createElement("div");
        cellEl.className = "radar-cell";
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;
        cellEl.setAttribute("role", "button");
        cellEl.setAttribute("tabindex", "0");
        cellEl.setAttribute("aria-label", `Sector row ${r + 1}, column ${c + 1}`);

        cellEl.addEventListener("click", () => handleCellClick(r, c));
        cellEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCellClick(r, c);
          }
        });
        radarGridEl.appendChild(cellEl);

        cell.element = cellEl;
        board[r][c] = cell;
      }
    }
  }

  function placeShips() {
    ships = [];

    FLEET_SPECS.forEach(spec => {
      let placed = false;
      let attempts = 0;

      const MAX_SEARCH_STEPS = 1200;
      while (!placed && attempts < MAX_SEARCH_STEPS) {
        attempts++;
        const isHorizontal = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (isHorizontal ? GRID_SIZE : GRID_SIZE - spec.size + 1));
        const c = Math.floor(Math.random() * (isHorizontal ? GRID_SIZE - spec.size + 1 : GRID_SIZE));

        // Check clear path
        let canPlace = true;
        for (let i = 0; i < spec.size; i++) {
          const checkR = isHorizontal ? r : r + i;
          const checkC = isHorizontal ? c + i : c;
          if (board[checkR][checkC].hasShip) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          const shipObj = {
            name: spec.name,
            size: spec.size,
            hits: 0,
            isSunk: false
          };

          for (let i = 0; i < spec.size; i++) {
            const shipR = isHorizontal ? r : r + i;
            const shipC = isHorizontal ? c + i : c;
            board[shipR][shipC].hasShip = shipObj;
          }

          ships.push(shipObj);
          placed = true;
        }
      }
    });
  }

  function updateHUD() {
    const alive = ships.filter(s => !s.isSunk).length;
    shipsLeftDisplay.textContent = `${alive} / ${ships.length}`;
    baseHpDisplay.textContent = `${Math.max(0, baseHp)}%`;
    turnsDisplay.textContent = turns;
    sonarChargesEl.textContent = sonarCharges;

    if (baseHp < 40) baseHpDisplay.style.color = "#ef4444";
    else if (baseHp < 70) baseHpDisplay.style.color = "#f59e0b";
    else baseHpDisplay.style.color = "#00f0ff";
  }

  function handleCellClick(r, c) {
    if (isGameOver) return;

    if (isSonarActive) {
      triggerSonarScan(r, c);
      return;
    }

    const cell = board[r][c];
    if (cell.isTargeted) return;

    cell.isTargeted = true;
    cell.element.classList.add("targeted");
    turns++;

    if (cell.hasShip) {
      const ship = cell.hasShip;
      ship.hits++;
      cell.element.classList.add("hit");
      cell.element.innerHTML = '<svg class="cell-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="3" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="21" y2="12"/></svg>';
      logEntry(`Strike on sector (${r + 1},${c + 1}): DIRECT HIT!`, "hit");

      if (ship.hits === ship.size) {
        ship.isSunk = true;
        logEntry(`Enemy ${ship.name} has been SUNK!`, "hit");
        statusIntelEl.textContent = `${ship.name} destroyed!`;
      } else {
        statusIntelEl.textContent = "Direct hit recorded!";
      }
    } else {
      cell.element.classList.add("miss");
      cell.element.innerHTML = '<svg class="cell-icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';
      logEntry(`Strike on sector (${r + 1},${c + 1}): Water splash.`, "miss");
      statusIntelEl.textContent = "Coordinates clear.";
    }

    // Check Victory
    const allSunk = ships.every(s => s.isSunk);
    if (allSunk) {
      updateHUD();
      gameOver(true);
      return;
    }

    // Enemy Retaliation Strike
    const retaliationDamage = Math.floor(Math.random() * 6) + 10;
    baseHp -= retaliationDamage;
    logEntry(`Enemy coastal missile counter-attack: -${retaliationDamage}% Shield!`, "miss");

    updateHUD();

    if (baseHp <= 0) {
      gameOver(false);
    }
  }

  function triggerSonarScan(centerR, centerC) {
    if (sonarCharges <= 0) return;
    sonarCharges--;
    isSonarActive = false;
    sonarScanBtn.classList.remove("active");

    let pings = 0;
    for (let dr = 0; dr <= 1; dr++) {
      for (let dc = 0; dc <= 1; dc++) {
        const sr = centerR + dr;
        const sc = centerC + dc;
        if (sr < GRID_SIZE && sc < GRID_SIZE) {
          const cell = board[sr][sc];
          cell.element.classList.add("sonar-ping");
          setTimeout(() => cell.element.classList.remove("sonar-ping"), 1400);
          if (cell.hasShip && !cell.isTargeted) pings++;
        }
      }
    }

    statusIntelEl.textContent = `Sonar Ping: ${pings} vessel contact(s) detected.`;
    logEntry(`Sonar Sweep at (${centerR + 1},${centerC + 1}): ${pings} contacts.`, "system");
    updateHUD();
  }

  function gameOver(won) {
    isGameOver = true;

    resultTitle.textContent = won ? "Theater Secured!" : "Base Overwhelmed!";
    resultIcon.innerHTML = won
      ? `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--color-radar)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--color-hit)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    resultMessage.textContent = won
      ? `All 4 enemy warships neutralized in ${turns} tactical turns!`
      : "Coastal defenses collapsed under relentless counter-bombardment.";
    finalTurnsEl.textContent = turns;
    finalHpEl.textContent = `${Math.max(0, baseHp)}%`;

    setTimeout(() => {
      resultModal.classList.add("active");
    }, 700);
  }

  function initGame() {
    baseHp = 100;
    turns = 0;
    sonarCharges = 1;
    isSonarActive = false;
    isGameOver = false;

    battleLogEl.innerHTML = "";
    logEntry("Radar operational. Select sector to engage.", "system");
    statusIntelEl.textContent = "Awaiting coordinates...";
    resultModal.classList.remove("active");

    initBoard();
    placeShips();
    updateHUD();
  }

  // Global Keyboard Controls
  window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "Enter") && isGameOver) {
      e.preventDefault();
      initGame();
      return;
    }
    if (e.code === "Escape") {
      if (rulesModal && rulesModal.classList.contains("active")) {
        rulesModal.classList.remove("active");
      }
      if (resultModal && resultModal.classList.contains("active")) {
        resultModal.classList.remove("active");
      }
      return;
    }
    if ((e.code === "KeyS" || e.code === "Digit1") && !isGameOver) {
      if (sonarCharges > 0) {
        isSonarActive = !isSonarActive;
        sonarScanBtn.classList.toggle("active", isSonarActive);
        statusIntelEl.textContent = isSonarActive ? "Click 2x2 sector to scan" : "Awaiting coordinates...";
      }
    }
  });

  sonarScanBtn.addEventListener("click", () => {
    if (sonarCharges > 0 && !isGameOver) {
      isSonarActive = !isSonarActive;
      sonarScanBtn.classList.toggle("active", isSonarActive);
      statusIntelEl.textContent = isSonarActive ? "Click 2x2 sector to scan" : "Awaiting coordinates...";
    }
  });

  modalRestartBtn.addEventListener("click", initGame);
  closeResultBtn.addEventListener("click", () => resultModal.classList.remove("active"));

  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("active");
  });

  initGame();
})();
