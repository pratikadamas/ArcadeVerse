/**
 * ROBO FACTORY - Isometric Factory Automation Puzzle Engine
 * ArcadeVerse HTML5 Game
 * 
 * Features:
 * - Isometric 2.5D factory floor rendering with depth sorting, lighting & shadows
 * - Industrial machinery (Cutter, Assembler, Painter, Packer, Dispensers, Cargo Bays)
 * - Deterministic material simulation with sub-tick 60 FPS smooth interpolation
 * - Immediate simulation response (zero lag on start), multi-port feeding, and reliable delivery detection
 * - Web Audio API procedural sound engine
 * - 5 progressive puzzle missions with guaranteed valid solutions
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS, GRID & ISOMETRIC PROJECTION
  // ==========================================================================

  const GRID_COLS = 10;
  const GRID_ROWS = 7;

  // Isometric tile geometry
  const TILE_WIDTH = 90;
  const TILE_HEIGHT = 46;
  const TILE_DEPTH = 18; // 3D block thickness

  // Canvas internal buffer size
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 720;

  // Origin point for isometric grid center
  const ORIGIN_X = CANVAS_WIDTH / 2;
  const ORIGIN_Y = 135;

  // Cardinal Directions
  const DIR = {
    UP: 0,    // North-West in isometric
    RIGHT: 1, // North-East in isometric
    DOWN: 2,  // South-East in isometric
    LEFT: 3   // South-West in isometric
  };

  const DIR_VECTORS = [
    { x: 0, y: -1 }, // UP (y - 1)
    { x: 1, y: 0 },  // RIGHT (x + 1)
    { x: 0, y: 1 },  // DOWN (y + 1)
    { x: -1, y: 0 }  // LEFT (x - 1)
  ];

  const DIR_NAMES = ['NORTH (UP)', 'EAST (RIGHT)', 'SOUTH (DOWN)', 'WEST (LEFT)'];
  const OPPOSITE_DIR = [DIR.DOWN, DIR.LEFT, DIR.UP, DIR.RIGHT];

  // Component Types
  const CELL_TYPE = {
    EMPTY: 'empty',
    OBSTACLE: 'obstacle',
    SPAWNER: 'spawner',
    DELIVERY: 'delivery',
    CONVEYOR: 'conveyor',
    CUTTER: 'cutter',
    ASSEMBLER: 'assembler',
    PAINTER: 'painter',
    PACKER: 'packer'
  };

  // Materials & Products
  const ITEM_TYPE = {
    RAW_METAL: 'raw_metal',
    MICROCHIP: 'microchip',
    CHASSIS: 'chassis',
    UNPAINTED_BOT: 'unpainted_bot',
    SECURITY_BOT: 'security_bot',
    EXPLORER_BOT: 'explorer_bot',
    CRATED_CHASSIS: 'crated_chassis',
    CRATED_BOT: 'crated_bot',
    CRATED_SECURITY: 'crated_security',
    CRATED_EXPLORER: 'crated_explorer'
  };

  const ITEM_DEFS = {
    [ITEM_TYPE.RAW_METAL]: {
      name: 'Raw Metal Ore',
      color: '#94a3b8',
      glow: '#cbd5e1',
      shape: 'ore'
    },
    [ITEM_TYPE.MICROCHIP]: {
      name: 'Neural Microchip',
      color: '#10b981',
      glow: '#34d399',
      shape: 'chip'
    },
    [ITEM_TYPE.CHASSIS]: {
      name: 'Robot Chassis',
      color: '#f97316',
      glow: '#fb923c',
      shape: 'chassis'
    },
    [ITEM_TYPE.UNPAINTED_BOT]: {
      name: 'Assembled Robot',
      color: '#e2e8f0',
      glow: '#f8fafc',
      shape: 'bot'
    },
    [ITEM_TYPE.SECURITY_BOT]: {
      name: 'Security Bot',
      color: '#ff9f1c',
      glow: '#ffa938',
      shape: 'bot_orange'
    },
    [ITEM_TYPE.EXPLORER_BOT]: {
      name: 'Explorer Bot',
      color: '#00f0ff',
      glow: '#38f3ff',
      shape: 'bot_cyan'
    },
    [ITEM_TYPE.CRATED_CHASSIS]: {
      name: 'Crated Chassis',
      color: '#c084fc',
      glow: '#d8b4fe',
      shape: 'crate'
    },
    [ITEM_TYPE.CRATED_BOT]: {
      name: 'Crated Robot',
      color: '#c084fc',
      glow: '#d8b4fe',
      shape: 'crate'
    },
    [ITEM_TYPE.CRATED_SECURITY]: {
      name: 'Crated Security Bot',
      color: '#f43f5e',
      glow: '#fb7185',
      shape: 'crate_orange'
    },
    [ITEM_TYPE.CRATED_EXPLORER]: {
      name: 'Crated Explorer Bot',
      color: '#06b6d4',
      glow: '#22d3ee',
      shape: 'crate_cyan'
    }
  };

  // Isometric Projection Helpers
  function gridToScreen(gx, gy) {
    const sx = (gx - gy) * (TILE_WIDTH / 2) + ORIGIN_X;
    const sy = (gx + gy) * (TILE_HEIGHT / 2) + ORIGIN_Y;
    return { x: sx, y: sy };
  }

  function screenToGrid(sx, sy) {
    const dx = sx - ORIGIN_X;
    const dy = sy - ORIGIN_Y;
    const gx = (dx / (TILE_WIDTH / 2) + dy / (TILE_HEIGHT / 2)) / 2;
    const gy = (dy / (TILE_HEIGHT / 2) - dx / (TILE_WIDTH / 2)) / 2;
    return { x: Math.floor(gx), y: Math.floor(gy) };
  }

  // ==========================================================================
  // 2. PROCEDURAL SOUND SYNTHESIS (WEB AUDIO API)
  // ==========================================================================

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      try {
        const stored = localStorage.getItem('robofactory_sound_muted');
        if (stored !== null) this.enabled = stored !== 'true';
      } catch (e) {}
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      try {
        localStorage.setItem('robofactory_sound_muted', (!this.enabled).toString());
      } catch (e) {}
      if (this.enabled) this.playTone(600, 'triangle', 0.05, 0.08, 400);
      return this.enabled;
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1, endFreq = null) {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (endFreq !== null) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    playPlace() { this.playTone(480, 'sine', 0.07, 0.1, 700); }
    playRotate() { this.playTone(650, 'sine', 0.05, 0.08, 850); }
    playDemolish() { this.playTone(260, 'sawtooth', 0.09, 0.08, 120); }
    playCut() { this.playTone(900, 'sawtooth', 0.14, 0.08, 350); }
    playAssemble() { this.playTone(340, 'square', 0.16, 0.08, 620); }
    playPaint() { this.playTone(1300, 'triangle', 0.15, 0.06, 850); }
    playPack() { this.playTone(200, 'triangle', 0.18, 0.12, 90); }

    playDelivery() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 'sine', 0.25, 0.1), idx * 60);
      });
    }

    playVictory() {
      if (!this.enabled) return;
      this.ensureContext();
      if (!this.ctx) return;
      [440, 554.37, 659.25, 880].forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 'triangle', 0.35, 0.14), idx * 120);
      });
    }
  }

  const audio = new SoundEngine();

  // ==========================================================================
  // 3. LEVEL DEFINITIONS (5 PROGRESSIVE FACTORY MISSIONS)
  // ==========================================================================

  const LEVELS = [
    {
      id: 1,
      title: 'First Assembly',
      tagline: 'Connect the raw metal dispenser to the cutter and shipping dock.',
      hint: 'Place Conveyor Belts [1] to route Raw Metal into Cutter [2], then route Chassis into the Cargo Bay!',
      allowedTools: [CELL_TYPE.CONVEYOR, CELL_TYPE.CUTTER],
      targetTime: 40,
      objectives: [
        { type: ITEM_TYPE.CHASSIS, count: 3, current: 0 }
      ],
      spawners: [
        { x: 1, y: 3, dir: DIR.RIGHT, itemType: ITEM_TYPE.RAW_METAL, interval: 2.5 }
      ],
      deliveries: [
        { x: 8, y: 3, acceptedTypes: [ITEM_TYPE.CHASSIS] }
      ],
      obstacles: [
        { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ]
    },
    {
      id: 2,
      title: 'Assembly Line',
      tagline: 'Combine chassis and neural microchips using the Assembler.',
      hint: 'Route Chassis from Cutter and Microchips from Dispenser into Assembler [3]!',
      allowedTools: [CELL_TYPE.CONVEYOR, CELL_TYPE.CUTTER, CELL_TYPE.ASSEMBLER],
      targetTime: 55,
      objectives: [
        { type: ITEM_TYPE.UNPAINTED_BOT, count: 3, current: 0 }
      ],
      spawners: [
        { x: 1, y: 1, dir: DIR.RIGHT, itemType: ITEM_TYPE.RAW_METAL, interval: 2.8 },
        { x: 1, y: 5, dir: DIR.RIGHT, itemType: ITEM_TYPE.MICROCHIP, interval: 2.8 }
      ],
      deliveries: [
        { x: 8, y: 3, acceptedTypes: [ITEM_TYPE.UNPAINTED_BOT] }
      ],
      obstacles: [
        { x: 4, y: 3 }
      ]
    },
    {
      id: 3,
      title: 'Color Coating',
      tagline: 'Paint assembled robots into Security and Explorer models.',
      hint: 'Feed assembled bots through Painters [4] with Cyan and Orange coats to both bays!',
      allowedTools: [CELL_TYPE.CONVEYOR, CELL_TYPE.PAINTER],
      targetTime: 65,
      objectives: [
        { type: ITEM_TYPE.SECURITY_BOT, count: 2, current: 0 },
        { type: ITEM_TYPE.EXPLORER_BOT, count: 2, current: 0 }
      ],
      spawners: [
        { x: 1, y: 3, dir: DIR.RIGHT, itemType: ITEM_TYPE.UNPAINTED_BOT, interval: 2.4 }
      ],
      deliveries: [
        { x: 8, y: 1, acceptedTypes: [ITEM_TYPE.SECURITY_BOT] },
        { x: 8, y: 5, acceptedTypes: [ITEM_TYPE.EXPLORER_BOT] }
      ],
      obstacles: [
        { x: 4, y: 3 }
      ]
    },
    {
      id: 4,
      title: 'Packaging Division',
      tagline: 'Package finished bots into pressurized orbital cargo crates.',
      hint: 'Route robot chassis into the Packer [5] to seal orbital cargo crates!',
      allowedTools: [CELL_TYPE.CONVEYOR, CELL_TYPE.CUTTER, CELL_TYPE.PACKER],
      targetTime: 60,
      objectives: [
        { type: ITEM_TYPE.CRATED_CHASSIS, count: 3, current: 0 }
      ],
      spawners: [
        { x: 1, y: 2, dir: DIR.RIGHT, itemType: ITEM_TYPE.RAW_METAL, interval: 2.5 }
      ],
      deliveries: [
        { x: 8, y: 4, acceptedTypes: [ITEM_TYPE.CRATED_CHASSIS] }
      ],
      obstacles: [
        { x: 4, y: 2 }, { x: 5, y: 4 }
      ]
    },
    {
      id: 5,
      title: 'Master Mega-Factory',
      tagline: 'Full automated orbital manufacturing from raw metal to crated bots.',
      hint: 'Orchestrate Cutters, Assemblers, Painters, and Packers to ship both crated models!',
      allowedTools: [CELL_TYPE.CONVEYOR, CELL_TYPE.CUTTER, CELL_TYPE.ASSEMBLER, CELL_TYPE.PAINTER, CELL_TYPE.PACKER],
      targetTime: 90,
      objectives: [
        { type: ITEM_TYPE.CRATED_SECURITY, count: 2, current: 0 },
        { type: ITEM_TYPE.CRATED_EXPLORER, count: 2, current: 0 }
      ],
      spawners: [
        { x: 1, y: 1, dir: DIR.RIGHT, itemType: ITEM_TYPE.RAW_METAL, interval: 2.6 },
        { x: 1, y: 5, dir: DIR.RIGHT, itemType: ITEM_TYPE.MICROCHIP, interval: 2.6 }
      ],
      deliveries: [
        { x: 8, y: 1, acceptedTypes: [ITEM_TYPE.CRATED_SECURITY] },
        { x: 8, y: 5, acceptedTypes: [ITEM_TYPE.CRATED_EXPLORER] }
      ],
      obstacles: [
        { x: 4, y: 3 }, { x: 5, y: 3 }
      ]
    }
  ];

  // ==========================================================================
  // 4. FACTORY SIMULATION & GRID ENGINE
  // ==========================================================================

  class FactorySimulation {
    constructor() {
      this.grid = [];
      this.items = [];
      this.particles = [];
      this.floatingTexts = [];
      this.nextItemId = 1;

      this.currentLevelIndex = 0;
      this.levelData = null;

      this.isRunning = false;
      this.simSpeed = 1; // 1 or 2
      this.elapsedSeconds = 0;
      this.score = 0;

      // Construction state
      this.selectedTool = CELL_TYPE.CONVEYOR;
      this.conveyorDir = DIR.RIGHT;
      this.painterColor = 'cyan';
      this.hoverTile = null;
      this.isMouseDown = false;
      this.dragAction = null;

      // Stars storage
      this.starsData = {};
      try {
        const d = localStorage.getItem('robofactory_stars');
        if (d) this.starsData = JSON.parse(d);
      } catch (e) {}

      // Pacing: 5 ticks/second at 1X speed (200ms per tick)
      this.tickDuration = 0.20;
      this.tickAccumulator = 0;
    }

    saveStars() {
      try {
        localStorage.setItem('robofactory_stars', JSON.stringify(this.starsData));
      } catch (e) {}
    }

    initGrid() {
      this.grid = [];
      for (let y = 0; y < GRID_ROWS; y++) {
        const row = [];
        for (let x = 0; x < GRID_COLS; x++) {
          row.push({
            type: CELL_TYPE.EMPTY,
            dir: DIR.RIGHT,      // Conveyor direction or Machine output direction
            inDir: DIR.LEFT,     // Preferred primary input port
            outDir: DIR.RIGHT,   // Output eject direction
            machineState: 'idle', // 'idle', 'working', 'blocked'
            processProgress: 0,
            processDuration: 1.2,
            buffer: [],          // Internal ingredient storage
            color: 'cyan',       // For painter
            fixed: false
          });
        }
        this.grid.push(row);
      }
    }

    loadLevel(levelIndex) {
      if (levelIndex < 0 || levelIndex >= LEVELS.length) levelIndex = 0;
      this.currentLevelIndex = levelIndex;
      this.levelData = JSON.parse(JSON.stringify(LEVELS[levelIndex]));

      this.initGrid();
      this.items = [];
      this.particles = [];
      this.floatingTexts = [];
      this.isRunning = false;
      this.elapsedSeconds = 0;
      this.tickAccumulator = 0;

      // Place Obstacles
      this.levelData.obstacles.forEach(ob => {
        const cell = this.grid[ob.y][ob.x];
        cell.type = CELL_TYPE.OBSTACLE;
        cell.fixed = true;
      });

      // Place Spawners
      this.levelData.spawners.forEach(sp => {
        const cell = this.grid[sp.y][sp.x];
        cell.type = CELL_TYPE.SPAWNER;
        cell.dir = sp.dir;
        cell.outDir = sp.dir;
        cell.itemType = sp.itemType;
        cell.interval = sp.interval;
        cell.spawnTimer = sp.interval; // Ready to spawn immediately on start!
        cell.fixed = true;
      });

      // Place Deliveries
      this.levelData.deliveries.forEach(del => {
        const cell = this.grid[del.y][del.x];
        cell.type = CELL_TYPE.DELIVERY;
        cell.acceptedTypes = del.acceptedTypes;
        cell.fixed = true;
      });

      this.updateUI();
    }

    // Set / Modify Tile
    setTile(x, y, toolType) {
      if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return;
      const cell = this.grid[y][x];
      if (cell.fixed) return; // Cannot overwrite fixed spawners, deliveries, or obstacles

      if (toolType === CELL_TYPE.EMPTY || toolType === 'demolish') {
        // Clear components & materials at this cell
        this.items = this.items.filter(it => !(Math.round(it.x) === x && Math.round(it.y) === y));
        cell.type = CELL_TYPE.EMPTY;
        cell.buffer = [];
        cell.machineState = 'idle';
        cell.processProgress = 0;
        audio.playDemolish();
        return;
      }

      // Check tool permission in current level
      if (this.levelData && !this.levelData.allowedTools.includes(toolType)) {
        return;
      }

      cell.type = toolType;
      cell.buffer = [];
      cell.processProgress = 0;
      cell.machineState = 'idle';

      if (toolType === CELL_TYPE.CONVEYOR) {
        cell.dir = this.conveyorDir;
      } else {
        // Machine default: outputs East (RIGHT), accepts from other 3 sides
        cell.outDir = DIR.RIGHT;
        cell.dir = DIR.RIGHT;
        cell.inDir = DIR.LEFT;
        if (toolType === CELL_TYPE.PAINTER) {
          cell.color = this.painterColor;
        }
      }

      audio.playPlace();
    }

    rotateTile(x, y) {
      if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return;
      const cell = this.grid[y][x];
      if (cell.fixed) return;

      if (cell.type === CELL_TYPE.CONVEYOR) {
        cell.dir = (cell.dir + 1) % 4;
        audio.playRotate();
      } else if ([CELL_TYPE.CUTTER, CELL_TYPE.ASSEMBLER, CELL_TYPE.PAINTER, CELL_TYPE.PACKER].includes(cell.type)) {
        cell.outDir = (cell.outDir + 1) % 4;
        cell.dir = cell.outDir;
        if (cell.type === CELL_TYPE.PAINTER) {
          cell.color = cell.color === 'cyan' ? 'orange' : 'cyan';
        }
        audio.playRotate();
      }
    }

    clearLayout() {
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const cell = this.grid[y][x];
          if (!cell.fixed) {
            cell.type = CELL_TYPE.EMPTY;
            cell.buffer = [];
            cell.processProgress = 0;
            cell.machineState = 'idle';
          }
        }
      }
      this.items = [];
      audio.playDemolish();
    }

    resetSimulation() {
      this.isRunning = false;
      this.items = [];
      this.particles = [];
      this.tickAccumulator = 0;

      // Reset spawners & machine buffers
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const cell = this.grid[y][x];
          cell.buffer = [];
          cell.processProgress = 0;
          cell.machineState = 'idle';
          if (cell.type === CELL_TYPE.SPAWNER) {
            cell.spawnTimer = cell.interval; // Immediate spawn on restart
          }
        }
      }

      // Reset objectives counter
      if (this.levelData) {
        this.levelData.objectives.forEach(obj => {
          obj.current = 0;
        });
      }

      this.updateUI();
    }

    toggleSimulation() {
      this.isRunning = !this.isRunning;
      if (this.isRunning) {
        // Trigger immediate spawn check on start
        this.levelData.spawners.forEach(sp => {
          const cell = this.grid[sp.y][sp.x];
          cell.spawnTimer = cell.interval;
        });
      }
      audio.playPlace();
      this.updateUI();
    }

    toggleSpeed() {
      this.simSpeed = this.simSpeed === 1 ? 2 : 1;
      audio.playRotate();
      this.updateUI();
    }

    // ==========================================================================
    // 5. DETERMINISTIC SIMULATION TICK & MATERIAL FLOW
    // ==========================================================================

    stepSimulation(dt) {
      if (!this.isRunning) return;

      this.elapsedSeconds += dt;
      this.tickAccumulator += dt * this.simSpeed;

      while (this.tickAccumulator >= this.tickDuration) {
        this.tickAccumulator -= this.tickDuration;
        this.runSimulationTick();
      }

      this.updateParticles(dt * this.simSpeed);
      this.updateFloatingTexts(dt);
    }

    runSimulationTick() {
      const g = this.grid;

      // 1. SPAWNERS EMIT ITEMS (Zero-lag start)
      this.levelData.spawners.forEach(sp => {
        const cell = g[sp.y][sp.x];
        cell.spawnTimer = (cell.spawnTimer || 0) + this.tickDuration;
        if (cell.spawnTimer >= cell.interval) {
          const targetX = sp.x + DIR_VECTORS[sp.dir].x;
          const targetY = sp.y + DIR_VECTORS[sp.dir].y;

          if (this.isTileVacant(targetX, targetY)) {
            cell.spawnTimer = 0;
            this.spawnItem(targetX, targetY, sp.itemType);
            this.createPuff(targetX, targetY, '#00f0ff');
          }
        }
      });

      // 2. MACHINE PROCESSING
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const cell = g[y][x];
          if (![CELL_TYPE.CUTTER, CELL_TYPE.ASSEMBLER, CELL_TYPE.PAINTER, CELL_TYPE.PACKER].includes(cell.type)) continue;

          this.processMachine(cell, x, y);
        }
      }

      // 3. MOVE ITEMS ALONG CONVEYORS
      const activeItems = [...this.items];

      activeItems.forEach(item => {
        const curX = Math.round(item.x);
        const curY = Math.round(item.y);

        if (curX < 0 || curX >= GRID_COLS || curY < 0 || curY >= GRID_ROWS) {
          item.dead = true;
          return;
        }

        const curCell = g[curY][curX];

        if (curCell.type === CELL_TYPE.CONVEYOR) {
          const nextX = curX + DIR_VECTORS[curCell.dir].x;
          const nextY = curY + DIR_VECTORS[curCell.dir].y;

          if (nextX < 0 || nextX >= GRID_COLS || nextY < 0 || nextY >= GRID_ROWS) {
            item.blocked = true;
            return;
          }

          const nextCell = g[nextY][nextX];

          // Target is Conveyor
          if (nextCell.type === CELL_TYPE.CONVEYOR) {
            if (this.isTileVacant(nextX, nextY, item.id)) {
              item.targetX = nextX;
              item.targetY = nextY;
              item.blocked = false;
            } else {
              item.blocked = true;
            }
          }
          // Target is Delivery Bay
          else if (nextCell.type === CELL_TYPE.DELIVERY) {
            item.targetX = nextX;
            item.targetY = nextY;
            item.enteringDelivery = true;
            item.blocked = false;
          }
          // Target is Machine
          else if ([CELL_TYPE.CUTTER, CELL_TYPE.ASSEMBLER, CELL_TYPE.PAINTER, CELL_TYPE.PACKER].includes(nextCell.type)) {
            // Flexible Input Rule: Accept from ANY side except the machine's output side!
            const entryVec = { x: nextX - curX, y: nextY - curY };
            const isFromOutputSide = (DIR_VECTORS[nextCell.outDir].x === -entryVec.x &&
                                      DIR_VECTORS[nextCell.outDir].y === -entryVec.y);

            if (!isFromOutputSide && this.canMachineAccept(nextCell, item.type)) {
              item.targetX = nextX;
              item.targetY = nextY;
              item.enteringMachine = true;
              item.blocked = false;
            } else {
              item.blocked = true;
            }
          } else {
            item.blocked = true;
          }
        }
      });

      // Commit item movements
      this.items.forEach(item => {
        if (item.targetX !== undefined && !item.blocked) {
          item.prevX = item.x;
          item.prevY = item.y;
          item.x = item.targetX;
          item.y = item.targetY;
          delete item.targetX;
          delete item.targetY;

          if (item.enteringDelivery) {
            this.handleDeliveryArrival(item);
          } else if (item.enteringMachine) {
            this.handleMachineIngestion(item);
          }
        }
      });

      this.items = this.items.filter(it => !it.dead);
    }

    isTileVacant(x, y, excludeId = null) {
      // Check both current tile position and planned destination to prevent corner squeezing (#593)
      return !this.items.some(it => it.id !== excludeId && ((Math.round(it.x) === x && Math.round(it.y) === y) || (it.targetX === x && it.targetY === y)));
    }

    spawnItem(x, y, type) {
      const item = {
        id: this.nextItemId++,
        type,
        x,
        y,
        prevX: x,
        prevY: y,
        blocked: false
      };
      this.items.push(item);
      return item;
    }

    canMachineAccept(cell, itemType) {
      if (cell.type === CELL_TYPE.CUTTER) {
        return itemType === ITEM_TYPE.RAW_METAL && cell.buffer.length === 0;
      }
      if (cell.type === CELL_TYPE.ASSEMBLER) {
        if (cell.buffer.length >= 2) return false;
        if (itemType === ITEM_TYPE.CHASSIS && !cell.buffer.includes(ITEM_TYPE.CHASSIS)) return true;
        if (itemType === ITEM_TYPE.MICROCHIP && !cell.buffer.includes(ITEM_TYPE.MICROCHIP)) return true;
        return false;
      }
      if (cell.type === CELL_TYPE.PAINTER) {
        return itemType === ITEM_TYPE.UNPAINTED_BOT && cell.buffer.length === 0;
      }
      if (cell.type === CELL_TYPE.PACKER) {
        const packable = [
          ITEM_TYPE.CHASSIS,
          ITEM_TYPE.UNPAINTED_BOT,
          ITEM_TYPE.SECURITY_BOT,
          ITEM_TYPE.EXPLORER_BOT
        ];
        return packable.includes(itemType) && cell.buffer.length === 0;
      }
      return false;
    }

    handleMachineIngestion(item) {
      const x = Math.round(item.x);
      const y = Math.round(item.y);
      const cell = this.grid[y][x];
      cell.buffer.push(item.type);
      item.dead = true;
      this.createPuff(x, y, '#ff9f1c');
    }

    processMachine(cell, x, y) {
      // CUTTER: Raw Metal -> Chassis
      if (cell.type === CELL_TYPE.CUTTER) {
        if (cell.buffer.includes(ITEM_TYPE.RAW_METAL)) {
          cell.machineState = 'working';
          cell.processProgress += (this.tickDuration / cell.processDuration);
          if (cell.processProgress >= 1.0) {
            const outX = x + DIR_VECTORS[cell.outDir].x;
            const outY = y + DIR_VECTORS[cell.outDir].y;
            if (this.isTileVacant(outX, outY)) {
              cell.buffer = [];
              cell.processProgress = 0;
              cell.machineState = 'idle';
              this.spawnItem(outX, outY, ITEM_TYPE.CHASSIS);
              audio.playCut();
              this.createSparks(x, y);
            }
          }
        } else {
          cell.machineState = 'idle';
          cell.processProgress = 0;
        }
      }

      // ASSEMBLER: Chassis + Microchip -> Assembled Robot
      else if (cell.type === CELL_TYPE.ASSEMBLER) {
        const hasChassis = cell.buffer.includes(ITEM_TYPE.CHASSIS);
        const hasChip = cell.buffer.includes(ITEM_TYPE.MICROCHIP);

        if (hasChassis && hasChip) {
          cell.machineState = 'working';
          cell.processProgress += (this.tickDuration / cell.processDuration);
          if (cell.processProgress >= 1.0) {
            const outX = x + DIR_VECTORS[cell.outDir].x;
            const outY = y + DIR_VECTORS[cell.outDir].y;
            if (this.isTileVacant(outX, outY)) {
              cell.buffer = [];
              cell.processProgress = 0;
              cell.machineState = 'idle';
              this.spawnItem(outX, outY, ITEM_TYPE.UNPAINTED_BOT);
              audio.playAssemble();
              this.createLaserArc(x, y);
            }
          }
        } else {
          cell.machineState = cell.buffer.length > 0 ? 'waiting' : 'idle';
          cell.processProgress = 0;
        }
      }

      // PAINTER: Assembled Bot -> Security (Orange) or Explorer (Cyan)
      else if (cell.type === CELL_TYPE.PAINTER) {
        if (cell.buffer.includes(ITEM_TYPE.UNPAINTED_BOT)) {
          cell.machineState = 'working';
          cell.processProgress += (this.tickDuration / cell.processDuration);
          if (cell.processProgress >= 1.0) {
            const outX = x + DIR_VECTORS[cell.outDir].x;
            const outY = y + DIR_VECTORS[cell.outDir].y;
            if (this.isTileVacant(outX, outY)) {
              cell.buffer = [];
              cell.processProgress = 0;
              cell.machineState = 'idle';
              const outcome = cell.color === 'orange' ? ITEM_TYPE.SECURITY_BOT : ITEM_TYPE.EXPLORER_BOT;
              this.spawnItem(outX, outY, outcome);
              audio.playPaint();
              this.createPuff(x, y, cell.color === 'orange' ? '#ff9f1c' : '#00f0ff');
            }
          }
        } else {
          cell.machineState = 'idle';
          cell.processProgress = 0;
        }
      }

      // PACKER: Bot / Chassis -> Orbital Crate
      else if (cell.type === CELL_TYPE.PACKER) {
        if (cell.buffer.length > 0) {
          cell.machineState = 'working';
          cell.processProgress += (this.tickDuration / cell.processDuration);
          if (cell.processProgress >= 1.0) {
            const inType = cell.buffer[0];
            let outType = ITEM_TYPE.CRATED_BOT;
            if (inType === ITEM_TYPE.CHASSIS) outType = ITEM_TYPE.CRATED_CHASSIS;
            else if (inType === ITEM_TYPE.SECURITY_BOT) outType = ITEM_TYPE.CRATED_SECURITY;
            else if (inType === ITEM_TYPE.EXPLORER_BOT) outType = ITEM_TYPE.CRATED_EXPLORER;

            const outX = x + DIR_VECTORS[cell.outDir].x;
            const outY = y + DIR_VECTORS[cell.outDir].y;
            if (this.isTileVacant(outX, outY)) {
              cell.buffer = [];
              cell.processProgress = 0;
              cell.machineState = 'idle';
              this.spawnItem(outX, outY, outType);
              audio.playPack();
              this.createPuff(x, y, '#c084fc');
            }
          }
        } else {
          cell.machineState = 'idle';
          cell.processProgress = 0;
        }
      }
    }

    handleDeliveryArrival(item) {
      const x = Math.round(item.x);
      const y = Math.round(item.y);
      item.dead = true;

      let matched = false;
      this.levelData.objectives.forEach(obj => {
        if (obj.type === item.type && obj.current < obj.count) {
          obj.current++;
          matched = true;
        }
      });

      if (matched) {
        this.score += 250;
        audio.playDelivery();
        this.createCelebrationBurst(x, y);
        this.showToast(`+250 ${ITEM_DEFS[item.type].name.toUpperCase()} DELIVERED!`, 'success');
        this.addFloatingText(x, y, '+250', '#00e676');
      } else {
        this.score = Math.max(0, this.score - 50);
        this.createPuff(x, y, '#ff3366');
        this.showToast('WRONG PRODUCT DELIVERED (-50)', 'warning');
        this.addFloatingText(x, y, 'WRONG ITEM', '#ff3366');
      }

      this.updateUI();
      this.checkLevelCompletion();
    }

    checkLevelCompletion() {
      if (!this.levelData) return;
      const allComplete = this.levelData.objectives.every(obj => obj.current >= obj.count);

      if (allComplete) {
        this.isRunning = false;
        audio.playVictory();
        this.showVictoryScreen();
      }
    }

    showVictoryScreen() {
      let stars = 1;
      if (this.elapsedSeconds <= this.levelData.targetTime) stars++;
      if (this.items.filter(it => it.blocked).length === 0) stars++;

      const prevStars = this.starsData[this.currentLevelIndex] || 0;
      if (stars > prevStars) {
        this.starsData[this.currentLevelIndex] = stars;
        this.saveStars();
      }

      const modal = document.getElementById('modal-victory');
      const vicStars = document.getElementById('vic-stars-container');
      const vicTime = document.getElementById('vic-time');
      const vicDelivered = document.getElementById('vic-delivered');
      const vicEfficiency = document.getElementById('vic-efficiency');
      const vicScore = document.getElementById('vic-score');

      const mins = Math.floor(this.elapsedSeconds / 60);
      const secs = Math.floor(this.elapsedSeconds % 60);
      vicTime.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

      const totalReq = this.levelData.objectives.reduce((sum, o) => sum + o.count, 0);
      vicDelivered.textContent = `${totalReq} / ${totalReq}`;

      const eff = Math.max(70, Math.min(100, Math.round(100 - (this.elapsedSeconds / this.levelData.targetTime) * 15)));
      vicEfficiency.textContent = `${eff}%`;

      const finalScore = this.score + (stars * 500) + Math.max(0, (this.levelData.targetTime - this.elapsedSeconds) * 20);
      vicScore.textContent = `+${Math.round(finalScore)}`;

      const starBoxes = vicStars.querySelectorAll('.star-box');
      starBoxes.forEach((box, idx) => {
        box.classList.toggle('earned', idx < stars);
      });

      modal.classList.remove('hidden');
    }

    showToast(message, type = 'success') {
      const container = document.getElementById('factory-alerts-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `factory-toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 1800);
    }

    addFloatingText(gx, gy, text, color) {
      const sc = gridToScreen(gx, gy);
      this.floatingTexts.push({
        x: sc.x,
        y: sc.y - 15,
        text,
        color,
        alpha: 1.0,
        vy: -30
      });
    }

    updateFloatingTexts(dt) {
      this.floatingTexts.forEach(ft => {
        ft.y += ft.vy * dt;
        ft.alpha -= dt * 1.2;
      });
      this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0);
    }

    // ==========================================================================
    // 6. PARTICLE EFFECTS
    // ==========================================================================

    createPuff(gx, gy, color) {
      const sc = gridToScreen(gx, gy);
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x: sc.x,
          y: sc.y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 40 - 20,
          size: Math.random() * 4 + 2,
          color,
          alpha: 1,
          life: 0.45
        });
      }
    }

    createSparks(gx, gy) {
      const sc = gridToScreen(gx, gy);
      for (let i = 0; i < 12; i++) {
        this.particles.push({
          x: sc.x,
          y: sc.y - 10,
          vx: (Math.random() - 0.5) * 90,
          vy: (Math.random() - 0.5) * 70 - 25,
          size: Math.random() * 3 + 1,
          color: '#ffd600',
          alpha: 1,
          life: 0.35
        });
      }
    }

    createLaserArc(gx, gy) {
      const sc = gridToScreen(gx, gy);
      for (let i = 0; i < 10; i++) {
        this.particles.push({
          x: sc.x + (Math.random() - 0.5) * 16,
          y: sc.y - 10 + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 50,
          vy: (Math.random() - 0.5) * 40 - 15,
          size: Math.random() * 3 + 1,
          color: '#00f0ff',
          alpha: 1,
          life: 0.28
        });
      }
    }

    createCelebrationBurst(gx, gy) {
      const sc = gridToScreen(gx, gy);
      const colors = ['#00e676', '#00f0ff', '#ffd600', '#ff9f1c'];
      for (let i = 0; i < 26; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 120 + 40;
        this.particles.push({
          x: sc.x,
          y: sc.y - 10,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 30,
          size: Math.random() * 4 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: 0.75
        });
      }
    }

    updateParticles(dt) {
      this.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= dt / p.life;
      });
      this.particles = this.particles.filter(p => p.alpha > 0);
    }

    // ==========================================================================
    // 7. ISOMETRIC 2.5D CANVAS RENDERING ENGINE
    // ==========================================================================

    render(ctx, interpAlpha) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Industrial Background
      this.renderIndustrialEnvironment(ctx);

      // Ground Slabs (Depth-Sorted)
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          this.renderIsometricFloorTile(ctx, x, y);
        }
      }

      // Components & Machines (Depth-Sorted Order: row by row, col by col)
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          this.renderIsometricComponent(ctx, x, y);
        }
      }

      // Moving Materials & Products
      this.renderMaterials(ctx, interpAlpha);

      // Particle Overlay
      this.renderParticles(ctx);

      // Floating Texts
      this.renderFloatingTexts(ctx);

      // Cursor Hover Preview
      this.renderHoverHighlight(ctx);
    }

    renderIndustrialEnvironment(ctx) {
      // Dark metallic floor gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bg.addColorStop(0, '#070b14');
      bg.addColorStop(0.5, '#0c1220');
      bg.addColorStop(1, '#05080f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Ambient Factory Truss Shadows & Lighting
      ctx.save();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
      ctx.beginPath();
      ctx.arc(ORIGIN_X, ORIGIN_Y + 150, 420, 0, Math.PI * 2);
      ctx.fill();

      // Industrial hazard lines along top/bottom
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.15)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(40, 40);
      ctx.lineTo(CANVAS_WIDTH - 40, 40);
      ctx.moveTo(40, CANVAS_HEIGHT - 30);
      ctx.lineTo(CANVAS_WIDTH - 40, CANVAS_HEIGHT - 30);
      ctx.stroke();
      ctx.restore();
    }

    renderIsometricFloorTile(ctx, gx, gy) {
      const { x: sx, y: sy } = gridToScreen(gx, gy);
      const halfW = TILE_WIDTH / 2;
      const halfH = TILE_HEIGHT / 2;
      const cell = this.grid[gy][gx];

      ctx.save();

      // 3D Slab Thickness (Left & Right Extruded Faces)
      ctx.fillStyle = '#0a0f1d';
      ctx.beginPath();
      ctx.moveTo(sx - halfW, sy);
      ctx.lineTo(sx, sy + halfH);
      ctx.lineTo(sx, sy + halfH + TILE_DEPTH);
      ctx.lineTo(sx - halfW, sy + TILE_DEPTH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#060a14';
      ctx.beginPath();
      ctx.moveTo(sx, sy + halfH);
      ctx.lineTo(sx + halfW, sy);
      ctx.lineTo(sx + halfW, sy + TILE_DEPTH);
      ctx.lineTo(sx, sy + halfH + TILE_DEPTH);
      ctx.closePath();
      ctx.fill();

      // Top Diamond Face
      let topFill = '#111827';
      let strokeColor = '#1e293b';

      if (cell.type === CELL_TYPE.OBSTACLE) {
        topFill = '#1a1016';
        strokeColor = '#dc2626';
      }

      ctx.fillStyle = topFill;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(sx, sy - halfH);
      ctx.lineTo(sx + halfW, sy);
      ctx.lineTo(sx, sy + halfH);
      ctx.lineTo(sx - halfW, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Subtle metallic plate center bolt
      ctx.fillStyle = '#334155';
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);

      ctx.restore();
    }

    renderIsometricComponent(ctx, gx, gy) {
      const cell = this.grid[gy][gx];
      if (cell.type === CELL_TYPE.EMPTY) return;

      const { x: sx, y: sy } = gridToScreen(gx, gy);
      const halfW = TILE_WIDTH / 2;
      const halfH = TILE_HEIGHT / 2;
      const time = performance.now() * 0.003 * this.simSpeed;

      ctx.save();

      // CONVEYOR BELT
      if (cell.type === CELL_TYPE.CONVEYOR) {
        // Metallic Roller Bed
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(sx, sy - halfH + 4);
        ctx.lineTo(sx + halfW - 8, sy);
        ctx.lineTo(sx, sy + halfH - 4);
        ctx.lineTo(sx - halfW + 8, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Animated Isometric Chevrons along Conveyor
        const dirVec = DIR_VECTORS[cell.dir];
        const screenDirX = (dirVec.x - dirVec.y) * (halfW / 1.6);
        const screenDirY = (dirVec.x + dirVec.y) * (halfH / 1.6);
        const offset = this.isRunning ? (time % 1) : 0.5;

        ctx.fillStyle = this.isRunning ? '#00f0ff' : '#64748b';
        ctx.shadowColor = this.isRunning ? '#00f0ff' : 'transparent';
        ctx.shadowBlur = this.isRunning ? 6 : 0;

        for (let i = -1; i <= 1; i++) {
          const frac = (i + offset) / 2;
          const ax = sx + screenDirX * frac;
          const ay = sy + screenDirY * frac;

          ctx.beginPath();
          ctx.arc(ax, ay, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // DISPENSER (RAW MATERIAL SILO)
      else if (cell.type === CELL_TYPE.SPAWNER) {
        // 3D Storage Silo
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;

        // Pillar Base
        ctx.beginPath();
        ctx.moveTo(sx, sy - halfH);
        ctx.lineTo(sx + halfW - 6, sy);
        ctx.lineTo(sx, sy + halfH - 2);
        ctx.lineTo(sx - halfW + 6, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3D Silo Tank
        ctx.fillStyle = '#047857';
        ctx.fillRect(sx - 16, sy - 38, 32, 34);
        ctx.strokeRect(sx - 16, sy - 38, 32, 34);

        // Blinking beacon on top
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(sx, sy - 42, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DISP', sx, sy - 20);

        // Output Arrow
        this.renderOutArrow(ctx, sx, sy, cell.dir);
      }

      // CARGO DELIVERY BAY
      else if (cell.type === CELL_TYPE.DELIVERY) {
        // Recessed Dock
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(sx, sy - halfH);
        ctx.lineTo(sx + halfW - 4, sy);
        ctx.lineTo(sx, sy + halfH);
        ctx.lineTo(sx - halfW + 4, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Dock Landing Target Ring
        ctx.strokeStyle = '#a5b4fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, halfW / 2, halfH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#c7d2fe';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DOCK', sx, sy + 3);
      }

      // CUTTER MACHINE
      else if (cell.type === CELL_TYPE.CUTTER) {
        this.renderMachineHousing(ctx, sx, sy, halfW, halfH, '#f97316', 'CUTTER');

        // Rotating saw blade
        const spin = cell.machineState === 'working' ? time * 12 : 0;
        ctx.save();
        ctx.translate(sx, sy - 18);
        ctx.rotate(spin);
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
        for (let a = 0; a < 4; a++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(8, -1.5, 5, 3);
        }
        ctx.restore();

        this.renderOutArrow(ctx, sx, sy, cell.outDir);
      }

      // ASSEMBLER MACHINE
      else if (cell.type === CELL_TYPE.ASSEMBLER) {
        this.renderMachineHousing(ctx, sx, sy, halfW, halfH, '#00f0ff', 'ASSEMBLE');

        // Robotic Articulated Arm
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(sx - 10, sy - 26, 20, 12);
        ctx.strokeStyle = '#0284c7';
        ctx.strokeRect(sx - 10, sy - 26, 20, 12);

        // Laser tip glow
        if (cell.machineState === 'working') {
          ctx.fillStyle = '#38f3ff';
          ctx.beginPath();
          ctx.arc(sx, sy - 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        this.renderOutArrow(ctx, sx, sy, cell.outDir);
      }

      // PAINTER MACHINE
      else if (cell.type === CELL_TYPE.PAINTER) {
        const theme = cell.color === 'orange' ? '#ff9f1c' : '#00f0ff';
        this.renderMachineHousing(ctx, sx, sy, halfW, halfH, theme, 'PAINTER');

        // Paint reservoir dome
        ctx.fillStyle = theme;
        ctx.beginPath();
        ctx.arc(sx, sy - 18, 9, 0, Math.PI * 2);
        ctx.fill();

        this.renderOutArrow(ctx, sx, sy, cell.outDir);
      }

      // PACKER MACHINE
      else if (cell.type === CELL_TYPE.PACKER) {
        this.renderMachineHousing(ctx, sx, sy, halfW, halfH, '#c084fc', 'PACKER');

        // Hydraulic press head
        ctx.fillStyle = '#9333ea';
        ctx.fillRect(sx - 14, sy - 30, 28, 8);
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(sx - 10, sy - 22, 20, 12);

        this.renderOutArrow(ctx, sx, sy, cell.outDir);
      }

      // OBSTACLE HAZARD
      else if (cell.type === CELL_TYPE.OBSTACLE) {
        ctx.fillStyle = '#3f1118';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;

        ctx.fillRect(sx - 14, sy - 26, 28, 26);
        ctx.strokeRect(sx - 14, sy - 26, 28, 26);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx, sy - 10);
      }

      ctx.restore();
    }

    renderMachineHousing(ctx, sx, sy, halfW, halfH, color, label) {
      // 3D Machine Base
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(sx, sy - halfH);
      ctx.lineTo(sx + halfW - 4, sy);
      ctx.lineTo(sx, sy + halfH);
      ctx.lineTo(sx - halfW + 4, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top Station Block
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(sx - 18, sy - 32, 36, 26);
      ctx.strokeStyle = color;
      ctx.strokeRect(sx - 18, sy - 32, 36, 26);

      // Station Label
      ctx.fillStyle = color;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, sx, sy - 36);
    }

    renderOutArrow(ctx, sx, sy, dir) {
      const dv = DIR_VECTORS[dir];
      const ax = sx + (dv.x - dv.y) * 26;
      const ay = sy + (dv.x + dv.y) * 14;

      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    renderMaterials(ctx, interpAlpha) {
      this.items.forEach(item => {
        const def = ITEM_DEFS[item.type] || { color: '#ffffff', glow: '#ffffff' };

        // Sub-tick smooth position interpolation
        const gx = item.prevX !== undefined ? item.prevX + (item.x - item.prevX) * interpAlpha : item.x;
        const gy = item.prevY !== undefined ? item.prevY + (item.y - item.prevY) * interpAlpha : item.y;
        const { x: sx, y: sy } = gridToScreen(gx, gy);

        ctx.save();
        ctx.translate(sx, sy - 6);

        // Blocked warning ring
        if (item.blocked) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = def.color;
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = 8;

        // Render distinct product shapes
        if (def.shape === 'ore') {
          // Metal Ore Ingot
          ctx.fillRect(-8, -5, 16, 10);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(-8, -5, 16, 10);
        } else if (def.shape === 'chip') {
          // Silicon Microchip
          ctx.fillRect(-7, -7, 14, 14);
          ctx.fillStyle = '#ffd600';
          ctx.fillRect(-2, -2, 4, 4);
        } else if (def.shape === 'chassis') {
          // Stamped Robot Chassis
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (def.shape.startsWith('bot')) {
          // Robot Head & Optical Sensor
          ctx.fillRect(-7, -8, 14, 14);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-4, -5, 3, 3);
          ctx.fillRect(1, -5, 3, 3);
        } else if (def.shape.startsWith('crate')) {
          // Orbital Cargo Crate
          ctx.fillRect(-9, -9, 18, 18);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-9, -9, 18, 18);
          ctx.beginPath();
          ctx.moveTo(-9, -9);
          ctx.lineTo(9, 9);
          ctx.moveTo(9, -9);
          ctx.lineTo(-9, 9);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    }

    renderParticles(ctx) {
      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    renderFloatingTexts(ctx) {
      this.floatingTexts.forEach(ft => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });
    }

    renderHoverHighlight(ctx) {
      if (!this.hoverTile) return;
      const { x, y } = this.hoverTile;
      if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return;

      const { x: sx, y: sy } = gridToScreen(x, y);
      const halfW = TILE_WIDTH / 2;
      const halfH = TILE_HEIGHT / 2;
      const cell = this.grid[y][x];

      const isValid = !cell.fixed && (this.levelData && this.levelData.allowedTools.includes(this.selectedTool));

      ctx.save();
      ctx.strokeStyle = isValid ? '#00f0ff' : '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isValid ? '#00f0ff' : '#ef4444';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.moveTo(sx, sy - halfH);
      ctx.lineTo(sx + halfW, sy);
      ctx.lineTo(sx, sy + halfH);
      ctx.lineTo(sx - halfW, sy);
      ctx.closePath();
      ctx.stroke();

      if (isValid) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.fill();
      }
      ctx.restore();
    }

    // ==========================================================================
    // 8. UI BINDING & INTERACTION
    // ==========================================================================

    updateUI() {
      const lvlInd = document.getElementById('level-indicator');
      if (lvlInd && this.levelData) {
        lvlInd.textContent = `LEVEL ${this.levelData.id}: ${this.levelData.title.toUpperCase()}`;
      }

      const objCont = document.getElementById('obj-items-container');
      if (objCont && this.levelData) {
        objCont.innerHTML = '';
        this.levelData.objectives.forEach(obj => {
          const def = ITEM_DEFS[obj.type] || { name: 'Item', color: '#fff' };
          const pill = document.createElement('div');
          pill.className = `obj-pill ${obj.current >= obj.count ? 'fulfilled' : ''}`;
          pill.innerHTML = `
            <span class="item-mini-swatch" style="background: ${def.color};"></span>
            <span>${def.name}: ${obj.current} / ${obj.count}</span>
          `;
          objCont.appendChild(pill);
        });
      }

      const timerDisp = document.getElementById('timer-display');
      if (timerDisp) {
        const m = Math.floor(this.elapsedSeconds / 60);
        const s = Math.floor(this.elapsedSeconds % 60);
        timerDisp.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
      }

      const scoreDisp = document.getElementById('score-display');
      if (scoreDisp) scoreDisp.textContent = this.score;

      const simBtn = document.getElementById('btn-sim-toggle');
      const simText = document.getElementById('sim-text');
      const iconPlay = document.getElementById('sim-icon-play');
      const iconPause = document.getElementById('sim-icon-pause');

      if (simBtn) {
        simBtn.classList.toggle('running', this.isRunning);
        if (simText) simText.textContent = this.isRunning ? 'PAUSE PRODUCTION' : 'START PRODUCTION';
        if (iconPlay) iconPlay.classList.toggle('hidden', this.isRunning);
        if (iconPause) iconPause.classList.toggle('hidden', !this.isRunning);
      }

      const speedInd = document.getElementById('speed-indicator');
      if (speedInd) speedInd.textContent = `${this.simSpeed}X SPEED`;

      const hintText = document.getElementById('level-hint-text');
      if (hintText && this.levelData) hintText.textContent = this.levelData.hint;

      const arrowIcon = document.getElementById('conveyor-tool-arrow');
      const rotLabel = document.getElementById('conveyor-rot-label');
      if (arrowIcon) arrowIcon.style.transform = `rotate(${this.conveyorDir * 90}deg)`;
      if (rotLabel) rotLabel.textContent = `${DIR_NAMES[this.conveyorDir]}`;

      document.querySelectorAll('.dock-tools .tool-btn[data-tool]').forEach(btn => {
        const tool = btn.getAttribute('data-tool');
        btn.classList.toggle('active', tool === this.selectedTool);
        if (this.levelData && tool !== 'demolish') {
          const allowed = this.levelData.allowedTools.includes(tool);
          btn.style.opacity = allowed ? '1' : '0.35';
          btn.style.pointerEvents = allowed ? 'auto' : 'none';
        }
      });
    }
  }

  // ==========================================================================
  // 9. EVENT REGISTRATION & MAIN LOOP
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('factory-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Guarantee matching internal resolution
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const factory = new FactorySimulation();
    factory.loadLevel(0);

    function getTileFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      return screenToGrid(mouseX, mouseY);
    }

    // Canvas Events
    canvas.addEventListener('mousemove', (e) => {
      const { x, y } = getTileFromEvent(e);
      factory.hoverTile = { x, y };

      if (factory.isMouseDown) {
        if (factory.dragAction === 'place') {
          factory.setTile(x, y, factory.selectedTool);
        } else if (factory.dragAction === 'erase') {
          factory.setTile(x, y, CELL_TYPE.EMPTY);
        }
      }
    });

    canvas.addEventListener('mouseleave', () => {
      factory.hoverTile = null;
      factory.isMouseDown = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      const { x, y } = getTileFromEvent(e);

      if (e.button === 2) {
        e.preventDefault();
        factory.isMouseDown = true;
        factory.dragAction = 'erase';
        factory.setTile(x, y, CELL_TYPE.EMPTY);
        return;
      }

      if (e.button === 0) {
        factory.isMouseDown = true;
        if (factory.selectedTool === 'demolish') {
          factory.dragAction = 'erase';
          factory.setTile(x, y, CELL_TYPE.EMPTY);
        } else {
          factory.dragAction = 'place';
          factory.setTile(x, y, factory.selectedTool);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      factory.isMouseDown = false;
      factory.dragAction = null;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Double click to rotate placed component
    canvas.addEventListener('dblclick', (e) => {
      const { x, y } = getTileFromEvent(e);
      factory.rotateTile(x, y);
    });

    // Touch support for tablets/mobile
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const { x, y } = getTileFromEvent(e.touches[0]);
        factory.hoverTile = { x, y };
        factory.setTile(x, y, factory.selectedTool);
      }
    }, { passive: true });

    // Toolbar Dock Buttons
    document.querySelectorAll('.dock-tools .tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        factory.selectedTool = tool;
        audio.playPlace();
        factory.updateUI();
      });
    });

    // Rotate Button
    const rotateBtn = document.getElementById('btn-rotate-tool');
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        factory.conveyorDir = (factory.conveyorDir + 1) % 4;
        audio.playRotate();
        factory.updateUI();
      });
    }

    // Clear Layout Button
    const clearLayoutBtn = document.getElementById('btn-clear-layout');
    if (clearLayoutBtn) {
      clearLayoutBtn.addEventListener('click', () => {
        factory.clearLayout();
      });
    }

    // Simulation Controls
    const simToggleBtn = document.getElementById('btn-sim-toggle');
    if (simToggleBtn) {
      simToggleBtn.addEventListener('click', () => factory.toggleSimulation());
    }

    const simSpeedBtn = document.getElementById('btn-sim-speed');
    if (simSpeedBtn) {
      simSpeedBtn.addEventListener('click', () => factory.toggleSpeed());
    }

    const simResetBtn = document.getElementById('btn-sim-reset');
    if (simResetBtn) {
      simResetBtn.addEventListener('click', () => factory.resetSimulation());
    }

    // Sound Toggle
    const soundBtn = document.getElementById('btn-sound');
    const soundIconOn = document.getElementById('sound-icon-on');
    const soundIconOff = document.getElementById('sound-icon-off');

    function syncSoundUI() {
      if (soundIconOn) soundIconOn.classList.toggle('hidden', !audio.enabled);
      if (soundIconOff) soundIconOff.classList.toggle('hidden', audio.enabled);
    }
    syncSoundUI();

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        audio.toggle();
        syncSoundUI();
      });
    }

    // Hint Dismiss Button
    const closeHintBtn = document.getElementById('btn-close-hint');
    const hintBanner = document.getElementById('level-hint-banner');
    if (closeHintBtn && hintBanner) {
      closeHintBtn.addEventListener('click', () => hintBanner.classList.add('dismissed'));
    }

    // Modals
    const menuModal = document.getElementById('modal-menu');
    const levelsModal = document.getElementById('modal-levels');
    const guideModal = document.getElementById('modal-guide');
    const victoryModal = document.getElementById('modal-victory');

    const menuPlayBtn = document.getElementById('menu-btn-play');
    if (menuPlayBtn) {
      menuPlayBtn.addEventListener('click', () => {
        menuModal.classList.add('hidden');
        audio.playPlace();
      });
    }

    function openLevelsModal() {
      buildLevelSelectCards();
      levelsModal.classList.remove('hidden');
      audio.playPlace();
    }

    const menuLevelsBtn = document.getElementById('menu-btn-levels');
    const hudLevelsBtn = document.getElementById('btn-levels');
    if (menuLevelsBtn) menuLevelsBtn.addEventListener('click', openLevelsModal);
    if (hudLevelsBtn) hudLevelsBtn.addEventListener('click', openLevelsModal);

    const closeLevelsBtn = document.getElementById('btn-close-levels');
    if (closeLevelsBtn) closeLevelsBtn.addEventListener('click', () => levelsModal.classList.add('hidden'));

    function openGuideModal() {
      guideModal.classList.remove('hidden');
      audio.playPlace();
    }

    const menuGuideBtn = document.getElementById('menu-btn-guide');
    const hudGuideBtn = document.getElementById('btn-guide');
    if (menuGuideBtn) menuGuideBtn.addEventListener('click', openGuideModal);
    if (hudGuideBtn) hudGuideBtn.addEventListener('click', openGuideModal);

    const closeGuideBtn = document.getElementById('btn-close-guide');
    if (closeGuideBtn) closeGuideBtn.addEventListener('click', () => guideModal.classList.add('hidden'));

    const vicNextBtn = document.getElementById('vic-btn-next');
    if (vicNextBtn) {
      vicNextBtn.addEventListener('click', () => {
        victoryModal.classList.add('hidden');
        const nextLvl = (factory.currentLevelIndex + 1) % LEVELS.length;
        factory.loadLevel(nextLvl);
        if (hintBanner) hintBanner.classList.remove('dismissed');
      });
    }

    const vicReplayBtn = document.getElementById('vic-btn-replay');
    if (vicReplayBtn) {
      vicReplayBtn.addEventListener('click', () => {
        victoryModal.classList.add('hidden');
        factory.loadLevel(factory.currentLevelIndex);
      });
    }

    const vicMenuBtn = document.getElementById('vic-btn-menu');
    if (vicMenuBtn) {
      vicMenuBtn.addEventListener('click', () => {
        victoryModal.classList.add('hidden');
        openLevelsModal();
      });
    }

    function buildLevelSelectCards() {
      const container = document.getElementById('level-cards-container');
      if (!container) return;
      container.innerHTML = '';

      LEVELS.forEach((lvl, idx) => {
        const starsEarned = factory.starsData[idx] || 0;
        const isUnlocked = idx === 0 || (factory.starsData[idx - 1] && factory.starsData[idx - 1] > 0);

        const card = document.createElement('div');
        card.className = `level-card ${isUnlocked ? '' : 'locked'}`;
        card.innerHTML = `
          <div class="lc-top">
            <span class="lc-num">MISSION 0${lvl.id}</span>
            <div class="lc-stars">
              ${[1, 2, 3].map(s => `
                <svg viewBox="0 0 24 24" class="svg-icon ${s <= starsEarned ? 'earned' : ''}">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              `).join('')}
            </div>
          </div>
          <div class="lc-title">${lvl.title}</div>
          <div class="lc-desc">${lvl.tagline}</div>
          <div class="lc-target">Target: ${lvl.objectives.map(o => `${o.count}x ${(ITEM_DEFS[o.type] || {}).name || o.type}`).join(', ')}</div>
        `;

        if (isUnlocked) {
          card.addEventListener('click', () => {
            levelsModal.classList.add('hidden');
            menuModal.classList.add('hidden');
            factory.loadLevel(idx);
            if (hintBanner) hintBanner.classList.remove('dismissed');
            audio.playPlace();
          });
        }

        container.appendChild(card);
      });

      const sumStars = document.getElementById('sum-stars');
      if (sumStars) {
        const total = Object.values(factory.starsData).reduce((a, b) => a + b, 0);
        sumStars.textContent = `${total} / 15`;
      }
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();

      if (key === '1') {
        factory.selectedTool = CELL_TYPE.CONVEYOR;
        audio.playPlace();
        factory.updateUI();
      } else if (key === '2' && factory.levelData.allowedTools.includes(CELL_TYPE.CUTTER)) {
        factory.selectedTool = CELL_TYPE.CUTTER;
        audio.playPlace();
        factory.updateUI();
      } else if (key === '3' && factory.levelData.allowedTools.includes(CELL_TYPE.ASSEMBLER)) {
        factory.selectedTool = CELL_TYPE.ASSEMBLER;
        audio.playPlace();
        factory.updateUI();
      } else if (key === '4' && factory.levelData.allowedTools.includes(CELL_TYPE.PAINTER)) {
        factory.selectedTool = CELL_TYPE.PAINTER;
        audio.playPlace();
        factory.updateUI();
      } else if (key === '5' && factory.levelData.allowedTools.includes(CELL_TYPE.PACKER)) {
        factory.selectedTool = CELL_TYPE.PACKER;
        audio.playPlace();
        factory.updateUI();
      } else if (key === 'x') {
        factory.selectedTool = 'demolish';
        audio.playPlace();
        factory.updateUI();
      } else if (key === 'r') {
        if (factory.hoverTile) {
          const { x, y } = factory.hoverTile;
          const cell = factory.grid[y][x];
          if (cell && cell.type !== CELL_TYPE.EMPTY && !cell.fixed) {
            factory.rotateTile(x, y);
            return;
          }
        }
        factory.conveyorDir = (factory.conveyorDir + 1) % 4;
        audio.playRotate();
        factory.updateUI();
      } else if (key === ' ') {
        e.preventDefault();
        factory.toggleSimulation();
      } else if (key === 'f') {
        factory.toggleSpeed();
      } else if (key === 'z') {
        factory.resetSimulation();
      } else if (key === 'm') {
        audio.toggle();
        syncSoundUI();
      } else if (key === 'h') {
        openGuideModal();
      } else if (key === 'escape') {
        if (levelsModal) levelsModal.classList.add('hidden');
        if (guideModal) guideModal.classList.add('hidden');
        if (victoryModal) victoryModal.classList.add('hidden');
      }
    });

    // 60 FPS Main Loop
    let lastTime = performance.now();

    function mainLoop(now) {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      factory.stepSimulation(dt);

      const interpAlpha = Math.min(1.0, factory.tickAccumulator / factory.tickDuration);
      factory.render(ctx, interpAlpha);

      requestAnimationFrame(mainLoop);
    }

    requestAnimationFrame(mainLoop);
  });
})();
