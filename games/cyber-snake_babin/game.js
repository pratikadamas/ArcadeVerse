/**
 * Cyber Snake Matrix
 * Pure Vanilla JavaScript 60fps canvas grid navigation game
 */

(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const scoreDisplay = document.getElementById("score-display");
  const levelDisplay = document.getElementById("level-display");
  const bestScoreEl = document.getElementById("best-score");

  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const finalScoreEl = document.getElementById("final-score");
  const finalLengthEl = document.getElementById("final-length");
  const finalBestEl = document.getElementById("final-best");

  const dpadUp = document.getElementById("dpad-up");
  const dpadDown = document.getElementById("dpad-down");
  const dpadLeft = document.getElementById("dpad-left");
  const dpadRight = document.getElementById("dpad-right");

  const rulesBtn = document.getElementById("rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  const GRID_SIZE = 20;
  const CELL_SIZE = canvas.width / GRID_SIZE; // 20px per cell

  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let goldenFood = null;
  let goldenTimer = 0;
  let score = 0;
  let level = 1;
  let tickSpeed = 120;
  let isPlaying = false;
  let gameLoopTimeout = null;
  let bestScore = 0;
  try {
    bestScore = parseInt((window.ArcadeStorage ? window.ArcadeStorage.getItem("bestScore") : null) || localStorage.getItem("arcadeverse_cyber_snake_best") || "0", 10) || 0;
  } catch (e) {}

  bestScoreEl.textContent = bestScore;

  function updateBestScore() {
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      try {
        if (window.ArcadeStorage) window.ArcadeStorage.setItem("bestScore", bestScore); localStorage.setItem("arcadeverse_cyber_snake_best", bestScore);
      } catch (e) {}
    }
  }

  function spawnFood() {
    let valid = false;
    let newFood = null;

    while (!valid) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };

      valid = !snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }

    food = newFood;
  }

  function spawnGoldenFood() {
    if (goldenFood || Math.random() > 0.3) return;

    let valid = false;
    let newGold = null;

    while (!valid) {
      newGold = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        life: 50 // frames
      };

      valid = !snake.some(seg => seg.x === newGold.x && seg.y === newGold.y) &&
              !(food && food.x === newGold.x && food.y === newGold.y);
    }

    goldenFood = newGold;
  }

  function initGame() {
    snake = [
      { x: 6, y: 10 },
      { x: 5, y: 10 },
      { x: 4, y: 10 }
    ];

    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    tickSpeed = 120;
    goldenFood = null;
    isPlaying = true;

    scoreDisplay.textContent = "0";
    level = 1;
    if (levelDisplay) levelDisplay.textContent = "1";

    startOverlay.classList.remove("active");
    gameoverOverlay.classList.remove("active");

    spawnFood();

    if (gameLoopTimeout) clearTimeout(gameLoopTimeout);
    tick();
  }

  function update() {
    dir = { ...nextDir };

    // Calculate new head coordinates (with boundary wrap-around portals)
    let newX = snake[0].x + dir.x;
    let newY = snake[0].y + dir.y;

    if (newX < 0) newX = GRID_SIZE - 1;
    else if (newX >= GRID_SIZE) newX = 0;

    if (newY < 0) newY = GRID_SIZE - 1;
    else if (newY >= GRID_SIZE) newY = 0;

    // Check self-collision
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === newX && snake[i].y === newY) {
        gameOver();
        return;
      }
    }

    const newHead = { x: newX, y: newY };
    snake.unshift(newHead);

    // Check eating normal food
    if (food && newX === food.x && newY === food.y) {
      score += 10;
      level = Math.floor(score / 30) + 1;
      spawnFood();
      spawnGoldenFood();

      // Progressive speedup
      tickSpeed = Math.max(65, 120 - Math.floor(score / 30) * 8);
      if (levelDisplay) levelDisplay.textContent = level;

      scoreDisplay.textContent = score;
      updateBestScore();
    } else if (goldenFood && newX === goldenFood.x && newY === goldenFood.y) {
      score += 50;
      goldenFood = null;
      scoreDisplay.textContent = score;
      updateBestScore();
    } else {
      snake.pop(); // normal movement
    }

    // Golden food countdown
    if (goldenFood) {
      goldenFood.life--;
      if (goldenFood.life <= 0) goldenFood = null;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw cyber grid
    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw Golden Food
    if (goldenFood) {
      ctx.save();
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(
        goldenFood.x * CELL_SIZE + CELL_SIZE / 2,
        goldenFood.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Draw Normal Food
    if (food) {
      ctx.save();
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.fillRect(
        food.x * CELL_SIZE + 3,
        food.y * CELL_SIZE + 3,
        CELL_SIZE - 6,
        CELL_SIZE - 6
      );
      ctx.restore();
    }

    // Draw Snake
    snake.forEach((seg, index) => {
      ctx.save();
      if (index === 0) {
        // Head
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 12;
      } else {
        // Body with gradient glow
        const hue = (160 + index * 5) % 360;
        ctx.fillStyle = `hsl(${hue}, 85%, 55%)`;
        ctx.shadowColor = `hsl(${hue}, 85%, 65%)`;
        ctx.shadowBlur = 6;
      }

      ctx.beginPath();
      ctx.roundRect(
        seg.x * CELL_SIZE + 2,
        seg.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
        index === 0 ? 6 : 4
      );
      ctx.fill();
      ctx.restore();
    });
  }

  function tick() {
    if (!isPlaying) return;
    update();
    draw();
    if (isPlaying) {
      gameLoopTimeout = setTimeout(tick, tickSpeed);
    }
  }

  function gameOver() {
    isPlaying = false;
    if (gameLoopTimeout) clearTimeout(gameLoopTimeout);

    finalScoreEl.textContent = score;
    finalLengthEl.textContent = snake.length;
    finalBestEl.textContent = bestScore;

    setTimeout(() => {
      gameoverOverlay.classList.add("active");
    }, 400);
  }

  function setDirection(dx, dy) {
    if (!isPlaying) return;
    // Prevent 180-degree reversing
    if (dir.x !== 0 && dx === -dir.x) return;
    if (dir.y !== 0 && dy === -dir.y) return;
    nextDir = { x: dx, y: dy };
  }

  // Keyboard navigation
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "arrowup" || key === "w") {
      e.preventDefault();
      setDirection(0, -1);
    } else if (key === "arrowdown" || key === "s") {
      e.preventDefault();
      setDirection(0, 1);
    } else if (key === "arrowleft" || key === "a") {
      e.preventDefault();
      setDirection(-1, 0);
    } else if (key === "arrowright" || key === "d") {
      e.preventDefault();
      setDirection(1, 0);
    } else if ((e.code === "Space" || e.code === "Enter") && !isPlaying) {
      e.preventDefault();
      initGame();
    } else if (e.code === "Escape") {
      if (rulesModal && rulesModal.classList.contains("active")) {
        rulesModal.classList.remove("active");
      }
    }
  });

  // Mobile D-Pad
  dpadUp.addEventListener("pointerdown", () => setDirection(0, -1));
  dpadDown.addEventListener("pointerdown", () => setDirection(0, 1));
  dpadLeft.addEventListener("pointerdown", () => setDirection(-1, 0));
  dpadRight.addEventListener("pointerdown", () => setDirection(1, 0));

  startBtn.addEventListener("click", initGame);
  restartBtn.addEventListener("click", initGame);

  // Modal Handlers
  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("active");
  });
})();
