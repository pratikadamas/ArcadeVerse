/**
 * Interactive 2D Navier-Stokes Incompressible Smoke & Dye Fluid Simulation
 * Based on Jos Stam's "Stable Fluids" technique (advection, diffusion, pressure projection)
 * Pure Vanilla JS, 2D Canvas ImageData, zero dependencies, zero emojis.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FluidSmokeCanvas = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  class FluidSolver2D {
    constructor(gridSize = 64, options = {}) {
      this.size = Math.max(16, Math.min(128, gridSize));
      this.N = this.size;
      this.numCells = (this.N + 2) * (this.N + 2);

      this.dt = options.dt || 0.1;
      this.diffusion = options.diffusion || 0.0001;
      this.viscosity = options.viscosity || 0.0001;
      this.velocityDissipation = options.velocityDissipation || 0.99;
      this.dyeDissipation = options.dyeDissipation || 0.985;
      this.vorticityStrength = options.vorticityStrength || 0.15;
      this.iterations = options.iterations || 16;

      // Velocity grids: u (horizontal), v (vertical)
      this.u = new Float32Array(this.numCells);
      this.v = new Float32Array(this.numCells);
      this.uPrev = new Float32Array(this.numCells);
      this.vPrev = new Float32Array(this.numCells);

      // Dye density channels (RGB)
      this.densityR = new Float32Array(this.numCells);
      this.densityG = new Float32Array(this.numCells);
      this.densityB = new Float32Array(this.numCells);
      this.prevR = new Float32Array(this.numCells);
      this.prevG = new Float32Array(this.numCells);
      this.prevB = new Float32Array(this.numCells);

      // Pressure and divergence
      this.p = new Float32Array(this.numCells);
      this.div = new Float32Array(this.numCells);
    }

    IX(x, y) {
      return x + (this.N + 2) * y;
    }

    addDensity(x, y, r, g, b, radius = 2) {
      const minX = Math.max(1, Math.floor(x - radius));
      const maxX = Math.min(this.N, Math.floor(x + radius));
      const minY = Math.max(1, Math.floor(y - radius));
      const maxY = Math.min(this.N, Math.floor(y + radius));

      for (let j = minY; j <= maxY; j++) {
        for (let i = minX; i <= maxX; i++) {
          const distSq = (i - x) * (i - x) + (j - y) * (j - y);
          if (distSq <= radius * radius) {
            const factor = Math.exp(-distSq / (radius * 1.5));
            const idx = this.IX(i, j);
            this.densityR[idx] = Math.min(5.0, this.densityR[idx] + r * factor);
            this.densityG[idx] = Math.min(5.0, this.densityG[idx] + g * factor);
            this.densityB[idx] = Math.min(5.0, this.densityB[idx] + b * factor);
          }
        }
      }
    }

    addVelocity(x, y, amountX, amountY, radius = 2) {
      const minX = Math.max(1, Math.floor(x - radius));
      const maxX = Math.min(this.N, Math.floor(x + radius));
      const minY = Math.max(1, Math.floor(y - radius));
      const maxY = Math.min(this.N, Math.floor(y + radius));

      for (let j = minY; j <= maxY; j++) {
        for (let i = minX; i <= maxX; i++) {
          const distSq = (i - x) * (i - x) + (j - y) * (j - y);
          if (distSq <= radius * radius) {
            const factor = Math.exp(-distSq / (radius * 1.5));
            const idx = this.IX(i, j);
            this.u[idx] += amountX * factor;
            this.v[idx] += amountY * factor;
          }
        }
      }
    }

    setBnd(b, x) {
      const N = this.N;
      for (let i = 1; i <= N; i++) {
        x[this.IX(0, i)] = b === 1 ? -x[this.IX(1, i)] : x[this.IX(1, i)];
        x[this.IX(N + 1, i)] = b === 1 ? -x[this.IX(N, i)] : x[this.IX(N, i)];
        x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
        x[this.IX(i, N + 1)] = b === 2 ? -x[this.IX(i, N)] : x[this.IX(i, N)];
      }

      x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
      x[this.IX(0, N + 1)] = 0.5 * (x[this.IX(1, N + 1)] + x[this.IX(0, N)]);
      x[this.IX(N + 1, 0)] = 0.5 * (x[this.IX(N, 0)] + x[this.IX(N + 1, 1)]);
      x[this.IX(N + 1, N + 1)] = 0.5 * (x[this.IX(N, N + 1)] + x[this.IX(N + 1, N)]);
    }

    linSolve(b, x, x0, a, c) {
      const cRecip = 1.0 / c;
      const N = this.N;
      for (let k = 0; k < this.iterations; k++) {
        for (let j = 1; j <= N; j++) {
          let row = j * (N + 2);
          for (let i = 1; i <= N; i++) {
            const idx = row + i;
            x[idx] = (x0[idx] + a * (x[idx - 1] + x[idx + 1] + x[idx - (N + 2)] + x[idx + (N + 2)])) * cRecip;
          }
        }
        this.setBnd(b, x);
      }
    }

    diffuse(b, x, x0, diff, dt) {
      const a = dt * diff * this.N * this.N;
      this.linSolve(b, x, x0, a, 1 + 4 * a);
    }

    advect(b, d, d0, velocX, velocY, dt, dissipation = 1.0) {
      const N = this.N;
      const dt0 = dt * N;

      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          const idx = this.IX(i, j);
          let x = i - dt0 * velocX[idx];
          let y = j - dt0 * velocY[idx];

          if (x < 0.5) x = 0.5;
          if (x > N + 0.5) x = N + 0.5;
          const i0 = Math.floor(x);
          const i1 = i0 + 1;

          if (y < 0.5) y = 0.5;
          if (y > N + 0.5) y = N + 0.5;
          const j0 = Math.floor(y);
          const j1 = j0 + 1;

          const s1 = x - i0;
          const s0 = 1.0 - s1;
          const t1 = y - j0;
          const t0 = 1.0 - t1;

          d[idx] = (s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
                    s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)])) * dissipation;
        }
      }
      this.setBnd(b, d);
    }

    project(velocX, velocY, p, div) {
      const N = this.N;
      const h = 1.0 / N;

      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          const idx = this.IX(i, j);
          div[idx] = -0.5 * h * (
            velocX[idx + 1] - velocX[idx - 1] +
            velocY[idx + (N + 2)] - velocY[idx - (N + 2)]
          );
          p[idx] = 0;
        }
      }
      this.setBnd(0, div);
      this.setBnd(0, p);

      this.linSolve(0, p, div, 1, 4);

      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          const idx = this.IX(i, j);
          velocX[idx] -= 0.5 * (p[idx + 1] - p[idx - 1]) / h;
          velocY[idx] -= 0.5 * (p[idx + (N + 2)] - p[idx - (N + 2)]) / h;
        }
      }
      this.setBnd(1, velocX);
      this.setBnd(2, velocY);
    }

    step() {
      // Diffuse velocity
      this.diffuse(1, this.uPrev, this.u, this.viscosity, this.dt);
      this.diffuse(2, this.vPrev, this.v, this.viscosity, this.dt);

      // Project pressure
      this.project(this.uPrev, this.vPrev, this.p, this.div);

      // Advect velocity
      this.advect(1, this.u, this.uPrev, this.uPrev, this.vPrev, this.dt, this.velocityDissipation);
      this.advect(2, this.v, this.vPrev, this.uPrev, this.vPrev, this.dt, this.velocityDissipation);

      // Project again
      this.project(this.u, this.v, this.p, this.div);

      // Advect dyes
      this.advect(0, this.prevR, this.densityR, this.u, this.v, this.dt, this.dyeDissipation);
      this.advect(0, this.prevG, this.densityG, this.u, this.v, this.dt, this.dyeDissipation);
      this.advect(0, this.prevB, this.densityB, this.u, this.v, this.dt, this.dyeDissipation);

      // Swap buffers
      const tempR = this.densityR; this.densityR = this.prevR; this.prevR = tempR;
      const tempG = this.densityG; this.densityG = this.prevG; this.prevG = tempG;
      const tempB = this.densityB; this.densityB = this.prevB; this.prevB = tempB;
    }

    renderToImageData(imageData, width, height) {
      const data = imageData.data;
      const N = this.N;
      const scaleX = N / width;
      const scaleY = N / height;

      for (let y = 0; y < height; y++) {
        const fy = Math.min(N, Math.max(1, Math.floor(y * scaleY) + 1));
        const rowOffset = y * width * 4;
        const gridRow = fy * (N + 2);

        for (let x = 0; x < width; x++) {
          const fx = Math.min(N, Math.max(1, Math.floor(x * scaleX) + 1));
          const idx = gridRow + fx;
          const pixelIndex = rowOffset + x * 4;

          const r = Math.min(255, Math.floor(this.densityR[idx] * 255));
          const g = Math.min(255, Math.floor(this.densityG[idx] * 255));
          const b = Math.min(255, Math.floor(this.densityB[idx] * 255));

          data[pixelIndex] = r;
          data[pixelIndex + 1] = g;
          data[pixelIndex + 2] = b;
          data[pixelIndex + 3] = 255;
        }
      }
    }

    clear() {
      this.u.fill(0);
      this.v.fill(0);
      this.uPrev.fill(0);
      this.vPrev.fill(0);
      this.densityR.fill(0);
      this.densityG.fill(0);
      this.densityB.fill(0);
      this.prevR.fill(0);
      this.prevG.fill(0);
      this.prevB.fill(0);
      this.p.fill(0);
      this.div.fill(0);
    }
  }

  function createStudio(container, options = {}) {
    if (!container) return null;

    const gridSize = options.gridSize || 64;
    const solver = new FluidSolver2D(gridSize, options);

    container.innerHTML = `
      <div class="fluid-sim-container">
        <div class="fluid-sim-header">
          <h2 class="fluid-sim-title">2D Navier-Stokes Smoke & Dye Fluid Simulation</h2>
          <span style="font-size:0.85rem;color:var(--fluid-muted);">Jos Stam Stable Fluids Solver</span>
        </div>
        <div class="fluid-sim-workspace">
          <div class="fluid-sim-canvas-wrap">
            <canvas class="fluid-sim-canvas" width="480" height="480"></canvas>
          </div>
          <div class="fluid-sim-controls">
            <div class="fluid-sim-group">
              <label class="fluid-sim-label">Color Palette Mode</label>
              <select class="fluid-sim-select" id="fluid-color-mode">
                <option value="rainbow">Rainbow Cycle</option>
                <option value="cyanViolet">Cyan & Violet Neon</option>
                <option value="fire">Fire & Smoke</option>
                <option value="plasma">Vibrant Plasma</option>
              </select>
            </div>
            <div class="fluid-sim-group">
              <label class="fluid-sim-label">Velocity Dissipation: <span id="fluid-val-vel">0.99</span></label>
              <input type="range" class="fluid-sim-range" id="fluid-inp-vel" min="0.90" max="0.999" step="0.001" value="${solver.velocityDissipation}" />
            </div>
            <div class="fluid-sim-group">
              <label class="fluid-sim-label">Dye Dissipation: <span id="fluid-val-dye">0.985</span></label>
              <input type="range" class="fluid-sim-range" id="fluid-inp-dye" min="0.90" max="0.999" step="0.001" value="${solver.dyeDissipation}" />
            </div>
            <div class="fluid-sim-group">
              <label class="fluid-sim-label">Viscosity: <span id="fluid-val-visc">0.0001</span></label>
              <input type="range" class="fluid-sim-range" id="fluid-inp-visc" min="0.00001" max="0.001" step="0.00005" value="${solver.viscosity}" />
            </div>
            <div class="fluid-sim-btn-row">
              <button class="fluid-sim-btn" id="fluid-btn-splat">Random Splat</button>
              <button class="fluid-sim-btn fluid-sim-btn-secondary" id="fluid-btn-clear">Clear</button>
            </div>
            <div class="fluid-sim-hint">
              Drag mouse or finger across the canvas to swirl turbulent fluid vortices and inject vibrant dye.
            </div>
          </div>
        </div>
      </div>
    `;

    const canvas = container.querySelector('.fluid-sim-canvas');
    const ctx = canvas.getContext('2d');
    let imageData = ctx.createImageData(canvas.width, canvas.height);

    const selectColor = container.querySelector('#fluid-color-mode');
    const inpVel = container.querySelector('#fluid-inp-vel');
    const valVel = container.querySelector('#fluid-val-vel');
    const inpDye = container.querySelector('#fluid-inp-dye');
    const valDye = container.querySelector('#fluid-val-dye');
    const inpVisc = container.querySelector('#fluid-inp-visc');
    const valVisc = container.querySelector('#fluid-val-visc');
    const btnSplat = container.querySelector('#fluid-btn-splat');
    const btnClear = container.querySelector('#fluid-btn-clear');

    inpVel.addEventListener('input', (e) => {
      solver.velocityDissipation = parseFloat(e.target.value);
      valVel.textContent = e.target.value;
    });

    inpDye.addEventListener('input', (e) => {
      solver.dyeDissipation = parseFloat(e.target.value);
      valDye.textContent = e.target.value;
    });

    inpVisc.addEventListener('input', (e) => {
      solver.viscosity = parseFloat(e.target.value);
      valVisc.textContent = e.target.value;
    });

    btnClear.addEventListener('click', () => solver.clear());

    let colorHue = 0;
    function getSplatColor() {
      const mode = selectColor.value;
      if (mode === 'rainbow') {
        colorHue = (colorHue + 25) % 360;
        const h = colorHue / 60;
        const c = 1.0;
        const x = c * (1 - Math.abs((h % 2) - 1));
        let r = 0, g = 0, b = 0;
        if (h < 1) { r = c; g = x; }
        else if (h < 2) { r = x; g = c; }
        else if (h < 3) { g = c; b = x; }
        else if (h < 4) { g = x; b = c; }
        else if (h < 5) { r = x; b = c; }
        else { r = c; b = x; }
        return { r, g, b };
      } else if (mode === 'cyanViolet') {
        return Math.random() > 0.5 ? { r: 0.1, g: 0.8, b: 0.95 } : { r: 0.65, g: 0.2, b: 0.95 };
      } else if (mode === 'fire') {
        return { r: 1.0, g: 0.4 + Math.random() * 0.3, b: 0.05 };
      } else {
        return { r: Math.random(), g: Math.random(), b: Math.random() };
      }
    }

    function addRandomSplat() {
      const gx = 10 + Math.random() * (solver.N - 20);
      const gy = 10 + Math.random() * (solver.N - 20);
      const col = getSplatColor();
      solver.addDensity(gx, gy, col.r * 2.5, col.g * 2.5, col.b * 2.5, 4);
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 15;
      solver.addVelocity(gx, gy, Math.cos(angle) * speed, Math.sin(angle) * speed, 4);
    }

    btnSplat.addEventListener('click', addRandomSplat);

    let isInteracting = false;
    let lastX = 0;
    let lastY = 0;

    function handlePointerDown(e) {
      isInteracting = true;
      const rect = canvas.getBoundingClientRect();
      lastX = (e.clientX - rect.left) * (solver.N / rect.width);
      lastY = (e.clientY - rect.top) * (solver.N / rect.height);
    }

    function handlePointerMove(e) {
      if (!isInteracting) return;
      const rect = canvas.getBoundingClientRect();
      const currX = (e.clientX - rect.left) * (solver.N / rect.width);
      const currY = (e.clientY - rect.top) * (solver.N / rect.height);

      const dx = currX - lastX;
      const dy = currY - lastY;
      const col = getSplatColor();

      solver.addDensity(currX, currY, col.r * 1.5, col.g * 1.5, col.b * 1.5, 3);
      solver.addVelocity(currX, currY, dx * 4, dy * 4, 3);

      lastX = currX;
      lastY = currY;
    }

    function handlePointerUp() {
      isInteracting = false;
    }

    canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) handlePointerDown(e.touches[0]);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) handlePointerMove(e.touches[0]);
    }, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    // Initial splashes
    for (let s = 0; s < 3; s++) addRandomSplat();

    let animId = null;
    function render() {
      solver.step();
      solver.renderToImageData(imageData, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return {
      solver,
      addRandomSplat,
      destroy: () => {
        if (animId) cancelAnimationFrame(animId);
      }
    };
  }

  return {
    FluidSolver2D,
    createStudio
  };
}));
