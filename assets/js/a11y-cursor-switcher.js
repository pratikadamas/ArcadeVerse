/**
 * Custom Accessibility Oversized Cursor Switcher Controller (#1552)
 * Provides high-visibility cursor modes (default, large-cyan, large-amber)
 * for users with low vision or tracking fatigue, persisted via localStorage.
 */

class CursorSwitcherManager {
    static STORAGE_KEY = 'arcadeverse_cursor_pref';
    static MODES = ['default', 'large-cyan', 'large-amber'];

    constructor() {
        this.currentMode = this.loadPreference();
    }

    loadPreference() {
        if (typeof localStorage === 'undefined') return 'default';
        const saved = localStorage.getItem(CursorSwitcherManager.STORAGE_KEY);
        return CursorSwitcherManager.MODES.includes(saved) ? saved : 'default';
    }

    setMode(mode) {
        if (!CursorSwitcherManager.MODES.includes(mode)) return false;
        this.currentMode = mode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(CursorSwitcherManager.STORAGE_KEY, mode);
        }
        this.applyToDOM();
        return true;
    }

    applyToDOM() {
        if (typeof document === 'undefined' || !document.body) return;

        CursorSwitcherManager.MODES.forEach((m) => {
            if (m !== 'default') {
                document.body.classList.remove(`cursor-${m}`);
            }
        });

        if (this.currentMode !== 'default') {
            document.body.classList.add(`cursor-${this.currentMode}`);
        }

        const buttons = document.querySelectorAll('.cursor-select-btn');
        buttons.forEach((btn) => {
            const m = btn.getAttribute('data-cursor');
            if (m === this.currentMode) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    renderControl(container) {
        if (!container || typeof document === 'undefined') return null;

        const group = document.createElement('div');
        group.className = 'cursor-switcher-group';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Accessibility Cursor Size');

        CursorSwitcherManager.MODES.forEach((mode) => {
            const btn = document.createElement('button');
            btn.className = `cursor-select-btn ${mode === this.currentMode ? 'active' : ''}`;
            btn.setAttribute('data-cursor', mode);
            btn.setAttribute('aria-pressed', mode === this.currentMode ? 'true' : 'false');
            btn.textContent = mode === 'default' ? 'Default' : (mode === 'large-cyan' ? 'Cyan Large' : 'Amber Large');

            btn.addEventListener('click', () => {
                this.setMode(mode);
            });
            group.appendChild(btn);
        });

        container.appendChild(group);
        return group;
    }

    init() {
        this.applyToDOM();
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseCursor = new CursorSwitcherManager();
        window.arcadeVerseCursor.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CursorSwitcherManager };
}
