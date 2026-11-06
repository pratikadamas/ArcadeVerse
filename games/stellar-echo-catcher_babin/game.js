/* Stellar Echo Catcher - game.js */
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
    catchPing() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174.66, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) {}
    }
    staticBurst() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statScoreEl = document.getElementById('statScore');
  const statCapturedEl = document.getElementById('statCaptured');
  const statClarityEl = document.getElementById('statClarity');
  const statHighEl = document.getElementById('statHigh');

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
  const btnCatch = document.getElementById('btnCatch');

  const finalCapturedEl = document.getElementById('finalCaptured');
  const finalScoreEl = document.getElementById('finalScore');

  let isRunning = false;
  let isPaused = false;
  let animId = null;

  let score = 0;
  let captured = 0;
  let clarity = 100;
  let highScore = parseInt(localStorage.getItem('stellar_echo_high') || '0', 10);
  statHighEl.textContent = highScore;

  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  const receiverRadius = 220;

  const dish = {
    angle: 0,
    arcWidth: Math.PI / 4 // 45 degree capture window
  };

  const keys = { left: false, right: false };
  let echoes = []; // expanding wave rings
  let spawnTimer = 0;

  function resetGame() {
    score = 0;
    captured = 0;
    clarity = 100;
    dish.angle = 0;
    echoes = [];
    spawnTimer = 0;
    updateUI();
  }

  function updateUI() {
    statScoreEl.textContent = score;
    statCapturedEl.textContent = captured;
    statClarityEl.textContent = `${Math.ceil(clarity)}%`;
  }

  function spawnEcho() {
    const angle = Math.random() * Math.PI * 2;
    echoes.push({
      angle: angle,
      radius: 10,
      expandSpeed: 2.2 + Math.min(2.5, captured * 0.05),
      isNoise: Math.random() < 0.25,
      captured: false
    });
  }

  function triggerCapture() {
    if (!isRunning || isPaused) return;
    sfx.init();

    for (let i = echoes.length - 1; i >= 0; i--) {
      const e = echoes[i];
      if (Math.abs(e.radius - receiverRadius) < 22) {
        let diff = Math.abs(e.angle - dish.angle);
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));

        if (Math.abs(diff) < dish.arcWidth / 2) {
          if (e.isNoise) {
            clarity -= 15;
            sfx.staticBurst();
          } else {
            captured++;
            score += 150;
            clarity = Math.min(100, clarity + 8);
            sfx.catchPing();
          }
          echoes.splice(i, 1);
          updateUI();
          return;
        }
      }
    }
  }

  function update() {
    if (!isRunning || isPaused) return;

    if (keys.left) dish.angle -= 0.06;
    if (keys.right) dish.angle += 0.06;

    spawnTimer++;
    if (spawnTimer > 45) {
      spawnEcho();
      spawnTimer = 0;
    }

    for (let i = echoes.length - 1; i >= 0; i--) {
      const e = echoes[i];
      e.radius += e.expandSpeed;

      if (e.radius > receiverRadius + 30) {
        if (!e.isNoise) {
          clarity -= 6;
          updateUI();
          if (clarity <= 0) {
            clarity = 0;
            endGame();
            return;
          }
        }
        echoes.splice(i, 1);
      }
    }
  }

  function endGame() {
    isRunning = false;
    sfx.staticBurst();
    if (animId) cancelAnimationFrame(animId);

    if (score > highScore) {
      highScore = score;
      localStorage.setItem('stellar_echo_high', highScore.toString());
      statHighEl.textContent = highScore;
    }

    finalCapturedEl.textContent = captured;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Orbit Perimeter Ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, receiverRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Central Radio Source
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Expanding Echo Waves
    for (const e of echoes) {
      ctx.save();
      const waveColor = e.isNoise ? '#ef4444' : '#00f0ff';
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(center.x, center.y, e.radius, e.angle - Math.PI / 6, e.angle + Math.PI / 6);
      ctx.stroke();
      ctx.restore();
    }

    // Dish Sensor Arc
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(center.x, center.y, receiverRadius, dish.angle - dish.arcWidth / 2, dish.angle + dish.arcWidth / 2);
    ctx.stroke();
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

  canvas.addEventListener('mousemove', (e) => {
    if (!isRunning || isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    dish.angle = Math.atan2(mouseY - center.y, mouseX - center.x);
  });

  canvas.addEventListener('click', triggerCapture);

  window.addEventListener('keydown', (e) => {
    sfx.init();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.code === 'Space') {
      triggerCapture();
      e.preventDefault();
    }
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
  btnCatch.addEventListener('click', triggerCapture);

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
