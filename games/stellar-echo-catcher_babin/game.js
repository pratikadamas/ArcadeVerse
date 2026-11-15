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
  const statFreqEl = document.getElementById('statFreq');

  const freqSlider = document.getElementById('freqSlider');
  const btnFreqMinus = document.getElementById('btnFreqMinus');
  const btnFreqPlus = document.getElementById('btnFreqPlus');

  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const rulesModal = document.getElementById('rulesModal');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnRules = document.getElementById('btnRules');
  const btnCloseRules = document.getElementById('btnCloseRules');
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
  const receiverRadius = 210;

  // Frequency spectrum parameters
  const MIN_FREQ = 88.0;
  const MAX_FREQ = 108.0;
  const FREQ_SPAN = MAX_FREQ - MIN_FREQ; // 20.0 MHz
  const FREQ_DAMPING = 0.18; // Smooth damping coefficient

  let targetFreq = 98.0;
  let currentFreq = 98.0;

  const dish = {
    angle: 0,
    arcWidth: Math.PI / 4 // 45 degree capture window
  };

  const keys = { left: false, right: false };
  let echoes = []; // expanding wave rings
  let spawnTimer = 0;

  function setTargetFrequency(freq, syncSlider = true) {
    // Clamp frequency slider cleanly between 88.0 and 108.0 MHz
    const clamped = Math.max(MIN_FREQ, Math.min(MAX_FREQ, Math.round(freq * 10) / 10));
    targetFreq = clamped;
    if (syncSlider && freqSlider) {
      freqSlider.value = targetFreq.toFixed(1);
    }
  }

  function resetGame() {
    score = 0;
    captured = 0;
    clarity = 100;
    targetFreq = 98.0;
    currentFreq = 98.0;
    dish.angle = -Math.PI / 2 + ((98.0 - MIN_FREQ) / FREQ_SPAN) * (Math.PI * 2);
    echoes = [];
    spawnTimer = 0;
    if (freqSlider) freqSlider.value = '98.0';
    updateUI();
  }

  function updateUI() {
    statScoreEl.textContent = score;
    statCapturedEl.textContent = captured;
    statClarityEl.textContent = `${Math.ceil(clarity)}%`;
    if (statFreqEl) {
      statFreqEl.textContent = `${currentFreq.toFixed(1)} MHz`;
    }
  }

  function spawnEcho() {
    const angle = Math.random() * Math.PI * 2;
    let norm = (angle - (-Math.PI / 2)) % (Math.PI * 2);
    if (norm < 0) norm += Math.PI * 2;
    const freq = MIN_FREQ + (norm / (Math.PI * 2)) * FREQ_SPAN;

    echoes.push({
      angle: angle,
      frequency: Math.round(freq * 10) / 10,
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
      if (Math.abs(e.radius - receiverRadius) < 26) {
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

    if (keys.left) setTargetFrequency(targetFreq - 0.1);
    if (keys.right) setTargetFrequency(targetFreq + 0.1);

    // Normalize needle glide using smooth damping coefficient
    if (Math.abs(targetFreq - currentFreq) > 0.005) {
      currentFreq += (targetFreq - currentFreq) * FREQ_DAMPING;
    } else {
      currentFreq = targetFreq;
    }

    // Synchronize dish angle with smoothly gliding frequency
    const freqRatio = (currentFreq - MIN_FREQ) / FREQ_SPAN;
    dish.angle = -Math.PI / 2 + freqRatio * (Math.PI * 2);

    if (statFreqEl) {
      statFreqEl.textContent = `${currentFreq.toFixed(1)} MHz`;
    }

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

    // 1. Orbit Perimeter Ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, receiverRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Frequency Spectrum Dial Ticks & Legend around perimeter
    ctx.save();
    const tickCount = 20; // 1 tick per MHz across 20 MHz span
    for (let i = 0; i <= tickCount; i++) {
      const f = MIN_FREQ + i;
      const angle = -Math.PI / 2 + (i / tickCount) * (Math.PI * 2);
      const isMajor = i % 5 === 0;
      const rInner = receiverRadius - (isMajor ? 12 : 6);
      const rOuter = receiverRadius + (isMajor ? 8 : 4);

      ctx.strokeStyle = isMajor ? 'rgba(56, 189, 248, 0.7)' : 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(angle) * rInner, center.y + Math.sin(angle) * rInner);
      ctx.lineTo(center.x + Math.cos(angle) * rOuter, center.y + Math.sin(angle) * rOuter);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rText = receiverRadius + 20;
        ctx.fillText(`${f}`, center.x + Math.cos(angle) * rText, center.y + Math.sin(angle) * rText);
      }
    }
    ctx.restore();

    // 3. Central Radio Source / Tuning Hub
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Expanding Echo Waves (with frequency markers)
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

      if (e.radius > 60 && !e.isNoise) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        const tagX = center.x + Math.cos(e.angle) * e.radius;
        const tagY = center.y + Math.sin(e.angle) * e.radius;
        ctx.fillText(`${e.frequency.toFixed(1)}M`, tagX, tagY - 6);
      }
      ctx.restore();
    }

    // 5. Dish Sensor Arc
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

    // 6. Smooth Gliding Frequency Tuner Needle
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(dish.angle) * (receiverRadius - 2), center.y + Math.sin(dish.angle) * (receiverRadius - 2));
    ctx.stroke();

    // Needle indicator tip
    const tipX = center.x + Math.cos(dish.angle) * receiverRadius;
    const tipY = center.y + Math.sin(dish.angle) * receiverRadius;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 7. Live Digital Frequency Readout
    ctx.save();
    ctx.fillStyle = 'rgba(240, 249, 255, 0.9)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${currentFreq.toFixed(1)} MHz`, center.x, center.y + 24);
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

  // Pointer dragging / canvas rotation
  let isPointerDragging = false;
  function updateFromPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((clientY - rect.top) / rect.height) * canvas.height;
    const mouseAngle = Math.atan2(mouseY - center.y, mouseX - center.x);
    let normalized = (mouseAngle - (-Math.PI / 2)) % (Math.PI * 2);
    if (normalized < 0) normalized += Math.PI * 2;
    const calcFreq = MIN_FREQ + (normalized / (Math.PI * 2)) * FREQ_SPAN;
    setTargetFrequency(calcFreq);
  }

  canvas.addEventListener('pointerdown', (e) => {
    isPointerDragging = true;
    updateFromPointer(e.clientX, e.clientY);
  });

  window.addEventListener('pointermove', (e) => {
    if (!isPointerDragging || !isRunning || isPaused) return;
    updateFromPointer(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', () => {
    isPointerDragging = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isRunning || isPaused || isPointerDragging) return;
    updateFromPointer(e.clientX, e.clientY);
  });

  canvas.addEventListener('click', triggerCapture);

  // Normalize wheel event deltaY using Math.sign(e.deltaY) and smooth damping coefficient
  function handleWheel(e) {
    e.preventDefault();
    if (!isRunning || isPaused) return;
    sfx.init();

    const dir = Math.sign(e.deltaY);
    if (dir !== 0) {
      // dir > 0: wheel scrolled downward -> step down 0.1 MHz; dir < 0: step up 0.1 MHz
      setTargetFrequency(targetFreq - dir * 0.1);
    }
  }

  canvas.addEventListener('wheel', handleWheel, { passive: false });
  const tunerPanel = document.querySelector('.tuner-panel');
  if (tunerPanel) {
    tunerPanel.addEventListener('wheel', handleWheel, { passive: false });
  }

  // On-screen plus / minus touch buttons for precise incremental adjustments
  function bindStepButton(btn, stepDelta) {
    if (!btn) return;
    let timer = null;

    const doStep = () => {
      sfx.init();
      setTargetFrequency(targetFreq + stepDelta);
    };

    const stop = () => {
      if (timer) {
        clearTimeout(timer);
        clearInterval(timer);
        timer = null;
      }
    };

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      doStep();
      timer = setTimeout(() => {
        timer = setInterval(doStep, 80);
      }, 300);
    });

    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  }

  bindStepButton(btnFreqMinus, -0.1);
  bindStepButton(btnFreqPlus, 0.1);

  // Frequency slider change listener
  if (freqSlider) {
    freqSlider.addEventListener('input', (e) => {
      sfx.init();
      const val = parseFloat(e.target.value);
      setTargetFrequency(val, false);
    });
  }

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

  // Hub modal lifecycle listeners
  window.addEventListener('message', (e) => {
    if (!e || !e.data) return;
    if (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE') {
      if (sfx.ctx && typeof sfx.ctx.suspend === 'function') {
        sfx.ctx.suspend().catch(() => {});
      }
    }
  });
})();