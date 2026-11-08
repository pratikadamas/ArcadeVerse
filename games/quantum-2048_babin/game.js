/**
 * Quantum 2048 Game Engine
 * Author: Babin123456 (Babin Bid)
 * Pure Vanilla JS, Zero external dependencies, Web Audio API sound synthesis
 */

class Quantum2048 {
  constructor() {
    this.size = 4;
    this.board = [];
    let savedBest = 0;
    try {
      savedBest = parseInt((window.ArcadeStorage ? window.ArcadeStorage.getItem("bestScore") : null) || localStorage.getItem("arcadeverse_q2048_best") || "0", 10) || 0;
    } catch (e) {}
    this.bestScore = savedBest;
    this.previousState = null;
    this.soundEnabled = true;
    this.won = false;
    this.keepPlaying = false;
    this.over = false;

    // DOM Elements
    this.tileContainer = document.getElementById("tile-container");
    this.currentScoreEl = document.getElementById("current-score");
    this.bestScoreEl = document.getElementById("best-score");
    this.undoBtn = document.getElementById("undo-btn");
    this.soundBtn = document.getElementById("sound-btn");
    this.soundIcon = document.getElementById("sound-icon");
    this.restartBtn = document.getElementById("restart-btn");
    this.gameOverOverlay = document.getElementById("game-over-overlay");
    this.gameOverScore = document.getElementById("game-over-score");
    this.overlayRestartBtn = document.getElementById("overlay-restart-btn");
    this.victoryOverlay = document.getElementById("victory-overlay");
    this.victoryScore = document.getElementById("victory-score");
    this.continueBtn = document.getElementById("continue-btn");
    this.victoryRestartBtn = document.getElementById("victory-restart-btn");
    this.boardContainer = document.getElementById("board-container");

    this.audioCtx = null;
    this.touchStartX = 0;
    this.touchStartY = 0;

    this.init();
  }

  init() {
    this.bestScoreEl.textContent = this.bestScore;
    this.setupEventListeners();
    this.startNewGame();
  }

  startNewGame() {
    this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.score = 0;
    this.won = false;
    this.keepPlaying = false;
    this.over = false;
    this.previousState = null;

    this.updateScore(0);
    this.updateUndoButton();
    this.hideOverlays();

    this.addRandomTile();
    this.addRandomTile();
    this.render();
  }

  hideOverlays() {
    if (this.gameOverOverlay) this.gameOverOverlay.classList.add("hidden");
    if (this.victoryOverlay) this.victoryOverlay.classList.add("hidden");
  }

  setupEventListeners() {
    // Keyboard Navigation
    window.addEventListener("keydown", (e) => {
      if (this.over && !this.keepPlaying) return;

      const keys = {
        ArrowUp: "up",
        KeyW: "up",
        w: "up",
        ArrowDown: "down",
        KeyS: "down",
        s: "down",
        ArrowLeft: "left",
        KeyA: "left",
        a: "left",
        ArrowRight: "right",
        KeyD: "right",
        d: "right"
      };

      const direction = keys[e.code] || keys[e.key];
      if (direction) {
        e.preventDefault();
        this.move(direction);
      }
    });

    // Touch Swipe Gestures
    if (this.boardContainer) {
      this.boardContainer.addEventListener("touchstart", (e) => {
        if (e.touches.length > 1) return;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }, { passive: true });

      this.boardContainer.addEventListener("touchend", (e) => {
        if (!this.touchStartX || !this.touchStartY) return;
        const deltaX = e.changedTouches[0].clientX - this.touchStartX;
        const deltaY = e.changedTouches[0].clientY - this.touchStartY;
        const minSwipeDistance = 30;

        if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) return;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          this.move(deltaX > 0 ? "right" : "left");
        } else {
          this.move(deltaY > 0 ? "down" : "up");
        }

        this.touchStartX = 0;
        this.touchStartY = 0;
      }, { passive: true });
    }

    // UI Buttons
    if (this.restartBtn) this.restartBtn.addEventListener("click", () => this.startNewGame());
    if (this.overlayRestartBtn) this.overlayRestartBtn.addEventListener("click", () => this.startNewGame());
    if (this.victoryRestartBtn) this.victoryRestartBtn.addEventListener("click", () => this.startNewGame());

    if (this.continueBtn) {
      this.continueBtn.addEventListener("click", () => {
        this.keepPlaying = true;
        this.hideOverlays();
      });
    }

    if (this.undoBtn) {
      this.undoBtn.addEventListener("click", () => this.undo());
    }

    if (this.soundBtn) {
      this.soundBtn.addEventListener("click", () => {
        this.soundEnabled = !this.soundEnabled;
        this.soundIcon.innerHTML = this.soundEnabled 
          ? '<i data-lucide="volume-2"></i> Sound ON' 
          : '<i data-lucide="volume-x"></i> Muted';
        if (window.lucide) {
          lucide.createIcons();
        }
      });
    }
  }

  savePreviousState() {
    this.previousState = {
      board: this.board.map(row => [...row]),
      score: this.score
    };
    this.updateUndoButton();
  }

  undo() {
    if (!this.previousState) return;
    this.board = this.previousState.board.map(row => [...row]);
    this.score = this.previousState.score;
    this.previousState = null;
    this.over = false;
    this.hideOverlays();
    this.updateScore(this.score);
    this.updateUndoButton();
    this.render();
  }

  updateUndoButton() {
    if (this.undoBtn) {
      this.undoBtn.disabled = !this.previousState;
    }
  }

  updateScore(newScore) {
    this.score = newScore;
    if (this.currentScoreEl) this.currentScoreEl.textContent = this.score;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        if (window.ArcadeStorage) window.ArcadeStorage.setItem("bestScore", this.bestScore.toString()); localStorage.setItem("arcadeverse_q2048_best", this.bestScore.toString());
      } catch (e) {}
      if (this.bestScoreEl) this.bestScoreEl.textContent = this.bestScore;
    }
  }

  addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
      return { r, c };
    }
    return null;
  }

  move(direction) {
    const previousBoard = JSON.stringify(this.board);
    this.savePreviousState();

    let moved = false;
    let mergedScore = 0;

    const rotateClockwise = (matrix) => {
      const n = matrix.length;
      const res = Array.from({ length: n }, () => Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          res[j][n - 1 - i] = matrix[i][j];
        }
      }
      return res;
    };

    // Standardize all movements to "left" via matrix rotations
    let rotations = 0;
    if (direction === "up") rotations = 3;
    else if (direction === "right") rotations = 2;
    else if (direction === "down") rotations = 1;

    for (let i = 0; i < rotations; i++) {
      this.board = rotateClockwise(this.board);
    }

    // Process Left Slide & Merge
    for (let r = 0; r < this.size; r++) {
      const row = this.board[r].filter(val => val !== 0);
      const newRow = [];

      for (let i = 0; i < row.length; i++) {
        if (i < row.length - 1 && row[i] === row[i + 1]) {
          const mergedVal = row[i] * 2;
          newRow.push(mergedVal);
          mergedScore += mergedVal;
          if (mergedVal === 2048 && !this.won) {
            this.won = true;
          }
          i++; // Skip paired tile
        } else {
          newRow.push(row[i]);
        }
      }

      while (newRow.length < this.size) {
        newRow.push(0);
      }

      this.board[r] = newRow;
    }

    // Rotate matrix back to original orientation
    const reverseRotations = (4 - rotations) % 4;
    for (let i = 0; i < reverseRotations; i++) {
      this.board = rotateClockwise(this.board);
    }

    moved = previousBoard !== JSON.stringify(this.board);

    if (moved) {
      if (mergedScore > 0) {
        this.updateScore(this.score + mergedScore);
        this.playSound("merge");
      } else {
        this.playSound("slide");
      }

      this.addRandomTile();
      this.render();

      if (this.won && !this.keepPlaying) {
        this.showVictory();
      } else if (this.isGameOver()) {
        this.showGameOver();
      }
    } else {
      // Revert undo state if no movement actually occurred
      this.previousState = null;
      this.updateUndoButton();
    }
  }

  isGameOver() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) return false;
        if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return false;
        if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return false;
      }
    }
    return true;
  }

  showGameOver() {
    this.over = true;
    if (this.gameOverScore) this.gameOverScore.textContent = this.score;
    if (this.gameOverOverlay) this.gameOverOverlay.classList.remove("hidden");
    this.playSound("over");
  }

  showVictory() {
    if (this.victoryScore) this.victoryScore.textContent = this.score;
    if (this.victoryOverlay) this.victoryOverlay.classList.remove("hidden");
    this.playSound("win");
  }

  render() {
    if (!this.tileContainer) return;
    this.tileContainer.innerHTML = "";

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.board[r][c];
        if (val > 0) {
          const tile = document.createElement("div");
          tile.className = "tile";
          tile.dataset.val = val;
          tile.textContent = val;

          // Position tiles via percentage calculation
          tile.style.top = `calc(${r} * (100% - 30px) / 4 + ${r * 10}px)`;
          tile.style.left = `calc(${c} * (100% - 30px) / 4 + ${c * 10}px)`;

          this.tileContainer.appendChild(tile);
        }
      }
    }
  }

  // Web Audio API Synthesis
  playSound(type) {
    if (!this.soundEnabled) return;

    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === "slide") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "merge") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "win") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "over") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // AudioContext unavailable or blocked by autoplay policies
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Quantum2048();
});

  // Guide Modal Listeners
  const rulesBtn = document.getElementById('rules-btn');
  const rulesModal = document.getElementById('rules-modal');
  const closeRulesBtn = document.getElementById('close-rules-btn');
  if (rulesBtn && rulesModal) {
    rulesBtn.addEventListener('click', () => { rulesModal.style.display = 'flex'; });
  }
  if (closeRulesBtn && rulesModal) {
    closeRulesBtn.addEventListener('click', () => { rulesModal.style.display = 'none'; });
  }
