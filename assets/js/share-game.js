/**
 * Copy Game Share Link Direct-to-Clipboard Engine (#1396)
 * Generates canonical game URLs, handles clipboard write with fallbacks,
 * and triggers transient neon toast notifications.
 */

class GameShareManager {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://arcadeverse.dev/');
        this.toastTimeout = null;
        this.clipboardApi = options.clipboard || null;
    }

    buildShareUrl(gameId) {
        if (!gameId) return this.baseUrl;
        const separator = this.baseUrl.includes('?') ? '&' : '?';
        return `${this.baseUrl}${separator}game=${encodeURIComponent(gameId)}`;
    }

    async copyShareLink(gameId, gameTitle = 'Game') {
        const url = this.buildShareUrl(gameId);
        let success = false;

        const clipboard = this.clipboardApi || (typeof navigator !== 'undefined' ? navigator.clipboard : null);

        if (clipboard && typeof clipboard.writeText === 'function') {
            try {
                await clipboard.writeText(url);
                success = true;
            } catch (e) {
                success = this.fallbackCopy(url);
            }
        } else {
            success = this.fallbackCopy(url);
        }

        if (success) {
            this.showToast(`Link for ${gameTitle} copied to clipboard!`);
        }
        return { success, url };
    }

    fallbackCopy(text) {
        const doc = typeof document !== 'undefined' ? document : null;
        if (!doc) return false;
        try {
            const tempInput = doc.createElement('textarea');
            tempInput.value = text;
            tempInput.style = tempInput.style || {};
            tempInput.style.position = 'fixed';
            tempInput.style.opacity = '0';
            doc.body.appendChild(tempInput);
            if (typeof tempInput.select === 'function') tempInput.select();
            const copied = typeof doc.execCommand === 'function' ? doc.execCommand('copy') : true;
            if (doc.body.removeChild) doc.body.removeChild(tempInput);
            return copied;
        } catch (e) {
            return false;
        }
    }

    showToast(message) {
        const doc = typeof document !== 'undefined' ? document : null;
        if (!doc) return;

        let toast = doc.getElementById('arcade-share-toast');
        if (!toast) {
            toast = doc.createElement('div');
            toast.id = 'arcade-share-toast';
            toast.className = 'arcade-share-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            doc.body.appendChild(toast);
        }

        toast.textContent = message;
        if (toast.classList && toast.classList.add) {
            toast.classList.add('visible');
        }

        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        this.toastTimeout = setTimeout(() => {
            if (toast.classList && toast.classList.remove) {
                toast.classList.remove('visible');
            }
        }, 2500);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameShareManager };
}

if (typeof window !== 'undefined') {
    window.GameShareManager = GameShareManager;
}
