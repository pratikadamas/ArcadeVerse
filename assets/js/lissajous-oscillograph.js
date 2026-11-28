/**
 * 2D Lissajous Curve & Harmonograph Phase-Shift Oscillograph Engine (#1570)
 * Evaluates parametric curves:
 * x(t) = A * sin(a * t + delta) * e^(-d1 * t)
 * y(t) = B * sin(b * t) * e^(-d2 * t)
 * across smooth sub-stepped segments with glowing phosphor trails.
 */

class LissajousOscillographEngine {
    static RATIOS = {
        '1:1': { a: 1, b: 1 },
        '2:3': { a: 2, b: 3 },
        '3:4': { a: 3, b: 4 },
        '5:4': { a: 5, b: 4 },
        '5:6': { a: 5, b: 6 }
    };

    constructor(width = 600, height = 400, options = {}) {
        this.width = width;
        this.height = height;

        this.freqX = options.freqX || 3;
        this.freqY = options.freqY || 4;
        this.phaseDelta = options.phaseDelta || 0.0;
        this.damping = options.damping || 0.0; // 0 for pure Lissajous, >0 for harmonograph
        this.steps = options.steps || 600;
    }

    setRatio(ratioKey) {
        const r = LissajousOscillographEngine.RATIOS[ratioKey];
        if (!r) return false;
        this.freqX = r.a;
        this.freqY = r.b;
        return true;
    }

    getPointAt(t, radiusX = 160, radiusY = 140) {
        const decayX = this.damping > 0 ? Math.exp(-this.damping * t) : 1.0;
        const decayY = this.damping > 0 ? Math.exp(-this.damping * t) : 1.0;

        const x = this.width / 2 + radiusX * Math.sin(this.freqX * t + this.phaseDelta) * decayX;
        const y = this.height / 2 + radiusY * Math.sin(this.freqY * t) * decayY;
        return { x, y };
    }

    generatePoints(maxT = Math.PI * 2) {
        const points = [];
        const dt = maxT / this.steps;

        for (let i = 0; i <= this.steps; i++) {
            const t = i * dt;
            points.push(this.getPointAt(t));
        }

        return points;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LissajousOscillographEngine };
}
