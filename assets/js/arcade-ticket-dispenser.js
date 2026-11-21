/* Device-local game tickets and cosmetics; never contributor or NSoC points. */
(function () {
  "use strict";
  const KEY = "av_ticket_ledger", MAX_BALANCE = 1000000, MAX_RECEIPTS = 4096;
  const slots = ["trail", "sound", "badge", "border"];
  const rewards = [
    { id: "neon-trail", slot: "trail", name: "Neon cursor trail", cost: 10, hint: "A short cyan trail follows your mouse. Reduced motion pauses it." },
    { id: "retro-sound", slot: "sound", name: "Retro ticket sound pack", cost: 15, hint: "A triangle-wave arcade chime for this ticket dispenser." },
    { id: "star-badge", slot: "badge", name: "Rare star avatar badge", cost: 20, hint: "A star on your local prize-counter portrait, separate from contributor badges." },
    { id: "marquee-border", slot: "border", name: "Glowing marquee border", cost: 25, hint: "Light up the game window and your prize-counter portrait." }
  ];
  const empty = () => ({ version: 1, balance: 0, revision: 0, receipts: [], owned: [], equipped: { trail: null, sound: null, badge: null, border: null } });
  const validScore = score => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100000000;
  function read(storage) {
    try {
      const raw = storage.getItem(KEY); if (raw === null) return { ok: true, value: empty() };
      if (typeof raw !== "string" || raw.length > 400000) throw new Error("Ticket ledger exceeds its storage limit.");
      const value = JSON.parse(raw);
      if (value?.version !== 1 || !Number.isSafeInteger(value.balance) || value.balance < 0 || value.balance > MAX_BALANCE || !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > 1000000000) throw new Error("Invalid ticket totals.");
      if (!Array.isArray(value.receipts) || value.receipts.length > MAX_RECEIPTS || value.receipts.some(id => typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) || new Set(value.receipts).size !== value.receipts.length) throw new Error("Invalid session receipts.");
      if (!Array.isArray(value.owned) || value.owned.length > rewards.length || new Set(value.owned).size !== value.owned.length || value.owned.some(id => !rewards.some(reward => reward.id === id))) throw new Error("Invalid prize ownership.");
      if (!value.equipped || Array.isArray(value.equipped) || Object.keys(value.equipped).length !== slots.length || slots.some(slot => !(value.equipped[slot] === null || rewards.some(reward => reward.slot === slot && reward.id === value.equipped[slot] && value.owned.includes(reward.id))))) throw new Error("Invalid equipped prizes.");
      return { ok: true, value: { version: 1, balance: value.balance, revision: value.revision, receipts: [...value.receipts], owned: [...value.owned], equipped: { trail: value.equipped.trail, sound: value.equipped.sound, badge: value.equipped.badge, border: value.equipped.border } } };
    } catch (error) { return { ok: false, error: `Ticket storage could not be read and was left unchanged. ${error.message}` }; }
  }
  // The browser caller holds KEY's Web Lock for this complete read/modify/write.
  function transact(storage, action) {
    const loaded = read(storage); if (!loaded.ok) return loaded;
    try {
      const value = loaded.value; let earned = 0, notice;
      if (action?.type === "award") {
        if (!validScore(action.score) || typeof action.receipt !== "string" || !/^[a-f0-9]{64}$/.test(action.receipt)) throw new Error("Invalid completed-session award.");
        if (value.receipts.includes(action.receipt)) return { ok: true, changed: false, value, earned: 0, notice: "This opened game session has already been counted." };
        if (value.receipts.length === MAX_RECEIPTS) throw new Error("The 4096-session receipt limit has been reached. Existing tickets and prizes are preserved.");
        earned = Math.floor(action.score / 100);
        if (value.balance > MAX_BALANCE - earned) throw new Error("The local ticket balance limit has been reached.");
        value.receipts.push(action.receipt); value.balance += earned;
        notice = `${earned} tickets earned from ${action.score} points. One award per opened game session.`;
      } else if (action?.type === "redeem") {
        const reward = rewards.find(item => item.id === action.id); if (!reward) throw new Error("Unknown prize.");
        if (value.owned.includes(reward.id)) return { ok: true, changed: false, value, earned: 0, notice: "You already own this prize. Equip it below." };
        if (value.balance < reward.cost) throw new Error("Not enough tickets for this prize. Games always remain free.");
        value.balance -= reward.cost; value.owned.push(reward.id); value.equipped[reward.slot] = reward.id; notice = `${reward.name} redeemed and equipped.`;
      } else if (action?.type === "equip") {
        if (!slots.includes(action.slot) || !(action.id === null || rewards.some(item => item.id === action.id && item.slot === action.slot && value.owned.includes(item.id)))) throw new Error("This prize is not owned for that slot.");
        if (value.equipped[action.slot] === action.id) return { ok: true, changed: false, value, earned: 0, notice: "Prize setting is unchanged." };
        value.equipped[action.slot] = action.id; notice = "Local prize setting saved.";
      } else throw new Error("Unknown ticket action.");
      if (value.revision === 1000000000) throw new Error("Ticket revision limit reached.");
      value.revision++; storage.setItem(KEY, JSON.stringify(value));
      return { ok: true, changed: true, value, earned, notice };
    } catch (error) { return { ok: false, error: `No ticket change was saved. ${error.message}` }; }
  }
  const model = { key: KEY, rewards, validScore, read, transact };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  if (typeof document === "undefined" || typeof window === "undefined" || window.ArcadeTickets) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)"), locks = () => typeof navigator.locks?.request === "function";
  let dialog, trigger, live, notice = "", pending = 0, activeGame = null, lastScore = null, lastToken = null, returnAction;
  let spool, spoolTimer, soundTimer, trail, trailFrame = 0, particles = [];
  const sounds = new Set();
  const storage = () => { try { return window.localStorage; } catch { return { getItem() { throw new Error("Browser storage is disabled."); } }; } };
  function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function stopSounds() { clearTimeout(soundTimer); for (const sound of sounds) { try { sound.oscillator.stop(); } catch {} sound.oscillator.disconnect(); sound.gain.disconnect(); } sounds.clear(); }
  function clearSpool() { clearTimeout(spoolTimer); spool?.remove(); spool = null; stopSounds(); }
  function pulse(index, retro) {
    try {
      const engine = window.SoundEngine;
      if (!engine?.enabled || engine.volume <= 0) return false;
      const context = engine.getAudioContext?.(); if (!context || context.state !== "running") return false;
      const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime, sound = { oscillator, gain };
      sounds.add(sound); oscillator.type = retro ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(retro ? 560 + index * 70 : 2400, now);
      oscillator.frequency.exponentialRampToValueAtTime(retro ? 280 : 600, now + .025);
      gain.gain.setValueAtTime(.025 * Math.max(0, Math.min(1, engine.volume)), now); gain.gain.exponentialRampToValueAtTime(.0001, now + .028);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); sounds.delete(sound); };
      oscillator.start(now); oscillator.stop(now + .03); return true;
    } catch { return false; }
  }
  function chatter(retro, count = 8) {
    stopSounds(); let index = 0;
    function next() { if (!pulse(index++, retro)) { stopSounds(); return; } if (index < count) soundTimer = setTimeout(next, 70); }
    next();
  }
  function awardEffect(result) {
    if (!result.earned || motion.matches || document.hidden) return;
    clearSpool(); spool = element("div", undefined, "av-ticket-spool"); spool.setAttribute("aria-hidden", "true");
    spool.innerHTML = '<div class="av-ticket-machine">TICKETS<span></span></div><div class="av-ticket-paper"><strong></strong><span>PLAY · WIN · REDEEM</span></div>';
    spool.querySelector("strong").textContent = `+${result.earned}`; document.body.appendChild(spool);
    chatter(result.value.equipped.sound === "retro-sound"); spoolTimer = setTimeout(clearSpool, 2400);
  }
  function clearTrail() { cancelAnimationFrame(trailFrame); trailFrame = 0; particles = []; trail?.remove(); trail = null; window.removeEventListener("pointermove", pointer); window.removeEventListener("resize", resizeTrail); }
  function resizeTrail() { if (trail) { const ratio = Math.min(window.devicePixelRatio || 1, 2); trail.width = Math.ceil(innerWidth * ratio); trail.height = Math.ceil(innerHeight * ratio); trail.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0); } }
  function drawTrail(now) {
    trailFrame = 0; const paint = trail?.getContext("2d"); if (!paint) return;
    paint.clearRect(0, 0, innerWidth, innerHeight); particles = particles.filter(point => now - point.born < 350);
    paint.fillStyle = "#22d3ee";
    for (const point of particles) { paint.globalAlpha = Math.max(0, 1 - (now - point.born) / 350); paint.fillRect(point.x - 2, point.y - 2, 4, 4); }
    paint.globalAlpha = 1; if (particles.length) trailFrame = requestAnimationFrame(drawTrail);
  }
  function pointer(event) { if (event.pointerType !== "mouse") return; particles.push({ x: event.clientX, y: event.clientY, born: performance.now() }); if (particles.length > 24) particles.shift(); if (!trailFrame) trailFrame = requestAnimationFrame(drawTrail); }
  function updateTrail(enabled) {
    if (!enabled || motion.matches || document.hidden) { clearTrail(); return; }
    if (trail) return;
    trail = element("canvas", undefined, "av-ticket-trail"); trail.setAttribute("aria-hidden", "true"); document.body.appendChild(trail); resizeTrail();
    window.addEventListener("pointermove", pointer); window.addEventListener("resize", resizeTrail);
  }
  function refresh() {
    const loaded = read(storage()), value = loaded.ok ? loaded.value : null;
    document.documentElement.toggleAttribute("data-av-ticket-marquee", value?.equipped.border === "marquee-border");
    updateTrail(value?.equipped.trail === "neon-trail");
    if (!dialog) return;
    trigger.textContent = `Prize Counter · ${value ? value.balance : "—"} tickets`;
    dialog.querySelector("[data-ticket-balance]").textContent = value ? String(value.balance) : "—";
    dialog.querySelector("[data-ticket-portrait]").classList.toggle("av-ticket-star", value?.equipped.badge === "star-badge");
    const blocked = !loaded.ok || pending > 0 || !locks() || !window.crypto?.subtle;
    for (const reward of rewards) {
      const owned = value?.owned.includes(reward.id), equipped = value?.equipped[reward.slot] === reward.id;
      const redeem = dialog.querySelector(`[data-ticket-redeem="${reward.id}"]`), equip = dialog.querySelector(`[data-ticket-equip="${reward.id}"]`);
      redeem.textContent = owned ? "Owned" : `Redeem · ${reward.cost} tickets`; redeem.disabled = blocked || owned || value.balance < reward.cost;
      equip.hidden = !owned; equip.textContent = equipped ? `Unequip ${reward.name}` : `Equip ${reward.name}`; equip.setAttribute("aria-pressed", String(!!equipped)); equip.disabled = blocked;
    }
    dialog.querySelector("[data-ticket-notice]").textContent = !loaded.ok ? loaded.error : !locks() || !window.crypto?.subtle ? "Ticket changes require Web Locks and secure browser storage (HTTPS or localhost). Your saved balance stays intact; games remain free." : notice || "Stored on this device only. Redeeming never changes contributor rankings.";
  }
  async function submit(action, button) {
    pending++; if (button) returnAction = button; refresh(); let result;
    try { result = locks() && window.crypto?.subtle ? await navigator.locks.request(KEY, () => transact(storage(), action)) : { ok: false, error: "Ticket changes could not be locked; nothing was saved." }; }
    catch { result = { ok: false, error: "Ticket changes could not be locked; nothing was saved." }; }
    notice = result.ok ? result.notice : result.error; pending--; refresh(); live.textContent = notice;
    if (dialog.open && returnAction && (document.activeElement === document.body || document.activeElement === returnAction)) {
      const nextAction = returnAction.disabled && action.type === "redeem" ? dialog.querySelector(`[data-ticket-equip="${action.id}"]`) : returnAction;
      if (nextAction && !nextAction.disabled && !nextAction.hidden) nextAction.focus();
    }
    if (result.ok && result.changed && action.type === "award") awardEffect(result);
    return result;
  }
  async function complete(event) {
    const detail = event.detail;
    if (activeGame === null || String(detail?.gameId) !== activeGame || typeof detail?.sessionToken !== "string" || !detail.sessionToken || detail.sessionToken.length > 256 || lastToken && lastToken !== detail.sessionToken) return;
    const raw = detail.details?.score;
    const score = raw === undefined || raw === null ? lastScore : typeof raw === "number" || typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
    if (!validScore(score)) { notice = "No tickets awarded: the completed game did not provide a valid final score."; refresh(); return; }
    lastToken = detail.sessionToken;
    try {
      if (!window.crypto?.subtle) throw new Error("Secure session receipts are unavailable.");
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([activeGame, detail.sessionToken])));
      const receipt = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      await submit({ type: "award", score, receipt });
    } catch { notice = "The session receipt could not be saved; no award was confirmed."; refresh(); }
  }
  function mount() {
    const place = document.querySelector(".hero-cta-group,.section-header.center"); if (!place) return;
    const style = element("link"); style.rel = "stylesheet"; style.href = new URL("assets/css/arcade-ticket-dispenser.css", document.baseURI); document.head.appendChild(style);
    trigger = element("button", "Prize Counter", "btn btn-secondary av-ticket-trigger"); trigger.type = "button"; trigger.setAttribute("aria-haspopup", "dialog"); place.appendChild(trigger);
    dialog = element("dialog", undefined, "av-ticket-counter"); dialog.setAttribute("aria-labelledby", "av-ticket-heading");
    dialog.innerHTML = '<header><div><p class="av-ticket-eyebrow">LOCAL ARCADE REWARDS</p><h2 id="av-ticket-heading">Prize Counter</h2></div><button type="button" data-ticket-close>Close</button></header><div class="av-ticket-profile"><span data-ticket-portrait><svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="8"/><path d="M20 29h24M24 23v12M40 23v12M24 43h16"/><polygon class="av-ticket-badge" points="48,2 51,9 59,10 53,15 55,23 48,19 41,23 43,15 37,10 45,9"/></svg></span><div><strong data-ticket-balance aria-live="polite">0</strong><span>saved tickets</span></div></div><p>Complete an opened game session to earn one ticket per 100 final-score points, rounded down. One award per opened session, including a zero-ticket result. Closing a game without its game-over event earns nothing.</p><p>Free local cosmetics only. Tickets are separate from daily arcade tokens, contributor rankings and official NSoC points. Editing or clearing this browser’s data changes this local profile; there is no account sync or cash value.</p><h3>Choose your prizes</h3><div data-ticket-rewards></div><button type="button" data-ticket-preview>Preview ticket sound</button><p class="av-ticket-hint">Sound follows the arcade mute and volume controls. Reduced motion pauses the roll and mouse trail. Up to 4,096 completed-session receipts are retained; if full, new awards pause while existing prizes remain available.</p><p data-ticket-notice role="status" aria-live="polite"></p>';
    const list = dialog.querySelector("[data-ticket-rewards]");
    for (const reward of rewards) {
      const card = element("article", undefined, "av-ticket-prize"); card.append(element("h4", reward.name), element("p", reward.hint));
      const redeem = element("button"), equip = element("button"); redeem.type = equip.type = "button"; redeem.dataset.ticketRedeem = equip.dataset.ticketEquip = reward.id;
      redeem.addEventListener("click", () => void submit({ type: "redeem", id: reward.id }, redeem));
      equip.addEventListener("click", () => { const value = read(storage()); if (value.ok) void submit({ type: "equip", slot: reward.slot, id: value.value.equipped[reward.slot] === reward.id ? null : reward.id }, equip); });
      card.append(redeem, equip); list.appendChild(card);
    }
    document.body.appendChild(dialog); live = element("div", "", "sr-only"); live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite"); document.body.appendChild(live);
    trigger.addEventListener("click", () => { refresh(); dialog.showModal(); document.body.classList.add("av-ticket-counter-open"); });
    dialog.querySelector("[data-ticket-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { stopSounds(); document.body.classList.remove("av-ticket-counter-open"); trigger.focus(); });
    dialog.addEventListener("keydown", event => event.stopPropagation());
    dialog.querySelector("[data-ticket-preview]").addEventListener("click", () => { const loaded = read(storage()); if (!window.SoundEngine?.enabled || window.SoundEngine.volume <= 0 || motion.matches) { notice = "Sound preview is paused by arcade mute, zero volume or reduced motion."; refresh(); return; } chatter(loaded.ok && loaded.value.equipped.sound === "retro-sound", 3); });
    refresh();
  }
  window.addEventListener("arcadeverse:game-launched", event => { activeGame = event.detail?.id == null ? null : String(event.detail.id); lastScore = null; lastToken = null; });
  window.addEventListener("arcadeverse:score-update", event => { const detail = event.detail; if (activeGame !== null && String(detail?.gameId) === activeGame && typeof detail.sessionToken === "string" && detail.sessionToken && (!lastToken || lastToken === detail.sessionToken) && validScore(detail.score)) { lastToken = detail.sessionToken; lastScore = detail.score; } });
  window.addEventListener("arcadeverse:game-over", event => { if (dialog) void complete(event); });
  window.addEventListener("arcadeverse:game-closed", () => { activeGame = null; lastScore = null; lastToken = null; });
  window.addEventListener("storage", event => { if (event.key === KEY || event.key === null) refresh(); });
  document.addEventListener("visibilitychange", () => { clearSpool(); refresh(); });
  motion.addEventListener?.("change", () => { clearSpool(); refresh(); });
  window.addEventListener("pagehide", () => { clearSpool(); clearTrail(); });
  window.addEventListener("pageshow", refresh);
  window.ArcadeTickets = { snapshot: () => read(storage()) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
