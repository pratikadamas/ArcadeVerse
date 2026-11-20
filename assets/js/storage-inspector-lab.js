/* Opt-in, bounded local diagnostics. No storage is read without ?debug=storage. */
(function () {
  "use strict";
  const PREFIX = "arcadeverse_", MAX_KEYS = 256, MAX_VALUE = 32768, MAX_TOTAL = 262144, MAX_SCAN = 10000;
  const JSON_KEYS = new Set(["arcadeverse_favorite_games", "arcadeverse_play_counts", "arcadeverse_recently_played", "arcadeverse_recently_played_v2", "arcadeverse_user_playlists", "arcadeverse_game_ratings", "arcadeverse_daily_quest", "arcadeverse_a11y_prefs"]);
  function inspect(key, raw) {
    try { return { kind: "JSON syntax valid", value: JSON.parse(raw), malformed: false }; }
    catch { return JSON_KEYS.has(key) ? { kind: "Malformed JSON", value: raw, malformed: true } : { kind: "Plain text / format not assumed", value: raw, malformed: false }; }
  }
  function capture(storage) {
    try {
      const length = storage.length, keys = []; let total = 0, complete = length <= MAX_SCAN;
      for (let i = 0; i < Math.min(length, MAX_SCAN); i++) { const key = storage.key(i); if (typeof key === "string" && key.startsWith(PREFIX)) { if (key.length > 512) complete = false; else keys.push(key); } }
      const unique = [...new Set(keys)].sort(); if (unique.length > MAX_KEYS) complete = false;
      const rows = [];
      for (const key of unique.slice(0, MAX_KEYS)) {
        const raw = storage.getItem(key); if (raw === null) continue;
        if (typeof raw !== "string") throw new Error("Storage returned a non-text value.");
        if (raw.length > MAX_VALUE || total + raw.length > MAX_TOTAL) { complete = false; rows.push(Object.freeze({ key, raw: null, kind: "Value exceeds inspection limit", malformed: false })); continue; }
        total += raw.length; rows.push(Object.freeze({ key, raw, ...inspect(key, raw) }));
      }
      return { ok: true, complete, rows: Object.freeze(rows), message: complete ? "" : "Partial view: at most 10,000 keys scanned, 256 matching keys, 512 characters per key, 32K per value and 256K retained characters total. Snapshots/diffs require a complete read." };
    } catch (error) { return { ok: false, complete: false, rows: [], message: `Storage could not be read. Previous snapshots are unchanged. ${error.message}` }; }
  }
  const pointer = value => String(value).replaceAll("~", "~0").replaceAll("/", "~1");
  function changedPaths(before, after) {
    const pending = [[before, after, "", 0]], paths = []; let visited = 0, limited = false;
    while (pending.length && paths.length < 60 && visited++ < 500) {
      const [left, right, path, depth] = pending.pop(); if (Object.is(left, right)) continue;
      if (depth >= 8 || !left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) { paths.push(path || "/"); if (depth >= 8 && left && right && typeof left === "object" && typeof right === "object") limited = true; continue; }
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().reverse();
      for (const key of keys) {
        const next = `${path}/${pointer(key)}`;
        if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) paths.push(next);
        else pending.push([left[key], right[key], next, depth + 1]);
        if (paths.length >= 60) { limited = true; break; }
      }
    }
    return { paths, limited: limited || pending.length > 0 };
  }
  function diff(before, after) {
    if (!before?.ok || !after?.ok || !before.complete || !after.complete) throw new Error("A complete before and after snapshot is required; no deletions are inferred from a partial read.");
    const old = new Map(before.rows.map(row => [row.key, row])), next = new Map(after.rows.map(row => [row.key, row])), changes = [];
    for (const key of [...new Set([...old.keys(), ...next.keys()])].sort()) {
      if (!old.has(key)) changes.push({ key, kind: "created", paths: ["/"] });
      else if (!next.has(key)) changes.push({ key, kind: "deleted", paths: ["/"] });
      else if (old.get(key).raw !== next.get(key).raw) { const paths = changedPaths(old.get(key).value, next.get(key).value); changes.push({ key, kind: "modified", paths: paths.paths.length ? paths.paths : [paths.limited ? "/ (detail limit; compare raw text)" : "/ (text or formatting)"], limited: paths.limited }); }
    }
    return changes;
  }
  function resetMalformed(storage, key, expected) {
    try {
      if (!key.startsWith(PREFIX) || typeof expected !== "string" || !inspect(key, expected).malformed) throw new Error("Only a known malformed JSON key can be reset.");
      if (storage.getItem(key) !== expected) throw new Error("This key changed since inspection. Refresh and inspect it again; nothing was removed.");
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error("The key changed again; reset success is not assumed.");
      return { ok: true };
    } catch (error) { return { ok: false, message: error.message }; }
  }
  const core = { capture, diff, changedPaths, inspect, resetMalformed };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (typeof window === "undefined" || typeof document === "undefined" || new URL(window.location.href).searchParams.get("debug") !== "storage" || window.ArcadeStorageInspector) return;
  const root = new URL("../../", document.currentScript.src);
  let dialog, launch, timer, before = null, enabled = true, lastView = "", lastError = "", actionMessage = "", changes = null, storageRevision = 0;
  function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function read() { try { return capture(window.localStorage); } catch (error) { return { ok: false, complete: false, message: error.message }; } }
  function notice(message) { if (message === lastError) return; lastError = message; dialog.querySelector("[data-notice]").textContent = message; }
  function stop() { clearInterval(timer); timer = null; }
  function poll() { stop(); if (enabled && dialog.open && !document.hidden) timer = setInterval(refresh, 500); }
  function tree(value, label, path, depth, budget, openPaths) {
    if (--budget.remaining < 0) return element("p", "Further values omitted from this bounded tree.");
    if (value === null || typeof value !== "object") return element("p", `${label}: ${JSON.stringify(value)}`, "storage-lab-value");
    const details = element("details"), keys = Object.keys(value); details.dataset.path = path;
    details.appendChild(element("summary", `${label} · ${Array.isArray(value) ? "array" : "object"} (${keys.length})`));
    let built = false;
    const expand = () => {
      if (!details.open || built) return; built = true;
      const body = element("div", undefined, "storage-lab-children");
      if (depth >= 8) body.appendChild(element("p", "Deeper values omitted at depth 8."));
      else for (const key of keys) { if (budget.remaining <= 0) { body.appendChild(element("p", "Further values omitted (200-node view limit).")); break; } body.appendChild(tree(value[key], key, `${path}/${pointer(key)}`, depth + 1, budget, openPaths)); }
      details.appendChild(body);
    };
    details.addEventListener("toggle", expand); if (openPaths.has(path)) { details.open = true; expand(); } return details;
  }
  function refresh(force = false) {
    const result = read(); notice(result.message || actionMessage); if (!result.ok) return;
    const query = dialog.querySelector("input[type=search]").value.toLowerCase(), signature = JSON.stringify([query, result.rows.map(row => [row.key, row.raw])]);
    if (!force && signature === lastView) return; lastView = signature;
    const host = dialog.querySelector("[data-tree]"), openPaths = new Set([...host.querySelectorAll("details[open]")].map(node => node.dataset.path)); host.replaceChildren();
    const rows = result.rows.filter(row => `${row.key}\n${row.raw || ""}`.toLowerCase().includes(query));
    dialog.querySelector("[data-count]").textContent = `${rows.length} matching keys · ${result.complete ? "complete" : "partial"} read · refreshed while open`;
    for (const row of rows) {
      const section = element("section", undefined, "storage-lab-key"), heading = element("h3", row.key); section.appendChild(heading);
      section.appendChild(element("p", row.kind, row.malformed ? "storage-lab-invalid" : "storage-lab-kind"));
      section.appendChild(row.raw === null ? element("p", "Value was not parsed or retained.") : tree(row.value, "Value", row.key, 0, { remaining: 200 }, openPaths));
      if (row.raw !== null) { const raw = element("details"); raw.appendChild(element("summary", "Raw stored text")); raw.appendChild(element("pre", row.raw, "storage-lab-value")); section.appendChild(raw); }
      if (row.malformed) {
        const button = element("button", `Reset ${row.key}`); button.type = "button";
        button.addEventListener("click", async () => {
          const revision = storageRevision;
          if (!window.confirm(`Remove only ${row.key}? Its consumer will use defaults after reload. This cannot reconstruct the original value. Close other tabs first; concurrent writers can race this check.`)) return;
          button.disabled = true;
          // Native confirm blocks storage-event delivery. Yield before checking
          // the value so writes made during the prompt are not read from stale cache.
          await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
          if (!enabled || !dialog.open) return;
          let result;
          if (revision !== storageRevision) result = { ok: false, message: "Storage changed since inspection while confirming. Refresh and inspect again; nothing was removed." };
          else try { result = resetMalformed(window.localStorage, row.key, row.raw); } catch (error) { result = { ok: false, message: error.message }; }
          actionMessage = result.ok ? `Removed only ${row.key}. Reload its consumer to use defaults.` : result.message;
          refresh(true); if (!result.ok) dialog.querySelector("[data-notice]").focus();
        }); section.appendChild(button);
      }
      host.appendChild(section);
    }
    if (!rows.length) host.appendChild(element("p", "No matching arcadeverse_* keys."));
  }
  function show() { enabled = true; launch.textContent = "Storage lab"; if (!dialog.open) dialog.showModal(); refresh(true); poll(); }
  function snapshot() {
    const result = read(); if (!result.ok || !result.complete) { actionMessage = result.message; notice(actionMessage); return; }
    before = result; changes = null; renderDiff(); actionMessage = "Before-game snapshot captured in memory. Close this drawer, play a game, then close the game to compare."; notice(actionMessage);
  }
  function renderDiff() {
    const host = dialog.querySelector("[data-diff]"); host.replaceChildren();
    if (changes === null) { host.appendChild(element("p", before ? "Waiting for the game modal to close." : "Take a complete snapshot before launching a game.")); return; }
    host.appendChild(element("p", `${changes.length} changed keys since your snapshot. Nested paths are a bounded detail view.`));
    for (const row of changes) { const item = element("div", undefined, `storage-lab-change storage-lab-${row.kind}`); item.appendChild(element("strong", `${row.kind.toUpperCase()} ${row.key}`)); item.appendChild(element("p", `${row.paths.join(", ")}${row.limited ? " · further paths omitted" : ""}`)); host.appendChild(item); }
  }
  function mount() {
    const style = element("link"); style.rel = "stylesheet"; style.href = new URL("assets/css/storage-inspector-lab.css", root); document.head.appendChild(style);
    launch = element("button", "Storage lab", "storage-lab-launch"); launch.type = "button"; launch.setAttribute("aria-haspopup", "dialog"); document.body.appendChild(launch);
    dialog = element("dialog", undefined, "storage-lab-dialog"); dialog.setAttribute("aria-labelledby", "storage-lab-title");
    dialog.innerHTML = '<header><div><p>DEVELOPER MODE · LOCAL ONLY</p><h2 id="storage-lab-title">Storage inspector</h2></div><button type="button" data-close>Close</button></header><p>Only arcadeverse_* keys. Plain settings are preserved; JSON syntax checks are not full schema validation. Snapshots are in memory and reads across tabs are best effort.</p><div class="storage-lab-actions"><button type="button" data-snapshot>Take before-game snapshot</button><button type="button" data-refresh>Refresh values</button><button type="button" data-disable>End developer session</button></div><p data-notice role="alert" tabindex="-1"></p><label>Search keys and values<input type="search" autocomplete="off"></label><p data-count role="status"></p><h3>Gameplay changes</h3><div data-diff aria-live="polite"></div><h3>Live storage tree</h3><div data-tree></div>';
    document.body.appendChild(dialog); launch.addEventListener("click", show);
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-refresh]").addEventListener("click", () => { actionMessage = ""; refresh(true); });
    dialog.querySelector("[data-snapshot]").addEventListener("click", snapshot);
    dialog.querySelector("[data-disable]").addEventListener("click", () => { enabled = false; before = null; changes = null; lastView = ""; actionMessage = ""; notice(""); dialog.querySelector("input").value = ""; dialog.querySelector("[data-tree]").replaceChildren(); renderDiff(); dialog.close(); launch.textContent = "Enable storage lab"; });
    dialog.querySelector("input").addEventListener("input", () => refresh());
    dialog.addEventListener("keydown", event => event.stopPropagation());
    dialog.addEventListener("close", () => { stop(); launch.focus(); });
    window.addEventListener("storage", event => { if (event.key === null || event.key.startsWith(PREFIX)) { storageRevision++; if (dialog.open) refresh(); } });
    window.addEventListener("arcadeverse:game-closed", () => {
      if (!enabled || !before) return;
      const after = read(); if (!after.ok || !after.complete) { notice(after.message); return; }
      changes = diff(before, after); renderDiff(); queueMicrotask(show);
    });
    window.addEventListener("pagehide", stop); window.addEventListener("pageshow", poll); document.addEventListener("visibilitychange", poll);
    renderDiff();
  }
  window.ArcadeStorageInspector = core;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
