/**
 * Cosmic Surge: Galaxy Defender
 * Author: Debasmita Bose (@DebasmitaBose0)
 * ArcadeVerse - Nexus Spring of Code 2026
 * Pure Vanilla HTML5 Canvas & Web Audio API
 */

(function () {
  'use strict';

  // --- Web Audio Procedural Synthesizer ---
  const Sound = {
    ctx: null,
    masterGain: null,
    limiter: null,
    muted: false,
    activeVoices: new Set(),
    maxVoices: 6,

    init() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        // AudioContext not available
      }
      if (this.ctx && !this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        try {
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-0.5, this.ctx.currentTime);
          comp.knee.setValueAtTime(0, this.ctx.currentTime);
          comp.ratio.setValueAtTime(20.0, this.ctx.currentTime);
          comp.attack.setValueAtTime(0.001, this.ctx.currentTime);
          comp.release.setValueAtTime(0.05, this.ctx.currentTime);
          this.limiter = comp;
          this.masterGain.connect(this.limiter);
          this.limiter.connect(this.ctx.destination);
        } catch (_) {
          this.masterGain.connect(this.ctx.destination);
        }
      }
      this.muted = localStorage.getItem('cosmic_surge_muted') === 'true';
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    trackVoice(node) {
      if (!node) return node;
      if (!this.activeVoices) this.activeVoices = new Set();
      while (this.activeVoices.size >= this.maxVoices) {
        const oldest = this.activeVoices.values().next().value;
        if (oldest) {
          try {
            if (typeof oldest.stop === 'function') oldest.stop();
            if (typeof oldest.disconnect === 'function') oldest.disconnect();
          } catch (_) {}
          this.activeVoices.delete(oldest);
        } else {
          break;
        }
      }
      this.activeVoices.add(node);
      const onEnded = () => {
        if (this.activeVoices) this.activeVoices.delete(node);
      };
      if (typeof node.addEventListener === 'function') {
        node.addEventListener('ended', onEnded, { once: true });
      } else {
        node.onended = onEnded;
      }
      return node;
    },

    stopAll() {
      if (this.activeVoices) {
        this.activeVoices.forEach((node) => {
          try {
            if (typeof node.stop === 'function') node.stop();
            if (typeof node.disconnect === 'function') node.disconnect();
          } catch (_) {}
        });
        this.activeVoices.clear();
      }
    },

    laser() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);
      osc.start(now);
      osc.stop(now + 0.1);
    },

    hit() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);
      osc.start(now);
      osc.stop(now + 0.15);
    },

    explode() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);
      osc.start(now);
      osc.stop(now + 0.35);
    },

    powerup() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + idx * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackVoice(osc);
        osc.start(now);
        osc.stop(now + 0.1);
      });
    },

    nova() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      this.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.7);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.7);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      this.trackVoice(osc);
      osc.start(now);
      osc.stop(now + 0.7);
    }
  };

  // --- Constants & Canvas Setup ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const WIDTH = 600;
  const HEIGHT = 450;

  // DOM Elements
  const hudScore = document.getElementById('hud-score');
  const hudWave = document.getElementById('hud-wave');
  const hudBest = document.getElementById('hud-best');
  const hudBombs = document.getElementById('hud-bombs');
  const shieldIcons = [
    document.getElementById('shield-1'),
    document.getElementById('shield-2'),
    document.getElementById('shield-3')
  ];

  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const overScore = document.getElementById('over-score');
  const overWave = document.getElementById('over-wave');
  const overBest = document.getElementById('over-best');
  const overKills = document.getElementById('over-kills');

  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnHowToPlay = document.getElementById('btn-howtoplay');
  const btnViewManual = document.getElementById('btn-view-manual');
  const btnCloseManual = document.getElementById('btn-close-manual');
  const btnManualReady = document.getElementById('btn-manual-ready');
  const manualModal = document.getElementById('manual-modal');
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');

  // Game State
  const GameMode = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAMEOVER: 3
  };

  let mode = GameMode.MENU;
  let score = 0;
  let wave = 1;
  let kills = 0;
  let bestScore = parseInt(localStorage.getItem('cosmic_surge_hiscore') || '0', 10);
  let screenShake = 0;

  // Input State
  const keys = {};
  const mouse = { x: WIDTH / 2, y: HEIGHT - 60, down: false };
  let lastTouchTime = 0;

  // Starfield
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      size: Math.random() < 0.2 ? 2.5 : Math.random() < 0.6 ? 1.5 : 1,
      speed: 0.5 + Math.random() * 2.2,
      brightness: 0.3 + Math.random() * 0.7
    });
  }

  // Player Starfighter
  const ship = {
    x: WIDTH / 2,
    y: HEIGHT - 60,
    vx: 0,
    vy: 0,
    speed: 7,
    width: 32,
    height: 38,
    shields: 3,
    bombs: 1,
    tripleGunTimer: 0,
    fireTimer: 0,
    fireInterval: 12,
    invincibleTimer: 0
  };

  // Entity Lists
  let lasers = [];
  let enemies = [];
  let enemyLasers = [];
  let powerups = [];
  let particles = [];
  let floatingTexts = [];
  let shockwaves = [];
  let waveTimer = 0;
  let spawnCountdown = 0;

  // --- Helper Functions ---
  function updateHUD() {
    hudScore.textContent = score.toString();
    hudWave.textContent = wave.toString();
    hudBest.textContent = bestScore.toString();
    hudBombs.textContent = ship.bombs.toString();

    shieldIcons.forEach((icon, idx) => {
      if (icon) {
        if (idx < ship.shields) {
          icon.classList.remove('lost');
        } else {
          icon.classList.add('lost');
        }
      }
    });
  }

  function addFloatingText(text, x, y, color = '#38bdf8', size = 15) {
    floatingTexts.push({
      text,
      x,
      y,
      color,
      size,
      life: 1.0,
      vy: -1.2
    });
  }

  function addExplosion(x, y, color, count = 20, speed = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.5 + Math.random()) * speed;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 2 + Math.random() * 3,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  }

  function triggerNovaEMP() {
    if (ship.bombs <= 0 || mode !== GameMode.PLAYING) return;
    ship.bombs--;
    updateHUD();

    Sound.nova();
    screenShake = 16;
    shockwaves.push({
      x: ship.x,
      y: ship.y,
      radius: 10,
      maxRadius: WIDTH * 0.8,
      alpha: 1.0
    });

    addFloatingText('NOVA EMP DETONATED!', ship.x, ship.y - 30, '#c084fc', 20);

    // Destroy all enemies on screen
    enemies.forEach(e => {
      score += e.points;
      kills++;
      addExplosion(e.x, e.y, e.color, 18, 5);
    });
    enemies = [];
    enemyLasers = [];
  }

  // --- Entity Spawners ---
  function spawnAsteroid(x, y, tier = 3) {
    const radius = tier === 3 ? 28 : tier === 2 ? 18 : 11;
    const vertices = [];
    const numVerts = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numVerts; i++) {
      const angle = (i / numVerts) * Math.PI * 2;
      const r = radius * (0.75 + Math.random() * 0.45);
      vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    enemies.push({
      type: 'asteroid',
      tier,
      x: x !== undefined ? x : 30 + Math.random() * (WIDTH - 60),
      y: y !== undefined ? y : -40,
      radius,
      hp: tier,
      maxHp: tier,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.2 + Math.random() * 1.5 + (wave * 0.15),
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      vertices,
      color: '#94a3b8',
      points: tier * 50
    });
  }

  function spawnDrone() {
    enemies.push({
      type: 'drone',
      x: 40 + Math.random() * (WIDTH - 80),
      y: -30,
      radius: 16,
      hp: 2,
      maxHp: 2,
      vx: (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5),
      vy: 1.8 + (wave * 0.18),
      sineOffset: Math.random() * Math.PI * 2,
      shootTimer: 60 + Math.random() * 80,
      color: '#f43f5e',
      points: 150
    });
  }

  function spawnPowerup(x, y) {
    const roll = Math.random();
    let type = 'score';
    let color = '#facc15';
    let label = '+250';

    if (roll < 0.35) {
      type = 'triple';
      color = '#22c55e';
      label = 'TRIPLE';
    } else if (roll < 0.6) {
      type = 'shield';
      color = '#38bdf8';
      label = 'SHIELD';
    } else if (roll < 0.75) {
      type = 'bomb';
      color = '#c084fc';
      label = 'NOVA';
    }

    powerups.push({
      x,
      y,
      type,
      color,
      label,
      radius: 14,
      vy: 1.5,
      pulse: 0
    });
  }

  // --- Game Loop Management ---
  function startGame() {
    Sound.stopAll();
    Sound.init();
    mode = GameMode.PLAYING;
    score = 0;
    wave = 1;
    kills = 0;

    ship.x = WIDTH / 2;
    ship.y = HEIGHT - 60;
    ship.vx = 0;
    ship.vy = 0;
    ship.shields = 3;
    ship.bombs = 1;
    ship.tripleGunTimer = 0;
    ship.invincibleTimer = 60;

    lasers = [];
    enemies = [];
    enemyLasers = [];
    powerups = [];
    particles = [];
    floatingTexts = [];
    shockwaves = [];
    waveTimer = 0;
    spawnCountdown = 30;

    updateHUD();
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    canvas.focus();

    addFloatingText('SYSTEM ENGAGED - WAVE 1', WIDTH / 2, HEIGHT / 2, '#38bdf8', 22);
  }

  function gameOver() {
    mode = GameMode.GAMEOVER;
    Sound.explode();
    screenShake = 22;
    addExplosion(ship.x, ship.y, '#f43f5e', 45, 7);

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('cosmic_surge_hiscore', bestScore.toString());
    }

    overScore.textContent = score.toString();
    overWave.textContent = wave.toString();
    overBest.textContent = bestScore.toString();
    overKills.textContent = kills.toString();

    setTimeout(() => {
      gameoverOverlay.classList.remove('hidden');
    }, 600);
  }

  function fireWeapon() {
    Sound.laser();
    if (ship.tripleGunTimer > 0) {
      // Triple Laser
      lasers.push({ x: ship.x, y: ship.y - 14, vx: 0, vy: -12, color: '#22c55e' });
      lasers.push({ x: ship.x - 10, y: ship.y - 8, vx: -2.5, vy: -11, color: '#22c55e' });
      lasers.push({ x: ship.x + 10, y: ship.y - 8, vx: 2.5, vy: -11, color: '#22c55e' });
    } else {
      // Twin Blasters
      lasers.push({ x: ship.x - 9, y: ship.y - 12, vx: 0, vy: -12, color: '#38bdf8' });
      lasers.push({ x: ship.x + 9, y: ship.y - 12, vx: 0, vy: -12, color: '#38bdf8' });
    }
  }

  // --- Update Step ---
  function update() {
    // Starfield scroll
    stars.forEach(s => {
      s.y += s.speed;
      if (s.y > HEIGHT) {
        s.y = 0;
        s.x = Math.random() * WIDTH;
      }
    });

    if (screenShake > 0) screenShake *= 0.88;

    if (mode !== GameMode.PLAYING) return;

    // Player Movement: Keyboard input or smooth Mouse tracking
    let moveX = 0;
    let moveY = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
    if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      ship.vx = moveX * ship.speed;
      ship.vy = moveY * ship.speed;
      ship.x += ship.vx;
      ship.y += ship.vy;
    } else if (mouse.down) {
      // Smooth interpolation to pointer
      ship.x += (mouse.x - ship.x) * 0.22;
      ship.y += (mouse.y - ship.y) * 0.22;
    }

    // Screen bounds clamping
    ship.x = Math.max(20, Math.min(WIDTH - 20, ship.x));
    ship.y = Math.max(60, Math.min(HEIGHT - 25, ship.y));

    // Powerup Timers
    if (ship.tripleGunTimer > 0) ship.tripleGunTimer--;
    if (ship.invincibleTimer > 0) ship.invincibleTimer--;

    // Auto-fire or manual hold
    ship.fireTimer++;
    const shouldFire = keys['Space'] || mouse.down;
    if (shouldFire && ship.fireTimer >= ship.fireInterval) {
      fireWeapon();
      ship.fireTimer = 0;
    }

    // Engine Thruster Particles
    if (Math.random() < 0.75) {
      particles.push({
        x: ship.x + (Math.random() - 0.5) * 8,
        y: ship.y + 16,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 3 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#38bdf8' : '#60a5fa',
        size: 2.5,
        life: 0.6,
        decay: 0.05
      });
    }

    // Wave Progression & Spawning
    waveTimer++;
    if (waveTimer % 900 === 0) {
      wave++;
      updateHUD();
      Sound.powerup();
      addFloatingText(`SECTOR WAVE ${wave}`, WIDTH / 2, HEIGHT / 2 - 20, '#facc15', 24);
    }

    spawnCountdown--;
    if (spawnCountdown <= 0) {
      spawnCountdown = Math.max(25, 75 - wave * 6);
      if (Math.random() < 0.35 + wave * 0.05) {
        spawnDrone();
      } else {
        spawnAsteroid();
      }
    }

    // Update Player Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.x += l.vx;
      l.y += l.vy;

      if (l.y < -20 || l.x < 0 || l.x > WIDTH) {
        lasers.splice(i, 1);
        continue;
      }

      // Check collision with enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dist = Math.hypot(l.x - e.x, l.y - e.y);
        if (dist < e.radius + 6) {
          e.hp--;
          Sound.hit();
          addExplosion(l.x, l.y, '#38bdf8', 6, 2.5);
          lasers.splice(i, 1);

          if (e.hp <= 0) {
            // Destroyed!
            score += e.points;
            kills++;
            updateHUD();
            Sound.explode();
            screenShake = Math.max(screenShake, e.radius * 0.3);
            addExplosion(e.x, e.y, e.color, 16, 4);
            addFloatingText(`+${e.points}`, e.x, e.y - 10, '#38bdf8');

            // Chance to drop powerup
            if (Math.random() < 0.22) {
              spawnPowerup(e.x, e.y);
            }

            // Asteroid fracture into smaller pieces
            if (e.type === 'asteroid' && e.tier > 1) {
              spawnAsteroid(e.x - 12, e.y, e.tier - 1);
              spawnAsteroid(e.x + 12, e.y, e.tier - 1);
            }

            enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x += e.vx;
      e.y += e.vy;

      if (e.type === 'asteroid') {
        e.rotation += e.rotSpeed;
        if (e.x < e.radius || e.x > WIDTH - e.radius) e.vx *= -1;
      } else if (e.type === 'drone') {
        e.x += Math.sin(Date.now() * 0.004 + e.sineOffset) * 2.2;
        e.shootTimer--;
        if (e.shootTimer <= 0) {
          e.shootTimer = 75 + Math.random() * 60;
          enemyLasers.push({
            x: e.x,
            y: e.y + 12,
            vx: 0,
            vy: 4.5,
            color: '#f43f5e'
          });
        }
      }

      // Check collision with Player Ship
      if (ship.invincibleTimer <= 0) {
        const dist = Math.hypot(e.x - ship.x, e.y - ship.y);
        if (dist < e.radius + 14) {
          ship.shields--;
          updateHUD();
          screenShake = 14;
          ship.invincibleTimer = 80;
          addExplosion(ship.x, ship.y, '#f43f5e', 20, 5);

          if (ship.shields <= 0) {
            gameOver();
            return;
          } else {
            Sound.hit();
            addFloatingText('SHIELD DAMAGED!', ship.x, ship.y - 30, '#f43f5e', 16);
          }

          // Damage or destroy collided enemy
          e.hp -= 2;
          if (e.hp <= 0) enemies.splice(i, 1);
          continue;
        }
      }

      // Despawn off-screen
      if (e.y > HEIGHT + 50) {
        enemies.splice(i, 1);
      }
    }

    // Update Enemy Lasers
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
      const el = enemyLasers[i];
      el.x += el.vx;
      el.y += el.vy;

      if (el.y > HEIGHT + 20) {
        enemyLasers.splice(i, 1);
        continue;
      }

      // Collision with player
      if (ship.invincibleTimer <= 0) {
        const dist = Math.hypot(el.x - ship.x, el.y - ship.y);
        if (dist < 18) {
          enemyLasers.splice(i, 1);
          ship.shields--;
          updateHUD();
          screenShake = 12;
          ship.invincibleTimer = 80;
          addExplosion(ship.x, ship.y, '#f43f5e', 16, 4);

          if (ship.shields <= 0) {
            gameOver();
            return;
          } else {
            Sound.hit();
            addFloatingText('SHIELD HIT!', ship.x, ship.y - 30, '#f43f5e', 16);
          }
        }
      }
    }

    // Update Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy;
      p.pulse += 0.08;

      if (p.y > HEIGHT + 30) {
        powerups.splice(i, 1);
        continue;
      }

      // Collect by Player
      const dist = Math.hypot(p.x - ship.x, p.y - ship.y);
      if (dist < p.radius + 20) {
        Sound.powerup();
        addExplosion(p.x, p.y, p.color, 15, 3.5);

        if (p.type === 'triple') {
          ship.tripleGunTimer = 600; // 10 seconds
          addFloatingText('TRIPLE BLASTER!', ship.x, ship.y - 30, '#22c55e', 18);
        } else if (p.type === 'shield') {
          if (ship.shields < 3) {
            ship.shields++;
            updateHUD();
            addFloatingText('SHIELD REPAIRED!', ship.x, ship.y - 30, '#38bdf8', 18);
          } else {
            score += 200;
            updateHUD();
            addFloatingText('+200 BONUS', ship.x, ship.y - 30, '#38bdf8', 16);
          }
        } else if (p.type === 'bomb') {
          ship.bombs++;
          updateHUD();
          addFloatingText('+1 NOVA BOMB!', ship.x, ship.y - 30, '#c084fc', 18);
        } else if (p.type === 'score') {
          score += 250;
          updateHUD();
          addFloatingText('+250 XP', ship.x, ship.y - 30, '#facc15', 18);
        }

        powerups.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= pt.decay;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.02;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    // Update Shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.radius += 18;
      sw.alpha = 1.0 - sw.radius / sw.maxRadius;
      if (sw.radius >= sw.maxRadius) shockwaves.splice(i, 1);
    }
  }

  // --- Render Step ---
  function draw() {
    ctx.save();

    // Apply Screen Shake
    if (screenShake > 0.5) {
      const dx = (Math.random() - 0.5) * screenShake;
      const dy = (Math.random() - 0.5) * screenShake;
      ctx.translate(dx, dy);
    }

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 1. Draw Starfield
    stars.forEach(s => {
      ctx.fillStyle = `rgba(248, 250, 252, ${s.brightness})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Draw Shockwaves
    shockwaves.forEach(sw => {
      ctx.save();
      ctx.strokeStyle = `rgba(192, 132, 252, ${Math.max(0, sw.alpha)})`;
      ctx.lineWidth = 6;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 3. Draw Particles
    particles.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 4. Draw Player Lasers
    lasers.forEach(l => {
      ctx.save();
      ctx.fillStyle = l.color;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(l.x - 2, l.y - 12, 4, 16, 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Draw Enemy Lasers
    enemyLasers.forEach(el => {
      ctx.save();
      ctx.fillStyle = el.color;
      ctx.shadowColor = el.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(el.x - 2, el.y, 4, 12, 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Draw Powerups
    powerups.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      const pulseSize = p.radius + Math.sin(p.pulse) * 2;

      // Glow Aura
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize + 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer Ring
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, 0, 0);

      ctx.restore();
    });

    // 7. Draw Enemies
    enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.type === 'asteroid') {
        ctx.rotate(e.rotation);
        ctx.strokeStyle = '#94a3b8';
        ctx.fillStyle = '#1e293b';
        ctx.lineWidth = 2;

        ctx.beginPath();
        e.vertices.forEach((v, idx) => {
          if (idx === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crater line details
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(e.radius * 0.25, -e.radius * 0.2, e.radius * 0.22, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'drone') {
        // Drone fighter triangle
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(-14, -14);
        ctx.lineTo(0, -6);
        ctx.lineTo(14, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eye sensor
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // 8. Draw Player Starfighter
    if (mode === GameMode.PLAYING) {
      ctx.save();
      ctx.translate(ship.x, ship.y);

      // Flashing if invincible
      if (ship.invincibleTimer > 0 && Math.floor(ship.invincibleTimer / 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Energy Shield Bubble if active
      if (ship.shields > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Starfighter Body
      ctx.fillStyle = '#0b1120';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(0, -18);      // Nose
      ctx.lineTo(12, 14);      // Right Wingtip
      ctx.lineTo(6, 10);       // Right Engine
      ctx.lineTo(0, 15);       // Center Thruster
      ctx.lineTo(-6, 10);      // Left Engine
      ctx.lineTo(-12, 14);     // Left Wingtip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit Canopy
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, -2, 3.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dual Blaster Mounts
      ctx.fillStyle = ship.tripleGunTimer > 0 ? '#22c55e' : '#e2e8f0';
      ctx.fillRect(-10, -4, 2, 8);
      ctx.fillRect(8, -4, 2, 8);

      ctx.restore();
    }

    // 9. Floating Score Texts
    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = `bold ${ft.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }

  // --- Main Animation Frame ---
  function tick() {
    update();
    draw();
    requestAnimationFrame(tick);
  }

  // --- Event Listeners ---
  function bindInputEvents() {
    // Keyboard listeners
    window.addEventListener('keydown', e => {
      keys[e.code] = true;

      if (e.code === 'KeyB') {
        triggerNovaEMP();
      } else if (e.code === 'KeyP') {
        if (mode === GameMode.PLAYING) mode = GameMode.PAUSED;
        else if (mode === GameMode.PAUSED) mode = GameMode.PLAYING;
      } else if (e.code === 'Space') {
        if (mode === GameMode.MENU) startGame();
        else if (mode === GameMode.GAMEOVER) startGame();
      }
    });

    window.addEventListener('keyup', e => {
      keys[e.code] = false;
    });

    // Mouse Tracking on Canvas
    function updatePointer(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      mouse.x = (e.clientX - rect.left) * scaleX;
      mouse.y = (e.clientY - rect.top) * scaleY;
    }

    canvas.addEventListener('mousemove', e => {
      updatePointer(e);
    });

    canvas.addEventListener('mousedown', e => {
      updatePointer(e);
      mouse.down = true;
      if (mode === GameMode.PLAYING) fireWeapon();
    });

    window.addEventListener('mouseup', () => {
      mouse.down = false;
    });

    // Touch Support
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches && e.touches[0]) {
        updatePointer(e.touches[0]);
        mouse.down = true;

        // Double-tap to trigger Nova EMP
        const now = Date.now();
        if (now - lastTouchTime < 280) {
          triggerNovaEMP();
        }
        lastTouchTime = now;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches && e.touches[0]) {
        updatePointer(e.touches[0]);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      mouse.down = false;
    }, { passive: false });

    // Buttons
    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', startGame);

    // Audio Toggle
    btnSound.addEventListener('click', () => {
      Sound.muted = !Sound.muted;
      localStorage.setItem('cosmic_surge_muted', Sound.muted ? 'true' : 'false');
      if (soundIcon) {
        soundIcon.setAttribute('data-lucide', Sound.muted ? 'volume-x' : 'volume-2');
        if (window.lucide) lucide.createIcons();
      }
    });

    // How to Play Modal
    const showManual = () => {
      manualModal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    };

    const hideManual = () => {
      manualModal.classList.add('hidden');
    };

    btnHowToPlay.addEventListener('click', showManual);
    btnViewManual.addEventListener('click', showManual);
    btnCloseManual.addEventListener('click', hideManual);
    btnManualReady.addEventListener('click', hideManual);

    manualModal.addEventListener('click', e => {
      if (e.target === manualModal) hideManual();
    });
  }

  // --- Bootstrap ---
  function init() {
    updateHUD();
    bindInputEvents();
    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Clean audio on teardown (#507)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ARCADEVERSE_TEARDOWN') {
      Sound.stopAll();
      if (Sound.ctx && Sound.ctx.state !== 'closed') {
        try { Sound.ctx.close(); } catch (_) {}
      }
    }
  });
})();
