const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const saved = new Map();
  let failStorage = false;
  let updates = 0;
  const context = {
    TextEncoder, TextDecoder, Uint8Array, btoa, atob,
    console: { warn() {}, error() {} },
    document: { addEventListener() {}, getElementById() { return null; } },
    localStorage: {
      getItem: key => saved.get(key),
      setItem(key, value) {
        if (failStorage) throw new Error('quota');
        saved.set(key, value);
      }
    },
    window: { dispatchEvent() { updates++; } },
    CustomEvent: class { constructor(type) { this.type = type; } },
    GAMES_REGISTRY: [{ id: 'one' }, { id: 'two' }]
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/playlist-manager.js'), 'utf8'), context);
  return { manager: context.window.ArcadePlaylists, saved,
    failStorage() { failStorage = true; }, updates: () => updates };
}

function code(value) {
  return 'AVPL:' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

test('exports compact UTF-8 AVPL codes and imports with fresh metadata', () => {
  const { manager, saved, updates } = setup();
  const original = manager.createPlaylist('日本語 café Arcade');
  manager.addGameToPlaylist(original.id, 'one');
  manager.addGameToPlaylist(original.id, 'two');
  const encoded = manager.exportPlaylistCode(original.id);
  assert.equal(encoded, code({ name: original.name, games: ['one', 'two'] }));
  const imported = manager.importPlaylistCode('  ' + encoded + '\n');
  assert.notEqual(imported.id, original.id);
  assert.equal(imported.name, original.name);
  assert.equal(JSON.stringify(imported.games), '["one","two"]');
  assert.equal(JSON.parse(saved.get('arcadeverse_user_playlists')).at(-1).id, imported.id);
  assert.equal(updates(), 4);
});

test('deduplicates game IDs in original order and supports empty playlists', () => {
  const { manager } = setup();
  assert.equal(JSON.stringify(manager.importPlaylistCode(code({ name: 'Mix', games: ['two','one','two'] })).games), '["two","one"]');
  assert.equal(manager.importPlaylistCode(code({ name: 'Empty', games: [] })).games.length, 0);
});

test('rejects malformed encoding, JSON, UTF-8 and prefixes without changing state', () => {
  const { manager, saved, updates } = setup();
  const before = manager.exportCollectionsJSON();
  for (const invalid of ['', 'garbage', 'AVPL:', 'AVPL:!!!!', 'AVPL:e30', 'AVPL:e30===',
    'OTHER:e30=', 'AVPL:' + btoa('not json'), 'AVPL:/w==', 'AVPL:'.padEnd(65537, 'A')]) {
    assert.throws(() => manager.importPlaylistCode(invalid));
    assert.equal(manager.exportCollectionsJSON(), before);
    assert.equal(saved.size, 0);
    assert.equal(updates(), 0);
  }
});

test('rejects invalid shapes, oversized names/lists, unknown IDs and extra metadata atomically', () => {
  const { manager, saved } = setup();
  const before = manager.exportCollectionsJSON();
  for (const value of [null, [], {}, { name:'',games:[] }, { name:'  ',games:[] },
    { name:3,games:[] }, {name:'x'.repeat(101),games:[]}, {name:'Mix',games:'one'},
    {name:'Mix',games:[3]}, {name:'Mix',games:['missing']},
    {name:'Mix',games:Array(1001).fill('one')}, {name:'Mix',games:[],id:'overwrite'}]) {
    assert.throws(() => manager.importPlaylistCode(code(value)));
    assert.equal(manager.exportCollectionsJSON(), before);
    assert.equal(saved.size, 0);
  }
});

test('storage failure does not change in-memory playlists or dispatch success', () => {
  const { manager, saved, failStorage, updates } = setup();
  const before = manager.exportCollectionsJSON();
  failStorage();
  assert.throws(() => manager.importPlaylistCode(code({name:'Mix',games:['one']})), /storage/);
  assert.equal(manager.exportCollectionsJSON(), before);
  assert.equal(saved.size, 0);
  assert.equal(updates(), 0);
});

test('export rejects a missing playlist or stale registry IDs', () => {
  const { manager } = setup();
  assert.throws(() => manager.exportPlaylistCode('missing'), /not found/);
  const playlist = manager.createPlaylist('Stale');
  playlist.games.push('missing');
  assert.throws(() => manager.exportPlaylistCode(playlist.id), /catalog/);
});
