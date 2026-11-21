/**
 * Cryptic Wordle Hack
 * Pure Vanilla JavaScript 5-letter tech keyword puzzle
 */

(() => {
  const WORD_BANK = [
    "CYBER", "PIXEL", "LOGIC", "ARRAY", "STACK", "QUEUE", "CLOUD", "LINUX",
    "QUERY", "ASYNC", "PROXY", "PATCH", "BUILD", "TOKEN", "GRAPH", "CACHE",
    "DEBUG", "RESET", "MACRO", "BYTES", "CLONE", "FETCH", "ROUTE", "PARSE",
    "SHELL", "INPUT", "REACT", "SCOPE", "SCALE", "CRONX"
  ];

  const gridContainer = document.getElementById("grid-container");
  const keyboardContainer = document.getElementById("keyboard-container");
  const toastContainer = document.getElementById("toast-container");

  const statsBtn = document.getElementById("stats-btn");
  const rulesBtn = document.getElementById("rules-btn");
  const closeStatsBtn = document.getElementById("close-stats-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const nextGameBtn = document.getElementById("next-game-btn");

  const statsModal = document.getElementById("stats-modal");
  const rulesModal = document.getElementById("rules-modal");
  const revealedWordEl = document.getElementById("revealed-word");

  const statPlayedEl = document.getElementById("stat-played");
  const statWinPctEl = document.getElementById("stat-winpct");
  const statStreakEl = document.getElementById("stat-streak");
  const statMaxStreakEl = document.getElementById("stat-maxstreak");

  let secretWord = "";
  let currentLevel = 1;
  let currentScore = 0;
  const currentLevelEl = document.getElementById("current-level");
  const currentScoreEl = document.getElementById("current-score");
  let currentRow = 0;
  let currentTile = 0;
  let isGameOver = false;
  let isRevealing = false;
  let revealTimers = [];
  let rows = [];

  // LocalStorage Stats
  let stats = { played: 0, won: 0, streak: 0, maxStreak: 0 };
  try {
    const saved = localStorage.getItem("arcadeverse_cryptic_wordle_stats");
    if (saved) stats = JSON.parse(saved);
  } catch (e) {}

  function saveStats() {
    try {
      localStorage.setItem("arcadeverse_cryptic_wordle_stats", JSON.stringify(stats));
    } catch (e) {}
  }

  function updateStatsDisplay() {
    statPlayedEl.textContent = stats.played;
    const winPct = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
    statWinPctEl.textContent = `${winPct}%`;
    statStreakEl.textContent = stats.streak;
    statMaxStreakEl.textContent = stats.maxStreak;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  function initGrid() {
    gridContainer.innerHTML = "";
    rows = [];

    for (let r = 0; r < 6; r++) {
      const row = document.createElement("div");
      row.className = "wordle-row";
      const rowTiles = [];

      for (let c = 0; c < 5; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        row.appendChild(tile);
        rowTiles.push(tile);
      }

      gridContainer.appendChild(row);
      rows.push(rowTiles);
    }
  }

  function resetKeyboardKeys() {
    const keys = keyboardContainer.querySelectorAll(".key");
    keys.forEach(k => {
      k.classList.remove("green", "amber", "dark");
    });
  }

  function clearRevealTimers() {
    revealTimers.forEach(t => clearTimeout(t));
    revealTimers = [];
  }

  function initGame() {
    clearRevealTimers();
    secretWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    currentRow = 0;
    currentTile = 0;
    isGameOver = false;
    isRevealing = false;

    initGrid();
    resetKeyboardKeys();
    statsModal.classList.remove("active");
  }

  function addLetter(letter) {
    if (isGameOver || isRevealing || currentTile >= 5) return;
    const tile = rows[currentRow][currentTile];
    tile.textContent = letter;
    tile.classList.add("filled");
    currentTile++;
  }

  function removeLetter() {
    if (isGameOver || isRevealing || currentTile <= 0) return;
    currentTile--;
    const tile = rows[currentRow][currentTile];
    tile.textContent = "";
    tile.classList.remove("filled");
  }

  function submitGuess() {
    if (isGameOver || isRevealing) return;

    if (currentTile < 5) {
      showToast("Keyword requires 5 letters");
      const rowEl = gridContainer.children[currentRow];
      rowEl.classList.add("shake");
      setTimeout(() => rowEl.classList.remove("shake"), 400);
      return;
    }

    isRevealing = true;
    clearRevealTimers();

    const rowTiles = rows[currentRow];
    let guess = "";
    for (let i = 0; i < 5; i++) {
      guess += rowTiles[i].textContent;
    }

    // Evaluate guess
    const secretLetters = secretWord.split("");
    const guessLetters = guess.split("");
    const result = Array(5).fill("dark");

    // First pass: exact matches (Green)
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === secretLetters[i]) {
        result[i] = "green";
        secretLetters[i] = null;
      }
    }

    // Second pass: misplaced matches (Amber)
    for (let i = 0; i < 5; i++) {
      if (result[i] !== "green") {
        const foundIndex = secretLetters.indexOf(guessLetters[i]);
        if (foundIndex !== -1) {
          result[i] = "amber";
          secretLetters[foundIndex] = null;
        }
      }
    }

    // Reveal with animation
    for (let i = 0; i < 5; i++) {
      const tile = rowTiles[i];
      const status = result[i];
      const letter = guessLetters[i];

      const timerId = setTimeout(() => {
        tile.classList.add("flip", status);

        // Update virtual keyboard key
        const keyEl = keyboardContainer.querySelector(`.key[data-key="${letter}"]`);
        if (keyEl) {
          if (status === "green") {
            keyEl.classList.remove("amber", "dark");
            keyEl.classList.add("green");
          } else if (status === "amber" && !keyEl.classList.contains("green")) {
            keyEl.classList.remove("dark");
            keyEl.classList.add("amber");
          } else if (status === "dark" && !keyEl.classList.contains("green") && !keyEl.classList.contains("amber")) {
            keyEl.classList.add("dark");
          }
        }
      }, i * 200);
      revealTimers.push(timerId);
    }

    // Check game outcome after flip animation
    const outcomeTimerId = setTimeout(() => {
      isRevealing = false;
      if (guess === secretWord) {
        // Victory!
        isGameOver = true;
        stats.played++;
        stats.won++;
        stats.streak++;
        if (stats.streak > stats.maxStreak) stats.maxStreak = stats.streak;
        saveStats();

        const rowScore = (6 - currentRow) * 150;
        currentScore += rowScore;
        currentScoreEl.textContent = currentScore;
        currentLevel++;
        currentLevelEl.textContent = currentLevel;

        try {
          window.dispatchEvent(new CustomEvent('ARCADEVERSE_GAME_SCORE', {
            detail: { gameId: 'cryptic-wordle', score: currentScore, level: currentLevel }
          }));
        } catch (_) {}

        showToast("DECRYPTION SUCCESSFUL!");
        revealedWordEl.textContent = secretWord;
        updateStatsDisplay();
        const modalTimerId = setTimeout(() => statsModal.classList.add("active"), 1200);
        revealTimers.push(modalTimerId);
      } else if (currentRow === 5) {
        // Defeat!
        isGameOver = true;
        stats.played++;
        stats.streak = 0;
        saveStats();

        try {
          window.dispatchEvent(new CustomEvent('ARCADEVERSE_GAME_OVER', {
            detail: { gameId: 'cryptic-wordle', score: currentScore, level: currentLevel }
          }));
        } catch (_) {}

        showToast("SYSTEM LOCKED - ACCESS DENIED");
        revealedWordEl.textContent = secretWord;
        updateStatsDisplay();
        const modalTimerId = setTimeout(() => statsModal.classList.add("active"), 1200);
        revealTimers.push(modalTimerId);
      } else {
        currentRow++;
        currentTile = 0;
      }
    }, 5 * 200 + 100);
    revealTimers.push(outcomeTimerId);
  }

  // Keyboard Event Listeners
  window.addEventListener("keydown", (e) => {
    if (isGameOver) return;
    if (e.key === "Enter") {
      e.preventDefault();
      submitGuess();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      removeLetter();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      addLetter(e.key.toUpperCase());
    }
  });

  // Virtual Keyboard clicks
  keyboardContainer.addEventListener("click", (e) => {
    const keyBtn = e.target.closest(".key");
    if (!keyBtn) return;
    const key = keyBtn.getAttribute("data-key");
    if (key === "ENTER") submitGuess();
    else if (key === "BACKSPACE") removeLetter();
    else addLetter(key);
  });

  statsBtn.addEventListener("click", () => {
    revealedWordEl.textContent = isGameOver ? secretWord : "•••••";
    updateStatsDisplay();
    statsModal.classList.add("active");
  });
  closeStatsBtn.addEventListener("click", () => statsModal.classList.remove("active"));
  nextGameBtn.addEventListener("click", initGame);

  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));

  window.addEventListener('ARCADEVERSE_TEARDOWN', () => {
    clearRevealTimers();
  });

  window.addEventListener('ARCADEVERSE_PAUSE', () => {
    // Keep paused state
  });

  initGame();
  updateStatsDisplay();
})();
