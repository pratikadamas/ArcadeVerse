/**
 * Cyber Rogue Protocol - Procedural Turn-Based Mainframe Crawler
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const canvas = document.getElementById('dungeon-canvas');
  const ctx = canvas.getContext('2d');
  const floorDisplay = document.getElementById('floor-display');
  const hpBar = document.getElementById('hp-bar');
  const hpText = document.getElementById('hp-text');
  const shieldBar = document.getElementById('shield-bar');
  const shieldText = document.getElementById('shield-text');
  const creditsDisplay = document.getElementById('credits-display');
  const actionLog = document.getElementById('action-log');

  const startOverlay = document.getElementById('start-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const descentOverlay = document.getElementById('descent-overlay');
  const finalDepthEl = document.getElementById('final-depth');
  const finalCreditsEl = document.getElementById('final-credits');

  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnNextFloor = document.getElementById('btn-next-floor');
  const btnSound = document.getElementById('btn-sound');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const btnHelp = document.getElementById('btn-help');
  const helpModal = document.getElementById('help-modal');
  const btnCloseHelp = document.getElementById('btn-close-help');

  // D-Pad
  const btnUp = document.getElementById('dpad-up');
  const btnDown = document.getElementById('dpad-down');
  const btnLeft = document.getElementById('dpad-left');
  const btnRight = document.getElementById('dpad-right');
  const btnWait = document.getElementById('dpad-wait');

  const GRID_SIZE = 12;
  const TILE_SIZE = 500 / GRID_SIZE;
  canvas.width = 500;
  canvas.height = 500;

  // Sound Engine
  let soundEnabled = true;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.12) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function logMessage(text, type = 'info') {
    actionLog.innerHTML = `<p class="log-entry ${type}">> ${text}</p>`;
  }

  // Demand-driven drawing
  let needsRedraw = true;
  let rafId = null;

  function scheduleDraw() {
    needsRedraw = true;
    if (!rafId) {
      rafId = requestAnimationFrame(renderLoop);
    }
  }

  function renderLoop() {
    if (needsRedraw) {
      draw();
      needsRedraw = false;
    }
    rafId = null;
  }

  // Game State
  let floor = 1;
  let credits = 0;
  let gameState = 'start'; // 'start', 'playing', 'gameover', 'descent'
  let map = []; // 0: floor, 1: wall
  let explored = [];
  let visible = [];

  const player = {
    x: 1,
    y: 1,
    maxHp: 100,
    hp: 100,
    maxShield: 50,
    shield: 50,
    hasKey: false,
    attackPower: 25
  };

  let enemies = [];
  let items = []; // { x, y, type: 'key', 'energy', 'heal', 'exit' }

  // Map Generation
  function generateMap() {
    map = [];
    explored = [];
    visible = [];
    enemies = [];
    items = [];

    // Initialize walls
    for (let y = 0; y < GRID_SIZE; y++) {
      map[y] = [];
      explored[y] = [];
      visible[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        map[y][x] = 1;
        explored[y][x] = false;
        visible[y][x] = false;
      }
    }

    // Carve random rooms & corridors using cellular walk
    let cx = Math.floor(GRID_SIZE / 2);
    let cy = Math.floor(GRID_SIZE / 2);
    map[cy][cx] = 0;
    const carved = [{ x: cx, y: cy }];

    for (let step = 0; step < 75; step++) {
      const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      cx = Math.max(1, Math.min(GRID_SIZE - 2, cx + d.x));
      cy = Math.max(1, Math.min(GRID_SIZE - 2, cy + d.y));
      map[cy][cx] = 0;
      if (!carved.some(p => p.x === cx && p.y === cy)) {
        carved.push({ x: cx, y: cy });
      }
    }

    // Place Player at first carved tile
    player.x = carved[0].x;
    player.y = carved[0].y;
    player.hasKey = false;

    // True BFS shortest path distance computation from spawn
    const distMap = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(-1));
    const bfsQueue = [{ x: player.x, y: player.y, dist: 0 }];
    distMap[player.y][player.x] = 0;

    while (bfsQueue.length > 0) {
      const cur = bfsQueue.shift();
      const neighbors = [
        { x: cur.x + 1, y: cur.y },
        { x: cur.x - 1, y: cur.y },
        { x: cur.x, y: cur.y + 1 },
        { x: cur.x, y: cur.y - 1 }
      ];
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < GRID_SIZE && n.y >= 0 && n.y < GRID_SIZE && map[n.y][n.x] === 0) {
          if (distMap[n.y][n.x] === -1) {
            distMap[n.y][n.x] = cur.dist + 1;
            bfsQueue.push({ x: n.x, y: n.y, dist: cur.dist + 1 });
          }
        }
      }
    }

    // Sort carved tiles by verified BFS distance from player spawn
    const reachableCarved = carved
      .filter(t => !(t.x === player.x && t.y === player.y) && distMap[t.y][t.x] > 0)
      .sort((a, b) => distMap[b.y][b.x] - distMap[a.y][a.x]);

    // Place Exit at maximum BFS distance
    const exitTile = reachableCarved.length > 0 ? reachableCarved[0] : carved[carved.length - 1];
    items.push({ x: exitTile.x, y: exitTile.y, type: 'exit' });

    // Place Keycard in distinct reachable mid-deep branch
    const midIdx = reachableCarved.length > 2 ? Math.floor(reachableCarved.length * 0.45) : 0;
    const keyTile = reachableCarved.length > 1 ? reachableCarved[midIdx] : carved[Math.floor(carved.length / 2)];
    items.push({ x: keyTile.x, y: keyTile.y, type: 'key' });

    // Place Items & Enemies on other carved tiles
    const candidates = reachableCarved.filter(t => 
      !(t.x === exitTile.x && t.y === exitTile.y) &&
      !(t.x === keyTile.x && t.y === keyTile.y)
    );

    // Items
    for (let i = 0; i < Math.min(3, candidates.length); i++) {
      const tile = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      const type = Math.random() < 0.5 ? 'energy' : 'heal';
      items.push({ x: tile.x, y: tile.y, type });
    }

    // Enemies (1 to 3 drones per floor)
    const enemyCount = Math.min(4, Math.floor(floor * 0.8) + 1);
    for (let i = 0; i < enemyCount && candidates.length > 0; i++) {
      const tile = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      enemies.push({
        x: tile.x,
        y: tile.y,
        hp: 30 + floor * 10,
        maxHp: 30 + floor * 10,
        damage: 12 + floor * 4
      });
    }

    computeFOV();
  }

  function computeFOV() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        visible[y][x] = false;
      }
    }

    // Visible radius of 3 tiles
    const RADIUS = 3.2;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist <= RADIUS) {
          const tx = player.x + dx;
          const ty = player.y + dy;
          if (tx >= 0 && tx < GRID_SIZE && ty >= 0 && ty < GRID_SIZE) {
            visible[ty][tx] = true;
            explored[ty][tx] = true;
          }
        }
      }
    }
  }

  function movePlayer(dx, dy) {
    if (gameState !== 'playing') return;

    const nx = player.x + dx;
    const ny = player.y + dy;

    // Check Wall
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || map[ny][nx] === 1) {
      playTone(140, 'square', 0.05, 0.1);
      return;
    }

    // Check Enemy Attack
    const enemy = enemies.find(e => e.x === nx && e.y === ny);
    if (enemy) {
      attackEnemy(enemy);
      turnResolution();
      return;
    }

    // Move
    player.x = nx;
    player.y = ny;
    playTone(440, 'sine', 0.04, 0.08);

    // Check Items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.x === player.x && it.y === player.y) {
        if (it.type === 'key') {
          player.hasKey = true;
          credits += 50;
          playTone(880, 'triangle', 0.15, 0.2);
          logMessage('Found Security Keycard! Exit unlocked.', 'item');
          items.splice(i, 1);
        } else if (it.type === 'energy') {
          player.shield = Math.min(player.maxShield, player.shield + 25);
          credits += 20;
          playTone(660, 'sine', 0.12, 0.15);
          logMessage('Recharged 25 Shield Energy.', 'heal');
          items.splice(i, 1);
        } else if (it.type === 'heal') {
          player.hp = Math.min(player.maxHp, player.hp + 35);
          credits += 20;
          playTone(550, 'sine', 0.12, 0.15);
          logMessage('Repaired 35 Integrity Points.', 'heal');
          items.splice(i, 1);
        } else if (it.type === 'exit') {
          if (player.hasKey) {
            floorComplete();
            return;
          } else {
            logMessage('Exit locked. Locate security keycard first.', 'damage');
          }
        }
      }
    }

    turnResolution();
  }

  function attackEnemy(enemy) {
    enemy.hp -= player.attackPower;
    playTone(320, 'sawtooth', 0.08, 0.2);
    logMessage(`Attacked security drone for ${player.attackPower} damage!`, 'damage');

    if (enemy.hp <= 0) {
      enemies = enemies.filter(e => e !== enemy);
      credits += 40;
      playTone(620, 'square', 0.12, 0.25);
      logMessage('Security drone neutralized! +40 Credits.', 'heal');
    }
  }

  function turnResolution() {
    // Enemy AI: Move closer or attack if adjacent
    enemies.forEach(e => {
      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      if (dist <= 1.1) {
        // Attack Player
        let dmg = e.damage;
        if (player.shield > 0) {
          const absorbed = Math.min(player.shield, dmg);
          player.shield -= absorbed;
          dmg -= absorbed;
        }
        player.hp -= dmg;
        playTone(180, 'sawtooth', 0.15, 0.25);
        logMessage(`Drone fired! Absorbed by shield, ${dmg} HP lost.`, 'damage');
      } else if (dist < 4) {
        // Step towards player
        const dx = Math.sign(player.x - e.x);
        const dy = Math.sign(player.y - e.y);
        const nextX = e.x + (Math.random() < 0.5 ? dx : 0);
        const nextY = e.y + (nextX === e.x ? dy : 0);

        if (map[nextY] && map[nextY][nextX] === 0 && !enemies.some(o => o.x === nextX && o.y === nextY) && !(nextX === player.x && nextY === player.y)) {
          e.x = nextX;
          e.y = nextY;
        }
      }
    });

    computeFOV();
    updateHUD();

    if (player.hp <= 0) {
      gameState = 'gameover';
      finalDepthEl.textContent = `B-${floor}`;
      finalCreditsEl.textContent = credits;
      gameOverOverlay.classList.add('active');
    }
  }

  function floorComplete() {
    gameState = 'descent';
    playTone(740, 'triangle', 0.25, 0.3);
    logMessage(`Floor B-${floor} bypassed successfully!`, 'heal');
    descentOverlay.classList.add('active');
  }

  function nextFloor() {
    floor++;
    credits += 100;
    descentOverlay.classList.remove('active');
    gameState = 'playing';
    generateMap();
    logMessage(`Infiltrated Sector B-${floor}. Caution advised.`, 'info');
    updateHUD();
  }

  function startInfiltration() {
    initAudio();
    floor = 1;
    credits = 0;
    player.hp = player.maxHp;
    player.shield = player.maxShield;
    startOverlay.classList.remove('active');
    gameOverOverlay.classList.remove('active');
    descentOverlay.classList.remove('active');
    gameState = 'playing';
    generateMap();
    logMessage('Mission started. Grid operational.', 'info');
    updateHUD();
  }

  function updateHUD() {
    floorDisplay.textContent = `B-${floor}`;
    hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    hpText.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;
    shieldBar.style.width = `${Math.max(0, (player.shield / player.maxShield) * 100)}%`;
    shieldText.textContent = `${Math.max(0, player.shield)} / ${player.maxShield}`;
    creditsDisplay.textContent = credits;
    scheduleDraw();
  }

  function draw() {
    ctx.clearRect(0, 0, 500, 500);
    if (!map || !map.length || !explored || !explored.length) return;

    // Draw Map Tiles
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (!explored[y][x]) {
          ctx.fillStyle = '#02040a';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          continue;
        }

        const isVis = visible[y][x];

        if (map[y][x] === 1) {
          // Wall
          ctx.fillStyle = isVis ? '#1e293b' : '#0f172a';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = isVis ? 'rgba(0, 245, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else {
          // Floor
          ctx.fillStyle = isVis ? '#091024' : '#040714';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = isVis ? 'rgba(0, 245, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)';
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        }

        // Draw items if visible
        if (isVis) {
          items.forEach(it => {
            if (it.x === x && it.y === y) {
              ctx.font = 'bold 18px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const cx = px + TILE_SIZE / 2;
              const cy = py + TILE_SIZE / 2;

              if (it.type === 'key') {
                ctx.fillStyle = '#fbbf24';
                ctx.fillText('[K]', cx, cy);
              } else if (it.type === 'energy') {
                ctx.fillStyle = '#00f5ff';
                ctx.fillText('[+]', cx, cy);
              } else if (it.type === 'heal') {
                ctx.fillStyle = '#10b981';
                ctx.fillText('[H]', cx, cy);
              } else if (it.type === 'exit') {
                ctx.fillStyle = player.hasKey ? '#10b981' : '#f43f5e';
                ctx.fillText('[E]', cx, cy);
              }
            }
          });

          // Draw enemies
          enemies.forEach(en => {
            if (en.x === x && en.y === y) {
              ctx.fillStyle = '#f43f5e';
              ctx.font = 'bold 18px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('<!>', px + TILE_SIZE / 2, py + TILE_SIZE / 2);
            }
          });
        }
      }
    }

    // Draw Player
    const ppx = player.x * TILE_SIZE + TILE_SIZE / 2;
    const ppy = player.y * TILE_SIZE + TILE_SIZE / 2;
    ctx.save();
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00f5ff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('@', ppx, ppy);
    ctx.restore();
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'Enter') {
      if (startOverlay && startOverlay.classList.contains('active')) {
        startInfiltration();
        return;
      }
      if (gameoverOverlay && gameoverOverlay.classList.contains('active')) {
        startInfiltration();
        return;
      }
      if (descentOverlay && descentOverlay.classList.contains('active')) {
        nextFloor();
        return;
      }
    }
    if (e.code === 'Space') {
      if (startOverlay && startOverlay.classList.contains('active')) {
        startInfiltration();
        return;
      }
      if (gameoverOverlay && gameoverOverlay.classList.contains('active')) {
        startInfiltration();
        return;
      }
      if (descentOverlay && descentOverlay.classList.contains('active')) {
        nextFloor();
        return;
      }
      turnResolution();
      return;
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') movePlayer(0, -1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') movePlayer(0, 1);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') movePlayer(-1, 0);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') movePlayer(1, 0);
    if (e.code === 'Escape') {
      if (helpModal && helpModal.classList.contains('active')) {
        helpModal.classList.remove('active');
      }
    }
  });

  // D-Pad buttons
  btnUp.addEventListener('click', () => movePlayer(0, -1));
  btnDown.addEventListener('click', () => movePlayer(0, 1));
  btnLeft.addEventListener('click', () => movePlayer(-1, 0));
  btnRight.addEventListener('click', () => movePlayer(1, 0));
  btnWait.addEventListener('click', () => turnResolution());

  // Overlays
  btnStart.addEventListener('click', startInfiltration);
  btnRestart.addEventListener('click', startInfiltration);
  btnNextFloor.addEventListener('click', nextFloor);

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    iconSoundOn.classList.toggle('hidden', !soundEnabled);
    iconSoundOff.classList.toggle('hidden', soundEnabled);
    if (soundEnabled) initAudio();
  });

  btnHelp.addEventListener('click', () => helpModal.classList.add('active'));
  btnCloseHelp.addEventListener('click', () => helpModal.classList.remove('active'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('active');
  });

  // Touch swipe support on canvas
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (e.changedTouches.length > 0) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 25) movePlayer(1, 0);
        else if (dx < -25) movePlayer(-1, 0);
      } else {
        if (dy > 25) movePlayer(0, 1);
        else if (dy < -25) movePlayer(0, -1);
      }
    }
  }, { passive: true });

  window.addEventListener('pagehide', () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  generateMap();
  updateHUD();
  scheduleDraw();
})();
