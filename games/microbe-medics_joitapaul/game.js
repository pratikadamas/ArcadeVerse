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

  // ========================================================
  // OBJECT POOLING & HIGH-STAGE PERFORMANCE STABILITY (#733)
  // Pre-allocated object pools for pathogen microbes and antibiotic particles.
  // Enforces maxMicrobes = 160 ceiling to prevent GC stalls and frame drops on Stage 5.
  // ========================================================
  const maxMicrobes = 160;
  const MAX_MICROBES = maxMicrobes;
  const MAX_ANTIBIOTIC_PARTICLES = 300;

  // Pre-allocated Pathogen Microbe Pool
  const pathogenPool = {
    pool: new Array(maxMicrobes),
    init() {
      for (let i = 0; i < maxMicrobes; i++) {
        this.pool[i] = {
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          radius: 4,
          baseRadius: 4,
          pulse: 0,
          pulseSpeed: 2.5,
          color: "#ff7b78",
          glowColor: "rgba(255, 123, 120, 0.4)",
          cellIndex: -1,
          life: 0,
          maxLife: 14.0,
          fadeRate: 0.08,
          alpha: 1.0,
          divisionTimer: 0,
          divisionInterval: 3.0
        };
      }
    },
    obtain() {
      // 1. Search for existing inactive slot
      for (let i = 0; i < maxMicrobes; i++) {
        if (!this.pool[i].active) {
          this.pool[i].active = true;
          return this.pool[i];
        }
      }
      // 2. Pool saturated: Recycle the oldest bacteria instance in-place (zero heap allocation)
      let oldest = this.pool[0];
      for (let i = 1; i < maxMicrobes; i++) {
        if (this.pool[i].life > oldest.life) {
          oldest = this.pool[i];
        }
      }
      this.recycle(oldest);
      oldest.active = true;
      return oldest;
    },
    recycle(microbe) {
      microbe.active = false;
      microbe.alpha = 0;
      microbe.life = 0;
      microbe.divisionTimer = 0;
    },
    reset() {
      for (let i = 0; i < maxMicrobes; i++) {
        this.pool[i].active = false;
        this.pool[i].alpha = 0;
        this.pool[i].life = 0;
        this.pool[i].divisionTimer = 0;
      }
    }
  };
  pathogenPool.init();

  // Pre-allocated Antibiotic Spray Particle Pool
  const antibioticPool = {
    pool: new Array(MAX_ANTIBIOTIC_PARTICLES),
    init() {
      for (let i = 0; i < MAX_ANTIBIOTIC_PARTICLES; i++) {
        this.pool[i] = {
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          size: 2.5,
          alpha: 1.0,
          fadeRate: 1.5,
          life: 0,
          maxLife: 0.8,
          color: "#6ee7c1",
          glowColor: "rgba(110, 231, 193, 0.6)"
        };
      }
    },
    obtain() {
      for (let i = 0; i < MAX_ANTIBIOTIC_PARTICLES; i++) {
        if (!this.pool[i].active) {
          this.pool[i].active = true;
          return this.pool[i];
        }
      }
      let oldest = this.pool[0];
      for (let i = 1; i < MAX_ANTIBIOTIC_PARTICLES; i++) {
        if (this.pool[i].life > oldest.life) {
          oldest = this.pool[i];
        }
      }
      this.recycle(oldest);
      oldest.active = true;
      return oldest;
    },
    recycle(particle) {
      particle.active = false;
      particle.alpha = 0;
      particle.life = 0;
    },
    reset() {
      for (let i = 0; i < MAX_ANTIBIOTIC_PARTICLES; i++) {
        this.pool[i].active = false;
        this.pool[i].alpha = 0;
        this.pool[i].life = 0;
      }
    }
  };
  antibioticPool.init();

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
  let currentStage = 1;
  let barriersRemaining = BARRIER_START;
  let curesRemaining = CURE_START;
  let containedTurns = 0;
  let selectedAction = null;
  let gameState = "playing";

  let petriCanvas = null;
  let petriContext = null;
  let lastFrameTime = performance.now();
  let animationFrameId = null;

  function initPetriCanvas() {
    const wrap = document.querySelector(".board-wrap");
    if (!wrap) return;

    wrap.style.position = "relative";
    petriCanvas = document.querySelector("#petri-canvas");
    if (!petriCanvas) {
      petriCanvas = document.createElement("canvas");
      petriCanvas.id = "petri-canvas";
      petriCanvas.setAttribute("aria-hidden", "true");
      petriCanvas.style.position = "absolute";
      petriCanvas.style.top = "0";
      petriCanvas.style.left = "0";
      petriCanvas.style.width = "100%";
      petriCanvas.style.height = "100%";
      petriCanvas.style.pointerEvents = "none";
      petriCanvas.style.borderRadius = "14px";
      petriCanvas.style.zIndex = "2";
      wrap.appendChild(petriCanvas);
    }
    petriContext = petriCanvas.getContext("2d");
    resizePetriCanvas();
    window.addEventListener("resize", resizePetriCanvas);
  }

  function resizePetriCanvas() {
    if (!petriCanvas) return;
    const wrap = petriCanvas.parentElement;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round((rect.width || 560) * dpr);
      const h = Math.round((rect.height || 560) * dpr);
      if (petriCanvas.width !== w || petriCanvas.height !== h) {
        petriCanvas.width = w;
        petriCanvas.height = h;
      }
    }
  }

  function getCellCenter(index) {
    if (cellButtons[index] && petriCanvas) {
      const btn = cellButtons[index];
      const wrap = petriCanvas.parentElement;
      if (wrap) {
        const wrapRect = wrap.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        if (wrapRect.width > 0 && wrapRect.height > 0) {
          return {
            x: (btnRect.left - wrapRect.left + btnRect.width / 2) * (petriCanvas.width / wrapRect.width),
            y: (btnRect.top - wrapRect.top + btnRect.height / 2) * (petriCanvas.height / wrapRect.height)
          };
        }
      }
    }
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const w = petriCanvas ? petriCanvas.width : 560;
    const h = petriCanvas ? petriCanvas.height : 560;
    const padding = 20;
    const cellW = (w - padding * 2) / BOARD_SIZE;
    const cellH = (h - padding * 2) / BOARD_SIZE;
    return {
      x: padding + (col + 0.5) * cellW,
      y: padding + (row + 0.5) * cellH
    };
  }

  function spawnPathogen(cellIndex) {
    const p = pathogenPool.obtain();
    const center = getCellCenter(cellIndex);
    p.cellIndex = cellIndex;
    p.x = center.x + (Math.random() - 0.5) * 26;
    p.y = center.y + (Math.random() - 0.5) * 26;
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 16 * (1 + currentStage * 0.25);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.baseRadius = 3.5 + Math.random() * 2.5;
    p.radius = p.baseRadius;
    p.pulse = Math.random() * Math.PI * 2;
    p.pulseSpeed = 2 + Math.random() * 2.5;
    p.alpha = 1.0;
    p.life = 0;
    p.maxLife = 14.0;
    p.fadeRate = 0.07;
    p.divisionTimer = 0;
    // Division rate accelerates significantly on Stage 5 (#733)
    p.divisionInterval = currentStage >= 5 ? 1.0 : Math.max(1.5, 4.0 - currentStage * 0.5);
    p.color = currentStage >= 5 ? "#ff4d6d" : "#ff7b78";
    p.glowColor = currentStage >= 5 ? "rgba(255, 77, 109, 0.65)" : "rgba(255, 123, 120, 0.4)";
    return p;
  }

  function spawnAntibioticBurst(cellIndex, count = 22) {
    const center = getCellCenter(cellIndex);
    for (let i = 0; i < count; i++) {
      const p = antibioticPool.obtain();
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 85;
      p.x = center.x + (Math.random() - 0.5) * 14;
      p.y = center.y + (Math.random() - 0.5) * 14;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 2 + Math.random() * 2.5;
      p.alpha = 1.0;
      p.maxLife = 0.6 + Math.random() * 0.35;
      p.fadeRate = 1.0 / p.maxLife;
      p.life = 0;
      p.color = "#5b91b6"; // Barrier blue
      p.glowColor = "rgba(91, 145, 182, 0.6)";
    }
  }

  function spawnCureSprayBurst(cellIndex, count = 32) {
    const center = getCellCenter(cellIndex);
    for (let i = 0; i < count; i++) {
      const p = antibioticPool.obtain();
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 95;
      p.x = center.x + (Math.random() - 0.5) * 10;
      p.y = center.y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 2.5 + Math.random() * 3.0;
      p.alpha = 1.0;
      p.maxLife = 0.75 + Math.random() * 0.45;
      p.fadeRate = 1.0 / p.maxLife;
      p.life = 0;
      p.color = "#6ee7c1"; // Cure emerald
      p.glowColor = "rgba(110, 231, 193, 0.7)";
    }
  }

  function destroyPathogensInCell(cellIndex) {
    for (let i = 0; i < maxMicrobes; i++) {
      const m = pathogenPool.pool[i];
      if (m.active && m.cellIndex === cellIndex) {
        pathogenPool.recycle(m);
        spawnDestructionSparkles(m.x, m.y);
      }
    }
  }

  function spawnDestructionSparkles(x, y) {
    for (let i = 0; i < 4; i++) {
      const p = antibioticPool.obtain();
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 45;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 2;
      p.alpha = 1.0;
      p.maxLife = 0.35;
      p.fadeRate = 1.0 / p.maxLife;
      p.life = 0;
      p.color = "#ffffff";
      p.glowColor = "rgba(255, 255, 255, 0.8)";
    }
  }

  function syncPathogensWithInfections() {
    pathogenPool.reset();
    cells.forEach((state, index) => {
      if (state === "infected") {
        spawnPathogen(index);
        spawnPathogen(index);
      }
    });
  }

  function updateAndRenderPetriDish(deltaTime) {
    if (!petriContext || !petriCanvas) return;

    petriContext.clearRect(0, 0, petriCanvas.width, petriCanvas.height);

    // 1. Update and Render Pathogens (capped at maxMicrobes = 160)
    for (let i = 0; i < maxMicrobes; i++) {
      const m = pathogenPool.pool[i];
      if (!m.active) continue;

      m.life += deltaTime;
      m.pulse += m.pulseSpeed * deltaTime;
      m.x += m.vx * deltaTime;
      m.y += m.vy * deltaTime;

      // Organic Brownian drift
      m.vx += (Math.random() - 0.5) * 12 * deltaTime;
      m.vy += (Math.random() - 0.5) * 12 * deltaTime;

      // Soft bounce on dish boundaries
      if (m.x < 15 || m.x > petriCanvas.width - 15) m.vx = -m.vx;
      if (m.y < 15 || m.y > petriCanvas.height - 15) m.vy = -m.vy;

      // Stage 5 viral reproduction accelerator: triggers rapid cell division
      if (currentStage >= 5 && gameState === "playing") {
        m.divisionTimer += deltaTime;
        if (m.divisionTimer >= m.divisionInterval) {
          m.divisionTimer = 0;
          // Recycle/obtain child from pool without new heap allocations
          const child = pathogenPool.obtain();
          child.cellIndex = m.cellIndex;
          child.x = m.x + (Math.random() - 0.5) * 8;
          child.y = m.y + (Math.random() - 0.5) * 8;
          child.vx = -m.vx + (Math.random() - 0.5) * 12;
          child.vy = -m.vy + (Math.random() - 0.5) * 12;
          child.baseRadius = m.baseRadius;
          child.radius = m.baseRadius;
          child.pulse = Math.random() * Math.PI * 2;
          child.pulseSpeed = m.pulseSpeed;
          child.alpha = 1.0;
          child.life = 0;
          child.maxLife = m.maxLife;
          child.fadeRate = m.fadeRate;
          child.divisionTimer = 0;
          child.divisionInterval = m.divisionInterval;
          child.color = m.color;
          child.glowColor = m.glowColor;
        }
      }

      // Strict culling: deactivate dead, offscreen, or faded bacteria immediately
      const isOffscreen = m.x < -20 || m.x > petriCanvas.width + 20 || m.y < -20 || m.y > petriCanvas.height + 20;
      const isDead = m.life >= m.maxLife || (m.cellIndex >= 0 && cells[m.cellIndex] !== "infected" && Math.random() < 0.05);
      const isFaded = m.alpha <= 0.01;

      if (isOffscreen || isDead || isFaded) {
        pathogenPool.recycle(m);
        continue;
      }

      // Draw Pathogen Microbe
      petriContext.save();
      petriContext.globalAlpha = m.alpha;
      const r = m.baseRadius + Math.sin(m.pulse) * 1.1;

      petriContext.shadowColor = m.glowColor;
      petriContext.shadowBlur = 8;
      petriContext.fillStyle = m.color;
      petriContext.beginPath();
      petriContext.arc(m.x, m.y, r, 0, Math.PI * 2);
      petriContext.fill();

      // Inner organelle
      petriContext.fillStyle = "#ffffff";
      petriContext.beginPath();
      petriContext.arc(m.x - r * 0.25, m.y - r * 0.25, r * 0.35, 0, Math.PI * 2);
      petriContext.fill();

      // Bacterial pili
      petriContext.strokeStyle = m.color;
      petriContext.lineWidth = 1;
      for (let a = 0; a < 6; a++) {
        const angle = a * (Math.PI / 3) + m.pulse * 0.4;
        petriContext.beginPath();
        petriContext.moveTo(m.x + Math.cos(angle) * r, m.y + Math.sin(angle) * r);
        petriContext.lineTo(m.x + Math.cos(angle) * (r + 2.5), m.y + Math.sin(angle) * (r + 2.5));
        petriContext.stroke();
      }
      petriContext.restore();
    }

    // 2. Update and Render Antibiotic Spray Particles
    for (let i = 0; i < MAX_ANTIBIOTIC_PARTICLES; i++) {
      const p = antibioticPool.pool[i];
      if (!p.active) continue;

      p.life += deltaTime;
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.alpha = Math.max(0, p.alpha - p.fadeRate * deltaTime);

      // Strict culling: offscreen or faded
      const isOffscreen = p.x < -15 || p.x > petriCanvas.width + 15 || p.y < -15 || p.y > petriCanvas.height + 15;
      if (p.alpha <= 0.01 || p.life >= p.maxLife || isOffscreen) {
        antibioticPool.recycle(p);
        continue;
      }

      // Draw Antibiotic Particle
      petriContext.save();
      petriContext.globalAlpha = p.alpha;
      petriContext.fillStyle = p.color;
      petriContext.shadowColor = p.glowColor;
      petriContext.shadowBlur = 6;
      petriContext.beginPath();
      petriContext.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      petriContext.fill();
      petriContext.restore();
    }
  }

  function startAnimationLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    lastFrameTime = performance.now();

    function loop(now) {
      const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;

      updateAndRenderPetriDish(deltaTime);

      animationFrameId = requestAnimationFrame(loop);
    }
    animationFrameId = requestAnimationFrame(loop);
  }

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

  function dispatchScore(won) {
    const infected = countInfected();
    const finalScore = won
      ? Math.max(100, 2500 - turn * 80 + curesRemaining * 100 + barriersRemaining * 50)
      : Math.max(0, turn * 60 - infected * 20);
    try {
      if (window.ArcadeVerse && typeof window.ArcadeVerse.postScore === "function") {
        window.ArcadeVerse.postScore(finalScore);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_SCORE",
          score: finalScore,
          details: { won, turn, infected, currentStage }
        }, "*");
      }
    } catch (_) {}
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
      spawnAntibioticBurst(index, 24);
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
    spawnCureSprayBurst(index, 32);
    destroyPathogensInCell(index);

    if (countInfected() === 0) {
      gameState = "won";
      clearActionSelection();
      setStatus("All infections are cleared. The outbreak is contained.");
      dispatchScore(true);
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
      spawnPathogen(index);
      spawnPathogen(index);
    });
    return newInfections.size;
  }

  function finishTurn(actionMessage) {
    clearActionSelection();
    const spreadCount = spreadInfection();
    const infected = countInfected();
    turn += 1;
    currentStage = Math.min(5, Math.floor((turn - 1) / 3) + 1);

    if (infected >= INFECTION_LIMIT) {
      gameState = "lost";
      setStatus(`The outbreak reached ${INFECTION_LIMIT} infected cells. The zone is overwhelmed.`);
      dispatchScore(false);
    } else if (infected === 0) {
      gameState = "won";
      setStatus("All infections are cleared. The outbreak is contained.");
      dispatchScore(true);
    } else if (spreadCount === 0) {
      containedTurns += 1;
      if (containedTurns >= TURNS_TO_CONTAIN) {
        gameState = "won";
        setStatus(`No new infections for ${TURNS_TO_CONTAIN} turns. The outbreak is contained.`);
        dispatchScore(true);
      } else {
        const remaining = TURNS_TO_CONTAIN - containedTurns;
        const stageLabel = currentStage >= 5 ? " [Stage 5: High-speed bloom]" : ` [Stage ${currentStage}]`;
        setStatus(`${actionMessage} No spread this turn.${stageLabel} Hold the line for ${remaining} more ${remaining === 1 ? "turn" : "turns"} to contain the outbreak.`);
      }
    } else {
      containedTurns = 0;
      const stageLabel = currentStage >= 5 ? " [Stage 5: High-speed bloom]" : ` [Stage ${currentStage}]`;
      setStatus(`${actionMessage} ${spreadCount} new ${spreadCount === 1 ? "cell was" : "cells were"} infected.${stageLabel} Keep the outbreak below ${INFECTION_LIMIT}.`);
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
    currentStage = 1;
    barriersRemaining = BARRIER_START;
    curesRemaining = CURE_START;
    containedTurns = 0;
    selectedAction = null;
    gameState = "playing";
    setStatus("Choose an action, then select a cell. The outbreak spreads after each turn.");
    syncPathogensWithInfections();
    antibioticPool.reset();
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
    initPetriCanvas();
  }

  barrierButton.addEventListener("click", () => selectAction("barrier"));
  cureButton.addEventListener("click", () => selectAction("cure"));
  endTurnButton.addEventListener("click", () => {
    if (gameState === "playing") finishTurn("Turn ended.");
  });
  restartButton.addEventListener("click", resetGame);

  createBoard();
  resetGame();
  startAnimationLoop();

  // Expose global interface for automated performance testing and stage control
  window.MicrobeMedics = {
    maxMicrobes: maxMicrobes,
    getStage: () => currentStage,
    setStage: (s) => {
      currentStage = Math.max(1, Math.min(5, Number(s) || 1));
      pathogenPool.pool.forEach((m) => {
        if (m.active) m.divisionInterval = currentStage >= 5 ? 1.0 : Math.max(1.5, 4.0 - currentStage * 0.5);
      });
      return currentStage;
    },
    getActiveMicrobeCount: () => pathogenPool.pool.filter((m) => m.active).length,
    getActiveParticleCount: () => antibioticPool.pool.filter((p) => p.active).length,
    pathogenPool,
    antibioticPool,
    spawnAntibioticBurst,
    spawnCureSprayBurst
  };
})();
