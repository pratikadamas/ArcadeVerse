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

// Known display name & email aliases to ensure 100% accurate attribution
const KNOWN_PROFILES = {
  debasmitabose0: {
    name: "Debasmita Bose",
    github: "DebasmitaBose0",
    role: "Project Admin & Lead (NSOC '26)",
    mechanicsBonus: 2,
    platformPRs: 2,
    qualityPRs: 0
  },
  babin123456: {
    name: "Babin Bid",
    github: "Babin123456",
    role: "Arcade Developer (NSOC '26)",
    mechanicsBonus: 2,
    platformPRs: 29,
    qualityPRs: 1
  },
  mistu7debnath: {
    name: "mistu7debnath",
    github: "mistu7debnath",
    role: "Contributor (NSOC '26)",
    mechanicsBonus: 1,
    platformPRs: 0,
    qualityPRs: 0
  },
  joitapaul: {
    name: "Joita Paul",
    github: "joitapaul",
    role: "Active Contributor (NSOC '26)",
    mechanicsBonus: 0,
    platformPRs: 0,
    qualityPRs: 1
  },
  hrshjswniii: {
    name: "Harsh Jaiswani",
    github: "hrshjswniii",
    role: "Active Contributor (NSOC '26)",
    mechanicsBonus: 0,
    platformPRs: 0,
    qualityPRs: 1
  },
  pragna7: {
    name: "Pragna Seetha",
    github: "pragna7",
    role: "Contributor (NSOC '26)",
    mechanicsBonus: 0,
    platformPRs: 0,
    qualityPRs: 0
  },
  arshibansal: {
    name: "Arshi Bansal",
    github: "ArshiBansal",
    role: "Puzzle Developer (NSOC '26)",
    mechanicsBonus: 0,
    platformPRs: 0,
    qualityPRs: 0
  },
  anshuu2004: {
    name: "Abhishek",
    github: "Anshuu2004",
    role: "Contributor (NSOC '26)",
    mechanicsBonus: 0,
    platformPRs: 0,
    qualityPRs: 0
  },
  pratikadamas: {
    name: "Pratik Giri",
    github: "pratikadamas",
    role: "Contributor (NSOC '26)",
    mechanicsBonus: 0,
    platformPRs: 1,
    qualityPRs: 0
  }
};

const EMAIL_MAP = {
  "dbose272@gmail.com": "debasmitabose0",
  "144198639+debasmitabose0@users.noreply.github.com": "debasmitabose0",
  "265290994+babin123456@users.noreply.github.com": "babin123456",
  "joitapaul61@gmail.com": "joitapaul",
  "mistu7debnath2021@gmail.com": "mistu7debnath",
  "harshjeswanitech95722@gmail.com": "hrshjswniii",
  "seethapragna2005@gmail.com": "pragna7",
  "arshi900389@gmail.com": "arshibansal",
  "abhishekcse2004@gmail.com": "anshuu2004",
  "pratikgiri585@gmail.com": "pratikadamas"
};

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

      const gameObj = {
        id: gameId,
        title: meta.title || folder,
        category: meta.category || "Arcade",
        lucideIcon: meta.lucideIcon || "gamepad-2",
        description: meta.description || "",
        author: meta.author || "Contributor",
        github: meta.github || "",
        role: meta.role || "Arcade Developer",
        path: htmlPath,
        tags: Array.isArray(meta.tags) ? meta.tags : ["Arcade"],
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
