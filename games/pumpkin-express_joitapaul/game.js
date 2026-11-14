(() => {
  "use strict";

  const canvas = document.getElementById("rail-canvas");
  const context = canvas.getContext("2d");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const startButton = document.getElementById("start-button");
  const moveCountElement = document.getElementById("move-count");
  const runStatusElement = document.getElementById("run-status");
  const feedback = document.getElementById("feedback");

  const columns = 7;
  const rows = 7;
  const cellSize = 80;
  const originX = 80;
  const originY = 40;
  const stepDuration = 0.78;
  const directions = {
    N: { dx: 0, dy: -1, opposite: "S" },
    E: { dx: 1, dy: 0, opposite: "W" },
    S: { dx: 0, dy: 1, opposite: "N" },
    W: { dx: -1, dy: 0, opposite: "E" }
  };
  const route = [
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
    { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 4 },
    { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 4 },
    { x: 6, y: 3 }
  ];
  const switchSpecs = [
    { x: 1, y: 2, incoming: "S", correct: "E", branch: "N", initial: 0 },
    { x: 3, y: 2, incoming: "W", correct: "N", branch: "E", initial: 1 },
    { x: 5, y: 2, incoming: "N", correct: "S", branch: "E", initial: 0 },
    { x: 4, y: 3, incoming: "E", correct: "S", branch: "N", initial: 0 },
    { x: 5, y: 5, incoming: "W", correct: "E", branch: "S", initial: 1 }
  ];
  const brokenCells = [
    { x: 1, y: 1 },
    { x: 4, y: 2 },
    { x: 6, y: 2 },
    { x: 4, y: 6 },
    { x: 5, y: 6 }
  ];
  const cells = new Map();
  const switches = switchSpecs.map((spec) => ({
    ...spec,
    orientation: spec.initial,
    connections: [spec.correct, spec.branch],
    required: [spec.incoming, spec.correct]
  }));
  const blocked = new Set(brokenCells.map((cell) => cellId(cell.x, cell.y)));
  const selection = { x: 1, y: 2 };
  const train = { x: route[0].x, y: route[0].y, from: null, progress: 0 };
  const switchQueue = [];
  const SWITCH_TURN_RADIUS = 38;

  let state = "ready";
  let moves = 0;
  let lastFrame = 0;
  let animationFrame = 0;
  let dispatchElapsed = 0;
  let statusTimer = 0;
  let ambientTime = 0;

  function cellId(x, y) {
    return `${x},${y}`;
  }

  function trackCell(x, y, connections, type = "rail") {
    cells.set(cellId(x, y), { x, y, connections, type });
  }

  function directionBetween(from, to) {
    if (to.x > from.x) return "E";
    if (to.x < from.x) return "W";
    if (to.y > from.y) return "S";
    return "N";
  }

  function buildTrack() {
    route.forEach((point, index) => {
      if (index === 0 || index === route.length - 1) return;
      const previous = route[index - 1];
      const next = route[index + 1];
      const connections = [
        directionBetween(point, previous),
        directionBetween(point, next)
      ];
      const switchPiece = switches.find((piece) => piece.x === point.x && piece.y === point.y);
      if (switchPiece) {
        switchPiece.required = connections;
        switchPiece.incoming = directionBetween(point, previous);
        switchPiece.correct = directionBetween(point, next);
        switchPiece.connections = [switchPiece.correct, switchPiece.branch];
        trackCell(point.x, point.y, [switchPiece.incoming, switchPiece.correct, switchPiece.branch], "switch");
      } else {
        trackCell(point.x, point.y, connections);
      }
    });

    const startDirection = directionBetween(route[0], route[1]);
    const stationDirection = directionBetween(route[route.length - 1], route[route.length - 2]);
    trackCell(route[0].x, route[0].y, [startDirection], "start");
    trackCell(route[route.length - 1].x, route[route.length - 1].y, [stationDirection], "station");
  }

  function centerOf(point) {
    return {
      x: originX + (point.x + 0.5) * cellSize,
      y: originY + (point.y + 0.5) * cellSize
    };
  }

  function currentConnections(piece) {
    if (piece.type !== "switch") return piece.connections;
    const switchPiece = switches.find((item) => item.x === piece.x && item.y === piece.y);
    if (switchPiece.orientation === 0) return [switchPiece.incoming, switchPiece.correct];
    return [switchPiece.incoming, switchPiece.branch];
  }

  function updateHud() {
    moveCountElement.textContent = String(moves);
    runStatusElement.textContent = ({
      ready: "Awaiting dispatch",
      running: "Train in motion",
      paused: "Run paused",
      won: "Station reached",
      derailed: "Train derailed"
    })[state];

    // Synchronize lantern SVG light colors with underlying track graph pointer (#734)
    const switchCardSvg = document.querySelector(".hud-card svg");
    if (switchCardSvg) {
      const misplacedCount = switches.filter((s) => s.orientation !== 0).length;
      if (switchQueue.length > 0) {
        switchCardSvg.style.stroke = "#f59e0b"; // Queued switch pending
      } else if (misplacedCount === 0) {
        switchCardSvg.style.stroke = "#22c55e"; // All switches aligned to station route
      } else {
        switchCardSvg.style.stroke = "#e48159"; // Misaligned branch warning
      }
    }

    const trainCardSvg = document.querySelector(".train-card svg");
    if (trainCardSvg) {
      if (state === "won") {
        trainCardSvg.style.stroke = "#22c55e";
      } else if (state === "derailed") {
        trainCardSvg.style.stroke = "#ef4444";
      } else if (state === "running") {
        trainCardSvg.style.stroke = "#e7a34e";
      } else {
        trainCardSvg.style.stroke = "var(--amber)";
      }
    }
  }

  function setFeedback(message, duration = 2400) {
    feedback.textContent = message;
    window.clearTimeout(statusTimer);
    if (duration > 0) {
      statusTimer = window.setTimeout(() => {
        if (state === "ready") {
          feedback.textContent = `${switches.filter((piece) => piece.orientation !== 0).length} switch${switches.filter((piece) => piece.orientation !== 0).length === 1 ? "" : "es"} need attention before dispatch.`;
        } else if (state === "running") {
          feedback.textContent = "Train in motion. Switch the rails before it reaches them.";
        }
      }, duration);
    }
  }

  function resetLevel() {
    window.cancelAnimationFrame(animationFrame);
    switchQueue.length = 0;
    switches.forEach((piece) => { piece.orientation = piece.initial; });
    selection.x = 1;
    selection.y = 2;
    train.x = route[0].x;
    train.y = route[0].y;
    train.from = null;
    train.progress = 0;
    moves = 0;
    dispatchElapsed = 0;
    lastFrame = 0;
    state = "ready";
    overlay.hidden = false;
    overlayTitle.textContent = "How to play";
    overlayMessage.textContent = "Two golden switches are misaligned. Dispatch the train, then switch each one to keep its incoming rail connected to the station route before the engine arrives.";
    startButton.textContent = "Dispatch train";
    setFeedback("Two switches need attention before dispatch.", 0);
    updateHud();
    drawBoard();
    canvas.focus({ preventScroll: true });
  }

  function startTrain() {
    if (state === "paused") {
      state = "running";
      overlay.hidden = true;
      lastFrame = 0;
      animationFrame = window.requestAnimationFrame(frame);
      updateHud();
      canvas.focus({ preventScroll: true });
      return;
    }
    state = "running";
    overlay.hidden = true;
    dispatchElapsed = 0;
    lastFrame = 0;
    switchQueue.length = 0;
    setFeedback("Train in motion. Switch the rails before it reaches them.");
    updateHud();
    canvas.focus({ preventScroll: true });
    animationFrame = window.requestAnimationFrame(frame);
  }

  function showInstructions() {
    const wasRunning = state === "running";
    if (wasRunning) {
      state = "paused";
      window.cancelAnimationFrame(animationFrame);
      updateHud();
    }
    overlayTitle.textContent = "How to play";
    overlayMessage.textContent = "Follow the connected rails from the engine to the station. Set each golden switch so the incoming rail stays connected to the route. Broken sections end the run.";
    startButton.textContent = state === "paused" ? "Resume train" : state === "won" || state === "derailed" ? "Retry level" : "Dispatch train";
    overlay.hidden = false;
  }

  function finishRun(won, message) {
    state = won ? "won" : "derailed";
    window.cancelAnimationFrame(animationFrame);
    switchQueue.length = 0;
    overlayTitle.textContent = won ? "Station reached" : "Train derailed";
    overlayMessage.textContent = message;
    startButton.textContent = "Retry level";
    overlay.hidden = false;
    setFeedback(won ? "The pumpkin express made it safely to the station." : message, 0);

    // Platform Bridge: Dispatch score to ArcadeVerse host upon victory (#734)
    if (won) {
      const finalScore = Math.max(100, 2000 - moves * 150 - Math.floor(dispatchElapsed) * 30);
      try {
        if (window.ArcadeVerse && typeof window.ArcadeVerse.postScore === "function") {
          window.ArcadeVerse.postScore(finalScore);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "ARCADEVERSE_GAME_SCORE", score: finalScore }, "*");
        }
      } catch (_) {}
    }

    updateHud();
    drawBoard();
  }

  function getLocomotiveCenter() {
    const current = centerOf(train);
    if (state === "running" && train.from) {
      const previous = centerOf(train.from);
      const progress = Math.min(1, train.progress);
      return {
        x: previous.x + (current.x - previous.x) * progress,
        y: previous.y + (current.y - previous.y) * progress
      };
    }
    return current;
  }

  function isLocomotiveIntersectingSwitch(piece) {
    if (state !== "running") return false;
    const loco = getLocomotiveCenter();
    const swCenter = centerOf(piece);
    const dist = Math.hypot(loco.x - swCenter.x, loco.y - swCenter.y);
    if (dist <= SWITCH_TURN_RADIUS) {
      return true;
    }
    const dx = Math.abs(loco.x - swCenter.x);
    const dy = Math.abs(loco.y - swCenter.y);
    return dx < 32 && dy < 28;
  }

  function applyQueuedSwitches() {
    if (switchQueue.length === 0) return;
    let appliedCount = 0;
    while (switchQueue.length > 0) {
      const item = switchQueue.shift();
      if (item.piece && item.piece.orientation !== item.targetOrientation) {
        item.piece.orientation = item.targetOrientation;
        appliedCount++;
      }
    }
    if (appliedCount > 0) {
      moves += appliedCount;
      updateHud();
      setFeedback("Queued switch applied at junction boundary.");
    }
  }

  function requestSwitchToggle(piece, desiredOrientation = null) {
    if (!piece || state === "paused" || state === "won" || state === "derailed") return;

    const nextOrientation = desiredOrientation !== null
      ? desiredOrientation
      : (piece.orientation === 0 ? 1 : 0);

    if (piece.orientation === nextOrientation) return;

    // Prevent toggling while locomotive intersects switch turn radius (#734)
    if (state === "running" && isLocomotiveIntersectingSwitch(piece)) {
      const existing = switchQueue.find((item) => item.piece === piece);
      if (existing) {
        existing.targetOrientation = nextOrientation;
      } else {
        switchQueue.push({ piece, targetOrientation: nextOrientation });
      }
      setFeedback("Switch locked by locomotive. Toggle queued for junction boundary.");
      drawBoard();
      return;
    }

    piece.orientation = nextOrientation;
    moves++;
    updateHud();
    if (state === "ready") {
      const misplaced = switches.filter((item) => item.orientation !== 0).length;
      setFeedback(misplaced === 0 ? "All switches are aligned. Dispatch when ready." : `${misplaced} switch${misplaced === 1 ? "" : "es"} still need attention.`);
    } else {
      setFeedback("Switch changed. The train is approaching.");
    }
    drawBoard();
  }

  function rotateSwitch(piece) {
    requestSwitchToggle(piece);
  }

  function getApproachingSwitch() {
    if (state !== "running") return null;
    const targetPiece = pieceAt(train.x, train.y);
    if (targetPiece && targetPiece.type === "switch") {
      return switches.find((s) => s.x === train.x && s.y === train.y);
    }
    if (train.from) {
      const fromPiece = pieceAt(train.from.x, train.from.y);
      if (fromPiece && fromPiece.type === "switch") {
        return switches.find((s) => s.x === train.from.x && s.y === train.from.y);
      }
    }
    return null;
  }

  function handleDirectionHotkey(dirKey) {
    let sw = null;
    const selectedPiece = pieceAt(selection.x, selection.y);
    if (selectedPiece && selectedPiece.type === "switch") {
      sw = switches.find((item) => item.x === selection.x && item.y === selection.y);
    } else if (state === "running") {
      sw = getApproachingSwitch();
    }
    if (!sw) return false;

    if (sw.correct === dirKey) {
      requestSwitchToggle(sw, 0);
      return true;
    } else if (sw.branch === dirKey) {
      requestSwitchToggle(sw, 1);
      return true;
    }
    return false;
  }

  function pieceAt(x, y) {
    return cells.get(cellId(x, y));
  }

  function derail(reason) {
    finishRun(false, reason);
  }

  function advanceTrain() {
    const currentPiece = pieceAt(train.x, train.y);
    if (currentPiece.type === "station") {
      finishRun(true, `You routed the runaway train to safety in ${moves} switch ${moves === 1 ? "move" : "moves"}.`);
      return;
    }

    const connections = currentConnections(currentPiece);
    const incoming = train.from ? directionBetween({ x: train.x, y: train.y }, train.from) : null;
    if (incoming && !connections.includes(incoming)) {
      derail("The rail switch was facing the wrong way. The train lost its connection.");
      return;
    }

    const outgoing = connections.filter((direction) => direction !== incoming);
    if (outgoing.length !== 1) {
      derail("The track ends here. The train ran out of rail.");
      return;
    }

    const direction = outgoing[0];
    const offset = directions[direction];
    const next = { x: train.x + offset.dx, y: train.y + offset.dy };
    if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows) {
      derail("The train ran off the edge of the board.");
      return;
    }
    if (blocked.has(cellId(next.x, next.y))) {
      train.from = { x: train.x, y: train.y };
      train.x = next.x;
      train.y = next.y;
      derail("Broken rail ahead. The train derailed before reaching the station.");
      return;
    }

    const nextPiece = pieceAt(next.x, next.y);
    const reciprocal = directions[direction].opposite;
    if (!nextPiece || !currentConnections(nextPiece).includes(reciprocal)) {
      train.from = { x: train.x, y: train.y };
      train.x = next.x;
      train.y = next.y;
      derail("The next rail is disconnected. The train derailed.");
      return;
    }
    train.from = { x: train.x, y: train.y };
    train.x = next.x;
    train.y = next.y;
    train.progress = 0;
    if (nextPiece.type === "station") {
      finishRun(true, `You routed the runaway train to safety in ${moves} switch ${moves === 1 ? "move" : "moves"}.`);
    }
  }

  function frame(timestamp) {
    if (state !== "running") return;
    const delta = lastFrame === 0 ? 0 : Math.min((timestamp - lastFrame) / 1000, 0.045);
    lastFrame = timestamp;
    dispatchElapsed += delta;
    train.progress += delta / stepDuration;

    if (train.progress >= 1) {
      train.progress = 0;
      // Atomically apply queued switch requests at node boundaries (#734)
      applyQueuedSwitches();
      advanceTrain();
    }
    if (state === "running" && dispatchElapsed >= 30) {
      derail("The signal timed out. The train never reached the station.");
    }
    drawBoard();
    if (state === "running") animationFrame = window.requestAnimationFrame(frame);
  }

  function drawBackground() {
    context.fillStyle = "#191512";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const glow = context.createRadialGradient(360, 300, 30, 360, 300, 410);
    glow.addColorStop(0, "#55402b");
    glow.addColorStop(1, "#171411");
    context.globalAlpha = 0.24;
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const px = originX + x * cellSize;
        const py = originY + y * cellSize;
        context.fillStyle = (x + y) % 2 === 0 ? "#33261d" : "#30241c";
        context.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
        context.strokeStyle = "#98734618";
        context.lineWidth = 1;
        context.strokeRect(px + 3, py + 3, cellSize - 6, cellSize - 6);
      }
    }

    context.fillStyle = "#c29a6d";
    context.font = "700 11px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText("NORTH YARD", originX + 3.5 * cellSize, 25);
    context.fillText("TRACK SWITCHES", originX + 3.5 * cellSize, 625);
  }

  function drawSleeper(x, y, direction, alpha) {
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = "#624b35";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    if (direction === "E" || direction === "W") {
      context.moveTo(x, y - 10);
      context.lineTo(x, y + 10);
    } else {
      context.moveTo(x - 10, y);
      context.lineTo(x + 10, y);
    }
    context.stroke();
    context.restore();
  }

  function drawRailSegment(center, direction, active, isSwitch) {
    const offset = directions[direction];
    const end = {
      x: center.x + offset.dx * 39,
      y: center.y + offset.dy * 39
    };
    const alpha = active ? 1 : 0.38;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = active ? "#d19a56" : "#685442";
    context.lineWidth = isSwitch ? 8 : 9;
    context.lineCap = "round";
    context.shadowColor = active ? "#f0ac55" : "transparent";
    context.shadowBlur = active ? 9 : 0;
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = "#281e18";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(center.x + (direction === "E" || direction === "W" ? 0 : -5), center.y + (direction === "N" || direction === "S" ? 0 : -5));
    context.lineTo(end.x + (direction === "E" || direction === "W" ? 0 : -5), end.y + (direction === "N" || direction === "S" ? 0 : -5));
    context.moveTo(center.x + (direction === "E" || direction === "W" ? 0 : 5), center.y + (direction === "N" || direction === "S" ? 0 : 5));
    context.lineTo(end.x + (direction === "E" || direction === "W" ? 0 : 5), end.y + (direction === "N" || direction === "S" ? 0 : 5));
    context.stroke();
    context.restore();

    const count = 3;
    for (let index = 1; index <= count; index++) {
      const ratio = index / (count + 1);
      drawSleeper(center.x + (end.x - center.x) * ratio, center.y + (end.y - center.y) * ratio, direction, alpha);
    }
  }

  function drawFixedTrack(piece) {
    const center = centerOf(piece);
    piece.connections.forEach((direction) => drawRailSegment(center, direction, true, false));
    context.fillStyle = "#bd8c53";
    context.beginPath();
    context.arc(center.x, center.y, 5, 0, Math.PI * 2);
    context.fill();
  }

  function drawSwitch(piece) {
    const center = centerOf(piece);
    const switchPiece = switches.find((item) => item.x === piece.x && item.y === piece.y);
    const activeConnections = currentConnections(piece);
    // Active outgoing direction is the branch currently connected to incoming
    const activeOutgoing = switchPiece.orientation === 0 ? switchPiece.correct : switchPiece.branch;
    const isQueued = switchQueue.some((item) => item.piece === switchPiece);

    // Draw rail segments: active rail is highlighted, inactive is dimmed
    piece.connections.forEach((direction) => {
      drawRailSegment(center, direction, activeConnections.includes(direction), true);
    });

    // Lantern color scheme: Emerald for aligned station path, Crimson for misaligned branch, Amber for queued toggle
    const bulbColor = isQueued
      ? "#f59e0b"
      : switchPiece.orientation === 0
        ? "#22c55e"
        : "#ef4444";
    const bulbGlow = isQueued
      ? 14 + Math.sin(ambientTime * 12) * 5
      : 12;

    context.save();

    // 1. Lantern Housing Base
    context.fillStyle = "#221914";
    context.strokeStyle = isQueued ? "#f59e0b" : "#69503b";
    context.lineWidth = isQueued ? 2 : 1.5;
    context.beginPath();
    context.arc(center.x, center.y, 9, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // 2. Glowing Lantern Lens (SVG Signal Light sync)
    context.fillStyle = bulbColor;
    context.shadowColor = bulbColor;
    context.shadowBlur = bulbGlow;
    context.beginPath();
    context.arc(center.x, center.y, 5.5, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    // 3. Directional Traversal Pointer Needle
    // Strictly matches the active pathing graph outgoing direction (#734)
    const offset = directions[activeOutgoing];
    const tipX = center.x + offset.dx * 20;
    const tipY = center.y + offset.dy * 20;

    context.strokeStyle = isQueued ? "#fde68a" : "#f4d6a0";
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(tipX, tipY);
    context.stroke();

    // Arrowhead at pointer needle tip
    const arrowPerpX = -offset.dy * 4;
    const arrowPerpY = offset.dx * 4;
    context.fillStyle = isQueued ? "#fde68a" : "#f4d6a0";
    context.beginPath();
    context.moveTo(tipX + offset.dx * 2, tipY + offset.dy * 2);
    context.lineTo(tipX - offset.dx * 5 + arrowPerpX, tipY - offset.dy * 5 + arrowPerpY);
    context.lineTo(tipX - offset.dx * 5 - arrowPerpX, tipY - offset.dy * 5 - arrowPerpY);
    context.closePath();
    context.fill();

    context.restore();

    // Queued junction pulse ring
    if (isQueued) {
      context.save();
      const pulseRadius = 22 + Math.sin(ambientTime * 10) * 4;
      context.strokeStyle = "#f59e0b";
      context.lineWidth = 2;
      context.setLineDash([3, 3]);
      context.beginPath();
      context.arc(center.x, center.y, pulseRadius, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.font = "800 8px Segoe UI, sans-serif";
      context.fillStyle = "#fbbf24";
      context.textAlign = "center";
      context.fillText("QUEUED", center.x, center.y + 36);
      context.restore();
    } else if ((state === "ready" || state === "running") && switchPiece.orientation !== 0) {
      context.save();
      context.strokeStyle = "#e48159";
      context.fillStyle = "#f2a17b";
      context.lineWidth = 2;
      context.setLineDash([4, 3]);
      context.beginPath();
      context.arc(center.x, center.y, 26, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.font = "800 8px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.fillText("CHECK", center.x, center.y + 36);
      context.restore();
    }

    if (selection.x === piece.x && selection.y === piece.y) {
      context.strokeStyle = "#ffe1a0";
      context.lineWidth = 2;
      context.setLineDash([5, 4]);
      context.strokeRect(originX + piece.x * cellSize + 6, originY + piece.y * cellSize + 6, cellSize - 12, cellSize - 12);
      context.setLineDash([]);
    }
  }

  function drawBrokenCell(point) {
    const center = centerOf(point);
    context.save();
    context.strokeStyle = "#bc5540";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(center.x - 12, center.y - 12);
    context.lineTo(center.x - 3, center.y - 2);
    context.moveTo(center.x + 2, center.y + 3);
    context.lineTo(center.x + 12, center.y + 12);
    context.moveTo(center.x + 10, center.y - 13);
    context.lineTo(center.x + 3, center.y - 5);
    context.stroke();
    context.strokeStyle = "#e48159";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(center.x - 10, center.y + 13);
    context.lineTo(center.x + 13, center.y - 10);
    context.stroke();
    context.fillStyle = "#d58558";
    context.font = "700 9px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText("BROKEN", center.x, center.y + 26);
    context.restore();
  }

  function drawStation(piece) {
    const center = centerOf(piece);
    drawFixedTrack(piece);
    context.save();
    context.fillStyle = "#44634d";
    context.strokeStyle = "#98bb86";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(center.x - 29, center.y - 27, 58, 54, 7);
    context.fill();
    context.stroke();
    context.fillStyle = "#e1c28a";
    context.font = "800 10px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText("STATION", center.x, center.y + 4);
    context.strokeStyle = "#e1c28a";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(center.x - 15, center.y - 9);
    context.lineTo(center.x + 15, center.y - 9);
    context.stroke();
    context.restore();
  }

  function drawStart(piece) {
    const center = centerOf(piece);
    drawFixedTrack(piece);
    context.save();
    context.fillStyle = "#f0c071";
    context.strokeStyle = "#4a2517";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(center.x, center.y, 15, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#512518";
    context.font = "800 12px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText("P", center.x, center.y + 4);
    context.restore();
  }

  function drawTrain() {
    const current = centerOf(train);
    let position = current;
    if (state === "running" && train.from) {
      const previous = centerOf(train.from);
      const progress = Math.min(1, train.progress);
      position = {
        x: previous.x + (current.x - previous.x) * progress,
        y: previous.y + (current.y - previous.y) * progress
      };
    }
    context.save();
    context.translate(position.x, position.y);
    context.rotate(Math.sin(ambientTime * 10) * 0.025);
    context.shadowColor = "#e78c3d";
    context.shadowBlur = 14;
    context.fillStyle = "#bd5732";
    context.strokeStyle = "#f2bc71";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(-20, -14, 40, 28, 8);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#f0d7a2";
    context.beginPath();
    context.arc(-7, -2, 4, 0, Math.PI * 2);
    context.arc(7, -2, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#4b2519";
    context.beginPath();
    context.arc(-7, -2, 1.5, 0, Math.PI * 2);
    context.arc(7, -2, 1.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffd480";
    context.beginPath();
    context.arc(-11, 13, 3, 0, Math.PI * 2);
    context.arc(11, 13, 3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawBoard() {
    ambientTime += 0.016;
    drawBackground();
    cells.forEach((piece) => {
      if (piece.type === "start") drawStart(piece);
      else if (piece.type === "station") drawStation(piece);
      else if (piece.type === "switch") drawSwitch(piece);
      else drawFixedTrack(piece);
    });
    brokenCells.forEach(drawBrokenCell);
    drawTrain();
  }

  function moveSelection(dx, dy) {
    selection.x = Math.max(0, Math.min(columns - 1, selection.x + dx));
    selection.y = Math.max(0, Math.min(rows - 1, selection.y + dy));
    const piece = pieceAt(selection.x, selection.y);
    setFeedback(piece && piece.type === "switch"
      ? `Switch selected. ${piece.orientation === 0 ? "Station route active." : "Branch route active."}`
      : piece && piece.type === "station" ? "This is the destination station." : "No switch at this position.");
    drawBoard();
  }

  function pointerCell(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    return {
      x: Math.floor((x - originX) / cellSize),
      y: Math.floor((y - originY) / cellSize)
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = pointerCell(event);
    if (point.x < 0 || point.x >= columns || point.y < 0 || point.y >= rows) return;
    selection.x = point.x;
    selection.y = point.y;
    const piece = pieceAt(point.x, point.y);
    if (piece && piece.type === "switch") {
      requestSwitchToggle(switches.find((item) => item.x === point.x && item.y === point.y));
    } else {
      setFeedback(blocked.has(cellId(point.x, point.y)) ? "Broken rail. The train cannot pass here." : "Select a golden switch to change the route.");
      drawBoard();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.target instanceof HTMLElement && event.target.closest("button") && event.key !== "Escape") return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      handleDirectionHotkey("N");
      moveSelection(0, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      handleDirectionHotkey("S");
      moveSelection(0, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handleDirectionHotkey("W");
      moveSelection(-1, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      handleDirectionHotkey("E");
      moveSelection(1, 0);
    } else if (event.code === "Space") {
      event.preventDefault();
      const piece = pieceAt(selection.x, selection.y);
      if (piece && piece.type === "switch") {
        requestSwitchToggle(switches.find((item) => item.x === selection.x && item.y === selection.y));
      }
    } else if (event.key.toLowerCase() === "w") {
      if (handleDirectionHotkey("N")) event.preventDefault();
    } else if (event.key.toLowerCase() === "s") {
      if (handleDirectionHotkey("S")) event.preventDefault();
    } else if (event.key.toLowerCase() === "a") {
      if (handleDirectionHotkey("W")) event.preventDefault();
    } else if (event.key.toLowerCase() === "d") {
      if (handleDirectionHotkey("E")) event.preventDefault();
    } else if (event.key === "Enter" && (state === "ready" || state === "paused")) {
      startTrain();
    } else if (event.key.toLowerCase() === "p") {
      if (state === "running") {
        state = "paused";
        window.cancelAnimationFrame(animationFrame);
        overlayTitle.textContent = "Train paused";
        overlayMessage.textContent = "Switch the remaining rails, then resume the train before the signal fades.";
        startButton.textContent = "Resume train";
        overlay.hidden = false;
        updateHud();
      } else if (state === "paused") {
        startTrain();
      }
    } else if (event.key.toLowerCase() === "r") {
      resetLevel();
    } else if (event.key === "Escape" && state === "running") {
      state = "paused";
      window.cancelAnimationFrame(animationFrame);
      overlayTitle.textContent = "Train paused";
      overlayMessage.textContent = "Switch the remaining rails, then resume the train before the signal fades.";
      startButton.textContent = "Resume train";
      overlay.hidden = false;
      updateHud();
    }
  });

  startButton.addEventListener("click", () => {
    if (state === "won" || state === "derailed") {
      resetLevel();
      return;
    }
    startTrain();
  });
  document.getElementById("help-button").addEventListener("click", showInstructions);
  document.getElementById("restart-button").addEventListener("click", resetLevel);

  buildTrack();
  updateHud();
  drawBoard();
})();
