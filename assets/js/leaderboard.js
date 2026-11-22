/**
 * Hall of Fame Live GitHub Contributors & Ranking Engine
 * Fetches real contributor stats from GitHub API (or seamlessly merges with games-registry)
 * 
 * Architecture:
 * - Admin (Project Lead) has a dedicated separate rank card at the top.
 * - Podium and Leaderboard Table display ONLY Community Contributors.
 * - Cards are static by default, with an elegant corner gradient radiating on hover.
 * - Dual-category highest badges: Displays highest Game Dedicated badge and highest Milestone badge.
 * - Direct GitHub Activity column with clickable links for Issues and PRs.
 */

document.addEventListener("DOMContentLoaded", () => {
  const podiumContainer = document.getElementById("podium-container");
  const tableBody = document.getElementById("leaderboard-table-body");
  const repoInput = document.getElementById("repo-input");
  const fetchBtn = document.getElementById("fetch-github-btn");
  const syncStatusText = document.getElementById("sync-status-text");
  const adminMetaInfo = document.getElementById("admin-meta-info");
  const searchInput = document.getElementById("leaderboard-search-input");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const exportJsonBtn = document.getElementById("export-json-btn");
  let exportMarkdownBtn = document.getElementById("export-markdown-btn");
  let tableSearchQuery = "";
  let searchDebounceTimer = null;
  let currentTierFilter = "all";

  // Standings Table Pagination & Page Size State
  const paginationBar = document.getElementById("leaderboard-pagination-bar");
  const paginationInfo = document.getElementById("leaderboard-pagination-info");
  const pageSizeSelect = document.getElementById("leaderboard-page-size");
  const prevBtn = document.getElementById("pagination-prev-btn");
  const nextBtn = document.getElementById("pagination-next-btn");
  const pagesContainer = document.getElementById("pagination-pages-container");

  // Safeguard admin avatar with offline fallback handler
  const adminAvatarImg = document.querySelector(".admin-avatar-img");
  if (adminAvatarImg) {
    adminAvatarImg.addEventListener("error", function () {
      this.onerror = null;
      this.src = getFallbackAvatarSvg("Debasmita Bose", "DebasmitaBose0");
    });
  }

  let currentPage = 1;
  let pageSize = 10;
  let currentTotalPages = 1;

  // Multi-Column Standings Table Sorting State (#714)
  const SORT_STORAGE_KEY = "arcadeverse_leaderboard_sort";
  const DEFAULT_SORT_COL = "score";
  const DEFAULT_SORT_DIR = "desc";

  let currentSortCol = DEFAULT_SORT_COL;
  let currentSortDir = DEFAULT_SORT_DIR;

  // Restore sort state from sessionStorage if available
  try {
    const savedSort = sessionStorage.getItem(SORT_STORAGE_KEY);
    if (savedSort) {
      const parsed = JSON.parse(savedSort);
      const validCols = ["rank", "name", "handle", "games", "commits", "score"];
      const validDirs = ["asc", "desc"];
      if (parsed && validCols.includes(parsed.column) && validDirs.includes(parsed.direction)) {
        currentSortCol = parsed.column;
        currentSortDir = parsed.direction;
      }
    }
  } catch (_) {}


  // Escape regex special characters safely
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Highlight matching query substring safely escaped
  function highlightMatch(text, query) {
    if (!text) return "";
    const safeText = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    if (!query) return safeText;

    const escaped = escapeRegex(query.trim());
    const regex = new RegExp("(" + escaped + ")", "gi");
    return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function escapeAttr(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Safely sanitize and validate avatar URLs against an HTTPS-only allowlist (#882).
   * Prevents javascript: or data: URI execution and falls back gracefully to standard SVG data URI avatars.
   */
  function sanitizeAvatarUrl(url, fallback) {
    if (!url || typeof url !== "string") return fallback;
    const trimmed = url.trim();
    if (trimmed.startsWith("https://") || trimmed.startsWith("data:image/svg+xml")) {
      return trimmed;
    }
    return fallback;
  }

  /**
   * Programmatically attach a robust error fallback listener to avatar images (#882).
   * Eliminates CSP-violating inline onerror="..." HTML attributes.
   */
  function attachAvatarFallback(imgElem, fallbackSrc) {
    if (!imgElem) return;
    imgElem.addEventListener("error", function handleError() {
      imgElem.removeEventListener("error", handleError);
      imgElem.src = fallbackSrc;
    });
  }

  function renderBadgeHtml(b) {
    const name = escapeHTML(b.label || b.role);
    const cat = escapeHTML(b.category || "Badge");
    const req = escapeHTML(b.requirement || "");
    const icon = escapeHTML(b.lucideIcon || "award");
    const tagClass = escapeHTML(b.tagClass || "");
    return `<span class="role-pill-badge ${tagClass}" data-badge-name="${name}" data-badge-cat="${cat}" data-badge-req="${req}" tabindex="0" role="button" aria-label="${name}: ${req}" title="${name} • ${req}"><i data-lucide="${icon}"></i> ${name}</span>`;
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        tableSearchQuery = e.target.value.toLowerCase().trim();
        currentPage = 1;
        renderTable();
      }, 200);
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      pageSize = val === "all" ? "all" : parseInt(val, 10);
      currentPage = 1;
      renderTable();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        scrollToTable();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentPage < currentTotalPages) {
        currentPage++;
        renderTable();
        scrollToTable();
      }
    });
  }

  function scrollToTable() {
    const tableCard = document.querySelector(".leaderboard-table-card");
    if (tableCard) {
      tableCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Contributor Milestone Tier Filter Pills Engine (#691)
  function matchesTier(item, tier) {
    const games = item.gamesCount || 0;
    switch (tier) {
      case "explorers":
        return games >= 1 && games <= 3;
      case "developers":
        return games >= 4 && games <= 7;
      case "hyper":
        return games >= 8 && games <= 14;
      case "architects":
        return games >= 15;
      case "all":
      default:
        return true;
    }
  }

  function updateTierPillCounts() {
    const allContribs = getCommunityContributors();
    const counts = {
      all: allContribs.length,
      explorers: 0,
      developers: 0,
      hyper: 0,
      architects: 0
    };

    allContribs.forEach(item => {
      const games = item.gamesCount || 0;
      if (games >= 15) {
        counts.architects++;
      } else if (games >= 8) {
        counts.hyper++;
      } else if (games >= 4) {
        counts.developers++;
      } else if (games >= 1) {
        counts.explorers++;
      }
    });

    for (const [tier, count] of Object.entries(counts)) {
      const el = document.getElementById(`tier-count-${tier}`);
      if (el) {
        el.textContent = String(count);
      }
    }
  }

  const tierPillButtons = document.querySelectorAll(".tier-pill-btn");
  if (tierPillButtons.length > 0) {
    tierPillButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const selectedTier = btn.dataset.tier || "all";
        if (currentTierFilter === selectedTier) return;
        currentTierFilter = selectedTier;
        currentPage = 1;

        tierPillButtons.forEach(b => {
          const isActive = (b.dataset.tier || "all") === selectedTier;
          b.classList.toggle("active", isActive);
          b.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        renderTable();
      });
    });
  }

  function getPageNumbers(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push("...");
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("...");
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push("...");
      pages.push(total);
    }
    return pages;
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      exportStandingsCsv();
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      exportStandingsJson();
    });
  }

  // Dynamic Mount for Export Markdown Button (#692)
  if (!exportMarkdownBtn) {
    const toolsContainer = document.querySelector(".table-header-tools");
    if (toolsContainer) {
      exportMarkdownBtn = document.createElement("button");
      exportMarkdownBtn.type = "button";
      exportMarkdownBtn.className = "btn btn-secondary btn-sm btn-export-csv btn-export-markdown";
      exportMarkdownBtn.id = "export-markdown-btn";
      exportMarkdownBtn.title = "Export filtered leaderboard standings as GitHub Flavored Markdown table";
      exportMarkdownBtn.innerHTML = `<i data-lucide="file-text"></i> <span>Export Markdown</span>`;

      if (exportJsonBtn && exportJsonBtn.nextSibling) {
        toolsContainer.insertBefore(exportMarkdownBtn, exportJsonBtn.nextSibling);
      } else {
        toolsContainer.appendChild(exportMarkdownBtn);
      }
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }

  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener("click", () => {
      exportStandingsMarkdown();
    });
  }

  // Leaderboard Switcher (Community Contributors vs Admin View)
  const switchContribBtn = document.getElementById("switch-contributors-btn");
  const switchAdminBtn = document.getElementById("switch-admin-btn");
  const viewContributors = document.getElementById("view-contributors");
  const viewAdmin = document.getElementById("view-admin");

  if (switchContribBtn && switchAdminBtn && viewContributors && viewAdmin) {
    switchContribBtn.addEventListener("click", () => {
      switchContribBtn.classList.add("active");
      switchAdminBtn.classList.remove("active");
      viewContributors.style.display = "block";
      viewAdmin.style.display = "none";
      if (window.lucide) lucide.createIcons();
    });

    switchAdminBtn.addEventListener("click", () => {
      switchAdminBtn.classList.add("active");
      switchContribBtn.classList.remove("active");
      viewAdmin.style.display = "block";
      viewContributors.style.display = "none";
      if (window.lucide) lucide.createIcons();
    });
  }

  const CACHE_KEY = "arcadeverse_contributors_cache_v2";
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Strict Contributor JSON Schema Validation & Self-Healing Engine (#582)
  function validateAndHealContributor(raw) {
    if (!raw || typeof raw !== "object") return null;

    // Required fields: login / github must be a non-empty string
    const login = typeof raw.login === "string" && raw.login.trim()
      ? raw.login.trim()
      : (typeof raw.github === "string" && raw.github.trim() ? raw.github.trim() : null);

    if (!login) {
      console.warn("[LeaderboardSchema] Discarded invalid record missing login:", raw);
      return null;
    }

    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : login;
    const role = typeof raw.role === "string" && raw.role.trim() ? raw.role.trim() : "Community Contributor";
    const avatar = typeof raw.avatar_url === "string" && raw.avatar_url.trim()
      ? raw.avatar_url.trim()
      : `https://github.com/${login}.png`;

    const commits = Number.isFinite(Number(raw.commits)) && Number(raw.commits) >= 0 ? Math.floor(Number(raw.commits)) : 1;
    const gamesCount = Number.isFinite(Number(raw.gamesCount)) && Number(raw.gamesCount) >= 0 ? Math.floor(Number(raw.gamesCount)) : 0;
    const mechanicsBonus = Number.isFinite(Number(raw.mechanicsBonus)) && Number(raw.mechanicsBonus) >= 0 ? Math.floor(Number(raw.mechanicsBonus)) : 0;
    const platformPRs = Number.isFinite(Number(raw.platformPRs)) && Number(raw.platformPRs) >= 0 ? Math.floor(Number(raw.platformPRs)) : 0;
    const qualityPRs = Number.isFinite(Number(raw.qualityPRs)) && Number(raw.qualityPRs) >= 0 ? Math.floor(Number(raw.qualityPRs)) : 0;
    const bonusPts = Number.isFinite(Number(raw.bonusPts)) ? Math.floor(Number(raw.bonusPts)) : 0;
    const games = Array.isArray(raw.games) ? raw.games : (Array.isArray(raw.contributions) ? raw.contributions : []);

    return {
      login: login,
      name: name,
      role: role,
      avatar_url: avatar,
      commits: commits,
      gamesCount: gamesCount,
      mechanicsBonus: mechanicsBonus,
      platformPRs: platformPRs,
      qualityPRs: qualityPRs,
      bonusPts: bonusPts,
      games: games
    };
  }

  // Initial verified contributors from repository
  let contributorsData = [];

  // Sync contributors data with local CONTRIBUTORS_REGISTRY and GAMES_REGISTRY
  function loadRegistryContributors() {
    if (typeof CONTRIBUTORS_REGISTRY === "undefined" || !Array.isArray(CONTRIBUTORS_REGISTRY)) return;

    contributorsData = CONTRIBUTORS_REGISTRY.map(regUser => {
      let userGames = [];
      if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
        userGames = GAMES_REGISTRY.filter(g => g && g.github && g.github.toLowerCase() === (regUser.github || "").toLowerCase());
      }
      const registeredTitles = userGames.map(g => g.title);
      const fallbackTitles = (regUser.contributions || []).filter(c => c && c !== "Quality & Platform Contribution");
      const gamesList = Array.from(new Set([...registeredTitles, ...fallbackTitles]));
      const gamesCount = gamesList.length > 0 ? gamesList.length : (regUser.gamesCount || 0);

      const candidate = {
        login: regUser.github,
        name: regUser.name,
        role: regUser.role || "Community Contributor",
        avatar_url: `https://github.com/${regUser.github}.png`,
        commits: regUser.commits || 1,
        gamesCount: gamesCount,
        mechanicsBonus: regUser.mechanicsBonus || 0,
        platformPRs: regUser.platformPRs || 0,
        qualityPRs: regUser.qualityPRs || 0,
        bonusPts: regUser.bonusPts || 0,
        games: gamesList
      };
      return validateAndHealContributor(candidate);
    }).filter(Boolean);

    // Also index any developers present in GAMES_REGISTRY who may not be in CONTRIBUTORS_REGISTRY
    if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
      GAMES_REGISTRY.forEach(game => {
        if (!game || !game.github) return;
        const ghLower = game.github.toLowerCase();
        const existing = contributorsData.find(c => c.login && c.login.toLowerCase() === ghLower);
        if (existing) {
          if (!existing.games.includes(game.title)) {
            existing.games.push(game.title);
          }
          existing.gamesCount = Math.max(existing.games.length, existing.gamesCount || 0);
        } else {
          const candidate = validateAndHealContributor({
            login: game.github,
            name: game.author || game.github,
            role: game.role || "Arcade Developer",
            avatar_url: `https://github.com/${game.github}.png`,
            commits: 1,
            gamesCount: 1,
            mechanicsBonus: 0,
            platformPRs: 0,
            qualityPRs: 0,
            bonusPts: 0,
            games: [game.title]
          });
          if (candidate) contributorsData.push(candidate);
        }
      });
    }
  }

  // Universal In-App Arcade Point System:
  // Completely distinct from the official NSoC 3 / 5 / 10 evaluation labels.
  // - Verified Game: +100 pts per integrated game in 'games/' folder
  // - Mechanics & Physics Bonus: +25 pts per advanced game (Canvas/Audio/Physics/AI)
  // - Platform Feature PR: +50 pts per merged feature/UI PR
  // - Quality & Bug Fixes: +25 pts per merged bug fix / maintenance PR
  // - Merged Git Commits: +5 pts per verified commit (rewards sustained development)
  function calculateScore(item) {
    const gamePts = (item.gamesCount || 0) * 100;
    const mechanicsPts = (item.mechanicsBonus || 0) * 25;
    const featurePts = (item.platformPRs || 0) * 50;
    const fixPts = (item.qualityPRs || 0) * 25;
    const commitPts = (item.commits || 0) * 5;
    const bonus = item.bonusPts || 0;

    return gamePts + mechanicsPts + featurePts + fixPts + commitPts + bonus;
  }

  // Contributor Badges Engine:
  // Evaluates and returns an array of badges strictly and deterministically based on:
  // 1. Leadership Category (Project Admin & Lead)
  // 2. Games Dedicated Category (Count of verified standalone games in 'games/'):
  //    - Legendary Game Architect (50+ Verified Games)
  //    - Mythic Game Creator (35–49 Verified Games)
  //    - Grandmaster Game Designer (25–34 Verified Games)
  //    - Master Game Architect (15–24 Verified Games)
  //    - Veteran Game Developer (10–14 Verified Games)
  //    - Hyper Game Developer (7–9 Verified Games)
  //    - Senior Arcade Developer (5–6 Verified Games)
  //    - Arcade Developer (3–4 Verified Games)
  //    - Junior Game Crafter (2 Verified Games)
  //    - Novice Game Creator (1 Verified Game)
  // 3. Platform & Universal Engineering Category (Strictly bound to in-app Arcade Score):
  //    - Immortal Arcade Legend (5000+ Arcade Points)
  //    - Grandmaster Core Architect (3000–4999 Arcade Points)
  //    - Master Core Architect (2000–2999 Arcade Points)
  //    - Senior Platform Engineer (1200–1999 Arcade Points)
  //    - Elite Contributor (750–1199 Arcade Points)
  //    - Distinguished Contributor (400–749 Arcade Points)
  //    - Platform Contributor (200–399 Arcade Points)
  //    - Rising Contributor (100–199 Arcade Points)
  //    - Active Contributor (25–99 Arcade Points)
  //    - Apprentice Contributor (1–24 Arcade Points)
  function getContributorBadges(user) {
    const badges = [];
    const userHandle = (user.login || user.github || "").toLowerCase();
    const isAdmin = userHandle === "debasmitabose0";

    // 1. Leadership Badge (Only for Project Lead)
    if (isAdmin) {
      badges.push({
        role: "Project Admin & Lead",
        tagClass: "role-admin",
        label: "Project Admin & Lead",
        lucideIcon: "crown",
        category: "Leadership",
        requirement: "Project Lead & Core Platform Architect"
      });
    }

    // 2. Dedicated Game Developer Tier (Based on Verified Games in 'games/' folder)
    const gamesCount = user.gamesCount || 0;
    if (gamesCount >= 100) {
      badges.push({
        role: "Arcade Omnipresent Primordial",
        tagClass: "role-omnipresent-primordial",
        label: "Arcade Omnipresent Primordial",
        lucideIcon: "crown",
        category: "Games Dedicated",
        requirement: "Requires 100+ Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 75) {
      badges.push({
        role: "Celestial Game Deity",
        tagClass: "role-celestial-deity",
        label: "Celestial Game Deity",
        lucideIcon: "sparkles",
        category: "Games Dedicated",
        requirement: "Requires 75–99 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 55) {
      badges.push({
        role: "Mythic Overlord Architect",
        tagClass: "role-mythic-overlord",
        label: "Mythic Overlord Architect",
        lucideIcon: "zap",
        category: "Games Dedicated",
        requirement: "Requires 55–74 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 40) {
      badges.push({
        role: "Legendary Game Architect",
        tagClass: "role-legendary-architect",
        label: "Legendary Game Architect",
        lucideIcon: "crown",
        category: "Games Dedicated",
        requirement: "Requires 40–54 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 25) {
      badges.push({
        role: "Grandmaster Game Designer",
        tagClass: "role-grandmaster-designer",
        label: "Grandmaster Game Designer",
        lucideIcon: "award",
        category: "Games Dedicated",
        requirement: "Requires 25–39 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 15) {
      badges.push({
        role: "Master Game Architect",
        tagClass: "role-master-architect",
        label: "Master Game Architect",
        lucideIcon: "shield-check",
        category: "Games Dedicated",
        requirement: "Requires 15–24 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 10) {
      badges.push({
        role: "Veteran Game Developer",
        tagClass: "role-veteran-dev",
        label: "Veteran Game Developer",
        lucideIcon: "rocket",
        category: "Games Dedicated",
        requirement: "Requires 10–14 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 7) {
      badges.push({
        role: "Hyper Game Developer",
        tagClass: "role-hyper",
        label: "Hyper Game Developer",
        lucideIcon: "flame",
        category: "Games Dedicated",
        requirement: "Requires 7–9 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 5) {
      badges.push({
        role: "Senior Arcade Developer",
        tagClass: "role-senior-arcade",
        label: "Senior Arcade Developer",
        lucideIcon: "cpu",
        category: "Games Dedicated",
        requirement: "Requires 5–6 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 3) {
      badges.push({
        role: "Arcade Developer",
        tagClass: "role-arcade",
        label: "Arcade Developer",
        lucideIcon: "gamepad-2",
        category: "Games Dedicated",
        requirement: "Requires 3–4 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 2) {
      badges.push({
        role: "Junior Game Crafter",
        tagClass: "role-junior-crafter",
        label: "Junior Game Crafter",
        lucideIcon: "hammer",
        category: "Games Dedicated",
        requirement: "Requires 2 Verified Games in 'games/' folder"
      });
    } else if (gamesCount >= 1) {
      badges.push({
        role: "Novice Game Creator",
        tagClass: "role-novice-creator",
        label: "Novice Game Creator",
        lucideIcon: "compass",
        category: "Games Dedicated",
        requirement: "Requires 1 Verified Game in 'games/' folder"
      });
    }

    // 3. Platform & Universal Engineering Track (Directly bound to In-App Arcade Score)
    const score = calculateScore(user);

    if (score >= 15000) {
      badges.push({
        role: "Singularity Sovereign Architect",
        tagClass: "role-singularity-sovereign",
        label: "Singularity Sovereign Architect",
        lucideIcon: "crown",
        category: "Platform & Core",
        requirement: "Requires 15,000+ Arcade Points"
      });
    } else if (score >= 10000) {
      badges.push({
        role: "Apex Core Pioneer",
        tagClass: "role-apex-core",
        label: "Apex Core Pioneer",
        lucideIcon: "gem",
        category: "Platform & Core",
        requirement: "Requires 10,000–14,999 Arcade Points"
      });
    } else if (score >= 7500) {
      badges.push({
        role: "Immortal Arcade Legend",
        tagClass: "role-immortal",
        label: "Immortal Arcade Legend",
        lucideIcon: "sparkles",
        category: "Platform & Core",
        requirement: "Requires 7,500–9,999 Arcade Points"
      });
    } else if (score >= 5000) {
      badges.push({
        role: "Grandmaster Core Architect",
        tagClass: "role-grandmaster-core",
        label: "Grandmaster Core Architect",
        lucideIcon: "award",
        category: "Platform & Core",
        requirement: "Requires 5,000–7,499 Arcade Points"
      });
    } else if (score >= 3000) {
      badges.push({
        role: "Master Core Architect",
        tagClass: "role-master",
        label: "Master Core Architect",
        lucideIcon: "shield-check",
        category: "Platform & Core",
        requirement: "Requires 3,000–4,999 Arcade Points"
      });
    } else if (score >= 1800) {
      badges.push({
        role: "Senior Platform Engineer",
        tagClass: "role-senior-platform",
        label: "Senior Platform Engineer",
        lucideIcon: "terminal",
        category: "Platform & Core",
        requirement: "Requires 1,800–2,999 Arcade Points"
      });
    } else if (score >= 1000) {
      badges.push({
        role: "Elite Contributor",
        tagClass: "role-elite",
        label: "Elite Contributor",
        lucideIcon: "zap",
        category: "Platform & Core",
        requirement: "Requires 1,000–1,799 Arcade Points"
      });
    } else if (score >= 500) {
      badges.push({
        role: "Distinguished Contributor",
        tagClass: "role-distinguished",
        label: "Distinguished Contributor",
        lucideIcon: "medal",
        category: "Platform & Core",
        requirement: "Requires 500–999 Arcade Points"
      });
    } else if (score >= 250) {
      badges.push({
        role: "Platform Contributor",
        tagClass: "role-platform",
        label: "Platform Contributor",
        lucideIcon: "code-2",
        category: "Platform & Core",
        requirement: "Requires 250–499 Arcade Points"
      });
    } else if (score >= 100) {
      badges.push({
        role: "Rising Contributor",
        tagClass: "role-rising",
        label: "Rising Contributor",
        lucideIcon: "trending-up",
        category: "Getting Started",
        requirement: "Requires 100–249 Arcade Points"
      });
    } else if (score >= 25) {
      badges.push({
        role: "Active Contributor",
        tagClass: "role-active",
        label: "Active Contributor",
        lucideIcon: "sprout",
        category: "Getting Started",
        requirement: "Requires 25–99 Arcade Points"
      });
    } else if (score >= 1) {
      badges.push({
        role: "Apprentice Contributor",
        tagClass: "role-apprentice",
        label: "Apprentice Contributor",
        lucideIcon: "target",
        category: "Getting Started",
        requirement: "Requires 1–24 Arcade Points"
      });
    }

    badges.forEach(b => {
      b.title = `${b.label}: ${b.requirement || b.category}`;
    });

    return badges;
  }

  // Helper to filter out automated bot accounts (e.g. github-actions[bot], dependabot[bot])
  function isBotAccount(login) {
    if (!login) return false;
    const l = login.toLowerCase();
    return l.endsWith("[bot]") || l.includes("bot") || l.includes("actions-user") || l === "github-actions";
  }

  // Get Community Contributors (Excludes Admin and Bots)
  // Ranked strictly by:
  // 1. Total Arcade Score (primary)
  // 2. Verified Games count (secondary)
  // 3. Merged Commits (tiebreaker)
  // Deterministic 4-Tier Tie-Breaking Ranking Engine (#525):
  // 1. Total Arcade Score descending
  // 2. Verified Games count descending
  // 3. Merged Git Commits count descending
  // 4. GitHub Login handle ascending (alphabetical case-insensitive)
  function getCommunityContributors() {
    return contributorsData
      .filter(item => item.login && item.login.toLowerCase() !== "debasmitabose0" && !isBotAccount(item.login))
      .sort((a, b) => {
        const scoreDiff = calculateScore(b) - calculateScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        if ((b.gamesCount || 0) !== (a.gamesCount || 0)) {
          return (b.gamesCount || 0) - (a.gamesCount || 0);
        }
        if ((b.commits || 0) !== (a.commits || 0)) {
          return (b.commits || 0) - (a.commits || 0);
        }
        const loginA = (a.login || "").toLowerCase();
        const loginB = (b.login || "").toLowerCase();
        return loginA.localeCompare(loginB);
      });
  }

  // Format effort & work breakdown label
  function getWorkBreakdown(item) {
    const games = item.gamesCount || 0;
    const feat = item.platformPRs || 0;
    const fix = item.qualityPRs || 0;
    return `Games: ${games} • Feat: ${feat} • Fix: ${fix}`;
  }

  // Generate procedural generative monogram SVG avatar with deterministic hash-based gradient (#689)
  function getFallbackAvatarSvg(name, login) {
    const raw = (name || login || "?").trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    let monogram = "?";
    if (parts.length >= 2) {
      monogram = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (raw.length >= 2) {
      monogram = raw.slice(0, 2).toUpperCase();
    } else if (raw.length === 1) {
      monogram = raw.toUpperCase();
    }

    // Deterministic hash based on username/login
    const seed = (login || name || "arcadeverse").toLowerCase();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const PALETTES = [
      ["#6366f1", "#06b6d4"],
      ["#ec4899", "#8b5cf6"],
      ["#3b82f6", "#10b981"],
      ["#f59e0b", "#ef4444"],
      ["#8b5cf6", "#3b82f6"],
      ["#14b8a6", "#06b6d4"],
      ["#f43f5e", "#fb923c"],
      ["#a855f7", "#ec4899"]
    ];

    const paletteIdx = Math.abs(hash) % PALETTES.length;
    const [c1, c2] = PALETTES[paletteIdx];
    const gradId = `av-grad-${Math.abs(hash)}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(#${gradId})"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="${monogram.length > 1 ? 22 : 26}" font-weight="700" letter-spacing="-0.5px">${monogram}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // Calculate contributor next-tier progress & multiplier (#578)
  function getTierProgress(score) {
    const milestones = [
      { name: "Apprentice", min: 1, next: 25, multiplier: "1.0x" },
      { name: "Active", min: 25, next: 100, multiplier: "1.1x" },
      { name: "Rising", min: 100, next: 250, multiplier: "1.2x" },
      { name: "Platform", min: 250, next: 500, multiplier: "1.35x" },
      { name: "Distinguished", min: 500, next: 1000, multiplier: "1.5x" },
      { name: "Elite", min: 1000, next: 1800, multiplier: "1.75x" },
      { name: "Senior", min: 1800, next: 3000, multiplier: "2.0x" },
      { name: "Principal", min: 3000, next: 5000, multiplier: "2.5x" },
      { name: "Distinguished Fellow", min: 5000, next: 5000, multiplier: "3.0x" }
    ];

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (score < m.next) {
        const range = m.next - m.min;
        const progress = Math.max(0, Math.min(100, Math.round(((score - m.min) / range) * 100)));
        return {
          currentTier: m.name,
          nextTier: milestones[i + 1] ? milestones[i + 1].name : "Max Tier",
          progressPct: progress,
          needed: m.next - score,
          multiplier: m.multiplier
        };
      }
    }
    return {
      currentTier: "Distinguished Fellow",
      nextTier: "Max Rank",
      progressPct: 100,
      needed: 0,
      multiplier: "3.0x"
    };
  }

  // Render Top Community Contributors Podium
  // Only displays real verified contributors who have contributed to the repository.
  // Never renders dummy "Claim Rank" cards.
  // Keeps card uncluttered since full work breakdown is in the table and category section below.
  function renderPodium() {
    if (!podiumContainer) return;
    podiumContainer.innerHTML = "";

    const communityContributors = getCommunityContributors();

    if (communityContributors.length === 0) {
      podiumContainer.innerHTML = `
        <div class="podium-empty-notice" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;">
          <i data-lucide="sparkles" style="margin-right: 0.4rem;"></i> Verified community contributors will appear here automatically as contributions merge.
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Determine slots strictly from actual verified contributors
    let orderedContributors = [];

    if (communityContributors.length === 1) {
      // Single contributor: centered solo podium card
      orderedContributors = [
        { rank: 1, user: communityContributors[0], cardClass: "podium-1 podium-gold solo-podium", badgeType: "gold", badgeLabel: "1st Champion", badgeIcon: "crown" }
      ];
    } else if (communityContributors.length === 2) {
      // Two contributors: 1st (Gold) and 2nd (Silver)
      orderedContributors = [
        { rank: 1, user: communityContributors[0], cardClass: "podium-1 podium-gold", badgeType: "gold", badgeLabel: "1st Champion", badgeIcon: "crown" },
        { rank: 2, user: communityContributors[1], cardClass: "podium-2 podium-silver", badgeType: "silver", badgeLabel: "2nd Contributor", badgeIcon: "medal" }
      ];
    } else {
      // 3 or more: Olympic podium layout (2nd, 1st, 3rd)
      orderedContributors = [
        { rank: 2, user: communityContributors[1], cardClass: "podium-2 podium-silver", badgeType: "silver", badgeLabel: "2nd Contributor", badgeIcon: "medal" },
        { rank: 1, user: communityContributors[0], cardClass: "podium-1 podium-gold", badgeType: "gold", badgeLabel: "1st Champion", badgeIcon: "crown" },
        { rank: 3, user: communityContributors[2], cardClass: "podium-3 podium-bronze", badgeType: "bronze", badgeLabel: "3rd Contributor", badgeIcon: "medal" }
      ];
    }

    orderedContributors.forEach(slot => {
      const item = slot.user;
      const score = calculateScore(item);
      const badges = getContributorBadges(item);
      const fallbackAvatar = getFallbackAvatarSvg(item.name, item.login);

      const tierInfo = getTierProgress(score);

      const safeAvatarUrl = sanitizeAvatarUrl(item.avatar_url, fallbackAvatar);

      const card = document.createElement("div");
      card.className = `podium-card ${slot.cardClass}`;
      // Clean, uncluttered card: Rank badge, avatar, name, handle, primary badges, score, milestone progress bar, and profile link.
      card.innerHTML = `
        <div class="podium-badge podium-badge-${slot.badgeType}">
          <i data-lucide="${slot.badgeIcon}"></i> ${escapeHTML(slot.badgeLabel)}
        </div>
        <img src="${escapeAttr(safeAvatarUrl)}" alt="${escapeAttr(item.name || item.login)}" class="podium-avatar">
        <h3 class="podium-name">${escapeHTML(item.name)}</h3>
        <a href="https://github.com/${escapeAttr(item.login)}" target="_blank" rel="noopener noreferrer" class="podium-handle">@${escapeHTML(item.login)}</a>
        
        <div class="podium-badges-container">
          ${badges.map(renderBadgeHtml).join("")}
        </div>

        <div class="podium-score-pill">
          <strong>${score}</strong> pts <span class="podium-multiplier-tag" title="Tier Multiplier">${escapeHTML(tierInfo.multiplier)}</span>
        </div>

        <div class="podium-milestone-wrap" title="${tierInfo.needed > 0 ? tierInfo.needed + ' pts to ' + escapeAttr(tierInfo.nextTier) : 'Max Tier Reached'}">
          <div class="podium-milestone-labels">
            <span>${escapeHTML(tierInfo.currentTier)}</span>
            <span>${tierInfo.progressPct}%</span>
          </div>
          <div class="podium-milestone-track">
            <div class="podium-milestone-fill" style="width: ${tierInfo.progressPct}%;"></div>
          </div>
        </div>

        <div class="podium-sub-stat-text" style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          ${item.gamesCount > 0 ? `<button type="button" class="podium-author-games-btn" data-action="open-author-drawer" data-handle="${escapeAttr(item.login)}" data-author="${escapeAttr(item.name || item.login)}" title="View ${item.gamesCount} verified game${item.gamesCount === 1 ? '' : 's'}"><i data-lucide="gamepad-2" style="width: 0.8rem; height: 0.8rem;"></i> ${item.gamesCount} Game${item.gamesCount === 1 ? '' : 's'}</button> • ` : ''}
          <span><i data-lucide="git-commit" style="width: 0.8rem; height: 0.8rem;"></i> ${item.commits} Commit${item.commits === 1 ? '' : 's'}</span>
        </div>

        <div class="podium-actions-row">
          <button type="button" class="podium-trophy-btn" data-action="open-trophy-card" data-player="${escapeAttr(item.name || item.login)}" data-handle="${escapeAttr(item.login)}" data-avatar="${escapeAttr(item.avatar_url || '')}" data-score="${score} PTS" data-game="NSOC 2026 Hall of Fame" data-rank="${escapeAttr(slot.badgeLabel)}" data-badge="NSOC 2026" title="Generate Verified Achievement Certificate">
            <i data-lucide="award"></i> Trophy Certificate
          </button>
          <button type="button" class="podium-share-btn" data-action="share-standing" data-name="${escapeAttr(item.name)}" data-handle="${escapeAttr(item.login)}" data-rank="${slot.rank}" data-score="${score}" title="Share Contributor Standing">
            <i data-lucide="share-2"></i> Share Rank
          </button>
        </div>
      `;

      const podiumImg = card.querySelector(".podium-avatar");
      if (podiumImg) {
        attachAvatarFallback(podiumImg, fallbackAvatar);
      }

      podiumContainer.appendChild(card);
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Dynamic Stable Multi-Column Sorter (#714)
  function sortCommunityContributors(list, col, dir) {
    const isAsc = dir === "asc";
    const mult = isAsc ? 1 : -1;

    return [...list].sort((a, b) => {
      let diff = 0;
      if (col === "games") {
        diff = ((a.gamesCount || 0) - (b.gamesCount || 0)) * mult;
      } else if (col === "commits") {
        diff = ((a.commits || 0) - (b.commits || 0)) * mult;
      } else if (col === "name") {
        const nameA = (a.name || a.login || "").toLowerCase();
        const nameB = (b.name || b.login || "").toLowerCase();
        diff = nameA.localeCompare(nameB) * mult;
      } else if (col === "handle") {
        const handleA = (a.login || "").toLowerCase();
        const handleB = (b.login || "").toLowerCase();
        diff = handleA.localeCompare(handleB) * mult;
      } else if (col === "rank") {
        diff = ((a.rank || 0) - (b.rank || 0)) * mult;
      } else {
        // default "score"
        const scoreA = calculateScore(a);
        const scoreB = calculateScore(b);
        diff = (scoreA - scoreB) * mult;
      }

      if (diff !== 0) return diff;

      // Stable deterministic 4-tier tiebreaker: Score desc -> Games desc -> Commits desc -> Login asc
      const scoreDiff = calculateScore(b) - calculateScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      const gamesDiff = (b.gamesCount || 0) - (a.gamesCount || 0);
      if (gamesDiff !== 0) return gamesDiff;

      const commitsDiff = (b.commits || 0) - (a.commits || 0);
      if (commitsDiff !== 0) return commitsDiff;

      const loginA = (a.login || "").toLowerCase();
      const loginB = (b.login || "").toLowerCase();
      return loginA.localeCompare(loginB);
    });
  }

  const COLUMN_SORT_CONFIG = {
    0: "rank",
    1: "name",
    3: "handle",
    4: "games",
    6: "commits",
    8: "score"
  };

  let isTableSortingInitialized = false;

  function initTableSorting() {
    const table = document.getElementById("leaderboard-table");
    if (!table) return;

    const headers = table.querySelectorAll("thead tr th");
    headers.forEach((th, idx) => {
      const sortKey = th.getAttribute("data-sort") || COLUMN_SORT_CONFIG[idx];
      if (!sortKey) return;

      th.setAttribute("data-sort", sortKey);
      th.setAttribute("role", "columnheader");
      th.setAttribute("tabindex", "0");
      th.classList.add("sortable-th");

      // Wrap existing text in sort-header-inner if not already wrapped
      if (!th.querySelector(".sort-header-inner")) {
        const text = th.textContent.trim();
        th.innerHTML = `
          <span class="sort-header-inner">
            <span class="sort-header-text">${text}</span>
            <span class="sort-icon-wrap" aria-hidden="true">
              <i data-lucide="chevrons-up-down"></i>
            </span>
          </span>
        `;
      }

      if (!isTableSortingInitialized) {
        th.addEventListener("click", () => {
          handleHeaderSortClick(sortKey);
        });

        th.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleHeaderSortClick(sortKey);
          }
        });
      }
    });

    isTableSortingInitialized = true;
    updateSortHeaderUI();
  }

  function handleHeaderSortClick(colKey) {
    if (currentSortCol === colKey) {
      currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
    } else {
      currentSortCol = colKey;
      if (colKey === "name" || colKey === "handle" || colKey === "rank") {
        currentSortDir = "asc";
      } else {
        currentSortDir = "desc";
      }
    }

    try {
      sessionStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({
        column: currentSortCol,
        direction: currentSortDir
      }));
    } catch (_) {}

    currentPage = 1;
    updateSortHeaderUI();
    renderTable();
  }

  function updateSortHeaderUI() {
    const table = document.getElementById("leaderboard-table");
    if (!table) return;

    const headers = table.querySelectorAll("thead tr th[data-sort]");
    headers.forEach((th) => {
      const key = th.getAttribute("data-sort");
      const isActive = key === currentSortCol;
      const textEl = th.querySelector(".sort-header-text");
      const label = textEl ? textEl.textContent.trim() : key;
      const iconWrap = th.querySelector(".sort-icon-wrap");

      if (isActive) {
        const ariaVal = currentSortDir === "asc" ? "ascending" : "descending";
        const iconName = currentSortDir === "asc" ? "chevron-up" : "chevron-down";
        th.setAttribute("aria-sort", ariaVal);
        th.setAttribute("aria-label", `${label}, sorted ${ariaVal}. Activate to reverse order.`);
        if (iconWrap) {
          iconWrap.innerHTML = `<i data-lucide="${iconName}"></i>`;
        }
      } else {
        th.setAttribute("aria-sort", "none");
        th.setAttribute("aria-label", `${label}. Activate to sort.`);
        if (iconWrap) {
          iconWrap.innerHTML = `<i data-lucide="chevrons-up-down"></i>`;
        }
      }
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Render Full Contributor Standings Table (Exclusively Community Contributors)
  function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    updateTierPillCounts();

    const allCommunityContributors = getCommunityContributors().map((item, idx) => {
      return {
        ...item,
        rank: idx + 1
      };
    });

    const communityContributors = allCommunityContributors.filter(item => {
      if (!matchesTier(item, currentTierFilter)) return false;
      if (!tableSearchQuery) return true;
      const q = tableSearchQuery;
      const nameMatch = (item.name || "").toLowerCase().includes(q);
      const loginMatch = (item.login || "").toLowerCase().includes(q);
      const roleMatch = (item.role || "").toLowerCase().includes(q);
      const badges = getContributorBadges(item);
      const badgeMatch = badges.some(b => (b.label || "").toLowerCase().includes(q));
      const gamesList = Array.isArray(item.games) ? item.games : [];
      const gameMatch = gamesList.some(g => typeof g === "string" && g.toLowerCase().includes(q));
      return nameMatch || loginMatch || roleMatch || badgeMatch || gameMatch;
    });

    const sortedContributors = sortCommunityContributors(communityContributors, currentSortCol, currentSortDir);
    const totalItems = sortedContributors.length;

    if (totalItems === 0) {
      if (paginationBar) paginationBar.style.display = "none";
      const emptyTr = document.createElement("tr");
      if ((tableSearchQuery || currentTierFilter !== "all") && allCommunityContributors.length > 0) {
        let emptyMsg = `No contributors found`;
        if (currentTierFilter !== "all" && tableSearchQuery) {
          emptyMsg = `No contributors in the selected tier matching "<strong>${escapeHTML(tableSearchQuery)}</strong>"`;
        } else if (currentTierFilter !== "all") {
          emptyMsg = `No contributors currently in this milestone tier`;
        } else {
          emptyMsg = `No contributors found matching "<strong>${escapeHTML(tableSearchQuery)}</strong>"`;
        }
        emptyTr.innerHTML = `
          <td colspan="9" style="text-align: center; padding: 2.2rem; color: var(--text-muted);">
            <div style="font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--text-secondary);">
              ${emptyMsg}
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="reset-table-search-btn">
              <span><i data-lucide="rotate-ccw"></i> Clear Filters</span>
            </button>
          </td>
        `;
        tableBody.appendChild(emptyTr);
        const resetBtn = emptyTr.querySelector("#reset-table-search-btn");
        if (resetBtn) {
          resetBtn.addEventListener("click", () => {
            tableSearchQuery = "";
            currentTierFilter = "all";
            currentPage = 1;
            if (searchInput) searchInput.value = "";
            tierPillButtons.forEach(b => {
              const isAll = (b.dataset.tier || "all") === "all";
              b.classList.toggle("active", isAll);
              b.setAttribute("aria-selected", isAll ? "true" : "false");
            });
            renderTable();
          });
        }
        if (window.lucide) lucide.createIcons();
        return;
      }
      emptyTr.innerHTML = `
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i data-lucide="sparkles" style="margin-right: 0.4rem;"></i> Awaiting first community PR merges! Be the first contributor to claim Rank #1.
        </td>
      `;
      tableBody.appendChild(emptyTr);
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Pagination computation
    let itemsToRender = sortedContributors;
    let totalPages = 1;
    let startIdx = 0;
    let endIdx = totalItems;

    if (pageSize !== "all") {
      const limit = typeof pageSize === "number" ? pageSize : 10;
      totalPages = Math.max(1, Math.ceil(totalItems / limit));
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      startIdx = (currentPage - 1) * limit;
      endIdx = Math.min(startIdx + limit, totalItems);
      itemsToRender = sortedContributors.slice(startIdx, endIdx);
    } else {
      currentPage = 1;
      totalPages = 1;
    }
    currentTotalPages = totalPages;

    itemsToRender.forEach((item) => {
      const rank = item.rank;
      const score = calculateScore(item);
      const badges = getContributorBadges(item);
      const fallbackAvatar = getFallbackAvatarSvg(item.name, item.login);

      let rankBadgeHtml = `<span class="rank-tag">#${rank}</span>`;
      if (rank === 1) {
        rankBadgeHtml = `<span class="rank-tag rank-1"><i data-lucide="trophy"></i> #1</span>`;
      } else if (rank === 2) {
        rankBadgeHtml = `<span class="rank-tag rank-2"><i data-lucide="medal"></i> #2</span>`;
      } else if (rank === 3) {
        rankBadgeHtml = `<span class="rank-tag rank-3"><i data-lucide="medal"></i> #3</span>`;
      }

      const gamesList = Array.isArray(item.games) ? item.games : [];
      const matchingGames = tableSearchQuery
        ? gamesList.filter(g => typeof g === "string" && g.toLowerCase().includes(tableSearchQuery))
        : [];

      const userMatchingGameHint = matchingGames.length > 0
        ? `<div class="user-matching-game-hint" style="margin-top: 0.25rem;">
            <span style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; color: #00f0ff; background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 4px; padding: 0.1rem 0.4rem;" title="${escapeAttr(matchingGames.join(', '))}">
              <i data-lucide="gamepad-2" style="width: 10px; height: 10px; flex-shrink: 0;"></i>
              <span>${highlightMatch(matchingGames[0], tableSearchQuery)}</span>
              ${matchingGames.length > 1 ? `<span style="font-size: 0.68rem; opacity: 0.8;">+${matchingGames.length - 1}</span>` : ""}
            </span>
          </div>`
        : "";

      const displayedChips = matchingGames.slice(0, 2);
      const remainingCount = matchingGames.length - displayedChips.length;
      const matchingChipsHtml = matchingGames.length > 0
        ? `<div class="matching-games-chips" style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; margin-top: 0.35rem;">
            ${displayedChips.map(g => `
              <span class="matching-game-chip" title="${escapeAttr(g)}" style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.55rem; font-size: 0.72rem; font-weight: 600; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 999px; color: #38bdf8; max-width: 175px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-shadow: 0 0 8px rgba(0, 240, 255, 0.18);">
                <i data-lucide="gamepad-2" style="width: 11px; height: 11px; flex-shrink: 0;"></i>
                <span>${highlightMatch(g, tableSearchQuery)}</span>
              </span>
            `).join("")}
            ${remainingCount > 0 ? `
              <span class="matching-game-chip-more" title="${escapeAttr(matchingGames.slice(2).join(', '))}" style="display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.68rem; color: var(--text-muted); padding: 0.05rem 0.4rem;">
                +${remainingCount} more matching
              </span>
            ` : ""}
          </div>`
        : "";
      const safeAvatarUrl = sanitizeAvatarUrl(item.avatar_url, fallbackAvatar);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rankBadgeHtml}</td>
        <td>
          <div class="table-user-cell">
            <img src="${escapeAttr(safeAvatarUrl)}" alt="${escapeAttr(item.name || item.login)}" class="table-user-avatar">
            <div>
              <strong class="user-display-name">${highlightMatch(item.name, tableSearchQuery)}</strong>
              <span class="user-handle-sub">@${highlightMatch(item.login, tableSearchQuery)}</span>
              ${userMatchingGameHint}
            </div>
          </div>
        </td>
        <td>
          <div class="contributor-badges-wrap">
            ${badges.map(renderBadgeHtml).join("")}
          </div>
        </td>
        <td>
          <a href="https://github.com/${escapeAttr(item.login)}" target="_blank" rel="noopener noreferrer" class="github-handle-link">@${highlightMatch(item.login, tableSearchQuery)}</a>
        </td>
        <td style="text-align: center;">
          ${(item.gamesCount || 0) > 0 ? `
            <button type="button" class="authored-games-pill games-count-pill" data-action="open-author-drawer" data-handle="${escapeAttr(item.login)}" data-author="${escapeAttr(item.name || item.login)}" aria-label="View ${item.gamesCount} verified game${item.gamesCount === 1 ? '' : 's'} authored by ${escapeAttr(item.name || item.login)}" title="Click to view and launch authored games">
              <i data-lucide="gamepad-2"></i> ${item.gamesCount} ${item.gamesCount === 1 ? 'Game' : 'Games'}
            </button>
          ` : `
            <span class="authored-games-pill games-count-pill zero" title="No verified games submitted yet">
              <i data-lucide="gamepad-2"></i> 0 Games
            </span>
          `}
          ${matchingChipsHtml}
        </td>
        <td style="text-align: center;">
          <span class="files-count-pill" title="Universal Score: ${(item.gamesCount || 0) * 100}p (Games) + ${(item.mechanicsBonus || 0) * 25}p (Mechanics) + ${(item.platformPRs || 0) * 50}p (Feat) + ${(item.qualityPRs || 0) * 25}p (Fix) + ${(item.commits || 0) * 5}p (Commits)"><i data-lucide="git-pull-request"></i> ${getWorkBreakdown(item)}</span>
        </td>
        <td style="text-align: center;">
          <span class="commits-count-pill contributor-commits-heatmap-btn" data-action="open-heatmap-modal" data-player="${escapeAttr(item.name || item.login)}" data-handle="${escapeAttr(item.login)}" data-commits="${item.commits || 0}" style="cursor: pointer;" title="Click to view Git commit activity heatmap"><i data-lucide="git-commit"></i> ${item.commits}</span>
        </td>
        <td style="text-align: center;">
          <div class="activity-links-group">
            <a href="https://github.com/DebasmitaBose0/ArcadeVerse/issues?q=author%3A${escapeAttr(item.login)}" target="_blank" rel="noopener noreferrer" class="activity-link-btn" title="View Issues authored by @${escapeAttr(item.login)}">
              <i data-lucide="circle-dot"></i> Issues
            </a>
            <a href="https://github.com/DebasmitaBose0/ArcadeVerse/pulls?q=author%3A${escapeAttr(item.login)}" target="_blank" rel="noopener noreferrer" class="activity-link-btn" title="View Pull Requests by @${escapeAttr(item.login)}">
              <i data-lucide="git-pull-request"></i> PRs
            </a>
            <button type="button" class="activity-link-btn table-trophy-btn" data-action="open-trophy-card" data-player="${escapeAttr(item.name || item.login)}" data-handle="${escapeAttr(item.login)}" data-avatar="${escapeAttr(item.avatar_url || '')}" data-score="${score} PTS" data-game="Contributor Milestone" data-rank="#${rank} Contributor" data-badge="NSOC 2026" title="Generate Verified Achievement Certificate">
              <i data-lucide="award"></i> Certificate
            </button>
          </div>
        </td>
        <td style="text-align: right;">
          <strong class="score-highlight">${score} pts</strong>
        </td>
      `;

      const userImg = tr.querySelector(".table-user-avatar");
      if (userImg) {
        attachAvatarFallback(userImg, fallbackAvatar);
      }

      tableBody.appendChild(tr);
    });

    renderPaginationUI(totalItems, totalPages, startIdx, endIdx);
    updateSortHeaderUI();

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function renderPaginationUI(totalItems, totalPages, startIdx, endIdx) {
    if (!paginationBar) return;
    paginationBar.style.display = "flex";

    if (paginationInfo) {
      if (pageSize === "all") {
        paginationInfo.textContent = `Showing all ${totalItems} contributor${totalItems !== 1 ? "s" : ""}`;
      } else {
        paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalItems} contributor${totalItems !== 1 ? "s" : ""}`;
      }
    }

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
    }

    if (pagesContainer) {
      pagesContainer.innerHTML = "";

      if (totalPages <= 1) {
        const singleBtn = document.createElement("button");
        singleBtn.type = "button";
        singleBtn.className = "pagination-page-btn active";
        singleBtn.textContent = "1";
        singleBtn.disabled = true;
        pagesContainer.appendChild(singleBtn);
        return;
      }

      const pageList = getPageNumbers(currentPage, totalPages);
      pageList.forEach(p => {
        if (p === "...") {
          const ellipsis = document.createElement("span");
          ellipsis.className = "pagination-ellipsis";
          ellipsis.textContent = "...";
          pagesContainer.appendChild(ellipsis);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `pagination-page-btn ${p === currentPage ? "active" : ""}`;
          btn.textContent = p;
          btn.setAttribute("aria-label", `Page ${p}`);
          if (p === currentPage) {
            btn.setAttribute("aria-current", "page");
          }
          btn.addEventListener("click", () => {
            if (currentPage !== p) {
              currentPage = p;
              renderTable();
              scrollToTable();
            }
          });
          pagesContainer.appendChild(btn);
        }
      });
    }
  }

  // Update Dedicated Admin Card at the top with live metadata
  function updateAdminSpotlight(adminUser) {
    if (!adminUser || !adminMetaInfo) return;
    if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
      const userGames = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === "debasmitabose0");
      if (userGames.length > 0) {
        adminUser.gamesCount = userGames.length;
        adminUser.games = userGames.map(g => g.title);
      }
    }
    const score = calculateScore(adminUser);
    adminMetaInfo.textContent = `${adminUser.commits} Commits • ${adminUser.gamesCount} Games • ${score} pts`;

    // Ensure Admin Trophy Certificate button has direct CORS-enabled avatar URL
    const adminTrophyBtn = document.querySelector('.admin-stats-badge [data-action="open-trophy-card"]');
    if (adminTrophyBtn) {
      adminTrophyBtn.dataset.avatar = adminUser.avatar_url || "https://avatars.githubusercontent.com/u/144198639?v=4";
      adminTrophyBtn.dataset.handle = adminUser.login || "DebasmitaBose0";
      adminTrophyBtn.dataset.player = adminUser.name || "Debasmita Bose";
      adminTrophyBtn.dataset.score = `${score} PTS`;
      adminTrophyBtn.dataset.rank = "Project Lead & Core Architect";
      adminTrophyBtn.dataset.game = "Core Platform & Quantum Matrix";
    }

    const adminBadgesContainer = document.getElementById("admin-badges-row");
    if (adminBadgesContainer) {
      const badges = getContributorBadges(adminUser);
      adminBadgesContainer.innerHTML = badges.map(renderBadgeHtml).join("");
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }

  // Resolve display name synchronously without secondary API calls
  function resolveDisplayName(login) {
    if (!login) return "Contributor";
    const lower = login.toLowerCase();

    // Check CONTRIBUTORS_REGISTRY first
    if (typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY)) {
      const match = CONTRIBUTORS_REGISTRY.find(c => c.github && c.github.toLowerCase() === lower);
      if (match && match.name) return match.name;
    }

    // Check GAMES_REGISTRY
    if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
      const match = GAMES_REGISTRY.find(g => g.github && g.github.toLowerCase() === lower);
      if (match && match.author) return match.author;
    }

    return login;
  }

  // Live GitHub Contributions with LocalStorage TTL Cache & Zero Secondary Requests
  async function fetchLiveGitHubContributions(repo = "DebasmitaBose0/ArcadeVerse", forceRefresh = false) {
    if (!repo) return;

    // Check LocalStorage Cache first (unless force-refreshed)
    if (!forceRefresh) {
      try {
        const cachedRaw = localStorage.getItem(`${CACHE_KEY}_${repo}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const isFresh = (Date.now() - cached.timestamp) < CACHE_TTL;
          if (isFresh && Array.isArray(cached.data) && cached.data.length > 0) {
            contributorsData = cached.data.map(user => {
              const uLower = (user.login || "").toLowerCase();
              let regTitles = [];
              if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
                regTitles = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === uLower).map(g => g.title);
              }
              let contribFallback = [];
              if (typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY)) {
                const regContrib = CONTRIBUTORS_REGISTRY.find(c => c.github && c.github.toLowerCase() === uLower);
                if (regContrib && Array.isArray(regContrib.contributions)) {
                  contribFallback = regContrib.contributions.filter(c => c && c !== "Quality & Platform Contribution");
                }
              }
              const existingGames = Array.isArray(user.games) ? user.games : [];
              const combinedGames = Array.from(new Set([...regTitles, ...contribFallback, ...existingGames]));
              user.games = combinedGames;
              user.gamesCount = Math.max(regTitles.length, combinedGames.length, user.gamesCount || 0);
              return user;
            });
            // Merge any missing registry contributors into cached list
            if (typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY)) {
              CONTRIBUTORS_REGISTRY.forEach(reg => {
                if (!contributorsData.some(c => c.login && c.login.toLowerCase() === reg.github.toLowerCase())) {
                  let regGames = (reg.contributions || []).filter(c => c && c !== "Quality & Platform Contribution");
                  if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
                    const uGames = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === reg.github.toLowerCase()).map(g => g.title);
                    regGames = Array.from(new Set([...uGames, ...regGames]));
                  }
                  contributorsData.push({
                    login: reg.github,
                    name: reg.name,
                    role: reg.role || "Community Contributor",
                    avatar_url: `https://github.com/${reg.github}.png`,
                    commits: reg.commits || 1,
                    gamesCount: Math.max(regGames.length, reg.gamesCount || 0),
                    mechanicsBonus: reg.mechanicsBonus || 0,
                    platformPRs: reg.platformPRs || 0,
                    qualityPRs: reg.qualityPRs || 0,
                    bonusPts: reg.bonusPts || 0,
                    games: regGames
                  });
                }
              });
            }
            // Also merge any developers from GAMES_REGISTRY missing in cached data
            if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
              GAMES_REGISTRY.forEach(game => {
                if (!game.github) return;
                const ghLower = game.github.toLowerCase();
                const existing = contributorsData.find(c => c.login && c.login.toLowerCase() === ghLower);
                if (existing) {
                  if (!existing.games.includes(game.title)) {
                    existing.games.push(game.title);
                  }
                  existing.gamesCount = Math.max(existing.games.length, existing.gamesCount || 0);
                } else {
                  contributorsData.push({
                    login: game.github,
                    name: game.author || game.github,
                    role: game.role || "Arcade Developer",
                    avatar_url: `https://github.com/${game.github}.png`,
                    commits: 1,
                    gamesCount: 1,
                    mechanicsBonus: 0,
                    platformPRs: 0,
                    qualityPRs: 0,
                    bonusPts: 0,
                    games: [game.title]
                  });
                }
              });
            }

            const adminItem = contributorsData.find(c => c.login && c.login.toLowerCase() === "debasmitabose0");
            if (adminItem) updateAdminSpotlight(adminItem);

            renderPodium();
            renderTable();
            if (syncStatusText) {
              const minutesAgo = Math.floor((Date.now() - cached.timestamp) / 60000);
              syncStatusText.textContent = `Cached GitHub data (${minutesAgo}m ago • ${contributorsData.length} contributors)`;
            }
            return;
          }
        }
      } catch (e) {
        console.warn("Could not read from cache:", e);
      }
    }

    if (syncStatusText) syncStatusText.textContent = `Connecting to GitHub API (${repo})...`;

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/contributors`);

      if (response.status === 403) {
        throw new Error("RATE_LIMIT");
      }

      if (!response.ok) {
        throw new Error(`GitHub returned status: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        // Filter out automated bot accounts so only real human contributors are registered
        const validUsers = data.filter(u => u.type !== "Bot" && !isBotAccount(u.login));

        // Map contributors in O(1) time per item - ZERO secondary network requests!
        const enrichedContributors = validUsers.map((user) => {
          const isAdmin = user.login.toLowerCase() === "debasmitabose0";

          // Check if contributor exists in CONTRIBUTORS_REGISTRY or initial baseline data
          let registryEntry = null;
          if (typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY)) {
            registryEntry = CONTRIBUTORS_REGISTRY.find(c => c.github && c.github.toLowerCase() === user.login.toLowerCase());
          }
          const localEntry = contributorsData.find(c => c.login && c.login.toLowerCase() === user.login.toLowerCase());

          const displayName = registryEntry ? registryEntry.name : (localEntry ? localEntry.name : resolveDisplayName(user.login));

          // Count registered games from GAMES_REGISTRY
          let userGames = [];
          if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
            userGames = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === user.login.toLowerCase());
          }
          const regTitles = userGames.map(g => g.title);
          const fallbackReg = (registryEntry?.contributions || []).filter(c => c && c !== "Quality & Platform Contribution");
          const localGames = Array.isArray(localEntry?.games) ? localEntry.games : [];
          const adminDefaultGames = isAdmin ? ["Cosmic Surge: Galaxy Defender", "Cyber Neon Pong", "Quantum Memory Matrix"] : [];
          const allUserGames = Array.from(new Set([...regTitles, ...fallbackReg, ...localGames, ...adminDefaultGames]));
          const gamesCount = Math.max(
            userGames.length,
            allUserGames.length,
            registryEntry ? (registryEntry.gamesCount || 0) : 0,
            localEntry ? (localEntry.gamesCount || 0) : 0,
            isAdmin ? 3 : 0
          );

          const mechanicsBonus = registryEntry?.mechanicsBonus ?? localEntry?.mechanicsBonus ?? (isAdmin ? 2 : 0);
          const platformPRs = registryEntry?.platformPRs ?? localEntry?.platformPRs ?? (isAdmin ? 2 : 0);
          const qualityPRs = registryEntry?.qualityPRs ?? localEntry?.qualityPRs ?? (isAdmin ? 0 : 1);
          const bonusPts = registryEntry?.bonusPts ?? localEntry?.bonusPts ?? 0;

          const commits = Math.max(user.contributions || 0, registryEntry?.commits || 0, localEntry?.commits || 0);

          return {
            login: user.login,
            name: displayName,
            avatar_url: user.avatar_url,
            commits: commits,
            gamesCount: gamesCount,
            mechanicsBonus: mechanicsBonus,
            platformPRs: platformPRs,
            qualityPRs: qualityPRs,
            bonusPts: bonusPts,
            games: allUserGames
          };
        });

        // Ensure all verified contributors from local registry remain present
        contributorsData.forEach(c => {
          if (!enrichedContributors.some(ec => ec.login.toLowerCase() === c.login.toLowerCase())) {
            enrichedContributors.push(c);
          }
        });

        contributorsData = enrichedContributors;

        const cachePayload = JSON.stringify({
          timestamp: Date.now(),
          data: enrichedContributors
        });

        if (window.ArcadeStorageResilience && typeof window.ArcadeStorageResilience.safeSetItem === "function") {
          window.ArcadeStorageResilience.safeSetItem(`${CACHE_KEY}_${repo}`, cachePayload);
        } else {
          try {
            localStorage.setItem(`${CACHE_KEY}_${repo}`, cachePayload);
          } catch (e) {
            console.warn("Could not save to cache:", e);
          }
        }

        const adminUser = contributorsData.find(c => c.login.toLowerCase() === "debasmitabose0");
        if (adminUser) updateAdminSpotlight(adminUser);

        const communityCount = contributorsData.filter(c => c.login.toLowerCase() !== "debasmitabose0" && !isBotAccount(c.login)).length;
        if (syncStatusText) syncStatusText.textContent = `GitHub Live Sync: 1 Admin Lead • ${communityCount} Community Contributor(s) active`;
      }
    } catch (err) {
      console.warn("GitHub API notice:", err.message);
      if (syncStatusText) {
        syncStatusText.innerHTML = err.message === "RATE_LIMIT"
          ? `<i data-lucide="alert-triangle" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; color: #f59e0b;"></i> GitHub API rate limit reached (60/hr). Showing cached/local data.`
          : `Offline/Cached state: ${repo} (Rate limit safe)`;
        if (window.lucide) lucide.createIcons();
      }
    }

    // Render Clean Contributor Views
    renderPodium();
    renderTable();
  }

  function detectRepo() {
    if (repoInput && repoInput.value.trim() && repoInput.value.trim() !== "DebasmitaBose0/ArcadeVerse") {
      return repoInput.value.trim();
    }
    if (typeof window !== "undefined" && window.location) {
      if (window.location.hostname.endsWith(".github.io")) {
        const owner = window.location.hostname.split(".")[0];
        const pathSegments = window.location.pathname.split("/").filter(Boolean);
        const repoName = pathSegments.length > 0 ? pathSegments[0] : "ArcadeVerse";
        return `${owner}/${repoName}`;
      }
    }
    return repoInput ? repoInput.value.trim() : "DebasmitaBose0/ArcadeVerse";
  }

  // The rows both exports are built from, so the CSV, JSON, and Markdown always list the
  // same people in the same order as the Community Contributors table.
  function getStandingsRows(onlyFiltered = false) {
    const all = getCommunityContributors().map((item, idx) => ({
      ...item,
      rank: idx + 1,
      name: item.name || "",
      login: item.login || "",
      role: item.role || "",
      games: item.gamesCount || 0,
      commits: item.commits || 0,
      score: calculateScore(item),
    }));

    const filtered = onlyFiltered
      ? all.filter(item => {
        if (!matchesTier(item, currentTierFilter)) return false;
        if (!tableSearchQuery) return true;
        const q = tableSearchQuery.toLowerCase().trim();
        const nameMatch = (item.name || "").toLowerCase().includes(q);
        const loginMatch = (item.login || "").toLowerCase().includes(q);
        const roleMatch = (item.role || "").toLowerCase().includes(q);
        const badges = getContributorBadges(item);
        const badgeMatch = badges.some(b => (b.label || "").toLowerCase().includes(q));
        return nameMatch || loginMatch || roleMatch || badgeMatch;
      })
      : all;

    return sortCommunityContributors(filtered, currentSortCol, currentSortDir);
  }

  function downloadTextFile(content, mimeType, filename) {
    // Prepend UTF-8 Byte Order Mark (\uFEFF) for CSV to ensure correct character encoding in Excel & Calc
    const payload = mimeType.includes("csv") && !content.startsWith("\uFEFF")
      ? "\uFEFF" + content
      : content;
    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // Double quotes escape inside quotes, wraps all fields safely
    return '"' + str.replace(/"/g, '""') + '"';
  }

  function exportStandingsCsv() {
    const list = getStandingsRows(true);
    if (list.length === 0) return;

    const headers = ["Rank", "Contributor", "GitHub Handle", "Verified Games", "Commits", "Arcade Score"].map(escapeCsvCell);
    const rows = list.map((row) => {
      return [
        row.rank,
        escapeCsvCell(row.name),
        escapeCsvCell(row.login),
        row.games,
        row.commits,
        row.score
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    downloadTextFile(csvContent, "text/csv;charset=utf-8;", "ArcadeVerse_Leaderboard_NSOC2026.csv");
  }

  function exportStandingsJson() {
    const list = getStandingsRows(true);
    if (list.length === 0) return;

    const standings = list.map((row) => ({
      rank: row.rank,
      name: row.name,
      githubHandle: row.login,
      verifiedGames: row.games,
      commits: row.commits,
      arcadeScore: row.score,
    }));

    downloadTextFile(JSON.stringify(standings, null, 2), "application/json;charset=utf-8;", "ArcadeVerse_Leaderboard_NSOC2026.json");
  }

  // Escape special markdown characters inside table cells
  function escapeMarkdownCell(val) {
    if (val === null || val === undefined) return "";
    return String(val)
      .replace(/\|/g, "\\|")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\r?\n|\r/g, " ")
      .trim();
  }

  // Cross-browser clipboard copy with fallback
  function copyTextToClipboard(text, onSuccess, onError) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        fallbackCopyText(text, onSuccess, onError);
      });
    } else {
      fallbackCopyText(text, onSuccess, onError);
    }
  }

  function fallbackCopyText(text, onSuccess, onError) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) {
        if (onSuccess) onSuccess();
      } else {
        if (onError) onError(new Error("execCommand copy returned false"));
      }
    } catch (err) {
      if (onError) onError(err);
    }
  }

  // Export Filtered Contributor Standings as Formatted GitHub Markdown Table (#692)
  function exportStandingsMarkdown() {
    const list = getStandingsRows(true);
    if (!list || list.length === 0) {
      showLeaderboardToast("No contributors to export!");
      return;
    }

    const header = "| Rank | Contributor | Games | Commits | Points |";
    const separator = "| :---: | :--- | :---: | :---: | :---: |";

    const rows = list.map((row) => {
      let contributorStr;
      const cleanName = escapeMarkdownCell(row.name);
      const cleanLogin = escapeMarkdownCell(row.login);

      if (cleanLogin) {
        if (cleanName && cleanName.toLowerCase() !== cleanLogin.toLowerCase()) {
          contributorStr = `[${cleanName}](https://github.com/${cleanLogin}) (@${cleanLogin})`;
        } else {
          contributorStr = `[@${cleanLogin}](https://github.com/${cleanLogin})`;
        }
      } else {
        contributorStr = cleanName || "Anonymous";
      }

      return `| ${row.rank} | ${contributorStr} | ${row.games} | ${row.commits} | ${row.score} |`;
    });

    const markdownTable = [header, separator, ...rows].join("\n");

    copyTextToClipboard(markdownTable, () => {
      showLeaderboardToast("Standings table copied to clipboard!");
    }, () => {
      downloadTextFile(markdownTable, "text/markdown;charset=utf-8;", "ArcadeVerse_Leaderboard_NSOC2026.md");
      showLeaderboardToast("Standings table copied to clipboard!");
    });
  }

  if (fetchBtn) {
    fetchBtn.addEventListener("click", () => {
      const repo = detectRepo();
      fetchBtn.disabled = true;
      fetchBtn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px;"></i> Syncing...`;
      if (window.lucide) lucide.createIcons();
      fetchLiveGitHubContributions(repo, true).finally(() => {
        setTimeout(() => {
          fetchBtn.disabled = false;
          fetchBtn.innerHTML = `<i data-lucide="refresh-cw" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px;"></i> Refresh Stats`;
          if (window.lucide) lucide.createIcons();
        }, 1000);
      });
    });
  }

  // --- Interactive Badge Tooltip Engine ---
  let activeTooltipTarget = null;
  const tooltipEl = document.createElement("div");
  tooltipEl.id = "badge-interactive-tooltip";
  tooltipEl.className = "badge-interactive-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  tooltipEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(tooltipEl);

  function showBadgeTooltip(target) {
    const name = target.getAttribute("data-badge-name");
    const cat = target.getAttribute("data-badge-cat");
    const req = target.getAttribute("data-badge-req");
    if (!name || !req) return;

    activeTooltipTarget = target;
    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-cat">${escapeHTML(cat || "Milestone")}</span>
        <strong class="tooltip-name">${escapeHTML(name)}</strong>
      </div>
      <div class="tooltip-req">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>${escapeHTML(req)}</span>
      </div>
    `;

    tooltipEl.style.display = "block";
    tooltipEl.setAttribute("aria-hidden", "false");

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    let top = rect.top - tooltipRect.height - 8;
    if (top < 10) {
      top = rect.bottom + 8;
    }

    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    tooltipEl.style.top = `${top + window.scrollY}px`;
    tooltipEl.style.left = `${left + window.scrollX}px`;
    tooltipEl.classList.add("visible");
  }

  function hideBadgeTooltip() {
    activeTooltipTarget = null;
    tooltipEl.classList.remove("visible");
    tooltipEl.style.display = "none";
    tooltipEl.setAttribute("aria-hidden", "true");
  }

  document.addEventListener("mouseover", (e) => {
    const badge = e.target.closest(".role-pill-badge[data-badge-req]");
    if (badge) {
      showBadgeTooltip(badge);
    }
  });

  document.addEventListener("mouseout", (e) => {
    const badge = e.target.closest(".role-pill-badge[data-badge-req]");
    if (badge && activeTooltipTarget === badge) {
      hideBadgeTooltip();
    }
  });

  document.addEventListener("focusin", (e) => {
    const badge = e.target.closest(".role-pill-badge[data-badge-req]");
    if (badge) {
      showBadgeTooltip(badge);
    }
  });

  document.addEventListener("focusout", (e) => {
    const badge = e.target.closest(".role-pill-badge[data-badge-req]");
    if (badge && activeTooltipTarget === badge) {
      hideBadgeTooltip();
    }
  });

  // Mobile Tap / Click support
  document.addEventListener("click", (e) => {
    const badge = e.target.closest(".role-pill-badge[data-badge-req]");
    if (badge) {
      if (activeTooltipTarget === badge) {
        hideBadgeTooltip();
      } else {
        showBadgeTooltip(badge);
      }
    } else if (activeTooltipTarget && !tooltipEl.contains(e.target)) {
      hideBadgeTooltip();
    }
  });

  window.addEventListener("scroll", () => {
    if (activeTooltipTarget) {
      hideBadgeTooltip();
    }
  }, { passive: true });

  // --- Badge Legend Modal Controller ---
  const badgeLegendModal = document.getElementById("badge-legend-modal");
  const badgeLegendBackdrop = document.getElementById("badge-legend-backdrop");
  const openBadgeLegendBtn = document.getElementById("open-badge-legend-btn");
  const badgeLegendLinkHint = document.getElementById("badge-legend-link-hint");
  const closeBadgeLegendBtn = document.getElementById("close-badge-legend-btn");

  function openBadgeLegend() {
    if (!badgeLegendModal) return;
    badgeLegendModal.style.display = "flex";
    badgeLegendModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (window.lucide) lucide.createIcons();
    if (closeBadgeLegendBtn) closeBadgeLegendBtn.focus();
  }

  function closeBadgeLegend() {
    if (!badgeLegendModal) return;
    badgeLegendModal.style.display = "none";
    badgeLegendModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (openBadgeLegendBtn) openBadgeLegendBtn.focus();
  }

  if (openBadgeLegendBtn) {
    openBadgeLegendBtn.addEventListener("click", openBadgeLegend);
  }
  if (badgeLegendLinkHint) {
    badgeLegendLinkHint.addEventListener("click", openBadgeLegend);
  }
  if (closeBadgeLegendBtn) {
    closeBadgeLegendBtn.addEventListener("click", closeBadgeLegend);
  }
  if (badgeLegendBackdrop) {
    badgeLegendBackdrop.addEventListener("click", closeBadgeLegend);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && badgeLegendModal && badgeLegendModal.style.display !== "none") {
      closeBadgeLegend();
    }
  });

  // --- Verified Game Author Drawer Controller (#713) ---
  let authorDrawerEl = null;
  let authorDrawerOverlayEl = null;
  let lastFocusedElementBeforeDrawer = null;
  let currentAuthorGames = [];

  function getAuthoredGamesForContributor(handle) {
    if (!handle || typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return [];
    const lower = String(handle).toLowerCase().trim();
    return GAMES_REGISTRY.filter(g => g && g.github && String(g.github).toLowerCase().trim() === lower);
  }

  function ensureAuthorDrawerElements() {
    if (authorDrawerOverlayEl && authorDrawerEl) return;

    let overlay = document.getElementById("author-drawer-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "author-drawer-overlay";
      overlay.className = "author-drawer-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <aside class="author-drawer" id="author-drawer" role="dialog" aria-modal="true" aria-labelledby="author-drawer-title">
          <div class="author-drawer-header">
            <div class="author-drawer-user-info">
              <img class="author-drawer-avatar" id="author-drawer-avatar" src="" alt="">
              <div>
                <h3 class="author-drawer-title" id="author-drawer-title">Authored Games</h3>
                <span class="author-drawer-subtitle" id="author-drawer-subtitle">@contributor</span>
              </div>
            </div>
            <button type="button" class="author-drawer-close" id="author-drawer-close" aria-label="Close author games drawer">
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="author-drawer-search-wrap" id="author-drawer-search-wrap">
            <i data-lucide="search" class="author-drawer-search-icon"></i>
            <input type="text" id="author-drawer-search" class="author-drawer-search-input" placeholder="Search author's games..." aria-label="Search authored games">
          </div>
          <div class="author-drawer-content" id="author-drawer-content" tabindex="0">
            <!-- Game cards injected dynamically -->
          </div>
          <div class="author-drawer-footer">
            <span class="author-drawer-counter" id="author-drawer-counter">0 Verified Games</span>
            <a href="index.html" class="author-drawer-catalog-link">
              <i data-lucide="gamepad-2"></i> All Games
            </a>
          </div>
        </aside>
      `;
      document.body.appendChild(overlay);
    }

    authorDrawerOverlayEl = overlay;
    authorDrawerEl = overlay.querySelector("#author-drawer");

    const closeBtn = overlay.querySelector("#author-drawer-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeAuthorGamesDrawer);
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeAuthorGamesDrawer();
      }
    });

    const searchInput = overlay.querySelector("#author-drawer-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        renderDrawerGamesList(query);
      });
    }

    const contentEl = overlay.querySelector("#author-drawer-content");
    if (contentEl) {
      contentEl.addEventListener("click", (e) => {
        const playBtn = e.target.closest(".author-game-play-btn");
        if (playBtn) return; // Native link navigation handles it
        const card = e.target.closest(".author-game-card");
        if (card) {
          const gameId = card.getAttribute("data-game-id");
          if (gameId) {
            window.location.href = `index.html?game=${encodeURIComponent(gameId)}`;
          }
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && authorDrawerOverlayEl && authorDrawerOverlayEl.classList.contains("open")) {
        closeAuthorGamesDrawer();
      }
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function openAuthorGamesDrawer(handle, authorName, triggerEl) {
    ensureAuthorDrawerElements();
    lastFocusedElementBeforeDrawer = triggerEl || document.activeElement;

    const games = getAuthoredGamesForContributor(handle);
    currentAuthorGames = games;

    const titleEl = authorDrawerEl.querySelector("#author-drawer-title");
    const subtitleEl = authorDrawerEl.querySelector("#author-drawer-subtitle");
    const avatarEl = authorDrawerEl.querySelector("#author-drawer-avatar");
    const searchInput = authorDrawerEl.querySelector("#author-drawer-search");

    if (titleEl) titleEl.textContent = authorName ? `${authorName}'s Games` : "Authored Games";
    if (subtitleEl) subtitleEl.textContent = `@${handle}`;
    if (avatarEl) {
      avatarEl.style.display = "block";
      const fallbackDrawerSvg = getFallbackAvatarSvg(authorName || handle, handle);
      const targetAvatarUrl = `https://github.com/${encodeURIComponent(handle)}.png`;
      avatarEl.src = targetAvatarUrl;
      avatarEl.alt = authorName || handle;
      attachAvatarFallback(avatarEl, fallbackDrawerSvg);
    }
    if (searchInput) {
      searchInput.value = "";
    }

    renderDrawerGamesList("");

    authorDrawerOverlayEl.style.display = "flex";
    requestAnimationFrame(() => {
      authorDrawerOverlayEl.classList.add("open");
      authorDrawerEl.classList.add("open");
      authorDrawerOverlayEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("author-drawer-open");
      const closeBtn = authorDrawerEl.querySelector("#author-drawer-close");
      if (closeBtn) closeBtn.focus();
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function closeAuthorGamesDrawer() {
    if (!authorDrawerOverlayEl || !authorDrawerEl) return;

    authorDrawerOverlayEl.classList.remove("open");
    authorDrawerEl.classList.remove("open");
    authorDrawerOverlayEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("author-drawer-open");

    setTimeout(() => {
      if (!authorDrawerOverlayEl.classList.contains("open")) {
        authorDrawerOverlayEl.style.display = "none";
      }
    }, 300);

    if (lastFocusedElementBeforeDrawer && typeof lastFocusedElementBeforeDrawer.focus === "function") {
      lastFocusedElementBeforeDrawer.focus();
    }
  }

  function renderDrawerGamesList(filterQuery = "") {
    const contentEl = authorDrawerEl.querySelector("#author-drawer-content");
    const counterEl = authorDrawerEl.querySelector("#author-drawer-counter");
    if (!contentEl) return;

    contentEl.innerHTML = "";

    const filtered = currentAuthorGames.filter(g => {
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      const titleMatch = (g.title || "").toLowerCase().includes(q);
      const catMatch = (g.category || "").toLowerCase().includes(q);
      const descMatch = (g.description || "").toLowerCase().includes(q);
      const tagsMatch = Array.isArray(g.tags) && g.tags.some(t => String(t).toLowerCase().includes(q));
      return titleMatch || catMatch || descMatch || tagsMatch;
    });

    if (counterEl) {
      counterEl.textContent = `${filtered.length} of ${currentAuthorGames.length} Game${currentAuthorGames.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      contentEl.innerHTML = `
        <div class="author-drawer-empty">
          <i data-lucide="gamepad-2"></i>
          <p>No games found matching your search.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    filtered.forEach(game => {
      const card = document.createElement("div");
      card.className = "author-game-card";
      card.setAttribute("data-game-id", game.id);

      const safeId = escapeAttr(game.id);
      const safeTitle = escapeHTML(game.title);
      const safeCat = escapeHTML(game.category || "Arcade");
      const safeDesc = escapeHTML(game.description || "Verified community arcade game.");
      const icon = escapeAttr(game.lucideIcon || "gamepad-2");
      const stars = Number.isFinite(Number(game.stars)) ? Number(game.stars) : 5;
      const difficulty = escapeHTML(game.difficulty || "Medium");

      card.innerHTML = `
        <div class="author-game-card-top">
          <div class="author-game-icon-box">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="author-game-info">
            <div class="author-game-badge-row">
              <span class="author-game-cat-tag">${safeCat}</span>
              <span class="author-game-diff-tag diff-${escapeAttr(difficulty.toLowerCase())}">${difficulty}</span>
            </div>
            <h4 class="author-game-title">${safeTitle}</h4>
          </div>
        </div>
        <p class="author-game-desc">${safeDesc}</p>
        <div class="author-game-actions">
          <div class="author-game-rating" title="${stars} Stars">
            <i data-lucide="star"></i>
            <span class="rating-value">${stars}</span>
          </div>
          <a href="index.html?game=${safeId}" class="author-game-play-btn" data-game-id="${safeId}" aria-label="Play ${safeTitle} now">
            <i data-lucide="gamepad-2"></i> Play Now
          </a>
        </div>
      `;

      contentEl.appendChild(card);
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Delegated click handlers for author drawer
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="open-author-drawer"]');
      if (btn) {
        e.preventDefault();
        const handle = btn.getAttribute("data-handle");
        const author = btn.getAttribute("data-author");
        openAuthorGamesDrawer(handle, author, btn);
      }
    });
  }

  if (podiumContainer) {
    podiumContainer.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="open-author-drawer"]');
      if (btn) {
        e.preventDefault();
        const handle = btn.getAttribute("data-handle");
        const author = btn.getAttribute("data-author");
        openAuthorGamesDrawer(handle, author, btn);
      }
    });
  }

  if (adminMetaInfo) {
    adminMetaInfo.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="open-author-drawer"]');
      if (btn) {
        e.preventDefault();
        const handle = btn.getAttribute("data-handle");
        const author = btn.getAttribute("data-author");
        openAuthorGamesDrawer(handle, author, btn);
      }
    });
  }


  // Web Share API & Clipboard One-Click Standings Snippet Generator (#579)
  function showLeaderboardToast(message) {
    let toast = document.getElementById("leaderboard-share-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "leaderboard-share-toast";
      toast.className = "leaderboard-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => {
      toast.classList.remove("visible");
    }, 2800);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='share-standing']");
    if (!btn) return;
    const name = btn.getAttribute("data-name") || "Contributor";
    const handle = btn.getAttribute("data-handle") || "contributor";
    const rank = btn.getAttribute("data-rank") || "1";
    const score = btn.getAttribute("data-score") || "0";

    const shareTitle = `ArcadeVerse Hall of Fame - Rank #${rank}`;
    const shareText = `Check out ${name} (@${handle}) ranked #${rank} on ArcadeVerse with ${score} Arcade Points!`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        showLeaderboardToast("Copied Standings to Clipboard!");
      }).catch(() => {
        showLeaderboardToast("Standing details ready to share!");
      });
    } else {
      showLeaderboardToast("Standing details ready to share!");
    }
  });

  // Anti-Cheat Checksum Score Validation (#576)
  function verifyLocalScoresIntegrity() {
    if (window.ArcadeVerse && window.ArcadeVerse.storage && typeof window.ArcadeVerse.storage.verifySignedScore === 'function') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('av_') && key.endsWith('_signed_score')) {
            const gameId = key.replace(/^av_/, '').replace(/_signed_score$/, '');
            window.ArcadeVerse.storage.verifySignedScore(gameId);
          }
        }
      } catch (_) {}
    }
  }

  // Initial Run: Sync verified registry data first and render podium/table
  verifyLocalScoresIntegrity();
  loadRegistryContributors();
  const activeRepo = detectRepo();
  if (repoInput) repoInput.value = activeRepo;
  const initialAdmin = contributorsData.find(c => c.login.toLowerCase() === "debasmitabose0");
  if (initialAdmin) updateAdminSpotlight(initialAdmin);
  renderPodium();
  initTableSorting();
  renderTable();
  fetchLiveGitHubContributions(activeRepo, false);

  // Contributor Hover Card popover logic (#688)
  let hoverCardTimer = null;
  let activeHoverCard = null;

  function createHoverCard(user, anchorEl) {
    removeHoverCard();
    const score = calculateScore(user);
    const badges = getContributorBadges(user);
    const fallbackAvatar = getFallbackAvatarSvg(user.name, user.login);
    const primaryBadge = badges.length > 0 ? badges[0] : { label: user.role || "Contributor", tagClass: "role-contributor" };

    let userGames = user.games || [];
    if (userGames.length === 0 && typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
      const found = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === (user.login || "").toLowerCase());
      userGames = found.map(g => g.title);
    }

    const safeAvatarUrl = sanitizeAvatarUrl(user.avatar_url, fallbackAvatar);

    const card = document.createElement("div");
    card.className = "contributor-hover-card";
    card.setAttribute("role", "tooltip");
    card.innerHTML = `
      <div class="hover-card-header">
        <img src="${escapeAttr(safeAvatarUrl)}" alt="${escapeAttr(user.name || user.login)}" class="hover-card-avatar">
        <div class="hover-card-meta">
          <strong class="hover-card-name">${escapeHTML(user.name || user.login)}</strong>
          <span class="hover-card-handle">@${escapeHTML(user.login)}</span>
          <span class="hover-card-tier-badge ${escapeAttr(primaryBadge.tagClass || '')}">${escapeHTML(primaryBadge.label || '')}</span>
        </div>
      </div>
      <div class="hover-card-stats">
        <div class="hover-stat">
          <span class="stat-num">${user.commits || 0}</span>
          <span class="stat-lbl">Commits</span>
        </div>
        <div class="hover-stat">
          <span class="stat-num">${userGames.length}</span>
          <span class="stat-lbl">Games</span>
        </div>
        <div class="hover-stat">
          <span class="stat-num">${score}</span>
          <span class="stat-lbl">Points</span>
        </div>
      </div>
      ${userGames.length > 0 ? `
        <div class="hover-card-games">
          <span class="hover-games-title">Top Authored Games</span>
          <div class="hover-games-carousel">
            ${userGames.slice(0, 4).map(title => `<span class="hover-game-chip">${escapeHTML(title)}</span>`).join("")}
          </div>
        </div>
      ` : ''}
      <div class="hover-card-footer">
        <a href="https://github.com/${escapeAttr(user.login)}" target="_blank" rel="noopener noreferrer" class="hover-github-link">
          <i data-lucide="external-link"></i> Verified GitHub Profile
        </a>
      </div>
    `;

    const hoverImg = card.querySelector(".hover-card-avatar");
    if (hoverImg) {
      attachAvatarFallback(hoverImg, fallbackAvatar);
    }

    document.body.appendChild(card);
    activeHoverCard = card;

    // Viewport-aware positioning
    const rect = anchorEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    if (left + cardRect.width > window.innerWidth - 16) {
      left = window.innerWidth - cardRect.width - 16;
    }
    if (top + cardRect.height > window.innerHeight + window.scrollY - 16) {
      top = rect.top + window.scrollY - cardRect.height - 8;
    }

    card.style.top = `${Math.max(8, top)}px`;
    card.style.left = `${Math.max(8, left)}px`;

    card.addEventListener("mouseenter", () => {
      clearTimeout(hoverCardTimer);
    });
    card.addEventListener("mouseleave", () => {
      removeHoverCard();
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function removeHoverCard() {
    clearTimeout(hoverCardTimer);
    if (activeHoverCard) {
      activeHoverCard.remove();
      activeHoverCard = null;
    }
  }

  document.addEventListener("mouseover", (e) => {
    const trigger = e.target.closest(".table-user-cell, .podium-name, .user-display-name, .github-handle-link");
    if (!trigger) return;
    const tr = trigger.closest("tr");
    let login = null;
    if (tr) {
      const link = tr.querySelector(".github-handle-link");
      if (link) login = link.textContent.replace("@", "").trim();
    } else {
      const handleEl = trigger.closest(".podium-card") ? trigger.closest(".podium-card").querySelector(".podium-handle") : null;
      if (handleEl) login = handleEl.textContent.replace("@", "").trim();
    }

    if (!login) return;
    const user = contributorsData.find(c => c.login && c.login.toLowerCase() === login.toLowerCase());
    if (!user) return;

    clearTimeout(hoverCardTimer);
    hoverCardTimer = setTimeout(() => {
      createHoverCard(user, trigger);
    }, 150);
  });

  document.addEventListener("mouseout", (e) => {
    const trigger = e.target.closest(".table-user-cell, .podium-name, .user-display-name, .github-handle-link");
    if (!trigger) return;
    hoverCardTimer = setTimeout(() => {
      if (activeHoverCard && !activeHoverCard.matches(":hover")) {
        removeHoverCard();
      }
    }, 150);
  });

  // App Badging API clear on viewing leaderboard & trophy certificates (#557)
  if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('av_daily_streak_date', today);
    localStorage.setItem('av_unclaimed_streak_count', '0');
  } catch (_) {}

  // Contributor Hover Card popover logic (#716)
  let hoverCardTimer = null;
  let activeHoverCard = null;

  function createHoverCard(user, anchorEl) {
    removeHoverCard();
    const score = calculateScore(user);
    const badges = getContributorBadges(user);
    const fallbackAvatar = getFallbackAvatarSvg(user.name, user.login);
    const primaryBadge = badges.length > 0 ? badges[0] : { label: user.role || "Contributor", tagClass: "role-contributor" };

    let userGames = user.games || [];
    if (userGames.length === 0 && typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
      const found = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === (user.login || "").toLowerCase());
      userGames = found.map(g => g.title);
    }

    const card = document.createElement("div");
    card.className = "contributor-hover-card";
    card.setAttribute("role", "tooltip");
    card.innerHTML = `
      <div class="hover-card-header">
        <img src="${user.avatar_url || fallbackAvatar}" alt="${user.name || user.login}" class="hover-card-avatar" onerror="this.onerror=null; this.src='${fallbackAvatar}';">
        <div class="hover-card-meta">
          <strong class="hover-card-name">${escapeHTML(user.name || user.login)}</strong>
          <span class="hover-card-handle">@${escapeHTML(user.login)}</span>
          <span class="hover-card-tier-badge ${primaryBadge.tagClass || ''}">${escapeHTML(primaryBadge.label || '')}</span>
        </div>
      </div>
      <div class="hover-card-stats">
        <div class="hover-stat">
          <span class="stat-num">${user.commits || 0}</span>
          <span class="stat-lbl">Commits</span>
        </div>
        <div class="hover-stat">
          <span class="stat-num">${userGames.length}</span>
          <span class="stat-lbl">Games</span>
        </div>
        <div class="hover-stat">
          <span class="stat-num">${score}</span>
          <span class="stat-lbl">Points</span>
        </div>
      </div>
      ${userGames.length > 0 ? `
        <div class="hover-card-games">
          <span class="hover-games-title">Top Authored Games</span>
          <div class="hover-games-carousel">
            ${userGames.slice(0, 4).map(title => `<span class="hover-game-chip">${escapeHTML(title)}</span>`).join("")}
          </div>
        </div>
      ` : ''}
      <div class="hover-card-footer">
        <a href="https://github.com/${user.login}" target="_blank" rel="noopener noreferrer" class="hover-github-link">
          <i data-lucide="external-link"></i> Verified GitHub Profile
        </a>
      </div>
    `;

    document.body.appendChild(card);
    activeHoverCard = card;

    // Viewport-aware positioning
    const rect = anchorEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    if (left + cardRect.width > window.innerWidth - 16) {
      left = window.innerWidth - cardRect.width - 16;
    }
    if (top + cardRect.height > window.innerHeight + window.scrollY - 16) {
      top = rect.top + window.scrollY - cardRect.height - 8;
    }

    card.style.top = `${Math.max(8, top)}px`;
    card.style.left = `${Math.max(8, left)}px`;

    card.addEventListener("mouseenter", () => {
      clearTimeout(hoverCardTimer);
    });
    card.addEventListener("mouseleave", () => {
      removeHoverCard();
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function removeHoverCard() {
    clearTimeout(hoverCardTimer);
    if (activeHoverCard) {
      activeHoverCard.remove();
      activeHoverCard = null;
    }
  }

  document.addEventListener("mouseover", (e) => {
    const trigger = e.target.closest(".table-user-cell, .podium-name, .user-display-name, .github-handle-link");
    if (!trigger) return;
    const tr = trigger.closest("tr");
    let login = null;
    if (tr) {
      const link = tr.querySelector(".github-handle-link");
      if (link) login = link.textContent.replace("@", "").trim();
    } else {
      const handleEl = trigger.closest(".podium-card") ? trigger.closest(".podium-card").querySelector(".podium-handle") : null;
      if (handleEl) login = handleEl.textContent.replace("@", "").trim();
    }

    if (!login) return;
    const user = contributorsData.find(c => c.login && c.login.toLowerCase() === login.toLowerCase());
    if (!user) return;

    clearTimeout(hoverCardTimer);
    hoverCardTimer = setTimeout(() => {
      createHoverCard(user, trigger);
    }, 150);
  });

  document.addEventListener("mouseout", (e) => {
    const trigger = e.target.closest(".table-user-cell, .podium-name, .user-display-name, .github-handle-link");
    if (!trigger) return;
    hoverCardTimer = setTimeout(() => {
      if (activeHoverCard && !activeHoverCard.matches(":hover")) {
        removeHoverCard();
      }
    }, 150);
  });
});
