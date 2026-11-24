/**
 * Contributor Head-to-Head Comparison Modal (#577)
 * Side-by-side versus comparison modal comparing Arcade Points, Verified Games,
 * Commits, Unlocked Badges, and Shared Categories with animated stats bars.
 */

class ContributorComparisonManager {
    constructor() {
        this.selectedContributors = [];
        this.modalElement = null;
    }

    selectContributor(contributor) {
        if (!contributor || !contributor.username) return false;

        // If already selected, deselect
        const existingIndex = this.selectedContributors.findIndex(c => c.username === contributor.username);
        if (existingIndex >= 0) {
            this.selectedContributors.splice(existingIndex, 1);
            return false;
        }

        // Limit to 2 for head-to-head comparison
        if (this.selectedContributors.length >= 2) {
            this.selectedContributors.shift(); // Evict oldest
        }

        this.selectedContributors.push(contributor);
        return true;
    }

    clearSelection() {
        this.selectedContributors = [];
    }

    canCompare() {
        return this.selectedContributors.length === 2;
    }

    calculateSharedCategories(c1, c2) {
        const cat1 = new Set(c1.categories || []);
        const cat2 = new Set(c2.categories || []);
        const shared = [];
        for (const cat of cat1) {
            if (cat2.has(cat)) shared.push(cat);
        }
        return shared;
    }

    renderComparisonModal() {
        if (!this.canCompare()) return null;

        const [dev1, dev2] = this.selectedContributors;
        const sharedCats = this.calculateSharedCategories(dev1, dev2);

        const stats = [
            { label: 'Arcade Points', v1: dev1.points || 0, v2: dev2.points || 0 },
            { label: 'Verified Games', v1: dev1.games || 0, v2: dev2.games || 0 },
            { label: 'Commits', v1: dev1.commits || 0, v2: dev2.commits || 0 },
            { label: 'Unlocked Badges', v1: dev1.badges || 0, v2: dev2.badges || 0 }
        ];

        let statsHtml = '';
        for (const stat of stats) {
            const maxVal = Math.max(1, stat.v1, stat.v2);
            const pct1 = Math.round((stat.v1 / maxVal) * 100);
            const pct2 = Math.round((stat.v2 / maxVal) * 100);

            statsHtml += `
                <div class="versus-stat-row">
                    <div class="versus-stat-left">
                        <span class="stat-num">${stat.v1}</span>
                        <div class="stat-bar-track left-track">
                            <div class="stat-bar-fill left-fill" style="width: ${pct1}%"></div>
                        </div>
                    </div>
                    <div class="versus-stat-label">${stat.label}</div>
                    <div class="versus-stat-right">
                        <div class="stat-bar-track right-track">
                            <div class="stat-bar-fill right-fill" style="width: ${pct2}%"></div>
                        </div>
                        <span class="stat-num">${stat.v2}</span>
                    </div>
                </div>
            `;
        }

        const sharedCatsHtml = sharedCats.length > 0
            ? sharedCats.map(c => `<span class="versus-shared-chip">${c}</span>`).join('')
            : '<span class="versus-none-text">No shared specializations</span>';

        const modalHtml = `
            <div class="versus-modal-overlay" role="dialog" aria-modal="true" aria-label="Contributor Head-to-Head Comparison">
                <div class="versus-modal-card">
                    <div class="versus-header">
                        <h3>CONTRIBUTOR VERSUS</h3>
                        <button class="versus-close-btn" aria-label="Close comparison">&times;</button>
                    </div>
                    <div class="versus-fighters">
                        <div class="versus-dev dev-one">
                            <div class="versus-avatar">${(dev1.username || 'D1')[0].toUpperCase()}</div>
                            <h4>${dev1.name || dev1.username}</h4>
                            <span class="versus-handle">@${dev1.username}</span>
                        </div>
                        <div class="versus-badge">VS</div>
                        <div class="versus-dev dev-two">
                            <div class="versus-avatar">${(dev2.username || 'D2')[0].toUpperCase()}</div>
                            <h4>${dev2.name || dev2.username}</h4>
                            <span class="versus-handle">@${dev2.username}</span>
                        </div>
                    </div>
                    <div class="versus-stats-container">
                        ${statsHtml}
                    </div>
                    <div class="versus-shared-section">
                        <h5>Shared Game Specializations</h5>
                        <div class="versus-shared-chips">
                            ${sharedCatsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (typeof document !== 'undefined') {
            const div = document.createElement('div');
            div.innerHTML = modalHtml;
            this.modalElement = div.firstElementChild;

            const closeBtn = this.modalElement.querySelector('.versus-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            this.modalElement.addEventListener('click', (e) => {
                if (e.target === this.modalElement) this.close();
            });

            document.body.appendChild(this.modalElement);
        }

        return modalHtml;
    }

    close() {
        if (this.modalElement && this.modalElement.parentNode) {
            this.modalElement.parentNode.removeChild(this.modalElement);
            this.modalElement = null;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContributorComparisonManager };
}

if (typeof window !== 'undefined') {
    window.ContributorComparisonManager = ContributorComparisonManager;
}
