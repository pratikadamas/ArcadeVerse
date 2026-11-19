// Neon Solitaire - Cyber Deck Klondike Card Patience Game

class SolitaireAudio {
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

  playCardSlide() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playCardSnap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.14, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });
  }
}

const SUITS = [
  { name: 'hearts', color: 'red', symbol: 'H' },
  { name: 'diamonds', color: 'red', symbol: 'D' },
  { name: 'clubs', color: 'cyan', symbol: 'C' },
  { name: 'spades', color: 'cyan', symbol: 'S' }
];

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

class NeonSolitaireGame {
  constructor() {
    this.audio = new SolitaireAudio();

    this.stock = [];
    this.waste = [];
    this.foundations = { hearts: [], diamonds: [], clubs: [], spades: [] };
    this.tableau = [[], [], [], [], [], [], []];
    this.history = [];

    this.score = 0;
    this.moves = 0;
    this.seconds = 0;
    this.timer = null;

    this.selectedCard = null; // { source: 'tableau' | 'waste', colIdx: number, cardIdx: number }

    this.initDOM();
    this.setupEvents();
    this.initDragAndDrop();
    this.startNewGame();
  }

  initDOM() {
    this.movesVal = document.getElementById('movesVal');
    this.scoreVal = document.getElementById('scoreVal');
    this.timerVal = document.getElementById('timerVal');
    this.stockPile = document.getElementById('stockPile');
    this.wastePile = document.getElementById('wastePile');
    this.foundationSlots = document.querySelectorAll('.foundation-slot');
    this.tableauCols = document.querySelectorAll('.tableau-col');

    this.undoBtn = document.getElementById('undoBtn');
    this.hintBtn = document.getElementById('hintBtn');
    this.autoCompleteBtn = document.getElementById('autoCompleteBtn');
    this.newGameBtn = document.getElementById('newGameBtn');

    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.rulesBtn = document.getElementById('rulesBtn');
    this.rulesModal = document.getElementById('rulesModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalGotItBtn = document.getElementById('modalGotItBtn');
  }

  startNewGame() {
    clearInterval(this.timer);
    this.seconds = 0;
    this.moves = 0;
    this.score = 0;
    this.history = [];
    this.selectedCard = null;

    // Build 52-card deck
    const deck = [];
    SUITS.forEach(s => {
      RANKS.forEach((r, rankVal) => {
        deck.push({
          suit: s.name,
          color: s.color,
          rank: r,
          value: rankVal + 1,
          faceUp: false
        });
      });
    });

    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal into 7 tableau columns
    this.tableau = [[], [], [], [], [], [], []];
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r <= c; r++) {
        const card = deck.pop();
        if (r === c) card.faceUp = true;
        this.tableau[c].push(card);
      }
    }

    this.stock = deck;
    this.waste = [];
    this.foundations = { hearts: [], diamonds: [], clubs: [], spades: [] };

    this.timer = setInterval(() => {
      this.seconds++;
      const m = String(Math.floor(this.seconds / 60)).padStart(2, '0');
      const s = String(this.seconds % 60).padStart(2, '0');
      this.timerVal.textContent = `${m}:${s}`;
    }, 1000);

    this.render();
    this.updateHUD();
  }

  saveSnapshot() {
    this.history.push(JSON.stringify({
      stock: this.stock,
      waste: this.waste,
      foundations: this.foundations,
      tableau: this.tableau,
      score: this.score,
      moves: this.moves
    }));
  }

  undo() {
    if (this.history.length === 0) return;
    const snap = JSON.parse(this.history.pop());
    this.stock = snap.stock;
    this.waste = snap.waste;
    this.foundations = snap.foundations;
    this.tableau = snap.tableau;
    this.score = snap.score;
    this.moves = snap.moves;
    this.selectedCard = null;
    this.audio.playCardSlide();
    this.render();
    this.updateHUD();
  }

  setupEvents() {
    this.stockPile.addEventListener('click', () => {
      this.saveSnapshot();
      if (this.stock.length > 0) {
        const card = this.stock.pop();
        card.faceUp = true;
        this.waste.push(card);
      } else {
        // Recycle waste to stock
        while (this.waste.length > 0) {
          const card = this.waste.pop();
          card.faceUp = false;
          this.stock.push(card);
        }
      }
      this.moves++;
      this.selectedCard = null;
      this.audio.playCardSlide();
      this.render();
      this.updateHUD();
    });

    this.wastePile.addEventListener('click', () => {
      if (this.isJustDragged && this.isJustDragged()) return;
      if (this.waste.length === 0) return;
      this.selectedCard = { source: 'waste' };
      this.render();
    });

    // Foundations click
    this.foundationSlots.forEach(slot => {
      slot.addEventListener('click', () => {
        if (this.isJustDragged && this.isJustDragged()) return;
        const suit = slot.dataset.suit;
        this.tryMoveToFoundation(suit);
      });
    });

    // Tableau column click
    this.tableauCols.forEach((col, colIdx) => {
      col.addEventListener('click', (e) => {
        if (this.isJustDragged && this.isJustDragged()) return;
        const cardElem = e.target.closest('.card-item');
        if (!cardElem && this.selectedCard) {
          // Empty column move (King only)
          this.tryMoveToTableau(colIdx);
          return;
        }
        if (cardElem) {
          const cardIdx = parseInt(cardElem.dataset.cardIdx, 10);
          const card = this.tableau[colIdx][cardIdx];
          if (!card.faceUp) return;

          if (!this.selectedCard) {
            this.selectedCard = { source: 'tableau', colIdx, cardIdx };
            this.render();
          } else {
            this.tryMoveToTableau(colIdx);
          }
        }
      });
    });

    this.undoBtn.addEventListener('click', () => this.undo());
    this.newGameBtn.addEventListener('click', () => this.startNewGame());

    this.autoCompleteBtn.addEventListener('click', () => {
      // Auto-move available cards to foundations
      this.autoCompleteStep();
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

  initDragAndDrop() {
    let activeDrag = null;
    let justDragged = false;

    const cleanupDrag = () => {
      if (!activeDrag) return;
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      activeDrag.cards.forEach((c) => {
        const origIdx = parseInt(c.dataset.cardIdx, 10);
        c.style.zIndex = isNaN(origIdx) ? '1' : `${origIdx + 1}`;
        c.style.transform = '';
        c.style.pointerEvents = '';
        c.classList.remove('dragging');
      });
      if (activeDrag.container) {
        activeDrag.container.style.zIndex = '';
      }
      if (activeDrag.tierContainer) {
        activeDrag.tierContainer.style.zIndex = '';
      }
      if (activeDrag.targetCard && activeDrag.pointerId !== undefined) {
        try {
          activeDrag.targetCard.releasePointerCapture(activeDrag.pointerId);
        } catch (_) {}
      }
      activeDrag = null;
    };

    document.addEventListener('pointerdown', (e) => {
      if (activeDrag) cleanupDrag();

      const cardElem = e.target.closest('.card-item');
      if (!cardElem || cardElem.classList.contains('face-down')) return;

      const wasteSlot = cardElem.closest('#wastePile');
      const tableauCol = cardElem.closest('.tableau-col');
      if (!wasteSlot && !tableauCol) return;

      let cards = [];
      let sourceInfo = null;

      if (wasteSlot) {
        if (this.waste.length === 0) return;
        cards = [cardElem];
        sourceInfo = { source: 'waste' };
      } else if (tableauCol) {
        const colIdx = parseInt(tableauCol.dataset.col, 10);
        const cardIdx = parseInt(cardElem.dataset.cardIdx, 10);
        const colCards = Array.from(tableauCol.querySelectorAll('.card-item'));
        cards = colCards.filter(c => parseInt(c.dataset.cardIdx, 10) >= cardIdx);
        sourceInfo = { source: 'tableau', colIdx, cardIdx };
      }

      if (cards.length === 0) return;

      const container = wasteSlot || tableauCol;
      const tierContainer = container.closest('.upper-tier, .tableau-tier');
      if (tierContainer) tierContainer.style.zIndex = '1000';
      if (container) container.style.zIndex = '1000';

      // Elevate active drag card elements to z-index: 1000 during pointerdown
      cards.forEach((c, idx) => {
        c.style.zIndex = `${1000 + idx}`;
        c.classList.add('dragging');
      });

      try {
        cardElem.setPointerCapture(e.pointerId);
      } catch (_) {}

      activeDrag = {
        cards,
        container,
        tierContainer,
        targetCard: cardElem,
        sourceInfo,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        pointerId: e.pointerId
      };
    });

    document.addEventListener('pointermove', (e) => {
      if (!activeDrag) return;

      const dx = e.clientX - activeDrag.startX;
      const dy = e.clientY - activeDrag.startY;

      if (!activeDrag.isDragging && Math.hypot(dx, dy) > 4) {
        activeDrag.isDragging = true;
        activeDrag.cards.forEach(c => {
          c.style.pointerEvents = 'none';
        });
      }

      if (activeDrag.isDragging) {
        activeDrag.cards.forEach(c => {
          c.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        });

        // Highlight hovered drop targets
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const target = hitEl?.closest('.tableau-col, .foundation-slot');
        if (target) {
          target.classList.add('drag-over');
        }
      }
    });

    const onPointerUp = (e) => {
      if (!activeDrag) return;

      if (activeDrag.isDragging) {
        justDragged = true;
        setTimeout(() => { justDragged = false; }, 120);

        // Find target under pointer
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const targetCol = hitEl?.closest('.tableau-col');
        const targetFoundation = hitEl?.closest('.foundation-slot');

        let moved = false;
        this.selectedCard = activeDrag.sourceInfo;

        if (targetCol) {
          const destColIdx = parseInt(targetCol.dataset.col, 10);
          if (activeDrag.sourceInfo.source !== 'tableau' || activeDrag.sourceInfo.colIdx !== destColIdx) {
            moved = this.tryMoveToTableau(destColIdx);
          }
        } else if (targetFoundation) {
          const suit = targetFoundation.dataset.suit;
          moved = this.tryMoveToFoundation(suit);
        }

        cleanupDrag();

        if (!moved) {
          this.audio.playCardSlide();
          this.selectedCard = null;
        }
      } else {
        cleanupDrag();
      }
    };

    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', cleanupDrag);

    this.isJustDragged = () => justDragged;
  }

  tryMoveToFoundation(suit) {
    if (!this.selectedCard) return false;
    let cardToMove = null;

    if (this.selectedCard.source === 'waste') {
      cardToMove = this.waste[this.waste.length - 1];
    } else if (this.selectedCard.source === 'tableau') {
      const col = this.tableau[this.selectedCard.colIdx];
      if (this.selectedCard.cardIdx === col.length - 1) {
        cardToMove = col[col.length - 1];
      }
    }

    if (!cardToMove || cardToMove.suit !== suit) return false;

    const targetPile = this.foundations[suit];
    const targetValue = targetPile.length === 0 ? 1 : targetPile[targetPile.length - 1].value + 1;

    if (cardToMove.value === targetValue) {
      this.saveSnapshot();
      if (this.selectedCard.source === 'waste') {
        this.foundations[suit].push(this.waste.pop());
      } else {
        const col = this.tableau[this.selectedCard.colIdx];
        this.foundations[suit].push(col.pop());
        if (col.length > 0) col[col.length - 1].faceUp = true;
      }
      this.score += 50;
      this.moves++;
      this.audio.playCardSnap();
      this.selectedCard = null;
      this.render();
      this.updateHUD();

      // Check win condition
      const totalFoundation = Object.values(this.foundations).reduce((acc, p) => acc + p.length, 0);
      if (totalFoundation === 52) {
        this.audio.playVictory();
        alert('CYBER DECK CLEARED! PERFECT GAME!');
      }
      return true;
    }
    return false;
  }

  tryMoveToTableau(destColIdx) {
    if (!this.selectedCard) return false;
    const destCol = this.tableau[destColIdx];
    let cardsToMove = [];

    if (this.selectedCard.source === 'waste') {
      cardsToMove = [this.waste[this.waste.length - 1]];
    } else if (this.selectedCard.source === 'tableau') {
      const srcCol = this.tableau[this.selectedCard.colIdx];
      cardsToMove = srcCol.slice(this.selectedCard.cardIdx);
    }

    if (cardsToMove.length === 0) return false;
    const bottomCard = cardsToMove[0];

    let valid = false;
    if (destCol.length === 0) {
      if (bottomCard.value === 13) valid = true; // King in empty col
    } else {
      const topCard = destCol[destCol.length - 1];
      if (topCard.faceUp && topCard.color !== bottomCard.color && topCard.value === bottomCard.value + 1) {
        valid = true;
      }
    }

    if (valid) {
      this.saveSnapshot();
      if (this.selectedCard.source === 'waste') {
        destCol.push(this.waste.pop());
      } else {
        const srcCol = this.tableau[this.selectedCard.colIdx];
        const removed = srcCol.splice(this.selectedCard.cardIdx, cardsToMove.length);
        removed.forEach(c => destCol.push(c));
        if (srcCol.length > 0) srcCol[srcCol.length - 1].faceUp = true;
      }
      this.score += 20;
      this.moves++;
      this.audio.playCardSlide();
      this.selectedCard = null;
      this.render();
      this.updateHUD();
      return true;
    }
    return false;
  }

  autoCompleteStep() {
    let movedAny = false;
    // Check waste first
    if (this.waste.length > 0) {
      const wCard = this.waste[this.waste.length - 1];
      const targetPile = this.foundations[wCard.suit];
      const targetVal = targetPile.length === 0 ? 1 : targetPile[targetPile.length - 1].value + 1;
      if (wCard.value === targetVal) {
        this.foundations[wCard.suit].push(this.waste.pop());
        movedAny = true;
      }
    }

    // Check tableau
    for (let c = 0; c < 7; c++) {
      const col = this.tableau[c];
      if (col.length > 0) {
        const tCard = col[col.length - 1];
        const targetPile = this.foundations[tCard.suit];
        const targetVal = targetPile.length === 0 ? 1 : targetPile[targetPile.length - 1].value + 1;
        if (tCard.value === targetVal) {
          this.foundations[tCard.suit].push(col.pop());
          if (col.length > 0) col[col.length - 1].faceUp = true;
          movedAny = true;
          break;
        }
      }
    }

    if (movedAny) {
      this.audio.playCardSnap();
      this.render();
      this.updateHUD();
      setTimeout(() => this.autoCompleteStep(), 150);
    }
  }

  render() {
    // Stock pile
    this.stockPile.style.opacity = this.stock.length > 0 ? '1' : '0.4';

    // Waste pile
    this.wastePile.style.zIndex = '';
    this.wastePile.innerHTML = '';
    if (this.waste.length > 0) {
      const card = this.waste[this.waste.length - 1];
      const el = this.createCardElement(card);
      el.style.zIndex = '1';
      if (this.selectedCard && this.selectedCard.source === 'waste') {
        el.classList.add('selected');
      }
      this.wastePile.appendChild(el);
    }

    // Foundations
    this.foundationSlots.forEach(slot => {
      const suit = slot.dataset.suit;
      const pile = this.foundations[suit];
      slot.innerHTML = '';
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        slot.appendChild(this.createCardElement(topCard));
      } else {
        slot.innerHTML = `<span style="opacity:0.3">${suit[0].toUpperCase()}</span>`;
      }
    });

    // Tableau
    this.tableauCols.forEach((colElem, cIdx) => {
      colElem.style.zIndex = '';
      colElem.innerHTML = '';
      const colData = this.tableau[cIdx];

      colData.forEach((card, cardIdx) => {
        const cardElem = this.createCardElement(card);
        cardElem.dataset.cardIdx = cardIdx;
        cardElem.style.top = `${cardIdx * 24}px`;
        cardElem.style.zIndex = `${cardIdx + 1}`;

        if (this.selectedCard && this.selectedCard.source === 'tableau' &&
            this.selectedCard.colIdx === cIdx && cardIdx >= this.selectedCard.cardIdx) {
          cardElem.classList.add('selected');
        }
        colElem.appendChild(cardElem);
      });
    });
  }

  createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-item ${card.color}-suit` + (!card.faceUp ? ' face-down' : '');

    if (card.faceUp) {
      el.innerHTML = `
        <div class="card-top">
          <span>${card.rank}</span>
          <span>${card.suit[0].toUpperCase()}</span>
        </div>
        <div class="card-center">
          <span>${card.rank}</span>
        </div>
        <div class="card-bottom">
          <span>${card.rank}</span>
        </div>
      `;
    }
    return el;
  }

  updateHUD() {
    this.movesVal.textContent = this.moves;
    this.scoreVal.textContent = this.score;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new NeonSolitaireGame();

  window.addEventListener('message', (e) => {
    if (!e || !e.data) return;
    if (e.data.type === 'ARCADEVERSE_TEARDOWN' || e.data.type === 'ARCADEVERSE_PAUSE') {
      if (game.audio && game.audio.ctx && typeof game.audio.ctx.suspend === 'function') {
        game.audio.ctx.suspend().catch(() => {});
      }
    }
  });
});
