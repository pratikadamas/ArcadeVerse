/**
 * Web Audio Dynamic Pitch-Shifting Doppler Effect Acoustic Engine
 * Pure Web Audio API & Physics Doppler Simulation
 * Implements the physical Doppler equation calculating apparent frequency based on relative
 * velocity vectors between sound emitters and the player listener, coupled with PannerNode
 * stereo panning and air absorption distance attenuation (BiquadFilterNode lowpass).
 *
 * Doppler Equation:
 * f_observed = f_source * ((c + v_listener) / (c - v_source_radial))
 * where c is the speed of sound (~343 m/s).
 *
 * @module DopplerAudio
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
    root.ArcadeVerse.DopplerAudio = factory();
    root.DopplerAudio = root.ArcadeVerse.DopplerAudio;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var SPEED_OF_SOUND = 343.0; // m/s in air

  function DopplerAudio(audioContext, options) {
    this.ctx = audioContext || null;
    this.options = Object.assign({
      speedOfSound: SPEED_OF_SOUND,
      maxDistance: 1000,
      refDistance: 50,
      rolloffFactor: 1.0
    }, options);

    this.activeEmitters = [];
  }

  /**
   * Calculates apparent pitch ratio based on classical Doppler effect
   */
  DopplerAudio.prototype.calculateDopplerShift = function (sourcePos, sourceVel, listenerPos, listenerVel) {
    listenerVel = listenerVel || { vx: 0, vy: 0 };
    var c = this.options.speedOfSound;

    // Vector from source to listener
    var dx = listenerPos.x - sourcePos.x;
    var dy = listenerPos.y - sourcePos.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    // Unit direction from source to listener
    var ux = dx / dist;
    var uy = dy / dist;

    // Radial velocity of source towards listener
    var vSourceRadial = sourceVel.vx * ux + sourceVel.vy * uy;
    // Radial velocity of listener away from source
    var vListenerRadial = listenerVel.vx * ux + listenerVel.vy * uy;

    // Prevent singularity at or exceeding Mach 1
    var denom = Math.max(10, c - vSourceRadial);
    var numer = Math.max(10, c + vListenerRadial);

    var pitchRatio = numer / denom;
    // Normalized pan [-1.0 (left), 1.0 (right)]
    var pan = Math.max(-1.0, Math.min(1.0, -dx / this.options.refDistance));

    return {
      pitchRatio: Math.max(0.2, Math.min(4.0, pitchRatio)),
      distance: dist,
      pan: pan
    };
  };

  /**
   * Emits Doppler-shifted sound instance in Web Audio graph
   */
  DopplerAudio.prototype.emitSound = function (baseFreq, sourcePos, sourceVel, listenerPos) {
    if (!this.ctx) return null;
    try {
      var shift = this.calculateDopplerShift(sourcePos, sourceVel, listenerPos);
      var now = this.ctx.currentTime;

      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      var filter = this.ctx.createBiquadFilter();

      // Set Doppler-shifted pitch
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq * shift.pitchRatio, now);

      // Air absorption lowpass filter (high frequencies roll off with distance)
      filter.type = 'lowpass';
      var cutoff = Math.max(800, 16000 - (shift.distance * 12));
      filter.frequency.setValueAtTime(cutoff, now);

      // Distance attenuation volume
      var vol = Math.max(0.01, 1.0 / (1.0 + (shift.distance / this.options.refDistance)));
      gain.gain.setValueAtTime(vol * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      // Stereo panning
      var panner = null;
      if (this.ctx.createStereoPanner) {
        panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(shift.pan, now);
      }

      osc.connect(filter);
      filter.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.ctx.destination);
      } else {
        gain.connect(this.ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 0.36);
      return osc;
    } catch (e) {}
    return null;
  };

  return DopplerAudio;
});
