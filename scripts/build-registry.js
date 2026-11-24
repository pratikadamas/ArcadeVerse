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

    const rawProfiles = (data.profiles && typeof data.profiles === 'object' && !Array.isArray(data.profiles))
      ? data.profiles
      : (!data.version && !data.profiles)
        ? data
        : {};

    const profiles = {};
    for (const [key, profile] of Object.entries(rawProfiles)) {
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

      // Enforce lowercased canonical lookup key (#715)
      const canonicalKey = key.trim().toLowerCase();
      profiles[canonicalKey] = profile;
    }

    const rawEmailMap = (data.emailMap && typeof data.emailMap === 'object' && !Array.isArray(data.emailMap))
      ? data.emailMap
      : {};

    const emailMap = {};
    for (const [email, userKey] of Object.entries(rawEmailMap)) {
      if (typeof email !== 'string' || typeof userKey !== 'string') {
        throw new Error(`Email mapping entry for "${email}" must map a string to a string.`);
      }
      // Enforce lowercased canonical email and username lookup keys (#715)
      emailMap[email.trim().toLowerCase()] = userKey.trim().toLowerCase();
    }

    return { profiles, emailMap };
  } catch (err) {
    console.error(`[Error] Failed loading/validating contributor overrides from ${filePath}:`, err.message);
    process.exit(1);
  }
}

const { profiles: KNOWN_PROFILES, emailMap: EMAIL_MAP } = loadContributorOverrides();

/**
 * Contributor Username & Email Deduplication Engine (#686)
 * Normalizes Git author handles, email addresses, and known profile mappings
 * to ensure 100% case-insensitive lookup, accurate commit aggregation,
 * and unified profile representation across the ArcadeVerse ecosystem.
 */

class ContributorDeduplicator {
  constructor(knownProfiles = {}, emailMap = {}) {
    this.knownProfiles = knownProfiles;
    this.emailMap = emailMap;
    this.aliasMap = new Map();
    this.alphaNumMap = new Map();
    this.resolutionAuditLog = [];
    this.initIndices();
  }

  /**
   * Initializes bidirectional canonical indices from overrides and known profiles
   */
  initIndices() {
    this.aliasMap.clear();
    this.alphaNumMap.clear();

    // Index known profile canonical keys and aliases
    for (const [canonicalKey, profile] of Object.entries(this.knownProfiles)) {
      const lowerKey = canonicalKey.trim().toLowerCase();
      this.aliasMap.set(lowerKey, lowerKey);

      const stripped = lowerKey.replace(/[^a-z0-9]/g, '');
      if (stripped) {
        this.alphaNumMap.set(stripped, lowerKey);
        this.aliasMap.set(stripped, lowerKey);
      }

      if (profile.github) {
        const ghLower = profile.github.trim().toLowerCase();
        this.aliasMap.set(ghLower, lowerKey);
        const ghStripped = ghLower.replace(/[^a-z0-9]/g, '');
        if (ghStripped) {
          this.alphaNumMap.set(ghStripped, lowerKey);
          this.aliasMap.set(ghStripped, lowerKey);
        }
      }

      if (profile.name) {
        const nameLower = profile.name.trim().toLowerCase();
        this.aliasMap.set(nameLower, lowerKey);
        const nameHyphen = nameLower.replace(/\s+/g, '-');
        this.aliasMap.set(nameHyphen, lowerKey);
        const nameStripped = nameLower.replace(/[^a-z0-9]/g, '');
        if (nameStripped) {
          this.alphaNumMap.set(nameStripped, lowerKey);
          this.aliasMap.set(nameStripped, lowerKey);
        }
      }
    }

    // Index email map target aliases
    for (const [email, targetUser] of Object.entries(this.emailMap)) {
      const normEmail = email.trim().toLowerCase();
      const normTarget = targetUser.trim().toLowerCase();
      const canonical = this.resolve(normTarget);
      this.emailMap[normEmail] = canonical;
      this.aliasMap.set(normTarget, canonical);
    }
  }

  /**
   * Resolves any raw username, alias, git author, or handle into its canonical verified profile key
   * Case-insensitive, delimiter-neutral (e.g. "Sarbajit-Sengupta" vs "sarbajitsengupta" -> "sarbajit-sengupta")
   * @param {string} rawIdentifier
   * @returns {string}
   */
  resolve(rawIdentifier) {
    if (!rawIdentifier || typeof rawIdentifier !== 'string') return '';
    const clean = rawIdentifier.trim().toLowerCase();
    if (!clean) return '';

    if (this.aliasMap.has(clean)) {
      return this.aliasMap.get(clean);
    }

    if (this.knownProfiles[clean]) {
      return clean;
    }

    const alphaNum = clean.replace(/[^a-z0-9]/g, '');
    if (alphaNum && this.alphaNumMap.has(alphaNum)) {
      return this.alphaNumMap.get(alphaNum);
    }

    return clean;
  }

  /**
   * Resolves an author by raw username/name and email
   * @param {string} rawName
   * @param {string} rawEmail
   * @returns {string}
   */
  resolveAuthor(rawName, rawEmail) {
    const cleanEmail = (rawEmail || '').trim().toLowerCase();
    let rawKey = this.emailMap[cleanEmail];

    if (!rawKey && cleanEmail) {
      const ghMatch = cleanEmail.match(/(?:\d+\+)?([a-z0-9-]+)@users\.noreply\.github\.com/i);
      if (ghMatch) rawKey = ghMatch[1].toLowerCase();
    }

    if (!rawKey && rawName) {
      rawKey = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    const canonicalKey = this.resolve(rawKey);

    if (rawKey && canonicalKey && rawKey.toLowerCase() !== canonicalKey.toLowerCase()) {
      this.logResolution(rawKey, cleanEmail, canonicalKey);
    }

    return canonicalKey;
  }

  /**
   * Records resolution notice for console audit and verification telemetry
   */
  logResolution(rawKey, email, canonicalKey) {
    const notice = `[Deduplication Notice] Resolved git commit author "${rawKey}" (<${email}>) -> primary profile "${canonicalKey}".`;
    this.resolutionAuditLog.push({ rawKey, email, canonicalKey, notice });
    console.log(notice);
  }

  /**
   * Returns complete audit log of unified contributor aliases
   */
  getAuditLog() {
    return this.resolutionAuditLog;
  }
}

const deduplicator = new ContributorDeduplicator(KNOWN_PROFILES, EMAIL_MAP);

function resolveCanonicalUser(rawIdentifier) {
  return deduplicator.resolve(rawIdentifier);
}

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

      const canonicalKey = deduplicator.resolveAuthor(name, email);
      if (!canonicalKey) continue;

      const existing = commitCounts.get(canonicalKey) || 0;
      commitCounts.set(canonicalKey, existing + count);
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

// Canonical categories allow-list for uniform indexing and frontend filtering (#923)
const CANONICAL_CATEGORIES = new Set([
  'Action',
  'Adventure',
  'Arcade',
  'Card',
  'Casual',
  'Physics',
  'Platformer',
  'Puzzle',
  'Racing',
  'Retro',
  'Rhythm',
  'Simulation',
  'Sports',
  'Strategy'
]);

const CANONICAL_CATEGORIES_LOWER = new Map(
  Array.from(CANONICAL_CATEGORIES).map(cat => [cat.toLowerCase(), cat])
);

// Explicit aliases/compound categories normalization map
const CATEGORY_ALIASES = {
  'runner': 'Arcade',
  'defense': 'Strategy',
  'horror / escape room': 'Adventure',
  'survival / horror': 'Adventure'
};

// Grandfathered legacy collision pair (pre-existing historical duplicate)
const GRANDFATHERED_TITLE_COLLISIONS = new Set([
  'cyber-brick-breaker_babin|cyber-brick-breaker_hrshjswniii',
  'cyber-brick-breaker_hrshjswniii|cyber-brick-breaker_babin'
]);

function normalizeCategory(rawCategory, folder = '') {
  const sanitized = sanitizeMetadataString(rawCategory, 'Arcade');
  const lower = sanitized.toLowerCase();

  // 1. Direct exact canonical match (case-insensitive)
  if (CANONICAL_CATEGORIES_LOWER.has(lower)) {
    return CANONICAL_CATEGORIES_LOWER.get(lower);
  }

  // 2. Known alias / compound mapping
  if (CATEGORY_ALIASES[lower]) {
    const canonical = CATEGORY_ALIASES[lower];
    console.warn(`[Category Normalization] ${folder}: Category alias "${sanitized}" mapped to canonical "${canonical}".`);
    return canonical;
  }

  // 3. Slash-separated compound (e.g. "Arcade / Shooter" -> "Arcade", "Puzzle / Logic" -> "Puzzle")
  if (sanitized.includes('/')) {
    const primary = sanitized.split('/')[0].trim().toLowerCase();
    if (CANONICAL_CATEGORIES_LOWER.has(primary)) {
      const canonical = CANONICAL_CATEGORIES_LOWER.get(primary);
      console.warn(`[Category Normalization] ${folder}: Compound category "${sanitized}" normalized to canonical "${canonical}".`);
      return canonical;
    }
  }

  // 4. Fallback for unrecognized category
  console.warn(`[Category Warning] ${folder}: Category "${sanitized}" is not in canonical allow-list. Defaulting to "Arcade".`);
  return 'Arcade';
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

  // Collision tracking for duplicate IDs and normalized titles (#923)
  const seenIds = new Map();     // key: normalizedId -> folder
  const seenTitles = new Map();  // key: normalizedTitle -> folder
  let hasCollisionErrors = false;

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

      const rawGh = (meta.github || "").trim();
      const canonicalGh = resolveCanonicalUser(rawGh);
      if (rawGh && canonicalGh && rawGh.toLowerCase() !== canonicalGh) {
        console.log(`[Deduplication Notice] Game "${folder}": Mapped author GitHub "${rawGh}" -> primary profile "${canonicalGh}".`);
      }
      const profile = (canonicalGh && KNOWN_PROFILES[canonicalGh]) || {};
      const authorName = profile.name || meta.author || "Contributor";

      const sanitizedId = sanitizeMetadataString(gameId, folder);
      const sanitizedTitle = sanitizeMetadataString(meta.title, folder);
      const normalizedId = sanitizedId.toLowerCase().trim();
      const normalizedTitle = sanitizedTitle.toLowerCase().trim().replace(/\s+/g, ' ');

      // Collision Check: Duplicate Normalized Game ID
      if (seenIds.has(normalizedId)) {
        const conflictingFolder = seenIds.get(normalizedId);
        console.error(`[Collision Error] Duplicate game ID "${sanitizedId}" detected in folder "${folder}". Already registered by "${conflictingFolder}".`);
        hasCollisionErrors = true;
      } else {
        seenIds.set(normalizedId, folder);
      }

      // Collision Check: Duplicate Normalized Game Title
      if (seenTitles.has(normalizedTitle)) {
        const conflictingFolder = seenTitles.get(normalizedTitle);
        const pairKey = `${conflictingFolder}|${folder}`;
        if (GRANDFATHERED_TITLE_COLLISIONS.has(pairKey)) {
          console.warn(`[Legacy Collision Notice] Grandfathered duplicate title "${sanitizedTitle}" between "${conflictingFolder}" and "${folder}".`);
        } else {
          console.error(`[Collision Error] Duplicate game title "${sanitizedTitle}" detected in folder "${folder}". Already registered by "${conflictingFolder}".`);
          hasCollisionErrors = true;
        }
      } else {
        seenTitles.set(normalizedTitle, folder);
      }

      // Category Validation & Normalization against canonical allow-list
      const normalizedCategory = normalizeCategory(meta.category, folder);

      const gameObj = {
        id: sanitizedId,
        title: sanitizedTitle,
        category: normalizedCategory,
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

      // Track contributors from games with canonical resolution (#715)
      if (canonicalGh) {
        if (!contributorGames.has(canonicalGh)) {
          contributorGames.set(canonicalGh, []);
          contributorMeta.set(canonicalGh, {
            name: profile.name || meta.author || rawGh,
            role: profile.role || meta.role || "Arcade Developer",
            originalGithub: profile.github || rawGh
          });
        }
        contributorGames.get(canonicalGh).push(gameObj.title);
      }
    } catch (err) {
      console.error(`[Error] Failed parsing ${metaFile}:`, err.message);
    }
  }

  if (hasCollisionErrors) {
    console.error('\n[Fatal Error] Registry compilation aborted due to duplicate game ID or title collisions.');
    process.exit(1);
  }

  // 2. Fetch Git commit counts dynamically
  const gitCommits = getGitCommitCounts();

  // 3. Collect all unique contributors across games, git, and known profiles (#715)
  const rawUserKeys = new Set([
    ...contributorGames.keys(),
    ...gitCommits.keys(),
    ...Object.keys(KNOWN_PROFILES)
  ]);

  const unifiedUserKeys = new Set();
  for (const rawKey of rawUserKeys) {
    if (!rawKey || rawKey.includes('bot')) continue;
    const canonical = resolveCanonicalUser(rawKey);
    if (!canonical || canonical.includes('bot')) continue;

    if (rawKey.toLowerCase() !== canonical.toLowerCase()) {
      console.log(`[Deduplication Notice] Merged contributor key "${rawKey}" into primary profile "${canonical}".`);
    }
    unifiedUserKeys.add(canonical);
  }

  const contributorsRegistry = [];

  for (const key of unifiedUserKeys) {
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

  const isCheckOnly = process.argv.includes('--check');
  if (isCheckOnly) {
    console.log(`[Check OK] Registry compilation verified for ${gamesRegistry.length} games and ${cleanContributors.length} contributors.`);
    return;
  }

  fs.writeFileSync(REGISTRY_FILE, code, 'utf8');
  console.log(`[Success] Compiled ${gamesRegistry.length} games and ${cleanContributors.length} contributors into ${path.relative(ROOT_DIR, REGISTRY_FILE)}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadContributorOverrides,
    KNOWN_PROFILES,
    EMAIL_MAP,
    resolveCanonicalUser,
    buildRegistry
  };
}

if (require.main === module) {
  buildRegistry();
}
