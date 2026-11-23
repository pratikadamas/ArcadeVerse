/**
 * ArcadeVerse Retro CRT Arcade Post-Processing Shader Engine (#1052)
 * Lightweight WebGL 2.0 / 1.0 Shader Overlay Pipeline
 * Simulates 1980s curved CRT monitor glass, phosphor bloom, horizontal scanlines,
 * chromatic aberration, and vignette with zero third-party dependencies.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeCRTShaderEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'av_crt_preset';

  var PRESETS = {
    off: { id: 'off', name: 'Off / Bypass', curvature: 0.0, scanlines: 0.0, bloom: 0.0, aberration: 0.0, tint: [1.0, 1.0, 1.0] },
    arcade: { id: 'arcade', name: 'Arcade Standard (15kHz RGB)', curvature: 0.08, scanlines: 0.45, bloom: 0.25, aberration: 0.003, tint: [1.0, 1.0, 1.0] },
    cyberpunk: { id: 'cyberpunk', name: 'Cyberpunk Neon CRT', curvature: 0.12, scanlines: 0.55, bloom: 0.6, aberration: 0.006, tint: [0.85, 1.05, 1.25] },
    amber: { id: 'amber', name: 'Amber Monochrome (VT220)', curvature: 0.10, scanlines: 0.65, bloom: 0.4, aberration: 0.002, tint: [1.3, 0.85, 0.2] },
    gameboy: { id: 'gameboy', name: 'Game Boy DMG-01 Matrix', curvature: 0.02, scanlines: 0.35, bloom: 0.15, aberration: 0.001, tint: [0.65, 0.85, 0.3] }
  };

  var VS_SOURCE = [
    'attribute vec2 a_position;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = (a_position + 1.0) * 0.5;',
    '  gl_Position = vec4(a_position, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_SOURCE = [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform float u_curvature;',
    'uniform float u_scanlines;',
    'uniform float u_bloom;',
    'uniform float u_aberration;',
    'uniform vec3 u_tint;',
    '',
    'vec2 barrelDistortion(vec2 uv, float k) {',
    '  vec2 d = uv - 0.5;',
    '  float r2 = dot(d, d);',
    '  return uv + d * (r2 * k);',
    '}',
    '',
    'void main() {',
    '  vec2 uv = v_uv;',
    '  if (u_curvature > 0.0) {',
    '    uv = barrelDistortion(uv, u_curvature);',
    '  }',
    '',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.7);',
    '    return;',
    '  }',
    '',
    '  // Horizontal scanline modulation',
    '  float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.5 + 0.5;',
    '  float scanFactor = 1.0 - (scanline * u_scanlines * 0.35);',
    '',
    '  // Radial vignette corner fall-off',
    '  float vig = (16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y));',
    '  vig = clamp(pow(vig, 0.22), 0.0, 1.0);',
    '',
    '  // Chromatic aberration color overlay',
    '  float r = u_aberration * 2.0;',
    '  vec3 col = vec3(0.02, 0.03, 0.04);',
    '  col.r += r * 5.0;',
    '  col.b += r * 4.0;',
    '',
    '  // Apply tint and scanlines',
    '  col = col * u_tint * scanFactor * vig;',
    '  float alpha = clamp(u_scanlines * 0.28 + (1.0 - vig) * 0.65, 0.0, 0.85);',
    '',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  var canvas = null;
  var gl = null;
  var program = null;
  var uniforms = {};
  var animationId = null;
  var currentPreset = 'arcade';
  var isThrottled = false;

  function loadSavedPreset() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && PRESETS[saved]) {
        currentPreset = saved;
      }
    } catch (_) {}
  }

  function savePreset(presetKey) {
    currentPreset = presetKey;
    try {
      localStorage.setItem(STORAGE_KEY, presetKey);
    } catch (_) {}
  }

  function isReducedMotion() {
    try {
      if (typeof window !== 'undefined' && window.ArcadeVerseA11y && typeof window.ArcadeVerseA11y.isReducedMotion === 'function') {
        return window.ArcadeVerseA11y.isReducedMotion();
      }
      if (typeof window !== 'undefined' && window.A11yEngine && window.A11yEngine.prefs && window.A11yEngine.prefs.reducedMotion) {
        return true;
      }
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (_) {}
    return false;
  }

  function createShader(glCtx, type, source) {
    var shader = glCtx.createShader(type);
    glCtx.shaderSource(shader, source);
    glCtx.compileShader(shader);
    if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
      glCtx.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initGL() {
    if (!canvas) return false;
    try {
      gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false }) ||
           canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    } catch (_) {
      gl = null;
    }
    if (!gl) return false;

    var vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    var fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return false;
    }

    gl.useProgram(program);

    var positionLocation = gl.getAttribLocation(program, 'a_position');
    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      curvature: gl.getUniformLocation(program, 'u_curvature'),
      scanlines: gl.getUniformLocation(program, 'u_scanlines'),
      bloom: gl.getUniformLocation(program, 'u_bloom'),
      aberration: gl.getUniformLocation(program, 'u_aberration'),
      tint: gl.getUniformLocation(program, 'u_tint')
    };

    return true;
  }

  function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    var width = Math.max(100, Math.floor(rect.width));
    var height = Math.max(100, Math.floor(rect.height));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      if (gl) {
        gl.viewport(0, 0, width, height);
      }
    }
  }

  function render(time) {
    if (!canvas || !gl || !program) return;

    if (currentPreset === 'off' || isReducedMotion()) {
      canvas.style.display = 'none';
      return;
    }

    canvas.style.display = 'block';
    resizeCanvas();

    var cfg = PRESETS[currentPreset] || PRESETS.arcade;

    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, (time || 0) * 0.001);
    gl.uniform1f(uniforms.curvature, cfg.curvature);
    gl.uniform1f(uniforms.scanlines, cfg.scanlines);
    gl.uniform1f(uniforms.bloom, cfg.bloom);
    gl.uniform1f(uniforms.aberration, cfg.aberration);
    gl.uniform3f(uniforms.tint, cfg.tint[0], cfg.tint[1], cfg.tint[2]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (!isThrottled) {
      animationId = requestAnimationFrame(render);
    }
  }

  function start() {
    if (!animationId && !isThrottled) {
      animationId = requestAnimationFrame(render);
    }
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function mountOverlay() {
    var wrapper = document.querySelector('.modal-frame-wrapper');
    if (!wrapper || document.getElementById('crt-overlay-canvas')) return;

    canvas = document.createElement('canvas');
    canvas.id = 'crt-overlay-canvas';
    canvas.className = 'crt-overlay-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '5';

    wrapper.appendChild(canvas);

    initGL();
    resizeCanvas();
    start();
  }

  function unmountOverlay() {
    stop();
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    gl = null;
    program = null;
  }

  function setPreset(presetKey) {
    if (!PRESETS[presetKey]) return;
    savePreset(presetKey);
    if (currentPreset === 'off') {
      if (canvas) canvas.style.display = 'none';
      stop();
    } else {
      if (canvas) canvas.style.display = 'block';
      start();
    }
    updateUIButtons();
  }

  function updateUIButtons() {
    var buttons = document.querySelectorAll('.crt-preset-btn');
    buttons.forEach(function (btn) {
      var preset = btn.getAttribute('data-preset');
      if (preset === currentPreset) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function createToolbarControl() {
    var controls = document.querySelector('.modal-controls');
    if (!controls || document.getElementById('modal-crt-btn')) return;

    var crtWrapper = document.createElement('div');
    crtWrapper.className = 'modal-crt-wrapper';
    crtWrapper.id = 'modal-crt-wrapper';
    crtWrapper.style.position = 'relative';

    crtWrapper.innerHTML = [
      '<button class="btn btn-sm btn-icon" id="modal-crt-btn" title="CRT Retro Display Filter" aria-label="CRT Retro Display Filter" aria-expanded="false" type="button">',
      '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '    <rect width="20" height="15" x="2" y="3" rx="2"/>',
      '    <line x1="8" x2="16" y1="21" y2="21"/>',
      '    <line x1="12" x2="12" y1="18" y2="21"/>',
      '  </svg>',
      '</button>',
      '<div class="modal-crt-popover" id="modal-crt-popover" role="dialog" aria-label="CRT Display Settings" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:rgba(18,22,34,0.95); border:1px solid rgba(0,245,255,0.3); border-radius:8px; padding:12px; min-width:200px; z-index:100; box-shadow:0 8px 24px rgba(0,0,0,0.6); backdrop-filter:blur(8px);">',
      '  <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted, #8b9bb4); margin-bottom:8px; font-weight:700;">CRT Display Mode</div>',
      '  <div style="display:flex; flex-direction:column; gap:6px;">',
      '    <button type="button" class="crt-preset-btn" data-preset="arcade" style="text-align:left; background:none; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">Arcade Standard (RGB)</button>',
      '    <button type="button" class="crt-preset-btn" data-preset="cyberpunk" style="text-align:left; background:none; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">Cyberpunk Neon CRT</button>',
      '    <button type="button" class="crt-preset-btn" data-preset="amber" style="text-align:left; background:none; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">Amber (VT220)</button>',
      '    <button type="button" class="crt-preset-btn" data-preset="gameboy" style="text-align:left; background:none; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">Game Boy DMG-01</button>',
      '    <button type="button" class="crt-preset-btn" data-preset="off" style="text-align:left; background:none; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">Off / Bypass</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    var closeBtn = controls.querySelector('#close-modal-btn');
    if (closeBtn) {
      controls.insertBefore(crtWrapper, closeBtn);
    } else {
      controls.appendChild(crtWrapper);
    }

    var toggleBtn = document.getElementById('modal-crt-btn');
    var popover = document.getElementById('modal-crt-popover');

    if (toggleBtn && popover) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = popover.style.display === 'block';
        popover.style.display = isOpen ? 'none' : 'block';
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });

      document.addEventListener('click', function (e) {
        if (!crtWrapper.contains(e.target)) {
          popover.style.display = 'none';
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    var presetBtns = crtWrapper.querySelectorAll('.crt-preset-btn');
    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var preset = btn.getAttribute('data-preset');
        setPreset(preset);
        if (popover) popover.style.display = 'none';
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });

    updateUIButtons();
  }

  function init() {
    loadSavedPreset();
    createToolbarControl();

    window.addEventListener('arcadeverse:game-launched', function () {
      mountOverlay();
    });

    window.addEventListener('arcadeverse:game-closed', function () {
      unmountOverlay();
    });

    window.addEventListener('arcadeverse:game-paused', function () {
      isThrottled = true;
      stop();
    });

    window.addEventListener('arcadeverse:game-resumed', function () {
      isThrottled = false;
      start();
    });
  }

  return {
    init: init,
    setPreset: setPreset,
    getPreset: function () { return currentPreset; },
    getPresets: function () { return PRESETS; }
  };
});
