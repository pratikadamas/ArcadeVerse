/**
 * LocalStorage Usage Inspector & Cache Cleaner Drawer (#1542)
 * Measures UTF-16 byte storage consumption across all keys,
 * renders quota gauges, and enables clearing specific cache entries or full resets.
 */

class StorageInspectorManager {
    static ESTIMATED_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB typical browser quota

    constructor() {
        this.drawerElement = null;
    }

    calculateUsage() {
        if (typeof localStorage === 'undefined') {
            return { totalBytes: 0, formattedTotal: '0 KB', items: [] };
        }

        let totalBytes = 0;
        const items = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            const value = localStorage.getItem(key) || '';
            // UTF-16 strings take 2 bytes per char
            const itemBytes = (key.length + value.length) * 2;
            totalBytes += itemBytes;
            items.push({
                key,
                bytes: itemBytes,
                formatted: this.formatBytes(itemBytes)
            });
        }

        items.sort((a, b) => b.bytes - a.bytes);

        return {
            totalBytes,
            formattedTotal: this.formatBytes(totalBytes),
            percentageOfQuota: Math.min(100, (totalBytes / StorageInspectorManager.ESTIMATED_QUOTA_BYTES) * 100),
            items
        };
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        const kb = (bytes / 1024).toFixed(1);
        if (bytes < 1024 * 1024) return `${kb} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    deleteKey(key) {
        if (typeof localStorage === 'undefined' || !key) return false;
        localStorage.removeItem(key);
        return true;
    }

    clearArcadeVerseData() {
        if (typeof localStorage === 'undefined') return 0;
        let removed = 0;
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('arcadeverse') || key.startsWith('arcade_'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((k) => {
            localStorage.removeItem(k);
            removed++;
        });
        return removed;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseStorageInspector = new StorageInspectorManager();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageInspectorManager };
}
