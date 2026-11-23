/**
 * Skeleton Loader DOM Helper (#1385)
 * Renders and transitions skeleton placeholder cards matching catalog grid dimensions.
 */

class SkeletonLoaderManager {
    constructor(container = null) {
        this.container = container;
    }

    renderPlaceholders(count = 6) {
        if (!this.container) return '';
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card" aria-hidden="true">
                    <div class="skeleton-shimmer skeleton-thumbnail"></div>
                    <div class="skeleton-shimmer skeleton-title"></div>
                    <div class="skeleton-shimmer skeleton-desc-line1"></div>
                    <div class="skeleton-shimmer skeleton-desc-line2"></div>
                    <div class="skeleton-badge-row">
                        <div class="skeleton-shimmer skeleton-badge"></div>
                        <div class="skeleton-shimmer skeleton-badge"></div>
                    </div>
                </div>
            `;
        }
        this.container.innerHTML = html;
        return html;
    }

    removePlaceholders() {
        if (!this.container) return;
        this.container.innerHTML = '';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SkeletonLoaderManager };
}

if (typeof window !== 'undefined') {
    window.SkeletonLoaderManager = SkeletonLoaderManager;
}
