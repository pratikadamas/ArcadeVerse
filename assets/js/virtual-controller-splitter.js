/**
 * ArcadeVerse Local 2-Player Virtual Controller Splitter for Shared Keyboard Games (#1059)
 * Maps two non-overlapping keyboard zones into two virtualized standard Gamepad controllers,
 * broadcasting high-frequency postMessage payloads into the active game iframe.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVirtualControllerSplitter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var isEnabled = false;
  var hudEl = null;

  var P1_KEYS = {
    'KeyW': 'up',
    'KeyS': 'down',
    'KeyA': 'left',
    'KeyD': 'right',
    'KeyF': 'btnA',
    'KeyG': 'btnB',
    'KeyR': 'start'
  };

  var P2_KEYS = {
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'KeyK': 'btnA',
    'KeyL': 'btnB',
    'Enter': 'start'
  };

  var p1State = { up: false, down: false, left: false, right: false, btnA: false, btnB: false, start: false };
  var p2State = { up: false, down: false, left: false, right: false, btnA: false, btnB: false, start: false };

  function broadcastState() {
    var iframe = document.getElementById('game-iframe');
    if (!iframe || !iframe.contentWindow) return;

    var payload = {
      type: 'ARCADEVERSE_VIRTUAL_GAMEPAD_INPUT',
      player1: {
        axes: [
          (p1State.right ? 1 : 0) - (p1State.left ? 1 : 0),
          (p1State.down ? 1 : 0) - (p1State.up ? 1 : 0)
        ],
        buttons: [p1State.btnA, p1State.btnB, false, false, false, false, false, false, false, p1State.start]
      },
      player2: {
        axes: [
          (p2State.right ? 1 : 0) - (p2State.left ? 1 : 0),
          (p2State.down ? 1 : 0) - (p2State.up ? 1 : 0)
        ],
        buttons: [p2State.btnA, p2State.btnB, false, false, false, false, false, false, false, p2State.start]
      }
    };

    try {
      iframe.contentWindow.postMessage(payload, '*');
    } catch (_) {}

    updateHudVisuals();
  }

  function handleKeyEvent(e, isDown) {
    if (!isEnabled) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;

    var code = e.code;
    var changed = false;

    if (P1_KEYS[code]) {
      var act1 = P1_KEYS[code];
      if (p1State[act1] !== isDown) {
        p1State[act1] = isDown;
        changed = true;
      }
    } else if (P2_KEYS[code]) {
      var act2 = P2_KEYS[code];
      if (p2State[act2] !== isDown) {
        p2State[act2] = isDown;
        changed = true;
      }
    }

    if (changed) {
      broadcastState();
    }
  }

  function renderHud() {
    if (document.getElementById('virtual-splitter-hud')) return;

    hudEl = document.createElement('div');
    hudEl.id = 'virtual-splitter-hud';
    hudEl.className = 'virtual-splitter-hud';
    hudEl.style.position = 'absolute';
    hudEl.style.bottom = '12px';
    hudEl.style.left = '50%';
    hudEl.style.transform = 'translateX(-50%)';
    hudEl.style.background = 'rgba(15, 23, 42, 0.9)';
    hudEl.style.border = '1px solid rgba(0, 245, 255, 0.3)';
    hudEl.style.borderRadius = '24px';
    hudEl.style.padding = '6px 20px';
    hudEl.style.display = 'none';
    hudEl.style.gap = '32px';
    hudEl.style.alignItems = 'center';
    hudEl.style.zIndex = '10';
    hudEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.8)';
    hudEl.style.backdropFilter = 'blur(8px)';
    hudEl.style.pointerEvents = 'none';

    hudEl.innerHTML = [
      '<div style="display:flex; align-items:center; gap:8px;">',
      '  <span style="font-size:0.75rem; font-weight:700; color:var(--accent-primary, #00f5ff);">P1: WASD+F/G</span>',
      '  <div id="p1-hud-indicator" style="display:flex; gap:3px;">',
      '    <span class="hud-key" data-p1="up" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">W</span>',
      '    <span class="hud-key" data-p1="left" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">A</span>',
      '    <span class="hud-key" data-p1="down" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">S</span>',
      '    <span class="hud-key" data-p1="right" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">D</span>',
      '    <span class="hud-key" data-p1="btnA" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">F</span>',
      '    <span class="hud-key" data-p1="btnB" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">G</span>',
      '  </div>',
      '</div>',
      '<div style="height:16px; width:1px; background:rgba(255,255,255,0.2);"></div>',
      '<div style="display:flex; align-items:center; gap:8px;">',
      '  <span style="font-size:0.75rem; font-weight:700; color:#ff0055;">P2: Arrows+K/L</span>',
      '  <div id="p2-hud-indicator" style="display:flex; gap:3px;">',
      '    <span class="hud-key" data-p2="up" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">^</span>',
      '    <span class="hud-key" data-p2="left" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">&lt;</span>',
      '    <span class="hud-key" data-p2="down" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">v</span>',
      '    <span class="hud-key" data-p2="right" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">&gt;</span>',
      '    <span class="hud-key" data-p2="btnA" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">K</span>',
      '    <span class="hud-key" data-p2="btnB" style="font-size:0.65rem; background:#334155; color:#fff; padding:2px 5px; border-radius:3px;">L</span>',
      '  </div>',
      '</div>'
    ].join('\n');

    var wrapper = document.querySelector('.modal-frame-wrapper');
    if (wrapper) {
      wrapper.appendChild(hudEl);
    }
  }

  function updateHudVisuals() {
    if (!hudEl || hudEl.style.display === 'none') return;

    Object.keys(p1State).forEach(function (act) {
      var el = hudEl.querySelector('[data-p1="' + act + '"]');
      if (el) {
        el.style.background = p1State[act] ? 'var(--accent-primary, #00f5ff)' : '#334155';
        el.style.color = p1State[act] ? '#000' : '#fff';
      }
    });

    Object.keys(p2State).forEach(function (act) {
      var el = hudEl.querySelector('[data-p2="' + act + '"]');
      if (el) {
        el.style.background = p2State[act] ? '#ff0055' : '#334155';
        el.style.color = p2State[act] ? '#000' : '#fff';
      }
    });
  }

  function toggleSplitter() {
    isEnabled = !isEnabled;
    if (hudEl) {
      hudEl.style.display = isEnabled ? 'flex' : 'none';
    }
    var btn = document.getElementById('modal-splitter-btn');
    if (btn) {
      btn.classList.toggle('active', isEnabled);
      btn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    }
  }

  function addToolbarControl() {
    var controls = document.querySelector('.modal-controls');
    if (!controls || document.getElementById('modal-splitter-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-icon';
    btn.id = 'modal-splitter-btn';
    btn.title = '2-Player Keyboard Controller Splitter';
    btn.setAttribute('aria-label', '2-Player Keyboard Controller Splitter');
    btn.innerHTML = [
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '  <rect width="20" height="12" x="2" y="6" rx="6"/>',
      '  <line x1="6" x2="10" y1="12" y2="12"/>',
      '  <line x1="8" x2="8" y1="10" y2="14"/>',
      '  <line x1="15" x2="15.01" y1="11" y2="11"/>',
      '  <line x1="18" x2="18.01" y1="13" y2="13"/>',
      '</svg>'
    ].join('');

    var closeBtn = controls.querySelector('#close-modal-btn');
    if (closeBtn) {
      controls.insertBefore(btn, closeBtn);
    } else {
      controls.appendChild(btn);
    }

    btn.addEventListener('click', function () {
      toggleSplitter();
    });
  }

  function init() {
    renderHud();
    addToolbarControl();

    window.addEventListener('keydown', function (e) {
      handleKeyEvent(e, true);
    });

    window.addEventListener('keyup', function (e) {
      handleKeyEvent(e, false);
    });

    window.addEventListener('arcadeverse:game-closed', function () {
      if (isEnabled) {
        toggleSplitter();
      }
    });
  }

  return {
    init: init,
    toggleSplitter: toggleSplitter,
    isEnabled: function () { return isEnabled; }
  };
});
