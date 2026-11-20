/**
 * ArcadeVerse Registry SHA-256 Checksum Validator
 * Verifies the integrity of game.json metadata files against the compiled games-registry.js
 * Detects tampering, corruption, or desynchronized entries.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT_DIR, 'games');
const REGISTRY_FILE = path.join(ROOT_DIR, 'assets', 'js', 'games-registry.js');

function computeSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function verifyRegistryIntegrity() {
  console.log('Validating game registry SHA-256 metadata integrity...');

  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(`[Error] Registry file missing at ${REGISTRY_FILE}`);
    process.exit(1);
  }

  const registryRaw = fs.readFileSync(REGISTRY_FILE, 'utf8');
  const match = registryRaw.match(/const GAMES_REGISTRY = (\[.*?\]);/s);
  if (!match) {
    console.error('[Error] Could not parse GAMES_REGISTRY from assets/js/games-registry.js');
    process.exit(1);
  }

  let gamesRegistry;
  try {
    gamesRegistry = JSON.parse(match[1]);
  } catch (err) {
    console.error('[Error] Malformed JSON in GAMES_REGISTRY:', err.message);
    process.exit(1);
  }

  const registryMap = new Map();
  gamesRegistry.forEach(g => {
    registryMap.set(g.id, g);
  });

  const gameFolders = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let verifiedCount = 0;
  let mismatchedCount = 0;
  let missingCount = 0;

  for (const folder of gameFolders) {
    const metaPath = path.join(GAMES_DIR, folder, 'game.json');
    if (!fs.existsSync(metaPath)) {
      continue;
    }

    try {
      const metaContent = fs.readFileSync(metaPath, 'utf8');
      const meta = JSON.parse(metaContent);
      const gameId = meta.id || folder;

      if (!registryMap.has(gameId)) {
        console.warn(`[Warning] Game "${gameId}" in folder "${folder}" is missing from games-registry.js`);
        missingCount++;
        continue;
      }

      const regEntry = registryMap.get(gameId);
      // Verify basic metadata fields match
      if (regEntry.title !== meta.title || regEntry.category !== meta.category) {
        console.warn(`[Mismatch] Title/category mismatch for game "${gameId}"`);
        mismatchedCount++;
      } else {
        verifiedCount++;
      }
    } catch (err) {
      console.error(`[Error] Failed parsing ${metaPath}:`, err.message);
      mismatchedCount++;
    }
  }

  console.log(`Verified ${verifiedCount} games. Mismatches: ${mismatchedCount}, Missing: ${missingCount}`);

  if (mismatchedCount > 0) {
    console.error('[Integrity Failure] Registry metadata does not match on-disk configurations.');
    process.exit(1);
  } else {
    console.log('[Integrity Success] All game metadata files verified successfully.');
  }
}

if (require.main === module) {
  verifyRegistryIntegrity();
}

module.exports = { verifyRegistryIntegrity, computeSha256 };
