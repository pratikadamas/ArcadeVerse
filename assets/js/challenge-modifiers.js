/**
 * ChallengeModifierEngine - Client-Side Bookmarkable Challenge Run Modifier Engine
 * 
 * Standardized gameplay mutators (Sudden Death, Low Gravity, Turbo Clock, Inverted Steer, Fog of War),
 * deterministic bitmask encoding, and Base64 URL share link generation.
 */

class ChallengeModifierEngine {
  constructor() {
    this.MODIFIERS = [
      { id: 'suddenDeath', bit: 1 << 0, name: 'Sudden Death', desc: '1 Hit Point / Instant Failure', icon: 'zap' },
      { id: 'lowGravity', bit: 1 << 1, name: 'Low Gravity', desc: '0.5x World Physics Gravity', icon: 'feather' },
      { id: 'turboClock', bit: 1 << 2, name: 'Turbo Clock', desc: '1.5x Fast-Forward Game Speed', icon: 'fast-forward' },
      { id: 'invertedSteer', bit: 1 << 3, name: 'Inverted Controls', desc: 'Reverses horizontal steering', icon: 'refresh-cw' },
      { id: 'fogOfWar', bit: 1 << 4, name: 'Foggy Darkness', desc: 'Reduced player vision spotlight', icon: 'eye-off' }
    ];

    this.activeMask = 0;
  }

  enableModifier(id) {
    const mod = this.MODIFIERS.find(m => m.id === id);
    if (mod) {
      this.activeMask |= mod.bit;
    }
  }

  disableModifier(id) {
    const mod = this.MODIFIERS.find(m => m.id === id);
    if (mod) {
      this.activeMask &= ~mod.bit;
    }
  }

  toggleModifier(id) {
    const mod = this.MODIFIERS.find(m => m.id === id);
    if (mod) {
      this.activeMask ^= mod.bit;
    }
    return this.isModifierActive(id);
  }

  isModifierActive(id) {
    const mod = this.MODIFIERS.find(m => m.id === id);
    return mod ? (this.activeMask & mod.bit) !== 0 : false;
  }

  getActiveModifiers() {
    return this.MODIFIERS.filter(m => (this.activeMask & m.bit) !== 0);
  }

  clearAll() {
    this.activeMask = 0;
  }

  encodeShareableUrl(gameId, baseUrl = 'https://arcadeverse.dev') {
    const payload = JSON.stringify({ g: gameId, m: this.activeMask, t: Date.now() });
    const b64 = typeof Buffer !== 'undefined'
      ? Buffer.from(payload).toString('base64url')
      : btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${baseUrl}?game=${encodeURIComponent(gameId)}&challenge=${b64}`;
  }

  decodeShareableUrl(queryString) {
    try {
      const match = queryString.match(/challenge=([A-Za-z0-9_-]+)/);
      if (!match) return null;
      const b64 = match[1];
      const jsonStr = typeof Buffer !== 'undefined'
        ? Buffer.from(b64, 'base64url').toString('utf8')
        : atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.m === 'number') {
        this.activeMask = parsed.m;
        return {
          gameId: parsed.g,
          mask: parsed.m,
          activeModifiers: this.getActiveModifiers()
        };
      }
    } catch (_) {}
    return null;
  }

  getMultiplier() {
    // Score handicap bonus multiplier
    const count = this.getActiveModifiers().length;
    return 1.0 + count * 0.25;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChallengeModifierEngine };
}
