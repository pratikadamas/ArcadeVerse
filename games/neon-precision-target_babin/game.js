/**
 * Neon Precision Target
 * Cyber Archery & Bullseye Precision Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const stageDisplay = document.getElementById('stage-display');
  const scoreDisplay = document.getElementById('score-display');
  const arrowsDisplay = document.getElementById('arrows-display');
  const comboDisplay = document.getElementById('combo-display');
  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const stageClearOverlay = document.getElementById('stage-clear-overlay');
  const stageFailedOverlay = document.getElementById('stage-failed-overlay');
  const stageClearScore = document.getElementById('stage-clear-score');
  const stageClearHits = document.getElementById('stage-clear-hits');
  const stageClearTotal = document.getElementById('stage-clear-total');
  const stageFailedScore = document.getElementById('stage-failed-score');
  const stageFailedHits = document.getElementById('stage-failed-hits');
  const stageFailedReq = document.getElementById('stage-failed-req');
  const instructionsModal = document.getElementById('instructions-modal');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const nextStageBtn = document.getElementById('next-stage-btn');
  const retryStageBtn = document.getElementById('retry-stage-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const shootBtn = document.getElementById('shoot-arrow-btn');
  const finalScore = document.getElementById('final-score');
  const finalBullseyes = document.getElementById('final-bullseyes');
  const finalStreak = document.getElementById('final-streak');

  // Audio Synthesizer via Web Audio API
  let audioCtx = null;
  let soundEnabled = localStorage.getItem('neon-target-sound') !== 'false';

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function updateSoundUI() {
    if (soundEnabled) {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      soundBtn.setAttribute('aria-label', 'Mute Sound');
    } else {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
      soundBtn.setAttribute('aria-label', 'Unmute Sound');
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      if (type === 'shoot') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'bullseye') {
        [880, 1108, 1320, 1760].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.18, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.22);
        });
      } else if (type === 'deflect') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'stage_clear') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.18, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.22);
        });
      } else if (type === 'stage_failed') {
        [330, 261.63, 196].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.2, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.2);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.2);
        });
      }
    } catch (_) {}
  }

  // Game Constants & Entities
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const TOTAL_STAGES = 5;
  const MIN_HITS_TO_PASS = [0, 3, 3, 4, 4, 5];
  const MIN_STAGE_SCORE = [0, 75, 100, 150, 200, 250];

  let gameState = 'ready'; // ready, playing, stage_clear, stage_failed, gameover
  let stage = 1;
  let score = 0;
  let arrows = 10;
  let stageScore = 0;
  let stageHits = 0;
  let combo = 0;
  let maxCombo = 0;
  let bullseyesCount = 0;

  // Target Parameters
  let target = {
    x: WIDTH / 2,
    y: 150,
    baseX: WIDTH / 2,
    baseY: 150,
    radius: 70,
    time: 0
  };

  // Flying Arrow Entity
  let activeArrow = null;

  // Revolving Barrier Shields
  let barriers = [];
  let particles = [];
  let popups = [];

  function initStage(stageNum) {
    stage = stageNum;
    arrows = 10;
    stageScore = 0;
    stageHits = 0;
    activeArrow = null;
    particles = [];
    popups = [];
    target.time = 0;

    // Stage barrier and speed configuration
    barriers = [];
    if (stageNum === 3) {
      barriers.push({ angle: 0, speed: 0.035, arcLength: Math.PI * 0.45, radius: 95 });
    } else if (stageNum === 4) {
      barriers.push({ angle: 0, speed: 0.04, arcLength: Math.PI * 0.4, radius: 90 });
      barriers.push({ angle: Math.PI, speed: -0.03, arcLength: Math.PI * 0.4, radius: 110 });
    } else if (stageNum === 5) {
      barriers.push({ angle: 0, speed: 0.05, arcLength: Math.PI * 0.35, radius: 85 });
      barriers.push({ angle: Math.PI * 0.7, speed: -0.045, arcLength: Math.PI * 0.35, radius: 105 });
      barriers.push({ angle: Math.PI * 1.4, speed: 0.035, arcLength: Math.PI * 0.35, radius: 125 });
    }

    gameState = 'playing';
    startOverlay.classList.add('hidden');
    stageClearOverlay.classList.add('hidden');
    if (stageFailedOverlay) stageFailedOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    updateHUD();
  }

  function shootArrow() {
    if (gameState !== 'playing' || activeArrow || arrows <= 0) return;

    arrows--;
    playSound('shoot');
    updateHUD();

    activeArrow = {
      x: WIDTH / 2,
      y: HEIGHT - 30,
      vy: -14
    };
  }

  function spawnParticles(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  function spawnScorePopup(x, y, text, color) {
    popups.push({
      x,
      y,
      text,
      color,
      alpha: 1,
      vy: -1.2
    });
  }

  function checkArrowImpact() {
    if (!activeArrow) return;

    // Check collision with revolving barrier shields
    for (let b of barriers) {
      const distToTarget = Math.hypot(activeArrow.x - target.x, activeArrow.y - target.y);
      if (Math.abs(distToTarget - b.radius) < 14) {
        // Calculate angle of arrow relative to target
        let angle = Math.atan2(activeArrow.y - target.y, activeArrow.x - target.x);
        if (angle < 0) angle += Math.PI * 2;

        const startAngle = (b.angle) % (Math.PI * 2);
        const endAngle = (b.angle + b.arcLength) % (Math.PI * 2);

        let hitBarrier = false;
        if (startAngle < endAngle) {
          hitBarrier = angle >= startAngle && angle <= endAngle;
        } else {
          hitBarrier = angle >= startAngle || angle <= endAngle;
        }

        if (hitBarrier) {
          playSound('deflect');
          spawnParticles(activeArrow.x, activeArrow.y, '#ff0077', 16);
          spawnScorePopup(activeArrow.x, activeArrow.y - 10, 'DEFLECTED', '#ff0077');
          activeArrow = null;
          combo = 0;
          updateHUD();
          checkQuiverEmpty();
          return;
        }
      }
    }

    // Check collision with target rings
    const dist = Math.hypot(activeArrow.x - target.x, activeArrow.y - target.y);
    if (dist <= target.radius) {
      // Hit target!
      let points = 0;
      let text = '';
      let color = '';

      if (dist <= 12) {
        // Bullseye!
        points = 150;
        bullseyesCount++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        points *= combo;
        text = `BULLSEYE! +${points}`;
        color = '#ffffff';
        playSound('bullseye');
        spawnParticles(activeArrow.x, activeArrow.y, '#ffe600', 25);
      } else if (dist <= 28) {
        // Inner Magenta Ring
        points = 75;
        combo = Math.max(1, combo);
        text = `INNER +${points}`;
        color = '#ff0077';
        playSound('hit');
        spawnParticles(activeArrow.x, activeArrow.y, '#ff0077', 16);
      } else if (dist <= 48) {
        // Middle Yellow Ring
        points = 40;
        text = `MID +${points}`;
        color = '#ffe600';
        playSound('hit');
        spawnParticles(activeArrow.x, activeArrow.y, '#ffe600', 14);
      } else {
        // Outer Blue Ring
        points = 15;
        text = `OUTER +${points}`;
        color = '#00f0ff';
        playSound('hit');
        spawnParticles(activeArrow.x, activeArrow.y, '#00f0ff', 12);
      }

      stageHits++;
      stageScore += points;
      score += points;
      spawnScorePopup(activeArrow.x, activeArrow.y - 10, text, color);
      activeArrow = null;
      updateHUD();
      checkQuiverEmpty();
      return;
    }

    // Missed past top
    if (activeArrow.y < target.y - target.radius - 20) {
      activeArrow = null;
      combo = 0;
      updateHUD();
      checkQuiverEmpty();
    }
  }

  function checkQuiverEmpty() {
    if (arrows <= 0 && !activeArrow) {
      const minHits = MIN_HITS_TO_PASS[stage] || 3;
      const minScore = MIN_STAGE_SCORE[stage] || 75;
      const stagePassed = stageHits >= minHits && stageScore >= minScore;
      if (stagePassed) {
        if (stage < TOTAL_STAGES) {
          setTimeout(() => {
            gameState = 'stage_clear';
            playSound('stage_clear');
            if (stageClearScore) stageClearScore.textContent = stageScore;
            if (stageClearHits) stageClearHits.textContent = stageHits;
            if (stageClearTotal) stageClearTotal.textContent = score;
            stageClearOverlay.classList.remove('hidden');
            if (nextStageBtn) nextStageBtn.focus();
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'ARCADEVERSE_GAME_SCORE',
                  score: score
                }, '*');
              }
            } catch (_) {}
          }, 500);
        } else {
          setTimeout(() => {
            triggerGameOver(true);
          }, 500);
        }
      } else {
        setTimeout(() => {
          gameState = 'stage_failed';
          playSound('stage_failed');
          if (stageFailedScore) stageFailedScore.textContent = stageScore;
          if (stageFailedHits) stageFailedHits.textContent = stageHits;
          if (stageFailedReq) stageFailedReq.textContent = `${minHits} hits / ${minScore} pts`;
          if (stageFailedOverlay) stageFailedOverlay.classList.remove('hidden');
          if (retryStageBtn) retryStageBtn.focus();
        }, 500);
      }
    }
  }

  function triggerGameOver(isVictory = false) {
    gameState = 'gameover';
    finalScore.textContent = score;
    finalBullseyes.textContent = bullseyesCount;
    finalStreak.textContent = `${maxCombo}x`;
    const titleEl = gameoverOverlay.querySelector('.overlay-title');
    const descEl = gameoverOverlay.querySelector('.overlay-desc');
    if (isVictory) {
      if (titleEl) {
        titleEl.textContent = 'Range Champion!';
        titleEl.className = 'overlay-title win-text';
      }
      if (descEl) descEl.textContent = 'All stages cleared with precision!';
      playSound('bullseye');
    } else {
      if (titleEl) {
        titleEl.textContent = 'Quiver Depleted';
        titleEl.className = 'overlay-title gameover-text';
      }
      if (descEl) descEl.textContent = 'Range challenge concluded.';
    }
    gameoverOverlay.classList.remove('hidden');
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_OVER',
          score: score,
          details: {
            score: score,
            stagesCompleted: isVictory ? TOTAL_STAGES : Math.max(0, stage - 1),
            bullseyes: bullseyesCount,
            maxStreak: maxCombo
          }
        }, '*');
      }
    } catch (_) {}
  }

  function update() {
    if (gameState !== 'playing') return;

    target.time += 0.03;

    // Move target based on stage pattern
    if (stage === 1) {
      target.x = target.baseX;
      target.y = target.baseY;
    } else if (stage === 2) {
      // Horizontal oscillation
      target.x = target.baseX + Math.sin(target.time * 1.5) * 110;
    } else if (stage === 3) {
      target.x = target.baseX + Math.sin(target.time * 1.8) * 90;
      target.y = target.baseY + Math.cos(target.time * 1.2) * 25;
    } else if (stage === 4) {
      // Figure-8 motion
      target.x = target.baseX + Math.sin(target.time * 2.0) * 120;
      target.y = target.baseY + Math.sin(target.time * 4.0) * 35;
    } else if (stage === 5) {
      // Erratic fast motion
      target.x = target.baseX + Math.sin(target.time * 2.5) * 130;
      target.y = target.baseY + Math.cos(target.time * 3.2) * 45;
    }

    // Update Barriers
    for (let b of barriers) {
      b.angle += b.speed;
    }

    // Update Arrow
    if (activeArrow) {
      activeArrow.y += activeArrow.vy;
      checkArrowImpact();
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Update Popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const pop = popups[i];
      pop.y += pop.vy;
      pop.alpha -= 0.025;
      if (pop.alpha <= 0) popups.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Deep space range grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // Draw Concentric Target Rings
    const rings = [
      { r: 70, fill: '#0a1a36', stroke: '#00f0ff' }, // Outer Blue
      { r: 48, fill: '#25220c', stroke: '#ffe600' }, // Mid Yellow
      { r: 28, fill: '#360c22', stroke: '#ff0077' }, // Inner Magenta
      { r: 12, fill: '#ffffff', stroke: '#ffffff' }  // Bullseye White
    ];

    for (let ring of rings) {
      ctx.save();
      ctx.fillStyle = ring.fill;
      ctx.strokeStyle = ring.stroke;
      ctx.shadowColor = ring.stroke;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, ring.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Revolving Barrier Shields
    for (let b of barriers) {
      ctx.save();
      ctx.strokeStyle = '#ff0077';
      ctx.shadowColor = '#ff0077';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(target.x, target.y, b.radius, b.angle, b.angle + b.arcLength);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Active Flying Arrow
    if (activeArrow) {
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;

      // Shaft
      ctx.beginPath();
      ctx.moveTo(activeArrow.x, activeArrow.y);
      ctx.lineTo(activeArrow.x, activeArrow.y + 26);
      ctx.stroke();

      // Arrow tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(activeArrow.x, activeArrow.y - 6);
      ctx.lineTo(activeArrow.x - 5, activeArrow.y + 4);
      ctx.lineTo(activeArrow.x + 5, activeArrow.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw Quiver Launcher Base at Bottom
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT, 35, Math.PI, 0);
    ctx.stroke();

    // Aim crosshair indicator line
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, HEIGHT - 35);
    ctx.lineTo(WIDTH / 2, 40);
    ctx.stroke();
    ctx.restore();

    // Draw Particles
    for (let p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Score Popups
    for (let pop of popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.alpha);
      ctx.fillStyle = pop.color;
      ctx.font = '700 12px "Space Grotesk", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  function updateHUD() {
    stageDisplay.textContent = `${stage} / ${TOTAL_STAGES}`;
    scoreDisplay.textContent = score;
    arrowsDisplay.textContent = arrows;
    comboDisplay.textContent = `${combo}x`;
    if (combo >= 2) {
      comboDisplay.style.color = '#ffe600';
    } else {
      comboDisplay.style.color = 'var(--cyan)';
    }
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  // Event Listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      shootArrow();
    }
  });

  canvas.addEventListener('click', () => shootArrow());
  shootBtn.addEventListener('click', () => shootArrow());

  startBtn.addEventListener('click', () => {
    initAudio();
    score = 0;
    bullseyesCount = 0;
    combo = 0;
    maxCombo = 0;
    stageHits = 0;
    stageScore = 0;
    const titleEl = gameoverOverlay.querySelector('.overlay-title');
    const descEl = gameoverOverlay.querySelector('.overlay-desc');
    if (titleEl) {
      titleEl.textContent = 'Quiver Depleted';
      titleEl.className = 'overlay-title gameover-text';
    }
    if (descEl) descEl.textContent = 'Range challenge concluded.';
    initStage(1);
  });

  restartBtn.addEventListener('click', () => {
    score = 0;
    bullseyesCount = 0;
    combo = 0;
    maxCombo = 0;
    stageHits = 0;
    stageScore = 0;
    const titleEl = gameoverOverlay.querySelector('.overlay-title');
    const descEl = gameoverOverlay.querySelector('.overlay-desc');
    if (titleEl) {
      titleEl.textContent = 'Quiver Depleted';
      titleEl.className = 'overlay-title gameover-text';
    }
    if (descEl) descEl.textContent = 'Range challenge concluded.';
    initStage(1);
  });

  nextStageBtn.addEventListener('click', () => {
    initStage(stage + 1);
  });

  if (retryStageBtn) {
    retryStageBtn.addEventListener('click', () => {
      initStage(stage);
    });
  }

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('neon-target-sound', soundEnabled.toString());
    updateSoundUI();
    if (soundEnabled) playSound('shoot');
  });

  helpBtn.addEventListener('click', () => {
    instructionsModal.classList.remove('hidden');
  });

  closeHelpBtn.addEventListener('click', () => {
    instructionsModal.classList.add('hidden');
  });

  // Initialize
  updateSoundUI();
  updateHUD();
  gameLoop();
})();
