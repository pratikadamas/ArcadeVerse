const test = require('node:test');
const assert = require('node:assert/strict');
const HotseatOrchestrator = require('../assets/js/hotseat-orchestrator.js');

test('HotseatOrchestrator manages player rotations and rounds', () => {
  const hotseat = new HotseatOrchestrator({
    playerCount: 2,
    playerNames: ['Alice', 'Bob'],
    maxRounds: 2
  });

  assert.equal(hotseat.getCurrentPlayer().name, 'Alice');
  assert.equal(hotseat.currentRound, 1);

  hotseat.nextTurn();
  assert.equal(hotseat.getCurrentPlayer().name, 'Bob');

  hotseat.nextTurn();
  assert.equal(hotseat.currentRound, 2);
  assert.equal(hotseat.getCurrentPlayer().name, 'Alice');
});

test('HotseatOrchestrator calculates podium summary on match completion', () => {
  const hotseat = new HotseatOrchestrator({
    playerCount: 2,
    maxRounds: 1
  });

  hotseat.players[0].score = 150;
  hotseat.players[1].score = 290;

  let matchResult = null;
  hotseat.on('matchEnd', (data) => {
    matchResult = data;
  });

  hotseat.nextTurn(); // P1 -> P2
  hotseat.nextTurn(); // P2 -> Match End

  assert.equal(hotseat.isGameOver, true);
  assert.ok(matchResult !== null);
  assert.equal(matchResult.winner.id, 1); // Bob / P2
});
