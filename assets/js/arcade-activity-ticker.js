/**
 * ArcadeActivityTicker - Global Arcade Activity Feed Ticker & Live Event Notification Stream
 * 
 * Implements a lightweight, smooth continuous horizontal marquee activity stream
 * docked at the bottom of the catalog, ingesting high score breakthroughs, achievements,
 * and daily challenge completions with hover-to-pause and mobile collapse.
 */

class ArcadeActivityTicker {
  constructor(options = {}) {
    this.maxEvents = options.maxEvents || 20;
    this.events = [];
    this.speed = options.speed || 1.0;
    this.paused = false;
    this.collapsed = false;

    // Load initial default demo feed
    this.addEvent({
      id: 'init-1',
      type: 'highScore',
      user: 'PixelChamp',
      game: 'Cyber Runner',
      score: 1420,
      timestamp: Date.now() - 120000
    });
    this.addEvent({
      id: 'init-2',
      type: 'achievement',
      user: 'RetroGamer',
      achievement: 'Neon Ace',
      game: 'Space Invaders',
      timestamp: Date.now() - 60000
    });
  }

  addEvent(event) {
    if (!event) return;
    this.events.unshift({
      id: event.id || Math.random().toString(36).substring(2, 9),
      type: event.type || 'play',
      user: event.user || 'Anonymous',
      game: event.game || 'Arcade Game',
      score: event.score,
      achievement: event.achievement,
      timestamp: event.timestamp || Date.now()
    });

    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    return this.collapsed;
  }

  formatEventText(e) {
    if (e.type === 'highScore') {
      return `[HIGH SCORE] ${e.user} set ${e.score} pts on ${e.game}!`;
    } else if (e.type === 'achievement') {
      return `[UNLOCKED] ${e.user} earned "${e.achievement}" in ${e.game}!`;
    }
    return `[PLAY] ${e.user} completed a run on ${e.game}.`;
  }

  renderHtml() {
    if (this.collapsed) {
      return '<div class="arcade-activity-ticker collapsed"><button class="ticker-expand-btn">Activity Feed</button></div>';
    }

    const itemsHtml = this.events.map(e => `
      <div class="ticker-item" data-type="${e.type}" style="display:inline-flex;align-items:center;gap:6px;margin:0 16px;white-space:nowrap;font-size:0.8rem;color:#e2e8f0;">
        <span class="ticker-pill" style="background:rgba(0,245,255,0.15);border:1px solid #00f5ff;color:#00f5ff;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:700;">${e.type.toUpperCase()}</span>
        <span>${this.formatEventText(e)}</span>
      </div>
    `.trim()).join('');

    return `
      <div class="arcade-activity-ticker" style="position:fixed;bottom:0;left:0;width:100%;background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border-top:1px solid rgba(255,255,255,0.1);padding:6px 12px;z-index:900;overflow:hidden;display:flex;align-items:center;">
        <div class="ticker-marquee-inner" style="display:flex;white-space:nowrap;">
          ${itemsHtml}
        </div>
      </div>
    `.trim();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ArcadeActivityTicker };
}
