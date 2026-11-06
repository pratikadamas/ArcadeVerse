// Cyber Glider - Thermal Updraft Aerodynamic Flight Simulator

class GliderAudio {
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
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
}

class CyberGliderGame {
  constructor() {
    this.canvas = document.getElementById('flightCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new GliderAudio();

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Aerodynamic Glider Model
    this.glider = {
      x: 120,
      y: 180,
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
      x: 120, y: 160,
      pitch: 0, airspeed: 12,
      vy: 0, stalled: false, alive: true
    };
    this.distance = 0;
    this.worldScroll = 0;
    this.thermals = [];
    this.rings = [];
    this.buildings = [];

    // Pre-populate buildings & obstacles
    for (let i = 0; i < 15; i++) {
      this.buildings.push({
        x: 300 + i * 160,
        w: 80 + Math.random() * 40,
        h: 80 + Math.random() * 160
      });
    }

    // Add initial thermals
    for (let i = 0; i < 6; i++) {
      this.thermals.push({
        x: 400 + i * 350,
        w: 60,
        lift: 3.2
      });
    }

    // Add rings
    for (let i = 0; i < 8; i++) {
      this.rings.push({
        x: 350 + i * 260,
        y: 100 + Math.random() * 180,
        r: 18,
        collected: false
      });
    }
  }

  setupEvents() {
    // Pitch Controls
    const pitchUp = () => { if (this.glider.alive) this.glider.pitch = Math.max(-0.55, this.glider.pitch - 0.08); };
    const dive = () => { if (this.glider.alive) this.glider.pitch = Math.min(0.55, this.glider.pitch + 0.08); };

    this.pitchUpBtn.addEventListener('mousedown', pitchUp);
    this.diveBtn.addEventListener('mousedown', dive);
    this.pitchUpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); pitchUp(); }, { passive: false });
    this.diveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); dive(); }, { passive: false });

    this.restartFlightBtn.addEventListener('click', () => {
      this.initWorld();
      this.showToast('NEW FLIGHT LAUNCHED');
    });

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        pitchUp();
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        dive();
      }
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.rulesBtn.addEventListener('click', () => this.rulesModal.classList.remove('hidden'));
    this.closeModalBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
    this.modalGotItBtn.addEventListener('click', () => this.rulesModal.classList.add('hidden'));
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
      this.glider.airspeed += this.glider.pitch * 0.18;
      this.glider.vy += this.glider.pitch * 0.35;
    } else {
      // Climbing
      this.glider.airspeed += this.glider.pitch * 0.14; // Airspeed slows during climb
      this.glider.vy += this.glider.pitch * 0.28;
    }

    // Natural drag and gravity
    this.glider.airspeed *= 0.995;
    this.glider.vy += 0.12; // Constant downward gravity

    // Stall Check
    if (this.glider.airspeed < 4.5) {
      this.glider.stalled = true;
      this.glider.vy += 0.4; // Rapid plummet
      this.glider.pitch = 0.45; // Auto nose dive
    } else {
      this.glider.stalled = false;
    }

    // Forward translation (World scrolls left)
    const scrollSpeed = Math.max(2, this.glider.airspeed * 0.7);
    this.worldScroll += scrollSpeed;
    this.distance += Math.floor(scrollSpeed);

    // Apply vertical flight
    this.glider.y += this.glider.vy;
    this.glider.vy *= 0.94; // Air dampening

    // Sound whoosh
    if (Math.random() < 0.05) {
      this.audio.playWindWhoosh(this.glider.airspeed);
    }

    // Thermal updraft collisions
    this.thermals.forEach(th => {
      const screenX = th.x - this.worldScroll;
      if (this.glider.x >= screenX && this.glider.x <= screenX + th.w) {
        this.glider.vy -= th.lift * 0.4;
        this.glider.airspeed += 0.08;
        this.audio.playThermalLift();
      }
    });

    // Energy rings pickup
    this.rings.forEach(rg => {
      if (!rg.collected) {
        const screenX = rg.x - this.worldScroll;
        const dist = Math.hypot(this.glider.x - screenX, this.glider.y - rg.y);
        if (dist < rg.r + 14) {
          rg.collected = true;
          this.glider.airspeed += 3.5;
          this.audio.playRingChime();
          this.showToast('ENERGY BOOST! +30 KM/H');
        }
      }
    });

    // Skyscraper Collisions & Ground Bounds
    if (this.glider.y > this.height - 20) {
      this.crashGlider('GROUND IMPACT!');
    } else if (this.glider.y < 15) {
      this.glider.y = 15;
      this.glider.vy = 1;
    }

    this.buildings.forEach(b => {
      const screenX = b.x - this.worldScroll;
      if (this.glider.x + 12 > screenX && this.glider.x - 12 < screenX + b.w) {
        if (this.glider.y + 6 > this.height - b.h) {
          this.crashGlider('SKYSCRAPER COLLISION!');
        }
      }
    });

    // Recycle elements as world scrolls
    if (this.buildings[0] && this.buildings[0].x - this.worldScroll < -200) {
      const lastB = this.buildings[this.buildings.length - 1];
      const popped = this.buildings.shift();
      popped.x = lastB.x + 140 + Math.random() * 80;
      popped.h = 80 + Math.random() * 160;
      this.buildings.push(popped);
    }

    this.updateHUD();
  }

  crashGlider(reason) {
    this.glider.alive = false;
    this.audio.playCrash();
    this.showToast(reason);
  }

  updateHUD() {
    this.distVal.textContent = `${this.distance} m`;
    this.speedVal.textContent = `${Math.floor(this.glider.airspeed * 10)} km/h`;
    const alt = Math.max(0, Math.floor((this.height - this.glider.y) * 1.5));
    this.altVal.textContent = `${alt} m`;
  }

  render() {
    const w = this.width;
    const h = this.height;
    this.ctx.clearRect(0, 0, w, h);

    // Deep Cyberpunk Sky
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(0.7, '#0f172a');
    skyGrad.addColorStop(1, '#1e1b4b');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    // Render Thermal Updraft Columns
    this.thermals.forEach(th => {
      const sx = th.x - this.worldScroll;
      if (sx > -100 && sx < w + 100) {
        const tGrad = this.ctx.createLinearGradient(0, h, 0, 0);
        tGrad.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
        tGrad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
        this.ctx.fillStyle = tGrad;
        this.ctx.fillRect(sx, 0, th.w, h);

        // Upward chevron waves
        this.ctx.strokeStyle = '#c084fc';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        for (let y = h - 40; y > 60; y -= 50) {
          this.ctx.moveTo(sx + 10, y);
          this.ctx.lineTo(sx + th.w / 2, y - 15);
          this.ctx.lineTo(sx + th.w - 10, y);
        }
        this.ctx.stroke();
      }
    });

    // Render Buildings
    this.buildings.forEach(b => {
      const sx = b.x - this.worldScroll;
      if (sx > -120 && sx < w + 120) {
        this.ctx.fillStyle = '#0f172a';
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(sx, h - b.h, b.w, b.h);
        this.ctx.strokeRect(sx, h - b.h, b.w, b.h);

        // Skyscraper window grid
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        for (let winY = h - b.h + 15; winY < h - 15; winY += 20) {
          for (let winX = sx + 10; winX < sx + b.w - 15; winX += 16) {
            this.ctx.fillRect(winX, winY, 8, 8);
          }
        }
      }
    });

    // Render Energy Rings
    this.rings.forEach(rg => {
      if (!rg.collected) {
        const sx = rg.x - this.worldScroll;
        if (sx > -50 && sx < w + 50) {
          this.ctx.save();
          this.ctx.strokeStyle = '#06b6d4';
          this.ctx.lineWidth = 3;
          this.ctx.shadowColor = '#06b6d4';
          this.ctx.shadowBlur = 12;
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

    // Sleek Paper/Quantum Delta Drone
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#a855f7';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#a855f7';
    this.ctx.shadowBlur = 10;

    this.ctx.beginPath();
    this.ctx.moveTo(18, 0);       // Nose
    this.ctx.lineTo(-14, -10);   // Left wingtip
    this.ctx.lineTo(-8, 0);      // Center keel
    this.ctx.lineTo(-14, 10);    // Right wingtip
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CyberGliderGame();
});
