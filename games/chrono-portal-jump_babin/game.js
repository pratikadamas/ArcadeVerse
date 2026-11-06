/* Chrono Portal Jump - game.js */
(function() {
  'use strict';

  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
    jump() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(640, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    }
    portal() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      } catch (e) {}
    }
    core() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) {}
    }
    win() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        [440, 554, 659, 880].forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.25);
        });
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statChamberEl = document.getElementById('statChamber');
  const statJumpsEl = document.getElementById('statJumps');
  const statScoreEl = document.getElementById('statScore');
  const statCoresEl = document.getElementById('statCores');

  const startScreen = document.getElementById('startScreen');
  const clearScreen = document.getElementById('clearScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnNext = document.getElementById('btnNext');
  const btnRestart = document.getElementById('btnRestart');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnJump = document.getElementById('btnJump');

  const finalChambersEl = document.getElementById('finalChambers');
  const finalScoreEl = document.getElementById('finalScore');

  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let chamber = 1;
  let jumps = 0;
  let score = 0;
  let coresCollected = 0;
  let portalCooldown = 0;

  const player = {
    x: 50,
    y: 350,
    w: 18,
    h: 26,
    vx: 0,
    vy: 0,
    onGround: false
  };

  const keys = { left: false, right: false };

  let platforms = [];
  let portalOrange = { x: 120, y: 150, w: 14, h: 44 };
  let portalBlue = { x: 580, y: 320, w: 14, h: 44 };
  let cores = [];
  let exitDoor = { x: 640, y: 320, w: 26, h: 40, open: false };

  function setupChamber() {
    coresCollected = 0;
    portalCooldown = 0;
    exitDoor.open = false;

    player.x = 40;
    player.y = 350;
    player.vx = 0;
    player.vy = 0;

    platforms = [
      { x: 0, y: 410, w: 700, h: 50 }, // ground floor
      { x: 80, y: 300, w: 140, h: 16 },
      { x: 280, y: 220, w: 150, h: 16 },
      { x: 490, y: 140, w: 140, h: 16 }
    ];

    portalOrange = { x: 90, y: 250, w: 14, h: 44 };
    portalBlue = { x: 500, y: 90, w: 14, h: 44 };

    cores = [
      { x: 150, y: 260, r: 8, collected: false },
      { x: 350, y: 180, r: 8, collected: false },
      { x: 560, y: 100, r: 8, collected: false }
    ];

    exitDoor = { x: 630, y: 370, w: 26, h: 40, open: false };

    updateStats();
  }

  function updateStats() {
    statChamberEl.textContent = chamber;
    statJumpsEl.textContent = jumps;
    statScoreEl.textContent = score;
    statCoresEl.textContent = `${coresCollected}/3`;
  }

  function doJump() {
    if (!isRunning || isPaused) return;
    sfx.init();
    if (player.onGround) {
      player.vy = -10.5;
      player.onGround = false;
      jumps++;
      sfx.jump();
      updateStats();
    }
  }

  function update() {
    if (!isRunning || isPaused) return;

    if (keys.left) player.vx = -4;
    else if (keys.right) player.vx = 4;
    else player.vx *= 0.75;

    player.vy += 0.55; // gravity
    player.x += player.vx;
    player.y += player.vy;

    player.onGround = false;

    // Platform collisions
    for (const p of platforms) {
      if (
        player.x + player.w / 2 > p.x &&
        player.x - player.w / 2 < p.x + p.w &&
        player.y + player.h / 2 > p.y &&
        player.y - player.h / 2 < p.y + p.h
      ) {
        if (player.vy > 0 && player.y < p.y + 10) {
          player.y = p.y - player.h / 2;
          player.vy = 0;
          player.onGround = true;
        }
      }
    }

    if (portalCooldown > 0) portalCooldown--;

    // Portal Teleportation
    if (portalCooldown <= 0) {
      if (Math.hypot(player.x - portalOrange.x, player.y - portalOrange.y) < 24) {
        player.x = portalBlue.x + 20;
        player.y = portalBlue.y;
        player.vx = 6;
        player.vy = -4;
        portalCooldown = 40;
        sfx.portal();
      } else if (Math.hypot(player.x - portalBlue.x, player.y - portalBlue.y) < 24) {
        player.x = portalOrange.x + 20;
        player.y = portalOrange.y;
        player.vx = 6;
        player.vy = -4;
        portalCooldown = 40;
        sfx.portal();
      }
    }

    // Chronocores collection
    for (const c of cores) {
      if (!c.collected && Math.hypot(player.x - c.x, player.y - c.y) < 20) {
        c.collected = true;
        coresCollected++;
        score += 150;
        sfx.core();
        if (coresCollected >= 3) {
          exitDoor.open = true;
        }
        updateStats();
      }
    }

    // Exit Door
    if (exitDoor.open && Math.hypot(player.x - exitDoor.x, player.y - exitDoor.y) < 26) {
      chamberWon();
    }

    // Fall boundary
    if (player.y > canvas.height + 40) {
      player.x = 40;
      player.y = 350;
      player.vy = 0;
    }
  }

  function chamberWon() {
    isRunning = false;
    sfx.win();
    score += chamber * 300;
    updateStats();
    clearScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Platforms
    ctx.fillStyle = '#1e1138';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    for (const p of platforms) {
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }

    // Orange Portal
    ctx.save();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(portalOrange.x, portalOrange.y, portalOrange.w / 2, portalOrange.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Blue Portal
    ctx.save();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(portalBlue.x, portalBlue.y, portalBlue.w / 2, portalBlue.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Chronocores
    for (const c of cores) {
      if (!c.collected) {
        ctx.save();
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Exit Door
    ctx.save();
    ctx.fillStyle = exitDoor.open ? '#22c55e' : '#64748b';
    ctx.shadowColor = exitDoor.open ? '#4ade80' : 'transparent';
    ctx.shadowBlur = 14;
    ctx.fillRect(exitDoor.x - exitDoor.w / 2, exitDoor.y - exitDoor.h / 2, exitDoor.w, exitDoor.h);
    ctx.restore();

    // Player
    ctx.save();
    ctx.fillStyle = '#f5f3ff';
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, 4);
    ctx.fill();
    ctx.restore();
  }

  function loop() {
    update();
    render();
    if (isRunning) {
      animId = requestAnimationFrame(loop);
    }
  }

  function startChamberGame() {
    sfx.init();
    chamber = 1;
    jumps = 0;
    score = 0;
    startScreen.classList.add('hidden');
    clearScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    setupChamber();
    isRunning = true;
    isPaused = false;
    animId = requestAnimationFrame(loop);
  }

  function advanceChamber() {
    chamber++;
    clearScreen.classList.add('hidden');
    setupChamber();
    isRunning = true;
    isPaused = false;
  }

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.code === 'Space') doJump();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  function bindTouch(btn, prop) {
    if (!btn) return;
    const start = (e) => { e.preventDefault(); sfx.init(); keys[prop] = true; };
    const end = (e) => { e.preventDefault(); keys[prop] = false; };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }

  bindTouch(btnLeft, 'left');
  bindTouch(btnRight, 'right');
  btnJump.addEventListener('click', doJump);

  btnStart.addEventListener('click', startChamberGame);
  btnNext.addEventListener('click', advanceChamber);
  btnRestart.addEventListener('click', startChamberGame);
  btnRestartNav.addEventListener('click', setupChamber);

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });
})();
