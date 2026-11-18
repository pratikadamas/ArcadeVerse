/**
 * Whack-A-Bug Developer Panic
 * Pure Vanilla JavaScript reaction reflex arcade
 */

(() => {
  const serverRack = document.getElementById("server-rack");
  const scoreDisplay = document.getElementById("score-display");
  const tempDisplay = document.getElementById("temp-display");
  const tempBarFill = document.getElementById("temp-bar-fill");
  const bestScoreEl = document.getElementById("best-score");

  const startOverlay = document.getElementById("start-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  const finalScoreEl = document.getElementById("final-score");
  const finalComboEl = document.getElementById("final-combo");
  const finalBestEl = document.getElementById("final-best");

  const rulesBtn = document.getElementById("rules-btn");
  const closeRulesBtn = document.getElementById("close-rules-btn");
  const rulesModal = document.getElementById("rules-modal");

  const BUG_TYPES = [
    {
      type: "syntax",
      iconSvg: '<svg class="bug-svg bug-syntax-svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/></svg>',
      points: 10,
      cooling: 2,
      duration: 1100
    },
    {
      type: "nullpointer",
      iconSvg: '<svg class="bug-svg bug-null-svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>',
      points: 25,
      cooling: 4,
      duration: 900
    },
    {
      type: "golden",
      iconSvg: '<svg class="bug-svg bug-golden-svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      points: 50,
      cooling: 10,
      duration: 750
    },
    {
      type: "firewall",
      iconSvg: '<svg class="bug-svg bug-firewall-svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      points: -20,
      cooling: -15,
      duration: 1200
    }
  ];

  let score = 0;
  let incidentLevel = 1;
  const levelDisplay = document.getElementById('level-display');
  let combo = 0;
  let maxCombo = 0;
  let cpuTemp = 45;
  let isPlaying = false;
  let slots = [];
  let spawnInterval = null;
  let heatInterval = null;
  let bestScore = 0;
  try {
    bestScore = parseInt(localStorage.getItem("arcadeverse_whack_bug_best") || "0", 10) || 0;
  } catch (e) {
    bestScore = 0;
  }

  bestScoreEl.textContent = bestScore;

  function initRack() {
    serverRack.innerHTML = "";
    slots = [];

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement("div");
      slot.className = "rack-slot";
      slot.dataset.index = i;
      slot.setAttribute("role", "button");
      slot.setAttribute("tabindex", "0");
      slot.setAttribute("aria-label", `Server rack slot ${i + 1}`);

      slot.addEventListener("pointerdown", () => handleSlotClick(i));
      slot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSlotClick(i);
        }
      });
      serverRack.appendChild(slot);
      slots.push({ element: slot, activeBug: null, timer: null });
    }
  }

  function updateHUD() {
    scoreDisplay.textContent = score;
    tempDisplay.textContent = `${Math.round(cpuTemp)}°C`;
    tempBarFill.style.width = `${Math.min(100, Math.max(0, cpuTemp))}%`;

    if (cpuTemp > 80) tempDisplay.style.color = "#ef4444";
    else if (cpuTemp > 60) tempDisplay.style.color = "#f59e0b";
    else tempDisplay.style.color = "#10b981";

    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      try {
        localStorage.setItem("arcadeverse_whack_bug_best", bestScore);
      } catch (e) {}
    }
  }

  function spawnBug() {
    if (!isPlaying) return;

    // Find available slots
    const available = slots.filter(s => !s.activeBug);
    if (available.length === 0) return;

    const randomSlot = available[Math.floor(Math.random() * available.length)];

    // Weighted random bug selection
    const rand = Math.random();
    let bugType;
    if (rand < 0.55) bugType = BUG_TYPES[0]; // Syntax Error
    else if (rand < 0.80) bugType = BUG_TYPES[1]; // Memory Leak
    else if (rand < 0.90) bugType = BUG_TYPES[2]; // Golden Patch
    else bugType = BUG_TYPES[3]; // Firewall Trap

    const bugEl = document.createElement("div");
    bugEl.className = "bug-entity";
    bugEl.innerHTML = bugType.iconSvg;

    randomSlot.element.appendChild(bugEl);
    randomSlot.activeBug = bugType;
    randomSlot.isHit = false; // Flag to prevent multi-touch double count (#670)

    const duration = Math.max(550, bugType.duration - Math.min(400, score * 3));
    randomSlot.timer = setTimeout(() => {
      clearSlot(randomSlot);
    }, duration);
  }

  function clearSlot(slot) {
    if (slot.activeBug) {
      slot.element.innerHTML = "";
      slot.activeBug = null;
      slot.isHit = false;
      if (slot.timer) {
        clearTimeout(slot.timer);
        slot.timer = null;
      }
    }
  }

  function showWhackEffect(slotEl, text, isPenalty) {
    const fx = document.createElement("div");
    fx.className = "whack-effect";
    fx.textContent = text;
    if (isPenalty) fx.style.color = "#ef4444";
    slotEl.appendChild(fx);
    setTimeout(() => fx.remove(), 400);
  }

  function handleSlotClick(index) {
    if (!isPlaying) return;
    const slot = slots[index];

    // Debounce guard: prevent simultaneous multi-touch pointers double-counting hits (#670)
    const now = Date.now();
    if (slot.lastWhackTime && now - slot.lastWhackTime < 300) {
      return;
    }

    if (slot.activeBug && !slot.isHit) {
      slot.isHit = true;
      slot.lastWhackTime = now;
      const bug = slot.activeBug;

      // Visual squish animation feedback immediately on first registered hit (#670)
      const bugEntity = slot.element.querySelector('.bug-entity');
      if (bugEntity) {
        bugEntity.style.transform = 'scale(0.7) rotate(15deg)';
        bugEntity.style.transition = 'transform 0.1s ease';
      }

      clearSlot(slot);

      if (bug.type === "firewall") {
        // Penalty!
        combo = 0;
        cpuTemp = Math.min(100, cpuTemp - bug.cooling); // heats up!
        score = Math.max(0, score + bug.points);
        showWhackEffect(slot.element, "BLOCKED! +15°C", true);
      } else {
        // Successful Whack!
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        score += bug.points;
        cpuTemp = Math.max(25, cpuTemp - bug.cooling);
        showWhackEffect(slot.element, `+${bug.points}`, false);
      }

      updateHUD();
      if (cpuTemp >= 100) gameOver();
    } else {
      // Miss click slightly increases temp
      cpuTemp = Math.min(100, cpuTemp + 1.5);
      updateHUD();
      if (cpuTemp >= 100) gameOver();
    }
  }

  function gameOver() {
    isPlaying = false;
    clearInterval(spawnInterval);
    clearInterval(heatInterval);
    slots.forEach(s => clearSlot(s));

    finalScoreEl.textContent = score;
    finalComboEl.textContent = `${maxCombo}x`;
    finalBestEl.textContent = bestScore;

    setTimeout(() => {
      gameoverOverlay.classList.add("active");
    }, 600);
  }

  function initGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    cpuTemp = 45;
    isPlaying = true;

    slots.forEach(s => clearSlot(s));
    updateHUD();

    startOverlay.classList.remove("active");
    gameoverOverlay.classList.remove("active");

    if (spawnInterval) clearInterval(spawnInterval);
    if (heatInterval) clearInterval(heatInterval);

    spawnInterval = setInterval(spawnBug, 750);

    // Passive CPU temperature climb
    heatInterval = setInterval(() => {
      if (!isPlaying) return;
      cpuTemp += 1.8;
      updateHUD();
      if (cpuTemp >= 100) gameOver();
    }, 1000);
  }

  // Global Keyboard Controls (1-9 or QWE/ASD/ZXC, Space/Enter to Start/Restart)
  window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "Enter") && !isPlaying) {
      e.preventDefault();
      initGame();
      return;
    }
    if (e.code === "Escape") {
      if (rulesModal && rulesModal.classList.contains("active")) {
        rulesModal.classList.remove("active");
      }
      return;
    }
    if (!isPlaying) return;

    // Number keys 1-9
    const num = parseInt(e.key, 10);
    let slotIdx = -1;
    if (num >= 1 && num <= 9) {
      slotIdx = num - 1;
    } else {
      const keyMap = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8 };
      if (keyMap[e.code] !== undefined) slotIdx = keyMap[e.code];
    }
    if (slotIdx >= 0 && slotIdx < slots.length) {
      e.preventDefault();
      whack(slots[slotIdx]);
    }
  });

  startBtn.addEventListener("click", initGame);
  restartBtn.addEventListener("click", initGame);

  // Modal Handlers
  rulesBtn.addEventListener("click", () => rulesModal.classList.add("active"));
  closeRulesBtn.addEventListener("click", () => rulesModal.classList.remove("active"));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) rulesModal.classList.remove("active");
  });

  initRack();
  updateHUD();
})();
