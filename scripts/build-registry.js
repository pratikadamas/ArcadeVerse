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

const OVERRIDES_FILE = path.join(ROOT_DIR, 'scripts', 'contributor-overrides.json');

/**
 * Validates the schema and structure of contributor-overrides.json.
 * Enforces versioning, profile object shapes, types, and constraints.
 *
 * @param {object} data
 * @param {string} sourcePath
 */
function validateContributorOverrides(data, sourcePath = 'contributor-overrides.json') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError(`[Schema Error] ${sourcePath}: Root configuration must be an object.`);
  }

  // Enforce versioning
  if (!data.version || typeof data.version !== 'string') {
    throw new TypeError(`[Schema Error] ${sourcePath}: Missing or invalid "version" field (expected semantic version string, e.g. "1.0.0").`);
  }

  const profiles = data.profiles || data.knownProfiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    throw new TypeError(`[Schema Error] ${sourcePath}: Missing or invalid "profiles" mapping object.`);
  }

  for (const [key, profile] of Object.entries(profiles)) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new TypeError(`[Schema Error] ${sourcePath}: Profile entry for "${key}" must be an object.`);
    }

    if (typeof profile.name !== 'string' || !profile.name.trim()) {
      throw new TypeError(`[Schema Error] ${sourcePath}: Profile "${key}" missing required string "name".`);
    }

    if (typeof profile.github !== 'string' || !profile.github.trim()) {
      throw new TypeError(`[Schema Error] ${sourcePath}: Profile "${key}" missing required string "github".`);
    }

    if (profile.role !== undefined && typeof profile.role !== 'string') {
      throw new TypeError(`[Schema Error] ${sourcePath}: Profile "${key}" property "role" must be a string.`);
    }

    const numericFields = ['mechanicsBonus', 'platformPRs', 'qualityPRs', 'bonusPts', 'commits'];
    for (const field of numericFields) {
      if (profile[field] !== undefined) {
        if (typeof profile[field] !== 'number' || !Number.isFinite(profile[field]) || profile[field] < 0) {
          throw new TypeError(`[Schema Error] ${sourcePath}: Profile "${key}" property "${field}" must be a non-negative number.`);
        }
      }
    }
  }

  const aliases = data.emailAliases || data.emailMap;
  if (aliases !== undefined) {
    if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
      throw new TypeError(`[Schema Error] ${sourcePath}: "emailAliases" must be an object mapping emails to github usernames.`);
    }
    for (const [email, handle] of Object.entries(aliases)) {
      if (typeof email !== 'string' || !email.includes('@')) {
        throw new TypeError(`[Schema Error] ${sourcePath}: Invalid email address "${email}" in emailAliases.`);
      }
      if (typeof handle !== 'string' || !handle.trim()) {
        throw new TypeError(`[Schema Error] ${sourcePath}: Target handle for email "${email}" must be a non-empty string.`);
      }
    }
  }
}

/**
 * Loads and validates contributor overrides from a JSON configuration file.
 *
 * @param {string} filePath
 * @returns {{ profiles: Record<string, object>, emailAliases: Record<string, string>, raw: object }}
 */
function loadContributorOverrides(filePath = OVERRIDES_FILE) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[Config Error] Contributor overrides file not found: ${filePath}`);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`[Config Error] Unable to read contributor overrides at ${filePath}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`[Config Error] Malformed JSON in contributor overrides at ${filePath}: ${err.message}`);
  }

  validateContributorOverrides(parsed, path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'));

  const profiles = parsed.profiles || parsed.knownProfiles || {};
  const emailAliases = parsed.emailAliases || parsed.emailMap || {};

  return { profiles, emailAliases, raw: parsed };
}

const { profiles: KNOWN_PROFILES, emailAliases: EMAIL_MAP } = loadContributorOverrides(OVERRIDES_FILE);

function getGitCommitCounts(emailMap = EMAIL_MAP) {
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

function buildRegistry(options = {}) {
  if (!fs.existsSync(GAMES_DIR)) {
    console.error(`Error: games directory not found at ${GAMES_DIR}`);
    process.exit(1);
  }

  const targetRegistryFile = options.registryFile || REGISTRY_FILE;
  const activeProfiles = options.profiles || KNOWN_PROFILES;
  const activeEmailMap = options.emailAliases || EMAIL_MAP;

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
      const authorName = (activeProfiles[ghKey] && activeProfiles[ghKey].name) || meta.author || "Contributor";

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
  const gitCommits = getGitCommitCounts(activeEmailMap);

  // 3. Collect all unique contributors across games, git, and known profiles
  const allUserKeys = new Set([
    ...contributorGames.keys(),
    ...gitCommits.keys(),
    ...Object.keys(activeProfiles)
  ]);

  const contributorsRegistry = [];

  for (const key of allUserKeys) {
    if (!key || key.includes('bot')) continue;

    const profile = activeProfiles[key] || {};
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

  fs.writeFileSync(targetRegistryFile, code, 'utf8');
  console.log(`[OK] Successfully compiled ${gamesRegistry.length} games and ${cleanContributors.length} contributors into ${path.relative(ROOT_DIR, targetRegistryFile)}`);
  return { gamesRegistry, featuresRegistry, contributorsRegistry: cleanContributors };
}

if (require.main === module) {
  buildRegistry();
}

module.exports = {
  buildRegistry,
  loadContributorOverrides,
  validateContributorOverrides,
  OVERRIDES_FILE,
  KNOWN_PROFILES,
  EMAIL_MAP
};
