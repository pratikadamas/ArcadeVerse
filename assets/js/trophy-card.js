/**
 * ArcadeVerse Holographic Certificate & Trophy Generator Engine
 * Renders 1200x750 high-resolution verified open-source certificates using native Canvas API
 * Features original user profile avatar, official platform brand logo, and ornate credentials
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  const TrophyCardEngine = {
    canvas: null,
    ctx: null,

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1200;
      this.canvas.height = 750;
      this.ctx = this.canvas.getContext('2d');
      this.bindEvents();
    },

    async generateCard(data = {}) {
      const {
        title = 'Open Source Contributor',
        playerName = 'Community Developer',
        handle = '',
        avatarUrl = '',
        score = '1,820 PTS',
        gameTitle = 'NSOC 2026 Hall of Fame',
        rank = '1st Champion',
        badge = 'NSOC 2026'
      } = data;

      const userHandle = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : (playerName ? `@${playerName.toLowerCase().replace(/\s+/g, '')}` : '@contributor');
      const ctx = this.ctx;
      const W = 1200;
      const H = 750;

      // Reset
      ctx.clearRect(0, 0, W, H);

      // Resolve Direct CORS-Enabled Avatar URL
      let resolvedAvatar = avatarUrl;
      const cleanHandle = userHandle.replace('@', '').trim();

      // Specifically resolve DebasmitaBose0 (Project Admin) to direct GitHub CDN avatar with CORS
      if (!resolvedAvatar || resolvedAvatar.includes('github.com/')) {
        if (cleanHandle.toLowerCase() === 'debasmitabose0' || (playerName && playerName.toLowerCase().includes('debasmita'))) {
          resolvedAvatar = 'https://avatars.githubusercontent.com/u/144198639?v=4';
        } else {
          // Check if an avatar img for this user already exists in the DOM
          const domAvatar = document.querySelector(`img[src*="${cleanHandle}"], a[href*="${cleanHandle}"] img, .podium-card img[alt*="${playerName}"], .admin-avatar-img`);
          if (domAvatar && domAvatar.src && domAvatar.src.includes('avatars.githubusercontent.com')) {
            resolvedAvatar = domAvatar.src;
          }
        }
      }

      if (!resolvedAvatar && cleanHandle.toLowerCase() === 'debasmitabose0') {
        resolvedAvatar = 'https://avatars.githubusercontent.com/u/144198639?v=4';
      }

      // Preload Brand Logo and User Profile Avatar
      const [brandLogoImg, userAvatarImg] = await Promise.all([
        loadImage('assets/public/brand-logo.webp').then(res => res || loadImage('assets/public/brand-logo.png')),
        resolvedAvatar ? loadImage(resolvedAvatar) : (cleanHandle.toLowerCase() === 'debasmitabose0' ? loadImage('https://avatars.githubusercontent.com/u/144198639?v=4') : null)
      ]);

      // 1. Deep Cyber Luxury Background with Ambient Radial Glow Orbs
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#020511');
      bgGrad.addColorStop(0.35, '#071126');
      bgGrad.addColorStop(0.7, '#0b1a38');
      bgGrad.addColorStop(1, '#030818');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Ambient Corner Radial Glows
      const drawGlow = (gx, gy, gr, col1, col2) => {
        ctx.save();
        const radGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        radGrad.addColorStop(0, col1);
        radGrad.addColorStop(1, col2);
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawGlow(120, 100, 320, 'rgba(0, 245, 255, 0.08)', 'rgba(0, 245, 255, 0)');
      drawGlow(W - 120, 100, 320, 'rgba(245, 158, 11, 0.08)', 'rgba(245, 158, 11, 0)');
      drawGlow(W / 2, H - 100, 380, 'rgba(168, 85, 247, 0.08)', 'rgba(168, 85, 247, 0)');

      // 2. Ambient Cyber Matrix Grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Ornate Double Certificate Borders with Gold & Cyan Gradients
      ctx.save();
      // Outer Gold/Cyan Frame with Hologram Aura
      const outerGrad = ctx.createLinearGradient(0, 0, W, H);
      outerGrad.addColorStop(0, '#00f5ff');
      outerGrad.addColorStop(0.25, '#38bdf8');
      outerGrad.addColorStop(0.5, '#ec4899');
      outerGrad.addColorStop(0.75, '#f59e0b');
      outerGrad.addColorStop(1, '#fbbf24');
      ctx.strokeStyle = outerGrad;
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(0, 245, 255, 0.45)';
      ctx.shadowBlur = 22;
      ctx.strokeRect(26, 26, W - 52, H - 52);

      // Inner Hairline Ornate Border
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(36, 36, W - 72, H - 72);

      // Inner Gold Accent Line with Micro-Dots
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.strokeRect(40, 40, W - 80, H - 80);

      // Corner Ornaments (Filigree Certificate Brackets)
      const drawCorner = (cx, cy, flipX, flipY) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(flipX, flipY);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 36);
        ctx.lineTo(0, 0);
        ctx.lineTo(36, 0);
        ctx.stroke();

        ctx.strokeStyle = '#00f5ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(8, 28);
        ctx.lineTo(8, 8);
        ctx.lineTo(28, 8);
        ctx.stroke();

        // Little diamond accent
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(14, 14, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawCorner(48, 48, 1, 1);
      drawCorner(W - 48, 48, -1, 1);
      drawCorner(48, H - 48, 1, -1);
      drawCorner(W - 48, H - 48, -1, -1);
      ctx.restore();

      // 4. Header: Platform Brand Logo & Credential Banner
      if (brandLogoImg) {
        ctx.save();
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur = 20;
        ctx.drawImage(brandLogoImg, (W - 74) / 2, 52, 74, 74);
        ctx.restore();
      }

      // Title & Subheading
      ctx.save();
      ctx.textAlign = 'center';

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.letterSpacing = '3.5px';
      ctx.fillText('NEXUS SPRING OF CODE 2026 • OFFICIAL OPEN SOURCE CREDENTIAL', W / 2, 150);

      // Main Certificate Title
      const titleGrad = ctx.createLinearGradient((W / 2) - 340, 0, (W / 2) + 340, 0);
      titleGrad.addColorStop(0, '#ffffff');
      titleGrad.addColorStop(0.3, '#38bdf8');
      titleGrad.addColorStop(0.5, '#00f5ff');
      titleGrad.addColorStop(0.7, '#fbbf24');
      titleGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = titleGrad;
      ctx.font = 'bold 38px "Space Grotesk", sans-serif';
      ctx.letterSpacing = '1.5px';
      ctx.fillText('CERTIFICATE OF ACHIEVEMENT', W / 2, 194);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
      ctx.letterSpacing = '0.5px';
      ctx.fillText('This credential certifies that the following developer has achieved exceptional distinction:', W / 2, 224);
      ctx.restore();

      // 5. User Profile: Original Avatar Image & Recipient Name
      const avatarY = 300;
      const avatarR = 50;

      ctx.save();
      if (userAvatarImg) {
        // Draw Circular Clipped User Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, avatarY, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userAvatarImg, (W / 2) - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();

        // Avatar Glowing Multi-Ring Aura
        ctx.beginPath();
        ctx.arc(W / 2, avatarY, avatarR + 3, 0, Math.PI * 2);
        ctx.strokeStyle = outerGrad;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = 'rgba(0, 245, 255, 0.6)';
        ctx.shadowBlur = 18;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(W / 2, avatarY, avatarR + 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Fallback Initial Avatar (Valid CanvasGradient)
        const initial = (playerName || 'U').trim().charAt(0).toUpperCase();
        ctx.beginPath();
        ctx.arc(W / 2, avatarY, avatarR, 0, Math.PI * 2);
        const avatarGrad = ctx.createLinearGradient((W / 2) - avatarR, avatarY - avatarR, (W / 2) + avatarR, avatarY + avatarR);
        avatarGrad.addColorStop(0, '#00f5ff');
        avatarGrad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = avatarGrad;
        ctx.fill();
        ctx.strokeStyle = outerGrad;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = 'rgba(0, 245, 255, 0.5)';
        ctx.shadowBlur = 14;
        ctx.stroke();

        ctx.fillStyle = '#040b17';
        ctx.font = 'bold 46px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, W / 2, avatarY + 2);
      }
      ctx.restore();

      // Recipient Name
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(playerName, W / 2, 388);

      // GitHub Handle & Badge
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText(userHandle, W / 2, 416);

      // Distinction / Rank Tier Pill with Luxury Gradient Glow
      const pillW = 500;
      const pillH = 40;
      const pillX = (W - pillW) / 2;
      const pillY = 438;

      const badgeGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      badgeGrad.addColorStop(0, 'rgba(0, 245, 255, 0.12)');
      badgeGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.15)');
      badgeGrad.addColorStop(1, 'rgba(168, 85, 247, 0.12)');
      ctx.fillStyle = badgeGrad;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(250, 204, 21, 0.3)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 20);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15.5px "Space Grotesk", sans-serif';
      ctx.fillText(`★  ${rank}  •  Total Arcade Score: ${score}  ★`, W / 2, pillY + 25);

      // Certificate Citation Statement
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('In recognition of verified code contributions, game architecture, and open-source craftsmanship', W / 2, 514);
      ctx.fillText('for the ArcadeVerse platform during Nexus Spring of Code – Winter Edition 2026.', W / 2, 536);
      ctx.restore();

      // 6. Verification Seal & Signatures
      const bottomY = 625;

      // Left: Project Lead Signature Line
      ctx.save();
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(110, bottomY);
      ctx.lineTo(340, bottomY);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'italic 20px "Permanent Marker", cursive, sans-serif';
      ctx.fillText('Debasmita Bose', 125, bottomY - 10);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 12.5px "Space Grotesk", sans-serif';
      ctx.fillText('DEBASMITA BOSE', 110, bottomY + 20);
      ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Project Lead & Lead Architect', 110, bottomY + 38);
      ctx.restore();

      // Center: Official Gold Rosette Seal with Ornate Multi-Spoke Ring
      const sealX = W / 2;
      const sealY = bottomY + 8;
      const sealR = 44;

      ctx.save();
      // Outer Seal Ring with Glow
      ctx.beginPath();
      ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.8;
      ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
      ctx.shadowBlur = 14;
      ctx.stroke();

      // Inner Star/Cog Ring
      ctx.beginPath();
      ctx.arc(sealX, sealY, sealR - 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Radiating notch accents
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const nx1 = sealX + Math.cos(a) * (sealR - 4);
        const ny1 = sealY + Math.sin(a) * (sealR - 4);
        const nx2 = sealX + Math.cos(a) * (sealR - 1);
        const ny2 = sealY + Math.sin(a) * (sealR - 1);
        ctx.beginPath();
        ctx.moveTo(nx1, ny1);
        ctx.lineTo(nx2, ny2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('VERIFIED', sealX, sealY - 7);
      ctx.fillStyle = '#00f5ff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('NSOC 2026', sealX, sealY + 8);
      ctx.restore();

      // Right: Verification ID & Date Line
      ctx.save();
      ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W - 340, bottomY);
      ctx.lineTo(W - 110, bottomY);
      ctx.stroke();

      // Format today's date dynamically (e.g., "Nov 7, 2026" or "Jan 2, 2027")
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedDate = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText(formattedDate.toUpperCase(), W - 110, bottomY - 10);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 12.5px "Space Grotesk", sans-serif';
      ctx.fillText('OFFICIAL CREDENTIAL', W - 110, bottomY + 20);
      ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('verified.arcadeverse.dev', W - 110, bottomY + 38);
      ctx.restore();

      return this.canvas.toDataURL('image/png');
    },

    async downloadCard(data) {
      const dataUrl = await this.generateCard(data);
      const link = document.createElement('a');
      const filename = (data.playerName || 'contributor').toLowerCase().replace(/\s+/g, '_');
      link.download = `ArcadeVerse_Certificate_${filename}.png`;
      link.href = dataUrl;
      link.click();
    },

    bindEvents() {
      // Listen for open trophy / certificate card requests
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-action="open-trophy-card"]');
        if (trigger) {
          e.preventDefault();
          e.stopPropagation();
          const game = trigger.dataset.game || 'NSOC 2026 Hall of Fame';
          const score = trigger.dataset.score || '1,820 PTS';
          const player = trigger.dataset.player || 'ArcadePlayer';
          const handle = trigger.dataset.handle || '';
          const avatarUrl = trigger.dataset.avatar || '';
          const rank = trigger.dataset.rank || 'Verified Contributor';
          const badge = trigger.dataset.badge || 'NSOC 2026';
          this.showModal({ gameTitle: game, score, playerName: player, handle, avatarUrl, rank, badge });
        }
      });
    },

    async showModal(data) {
      let modal = document.getElementById('trophy-card-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'trophy-card-modal';
        modal.className = 'trophy-modal';
        modal.innerHTML = `
          <div class="trophy-modal-content">
            <div class="trophy-modal-header">
              <h3 class="trophy-modal-title">Verified Achievement Certificate</h3>
              <button class="trophy-modal-close" aria-label="Close Certificate Modal">&times;</button>
            </div>
            <div class="trophy-card-preview-wrap">
              <div id="trophy-loading-spinner" class="trophy-loading-spinner">
                <div class="spinner-ring"></div>
                <span>Rendering High-Resolution Certificate...</span>
              </div>
              <img id="trophy-preview-img" class="trophy-preview-img" style="display: none;" alt="ArcadeVerse Achievement Certificate" />
            </div>
            <div class="trophy-modal-actions">
              <button id="btn-download-trophy" class="btn-trophy primary">Download Certificate (PNG)</button>
              <button id="btn-copy-trophy" class="btn-trophy secondary">Copy Certificate</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.trophy-modal-close').addEventListener('click', () => {
          modal.classList.remove('active');
        });
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('active');
        });
      }

      const img = modal.querySelector('#trophy-preview-img');
      const spinner = modal.querySelector('#trophy-loading-spinner');
      if (spinner) spinner.style.display = 'flex';
      if (img) img.style.display = 'none';

      modal.classList.add('active');

      const dataUrl = await this.generateCard(data);

      if (img) {
        img.src = dataUrl;
        img.style.display = 'block';
      }
      if (spinner) spinner.style.display = 'none';

      const btnDownload = modal.querySelector('#btn-download-trophy');
      btnDownload.onclick = () => this.downloadCard(data);

      const btnCopy = modal.querySelector('#btn-copy-trophy');
      btnCopy.onclick = async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          btnCopy.textContent = 'Certificate Copied to Clipboard!';
          setTimeout(() => { btnCopy.textContent = 'Copy Certificate'; }, 2000);
        } catch (_) {
          this.downloadCard(data);
        }
      };
    }
  };

  window.TrophyCardEngine = TrophyCardEngine;
  document.addEventListener('DOMContentLoaded', () => TrophyCardEngine.init());
})();
