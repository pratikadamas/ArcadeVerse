/**
 * Retro Loading Progress Bar with Neon Segment Blocks (#1398)
 * 8-bit segmented loading bar animating realistic arcade boot stages
 * (Loading ROM -> Mounting Audio -> Ready) with smooth auto-dismissal.
 */

class RetroLoaderManager {
    constructor(options = {}) {
        this.totalSegments = options.segments || 10;
        this.currentProgress = 0; // 0 to 100
        this.containerElement = null;
        this.stages = [
            { threshold: 30, text: 'Loading ROM Cartridge...' },
            { threshold: 70, text: 'Mounting Audio Synth...' },
            { threshold: 99, text: 'Calibrating Input Buffer...' },
            { threshold: 100, text: 'READY!' }
        ];
    }

    render(parentElement) {
        if (!parentElement) return;

        this.containerElement = document.createElement('div');
        this.containerElement.className = 'retro-loader-container';
        this.containerElement.setAttribute('role', 'progressbar');
        this.containerElement.setAttribute('aria-valuemin', '0');
        this.containerElement.setAttribute('aria-valuemax', '100');
        this.containerElement.setAttribute('aria-valuenow', '0');

        let segmentsHtml = '';
        for (let i = 0; i < this.totalSegments; i++) {
            segmentsHtml += `<span class="retro-loader-block" data-index="${i}"></span>`;
        }

        this.containerElement.innerHTML = `
            <div class="retro-loader-stage-text">Initializing ROM...</div>
            <div class="retro-loader-bar">
                ${segmentsHtml}
            </div>
            <div class="retro-loader-percent">0%</div>
        `;

        parentElement.appendChild(this.containerElement);
        this.setProgress(0);
    }

    setProgress(pct) {
        const clamped = Math.max(0, Math.min(100, Math.round(pct)));
        this.currentProgress = clamped;
        if (!this.containerElement) return;

        this.containerElement.setAttribute('aria-valuenow', clamped.toString());

        // Update active stage text
        let stageText = 'Initializing...';
        for (const stage of this.stages) {
            if (clamped <= stage.threshold) {
                stageText = stage.text;
                break;
            }
        }
        if (clamped === 100) stageText = 'READY!';

        const textEl = this.containerElement.querySelector('.retro-loader-stage-text');
        if (textEl) textEl.textContent = stageText;

        const pctEl = this.containerElement.querySelector('.retro-loader-percent');
        if (pctEl) pctEl.textContent = `${clamped}%`;

        // Update neon segment blocks
        const activeBlocks = Math.round((clamped / 100) * this.totalSegments);
        const blocks = this.containerElement.querySelectorAll('.retro-loader-block');
        blocks.forEach((block, idx) => {
            if (idx < activeBlocks) {
                block.classList.add('active');
            } else {
                block.classList.remove('active');
            }
        });
    }

    dismiss(fadeMs = 250) {
        if (!this.containerElement) return;
        this.setProgress(100);
        this.containerElement.classList.add('fade-out');
        setTimeout(() => {
            if (this.containerElement && this.containerElement.parentNode) {
                this.containerElement.parentNode.removeChild(this.containerElement);
                this.containerElement = null;
            }
        }, fadeMs);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RetroLoaderManager };
}

if (typeof window !== 'undefined') {
    window.RetroLoaderManager = RetroLoaderManager;
}
