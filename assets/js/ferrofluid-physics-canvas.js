/**
 * Ferrofluid Magnetic Spike Canvas Simulator (#1412)
 * Pure 2D HTML5 Canvas simulation of magnetic fluid dynamics.
 * Calculates magnetic vector fields, surface tension, and Cowley-Rosensweig
 * spike formation with specular lighting highlights.
 */

class FerrofluidSimulation {
    constructor(options = {}) {
        this.width = options.width || 600;
        this.height = options.height || 400;
        this.centerX = options.centerX || this.width / 2;
        this.centerY = options.centerY || this.height / 2;
        this.baseRadius = options.baseRadius || 60;
        this.numSpikes = options.numSpikes || 64;
        this.viscosity = options.viscosity || 0.85;
        this.magneticField = { x: this.centerX, y: this.centerY - 80, strength: 1.0 };
        this.spikes = [];
        this.time = 0;

        this.initSpikes();
    }

    initSpikes() {
        this.spikes = [];
        for (let i = 0; i < this.numSpikes; i++) {
            const angle = (i / this.numSpikes) * Math.PI * 2;
            this.spikes.push({
                angle,
                currentLength: this.baseRadius,
                targetLength: this.baseRadius,
                velocity: 0,
                baseLength: this.baseRadius
            });
        }
    }

    setMagnetPosition(x, y, strength = 1.0) {
        this.magneticField.x = x;
        this.magneticField.y = y;
        this.magneticField.strength = Math.max(0, Math.min(2.5, strength));
    }

    update(dt = 0.016) {
        this.time += dt;
        const magX = this.magneticField.x;
        const magY = this.magneticField.y;
        const magStrength = this.magneticField.strength;

        for (let i = 0; i < this.spikes.length; i++) {
            const s = this.spikes[i];
            const cosA = Math.cos(s.angle);
            const sinA = Math.sin(s.angle);

            // Tip location in world coordinates
            const tipX = this.centerX + cosA * s.currentLength;
            const tipY = this.centerY + sinA * s.currentLength;

            // Vector to magnetic pole
            const dx = magX - tipX;
            const dy = magY - tipY;
            const distSq = dx * dx + dy * dy + 100;
            const dist = Math.sqrt(distSq);

            // Dot product between spike normal and field vector (alignment)
            const dirX = dx / dist;
            const dirY = dy / dist;
            const alignment = Math.max(0, cosA * dirX + sinA * dirY);

            // Cowley-Rosensweig instability: spike elongation above critical threshold
            const magneticForce = (magStrength * 8000 / distSq) * alignment;
            const surfaceTension = (s.currentLength - s.baseLength) * 0.25;

            // Micro turbulence noise
            const noise = Math.sin(s.angle * 6 + this.time * 4) * 3;

            s.targetLength = s.baseLength + Math.min(140, magneticForce * 12) + noise;

            // Spring-damper integration
            const force = (s.targetLength - s.currentLength) * 0.15;
            s.velocity = (s.velocity + force) * this.viscosity;
            s.currentLength += s.velocity;
            s.currentLength = Math.max(s.baseLength * 0.7, s.currentLength);
        }
    }

    render(ctx) {
        if (!ctx) return;

        ctx.save();
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Magnetic core fluid body
        ctx.beginPath();
        const first = this.spikes[0];
        const startX = this.centerX + Math.cos(first.angle) * first.currentLength;
        const startY = this.centerY + Math.sin(first.angle) * first.currentLength;
        ctx.moveTo(startX, startY);

        for (let i = 1; i <= this.spikes.length; i++) {
            const curr = this.spikes[i % this.spikes.length];
            const prev = this.spikes[i - 1];

            const p0x = this.centerX + Math.cos(prev.angle) * prev.currentLength;
            const p0y = this.centerY + Math.sin(prev.angle) * prev.currentLength;
            const p1x = this.centerX + Math.cos(curr.angle) * curr.currentLength;
            const p1y = this.centerY + Math.sin(curr.angle) * curr.currentLength;

            const midX = (p0x + p1x) / 2;
            const midY = (p0y + p1y) / 2;
            ctx.quadraticCurveTo(p0x, p0y, midX, midY);
        }
        ctx.closePath();

        // Dark metallic gradient fill
        const grad = ctx.createRadialGradient(
            this.centerX, this.centerY, this.baseRadius * 0.3,
            this.centerX, this.centerY, this.baseRadius * 2.5
        );
        grad.addColorStop(0, '#1a2432');
        grad.addColorStop(0.5, '#0c1017');
        grad.addColorStop(1, '#020305');

        ctx.fillStyle = grad;
        ctx.fill();

        // Metallic specular edge highlight
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#4deeea';
        ctx.stroke();

        // Render magnet indicator
        ctx.beginPath();
        ctx.arc(this.magneticField.x, this.magneticField.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0055';
        ctx.fill();
        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FerrofluidSimulation };
}

if (typeof window !== 'undefined') {
    window.FerrofluidSimulation = FerrofluidSimulation;
}
