/**
 * HolographicDiffractionStudio - Interactive Canvas Holographic Diffraction Grating & Rainbow Iridescence Studio
 * 
 * Simulates thin-film optical interference, prismatic rainbow dispersion,
 * and specular glare caustics responding dynamically to cursor coordinates and mobile device tilt.
 */

class HolographicDiffractionStudio {
  constructor(options = {}) {
    this.width = options.width || 400;
    this.height = options.height || 300;
    this.foilType = options.foilType || 'prismatic'; // 'prismatic', 'crackedIce', 'starlight'
    this.intensity = options.intensity !== undefined ? options.intensity : 0.8;
    this.cursorX = this.width / 2;
    this.cursorY = this.height / 2;
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  }

  setCursor(x, y) {
    this.cursorX = Math.max(0, Math.min(this.width, x));
    this.cursorY = Math.max(0, Math.min(this.height, y));
  }

  calculateWavelengthColor(angleNorm) {
    // Maps angle (0 to 1) across visible rainbow spectrum (Violet 380nm to Red 700nm)
    const hue = (angleNorm * 360) % 360;
    return `hsla(${hue}, 100%, 65%, ${this.intensity})`;
  }

  render(ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.reducedMotion) {
      // Static soft foil fallback
      const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
      grad.addColorStop(0, 'rgba(0, 245, 255, 0.2)');
      grad.addColorStop(0.5, 'rgba(255, 0, 85, 0.2)');
      grad.addColorStop(1, 'rgba(255, 220, 0, 0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    const normX = this.cursorX / this.width;
    const normY = this.cursorY / this.height;
    const angle = Math.atan2(this.cursorY - this.height / 2, this.cursorX - this.width / 2);

    // Prismatic diffraction bands
    const bandsCount = 18;
    for (let i = 0; i < bandsCount; i++) {
      const bandOffset = (i / bandsCount) + (normX * 0.4 + normY * 0.4);
      const color = this.calculateWavelengthColor(bandOffset);

      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();

      if (this.foilType === 'crackedIce') {
        // Geometric diamond faceted foil
        const x = (i * 24 + normX * 40) % this.width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 20, this.height / 2);
        ctx.lineTo(x, this.height);
        ctx.lineTo(x - 20, this.height / 2);
      } else {
        // Smooth continuous diffraction grating bars
        const slantX = Math.cos(angle) * (this.width / 2);
        const startX = (i * (this.width / bandsCount) + slantX) % (this.width * 1.5) - (this.width * 0.25);
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX + 60, 0);
        ctx.lineTo(startX - 20, this.height);
        ctx.lineTo(startX - 80, this.height);
      }

      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Specular glare reflection hot-spot
    const glareGrad = ctx.createRadialGradient(
      this.cursorX, this.cursorY, 5,
      this.cursorX, this.cursorY, 90
    );
    glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    glareGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
    glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    ctx.fillStyle = glareGrad;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HolographicDiffractionStudio };
}
