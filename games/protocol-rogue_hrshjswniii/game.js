(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ui = {
    sector: $('sector'), node: $('node-count'), hp: $('player-hp'), hpSmall: $('hp-small'), credits: $('credits'), record: $('record'),
    track: $('network-track'), enemyName: $('enemy-name'), encounterLabel: $('encounter-label'), enemyHp: $('enemy-hp'), enemyBar: $('enemy-hp-bar'),
    enemyStatus: $('enemy-status'), enemyShield: $('enemy-shield'), intent: $('intent'), intentText: $('intent-text'),
    log: $('combat-log'), block: $('block'), energy: $('energy-count'), pips: $('energy-pips'), playerStatus: $('player-status'), trace: $('trace'),
    draw: $('draw-count'), discard: $('discard-count'), exile: $('exile-count'), hand: $('hand'), handCount: $('hand-count'),
    turn: $('turn-label'), start: $('start-overlay'), map: $('map-overlay'), mapSector: $('map-sector'), mapTitle: $('map-title'),
    mapCopy: $('map-copy'), routes: $('route-options'), choice: $('choice-overlay'), choiceEyebrow: $('choice-eyebrow'),
    choiceTitle: $('choice-title'), choiceCopy: $('choice-copy'), choices: $('choice-options'), deck: $('deck-overlay'),
    deckList: $('deck-list'), end: $('end-overlay'), endEyebrow: $('end-eyebrow'), endTitle: $('end-title'), endCopy: $('end-copy')
  };

  const CARD = {
    strike: { name: 'Packet Strike', cost: 1, type: 'attack', text: 'Deal 6 damage.', tags: ['ICE'], power: 6 },
    'strike+': { name: 'Packet Strike+', cost: 1, type: 'attack', text: 'Deal 9 damage.', tags: ['ICE'], power: 9 },
    heavy: { name: 'Breach Payload', cost: 2, type: 'attack', text: 'Deal 12 damage.', tags: ['ICE'], power: 12 },
    'heavy+': { name: 'Breach Payload+', cost: 2, type: 'attack', text: 'Deal 16 damage.', tags: ['ICE'], power: 16 },
    guard: { name: 'Hardlight Guard', cost: 1, type: 'guard', text: 'Gain 7 guard.', tags: ['OVERRIDE'], power: 7 },
    'guard+': { name: 'Hardlight Guard+', cost: 1, type: 'guard', text: 'Gain 10 guard.', tags: ['OVERRIDE'], power: 10 },
    fortify: { name: 'Firewall Stance', cost: 2, type: 'guard', text: 'Gain 13 guard.', tags: ['OVERRIDE'], power: 13 },
    exploit: { name: 'Exploit Window', cost: 1, type: 'exploit', text: 'Deal 3 damage and expose the target. Exposed programs take +3 damage.', tags: ['TRACE'], power: 3 },
    'exploit+': { name: 'Exploit Window+', cost: 1, type: 'exploit', text: 'Deal 5 damage and expose the target. Exposed programs take +4 damage.', tags: ['TRACE'], power: 5 },
    overclock: { name: 'Overclock', cost: 0, type: 'utility', text: 'Gain 1 energy and draw 1 card.', tags: ['OVERRIDE'], power: 1 },
    'overclock+': { name: 'Overclock+', cost: 0, type: 'utility', text: 'Gain 2 energy and draw 1 card.', tags: ['OVERRIDE'], power: 2 },
    trace: { name: 'Trace Pulse', cost: 1, type: 'utility', text: 'Deal 4 damage and reduce trace by 1.', tags: ['TRACE'], power: 4 },
    'trace+': { name: 'Trace Pulse+', cost: 1, type: 'utility', text: 'Deal 6 damage and reduce trace by 2.', tags: ['TRACE'], power: 6 },
    ice: { name: 'ICE Breaker', cost: 2, type: 'attack', text: 'Deal 10 damage. Deal 5 more if the target has shield.', tags: ['ICE'], power: 10 },
    reboot: { name: 'System Reboot', cost: 1, type: 'utility', text: 'Restore 5 integrity.', tags: ['OVERRIDE'], power: 5 },
    'reboot+': { name: 'System Reboot+', cost: 1, type: 'utility', text: 'Restore 8 integrity.', tags: ['OVERRIDE'], power: 8 },
    suppress: { name: 'Suppressor Script', cost: 1, type: 'exploit', text: 'Deal 2 damage. Weaken the next enemy attack by 5.', tags: ['OVERRIDE'], power: 2 },
    'suppress+': { name: 'Suppressor Script+', cost: 1, type: 'exploit', text: 'Deal 4 damage. Weaken the next enemy attack by 7.', tags: ['OVERRIDE'], power: 4 },
    siphon: { name: 'Data Siphon', cost: 1, type: 'attack', text: 'Deal 5 damage and gain 4 credits if the target is defeated.', tags: ['TRACE'], power: 5 },
    'siphon+': { name: 'Data Siphon+', cost: 1, type: 'attack', text: 'Deal 7 damage and gain 6 credits if the target is defeated.', tags: ['TRACE'], power: 7 },
    purge: { name: 'Trace Purge', cost: 1, type: 'utility', text: 'Reduce trace by 2 and gain 4 guard.', tags: ['TRACE'], power: 4 },
    'purge+': { name: 'Trace Purge+', cost: 1, type: 'utility', text: 'Clear all trace and gain 6 guard.', tags: ['TRACE'], power: 6 }
  };
  const REWARD_POOL = ['strike+', 'heavy', 'guard+', 'fortify', 'exploit+', 'overclock+', 'trace+', 'ice', 'reboot+', 'suppress', 'siphon', 'purge'];
  const BASE_DECK = ['strike','strike','strike','strike','guard','guard','guard','exploit','overclock','trace'];
  const SECTOR_NAMES = ['PERIPHERAL ACCESS', 'CORPORATE FIREWALL', 'CORE AUTHORITY'];
  const BOSS_NAMES = ['GATEKEEPER PRIME', 'THE COMPLIANCE ENGINE', 'SOVEREIGN MAINFRAME'];

  let state = null;
  let muted = false;
  let audio = null;
  let battleOpen = false;
  let teardown = false;
  let choiceBack = null;
  let toastTimer = 0;
  let bestSector = 0;
  let unlockedCards = [];
  let runRecords = { completed: 0, bestTurns: 0, bestSynergy: 'None' };
  try {
    bestSector = Number(localStorage.getItem('protocol_rogue_best_sector')) || 0;
    unlockedCards = JSON.parse(localStorage.getItem('protocol_rogue_unlocked_cards') || '[]');
    const saved = JSON.parse(localStorage.getItem('protocol_rogue_records') || '{}');
    runRecords = Object.assign(runRecords, saved);
    muted = localStorage.getItem('protocol_rogue_muted') === 'true';
  } catch (_) {}
  $('record').textContent = String(bestSector);
  $('start-record').textContent = String(bestSector);
  $('runs-record').textContent = String(runRecords.completed);
  $('unlocks-record').textContent = String(unlockedCards.length);
  $('sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON';

  function audioStart() {
    if (!audio) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audio = new AudioClass();
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }

  function tone(freq, duration, wave) {
    if (muted || !audio) return;
    try {
      const osc = audio.createOscillator(); const gain = audio.createGain();
      osc.type = wave || 'triangle'; osc.frequency.setValueAtTime(freq, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq * 0.55), audio.currentTime + duration);
      gain.gain.setValueAtTime(0.055, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) {}
  }

  function log(message) {
    const row = document.createElement('div'); row.textContent = message;
    ui.log.prepend(row);
    while (ui.log.children.length > 4) ui.log.lastElementChild.remove();
  }

  function notify(message) {
    let el = document.getElementById('rogue-toast');
    if (!el) { el = document.createElement('div'); el.id = 'rogue-toast'; el.className = 'rogue-toast'; el.setAttribute('role','status'); document.body.appendChild(el); }
    el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function unlockCard(id) {
    if (unlockedCards.includes(id)) return;
    unlockedCards.push(id);
    try { localStorage.setItem('protocol_rogue_unlocked_cards', JSON.stringify(unlockedCards)); } catch (_) {}
    $('unlocks-record').textContent = String(unlockedCards.length);
  }

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  }

  function newRun() {
    audioStart();
    state = {
      sector: 0, step: 0, hp: 60, maxHp: 60, credits: 0, deck: BASE_DECK.slice(), draw: [], discard: [], exhaust: [], hand: [],
      energy: 3, maxEnergy: 3, block: 0, trace: 0, weak: 0, enemy: null, intentIndex: 0, node: null,
      turns: 0, cardsPlayed: 0, tagCounts: { ICE: 0, TRACE: 0, OVERRIDE: 0 }, lastTag: null,
      playedThisTurn: [], routeHistory: [], runEnded: false
    };
    battleOpen = false;
    hideAllOverlays();
    showMap();
  }

  function hideAllOverlays() {
    [ui.start,ui.map,ui.choice,ui.deck,ui.end].forEach(el => el.classList.remove('visible'));
  }

  function drawMapOptions() {
    const step = state.step;
    if (step === 0) return [{ type:'combat', title:'Firewall Node', detail:'Standard security process. Gain credits and choose a card reward.' }];
    if (step === 1) return [{ type:'combat', title:'Firewall Node', detail:'Standard encounter. Reliable credits and a card reward.' }, { type:'cache', title:'Data Cache', detail:'Recover integrity or upgrade a command card.' }];
    if (step === 2) return [{ type:'combat', title:'Firewall Node', detail:'Standard encounter. Prepare for the elite ahead.' }, { type:'market', title:'Black Market', detail:'Spend credits to upgrade, remove, or buy a protocol.' }];
    if (step === 3) return [{ type:'combat', title:'Firewall Node', detail:'Standard security process.' }, { type:'elite', title:'Elite Warden', detail:'High risk. Heavy attacks, better credits, stronger reward.' }];
    return [{ type:'boss', title:BOSS_NAMES[state.sector], detail:'Sector mainframe. Defeat it to breach the next sector.' }];
  }

  function showMap() {
    if (!state || state.runEnded) return;
    battleOpen = false;
    const atFinal = state.sector === 2 && state.step === 4;
    ui.mapSector.textContent = 'SECTOR ' + String(state.sector + 1).padStart(2,'0') + ' / ' + SECTOR_NAMES[state.sector];
    ui.mapTitle.textContent = atFinal ? 'Final mainframe route' : 'Choose your next node';
    ui.mapCopy.textContent = 'Route ' + (state.step + 1) + ' of 5. Riskier nodes offer better rewards.';
    ui.routes.textContent = '';
    drawMapOptions().forEach(option => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'route-card';
      const name = document.createElement('strong'); name.textContent = option.title;
      const detail = document.createElement('span'); detail.textContent = option.detail;
      const risk = document.createElement('small'); risk.textContent = option.type === 'elite' || option.type === 'boss' ? 'THREAT: HIGH' : option.type === 'cache' || option.type === 'market' ? 'THREAT: NONE' : 'THREAT: MODERATE';
      button.append(name,detail,risk); button.addEventListener('click', () => enterNode(option)); ui.routes.appendChild(button);
    });
    updateTrack(); updateHud(); ui.map.classList.add('visible');
  }

  function updateTrack() {
    ui.track.textContent = '';
    for (let i = 0; i < 15; i++) {
      if (i) { const link = document.createElement('i'); link.className = 'track-link'; ui.track.appendChild(link); }
      const button = document.createElement('span'); button.className = 'track-node'; button.textContent = String(i + 1);
      if (i < state.sector * 5 + state.step) button.classList.add('done');
      if (i === state.sector * 5 + state.step) button.classList.add('current');
      ui.track.appendChild(button);
    }
  }

  function enterNode(node) {
    state.node = node; state.routeHistory.push(node.type); state.block = 0; ui.log.textContent = '';
    ui.map.classList.remove('visible'); updateTrack(); updateHud();
    if (node.type === 'cache') { showCache(); return; }
    if (node.type === 'market') { showMarket(); return; }
    startBattle(node);
  }

  function showCache() {
    ui.choiceEyebrow.textContent = 'UNGUARDED DATA CACHE'; ui.choiceTitle.textContent = 'Choose a cache protocol';
    ui.choiceCopy.textContent = 'A quiet node. Recover or tune your deck before advancing.'; ui.choices.textContent = '';
    addOption('Restore integrity', 'Recover 16 integrity, up to your maximum.', 'SAFE', () => { state.hp = Math.min(state.maxHp, state.hp + 16); log('Cache restored 16 integrity.'); advanceNode(); });
    addOption('Upgrade a card', 'Permanently improve one unupgraded card in this run.', 'DECK', () => chooseUpgrade(() => advanceNode()));
    ui.choiceSkip.hidden = true; ui.choice.classList.add('visible');
  }

  function showMarket() {
    ui.choiceEyebrow.textContent = 'BLACK MARKET / ' + state.credits + ' CREDITS'; ui.choiceTitle.textContent = 'Trade with the broker';
    ui.choiceCopy.textContent = 'Credits are spent for this run only.'; ui.choices.textContent = '';
    const buyId = shuffle(REWARD_POOL.slice()).find(id => !state.deck.includes(id)) || 'heavy';
    addOption('Buy ' + CARD[buyId].name, 'Add this protocol to your deck for 18 credits.', '18 CR', () => {
      if (state.credits < 18) { notify('Not enough credits.'); return; }
      state.credits -= 18; state.deck.push(buyId); unlockCard(buyId); log(CARD[buyId].name + ' added to deck.'); advanceNode();
    });
    addOption('Remove a card', 'Permanently remove one card from your run deck.', '12 CR', () => chooseRemoval(() => advanceNode()));
    addOption('Upgrade a card', 'Improve a card already in your deck.', '14 CR', () => chooseUpgrade(() => advanceNode(),14));
    ui.choiceSkip.hidden = false; ui.choiceSkip.textContent = 'LEAVE MARKET'; ui.choice.classList.add('visible');
  }

  function addOption(title, detail, badge, action) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'route-card';
    const strong = document.createElement('strong'); strong.textContent = title;
    const span = document.createElement('span'); span.textContent = detail;
    const small = document.createElement('small'); small.textContent = badge;
    button.append(strong,span,small); button.addEventListener('click', action); ui.choices.appendChild(button);
  }

  function chooseUpgrade(done, cost) {
    if (cost && state.credits < cost) { notify('Not enough credits.'); return; }
    const eligible = [...new Set(state.deck)].filter(id => CARD[id] && !id.endsWith('+') && CARD[id + '+']);
    if (!eligible.length) { notify('No cards can be upgraded.'); return; }
    choiceBack = cost ? showMarket : showCache;
    ui.choiceTitle.textContent = 'Select a card to upgrade'; ui.choiceCopy.textContent = 'The upgraded protocol replaces all copies of that card.'; ui.choices.textContent = '';
    eligible.forEach(id => addOption(CARD[id].name, CARD[id].text + ' → ' + CARD[id + '+'].text, 'UPGRADE', () => {
      if (cost) state.credits -= cost;
      state.deck = state.deck.map(card => card === id ? id + '+' : card);
      state.draw = state.draw.map(card => card === id ? id + '+' : card);
      state.discard = state.discard.map(card => card === id ? id + '+' : card);
      unlockCard(id + '+');
      choiceBack = null; ui.choice.classList.remove('visible'); done();
    }));
    ui.choiceSkip.hidden = false; ui.choiceSkip.textContent = 'CANCEL'; ui.choice.classList.add('visible');
  }

  function chooseRemoval(done) {
    if (state.credits < 12) { notify('Not enough credits.'); return; }
    if (state.deck.length <= 3) { notify('Deck needs at least three cards.'); return; }
    choiceBack = showMarket;
    ui.choiceTitle.textContent = 'Select a card to remove'; ui.choiceCopy.textContent = 'Remove one copy of the selected command.'; ui.choices.textContent = '';
    [...new Set(state.deck)].forEach(id => addOption(CARD[id].name, CARD[id].text, 'REMOVE', () => {
      state.credits -= 12; state.deck.splice(state.deck.indexOf(id),1); choiceBack = null; ui.choice.classList.remove('visible'); done();
    }));
    ui.choiceSkip.hidden = false; ui.choiceSkip.textContent = 'CANCEL'; ui.choice.classList.add('visible');
  }

  function makeEnemy(node) {
    const sector = state.sector;
    const base = 25 + sector * 9 + (state.step === 3 ? 8 : 0);
    if (node.type === 'boss') return {
      name: BOSS_NAMES[sector], maxHp: 56 + sector * 22, hp: 56 + sector * 22, shield: 0, exposed: 0, weak: 0,
      pattern: sector === 0 ? ['attack','trace','shield'] : sector === 1 ? ['attack','attack','trace','shield'] : ['attack','trace','attack','shield'],
      actions: { attack: 12 + sector * 3, trace: 1, shield: 11 + sector * 2 }, boss: true
    };
    if (node.type === 'elite') return {
      name: ['ICE HOUND','WRAITH WARDEN','BLACK ICE EXECUTOR'][sector], maxHp: base + 22, hp: base + 22, shield: 0, exposed: 0, weak: 0,
      pattern: ['attack','shield','attack','trace'], actions: { attack: 10 + sector * 2, trace: 1, shield: 9 + sector * 2 }, elite: true
    };
    const names = [['TRACE WORM','PACKET SENTINEL','CACHE LEECH'],['FIREWALL DRONE','AUDIT SPIDER','ICE BROKER'],['NULL PROCESS','KEY PHANTOM','CORE SENTINEL']];
    const name = names[sector][Math.floor(Math.random()*names[sector].length)];
    const kind = name.includes('SENTINEL') || name.includes('SENTINEL') ? 'shield' : Math.random() < 0.35 ? 'trace' : 'attack';
    return { name, maxHp: base, hp: base, shield: 0, exposed: 0, weak: 0,
      pattern: kind === 'trace' ? ['trace','attack','attack'] : kind === 'shield' ? ['shield','attack','attack'] : ['attack','attack','trace'],
      actions: { attack: 6 + sector * 3, trace: 1, shield: 7 + sector * 2 }, elite:false,boss:false };
  }

  function startBattle(node) {
    state.enemy = makeEnemy(node); state.intentIndex = 0; state.trace = 0; state.weak = 0; state.block = 0; state.turns++;
    battleOpen = true; ui.encounterLabel.textContent = node.type === 'boss' ? 'SECTOR MAINFRAME' : node.type === 'elite' ? 'ELITE SECURITY PROCESS' : 'HOSTILE PROCESS';
    log('Intrusion started. Read the enemy intent.'); startTurn(true); updateHud(); renderEnemy();
  }

  function currentIntent() {
    const enemy = state.enemy; const action = enemy.pattern[state.intentIndex % enemy.pattern.length];
    return { action, amount: enemy.actions[action] };
  }

  function intentLabel(intent) {
    if (intent.action === 'attack') return 'ATTACK ' + intent.amount + ' DAMAGE';
    if (intent.action === 'shield') return 'RAISE ' + intent.amount + ' SHIELD';
    if (intent.action === 'trace') return 'TRACE + ' + intent.amount;
    return 'UNKNOWN ACTION';
  }

  function drawCards(amount) {
    for (let i = 0; i < amount; i++) {
      if (!state.draw.length && state.discard.length) { state.draw = shuffle(state.discard.splice(0)); log('Discard pile shuffled into draw pile.'); }
      if (!state.draw.length) break;
      state.hand.push(state.draw.pop());
    }
  }

  function startTurn(first) {
    if (!battleOpen || !state.enemy || state.enemy.hp <= 0) return;
    state.energy = state.maxEnergy; state.block = 0; state.playedThisTurn = []; state.lastTag = null;
    state.hand = []; drawCards(5);
    ui.turn.textContent = 'YOUR TURN'; ui.turn.style.color = '#54f3eb';
    if (!first) log('Turn ' + state.turns + '. ' + state.energy + ' energy restored.');
    renderHand(); updateHud(); renderEnemy();
  }

  function dealDamage(amount, source, bonus) {
    const enemy = state.enemy; if (!enemy || enemy.hp <= 0) return;
    let total = amount + (bonus || 0);
    if (enemy.exposed > 0) total += 3;
    const blocked = Math.min(enemy.shield, total); enemy.shield -= blocked; total -= blocked;
    enemy.hp = Math.max(0, enemy.hp - total);
    log(source + ' dealt ' + (total + blocked) + (blocked ? ' (' + blocked + ' absorbed)' : '') + ' damage.');
    tone(total ? 210 : 115, 0.11, 'sawtooth');
    if (enemy.hp <= 0) { enemyDefeated(); return; }
    renderEnemy();
  }

  function playCard(handIndex) {
    if (!battleOpen || !state || !state.enemy) return;
    const id = state.hand[handIndex]; const card = CARD[id];
    if (!card || state.energy < card.cost) { notify('Not enough energy for that protocol.'); return; }
    state.energy -= card.cost; state.hand.splice(handIndex,1); state.discard.push(id); state.cardsPlayed++;
    card.tags.forEach(tag => { state.tagCounts[tag]++; });
    let synergy = '';
    if (state.lastTag && card.tags.includes(state.lastTag)) {
      if (state.lastTag === 'ICE' && card.type === 'attack') { dealDamage(2, 'ICE synergy'); synergy = ' ICE synergy +2 damage.'; }
      else if (state.lastTag === 'TRACE' && card.type !== 'guard') { state.trace = Math.max(0,state.trace-1); synergy = ' TRACE synergy cleared 1 trace.'; }
      else if (state.lastTag === 'OVERRIDE') { state.energy = Math.min(state.maxEnergy,state.energy+1); synergy = ' OVERRIDE synergy restored 1 energy.'; }
    }
    state.lastTag = card.tags[0] || null;
    log('Played ' + card.name + '.' + synergy);
    switch (id.replace('+','')) {
      case 'strike': case 'heavy': case 'ice': case 'siphon':
        let damage = card.power;
        if (id.startsWith('ice') && state.enemy.shield > 0) damage += 5;
        dealDamage(damage,card.name);
        if (id.startsWith('siphon') && state.enemy && state.enemy.hp <= 0) state.credits += id.endsWith('+') ? 6 : 4;
        break;
      case 'guard': case 'fortify': state.block += card.power; break;
      case 'exploit': state.enemy.exposed = Math.max(state.enemy.exposed,2); dealDamage(card.power,card.name); break;
      case 'overclock': state.energy = Math.min(state.maxEnergy,state.energy+card.power); drawCards(1); break;
      case 'trace': dealDamage(card.power,card.name); state.trace = Math.max(0,state.trace-(id.endsWith('+')?2:1)); break;
      case 'reboot': state.hp = Math.min(state.maxHp,state.hp+card.power); break;
      case 'suppress': state.enemy.weak = Math.max(state.enemy.weak,id.endsWith('+')?2:1); dealDamage(card.power,card.name); break;
      case 'purge': state.trace = Math.max(0,state.trace-(id.endsWith('+')?3:2)); state.block += card.power; break;
    }
    updateHud(); renderHand(); renderEnemy();
  }

  function endTurn() {
    if (!battleOpen || !state.enemy || state.enemy.hp <= 0) return;
    state.discard.push(...state.hand); state.hand = [];
    const intent = currentIntent();
    if (intent.action === 'attack') {
      const damage = Math.max(0,intent.amount - (state.enemy.weak > 0 ? 4 : 0));
      const absorbed = Math.min(state.block,damage); state.block -= absorbed;
      state.hp = Math.max(0,state.hp-(damage-absorbed));
      log(state.enemy.name + ' attacks for ' + damage + '. Guard absorbed ' + absorbed + '.');
      tone(130,0.16,'square');
    } else if (intent.action === 'shield') {
      state.enemy.shield += intent.amount; log(state.enemy.name + ' raises ' + intent.amount + ' shield.'); tone(320,0.13);
    } else if (intent.action === 'trace') {
      state.trace += intent.amount; log('Trace rises to ' + state.trace + ' / 3.');
      if (state.trace >= 3) { state.trace = 0; state.hp = Math.max(0,state.hp-9); log('TRACE BREACH! 9 integrity lost.'); tone(95,0.35,'sawtooth'); }
    }
    state.intentIndex++; state.turns++; state.block = 0;
    if (state.enemy.weak > 0) state.enemy.weak--;
    if (state.enemy.exposed > 0) state.enemy.exposed--;
    if (state.hp <= 0) { finishRun(false); return; }
    startTurn(false); updateHud(); renderEnemy();
  }

  function enemyDefeated() {
    if (!battleOpen) return;
    battleOpen = false; state.hand = []; state.block = 0;
    const reward = state.node.type === 'boss' ? 20 : state.node.type === 'elite' ? 18 : 9;
    state.credits += reward; log(state.enemy.name + ' purged. +' + reward + ' credits.');
    updateHud(); tone(740,0.24); setTimeout(() => tone(990,0.25),110);
    if (state.node.type === 'boss') { sectorCleared(); return; }
    showCardReward();
  }

  function showCardReward() {
    ui.choiceEyebrow.textContent = state.node.type === 'elite' ? 'ELITE DATA EXTRACTION' : 'PROTOCOL REWARD';
    ui.choiceTitle.textContent = 'Add a command to your deck';
    ui.choiceCopy.textContent = 'Choose one card. Stronger protocols can change your next encounter.';
    ui.choices.textContent = '';
    const picks = shuffle(REWARD_POOL.slice()).slice(0,3);
    picks.forEach(id => {
      const card = CARD[id]; const button = document.createElement('button'); button.type = 'button'; button.className = 'reward-card';
      const name = document.createElement('strong'); name.textContent = card.name;
      const type = document.createElement('small'); type.className = 'reward-tag'; type.textContent = card.tags.join(' / ') + ' · ' + card.cost + ' ENERGY';
      const desc = document.createElement('small'); desc.textContent = card.text;
      button.append(name,type,desc); button.addEventListener('click', () => { state.deck.push(id); unlockCard(id); log(card.name + ' added to deck.'); ui.choice.classList.remove('visible'); advanceNode(); });
      ui.choices.appendChild(button);
    });
    ui.choiceSkip.hidden = false; ui.choiceSkip.textContent = 'SKIP REWARD'; ui.choice.classList.add('visible');
  }

  function sectorCleared() {
    if (state.sector === 2) { finishRun(true); return; }
    ui.choiceEyebrow.textContent = 'SECTOR ' + (state.sector + 1) + ' BREACHED';
    ui.choiceTitle.textContent = 'Prepare for the next layer';
    ui.choiceCopy.textContent = 'The mainframe is deeper in the network. Choose a protocol to carry forward.';
    ui.choices.textContent = '';
    shuffle(REWARD_POOL.slice()).slice(0,3).forEach(id => {
      const card = CARD[id]; addOption(card.name,card.text,card.tags.join(' / '),() => {
        state.deck.push(id); unlockCard(id); state.sector++; state.step = 0; state.hp = Math.min(state.maxHp,state.hp+12);
        state.node = null; ui.choice.classList.remove('visible'); log('Integrity restored by 12 during sector transfer.'); showMap();
      });
    });
    ui.choiceSkip.hidden = true; ui.choice.classList.add('visible');
  }

  function advanceNode() {
    ui.choice.classList.remove('visible');
    state.step++;
    if (state.step > 4) { state.step = 4; }
    updateHud(); showMap();
  }

  function finishRun(victory) {
    battleOpen = false; state.runEnded = true; hideAllOverlays();
    const reached = state.sector + (victory ? 1 : 1);
    bestSector = Math.max(bestSector,reached);
    if (victory) runRecords.completed++;
    if (!runRecords.bestTurns || state.turns > runRecords.bestTurns) runRecords.bestTurns = state.turns;
    const bestTag = Object.entries(state.tagCounts).sort((a,b)=>b[1]-a[1])[0];
    if (bestTag && bestTag[1] > 0) runRecords.bestSynergy = bestTag[0] + ' (' + bestTag[1] + ' cards)';
    try { localStorage.setItem('protocol_rogue_best_sector',String(bestSector)); localStorage.setItem('protocol_rogue_records',JSON.stringify(runRecords)); } catch (_) {}
    $('record').textContent = String(bestSector); $('start-record').textContent = String(bestSector);
    $('runs-record').textContent = String(runRecords.completed);
    ui.endEyebrow.textContent = victory ? 'NETWORK BREACHED' : 'RUN TERMINATED';
    ui.endTitle.textContent = victory ? 'MAINFRAME PURGED' : 'CONNECTION LOST';
    ui.endCopy.textContent = (victory ? 'All three sectors cleared.' : 'You reached sector ' + (state.sector+1) + '.') + ' Turns: ' + state.turns + ' · Cards played: ' + state.cardsPlayed + ' · Best synergy: ' + (bestTag && bestTag[1] ? bestTag[0] : 'None') + '. Runs completed: ' + runRecords.completed + '.';
    ui.end.classList.add('visible'); updateHud();
  }

  function updateHud() {
    if (!state) return;
    ui.sector.textContent = String(state.sector+1).padStart(2,'0') + ' / ' + SECTOR_NAMES[state.sector];
    ui.node.textContent = String(Math.min(state.step+1,5)).padStart(2,'0') + ' / 05';
    ui.hp.textContent = state.hp + ' / ' + state.maxHp; ui.hpSmall.textContent = state.hp + ' / ' + state.maxHp;
    ui.hp.style.color = state.hp <= 20 ? '#ff637d' : '#67ffb2';
    ui.credits.textContent = String(state.credits); ui.block.textContent = String(state.block);
    ui.energy.textContent = state.energy + ' / ' + state.maxEnergy;
    ui.pips.textContent = '';
    for (let i=0;i<state.maxEnergy;i++){const pip=document.createElement('i');pip.className='energy-pip'+(i<state.energy?' full':'');ui.pips.appendChild(pip);}
    ui.trace.textContent = state.trace + ' / 3'; ui.playerStatus.textContent = state.weak > 0 ? 'Attacks weakened' : 'No active status';
    ui.draw.textContent=String(state.draw.length);ui.discard.textContent=String(state.discard.length);ui.exile.textContent=String(state.exhaust.length);
    updateTrack();
  }

  function renderEnemy() {
    if (!state || !state.enemy) return;
    const enemy = state.enemy; const intent = currentIntent();
    ui.enemyName.textContent = enemy.name; ui.enemyHp.textContent = enemy.hp + ' / ' + enemy.maxHp;
    ui.enemyBar.style.width = Math.max(0,enemy.hp/enemy.maxHp*100)+'%';
    ui.enemyShield.textContent = enemy.shield > 0 ? 'SHIELD ' + enemy.shield : '';
    const statuses=[]; if(enemy.exposed)statuses.push('EXPOSED');if(enemy.weak)statuses.push('WEAKENED');
    ui.enemyStatus.textContent=statuses.length?statuses.join(' · '):'No status effects';
    ui.intentText.textContent=intentLabel(intent);
    ui.intent.classList.toggle('intent-attack',intent.action==='attack');
    ui.intent.classList.toggle('intent-trace',intent.action==='trace');
    ui.intent.classList.toggle('intent-shield',intent.action==='shield');
    $('enemy-art').classList.toggle('elite-art',!!enemy.elite);$('enemy-art').classList.toggle('boss-art',!!enemy.boss);
  }

  function renderHand() {
    ui.hand.textContent=''; ui.handCount.textContent=state.hand.length+' CARDS';
    state.hand.forEach((id,index)=>{
      const card=CARD[id];const button=document.createElement('button');button.type='button';button.className='command-card '+card.type;
      button.disabled=!battleOpen||state.energy<card.cost;
      const cost=document.createElement('i');cost.className='cost';cost.textContent=String(card.cost);
      const title=document.createElement('strong');title.textContent=card.name;
      const desc=document.createElement('p');desc.textContent=card.text;
      const tags=document.createElement('span');tags.className='tags';tags.textContent=card.tags.join(' / ');
      button.append(cost,title,desc,tags);button.addEventListener('click',()=>playCard(index));ui.hand.appendChild(button);
    });
  }

  function showDeck() {
    ui.deckList.textContent='';
    const counts={};state.deck.forEach(id=>counts[id]=(counts[id]||0)+1);
    Object.entries(counts).forEach(([id,count])=>{
      const row=document.createElement('div');row.className='deck-row';
      const name=document.createElement('b');name.textContent=CARD[id].name;
      const detail=document.createElement('span');detail.textContent=count+' × · '+CARD[id].cost+' energy · '+CARD[id].text;
      row.append(name,detail);ui.deckList.appendChild(row);
    });
    ui.deck.classList.add('visible');
  }

  $('start-run').addEventListener('click',newRun);
  $('new-run').addEventListener('click',()=>{ui.end.classList.remove('visible');ui.start.classList.add('visible');});
  $('end-turn').addEventListener('click',endTurn);
  $('deck-button').addEventListener('click',showDeck);
  $('deck-close').addEventListener('click',()=>ui.deck.classList.remove('visible'));
  $('choice-skip').addEventListener('click',()=>{
    if (ui.choiceSkip.textContent==='CANCEL') { ui.choice.classList.remove('visible'); if (choiceBack) choiceBack(); return; }
    ui.choice.classList.remove('visible'); if(state.node.type==='market'||state.node.type==='cache')advanceNode();else advanceNode();
  });
  $('sound').addEventListener('click',event=>{
    muted=!muted;event.currentTarget.textContent=muted?'SOUND OFF':'SOUND ON';
    try{localStorage.setItem('protocol_rogue_muted',String(muted));}catch(_){}
    if(!muted)audioStart();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&battleOpen&&!ui.deck.classList.contains('visible')){event.preventDefault();endTurn();}
    if(event.key==='Escape'){ui.deck.classList.remove('visible');}
  });
  window.addEventListener('ARCADEVERSE_TEARDOWN',()=>{
    teardown=true; battleOpen=false; clearTimeout(toastTimer);
    if(audio&&audio.state!=='closed')audio.close();
  });

  const uiStyle=document.createElement('style');
  uiStyle.textContent='.rogue-toast{position:fixed;z-index:8;bottom:18px;left:50%;transform:translate(-50%,12px);opacity:0;padding:10px 14px;border:1px solid #6c5631;background:#211b10;color:#ffd078;font-size:11px;pointer-events:none;transition:.18s}.rogue-toast.show{opacity:1;transform:translate(-50%,0)}.intent-attack{border-color:#6b3541!important}.intent-trace{border-color:#72572d!important;color:#ffd078!important}.intent-shield{border-color:#315f76!important;color:#8edfff!important}.elite-art .core{background:radial-gradient(circle at 35% 32%,#ffe09b,#e3764c 42%,#301920 76%);border-color:#ffab73}.boss-art .core{width:72px;height:72px;background:radial-gradient(circle at 35% 30%,#ffb1c3,#cb3157 42%,#240d1b 76%);border-color:#ff789c;box-shadow:0 0 42px #ff3d6d88}.boss-art .core-ring{border-color:#89445c}';
  document.head.appendChild(uiStyle);

  if (!teardown) updateHud();
}());
