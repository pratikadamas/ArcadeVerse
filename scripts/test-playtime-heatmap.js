const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const activity = require('../assets/js/playtime-heatmap.js');
const now = new Date(2026, 10, 18, 12);
function store(raw) {
  const data = new Map(raw === undefined ? [] : [[activity.key, raw]]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('records real launches, counts repeat plays and selects the top title', () => {
  const s = store();
  for (const game of [{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }, { id: 'b', title: 'Beta' }]) assert.equal(activity.record(s, game, now).ok, true);
  const state = activity.read(s).value;
  assert.equal(state.days.length, 1); assert.equal(state.days[0].date, '2026-11-18');
  assert.deepEqual(activity.summary(state.days[0]), { plays: 3, top: 'Beta' });
  assert.deepEqual(activity.summary(), { plays: 0, top: 'None' });
});
test('treats IDs as data, including prototype-like IDs, and preserves unrelated keys', () => {
  const s = store(); s.data.set('av_daily_streak_date', 'untouched');
  assert.equal(activity.record(s, { id: '__proto__', title: '<img onerror="bad()">' }, now).ok, true);
  assert.equal(activity.read(s).value.days[0].games[0].id, '__proto__');
  assert.equal(s.data.get('av_daily_streak_date'), 'untouched');
  assert.equal({}.polluted, undefined);
});
test('builds exactly 52 weeks of unique local dates with future days marked', () => {
  const cells = activity.calendar(now);
  assert.equal(cells.length, 364); assert.equal(new Set(cells.map(c => c.key)).size, 364);
  assert.equal(cells[0].weekday, 0); assert.equal(cells.at(-1).weekday, 6);
  assert.equal(cells.at(-1).week, 51); assert.equal(cells.filter(c => c.key === '2026-11-18').length, 1);
  assert.equal(cells.filter(c => c.future).length, 3);
  assert.equal(cells[0].date.getHours(), 12);
});
test('local-day calendar math survives year, leap-year and DST boundaries', () => {
  const script = `const a=require(${JSON.stringify(require.resolve('../assets/js/playtime-heatmap.js'))});
    for(const date of [new Date(2026,0,1,12),new Date(2024,2,10,12),new Date(2026,9,4,12)]){
      const c=a.calendar(date);if(c.length!==364||new Set(c.map(x=>x.key)).size!==364)process.exit(1);
      for(let i=1;i<c.length;i++){const d=c[i-1].date;const next=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1,12);if(a.dayKey(next)!==c[i].key)process.exit(2);}
    }
    if(a.dayKey(new Date(2026,0,1,0,1))!=='2026-01-01')process.exit(3);`;
  for (const TZ of ['America/New_York', 'Australia/Sydney', 'Pacific/Apia', 'Asia/Kolkata']) {
    const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, timeout: 3000 });
    assert.equal(result.status, 0, `${TZ}: ${result.stderr}`);
  }
});
test('retains only the last 370 calendar days as launches arrive', () => {
  const s = store();
  for (let day = 0; day < 380; day++) assert.equal(activity.record(s, { id: 'a', title: 'A' }, new Date(2025, 0, 1 + day, 12)).ok, true);
  assert.equal(activity.read(s).value.days.length, 370);
});
test('uses four nonzero intensity tiers without inventing baseline activity', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10, 50].map(activity.level), [0, 1, 2, 2, 3, 3, 4, 4]);
});
test('refuses malformed or inconsistent storage without overwriting it', () => {
  const examples = ['{bad', 'x'.repeat(2000001), JSON.stringify({ version: 2, days: [] }), JSON.stringify({ version: 1, days: [{ date: '2026-02-30', plays: 1, games: [] }] }), JSON.stringify({ version: 1, days: [{ date: '2026-11-18', plays: 2, games: [{ id: 'a', title: 'A', plays: 1 }] }] })];
  for (const raw of examples) {
    const s = store(raw); assert.equal(activity.read(s).ok, false);
    assert.equal(activity.record(s, { id: 'a', title: 'A' }, now).ok, false);
    assert.equal(s.getItem(activity.key), raw);
  }
});
test('fails closed on duplicate day/game records and oversized titles', () => {
  const day = { date: '2026-11-18', plays: 1, games: [{ id: 'a', title: 'A', plays: 1 }] };
  assert.equal(activity.read(store(JSON.stringify({ version: 1, days: [day, day] }))).ok, false);
  assert.equal(activity.read(store(JSON.stringify({ version: 1, days: [{ ...day, plays: 2, games: [...day.games, ...day.games] }] }))).ok, false);
  assert.equal(activity.read(store(JSON.stringify({ version: 1, days: [{ ...day, games: [{ id: 'a', title: 'a'.repeat(81), plays: 1 }] }] }))).ok, false);
});
test('storage denial and quota failures leave the previous state intact', () => {
  const s = store(); activity.record(s, { id: 'a', title: 'A' }, now); const previous = s.getItem(activity.key);
  s.setItem = () => { throw new Error('quota'); };
  assert.equal(activity.record(s, { id: 'a', title: 'A' }, now).ok, false);
  assert.equal(s.getItem(activity.key), previous);
  assert.equal(activity.read({ getItem() { throw new Error('denied'); } }).ok, false);
});
test('rejects invalid games, dates and saturated daily histories', () => {
  const s = store();
  for (const game of [null, {}, { id: '', title: 'A' }, { id: 'a'.repeat(101), title: 'A' }]) assert.equal(activity.record(s, game, now).ok, false);
  assert.equal(activity.record(s, { id: 'a', title: 'A' }, new Date(NaN)).ok, false);
  for (let i = 0; i < 64; i++) assert.equal(activity.record(s, { id: String(i), title: 'Title' }, now).ok, true);
  const raw = s.getItem(activity.key);
  assert.equal(activity.record(s, { id: 'extra', title: 'Extra' }, now).ok, false);
  assert.equal(s.getItem(activity.key), raw);
  assert.equal(activity.record(s, { id: '0', title: 'Title' }, now).ok, true);
});
