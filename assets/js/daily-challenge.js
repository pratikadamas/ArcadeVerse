/**
 * ArcadeVerse Daily Challenge & Mystery Quest Engine
 * Deterministic daily seeded challenges, midnight countdown, and streak tracker
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_daily_quest';

  const DailyChallenge = {
    todayKey: '',
    challenge: null,
    streak: 0,
    completed: false,

    init() {
      const now = new Date();
      this.todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
      this.loadState();
      this.generateTodayChallenge();
      this.renderBanner();
      this.startCountdown();
      this.bindEvents();
    },

    loadState() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        if (saved.lastCompletedDate === this.todayKey) {
          this.completed = true;
        }
        this.streak = saved.streak || 0;
      } catch (_) {
        this.streak = 0;
      }
    },

    saveState() {
      const payload = JSON.stringify({
        lastCompletedDate: this.completed ? this.todayKey : '',
        streak: this.streak
      });
      if (window.ArcadeStorageResilience && typeof window.ArcadeStorageResilience.safeSetItem === 'function') {
        window.ArcadeStorageResilience.safeSetItem(STORAGE_KEY, payload);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, payload);
        } catch (_) {}
      }
    },

    // Deterministic pseudo-random seed from date string
    generateTodayChallenge() {
      const games = (typeof window !== 'undefined' && window.GAMES_REGISTRY) || (typeof GAMES_REGISTRY !== 'undefined' ? GAMES_REGISTRY : []);
      if (!games || games.length === 0) return;

      let hash = 0;
      for (let i = 0; i < this.todayKey.length; i++) {
        hash = (hash << 5) - hash + this.todayKey.charCodeAt(i);
        hash |= 0;
      }
      const positiveHash = Math.abs(hash);

      const gameIndex = positiveHash % games.length;
      const game = games[gameIndex];

      const targets = [250, 500, 750, 1000, 1500];
      const targetScore = targets[positiveHash % targets.length];

      this.challenge = {
        date: this.todayKey,
        game,
        targetScore,
        rewardPoints: 100
      };
    },

    renderBanner() {
      const targetMount = document.getElementById('daily-challenge-mount');
      if (!targetMount || !this.challenge) return;

      const { game, targetScore, rewardPoints } = this.challenge;

      targetMount.innerHTML = `
        <div class="daily-quest-card">
          <div class="daily-quest-header">
            <div class="daily-badge">
              <span class="daily-pulse-dot" aria-hidden="true"></span>
              <span>DAILY ARCADE MISSION • 24H ROTATION</span>
            </div>
            <div class="daily-streak-badge" title="Daily Completion Streak">
              <svg class="streak-flame-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.06 3.01-7.79 6.03-10.74.83-.81 2.14-.23 2.14.93v2.85c1.4-1.8 3.05-3.8 4.33-5.79.46-.71 1.5-.47 1.63.36C18.66 8.5 21 12.08 21 14c0 4.97-4.03 9-9 9zm0-15.5c-1.88 2.21-3.66 4.67-4.47 7.07-.35 1.05.43 2.14 1.54 2.14 1.53 0 2.22-.96 2.93-1.95.71.99 1.4 1.95 2.93 1.95 1.11 0 1.89-1.09 1.54-2.14-.81-2.4-2.59-4.86-4.47-7.07z"/>
              </svg>
              <span class="streak-count">${this.streak} DAY STREAK</span>
            </div>
          </div>

          <div class="daily-quest-content">
            <div class="daily-quest-info">
              <h3 class="daily-quest-title">Operation: <span class="accent-text">${game.title}</span></h3>
              <p class="daily-quest-desc">
                Engage in today's featured simulation. Achieve a score of <strong>${targetScore}+ points</strong> to secure <strong>+${rewardPoints} Arcade XP</strong>.
              </p>
            </div>

            <div class="daily-quest-actions">
              <div class="daily-countdown-wrap">
                <span class="countdown-label">MISSION EXPIRES IN</span>
                <span id="daily-timer" class="countdown-clock">--:--:--</span>
              </div>
              <button id="btn-launch-daily" class="btn-daily-launch" data-game-id="${game.id}" type="button">
                ${this.completed ? 'Mission Completed' : 'Deploy Mission'}
              </button>
            </div>
          </div>
        </div>
      `;
    },

    startCountdown() {
      const updateClock = () => {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        const diff = Math.max(0, tomorrow - now);

        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);

        const clockEl = document.getElementById('daily-timer');
        if (clockEl) {
          clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      };

      updateClock();
      setInterval(updateClock, 1000);
    },

    bindEvents() {
      document.addEventListener('click', (e) => {
        const launchBtn = e.target.closest('#btn-launch-daily');
        if (launchBtn && this.challenge) {
          const gameId = launchBtn.dataset.gameId;
          const games = (typeof window !== 'undefined' && window.GAMES_REGISTRY) || (typeof GAMES_REGISTRY !== 'undefined' ? GAMES_REGISTRY : []);
          const game = games.find(g => g.id === gameId);
          if (game && typeof window.openGameModal === 'function') {
            window.openGameModal(game);
          }
        }
      });
    }
  };

  window.DailyChallenge = DailyChallenge;
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for games registry to load
    setTimeout(() => DailyChallenge.init(), 100);
  });
})();
