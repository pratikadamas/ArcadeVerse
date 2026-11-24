/**
 * Dynamic Breadcrumb Navigation Trail for Game Modal Header (#1397)
 * Renders hierarchical trail: ArcadeVerse > {Category} > {Game Title}
 * with clickable navigation hooks to reset or filter the catalog.
 */

class ModalBreadcrumbManager {
    constructor(options = {}) {
        this.onNavigateHome = options.onNavigateHome || null;
        this.onNavigateCategory = options.onNavigateCategory || null;
    }

    renderBreadcrumbs(container, category = 'Arcade', title = 'Game') {
        if (!container) return '';

        const safeCat = category || 'Arcade';
        const safeTitle = title || 'Game';

        const html = `
            <nav class="modal-breadcrumb-nav" aria-label="Breadcrumb">
                <ol class="breadcrumb-list">
                    <li class="breadcrumb-item">
                        <button type="button" class="breadcrumb-link breadcrumb-home">ArcadeVerse</button>
                    </li>
                    <li class="breadcrumb-separator" aria-hidden="true">&gt;</li>
                    <li class="breadcrumb-item">
                        <button type="button" class="breadcrumb-link breadcrumb-cat" data-category="${encodeURIComponent(safeCat)}">${safeCat}</button>
                    </li>
                    <li class="breadcrumb-separator" aria-hidden="true">&gt;</li>
                    <li class="breadcrumb-item breadcrumb-current" aria-current="page">
                        <span class="breadcrumb-title" title="${safeTitle}">${safeTitle}</span>
                    </li>
                </ol>
            </nav>
        `;

        container.innerHTML = html;

        const homeBtn = container.querySelector('.breadcrumb-home');
        if (homeBtn) {
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof this.onNavigateHome === 'function') {
                    this.onNavigateHome();
                }
            });
        }

        const catBtn = container.querySelector('.breadcrumb-cat');
        if (catBtn) {
            catBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const cat = decodeURIComponent(catBtn.getAttribute('data-category'));
                if (typeof this.onNavigateCategory === 'function') {
                    this.onNavigateCategory(cat);
                }
            });
        }

        return html;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModalBreadcrumbManager };
}

if (typeof window !== 'undefined') {
    window.ModalBreadcrumbManager = ModalBreadcrumbManager;
}
