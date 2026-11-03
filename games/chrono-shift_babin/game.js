/**
 * Chrono-Shift: Temporal Paradox
 * Circular Buffer State Recording at 60 FPS, VHS Glitch Rewind, and Holographic Echo Playback Engine
 * Author: Babin Bid (Babin123456)
 */

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER ---
  class SoundEngine {
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

    playJump() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playRewind() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    playSwitch() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(640, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playClear() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.25, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.2);
      });
    }

    playDeath() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  // --- CANVAS & LEVEL DEFINITIONS ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const sound = new SoundEngine();

  const MAX_BUFFER_FRAMES = 600; // 10.0 seconds buffer at 60 FPS
  let currentLevelIdx = 0;
  let rewindsUsed = 0;
  let isRewinding = false;
  let hasEcho = false;
  let echoFrameIdx = 0;

  // Circular State Buffer
  let stateHistory = [];
  let echoSequence = [];

  const player = {
    x: 60,
    y: 350,
    w: 22,
    h: 30,
    vx: 0,
    vy: 0,
    speed: 4.6,
    jumpPower: -11.5,
    grounded: false,
    color: '#00f3ff'
  };

  const keys = {
    a: false, d: false, w: false, r: false,
    ArrowLeft: false, ArrowRight: false, ArrowUp: false
  };

  // 8 Progressively Challenging Puzzle Chambers
  const CHAMBERS = [
    {
      name: "Chamber 1: Dual Activation",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 260, y: 330, w: 140, h: 20 },
        { x: 540, y: 260, w: 160, h: 20 }
      ],
      switches: [
        { id: 1, x: 290, y: 320, w: 30, h: 10, pressed: false }
      ],
      doors: [
        { switchId: 1, x: 480, y: 340, w: 16, h: 100, open: false }
      ],
      lasers: [],
      portal: { x: 620, y: 215, w: 35, h: 45 }
    },
    {
      name: "Chamber 2: The Parallel Hold",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 180, y: 340, w: 120, h: 20 },
        { x: 420, y: 340, w: 120, h: 20 },
        { x: 640, y: 270, w: 140, h: 20 }
      ],
      switches: [
        { id: 1, x: 220, y: 330, w: 30, h: 10, pressed: false },
        { id: 2, x: 460, y: 330, w: 30, h: 10, pressed: false }
      ],
      doors: [
        { switchId: 1, x: 360, y: 340, w: 14, h: 100, open: false },
        { switchId: 2, x: 580, y: 270, w: 14, h: 170, open: false }
      ],
      lasers: [],
      portal: { x: 700, y: 225, w: 35, h: 45 }
    },
    {
      name: "Chamber 3: Laser Grid Leap",
      spawn: { x: 60, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 200, y: 330, w: 90, h: 20 },
        { x: 380, y: 250, w: 90, h: 20 },
        { x: 580, y: 210, w: 120, h: 20 }
      ],
      switches: [
        { id: 1, x: 230, y: 320, w: 30, h: 10, pressed: false }
      ],
      doors: [],
      lasers: [
        { switchId: 1, x: 330, y: 220, w: 10, h: 220, active: true } // Deactivates when switch is held
      ],
      portal: { x: 640, y: 165, w: 35, h: 45 }
    },
    {
      name: "Chamber 4: The Pressure Relay",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 220, y: 360, w: 100, h: 20 },
        { x: 400, y: 280, w: 120, h: 20 },
        { x: 600, y: 320, w: 160, h: 20 }
      ],
      switches: [
        { id: 1, x: 250, y: 350, w: 30, h: 10, pressed: false },
        { id: 2, x: 440, y: 270, w: 30, h: 10, pressed: false }
      ],
      doors: [
        { switchId: 1, x: 360, y: 300, w: 14, h: 140, open: false }
      ],
      lasers: [
        { switchId: 2, x: 560, y: 200, w: 12, h: 240, active: true }
      ],
      portal: { x: 680, y: 275, w: 35, h: 45 }
    },
    {
      name: "Chamber 5: Moving Platforms",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 200, y: 320, w: 100, h: 20 },
        { x: 460, y: 260, w: 110, h: 20 }
      ],
      switches: [
        { id: 1, x: 230, y: 310, w: 30, h: 10, pressed: false }
      ],
      doors: [
        { switchId: 1, x: 380, y: 260, w: 16, h: 180, open: false }
      ],
      lasers: [
        { switchId: 1, x: 600, y: 150, w: 10, h: 290, active: true }
      ],
      portal: { x: 700, y: 395, w: 35, h: 45 }
    },
    {
      name: "Chamber 6: Synchronized Stepping",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 150, y: 320, w: 80, h: 20 },
        { x: 320, y: 280, w: 80, h: 20 },
        { x: 500, y: 220, w: 90, h: 20 },
        { x: 650, y: 180, w: 120, h: 20 }
      ],
      switches: [
        { id: 1, x: 170, y: 310, w: 30, h: 10, pressed: false },
        { id: 2, x: 340, y: 270, w: 30, h: 10, pressed: false }
      ],
      doors: [
        { switchId: 1, x: 280, y: 280, w: 14, h: 160, open: false },
        { switchId: 2, x: 460, y: 220, w: 14, h: 220, open: false }
      ],
      lasers: [],
      portal: { x: 700, y: 135, w: 35, h: 45 }
    },
    {
      name: "Chamber 7: Double Laser Crossfire",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 220, y: 320, w: 120, h: 20 },
        { x: 480, y: 300, w: 130, h: 20 }
      ],
      switches: [
        { id: 1, x: 250, y: 310, w: 30, h: 10, pressed: false },
        { id: 2, x: 520, y: 290, w: 30, h: 10, pressed: false }
      ],
      doors: [],
      lasers: [
        { switchId: 1, x: 400, y: 150, w: 10, h: 290, active: true },
        { switchId: 2, x: 660, y: 150, w: 10, h: 290, active: true }
      ],
      portal: { x: 720, y: 395, w: 35, h: 45 }
    },
    {
      name: "Chamber 8: The Master Paradox",
      spawn: { x: 50, y: 380 },
      platforms: [
        { x: 0, y: 440, w: 800, h: 60 },
        { x: 160, y: 330, w: 100, h: 20 },
        { x: 340, y: 250, w: 110, h: 20 },
        { x: 520, y: 200, w: 110, h: 20 },
        { x: 680, y: 150, w: 100, h: 20 }
      ],
      switches: [
        { id: 1, x: 190, y: 320, w: 30, h: 10, pressed: false },
        { id: 2, x: 370, y: 240, w: 30, h: 10, pressed: false },
        { id: 3, x: 550, y: 190, w: 30, h: 10, pressed: false }
      ],
      doors: [
        { switchId: 1, x: 300, y: 250, w: 14, h: 190, open: false },
        { switchId: 2, x: 480, y: 200, w: 14, h: 240, open: false }
      ],
      lasers: [
        { switchId: 3, x: 650, y: 80, w: 12, h: 360, active: true }
      ],
      portal: { x: 720, y: 105, w: 35, h: 45 }
    }
  ];

  function resize() {
    canvas.width = 800;
    canvas.height = 500;
  }
  resize();

  // --- CONTROLS & LISTENERS ---
  window.addEventListener('keydown', (e) => {
    sound.init();
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
      keys.w = true;
      if (player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
        sound.playJump();
      }
    }
    if (e.code === 'KeyR') {
      isRewinding = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') keys.w = false;
    if (e.code === 'KeyR') {
      isRewinding = false;
      commitEcho();
    }
  });

  // Mobile Buttons
  const setupTouchBtn = (id, onDown, onUp) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sound.init();
      onDown();
    }, { passive: false });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (onUp) onUp();
    }, { passive: false });
  };

  setupTouchBtn('m-left', () => { keys.a = true; }, () => { keys.a = false; });
  setupTouchBtn('m-right', () => { keys.d = true; }, () => { keys.d = false; });
  setupTouchBtn('m-jump', () => {
    if (player.grounded) {
      player.vy = player.jumpPower;
      player.grounded = false;
      sound.playJump();
    }
  });
  setupTouchBtn('m-rewind', () => { isRewinding = true; }, () => {
    isRewinding = false;
    commitEcho();
  });

  // HUD & Modals
  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on-icon').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off-icon').classList.toggle('hidden', sound.enabled);
  });

  document.getElementById('level-select-btn').addEventListener('click', () => {
    renderLevelGrid();
    document.getElementById('level-modal').classList.remove('hidden');
  });

  document.getElementById('close-level-btn').addEventListener('click', () => {
    document.getElementById('level-modal').classList.add('hidden');
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
  });

  document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('welcome-modal').classList.add('hidden');
    loadChamber(0);
  });

  document.getElementById('next-chamber-btn').addEventListener('click', () => {
    document.getElementById('clear-modal').classList.add('hidden');
    if (currentLevelIdx + 1 < CHAMBERS.length) {
      loadChamber(currentLevelIdx + 1);
    } else {
      document.getElementById('victory-modal').classList.remove('hidden');
    }
  });

  document.getElementById('replay-game-btn').addEventListener('click', () => {
    document.getElementById('victory-modal').classList.add('hidden');
    loadChamber(0);
  });

  function renderLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    CHAMBERS.forEach((ch, idx) => {
      const cell = document.createElement('div');
      cell.className = `lvl-cell ${idx === currentLevelIdx ? 'active' : ''}`;
      cell.textContent = `${idx + 1}`;
      cell.addEventListener('click', () => {
        document.getElementById('level-modal').classList.add('hidden');
        loadChamber(idx);
      });
      grid.appendChild(cell);
    });
  }

  // --- CHAMBER & TIME MANAGEMENT ---
  function loadChamber(idx) {
    currentLevelIdx = idx;
    const ch = CHAMBERS[currentLevelIdx];
    player.x = ch.spawn.x;
    player.y = ch.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;

    stateHistory = [];
    echoSequence = [];
    hasEcho = false;
    echoFrameIdx = 0;
    isRewinding = false;

    document.getElementById('level-badge').textContent = `CHAMBER ${idx + 1} / 8`;
    document.getElementById('echo-status').classList.remove('playing');
    document.getElementById('echo-status').querySelector('.echo-text').textContent = 'ECHO RECORDING';
    document.getElementById('timeline-fill').style.width = '100%';
    document.getElementById('timeline-text').textContent = '10.0s';
  }

  function commitEcho() {
    if (stateHistory.length > 30) {
      rewindsUsed++;
      document.getElementById('rewind-count').textContent = rewindsUsed;
      echoSequence = [...stateHistory];
      hasEcho = true;
      echoFrameIdx = 0;
      sound.playSwitch();

      const echoStatus = document.getElementById('echo-status');
      echoStatus.classList.add('playing');
      echoStatus.querySelector('.echo-text').textContent = 'ECHO ACTIVE';
    }
  }

  // --- GAME LOOP & PHYSICS ---
  function update() {
    const chamber = CHAMBERS[currentLevelIdx];

    // Handle Rewind
    const vhs = document.getElementById('vhs-overlay');
    if (isRewinding) {
      vhs.classList.add('rewinding');
      sound.playRewind();

      if (stateHistory.length > 1) {
        // Pop past states back in time
        for (let i = 0; i < 3 && stateHistory.length > 1; i++) {
          const past = stateHistory.pop();
          player.x = past.x;
          player.y = past.y;
          player.vx = past.vx;
          player.vy = past.vy;
        }
      }
      updateTimelineUI();
      return;
    } else {
      vhs.classList.remove('rewinding');
    }

    // Standard Movement Physics
    if (keys.a) player.vx = -player.speed;
    else if (keys.d) player.vx = player.speed;
    else player.vx *= 0.75;

    player.vy += 0.55; // Gravity
    if (player.vy > 14) player.vy = 14;

    player.x += player.vx;
    player.y += player.vy;

    // Platform Collisions (Horizontal & Vertical)
    player.grounded = false;
    chamber.platforms.forEach(p => {
      // Top Collision
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h >= p.y && player.y + player.h <= p.y + 14 &&
          player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    });

    // Door Collisions
    chamber.doors.forEach(d => {
      if (!d.open) {
        if (player.x + player.w > d.x && player.x < d.x + d.w &&
            player.y + player.h > d.y && player.y < d.y + d.h) {
          if (player.vx > 0) player.x = d.x - player.w;
          else if (player.vx < 0) player.x = d.x + d.w;
        }
      }
    });

    // Check Laser Collisions
    chamber.lasers.forEach(l => {
      if (l.active) {
        if (player.x + player.w > l.x && player.x < l.x + l.w &&
            player.y + player.h > l.y && player.y < l.y + l.h) {
          // Death by Laser -> reset to spawn
          sound.playDeath();
          player.x = chamber.spawn.x;
          player.y = chamber.spawn.y;
          player.vx = 0;
          player.vy = 0;
        }
      }
    });

    // Record State Buffer
    stateHistory.push({
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy
    });
    if (stateHistory.length > MAX_BUFFER_FRAMES) {
      stateHistory.shift();
    }
    updateTimelineUI();

    // Echo Clone Playback
    let echoPos = null;
    if (hasEcho && echoSequence.length > 0) {
      echoPos = echoSequence[echoFrameIdx];
      echoFrameIdx++;
      if (echoFrameIdx >= echoSequence.length) {
        echoFrameIdx = 0; // Loop echo sequence
      }
    }

    // Switch Interactions (Evaluated for BOTH real player and holographic echo)
    chamber.switches.forEach(sw => {
      const playerOn = (player.x + player.w > sw.x && player.x < sw.x + sw.w &&
                        player.y + player.h >= sw.y - 4 && player.y + player.h <= sw.y + sw.h + 6);
      const echoOn = echoPos && (echoPos.x + player.w > sw.x && echoPos.x < sw.x + sw.w &&
                                 echoPos.y + player.h >= sw.y - 4 && echoPos.y + player.h <= sw.y + sw.h + 6);

      sw.pressed = (playerOn || echoOn);
    });

    // Update Doors & Lasers based on Switches
    chamber.doors.forEach(d => {
      const sw = chamber.switches.find(s => s.id === d.switchId);
      d.open = sw ? sw.pressed : false;
    });

    chamber.lasers.forEach(l => {
      const sw = chamber.switches.find(s => s.id === l.switchId);
      l.active = sw ? !sw.pressed : true;
    });

    // Goal Portal Detection
    const portal = chamber.portal;
    if (player.x + player.w > portal.x && player.x < portal.x + portal.w &&
        player.y + player.h > portal.y && player.y < portal.y + portal.h) {
      sound.playClear();
      document.getElementById('clear-modal').classList.remove('hidden');
    }
  }

  function updateTimelineUI() {
    const fraction = stateHistory.length / MAX_BUFFER_FRAMES;
    document.getElementById('timeline-fill').style.width = `${fraction * 100}%`;
    document.getElementById('timeline-text').textContent = `${(fraction * 10.0).toFixed(1)}s`;
  }

  // --- RENDER ---
  let glowTimer = 0;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    glowTimer += 0.05;

    const chamber = CHAMBERS[currentLevelIdx];

    // Background Grid
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Platforms
    chamber.platforms.forEach(p => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      // Top Neon Highlight
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.w, p.y);
      ctx.stroke();
    });

    // Switches
    chamber.switches.forEach(sw => {
      ctx.fillStyle = sw.pressed ? '#00ff99' : '#ff0055';
      ctx.shadowColor = sw.pressed ? '#00ff99' : '#ff0055';
      ctx.shadowBlur = 10;
      const h = sw.pressed ? 4 : sw.h;
      ctx.fillRect(sw.x, sw.y + (sw.h - h), sw.w, h);
      ctx.shadowBlur = 0;
    });

    // Doors
    chamber.doors.forEach(d => {
      if (!d.open) {
        ctx.fillStyle = '#9d00ff';
        ctx.shadowColor = '#9d00ff';
        ctx.shadowBlur = 12;
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.shadowBlur = 0;
      }
    });

    // Lasers
    chamber.lasers.forEach(l => {
      if (l.active) {
        ctx.strokeStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 16;
        ctx.lineWidth = l.w;
        ctx.beginPath();
        ctx.moveTo(l.x + l.w / 2, l.y);
        ctx.lineTo(l.x + l.w / 2, l.y + l.h);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });

    // Portal
    const pt = chamber.portal;
    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(pt.x + pt.w / 2, pt.y + pt.h / 2, pt.w / 2, pt.h / 2 + Math.sin(glowTimer) * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.fill();
    ctx.restore();

    // Holographic Past-Self Echo
    if (hasEcho && echoSequence[echoFrameIdx]) {
      const ep = echoSequence[echoFrameIdx];
      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 153, 0.45)';
      ctx.strokeStyle = '#00ff99';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ff99';
      ctx.shadowBlur = 12;
      ctx.fillRect(ep.x, ep.y, player.w, player.h);
      ctx.strokeRect(ep.x, ep.y, player.w, player.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('ECHO', ep.x - 4, ep.y - 8);
      ctx.restore();
    }

    // Player
    ctx.save();
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(player.x, player.y, player.w, player.h);

    // Visor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.vx >= 0 ? player.x + 12 : player.x + 3, player.y + 6, 7, 4);
    ctx.restore();
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
