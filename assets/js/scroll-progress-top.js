/**
 * Floating Back-To-Top Button with Circular Progress Controller (#1492)
 * Computes window scroll percentage and dynamically updates SVG stroke-dashoffset.
 * Shows button past 300px threshold with keyboard accessibility (Enter, Space).
 */

class ScrollProgressTopController {
    constructor(options = {}) {
        this.threshold = options.threshold !== undefined ? options.threshold : 300;
        this.radius = options.radius || 21;
        this.circumference = 2 * Math.PI * this.radius;
        this.buttonElement = null;
        this.progressRing = null;
        this.ticking = false;
    }

    calculateProgress(scrollTop, scrollHeight, clientHeight) {
        const total = scrollHeight - clientHeight;
        if (total <= 0) return 0;
        return Math.max(0, Math.min(100, (scrollTop / total) * 100));
    }

    init(container = null) {
        if (typeof document === 'undefined') return;

        this.buttonElement = document.createElement('button');
        this.buttonElement.type = 'button';
        this.buttonElement.className = 'scroll-progress-top-btn';
        this.buttonElement.setAttribute('aria-label', 'Scroll back to top');
        this.buttonElement.setAttribute('role', 'button');

        this.buttonElement.innerHTML = `
            <svg class="progress-ring-svg" viewBox="0 0 48 48">
                <circle class="progress-ring-track" cx="24" cy="24" r="${this.radius}"></circle>
                <circle class="progress-ring-fill" cx="24" cy="24" r="${this.radius}"
                    stroke-dasharray="${this.circumference}"
                    stroke-dashoffset="${this.circumference}">
                </circle>
            </svg>
            <svg class="scroll-top-arrow" viewBox="0 0 24 24">
                <path d="M12 4l-8 8h5v8h6v-8h5z"></path>
            </svg>
        `;

        this.progressRing = this.buttonElement.querySelector('.progress-ring-fill');

        this.buttonElement.addEventListener('click', () => this.scrollToTop());

        if (container) {
            container.appendChild(this.buttonElement);
        } else if (document.body) {
            document.body.appendChild(this.buttonElement);
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
            this.handleScroll();
        }
    }

    handleScroll() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        const scrollHeight = document.documentElement.scrollHeight || 0;
        const clientHeight = document.documentElement.clientHeight || window.innerHeight || 0;

        const progress = this.calculateProgress(scrollTop, scrollHeight, clientHeight);
        this.updateRing(progress);

        if (this.buttonElement) {
            if (scrollTop > this.threshold) {
                this.buttonElement.classList.add('visible');
            } else {
                this.buttonElement.classList.remove('visible');
            }
        }
    }

    updateRing(percentage) {
        if (!this.progressRing) return;
        const offset = this.circumference - (percentage / 100) * this.circumference;
        this.progressRing.style.strokeDashoffset = `${offset}px`;
    }

    scrollToTop() {
        if (typeof window !== 'undefined') {
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({
                top: 0,
                behavior: prefersReduced ? 'auto' : 'smooth'
            });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScrollProgressTopController };
}

if (typeof window !== 'undefined') {
    window.ScrollProgressTopController = ScrollProgressTopController;
}
