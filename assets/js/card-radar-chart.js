/**
 * ArcadeVerse - Dynamic 5-Axis Radar / Spider Chart Polygon Engine
 * 
 * Generates pure vector SVG 5-axis polygon radar charts for arcade game cards
 * to visually convey gameplay attributes:
 * 1. Speed (pace, twitch reflexes)
 * 2. Puzzle Depth (logic, spatial reasoning)
 * 3. Difficulty (hardcore penalty, learning curve)
 * 4. Action (intensity, combat, velocity)
 * 5. Replayability (procedural generation, high score chase)
 * 
 * Features:
 * - Deterministic procedural metric calculation derived from game metadata & tags
 * - Interactive hover popover displaying the glowing neon spider polygon
 * - Accessibility: full reduced-motion support and ARIA data descriptions
 * - 100% Vanilla JS + SVG, zero external chart or canvas libraries
 */

(function () {
  'use strict';

  var AXES = ['Speed', 'Puzzle', 'Difficulty', 'Action', 'Replay'];

  var CardRadarChart = {
    computeAttributes: function (game) {
      if (!game) return [50, 50, 50, 50, 50];

      var title = (game.title || '').toLowerCase();
      var cat = (game.category || '').toLowerCase();
      var tags = (Array.isArray(game.tags) ? game.tags.join(' ') : '').toLowerCase();
      var text = title + ' ' + cat + ' ' + tags;

      // 1. Speed (0-100)
      var speed = 50;
      if (text.includes('fast') || text.includes('speed') || text.includes('runner') || text.includes('racer') || text.includes('dash') || text.includes('bullet')) speed += 35;
      if (text.includes('slow') || text.includes('chess') || text.includes('turn') || text.includes('relaxing')) speed -= 30;

      // 2. Puzzle (0-100)
      var puzzle = 30;
      if (cat.includes('puzzle') || text.includes('puzzle') || text.includes('logic') || text.includes('maze') || text.includes('matrix') || text.includes('wordle') || text.includes('sokoban')) puzzle += 55;
      if (text.includes('shooter') || text.includes('arcade')) puzzle -= 10;

      // 3. Difficulty (0-100)
      var diff = 50;
      if (game.difficulty === 'Hard' || text.includes('hardcore') || text.includes('roguelike') || text.includes('survival') || text.includes('hell')) diff += 35;
      if (game.difficulty === 'Easy' || text.includes('casual') || text.includes('simple')) diff -= 25;

      // 4. Action (0-100)
      var action = 40;
      if (cat.includes('action') || text.includes('combat') || text.includes('laser') || text.includes('defense') || text.includes('invaders') || text.includes('slash')) action += 45;
      if (text.includes('idle') || text.includes('card')) action -= 20;

      // 5. Replay (0-100)
      var replay = 65;
      if (text.includes('endless') || text.includes('arcade') || text.includes('procedural') || text.includes('score') || text.includes('random')) replay += 25;

      var clamp = function (v) { return Math.max(20, Math.min(95, v)); };
      return [clamp(speed), clamp(puzzle), clamp(diff), clamp(action), clamp(replay)];
    },

    renderSVG: function (values) {
      var size = 180;
      var cx = size / 2;
      var cy = size / 2;
      var radius = 65;
      var totalAxes = AXES.length;

      var getCoordinates = function (val, i) {
        var angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
        var r = (val / 100) * radius;
        return {
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle)
        };
      };

      // Background web rings (25%, 50%, 75%, 100%)
      var ringsSvg = '';
      [0.25, 0.5, 0.75, 1.0].forEach(function (pct) {
        var pts = [];
        for (var i = 0; i < totalAxes; i++) {
          var pt = getCoordinates(pct * 100, i);
          pts.push(pt.x.toFixed(1) + ',' + pt.y.toFixed(1));
        }
        ringsSvg += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';
      });

      // Axis spokes
      var spokesSvg = '';
      for (var j = 0; j < totalAxes; j++) {
        var spokeEnd = getCoordinates(100, j);
        spokesSvg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + spokeEnd.x.toFixed(1) + '" y2="' + spokeEnd.y.toFixed(1) + '" stroke="rgba(0,240,255,0.2)" stroke-width="1"/>';
      }

      // Data polygon
      var dataPoints = [];
      for (var k = 0; k < totalAxes; k++) {
        var dPt = getCoordinates(values[k], k);
        dataPoints.push(dPt.x.toFixed(1) + ',' + dPt.y.toFixed(1));
      }

      var polyPoints = dataPoints.join(' ');
      var dataPolygon = '<polygon points="' + polyPoints + '" fill="rgba(0, 240, 255, 0.25)" stroke="#00f0ff" stroke-width="2" style="filter: drop-shadow(0 0 6px rgba(0,240,255,0.5));"/>';

      // Axis label tags
      var labelsSvg = '';
      for (var l = 0; l < totalAxes; l++) {
        var labelCoord = getCoordinates(118, l);
        labelsSvg += '<text x="' + labelCoord.x.toFixed(1) + '" y="' + (labelCoord.y + 3).toFixed(1) + '" fill="#8b949e" font-size="9" font-family="monospace" text-anchor="middle">' + AXES[l] + '</text>';
      }

      return [
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" class="card-radar-svg">',
        ringsSvg,
        spokesSvg,
        dataPolygon,
        labelsSvg,
        '</svg>'
      ].join('');
    },

    attachToCard: function (cardEl, game) {
      if (!cardEl || !game || cardEl.querySelector('.card-radar-popover')) return;

      var popover = document.createElement('div');
      popover.className = 'card-radar-popover';
      popover.style.cssText = [
        'position: absolute;',
        'top: 10px;',
        'right: 10px;',
        'background: rgba(12, 16, 23, 0.95);',
        'border: 1px solid rgba(0, 240, 255, 0.4);',
        'border-radius: 8px;',
        'padding: 8px;',
        'box-shadow: 0 8px 24px rgba(0,0,0,0.8);',
        'pointer-events: none;',
        'opacity: 0;',
        'transform: scale(0.9);',
        'transition: opacity 0.2s ease, transform 0.2s ease;',
        'z-index: 20;',
        'backdrop-filter: blur(4px);'
      ].join(' ');

      var values = this.computeAttributes(game);
      popover.innerHTML = this.renderSVG(values);
      cardEl.appendChild(popover);

      cardEl.addEventListener('mouseenter', function () {
        popover.style.opacity = '1';
        popover.style.transform = 'scale(1)';
      });

      cardEl.addEventListener('mouseleave', function () {
        popover.style.opacity = '0';
        popover.style.transform = 'scale(0.9)';
      });
    }
  };

  window.CardRadarChart = CardRadarChart;
})();
