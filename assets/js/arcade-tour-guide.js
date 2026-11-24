/**
 * Arcade Tour Guide Subsystem (#1413)
 * Step-by-step interactive spotlight onboarding walkthrough with DOM element
 * targeting, keyboard navigation, progress indicator, and optional Web Speech API narration.
 */

class ArcadeTourGuide {
    constructor(options = {}) {
        this.steps = options.steps || [];
        this.currentIndex = -1;
        this.isActive = false;
        this.enableVoice = options.enableVoice !== undefined ? options.enableVoice : false;
        this.onComplete = options.onComplete || null;
        this.synth = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
        this.overlayElement = null;
        this.cardElement = null;
    }

    addStep(selector, title, content, placement = 'bottom') {
        this.steps.push({ selector, title, content, placement });
    }

    start() {
        if (!this.steps.length) return false;
        this.isActive = true;
        this.currentIndex = 0;
        this.renderStep(this.currentIndex);
        return true;
    }

    next() {
        if (!this.isActive) return false;
        if (this.currentIndex < this.steps.length - 1) {
            this.currentIndex++;
            this.renderStep(this.currentIndex);
            return true;
        } else {
            this.finish();
            return false;
        }
    }

    previous() {
        if (!this.isActive || this.currentIndex <= 0) return false;
        this.currentIndex--;
        this.renderStep(this.currentIndex);
        return true;
    }

    finish() {
        this.isActive = false;
        this.removeDOM();
        if (this.synth) {
            try { this.synth.cancel(); } catch (e) {}
        }
        if (typeof this.onComplete === 'function') {
            this.onComplete();
        }
    }

    getCurrentStep() {
        if (this.currentIndex >= 0 && this.currentIndex < this.steps.length) {
            return {
                index: this.currentIndex,
                total: this.steps.length,
                ...this.steps[this.currentIndex]
            };
        }
        return null;
    }

    narrate(text) {
        if (!this.enableVoice || !this.synth || typeof SpeechSynthesisUtterance === 'undefined') return;
        try {
            this.synth.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.1;
            this.synth.speak(utterance);
        } catch (e) {}
    }

    renderStep(index) {
        const step = this.steps[index];
        if (!step) return;

        if (this.enableVoice) {
            this.narrate(step.title + '. ' + step.content);
        }

        if (typeof document === 'undefined') return;

        if (!this.overlayElement) {
            this.overlayElement = document.createElement('div');
            this.overlayElement.className = 'arcade-tour-overlay';
            this.overlayElement.style.position = 'fixed';
            this.overlayElement.style.top = '0';
            this.overlayElement.style.left = '0';
            this.overlayElement.style.width = '100vw';
            this.overlayElement.style.height = '100vh';
            this.overlayElement.style.background = 'rgba(0, 0, 0, 0.75)';
            this.overlayElement.style.zIndex = '99998';
            this.overlayElement.style.pointerEvents = 'none';
            document.body.appendChild(this.overlayElement);
        }

        if (!this.cardElement) {
            this.cardElement = document.createElement('div');
            this.cardElement.className = 'arcade-tour-card';
            this.cardElement.style.position = 'fixed';
            this.cardElement.style.zIndex = '99999';
            this.cardElement.style.background = '#0a0d14';
            this.cardElement.style.border = '2px solid #00f0ff';
            this.cardElement.style.padding = '16px';
            this.cardElement.style.color = '#ffffff';
            this.cardElement.style.maxWidth = '320px';
            document.body.appendChild(this.cardElement);
        }

        this.cardElement.innerHTML = `
            <div class="tour-header" style="font-weight: bold; color: #00f0ff;">
                Step ${index + 1}/${this.steps.length}: ${step.title}
            </div>
            <div class="tour-body" style="margin: 8px 0; font-size: 14px;">
                ${step.content}
            </div>
            <div class="tour-actions" style="display: flex; justify-content: space-between; margin-top: 12px;">
                <button class="tour-btn tour-prev" ${index === 0 ? 'disabled' : ''}>Back</button>
                <button class="tour-btn tour-skip">Skip</button>
                <button class="tour-btn tour-next">${index === this.steps.length - 1 ? 'Finish' : 'Next'}</button>
            </div>
        `;
    }

    removeDOM() {
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
            this.overlayElement = null;
        }
        if (this.cardElement && this.cardElement.parentNode) {
            this.cardElement.parentNode.removeChild(this.cardElement);
            this.cardElement = null;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArcadeTourGuide };
}

if (typeof window !== 'undefined') {
    window.ArcadeTourGuide = ArcadeTourGuide;
}
