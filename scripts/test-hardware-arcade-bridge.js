/**
 * Automated Unit Test Suite for ArcadeHardwareBridge
 * Issue #1100 - Web Serial & Web Bluetooth DIY Arcade Controller Hardware Bridge
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const hardwareBridge = require('../assets/js/hardware-arcade-bridge.js');

test('ArcadeHardwareBridge exports all required API methods and constants', () => {
  assert.ok(Array.isArray(hardwareBridge.SUPPORTED_BAUD_RATES));
  assert.equal(hardwareBridge.DEFAULT_BAUD_RATE, 115200);
  assert.equal(typeof hardwareBridge.getCapabilities, 'function');
  assert.equal(typeof hardwareBridge.normalizeAxis, 'function');
  assert.equal(typeof hardwareBridge.parseBitmaskByte, 'function');
  assert.equal(typeof hardwareBridge.parseSerialPacket, 'function');
  assert.equal(typeof hardwareBridge.applyHardwareState, 'function');
  assert.equal(typeof hardwareBridge.clearAllKeys, 'function');
  assert.equal(typeof hardwareBridge.connectSerial, 'function');
  assert.equal(typeof hardwareBridge.connectBluetooth, 'function');
  assert.equal(typeof hardwareBridge.disconnect, 'function');
  assert.equal(typeof hardwareBridge.setBaudRate, 'function');
  assert.equal(typeof hardwareBridge.setProtocolMode, 'function');
  assert.equal(typeof hardwareBridge.simulateDemoPacket, 'function');
  assert.equal(typeof hardwareBridge.getVirtualGamepad, 'function');
  assert.equal(typeof hardwareBridge.getStatus, 'function');
});

test('getCapabilities gracefully detects unsupported browsers (Safari/Firefox) vs Chrome/Edge', () => {
  const unsupported = hardwareBridge.getCapabilities({});
  assert.equal(unsupported.serial, false);
  assert.equal(unsupported.bluetooth, false);
  assert.equal(unsupported.supported, false);
  assert.ok(unsupported.message.toLowerCase().includes('safari') || unsupported.message.toLowerCase().includes('firefox'));

  const chromeLike = hardwareBridge.getCapabilities({ serial: {}, bluetooth: {} });
  assert.equal(chromeLike.serial, true);
  assert.equal(chromeLike.bluetooth, true);
  assert.equal(chromeLike.supported, true);
});

test('normalizeAxis handles int8 (-128..127) and normalized float (-1.0..1.0) values', () => {
  assert.equal(hardwareBridge.normalizeAxis(-128), -1);
  assert.equal(hardwareBridge.normalizeAxis(0), 0);
  assert.ok(hardwareBridge.normalizeAxis(127) > 0.99);
  assert.equal(hardwareBridge.normalizeAxis(-0.5), -0.5);
  assert.equal(hardwareBridge.normalizeAxis(250), 1);
  assert.equal(hardwareBridge.normalizeAxis(-250), -1);
  assert.equal(hardwareBridge.normalizeAxis('bad'), 0);
});

test('parseSerialPacket decodes standardized JSON serial line packets', () => {
  const parsed = hardwareBridge.parseSerialPacket('{"btnA":1, "joyX":-128}', 'auto');
  assert.ok(parsed);
  assert.equal(parsed.format, 'json');
  assert.equal(parsed.buttons.a, true);
  assert.equal(parsed.buttons.left, true);
  assert.equal(parsed.buttons.right, false);
  assert.equal(parsed.axes[0], -1);

  const multi = hardwareBridge.parseSerialPacket('{"btnB":1,"btnStart":1,"joyY":127}', 'json');
  assert.ok(multi);
  assert.equal(multi.buttons.b, true);
  assert.equal(multi.buttons.start, true);
  assert.equal(multi.buttons.down, true);

  assert.equal(hardwareBridge.parseSerialPacket('{broken json', 'json'), null);
  assert.equal(hardwareBridge.parseSerialPacket('', 'auto'), null);
});

test('parseSerialPacket decodes binary byte bitmasks and hex strings', () => {
  // 0x15 = 0b00010101 -> bit 0 (up), bit 2 (left), bit 4 (a)
  const fromHex = hardwareBridge.parseSerialPacket('0x15', 'auto');
  assert.ok(fromHex);
  assert.equal(fromHex.format, 'bitmask');
  assert.equal(fromHex.buttons.up, true);
  assert.equal(fromHex.buttons.left, true);
  assert.equal(fromHex.buttons.a, true);
  assert.equal(fromHex.buttons.down, false);

  const fromPrefix = hardwareBridge.parseSerialPacket('MASK:0x82', 'bitmask');
  assert.ok(fromPrefix);
  assert.equal(fromPrefix.buttons.down, true);
  assert.equal(fromPrefix.buttons.start, true);

  const fromBytes = hardwareBridge.parseSerialPacket(new Uint8Array([0x28]), 'auto');
  assert.ok(fromBytes);
  assert.equal(fromBytes.buttons.right, true);
  assert.equal(fromBytes.buttons.b, true);
});

test('applyHardwareState updates virtual Gamepad snapshot and tracks sub-10ms latency', () => {
  const parsed = hardwareBridge.parseSerialPacket('{"btnA":1,"joyX":-128}');
  const res = hardwareBridge.applyHardwareState(parsed);

  assert.ok(res.latencyMs < 10, 'Packet translation latency must be sub-10ms');
  assert.ok(res.activeKeys.includes('a'));
  assert.ok(res.activeKeys.includes('left'));

  const gp = hardwareBridge.getVirtualGamepad();
  assert.equal(gp.connected, true);
  assert.equal(gp.axes[0], -1);
  assert.equal(gp.buttons[0].pressed, true); // A
  assert.equal(gp.buttons[14].pressed, true); // Left

  hardwareBridge.clearAllKeys();
  assert.equal(hardwareBridge.getVirtualGamepad().connected, false);
});

test('setBaudRate and setProtocolMode validate allowed configurations', () => {
  assert.equal(hardwareBridge.setBaudRate(115200), 115200);
  assert.equal(hardwareBridge.setBaudRate(9600), 9600);
  assert.equal(hardwareBridge.setBaudRate(12345), 9600); // Ignores invalid rate
  assert.equal(hardwareBridge.setBaudRate(115200), 115200);

  assert.equal(hardwareBridge.setProtocolMode('json'), 'json');
  assert.equal(hardwareBridge.setProtocolMode('invalid'), 'json');
  assert.equal(hardwareBridge.setProtocolMode('auto'), 'auto');
});

test('Ensures zero Unicode emojis across all hardware bridge files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/hardware-arcade-bridge.js',
    'assets/css/hardware-arcade-bridge.css',
    'scripts/test-hardware-arcade-bridge.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
