/**
 * Footer Status Pill & PWA Cache Inspection Engine (#1394)
 * Monitors online/offline network events, checks Service Worker controller cache readiness,
 * and renders a pulsing status indicator pill in the site footer.
 */

class SystemStatusPill {
    constructor(options = {}) {
        this.version = options.version || 'v2.4.0';
        this.containerElement = null;
        this.isOnline = true;
        this.hasPwa = false;
    }

    init(containerElement) {
        this.containerElement = containerElement;
        this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
        this.hasPwa = typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker && navigator.serviceWorker.controller);

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.render();
            });
            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.render();
            });
        }

        this.render();
    }

    render() {
        if (!this.containerElement) return;

        let statusText = 'Vault Online';
        let statusClass = 'status-online';

        if (!this.isOnline) {
            statusClass = 'status-offline';
            statusText = this.hasPwa ? 'Offline Ready (PWA Active)' : 'Offline (Disconnected)';
        }

        this.containerElement.className = 'arcade-status-pill-container';
        this.containerElement.innerHTML = `
            <span class="status-indicator-dot ${statusClass}" aria-hidden="true"></span>
            <span class="status-indicator-text">${statusText}</span>
            <span class="status-version-badge">${this.version}</span>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SystemStatusPill };
}

if (typeof window !== 'undefined') {
    window.SystemStatusPill = SystemStatusPill;
}
