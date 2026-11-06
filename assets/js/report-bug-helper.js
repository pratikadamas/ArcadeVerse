/**
 * ArcadeVerse In-Modal 'Report Bug on this Game' Pre-filled GitHub Issue Button
 * Author: Babin123456
 * Automatically extracts active game metadata (title, id, author, category),
 * client user agent, screen resolution, viewport bounds, and constructs
 * a pre-populated GitHub issue URL opening in a new tab.
 */

(function () {
  'use strict';

  function initReportBugButton() {
    const reportBtn = document.getElementById('modal-report-bug-btn');
    if (!reportBtn) return;

    reportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      generateAndOpenBugReport();
    });
  }

  /**
   * Constructs GitHub issue URL and opens in a new tab
   */
  function generateAndOpenBugReport() {
    const modalTitle = document.getElementById('modal-game-title');
    const modalAuthor = document.getElementById('modal-game-author');
    const modalBadge = document.getElementById('modal-game-badge');
    const gameIframe = document.getElementById('game-iframe');

    const titleText = modalTitle ? modalTitle.textContent.trim() : 'Game';
    const authorText = modalAuthor ? modalAuthor.textContent.replace(/^By\s+@?/, '').trim() : 'Contributor';
    const categoryText = modalBadge ? modalBadge.textContent.trim() : 'Arcade';

    let gamePath = '';
    let gameId = '';
    if (gameIframe && gameIframe.src) {
      gamePath = gameIframe.src;
      const match = gamePath.match(/\/games\/([^\/]+)\//);
      if (match && match[1]) {
        gameId = match[1];
      }
    }

    if (!gameId) {
      gameId = titleText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    const browserInfo = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height} (Device Pixel Ratio: ${window.devicePixelRatio || 1})`;
    const viewportRes = `${window.innerWidth}x${window.innerHeight}`;
    const timestamp = new Date().toISOString();

    const issueTitle = `[Game Bug]: ${titleText} (${gameId})`;
    const issueBody = `### 🐛 Mini-Game Bug Report

**Game Title:** ${titleText}
**Game ID:** \`${gameId}\`
**Author / Contributor:** @${authorText}
**Category:** ${categoryText}
**Launch URL:** \`${gamePath}\`

---

### 🔍 Environment Diagnostics
- **Browser / User Agent:** \`${browserInfo}\`
- **Screen Resolution:** ${screenRes}
- **Active Viewport:** ${viewportRes}
- **Timestamp:** ${timestamp}

---

### 📋 Steps to Reproduce
1. Launch **${titleText}** from ArcadeVerse catalog.
2. [Describe what actions were performed...]
3. Observe unexpected behavior or console error.

---

### 🎯 Expected Behavior
[What should happen when playing?]

---

### ⚠️ Actual Behavior & Console Errors
[Describe the bug, frozen canvas, unresponsive controls, audio glitches, etc.]
`;

    const repoBase = 'https://github.com/DebasmitaBose0/ArcadeVerse/issues/new';
    const params = new URLSearchParams({
      title: issueTitle,
      labels: 'bug,game-bug',
      body: issueBody
    });

    const finalUrl = `${repoBase}?${params.toString()}`;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportBugButton);
  } else {
    initReportBugButton();
  }

  // Global Export
  window.ArcadeReportBug = {
    openReport: generateAndOpenBugReport
  };
})();
