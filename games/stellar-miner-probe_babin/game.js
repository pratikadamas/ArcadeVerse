/* Stellar Miner Probe - game.js */
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
    drill() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    }
    ore() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(784, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) {}
    }
    fuel() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      } catch (e) {}
    }
    hit() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statDepthEl = document.getElementById('statDepth');
  const statFuelEl = document.getElementById('statFuel');
  const statOreEl = document.getElementById('statOre');
  const statCreditsEl = document.getElementById('statCredits');

  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnDrill = document.getElementById('btnDrill');

  const finalDepthEl = document.getElementById('finalDepth');
  const finalOreEl = document.getElementById('finalOre');
  const finalCreditsEl = document.getElementById('finalCredits');
  const gameOverTitle = document.getElementById('gameOverTitle');

  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let depth = 0;
  let fuel = 100;
  let oreMined = 0;
  let credits = 0;

  const drone = {
    x: canvas.width / 2,
    y: 100,
    width: 24,
    height: 28,
    vx: 0,
    isDrilling: false
  };

  const keys = { left: false, right: false, drill: false };
  let blocks = []; // bedrock, ore, fuel canisters

  function spawnRow(yPos) {
    const cols = 10;
    const colWidth = canvas.width / cols;
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.35) {
        const rand = Math.random();
        let type = 'rock';
        if (rand < 0.25) type = 'ore';
        else if (rand < 0.35) type = 'fuel';

        blocks.push({
          x: c * colWidth,
          y: yPos,
          w: colWidth - 4,
          h: 24,
          type: type,
          hp: type === 'ore' ? 1 : 2
        });
      }
    }
  }

  function resetGame() {
    depth = 0;
    fuel = 100;
    oreMined = 0;
    credits = 0;

    drone.x = canvas.width / 2;
    drone.y = 80;
    drone.vx = 0;
    drone.isDrilling = false;

    blocks = [];
    for (let i = 0; i < 8; i++) {
      spawnRow(200 + i * 50);
    }

    updateStats();
  }

  function updateStats() {
    statDepthEl.textContent = `${depth}m`;
    statFuelEl.textContent = `${Math.ceil(fuel)}%`;
    statOreEl.textContent = oreMined;
    statCreditsEl.textContent = `$${credits}`;
  }

  function update() {
    if (!isRunning || isPaused) return;

    if (keys.left) drone.vx = -4.5;
    else if (keys.right) drone.vx = 4.5;
    else drone.vx *= 0.8;

    drone.x += drone.vx;
    drone.x = Math.max(14, Math.min(canvas.width - 14, drone.x));

    const drillSpeed = keys.drill ? 3.5 : 1.2;
    depth += Math.round(drillSpeed * 0.4);
    fuel -= keys.drill ? 0.08 : 0.03;

    if (keys.drill) sfx.drill();

    if (fuel <= 0) {
      fuel = 0;
      endGame('FUEL DEPLETED', 'Your thruster propellant ran dry inside the cavern shaft.');
      return;
    }

    // Scroll blocks upward as drone descends
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b.y -= drillSpeed;

      // Collision with drone
      if (
        drone.x + drone.width / 2 > b.x &&
        drone.x - drone.width / 2 < b.x + b.w &&
        drone.y + drone.height / 2 > b.y &&
        drone.y - drone.height / 2 < b.y + b.h
      ) {
        if (b.type === 'ore') {
          oreMined++;
          credits += 50;
          sfx.ore();
          blocks.splice(i, 1);
          continue;
        } else if (b.type === 'fuel') {
          fuel = Math.min(100, fuel + 25);
          sfx.fuel();
          blocks.splice(i, 1);
          continue;
        } else if (b.type === 'rock') {
          if (keys.drill) {
            b.hp--;
            if (b.hp <= 0) {
              credits += 10;
              blocks.splice(i, 1);
            }
          } else {
            fuel -= 5;
            sfx.hit();
            blocks.splice(i, 1);
          }
        }
      }

      if (b.y < -30) blocks.splice(i, 1);
    }

    const lowestY = blocks.reduce((max, b) => Math.max(max, b.y), 0);
    if (lowestY < canvas.height + 60) {
      spawnRow(canvas.height + 70);
    }

    updateStats();
  }

  function endGame(title, desc) {
    isRunning = false;
    sfx.hit();
    if (animId) cancelAnimationFrame(animId);

    gameOverTitle.textContent = title;
    finalDepthEl.textContent = `${depth}m`;
    finalOreEl.textContent = oreMined;
    finalCreditsEl.textContent = `$${credits}`;

    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cavern Wall Gradients
    ctx.fillStyle = '#1c130a';
    ctx.fillRect(0, 0, 10, canvas.height);
    ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);

    // Draw Blocks
    for (const b of blocks) {
      ctx.save();
      if (b.type === 'ore') {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      } else if (b.type === 'fuel') {
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      } else {
        ctx.fillStyle = '#44403c';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.restore();
    }

    // Draw Drone
    ctx.save();
    ctx.translate(drone.x, drone.y);

    // Thruster flame
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-6, -drone.height / 2);
    ctx.lineTo(6, -drone.height / 2);
    ctx.lineTo(0, -drone.height / 2 - (keys.drill ? 16 : 8));
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-drone.width / 2, -drone.height / 2, drone.width, drone.height);

    // Drill Bit
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(-drone.width / 2 + 2, drone.height / 2);
    ctx.lineTo(drone.width / 2 - 2, drone.height / 2);
    ctx.lineTo(0, drone.height / 2 + (keys.drill ? 14 : 6));
    ctx.closePath();
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

  function startGame() {
    sfx.init();
    resetGame();
    isRunning = true;
    isPaused = false;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    animId = requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.code === 'Space') keys.drill = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.code === 'Space') keys.drill = false;
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
  bindTouch(btnDrill, 'drill');

  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });
})();
