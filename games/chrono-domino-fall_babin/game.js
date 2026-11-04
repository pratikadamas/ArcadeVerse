/* Chrono Domino Fall - game.js */
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
    place() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      } catch (e) {}
    }
    clack(pitch = 300) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
      } catch (e) {}
    }
    victory() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          gain.gain.setValueAtTime(0.14, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.2);
        });
      } catch (e) {}
    }
  }

  const sfx = new SoundFX();

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const statLevelEl = document.getElementById('statLevel');
  const statRemainingEl = document.getElementById('statRemaining');
  const statFallenEl = document.getElementById('statFallen');
  const statScoreEl = document.getElementById('statScore');

  const startScreen = document.getElementById('startScreen');
  const winScreen = document.getElementById('winScreen');
  const failScreen = document.getElementById('failScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnNextLevel = document.getElementById('btnNextLevel');
  const btnRetry = document.getElementById('btnRetry');
  const btnTopple = document.getElementById('btnTopple');
  const btnClear = document.getElementById('btnClear');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
  const btnMute = document.getElementById('btnMute');
  const btnRestartNav = document.getElementById('btnRestartNav');

  let level = 1;
  let score = 0;
  let availableDominoes = 3;
  let isToppling = false;
  let toppleIndex = 0;
  let toppleTimer = 0;

  let dominoSlots = [];

  function setupLevel() {
    isToppling = false;
    toppleIndex = 0;
    toppleTimer = 0;
    availableDominoes = 3 + Math.floor(level / 2);

    dominoSlots = [];
    const totalSlots = 14 + level * 2;
    const startX = 60;
    const endX = canvas.width - 60;
    const gap = (endX - startX) / (totalSlots - 1);

    for (let i = 0; i < totalSlots; i++) {
      const isPrePlaced = i === 0 || i === totalSlots - 1 || (i % 4 === 0 && Math.random() < 0.5);
      dominoSlots.push({
        x: startX + i * gap,
        y: canvas.height / 2 + Math.sin(i * 0.4) * 50,
        hasDomino: isPrePlaced,
        isFixed: isPrePlaced,
        fallen: false,
        angle: 0
      });
    }

    dominoSlots[0].hasDomino = true;
    dominoSlots[0].isFixed = true;

    updateUI();
  }

  function updateUI() {
    statLevelEl.textContent = level;
    statRemainingEl.textContent = availableDominoes;
    const fallenCount = dominoSlots.filter(s => s.fallen).length;
    statFallenEl.textContent = `${Math.round((fallenCount / dominoSlots.length) * 100)}%`;
    statScoreEl.textContent = score;
  }

  function startTopple() {
    if (isToppling) return;
    sfx.init();
    isToppling = true;
    toppleIndex = 0;
    toppleTimer = 0;
  }

  function update() {
    if (!isToppling) return;

    toppleTimer++;
    if (toppleTimer % 5 === 0) {
      if (toppleIndex < dominoSlots.length) {
        const cur = dominoSlots[toppleIndex];
        if (cur.hasDomino) {
          cur.fallen = true;
          cur.angle = Math.PI / 4;
          sfx.clack(240 + toppleIndex * 20);
          score += 15;
          toppleIndex++;
          updateUI();
        } else {
          // Chain broke!
          isToppling = false;
          setTimeout(() => {
            failScreen.classList.remove('hidden');
          }, 400);
          return;
        }
      } else {
        // Successfully reached target terminal
        isToppling = false;
        sfx.victory();
        score += level * 250;
        updateUI();
        setTimeout(() => {
          winScreen.classList.remove('hidden');
        }, 500);
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Guide Path
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < dominoSlots.length; i++) {
      const s = dominoSlots[i];
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    // Goal Target Beacon
    const last = dominoSlots[dominoSlots.length - 1];
    if (last) {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Slots & Dominoes
    for (let i = 0; i < dominoSlots.length; i++) {
      const s = dominoSlots[i];

      // Empty slot circle
      ctx.strokeStyle = s.hasDomino ? 'transparent' : 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      if (s.hasDomino) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);

        ctx.fillStyle = s.isFixed ? '#a855f7' : '#ec4899';
        ctx.shadowColor = s.isFixed ? '#a855f7' : '#f43f5e';
        ctx.shadowBlur = 8;
        ctx.fillRect(-4, -18, 8, 36);

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -6, 2, 0, Math.PI * 2);
        ctx.arc(0, 6, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('click', (e) => {
    if (isToppling) return;
    sfx.init();

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    for (const s of dominoSlots) {
      if (!s.isFixed && Math.hypot(clickX - s.x, clickY - s.y) < 18) {
        if (!s.hasDomino && availableDominoes > 0) {
          s.hasDomino = true;
          availableDominoes--;
          sfx.place();
        } else if (s.hasDomino) {
          s.hasDomino = false;
          availableDominoes++;
        }
        updateUI();
        break;
      }
    }
  });

  btnTopple.addEventListener('click', startTopple);
  btnClear.addEventListener('click', () => {
    if (isToppling) return;
    for (const s of dominoSlots) {
      if (!s.isFixed && s.hasDomino) {
        s.hasDomino = false;
        availableDominoes++;
      }
    }
    updateUI();
  });

  btnStart.addEventListener('click', () => {
    sfx.init();
    level = 1;
    score = 0;
    startScreen.classList.add('hidden');
    setupLevel();
  });

  btnNextLevel.addEventListener('click', () => {
    level++;
    winScreen.classList.add('hidden');
    setupLevel();
  });

  btnRetry.addEventListener('click', () => {
    failScreen.classList.add('hidden');
    for (const s of dominoSlots) {
      s.fallen = false;
      s.angle = 0;
    }
    isToppling = false;
    updateUI();
  });

  btnRestartNav.addEventListener('click', setupLevel);
  btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.classList.toggle('active', sfx.muted);
  });

  setupLevel();
  requestAnimationFrame(loop);
})();
