/**
 * Client-Side Leaderboard Score Distribution Analytics & Percentile Histogram Suite
 * Pure HTML5 Canvas 2D & Statistical Math Suite
 * Renders retro neon frequency distribution histograms, calculates standard deviation,
 * median, 90th percentile threshold, interquartile range (IQR), interactive arbitrary
 * score percentile calculator, and 1-click sanitized JSON and CSV data export.
 *
 * @module LeaderboardAnalytics
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
    root.ArcadeVerse.LeaderboardAnalytics = factory();
    root.LeaderboardAnalytics = root.ArcadeVerse.LeaderboardAnalytics;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function LeaderboardAnalytics(scoresArray, options) {
    this.scores = (scoresArray || []).map(Number).filter(function (n) {
      return !isNaN(n) && Number.isFinite(n);
    }).sort(function (a, b) { return a - b; });

    this.options = Object.assign({
      binCount: 12,
      canvasElement: null,
      themeColor: '#00dfd8'
    }, options);

    this.canvas = null;
    this.ctx = null;
    if (this.options.canvasElement) {
      if (typeof this.options.canvasElement === 'string' && typeof document !== 'undefined') {
        this.canvas = document.querySelector(this.options.canvasElement);
      } else {
        this.canvas = this.options.canvasElement;
      }
      this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    }

    this.stats = this.computeStatistics();
  }

  /**
   * Pure mathematical statistical summary
   */
  LeaderboardAnalytics.prototype.computeStatistics = function () {
    var arr = this.scores;
    var n = arr.length;
    if (n === 0) {
      return { count: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0, p90: 0, iqr: 0 };
    }

    var sum = 0;
    for (var i = 0; i < n; i++) sum += arr[i];
    var mean = sum / n;

    // Variance & Standard Deviation
    var varianceSum = 0;
    for (var j = 0; j < n; j++) {
      var diff = arr[j] - mean;
      varianceSum += diff * diff;
    }
    var stdDev = Math.sqrt(varianceSum / n);

    // Median
    var mid = Math.floor(n / 2);
    var median = (n % 2 !== 0) ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;

    // Percentiles helper
    var getPercentile = function (p) {
      var idx = (p / 100) * (n - 1);
      var base = Math.floor(idx);
      var rest = idx - base;
      if (arr[base + 1] !== undefined) {
        return arr[base] + rest * (arr[base + 1] - arr[base]);
      }
      return arr[base];
    };

    var p25 = getPercentile(25);
    var p75 = getPercentile(75);
    var p90 = getPercentile(90);
    var iqr = p75 - p25;

    return {
      count: n,
      min: arr[0],
      max: arr[n - 1],
      mean: Math.round(mean * 100) / 100,
      median: median,
      stdDev: Math.round(stdDev * 100) / 100,
      p25: p25,
      p75: p75,
      p90: p90,
      iqr: iqr
    };
  };

  /**
   * Calculates what percentile of players a given score outperforms
   * e.g. score outperforms 95.8% of players -> 'Top 4.2%'
   */
  LeaderboardAnalytics.prototype.calculateScorePercentile = function (targetScore) {
    var arr = this.scores;
    var n = arr.length;
    if (n === 0) return 100;

    var belowCount = 0;
    for (var i = 0; i < n; i++) {
      if (arr[i] < targetScore) {
        belowCount++;
      } else {
        break;
      }
    }

    var percentile = (belowCount / n) * 100;
    return Math.round(percentile * 10) / 10;
  };

  /**
   * Bins score distribution for histogram rendering
   */
  LeaderboardAnalytics.prototype.getHistogramBins = function () {
    var arr = this.scores;
    var bins = [];
    var binCount = this.options.binCount;
    if (arr.length === 0) return bins;

    var min = arr[0];
    var max = arr[arr.length - 1];
    var range = (max - min) || 1;
    var binSize = range / binCount;

    for (var b = 0; b < binCount; b++) {
      bins.push({
        binStart: Math.floor(min + b * binSize),
        binEnd: Math.floor(min + (b + 1) * binSize),
        count: 0
      });
    }

    for (var i = 0; i < arr.length; i++) {
      var score = arr[i];
      var idx = Math.min(binCount - 1, Math.floor((score - min) / binSize));
      if (idx < 0) idx = 0;
      bins[idx].count++;
    }

    return bins;
  };

  /**
   * Renders the retro neon frequency distribution histogram on Canvas 2D
   */
  LeaderboardAnalytics.prototype.renderHistogram = function () {
    if (!this.ctx || !this.canvas) return;
    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;
    var bins = this.getHistogramBins();
    if (bins.length === 0) return;

    var maxCount = Math.max.apply(null, bins.map(function (b) { return b.count; })) || 1;

    // Background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    var padding = 40;
    var chartW = w - padding * 2;
    var chartH = h - padding * 2;
    var barW = chartW / bins.length;

    // Draw bars
    for (var i = 0; i < bins.length; i++) {
      var b = bins[i];
      var barH = (b.count / maxCount) * chartH;
      var bx = padding + i * barW;
      var by = h - padding - barH;

      ctx.fillStyle = 'rgba(0, 223, 216, 0.25)';
      ctx.fillRect(bx + 2, by, barW - 4, barH);

      ctx.strokeStyle = '#00dfd8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 2, by, barW - 4, barH);
    }
  };

  /**
   * Exports sanitized JSON payload
   */
  LeaderboardAnalytics.prototype.exportJSON = function () {
    return JSON.stringify({
      statistics: this.stats,
      bins: this.getHistogramBins(),
      scores: this.scores
    }, null, 2);
  };

  /**
   * Exports sanitized CSV string
   */
  LeaderboardAnalytics.prototype.exportCSV = function () {
    var rows = ['rank,score'];
    for (var i = 0; i < this.scores.length; i++) {
      rows.push((i + 1) + ',' + this.scores[i]);
    }
    return rows.join('\n');
  };

  return LeaderboardAnalytics;
});
