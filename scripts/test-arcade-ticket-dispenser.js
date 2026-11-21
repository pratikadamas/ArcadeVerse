const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const tickets = require('../assets/js/arcade-ticket-dispenser.js');
const receipt = id => createHash('sha256').update(String(id)).digest('hex');
function store(raw) {
  const data = new Map(raw === undefined ? [] : [[tickets.key, raw]]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const state = s => tickets.read(s).value;
const award = (s, score, id = score) => tickets.transact(s, { type: 'award', score, receipt: receipt(id) });
function unchanged(s, action) {
  const before = s.getItem(tickets.key), result = tickets.transact(s, action);
  assert.equal(result.ok, false); assert.equal(s.getItem(tickets.key), before); return result;
}
test('floors final scores at boundaries, including fractional scores and zero', () => {
  for (const [score, expected] of [[0, 0], [99.99, 0], [100, 1], [199.99, 1], [200, 2], [12345, 123], [100000000, 1000000]]) {
    const s = store(), result = award(s, score);
    assert.equal(result.ok, true); assert.equal(result.earned, expected);
    assert.equal(state(s).balance, expected); assert.equal(state(s).receipts.length, 1);
  }
});
test('retains zero-score receipts and refuses replay even with a different final score', () => {
  const s = store(); award(s, 0, 'one opened game'); const before = s.getItem(tickets.key);
  assert.equal(award(s, 9000, 'one opened game').changed, false);
  assert.equal(s.getItem(tickets.key), before); assert.equal(state(s).balance, 0);
  assert.equal(award(s, 9000, 'new opened game').earned, 90);
  assert.equal(state(s).revision, 2);
});
test('rejects invalid scores and receipts without creating or changing a ledger', () => {
  const s = store();
  for (const score of [-1, NaN, Infinity, -Infinity, 100000001, '1000', true, null, {}, undefined]) unchanged(s, { type: 'award', score, receipt: receipt(1) });
  for (const id of ['', 'raw-session-token', 'f'.repeat(63), 'G'.repeat(64), null]) unchanged(s, { type: 'award', score: 100, receipt: id });
  assert.equal(s.getItem(tickets.key), null);
});
test('sums independent opened sessions against independently computed totals', () => {
  const s = store(); let expected = 0;
  for (let i = 0; i < 127; i++) { const score = (i * 7919) % 20000; expected += Math.floor(score / 100); assert.equal(award(s, score, i).ok, true); }
  assert.equal(state(s).balance, expected); assert.equal(state(s).receipts.length, 127);
});
test('redemption subtracts the listed cost once and only owned slot prizes equip', () => {
  const s = store(); award(s, 10000); let expected = 100;
  for (const prize of tickets.rewards) {
    const action = { type: 'redeem', id: prize.id };
    assert.equal(tickets.transact(s, action).ok, true); expected -= prize.cost;
    assert.equal(state(s).balance, expected); assert.equal(state(s).equipped[prize.slot], prize.id);
    const before = s.getItem(tickets.key); assert.equal(tickets.transact(s, action).changed, false); assert.equal(s.getItem(tickets.key), before);
    assert.equal(tickets.transact(s, { type: 'equip', slot: prize.slot, id: null }).ok, true);
    assert.equal(state(s).equipped[prize.slot], null);
    assert.equal(tickets.transact(s, { type: 'equip', slot: prize.slot, id: prize.id }).ok, true);
  }
  assert.equal(expected, 30); assert.deepEqual(new Set(state(s).owned), new Set(tickets.rewards.map(p => p.id)));
  unchanged(s, { type: 'equip', slot: 'badge', id: 'neon-trail' });
  unchanged(s, { type: 'equip', slot: '__proto__', id: null });
});
test('insufficient funds, unowned prizes and unknown actions preserve storage', () => {
  const s = store(); award(s, 100);
  unchanged(s, { type: 'redeem', id: 'neon-trail' }); unchanged(s, { type: 'redeem', id: '__proto__' });
  unchanged(s, { type: 'equip', slot: 'trail', id: 'neon-trail' });
  unchanged(s, { type: 'spend', amount: 1 }); unchanged(s, null);
});
test('read and write denials never report an award or lose the previous ledger', () => {
  const s = store(); award(s, 200); const before = s.getItem(tickets.key);
  const deniedWrite = { getItem: s.getItem, setItem() { throw Error('quota exceeded'); } };
  assert.equal(award(deniedWrite, 300).ok, false); assert.equal(s.getItem(tickets.key), before);
  const deniedRead = { getItem() { throw Error('denied'); }, setItem() { assert.fail('must not write after failed read'); } };
  assert.equal(tickets.read(deniedRead).ok, false); assert.equal(award(deniedRead, 100).ok, false);
});
test('preserves malformed, inconsistent, duplicate and oversized ledgers', () => {
  const base = state(store());
  const examples = ['{bad', 'null', 'x'.repeat(400001), ...[
    { version: 2 }, { balance: -1 }, { balance: .5 }, { balance: 1000001 }, { revision: -1 }, { revision: 1000000001 },
    { receipts: [receipt(1), receipt(1)] }, { receipts: ['not a hash'] }, { receipts: Array(4097).fill(receipt(1)) },
    { owned: ['unknown'] }, { owned: ['neon-trail', 'neon-trail'] },
    { equipped: { trail: 'neon-trail', sound: null, badge: null, border: null } },
    { equipped: { trail: null, sound: null, badge: null, unknown: null } }
  ].map(patch => JSON.stringify({ ...base, ...patch }))];
  for (const raw of examples) { const s = store(raw); assert.equal(tickets.read(s).ok, false); unchanged(s, { type: 'award', score: 100, receipt: receipt(2) }); }
});
test('balance, receipt and revision limits preserve the complete wallet', () => {
  const maxBalance = store(); award(maxBalance, 100000000); unchanged(maxBalance, { type: 'award', score: 100, receipt: receipt('extra') });
  const full = state(store()); full.receipts = Array.from({ length: 4096 }, (_, i) => receipt(i)); full.balance = 100;
  const s = store(JSON.stringify(full)); unchanged(s, { type: 'award', score: 100, receipt: receipt('next') });
  assert.equal(tickets.transact(s, { type: 'redeem', id: 'neon-trail' }).ok, true);
  assert.equal(state(s).balance, 90); assert.equal(state(s).receipts.length, 4096);
  const maxRevision = store(JSON.stringify({ ...full, revision: 1000000000 })); unchanged(maxRevision, { type: 'redeem', id: 'neon-trail' });
});
test('writes only the ticket key, persisting hashes without raw session tokens', () => {
  const s = store(), secret = 'private-session-token';
  s.data.set('av_arcade_tokens', 'unchanged daily wallet'); s.data.set('unrelated-secret', 'untouched');
  assert.equal(award(s, 500, secret).ok, true);
  assert.equal(s.getItem(tickets.key).includes(secret), false);
  assert.equal(s.getItem('av_arcade_tokens'), 'unchanged daily wallet'); assert.equal(s.getItem('unrelated-secret'), 'untouched');
  assert.deepEqual([...s.data.keys()].sort(), ['av_arcade_tokens', 'av_ticket_ledger', 'unrelated-secret']);
});
