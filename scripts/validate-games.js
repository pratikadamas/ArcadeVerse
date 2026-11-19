/**
 * ArcadeVerse Contributor Game Pre-Flight Validator CLI
 * Audits all community games for folder naming, required files, schema, emojis,
 * relative broken links, asset integrity, and strict CONTRIBUTING.md compliance.
 * Usage: node scripts/validate-games.js
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT_DIR, 'games');

const REQUIRED_FILES = ['index.html', 'style.css', 'game.js', 'game.json'];
const REQUIRED_JSON_FIELDS = ['title', 'category', 'description', 'author', 'github'];

// Emoji detector regex
const EMOJI_REGEX = /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27BF]/;

let totalErrors = 0;
let totalWarnings = 0;

console.log('\n🔍 ========================================================');
console.log('   ArcadeVerse Pre-Flight Contributor Game Validator');
console.log('========================================================\n');

if (!fs.existsSync(GAMES_DIR)) {
  console.error('❌ Critical: games directory not found at:', GAMES_DIR);
  process.exit(1);
}

// 0. Strict File Protection Audit (CONTRIBUTING.md Compliance for PRs / feature branches)
// Backup & Storage Key Schema Auditor (#495, #919)
function verifyStorageSerializationHealth(gameJsContent, issues) {
  if (!gameJsContent) return;

  // 1. Detect raw object or array literal passed directly to localStorage.setItem without JSON.stringify
  if (/localStorage\.setItem\s*\([^,]+,\s*(?:\{|\[)/.test(gameJsContent)) {
    issues.push('❌ Invalid storage serialization: Direct object or array literal passed to localStorage.setItem without JSON.stringify.');
    totalErrors++;
  }

  // 2. Detect attempting to store literal [object Object] sentinel
  if (/localStorage\.setItem\s*\([^,]+,\s*['"]\[object Object\]['"]\)/i.test(gameJsContent)) {
    issues.push('❌ Invalid storage serialization: Attempting to store "[object Object]" string in localStorage.');
    totalErrors++;
  }

  // 3. Detect unhandled JSON.parse on localStorage without try/catch recovery (#495)
  if (/JSON\.parse\s*\(\s*localStorage\.getItem/i.test(gameJsContent) && !gameJsContent.includes('try') && !gameJsContent.includes('catch')) {
    issues.push('⚠️ Unprotected JSON.parse(localStorage.getItem(...)): Missing try/catch block for corrupted storage recovery (#495).');
    totalWarnings++;
  }
}

// Aspect Ratio & Viewport Scaling Auditor (#501, #919)
function verifyCanvasResizeSafety(gameJsContent, issues) {
  if (!gameJsContent) return;

  if (
    (gameJsContent.includes('addEventListener("resize"') || gameJsContent.includes("addEventListener('resize'")) &&
    !gameJsContent.includes('debounce') &&
    !gameJsContent.includes('ArcadeVerse') &&
    !gameJsContent.includes('AV_RESIZE')
  ) {
    if (IS_STRICT) {
      issues.push('⚠️ Window resize listener without debouncing or ArcadeVerse responsive aspect-ratio handling (#501).');
      totalWarnings++;
    }
  }
}

// Strict 4-File Bundle Conformance Auditor (#919)
function verifyStrictBundleConformance(gamePath, folder, issues) {
  const ALLOWED_ENTRIES = new Set([
    'index.html', 'style.css', 'game.js', 'game.json',
    'assets', 'audio', 'images', 'sprites', 'sfx', 'sound', 'textures'
  ]);

  try {
    const entries = fs.readdirSync(gamePath);
    entries.forEach(entry => {
      if (!ALLOWED_ENTRIES.has(entry) && !entry.startsWith('.')) {
        issues.push(`❌ Strict 4-file bundle violation: Unauthorized file or directory "${entry}" found in games/${folder}. Games must contain only standard bundle files.`);
        totalErrors++;
      }
    });
  } catch (_) {}
}

// Lucide Icon Format & Injection Sanitizer (#491, #919)
function verifyLucideIconIntegrity(iconName, issues) {
  if (iconName === undefined || iconName === null) return;
  if (typeof iconName !== 'string' || !iconName.trim()) {
    issues.push('❌ Invalid lucideIcon: Field must be a non-empty string.');
    totalErrors++;
    return;
  }
  const trimmed = iconName.trim();
  if (trimmed.includes('"') || trimmed.includes('<') || trimmed.includes('>') || trimmed.includes("'")) {
    issues.push(`❌ Invalid lucideIcon: "${trimmed}" contains illegal quote or markup characters.`);
    totalErrors++;
    return;
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    issues.push(`❌ Invalid lucideIcon format: "${trimmed}". Expected kebab-case Lucide icon identifier (e.g. "gamepad-2").`);
    totalErrors++;
  }
}

const FORBIDDEN_ROOT_FILES = ['assets/js/games-registry.js', 'index.html', 'leaderboard.html'];
const touchedFilesSet = new Set();
let isPrBranch = false;

try {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', cwd: ROOT_DIR }).trim();
  const isCiPr = Boolean(process.env.GITHUB_BASE_REF);

  if (isCiPr || (currentBranch !== 'main' && currentBranch !== 'HEAD')) {
    isPrBranch = true;
    let baseRef = 'main';
    for (const ref of ['upstream/main', 'origin/main', 'main']) {
      try {
        execSync(`git rev-parse --verify ${ref}`, { stdio: 'ignore' });
        baseRef = ref;
        break;
      } catch (_) {}
    }

    try {
      const diffOutput = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf8', cwd: ROOT_DIR });
      const touchedList = diffOutput.split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);
      touchedList.forEach(f => touchedFilesSet.add(f));

      const isGamePr = touchedList.some(f => f.startsWith('games/'));
      const activeForbiddenFiles = isGamePr
        ? FORBIDDEN_ROOT_FILES
        : ['assets/js/games-registry.js'];
      const illegalFiles = touchedList.filter(f => activeForbiddenFiles.includes(f));

      if (illegalFiles.length > 0) {
        console.log('🚨 ========================================================');
        console.log('   Strict File Protection Check (CONTRIBUTING.md Compliance)');
        console.log('========================================================\n');
        illegalFiles.forEach(f => {
          console.log(`❌ Unauthorized modification detected: "${f}"`);
          if (f.includes('games-registry.js')) {
            console.log(`   💡 NOTE: 'assets/js/games-registry.js' is auto-compiled upon merge by GitHub Actions.`);
            console.log(`   Editing it in a PR causes MERGE CONFLICTS with the main branch.`);
            console.log(`   To revert: git checkout ${baseRef} -- assets/js/games-registry.js\n`);
          }
          totalErrors++;
        });
      }
    } catch (_) {}
  }

  // Also record working-tree changes (staged or unstaged)
  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf8', cwd: ROOT_DIR });
    statusOutput.split('\n').forEach(line => {
      const f = line.slice(3).trim().replace(/\\/g, '/');
      if (f) touchedFilesSet.add(f);
    });
  } catch (_) {}
} catch {
  // Graceful fallback if not running in a git context
}

// Helper: Inspect Relative Asset Integrity
function verifyRelativeAsset(gamePath, referenceUri, sourceFile, issues) {
  if (!referenceUri || typeof referenceUri !== 'string') return;
  const uri = referenceUri.trim();

  // Skip remote CDN URLs, protocols, data URIs, anchor tags, SVG filter IDs, or blank schemes
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('//') ||
    uri.startsWith('data:') ||
    uri.startsWith('#') ||
    uri.startsWith('%23') ||
    uri.startsWith('mailto:') ||
    uri.startsWith('javascript:') ||
    uri === 'about:blank' ||
    uri === ''
  ) {
    return;
  }

  // Remove query strings and hash anchors
  const cleanUri = uri.split('?')[0].split('#')[0];
  if (!cleanUri) return;

  // Resolve against the game's directory or the project root if leading slash
  let resolvedPath;
  if (cleanUri.startsWith('/')) {
    resolvedPath = path.join(ROOT_DIR, cleanUri.slice(1));
  } else {
    resolvedPath = path.resolve(gamePath, cleanUri);
  }

  if (!fs.existsSync(resolvedPath)) {
    issues.push(`❌ Broken asset reference in ${sourceFile}: "${referenceUri}" (Target does not exist on disk: ${resolvedPath})`);
    totalErrors++;
  } else {
    // Audit file readability and zero-byte corruption
    try {
      const stats = fs.statSync(resolvedPath);
      if (stats.size === 0 && !cleanUri.endsWith('.gitkeep')) {
        issues.push(`⚠️ Zero-byte corrupted asset file detected in ${sourceFile}: "${referenceUri}"`);
        totalWarnings++;
      }
    } catch (_) {}
  }
}

// Extract Asset References from HTML files
function auditHtmlAssetIntegrity(gamePath, htmlContent, issues) {
  // Link href attributes
  const linkRegex = /<link\s+[^>]*?href=["']([^"']+)["']/gi;
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'index.html', issues);
  }

  // Script src attributes
  const scriptRegex = /<script\s+[^>]*?src=["']([^"']+)["']/gi;
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'index.html', issues);
  }

  // Img src attributes
  const imgRegex = /<img\s+[^>]*?src=["']([^"']+)["']/gi;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'index.html', issues);
  }

  // Audio source attributes
  const sourceRegex = /<source\s+[^>]*?src=["']([^"']+)["']/gi;
  while ((match = sourceRegex.exec(htmlContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'index.html', issues);
  }
}

// Extract Asset References from CSS files
function auditCssAssetIntegrity(gamePath, cssContent, issues) {
  const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
  let match;
  while ((match = urlRegex.exec(cssContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'style.css', issues);
  }
}

// Extract Static Asset Declarations from JavaScript files
function auditJsAssetIntegrity(gamePath, jsContent, issues) {
  // Audio instances: new Audio("path.mp3")
  const audioRegex = /new\s+Audio\(["']([^"']+)["']\)/gi;
  let match;
  while ((match = audioRegex.exec(jsContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'game.js', issues);
  }

  // Image src assignments: .src = "path.png"
  const imgSrcRegex = /\.src\s*=\s*["']([^"']+)["']/gi;
  while ((match = imgSrcRegex.exec(jsContent)) !== null) {
    verifyRelativeAsset(gamePath, match[1], 'game.js', issues);
  }
}

// Deep Sub-Asset Integrity and Resource Size Boundary Audits
function auditGameResourceBounds(gamePath, issues) {
  const mediaDirs = ['assets', 'audio', 'images', 'sprites', 'sfx', 'sound', 'textures'];
  mediaDirs.forEach(dirName => {
    const fullDirPath = path.join(gamePath, dirName);
    if (fs.existsSync(fullDirPath) && fs.statSync(fullDirPath).isDirectory()) {
      try {
        const dirFiles = fs.readdirSync(fullDirPath);
        dirFiles.forEach(subFile => {
          const filePath = path.join(fullDirPath, subFile);
          const stats = fs.statSync(filePath);
          if (stats.size > 5 * 1024 * 1024) {
            issues.push(`⚠️ Sub-asset "${path.join(dirName, subFile)}" exceeds 5MB size limit (${(stats.size / (1024 * 1024)).toFixed(1)}MB). Please compress before merge.`);
            totalWarnings++;
          }
        });
      } catch (_) {}
    }
  });

  // Verify AudioContext & Lifecycle Bridge Presence if Audio API is referenced
  const jsFile = path.join(gamePath, 'game.js');
  if (fs.existsSync(jsFile)) {
    const code = fs.readFileSync(jsFile, 'utf8');
    if ((code.includes('AudioContext') || code.includes('webkitAudioContext')) && !code.includes('ArcadeVerse') && !code.includes('ARCADEVERSE_TEARDOWN')) {
      // Advisory recommendation for graceful teardown
      if (IS_STRICT) {
        issues.push('⚠️ Game instantiates AudioContext without listening to ARCADEVERSE_TEARDOWN or using ArcadeVerse SDK helper.');
        totalWarnings++;
      }
    }
  }
}

// Audits character encoding and doctype specifications
function auditHtmlEncodingStandards(htmlContent, issues) {
  if (!/<!DOCTYPE\s+html>/i.test(htmlContent)) {
    issues.push('⚠️ index.html is missing standard <!DOCTYPE html> doctype.');
    totalWarnings++;
  }
  if (!/<meta\s+[^>]*?charset=["']?utf-8["']?/i.test(htmlContent)) {
    issues.push('⚠️ index.html is missing UTF-8 charset declaration meta tag.');
    totalWarnings++;
  }
}

// Static Security & Anti-Defacement Heuristics Scanner
function scanScriptSecurityViolations(jsContent, issues) {
  if (jsContent.includes('document.write(') || jsContent.includes('document.writeln(')) {
    issues.push('❌ Avoid document.write() in community games; it breaks DOM streaming and player isolation.');
    totalErrors++;
  }
  if (/innerHTML\s*=\s*.*(location\.search|localStorage\.getItem)/i.test(jsContent)) {
    issues.push('⚠️ Potential DOM XSS pattern: assigning untrusted search or storage directly into innerHTML.');
    totalWarnings++;
  }
  if (jsContent.includes('window.top.location') || jsContent.includes('window.parent.location') || /(window\.)?(top|parent)\.location/i.test(jsContent)) {
    issues.push('❌ Security violation (#492): Attempt to access top or parent frame navigation.');
    totalErrors++;
  }

  // Refresh Rate & Fixed-Timestep V-Sync Heuristics Check (#560)
  if (jsContent.includes('requestAnimationFrame') && !jsContent.includes('dt') && !jsContent.includes('deltaTime') && !jsContent.includes('FIXED_DT') && !jsContent.includes('accumulator')) {
    // Non-blocking advisory warning for linear per-frame increments
    if (/(x|y|pos|progress)\s*\+=\s*[0-9]+/i.test(jsContent)) {
      if (IS_STRICT) {
        issues.push('⚠️ Advisory: Game loop may use framerate-dependent movement without delta time scaling (#560).');
        totalWarnings++;
      }
    }
  }
}

// Disallowed External CDN and Third-Party Hostnames (#922)
const DISALLOWED_CDN_HOSTS = [
  'unpkg.com',
  'cdn.jsdelivr.net',
  'jsdelivr.net',
  'cdnjs.cloudflare.com',
  'cdnjs.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.skypack.dev',
  'esm.sh',
  'cdn.tailwindcss.com',
  'cdn.bootcdn.net',
  'raw.githubusercontent.com',
  'cdn.jsdelivr.org',
  'stackpath.bootstrapcdn.com',
  'code.jquery.com',
  'cdn.socket.io',
  'ajax.googleapis.com'
];

/**
 * External CDN & Third-Party Asset Scanner (#922)
 * Detects external script bundles, Google Fonts CDNs, unpkg, cdnjs, jsdelivr,
 * and remote stylesheet/font imports across HTML, CSS, and JS files.
 * Enforces zero-CDN policy: gates PRs on new/changed files and reports audit findings.
 */
function scanExternalCdnAssets(gamePath, folder, fileName, content, issues, isTouched) {
  function flagCdnViolation(url, reason) {
    if (isTouched || IS_STRICT_CDN) {
      issues.push(`❌ [CDN VIOLATION] External CDN / third-party asset in ${fileName}: "${url}" (${reason}). Community games must be 100% self-contained vanilla HTML5/CSS3/ES6+ with zero external CDNs or remote dependencies.`);
      totalErrors++;
    } else {
      issues.push(`⚠️ [CDN AUDIT] Legacy external CDN detected in ${fileName}: "${url}" (${reason}). Scheduled for offline font/asset migration.`);
      totalWarnings++;
    }
  }

  function getCdnHostMatch(url) {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim().toLowerCase();
    for (const host of DISALLOWED_CDN_HOSTS) {
      if (clean.includes(host)) return host;
    }
    return null;
  }

  if (fileName === 'index.html') {
    // External <script src="...">
    const scriptRegex = /<script\s+[^>]*?src=["']([^"']+)["']/gi;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      const src = match[1].trim();
      const host = getCdnHostMatch(src);
      if (host) {
        flagCdnViolation(src, `Disallowed CDN host: ${host}`);
      } else if (/^(https?:)?\/\//i.test(src)) {
        flagCdnViolation(src, 'External script bundle forbidden');
      }
    }

    // External <link href="..."> (stylesheets, preconnect, font links)
    const linkRegex = /<link\s+[^>]*?href=["']([^"']+)["']/gi;
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[1].trim();
      const host = getCdnHostMatch(href);
      if (host) {
        flagCdnViolation(href, `Disallowed CDN host: ${host}`);
      } else if (/<link\s+[^>]*?rel=["']stylesheet["']/i.test(match[0]) && /^(https?:)?\/\//i.test(href)) {
        flagCdnViolation(href, 'External remote stylesheet forbidden');
      }
    }

    // Inline @import url(...) or @import "..." inside <style>
    const inlineImportRegex = /@import\s+(?:url\(['"]?([^'"\)]+)['"]?\)|['"]([^'"]+)['"])/gi;
    while ((match = inlineImportRegex.exec(content)) !== null) {
      const importUrl = (match[1] || match[2] || '').trim();
      const host = getCdnHostMatch(importUrl);
      if (host) {
        flagCdnViolation(importUrl, `Disallowed CDN host: ${host}`);
      } else if (/^(https?:)?\/\//i.test(importUrl)) {
        flagCdnViolation(importUrl, 'External remote CSS import forbidden');
      }
    }
  }

  if (fileName === 'style.css') {
    // @import url(...) or @import "..."
    const importRegex = /@import\s+(?:url\(['"]?([^'"\)]+)['"]?\)|['"]([^'"]+)['"])/gi;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importUrl = (match[1] || match[2] || '').trim();
      const host = getCdnHostMatch(importUrl);
      if (host) {
        flagCdnViolation(importUrl, `Disallowed CDN host: ${host}`);
      } else if (/^(https?:)?\/\//i.test(importUrl)) {
        flagCdnViolation(importUrl, 'External remote CSS import forbidden');
      }
    }

    // url(...) referencing CDN hosts
    const urlRegex = /url\(['"]?([^'"\)]+)['"]?\)/gi;
    while ((match = urlRegex.exec(content)) !== null) {
      const refUrl = (match[1] || '').trim();
      const host = getCdnHostMatch(refUrl);
      if (host) {
        flagCdnViolation(refUrl, `Disallowed CDN host: ${host}`);
      }
    }
  }

  if (fileName === 'game.js') {
    // Dynamic script src assignment
    const dynamicScriptRegex = /\.src\s*=\s*['"]((?:https?:)?\/\/[^'"]+)['"]/gi;
    let match;
    while ((match = dynamicScriptRegex.exec(content)) !== null) {
      const src = match[1].trim();
      const host = getCdnHostMatch(src);
      flagCdnViolation(src, host ? `Disallowed CDN host: ${host}` : 'Dynamic remote script injection forbidden');
    }

    // Remote ES module imports: import(...) or import ... from "http..."
    const remoteImportRegex = /(?:import\s*\(|from\s+)['"]((?:https?:)?\/\/[^'"]+)['"]/gi;
    while ((match = remoteImportRegex.exec(content)) !== null) {
      const modUrl = match[1].trim();
      const host = getCdnHostMatch(modUrl);
      flagCdnViolation(modUrl, host ? `Disallowed CDN host: ${host}` : 'Remote module import forbidden');
    }
  }
}

// Helper: Collect all JavaScript files within a game directory
function findGameJsFiles(dir) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          results = results.concat(findGameJsFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        results.push(fullPath);
      }
    });
  } catch (_) {}
  return results;
}

// Static Code Smell & Console Pollution Linter (#684)
// Scans community game JavaScript files for unmanaged console.log statements that clutter DevTools
// and degrade performance inside 60 FPS animation loops.
// Permitted: console.warn and console.error for legitimate error handling and diagnostics.
function auditConsolePollution(gamePath, folder, issues) {
  const jsFiles = findGameJsFiles(gamePath);
  jsFiles.forEach(filePath => {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      return;
    }

    const relFilePath = path.relative(gamePath, filePath).replace(/\\/g, '/');
    const displayPath = `games/${folder}/${relFilePath}`;
    const lines = content.split('\n');
    let inBlockComment = false;
    let templateParenDepth = 0;
    const fileMatches = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNum = i + 1;
      let sanitized = '';
      let j = 0;
      const len = lineText.length;

      while (j < len) {
        if (inBlockComment) {
          if (lineText[j] === '*' && lineText[j + 1] === '/') {
            inBlockComment = false;
            j += 2;
          } else {
            j++;
          }
          continue;
        }

        if (templateParenDepth > 0) {
          if (lineText[j] === '\\') {
            j += 2;
            continue;
          }
          if (lineText[j] === '`') {
            templateParenDepth--;
            j++;
            continue;
          }
          if (lineText[j] === '$' && lineText[j + 1] === '{') {
            sanitized += '${';
            j += 2;
            while (j < len) {
              if (lineText[j] === '}') {
                sanitized += '}';
                j++;
                break;
              }
              if (lineText[j] === '"' || lineText[j] === "'") {
                const q = lineText[j];
                j++;
                while (j < len) {
                  if (lineText[j] === '\\') j += 2;
                  else if (lineText[j] === q) { j++; break; }
                  else j++;
                }
                sanitized += '""';
                continue;
              }
              sanitized += lineText[j];
              j++;
            }
            continue;
          }
          j++;
          continue;
        }

        if (lineText[j] === '/' && lineText[j + 1] === '/') {
          break;
        }

        if (lineText[j] === '/' && lineText[j + 1] === '*') {
          inBlockComment = true;
          j += 2;
          continue;
        }

        if (lineText[j] === '`') {
          templateParenDepth++;
          j++;
          continue;
        }

        if (lineText[j] === '"' || lineText[j] === "'") {
          const quote = lineText[j];
          j++;
          while (j < len) {
            if (lineText[j] === '\\') {
              j += 2;
            } else if (lineText[j] === quote) {
              j++;
              break;
            } else {
              j++;
            }
          }
          sanitized += '""';
          continue;
        }

        sanitized += lineText[j];
        j++;
      }

      if (/\bconsole\s*\.\s*log\b/.test(sanitized)) {
        fileMatches.push({ lineNum, snippet: lineText.trim() });
      }
    }

    if (fileMatches.length > 0) {
      const maxToDisplay = 10;
      fileMatches.slice(0, maxToDisplay).forEach(m => {
        const snippet = m.snippet.length > 70 ? m.snippet.slice(0, 67) + '...' : m.snippet;
        issues.push(`⚠️ Console pollution: unmanaged "console.log" statement in ${displayPath}:${m.lineNum} -> "${snippet}"`);
      });
      if (fileMatches.length > maxToDisplay) {
        issues.push(`⚠️ ... and ${fileMatches.length - maxToDisplay} more unmanaged console.log statement(s) in ${displayPath}`);
      }
      totalWarnings += fileMatches.length;
    }
  });
}

const folders = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`Found ${folders.length} community games to audit...\n`);


// ========================================================
// Advanced Integrity & Diagnostics Tooling
// ========================================================

/**
 * Parses command-line audit arguments:
 * --strict-assets : Fails if any optional assets or audio triggers are missing
 * --strict        : Fails with exit code 1 on warnings (including console pollution and code smells)
 * --strict-lint   : Alias for --strict
 * --summary-json  : Emits pre-flight audit findings as machine-readable JSON
 * --audit-hub     : Deep audits parent hub files (docs.html, 404.html, faqs.html)
 */
const CLI_ARGS = process.argv.slice(2);
const IS_STRICT = CLI_ARGS.includes('--strict-assets');
const IS_STRICT_MODE = CLI_ARGS.includes('--strict') || CLI_ARGS.includes('--strict-lint');
const IS_STRICT_CDN = CLI_ARGS.includes('--strict-cdn');
const IS_AUDIT_HUB = CLI_ARGS.includes('--audit-hub');
const SUMMARY_JSON_PATH = (() => {
  // Support --summary-json=<path>
  const eqArg = CLI_ARGS.find(arg => arg.startsWith('--summary-json='));
  if (eqArg) {
    const val = eqArg.slice('--summary-json='.length).trim();
    return val || 'summary.json';
  }

  // Support --summary-json [path]
  const idx = CLI_ARGS.indexOf('--summary-json');
  if (idx !== -1) {
    const nextArg = CLI_ARGS[idx + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      return nextArg.trim();
    }
    return 'summary.json';
  }

  return null;
})();

const auditTelemetry = {
  timestamp: new Date().toISOString(),
  gamesAudited: folders.length,
  totalErrors: 0,
  totalWarnings: 0,
  gameReports: []
};

function performHubAssetAudit() {
  console.log('🔍 Auditing Parent Hub Pages & Asset Boundaries...');
  const hubPages = ['docs.html', '404.html', 'faqs.html', 'terms.html', 'privacy.html'];
  hubPages.forEach(page => {
    const pagePath = path.join(ROOT_DIR, page);
    if (!fs.existsSync(pagePath)) return;
    const content = fs.readFileSync(pagePath, 'utf8');
    const pageIssues = [];
    auditHtmlAssetIntegrity(ROOT_DIR, content, pageIssues);
    if (pageIssues.length > 0) {
      console.log(`  ⚠️ [HUB AUDIT] ${page}`);
      pageIssues.forEach(msg => console.log(`      ${msg}`));
    } else {
      console.log(`  ✅ [HUB PASS] ${page}`);
    }
  });
  console.log('');
}

if (IS_AUDIT_HUB) {
  performHubAssetAudit();
}

folders.forEach(folder => {
  const prevErrors = totalErrors;
  const prevWarnings = totalWarnings;
  const gamePath = path.join(GAMES_DIR, folder);
  const issues = [];
  const isGameTouched = isPrBranch && (
    touchedFilesSet.has(`games/${folder}`) ||
    Array.from(touchedFilesSet).some(f => f.startsWith(`games/${folder}/`))
  );

  // 1. Folder Naming Convention: <game-name_username>
  if (!/^[a-z0-9-]+_[a-z0-9-]+$/i.test(folder)) {
    issues.push(`⚠️ Folder naming convention should be games/<game-name_username> (got: ${folder})`);
    totalWarnings++;
  }

  // 2. Required Files Check & Strict Bundle Conformance (#919)
  REQUIRED_FILES.forEach(file => {
    const filePath = path.join(gamePath, file);
    if (!fs.existsSync(filePath)) {
      issues.push(`❌ Missing required file: ${file}`);
      totalErrors++;
    }
  });
  verifyStrictBundleConformance(gamePath, folder, issues);

  // 3. game.json Schema & Field Verification
  const metaPath = path.join(gamePath, 'game.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      REQUIRED_JSON_FIELDS.forEach(field => {
        if (!meta[field]) {
          issues.push(`❌ game.json missing required field: "${field}"`);
          totalErrors++;
        }
      });

      // Strict XSS & Attribute Breakout Check (#491)
      ['title', 'category', 'author', 'description'].forEach(field => {
        const val = meta[field];
        if (typeof val === 'string' && (val.includes('"') || val.includes('<') || val.includes('>'))) {
          issues.push(`❌ Attribute Breakout / XSS risk: "${field}" contains unescaped quotes or angle brackets.`);
          totalErrors++;
        }
      });

      // Lucide Icon Format & Injection Sanitizer (#491, #919)
      verifyLucideIconIntegrity(meta.lucideIcon, issues);
    } catch (err) {
      issues.push(`❌ game.json contains invalid JSON: ${err.message}`);
      totalErrors++;
    }
  }

  // 4. Emoji scan in UI files
  ['index.html', 'style.css', 'game.js'].forEach(file => {
    const filePath = path.join(gamePath, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (EMOJI_REGEX.test(content)) {
        issues.push(`⚠️ Detected unicode emoji in ${file}. Please replace with SVG or Lucide icon.`);
        totalWarnings++;
      }
    }
  });

  // 5. HTML Structure & Relative Asset Integrity Verification
  const htmlPath = path.join(gamePath, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    if (!/<title>.*<\/title>/i.test(htmlContent)) {
      issues.push(`❌ index.html is missing a <title> tag.`);
      totalErrors++;
    }
    if (!/viewport/i.test(htmlContent)) {
      issues.push(`⚠️ index.html is missing a responsive viewport <meta> tag.`);
      totalWarnings++;
    }
    auditHtmlEncodingStandards(htmlContent, issues);
    auditHtmlAssetIntegrity(gamePath, htmlContent, issues);
    scanExternalCdnAssets(gamePath, folder, 'index.html', htmlContent, issues, isGameTouched);
  }

  // 6. CSS Asset Integrity Verification
  const cssPath = path.join(gamePath, 'style.css');
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    auditCssAssetIntegrity(gamePath, cssContent, issues);
    scanExternalCdnAssets(gamePath, folder, 'style.css', cssContent, issues, isGameTouched);
  }

  // 7. JavaScript Static Asset Integrity Verification
  const jsPath = path.join(gamePath, 'game.js');
  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    auditJsAssetIntegrity(gamePath, jsContent, issues);
    scanScriptSecurityViolations(jsContent, issues);
    verifyStorageSerializationHealth(jsContent, issues);
    verifyCanvasResizeSafety(jsContent, issues);
    scanExternalCdnAssets(gamePath, folder, 'game.js', jsContent, issues, isGameTouched);
  }

  // 8. Game Resource Bounds & Sub-Directory Audit
  auditGameResourceBounds(gamePath, issues);

  // 9. Static Code Smell & Console Pollution Linter (#684)
  auditConsolePollution(gamePath, folder, issues);

  if (SUMMARY_JSON_PATH) {
    auditTelemetry.gameReports.push({
      folder,
      passed: issues.length === 0,
      issues
    });
  }

  // Print Report for this game
  if (issues.length === 0) {
    console.log(`  ✅ [PASS] ${folder}`);
  } else {
    console.log(`  ⚠️ [AUDIT] ${folder}`);
    issues.forEach(msg => console.log(`      ${msg}`));
  }

  const gameErrors = totalErrors - prevErrors;
  const gameWarnings = totalWarnings - prevWarnings;
  const status = gameErrors > 0 ? 'FAIL' : (gameWarnings > 0 ? 'WARN' : 'PASS');

  auditTelemetry.gameReports.push({
    game: folder,
    status: status,
    errors: gameErrors,
    warnings: gameWarnings,
    issues: [...issues]
  });
});

console.log('\n========================================================');
console.log(`Audited ${folders.length} games: ${totalErrors} Errors, ${totalWarnings} Warnings`);
console.log('========================================================\n');

if (SUMMARY_JSON_PATH) {
  auditTelemetry.totalErrors = totalErrors;
  auditTelemetry.totalWarnings = totalWarnings;
  try {
    fs.writeFileSync(SUMMARY_JSON_PATH, JSON.stringify(auditTelemetry, null, 2), 'utf8');
  } catch (_) {}
}

if (totalErrors > 0 || (IS_STRICT_MODE && totalWarnings > 0)) {
  if (totalErrors === 0 && IS_STRICT_MODE && totalWarnings > 0) {
    console.error(`❌ Validation failed in --strict mode: ${totalWarnings} warning(s) detected. Please resolve them before submitting your PR.\n`);
  } else {
    console.error('❌ Validation failed! Please fix the errors listed above before submitting your PR.\n');
  }
  process.exit(1);
} else {
  
// Terminal Summary & Actionable Recommendations Report
function printTelemetryRecommendations(auditData) {
  console.log('📋 ----------------------------------------------------');
  console.log('   Validator Diagnostics & Optimization Suggestions');
  console.log('----------------------------------------------------');
  console.log(`• Verified ${auditData.gamesAudited} games against 4-file structure (index.html, style.css, game.js, game.json).`);
  console.log('• Monitored relative asset URLs against disk targets for zero 404 network request drops.');
  console.log('• Enforced zero-CDN policy against external script bundles and Google Fonts.');
  console.log('• Validated SVG icon standards across stylesheets and templates (zero unicode emojis).');
  console.log('• Inspected AudioContext instances and lifecycle hooks for graceful teardown compliance.');
  console.log('• Scanned game runtimes for console pollution & debug statements (clean 60 FPS loops).');
  console.log('• Enforced isolation boundary against top-level window tampering in game runtimes.\n');
}

  printTelemetryRecommendations(auditTelemetry);
  console.log('✨ All community games pass pre-flight verification!\n');
  process.exit(0);
}
