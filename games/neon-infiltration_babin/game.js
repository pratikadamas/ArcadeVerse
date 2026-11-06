/**
 * Neon Infiltration — Shadow Operative Top-Down Stealth Protocol
 * Author: Babin123456
 * 2D Raycasting Field-of-View, Guard Waypoint AI, Footstep Noise Mechanics
 */

(function () {
  'use strict';

  // Map & Environment Setup
  const CANVAS_WIDTH = 700;
  const CANVAS_HEIGHT = 600;

  // Obstacle Walls & Server Racks
  const WALLS = [
    // Outer boundaries
    { x1: 0, y1: 0, x2: 700, y2: 0 },
    { x1: 700, y1: 0, x2: 700, y2: 600 },
    { x1: 700, y1: 600, x2: 0, y2: 600 },
    { x1: 0, y1: 600, x2: 0, y2: 0 },

    // Interior Server Room 1 (Top Left)
    { x1: 160, y1: 0, x2: 160, y2: 180 },
    { x1: 160, y1: 180, x2: 240, y2: 180 },

    // Interior Server Room 2 (Center Wall Blocks)
    { x1: 300, y1: 120, x2: 440, y2: 120 },
    { x1: 300, y1: 120, x2: 300, y2: 260 },
    { x1: 440, y1: 120, x2: 440, y2: 260 },

    // Lower Corridor Barrier
    { x1: 140, y1: 340, x2: 360, y2: 340 },
    { x1: 360, y1: 340, x2: 360, y2: 480 },

    // Right Secure Lab
    { x1: 520, y1: 240, x2: 700, y2: 240 },
    { x1: 520, y1: 240, x2: 520, y2: 440 },
    { x1: 520, y1: 440, x2: 620, y2: 440 }
  ];

  // Mainframe Terminals to Hack
  const TERMINALS = [
    { id: 1, x: 80, y: 80, hacked: false, progress: 0 },
    { id: 2, x: 620, y: 340, hacked: false, progress: 0 }
  ];

  // Extraction Elevator
  const EXTRACTION_ZONE = { x: 50, y: 520, radius: 45 };

  // Guard Waypoints & Patrolling Sentinels
  const GUARDS = [
    {
      x: 220, y: 80,
      angle: 0,
      fov: Math.PI / 3, // 60 deg cone
      viewDist: 180,
      speed: 1.2,
      waypoints: [{ x: 220, y: 80 }, { x: 220, y: 280 }, { x: 80, y: 280 }, { x: 80, y: 80 }],
      currentWp: 0,
      alertState: 'patrol' // patrol, suspicious, alarm
    },
    {
      x: 480, y: 80,
      angle: Math.PI,
      fov: Math.PI / 3,
      viewDist: 190,
      speed: 1.4,
      waypoints: [{ x: 480, y: 80 }, { x: 480, y: 360 }, { x: 380, y: 360 }, { x: 380, y: 80 }],
      currentWp: 0,
      alertState: 'patrol'
    },
    {
      x: 200, y: 520,
      angle: 0,
      fov: Math.PI / 3,
      viewDist: 160,
      speed: 1.1,
      waypoints: [{ x: 200, y: 520 }, { x: 480, y: 520 }, { x: 480, y: 400 }, { x: 200, y: 400 }],
      currentWp: 0,
      alertState: 'patrol'
    }
  ];

  // CCTV Cameras (stationary sweeping)
  const CAMERAS = [
    { x: 525, y: 245, angle: Math.PI / 4, sweepSpeed: 0.015, minA: 0, maxA: Math.PI / 2, fov: Math.PI / 4, viewDist: 210, dir: 1 },
    { x: 165, y: 5, angle: Math.PI / 3, sweepSpeed: 0.012, minA: Math.PI / 6, maxA: Math.PI * 0.7, fov: Math.PI / 4, viewDist: 170, dir: 1 }
  ];

  // Player Operative State
  let player = {
    x: 40,
    y: 300,
    radius: 10,
    speed: 2.2,
    angle: 0,
    isSneaking: false,
    isSprinting: false,
    noiseRadius: 30,
    isDetected: false
  };

  // Game Engine State
  let alertMeter = 0; // 0 to 100
  let isGameOver = false;
  let isMissionWon = false;
  let missionSeconds = 0;
  let missionTimerInterval = null;
  let activeTerminal = null;
  let audioCtx = null;
  let soundEnabled = true;
  let animFrameId = null;

  // Keyboard Inputs
  const keys = {};

  // DOM Elements
  const canvas = document.getElementById('stealth-canvas');
  const ctx = canvas.getContext('2d');
  const alertFill = document.getElementById('alert-fill');
  const alertTextStatus = document.getElementById('alert-text-status');
  const postureVal = document.getElementById('posture-val');
  const noiseVal = document.getElementById('noise-val');
  const timeVal = document.getElementById('time-val');
  const objHack1 = document.getElementById('obj-hack-1');
  const objHack2 = document.getElementById('obj-hack-2');
  const objExtract = document.getElementById('obj-extract');
  const hackProgressBox = document.getElementById('hack-progress-box');
  const hackFillBar = document.getElementById('hack-fill-bar');
  const hackPct = document.getElementById('hack-pct');
  const missionModal = document.getElementById('mission-modal');
  const modalHeading = document.getElementById('modal-heading');
  const modalDesc = document.getElementById('modal-desc');
  const btnModalAction = document.getElementById('btn-modal-action');
  const tacticalLogUl = document.getElementById('tactical-log-ul');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const svgSoundOn = document.getElementById('svg-sound-on');
  const svgSoundOff = document.getElementById('svg-sound-off');
  const btnRestartMission = document.getElementById('btn-restart-mission');

  // Audio Engine
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

      if (type === 'hack') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'alarm') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'victory') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {
      // Audio fallback
    }
  }

  // Tactical Log Message
  function addTacticalLog(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    tacticalLogUl.prepend(li);
    if (tacticalLogUl.children.length > 20) {
      tacticalLogUl.removeChild(tacticalLogUl.lastChild);
    }
  }

  // Raycasting intersection against line segments
  function getRayIntersection(rayOrigin, rayAngle, maxDist) {
    const rx = rayOrigin.x;
    const ry = rayOrigin.y;
    const rdx = Math.cos(rayAngle);
    const rdy = Math.sin(rayAngle);

    let closestDist = maxDist;
    let hitPoint = { x: rx + rdx * maxDist, y: ry + rdy * maxDist };

    for (let i = 0; i < WALLS.length; i++) {
      const wall = WALLS[i];
      const hit = lineIntersect(rx, ry, rx + rdx * maxDist, ry + rdy * maxDist, wall.x1, wall.y1, wall.x2, wall.y2);
      if (hit && hit.dist < closestDist) {
        closestDist = hit.dist;
        hitPoint = hit.point;
      }
    }

    return { point: hitPoint, dist: closestDist };
  }

  function lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return null;

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      const ix = x1 + ua * (x2 - x1);
      const iy = y1 + ua * (y2 - y1);
      const dist = Math.sqrt((ix - x1) * (ix - x1) + (iy - y1) * (iy - y1));
      return { point: { x: ix, y: iy }, dist: dist };
    }
    return null;
  }

  // Check if player is detected by guard vision cone
  function checkDetectionByCone(origin, centerAngle, fov, maxDist) {
    const dx = player.x - origin.x;
    const dy = player.y - origin.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    if (distToPlayer > maxDist) return false;

    // Angle check
    let angleToPlayer = Math.atan2(dy, dx);
    let diff = angleToPlayer - centerAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    if (Math.abs(diff) <= fov / 2) {
      // Cast ray to ensure no walls occlude the operative
      const ray = getRayIntersection(origin, angleToPlayer, maxDist);
      if (ray.dist >= distToPlayer - player.radius) {
        return true;
      }
    }
    return false;
  }

  // Check if wall collision prevents movement
  function canMoveTo(nx, ny) {
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      // Simple distance to line segment
      const dist = distToSegment({ x: nx, y: ny }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (dist < player.radius + 2) return false;
    }
    return true;
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return Math.sqrt((p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y));
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.sqrt((p.x - proj.x) * (p.x - proj.x) + (p.y - proj.y) * (p.y - proj.y));
  }

  // Update loop
  function update() {
    if (isGameOver || isMissionWon) return;

    // Posture & speed
    player.isSneaking = keys['ShiftLeft'] || keys['ShiftRight'];
    player.isSprinting = keys['Space'];

    if (player.isSneaking) {
      player.speed = 1.3;
      player.noiseRadius = 0;
      postureVal.textContent = 'SNEAKING (SILENT)';
      noiseVal.textContent = '0 METERS';
    } else if (player.isSprinting) {
      player.speed = 3.6;
      player.noiseRadius = 140;
      postureVal.textContent = 'SPRINTING';
      noiseVal.textContent = '25 METERS (LOUD)';
    } else {
      player.speed = 2.2;
      player.noiseRadius = 50;
      postureVal.textContent = 'WALKING';
      noiseVal.textContent = '8 METERS';
    }

    // Move player
    let moveX = 0;
    let moveY = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      const nextX = player.x + (moveX / len) * player.speed;
      const nextY = player.y + (moveY / len) * player.speed;

      if (canMoveTo(nextX, player.y)) player.x = nextX;
      if (canMoveTo(player.x, nextY)) player.y = nextY;

      player.angle = Math.atan2(moveY, moveX);
    }

    // Guard AI & Patrolling
    let anyDetection = false;
    GUARDS.forEach((guard, idx) => {
      const targetWp = guard.waypoints[guard.currentWp];
      const gdx = targetWp.x - guard.x;
      const gdy = targetWp.y - guard.y;
      const distToWp = Math.sqrt(gdx * gdx + gdy * gdy);

      if (distToWp < 5) {
        guard.currentWp = (guard.currentWp + 1) % guard.waypoints.length;
      } else {
        guard.angle = Math.atan2(gdy, gdx);
        guard.x += Math.cos(guard.angle) * guard.speed;
        guard.y += Math.sin(guard.angle) * guard.speed;
      }

      // Check noise radius triggering investigation
      const distToPlayer = Math.sqrt((player.x - guard.x) * (player.x - guard.x) + (player.y - guard.y) * (player.y - guard.y));
      if (distToPlayer <= player.noiseRadius && (moveX !== 0 || moveY !== 0)) {
        guard.alertState = 'suspicious';
        guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
      }

      // Check vision cone detection
      const inSight = checkDetectionByCone(guard, guard.angle, guard.fov, guard.viewDist);
      if (inSight) {
        anyDetection = true;
        guard.alertState = 'alarm';
      }
    });

    // Camera AI
    CAMERAS.forEach((cam) => {
      cam.angle += cam.sweepSpeed * cam.dir;
      if (cam.angle > cam.maxA || cam.angle < cam.minA) {
        cam.dir *= -1;
      }
      const inSight = checkDetectionByCone(cam, cam.angle, cam.fov, cam.viewDist);
      if (inSight) anyDetection = true;
    });

    // Alert Meter Management
    if (anyDetection) {
      alertMeter = Math.min(100, alertMeter + 1.2);
      playSound('alarm');
    } else {
      alertMeter = Math.max(0, alertMeter - 0.35);
    }

    alertFill.style.width = `${alertMeter}%`;
    if (alertMeter >= 100) {
      triggerMeltdownFail();
    } else if (alertMeter > 50) {
      alertFill.style.background = '#ef4444';
      alertTextStatus.className = 'alert-text-status danger';
      alertTextStatus.textContent = 'ALARM! INTRUDER CONFIRMED';
    } else if (alertMeter > 15) {
      alertFill.style.background = '#f59e0b';
      alertTextStatus.className = 'alert-text-status suspicious';
      alertTextStatus.textContent = 'SUSPICIOUS ACTIVITY';
    } else {
      alertFill.style.background = '#10b981';
      alertTextStatus.className = 'alert-text-status safe';
      alertTextStatus.textContent = 'PATROL (SECURE)';
    }

    // Terminal Hacking Interaction
    activeTerminal = null;
    TERMINALS.forEach((t) => {
      if (!t.hacked) {
        const d = Math.sqrt((player.x - t.x) * (player.x - t.x) + (player.y - t.y) * (player.y - t.y));
        if (d < 35) {
          activeTerminal = t;
          t.progress += 0.55;
          playSound('hack');
          if (t.progress >= 100) {
            t.progress = 100;
            t.hacked = true;
            addTacticalLog(`Terminal #${t.id} successfully decrypted.`);
            if (t.id === 1) objHack1.classList.add('completed');
            if (t.id === 2) objHack2.classList.add('completed');
          }
        }
      }
    });

    if (activeTerminal && !activeTerminal.hacked) {
      hackProgressBox.classList.remove('hidden');
      hackFillBar.style.width = `${activeTerminal.progress}%`;
      hackPct.textContent = `${Math.floor(activeTerminal.progress)}%`;
    } else {
      hackProgressBox.classList.add('hidden');
    }

    // Extraction Condition
    const allHacked = TERMINALS.every((t) => t.hacked);
    if (allHacked) {
      objExtract.classList.add('available');
      const distToExtract = Math.sqrt((player.x - EXTRACTION_ZONE.x) * (player.x - EXTRACTION_ZONE.x) + (player.y - EXTRACTION_ZONE.y) * (player.y - EXTRACTION_ZONE.y));
      if (distToExtract < EXTRACTION_ZONE.radius) {
        triggerMissionVictory();
      }
    }
  }

  function triggerMeltdownFail() {
    isGameOver = true;
    modalHeading.textContent = 'LOCKDOWN TRIGGERED';
    modalHeading.style.color = '#ef4444';
    modalDesc.textContent = 'Facility alert reached 100%. Security forces neutralized the operative.';
    btnModalAction.textContent = 'RETRY PROTOCOL';
    missionModal.classList.remove('hidden');
  }

  function triggerMissionVictory() {
    isMissionWon = true;
    playSound('victory');
    objExtract.classList.add('completed');
    modalHeading.textContent = 'EXTRACTION SUCCESS';
    modalHeading.style.color = '#10b981';
    modalDesc.textContent = `Operative escaped undetected with all classified memory cores in ${timeVal.textContent}!`;
    btnModalAction.textContent = 'PLAY AGAIN';
    missionModal.classList.remove('hidden');
  }

  // Draw Raycasted Cones
  function renderCone(origin, centerAngle, fov, maxDist, color) {
    const raySteps = 40;
    const startAngle = centerAngle - fov / 2;
    const angleStep = fov / raySteps;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);

    for (let i = 0; i <= raySteps; i++) {
      const a = startAngle + i * angleStep;
      const ray = getRayIntersection(origin, a, maxDist);
      ctx.lineTo(ray.point.x, ray.point.y);
    }

    ctx.closePath();
    ctx.fill();
  }

  // Canvas Render
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark cyber floor
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Extraction Elevator Zone
    ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(EXTRACTION_ZONE.x, EXTRACTION_ZONE.y, EXTRACTION_ZONE.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EVAC SHAFT', EXTRACTION_ZONE.x, EXTRACTION_ZONE.y + 3);

    // Draw CCTV Cones
    CAMERAS.forEach((cam) => {
      renderCone(cam, cam.angle, cam.fov, cam.viewDist, 'rgba(245, 158, 11, 0.18)');
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Guard Cones
    GUARDS.forEach((g) => {
      const coneColor = g.alertState === 'alarm' ? 'rgba(239, 68, 68, 0.35)' :
                        g.alertState === 'suspicious' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(0, 240, 255, 0.16)';
      renderCone(g, g.angle, g.fov, g.viewDist, coneColor);

      // Guard Body
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 9, 0, Math.PI * 2);
      ctx.fill();

      // Heading indicator
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.angle) * 14, g.y + Math.sin(g.angle) * 14);
      ctx.stroke();
    });

    // Draw Terminals
    TERMINALS.forEach((t) => {
      ctx.fillStyle = t.hacked ? '#10b981' : '#facc15';
      ctx.fillRect(t.x - 12, t.y - 12, 24, 24);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x - 12, t.y - 12, 24, 24);

      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`T${t.id}`, t.x, t.y + 3);
    });

    // Draw Walls & Server Racks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    WALLS.forEach((w) => {
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    });

    // Player Noise Ring
    if (player.noiseRadius > 0) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.noiseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player Operative Body
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16);
    ctx.stroke();
  }

  // Animation Loop
  function gameLoop() {
    update();
    render();
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // Reset Mission
  function rebootMission() {
    player.x = 40;
    player.y = 300;
    alertMeter = 0;
    isGameOver = false;
    isMissionWon = false;
    missionSeconds = 0;
    TERMINALS.forEach((t) => {
      t.hacked = false;
      t.progress = 0;
    });
    objHack1.classList.remove('completed');
    objHack2.classList.remove('completed');
    objExtract.classList.remove('completed', 'available');
    missionModal.classList.add('hidden');
    hackProgressBox.classList.add('hidden');
    tacticalLogUl.innerHTML = '<li>Mission rebooted. Avoid sentinel flashlight cones.</li>';
  }

  // Input Listeners
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  btnModalAction.addEventListener('click', rebootMission);
  btnRestartMission.addEventListener('click', rebootMission);

  btnSoundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    svgSoundOn.classList.toggle('hidden', !soundEnabled);
    svgSoundOff.classList.toggle('hidden', soundEnabled);
  });

  // Mission Timer
  missionTimerInterval = setInterval(() => {
    if (!isGameOver && !isMissionWon) {
      missionSeconds++;
      const m = String(Math.floor(missionSeconds / 60)).padStart(2, '0');
      const s = String(missionSeconds % 60).padStart(2, '0');
      timeVal.textContent = `${m}:${s}`;
    }
  }, 1000);

  // Initialize
  rebootMission();
  animFrameId = requestAnimationFrame(gameLoop);
})();
