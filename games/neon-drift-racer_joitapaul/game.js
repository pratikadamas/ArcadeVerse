const canvas = document.getElementById("race-track");
const context = canvas.getContext("2d");
const scoreValue = document.getElementById("score-value");
const bestValue = document.getElementById("best-value");
const energyValue = document.getElementById("energy-value");
const overlay = document.getElementById("game-overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");

if (!canvas || !context || !scoreValue || !bestValue || !energyValue ||
    !overlay || !overlayKicker || !overlayTitle || !overlayMessage || !startButton) {
  throw new Error("Neon Drift Racer could not find all required game elements.");
}

const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundIconOn = document.getElementById("sound-icon-on");
const soundIconOff = document.getElementById("sound-icon-off");

let soundEnabled = true;
let audioCtx = null;

try {
  const saved = localStorage.getItem("neon-drift-racer-sound-enabled");
  if (saved !== null) soundEnabled = saved === "true";
} catch (_) {}

function updateSoundUI() {
  if (!soundIconOn || !soundIconOff) return;
  soundIconOn.classList.toggle("hidden", !soundEnabled);
  soundIconOff.classList.toggle("hidden", soundEnabled);
  if (soundToggleBtn) {
    soundToggleBtn.title = soundEnabled ? "Mute Sound" : "Enable Sound";
  }
}
updateSoundUI();

function initAudio() {
  if (!audioCtx) {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (AudioClass) audioCtx = new AudioClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, type = "sine", duration = 0.08, gainVal = 0.14) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

function playSteerSound(dir) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    const startF = dir > 0 ? 320 : 480;
    const endF = dir > 0 ? 540 : 260;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.07);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (_) {}
}

function playEnergySound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  [659, 987, 1318].forEach((f, i) => {
    setTimeout(() => playTone(f, "sine", 0.09, 0.16), i * 45);
  });
}

function playCrashSound() {
  playTone(130, "sawtooth", 0.25, 0.24);
}

function playStartSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.22);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (_) {}
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem("neon-drift-racer-sound-enabled", String(soundEnabled));
    } catch (_) {}
    updateSoundUI();
    if (soundEnabled) playEnergySound();
  });
}

canvas.addEventListener("pointerdown", (e) => {
  if (gameState !== "running") return;
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  if (clickX < rect.width / 2) {
    steer(-1);
  } else {
    steer(1);
  }
});

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const ROAD_LEFT = 48;
const ROAD_RIGHT = WIDTH - ROAD_LEFT;
const LANE_WIDTH = (ROAD_RIGHT - ROAD_LEFT) / 3;
const LANES = [0, 1, 2].map((lane) => ROAD_LEFT + LANE_WIDTH * (lane + 0.5));
const PLAYER_Y = HEIGHT - 96;
const BEST_SCORE_KEY = "neon-drift-racer-best";

let playerLane = 1;
let playerX = LANES[1];
let driftAngle = 0;
let angularVelocity = 0;
let objects = [];
let score = 0;
let energy = 0;
let elapsed = 0;
let spawnTimer = 0;
let roadOffset = 0;
let gameState = "ready";
let previousFrame = 0;
let bestScore = readBestScore();

bestValue.textContent = bestScore;

function readBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch (error) {
    console.warn("Unable to read the saved Neon Drift Racer high score.", error);
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch (error) {
    console.warn("Unable to save the Neon Drift Racer high score.", error);
  }
}

function startGame() {
  playerLane = 1;
  playerX = LANES[1];
  driftAngle = 0;
  angularVelocity = 0;
  objects = [];
  score = 0;
  energy = 0;
  elapsed = 0;
  spawnTimer = 0.55;
  roadOffset = 0;
  gameState = "running";
  scoreValue.textContent = "0";
  energyValue.textContent = "0";
  overlay.classList.add("is-hidden");
  playStartSound();
}

function finishGame() {
  gameState = "over";
  playCrashSound();
  if (score > bestScore) {
    bestScore = score;
    bestValue.textContent = bestScore;
    saveBestScore();
  }
  overlayKicker.textContent = "RACE OVER";
  overlayTitle.textContent = `Score: ${score}`;
  overlayMessage.textContent = `You collected ${energy} energy orb${energy === 1 ? "" : "s"}. Ready for another run?`;
  startButton.textContent = "Race again";
  overlay.classList.remove("is-hidden");
}

function steer(direction) {
  if (gameState === "running") {
    const nextLane = Math.max(0, Math.min(LANES.length - 1, playerLane + direction));
    if (nextLane !== playerLane) {
      playerLane = nextLane;
      playSteerSound(direction);
    }
  }
}

function spawnObject() {
  const lane = Math.floor(Math.random() * LANES.length);
  const type = Math.random() < 0.28 ? "energy" : "traffic";
  objects.push({ lane, type, y: -55 });
}

function update(delta) {
  if (gameState !== "running") return;

  elapsed += delta;
  const speed = Math.min(255 + elapsed * 11, 570);
  roadOffset = (roadOffset + speed * delta) % 90;
  score = Math.floor(elapsed * 5) + energy * 25;
  scoreValue.textContent = score;

  // Issue #595: Smooth exponential angular momentum and drift damping
  const targetX = LANES[playerLane];
  const deltaX = targetX - playerX;
  playerX += deltaX * Math.min(1, delta * 14);
  const targetAngle = (deltaX / LANE_WIDTH) * 0.35;
  angularVelocity += (targetAngle - driftAngle) * 24 * delta;
  angularVelocity *= 0.88; // Exponential friction decay on zero-throttle
  driftAngle += angularVelocity * delta;

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnObject();
    spawnTimer = Math.max(0.58, 1.12 - elapsed * 0.006) + Math.random() * 0.2;
  }

  objects.forEach((object) => {
    object.y += speed * delta;
  });

  const remaining = [];
  for (const object of objects) {
    const closeToPlayer = Math.abs(object.y - PLAYER_Y) < (object.type === "traffic" ? 48 : 34);
    const inPlayerLane = object.lane === playerLane;

    if (closeToPlayer && inPlayerLane) {
      if (object.type === "traffic") {
        finishGame();
        return;
      }
      energy++;
      score += 25;
      scoreValue.textContent = score;
      energyValue.textContent = energy;
      playEnergySound();
      continue;
    }

    if (object.y < HEIGHT + 60) remaining.push(object);
  }
  objects = remaining;
}

function drawRoad() {
  context.fillStyle = "#090d17";
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "#101827";
  context.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT);

  context.fillStyle = "rgba(62, 169, 255, 0.1)";
  context.fillRect(0, 0, ROAD_LEFT, HEIGHT);
  context.fillRect(ROAD_RIGHT, 0, ROAD_LEFT, HEIGHT);

  context.fillStyle = "#38bdf8";
  context.fillRect(ROAD_LEFT - 2, 0, 2, HEIGHT);
  context.fillRect(ROAD_RIGHT, 0, 2, HEIGHT);

  context.fillStyle = "rgba(148, 163, 184, 0.34)";
  for (let lane = 1; lane < 3; lane++) {
    const x = ROAD_LEFT + LANE_WIDTH * lane;
    for (let y = -90 + roadOffset; y < HEIGHT; y += 90) {
      context.fillRect(x - 2, y, 4, 42);
    }
  }

  context.fillStyle = "rgba(93, 123, 164, 0.35)";
  for (let y = -70 + roadOffset * 0.55; y < HEIGHT; y += 70) {
    context.fillRect(18, y, 7, 22);
    context.fillRect(WIDTH - 25, y, 7, 22);
  }
}

function drawCar(x, y, color, isPlayer, angle = 0) {
  context.save();
  context.translate(x, y);
  if (angle) context.rotate(angle);
  context.shadowColor = color;
  context.shadowBlur = isPlayer ? 22 : 12;

  context.fillStyle = "#080a10";
  context.fillRect(-27, -27, 8, 22);
  context.fillRect(19, -27, 8, 22);
  context.fillRect(-27, 11, 8, 22);
  context.fillRect(19, 11, 8, 22);

  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-18, -34);
  context.quadraticCurveTo(-23, -34, -24, -23);
  context.lineTo(-24, 25);
  context.quadraticCurveTo(-23, 35, -15, 36);
  context.lineTo(15, 36);
  context.quadraticCurveTo(23, 35, 24, 25);
  context.lineTo(24, -23);
  context.quadraticCurveTo(23, -34, 18, -34);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = isPlayer ? "#12243d" : "#471c2a";
  context.beginPath();
  context.moveTo(-15, -16);
  context.lineTo(-10, -27);
  context.lineTo(10, -27);
  context.lineTo(15, -16);
  context.lineTo(13, -5);
  context.lineTo(-13, -5);
  context.closePath();
  context.fill();

  context.fillStyle = isPlayer ? "#b8f2ff" : "#ffd4d4";
  context.fillRect(-17, 25, 8, 4);
  context.fillRect(9, 25, 8, 4);
  context.restore();
}

function drawEnergyOrb(x, y) {
  context.save();
  context.translate(x, y);
  context.shadowColor = "#43d9ff";
  context.shadowBlur = 20;
  context.fillStyle = "#59e1ff";
  context.beginPath();
  context.moveTo(0, -19);
  context.lineTo(16, 0);
  context.lineTo(0, 19);
  context.lineTo(-16, 0);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#e1fbff";
  context.beginPath();
  context.arc(0, 0, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw() {
  drawRoad();
  for (const object of objects) {
    const x = LANES[object.lane];
    if (object.type === "energy") drawEnergyOrb(x, object.y);
    else drawCar(x, object.y, "#fb5368", false);
  }
  drawCar(playerX, PLAYER_Y, "#39c9ff", true, driftAngle);
}

function frame(timestamp) {
  const delta = previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.05) : 0;
  previousFrame = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) {
    event.preventDefault();
  }
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") steer(-1);
  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") steer(1);
});

document.getElementById("left-button").addEventListener("click", () => steer(-1));
document.getElementById("right-button").addEventListener("click", () => steer(1));
startButton.addEventListener("click", startGame);

draw();
requestAnimationFrame(frame);
