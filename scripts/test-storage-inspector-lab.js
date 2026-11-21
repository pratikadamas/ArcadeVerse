const { test } = require("node:test");
const assert = require("node:assert/strict");
const { capture, diff, changedPaths, inspect, resetMalformed } = require("../assets/js/storage-inspector-lab.js");
function storage(entries) { const values = new Map(entries); return { values, get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key) }; }
test("reads only the requested namespace, preserving unknown plain strings", () => {
  const source = storage([["outside", "SECRET"], ["arcadeverse_theme_mode", "dark"], ["arcadeverse_eq_preset", "arcade"], ["arcadeverse_custom", "<img onerror=alert(1)>"]]);
  const original = source.getItem; source.getItem = key => { assert.notEqual(key, "outside"); return original(key); };
  const result = capture(source); assert.equal(result.complete, true); assert.equal(result.rows.length, 3); assert.equal(result.rows.every(row => !row.malformed), true); assert.equal(source.values.size, 4);
});
test("detects malformed known JSON without claiming a full schema check", () => {
  assert.equal(inspect("arcadeverse_play_counts", "{broken").malformed, true);
  assert.equal(inspect("arcadeverse_unrecognized", "{plain").malformed, false);
  for (const raw of ["null", "false", "[]", '{"a":1}', '"plain"']) assert.equal(inspect("arcadeverse_play_counts", raw).malformed, false);
});
test("snapshots are independent of later writes and distinguish created, deleted and modified keys", () => {
  const source = storage([["arcadeverse_a", '{"x":1}'], ["arcadeverse_b", "old"]]), before = capture(source);
  source.values.set("arcadeverse_a", '{"x":2}'); source.values.delete("arcadeverse_b"); source.values.set("arcadeverse_c", "new");
  assert.deepEqual(diff(before, capture(source)).map(row => [row.key, row.kind]), [["arcadeverse_a", "modified"], ["arcadeverse_b", "deleted"], ["arcadeverse_c", "created"]]);
  assert.equal(before.rows[0].raw, '{"x":1}'); assert.equal(Object.isFrozen(before.rows), true);
});
test("nested paths escape pointer characters, handle arrays, null, type changes and hostile property names", () => {
  const a = JSON.parse('{"a/b":{"~x":[1,null]},"__proto__":{"safe":1}}'), b = JSON.parse('{"a/b":{"~x":[2,3]},"__proto__":{"safe":2}}');
  assert.deepEqual(changedPaths(a, b).paths.sort(), ["/__proto__/safe", "/a~1b/~0x/0", "/a~1b/~0x/1"].sort());
  assert.deepEqual(changedPaths([], {}).paths, ["/"]); assert.equal({}.safe, undefined);
});
test("bounded diff details cannot recurse indefinitely", () => {
  let a = 1, b = 2; for (let i = 0; i < 10000; i++) { a = { x: a }; b = { x: b }; }
  assert.equal(changedPaths(a, b).paths[0].split("/").length, 9);
  assert.ok(changedPaths({}, Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i, i]))).paths.length <= 60);
});
test("recognizes formatting-only changes without inventing nested value changes", () => {
  const a = capture(storage([["arcadeverse_a", '{"a":1}']])), b = capture(storage([["arcadeverse_a", '{ "a": 1 }']]));
  assert.equal(diff(a, b)[0].paths[0], "/ (text or formatting)"); assert.deepEqual(diff(a, a), []);
});
test("does not call a difference beyond the traversal budget a formatting-only change", () => {
  const a = Array.from({ length: 1000 }, (_, i) => i), b = [...a]; b[999] = -1;
  const result = diff(capture(storage([["arcadeverse_a", JSON.stringify(a)]])), capture(storage([["arcadeverse_a", JSON.stringify(b)]])))[0];
  assert.equal(result.limited, true); assert.match(result.paths[0], /detail limit/);
});
test("partial or unavailable reads cannot become misleading deletion diffs", () => {
  const good = capture(storage([["arcadeverse_a", "1"]]));
  const limited = capture(storage([["arcadeverse_a", "x".repeat(32769)]])); assert.equal(limited.complete, false); assert.equal(limited.rows[0].raw, null);
  assert.throws(() => diff(good, limited), /complete/);
  const denied = capture({ get length() { throw new Error("denied"); } }); assert.equal(denied.ok, false); assert.throws(() => diff(good, denied), /complete/);
});
test("bounds key count and aggregate retained characters", () => {
  const many = capture(storage(Array.from({ length: 300 }, (_, i) => [`arcadeverse_${i}`, "a"]))); assert.equal(many.rows.length, 256); assert.equal(many.complete, false);
  const large = capture(storage(Array.from({ length: 10 }, (_, i) => [`arcadeverse_${i}`, "a".repeat(32768)])));
  assert.equal(large.complete, false); assert.equal(large.rows.filter(row => row.raw !== null).length, 8);
  assert.equal(capture(storage([["arcadeverse_" + "x".repeat(600), "1"]])).complete, false);
  let reads = 0; const sparse = capture({ length: 10001, key() { reads++; return "outside"; }, getItem() { throw new Error("must not read outside values"); } });
  assert.equal(reads, 10000); assert.equal(sparse.complete, false);
});
test("resets exactly one inspected malformed key and preserves unrelated storage", () => {
  const source = storage([["arcadeverse_play_counts", "{broken"], ["outside", "SECRET"], ["arcadeverse_theme_mode", "dark"]]);
  assert.equal(resetMalformed(source, "arcadeverse_play_counts", "{broken").ok, true);
  assert.equal(source.getItem("arcadeverse_play_counts"), null); assert.equal(source.getItem("outside"), "SECRET"); assert.equal(source.getItem("arcadeverse_theme_mode"), "dark");
});
test("refuses stale, plain, valid JSON, out-of-namespace and failed resets", () => {
  const source = storage([["arcadeverse_play_counts", '{"new":1}'], ["arcadeverse_theme_mode", "dark"]]);
  assert.equal(resetMalformed(source, "arcadeverse_play_counts", "{old").ok, false); assert.equal(source.getItem("arcadeverse_play_counts"), '{"new":1}');
  for (const [key, raw] of [["outside", "{broken"], ["arcadeverse_theme_mode", "dark"], ["arcadeverse_play_counts", "{}"]]) assert.equal(resetMalformed(source, key, raw).ok, false);
  const denied = storage([["arcadeverse_play_counts", "{broken"]]); denied.removeItem = () => { throw new Error("denied"); }; assert.equal(resetMalformed(denied, "arcadeverse_play_counts", "{broken").ok, false); assert.equal(denied.getItem("arcadeverse_play_counts"), "{broken");
});
test("key-level diffs agree with independent changed-key sets across many edits", () => {
  for (let n = 1; n < 100; n++) {
    const old = Array.from({ length: n }, (_, i) => [`arcadeverse_${i}`, String(i)]), next = old.filter((_, i) => i % 3).map(([key, value], i) => [key, i % 2 ? value : `changed-${value}`]); next.push(["arcadeverse_new", "1"]);
    const a = new Map(old), b = new Map(next), expected = [...new Set([...a.keys(), ...b.keys()])].filter(key => a.get(key) !== b.get(key)).sort();
    assert.deepEqual(diff(capture(storage(old)), capture(storage(next))).map(row => row.key), expected);
  }
});
