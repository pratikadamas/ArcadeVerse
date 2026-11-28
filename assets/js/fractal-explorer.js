/**
 * Procedural Mandelbrot & Julia Set Fractal Explorer (#1567)
 * Implements smooth continuous coloring: mu = n + 1 - log(log(|z|)) / log(2),
 * complex plane coordinate mapping, and zoom/pan navigation.
 */

class FractalExplorerEngine {
    constructor(width = 160, height = 120, options = {}) {
        this.width = width;
        this.height = height;

        this.mode = options.mode || 'mandelbrot'; // 'mandelbrot' or 'julia'
        this.maxIterations = options.maxIterations || 80;
        this.palette = options.palette || 'electricNeon';

        // Viewport bounds in complex plane
        this.centerX = -0.5;
        this.centerY = 0.0;
        this.zoom = 1.0;

        // Julia constant
        this.juliaCr = -0.7;
        this.juliaCi = 0.27015;
    }

    resetView() {
        this.centerX = this.mode === 'mandelbrot' ? -0.5 : 0.0;
        this.centerY = 0.0;
        this.zoom = 1.0;
    }

    zoomAt(screenX, screenY, factor = 1.5) {
        // Map screen to complex coords
        const [cx, cy] = this.screenToComplex(screenX, screenY);
        this.centerX = cx;
        this.centerY = cy;
        this.zoom *= factor;
    }

    screenToComplex(sx, sy) {
        const aspect = this.width / this.height;
        const rangeY = 2.4 / this.zoom;
        const rangeX = rangeY * aspect;

        const cr = this.centerX + (sx / this.width - 0.5) * rangeX;
        const ci = this.centerY + (sy / this.height - 0.5) * rangeY;
        return [cr, ci];
    }

    evaluatePoint(cr, ci) {
        let zr = this.mode === 'mandelbrot' ? 0.0 : cr;
        let zi = this.mode === 'mandelbrot' ? 0.0 : ci;
        const cReal = this.mode === 'mandelbrot' ? cr : this.juliaCr;
        const cImag = this.mode === 'mandelbrot' ? ci : this.juliaCi;

        let n = 0;
        const maxIt = this.maxIterations;

        while (zr * zr + zi * zi <= 4.0 && n < maxIt) {
            const zrNew = zr * zr - zi * zi + cReal;
            const ziNew = 2.0 * zr * zi + cImag;
            zr = zrNew;
            zi = ziNew;
            n++;
        }

        if (n === maxIt) return -1; // Interior point

        // Smooth continuous potential coloring
        const zMag = Math.sqrt(zr * zr + zi * zi);
        return n + 1 - Math.log(Math.log(zMag)) / Math.LN2;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FractalExplorerEngine };
}
