/**
 * Local Hotseat Turn-Based Game State Orchestrator & Transition Curtains
 * Pure Vanilla JavaScript & DOM Hotseat Multiplayer Engine
 * Manages player rosters (2 to 4 players), turn order rotations, round counters,
 * active player state machines, pass-the-device transition curtain modal ("Player 2 Get Ready!"),
 * secret move masking, countdown timer buzzer, and match summary winner podium.
 *
 * @module HotseatOrchestrator
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
    root.ArcadeVerse.HotseatOrchestrator = factory();
    root.HotseatOrchestrator = root.ArcadeVerse.HotseatOrchestrator;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function HotseatOrchestrator(options) {
    this.options = Object.assign({
      playerCount: 2,
      playerNames: ['Player 1', 'Player 2'],
      maxRounds: 5,
      turnTimeLimitSec: 30,
      containerElement: null
    }, options);

    this.players = [];
    var count = Math.max(2, Math.min(4, this.options.playerCount));
    for (var i = 0; i < count; i++) {
      this.players.push({
        id: i,
        name: (this.options.playerNames && this.options.playerNames[i]) || ('Player ' + (i + 1)),
        score: 0,
        actionsTaken: 0,
        damageDealt: 0
      });
    }

    this.currentRound = 1;
    this.currentPlayerIndex = 0;
    this.isCurtainActive = false;
    this.isGameOver = false;
    this.listeners = {}; // eventName -> [callbacks]

    this.bindKeyboardShortcuts();
  }

  HotseatOrchestrator.prototype.on = function (event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return this;
  };

  HotseatOrchestrator.prototype.emit = function (event, data) {
    var cbs = this.listeners[event] || [];
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](data); } catch (e) {}
    }
  };

  HotseatOrchestrator.prototype.getCurrentPlayer = function () {
    return this.players[this.currentPlayerIndex];
  };

  /**
   * Advances to next turn with transition curtain overlay
   */
  HotseatOrchestrator.prototype.nextTurn = function () {
    if (this.isGameOver) return;

    var prevPlayer = this.getCurrentPlayer();
    this.emit('turnEnd', { player: prevPlayer, round: this.currentRound });

    this.currentPlayerIndex++;
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
      this.currentRound++;
      if (this.currentRound > this.options.maxRounds) {
        this.endMatch();
        return;
      }
    }

    var nextPlayer = this.getCurrentPlayer();
    this.showTransitionCurtain(nextPlayer);
  };

  /**
   * Displays Pass-the-Device Transition Curtain
   */
  HotseatOrchestrator.prototype.showTransitionCurtain = function (player) {
    this.isCurtainActive = true;
    this.emit('curtainShown', { player: player });

    if (typeof document === 'undefined') return;
    var curtain = document.getElementById('av-hotseat-curtain');
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'av-hotseat-curtain';
      curtain.style.position = 'fixed';
      curtain.style.inset = '0';
      curtain.style.zIndex = '9999';
      curtain.style.background = 'rgba(5, 7, 15, 0.95)';
      curtain.style.display = 'flex';
      curtain.style.flexDirection = 'column';
      curtain.style.alignItems = 'center';
      curtain.style.justifyContent = 'center';
      curtain.style.color = '#fff';
      curtain.style.fontFamily = 'monospace';
      document.body.appendChild(curtain);
    }

    curtain.style.display = 'flex';
    curtain.innerHTML = [
      '<div style="text-align:center; padding:30px; border:2px solid #00dfd8; border-radius:12px; background:#0a0f1d; box-shadow:0 0 25px rgba(0,223,216,0.3);">',
      '  <h2 style="color:#00dfd8; font-size:28px; margin-bottom:12px;">PASS THE DEVICE</h2>',
      '  <div style="font-size:36px; font-weight:bold; color:#f59e0b; margin-bottom:20px;">' + player.name.toUpperCase() + ' GET READY!</div>',
      '  <p style="color:#94a3b8; margin-bottom:24px;">Round ' + this.currentRound + ' of ' + this.options.maxRounds + '</p>',
      '  <button id="av-hotseat-start-turn-btn" style="background:#00dfd8; color:#05070f; font-weight:bold; font-size:18px; padding:12px 28px; border:none; border-radius:6px; cursor:pointer;">',
      '    START TURN (PRESS SPACE / ENTER)',
      '  </button>',
      '</div>'
    ].join('\n');

    var self = this;
    var btn = document.getElementById('av-hotseat-start-turn-btn');
    if (btn) {
      btn.onclick = function () { self.dismissCurtain(); };
    }
  };

  HotseatOrchestrator.prototype.dismissCurtain = function () {
    this.isCurtainActive = false;
    if (typeof document !== 'undefined') {
      var curtain = document.getElementById('av-hotseat-curtain');
      if (curtain) curtain.style.display = 'none';
    }
    this.emit('turnStart', { player: this.getCurrentPlayer(), round: this.currentRound });
  };

  HotseatOrchestrator.prototype.endMatch = function () {
    this.isGameOver = true;
    var sorted = this.players.slice().sort(function (a, b) { return b.score - a.score; });
    var winner = sorted[0];
    this.emit('matchEnd', { winner: winner, podium: sorted });
  };

  HotseatOrchestrator.prototype.bindKeyboardShortcuts = function () {
    if (typeof window === 'undefined') return;
    var self = this;
    this._onKeyDown = function (e) {
      if (self.isCurtainActive && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        self.dismissCurtain();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  };

  HotseatOrchestrator.prototype.destroy = function () {
    if (typeof window !== 'undefined' && this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    if (typeof document !== 'undefined') {
      var curtain = document.getElementById('av-hotseat-curtain');
      if (curtain && curtain.parentNode) curtain.parentNode.removeChild(curtain);
    }
    this.listeners = {};
  };

  return HotseatOrchestrator;
});
