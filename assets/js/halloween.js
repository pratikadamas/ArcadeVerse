/**
 * ArcadeVerse - Halloween Special Games Controller & Exclusive Bat Loader
 * Handles configurable game redirection in a new tab, 3D card tilt effects,
 * interactive previews, atmospheric ambient particles, and the exclusive flying-bat loading experience.
 */

(() => {
  "use strict";

  // Centralized Halloween Games Data Configuration
  const HALLOWEEN_GAMES_CONFIG = {
    "haunted-house_debasmita": {
      id: "haunted-house_debasmita",
      title: "Haunted House: The Curse Within",
      url: "games/haunted-house_debasmita/index.html",
      difficulty: "Hard",
      difficultyScore: 3, // out of 4
      category: "Adventure / Horror",
      badge: "Horror Mystery",
      theme: "manor",
      loadingPhrases: [
        "Entering the Haunted World...",
        "The Darkness Awaits...",
        "Preparing Your Nightmare...",
        "Awakening the Blackwood Specters..."
      ]
    },
    "escape-room_debasmita": {
      id: "escape-room_debasmita",
      title: "Halloween Escape: Witch's Crypt",
      url: "games/escape-room_debasmita/index.html",
      difficulty: "Expert",
      difficultyScore: 4,
      category: "Puzzle / Mystery",
      badge: "Escape Room",
      theme: "crypt",
      loadingPhrases: [
        "Deciphering Arcane Crypt Runes...",
        "Unsealing the Witch's Vault...",
        "Preparing Your Nightmare...",
        "Igniting the Alchemical Flames..."
      ]
    },
    "island-survival_debasmita": {
      id: "island-survival_debasmita",
      title: "Island Survival: Lost Beyond the Shore",
      url: "games/island-survival_debasmita/index.html",
      difficulty: "Survival",
      difficultyScore: 3,
      category: "Survival / Adventure",
      badge: "Top-Down Survival",
      theme: "island",
      loadingPhrases: [
        "Stranded Beyond the Shore...",
        "Entering the Haunted World...",
        "The Island Spirits Are Watching...",
        "Gathering Survival Instincts..."
      ]
    }
  };

  // Expose configuration globally for extensibility
  window.HALLOWEEN_GAMES_CONFIG = HALLOWEEN_GAMES_CONFIG;

  // Bat SVG Template with separate animated wing elements
  const BAT_SVG = `
    <svg class="bat-svg" viewBox="0 0 100 60" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="batOrangeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ff7700" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#ff3300" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="30" r="26" fill="url(#batOrangeGlow)" class="bat-glow" />
      <g class="bat-wings-group">
        <path class="bat-wing bat-wing-left" d="M 50,32 C 40,8 14,4 4,22 C 14,29 27,27 34,42 C 41,37 47,39 50,32 Z" />
        <path class="bat-wing bat-wing-right" d="M 50,32 C 60,8 86,4 96,22 C 86,29 73,27 66,42 C 59,37 53,39 50,32 Z" />
        <ellipse cx="50" cy="34" rx="5.5" ry="11" class="bat-torso" />
        <circle cx="50" cy="22" r="5" class="bat-head" />
        <polygon points="46,20 43,12 48,17" class="bat-ear" />
        <polygon points="54,20 57,12 52,17" class="bat-ear" />
        <circle cx="48" cy="22" r="0.9" fill="#ff7700" />
        <circle cx="52" cy="22" r="0.9" fill="#ff7700" />
      </g>
    </svg>
  `;

  let activeLoaderTimeout = null;
  let activePhraseInterval = null;

  /**
   * Initializes the exclusive Flying Bat Loader elements
   */
  function ensureBatLoader() {
    let loader = document.getElementById("halloween-bat-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "halloween-bat-loader";
      loader.className = "halloween-bat-loader";
      loader.setAttribute("role", "dialog");
      loader.setAttribute("aria-live", "polite");
      loader.setAttribute("aria-modal", "true");
      loader.setAttribute("aria-label", "Launching Halloween Game");

      loader.innerHTML = `
        <div class="bat-loader-backdrop"></div>
        <div class="bat-loader-swarm" id="bat-loader-swarm" aria-hidden="true"></div>
        <div class="bat-loader-content">
          <div class="bat-loader-icon-frame" aria-hidden="true">
            <svg class="bat-portal-sigil" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="44" stroke="#ff7700" stroke-width="2" stroke-dasharray="6 4" class="sigil-ring-outer"/>
              <circle cx="50" cy="50" r="34" stroke="#a855f7" stroke-width="1.5" class="sigil-ring-inner"/>
              <polygon points="50,18 78,66 22,66" stroke="#ffaa32" stroke-width="1.2" opacity="0.6"/>
              <polygon points="50,82 78,34 22,34" stroke="#ffaa32" stroke-width="1.2" opacity="0.6"/>
            </svg>
            <div class="bat-loader-portal-pulse"></div>
          </div>
          <div class="bat-loader-meta">
            <span class="bat-loader-eyebrow">HALLOWEEN PORTAL OPENING</span>
            <h3 class="bat-loader-title" id="bat-loader-game-title">Haunted House</h3>
            <p class="bat-loader-status" id="bat-loader-status-text">Entering the Haunted World...</p>
          </div>
          <div class="bat-loader-actions" id="bat-loader-actions" style="display: none;">
            <div class="bat-loader-notice" id="bat-loader-notice">
              <strong>Pop-up blocked!</strong> Please allow pop-ups for this site to open the game in a new tab.
            </div>
            <div class="bat-loader-btn-row">
              <button type="button" class="btn-bat-retry" id="btn-bat-retry">Allow & Retry</button>
              <button type="button" class="btn-bat-cancel" id="btn-bat-cancel">Cancel</button>
            </div>
          </div>
        </div>
      `;

      const halloweenSection = document.getElementById("halloween-special");
      if (halloweenSection) {
        halloweenSection.appendChild(loader);
      } else {
        document.body.appendChild(loader);
      }

      // Hook up retry & cancel actions
      document.getElementById("btn-bat-retry")?.addEventListener("click", () => {
        const gameId = loader.getAttribute("data-target-game");
        if (gameId) launchHalloweenGame(gameId, true);
      });

      document.getElementById("btn-bat-cancel")?.addEventListener("click", () => {
        hideBatLoader();
      });
    }
    return loader;
  }

  /**
   * Generates flying bats within the loader overlay
   */
  function populateBatSwarm(swarmContainer) {
    if (!swarmContainer) return;
    swarmContainer.innerHTML = "";

    // 8 bats with randomized trajectory classes and delays
    const batTrajectories = [
      { cls: "trajectory-diag-up-right", size: 54, dur: 1.1, delay: 0 },
      { cls: "trajectory-horiz-left", size: 42, dur: 1.35, delay: 0.12 },
      { cls: "trajectory-swoop-down", size: 68, dur: 1.25, delay: 0.2 },
      { cls: "trajectory-diag-up-left", size: 48, dur: 1.15, delay: 0.08 },
      { cls: "trajectory-dart-fast", size: 32, dur: 0.9, delay: 0.28 },
      { cls: "trajectory-spiral-up", size: 58, dur: 1.4, delay: 0.15 },
      { cls: "trajectory-horiz-right", size: 38, dur: 1.2, delay: 0.32 },
      { cls: "trajectory-lead-giant", size: 76, dur: 1.05, delay: 0.22 }
    ];

    batTrajectories.forEach((item, index) => {
      const batEl = document.createElement("div");
      batEl.className = `flying-bat ${item.cls}`;
      batEl.style.width = `${item.size}px`;
      batEl.style.height = `${Math.round(item.size * 0.6)}px`;
      batEl.style.animationDuration = `${item.dur}s`;
      batEl.style.animationDelay = `${item.delay}s`;
      batEl.innerHTML = BAT_SVG;
      swarmContainer.appendChild(batEl);
    });
  }

  /**
   * Shows a temporary in-section notification banner if a game URL is unavailable
   */
  function showUnavailableNotice(message) {
    let notice = document.getElementById("halloween-toast-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "halloween-toast-notice";
      notice.className = "halloween-toast-notice";
      notice.setAttribute("role", "alert");
      const container = document.querySelector(".halloween-container");
      if (container) container.appendChild(notice);
      else document.body.appendChild(notice);
    }
    notice.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;
    notice.classList.add("visible");
    setTimeout(() => notice.classList.remove("visible"), 4200);
  }

  /**
   * Hides the exclusive bat loader
   */
  function hideBatLoader() {
    const loader = document.getElementById("halloween-bat-loader");
    if (loader) {
      loader.classList.add("bat-loader-fading");
      setTimeout(() => {
        loader.classList.remove("active", "bat-loader-fading");
        const actions = document.getElementById("bat-loader-actions");
        if (actions) actions.style.display = "none";
      }, 350);
    }
    if (activeLoaderTimeout) clearTimeout(activeLoaderTimeout);
    if (activePhraseInterval) clearInterval(activePhraseInterval);
  }

  /**
   * Launches a Halloween game in a NEW browser tab with exclusive bat loader
   */
  function launchHalloweenGame(gameId, isRetry = false) {
    const game = HALLOWEEN_GAMES_CONFIG[gameId];
    if (!game || !game.url) {
      showUnavailableNotice("The spirits have temporarily sealed this portal. Game is currently unavailable.");
      return;
    }

    const loader = ensureBatLoader();
    loader.setAttribute("data-target-game", gameId);
    loader.classList.remove("bat-loader-fading");
    loader.classList.add("active");

    const gameTitleEl = document.getElementById("bat-loader-game-title");
    const statusTextEl = document.getElementById("bat-loader-status-text");
    const actionsEl = document.getElementById("bat-loader-actions");
    const swarmEl = document.getElementById("bat-loader-swarm");

    if (gameTitleEl) gameTitleEl.textContent = game.title;
    if (actionsEl) actionsEl.style.display = "none";

    // Set initial phrase and rotate
    const phrases = game.loadingPhrases || [
      "Entering the Haunted World...",
      "The Darkness Awaits...",
      "Preparing Your Nightmare..."
    ];
    let phraseIndex = 0;
    if (statusTextEl) statusTextEl.textContent = phrases[0];

    if (activePhraseInterval) clearInterval(activePhraseInterval);
    activePhraseInterval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      if (statusTextEl) {
        statusTextEl.style.opacity = "0";
        setTimeout(() => {
          statusTextEl.textContent = phrases[phraseIndex];
          statusTextEl.style.opacity = "1";
        }, 180);
      }
    }, 450);

    // Spawn bats
    populateBatSwarm(swarmEl);

    if (activeLoaderTimeout) clearTimeout(activeLoaderTimeout);

    // Play a short atmospheric sound if sound-engine is available
    if (window.soundEngine && typeof window.soundEngine.playTone === "function") {
      try {
        window.soundEngine.playTone(180, "sawtooth", 0.45, 0.08);
      } catch (err) {
        // audio context safe fallback
      }
    }

    // Snappy transition (approx 780ms) for an immersive bat swarm flight before launching new tab
    activeLoaderTimeout = setTimeout(() => {
      clearInterval(activePhraseInterval);

      try {
        // Secure launch in a NEW browser tab
        const openedWindow = window.open(game.url, "_blank", "noopener,noreferrer");

        // Check if browser blocked the new tab
        if (!openedWindow || openedWindow.closed || typeof openedWindow.closed === "undefined") {
          if (actionsEl) actionsEl.style.display = "flex";
          if (statusTextEl) statusTextEl.textContent = "Pop-up blocked by your browser settings.";
        } else {
          // Window successfully opened: complete animation and hide loader
          if (statusTextEl) statusTextEl.textContent = "Portal Opened! Safe travels...";
          setTimeout(() => {
            hideBatLoader();
          }, 320);
        }
      } catch (err) {
        if (actionsEl) actionsEl.style.display = "flex";
        if (statusTextEl) statusTextEl.textContent = "Unable to open new tab directly.";
      }
    }, 780);
  }

  // Expose launch function globally
  window.launchHalloweenGame = launchHalloweenGame;

  /**
   * Initializes 3D Tilt Effect on Game Cards
   */
  function init3DTilt() {
    const cards = document.querySelectorAll(".halloween-card");
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isTouch || prefersReducedMotion) return;

    cards.forEach((card) => {
      let isHovered = false;

      card.addEventListener("mouseenter", () => {
        isHovered = true;
        card.style.transition = "transform 0.12s ease-out, box-shadow 0.25s ease-out, border-color 0.25s ease-out";
      });

      card.addEventListener("mousemove", (e) => {
        if (!isHovered) return;
        const rect = card.getBoundingClientRect();
        const cardX = e.clientX - rect.left;
        const cardY = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((cardY - centerY) / centerY) * -7;
        const rotateY = ((cardX - centerX) / centerX) * 8;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale3d(1.02, 1.02, 1.02)`;
      });

      card.addEventListener("mouseleave", () => {
        isHovered = false;
        card.style.transition = "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28), box-shadow 0.3s ease, border-color 0.3s ease";
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)";
      });
    });
  }

  /**
   * Populates Ambient Floating Particles inside Section
   */
  function initAmbientParticles() {
    const container = document.querySelector(".halloween-container");
    if (!container || container.querySelector(".halloween-ambient-particles")) return;

    const particleWrap = document.createElement("div");
    particleWrap.className = "halloween-ambient-particles";
    particleWrap.setAttribute("aria-hidden", "true");

    const particleCount = 14;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("span");
      p.className = `ambient-particle p-${i % 3}`;
      p.style.left = `${(Math.random() * 96 + 2).toFixed(1)}%`;
      p.style.animationDuration = `${(Math.random() * 5 + 6).toFixed(1)}s`;
      p.style.animationDelay = `${(Math.random() * 6).toFixed(1)}s`;
      p.style.width = `${Math.floor(Math.random() * 4 + 3)}px`;
      p.style.height = p.style.width;
      particleWrap.appendChild(p);
    }

    container.prepend(particleWrap);
  }

  /**
   * Populates Occasional Background Ambient Bats
   */
  function initAmbientBackgroundBats() {
    const container = document.querySelector(".halloween-container");
    if (!container || container.querySelector(".halloween-ambient-bats")) return;

    const ambientBatsWrap = document.createElement("div");
    ambientBatsWrap.className = "halloween-ambient-bats";
    ambientBatsWrap.setAttribute("aria-hidden", "true");

    // 3 subtle background bats drifting slowly across the upper area
    for (let i = 0; i < 3; i++) {
      const b = document.createElement("div");
      b.className = `ambient-bg-bat bg-bat-${i + 1}`;
      b.innerHTML = BAT_SVG;
      ambientBatsWrap.appendChild(b);
    }

    container.prepend(ambientBatsWrap);
  }

  /**
   * Wires up Play Now Buttons and Card Clicks
   */
  function wireHalloweenInteractions() {
    const playButtons = document.querySelectorAll(".btn-halloween-play");
    playButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const gameId = btn.getAttribute("data-game-id");
        if (gameId) {
          launchHalloweenGame(gameId);
        }
      });
    });

    // Also support clicking directly on game cards (interactive preview card)
    const cards = document.querySelectorAll(".halloween-card");
    cards.forEach((card) => {
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const gameId = card.getAttribute("data-game-id");
          if (gameId) launchHalloweenGame(gameId);
        }
      });
    });
  }

  // Document Ready Initialization
  function initHalloweenShowcase() {
    ensureBatLoader();
    initAmbientParticles();
    initAmbientBackgroundBats();
    wireHalloweenInteractions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHalloweenShowcase);
  } else {
    initHalloweenShowcase();
  }
})();

