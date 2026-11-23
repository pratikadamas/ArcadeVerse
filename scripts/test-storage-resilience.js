const test = require('node:test');
const assert = require('node:assert');

// Simulate environments where localStorage access throws SecurityError (private browsing / 3rd party cookie block)
class MockBlockedStorage {
  getItem() {
    throw new Error('SecurityError: The operation is insecure.');
  }
  setItem() {
    throw new Error('SecurityError: The operation is insecure.');
  }
  removeItem() {
    throw new Error('SecurityError: The operation is insecure.');
  }
}

// Resilient memory fallback engine implementation
class SafeStorageManager {
  constructor(storageBackend = null) {
    this.backend = storageBackend;
    this.memoryFallback = new Map();
  }

  getItem(key, fallback = null) {
    try {
      if (this.backend) {
        const val = this.backend.getItem(key);
        return val !== null && val !== undefined ? val : fallback;
      }
    } catch (_) {}
    return this.memoryFallback.has(key) ? this.memoryFallback.get(key) : fallback;
  }

  setItem(key, val) {
    const stringVal = String(val);
    try {
      if (this.backend) {
        this.backend.setItem(key, stringVal);
        return true;
      }
    } catch (_) {}
    this.memoryFallback.set(key, stringVal);
    return true;
  }

  removeItem(key) {
    try {
      if (this.backend) {
        this.backend.removeItem(key);
      }
    } catch (_) {}
    this.memoryFallback.delete(key);
  }

  clear() {
    try {
      if (this.backend && typeof this.backend.clear === 'function') {
        this.backend.clear();
      }
    } catch (_) {}
    this.memoryFallback.clear();
  }
}

test('SafeStorageManager handles SecurityError exceptions gracefully and uses memory fallback', () => {
  const blockedStorage = new MockBlockedStorage();
  const manager = new SafeStorageManager(blockedStorage);

  // 1. Getting item should return default fallback without throwing
  const initial = manager.getItem('test_pref', 'default_val');
  assert.strictEqual(initial, 'default_val');

  // 2. Setting item should store in in-memory fallback without throwing
  assert.doesNotThrow(() => {
    manager.setItem('test_pref', 'custom_val');
  });

  // 3. Retrieval should read from memory fallback
  const retrieved = manager.getItem('test_pref', 'default_val');
  assert.strictEqual(retrieved, 'custom_val');

  // 4. Removal should delete from memory fallback
  manager.removeItem('test_pref');
  const afterRemove = manager.getItem('test_pref', 'default_val');
  assert.strictEqual(afterRemove, 'default_val');
});

test('SafeStorageManager uses native storage backend when accessible', () => {
  const inMemoryBackend = new Map();
  const mockStorage = {
    getItem: (k) => inMemoryBackend.has(k) ? inMemoryBackend.get(k) : null,
    setItem: (k, v) => inMemoryBackend.set(k, String(v)),
    removeItem: (k) => inMemoryBackend.delete(k)
  };

  const manager = new SafeStorageManager(mockStorage);
  manager.setItem('favorite_game', 'cyber-orbit-defense');
  assert.strictEqual(inMemoryBackend.get('favorite_game'), 'cyber-orbit-defense');
  assert.strictEqual(manager.getItem('favorite_game'), 'cyber-orbit-defense');
});
