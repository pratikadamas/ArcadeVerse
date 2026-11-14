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

  // Initial verified contributors from repository
  let contributorsData = [];

  // Sync contributors data with local CONTRIBUTORS_REGISTRY and GAMES_REGISTRY
  function loadRegistryContributors() {
    if (typeof CONTRIBUTORS_REGISTRY === "undefined" || !Array.isArray(CONTRIBUTORS_REGISTRY)) return;

    contributorsData = CONTRIBUTORS_REGISTRY.map(regUser => {
      let userGames = [];
      if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
        userGames = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === regUser.github.toLowerCase());
      }
      const gamesCount = userGames.length > 0 ? userGames.length : (regUser.gamesCount || 0);
      const gamesList = userGames.length > 0 ? userGames.map(g => g.title) : (regUser.contributions || []);

      return {
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
    });
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

  // Generate reliable inline SVG letter avatar (prevents 404 network errors & recursion)
  function getFallbackAvatarSvg(name, login) {
    const char = ((name || login || "?").trim().charAt(0) || "?").toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%2306b6d4"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(%23g)"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="%23ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="26" font-weight="700">${char}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

      const card = document.createElement("div");
      card.className = `podium-card ${slot.cardClass}`;
      // Clean, uncluttered card: Rank badge, avatar, name, handle, primary badges, score, and profile link.
      card.innerHTML = `
        <div class="podium-badge podium-badge-${slot.badgeType}">
          <i data-lucide="${slot.badgeIcon}"></i> ${slot.badgeLabel}
        </div>
        <img src="${item.avatar_url || fallbackAvatar}" alt="${item.name}" class="podium-avatar" onerror="this.onerror=null; this.src='${fallbackAvatar}';">
        <h3 class="podium-name">${item.name}</h3>
        <a href="https://github.com/${item.login}" target="_blank" rel="noopener noreferrer" class="podium-handle">@${item.login}</a>
        
        <div class="podium-badges-container">
          ${badges.map(renderBadgeHtml).join("")}
        </div>

        <div class="podium-score-pill">
          <strong>${score}</strong> pts
        </div>
        <div class="podium-sub-stat-text" style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          ${item.gamesCount > 0 ? `<span><i data-lucide="gamepad-2" style="width: 0.8rem; height: 0.8rem;"></i> ${item.gamesCount} Game${item.gamesCount === 1 ? '' : 's'}</span> • ` : ''}
          <span><i data-lucide="git-commit" style="width: 0.8rem; height: 0.8rem;"></i> ${item.commits} Commit${item.commits === 1 ? '' : 's'}</span>
        </div>

        <div class="podium-actions-row">
          <button type="button" class="podium-trophy-btn" data-action="open-trophy-card" data-player="${escapeAttr(item.name || item.login)}" data-handle="${escapeAttr(item.login)}" data-avatar="${escapeAttr(item.avatar_url || '')}" data-score="${score} PTS" data-game="NSOC 2026 Hall of Fame" data-rank="${escapeAttr(slot.badgeLabel)}" data-badge="NSOC 2026" title="Generate Verified Achievement Certificate">
            <i data-lucide="award"></i> Trophy Certificate
          </button>
        </div>
      `;

      podiumContainer.appendChild(card);
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
      return nameMatch || loginMatch || roleMatch || badgeMatch;
    });

    const totalItems = communityContributors.length;

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
    let itemsToRender = communityContributors;
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
      itemsToRender = communityContributors.slice(startIdx, endIdx);
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

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rankBadgeHtml}</td>
        <td>
          <div class="table-user-cell">
            <img src="${item.avatar_url || fallbackAvatar}" alt="${item.name}" class="table-user-avatar" onerror="this.onerror=null; this.src='${fallbackAvatar}';">
            <div>
              <strong class="user-display-name">${highlightMatch(item.name, tableSearchQuery)}</strong>
              <span class="user-handle-sub">@${highlightMatch(item.login, tableSearchQuery)}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="contributor-badges-wrap">
            ${badges.map(renderBadgeHtml).join("")}
          </div>
        </td>
        <td>
          <a href="https://github.com/${item.login}" target="_blank" class="github-handle-link">@${highlightMatch(item.login, tableSearchQuery)}</a>
        </td>
        <td style="text-align: center;">
          <span class="games-count-pill" title="${(item.games || []).join(', ')}"><i data-lucide="gamepad-2"></i> ${item.gamesCount}</span>
        </td>
        <td style="text-align: center;">
          <span class="files-count-pill" title="Universal Score: ${(item.gamesCount || 0) * 100}p (Games) + ${(item.mechanicsBonus || 0) * 25}p (Mechanics) + ${(item.platformPRs || 0) * 50}p (Feat) + ${(item.qualityPRs || 0) * 25}p (Fix) + ${(item.commits || 0) * 5}p (Commits)"><i data-lucide="git-pull-request"></i> ${getWorkBreakdown(item)}</span>
        </td>
        <td style="text-align: center;">
          <span class="commits-count-pill"><i data-lucide="git-commit"></i> ${item.commits}</span>
        </td>
        <td style="text-align: center;">
          <div class="activity-links-group">
            <a href="https://github.com/DebasmitaBose0/ArcadeVerse/issues?q=author%3A${item.login}" target="_blank" rel="noopener noreferrer" class="activity-link-btn" title="View Issues authored by @${item.login}">
              <i data-lucide="circle-dot"></i> Issues
            </a>
            <a href="https://github.com/DebasmitaBose0/ArcadeVerse/pulls?q=author%3A${item.login}" target="_blank" rel="noopener noreferrer" class="activity-link-btn" title="View Pull Requests by @${item.login}">
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
      tableBody.appendChild(tr);
    });

    renderPaginationUI(totalItems, totalPages, startIdx, endIdx);

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
              if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
                const uGames = GAMES_REGISTRY.filter(g => g.github && g.github.toLowerCase() === (user.login || "").toLowerCase());
                if (uGames.length > 0) {
                  user.gamesCount = uGames.length;
                  user.games = uGames.map(g => g.title);
                }
              }
              return user;
            });
            // Merge any missing registry contributors into cached list
            if (typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY)) {
              CONTRIBUTORS_REGISTRY.forEach(reg => {
                if (!contributorsData.some(c => c.login && c.login.toLowerCase() === reg.github.toLowerCase())) {
                  contributorsData.push({
                    login: reg.github,
                    name: reg.name,
                    role: reg.role || "Community Contributor",
                    avatar_url: `https://github.com/${reg.github}.png`,
                    commits: reg.commits || 1,
                    gamesCount: reg.gamesCount || 0,
                    mechanicsBonus: reg.mechanicsBonus || 0,
                    platformPRs: reg.platformPRs || 0,
                    qualityPRs: reg.qualityPRs || 0,
                    bonusPts: reg.bonusPts || 0,
                    games: reg.contributions || []
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
          const gamesCount = userGames.length > 0 
            ? userGames.length 
            : (registryEntry ? (registryEntry.gamesCount || 0) : (localEntry ? (localEntry.gamesCount || 0) : (isAdmin ? 3 : 0)));

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
            games: userGames.length > 0 
              ? userGames.map(g => g.title) 
              : (localEntry?.games && localEntry.games.length > 0 ? localEntry.games : (isAdmin ? ["Cosmic Surge: Galaxy Defender", "Cyber Neon Pong", "Quantum Memory Matrix"] : []))
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

  // The rows both exports are built from, so the CSV and the JSON always list the same people
  // in the same order as the Community Contributors table.
  function getStandingsRows() {
    return getCommunityContributors().map((item, idx) => ({
      rank: idx + 1,
      name: item.name || "",
      login: item.login || "",
      games: item.gamesCount || 0,
      commits: item.commits || 0,
      score: calculateScore(item),
    }));
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
    const list = getStandingsRows();
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
    const list = getStandingsRows();
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

  // Initial Run: Sync verified registry data first and render podium/table
  loadRegistryContributors();
  const activeRepo = detectRepo();
  if (repoInput) repoInput.value = activeRepo;
  const initialAdmin = contributorsData.find(c => c.login.toLowerCase() === "debasmitabose0");
  if (initialAdmin) updateAdminSpotlight(initialAdmin);
  renderPodium();
  renderTable();
  fetchLiveGitHubContributions(activeRepo, false);
});
