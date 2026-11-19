/**
 * ArcadeVerse Procedural SVG Pixel-Art Avatar Creator (#660)
 * Generates symmetric 10x10 / 12x12 retro avatar icons from seed or player choice,
 * stores player preference under av_player_avatar, and updates header profile button.
 */
(() => {
  const PALETTES = [
    ['#00f0ff', '#7000ff', '#ff007f', '#050510'],
    ['#00ff66', '#0099ff', '#1a103c', '#0d0d1a'],
    ['#ffaa00', '#ff0055', '#330033', '#110022'],
    ['#38ef7d', '#11998e', '#003322', '#05110d'],
    ['#f857a6', '#ff5858', '#4b1248', '#1a0011']
  ];

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function generateAvatarSvg(seed, size = 32) {
    const num = hashCode(seed);
    const palette = PALETTES[num % PALETTES.length];
    const gridDim = 10;
    const halfDim = gridDim / 2;
    const pixelSize = size / gridDim;

    let rects = '';
    for (let y = 0; y < gridDim; y++) {
      for (let x = 0; x < halfDim; x++) {
        const bit = ((num >> (y * halfDim + x)) & 1) || ((y + x) % 3 === 0);
        if (bit) {
          const color = palette[(x + y) % (palette.length - 1)];
          const xLeft = x * pixelSize;
          const xRight = (gridDim - 1 - x) * pixelSize;
          const yPos = y * pixelSize;
          rects += `<rect x="${xLeft}" y="${yPos}" width="${pixelSize}" height="${pixelSize}" fill="${color}" />`;
          if (xLeft !== xRight) {
            rects += `<rect x="${xRight}" y="${yPos}" width="${pixelSize}" height="${pixelSize}" fill="${color}" />`;
          }
        }
      }
    }

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="av-pixel-avatar" xmlns="http://www.w3.org/2000/svg" style="border-radius: 50%; background: ${palette[palette.length - 1]};">
      ${rects}
    </svg>`;
  }

  function initPlayerAvatar() {
    let savedSeed = localStorage.getItem("av_player_avatar");
    if (!savedSeed) {
      savedSeed = "Player_" + Math.random().toString(36).substring(2, 7);
      localStorage.setItem("av_player_avatar", savedSeed);
    }

    const navActions = document.querySelector(".nav-actions");
    if (!navActions || document.getElementById("av-avatar-btn")) return;

    const avatarBtn = document.createElement("button");
    avatarBtn.id = "av-avatar-btn";
    avatarBtn.type = "button";
    avatarBtn.className = "nav-avatar-btn";
    avatarBtn.title = "Player Avatar Customizer";
    avatarBtn.innerHTML = generateAvatarSvg(savedSeed, 30);

    avatarBtn.addEventListener("click", () => {
      const newSeed = prompt("Enter your avatar handle or seed phrase:", savedSeed);
      if (newSeed && newSeed.trim() !== "") {
        savedSeed = newSeed.trim();
        localStorage.setItem("av_player_avatar", savedSeed);
        avatarBtn.innerHTML = generateAvatarSvg(savedSeed, 30);
      }
    });

    navActions.appendChild(avatarBtn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayerAvatar);
  } else {
    initPlayerAvatar();
  }

  window.ArcadeAvatar = {
    generate: generateAvatarSvg
  };
})();
