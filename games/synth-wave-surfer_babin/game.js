/* Synth Wave Surfer - game.js */
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
    note() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) {}
    }
    crash() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statScoreEl = document.getElementById('statScore');
  const statMultiplierEl = document.getElementById('statMultiplier');
  const statDistEl = document.getElementById('statDist');
  const statHighEl = document.getElementById('statHigh');

  const startScreen = document.getElementById('startScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnResume = document.getElementById('btnResume');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');
  const btnJump = document.getElementById('btnJump');

  const finalDistEl = document.getElementById('finalDist');
  const finalScoreEl = document.getElementById('finalScore');

  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let score = 0;
  let distance = 0;
  let multiplier = 1.0;
  let highRun = parseInt(localStorage.getItem('synth_surfer_high') || '0', 10);
  statHighEl.textContent = highRun;

  let waveOffset = 0;
  const surfer = {
    x: 120,
    y: canvas.height / 2,
    radius: 9,
    vy: 0,
    isJumping: false,
    trail: []
  };

  let items = []; // notes or hazards

  function resetGame() {
    score = 0;
    distance = 0;
    multiplier = 1.0;
    waveOffset = 0;

    surfer.y = canvas.height / 2;
    surfer.vy = 0;
    surfer.isJumping = false;
    surfer.trail = [];

    items = [];
    updateUI();
  }

  function getWaveY(x, offset) {
    const centerY = canvas.height / 2;
    const amp1 = 80;
    const amp2 = 30;
    return centerY + Math.sin((x + offset) * 0.008) * amp1 + Math.cos((x + offset) * 0.018) * amp2;
  }

  function spawnItems() {
    if (Math.random() < 0.035) {
      const isHazard = Math.random() < 0.35;
      const spawnX = canvas.width + 40;
      const targetWaveY = getWaveY(spawnX, waveOffset);
      items.push({
        x: spawnX,
        y: targetWaveY + (isHazard ? (Math.random() < 0.5 ? -18 : 18) : 0),
        isHazard: isHazard,
        radius: isHazard ? 11 : 9,
        collected: false
      });
    }
  }

  function jump() {
    if (!isRunning || isPaused) return;
    sfx.init();
    surfer.vy = -7.5;
    surfer.isJumping = true;
    sfx.jump();
  }

  function update() {
    if (!isRunning || isPaused) return;

    waveOffset += 4.5;
    distance += 1;
    score += Math.round(multiplier);

    const waveY = getWaveY(surfer.x, waveOffset);

    if (surfer.isJumping) {
      surfer.vy += 0.38; // gravity
      surfer.y += surfer.vy;

      if (surfer.y >= waveY) {
        surfer.y = waveY;
        surfer.vy = 0;
        surfer.isJumping = false;
      }
    } else {
      surfer.y = waveY;
    }

    surfer.trail.push({ x: surfer.x, y: surfer.y });
    if (surfer.trail.length > 16) surfer.trail.shift();

    spawnItems();

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.x -= 4.5;

      const d = Math.hypot(surfer.x - item.x, surfer.y - item.y);
      if (d < surfer.radius + item.radius) {
        if (item.isHazard) {
          endGame();
          return;
        } else {
          score += 100 * Math.round(multiplier);
          multiplier = Math.min(4.0, multiplier + 0.2);
          sfx.note();
          items.splice(i, 1);
          continue;
        }
      }

      if (item.x < -40) {
        items.splice(i, 1);
      }
    }

    multiplier = Math.max(1.0, multiplier - 0.0005);
    updateUI();
  }

  function endGame() {
    isRunning = false;
    sfx.crash();
    if (animId) cancelAnimationFrame(animId);

    if (score > highRun) {
      highRun = score;
      localStorage.setItem('synth_surfer_high', highRun.toString());
      statHighEl.textContent = highRun;
    }

    finalDistEl.textContent = `${distance}m`;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
  }

  function updateUI() {
    statScoreEl.textContent = score;
    statMultiplierEl.textContent = `${multiplier.toFixed(1)}x`;
    statDistEl.textContent = `${distance}m`;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Synthwave grid lines
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw modulating wave path
    ctx.save();
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = getWaveY(x, waveOffset);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Secondary harmonic wave
    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 10) {
      const y = canvas.height / 2 + Math.cos((x + waveOffset * 0.8) * 0.012) * 50;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Draw Items
    for (const item of items) {
      ctx.save();
      if (item.isHazard) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - item.radius);
        ctx.lineTo(item.x + item.radius, item.y + item.radius);
        ctx.lineTo(item.x - item.radius, item.y + item.radius);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Surfer trail
    for (let i = 0; i < surfer.trail.length; i++) {
      const p = surfer.trail[i];
      const a = (i + 1) / (surfer.trail.length * 2);
      ctx.fillStyle = `rgba(0, 240, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, surfer.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Surfer
    ctx.save();
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(surfer.x, surfer.y, surfer.radius, 0, Math.PI * 2);
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
    pauseScreen.classList.add('hidden');
    animId = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!isRunning) return;
    isPaused = !isPaused;
    if (isPaused) {
      pauseScreen.classList.remove('hidden');
    } else {
      pauseScreen.classList.add('hidden');
    }
  }

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') {
      jump();
      e.preventDefault();
    }
    if (e.key === 'p' || e.key === 'P') togglePause();
  });

  canvas.addEventListener('click', jump);
  if (btnJump) btnJump.addEventListener('click', jump);

  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnResume.addEventListener('click', togglePause);
  btnPause.addEventListener('click', togglePause);
  btnRestartNav.addEventListener('click', startGame);

  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });
})();
