/**
 * ArcadeVerse Split-Screen Game Comparison Matrix (Dual-Viewport Arena) (#1053)
 * Side-by-side or stacked dual-iframe testing arena for comparing game mechanics, difficulty, and stats.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeGameComparison = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var selectedGameIds = [];
  var modalEl = null;
  var barEl = null;

  function getGame(gameId) {
    var registry = (typeof window !== 'undefined' && window.GAMES_REGISTRY) || [];
    return registry.find(function (g) { return g.id === gameId; }) || null;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toggleCompareGame(gameId) {
    var idx = selectedGameIds.indexOf(gameId);
    if (idx >= 0) {
      selectedGameIds.splice(idx, 1);
    } else {
      if (selectedGameIds.length >= 2) {
        selectedGameIds.shift();
      }
      selectedGameIds.push(gameId);
    }
    updateFloatingBar();
    updateCardCheckboxes();
  }

  function updateCardCheckboxes() {
    var checkboxes = document.querySelectorAll('.compare-card-checkbox');
    checkboxes.forEach(function (cb) {
      var id = cb.getAttribute('data-game-id');
      cb.checked = selectedGameIds.indexOf(id) >= 0;
    });
  }

  function updateFloatingBar() {
    if (!barEl) return;
    if (selectedGameIds.length === 0) {
      barEl.style.display = 'none';
      return;
    }

    barEl.style.display = 'flex';
    var textEl = barEl.querySelector('.compare-bar-text');
    var btnEl = barEl.querySelector('.compare-bar-btn');

    if (textEl && btnEl) {
      if (selectedGameIds.length === 1) {
        var g1 = getGame(selectedGameIds[0]);
        textEl.textContent = 'Selected: ' + (g1 ? g1.title : '1 Game') + ' (Select 1 more to compare)';
        btnEl.disabled = true;
        btnEl.style.opacity = '0.5';
      } else {
        var g1Title = getGame(selectedGameIds[0]) ? getGame(selectedGameIds[0]).title : 'Game 1';
        var g2Title = getGame(selectedGameIds[1]) ? getGame(selectedGameIds[1]).title : 'Game 2';
        textEl.textContent = 'Compare: ' + g1Title + ' vs ' + g2Title;
        btnEl.disabled = false;
        btnEl.style.opacity = '1';
      }
    }
  }

  function renderFloatingBar() {
    if (document.getElementById('compare-floating-bar')) return;
    barEl = document.createElement('div');
    barEl.id = 'compare-floating-bar';
    barEl.className = 'compare-floating-bar';
    barEl.style.position = 'fixed';
    barEl.style.bottom = '24px';
    barEl.style.left = '50%';
    barEl.style.transform = 'translateX(-50%)';
    barEl.style.background = 'rgba(15, 23, 42, 0.95)';
    barEl.style.border = '1px solid var(--accent-primary, #00f5ff)';
    barEl.style.borderRadius = '30px';
    barEl.style.padding = '10px 20px';
    barEl.style.zIndex = '999';
    barEl.style.display = 'none';
    barEl.style.alignItems = 'center';
    barEl.style.gap = '16px';
    barEl.style.boxShadow = '0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(0,245,255,0.3)';
    barEl.style.backdropFilter = 'blur(10px)';

    barEl.innerHTML = [
      '<div class="compare-bar-text" style="font-size:0.9rem; color:#fff; font-weight:600;"></div>',
      '<div style="display:flex; gap:8px;">',
      '  <button type="button" class="compare-bar-btn" style="background:var(--accent-primary, #00f5ff); color:#000; border:none; border-radius:20px; padding:6px 16px; font-weight:700; cursor:pointer;">Launch Arena</button>',
      '  <button type="button" class="compare-bar-clear" style="background:rgba(255,255,255,0.1); color:#fff; border:none; border-radius:20px; padding:6px 12px; cursor:pointer;">Clear</button>',
      '</div>'
    ].join('\n');

    document.body.appendChild(barEl);

    barEl.querySelector('.compare-bar-btn').addEventListener('click', function () {
      if (selectedGameIds.length === 2) {
        launchComparisonArena(selectedGameIds[0], selectedGameIds[1]);
      }
    });

    barEl.querySelector('.compare-bar-clear').addEventListener('click', function () {
      selectedGameIds = [];
      updateFloatingBar();
      updateCardCheckboxes();
    });
  }

  function launchComparisonArena(id1, id2) {
    var game1 = getGame(id1);
    var game2 = getGame(id2);
    if (!game1 || !game2) return;

    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'compare-arena-modal';
      modalEl.className = 'compare-arena-modal';
      modalEl.style.position = 'fixed';
      modalEl.style.top = '0';
      modalEl.style.left = '0';
      modalEl.style.width = '100vw';
      modalEl.style.height = '100vh';
      modalEl.style.background = 'rgba(10, 15, 26, 0.98)';
      modalEl.style.zIndex = '10000';
      modalEl.style.display = 'flex';
      modalEl.style.flexDirection = 'column';
      modalEl.style.backdropFilter = 'blur(12px)';
      document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = [
      '<div class="compare-arena-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 24px; border-bottom:1px solid rgba(255,255,255,0.1);">',
      '  <div style="display:flex; align-items:center; gap:16px;">',
      '    <h2 style="font-size:1.1rem; color:var(--accent-primary, #00f5ff); margin:0;">Dual-Viewport Comparison Arena</h2>',
      '    <div style="font-size:0.8rem; color:#8b9bb4;">Press Ctrl+1 / Ctrl+2 to switch keyboard focus</div>',
      '  </div>',
      '  <div style="display:flex; gap:12px; align-items:center;">',
      '    <button type="button" id="compare-focus-1" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px 12px; border-radius:6px; cursor:pointer;">Focus Game 1</button>',
      '    <button type="button" id="compare-focus-2" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px 12px; border-radius:6px; cursor:pointer;">Focus Game 2</button>',
      '    <button type="button" id="compare-close-btn" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer; padding:0 8px;">&times;</button>',
      '  </div>',
      '</div>',
      '<div class="compare-viewports-container" style="flex:1; display:flex; flex-direction:row; gap:4px; padding:12px; min-height:0;">',
      '  <div class="compare-pane" id="compare-pane-1" style="flex:1; display:flex; flex-direction:column; background:#000; border-radius:8px; overflow:hidden; border:2px solid transparent;">',
      '    <div style="background:#1e293b; padding:8px 16px; display:flex; justify-content:space-between; align-items:center;">',
      '      <span style="font-weight:700; color:#fff;">' + escapeHTML(game1.title) + '</span>',
      '      <span style="font-size:0.75rem; color:#94a3b8;">by @' + escapeHTML(game1.author || game1.github) + '</span>',
      '    </div>',
      '    <iframe id="compare-iframe-1" src="' + escapeHTML(game1.path) + '" style="flex:1; width:100%; height:100%; border:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>',
      '  </div>',
      '  <div class="compare-pane" id="compare-pane-2" style="flex:1; display:flex; flex-direction:column; background:#000; border-radius:8px; overflow:hidden; border:2px solid transparent;">',
      '    <div style="background:#1e293b; padding:8px 16px; display:flex; justify-content:space-between; align-items:center;">',
      '      <span style="font-weight:700; color:#fff;">' + escapeHTML(game2.title) + '</span>',
      '      <span style="font-size:0.75rem; color:#94a3b8;">by @' + escapeHTML(game2.author || game2.github) + '</span>',
      '    </div>',
      '    <iframe id="compare-iframe-2" src="' + escapeHTML(game2.path) + '" style="flex:1; width:100%; height:100%; border:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>',
      '  </div>',
      '</div>',
      '<div class="compare-specs-drawer" style="padding:16px 24px; background:#0f172a; border-top:1px solid rgba(255,255,255,0.1); max-height:180px; overflow-y:auto;">',
      '  <table style="width:100%; font-size:0.85rem; border-collapse:collapse; color:#cbd5e1;">',
      '    <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left;">',
      '      <th style="padding:6px; width:20%;">Metric</th>',
      '      <th style="padding:6px; width:40%; color:var(--accent-primary, #00f5ff);">' + escapeHTML(game1.title) + '</th>',
      '      <th style="padding:6px; width:40%; color:var(--accent-primary, #00f5ff);">' + escapeHTML(game2.title) + '</th>',
      '    </tr></thead>',
      '    <tbody>',
      '      <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:6px; font-weight:600;">Category</td><td style="padding:6px;">' + escapeHTML(game1.category) + '</td><td style="padding:6px;">' + escapeHTML(game2.category) + '</td></tr>',
      '      <tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="padding:6px; font-weight:600;">Rating / Stars</td><td style="padding:6px;">' + (game1.stars ? (game1.stars / 10).toFixed(1) : '5.0') + ' Stars</td><td style="padding:6px;">' + (game2.stars ? (game2.stars / 10).toFixed(1) : '5.0') + ' Stars</td></tr>',
      '      <tr><td style="padding:6px; font-weight:600;">Tags</td><td style="padding:6px;">' + escapeHTML((game1.tags || []).join(', ')) + '</td><td style="padding:6px;">' + escapeHTML((game2.tags || []).join(', ')) + '</td></tr>',
      '    </tbody>',
      '  </table>',
      '</div>'
    ].join('\n');

    modalEl.style.display = 'flex';

    var frame1 = document.getElementById('compare-iframe-1');
    var frame2 = document.getElementById('compare-iframe-2');
    var pane1 = document.getElementById('compare-pane-1');
    var pane2 = document.getElementById('compare-pane-2');

    function focusPane(num) {
      if (num === 1 && frame1 && pane1) {
        pane1.style.borderColor = 'var(--accent-primary, #00f5ff)';
        if (pane2) pane2.style.borderColor = 'transparent';
        try { frame1.contentWindow.focus(); } catch (_) {}
      } else if (num === 2 && frame2 && pane2) {
        pane2.style.borderColor = 'var(--accent-primary, #00f5ff)';
        if (pane1) pane1.style.borderColor = 'transparent';
        try { frame2.contentWindow.focus(); } catch (_) {}
      }
    }

    document.getElementById('compare-focus-1').addEventListener('click', function () { focusPane(1); });
    document.getElementById('compare-focus-2').addEventListener('click', function () { focusPane(2); });

    document.getElementById('compare-close-btn').addEventListener('click', function () {
      modalEl.style.display = 'none';
      if (frame1) frame1.src = 'about:blank';
      if (frame2) frame2.src = 'about:blank';
    });

    window.addEventListener('keydown', function (e) {
      if (modalEl && modalEl.style.display === 'flex') {
        if (e.ctrlKey && e.key === '1') {
          e.preventDefault();
          focusPane(1);
        } else if (e.ctrlKey && e.key === '2') {
          e.preventDefault();
          focusPane(2);
        } else if (e.key === 'Escape') {
          modalEl.style.display = 'none';
          if (frame1) frame1.src = 'about:blank';
          if (frame2) frame2.src = 'about:blank';
        }
      }
    });

    focusPane(1);
  }

  function init() {
    renderFloatingBar();
    document.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('compare-card-checkbox')) {
        var gameId = e.target.getAttribute('data-game-id');
        if (gameId) {
          toggleCompareGame(gameId);
        }
      }
    });
  }

  return {
    init: init,
    toggleCompareGame: toggleCompareGame,
    launchComparisonArena: launchComparisonArena,
    getSelectedGameIds: function () { return selectedGameIds; }
  };
});
