const canvas = document.getElementById("pinball-table");
const context = canvas.getContext("2d");
const scoreValue = document.getElementById("score-value");
const bestValue = document.getElementById("best-value");
const ballsValue = document.getElementById("balls-value");
const overlay = document.getElementById("game-overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");
const launchButton = document.getElementById("launch-button");
const leftButton = document.getElementById("left-flipper");
const rightButton = document.getElementById("right-flipper");

if (!canvas || !context || !scoreValue || !bestValue || !ballsValue ||
    !overlay || !overlayKicker || !overlayTitle || !overlayMessage ||
    !startButton || !launchButton || !leftButton || !rightButton) {
  throw new Error("Quantum Pinball could not find all required game elements.");
}

const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundIconOn = document.getElementById("sound-icon-on");
const soundIconOff = document.getElementById("sound-icon-off");

let soundEnabled = true;
let audioCtx = null;

try {
  const saved = localStorage.getItem("quantum-pinball-sound-enabled");
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

function playFlipperSound() {
  playTone(850, "triangle", 0.04, 0.15);
}

function playBumperSound(points) {
  const freq = points >= 250 ? 920 : (points >= 150 ? 740 : 580);
  playTone(freq, "sine", 0.12, 0.2);
}

function playTargetSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  [659, 1046].forEach((f, i) => {
    setTimeout(() => playTone(f, "triangle", 0.1, 0.16), i * 50);
  });
}

function playLaunchSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (_) {}
}

function playDrainSound() {
  playTone(180, "sawtooth", 0.25, 0.2);
}

function playGameOverSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  [440, 392, 349, 293, 220].forEach((f, i) => {
    setTimeout(() => playTone(f, "sawtooth", 0.2, 0.18), i * 90);
  });
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem("quantum-pinball-sound-enabled", String(soundEnabled));
    } catch (_) {}
    updateSoundUI();
    if (soundEnabled) playFlipperSound();
  });
}

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BALL_RADIUS = 9;
const GRAVITY = 540;
const WALL_LEFT = 38;
const WALL_RIGHT = 562;
const BEST_SCORE_KEY = "quantum-pinball-reactor-run-best";
const bumpers = [
  { x: 188, y: 205, radius: 31, points: 100 },
  { x: 358, y: 205, radius: 31, points: 100 },
  { x: 275, y: 316, radius: 36, points: 250 },
  { x: 155, y: 388, radius: 24, points: 150 },
  { x: 405, y: 388, radius: 24, points: 150 }
];
const targets = [
  { x: 120, y: 500, radius: 13, points: 500, active: true },
  { x: 480, y: 500, radius: 13, points: 500, active: true },
  { x: 300, y: 448, radius: 14, points: 500, active: true }
];
const flippers = {
  left: { x: 213, y: 674, length: 106, restAngle: -0.18, activeAngle: -0.78, pressed: false },
  right: { x: 387, y: 674, length: 106, restAngle: Math.PI + 0.18, activeAngle: Math.PI + 0.78, pressed: false }
};
const keysDown = new Set();

let ball = null;
let score = 0;
let remainingBalls = 3;
let gameState = "ready";
let previousFrame = 0;
let bestScore = readBestScore();

bestValue.textContent = bestScore;

function readBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch (error) {
    console.warn("Unable to read saved Quantum Pinball high score.", error);
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch (error) {
    console.warn("Unable to save Quantum Pinball high score.", error);
  }
}

function updateScore(points) {
  score += points;
  scoreValue.textContent = score;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "ARCADEVERSE_GAME_SCORE",
        score: score
      }, "*");
    }
  } catch (_) {}
}

function resetTargets() {
  targets.forEach((target) => {
    target.active = true;
  });
}

function placeBallInShooterLane() {
  ball = { x: 520, y: 718, vx: 0, vy: 0, launched: false };
}

function startGame() {
  score = 0;
  remainingBalls = 3;
  resetTargets();
  placeBallInShooterLane();
  scoreValue.textContent = "0";
  ballsValue.textContent = remainingBalls;
  gameState = "playing";
  overlay.classList.add("is-hidden");
  launchButton.disabled = false;
}

function launchBall() {
  if (gameState !== "playing" || !ball || ball.launched) return;
  ball.launched = true;
  ball.vx = -65;
  ball.vy = -640;
  playLaunchSound();
  launchButton.textContent = "Ball launched";
}

function loseBall() {
  remainingBalls--;
  ballsValue.textContent = remainingBalls;

  if (remainingBalls <= 0) {
    gameState = "over";
    playGameOverSound();
    if (score > bestScore) {
      bestScore = score;
      bestValue.textContent = bestScore;
      saveBestScore();
    }
    overlayKicker.textContent = "REACTOR RUN COMPLETE";
    overlayTitle.textContent = `Score: ${score}`;
    overlayMessage.textContent = "The reactor has cooled. Start a new run and beat your high score.";
    startButton.textContent = "Play again";
    overlay.classList.remove("is-hidden");

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_SCORE",
          score: score
        }, "*");
        window.parent.postMessage({
          type: "ARCADEVERSE_GAME_OVER",
          score: score,
          details: {
            score: score
          }
        }, "*");
      }
    } catch (_) {}

    return;
  }

  playDrainSound();
  placeBallInShooterLane();
  launchButton.textContent = "Launch ball";
}

function getFlipperTip(flipper) {
  const angle = flipper.pressed ? flipper.activeAngle : flipper.restAngle;
  return {
    x: flipper.x + Math.cos(angle) * flipper.length,
    y: flipper.y + Math.sin(angle) * flipper.length
  };
}

function collideWithCircle(circle, isTarget) {
  if (!ball || !circle.active && isTarget) return;
  const dx = ball.x - circle.x;
  const dy = ball.y - circle.y;
  const minDistance = BALL_RADIUS + circle.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minDistance * minDistance || distanceSquared === 0) return;

  const distance = Math.sqrt(distanceSquared);
  const nx = dx / distance;
  const ny = dy / distance;
  ball.x = circle.x + nx * minDistance;
  ball.y = circle.y + ny * minDistance;
  const incoming = ball.vx * nx + ball.vy * ny;
  if (incoming < 0) {
    ball.vx -= 1.85 * incoming * nx;
    ball.vy -= 1.85 * incoming * ny;
  }
  ball.vy -= isTarget ? 55 : 90;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 15) {
    ball.vy += 45; // Downward gravity nudge
    ball.vx += (Math.random() - 0.5) * 30;
  }

  if (isTarget) {
    circle.active = false;
    updateScore(circle.points);
    playTargetSound();
  } else {
    updateScore(circle.points);
    playBumperSound(circle.points);
  }
}

function collideWithFlipper(flipper) {
  if (!ball) return;
  const tip = getFlipperTip(flipper);
  const dx = tip.x - flipper.x;
  const dy = tip.y - flipper.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = Math.max(0, Math.min(1, ((ball.x - flipper.x) * dx + (ball.y - flipper.y) * dy) / lengthSquared));
  const nearestX = flipper.x + projection * dx;
  const nearestY = flipper.y + projection * dy;
  const diffX = ball.x - nearestX;
  const diffY = ball.y - nearestY;
  const distance = Math.hypot(diffX, diffY);
  const collisionRadius = BALL_RADIUS + 7;
  if (distance >= collisionRadius || distance === 0) return;

  const nx = diffX / distance;
  const ny = diffY / distance;
  ball.x = nearestX + nx * collisionRadius;
  ball.y = nearestY + ny * collisionRadius;
  const incoming = ball.vx * nx + ball.vy * ny;
  if (incoming < 0) {
    ball.vx -= 1.75 * incoming * nx;
    ball.vy -= 1.75 * incoming * ny;
  }
  if (flipper.pressed) {
    ball.vy = Math.min(ball.vy, -480 - Math.abs(ball.vx) * 0.1);
    ball.vx += flipper === flippers.left ? 90 : -90;
    updateScore(10);
  }
}

function update(delta) {
  flippers.left.pressed = keysDown.has("ArrowLeft") || keysDown.has("a") || keysDown.has("A") || flippers.left.pressed;
  flippers.right.pressed = keysDown.has("ArrowRight") || keysDown.has("d") || keysDown.has("D") || flippers.right.pressed;

  if (gameState !== "playing" || !ball || !ball.launched) return;

  ball.vy += GRAVITY * delta;
  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  if (ball.x - BALL_RADIUS < WALL_LEFT) {
    ball.x = WALL_LEFT + BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * 0.82;
  }
  if (ball.x + BALL_RADIUS > WALL_RIGHT) {
    ball.x = WALL_RIGHT - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx) * 0.82;
  }
  if (ball.y - BALL_RADIUS < 42) {
    ball.y = 42 + BALL_RADIUS;
    ball.vy = Math.abs(ball.vy) * 0.78;
  }

  bumpers.forEach((bumper) => collideWithCircle(bumper, false));
  targets.forEach((target) => collideWithCircle(target, true));
  collideWithFlipper(flippers.left);
  collideWithFlipper(flippers.right);

  if (ball.y > HEIGHT + BALL_RADIUS) loseBall();

  const maxSpeed = 900;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > maxSpeed) {
    ball.vx = ball.vx / speed * maxSpeed;
    ball.vy = ball.vy / speed * maxSpeed;
  }
}

function drawRoundedRect(x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 3;
    context.stroke();
  }
}

function drawTable() {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#101a2c");
  background.addColorStop(1, "#080d18");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.shadowColor = "#22c9ff";
  context.shadowBlur = 18;
  drawRoundedRect(30, 28, 540, 744, 34, "rgba(12, 20, 36, 0.8)", "#2087c0");
  context.restore();

  context.strokeStyle = "rgba(85, 150, 204, 0.28)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(72, 145);
  context.lineTo(210, 94);
  context.lineTo(390, 94);
  context.lineTo(528, 145);
  context.stroke();

  context.fillStyle = "rgba(87, 209, 255, 0.15)";
  context.fillRect(62, 110, 476, 4);

  drawShooterLane();
  drawTargets();
  drawBumpers();
  drawGuideRails();
  drawFlipper(flippers.left);
  drawFlipper(flippers.right);
  if (ball) drawBall();
}

function drawShooterLane() {
  context.fillStyle = "rgba(34, 100, 149, 0.18)";
  context.fillRect(492, 145, 44, 570);
  context.strokeStyle = "rgba(76, 169, 221, 0.55)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(492, 145);
  context.lineTo(492, 715);
  context.moveTo(536, 145);
  context.lineTo(536, 715);
  context.stroke();
  context.fillStyle = "rgba(70, 200, 255, 0.75)";
  context.font = "700 15px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.fillText("REACTOR", 514, 174);
}

function drawBumpers() {
  bumpers.forEach((bumper, index) => {
    const color = index === 2 ? "#c46cff" : "#48cfff";
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 24;
    context.beginPath();
    context.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(24, 49, 78, 0.95)";
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = color;
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#e5f9ff";
    context.font = `700 ${index === 2 ? 18 : 14}px Segoe UI, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(index === 2 ? "CORE" : "×2", bumper.x, bumper.y);
    context.restore();
  });
}

function drawTargets() {
  targets.forEach((target, index) => {
    context.save();
    context.shadowColor = target.active ? "#ffd65a" : "#536075";
    context.shadowBlur = target.active ? 18 : 0;
    context.beginPath();
    context.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    context.fillStyle = target.active ? "#ffc857" : "#374357";
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = target.active ? "#fff0a6" : "#617087";
    context.stroke();
    context.restore();
    context.fillStyle = "#e9effb";
    context.font = "700 11px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText(`T${index + 1}`, target.x, target.y - 22);
  });
}

function drawGuideRails() {
  context.strokeStyle = "rgba(94, 151, 199, 0.52)";
  context.lineWidth = 6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(65, 468);
  context.lineTo(118, 555);
  context.moveTo(535, 468);
  context.lineTo(482, 555);
  context.moveTo(62, 566);
  context.lineTo(116, 620);
  context.moveTo(538, 566);
  context.lineTo(484, 620);
  context.stroke();

  context.strokeStyle = "rgba(255, 104, 159, 0.7)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(178, 586);
  context.lineTo(422, 586);
  context.stroke();
}

function drawFlipper(flipper) {
  const tip = getFlipperTip(flipper);
  context.save();
  context.lineCap = "round";
  context.strokeStyle = flipper.pressed ? "#fff2b0" : "#ff8e70";
  context.lineWidth = 17;
  context.shadowColor = flipper.pressed ? "#ffd96a" : "#ff5478";
  context.shadowBlur = flipper.pressed ? 25 : 12;
  context.beginPath();
  context.moveTo(flipper.x, flipper.y);
  context.lineTo(tip.x, tip.y);
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#ffc1a2";
  context.beginPath();
  context.arc(flipper.x, flipper.y, 11, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBall() {
  context.save();
  context.shadowColor = "#e4fcff";
  context.shadowBlur = 18;
  const gradient = context.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, BALL_RADIUS + 2);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.55, "#b9f6ff");
  gradient.addColorStop(1, "#50a9ff");
  context.beginPath();
  context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

function draw() {
  drawTable();
}

function frame(timestamp) {
  const delta = previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.035) : 0;
  previousFrame = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

function setFlipperPressed(side, isPressed) {
  const flipper = side === "left" ? flippers.left : flippers.right;
  if (!flipper.pressed && isPressed) {
    playFlipperSound();
  }
  flipper.pressed = isPressed;
  const button = side === "left" ? leftButton : rightButton;
  button.classList.toggle("is-pressed", isPressed);
}

function bindFlipperButton(button, side) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setFlipperPressed(side, true);
  });
  const release = () => setFlipperPressed(side, false);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

startButton.addEventListener("click", startGame);
launchButton.addEventListener("click", launchBall);
canvas.addEventListener("pointerdown", () => {
  if (gameState === "playing" && ball && !ball.launched) launchBall();
});
bindFlipperButton(leftButton, "left");
bindFlipperButton(rightButton, "right");

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " ", "a", "A", "d", "D"].includes(event.key)) {
    event.preventDefault();
  }
  keysDown.add(event.key);
  if (event.key === " " && gameState === "playing" && ball && !ball.launched) launchBall();
  if (["ArrowLeft", "a", "A"].includes(event.key)) setFlipperPressed("left", true);
  if (["ArrowRight", "d", "D"].includes(event.key)) setFlipperPressed("right", true);
});

document.addEventListener("keyup", (event) => {
  keysDown.delete(event.key);
  if (["ArrowLeft", "a", "A"].includes(event.key)) setFlipperPressed("left", false);
  if (["ArrowRight", "d", "D"].includes(event.key)) setFlipperPressed("right", false);
});

window.addEventListener("blur", () => {
  keysDown.clear();
  setFlipperPressed("left", false);
  setFlipperPressed("right", false);
});

draw();
requestAnimationFrame(frame);
