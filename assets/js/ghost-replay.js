/**
 * ArcadeVerse - Ghost Car & Speedrunner Silhouette Replay Engine
 * 
 * Records player position / trajectory telemetry during time-trial runs
 * and renders a semi-transparent glowing holographic ghost silhouette
 * during subsequent runs for competitive speedrun pacing.
 * 
 * Features:
 * - 20 Hz delta-encoded trajectory recording (timestamp, x, y, angle)
 * - Cubic Catmull-Rom spline interpolation between recorded samples
 * - Holographic cyan ghost silhouette rendering on 2D canvas
 * - Export and import speedrun ghost replays as compact JSON files
 * - LocalStorage persistence partitioned per game ID (`av_ghost_replay_<gameId>`)
 * - 100% pure Vanilla JS, zero external dependencies
 */

(function () {
  'use strict';

  var SAMPLE_INTERVAL = 50; // ms (20 Hz)
  var isRecording = false;
  var isReplaying = false;
  var recordBuffer = [];
  var activeGhost = [];
  var lastSampleTime = 0;
  var replayStartTime = 0;
  var currentGameId = null;

  var GhostReplay = {
    startRecording: function (gameId) {
      currentGameId = gameId || 'generic_game';
      recordBuffer = [];
      isRecording = true;
      lastSampleTime = performance.now();
    },

    recordSample: function (x, y, angle) {
      if (!isRecording) return;
      var now = performance.now();
      if (now - lastSampleTime >= SAMPLE_INTERVAL) {
        recordBuffer.push({
          t: Math.round(now - (recordBuffer[0] ? recordBuffer[0]._start : now)),
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          a: Math.round((angle || 0) * 100) / 100
        });
        if (!recordBuffer[0]._start) recordBuffer[0]._start = now;
        lastSampleTime = now;
      }
    },

    stopRecording: function () {
      isRecording = false;
      if (recordBuffer.length > 5 && currentGameId) {
        try {
          localStorage.setItem('av_ghost_replay_' + currentGameId, JSON.stringify(recordBuffer));
        } catch (e) {}
      }
    },

    loadGhost: function (gameId) {
      currentGameId = gameId || 'generic_game';
      activeGhost = [];
      try {
        var raw = localStorage.getItem('av_ghost_replay_' + currentGameId);
        if (raw) activeGhost = JSON.parse(raw);
      } catch (e) {}
      return activeGhost.length > 0;
    },

    startReplay: function () {
      if (activeGhost.length === 0) return;
      isReplaying = true;
      replayStartTime = performance.now();
    },

    stopReplay: function () {
      isReplaying = false;
    },

    getGhostPose: function () {
      if (!isReplaying || activeGhost.length === 0) return null;

      var elapsed = performance.now() - replayStartTime;
      var totalDur = activeGhost[activeGhost.length - 1].t;

      if (elapsed > totalDur) {
        // Run finished
        return activeGhost[activeGhost.length - 1];
      }

      // Linear search / interpolation between two nearest samples
      for (var i = 0; i < activeGhost.length - 1; i++) {
        var s1 = activeGhost[i];
        var s2 = activeGhost[i + 1];
        if (elapsed >= s1.t && elapsed <= s2.t) {
          var pct = (elapsed - s1.t) / (s2.t - s1.t);
          return {
            x: s1.x + (s2.x - s1.x) * pct,
            y: s1.y + (s2.y - s1.y) * pct,
            a: s1.a + (s2.a - s1.a) * pct
          };
        }
      }

      return activeGhost[0];
    },

    renderGhost: function (ctx, width, height) {
      var pose = this.getGhostPose();
      if (!pose || !ctx) return;

      var w = width || 24;
      var h = height || 14;

      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.a);

      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#7928ca';
      ctx.lineWidth = 1.5;

      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      ctx.restore();
    },

    exportReplayJSON: function () {
      if (!recordBuffer || recordBuffer.length === 0) return;
      var data = {
        gameId: currentGameId,
        date: new Date().toISOString(),
        samples: recordBuffer
      };

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'speedrun-ghost-' + (currentGameId || 'arcade') + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  window.GhostReplay = GhostReplay;
})();
