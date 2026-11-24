/**
 * Pseudo-3D Voxel Terrain Flyover Engine (#1414)
 * Pure 2D Canvas raycasting column voxel landscape renderer (inspired by Comanche/Voxel Space).
 * Renders procedural rolling mountains, flight velocity, altitude controls, and HUD overlay.
 */

class VoxelTerrainFlyover {
    constructor(options = {}) {
        this.width = options.width || 320;
        this.height = options.height || 200;
        this.mapWidth = options.mapWidth || 256;
        this.mapHeight = options.mapHeight || 256;

        this.camera = {
            x: 0,
            y: 0,
            height: 50,
            angle: 0,
            horizon: this.height * 0.45,
            distance: 300,
            speed: 1.5
        };

        this.heightMap = new Uint8Array(this.mapWidth * this.mapHeight);
        this.colorMap = new Uint32Array(this.mapWidth * this.mapHeight);
        this.generateProceduralTerrain();
    }

    generateProceduralTerrain() {
        // Procedural multi-frequency sine/cosine terrain heightmap
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const idx = y * this.mapWidth + x;
                const nx = x / this.mapWidth;
                const ny = y / this.mapHeight;

                const elevation = (
                    Math.sin(nx * 12.0) * Math.cos(ny * 12.0) * 35 +
                    Math.sin(nx * 24.0 + 1.2) * 15 +
                    Math.cos(ny * 32.0 + 2.5) * 10 +
                    60
                );

                const clampedElev = Math.max(0, Math.min(255, Math.floor(elevation)));
                this.heightMap[idx] = clampedElev;

                // Cyberpunk / Retro Synthwave Color Palette (0xAABBGGRR)
                if (clampedElev < 45) {
                    this.colorMap[idx] = 0xff3b1408; // Deep trench blue
                } else if (clampedElev < 70) {
                    this.colorMap[idx] = 0xff662055; // Synthwave purple
                } else if (clampedElev < 100) {
                    this.colorMap[idx] = 0xff990088; // Neon magenta
                } else {
                    this.colorMap[idx] = 0xffffee00; // Cyan summit peak
                }
            }
        }
    }

    setCamera(x, y, height, angle) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.height = height;
        this.camera.angle = angle;
    }

    update(dt = 0.016) {
        this.camera.x += Math.cos(this.camera.angle) * this.camera.speed * dt * 60;
        this.camera.y += Math.sin(this.camera.angle) * this.camera.speed * dt * 60;

        // Wrap coordinates within map bounds
        this.camera.x = ((this.camera.x % this.mapWidth) + this.mapWidth) % this.mapWidth;
        this.camera.y = ((this.camera.y % this.mapHeight) + this.mapHeight) % this.mapHeight;
    }

    render(ctx) {
        if (!ctx || typeof ctx.createImageData !== 'function') return;

        const imgData = ctx.createImageData(this.width, this.height);
        const buf = new Uint32Array(imgData.data.buffer);

        // Sky background
        buf.fill(0xff12080a);

        const sinA = Math.sin(this.camera.angle);
        const cosA = Math.cos(this.camera.angle);

        // Column Raycasting
        const yBuffer = new Int32Array(this.width);
        yBuffer.fill(this.height);

        for (let z = 1; z < this.camera.distance; z += 1.5) {
            const pleftX = (-cosA * z - sinA * z) + this.camera.x;
            const pleftY = (sinA * z - cosA * z) + this.camera.y;
            const prightX = (cosA * z - sinA * z) + this.camera.x;
            const prightY = (-sinA * z - cosA * z) + this.camera.y;

            const dx = (prightX - pleftX) / this.width;
            const dy = (prightY - pleftY) / this.width;

            let rx = pleftX;
            let ry = pleftY;

            const invZ = 240.0 / z;

            for (let i = 0; i < this.width; i++) {
                const mapX = (Math.floor(rx) % this.mapWidth + this.mapWidth) % this.mapWidth;
                const mapY = (Math.floor(ry) % this.mapHeight + this.mapHeight) % this.mapHeight;
                const mapIdx = mapY * this.mapWidth + mapX;

                const heightOnScreen = Math.floor(
                    (this.camera.height - this.heightMap[mapIdx]) * invZ + this.camera.horizon
                );

                if (heightOnScreen < yBuffer[i]) {
                    const startY = Math.max(0, heightOnScreen);
                    const endY = yBuffer[i];
                    const color = this.colorMap[mapIdx];

                    for (let y = startY; y < endY; y++) {
                        buf[y * this.width + i] = color;
                    }
                    yBuffer[i] = heightOnScreen;
                }

                rx += dx;
                ry += dy;
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VoxelTerrainFlyover };
}

if (typeof window !== 'undefined') {
    window.VoxelTerrainFlyover = VoxelTerrainFlyover;
}
