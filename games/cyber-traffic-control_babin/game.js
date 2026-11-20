/**
 * Cyber Traffic Control — Hovercar Skyway Intersection Signal Dispatcher
 * Author: Babin123456
 * Multi-lane queue physics, bounding box collision detection, Web Audio engine
 */

(function () {
  'use strict';

  // Intersection Layout Constants
  const CANVAS_SIZE = 600;
  const CENTER = 300;
  const ROAD_WIDTH = 120; // 60px lane width each way
  const HALF_ROAD = ROAD_WIDTH / 2;

  // Signal States: 
  // 0: GREEN_NS (North-South Green, East-West Red)
  // 1: AMBER_TO_EW (North-South Amber Clearance, East-West Red)
  // 2: GREEN_EW (East-West Green, North-South Red)
  // 3: AMBER_TO_NS (East-West Amber Clearance, North-South Red)
  let signalPhase = 0;
  let amberTimerId = null;
  let isPaused = false;
  let lastTime = performance.now();

  function clearAmberTimer() {
    if (amberTimerId) {
      clearTimeout(amberTimerId);
      amberTimerId = null;
    }
  }

  // Vehicle Types
  const VEHICLE_TYPES = {
    SEDAN: { name: 'Sedan', width: 22, length: 38, speed: 2.2, maxWait: 15, color: '#38bdf8', score: 100 },
    HAULER: { name: 'Cargo Hauler', width: 28, length: 54, speed: 1.4, maxWait: 20, color: '#f59e0b', score: 250 },
    DRONE: { name: 'Emergency Drone', width: 20, length: 32, speed: 3.2, maxWait: 10, color: '#f43f5e', score: 500, isEmergency: true }
  };

  // 4 Lanes:
  // Northbound (moves UP from south, x = CENTER + 30)
  // Southbound (moves DOWN from north, x = CENTER - 30)
  // Eastbound (moves RIGHT from west, y = CENTER + 30)
  // Westbound (moves LEFT from east, y = CENTER - 30)
  const LANES = [
    { id: 'N', name: 'NORTH', startX: CENTER + 30, startY: 640, dirX: 0, dirY: -1, stopLineY: CENTER + HALF_ROAD + 10 },
    { id: 'S', name: 'SOUTH', startX: CENTER - 30, startY: -40, dirX: 0, dirY: 1, stopLineY: CENTER - HALF_ROAD - 10 },
    { id: 'E', name: 'EAST', startX: -40, startY: CENTER + 30, dirX: 1, dirY: 0, stopLineX: CENTER - HALF_ROAD - 10 },
    { id: 'W', name: 'WEST', startX: 640, startY: CENTER - 30, dirX: -1, dirY: 0, stopLineX: CENTER + HALF_ROAD + 10 }
  ];

  // Game Metrics
  let vehicles = [];
  let carsDispatched = 0;
  let score = 0;
  let frustration = 0; // 0 to 100
  let isGameOver = false;
  let spawnTimer = 0;
  let spawnInterval = 110; // Frames between vehicle spawns
  let soundEnabled = true;
  let audioCtx = null;
  let animFrameId = null;

  // DOM Elements
  const canvas = document.getElementById('traffic-canvas');
  const ctx = canvas.getContext('2d');
  const statDispatched = document.getElementById('stat-dispatched');
  const statScore = document.getElementById('stat-score');
  const frustrationFill = document.getElementById('frustration-fill');
  const statRating = document.getElementById('stat-rating');
  const dotN = document.getElementById('dot-n');
  const dotS = document.getElementById('dot-s');
  const dotE = document.getElementById('dot-e');
  const dotW = document.getElementById('dot-w');
  const priorityWarning = document.getElementById('priority-warning');
  const noPriority = document.getElementById('no-priority');
  const radioLogUl = document.getElementById('radio-log-ul');
  const overlay = document.getElementById('traffic-overlay');
  const overlayHead = document.getElementById('overlay-head');
  const overlayDetails = document.getElementById('overlay-details');
  const btnShiftRetry = document.getElementById('btn-shift-retry');
  const btnRestartShift = document.getElementById('btn-restart-shift');
  const btnAudioToggle = document.getElementById('btn-audio-toggle');
  const svgSoundOn = document.getElementById('svg-sound-on');
  const svgSoundOff = document.getElementById('svg-sound-off');

  // Audio Engine
  const activeNodes = new Set();

  function trackNode(osc) {
    activeNodes.add(osc);
    osc.onended = () => {
      activeNodes.delete(osc);
    };
    return osc;
  }

  function stopAllAudio() {
    activeNodes.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (_) {}
    });
    activeNodes.clear();
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const now = actx.currentTime;

      if (type === 'switch') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        trackNode(osc);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'boost') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(640, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        trackNode(osc);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'crash') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        trackNode(osc);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'horn') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(440, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        trackNode(osc);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // Audio fallback
    }
  }

  function addRadioLog(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    radioLogUl.prepend(li);
    if (radioLogUl.children.length > 20) {
      radioLogUl.removeChild(radioLogUl.lastChild);
    }
  }

  // Toggle Signal Lights with Amber Clearance Protection
  function toggleSignals() {
    if (signalPhase === 1 || signalPhase === 3) return; // In amber clearance transit

    playSound('switch');
    clearAmberTimer();

    if (signalPhase === 0) {
      signalPhase = 1; // Transition to Amber for NS
      updateSignalDots();
      addRadioLog('AMBER CLEARANCE: North-South stopping...');
      amberTimerId = setTimeout(() => {
        signalPhase = 2; // East-West Green
        amberTimerId = null;
        updateSignalDots();
        addRadioLog('Signals switched: EAST-WEST GREEN');
      }, 900);
    } else if (signalPhase === 2) {
      signalPhase = 3; // Transition to Amber for EW
      updateSignalDots();
      addRadioLog('AMBER CLEARANCE: East-West stopping...');
      amberTimerId = setTimeout(() => {
        signalPhase = 0; // North-South Green
        amberTimerId = null;
        updateSignalDots();
        addRadioLog('Signals switched: NORTH-SOUTH GREEN');
      }, 900);
    }
  }

  function updateSignalDots() {
    if (signalPhase === 0) {
      dotN.className = 'signal-dot green';
      dotS.className = 'signal-dot green';
      dotE.className = 'signal-dot red';
      dotW.className = 'signal-dot red';
    } else if (signalPhase === 1) {
      dotN.className = 'signal-dot amber';
      dotS.className = 'signal-dot amber';
      dotE.className = 'signal-dot red';
      dotW.className = 'signal-dot red';
    } else if (signalPhase === 2) {
      dotN.className = 'signal-dot red';
      dotS.className = 'signal-dot red';
      dotE.className = 'signal-dot green';
      dotW.className = 'signal-dot green';
    } else if (signalPhase === 3) {
      dotN.className = 'signal-dot red';
      dotS.className = 'signal-dot red';
      dotE.className = 'signal-dot amber';
      dotW.className = 'signal-dot amber';
    }
  }

  // Spawn Hovercar
  function spawnVehicle() {
    // Pick lane
    const lane = LANES[Math.floor(Math.random() * LANES.length)];

    // Check if spawn point is obstructed by a vehicle too close
    const blocked = vehicles.some((v) => {
      if (v.lane.id !== lane.id) return false;
      const dist = Math.hypot(v.x - lane.startX, v.y - lane.startY);
      return dist < 80;
    });

    if (blocked) return;

    // Pick type (80% sedan, 15% hauler, 5% drone)
    const roll = Math.random();
    let type = VEHICLE_TYPES.SEDAN;
    if (roll > 0.88) {
      type = VEHICLE_TYPES.DRONE;
    } else if (roll > 0.65) {
      type = VEHICLE_TYPES.HAULER;
    }

    const vehicle = {
      id: Math.random().toString(36).substring(2, 9),
      type: type,
      lane: lane,
      x: lane.startX,
      y: lane.startY,
      speed: type.speed,
      currentSpeed: type.speed,
      isStopped: false,
      isBoosted: false,
      waitTime: 0,
      passedJunction: false
    };

    vehicles.push(vehicle);

    if (type.isEmergency) {
      priorityWarning.classList.remove('hidden');
      noPriority.classList.add('hidden');
      addRadioLog(`EMERGENCY: Siren drone inbound on ${lane.name} Skyway!`);
    }
  }

  // Check collision bounding boxes between two hovercars
  function checkVehicleCollision(v1, v2) {
    // Axis-Aligned Bounding Box (AABB) approximation with rotated dimensions
    const w1 = (v1.lane.dirX !== 0) ? v1.type.length : v1.type.width;
    const h1 = (v1.lane.dirX !== 0) ? v1.type.width : v1.type.length;
    const w2 = (v2.lane.dirX !== 0) ? v2.type.length : v2.type.width;
    const h2 = (v2.lane.dirX !== 0) ? v2.type.width : v2.type.length;

    const r1 = { left: v1.x - w1 / 2, right: v1.x + w1 / 2, top: v1.y - h1 / 2, bottom: v1.y + h1 / 2 };
    const r2 = { left: v2.x - w2 / 2, right: v2.x + w2 / 2, top: v2.y - h2 / 2, bottom: v2.y + h2 / 2 };

    return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
  }

  // Update Game Logic with Delta Time
  function update(deltaMs = 16.67) {
    if (isGameOver || isPaused) return;
    const dtScale = Math.min(2.0, Math.max(0.2, deltaMs / 16.667));

    // Spawning
    spawnTimer += dtScale;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnVehicle();
      // Slowly ramp up difficulty
      if (spawnInterval > 45) spawnInterval -= 0.5;
    }

    let hasEmergency = false;
    let currentFrustrationDelta = 0;

    // Process Each Vehicle
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];

      if (v.type.isEmergency && !v.passedJunction) {
        hasEmergency = true;
      }

      // Check whether light is RED or AMBER for this lane
      let isRestricted = false;
      if (v.lane.dirY !== 0) {
        // North-South lanes: green only on phase 0
        isRestricted = (signalPhase !== 0);
      } else {
        // East-West lanes: green only on phase 2
        isRestricted = (signalPhase !== 2);
      }

      // Check distance to stop line if before intersection
      let shouldStopAtLight = false;
      if (isRestricted && !v.passedJunction && !v.isBoosted) {
        if (v.lane.id === 'N' && v.y > v.lane.stopLineY && v.y < v.lane.stopLineY + 60) shouldStopAtLight = true;
        if (v.lane.id === 'S' && v.y < v.lane.stopLineY && v.y > v.lane.stopLineY - 60) shouldStopAtLight = true;
        if (v.lane.id === 'E' && v.x < v.lane.stopLineX && v.x > v.lane.stopLineX - 60) shouldStopAtLight = true;
        if (v.lane.id === 'W' && v.x > v.lane.stopLineX && v.x < v.lane.stopLineX + 60) shouldStopAtLight = true;
      }

      // Check queue braking: vehicle directly ahead in same lane
      let shouldBrakeForCarAhead = false;
      for (let j = 0; j < vehicles.length; j++) {
        if (i === j) continue;
        const other = vehicles[j];
        if (other.lane.id === v.lane.id) {
          // Check if ahead along direction vector
          const dot = (other.x - v.x) * v.lane.dirX + (other.y - v.y) * v.lane.dirY;
          if (dot > 0 && dot < (v.type.length / 2 + other.type.length / 2 + 18)) {
            shouldBrakeForCarAhead = true;
            break;
          }
        }
      }

      // Stop or move
      if (shouldStopAtLight || shouldBrakeForCarAhead) {
        v.isStopped = true;
        v.currentSpeed = Math.max(0, v.currentSpeed - 0.2 * dtScale);
        v.waitTime += (deltaMs / 1000);

        if (v.waitTime > v.type.maxWait) {
          currentFrustrationDelta += 0.25 * dtScale;
          if (Math.random() < 0.015) playSound('horn');
        }
      } else {
        v.isStopped = false;
        const targetSpd = v.isBoosted ? v.speed * 2.2 : v.speed;
        v.currentSpeed = Math.min(targetSpd, v.currentSpeed + 0.15 * dtScale);
      }

      // Move vehicle
      v.x += v.lane.dirX * v.currentSpeed * dtScale;
      v.y += v.lane.dirY * v.currentSpeed * dtScale;
      v.y += v.lane.dirY * v.currentSpeed;

      // Check if passed center junction
      if (!v.passedJunction) {
        if (v.lane.id === 'N' && v.y < CENTER - HALF_ROAD) v.passedJunction = true;
        if (v.lane.id === 'S' && v.y > CENTER + HALF_ROAD) v.passedJunction = true;
        if (v.lane.id === 'E' && v.x > CENTER + HALF_ROAD) v.passedJunction = true;
        if (v.lane.id === 'W' && v.x < CENTER - HALF_ROAD) v.passedJunction = true;

        if (v.passedJunction) {
          carsDispatched++;
          score += v.type.score;
        }
      }
    }

    // Update Priority Warning HUD
    if (hasEmergency) {
      priorityWarning.classList.remove('hidden');
      noPriority.classList.add('hidden');
    } else {
      priorityWarning.classList.add('hidden');
      noPriority.classList.remove('hidden');
    }

    // Frustration adjustments
    frustration = Math.min(100, Math.max(0, frustration + currentFrustrationDelta - 0.05));
    frustrationFill.style.width = `${frustration}%`;
    if (frustration > 60) {
      frustrationFill.style.background = '#ef4444';
      statRating.textContent = 'CONGESTED';
      statRating.className = 'metric-val danger';
    } else {
      frustrationFill.style.background = '#10b981';
      statRating.textContent = 'FLOWING';
      statRating.className = 'metric-val safe';
    }

    // Check Mid-Air Collision between perpendicular vehicles in intersection
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        const v1 = vehicles[i];
        const v2 = vehicles[j];

        // Only check collisions if crossing paths
        if (v1.lane.id !== v2.lane.id) {
          if (checkVehicleCollision(v1, v2)) {
            triggerCollisionGameOver(v1, v2);
            return;
          }
        }
      }
    }

    // Prune off-screen vehicles
    vehicles = vehicles.filter((v) => {
      return (v.x >= -60 && v.x <= CANVAS_SIZE + 60 && v.y >= -60 && v.y <= CANVAS_SIZE + 60);
    });

    // Update Score & Counters
    statDispatched.textContent = carsDispatched;
    statScore.textContent = String(score).padStart(5, '0');
  }

  function triggerCollisionGameOver(v1, v2) {
    isGameOver = true;
    clearAmberTimer();
    stopAllAudio();
    playSound('crash');

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_SCORE',
        score: score,
        carsDispatched: carsDispatched
      }, '*');
      window.parent.postMessage({
        type: 'ARCADEVERSE_GAME_OVER',
        score: score,
        carsDispatched: carsDispatched,
        reason: 'collision'
      }, '*');
    }

    overlayHead.textContent = 'SKYWAY PILEUP!';
    overlayDetails.textContent = `Crash detected between ${v1.type.name} and ${v2.type.name} at central intersection!`;
    overlay.classList.remove('hidden');
    addRadioLog('CODE RED: Collision reported at Skyway 4 junction. Traffic halted.');
  }

  // Trackpad Pan & Pinch-Zoom Navigation (#575)
  let viewport = { panX: 0, panY: 0, zoom: 1.0 };
  if (window.ArcadeVerse && typeof window.ArcadeVerse.initTrackpadPanZoom === 'function') {
    window.ArcadeVerse.initTrackpadPanZoom(canvas, {
      minZoom: 0.6,
      maxZoom: 2.2,
      onTransform: (t) => {
        // Clamp panning so map stays in reasonable bounds
        const maxPan = 150 * t.zoom;
        viewport.panX = Math.max(-maxPan, Math.min(maxPan, t.panX));
        viewport.panY = Math.max(-maxPan, Math.min(maxPan, t.panY));
        viewport.zoom = t.zoom;
      }
    });
  }

  // Draw Arena
  function render() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    // Center-origin transformation for zoom and pan
    ctx.translate(CENTER + viewport.panX, CENTER + viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);
    ctx.translate(-CENTER, -CENTER);

    // Dark cyberpunk asphalt
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Skyway Conduits / Highways (Crossroads)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(CENTER - HALF_ROAD, 0, ROAD_WIDTH, CANVAS_SIZE); // NS Highway
    ctx.fillRect(0, CENTER - HALF_ROAD, CANVAS_SIZE, ROAD_WIDTH); // EW Highway

    // Road borders
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(CENTER - HALF_ROAD, 0, ROAD_WIDTH, CANVAS_SIZE);
    ctx.strokeRect(0, CENTER - HALF_ROAD, CANVAS_SIZE, ROAD_WIDTH);

    // Glowing Divider Strips
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(CENTER, 0); ctx.lineTo(CENTER, CANVAS_SIZE);
    ctx.moveTo(0, CENTER); ctx.lineTo(CANVAS_SIZE, CENTER);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Draw Stop Lines
    ctx.strokeStyle = (signalPhase === 0) ? '#10b981' : '#ef4444'; // NS Stop line color
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(CENTER, CENTER + HALF_ROAD); ctx.lineTo(CENTER + HALF_ROAD, CENTER + HALF_ROAD); // Northbound stop
    ctx.moveTo(CENTER - HALF_ROAD, CENTER - HALF_ROAD); ctx.lineTo(CENTER, CENTER - HALF_ROAD); // Southbound stop
    ctx.stroke();

    ctx.strokeStyle = (signalPhase === 1) ? '#10b981' : '#ef4444'; // EW Stop line color
    ctx.beginPath();
    ctx.moveTo(CENTER - HALF_ROAD, CENTER); ctx.lineTo(CENTER - HALF_ROAD, CENTER + HALF_ROAD); // Eastbound stop
    ctx.moveTo(CENTER + HALF_ROAD, CENTER - HALF_ROAD); ctx.lineTo(CENTER + HALF_ROAD, CENTER); // Westbound stop
    ctx.stroke();

    // Intersection Clickable Signal Conduits (Pillars at 4 corners)
    drawSignalConduit(CENTER - HALF_ROAD - 15, CENTER - HALF_ROAD - 15, (signalPhase === 1));
    drawSignalConduit(CENTER + HALF_ROAD + 15, CENTER - HALF_ROAD - 15, (signalPhase === 0));
    drawSignalConduit(CENTER - HALF_ROAD - 15, CENTER + HALF_ROAD + 15, (signalPhase === 0));
    drawSignalConduit(CENTER + HALF_ROAD + 15, CENTER + HALF_ROAD + 15, (signalPhase === 1));

    // Draw Vehicles
    vehicles.forEach((v) => {
      ctx.save();
      ctx.translate(v.x, v.y);

      // Rotation based on lane
      let rot = 0;
      if (v.lane.id === 'N') rot = -Math.PI / 2;
      if (v.lane.id === 'S') rot = Math.PI / 2;
      if (v.lane.id === 'E') rot = 0;
      if (v.lane.id === 'W') rot = Math.PI;
      ctx.rotate(rot);

      // Hover glow shadow
      ctx.fillStyle = v.type.color;
      ctx.shadowColor = v.type.color;
      ctx.shadowBlur = v.isBoosted ? 18 : 8;

      // Vehicle Chassis
      const w = v.type.length;
      const h = v.type.width;
      ctx.fillRect(-w / 2, -h / 2, w, h);

      // Cockpit Windshield
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fillRect(w / 4, -h / 4, w / 6, h / 2);

      // Emergency Strobe Flash
      if (v.type.isEmergency && Math.floor(Date.now() / 150) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Restore viewport transformation
    ctx.restore();

    animFrameId = requestAnimationFrame(render);
  }

  function drawSignalConduit(x, y, isGreen) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = isGreen ? '#10b981' : '#ef4444';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pointer Click on Canvas
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    // Invert zoom and pan transformation to locate world coordinates
    const clickX = (rawX - CENTER - viewport.panX) / viewport.zoom + CENTER;
    const clickY = (rawY - CENTER - viewport.panY) / viewport.zoom + CENTER;

    // Check if clicked any stopped vehicle to give boost
    let vehicleBoosted = false;
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const d = Math.hypot(clickX - v.x, clickY - v.y);
      if (d < 30 && v.isStopped) {
        v.isBoosted = true;
        v.isStopped = false;
        v.waitTime = 0;
        playSound('boost');
        vehicleBoosted = true;
        addRadioLog(`TURBO BOOST engaged on ${v.type.name}!`);
        break;
      }
    }

    // If not boosting a car, toggle intersection signals
    if (!vehicleBoosted) {
      toggleSignals();
    }
  });

  // Shift Reset
  function resetShift() {
    stopAllAudio();
    clearAmberTimer();
    vehicles = [];
    carsDispatched = 0;
    score = 0;
    frustration = 0;
    isGameOver = false;
    isPaused = false;
    spawnTimer = 0;
    spawnInterval = 110;
    signalPhase = 0;
    amberDirection = null;
    isAmberActive = false;
    updateSignalDots();
    overlay.classList.add('hidden');
    radioLogUl.innerHTML = '<li>Shift active. Clear traffic through Skyway 4.</li>';
  }

  // Unified Game Loop
  function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (!isPaused && !isGameOver) {
      update(elapsed);
    }
    render();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  // Pause / Resume Controls
  function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
      stopAllAudio();
      addRadioLog('System on STANDBY. Traffic paused.');
    } else {
      lastTimestamp = performance.now();
      addRadioLog('System RESUMED. Traffic running.');
    }
  }

  // Keyboard controls for pause and signals
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      toggleSignals();
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      togglePause();
    }
  });

  // Page visibility cleanup
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isPaused = true;
      stopAllAudio();
    }
  });

  // Event Listeners
  btnShiftRetry.addEventListener('click', resetShift);
  btnRestartShift.addEventListener('click', resetShift);

  btnAudioToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (!soundEnabled) {
      stopAllAudio();
    }
    svgSoundOn.classList.toggle('hidden', !soundEnabled);
    svgSoundOff.classList.toggle('hidden', soundEnabled);
  });

  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'ARCADEVERSE_TEARDOWN') {
      stopAllAudio();
      clearAmberTimer();
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    } else if (e.data.type === 'ARCADEVERSE_PAUSE') {
      isPaused = true;
      stopAllAudio();
    } else if (e.data.type === 'ARCADEVERSE_RESUME') {
      isPaused = false;
      lastTimestamp = performance.now();
    }
  });

  // Initialize
  updateSignalDots();
  resetShift();
  animFrameId = requestAnimationFrame(gameLoop);
})();
