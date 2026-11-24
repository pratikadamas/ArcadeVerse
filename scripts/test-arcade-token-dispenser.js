const { test } = require('node:test');
const assert = require('node:assert/strict');
const tokens = require('../assets/js/arcade-token-dispenser.js');
const day = new Date('2026-11-18T23:59:59Z');
function store(raw) {
  const data = new Map(raw === undefined ? [] : [[tokens.key, raw]]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
function initialized() { const s = store(); assert.equal(tokens.transact(s, { type: 'init' }, day).ok, true); return s; }
function state(s) { return tokens.read(s).value; }
function unchanged(s, action, now = day) {
  const previous = s.getItem(tokens.key), result = tokens.transact(s, action, now);
  assert.equal(result.ok, false); assert.equal(s.getItem(tokens.key), previous); return result;
}
test('grants five starter tokens once and preserves unrelated profile storage', () => {
  const s = store(); s.data.set('av_other_profile', 'untouched');
  assert.equal(tokens.transact(s, { type: 'init' }, day).changed, true);
  assert.equal(state(s).balance, 5); const raw = s.getItem(tokens.key);
  assert.equal(tokens.transact(s, { type: 'init' }, day).changed, false);
  assert.equal(s.getItem(tokens.key), raw); assert.equal(s.getItem('av_other_profile'), 'untouched');
});
test('claims once per UTC day, including the midnight boundary and rollback guard', () => {
  const s = initialized();
  assert.equal(tokens.transact(s, { type: 'claim' }, day).value.balance, 8);
  assert.equal(tokens.transact(s, { type: 'claim' }, day).changed, false);
  assert.equal(tokens.transact(s, { type: 'claim' }, new Date('2026-11-19T00:00:00Z')).value.balance, 11);
  unchanged(s, { type: 'claim' }, day); unchanged(s, { type: 'spend' }, day);
  assert.equal(tokens.utcDay(new Date('2026-11-19T05:29:59+05:30')), '2026-11-18');
});
test('redeems once, persists ownership, and equips only an owned reward in its slot', () => {
  const s = initialized();
  assert.equal(tokens.transact(s, { type: 'redeem', id: 'neon-border' }, day).value.balance, 1);
  assert.deepEqual(state(s).owned, ['neon-border']); assert.equal(state(s).equipped.border, 'neon-border');
  assert.equal(tokens.transact(s, { type: 'redeem', id: 'neon-border' }, day).changed, false);
  assert.equal(state(s).balance, 1);
  assert.equal(tokens.transact(s, { type: 'equip', slot: 'border', id: null }, day).ok, true);
  assert.equal(state(s).equipped.border, null);
  assert.equal(tokens.transact(s, { type: 'equip', slot: 'border', id: 'neon-border' }, day).ok, true);
  unchanged(s, { type: 'equip', slot: 'title', id: 'neon-border' });
  unchanged(s, { type: 'equip', slot: 'title', id: 'midnight-title' });
  unchanged(s, { type: 'equip', slot: '__proto__', id: null });
});
test('rejects insufficient funds and unknown operations without deducting anything', () => {
  const s = initialized();
  unchanged(s, { type: 'redeem', id: 'midnight-title' });
  unchanged(s, { type: 'redeem', id: '__proto__' });
  unchanged(s, { type: 'grant', amount: 1000 }); unchanged(s, null);
  for (let i = 0; i < 5; i++) assert.equal(tokens.transact(s, { type: 'spend' }, day).ok, true);
  assert.equal(state(s).balance, 0); unchanged(s, { type: 'spend' });
});
test('stores the optional preference without charging and validates its type', () => {
  const s = initialized(); assert.equal(state(s).effect, false);
  assert.equal(tokens.transact(s, { type: 'preference', enabled: true }, day).ok, true);
  assert.equal(state(s).balance, 5); assert.equal(state(s).effect, true);
  assert.equal(tokens.transact(s, { type: 'preference', enabled: true }, day).changed, false);
  unchanged(s, { type: 'preference', enabled: 'true' });
});
test('keeps corrupt, inconsistent and non-integer ledgers intact', () => {
  const good = state(initialized());
  const examples = ['{bad', 'x'.repeat(16385), 'null', ...[
    { version: 2 }, { balance: -1 }, { balance: .5 }, { balance: 1000001 }, { revision: 1.2 },
    { lastSeenDay: '2026-02-30' }, { lastClaimDay: '2026-11-19' }, { effect: 1 },
    { owned: ['neon-border', 'neon-border'] }, { owned: ['unknown'] },
    { equipped: { border: 'neon-border', title: null, flair: null } },
    { equipped: { border: null, title: null, unknown: null } }
  ].map(patch => JSON.stringify({ ...good, ...patch }))];
  for (const raw of examples) {
    const s = store(raw); assert.equal(tokens.read(s).ok, false);
    unchanged(s, { type: 'init' }); unchanged(s, { type: 'claim' });
  }
});
test('fails closed on quota, denied storage and invalid clocks', () => {
  const s = initialized(); s.setItem = () => { throw new Error('quota'); };
  unchanged(s, { type: 'claim' }); unchanged(s, { type: 'spend' });
  const denied = { getItem() { throw new Error('denied'); } };
  assert.equal(tokens.transact(denied, { type: 'init' }, day).ok, false);
  unchanged(s, { type: 'claim' }, new Date(NaN));
  unchanged(s, { type: 'claim' }, new Date('+010000-01-01T00:00:00Z'));
});
test('bounds balances and revisions without persisting a partial deduction', () => {
  const s = initialized(), value = state(s);
  s.setItem(tokens.key, JSON.stringify({ ...value, balance: 999999 }));
  unchanged(s, { type: 'claim' });
  s.setItem(tokens.key, JSON.stringify({ ...value, revision: 1000000000 }));
  unchanged(s, { type: 'spend' }); unchanged(s, { type: 'redeem', id: 'neon-border' });
});
