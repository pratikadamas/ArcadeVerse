// Cyber Ramen Dash - Fast-Food Order Cooking Rush Mini-Game

class KitchenAudio {
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

  playBrothPour() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playNoodleDrop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playToppingChop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(450, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playOrderSuccess() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  playOrderFail() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}

// Game State & Order Management
const BROTH_TYPES = ['Miso', 'Shoyu', 'Tonkotsu'];
const TOPPING_TYPES = ['Chashu', 'Ajitsuke Egg', 'Nori Seaweed', 'Green Onion'];
const PATRON_NAMES = ['Kusanagi-9', 'Neo-Tetsuo', 'Deckard-X', 'Cyborg-Zero', 'Akira-Bit', 'Replicant-7'];

class CyberRamenDash {
  constructor() {
    this.audio = new KitchenAudio();
    this.score = 0;
    this.combo = 1;
    this.strikes = 0;
    this.maxStrikes = 3;
    this.shiftTime = 180; // 3-minute shift
    this.isShiftActive = true;

    // Up to 3 active customer slots
    this.slots = [null, null, null];
    this.nextSpawnTimer = 1.5;

    // Active bowl under assembly
    this.currentBowl = {
      broth: null,
      noodles: false,
      toppings: []
    };

    this.initDOM();
    this.setupEvents();

    this.lastTime = performance.now();
    this.gameInterval = setInterval(() => this.tick(), 100);
    this.updateHUD();
    this.updateBowlUI();
  }

  initDOM() {
    this.scoreVal = document.getElementById('scoreVal');
    this.comboVal = document.getElementById('comboVal');
    this.timerVal = document.getElementById('timerVal');
    this.strikesVal = document.getElementById('strikesVal');
    this.customerCounter = document.getElementById('customerCounter');
    this.bowlSummary = document.getElementById('bowlSummary');
    this.liquidLayer = document.getElementById('liquidLayer');
    this.noodleLayer = document.getElementById('noodleLayer');
    this.toppingsContainer = document.getElementById('toppingsContainer');

    this.discardBtn = document.getElementById('discardBtn');
    this.boilNoodlesBtn = document.getElementById('boilNoodlesBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.guideBtn = document.getElementById('guideBtn');
    this.guideModal = document.getElementById('guideModal');
    this.closeGuideBtn = document.getElementById('closeGuideBtn');
    this.modalStartBtn = document.getElementById('modalStartBtn');
  }

  setupEvents() {
    // Broth buttons
    document.querySelectorAll('.ing-btn.broth').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.isShiftActive) return;
        this.currentBowl.broth = btn.dataset.broth;
        this.audio.playBrothPour();
        this.updateBowlUI();
      });
    });

    // Noodle Button
    this.boilNoodlesBtn.addEventListener('click', () => {
      if (!this.isShiftActive) return;
      this.currentBowl.noodles = true;
      this.audio.playNoodleDrop();
      this.updateBowlUI();
    });

    // Topping Buttons
    document.querySelectorAll('.ing-btn.topping').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.isShiftActive) return;
        const top = btn.dataset.topping;
        if (!this.currentBowl.toppings.includes(top)) {
          this.currentBowl.toppings.push(top);
          this.audio.playToppingChop();
          this.updateBowlUI();
        }
      });
    });

    // Discard Bowl
    this.discardBtn.addEventListener('click', () => {
      this.trashBowl();
      this.audio.playOrderFail();
    });

    // Serve buttons
    document.querySelectorAll('.btn-serve').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.isShiftActive) return;
        const slotIdx = parseInt(btn.dataset.slot, 10);
        this.serveBowl(slotIdx);
      });
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      this.soundIcon.innerHTML = this.audio.muted
        ? '<line x1="1" y1="1" x2="23" y2="23"></line><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>'
        : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    });

    // Modal
    this.guideBtn.addEventListener('click', () => this.guideModal.classList.remove('hidden'));
    this.closeGuideBtn.addEventListener('click', () => this.guideModal.classList.add('hidden'));
    this.modalStartBtn.addEventListener('click', () => this.guideModal.classList.add('hidden'));
  }

  trashBowl() {
    this.currentBowl = {
      broth: null,
      noodles: false,
      toppings: []
    };
    this.updateBowlUI();
  }

  updateBowlUI() {
    // Liquid layer class
    this.liquidLayer.className = 'liquid-layer ' + (this.currentBowl.broth ? this.currentBowl.broth.toLowerCase() : 'empty');

    // Noodle layer
    if (this.currentBowl.noodles) {
      this.noodleLayer.classList.remove('hidden');
    } else {
      this.noodleLayer.classList.add('hidden');
    }

    // Toppings
    this.toppingsContainer.innerHTML = '';
    this.currentBowl.toppings.forEach(top => {
      const badge = document.createElement('div');
      badge.className = 'topping-icon-badge';
      badge.textContent = top;
      this.toppingsContainer.appendChild(badge);
    });

    // Summary Text
    const parts = [];
    if (this.currentBowl.broth) parts.push(this.currentBowl.broth);
    if (this.currentBowl.noodles) parts.push('Noodles');
    if (this.currentBowl.toppings.length > 0) parts.push(this.currentBowl.toppings.join(' + '));

    this.bowlSummary.textContent = parts.length > 0 ? parts.join(' • ') : 'Empty Bowl Ready';
  }

  tick() {
    if (!this.isShiftActive) return;

    // Shift Countdown
    this.shiftTime = Math.max(0, this.shiftTime - 0.1);
    if (this.shiftTime <= 0) {
      this.endShift(true);
      return;
    }

    // Customer Spawning
    this.nextSpawnTimer -= 0.1;
    if (this.nextSpawnTimer <= 0) {
      const emptySlotIdx = this.slots.findIndex(s => s === null);
      if (emptySlotIdx !== -1) {
        this.spawnCustomer(emptySlotIdx);
      }
      this.nextSpawnTimer = 3.5 + Math.random() * 2.5;
    }

    // Patience depletion
    for (let i = 0; i < 3; i++) {
      const c = this.slots[i];
      if (c) {
        c.patience -= 0.1;
        if (c.patience <= 0) {
          // Patience expired = 1 Strike
          this.slots[i] = null;
          this.addStrike('Customer walked out!');
        }
      }
    }

    this.renderCustomerTickets();
    this.updateHUD();
  }

  spawnCustomer(slotIdx) {
    const broth = BROTH_TYPES[Math.floor(Math.random() * BROTH_TYPES.length)];
    const numToppings = 1 + Math.floor(Math.random() * 3);
    const shuffledToppings = [...TOPPING_TYPES].sort(() => 0.5 - Math.random());
    const toppings = shuffledToppings.slice(0, numToppings);

    this.slots[slotIdx] = {
      name: PATRON_NAMES[Math.floor(Math.random() * PATRON_NAMES.length)],
      broth: broth,
      noodles: true,
      toppings: toppings,
      maxPatience: 22,
      patience: 22
    };
  }

  serveBowl(slotIdx) {
    const target = this.slots[slotIdx];
    if (!target) return;

    // Validation
    const brothMatch = this.currentBowl.broth === target.broth;
    const noodleMatch = this.currentBowl.noodles === target.noodles;
    const toppingMatch = target.toppings.length === this.currentBowl.toppings.length &&
      target.toppings.every(t => this.currentBowl.toppings.includes(t));

    if (brothMatch && noodleMatch && toppingMatch) {
      // Order Perfect
      const rushBonus = Math.floor(target.patience * 15);
      const earned = (100 + rushBonus) * this.combo;
      this.score += earned;
      this.combo = Math.min(5, this.combo + 1);
      this.slots[slotIdx] = null;
      this.audio.playOrderSuccess();
      this.trashBowl();
    } else {
      // Order Incorrect
      this.addStrike('Incorrect recipe served!');
      this.trashBowl();
    }
  }

  addStrike(reason) {
    this.strikes++;
    this.combo = 1;
    this.audio.playOrderFail();
    if (this.strikes >= this.maxStrikes) {
      this.endShift(false);
    }
  }

  endShift(cleared) {
    this.isShiftActive = false;
    clearInterval(this.gameInterval);
    const title = cleared ? 'Shift Complete!' : 'Health Inspection Shutdown!';
    alert(`${title}\nFinal Credits Earned: ${this.score}`);
  }

  renderCustomerTickets() {
    this.customerCounter.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const c = this.slots[i];
      const ticket = document.createElement('div');
      ticket.className = 'customer-ticket' + (c ? '' : ' empty-slot');

      if (!c) {
        ticket.textContent = `[ Counter Slot ${i + 1} Open ]`;
      } else {
        const pct = Math.max(0, (c.patience / c.maxPatience) * 100);
        const barColor = pct > 50 ? '#10b981' : (pct > 25 ? '#f59e0b' : '#ef4444');

        ticket.innerHTML = `
          <div class="ticket-header">
            <span class="customer-name">${c.name}</span>
            <span>Slot ${i + 1}</span>
          </div>
          <div class="patience-bar-track">
            <div class="patience-bar-fill" style="width: ${pct}%; background-color: ${barColor}"></div>
          </div>
          <div class="order-items">
            <span class="order-pill broth-tag">${c.broth} Broth</span>
            <span class="order-pill">Fresh Noodles</span>
            ${c.toppings.map(t => `<span class="order-pill">${t}</span>`).join('')}
          </div>
        `;
      }
      this.customerCounter.appendChild(ticket);
    }
  }

  updateHUD() {
    this.scoreVal.textContent = this.score;
    this.comboVal.textContent = `x${this.combo}`;
    this.timerVal.textContent = `${Math.ceil(this.shiftTime)}s`;
    this.strikesVal.textContent = `${this.strikes} / ${this.maxStrikes}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CyberRamenDash();
});
