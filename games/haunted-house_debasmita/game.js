/**
 * Haunted House: The Curse Within
 * Professional First-Person Mystery Horror Experience
 * Author: Debasmita Bose (DebasmitaBose0)
 */

(() => {
  'use strict';

  // --- SVG Icons (Strictly Zero Unicode Emojis) ---
  const SVG_ICONS = {
    brass_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1-1l-3 3m2 8A6 6 0 1 1 5 8a6 6 0 0 1 12 6z"></path><circle cx="9" cy="14" r="1.5"></circle></svg>',
    silver_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="M11.5 11.5L22 1"></path><path d="M18 5l2 2"></path></svg>',
    basement_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><circle cx="12" cy="16" r="2"></circle><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    matches: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2.5-5 4-8z"></path></svg>',
    batteries: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="16" height="10" rx="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line></svg>',
    tome: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    locket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="6"></circle><path d="M12 2v6"></path><path d="M9 5h6"></path></svg>',
    salt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    cellar_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5"></circle><line x1="10.5" y1="10.5" x2="22" y2="22"></line><line x1="17" y1="17" x2="19" y2="15"></line><line x1="20" y1="20" x2="22" y2="18"></line></svg>',
    kerosene: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2h4"></path><path d="M12 2v4"></path><path d="M6 10h12l-2 11H8L6 10z"></path></svg>',
    archival_journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
  };

  const ITEM_NAMES = {
    brass_key: 'Rusty Brass Key',
    silver_key: 'Parlor Silver Key',
    basement_key: 'Iron Crypt Key',
    matches: 'Box of Matchsticks',
    batteries: 'Flashlight Batteries',
    tome: 'Tome of Shadows',
    locket: "Eleanor's Golden Locket",
    salt: 'Consecrated Holy Salt',
    cellar_key: 'Rusted Cellar Trapdoor Key',
    kerosene: 'Flask of Refined Kerosene',
    archival_journal: 'Lord Archibald Diary Volume II'
  };

  // --- Web Audio Procedural Horror Sound Engine ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.breathingOsc = null;
      this.breathingGain = null;
      this.activeNodes = new Set();
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

    trackNode(osc) {
      if (!this.activeNodes) this.activeNodes = new Set();
      this.activeNodes.add(osc);
      osc.onended = () => {
        if (this.activeNodes) this.activeNodes.delete(osc);
      };
      return osc;
    }

    stopAll() {
      if (this.activeNodes) {
        this.activeNodes.forEach(node => {
          try {
            node.stop();
            node.disconnect();
          } catch (_) {}
        });
        this.activeNodes.clear();
      }
    }

    playClick() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this.trackNode(osc);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    }

    playCreak() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(160, this.ctx.currentTime + 0.35);
      osc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + 0.7);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.7);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this.trackNode(osc);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.7);
    }

    playThunder() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 1.4);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this.trackNode(osc);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.4);
    }

    playHeartbeat() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      [0, 0.18].forEach(delay => {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(65, this.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          this.trackNode(osc);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.12);
        }, delay * 1000);
      });
    }

    playBreathing() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      // Inhaling and exhaling white noise / filtered sine wave
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(50, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.8);
      osc.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + 1.6);
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this.trackNode(osc);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.6);
    }

    playWhisper() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(320, this.ctx.currentTime + 0.4);
      osc.frequency.linearRampToValueAtTime(220, this.ctx.currentTime + 0.9);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.9);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this.trackNode(osc);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.9);
    }

    playMusicBox() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const notes = [659.25, 783.99, 987.77, 880.00, 783.99, 659.25];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.55);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          this.trackNode(osc);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.55);
        }, idx * 280);
      });
    }

    playJumpscare() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.65);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      this.trackNode(osc);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.65);
    }
  }

  const sound = new SoundEngine();

  // --- Game State ---
  const state = {
    currentRoom: 'porch',
    unlockedRooms: ['porch'],
    inventory: [],
    selectedItem: null,
    sanity: 100,
    battery: 100,
    flashlightOn: true,
    isHiding: false,
    threatLevel: 'quiet', // 'quiet', 'whisper', 'danger'
    threatTimer: 0,
    dangerCountdown: 0,
    mousePos: { x: 480, y: 270 },

    // Journal Lore
    journal: [],

    // Puzzles & Story Flags
    porchKeyFound: false,
    foyerDoorUnlocked: false,
    gramophonePlayed: false,
    safeUnlocked: false,
    safeDigits: [1, 8, 9, 0], // expected: 1 8 9 8
    bookshelfOpened: false,
    breakerSwitches: [false, true, false, false], // expected: [true, false, true, true]
    breakerEngaged: false,
    musicBoxOpened: false,
    saltFound: false,
    altarCleansed: false,
    chapterTwoUnlocked: false,
    lanternFuel: 100,
    hasLantern: false,
    catacombHatchOpen: false,
    wineCaskInspected: false,
    ossuaryCryptInspected: false,
    stoneRings: { outer: 135, mid: 180, inner: 225 }, // degrees; all must be 0 % 360
    sealUnlocked: false,
    gameEnded: false,

    // Dynamic Atmosphere & Animation State
    cameraOffset: { x: 0, y: 0 },
    dustMotes: [],
    fireplaceSparks: [],
    waterRipples: [],
    porchLeaves: [],
    waterDrops: [],
    rainStreaks: [],
    floatingTexts: [],
    dripTimer: 0
  };

  // Helper: Spawn floating text popup
  function spawnFloatText(text, color = '#ffaa32', x = 500, y = 300) {
    state.floatingTexts.push({
      text,
      color,
      x: x + (Math.random() - 0.5) * 40,
      y,
      vy: -0.85,
      alpha: 1.0,
      life: 0,
      maxLife: 75
    });
  }

  // Helper: Initialize Dynamic Weather & Particles
  function initAtmosphere() {
    state.dustMotes = [];
    for (let i = 0; i < 40; i++) {
      state.dustMotes.push({
        x: Math.random() * 1000,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.15 - Math.random() * 0.3,
        size: 1 + Math.random() * 2.2,
        alpha: 0.15 + Math.random() * 0.45,
        wobble: Math.random() * Math.PI * 2
      });
    }

    state.porchLeaves = [];
    const leafColors = ['#c2410c', '#ea580c', '#b45309', '#78350f', '#991b1b'];
    for (let i = 0; i < 20; i++) {
      state.porchLeaves.push({
        x: Math.random() * 1000,
        y: Math.random() * 600,
        vx: -1.2 - Math.random() * 1.8,
        vy: 0.6 + Math.random() * 1.0,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        size: 3.5 + Math.random() * 3.5,
        color: leafColors[Math.floor(Math.random() * leafColors.length)]
      });
    }

    state.rainStreaks = [];
    for (let i = 0; i < 55; i++) {
      state.rainStreaks.push({
        x: Math.random() * 1100,
        y: Math.random() * 650,
        speed: 12 + Math.random() * 7,
        length: 12 + Math.random() * 14,
        alpha: 0.15 + Math.random() * 0.3
      });
    }
  }
  initAtmosphere();

  // --- DOM References ---
  const canvas = document.getElementById('mansionCanvas');
  const ctx = canvas.getContext('2d');
  const hotspotsLayer = document.getElementById('hotspotsLayer');
  const lightningFx = document.getElementById('lightningFx');
  const panicVignette = document.getElementById('panicVignette');
  const paranormalBanner = document.getElementById('paranormalBanner');
  const investigationReticle = document.getElementById('investigationReticle');
  const reticleText = document.getElementById('reticleText');
  const wardrobeSlitOverlay = document.getElementById('wardrobeSlitOverlay');
  const sanityBar = document.getElementById('sanityBar');
  const batteryBar = document.getElementById('batteryBar');
  const threatBadge = document.getElementById('threatBadge');
  const caseTracker = document.getElementById('caseTracker');
  const caseText = document.getElementById('caseText');
  const btnFlashlight = document.getElementById('btnFlashlight');
  const lightLabel = document.getElementById('lightLabel');
  const btnHide = document.getElementById('btnHide');
  const hideLabel = document.getElementById('hideLabel');
  const btnJournal = document.getElementById('btnJournal');
  const inventoryTray = document.getElementById('inventoryTray');
  const dockHint = document.getElementById('dockHint');

  // Modals
  const modalHelp = document.getElementById('modalHelp');
  const btnStartGame = document.getElementById('btnStartGame');
  const modalJournal = document.getElementById('modalJournal');
  const journalContent = document.getElementById('journalContent');
  const modalSafe = document.getElementById('modalSafe');
  const modalBreaker = document.getElementById('modalBreaker');
  const modalAltar = document.getElementById('modalAltar');
  const modalEnding = document.getElementById('modalEnding');
  const modalSeal = document.getElementById('modalSeal');
  const lanternMeterGroup = document.getElementById('lanternMeterGroup');
  const lanternBar = document.getElementById('lanternBar');
  const ringOuterEl = document.getElementById('ringOuter');
  const ringMidEl = document.getElementById('ringMid');
  const ringInnerEl = document.getElementById('ringInner');
  const sealStatus = document.getElementById('sealStatus');
  const btnRotateOuter = document.getElementById('btnRotateOuter');
  const btnRotateMid = document.getElementById('btnRotateMid');
  const btnRotateInner = document.getElementById('btnRotateInner');
  const btnInspectSealAlignment = document.getElementById('btnInspectSealAlignment');
  const endingTitle = document.getElementById('endingTitle');
  const endingText = document.getElementById('endingText');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Progressive Step-by-Step Case Tracker ---
  function updateCaseTracker() {
    if (!caseText) return;
    if (!state.porchKeyFound) {
      caseText.textContent = 'TASK 1/5: Search the rain-soaked porch to find the brass entrance key.';
    } else if (!state.foyerDoorUnlocked) {
      caseText.textContent = 'TASK 1/5: Select Rusty Brass Key in inventory and unlock the Front Entrance.';
    } else if (!state.safeUnlocked) {
      caseText.textContent = "TASK 2/5: Explore the Living Room and decode Archibald's safe behind the portrait (Year: 1898).";
    } else if (!state.breakerEngaged) {
      caseText.textContent = 'TASK 3/5: Enter the Crypt and align the 4 auxiliary breaker switches to restore power.';
    } else if (!state.altarCleansed) {
      const missing = [];
      if (!state.inventory.includes('locket')) missing.push("Eleanor's Locket (Bedroom)");
      if (!state.inventory.includes('matches')) missing.push('Matchbox (Kitchen)');
      if (!state.inventory.includes('salt')) missing.push('Consecrated Salt (Pantry)');
      if (missing.length > 0) {
        caseText.textContent = `TASK 4/5: Gather ritual items: ${missing.join(', ')}.`;
      } else {
        caseText.textContent = "TASK 4/5: Place Eleanor's Locket, Light Candles, and Cast Salt at the Crypt Altar.";
      }
    } else {
      caseText.textContent = 'TASK 5/5: The curse is broken! Escape through the Crypt Storm Hatch to survive!';
    }
  }

  // --- Room Configuration & Hotspots ---
  const ROOM_CONFIGS = {
    porch: {
      name: 'Entrance Porch',
      hint: 'The iron entrance door is barred with an old brass lock. Search the overgrown steps.',
      hotspots: [
        {
          id: 'doormat',
          top: '80%',
          left: '43.5%',
          width: '9%',
          height: '8%',
          tag: 'Mossy Doormat',
          onClick: () => {
            if (!state.porchKeyFound) {
              state.porchKeyFound = true;
              addItem('brass_key');
              addJournalEntry('Torn Welcome Note (1898)', '"If you seek shelter from the storm, the key rests beneath the moss. But know this: once the threshold is crossed, the manor does not let go."');
              setHint('You found a Rusty Brass Key beneath the moldy doormat!');
              updateCaseTracker();
            } else {
              setHint('Nothing else beneath the damp mat.');
            }
          }
        },
        {
          id: 'frontDoor',
          top: '20%',
          left: '41%',
          width: '14%',
          height: '43%',
          tag: 'Mansion Front Entrance',
          onClick: () => {
            if (!state.foyerDoorUnlocked) {
              if (state.selectedItem === 'brass_key' || state.inventory.includes('brass_key')) {
                state.foyerDoorUnlocked = true;
                unlockRoom('foyer');
                sound.playCreak();
                setHint('The brass key turns with a loud heavy click! The front entrance swings open.');
                updateCaseTracker();
                switchRoom('foyer');
              } else {
                sound.playCreak();
                setHint('The heavy wooden door is locked tight. It needs a brass key.');
              }
            } else {
              switchRoom('foyer');
            }
          }
        },
        {
          id: 'gargoyle',
          top: '40%',
          left: '16%',
          width: '9%',
          height: '16%',
          tag: 'Weathered Gargoyle',
          onClick: () => {
            sound.playClick();
            setHint('A stone gargoyle weathered by a century of acid rain. Its hollow eyes seem to stare right at you.');
          }
        }
      ]
    },

    foyer: {
      name: 'Grand Foyer',
      hint: 'The central foyer. Doors lead into the Living Room, Library, Kitchen, and Cellar.',
      hotspots: [
        {
          id: 'doorParlor',
          top: '32%',
          left: '6%',
          width: '10%',
          height: '28%',
          tag: 'Living Room Door',
          onClick: () => {
            unlockRoom('parlor');
            switchRoom('parlor');
          }
        },
        {
          id: 'doorKitchen',
          top: '32%',
          left: '84%',
          width: '10%',
          height: '28%',
          tag: 'Kitchen Door',
          onClick: () => {
            unlockRoom('kitchen');
            switchRoom('kitchen');
          }
        },
        {
          id: 'clockFoyer',
          top: '26%',
          left: '30%',
          width: '5.5%',
          height: '28%',
          tag: 'Grandfather Clock',
          onClick: () => {
            sound.playClick();
            setHint('The pendulum is frozen at 11:58 PM. Blood-red scratches mark the wooden casing.');
          }
        },
        {
          id: 'staircase',
          top: '20%',
          left: '38%',
          width: '24%',
          height: '34%',
          tag: 'Grand Staircase (Upstairs)',
          onClick: () => {
            unlockRoom('bedroom');
            switchRoom('bedroom');
          }
        },
        {
          id: 'cellarGrate',
          top: '70%',
          left: '60%',
          width: '11%',
          height: '10%',
          tag: 'Basement Trapdoor',
          onClick: () => {
            if (state.unlockedRooms.includes('basement')) {
              switchRoom('basement');
            } else {
              if (state.selectedItem === 'basement_key' || state.inventory.includes('basement_key')) {
                unlockRoom('basement');
                sound.playCreak();
                setHint('The heavy iron padlock snaps open! The stone stairs descend into darkness.');
                switchRoom('basement');
              } else {
                setHint('A heavy iron grate bound by a chained padlock. Marked: "Crypt Access - Key Required".');
              }
            }
          }
        }
      ]
    },

    parlor: {
      name: 'Living Room & Parlor',
      hint: 'A grand fireplace and antique phonograph sit among moth-eaten Victorian furnishings.',
      hotspots: [
        {
          id: 'fireplace',
          top: '31%',
          left: '40%',
          width: '16%',
          height: '26%',
          tag: 'Cold Fireplace',
          onClick: () => {
            sound.playClick();
            addJournalEntry("Lord Blackwood's Regret (1898)", '"I made the pact with the shadows to preserve her fragile heart. But the entity asked for far more than blood... it wants every soul who enters Blackwood Manor."');
            setHint('You pulled a soot-stained diary page from the hearth ashes!');
          }
        },
        {
          id: 'painting',
          top: '22%',
          left: '45%',
          width: '95px',
          height: '95px',
          tag: 'Family Oil Portrait & Wall Safe',
          onClick: () => {
            openModal(modalSafe);
          }
        },
        {
          id: 'gramophone',
          top: '48%',
          left: '74%',
          width: '10%',
          height: '18%',
          tag: 'Antique Gramophone',
          onClick: () => {
            if (!state.gramophonePlayed) {
              state.gramophonePlayed = true;
              sound.playMusicBox();
              addItem('silver_key');
              setHint('As the eerie vinyl spins, a secret latch pops! You obtained the Parlor Silver Key.');
            } else {
              sound.playMusicBox();
              setHint('The phonograph crackles with the distant laughter of children.');
            }
          }
        },
        {
          id: 'doorToFoyer1',
          top: '42%',
          left: '86%',
          width: '75px',
          height: '130px',
          tag: 'Back to Foyer',
          onClick: () => switchRoom('foyer')
        }
      ]
    },

    library: {
      name: 'Library & Study',
      hint: 'Towering book stacks line the walls. A rotary phone rests upon the dark oak desk.',
      hotspots: [
        {
          id: 'secretBookshelf',
          top: '28%',
          left: '20%',
          width: '100px',
          height: '160px',
          tag: 'Arcane Bookcase',
          onClick: () => {
            if (!state.bookshelfOpened) {
              if (state.selectedItem === 'tome' || state.inventory.includes('tome')) {
                state.bookshelfOpened = true;
                sound.playCreak();
                addItem('basement_key');
                addJournalEntry('The Cellar Warning', '"The ritual pentagram in the crypt can banish the entity, but only if Eleanor\'s locket, sacred salt, and 4 lit candles are placed before the eclipse ends."');
                setHint('You placed the Tome of Shadows! The bookshelf slides open, revealing the Iron Crypt Key!');
              } else {
                setHint('An empty slot on the top shelf is marked with the sign of the shadow. You need the Tome of Shadows.');
              }
            } else {
              setHint('The secret compartment is already open.');
            }
          }
        },
        {
          id: 'deskPhone',
          top: '62%',
          left: '60%',
          width: '70px',
          height: '55px',
          tag: 'Rotary Telephone',
          onClick: () => {
            sound.playWhisper();
            triggerLightning();
            setHint('You lift the receiver... a cold ghostly voice whispers: "The locket is in her bedroom music box... free us..."');
          }
        },
        {
          id: 'doorToFoyer2',
          top: '32%',
          left: '4%',
          width: '8%',
          height: '26%',
          tag: 'Back to Foyer',
          onClick: () => switchRoom('foyer')
        }
      ]
    },

    kitchen: {
      name: 'Kitchen & Pantry',
      hint: 'A rusted meat locker and leaking cast iron faucet. Useful survival supplies may remain.',
      hotspots: [
        {
          id: 'kitchenCounter',
          top: '45%',
          left: '18%',
          width: '18%',
          height: '19%',
          tag: 'Prep Counter Drawer',
          onClick: () => {
            if (!state.inventory.includes('matches')) {
              addItem('matches');
              addItem('batteries');
              state.battery = 100;
              setHint('Found a Box of Matchsticks and fresh Flashlight Batteries!');
              updateCaseTracker();
            } else {
              setHint('The prep counter is cleared out.');
            }
          }
        },
        {
          id: 'pantryCupboard',
          top: '23%',
          left: '48%',
          width: '12%',
          height: '34%',
          tag: 'Locked Pantry Cupboard',
          onClick: () => {
            if (!state.saltFound) {
              state.saltFound = true;
              addItem('salt');
              addJournalEntry('Alchemical Sanctification', '"Blessed salt creates an impenetrable boundary against the entity. Scatter it across the pentagram."');
              setHint('You unlocked the pantry and found a jar of Consecrated Holy Salt!');
              updateCaseTracker();
            } else {
              setHint('The pantry shelves are now empty.');
            }
          }
        },
        {
          id: 'doorToFoyer3',
          top: '32%',
          left: '86%',
          width: '8%',
          height: '26%',
          tag: 'Back to Foyer',
          onClick: () => switchRoom('foyer')
        }
      ]
    },

    bedroom: {
      name: 'Master Bedroom',
      hint: 'Eleanor’s old bedchamber. An ornate vanity mirror reflects the shadows of the room.',
      hotspots: [
        {
          id: 'vanityMirror',
          top: '26%',
          left: '21%',
          width: '8%',
          height: '17%',
          tag: 'Ornate Vanity Mirror',
          onClick: () => {
            sound.playJumpscare();
            triggerPanic();
            setHint('A shadowy specter flashes in the glass reflection right behind you! Your heart pounds violently!');
          }
        },
        {
          id: 'nightstand',
          top: '33%',
          left: '44%',
          width: '22%',
          height: '27%',
          tag: 'Bedside Music Box',
          onClick: () => {
            if (!state.musicBoxOpened) {
              state.musicBoxOpened = true;
              sound.playMusicBox();
              addItem('locket');
              addItem('tome');
              addJournalEntry("Eleanor's Keepsake", '"Father gave me this locket on my tenth birthday in 1898. He swore it would keep the dark shadows away forever."');
              setHint("The music box plays Eleanor's lullaby and opens, revealing her Golden Locket and the Tome of Shadows!");
              updateCaseTracker();
            } else {
              sound.playMusicBox();
              setHint('The delicate music box chimes softly in the dark.');
            }
          }
        },
        {
          id: 'doorToFoyer4',
          top: '32%',
          left: '86%',
          width: '8%',
          height: '26%',
          tag: 'Downstairs to Foyer',
          onClick: () => switchRoom('foyer')
        }
      ]
    },

    basement: {
      name: 'Dark Basement & Crypt',
      hint: 'Cold stone walls and dripping condensation. The storm escape hatch and ritual altar are here.',
      hotspots: [
        {
          id: 'breakerBox',
          top: '26%',
          left: '14%',
          width: '8%',
          height: '19%',
          tag: 'Electrical Breaker Box',
          onClick: () => openModal(modalBreaker)
        },
        {
          id: 'ritualAltar',
          top: '50%',
          left: '42%',
          width: '14%',
          height: '20%',
          tag: 'Crypt Pentagram Altar',
          onClick: () => openModal(modalAltar)
        },
        {
          id: 'stormDoor',
          top: '26%',
          left: '78%',
          width: '10%',
          height: '28%',
          tag: 'Storm Exit Hatch',
          onClick: () => {
            if (state.breakerEngaged) {
              triggerEnding('survivor');
            } else {
              setHint('The storm door is held shut by an electromagnetic security lock. Restore power at the Breaker Box!');
            }
          }
        },
        {
          id: 'doorToFoyer5',
          top: '28%',
          left: '3%',
          width: '7%',
          height: '24%',
          tag: 'Stairs up to Foyer',
          onClick: () => switchRoom('foyer')
        },
        {
          id: 'trapdoorToCatacombs',
          top: '72%',
          left: '60%',
          width: '18%',
          height: '14%',
          tag: 'Catacombs Stone Trapdoor',
          onClick: () => {
            if (state.chapterTwoUnlocked) {
              switchRoom('wine_cellar');
            } else {
              setHint('A heavy engraved stone trapdoor with three concentric ring etchings. Cleanse the ritual altar first to unlock Chapter 2: The Catacombs.');
            }
          }
        }
      ]
    },

    wine_cellar: {
      name: 'Catacombs: Vintage Wine Cellar',
      hint: 'Damp vaulted limestone arches with giant wooden wine casks from 1845. Search the casks.',
      hotspots: [
        {
          id: 'wineCasks',
          top: '32%',
          left: '20%',
          width: '26%',
          height: '38%',
          tag: 'Ancient Oak Casks',
          onClick: () => {
            if (!state.wineCaskInspected) {
              state.wineCaskInspected = true;
              addItem('kerosene');
              spawnFloatText('+1 KEROSENE FLASK', '#f59e0b', 320, 260);
              addJournalEntry('Cellarman Vintage Log', '"The reserve casks contain refined kerosene lamps. Keep the lanterns ablaze down here; shadows take physical form in pitch black."');
              setHint('You found a Flask of Refined Kerosene tucked behind the moldering oak barrel!');
              updateCaseTracker();
            } else {
              setHint('Empty barrels smelling of fermented vintage blackberry wine and damp earth.');
            }
          }
        },
        {
          id: 'doorToBasement',
          top: '25%',
          left: '4%',
          width: '10%',
          height: '35%',
          tag: 'Stone Steps Up to Crypt',
          onClick: () => switchRoom('basement')
        },
        {
          id: 'doorToOssuary',
          top: '24%',
          left: '82%',
          width: '12%',
          height: '42%',
          tag: 'Tunnel to Ossuary',
          onClick: () => {
            unlockRoom('ossuary');
            switchRoom('ossuary');
          }
        }
      ]
    },

    ossuary: {
      name: 'Catacombs: The Ossuary Hall',
      hint: 'Alcoves lined with centuries-old family skulls and bones. An iron niche holds forgotten records.',
      hotspots: [
        {
          id: 'ossuaryAltarNiche',
          top: '30%',
          left: '42%',
          width: '16%',
          height: '34%',
          tag: 'Bone Mosaic Niche',
          onClick: () => {
            if (!state.ossuaryCryptInspected) {
              state.ossuaryCryptInspected = true;
              addItem('archival_journal');
              spawnFloatText('JOURNAL VOL II ACQUIRED', '#a855f7', 480, 240);
              addJournalEntry('Archibald Diary Vol II: Celestial Seal', '"The Ancestral Crypt is locked with concentric stone wheels. Align outer, middle, and inner notches to zenith (0 degrees) to breach the final sanctum."');
              setHint("Found Archibald's Journal Vol II! It details the rotating stone seal mechanism.");
              updateCaseTracker();
            } else {
              setHint('An ornate skull altar surrounded by extinguished tallow candles.');
            }
          }
        },
        {
          id: 'keroseneRefill',
          top: '68%',
          left: '18%',
          width: '12%',
          height: '18%',
          tag: 'Lantern Supply Crate',
          onClick: () => {
            state.lanternFuel = Math.min(100, state.lanternFuel + 50);
            if (lanternBar) lanternBar.style.width = state.lanternFuel + '%';
            spawnFloatText('LANTERN REFUELED (+50%)', '#f59e0b', 240, 360);
            setHint('Refilled oil lantern from the wall supply shelf!');
          }
        },
        {
          id: 'doorBackWine',
          top: '26%',
          left: '4%',
          width: '10%',
          height: '36%',
          tag: 'Archway to Wine Cellar',
          onClick: () => switchRoom('wine_cellar')
        },
        {
          id: 'doorToCryptSeal',
          top: '22%',
          left: '78%',
          width: '14%',
          height: '46%',
          tag: 'Heavy Granite Archway to Ancestral Crypt',
          onClick: () => {
            unlockRoom('ancestral_crypt');
            switchRoom('ancestral_crypt');
          }
        }
      ]
    },

    ancestral_crypt: {
      name: 'Catacombs: Ancestral Crypt & Reliquary',
      hint: 'The final sanctum of House Blackwood. The rotating runic stone seal guards the true escape passage.',
      hotspots: [
        {
          id: 'stoneSealPuzzle',
          top: '25%',
          left: '38%',
          width: '24%',
          height: '44%',
          tag: 'Concentric Stone Seal',
          onClick: () => openModal(modalSeal)
        },
        {
          id: 'doorBackOssuary',
          top: '28%',
          left: '4%',
          width: '10%',
          height: '36%',
          tag: 'Tunnel Back to Ossuary',
          onClick: () => switchRoom('ossuary')
        }
      ]
    }
  };

  // --- Room Switching & Hotspot Render ---
  function switchRoom(roomId) {
    if (!state.unlockedRooms.includes(roomId)) {
      setHint('That room is currently locked.');
      return;
    }
    sound.playCreak();
    state.currentRoom = roomId;

    // Update Nav Tabs and smooth-scroll into view on touch/mobile
    document.querySelectorAll('.room-tab').forEach(tab => {
      const isCurrent = tab.getAttribute('data-room') === roomId;
      tab.classList.toggle('active', isCurrent);
      if (isCurrent && tab.scrollIntoView) {
        tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    dockHint.textContent = ROOM_CONFIGS[roomId].hint;
    renderHotspots();
    updateCaseTracker();
  }

  function unlockRoom(roomId) {
    if (!state.unlockedRooms.includes(roomId)) {
      state.unlockedRooms.push(roomId);
      const tab = document.querySelector(`.room-tab[data-room="${roomId}"]`);
      if (tab) tab.classList.remove('locked');
      sound.playClick();
    }
  }

  function renderHotspots() {
    hotspotsLayer.innerHTML = '';
    const cfg = ROOM_CONFIGS[state.currentRoom];
    if (!cfg || !cfg.hotspots) return;

    cfg.hotspots.forEach(hs => {
      const el = document.createElement('div');
      el.className = 'mansion-hotspot';
      el.style.top = hs.top;
      el.style.left = hs.left;
      el.style.width = hs.width;
      el.style.height = hs.height;
      el.setAttribute('data-tag', hs.tag);

      el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2a10 10 0 0 0-10 10c0 4.5 3 8 7 9.5"></path>
        </svg>
        <span class="hotspot-tag">${hs.tag}</span>
      `;

      el.addEventListener('click', e => {
        e.stopPropagation();
        hs.onClick();
      });

      // Reticle Hover Trigger
      el.addEventListener('mouseenter', () => {
        if (!investigationReticle) return;
        investigationReticle.classList.add('active');
        if (state.selectedItem) {
          reticleText.textContent = `[USE: ${ITEM_NAMES[state.selectedItem] || state.selectedItem}] ${hs.tag}`;
        } else {
          reticleText.textContent = `[EXAMINE] ${hs.tag}`;
        }
      });

      el.addEventListener('mouseleave', () => {
        if (investigationReticle) {
          investigationReticle.classList.remove('active');
        }
      });

      hotspotsLayer.appendChild(el);
    });
  }

  // --- Dynamic Reticle Position Tracking ---
  window.addEventListener('mousemove', e => {
    if (investigationReticle) {
      investigationReticle.style.left = `${e.clientX}px`;
      investigationReticle.style.top = `${e.clientY}px`;
    }
  }, { passive: true });

  // --- Inventory System ---
  function updateInventoryUI() {
    inventoryTray.innerHTML = '';
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
            setHint('Deselected item.');
          } else {
            state.selectedItem = itemKey;
            setHint(`Selected: ${ITEM_NAMES[itemKey]}. Tap an object in the room to use it.`);
          }
          updateInventoryUI();
        });
      } else {
        slot.title = 'Empty pocket';
      }
      inventoryTray.appendChild(slot);
    }
    updateCaseTracker();
  }

  function addItem(itemKey) {
    const itemName = (typeof ITEM_NAMES !== 'undefined' && ITEM_NAMES[itemKey]) ? ITEM_NAMES[itemKey] : itemKey;
    spawnFloatText('+ ' + itemName, '#38ef7d', 500, 280);
    if (!state.inventory.includes(itemKey)) {
      state.inventory.push(itemKey);
      sound.playClick();
      updateInventoryUI();
    }
  }

  function removeItem(itemKey) {
    const idx = state.inventory.indexOf(itemKey);
    if (idx !== -1) {
      state.inventory.splice(idx, 1);
      if (state.selectedItem === itemKey) state.selectedItem = null;
      updateInventoryUI();
    }
  }

  function setHint(text) {
    dockHint.textContent = text;
  }

  // --- Case Journal System ---
  function addJournalEntry(title, content) {
    spawnFloatText('Clue: ' + title, '#c084fc', 500, 240);
    if (!state.journal.some(j => j.title === title)) {
      state.journal.push({ title, content });
      sound.playClick();
      updateJournalUI();
    }
  }

  function updateJournalUI() {
    if (state.journal.length === 0) return;
    journalContent.innerHTML = '';
    state.journal.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'journal-entry';
      div.innerHTML = `<h4>${entry.title}</h4><p>${entry.content}</p>`;
      journalContent.appendChild(div);
    });
  }

  // --- Paranormal Threat & Wardrobe Concealment ---
  function triggerLightning() {
    sound.playThunder();
    lightningFx.classList.add('flash');
    setTimeout(() => {
      lightningFx.classList.remove('flash');
    }, 120);
  }

  function triggerPanic() {
    spawnFloatText('PARANORMAL ENTITY DETECTED!', '#ef4444', 500, 220);
    state.threatLevel = 'danger';
    threatBadge.textContent = 'DANGER!';
    threatBadge.className = 'threat-badge danger';
    panicVignette.classList.add('active');
    btnHide.classList.add('urgent');
    paranormalBanner.classList.add('active');
    state.dangerCountdown = 6;
  }

  function resolvePanic(survived) {
    state.threatLevel = 'quiet';
    threatBadge.textContent = 'Quiet';
    threatBadge.className = 'threat-badge';
    panicVignette.classList.remove('active');
    btnHide.classList.remove('urgent');
    paranormalBanner.classList.remove('active');

    if (!survived) {
      sound.playJumpscare();
      state.sanity = Math.max(0, state.sanity - 35);
      sanityBar.style.width = `${state.sanity}%`;
      setHint('The shadow entity strikes through your mind! Your sanity has deteriorated!');
      if (state.sanity <= 0) {
        triggerEnding('bad');
      }
    } else {
      setHint('You held your breath in silence inside the wardrobe... the cold presence drifted away.');
    }
  }

  // Hide button toggle with Wardrobe Eye-Slit View
  btnHide.addEventListener('click', () => {
    sound.playClick();
    state.isHiding = !state.isHiding;
    if (state.isHiding) {
      hideLabel.textContent = 'Un-Hide [H]';
      btnHide.style.background = '#3c1854';
      if (wardrobeSlitOverlay) wardrobeSlitOverlay.classList.add('active');
      sound.playBreathing();
      if (state.threatLevel === 'danger') {
        setTimeout(() => {
          resolvePanic(true);
        }, 1400);
      }
    } else {
      hideLabel.textContent = 'Hide [H]';
      btnHide.style.background = '';
      if (wardrobeSlitOverlay) wardrobeSlitOverlay.classList.remove('active');
    }
  });

  // Flashlight button toggle
  btnFlashlight.addEventListener('click', () => {
    sound.playClick();
    state.flashlightOn = !state.flashlightOn;
    lightLabel.textContent = state.flashlightOn ? 'Light: ON [F]' : 'Light: OFF [F]';
  });

  // --- Safe Puzzle (Living Room) ---
  const safeDigit0 = document.getElementById('safeDigit0');
  const safeDigit1 = document.getElementById('safeDigit1');
  const safeDigit2 = document.getElementById('safeDigit2');
  const safeDigit3 = document.getElementById('safeDigit3');
  const safeStatus = document.getElementById('safeStatus');
  const btnUnlockSafe = document.getElementById('btnUnlockSafe');

  document.querySelectorAll('.digit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const dial = parseInt(btn.getAttribute('data-dial'), 10);
      const dir = btn.getAttribute('data-dir');
      if (dir === 'up') {
        state.safeDigits[dial] = (state.safeDigits[dial] + 1) % 10;
      } else {
        state.safeDigits[dial] = (state.safeDigits[dial] - 1 + 10) % 10;
      }
      safeDigit0.textContent = state.safeDigits[0];
      safeDigit1.textContent = state.safeDigits[1];
      safeDigit2.textContent = state.safeDigits[2];
      safeDigit3.textContent = state.safeDigits[3];
    });
  });

  btnUnlockSafe.addEventListener('click', () => {
    if (state.safeUnlocked) {
      safeStatus.textContent = 'The safe is already opened.';
      return;
    }
    // Target combination: 1898
    if (state.safeDigits[0] === 1 && state.safeDigits[1] === 8 && state.safeDigits[2] === 9 && state.safeDigits[3] === 8) {
      state.safeUnlocked = true;
      sound.playCreak();
      unlockRoom('library');
      safeStatus.textContent = 'CLACK! The heavy safe door swings open! The Library is now unlocked!';
      addJournalEntry('Blackwood Deed of 1898', '"To the master of the manor: the library holds the secret mechanism to enter the crypt below."');
      setHint('You unlocked the wall safe and discovered access to the Library!');
      updateCaseTracker();
    } else {
      sound.playCreak();
      safeStatus.textContent = 'The dial clicks with resistance. Incorrect combination.';
    }
  });

  // --- Breaker Box Puzzle (Basement) ---
  const breakerSwitchesRow = document.getElementById('breakerSwitchesRow');
  const breakerStatus = document.getElementById('breakerStatus');
  const btnEngageBreaker = document.getElementById('btnEngageBreaker');

  function renderBreakerSwitches() {
    breakerSwitchesRow.innerHTML = '';
    state.breakerSwitches.forEach((val, idx) => {
      const b = document.createElement('button');
      b.className = 'btn-secondary';
      b.style.borderColor = val ? '#38ef7d' : '#ff4d4d';
      b.textContent = `Breaker ${idx + 1}: ${val ? 'UP' : 'DOWN'}`;
      b.addEventListener('click', () => {
        sound.playClick();
        state.breakerSwitches[idx] = !state.breakerSwitches[idx];
        renderBreakerSwitches();
      });
      breakerSwitchesRow.appendChild(b);
    });
  }
  renderBreakerSwitches();

  btnEngageBreaker.addEventListener('click', () => {
    // Expected pattern: UP, DOWN, UP, UP
    if (state.breakerSwitches[0] === true && state.breakerSwitches[1] === false && state.breakerSwitches[2] === true && state.breakerSwitches[3] === true) {
      state.breakerEngaged = true;
      sound.playCreak();
      triggerLightning();
      breakerStatus.textContent = 'POWER RESTORED! The electromagnetic lock on the Storm Door buzzes open!';
      setHint('The basement lights spark to life! The storm escape door is now powered and unlocked.');
      updateCaseTracker();
    } else {
      sound.playJumpscare();
      breakerStatus.textContent = 'Sparks shower from the fusebox! Breaker tripped. Try another circuit combination.';
    }
  });

  // --- Ritual Altar Modal & Endings ---
  const btnPerformRitual = document.getElementById('btnPerformRitual');
  const btnQuickEscape = document.getElementById('btnQuickEscape');
  const altarStatus = document.getElementById('altarStatus');

  btnQuickEscape.addEventListener('click', () => {
    closeModal(modalAltar);
    if (state.breakerEngaged) {
      triggerEnding('survivor');
    } else {
      setHint('The storm door is still unpowered! Restore power at the Breaker Box first.');
    }
  });

  btnPerformRitual.addEventListener('click', () => {
    const hasLocket = state.inventory.includes('locket') || state.selectedItem === 'locket';
    const hasMatches = state.inventory.includes('matches') || state.selectedItem === 'matches';
    const hasSalt = state.inventory.includes('salt') || state.selectedItem === 'salt';

    if (hasLocket && hasMatches && hasSalt) {
      state.altarCleansed = true;
      state.chapterTwoUnlocked = true;
      state.hasLantern = true;
      sound.playMusicBox();
      altarStatus.textContent = 'The celestial locket illuminates the crypt! An ancient stone floor trapdoor slides open leading into The Catacombs!';
      addItem('cellar_key');
      addJournalEntry('Subterranean Catacombs Protocol', '"Beneath Blackwood Manor lies the ancestral crypt. The stone seal guards the ancient heirloom. Conserve lantern fuel or the suffocating darkness will consume you."');
      
      // Reveal Catacomb tabs and lantern meter
      document.querySelectorAll('.catacomb-tab').forEach(tab => tab.style.display = 'inline-block');
      if (lanternMeterGroup) lanternMeterGroup.style.display = 'flex';
      unlockRoom('wine_cellar');
      updateCaseTracker();
      
      setTimeout(() => {
        closeModal(modalAltar);
        switchRoom('wine_cellar');
        setHint('CHAPTER 2 UNLOCKED: Entered the Catacombs Wine Cellar! Maintain oil lantern fuel with kerosene!');
      }, 2000);
    } else {
      sound.playCreak();
      altarStatus.textContent = 'Missing ritual artifacts! You need: Eleanor\'s Locket, Matchsticks, and Consecrated Salt.';
    }
  });


  // --- Rotating Stone Seal Controls (Catacombs Chapter 2) ---
  function updateSealVisuals() {
    if (ringOuterEl) ringOuterEl.style.transform = `rotate(${state.stoneRings.outer}deg)`;
    if (ringMidEl) ringMidEl.style.transform = `rotate(${state.stoneRings.mid}deg)`;
    if (ringInnerEl) ringInnerEl.style.transform = `rotate(${state.stoneRings.inner}deg)`;
  }

  if (btnRotateOuter) {
    btnRotateOuter.addEventListener('click', () => {
      sound.playClick();
      state.stoneRings.outer = (state.stoneRings.outer + 45) % 360;
      updateSealVisuals();
    });
  }

  if (btnRotateMid) {
    btnRotateMid.addEventListener('click', () => {
      sound.playClick();
      state.stoneRings.mid = (state.stoneRings.mid + 90) % 360;
      updateSealVisuals();
    });
  }

  if (btnRotateInner) {
    btnRotateInner.addEventListener('click', () => {
      sound.playClick();
      state.stoneRings.inner = (state.stoneRings.inner + 45) % 360;
      updateSealVisuals();
    });
  }

  if (btnInspectSealAlignment) {
    btnInspectSealAlignment.addEventListener('click', () => {
      const isAligned = (state.stoneRings.outer % 360 === 0) &&
                        (state.stoneRings.mid % 360 === 0) &&
                        (state.stoneRings.inner % 360 === 0);
      if (isAligned) {
        state.sealUnlocked = true;
        sound.playMusicBox();
        sealStatus.textContent = 'Runic glyphs resonate with golden light! The granite crypt seal unlocks!';
        updateCaseTracker();
        setTimeout(() => {
          closeModal(modalSeal);
          triggerEnding('cursebreaker');
        }, 1600);
      } else {
        sound.playCreak();
        sealStatus.textContent = `Unaligned: Outer ${state.stoneRings.outer}°, Mid ${state.stoneRings.mid}°, Inner ${state.stoneRings.inner}° (Must all reach 0°)`;
      }
    });
  }

  function triggerEnding(type) {
    state.gameEnded = true;
    sound.stopAll();
    if (type === 'cursebreaker') {
      endingTitle.textContent = 'ENDING 1: THE CURSE BREAKER (TRUE ENDING)';
      endingTitle.className = 'ending-title good';
      endingText.innerHTML = `
        <p>You consecrated the pentagram with Eleanor's Golden Locket, lit the sacred candles, and broke the century-old Blackwood curse.</p>
        <p style="margin-top: 10px;">The tortured spirits of the family ascend in peace. The heavy doors swing wide open as the warm orange rays of the morning sun banish the darkness of Blackwood Manor forever.</p>
      `;
    } else if (type === 'survivor') {
      endingTitle.textContent = 'ENDING 2: THE TRAUMATIZED SURVIVOR';
      endingTitle.className = 'ending-title neutral';
      endingText.innerHTML = `
        <p>You restored the auxiliary power and fled through the storm cellar hatch into the rainy autumn woods.</p>
        <p style="margin-top: 10px;">You survived with your life, but the dark curse still lingers over Blackwood Manor. Every Halloween night, you can still hear the whispers following your steps...</p>
      `;
    } else {
      endingTitle.textContent = 'ENDING 3: CLAIMED BY THE SHADOWS';
      endingTitle.className = 'ending-title bad';
      endingText.innerHTML = `
        <p>Your mental sanity completely shattered under the terror of the paranormal entity.</p>
        <p style="margin-top: 10px;">You collapsed in the cold dark corridors. By morning, a new painted portrait hangs silently in the parlor gallery... waiting for the next victim.</p>
      `;
    }
    openModal(modalEnding);
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
      const id = btn.getAttribute('data-close');
      const el = document.getElementById(id);
      if (el) closeModal(el);
    });
  });

  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      sound.init();
      sound.playClick();
      closeModal(modalHelp);
    });
  }

  btnJournal.addEventListener('click', () => openModal(modalJournal));
  document.getElementById('helpBtn').addEventListener('click', () => openModal(modalHelp));
  document.getElementById('btnRestartGame').addEventListener('click', () => {
    sound.stopAll();
    window.location.reload();
  });

  window.addEventListener('message', (e) => {
    if (e.data && (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE')) {
      sound.stopAll();
    }
  });

  // Room Nav Tabs
  document.querySelectorAll('.room-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-room');
      switchRoom(target);
    });
  });

  // Sound toggle
  const soundToggle = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  soundToggle.addEventListener('click', () => {
    sound.muted = !sound.muted;
    if (sound.muted) {
      soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
    } else {
      sound.init();
      soundIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    }
  });

  // Mouse tracking for Flashlight
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    state.mousePos.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    state.mousePos.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      state.mousePos.x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      state.mousePos.y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    }
  }, { passive: true });

  // --- Canvas 60 FPS Room Rendering Loop ---
  const VW = 1000;
  const VH = 600;

  function renderRoom(time) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const rm = state.currentRoom;

    // --- Dynamic 2.5D Camera Parallax ---
    const targetCamX = ((state.mousePos.x / (w || 1)) - 0.5) * -22;
    const targetCamY = ((state.mousePos.y / (h || 1)) - 0.5) * -16;
    state.cameraOffset.x += (targetCamX - state.cameraOffset.x) * 0.08;
    state.cameraOffset.y += (targetCamY - state.cameraOffset.y) * 0.08;

    if (hotspotsLayer) {
      hotspotsLayer.style.transform = `translate(${state.cameraOffset.x * 0.35}px, ${state.cameraOffset.y * 0.35}px)`;
    }

    ctx.save();
    ctx.translate(state.cameraOffset.x, state.cameraOffset.y);
    ctx.scale(w / VW, h / VH);

    // ==========================================
    // ROOM 1: PORCH (Victorian Exterior Nocturne)
    // ==========================================
    if (rm === 'porch') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, VH);
      skyGrad.addColorStop(0, '#020105');
      skyGrad.addColorStop(0.65, '#0a0514');
      skyGrad.addColorStop(1, '#170c24');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-40, -40, VW + 80, VH + 80);

      // Gnarled silhouettes of dead oaks
      ctx.fillStyle = '#08040d';
      for (let i = 20; i < VW + 40; i += 110) {
        const sway = Math.sin(time * 0.0018 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(i, 360);
        ctx.lineTo(i + 8 + sway, 90);
        ctx.lineTo(i + 24 + sway, 360);
        ctx.fill();
        ctx.strokeStyle = '#08040d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(i + 12 + sway, 200);
        ctx.lineTo(i - 20 + sway * 1.5, 140);
        ctx.moveTo(i + 16 + sway, 160);
        ctx.lineTo(i + 40 + sway * 1.5, 120);
        ctx.stroke();
      }

      // Weathered Stone Facade
      ctx.fillStyle = '#1c102b';
      ctx.fillRect(180, 30, 600, 520);
      ctx.strokeStyle = '#2d1845';
      ctx.lineWidth = 3;
      ctx.strokeRect(180, 30, 600, 520);

      // Second floor gothic arched windows with candlelight flicker
      for (let wx = 240; wx <= 660; wx += 140) {
        const winGlow = ctx.createRadialGradient(wx + 30, 110, 5, wx + 30, 110, 45);
        winGlow.addColorStop(0, 'rgba(255, 170, 50, 0.45)');
        winGlow.addColorStop(1, 'rgba(255, 170, 50, 0)');
        ctx.fillStyle = winGlow;
        ctx.fillRect(wx, 60, 60, 100);

        ctx.fillStyle = '#0a0512';
        ctx.beginPath();
        ctx.roundRect(wx, 70, 60, 90, [30, 30, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = '#3a2052';
        ctx.lineWidth = 2;
        ctx.stroke();

        const cFlicker = Math.sin(time * 0.008 + wx) * 3;
        ctx.fillStyle = '#ffaa32';
        ctx.beginPath();
        ctx.arc(wx + 30, 120 + cFlicker, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Gothic Entrance Arch
      ctx.fillStyle = '#0d0617';
      ctx.beginPath();
      ctx.roundRect(400, 120, 160, 270, [80, 80, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#4c266b';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Front Door Oak Panels & Iron Studs
      ctx.fillStyle = '#1e1124';
      ctx.fillRect(415, 170, 130, 220);
      ctx.strokeStyle = '#351c40';
      ctx.strokeRect(425, 185, 48, 85);
      ctx.strokeRect(487, 185, 48, 85);
      ctx.strokeRect(425, 290, 48, 85);
      ctx.strokeRect(487, 290, 48, 85);

      // Brass knocker & handle
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(445, 280, 4, 0, Math.PI * 2);
      ctx.fill();

      // Stone Porch Steps with rain puddles
      ctx.fillStyle = '#2a163d';
      ctx.fillRect(150, 430, 660, 110);
      ctx.fillStyle = '#190a29';
      ctx.fillRect(170, 470, 620, 70);

      // Weathered Porch Floorboards lines
      ctx.strokeStyle = 'rgba(74, 38, 107, 0.4)';
      ctx.lineWidth = 1.5;
      for (let px = 170; px <= 790; px += 45) {
        ctx.beginPath();
        ctx.moveTo(px, 430);
        ctx.lineTo(px, 540);
        ctx.stroke();
      }

      // Porch Doormat
      ctx.fillStyle = state.porchKeyFound ? '#3d2516' : '#2d3319';
      ctx.fillRect(435, 485, 90, 45);
      ctx.strokeStyle = '#5a3d24';
      ctx.lineWidth = 2;
      ctx.strokeRect(435, 485, 90, 45);

      // Porch Lanterns (Left and Right of Door)
      const drawPorchLantern = (lx, ly) => {
        const lf = Math.sin(time * 0.01 + lx) * 3;
        const lGlow = ctx.createRadialGradient(lx, ly, 4, lx, ly, 50);
        lGlow.addColorStop(0, 'rgba(255, 170, 50, 0.55)');
        lGlow.addColorStop(1, 'rgba(255, 170, 50, 0)');
        ctx.fillStyle = lGlow;
        ctx.fillRect(lx - 50, ly - 50, 100, 100);

        ctx.fillStyle = '#ffaa32';
        ctx.beginPath();
        ctx.arc(lx, ly + lf * 0.5, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#372045';
        ctx.lineWidth = 3;
        ctx.strokeRect(lx - 8, ly - 14, 16, 26);
      };
      drawPorchLantern(360, 240);
      drawPorchLantern(600, 240);

      // Angled Rain Streaks
      ctx.strokeStyle = 'rgba(160, 190, 230, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      state.rainStreaks.forEach(r => {
        r.y += r.speed;
        r.x -= r.speed * 0.35;
        if (r.y > VH + 20) {
          r.y = -20;
          r.x = Math.random() * (VW + 300);
        }
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.length * 0.35, r.y + r.length);
      });
      ctx.stroke();

      // Autumn Leaves Tumbling in Wind
      state.porchLeaves.forEach(leaf => {
        leaf.x += leaf.vx;
        leaf.y += leaf.vy + Math.sin(time * 0.003 + leaf.x) * 0.5;
        leaf.rot += leaf.rotSpeed;
        if (leaf.x < -30 || leaf.y > VH + 30) {
          leaf.x = VW + 20;
          leaf.y = Math.random() * (VH - 100);
        }
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.rot);
        ctx.fillStyle = leaf.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

    // ==========================================
    // ROOM 2: FOYER (Grand Staircase & Clock)
    // ==========================================
    } else if (rm === 'foyer') {
      ctx.fillStyle = '#12081f';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Victorian damask wall stripes
      for (let x = 0; x < VW; x += 50) {
        ctx.fillStyle = (x / 50) % 2 === 0 ? '#180a29' : '#12071f';
        ctx.fillRect(x, 0, 50, 320);
      }

      // Checkerboard marble floor with perspective
      for (let y = 320; y < VH; y += 35) {
        for (let x = 0; x < VW; x += 60) {
          ctx.fillStyle = (Math.floor(x / 60) + Math.floor(y / 35)) % 2 === 0 ? '#1f0d36' : '#0b0414';
          ctx.fillRect(x, y, 60, 35);
        }
      }

      // Grand Staircase
      ctx.fillStyle = '#2d1347';
      ctx.beginPath();
      ctx.moveTo(380, 120);
      ctx.lineTo(580, 120);
      ctx.lineTo(660, 320);
      ctx.lineTo(300, 320);
      ctx.closePath();
      ctx.fill();

      // Crimson Carpet Runner
      ctx.fillStyle = '#7a1c2f';
      ctx.beginPath();
      ctx.moveTo(440, 120);
      ctx.lineTo(520, 120);
      ctx.lineTo(560, 320);
      ctx.lineTo(400, 320);
      ctx.closePath();
      ctx.fill();

      // Stair Bannisters & Balusters
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(380, 110);
      ctx.lineTo(300, 310);
      ctx.moveTo(580, 110);
      ctx.lineTo(660, 310);
      ctx.stroke();

      // Grandfather Clock
      const clockX = 325, clockY = 240;
      ctx.fillStyle = '#2e150a';
      ctx.fillRect(clockX - 25, clockY - 110, 50, 220);
      ctx.strokeStyle = '#4a2614';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(clockX - 25, clockY - 110, 50, 220);

      // Dial Face
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(clockX, clockY - 75, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e1124';
      ctx.stroke();

      // Minute & Hour hands
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(clockX, clockY - 75);
      ctx.lineTo(clockX + 8, clockY - 78);
      ctx.moveTo(clockX, clockY - 75);
      ctx.lineTo(clockX - 5, clockY - 84);
      ctx.stroke();

      // Swinging Brass Pendulum
      ctx.fillStyle = '#110804';
      ctx.fillRect(clockX - 16, clockY - 40, 32, 95);
      ctx.strokeStyle = '#4a2614';
      ctx.strokeRect(clockX - 16, clockY - 40, 32, 95);

      const pendAngle = Math.sin(time * 0.003) * 0.22;
      ctx.save();
      ctx.translate(clockX, clockY - 35);
      ctx.rotate(pendAngle);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 70);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 70, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Swaying Crystal Chandelier
      const chanSway = Math.sin(time * 0.0015) * 6;
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(480, 0);
      ctx.lineTo(480 + chanSway, 70);
      ctx.stroke();

      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(480 + chanSway, 72, 28, 0, Math.PI);
      ctx.fill();

      for (let ci = -2; ci <= 2; ci++) {
        const cx = 480 + chanSway + ci * 14;
        const cy = 60;
        const cGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 25);
        cGlow.addColorStop(0, 'rgba(255, 180, 50, 0.45)');
        cGlow.addColorStop(1, 'rgba(255, 180, 50, 0)');
        ctx.fillStyle = cGlow;
        ctx.fillRect(cx - 25, cy - 25, 50, 50);

        const cf = Math.sin(time * 0.01 + ci * 2) * 2;
        ctx.fillStyle = '#ffaa32';
        ctx.beginPath();
        ctx.arc(cx, cy + cf * 0.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

    // ==========================================
    // ROOM 3: PARLOR (Roaring Fireplace & Vinyl)
    // ==========================================
    } else if (rm === 'parlor') {
      ctx.fillStyle = '#1f0c18';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Victorian striped wallpaper
      ctx.fillStyle = '#160812';
      for (let x = 0; x < VW; x += 40) {
        ctx.fillRect(x, 0, 20, 340);
      }

      // Parquet floor
      ctx.fillStyle = '#22110c';
      ctx.fillRect(0, 340, VW, VH - 340);

      // Fireplace Mantle & Hearth
      const fpx = 480, fpy = 270;
      ctx.fillStyle = '#1c171e';
      ctx.fillRect(fpx - 90, fpy - 90, 180, 170);
      ctx.strokeStyle = '#382e3c';
      ctx.lineWidth = 3;
      ctx.strokeRect(fpx - 90, fpy - 90, 180, 170);

      // Hearth Cavity
      ctx.fillStyle = '#0a080c';
      ctx.fillRect(fpx - 60, fpy - 30, 120, 110);

      // Ambient Fire Glow
      const fireGlow = ctx.createRadialGradient(fpx, fpy + 45, 10, fpx, fpy + 45, 130);
      fireGlow.addColorStop(0, 'rgba(255, 120, 20, 0.55)');
      fireGlow.addColorStop(0.6, 'rgba(255, 60, 0, 0.2)');
      fireGlow.addColorStop(1, 'rgba(255, 40, 0, 0)');
      ctx.fillStyle = fireGlow;
      ctx.fillRect(fpx - 140, fpy - 50, 280, 220);

      // Burning Wood Logs
      ctx.fillStyle = '#3a1e12';
      ctx.fillRect(fpx - 45, fpy + 62, 90, 14);
      ctx.fillStyle = '#5c2c15';
      ctx.fillRect(fpx - 35, fpy + 54, 70, 10);

      // Multi-layer Animated Flame Tongues
      for (let f = 0; f < 8; f++) {
        const fx = fpx - 36 + f * 10;
        const fh = 26 + Math.sin(time * 0.015 + f * 1.6) * 14 + Math.cos(time * 0.025 + f) * 8;
        const grad = ctx.createLinearGradient(fx, fpy + 65, fx, fpy + 65 - fh);
        grad.addColorStop(0, '#ff3300');
        grad.addColorStop(0.5, '#ff9900');
        grad.addColorStop(1, '#ffee55');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(fx - 7, fpy + 65);
        ctx.quadraticCurveTo(fx + Math.sin(time * 0.02 + f) * 5, fpy + 65 - fh * 0.6, fx, fpy + 65 - fh);
        ctx.quadraticCurveTo(fx + 7, fpy + 65 - fh * 0.5, fx + 7, fpy + 65);
        ctx.closePath();
        ctx.fill();
      }

      // Fireplace Rising Sparks
      if (Math.random() < 0.35) {
        state.fireplaceSparks.push({
          x: fpx + (Math.random() - 0.5) * 50,
          y: fpy + 50,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -1.5 - Math.random() * 2.2,
          size: 1.2 + Math.random() * 2,
          life: 0,
          maxLife: 35 + Math.random() * 20
        });
      }

      ctx.fillStyle = '#ffd700';
      for (let i = state.fireplaceSparks.length - 1; i >= 0; i--) {
        const sp = state.fireplaceSparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life++;
        if (sp.life > sp.maxLife) {
          state.fireplaceSparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 1 - (sp.life / sp.maxLife);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Cursed Portrait with Shifting Eyes above Fireplace
      ctx.fillStyle = '#e5a93b';
      ctx.strokeRect(430, 80, 100, 100);
      ctx.fillStyle = '#0f0814';
      ctx.fillRect(432, 82, 96, 96);

      const eyeDx = Math.sin(time * 0.003) * 6;
      const eyeDy = Math.cos(time * 0.002) * 4;
      ctx.fillStyle = '#ff2a55';
      ctx.beginPath();
      ctx.arc(465 + eyeDx, 122 + eyeDy, 3, 0, Math.PI * 2);
      ctx.arc(495 + eyeDx, 122 + eyeDy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Vintage Gramophone
      const gx = 740, gy = 330;
      ctx.fillStyle = '#422115';
      ctx.fillRect(gx - 35, gy - 25, 70, 45);

      const spinAngle = (time * 0.004) % (Math.PI * 2);
      ctx.save();
      ctx.translate(gx, gy - 26);
      ctx.scale(1, 0.45);
      ctx.rotate(spinAngle);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.stroke();
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.moveTo(gx - 10, gy - 26);
      ctx.lineTo(gx - 45, gy - 75);
      ctx.lineTo(gx - 75, gy - 55);
      ctx.closePath();
      ctx.fill();

      if (state.gramophonePlayed) {
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
        ctx.lineWidth = 1.5;
        const rWave = (time * 0.04) % 35;
        ctx.beginPath();
        ctx.arc(gx - 60, gy - 65, rWave, -Math.PI * 0.7, -Math.PI * 0.2);
        ctx.stroke();
      }

    // ==========================================
    // ROOM 4: LIBRARY (Grimoires & Stained Glass)
    // ==========================================
    } else if (rm === 'library') {
      ctx.fillStyle = '#130d1e';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      ctx.fillStyle = '#1c100a';
      ctx.fillRect(0, 360, VW, VH - 360);

      // Bookshelves
      ctx.fillStyle = '#261633';
      ctx.fillRect(70, 50, 840, 310);
      for (let y = 110; y <= 350; y += 60) {
        ctx.fillStyle = '#3a214d';
        ctx.fillRect(70, y, 840, 8);
        for (let bx = 80; bx < 890; bx += 22) {
          ctx.fillStyle = ['#5c1a29', '#194254', '#2b4d24', '#664319', '#4a154b'][Math.floor(bx / 18) % 5];
          ctx.fillRect(bx, y - 36, 14, 36);
        }
      }

      // Arched Victorian Window
      const wx = 760, wy = 70;
      ctx.fillStyle = '#06030a';
      ctx.beginPath();
      ctx.roundRect(wx, wy, 110, 170, [55, 55, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = '#4a2b66';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Moonbeam through window
      const libBeam = ctx.createLinearGradient(wx + 55, wy, 450, 480);
      libBeam.addColorStop(0, 'rgba(180, 220, 255, 0.22)');
      libBeam.addColorStop(1, 'rgba(180, 220, 255, 0)');
      ctx.fillStyle = libBeam;
      ctx.beginPath();
      ctx.moveTo(wx, wy + 40);
      ctx.lineTo(wx + 110, wy + 40);
      ctx.lineTo(580, 480);
      ctx.lineTo(380, 480);
      ctx.closePath();
      ctx.fill();

      // Rain droplets on window glass
      ctx.strokeStyle = 'rgba(200, 220, 255, 0.4)';
      ctx.lineWidth = 1;
      for (let d = 0; d < 7; d++) {
        const dy = wy + 40 + ((time * 0.05 + d * 30) % 110);
        ctx.beginPath();
        ctx.moveTo(wx + 20 + d * 12, dy);
        ctx.lineTo(wx + 20 + d * 12, dy + 6);
        ctx.stroke();
      }

      // Reading Desk
      ctx.fillStyle = '#211208';
      ctx.fillRect(440, 310, 220, 110);
      ctx.fillStyle = '#331a0b';
      ctx.fillRect(430, 300, 240, 14);

      // Desk Green Banker's Lamp
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.roundRect(520, 275, 45, 14, 5);
      ctx.fill();
      const lampGlow = ctx.createRadialGradient(542, 285, 4, 542, 330, 65);
      lampGlow.addColorStop(0, 'rgba(187, 247, 208, 0.45)');
      lampGlow.addColorStop(1, 'rgba(187, 247, 208, 0)');
      ctx.fillStyle = lampGlow;
      ctx.fillRect(480, 280, 125, 90);

    // ==========================================
    // ROOM 5: KITCHEN & PANTRY (Rusted Range & Locker)
    // ==========================================
    } else if (rm === 'kitchen') {
      ctx.fillStyle = '#140c11';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Damp soot-stained subway tiles backsplash
      ctx.strokeStyle = 'rgba(64, 40, 52, 0.45)';
      ctx.lineWidth = 1;
      for (let y = 60; y < 350; y += 22) {
        for (let x = 0; x < VW; x += 44) {
          const offsetX = (Math.floor(y / 22) % 2) * 22;
          ctx.strokeRect(x + offsetX, y, 44, 22);
        }
      }

      // Broken terracotta tile floor
      ctx.fillStyle = '#1f0e13';
      ctx.fillRect(0, 350, VW, VH - 350);
      ctx.strokeStyle = '#2d151c';
      for (let tx = 0; tx < VW; tx += 60) {
        ctx.beginPath();
        ctx.moveTo(tx, 350);
        ctx.lineTo(tx, VH);
        ctx.stroke();
      }

      // Rusted Cast-Iron Cooking Stove
      ctx.fillStyle = '#22191f';
      ctx.fillRect(460, 200, 160, 150);
      ctx.strokeStyle = '#382a33';
      ctx.lineWidth = 3;
      ctx.strokeRect(460, 200, 160, 150);

      // Smoldering embers in stove door
      const stvGlow = ctx.createRadialGradient(540, 280, 5, 540, 280, 50);
      stvGlow.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
      stvGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = stvGlow;
      ctx.fillRect(500, 240, 80, 80);

      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(525, 265, 30, 30);

      // Hanging copper pans & rusted meat cleaver
      const pansX = [220, 280, 340];
      pansX.forEach((px, idx) => {
        const panSway = Math.sin(time * 0.002 + idx) * 3;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 70);
        ctx.lineTo(px + panSway, 130);
        ctx.stroke();

        ctx.fillStyle = idx === 1 ? '#451a03' : '#92400e';
        ctx.beginPath();
        ctx.arc(px + panSway, 142, 14, 0, Math.PI * 2);
        ctx.fill();
      });

      // Wooden Prep Counter & Drawers
      ctx.fillStyle = '#2c1810';
      ctx.fillRect(140, 280, 240, 130);
      ctx.strokeStyle = '#451a03';
      ctx.strokeRect(140, 280, 240, 130);
      // Counter drawer handles
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(200, 320, 35, 6);
      ctx.fillRect(290, 320, 35, 6);

      // Pantry Cupboard with brass wire-mesh
      ctx.fillStyle = '#24141d';
      ctx.fillRect(470, 90, 140, 105);
      ctx.strokeStyle = state.saltFound ? '#4ade80' : '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(470, 90, 140, 105);
      // Wire mesh crisscross
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
      ctx.lineWidth = 1;
      for (let mx = 480; mx < 600; mx += 15) {
        ctx.beginPath();
        ctx.moveTo(mx, 95);
        ctx.lineTo(mx + 20, 190);
        ctx.stroke();
      }

    // ==========================================
    // ROOM 6: BEDROOM (Four-Poster & Specter)
    // ==========================================
    } else if (rm === 'bedroom') {
      ctx.fillStyle = '#1a0b1c';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      ctx.fillStyle = '#180a14';
      ctx.fillRect(0, 340, VW, VH - 340);

      // Four-poster Bed with velvet canopy
      ctx.fillStyle = '#2d1430';
      ctx.fillRect(430, 210, 240, 150);
      ctx.fillStyle = '#4a1532';
      ctx.fillRect(430, 140, 240, 70);
      ctx.fillStyle = '#3a1228';
      ctx.fillRect(440, 230, 220, 120);

      // Bedposts
      ctx.fillStyle = '#58245f';
      ctx.fillRect(430, 110, 14, 250);
      ctx.fillRect(656, 110, 14, 250);

      // Vanity Dresser & Oval Mirror
      ctx.fillStyle = '#261219';
      ctx.fillRect(170, 270, 150, 100);
      ctx.strokeStyle = '#e5a93b';
      ctx.lineWidth = 3;
      ctx.strokeRect(200, 160, 90, 110);

      // Mirror reflection with shifting ghostly apparition
      const mirrorGlow = ctx.createRadialGradient(245, 215, 5, 245, 215, 50);
      mirrorGlow.addColorStop(0, 'rgba(147, 197, 253, 0.35)');
      mirrorGlow.addColorStop(1, 'rgba(15, 8, 20, 0.95)');
      ctx.fillStyle = mirrorGlow;
      ctx.fillRect(202, 162, 86, 106);

      const ghostPulse = 0.2 + Math.sin(time * 0.0025) * 0.18;
      ctx.fillStyle = `rgba(216, 180, 254, ${ghostPulse})`;
      ctx.beginPath();
      ctx.arc(245, 200, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(230, 212);
      ctx.lineTo(260, 212);
      ctx.lineTo(255, 245);
      ctx.lineTo(235, 245);
      ctx.closePath();
      ctx.fill();

      // Swirling cold floor mist
      ctx.fillStyle = 'rgba(192, 132, 252, 0.08)';
      for (let mx = 0; mx < VW; mx += 100) {
        const my = 420 + Math.sin(time * 0.002 + mx * 0.02) * 20;
        ctx.beginPath();
        ctx.ellipse(mx, my, 80, 25, 0, 0, Math.PI * 2);
        ctx.fill();
      }

    // ==========================================
    // ROOM 7: BASEMENT / CRYPT (Water Ripples & Altar)
    // ==========================================
    } else if (rm === 'basement') {
      ctx.fillStyle = '#060408';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Rough stone masonry flagstones
      ctx.strokeStyle = 'rgba(78, 41, 116, 0.2)';
      ctx.lineWidth = 2;
      for (let y = 50; y < VH; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VW, y);
        ctx.stroke();
      }

      // Overhead rusty dripping pipe
      ctx.fillStyle = '#261a15';
      ctx.fillRect(0, 45, VW, 12);
      ctx.strokeStyle = '#3d2b24';
      ctx.strokeRect(0, 45, VW, 12);

      // Water Drips from Pipe into Stone Floor Puddle
      state.dripTimer = (state.dripTimer || 0) + 1;
      if (state.dripTimer > 75) {
        state.dripTimer = 0;
        state.waterDrops.push({ x: 260 + (Math.random() - 0.5) * 15, y: 57, vy: 4.5 });
      }

      // Falling water drops
      ctx.fillStyle = '#67e8f9';
      for (let i = state.waterDrops.length - 1; i >= 0; i--) {
        const d = state.waterDrops[i];
        d.y += d.vy;
        d.vy += 0.25;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 2, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.y > 480) {
          state.waterRipples.push({ x: d.x, y: 480, r: 2, maxR: 28, alpha: 0.8 });
          state.waterDrops.splice(i, 1);
        }
      }

      // Floor puddle with expanding ripples
      const pudGlow = ctx.createRadialGradient(260, 480, 5, 260, 480, 50);
      pudGlow.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
      pudGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = pudGlow;
      ctx.fillRect(200, 440, 120, 80);

      for (let i = state.waterRipples.length - 1; i >= 0; i--) {
        const rp = state.waterRipples[i];
        rp.r += 0.55;
        rp.alpha -= 0.016;
        if (rp.alpha <= 0) {
          state.waterRipples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(103, 232, 249, ${rp.alpha})`;
        ctx.lineWidth = 1.4;
        ctx.save();
        ctx.translate(rp.x, rp.y);
        ctx.scale(1, 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, rp.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Occult Pentagram Ritual Altar
      const altX = 500, altY = 380;
      const altColor = state.altarCleansed ? '#38ef7d' : '#ef4444';
      const altGlow = state.altarCleansed ? 'rgba(56, 239, 125, ' : 'rgba(239, 68, 68, ';
      const runePulse = 0.55 + Math.sin(time * 0.004) * 0.25;

      const aGrad = ctx.createRadialGradient(altX, altY, 20, altX, altY, 110);
      aGrad.addColorStop(0, altGlow + (0.35 * runePulse) + ')');
      aGrad.addColorStop(1, altGlow + '0)');
      ctx.fillStyle = aGrad;
      ctx.fillRect(altX - 120, altY - 80, 240, 160);

      ctx.save();
      ctx.translate(altX, altY);
      ctx.scale(1, 0.45);
      ctx.strokeStyle = altColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      for (let p = 0; p < 5; p++) {
        const a1 = (p * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(a1) * 75;
        const py = Math.sin(a1) * 75;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Hanging Inspection Bulb
      const bulbSwing = Math.sin(time * 0.0022) * 32;
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(500, 0);
      ctx.lineTo(500 + bulbSwing, 120);
      ctx.stroke();

      ctx.fillStyle = state.breakerEngaged ? '#ffeeaa' : '#554422';
      ctx.beginPath();
      ctx.arc(500 + bulbSwing, 125, 9, 0, Math.PI * 2);
      ctx.fill();

      if (state.breakerEngaged) {
        const bGlow = ctx.createRadialGradient(500 + bulbSwing, 125, 5, 500 + bulbSwing, 125, 80);
        bGlow.addColorStop(0, 'rgba(255, 238, 170, 0.4)');
        bGlow.addColorStop(1, 'rgba(255, 238, 170, 0)');
        ctx.fillStyle = bGlow;
        ctx.fillRect(500 + bulbSwing - 80, 45, 160, 160);
      }
    } else if (rm === 'wine_cellar') {
      // Subterranean Romanesque Arch & Cask Cellar
      ctx.fillStyle = '#08060a';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Curved stone arch ribbing
      ctx.strokeStyle = '#2d2438';
      ctx.lineWidth = 6;
      for (let x = 120; x < VW; x += 220) {
        ctx.beginPath();
        ctx.arc(x, 180, 160, Math.PI, 0);
        ctx.stroke();
      }

      // Massive Oak Wine Casks
      const caskGlow = ctx.createLinearGradient(160, 180, 360, 380);
      caskGlow.addColorStop(0, '#2d1a10');
      caskGlow.addColorStop(0.5, '#4a2c1b');
      caskGlow.addColorStop(1, '#1e110b');
      ctx.fillStyle = caskGlow;
      ctx.beginPath();
      ctx.ellipse(260, 280, 110, 85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#110a06';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Cask Iron Bands
      ctx.strokeStyle = '#594d46';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(260, 280, 85, 83, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(260, 280, 55, 80, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Ambient Lantern Amber Glow
      const ambGlow = ctx.createRadialGradient(VW * 0.5, VH * 0.6, 20, VW * 0.5, VH * 0.6, 300);
      ambGlow.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
      ambGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambGlow;
      ctx.fillRect(0, 0, VW, VH);

    } else if (rm === 'ossuary') {
      // Ossuary Bone Vault
      ctx.fillStyle = '#0a0808';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Stacked bone shelf niches
      ctx.fillStyle = '#1c1719';
      for (let row = 80; row < VH - 100; row += 90) {
        ctx.fillRect(100, row, VW - 200, 24);
        for (let col = 120; col < VW - 120; col += 65) {
          ctx.fillStyle = '#9e9689';
          ctx.beginPath();
          ctx.arc(col, row - 12, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#110e10';
          ctx.beginPath();
          ctx.arc(col - 4, row - 12, 3, 0, Math.PI * 2);
          ctx.arc(col + 4, row - 12, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1c1719';
        }
      }

    } else if (rm === 'ancestral_crypt') {
      // Ancestral Grand Crypt with Concentric Rotating Seal
      ctx.fillStyle = '#050308';
      ctx.fillRect(-20, -20, VW + 40, VH + 40);

      // Glowing seal aura on back stone wall
      const sealAura = ctx.createRadialGradient(VW * 0.5, VH * 0.48, 30, VW * 0.5, VH * 0.48, 220);
      sealAura.addColorStop(0, state.sealUnlocked ? 'rgba(56, 239, 125, 0.25)' : 'rgba(245, 158, 11, 0.2)');
      sealAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sealAura;
      ctx.fillRect(0, 0, VW, VH);

      // Outer Carved Arch
      ctx.strokeStyle = state.sealUnlocked ? '#38ef7d' : '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(VW * 0.5, VH * 0.48, 130, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(VW * 0.5, VH * 0.48, 90, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(VW * 0.5, VH * 0.48, 50, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // ==========================================
    // DYNAMIC FLASHLIGHT, DUST MOTES & ATMOSPHERE
    // ==========================================
    const flX = state.mousePos.x;
    const flY = state.mousePos.y;

    if (state.flashlightOn && state.battery > 0 && !state.isHiding) {
      const isLowBattery = state.battery < 30;
      const isFlickering = (isLowBattery && Math.random() < 0.12) || (state.threatLevel === 'danger' && Math.random() < 0.2);
      const beamAlpha = isFlickering ? 0.02 : 0.08;

      const radius = Math.min(w, h) * 0.42 + 40;
      const flGrad = ctx.createRadialGradient(flX, flY, 25, flX, flY, radius);
      flGrad.addColorStop(0, `rgba(255, 240, 190, ${beamAlpha})`);
      flGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.68)');
      flGrad.addColorStop(1, 'rgba(0, 0, 0, 0.97)');
      ctx.fillStyle = flGrad;
      ctx.fillRect(0, 0, w, h);

      // Render floating dust motes caught in beam cone
      state.dustMotes.forEach(m => {
        m.x += m.vx;
        m.y += m.vy;
        m.wobble += 0.02;
        m.x += Math.sin(m.wobble) * 0.2;
        if (m.y < 0) {
          m.y = h;
          m.x = Math.random() * w;
        }
        if (m.x < 0) m.x = w;
        if (m.x > w) m.x = 0;

        const dist = Math.hypot(m.x - flX, m.y - flY);
        if (dist < radius * 0.85) {
          const intensity = (1 - dist / (radius * 0.85)) * m.alpha;
          ctx.fillStyle = `rgba(255, 245, 210, ${intensity})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    } else {
      // Total darkness or hiding inside wardrobe
      const darkGrad = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, Math.min(w, h) * 0.52);
      darkGrad.addColorStop(0, 'rgba(0,0,0,0.88)');
      darkGrad.addColorStop(1, 'rgba(0,0,0,0.99)');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Low Sanity Heartbeat Blood Vignette
    if (state.sanity < 50) {
      const pulseSpeed = state.threatLevel === 'danger' ? 0.012 : 0.006;
      const pulse = 0.5 + Math.sin(time * pulseSpeed) * 0.45;
      const bloodAlpha = ((50 - state.sanity) / 50) * 0.45 * pulse;
      const redVig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
      redVig.addColorStop(0, 'rgba(239, 68, 68, 0)');
      redVig.addColorStop(1, `rgba(185, 28, 28, ${bloodAlpha})`);
      ctx.fillStyle = redVig;
      ctx.fillRect(0, 0, w, h);
    }

    // Subtle Analog Psychological Horror Grain Noise Pass
    const grainCount = 35;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let g = 0; g < grainCount; g++) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Render Floating Text Notifications
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
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0, 0, 0, ${ft.alpha * 0.75})`;
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    requestAnimationFrame(renderRoom);
  }
  requestAnimationFrame(renderRoom);

  // --- Keyboard Shortcuts for Flashlight [F] and Hide [H] ---
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'f') {
      btnFlashlight.click();
    } else if (k === 'h') {
      btnHide.click();
    }
  });

  // Mobile touch gesture handler for active room navigation sync
  window.addEventListener('resize', () => {
    const activeTab = document.querySelector('.room-tab.active');
    if (activeTab && activeTab.scrollIntoView) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, { passive: true });

  // --- Real-Time Update Tick (1000ms) ---
  setInterval(() => {
    if (state.gameEnded) return;

    // Battery Decay
    if (state.flashlightOn && state.battery > 0 && !state.isHiding) {
      state.battery = Math.max(0, state.battery - 0.4);
      batteryBar.style.width = `${state.battery}%`;
      if (state.battery <= 0) {
        state.flashlightOn = false;
        lightLabel.textContent = 'Light: DEAD';
        setHint('Your flashlight battery died! Darkness is encroaching!');
      }
    }

    // Catacomb Lantern Fuel Decay
    if (state.hasLantern && ['wine_cellar', 'ossuary', 'ancestral_crypt'].includes(state.currentRoom)) {
      state.lanternFuel = Math.max(0, state.lanternFuel - 0.35);
      if (lanternBar) lanternBar.style.width = `${state.lanternFuel}%`;
      if (state.lanternFuel <= 0) {
        state.sanity = Math.max(0, state.sanity - 2.5);
        sanityBar.style.width = `${state.sanity}%`;
        if (state.sanity <= 0) triggerEnding('bad');
      }
    }

    // Lingering in darkness drains sanity
    if (!state.flashlightOn && !state.isHiding) {
      state.sanity = Math.max(0, state.sanity - 1.5);
      sanityBar.style.width = `${state.sanity}%`;
      if (state.sanity <= 0) triggerEnding('bad');
    }

    // Paranormal Threat Timer
    state.threatTimer++;
    if (state.threatTimer > 18 && state.threatLevel === 'quiet') {
      state.threatTimer = 0;
      if (Math.random() < 0.45 && state.currentRoom !== 'porch') {
        triggerPanic();
      } else if (Math.random() < 0.3) {
        triggerLightning();
      }
    }

    // Danger Countdown
    if (state.threatLevel === 'danger') {
      sound.playHeartbeat();
      state.dangerCountdown--;
      if (state.dangerCountdown <= 0) {
        resolvePanic(state.isHiding);
      }
    }
  }, 1000);

  // Initialize UI & Onboarding
  updateInventoryUI();
  renderHotspots();
  updateCaseTracker();
})();
