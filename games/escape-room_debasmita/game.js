/**
 * Halloween Escape: Witch's Crypt
 * Pure Vanilla JavaScript & HTML5 Canvas Escape Room Experience
 * Author: Debasmita Bose (DebasmitaBose0)
 */

(() => {
  'use strict';

  // --- SVG Icons Definition (Zero Unicode Emojis) ---
  const SVG_ICONS = {
    bone_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1-1l-3 3m2 8A6 6 0 1 1 5 8a6 6 0 0 1 12 6z"></path><circle cx="9" cy="14" r="1.5"></circle></svg>',
    dagger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line></svg>',
    venom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg>',
    root: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-9"></path><path d="M12 13c-3-2-6-1-7 2"></path><path d="M12 13c3-2 6-1 7 2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    ash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2.5-5 4-8z"></path><line x1="8" y1="18" x2="16" y2="18"></line><line x1="9" y1="21" x2="15" y2="21"></line></svg>',
    acid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l-2 5a6 6 0 1 1-8 0L6 3z"></path><circle cx="12" cy="15" r="1"></circle></svg>',
    gilded_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="M11.5 11.5L22 1"></path><path d="M18 5l2 2"></path><path d="M15 8l2 2"></path></svg>',
    sigil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
  };

  const ITEM_NAMES = {
    bone_key: 'Bone Key',
    dagger: 'Silver Dagger',
    venom: 'Spider Venom',
    root: 'Mandrake Root',
    ash: 'Cursed Ash',
    acid: 'Acidic Elixir',
    gilded_key: 'Gilded Key',
    sigil: 'Eye Talisman'
  };

  // Dial symbols for Runic Pedestal
  const DIAL_SYMBOLS = [
    { id: 'skull', label: 'Skull' },
    { id: 'moon', label: 'Crescent Moon' },
    { id: 'pumpkin', label: 'Jack-o-Lantern' },
    { id: 'bat', label: 'Night Bat' }
  ];

  // Sound Engine using Web Audio API
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.droneStarted = false;
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

    startDrone() {
      if (this.muted || this.droneStarted) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        this.droneStarted = true;
      } catch (e) {}
    }

    playDrip() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400 + Math.random() * 400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    }

    playClick() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    }

    playUnlock() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.45);
    }

    playError() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    }

    playBrew() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300 + Math.random() * 200, this.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600 + Math.random() * 200, this.ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.15);
        }, i * 110);
      }
    }

    playVictory() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const notes = [392, 440, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.5);
        }, idx * 160);
      });
    }
  }

  // --- Game State ---
  const state = {
    secondsElapsed: 0,
    timerActive: true,
    gameWon: false,
    selectedItem: null,
    inventory: [], // string keys

    // Puzzles status
    bookshelfSequence: [],
    bookshelfSolved: false,

    plantSearched: false,

    cauldron: {
      venom: false,
      root: false,
      ash: false,
      brewed: false
    },

    pedestalDials: [0, 0, 0], // indices into DIAL_SYMBOLS
    pedestalSolved: false,

    chestUnlocked: false,

    gateLocks: {
      chains: false,  // requires acid
      keyhole: false, // requires gilded_key
      sigil: false    // requires sigil
    },

    // Dynamic Animation & Effects State
    cauldronBubbles: [],
    cauldronSteam: [],
    torchSparks: [],
    waterDrops: [],
    floorRipples: [],
    dripTimer: 0,
    floatingTexts: [],
    screenShake: { timer: 0, intensity: 0 },
    mousePos: { x: 480, y: 270 }
  };

  // Helper: Trigger screen shake
  function triggerScreenShake(duration = 20, intensity = 6) {
    state.screenShake.timer = duration;
    state.screenShake.intensity = intensity;
  }

  // Helper: Spawn floating badge notification
  function spawnFloatText(text, color = '#fde047', x = 480, y = 260) {
    state.floatingTexts.push({
      text,
      color,
      x: x + (Math.random() - 0.5) * 30,
      y,
      vy: -0.75,
      alpha: 1.0,
      life: 0,
      maxLife: 70
    });
  }

  // Track mouse coordinates for subtle cursor lantern illumination
  window.addEventListener('mousemove', e => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    state.mousePos.x = (e.clientX - rect.left) * (canvas.width / (rect.width || 1));
    state.mousePos.y = (e.clientY - rect.top) * (canvas.height / (rect.height || 1));
  });

  const sound = new SoundEngine();

  // --- DOM Elements ---
  const canvas = document.getElementById('roomCanvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const timerBox = document.getElementById('timerBox');
  const cryptToast = document.getElementById('cryptToast');
  const escapeText = document.getElementById('escapeText');
  const inventorySlots = document.getElementById('inventorySlots');
  const invDetail = document.getElementById('invDetail');

  // Modals
  const modalBookshelf = document.getElementById('modalBookshelf');
  const modalCauldron = document.getElementById('modalCauldron');
  const modalPedestal = document.getElementById('modalPedestal');
  const modalTorches = document.getElementById('modalTorches');
  const modalChest = document.getElementById('modalChest');
  const modalGate = document.getElementById('modalGate');
  const modalHelp = document.getElementById('modalHelp');
  const modalVictory = document.getElementById('modalVictory');

  // Hotspots
  const hotspotGate = document.getElementById('hotspotGate');
  const hotspotBooks = document.getElementById('hotspotBooks');
  const hotspotCauldron = document.getElementById('hotspotCauldron');
  const hotspotPedestal = document.getElementById('hotspotPedestal');
  const hotspotChest = document.getElementById('hotspotChest');
  const hotspotTorches = document.getElementById('hotspotTorches');
  const hotspotPlant = document.getElementById('hotspotPlant');

  // --- Investigation Reticle Tracking & Hover Feedback ---
  const investigationReticle = document.getElementById('investigationReticle');
  const reticleText = document.getElementById('reticleText');

  window.addEventListener('mousemove', e => {
    if (investigationReticle) {
      investigationReticle.style.left = `${e.clientX}px`;
      investigationReticle.style.top = `${e.clientY}px`;
    }
  }, { passive: true });

  function bindHotspotReticle(el, defaultLabel) {
    if (!el) return;
    el.addEventListener('mouseenter', () => {
      if (!investigationReticle) return;
      investigationReticle.classList.add('active');
      if (state.selectedItem) {
        reticleText.textContent = `[USE: ${ITEM_NAMES[state.selectedItem] || state.selectedItem}] ${defaultLabel}`;
      } else {
        reticleText.textContent = `[EXAMINE] ${defaultLabel}`;
      }
    });
    el.addEventListener('mouseleave', () => {
      if (investigationReticle) {
        investigationReticle.classList.remove('active');
      }
    });
  }

  bindHotspotReticle(hotspotBooks, 'Grimoire Bookshelf');
  bindHotspotReticle(hotspotPlant, 'Dead Nightshade Pot');
  bindHotspotReticle(hotspotCauldron, 'Alchemical Cauldron');
  bindHotspotReticle(hotspotPedestal, 'Runic Celestial Altar');
  bindHotspotReticle(hotspotTorches, 'Braziers & Crypt Fire');
  bindHotspotReticle(hotspotChest, 'Sarcophagus Relic Chest');
  bindHotspotReticle(hotspotGate, 'Iron Crypt Gate');

  const btnStartGame = document.getElementById('btnStartGame');
  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      sound.init();
      sound.startDrone();
      closeModal(modalHelp);
    });
  }

  
  // --- Smart Contextual Hint System ---
  document.getElementById('hintBtn').addEventListener('click', () => {
    sound.playClick();
    if (!state.bookshelfSolved) {
      showToast('Hint: Inspect Bookshelf. Pull: Blood (Red), Dusk (Blue), Vine (Green), Void (Purple).');
    } else if (!state.plantSearched) {
      showToast('Hint: Click the Dead Nightshade Pot on the bottom-left to dig up Mandrake Root.');
    } else if (!state.inventory.includes('ash') && !state.cauldron.ash) {
      showToast('Hint: Inspect the Wall Torches on the upper-right to scrape Cursed Ash with the Silver Dagger.');
    } else if (!state.cauldron.brewed) {
      showToast('Hint: Inspect the Cauldron and add Spider Venom, Mandrake Root, and Cursed Ash to brew Acidic Elixir.');
    } else if (!state.pedestalSolved) {
      showToast('Hint: Inspect Runic Pedestal on the right. Align symbols: Moon, Pumpkin, Skull.');
    } else if (!state.inventory.includes('gilded_key') && !state.gateLocks.keyhole) {
      showToast('Hint: Inspect the Bone Relic Chest on the far right using the Bone Key from the pedestal.');
    } else {
      showToast('Hint: Inspect the Iron Crypt Gate and use Acidic Elixir, Gilded Key, and Eye Talisman to escape!');
    }
  });

  // --- Dynamic Particle & Canvas Graphic System ---
  const particles = [];
  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * 960,
      y: Math.random() * 540,
      size: 1 + Math.random() * 2.5,
      speedY: -0.2 - Math.random() * 0.4,
      speedX: (Math.random() - 0.5) * 0.3,
      alpha: 0.2 + Math.random() * 0.6,
      color: Math.random() > 0.4 ? 'rgba(157, 78, 221,' : 'rgba(255, 119, 0,'
    });
  }

  // Initialize Cauldron Bubbles
  for (let i = 0; i < 18; i++) {
    state.cauldronBubbles.push({
      x: 240 + (Math.random() - 0.5) * 44,
      y: 356 + (Math.random() - 0.5) * 12,
      r: 1.5 + Math.random() * 3.5,
      vy: -0.3 - Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2,
      life: Math.random() * 60
    });
  }

  const VW = 960;
  const VH = 540;

  function renderRoom(time) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Apply Screen Shake
    let shakeX = 0, shakeY = 0;
    if (state.screenShake.timer > 0) {
      state.screenShake.timer--;
      const int = state.screenShake.intensity * (state.screenShake.timer / 30);
      shakeX = (Math.random() - 0.5) * int * 2;
      shakeY = (Math.random() - 0.5) * int * 2;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.scale(w / VW, h / VH);

    // 1. Ancient Subterranean Stone Wall Gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, VH);
    wallGrad.addColorStop(0, '#06030c');
    wallGrad.addColorStop(0.65, '#160b24');
    wallGrad.addColorStop(1, '#0c0515');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, VW, VH);

    // Stone Bricks Masonry Pattern
    ctx.strokeStyle = 'rgba(78, 41, 116, 0.25)';
    ctx.lineWidth = 2;
    for (let y = 60; y < 340; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
      ctx.stroke();
      const offset = (y / 45) % 2 === 0 ? 0 : 40;
      for (let x = offset; x < VW; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 45);
        ctx.stroke();
      }
    }

    // Cobblestone Floor with Perspective
    const horizon = 340;
    ctx.fillStyle = '#0f081c';
    ctx.fillRect(0, horizon, VW, VH - horizon);

    ctx.strokeStyle = 'rgba(110, 50, 160, 0.35)';
    for (let x = -100; x < VW + 100; x += 60) {
      ctx.beginPath();
      ctx.moveTo(VW / 2, horizon - 50);
      ctx.lineTo(x, VH);
      ctx.stroke();
    }
    for (let y = horizon; y < VH; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
      ctx.stroke();
    }

    // ==========================================
    // 2. CENTER GOTHIC IRON CRYPT GATE
    // ==========================================
    ctx.fillStyle = '#05020a';
    ctx.beginPath();
    ctx.roundRect(390, 110, 180, 240, [90, 90, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = '#58337a';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Ethereal Moonbeam through Gate Bars
    const moonBeam = ctx.createLinearGradient(480, 110, 480, 450);
    moonBeam.addColorStop(0, 'rgba(0, 242, 254, 0.3)');
    moonBeam.addColorStop(0.5, 'rgba(0, 242, 254, 0.12)');
    moonBeam.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = moonBeam;
    ctx.beginPath();
    ctx.moveTo(480, 110);
    ctx.lineTo(340, 460);
    ctx.lineTo(620, 460);
    ctx.closePath();
    ctx.fill();

    // Gate Vertical Iron Bars
    const allUnlocked = state.gateLocks.chains && state.gateLocks.keyhole && state.gateLocks.sigil;
    ctx.strokeStyle = allUnlocked ? '#38ef7d' : '#443254';
    ctx.lineWidth = 5;
    for (let bx = 415; bx <= 545; bx += 26) {
      ctx.beginPath();
      ctx.moveTo(bx, 130);
      ctx.lineTo(bx, 350);
      ctx.stroke();
    }

    // Pulsing Celestial Ward Sigil on Gate
    const sigilPulse = 0.5 + Math.sin(time * 0.003) * 0.45;
    ctx.save();
    ctx.translate(480, 220);
    ctx.strokeStyle = state.gateLocks.sigil ? 'rgba(56, 239, 125, ' + sigilPulse + ')' : 'rgba(192, 132, 252, ' + sigilPulse + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    // 3 interlocking ring arcs
    for (let a = 0; a < 3; a++) {
      const ang = (a * 2 * Math.PI) / 3 + time * 0.001;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * 12, Math.sin(ang) * 12, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // ==========================================
    // 3. GRIMOIRE BOOKSHELF (Left)
    // ==========================================
    ctx.fillStyle = '#221133';
    ctx.fillRect(110, 150, 100, 190);
    ctx.strokeStyle = '#58337a';
    ctx.lineWidth = 3;
    ctx.strokeRect(110, 150, 100, 190);
    ctx.fillStyle = '#3c1d5a';
    ctx.fillRect(112, 210, 96, 8);
    ctx.fillRect(112, 275, 96, 8);

    const bookColors = ['#ff3366', '#38ef7d', '#00f2fe', '#9d4edd', '#ff9800'];
    for (let bi = 0; bi < 5; bi++) {
      ctx.fillStyle = bookColors[bi];
      ctx.fillRect(122 + bi * 18, 168, 14, 42);
      ctx.fillRect(122 + bi * 18, 233, 14, 42);
    }

    // Secret compartment glow if solved
    if (state.bookshelfSolved) {
      const compGlow = ctx.createRadialGradient(160, 310, 2, 160, 310, 28);
      compGlow.addColorStop(0, 'rgba(192, 132, 252, 0.7)');
      compGlow.addColorStop(1, 'rgba(192, 132, 252, 0)');
      ctx.fillStyle = compGlow;
      ctx.fillRect(120, 285, 80, 50);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(135, 305, 50, 14);
    }

    // ==========================================
    // 4. ALCHEMICAL BUBBLING CAULDRON (Center-Left)
    // ==========================================
    const cx = 240, cy = 345;
    const cGlow = ctx.createRadialGradient(cx, cy, 5, cx, cy, 75);
    cGlow.addColorStop(0, state.cauldron.brewed ? 'rgba(56, 239, 125, 0.55)' : 'rgba(157, 78, 221, 0.45)');
    cGlow.addColorStop(0.6, state.cauldron.brewed ? 'rgba(56, 239, 125, 0.18)' : 'rgba(157, 78, 221, 0.12)');
    cGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cGlow;
    ctx.fillRect(cx - 85, cy - 65, 170, 150);

    // Glowing firewood embers under cauldron
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 24, cy + 50, 48, 8);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    for (let ember = 0; ember < 6; ember++) {
      const ex = cx - 18 + ember * 7 + Math.sin(time * 0.008 + ember) * 2;
      ctx.beginPath();
      ctx.arc(ex, cy + 49, 2.5 + Math.sin(time * 0.01 + ember) * 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cast iron cauldron belly
    ctx.fillStyle = '#1c102a';
    ctx.beginPath();
    ctx.arc(cx, cy + 15, 36, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#58337a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cauldron Rim & Liquid Pool
    ctx.fillStyle = state.cauldron.brewed ? '#22c55e' : '#9d4edd';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 15, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = state.cauldron.brewed ? '#86efac' : '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Animated Potion Bubbles Swelling & Popping
    ctx.fillStyle = state.cauldron.brewed ? '#86efac' : '#e9d5ff';
    state.cauldronBubbles.forEach(b => {
      b.y += b.vy;
      b.wobble += 0.08;
      b.x += Math.sin(b.wobble) * 0.35;
      b.life++;
      if (b.y < cy + 8 || b.life > 60) {
        // Pop and spawn tiny splash
        b.y = cy + 20 + Math.random() * 4;
        b.x = cx + (Math.random() - 0.5) * 44;
        b.life = 0;
        b.r = 1.2 + Math.random() * 3.5;
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Rising Alchemical Steam Vapor Rings
    if (Math.random() < 0.25) {
      state.cauldronSteam.push({
        x: cx + (Math.random() - 0.5) * 25,
        y: cy + 10,
        r: 3 + Math.random() * 3,
        maxR: 22 + Math.random() * 12,
        vy: -0.6 - Math.random() * 0.7,
        alpha: 0.65
      });
    }

    for (let i = state.cauldronSteam.length - 1; i >= 0; i--) {
      const st = state.cauldronSteam[i];
      st.y += st.vy;
      st.r += 0.35;
      st.alpha -= 0.015;
      if (st.alpha <= 0 || st.r >= st.maxR) {
        state.cauldronSteam.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = state.cauldron.brewed
        ? `rgba(134, 239, 172, ${st.alpha})`
        : `rgba(216, 180, 254, ${st.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(st.x, st.y, st.r, st.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ==========================================
    // 5. RUNIC CELESTIAL PEDESTAL (Center-Right)
    // ==========================================
    const px = 700, py = 360;
    // Stone Plinth
    ctx.fillStyle = '#24143a';
    ctx.beginPath();
    ctx.moveTo(px - 35, py + 35);
    ctx.lineTo(px + 35, py + 35);
    ctx.lineTo(px + 25, py - 20);
    ctx.lineTo(px - 25, py - 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6e389e';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pedestal Top Runic Plate
    ctx.fillStyle = state.pedestalSolved ? '#00f2fe' : '#ff7700';
    ctx.beginPath();
    ctx.ellipse(px, py - 20, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Arcane Runes
    const pedRot = (time * 0.002) % (Math.PI * 2);
    ctx.save();
    ctx.translate(px, py - 20);
    ctx.scale(1, 0.35);
    ctx.rotate(pedRot);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    for (let r = 0; r < 4; r++) {
      const ra = (r * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra) * 14, Math.sin(ra) * 14);
      ctx.lineTo(Math.cos(ra) * 22, Math.sin(ra) * 22);
      ctx.stroke();
    }
    ctx.restore();

    // Beam of Power when Solved
    if (state.pedestalSolved) {
      const beamGrad = ctx.createLinearGradient(px, py - 20, px, 80);
      beamGrad.addColorStop(0, 'rgba(0, 242, 254, 0.6)');
      beamGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(px - 14, 80, 28, py - 100);
    }

    // ==========================================
    // 6. WALL BRAZIERS & DYNAMIC TORCHES
    // ==========================================
    const drawTorch = (tx, ty) => {
      // Iron Bracket
      ctx.fillStyle = '#2e1c42';
      ctx.fillRect(tx - 3, ty, 6, 26);
      ctx.strokeStyle = '#4c266b';
      ctx.strokeRect(tx - 3, ty, 6, 26);

      // Warm Radiant Fire Glow
      const fGlow = ctx.createRadialGradient(tx, ty - 8, 3, tx, ty - 8, 48);
      fGlow.addColorStop(0, 'rgba(255, 170, 50, 0.65)');
      fGlow.addColorStop(0.5, 'rgba(255, 120, 20, 0.22)');
      fGlow.addColorStop(1, 'rgba(255, 120, 20, 0)');
      ctx.fillStyle = fGlow;
      ctx.fillRect(tx - 50, ty - 58, 100, 100);

      // Multi-layer Dancing Flame Tongues
      const fSway = Math.sin(time * 0.012 + tx) * 3;
      const fH = 18 + Math.sin(time * 0.016 + tx) * 4;

      // Outer Orange Flame
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(tx - 8, ty - 4);
      ctx.quadraticCurveTo(tx - 9, ty - 16, tx + fSway, ty - 8 - fH);
      ctx.quadraticCurveTo(tx + 9, ty - 16, tx + 8, ty - 4);
      ctx.closePath();
      ctx.fill();

      // Inner Golden Flame
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(tx - 4.5, ty - 4);
      ctx.quadraticCurveTo(tx - 5, ty - 12, tx + fSway * 0.6, ty - 8 - fH * 0.7);
      ctx.quadraticCurveTo(tx + 5, ty - 12, tx + 4.5, ty - 4);
      ctx.closePath();
      ctx.fill();

      // White Hot Center Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 6, 2.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Spawn Torch Flying Sparks
      if (Math.random() < 0.22) {
        state.torchSparks.push({
          x: tx + (Math.random() - 0.5) * 8,
          y: ty - 12,
          vx: (Math.random() - 0.5) * 0.8 + fSway * 0.1,
          vy: -1.2 - Math.random() * 1.6,
          size: 1 + Math.random() * 1.8,
          life: 0,
          maxLife: 28 + Math.random() * 15
        });
      }
    };
    drawTorch(280, 160);
    drawTorch(680, 160);

    // Update & Render Torch Sparks
    ctx.fillStyle = '#fde047';
    for (let i = state.torchSparks.length - 1; i >= 0; i--) {
      const sp = state.torchSparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life++;
      if (sp.life > sp.maxLife) {
        state.torchSparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - (sp.life / sp.maxLife);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Cobwebs in Corners
    ctx.strokeStyle = 'rgba(200, 180, 230, 0.16)';
    ctx.lineWidth = 1;
    for (let r = 15; r < 90; r += 20) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI / 2);
      ctx.stroke();
    }
    for (let r = 15; r < 90; r += 20) {
      ctx.beginPath();
      ctx.arc(VW, 0, r, Math.PI / 2, Math.PI);
      ctx.stroke();
    }

    // Dripping condensation from stone ceiling
    state.dripTimer++;
    if (state.dripTimer > 95) {
      state.dripTimer = 0;
      state.waterDrops.push({
        x: 310 + Math.random() * 340,
        y: 60,
        vy: 2.2 + Math.random() * 0.8
      });
    }

    ctx.fillStyle = 'rgba(180, 220, 255, 0.6)';
    for (let d = state.waterDrops.length - 1; d >= 0; d--) {
      const drop = state.waterDrops[d];
      drop.y += drop.vy;
      drop.vy += 0.18;
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, 1.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (drop.y >= 430) {
        state.floorRipples.push({ x: drop.x, y: 430, r: 2, alpha: 0.75 });
        sound.playDrip();
        state.waterDrops.splice(d, 1);
      }
    }

    for (let r = state.floorRipples.length - 1; r >= 0; r--) {
      const rip = state.floorRipples[r];
      rip.r += 0.65;
      rip.alpha -= 0.02;
      if (rip.alpha <= 0) {
        state.floorRipples.splice(r, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(147, 197, 253, ${rip.alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.r, rip.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // ==========================================
    // 7. INTERACTIVE CURSOR LANTERN ILLUMINATION
    // ==========================================
    const mx = state.mousePos.x;
    const my = state.mousePos.y;
    const lanternGrad = ctx.createRadialGradient(mx, my, 25, mx, my, Math.min(w, h) * 0.42);
    lanternGrad.addColorStop(0, 'rgba(255, 235, 180, 0.09)');
    lanternGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.38)');
    lanternGrad.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
    ctx.fillStyle = lanternGrad;
    ctx.fillRect(0, 0, w, h);

    // Atmospheric Floating Motes
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.y < 0) {
        p.y = h;
        p.x = Math.random() * w;
      }
      ctx.fillStyle = `${p.color} ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // ==========================================
    // 8. FLOATING ACHIEVEMENT & PUZZLE BADGES
    // ==========================================
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y += ft.vy;
      ft.life++;
      ft.alpha = 1 - (ft.life / ft.maxLife);
      if (ft.life >= ft.maxLife) {
        state.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0, 0, 0, ${ft.alpha * 0.8})`;
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    requestAnimationFrame(renderRoom);
  }
  requestAnimationFrame(renderRoom);

  // --- Inventory Management ---
  function updateInventoryUI() {
    inventorySlots.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      const itemKey = state.inventory[i];
      if (itemKey) {
        slot.innerHTML = SVG_ICONS[itemKey] || '';
        slot.title = ITEM_NAMES[itemKey] || itemKey;
        if (state.selectedItem === itemKey) {
          slot.classList.add('selected');
        }
        slot.addEventListener('click', () => {
          sound.playClick();
          if (state.selectedItem === itemKey) {
            state.selectedItem = null;
            invDetail.textContent = 'Item deselected. Tap an object or item.';
          } else {
            state.selectedItem = itemKey;
            invDetail.textContent = `Selected: ${ITEM_NAMES[itemKey]}. Tap an object to use it.`;
          }
          updateInventoryUI();
        });
      } else {
        slot.title = 'Empty slot';
      }
      inventorySlots.appendChild(slot);
    }
  }

  
  function updateEscapeTracker() {
    if (!escapeText) return;
    if (!state.bookshelfSolved) {
      escapeText.textContent = 'Step 1: Inspect the Bookshelf on the left. Pull: Blood, Dusk, Vine, Void.';
    } else if (!state.plantSearched) {
      escapeText.textContent = 'Step 2: Inspect the Dead Nightshade Pot on the bottom left for Mandrake Root.';
    } else if (!state.inventory.includes('ash') && !state.cauldron.ash) {
      escapeText.textContent = 'Step 3: Inspect Wall Torches to gather Cursed Ash with the Silver Dagger.';
    } else if (!state.cauldron.brewed) {
      escapeText.textContent = 'Step 4: Combine Venom, Mandrake, and Ash in the Cauldron to brew Acid.';
    } else if (!state.pedestalSolved) {
      escapeText.textContent = 'Step 5: Inspect Runic Pedestal. Align symbols: Moon, Pumpkin, Skull.';
    } else if (!state.inventory.includes('gilded_key') && !state.gateLocks.keyhole) {
      escapeText.textContent = 'Step 6: Open the Bone Relic Chest with the Bone Key to get the Master Key.';
    } else {
      escapeText.textContent = 'Step 7: Click the Iron Crypt Gate and unlock the 3 seals to escape!';
    }
  }

  function addItem(itemKey) {
    spawnFloatText('+ ' + (ITEM_NAMES[itemKey] || itemKey), '#38ef7d', 480, 260);
    if (!state.inventory.includes(itemKey)) {
      state.inventory.push(itemKey);
      sound.playUnlock();
      updateInventoryUI();
      showToast(`Obtained: ${ITEM_NAMES[itemKey]}!`);
    }
  }

  function removeItem(itemKey) {
    const idx = state.inventory.indexOf(itemKey);
    if (idx !== -1) {
      state.inventory.splice(idx, 1);
      if (state.selectedItem === itemKey) {
        state.selectedItem = null;
      }
      updateInventoryUI();
    }
  }

  // --- Modal Helpers ---
  function openModal(modal) {
    sound.playClick();
    modal.classList.add('open');
  }

  function closeModal(modal) {
    sound.playClick();
    modal.classList.remove('open');
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      const targetModal = document.getElementById(targetId);
      if (targetModal) closeModal(targetModal);
    });
  });

  // --- Puzzle 1: Bookshelf Logic ---
  const expectedBookSequence = ['red', 'blue', 'green', 'purple'];
  const booksRow = document.getElementById('booksRow');
  const bookshelfStatus = document.getElementById('bookshelfStatus');
  const resetBooksBtn = document.getElementById('resetBooksBtn');

  booksRow.querySelectorAll('.book').forEach(book => {
    book.addEventListener('click', () => {
      if (state.bookshelfSolved) {
        bookshelfStatus.textContent = 'The secret drawer has already opened.';
        return;
      }
      sound.playClick();
      const col = book.getAttribute('data-color');
      state.bookshelfSequence.push(col);

      // Check current sequence
      const idx = state.bookshelfSequence.length - 1;
      if (state.bookshelfSequence[idx] !== expectedBookSequence[idx]) {
        sound.playError();
        bookshelfStatus.textContent = 'The mechanism resets with a grinding thud...';
        state.bookshelfSequence = [];
        return;
      }

      if (state.bookshelfSequence.length === expectedBookSequence.length) {
        state.bookshelfSolved = true; updateEscapeTracker();
        triggerScreenShake(24, 7);
        spawnFloatText('Secret Compartment Opened!', '#c084fc', 200, 230);
        sound.playUnlock();
        bookshelfStatus.textContent = 'A hidden drawer slides open! You found the Silver Dagger and Spider Venom!';
        addItem('dagger');
        addItem('venom');
      } else {
        bookshelfStatus.textContent = `A stone tumbler clicks... (${state.bookshelfSequence.length}/4)`;
      }
    });
  });

  resetBooksBtn.addEventListener('click', () => {
    sound.playClick();
    state.bookshelfSequence = [];
    bookshelfStatus.textContent = 'Sequence reset.';
  });

  // --- Puzzle 2: Dead Plant Pot (Mandrake Root) ---
  hotspotPlant.addEventListener('click', () => {
    if (!state.plantSearched) {
      state.plantSearched = true; updateEscapeTracker();
      addItem('root');
      showToast('You pulled a shriveled Mandrake Root from the dead soil.');
    } else {
      showToast('The urn is empty now.');
    }
  });

  // --- Puzzle 3: Wall Torches / Braziers ---
  const gatherAshBtn = document.getElementById('gatherAshBtn');
  const torchesStatus = document.getElementById('torchesStatus');

  gatherAshBtn.addEventListener('click', () => {
    if (state.inventory.includes('ash')) {
      torchesStatus.textContent = 'You already have enough cursed ash.';
      return;
    }
    if (state.selectedItem === 'dagger' || state.inventory.includes('dagger')) {
      addItem('ash');
      torchesStatus.textContent = 'Using the silver blade, you scooped smoldering Cursed Ash without burning yourself.';
      sound.playUnlock();
    } else {
      sound.playError();
      torchesStatus.textContent = 'The flames are too scorching to touch with bare hands. You need a cold silver blade!';
    }
  });

  // --- Puzzle 4: Witch's Cauldron ---
  const brewCauldronBtn = document.getElementById('brewCauldronBtn');
  const cauldronStatus = document.getElementById('cauldronStatus');
  const badgeVenom = document.getElementById('badgeVenom');
  const badgeRoot = document.getElementById('badgeRoot');
  const badgeAsh = document.getElementById('badgeAsh');

  brewCauldronBtn.addEventListener('click', () => {
    if (state.cauldron.brewed) {
      cauldronStatus.textContent = 'You have already brewed the Acidic Elixir.';
      return;
    }

    if (!state.selectedItem) {
      cauldronStatus.textContent = 'Select an ingredient from your inventory first.';
      return;
    }

    if (state.selectedItem === 'venom') {
      state.cauldron.venom = true;
      removeItem('venom');
      badgeVenom.classList.add('added');
      sound.playBrew();
      cauldronStatus.textContent = 'Added Spider Venom. The potion turns dark violet.';
    } else if (state.selectedItem === 'root') {
      state.cauldron.root = true;
      removeItem('root');
      badgeRoot.classList.add('added');
      sound.playBrew();
      cauldronStatus.textContent = 'Added Mandrake Root. The potion begins to foam.';
    } else if (state.selectedItem === 'ash') {
      state.cauldron.ash = true;
      removeItem('ash');
      badgeAsh.classList.add('added');
      sound.playBrew();
      cauldronStatus.textContent = 'Added Cursed Ash. Sparkles of green vapor erupt!';
    } else {
      sound.playError();
      cauldronStatus.textContent = 'That item does not belong in this alchemical formula.';
      return;
    }

    if (state.cauldron.venom && state.cauldron.root && state.cauldron.ash) {
      state.cauldron.brewed = true; updateEscapeTracker();
      triggerScreenShake(30, 8);
      spawnFloatText('Acidic Elixir Brewed!', '#38ef7d', 260, 310);
      sound.playBrew();
      sound.playUnlock();
      addItem('acid');
      cauldronStatus.textContent = 'SUCCESS! The brew turns into a glowing, corroding Acidic Elixir!';
    }
  });

  // --- Puzzle 5: Runic Pedestal ---
  // Expected dials: Moon (1), Pumpkin (2), Skull (0)
  const dialDisplay0 = document.getElementById('dialDisplay0');
  const dialDisplay1 = document.getElementById('dialDisplay1');
  const dialDisplay2 = document.getElementById('dialDisplay2');
  const checkPedestalBtn = document.getElementById('checkPedestalBtn');
  const pedestalStatus = document.getElementById('pedestalStatus');

  function renderDial(idx, el) {
    const sym = DIAL_SYMBOLS[state.pedestalDials[idx]];
    let iconSvg = '';
    if (sym.id === 'skull') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="7"></circle><circle cx="9" cy="10" r="1.5"></circle><circle cx="15" cy="10" r="1.5"></circle><path d="M9 17v4m6-4v4"></path></svg>';
    } else if (sym.id === 'moon') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    } else if (sym.id === 'pumpkin') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v3m-4 6l2 2-2 2m8-4l-2 2 2 2"></path></svg>';
    } else { // bat
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c4 0 6-6 10-6s6 6 10 6c-3 4-5 8-10 8s-7-4-10-8z"></path></svg>';
    }
    el.innerHTML = iconSvg;
    el.title = sym.label;
  }

  function updateAllDials() {
    renderDial(0, dialDisplay0);
    renderDial(1, dialDisplay1);
    renderDial(2, dialDisplay2);
  }
  updateAllDials();

  document.querySelectorAll('.dial-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const dialIdx = parseInt(btn.getAttribute('data-dial'), 10);
      const dir = btn.getAttribute('data-dir');
      if (dir === 'up') {
        state.pedestalDials[dialIdx] = (state.pedestalDials[dialIdx] + 1) % DIAL_SYMBOLS.length;
      } else {
        state.pedestalDials[dialIdx] = (state.pedestalDials[dialIdx] - 1 + DIAL_SYMBOLS.length) % DIAL_SYMBOLS.length;
      }
      updateAllDials();
    });
  });

  checkPedestalBtn.addEventListener('click', () => {
    if (state.pedestalSolved) {
      pedestalStatus.textContent = 'The pedestal compartment is already open.';
      return;
    }
    // Expected: Moon (1), Pumpkin (2), Skull (0)
    if (state.pedestalDials[0] === 1 && state.pedestalDials[1] === 2 && state.pedestalDials[2] === 0) {
      state.pedestalSolved = true; updateEscapeTracker();
      triggerScreenShake(25, 7);
      spawnFloatText('Celestial Sigil Aligned!', '#00f2fe', 700, 310);
      sound.playUnlock();
      pedestalStatus.textContent = 'The celestial discs chime in harmony! The pedestal opens to reveal a Gilded Key and Bone Key!';
      addItem('gilded_key');
      addItem('bone_key');
    } else {
      sound.playError();
      pedestalStatus.textContent = 'The symbols do not align with the ancient verse.';
    }
  });

  // --- Puzzle 6: Relic Chest / Sarcophagus ---
  const unlockChestBtn = document.getElementById('unlockChestBtn');
  const chestStatus = document.getElementById('chestStatus');

  unlockChestBtn.addEventListener('click', () => {
    if (state.chestUnlocked) {
      chestStatus.textContent = 'The relic chest is already unlocked.';
      return;
    }
    if (state.selectedItem === 'bone_key' || state.inventory.includes('bone_key')) {
      state.chestUnlocked = true;
      removeItem('bone_key');
      sound.playUnlock();
      addItem('sigil');
      chestStatus.textContent = 'The bone key clicks in the lock! Inside lies the ancient Eye Talisman!';
    } else {
      sound.playError();
      chestStatus.textContent = 'You need a key crafted of bone to turn this lock.';
    }
  });

  // --- Final Escape: The Iron Crypt Gate ---
  const interactGateBtn = document.getElementById('interactGateBtn');
  const gateStatus = document.getElementById('gateStatus');
  const lockChains = document.getElementById('lockChains');
  const lockKeyhole = document.getElementById('lockKeyhole');
  const lockSigil = document.getElementById('lockSigil');

  function updateGateLocksUI() {
    if (state.gateLocks.chains) lockChains.classList.add('unlocked');
    if (state.gateLocks.keyhole) lockKeyhole.classList.add('unlocked');
    if (state.gateLocks.sigil) lockSigil.classList.add('unlocked');
  }

  interactGateBtn.addEventListener('click', () => {
    if (state.gameWon) return;

    if (!state.selectedItem) {
      gateStatus.textContent = 'Select an item from your inventory to use on the gate.';
      return;
    }

    if (state.selectedItem === 'acid' && !state.gateLocks.chains) {
      state.gateLocks.chains = true;
      triggerScreenShake(35, 9);
      spawnFloatText('Chains Corroded & Shattered!', '#38ef7d', 480, 200);
      removeItem('acid');
      sound.playUnlock();
      gateStatus.textContent = 'The acid dissolves the heavy corroded chains in a cloud of fizzing steam!';
      updateGateLocksUI();
    } else if (state.selectedItem === 'gilded_key' && !state.gateLocks.keyhole) {
      state.gateLocks.keyhole = true;
      triggerScreenShake(25, 6);
      spawnFloatText('Master Crypt Lock Disengaged!', '#ffd700', 480, 240);
      removeItem('gilded_key');
      sound.playUnlock();
      gateStatus.textContent = 'The gilded key slides into the master lock and turns with a loud CLACK!';
      updateGateLocksUI();
    } else if (state.selectedItem === 'sigil' && !state.gateLocks.sigil) {
      state.gateLocks.sigil = true;
      triggerScreenShake(30, 8);
      spawnFloatText('Ancient Eye Talisman Bound!', '#c084fc', 480, 280);
      removeItem('sigil');
      sound.playUnlock();
      gateStatus.textContent = 'The Eye Talisman fits into the socket, breaking the dark magical ward!';
      updateGateLocksUI();
    } else {
      sound.playError();
      gateStatus.textContent = 'That item does not affect the gate locks.';
    }

    // Check Victory Condition
    if (state.gateLocks.chains && state.gateLocks.keyhole && state.gateLocks.sigil) {
      state.gameWon = true;
      state.timerActive = false;
      sound.playVictory();
      setTimeout(() => {
        closeModal(modalGate);
        document.getElementById('vicTime').textContent = timerBox.textContent;
        const totalSec = state.secondsElapsed;
        let rank = 'Crypt Novice';
        if (totalSec < 120) rank = 'Archmage Master';
        else if (totalSec < 240) rank = 'Arcane Sleuth';
        else if (totalSec < 360) rank = 'Crypt Escapist';
        document.getElementById('vicRating').textContent = rank;
        openModal(modalVictory);
      }, 900);
    }
  });

  // --- Hotspots Click Bindings ---
  hotspotGate.addEventListener('click', () => openModal(modalGate));
  hotspotBooks.addEventListener('click', () => openModal(modalBookshelf));
  hotspotCauldron.addEventListener('click', () => openModal(modalCauldron));
  hotspotPedestal.addEventListener('click', () => openModal(modalPedestal));
  hotspotChest.addEventListener('click', () => openModal(modalChest));
  hotspotTorches.addEventListener('click', () => openModal(modalTorches));

  // --- Header Controls ---
  document.getElementById('helpBtn').addEventListener('click', () => openModal(modalHelp));

  const soundToggle = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  soundToggle.addEventListener('click', () => {
    sound.muted = !sound.muted;
    if (sound.muted) {
      soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
      showToast('Sound Muted');
    } else {
      sound.init();
      soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
      showToast('Sound Enabled');
    }
  });

  const hintBtn = document.getElementById('hintBtn');
  hintBtn.addEventListener('click', () => {
    sound.playClick();
    if (!state.bookshelfSolved) {
      showToast('Hint: The riddle says "Blood precedes the Void; the Toxic Vine creeps after Dusk..."');
    } else if (!state.inventory.includes('ash') && !state.cauldron.ash) {
      showToast('Hint: Scrape the smoldering braziers using your silver dagger to gather ash.');
    } else if (!state.plantSearched) {
      showToast('Hint: Inspect the dead nightshade plant in the corner.');
    } else if (!state.cauldron.brewed) {
      showToast('Hint: Throw the Spider Venom, Mandrake Root, and Cursed Ash into the cauldron.');
    } else if (!state.pedestalSolved) {
      showToast('Hint: Rotate the altar discs: "Moon crowns Pumpkin, Death (Skull) sleeps".');
    } else if (!state.chestUnlocked) {
      showToast('Hint: Use the Bone Key to unlock the Sarcophagus Relic Chest.');
    } else {
      showToast('Hint: Apply the Acid, Gilded Key, and Eye Talisman to the Iron Gate!');
    }
  });

  document.getElementById('playAgainBtn').addEventListener('click', () => {
    window.location.reload();
  });

  // --- Timer Loop ---
  setInterval(() => {
    if (!state.timerActive) return;
    state.secondsElapsed++;
    const m = Math.floor(state.secondsElapsed / 60).toString().padStart(2, '0');
    const s = (state.secondsElapsed % 60).toString().padStart(2, '0');
    timerBox.textContent = `${m}:${s}`;
  }, 1000);

  // Initial inventory render
  updateInventoryUI();
})();
