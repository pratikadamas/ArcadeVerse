/**
 * Software 3D Wireframe Polyhedron & Perspective Projection Canvas Engine (#1563)
 * Pure CPU 3D rotation matrix transformations, perspective divide x' = x * fov / (z + dist),
 * backface normal culling, and Painter's Algorithm z-sorting (strictly 2D Canvas API).
 */

class Software3DEngine {
    static MODELS = {
        cube: {
            vertices: [
                [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
            ],
            faces: [
                [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
                [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]
            ]
        },
        octahedron: {
            vertices: [
                [1, 0, 0], [-1, 0, 0], [0, 1, 0],
                [0, -1, 0], [0, 0, 1], [0, 0, -1]
            ],
            faces: [
                [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
                [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]
            ]
        }
    };

    constructor(width = 600, height = 400, options = {}) {
        this.width = width;
        this.height = height;
        this.fov = options.fov || 300;
        this.cameraDist = options.cameraDist || 3.5;
        this.rotX = 0;
        this.rotY = 0;
        this.rotZ = 0;

        this.modelName = options.model || 'cube';
        this.renderMode = options.renderMode || 'wireframe'; // 'wireframe', 'culled', 'flat'
    }

    rotateVertex(v, rx, ry, rz) {
        let [x, y, z] = v;

        // Rotate X
        const cosX = Math.cos(rx), sinX = Math.sin(rx);
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        // Rotate Y
        const cosY = Math.cos(ry), sinY = Math.sin(ry);
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;

        // Rotate Z
        const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
        const x3 = x2 * cosZ - y1 * sinZ;
        const y3 = x2 * sinZ + y1 * cosZ;

        return [x3, y3, z2];
    }

    project(v) {
        const [x, y, z] = v;
        const zEff = z + this.cameraDist;
        if (zEff <= 0.1) return null; // Behind camera clip

        const factor = this.fov / zEff;
        return {
            x: this.width / 2 + x * factor,
            y: this.height / 2 - y * factor,
            z: zEff
        };
    }

    computeNormal(v0, v1, v2) {
        const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
        const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];

        // Cross product
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        return [nx / len, ny / len, nz / len];
    }

    isBackfaceCulled(v0, v1, v2) {
        const norm = this.computeNormal(v0, v1, v2);
        // Camera looks along +Z axis towards origin
        return norm[2] <= 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Software3DEngine };
}
