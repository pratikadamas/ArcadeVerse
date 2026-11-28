/**
 * Distraction-Free Game Theater Dimmer Slider Controller (#1549)
 * Regulates the backdrop opacity when playing games in modal/theater mode.
 * Clamps opacity between 0.40 (ambient) and 0.98 (near pitch dark) and persists in localStorage.
 */

class TheaterDimmerManager {
    static STORAGE_KEY = 'arcadeverse_theater_dimmer';
    static MIN_OPACITY = 0.40;
    static MAX_OPACITY = 0.98;
    static DEFAULT_OPACITY = 0.85;

    constructor() {
        this.opacity = this.loadOpacity();
    }

    loadOpacity() {
        if (typeof localStorage === 'undefined') return TheaterDimmerManager.DEFAULT_OPACITY;
        const saved = parseFloat(localStorage.getItem(TheaterDimmerManager.STORAGE_KEY));
        if (isNaN(saved)) return TheaterDimmerManager.DEFAULT_OPACITY;
        return this.clampOpacity(saved);
    }

    clampOpacity(val) {
        return Math.min(TheaterDimmerManager.MAX_OPACITY, Math.max(TheaterDimmerManager.MIN_OPACITY, val));
    }

    setOpacity(val) {
        this.opacity = this.clampOpacity(parseFloat(val) || TheaterDimmerManager.DEFAULT_OPACITY);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(TheaterDimmerManager.STORAGE_KEY, String(this.opacity));
        }
        this.applyToDOM();
        return this.opacity;
    }

    applyToDOM() {
        if (typeof document === 'undefined') return;

        const backdrop = document.querySelector('.modal-backdrop, #game-modal-backdrop, .modal-overlay');
        if (backdrop) {
            backdrop.classList.add('theater-active');
            backdrop.style.backgroundColor = `rgba(0, 0, 0, ${this.opacity})`;
        }

        const valueDisplays = document.querySelectorAll('.theater-dimmer-value');
        valueDisplays.forEach((el) => {
            el.textContent = `${Math.round(this.opacity * 100)}%`;
        });
    }

    renderControl(container) {
        if (!container || typeof document === 'undefined') return null;

        const wrap = document.createElement('div');
        wrap.className = 'theater-dimmer-control';
        wrap.innerHTML = `
            <span>Dimmer</span>
            <input type="range" class="theater-dimmer-slider" 
                   min="${TheaterDimmerManager.MIN_OPACITY * 100}" 
                   max="${TheaterDimmerManager.MAX_OPACITY * 100}" 
                   value="${Math.round(this.opacity * 100)}"
                   aria-label="Theater Mode Backdrop Opacity">
            <span class="theater-dimmer-value">${Math.round(this.opacity * 100)}%</span>
        `;

        const slider = wrap.querySelector('.theater-dimmer-slider');
        slider.addEventListener('input', (e) => {
            const val = Number(e.target.value) / 100;
            this.setOpacity(val);
        });

        container.appendChild(wrap);
        return wrap;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.arcadeVerseDimmer = new TheaterDimmerManager();
        window.arcadeVerseDimmer.applyToDOM();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TheaterDimmerManager };
}
