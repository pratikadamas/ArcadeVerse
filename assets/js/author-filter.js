/**
 * Game Author Filter Dropdown & Creator Attribution Controller (#1551)
 * Extracts author/contributor attributions from games list, aggregates creator game counts,
 * and allows filtering the catalog to view individual developer portfolios.
 */

class AuthorFilterManager {
    constructor() {
        this.authorsMap = new Map();
        this.selectedAuthor = '';
    }

    aggregateAuthors(games) {
        this.authorsMap.clear();
        if (!Array.isArray(games)) return this.authorsMap;

        games.forEach((game) => {
            const author = (game.author || game.developer || game.contributor || 'ArcadeVerse').trim();
            if (author) {
                this.authorsMap.set(author, (this.authorsMap.get(author) || 0) + 1);
            }
        });

        return this.authorsMap;
    }

    filterGamesByAuthor(games, author) {
        if (!author || author === 'all') return games;
        if (!Array.isArray(games)) return [];

        return games.filter((game) => {
            const gameAuthor = (game.author || game.developer || game.contributor || 'ArcadeVerse').trim().toLowerCase();
            return gameAuthor === author.toLowerCase();
        });
    }

    renderDropdown(container, onSelectAuthor) {
        if (!container || typeof document === 'undefined') return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'author-filter-wrapper';

        const label = document.createElement('label');
        label.textContent = 'Creator:';
        label.style.fontSize = '0.8rem';
        label.style.color = '#8b949e';

        const select = document.createElement('select');
        select.className = 'author-filter-select';
        select.setAttribute('aria-label', 'Filter games by creator');

        const defaultOpt = document.createElement('option');
        defaultOpt.value = 'all';
        defaultOpt.textContent = 'All Creators';
        select.appendChild(defaultOpt);

        const sortedAuthors = Array.from(this.authorsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedAuthors.forEach(([author, count]) => {
            const opt = document.createElement('option');
            opt.value = author;
            opt.textContent = `${author} (${count})`;
            if (author === this.selectedAuthor) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            this.selectedAuthor = e.target.value;
            if (typeof onSelectAuthor === 'function') {
                onSelectAuthor(this.selectedAuthor);
            }
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        container.appendChild(wrapper);
        return wrapper;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseAuthorFilter = new AuthorFilterManager();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthorFilterManager };
}
