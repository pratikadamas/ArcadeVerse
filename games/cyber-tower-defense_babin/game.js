/**
 * Cyber Tower Defense: Grid Bastion
 * Author: Babin Bid (@Babin123456)
 * ArcadeVerse HTML5 Canvas Game
 */
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreVal = document.getElementById('scoreVal');
  const levelVal = document.getElementById('levelVal');
  const overlayScreen = document.getElementById('overlayScreen');
  const overlayHeading = document.getElementById('overlayHeading');
  const overlayDesc = document.getElementById('overlayDesc');
  const btnActionStart = document.getElementById('btnActionStart');

  const tLeft = document.getElementById('tLeft');
  const tRight = document.getElementById('tRight');
  const tAction = document.getElementById('tAction');

  let animationId = null;
  let isPlaying = false;
  let score = 0;
  let credits = 150;
  let baseHealth = 20;
  let wave = 1;

  // Web Audio Synth
  let audioCtx = null;
  function playSound(type) {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(650, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'build') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch (_) {}
  }

  // Waypoints for Creeps path
  const WAYPOINTS = [
    { x: 0, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 450 },
    { x: 550, y: 450 },
    { x: 550, y: 220 },
    { x: 800, y: 220 }
  ];

  // Grid system (Rows & Cols)
  const CELL_SIZE = 50;
  let towers = [];
  let enemies = [];
  let projectiles = [];
  let cursor = { col: 5, row: 5 };
  let spawnTimer = 0;

  function initInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') cursor.col = Math.max(0, cursor.col - 1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') cursor.col = Math.min(15, cursor.col + 1);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') cursor.row = Math.max(0, cursor.row - 1);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') cursor.row = Math.min(11, cursor.row + 1);
      if (e.code === 'Space') {
        e.preventDefault();
        buildTower(cursor.col, cursor.row);
      }
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
      const col = Math.floor(clickX / CELL_SIZE);
      const row = Math.floor(clickY / CELL_SIZE);
      buildTower(col, row);
    });

    tLeft.addEventListener('touchstart', (e) => { e.preventDefault(); cursor.col = Math.max(0, cursor.col - 1); });
    tRight.addEventListener('touchstart', (e) => { e.preventDefault(); cursor.col = Math.min(15, cursor.col + 1); });
    tAction.addEventListener('touchstart', (e) => { e.preventDefault(); buildTower(cursor.col, cursor.row); });

    btnActionStart.addEventListener('click', startGame);
  }

  function buildTower(c, r) {
    if (!isPlaying) return;
    const x = c * CELL_SIZE + CELL_SIZE / 2;
    const y = r * CELL_SIZE + CELL_SIZE / 2;

    // Check if on road path
    if (isNearPath(x, y)) return;

    // Check existing
    if (towers.some(t => t.c === c && t.r === r)) return;

    if (credits >= 60) {
      credits -= 60;
      towers.push({
        c: c,
        r: r,
        x: x,
        y: y,
        range: 120,
        cooldown: 0,
        rate: 22
      });
      playSound('build');
      updateHUD();
    }
  }

  function isNearPath(px, py) {
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const p1 = WAYPOINTS[i];
      const p2 = WAYPOINTS[i + 1];
      const dist = distToSegment({ x: px, y: py }, p1, p2);
      if (dist < 32) return true;
    }
    return false;
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  function spawnEnemy() {
    enemies.push({
      x: WAYPOINTS[0].x,
      y: WAYPOINTS[0].y,
      wpIdx: 1,
      speed: 1.6 + Math.min(2, wave * 0.15),
      hp: 60 + wave * 25,
      maxHp: 60 + wave * 25,
      radius: 12
    });
  }

  function startGame() {
    overlayScreen.classList.add('hidden');
    isPlaying = true;
    score = 0;
    credits = 180;
    baseHealth = 20;
    wave = 1;
    towers = [];
    enemies = [];
    projectiles = [];
    updateHUD();
    gameLoop();
  }

  function gameOver() {
    isPlaying = false;
    overlayHeading.textContent = 'BASTION BREACHED';
    overlayDesc.textContent = 'Cyber intrusions overran the central core! High Defense Score: ' + score;
    btnActionStart.textContent = 'RESTORE DEFENSES';
    overlayScreen.classList.remove('hidden');
  }

  function updateHUD() {
    scoreVal.textContent = score;
    levelVal.textContent = 'HP: ' + baseHealth + ' | $' + credits;
  }

  function update() {
    if (!isPlaying) return;

    spawnTimer++;
    if (spawnTimer > 60) {
      spawnTimer = 0;
      spawnEnemy();
    }

    // Towers firing logic
    for (const t of towers) {
      if (t.cooldown > 0) t.cooldown--;
      else {
        // Find nearest enemy
        let target = null;
        let minDist = t.range;
        for (const e of enemies) {
          const d = Math.hypot(e.x - t.x, e.y - t.y);
          if (d < minDist) {
            minDist = d;
            target = e;
          }
        }

        if (target) {
          t.cooldown = t.rate;
          projectiles.push({
            x: t.x,
            y: t.y,
            target: target,
            speed: 9
          });
          playSound('laser');
        }
      }
    }

    // Move projectiles
    for (let p = projectiles.length - 1; p >= 0; p--) {
      const pr = projectiles[p];
      const dx = pr.target.x - pr.x;
      const dy = pr.target.y - pr.y;
      const dist = Math.hypot(dx, dy);

      if (dist < pr.speed || pr.target.hp <= 0) {
        if (pr.target.hp > 0) {
          pr.target.hp -= 30;
          if (pr.target.hp <= 0) {
            score += 80;
            credits += 25;
            updateHUD();
          }
        }
        projectiles.splice(p, 1);
        continue;
      }

      pr.x += (dx / dist) * pr.speed;
      pr.y += (dy / dist) * pr.speed;
    }

    // Move enemies along waypoints
    for (let e = enemies.length - 1; e >= 0; e--) {
      const en = enemies[e];
      if (en.hp <= 0) {
        enemies.splice(e, 1);
        continue;
      }

      const targetWp = WAYPOINTS[en.wpIdx];
      const dx = targetWp.x - en.x;
      const dy = targetWp.y - en.y;
      const dist = Math.hypot(dx, dy);

      if (dist < en.speed) {
        en.wpIdx++;
        if (en.wpIdx >= WAYPOINTS.length) {
          // Reached core
          baseHealth--;
          enemies.splice(e, 1);
          updateHUD();
          if (baseHealth <= 0) gameOver();
          continue;
        }
      } else {
        en.x += (dx / dist) * en.speed;
        en.y += (dy / dist) * en.speed;
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, 800, 600);

    // Draw Pathway
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 42;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < WAYPOINTS.length; i++) {
      if (i === 0) ctx.moveTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
      else ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    ctx.stroke();

    // Towers
    for (const t of towers) {
      ctx.fillStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 10;
      ctx.fillRect(t.x - 14, t.y - 14, 28, 28);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cursor Box
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(cursor.col * CELL_SIZE, cursor.row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

    // Projectiles
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 3;
    for (const pr of projectiles) {
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enemies
    for (const en of enemies) {
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(en.x, en.y, en.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Health bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(en.x - 14, en.y - 20, 28, 4);
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(en.x - 14, en.y - 20, (en.hp / en.maxHp) * 28, 4);
    }
  }

  function gameLoop() {
    if (!isPlaying) return;
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  // Lifecycle Bridge
  if (window.ArcadeVerse) {
    ArcadeVerse.onPause(() => { isPlaying = false; });
    ArcadeVerse.onResume(() => { if (overlayScreen.classList.contains('hidden')) { isPlaying = true; gameLoop(); } });
    ArcadeVerse.onTeardown(() => {
      isPlaying = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) audioCtx.close().catch(() => {});
    });
  }

  initInputs();
})();
