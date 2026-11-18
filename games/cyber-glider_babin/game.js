// Cyber Glider - Thermal Updraft Aerodynamic Flight Simulator

class GliderAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
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

  playWindWhoosh(speed = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 + speed * 10, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this.trackNode(osc);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playThermalLift() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(680, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this.trackNode(osc);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playRingChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this.trackNode(osc);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playCrash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    this.trackNode(osc);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
}

class CyberGliderGame {
  constructor() {
    this.canvas = document.getElementById('flightCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new GliderAudio();

    // Normalized virtual physics coordinates (1000x1000 virtual units) decoupled from viewport pixel dimensions
    this.virtualWidth = 1000;
    this.virtualHeight = 1000;

    this.handleResize();

    // Aerodynamic Glider Model
    this.glider = {
      x: 180,
      y: 450,
      pitch: 0, // Radians (-0.6 up, +0.6 down)
      airspeed: 12, // Forward speed (trades with altitude)
      vy: 0,
      stalled: false,
      alive: true
    };

    this.distance = 0;
    this.worldScroll = 0;

    // Procedural Canyon Elements
    this.thermals = []; // Rising warm air updrafts
    this.rings = [];    // Boost rings
    this.buildings = []; // Skyscraper silhouettes

    this.initDOM();
    this.initWorld();
    this.setupEvents();

    this.animate();
  }

  handleResize() {
    if (this.canvas) {
      this.canvas.width = this.virtualWidth;
      this.canvas.height = this.virtualHeight;
    }
  }

  initDOM() {
    this.distVal = document.getElementById('distVal');
    this.speedVal = document.getElementById('speedVal');
    this.altVal = document.getElementById('altVal');
    this.toastMessage = document.getElementById('toastMessage');

    this.pitchUpBtn = document.getElementById('pitchUpBtn');
    this.diveBtn = document.getElementById('diveBtn');
    this.restartFlightBtn = document.getElementById('restartFlightBtn');

    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.rulesBtn = document.getElementById('rulesBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  initWorld() {
    this.glider = {
      x: 180,
      y: 450,
      pitch: 0,
      airspeed: 12,
      vy: 0,
      stalled: false,
      alive: true
    };
    this.distance = 0;
    this.worldScroll = 0;
    this.thermals = [];
    this.rings = [];
    this.buildings = [];

    // Pre-populate buildings & obstacles in 1000x1000 virtual coordinates
    for (let i = 0; i < 15; i++) {
      this.buildings.push({
        x: 450 + i * 260,
        w: 120 + Math.random() * 60,
        h: 180 + Math.random() * 360
      });
    }

    // Add initial thermals
    for (let i = 0; i < 6; i++) {
      this.thermals.push({
        x: 600 + i * 550,
        w: 110,
        h: this.virtualHeight,
        lift: 3.5 + Math.random() * 1.0
      });
    }

    // Add rings
    for (let i = 0; i < 8; i++) {
      this.rings.push({
        x: 520 + i * 380,
        y: 180 + Math.random() * 450,
        r: 30,
        collected: false
      });
    }
  }

  setupEvents() {
    // Pitch Controls with continuous hold & touch support
    const pitchUp = () => { if (this.glider.alive) this.glider.pitch = Math.max(-0.55, this.glider.pitch - 0.08); };
    const dive = () => { if (this.glider.alive) this.glider.pitch = Math.min(0.55, this.glider.pitch + 0.08); };

    let pitchInterval = null;
    let diveInterval = null;

    const startPitchUp = () => {
      pitchUp();
      clearInterval(pitchInterval);
      pitchInterval = setInterval(pitchUp, 100);
    };
    const stopPitchUp = () => clearInterval(pitchInterval);

    const startDive = () => {
      dive();
      clearInterval(diveInterval);
      diveInterval = setInterval(dive, 100);
    };
    const stopDive = () => clearInterval(diveInterval);

    this.pitchUpBtn.addEventListener('mousedown', startPitchUp);
    this.pitchUpBtn.addEventListener('mouseup', stopPitchUp);
    this.pitchUpBtn.addEventListener('mouseleave', stopPitchUp);
    this.pitchUpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPitchUp(); }, { passive: false });
    this.pitchUpBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopPitchUp(); }, { passive: false });
    this.pitchUpBtn.addEventListener('touchcancel', stopPitchUp);

    this.diveBtn.addEventListener('mousedown', startDive);
    this.diveBtn.addEventListener('mouseup', stopDive);
    this.diveBtn.addEventListener('mouseleave', stopDive);
    this.diveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startDive(); }, { passive: false });
    this.diveBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopDive(); }, { passive: false });
    this.diveBtn.addEventListener('touchcancel', stopDive);

    // Direct canvas tap/touch steering on mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      if (touch) {
        const touchY = touch.clientY - rect.top;
        if (touchY < rect.height / 2) {
          startPitchUp();
        } else {
          startDive();
        }
      }
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopPitchUp();
      stopDive();
    }, { passive: false });
    this.canvas.addEventListener('touchcancel', () => {
      stopPitchUp();
      stopDive();
    });

    this.restartFlightBtn.addEventListener('click', () => {
      stopPitchUp();
      stopDive();
      this.audio.stopAll();
      this.initWorld();
      this.showToast('NEW FLIGHT LAUNCHED');
    });

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        pitchUp();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        dive();
      }
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      if (this.audio.muted) {
        this.audio.stopAll();
      }
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.rulesBtn.addEventListener('click', () => this.rulesModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));

    // Debounced viewport resize & screen orientation listeners (AV_RESIZE ArcadeVerse responsive handling)
    let resizeTimer = null;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.handleResize(), 80);
    };
    window.addEventListener('resize', debouncedResize, { passive: true });
    window.addEventListener('orientationchange', debouncedResize, { passive: true });
  }

  showToast(text) {
    this.toastMessage.textContent = text;
    this.toastMessage.classList.remove('hidden');
    setTimeout(() => {
      this.toastMessage.classList.add('hidden');
    }, 1600);
  }

  animate() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  update() {
    if (!this.glider.alive) return;

    // Aerodynamics Calculation:
    // Pitch Down (positive): trades altitude for speed (gain airspeed, lose altitude)
    // Pitch Up (negative): trades speed for lift (lose airspeed, gain altitude)
    if (this.glider.pitch > 0) {
      // Diving
      this.glider.airspeed += this.glider.pitch * 0.22;
      this.glider.vy += this.glider.pitch * 0.85;
    } else {
      // Climbing
      this.glider.airspeed += this.glider.pitch * 0.18; // Airspeed slows during climb
      this.glider.vy += this.glider.pitch * 0.70;
    }

    // Natural drag and gravity
    this.glider.airspeed *= 0.995;
    this.glider.vy += 0.28; // Constant downward gravity in virtual space

    // Stall Check
    if (this.glider.airspeed < 4.8) {
      this.glider.stalled = true;
      this.glider.vy += 0.85; // Plummet
      this.glider.pitch = 0.45; // Auto nose dive
    } else {
      this.glider.stalled = false;
    }

    // Forward translation (World scrolls left)
    const scrollSpeed = Math.max(3, this.glider.airspeed * 1.1);
    this.worldScroll += scrollSpeed;
    this.distance += Math.floor(scrollSpeed * 0.6);

    // Apply vertical flight & air dampening
    this.glider.y += this.glider.vy;
    this.glider.vy *= 0.94;

    // Sound whoosh
    if (Math.random() < 0.05) {
      this.audio.playWindWhoosh(this.glider.airspeed);
    }

    // Thermal updraft collisions & force calculation
    this.thermals.forEach(th => {
      const screenX = th.x - this.worldScroll;
      if (this.glider.x >= screenX && this.glider.x <= screenX + th.w) {
        // Safe normalized altitude & thermal height division (guaranteed positive, no negative or zero division)
        const thermalHeight = Math.max(1, th.h || this.virtualHeight);
        const altitudeAboveGround = Math.max(0, this.virtualHeight - this.glider.y);
        const heightFraction = Math.max(0, Math.min(1, altitudeAboveGround / thermalHeight));

        // Updraft buoyancy force strictly clamped to positive values
        const baseLift = Math.max(0, th.lift || 3.5);
        const buoyancy = Math.max(0, baseLift * (0.6 + 0.4 * heightFraction));

        this.glider.vy -= buoyancy * 0.45;
        this.glider.airspeed += 0.08;
        this.audio.playThermalLift();
      }
    });

    // Energy rings pickup
    this.rings.forEach(rg => {
      if (!rg.collected) {
        const screenX = rg.x - this.worldScroll;
        const dist = Math.hypot(this.glider.x - screenX, this.glider.y - rg.y);
        if (dist < rg.r + 26) {
          rg.collected = true;
          this.glider.airspeed += 3.5;
          this.audio.playRingChime();
          this.showToast('ENERGY BOOST! +30 KM/H');
        }
      }
    });

    // Skyscraper Collisions & Ground Bounds
    if (this.glider.y > this.virtualHeight - 35) {
      this.crashGlider('GROUND IMPACT!');
    } else if (this.glider.y < 30) {
      this.glider.y = 30;
      this.glider.vy = 1.5;
    }

    this.buildings.forEach(b => {
      const screenX = b.x - this.worldScroll;
      if (this.glider.x + 22 > screenX && this.glider.x - 22 < screenX + b.w) {
        if (this.glider.y + 12 > this.virtualHeight - b.h) {
          this.crashGlider('SKYSCRAPER COLLISION!');
        }
      }
    });

    // Recycle elements as world scrolls
    if (this.buildings[0] && this.buildings[0].x - this.worldScroll < -300) {
      const lastB = this.buildings[this.buildings.length - 1];
      const popped = this.buildings.shift();
      popped.x = lastB.x + 200 + Math.random() * 120;
      popped.h = 180 + Math.random() * 360;
      this.buildings.push(popped);
    }

    if (this.thermals[0] && this.thermals[0].x - this.worldScroll < -300) {
      const lastTh = this.thermals[this.thermals.length - 1];
      const popped = this.thermals.shift();
      popped.x = lastTh.x + 480 + Math.random() * 200;
      popped.h = this.virtualHeight;
      popped.lift = 3.5 + Math.random() * 1.0;
      this.thermals.push(popped);
    }

    if (this.rings[0] && this.rings[0].x - this.worldScroll < -200) {
      const lastRg = this.rings[this.rings.length - 1];
      const popped = this.rings.shift();
      popped.x = lastRg.x + 350 + Math.random() * 180;
      popped.y = 180 + Math.random() * 450;
      popped.collected = false;
      this.rings.push(popped);
    }

    this.updateHUD();
  }

  crashGlider(reason) {
    this.glider.alive = false;
    this.audio.stopAll();
    this.audio.playCrash();
    this.showToast(reason);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_SCORE',
        score: this.distance
      }, '*');
    }
  }

  updateHUD() {
    this.distVal.textContent = `${this.distance} m`;
    this.speedVal.textContent = `${Math.floor(this.glider.airspeed * 10)} km/h`;
    const alt = Math.max(0, Math.floor((this.virtualHeight - this.glider.y) * 0.5));
    this.altVal.textContent = `${alt} m`;
  }

  render() {
    const vw = this.virtualWidth;
    const vh = this.virtualHeight;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    this.ctx.save();
    // Decoupled virtual physics rendering: scale 1000x1000 coordinates to canvas pixel buffer
    this.ctx.scale(cw / vw, ch / vh);

    this.ctx.clearRect(0, 0, vw, vh);

    // Deep Cyberpunk Sky
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, vh);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.7, '#0f172a');
    skyGrad.addColorStop(1, '#1e1b4b');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, vw, vh);

    // Render Thermal Updraft Columns
    this.thermals.forEach(th => {
      const sx = th.x - this.worldScroll;
      if (sx > -150 && sx < vw + 150) {
        const tGrad = this.ctx.createLinearGradient(0, vh, 0, 0);
        tGrad.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
        tGrad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
        this.ctx.fillStyle = tGrad;
        this.ctx.fillRect(sx, 0, th.w, vh);

        // Upward chevron waves
        this.ctx.strokeStyle = '#c084fc';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        for (let y = vh - 60; y > 80; y -= 80) {
          this.ctx.moveTo(sx + 15, y);
          this.ctx.lineTo(sx + th.w / 2, y - 25);
          this.ctx.lineTo(sx + th.w - 15, y);
        }
        this.ctx.stroke();
      }
    });

    // Render Buildings
    this.buildings.forEach(b => {
      const sx = b.x - this.worldScroll;
      if (sx > -200 && sx < vw + 200) {
        this.ctx.fillStyle = '#0f172a';
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(sx, vh - b.h, b.w, b.h);
        this.ctx.strokeRect(sx, vh - b.h, b.w, b.h);

        // Skyscraper window grid
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        for (let winY = vh - b.h + 24; winY < vh - 20; winY += 32) {
          for (let winX = sx + 16; winX < sx + b.w - 20; winX += 26) {
            this.ctx.fillRect(winX, winY, 14, 14);
          }
        }
      }
    });

    // Render Energy Rings
    this.rings.forEach(rg => {
      if (!rg.collected) {
        const sx = rg.x - this.worldScroll;
        if (sx > -80 && sx < vw + 80) {
          this.ctx.save();
          this.ctx.strokeStyle = '#06b6d4';
          this.ctx.lineWidth = 5;
          this.ctx.shadowColor = '#06b6d4';
          this.ctx.shadowBlur = 18;
          this.ctx.beginPath();
          this.ctx.arc(sx, rg.y, rg.r, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.restore();
        }
      }
    });

    // Render Glider
    this.ctx.save();
    this.ctx.translate(this.glider.x, this.glider.y);
    this.ctx.rotate(this.glider.pitch);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#a855f7';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#a855f7';
    this.ctx.shadowBlur = 14;

    this.ctx.beginPath();
    this.ctx.moveTo(32, 0);       // Nose
    this.ctx.lineTo(-24, -18);   // Left wingtip
    this.ctx.lineTo(-14, 0);      // Center keel
    this.ctx.lineTo(-24, 18);    // Right wingtip
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();

    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new CyberGliderGame();
  window.addEventListener('message', (e) => {
    if (e.data && (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE')) {
      if (game && game.audio) game.audio.stopAll();
    }
  });
});
