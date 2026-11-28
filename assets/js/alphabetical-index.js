/**
 * Quick Jump Alphabetical Index Bar Controller (#1491)
 * Computes available letter groups from catalog games, renders jump buttons (A-Z, #),
 * handles smooth viewport scrolling with sticky navbar offset, and tracks active section.
 */

class AlphabeticalIndexController {
    constructor(options = {}) {
        this.navbarOffset = options.navbarOffset !== undefined ? options.navbarOffset : 80;
        this.alphabet = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
        this.activeLetter = null;
        this.letterMap = new Map();
    }

    computeLetterMap(gamesList) {
        this.letterMap.clear();
        this.alphabet.forEach(letter => this.letterMap.set(letter, []));

        if (!Array.isArray(gamesList)) return this.letterMap;

        gamesList.forEach(game => {
            const title = (game.title || game.name || '').trim();
            if (!title) return;

            const firstChar = title[0].toUpperCase();
            if (firstChar >= 'A' && firstChar <= 'Z') {
                this.letterMap.get(firstChar).push(game);
            } else {
                this.letterMap.get('#').push(game);
            }
        });

        return this.letterMap;
    }

    hasGamesForLetter(letter) {
        const list = this.letterMap.get(letter);
        return Array.isArray(list) && list.length > 0;
    }

    findTargetCard(letter) {
        if (typeof document === 'undefined') return null;

        const cards = document.querySelectorAll('.game-card, .catalog-card');
        for (const card of cards) {
            const titleEl = card.querySelector('.game-card-title, h3, h4');
            const titleText = (titleEl ? titleEl.textContent : '').trim();
            if (!titleText) continue;

            const firstChar = titleText[0].toUpperCase();
            if (letter === '#' && !(firstChar >= 'A' && firstChar <= 'Z')) {
                return card;
            }
            if (firstChar === letter) {
                return card;
            }
        }
        return null;
    }

    jumpToLetter(letter) {
        this.activeLetter = letter;
        const target = this.findTargetCard(letter);
        if (!target) return false;

        if (typeof window !== 'undefined' && typeof target.getBoundingClientRect === 'function') {
            const rect = target.getBoundingClientRect();
            const currentY = window.pageYOffset || window.scrollY || 0;
            const targetY = currentY + rect.top - this.navbarOffset;

            window.scrollTo({
                top: Math.max(0, targetY),
                behavior: 'smooth'
            });
            return true;
        }
        return false;
    }

    render(container) {
        if (!container) return;

        container.className = 'alphabetical-index-bar';
        container.setAttribute('aria-label', 'Alphabetical Quick Jump');

        let html = '';
        this.alphabet.forEach(letter => {
            const available = this.hasGamesForLetter(letter);
            const activeClass = this.activeLetter === letter ? 'active' : '';
            const disabledAttr = !available ? 'disabled' : '';
            const disabledClass = !available ? 'disabled' : '';

            html += `<button type="button" class="alpha-jump-btn ${activeClass} ${disabledClass}" data-letter="${letter}" ${disabledAttr} aria-label="Jump to ${letter}">${letter}</button>`;
        });

        container.innerHTML = html;

        container.querySelectorAll('.alpha-jump-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const letter = btn.getAttribute('data-letter');
                this.jumpToLetter(letter);
                container.querySelectorAll('.alpha-jump-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AlphabeticalIndexController };
}

if (typeof window !== 'undefined') {
    window.AlphabeticalIndexController = AlphabeticalIndexController;
}
