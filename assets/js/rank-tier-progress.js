/**
 * Contributor Rank Delta Indicator & Tier Progress Controller (#1548)
 * Computes contributor tier milestones (Bronze, Silver, Gold, Diamond, Legend),
 * calculates remaining points/pull requests to reach the next tier, and tracks rank deltas.
 */

class RankTierProgressManager {
    static TIERS = [
        { name: 'Bronze', minPoints: 0, maxPoints: 100, class: 'tier-bronze' },
        { name: 'Silver', minPoints: 101, maxPoints: 250, class: 'tier-silver' },
        { name: 'Gold', minPoints: 251, maxPoints: 500, class: 'tier-gold' },
        { name: 'Diamond', minPoints: 501, maxPoints: 1000, class: 'tier-diamond' },
        { name: 'Legend', minPoints: 1001, maxPoints: Infinity, class: 'tier-legend' }
    ];

    static getTierForPoints(points = 0) {
        const p = Math.max(0, Number(points) || 0);
        for (let i = 0; i < RankTierProgressManager.TIERS.length; i++) {
            const t = RankTierProgressManager.TIERS[i];
            if (p >= t.minPoints && p <= t.maxPoints) {
                return t;
            }
        }
        return RankTierProgressManager.TIERS[0];
    }

    static calculateProgress(points = 0) {
        const currentTier = RankTierProgressManager.getTierForPoints(points);
        if (currentTier.name === 'Legend') {
            return {
                currentTier,
                nextTier: null,
                percent: 100,
                pointsToNext: 0
            };
        }

        const tierSpan = currentTier.maxPoints - currentTier.minPoints;
        const progressInTier = points - currentTier.minPoints;
        const percent = Math.min(100, Math.max(0, Math.round((progressInTier / tierSpan) * 100)));
        const nextTier = RankTierProgressManager.TIERS.find((t) => t.minPoints === currentTier.maxPoints + 1) || null;

        return {
            currentTier,
            nextTier,
            percent,
            pointsToNext: Math.max(0, currentTier.maxPoints - points + 1)
        };
    }

    static formatRankDelta(previousRank, currentRank) {
        if (!previousRank || previousRank === currentRank) {
            return { text: '- 0', class: 'rank-delta-neutral' };
        }
        const delta = previousRank - currentRank; // rank 5 -> rank 3 = +2 gain
        if (delta > 0) {
            return { text: `+${delta}`, class: 'rank-delta-up' };
        }
        return { text: `${delta}`, class: 'rank-delta-down' };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RankTierProgressManager };
}
