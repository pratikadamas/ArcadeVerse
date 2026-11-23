/**
 * ArcadeVerse Arcade Survival Marathon Mode (Automated Timed Cross-Game Warp)
 *
 * Architecture:
 * 1. Marathon Supervisor: Orchestrates continuous multi-game sessions directly in #game-modal.
 * 2. Countdown & Life Engine: Starts with a 60-second global countdown timer and 3 lives.
 * 3. Automated Inter-Game Warp: Every 30 seconds of survival triggers a 3-second warp countdown:
 *    "GET READY! WARPING IN 3... 2... 1..." and hot-swaps the iframe to the next game.
 * 4. High Score & Trophy Ledger: Tracks consecutive clears, cumulative score, and awards
 *    "Marathon Champion" badges at 5 and 10 game milestones in localStorage ('av_marathon_ledger').
 * 5. Procedural Web Audio: Generates authentic retro warp sweeps and fanfares without external audio files.
 *
 * Strictly zero Unicode emojis across all code, comments, stylesheets, and UI elements.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const api = factory();
    root.ArcadeMarathon = api;
    root.ArcadeMarathonMode = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'av_marathon_ledger';
  const DEFAULT_GLOBAL_TIME = 60; // 60-second initial countdown
  const STAGE_DURATION = 30;      // 30 seconds per stage before auto-warp
  const INITIAL_LIVES = 3;        // 3 lives
  const TIME_BONUS_ON_CLEAR = 15; // +15s bonus on stage clear
  const MAX_GLOBAL_TIME = 99;     // Cap at 99s

  const BADGE_MILESTONES = [
    {
      streak: 5,
      id: 'marathon_champion_5',
      name: 'Marathon Champion: Contender',
      desc: 'Cleared 5 consecutive arcade games in Survival Marathon Mode',
      tier: 'bronze'
    },
    {
      streak: 10,
      id: 'marathon_champion_10',
      name: 'Marathon Champion: Legend',
      desc: 'Conquered 10 consecutive arcade games in Survival Marathon Mode',
      tier: 'gold'
    }
  ];

  /**
   * Core Marathon Engine State
   */
  class MarathonEngine {
    constructor(storage = null, gamesRegistry = null) {
      this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      this.gamesRegistry = gamesRegistry || (typeof GAMES_REGISTRY !== 'undefined' ? GAMES_REGISTRY : []);

      this.active = false;
      this.paused = false;
      this.isWarping = false;
      this.lives = INITIAL_LIVES;
      this.timeRemaining = DEFAULT_GLOBAL_TIME;
      this.stageTimeRemaining = STAGE_DURATION;
      this.consecutiveCleared = 0;
      this.cumulativeScore = 0;
      this.stageStartTime = 0;

      this.currentGame = null;
      this.previousGameId = null;
      this.runHistory = [];
      this.earnedBadgesThisRun = [];

      this.timerInterval = null;
      this.warpTimeout = null;

      this.ledger = this.loadLedger();
    }

    /**
     * Loads high score and badge ledger from storage.
     */
    loadLedger() {
      if (!this.storage) {
        return { highStreak: 0, bestScore: 0, totalGamesSurvived: 0, totalRunsPlayed: 0, badges: [], history: [] };
      }
      try {
        const raw = this.storage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            highStreak: Number(parsed.highStreak) || 0,
            bestScore: Number(parsed.bestScore) || 0,
            totalGamesSurvived: Number(parsed.totalGamesSurvived) || 0,
            totalRunsPlayed: Number(parsed.totalRunsPlayed) || 0,
            badges: Array.isArray(parsed.badges) ? parsed.badges : [],
            history: Array.isArray(parsed.history) ? parsed.history : []
          };
        }
      } catch (_) {}
      return { highStreak: 0, bestScore: 0, totalGamesSurvived: 0, totalRunsPlayed: 0, badges: [], history: [] };
    }

    /**
     * Saves ledger state to storage.
     */
    saveLedger() {
      if (!this.storage) return;
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.ledger));
      } catch (_) {}
    }

    /**
     * Selects a random game from the registry, avoiding immediate duplicate.
     */
    pickNextGame() {
      if (!Array.isArray(this.gamesRegistry) || this.gamesRegistry.length === 0) {
        return { id: 'generic-arcade', title: 'Arcade Survival', category: 'Arcade', author: 'ArcadeVerse' };
      }

      const available = this.gamesRegistry.filter(g => g.id !== this.previousGameId);
      const pool = available.length > 0 ? available : this.gamesRegistry;
      const index = Math.floor(Math.random() * pool.length);
      return pool[index];
    }

    /**
     * Starts a new Survival Marathon run.
     */
    start() {
      this.stop(); // Clear any existing run

      this.active = true;
      this.paused = false;
      this.isWarping = false;
      this.lives = INITIAL_LIVES;
      this.timeRemaining = DEFAULT_GLOBAL_TIME;
      this.stageTimeRemaining = STAGE_DURATION;
      this.consecutiveCleared = 0;
      this.cumulativeScore = 0;
      this.runHistory = [];
      this.earnedBadgesThisRun = [];
      this.previousGameId = null;

      const firstGame = this.pickNextGame();
      this.currentGame = firstGame;
      this.previousGameId = firstGame.id;
      this.runHistory.push(firstGame.id);

      // Launch in UI if in browser environment
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        this.mountHUD();
        this.launchGameInModal(firstGame);
      }

      this.startTimerLoop();
      this.playSynthSound('start');
      this.dispatchMarathonEvent('marathon-started', { game: firstGame });
      return { ok: true, game: firstGame, lives: this.lives, time: this.timeRemaining };
    }

    /**
     * Stops the marathon run.
     */
    stop(reason = 'stopped') {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.warpStepInterval) {
        clearInterval(this.warpStepInterval);
        this.warpStepInterval = null;
      }
      if (this.warpTimeout) {
        clearTimeout(this.warpTimeout);
        this.warpTimeout = null;
      }

      const wasActive = this.active;
      this.active = false;
      this.isWarping = false;

      if (wasActive) {
        this.recordRunEnd();
        this.dispatchMarathonEvent('marathon-ended', {
          reason,
          cleared: this.consecutiveCleared,
          score: this.cumulativeScore
        });
      }

      if (typeof document !== 'undefined') {
        this.unmountHUD();
        this.hideWarpBanner();
      }
    }

    /**
     * Core 1-second interval heartbeat.
     */
    startTimerLoop() {
      if (this.timerInterval) clearInterval(this.timerInterval);

      this.timerInterval = setInterval(() => {
        if (!this.active || this.paused || this.isWarping) return;
        this.tick();
      }, 1000);
    }

    /**
     * Single second simulation tick.
     */
    tick() {
      if (!this.active) return;

      // 1. Decrement timers
      this.timeRemaining = Math.max(0, this.timeRemaining - 1);
      this.stageTimeRemaining = Math.max(0, this.stageTimeRemaining - 1);

      // 2. Check stage survival warp trigger (3 seconds prior to warp)
      if (this.stageTimeRemaining <= 3 && this.stageTimeRemaining > 0 && !this.isWarping) {
        this.triggerWarpCountdown(this.stageTimeRemaining);
      }

      // 3. Stage duration completed successfully!
      if (this.stageTimeRemaining === 0 && !this.isWarping) {
        this.handleStageSuccess();
        return;
      }

      // 4. Global countdown timer exhausted!
      if (this.timeRemaining === 0) {
        this.handleTimeExpired();
        return;
      }

      // 5. Update UI
      this.updateHUD();
    }

    /**
     * Handles successful survival of a 30-second stage.
     */
    handleStageSuccess() {
      this.consecutiveCleared++;
      // Score: Base 1,000 pts + remaining time bonus + streak multiplier
      const streakBonus = this.consecutiveCleared * 250;
      const timePts = this.timeRemaining * 10;
      const stagePts = 1000 + streakBonus + timePts;
      this.cumulativeScore += stagePts;

      // Time bonus
      this.timeRemaining = Math.min(MAX_GLOBAL_TIME, this.timeRemaining + TIME_BONUS_ON_CLEAR);
      this.stageTimeRemaining = STAGE_DURATION;

      // Check badge milestones
      this.checkBadgeMilestones();

      this.playSynthSound('stage_clear');
      this.executeInterGameWarp();
    }

    /**
     * Handles life loss from timer running out.
     */
    handleTimeExpired() {
      this.lives--;
      this.playSynthSound('life_lost');

      if (this.lives > 0) {
        // Reset timer with penalty and warp to fresh game
        this.timeRemaining = 45;
        this.stageTimeRemaining = STAGE_DURATION;
        this.showLifeLostNotice('TIME EXPIRED! 1 LIFE LOST');
        this.executeInterGameWarp();
      } else {
        this.handleGameOver('Time Expired');
      }
    }

    /**
     * Handles in-game game over event from SDK postMessage.
     */
    handleInGameDefeat() {
      if (!this.active) return;
      if (this.warpStepInterval) {
        clearInterval(this.warpStepInterval);
        this.warpStepInterval = null;
      }
      this.isWarping = false;

      this.lives--;
      this.playSynthSound('life_lost');

      if (this.lives > 0) {
        this.stageTimeRemaining = STAGE_DURATION;
        this.showLifeLostNotice('CRITICAL HIT! 1 LIFE LOST');
        this.executeInterGameWarp();
      } else {
        this.handleGameOver('Defeated In Action');
      }
    }

    /**
     * Handles scoring submitted from active game.
     */
    handleGameScore(score) {
      if (!this.active) return;
      const validScore = Number(score);
      if (Number.isFinite(validScore) && validScore > 0) {
        this.cumulativeScore += Math.floor(validScore / 2); // 50% ratio into cumulative marathon
        this.updateHUD();
      }
    }

    /**
     * Checks if player crossed 5 or 10 game streak milestones.
     */
    checkBadgeMilestones() {
      for (const badge of BADGE_MILESTONES) {
        if (this.consecutiveCleared >= badge.streak) {
          const alreadyOwned = this.ledger.badges.some(b => b.id === badge.id);
          if (!alreadyOwned) {
            const badgeEntry = {
              id: badge.id,
              name: badge.name,
              desc: badge.desc,
              tier: badge.tier,
              unlockedAt: new Date().toISOString(),
              streak: badge.streak
            };
            this.ledger.badges.push(badgeEntry);
            this.earnedBadgesThisRun.push(badgeEntry);
            this.saveLedger();

            this.showBadgeNotification(badgeEntry);
            this.playSynthSound('trophy_fanfare');
            this.dispatchMarathonEvent('marathon-badge-unlocked', { badge: badgeEntry });
          }
        }
      }
    }

    /**
     * Executes the automated inter-game warp transition.
     */
    executeInterGameWarp() {
      this.isWarping = true;
      if (this.warpStepInterval) {
        clearInterval(this.warpStepInterval);
        this.warpStepInterval = null;
      }

      const nextGame = this.pickNextGame();
      this.previousGameId = nextGame.id;
      this.currentGame = nextGame;
      this.runHistory.push(nextGame.id);

      this.showWarpBanner(nextGame);
      this.playSynthSound('warp');

      // Countdown warp banner (3... 2... 1...)
      let step = 3;
      const countdownEl = typeof document !== 'undefined'
        ? document.getElementById('marathon-warp-countdown')
        : null;

      this.warpStepInterval = setInterval(() => {
        step--;
        if (countdownEl) {
          countdownEl.textContent = step > 0 ? String(step) : 'ENGAGING!';
        }
        if (step <= 0) {
          if (this.warpStepInterval) {
            clearInterval(this.warpStepInterval);
            this.warpStepInterval = null;
          }

          // Swap iframe to next game
          if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            this.swapGameIframe(nextGame);
          }

          // Complete warp
          setTimeout(() => {
            this.isWarping = false;
            this.hideWarpBanner();
            this.updateHUD();
            this.dispatchMarathonEvent('marathon-warped', { game: nextGame });
          }, 300);
        }
      }, 500);

      if (this.warpStepInterval && typeof this.warpStepInterval.unref === 'function') {
        this.warpStepInterval.unref();
      }
    }

    /**
     * Renders interstitial warp countdown prior to transition.
     */
    triggerWarpCountdown(secondsRemaining) {
      const banner = typeof document !== 'undefined' ? document.getElementById('marathon-warp-overlay') : null;
      if (banner && banner.style.display === 'none') {
        const nextCandidate = this.pickNextGame();
        this.showWarpBanner(nextCandidate, `WARPING IN ${secondsRemaining}...`);
      }
    }

    /**
     * Handles game over state when all lives are depleted.
     */
    handleGameOver(cause = 'Survival Failed') {
      this.stop('game_over');
      this.playSynthSound('game_over');

      if (typeof document !== 'undefined') {
        this.showGameOverModal(cause);
      }
    }

    /**
     * Records marathon stats into local storage ledger.
     */
    recordRunEnd() {
      this.ledger.totalRunsPlayed++;
      this.ledger.totalGamesSurvived += this.consecutiveCleared;
      if (this.consecutiveCleared > this.ledger.highStreak) {
        this.ledger.highStreak = this.consecutiveCleared;
      }
      if (this.cumulativeScore > this.ledger.bestScore) {
        this.ledger.bestScore = this.cumulativeScore;
      }

      this.ledger.history.unshift({
        cleared: this.consecutiveCleared,
        score: this.cumulativeScore,
        date: new Date().toISOString(),
        badges: [...this.earnedBadgesThisRun]
      });

      // Keep last 20 runs
      if (this.ledger.history.length > 20) {
        this.ledger.history.length = 20;
      }

      this.saveLedger();
    }

    /**
     * Browser UI: Mounts top HUD bar into #game-modal.
     */
    mountHUD() {
      if (typeof document === 'undefined') return;

      const modalWindow = document.querySelector('#game-modal .modal-window');
      const modalTopbar = document.querySelector('#game-modal .modal-topbar');
      if (!modalWindow) return;

      let hud = document.getElementById('marathon-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'marathon-hud';
        hud.className = 'marathon-hud';
        hud.setAttribute('role', 'region');
        hud.setAttribute('aria-label', 'Survival Marathon HUD');

        hud.innerHTML = `
          <div class="marathon-hud-left">
            <span class="marathon-hud-badge">SURVIVAL MARATHON</span>
            <div class="marathon-lives" id="marathon-lives" aria-label="Player Lives">
              <span class="marathon-heart active" id="heart-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </span>
              <span class="marathon-heart active" id="heart-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </span>
              <span class="marathon-heart active" id="heart-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </span>
            </div>
          </div>
          <div class="marathon-hud-center">
            <div class="marathon-timer-box">
              <span class="marathon-timer-label">GLOBAL TIME</span>
              <span class="marathon-timer-value" id="marathon-global-timer">01:00</span>
            </div>
            <div class="marathon-stage-box">
              <div class="marathon-stage-info">
                <span class="marathon-stage-label">AUTO-WARP</span>
                <span class="marathon-stage-countdown" id="marathon-stage-countdown">30s</span>
              </div>
              <div class="marathon-progress-track">
                <div class="marathon-progress-bar" id="marathon-progress-bar" style="width: 100%;"></div>
              </div>
            </div>
          </div>
          <div class="marathon-hud-right">
            <div class="marathon-stat-box">
              <span class="marathon-stat-label">CLEARED</span>
              <span class="marathon-stat-val" id="marathon-cleared-count">0</span>
            </div>
            <div class="marathon-stat-box">
              <span class="marathon-stat-label">TOTAL SCORE</span>
              <span class="marathon-stat-val" id="marathon-score-val">0</span>
            </div>
            <button type="button" class="marathon-btn-quit" id="marathon-quit-btn" title="End Marathon Session">
              QUIT
            </button>
          </div>
        `;

        if (modalTopbar && modalTopbar.nextSibling) {
          modalWindow.insertBefore(hud, modalTopbar.nextSibling);
        } else {
          modalWindow.appendChild(hud);
        }

        const quitBtn = document.getElementById('marathon-quit-btn');
        if (quitBtn) {
          quitBtn.addEventListener('click', () => {
            this.handleGameOver('Abandoned by Player');
          });
        }
      }

      hud.style.display = 'flex';
      this.updateHUD();
    }

    /**
     * Browser UI: Removes top HUD bar.
     */
    unmountHUD() {
      if (typeof document === 'undefined') return;
      const hud = document.getElementById('marathon-hud');
      if (hud) hud.style.display = 'none';
    }

    /**
     * Browser UI: Updates timers, progress bar, lives, and score indicators.
     */
    updateHUD() {
      if (typeof document === 'undefined') return;

      const timerEl = document.getElementById('marathon-global-timer');
      const stageEl = document.getElementById('marathon-stage-countdown');
      const progressEl = document.getElementById('marathon-progress-bar');
      const clearedEl = document.getElementById('marathon-cleared-count');
      const scoreEl = document.getElementById('marathon-score-val');

      if (timerEl) {
        const mins = Math.floor(this.timeRemaining / 60);
        const secs = this.timeRemaining % 60;
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (this.timeRemaining <= 15) {
          timerEl.classList.add('marathon-timer-critical');
        } else {
          timerEl.classList.remove('marathon-timer-critical');
        }
      }

      if (stageEl) stageEl.textContent = `${this.stageTimeRemaining}s`;

      if (progressEl) {
        const pct = Math.max(0, Math.min(100, (this.stageTimeRemaining / STAGE_DURATION) * 100));
        progressEl.style.width = `${pct}%`;
      }

      if (clearedEl) clearedEl.textContent = String(this.consecutiveCleared);
      if (scoreEl) scoreEl.textContent = this.cumulativeScore.toLocaleString();

      // Hearts
      for (let i = 1; i <= INITIAL_LIVES; i++) {
        const heart = document.getElementById(`heart-${i}`);
        if (heart) {
          if (i <= this.lives) {
            heart.classList.add('active');
            heart.classList.remove('lost');
          } else {
            heart.classList.remove('active');
            heart.classList.add('lost');
          }
        }
      }
    }

    /**
     * Browser UI: Displays the animated interstitial warp countdown overlay.
     */
    showWarpBanner(nextGame, title = 'GET READY!') {
      if (typeof document === 'undefined') return;

      let overlay = document.getElementById('marathon-warp-overlay');
      const modalWindow = document.querySelector('#game-modal .modal-window');
      if (!modalWindow) return;

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'marathon-warp-overlay';
        overlay.className = 'marathon-warp-overlay';

        overlay.innerHTML = `
          <div class="marathon-warp-particles"></div>
          <div class="marathon-warp-content">
            <span class="marathon-warp-tag">HYPERSPACE SEQUENCE ENGAGED</span>
            <h2 class="marathon-warp-title" id="marathon-warp-title">GET READY!</h2>
            <div class="marathon-warp-countdown" id="marathon-warp-countdown">3</div>
            <div class="marathon-warp-next">
              <span class="warp-next-label">DESTINATION:</span>
              <strong class="warp-next-title" id="marathon-warp-next-title">Cyber Snake</strong>
              <span class="warp-next-category" id="marathon-warp-next-cat">Arcade</span>
            </div>
          </div>
        `;
        modalWindow.appendChild(overlay);
      }

      const warpTitle = document.getElementById('marathon-warp-title');
      const warpCountdown = document.getElementById('marathon-warp-countdown');
      const nextTitle = document.getElementById('marathon-warp-next-title');
      const nextCat = document.getElementById('marathon-warp-next-cat');

      if (warpTitle) warpTitle.textContent = title;
      if (warpCountdown) warpCountdown.textContent = '3';
      if (nextTitle) nextTitle.textContent = nextGame ? nextGame.title : 'Arcade Title';
      if (nextCat) nextCat.textContent = nextGame ? nextGame.category : 'Arcade';

      overlay.style.display = 'flex';
      overlay.classList.add('active');
    }

    /**
     * Browser UI: Hides the warp overlay.
     */
    hideWarpBanner() {
      if (typeof document === 'undefined') return;
      const overlay = document.getElementById('marathon-warp-overlay');
      if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
          overlay.style.display = 'none';
        }, 300);
      }
    }

    /**
     * Browser UI: Displays life-lost alert banner.
     */
    showLifeLostNotice(message) {
      this.showWarpBanner(this.currentGame, message);
    }

    /**
     * Browser UI: Swaps game iframe src seamlessly without unmounting modal.
     */
    swapGameIframe(nextGame) {
      const gameIframe = document.getElementById('game-iframe');
      const modalGameTitle = document.getElementById('modal-game-title');
      const modalGameBadge = document.getElementById('modal-game-badge');
      const modalGameAuthor = document.getElementById('modal-game-author');

      if (modalGameTitle) modalGameTitle.textContent = nextGame.title;
      if (modalGameBadge) modalGameBadge.textContent = nextGame.category;
      if (modalGameAuthor) modalGameAuthor.textContent = `Built by @${nextGame.author}`;

      if (gameIframe && nextGame.path) {
        const url = new URL(nextGame.path, document.baseURI);
        url.searchParams.set('gameId', nextGame.id);
        url.searchParams.set('marathon', 'true');
        gameIframe.src = url.href;
      }

      // LRU cache record
      if (window.AvGameLruCacheManager && typeof window.AvGameLruCacheManager.recordGamePlay === 'function') {
        window.AvGameLruCacheManager.recordGamePlay(nextGame.id);
      }
    }

    /**
     * Browser UI: Launches the first game into #game-modal shell.
     */
    launchGameInModal(game) {
      if (typeof window.openGameModal === 'function') {
        window.openGameModal(game);
      }
    }

    /**
     * Browser UI: Displays the end-of-run Game Over deck.
     */
    showGameOverModal(cause) {
      let modal = document.getElementById('marathon-gameover-overlay');
      const modalWindow = document.querySelector('#game-modal .modal-window');
      if (!modalWindow) return;

      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'marathon-gameover-overlay';
        modal.className = 'marathon-gameover-overlay';
        modalWindow.appendChild(modal);
      }

      const earnedBadgesHtml = this.earnedBadgesThisRun.map(b => `
        <div class="marathon-badge-card ${b.tier}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          <div>
            <strong>${b.name}</strong>
            <p>${b.desc}</p>
          </div>
        </div>
      `).join('');

      modal.innerHTML = `
        <div class="marathon-gameover-card">
          <span class="gameover-tag">MARATHON RUN TERMINATED</span>
          <h2 class="gameover-title">${cause.toUpperCase()}</h2>
          
          <div class="gameover-stats-grid">
            <div class="gameover-stat-item">
              <span class="item-label">CONSECUTIVE CLEARED</span>
              <span class="item-val">${this.consecutiveCleared}</span>
            </div>
            <div class="gameover-stat-item">
              <span class="item-label">FINAL CUMULATIVE SCORE</span>
              <span class="item-val">${this.cumulativeScore.toLocaleString()} PTS</span>
            </div>
            <div class="gameover-stat-item">
              <span class="item-label">ALL-TIME HIGH STREAK</span>
              <span class="item-val">${this.ledger.highStreak}</span>
            </div>
            <div class="gameover-stat-item">
              <span class="item-label">ALL-TIME BEST SCORE</span>
              <span class="item-val">${this.ledger.bestScore.toLocaleString()} PTS</span>
            </div>
          </div>

          ${this.earnedBadgesThisRun.length > 0 ? `
            <div class="gameover-badges-wrap">
              <h3 class="badges-title">NEW TROPHIES EARNED:</h3>
              ${earnedBadgesHtml}
            </div>
          ` : ''}

          <div class="gameover-actions">
            <button type="button" class="btn btn-primary" id="btn-marathon-retry">
              RETRY SURVIVAL MARATHON
            </button>
            <button type="button" class="btn btn-secondary" id="btn-marathon-close">
              RETURN TO CATALOG
            </button>
          </div>
        </div>
      `;

      modal.style.display = 'flex';

      const retryBtn = document.getElementById('btn-marathon-retry');
      const closeBtn = document.getElementById('btn-marathon-close');

      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          modal.style.display = 'none';
          this.start();
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
          const gameModal = document.getElementById('game-modal');
          if (gameModal) {
            gameModal.classList.remove('active');
            gameModal.setAttribute('aria-hidden', 'true');
          }
        });
      }
    }

    /**
     * Browser UI: Shows celebratory banner when Marathon Champion badge is earned.
     */
    showBadgeNotification(badge) {
      if (typeof document === 'undefined') return;

      let toast = document.getElementById('marathon-badge-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'marathon-badge-toast';
        toast.className = 'marathon-badge-toast';
        document.body.appendChild(toast);
      }

      toast.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
        <div>
          <span class="toast-title">MARATHON CHAMPION UNLOCKED!</span>
          <strong class="toast-name">${badge.name}</strong>
          <span class="toast-desc">${badge.desc}</span>
        </div>
      `;

      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 4500);
    }

    /**
     * Procedural Web Audio Sound Synthesis (Zero external audio files).
     */
    playSynthSound(type) {
      if (typeof window === 'undefined') return;
      try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return;
        const ctx = new AudioClass();
        const now = ctx.currentTime;

        if (type === 'start') {
          // Energetic 2-chord launch
          [330, 440, 554.37, 659.25].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);
            gain.gain.setValueAtTime(0.12, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.25);
          });
        } else if (type === 'warp') {
          // Sci-fi rising hyperspace sweep
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.45);
        } else if (type === 'stage_clear') {
          // Cheerful stage clear arpeggio
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
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
        } else if (type === 'life_lost') {
          // Low warning buzz
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.linearRampToValueAtTime(80, now + 0.3);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === 'trophy_fanfare') {
          // Grand fanfare
          [440, 554.37, 659.25, 880, 1108.7].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);
            gain.gain.setValueAtTime(0.1, now + idx * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 0.4);
          });
        } else if (type === 'game_over') {
          // Descending gloomy bass
          [220, 196, 174.61, 130.81].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + idx * 0.15);
            gain.gain.setValueAtTime(0.15, now + idx * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.15);
            osc.stop(now + idx * 0.15 + 0.4);
          });
        }
      } catch (_) {}
    }

    /**
     * Dispatches window custom events.
     */
    dispatchMarathonEvent(name, detail = {}) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(`arcadeverse:${name}`, { detail }));
      }
    }
  }

  // Global Engine Instance
  let marathonInstance = null;

  function getInstance() {
    if (!marathonInstance) {
      marathonInstance = new MarathonEngine();
    }
    return marathonInstance;
  }

  /**
   * Initializes listeners and DOM hooks for Marathon mode.
   */
  function init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const engine = getInstance();

    // Listen for SDK message events
    window.addEventListener('message', (e) => {
      if (!engine.active || !e || !e.data || typeof e.data !== 'object') return;
      const type = e.data.type || '';
      if (type === 'ARCADEVERSE_GAME_OVER') {
        engine.handleInGameDefeat();
      } else if (type === 'ARCADEVERSE_SCORE_SUBMIT') {
        engine.handleGameScore(e.data.score);
      }
    });

    // Listen for modal close to cleanly pause/stop marathon
    window.addEventListener('arcadeverse:game-closed', () => {
      if (engine.active) {
        engine.stop('modal_closed');
      }
    });

    // Bind Hero and Modal launch triggers
    bindTriggers(engine);
  }

  /**
   * Binds UI trigger buttons in Hero section and Modal controls.
   */
  function bindTriggers(engine) {
    // Hero Section Button
    const heroBtn = document.getElementById('hero-marathon-btn');
    if (heroBtn && !heroBtn.dataset.marathonBound) {
      heroBtn.dataset.marathonBound = 'true';
      heroBtn.addEventListener('click', (e) => {
        e.preventDefault();
        engine.start();
      });
    }

    // Modal Control Button
    const modalControls = document.querySelector('#game-modal .modal-controls');
    if (modalControls && !document.getElementById('modal-marathon-btn')) {
      const marathonBtn = document.createElement('button');
      marathonBtn.id = 'modal-marathon-btn';
      marathonBtn.className = 'btn btn-sm btn-icon';
      marathonBtn.title = 'Start Survival Marathon Mode';
      marathonBtn.setAttribute('aria-label', 'Start Survival Marathon Mode');
      marathonBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-marathon-icon" aria-hidden="true">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      `;

      const reloadBtn = document.getElementById('reload-btn');
      if (reloadBtn) {
        modalControls.insertBefore(marathonBtn, reloadBtn);
      } else {
        modalControls.appendChild(marathonBtn);
      }

      marathonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (engine.active) {
          engine.stop('manual_toggle');
        } else {
          engine.start();
        }
      });
    }
  }

  // Automatic DOM bootstrap
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    MarathonEngine,
    BADGE_MILESTONES,
    DEFAULT_GLOBAL_TIME,
    STAGE_DURATION,
    INITIAL_LIVES,
    TIME_BONUS_ON_CLEAR,
    getInstance,
    start: () => getInstance().start(),
    stop: () => getInstance().stop(),
    getLedger: () => getInstance().loadLedger(),
    init
  };
});
