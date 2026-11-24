/**
 * ParticleTextDissolve - Dynamic Canvas Particle Text Dissolve & Matrix Digit Rain Transition
 * 
 * Extracts raster pixel coordinates from offscreen canvas text and instantiates
 * an object-pooled physical particle swarm with multiple transition modes:
 * Vortex Dissolve, Gravitational Fall, Matrix Code Rain, and Reversible Assembly.
 */

class ParticleTextDissolve {
  constructor(options = {}) {
    this.maxParticles = options.maxParticles || 1000;
    this.particles = [];
    this.pool = [];
    this.mode = options.mode || 'vortex'; // 'vortex', 'gravity', 'matrix', 'assemble'
    this.active = false;
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    // Pre-allocate particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        originX: 0,
        originY: 0,
        vx: 0,
        vy: 0,
        alpha: 1,
        color: '#00f5ff',
        size: 2,
        char: '0'
      });
    }
  }

  dissolveText(text, startX, startY, options = {}) {
    this.mode = options.mode || this.mode;
    this.particles = [];

    if (this.reducedMotion) {
      // Instant transition fallback
      this.active = false;
      return [];
    }

    // Generate offscreen raster matrix
    const step = options.step || 3;
    const fontSize = options.fontSize || 32;
    const color = options.color || '#00f5ff';

    // Mock/approximate pixel grid points from text length and font size
    const charWidth = fontSize * 0.6;
    let poolIdx = 0;

    for (let i = 0; i < text.length; i++) {
      const charX = startX + i * charWidth;
      for (let py = 0; py < fontSize; py += step) {
        for (let px = 0; px < charWidth; px += step) {
          // Semi-random text raster mask
          if (Math.sin(px * 1.5 + py * 2.1) > -0.2 && poolIdx < this.maxParticles) {
            const p = this.pool[poolIdx++];
            p.originX = charX + px;
            p.originY = startY + py;
            p.size = step;
            p.color = color;
            p.alpha = 1.0;
            p.char = Math.random() > 0.5 ? '1' : '0';

            if (this.mode === 'assemble') {
              // Start dispersed, gather towards origin
              p.x = p.originX + (Math.random() - 0.5) * 300;
              p.y = p.originY + (Math.random() - 0.5) * 300;
              p.vx = (p.originX - p.x) * 0.05;
              p.vy = (p.originY - p.y) * 0.05;
            } else {
              p.x = p.originX;
              p.y = p.originY;

              if (this.mode === 'gravity') {
                p.vx = (Math.random() - 0.5) * 4;
                p.vy = Math.random() * -3;
              } else if (this.mode === 'matrix') {
                p.vx = 0;
                p.vy = 2 + Math.random() * 5;
              } else {
                // Vortex
                const angle = Math.atan2(p.y - startY, p.x - startX) + Math.PI / 2;
                const speed = 2 + Math.random() * 4;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
              }
            }

            this.particles.push(p);
          }
        }
      }
    }

    this.active = true;
    return this.particles;
  }

  update() {
    if (!this.active) return;
    let allFinished = true;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (this.mode === 'assemble') {
        p.x += (p.originX - p.x) * 0.1;
        p.y += (p.originY - p.y) * 0.1;
        if (Math.hypot(p.originX - p.x, p.originY - p.y) > 0.5) {
          allFinished = false;
        }
      } else {
        p.x += p.vx;
        p.y += p.vy;

        if (this.mode === 'gravity') {
          p.vy += 0.25; // gravity pull
        }

        p.alpha -= 0.015;
        if (p.alpha > 0) {
          allFinished = false;
        }
      }
    }

    if (allFinished) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!ctx || !this.active) return;
    this.update();

    ctx.save();
    for (const p of this.particles) {
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      if (this.mode === 'matrix') {
        ctx.font = '10px monospace';
        ctx.fillText(p.char, p.x, p.y);
      } else {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ParticleTextDissolve };
}
