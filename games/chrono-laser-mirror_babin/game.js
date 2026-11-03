(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const levelDisplay = document.getElementById('level-val');
  const statusDisplay = document.getElementById('status-val');
  const movesDisplay = document.getElementById('moves-val');
  const bestDisplay = document.getElementById('best-val');
  const completeOverlay = document.getElementById('complete-overlay');
  const nextLevelBtn = document.getElementById('next-level-btn');
  const resetLevelBtn = document.getElementById('reset-level-btn');
  const rulesBtn = document.getElementById('how-to-play-btn');
  const closeRulesBtn = document.getElementById('close-rules');
  const rulesConfirmBtn = document.getElementById('rules-confirm-btn');
  const rulesModal = document.getElementById('rules-modal');

  // Web Audio Synth
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.12, gainVal = 0.18) {
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

  // State
  let currentLevel = 1;
  let rotations = 0;
  let isLevelComplete = false;
  let bestLevel = parseInt(localStorage.getItem('chrono_laser_best') || '1', 10);
  bestDisplay.textContent = `LEVEL ${bestLevel}`;

  const GRID_SIZE = 5;
  const CELL_SIZE = 600 / GRID_SIZE; // 120px

  // Levels Configuration
  // Mirrors: orientation 0: / (angles: dx=1->dy=-1), 1: \ (dx=1->dy=1)
  const LEVELS = [
    {
      laser: { r: 0, c: 0, dir: 'right' },
      target: { r: 4, c: 4 },
      mirrors: [
        { r: 0, c: 4, angle: 1 }, // '\' deflects right to down
        { r: 4, c: 2, angle: 0 },
        { r: 2, c: 4, angle: 0 }
      ]
    },
    {
      laser: { r: 1, c: 0, dir: 'right' },
      target: { r: 3, c: 4 },
      mirrors: [
        { r: 1, c: 2, angle: 0 }, // '/' deflects right to up
        { r: 0, c: 2, angle: 1 }, // '\' deflects up to right
        { r: 0, c: 4, angle: 1 }, // '\' deflects right to down
        { r: 3, c: 2, angle: 0 }
      ]
    },
    {
      laser: { r: 4, c: 0, dir: 'right' },
      target: { r: 0, c: 3 },
      mirrors: [
        { r: 4, c: 3, angle: 0 },
        { r: 2, c: 3, angle: 1 },
        { r: 2, c: 1, angle: 0 },
        { r: 0, c: 1, angle: 1 }
      ]
    }
  ];

  let currentLevelData = null;
  let mirrorsState = [];
  let beamPath = [];

  function loadLevel(lvlNum) {
    const configIndex = (lvlNum - 1) % LEVELS.length;
    currentLevelData = LEVELS[configIndex];
    mirrorsState = currentLevelData.mirrors.map(m => ({ ...m }));
    rotations = 0;
    isLevelComplete = false;
    completeOverlay.classList.remove('active');
    updateHUD();
    computeBeam();
  }

  function updateHUD() {
    levelDisplay.textContent = currentLevel;
    movesDisplay.textContent = rotations;
    statusDisplay.textContent = isLevelComplete ? 'CHARGED' : 'ALIGNING';
    statusDisplay.style.color = isLevelComplete ? '#10b981' : '#06b6d4';
  }

  function computeBeam() {
    beamPath = [];
    const laser = currentLevelData.laser;
    let currR = laser.r;
    let currC = laser.c;
    let dir = laser.dir;

    let startX = currC * CELL_SIZE + CELL_SIZE / 2;
    let startY = currR * CELL_SIZE + CELL_SIZE / 2;
    beamPath.push({ x: startX, y: startY });

    let steps = 0;
    const maxSteps = 24;

    while (steps < maxSteps) {
      steps++;
      if (dir === 'right') currC++;
      else if (dir === 'left') currC--;
      else if (dir === 'up') currR--;
      else if (dir === 'down') currR++;

      // Check boundary exit
      if (currR < 0 || currR >= GRID_SIZE || currC < 0 || currC >= GRID_SIZE) {
        let endX = Math.max(0, Math.min(600, currC * CELL_SIZE + CELL_SIZE / 2));
        let endY = Math.max(0, Math.min(600, currR * CELL_SIZE + CELL_SIZE / 2));
        beamPath.push({ x: endX, y: endY });
        break;
      }

      const nextX = currC * CELL_SIZE + CELL_SIZE / 2;
      const nextY = currR * CELL_SIZE + CELL_SIZE / 2;
      beamPath.push({ x: nextX, y: nextY });

      // Check target reached
      if (currR === currentLevelData.target.r && currC === currentLevelData.target.c) {
        onTargetHit();
        break;
      }

      // Check mirror reflection
      const mirror = mirrorsState.find(m => m.r === currR && m.c === currC);
      if (mirror) {
        // angle 0: '/'
        if (mirror.angle === 0) {
          if (dir === 'right') dir = 'up';
          else if (dir === 'left') dir = 'down';
          else if (dir === 'up') dir = 'right';
          else if (dir === 'down') dir = 'left';
        } else {
          // angle 1: '\'
          if (dir === 'right') dir = 'down';
          else if (dir === 'left') dir = 'up';
          else if (dir === 'up') dir = 'left';
          else if (dir === 'down') dir = 'right';
        }
        playTone(620, 'sine', 0.04, 0.08);
      }
    }
  }

  function onTargetHit() {
    if (isLevelComplete) return;
    isLevelComplete = true;
    updateHUD();
    playTone(880, 'triangle', 0.35, 0.25);
    setTimeout(() => {
      completeOverlay.classList.add('active');
    }, 300);

    if (currentLevel >= bestLevel) {
      bestLevel = currentLevel + 1;
      localStorage.setItem('chrono_laser_best', bestLevel);
      bestDisplay.textContent = `LEVEL ${bestLevel}`;
    }
  }

  function handleCanvasClick(e) {
    if (isLevelComplete) return;
    initAudio();

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    const mirror = mirrorsState.find(m => m.r === r && m.c === c);
    if (mirror) {
      mirror.angle = (mirror.angle + 1) % 2;
      rotations++;
      playTone(440, 'sine', 0.08, 0.15);
      updateHUD();
      computeBeam();
    }
  }

  function render() {
    ctx.clearRect(0, 0, 600, 600);

    // Grid Floor Tiles
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
        ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // Laser Emitter Source
    const l = currentLevelData.laser;
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(l.c * CELL_SIZE + CELL_SIZE / 2, l.r * CELL_SIZE + CELL_SIZE / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Target Receiver Core
    const t = currentLevelData.target;
    ctx.fillStyle = isLevelComplete ? '#10b981' : '#fbbf24';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(t.c * CELL_SIZE + CELL_SIZE / 2, t.r * CELL_SIZE + CELL_SIZE / 2, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Mirrors
    mirrorsState.forEach(m => {
      const cx = m.c * CELL_SIZE + CELL_SIZE / 2;
      const cy = m.r * CELL_SIZE + CELL_SIZE / 2;

      // Base mount
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fill();

      // Mirror Slant Line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (m.angle === 0) {
        // '/'
        ctx.moveTo(cx - 24, cy + 24);
        ctx.lineTo(cx + 24, cy - 24);
      } else {
        // '\'
        ctx.moveTo(cx - 24, cy - 24);
        ctx.lineTo(cx + 24, cy + 24);
      }
      ctx.stroke();
    });

    // Beam Rendering
    if (beamPath.length > 1) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(beamPath[0].x, beamPath[0].y);
      for (let i = 1; i < beamPath.length; i++) {
        ctx.lineTo(beamPath[i].x, beamPath[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(render);
  }

  canvas.addEventListener('click', handleCanvasClick);

  resetLevelBtn.addEventListener('click', () => {
    initAudio();
    loadLevel(currentLevel);
  });

  nextLevelBtn.addEventListener('click', () => {
    initAudio();
    currentLevel++;
    loadLevel(currentLevel);
  });

  rulesBtn.addEventListener('click', () => rulesModal.classList.add('active'));
  closeRulesBtn.addEventListener('click', () => rulesModal.classList.remove('active'));
  rulesConfirmBtn.addEventListener('click', () => rulesModal.classList.remove('active'));

  loadLevel(currentLevel);
  render();
})();
