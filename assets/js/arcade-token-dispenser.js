/* Free, device-local cosmetic tokens. Never gates game access or NSoC points. */
(function () {
  "use strict";
  const KEY = "av_arcade_tokens", MAX_BALANCE = 1000000;
  const rewards = [
    { id: "neon-border", slot: "border", name: "Neon card border", cost: 4 },
    { id: "midnight-title", slot: "title", name: "Midnight player", cost: 6 },
    { id: "orbit-flair", slot: "flair", name: "Orbit avatar flair", cost: 5 }
  ];
  const slots = ["border", "title", "flair"];
  function utcDay(now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Invalid device time.");
    const day = now.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Device time is outside the supported calendar.");
    return day;
  }
  function validDay(day) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    try { return new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day; } catch { return false; }
  }
  function read(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (raw == null) return { ok: true, value: null };
      if (typeof raw !== "string" || raw.length > 16384) throw new Error("Ledger is too large.");
      const data = JSON.parse(raw);
      if (data?.version !== 1 || !Number.isSafeInteger(data.balance) || data.balance < 0 || data.balance > MAX_BALANCE || !Number.isSafeInteger(data.revision) || data.revision < 0 || data.revision > 1000000000 || !validDay(data.lastSeenDay) || !(data.lastClaimDay === null || validDay(data.lastClaimDay) && data.lastClaimDay <= data.lastSeenDay) || typeof data.effect !== "boolean") throw new Error("Invalid ledger values.");
      if (!Array.isArray(data.owned) || data.owned.length > rewards.length || new Set(data.owned).size !== data.owned.length || data.owned.some(id => !rewards.some(item => item.id === id))) throw new Error("Invalid cosmetic ownership.");
      if (!data.equipped || Array.isArray(data.equipped) || Object.keys(data.equipped).length !== 3 || slots.some(slot => !(data.equipped[slot] === null || rewards.some(item => item.id === data.equipped[slot] && item.slot === slot && data.owned.includes(item.id))))) throw new Error("Invalid equipped cosmetics.");
      return { ok: true, value: { version: 1, balance: data.balance, revision: data.revision, lastSeenDay: data.lastSeenDay, lastClaimDay: data.lastClaimDay, effect: data.effect, owned: [...data.owned], equipped: { border: data.equipped.border, title: data.equipped.title, flair: data.equipped.flair } } };
    } catch (error) { return { ok: false, error: `Token storage could not be read; it was left unchanged. ${error.message}` }; }
  }
  // Synchronous storage transaction; callers must hold the browser Web Lock.
  // Writes happen before success/animation/cosmetics are reported.
  function transact(storage, action, now = new Date()) {
    const loaded = read(storage); if (!loaded.ok) return loaded;
    try {
      const today = utcDay(now), state = loaded.value || { version: 1, balance: 5, revision: 0, lastSeenDay: today, lastClaimDay: null, effect: false, owned: [], equipped: { border: null, title: null, flair: null } };
      if (!action || typeof action.type !== "string") throw new Error("Unknown token action.");
      if (action.type === "init" && loaded.value) return { ok: true, changed: false, value: state, notice: "Local tokens are ready." };
      if (today < state.lastSeenDay) throw new Error("The device clock moved behind the saved UTC date. Token changes are paused until it catches up.");
      let notice = "Five complimentary local tokens are ready.";
      const unchanged = text => ({ ok: true, changed: false, value: state, notice: text });
      const charge = amount => { if (state.balance < amount) throw new Error("Not enough virtual tokens. Games still open for free."); state.balance -= amount; };
      if (action.type === "claim") {
        if (state.lastClaimDay === today) return unchanged("Today's three tokens have already been claimed.");
        if (state.balance > MAX_BALANCE - 3) throw new Error("The local balance limit has been reached.");
        state.balance += 3; state.lastClaimDay = today; notice = "Three daily tokens claimed for this UTC day.";
      } else if (action.type === "spend") {
        charge(1); notice = "One virtual token used for the optional coin effect.";
      } else if (action.type === "redeem") {
        const reward = rewards.find(item => item.id === action.id);
        if (!reward) throw new Error("Unknown cosmetic reward.");
        if (state.owned.includes(reward.id)) return unchanged("You already own this cosmetic.");
        charge(reward.cost); state.owned.push(reward.id); state.equipped[reward.slot] = reward.id; notice = `${reward.name} redeemed and equipped locally.`;
      } else if (action.type === "equip") {
        if (!slots.includes(action.slot)) throw new Error("Unknown cosmetic slot.");
        if (action.id !== null && !rewards.some(item => item.id === action.id && item.slot === action.slot && state.owned.includes(item.id))) throw new Error("This cosmetic is not owned for that slot.");
        if (state.equipped[action.slot] === action.id) return unchanged("This cosmetic setting is already active.");
        state.equipped[action.slot] = action.id; notice = "Local cosmetic selection saved.";
      } else if (action.type === "preference") {
        if (typeof action.enabled !== "boolean") throw new Error("Invalid effect preference.");
        if (state.effect === action.enabled) return unchanged("Coin effect preference is unchanged.");
        state.effect = action.enabled; notice = "Optional coin effect preference saved.";
      } else if (action.type !== "init") throw new Error("Unknown token action.");
      if (action.type !== "init") { if (state.revision === 1000000000) throw new Error("Ledger revision limit reached."); state.revision++; }
      state.lastSeenDay = today;
      storage.setItem(KEY, JSON.stringify(state));
      return { ok: true, changed: true, value: state, notice };
    } catch (error) { return { ok: false, error: `No token change was saved. ${error.message}` }; }
  }
  const model = { key: KEY, rewards, utcDay, read, transact };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  if (typeof window === "undefined" || typeof document === "undefined" || window.ArcadeTokens) return;
  let dialog, trigger, notice = "", pending = 0, queue = Promise.resolve(), effectTimer, effectNode, rolloverTimer;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const locksAvailable = () => typeof navigator.locks?.request === "function";
  function storage() { try { return window.localStorage; } catch { return { getItem() { throw new Error("Local storage is disabled."); } }; } }
  function refresh() {
    const result = read(storage()), state = result.ok ? result.value : null, today = utcDay();
    const clockBehind = state && today < state.lastSeenDay;
    document.documentElement.toggleAttribute("data-av-neon-border", state?.equipped.border === "neon-border");
    if (trigger) trigger.textContent = `Arcade tokens · ${state ? state.balance : "—"}`;
    if (!dialog) return;
    dialog.querySelector("[data-token-balance]").textContent = state ? String(state.balance) : "—";
    dialog.querySelector("[data-token-title]").textContent = state?.equipped.title === "midnight-title" ? "Midnight player" : "Arcade player";
    dialog.querySelector("[data-token-avatar]").classList.toggle("av-token-orbit", state?.equipped.flair === "orbit-flair");
    const blocked = pending > 0 || !locksAvailable() || !state || clockBehind;
    const claim = dialog.querySelector("[data-token-claim]"); claim.disabled = blocked || state?.lastClaimDay === today; claim.textContent = state?.lastClaimDay === today ? "Daily tokens claimed" : "Claim 3 daily tokens";
    const preference = dialog.querySelector("[data-token-effect]"); preference.checked = !!state?.effect; preference.disabled = blocked || reducedMotion.matches;
    dialog.querySelector("[data-token-effect-hint]").textContent = reducedMotion.matches ? "Reduced motion is enabled: the coin effect is paused and no launch tokens are spent." : "Optional animation and brief sound, respecting master audio. Games always open free; insufficient tokens simply skip the effect.";
    dialog.querySelector("[data-token-notice]").textContent = !result.ok ? result.error : !locksAvailable() ? "Token changes need Web Locks (HTTPS or localhost). Games remain free. Existing tokens are preserved." : clockBehind ? "Your clock is behind the saved UTC date. Token changes are paused; games remain free." : notice || (state ? "Stored only in this browser. No account sync or monetization." : "Preparing complimentary tokens…");
    const list = dialog.querySelector("[data-token-rewards]"); list.replaceChildren();
    for (const reward of rewards) {
      const row = document.createElement("div"); row.className = "av-token-reward";
      const label = document.createElement("span"); label.textContent = `${reward.name} · ${reward.cost} tokens`; row.appendChild(label);
      const button = document.createElement("button"); button.type = "button";
      const owned = state?.owned.includes(reward.id), equipped = state?.equipped[reward.slot] === reward.id;
      button.textContent = `${equipped ? "Unequip" : owned ? "Equip" : "Redeem"} ${reward.name}`;
      button.disabled = blocked || !owned && state.balance < reward.cost;
      button.addEventListener("click", () => void submit(owned ? { type: "equip", slot: reward.slot, id: equipped ? null : reward.id } : { type: "redeem", id: reward.id }));
      row.appendChild(button); list.appendChild(row);
    }
  }
  async function submit(action) {
    if (!locksAvailable()) { notice = "This browser cannot safely serialize local token changes. Games remain free."; refresh(); return { ok: false, error: notice }; }
    pending++; refresh();
    const run = queue.then(() => navigator.locks.request(KEY, () => transact(storage(), action)));
    queue = run.catch(() => {});
    let result;
    try { result = await run; } catch { result = { ok: false, error: "Token storage could not be locked; no success is assumed." }; }
    notice = result.ok ? result.notice : result.error; pending--; refresh();
    return result;
  }
  function coinEffect() {
    if (reducedMotion.matches) return;
    clearTimeout(effectTimer); effectNode?.remove();
    effectNode = document.createElement("div"); effectNode.className = "av-token-drop"; effectNode.setAttribute("aria-hidden", "true");
    effectNode.innerHTML = '<svg viewBox="0 0 100 110" width="90" height="100"><path class="av-token-slot" d="M20 96h60"/><g class="av-token-coin"><circle cx="50" cy="30" r="19"/><path d="M50 17v26M42 23h12a6 6 0 0 1 0 12H42"/></g></svg>';
    document.body.appendChild(effectNode); effectTimer = setTimeout(() => { effectNode?.remove(); effectNode = null; }, 1100);
    try {
      const engine = window.SoundEngine; if (!engine?.enabled) return;
      const context = engine.getAudioContext?.(); if (!context || context.state !== "running") return;
      const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime;
      oscillator.type = "triangle"; oscillator.frequency.setValueAtTime(700, start); oscillator.frequency.exponentialRampToValueAtTime(180, start + .035);
      gain.gain.setValueAtTime(.035 * Math.max(0, Math.min(1, engine.volume)), start); gain.gain.exponentialRampToValueAtTime(.0001, start + .04);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; oscillator.start(start); oscillator.stop(start + .045);
    } catch { /* Cosmetic sound is optional; token state is already persisted. */ }
  }
  function armRollover() {
    clearTimeout(rolloverTimer); const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    rolloverTimer = setTimeout(() => { refresh(); if (dialog?.open) armRollover(); }, Math.max(50, next - now.getTime() + 50));
  }
  function mount() {
    const place = document.querySelector(".hero-cta-group,.section-header.center"); if (!place) return;
    const style = document.createElement("link"); style.rel = "stylesheet"; style.href = new URL("assets/css/arcade-token-dispenser.css", document.baseURI); document.head.appendChild(style);
    trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "btn btn-secondary av-tokens-trigger"; trigger.setAttribute("aria-haspopup", "dialog"); place.appendChild(trigger);
    dialog = document.createElement("dialog"); dialog.className = "av-token-drawer"; dialog.setAttribute("aria-labelledby", "av-token-heading");
    dialog.innerHTML = '<header><h2 id="av-token-heading">Your arcade tokens</h2><button type="button" data-token-close>Close</button></header><p>Free virtual tokens for optional local cosmetics. Separate from contributor rankings and official NSoC points.</p><div class="av-token-profile"><span data-token-avatar aria-hidden="true"><svg viewBox="0 0 48 48" width="42" height="42"><circle cx="24" cy="24" r="18"/><path d="M16 24h10M21 19v10M31 21v2M34 26v2"/></svg></span><strong data-token-title>Arcade player</strong></div><p class="av-token-balance"><strong data-token-balance aria-live="polite">—</strong> virtual tokens</p><button type="button" data-token-claim>Claim 3 daily tokens</button><p>Five starter tokens once per local profile. Claim three more after each UTC date rollover (00:00 UTC), using this device’s clock.</p><label class="av-token-preference"><input type="checkbox" data-token-effect> Use 1 token for a coin effect when a game launches</label><p data-token-effect-hint></p><h3>Cosmetic rewards</h3><div data-token-rewards></div><p data-token-notice role="status" aria-live="polite"></p>';
    document.body.appendChild(dialog);
    trigger.addEventListener("click", () => { refresh(); dialog.showModal(); document.body.classList.add("av-token-profile-open"); armRollover(); });
    dialog.querySelector("[data-token-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { clearTimeout(rolloverTimer); document.body.classList.remove("av-token-profile-open"); trigger.focus(); });
    dialog.addEventListener("keydown", event => event.stopPropagation());
    dialog.querySelector("[data-token-claim]").addEventListener("click", () => void submit({ type: "claim" }));
    dialog.querySelector("[data-token-effect]").addEventListener("change", event => void submit({ type: "preference", enabled: event.target.checked }));
    refresh(); void submit({ type: "init" });
  }
  window.addEventListener("arcadeverse:game-launched", () => { if (reducedMotion.matches) return; const value = read(storage()); if (value.ok && value.value?.effect) void submit({ type: "spend" }).then(result => { if (result.ok && result.changed) coinEffect(); }); });
  window.addEventListener("storage", event => { if (event.key === KEY || event.key === null) refresh(); });
  window.addEventListener("pageshow", event => { if (event.persisted) { refresh(); if (dialog?.open) armRollover(); } });
  window.addEventListener("focus", () => { refresh(); if (dialog?.open) armRollover(); });
  reducedMotion.addEventListener?.("change", refresh);
  window.addEventListener("pagehide", () => { clearTimeout(effectTimer); clearTimeout(rolloverTimer); effectNode?.remove(); });
  window.ArcadeTokens = { snapshot: () => read(storage()), claim: () => submit({ type: "claim" }), redeem: id => submit({ type: "redeem", id }), equip: (slot, id) => submit({ type: "equip", slot, id }), setEffect: enabled => submit({ type: "preference", enabled }) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
