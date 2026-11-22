(function attach(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    const sdk = root.ArcadeVerse || (root.ArcadeVerse = {});
    sdk.physics = Object.assign(sdk.physics || {}, api);
  }
})(typeof window === 'undefined' ? null : window, function geometry() {
  'use strict';

  // Vertices and offsets are in canvas units. A sub-micropixel gap or overlap
  // at the supported coordinate scale is reported as boundary contact.
  const CONTACT_EPSILON = 1e-7;
  const MAX_COORDINATE = 1e7;
  const MAX_POINTS = 4096;
  const prepared = new WeakMap();

  function coordinate(value) {
    if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) {
      throw new RangeError('Coordinates must be finite numbers within ±10,000,000.');
    }
    return value === 0 ? 0 : value;
  }

  function cross(origin, a, b) {
    return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  }

  function convexHull(points) {
    if (!Array.isArray(points) || points.length > MAX_POINTS) {
      throw new TypeError('Pass an array of up to 4,096 points.');
    }
    const sorted = Array.from(points, point => {
      if (!point || typeof point !== 'object') throw new TypeError('Each point requires x and y.');
      return { x: coordinate(point.x), y: coordinate(point.y) };
    }).sort((a, b) => a.x - b.x || a.y - b.y);
    const unique = sorted.filter((p, i) => !i || p.x !== sorted[i - 1].x || p.y !== sorted[i - 1].y);
    if (unique.length < 3) return unique;

    function half(vertices) {
      const chain = [];
      for (const point of vertices) {
        while (chain.length > 1 && cross(chain.at(-2), chain.at(-1), point) <= 0) chain.pop();
        chain.push(point);
      }
      chain.pop();
      return chain;
    }
    return half(unique).concat(half(unique.slice().reverse()));
  }

  function projection(xs, ys, nx, ny) {
    let min = Infinity;
    let max = -Infinity;
    for (let vertex = 0; vertex < xs.length; vertex++) {
      const value = xs[vertex] * nx + ys[vertex] * ny;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    return [min, max];
  }

  // The hull is immutable and the projections stay private. Reuse this object
  // each frame for a translating body. Re-prepare if its orientation changes.
  function prepareConvexPolygon(points) {
    const vertices = Object.freeze(convexHull(points).map(p => Object.freeze(p)));
    const xs = Float64Array.from(vertices, p => p.x);
    const ys = Float64Array.from(vertices, p => p.y);
    const axes = [];
    if (vertices.length >= 3) {
      for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        const dx = xs[j] - xs[i];
        const dy = ys[j] - ys[i];
        const length = Math.hypot(dx, dy);
        let nx = -dy / length;
        let ny = dx / length;
        // Opposite parallel edges project on the same axis.
        if (nx < 0 || (nx === 0 && ny < 0)) { nx = -nx; ny = -ny; }
        if (axes.some(axis => axis.nx === nx && axis.ny === ny)) continue;
        const [min, max] = projection(xs, ys, nx, ny);
        axes.push({ nx, ny, min, max });
      }
    }
    const polygon = Object.freeze({ vertices });
    prepared.set(polygon, { xs, ys, axes });
    return polygon;
  }

  function minimumBoundingBox(polygon) {
    const data = geometryOf(polygon);
    if (!data.axes.length) return null;
    let best = null;
    for (const { nx, ny, min, max } of data.axes) {
      const ux = ny;
      const uy = -nx;
      const [left, right] = projection(data.xs, data.ys, ux, uy);
      const area = (right - left) * (max - min);
      if (best && best.area <= area) continue;
      const corner = (u, v) => ({ x: ux * u + nx * v, y: uy * u + ny * v });
      best = {
        area,
        width: right - left,
        height: max - min,
        corners: [corner(left, min), corner(right, min), corner(right, max), corner(left, max)],
      };
    }
    return best;
  }

  function geometryOf(polygon) {
    const value = prepared.get(polygon);
    if (!value) throw new TypeError('Use prepareConvexPolygon to prepare both shapes.');
    return value;
  }

  // Coordinates are relative to A: offset = worldPositionB - worldPositionA.
  // The contact normal and MTV both point in the direction B should move.
  // Optional out lets render loops reuse a result object without allocations.
  function collideConvexPolygons(a, b, offsetX = 0, offsetY = 0, out = {}) {
    const first = geometryOf(a);
    const second = geometryOf(b);
    coordinate(offsetX);
    coordinate(offsetY);
    out.intersects = false;
    out.touching = false;
    out.depth = 0;
    out.normalX = 0;
    out.normalY = 0;
    out.mtvX = 0;
    out.mtvY = 0;
    if (!first.axes.length || !second.axes.length) return out;

    let bestDepth = Infinity;
    let bestNx = 0;
    let bestNy = 0;
    for (let pass = 0; pass < 2; pass++) {
      const owner = pass === 0 ? first : second;
      const other = pass === 0 ? second : first;
      for (const axis of owner.axes) {
        const { nx, ny } = axis;
        let otherMin = Infinity;
        let otherMax = -Infinity;
        for (let i = 0; i < other.xs.length; i++) {
          const v = other.xs[i] * nx + other.ys[i] * ny;
          otherMin = Math.min(otherMin, v);
          otherMax = Math.max(otherMax, v);
        }
        const shift = nx * offsetX + ny * offsetY;
        const aMin = pass === 0 ? axis.min : otherMin;
        const aMax = pass === 0 ? axis.max : otherMax;
        const bMin = (pass === 0 ? otherMin : axis.min) + shift;
        const bMax = (pass === 0 ? otherMax : axis.max) + shift;
        // Either side is a valid exit. Interval intersection length is wrong
        // when one projection contains the other.
        const positive = aMax - bMin;
        const negative = bMax - aMin;
        const rawDepth = Math.min(positive, negative);
        if (rawDepth < -CONTACT_EPSILON) return out;
        if (rawDepth < bestDepth) {
          bestDepth = rawDepth;
          const sign = positive <= negative ? 1 : -1;
          bestNx = nx * sign;
          bestNy = ny * sign;
        }
      }
    }
    const depth = bestDepth <= CONTACT_EPSILON ? 0 : bestDepth;
    out.intersects = true;
    out.touching = depth === 0;
    out.depth = depth;
    out.normalX = bestNx || 0;
    out.normalY = bestNy || 0;
    out.mtvX = bestNx * depth || 0;
    out.mtvY = bestNy * depth || 0;
    return out;
  }

  return { convexHull, prepareConvexPolygon, minimumBoundingBox, collideConvexPolygons };
});
