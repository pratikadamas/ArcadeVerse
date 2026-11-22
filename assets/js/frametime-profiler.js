/**
 * ArcadeVerse - Frametime Jitter & Jank Profiler HUD
 * 
 * Provides an in-depth performance monitor for arcade games and canvas rendering.
 * Features:
 * - Rolling 120-frame histogram rendering delta times in milliseconds
 * - Color-coded performance thresholds:
 *     Green: < 16.6ms (60+ FPS)
 *     Amber: 16.7ms - 33.3ms (30-59 FPS)
 *     Red: > 33.3ms (Micro-stutter / Jank spike)
 * - Quantitative 99th percentile frametime and frame stability score (0-100%)
 * - Toggleable overlay via Ctrl+Shift+F shortcut or HUD toggle button
 * - JSON performance telemetry export for benchmarking
 * - 100% Vanilla JS + HTML5 Canvas, zero external dependencies
 */

(function () {
  'use strict';

  var MAX_SAMPLES = 120;
  var samples = [];
  var lastTimestamp = 0;
  var rafId = null;
  var isVisible = false;
  var canvas = null;
  var ctx = null;
  var hudEl = null;
  var initialized = false;

  var FrametimeProfiler = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.injectStyles();
      this.injectHUD();
      this.attachEvents();
    },

    injectStyles: function () {
      if (document.getElementById('frametime-profiler-styles')) return;

      var style = document.createElement('style');
      style.id = 'frametime-profiler-styles';
      style.textContent = [
        '#frametime-hud { position: fixed; top: 70px; right: 20px; width: 280px; background: rgba(12, 16, 23, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.2); z-index: 99998; display: none; flex-direction: column; overflow: hidden; font-family: monospace, monospace; color: #f0f6fc; backdrop-filter: blur(6px); }',
        '#frametime-hud.active { display: flex; }',
        '.ft-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(0, 240, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.75rem; font-weight: bold; color: #00f0ff; }',
        '.ft-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }',
        '#ft-histogram-canvas { width: 100%; height: 75px; background: #06090e; border: 1px solid #21262d; border-radius: 4px; display: block; }',
        '.ft-metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.72rem; }',
        '.ft-metric-box { background: #161b22; padding: 4px 8px; border-radius: 4px; border: 1px solid #30363d; display: flex; flex-direction: column; gap: 2px; }',
        '.ft-metric-label { font-size: 0.65rem; color: #8b949e; }',
        '.ft-metric-val { font-weight: bold; color: #00f0ff; }',
        '.ft-footer { padding: 6px 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; font-size: 0.7rem; background: #080b11; }',
        '.ft-btn { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 4px; padding: 3px 8px; cursor: pointer; font-family: inherit; font-size: 0.68rem; transition: background 0.2s; }',
        '.ft-btn:hover { background: rgba(0, 240, 255, 0.15); }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectHUD: function () {
      if (document.getElementById('frametime-hud')) return;

      hudEl = document.createElement('div');
      hudEl.id = 'frametime-hud';
      hudEl.setAttribute('role', 'region');
      hudEl.setAttribute('aria-label', 'Frametime Jitter Profiler');

      hudEl.innerHTML = [
        '<div class="ft-header">',
        '  <span>FRAMETIME JITTER HUD</span>',
        '  <button class="ft-btn" id="ft-close-btn" style="padding:1px 6px;">X</button>',
        '</div>',
        '<div class="ft-body">',
        '  <canvas id="ft-histogram-canvas" width="256" height="75"></canvas>',
        '  <div class="ft-metrics-grid">',
        '    <div class="ft-metric-box">',
        '      <span class="ft-metric-label">Avg Frametime:</span>',
        '      <span class="ft-metric-val" id="ft-avg-val">16.6 ms</span>',
        '    </div>',
        '    <div class="ft-metric-box">',
        '      <span class="ft-metric-label">99th Percentile:</span>',
        '      <span class="ft-metric-val" id="ft-p99-val">17.2 ms</span>',
        '    </div>',
        '    <div class="ft-metric-box">',
        '      <span class="ft-metric-label">Jank Spikes:</span>',
        '      <span class="ft-metric-val" id="ft-jank-val" style="color:#3fb950;">0</span>',
        '    </div>',
        '    <div class="ft-metric-box">',
        '      <span class="ft-metric-label">Stability Index:</span>',
        '      <span class="ft-metric-val" id="ft-stab-val">100%</span>',
        '    </div>',
        '  </div>',
        '</div>',
        '<div class="ft-footer">',
        '  <span style="color:#8b949e;">Ctrl+Shift+F</span>',
        '  <button class="ft-btn" id="ft-export-btn">Export JSON</button>',
        '</div>'
      ].join('');

      document.body.appendChild(hudEl);

      canvas = document.getElementById('ft-histogram-canvas');
      if (canvas) ctx = canvas.getContext('2d');

      var closeBtn = document.getElementById('ft-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { FrametimeProfiler.toggle(false); });

      var exportBtn = document.getElementById('ft-export-btn');
      if (exportBtn) exportBtn.addEventListener('click', function () { FrametimeProfiler.exportTelemetry(); });
    },

    toggle: function (forceState) {
      isVisible = (typeof forceState === 'boolean') ? forceState : !isVisible;
      if (!hudEl) return;

      if (isVisible) {
        hudEl.classList.add('active');
        lastTimestamp = performance.now();
        this.loop();
      } else {
        hudEl.classList.remove('active');
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    },

    loop: function () {
      if (!isVisible) return;

      var now = performance.now();
      var dt = now - lastTimestamp;
      lastTimestamp = now;

      // Filter out crazy background tab resumption outliers
      if (dt > 0 && dt < 250) {
        samples.push(dt);
        if (samples.length > MAX_SAMPLES) samples.shift();
      }

      this.render();

      rafId = requestAnimationFrame(function () {
        FrametimeProfiler.loop();
      });
    },

    render: function () {
      if (!ctx || !canvas || samples.length === 0) return;

      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Baseline 16.6ms (60 FPS) and 33.3ms (30 FPS) guidelines
      var maxDt = 50; // top ceiling for histogram
      var y60 = h - (16.66 / maxDt) * h;
      var y30 = h - (33.33 / maxDt) * h;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);

      // 60 FPS line
      ctx.beginPath();
      ctx.moveTo(0, y60);
      ctx.lineTo(w, y60);
      ctx.stroke();

      // 30 FPS line
      ctx.beginPath();
      ctx.moveTo(0, y30);
      ctx.lineTo(w, y30);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw bars
      var barWidth = w / MAX_SAMPLES;
      var sum = 0;
      var janks = 0;

      for (var i = 0; i < samples.length; i++) {
        var s = samples[i];
        sum += s;
        var barH = Math.min(h, (s / maxDt) * h);
        var x = i * barWidth;
        var y = h - barH;

        if (s <= 18) {
          ctx.fillStyle = '#3fb950'; // Smooth Green
        } else if (s <= 34) {
          ctx.fillStyle = '#d29922'; // Amber
        } else {
          ctx.fillStyle = '#f85149'; // Red Spike
          janks++;
        }

        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barH);
      }

      // Update telemetry readouts
      var avg = sum / samples.length;
      var sorted = samples.slice().sort(function (a, b) { return a - b; });
      var p99Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
      var p99 = sorted[p99Index] || avg;

      var stability = Math.max(0, Math.min(100, Math.round(100 - (janks / samples.length) * 100)));

      var avgEl = document.getElementById('ft-avg-val');
      var p99El = document.getElementById('ft-p99-val');
      var jankEl = document.getElementById('ft-jank-val');
      var stabEl = document.getElementById('ft-stab-val');

      if (avgEl) avgEl.textContent = avg.toFixed(1) + ' ms';
      if (p99El) p99El.textContent = p99.toFixed(1) + ' ms';
      if (jankEl) {
        jankEl.textContent = janks;
        jankEl.style.color = janks > 0 ? '#f85149' : '#3fb950';
      }
      if (stabEl) stabEl.textContent = stability + '%';
    },

    exportTelemetry: function () {
      var data = {
        timestamp: new Date().toISOString(),
        sampleCount: samples.length,
        frametimesMs: samples
      };

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'arcade-frametimes-' + Date.now() + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    attachEvents: function () {
      window.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
          e.preventDefault();
          FrametimeProfiler.toggle();
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      FrametimeProfiler.init();
    });
  } else {
    FrametimeProfiler.init();
  }

  window.FrametimeProfiler = FrametimeProfiler;
})();
