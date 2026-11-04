(() => {
  const gridContainer = document.getElementById('matrix-grid');
  const levelDisplay = document.getElementById('level-val');
  const movesDisplay = document.getElementById('moves-val');
  const scoreDisplay = document.getElementById('score-val');
  const targetDisplay = document.getElementById('target-val');
  const rulesBtn = document.getElementById('how-to-play-btn');
  const closeRulesBtn = document.getElementById('close-rules');
  const rulesConfirmBtn = document.getElementById('rules-confirm-btn');
  const rulesModal = document.getElementById('rules-modal');
  const statusOverlay = document.getElementById('status-overlay');
  const statusTitle = document.getElementById('status-title');
  const statusDesc = document.getElementById('status-desc');
  const statusActionBtn = document.getElementById('status-action-btn');

  // Audio Synth
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  // Particle Types with SVGs
  const PARTICLES = [
    { id: 0, name: 'Quark', color: '#a855f7', stroke: '#c084fc', svg: '<circle cx="12" cy="12" r="8" fill="#a855f7" stroke="#c084fc" stroke-width="2"/>' },
    { id: 1, name: 'Photon', color: '#06b6d4', stroke: '#22d3ee', svg: '<polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" fill="#06b6d4" stroke="#22d3ee" stroke-width="1.5"/>' },
    { id: 2, name: 'Boson', color: '#10b981', stroke: '#34d399', svg: '<rect x="4" y="4" width="16" height="16" rx="3" fill="#10b981" stroke="#34d399" stroke-width="2"/>' },
    { id: 3, name: 'Neutrino', color: '#f59e0b', stroke: '#fbbf24', svg: '<polygon points="12 4 21 19 3 19" fill="#f59e0b" stroke="#fbbf24" stroke-width="2"/>' },
    { id: 4, name: 'Tachyon', color: '#f43f5e', stroke: '#fb7185', svg: '<circle cx="12" cy="12" r="6" fill="#f43f5e"/><line x1="12" y1="2" x2="12" y2="6" stroke="#fb7185" stroke-width="2"/><line x1="12" y1="18" x2="12" y2="22" stroke="#fb7185" stroke-width="2"/>' }
  ];

  const GRID_SIZE = 6;
  let grid = [];
  let selectedTile = null;
  let level = 1;
  let score = 0;
  let movesLeft = 25;
  let targetScore = 500;
  let isProcessing = false;

  function initLevel() {
    targetScore = level * 600;
    movesLeft = 25;
    score = 0;
    updateHUD();
    generateGrid();
  }

  function updateHUD() {
    levelDisplay.textContent = level;
    movesDisplay.textContent = movesLeft;
    scoreDisplay.textContent = score;
    targetDisplay.textContent = targetScore;
  }

  function getRandomParticle() {
    return Math.floor(Math.random() * PARTICLES.length);
  }

  function generateGrid() {
    grid = [];
    gridContainer.innerHTML = '';

    for (let r = 0; r < GRID_SIZE; r++) {
      grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        let type;
        do {
          type = getRandomParticle();
        } while (
          (c >= 2 && grid[r][c - 1] === type && grid[r][c - 2] === type) ||
          (r >= 2 && grid[r - 1][c] === type && grid[r - 2][c] === type)
        );
        grid[r][c] = type;

        const tileEl = document.createElement('button');
        tileEl.className = 'quantum-tile';
        tileEl.dataset.row = r;
        tileEl.dataset.col = c;
        tileEl.setAttribute('aria-label', `Tile at row ${r + 1}, column ${c + 1}`);
        renderTileContent(tileEl, type);
        tileEl.addEventListener('click', () => handleTileClick(r, c, tileEl));
        gridContainer.appendChild(tileEl);
      }
    }
  }

  function renderTileContent(tileEl, type) {
    const p = PARTICLES[type];
    tileEl.innerHTML = `<svg viewBox="0 0 24 24">${p.svg}</svg>`;
  }

  function getTileEl(r, c) {
    return gridContainer.children[r * GRID_SIZE + c];
  }

  function handleTileClick(r, c, el) {
    if (isProcessing || movesLeft <= 0) return;
    initAudio();

    if (!selectedTile) {
      selectedTile = { r, c, el };
      el.classList.add('selected');
      playTone(400, 'sine', 0.05, 0.1);
      return;
    }

    const prevR = selectedTile.r;
    const prevC = selectedTile.c;
    const prevEl = selectedTile.el;
    prevEl.classList.remove('selected');

    // Check adjacency
    const dist = Math.abs(r - prevR) + Math.abs(c - prevC);
    if (dist === 1) {
      swapTiles(prevR, prevC, r, c);
    } else {
      selectedTile = { r, c, el };
      el.classList.add('selected');
      playTone(400, 'sine', 0.05, 0.1);
    }
  }

  async function swapTiles(r1, c1, r2, c2) {
    isProcessing = true;
    selectedTile = null;

    // Perform swap in data
    const temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;

    renderTileContent(getTileEl(r1, c1), grid[r1][c1]);
    renderTileContent(getTileEl(r2, c2), grid[r2][c2]);

    playTone(550, 'triangle', 0.08, 0.15);

    // Check matches
    const matches = findMatches();
    if (matches.length > 0) {
      movesLeft--;
      updateHUD();
      await resolveMatches(matches);
    } else {
      // Revert swap
      const revert = grid[r1][c1];
      grid[r1][c1] = grid[r2][c2];
      grid[r2][c2] = revert;
      renderTileContent(getTileEl(r1, c1), grid[r1][c1]);
      renderTileContent(getTileEl(r2, c2), grid[r2][c2]);
      playTone(220, 'square', 0.15, 0.15);
      isProcessing = false;
    }
  }

  function findMatches() {
    const matchedCoords = new Set();

    // Check rows
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE - 2; c++) {
        const type = grid[r][c];
        if (type !== null && type === grid[r][c + 1] && type === grid[r][c + 2]) {
          matchedCoords.add(`${r},${c}`);
          matchedCoords.add(`${r},${c + 1}`);
          matchedCoords.add(`${r},${c + 2}`);
        }
      }
    }

    // Check cols
    for (let c = 0; c < GRID_SIZE; c++) {
      for (let r = 0; r < GRID_SIZE - 2; r++) {
        const type = grid[r][c];
        if (type !== null && type === grid[r + 1][c] && type === grid[r + 2][c]) {
          matchedCoords.add(`${r},${c}`);
          matchedCoords.add(`${r + 1},${c}`);
          matchedCoords.add(`${r + 2},${c}`);
        }
      }
    }

    return Array.from(matchedCoords).map(coord => {
      const [r, c] = coord.split(',').map(Number);
      return { r, c };
    });
  }

  async function resolveMatches(matches) {
    playTone(780, 'sine', 0.15, 0.2);
    score += matches.length * 30;
    updateHUD();

    // Clear matched cells
    matches.forEach(({ r, c }) => {
      grid[r][c] = null;
      const el = getTileEl(r, c);
      el.style.opacity = '0';
    });

    await new Promise(res => setTimeout(res, 200));

    // Drop down
    for (let c = 0; c < GRID_SIZE; c++) {
      let emptyRow = GRID_SIZE - 1;
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (grid[r][c] !== null) {
          if (r !== emptyRow) {
            grid[emptyRow][c] = grid[r][c];
            grid[r][c] = null;
          }
          emptyRow--;
        }
      }
      // Fill top
      for (let r = emptyRow; r >= 0; r--) {
        grid[r][c] = getRandomParticle();
      }
    }

    // Refresh UI
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const el = getTileEl(r, c);
        renderTileContent(el, grid[r][c]);
        el.style.opacity = '1';
      }
    }

    // Cascade check
    const cascades = findMatches();
    if (cascades.length > 0) {
      await new Promise(res => setTimeout(res, 180));
      await resolveMatches(cascades);
    } else {
      checkGameStatus();
      isProcessing = false;
    }
  }

  function checkGameStatus() {
    if (score >= targetScore) {
      statusTitle.textContent = 'COHERENCE ACHIEVED';
      statusDesc.textContent = `Excellent logic synchronization! Quota reached for Level ${level}.`;
      statusActionBtn.textContent = 'Proceed to Level ' + (level + 1);
      statusOverlay.classList.add('active');
      playTone(880, 'triangle', 0.3, 0.25);
    } else if (movesLeft <= 0) {
      statusTitle.textContent = 'QUANTUM ENTROPY';
      statusDesc.textContent = `Out of moves! Score: ${score} / Target: ${targetScore}`;
      statusActionBtn.textContent = 'Try Again';
      statusOverlay.classList.add('active');
      playTone(180, 'sawtooth', 0.4, 0.25);
    }
  }

  statusActionBtn.addEventListener('click', () => {
    statusOverlay.classList.remove('active');
    if (score >= targetScore) {
      level++;
    }
    initLevel();
  });

  rulesBtn.addEventListener('click', () => rulesModal.classList.add('active'));
  closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('active'));
  rulesConfirmBtn.addEventListener('click', () => rulesModal.classList.remove('active'));

  initLevel();
})();
