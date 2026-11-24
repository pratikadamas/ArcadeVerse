const test = require('node:test');
const assert = require('node:assert/strict');
const { ArcadeTourGuide } = require('../assets/js/arcade-tour-guide.js');

test('ArcadeTourGuide adds steps and advances progress', () => {
    const tour = new ArcadeTourGuide();
    tour.addStep('#catalog', 'Game Catalog', 'Browse all 120+ retro arcade titles');
    tour.addStep('#search', 'Instant Search', 'Filter games by name, genre, or tag');
    tour.addStep('#theme-switcher', 'Theme Switcher', 'Switch to CRT, Cyberpunk, or Apple II modes');

    assert.equal(tour.steps.length, 3, 'Should register 3 tour steps');

    const started = tour.start();
    assert.equal(started, true, 'Tour should start successfully');
    assert.equal(tour.isActive, true);
    assert.equal(tour.currentIndex, 0);

    const step1 = tour.getCurrentStep();
    assert.equal(step1.title, 'Game Catalog');
    assert.equal(step1.index, 0);
    assert.equal(step1.total, 3);

    tour.next();
    assert.equal(tour.currentIndex, 1);
    assert.equal(tour.getCurrentStep().title, 'Instant Search');

    tour.previous();
    assert.equal(tour.currentIndex, 0);

    tour.next();
    tour.next();
    assert.equal(tour.currentIndex, 2);

    let completed = false;
    tour.onComplete = () => { completed = true; };

    // Advancing past last step triggers finish
    tour.next();
    assert.equal(tour.isActive, false, 'Tour should be deactivated upon completion');
    assert.equal(completed, true, 'onComplete callback should be called');
});
