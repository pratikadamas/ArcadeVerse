(function (root) {
  'use strict';
  function deflect(x, y, massX, massY, strength) {
    const dx = x - massX, dy = y - massY;
    const radiusSquared = Math.max(1, dx * dx + dy * dy);
    return [x - strength * dx / radiusSquared, y - strength * dy / radiusSquared];
  }
  function diskLight(x, y, radius, time) {
    const distance = Math.hypot(x, y * 3.5) / radius;
    if (distance < 1.3 || distance > 3.6) return 0;
    const angle = Math.atan2(y * 3.5, x);
    const spiral = 0.6 + 0.4 * Math.sin(angle * 4 - distance * 10 + time);
    const edge = Math.sin((distance - 1.3) / 2.3 * Math.PI);
    const beaming = 0.65 + 0.35 * x / Math.max(1, distance * radius);
    return Math.max(0, spiral * edge * beaming);
  }
  function starfield(width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    let seed = 1418;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let i = 0; i < data.length; i += 4) {
      const star = random() > 0.991 ? 120 + random() * 135 : 0;
      data[i] = 5 + star;
      data[i + 1] = 10 + star;
      data[i + 2] = 23 + star;
      data[i + 3] = 255;
    }
    return data;
  }
  class LensingRenderer {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.source = starfield(width, height);
      this.output = new Uint8ClampedArray(width * height * 4);
    }
    render(massX, massY, time) {
      const {width, height, source, output} = this;
      const radius = Math.min(width, height) * 0.11;
      const strength = radius * radius;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - massX, dy = y - massY;
          const squared = Math.max(1, dx * dx + dy * dy);
          const r = Math.sqrt(squared);
          const sourceX = Math.round(x - strength * dx / squared);
          const sourceY = Math.round(y - strength * dy / squared);
          const sx = Math.max(0, Math.min(width - 1, sourceX));
          const sy = Math.max(0, Math.min(height - 1, sourceY));
          const sample = (sy * width + sx) * 4;
          const index = (y * width + x) * 4;
          const light = diskLight(dx, dy, radius, time);
          const ring = Math.exp(-Math.abs(r - radius) * 1.5) * 85;
          const shadow = r < radius * 0.68;
          output[index] = shadow ? 0 : source[sample] + light * 230 + ring;
          output[index + 1] = shadow ? 0 : source[sample + 1] + light * 122 + ring * 0.8;
          output[index + 2] = shadow ? 0 : source[sample + 2] + light * 36 + ring * 0.5;
          output[index + 3] = 255;
        }
      }
      return output;
    }
  }
  const api = {deflect, diskLight, starfield, LensingRenderer};
  if (typeof module !== 'undefined') module.exports = api;
  root.ArcadeLensing = api;
  if (typeof document === 'undefined') return;
  const toggle = document.getElementById('lens-toggle');
  if (!toggle) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'lensing-starfield';
  canvas.setAttribute('aria-hidden','true');
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'lensing-mass';
  handle.setAttribute('aria-label', 'Move black hole. Drag or use arrow keys. Home centers it.');
  handle.title = 'Drag the black hole or use arrow keys';
  const instructions = document.createElement('p');
  instructions.className = 'lensing-instructions';
  instructions.textContent = 'Drag the ring to move the black hole. Arrow keys move it; Home centers it. This is an artistic model of gravitational deflection.';
  document.body.append(canvas, handle);
  (document.querySelector("main") || document.body).append(instructions);
  const paint = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, frame = 0, renderer, image;
  let x = 0.5, y = 0.5, dragging = null;
  const renderTimes = [];
  api.renderTimes = renderTimes;
  function place() {
    handle.style.left = (x * innerWidth) + 'px';
    handle.style.top = (y * innerHeight) + 'px';
  }
  function draw(time) {
    if (!active || document.hidden) return;
    const start = performance.now();
    renderer.render(x * renderer.width, y * renderer.height, reduced.matches ? 0 : time / 1000);
    paint.putImageData(image,0,0);
    renderTimes.push(performance.now() - start);
    if (renderTimes.length > 120) renderTimes.shift();
    if (!reduced.matches) frame = requestAnimationFrame(draw);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    if (active) frame = requestAnimationFrame(draw);
  }
  function resize() {
    if (!active) return;
    canvas.width = Math.min(320, Math.round(innerWidth / 3));
    canvas.height = Math.max(1, Math.round(canvas.width * innerHeight / innerWidth));
    renderer = new LensingRenderer(canvas.width, canvas.height);
    image = new ImageData(renderer.output, renderer.width, renderer.height);
    place();
    refresh();
  }
  function move(clientX, clientY) {
    x = Math.max(0.03, Math.min(0.97, clientX / innerWidth));
    y = Math.max(0.03, Math.min(0.97, clientY / innerHeight));
    place();
    if (reduced.matches) refresh();
  }
  toggle.addEventListener('click', () => {
    active = !active;
    toggle.setAttribute('aria-pressed', String(active));
    canvas.hidden = handle.hidden = instructions.hidden = !active;
    if (active) resize();
    else {
      cancelAnimationFrame(frame);
      renderer = image = null;
      canvas.width = canvas.height = 1;
      dragging = null;
    }
  });
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragging = event.pointerId;
    handle.setPointerCapture(dragging);
  });
  handle.addEventListener('pointermove', event => {
    if (event.pointerId === dragging) move(event.clientX, event.clientY);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    handle.addEventListener(type, () => { dragging = null; });
  }
  handle.addEventListener('keydown', event => {
    const delta = {ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
    if (event.key === 'Home') {
      event.preventDefault(); move(innerWidth / 2, innerHeight / 2);
    } else if (delta) {
      event.preventDefault(); move(x * innerWidth + delta[0], y * innerHeight + delta[1]);
    }
  });
  canvas.hidden = handle.hidden = instructions.hidden = true;
  root.addEventListener('resize',resize);
  reduced.addEventListener('change',refresh);
  document.addEventListener('visibilitychange',refresh);
  root.addEventListener('pagehide', () => cancelAnimationFrame(frame));
})(typeof window === 'undefined' ? globalThis : window);
