/* Opt-in asset diagnostics. Nothing is installed without ?debug=assets. */
(function () {
  "use strict";
  const LIMIT = 32, MAX_ROWS = 200, TEXT_LIMIT = 524288;
  function publicUrl(value, base) {
    try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) ? `${url.origin}${url.pathname}`.slice(0, 2048) : `${url.protocol}[inline or unsupported]`; } catch { return "Invalid URL"; }
  }
  function classifyUrl(value, base, catalogBase) {
    try {
      const url = new URL(value, base), root = new URL(catalogBase);
      const label = publicUrl(url.href);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return { allowed: false, label, note: "Inline, unsupported or credential-bearing URL; not probed." };
      if (url.origin !== root.origin) return { allowed: false, label, note: "External resource: status/CORS not verified; no external request made." };
      if (!["games/", "assets/"].some(path => url.pathname.startsWith(new URL(path, root).pathname))) return { allowed: false, label, note: "Outside public game/asset paths; not probed." };
      return { allowed: true, url: url.href, label, note: /[^\x21-\x7e]|%(?![a-f\d]{2})/i.test(value) ? "Unencoded characters in source URL." : "" };
    } catch { return { allowed: false, label: "Invalid URL", note: "Could not parse this resource URL." }; }
  }
  function cssUrls(text) {
    const found = [];
    for (const match of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)|@import\s+['"]([^'"]+)['"]/gi)) {
      const value = (match[2] || match[3] || "").trim();
      if (value && !value.startsWith("#") && !value.startsWith("data:")) found.push({ value, kind: /^@import/i.test(match[0]) || /\.css(?:[?#]|$)/i.test(value) ? "style" : "asset" });
    }
    return found;
  }
  const api = { publicUrl, classifyUrl, cssUrls, limit: LIMIT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window === "undefined" || typeof document === "undefined" || new URL(window.location.href).searchParams.get("debug") !== "assets" || window.ArcadeAssetAuditor) return;
  const root = new URL("./", window.location.href), records = new Map();
  let activeGame = null, frame = null, frameCleanup = () => {}, modalObserver, auditController, dialog, button, renderFrame = null, generation = 0;
  const limitations = ["Developer mode only. URLs omit credentials, queries and fragments in this report.", "Preflight reads public same-origin game/assets only: at most 32 URLs, four requests at a time, CSS imports to depth two, 512 KiB text limit.", "External/CORS-opaque resources and unsupported browser timing fields are unknown, not reported as HTTP 404. Dynamic assets require actual gameplay observation."];
  function put(row) {
    const key = `${row.source}:${row.url}`;
    records.delete(key); records.set(key, row);
    if (records.size > MAX_ROWS) records.delete(records.keys().next().value);
    if (dialog?.open && renderFrame === null) renderFrame = requestAnimationFrame(() => { renderFrame = null; render(); });
  }
  function observe(target, source) {
    const base = target.location.href;
    const onError = event => {
      const element = event.target;
      if (!element || !/^(IMG|SCRIPT|LINK|AUDIO|VIDEO|SOURCE|IFRAME)$/.test(element.tagName)) return;
      const value = element.currentSrc || element.src || element.href;
      if (value) put({ source, url: publicUrl(value, base), status: "load failed", bytes: null, ms: null, note: "Browser resource error; HTTP status is not available." });
    };
    target.addEventListener("error", onError, true);
    let observer;
    try {
      observer = new target.PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const url = publicUrl(entry.name, base), previous = records.get(`${source}:${url}`);
          put({ source, url, status: previous?.status === "load failed" ? previous.status : entry.responseStatus > 0 ? `HTTP ${entry.responseStatus}` : "observed", bytes: entry.encodedBodySize > 0 ? entry.encodedBodySize : null, ms: Number.isFinite(entry.duration) ? Math.round(entry.duration * 10) / 10 : null, note: previous?.status === "load failed" ? previous.note : "Timing only; zero/opaque byte sizes are unknown or cached." });
        }
      });
      observer.observe({ type: "resource", buffered: true });
    } catch { /* Older browsers still have resource error capture and explicit preflight. */ }
    return () => { target.removeEventListener("error", onError, true); observer?.disconnect(); };
  }
  function attachFrame() {
    frameCleanup(); frameCleanup = () => {};
    frame = document.getElementById("game-iframe"); if (!frame) return;
    const current = frame; let stop = () => {};
    const loaded = () => {
      stop(); stop = () => {};
      if (current !== frame || !activeGame) return;
      try { if (current.contentWindow.location.origin !== window.location.origin) throw new Error("external"); stop = observe(current.contentWindow, "game runtime"); }
      catch { put({ source: "game runtime", url: publicUrl(activeGame.path, root), status: "unknown", bytes: null, ms: null, note: "Frame is cross-origin or sandbox-isolated; its resources cannot be inspected." }); }
    };
    current.addEventListener("load", loaded);
    frameCleanup = () => { current.removeEventListener("load", loaded); stop(); };
  }
  async function request(url, method, parent) {
    const controller = new AbortController(), abort = () => controller.abort();
    if (parent.aborted) controller.abort(); else parent.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 6000);
    const done = () => { clearTimeout(timeout); parent.removeEventListener("abort", abort); };
    try { return { response: await fetch(url, { method, mode: "same-origin", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal }), done }; }
    catch (error) { done(); throw error; }
  }
  async function textLimited(response, signal) {
    if (Number(response.headers.get("content-length")) > TEXT_LIMIT) { await response.body?.cancel(); throw new Error("Text exceeds the audit size limit."); }
    if (!response.body?.getReader) { const text = await response.text(); if (text.length > TEXT_LIMIT) throw new Error("Text exceeds the audit size limit."); return text; }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) { if (signal.aborted) throw new Error("Audit cancelled."); const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > TEXT_LIMIT) throw new Error("Text exceeds the audit size limit."); chunks.push(part.value); }
    } catch (error) { await reader.cancel(); throw error; }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder().decode(bytes);
  }
  function htmlUrls(text) {
    // Template contents remain inert: parsing must not execute scripts or load
    // images/fonts from the audited HTML, including external URLs.
    const template = document.createElement("template"); template.innerHTML = text;
    const doc = template.content, found = [];
    for (const element of doc.querySelectorAll("script[src],img[src],audio[src],video[src],source[src],link[rel~='stylesheet'][href],link[rel~='preload'][href],video[poster]")) {
      const kind = element.tagName === "SCRIPT" ? "script" : element.tagName === "LINK" && element.rel.includes("stylesheet") ? "style" : "asset";
      const value = element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("poster");
      if (value) found.push({ value, kind });
      if (element.hasAttribute("poster") && element.hasAttribute("src")) found.push({ value: element.getAttribute("poster"), kind: "asset" });
    }
    for (const element of doc.querySelectorAll("img[srcset],source[srcset]")) for (const part of element.getAttribute("srcset").split(",")) found.push({ value: part.trim().split(/\s+/)[0], kind: "asset" });
    for (const element of doc.querySelectorAll("style,[style]")) found.push(...cssUrls(element.tagName === "STYLE" ? element.textContent : element.getAttribute("style")));
    return found;
  }
  async function audit() {
    if (!activeGame) return;
    auditController?.abort(); const controller = new AbortController(); auditController = controller;
    const run = ++generation, game = { ...activeGame }; let limited = false, inspected = 0;
    for (const [key, row] of records) if (row.source === "preflight") records.delete(key);
    const queue = [], seen = new Set();
    const enqueue = (value, base, kind, depth) => {
      const candidate = classifyUrl(value, base, root);
      if (seen.has(candidate.label)) return;
      if (seen.size >= LIMIT) { limited = true; return; }
      seen.add(candidate.label);
      if (!candidate.allowed) put({ source: "preflight", url: candidate.label, status: "unknown", bytes: null, ms: null, note: candidate.note });
      else queue.push({ ...candidate, kind, depth });
    };
    enqueue(game.path, root, "document", 0);
    const status = dialog.querySelector("[data-audit-status]"); status.textContent = "Inspecting public game assets…";
    while (queue.length && !controller.signal.aborted && run === generation) {
      const batch = queue.splice(0, 4);
      await Promise.all(batch.map(async item => {
        const start = performance.now(); let connection;
        try {
          connection = await request(item.url, ["document", "style"].includes(item.kind) ? "GET" : "HEAD", controller.signal);
          let response = connection.response;
          if (response.status === 405) { await response.body?.cancel(); connection.done(); connection = await request(item.url, "GET", controller.signal); response = connection.response; }
          const contentType = response.headers.get("content-type") || "", length = Number(response.headers.get("content-length"));
          const row = { source: "preflight", url: item.label, status: `HTTP ${response.status}`, bytes: Number.isFinite(length) && length > 0 ? length : null, ms: Math.round((performance.now() - start) * 10) / 10, note: item.note };
          if (response.ok && ["document", "style"].includes(item.kind) && item.depth <= 2) {
            const text = await textLimited(response, controller.signal);
            if (item.kind === "document" && !/text\/html/i.test(contentType)) row.note += " Unexpected entry-point MIME type; content was not scanned.";
            else for (const link of item.kind === "document" ? htmlUrls(text) : cssUrls(text)) enqueue(link.value, item.url, link.kind, item.depth + 1);
          } else { await response.body?.cancel(); if (response.ok && /text\/html/i.test(contentType)) row.note += " HTML returned for an asset: check for a fallback route."; }
          if (run === generation && !controller.signal.aborted) put(row);
        } catch (error) {
          if (run === generation && !controller.signal.aborted) put({ source: "preflight", url: item.label, status: "unverified", bytes: null, ms: null, note: `Network, redirect, CORS or text-limit failure: ${error.message}` });
        } finally { connection?.done(); }
        inspected++;
      }));
      if (queue.length && !controller.signal.aborted) await new Promise(resolve => setTimeout(resolve, 400));
    }
    if (run !== generation) return;
    status.textContent = controller.signal.aborted ? "Audit cancelled. Captured observations are retained." : `Inspected ${inspected} same-origin URLs.${limited ? " The 32-URL budget was reached; report is partial." : ""} Dynamic assets still require gameplay observation.`;
    render();
  }
  function snapshot() { return { game: activeGame ? { id: activeGame.id, title: activeGame.title } : null, capturedAt: new Date().toISOString(), limitations, resources: Array.from(records.values()) }; }
  function render() {
    if (!dialog) return;
    const body = dialog.querySelector("tbody"); body.replaceChildren();
    for (const row of records.values()) {
      const tr = document.createElement("tr");
      for (const value of [row.source, row.url, row.status, row.bytes == null ? "unknown" : `${row.bytes} B`, row.ms == null ? "unknown" : `${row.ms} ms`, row.note]) { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); }
      body.appendChild(tr);
    }
    dialog.querySelector("[data-audit-count]").textContent = `${records.size} recent observations (limit ${MAX_ROWS})`;
  }
  function open() { if (!dialog) return; render(); dialog.showModal(); void audit(); }
  function mount() {
    const toolbar = document.querySelector("#game-modal .modal-controls"); if (!toolbar) return;
    const style = document.createElement("link"); style.rel = "stylesheet"; style.href = new URL("assets/css/dev-asset-auditor.css", root); document.head.appendChild(style);
    button = document.createElement("button"); button.type = "button"; button.className = "btn btn-sm asset-audit-launch"; button.textContent = "Audit Game Bundle"; button.disabled = true; toolbar.prepend(button); button.addEventListener("click", open);
    dialog = document.createElement("dialog"); dialog.className = "asset-audit-dialog"; dialog.setAttribute("aria-labelledby", "asset-audit-title");
    dialog.innerHTML = '<header><h2 id="asset-audit-title">Game asset integrity</h2><button type="button" data-close-audit>Close</button></header><p>Developer mode · public same-origin probes only. Unknown external/CORS status is not a 404.</p><p data-audit-status role="status" aria-live="polite"></p><div class="asset-audit-actions"><button type="button" data-rerun-audit>Audit again</button><button type="button" data-copy-audit>Copy bug report</button><span data-audit-count></span></div><div class="asset-audit-table"><table><caption>Recent resource timing, load errors and preflight results</caption><thead><tr><th>Source</th><th>Resource (query redacted)</th><th>Status</th><th>Payload</th><th>Duration</th><th>Notes</th></tr></thead><tbody></tbody></table></div><textarea hidden readonly aria-label="Copyable asset bug report"></textarea>';
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close-audit]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("keydown", event => event.stopPropagation());
    dialog.addEventListener("close", () => { auditController?.abort(); button.focus(); });
    dialog.querySelector("[data-rerun-audit]").addEventListener("click", () => void audit());
    dialog.querySelector("[data-copy-audit]").addEventListener("click", async () => {
      const text = JSON.stringify(snapshot(), null, 2), status = dialog.querySelector("[data-audit-status]");
      try { await navigator.clipboard.writeText(text); status.textContent = "Bug report copied. URL queries and fragments are redacted."; }
      catch { const field = dialog.querySelector("textarea"); field.value = text; field.hidden = false; field.focus(); field.select(); status.textContent = "Clipboard unavailable. Copy the selected report below."; }
    });
    modalObserver = new MutationObserver(() => {
      if (!document.getElementById("game-modal").classList.contains("active")) { activeGame = null; button.disabled = true; frameCleanup(); auditController?.abort(); generation++; if (dialog.open) dialog.close(); }
    });
    modalObserver.observe(document.getElementById("game-modal"), { attributes: true, attributeFilter: ["class"] });
  }
  let stopRoot = observe(window, "catalog runtime");
  window.addEventListener("arcadeverse:game-launched", event => {
    if (!event.detail || typeof event.detail.path !== "string") return;
    generation++; auditController?.abort();
    for (const [key, row] of records) if (row.source !== "catalog runtime") records.delete(key);
    activeGame = event.detail; if (button) button.disabled = false; attachFrame();
  });
  window.addEventListener("pagehide", () => { frameCleanup(); stopRoot(); auditController?.abort(); modalObserver?.disconnect(); if (renderFrame !== null) cancelAnimationFrame(renderFrame); renderFrame = null; });
  window.addEventListener("pageshow", event => { if (event.persisted) { stopRoot = observe(window, "catalog runtime"); if (modalObserver) modalObserver.observe(document.getElementById("game-modal"), { attributes: true, attributeFilter: ["class"] }); if (activeGame) attachFrame(); } });
  window.ArcadeAssetAuditor = { snapshot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
