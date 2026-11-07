/**
 * ArcadeVerse Home Hub Engine
 * Handles live games catalog, in-app modal launcher, and category/search filtering
 */

document.addEventListener("DOMContentLoaded", () => {
  const gamesGrid = document.getElementById("games-grid");
  const totalGamesCount = document.getElementById("total-games-count");
  const totalContributorsCount = document.getElementById("total-contributors-count");
  const searchInput = document.getElementById("game-search-input");
  const categoryPills = document.querySelectorAll(".category-pills .pill[data-category]");

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
  const modalFrameWrapper = document.querySelector(".modal-frame-wrapper");
  if (modalFrameWrapper) {
    modalFrameWrapper.classList.add("game-modal-body");
  }
  const sortSelect = document.getElementById("catalog-sort-select");
  const favoritesCountBadge = document.getElementById("favorites-count-badge");
  const modalFavBtn = document.getElementById("modal-fav-btn");
  const modalSoundBtn = document.getElementById("modal-sound-btn");

  let currentCategory = "all";
  let currentDurationFacet = "all";
  let currentControlsFacet = "all";
  let currentLetterFilter = "all";
  let currentTagFilter = "";
  let searchQuery = "";
  let currentSort = "featured";
  let searchDebounceTimer = null;
  const CATALOG_VIEW_STORAGE_KEY = "arcadeverse_catalog_view";
  let currentCatalogView = "grid";
  try {
    const savedView = localStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
    if (savedView === "list" || savedView === "grid") {
      currentCatalogView = savedView;
    }
  } catch (_) {}
  let lastFocusedElement = null;
  let activeGame = null;
  let modalPushedHistory = false;
  let closeAutocomplete = () => {};

  // History API State Synchronization & Deep-Linking Engine
  function syncURLState(push = false) {
    try {
      if (typeof window === "undefined" || !window.history || !window.location) return;
      const url = new URL(window.location.href);

      if (currentCategory && currentCategory.toLowerCase() !== "all") {
        url.searchParams.set("category", currentCategory);
      } else {
        url.searchParams.delete("category");
      }

      if (searchQuery && searchQuery.trim().length > 0) {
        url.searchParams.set("search", searchQuery.trim());
      } else {
        url.searchParams.delete("search");
      }

      if (activeGame && activeGame.id) {
        url.searchParams.set("game", activeGame.id);
      } else {
        url.searchParams.delete("game");
      }

      const stateObj = {
        category: currentCategory,
        search: searchQuery,
        game: activeGame ? activeGame.id : null
      };

      const newUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");

      if (push) {
        window.history.pushState(stateObj, "", newUrl);
      } else {
        window.history.replaceState(stateObj, "", newUrl);
      }
    } catch (_) {
      // Gracefully handle file:// or restricted sandbox origins
    }
  }

  // Search & filter UI element refs
  const searchClearBtn = document.getElementById("search-clear-btn");
  const resultsCountEl = document.getElementById("catalog-results-count");
  const searchTagsRow = document.getElementById("search-tags-row");
  const resetFacetsBtn = document.getElementById("btn-reset-facets");

  // Favorites LocalStorage Engine (Issue #533)
  const FAVORITES_STORAGE_KEY = "av_favorites";
  const LEGACY_FAVORITES_STORAGE_KEY = "arcadeverse_favorite_games";
  const PREFERENCES_FAVORITES_KEY = "arcadeverse:preferences:favorites";

  // Migrate legacy favorite storage keys to primary av_favorites key if needed
  try {
    if (!localStorage.getItem(FAVORITES_STORAGE_KEY)) {
      const legacy = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY) || localStorage.getItem(PREFERENCES_FAVORITES_KEY);
      if (legacy) {
        localStorage.setItem(FAVORITES_STORAGE_KEY, legacy);
      }
    }
  } catch (_) {}

  function getFavorites() {
    try {
      let raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY);
      }
      if (!raw) {
        raw = localStorage.getItem(PREFERENCES_FAVORITES_KEY);
      }
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveFavorites(favSet) {
    const list = Array.from(favSet);
    const serialized = JSON.stringify(list);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, serialized);
      localStorage.setItem(LEGACY_FAVORITES_STORAGE_KEY, serialized);
    } catch (e) {
      console.warn("Could not save favorites to localStorage:", e);
    }
    updateFavoritesBadge();
  }

  function isFavorite(gameId) {
    return getFavorites().has(gameId);
  }

  function updateFavoritesBadge() {
    const favCount = getFavorites().size;
    if (favoritesCountBadge) {
      favoritesCountBadge.textContent = favCount;
      favoritesCountBadge.setAttribute("aria-label", `${favCount} favorite games saved`);
    }
    const mobileFavCount = document.getElementById("mobile-fav-count");
    if (mobileFavCount) {
      mobileFavCount.textContent = favCount;
    }
    updateCategoryPillCounts();
  }

  // Dynamic Category Counters & Real-Time Statistics
  function updateCategoryPillCounts() {
    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return;
    const favs = getFavorites();

    const counts = {
      all: GAMES_REGISTRY.length,
      favorites: favs.size,
      halloween: 0
    };

    GAMES_REGISTRY.forEach((g) => {
      const cat = (g.category || "").toLowerCase();
      if (!counts[cat]) counts[cat] = 0;
      counts[cat]++;

      if (isHalloweenGame(g)) {
        counts.halloween++;
      }
    });

    categoryPills.forEach((pill) => {
      const categoryKey = (pill.getAttribute("data-category") || "").toLowerCase();
      // Favorites pill already has #favorites-count-badge in index.html; keep in sync
      if (categoryKey === "favorites") {
        const badge = pill.querySelector("#favorites-count-badge") || pill.querySelector(".favorites-count-badge");
        if (badge) {
          badge.textContent = counts.favorites;
          badge.setAttribute("aria-label", `${counts.favorites} favorite games saved`);
        }
        return;
      }
      let badge = pill.querySelector(".pill-count-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "pill-count-badge";
        pill.appendChild(badge);
      }
      const countVal = counts[categoryKey] !== undefined ? counts[categoryKey] : 0;
      badge.textContent = countVal;
      badge.setAttribute("aria-label", `${countVal} games available`);
    });
  }

  function updateModalFavoriteButton(fav) {
    if (!modalFavBtn) return;
    modalFavBtn.classList.toggle("favorited", fav);
    modalFavBtn.setAttribute("aria-pressed", fav ? "true" : "false");
    const label = fav ? "Remove from Favorites" : "Save to Favorites";
    modalFavBtn.title = label;
    modalFavBtn.setAttribute("aria-label", label);
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
      const targetCard = gamesGrid.querySelector(`.game-card[data-game-id="${gameId}"]`);
      if (targetCard && !willBeFav) {
        // Find adjacent game card ID for smooth keyboard focus handover
        const cardNodes = Array.from(gamesGrid.querySelectorAll(".game-card:not(.removing-favorite)"));
        const currentIndex = cardNodes.findIndex((c) => c.getAttribute("data-game-id") === gameId);
        let nextFocusGameId = null;
        if (currentIndex !== -1) {
          if (currentIndex < cardNodes.length - 1) {
            nextFocusGameId = cardNodes[currentIndex + 1].getAttribute("data-game-id");
          } else if (currentIndex > 0) {
            nextFocusGameId = cardNodes[currentIndex - 1].getAttribute("data-game-id");
          }
        }

        // Immediately update button style inside the card
        const cardBtn = targetCard.querySelector(".btn-card-favorite");
        if (cardBtn) {
          cardBtn.classList.remove("favorited");
          cardBtn.setAttribute("aria-pressed", "false");
          cardBtn.title = "Save to Favorites";
          cardBtn.setAttribute("aria-label", "Save to Favorites");
        }

        // Trigger smooth CSS removal animation
        targetCard.classList.add("removing-favorite");

        // Update live results count header immediately
        updateResultsCount(favs.size);

        setTimeout(() => {
          if (targetCard.parentNode) {
            targetCard.remove();
          }
          if (favs.size === 0) {
            renderGames();
            const resetBtn = document.getElementById("reset-filter-btn");
            if (resetBtn) resetBtn.focus();
          } else if (nextFocusGameId) {
            const nextBtn = gamesGrid.querySelector(`.btn-card-favorite[data-id="${nextFocusGameId}"]`);
            if (nextBtn) nextBtn.focus();
          }
        }, 300);
      } else {
        renderGames();
      }
    } else {
      const cardBtns = document.querySelectorAll(`.btn-card-favorite[data-id="${gameId}"]`);
      cardBtns.forEach((cardBtn) => {
        cardBtn.classList.toggle("favorited", willBeFav);
        cardBtn.setAttribute("aria-pressed", willBeFav ? "true" : "false");
        const label = willBeFav ? "Remove from Favorites" : "Save to Favorites";
        cardBtn.title = label;
        cardBtn.setAttribute("aria-label", label);
      });
    }

    if (activeGame && activeGame.id === gameId) {
      updateModalFavoriteButton(willBeFav);
    }

    window.dispatchEvent(new CustomEvent("arcadeverse:favorites-updated", {
      detail: { gameId, isFavorite: willBeFav, favorites: Array.from(favs), count: favs.size }
    }));
  }

  // Cross-tab real-time favorites synchronization
  window.addEventListener("storage", (e) => {
    if (e.key === FAVORITES_STORAGE_KEY || e.key === LEGACY_FAVORITES_STORAGE_KEY || e.key === PREFERENCES_FAVORITES_KEY) {
      updateFavoritesBadge();
      if (currentCategory === "favorites") {
        renderGames();
      } else {
        const favs = getFavorites();
        document.querySelectorAll(".btn-card-favorite").forEach((btn) => {
          const id = btn.getAttribute("data-id");
          const isFav = favs.has(id);
          btn.classList.toggle("favorited", isFav);
          btn.setAttribute("aria-pressed", isFav ? "true" : "false");
          const label = isFav ? "Remove from Favorites" : "Save to Favorites";
          btn.title = label;
          btn.setAttribute("aria-label", label);
        });
      }
      if (activeGame) {
        updateModalFavoriteButton(isFavorite(activeGame.id));
      }
    }
  });

  // Levenshtein / Fuzzy Match Engine for Smart Suggestions
  function getSmartSuggestions(query, category) {
    if (!query || typeof GAMES_REGISTRY === "undefined") {
      // Suggest popular categories if no query was typed but category has 0
      return ["All", "Arcade", "Puzzle", "Retro", "Action"];
    }

    const q = query.toLowerCase().trim();
    const candidatePool = new Set();

    // Populate candidate tokens from categories, titles, authors, and tags
    GAMES_REGISTRY.forEach(g => {
      if (g.category) candidatePool.add(g.category);
      if (g.tags && Array.isArray(g.tags)) {
        g.tags.forEach(t => candidatePool.add(t));
      }
      if (g.title) {
        g.title.split(/\s+/).forEach(word => {
          const clean = word.replace(/[^a-zA-Z0-9]/g, "");
          if (clean.length >= 3) candidatePool.add(clean);
        });
      }
    });

    // Score candidates based on prefix match, substring match, and Levenshtein distance
    const scored = [];
    candidatePool.forEach(term => {
      const t = term.toLowerCase();
      if (t === q) return;

      let score = 0;
      if (t.startsWith(q)) {
        score = 100 - (t.length - q.length);
      } else if (t.includes(q)) {
        score = 80 - (t.length - q.length);
      } else if (q.includes(t)) {
        score = 70;
      } else {
        const dist = levenshteinDistance(q, t);
        if (dist <= 2 && q.length >= 3) {
          score = 60 - dist * 15;
        } else if (dist <= 3 && q.length >= 5) {
          score = 40 - dist * 10;
        }
      }

      if (score > 0) {
        scored.push({ term, score });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    const topPicks = scored.slice(0, 4).map(s => s.term);

    if (topPicks.length === 0) {
      return ["Puzzle", "Arcade", "Retro", "Halloween"];
    }
    return topPicks;
  }

  function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // Lightweight fuzzy matching (Levenshtein distance <= 2) for game titles and tags
  function matchesFuzzyLevenshtein(item, query) {
    if (!item || !query) return false;
    const clean = query.replace(/^by\s+@?/, "").replace(/^@/, "").trim().toLowerCase();
    if (clean.length < 3) return false;

    const qWords = clean.split(/\s+/).filter(Boolean);
    if (qWords.length === 0) return false;

    const titleLower = (item.title || "").toLowerCase();
    const titleWords = titleLower.split(/[\s\-:_]+/);
    const tagsLower = Array.isArray(item.tags) ? item.tags.map((t) => t.toLowerCase()) : [];

    return qWords.every((qWord) => {
      if (qWord.length < 3) {
        return titleLower.includes(qWord) || tagsLower.some((t) => t.includes(qWord));
      }

      // Check full title match
      if (Math.abs(titleLower.length - qWord.length) <= 2 && levenshteinDistance(qWord, titleLower) <= 2) {
        return true;
      }

      // Check title individual words
      for (const w of titleWords) {
        if (w.includes(qWord) || (Math.abs(w.length - qWord.length) <= 2 && levenshteinDistance(qWord, w) <= 2)) {
          return true;
        }
      }

      // Check tags (full tag or individual tag tokens)
      for (const t of tagsLower) {
        if (t.includes(qWord) || (Math.abs(t.length - qWord.length) <= 2 && levenshteinDistance(qWord, t) <= 2)) {
          return true;
        }
        const tWords = t.split(/[\s\-:_]+/);
        for (const tw of tWords) {
          if (tw.includes(qWord) || (Math.abs(tw.length - qWord.length) <= 2 && levenshteinDistance(qWord, tw) <= 2)) {
            return true;
          }
        }
      }

      return false;
    });
  }

  // Update Stats
  if (totalGamesCount) totalGamesCount.textContent = GAMES_REGISTRY.length;
  if (totalContributorsCount) totalContributorsCount.textContent = CONTRIBUTORS_REGISTRY.length;
  updateFavoritesBadge();

  // Render Games
  
  // --- Facet Filter Summary Indicator Engine ---
  function updateFacetSummaryUI() {
    const summaryContainer = document.getElementById("active-filters-summary");
    if (!summaryContainer) return;

    const activeTags = [];
    if (currentDurationFacet !== "all") {
      activeTags.push({ label: 'Duration: ' + currentDurationFacet, type: 'duration' });
    }
    if (currentControlsFacet !== "all") {
      activeTags.push({ label: 'Controls: ' + currentControlsFacet, type: 'controls' });
    }
    if (currentCategory !== "all") {
      activeTags.push({ label: 'Category: ' + currentCategory, type: 'category' });
    }
    if (currentLetterFilter !== "all") {
      activeTags.push({ label: 'Letter: ' + currentLetterFilter, type: 'letter' });
    }

    if (activeTags.length === 0) {
      summaryContainer.style.display = "none";
      summaryContainer.innerHTML = "";
    } else {
      summaryContainer.style.display = "flex";
      summaryContainer.innerHTML = '<span style="font-weight: 600;">Active Filters:</span>' +
        activeTags.map(t => `<span class="active-filter-tag">${t.label}</span>`).join('');
    }
  }

  // --- Build Dynamic Tag Chips from Registry Metadata ---
  function buildTagChips() {
    if (!searchTagsRow) return;
    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return;

    // Collect all unique tags, excluding generic/noisy ones
    const EXCLUDED = new Set(["nsoc26", "NSOC26", "html5-canvas", "html5"]);
    const tagFreq = {};
    GAMES_REGISTRY.forEach((g) => {
      if (!Array.isArray(g.tags)) return;
      g.tags.forEach((t) => {
        const normalized = t.trim();
        if (!normalized || EXCLUDED.has(normalized.toLowerCase())) return;
        const key = normalized.toLowerCase();
        tagFreq[key] = (tagFreq[key] || 0) + 1;
      });
    });

    // Keep top 10 most-used tags
    const topTags = Object.entries(tagFreq)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag.charAt(0).toUpperCase() + tag.slice(1));

    if (topTags.length === 0) {
      searchTagsRow.innerHTML = "";
      return;
    }

    const label = document.createElement("span");
    label.className = "tag-filter-label";
    label.textContent = "Tags:";
    searchTagsRow.innerHTML = "";
    searchTagsRow.appendChild(label);

    topTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-filter-chip" + (currentTagFilter === tag.toLowerCase() ? " active" : "");
      btn.textContent = tag;
      btn.setAttribute("aria-pressed", currentTagFilter === tag.toLowerCase() ? "true" : "false");
      btn.addEventListener("click", () => {
        if (currentTagFilter === tag.toLowerCase()) {
          currentTagFilter = "";
        } else {
          currentTagFilter = tag.toLowerCase();
        }
        buildTagChips();
        renderGames();
      });
      searchTagsRow.appendChild(btn);
    });

    // Add a clear-tag button if a tag is active
    if (currentTagFilter) {
      const clearTag = document.createElement("button");
      clearTag.type = "button";
      clearTag.className = "tag-filter-clear";
      clearTag.setAttribute("aria-label", "Clear tag filter");
      clearTag.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Clear tag`;
      clearTag.addEventListener("click", () => {
        currentTagFilter = "";
        buildTagChips();
        renderGames();
      });
      searchTagsRow.appendChild(clearTag);
    }
  }

  // --- Live Results Count ---
  function updateResultsCount(count, isFuzzy = false) {
    if (!resultsCountEl) return;
    const total = (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) ? GAMES_REGISTRY.length : 0;
    const isFiltered = searchQuery || currentCategory !== "all" || currentDurationFacet !== "all" || currentControlsFacet !== "all" || currentTagFilter;
    if (isFuzzy && searchQuery) {
      resultsCountEl.textContent = `${count} close match${count !== 1 ? "es" : ""} found for "${searchQuery}"`;
      resultsCountEl.style.display = "";
    } else if (isFiltered) {
      resultsCountEl.textContent = `${count} of ${total} game${total !== 1 ? "s" : ""} match`;
      resultsCountEl.style.display = "";
    } else {
      resultsCountEl.textContent = `${total} game${total !== 1 ? "s" : ""} available`;
      resultsCountEl.style.display = "";
    }
  }

  
  // Helper to identify Halloween Special Games
  function isHalloweenGame(g) {
    if (!g) return false;
    const id = (g.id || "").toLowerCase();
    const title = (g.title || "").toLowerCase();
    const cat = (g.category || "").toLowerCase();
    const tags = Array.isArray(g.tags) ? g.tags.map((t) => t.toLowerCase()) : [];
    return (
      tags.includes("halloween") ||
      cat.includes("horror") ||
      title.includes("halloween") ||
      id.includes("haunted") ||
      id.includes("escape-room") ||
      id.includes("island-survival") ||
      id.includes("midnight-graveyard") ||
      id.includes("pumpkin-express")
    );
  }

  function renderGames() {
    gamesGrid.innerHTML = "";
    gamesGrid.classList.toggle("view-list", currentCatalogView === "list");
    const favs = getFavorites();

    const currentDataSet = GAMES_REGISTRY;

    const facetMatched = currentDataSet.filter((item) => {
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
          matchesCategory = isHalloweenGame(item);
        } else {
          matchesCategory = item.category.toLowerCase() === currentCategory.toLowerCase();
        }
      }

      // Tag Facet Filter
      let matchesTag = true;
      if (currentTagFilter) {
        matchesTag = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase() === currentTagFilter);
      }

      // Duration Facet Evaluation
      let matchesDuration = true;
      if (currentDurationFacet !== "all") {
        const text = (item.title + " " + item.category + " " + (item.description || "") + " " + (item.tags || []).join(" ")).toLowerCase();
        const isDeep = text.includes("adventure") || text.includes("rpg") || text.includes("story") || text.includes("survival") || text.includes("mystery") || text.includes("strategy") || text.includes("defense") || text.includes("roguelike") || text.includes("escape") || text.includes("horror");
        const isQuick = text.includes("fast") || text.includes("quick") || text.includes("reflex") || text.includes("speed") || text.includes("endless") || text.includes("runner") || text.includes("jumper") || text.includes("click") || text.includes("burst") || text.includes("whack") || text.includes("typing") || text.includes("breakout") || text.includes("tetris") || text.includes("snake") || text.includes("fall");

        if (currentDurationFacet === "quick") {
          matchesDuration = isQuick && !isDeep;
        } else if (currentDurationFacet === "long") {
          matchesDuration = isDeep;
        } else if (currentDurationFacet === "medium") {
          matchesDuration = (!isDeep && !isQuick) || (isDeep && isQuick) || text.includes("puzzle") || text.includes("logic") || text.includes("arcade");
        }
      }

      // Control Scheme Facet Evaluation
      let matchesControls = true;
      if (currentControlsFacet !== "all") {
        const text = (item.title + " " + item.category + " " + (item.description || "") + " " + (item.tags || []).join(" ")).toLowerCase();
        if (currentControlsFacet === "keyboard") {
          matchesControls = text.includes("keyboard") || text.includes("wasd") || text.includes("arrow") || text.includes("typing") || text.includes("runner") || text.includes("shooter") || text.includes("snake") || text.includes("space") || text.includes("racer") || text.includes("arcade") || text.includes("platformer") || text.includes("action");
        } else if (currentControlsFacet === "mouse") {
          matchesControls = text.includes("mouse") || text.includes("click") || text.includes("drag") || text.includes("puzzle") || text.includes("cards") || text.includes("minesweeper") || text.includes("point & click") || text.includes("burst") || text.includes("aim") || text.includes("slicing") || text.includes("wordle") || text.includes("connect");
        } else if (currentControlsFacet === "touch") {
          matchesControls = item.responsive === true || text.includes("touch") || text.includes("mobile") || text.includes("casual") || text.includes("swipe") || text.includes("click") || text.includes("tap") || text.includes("puzzle") || text.includes("memory") || text.includes("runner");
        }
      }

      // A-Z Alphabetical Title Jump Filter
      let matchesLetter = true;
      if (currentLetterFilter && currentLetterFilter !== "all") {
        const firstChar = item.title.trim().charAt(0).toUpperCase();
        if (currentLetterFilter === "#") {
          matchesLetter = !/[A-Z]/.test(firstChar);
        } else {
          matchesLetter = firstChar === currentLetterFilter;
        }
      }

      return matchesCategory && matchesTag && matchesDuration && matchesControls && matchesLetter;
    });

    const cleanSearch = searchQuery.replace(/^by\s+@?/, "").replace(/^@/, "").trim();
    const matchesExactSearch = (item) => {
      if (!searchQuery) return true;
      return (
        item.title.toLowerCase().includes(searchQuery) ||
        (item.description && item.description.toLowerCase().includes(searchQuery)) ||
        (item.author && item.author.toLowerCase().includes(searchQuery)) ||
        (cleanSearch && item.author && item.author.toLowerCase().includes(cleanSearch)) ||
        (item.github && item.github.toLowerCase().includes(searchQuery)) ||
        (cleanSearch && item.github && item.github.toLowerCase().includes(cleanSearch)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery)))
      );
    };

    let filtered = facetMatched.filter(matchesExactSearch);
    let isFuzzyFallback = false;

    // Fallback: If exact matches are empty and search query is at least 3 chars, match using Levenshtein distance <= 2 on titles and tags
    if (filtered.length === 0 && searchQuery && searchQuery.length >= 3) {
      filtered = facetMatched.filter((item) => matchesFuzzyLevenshtein(item, searchQuery));
      if (filtered.length > 0) {
        isFuzzyFallback = true;
      }
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      if (currentSort === "az") {
        return a.title.localeCompare(b.title);
      } else if (currentSort === "za") {
        return b.title.localeCompare(a.title);
      } else if (currentSort === "rating") {
        const rA = (window.GameRatings && window.GameRatings.ratings[a.id]) || (a.stars ? (a.stars / 10) : 5.0);
        const rB = (window.GameRatings && window.GameRatings.ratings[b.id]) || (b.stars ? (b.stars / 10) : 5.0);
        if (rB !== rA) return rB - rA;
        return a.title.localeCompare(b.title);
      } else if (currentSort === "newest") {
        const timeA = getGameReleaseTime(a);
        const timeB = getGameReleaseTime(b);
        if (timeB !== timeA) return timeB - timeA;
        return a.title.localeCompare(b.title);
      } else if (currentSort === "difficulty") {
        const diffA = getDifficultyRank(a);
        const diffB = getDifficultyRank(b);
        if (diffA !== diffB) return diffA - diffB;
        return a.title.localeCompare(b.title);
      } else if (currentSort === "difficulty-desc") {
        const diffA = getDifficultyRank(a);
        const diffB = getDifficultyRank(b);
        if (diffB !== diffA) return diffB - diffA;
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

    // Handle Empty State with Fuzzy Smart Suggestions
    if (filtered.length === 0) {
      updateResultsCount(0);
      const emptyCard = document.createElement("div");
      emptyCard.className = "catalog-empty-state retro-arcade-terminal";

      if (currentCategory === "favorites") {
        if (favs.size === 0) {
          emptyCard.innerHTML = `
            <div class="retro-terminal-screen">
              <div class="retro-terminal-scanlines" aria-hidden="true"></div>
              <div class="retro-terminal-header">
                <div class="retro-terminal-dots" aria-hidden="true">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                </div>
                <span class="retro-terminal-badge">ARCADE-OS // FAVORITES</span>
                <span class="retro-terminal-tag">STATUS: EMPTY_VAULT</span>
              </div>
              <div class="retro-terminal-body">
                <div class="empty-state-icon" style="color: #f43f5e;"><i data-lucide="heart-crack"></i></div>
                <h3 class="empty-state-title">No Favorite Games Saved Yet</h3>
                <p class="empty-state-desc">
                  You haven't bookmarked any games yet! Click the heart icon on any game card in the catalog to add it to your personal favorites collection.
                </p>
                <div class="empty-state-actions">
                  <button type="button" class="btn btn-primary btn-sm btn-reset-filters" id="reset-filter-btn">
                    <span><i data-lucide="gamepad-2"></i> Browse All Games</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        } else {
          emptyCard.innerHTML = `
            <div class="retro-terminal-screen">
              <div class="retro-terminal-scanlines" aria-hidden="true"></div>
              <div class="retro-terminal-header">
                <div class="retro-terminal-dots" aria-hidden="true">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                </div>
                <span class="retro-terminal-badge">ARCADE-OS // FAVORITES</span>
                <span class="retro-terminal-tag">STATUS: 0 MATCHES</span>
              </div>
              <div class="retro-terminal-body">
                <div class="empty-state-icon" style="color: #f43f5e;"><i data-lucide="search-x"></i></div>
                <h3 class="empty-state-title">No Matching Favorites Found</h3>
                <p class="empty-state-desc">
                  None of your ${favs.size} saved favorite games match the current search query or active facet filters.
                </p>
                <div class="empty-state-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="clear-fav-search-btn">
                    <span><i data-lucide="rotate-ccw"></i> Show All Favorites (${favs.size})</span>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm btn-reset-filters" id="reset-filter-btn">
                    <span><i data-lucide="gamepad-2"></i> Browse All Games</span>
                  </button>
                </div>
              </div>
            </div>
          `;
          const clearFavBtn = emptyCard.querySelector("#clear-fav-search-btn");
          if (clearFavBtn) {
            clearFavBtn.addEventListener("click", () => {
              searchQuery = "";
              currentTagFilter = "";
              currentDurationFacet = "all";
              currentControlsFacet = "all";
              currentLetterFilter = "all";
              resetLetterFilterUI();
              if (searchInput) searchInput.value = "";
              if (searchClearBtn) searchClearBtn.hidden = true;
              closeAutocomplete();
              const durationChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
              durationChips.forEach((c) => {
                if (c.getAttribute("data-duration") === "all") c.classList.add("active");
                else c.classList.remove("active");
              });
              const controlChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
              controlChips.forEach((c) => {
                if (c.getAttribute("data-controls") === "all") c.classList.add("active");
                else c.classList.remove("active");
              });
              renderGames();
            });
          }
        }
      } else {
        // Compute smart suggestions based on query and available game categories/tags
        const suggestions = getSmartSuggestions(searchQuery, currentCategory);
        let suggestionsHtml = "";
        if (suggestions.length > 0) {
          suggestionsHtml = `
            <div class="smart-tag-suggestions">
              <span class="smart-suggestions-label">Did you mean:</span>
              <div class="smart-suggestions-list">
                ${suggestions.map(s => `<button type="button" class="smart-suggestion-chip" data-suggestion="${s}">${s}</button>`).join('')}
              </div>
            </div>
          `;
        }

        emptyCard.innerHTML = `
          <div class="retro-terminal-screen">
            <div class="retro-terminal-scanlines" aria-hidden="true"></div>
            <div class="retro-terminal-header">
              <div class="retro-terminal-dots" aria-hidden="true">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>
              <span class="retro-terminal-badge">ARCADE-OS // SYSTEM STATUS</span>
              <span class="retro-terminal-tag">STATUS: 0 MATCHES</span>
            </div>
            <div class="retro-terminal-body">
              <div class="arcade-joystick-graphic" aria-hidden="true">
                <svg class="retro-joystick-svg" viewBox="0 0 120 120" width="110" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="retroJoystickBallGlow" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stop-color="#ff7694" />
                      <stop offset="55%" stop-color="#f43f5e" />
                      <stop offset="100%" stop-color="#9f1239" />
                    </radialGradient>
                    <linearGradient id="retroJoystickShaft" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#cbd5e1" />
                      <stop offset="45%" stop-color="#f8fafc" />
                      <stop offset="100%" stop-color="#64748b" />
                    </linearGradient>
                    <linearGradient id="retroTerminalDeck" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#1e293b" />
                      <stop offset="100%" stop-color="#0f172a" />
                    </linearGradient>
                  </defs>
                  <!-- Arcade Control Deck Base -->
                  <rect x="10" y="76" width="100" height="34" rx="8" fill="url(#retroTerminalDeck)" stroke="#00f3ff" stroke-width="2" stroke-opacity="0.6" />
                  <line x1="16" y1="84" x2="104" y2="84" stroke="#00f3ff" stroke-opacity="0.25" stroke-dasharray="2 3" />
                  <!-- Screws / Rivets on Deck -->
                  <circle cx="16" cy="82" r="1.5" fill="#64748b" />
                  <circle cx="104" cy="82" r="1.5" fill="#64748b" />
                  <circle cx="16" cy="102" r="1.5" fill="#64748b" />
                  <circle cx="104" cy="102" r="1.5" fill="#64748b" />
                  <!-- Action Buttons on Right -->
                  <ellipse cx="80" cy="94" rx="6.5" ry="4.5" fill="#0891b2" stroke="#00f3ff" stroke-width="1.5" />
                  <ellipse cx="80" cy="92.5" rx="4.5" ry="2.8" fill="#22d3ee" />
                  <ellipse cx="96" cy="88" rx="6.5" ry="4.5" fill="#d97706" stroke="#fbbf24" stroke-width="1.5" />
                  <ellipse cx="96" cy="86.5" rx="4.5" ry="2.8" fill="#fde047" />
                  <!-- Joystick Washer / Dust Bezel -->
                  <ellipse cx="44" cy="84" rx="18" ry="7" fill="#020617" stroke="#334155" stroke-width="2" />
                  <ellipse cx="44" cy="84" rx="12" ry="4.5" fill="#0f172a" stroke="#00f3ff" stroke-width="1" stroke-opacity="0.4" />
                  <!-- Joystick Shaft / Stick -->
                  <path d="M41 82 L42 42 L46 42 L47 82 Z" fill="url(#retroJoystickShaft)" stroke="#475569" stroke-width="0.5" />
                  <!-- Joystick Ball Top Knob -->
                  <circle cx="44" cy="34" r="15" fill="url(#retroJoystickBallGlow)" />
                  <ellipse cx="39" cy="29" rx="4" ry="2.5" fill="#ffffff" opacity="0.65" transform="rotate(-30 39 29)" />
                </svg>
              </div>
              <h3 class="empty-state-title">No Games Found</h3>
              <p class="empty-state-desc">
                ${searchQuery ? `We couldn't find any games matching "${searchQuery}". Try exploring related categories or resetting all active filters.` : `No games matched the current filter combination. Reset your filters to explore the entire ArcadeVerse collection.`}
              </p>
              ${suggestionsHtml}
              <div class="empty-state-actions">
                <button type="button" class="btn btn-primary btn-reset-filters" id="reset-filter-btn" aria-label="Reset All Filters">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align: -2px; margin-right: 6px;">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  <span>Reset All Filters</span>
                </button>
                <a href="https://github.com/DebasmitaBose0/ArcadeVerse/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align: -2px; margin-right: 4px;">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                    <path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"/>
                  </svg>
                  <span>Build a Game</span>
                </a>
              </div>
            </div>
          </div>
        `;
      }

      // Category, search, and letter filter text come from the user, so set them as text, not markup.
      const emptyTitle = emptyCard.querySelector(".empty-state-title");
      if (emptyTitle && currentCategory !== "favorites") {
        if (searchQuery) {
          emptyTitle.textContent = `No games found matching "${searchQuery}"`;
        } else if (currentLetterFilter !== "all" && currentCategory === "all") {
          emptyTitle.textContent = `No games found starting with "${currentLetterFilter}"`;
        } else if (currentLetterFilter !== "all" && currentCategory !== "all") {
          emptyTitle.textContent = `No games found in "${currentCategory}" starting with "${currentLetterFilter}"`;
        } else if (currentCategory !== "all") {
          emptyTitle.textContent = `No games found in "${currentCategory}" category`;
        } else if (currentDurationFacet !== "all" || currentControlsFacet !== "all" || currentTagFilter) {
          emptyTitle.textContent = "No Games Found for Active Filters";
        } else {
          emptyTitle.textContent = "No Games Found";
        }
      }

      // Comprehensive Reset All Filters handler that instantly restores the full catalog
      function resetAllCatalogFilters() {
        searchQuery = "";
        currentCategory = "all";
        currentTagFilter = "";
        currentLetterFilter = "all";
        currentDurationFacet = "all";
        currentControlsFacet = "all";
        if (typeof resetLetterFilterUI === "function") {
          resetLetterFilterUI();
        }
        if (searchInput) searchInput.value = "";
        if (searchClearBtn) searchClearBtn.hidden = true;
        closeAutocomplete();
        categoryPills.forEach((p) => {
          const isAll = p.getAttribute("data-category") === "all";
          p.classList.toggle("active", isAll);
          p.setAttribute("aria-selected", isAll ? "true" : "false");
        });
        const durationChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
        durationChips.forEach((c) => {
          c.classList.toggle("active", c.getAttribute("data-duration") === "all");
        });
        const controlChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
        controlChips.forEach((c) => {
          c.classList.toggle("active", c.getAttribute("data-controls") === "all");
        });
        if (typeof buildTagChips === "function") {
          buildTagChips();
        }
        renderGames();
        syncURLState(false);
      }

      // Attach reset listener to all reset buttons in empty state
      emptyCard.querySelectorAll("#reset-filter-btn, #reset-all-filters-btn, .btn-reset-filters").forEach((btn) => {
        btn.addEventListener("click", resetAllCatalogFilters);
      });

      // Bind smart suggestion chip clicks
      emptyCard.querySelectorAll(".smart-suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const sug = chip.getAttribute("data-suggestion");
          if (sug) {
            // Check if suggestion is a category
            const matchingPill = Array.from(categoryPills).find(p => p.getAttribute("data-category").toLowerCase() === sug.toLowerCase());
            if (matchingPill) {
              categoryPills.forEach(p => p.classList.remove("active"));
              matchingPill.classList.add("active");
              currentCategory = matchingPill.getAttribute("data-category");
              searchQuery = "";
              if (searchInput) searchInput.value = "";
            } else {
              searchQuery = sug.toLowerCase();
              if (searchInput) searchInput.value = sug;
            }
            closeAutocomplete();
            renderGames();
            syncURLState(false);
          }
        });
      });

      gamesGrid.appendChild(emptyCard);
      if (window.lucide) lucide.createIcons();
      return;
    }

    updateResultsCount(filtered.length, isFuzzyFallback);
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

      const isHalloween = isHalloweenGame(game);
      const halloweenBadgeHtml = isHalloween ? `
        <span class="badge-halloween-special" title="Halloween Special Games">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4c-1.5 0-3 1.2-3 2.5 0 .5.2 1 .5 1.5C6 9 4 11 4 14c0 3.5 3 6 8 6s8-2.5 8-6c0-3-2-5-5.5-6 .3-.5.5-1 .5-1.5 0-1.3-1.5-2.5-3-2.5z"/>
          </svg>
          Halloween Special Games
        </span>
      ` : "";
      const halloweenTitleBadge = isHalloween ? `<span class="halloween-title-badge" title="Halloween Special Games">Halloween Special Games</span>` : "";

      card.innerHTML = `
        <div class="game-card-preview">
          <span class="game-category-tag">${game.category}</span>
          ${halloweenBadgeHtml}
          <button class="btn-card-favorite ${favorited ? "favorited" : ""}" data-id="${game.id}" aria-label="${favorited ? "Remove from Favorites" : "Save to Favorites"}" aria-pressed="${favorited ? "true" : "false"}" title="${favorited ? "Remove from Favorites" : "Save to Favorites"}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fav-heart-icon">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </button>
          <div class="game-icon">${iconHtml}</div>
        </div>
        <div class="game-card-body">
          <h3 class="game-card-title">${game.title}${halloweenTitleBadge}</h3>
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
              <div class="contributor-avatar">${(game.author || game.github || "A").charAt(0).toUpperCase()}</div>
              <div class="contributor-name">
                <button type="button" class="author-filter-btn" data-author="${game.author || game.github}" title="Filter games by ${game.author || game.github}" aria-label="Filter games by author ${game.author || game.github}">by @${game.github || game.author}</button>
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

      // Direct author handle click filter
      const authorBtn = card.querySelector(".author-filter-btn");
      if (authorBtn) {
        authorBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const author = authorBtn.getAttribute("data-author") || game.author || game.github;
          if (searchInput) {
            if (currentCategory !== "all") {
              currentCategory = "all";
              categoryPills.forEach((p) => {
                const isAll = p.getAttribute("data-category") === "all";
                p.classList.toggle("active", isAll);
                p.setAttribute("aria-selected", isAll ? "true" : "false");
              });
            }
            if (currentLetterFilter !== "all") {
              currentLetterFilter = "all";
              if (typeof resetLetterFilterUI === "function") {
                resetLetterFilterUI();
              }
            }
            currentDurationFacet = "all";
            currentControlsFacet = "all";
            currentTagFilter = "";
            const durationChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
            durationChips.forEach((c) => c.classList.toggle("active", c.getAttribute("data-duration") === "all"));
            const controlsChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
            controlsChips.forEach((c) => c.classList.toggle("active", c.getAttribute("data-controls") === "all"));

            searchInput.value = author;
            searchInput.dispatchEvent(new Event("input", { bubbles: true }));
            closeAutocomplete();
            setTimeout(closeAutocomplete, 50);
          }
          const catalogEl = document.getElementById("games-catalog") || document.getElementById("games");
          if (catalogEl) {
            catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }

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
    updateFacetSummaryUI();
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Global modal state variables
  let iframeLoadTimeout = null;
  let iframeLoadSucceeded = false;

  function resetIframeBoundary() {
    if (iframeLoadTimeout) {
      clearTimeout(iframeLoadTimeout);
      iframeLoadTimeout = null;
    }
    const existingError = document.getElementById("modal-error-boundary");
    if (existingError) existingError.remove();
    if (gameIframe) gameIframe.style.display = "block";
  }

  function triggerModalErrorBoundary(gameObj) {
    if (iframeLoadSucceeded) return;
    if (gameIframe) gameIframe.style.display = "none";
    let errorBoundary = document.getElementById("modal-error-boundary");
    if (!errorBoundary) {
      errorBoundary = document.createElement("div");
      errorBoundary.id = "modal-error-boundary";
      errorBoundary.className = "modal-error-boundary";
      const frameWrap = document.querySelector(".modal-frame-wrapper");
      if (frameWrap) frameWrap.appendChild(errorBoundary);
    }

    errorBoundary.innerHTML = `
      <div class="boundary-content">
        <div class="boundary-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ff0055" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 class="boundary-title">Game Route Offline</h3>
        <p class="boundary-desc">
          Failed to establish connection to <code>${(gameObj && gameObj.path) || 'game route'}</code>. The game entrypoint may be undergoing maintenance, corrupted, or unreachable.
        </p>
        <div class="boundary-actions">
          <button class="btn btn-primary btn-sm" id="boundary-retry-btn">
            <span>Retry Load</span>
          </button>
          <a href="https://github.com/DebasmitaBose0/ArcadeVerse/issues/new" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
            <span>Report Broken Route</span>
          </a>
        </div>
      </div>
    `;

    const retryBtn = errorBoundary.querySelector("#boundary-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        resetIframeBoundary();
        iframeLoadSucceeded = false;
        if (gameIframe && gameObj) {
          gameIframe.src = gameObj.path;
          startIframeTimeout(gameObj);
        }
      });
    }
  }

  function startIframeTimeout(gameObj) {
    resetIframeBoundary();
    iframeLoadSucceeded = false;
    // Generous timeout (15s) to account for resource-heavy games or slower network environments
    iframeLoadTimeout = setTimeout(() => {
      if (!iframeLoadSucceeded) {
        triggerModalErrorBoundary(gameObj);
      }
    }, 15000);
  }

  // Bind iframe load listener once at root level to ensure 100% reliable load detection
  if (gameIframe) {
    gameIframe.addEventListener("load", () => {
      // Ignore blanking resets
      if (!gameIframe.src || gameIframe.src.includes("about:blank")) return;

      iframeLoadSucceeded = true;
      resetIframeBoundary();
      gameIframe.classList.add("loaded");
      guardIframeTouchInteractions();

      try {
        if (window.SoundEngine && typeof window.SoundEngine.broadcastAudioConfig === "function") {
          window.SoundEngine.broadcastAudioConfig();
        } else {
          const isMuted = localStorage.getItem("arcadeverse_muted") === "true";
          const masterVol = parseFloat(localStorage.getItem("arcadeverse_master_volume")) || 0.28;
          if (gameIframe.contentWindow) {
            gameIframe.contentWindow.postMessage({
              type: "ARCADEVERSE_AUDIO_CONFIG",
              muted: isMuted,
              volume: masterVol
            }, "*");
          }
        }
      } catch (_) {}
    });

    gameIframe.addEventListener("error", () => {
      iframeLoadSucceeded = false;
      if (activeGame) {
        triggerModalErrorBoundary(activeGame);
      }
    });
  }

  // Modal Handlers
  function openGameModal(game, triggerElement = null, isDirectDeepLink = false) {
    activeGame = game;
    lastFocusedElement = triggerElement || document.activeElement;

    // Trigger bat animation if launching a Halloween Special Game
    if (isHalloweenGame(game) && typeof window.triggerHalloweenBatAnimation === "function") {
      window.triggerHalloweenBatAnimation(game);
    }

    modalGameTitle.textContent = game.title;
    modalGameBadge.textContent = game.category;
    modalGameAuthor.textContent = `Built by @${game.author}`;
    startIframeTimeout(game);
    gameIframe.src = game.path;
    newTabBtn.href = game.path;

    updateModalFavoriteButton(isFavorite(game.id));
    if (window.SoundEngine && typeof window.SoundEngine.updateUI === "function") {
      window.SoundEngine.updateUI();
    }

    // Record game play in Recently Played drawer
    if (window.ArcadeRecent && typeof window.ArcadeRecent.recordPlayed === "function") {
      window.ArcadeRecent.recordPlayed(game.id, game.title, game.category);
    }
    window.dispatchEvent(new CustomEvent("arcadeverse:game-launched", { detail: game }));

    gameModal.classList.add("active");
    gameModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    closeModalBtn.focus();

    if (!isDirectDeepLink) {
      modalPushedHistory = true;
      syncURLState(true);
    } else {
      modalPushedHistory = false;
      syncURLState(false);
    }
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
    },
    filterFavorites: () => {
      categoryPills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      const favPill = document.querySelector('.category-pills .pill[data-category="favorites"]');
      if (favPill) {
        favPill.classList.add("active");
        favPill.setAttribute("aria-selected", "true");
      }
      currentCategory = "favorites";
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      if (searchClearBtn) searchClearBtn.hidden = true;
      closeAutocomplete();
      renderGames();
      syncURLState(false);
    }
  };

  window.ArcadeFavorites = {
    getFavorites: () => Array.from(getFavorites()),
    isFavorite,
    toggleFavorite,
    count: () => getFavorites().size
  };

  function closeGameModal(isFromPopState = false) {
    if (!gameModal || (!gameModal.classList.contains("active") && !activeGame)) return;
    activeGame = null;
    gameModal.classList.remove("active");
    gameModal.setAttribute("aria-hidden", "true");

    // Standardized Game Lifecycle Bridge: Dispatch teardown & pause events before unmounting iframe
    try {
      if (gameIframe && gameIframe.contentWindow) {
        gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_PAUSE" }, "*");
        gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_TEARDOWN" }, "*");

        // Proactively probe and dispose WebGL contexts in child iframe if accessible
        try {
          const doc = gameIframe.contentDocument || gameIframe.contentWindow.document;
          if (doc) {
            const canvases = doc.querySelectorAll("canvas");
            canvases.forEach((c) => {
              try {
                const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
                if (gl && !gl.isContextLost()) {
                  const loseExt = gl.getExtension("WEBGL_lose_context") ||
                                  gl.getExtension("WEBKIT_WEBGL_lose_context") ||
                                  gl.getExtension("MOZ_WEBGL_lose_context");
                  if (loseExt && typeof loseExt.loseContext === "function") {
                    loseExt.loseContext();
                  }
                }
              } catch (_) {}
            });
          }
        } catch (_) {}
      }
    } catch (_) {}
    
    // Safely blank out iframe after a 100ms grace period to allow games to close AudioContexts and stop RAF loops
    const currentFrame = gameIframe;
    setTimeout(() => {
      try {
        if (currentFrame && currentFrame.contentWindow) {
          currentFrame.contentWindow.location.replace("about:blank");
        } else if (currentFrame) {
          currentFrame.src = "about:blank";
        }
      } catch (e) {
        if (currentFrame) currentFrame.src = "about:blank";
      }
    }, 100);

    document.body.style.overflow = "";
    document.body.style.overscrollBehavior = "";
    modalWindow.classList.remove("fullscreen");
    if (gameModal) gameModal.classList.remove("fullscreen-mode");
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }

    if (isFromPopState) {
      modalPushedHistory = false;
    } else {
      if (modalPushedHistory) {
        modalPushedHistory = false;
        try {
          window.history.back();
        } catch (_) {
          syncURLState(false);
        }
      } else {
        syncURLState(false);
      }
    }
  }

  closeModalBtn.addEventListener("click", () => closeGameModal(false));
  modalOverlay.addEventListener("click", () => closeGameModal(false));

  if (modalFavBtn) {
    modalFavBtn.addEventListener("click", () => {
      if (activeGame) {
        toggleFavorite(activeGame.id);
      }
    });
  }

  if (modalSoundBtn) {
    modalSoundBtn.addEventListener("click", () => {
      if (window.SoundEngine && typeof window.SoundEngine.toggleMute === "function") {
        window.SoundEngine.toggleMute();
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
      closeGameModal(false);
    }
  });

  // Listen for forwarded shortcuts from inside game iframes (via ArcadeVerse SDK)
  window.addEventListener("message", (e) => {
    if (!e || !e.data || e.data.type !== "ARCADEVERSE_KEY_SHORTCUT") return;
    const key = (e.data.key || "").toLowerCase();
    if (e.data.key === "Escape") {
      if (gameModal.classList.contains("active")) closeGameModal(false);
    } else if (key === "f") {
      if (gameModal.classList.contains("active") && fullscreenBtn) fullscreenBtn.click();
    } else if (key === "r") {
      if (gameModal.classList.contains("active") && reloadBtn) reloadBtn.click();
    } else if (key === "m") {
      const soundBtn = document.getElementById("global-sound-toggle-btn");
      if (soundBtn) soundBtn.click();
    } else if (key === "t") {
      const themeBtn = document.getElementById("theme-toggle-btn");
      if (themeBtn) themeBtn.click();
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
    sortSelect.value = currentSort;
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      try {
        localStorage.setItem(CATALOG_SORT_STORAGE_KEY, currentSort);
      } catch (_) {}
      renderGames();
    });
  }

  // ==========================================================================
  // MOBILE TOUCH & GESTURE INTERFERENCE PREVENTION (Issue #519)
  // Prevents Default Pull-to-Refresh & Pinch-Zoom Interference During Touch Play
  // ==========================================================================
  function preventMultiTouchGestures(target) {
    if (!target) return;

    let lastTouchTime = 0;

    // Prevent multi-touch pinch-zoom (2 or more touches)
    target.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    // Prevent pull-to-refresh & browser scrolling interference on touch movements
    target.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    // Prevent accidental double-tap zoom triggers
    target.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchTime <= 300) {
        if (e.cancelable) e.preventDefault();
      }
      lastTouchTime = now;
    }, { passive: false });

    // Prevent iOS WebKit pinch-to-zoom / multi-finger gesture events
    target.addEventListener("gesturestart", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    target.addEventListener("gesturechange", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    target.addEventListener("gestureend", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  // Guard the game modal body / frame wrapper container
  const modalBody = document.querySelector(".game-modal-body") || modalFrameWrapper;
  if (modalBody) {
    preventMultiTouchGestures(modalBody);
  }

  // Prevent multi-touch zooming and gesture scaling on the modal container
  if (gameModal) {
    gameModal.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    gameModal.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    gameModal.addEventListener("gesturestart", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    gameModal.addEventListener("gesturechange", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    gameModal.addEventListener("gestureend", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  // Prevent pull-to-refresh when dragging on backdrop overlay
  if (modalOverlay) {
    modalOverlay.addEventListener("touchmove", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  // Inject gesture protections and styles inside the game iframe on load
  function guardIframeTouchInteractions() {
    try {
      if (!gameIframe) return;
      const doc = gameIframe.contentDocument || (gameIframe.contentWindow && gameIframe.contentWindow.document);
      if (!doc) return;

      if (doc.documentElement) {
        doc.documentElement.style.overscrollBehavior = "contain";
        doc.documentElement.style.touchAction = "none";
      }
      if (doc.body) {
        doc.body.style.overscrollBehavior = "contain";
        doc.body.style.touchAction = "none";
      }

      if (doc.head && !doc.getElementById("arcadeverse-touch-guard-css")) {
        const style = doc.createElement("style");
        style.id = "arcadeverse-touch-guard-css";
        style.textContent = `
          html, body, canvas, #canvas, .game-canvas {
            touch-action: none !important;
            overscroll-behavior: contain !important;
            overscroll-behavior-y: contain !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
        `;
        doc.head.appendChild(style);
      }

      preventMultiTouchGestures(doc);
    } catch (_) {}
  }

  // ===================================================
  // INTERACTIVE GAME SEARCH AUTOCOMPLETE & QUICK-JUMP
  // ===================================================
  const searchBox = document.querySelector(".search-box");
  let autocompleteDropdown = null;
  let activeSuggestionIndex = -1;
  let currentSuggestions = [];

  function escapeHTML(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightMatch(text, query) {
    const safeText = escapeHTML(text);
    if (!query) return safeText;
    const safeQuery = escapeRegex(escapeHTML(query));
    const regex = new RegExp(`(${safeQuery})`, "gi");
    return safeText.replace(regex, '<span class="autocomplete-match">$1</span>');
  }

  closeAutocomplete = function () {
    if (!autocompleteDropdown) return;
    autocompleteDropdown.style.display = "none";
    autocompleteDropdown.innerHTML = "";
    activeSuggestionIndex = -1;
    currentSuggestions = [];
    if (searchInput) {
      searchInput.setAttribute("aria-expanded", "false");
      searchInput.removeAttribute("aria-activedescendant");
    }
  };

  function updateActiveSuggestion(index) {
    if (!autocompleteDropdown) return;
    const items = autocompleteDropdown.querySelectorAll(".autocomplete-item");
    if (items.length === 0) return;

    activeSuggestionIndex = index;

    items.forEach((item, idx) => {
      if (idx === activeSuggestionIndex) {
        item.classList.add("active");
        item.setAttribute("aria-selected", "true");
        item.scrollIntoView({ block: "nearest" });
        if (searchInput) {
          searchInput.setAttribute("aria-activedescendant", item.id);
        }
      } else {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      }
    });

    if (activeSuggestionIndex === -1 && searchInput) {
      searchInput.removeAttribute("aria-activedescendant");
    }
  }

  function launchSuggestion(game) {
    closeAutocomplete();
    if (game && typeof openGameModal === "function") {
      openGameModal(game, searchInput);
    }
  }

  function renderAutocomplete(query) {
    if (!autocompleteDropdown || !searchInput) return;
    const trimmed = query.trim().toLowerCase();

    if (!trimmed || typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) {
      closeAutocomplete();
      return;
    }

    // Filter and score matching games
    const scoredMatches = [];
    for (const game of GAMES_REGISTRY) {
      const titleLower = (game.title || "").toLowerCase();
      const authorLower = (game.author || "").toLowerCase();
      const githubLower = (game.github || "").toLowerCase();
      const categoryLower = (game.category || "").toLowerCase();
      const tagsLower = Array.isArray(game.tags) ? game.tags.map((t) => t.toLowerCase()) : [];

      let score = -1;

      if (titleLower.startsWith(trimmed)) {
        score = 100;
      } else if (titleLower.includes(trimmed)) {
        score = 80;
      } else if (tagsLower.some((t) => t === trimmed)) {
        score = 60;
      } else if (tagsLower.some((t) => t.includes(trimmed))) {
        score = 50;
      } else if (categoryLower.includes(trimmed)) {
        score = 40;
      } else if (githubLower.includes(trimmed) || authorLower.includes(trimmed)) {
        score = 30;
      }

      if (score >= 0) {
        scoredMatches.push({ game, score });
      }
    }

    // Sort by relevance score descending
    scoredMatches.sort((a, b) => b.score - a.score);

    // Fallback: If exact matches are empty and query length >= 3, match using fuzzy Levenshtein distance <= 2
    if (scoredMatches.length === 0 && trimmed.length >= 3) {
      for (const game of GAMES_REGISTRY) {
        if (matchesFuzzyLevenshtein(game, trimmed)) {
          scoredMatches.push({ game, score: 25 });
        }
      }
    }

    currentSuggestions = scoredMatches.slice(0, 6).map((item) => item.game);
    activeSuggestionIndex = -1;

    if (currentSuggestions.length === 0) {
      autocompleteDropdown.innerHTML = `
        <div class="autocomplete-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div>No games found matching "<strong>${escapeHTML(query.trim())}</strong>"</div>
        </div>
      `;
      autocompleteDropdown.style.display = "flex";
      searchInput.setAttribute("aria-expanded", "true");
      return;
    }

    const listHtml = currentSuggestions
      .map((game, idx) => {
        const catBadge = game.category ? game.category.split("/")[0].trim() : "Game";
        const authorHandle = game.github || game.author || "";
        const iconName = game.lucideIcon || "gamepad-2";

        return `
          <li class="autocomplete-item"
              id="autocomplete-opt-${idx}"
              role="option"
              data-index="${idx}"
              aria-selected="false">
            <div class="autocomplete-icon-wrap" aria-hidden="true">
              <i data-lucide="${escapeHTML(iconName)}"></i>
            </div>
            <div class="autocomplete-content">
              <div class="autocomplete-title-row">
                <span class="autocomplete-title">${highlightMatch(game.title, query.trim())}</span>
              </div>
              <div class="autocomplete-meta-row">
                <span class="autocomplete-category-badge">${escapeHTML(catBadge)}</span>
                ${authorHandle ? `<span class="autocomplete-author">by @${escapeHTML(authorHandle)}</span>` : ""}
              </div>
            </div>
          </li>
        `;
      })
      .join("");

    autocompleteDropdown.innerHTML = `
      <ul class="autocomplete-list" role="presentation">
        ${listHtml}
      </ul>
      <div class="autocomplete-footer">
        <span class="autocomplete-footer-count">${currentSuggestions.length} result${currentSuggestions.length > 1 ? "s" : ""}</span>
        <div class="autocomplete-kbd-hints">
          <span class="autocomplete-kbd">↑↓</span> to navigate
          <span class="autocomplete-kbd">↵</span> to play
          <span class="autocomplete-kbd">Esc</span> to close
        </div>
      </div>
    `;

    autocompleteDropdown.style.display = "flex";
    searchInput.setAttribute("aria-expanded", "true");

    // Click events on suggestion items (mousedown ensures execution before input blur)
    const items = autocompleteDropdown.querySelectorAll(".autocomplete-item");
    items.forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt(item.getAttribute("data-index"), 10);
        if (!isNaN(idx) && currentSuggestions[idx]) {
          launchSuggestion(currentSuggestions[idx]);
        }
      });
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  if (searchBox && searchInput) {
    searchInput.setAttribute("role", "combobox");
    searchInput.setAttribute("aria-autocomplete", "list");
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-controls", "game-search-autocomplete");
    searchInput.setAttribute("autocomplete", "off");
    searchInput.setAttribute("spellcheck", "false");

    autocompleteDropdown = document.createElement("div");
    autocompleteDropdown.id = "game-search-autocomplete";
    autocompleteDropdown.className = "search-autocomplete-dropdown";
    autocompleteDropdown.setAttribute("role", "listbox");
    autocompleteDropdown.setAttribute("aria-label", "Search suggestions");
    autocompleteDropdown.style.display = "none";
    searchBox.appendChild(autocompleteDropdown);

    searchInput.addEventListener("focus", () => {
      const val = searchInput.value.trim();
      if (val.length > 0) {
        renderAutocomplete(val);
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (!autocompleteDropdown || autocompleteDropdown.style.display === "none") {
        if (e.key === "ArrowDown" && searchInput.value.trim().length > 0) {
          e.preventDefault();
          renderAutocomplete(searchInput.value);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (currentSuggestions.length > 0) {
          const nextIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
          updateActiveSuggestion(nextIndex);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (currentSuggestions.length > 0) {
          const prevIndex = activeSuggestionIndex <= 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
          updateActiveSuggestion(prevIndex);
        }
      } else if (e.key === "Enter") {
        if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
          e.preventDefault();
          launchSuggestion(currentSuggestions[activeSuggestionIndex]);
        } else if (currentSuggestions.length === 1) {
          e.preventDefault();
          launchSuggestion(currentSuggestions[0]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeAutocomplete();
      }
    });

    document.addEventListener("click", (e) => {
      if (!searchBox.contains(e.target)) {
        closeAutocomplete();
      }
    });
  }

  // Filter Search (Debounced 120ms & Typo-Tolerant)
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (searchClearBtn) searchClearBtn.hidden = !val;

      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }

      const executeSearch = () => {
        searchQuery = searchInput.value.toLowerCase().trim();
        renderGames();
        if (searchQuery.length > 0) {
          renderAutocomplete(searchInput.value);
        } else {
          closeAutocomplete();
        }
      };

      if (!e.isTrusted || !val) {
        executeSearch();
      } else {
        searchDebounceTimer = setTimeout(executeSearch, 120);
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
      if (searchInput) searchInput.value = "";
      searchClearBtn.hidden = true;
      searchQuery = "";
      closeAutocomplete();
      renderGames();
      if (searchInput) searchInput.focus();
    });
  }

  // --- Faceted Filters Event Listeners (Duration, Controls, Reset) ---
  const durationFacetChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
  durationFacetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      durationFacetChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentDurationFacet = chip.getAttribute("data-duration") || "all";
      renderGames();
    });
  });

  const controlsFacetChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
  controlsFacetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      controlsFacetChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentControlsFacet = chip.getAttribute("data-controls") || "all";
      renderGames();
    });
  });

  const btnResetFacets = document.getElementById("btn-reset-facets");
  if (btnResetFacets) {
    btnResetFacets.addEventListener("click", () => {
      currentDurationFacet = "all";
      currentControlsFacet = "all";
      currentLetterFilter = "all";
      resetLetterFilterUI();
      durationFacetChips.forEach((c) => {
        if (c.getAttribute("data-duration") === "all") c.classList.add("active");
        else c.classList.remove("active");
      });
      controlsFacetChips.forEach((c) => {
        if (c.getAttribute("data-controls") === "all") c.classList.add("active");
        else c.classList.remove("active");
      });
      renderGames();
    });
  }

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
      // Auto-close playlists drawer when switching category filters
      const playlistDrawer = document.getElementById("playlist-drawer");
      if (playlistDrawer && playlistDrawer.classList.contains("open")) {
        playlistDrawer.classList.remove("open");
        playlistDrawer.setAttribute("aria-hidden", "true");
      }
      if (playlistTrigger) playlistTrigger.classList.remove("active");

      categoryPills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      pill.classList.add("active");
      pill.setAttribute("aria-selected", "true");
      currentCategory = pill.getAttribute("data-category");
      renderGames();
      syncURLState(false);
    });
  });

  // Mobile Navigation Drawer Favorites Shortcut
  const mobileFavLink = document.getElementById("mobile-favorites-link");
  if (mobileFavLink) {
    mobileFavLink.addEventListener("click", (e) => {
      e.preventDefault();
      const mobileDrawer = document.getElementById("mobile-nav-drawer");
      const menuBtn = document.getElementById("mobile-menu-btn");
      if (mobileDrawer) {
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
      }
      if (menuBtn) {
        menuBtn.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
      }

      categoryPills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      const favPill = document.querySelector('.category-pills .pill[data-category="favorites"]');
      if (favPill) {
        favPill.classList.add("active");
        favPill.setAttribute("aria-selected", "true");
      }
      currentCategory = "favorites";
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      if (searchClearBtn) searchClearBtn.hidden = true;
      closeAutocomplete();
      renderGames();
      syncURLState(false);

      const gamesSection = document.getElementById("games");
      if (gamesSection) {
        gamesSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

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

  // --- Catalog Layout Switcher Engine (Grid vs Compact List View) ---
  function setCatalogView(view) {
    currentCatalogView = view === "list" ? "list" : "grid";
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, currentCatalogView);
    } catch (_) {}

    if (gamesGrid) {
      gamesGrid.classList.toggle("view-list", currentCatalogView === "list");
    }

    const gridBtn = document.getElementById("view-grid-btn");
    const listBtn = document.getElementById("view-list-btn");
    if (gridBtn && listBtn) {
      gridBtn.classList.toggle("active", currentCatalogView === "grid");
      gridBtn.setAttribute("aria-pressed", currentCatalogView === "grid" ? "true" : "false");
      listBtn.classList.toggle("active", currentCatalogView === "list");
      listBtn.setAttribute("aria-pressed", currentCatalogView === "list" ? "true" : "false");
    }
  }

  function initCatalogViewSwitcher() {
    const gridBtn = document.getElementById("view-grid-btn");
    const listBtn = document.getElementById("view-list-btn");
    if (gridBtn) {
      gridBtn.addEventListener("click", () => setCatalogView("grid"));
    }
    if (listBtn) {
      listBtn.addEventListener("click", () => setCatalogView("list"));
    }
    setCatalogView(currentCatalogView);
  }

  // --- A-Z Alphabetical Catalog Jump Bar Engine ---
  function updateLetterAvailability() {
    const letterButtons = document.querySelectorAll(".az-btn[data-letter]");
    if (!letterButtons.length || typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return;

    const letterCounts = {};
    GAMES_REGISTRY.forEach((g) => {
      if (!g || !g.title) return;
      const firstChar = g.title.trim().charAt(0).toUpperCase();
      const key = /[A-Z]/.test(firstChar) ? firstChar : "#";
      letterCounts[key] = (letterCounts[key] || 0) + 1;
    });

    letterButtons.forEach((btn) => {
      const letter = btn.getAttribute("data-letter");
      if (!letter || letter.toLowerCase() === "all") {
        btn.disabled = false;
        btn.classList.remove("disabled");
        btn.removeAttribute("aria-disabled");
        return;
      }

      const count = letterCounts[letter] || 0;
      if (count === 0) {
        btn.disabled = true;
        btn.classList.add("disabled");
        btn.setAttribute("aria-disabled", "true");
        btn.title = `No games starting with ${letter}`;
      } else {
        btn.disabled = false;
        btn.classList.remove("disabled");
        btn.removeAttribute("aria-disabled");
        btn.title = `${count} game${count !== 1 ? "s" : ""} starting with ${letter}`;
      }
    });
  }

  function resetLetterFilterUI() {
    currentLetterFilter = "all";
    const letterButtons = document.querySelectorAll(".az-btn[data-letter]");
    letterButtons.forEach((b) => {
      const isAll = b.getAttribute("data-letter") === "all";
      b.classList.toggle("active", isAll);
      b.setAttribute("aria-pressed", isAll ? "true" : "false");
    });
  }

  function initAZJumpBar() {
    updateLetterAvailability();
    const letterButtons = document.querySelectorAll(".az-btn[data-letter]");
    letterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled || btn.classList.contains("disabled")) return;
        const letter = btn.getAttribute("data-letter");
        if (!letter) return;

        currentLetterFilter = letter.toLowerCase() === "all" ? "all" : letter.toUpperCase();

        letterButtons.forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle("active", isActive);
          b.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        renderGames();
      });
    });

    // Keyboard toolbar navigation support (Left/Right arrows)
    const jumpBar = document.getElementById("az-jump-bar");
    if (jumpBar) {
      jumpBar.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const enabledButtons = Array.from(document.querySelectorAll(".az-btn[data-letter]:not(:disabled):not(.disabled)"));
          const currentIndex = enabledButtons.indexOf(document.activeElement);
          if (currentIndex !== -1) {
            e.preventDefault();
            const nextIndex = e.key === "ArrowRight"
              ? (currentIndex + 1) % enabledButtons.length
              : (currentIndex - 1 + enabledButtons.length) % enabledButtons.length;
            enabledButtons[nextIndex].focus();
          }
        }
      });
    }
  }

  // --- History API Deep-Linking & State Initialization ---
  function initURLDeepLinking() {
    try {
      const url = new URL(window.location.href);
      const categoryParam = url.searchParams.get("category");
      const searchParam = url.searchParams.get("search");
      const gameParam = url.searchParams.get("game");

      if (categoryParam) {
        const targetCat = categoryParam.trim();
        const matchedPill = Array.from(categoryPills).find(
          (p) => (p.getAttribute("data-category") || "").toLowerCase() === targetCat.toLowerCase()
        );
        if (matchedPill) {
          categoryPills.forEach((p) => {
            p.classList.remove("active");
            p.setAttribute("aria-selected", "false");
          });
          matchedPill.classList.add("active");
          matchedPill.setAttribute("aria-selected", "true");
          currentCategory = matchedPill.getAttribute("data-category");
        } else {
          currentCategory = targetCat;
        }
      }

      if (searchParam) {
        const targetSearch = searchParam.trim();
        searchQuery = targetSearch.toLowerCase();
        if (searchInput) {
          searchInput.value = targetSearch;
        }
        if (searchClearBtn) {
          searchClearBtn.hidden = !targetSearch;
        }
      }

      buildTagChips();
      renderGames();

      if (gameParam && typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
        const targetGameId = gameParam.trim().toLowerCase();
        const targetGame = GAMES_REGISTRY.find(
          (g) => g && g.id && g.id.toLowerCase() === targetGameId
        );
        if (targetGame) {
          openGameModal(targetGame, null, true);
        }
      }
    } catch (_) {
      buildTagChips();
      renderGames();
    }
  }

  // Handle browser Back & Forward navigation
  window.addEventListener("popstate", () => {
    try {
      const url = new URL(window.location.href);
      const gameParam = url.searchParams.get("game");
      const categoryParam = url.searchParams.get("category");
      const searchParam = url.searchParams.get("search");

      // 1. Handle Game Modal back/forward
      if (!gameParam) {
        if (gameModal && gameModal.classList.contains("active")) {
          closeGameModal(true);
        }
      } else {
        const targetGameId = gameParam.trim().toLowerCase();
        if (!activeGame || (activeGame.id && activeGame.id.toLowerCase() !== targetGameId)) {
          const targetGame = Array.isArray(GAMES_REGISTRY) && GAMES_REGISTRY.find((g) => g && g.id && g.id.toLowerCase() === targetGameId);
          if (targetGame) {
            openGameModal(targetGame, null, true);
          }
        }
      }

      // 2. Handle Category back/forward
      const targetCategory = (categoryParam && categoryParam.trim()) || "all";
      if (targetCategory.toLowerCase() !== currentCategory.toLowerCase()) {
        const matchedPill = Array.from(categoryPills).find(
          (p) => (p.getAttribute("data-category") || "").toLowerCase() === targetCategory.toLowerCase()
        );
        currentCategory = matchedPill ? matchedPill.getAttribute("data-category") : targetCategory;
        categoryPills.forEach((p) => {
          const isMatch = (p.getAttribute("data-category") || "").toLowerCase() === currentCategory.toLowerCase();
          p.classList.toggle("active", isMatch);
          p.setAttribute("aria-selected", isMatch ? "true" : "false");
        });
        buildTagChips();
        renderGames();
      }

      // 3. Handle Search back/forward
      const targetSearch = (searchParam && searchParam.trim()) || "";
      if (targetSearch.toLowerCase() !== searchQuery.toLowerCase()) {
        searchQuery = targetSearch.toLowerCase();
        if (searchInput) searchInput.value = targetSearch;
        if (searchClearBtn) searchClearBtn.hidden = !targetSearch;
        closeAutocomplete();
        renderGames();
      }
    } catch (_) {}
  });

  // Initial render
  initCatalogViewSwitcher();
  initAZJumpBar();
  initURLDeepLinking();
});
