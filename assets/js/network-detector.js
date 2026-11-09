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

    showOfflineToast() {
      if (!this.toastContainer) return;
      clearTimeout(this.autoHideTimer);

      this.toastContainer.innerHTML = `
        <div class="network-toast toast-offline toast-visible" id="network-toast-el">
          <div class="network-toast-body">
            <div class="network-toast-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
            </div>
            <div class="network-toast-text">
              <h4 class="network-toast-title">Offline Play Mode</h4>
              <p class="network-toast-desc">Internet disconnected. All 30 local arcade games remain fully playable!</p>
            </div>
          </div>
          <button type="button" class="btn-toast-dismiss" id="toast-dismiss-btn" aria-label="Dismiss offline notification">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      const dismissBtn = this.toastContainer.querySelector('#toast-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => this.hideToast());
      }
    },

    showOnlineToast() {
      if (!this.toastContainer) return;
      clearTimeout(this.autoHideTimer);

      this.toastContainer.innerHTML = `
        <div class="network-toast toast-online toast-visible" id="network-toast-el">
          <div class="network-toast-body">
            <div class="network-toast-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
            </div>
            <div class="network-toast-text">
              <h4 class="network-toast-title">Connection Restored</h4>
              <p class="network-toast-desc">Online. Live GitHub rankings and sync re-established.</p>
            </div>
          </div>
          <button type="button" class="btn-toast-dismiss" id="toast-dismiss-btn" aria-label="Dismiss online notification">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      const dismissBtn = this.toastContainer.querySelector('#toast-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => this.hideToast());
      }

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
          if (this.toastContainer) this.toastContainer.innerHTML = '';
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
