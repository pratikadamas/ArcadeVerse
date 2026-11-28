/**
 * Keyboard-Focused Card Action Prompt Bar (#1541)
 * Detects keyboard focus on game cards and surfaces a sleek HUD prompt bar
 * showing action shortcuts (Enter to Play, F to Favorite, Space for Info).
 */

class FocusActionPromptBar {
    constructor() {
        this.barElement = null;
        this.activeCard = null;
        this.hideTimeout = null;
    }

    createPromptBar() {
        if (typeof document === 'undefined') return null;

        const bar = document.createElement('div');
        bar.className = 'focus-action-prompt-bar';
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-live', 'polite');

        bar.innerHTML = `
            <span class="prompt-game-title" id="prompt-active-title">Select Game</span>
            <div class="prompt-shortcuts-group">
                <span class="prompt-shortcut-item"><kbd class="prompt-key-badge">Enter</kbd> Play</span>
                <span class="prompt-shortcut-item"><kbd class="prompt-key-badge">F</kbd> Favorite</span>
                <span class="prompt-shortcut-item"><kbd class="prompt-key-badge">I</kbd> Info</span>
            </div>
        `;
        document.body.appendChild(bar);
        this.barElement = bar;
        return bar;
    }

    show(gameTitle = 'Selected Game') {
        if (!this.barElement) {
            this.createPromptBar();
        }
        if (!this.barElement) return;

        clearTimeout(this.hideTimeout);
        const titleElem = this.barElement.querySelector('#prompt-active-title');
        if (titleElem) {
            titleElem.textContent = gameTitle;
        }
        this.barElement.classList.add('visible');
    }

    hide() {
        if (!this.barElement) return;
        this.hideTimeout = setTimeout(() => {
            if (this.barElement) {
                this.barElement.classList.remove('visible');
            }
        }, 120);
    }

    handleFocusIn(event) {
        const card = event.target.closest('.game-card');
        if (card) {
            this.activeCard = card;
            const titleElem = card.querySelector('.game-card-title, h3, h4');
            const title = titleElem ? titleElem.textContent.trim() : 'Game';
            this.show(title);
        }
    }

    handleFocusOut(event) {
        const card = event.target.closest('.game-card');
        if (card) {
            this.activeCard = null;
            this.hide();
        }
    }

    init() {
        if (typeof document === 'undefined') return;
        this.createPromptBar();

        document.addEventListener('focusin', (e) => this.handleFocusIn(e));
        document.addEventListener('focusout', (e) => this.handleFocusOut(e));
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseActionPrompt = new FocusActionPromptBar();
        window.arcadeVerseActionPrompt.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FocusActionPromptBar };
}
