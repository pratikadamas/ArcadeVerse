const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { LeaderboardRoleFilter } = require('../assets/js/leaderboard-filter.js');

const mockContributors = [
    { username: 'retro_coder', name: 'Retro Coder', specializations: ['Arcade'], authoredGames: ['Cyber Pong'] },
    { username: 'puzzle_master', name: 'Puzzle Master', categories: ['Puzzle', 'Logic'], authoredGames: ['Neon Sokoban'] },
    { username: 'platform_dev', name: 'Platform Dev', isCore: true, specializations: ['Architect'], authoredGames: [] }
];

test('LeaderboardRoleFilter filters contributors by specialization role accurately', () => {
    const filter = new LeaderboardRoleFilter(mockContributors);

    // All roles
    assert.equal(filter.setRole('all').length, 3);

    // Arcade developers
    const arcadeDevs = filter.setRole('arcade');
    assert.equal(arcadeDevs.length, 1);
    assert.equal(arcadeDevs[0].username, 'retro_coder');

    // Puzzle developers
    const puzzleDevs = filter.setRole('puzzle');
    assert.equal(puzzleDevs.length, 1);
    assert.equal(puzzleDevs[0].username, 'puzzle_master');

    // Core & Platform architects
    const coreDevs = filter.setRole('platform');
    assert.equal(coreDevs.length, 1);
    assert.equal(coreDevs[0].username, 'platform_dev');

    // Filter by authored game query
    filter.setRole('all');
    const gameMatch = filter.setSearch('Sokoban');
    assert.equal(gameMatch.length, 1);
    assert.equal(gameMatch[0].username, 'puzzle_master');
});

test('leaderboard-filter.css contains role filter styling and responsive layout', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/leaderboard-filter.css');
    assert.ok(fs.existsSync(cssPath), 'leaderboard-filter.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.leaderboard-role-filter-wrap/, 'Styles filter container');
    assert.match(css, /\.role-filter-select/, 'Styles select element');
    assert.match(css, /@media\s*\(max-width:\s*640px\)/, 'Handles mobile responsiveness');
});
