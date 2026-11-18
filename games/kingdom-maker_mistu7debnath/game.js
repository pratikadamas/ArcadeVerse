/* ============================================================
   KINGDOM MAKER — game.js
   Vanilla HTML5 Canvas & JS Medieval Strategy Simulator
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS & GAME DATA
// ============================================================
const SAVE_KEY = 'kingdomMaker_save';

const GRID_SIZE = 24; // 24x24 tiles
const TILE_SIZE = 48; // Base tile size in pixels

// Building Catalog
const BUILDING_TYPES = {
  // RESIDENTIAL
  small_house: {
    id: 'small_house',
    name: 'Small House',
    category: 'residential',
    stageReq: 1,
    desc: 'A humble thatched cottage that shelters 4 settlers.',
    cost: { wood: 20, stone: 10, food: 0, gold: 0 },
    housing: 4,
    production: {},
    color: '#9a531e',
    roofColor: '#b45309',
    svgIcon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
  },
  large_house: {
    id: 'large_house',
    name: 'Large House',
    category: 'residential',
    stageReq: 2,
    desc: 'A sturdy timber-framed dwelling accommodating 10 citizens.',
    cost: { wood: 50, stone: 30, food: 0, gold: 10 },
    housing: 10,
    production: {},
    color: '#78350f',
    roofColor: '#dc2626',
    svgIcon: '<path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><rect x="7" y="13" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/>'
  },
  village_residence: {
    id: 'village_residence',
    name: 'Manor Residence',
    category: 'residential',
    stageReq: 4,
    desc: 'A grand stone estate housing 22 prosperous citizens.',
    cost: { wood: 100, stone: 80, food: 0, gold: 40 },
    housing: 22,
    production: { gold: 2 },
    color: '#475569',
    roofColor: '#7c3aed',
    svgIcon: '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/><circle cx="12" cy="9" r="2"/>'
  },

  // PRODUCTION
  farm: {
    id: 'farm',
    name: 'Wheat Farm',
    category: 'production',
    stageReq: 1,
    desc: 'Golden grain fields that produce +4 Food per second.',
    cost: { wood: 25, stone: 0, food: 0, gold: 5 },
    housing: 0,
    production: { food: 4 },
    color: '#ca8a04',
    roofColor: '#eab308',
    svgIcon: '<path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12A10 10 0 0 1 12 2z"/><path d="M12 6v12M8 10l8 4M8 14l8-4"/>'
  },
  sawmill: {
    id: 'sawmill',
    name: 'Sawmill',
    category: 'production',
    stageReq: 2,
    desc: 'Processes lumber from surrounding forests. Yields +3 Wood per second.',
    cost: { wood: 30, stone: 15, food: 0, gold: 0 },
    housing: 0,
    production: { wood: 3 },
    color: '#854d0e',
    roofColor: '#5c330a',
    svgIcon: '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>'
  },
  quarry: {
    id: 'quarry',
    name: 'Stone Quarry',
    category: 'production',
    stageReq: 2,
    desc: 'Excavates solid rock blocks. Generates +3 Stone per second.',
    cost: { wood: 40, stone: 0, food: 0, gold: 10 },
    housing: 0,
    production: { stone: 3 },
    color: '#475569',
    roofColor: '#64748b',
    svgIcon: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>'
  },
  mine: {
    id: 'mine',
    name: 'Deep Mine',
    category: 'production',
    stageReq: 3,
    desc: 'Extracts precious ore and minerals: +2 Stone & +2 Gold per second.',
    cost: { wood: 60, stone: 40, food: 0, gold: 20 },
    housing: 0,
    production: { stone: 2, gold: 2 },
    color: '#334155',
    roofColor: '#1e293b',
    svgIcon: '<path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"/><path d="M15 13 9 7l4-4 6 6-4 4Z"/>'
  },

  // COMMERCIAL
  market: {
    id: 'market',
    name: 'Village Market',
    category: 'commercial',
    stageReq: 2,
    desc: 'Busy market stalls trading goods. Yields +4 Gold per second.',
    cost: { wood: 50, stone: 35, food: 0, gold: 0 },
    housing: 0,
    production: { gold: 4 },
    color: '#b45309',
    roofColor: '#f59e0b',
    svgIcon: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>'
  },
  trading_post: {
    id: 'trading_post',
    name: 'Trading Post',
    category: 'commercial',
    stageReq: 3,
    desc: 'Hub for international merchants: +8 Gold per second.',
    cost: { wood: 80, stone: 60, food: 0, gold: 30 },
    housing: 0,
    production: { gold: 8 },
    color: '#713f12',
    roofColor: '#0284c7',
    svgIcon: '<circle cx="12" cy="12" r="10"/><path d="m16 8-8 8"/><path d="M8 8h8v8"/>'
  },

  // SPECIAL & ROYAL
  town_hall: {
    id: 'town_hall',
    name: 'Town Hall',
    category: 'special',
    stageReq: 3,
    desc: 'The administrative heart of the settlement. Boosts overall production by +15%.',
    cost: { wood: 75, stone: 50, food: 0, gold: 40 },
    housing: 6,
    production: { gold: 3 },
    color: '#1e293b',
    roofColor: '#b91c1c',
    svgIcon: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>'
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    category: 'special',
    stageReq: 4,
    desc: 'Guards borders and maintains royal security. Generates +2 Gold.',
    cost: { wood: 45, stone: 45, food: 0, gold: 15 },
    housing: 2,
    production: { gold: 2 },
    color: '#334155',
    roofColor: '#475569',
    svgIcon: '<path d="M12 2v20M5 5l14 14M19 5 5 19"/><circle cx="12" cy="12" r="9"/>'
  },
  castle: {
    id: 'castle',
    name: 'Royal Castle',
    category: 'special',
    stageReq: 5,
    desc: 'Majestic fortress of the monarch: +25 Gold per second and +35 Housing.',
    cost: { wood: 200, stone: 200, food: 0, gold: 150 },
    housing: 35,
    production: { gold: 25 },
    color: '#0f172a',
    roofColor: '#d97706',
    svgIcon: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>'
  }
};

// 5 Development Stages
const STAGES = [
  {
    id: 1,
    name: 'Small Settlement',
    title: 'Stage 1 — Small Settlement',
    desc: 'Construct a Small House and a Wheat Farm, and grow your population to 4.',
    goals: [
      { id: 'house_1', label: 'Construct 1 Small House', check: s => s.buildings.some(b => b.type === 'small_house') },
      { id: 'farm_1', label: 'Construct 1 Wheat Farm', check: s => s.buildings.some(b => b.type === 'farm') },
      { id: 'pop_4', label: 'Reach 4 Population', check: s => s.population >= 4 }
    ],
    rewards: { wood: 60, stone: 40, gold: 25, unlocks: ['Sawmill', 'Quarry', 'Village Market'] }
  },
  {
    id: 2,
    name: 'Growing Village',
    title: 'Stage 2 — Growing Village',
    desc: 'Build a Sawmill and Quarry, reach 12 Population, and stockpile 80 Wood & 60 Stone.',
    goals: [
      { id: 'sawmill_1', label: 'Construct 1 Sawmill', check: s => s.buildings.some(b => b.type === 'sawmill') },
      { id: 'quarry_1', label: 'Construct 1 Quarry', check: s => s.buildings.some(b => b.type === 'quarry') },
      { id: 'pop_12', label: 'Reach 12 Population', check: s => s.population >= 12 },
      { id: 'stock_wood_stone', label: 'Stockpile 80 Wood & 60 Stone', check: s => s.resources.wood >= 80 && s.resources.stone >= 60 }
    ],
    rewards: { gold: 80, wood: 40, stone: 40, unlocks: ['Large House', 'Trading Post', 'Deep Mine'] }
  },
  {
    id: 3,
    name: 'Thriving Village',
    title: 'Stage 3 — Thriving Village',
    desc: 'Build a Village Market, purchase at least 1 Land Expansion, and reach 25 Population.',
    goals: [
      { id: 'market_1', label: 'Construct 1 Village Market', check: s => s.buildings.some(b => b.type === 'market') },
      { id: 'expand_1', label: 'Purchase 1 Land Expansion', check: s => s.unlockedPlots.length > 1 },
      { id: 'pop_25', label: 'Reach 25 Population', check: s => s.population >= 25 }
    ],
    rewards: { gold: 150, food: 100, unlocks: ['Town Hall', 'Watchtower'] }
  },
  {
    id: 4,
    name: 'Developing Town',
    title: 'Stage 4 — Developing Town',
    desc: 'Construct a Town Hall and Watchtower, reach 50 Population, and accumulate 300 Gold.',
    goals: [
      { id: 'town_hall_1', label: 'Construct Town Hall', check: s => s.buildings.some(b => b.type === 'town_hall') },
      { id: 'watchtower_1', label: 'Construct 1 Watchtower', check: s => s.buildings.some(b => b.type === 'watchtower') },
      { id: 'pop_50', label: 'Reach 50 Population', check: s => s.population >= 50 },
      { id: 'gold_300', label: 'Accumulate 300 Gold', check: s => s.resources.gold >= 300 }
    ],
    rewards: { wood: 200, stone: 200, gold: 200, unlocks: ['Royal Castle', 'Manor Residence'] }
  },
  {
    id: 5,
    name: 'Royal Kingdom',
    title: 'Stage 5 — Royal Kingdom',
    desc: 'Erect the majestic Royal Castle, reach 80 Citizens, and stockpile 500 Gold!',
    goals: [
      { id: 'castle_1', label: 'Erect the Royal Castle', check: s => s.buildings.some(b => b.type === 'castle') },
      { id: 'pop_80', label: 'Reach 80 Population', check: s => s.population >= 80 },
      { id: 'gold_500', label: 'Stockpile 500 Gold', check: s => s.resources.gold >= 500 }
    ],
    rewards: { gold: 1000, title: 'Grand Sovereign of the Realm!' }
  }
];

// Land Expansion Plots
const EXPANSION_PLOTS = [
  { id: 'core', name: 'Valley Clearing (Core)', x1: 7, x2: 16, y1: 7, y2: 16, cost: null, popReq: 0 },
  { id: 'east', name: 'Eastern Meadow Ridge', x1: 17, x2: 23, y1: 7, y2: 16, cost: { wood: 50, stone: 30, gold: 40 }, popReq: 10 },
  { id: 'west', name: 'Western Riverbank Meadows', x1: 0, x2: 6, y1: 7, y2: 16, cost: { wood: 80, stone: 60, gold: 70 }, popReq: 20 },
  { id: 'north', name: 'Northern Highland Woods', x1: 0, x2: 23, y1: 0, y2: 6, cost: { wood: 150, stone: 120, gold: 120 }, popReq: 35 },
  { id: 'south', name: 'Southern Fertile Valleys', x1: 0, x2: 23, y1: 17, y2: 23, cost: { wood: 220, stone: 180, gold: 200 }, popReq: 50 }
];

// ============================================================
// GAME STATE
// ============================================================
const state = {
  resources: { wood: 90, stone: 60, food: 70, gold: 45 },
  rates: { wood: 0, stone: 0, food: 0, gold: 0 },
  population: 0,
  housingCap: 0,
  happiness: 'Content',
  currentStage: 1,
  completedStages: [],
  unlockedPlots: ['core'],
  buildings: [], // { id, type, x, y, level }
  
  // UI & Interaction
  activeCategory: 'residential',
  placingType: null,
  selectedBuilding: null,
  speed: 1,
  paused: false,
  gameStarted: false,
  
  // Camera & View
  camX: 0,
  camY: 0,
  zoom: 1.0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  
  // Floating animations
  floatTexts: [], // { text, x, y, color, life, maxLife }
  smokeParticles: [],
};

// Simulation tick handle
let simInterval = null;
let animFrameId = null;

// ============================================================
// INITIALIZATION & MAP SETUP
// ============================================================
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

// Terrain generation map
const terrain = [];
function generateTerrain() {
  for (let y = 0; y < GRID_SIZE; y++) {
    terrain[y] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      // Natural River running diagonally through West
      const isRiver = (x >= 4 && x <= 6 && y >= 2 && y <= 21);
      // Rock outcrop in North
      const isRock = (x >= 18 && x <= 21 && y >= 1 && y <= 4);
      // Forest clusters
      const isTree = ((x === 2 || x === 3) && (y >= 10 && y <= 14)) ||
                     ((x >= 20 && x <= 22) && (y >= 10 && y <= 15)) ||
                     ((x >= 10 && x <= 13) && (y <= 3));

      let type = 'grass';
      if (isRiver) type = 'water';
      else if (isRock) type = 'stone';
      else if (isTree) type = 'tree';

      terrain[y][x] = {
        type,
        variant: (x * 7 + y * 13) % 4
      };
    }
  }
}

function resizeCanvas() {
  const vp = document.getElementById('viewport');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = vp.clientWidth * dpr;
  canvas.height = vp.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
  // Center map initially if not positioned
  if (state.camX === 0 && state.camY === 0) {
    centerCamera();
  }
}

function centerCamera() {
  const vp = document.getElementById('viewport');
  const totalMapW = GRID_SIZE * TILE_SIZE;
  const totalMapH = GRID_SIZE * TILE_SIZE;
  state.camX = (vp.clientWidth - totalMapW * state.zoom) / 2;
  state.camY = (vp.clientHeight - totalMapH * state.zoom) / 2;
}

// ============================================================
// SAVE / LOAD
// ============================================================
function saveGame() {
  try {
    const data = {
      resources: state.resources,
      population: state.population,
      currentStage: state.currentStage,
      completedStages: state.completedStages,
      unlockedPlots: state.unlockedPlots,
      buildings: state.buildings
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Unable to persist game state:', err);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.resources) return false;

    state.resources = data.resources;
    state.population = data.population || 0;
    state.currentStage = data.currentStage || 1;
    state.completedStages = data.completedStages || [];
    state.unlockedPlots = data.unlockedPlots || ['core'];
    state.buildings = data.buildings || [];
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  state.resources = { wood: 90, stone: 60, food: 70, gold: 45 };
  state.rates = { wood: 0, stone: 0, food: 0, gold: 0 };
  state.population = 0;
  state.housingCap = 0;
  state.currentStage = 1;
  state.completedStages = [];
  state.unlockedPlots = ['core'];
  state.buildings = [];
  state.selectedBuilding = null;
  state.placingType = null;
  saveGame();
}

// ============================================================
// TILE & TERRITORY CHECKS
// ============================================================
function isTileUnlocked(x, y) {
  for (const plotId of state.unlockedPlots) {
    const plot = EXPANSION_PLOTS.find(p => p.id === plotId);
    if (plot && x >= plot.x1 && x <= plot.x2 && y >= plot.y1 && y <= plot.y2) {
      return true;
    }
  }
  return false;
}

function getBuildingAt(x, y) {
  return state.buildings.find(b => b.x === x && b.y === y);
}

function canBuildAt(x, y) {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
  if (!isTileUnlocked(x, y)) return false;
  const t = terrain[y][x].type;
  if (t === 'water' || t === 'stone') return false; // Cannot build on rivers or steep rocks
  if (getBuildingAt(x, y)) return false; // Occupied
  return true;
}

// ============================================================
// RESOURCE & SIMULATION LOGIC
// ============================================================
function updateRatesAndCapacity() {
  let woodRate = 0;
  let stoneRate = 0;
  let foodRate = 0;
  let goldRate = 0;
  let totalCap = 0;

  // Town Hall multiplier (+15% if built)
  const hasTownHall = state.buildings.some(b => b.type === 'town_hall');
  const mult = hasTownHall ? 1.15 : 1.0;

  for (const b of state.buildings) {
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;

    // Upgrades: Lvl 1 = 1x, Lvl 2 = 1.5x, Lvl 3 = 2.0x
    const lvlMultiplier = 1 + (b.level - 1) * 0.5;

    // Housing capacity
    if (def.housing) {
      totalCap += Math.round(def.housing * lvlMultiplier);
    }

    // Production
    if (def.production.wood) woodRate += def.production.wood * lvlMultiplier * mult;
    if (def.production.stone) stoneRate += def.production.stone * lvlMultiplier * mult;
    if (def.production.food) foodRate += def.production.food * lvlMultiplier * mult;
    if (def.production.gold) goldRate += def.production.gold * lvlMultiplier * mult;
  }

  // Food consumption: Citizens consume food (1 Food per 5 citizens per sec)
  const foodConsumption = state.population > 0 ? (state.population * 0.2) : 0;
  const netFoodRate = foodRate - foodConsumption;

  state.rates.wood = woodRate;
  state.rates.stone = stoneRate;
  state.rates.food = netFoodRate;
  state.rates.gold = goldRate;
  state.housingCap = totalCap;
}

let tickCounter = 0;
function simulationTick() {
  if (state.paused || !state.gameStarted) return;

  tickCounter++;
  updateRatesAndCapacity();

  // Accumulate production (per second tick)
  state.resources.wood = Math.max(0, state.resources.wood + state.rates.wood);
  state.resources.stone = Math.max(0, state.resources.stone + state.rates.stone);
  state.resources.food = Math.max(0, state.resources.food + state.rates.food);
  state.resources.gold = Math.max(0, state.resources.gold + state.rates.gold);

  // Population dynamics: every 3 ticks
  if (tickCounter % 3 === 0) {
    if (state.resources.food > 5 && state.population < state.housingCap) {
      state.population += 1;
      state.happiness = 'Thriving';
      addFloatingText('+1 Citizen!', canvas.width / (2 * window.devicePixelRatio), 80, '#3b82f6');
    } else if (state.resources.food <= 0 && state.population > 2) {
      // Small starvation risk if food totally depleted
      state.population = Math.max(0, state.population - 1);
      state.happiness = 'Starving';
    } else if (state.population >= state.housingCap) {
      state.happiness = 'Need Houses';
    } else {
      state.happiness = 'Content';
    }
  }

  // Check Quests/Stages
  checkStageProgression();

  // Update UI elements
  updateHUD();
  updateObjectiveWidget();
}

function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(() => {
    simulationTick();
  }, 1000 / state.speed);
}

// ============================================================
// BUILDING CONSTRUCTION & UPGRADES
// ============================================================
function hasResources(costs) {
  if (!costs) return true;
  for (const [res, amt] of Object.entries(costs)) {
    if (state.resources[res] < amt) return false;
  }
  return true;
}

function deductResources(costs) {
  for (const [res, amt] of Object.entries(costs)) {
    state.resources[res] = Math.max(0, state.resources[res] - amt);
  }
}

function constructBuilding(type, x, y) {
  const def = BUILDING_TYPES[type];
  if (!def) return false;

  if (!hasResources(def.cost)) {
    showToast('Insufficient materials to construct ' + def.name, 'error');
    return false;
  }

  if (!canBuildAt(x, y)) {
    showToast('Cannot build here! Choose empty valid grass within your kingdom.', 'error');
    return false;
  }

  // Deduct
  deductResources(def.cost);

  // Add building
  const newBuilding = {
    id: 'bld_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: type,
    x: x,
    y: y,
    level: 1
  };
  state.buildings.push(newBuilding);

  // Floating text feedback
  const screenPos = tileToScreen(x, y);
  addFloatingText(def.name + ' Built!', screenPos.x + TILE_SIZE / 2, screenPos.y, '#f59e0b');

  showToast(def.name + ' constructed successfully!', 'success');
  saveGame();
  updateRatesAndCapacity();
  updateHUD();
  checkStageProgression();
  return true;
}

function upgradeBuilding(building) {
  if (!building || building.level >= 3) return;
  const def = BUILDING_TYPES[building.type];
  const nextLvl = building.level + 1;

  // Upgrade costs: Level 2 = 60% of base, Level 3 = 120% of base
  const factor = nextLvl === 2 ? 0.6 : 1.2;
  const costs = {
    wood: Math.round(def.cost.wood * factor),
    stone: Math.round(def.cost.stone * factor),
    food: 0,
    gold: Math.round(def.cost.gold * factor)
  };

  if (!hasResources(costs)) {
    showToast('Insufficient resources for upgrade!', 'error');
    return;
  }

  deductResources(costs);
  building.level = nextLvl;

  const screenPos = tileToScreen(building.x, building.y);
  addFloatingText('Upgraded to Lvl ' + nextLvl + '!', screenPos.x + TILE_SIZE / 2, screenPos.y, '#22c55e');

  showToast(def.name + ' upgraded to Level ' + nextLvl + '!', 'success');
  saveGame();
  updateRatesAndCapacity();
  updateHUD();
  renderInspector(building);
}

function demolishBuilding(building) {
  if (!building) return;
  const def = BUILDING_TYPES[building.type];
  
  // Refund 40% of materials
  const refundWood = Math.round(def.cost.wood * 0.4);
  const refundStone = Math.round(def.cost.stone * 0.4);
  state.resources.wood += refundWood;
  state.resources.stone += refundStone;

  state.buildings = state.buildings.filter(b => b !== building);
  state.selectedBuilding = null;
  document.getElementById('building-inspector').classList.add('hidden');

  showToast('Demolished ' + def.name + '. Recovered ' + refundWood + ' Wood, ' + refundStone + ' Stone.', 'info');
  saveGame();
  updateRatesAndCapacity();
  updateHUD();
}

// ============================================================
// STAGE PROGRESSION & REWARDS
// ============================================================
function checkStageProgression() {
  const current = STAGES.find(s => s.id === state.currentStage);
  if (!current) return;

  const allGoalsMet = current.goals.every(g => g.check(state));
  if (allGoalsMet && !state.completedStages.includes(current.id)) {
    completeStage(current);
  }
}

function completeStage(stage) {
  state.completedStages.push(stage.id);

  // Grant rewards
  if (stage.rewards.wood) state.resources.wood += stage.rewards.wood;
  if (stage.rewards.stone) state.resources.stone += stage.rewards.stone;
  if (stage.rewards.food) state.resources.food += stage.rewards.food;
  if (stage.rewards.gold) state.resources.gold += stage.rewards.gold;

  // Advance stage
  if (state.currentStage < STAGES.length) {
    state.currentStage += 1;
  }

  // Emit telemetry to ArcadeVerse hub
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_SCORE',
        score: state.completedStages.length,
        details: { stageId: stage.id, stageTitle: stage.title, buildings: state.buildings.length }
      }, '*');
      if (state.completedStages.length >= STAGES.length) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_OVER',
          score: state.completedStages.length,
          details: { completed: true, stages: state.completedStages.length, population: state.population }
        }, '*');
      }
    }
  } catch (_) {}

  saveGame();
  showCelebrationModal(stage);
  updateHUD();
  updateObjectiveWidget();
}

function showCelebrationModal(stage) {
  document.getElementById('celeb-stage-title').textContent = 'Milestone Achieved!';
  document.getElementById('celeb-stage-name').textContent = stage.title;

  const rewardsBox = document.getElementById('celeb-rewards-content');
  rewardsBox.innerHTML = '';

  const resList = [];
  if (stage.rewards.wood) resList.push(`+${stage.rewards.wood} Wood`);
  if (stage.rewards.stone) resList.push(`+${stage.rewards.stone} Stone`);
  if (stage.rewards.food) resList.push(`+${stage.rewards.food} Food`);
  if (stage.rewards.gold) resList.push(`+${stage.rewards.gold} Gold`);

  const resLine = document.createElement('div');
  resLine.className = 'reward-line';
  resLine.textContent = 'Royal Tribute: ' + resList.join(', ');
  rewardsBox.appendChild(resLine);

  if (stage.rewards.unlocks) {
    const unlLine = document.createElement('div');
    unlLine.className = 'reward-line';
    unlLine.textContent = 'New Buildings Unlocked: ' + stage.rewards.unlocks.join(', ');
    rewardsBox.appendChild(unlLine);
  }

  document.getElementById('modal-stage-celebration').classList.remove('hidden');
}

// ============================================================
// CANVAS RENDERING
// ============================================================
function tileToScreen(tx, ty) {
  return {
    x: state.camX + tx * TILE_SIZE * state.zoom,
    y: state.camY + ty * TILE_SIZE * state.zoom
  };
}

function screenToTile(sx, sy) {
  return {
    tx: Math.floor((sx - state.camX) / (TILE_SIZE * state.zoom)),
    ty: Math.floor((sy - state.camY) / (TILE_SIZE * state.zoom))
  };
}

let hoverTile = null;

function renderMap() {
  const vp = document.getElementById('viewport');
  ctx.clearRect(0, 0, vp.clientWidth, vp.clientHeight);

  const curTileSize = TILE_SIZE * state.zoom;

  // 1. Render Terrain Tiles
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const sx = state.camX + x * curTileSize;
      const sy = state.camY + y * curTileSize;

      // Frustum culling
      if (sx + curTileSize < 0 || sx > vp.clientWidth || sy + curTileSize < 0 || sy > vp.clientHeight) {
        continue;
      }

      const unlocked = isTileUnlocked(x, y);
      const t = terrain[y][x];

      // Base fill
      if (!unlocked) {
        // Shaded parchment fog of war
        ctx.fillStyle = '#1c1815';
        ctx.fillRect(sx, sy, curTileSize, curTileSize);
        ctx.strokeStyle = '#2d251f';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, curTileSize, curTileSize);
        continue;
      }

      if (t.type === 'water') {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(sx, sy, curTileSize, curTileSize);
        // Water ripples
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(sx + 8 * state.zoom, sy + (12 + (x % 3) * 6) * state.zoom, 14 * state.zoom, 2 * state.zoom);
      } else if (t.type === 'stone') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx, sy, curTileSize, curTileSize);
        // Boulder highlights
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(sx + curTileSize / 2, sy + curTileSize / 2, curTileSize / 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Lush Grass
        const grassColors = ['#2e7039', '#2b6935', '#327a3e', '#276231'];
        ctx.fillStyle = grassColors[t.variant];
        ctx.fillRect(sx, sy, curTileSize, curTileSize);

        // Flower/dirt specks
        if (t.variant === 2) {
          ctx.fillStyle = '#fde047';
          ctx.fillRect(sx + 10 * state.zoom, sy + 14 * state.zoom, 2 * state.zoom, 2 * state.zoom);
        }

        // Natural trees on empty tiles
        if (t.type === 'tree' && !getBuildingAt(x, y)) {
          drawNatureTree(sx, sy, curTileSize);
        }
      }

      // Tile grid border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, curTileSize, curTileSize);
    }
  }

  // 2. Render Placed Buildings
  for (const b of state.buildings) {
    const sx = state.camX + b.x * curTileSize;
    const sy = state.camY + b.y * curTileSize;
    drawBuilding(b, sx, sy, curTileSize);
  }

  // 3. Render Hover & Placement Preview
  if (hoverTile && hoverTile.tx >= 0 && hoverTile.tx < GRID_SIZE && hoverTile.ty >= 0 && hoverTile.ty < GRID_SIZE) {
    const hx = state.camX + hoverTile.tx * curTileSize;
    const hy = state.camY + hoverTile.ty * curTileSize;

    if (state.placingType) {
      const valid = canBuildAt(hoverTile.tx, hoverTile.ty) && hasResources(BUILDING_TYPES[state.placingType].cost);
      ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(hx, hy, curTileSize, curTileSize);
      ctx.strokeStyle = valid ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, curTileSize, curTileSize);

      // Ghost building preview
      const def = BUILDING_TYPES[state.placingType];
      ctx.globalAlpha = 0.6;
      drawBuilding({ type: state.placingType, level: 1 }, hx, hy, curTileSize);
      ctx.globalAlpha = 1.0;
    } else {
      // General hover highlight
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx, hy, curTileSize, curTileSize);
    }
  }

  // 4. Render Selected Building Ring
  if (state.selectedBuilding) {
    const sx = state.camX + state.selectedBuilding.x * curTileSize;
    const sy = state.camY + state.selectedBuilding.y * curTileSize;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, curTileSize, curTileSize);
  }

  // 5. Floating Text Animations
  state.floatTexts = state.floatTexts.filter(ft => ft.life < ft.maxLife);
  for (const ft of state.floatTexts) {
    ft.life++;
    ft.y -= 0.6;
    const alpha = 1 - ft.life / ft.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = ft.color;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  animFrameId = requestAnimationFrame(renderMap);
}

function drawNatureTree(sx, sy, size) {
  const cx = sx + size / 2;
  const cy = sy + size / 2;
  // Trunk
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 2 * state.zoom, cy, 4 * state.zoom, 8 * state.zoom);
  // Foliage
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.arc(cx, cy - 2 * state.zoom, 9 * state.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx - 2 * state.zoom, cy - 4 * state.zoom, 5 * state.zoom, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(b, sx, sy, size) {
  const def = BUILDING_TYPES[b.type];
  if (!def) return;

  const pad = 4 * state.zoom;
  const bx = sx + pad;
  const by = sy + pad;
  const bw = size - pad * 2;
  const bh = size - pad * 2;

  // Building Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(bx + 4 * state.zoom, by + 4 * state.zoom, bw, bh);

  // Base Walls
  ctx.fillStyle = def.color;
  ctx.fillRect(bx, by + bh * 0.35, bw, bh * 0.65);

  // Roof Structure
  ctx.fillStyle = def.roofColor;
  ctx.beginPath();
  ctx.moveTo(bx - 2 * state.zoom, by + bh * 0.35);
  ctx.lineTo(bx + bw / 2, by);
  ctx.lineTo(bx + bw + 2 * state.zoom, by + bh * 0.35);
  ctx.closePath();
  ctx.fill();

  // Chimney & Window Details
  ctx.fillStyle = '#1e1b18';
  ctx.fillRect(bx + bw * 0.4, by + bh * 0.65, bw * 0.2, bh * 0.35); // Door
  ctx.fillStyle = '#fde047';
  ctx.fillRect(bx + bw * 0.15, by + bh * 0.5, bw * 0.18, bh * 0.18); // Left window

  // Special structures visuals
  if (b.type === 'castle') {
    // Castle Turrets
    ctx.fillStyle = '#334155';
    ctx.fillRect(bx, by, bw * 0.22, bh * 0.5);
    ctx.fillRect(bx + bw * 0.78, by, bw * 0.22, bh * 0.5);
    // Golden Crown Flag
    ctx.fillStyle = '#d97706';
    ctx.fillRect(bx + bw / 2 - 1 * state.zoom, by - 6 * state.zoom, 2 * state.zoom, 8 * state.zoom);
    ctx.beginPath();
    ctx.moveTo(bx + bw / 2 + 1 * state.zoom, by - 6 * state.zoom);
    ctx.lineTo(bx + bw / 2 + 8 * state.zoom, by - 3 * state.zoom);
    ctx.lineTo(bx + bw / 2 + 1 * state.zoom, by);
    ctx.closePath();
    ctx.fill();
  } else if (b.type === 'farm') {
    // Grain stripes
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bx + 2 * state.zoom, by + bh * 0.45, bw - 4 * state.zoom, 3 * state.zoom);
  }

  // Level Badge indicator
  if (b.level && b.level > 1) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold ' + (10 * state.zoom) + 'px sans-serif';
    const lvlText = b.level === 3 ? 'Lv3' : 'Lv2';
    ctx.fillText(lvlText, bx + 2 * state.zoom, by + bh - 2 * state.zoom);
  }
}

function addFloatingText(text, x, y, color) {
  state.floatTexts.push({
    text: text,
    x: x,
    y: y,
    color: color || '#f59e0b',
    life: 0,
    maxLife: 45
  });
}

// ============================================================
// UI RENDERING & DOM UPDATES
// ============================================================
function updateHUD() {
  document.getElementById('res-wood').textContent = Math.floor(state.resources.wood);
  document.getElementById('res-stone').textContent = Math.floor(state.resources.stone);
  document.getElementById('res-food').textContent = Math.floor(state.resources.food);
  document.getElementById('res-gold').textContent = Math.floor(state.resources.gold);

  document.getElementById('rate-wood').textContent = `+${state.rates.wood.toFixed(1)}/s`;
  document.getElementById('rate-stone').textContent = `+${state.rates.stone.toFixed(1)}/s`;
  
  const fRate = state.rates.food;
  const fElem = document.getElementById('rate-food');
  fElem.textContent = `${fRate >= 0 ? '+' : ''}${fRate.toFixed(1)}/s`;
  fElem.className = 'res-rate' + (fRate < 0 ? ' negative' : '');

  document.getElementById('rate-gold').textContent = `+${state.rates.gold.toFixed(1)}/s`;

  document.getElementById('res-pop').textContent = state.population;
  document.getElementById('res-pop-cap').textContent = state.housingCap;
  document.getElementById('pop-status').textContent = state.happiness;

  const stage = STAGES.find(s => s.id === state.currentStage) || STAGES[0];
  document.getElementById('hud-stage-name').textContent = stage.title;
}

function updateObjectiveWidget() {
  const stage = STAGES.find(s => s.id === state.currentStage) || STAGES[STAGES.length - 1];
  document.getElementById('obj-current-title').textContent = stage.title;
  document.getElementById('obj-current-desc').textContent = stage.desc;

  const total = stage.goals.length;
  const completed = stage.goals.filter(g => g.check(state)).length;
  const pct = Math.round((completed / total) * 100);
  document.getElementById('obj-progress-fill').style.width = pct + '%';
}

function renderToolbarCards() {
  const container = document.getElementById('building-cards-container');
  container.innerHTML = '';

  const catBuildings = Object.values(BUILDING_TYPES).filter(b => b.category === state.activeCategory);

  for (const b of catBuildings) {
    const isLocked = state.currentStage < b.stageReq;
    const canAfford = hasResources(b.cost);
    const isPlacing = state.placingType === b.id;

    const card = document.createElement('div');
    card.className = `building-card ${isLocked ? 'locked' : ''} ${isPlacing ? 'active-placement' : ''}`;
    
    // Cost chips
    let costHtml = '';
    for (const [res, amt] of Object.entries(b.cost)) {
      if (amt > 0) {
        const aff = state.resources[res] >= amt;
        costHtml += `<span class="mini-cost ${aff ? '' : 'insufficient'}">${amt} ${res[0].toUpperCase() + res.slice(1)}</span>`;
      }
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-icon" style="color: ${b.roofColor};">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${b.svgIcon}
          </svg>
        </div>
        <div class="card-name">${b.name}</div>
      </div>
      <div class="card-effect">${isLocked ? 'Unlocks in Stage ' + b.stageReq : (b.housing ? `+${b.housing} Housing` : getYieldDesc(b.production))}</div>
      <div class="card-costs">${isLocked ? '<span class="mini-cost">Locked</span>' : costHtml}</div>
    `;

    if (!isLocked) {
      card.addEventListener('click', () => {
        if (state.placingType === b.id) {
          exitPlacementMode();
        } else {
          enterPlacementMode(b.id);
        }
      });
    }

    container.appendChild(card);
  }
}

function getYieldDesc(prod) {
  if (!prod) return 'Special';
  const parts = [];
  for (const [r, amt] of Object.entries(prod)) {
    parts.push(`+${amt} ${r[0].toUpperCase() + r.slice(1)}/s`);
  }
  return parts.join(', ') || 'Utility';
}

function enterPlacementMode(type) {
  state.placingType = type;
  state.selectedBuilding = null;
  document.getElementById('building-inspector').classList.add('hidden');
  
  const def = BUILDING_TYPES[type];
  document.getElementById('hint-building-name').textContent = def.name;
  document.getElementById('placement-hint-bar').classList.remove('hidden');
  canvas.classList.add('placing-mode');
  renderToolbarCards();
}

function exitPlacementMode() {
  state.placingType = null;
  document.getElementById('placement-hint-bar').classList.add('hidden');
  canvas.classList.remove('placing-mode');
  renderToolbarCards();
}

function renderInspector(building) {
  if (!building) return;
  state.selectedBuilding = building;
  const def = BUILDING_TYPES[building.type];
  const insp = document.getElementById('building-inspector');

  document.getElementById('insp-name').textContent = def.name;
  document.getElementById('insp-level').textContent = `Level ${building.level} ${building.level === 3 ? '(Max)' : ''}`;
  document.getElementById('insp-desc').textContent = def.desc;
  document.getElementById('insp-coords').textContent = `(X: ${building.x}, Y: ${building.y})`;

  const effectText = def.housing 
    ? `+${Math.round(def.housing * (1 + (building.level - 1) * 0.5))} Housing Capacity`
    : getYieldDesc(def.production);
  document.getElementById('insp-effect').textContent = effectText;

  document.getElementById('insp-icon').innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${def.roofColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${def.svgIcon}
    </svg>
  `;

  // Upgrade section
  const upBox = document.getElementById('insp-upgrade-box');
  if (building.level >= 3) {
    upBox.style.display = 'none';
  } else {
    upBox.style.display = 'flex';
    const nextLvl = building.level + 1;
    document.getElementById('insp-next-lvl').textContent = nextLvl;
    document.getElementById('insp-upgrade-perk').textContent = nextLvl === 2 ? '+50% Efficiency' : '+100% Efficiency';

    const factor = nextLvl === 2 ? 0.6 : 1.2;
    const costs = {
      wood: Math.round(def.cost.wood * factor),
      stone: Math.round(def.cost.stone * factor),
      gold: Math.round(def.cost.gold * factor)
    };

    const costWrap = document.getElementById('insp-upgrade-costs');
    costWrap.innerHTML = '';
    for (const [res, amt] of Object.entries(costs)) {
      if (amt > 0) {
        const aff = state.resources[res] >= amt;
        const tag = document.createElement('span');
        tag.className = 'cost-tag ' + (aff ? '' : 'lacking');
        tag.textContent = `${amt} ${res[0].toUpperCase() + res.slice(1)}`;
        costWrap.appendChild(tag);
      }
    }

    const upBtn = document.getElementById('btn-upgrade-building');
    upBtn.onclick = () => upgradeBuilding(building);
  }

  const demBtn = document.getElementById('btn-demolish-building');
  demBtn.onclick = () => demolishBuilding(building);

  insp.classList.remove('hidden');
}

// ============================================================
// OBJECTIVES / PROGRESSION TIMELINE MODAL
// ============================================================
function renderObjectivesModal() {
  const container = document.getElementById('stages-container');
  container.innerHTML = '';

  for (const s of STAGES) {
    const isCompleted = state.completedStages.includes(s.id);
    const isCurrent = state.currentStage === s.id;
    const isLocked = state.currentStage < s.id;

    const card = document.createElement('div');
    card.className = `stage-card ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`;

    let statusLabel = isCompleted ? 'Completed' : (isCurrent ? 'In Progress' : 'Locked');
    let statusClass = isCompleted ? 'complete' : (isCurrent ? 'active' : 'locked');

    let goalsHtml = '';
    for (const g of s.goals) {
      const met = g.check(state);
      goalsHtml += `
        <div class="goal-item ${met ? 'done' : ''}">
          <div class="goal-check">
            ${met ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
          <span>${g.label}</span>
        </div>
      `;
    }

    let rewardsText = [];
    if (s.rewards.wood) rewardsText.push(`+${s.rewards.wood} Wood`);
    if (s.rewards.stone) rewardsText.push(`+${s.rewards.stone} Stone`);
    if (s.rewards.food) rewardsText.push(`+${s.rewards.food} Food`);
    if (s.rewards.gold) rewardsText.push(`+${s.rewards.gold} Gold`);
    if (s.rewards.unlocks) rewardsText.push(`Unlocks: ${s.rewards.unlocks.join(', ')}`);

    card.innerHTML = `
      <div class="stage-header">
        <div class="stage-num-title">
          <span class="stage-badge">Stage ${s.id}</span>
          <div class="stage-title">${s.name}</div>
        </div>
        <span class="stage-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="stage-goals">${goalsHtml}</div>
      <div class="stage-rewards">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        <span>Rewards: ${rewardsText.join(' &bull; ')}</span>
      </div>
    `;

    container.appendChild(card);
  }
}

// ============================================================
// LAND EXPANSION MODAL
// ============================================================
function renderExpansionModal() {
  const container = document.getElementById('expansion-plots-list');
  container.innerHTML = '';

  for (const plot of EXPANSION_PLOTS) {
    if (plot.id === 'core') continue; // Always unlocked

    const isPurchased = state.unlockedPlots.includes(plot.id);
    const canAfford = hasResources(plot.cost);
    const meetsPop = state.population >= plot.popReq;

    const card = document.createElement('div');
    card.className = `plot-card ${isPurchased ? 'purchased' : ''}`;

    let costsHtml = '';
    if (plot.cost) {
      for (const [r, amt] of Object.entries(plot.cost)) {
        const aff = state.resources[r] >= amt;
        costsHtml += `<span class="mini-cost ${aff ? '' : 'insufficient'}">${amt} ${r[0].toUpperCase() + r.slice(1)}</span>`;
      }
    }

    card.innerHTML = `
      <div class="plot-title">${plot.name}</div>
      <div class="plot-desc">Requires ${plot.popReq} Citizens. Expands sovereign building territory.</div>
      <div class="plot-costs">${costsHtml}</div>
      <button class="btn btn-primary btn-block" style="margin-top:6px;" ${isPurchased || !canAfford || !meetsPop ? 'disabled' : ''}>
        ${isPurchased ? 'Territory Sovereign' : (!meetsPop ? `Need ${plot.popReq} Pop` : 'Annex Territory')}
      </button>
    `;

    if (!isPurchased && canAfford && meetsPop) {
      card.querySelector('button').onclick = () => {
        deductResources(plot.cost);
        state.unlockedPlots.push(plot.id);
        showToast('Territory annexed! Sovereignty expanded.', 'success');
        saveGame();
        updateHUD();
        renderExpansionModal();
        checkStageProgression();
      };
    }

    container.appendChild(card);
  }
}

// ============================================================
// TRADING POST MODAL
// ============================================================
function renderTradingModal() {
  const container = document.getElementById('trading-goods-container');
  container.innerHTML = '';

  const goods = [
    { id: 'wood', name: 'Timber Logs', sellAmt: 20, sellGain: 12, buyAmt: 20, buyCost: 16 },
    { id: 'stone', name: 'Hewn Stone', sellAmt: 15, sellGain: 12, buyAmt: 15, buyCost: 18 },
    { id: 'food', name: 'Surplus Grain', sellAmt: 25, sellGain: 15, buyAmt: 20, buyCost: 20 }
  ];

  for (const item of goods) {
    const row = document.createElement('div');
    row.className = 'trade-row';

    const canSell = state.resources[item.id] >= item.sellAmt;
    const canBuy = state.resources.gold >= item.buyCost;

    row.innerHTML = `
      <div class="trade-good-info">
        <div class="trade-name">${item.name}</div>
      </div>
      <div class="trade-actions">
        <button class="btn btn-secondary btn-trade btn-sell" ${canSell ? '' : 'disabled'}>
          Sell ${item.sellAmt} for +${item.sellGain} Gold
        </button>
        <button class="btn btn-primary btn-trade btn-buy" ${canBuy ? '' : 'disabled'}>
          Buy ${item.buyAmt} for -${item.buyCost} Gold
        </button>
      </div>
    `;

    row.querySelector('.btn-sell').onclick = () => {
      if (state.resources[item.id] >= item.sellAmt) {
        state.resources[item.id] -= item.sellAmt;
        state.resources.gold += item.sellGain;
        showToast(`Sold ${item.sellAmt} ${item.name} for +${item.sellGain} Gold!`, 'gold');
        saveGame();
        updateHUD();
        renderTradingModal();
        checkStageProgression();
      }
    };

    row.querySelector('.btn-buy').onclick = () => {
      if (state.resources.gold >= item.buyCost) {
        state.resources.gold -= item.buyCost;
        state.resources[item.id] += item.buyAmt;
        showToast(`Purchased ${item.buyAmt} ${item.name}!`, 'success');
        saveGame();
        updateHUD();
        renderTradingModal();
        checkStageProgression();
      }
    };

    container.appendChild(row);
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-stack');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    gold: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  }[type] || '';

  toast.innerHTML = iconSvg + `<span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ============================================================
// INPUT & INTERACTION HANDLING
// ============================================================

/** Clamp camera so the map never fully scrolls off-screen. */
function clampCamera() {
  const totalMapPx = GRID_SIZE * TILE_SIZE * state.zoom;
  const vp = document.getElementById('viewport');
  const vpW = vp ? vp.clientWidth : canvas.width;
  const vpH = vp ? vp.clientHeight : canvas.height;
  const margin = 80;
  state.camX = Math.max(margin - totalMapPx, Math.min(vpW - margin, state.camX));
  state.camY = Math.max(margin - totalMapPx, Math.min(vpH - margin, state.camY));
}

function setupInputListeners() {
  const vp = document.getElementById('viewport');

  // --- Drag displacement tracker for disambiguation ---
  let pointerDownX = 0;
  let pointerDownY = 0;
  let didDrag = false;

  // Mouse move for hover tile & drag-pan
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (state.isDragging) {
      const dx = mx - pointerDownX;
      const dy = my - pointerDownY;
      if (!didDrag && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) didDrag = true;
      state.camX = mx - state.dragStartX;
      state.camY = my - state.dragStartY;
      clampCamera();
    }

    hoverTile = screenToTile(mx, my);
  });

  // Mouse Down
  canvas.addEventListener('mousedown', e => {
    if (e.button === 2) { // Right click -> cancel placement
      exitPlacementMode();
      return;
    }

    if (e.button === 0) {
      if (state.placingType) {
        // Place building
        if (hoverTile && canBuildAt(hoverTile.tx, hoverTile.ty)) {
          constructBuilding(state.placingType, hoverTile.tx, hoverTile.ty);
        }
      } else {
        // Start Drag-Pan or Select building
        state.isDragging = true;
        didDrag = false;
        const rect = canvas.getBoundingClientRect();
        pointerDownX = e.clientX - rect.left;
        pointerDownY = e.clientY - rect.top;
        state.dragStartX = pointerDownX - state.camX;
        state.dragStartY = pointerDownY - state.camY;
      }
    }
  });

  // Mouse Up
  window.addEventListener('mouseup', e => {
    if (state.isDragging) {
      state.isDragging = false;
    }
  });

  // Click on tile to select existing building — suppressed if user dragged
  canvas.addEventListener('click', e => {
    if (didDrag) { didDrag = false; return; }
    if (state.placingType) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const tile = screenToTile(mx, my);

    const b = getBuildingAt(tile.tx, tile.ty);
    if (b) {
      renderInspector(b);
    } else {
      state.selectedBuilding = null;
      document.getElementById('building-inspector').classList.add('hidden');
    }
  });

  // Prevent context menu
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Mouse Wheel Zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(1.8, Math.max(0.65, state.zoom * zoomDelta));

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    state.camX = mx - (mx - state.camX) * (newZoom / state.zoom);
    state.camY = my - (my - state.camY) * (newZoom / state.zoom);
    state.zoom = newZoom;
    clampCamera();
  }, { passive: false });

  // --- Touch support (single-finger pan + tap) ---
  let touchStartX = 0, touchStartY = 0, touchCamX0 = 0, touchCamY0 = 0;
  let touchDidDrag = false;

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = t.clientX - rect.left;
    touchStartY = t.clientY - rect.top;
    touchCamX0 = state.camX;
    touchCamY0 = state.camY;
    touchDidDrag = false;
    hoverTile = screenToTile(touchStartX, touchStartY);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const mx = t.clientX - rect.left;
    const my = t.clientY - rect.top;
    const dx = mx - touchStartX;
    const dy = my - touchStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) touchDidDrag = true;
    state.camX = touchCamX0 + dx;
    state.camY = touchCamY0 + dy;
    clampCamera();
    hoverTile = screenToTile(mx, my);
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (touchDidDrag) { touchDidDrag = false; return; }
    // Treat short tap as a click/selection
    if (state.placingType) {
      if (hoverTile && canBuildAt(hoverTile.tx, hoverTile.ty)) {
        constructBuilding(state.placingType, hoverTile.tx, hoverTile.ty);
      }
    } else if (hoverTile) {
      const b = getBuildingAt(hoverTile.tx, hoverTile.ty);
      if (b) {
        renderInspector(b);
      } else {
        state.selectedBuilding = null;
        document.getElementById('building-inspector').classList.add('hidden');
      }
    }
  }, { passive: false });

  // Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.placingType) {
        exitPlacementMode();
      } else if (state.selectedBuilding) {
        state.selectedBuilding = null;
        document.getElementById('building-inspector').classList.add('hidden');
      } else if (state.gameStarted && !state.paused) {
        pauseGame();
      } else if (state.paused) {
        resumeGame();
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (state.gameStarted) {
        if (state.paused) resumeGame(); else pauseGame();
      }
    }
  });

  // Window Resize
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // Auto-pause simulation when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (simInterval) { clearInterval(simInterval); simInterval = null; }
    } else {
      if (state.gameStarted && !state.paused && !simInterval) {
        startSimulation();
      }
    }
  });

  // ArcadeVerse parent hub lifecycle bridge
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const type = e.data.type;
    if (type === 'ARCADEVERSE_PAUSE') {
      if (state.gameStarted && !state.paused) pauseGame();
    } else if (type === 'ARCADEVERSE_RESUME') {
      if (state.paused) resumeGame();
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      if (simInterval) { clearInterval(simInterval); simInterval = null; }
    } else if (type === 'AV_RESIZE') {
      resizeCanvas();
    }
  });
}

// ============================================================
// EVENT WIRING
// ============================================================
function wireEvents() {
  // Main Menu Buttons
  document.getElementById('btn-play-game').onclick = () => {
    document.getElementById('modal-menu').classList.add('hidden');
    state.gameStarted = true;
    startSimulation();
    showToast('Welcome, Monarch! Your sovereign realm awaits.', 'gold');
  };

  document.getElementById('btn-open-howto').onclick = () => {
    document.getElementById('modal-howto').classList.remove('hidden');
  };

  document.getElementById('btn-close-howto').onclick = () => {
    document.getElementById('modal-howto').classList.add('hidden');
  };

  document.getElementById('btn-howto-gotit').onclick = () => {
    document.getElementById('modal-howto').classList.add('hidden');
  };

  document.getElementById('btn-new-realm').onclick = () => {
    resetGame();
    document.getElementById('modal-menu').classList.add('hidden');
    state.gameStarted = true;
    startSimulation();
    updateHUD();
    renderToolbarCards();
    showToast('A new sovereign realm has been founded!', 'gold');
  };

  // Speed Toggle
  document.getElementById('btn-speed').onclick = () => {
    if (state.speed === 1) state.speed = 2;
    else if (state.speed === 2) state.speed = 3;
    else state.speed = 1;
    document.getElementById('speed-label').textContent = state.speed + 'x';
    startSimulation();
  };

  // Objectives Modal
  document.getElementById('btn-objectives').onclick = () => {
    renderObjectivesModal();
    document.getElementById('modal-objectives').classList.remove('hidden');
  };
  document.getElementById('btn-close-objectives').onclick = () => {
    document.getElementById('modal-objectives').classList.add('hidden');
  };

  // Land Expansion Modal
  document.getElementById('btn-expand').onclick = () => {
    renderExpansionModal();
    document.getElementById('modal-expansion').classList.remove('hidden');
  };
  document.getElementById('btn-close-expansion').onclick = () => {
    document.getElementById('modal-expansion').classList.add('hidden');
  };

  // Trading Modal
  document.getElementById('btn-market').onclick = () => {
    renderTradingModal();
    document.getElementById('modal-trading').classList.remove('hidden');
  };
  document.getElementById('btn-close-trading').onclick = () => {
    document.getElementById('modal-trading').classList.add('hidden');
  };

  // Pause Controls
  document.getElementById('btn-pause').onclick = () => pauseGame();
  document.getElementById('btn-resume-game').onclick = () => resumeGame();
  document.getElementById('btn-pause-howto').onclick = () => {
    document.getElementById('modal-howto').classList.remove('hidden');
  };
  document.getElementById('btn-restart-kingdom').onclick = () => {
    document.getElementById('modal-pause').classList.add('hidden');
    resetGame();
    resumeGame();
    showToast('Kingdom restarted successfully.', 'info');
  };
  document.getElementById('btn-return-menu').onclick = () => {
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('modal-menu').classList.remove('hidden');
    state.gameStarted = false;
    state.paused = false;
  };

  // Toolbar Tabs
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCategory = tab.dataset.tab;
      renderToolbarCards();
    };
  });

  // Cancel Placement
  document.getElementById('btn-cancel-placement').onclick = () => exitPlacementMode();
  document.getElementById('btn-close-inspector').onclick = () => {
    state.selectedBuilding = null;
    document.getElementById('building-inspector').classList.add('hidden');
  };

  // Stage Celebration
  document.getElementById('btn-claim-stage-reward').onclick = () => {
    document.getElementById('modal-stage-celebration').classList.add('hidden');
    renderToolbarCards();
  };

  // Objective minimize button
  document.getElementById('btn-minimize-obj').onclick = () => {
    document.getElementById('active-objective-card').classList.toggle('minimized');
  };
}

function pauseGame() {
  state.paused = true;
  document.getElementById('modal-pause').classList.remove('hidden');
}

function resumeGame() {
  state.paused = false;
  document.getElementById('modal-pause').classList.add('hidden');
}

// ============================================================
// BOOTSTRAP
// ============================================================
function init() {
  generateTerrain();
  loadGame();
  resizeCanvas();
  setupInputListeners();
  wireEvents();
  updateRatesAndCapacity();
  updateHUD();
  updateObjectiveWidget();
  renderToolbarCards();

  // Show previous realm preview if save exists
  const hasSave = state.buildings.length > 0;
  if (hasSave) {
    document.getElementById('menu-save-preview').textContent = 
      `Existing Realm: Stage ${state.currentStage} with ${state.buildings.length} structures and ${state.population} citizens.`;
  }

  // Start map render loop
  renderMap();
}

document.addEventListener('DOMContentLoaded', init);
