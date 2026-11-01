/**
 * ArcadeVerse Home Hub Engine
 * Handles live games catalog, in-app modal launcher, and category/search filtering
 */

document.addEventListener("DOMContentLoaded", () => {
  const gamesGrid = document.getElementById("games-grid");
  const totalGamesCount = document.getElementById("total-games-count");
  const totalContributorsCount = document.getElementById("total-contributors-count");
  const searchInput = document.getElementById("game-search-input");
  const categoryPills = document.querySelectorAll(".category-pills .pill");

  // Modal elements
  const gameModal = document.getElementById("game-modal");
  const modalOverlay = document.getElementById("modal-overlay");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalGameTitle = document.getElementById("modal-game-title");
  const modalGameBadge = document.getElementById("modal-game-badge");
  const modalGameAuthor = document.getElementById("modal-game-author");
  const gameIframe = document.getElementById("game-iframe");
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const newTabBtn = document.getElementById("new-tab-btn");
  const reloadBtn = document.getElementById("reload-btn");
  const modalWindow = document.querySelector(".modal-window");
  const sortSelect = document.getElementById("catalog-sort-select");
  const favoritesCountBadge = document.getElementById("favorites-count-badge");
  const modalFavBtn = document.getElementById("modal-fav-btn");

  let currentCategory = "all";
  let searchQuery = "";
  let currentSort = "featured";
  let lastFocusedElement = null;
  let activeGame = null;

  // Favorites LocalStorage Engine
  const FAVORITES_STORAGE_KEY = "arcadeverse_favorite_games";

  function getFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveFavorites(favSet) {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favSet)));
    } catch (e) {
      console.warn("Could not save favorites to localStorage:", e);
    }
    updateFavoritesBadge();
  }

  function isFavorite(gameId) {
    return getFavorites().has(gameId);
  }

  function updateFavoritesBadge() {
    if (favoritesCountBadge) {
      favoritesCountBadge.textContent = getFavorites().size;
    }
  }

  function updateModalFavoriteButton(fav) {
    if (!modalFavBtn) return;
    modalFavBtn.classList.toggle("favorited", fav);
    modalFavBtn.setAttribute("aria-pressed", fav ? "true" : "false");
    modalFavBtn.title = fav ? "Remove from Favorites" : "Save to Favorites";
  }

  function toggleFavorite(gameId) {
    const favs = getFavorites();
    const willBeFav = !favs.has(gameId);
    if (willBeFav) {
      favs.add(gameId);
    } else {
      favs.delete(gameId);
    }
    saveFavorites(favs);

    if (currentCategory === "favorites") {
      renderGames();
    } else {
      const cardBtn = document.querySelector(`.btn-card-favorite[data-id="${gameId}"]`);
      if (cardBtn) {
        cardBtn.classList.toggle("favorited", willBeFav);
        cardBtn.setAttribute("aria-pressed", willBeFav ? "true" : "false");
        cardBtn.title = willBeFav ? "Remove from Favorites" : "Save to Favorites";
      }
    }

    if (activeGame && activeGame.id === gameId) {
      updateModalFavoriteButton(willBeFav);
    }
  }

  // Update Stats
  if (totalGamesCount) totalGamesCount.textContent = GAMES_REGISTRY.length;
  if (totalContributorsCount) totalContributorsCount.textContent = CONTRIBUTORS_REGISTRY.length;
  updateFavoritesBadge();

  // Render Games
  function renderGames() {
    gamesGrid.innerHTML = "";
    const favs = getFavorites();

    const currentDataSet = GAMES_REGISTRY;

    let filtered = currentDataSet.filter((item) => {
      let matchesCategory = false;
      if (currentCategory === "all") {
        matchesCategory = true;
      } else if (currentCategory === "favorites") {
        matchesCategory = favs.has(item.id);
      } else if (currentCategory.startsWith("playlist:")) {
        const plId = currentCategory.replace("playlist:", "");
        const pl = window.ArcadePlaylists ? window.ArcadePlaylists.getPlaylist(plId) : null;
        matchesCategory = pl ? pl.games.includes(item.id) : false;
      } else {
        if (currentCategory.toLowerCase() === "halloween") {
        matchesCategory = (item.tags && item.tags.some(t => t.toLowerCase() === "halloween")) ||
          item.category.toLowerCase().includes("horror") ||
          item.title.toLowerCase().includes("halloween") ||
          item.id.toLowerCase().includes("haunted") ||
          item.id.toLowerCase().includes("escape-room") ||
          item.id.toLowerCase().includes("island-survival");
      } else {
        matchesCategory = item.category.toLowerCase() === currentCategory.toLowerCase();
      }
      }

      const matchesSearch = 
        item.title.toLowerCase().includes(searchQuery) ||
        item.description.toLowerCase().includes(searchQuery) ||
        item.author.toLowerCase().includes(searchQuery) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery)));

      return matchesCategory && matchesSearch;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      if (currentSort === "az") {
        return a.title.localeCompare(b.title);
      } else if (currentSort === "rating") {
        const rA = (window.GameRatings && window.GameRatings.ratings[a.id]) || (a.stars ? (a.stars / 10) : 5.0);
        const rB = (window.GameRatings && window.GameRatings.ratings[b.id]) || (b.stars ? (b.stars / 10) : 5.0);
        if (rB !== rA) return rB - rA;
        return a.title.localeCompare(b.title);
      } else {
        // "featured": featured items first, then by rating / title
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        const rA = (window.GameRatings && window.GameRatings.ratings[a.id]) || (a.stars ? (a.stars / 10) : 5.0);
        const rB = (window.GameRatings && window.GameRatings.ratings[b.id]) || (b.stars ? (b.stars / 10) : 5.0);
        if (rB !== rA) return rB - rA;
        return a.title.localeCompare(b.title);
      }
    });

    // Handle Empty State
    if (filtered.length === 0) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "catalog-empty-state";

      if (currentCategory === "favorites") {
        emptyCard.innerHTML = `
          <div class="empty-state-icon" style="color: #f43f5e;"><i data-lucide="heart-crack"></i></div>
          <h3 class="empty-state-title">No Favorite Games Saved Yet</h3>
          <p class="empty-state-desc">
            You haven't bookmarked any games yet! Click the heart icon on any game card in the catalog to add it to your personal favorites collection.
          </p>
          <div class="empty-state-actions">
            <button class="btn btn-primary btn-sm" id="reset-filter-btn">
              <span><i data-lucide="gamepad-2"></i> Browse All Games</span>
            </button>
          </div>
        `;
      } else {
        emptyCard.innerHTML = `
          <div class="empty-state-icon"><i data-lucide="gamepad-2"></i></div>
          <h3 class="empty-state-title"></h3>
          <p class="empty-state-desc">
            Be the pioneer contributor! Build the first game for this category under <code>games/&lt;game-name&gt;_&lt;your-name&gt;/</code> and claim your spot on the leaderboard.
          </p>
          <div class="empty-state-actions">
            <a href="https://github.com/DebasmitaBose0/ArcadeVerse/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              <span><i data-lucide="rocket"></i> Build a Game for This Category</span>
            </a>
            <button class="btn btn-secondary btn-sm" id="reset-filter-btn">
              <span><i data-lucide="rotate-ccw"></i> Clear Filters</span>
            </button>
          </div>
        `;
      }

      // Category and search text come from the user, so set them as text, not markup.
      const emptyTitle = emptyCard.querySelector(".empty-state-title");
      if (currentCategory !== "favorites") {
        emptyTitle.textContent = `No games found in "${currentCategory !== "all" ? currentCategory : searchQuery}"`;
      }

      emptyCard.querySelector("#reset-filter-btn").addEventListener("click", () => {
        searchQuery = "";
        currentCategory = "all";
        if (searchInput) searchInput.value = "";
        categoryPills.forEach((p) => p.classList.remove("active"));
        const allPill = document.querySelector('.category-pills .pill[data-category="all"]');
        if (allPill) allPill.classList.add("active");
        renderGames();
      });

      gamesGrid.appendChild(emptyCard);
      if (window.lucide) lucide.createIcons();
      return;
    }

    filtered.forEach((game) => {
      const card = document.createElement("div");
      card.className = "game-card";
      card.setAttribute("data-game-id", game.id);
      const iconName = game.lucideIcon || "gamepad-2";
      const iconHtml = `<i data-lucide="${iconName}"></i>`;
      const favorited = favs.has(game.id);
      const actionText = 'Play Now <i data-lucide="play" style="width: 13px; height: 13px; vertical-align: middle; margin-left: 2px;"></i>';

      const userRating = (window.GameRatings && window.GameRatings.ratings[game.id]) || null;
      const displayScore = userRating ? Number(userRating).toFixed(1) : (game.stars ? (game.stars / 10).toFixed(1) : "5.0");
      const currentStar = userRating || Math.min(5, Math.max(1, Math.round((game.stars || 25) / 10)));

      card.innerHTML = `
        <div class="game-card-preview">
          <span class="game-category-tag">${game.category}</span>
          <button class="btn-card-favorite ${favorited ? "favorited" : ""}" data-id="${game.id}" aria-label="${favorited ? "Remove from Favorites" : "Save to Favorites"}" aria-pressed="${favorited ? "true" : "false"}" title="${favorited ? "Remove from Favorites" : "Save to Favorites"}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fav-heart-icon">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </button>
          <div class="game-icon">${iconHtml}</div>
        </div>
        <div class="game-card-body">
          <h3 class="game-card-title">${game.title}</h3>
          <p class="game-card-desc">${game.description}</p>
          <div class="game-card-rating-row">
            <div class="game-rating-stars" data-game-id="${game.id}" aria-label="Rating for ${game.title}">
              ${[1, 2, 3, 4, 5].map(starNum => `
                <button type="button" class="rate-star-btn ${currentStar >= starNum ? 'voted' : ''}" data-game="${game.id}" data-star="${starNum}" title="Rate ${starNum} star${starNum > 1 ? 's' : ''}" aria-label="Rate ${starNum} stars">
                  <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              `).join('')}
              <span class="rating-badge">${displayScore}</span>
            </div>
          </div>
          <div class="game-card-footer">
            <div class="contributor-meta">
              <div class="contributor-avatar">${game.author.charAt(0).toUpperCase()}</div>
              <div class="contributor-name">
                Dev: <strong>${game.author}</strong>
              </div>
            </div>
            <button class="btn-play-trigger" data-id="${game.id}">${actionText}</button>
          </div>
        </div>
      `;

      const favBtn = card.querySelector(".btn-card-favorite");
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(game.id);
      });

      const playBtn = card.querySelector(".btn-play-trigger");
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openGameModal(game, playBtn);
      });

      // Direct star rating click binding - 100% reliable, never triggers game modal
      const starBtns = card.querySelectorAll(".rate-star-btn");
      starBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const gameId = btn.dataset.game;
          const score = parseInt(btn.dataset.star, 10);
          if (window.GameRatings && gameId && score) {
            window.GameRatings.setGameRating(gameId, score);
            window.GameRatings.updateStarUI(gameId, score);
          }
        });
      });

      // Clicking any empty area of the rating row also stops modal launch
      const ratingRow = card.querySelector(".game-card-rating-row");
      if (ratingRow) {
        ratingRow.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }

      // Only clicking the dedicated Play Now button launches the game modal
      gamesGrid.appendChild(card);
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Modal Handlers
  function openGameModal(game, triggerElement = null) {
    activeGame = game;
    lastFocusedElement = triggerElement || document.activeElement;
    modalGameTitle.textContent = game.title;
    modalGameBadge.textContent = game.category;
    modalGameAuthor.textContent = `Built by @${game.author}`;
    gameIframe.src = game.path;
    newTabBtn.href = game.path;

    updateModalFavoriteButton(isFavorite(game.id));



    // Record game play in Recently Played drawer
    if (window.ArcadeRecent && typeof window.ArcadeRecent.recordPlayed === "function") {
      window.ArcadeRecent.recordPlayed(game.id, game.title, game.category);
    }
    window.dispatchEvent(new CustomEvent("arcadeverse:game-launched", { detail: game }));

    gameModal.classList.add("active");
    gameModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeModalBtn.focus();
  }

  // Expose global helper to open game modal from plugins, search, or recent drawer
  window.openGameModal = openGameModal;
  window.ArcadeApp = {
    openGame: (gameId) => {
      const game = GAMES_REGISTRY.find((g) => g.id === gameId);
      if (game) {
        openGameModal(game);
        return true;
      }
      return false;
    },
    launchRandom: () => {
      launchRandomGame();
    }
  };

  function closeGameModal() {
    activeGame = null;
    gameModal.classList.remove("active");
    gameModal.setAttribute("aria-hidden", "true");
    
    // Safely blank out iframe to prevent audio pops and host page reloading
    try {
      if (gameIframe && gameIframe.contentWindow) {
        gameIframe.contentWindow.location.replace("about:blank");
      } else if (gameIframe) {
        gameIframe.src = "about:blank";
      }
    } catch (e) {
      if (gameIframe) gameIframe.src = "about:blank";
    }

    document.body.style.overflow = "";
    modalWindow.classList.remove("fullscreen");
    if (gameModal) gameModal.classList.remove("fullscreen-mode");
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  closeModalBtn.addEventListener("click", closeGameModal);
  modalOverlay.addEventListener("click", closeGameModal);

  if (modalFavBtn) {
    modalFavBtn.addEventListener("click", () => {
      if (activeGame) {
        toggleFavorite(activeGame.id);
      }
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      if (gameIframe.src) {
        const currentSrc = gameIframe.src;
        gameIframe.src = "";
        setTimeout(() => {
          gameIframe.src = currentSrc;
        }, 50);
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameModal.classList.contains("active")) {
      closeGameModal();
    }
  });

  fullscreenBtn.addEventListener("click", () => {
    const isNowFullscreen = modalWindow.classList.toggle("fullscreen");
    if (gameModal) {
      gameModal.classList.toggle("fullscreen-mode", isNowFullscreen);
    }
    fullscreenBtn.setAttribute("aria-pressed", isNowFullscreen ? "true" : "false");
    fullscreenBtn.title = isNowFullscreen ? "Exit Fullscreen" : "Fullscreen Game";

    // Attempt native HTML5 Fullscreen API for seamless zero-chrome immersion
    if (isNowFullscreen) {
      if (modalWindow.requestFullscreen) {
        modalWindow.requestFullscreen().catch(() => {});
      } else if (modalWindow.webkitRequestFullscreen) {
        modalWindow.webkitRequestFullscreen();
      }
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    }
  });

  // Listen to native fullscreen exit (e.g. user presses Esc in native fullscreen)
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && modalWindow.classList.contains("fullscreen")) {
      modalWindow.classList.remove("fullscreen");
      if (gameModal) gameModal.classList.remove("fullscreen-mode");
      fullscreenBtn.setAttribute("aria-pressed", "false");
      fullscreenBtn.title = "Fullscreen Game";
    }
  });

  // Sort Selector Change
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      renderGames();
    });
  }

  // Filter Search
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderGames();
  });

  const playlistTrigger = document.getElementById("trigger-playlists-btn");
  if (playlistTrigger) {
    playlistTrigger.addEventListener("click", () => {
      if (window.ArcadePlaylists) {
        window.ArcadePlaylists.openDrawer();
      }
    });
  }

  // Listen for filter-playlist event from PlaylistManager
  window.addEventListener("arcadeverse:filter-playlist", (e) => {
    const pl = e.detail;
    if (!pl) return;
    currentCategory = `playlist:${pl.id}`;
    categoryPills.forEach((p) => p.classList.remove("active"));
    if (playlistTrigger) playlistTrigger.classList.add("active");
    renderGames();
  });

  categoryPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      categoryPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.getAttribute("data-category");
      renderGames();
    });
  });

  // Re-sort when a game rating is updated (debounced to preserve click interaction)
  let ratingSortTimer = null;
  window.addEventListener("rating-updated", () => {
    if (currentSort === "rating") {
      clearTimeout(ratingSortTimer);
      ratingSortTimer = setTimeout(() => {
        renderGames();
      }, 700);
    }
  });


  // Web Audio Chiptune SFX for Hero Roulette Launcher
  function playRouletteSfx() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const notes = [330, 440, 554.37, 659.25, 880];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.08, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.09);
      });
    } catch (e) {
      // Audio autoplay policy or browser unavailable - fail silently
    }
  }

  // Hero Section "Surprise Me / Random Game Roulette" Launcher
  const randomGameBtn = document.getElementById("hero-random-game-btn");
  let isRollingRandom = false;

  function launchRandomGame() {
    if (isRollingRandom) return;
    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY) || GAMES_REGISTRY.length === 0) {
      console.warn("GAMES_REGISTRY is not available or empty.");
      return;
    }

    isRollingRandom = true;
    if (randomGameBtn) {
      randomGameBtn.classList.add("is-rolling");
      randomGameBtn.setAttribute("aria-busy", "true");
    }

    playRouletteSfx();

    // 400ms micro-animation for tactile roulette feel
    setTimeout(() => {
      const candidates = GAMES_REGISTRY.filter((g) => g && g.path);
      const pool = candidates.length > 0 ? candidates : GAMES_REGISTRY;
      const picked = pool[Math.floor(Math.random() * pool.length)];

      if (randomGameBtn) {
        randomGameBtn.classList.remove("is-rolling");
        randomGameBtn.setAttribute("aria-busy", "false");
      }
      isRollingRandom = false;

      if (picked) {
        openGameModal(picked, randomGameBtn);
      }
    }, 400);
  }

  if (randomGameBtn) {
    randomGameBtn.addEventListener("click", launchRandomGame);
  }

  // Halloween cards Play Now buttons click handler (delegates to exclusive Halloween bat loader / new tab)
  document.querySelectorAll(".btn-halloween-play").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const gameId = btn.getAttribute("data-game-id");
      if (typeof window.launchHalloweenGame === "function") {
        window.launchHalloweenGame(gameId);
      } else if (typeof GAMES_REGISTRY !== "undefined") {
        const game = GAMES_REGISTRY.find((g) => g.id === gameId);
        if (game) {
          openGameModal(game, btn);
        }
      }
    });
  });

  // Global export
  window.openGameModal = openGameModal;

  // Ensure game modal frame updates aspect ratio dynamically on orientation changes
  window.addEventListener('orientationchange', () => {
    if (gameModal && gameModal.classList.contains('active')) {
      const isFullscreen = modalWindow.classList.contains('fullscreen');
      if (isFullscreen) {
        modalWindow.style.height = (window.innerHeight) + 'px';
      }
    }
  });

  // Track iframe load complete event to remove spinner
  if (gameIframe) {
    gameIframe.addEventListener('load', () => {
      gameIframe.classList.add('loaded');
    });
  }

  // Initial render
  renderGames();
});
