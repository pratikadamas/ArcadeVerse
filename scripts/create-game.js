#!/usr/bin/env node

/**
 * ArcadeVerse Interactive Game Scaffolder CLI
 * Automates creating new game modules adhering to strict repository standards:
 * - 4-file structure: index.html, style.css, game.js, game.json
 * - Folder naming: <game-slug>_<github-username>
 * - Pure vanilla ES6+, HTML5 Canvas, zero unicode emojis (pure SVG icons)
 * - Auto-registration and instant pre-flight validation
 *
 * Usage:
 *   npm run create-game
 *   or
 *   node scripts/create-game.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VALID_CATEGORIES = [
  'Action',
  'Arcade',
  'Puzzle',
  'Retro',
  'Shooter',
  'Sports',
  'Strategy',
  'Casual',
  'Survival',
  'Adventure'
];

const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];

const CATEGORY_DEFAULT_ICONS = {
  Action: 'crosshair',
  Arcade: 'gamepad-2',
  Puzzle: 'layers',
  Retro: 'gamepad',
  Shooter: 'target',
  Sports: 'trophy',
  Strategy: 'compass',
  Casual: 'sparkles',
  Survival: 'shield',
  Adventure: 'compass'
};

const LUCIDE_ICON_WHITELIST = new Set([
  'gamepad-2', 'gamepad', 'play', 'play-circle', 'trophy', 'star',
  'heart', 'heart-crack', 'search', 'x', 'refresh-cw', 'maximize',
  'maximize-2', 'minimize', 'external-link', 'volume-2', 'volume-x',
  'moon', 'sun', 'help-circle', 'file-code-2', 'book-open', 'chevron-down',
  'chevron-up', 'chevron-right', 'chevron-left', 'shield', 'cpu',
  'zap', 'award', 'crown', 'sparkles', 'compass', 'target', 'crosshair',
  'dices', 'layers', 'timer', 'clock', 'hash', 'code', 'terminal',
  'user', 'users', 'tag', 'tags', 'filter', 'check', 'info', 'alert-triangle',
  'alert-circle', 'eye', 'eye-off', 'lock', 'unlock', 'power', 'sliders',
  'copy', 'download', 'folder', 'flame', 'skull', 'ghost', 'radar'
]);

function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function createPrompter(rl) {
  const iterator = rl[Symbol.asyncIterator]();
  return async function promptQuestion(query, defaultValue) {
    const promptText = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;
    process.stdout.write(promptText);
    const result = await iterator.next();
    if (result.done) return defaultValue || '';
    const answer = (result.value || '').trim();
    return answer || defaultValue || '';
  };
}

async function main() {
  console.log('\n========================================================');
  console.log('   ArcadeVerse Interactive Game Scaffolder CLI (v1.1.0)');
  console.log('========================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptQuestion = createPrompter(rl);

  try {
    // 1. Game Title
    let title = await promptQuestion('1. Enter Game Title (e.g. Cyber Katana)');
    while (!title) {
      console.log('   [WARN] Title cannot be empty.');
      title = await promptQuestion('1. Enter Game Title');
    }

    // 2. Author Name
    let author = await promptQuestion('2. Enter Author Full Name (e.g. Jane Doe)');
    while (!author) {
      console.log('   [WARN] Author name cannot be empty.');
      author = await promptQuestion('2. Enter Author Full Name');
    }

    // 3. GitHub Username
    let github = await promptQuestion('3. Enter GitHub Username (e.g. janedoe)');
    while (!github) {
      console.log('   [WARN] GitHub username cannot be empty.');
      github = await promptQuestion('3. Enter GitHub Username');
    }
    github = github.replace(/^@/, '').toLowerCase().trim();

    // 4. Category
    console.log(`\n   Available Categories: ${VALID_CATEGORIES.join(', ')}`);
    let category = await promptQuestion('4. Select Category', 'Action');
    const matchedCategory = VALID_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());
    category = matchedCategory || 'Action';

    // 5. Lucide Icon
    const defaultIcon = CATEGORY_DEFAULT_ICONS[category] || 'gamepad-2';
    let iconInput = await promptQuestion(
      `5. Select Lucide Icon (e.g. gamepad-2, crosshair, layers, sparkles, trophy)`,
      defaultIcon
    );
    let lucideIcon = toSlug(iconInput);
    if (!lucideIcon || !LUCIDE_ICON_WHITELIST.has(lucideIcon)) {
      lucideIcon = defaultIcon;
    }

    // 6. Difficulty
    console.log(`\n   Available Difficulties: ${VALID_DIFFICULTIES.join(', ')}`);
    let difficulty = await promptQuestion('6. Select Difficulty', 'Medium');
    const matchedDiff = VALID_DIFFICULTIES.find(d => d.toLowerCase() === difficulty.toLowerCase());
    difficulty = matchedDiff || 'Medium';

    // 7. Description
    let description = await promptQuestion(
      '7. Enter Short Description',
      `An exciting ${category.toLowerCase()} arcade experience in the ArcadeVerse.`
    );

    // Compute Folder & ID
    const titleSlug = toSlug(title);
    const folderName = `${titleSlug}_${github}`;
    const targetDir = path.join(process.cwd(), 'games', folderName);

    console.log('\n--------------------------------------------------------');
    console.log('   Scaffolding Preview');
    console.log('--------------------------------------------------------');
    console.log(`   - Title:       ${title}`);
    console.log(`   - Author:      ${author} (@${github})`);
    console.log(`   - Category:    ${category}`);
    console.log(`   - Lucide Icon: ${lucideIcon}`);
    console.log(`   - Difficulty:  ${difficulty}`);
    console.log(`   - Directory:   games/${folderName}`);
    console.log('--------------------------------------------------------\n');

    const confirm = await promptQuestion('Proceed with scaffolding? (Y/n)', 'Y');
    if (confirm.toLowerCase() !== 'y') {
      console.log('\n[CANCEL] Operation cancelled by user.\n');
      rl.close();
      return;
    }

    // Ensure Directory Exists
    if (fs.existsSync(targetDir)) {
      console.error(`\n[ERROR] Directory already exists: games/${folderName}\n`);
      rl.close();
      return;
    }

    fs.mkdirSync(targetDir, { recursive: true });

    // File 1: game.json
    const gameJsonContent = {
      title: title,
      author: author,
      github: github,
      category: category,
      lucideIcon: lucideIcon,
      tags: [category.toLowerCase(), 'arcade', 'html5-canvas', 'retro'],
      difficulty: difficulty,
      description: description,
      instructions: "Use Arrow Keys or WASD to navigate. Spacebar to trigger action.",
      controls: {
        "ArrowLeft / A": "Move Left",
        "ArrowRight / D": "Move Right",
        "Space": "Action / Fire"
      },
      responsive: true
    };
    fs.writeFileSync(
      path.join(targetDir, 'game.json'),
      JSON.stringify(gameJsonContent, null, 2) + '\n',
      'utf8'
    );

    // File 2: index.html (Strict Zero-Emoji, Pure SVG)
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title} - ArcadeVerse</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <header class="game-hud">
      <div class="hud-stat">
        <span class="hud-label">SCORE</span>
        <span class="hud-value" id="hudScore">0</span>
      </div>
      <div class="hud-stat">
        <span class="hud-label">BEST</span>
        <span class="hud-value" id="hudHighScore">0</span>
      </div>
      <div class="hud-title">${title}</div>
      <div class="hud-stat">
        <span class="hud-label">LIVES</span>
        <span class="hud-value" id="hudLives">3</span>
      </div>
    </header>

    <canvas id="gameCanvas" width="800" height="600"></canvas>

    <div class="overlay" id="startOverlay">
      <div class="overlay-card">
        <h2>${title}</h2>
        <p>${description}</p>
        <button class="btn-play" id="btnPlay" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          PLAY GAME
        </button>
      </div>
    </div>

    <div class="overlay hidden" id="gameOverOverlay">
      <div class="overlay-card">
        <h2>GAME OVER</h2>
        <p>Final Score: <span id="finalScore">0</span></p>
        <button class="btn-play" id="btnRestart" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          PLAY AGAIN
        </button>
      </div>
    </div>
  </div>

  <script src="../../assets/js/arcadeverse-sdk.js"></script>
  <script src="game.js"></script>
</body>
</html>
`;
    fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtmlContent, 'utf8');

    // File 3: style.css (Zero-CDN Font Stacks & Responsive @media Viewport Scaling)
    const styleCssContent = `/* Styles for ${title} */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body, html {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0b0d14;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif;
  color: #f8fafc;
  user-select: none;
}

#game-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.game-hud {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(11, 13, 20, 0.75);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
}

.hud-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hud-label {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: #94a3b8;
  font-weight: 700;
}

.hud-value {
  font-size: 1.2rem;
  font-weight: 800;
  color: #00f5ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.hud-title {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #f8fafc;
}

canvas#gameCanvas {
  background: #06080d;
  box-shadow: 0 0 30px rgba(0, 245, 255, 0.15);
  border-radius: 8px;
  max-width: 100%;
  max-height: calc(100% - 60px);
  aspect-ratio: 4 / 3;
  object-fit: contain;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(6, 8, 13, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  transition: opacity 0.3s ease;
}

.overlay.hidden {
  opacity: 0;
  pointer-events: none;
}

.overlay-card {
  background: #131722;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 32px 40px;
  text-align: center;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

.overlay-card h2 {
  font-size: 1.8rem;
  margin-bottom: 12px;
  color: #00f5ff;
}

.overlay-card p {
  font-size: 0.95rem;
  color: #94a3b8;
  margin-bottom: 24px;
  line-height: 1.5;
}

.btn-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #00f5ff;
  color: #06080d;
  font-size: 1rem;
  font-weight: 700;
  border: none;
  border-radius: 8px;
  padding: 12px 28px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-play:hover {
  background: #38bdf8;
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
  transform: translateY(-2px);
}

@media (max-width: 820px) {
  .game-hud {
    padding: 8px 14px;
  }

  .hud-title {
    font-size: 0.85rem;
  }

  .hud-label {
    font-size: 0.6rem;
  }

  .hud-value {
    font-size: 1rem;
  }

  .overlay-card {
    padding: 24px 20px;
  }

  .overlay-card h2 {
    font-size: 1.4rem;
  }

  .overlay-card p {
    font-size: 0.85rem;
  }
}

@media (max-height: 600px) {
  .game-hud {
    padding: 6px 16px;
  }

  .overlay-card {
    padding: 16px 24px;
  }

  .overlay-card h2 {
    font-size: 1.25rem;
    margin-bottom: 6px;
  }

  .overlay-card p {
    margin-bottom: 12px;
  }
}
`;
    fs.writeFileSync(path.join(targetDir, 'style.css'), styleCssContent, 'utf8');

    // File 4: game.js (Standardized dt Loop, Storage, Telemetry & Lifecycle Bridge)
    const gameJsContent = `/**
 * ${title}
 * Author: ${author} (@${github})
 * Powered by ArcadeVerse Game Engine
 */

(() => {
  'use strict';

  // --- Canvas & DOM Context ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudScore = document.getElementById('hudScore');
  const hudHighScore = document.getElementById('hudHighScore');
  const hudLives = document.getElementById('hudLives');
  const startOverlay = document.getElementById('startOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const btnPlay = document.getElementById('btnPlay');
  const btnRestart = document.getElementById('btnRestart');

  // --- Resilient Isolated Storage Helper ---
  const Storage = {
    get(key, fallback) {
      try {
        if (window.ArcadeVerse && window.ArcadeVerse.storage) {
          const val = window.ArcadeVerse.storage.getItem(key);
          return val !== null ? val : fallback;
        }
        if (window.ArcadeStorage) {
          const val = window.ArcadeStorage.getItem(key);
          return val !== null ? val : fallback;
        }
        if (typeof window !== 'undefined' && window.localStorage) {
          const val = localStorage.getItem(key);
          return val !== null ? val : fallback;
        }
      } catch (e) {
        console.warn('[Storage] Read error:', e);
      }
      return fallback;
    },

    set(key, value) {
      try {
        if (window.ArcadeVerse && window.ArcadeVerse.storage) {
          return window.ArcadeVerse.storage.setItem(key, String(value));
        }
        if (window.ArcadeStorage) {
          return window.ArcadeStorage.setItem(key, String(value));
        }
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, String(value));
          return true;
        }
      } catch (e) {
        console.warn('[Storage] Write error:', e);
      }
      return false;
    },

    getInt(key, fallback = 0) {
      const val = parseInt(this.get(key, fallback), 10);
      return Number.isFinite(val) ? val : fallback;
    }
  };

  // --- Telemetry Dispatchers ---
  function sendScoreTelemetry(currentScore) {
    try {
      if (window.ArcadeVerse && typeof ArcadeVerse.postScore === 'function') {
        ArcadeVerse.postScore(currentScore);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_SCORE',
          score: currentScore
        }, '*');
      }
    } catch (e) {
      console.warn('[Telemetry] Score dispatch error:', e);
    }
  }

  function sendGameOverTelemetry(finalScore) {
    try {
      if (window.ArcadeVerse && typeof ArcadeVerse.postGameOver === 'function') {
        ArcadeVerse.postGameOver({ score: finalScore });
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ARCADEVERSE_GAME_OVER',
          score: finalScore
        }, '*');
      }
    } catch (e) {
      console.warn('[Telemetry] Game over dispatch error:', e);
    }
  }

  // --- Lifecycle & Game State ---
  let animationFrameId = null;
  let lastTime = 0;
  let isPlaying = false;
  let isPaused = false;
  let score = 0;
  let lives = 3;
  let highScore = Storage.getInt('high_score', 0);

  const player = {
    x: 360,
    y: 540,
    width: 80,
    height: 16,
    speed: 450 // pixels/sec
  };

  const ball = {
    x: 400,
    y: 260,
    radius: 8,
    vx: 180,
    vy: 240
  };

  const keys = {};

  function initControls() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'Space' && !isPlaying) {
        startGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        startGame();
      });
    }

    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        startGame();
      });
    }
  }

  function startGame() {
    stopAnimation();
    if (startOverlay) startOverlay.classList.add('hidden');
    if (gameOverOverlay) gameOverOverlay.classList.add('hidden');

    isPlaying = true;
    isPaused = false;
    score = 0;
    lives = 3;
    lastTime = 0;

    player.x = (canvas.width - player.width) / 2;
    resetBall();
    updateHUD();

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function resetBall() {
    ball.x = player.x + player.width / 2;
    ball.y = 260;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * 180;
    ball.vy = 240;
  }

  function pauseGame() {
    if (!isPlaying || isPaused) return;
    isPaused = true;
  }

  function resumeGame() {
    if (!isPlaying || !isPaused) return;
    isPaused = false;
    lastTime = 0;
  }

  function stopAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function endGame() {
    isPlaying = false;
    isPaused = false;
    stopAnimation();

    if (score > highScore) {
      highScore = score;
      Storage.set('high_score', highScore);
    }
    updateHUD();

    sendGameOverTelemetry(score);

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
  }

  function addScore(points) {
    score += points;
    if (score > highScore) {
      highScore = score;
      Storage.set('high_score', highScore);
    }
    updateHUD();
    sendScoreTelemetry(score);
  }

  function updateHUD() {
    if (hudScore) hudScore.textContent = score;
    if (hudHighScore) hudHighScore.textContent = highScore;
    if (hudLives) hudLives.textContent = lives;
  }

  function update(dt) {
    if (!isPlaying || isPaused) return;

    // Paddle horizontal motion (frame-rate independent)
    const moveDist = player.speed * dt;
    if (keys['ArrowLeft'] || keys['KeyA']) {
      player.x -= moveDist;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      player.x += moveDist;
    }

    if (player.x < 10) player.x = 10;
    if (player.x + player.width > canvas.width - 10) {
      player.x = canvas.width - 10 - player.width;
    }

    // Ball motion
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Left/Right Wall bounce
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius >= canvas.width) {
      ball.x = canvas.width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }

    // Top Wall bounce
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle collision
    if (
      ball.vy > 0 &&
      ball.y + ball.radius >= player.y &&
      ball.y - ball.radius <= player.y + player.height &&
      ball.x >= player.x &&
      ball.x <= player.x + player.width
    ) {
      ball.vy = -Math.abs(ball.vy);
      const hitOffset = (ball.x - (player.x + player.width / 2)) / (player.width / 2);
      ball.vx = hitOffset * 220;
      addScore(10);
    }

    // Bottom boundary miss
    if (ball.y - ball.radius > canvas.height) {
      lives--;
      updateHUD();
      if (lives <= 0) {
        endGame();
      } else {
        resetBall();
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Floor Perspective Effect
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Ball Orb
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Player Paddle
    ctx.fillStyle = '#00f5ff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;
  }

  function gameLoop(timestamp) {
    if (!isPlaying) {
      animationFrameId = null;
      return;
    }

    if (isPaused) {
      lastTime = timestamp;
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    if (!lastTime) lastTime = timestamp;
    const rawDt = (timestamp - lastTime) / 1000;
    // Clamp delta-time between 0 and 0.1s to prevent physics jumps during lag
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    lastTime = timestamp;

    update(dt);
    render();

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function handleResize() {
    if (!isPlaying) {
      render();
    }
  }

  function teardown() {
    isPlaying = false;
    isPaused = true;
    stopAnimation();
    window.removeEventListener('resize', handleResize);
  }

  // Auto-pause when tab/window is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying && !isPaused) {
      pauseGame();
    }
  });

  // Cross-origin and lifecycle bridge message listener
  window.addEventListener('message', (event) => {
    if (!event || !event.data || typeof event.data !== 'object') return;
    const { type } = event.data;

    if (type === 'AV_RESIZE') {
      handleResize();
    } else if (type === 'ARCADEVERSE_PAUSE') {
      pauseGame();
    } else if (type === 'ARCADEVERSE_RESUME') {
      resumeGame();
    } else if (type === 'ARCADEVERSE_TEARDOWN') {
      teardown();
    }
  });

  window.addEventListener('resize', handleResize);

  // ArcadeVerse SDK Lifecycle Hooks Integration
  if (window.ArcadeVerse) {
    if (typeof ArcadeVerse.onPause === 'function') {
      ArcadeVerse.onPause(pauseGame);
    }
    if (typeof ArcadeVerse.onResume === 'function') {
      ArcadeVerse.onResume(resumeGame);
    }
    if (typeof ArcadeVerse.onTeardown === 'function') {
      ArcadeVerse.onTeardown(teardown);
    }
    if (typeof ArcadeVerse.onResize === 'function') {
      ArcadeVerse.onResize(handleResize);
    }
  }

  updateHUD();
  render();
  initControls();
})();
`;
    fs.writeFileSync(path.join(targetDir, 'game.js'), gameJsContent, 'utf8');

    console.log(`\n[SUCCESS] Successfully scaffolded: games/${folderName}`);
    console.log('   |-- game.json');
    console.log('   |-- index.html');
    console.log('   |-- style.css');
    console.log('   \\-- game.js\n');
    console.log('[INFO] Next Steps:');
    console.log('   1. Customize your game logic in games/' + folderName + '/game.js');
    console.log('   2. Verify standards: node scripts/validate-games.js\n');

    rl.close();
  } catch (err) {
    console.error('\n[ERROR] Scaffolder encountered an unexpected error:', err);
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, toSlug };
