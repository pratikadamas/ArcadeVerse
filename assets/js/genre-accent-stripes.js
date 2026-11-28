/**
 * Game Card Genre Accent Border Stripes Controller (#1544)
 * Parses category/genre attributes from game cards and assigns
 * sanitized data-genre properties and accessible category accent tags.
 */

class GenreAccentManager {
    static KNOWN_GENRES = {
        action: '#ff0055',
        arcade: '#00f0ff',
        puzzle: '#a371f7',
        racing: '#ff9900',
        retro: '#2ea043',
        strategy: '#e3b341',
        other: '#58a6ff'
    };

    static normalizeGenre(rawGenre) {
        if (!rawGenre || typeof rawGenre !== 'string') return 'other';
        const clean = rawGenre.trim().toLowerCase();
        if (clean.includes('action')) return 'action';
        if (clean.includes('arcade')) return 'arcade';
        if (clean.includes('puzzle')) return 'puzzle';
        if (clean.includes('racing')) return 'racing';
        if (clean.includes('retro')) return 'retro';
        if (clean.includes('strategy')) return 'strategy';
        return GenreAccentManager.KNOWN_GENRES[clean] ? clean : 'other';
    }

    static getAccentColor(genre) {
        const norm = GenreAccentManager.normalizeGenre(genre);
        return GenreAccentManager.KNOWN_GENRES[norm] || GenreAccentManager.KNOWN_GENRES.other;
    }

    applyToCard(cardElement, rawGenre) {
        if (!cardElement) return false;
        const norm = GenreAccentManager.normalizeGenre(rawGenre);
        cardElement.setAttribute('data-genre', norm);

        let tag = cardElement.querySelector('.genre-accent-tag');
        if (!tag && typeof document !== 'undefined') {
            tag = document.createElement('span');
            tag.className = 'genre-accent-tag';
            cardElement.appendChild(tag);
        }
        if (tag) {
            tag.textContent = norm.toUpperCase();
            tag.style.color = GenreAccentManager.getAccentColor(norm);
        }
        return true;
    }

    applyAll() {
        if (typeof document === 'undefined') return 0;
        const cards = document.querySelectorAll('.game-card');
        let count = 0;
        cards.forEach((card) => {
            const genreAttr = card.getAttribute('data-category') || card.getAttribute('data-genre') || '';
            if (this.applyToCard(card, genreAttr)) count++;
        });
        return count;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseGenreAccents = new GenreAccentManager();
        window.arcadeVerseGenreAccents.applyAll();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GenreAccentManager };
}
