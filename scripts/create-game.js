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

function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function promptQuestion(rl, query, defaultValue) {
  return new Promise((resolve) => {
    const promptText = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;
    rl.question(promptText, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function main() {
  console.log('\n[INFO] ====================================================');
  console.log('   ArcadeVerse Interactive Game Scaffolder CLI (v1.0.0)');
  console.log('========================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // 1. Game Title
    let title = await promptQuestion(rl, '1. Enter Game Title (e.g. Cyber Katana)');
    while (!title) {
      console.log('   [WARN] Title cannot be empty.');
      title = await promptQuestion(rl, '1. Enter Game Title');
    }

    // 2. Author Name
    let author = await promptQuestion(rl, '2. Enter Author Full Name (e.g. Jane Doe)');
    while (!author) {
      console.log('   [WARN] Author name cannot be empty.');
      author = await promptQuestion(rl, '2. Enter Author Full Name');
    }

    // 3. GitHub Username
    let github = await promptQuestion(rl, '3. Enter GitHub Username (e.g. janedoe)');
    while (!github) {
      console.log('   [WARN] GitHub username cannot be empty.');
      github = await promptQuestion(rl, '3. Enter GitHub Username');
    }
    github = github.replace(/^@/, '').toLowerCase().trim();

    // 4. Category
    console.log(`\n   Available Categories: ${VALID_CATEGORIES.join(', ')}`);
    let category = await promptQuestion(rl, '4. Select Category', 'Action');
    const matchedCategory = VALID_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());
    category = matchedCategory || 'Action';

    // 5. Difficulty
    console.log(`\n   Available Difficulties: ${VALID_DIFFICULTIES.join(', ')}`);
    let difficulty = await promptQuestion(rl, '5. Select Difficulty', 'Medium');
    const matchedDiff = VALID_DIFFICULTIES.find(d => d.toLowerCase() === difficulty.toLowerCase());
    difficulty = matchedDiff || 'Medium';

    // 6. Description
    let description = await promptQuestion(
      rl,
      '6. Enter Short Description',
      `An exciting ${category.toLowerCase()} arcade experience in the ArcadeVerse.`
    );

    // Compute Folder & ID
    const titleSlug = toSlug(title);
    const folderName = `${titleSlug}_${github}`;
    const targetDir = path.join(process.cwd(), 'games', folderName);

    console.log('\n[INFO] ----------------------------------------------------');
    console.log('   Scaffolding Preview');
    console.log('----------------------------------------------------');
    console.log(`   • Title:       ${title}`);
    console.log(`   • Author:      ${author} (@${github})`);
    console.log(`   • Category:    ${category}`);
    console.log(`   • Difficulty:  ${difficulty}`);
    console.log(`   • Directory:   games/${folderName}`);
    console.log('----------------------------------------------------\n');

    const confirm = await promptQuestion(rl, 'Proceed with scaffolding? (Y/n)', 'Y');
    if (confirm.toLowerCase() !== 'y') {
      console.log('\n[INFO] Operation cancelled by user.\n');
      rl.close();
      return;
    }

    // Ensure Directory Exists
    if (fs.existsSync(targetDir)) {
      console.error(`\n[FAIL] Error: Directory already exists: games/${folderName}\n`);
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
  </div>

  <script src="../../assets/js/arcadeverse-sdk.js"></script>
  <script src="game.js"></script>
</body>
</html>
`;
    fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtmlContent, 'utf8');

    // File 3: style.css
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
  max-height: 100%;
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
`;
    fs.writeFileSync(path.join(targetDir, 'style.css'), styleCssContent, 'utf8');

    // File 4: game.js (Standardized Lifecycle Bridge & Animation Loop)
    const gameJsContent = `/**
 * ${title}
 * Author: ${author} (@${github})
 * Powered by ArcadeVerse Game Engine
 */

(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudScore = document.getElementById('hudScore');
  const hudLives = document.getElementById('hudLives');
  const startOverlay = document.getElementById('startOverlay');
  const btnPlay = document.getElementById('btnPlay');

  let animationFrameId = null;
  let isPlaying = false;
  let score = 0;
  let lives = 3;

  const player = {
    x: 400,
    y: 520,
    width: 48,
    height: 16,
    speed: 7,
    dx: 0
  };

  const keys = {};

  function initControls() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    btnPlay.addEventListener('click', () => {
      startGame();
    });
  }

  function startGame() {
    startOverlay.classList.add('hidden');
    isPlaying = true;
    score = 0;
    lives = 3;
    updateHUD();
    gameLoop();
  }

  function updateHUD() {
    if (hudScore) hudScore.textContent = score;
    if (hudLives) hudLives.textContent = lives;
  }

  function update() {
    if (!isPlaying) return;

    if (keys['ArrowLeft'] || keys['KeyA']) {
      player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      player.x += player.speed;
    }

    // Boundary constraints
    if (player.x < 10) player.x = 10;
    if (player.x + player.width > canvas.width - 10) {
      player.x = canvas.width - 10 - player.width;
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

    // Player Paddle
    ctx.fillStyle = '#00f5ff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;
  }

  function gameLoop() {
    if (!isPlaying) return;
    update();
    render();
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // --- ArcadeVerse Lifecycle Bridge Hooks ---
  if (window.ArcadeVerse) {
    ArcadeVerse.onPause(() => {
      isPlaying = false;
    });

    ArcadeVerse.onResume(() => {
      if (!startOverlay.classList.contains('hidden')) return;
      isPlaying = true;
      gameLoop();
    });

    ArcadeVerse.onTeardown(() => {
      isPlaying = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });
  }

  initControls();
})();
`;
    fs.writeFileSync(path.join(targetDir, 'game.js'), gameJsContent, 'utf8');

    console.log(`\n[OK] Successfully scaffolded: games/${folderName}`);
    console.log('   ├── game.json');
    console.log('   ├── index.html');
    console.log('   ├── style.css');
    console.log('   └── game.js\n');
    console.log('[INFO] Next Steps:');
    console.log('   1. Customize your game logic in games/' + folderName + '/game.js');
    console.log('   2. Verify standards: node scripts/validate-games.js\n');

    rl.close();
  } catch (err) {
    console.error('\n[FAIL] Scaffolder encountered an unexpected error:', err);
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, toSlug };
