const products = [
  { id: "sourdough", name: "Sourdough", icon: "bread" },
  { id: "croissant", name: "Croissant", icon: "croissant" },
  { id: "cinnamon-roll", name: "Cinnamon roll", icon: "roll" },
  { id: "cupcake", name: "Cupcake", icon: "cupcake" },
  { id: "pretzel", name: "Pretzel", icon: "pretzel" },
  { id: "berry-tart", name: "Berry tart", icon: "tart" }
];

const customers = ["Mina", "Theo", "Jules", "Sam", "Ari", "Rory", "Nico", "Lee"];
const productButtons = Array.from(document.querySelectorAll("[data-product]"));
const shiftTimeElement = document.getElementById("shift-time");
const scoreElement = document.getElementById("score");
const ordersFilledElement = document.getElementById("orders-filled");
const strikesElement = document.getElementById("strikes");
const orderNumberElement = document.getElementById("order-number");
const difficultyElement = document.getElementById("difficulty");
const customerNameElement = document.getElementById("customer-name");
const customerAvatarElement = document.querySelector(".customer-avatar");
const patienceTimeElement = document.getElementById("patience-time");
const patienceTrackElement = document.querySelector(".patience-track");
const patienceFillElement = document.getElementById("patience-fill");
const orderItemsElement = document.getElementById("order-items");
const feedbackElement = document.getElementById("feedback");
const trayItemsElement = document.getElementById("tray-items");
const trayCountElement = document.getElementById("tray-count");
const serveButton = document.getElementById("serve-button");
const clearTrayButton = document.getElementById("clear-tray-button");
const pauseButton = document.getElementById("pause-button");
const startOverlay = document.getElementById("start-overlay");
const helpOverlay = document.getElementById("help-overlay");
const pauseOverlay = document.getElementById("pause-overlay");
const gameOverOverlay = document.getElementById("game-over-overlay");

let state = {
  status: "ready",
  shiftTime: 75,
  orderTime: 0,
  orderTimeLimit: 0,
  score: 0,
  correctOrders: 0,
  ordersStarted: 0,
  mistakes: 0,
  streak: 0,
  customer: "",
  order: {},
  tray: {},
  lastTick: performance.now()
};
let resumeAfterHelp = false;
let returnToPause = false;

function getLevel() {
  return 1 + Math.floor(state.correctOrders / 3);
}

function getProduct(productId) {
  return products.find((product) => product.id === productId);
}

function makeIcon(iconName, className = "product-icon") {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  icon.setAttribute("class", className);
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.setAttribute("viewBox", "0 0 48 48");
  use.setAttribute("href", `#icon-${iconName}`);
  icon.appendChild(use);
  return icon;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${remainingSeconds}`;
}

function setFeedback(message, tone = "") {
  feedbackElement.textContent = message;
  feedbackElement.className = `feedback${tone ? ` is-${tone}` : ""}`;
}

function resetTray() {
  state.tray = {};
  renderTray();
}

function buildOrder() {
  const level = getLevel();
  const lineCount = Math.min(level + 1, 5);
  const availableProducts = products.slice();
  state.order = {};
  state.customer = customers[Math.floor(Math.random() * customers.length)];
  state.ordersStarted += 1;

  for (let line = 0; line < lineCount; line += 1) {
    const index = Math.floor(Math.random() * availableProducts.length);
    const [product] = availableProducts.splice(index, 1);
    const canAddExtra = level >= 2 && Math.random() < Math.min(0.25 + level * 0.08, 0.7);
    state.order[product.id] = canAddExtra ? 2 : 1;
  }

  state.orderTimeLimit = Math.max(12, 24 - (level - 1) * 2);
  state.orderTime = state.orderTimeLimit;
  resetTray();
  renderOrder();
}

function startGame() {
  state = {
    status: "playing",
    shiftTime: 75,
    orderTime: 0,
    orderTimeLimit: 0,
    score: 0,
    correctOrders: 0,
    ordersStarted: 0,
    mistakes: 0,
    streak: 0,
    customer: "",
    order: {},
    tray: {},
    lastTick: performance.now()
  };
  startOverlay.hidden = true;
  helpOverlay.hidden = true;
  pauseOverlay.hidden = true;
  gameOverOverlay.hidden = true;
  pauseButton.disabled = false;
  buildOrder();
  setFeedback("New ticket up. Fill the tray to match it exactly.");
  renderStats();
  renderTray();
  document.getElementById("pause-button").focus();
}

function renderOrder() {
  const level = getLevel();
  customerNameElement.textContent = state.customer;
  customerAvatarElement.textContent = state.customer.charAt(0).toUpperCase();
  orderNumberElement.textContent = `#${String(state.ordersStarted).padStart(3, "0")}`;
  difficultyElement.textContent = `LEVEL ${String(level).padStart(2, "0")}`;
  orderItemsElement.replaceChildren();

  products.forEach((product) => {
    const quantity = state.order[product.id];
    if (!quantity) return;

    const item = document.createElement("li");
    const label = document.createElement("span");
    const count = document.createElement("span");
    item.className = "order-line";
    item.appendChild(makeIcon(product.icon));
    label.textContent = product.name;
    count.className = "order-quantity";
    count.textContent = `x ${quantity}`;
    item.append(label, count);
    orderItemsElement.appendChild(item);
  });
}

function renderStats() {
  shiftTimeElement.textContent = formatTime(state.shiftTime);
  scoreElement.textContent = String(state.score).padStart(4, "0");
  ordersFilledElement.textContent = String(state.correctOrders);
  strikesElement.textContent = `${state.mistakes} / 3`;
  patienceTimeElement.textContent = state.orderTime > 0 ? `${Math.ceil(state.orderTime)}s` : "--";

  const patienceRatio = state.orderTimeLimit > 0
    ? Math.max(0, Math.min(100, (state.orderTime / state.orderTimeLimit) * 100))
    : 100;
  patienceFillElement.style.width = `${patienceRatio}%`;
  patienceTrackElement.setAttribute("aria-valuenow", String(Math.round(patienceRatio)));
  patienceTrackElement.classList.toggle("is-low", patienceRatio <= 30);
  document.querySelector(".timer-stat").classList.toggle("is-low", state.shiftTime <= 15);
  pauseButton.disabled = state.status !== "playing" && state.status !== "paused";
}

function renderTray() {
  const totalItems = Object.values(state.tray).reduce((sum, quantity) => sum + quantity, 0);
  trayCountElement.textContent = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
  trayItemsElement.replaceChildren();

  if (totalItems === 0) {
    const empty = document.createElement("span");
    empty.className = "tray-empty";
    empty.textContent = "Choose baked goods from the counter.";
    trayItemsElement.appendChild(empty);
  } else {
    products.forEach((product) => {
      const quantity = state.tray[product.id];
      if (!quantity) return;

      const chip = document.createElement("button");
      const amount = document.createElement("span");
      chip.type = "button";
      chip.className = "tray-chip";
      chip.setAttribute("aria-label", `Remove one ${product.name} from tray`);
      chip.addEventListener("click", () => removeProduct(product.id));
      chip.appendChild(makeIcon(product.icon));
      chip.append(document.createTextNode(product.name));
      amount.textContent = `x ${quantity}`;
      chip.appendChild(amount);
      trayItemsElement.appendChild(chip);
    });
  }

  productButtons.forEach((button) => {
    const quantity = state.tray[button.dataset.product] || 0;
    button.disabled = state.status !== "playing";
    button.classList.toggle("is-selected", quantity > 0);
    button.setAttribute("aria-pressed", String(quantity > 0));
    button.querySelector(".product-qty").textContent = quantity ? String(quantity) : "";
  });

  serveButton.disabled = state.status !== "playing" || totalItems === 0;
  clearTrayButton.disabled = state.status !== "playing" || totalItems === 0;
}

function addProduct(productId) {
  if (state.status !== "playing" || !getProduct(productId)) return;
  state.tray[productId] = (state.tray[productId] || 0) + 1;
  renderTray();
  setFeedback(`${getProduct(productId).name} added to your tray.`);
}

function removeProduct(productId) {
  if (state.status !== "playing" || !state.tray[productId]) return;
  state.tray[productId] -= 1;
  if (state.tray[productId] === 0) delete state.tray[productId];
  renderTray();
  setFeedback(`One ${getProduct(productId).name} removed from your tray.`);
}

function trayMatchesOrder() {
  return products.every((product) =>
    (state.tray[product.id] || 0) === (state.order[product.id] || 0)
  );
}

function finishGame(reason) {
  if (state.status === "over") return;
  state.status = "over";
  pauseButton.disabled = true;
  gameOverOverlay.hidden = false;
  document.getElementById("game-over-summary").textContent =
    `${reason} You filled ${state.correctOrders} ${state.correctOrders === 1 ? "order" : "orders"} and earned ${state.score} points.`;
  document.getElementById("play-again-button").focus();
  renderStats();
  renderTray();
}

function registerMiss(message, orderExpired = false) {
  state.mistakes += 1;
  state.streak = 0;
  state.shiftTime = Math.max(0, state.shiftTime - 4);
  resetTray();

  if (state.mistakes >= 3 || state.shiftTime <= 0) {
    finishGame(state.mistakes >= 3 ? "Three orders were missed." : "The shift timer ran out.");
    return;
  }

  if (orderExpired) {
    setFeedback(message, "error");
    buildOrder();
  } else {
    state.orderTime = Math.max(0, state.orderTime - 4);
    setFeedback(message, "error");
    if (state.orderTime === 0) {
      setFeedback("The customer ran out of patience. A new ticket is up.", "error");
      buildOrder();
    }
  }
  renderStats();
  renderTray();
}

function serveOrder() {
  if (state.status !== "playing" || Object.keys(state.tray).length === 0) return;

  if (!trayMatchesOrder()) {
    registerMiss("That tray does not match the ticket. Check the counts and try again.");
    return;
  }

  const speedBonus = Math.ceil(state.orderTime) * 3;
  const streakBonus = state.streak * 20;
  const earned = 100 + speedBonus + streakBonus;
  state.correctOrders += 1;
  state.streak += 1;
  state.score += earned;
  state.shiftTime = Math.min(75, state.shiftTime + 3);
  buildOrder();
  setFeedback(`Order served. +${earned} points${streakBonus ? " including your streak bonus" : ""}.`, "success");
  renderStats();
  renderTray();
}

function pauseGame() {
  if (state.status !== "playing") return;
  state.status = "paused";
  pauseOverlay.hidden = false;
  renderStats();
  document.getElementById("resume-button").focus();
}

function resumeGame() {
  if (state.status !== "paused") return;
  state.status = "playing";
  state.lastTick = performance.now();
  pauseOverlay.hidden = true;
  renderStats();
  renderTray();
  pauseButton.focus();
}

function showHelp() {
  if (state.status === "playing") {
    resumeAfterHelp = true;
    returnToPause = false;
    state.status = "paused";
    renderStats();
  } else {
    resumeAfterHelp = false;
    returnToPause = state.status === "paused";
  }
  pauseOverlay.hidden = true;
  helpOverlay.hidden = false;
  document.getElementById("close-help-button").focus();
}

function closeHelp() {
  helpOverlay.hidden = true;
  if (resumeAfterHelp && state.status === "paused") {
    state.status = "playing";
    state.lastTick = performance.now();
  } else if (returnToPause && state.status === "paused") {
    pauseOverlay.hidden = false;
  }
  resumeAfterHelp = false;
  returnToPause = false;
  renderStats();
  renderTray();
  if (state.status === "playing") pauseButton.focus();
  else if (state.status === "paused") document.getElementById("resume-button").focus();
  else document.getElementById("start-button").focus();
}

function updateTimers() {
  if (state.status !== "playing") return;

  const now = performance.now();
  const elapsed = Math.max(0, (now - state.lastTick) / 1000);
  state.lastTick = now;
  state.shiftTime = Math.max(0, state.shiftTime - elapsed);
  state.orderTime = Math.max(0, state.orderTime - elapsed);

  if (state.shiftTime === 0) {
    finishGame("The shift timer ran out.");
  } else if (state.orderTime === 0) {
    registerMiss("The customer ran out of patience. A new ticket is up.", true);
  } else {
    renderStats();
  }
}

function handleKeydown(event) {
  if (event.repeat) return;

  if (/^[1-6]$/.test(event.key)) {
    event.preventDefault();
    addProduct(products[Number(event.key) - 1].id);
    return;
  }

  if (!helpOverlay.hidden) {
    if (event.key === "Escape") closeHelp();
    return;
  }

  if (event.key === "Escape" || event.key.toLowerCase() === "p") {
    if (state.status === "playing") pauseGame();
    else if (state.status === "paused") resumeGame();
    return;
  }

  if (event.key.toLowerCase() === "r") {
    startGame();
    return;
  }

  const targetIsButton = event.target instanceof Element && event.target.closest("button");
  if (event.key === "Enter" && !targetIsButton) {
    event.preventDefault();
    serveOrder();
  }
}

productButtons.forEach((button) => {
  button.addEventListener("click", () => addProduct(button.dataset.product));
});
document.getElementById("start-button").addEventListener("click", startGame);
document.getElementById("play-again-button").addEventListener("click", startGame);
document.getElementById("restart-button").addEventListener("click", startGame);
document.getElementById("paused-restart-button").addEventListener("click", startGame);
document.getElementById("pause-button").addEventListener("click", pauseGame);
document.getElementById("resume-button").addEventListener("click", resumeGame);
document.getElementById("help-button").addEventListener("click", showHelp);
document.getElementById("close-help-button").addEventListener("click", closeHelp);
document.getElementById("clear-tray-button").addEventListener("click", () => {
  if (state.status !== "playing") return;
  resetTray();
  setFeedback("Tray cleared. Choose the items on the ticket.");
});
serveButton.addEventListener("click", serveOrder);
document.addEventListener("keydown", handleKeydown);

renderStats();
renderTray();
window.setInterval(updateTimers, 100);
