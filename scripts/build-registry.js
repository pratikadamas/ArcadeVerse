/**
 * ArcadeVerse Registry Auto-Generator
 * Automatically scans all games in games/<game-name_contributor-name>/game.json
 * Automatically audits git commit history to extract live contributor commit numbers
 * Compiles assets/js/games-registry.js dynamically without hardcoded limits.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT_DIR, 'games');
const REGISTRY_FILE = path.join(ROOT_DIR, 'assets', 'js', 'games-registry.js');

const OVERRIDES_FILE = path.join(__dirname, 'contributor-overrides.json');

/**
 * Validates and loads contributor overrides from external JSON configuration
 * Enforces strict schema sanity checks to prevent malformed profile injections
 */
function loadContributorOverrides(filePath = OVERRIDES_FILE) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Notice] Contributor overrides file not found at ${filePath}. Proceeding with defaults.`);
    return { profiles: {}, emailMap: {} };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('Contributor overrides root payload must be an object.');
    }

    if (data.version && typeof data.version !== 'string') {
      throw new Error('Schema version must be a valid string.');
    }

    const profiles = (data.profiles && typeof data.profiles === 'object' && !Array.isArray(data.profiles))
      ? data.profiles
      : (!data.version && !data.profiles)
        ? data
        : {};

    for (const [key, profile] of Object.entries(profiles)) {
      if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
        throw new Error(`Profile override for "${key}" must be an object.`);
      }
      if (profile.name !== undefined && typeof profile.name !== 'string') {
        throw new Error(`Profile "${key}".name must be a string.`);
      }
      if (profile.github !== undefined && typeof profile.github !== 'string') {
        throw new Error(`Profile "${key}".github must be a string.`);
      }
      if (profile.role !== undefined && typeof profile.role !== 'string') {
        throw new Error(`Profile "${key}".role must be a string.`);
      }
      if (profile.commits !== undefined && typeof profile.commits !== 'number') {
        throw new Error(`Profile "${key}".commits must be a number.`);
      }
      if (profile.mechanicsBonus !== undefined && typeof profile.mechanicsBonus !== 'number') {
        throw new Error(`Profile "${key}".mechanicsBonus must be a number.`);
      }
      if (profile.platformPRs !== undefined && typeof profile.platformPRs !== 'number') {
        throw new Error(`Profile "${key}".platformPRs must be a number.`);
      }
      if (profile.qualityPRs !== undefined && typeof profile.qualityPRs !== 'number') {
        throw new Error(`Profile "${key}".qualityPRs must be a number.`);
      }
      if (profile.bonusPts !== undefined && typeof profile.bonusPts !== 'number') {
        throw new Error(`Profile "${key}".bonusPts must be a number.`);
      }
    }

    const emailMap = (data.emailMap && typeof data.emailMap === 'object' && !Array.isArray(data.emailMap))
      ? data.emailMap
      : {};

    for (const [email, userKey] of Object.entries(emailMap)) {
      if (typeof email !== 'string' || typeof userKey !== 'string') {
        throw new Error(`Email mapping entry for "${email}" must map a string to a string.`);
      }
    }

    return { profiles, emailMap };
  } catch (err) {
    console.error(`[Error] Failed loading/validating contributor overrides from ${filePath}:`, err.message);
    process.exit(1);
  }
}

const { profiles: KNOWN_PROFILES, emailMap: EMAIL_MAP } = loadContributorOverrides();

function getGitCommitCounts() {
  const commitCounts = new Map();
  try {
    const rawShortlog = execSync('git shortlog -sne --all', { cwd: ROOT_DIR, encoding: 'utf8' });
    for (const line of rawShortlog.split('\n')) {
      const match = line.trim().match(/^(\d+)\s+(.+?)\s+<([^>]+)>/);
      if (!match) continue;
      const count = parseInt(match[1], 10);
      const name = match[2].trim();
      const email = match[3].trim().toLowerCase();

      // Skip automated bots
      if (email.includes('github-actions') || email.includes('dependabot') || name.toLowerCase().includes('bot')) {
        continue;
      }

      let ghKey = EMAIL_MAP[email];
      if (!ghKey) {
        const ghMatch = email.match(/(?:\d+\+)?([a-z0-9-]+)@users\.noreply\.github\.com/i);
        if (ghMatch) ghKey = ghMatch[1].toLowerCase();
      }
      if (!ghKey) {
        ghKey = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
      }

      const existing = commitCounts.get(ghKey) || 0;
      commitCounts.set(ghKey, existing + count);
    }
  } catch (err) {
    console.warn(`[Notice] Could not read git commit log: ${err.message}. Using baseline commits.`);
  }
  return commitCounts;
}

// Strict Lucide Icon & Attribute Whitelist Sanitizer (#491)
const LUCIDE_ICON_WHITELIST = new Set([
  "gamepad-2", "gamepad", "play", "play-circle", "trophy", "star",
  "heart", "heart-crack", "search", "x", "refresh-cw", "maximize",
  "maximize-2", "minimize", "external-link", "volume-2", "volume-x",
  "moon", "sun", "help-circle", "file-code-2", "book-open", "chevron-down",
  "chevron-up", "chevron-right", "chevron-left", "shield", "cpu",
  "zap", "award", "crown", "sparkles", "compass", "target", "crosshair",
  "dices", "layers", "timer", "clock", "hash", "code", "terminal",
  "user", "users", "tag", "tags", "filter", "check", "info", "alert-triangle",
  "alert-circle", "eye", "eye-off", "lock", "unlock", "power", "sliders",
  "copy", "download", "folder", "flame", "skull", "ghost", "radar"
]);

function sanitizeMetadataString(val, fallback = "") {
  if (typeof val !== "string") return fallback;
  // Strip control characters, trailing whitespace, and normalize dangerous angle/quote breakouts
  return val
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>"]/g, "")
    .trim() || fallback;
}

function sanitizeIcon(val) {
  if (typeof val !== "string") return "gamepad-2";
  const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
  return LUCIDE_ICON_WHITELIST.has(clean) ? clean : "gamepad-2";
}

function buildRegistry() {
  if (!fs.existsSync(GAMES_DIR)) {
    console.error(`Error: games directory not found at ${GAMES_DIR}`);
    process.exit(1);
  }

  // 1. Compile Games Registry
  const gameEntries = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
  const gameFolders = gameEntries.filter(e => e.isDirectory()).map(e => e.name);

  const gamesRegistry = [];
  const contributorGames = new Map(); // key: ghLower -> Array of game titles
  const contributorMeta = new Map();  // key: ghLower -> { name, role, originalGithub }

  for (const folder of gameFolders) {
    const metaFile = path.join(GAMES_DIR, folder, 'game.json');
    if (!fs.existsSync(metaFile)) {
      console.warn(`[Skip Game] ${folder}: Missing game.json`);
      continue;
    }

    try {
      const raw = fs.readFileSync(metaFile, 'utf8');
      const meta = JSON.parse(raw);

      const gameId = meta.id || folder;
      const htmlPath = `games/${folder}/index.html`;

      const ghKey = (meta.github || "").toLowerCase();
      const authorName = (KNOWN_PROFILES[ghKey] && KNOWN_PROFILES[ghKey].name) || meta.author || "Contributor";

      const gameObj = {
        id: sanitizeMetadataString(gameId, folder),
        title: sanitizeMetadataString(meta.title, folder),
        category: sanitizeMetadataString(meta.category, "Arcade"),
        lucideIcon: sanitizeIcon(meta.lucideIcon),
        description: sanitizeMetadataString(meta.description, ""),
        author: sanitizeMetadataString(authorName, "Contributor"),
        github: sanitizeMetadataString(meta.github, ""),
        role: sanitizeMetadataString(meta.role, "Arcade Developer"),
        path: htmlPath,
        tags: Array.isArray(meta.tags)
          ? meta.tags.map(t => sanitizeMetadataString(t)).filter(Boolean)
          : ["Arcade"],
        stars: typeof meta.stars === 'number' ? meta.stars : 25,
        featured: Boolean(meta.featured)
      };

      if (meta.difficulty) gameObj.difficulty = meta.difficulty;
      if (meta.releaseDate) gameObj.releaseDate = meta.releaseDate;

      gamesRegistry.push(gameObj);

      // Track contributors from games
      if (meta.github) {
        const ghKey = meta.github.toLowerCase();
        if (!contributorGames.has(ghKey)) {
          contributorGames.set(ghKey, []);
          contributorMeta.set(ghKey, {
            name: meta.author || meta.github,
            role: meta.role || "Arcade Developer",
            originalGithub: meta.github
          });
        }
        contributorGames.get(ghKey).push(gameObj.title);
      }
    } catch (err) {
      console.error(`[Error] Failed parsing ${metaFile}:`, err.message);
    }
  }

  // 2. Fetch Git commit counts dynamically
  const gitCommits = getGitCommitCounts();

  // 3. Collect all unique contributors across games, git, and known profiles
  const allUserKeys = new Set([
    ...contributorGames.keys(),
    ...gitCommits.keys(),
    ...Object.keys(KNOWN_PROFILES)
  ]);

  const contributorsRegistry = [];

  for (const key of allUserKeys) {
    if (!key || key.includes('bot')) continue;

    const profile = KNOWN_PROFILES[key] || {};
    const meta = contributorMeta.get(key) || {};
    const gamesList = (contributorGames.get(key) || []).sort();

    const github = profile.github || meta.originalGithub || key;
    const name = profile.name || meta.name || github;
    const avatarInitial = name.charAt(0).toUpperCase();
    const commits = Math.max(gitCommits.get(key) || 0, profile.commits || 1);
    const gamesCount = gamesList.length;
    const mechanicsBonus = profile.mechanicsBonus || 0;
    const platformPRs = profile.platformPRs || 0;
    const qualityPRs = profile.qualityPRs || 0;
    const bonusPts = profile.bonusPts || 0;

    let role = profile.role || meta.role || "Contributor (NSOC '26)";

    const contributions = gamesList.length > 0
      ? gamesList
      : ["Quality & Platform Contribution"];

    // Compute in-app arcade score
    const arcadeScore = (gamesCount * 100) + (mechanicsBonus * 25) + (platformPRs * 50) + (qualityPRs * 25) + (commits * 5) + bonusPts;

    contributorsRegistry.push({
      name,
      github,
      avatarInitial,
      role,
      commits,
      gamesCount,
      mechanicsBonus,
      platformPRs,
      qualityPRs,
      bonusPts,
      contributions,
      arcadeScore
    });
  }

  // Sort contributors: Project Admin first, then by arcadeScore descending
  contributorsRegistry.sort((a, b) => {
    const aIsAdmin = a.github.toLowerCase() === 'debasmitabose0';
    const bIsAdmin = b.github.toLowerCase() === 'debasmitabose0';
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    return b.arcadeScore - a.arcadeScore;
  });

  // Remove helper score property before writing to keep schema clean
  const cleanContributors = contributorsRegistry.map(c => {
    const copy = { ...c };
    delete copy.arcadeScore;
    return copy;
  });

  // Features registry is empty following the retirement of others/
  const featuresRegistry = [];

  const code = `const GAMES_REGISTRY = ${JSON.stringify(gamesRegistry, null, 2)};\n\nconst FEATURES_REGISTRY = ${JSON.stringify(featuresRegistry, null, 2)};\n\nconst CONTRIBUTORS_REGISTRY = ${JSON.stringify(cleanContributors, null, 2)};\n\nif (typeof window !== 'undefined') {\n  window.GAMES_REGISTRY = GAMES_REGISTRY;\n  window.FEATURES_REGISTRY = FEATURES_REGISTRY;\n  window.CONTRIBUTORS_REGISTRY = CONTRIBUTORS_REGISTRY;\n}\n`;

  fs.writeFileSync(REGISTRY_FILE, code, 'utf8');
  console.log(`✅ Successfully compiled ${gamesRegistry.length} games and ${cleanContributors.length} contributors into ${path.relative(ROOT_DIR, REGISTRY_FILE)}`);
}

buildRegistry();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadContributorOverrides,
    KNOWN_PROFILES,
    EMAIL_MAP,
    buildRegistry
  };
}
