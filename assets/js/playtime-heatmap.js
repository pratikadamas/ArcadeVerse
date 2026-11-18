/* Local play activity, shared by the catalog and Hall of Fame. No network calls. */
(function () {
  "use strict";
  const KEY = "av_activity_matrix", MAX_DAYS = 370, MAX_GAMES = 64, MAX_RAW = 2000000;
  const empty = () => ({ version: 1, days: [] });
  const dayKey = date => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Invalid activity date.");
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  function dateOf(key) {
    if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error("Invalid stored activity date.");
    const [y, m, d] = key.split("-").map(Number), date = new Date(y, m - 1, d, 12);
    if (y < 1000 || dayKey(date) !== key) throw new Error("Invalid stored activity date.");
    return date;
  }
  const count = n => Number.isSafeInteger(n) && n > 0 && n <= 1000000;
  function read(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (raw == null) return { ok: true, value: empty() };
      if (typeof raw !== "string" || raw.length > MAX_RAW) throw new Error("Activity storage is too large.");
      const data = JSON.parse(raw), dates = new Set();
      if (data?.version !== 1 || !Array.isArray(data.days) || data.days.length > MAX_DAYS) throw new Error("Unrecognized activity storage.");
      const days = data.days.map(day => {
        dateOf(day.date);
        if (dates.has(day.date) || !count(day.plays) || !Array.isArray(day.games) || !day.games.length || day.games.length > MAX_GAMES) throw new Error("Invalid activity totals.");
        dates.add(day.date);
        const ids = new Set();
        const games = day.games.map(game => {
          if (typeof game.id !== "string" || !game.id || game.id.length > 100 || ids.has(game.id) || typeof game.title !== "string" || !game.title || game.title.length > 80 || !count(game.plays)) throw new Error("Invalid game activity.");
          ids.add(game.id);
          return { id: game.id, title: game.title, plays: game.plays };
        });
        if (games.reduce((sum, game) => sum + game.plays, 0) !== day.plays) throw new Error("Activity totals do not match.");
        return { date: day.date, plays: day.plays, games };
      });
      return { ok: true, value: { version: 1, days } };
    } catch (error) {
      return { ok: false, error: `Activity could not be read. Stored data was left unchanged. ${error.message}` };
    }
  }
  function record(storage, game, now = new Date()) {
    const current = read(storage);
    if (!current.ok) return current;
    try {
      if (!game || typeof game.id !== "string" || !game.id.trim() || game.id.length > 100 || typeof game.title !== "string" || !game.title.trim()) throw new Error("A game ID and title are required.");
      const key = dayKey(now), cutoff = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - MAX_DAYS + 1, 12));
      const days = current.value.days.filter(day => day.date >= cutoff);
      let day = days.find(item => item.date === key);
      if (!day) { day = { date: key, plays: 0, games: [] }; days.push(day); }
      let item = day.games.find(item => item.id === game.id);
      if (day.plays >= 1000000 || (!item && day.games.length >= MAX_GAMES) || days.length > MAX_DAYS) throw new Error("The local activity limit has been reached.");
      if (!item) { item = { id: game.id, title: game.title.trim().slice(0, 80), plays: 0 }; day.games.push(item); }
      item.plays++; day.plays++;
      days.sort((a, b) => a.date.localeCompare(b.date));
      const value = { version: 1, days }, raw = JSON.stringify(value);
      if (raw.length > MAX_RAW) throw new Error("The local activity limit has been reached.");
      storage.setItem(KEY, raw);
      return { ok: true, value };
    } catch (error) { return { ok: false, error: `This play could not be saved. Games remain available. ${error.message}` }; }
  }
  function calendar(now = new Date()) {
    const today = dayKey(now), first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 51 * 7, 12);
    return Array.from({ length: 364 }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index, 12), key = dayKey(date);
      return { key, date, future: key > today, week: Math.floor(index / 7), weekday: index % 7 };
    });
  }
  const level = plays => plays >= 10 ? 4 : plays >= 5 ? 3 : plays >= 2 ? 2 : plays > 0 ? 1 : 0;
  function summary(day) {
    if (!day) return { plays: 0, top: "None" };
    const top = [...day.games].sort((a, b) => b.plays - a.plays || a.id.localeCompare(b.id))[0];
    return { plays: day.plays, top: top?.title || "None" };
  }
  const api = { key: KEY, dayKey, read, record, calendar, level, summary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window === "undefined" || typeof document === "undefined" || window.ArcadePlaytime) return;
  window.ArcadePlaytime = api;
  let notice = "", pending = Promise.resolve(), dialog, timer, trigger;
  function storage() { try { return window.localStorage; } catch { return { getItem() { throw new Error("Storage is disabled."); } }; } }
  window.addEventListener("arcadeverse:game-launched", event => {
    const game = { id: event.detail?.id, title: event.detail?.title }, now = new Date();
    const save = () => { const result = record(storage(), game, now); notice = result.ok ? "" : result.error; if (dialog?.open) render(); };
    // Web Locks serialize concurrent tabs where supported. The fallback queues
    // this page's events; it is not a cross-tab transactional database.
    pending = pending.then(() => navigator.locks?.request ? navigator.locks.request(KEY, save) : save()).catch(() => { notice = "Activity could not be saved on this device."; });
  });
  function render() {
    const host = dialog.querySelector("[data-activity-grid]"), detail = dialog.querySelector("[data-activity-detail]"), state = read(storage()), now = new Date();
    const days = new Map((state.ok ? state.value.days : []).map(day => [day.date, day])), cells = calendar(now), today = dayKey(now);
    dialog.querySelector("[data-activity-notice]").textContent = state.ok ? notice : state.error;
    host.replaceChildren();
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 704 120"); svg.setAttribute("role", "grid"); svg.setAttribute("aria-label", "Your local game launches over 52 calendar weeks");
    svg.setAttribute("aria-rowcount", "7"); svg.setAttribute("aria-colcount", "52");
    const elements = new Map();
    const describe = cell => {
      const info = summary(days.get(cell.key));
      return `${cell.date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}: ${cell.future ? "future date" : `${info.plays} game launches. Top played title: ${info.top}`}`;
    };
    const inspect = cell => { detail.textContent = describe(cell); };
    for (let weekday = 0; weekday < 7; weekday++) {
      const row = document.createElementNS(ns, "g"); row.setAttribute("role", "row"); row.setAttribute("aria-rowindex", String(weekday + 1));
      for (const cell of cells.filter(cell => cell.weekday === weekday)) {
        const rect = document.createElementNS(ns, "rect"), info = summary(days.get(cell.key));
        for (const [key, value] of Object.entries({ x: 24 + cell.week * 13, y: 19 + weekday * 13, width: 10, height: 10, rx: 2, role: "gridcell", tabindex: cell.key === today ? 0 : -1, "aria-colindex": cell.week + 1, "aria-label": describe(cell), "data-date": cell.key, "data-level": cell.future ? 0 : level(info.plays) })) rect.setAttribute(key, String(value));
        if (cell.future) rect.setAttribute("aria-disabled", "true");
        const title = document.createElementNS(ns, "title"); title.textContent = describe(cell); rect.appendChild(title);
        rect.addEventListener("pointerenter", () => inspect(cell)); rect.addEventListener("focus", () => inspect(cell));
        rect.addEventListener("keydown", event => {
          let index = cells.indexOf(cell);
          const changes = { ArrowLeft: Math.max(0, cell.week - 1) * 7 + cell.weekday, ArrowRight: Math.min(51, cell.week + 1) * 7 + cell.weekday, ArrowUp: cell.week * 7 + Math.max(0, cell.weekday - 1), ArrowDown: cell.week * 7 + Math.min(6, cell.weekday + 1) };
          if (Object.prototype.hasOwnProperty.call(changes, event.key)) index = changes[event.key];
          else if (event.key === "Home") index = 0;
          else if (event.key === "End") index = cells.findIndex(item => item.key === today);
          else return;
          event.preventDefault(); for (const element of elements.values()) element.setAttribute("tabindex", "-1");
          const target = elements.get(cells[index].key); target.setAttribute("tabindex", "0"); target.focus();
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
        elements.set(cell.key, rect); row.appendChild(rect);
      }
      svg.appendChild(row);
    }
    let month = -1;
    for (const cell of cells.filter(cell => cell.weekday === 0)) {
      if (cell.date.getMonth() === month) continue;
      month = cell.date.getMonth(); const label = document.createElementNS(ns, "text"); label.setAttribute("x", String(24 + cell.week * 13)); label.setAttribute("y", "11"); label.setAttribute("aria-hidden", "true"); label.textContent = cell.date.toLocaleDateString(undefined, { month: "short" }); svg.appendChild(label);
    }
    host.appendChild(svg); inspect(cells.find(cell => cell.key === today));
    const total = cells.reduce((sum, cell) => sum + (cell.future ? 0 : summary(days.get(cell.key)).plays), 0);
    dialog.querySelector("[data-activity-total]").textContent = `${total.toLocaleString()} game launches · 52 calendar weeks ending this week`;
    clearTimeout(timer);
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(() => { if (dialog.open) render(); }, midnight.getTime() - now.getTime() + 50);
  }
  function mount() {
    trigger = document.querySelector("[data-open-playtime]"); if (!trigger) return;
    dialog = document.createElement("dialog"); dialog.className = "playtime-drawer"; dialog.setAttribute("aria-labelledby", "playtime-title");
    dialog.innerHTML = '<div class="playtime-heading"><h2 id="playtime-title">Your play activity</h2><button type="button" aria-label="Close play activity">Close</button></div><p>Only game launches on this browser are counted. This is your local activity, separate from contributor rankings and NSoC points.</p><p data-activity-total></p><div class="playtime-scroll" data-activity-grid></div><p class="playtime-inspector" data-activity-detail role="status" aria-live="polite"></p><div class="playtime-legend" aria-label="Launch intensity: zero, one, two to four, five to nine, ten or more"><span>Less</span><i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i><span>More</span></div><p data-activity-notice role="status"></p><p>Scroll the calendar horizontally on small screens. Focus a day and use arrow keys; Home selects the first day and End selects today.</p>';
    document.body.appendChild(dialog);
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { clearTimeout(timer); document.body.classList.remove("playtime-activity-open"); trigger.focus(); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    trigger.addEventListener("click", () => { render(); dialog.showModal(); document.body.classList.add("playtime-activity-open"); });
    window.addEventListener("storage", event => { if (dialog.open && (event.key === KEY || event.key === null)) render(); });
    window.addEventListener("focus", () => { if (dialog.open) render(); });
    window.addEventListener("pagehide", () => clearTimeout(timer));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
