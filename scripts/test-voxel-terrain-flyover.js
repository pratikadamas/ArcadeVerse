const test = require('node:test');
const assert = require('node:assert/strict');
const { VoxelTerrainFlyover } = require('../assets/js/voxel-terrain-flyover.js');

function createMockCanvasContext(w, h) {
    return {
        createImageData(width, height) {
            return {
                width,
                height,
                data: new Uint8ClampedArray(width * height * 4)
            };
        },
        putImageData() {}
    };
}

test('VoxelTerrainFlyover creates heightmap and terrain colormap', () => {
    const engine = new VoxelTerrainFlyover({ width: 160, height: 100, mapWidth: 64, mapHeight: 64 });
    assert.equal(engine.heightMap.length, 64 * 64, 'Heightmap size matches dimensions');
    assert.equal(engine.colorMap.length, 64 * 64, 'Color map size matches dimensions');

    let nonZeroElevations = 0;
    for (let i = 0; i < engine.heightMap.length; i++) {
        if (engine.heightMap[i] > 0) nonZeroElevations++;
    }
    assert.ok(nonZeroElevations > 0, 'Heightmap should contain procedural elevations');
});

test('VoxelTerrainFlyover updates camera motion along angle vector', () => {
    const engine = new VoxelTerrainFlyover();
    const initialX = engine.camera.x;
    const initialY = engine.camera.y;

    engine.camera.angle = 0; // East
    engine.update(0.016);

    assert.ok(engine.camera.x > initialX, 'Camera X should advance along heading angle');
});

test('VoxelTerrainFlyover executes column raycast rendering without errors', () => {
    const engine = new VoxelTerrainFlyover({ width: 100, height: 60, mapWidth: 64, mapHeight: 64 });
    const ctx = createMockCanvasContext(100, 60);

    assert.doesNotThrow(() => {
        engine.render(ctx);
    }, 'Voxel renderer executes successfully');
});
