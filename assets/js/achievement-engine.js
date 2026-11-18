/**
 * ArcadeVerse Universal Player Trophy & Achievement Engine (#657)
 * Catalog of universal player achievements, event dispatch listeners,
 * local storage progress tracking, and holographic slide-in unlock toasts.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'av_achievements';

  const ACHIEVEMENTS_CATALOG = [
    { id: 'first_blood', name: 'First Blood', desc: 'Play your first game on ArcadeVerse', icon: 'gamepad-2', points: 10 },
    { id: 'arcade_marathoner', name: 'Arcade Marathoner', desc: 'Play 5 unique games in one session', icon: 'zap', points: 25 },
    { id: 'high_roller', name: 'High Roller', desc: 'Submit a verified score over 1,000 points', icon: 'trophy', points: 50 },
    { id: 'puzzle_master', name: 'Puzzle Master', desc: 'Conquer a puzzle game challenge', icon: 'brain', points: 30 },
    { id: 'night_owl', name: 'Night Owl', desc: 'Launch a game past midnight', icon: 'moon', points: 15 },
    { id: 'curator', name: 'Arcade Curator', desc: 'Bookmark 3 or more favorite games', icon: 'heart', points: 20 },
    { id: 'sound_enthusiast', name: 'Sound Enthusiast', desc: 'Tune audio mixer sliders', icon: 'volume-2', points: 15 },
    { id: 'perfectionist', name: 'Perfectionist', desc: 'Score over 5,000 points in any game', icon: 'award', points: 100 }
  ];

  class AchievementEngine {
    constructor() {
      this.unlocked = this.loadUnlocked();
      this.playedGamesSession = new Set();
      this.init();
    }

    loadUnlocked() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (_) {
        return {};
      }
    }

    saveUnlocked() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.unlocked));
      } catch (_) {}
    }

    init() {
      window.addEventListener('arcadeverse:game-launched', (e) => {
        const game = e.detail;
        if (!game) return;
        this.unlock('first_blood');

        this.playedGamesSession.add(game.id);
        if (this.playedGamesSession.size >= 5) {
          this.unlock('arcade_marathoner');
        }

        const hour = new Date().getHours();
        if (hour >= 0 && hour < 5) {
          this.unlock('night_owl');
        }

        if ((game.category || '').toLowerCase().includes('puzzle')) {
          this.unlock('puzzle_master');
        }
      });

      window.addEventListener('message', (e) => {
        if (!e || !e.data || typeof e.data !== 'object') return;
        const type = e.data.type || '';
        if (type === 'ARCADEVERSE_SCORE_SUBMIT' || type === 'ARCADEVERSE_GAME_OVER') {
          const score = Number(e.data.score) || 0;
          if (score >= 1000) this.unlock('high_roller');
          if (score >= 5000) this.unlock('perfectionist');
        }
      });

      window.addEventListener('arcadeverse:favorites-updated', () => {
        try {
          const favs = JSON.parse(localStorage.getItem('av_favorites') || '[]');
          if (Array.isArray(favs) && favs.length >= 3) {
            this.unlock('curator');
          }
        } catch (_) {}
      });
    }

    unlock(achievementId) {
      if (this.unlocked[achievementId]) return;
      const ach = ACHIEVEMENTS_CATALOG.find(a => a.id === achievementId);
      if (!ach) return;

      this.unlocked[achievementId] = {
        unlockedAt: new Date().toISOString()
      };
      this.saveUnlocked();

      this.showUnlockToast(ach);
      this.playFanfare();
    }

    showUnlockToast(ach) {
      let toast = document.getElementById('av-achievement-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'av-achievement-toast';
        toast.className = 'achievement-toast';
        document.body.appendChild(toast);
      }

      toast.innerHTML = `
        <div class="achievement-toast-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
        </div>
        <div class="achievement-toast-body">
          <span class="achievement-toast-badge">Achievement Unlocked! (+${ach.points} XP)</span>
          <strong class="achievement-toast-title">${ach.name}</strong>
          <span class="achievement-toast-desc">${ach.desc}</span>
        </div>
      `;

      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 4500);
    }

    playFanfare() {
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return;
        const ctx = new AudioClass();
        const now = ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.15, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.3);
        });
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.ArcadeAchievements = new AchievementEngine();
    });
  } else {
    window.ArcadeAchievements = new AchievementEngine();
  }
})();
