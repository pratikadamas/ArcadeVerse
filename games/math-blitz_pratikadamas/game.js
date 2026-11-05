/**
 * Math Blitz: 60-Second Fast-Paced Arithmetic Sprint
 * Pure Vanilla JavaScript implementation for ArcadeVerse.
 * Author: Pratik Giri (@pratikadamas)
 */

(() => {
  "use strict";

  // ========================================================
  // 1. Algorithmic Math Generator Utility (mathGenerator.js)
  // ========================================================
  class MathGenerator {
    /**
     * Generates a random integer within [min, max] inclusive.
     */
    static randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Evaluates a mathematical token expression safely without eval.
     * Respects standard operator precedence: multiplication/division first, then addition/subtraction.
     */
    static evaluate(expr) {
      if (typeof expr !== "string" || !expr.trim()) return NaN;

      // Tokenize expression (numbers and operators +, -, *, /)
      const cleanExpr = expr.trim();
      const tokens = cleanExpr.match(/(\d+|\+|-|\*|\/)/g);
      if (!tokens) return NaN;

      // First pass: Handle multiplication and division (left-to-right)
      const intermediate = [];
      let i = 0;
      while (i < tokens.length) {
        const token = tokens[i];
        if (token === "*" || token === "/") {
          const prev = intermediate.pop();
          const next = parseInt(tokens[i + 1], 10);
          if (isNaN(prev) || isNaN(next)) return NaN;

          if (token === "*") {
            intermediate.push(prev * next);
          } else {
            if (next === 0 || prev % next !== 0) return NaN; // Enforce no div-by-zero & integer division
            intermediate.push(Math.trunc(prev / next));
          }
          i += 2;
        } else if (/^\d+$/.test(token)) {
          intermediate.push(parseInt(token, 10));
          i++;
        } else {
          intermediate.push(token);
          i++;
        }
      }

      // Second pass: Handle addition and subtraction (left-to-right)
      let result = intermediate[0];
      if (typeof result !== "number" || isNaN(result)) return NaN;

      let j = 1;
      while (j < intermediate.length) {
        const op = intermediate[j];
        const nextVal = intermediate[j + 1];
        if (typeof nextVal !== "number" || isNaN(nextVal)) return NaN;

        if (op === "+") {
          result += nextVal;
        } else if (op === "-") {
          result -= nextVal;
        } else {
          return NaN;
        }
        j += 2;
      }

      return Number.isInteger(result) ? result : NaN;
    }

    /**
     * Generates a single valid infix arithmetic equation.
     * Enforces:
     * - Length of at least 6 characters (e.g. 12+52, 45/9+3, 87-20).
     * - Operators: +, -, *, /
     * - Division strictly yields integers with no remainder (a % b === 0).
     * - No division by zero.
     * - Integer answer.
     */
    static generateQuestion() {
      const templates = [
        "add",
        "sub",
        "mul",
        "div",
        "div_add",
        "div_sub",
        "mul_add",
        "mul_sub",
        "add_mul",
        "sub_div"
      ];

      for (let attempt = 0; attempt < 50; attempt++) {
        const type = templates[this.randInt(0, templates.length - 1)];
        let equation = "";
        let expectedAnswer = 0;

        switch (type) {
          case "add": {
            // e.g. 12 + 52 -> length 7
            const a = this.randInt(12, 89);
            const b = this.randInt(12, 89);
            equation = `${a} + ${b}`;
            expectedAnswer = a + b;
            break;
          }

          case "sub": {
            // e.g. 87 - 20 -> length 7
            const a = this.randInt(35, 99);
            const b = this.randInt(12, a - 5);
            equation = `${a} - ${b}`;
            expectedAnswer = a - b;
            break;
          }

          case "mul": {
            // e.g. 12 * 14 -> length 7
            const a = this.randInt(11, 24);
            const b = this.randInt(4, 15);
            equation = `${a} * ${b}`;
            expectedAnswer = a * b;
            break;
          }

          case "div": {
            // e.g. 144 / 12 -> length 8
            const b = this.randInt(3, 16);
            const q = this.randInt(4, 25);
            const a = b * q;
            equation = `${a} / ${b}`;
            expectedAnswer = q;
            break;
          }

          case "div_add": {
            // e.g. 45 / 9 + 3 -> length 10
            const b = this.randInt(3, 12);
            const q = this.randInt(3, 15);
            const a = b * q;
            const c = this.randInt(5, 50);
            equation = `${a} / ${b} + ${c}`;
            expectedAnswer = q + c;
            break;
          }

          case "div_sub": {
            // e.g. 72 / 8 - 4 -> length 10
            const b = this.randInt(3, 12);
            const q = this.randInt(8, 25);
            const a = b * q;
            const c = this.randInt(2, q - 1);
            equation = `${a} / ${b} - ${c}`;
            expectedAnswer = q - c;
            break;
          }

          case "mul_add": {
            // e.g. 12 * 4 + 15 -> length 11
            const a = this.randInt(4, 15);
            const b = this.randInt(3, 12);
            const c = this.randInt(10, 50);
            equation = `${a} * ${b} + ${c}`;
            expectedAnswer = a * b + c;
            break;
          }

          case "mul_sub": {
            // e.g. 15 * 4 - 25 -> length 11
            const a = this.randInt(5, 15);
            const b = this.randInt(4, 12);
            const c = this.randInt(5, a * b - 5);
            equation = `${a} * ${b} - ${c}`;
            expectedAnswer = a * b - c;
            break;
          }

          case "add_mul": {
            // e.g. 18 + 7 * 6 -> length 10
            const a = this.randInt(10, 50);
            const b = this.randInt(3, 9);
            const c = this.randInt(3, 9);
            equation = `${a} + ${b} * ${c}`;
            expectedAnswer = a + b * c;
            break;
          }

          case "sub_div": {
            // e.g. 80 - 48 / 6 -> length 11
            const c = this.randInt(3, 12);
            const q = this.randInt(3, 12);
            const b = c * q;
            const a = this.randInt(q + 10, 80);
            equation = `${a} - ${b} / ${c}`;
            expectedAnswer = a - q;
            break;
          }
        }

        // Validate constraint: Length of at least 6 characters
        if (equation.length >= 6 && Number.isInteger(expectedAnswer)) {
          return {
            equation,
            answer: expectedAnswer,
            length: equation.length,
            rawEquation: equation.replace(/\s+/g, "")
          };
        }
      }

      // Safe fallback guaranteed >= 6 chars with integer division
      return {
        equation: "45 / 9 + 3",
        answer: 8,
        length: 10,
        rawEquation: "45/9+3"
      };
    }

    /**
     * Generates a full session of N unique questions.
     */
    static generateSession(count = 10) {
      const list = [];
      const seen = new Set();

      while (list.length < count) {
        const q = this.generateQuestion();
        if (!seen.has(q.equation)) {
          seen.add(q.equation);
          list.push(q);
        }
      }

      return list;
    }
  }

  // Expose MathGenerator globally for automated tests and sandbox verification
  if (typeof window !== "undefined") {
    window.MathGenerator = MathGenerator;
  }

  // ========================================================
  // 2. Synthesized Web Audio Sound Controller
  // ========================================================
  class SoundController {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.isMuted = false;
      this.volume = 0.25;
      this.initSettings();
    }

    initSettings() {
      try {
        const savedMute = localStorage.getItem("arcadeverse_muted");
        if (savedMute !== null) {
          this.isMuted = savedMute === "true";
        }
        const savedVol = parseFloat(localStorage.getItem("arcadeverse_master_volume"));
        if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
          this.volume = savedVol;
        }
      } catch (_) {}
    }

    ensureContext() {
      if (this.ctx) return true;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        return true;
      } catch (_) {
        return false;
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      try {
        localStorage.setItem("arcadeverse_muted", String(this.isMuted));
      } catch (_) {}

      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      }
      return this.isMuted;
    }

    setMuted(muted) {
      this.isMuted = Boolean(muted);
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      }
    }

    setVolume(vol) {
      if (typeof vol === "number" && vol >= 0 && vol <= 1) {
        this.volume = vol;
        if (this.masterGain && this.ctx && !this.isMuted) {
          this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
      }
    }

    playTone(frequency, type, duration, gainVal = 0.2) {
      if (this.isMuted || !this.ensureContext()) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }

      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + duration);
      } catch (_) {}
    }

    tick() {
      this.playTone(880, "sine", 0.05, 0.15);
    }

    correct() {
      if (this.isMuted || !this.ensureContext()) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 chord
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            this.playTone(freq, "triangle", 0.12, 0.18);
          }, idx * 45);
        });
      } catch (_) {}
    }

    wrong() {
      if (this.isMuted || !this.ensureContext()) return;
      try {
        this.playTone(180, "sawtooth", 0.18, 0.22);
        setTimeout(() => {
          this.playTone(140, "sawtooth", 0.22, 0.22);
        }, 120);
      } catch (_) {}
    }

    complete() {
      if (this.isMuted || !this.ensureContext()) return;
      try {
        const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        fanfare.forEach((freq, idx) => {
          setTimeout(() => {
            this.playTone(freq, "sine", 0.25, 0.2);
          }, idx * 75);
        });
      } catch (_) {}
    }

    teardown() {
      if (this.ctx && typeof this.ctx.close === "function") {
        this.ctx.close().catch(() => {});
        this.ctx = null;
      }
    }
  }

  // ========================================================
  // 3. Core Math Blitz Game Session Controller
  // ========================================================
  class MathBlitzGame {
    constructor() {
      this.TOTAL_QUESTIONS = 10;
      this.SESSION_TIME_LIMIT = 60; // 60 seconds

      this.sound = new SoundController();

      // State variables
      this.questions = [];
      this.currentIndex = 0;
      this.score = 0;
      this.streak = 0;
      this.maxStreak = 0;
      this.userAnswers = []; // Records { equation, userAnswer, correctAnswer, isCorrect, timeSpent }

      this.timeRemaining = this.SESSION_TIME_LIMIT;
      this.timerInterval = null;
      this.startTime = 0;
      this.questionStartTime = 0;
      this.isPlaying = false;
      this.isPaused = false;

      // Cache DOM elements
      this.dom = {
        timerText: document.getElementById("timer-text"),
        timerProgressBar: document.getElementById("timer-progress-bar"),
        timerBox: document.getElementById("timer-box"),
        questionCounter: document.getElementById("question-counter"),
        scoreCounter: document.getElementById("score-counter"),
        streakCounter: document.getElementById("streak-counter"),
        progressSteps: document.getElementById("progress-steps"),
        equationDisplay: document.getElementById("equation-display"),
        answerForm: document.getElementById("answer-form"),
        answerInput: document.getElementById("answer-input"),
        submitBtn: document.getElementById("submit-btn"),
        feedbackPill: document.getElementById("feedback-pill"),
        feedbackText: document.getElementById("feedback-text"),
        arenaCard: document.getElementById("arena-card"),
        keypad: document.getElementById("keypad"),

        // Modals
        modalGameOver: document.getElementById("modal-gameover"),
        modalHowTo: document.getElementById("modal-howto"),
        finalScoreText: document.getElementById("final-score-text"),
        finalRatingBadge: document.getElementById("final-rating-badge"),
        metricAccuracy: document.getElementById("metric-accuracy"),
        metricTime: document.getElementById("metric-time"),
        metricStreak: document.getElementById("metric-streak"),
        metricSpeed: document.getElementById("metric-speed"),
        reviewTableBody: document.getElementById("review-table-body"),

        // Header Buttons
        btnHowTo: document.getElementById("btn-howto"),
        btnSound: document.getElementById("btn-sound"),
        btnRestart: document.getElementById("btn-restart"),
        btnPlayAgain: document.getElementById("btn-play-again"),
        btnCloseHowTo: document.getElementById("btn-close-howto"),
        btnGotIt: document.getElementById("btn-got-it"),

        soundIconOn: document.getElementById("sound-icon-on"),
        soundIconOff: document.getElementById("sound-icon-off")
      };

      this.initEvents();
      this.initSoundIcons();
      this.startSprint();
    }

    initSoundIcons() {
      if (this.sound.isMuted) {
        this.dom.soundIconOn.classList.add("hidden");
        this.dom.soundIconOff.classList.remove("hidden");
      } else {
        this.dom.soundIconOn.classList.remove("hidden");
        this.dom.soundIconOff.classList.add("hidden");
      }
    }

    initEvents() {
      // Form submit handler for numeric entry
      this.dom.answerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmitAnswer();
      });

      // Keypad interaction handler
      this.dom.keypad.addEventListener("click", (e) => {
        const target = e.target.closest("button");
        if (!target) return;

        const key = target.getAttribute("data-key");
        const action = target.getAttribute("data-action");

        if (key !== null) {
          this.handleKeypadInput(key);
        } else if (action === "backspace") {
          this.handleBackspace();
        } else if (action === "clear") {
          this.handleClear();
        } else if (action === "submit") {
          this.handleSubmitAnswer();
        }
      });

      // Header button handlers
      this.dom.btnHowTo.addEventListener("click", () => this.openHowToModal());
      this.dom.btnCloseHowTo.addEventListener("click", () => this.closeHowToModal());
      this.dom.btnGotIt.addEventListener("click", () => this.closeHowToModal());

      this.dom.btnSound.addEventListener("click", () => {
        const isMuted = this.sound.toggleMute();
        this.dom.soundIconOn.classList.toggle("hidden", isMuted);
        this.dom.soundIconOff.classList.toggle("hidden", !isMuted);
      });

      this.dom.btnRestart.addEventListener("click", () => this.startSprint());
      this.dom.btnPlayAgain.addEventListener("click", () => {
        this.dom.modalGameOver.classList.add("hidden");
        this.startSprint();
      });

      // Keyboard shortcuts
      window.addEventListener("keydown", (e) => {
        // Escape closes modals
        if (e.key === "Escape") {
          if (!this.dom.modalHowTo.classList.contains("hidden")) {
            this.closeHowToModal();
          }
        }
      });

      // Maintain input autofocus when clicking outside on desktop
      this.dom.arenaCard.addEventListener("click", (e) => {
        if (!e.target.closest("button") && this.isPlaying) {
          this.refocusInput();
        }
      });

      // ArcadeVerse Platform Lifecycle Events
      window.addEventListener("message", (e) => {
        if (!e || !e.data) return;
        switch (e.data.type) {
          case "ARCADEVERSE_PAUSE":
            this.pauseSprint();
            break;
          case "ARCADEVERSE_RESUME":
            this.resumeSprint();
            break;
          case "ARCADEVERSE_TEARDOWN":
            this.teardown();
            break;
          case "ARCADEVERSE_AUDIO_CONFIG":
            if (typeof e.data.muted === "boolean") {
              this.sound.setMuted(e.data.muted);
              this.initSoundIcons();
            }
            if (typeof e.data.volume === "number") {
              this.sound.setVolume(e.data.volume);
            }
            break;
        }
      });
    }

    startSprint() {
      // Clear previous intervals
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      // Reset state
      this.questions = MathGenerator.generateSession(this.TOTAL_QUESTIONS);
      this.currentIndex = 0;
      this.score = 0;
      this.streak = 0;
      this.maxStreak = 0;
      this.userAnswers = [];
      this.timeRemaining = this.SESSION_TIME_LIMIT;
      this.isPlaying = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.questionStartTime = Date.now();

      // Reset UI elements
      this.dom.modalGameOver.classList.add("hidden");
      this.dom.modalHowTo.classList.add("hidden");
      this.dom.scoreCounter.textContent = `0 / ${this.TOTAL_QUESTIONS}`;
      this.dom.streakCounter.textContent = "0";
      this.dom.timerText.textContent = "60";
      this.dom.timerProgressBar.style.width = "100%";
      this.dom.timerBox.classList.remove("timer-warning", "timer-danger");

      this.renderProgressDots();
      this.displayCurrentQuestion();
      this.setFeedback("Sprint started! 60s on the clock.", "");

      // Start 60-second countdown interval
      this.startCountdownTimer();
      this.refocusInput();
    }

    startCountdownTimer() {
      const startStamp = Date.now();
      const initialRemaining = this.timeRemaining;

      this.timerInterval = setInterval(() => {
        if (this.isPaused || !this.isPlaying) return;

        const elapsed = Math.floor((Date.now() - startStamp) / 1000);
        this.timeRemaining = Math.max(0, initialRemaining - elapsed);

        // Update timer HUD
        this.dom.timerText.textContent = String(this.timeRemaining);
        const percent = Math.max(0, (this.timeRemaining / this.SESSION_TIME_LIMIT) * 100);
        this.dom.timerProgressBar.style.width = `${percent}%`;

        // Warning and Danger thresholds
        if (this.timeRemaining <= 10) {
          this.dom.timerBox.classList.remove("timer-warning");
          this.dom.timerBox.classList.add("timer-danger");
          this.sound.tick();
        } else if (this.timeRemaining <= 20) {
          this.dom.timerBox.classList.add("timer-warning");
          this.dom.timerBox.classList.remove("timer-danger");
        } else {
          this.dom.timerBox.classList.remove("timer-warning", "timer-danger");
        }

        // Time expired condition
        if (this.timeRemaining <= 0) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          this.finishSprint(true);
        }
      }, 250);
    }

    renderProgressDots() {
      this.dom.progressSteps.innerHTML = "";
      for (let i = 0; i < this.TOTAL_QUESTIONS; i++) {
        const dot = document.createElement("div");
        dot.className = "step-dot";
        dot.id = `step-dot-${i}`;
        if (i === 0) dot.classList.add("active");
        this.dom.progressSteps.appendChild(dot);
      }
    }

    displayCurrentQuestion() {
      if (this.currentIndex >= this.TOTAL_QUESTIONS) {
        this.finishSprint(false);
        return;
      }

      const q = this.questions[this.currentIndex];
      this.dom.equationDisplay.textContent = q.equation;
      this.dom.questionCounter.textContent = `${this.currentIndex + 1} / ${this.TOTAL_QUESTIONS}`;

      // Update step dot active state
      for (let i = 0; i < this.TOTAL_QUESTIONS; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        if (dot) {
          if (i === this.currentIndex) {
            dot.classList.add("active");
          } else {
            dot.classList.remove("active");
          }
        }
      }

      this.dom.answerInput.value = "";
      this.questionStartTime = Date.now();
      this.refocusInput();
    }

    handleSubmitAnswer() {
      if (!this.isPlaying) return;

      const rawVal = this.dom.answerInput.value.trim();
      if (rawVal === "") {
        this.setFeedback("Please enter a number!", "wrong");
        this.triggerShake();
        this.refocusInput();
        return;
      }

      const parsedUserAnswer = parseInt(rawVal, 10);
      if (isNaN(parsedUserAnswer)) {
        this.setFeedback("Invalid numeric value!", "wrong");
        this.triggerShake();
        this.refocusInput();
        return;
      }

      const currentQ = this.questions[this.currentIndex];
      const isCorrect = parsedUserAnswer === currentQ.answer;
      const timeSpent = Math.max(0.1, (Date.now() - this.questionStartTime) / 1000);

      // Record answer
      this.userAnswers.push({
        equation: currentQ.equation,
        userAnswer: parsedUserAnswer,
        correctAnswer: currentQ.answer,
        isCorrect: isCorrect,
        timeSpent: parseFloat(timeSpent.toFixed(1))
      });

      // Update dot style
      const dot = document.getElementById(`step-dot-${this.currentIndex}`);
      if (dot) {
        dot.classList.remove("active");
        dot.classList.add(isCorrect ? "correct" : "wrong");
      }

      // Update score and feedback
      if (isCorrect) {
        this.score++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;
        this.sound.correct();
        this.setFeedback(`Correct! ${currentQ.equation} = ${currentQ.answer}`, "correct");
      } else {
        this.streak = 0;
        this.sound.wrong();
        this.setFeedback(`Incorrect! ${currentQ.equation} = ${currentQ.answer}`, "wrong");
        this.triggerShake();
      }

      this.dom.scoreCounter.textContent = `${this.score} / ${this.TOTAL_QUESTIONS}`;
      this.dom.streakCounter.textContent = String(this.streak);

      this.currentIndex++;
      if (this.currentIndex >= this.TOTAL_QUESTIONS) {
        this.finishSprint(false);
      } else {
        this.displayCurrentQuestion();
      }
    }

    handleKeypadInput(digit) {
      if (!this.isPlaying) return;
      if (digit === "-") {
        if (!this.dom.answerInput.value.startsWith("-")) {
          this.dom.answerInput.value = "-" + this.dom.answerInput.value;
        } else {
          this.dom.answerInput.value = this.dom.answerInput.value.substring(1);
        }
      } else {
        this.dom.answerInput.value += digit;
      }
      this.refocusInput();
    }

    handleBackspace() {
      if (!this.isPlaying) return;
      this.dom.answerInput.value = this.dom.answerInput.value.slice(0, -1);
      this.refocusInput();
    }

    handleClear() {
      if (!this.isPlaying) return;
      this.dom.answerInput.value = "";
      this.refocusInput();
    }

    setFeedback(text, type = "") {
      this.dom.feedbackText.textContent = text;
      this.dom.feedbackPill.classList.remove("feedback-correct", "feedback-wrong");
      if (type === "correct") {
        this.dom.feedbackPill.classList.add("feedback-correct");
      } else if (type === "wrong") {
        this.dom.feedbackPill.classList.add("feedback-wrong");
      }
    }

    triggerShake() {
      this.dom.arenaCard.classList.remove("shake-anim");
      // Trigger reflow to restart CSS animation
      void this.dom.arenaCard.offsetWidth;
      this.dom.arenaCard.classList.add("shake-anim");
    }

    refocusInput() {
      try {
        this.dom.answerInput.focus();
      } catch (_) {}
    }

    finishSprint(isTimedOut = false) {
      this.isPlaying = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      // Record any uncompleted questions if timed out
      while (this.userAnswers.length < this.TOTAL_QUESTIONS) {
        const idx = this.userAnswers.length;
        const q = this.questions[idx];
        this.userAnswers.push({
          equation: q.equation,
          userAnswer: "--",
          correctAnswer: q.answer,
          isCorrect: false,
          timeSpent: 0
        });

        const dot = document.getElementById(`step-dot-${idx}`);
        if (dot) {
          dot.classList.remove("active");
          dot.classList.add("wrong");
        }
      }

      this.sound.complete();

      // Calculate statistics
      const totalTimeSpent = Math.min(
        this.SESSION_TIME_LIMIT,
        Math.max(1, Math.floor((Date.now() - this.startTime) / 1000))
      );
      const accuracyPercent = Math.round((this.score / this.TOTAL_QUESTIONS) * 100);
      const avgSpeed = (totalTimeSpent / Math.max(1, this.userAnswers.filter(a => a.userAnswer !== "--").length)).toFixed(1);

      // Render End Screen values
      this.dom.finalScoreText.textContent = `${this.score} / ${this.TOTAL_QUESTIONS}`;
      this.dom.metricAccuracy.textContent = `${accuracyPercent}%`;
      this.dom.metricTime.textContent = `${totalTimeSpent}s`;
      this.dom.metricStreak.textContent = String(this.maxStreak);
      this.dom.metricSpeed.textContent = `${avgSpeed}s / Q`;

      // Rating badge evaluation
      let ratingText = "Math Explorer";
      if (this.score === 10) {
        ratingText = "Math Grandmaster! Perfect!";
      } else if (this.score >= 8) {
        ratingText = "Lightning Calculator! Outstanding!";
      } else if (this.score >= 6) {
        ratingText = "Speed Analyst! Good Job!";
      } else if (this.score >= 4) {
        ratingText = "Sharp Thinker! Keep Practicing!";
      } else {
        ratingText = "Sprint Completed! Try Again!";
      }
      this.dom.finalRatingBadge.textContent = ratingText;

      // Populate review breakdown table
      this.dom.reviewTableBody.innerHTML = "";
      this.userAnswers.forEach((item, index) => {
        const tr = document.createElement("tr");

        const statusIcon = item.isCorrect
          ? `<span class="status-badge status-pass">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
               PASS
             </span>`
          : `<span class="status-badge status-fail">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               FAIL
             </span>`;

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td><code>${item.equation}</code></td>
          <td>${item.userAnswer}</td>
          <td><strong>${item.correctAnswer}</strong></td>
          <td>${statusIcon}</td>
        `;
        this.dom.reviewTableBody.appendChild(tr);
      });

      // Show End Screen modal
      this.dom.modalGameOver.classList.remove("hidden");

      // Notify ArcadeVerse platform host
      try {
        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_SCORE",
          score: this.score,
          maxScore: this.TOTAL_QUESTIONS
        }, "*");

        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_OVER",
          score: this.score,
          maxScore: this.TOTAL_QUESTIONS,
          accuracy: accuracyPercent,
          timeSpent: totalTimeSpent
        }, "*");
      } catch (_) {}
    }

    pauseSprint() {
      this.isPaused = true;
    }

    resumeSprint() {
      this.isPaused = false;
      this.refocusInput();
    }

    openHowToModal() {
      this.pauseSprint();
      this.dom.modalHowTo.classList.remove("hidden");
    }

    closeHowToModal() {
      this.dom.modalHowTo.classList.add("hidden");
      this.resumeSprint();
    }

    teardown() {
      this.isPlaying = false;
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.sound.teardown();
    }
  }

  // Auto-boot on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new MathBlitzGame();
    });
  } else {
    new MathBlitzGame();
  }
})();

