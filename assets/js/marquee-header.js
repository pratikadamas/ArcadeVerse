/**
 * Retro Arcade Cabinet Marquee Header Banner with Dynamic Sound Waves (#1367)
 * Authentic physical arcade cabinet marquee component with illuminated back-lit acrylic textures,
 * perimeter rivet borders, chasing bulb neon marquee (sequential, alternating, sound-reactive pulse),
 * responsive container queries, and dynamic SVG audio waveform oscilloscope synthesizer.
 *
 * @module ArcadeMarqueeHeader
 * @version 1.0.0
 * ArcadeVerse Nexus Spring Of Code 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = root.ArcadeVerse || {};
    root.ArcadeVerse.ArcadeMarqueeHeader = factory();
    root.ArcadeMarqueeHeader = root.ArcadeVerse.ArcadeMarqueeHeader;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var BULB_COUNT = 32;
  var DEFAULT_MODE = 'sequential'; // 'sequential' | 'alternating' | 'pulse'

  var ArcadeMarqueeHeader = {
    container: null,
    frame: null,
    waveformSvg: null,
    audioStateText: null,
    audioContext: null,
    analyser: null,
    dataArray: null,
    animFrameId: null,
    wavePhase: 0,
    currentMode: DEFAULT_MODE,
    isTabActive: true,
    isReducedMotion: false,
    audioConnected: false,

    /**
     * Initializes the marquee header banner component
     * @param {Object} [options]
     * @param {HTMLElement|string} [options.target] Parent element or selector to prepend/insert into
     * @param {number} [options.bulbCount] Total bulbs along top/bottom tracks
     * @param {string} [options.mode] Initial chase mode
     */
    init: function (options) {
      options = options || {};
      var bulbCount = options.bulbCount || BULB_COUNT;
      this.currentMode = options.mode || DEFAULT_MODE;

      // Check motion preference
      if (typeof window !== 'undefined' && window.matchMedia) {
        var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.isReducedMotion = motionQuery.matches;
        var self = this;
        motionQuery.addEventListener('change', function (e) {
          self.isReducedMotion = e.matches;
          self.updateLifecycleState();
        });
      }

      // Check tab visibility
      if (typeof document !== 'undefined') {
        var selfVisibility = this;
        document.addEventListener('visibilitychange', function () {
          selfVisibility.isTabActive = !document.hidden;
          selfVisibility.updateLifecycleState();
        });
      }

      // Render DOM structure if not already rendered
      var target = options.target ? (typeof options.target === 'string' ? document.querySelector(options.target) : options.target) : null;
      if (!target && typeof document !== 'undefined') {
        target = document.querySelector('.hero-section') || document.querySelector('#main-content');
      }

      if (target && !document.getElementById('arcade-cabinet-marquee')) {
        this.render(target, bulbCount);
      } else if (document.getElementById('arcade-cabinet-marquee')) {
        this.container = document.getElementById('arcade-cabinet-marquee');
        this.frame = this.container.querySelector('.arcade-marquee-frame');
        this.bindEvents();
      }

      this.initAudioHook();
      this.startWaveformLoop();
      return this;
    },

    /**
     * Generates chasing bulb track HTML
     * @param {number} count Number of bulbs in the track
     * @param {string} extraClass Additional CSS class
     * @returns {string}
     */
    renderBulbTrack: function (count, extraClass) {
      var html = '<div class="arcade-marquee-chase-track ' + (extraClass || '') + '" role="presentation" aria-hidden="true">';
      for (var i = 0; i < count; i++) {
        html += '<span class="marquee-bulb" data-index="' + i + '"></span>';
      }
      html += '</div>';
      return html;
    },

    /**
     * Renders full Marquee Cabinet component HTML markup
     * @param {HTMLElement} target Parent container
     * @param {number} bulbCount Number of bulbs per track
     */
    render: function (target, bulbCount) {
      var wrapper = document.createElement('div');
      wrapper.id = 'arcade-cabinet-marquee';
      wrapper.className = 'arcade-marquee-wrapper';
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Arcade Cabinet Marquee Header');

      var bulbsTop = this.renderBulbTrack(bulbCount, 'top-track');
      var bulbsBottom = this.renderBulbTrack(bulbCount, 'bottom-track');

      wrapper.innerHTML =
        '<div class="arcade-marquee-frame" data-chase-mode="' + this.currentMode + '">' +
          '<div class="arcade-marquee-rivets" aria-hidden="true">' +
            '<span class="arcade-rivet arcade-rivet-tl"></span>' +
            '<span class="arcade-rivet arcade-rivet-tr"></span>' +
            '<span class="arcade-rivet arcade-rivet-bl"></span>' +
            '<span class="arcade-rivet arcade-rivet-br"></span>' +
            '<span class="arcade-rivet arcade-rivet-tc"></span>' +
            '<span class="arcade-rivet arcade-rivet-bc"></span>' +
          '</div>' +

          bulbsTop +

          '<div class="arcade-marquee-acrylic-plate">' +
            '<div class="arcade-marquee-backlight" aria-hidden="true"></div>' +

            '<div class="arcade-marquee-inner">' +
              '<div class="marquee-title-box">' +
                '<div class="marquee-badge">' +
                  '<span class="marquee-badge-dot" aria-hidden="true"></span>' +
                  '<span>INSERT COIN • 2026 RETRO EDITION</span>' +
                '</div>' +
                '<h2 class="marquee-glow-heading">' +
                  '<span>ARCADE</span><span class="sub-text">VERSE</span>' +
                '</h2>' +
                '<p class="marquee-tagline">High Voltage Interactive Retro Station • Pure Web Engineering</p>' +
              '</div>' +

              '<div class="marquee-hud-controls">' +
                '<div class="marquee-waveform-box" title="Dynamic Marquee Sound Waveform">' +
                  '<div class="waveform-meta">' +
                    '<span>AUDIO SYNTH</span>' +
                    '<span class="audio-state-text" id="marquee-audio-state">SYNTH LIVE</span>' +
                  '</div>' +
                  '<svg class="marquee-waveform-svg" viewBox="0 0 160 34" preserveAspectRatio="none" aria-hidden="true">' +
                    '<line x1="0" y1="17" x2="160" y2="17" class="wave-grid-line" />' +
                    '<path class="wave-path-sub" d="M0,17 L160,17" />' +
                    '<path class="wave-path-glow" d="M0,17 L160,17" />' +
                  '</svg>' +
                '</div>' +

                '<div class="marquee-buttons-row" role="group" aria-label="Marquee Animation Modes">' +
                  '<button type="button" class="marquee-mode-btn ' + (this.currentMode === 'sequential' ? 'active' : '') + '" data-mode="sequential" title="Sequential Chase Lights">' +
                    'CHASE' +
                  '</button>' +
                  '<button type="button" class="marquee-mode-btn ' + (this.currentMode === 'alternating' ? 'active' : '') + '" data-mode="alternating" title="Alternating Blink Lights">' +
                    'BLINK' +
                  '</button>' +
                  '<button type="button" class="marquee-mode-btn ' + (this.currentMode === 'pulse' ? 'active' : '') + '" data-mode="pulse" title="Sound-Reactive Pulse Lights">' +
                    'PULSE' +
                  '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="marquee-stats-strip">' +
              '<div class="marquee-stat-pill">SYSTEM: <strong>READY</strong></div>' +
              '<div class="marquee-stat-pill">CREDITS: <strong>99</strong></div>' +
              '<div class="marquee-stat-pill">STAGE: <strong>01 HUB</strong></div>' +
              '<div class="marquee-stat-pill">ENGINE: <strong>PURE CSS/SVG</strong></div>' +
            '</div>' +
          '</div>' +

          bulbsBottom +
        '</div>';

      if (target.firstChild) {
        target.insertBefore(wrapper, target.firstChild);
      } else {
        target.appendChild(wrapper);
      }

      this.container = wrapper;
      this.frame = wrapper.querySelector('.arcade-marquee-frame');
      this.waveformSvg = wrapper.querySelector('.marquee-waveform-svg');
      this.audioStateText = wrapper.querySelector('#marquee-audio-state');

      this.bindEvents();
    },

    /**
     * Binds mode buttons and interactive marquee listeners
     */
    bindEvents: function () {
      if (!this.container) return;
      var buttons = this.container.querySelectorAll('.marquee-mode-btn');
      var self = this;

      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mode = btn.getAttribute('data-mode');
          if (mode) {
            self.setChaseMode(mode);
          }
        });
      });
    },

    /**
     * Sets chase animation mode (sequential, alternating, pulse)
     * @param {string} mode
     */
    setChaseMode: function (mode) {
      if (!mode) return;
      this.currentMode = mode;
      if (this.frame) {
        this.frame.setAttribute('data-chase-mode', mode);
      }
      if (this.container) {
        var buttons = this.container.querySelectorAll('.marquee-mode-btn');
        buttons.forEach(function (btn) {
          if (btn.getAttribute('data-mode') === mode) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }
    },

    /**
     * Pauses or resumes lights based on tab visibility and motion preference
     */
    updateLifecycleState: function () {
      if (!this.frame) return;
      if (!this.isTabActive || this.isReducedMotion) {
        this.frame.classList.add('is-paused');
      } else {
        this.frame.classList.remove('is-paused');
      }
    },

    /**
     * Safe Web Audio Hook: connects to global SoundEngine if active or creates fallback synth wave
     */
    initAudioHook: function () {
      var self = this;
      try {
        if (typeof window !== 'undefined' && window.SoundEngine && typeof window.SoundEngine.getAudioContext === 'function') {
          var ctx = window.SoundEngine.getAudioContext();
          if (ctx) {
            self.attachAnalyser(ctx);
          }
        }
      } catch (_) {}

      // Listen for sound mode changes or unlock events
      if (typeof window !== 'undefined') {
        window.addEventListener('arcadeverse:sound-mode-changed', function (e) {
          try {
            if (window.SoundEngine && typeof window.SoundEngine.getAudioContext === 'function') {
              var ctx = window.SoundEngine.getAudioContext();
              if (ctx) self.attachAnalyser(ctx);
            }
          } catch (_) {}
        });
      }
    },

    /**
     * Attaches Web Audio analyser node to calculate realtime sound waves
     * @param {AudioContext} ctx
     */
    attachAnalyser: function (ctx) {
      if (!ctx || this.audioConnected) return;
      try {
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        this.analyser = analyser;
        this.dataArray = new Uint8Array(analyser.frequencyBinCount);
        this.audioConnected = true;
        if (this.audioStateText) {
          this.audioStateText.textContent = 'SPECTRUM LIVE';
          this.audioStateText.style.color = '#00f0ff';
        }
      } catch (_) {}
    },

    /**
     * Continuous dynamic sound wave animation loop (SVG Sine / Spectral synthesis)
     */
    startWaveformLoop: function () {
      var self = this;
      function loop() {
        if (self.isTabActive && !self.isReducedMotion) {
          self.renderWaveform();
        }
        self.animFrameId = requestAnimationFrame(loop);
      }
      this.animFrameId = requestAnimationFrame(loop);
    },

    /**
     * Computes SVG path data for dynamic retro sound waves
     */
    renderWaveform: function () {
      if (!this.waveformSvg) {
        if (this.container) {
          this.waveformSvg = this.container.querySelector('.marquee-waveform-svg');
        }
        if (!this.waveformSvg) return;
      }

      this.wavePhase += 0.08;
      var pointsGlow = [];
      var pointsSub = [];
      var width = 160;
      var height = 34;
      var midY = height / 2;
      var numPoints = 24;

      var energy = 0;
      if (this.analyser && this.dataArray) {
        try {
          this.analyser.getByteFrequencyData(this.dataArray);
          var sum = 0;
          for (var i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
          }
          energy = sum / (this.dataArray.length * 255);
        } catch (_) {
          energy = 0;
        }
      }

      // Base synthetic oscillation + reactive energy modulation
      var ampBase = 8 + (energy * 14);
      var freqBase = 0.25;

      for (var idx = 0; idx <= numPoints; idx++) {
        var x = (idx / numPoints) * width;
        var progress = idx / numPoints;
        // Edge dampening window so wave tapers nicely at left/right edges
        var windowFactor = Math.sin(progress * Math.PI);

        var y1 = midY + Math.sin(idx * freqBase + this.wavePhase) * ampBase * windowFactor;
        var y2 = midY + Math.cos(idx * (freqBase * 1.5) - this.wavePhase * 0.8) * (ampBase * 0.7) * windowFactor;

        pointsGlow.push((idx === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y1.toFixed(1));
        pointsSub.push((idx === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y2.toFixed(1));
      }

      var pathGlow = this.waveformSvg.querySelector('.wave-path-glow');
      var pathSub = this.waveformSvg.querySelector('.wave-path-sub');
      if (pathGlow) pathGlow.setAttribute('d', pointsGlow.join(' '));
      if (pathSub) pathSub.setAttribute('d', pointsSub.join(' '));

      // Update pulse variables on frame if pulse mode is active
      if (this.frame && this.currentMode === 'pulse') {
        var energyPercent = Math.min(100, Math.round((Math.sin(this.wavePhase) * 0.5 + 0.5 + energy) * 50));
        this.frame.style.setProperty('--marquee-audio-energy', (energyPercent * 0.15).toFixed(1) + 'px');
        this.frame.style.setProperty('--marquee-audio-intensity', (0.3 + energyPercent * 0.007).toFixed(2));
        this.frame.style.setProperty('--marquee-audio-peak', energyPercent.toString());
      }
    },

    /**
     * Destroys and cleans up listeners and loops
     */
    destroy: function () {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
  };

  // Auto-initialize when loaded on browser DOMContentLoaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        ArcadeMarqueeHeader.init();
      });
    } else {
      ArcadeMarqueeHeader.init();
    }
  }

  return ArcadeMarqueeHeader;
});
