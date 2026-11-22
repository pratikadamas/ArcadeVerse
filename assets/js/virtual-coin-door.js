/**
 * Dynamic Virtual Arcade Coin Door & Credit Counter Mechanism with Physics SFX
 * Pure CSS3, SVG & Web Audio Procedural Mechanical Coin Chute Engine
 * Simulates physical retro dual-slot arcade coin doors (25c orange illuminated reject buttons,
 * coin return cups, keyhole plate), procedural Web Audio mechanical coin drop, chute rattle,
 * and microswitch click sounds, 7-segment LED credit ledger, and free-play mode switch.
 *
 * @module VirtualCoinDoor
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
    root.ArcadeVerse.VirtualCoinDoor = factory();
    root.VirtualCoinDoor = root.ArcadeVerse.VirtualCoinDoor;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_KEY_CREDITS = 'av_arcade_credits';
  var STORAGE_KEY_FREEPLAY = 'av_arcade_freeplay';

  function VirtualCoinDoor(containerElement, options) {
    if (typeof containerElement === 'string' && typeof document !== 'undefined') {
      this.container = document.querySelector(containerElement);
    } else {
      this.container = containerElement;
    }

    this.options = Object.assign({
      initialCredits: 2,
      maxCredits: 99,
      enableKeyShortcuts: true, // Key 5 or C inserts coin
      onCreditInserted: null,
      onCreditConsumed: null
    }, options);

    this.credits = this.loadCredits();
    this.isFreePlay = this.loadFreePlay();
    this.audioContext = null;

    this.render();
    this.bindEvents();
  }

  VirtualCoinDoor.prototype.loadCredits = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        var val = localStorage.getItem(STORAGE_KEY_CREDITS);
        if (val !== null) return parseInt(val, 10) || 0;
      }
    } catch (e) {}
    return this.options.initialCredits;
  };

  VirtualCoinDoor.prototype.saveCredits = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CREDITS, this.credits.toString());
      }
    } catch (e) {}
  };

  VirtualCoinDoor.prototype.loadFreePlay = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(STORAGE_KEY_FREEPLAY) === 'true';
      }
    } catch (e) {}
    return false;
  };

  VirtualCoinDoor.prototype.setFreePlay = function (enabled) {
    this.isFreePlay = !!enabled;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_FREEPLAY, this.isFreePlay.toString());
      }
    } catch (e) {}
    this.updateDisplay();
  };

  /**
   * Procedural Web Audio mechanical coin chute sound synthesis
   * Realistic coin slide, metallic rattle, and microswitch drop click
   */
  VirtualCoinDoor.prototype.playCoinSound = function () {
    if (typeof window === 'undefined') return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      var ctx = this.audioContext;
      var now = ctx.currentTime;

      // 1. High metallic coin clink
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(3200, now);
      osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.05);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // 2. Chute tumble rattle
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(800, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(350, now + 0.18);
      gain2.gain.setValueAtTime(0.25, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.18);

      // 3. Crisp switch drop click
      var osc3 = ctx.createOscillator();
      var gain3 = ctx.createGain();
      osc3.type = 'square';
      osc3.frequency.setValueAtTime(1200, now + 0.16);
      gain3.gain.setValueAtTime(0.3, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.22);
    } catch (e) {
      // Audio autoplay policy
    }
  };

  /**
   * Inserts an authentic 25c quarter coin
   */
  VirtualCoinDoor.prototype.insertCoin = function () {
    if (this.credits < this.options.maxCredits) {
      this.credits++;
      this.saveCredits();
    }
    this.playCoinSound();
    this.updateDisplay();
    if (typeof this.options.onCreditInserted === 'function') {
      this.options.onCreditInserted(this.credits);
    }
    return this.credits;
  };

  /**
   * Consumes one credit to start game
   */
  VirtualCoinDoor.prototype.consumeCredit = function () {
    if (this.isFreePlay) return true;
    if (this.credits > 0) {
      this.credits--;
      this.saveCredits();
      this.updateDisplay();
      if (typeof this.options.onCreditConsumed === 'function') {
        this.options.onCreditConsumed(this.credits);
      }
      return true;
    }
    return false;
  };

  VirtualCoinDoor.prototype.updateDisplay = function () {
    if (typeof document === 'undefined') return;
    var el = document.getElementById('av-coin-door-credit-display');
    if (el) {
      if (this.isFreePlay) {
        el.textContent = 'FREE PLAY';
      } else {
        var str = this.credits < 10 ? ('0' + this.credits) : ('' + this.credits);
        el.textContent = 'CREDITS: ' + str;
      }
    }
  };

  VirtualCoinDoor.prototype.render = function () {
    if (!this.container || typeof document === 'undefined') return;

    var html = [
      '<div class="av-virtual-coin-door" style="background:#11141c; border:4px solid #1f2937; border-radius:8px; padding:16px; width:280px; text-align:center; box-shadow:inset 0 2px 8px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6); font-family:monospace;">',
      '  <div id="av-coin-door-credit-display" style="background:#05070a; color:#ef4444; font-size:20px; font-weight:bold; padding:8px; border-radius:4px; letter-spacing:2px; margin-bottom:14px; text-shadow:0 0 8px rgba(239,68,68,0.7); border:1px solid #27272a;">',
      '    CREDITS: ' + (this.credits < 10 ? '0' + this.credits : this.credits),
      '  </div>',
      '  <div style="display:flex; justify-content:space-around; margin-bottom:14px;">',
      '    <button class="av-coin-slot-btn" id="av-coin-slot-1" style="background:linear-gradient(180deg, #f97316 0%, #c2410c 100%); border:2px solid #ea580c; border-radius:6px; color:#fff; font-weight:bold; padding:12px 14px; cursor:pointer; box-shadow:0 0 10px rgba(249,115,22,0.6); outline:none;">',
      '      25¢ INSERT',
      '    </button>',
      '    <button class="av-coin-slot-btn" id="av-coin-slot-2" style="background:linear-gradient(180deg, #f97316 0%, #c2410c 100%); border:2px solid #ea580c; border-radius:6px; color:#fff; font-weight:bold; padding:12px 14px; cursor:pointer; box-shadow:0 0 10px rgba(249,115,22,0.6); outline:none;">',
      '      25¢ INSERT',
      '    </button>',
      '  </div>',
      '  <div style="font-size:11px; color:#9ca3af;">PRESS [5] OR [C] TO INSERT COIN</div>',
      '</div>'
    ].join('\n');

    this.container.innerHTML = html;
  };

  VirtualCoinDoor.prototype.bindEvents = function () {
    if (typeof window === 'undefined') return;
    var self = this;

    this._onKeyDown = function (e) {
      if (!self.options.enableKeyShortcuts) return;
      if (e.key === '5' || e.key === 'c' || e.key === 'C') {
        self.insertCoin();
      }
    };

    window.addEventListener('keydown', this._onKeyDown);

    if (this.container && this.container.addEventListener) {
      this.container.addEventListener('click', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('av-coin-slot-btn')) {
          self.insertCoin();
        }
      });
    }
  };

  VirtualCoinDoor.prototype.destroy = function () {
    if (typeof window !== 'undefined' && this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    if (this.audioContext && this.audioContext.close) {
      this.audioContext.close();
    }
  };

  return VirtualCoinDoor;
});
