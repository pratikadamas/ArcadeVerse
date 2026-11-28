/**
 * Game Modal Quick-Restart & Reset Shortcut Controller (#1546)
 * Handles instant game restarts via toolbar button or keyboard shortcut (Shift + R),
 * debounces spam resets (500ms safety window), and smoothly reloads active game iframe/canvas.
 */

class ModalQuickRestartManager {
    constructor(options = {}) {
        this.debounceMs = options.debounceMs || 500;
        this.lastRestartTime = 0;
        this.toastElement = null;
    }

    createToast() {
        if (typeof document === 'undefined') return null;
        let toast = document.querySelector('.restart-toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'restart-toast-notification';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.textContent = 'Game Restarted (Shift + R)';
            document.body.appendChild(toast);
        }
        this.toastElement = toast;
        return toast;
    }

    showToast(message = 'Game Restarted') {
        const toast = this.toastElement || this.createToast();
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('active');
        setTimeout(() => {
            if (toast) toast.classList.remove('active');
        }, 1200);
    }

    canRestart() {
        const now = Date.now();
        if (now - this.lastRestartTime < this.debounceMs) {
            return false;
        }
        this.lastRestartTime = now;
        return true;
    }

    restartActiveGame() {
        if (!this.canRestart()) return false;

        if (typeof document === 'undefined') return true;

        // Look for active game modal iframe
        const modal = document.querySelector('#game-modal, .game-modal, .modal.active');
        const iframe = modal ? modal.querySelector('iframe') : document.querySelector('iframe.game-frame');

        if (iframe && iframe.src) {
            iframe.classList.add('game-iframe-reloading');
            const currentSrc = iframe.src;
            iframe.src = currentSrc;
            setTimeout(() => {
                iframe.classList.remove('game-iframe-reloading');
            }, 300);
            this.showToast('Game Restarted (Shift + R)');
            return true;
        }

        this.showToast('Restarting Session...');
        return true;
    }

    handleKeyDown(event) {
        if (event.shiftKey && (event.key === 'R' || event.key === 'r')) {
            // Only trigger if an active modal or game iframe is open
            const isModalOpen = typeof document !== 'undefined' && (
                document.querySelector('#game-modal.active') ||
                document.querySelector('.modal.open') ||
                document.querySelector('iframe')
            );

            if (isModalOpen) {
                event.preventDefault();
                this.restartActiveGame();
            }
        }
    }

    init() {
        if (typeof document === 'undefined') return;
        this.createToast();
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseRestart = new ModalQuickRestartManager();
        window.arcadeVerseRestart.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalQuickRestartManager };
}
