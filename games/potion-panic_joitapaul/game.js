(() => {
  "use strict";

  const canvas = document.getElementById("potion-canvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const livesElement = document.getElementById("lives");
  const speedElement = document.getElementById("brew-speed");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const startButton = document.getElementById("start-button");
  const feedback = document.getElementById("feedback");
  const cauldronButtons = [...document.querySelectorAll("[data-cauldron]")];
  const width = canvas.width;
  const height = canvas.height;
  const cauldronPositions = [110, 300, 490];
  const cauldronY = 500;
  const ingredientTypes = [
    { name: "Thorn", color: "#77d98b", shape: "thorn" },
    { name: "Moon", color: "#77d9ff", shape: "moon" },
    { name: "Ember", color: "#ff9d4d", shape: "ember" }
  ];

  let score = 0;
  let lives = 3;
  let selectedCauldron = 1;
  let ingredients = [];
  let spawnCountdown = 0;
  let elapsed = 0;
  let previousFrame = 0;
  let animationFrame = 0;
  let gameState = "ready";
  let feedbackCountdown = 0;
  let ingredientBag = [];

  function startGame() {
    cancelAnimationFrame(animationFrame);
    score = 0;
    lives = 3;
    selectedCauldron = 1;
    ingredients = [];
    spawnCountdown = 0.6;
    elapsed = 0;
    previousFrame = 0;
    feedbackCountdown = 0;
    ingredientBag = [];
    gameState = "playing";
    feedback.textContent = "Choose a cauldron, then catch the matching ingredient.";
    overlay.hidden = true;
    updateHud();
    animationFrame = requestAnimationFrame(frame);
  }

  function pauseForInstructions() {
    if (gameState === "playing") {
      gameState = "paused";
      cancelAnimationFrame(animationFrame);
    }

    overlayTitle.textContent = "How to play";
    overlayMessage.textContent = "Ingredients fall into their matching lanes. Select the matching cauldron before an ingredient reaches it to score; a wrong selection or missed ingredient costs one life.";
    startButton.textContent = gameState === "paused" ? "Resume brewing"
      : gameState === "over" ? "Play again" : "Start brewing";
    overlay.hidden = false;
  }

  function activateOverlayButton() {
    if (gameState === "paused") {
      gameState = "playing";
      previousFrame = 0;
      overlay.hidden = true;
      animationFrame = requestAnimationFrame(frame);
    } else {
      startGame();
    }
  }

  function selectCauldron(index) {
    if (index < 0 || index >= cauldronPositions.length) return;
    selectedCauldron = index;
    updateCauldronSelection();
    if (gameState === "playing") {
      feedback.textContent = `${ingredientTypes[index].name} cauldron selected.`;
      feedbackCountdown = 1.1;
    }
  }

  function cycleCauldron(direction) {
    selectCauldron((selectedCauldron + direction + cauldronPositions.length) % cauldronPositions.length);
  }

  function updateCauldronSelection() {
    cauldronButtons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === selectedCauldron));
    });
  }

  function updateHud() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    const speedLevel = Math.min(5, 1 + Math.floor(score / 8));
    speedElement.textContent = ["I", "II", "III", "IV", "V"][speedLevel - 1];
    updateCauldronSelection();
  }

  function spawnIngredient() {
    if (ingredientBag.length === 0) {
      ingredientBag = ingredientTypes.map((_, index) => index);
      for (let index = ingredientBag.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [ingredientBag[index], ingredientBag[swapIndex]] = [ingredientBag[swapIndex], ingredientBag[index]];
      }
    }

    const type = ingredientBag.pop();
    ingredients.push({
      type,
      x: cauldronPositions[type],
      y: 82,
      rotation: Math.random() * Math.PI * 2,
      wobble: Math.random() * Math.PI * 2
    });
  }

  function frame(timestamp) {
    if (gameState !== "playing") return;
    const delta = previousFrame
      ? Math.min((timestamp - previousFrame) / 1000, 0.035)
      : 0;
    previousFrame = timestamp;
    elapsed += delta;
    spawnCountdown -= delta;
    feedbackCountdown = Math.max(0, feedbackCountdown - delta);

    if (feedbackCountdown === 0 && feedback.textContent !== "Choose a cauldron, then catch the matching ingredient.") {
      feedback.textContent = "Choose a cauldron, then catch the matching ingredient.";
    }

    if (spawnCountdown <= 0) {
      spawnIngredient();
      const spawnInterval = Math.max(0.52, 1.25 - elapsed * 0.012 - score * 0.018);
      spawnCountdown += spawnInterval;
    }

    const fallSpeed = Math.min(190 + elapsed * 4 + score * 1.4, 390);
    const remainingIngredients = [];

    for (const ingredient of ingredients) {
      ingredient.y += fallSpeed * delta;
      ingredient.rotation += delta * 1.25;
      ingredient.wobble += delta * 4;

      if (ingredient.y >= cauldronY - 43) {
        resolveIngredient(ingredient);
        if (lives <= 0) break;
      } else {
        remainingIngredients.push(ingredient);
      }
    }

    ingredients = remainingIngredients;
    updateHud();
    drawScene();

    if (lives <= 0) {
      finishGame();
      return;
    }
    animationFrame = requestAnimationFrame(frame);
  }

  function resolveIngredient(ingredient) {
    const type = ingredientTypes[ingredient.type];
    if (ingredient.type === selectedCauldron) {
      score++;
      feedback.textContent = `${type.name} sorted. Nice catch!`;
      feedbackCountdown = 1.25;
    } else {
      lives = Math.max(0, lives - 1);
      feedback.textContent = `Missed ${type.name}. The active cauldron did not match. One life lost.`;
      feedbackCountdown = 1.5;
    }
  }

  function finishGame() {
    gameState = "over";
    cancelAnimationFrame(animationFrame);
    overlayTitle.textContent = "The lab overflowed";
    overlayMessage.textContent = `Final score: ${score}. The ingredients got the better of you this time.`;
    startButton.textContent = "Brew again";
    overlay.hidden = false;
    drawScene();
  }

  function drawBackground() {
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#171021");
    background.addColorStop(0.68, "#20152a");
    background.addColorStop(1, "#120d19");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.5;
    context.fillStyle = "#ecd7ff";
    context.beginPath();
    context.arc(492, 89, 39, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(510, 75, 38, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.strokeStyle = "#e0b15a15";
    context.lineWidth = 1;
    for (let x = 26; x < width; x += 38) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 16; y < height; y += 38) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    context.fillStyle = "#e7b866";
    [[67, 83], [175, 141], [420, 188], [542, 240], [86, 260], [355, 93]].forEach(([x, y], index) => {
      context.globalAlpha = 0.35 + (index % 2) * 0.2;
      context.fillRect(x, y, 2, 2);
    });
    context.globalAlpha = 1;
  }

  function drawIngredientSymbol(type, x, y, size) {
    context.save();
    context.translate(x, y);
    context.strokeStyle = type.color;
    context.fillStyle = `${type.color}35`;
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.lineCap = "round";

    if (type.shape === "thorn") {
      context.beginPath();
      context.moveTo(0, -size);
      context.lineTo(size * 0.22, -size * 0.35);
      context.lineTo(size * 0.85, -size * 0.72);
      context.lineTo(size * 0.53, -size * 0.1);
      context.lineTo(size, size * 0.42);
      context.lineTo(size * 0.25, size * 0.37);
      context.lineTo(0, size);
      context.lineTo(-size * 0.25, size * 0.37);
      context.lineTo(-size, size * 0.42);
      context.lineTo(-size * 0.53, -size * 0.1);
      context.lineTo(-size * 0.85, -size * 0.72);
      context.lineTo(-size * 0.22, -size * 0.35);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(0, -size * 0.6);
      context.lineTo(0, size * 0.6);
      context.stroke();
    } else if (type.shape === "moon") {
      context.beginPath();
      context.arc(-size * 0.12, 0, size * 0.8, -Math.PI * 0.72, Math.PI * 0.74);
      context.quadraticCurveTo(size * 0.25, size * 0.08, size * 0.48, -size * 0.75);
      context.quadraticCurveTo(size * 0.05, -size * 0.48, -size * 0.12, -size * 0.8);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(size * 0.58, -size * 0.52, size * 0.12, 0, Math.PI * 2);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(0, -size);
      context.bezierCurveTo(size * 0.82, -size * 0.6, size * 0.82, size * 0.28, 0, size * 0.88);
      context.bezierCurveTo(-size * 0.82, size * 0.28, -size * 0.82, -size * 0.6, 0, -size);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-size * 0.35, size * 0.15);
      context.quadraticCurveTo(0, -size * 0.1, size * 0.35, size * 0.15);
      context.stroke();
    }
    context.restore();
  }

  function drawIngredient(ingredient) {
    const type = ingredientTypes[ingredient.type];
    const pulse = 1 + Math.sin(ingredient.wobble) * 0.05;
    const size = 17 * pulse;

    context.save();
    context.shadowColor = type.color;
    context.shadowBlur = 17;
    context.fillStyle = "#23182d";
    context.beginPath();
    context.arc(ingredient.x, ingredient.y, 27, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = `${type.color}99`;
    context.lineWidth = 1.5;
    context.stroke();
    context.translate(ingredient.x, ingredient.y);
    context.rotate(ingredient.rotation);
    context.translate(-ingredient.x, -ingredient.y);
    drawIngredientSymbol(type, ingredient.x, ingredient.y, size);
    context.restore();
  }

  function drawCauldron(index) {
    const x = cauldronPositions[index];
    const type = ingredientTypes[index];
    const isSelected = index === selectedCauldron;
    const glow = isSelected ? 22 : 8;

    context.save();
    context.shadowColor = type.color;
    context.shadowBlur = glow;
    context.fillStyle = isSelected ? "#30203a" : "#1d1727";
    context.strokeStyle = isSelected ? type.color : "#65506e";
    context.lineWidth = isSelected ? 3 : 2;
    context.beginPath();
    context.moveTo(x - 60, cauldronY - 29);
    context.lineTo(x - 48, cauldronY + 22);
    context.quadraticCurveTo(x, cauldronY + 48, x + 48, cauldronY + 22);
    context.lineTo(x + 60, cauldronY - 29);
    context.closePath();
    context.fill();
    context.stroke();
    context.shadowBlur = 0;

    context.fillStyle = "#0e0a14";
    context.beginPath();
    context.ellipse(x, cauldronY - 27, 60, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = isSelected ? type.color : "#65506e";
    context.stroke();

    context.strokeStyle = isSelected ? type.color : "#75617e";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(x - 38, cauldronY + 39);
    context.lineTo(x - 46, cauldronY + 48);
    context.moveTo(x + 38, cauldronY + 39);
    context.lineTo(x + 46, cauldronY + 48);
    context.stroke();

    drawIngredientSymbol(type, x, cauldronY - 8, 12);
    context.fillStyle = isSelected ? type.color : "#bdacc6";
    context.font = "700 11px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText(type.name.toUpperCase(), x, cauldronY + 73);
    if (isSelected) {
      context.fillStyle = "#f4e7fc";
      context.font = "800 10px Consolas, monospace";
      context.fillText("ACTIVE", x, cauldronY + 89);
    }
    context.restore();
  }

  function drawScene() {
    drawBackground();
    ingredients.forEach(drawIngredient);
    cauldronPositions.forEach((_, index) => drawCauldron(index));
  }

  document.addEventListener("keydown", (event) => {
    const directSelections = {
      "1": 0, a: 0, A: 0,
      "2": 1, s: 1, S: 1,
      "3": 2, d: 2, D: 2
    };

    if (Number.isInteger(directSelections[event.key]) && gameState === "playing") {
      event.preventDefault();
      selectCauldron(directSelections[event.key]);
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && gameState === "playing") {
      event.preventDefault();
      cycleCauldron(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.code === "Space" && gameState === "ready") {
      event.preventDefault();
      startGame();
    } else if (event.key === "Escape" && gameState === "playing") {
      pauseForInstructions();
    }
  });

  cauldronButtons.forEach((button) => {
    button.addEventListener("click", () => selectCauldron(Number(button.dataset.cauldron)));
  });
  startButton.addEventListener("click", activateOverlayButton);
  document.getElementById("help-button").addEventListener("click", pauseForInstructions);

  drawScene();
  updateHud();
})();
