/**
 * ChallengeDeepLinkManager - Shareable Game Challenge Deep-Link URL Generator with Target Score Badges
 * 
 * Generates sanitized challenge deep-links (?game={id}&challenge=1&target={score}&challenger={name}),
 * parses incoming challenge parameters, renders in-game floating challenge banners,
 * and triggers celebratory breakthrough alerts when target scores are surpassed.
 */

class ChallengeDeepLinkManager {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://arcadeverse.dev';
    this.activeChallenge = null;
  }

  generateChallengeUrl(gameId, targetScore, challengerName = 'Player') {
    if (!gameId) return null;
    const cleanId = encodeURIComponent(String(gameId).trim());
    const cleanScore = Math.max(0, Math.floor(Number(targetScore) || 0));
    const cleanName = encodeURIComponent(String(challengerName).trim().slice(0, 24));

    return `${this.baseUrl}?game=${cleanId}&challenge=1&target=${cleanScore}&challenger=${cleanName}`;
  }

  parseChallengeParams(queryString) {
    if (!queryString) return null;
    try {
      const params = new URLSearchParams(queryString.startsWith('?') ? queryString : `?${queryString}`);
      if (params.get('challenge') === '1') {
        const gameId = params.get('game');
        const targetScore = parseInt(params.get('target') || '0', 10);
        const challenger = decodeURIComponent(params.get('challenger') || 'A rival');

        if (gameId && targetScore > 0) {
          this.activeChallenge = {
            gameId,
            targetScore,
            challenger,
            beaten: false
          };
          return this.activeChallenge;
        }
      }
    } catch (_) {}
    return null;
  }

  checkScoreProgress(currentScore) {
    if (!this.activeChallenge || this.activeChallenge.beaten) {
      return { surpassed: false, activeChallenge: this.activeChallenge };
    }

    if (currentScore >= this.activeChallenge.targetScore) {
      this.activeChallenge.beaten = true;
      return {
        surpassed: true,
        challenger: this.activeChallenge.challenger,
        targetScore: this.activeChallenge.targetScore,
        score: currentScore
      };
    }

    return {
      surpassed: false,
      difference: this.activeChallenge.targetScore - currentScore
    };
  }

  generateBannerHtml() {
    if (!this.activeChallenge) return '';
    const safeChallenger = this.activeChallenge.challenger.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeTarget = this.activeChallenge.targetScore;

    return `
      <div class="challenge-target-banner" style="display:flex;align-items:center;gap:8px;background:rgba(234,179,8,0.15);border:1px solid #eab308;color:#fef08a;padding:6px 12px;border-radius:6px;font-size:0.8rem;font-weight:600;">
        <span class="challenge-target-icon">🏆</span>
        <span>Target: Beat <strong>${safeChallenger}</strong>'s score of <strong>${safeTarget} pts</strong>!</span>
      </div>
    `.trim();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChallengeDeepLinkManager };
}
