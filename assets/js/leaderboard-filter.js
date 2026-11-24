/**
 * Leaderboard Specialization Role & Game Authored Filter (#581)
 * Filters contributor leaderboard table by developer specialization:
 * - All Roles
 * - Arcade Developers
 * - Puzzle Developers
 * - Core & Platform Architects
 * - Game title substring match
 */

class LeaderboardRoleFilter {
    constructor(contributors = []) {
        this.contributors = contributors;
        this.activeRole = 'all';
        this.activeSearch = '';
    }

    setContributors(list) {
        this.contributors = Array.isArray(list) ? list : [];
    }

    setRole(role) {
        this.activeRole = role || 'all';
        return this.filter();
    }

    setSearch(query) {
        this.activeSearch = (query || '').trim().toLowerCase();
        return this.filter();
    }

    filter() {
        return this.contributors.filter(contributor => {
            // Role filter matching
            if (this.activeRole !== 'all') {
                const roles = (contributor.roles || contributor.specializations || []).map(r => r.toLowerCase());
                const categories = (contributor.categories || []).map(c => c.toLowerCase());

                let roleMatched = false;
                if (this.activeRole === 'arcade' && (roles.includes('arcade') || categories.includes('arcade'))) {
                    roleMatched = true;
                } else if (this.activeRole === 'puzzle' && (roles.includes('puzzle') || categories.includes('puzzle') || categories.includes('logic'))) {
                    roleMatched = true;
                } else if (this.activeRole === 'platform' && (roles.includes('core') || roles.includes('architect') || roles.includes('infrastructure') || contributor.isCore)) {
                    roleMatched = true;
                }

                if (!roleMatched) return false;
            }

            // Search query filter matching
            if (this.activeSearch) {
                const name = (contributor.name || '').toLowerCase();
                const username = (contributor.username || '').toLowerCase();
                const games = (contributor.authoredGames || contributor.gamesList || []).map(g => g.toLowerCase());

                const nameMatch = name.includes(this.activeSearch) || username.includes(this.activeSearch);
                const gameMatch = games.some(g => g.includes(this.activeSearch));

                if (!nameMatch && !gameMatch) return false;
            }

            return true;
        });
    }

    renderFilterDropdown(container, onRoleChange) {
        if (!container) return;

        container.className = 'leaderboard-role-filter-wrap';
        container.innerHTML = `
            <label for="leaderboard-role-select" class="role-filter-label">Filter Specialization:</label>
            <select id="leaderboard-role-select" class="role-filter-select">
                <option value="all">All Roles</option>
                <option value="arcade">Arcade Developers</option>
                <option value="puzzle">Puzzle Developers</option>
                <option value="platform">Core & Platform Architects</option>
            </select>
        `;

        const select = container.querySelector('#leaderboard-role-select');
        if (select) {
            select.value = this.activeRole;
            select.addEventListener('change', (e) => {
                const filtered = this.setRole(e.target.value);
                if (typeof onRoleChange === 'function') {
                    onRoleChange(filtered, e.target.value);
                }
            });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LeaderboardRoleFilter };
}

if (typeof window !== 'undefined') {
    window.LeaderboardRoleFilter = LeaderboardRoleFilter;
}
