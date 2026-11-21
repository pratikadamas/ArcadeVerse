(function () {
  'use strict';

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const ui = {
    sector: document.getElementById('sector'), title: document.getElementById('level-title'),
    description: document.getElementById('level-description'), number: document.getElementById('level-number'),
    timer: document.getElementById('timer'), campaign: document.getElementById('campaign'),
    palette: document.getElementById('palette'), table: document.getElementById('truth-table'),
    progress: document.getElementById('progress'), hint: document.getElementById('hint'),
    help: document.getElementById('help'), toast: document.getElementById('toast'),
    complete: document.getElementById('complete'), completeCopy: document.getElementById('complete-copy')
  };

  const gateCatalog = [
    { type: 'NOT', label: 'Inverter', pins: 1, color: '#ff73d4' },
    { type: 'AND', label: 'Conjunction', pins: 2, color: '#58e9ff' },
    { type: 'OR', label: 'Disjunction', pins: 2, color: '#a992ff' },
    { type: 'XOR', label: 'Parity', pins: 2, color: '#ffd071' },
    { type: 'NAND', label: 'Universal', pins: 2, color: '#ff8b75' },
    { type: 'NOR', label: 'Inverted OR', pins: 2, color: '#83efa4' }
  ];
  const levels = [
    { title: 'Signal Inversion', sector: 0, vars: ['A'], outputs: ['Q'], hint: 'A NOT gate has one input. It flips high to low and low to high.', fn: v => [!v.A] },
    { title: 'Dual Ignition Protocol', sector: 0, vars: ['A', 'B'], outputs: ['Q'], hint: 'Both ignition keys must be high. Use an AND gate.', fn: v => [v.A && v.B] },
    { title: 'Redundant Power Grid', sector: 0, vars: ['A', 'B'], outputs: ['Q'], hint: 'Either generator can power the grid. Combine them with OR.', fn: v => [v.A || v.B] },
    { title: 'Parity Discriminator', sector: 0, vars: ['A', 'B'], outputs: ['Q'], hint: 'Parity is high when the two input bits differ. An XOR gate does that.', fn: v => [v.A !== v.B] },
    { title: "De Morgan's Bridge", sector: 1, vars: ['A', 'B'], outputs: ['Q'], hint: 'Build the inverted conjunction from the available chips. NAND is universal.', fn: v => [!(v.A && v.B)] },
    { title: 'Majority Voting Circuit', sector: 1, vars: ['A', 'B', 'C'], outputs: ['Q'], hint: 'At least two of the three votes must be high. Combine pairwise AND results with OR.', fn: v => [(Number(v.A) + Number(v.B) + Number(v.C)) >= 2] },
    { title: 'Data Multiplexer 2-to-1', sector: 1, vars: ['A', 'B', 'S'], outputs: ['Q'], hint: 'S selects B when high and A when low: (A AND NOT S) OR (B AND S).', fn: v => [v.S ? v.B : v.A] },
    { title: 'Half-Adder', sector: 1, vars: ['A', 'B'], outputs: ['SUM', 'CARRY'], hint: 'A half-adder has XOR for SUM and AND for CARRY. Wire two output lamps.', fn: v => [v.A !== v.B, v.A && v.B] },
    { title: 'Full-Adder Core', sector: 1, vars: ['A', 'B', 'CIN'], outputs: ['SUM', 'COUT'], hint: 'SUM is odd parity across all three inputs. COUT is high when at least two bits are high.', fn: v => { const n = Number(v.A) + Number(v.B) + Number(v.CIN); return [n % 2 === 1, n >= 2]; } },
    { title: '2-bit Equality Comparator', sector: 2, vars: ['A1', 'A0', 'B1', 'B0'], outputs: ['EQ'], hint: 'Compare corresponding bits with XNOR (NOT XOR), then AND the two results.', fn: v => [v.A1 === v.B1 && v.A0 === v.B0] },
    { title: 'Binary Decoder', sector: 2, vars: ['A', 'B'], outputs: ['D0', 'D1', 'D2', 'D3'], hint: 'Each decoder output identifies one input combination. Invert the needed lines, then AND.', fn: v => [!v.A && !v.B, !v.A && v.B, v.A && !v.B, v.A && v.B] },
    { title: 'BCD Segment Display', sector: 2, vars: ['D3', 'D2', 'D1', 'D0'], outputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], hint: 'Decode BCD digits 0–9 into segments a–g. Codes 10–15 are treated as blank.', customVectors: true, fn: v => { const n = Number(v.D3) * 8 + Number(v.D2) * 4 + Number(v.D1) * 2 + Number(v.D0); const digits = [[1,1,1,1,1,1,0],[0,1,1,0,0,0,0],[1,1,0,1,1,0,1],[1,1,1,1,0,0,1],[0,1,1,0,0,1,1],[1,0,1,1,0,1,1],[1,0,1,1,1,1,1],[1,1,1,0,0,0,0],[1,1,1,1,1,1,1],[1,1,1,1,0,1,1]]; return (digits[n] || [0,0,0,0,0,0,0]).map(Boolean); } },
    { title: 'SR Latch Cell', sector: 2, vars: ['S', 'R'], outputs: ['Q', 'QBAR'], hint: 'The set/reset interface forbids S=R=1. For valid inputs, Q follows S and QBAR is its inverse.', fn: v => [v.S && !v.R, !v.S || v.R] },
    { title: 'Master Parity Checker', sector: 2, vars: ['P0', 'P1', 'P2', 'P3'], outputs: ['EVEN'], hint: 'Even parity is high when an even number of inputs are high. Chain XOR stages, then invert.', fn: v => [([v.P0,v.P1,v.P2,v.P3].filter(Boolean).length % 2) === 0] },
    { title: 'Quantum Key Forge', sector: 2, vars: ['K0', 'K1', 'K2'], outputs: ['Q'], hint: 'Forge the key with Q = K0 XOR (K1 AND K2). Follow the AND branch into XOR.', fn: v => [v.K0 !== (v.K1 && v.K2)] }
  ];
  const sectorNames = ['SECTOR 01 / DIGITAL BASICS', 'SECTOR 02 / COMBINATIONAL LOGIC', 'SECTOR 03 / MAINFRAME MODULES'];
  const gateMap = Object.fromEntries(gateCatalog.map(g => [g.type, g]));
  let levelIndex = 0;
  let unlocked = 0;
  let gates = [];
  let wires = [];
  let outputSources = [];
  let selectedChip = null;
  let pendingSource = null;
  let nextGateId = 1;
  let timeLeft = 45;
  let clockIndex = 0;
  let clockRunning = false;
  let soundEnabled = true;
  let audioContext = null;
  let previousTime = performance.now();
  let loopStarted = false;
  let tornDown = false;
  let toastUntil = 0;

  try { unlocked = Math.max(0, Math.min(14, Number(localStorage.getItem('cyber_logic_unlock')) || 0)); } catch (_) { unlocked = 0; }

  function vectorsFor(level) {
    if (level.customVectors) return Array.from({ length: 10 }, (_, n) => ({ D3: !!(n & 8), D2: !!(n & 4), D1: !!(n & 2), D0: !!(n & 1) }));
    const rows = [];
    for (let mask = 0; mask < (1 << level.vars.length); mask++) {
      const row = {};
      level.vars.forEach((name, i) => { row[name] = Boolean(mask & (1 << (level.vars.length - 1 - i))); });
      rows.push(row);
    }
    return rows;
  }

  function expectedFor(level, vector) { return level.fn(vector).map(Boolean); }

  function setupCampaign() {
    ui.campaign.textContent = '';
    levels.forEach((level, i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = String(i + 1).padStart(2, '0');
      button.setAttribute('aria-label', 'Level ' + (i + 1) + ': ' + level.title);
      button.disabled = i > unlocked;
      button.classList.toggle('done', i < unlocked);
      button.classList.toggle('active', i === levelIndex);
      button.addEventListener('click', () => loadLevel(i));
      ui.campaign.appendChild(button);
    });
  }

  function loadLevel(index) {
    if (index > unlocked) return;
    levelIndex = index; gates = []; wires = []; pendingSource = null; selectedChip = null; nextGateId = 1;
    timeLeft = 45; clockIndex = 0; clockRunning = false; outputSources = levels[index].outputs.map(() => null);
    ui.complete.classList.remove('visible');
    const level = levels[index];
    ui.sector.textContent = sectorNames[level.sector];
    ui.title.textContent = level.title; ui.description.textContent = 'Forge the circuit that matches every required output vector.';
    ui.number.textContent = String(index + 1).padStart(2, '0'); ui.hint.textContent = level.hint;
    ui.timer.textContent = '45.0'; ui.timer.style.color = '#ffd071';
    renderPalette(); renderTruthTable(); setupCampaign(); updateHelp(); render();
  }

  function renderPalette() {
    ui.palette.textContent = '';
    gateCatalog.forEach(spec => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'chip';
      button.classList.toggle('selected', selectedChip === spec.type);
      button.innerHTML = spec.type + '<span>' + spec.label + '</span>';
      button.addEventListener('click', () => {
        selectedChip = selectedChip === spec.type ? null : spec.type;
        renderPalette(); updateHelp();
      });
      ui.palette.appendChild(button);
    });
  }

  function renderTruthTable() {
    const level = levels[levelIndex];
    const vectors = vectorsFor(level);
    let html = '<thead><tr>' + level.vars.map(v => '<th>' + v + '</th>').join('') + level.outputs.map(o => '<th>' + o + '</th>').join('') + '<th>CHECK</th></tr></thead><tbody>';
    vectors.forEach((vector, i) => {
      const expected = expectedFor(level, vector);
      html += '<tr data-row="' + i + '">' + level.vars.map(v => '<td>' + Number(vector[v]) + '</td>').join('') + expected.map(v => '<td class="expected">' + Number(v) + '</td>').join('') + '<td class="result">—</td></tr>';
    });
    ui.table.innerHTML = html + '</tbody>';
    updateTruthTable();
  }

  function drawPositions() {
    const level = levels[levelIndex];
    const inputYs = level.vars.map((_, i) => 92 + i * (326 / Math.max(1, level.vars.length - 1)));
    const outputYs = level.outputs.map((_, i) => level.outputs.length === 1 ? 255 : 92 + i * (326 / Math.max(1, level.outputs.length - 1)));
    return { inputYs, outputYs };
  }

  function sourceValue(source, vector, visited) {
    if (!source) return null;
    if (Object.hasOwn(vector, source)) return vector[source];
    const gate = gates.find(g => g.id === source);
    if (!gate) return null;
    if (visited.has(source)) return 'CYCLE';
    visited.add(source);
    const inputs = gate.inputs.map(input => sourceValue(input, vector, visited));
    visited.delete(source);
    if (inputs.includes('CYCLE')) return 'CYCLE';
    if (inputs.some(v => v === null)) return null;
    const [a, b] = inputs;
    switch (gate.type) {
      case 'NOT': return !a;
      case 'AND': return a && b;
      case 'OR': return a || b;
      case 'XOR': return a !== b;
      case 'NAND': return !(a && b);
      case 'NOR': return !(a || b);
      default: return null;
    }
  }

  function evaluate(vector) { return outputSources.map(source => sourceValue(source, vector, new Set())); }

  function updateTruthTable() {
    const level = levels[levelIndex];
    const vectors = vectorsFor(level);
    let passed = 0; let cycle = false;
    vectors.forEach((vector, i) => {
      const actual = evaluate(vector); const expected = expectedFor(level, vector);
      const isCycle = actual.includes('CYCLE'); cycle = cycle || isCycle;
      const valid = !isCycle && actual.every((value, j) => value !== null && value === expected[j]);
      const row = ui.table.querySelector('[data-row="' + i + '"]');
      row.classList.toggle('pass', valid); row.classList.toggle('active-row', i === clockIndex);
      const result = row.querySelector('.result'); result.textContent = isCycle ? 'LOOP' : valid ? 'OK' : '·';
      passed += valid ? 1 : 0;
    });
    ui.progress.textContent = passed + ' / ' + vectors.length + ' VERIFIED';
    if (cycle) { ui.help.textContent = 'Feedback loop detected. Rewire the cyclic path before running the circuit.'; }
    if (passed === vectors.length && vectors.length) completeLevel();
  }

  function completeLevel() {
    if (ui.complete.classList.contains('visible')) return;
    clockRunning = false; playTone(660, 0.18); setTimeout(() => playTone(990, 0.3), 130);
    unlocked = Math.max(unlocked, Math.min(14, levelIndex + 1));
    try { localStorage.setItem('cyber_logic_unlock', String(unlocked)); } catch (_) {}
    setupCampaign();
    ui.completeCopy.textContent = 'All ' + vectorsFor(levels[levelIndex]).length + ' input vectors match the target truth table.';
    document.getElementById('next').textContent = levelIndex === 14 ? 'CAMPAIGN COMPLETE' : 'NEXT MODULE';
    ui.complete.classList.add('visible');
  }

  function playTone(frequency, duration) {
    if (!soundEnabled || !audioContext) return;
    try {
      const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(0.045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
    } catch (_) {}
  }

  function startAudio() {
    if (!audioContext) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audioContext = new AudioClass();
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
  }

  function notify(message) {
    ui.toast.textContent = message; ui.toast.classList.add('show'); toastUntil = performance.now() + 1900;
  }

  function updateHelp() {
    if (selectedChip) ui.help.textContent = selectedChip + ' selected. Click an open socket on the board to place the chip.';
    else if (pendingSource) ui.help.textContent = 'Output selected. Click a gate input or Q output to complete the wire.';
    else ui.help.textContent = 'Choose a chip, place it on the board. Click output pins and inputs to wire, then connect a gate output to Q.';
  }

  function addWire(source, target, inputIndex) {
    if (source === target) { notify('A gate cannot feed itself.'); return; }
    if (target === 'OUT:' + inputIndex) {
      outputSources[inputIndex] = source;
      wires = wires.filter(w => w.target !== target);
      wires.push({ source, target, inputIndex });
    } else {
      const gate = gates.find(g => g.id === target);
      if (!gate) return;
      gate.inputs[inputIndex] = source;
      wires = wires.filter(w => !(w.target === target && w.inputIndex === inputIndex));
      wires.push({ source, target, inputIndex });
    }
    pendingSource = null; playTone(420, 0.08); updateHelp(); updateTruthTable();
  }

  function pinAt(x, y) {
    const { inputYs, outputYs } = drawPositions();
    for (let i = 0; i < levels[levelIndex].vars.length; i++) if (Math.hypot(x - 110, y - inputYs[i]) < 17) return { kind: 'source', id: levels[levelIndex].vars[i] };
    for (const gate of gates) {
      if (Math.hypot(x - (gate.x + 48), y - gate.y) < 19) return { kind: 'source', id: gate.id };
      const spec = gateMap[gate.type];
      for (let p = 0; p < spec.pins; p++) {
        const py = gate.y + (spec.pins === 1 ? 0 : (p === 0 ? -12 : 12));
        if (Math.hypot(x - (gate.x - 48), y - py) < 17) return { kind: 'input', id: gate.id, index: p };
      }
    }
    for (let i = 0; i < outputYs.length; i++) if (Math.hypot(x - 700, y - outputYs[i]) < 20) return { kind: 'output', index: i };
    return null;
  }

  function boardClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    const pin = pinAt(x, y);
    if (pin) {
      if (pin.kind === 'source') {
        if (pendingSource === pin.id) pendingSource = null;
        else pendingSource = pin.id;
      } else if (pendingSource) {
        addWire(pendingSource, pin.kind === 'output' ? 'OUT:' + pin.index : pin.id, pin.kind === 'output' ? pin.index : pin.index);
      } else notify('Select a signal source first.');
      updateHelp(); updateTruthTable(); render(); return;
    }
    if (selectedChip) {
      const gx = Math.round((x - 200) / 145) * 145 + 200;
      const gy = Math.round((y - 110) / 105) * 105 + 110;
      if (gx < 190 || gx > 490 || gy < 95 || gy > 425) { notify('Place chips inside the socket grid.'); return; }
      if (gates.some(g => Math.hypot(g.x - gx, g.y - gy) < 42)) { notify('That socket is occupied.'); return; }
      const spec = gateMap[selectedChip];
      gates.push({ id: 'G' + nextGateId++, type: selectedChip, x: gx, y: gy, inputs: Array(spec.pins).fill(null) });
      selectedChip = null; renderPalette(); updateHelp(); updateTruthTable(); render(); playTone(300, 0.08);
    } else if (pendingSource) {
      pendingSource = null; updateHelp(); render();
    }
  }

  function wirePath(source, target, portIndex) {
    const { inputYs, outputYs } = drawPositions();
    let sx; let sy; let ex; let ey;
    if (Object.hasOwn(Object.fromEntries(levels[levelIndex].vars.map(v => [v, true])), source)) {
      sx = 110; sy = inputYs[levels[levelIndex].vars.indexOf(source)];
    } else {
      const gate = gates.find(g => g.id === source); if (!gate) return null;
      sx = gate.x + 48; sy = gate.y;
    }
    if (target.startsWith('OUT:')) { ex = 700; ey = outputYs[portIndex]; }
    else {
      const gate = gates.find(g => g.id === target); if (!gate) return null;
      ex = gate.x - 48; ey = gate.y + (gate.inputs.length === 1 ? 0 : portIndex === 0 ? -12 : 12);
    }
    return { sx, sy, ex, ey };
  }

  function signalValue(source) {
    const vector = vectorsFor(levels[levelIndex])[clockIndex % vectorsFor(levels[levelIndex]).length];
    return sourceValue(source, vector, new Set());
  }

  function render() {
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07131e'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#173140'; ctx.lineWidth = 1;
    for (let x = 20; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 10; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const { inputYs, outputYs } = drawPositions();
    for (const wire of wires) {
      const path = wirePath(wire.source, wire.target, wire.inputIndex); if (!path) continue;
      const value = signalValue(wire.source);
      ctx.beginPath(); ctx.moveTo(path.sx, path.sy); ctx.lineTo((path.sx + path.ex) / 2, path.sy); ctx.lineTo((path.sx + path.ex) / 2, path.ey); ctx.lineTo(path.ex, path.ey);
      ctx.strokeStyle = value === true ? '#53f4ed' : value === false ? '#526775' : '#315064';
      ctx.lineWidth = value === true ? 3 : 2; ctx.shadowBlur = value === true ? 10 : 0; ctx.shadowColor = '#53f4ed'; ctx.stroke(); ctx.shadowBlur = 0;
      if (value === true) {
        const t = (performance.now() / 900) % 1; const px = path.sx + (path.ex - path.sx) * t;
        ctx.fillStyle = '#e4ffff'; ctx.beginPath(); ctx.arc(px, path.sy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    levels[levelIndex].vars.forEach((name, i) => {
      const val = signalValue(name); terminal(26, inputYs[i], name, val); pin(110, inputYs[i], val);
      ctx.strokeStyle = val ? '#53f4ed' : '#526775'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(44, inputYs[i]); ctx.lineTo(110, inputYs[i]); ctx.stroke();
    });
    gates.forEach(gate => {
      const spec = gateMap[gate.type]; const value = sourceValue(gate.id, vectorsFor(levels[levelIndex])[clockIndex % vectorsFor(levels[levelIndex]).length], new Set());
      const color = spec.color;
      ctx.fillStyle = '#0b202e'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = color + '55';
      ctx.beginPath(); ctx.roundRect(gate.x - 36, gate.y - 25, 72, 50, 8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = color; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(gate.type, gate.x, gate.y + 4);
      ctx.fillStyle = '#718d9f'; ctx.font = '8px Arial'; ctx.fillText(gate.id, gate.x, gate.y + 17);
      for (let p = 0; p < spec.pins; p++) pin(gate.x - 48, gate.y + (spec.pins === 1 ? 0 : p === 0 ? -12 : 12), gate.inputs[p] ? signalValue(gate.inputs[p]) : null);
      pin(gate.x + 48, gate.y, value);
    });
    levels[levelIndex].outputs.forEach((name, i) => {
      const val = outputSources[i] ? signalValue(outputSources[i]) : null;
      ctx.strokeStyle = val === true ? '#6bffb3' : '#526775'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(700, outputYs[i]); ctx.lineTo(724, outputYs[i]); ctx.stroke();
      terminal(734, outputYs[i], name, val, true); pin(700, outputYs[i], val);
    });
    if (pendingSource) {
      ctx.fillStyle = '#53f4ed'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
      ctx.fillText('CONNECT ' + (levels[levelIndex].vars.includes(pendingSource) ? pendingSource : pendingSource), 380, 478);
    }
  }

  function pin(x, y, value) {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = value === true ? '#53f4ed' : value === false ? '#334654' : '#0b1925';
    ctx.strokeStyle = value === true ? '#cffffd' : '#4b6777'; ctx.lineWidth = 1.5;
    if (value === true) { ctx.shadowBlur = 12; ctx.shadowColor = '#53f4ed'; }
    ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  }

  function terminal(x, y, label, value, output) {
    ctx.textAlign = output ? 'right' : 'left'; ctx.font = 'bold 11px Arial';
    ctx.fillStyle = value === true ? '#53f4ed' : value === false ? '#718695' : '#a8bdc9';
    ctx.fillText(label + (value === null ? '' : '  ' + Number(value)), output ? x - 8 : x, y - 11);
    ctx.fillStyle = value === true ? '#53f4ed' : '#304454'; ctx.fillRect(output ? x - 8 : x, y - 3, output ? -4 : 4, 6);
  }

  function stepClock() {
    const rows = vectorsFor(levels[levelIndex]);
    clockIndex = (clockIndex + 1) % rows.length;
    updateTruthTable(); render(); playTone(480 + clockIndex * 35, 0.055);
  }

  function tick(now) {
    if (tornDown) return;
    const dt = Math.min(0.05, (now - previousTime) / 1000 || 0); previousTime = now;
    if (!ui.complete.classList.contains('visible') && timeLeft > 0) {
      timeLeft = Math.max(0, timeLeft - dt);
      ui.timer.textContent = timeLeft.toFixed(1);
      ui.timer.style.color = timeLeft < 10 ? '#ff7295' : '#ffd071';
      if (timeLeft === 0) { notify('Reactor surge! Reset the circuit and try again.'); clearCircuit(); }
    }
    if (clockRunning && now >= tick.nextClock) { stepClock(); tick.nextClock = now + 650; }
    if (toastUntil && now > toastUntil) { ui.toast.classList.remove('show'); toastUntil = 0; }
    render(); requestAnimationFrame(tick);
  }
  tick.nextClock = 0;

  function clearCircuit() {
    gates = []; wires = []; outputSources = levels[levelIndex].outputs.map(() => null);
    pendingSource = null; selectedChip = null; nextGateId = 1; timeLeft = 45; clockIndex = 0;
    ui.timer.textContent = '45.0'; renderPalette(); updateHelp(); renderTruthTable(); render();
  }

  document.getElementById('clock').addEventListener('click', event => {
    startAudio(); clockRunning = !clockRunning; event.currentTarget.textContent = clockRunning ? 'STOP CLOCK' : 'RUN CLOCK';
    if (clockRunning) { stepClock(); tick.nextClock = performance.now() + 650; }
  });
  document.getElementById('clear').addEventListener('click', clearCircuit);
  document.getElementById('sound').addEventListener('click', event => {
    soundEnabled = !soundEnabled; event.currentTarget.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    if (soundEnabled) startAudio();
  });
  document.getElementById('next').addEventListener('click', () => {
    if (levelIndex < levels.length - 1) loadLevel(levelIndex + 1);
    else { ui.complete.classList.remove('visible'); notify('Campaign complete. All modules verified.'); }
  });
  canvas.addEventListener('pointerdown', boardClick);
  document.addEventListener('visibilitychange', () => { previousTime = performance.now(); });
  window.addEventListener('ARCADEVERSE_TEARDOWN', () => {
    tornDown = true; loopStarted = false;
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
  });

  loadLevel(0);
  if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }
}());
