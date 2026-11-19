const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const bestScoreElement = document.getElementById("best-score");
const powerUpElement = document.getElementById("power-up-status");
const overlay = document.getElementById("game-overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");
const resetBestButton = document.getElementById("reset-best");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundIconOn = document.getElementById("sound-icon-on");
const soundIconOff = document.getElementById("sound-icon-off");

let soundEnabled = true;
let audioCtx = null;

try {
  const savedSound = localStorage.getItem("neon-asteroid-sound-enabled");
  if (savedSound !== null) soundEnabled = savedSound === "true";
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

function playOrbSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (_) {}
}

function playPowerUpSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  [587, 740, 880, 1174].forEach((f, i) => {
    setTimeout(() => playTone(f, "triangle", 0.12, 0.16), i * 50);
  });
}

function playDamageSound() {
  playTone(160, "sawtooth", 0.18, 0.22);
}

function playShieldBreakSound() {
  playTone(320, "square", 0.14, 0.18);
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
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.25);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch (_) {}
}

function playGameOverSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  [440, 370, 311, 220, 146].forEach((f, i) => {
    setTimeout(() => playTone(f, "sawtooth", 0.22, 0.2), i * 110);
  });
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem("neon-asteroid-sound-enabled", String(soundEnabled));
    } catch (_) {}
    updateSoundUI();
    if (soundEnabled) playOrbSound();
  });
}

function renderLives(count) {
  const heartSvg = '<svg class="heart-icon active" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  const emptyHeartSvg = '<svg class="heart-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" opacity="0.3" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  let html = "";
  for (let i = 0; i < 3; i++) {
    html += i < count ? heartSvg : emptyHeartSvg;
  }
  return html;
}

let thrusterOscillator = null;
let thrusterGain = null;

function setThrusterAudio(active) {
  if (!soundEnabled) {
    stopThrusterAudio();
    return;
  }
  initAudio();
  if (!audioCtx) return;

  if (active) {
    if (!thrusterOscillator) {
      try {
        thrusterOscillator = audioCtx.createOscillator();
        thrusterGain = audioCtx.createGain();
        thrusterOscillator.type = "triangle";
        thrusterOscillator.frequency.setValueAtTime(80, audioCtx.currentTime);
        thrusterGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        thrusterOscillator.connect(thrusterGain);
        thrusterGain.connect(audioCtx.destination);
        thrusterOscillator.start();
      } catch (_) {}
    }
  } else {
    stopThrusterAudio();
  }
}

function stopThrusterAudio() {
  if (thrusterOscillator) {
    try {
      thrusterOscillator.stop();
      thrusterOscillator.disconnect();
    } catch (_) {}
    thrusterOscillator = null;
    thrusterGain = null;
  }
}

let particles = [];
const MAX_PARTICLES = 150;
let warpActive = false;
let warpTimer = 0;

function triggerWarpJump() {
  if (warpActive) return;
  warpActive = true;
  warpTimer = 0.6;
  particles.length = 0;
  stopThrusterAudio();
  playWarpSound();
}

function playWarpSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (_) {}
}

function spawnThrusterParticle(x, y) {
  if (warpActive) return;
  if (particles.length >= MAX_PARTICLES) {
    particles.shift();
  }
  particles.push({
    x: x + (Math.random() - 0.5) * 8,
    y: y + player.radius * 0.7,
    vx: (Math.random() - 0.5) * 20,
    vy: Math.random() * 50 + 70,
    radius: Math.random() * 3 + 2,
    alpha: 0.9,
    color: Math.random() > 0.4 ? "#59e6ff" : "#bd00ff"
  });
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.alpha -= delta * 2.2;
    p.radius = Math.max(0, p.radius - delta * 2);
    if (p.alpha <= 0 || p.radius <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  context.save();
  particles.forEach((p) => {
    context.globalAlpha = Math.max(0, p.alpha);
    context.fillStyle = p.color;
    context.shadowColor = p.color;
    context.shadowBlur = 8;
    context.beginPath();
    context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}
const height = canvas.height;
const directions = { up: false, down: false, left: false, right: false };
const keys = new Map([
  ["ArrowUp", "up"], ["w", "up"], ["W", "up"],
  ["ArrowDown", "down"], ["s", "down"], ["S", "down"],
  ["ArrowLeft", "left"], ["a", "left"], ["A", "left"],
  ["ArrowRight", "right"], ["d", "right"], ["D", "right"]
]);
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * width,
  y: Math.random() * height,
  radius: Math.random() * 1.5 + 0.4,
  alpha: Math.random() * 0.7 + 0.2
}));
const player = { x: width / 2, y: height - 70, radius: 15, speed: 290 };

let asteroids = [];
let energyOrbs = [];
let powerUps = [];
let score = 0;
let lives = 3;
let bestScore = readBestScore();
let elapsed = 0;
let asteroidTimer = 0;
let orbTimer = 0;
let powerUpTimer = 0;
let lastFrame = 0;
let animationFrame = 0;
let gameState = "ready";
let invulnerableTime = 0;
let activePowerUp = null;
let powerUpTime = 0;

bestScoreElement.textContent = String(bestScore);
drawScene();

function readBestScore() {
  try {
    return Number(localStorage.getItem("neon-asteroid-escape-best")) || 0;
  } catch (error) {
    console.warn("Could not read the saved best score.", error);
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem("neon-asteroid-escape-best", String(value));
  } catch (error) {
    console.warn("Could not save the best score.", error);
  }
}

function startGame() {
  cancelAnimationFrame(animationFrame);
  score = 0;
  lives = 3;
  elapsed = 0;
  asteroidTimer = 0;
  orbTimer = 0;
  powerUpTimer = 0;
  invulnerableTime = 0;
  activePowerUp = null;
  powerUpTime = 0;
  warpActive = false;
  warpTimer = 0;
  particles.length = 0;
  stopThrusterAudio();
  asteroids = [];
  energyOrbs = [];
  powerUps = [];
  player.x = width / 2;
  player.y = height - 70;
  Object.keys(directions).forEach((direction) => {
    directions[direction] = false;
  });
  gameState = "running";
  updateHud();
  overlay.hidden = true;
  playStartSound();
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (gameState !== "running") return;

  const delta = Math.min((timestamp - lastFrame) / 1000, 0.04);
  lastFrame = timestamp;
  updateGame(delta);
  drawScene();
  animationFrame = requestAnimationFrame(gameLoop);
}

function updateGame(delta) {
  elapsed += delta;
  score += delta * 5;
  invulnerableTime = Math.max(0, invulnerableTime - delta);

  if (warpActive) {
    warpTimer -= delta;
    if (warpTimer <= 0) {
      warpActive = false;
    }
  }

  if (activePowerUp) {
    powerUpTime -= delta;
    if (powerUpTime <= 0) {
      activePowerUp = null;
      powerUpTime = 0;
    }
  }

  const horizontal = Number(directions.right) - Number(directions.left);
  const vertical = Number(directions.down) - Number(directions.up);
  const isMoving = horizontal !== 0 || vertical !== 0;

  if (isMoving && !warpActive) {
    setThrusterAudio(true);
    spawnThrusterParticle(player.x, player.y);
  } else {
    setThrusterAudio(false);
  }

  updateParticles(delta);

  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const speedMultiplier = (activePowerUp === "speed" ? 1.55 : 1) * (warpActive ? 2.5 : 1);
  player.x += (horizontal / magnitude) * player.speed * speedMultiplier * delta;
  player.y += (vertical / magnitude) * player.speed * speedMultiplier * delta;
  player.x = clamp(player.x, player.radius + 8, width - player.radius - 8);
  player.y = clamp(player.y, player.radius + 8, height - player.radius - 8);

  asteroidTimer += delta;
  const spawnInterval = Math.max(0.38, 1.05 - elapsed * 0.012);
  if (asteroidTimer >= spawnInterval) {
    asteroidTimer = 0;
    spawnAsteroid();
  }

  orbTimer += delta;
  if (orbTimer >= 3.4) {
    orbTimer = 0;
    spawnEnergyOrb();
  }

  powerUpTimer += delta;
  if (powerUpTimer >= 8) {
    powerUpTimer = 0;
    spawnPowerUp();
  }

  asteroids.forEach((asteroid) => {
    asteroid.y += asteroid.speed * delta;
    asteroid.rotation += asteroid.spin * delta;
    if (invulnerableTime === 0 && distance(player, asteroid) < player.radius + asteroid.radius * 0.78) {
      asteroid.hit = true;
      if (activePowerUp === "shield") {
        activePowerUp = null;
        powerUpTime = 0;
        invulnerableTime = 0.65;
        playShieldBreakSound();
      } else {
        lives -= 1;
        invulnerableTime = 1.25;
        playDamageSound();
      }
    }
  });

  energyOrbs.forEach((orb) => {
    orb.y += orb.speed * delta;
    orb.phase += delta * 5;
    if (distance(player, orb) < player.radius + orb.radius) {
      orb.collected = true;
      score += 50;
      playOrbSound();
    }
  });

  powerUps.forEach((powerUp) => {
    powerUp.y += powerUp.speed * delta;
    powerUp.phase += delta * 4;
    if (distance(player, powerUp) < player.radius + powerUp.radius) {
      powerUp.collected = true;
      activePowerUp = powerUp.type;
      powerUpTime = powerUp.duration;
      playPowerUpSound();
    }
  });

  asteroids = asteroids.filter((asteroid) => !asteroid.hit && asteroid.y < height + asteroid.radius);
  energyOrbs = energyOrbs.filter((orb) => !orb.collected && orb.y < height + orb.radius);
  powerUps = powerUps.filter((powerUp) => !powerUp.collected && powerUp.y < height + powerUp.radius);
  updateHud();

  if (lives <= 0) endGame();
}

function spawnAsteroid() {
  const radius = Math.random() * 17 + 18;
  const sides = Math.floor(Math.random() * 4) + 7;
  const points = Array.from({ length: sides }, () => 0.72 + Math.random() * 0.5);
  asteroids.push({
    x: Math.random() * (width - radius * 2) + radius,
    y: -radius,
    radius,
    speed: 105 + Math.random() * 80 + Math.min(elapsed * 2, 120),
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.4,
    points,
    hit: false
  });
}

function spawnEnergyOrb() {
  energyOrbs.push({
    x: Math.random() * (width - 50) + 25,
    y: -18,
    radius: 11,
    speed: 95 + Math.min(elapsed, 70),
    phase: 0,
    collected: false
  });
}

function spawnPowerUp() {
  const type = Math.random() < 0.5 ? "shield" : "speed";
  powerUps.push({
    x: Math.random() * (width - 60) + 30,
    y: -20,
    radius: 14,
    speed: 90 + Math.min(elapsed, 70),
    phase: 0,
    type,
    duration: type === "shield" ? 7 : 6,
    collected: false
  });
}

function drawScene() {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#080d1c";
  context.fillRect(0, 0, width, height);
  drawStars();
  drawParticles();
  energyOrbs.forEach(drawEnergyOrb);
  powerUps.forEach(drawPowerUp);
  asteroids.forEach(drawAsteroid);
  drawPlayer();
}

function drawStars() {
  stars.forEach((star) => {
    context.globalAlpha = star.alpha;
    context.fillStyle = "#b9dcff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
}

function drawPlayer() {
  if (invulnerableTime > 0 && Math.floor(invulnerableTime * 12) % 2 === 0) return;

  context.save();
  context.translate(player.x, player.y);
  if (activePowerUp === "shield") {
    context.beginPath();
    context.arc(0, 0, player.radius + 9, 0, Math.PI * 2);
    context.strokeStyle = "rgba(89, 230, 255, 0.9)";
    context.lineWidth = 3;
    context.shadowColor = "#59e6ff";
    context.shadowBlur = 16;
    context.stroke();
  }
  context.shadowColor = "#59e6ff";
  context.shadowBlur = 20;
  context.fillStyle = "#7af1ff";
  context.strokeStyle = "#dcfbff";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -player.radius - 5);
  context.lineTo(player.radius * 0.85, player.radius);
  context.lineTo(0, player.radius * 0.55);
  context.lineTo(-player.radius * 0.85, player.radius);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawAsteroid(asteroid) {
  context.save();
  context.translate(asteroid.x, asteroid.y);
  context.rotate(asteroid.rotation);
  context.shadowColor = "#ff6b88";
  context.shadowBlur = 13;
  context.fillStyle = "#53354d";
  context.strokeStyle = "#ff8ca1";
  context.lineWidth = 2;
  context.beginPath();
  asteroid.points.forEach((point, index) => {
    const angle = (index / asteroid.points.length) * Math.PI * 2;
    const x = Math.cos(angle) * asteroid.radius * point;
    const y = Math.sin(angle) * asteroid.radius * point;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawEnergyOrb(orb) {
  const pulse = 1 + Math.sin(orb.phase) * 0.13;
  context.save();
  context.translate(orb.x, orb.y);
  context.scale(pulse, pulse);
  context.shadowColor = "#5affbe";
  context.shadowBlur = 20;
  context.fillStyle = "#5affbe";
  context.beginPath();
  context.arc(0, 0, orb.radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e9fff7";
  context.beginPath();
  context.arc(0, 0, orb.radius * 0.42, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPowerUp(powerUp) {
  const color = powerUp.type === "shield" ? "#59e6ff" : "#c4b5fd";
  const symbol = powerUp.type === "shield" ? "S" : "»";
  const pulse = 1 + Math.sin(powerUp.phase) * 0.12;
  context.save();
  context.translate(powerUp.x, powerUp.y);
  context.scale(pulse, pulse);
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.fillStyle = "rgba(14, 23, 43, 0.95)";
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, powerUp.radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.font = "bold 15px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(symbol, 0, 1);
  context.restore();
}

function updateHud() {
  scoreElement.textContent = String(Math.floor(score));
  livesElement.innerHTML = renderLives(Math.max(0, lives));
  livesElement.setAttribute("aria-label", `${lives} ${lives === 1 ? "life" : "lives"} remaining`);
  powerUpElement.textContent = activePowerUp
    ? `${activePowerUp === "shield" ? "Shield" : "Speed"} ${Math.ceil(powerUpTime)}s`
    : "—";
  if (score > bestScore) {
    bestScore = Math.floor(score);
    bestScoreElement.textContent = String(bestScore);
    saveBestScore(bestScore);
  }
}

function endGame() {
  gameState = "over";
  cancelAnimationFrame(animationFrame);
  stopThrusterAudio();
  particles.length = 0;
  playGameOverSound();
  overlayKicker.textContent = "FLIGHT COMPLETE";
  overlayTitle.textContent = "The asteroid field caught up";
  overlayMessage.textContent = `You scored ${Math.floor(score)} points. Ready to take another run?`;
  startButton.textContent = "Play again";
  overlay.hidden = false;
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

startButton.addEventListener("click", () => {
  overlayKicker.textContent = "READY FOR LAUNCH?";
  overlayTitle.textContent = "Escape the asteroid field";
  overlayMessage.textContent = "Use arrow keys or WASD to fly. Collect energy orbs, grab shield and speed power-ups, and avoid the asteroids.";
  startButton.textContent = "Start game";
  startGame();
});

resetBestButton.addEventListener("click", () => {
  bestScore = 0;
  bestScoreElement.textContent = "0";
  try {
    localStorage.removeItem("neon-asteroid-escape-best");
  } catch (error) {
    console.warn("Could not reset the saved best score.", error);
  }
});

  document.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Spacebar" || event.key === "Shift") && gameState === "running") {
      event.preventDefault();
      triggerWarpJump();
    }
    const direction = keys.get(event.key);
    if (direction && gameState === "running") {
      event.preventDefault();
      directions[direction] = true;
    }
  });

document.addEventListener("keyup", (event) => {
  const direction = keys.get(event.key);
  if (direction) directions[direction] = false;
});

window.addEventListener("blur", () => {
  Object.keys(directions).forEach((direction) => {
    directions[direction] = false;
  });
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  const direction = button.dataset.direction;
  const release = () => {
    directions[direction] = false;
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    directions[direction] = true;
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});
