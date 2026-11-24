/**
 * Category Quick-Filter Horizontal Scrollbar Engine (#1387)
 * Controls smooth left/right chevron scrolling and auto-centers clicked category chips.
 */

class CategoryScrollTrack {
    constructor(container = null, stepPixels = 150) {
        this.container = container;
        this.stepPixels = stepPixels;
        this.leftButton = null;
        this.rightButton = null;
    }

    init(leftBtn, rightBtn) {
        this.leftButton = leftBtn;
        this.rightButton = rightBtn;

        if (this.leftButton && typeof this.leftButton.addEventListener === 'function') {
            this.leftButton.addEventListener('click', () => this.scrollLeft());
        }
        if (this.rightButton && typeof this.rightButton.addEventListener === 'function') {
            this.rightButton.addEventListener('click', () => this.scrollRight());
        }
        if (this.container && typeof this.container.addEventListener === 'function') {
            this.container.addEventListener('scroll', () => this.updateStepperVisibility());
        }
        this.updateStepperVisibility();
    }

    scrollLeft() {
        if (!this.container) return 0;
        this.container.scrollBy({ left: -this.stepPixels, behavior: 'smooth' });
        return this.container.scrollLeft - this.stepPixels;
    }

    scrollRight() {
        if (!this.container) return 0;
        this.container.scrollBy({ left: this.stepPixels, behavior: 'smooth' });
        return this.container.scrollLeft + this.stepPixels;
    }

    centerPill(pillElement) {
        if (!pillElement || !this.container) return;
        const containerWidth = this.container.clientWidth;
        const pillLeft = pillElement.offsetLeft;
        const pillWidth = pillElement.clientWidth;

        const targetScroll = pillLeft - (containerWidth / 2) + (pillWidth / 2);
        this.container.scrollTo({
            left: Math.max(0, targetScroll),
            behavior: 'smooth'
        });
    }

    updateStepperVisibility() {
        if (!this.container) return;
        const { scrollLeft, scrollWidth, clientWidth } = this.container;

        if (this.leftButton && this.leftButton.style) {
            this.leftButton.style.display = scrollLeft > 10 ? 'flex' : 'none';
        }
        if (this.rightButton && this.rightButton.style) {
            this.rightButton.style.display = (scrollLeft + clientWidth < scrollWidth - 10) ? 'flex' : 'none';
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CategoryScrollTrack };
}

if (typeof window !== 'undefined') {
    window.CategoryScrollTrack = CategoryScrollTrack;
}
