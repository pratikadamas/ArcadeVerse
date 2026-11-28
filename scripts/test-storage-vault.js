const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Mock localStorage for unit tests
const storageMock = new Map();
const mockLocalStorage = {
  getItem: (k) => storageMock.has(k) ? storageMock.get(k) : null,
  setItem: (k, v) => storageMock.set(k, String(v)),
  removeItem: (k) => storageMock.delete(k),
  clear: () => storageMock.clear(),
  key: (i) => Array.from(storageMock.keys())[i] || null,
  get length() { return storageMock.size; }
};

globalThis.localStorage = mockLocalStorage;
globalThis.window = {
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Load ArcadeLZ decompressor
require("../assets/js/arcade-lz-decompressor.js");

const ArcadeVerse = require("../assets/js/arcadeverse-sdk.js");
const storage = ArcadeVerse.storage;

test("ArcadeStorage transaction commits atomically on success", () => {
  storage.setGameId("test_game");
  storage.clear();

  const success = storage.transaction((tx) => {
    tx.setItem("level", "5");
    tx.setItem("score", "1200");
    tx.setItem("unlocked", "true");
  });

  assert.strictEqual(success, true, "Transaction must succeed");
  assert.strictEqual(storage.getItem("level"), "5");
  assert.strictEqual(storage.getItem("score"), "1200");
  assert.strictEqual(storage.getItem("unlocked"), "true");
});

test("ArcadeStorage transaction rolls back fully when an error is thrown", () => {
  storage.setGameId("test_game");
  storage.clear();
  storage.setItem("coins", "50");
  storage.setItem("lives", "3");

  const success = storage.transaction((tx) => {
    tx.setItem("coins", "1000"); // Staged modification
    tx.setItem("lives", "0");
    throw new Error("Simulated QuotaExceededError during transaction write");
  });

  assert.strictEqual(success, false, "Transaction must fail and return false");
  assert.strictEqual(storage.getItem("coins"), "50", "coins must be rolled back to 50");
  assert.strictEqual(storage.getItem("lives"), "3", "lives must be rolled back to 3");
});

test("Cryptographic HMAC signed state export and import verification", () => {
  storage.setGameId("rpg_quest");
  storage.clear();
  storage.setItem("character_class", "mage");
  storage.setItem("xp", "9500");

  const signedExport = storage.exportSignedState();
  assert.ok(signedExport.signature, "Must contain signature");
  assert.strictEqual(signedExport.gameId, "rpg_quest");

  // Clear storage and restore
  storage.clear();
  assert.strictEqual(storage.getItem("character_class"), null);

  const importResult = storage.importSignedState(signedExport);
  assert.strictEqual(importResult.success, true);
  assert.strictEqual(storage.getItem("character_class"), "mage");
  assert.strictEqual(storage.getItem("xp"), "9500");
});

test("Tampered save state signature is rejected with INVALID_SIGNATURE", () => {
  storage.setGameId("rpg_quest");
  storage.clear();
  storage.setItem("gold", "100");

  const signedExport = storage.exportSignedState();

  // Malicious player edits payload in json to grant 999999 gold
  const tamperedExport = JSON.parse(JSON.stringify(signedExport));
  tamperedExport.payload = tamperedExport.payload.replace('"100"', '"999999"');

  const result = storage.importSignedState(tamperedExport);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, "INVALID_SIGNATURE");
  assert.strictEqual(storage.getItem("gold"), "100", "Tampered gold must not be applied");
});

test("Strict namespace sandboxing rejects reserved system keys and cross-game injections", () => {
  storage.setGameId("cyber_pong");
  storage.clear();

  const maliciousSnapshot = {
    gameId: "cyber_pong",
    data: {
      "valid_score": "500",
      "av_master_volume": "0.0", // System key injection
      "av_sound_muted": "true", // System key injection
      "av_other_game_secret": "hacked" // Cross-game injection
    }
  };

  const count = storage.importGameState(maliciousSnapshot);
  assert.strictEqual(count, 1, "Only 1 valid key should be accepted");
  assert.strictEqual(storage.getItem("valid_score"), "500");
  assert.strictEqual(globalThis.localStorage.getItem("av_master_volume"), null, "System volume must not be overwritten");
  assert.strictEqual(globalThis.localStorage.getItem("av_sound_muted"), null, "System mute must not be overwritten");
  assert.strictEqual(globalThis.localStorage.getItem("av_other_game_secret"), null, "Foreign game key must be blocked");
});

test("Transparent compression reduces save state footprint", () => {
  storage.setGameId("level_builder");
  storage.clear();

  // Create repetitive map layout JSON
  const mapData = {
    tiles: new Array(50).fill("GRASS_TILE_TYPE_A"),
    entities: new Array(50).fill({ type: "COIN", value: 10 })
  };
  storage.setItem("custom_map", JSON.stringify(mapData));

  const uncompressedExport = storage.exportSignedState({ compress: false });
  const compressedExport = storage.exportSignedState({ compress: true });

  assert.strictEqual(compressedExport.compressed, true);
  assert.ok(
    compressedExport.payload.length < uncompressedExport.payload.length,
    "Compressed payload should be significantly smaller than raw JSON"
  );

  // Verify decompression on import
  storage.clear();
  const restoreResult = storage.importSignedState(compressedExport);
  assert.strictEqual(restoreResult.success, true);
  assert.deepStrictEqual(JSON.parse(storage.getItem("custom_map")), mapData);
});

test("Storage quota preflight returns estimated headroom", () => {
  const quota = storage.getAvailableStorageQuota();
  assert.ok(quota.totalQuotaBytes > 0);
  assert.ok(typeof quota.usedBytes === "number");
  assert.ok(quota.estimatedRemainingBytes <= quota.totalQuotaBytes);
});

test("Ensures zero Unicode emojis in storage vault test and implementation", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const selfContent = fs.readFileSync(__filename, "utf8");
  assert.strictEqual(emojiRegex.test(selfContent), false, "Test file must not contain emojis");

  const sdkPath = path.resolve(__dirname, "../assets/js/arcadeverse-sdk.js");
  const sdkContent = fs.readFileSync(sdkPath, "utf8");
  assert.strictEqual(emojiRegex.test(sdkContent), false, "SDK file must not contain emojis");
});
