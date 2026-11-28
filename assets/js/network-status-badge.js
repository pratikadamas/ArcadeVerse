/**
 * Footer Network & Offline Cache Status Badge Controller (#1550)
 * Listens to window online/offline events, provides real-time connection status,
 * tracks relative time since last online sync, and exposes an accessible status indicator.
 */

class NetworkStatusManager {
    constructor() {
        this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
        this.lastSyncTime = Date.now();
        this.badgeElement = null;
    }

    getStatus() {
        return {
            online: this.isOnline,
            label: this.isOnline ? 'Online' : 'Offline (Cached)',
            lastSyncMs: this.lastSyncTime
        };
    }

    formatRelativeTime(timestamp) {
        const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (diffSeconds < 60) return 'just now';
        const minutes = Math.floor(diffSeconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    }

    updateState(onlineStatus) {
        this.isOnline = Boolean(onlineStatus);
        if (this.isOnline) {
            this.lastSyncTime = Date.now();
        }
        this.updateDOM();
    }

    updateDOM() {
        if (!this.badgeElement) return;

        const { online, label, lastSyncMs } = this.getStatus();
        this.badgeElement.className = `network-status-badge ${online ? 'online' : 'offline'}`;
        this.badgeElement.setAttribute('aria-label', `Network Status: ${label}`);

        const textEl = this.badgeElement.querySelector('.network-status-text');
        if (textEl) textEl.textContent = label;

        const syncEl = this.badgeElement.querySelector('.network-sync-time');
        if (syncEl) syncEl.textContent = `Synced ${this.formatRelativeTime(lastSyncMs)}`;
    }

    render(container) {
        if (!container || typeof document === 'undefined') return null;

        const badge = document.createElement('div');
        badge.className = `network-status-badge ${this.isOnline ? 'online' : 'offline'}`;
        badge.setAttribute('role', 'status');
        badge.setAttribute('aria-live', 'polite');
        badge.innerHTML = `
            <span class="network-dot"></span>
            <span class="network-status-text">${this.isOnline ? 'Online' : 'Offline (Cached)'}</span>
            <span class="network-sync-time">Synced just now</span>
        `;

        this.badgeElement = badge;
        container.appendChild(badge);
        return badge;
    }

    init() {
        if (typeof window === 'undefined') return;
        window.addEventListener('online', () => this.updateState(true));
        window.addEventListener('offline', () => this.updateState(false));
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseNetworkStatus = new NetworkStatusManager();
        window.arcadeVerseNetworkStatus.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NetworkStatusManager };
}
