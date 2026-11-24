/**
 * ThermalHeatShimmerFilter - Dynamic Canvas Heat Distortion & Thermal Mirage Air Shimmer Filter
 * 
 * Implements an analytical thermal mirage shader shifting horizontal scanline pixels
 * with phase-offset sinusoidal waves (dx = A * sin(omega * y + phi * t)), with localized
 * heat emitter bounds and fast clamped buffer manipulation.
 */

class ThermalHeatShimmerFilter {
  constructor(options = {}) {
    this.intensity = options.intensity !== undefined ? options.intensity : 4.0; // Max horizontal pixel displacement (amplitude)
    this.frequency = options.frequency !== undefined ? options.frequency : 0.08; // Wave frequency (omega)
    this.speed = options.speed !== undefined ? options.speed : 0.005; // Time phase propagation speed (phi)
    this.zones = [];
  }

  createHeatZone(x, y, width, height, intensity = this.intensity) {
    const zone = {
      id: Math.random().toString(36).substring(2, 9),
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      intensity
    };
    this.zones.push(zone);
    return zone;
  }

  calculateDisplacement(y, timeMs, intensity = this.intensity) {
    return Math.sin(y * this.frequency + timeMs * this.speed) * intensity;
  }

  applyShimmer(sourceCanvas, targetCtx, timeMs = Date.now()) {
    if (!sourceCanvas || !targetCtx) return;
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    // Draw base un-distorted image
    targetCtx.drawImage(sourceCanvas, 0, 0);

    const activeZones = this.zones.length > 0 ? this.zones : [{ x: 0, y: 0, width: w, height: h, intensity: this.intensity }];

    // Apply scanline sinusoidal slices per active zone
    for (const zone of activeZones) {
      const startY = Math.max(0, zone.y);
      const endY = Math.min(h, zone.y + zone.height);

      for (let y = startY; y < endY; y += 2) {
        // Vertical dissipation gradient (stronger at bottom, fades towards top)
        const verticalFade = 1.0 - (y - startY) / (zone.height || 1);
        const shiftX = Math.round(this.calculateDisplacement(y, timeMs, zone.intensity) * verticalFade);

        targetCtx.drawImage(
          sourceCanvas,
          zone.x, y, zone.width, 2, // Source slice
          zone.x + shiftX, y, zone.width, 2 // Destination slice
        );
      }
    }
  }

  clearZones() {
    this.zones = [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThermalHeatShimmerFilter };
}
