"use strict";

(() => {
  const BOARD_SIZE = 8;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  const BARRIER_START = 10;
  const CURE_START = 8;
  const INFECTION_LIMIT = 18;
  const MAX_NEW_INFECTIONS_PER_TURN = 2;
  const TURNS_TO_CONTAIN = 3;
  const DIRECTIONS = [-BOARD_SIZE, 1, BOARD_SIZE, -1];
  const INITIAL_INFECTIONS = [27, 36];

  const boardElement = document.querySelector("#board");
  const turnElement = document.querySelector("#turn-count");
  const infectedElement = document.querySelector("#infected-count");
  const infectionLimitElement = document.querySelector("#infection-limit");
  const infectionProgress = document.querySelector("#infection-progress");
  const barriersElement = document.querySelector("#barriers-count");
  const curesElement = document.querySelector("#cures-count");
  const statusElement = document.querySelector("#game-status");
  const barrierButton = document.querySelector("#barrier-action");
  const cureButton = document.querySelector("#cure-action");
  const endTurnButton = document.querySelector("#end-turn");
  const restartButton = document.querySelector("#restart-button");

  let cells = [];
  let cellButtons = [];
  let turn = 1;
  let barriersRemaining = BARRIER_START;
  let curesRemaining = CURE_START;
  let containedTurns = 0;
  let selectedAction = null;
  let gameState = "playing";

  function isInsideBoard(index, direction) {
    const row = Math.floor(index / BOARD_SIZE);
    const column = index % BOARD_SIZE;

    if (direction === -BOARD_SIZE) return row > 0;
    if (direction === BOARD_SIZE) return row < BOARD_SIZE - 1;
    if (direction === 1) return column < BOARD_SIZE - 1;
    return column > 0;
  }

  function countInfected() {
    return cells.filter((cell) => cell === "infected").length;
  }

  function setStatus(message) {
    statusElement.textContent = message;
  }

  function updateBoard() {
    cellButtons.forEach((button, index) => {
      const state = cells[index];
      const row = Math.floor(index / BOARD_SIZE) + 1;
      const column = (index % BOARD_SIZE) + 1;
      const stateLabels = {
        healthy: "healthy",
        infected: "infected",
        barrier: "barrier",
        cured: "cured and protected"
      };

      button.className = `cell cell-${state}`;
      button.textContent = state === "healthy" ? "" : state === "infected" ? "I" : state === "barrier" ? "B" : "C";
      button.setAttribute("aria-label", `Row ${row}, column ${column}: ${stateLabels[state]}`);
      button.disabled = gameState !== "playing";
    });
  }

  function updateControls() {
    const active = gameState === "playing";
    barrierButton.disabled = !active || barriersRemaining === 0;
    cureButton.disabled = !active || curesRemaining === 0;
    endTurnButton.disabled = !active;
    barrierButton.setAttribute("aria-pressed", String(selectedAction === "barrier"));
    cureButton.setAttribute("aria-pressed", String(selectedAction === "cure"));
  }

  function updateDisplay() {
    const infected = countInfected();
    turnElement.textContent = String(turn);
    infectedElement.textContent = String(infected);
    infectionLimitElement.textContent = String(INFECTION_LIMIT);
    infectionProgress.max = INFECTION_LIMIT;
    infectionProgress.value = infected;
    infectionProgress.textContent = `${infected} of ${INFECTION_LIMIT}`;
    barriersElement.textContent = String(barriersRemaining);
    curesElement.textContent = String(curesRemaining);
    updateBoard();
    updateControls();
  }

  function clearActionSelection() {
    selectedAction = null;
    updateControls();
  }

  function selectAction(action) {
    if (gameState !== "playing") return;
    selectedAction = selectedAction === action ? null : action;
    updateControls();
    if (selectedAction) {
      const target = selectedAction === "barrier" ? "healthy" : "infected";
      setStatus(`Select an ${target} cell for your ${selectedAction === "barrier" ? "barrier" : "cure unit"}.`);
    } else {
      setStatus("Action cancelled. Choose an action or end the turn to spread infection.");
    }
  }

  function handleCellClick(index) {
    if (gameState !== "playing") return;
    if (!selectedAction) {
      setStatus("Choose Place barrier or Use cure unit before selecting a cell.");
      return;
    }

    if (selectedAction === "barrier") {
      if (cells[index] !== "healthy") {
        setStatus("A barrier can only be placed on a healthy cell.");
        return;
      }
      if (barriersRemaining === 0) {
        setStatus("No barriers remain. Choose another action or end the turn.");
        clearActionSelection();
        return;
      }
      cells[index] = "barrier";
      barriersRemaining -= 1;
      if (barriersRemaining === 0) clearActionSelection();
      setStatus("Barrier placed. Select another cell or end the turn to spread infection.");
      updateDisplay();
      return;
    }

    if (cells[index] !== "infected") {
      setStatus("A cure unit can only target an infected cell.");
      return;
    }
    if (curesRemaining === 0) {
      setStatus("No cure units remain. Choose another action or end the turn.");
      clearActionSelection();
      return;
    }
    cells[index] = "cured";
    curesRemaining -= 1;
    if (countInfected() === 0) {
      gameState = "won";
      clearActionSelection();
      setStatus("All infections are cleared. The outbreak is contained.");
      updateDisplay();
      return;
    }
    if (curesRemaining === 0) clearActionSelection();
    setStatus("Cure unit deployed. Select another infected cell or end the turn to spread infection.");
    updateDisplay();
  }

  function spreadInfection() {
    const infectedAtTurnStart = cells
      .map((state, index) => state === "infected" ? index : -1)
      .filter((index) => index >= 0);
    const newInfections = new Set();

    for (const source of infectedAtTurnStart) {
      if (newInfections.size >= MAX_NEW_INFECTIONS_PER_TURN) break;

      for (const direction of DIRECTIONS) {
        if (!isInsideBoard(source, direction)) continue;
        const target = source + direction;
        if (cells[target] !== "healthy" || newInfections.has(target)) continue;
        newInfections.add(target);
        break;
      }
    }

    newInfections.forEach((index) => {
      cells[index] = "infected";
    });
    return newInfections.size;
  }

  function finishTurn(actionMessage) {
    clearActionSelection();
    const spreadCount = spreadInfection();
    const infected = countInfected();
    turn += 1;

    if (infected >= INFECTION_LIMIT) {
      gameState = "lost";
      setStatus(`The outbreak reached ${INFECTION_LIMIT} infected cells. The zone is overwhelmed.`);
    } else if (infected === 0) {
      gameState = "won";
      setStatus("All infections are cleared. The outbreak is contained.");
    } else if (spreadCount === 0) {
      containedTurns += 1;
      if (containedTurns >= TURNS_TO_CONTAIN) {
        gameState = "won";
        setStatus(`No new infections for ${TURNS_TO_CONTAIN} turns. The outbreak is contained.`);
      } else {
        const remaining = TURNS_TO_CONTAIN - containedTurns;
        setStatus(`${actionMessage} No spread this turn. Hold the line for ${remaining} more ${remaining === 1 ? "turn" : "turns"} to contain the outbreak.`);
      }
    } else {
      containedTurns = 0;
      setStatus(`${actionMessage} ${spreadCount} new ${spreadCount === 1 ? "cell was" : "cells were"} infected. Keep the outbreak below ${INFECTION_LIMIT}.`);
    }

    updateDisplay();
  }

  function resetGame() {
    cells = Array(CELL_COUNT).fill("healthy");
    INITIAL_INFECTIONS.forEach((index) => {
      cells[index] = "infected";
    });
    cellButtons.forEach((button) => {
      button.className = "cell cell-healthy";
      button.textContent = "";
      button.disabled = false;
    });
    turn = 1;
    barriersRemaining = BARRIER_START;
    curesRemaining = CURE_START;
    containedTurns = 0;
    selectedAction = null;
    gameState = "playing";
    setStatus("Choose an action, then select a cell. The outbreak spreads after each turn.");
    updateDisplay();
  }

  function createBoard() {
    cellButtons = Array.from({ length: CELL_COUNT }, (_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell cell-healthy";
      button.addEventListener("click", () => handleCellClick(index));
      boardElement.append(button);
      return button;
    });
  }

  barrierButton.addEventListener("click", () => selectAction("barrier"));
  cureButton.addEventListener("click", () => selectAction("cure"));
  endTurnButton.addEventListener("click", () => {
    if (gameState === "playing") finishTurn("Turn ended.");
  });
  restartButton.addEventListener("click", resetGame);

  createBoard();
  resetGame();
})();
