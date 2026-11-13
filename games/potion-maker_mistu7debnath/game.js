/* ============================================================
   POTION MAKER — game.js
   Vanilla JS, no external dependencies
   ============================================================ */

'use strict';

/* ============================================================
   DATA — INGREDIENTS
   ============================================================ */
const INGREDIENTS = [
  { id:'moonflower',   name:'Moonflower',      category:'Flora',    rarity:'common',   startQty:5,  color:'#c084fc', svgPath:'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z', desc:'Blooms only under moonlight.' },
  { id:'crystal_dust', name:'Crystal Dust',    category:'Mineral',  rarity:'uncommon', startQty:4,  color:'#22d3ee', svgPath:'M12 2l3 9H3l3-9zm0 20l-3-9h6l-3 9z',                             desc:'Shimmering powder from raw gemstones.' },
  { id:'fire_mushroom',name:'Fire Mushroom',   category:'Flora',    rarity:'uncommon', startQty:3,  color:'#f97316', svgPath:'M12 2c0 0-5 4-5 9s5 4 5 9c0-5 5-4 5-9s-5-9-5-9z',              desc:'Radiates warmth even when dried.' },
  { id:'aqua_leaf',    name:'Aqua Leaf',       category:'Flora',    rarity:'common',   startQty:5,  color:'#34d399', svgPath:'M12 2s-8 6-8 12 8 8 8 8 8-2 8-8-8-12-8-12z',                  desc:'Found near enchanted springs.' },
  { id:'shadow_berry', name:'Shadow Berry',    category:'Fruit',    rarity:'rare',     startQty:2,  color:'#7c3aed', svgPath:'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',                        desc:'Absorbs surrounding light.' },
  { id:'golden_root',  name:'Golden Root',     category:'Mineral',  rarity:'uncommon', startQty:3,  color:'#fbbf24', svgPath:'M12 3v18M6 6l12 12M18 6l-12 12',                               desc:'Radiates wealth and power.' },
  { id:'starlight',    name:'Starlight Crystal',category:'Mineral', rarity:'rare',     startQty:2,  color:'#f472b6', svgPath:'M12 2l1 4h4l-3.3 2.4 1.3 4L12 10l-3 2.4 1.3-4L7 6h4z',      desc:'Condensed starlight, incredibly rare.' },
  { id:'void_shard',   name:'Void Shard',      category:'Mineral',  rarity:'legendary',startQty:1,  color:'#1d1d2e', svgPath:'M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z',                          desc:'Fragment of pure void energy.' },
  { id:'dragon_scale', name:'Dragon Scale',    category:'Creature', rarity:'legendary',startQty:1,  color:'#ef4444', svgPath:'M12 2c0 0 8 3 8 10s-8 10-8 10S4 19 4 12 12 2 12 2z',          desc:'Shed from an ancient dragon.' },
  { id:'mana_crystal', name:'Mana Crystal',    category:'Magic',    rarity:'rare',     startQty:2,  color:'#818cf8', svgPath:'M12 2l2.5 7h7.5l-6 4.5 2.3 7-6.3-4.5-6.3 4.5 2.3-7L2 9h7.5z',desc:'Crystallized magical energy.' },
];

/* ============================================================
   DATA — POTIONS
   ============================================================ */
const POTIONS = [
  { id:'healing',      name:'Healing Potion',       rarity:'common',   value:30,  color:'#f87171', desc:'Restores vitality and mends wounds instantly.' },
  { id:'speed',        name:'Speed Elixir',          rarity:'common',   value:35,  color:'#34d399', desc:'Grants the drinker extraordinary swiftness.' },
  { id:'strength',     name:'Strength Brew',         rarity:'uncommon', value:50,  color:'#f97316', desc:'Multiplies physical power for a short time.' },
  { id:'invisibility', name:'Invisibility Draught',  rarity:'uncommon', value:60,  color:'#22d3ee', desc:'Renders the drinker completely invisible.' },
  { id:'energy',       name:'Energy Surge',          rarity:'common',   value:40,  color:'#fbbf24', desc:'Floods the body with magical energy.' },
  { id:'luck',         name:'Potion of Luck',        rarity:'rare',     value:80,  color:'#c084fc', desc:'Bends fate in the drinker\'s favor.' },
  { id:'wisdom',       name:'Wisdom Tonic',          rarity:'rare',     value:90,  color:'#818cf8', desc:'Grants insight and enhanced perception.' },
  { id:'dragon_might', name:'Dragon\'s Might',       rarity:'legendary',value:200, color:'#ef4444', desc:'Channels ancient dragon power.' },
  { id:'void_essence', name:'Void Essence',          rarity:'legendary',value:250, color:'#4b0082', desc:'Pure distilled power of the void.' },
  { id:'star_brew',    name:'Stardust Elixir',       rarity:'legendary',value:180, color:'#f472b6', desc:'Brewed from the essence of falling stars.' },
];

/* ============================================================
   DATA — RECIPES
   ============================================================ */
const RECIPES = [
  { id:'r1',  ingredients:['moonflower','aqua_leaf'],                        result:'healing',      brewTime:4, reward:30  },
  { id:'r2',  ingredients:['crystal_dust','aqua_leaf'],                      result:'speed',        brewTime:4, reward:35  },
  { id:'r3',  ingredients:['fire_mushroom','golden_root'],                   result:'strength',     brewTime:5, reward:50  },
  { id:'r4',  ingredients:['crystal_dust','shadow_berry'],                   result:'invisibility', brewTime:6, reward:60  },
  { id:'r5',  ingredients:['moonflower','golden_root'],                      result:'energy',       brewTime:4, reward:40  },
  { id:'r6',  ingredients:['starlight','moonflower','aqua_leaf'],            result:'luck',         brewTime:7, reward:80  },
  { id:'r7',  ingredients:['mana_crystal','crystal_dust','golden_root'],     result:'wisdom',       brewTime:7, reward:90  },
  { id:'r8',  ingredients:['dragon_scale','fire_mushroom','golden_root'],    result:'dragon_might', brewTime:10,reward:200 },
  { id:'r9',  ingredients:['void_shard','shadow_berry','mana_crystal'],      result:'void_essence', brewTime:10,reward:250 },
  { id:'r10', ingredients:['starlight','moonflower','mana_crystal'],         result:'star_brew',    brewTime:9, reward:180 },
  { id:'r11', ingredients:['fire_mushroom','aqua_leaf'],                     result:'energy',       brewTime:4, reward:40  },
  { id:'r12', ingredients:['moonflower','crystal_dust','shadow_berry'],      result:'luck',         brewTime:7, reward:80  },
];

/* ============================================================
   DATA — SHOP
   ============================================================ */
const SHOP_ITEMS = [
  { ingredientId:'moonflower',    cost:8  },
  { ingredientId:'crystal_dust',  cost:10 },
  { ingredientId:'fire_mushroom', cost:12 },
  { ingredientId:'aqua_leaf',     cost:8  },
  { ingredientId:'shadow_berry',  cost:20 },
  { ingredientId:'golden_root',   cost:14 },
  { ingredientId:'starlight',     cost:28 },
  { ingredientId:'mana_crystal',  cost:30 },
  { ingredientId:'void_shard',    cost:60 },
  { ingredientId:'dragon_scale',  cost:80 },
];

/* ============================================================
   CUSTOMER NAME POOLS
   ============================================================ */
const CUSTOMER_NAMES = [
  'Elara','Theron','Mira','Orin','Sylva','Davan','Nyx','Cora',
  'Zephyr','Linden','Faye','Bram','Skye','Aldric','Vex','Isolde',
];

/* ============================================================
   GAME STATE
   ============================================================ */
const SAVE_KEY = 'potionMaker_progress';

const state = {
  coins: 50,
  score: 0,
  inventory: {},       // ingredientId -> qty
  potionInventory: {}, // potionId -> qty
  discoveredRecipes: new Set(),
  discoveredPotions: new Set(),
  selectedSlots: [null, null, null], // ingredientId | null per slot
  cauldronIngredients: [], // active ingredients in cauldron array
  isAddingIngredient: false, // atomic transition state lock
  brewing: false,
  brewTimer: null,
  brewTotal: 0,
  brewElapsed: 0,
  orders: [],
  orderIdCounter: 0,
  orderTimers: {},
  orderInterval: null,
  paused: false,
  gameStarted: false,
};

/* ============================================================
   CANVAS CAULDRON RENDERER
   ============================================================ */
let cauldronCtx = null;
let cauldronAnim = null;
let bubbles = [];
let cauldronColor = '#7c3aed';
let brewingEffect = false;
let sparkles = [];
let dropAnimations = [];

function initCauldron() {
  const canvas = document.getElementById('cauldron-canvas');
  cauldronCtx = canvas.getContext('2d');
  startCauldronAnim();
}

function startCauldronAnim() {
  if (cauldronAnim) cancelAnimationFrame(cauldronAnim);
  let frame = 0;

  function loop() {
    frame++;
    drawCauldron(frame);
    cauldronAnim = requestAnimationFrame(loop);
  }
  loop();
}

function drawCauldron(frame) {
  const ctx = cauldronCtx;
  const W = 220, H = 200;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2 + 10;
  const t = frame * 0.02;

  // --- Outer cauldron body ---
  ctx.save();
  const grad = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy + 10, 70);
  grad.addColorStop(0, '#2d2244');
  grad.addColorStop(0.6, '#1a1030');
  grad.addColorStop(1, '#0d0820');
  ctx.beginPath();
  ctx.ellipse(cx, cy + 30, 68, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 70, cy - 10);
  ctx.quadraticCurveTo(cx - 75, cy + 50, cx - 55, cy + 50);
  ctx.lineTo(cx + 55, cy + 50);
  ctx.quadraticCurveTo(cx + 75, cy + 50, cx + 70, cy - 10);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#3d2f5c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cauldron rim
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10, 72, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1838';
  ctx.fill();
  ctx.strokeStyle = '#4a3680';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // --- Liquid surface ---
  const liqColor = cauldronColor;
  const waveOff = Math.sin(t * 2) * 2;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10 + waveOff, 66, 15, 0, 0, Math.PI * 2);
  ctx.clip();

  // Liquid fill below rim
  const liqGrad = ctx.createRadialGradient(cx, cy - 10, 5, cx, cy - 10, 66);
  liqGrad.addColorStop(0, lighten(liqColor, 0.4));
  liqGrad.addColorStop(0.5, liqColor);
  liqGrad.addColorStop(1, darken(liqColor, 0.5));
  ctx.fillStyle = liqGrad;
  ctx.fillRect(cx - 70, cy - 28, 140, 50);

  // Shimmer
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    const rx = cx - 30 + i * 28 + Math.sin(t + i) * 10;
    ctx.beginPath();
    ctx.ellipse(rx, cy - 12 + waveOff, 10 + i * 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- Bubbles ---
  if (Math.random() < (brewingEffect ? 0.5 : 0.18)) {
    bubbles.push({
      x: cx + (Math.random() - 0.5) * 100,
      y: cy - 10,
      r: 3 + Math.random() * 5,
      vy: -(0.6 + Math.random() * 1.2),
      life: 0,
      maxLife: 40 + Math.random() * 30,
      color: liqColor,
    });
  }
  bubbles = bubbles.filter(b => b.life < b.maxLife);
  for (const b of bubbles) {
    b.y += b.vy;
    b.life++;
    const alpha = 1 - b.life / b.maxLife;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.08})`;
    ctx.fill();
  }

  // --- Steam ---
  for (let i = 0; i < 3; i++) {
    const sx = cx - 30 + i * 30;
    const sy = cy - 24;
    const phase = t + i * 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(
      sx + Math.sin(phase) * 10, sy - 15,
      sx + Math.sin(phase + 1) * 10, sy - 30,
      sx + Math.sin(phase + 2) * 6, sy - 45
    );
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + 0.04 * Math.sin(phase)})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // --- Legs ---
  ctx.fillStyle = '#1e1838';
  ctx.strokeStyle = '#3d2f5c';
  ctx.lineWidth = 2;
  for (const lx of [cx - 48, cx, cx + 48]) {
    ctx.beginPath();
    ctx.moveTo(lx, cy + 46);
    ctx.lineTo(lx - 8, cy + 65);
    ctx.lineTo(lx + 8, cy + 65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // --- Falling Droplet Animations ---
  dropAnimations = dropAnimations.filter(d => d.life < d.maxLife);
  for (const d of dropAnimations) {
    d.life++;
    if (d.y < d.targetY) {
      d.y += d.vy;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (!d.splashed) {
      d.splashed = true;
      burstSparkles(d.color);
    }
  }

  // --- Sparkles (brew result) ---
  sparkles = sparkles.filter(s => s.life < s.maxLife);
  for (const s of sparkles) {
    s.life++;
    s.x += s.vx;
    s.y += s.vy;
    const alpha = 1 - s.life / s.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.life * 0.2);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.moveTo(0, -s.r);
    ctx.lineTo(s.r * 0.3, -s.r * 0.3);
    ctx.lineTo(s.r, 0);
    ctx.lineTo(s.r * 0.3, s.r * 0.3);
    ctx.lineTo(0, s.r);
    ctx.lineTo(-s.r * 0.3, s.r * 0.3);
    ctx.lineTo(-s.r, 0);
    ctx.lineTo(-s.r * 0.3, -s.r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function triggerCauldronDropAnimation(color, onComplete) {
  const cx = 110, cy = 90;
  // Falling droplet
  dropAnimations.push({
    x: cx + (Math.random() - 0.5) * 30,
    y: 20,
    targetY: cy - 10,
    vy: 4.5,
    r: 6,
    color: color,
    splashed: false,
    life: 0,
    maxLife: 20,
  });

  // Temporarily increase bubble churn
  brewingEffect = true;

  // Burst bubbles on liquid surface with ingredient color
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.4;
    const speed = 1.2 + Math.random() * 2.2;
    bubbles.push({
      x: cx + (Math.random() - 0.5) * 50,
      y: cy - 10,
      r: 3 + Math.random() * 5,
      vy: Math.sin(angle) * speed - 1.2,
      life: 0,
      maxLife: 30 + Math.random() * 20,
      color: color,
    });
  }

  // Sparkles
  burstSparkles(color);

  setTimeout(() => {
    brewingEffect = false;
    if (onComplete) onComplete();
  }, 250);
}

function burstSparkles(color) {
  const cx = 110, cy = 90;
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    sparkles.push({
      x: cx + (Math.random() - 0.5) * 60,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      r: 4 + Math.random() * 5,
      color: color,
      life: 0,
      maxLife: 35 + Math.random() * 25,
    });
  }
}

function lighten(hex, amt) {
  const c = hexToRgb(hex);
  return `rgb(${Math.min(255, c.r + 255 * amt)},${Math.min(255, c.g + 255 * amt)},${Math.min(255, c.b + 255 * amt)})`;
}
function darken(hex, amt) {
  const c = hexToRgb(hex);
  return `rgb(${Math.max(0, c.r - 255 * amt)},${Math.max(0, c.g - 255 * amt)},${Math.max(0, c.b - 255 * amt)})`;
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
}

function setCauldronColor(color) {
  cauldronColor = color;
}

/* ============================================================
   SAVE / LOAD
   ============================================================ */
function saveGame() {
  try {
    const data = {
      coins: state.coins,
      score: state.score,
      inventory: state.inventory,
      potionInventory: state.potionInventory,
      cauldronIngredients: state.cauldronIngredients,
      discoveredRecipes: Array.from(state.discoveredRecipes),
      discoveredPotions: Array.from(state.discoveredPotions),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* silent */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.coins = data.coins || 50;
    state.score = data.score || 0;
    state.inventory = data.inventory || {};
    state.potionInventory = data.potionInventory || {};
    state.discoveredRecipes = new Set(data.discoveredRecipes || []);
    state.discoveredPotions = new Set(data.discoveredPotions || []);
    if (data.cauldronIngredients && Array.isArray(data.cauldronIngredients)) {
      state.cauldronIngredients = data.cauldronIngredients.slice(0, 3);
      state.selectedSlots = [
        state.cauldronIngredients[0] || null,
        state.cauldronIngredients[1] || null,
        state.cauldronIngredients[2] || null
      ];
    } else {
      state.cauldronIngredients = [];
      state.selectedSlots = [null, null, null];
    }
    return true;
  } catch (e) { return false; }
}

function resetGame() {
  state.coins = 50;
  state.score = 0;
  state.inventory = {};
  state.potionInventory = {};
  state.discoveredRecipes = new Set();
  state.discoveredPotions = new Set();
  state.selectedSlots = [null, null, null];
  state.cauldronIngredients = [];
  state.isAddingIngredient = false;
  state.brewing = false;
  if (state.brewTimer) { clearInterval(state.brewTimer); state.brewTimer = null; }
  state.orders = [];
  if (state.orderInterval) { clearInterval(state.orderInterval); state.orderInterval = null; }
  Object.values(state.orderTimers).forEach(t => clearInterval(t));
  state.orderTimers = {};
  state.orderIdCounter = 0;

  // Restore starting inventory
  for (const ing of INGREDIENTS) {
    state.inventory[ing.id] = ing.startQty;
  }
  saveGame();
}

/* ============================================================
   INVENTORY HELPERS
   ============================================================ */
function getQty(id) { return state.inventory[id] || 0; }
function getPotionQty(id) { return state.potionInventory[id] || 0; }

function addIngredient(id, qty) {
  state.inventory[id] = (state.inventory[id] || 0) + qty;
}
function removeIngredient(id, qty) {
  state.inventory[id] = Math.max(0, (state.inventory[id] || 0) - qty);
}
function addPotion(id) {
  state.potionInventory[id] = (state.potionInventory[id] || 0) + 1;
}
function removePotion(id) {
  if ((state.potionInventory[id] || 0) > 0) {
    state.potionInventory[id]--;
    return true;
  }
  return false;
}

/* ============================================================
   SLOT & CAULDRON MANAGEMENT
   ============================================================ */
let lastAddTimestamp = 0;

function getFilledSlots() {
  return state.cauldronIngredients.slice();
}

function addIngredientToCauldron(id) {
  // 1. Atomic transition state lock & gameplay state check
  if (state.brewing || state.paused || state.isAddingIngredient) {
    return false;
  }

  // 2. Debounce rapid double-clicks and simultaneous multi-touch taps (250ms threshold)
  const now = Date.now();
  if (now - lastAddTimestamp < 250) {
    return false;
  }

  // 3. Check capacity (max 3 ingredients in cauldron)
  if (state.cauldronIngredients.length >= 3) {
    showToast('Cauldron is full! Maximum 3 ingredients.', 'info');
    return false;
  }

  // 4. Validate that each ingredient addition strictly verifies inventory[id] > 0 at the exact moment of insertion
  if (getQty(id) <= 0) {
    showToast('Not enough of this ingredient!', 'error');
    return false;
  }

  const freeIdx = state.selectedSlots.indexOf(null);
  if (freeIdx === -1) {
    showToast('All 3 slots are filled. Remove one first.', 'info');
    return false;
  }

  // Engage atomic transition state lock
  state.isAddingIngredient = true;
  lastAddTimestamp = now;

  // Atomically decrement inventory count
  removeIngredient(id, 1);

  // Push to cauldronIngredients and update selectedSlots
  state.selectedSlots[freeIdx] = id;
  state.cauldronIngredients.push(id);

  // Trigger drop and bubble burst animation
  const ing = INGREDIENTS.find(x => x.id === id);
  const color = ing ? ing.color : '#c084fc';
  triggerCauldronDropAnimation(color, () => {
    // Release atomic transition state lock when animation finishes
    state.isAddingIngredient = false;
    renderSlots();
    renderIngredientGrid();
    updateBrewBtn();
  });

  saveGame();
  renderSlots();
  renderIngredientGrid();
  updateBrewBtn();
  return true;
}

function removeIngredientFromCauldron(id) {
  if (state.brewing || state.paused || state.isAddingIngredient) return false;

  const slotIdx = state.selectedSlots.indexOf(id);
  if (slotIdx === -1) return false;

  // Refund inventory count
  addIngredient(id, 1);
  state.selectedSlots[slotIdx] = null;

  const cIdx = state.cauldronIngredients.indexOf(id);
  if (cIdx !== -1) {
    state.cauldronIngredients.splice(cIdx, 1);
  }

  saveGame();
  renderSlots();
  renderIngredientGrid();
  updateBrewBtn();
  return true;
}

function addToSlot(ingredientId) {
  return addIngredientToCauldron(ingredientId);
}

function removeFromSlots(ingredientId) {
  return removeIngredientFromCauldron(ingredientId);
}

function clearSlots() {
  state.selectedSlots = [null, null, null];
  state.cauldronIngredients = [];
}

function clearCauldron() {
  if (state.brewing) return;
  state.isAddingIngredient = false;
  // Refund all ingredients currently in cauldron back to inventory
  for (const id of state.cauldronIngredients) {
    addIngredient(id, 1);
  }
  state.cauldronIngredients = [];
  clearSlots();
  saveGame();
  renderSlots();
  renderIngredientGrid();
  updateBrewBtn();
  setBrustatus('Select up to 3 ingredients');
}

/* ============================================================
   RECIPE MATCHING
   ============================================================ */
function matchRecipe(slotIngredients) {
  const sorted = [...slotIngredients].sort();
  for (const recipe of RECIPES) {
    const rSorted = [...recipe.ingredients].sort();
    if (sorted.length !== rSorted.length) continue;
    if (sorted.every((v, i) => v === rSorted[i])) return recipe;
  }
  return null;
}

/* ============================================================
   BREWING
   ============================================================ */
function startBrew() {
  if (state.brewing || state.paused || state.isAddingIngredient) return;
  const filled = getFilledSlots();
  if (filled.length === 0) return;

  const recipe = matchRecipe(filled);
  const brewTime = recipe ? recipe.brewTime : 3;

  state.brewing = true;
  state.brewTotal = brewTime;
  state.brewElapsed = 0;
  brewingEffect = true;

  if (recipe) {
    const potion = POTIONS.find(p => p.id === recipe.result);
    setCauldronColor(potion ? potion.color : '#7c3aed');
  } else {
    setCauldronColor('#1d1d2e');
  }

  setBtnState(false);
  document.getElementById('brew-progress-wrap').style.display = 'flex';
  updateBrewProgress();
  setBrustatus('Brewing...');

  state.brewTimer = setInterval(() => {
    if (state.paused) return;
    state.brewElapsed++;
    updateBrewProgress();
    if (state.brewElapsed >= state.brewTotal) {
      clearInterval(state.brewTimer);
      state.brewTimer = null;
      state.brewing = false;
      brewingEffect = false;
      finishBrew(recipe);
    }
  }, 1000);
}

function finishBrew(recipe) {
  document.getElementById('brew-progress-wrap').style.display = 'none';
  setCauldronColor('#7c3aed');

  if (recipe) {
    const potion = POTIONS.find(p => p.id === recipe.result);
    addPotion(recipe.result);
    state.coins += recipe.reward;
    state.score += recipe.reward;

    const isNew = !state.discoveredRecipes.has(recipe.id);
    state.discoveredRecipes.add(recipe.id);
    state.discoveredPotions.add(recipe.result);

    burstSparkles(potion ? potion.color : '#c084fc');
    showBrewResult(true, potion, recipe, isNew);
  } else {
    showBrewResult(false, null, null, false);
  }

  // Ingredients were consumed in brew, empty cauldron without refund
  state.cauldronIngredients = [];
  clearSlots();
  saveGame();
  renderAll();
}

function updateBrewProgress() {
  const pct = state.brewTotal > 0 ? (state.brewElapsed / state.brewTotal) * 100 : 0;
  document.getElementById('brew-progress-fill').style.width = pct + '%';
  const remaining = state.brewTotal - state.brewElapsed;
  document.getElementById('brew-time-label').textContent = remaining + 's';
}

/* ============================================================
   ORDERS
   ============================================================ */
const ORDER_DURATION = 90; // seconds
const MAX_ORDERS = 3;

function generateOrder() {
  if (state.orders.length >= MAX_ORDERS || state.paused || !state.gameStarted) return;

  // Pick from discovered potions or beginner potions
  const available = state.discoveredPotions.size > 0
    ? [...state.discoveredPotions]
    : ['healing', 'speed', 'energy'];

  const potionId = available[Math.floor(Math.random() * available.length)];
  const potion = POTIONS.find(p => p.id === potionId);
  if (!potion) return;

  const customer = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
  const reward = Math.round(potion.value * (1.2 + Math.random() * 0.6));

  const order = {
    id: ++state.orderIdCounter,
    potionId,
    potionName: potion.name,
    potionColor: potion.color,
    customer,
    reward,
    timeLeft: ORDER_DURATION,
    totalTime: ORDER_DURATION,
  };

  state.orders.push(order);

  const timer = setInterval(() => {
    if (state.paused) return;
    order.timeLeft--;
    if (order.timeLeft <= 0) {
      clearInterval(timer);
      delete state.orderTimers[order.id];
      state.orders = state.orders.filter(o => o.id !== order.id);
      showToast(customer + '\'s order expired!', 'error');
      renderOrders();
    } else {
      updateOrderCard(order);
    }
  }, 1000);

  state.orderTimers[order.id] = timer;
  renderOrders();
}

function fulfillOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  if (getPotionQty(order.potionId) < 1) {
    showToast('You don\'t have that potion yet!', 'error'); return;
  }

  removePotion(order.potionId);
  state.coins += order.reward;
  state.score += order.reward + Math.floor(order.timeLeft * 0.5);

  if (state.orderTimers[orderId]) {
    clearInterval(state.orderTimers[orderId]);
    delete state.orderTimers[orderId];
  }
  state.orders = state.orders.filter(o => o.id !== orderId);

  showToast('+' + order.reward + ' coins! Order fulfilled!', 'coin');
  saveGame();
  renderAll();
}

function startOrderGeneration() {
  if (state.orderInterval) clearInterval(state.orderInterval);
  generateOrder(); // immediate first order
  state.orderInterval = setInterval(() => {
    if (!state.paused) generateOrder();
  }, 20000);
}

/* ============================================================
   UI RENDERING
   ============================================================ */
function renderAll() {
  renderHUD();
  renderIngredientGrid();
  renderSlots();
  renderOrders();
  renderCollectionPreview();
  updateBrewBtn();
}

function renderHUD() {
  document.getElementById('hud-coins').textContent = state.coins;
  document.getElementById('hud-score').textContent = state.score;
  document.getElementById('hud-potions').textContent = state.discoveredRecipes.size;
}

function renderIngredientGrid() {
  const grid = document.getElementById('ingredient-grid');
  grid.innerHTML = '';

  for (const ing of INGREDIENTS) {
    const qty = getQty(ing.id);
    const inCauldron = state.cauldronIngredients.includes(ing.id);
    const unavail = qty === 0 && !inCauldron;

    const card = document.createElement('div');
    card.className = 'ingredient-card' + (inCauldron ? ' selected' : '') + (unavail ? ' unavailable' : '');
    card.dataset.id = ing.id;
    card.setAttribute('draggable', qty > 0 ? 'true' : 'false');

    card.innerHTML = `
      <span class="ingredient-rarity rarity-${ing.rarity}">${ing.rarity.toUpperCase()[0]}</span>
      <div class="ingredient-icon" style="background:${hex20(ing.color)};">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${ing.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="${ing.svgPath}"/>
        </svg>
      </div>
      <div class="ingredient-name">${ing.name}</div>
      <div class="ingredient-qty">${qty} left</div>
    `;

    if (qty > 0) {
      card.addEventListener('dragstart', (e) => {
        if (state.brewing || state.paused || state.isAddingIngredient) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', ing.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
    }

    if (!unavail) {
      card.addEventListener('click', () => onIngredientClick(ing.id));
    }
    grid.appendChild(card);
  }
}

function renderSlots() {
  for (let i = 0; i < 3; i++) {
    const slotEl = document.getElementById('slot-' + i);
    const ingId = state.selectedSlots[i];
    const inner = slotEl.querySelector('.slot-inner');
    const label = slotEl.querySelector('.slot-label');

    if (ingId) {
      const ing = INGREDIENTS.find(x => x.id === ingId);
      slotEl.classList.add('filled');
      inner.innerHTML = `
        <div style="width:48px;height:48px;border-radius:50%;background:${hex20(ing.color)};display:flex;align-items:center;justify-content:center;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${ing.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="${ing.svgPath}"/>
          </svg>
        </div>
      `;
      label.textContent = ing.name.split(' ')[0];
      slotEl.onclick = () => onSlotClick(i);
    } else {
      slotEl.classList.remove('filled');
      inner.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
      label.textContent = 'Slot ' + (i + 1);
      slotEl.onclick = null;
    }
  }
  updateBrewBtn();
}

function onIngredientClick(id) {
  if (state.brewing || state.paused || state.isAddingIngredient) return;

  // If already in cauldron and inventory is depleted, or slots are full:
  // clicking removes it from the cauldron and refunds it
  if (state.cauldronIngredients.includes(id) && (getQty(id) === 0 || state.cauldronIngredients.length >= 3)) {
    removeIngredientFromCauldron(id);
    return;
  }

  // Check inventory before attempting to add
  if (getQty(id) <= 0) {
    showToast('Not enough of this ingredient!', 'error');
    return;
  }

  // Add to cauldron with atomic lock and debounce
  addIngredientToCauldron(id);
}

function onSlotClick(slotIndex) {
  if (state.brewing || state.paused || state.isAddingIngredient) return;
  const ingId = state.selectedSlots[slotIndex];
  if (!ingId) return;

  // Refund inventory count and free slot
  addIngredient(ingId, 1);
  state.selectedSlots[slotIndex] = null;

  const cIdx = state.cauldronIngredients.indexOf(ingId);
  if (cIdx !== -1) {
    state.cauldronIngredients.splice(cIdx, 1);
  }

  saveGame();
  renderSlots();
  renderIngredientGrid();
  updateBrewBtn();
}

function updateBrewBtn() {
  const filled = getFilledSlots();
  const brewBtn = document.getElementById('brew-btn');
  brewBtn.disabled = state.brewing || filled.length === 0 || state.paused;
}

function setBtnState(enabled) {
  document.getElementById('brew-btn').disabled = !enabled;
  document.getElementById('clear-btn').disabled = !enabled;
}

function setBrustatus(msg) {
  document.getElementById('brew-status').textContent = msg;
}

/* ---- ORDERS ---- */
function renderOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '';

  if (state.orders.length === 0) {
    list.innerHTML = '<div class="orders-empty">No active orders. Keep brewing!</div>';
    return;
  }

  for (const order of state.orders) {
    list.appendChild(buildOrderCard(order));
  }
}

function buildOrderCard(order) {
  const pct = (order.timeLeft / order.totalTime) * 100;
  const urgency = order.timeLeft < 20 ? 'urgent' : order.timeLeft < 50 ? 'normal' : 'fresh';
  const hasPot = getPotionQty(order.potionId) > 0;
  const timeColor = urgency === 'urgent' ? '#f87171' : urgency === 'normal' ? '#fbbf24' : '#34d399';

  const card = document.createElement('div');
  card.className = `order-card ${urgency}`;
  card.id = 'order-' + order.id;

  card.innerHTML = `
    <div class="order-customer">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b7caa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      ${order.customer}
    </div>
    <div class="order-want">
      <span class="order-potion-dot" style="background:${order.potionColor};box-shadow:0 0 6px ${order.potionColor};"></span>
      ${order.potionName}
    </div>
    <div class="order-meta">
      <div class="order-timer ${urgency}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${timeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${order.timeLeft}s
      </div>
      <div class="order-reward">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        ${order.reward}
      </div>
    </div>
    <div class="order-progress">
      <div class="order-progress-fill" style="width:${pct}%;background:${timeColor};"></div>
    </div>
    <button class="order-fulfill-btn" ${hasPot ? '' : 'disabled'} data-id="${order.id}">
      ${hasPot ? 'Fulfill Order' : 'Brew this potion first'}
    </button>
  `;

  card.querySelector('.order-fulfill-btn').addEventListener('click', () => fulfillOrder(order.id));
  return card;
}

function updateOrderCard(order) {
  const existing = document.getElementById('order-' + order.id);
  if (!existing) return;
  const updated = buildOrderCard(order);
  existing.replaceWith(updated);
}

/* ---- COLLECTION PREVIEW ---- */
function renderCollectionPreview() {
  const container = document.getElementById('collection-preview');
  container.innerHTML = '';

  for (const p of POTIONS) {
    const owned = state.discoveredPotions.has(p.id);
    const dot = document.createElement('div');
    dot.className = 'collection-dot' + (owned ? '' : ' collection-dot-locked');
    dot.style.background = owned ? p.color : '#2e2255';
    dot.style.boxShadow = owned ? `0 0 8px ${p.color}80` : 'none';
    dot.title = owned ? p.name : '???';
    dot.addEventListener('click', () => openCollection());
    container.appendChild(dot);
  }
}

/* ---- BREW RESULT ---- */
function showBrewResult(success, potion, recipe, isNew) {
  const overlay = document.getElementById('modal-brew-result');
  const icon = document.getElementById('result-icon');
  const title = document.getElementById('result-title');
  const desc = document.getElementById('result-desc');
  const reward = document.getElementById('result-reward');

  if (success && potion) {
    icon.innerHTML = buildPotionBottleSVG(potion.color, 72);
    title.textContent = potion.name + (isNew ? ' — Discovered!' : '');
    title.style.color = potion.color;
    desc.textContent = potion.desc + (isNew ? '\n\nNew recipe unlocked in your Recipe Book!' : '');
    reward.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      +${recipe.reward} coins earned!
    `;
  } else {
    icon.innerHTML = `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M3 14h18v2a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7v-2z"/></svg>`;
    title.textContent = 'Mysterious Smoke!';
    title.style.color = '#6b7280';
    desc.textContent = 'The cauldron bubbled and fizzed, but nothing useful emerged. Try a different combination of ingredients!';
    reward.textContent = 'Ingredients consumed. Keep experimenting!';
  }

  setBrustatus('Select up to 3 ingredients');
  overlay.classList.remove('hidden');
}

function buildPotionBottleSVG(color, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 3h6v3l3 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8l3-4V3z" fill="${color}40" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 14h12" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
    <circle cx="12" cy="16" r="2" fill="${color}80"/>
    <path d="M9 3h6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="12" cy="10" rx="3" ry="1.5" fill="${color}30"/>
  </svg>`;
}

/* ---- RECIPE BOOK ---- */
function renderRecipeBook() {
  const grid = document.getElementById('recipebook-grid');
  grid.innerHTML = '';

  for (const recipe of RECIPES) {
    const discovered = state.discoveredRecipes.has(recipe.id);
    const potion = POTIONS.find(p => p.id === recipe.result);
    const card = document.createElement('div');
    card.className = 'recipe-card ' + (discovered ? 'discovered' : 'mystery');

    if (discovered && potion) {
      const ings = recipe.ingredients.map(id => {
        const i = INGREDIENTS.find(x => x.id === id);
        return i ? i.name : id;
      }).join(' + ');

      card.innerHTML = `
        <div class="recipe-name">${potion.name}</div>
        <div class="recipe-ingredients">${ings}</div>
        <div class="recipe-result">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${potion.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          ${potion.rarity.toUpperCase()} &bull; ${recipe.brewTime}s brew
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="recipe-name">??? Unknown Recipe</div>
        <div class="recipe-mystery-label">Experiment with ingredients to discover this.</div>
      `;
    }
    grid.appendChild(card);
  }
}

/* ---- COLLECTION ---- */
function renderCollection() {
  const grid = document.getElementById('collection-grid');
  grid.innerHTML = '';

  for (const p of POTIONS) {
    const owned = state.discoveredPotions.has(p.id);
    const qty = getPotionQty(p.id);
    const card = document.createElement('div');
    card.className = 'collection-card ' + (owned ? 'owned' : 'locked');

    if (owned) {
      card.innerHTML = `
        <div class="collection-bottle">${buildPotionBottleSVG(p.color, 54)}</div>
        <div class="collection-name">${p.name}</div>
        <div class="collection-rarity rarity-${p.rarity}">${p.rarity.toUpperCase()}</div>
        <div class="collection-qty">${qty} in stock</div>
      `;
    } else {
      card.innerHTML = `
        <div class="collection-bottle" style="opacity:0.3;">${buildPotionBottleSVG('#6b7280', 54)}</div>
        <div class="collection-name">???</div>
        <div class="collection-rarity" style="color:#6b7280;">UNDISCOVERED</div>
      `;
    }
    grid.appendChild(card);
  }
}

/* ---- SHOP ---- */
function renderShop() {
  document.getElementById('shop-coins-display').textContent = state.coins;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';

  for (const item of SHOP_ITEMS) {
    const ing = INGREDIENTS.find(x => x.id === item.ingredientId);
    if (!ing) continue;
    const canBuy = state.coins >= item.cost;
    const qty = getQty(ing.id);

    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      <div class="ingredient-icon" style="background:${hex20(ing.color)};width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${ing.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="${ing.svgPath}"/>
        </svg>
      </div>
      <div class="shop-item-info">
        <div class="shop-item-name">${ing.name}</div>
        <div class="shop-item-desc">${ing.desc} (${qty} in stock)</div>
      </div>
      <button class="shop-buy-btn" data-id="${ing.id}" ${canBuy ? '' : 'disabled'}>
        Buy x1<br>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        ${item.cost}
      </button>
    `;

    row.querySelector('.shop-buy-btn').addEventListener('click', () => buyIngredient(ing.id, item.cost));
    grid.appendChild(row);
  }
}

function buyIngredient(id, cost) {
  if (state.coins < cost) { showToast('Not enough coins!', 'error'); return; }
  state.coins -= cost;
  addIngredient(id, 1);
  saveGame();
  renderShop();
  renderHUD();
  renderIngredientGrid();
  showToast('Bought 1x ' + INGREDIENTS.find(x => x.id === id).name, 'success');
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(msg, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');

  const icon = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    coin:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  }[type] || '';

  toast.innerHTML = icon + msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 280);
  }, 2800);
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openCollection() { renderCollection(); openModal('modal-collection'); }
function openRecipeBook() { renderRecipeBook(); openModal('modal-recipebook'); }
function openShop() { renderShop(); openModal('modal-shop'); }

/* ============================================================
   PAUSE / RESUME
   ============================================================ */
function pauseGame() {
  if (!state.gameStarted) return;
  state.paused = true;
  openModal('modal-pause');
}

function resumeGame() {
  state.paused = false;
  closeModal('modal-pause');
  updateBrewBtn();
  if (!state.brewing) setBrustatus('Select up to 3 ingredients');
}

/* ============================================================
   GAME START
   ============================================================ */
function startGame(fresh) {
  if (fresh) resetGame();
  state.gameStarted = true;
  state.paused = false;
  closeModal('modal-menu');
  closeModal('modal-pause');
  renderAll();
  startOrderGeneration();
  showToast('Welcome to Potion Maker! Start brewing!', 'info');
}

/* ============================================================
   HELPER
   ============================================================ */
function hex20(hex) {
  // Hex color with 20% alpha background
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},0.18)`;
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function wireEvents() {
  // Menu
  document.getElementById('menu-play-btn').addEventListener('click', () => {
    const hasSave = loadGame();
    startGame(!hasSave);
  });
  document.getElementById('menu-howto-btn').addEventListener('click', () => openModal('modal-howto'));
  document.getElementById('menu-collection-btn').addEventListener('click', () => openCollection());

  // How to play
  document.getElementById('howto-close-btn').addEventListener('click', () => closeModal('modal-howto'));
  document.getElementById('howto-ok-btn').addEventListener('click', () => closeModal('modal-howto'));

  // Pause
  document.getElementById('pause-btn').addEventListener('click', () => {
    if (state.paused) resumeGame(); else pauseGame();
  });
  document.getElementById('resume-btn').addEventListener('click', () => resumeGame());
  document.getElementById('restart-btn').addEventListener('click', () => {
    // Clear timers first
    if (state.orderInterval) { clearInterval(state.orderInterval); state.orderInterval = null; }
    Object.values(state.orderTimers).forEach(t => clearInterval(t));
    state.orderTimers = {};
    if (state.brewTimer) { clearInterval(state.brewTimer); state.brewTimer = null; }
    closeModal('modal-pause');
    startGame(true);
  });
  document.getElementById('pause-menu-btn').addEventListener('click', () => {
    if (state.orderInterval) { clearInterval(state.orderInterval); state.orderInterval = null; }
    Object.values(state.orderTimers).forEach(t => clearInterval(t));
    state.orderTimers = {};
    if (state.brewTimer) { clearInterval(state.brewTimer); state.brewTimer = null; }
    state.gameStarted = false;
    state.paused = false;
    state.brewing = false;
    state.isAddingIngredient = false;
    for (const id of state.cauldronIngredients) {
      addIngredient(id, 1);
    }
    state.cauldronIngredients = [];
    clearSlots();
    saveGame();
    closeModal('modal-pause');
    openModal('modal-menu');
  });

  // Brewing
  document.getElementById('brew-btn').addEventListener('click', startBrew);
  document.getElementById('clear-btn').addEventListener('click', () => {
    clearCauldron();
  });

  // Cauldron Drag & Drop Listeners
  const cauldronArea = document.querySelector('.cauldron-area');
  if (cauldronArea) {
    cauldronArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      cauldronArea.classList.add('drag-over');
    });
    cauldronArea.addEventListener('dragleave', () => {
      cauldronArea.classList.remove('drag-over');
    });
    cauldronArea.addEventListener('drop', (e) => {
      e.preventDefault();
      cauldronArea.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) {
        addIngredientToCauldron(id);
      }
    });
  }

  for (let i = 0; i < 3; i++) {
    const slotEl = document.getElementById('slot-' + i);
    if (slotEl) {
      slotEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        slotEl.classList.add('drag-over');
      });
      slotEl.addEventListener('dragleave', () => {
        slotEl.classList.remove('drag-over');
      });
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) {
          addIngredientToCauldron(id);
        }
      });
    }
  }

  // Recipe book
  document.getElementById('recipebook-btn').addEventListener('click', openRecipeBook);
  document.getElementById('recipebook-close-btn').addEventListener('click', () => closeModal('modal-recipebook'));

  // Collection
  document.getElementById('open-collection-btn').addEventListener('click', openCollection);
  document.getElementById('collection-close-btn').addEventListener('click', () => closeModal('modal-collection'));

  // Shop
  document.getElementById('open-shop-btn').addEventListener('click', openShop);
  document.getElementById('shop-close-btn').addEventListener('click', () => closeModal('modal-shop'));

  // Brew result
  document.getElementById('result-ok-btn').addEventListener('click', () => {
    closeModal('modal-brew-result');
    renderAll();
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (!document.getElementById('modal-menu').classList.contains('hidden')) return;
      if (!document.getElementById('modal-brew-result').classList.contains('hidden')) return;
      if (state.paused) resumeGame(); else pauseGame();
    }
  });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
function init() {
  // Set initial inventory from INGREDIENTS
  for (const ing of INGREDIENTS) {
    if (!(ing.id in state.inventory)) state.inventory[ing.id] = ing.startQty;
  }

  initCauldron();
  wireEvents();
  openModal('modal-menu');
  renderHUD();
  renderIngredientGrid();
  renderSlots();
}

document.addEventListener('DOMContentLoaded', init);

