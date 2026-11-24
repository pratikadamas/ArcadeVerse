/**
 * GlassmorphismReticleStudio - CSS Glassmorphism & Neon HUD Reticle Customizer for Arcade Cabinets
 * 
 * Provides an interactive developer & player aiming reticle customizer with sub-pixel canvas rendering,
 * dynamic recoil spread & recovery spring damping, neon glows, and frosted glassmorphic containers.
 */

class GlassmorphismReticleStudio {
  constructor(options = {}) {
    this.container = options.container || (typeof document !== 'undefined' ? document.body : null);
    this.color = options.color || '#00f5ff';
    this.dotSize = options.dotSize || 3;
    this.crosshairLength = options.crosshairLength || 14;
    this.crosshairGap = options.crosshairGap || 6;
    this.thickness = options.thickness || 2;
    this.ringRadius = options.ringRadius || 24;
    this.showRing = options.showRing !== undefined ? options.showRing : true;
    this.recoilRecovery = options.recoilRecovery || 0.12;

    this.currentSpread = 0;
    this.targetSpread = 0;
    this.mouseX = 0;
    this.mouseY = 0;
  }

  triggerRecoil(impulse = 12) {
    this.currentSpread = Math.min(35, this.currentSpread + impulse);
  }

  updateSpread() {
    this.currentSpread += (this.targetSpread - this.currentSpread) * this.recoilRecovery;
    return this.currentSpread;
  }

  setCoordinates(x, y) {
    this.mouseX = x;
    this.mouseY = y;
  }

  exportPreset() {
    return JSON.stringify({
      color: this.color,
      dotSize: this.dotSize,
      crosshairLength: this.crosshairLength,
      crosshairGap: this.crosshairGap,
      thickness: this.thickness,
      ringRadius: this.ringRadius,
      showRing: this.showRing
    }, null, 2);
  }

  importPreset(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.color) this.color = data.color;
      if (data.dotSize !== undefined) this.dotSize = data.dotSize;
      if (data.crosshairLength !== undefined) this.crosshairLength = data.crosshairLength;
      if (data.crosshairGap !== undefined) this.crosshairGap = data.crosshairGap;
      if (data.thickness !== undefined) this.thickness = data.thickness;
      if (data.ringRadius !== undefined) this.ringRadius = data.ringRadius;
      if (data.showRing !== undefined) this.showRing = Boolean(data.showRing);
      return true;
    } catch (_) {
      return false;
    }
  }

  render(ctx, x = this.mouseX, y = this.mouseY) {
    if (!ctx) return;
    this.updateSpread();

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = this.thickness;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;

    // Center targeting dot
    if (this.dotSize > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const gap = this.crosshairGap + this.currentSpread;
    const len = this.crosshairLength;

    // Crossbars (Top, Bottom, Left, Right)
    ctx.beginPath();
    // Top
    ctx.moveTo(0, -gap);
    ctx.lineTo(0, -gap - len);
    // Bottom
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + len);
    // Left
    ctx.moveTo(-gap, 0);
    ctx.lineTo(-gap - len, 0);
    // Right
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + len, 0);
    ctx.stroke();

    // Radial telemetry dial ring
    if (this.showRing && this.ringRadius > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.ringRadius + this.currentSpread * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GlassmorphismReticleStudio };
}
