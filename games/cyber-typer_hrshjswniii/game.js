/**
 * ============================================================================
 * Cyber Typer: Terminal Hacker - Complete Game Engine
 * 60 FPS HTML5 Canvas Speed-Typing Arcade with Web Audio API Synthesis
 * Open Source for ArcadeVerse - Nexus Spring of Code 2026 (NSoC '26)
 * Author: Harsh Jaiswani (@hrshjswniii)
 * ============================================================================
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Procedural Web Audio API Sound Synthesizer (Zero External Assets)
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Load mute state from localStorage
  try {
    isMuted = localStorage.getItem('cyber_typer_muted') === 'true';
  } catch {
    isMuted = false;
  }

  function playKeyClick() {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Audio playback unavailable - fail silently
    }
  }

  function playLaserShot() {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.085);
    } catch {
      // Audio playback unavailable
    }
  }

  function playExplosion() {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;

      // Noise buffer for blast
      const bufferSize = audioCtx.sampleRate * 0.2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.2);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start();
    } catch {
      // Audio playback unavailable
    }
  }

  function playTypoBuzz() {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(110, now + 0.05);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio playback unavailable
    }
  }

  function playCriticalAlarm() {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.1);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.21);
    } catch {
      // Audio playback unavailable
    }
  }

  function playGameOverSfx() {
    if (isMuted) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      [380, 320, 260, 180, 90].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.11);
      });
    } catch {
      // Audio playback unavailable
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Word Pools & Cybersecurity Threat Dictionaries
  // ---------------------------------------------------------------------------
  const WORD_POOLS = {
    easy: [
      'cat', 'ls', 'cd', 'pwd', 'ping', 'kill', 'grep', 'sudo', 'nmap', 'ssh',
      'bash', 'root', 'diff', 'echo', 'nano', 'host', 'port', 'scan', 'sync', 'byte',
      'loop', 'data', 'node', 'hash', 'code', 'fire', 'halt', 'bind', 'cron', 'link',
      'disk', 'boot', 'user', 'pipe', 'leak', 'auth', 'ip', 'dump', 'lock', 'deny'
    ],
    normal: [
      'cipher', 'daemon', 'router', 'kernel', 'matrix', 'vector', 'socket', 'packet',
      'buffer', 'crypto', 'inject', 'bypass', 'system', 'client', 'server', 'subnet',
      'uptime', 'tunnel', 'breach', 'exploit', 'shadow', 'beacon', 'script', 'access',
      'domain', 'lambda', 'memory', 'thread', 'commit', 'branch', 'syntax', 'socket',
      'binary', 'module', 'portal', 'proxy', 'threat', 'uplink', 'phish', 'spider'
    ],
    hard: [
      'firewall', 'terminal', 'protocol', 'quantum', 'backdoor', 'netrunner', 'override',
      'payload', 'overflow', 'decryption', 'handshake', 'keystroke', 'assembler', 'mainframe',
      'subroutine', 'algorithm', 'bandwidth', 'hexadecimal', 'cyberware', 'malware',
      'intruder', 'encryption', 'synthesizer', 'quarantine', 'hypervisor', 'interceptor',
      'vulnerability', 'trojanhorse', 'ransomware', 'cybernetic'
    ]
  };

  // ---------------------------------------------------------------------------
  // 3. Game State & Telemetry Variables
  // ---------------------------------------------------------------------------
  let gameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
  let difficulty = 'easy'; // 'easy' | 'normal' | 'hard'

  let score = 0;
  let firewallHealth = 100;
  let streak = 0;
  let highestStreak = 0;
  let totalKeystrokes = 0;
  let correctKeystrokes = 0;
  let totalWordsEliminated = 0;
  let gameStartTime = 0;
  let peakWPM = 0;

  // Active Target Word Management
  let threats = [];
  let particles = [];
  let laserBeams = [];
  let activeTarget = null;
  let typedIndex = 0;

  // Spawn Timing
  let lastSpawnTime = 0;
  let spawnInterval = 2200; // ms between threats
  let animationFrameId = null;

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const viewport = document.getElementById('canvas-viewport');

  const hudScore = document.getElementById('hud-score');
  const hudWpm = document.getElementById('hud-wpm');
  const hudAccuracy = document.getElementById('hud-accuracy');
  const hudStreak = document.getElementById('hud-streak');
  const hudFirewallText = document.getElementById('hud-firewall-text');
  const hudFirewallFill = document.getElementById('hud-firewall-fill');

  const promptMatched = document.getElementById('prompt-matched');
  const promptUnmatched = document.getElementById('prompt-unmatched');
  const targetIndicator = document.getElementById('target-indicator');
  const targetName = document.getElementById('target-name');

  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const rulesModal = document.getElementById('rules-modal');

  const startGameBtn = document.getElementById('start-game-btn');
  const restartGameBtn = document.getElementById('restart-game-btn');
  const helpBtn = document.getElementById('help-btn');
  const closeRulesBtn = document.getElementById('close-rules-btn');
  const ackRulesBtn = document.getElementById('ack-rules-btn');
  const rulesTriggerBtn = document.getElementById('rules-trigger-btn');
  const soundBtn = document.getElementById('sound-btn');
  const soundOnIcon = document.getElementById('sound-on-icon');
  const soundOffIcon = document.getElementById('sound-off-icon');

  const diffButtons = document.querySelectorAll('.btn-diff');
  const keyboardKeys = document.querySelectorAll('.key-btn');

  // High score storage key
  const HIGH_SCORE_KEY = 'cyber_typer_highscore_v1';

  function getHighScore() {
    try {
      return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    } catch {
      return 0;
    }
  }

  function saveHighScore(newScore) {
    try {
      const current = getHighScore();
      if (newScore > current) {
        localStorage.setItem(HIGH_SCORE_KEY, newScore.toString());
      }
    } catch {
      // Storage unavailable
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Canvas Sizing & High-DPI Scaling
  // ---------------------------------------------------------------------------
  let dpr = 1;
  let canvasWidth = 800;
  let canvasHeight = 500;

  function resizeCanvas() {
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    canvasWidth = Math.max(300, Math.floor(rect.width));
    canvasHeight = Math.max(250, Math.floor(rect.height));

    dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // ---------------------------------------------------------------------------
  // 5. Threat Entity Creation & Logic
  // ---------------------------------------------------------------------------
  const THREAT_COLORS = ['#00e5ff', '#00ff88', '#ffb700', '#c084fc'];

  function createThreat() {
    const pool = WORD_POOLS[difficulty] || WORD_POOLS.easy;
    const randomWord = pool[Math.floor(Math.random() * pool.length)];

    // Ensure initial letter doesn't immediately conflict with existing target
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(randomWord).width;
    const padding = 20;
    const margin = textWidth + padding * 2;
    const x = margin / 2 + Math.random() * (canvasWidth - margin);

    // Speed scaled by difficulty
    let baseSpeed = 0.55;
    if (difficulty === 'normal') baseSpeed = 0.85;
    if (difficulty === 'hard') baseSpeed = 1.25;

    // Slight acceleration based on words eliminated
    const speedBoost = Math.min(1.2, totalWordsEliminated * 0.015);

    const threat = {
      id: Math.random().toString(36).substring(2, 9),
      word: randomWord,
      x: x,
      y: -20,
      speed: baseSpeed + speedBoost,
      color: THREAT_COLORS[Math.floor(Math.random() * THREAT_COLORS.length)],
      width: textWidth + 18,
      height: 28,
      glitchOffset: 0,
      glowPulse: Math.random() * Math.PI
    };

    threats.push(threat);
  }

  // ---------------------------------------------------------------------------
  // 6. Laser Beams & Particle Explosions
  // ---------------------------------------------------------------------------
  function fireLaser(targetX, targetY, color = '#00ff88') {
    const originX = canvasWidth / 2;
    const originY = canvasHeight - 8;

    laserBeams.push({
      startX: originX,
      startY: originY,
      endX: targetX,
      endY: targetY,
      color: color,
      alpha: 1,
      width: 3.5
    });
  }

  function createExplosion(x, y, color = '#00ff88') {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 3.5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: color,
        alpha: 1,
        life: 0.9 + Math.random() * 0.3
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Core Typing Input Engine
  // ---------------------------------------------------------------------------
  function getStreakMultiplier() {
    if (streak >= 50) return 5;
    if (streak >= 25) return 3;
    if (streak >= 10) return 2;
    return 1;
  }

  function handleTypingInput(char) {
    if (gameState !== 'PLAYING') return;

    totalKeystrokes++;
    const typedChar = char.toLowerCase();

    // 1. If currently locked onto a target
    if (activeTarget) {
      const expectedChar = activeTarget.word[typedIndex].toLowerCase();

      if (typedChar === expectedChar) {
        // MATCH: Progress lock
        typedIndex++;
        correctKeystrokes++;
        streak++;
        if (streak > highestStreak) highestStreak = streak;

        playLaserShot();
        fireLaser(activeTarget.x, activeTarget.y, activeTarget.color);
        updatePromptDisplay();

        // Check if full word completed
        if (typedIndex >= activeTarget.word.length) {
          eliminateTarget(activeTarget);
        }
      } else {
        // TYPO: Reset streak
        streak = 0;
        playTypoBuzz();
      }
    } else {
      // 2. No target active: search for closest descending threat starting with typedChar
      let candidate = null;
      let highestY = -9999;

      for (let i = 0; i < threats.length; i++) {
        const t = threats[i];
        if (t.word[0].toLowerCase() === typedChar) {
          // Prefer threat closest to the bottom (greatest urgency)
          if (t.y > highestY) {
            highestY = t.y;
            candidate = t;
          }
        }
      }

      if (candidate) {
        activeTarget = candidate;
        typedIndex = 1;
        correctKeystrokes++;
        streak++;
        if (streak > highestStreak) highestStreak = streak;

        playLaserShot();
        fireLaser(candidate.x, candidate.y, candidate.color);
        updatePromptDisplay();

        // Single letter words edge-case
        if (typedIndex >= candidate.word.length) {
          eliminateTarget(candidate);
        }
      } else {
        // Miss: streak penalty
        streak = 0;
        playTypoBuzz();
      }
    }

    updateTelemetryHUD();
  }

  function eliminateTarget(target) {
    playExplosion();
    createExplosion(target.x, target.y, target.color);

    // Score points: 100 * word length * combo multiplier
    const mult = getStreakMultiplier();
    const wordScore = target.word.length * 100 * mult;
    score += wordScore;
    totalWordsEliminated++;

    // Small firewall repair reward on clean streak
    if (streak >= 15 && firewallHealth < 100) {
      firewallHealth = Math.min(100, firewallHealth + 3);
    }

    // Remove threat from array
    threats = threats.filter((t) => t.id !== target.id);
    activeTarget = null;
    typedIndex = 0;

    updatePromptDisplay();
    updateTelemetryHUD();
  }

  function updatePromptDisplay() {
    if (!promptMatched || !promptUnmatched) return;

    if (activeTarget) {
      promptMatched.textContent = activeTarget.word.slice(0, typedIndex);
      promptUnmatched.textContent = activeTarget.word.slice(typedIndex);

      if (targetIndicator && targetName) {
        targetIndicator.style.display = 'flex';
        targetName.textContent = activeTarget.word.toUpperCase();
      }
    } else {
      promptMatched.textContent = '';
      promptUnmatched.textContent = 'READY...';

      if (targetIndicator) {
        targetIndicator.style.display = 'none';
      }
    }
  }

  function updateTelemetryHUD() {
    if (!hudScore) return;

    hudScore.textContent = score.toLocaleString();

    // Calculate WPM: (characters / 5) / elapsedMinutes
    if (gameStartTime > 0) {
      const elapsedMinutes = (Date.now() - gameStartTime) / 60000;
      if (elapsedMinutes > 0.05) {
        const currentWPM = Math.floor((correctKeystrokes / 5) / elapsedMinutes);
        hudWpm.textContent = currentWPM;
        if (currentWPM > peakWPM) peakWPM = currentWPM;
      } else {
        hudWpm.textContent = '0';
      }
    }

    // Accuracy
    const acc = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;
    hudAccuracy.textContent = acc + '%';

    // Multiplier Streak
    const mult = getStreakMultiplier();
    hudStreak.textContent = `x${mult}`;
    if (mult > 1) {
      hudStreak.style.color = mult === 5 ? '#ff0055' : mult === 3 ? '#ffb700' : '#00e5ff';
    } else {
      hudStreak.style.color = '#7d8ba1';
    }

    // Firewall Health
    hudFirewallText.textContent = `${Math.max(0, Math.round(firewallHealth))}%`;
    hudFirewallFill.style.width = `${Math.max(0, firewallHealth)}%`;

    if (firewallHealth <= 25) {
      hudFirewallFill.classList.add('critical');
      hudFirewallText.style.color = '#ff0055';
    } else {
      hudFirewallFill.classList.remove('critical');
      hudFirewallText.style.color = '#00ff88';
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Game Over & Damage Handling
  // ---------------------------------------------------------------------------
  function triggerFirewallDamage(threat) {
    // Penalty: 15% - 25% based on word length
    const damage = Math.min(30, threat.word.length * 3);
    firewallHealth = Math.max(0, firewallHealth - damage);

    // Reset current target if it was the breaching one
    if (activeTarget && activeTarget.id === threat.id) {
      activeTarget = null;
      typedIndex = 0;
      updatePromptDisplay();
    }

    // Red impact particle burst
    createExplosion(threat.x, canvasHeight - 20, '#ff0055');
    playExplosion();
    playCriticalAlarm();

    // Screen shake simulation on canvas container
    if (viewport) {
      viewport.style.transform = 'translate(' + (Math.random() * 8 - 4) + 'px, ' + (Math.random() * 8 - 4) + 'px)';
      setTimeout(() => {
        if (viewport) viewport.style.transform = 'translate(0, 0)';
      }, 100);
    }

    updateTelemetryHUD();

    if (firewallHealth <= 0) {
      handleGameOver();
    }
  }

  function handleGameOver() {
    gameState = 'GAMEOVER';
    playGameOverSfx();
    saveHighScore(score);

    // Populate Game Over stats
    document.getElementById('go-score').textContent = score.toLocaleString();
    document.getElementById('go-peak-wpm').textContent = peakWPM;
    const acc = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 100;
    document.getElementById('go-accuracy').textContent = acc + '%';
    document.getElementById('go-high-score').textContent = Math.max(score, getHighScore()).toLocaleString();

    if (gameOverScreen) {
      gameOverScreen.style.display = 'flex';
    }
  }

  // ---------------------------------------------------------------------------
  // 9. 60 FPS Canvas Render Loop
  // ---------------------------------------------------------------------------
  function gameLoop(timestamp) {
    if (gameState === 'PLAYING') {
      // 1. Spawn threats
      if (timestamp - lastSpawnTime > spawnInterval) {
        createThreat();
        lastSpawnTime = timestamp;

        // Dynamic ramp-up
        if (difficulty === 'hard') {
          spawnInterval = Math.max(900, 2000 - totalWordsEliminated * 25);
        } else if (difficulty === 'normal') {
          spawnInterval = Math.max(1200, 2400 - totalWordsEliminated * 20);
        } else {
          spawnInterval = Math.max(1600, 2800 - totalWordsEliminated * 15);
        }
      }

      // 2. Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Draw subtle cyber grid lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y < canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      // 3. Draw Laser Beams
      for (let i = laserBeams.length - 1; i >= 0; i--) {
        const beam = laserBeams[i];
        ctx.save();
        ctx.strokeStyle = beam.color;
        ctx.lineWidth = beam.width * beam.alpha;
        ctx.shadowColor = beam.color;
        ctx.shadowBlur = 15;
        ctx.globalAlpha = beam.alpha;

        ctx.beginPath();
        ctx.moveTo(beam.startX, beam.startY);
        ctx.lineTo(beam.endX, beam.endY);
        ctx.stroke();
        ctx.restore();

        beam.alpha -= 0.08;
        if (beam.alpha <= 0) {
          laserBeams.splice(i, 1);
        }
      }

      // 4. Update and Draw Threats
      for (let i = threats.length - 1; i >= 0; i--) {
        const t = threats[i];
        t.y += t.speed;
        t.glowPulse += 0.05;

        const isLocked = activeTarget && activeTarget.id === t.id;

        // Check breach of bottom firewall boundary
        if (t.y >= canvasHeight - 35) {
          threats.splice(i, 1);
          triggerFirewallDamage(t);
          continue;
        }

        // Draw threat container
        ctx.save();
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(t.word);
        const w = textMetrics.width + 18;
        const h = 26;
        const boxX = t.x - w / 2;
        const boxY = t.y - h / 2;

        // Container glow & background
        if (isLocked) {
          ctx.fillStyle = 'rgba(0, 255, 136, 0.22)';
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 16;
        } else {
          ctx.fillStyle = 'rgba(10, 18, 32, 0.85)';
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 1;
          ctx.shadowColor = t.color;
          ctx.shadowBlur = 6;
        }

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, w, h, 6);
        ctx.fill();
        ctx.stroke();

        // Render characters
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'middle';
        let currentX = boxX + 9;
        const textY = t.y + 1;

        if (isLocked) {
          // Typed portion in neon green
          const typedStr = t.word.slice(0, typedIndex);
          const remainingStr = t.word.slice(typedIndex);

          ctx.fillStyle = '#00ff88';
          ctx.fillText(typedStr, currentX, textY);
          currentX += ctx.measureText(typedStr).width;

          // Remaining portion in text-dim
          ctx.fillStyle = '#7d8ba1';
          ctx.fillText(remainingStr, currentX, textY);
        } else {
          ctx.fillStyle = '#f0f6fc';
          ctx.fillText(t.word, currentX, textY);
        }

        // Lock reticle indicator above locked threat
        if (isLocked) {
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 1.5;
          const reticleSize = 5;
          // Top-left corner
          ctx.beginPath();
          ctx.moveTo(boxX - 4, boxY - 4 + reticleSize);
          ctx.lineTo(boxX - 4, boxY - 4);
          ctx.lineTo(boxX - 4 + reticleSize, boxY - 4);
          // Top-right corner
          ctx.moveTo(boxX + w + 4 - reticleSize, boxY - 4);
          ctx.lineTo(boxX + w + 4, boxY - 4);
          ctx.lineTo(boxX + w + 4, boxY - 4 + reticleSize);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Update and Draw Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Draw Bottom Mainframe Defense Cannon
      ctx.save();
      const cannonX = canvasWidth / 2;
      const cannonY = canvasHeight - 6;

      ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(cannonX, cannonY, 14, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      // Cannon Turret Barrel
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(cannonX - 2.5, cannonY - 14, 5, 8);
      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // ---------------------------------------------------------------------------
  // 10. Game Flow & State Transitions
  // ---------------------------------------------------------------------------
  function startGame() {
    initAudio();
    resizeCanvas();

    gameState = 'PLAYING';
    score = 0;
    firewallHealth = 100;
    streak = 0;
    highestStreak = 0;
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    totalWordsEliminated = 0;
    gameStartTime = Date.now();
    peakWPM = 0;

    threats = [];
    particles = [];
    laserBeams = [];
    activeTarget = null;
    typedIndex = 0;

    lastSpawnTime = performance.now();

    if (startScreen) startScreen.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';

    updatePromptDisplay();
    updateTelemetryHUD();
  }

  // ---------------------------------------------------------------------------
  // 11. Event Listeners & Input Handlers
  // ---------------------------------------------------------------------------
  // Keyboard keystrokes
  window.addEventListener('keydown', (e) => {
    // Escape closes manual or pauses
    if (e.key === 'Escape') {
      if (rulesModal && rulesModal.style.display === 'flex') {
        rulesModal.style.display = 'none';
        return;
      }
    }

    // Ignore system / modifier keys
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key.length === 1 && /[a-z0-9_-]/i.test(e.key)) {
      e.preventDefault();
      playKeyClick();
      handleTypingInput(e.key);

      // Highlight on-screen virtual keyboard key
      const keyBtn = document.querySelector(`.key-btn[data-key="${e.key.toLowerCase()}"]`);
      if (keyBtn) {
        keyBtn.classList.add('key-pressed');
        setTimeout(() => keyBtn.classList.remove('key-pressed'), 100);
      }
    }
  });

  // Virtual on-screen touch keyboard events
  keyboardKeys.forEach((keyBtn) => {
    const handleKeyAction = (e) => {
      e.preventDefault();
      const keyVal = keyBtn.getAttribute('data-key');
      if (!keyVal) return;

      playKeyClick();
      keyBtn.classList.add('key-pressed');
      setTimeout(() => keyBtn.classList.remove('key-pressed'), 120);

      if (keyVal === 'Backspace') {
        if (activeTarget && typedIndex > 0) {
          typedIndex--;
          if (typedIndex === 0) activeTarget = null;
          updatePromptDisplay();
        }
      } else {
        handleTypingInput(keyVal);
      }
    };

    keyBtn.addEventListener('click', handleKeyAction);
    keyBtn.addEventListener('touchstart', handleKeyAction, { passive: false });
  });

  // Difficulty switchers
  diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      diffButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.getAttribute('data-diff') || 'easy';

      // If game is active, reset state with new difficulty
      if (gameState === 'PLAYING') {
        startGame();
      }
    });
  });

  // Start & Restart buttons
  if (startGameBtn) startGameBtn.addEventListener('click', startGame);
  if (restartGameBtn) restartGameBtn.addEventListener('click', startGame);

  // Sound toggle button
  if (soundBtn) {
    function updateSoundIcons() {
      if (soundOnIcon && soundOffIcon) {
        soundOnIcon.style.display = isMuted ? 'none' : 'block';
        soundOffIcon.style.display = isMuted ? 'block' : 'none';
      }
    }
    updateSoundIcons();

    soundBtn.addEventListener('click', () => {
      initAudio();
      isMuted = !isMuted;
      try {
        localStorage.setItem('cyber_typer_muted', isMuted ? 'true' : 'false');
      } catch {
        // Storage failover
      }
      updateSoundIcons();
    });
  }

  // Rules / Manual Modal triggers
  function openRules() {
    if (rulesModal) rulesModal.style.display = 'flex';
  }

  function closeRules() {
    if (rulesModal) rulesModal.style.display = 'none';
  }

  if (helpBtn) helpBtn.addEventListener('click', openRules);
  if (rulesTriggerBtn) rulesTriggerBtn.addEventListener('click', openRules);
  if (closeRulesBtn) closeRulesBtn.addEventListener('click', closeRules);
  if (ackRulesBtn) ackRulesBtn.addEventListener('click', closeRules);

  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) closeRules();
    });
  }

  // ---------------------------------------------------------------------------
  // 12. Initialization
  // ---------------------------------------------------------------------------
  resizeCanvas();
  animationFrameId = requestAnimationFrame(gameLoop);
})();
