const test = require('node:test');
const assert = require('node:assert/strict');
const VirtualCoinDoor = require('../assets/js/virtual-coin-door.js');

test('VirtualCoinDoor manages credits ledger and insertion', () => {
  const door = new VirtualCoinDoor(null, { initialCredits: 3 });
  assert.equal(door.credits, 3);

  door.insertCoin();
  assert.equal(door.credits, 4);

  const ok = door.consumeCredit();
  assert.equal(ok, true);
  assert.equal(door.credits, 3);
});

test('VirtualCoinDoor supports free play mode toggle', () => {
  const door = new VirtualCoinDoor(null, { initialCredits: 0 });
  assert.equal(door.consumeCredit(), false);

  door.setFreePlay(true);
  assert.equal(door.isFreePlay, true);
  assert.equal(door.consumeCredit(), true);
  assert.equal(door.credits, 0); // Preserves zero balance during free play
});
