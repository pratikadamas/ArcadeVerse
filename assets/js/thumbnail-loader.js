/**
 * Catalog Thumbnail Lazy-Loader & Fallback Controller (#1543)
 * Uses IntersectionObserver to defer loading of catalog card images,
 * applies smooth fade-in animations upon completion, and renders an SVG arcade cabinet fallback on 404/network error.
 */

class ThumbnailLoaderManager {
    static FALLBACK_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'%3E%3Crect width='300' height='180' fill='%230d1117'/%3E%3Crect x='100' y='40' width='100' height='70' rx='6' fill='%23161b22' stroke='%2330363d' stroke-width='2'/%3E%3Ccircle cx='130' cy='140' r='10' fill='%23ff0055'/%3E%3Ccircle cx='170' cy='140' r='10' fill='%2300f0ff'/%3E%3Ctext x='150' y='82' fill='%238b949e' font-family='sans-serif' font-size='12' font-weight='bold' text-anchor='middle'%3EARCADE%3C/text%3E%3C/svg%3E";

    constructor(options = {}) {
        this.rootMargin = options.rootMargin || '50px';
        this.threshold = options.threshold || 0.05;
        this.observer = null;
        this.initObserver();
    }

    initObserver() {
        if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

        this.observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    obs.unobserve(img);
                    this.loadImage(img);
                }
            });
        }, {
            rootMargin: this.rootMargin,
            threshold: this.threshold
        });
    }

    observeImage(imgElement) {
        if (!imgElement) return;
        if (!this.observer) {
            this.loadImage(imgElement);
            return;
        }
        this.observer.observe(imgElement);
    }

    loadImage(imgElement) {
        if (!imgElement) return;

        const src = imgElement.getAttribute('data-src');
        if (!src) return;

        imgElement.onload = () => {
            imgElement.classList.add('loaded');
            const parent = imgElement.closest('.game-thumbnail-wrapper');
            if (parent) {
                const skeleton = parent.querySelector('.game-thumbnail-skeleton');
                if (skeleton) skeleton.remove();
            }
        };

        imgElement.onerror = () => {
            imgElement.src = ThumbnailLoaderManager.FALLBACK_SVG;
            imgElement.classList.add('loaded', 'fallback-applied');
            const parent = imgElement.closest('.game-thumbnail-wrapper');
            if (parent) {
                const skeleton = parent.querySelector('.game-thumbnail-skeleton');
                if (skeleton) skeleton.remove();
            }
        };

        imgElement.src = src;
    }

    scanAndObserve() {
        if (typeof document === 'undefined') return;
        const lazyImages = document.querySelectorAll('img[data-src]:not(.loaded)');
        lazyImages.forEach((img) => this.observeImage(img));
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseThumbnails = new ThumbnailLoaderManager();
        window.arcadeVerseThumbnails.scanAndObserve();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThumbnailLoaderManager };
}
