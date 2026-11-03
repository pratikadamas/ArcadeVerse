/**
 * Neon Brick Breaker DX: Cyber Shatter
 * Realistic Angle Reflection Ball Physics, Multi-Durability Bricks, Power-Up Cascades, and Web Audio API
 * Author: Babin Bid (Babin123456)
 */

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER ---
  class SoundSynth {
    constructor() {
      this.ctx = null;
      this.enabled = true;
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

    playBounce(freq = 440) {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    playShatter() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playExplosion() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    playPowerup() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [400, 600, 800, 1200].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.04);
        gain.gain.setValueAtTime(0.2, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.1);
      });
    }

    playLaser() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }

  // --- GAME CONFIG & STATE ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const sound = new SoundSynth();

  const STORAGE_KEY = 'arcadeverse_brick_breaker_dx_best';
  let bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

  let state = {
    running: false,
    score: 0,
    stage: 1,
    maxStages: 3,
    lives: 3,
    bricksShattered: 0,
    activePowerup: null,
    powerupTimer: 0,
    laserCooldown: 0
  };

  const paddle = {
    x: 350,
    y: 450,
    baseW: 100,
    w: 100,
    h: 14,
    speed: 8,
    isSticky: false,
    hasLasers: false,
    color: '#00f3ff'
  };

  let balls = [];
  let bricks = [];
  let powerups = [];
  let particles = [];
  let laserShots = [];

  const keys = {
    ArrowLeft: false, ArrowRight: false,
    KeyA: false, KeyD: false,
    Space: false
  };

  function resizeCanvas() {
    canvas.width = 800;
    canvas.height = 520;
    paddle.y = canvas.height - 40;
  }
  resizeCanvas();

  // --- STAGE BRICK LAYOUTS ---
  function buildStage(stageNum) {
    bricks = [];
    const rows = 5 + stageNum;
    const cols = 10;
    const padding = 8;
    const brickW = (canvas.width - 80 - (cols - 1) * padding) / cols;
    const brickH = 20;
    const offsetTop = 70;
    const offsetLeft = 40;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type = 'neon';
        let hp = 1;

        if (stageNum >= 2 && (r + c) % 4 === 0) {
          type = 'titanium';
          hp = 2 + (stageNum === 3 ? 1 : 0);
        } else if ((r === 1 && c === 4) || (r === 2 && c === 5)) {
          type = 'emp';
          hp = 1;
        } else if (stageNum === 3 && r === 2 && (c === 2 || c === 7)) {
          type = 'barrier';
          hp = 999; // Indestructible
        }

        bricks.push({
          x: offsetLeft + c * (brickW + padding),
          y: offsetTop + r * (brickH + padding),
          w: brickW,
          h: brickH,
          type: type,
          hp: hp,
          maxHp: hp,
          alive: true
        });
      }
    }
  }

  function spawnBall(x, y, vx = 4, vy = -4, stuck = false) {
    balls.push({
      x: x,
      y: y,
      radius: 7,
      vx: vx,
      vy: vy,
      stuck: stuck,
      stuckOffset: 0,
      color: '#00f3ff'
    });
  }

  // --- CONTROLS ---
  window.addEventListener('keydown', (e) => {
    sound.init();
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
    if (e.code === 'Space') {
      launchStuckBalls();
      if (paddle.hasLasers) fireLasers();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2));

    // Move stuck balls with paddle
    balls.forEach(b => {
      if (b.stuck) b.x = paddle.x + b.stuckOffset;
    });
  });

  canvas.addEventListener('mousedown', () => {
    sound.init();
    launchStuckBalls();
    if (paddle.hasLasers) fireLasers();
  });

  // Touch Support
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, touchX - paddle.w / 2));
    balls.forEach(b => {
      if (b.stuck) b.x = paddle.x + b.stuckOffset;
    });
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    sound.init();
    launchStuckBalls();
    if (paddle.hasLasers) fireLasers();
  }, { passive: false });

  function launchStuckBalls() {
    balls.forEach(b => {
      if (b.stuck) {
        b.stuck = false;
        b.vy = -5.5;
        b.vx = ((b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)) * 5.5;
      }
    });
  }

  function fireLasers() {
    if (state.laserCooldown > 0) return;
    state.laserCooldown = 15;
    sound.playLaser();
    laserShots.push({ x: paddle.x + 8, y: paddle.y, vy: -9 });
    laserShots.push({ x: paddle.x + paddle.w - 8, y: paddle.y, vy: -9 });
  }

  // HUD and Buttons
  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off').classList.toggle('hidden', sound.enabled);
  });

  document.getElementById('guide-btn').addEventListener('click', () => {
    document.getElementById('guide-modal').classList.remove('hidden');
  });

  document.getElementById('close-guide-btn').addEventListener('click', () => {
    document.getElementById('guide-modal').classList.add('hidden');
  });

  document.getElementById('start-btn').addEventListener('click', () => startGame());
  document.getElementById('restart-btn').addEventListener('click', () => startGame());
  document.getElementById('replay-btn').addEventListener('click', () => startGame());

  // --- GAME LIFECYCLE ---
  function startGame() {
    sound.init();
    state.running = true;
    state.score = 0;
    state.stage = 1;
    state.lives = 3;
    state.bricksShattered = 0;
    state.activePowerup = null;
    resetPaddleAndBall();
    buildStage(state.stage);

    document.getElementById('start-overlay').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    document.getElementById('victory-overlay').classList.add('hidden');
    document.getElementById('best-val').textContent = bestScore;
    updateHUD();
  }

  function resetPaddleAndBall() {
    paddle.w = paddle.baseW;
    paddle.x = (canvas.width - paddle.w) / 2;
    paddle.hasLasers = false;
    paddle.isSticky = false;
    balls = [];
    powerups = [];
    laserShots = [];
    spawnBall(paddle.x + paddle.w / 2, paddle.y - 12, 0, 0, true);
    balls[0].stuckOffset = paddle.w / 2;
  }

  function gameOver() {
    state.running = false;
    if (state.score > bestScore) {
      bestScore = state.score;
      localStorage.setItem(STORAGE_KEY, bestScore);
    }
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('final-stage').textContent = state.stage;
    document.getElementById('final-bricks').textContent = state.bricksShattered;
    document.getElementById('gameover-overlay').classList.remove('hidden');
  }

  function victory() {
    state.running = false;
    if (state.score > bestScore) {
      bestScore = state.score;
      localStorage.setItem(STORAGE_KEY, bestScore);
    }
    document.getElementById('win-score').textContent = state.score;
    document.getElementById('win-best').textContent = bestScore;
    document.getElementById('victory-overlay').classList.remove('hidden');
  }

  function updateHUD() {
    document.getElementById('score-val').textContent = state.score;
    document.getElementById('stage-val').textContent = `${state.stage} / ${state.maxStages}`;

    // Lives
    const liveDots = document.querySelectorAll('.live-dot');
    liveDots.forEach((d, i) => {
      d.classList.toggle('active', i < state.lives);
    });

    // Active Powerup
    const badge = document.getElementById('powerup-badge');
    if (state.activePowerup) {
      badge.classList.remove('hidden');
      document.getElementById('powerup-name').textContent = state.activePowerup;
      const fill = document.getElementById('powerup-timer-fill');
      fill.style.width = `${(state.powerupTimer / 500) * 100}%`;
    } else {
      badge.classList.add('hidden');
    }
  }

  // --- POWER-UPS ENGINE ---
  function dropPowerup(x, y) {
    if (Math.random() > 0.45) return;
    const types = ['multiball', 'extender', 'laser', 'sticky', 'speedwarp'];
    const pick = types[Math.floor(Math.random() * types.length)];
    powerups.push({
      x: x,
      y: y,
      type: pick,
      vy: 2.2,
      w: 24,
      h: 24
    });
  }

  function activatePowerup(type) {
    sound.playPowerup();
    state.activePowerup = type.toUpperCase();
    state.powerupTimer = 500; // ~8.5 seconds at 60fps

    if (type === 'multiball') {
      const orig = balls[0] || { x: paddle.x + paddle.w / 2, y: paddle.y - 15 };
      spawnBall(orig.x, orig.y, -4, -4);
      spawnBall(orig.x, orig.y, 4, -4);
    } else if (type === 'extender') {
      paddle.w = paddle.baseW * 1.45;
    } else if (type === 'laser') {
      paddle.hasLasers = true;
    } else if (type === 'sticky') {
      paddle.isSticky = true;
    }
    updateHUD();
  }

  // --- UPDATE LOOP ---
  function update() {
    if (!state.running) return;

    // Laser Cooldown & Powerup Timer
    if (state.laserCooldown > 0) state.laserCooldown--;
    if (state.activePowerup) {
      state.powerupTimer--;
      if (state.powerupTimer <= 0) {
        state.activePowerup = null;
        paddle.w = paddle.baseW;
        paddle.hasLasers = false;
        paddle.isSticky = false;
      }
      updateHUD();
    }

    // Keyboard Paddle Movement
    if (keys.ArrowLeft || keys.KeyA) {
      paddle.x = Math.max(0, paddle.x - paddle.speed);
      balls.forEach(b => { if (b.stuck) b.x = paddle.x + b.stuckOffset; });
    }
    if (keys.ArrowRight || keys.KeyD) {
      paddle.x = Math.min(canvas.width - paddle.w, paddle.x + paddle.speed);
      balls.forEach(b => { if (b.stuck) b.x = paddle.x + b.stuckOffset; });
    }

    // Update Laser Shots
    laserShots = laserShots.filter(ls => {
      ls.y += ls.vy;
      for (let i = 0; i < bricks.length; i++) {
        const br = bricks[i];
        if (br.alive && ls.x >= br.x && ls.x <= br.x + br.w && ls.y >= br.y && ls.y <= br.y + br.h) {
          if (br.type !== 'barrier') {
            br.hp--;
            sound.playShatter();
            if (br.hp <= 0) shatterBrick(br);
          }
          return false;
        }
      }
      return ls.y > 0;
    });

    // Update Balls & Dynamic Reflection Physics
    balls = balls.filter(b => {
      if (b.stuck) return true;

      b.x += b.vx;
      b.y += b.vy;

      // Wall reflections
      if (b.x - b.radius <= 0) { b.x = b.radius; b.vx *= -1; sound.playBounce(320); }
      if (b.x + b.radius >= canvas.width) { b.x = canvas.width - b.radius; b.vx *= -1; sound.playBounce(320); }
      if (b.y - b.radius <= 0) { b.y = b.radius; b.vy *= -1; sound.playBounce(380); }

      // Paddle Collision (Dynamic Angle Reflection)
      if (b.y + b.radius >= paddle.y && b.y - b.radius <= paddle.y + paddle.h &&
          b.x >= paddle.x - b.radius && b.x <= paddle.x + paddle.w + b.radius && b.vy > 0) {

        if (paddle.isSticky) {
          b.stuck = true;
          b.stuckOffset = b.x - paddle.x;
          sound.playBounce(500);
          return true;
        }

        // Center = 0, Edges = -1 to +1
        const hitPos = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const maxAngle = Math.PI * 0.42; // ~75 degrees
        const reflectionAngle = hitPos * maxAngle;
        const currentSpeed = Math.min(8.5, Math.hypot(b.vx, b.vy) * 1.02);

        b.vx = Math.sin(reflectionAngle) * currentSpeed;
        b.vy = -Math.cos(reflectionAngle) * currentSpeed;
        sound.playBounce(440 + Math.abs(hitPos) * 200);

        // Paddle hit sparks
        for (let p = 0; p < 8; p++) {
          particles.push({
            x: b.x, y: paddle.y,
            vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4,
            color: '#00f3ff', life: 16
          });
        }
      }

      // Brick Collisions
      bricks.forEach(br => {
        if (!br.alive) return;
        if (b.x + b.radius > br.x && b.x - b.radius < br.x + br.w &&
            b.y + b.radius > br.y && b.y - b.radius < br.y + br.h) {

          // Determine bounce axis
          const overlapLeft = (b.x + b.radius) - br.x;
          const overlapRight = (br.x + br.w) - (b.x - b.radius);
          const overlapTop = (b.y + b.radius) - br.y;
          const overlapBottom = (br.y + br.h) - (b.y - b.radius);
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapLeft || minOverlap === overlapRight) b.vx *= -1;
          else b.vy *= -1;

          if (br.type !== 'barrier') {
            br.hp--;
            sound.playShatter();
            if (br.hp <= 0) shatterBrick(br);
          } else {
            sound.playBounce(220);
          }
        }
      });

      // Ball fell off screen
      if (b.y - b.radius > canvas.height) {
        return false;
      }

      return true;
    });

    // Check if all balls lost
    if (balls.length === 0) {
      state.lives--;
      updateHUD();
      if (state.lives <= 0) {
        gameOver();
      } else {
        resetPaddleAndBall();
      }
    }

    // Check Stage Clear (all breakable bricks destroyed)
    const breakablesRemaining = bricks.filter(b => b.alive && b.type !== 'barrier').length;
    if (breakablesRemaining === 0) {
      if (state.stage < state.maxStages) {
        state.stage++;
        resetPaddleAndBall();
        buildStage(state.stage);
        updateHUD();
      } else {
        victory();
      }
    }

    // Update Powerups
    powerups = powerups.filter(pu => {
      pu.y += pu.vy;
      // Paddle catch
      if (pu.y + pu.h >= paddle.y && pu.y <= paddle.y + paddle.h &&
          pu.x + pu.w >= paddle.x && pu.x <= paddle.x + paddle.w) {
        activatePowerup(pu.type);
        return false;
      }
      return pu.y < canvas.height;
    });

    // Update Particles
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      return p.life > 0;
    });
  }

  function shatterBrick(br) {
    br.alive = false;
    state.bricksShattered++;
    state.score += 100 * (br.maxHp || 1);
    updateHUD();

    // EMP brick explosive damage to surrounding cells
    if (br.type === 'emp') {
      sound.playExplosion();
      bricks.forEach(nb => {
        if (nb.alive && nb.type !== 'barrier') {
          const d = Math.hypot((br.x + br.w / 2) - (nb.x + nb.w / 2), (br.y + br.h / 2) - (nb.y + nb.h / 2));
          if (d < 90) {
            nb.alive = false;
            state.score += 80;
            for (let i = 0; i < 6; i++) {
              particles.push({
                x: nb.x + nb.w / 2, y: nb.y + nb.h / 2,
                vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                color: '#ff007f', life: 20
              });
            }
          }
        }
      });
    }

    // Powerup Drop Chance
    dropPowerup(br.x + br.w / 2, br.y + br.h / 2);

    // Shatter Sparkles
    for (let i = 0; i < 14; i++) {
      particles.push({
        x: br.x + br.w / 2, y: br.y + br.h / 2,
        vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7,
        color: br.type === 'titanium' ? '#c084fc' : (br.type === 'emp' ? '#ff007f' : '#00f3ff'),
        life: 25
      });
    }
  }

  // --- RENDER ---
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Background
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw Bricks
    bricks.forEach(b => {
      if (!b.alive) return;
      ctx.save();
      let fill = '#00f3ff';
      let stroke = '#38bdf8';
      if (b.type === 'titanium') {
        fill = b.hp === 1 ? '#7e22ce' : '#a855f7';
        stroke = '#d8b4fe';
      } else if (b.type === 'emp') {
        fill = '#ff007f';
        stroke = '#ff66b2';
      } else if (b.type === 'barrier') {
        fill = '#334155';
        stroke = '#94a3b8';
      }

      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = fill;
      ctx.shadowBlur = b.type === 'barrier' ? 0 : 8;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      // Cracked texture on damaged titanium
      if (b.type === 'titanium' && b.hp < b.maxHp) {
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(b.x + 5, b.y + 3);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h - 3);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Draw Paddle
    ctx.save();
    ctx.fillStyle = paddle.color;
    ctx.shadowColor = paddle.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6) : ctx.rect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fill();

    // Laser cannons on paddle edges
    if (paddle.hasLasers) {
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(paddle.x + 4, paddle.y - 6, 6, 6);
      ctx.fillRect(paddle.x + paddle.w - 10, paddle.y - 6, 6, 6);
    }
    ctx.restore();

    // Draw Balls
    balls.forEach(b => {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Laser Shots
    laserShots.forEach(ls => {
      ctx.save();
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.fillRect(ls.x, ls.y, 3, 12);
      ctx.restore();
    });

    // Draw Power-ups
    powerups.forEach(pu => {
      ctx.save();
      let c = '#00f3ff';
      if (pu.type === 'multiball') c = '#ff007f';
      if (pu.type === 'laser') c = '#ffbe0b';
      if (pu.type === 'extender') c = '#00ff66';

      ctx.strokeStyle = c;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.shadowColor = c;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pu.x, pu.y, pu.w, pu.h);
      ctx.fillRect(pu.x, pu.y, pu.w, pu.h);
      ctx.fillStyle = c;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pu.type[0].toUpperCase(), pu.x + pu.w / 2, pu.y + 16);
      ctx.restore();
    });

    // Draw Particles
    particles.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2.5, 2.5);
      ctx.restore();
    });
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
