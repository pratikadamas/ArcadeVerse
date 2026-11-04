/**
 * ArcadeVerse Core & Catalog Syntax Integrity Test Suite
 *
 * Verifies that assets/js/app.js, core scripts, and games-registry are
 * completely free from syntax errors, parse-time exceptions, or malformed AST nodes.
 *
 * Usage:
 *   node scripts/verify-catalog-syntax.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n========================================================');
console.log('   ArcadeVerse Core & Catalog Syntax Integrity Suite');
console.log('========================================================\n');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_FILES = [
  path.join(ROOT_DIR, 'assets', 'js', 'app.js'),
  path.join(ROOT_DIR, 'assets', 'js', 'games-registry.js'),
  path.join(ROOT_DIR, 'scripts', 'validate-games.js'),
  path.join(ROOT_DIR, 'scripts', 'build-registry.js')
];

let errorCount = 0;
let successCount = 0;

/**
 * Validates JavaScript syntax using the node CLI compiler (-c flag)
 * @param {string} filePath
 */
function testSyntax(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ [MISSING] File not found: ${relPath}`);
    errorCount++;
    return;
  }

  try {
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    console.log(`  ✅ [SYNTAX OK] ${relPath}`);
    successCount++;
  } catch (err) {
    console.error(`  ❌ [SYNTAX ERROR] ${relPath}`);
    console.error(`     ${err.stderr ? err.stderr.toString().trim() : err.message}`);
    errorCount++;
  }
}

/**
 * Static Analysis for Autocomplete and Event Listener boundaries
 * Ensures that renderAutocomplete is properly closed before faceted filters
 */
function testCatalogStructure() {
  const appJsPath = path.join(ROOT_DIR, 'assets', 'js', 'app.js');
  if (!fs.existsSync(appJsPath)) return;

  const content = fs.readFileSync(appJsPath, 'utf8');
  console.log('\n  [INSPECTING] assets/js/app.js architectural integrity...');

  // 1. Check for renderAutocomplete signature
  const autocompleteIndex = content.indexOf('function renderAutocomplete(query)');
  if (autocompleteIndex === -1) {
    console.warn('  ⚠️ [WARN] renderAutocomplete function definition not detected.');
  } else {
    console.log('  ✅ [OK] renderAutocomplete definition located.');
  }

  // 2. Check for Faceted Filters header
  const facetHeaderIndex = content.indexOf('// --- Faceted Filters Event Listeners (Duration, Controls, Reset) ---');
  if (facetHeaderIndex === -1) {
    console.warn('  ⚠️ [WARN] Faceted Filters section header not detected.');
  } else {
    console.log('  ✅ [OK] Faceted Filters section located.');
  }

  // 3. Inspect block balance between renderAutocomplete and Faceted Filters
  if (autocompleteIndex !== -1 && facetHeaderIndex !== -1 && facetHeaderIndex > autocompleteIndex) {
    const segment = content.slice(autocompleteIndex, facetHeaderIndex);
    let openBraces = 0;
    let closeBraces = 0;

    for (let i = 0; i < segment.length; i++) {
      if (segment[i] === '{') openBraces++;
      if (segment[i] === '}') closeBraces++;
    }

    if (openBraces === closeBraces) {
      console.log(`  ✅ [OK] renderAutocomplete curly brace balance verified (${openBraces} open, ${closeBraces} close).`);
      successCount++;
    } else {
      console.error(`  ❌ [FAIL] Brace mismatch inside renderAutocomplete block: ${openBraces} { vs ${closeBraces} }`);
      errorCount++;
    }
  }

  // 4. Verify DOMContentLoaded hook and initialization functions exist
  const initCalls = [
    'renderGames()',
    'buildTagChips()',
    'document.addEventListener("DOMContentLoaded"'
  ];

  initCalls.forEach((callee) => {
    if (content.includes(callee)) {
      console.log(`  ✅ [OK] Found critical runtime hook: ${callee}`);
      successCount++;
    } else {
      console.warn(`  ⚠️ [WARN] Missing expected runtime hook: ${callee}`);
    }
  });

  // 5. Verify modal iframe orientation listener
  if (content.includes('orientationchange')) {
    console.log('  ✅ [OK] Found responsive orientationchange listener for game modal.');
    successCount++;
  }
}

/**
 * Validates registry data structure
 */
function testRegistryPayload() {
  console.log('\n  [INSPECTING] assets/js/games-registry.js payload integrity...');
  const registryPath = path.join(ROOT_DIR, 'assets', 'js', 'games-registry.js');
  if (!fs.existsSync(registryPath)) return;

  const content = fs.readFileSync(registryPath, 'utf8');

  // Verify GAMES_REGISTRY array declaration
  if (content.includes('const GAMES_REGISTRY = [') || content.includes('window.GAMES_REGISTRY = [')) {
    console.log('  ✅ [OK] GAMES_REGISTRY array successfully declared.');
    successCount++;
  } else {
    console.error('  ❌ [FAIL] GAMES_REGISTRY array declaration missing in registry file.');
    errorCount++;
  }
}

// Execute syntax checks
console.log('  [CHECKING] Validating JavaScript file syntax via Node compiler:');
TARGET_FILES.forEach(testSyntax);

// Execute static catalog structure validation
testCatalogStructure();

// Execute registry payload integrity
testRegistryPayload();

console.log('\n========================================================');
console.log(`Audit Finished: ${successCount} Passed, ${errorCount} Errors`);
console.log('========================================================\n');

if (errorCount > 0) {
  process.exit(1);
} else {
  console.log('✨ All catalog & core syntax audits passed successfully with zero errors!\n');
  process.exit(0);
}
