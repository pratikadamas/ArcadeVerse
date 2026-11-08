/**
 * ArcadeVerse Interactive Game Ratings & Review Engine
 * Provides interactive 5-star rating widgets and community rating score integration
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_game_ratings';

  const GameRatings = {
    ratings: {},

    init() {
      this.loadRatings();
      this.bindEvents();
    },

    loadRatings() {
      try {
        this.ratings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      } catch (_) {
        this.ratings = {};
      }
    },

    saveRatings() {
      const payload = JSON.stringify(this.ratings);
      if (window.ArcadeStorageResilience && typeof window.ArcadeStorageResilience.safeSetItem === 'function') {
        window.ArcadeStorageResilience.safeSetItem(STORAGE_KEY, payload);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, payload);
        } catch (_) {}
      }
    },

    getGameRating(gameId, defaultStars = 25) {
      const userRating = this.ratings[gameId];
      if (userRating) {
        return {
          score: userRating,
          stars: defaultStars + userRating,
          userVoted: true
        };
      }
      return {
        score: null,
        stars: defaultStars,
        userVoted: false
      };
    },

    setGameRating(gameId, rating) {
      this.ratings[gameId] = rating;
      this.saveRatings();

      // Trigger custom event so app.js or catalog re-renders if sorted
      window.dispatchEvent(new CustomEvent('rating-updated', { detail: { gameId, rating } }));
    },

    bindEvents() {
      // Hover preview over stars
      document.addEventListener('mouseover', (e) => {
        const starBtn = e.target.closest('.rate-star-btn');
        if (!starBtn) return;
        const container = starBtn.closest('.game-rating-stars');
        if (!container) return;
        const starVal = parseInt(starBtn.dataset.star, 10);
        const allStars = container.querySelectorAll('.rate-star-btn');
        allStars.forEach((btn, idx) => {
          if (idx < starVal) {
            btn.classList.add('hover-active');
          } else {
            btn.classList.remove('hover-active');
          }
        });
      });

      document.addEventListener('mouseout', (e) => {
        const starBtn = e.target.closest('.rate-star-btn');
        if (!starBtn) return;
        const container = starBtn.closest('.game-rating-stars');
        if (!container) return;
        if (e.relatedTarget && container.contains(e.relatedTarget)) return;
        const allStars = container.querySelectorAll('.rate-star-btn');
        allStars.forEach((btn) => btn.classList.remove('hover-active'));
      });

      // Listen for click on rating trigger button
      document.addEventListener('click', (e) => {
        const starBtn = e.target.closest('.rate-star-btn');
        if (starBtn) {
          e.preventDefault();
          e.stopPropagation();
          const gameId = starBtn.dataset.game;
          const score = parseInt(starBtn.dataset.star, 10);
          if (gameId && score) {
            this.setGameRating(gameId, score);
            this.updateStarUI(gameId, score);
          }
        }
      });
    },

    updateStarUI(gameId, score) {
      const card = document.querySelector(`[data-game-id="${gameId}"]`);
      if (card) {
        const starContainer = card.querySelector('.game-rating-stars');
        if (starContainer) {
          const stars = starContainer.querySelectorAll('.rate-star-btn');
          stars.forEach((s, idx) => {
            s.classList.remove('hover-active');
            if (idx < score) s.classList.add('voted');
            else s.classList.remove('voted');
          });
        }
        const badge = card.querySelector('.rating-badge');
        if (badge) {
          badge.textContent = Number(score).toFixed(1);
          badge.classList.remove('rating-pop');
          void badge.offsetWidth;
          badge.classList.add('rating-pop');
        }
        if (window.SoundEngine && typeof window.SoundEngine.playClick === 'function') {
          window.SoundEngine.playClick();
        }
      }
    }
  };

  window.GameRatings = GameRatings;
  document.addEventListener('DOMContentLoaded', () => GameRatings.init());
})();
