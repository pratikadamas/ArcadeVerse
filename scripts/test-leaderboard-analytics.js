const test = require('node:test');
const assert = require('node:assert/strict');
const LeaderboardAnalytics = require('../assets/js/leaderboard-analytics.js');

test('LeaderboardAnalytics computes standard deviation, median, and percentiles', () => {
  const scores = [100, 200, 300, 400, 500];
  const analytics = new LeaderboardAnalytics(scores);

  assert.equal(analytics.stats.count, 5);
  assert.equal(analytics.stats.median, 300);
  assert.equal(analytics.stats.min, 100);
  assert.equal(analytics.stats.max, 500);
  assert.equal(analytics.stats.mean, 300);
  assert.ok(analytics.stats.stdDev > 0);
});

test('LeaderboardAnalytics calculates arbitrary score percentile outperformance', () => {
  const scores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const analytics = new LeaderboardAnalytics(scores);

  // Score 85 outperforms 8 out of 10 players -> 80%
  const percentile = analytics.calculateScorePercentile(85);
  assert.equal(percentile, 80);
});

test('LeaderboardAnalytics generates valid sanitized JSON and CSV exports', () => {
  const analytics = new LeaderboardAnalytics([50, 100]);
  const jsonStr = analytics.exportJSON();
  const csvStr = analytics.exportCSV();

  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.statistics.count, 2);
  assert.ok(csvStr.includes('rank,score'));
  assert.ok(csvStr.includes('1,50'));
});
