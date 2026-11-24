/**
 * Game Modal Exit Confirmation Manager (#1393)
 * Manages quit game confirmation prompts with session-persisted "Don't ask again" preference.
 */

class ExitConfirmationManager {
    constructor() {
        this.sessionKey = 'av_skip_exit_confirmation';
    }

    shouldPrompt() {
        if (typeof sessionStorage === 'undefined') return true;
        try {
            return sessionStorage.getItem(this.sessionKey) !== 'true';
        } catch (e) {
            return true;
        }
    }

    setSkipConfirmation(skip = true) {
        if (typeof sessionStorage === 'undefined') return;
        try {
            if (skip) {
                sessionStorage.setItem(this.sessionKey, 'true');
            } else {
                sessionStorage.removeItem(this.sessionKey);
            }
        } catch (e) {}
    }

    resetPreference() {
        this.setSkipConfirmation(false);
    }

    renderConfirmationDialog(onConfirm, onCancel) {
        if (!this.shouldPrompt()) {
            if (typeof onConfirm === 'function') onConfirm();
            return null;
        }

        if (typeof document === 'undefined') return null;

        const overlay = document.createElement('div');
        overlay.className = 'exit-dialog-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Exit Game Confirmation');

        overlay.innerHTML = `
            <div class="exit-dialog-card">
                <h3>QUIT CURRENT GAME?</h3>
                <p>Are you sure you want to return to the arcade catalog? Any unsaved round progress will be lost.</p>
                <label class="exit-dialog-checkbox-label">
                    <input type="checkbox" id="dont-ask-exit-session">
                    <span>Don't ask again this session</span>
                </label>
                <div class="exit-dialog-actions">
                    <button class="exit-btn-cancel">Resume Game</button>
                    <button class="exit-btn-confirm">Exit to Catalog</button>
                </div>
            </div>
        `;

        const chk = overlay.querySelector('#dont-ask-exit-session');
        const confirmBtn = overlay.querySelector('.exit-btn-confirm');
        const cancelBtn = overlay.querySelector('.exit-btn-cancel');

        const closeDialog = () => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        confirmBtn.addEventListener('click', () => {
            if (chk && chk.checked) {
                this.setSkipConfirmation(true);
            }
            closeDialog();
            if (typeof onConfirm === 'function') onConfirm();
        });

        cancelBtn.addEventListener('click', () => {
            closeDialog();
            if (typeof onCancel === 'function') onCancel();
        });

        document.body.appendChild(overlay);
        return overlay;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExitConfirmationManager };
}

if (typeof window !== 'undefined') {
    window.ExitConfirmationManager = ExitConfirmationManager;
}
