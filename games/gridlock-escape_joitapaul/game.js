const boardElement = document.getElementById("board");
const movesElement = document.getElementById("moves");
const messageElement = document.getElementById("message");
const initialVehicles = [
  { id: "P", row: 2, col: 0, length: 2, axis: "horizontal", color: "player" },
  { id: "A", row: 0, col: 0, length: 2, axis: "horizontal", color: "color-1" },
  { id: "B", row: 0, col: 2, length: 2, axis: "vertical", color: "color-2" },
  { id: "C", row: 1, col: 5, length: 2, axis: "vertical", color: "color-3" },
  { id: "D", row: 3, col: 0, length: 3, axis: "horizontal", color: "color-4" },
  { id: "E", row: 2, col: 3, length: 2, axis: "vertical", color: "color-1" },
  { id: "F", row: 4, col: 1, length: 2, axis: "horizontal", color: "color-2" },
  { id: "G", row: 0, col: 4, length: 2, axis: "vertical", color: "color-3" },
  { id: "H", row: 5, col: 3, length: 2, axis: "horizontal", color: "color-4" }
];

let vehicles;
let selectedId = "P";
let moves = 0;
let solved = false;

function resetGame() {
  vehicles = initialVehicles.map((vehicle) => ({ ...vehicle, offset: 0 }));
  selectedId = "P";
  moves = 0;
  solved = false;
  movesElement.textContent = moves;
  messageElement.textContent = "Select a car, then move it with the arrow keys.";
  render();
}

function vehicleCells(vehicle, offset = vehicle.offset) {
  const cells = [];
  for (let step = 0; step < vehicle.length; step++) {
    cells.push(vehicle.axis === "horizontal"
      ? { row: vehicle.row, col: vehicle.col + offset + step }
      : { row: vehicle.row + offset + step, col: vehicle.col });
  }
  return cells;
}

function canMove(vehicle, offset) {
  const cells = vehicleCells(vehicle, offset);
  if (cells.some(({ row, col }) => row < 0 || row >= 6 || col < 0 || col >= 6)) return false;
  return vehicles.every((other) => other.id === vehicle.id ||
    !vehicleCells(other).some((occupied) =>
      cells.some((cell) => cell.row === occupied.row && cell.col === occupied.col)
    )
  );
}

function moveSelected(direction) {
  if (solved) return;
  const vehicle = vehicles.find((item) => item.id === selectedId);
  if (!vehicle) return;
  const requestedAxis = vehicle.axis === "horizontal" ? "horizontal" : "vertical";
  const isAllowedDirection = requestedAxis === "horizontal"
    ? (direction === "left" || direction === "right")
    : (direction === "up" || direction === "down");
  if (!isAllowedDirection) return;

  const step = direction === "left" || direction === "up" ? -1 : 1;
  const nextOffset = vehicle.offset + step;
  if (vehicle.id === "P" && direction === "right" && vehicle.col + vehicle.offset + vehicle.length === 6) {
    solved = true;
    moves++;
    movesElement.textContent = moves;
    messageElement.textContent = `Escape successful in ${moves} moves! Reset the grid to play again.`;
    return;
  }
  if (!canMove(vehicle, nextOffset)) return;

  vehicle.offset = nextOffset;
  moves++;
  movesElement.textContent = moves;
  render();
}

function render() {
  boardElement.replaceChildren();
  for (let index = 0; index < 36; index++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridRow = String(Math.floor(index / 6) + 1);
    cell.style.gridColumn = String(index % 6 + 1);
    cell.setAttribute("role", "presentation");
    boardElement.appendChild(cell);
  }

  vehicles.forEach((vehicle) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `vehicle ${vehicle.axis}${vehicle.id === "P" ? " player" : ` ${vehicle.color}`}${vehicle.id === selectedId ? " selected" : ""}`;
    element.textContent = vehicle.id === "P" ? "↗" : vehicle.id;
    element.setAttribute("aria-label", `${vehicle.id === "P" ? "Getaway car" : `Car ${vehicle.id}`}, ${vehicle.axis}`);
    const startRow = vehicle.row + (vehicle.axis === "vertical" ? vehicle.offset : 0);
    const startCol = vehicle.col + (vehicle.axis === "horizontal" ? vehicle.offset : 0);
    element.style.gridRow = `${startRow + 1} / span ${vehicle.axis === "vertical" ? vehicle.length : 1}`;
    element.style.gridColumn = `${startCol + 1} / span ${vehicle.axis === "horizontal" ? vehicle.length : 1}`;
    element.addEventListener("click", () => {
      selectedId = vehicle.id;
      messageElement.textContent = vehicle.axis === "horizontal"
        ? "Move this car left or right."
        : "Move this car up or down.";
      render();
    });
    boardElement.appendChild(element);
  });

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedId);
  document.querySelectorAll("[data-move]").forEach((button) => {
    const isForward = Number(button.dataset.move) > 0;
    const label = selectedVehicle.axis === "horizontal"
      ? (isForward ? "right" : "left")
      : (isForward ? "down" : "up");
    button.textContent = label === "left" ? "←"
      : label === "right" ? "→"
        : label === "up" ? "↑" : "↓";
    button.setAttribute("aria-label", `Move selected car ${label}`);
  });
}

document.addEventListener("keydown", (event) => {
  const keys = {
    ArrowLeft: "left", ArrowRight: "right",
    ArrowUp: "up", ArrowDown: "down"
  };
  if (keys[event.key]) {
    event.preventDefault();
    moveSelected(keys[event.key]);
  }
});
document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => {
    const vehicle = vehicles.find((item) => item.id === selectedId);
    if (!vehicle) return;
    moveSelected(vehicle.axis === "horizontal"
      ? (Number(button.dataset.move) < 0 ? "left" : "right")
      : (Number(button.dataset.move) < 0 ? "up" : "down"));
  });
});
document.getElementById("restart").addEventListener("click", resetGame);
resetGame();
