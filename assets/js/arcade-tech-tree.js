/**
 * ArcadeVerse Interactive Game Ecosystem & Architecture Tech-Tree Visualizer (#1061)
 * Pure Vanilla SVG force-directed constellation graph mapping 120+ games and shared mechanics,
 * featuring interactive dragging, panning, smooth zoom, keyword search filtering, and direct game launch.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeTechTree = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var modalEl = null;
  var svgEl = null;
  var nodes = [];
  var links = [];
  var isSimulating = true;
  var animFrameId = null;
  var transform = { x: 0, y: 0, scale: 1 };
  var isPanning = false;
  var panStart = { x: 0, y: 0 };
  var draggedNode = null;

  var CATEGORY_COLORS = {
    'action': '#ff0055',
    'arcade': '#00f5ff',
    'puzzle': '#ffff00',
    'racing': '#00ff66',
    'retro': '#ff7700',
    'sports': '#38bdf8',
    'strategy': '#a855f7',
    'card': '#f43f5e',
    'adventure': '#ec4899',
    'default': '#94a3b8'
  };

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

  function getCategoryColor(cat) {
    if (!cat) return CATEGORY_COLORS.default;
    var primary = cat.split('/')[0].trim().toLowerCase();
    return CATEGORY_COLORS[primary] || CATEGORY_COLORS.default;
  }

  function buildGraphData() {
    var registry = (typeof window !== 'undefined' && window.GAMES_REGISTRY) || [];
    nodes = [];
    links = [];

    var clusterMap = {};

    registry.forEach(function (g, i) {
      var angle = (i / registry.length) * Math.PI * 2;
      var radius = 250 + (i % 5) * 60;
      var node = {
        id: g.id,
        title: g.title,
        category: g.category || 'Arcade',
        author: g.author || g.github || 'Community',
        stars: g.stars || 25,
        tags: Array.isArray(g.tags) ? g.tags : [],
        game: g,
        x: Math.cos(angle) * radius + 400,
        y: Math.sin(angle) * radius + 300,
        vx: 0,
        vy: 0,
        radius: 8 + Math.min(6, (g.stars || 25) / 10),
        color: getCategoryColor(g.category)
      };
      nodes.push(node);

      var catKey = node.category.split('/')[0].trim().toLowerCase();
      if (!clusterMap[catKey]) clusterMap[catKey] = [];
      clusterMap[catKey].push(node);
    });

    Object.keys(clusterMap).forEach(function (cat) {
      var list = clusterMap[cat];
      for (var j = 0; j < list.length - 1; j++) {
        links.push({
          source: list[j],
          target: list[j + 1],
          length: 50,
          color: list[j].color
        });
      }
    });
  }

  function tickSimulation() {
    if (!isSimulating || isReducedMotion()) return;

    var repulsion = 300;
    for (var i = 0; i < nodes.length; i++) {
      var n1 = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var n2 = nodes[j];
        var dx = n2.x - n1.x;
        var dy = n2.y - n1.y;
        var distSq = dx * dx + dy * dy;
        if (distSq > 0 && distSq < 40000) {
          var dist = Math.sqrt(distSq);
          var force = repulsion / distSq;
          var fx = (dx / dist) * force;
          var fy = (dy / dist) * force;
          if (n1 !== draggedNode) { n1.vx -= fx; n1.vy -= fy; }
          if (n2 !== draggedNode) { n2.vx += fx; n2.vy += fy; }
        }
      }
    }

    for (var k = 0; k < links.length; k++) {
      var l = links[k];
      var ldx = l.target.x - l.source.x;
      var ldy = l.target.y - l.source.y;
      var ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
      var lforce = (ldist - l.length) * 0.02;
      var lfx = (ldx / ldist) * lforce;
      var lfy = (ldy / ldist) * lforce;
      if (l.source !== draggedNode) { l.source.vx += lfx; l.source.vy += lfy; }
      if (l.target !== draggedNode) { l.target.vx -= lfx; l.target.vy -= lfy; }
    }

    var damping = 0.88;
    for (var m = 0; m < nodes.length; m++) {
      var n = nodes[m];
      if (n !== draggedNode) {
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= damping;
        n.vy *= damping;
      }
    }

    renderSVG();
    animFrameId = requestAnimationFrame(tickSimulation);
  }

  function renderSVG() {
    if (!svgEl) return;

    var linksHtml = links.map(function (l) {
      return '<line x1="' + l.source.x.toFixed(1) + '" y1="' + l.source.y.toFixed(1) + '" x2="' + l.target.x.toFixed(1) + '" y2="' + l.target.y.toFixed(1) + '" stroke="' + l.color + '" stroke-opacity="0.25" stroke-width="1.5" />';
    }).join('');

    var nodesHtml = nodes.map(function (n) {
      return '<g class="tech-node" data-id="' + n.id + '" transform="translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')" style="cursor:pointer;">' +
        '<circle r="' + (n.radius + 4) + '" fill="' + n.color + '" fill-opacity="0.15" />' +
        '<circle r="' + n.radius + '" fill="' + n.color + '" stroke="#fff" stroke-width="1" />' +
        '<text y="' + (n.radius + 12) + '" text-anchor="middle" fill="#e2e8f0" font-size="9" font-family="monospace" pointer-events="none">' + n.title.slice(0, 14) + '</text>' +
        '</g>';
    }).join('');

    var content = document.getElementById('tech-tree-svg-content');
    if (content) {
      content.innerHTML = linksHtml + nodesHtml;
      content.setAttribute('transform', 'translate(' + transform.x + ',' + transform.y + ') scale(' + transform.scale + ')');
    }
  }

  function filterNodes(query) {
    var trimmed = (query || '').toLowerCase().trim();
    var nodeEls = document.querySelectorAll('.tech-node');
    nodeEls.forEach(function (el) {
      var id = el.getAttribute('data-id');
      var node = nodes.find(function (n) { return n.id === id; });
      if (!node) return;
      var match = !trimmed ||
        node.title.toLowerCase().includes(trimmed) ||
        node.category.toLowerCase().includes(trimmed) ||
        node.tags.some(function (t) { return t.toLowerCase().includes(trimmed); });
      el.style.opacity = match ? '1.0' : '0.15';
    });
  }

  function showNodePopover(node, clientX, clientY) {
    var popover = document.getElementById('tech-tree-popover');
    if (!popover) return;

    popover.innerHTML = [
      '<div style="font-size:0.75rem; text-transform:uppercase; color:' + node.color + '; font-weight:700;">' + node.category + '</div>',
      '<div style="font-size:0.95rem; font-weight:700; color:#fff; margin:4px 0;">' + node.title + '</div>',
      '<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px;">by @' + node.author + ' • ' + (node.stars / 10).toFixed(1) + ' Stars</div>',
      '<button type="button" id="popover-launch-btn" style="width:100%; background:var(--accent-primary, #00f5ff); color:#000; font-weight:700; border:none; border-radius:4px; padding:6px; font-size:0.8rem; cursor:pointer;">Launch Game</button>'
    ].join('');

    popover.style.display = 'block';
    popover.style.left = Math.min(window.innerWidth - 220, clientX + 12) + 'px';
    popover.style.top = Math.min(window.innerHeight - 140, clientY + 12) + 'px';

    document.getElementById('popover-launch-btn').addEventListener('click', function () {
      if (typeof window.openGameModal === 'function') {
        window.openGameModal(node.game);
      }
      modalEl.style.display = 'none';
      popover.style.display = 'none';
    });
  }

  function renderModal() {
    if (document.getElementById('tech-tree-modal')) return;

    modalEl = document.createElement('div');
    modalEl.id = 'tech-tree-modal';
    modalEl.className = 'tech-tree-modal';
    modalEl.style.position = 'fixed';
    modalEl.style.top = '0';
    modalEl.style.left = '0';
    modalEl.style.width = '100vw';
    modalEl.style.height = '100vh';
    modalEl.style.background = 'rgba(10, 15, 26, 0.98)';
    modalEl.style.zIndex = '10000';
    modalEl.style.display = 'none';
    modalEl.style.flexDirection = 'column';
    modalEl.style.backdropFilter = 'blur(10px)';

    modalEl.innerHTML = [
      '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 24px; border-bottom:1px solid rgba(255,255,255,0.1); background:#0f172a;">',
      '  <div style="display:flex; align-items:center; gap:16px;">',
      '    <h2 style="font-size:1.15rem; color:var(--accent-primary, #00f5ff); margin:0;">Arcade Ecosystem Tech-Tree Visualizer</h2>',
      '    <input type="text" id="tech-tree-search" placeholder="Filter mechanics, titles, tags..." style="background:#1e293b; border:1px solid rgba(255,255,255,0.2); border-radius:16px; padding:4px 12px; color:#fff; font-size:0.8rem; width:220px;" />',
      '  </div>',
      '  <div style="display:flex; gap:12px; align-items:center;">',
      '    <span style="font-size:0.75rem; color:#64748b;">Drag to Pan • Wheel to Zoom • Click Node to Launch</span>',
      '    <button type="button" id="tech-tree-close-btn" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">&times;</button>',
      '  </div>',
      '</div>',
      '<div style="flex:1; position:relative; overflow:hidden;">',
      '  <svg id="tech-tree-svg" style="width:100%; height:100%; cursor:grab; background:#070b14;">',
      '    <g id="tech-tree-svg-content"></g>',
      '  </svg>',
      '  <div id="tech-tree-popover" style="position:absolute; display:none; background:#1e293b; border:1px solid rgba(0,245,255,0.4); border-radius:8px; padding:10px 14px; width:180px; box-shadow:0 8px 24px rgba(0,0,0,0.8); z-index:20;"></div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(modalEl);

    svgEl = document.getElementById('tech-tree-svg');

    document.getElementById('tech-tree-close-btn').addEventListener('click', function () {
      modalEl.style.display = 'none';
      if (animFrameId) cancelAnimationFrame(animFrameId);
    });

    document.getElementById('tech-tree-search').addEventListener('input', function (e) {
      filterNodes(e.target.value);
    });

    // Panning & Zooming
    svgEl.addEventListener('pointerdown', function (e) {
      var targetNode = e.target.closest('.tech-node');
      if (targetNode) {
        var id = targetNode.getAttribute('data-id');
        draggedNode = nodes.find(function (n) { return n.id === id; });
        if (draggedNode) {
          showNodePopover(draggedNode, e.clientX, e.clientY);
        }
        return;
      }

      isPanning = true;
      panStart.x = e.clientX - transform.x;
      panStart.y = e.clientY - transform.y;
      svgEl.style.cursor = 'grabbing';
      document.getElementById('tech-tree-popover').style.display = 'none';
    });

    window.addEventListener('pointermove', function (e) {
      if (draggedNode) {
        draggedNode.x = (e.clientX - transform.x) / transform.scale;
        draggedNode.y = (e.clientY - transform.y) / transform.scale;
        renderSVG();
      } else if (isPanning) {
        transform.x = e.clientX - panStart.x;
        transform.y = e.clientY - panStart.y;
        renderSVG();
      }
    });

    window.addEventListener('pointerup', function () {
      isPanning = false;
      draggedNode = null;
      if (svgEl) svgEl.style.cursor = 'grab';
    });

    svgEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      var zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      transform.scale = Math.max(0.3, Math.min(3.0, transform.scale * zoomFactor));
      renderSVG();
    }, { passive: false });
  }

  function openVisualizer() {
    renderModal();
    buildGraphData();
    if (modalEl) modalEl.style.display = 'flex';
    isSimulating = true;
    renderSVG();
    tickSimulation();
  }

  function init() {
    renderModal();
  }

  return {
    init: init,
    openVisualizer: openVisualizer
  };
});
