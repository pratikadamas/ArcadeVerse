/**
 * ArcadeVerse In-Modal Canvas Screenshot & Retro Watermark Snapshot Generator
 * Author: Babin123456
 * Captures active iframe game canvas, composites synthwave border, scanlines,
 * ArcadeVerse logo watermark, game metadata, and triggers clean instant PNG download.
 */

(function () {
  'use strict';

  function initSnapshotStudio() {
    const gameModal = document.getElementById('game-modal');
    const modalControls = document.querySelector('#game-modal .modal-controls');
    const gameIframe = document.getElementById('game-iframe');

    if (!gameModal || !modalControls || !gameIframe) return;

    // Check if snapshot button already exists
    if (document.getElementById('modal-snapshot-btn')) return;

    // Create Snapshot Button
    const snapshotBtn = document.createElement('button');
    snapshotBtn.id = 'modal-snapshot-btn';
    snapshotBtn.className = 'btn btn-sm btn-icon';
    snapshotBtn.title = 'Capture Retro Snapshot (P)';
    snapshotBtn.setAttribute('aria-label', 'Capture Game Frame Snapshot');
    snapshotBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-snapshot-icon" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
    `;

    // Insert before reload or fullscreen button
    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
      modalControls.insertBefore(snapshotBtn, reloadBtn);
    } else {
      modalControls.appendChild(snapshotBtn);
    }

    // Attach Click Handler
    snapshotBtn.addEventListener('click', () => {
      triggerSnapshotCapture();
    });

    // Keyboard shortcut [P] when modal is open
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (gameModal.classList.contains('active') && document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          triggerSnapshotCapture();
        }
      }
    });
  }

  /**
   * Captures the active iframe game canvas, renders synthwave frame & watermark,
   * and triggers automatic PNG download.
   */
  function triggerSnapshotCapture() {
    const gameIframe = document.getElementById('game-iframe');
    const modalTitleElem = document.getElementById('modal-game-title');
    const modalAuthorElem = document.getElementById('modal-game-author');
    const modalBadgeElem = document.getElementById('modal-game-badge');

    if (!gameIframe) {
      showToast('Capture error: Game window unavailable.', 'error');
      return;
    }

    let sourceCanvas = null;
    let iframeDoc = null;

    try {
      iframeDoc = gameIframe.contentDocument || gameIframe.contentWindow.document;
      if (iframeDoc) {
        sourceCanvas = iframeDoc.querySelector('canvas');
      }
    } catch (e) {
      console.warn('[SnapshotStudio] Cross-origin security barrier prevented direct canvas pixel read:', e);
    }

    if (!sourceCanvas) {
      showToast('No active canvas frame detected in current game.', 'warning');
      return;
    }

    const gameTitle = modalTitleElem ? modalTitleElem.textContent.trim() : 'ArcadeVerse Game';
    const authorName = modalAuthorElem ? modalAuthorElem.textContent.replace(/^By\s+@?/, '').trim() : 'Contributor';
    const categoryName = modalBadgeElem ? modalBadgeElem.textContent.trim() : 'Arcade';

    try {
      // 1. Create High-Resolution Composite Canvas
      const padding = 36;
      const headerHeight = 54;
      const footerHeight = 44;

      const targetWidth = Math.max(sourceCanvas.width, 640);
      const targetHeight = Math.max(sourceCanvas.height, 480);

      const compCanvas = document.createElement('canvas');
      compCanvas.width = targetWidth + padding * 2;
      compCanvas.height = targetHeight + headerHeight + footerHeight + padding;

      const ctx = compCanvas.getContext('2d');

      // 2. Render Retro Dark Synthwave Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, compCanvas.width, compCanvas.height);
      bgGrad.addColorStop(0, '#060a12');
      bgGrad.addColorStop(0.5, '#0c1322');
      bgGrad.addColorStop(1, '#060a12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, compCanvas.width, compCanvas.height);

      // Subtle Cyber Grid Pattern
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 0; x < compCanvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, compCanvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < compCanvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(compCanvas.width, y);
        ctx.stroke();
      }

      // 3. Render Top Banner with Brand & Category
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ARCADEVERSE // SNAPSHOT', padding, headerHeight / 2 + 10);

      // Category Pill
      const catText = categoryName.toUpperCase();
      ctx.font = 'bold 12px "Courier New", monospace';
      const catMetrics = ctx.measureText(catText);
      const pillWidth = catMetrics.width + 20;
      const pillX = compCanvas.width - padding - pillWidth;
      const pillY = headerHeight / 2 - 2;

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.fillRect(pillX, pillY - 10, pillWidth, 24);
      ctx.strokeRect(pillX, pillY - 10, pillWidth, 24);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(catText, pillX + pillWidth / 2, pillY + 3);

      // 4. Draw Game Canvas Frame with Neon Cyan Glow
      const frameX = padding;
      const frameY = headerHeight + 10;
      const frameW = targetWidth;
      const frameH = targetHeight;

      // Glow outline
      ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(frameX, frameY, frameW, frameH);

      // Composite Captured Game Canvas
      ctx.shadowBlur = 0;
      ctx.drawImage(sourceCanvas, frameX, frameY, frameW, frameH);

      // Retro CRT Scanlines Effect across game canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = frameY; y < frameY + frameH; y += 3) {
        ctx.fillRect(frameX, y, frameW, 1.5);
      }

      // 5. Draw Footer Metadata: Game Title, Author, Date & Watermark
      const footerY = frameY + frameH + 30;

      // Game Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 6;
      ctx.fillText(gameTitle.toUpperCase(), padding, footerY);

      // Author & Timestamp
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px "Courier New", monospace';
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0] + ' ' + now.toTimeString().split(' ')[0];
      ctx.fillText(`DEVELOPED BY @${authorName} • CAPTURED ${dateStr}`, padding, footerY + 20);

      // Bottom Right Watermark
      ctx.textAlign = 'right';
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fillText('arcadeverse.vercel.app', compCanvas.width - padding, footerY + 10);

      // 6. Trigger Download
      const dataUrl = compCanvas.toDataURL('image/png');
      const filename = `ArcadeVerse-${slugify(gameTitle)}-${Date.now()}.png`;

      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      showToast('Snapshot saved to downloads!', 'success');
    } catch (err) {
      console.error('[SnapshotStudio] Capture error:', err);
      showToast('Could not capture snapshot from game frame.', 'error');
    }
  }

  function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  // Toast Notification Generator
  function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('arcade-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'arcade-toast-container';
      toastContainer.className = 'arcade-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `arcade-toast toast-${type}`;
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    }, 2800);
  }

  // Inject CSS Styles for Snapshot and Toasts
  function injectSnapshotStyles() {
    if (document.getElementById('snapshot-studio-styles')) return;

    const style = document.createElement('style');
    style.id = 'snapshot-studio-styles';
    style.textContent = `
      .arcade-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .arcade-toast {
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid #00f0ff;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.35);
        color: #f8fafc;
        padding: 10px 18px;
        border-radius: 8px;
        font-family: 'Segoe UI', system-ui, monospace;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(8px);
        animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
      }
      .arcade-toast.toast-success {
        border-color: #10b981;
        box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
      }
      .arcade-toast.toast-warning {
        border-color: #f59e0b;
        box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
      }
      .arcade-toast.toast-error {
        border-color: #ef4444;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
      }
      .arcade-toast.hide {
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
      }
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectSnapshotStyles();
      initSnapshotStudio();
    });
  } else {
    injectSnapshotStyles();
    initSnapshotStudio();
  }

  // Global Export
  window.ArcadeSnapshot = {
    capture: triggerSnapshotCapture,
    showToast: showToast
  };
})();
