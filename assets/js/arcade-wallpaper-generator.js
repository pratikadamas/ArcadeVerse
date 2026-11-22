/* Registry card artwork composed locally into a lossless PNG. */
(function () {
  'use strict';
  const presets = { desktop: [1920, 1080], uhd: [3840, 2160], phone: [1080, 1920] };
  const palettes = { synthwave: ['#22d3ee', '#f472b6'], matrix: ['#4ade80', '#a3e635'], amber: ['#fbbf24', '#fb923c'] };
  function settings(input) {
    if (!input || !Object.hasOwn(presets, input.size) || !Object.hasOwn(palettes, input.tint) || !Number.isInteger(input.scanlines) || input.scanlines < 0 || input.scanlines > 100 || typeof input.logo !== 'boolean') throw Error('Choose a supported size, tint and scanline intensity.');
    return { size: input.size, tint: input.tint, scanlines: input.scanlines, logo: input.logo };
  }
  function selectGames(registry, random = Math.random) {
    if (!Array.isArray(registry)) throw Error('The game catalog could not be read. Reload and try again.');
    const unique = new Map();
    for (const game of registry) {
      if (!game || typeof game.id !== 'string' || !game.id.trim() || game.id.length > 128 || typeof game.title !== 'string' || !game.title.trim() || game.title.length > 500) continue;
      if (!unique.has(game.id)) unique.set(game.id, { id: game.id, title: game.title, category: typeof game.category === 'string' ? game.category.slice(0, 80) : 'Arcade', lucideIcon: /^[a-z0-9-]{1,64}$/.test(game.lucideIcon || '') ? game.lucideIcon : 'gamepad-2' });
    }
    const games = [...unique.values()];
    if (games.length < 24) throw Error('At least 24 distinct games are needed for a wallpaper.');
    for (let i = games.length - 1; i > 0; i--) {
      const value = random(); if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('The random mix could not be created. Try again.');
      const j = Math.floor(value * (i + 1)); [games[i], games[j]] = [games[j], games[i]];
    }
    return games.slice(0, 24);
  }
  function layout(size) {
    if (!Object.hasOwn(presets, size)) throw Error('Unsupported wallpaper size.');
    const [width, height] = presets[size], unit = width / (size === 'phone' ? 1080 : 1920), columns = size === 'phone' ? 3 : 6;
    const gap = 12 * unit, margin = 24 * unit, top = 84 * unit, bottom = 42 * unit, rows = 24 / columns;
    const w = (width - 2 * margin - (columns - 1) * gap) / columns, h = (height - top - bottom - (rows - 1) * gap) / rows;
    return { width, height, unit, cells: Array.from({ length: 24 }, (_, i) => ({ x: margin + (i % columns) * (w + gap), y: top + Math.floor(i / columns) * (h + gap), w, h })) };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { presets, settings, selectGames, layout };
  if (typeof document === 'undefined') return;
  const host = document.querySelector('[data-wallpaper-studio]'); if (!host) return;
  const form = host.querySelector('form'), status = host.querySelector('[data-wallpaper-status]'), preview = host.querySelector('[data-wallpaper-preview]');
  const download = host.querySelector('[data-wallpaper-download]'), cancel = host.querySelector('[data-wallpaper-cancel]'), progress = host.querySelector('progress');
  const list = host.querySelector('[data-wallpaper-games]'), caption = host.querySelector('[data-wallpaper-caption]');
  let serial = 0, timer, selected, ready, busy = false, encoding = null;
  const urls = new Map(), yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
  function controls() { download.disabled = !ready || busy || encoding === serial; cancel.disabled = !busy && encoding !== serial; host.setAttribute('aria-busy', String(busy || encoding === serial)); }
  function say(message) { status.textContent = message; }
  function inputSettings() { const data = new FormData(form); return settings({ size: data.get('size'), tint: data.get('tint'), scanlines: Number(data.get('scanlines')), logo: data.has('logo') }); }
  function loadImage(url) {
    return new Promise(resolve => {
      const image = new Image(), timeout = setTimeout(() => finish(null), 2000);
      function finish(value) { clearTimeout(timeout); image.onload = image.onerror = null; if (!value) image.src = ''; resolve(value); }
      image.onload = () => finish(image); image.onerror = () => finish(null); image.src = url;
    });
  }
  async function icon(game, color) {
    if (!window.lucide?.createIcons) return null;
    try {
      const root = document.createElement('div'), node = document.createElement('i'); node.setAttribute('data-lucide', game.lucideIcon); root.appendChild(node);
      window.lucide.createIcons({ root, attrs: { width: '80', height: '80', stroke: color, 'stroke-width': '1.5' } });
      const svg = root.querySelector('svg');
      return svg ? await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`) : null;
    } catch { return null; }
  }
  function fitText(ctx, text, width, maxLines) {
    let line = '', lines = [];
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    const clipped = lines.length > maxLines; lines = lines.slice(0, maxLines);
    return lines.map((value, i) => {
      let result = value; const suffix = clipped && i === maxLines - 1 ? '…' : '';
      while (result && ctx.measureText(result + suffix).width > width) result = result.slice(0, -1);
      return result + suffix;
    });
  }
  function card(ctx, game, cell, image, colors, unit, index) {
    const { x, y, w, h } = cell, color = colors[index % 2];
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const shade = ctx.createLinearGradient(x, y, x + w, y + h); shade.addColorStop(0, '#101b2c'); shade.addColorStop(1, '#070b14'); ctx.fillStyle = shade; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color; ctx.globalAlpha = .13; ctx.lineWidth = unit;
    let seed = [...game.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
    for (let i = 0; i < 12; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const px = x + (seed % 1000) / 1000 * w; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; ctx.strokeRect(px, y + (seed % 1000) / 1000 * h, 24 * unit, 24 * unit); }
    ctx.globalAlpha = 1; ctx.strokeRect(x + unit, y + unit, w - 2 * unit, h - 2 * unit);
    const side = Math.min(76 * unit, h * .34), cx = x + w / 2, cy = y + h * .37;
    if (image) ctx.drawImage(image, cx - side / 2, cy - side / 2, side, side);
    else { ctx.strokeStyle = color; ctx.lineWidth = 3 * unit; ctx.strokeRect(cx - side / 2, cy - side / 3, side, side * .66); ctx.beginPath(); ctx.moveTo(cx - side * .32, cy); ctx.lineTo(cx - side * .08, cy); ctx.moveTo(cx - side * .2, cy - side * .12); ctx.lineTo(cx - side * .2, cy + side * .12); ctx.stroke(); ctx.fillStyle = color; ctx.fillRect(cx + side * .15, cy - 2 * unit, 5 * unit, 5 * unit); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `bold ${18 * unit}px monospace`; ctx.fillStyle = '#f8fafc';
    fitText(ctx, game.title, w - 24 * unit, 2).forEach((line, n) => ctx.fillText(line, cx, y + h * .64 + n * 23 * unit));
    ctx.fillStyle = color; ctx.font = `${11 * unit}px monospace`; ctx.fillText(fitText(ctx, game.category.toUpperCase(), w - 24 * unit, 1)[0] || 'ARCADE', cx, y + h - 22 * unit); ctx.restore();
  }
  function overlay(ctx, shape, config, logo) {
    const { width: w, height: h, unit } = shape, colors = palettes[config.tint];
    ctx.fillStyle = `rgba(0,0,0,${config.scanlines / 100 * .55})`;
    for (let y = 0; y < h; y += 4 * unit) ctx.fillRect(0, y, w, unit);
    if (config.logo) {
      const box = 184 * unit, x = (w - box) / 2, y = (h - box) / 2;
      ctx.save(); ctx.shadowColor = colors[0]; ctx.shadowBlur = 22 * unit; ctx.fillStyle = '#080d1ef2'; ctx.fillRect(x, y, box, box); ctx.strokeStyle = colors[0]; ctx.lineWidth = 2 * unit; ctx.strokeRect(x, y, box, box); ctx.shadowBlur = 0;
      if (logo) ctx.drawImage(logo, x + 42 * unit, y + 20 * unit, 100 * unit, 100 * unit);
      else { ctx.fillStyle = colors[0]; ctx.textAlign = 'center'; ctx.font = `bold ${45 * unit}px monospace`; ctx.fillText('AV', w / 2, y + 79 * unit); }
      ctx.fillStyle = '#f8fafc'; ctx.font = `bold ${19 * unit}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('ARCADEVERSE', w / 2, y + 137 * unit); ctx.restore();
    }
  }
  async function generate(token, config, games) {
    const shape = layout(config.size), canvas = document.createElement('canvas'); canvas.width = shape.width; canvas.height = shape.height;
    try {
      const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas drawing is unavailable in this browser.');
      const colors = palettes[config.tint]; ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, shape.width, shape.height);
      ctx.fillStyle = colors[0]; ctx.font = `bold ${26 * shape.unit}px monospace`; ctx.textBaseline = 'top'; ctx.fillText('ARCADEVERSE / COMMUNITY ARCADE', 24 * shape.unit, 24 * shape.unit);
      let fallback = 0;
      for (let i = 0; i < games.length; i++) {
        if (token !== serial) return;
        const art = await icon(games[i], colors[i % 2]); if (token !== serial) return;
        if (!art) fallback++; card(ctx, games[i], shape.cells[i], art, colors, shape.unit, i);
        progress.value = i + 1; if (i % 2 === 1) await yieldTask();
      }
      const logo = config.logo ? await loadImage(new URL('assets/public/brand-logo.webp', document.baseURI).href) : null; if (token !== serial) return;
      overlay(ctx, shape, config, logo);
      ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = `${12 * shape.unit}px monospace`; ctx.fillText('24 GAMES / ONE COMMUNITY / PLAY AT ARCADEVERSE', shape.width / 2, shape.height - 12 * shape.unit);
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `ArcadeVerse wallpaper, 24 distinct game cards, ${shape.width} by ${shape.height}, ${config.tint} tint.`);
      if (ready) { ready.canvas.width = 0; ready.canvas.height = 0; }
      ready = { canvas, config, games }; preview.replaceChildren(canvas); busy = false; controls();
      caption.textContent = `${shape.width} × ${shape.height} · ${config.tint} · scanlines ${config.scanlines}% · center logo ${config.logo ? 'on' : 'off'}`;
      list.replaceChildren(...games.map(game => { const li = document.createElement('li'); li.textContent = game.title; li.dataset.gameId = game.id; return li; }));
      say(`Ready: 24 distinct game cards. ${fallback ? 'Catalog icons were unavailable for some cards; local controller artwork is used. ' : ''}${config.logo && !logo ? 'The brand image was unavailable; an AV lettering watermark is used. ' : ''}Download the lossless PNG below.`);
    } catch (error) { if (token === serial) { busy = false; controls(); say(`Generation failed. ${error.message} Try Generate new mix again.`); } }
    finally { if (canvas !== ready?.canvas) { canvas.width = 0; canvas.height = 0; } }
  }
  function request(shuffle) {
    const token = ++serial; clearTimeout(timer); busy = false; encoding = null;
    try {
      const config = inputSettings(); if (shuffle || !selected) selected = selectGames(window.GAMES_REGISTRY);
      const games = selected; busy = true; progress.value = 0; controls(); say('Composing 24 game cards… You can cancel or change the style.');
      timer = setTimeout(() => void generate(token, config, games), 100);
    } catch (error) { controls(); say(error.message); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); request(true); });
  form.addEventListener('input', () => { host.querySelector('output').textContent = `${form.elements.scanlines.value}%`; if (selected) request(false); });
  cancel.addEventListener('click', () => { serial++; clearTimeout(timer); busy = false; encoding = null; selected = ready?.games; controls(); say(ready ? 'Cancelled. The last completed wallpaper remains available to download.' : 'Cancelled. Choose Generate new mix to start again.'); cancel.disabled = true; form.querySelector('[type="submit"]').focus(); });
  download.addEventListener('click', () => {
    if (!ready || busy || encoding === serial) return;
    const token = serial, image = ready; encoding = token; controls(); say('Encoding lossless PNG…');
    function failed() { if (token !== serial) return; encoding = null; controls(); say('PNG export failed. Your completed wallpaper is preserved; choose Download PNG to retry.'); download.focus(); }
    try {
      image.canvas.toBlob(blob => {
        if (token !== serial) return;
        if (!blob || blob.type !== 'image/png' || !blob.size) { failed(); return; }
        let url, a;
        try {
          url = URL.createObjectURL(blob); a = document.createElement('a'); a.href = url; a.download = `arcadeverse-${presets[image.config.size].join('x')}-${image.config.tint}.png`;
          document.body.appendChild(a); a.click(); a.remove(); urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 1000)); encoding = null; controls(); say('PNG download requested. Check your browser downloads.'); download.focus();
        } catch { a?.remove(); if (url) URL.revokeObjectURL(url); failed(); }
      }, 'image/png');
    } catch { failed(); }
  });
  window.addEventListener('pagehide', () => { serial++; clearTimeout(timer); busy = false; encoding = null; selected = ready?.games; for (const [url, timeout] of urls) { clearTimeout(timeout); URL.revokeObjectURL(url); } urls.clear(); controls(); });
  controls();
})();
