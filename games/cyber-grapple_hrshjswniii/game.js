(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    altitude: document.getElementById('altitude'), score: document.getElementById('score'), shards: document.getElementById('shards'),
    combo: document.getElementById('combo'), best: document.getElementById('best'),
    boost: document.getElementById('boost-count'), status: document.getElementById('status'),
    start: document.getElementById('start-screen'), end: document.getElementById('end-screen'),
    rules: document.getElementById('rules-screen'), result: document.getElementById('result')
  };
  const TAU = Math.PI * 2;
  const G = 820;
  let audio = null;
  let muted = false;
  let running = false;
  let paused = false;
  let lastTime = 0;
  let elapsed = 0;
  let camera = 0;
  let highest = 0;
  let shards = 0;
  let boostCharges = 0;
  let combo = 1;
  let chain = 0;
  let anchors = [];
  let hazards = [];
  let cores = [];
  let particles = [];
  let keys = Object.create(null);
  let touchState = Object.create(null);
  let pointerDown = false;
  let tideY = 0;
  let nextWorldY = 0;
  let score = 0;
  let best = 0;
  try { best = Number(localStorage.getItem('cyber_grapple_best')) || 0; } catch (_) { best = 0; }
  ui.best.textContent = best + ' m';

  const player = { x: 240, y: 590, vx: 0, vy: 0, r: 9, anchor: null, length: 0, invuln: 0 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const screenY = worldY => worldY - camera;

  function sound(freq, duration, type) {
    if (muted || !audio) return;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(35, freq * 0.48), audio.currentTime + duration);
      gain.gain.setValueAtTime(0.08, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) {}
  }

  function makeAudio() {
    if (!audio) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audio = new AudioContextClass();
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }

  function addAnchor(x, y, kind) {
    anchors.push({ x, y, kind, phase: rand(0, TAU), drift: rand(0.5, 1.5), homeX: x, homeY: y, alive: true, life: 0 });
  }

  function addStage(y) {
    const x = rand(72, canvas.width - 72);
    const roll = Math.random();
    addAnchor(x, y, roll < 0.13 ? 'spring' : roll < 0.34 ? 'unstable' : roll < 0.53 ? 'moving' : 'standard');
    if (Math.random() < 0.3) addAnchor(rand(70, 410), y - rand(100, 150), 'standard');
    if (Math.random() < 0.64) {
      const gapCenter = rand(120, 360);
      hazards.push({ y: y - rand(90, 145), gapCenter, gap: rand(95, 140), phase: rand(0, TAU), rotating: Math.random() < 0.35, width: 5 });
    }
    cores.push({ x: rand(72, 408), y: y - rand(40, 125), taken: false, phase: rand(0, TAU) });
  }

  function reset() {
    elapsed = 0; camera = 0; highest = 0; shards = 0; boostCharges = 0; combo = 1; chain = 0; score = 0;
    player.x = 240; player.y = 590; player.vx = 0; player.vy = -45; player.anchor = null; player.length = 0; player.invuln = 1.2;
    anchors = []; hazards = []; cores = []; particles = []; tideY = 840; nextWorldY = 490;
    for (let i = 0; i < 8; i++) { addStage(nextWorldY); nextWorldY -= rand(125, 165); }
    ui.altitude.textContent = '0 m'; ui.score.textContent = '0'; ui.shards.textContent = '0'; ui.combo.textContent = '1x'; ui.boost.textContent = '0';
  }

  function begin() {
    makeAudio(); reset(); running = true; paused = false; lastTime = performance.now();
    ui.start.classList.remove('visible'); ui.end.classList.remove('visible'); ui.rules.classList.remove('visible');
    ui.status.textContent = 'ASCENT ACTIVE';
  }

  function endGame(message) {
    if (!running) return;
    running = false; player.anchor = null; sound(120, 0.42, 'sawtooth');
    const altitude = Math.max(0, Math.floor((590 - highest) / 10));
    score = altitude * combo + shards * 100 * combo;
    if (altitude > best) {
      best = altitude;
      try { localStorage.setItem('cyber_grapple_best', String(best)); } catch (_) {}
    }
    ui.best.textContent = best + ' m';
    ui.score.textContent = String(score);
    ui.result.textContent = (message || 'Altitude reached') + ': ' + altitude + ' m · ' + shards + ' shards · score ' + score;
    ui.end.classList.add('visible'); ui.status.textContent = 'SIGNAL LOST';
  }

  function nearestAnchor(x, y) {
    let selected = null; let distance = 145;
    for (const node of anchors) {
      if (!node.alive || node.y > y + 35 || node.y < y - 260) continue;
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < distance) { distance = d; selected = node; }
    }
    return selected;
  }

  function grapple(target) {
    if (!running || paused || player.anchor) return;
    const node = target || nearestAnchor(player.x, player.y);
    if (!node) return;
    player.anchor = node;
    player.length = clamp(Math.hypot(node.x - player.x, node.y - player.y), 65, 220);
    if (node.kind === 'unstable') node.life = 1.5;
    sound(520, 0.14);
    burst(player.x, player.y, '#50f5ef', 7);
  }

  function release() {
    if (!player.anchor) return;
    const wasSpring = player.anchor.kind === 'spring';
    player.anchor = null; chain++;
    combo = chain >= 4 ? 5 : chain >= 2 ? 3 : chain ? 2 : 1;
    player.vx *= wasSpring ? 1.12 : 1;
    player.vy = Math.min(player.vy, -40) * (wasSpring ? 2 : 1);
    player.invuln = 0.35;
    ui.combo.textContent = combo + 'x';
    sound(wasSpring ? 920 : 680, 0.18, 'triangle');
    burst(player.x, player.y, wasSpring ? '#67ffb0' : '#ff4ecb', 12);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: rand(-150, 150), vy: rand(-170, 80), life: rand(0.25, 0.7), max: 0.7, color });
  }

  function boost() {
    if (!running || paused || boostCharges < 1) return;
    boostCharges--; ui.boost.textContent = String(boostCharges);
    player.vy -= 470; player.vx += (player.x < 240 ? 90 : -90); player.invuln = 0.65;
    sound(240, 0.32, 'sawtooth'); burst(player.x, player.y + 8, '#67ffb0', 18);
  }

  function worldInput(dt) {
    const left = keys.ArrowLeft || keys.a || touchState.left;
    const right = keys.ArrowRight || keys.d || touchState.right;
    const winchIn = keys.ArrowUp || keys.w || touchState['winch-in'];
    const winchOut = keys.ArrowDown || keys.s || touchState['winch-out'];
    if (player.anchor) {
      if (winchIn) player.length -= 135 * dt;
      if (winchOut) player.length += 135 * dt;
      player.length = clamp(player.length, 52, 250);
      if (left) player.vx -= 440 * dt;
      if (right) player.vx += 440 * dt;
    } else {
      if (left) player.vx -= 250 * dt;
      if (right) player.vx += 250 * dt;
    }
    if (touchState.boost) { touchState.boost = false; boost(); }
  }

  function update(dt) {
    elapsed += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    for (const node of anchors) {
      node.phase += dt * node.drift;
      if (node.kind === 'moving') { node.x = node.homeX + Math.sin(node.phase) * 58; node.y = node.homeY + Math.cos(node.phase * 0.7) * 24; }
      if (node.kind === 'unstable' && node.life > 0) { node.life -= dt; if (node.life <= 0) { node.alive = false; if (player.anchor === node) release(); burst(node.x, node.y, '#ffc36b', 10); } }
    }
    worldInput(dt);
    const gravity = player.anchor ? G * 0.86 : G;
    player.vy += gravity * dt;
    player.vx *= Math.pow(player.anchor ? 0.997 : 0.994, dt * 60);
    player.vx = clamp(player.vx, -430, 430); player.vy = clamp(player.vy, -750, 760);
    player.x += player.vx * dt; player.y += player.vy * dt;

    if (player.anchor && player.anchor.alive) {
      const dx = player.x - player.anchor.x; const dy = player.y - player.anchor.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > player.length) {
        const nx = dx / distance; const ny = dy / distance;
        player.x = player.anchor.x + nx * player.length; player.y = player.anchor.y + ny * player.length;
        const radial = player.vx * nx + player.vy * ny;
        if (radial > 0) { player.vx -= radial * nx; player.vy -= radial * ny; }
      }
    }

    if (player.x < player.r || player.x > canvas.width - player.r) {
      player.x = clamp(player.x, player.r, canvas.width - player.r); player.vx *= -0.72;
      if (player.anchor) { player.anchor = null; chain = 0; combo = 1; }
    }
    const previousY = player.y - player.vy * dt;
    for (const gate of hazards) {
      let center = gate.gapCenter;
      if (gate.rotating) center += Math.sin(elapsed * 0.9 + gate.phase) * 42;
      if (Math.abs(player.y - gate.y) < 8 && (player.x < center - gate.gap / 2 || player.x > center + gate.gap / 2)) {
        if (player.invuln <= 0) { endGame('Laser field impact'); return; }
      }
    }
    for (const core of cores) {
      core.phase += dt * 2;
      if (!core.taken && Math.hypot(player.x - core.x, player.y - core.y) < 22) {
        core.taken = true; shards++; boostCharges = Math.min(1, boostCharges + 1);
        ui.shards.textContent = String(shards); ui.boost.textContent = String(boostCharges);
        sound(880, 0.12); burst(core.x, core.y, '#67ffb0', 12);
      }
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);

    if (player.y < highest) highest = player.y;
    const targetCamera = Math.min(0, player.y - 300);
    camera += (targetCamera - camera) * Math.min(1, dt * 4.2);
    tideY -= (20 + Math.min(45, elapsed * 0.8)) * dt;
    if (player.y > tideY - 20) { endGame('Consumed by the glitch tide'); return; }
    if (player.y - camera > canvas.height + 35) { endGame('Lost below the chasm'); return; }
    while (nextWorldY > camera - 300) { addStage(nextWorldY); nextWorldY -= rand(130, 175); }
    anchors = anchors.filter(n => n.y < camera + canvas.height + 260 && (n.alive || player.anchor === n));
    hazards = hazards.filter(h => h.y < camera + canvas.height + 160);
    cores = cores.filter(c => c.y < camera + canvas.height + 100 && !c.taken);
    const altitude = Math.max(0, Math.floor((590 - highest) / 10));
    ui.altitude.textContent = altitude + ' m';
    ui.score.textContent = String(altitude * combo + shards * 100 * combo);
  }

  function drawBackground() {
    ctx.fillStyle = '#06111c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a1c2a'); grad.addColorStop(0.5, '#07131f'); grad.addColorStop(1, '#09111d');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#173344'; ctx.lineWidth = 1; ctx.globalAlpha = 0.38;
    const offset = ((camera * -0.12) % 40 + 40) % 40;
    for (let y = offset; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    for (let x = 30; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#112737'; ctx.fillRect(0, 0, 13, canvas.height); ctx.fillRect(canvas.width - 13, 0, 13, canvas.height);
    ctx.strokeStyle = '#1a4557'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(13, canvas.height); ctx.moveTo(canvas.width - 13, 0); ctx.lineTo(canvas.width - 13, canvas.height); ctx.stroke();
  }

  function drawAnchor(node) {
    const y = screenY(node.y); if (y < -30 || y > canvas.height + 30) return;
    const color = node.kind === 'spring' ? '#67ffb0' : node.kind === 'unstable' ? '#ffc36b' : node.kind === 'moving' ? '#ff4ecb' : '#50f5ef';
    const pulse = 1 + Math.sin(elapsed * 4 + node.phase) * 0.12;
    ctx.save(); ctx.translate(node.x, y); ctx.scale(pulse, pulse);
    ctx.shadowBlur = 18; ctx.shadowColor = color; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = color + '77'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 16, elapsed + node.phase, elapsed + node.phase + 1.1); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    drawBackground();
    for (const gate of hazards) {
      const y = screenY(gate.y); if (y < -20 || y > canvas.height + 20) continue;
      let center = gate.gapCenter + (gate.rotating ? Math.sin(elapsed * 0.9 + gate.phase) * 42 : 0);
      ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#ff4ecb'; ctx.strokeStyle = '#ff4ecb'; ctx.lineWidth = gate.width;
      ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(center - gate.gap / 2, y); ctx.moveTo(center + gate.gap / 2, y); ctx.lineTo(canvas.width - 16, y); ctx.stroke();
      ctx.restore();
    }
    for (const node of anchors) drawAnchor(node);
    for (const core of cores) {
      if (core.taken) continue; const y = screenY(core.y); if (y < -20 || y > canvas.height + 20) continue;
      ctx.save(); ctx.translate(core.x, y); ctx.rotate(core.phase); ctx.shadowBlur = 15; ctx.shadowColor = '#67ffb0'; ctx.strokeStyle = '#67ffb0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(8, 0); ctx.lineTo(0, 8); ctx.lineTo(-8, 0); ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    if (player.anchor) {
      const color = player.anchor.kind === 'spring' ? '#67ffb0' : player.anchor.kind === 'unstable' ? '#ffc36b' : player.anchor.kind === 'moving' ? '#ff4ecb' : '#50f5ef';
      ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = color; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(player.x, screenY(player.y)); ctx.lineTo(player.anchor.x, screenY(player.anchor.y)); ctx.stroke();
      ctx.restore();
    }
    const tideScreen = screenY(tideY);
    if (tideScreen < canvas.height) {
      const wave = ctx.createLinearGradient(0, tideScreen, 0, canvas.height);
      wave.addColorStop(0, '#ff27c655'); wave.addColorStop(1, '#be167b99');
      ctx.fillStyle = wave; ctx.beginPath(); ctx.moveTo(0, canvas.height); ctx.lineTo(0, tideScreen);
      for (let x = 0; x <= canvas.width; x += 12) ctx.lineTo(x, tideScreen + Math.sin(x * 0.035 + elapsed * 3) * 7);
      ctx.lineTo(canvas.width, canvas.height); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff4ecb'; ctx.lineWidth = 2; ctx.shadowBlur = 16; ctx.shadowColor = '#ff4ecb'; ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 8) { const y = tideScreen + Math.sin(x * 0.035 + elapsed * 3) * 7; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, screenY(p.y) - 2, 4, 4); }
    ctx.globalAlpha = 1;
    const py = screenY(player.y);
    ctx.save(); ctx.translate(player.x, py); ctx.rotate(Math.atan2(player.vy, player.vx) + Math.PI / 2);
    ctx.shadowBlur = 20; ctx.shadowColor = '#50f5ef'; ctx.fillStyle = player.invuln > 0 && Math.floor(elapsed * 18) % 2 ? '#fff' : '#b9fffb';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 5); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    if (!running) { draw(); return; }
    const dt = Math.min(0.032, (now - lastTime) / 1000 || 0); lastTime = now;
    if (!paused) update(dt);
    draw(); requestAnimationFrame(frame);
  }

  function startLoop() { requestAnimationFrame(frame); }
  document.getElementById('start-button').addEventListener('click', () => { begin(); startLoop(); });
  document.getElementById('restart-button').addEventListener('click', () => { begin(); startLoop(); });
  document.getElementById('rules-button').addEventListener('click', () => ui.rules.classList.add('visible'));
  document.getElementById('close-rules').addEventListener('click', () => ui.rules.classList.remove('visible'));
  document.getElementById('sound-button').addEventListener('click', event => { muted = !muted; event.currentTarget.textContent = muted ? 'SOUND OFF' : 'SOUND ON'; if (!muted) makeAudio(); });

  canvas.addEventListener('pointerdown', event => {
    if (!running || paused) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height + camera;
    let node = null; let distance = 72;
    for (const candidate of anchors) {
      if (!candidate.alive) continue;
      const d = Math.hypot(candidate.x - x, candidate.y - y);
      if (d < distance) { node = candidate; distance = d; }
    }
    pointerDown = true; grapple(node || undefined);
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointerup', () => { if (pointerDown) release(); pointerDown = false; });
  canvas.addEventListener('pointercancel', () => { if (pointerDown) release(); pointerDown = false; });

  window.addEventListener('keydown', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
    if (event.key === 'Escape' && running) { paused = !paused; ui.status.textContent = paused ? 'FLIGHT PAUSED' : 'ASCENT ACTIVE'; }
    if (event.code === 'Space' && !event.repeat) boost();
    keys[key] = true;
  });
  window.addEventListener('keyup', event => { keys[event.key.length === 1 ? event.key.toLowerCase() : event.key] = false; });
  document.querySelectorAll('[data-control]').forEach(button => {
    const control = button.dataset.control;
    const down = event => { event.preventDefault(); button.classList.add('active'); touchState[control] = true; };
    const up = event => { event.preventDefault(); button.classList.remove('active'); touchState[control] = false; };
    button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) { paused = true; ui.status.textContent = 'FLIGHT PAUSED'; }
    if (!document.hidden && running) lastTime = performance.now();
  });
  window.addEventListener('ARCADEVERSE_TEARDOWN', () => {
    running = false; if (audio && audio.state !== 'closed') audio.close();
  });
  reset(); draw();
}());
