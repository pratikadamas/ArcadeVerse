/* Alternate catalog renderer: the existing catalog owns filtering and launch. */
(function () {
  "use strict";
  const aisles = ["Action Alley", "Puzzle Promenade", "Retro Row", "Physics Plaza"];
  const columns = 6;
  function aisleFor(game) {
    const text = [game.category || "", ...(Array.isArray(game.tags) ? game.tags : [])].join(" ").toLowerCase();
    if (/physics|simulation|gravity/.test(text)) return 3;
    if (/puzzle|logic|memory|word|math/.test(text)) return 1;
    if (/retro|classic|arcade/.test(text)) return 2;
    return 0;
  }
  function group(games) {
    const result = aisles.map(name => ({ name, games: [] })), seen = new Set();
    for (const game of games) {
      if (!game || typeof game.id !== "string" || !game.id || typeof game.title !== "string" || !game.title || seen.has(game.id)) continue;
      seen.add(game.id); result[aisleFor(game)].games.push(game);
    }
    return result;
  }
  function geometry(groups) {
    const rows = groups.map(item => Math.max(1, Math.ceil(item.games.length / columns)));
    const top = Math.max(rows[0], rows[1]) * 130 + 90, bottom = Math.max(rows[2], rows[3]) * 130 + 90;
    const width = 2 * 680 + 100, height = top + bottom + 170;
    return { width, height, top, bottom, projectedWidth: (width + height) / Math.SQRT2, projectedHeight: (width + height) / Math.SQRT2 / 2 };
  }
  function camera(view, room, next = {}) {
    const width = Math.max(1, view.width), height = Math.max(1, view.height);
    const fit = Math.max(.05, Math.min(.9, (width - 48) / room.projectedWidth, (height - 70) / room.projectedHeight));
    const scale = Math.max(fit * .7, Math.min(1.8, Number.isFinite(next.scale) ? next.scale : fit));
    const boundX = Math.max(0, (room.projectedWidth * scale - width) / 2) + width * .15;
    const boundY = Math.max(0, (room.projectedHeight * scale - height) / 2) + height * .15;
    const clamp = (value, bound) => Math.max(-bound, Math.min(bound, Number.isFinite(value) ? value : 0));
    return { scale, x: clamp(next.x, boundX), y: clamp(next.y, boundY) };
  }
  const model = { aisles, columns, aisleFor, group, geometry, camera };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  if (typeof window === "undefined" || typeof document === "undefined" || window.ArcadeFloor) return;
  let cleanup = () => {};
  function render(container, games) {
    cleanup(); container.replaceChildren();
    const groups = group(games), room = geometry(groups), controller = new AbortController();
    const signal = controller.signal, listen = (node, type, fn, options = {}) => node.addEventListener(type, fn, { ...options, signal });
    const root = document.createElement("section"); root.className = "av-floor"; root.setAttribute("aria-label", "Arcade floor plan");
    root.innerHTML = '<header class="av-floor-header"><div><h3>Arcade Floor Plan</h3><p class="av-floor-instructions">Drag empty carpet to pan. Use zoom buttons or Ctrl + wheel. Tab to a cabinet, arrow keys to explore, Enter to play.</p><p class="av-floor-compact-note">Compact floor plan: choose a cabinet to play.</p></div><div class="av-floor-controls" role="group" aria-label="Floor camera"><button type="button" data-camera="left" aria-label="Pan left">←</button><button type="button" data-camera="right" aria-label="Pan right">→</button><button type="button" data-camera="up" aria-label="Pan up">↑</button><button type="button" data-camera="down" aria-label="Pan down">↓</button><button type="button" data-camera="out" aria-label="Zoom out">−</button><button type="button" data-camera="in" aria-label="Zoom in">+</button><button type="button" data-camera="reset">Fit room</button></div></header><div class="av-floor-stage" role="region" aria-label="Interactive arcade room" tabindex="0"><div class="av-floor-camera"><div class="av-floor-board"></div></div></div><p class="av-floor-status" role="status" aria-live="polite"></p>';
    const stage = root.querySelector(".av-floor-stage"), carrier = root.querySelector(".av-floor-camera"), board = root.querySelector(".av-floor-board"), status = root.querySelector(".av-floor-status");
    board.style.width = room.width + "px"; board.style.height = room.height + "px"; board.style.gridTemplateRows = `${room.top}px ${room.bottom}px`;
    const buttons = [];
    for (let index = 0; index < groups.length; index++) {
      const item = groups[index], section = document.createElement("section"); section.className = "av-floor-aisle"; section.dataset.aisle = String(index);
      const title = document.createElement("h4"); title.textContent = `${item.name} · ${item.games.length}`; section.appendChild(title);
      section.setAttribute("aria-label", item.name);
      const cabinets = document.createElement("div"); cabinets.className = "av-floor-cabinets"; section.appendChild(cabinets);
      if (!item.games.length) { const empty = document.createElement("p"); empty.className = "av-floor-empty"; empty.textContent = "No matching games in this aisle."; cabinets.appendChild(empty); }
      for (const game of item.games) {
        const button = document.createElement("button"); button.type = "button"; button.className = "av-floor-cabinet"; button.dataset.gameId = game.id; button.tabIndex = buttons.length ? -1 : 0; button.setAttribute("aria-label", `Play ${game.title}, ${item.name}`);
        const marquee = document.createElement("span"); marquee.className = "av-floor-marquee"; marquee.textContent = game.title;
        const screen = document.createElement("span"); screen.className = "av-floor-screen"; screen.setAttribute("aria-hidden", "true");
        const controls = document.createElement("span"); controls.className = "av-floor-joystick"; controls.setAttribute("aria-hidden", "true");
        button.append(marquee, screen, controls); cabinets.appendChild(button); buttons.push(button);
        listen(button, "click", () => { if (window.ArcadeApp?.openGame(game.id)) status.textContent = `Opened ${game.title}.`; else status.textContent = "Game launcher is unavailable. Please return to Grid View."; });
        listen(button, "focus", () => {
          for (const other of buttons) other.tabIndex = other === button ? 0 : -1;
          if (compact.matches) return;
          const visible = stage.getBoundingClientRect(), target = button.getBoundingClientRect();
          const dx = target.left < visible.left + 25 ? visible.left + 25 - target.left : target.right > visible.right - 25 ? visible.right - 25 - target.right : 0;
          const dy = target.top < visible.top + 25 ? visible.top + 25 - target.top : target.bottom > visible.bottom - 25 ? visible.bottom - 25 - target.bottom : 0;
          move({ ...position, x: position.x + dx, y: position.y + dy });
        });
        listen(button, "keydown", event => {
          const current = buttons.indexOf(button), steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key in steps ? Math.max(0, Math.min(buttons.length - 1, current + steps[event.key])) : null;
          if (next !== null) { event.preventDefault(); event.stopPropagation(); buttons[next].focus({ preventScroll: !compact.matches }); }
        });
      }
      board.appendChild(section);
    }
    if (!buttons.length) status.textContent = "No games match the current filters. Change the search or filters to fill the room.";
    else status.textContent = `${buttons.length} cabinets from the current catalog filters. Games launch in the existing player.`;
    container.appendChild(root);
    const compact = window.matchMedia("(max-width: 700px)"), reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let position, frame = 0, drag = null;
    function view() { return { width: stage.clientWidth, height: stage.clientHeight }; }
    function paint() { frame = 0; carrier.style.transform = `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${position.scale})`; }
    function move(next = {}) { position = camera(view(), room, next); if (reduced.matches) { if (frame) cancelAnimationFrame(frame); paint(); } else if (!frame) frame = requestAnimationFrame(paint); }
    function fit() { move(); }
    function operate(action) {
      const next = { ...position };
      if (action === "reset") return fit();
      if (action === "in" || action === "out") next.scale *= action === "in" ? 1.2 : 1 / 1.2;
      if (action === "left") next.x += 80; if (action === "right") next.x -= 80;
      if (action === "up") next.y += 60; if (action === "down") next.y -= 60;
      move(next);
    }
    for (const control of root.querySelectorAll("[data-camera]")) listen(control, "click", () => operate(control.dataset.camera));
    listen(stage, "pointerdown", event => {
      if (compact.matches || event.button !== 0 || event.target.closest("button")) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
      stage.setPointerCapture(event.pointerId); stage.classList.add("is-panning");
    });
    listen(stage, "pointermove", event => { if (drag?.id === event.pointerId) move({ ...position, x: drag.startX + event.clientX - drag.x, y: drag.startY + event.clientY - drag.y }); });
    const endDrag = event => { if (drag?.id !== event.pointerId) return; drag = null; if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId); stage.classList.remove("is-panning"); };
    listen(stage, "pointerup", endDrag); listen(stage, "pointercancel", endDrag); listen(stage, "lostpointercapture", endDrag);
    listen(stage, "wheel", event => { if (!compact.matches && event.ctrlKey && event.deltaY) { event.preventDefault(); operate(event.deltaY < 0 ? "in" : "out"); } }, { passive: false });
    listen(stage, "keydown", event => {
      if (event.target !== stage || compact.matches) return;
      const action = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", "+": "in", "=": "in", "-": "out", Home: "reset" }[event.key];
      if (action) { event.preventDefault(); operate(action); }
    });
    const resize = new ResizeObserver(fit); resize.observe(stage); fit();
    cleanup = () => { controller.abort(); resize.disconnect(); if (frame) cancelAnimationFrame(frame); drag = null; cleanup = () => {}; };
    return root;
  }
  window.ArcadeFloor = { render, destroy: () => cleanup(), focusGame: id => {
    for (const button of document.querySelectorAll(".av-floor .av-floor-cabinet")) if (button.dataset.gameId === id) { button.focus(); return true; }
    return false;
  } };
})();
