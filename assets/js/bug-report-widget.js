/**
 * Floating Feedback & Issue Bug Report Quick-Launch Widget (#1381)
 * Bottom-right floating action pill collecting client environment telemetry
 * (Browser, Screen resolution, active game, active theme) and constructing
 * pre-filled GitHub issue templates.
 */

class BugReportWidget {
    constructor(options = {}) {
        this.repo = options.repo || 'DebasmitaBose0/ArcadeVerse';
        this.storageKey = 'av_bug_report_minimized';
        this.isMinimized = false;
        this.pillElement = null;
    }

    init() {
        if (typeof localStorage !== 'undefined') {
            this.isMinimized = localStorage.getItem(this.storageKey) === 'true';
        }
        this.render();
    }

    collectTelemetry() {
        let ua = 'Unknown';
        let screenRes = 'Unknown';
        let activeTheme = 'default';
        let activeGame = 'None (Catalog)';

        if (typeof navigator !== 'undefined') {
            ua = navigator.userAgent;
        }

        if (typeof window !== 'undefined' && window.screen) {
            screenRes = `${window.screen.width}x${window.screen.height} (Window: ${window.innerWidth}x${window.innerHeight})`;
        }

        if (typeof document !== 'undefined') {
            activeTheme = document.documentElement.getAttribute('data-theme') || 'default';
            const gameTitleElem = document.querySelector('.game-modal-title, #modal-game-title');
            if (gameTitleElem && gameTitleElem.textContent) {
                activeGame = gameTitleElem.textContent.trim();
            }
        }

        return { ua, screenRes, activeTheme, activeGame };
    }

    generateGitHubUrl(userNotes = '') {
        const telemetry = this.collectTelemetry();
        const title = encodeURIComponent(`[Bug Report]: Issue in ${telemetry.activeGame}`);

        const bodyLines = [
            `### Description`,
            userNotes || `A visual or gameplay issue was observed while running ${telemetry.activeGame}.`,
            ``,
            `### System Environment Telemetry`,
            `- **Active Game**: ${telemetry.activeGame}`,
            `- **Active Theme**: ${telemetry.activeTheme}`,
            `- **Screen Resolution**: ${telemetry.screenRes}`,
            `- **User Agent**: ${telemetry.ua}`,
            `- **Timestamp**: ${new Date().toISOString()}`
        ];

        const body = encodeURIComponent(bodyLines.join('\n'));
        return `https://github.com/${this.repo}/issues/new?title=${title}&body=${body}`;
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.storageKey, this.isMinimized.toString());
        }
        if (this.pillElement) {
            if (this.isMinimized) {
                this.pillElement.classList.add('minimized');
            } else {
                this.pillElement.classList.remove('minimized');
            }
        }
    }

    render() {
        if (typeof document === 'undefined') return;

        this.pillElement = document.createElement('div');
        this.pillElement.className = `bug-report-widget ${this.isMinimized ? 'minimized' : ''}`;
        this.pillElement.innerHTML = `
            <button class="bug-report-toggle" aria-label="Report Issue or Feedback" title="Report Bug / Feedback">
                <span class="bug-icon">[!]</span>
                <span class="bug-label">Report Bug</span>
            </button>
            <div class="bug-report-panel">
                <div class="bug-panel-header">
                    <h4>REPORT AN ISSUE</h4>
                    <button class="bug-minimize-btn" title="Minimize">&minus;</button>
                </div>
                <p class="bug-panel-desc">Encountered a glitch or broken game? Telemetry will be automatically attached.</p>
                <textarea class="bug-user-notes" placeholder="Optional notes describing the issue..." rows="3"></textarea>
                <div class="bug-panel-actions">
                    <button class="bug-submit-btn">File on GitHub</button>
                </div>
            </div>
        `;

        const submitBtn = this.pillElement.querySelector('.bug-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const notes = this.pillElement.querySelector('.bug-user-notes').value;
                const url = this.generateGitHubUrl(notes);
                if (typeof window !== 'undefined') {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        }

        const minimizeBtn = this.pillElement.querySelector('.bug-minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
        }

        const toggleBtn = this.pillElement.querySelector('.bug-report-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (this.isMinimized) {
                    this.toggleMinimize();
                } else {
                    this.pillElement.classList.toggle('panel-open');
                }
            });
        }

        document.body.appendChild(this.pillElement);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BugReportWidget };
}

if (typeof window !== 'undefined') {
    window.BugReportWidget = BugReportWidget;
}
