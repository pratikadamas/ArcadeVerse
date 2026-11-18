/**
 * ArcadeVerse — Network Connectivity Telemetry & Offline Detection Engine
 * Real-time connectivity monitor with graceful offline status feedback
 * Author: Babin Bid (@Babin123456)
 * NSOC Winter Edition 2026
 */

(() => {
  'use strict';

  const ArcadeNetwork = {
    toastContainer: null,
    wasOffline: false,
    autoHideTimer: null,

    init() {
      this.createContainer();
      this.bindEvents();

      // Check initial state
      if (!navigator.onLine) {
        this.wasOffline = true;
        this.showOfflineToast();
      }
    },

    createContainer() {
      if (document.getElementById('arcade-network-toast-root')) {
        this.toastContainer = document.getElementById('arcade-network-toast-root');
        return;
      }

      const container = document.createElement('div');
      container.id = 'arcade-network-toast-root';
      container.className = 'arcade-network-toast-wrapper';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('role', 'status');
      document.body.appendChild(container);
      this.toastContainer = container;
    },

    bindEvents() {
      window.addEventListener('offline', () => {
        this.wasOffline = true;
        this.showOfflineToast();
      });

      window.addEventListener('online', () => {
        if (this.wasOffline) {
          this.showOnlineToast();
          this.wasOffline = false;
        }
      });
    },

    getGameCount() {
      if (typeof window !== 'undefined' && Array.isArray(window.GAMES_REGISTRY) && window.GAMES_REGISTRY.length > 0) {
        return window.GAMES_REGISTRY.length;
      }
      return 118;
    },

    createOfflineIcon() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');

      const elements = [
        { tag: 'line', attrs: { x1: '1', y1: '1', x2: '23', y2: '23' } },
        { tag: 'path', attrs: { d: 'M16.72 11.06A10.94 10.94 0 0 1 19 12.55' } },
        { tag: 'path', attrs: { d: 'M5 12.55a10.94 10.94 0 0 1 5.17-2.39' } },
        { tag: 'path', attrs: { d: 'M10.71 5.05A16 16 0 0 1 22.58 9' } },
        { tag: 'path', attrs: { d: 'M1.42 9a15.91 15.91 0 0 1 4.7-2.88' } },
        { tag: 'path', attrs: { d: 'M8.53 16.11a6 6 0 0 1 6.95 0' } },
        { tag: 'line', attrs: { x1: '12', y1: '20', x2: '12.01', y2: '20' } }
      ];

      elements.forEach(({ tag, attrs }) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
      });

      return svg;
    },

    createOnlineIcon() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');

      const elements = [
        { tag: 'path', attrs: { d: 'M5 12.55a11 11 0 0 1 14.08 0' } },
        { tag: 'path', attrs: { d: 'M1.42 9a16 16 0 0 1 21.16 0' } },
        { tag: 'path', attrs: { d: 'M8.53 16.11a6 6 0 0 1 6.95 0' } },
        { tag: 'line', attrs: { x1: '12', y1: '20', x2: '12.01', y2: '20' } }
      ];

      elements.forEach(({ tag, attrs }) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
      });

      return svg;
    },

    createDismissIcon() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');

      const lines = [
        { x1: '18', y1: '6', x2: '6', y2: '18' },
        { x1: '6', y1: '6', x2: '18', y2: '18' }
      ];

      lines.forEach((attrs) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        Object.entries(attrs).forEach(([k, v]) => line.setAttribute(k, v));
        svg.appendChild(line);
      });

      return svg;
    },

    renderToastNode({ type, title, description, iconSvg, dismissAriaLabel }) {
      const toast = document.createElement('div');
      toast.id = 'network-toast-el';
      toast.className = `network-toast toast-${type} toast-visible`;

      const body = document.createElement('div');
      body.className = 'network-toast-body';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'network-toast-icon';
      iconWrap.appendChild(iconSvg);
      body.appendChild(iconWrap);

      const textWrap = document.createElement('div');
      textWrap.className = 'network-toast-text';

      const titleEl = document.createElement('h4');
      titleEl.className = 'network-toast-title';
      titleEl.textContent = title;
      textWrap.appendChild(titleEl);

      const descEl = document.createElement('p');
      descEl.className = 'network-toast-desc';
      descEl.textContent = description;
      textWrap.appendChild(descEl);

      body.appendChild(textWrap);
      toast.appendChild(body);

      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'btn-toast-dismiss';
      dismissBtn.id = 'toast-dismiss-btn';
      dismissBtn.setAttribute('aria-label', dismissAriaLabel);
      dismissBtn.appendChild(this.createDismissIcon());
      dismissBtn.addEventListener('click', () => this.hideToast());
      toast.appendChild(dismissBtn);

      return toast;
    },

    showOfflineToast() {
      if (!this.toastContainer) return;
      clearTimeout(this.autoHideTimer);

      const gameCount = this.getGameCount();
      const toastEl = this.renderToastNode({
        type: 'offline',
        title: 'Offline Play Mode',
        description: `Internet disconnected. All ${gameCount} local arcade games remain fully playable!`,
        iconSvg: this.createOfflineIcon(),
        dismissAriaLabel: 'Dismiss offline notification'
      });

      this.toastContainer.replaceChildren(toastEl);
    },

    showOnlineToast() {
      if (!this.toastContainer) return;
      clearTimeout(this.autoHideTimer);

      const toastEl = this.renderToastNode({
        type: 'online',
        title: 'Connection Restored',
        description: 'Online. Live GitHub rankings and sync re-established.',
        iconSvg: this.createOnlineIcon(),
        dismissAriaLabel: 'Dismiss online notification'
      });

      this.toastContainer.replaceChildren(toastEl);

      // Auto-dismiss online confirmation after 4 seconds
      this.autoHideTimer = setTimeout(() => {
        this.hideToast();
      }, 4000);
    },

    hideToast() {
      const toast = document.getElementById('network-toast-el');
      if (toast) {
        toast.classList.remove('toast-visible');
        setTimeout(() => {
          if (this.toastContainer) {
            this.toastContainer.replaceChildren();
          }
        }, 300);
      }
    },

    isOnline() {
      return navigator.onLine;
    },

    /**
     * Cross-Origin & CDN Asset Health Verifier (#494)
     * Performs non-blocking probes on critical CDNs and webfonts to detect CORS drops
     */
    verifyCORSResource(url, timeoutMs = 2500) {
      if (!url || typeof url !== 'string') return Promise.resolve(false);
      return new Promise((resolve) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          resolve(false);
        }, timeoutMs);

        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (!timedOut) {
              clearTimeout(timer);
              resolve(true);
            }
          };
          img.onerror = () => {
            if (!timedOut) {
              clearTimeout(timer);
              resolve(false);
            }
          };
          img.src = url;
        } catch (_) {
          clearTimeout(timer);
          resolve(false);
        }
      });
    },

    /**
     * Report CDN resource failure and register system typography fallback
     */
    reportCDNFailure(resourceName) {
      console.warn('[ArcadeNetwork] Cross-origin CDN resource unreachable or blocked: ' + resourceName + '. Utilizing local bundle assets.');
      document.documentElement.classList.add('cdn-fallback-active');
    }
  };

  window.ArcadeNetwork = ArcadeNetwork;
  document.addEventListener('DOMContentLoaded', () => ArcadeNetwork.init());
})();
