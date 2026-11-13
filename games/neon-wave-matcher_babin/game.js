/**
 * Neon Wave Matcher
 * Audio Oscilloscope Signal Decryption Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const signalDisplay = document.getElementById('signal-display');
  const matchDisplay = document.getElementById('match-display');
  const timeDisplay = document.getElementById('time-display');
  const scoreDisplay = document.getElementById('score-display');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const finalScore = document.getElementById('final-score');
  const finalSignals = document.getElementById('final-signals');

  // Sliders
  const freqSlider = document.getElementById('freq-slider');
  const ampSlider = document.getElementById('amp-slider');
  const phaseSlider = document.getElementById('phase-slider');
  const freqVal = document.getElementById('freq-val');
  const ampVal = document.getElementById('amp-val');
  const phaseVal = document.getElementById('phase-val');

  // Audio Synthesizer via Web Audio API
  let audioCtx = null;
  let activeOsc = null;
  let activeGain = null;
  const activeNodes = new Set();
  let soundEnabled = localStorage.getItem('neon-wave-sound') !== 'false';

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function trackNode(osc) {
    activeNodes.add(osc);
    osc.onended = () => {
      activeNodes.delete(osc);
    };
    return osc;
  }

  function stopAllAudio() {
    stopDrone();
    activeNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (_) {}
    });
    activeNodes.clear();
  }

  function startDrone() {
    if (!soundEnabled || activeOsc) return;
    try {
      initAudio();
      if (!audioCtx) return;
      activeOsc = audioCtx.createOscillator();
      activeGain = audioCtx.createGain();
      activeOsc.type = 'sine';
      activeOsc.frequency.setValueAtTime(220, audioCtx.currentTime);
      activeGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      activeOsc.connect(activeGain);
      activeGain.connect(audioCtx.destination);
      trackNode(activeOsc);
      activeOsc.start();
    } catch (_) {}
  }

  function updateDronePitch(freq) {
    if (!activeOsc || !audioCtx) return;
    try {
      activeOsc.frequency.setValueAtTime(140 + freq * 80, audioCtx.currentTime);
    } catch (_) {}
  }

  function stopDrone() {
    if (activeOsc) {
      try {
        activeNodes.delete(activeOsc);
        activeOsc.stop();
        activeOsc.disconnect();
      } catch (_) {}
      activeOsc = null;
      activeGain = null;
    }
  }

  function updateSoundUI() {
    if (soundEnabled) {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      soundBtn.setAttribute('aria-label', 'Mute Sound');
      if (gameState === 'playing') startDrone();
    } else {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
      soundBtn.setAttribute('aria-label', 'Unmute Sound');
      stopAllAudio();
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      if (type === 'lock') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.18, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          trackNode(osc);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.25);
        });
      } else if (type === 'fail') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.45);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        trackNode(osc);
        osc.start(now);
        osc.stop(now + 0.48);
      }
    } catch (_) {}
  }

  // Game Constants & State
  const TOTAL_SIGNALS = 10;
  let gameState = 'ready'; // ready, playing, gameover
  let currentSignal = 1;
  let score = 0;
  let timeLeft = 30;
  let timerInterval = null;
  let signalsDecrypted = 0;

  // Target Wave parameters
  let targetWave = {
    freq: 3.0,
    amp: 55,
    phase: 1.2
  };

  // Player Wave parameters
  let playerWave = {
    freq: 2.0,
    amp: 40,
    phase: 0.0
  };

  let waveOffsetTime = 0;

  function generateTargetSignal() {
    // Random parameters ensuring varied wave forms
    targetWave.freq = parseFloat((Math.random() * 4.0 + 1.5).toFixed(1));
    targetWave.amp = Math.floor(Math.random() * 45 + 30);
    targetWave.phase = parseFloat((Math.random() * 5.0 + 0.5).toFixed(2));
    timeLeft = Math.max(16, 30 - currentSignal * 1.2);
  }

  function resetGame() {
    stopAllAudio();
    score = 0;
    currentSignal = 1;
    signalsDecrypted = 0;
    generateTargetSignal();

    // Reset player sliders to initial default
    playerWave.freq = 2.0;
    playerWave.amp = 40;
    playerWave.phase = 0.0;
    freqSlider.value = "2.0";
    ampSlider.value = "40";
    phaseSlider.value = "0.0";
    updateSliderLabels();

    gameState = 'playing';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    startDrone();
    updateHUD();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (gameState !== 'playing') return;
      timeLeft--;
      if (timeLeft <= 0) {
        triggerGameOver();
      }
      updateHUD();
    }, 1000);
  }

  function updateSliderLabels() {
    freqVal.textContent = parseFloat(freqSlider.value).toFixed(1);
    ampVal.textContent = ampSlider.value;
    phaseVal.textContent = parseFloat(phaseSlider.value).toFixed(2);

    playerWave.freq = parseFloat(freqSlider.value);
    playerWave.amp = parseFloat(ampSlider.value);
    playerWave.phase = parseFloat(phaseSlider.value);
    updateDronePitch(playerWave.freq);
  }

  function calculateAccuracy() {
    // Sample 60 points across canvas width
    let totalError = 0;
    const samples = 60;

    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * Math.PI * 2;
      const yTarget = Math.sin(x * targetWave.freq + targetWave.phase) * targetWave.amp;
      const yPlayer = Math.sin(x * playerWave.freq + playerWave.phase) * playerWave.amp;
      totalError += Math.abs(yTarget - yPlayer);
    }

    const meanError = totalError / samples;
    // Map mean error to accuracy percentage
    const accuracy = Math.max(0, Math.min(100, Math.floor(100 - meanError * 1.55)));
    return accuracy;
  }

  function checkLock() {
    const accuracy = calculateAccuracy();
    if (accuracy >= 95) {
      // Signal successfully decrypted!
      playSound('lock');
      signalsDecrypted++;
      const timeBonus = Math.floor(timeLeft * 25);
      const signalScore = 300 + timeBonus;
      score += signalScore;

      if (currentSignal >= TOTAL_SIGNALS) {
        // Grand victory!
        triggerGameOver();
        return;
      }

      currentSignal++;
      generateTargetSignal();
      updateHUD();
    }
  }

  function triggerGameOver() {
    gameState = 'gameover';
    stopAllAudio();
    playSound('fail');
    if (timerInterval) clearInterval(timerInterval);

    finalScore.textContent = score;
    finalSignals.textContent = signalsDecrypted;
    gameoverOverlay.classList.remove('hidden');
  }

  function updateHUD() {
    signalDisplay.textContent = `${currentSignal} / ${TOTAL_SIGNALS}`;
    timeDisplay.textContent = `${timeLeft}s`;
    if (timeLeft <= 7) {
      timeDisplay.style.color = 'var(--neon-magenta)';
    } else {
      timeDisplay.style.color = 'var(--cyan)';
    }
    scoreDisplay.textContent = score;

    const acc = calculateAccuracy();
    matchDisplay.textContent = `${acc}%`;
    if (acc >= 90) {
      matchDisplay.style.color = '#00ff88';
    } else if (acc >= 75) {
      matchDisplay.style.color = '#ffe600';
    } else {
      matchDisplay.style.color = 'var(--cyan)';
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height / 2;
    waveOffsetTime += 0.025;

    // Draw CRT Oscilloscope Grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Center Baseline
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    // Render Target Waveform (Magenta)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 119, 0.75)';
    ctx.shadowColor = '#ff0077';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x++) {
      const progress = (x / canvas.width) * (Math.PI * 2);
      const y = centerY + Math.sin(progress * targetWave.freq + targetWave.phase + waveOffsetTime) * targetWave.amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Render Tuned Player Waveform (Cyan)
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x++) {
      const progress = (x / canvas.width) * (Math.PI * 2);
      const y = centerY + Math.sin(progress * playerWave.freq + playerWave.phase + waveOffsetTime) * playerWave.amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function gameLoop() {
    render();
    if (gameState === 'playing') {
      checkLock();
    }
    requestAnimationFrame(gameLoop);
  }

  // Sliders input
  freqSlider.addEventListener('input', () => {
    updateSliderLabels();
    updateHUD();
  });

  ampSlider.addEventListener('input', () => {
    updateSliderLabels();
    updateHUD();
  });

  phaseSlider.addEventListener('input', () => {
    updateSliderLabels();
    updateHUD();
  });

  startBtn.addEventListener('click', () => {
    initAudio();
    resetGame();
  });

  restartBtn.addEventListener('click', () => {
    resetGame();
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('neon-wave-sound', soundEnabled.toString());
    updateSoundUI();
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  window.addEventListener('message', (e) => {
    if (e.data && (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE')) {
      stopAllAudio();
    }
  });

  // Initialize
  updateSoundUI();
  updateSliderLabels();
  generateTargetSignal();
  updateHUD();
  gameLoop();
})();
