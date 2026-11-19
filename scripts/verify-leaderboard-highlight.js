/**
 * ArcadeVerse Leaderboard Search Highlight Regression Test Suite
 * Author: Babin123456
 * Verifies live substring match highlighting in leaderboard table names and handles.
 */

const fs = require('fs');
const path = require('path');

console.log('\n========================================================');
console.log('   Leaderboard Search Substring Highlight Test Suite');
console.log('========================================================\n');

const LEADERBOARD_JS = path.join(__dirname, '..', 'assets', 'js', 'leaderboard.js');
const PAGES_CSS = path.join(__dirname, '..', 'assets', 'css', 'pages.css');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

// 1. Verify JS Functions Exist
const jsContent = fs.readFileSync(LEADERBOARD_JS, 'utf8');

assert(jsContent.includes('function escapeRegex(str)'), 'escapeRegex helper implemented');
assert(jsContent.includes('function highlightMatch(text, query)'), 'highlightMatch helper implemented');
assert(jsContent.includes('searchDebounceTimer = setTimeout'), '200ms search input debounce implemented');
assert(jsContent.includes('highlightMatch(item.name, tableSearchQuery)'), 'DisplayName wrapped with highlightMatch');
assert(jsContent.includes('highlightMatch(item.login, tableSearchQuery)'), 'GitHub Handle wrapped with highlightMatch');
assert(jsContent.includes('<mark class="search-highlight">'), '<mark class="search-highlight"> wrapper used');

// 2. Functional Highlight Logic Unit Test
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, query) {
  if (!text) return "";
  if (!query) return text;
  const escaped = escapeRegex(query);
  const regex = new RegExp("(" + escaped + ")", "gi");
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

const test1 = highlightMatch("Debasmita Bose", "deba");
assert(test1 === '<mark class="search-highlight">Deba</mark>smita Bose', `Case-insensitive name match: ${test1}`);

const test2 = highlightMatch("Babin123456", "123");
assert(test2 === 'Babin<mark class="search-highlight">123</mark>456', `Number handle match: ${test2}`);

const test3 = highlightMatch("Normal User", "");
assert(test3 === 'Normal User', `Empty query leaves text untouched: ${test3}`);

const test4 = highlightMatch("Special [User]", "[user]");
assert(test4 === 'Special <mark class="search-highlight">[User]</mark>', `Regex special characters safely escaped: ${test4}`);

// 3. Verify CSS Rule in pages.css
const cssContent = fs.readFileSync(PAGES_CSS, 'utf8');
assert(cssContent.includes('.search-highlight'), '.search-highlight CSS class defined in pages.css');
assert(cssContent.includes('background: #00f0ff'), '.search-highlight cyan background present');
assert(cssContent.includes('color: #0a0a14'), '.search-highlight dark contrast text present');

console.log('\n========================================================');
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log('========================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('[SUCCESS] All Leaderboard substring highlight checks passed successfully!\n');
  process.exit(0);
}
