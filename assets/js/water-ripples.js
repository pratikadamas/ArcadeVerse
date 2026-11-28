/**
 * 2D Water Surface Wave Ripple & Specular Refraction Physics Engine (#1510)
 * Solves the discrete 2D wave equation across dual heightfield buffers:
 * height[x, y] = (h[x-1,y] + h[x+1,y] + h[x,y-1] + h[x,y+1]) / 2 - prev_h[x, y]
 * with damping, normal mapping, light specular highlights, and ambient rain mode.
 */

class WaterRipplesEngine {
    constructor(width = 160, height = 120, options = {}) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        this.buffer1 = new Float32Array(this.size);
        this.buffer2 = new Float32Array(this.size);
        this.currentBuffer = this.buffer1;
        this.previousBuffer = this.buffer2;

        this.damping = options.damping || 0.985;
        this.rainFrequency = options.rainFrequency || 0.05;
        this.rainEnabled = options.rainEnabled ?? true;

        this.canvas = null;
        this.ctx = null;
        this.imageData = null;
        this.animFrameId = null;
    }

    addDrop(x, y, radius = 2, strength = 128) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        const r2 = radius * radius;

        for (let j = -radius; j <= radius; j++) {
            const py = cy + j;
            if (py <= 0 || py >= this.height - 1) continue;

            for (let i = -radius; i <= radius; i++) {
                const px = cx + i;
                if (px <= 0 || px >= this.width - 1) continue;

                const distSq = i * i + j * j;
                if (distSq <= r2) {
                    const factor = 1 - distSq / r2;
                    const idx = py * this.width + px;
                    this.currentBuffer[idx] += strength * factor;
                    // Clamp heightfield
                    if (this.currentBuffer[idx] > 255) this.currentBuffer[idx] = 255;
                    if (this.currentBuffer[idx] < -255) this.currentBuffer[idx] = -255;
                }
            }
        }
    }

    propagate() {
        const w = this.width;
        const h = this.height;
        const cur = this.currentBuffer;
        const prev = this.previousBuffer;
        const damp = this.damping;

        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = rowOffset + x;
                // Discrete wave propagation
                const wave = (cur[idx - 1] + cur[idx + 1] + cur[idx - w] + cur[idx + w]) * 0.5 - prev[idx];
                prev[idx] = wave * damp;
            }
        }

        // Swap buffers
        this.currentBuffer = prev;
        this.previousBuffer = cur;

        if (this.rainEnabled && Math.random() < this.rainFrequency) {
            const rx = 10 + Math.random() * (w - 20);
            const ry = 10 + Math.random() * (h - 20);
            this.addDrop(rx, ry, 2, 80 + Math.random() * 60);
        }
    }

    render(ctx) {
        if (!ctx) return;
        const w = this.width;
        const h = this.height;
        const cur = this.currentBuffer;

        if (!this.imageData) {
            this.imageData = ctx.createImageData(w, h);
        }
        const data = this.imageData.data;

        for (let y = 1; y < h - 1; y++) {
            const row = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = row + x;
                const pixelIdx = idx * 4;

                // Approximate surface normal vector via central differences
                const dx = cur[idx + 1] - cur[idx - 1];
                const dy = cur[idx + w] - cur[idx - w];

                // Simulated specular and caustic highlight
                const highlight = Math.max(0, Math.min(255, 60 + dx * 2 - dy * 2));
                const deepBlue = Math.max(0, Math.min(255, 20 + highlight * 0.3));

                data[pixelIdx] = Math.max(0, Math.min(255, highlight * 0.5)); // R
                data[pixelIdx + 1] = Math.max(0, Math.min(255, 120 + highlight * 0.5)); // G
                data[pixelIdx + 2] = Math.max(0, Math.min(255, 180 + highlight * 0.3)); // B
                data[pixelIdx + 3] = 255;
            }
        }

        ctx.putImageData(this.imageData, 0, 0);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WaterRipplesEngine };
}
