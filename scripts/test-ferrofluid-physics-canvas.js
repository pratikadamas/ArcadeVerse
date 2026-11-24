const test = require('node:test');
const assert = require('node:assert/strict');
const { FerrofluidSimulation } = require('../assets/js/ferrofluid-physics-canvas.js');

function createMockContext() {
    return {
        save() {},
        restore() {},
        fillRect() {},
        beginPath() {},
        moveTo() {},
        quadraticCurveTo() {},
        closePath() {},
        arc() {},
        fill() {},
        stroke() {},
        createRadialGradient() {
            return {
                addColorStop() {}
            };
        }
    };
}

test('FerrofluidSimulation initializes radial spike vertices', () => {
    const sim = new FerrofluidSimulation({ width: 800, height: 600, numSpikes: 48 });
    assert.equal(sim.spikes.length, 48, 'Should initialize 48 spike nodes');
    assert.equal(sim.centerX, 400, 'Center X should default to width / 2');
    assert.equal(sim.centerY, 300, 'Center Y should default to height / 2');
});

test('FerrofluidSimulation elongates spikes pointing toward magnetic field', () => {
    const sim = new FerrofluidSimulation({ width: 400, height: 400, baseRadius: 50, numSpikes: 32 });
    
    // Position magnet directly above the center
    sim.setMagnetPosition(200, 100, 2.0);

    // Run multiple update steps
    for (let i = 0; i < 20; i++) {
        sim.update(0.016);
    }

    // Find the spike oriented towards the magnet (-PI/2 or 3PI/2)
    const topSpikes = sim.spikes.filter(s => Math.abs(Math.cos(s.angle)) < 0.3 && Math.sin(s.angle) < 0);
    const bottomSpikes = sim.spikes.filter(s => Math.abs(Math.cos(s.angle)) < 0.3 && Math.sin(s.angle) > 0);

    assert.ok(topSpikes.length > 0 && bottomSpikes.length > 0, 'Spike directions identified');
    assert.ok(topSpikes[0].currentLength > bottomSpikes[0].currentLength, 'Top spike should elongate toward magnet');
});

test('FerrofluidSimulation renders smoothly to canvas context', () => {
    const sim = new FerrofluidSimulation();
    const ctx = createMockContext();
    assert.doesNotThrow(() => {
        sim.render(ctx);
    }, 'Render call should succeed without exception');
});
