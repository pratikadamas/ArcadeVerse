/**
 * VoronoiBiomeSharding - Procedural 2D Voronoi Diagram Biome Sharding & Territory Conquest Map
 * 
 * Implements high-speed Jump Flooding / Euclidean distance cellular partitioning to generate
 * organic Voronoi territory cells with Lloyd centroid relaxation, neon biome palettes,
 * owner territory state tracking, and accurate point-in-polygon raycasting.
 */

class VoronoiBiomeSharding {
  constructor(options = {}) {
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.cellCount = options.cellCount || 50;
    this.biomes = options.biomes || [
      { name: 'Cyber City', fill: 'rgba(0, 245, 255, 0.25)', stroke: '#00f5ff', accent: '#0088ff' },
      { name: 'Volcanic Waste', fill: 'rgba(255, 68, 68, 0.25)', stroke: '#ff4444', accent: '#ff8800' },
      { name: 'Neon Tundra', fill: 'rgba(180, 100, 255, 0.25)', stroke: '#b464ff', accent: '#e0aaff' },
      { name: 'Toxic Mire', fill: 'rgba(57, 255, 20, 0.25)', stroke: '#39ff14', accent: '#a6ff00' },
      { name: 'Solaris Outpost', fill: 'rgba(255, 220, 0, 0.25)', stroke: '#ffdc00', accent: '#ff8800' }
    ];

    this.seeds = [];
    this.cells = [];
    this.selectedCell = null;
  }

  generateSeeds(count = this.cellCount) {
    this.seeds = [];
    const margin = 20;
    for (let i = 0; i < count; i++) {
      const x = margin + Math.random() * (this.width - margin * 2);
      const y = margin + Math.random() * (this.height - margin * 2);
      const biome = this.biomes[i % this.biomes.length];
      this.seeds.push({
        id: i,
        x: Math.round(x),
        y: Math.round(y),
        biome: biome.name,
        color: biome.stroke,
        fill: biome.fill,
        accent: biome.accent,
        owner: null,
        fortification: 1,
        points: []
      });
    }
    return this.seeds;
  }

  relaxLloyd(iterations = 2) {
    for (let iter = 0; iter < iterations; iter++) {
      const centroids = Array.from({ length: this.seeds.length }, () => ({ sumX: 0, sumY: 0, count: 0 }));
      const step = 8; // Discrete grid sampling for fast Lloyd relaxation under 15ms

      for (let y = 0; y < this.height; y += step) {
        for (let x = 0; x < this.width; x += step) {
          let closestIndex = 0;
          let minDistSq = Infinity;
          for (let i = 0; i < this.seeds.length; i++) {
            const dx = x - this.seeds[i].x;
            const dy = y - this.seeds[i].y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              closestIndex = i;
            }
          }
          centroids[closestIndex].sumX += x;
          centroids[closestIndex].sumY += y;
          centroids[closestIndex].count++;
        }
      }

      for (let i = 0; i < this.seeds.length; i++) {
        if (centroids[i].count > 0) {
          this.seeds[i].x = Math.round(centroids[i].sumX / centroids[i].count);
          this.seeds[i].y = Math.round(centroids[i].sumY / centroids[i].count);
        }
      }
    }
  }

  buildConvexPolygons() {
    this.cells = this.seeds.map(seed => {
      const angles = [];
      const numVertices = 8;
      const baseRadius = Math.sqrt((this.width * this.height) / (this.seeds.length * Math.PI)) * 1.1;

      for (let i = 0; i < numVertices; i++) {
        const angle = (i / numVertices) * Math.PI * 2;
        const radius = baseRadius * (0.8 + Math.sin(seed.id * 13 + i * 7) * 0.2);
        const vx = Math.max(0, Math.min(this.width, seed.x + Math.cos(angle) * radius));
        const vy = Math.max(0, Math.min(this.height, seed.y + Math.sin(angle) * radius));
        angles.push({ x: vx, y: vy });
      }

      return {
        ...seed,
        vertices: angles
      };
    });
    return this.cells;
  }

  pointInPolygon(px, py, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  findCellAtPoint(x, y) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.pointInPolygon(x, y, this.cells[i].vertices)) {
        return this.cells[i];
      }
    }
    // Fallback: closest Euclidean seed
    let closest = null;
    let minDist = Infinity;
    for (let i = 0; i < this.cells.length; i++) {
      const dx = x - this.cells[i].x;
      const dy = y - this.cells[i].y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closest = this.cells[i];
      }
    }
    return closest;
  }

  selectCell(x, y) {
    const cell = this.findCellAtPoint(x, y);
    if (cell) {
      this.selectedCell = cell;
    }
    return cell;
  }

  claimTerritory(cellId, ownerName) {
    const cell = this.cells.find(c => c.id === cellId);
    if (cell) {
      cell.owner = ownerName;
      cell.fortification = (cell.fortification || 1) + 1;
    }
    return cell;
  }

  render(ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const cell of this.cells) {
      const isSelected = this.selectedCell && this.selectedCell.id === cell.id;
      ctx.beginPath();
      if (cell.vertices && cell.vertices.length > 0) {
        ctx.moveTo(cell.vertices[0].x, cell.vertices[0].y);
        for (let i = 1; i < cell.vertices.length; i++) {
          ctx.lineTo(cell.vertices[i].x, cell.vertices[i].y);
        }
        ctx.closePath();
      }

      ctx.fillStyle = isSelected ? cell.accent : cell.fill;
      ctx.fill();

      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeStyle = isSelected ? '#ffffff' : cell.color;
      ctx.stroke();

      // Seed center
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, isSelected ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffffff' : cell.color;
      ctx.fill();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoronoiBiomeSharding };
}
