/**
 * Procedural Web Audio Euclidean Rhythm Sequencer & Circular Beat Visualizer
 * Implements Bjorklund algorithm for optimal pulse distribution E(k, n)
 * Pure Vanilla JS, Web Audio API, zero dependencies, zero emojis.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EuclideanRhythm = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  /**
   * Generates Euclidean rhythm pattern array of length n with k pulses using Bjorklund algorithm
   * @param {number} steps - n total steps
   * @param {number} pulses - k active beats
   * @param {number} rotation - optional rotation shift r
   * @returns {number[]} Array of 1s and 0s
   */
  function generateEuclideanPattern(steps, pulses, rotation = 0) {
    steps = Math.max(1, Math.floor(steps || 1));
    pulses = Math.max(0, Math.min(steps, Math.floor(pulses || 0)));

    if (pulses === 0) {
      return new Array(steps).fill(0);
    }
    if (pulses >= steps) {
      return new Array(steps).fill(1);
    }

    let groups = [];
    for (let i = 0; i < steps; i++) {
      groups.push([i < pulses ? 1 : 0]);
    }

    while (true) {
      let firstZeros = -1;
      for (let i = 0; i < groups.length; i++) {
        if (groups[i][0] === 0) {
          firstZeros = i;
          break;
        }
      }

      if (firstZeros === -1) {
        break; // No zeros left to distribute
      }

      const ones = groups.slice(0, firstZeros);
      const zeros = groups.slice(firstZeros);

      if (zeros.length <= 1) {
        break;
      }

      const mergeCount = Math.min(ones.length, zeros.length);
      const newGroups = [];

      for (let i = 0; i < mergeCount; i++) {
        newGroups.push(ones[i].concat(zeros[i]));
      }

      if (ones.length > mergeCount) {
        for (let i = mergeCount; i < ones.length; i++) {
          newGroups.push(ones[i]);
        }
      } else if (zeros.length > mergeCount) {
        for (let i = mergeCount; i < zeros.length; i++) {
          newGroups.push(zeros[i]);
        }
      }

      groups = newGroups;
    }

    let pattern = [];
    for (let i = 0; i < groups.length; i++) {
      pattern = pattern.concat(groups[i]);
    }

    // Apply rotation
    if (rotation && pattern.length > 0) {
      const rot = ((rotation % pattern.length) + pattern.length) % pattern.length;
      if (rot > 0) {
        pattern = pattern.slice(pattern.length - rot).concat(pattern.slice(0, pattern.length - rot));
      }
    }

    return pattern;
  }

  const DEFAULT_TRACKS = [
    { name: 'Kick', steps: 8, pulses: 3, rotation: 0, color: '#00f2fe', freq: 60, type: 'sine', mute: false },
    { name: 'Snare', steps: 8, pulses: 2, rotation: 2, color: '#ff007f', freq: 180, type: 'triangle', mute: false },
    { name: 'Hi-Hat', steps: 16, pulses: 7, rotation: 1, color: '#38ef7d', freq: 800, type: 'square', mute: false },
    { name: 'Perc', steps: 12, pulses: 5, rotation: 0, color: '#f7b733', freq: 320, type: 'sawtooth', mute: false }
  ];

  class EuclideanEngine {
    constructor(options = {}) {
      this.tracks = (options.tracks || DEFAULT_TRACKS).map(t => Object.assign({}, t));
      this.bpm = options.bpm || 120;
      this.isPlaying = false;
      this.audioCtx = null;
      this.currentStep = 0;
      this.stepTime = 0;
      this.lookaheadMs = 25;
      this.scheduleAheadTime = 0.1;
      this.nextNoteTime = 0;
      this.timerID = null;
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    setBpm(bpm) {
      this.bpm = Math.max(30, Math.min(300, bpm));
    }

    getTrackPattern(trackIndex) {
      const track = this.tracks[trackIndex];
      if (!track) return [];
      return generateEuclideanPattern(track.steps, track.pulses, track.rotation);
    }

    playVoice(time, track) {
      if (!this.audioCtx || track.mute) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = track.type || 'sine';
      osc.frequency.setValueAtTime(track.freq, time);

      if (track.name === 'Kick') {
        osc.frequency.exponentialRampToValueAtTime(10, time + 0.15);
        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      } else if (track.name === 'Snare') {
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      } else if (track.name === 'Hi-Hat') {
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      } else {
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      }

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(time);
      osc.stop(time + 0.25);
    }

    start() {
      this.initAudio();
      this.isPlaying = true;
      if (this.audioCtx) {
        this.nextNoteTime = this.audioCtx.currentTime + 0.05;
      }
      this.scheduler();
    }

    stop() {
      this.isPlaying = false;
      if (this.timerID) {
        clearTimeout(this.timerID);
        this.timerID = null;
      }
    }

    scheduler() {
      if (!this.isPlaying) return;

      const secondsPer16th = 60.0 / this.bpm / 4.0;
      if (this.audioCtx) {
        while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
          this.scheduleStep(this.currentStep, this.nextNoteTime);
          this.nextNoteTime += secondsPer16th;
          this.currentStep = (this.currentStep + 1) % 48; // Common LCM multiple
        }
      }

      this.timerID = setTimeout(() => this.scheduler(), this.lookaheadMs);
    }

    scheduleStep(stepIndex, time) {
      this.tracks.forEach((track, tIdx) => {
        const pattern = this.getTrackPattern(tIdx);
        if (pattern.length > 0) {
          const step = stepIndex % pattern.length;
          if (pattern[step] === 1) {
            this.playVoice(time, track);
          }
        }
      });
    }

    renderVisualizer(ctx, width, height, progress = 0) {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(centerX, centerY) - 30;
      const ringStep = maxRadius / (this.tracks.length + 1);

      // Draw background rings and polygons
      this.tracks.forEach((track, tIdx) => {
        const radius = ringStep * (tIdx + 1.2);
        const pattern = this.getTrackPattern(tIdx);
        const count = pattern.length;

        // Base ring outline
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#182438';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Collect active polygon vertices
        const activeVerts = [];
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          if (pattern[i] === 1) {
            activeVerts.push({ x, y });
          }
        }

        // Draw connecting polygon
        if (activeVerts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(activeVerts[0].x, activeVerts[0].y);
          for (let v = 1; v < activeVerts.length; v++) {
            ctx.lineTo(activeVerts[v].x, activeVerts[v].y);
          }
          ctx.closePath();
          ctx.fillStyle = track.color + '18';
          ctx.fill();
          ctx.strokeStyle = track.color + 'aa';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw individual step nodes
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          ctx.beginPath();
          if (pattern[i] === 1) {
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = track.color;
            ctx.shadowColor = track.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#22344f';
            ctx.fill();
          }
        }
      });

      // Rotating playhead radial arm
      const playheadAngle = progress * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(playheadAngle) * maxRadius,
        centerY + Math.sin(playheadAngle) * maxRadius
      );
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function createStudio(container, options = {}) {
    if (!container) return null;

    const engine = new EuclideanEngine(options);

    container.innerHTML = `
      <div class="euclid-studio-container">
        <div class="euclid-header">
          <h2 class="euclid-title">Euclidean Rhythm Sequencer & Circular Visualizer</h2>
          <span style="font-size:0.85rem;color:var(--euclid-muted);">Bjorklund Algorithmic Generator</span>
        </div>
        <div class="euclid-workspace">
          <div class="euclid-visualizer-card">
            <canvas class="euclid-canvas" width="500" height="500"></canvas>
          </div>
          <div class="euclid-controls-card">
            <div class="euclid-master-bar">
              <button class="euclid-btn euclid-btn-primary" id="euclid-toggle-play">Play Sequence</button>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <label class="euclid-label">BPM:</label>
                <input type="number" id="euclid-bpm-input" value="${engine.bpm}" min="40" max="240" style="width:65px;background:#090e18;border:1px solid #1d2a45;color:#fff;padding:0.3rem;border-radius:4px;" />
              </div>
            </div>
            <div class="euclid-tracks-container" id="euclid-tracks-list"></div>
          </div>
        </div>
      </div>
    `;

    const canvas = container.querySelector('.euclid-canvas');
    const ctx = canvas.getContext('2d');
    const btnPlay = container.querySelector('#euclid-toggle-play');
    const inputBpm = container.querySelector('#euclid-bpm-input');
    const tracksList = container.querySelector('#euclid-tracks-list');

    function renderTracksUI() {
      tracksList.innerHTML = '';
      engine.tracks.forEach((track, idx) => {
        const pattern = engine.getTrackPattern(idx);
        const row = document.createElement('div');
        row.className = 'euclid-track-row';
        row.innerHTML = `
          <div class="euclid-track-header">
            <span class="euclid-track-title" style="color:${track.color}">${track.name} [E(${track.pulses}, ${track.steps})]</span>
            <label style="font-size:0.75rem;cursor:pointer;">
              <input type="checkbox" class="euclid-track-mute" data-track="${idx}" ${track.mute ? 'checked' : ''} /> Mute
            </label>
          </div>
          <div class="euclid-param-grid">
            <div class="euclid-param-item">
              <span class="euclid-label">Steps (n): ${track.steps}</span>
              <input type="range" class="euclid-range euclid-input-steps" data-track="${idx}" min="2" max="16" value="${track.steps}" />
            </div>
            <div class="euclid-param-item">
              <span class="euclid-label">Pulses (k): ${track.pulses}</span>
              <input type="range" class="euclid-range euclid-input-pulses" data-track="${idx}" min="0" max="${track.steps}" value="${track.pulses}" />
            </div>
            <div class="euclid-param-item">
              <span class="euclid-label">Rotation (r): ${track.rotation}</span>
              <input type="range" class="euclid-range euclid-input-rotation" data-track="${idx}" min="0" max="${track.steps - 1}" value="${track.rotation}" />
            </div>
          </div>
          <div class="euclid-pattern-preview">
            ${pattern.map(p => `<div class="euclid-step-pip ${p === 1 ? 'active' : ''}" style="${p === 1 ? `background:${track.color};box-shadow:0 0 6px ${track.color}` : ''}"></div>`).join('')}
          </div>
        `;
        tracksList.appendChild(row);
      });

      // Bind track events
      tracksList.querySelectorAll('.euclid-input-steps').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const tIdx = parseInt(e.target.dataset.track, 10);
          engine.tracks[tIdx].steps = parseInt(e.target.value, 10);
          if (engine.tracks[tIdx].pulses > engine.tracks[tIdx].steps) {
            engine.tracks[tIdx].pulses = engine.tracks[tIdx].steps;
          }
          renderTracksUI();
        });
      });

      tracksList.querySelectorAll('.euclid-input-pulses').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const tIdx = parseInt(e.target.dataset.track, 10);
          engine.tracks[tIdx].pulses = parseInt(e.target.value, 10);
          renderTracksUI();
        });
      });

      tracksList.querySelectorAll('.euclid-input-rotation').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const tIdx = parseInt(e.target.dataset.track, 10);
          engine.tracks[tIdx].rotation = parseInt(e.target.value, 10);
          renderTracksUI();
        });
      });

      tracksList.querySelectorAll('.euclid-track-mute').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const tIdx = parseInt(e.target.dataset.track, 10);
          engine.tracks[tIdx].mute = e.target.checked;
        });
      });
    }

    btnPlay.addEventListener('click', () => {
      if (engine.isPlaying) {
        engine.stop();
        btnPlay.textContent = 'Play Sequence';
        btnPlay.classList.remove('euclid-btn-secondary');
        btnPlay.classList.add('euclid-btn-primary');
      } else {
        engine.start();
        btnPlay.textContent = 'Pause Sequence';
        btnPlay.classList.remove('euclid-btn-primary');
        btnPlay.classList.add('euclid-btn-secondary');
      }
    });

    inputBpm.addEventListener('input', (e) => {
      engine.setBpm(parseInt(e.target.value, 10) || 120);
    });

    let animFrame = null;
    function animLoop(timestamp) {
      const beatPeriod = (60.0 / engine.bpm) * 4000;
      const progress = (timestamp % beatPeriod) / beatPeriod;
      engine.renderVisualizer(ctx, canvas.width, canvas.height, progress);
      animFrame = requestAnimationFrame(animLoop);
    }

    renderTracksUI();
    animFrame = requestAnimationFrame(animLoop);

    return {
      engine,
      renderTracksUI,
      destroy: () => {
        engine.stop();
        if (animFrame) cancelAnimationFrame(animFrame);
      }
    };
  }

  return {
    generateEuclideanPattern,
    EuclideanEngine,
    DEFAULT_TRACKS,
    createStudio
  };
}));
