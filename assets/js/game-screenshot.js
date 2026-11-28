/**
 * In-Browser Screenshot Capture Tool (#1493)
 * Captures active game canvas frames, adds branded retro watermark,
 * generates timestamped PNG downloads (ArcadeVerse-<Game>-<Timestamp>.png),
 * and triggers camera shutter flash animations.
 */

class GameScreenshotUtility {
    constructor() {
        this.flashElement = null;
    }

    generateFilename(gameTitle = 'Game') {
        const cleanTitle = (gameTitle || 'Game')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-');
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        return `ArcadeVerse-${cleanTitle}-${timestamp}.png`;
    }

    triggerFlashAnimation() {
        if (typeof document === 'undefined') return;

        if (!this.flashElement) {
            this.flashElement = document.createElement('div');
            this.flashElement.className = 'screenshot-flash-overlay';
            document.body.appendChild(this.flashElement);
        }

        this.flashElement.classList.add('flashing');
        setTimeout(() => {
            if (this.flashElement) {
                this.flashElement.classList.remove('flashing');
            }
        }, 150);
    }

    addWatermark(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('ArcadeVerse', canvas.width - 12, canvas.height - 12);
        ctx.restore();
    }

    async captureCanvas(canvas, gameTitle = 'Game') {
        if (!canvas) return null;

        this.triggerFlashAnimation();

        // Create an offscreen copy so we do not mutate live game frame directly
        let exportCanvas = canvas;
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            try {
                const offscreen = document.createElement('canvas');
                offscreen.width = canvas.width;
                offscreen.height = canvas.height;
                const oCtx = offscreen.getContext('2d');
                if (oCtx) {
                    oCtx.drawImage(canvas, 0, 0);
                    this.addWatermark(offscreen);
                    exportCanvas = offscreen;
                }
            } catch (e) {}
        }

        const dataUrl = exportCanvas.toDataURL ? exportCanvas.toDataURL('image/png') : '';
        const filename = this.generateFilename(gameTitle);

        return {
            dataUrl,
            filename
        };
    }

    downloadScreenshot(dataUrl, filename) {
        if (!dataUrl || typeof document === 'undefined') return false;
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return true;
        } catch (e) {
            return false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameScreenshotUtility };
}

if (typeof window !== 'undefined') {
    window.GameScreenshotUtility = GameScreenshotUtility;
}
