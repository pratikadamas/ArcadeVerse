/**
 * Arcade Time Capsule & Milestone Chronology Timeline View (#601)
 * Interactive animated chronological roadmap spanning foundational genesis,
 * seasonal hackathon events, and the 100+ Game Centurion milestone.
 */

class ArcadeTimeCapsule {
    constructor(options = {}) {
        this.onPlayGame = options.onPlayGame || null;
        this.activeEra = 'genesis';
        this.milestoneEras = [
            {
                id: 'genesis',
                name: 'Phase 1: Genesis Era',
                date: 'Q1 2026',
                highlight: 'Foundational retro canvas games & core player modal launch',
                contributors: ['DebasmitaBose0', 'harshalkurrey'],
                games: [
                    { id: 'asteroid-miner', title: 'Asteroid Miner', icon: 'AST' },
                    { id: 'cyber-brick-breaker', title: 'Cyber Brick Breaker', icon: 'BRK' },
                    { id: 'cyber-neon-pong', title: 'Cyber Neon Pong', icon: 'PNG' },
                    { id: 'space-invaders-2026', title: 'Space Invaders 2026', icon: 'INV' }
                ]
            },
            {
                id: 'spooky',
                name: 'Phase 2: Spooky Season 2026',
                date: 'Halloween 2026',
                highlight: 'Halloween Special community event, interactive story quests & sound FX',
                contributors: ['hrshjswniii', 'Babin123456'],
                games: [
                    { id: 'witchs-crypt', title: "Witch's Crypt: Escape Room", icon: 'WTC' },
                    { id: 'haunted-house', title: 'Haunted House: The Curse Within', icon: 'HNT' },
                    { id: 'pumpkin-express', title: 'Pumpkin Express', icon: 'PMK' }
                ]
            },
            {
                id: 'quantum',
                name: 'Phase 3: Quantum & Cyber Surge',
                date: 'Q3 2026',
                highlight: 'Physics engines, logic puzzles, and NSOC 2026 community surge',
                contributors: ['QuantumTeam', 'RetroPilot'],
                games: [
                    { id: 'quantum-minesweeper-dx', title: 'Quantum Minesweeper DX', icon: 'QMN' },
                    { id: 'cyber-typer', title: 'Cyber Typer', icon: 'TYP' },
                    { id: 'quantum-sokoban', title: 'Quantum Sokoban', icon: 'SOK' },
                    { id: 'cyber-katana', title: 'Cyber Katana', icon: 'KTN' }
                ]
            },
            {
                id: 'centurion',
                name: 'Phase 4: Centurion Milestone (100+ Games)',
                date: 'Present Day',
                highlight: '100+ Game milestone, dynamic playlists, contributor rankings, and global search',
                contributors: ['All Contributors', 'Community'],
                games: [
                    { id: 'cyber-traffic-control', title: 'Cyber Traffic Control', icon: 'TRF' },
                    { id: 'neon-infiltration', title: 'Neon Infiltration', icon: 'INF' },
                    { id: 'potion-maker', title: 'Potion Maker', icon: 'PTN' },
                    { id: 'deep-sea-explorer', title: 'Deep Sea Explorer', icon: 'SEA' }
                ]
            }
        ];
    }

    renderTimeline(container) {
        if (!container) return '';

        let navHtml = '<nav class="time-capsule-era-nav" aria-label="Timeline Eras">';
        for (const era of this.milestoneEras) {
            const isActive = era.id === this.activeEra ? 'active' : '';
            navHtml += `<button type="button" class="era-nav-pill ${isActive}" data-era="${era.id}">[ ${era.name.split(':')[0]} ]</button>`;
        }
        navHtml += '</nav>';

        let roadmapHtml = '<div class="time-capsule-highway">';
        for (let i = 0; i < this.milestoneEras.length; i++) {
            const era = this.milestoneEras[i];
            const alignment = i % 2 === 0 ? 'align-left' : 'align-right';

            const contribsHtml = era.contributors.map(c => `<span class="contrib-pill">@${c}</span>`).join(' ');
            const gamesHtml = era.games.map(g => `
                <div class="timeline-game-chip">
                    <span class="game-chip-icon">${g.icon}</span>
                    <span class="game-chip-title">${g.title}</span>
                    <button type="button" class="game-chip-play-btn" data-game-id="${g.id}">Play</button>
                </div>
            `).join('');

            roadmapHtml += `
                <section class="timeline-milestone-node ${alignment}" id="era-${era.id}">
                    <div class="node-marker" aria-hidden="true"></div>
                    <div class="node-card">
                        <div class="node-badge-row">
                            <span class="node-era-badge">${era.name}</span>
                            <span class="node-era-date">${era.date}</span>
                        </div>
                        <p class="node-highlight">${era.highlight}</p>
                        <div class="node-contributors-row">
                            <strong>Pioneers:</strong> ${contribsHtml}
                        </div>
                        <div class="node-games-grid">
                            ${gamesHtml}
                        </div>
                    </div>
                </section>
            `;
        }
        roadmapHtml += '</div>';

        const statsRibbonHtml = `
            <div class="time-capsule-stats-ribbon">
                <div class="stat-pill"><strong>110+</strong> Games Archival</div>
                <div class="stat-pill"><strong>70+</strong> Community Builders</div>
                <div class="stat-pill"><strong>1000+</strong> Open Source Commits</div>
            </div>
        `;

        const fullHtml = `
            <div class="arcade-time-capsule-container">
                <header class="time-capsule-header">
                    <h2>ARCADE CHRONOLOGY & TIME CAPSULE</h2>
                    <p>Scrub through the evolutionary history of ArcadeVerse and launch milestone games.</p>
                </header>
                ${statsRibbonHtml}
                ${navHtml}
                ${roadmapHtml}
            </div>
        `;

        container.innerHTML = fullHtml;

        // Wire era navigation
        const eraButtons = container.querySelectorAll('.era-nav-pill');
        eraButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const eraId = btn.getAttribute('data-era');
                this.scrollToEra(eraId, container);
            });
        });

        // Wire game launch triggers
        const playButtons = container.querySelectorAll('.game-chip-play-btn');
        playButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const gameId = btn.getAttribute('data-game-id');
                if (typeof this.onPlayGame === 'function') {
                    this.onPlayGame(gameId);
                }
            });
        });

        return fullHtml;
    }

    scrollToEra(eraId, container) {
        this.activeEra = eraId;
        const targetSection = container.querySelector(`#era-${eraId}`);
        if (targetSection && typeof targetSection.scrollIntoView === 'function') {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArcadeTimeCapsule };
}

if (typeof window !== 'undefined') {
    window.ArcadeTimeCapsule = ArcadeTimeCapsule;
}
