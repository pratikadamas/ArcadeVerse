/**
 * Cyber Swarm Assault
 * Vertical Space Combat Shmup Arcade
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse
 */

(() => {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const waveDisplay = document.getElementById('wave-display');
  const scoreDisplay = document.getElementById('score-display');
  const bestDisplay = document.getElementById('best-display');
  const livesDisplay = document.getElementById('lives-display');
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
  const moveLeftBtn = document.getElementById('move-left-btn');
  const moveRightBtn = document.getElementById('move-right-btn');
  const fireBtn = document.getElementById('fire-btn');
  const finalScore = document.getElementById('final-score');
  const finalWave = document.getElementById('final-wave');
  const finalKills = document.getElementById('final-kills');

  // Audio Synthesizer via Web Audio API (#507)
  let audioCtx = null;
  let masterGain = null;
  let limiterNode = null;
  const activeVoices = new Set();
  const MAX_VOICES = 6;
  let soundEnabled = localStorage.getItem('cyber-swarm-sound') !== 'false';

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && !masterGain) {
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      try {
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-0.5, audioCtx.currentTime);
        comp.knee.setValueAtTime(0, audioCtx.currentTime);
        comp.ratio.setValueAtTime(20.0, audioCtx.currentTime);
        comp.attack.setValueAtTime(0.001, audioCtx.currentTime);
        comp.release.setValueAtTime(0.05, audioCtx.currentTime);
        limiterNode = comp;
        masterGain.connect(limiterNode);
        limiterNode.connect(audioCtx.destination);
      } catch (_) {
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function trackVoice(node) {
    if (!node) return node;
    while (activeVoices.size >= MAX_VOICES) {
      const oldest = activeVoices.values().next().value;
      if (oldest) {
        try {
          if (typeof oldest.stop === 'function') oldest.stop();
          if (typeof oldest.disconnect === 'function') oldest.disconnect();
        } catch (_) {}
        activeVoices.delete(oldest);
      } else {
        break;
      }
    }
    activeVoices.add(node);
    const onEnded = () => {
      activeVoices.delete(node);
    };
    if (typeof node.addEventListener === 'function') {
      node.addEventListener('ended', onEnded, { once: true });
    } else {
      node.onended = onEnded;
    }
    return node;
  }

  function stopAllAudio() {
    activeVoices.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch (_) {}
    });
    activeVoices.clear();
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

      if (type === 'laser') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(masterGain || audioCtx.destination);
        trackVoice(osc);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'explode') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(masterGain || audioCtx.destination);
        trackVoice(osc);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'dive') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.25);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(masterGain || audioCtx.destination);
        trackVoice(osc);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'gameover') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.5);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
        osc.connect(gain);
        gain.connect(masterGain || audioCtx.destination);
        trackVoice(osc);
        osc.start(now);
        osc.stop(now + 0.52);
      }
    } catch (_) {}
  }

  // Game Constants & Entities
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  let gameState = 'ready'; // ready, playing, gameover
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('cyber-swarm-best') || '0', 10);
  let wave = 1;
  let lives = 3;
  let totalKills = 0;

  // Player Ship
  let player = {
    x: WIDTH / 2,
    y: HEIGHT - 45,
    width: 28,
    height: 24,
    speed: 5.5,
    hasDualLaser: false,
    dualTimer: 0,
    hasShield: false,
    invincibleTimer: 0
  };

  const keys = { left: false, right: false, fire: false };
  let fireCooldown = 0;

  // Projectiles & Enemies
  let playerLasers = [];
  let enemyLasers = [];
  let enemies = [];
  let particles = [];
  let powerups = [];

  // Formation sway state
  let formationSwayX = 0;
  let formationSwayDir = 1;
  let diveTimer = 0;

  function initWave(waveNum) {
    wave = waveNum;
    enemies = [];
    playerLasers = [];
    enemyLasers = [];
    powerups = [];
    particles = [];

    const rows = 3;
    const cols = 6;
    const spacingX = 54;
    const spacingY = 38;
    const startX = (WIDTH - (cols - 1) * spacingX) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          homeX: startX + c * spacingX,
          homeY: 60 + r * spacingY,
          x: startX + c * spacingX,
          y: 60 + r * spacingY,
          width: 22,
          height: 18,
          isDiving: false,
          diveAngle: 0,
          diveSpeed: 2.4 + Math.min(2.5, waveNum * 0.25),
          type: r === 0 ? 'commander' : r === 1 ? 'raider' : 'drone',
          color: r === 0 ? '#ff0077' : r === 1 ? '#ffe600' : '#00f0ff'
        });
      }
    }

    gameState = 'playing';
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    updateHUD();
  }

  function firePlayerWeapon() {
    if (fireCooldown > 0) return;
    fireCooldown = 12;
    playSound('laser');

    if (player.hasDualLaser) {
      playerLasers.push({ x: player.x - 8, y: player.y - 12, vx: 0, vy: -8.5 });
      playerLasers.push({ x: player.x + 8, y: player.y - 12, vx: 0, vy: -8.5 });
    } else {
      playerLasers.push({ x: player.x, y: player.y - 12, vx: 0, vy: -8.5 });
    }
  }

  function launchEnemyDiver() {
    const available = enemies.filter(e => !e.isDiving);
    if (available.length === 0) return;
    const diver = available[Math.floor(Math.random() * available.length)];
    diver.isDiving = true;
    diver.diveAngle = Math.atan2(player.y - diver.y, player.x - diver.x);
    playSound('dive');
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.5;
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

  function triggerPlayerHit() {
    if (player.invincibleTimer > 0) return;

    if (player.hasShield) {
      player.hasShield = false;
      player.invincibleTimer = 45;
      playSound('explode');
      spawnExplosion(player.x, player.y, '#00f0ff');
      return;
    }

    lives--;
    playSound('explode');
    spawnExplosion(player.x, player.y, '#ff0077');
    player.invincibleTimer = 90;
    updateHUD();

    if (lives <= 0) {
      gameState = 'gameover';
      playSound('gameover');
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('cyber-swarm-best', bestScore.toString());
      }
      finalScore.textContent = score;
      finalWave.textContent = wave;
      finalKills.textContent = totalKills;
      gameoverOverlay.classList.remove('hidden');
    }
  }

  function update() {
    if (gameState !== 'playing') return;

    if (fireCooldown > 0) fireCooldown--;
    if (player.invincibleTimer > 0) player.invincibleTimer--;
    if (player.dualTimer > 0) {
      player.dualTimer--;
      if (player.dualTimer <= 0) player.hasDualLaser = false;
    }

    // Player Movement
    if (keys.left) player.x = Math.max(player.width / 2, player.x - player.speed);
    if (keys.right) player.x = Math.min(WIDTH - player.width / 2, player.x + player.speed);
    if (keys.fire) firePlayerWeapon();

    // Formation Sway
    formationSwayX += formationSwayDir * 0.7;
    if (Math.abs(formationSwayX) > 28) formationSwayDir *= -1;

    // Diver scheduling
    diveTimer++;
    const diveInterval = Math.max(50, 110 - wave * 10);
    if (diveTimer >= diveInterval) {
      diveTimer = 0;
      launchEnemyDiver();
    }

    // Update Player Lasers
    for (let i = playerLasers.length - 1; i >= 0; i--) {
      const l = playerLasers[i];
      l.y += l.vy;

      if (l.y < -10) {
        playerLasers.splice(i, 1);
        continue;
      }

      // Check collision with enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.hypot(l.x - e.x, l.y - e.y) < 16) {
          spawnExplosion(e.x, e.y, e.color);
          playSound('explode');
          const points = e.isDiving ? 200 : 100;
          score += points;
          totalKills++;

          // Chance to drop powerup from commanders
          if (e.type === 'commander' && Math.random() < 0.4) {
            powerups.push({
              x: e.x,
              y: e.y,
              type: Math.random() > 0.5 ? 'dual' : 'shield',
              vy: 2.2
            });
          }

          enemies.splice(j, 1);
          playerLasers.splice(i, 1);
          updateHUD();
          break;
        }
      }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.isDiving) {
        e.y += Math.sin(e.diveAngle) * e.diveSpeed;
        e.x += Math.cos(e.diveAngle) * e.diveSpeed;

        // Enemy shoots plasma bolt during dive
        if (Math.random() < 0.02) {
          enemyLasers.push({ x: e.x, y: e.y + 10, vy: 4.8 });
        }

        // Check collision with player
        if (Math.hypot(e.x - player.x, e.y - player.y) < 22) {
          triggerPlayerHit();
          enemies.splice(i, 1);
          continue;
        }

        // Return to formation if out of bottom
        if (e.y > HEIGHT + 20) {
          e.y = -20;
          e.x = e.homeX;
          e.isDiving = false;
        }
      } else {
        // Sway in formation
        e.x = e.homeX + formationSwayX;
      }
    }

    // Update Enemy Lasers
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
      const el = enemyLasers[i];
      el.y += el.vy;

      if (el.y > HEIGHT + 10) {
        enemyLasers.splice(i, 1);
        continue;
      }

      if (Math.hypot(el.x - player.x, el.y - player.y) < 18) {
        triggerPlayerHit();
        enemyLasers.splice(i, 1);
      }
    }

    // Update Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy;

      if (Math.hypot(p.x - player.x, p.y - player.y) < 22) {
        if (p.type === 'dual') {
          player.hasDualLaser = true;
          player.dualTimer = 600; // 10 seconds
        } else {
          player.hasShield = true;
        }
        powerups.splice(i, 1);
        score += 50;
        updateHUD();
        continue;
      }

      if (p.y > HEIGHT + 20) powerups.splice(i, 1);
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Check wave cleared
    if (enemies.length === 0) {
      score += 500;
      initWave(wave + 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Deep space stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 45; i++) {
      const sx = (i * 67 + 23) % WIDTH;
      const sy = (i * 43 + 17) % HEIGHT;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Draw Player Lasers
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    for (let l of playerLasers) {
      ctx.fillRect(l.x - 2, l.y - 8, 4, 16);
    }
    ctx.shadowBlur = 0;

    // Draw Enemy Lasers
    ctx.fillStyle = '#ff0077';
    ctx.shadowColor = '#ff0077';
    ctx.shadowBlur = 8;
    for (let el of enemyLasers) {
      ctx.fillRect(el.x - 2, el.y, 4, 12);
    }
    ctx.shadowBlur = 0;

    // Draw Powerups
    for (let p of powerups) {
      ctx.save();
      ctx.fillStyle = p.type === 'dual' ? '#ffe600' : '#00ff88';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Enemies
    for (let e of enemies) {
      ctx.save();
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.height / 2);
      ctx.lineTo(e.x + e.width / 2, e.y + e.height / 2);
      ctx.lineTo(e.x, e.y + e.height / 4);
      ctx.lineTo(e.x - e.width / 2, e.y + e.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw Player Ship
    if (player.invincibleTimer === 0 || Math.floor(player.invincibleTimer / 4) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(player.x, player.y - player.height / 2);
      ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2);
      ctx.lineTo(player.x, player.y + player.height / 4);
      ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2);
      ctx.closePath();
      ctx.fill();

      // Shield sphere
      if (player.hasShield) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.width * 0.9, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Particles
    for (let p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateHUD() {
    waveDisplay.textContent = wave;
    scoreDisplay.textContent = score;
    bestDisplay.textContent = bestScore;
    livesDisplay.textContent = lives;
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  // Keyboard Event Listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = true;
    } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      keys.fire = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      keys.left = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      keys.right = false;
    } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      keys.fire = false;
    }
  });

  // Mobile Touch Buttons
  const setupHoldBtn = (btn, keyProp) => {
    const press = (e) => {
      e.preventDefault();
      keys[keyProp] = true;
    };
    const release = (e) => {
      e.preventDefault();
      keys[keyProp] = false;
    };
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
  };

  setupHoldBtn(moveLeftBtn, 'left');
  setupHoldBtn(moveRightBtn, 'right');
  setupHoldBtn(fireBtn, 'fire');

  // Canvas Direct Touch Drag
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      player.x = (e.touches[0].clientX - rect.left) * scaleX;
      firePlayerWeapon();
    }
  }, { passive: true });

  startBtn.addEventListener('click', () => {
    stopAllAudio();
    initAudio();
    score = 0;
    lives = 3;
    totalKills = 0;
    initWave(1);
  });

  restartBtn.addEventListener('click', () => {
    stopAllAudio();
    score = 0;
    lives = 3;
    totalKills = 0;
    initWave(1);
  });

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('cyber-swarm-sound', soundEnabled.toString());
    updateSoundUI();
    if (soundEnabled) playSound('laser');
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

  // Clean audio on teardown (#507)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ARCADEVERSE_TEARDOWN') {
      stopAllAudio();
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close(); } catch (_) {}
      }
    }
  });
})();
