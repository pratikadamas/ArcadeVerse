/**
 * Automated Unit Test Suite for ArcadeAudioBeacon
 * Issue #1101 - Universal Spatial Audio Beacon & Stereo Sonification for Blind Players
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const audioBeacon = require('../assets/js/a11y-audio-beacon.js');

test('ArcadeAudioBeacon exports all required API methods', () => {
  assert.equal(typeof audioBeacon.normalizeCoordinates, 'function');
  assert.equal(typeof audioBeacon.computePan, 'function');
  assert.equal(typeof audioBeacon.computePitch, 'function');
  assert.equal(typeof audioBeacon.computeProximity, 'function');
  assert.equal(typeof audioBeacon.computeRadarInterval, 'function');
  assert.equal(typeof audioBeacon.playSpatialTone, 'function');
  assert.equal(typeof audioBeacon.sonifyEntity, 'function');
  assert.equal(typeof audioBeacon.updatePlayerPosition, 'function');
  assert.equal(typeof audioBeacon.setHazards, 'function');
  assert.equal(typeof audioBeacon.stopRadar, 'function');
  assert.equal(typeof audioBeacon.reset, 'function');
  assert.equal(typeof audioBeacon.setEnabled, 'function');
  assert.equal(typeof audioBeacon.isEnabled, 'function');
  assert.equal(typeof audioBeacon.toggle, 'function');
  assert.equal(typeof audioBeacon.setMasterVolume, 'function');
  assert.equal(typeof audioBeacon.getMasterVolume, 'function');
});

test('normalizeCoordinates maps pixel and normalized values into [0.0, 1.0] range', () => {
  // Already normalized coordinates
  const norm1 = audioBeacon.normalizeCoordinates(0.3, 0.7);
  assert.equal(norm1.normX, 0.3);
  assert.equal(norm1.normY, 0.7);

  // Pixel coordinates with explicit bounds
  const norm2 = audioBeacon.normalizeCoordinates(400, 300, { width: 800, height: 600 });
  assert.equal(norm2.normX, 0.5);
  assert.equal(norm2.normY, 0.5);

  // Out of bounds clamping
  const norm3 = audioBeacon.normalizeCoordinates(-50, 1200, { width: 800, height: 600 });
  assert.equal(norm3.normX, 0.0);
  assert.equal(norm3.normY, 1.0);

  // Fallback on invalid numbers
  const norm4 = audioBeacon.normalizeCoordinates('invalid', NaN);
  assert.equal(norm4.normX, 0.5);
  assert.equal(norm4.normY, 0.5);
});

test('computePan accurately maps horizontal position to stereo panner [-1.0, +1.0]', () => {
  assert.equal(audioBeacon.computePan(0.0), -1.0, 'Left edge must be hard left (-1.0)');
  assert.equal(audioBeacon.computePan(0.5), 0.0, 'Center must be 0.0');
  assert.equal(audioBeacon.computePan(1.0), 1.0, 'Right edge must be hard right (+1.0)');
  assert.equal(audioBeacon.computePan(0.25), -0.5, 'Quarter position must be -0.5');
  assert.equal(audioBeacon.computePan(0.75), 0.5, 'Three-quarter position must be +0.5');

  // Clamping
  assert.equal(audioBeacon.computePan(-0.5), -1.0);
  assert.equal(audioBeacon.computePan(1.8), 1.0);
});

test('computePitch accurately modulates frequency from 200Hz (bottom) to 1200Hz (top)', () => {
  assert.equal(audioBeacon.computePitch(0.0), 1200.0, 'Screen top (normY=0) must be 1200Hz');
  assert.equal(audioBeacon.computePitch(1.0), 200.0, 'Screen bottom (normY=1) must be 200Hz');
  assert.equal(audioBeacon.computePitch(0.5), 700.0, 'Screen vertical center (normY=0.5) must be 700Hz');

  // Intermediate values
  assert.equal(audioBeacon.computePitch(0.25), 950.0);
  assert.equal(audioBeacon.computePitch(0.75), 450.0);
});

test('computeProximity identifies nearest boundary and hazard distance', () => {
  // Center screen, no hazards
  const centerProx = audioBeacon.computeProximity(0.5, 0.5, []);
  assert.equal(centerProx.distance, 0.5);
  assert.equal(centerProx.hazardNear, false);

  // Near left edge
  const leftProx = audioBeacon.computeProximity(0.05, 0.5, []);
  assert.equal(leftProx.distance, 0.05);
  assert.equal(leftProx.closestSide, 'left');

  // Near top edge
  const topProx = audioBeacon.computeProximity(0.5, 0.02, []);
  assert.equal(topProx.distance, 0.02);
  assert.equal(topProx.closestSide, 'top');

  // Near incoming hazard
  const hazards = [{ x: 410, y: 300 }]; // close to player at (400, 300) in 800x600 -> (0.5, 0.5)
  const hazardProx = audioBeacon.computeProximity(0.5, 0.5, hazards);
  assert.ok(hazardProx.distance < 0.05, 'Hazard proximity should be close');
  assert.equal(hazardProx.hazardNear, true, 'Hazard should be detected as nearest');
});

test('computeRadarInterval scales tempo from 100ms at edge to 1000ms at center', () => {
  assert.equal(audioBeacon.computeRadarInterval(0.0), 100, 'Immediate hazard/edge must pulse rapidly at 100ms');
  assert.equal(audioBeacon.computeRadarInterval(0.5), 1000, 'Safe center must pulse calmly at 1000ms');

  const midInterval = audioBeacon.computeRadarInterval(0.25);
  assert.ok(midInterval >= 500 && midInterval <= 600, 'Quarter distance should interpolate around 550ms');
});

test('State management, toggles, and volume controls operate cleanly', () => {
  const initial = audioBeacon.isEnabled();
  
  audioBeacon.setEnabled(!initial, true);
  assert.equal(audioBeacon.isEnabled(), !initial);

  audioBeacon.toggle();
  assert.equal(audioBeacon.isEnabled(), initial);

  audioBeacon.setMasterVolume(0.25);
  assert.equal(audioBeacon.getMasterVolume(), 0.25);

  // Clamping volume to [0.0, 1.0]
  audioBeacon.setMasterVolume(1.8);
  assert.equal(audioBeacon.getMasterVolume(), 1.0);

  audioBeacon.setMasterVolume(-0.5);
  assert.equal(audioBeacon.getMasterVolume(), 0.0);

  // Reset to default
  audioBeacon.setMasterVolume(0.12);
  audioBeacon.setEnabled(false, true);
  audioBeacon.stopRadar();
});

test('sonifyEntity and updatePlayerPosition execute safely in headless environments', () => {
  // Should not throw or crash when Web Audio is unavailable in Node.js
  assert.doesNotThrow(() => {
    audioBeacon.sonifyEntity(100, 200, 'coin');
    audioBeacon.sonifyEntity(300, 400, 'hazard');
    audioBeacon.sonifyEntity(50, 50, 'wall');
    audioBeacon.sonifyEntity(200, 300, 'beacon');
    audioBeacon.sonifyEntity(700, 500, 'portal');
    audioBeacon.sonifyEntity(150, 250, 'powerup');
    audioBeacon.sonifyEntity(400, 300, 'goal');
    audioBeacon.sonifyEntity(400, 300, 'unknown');
  });

  assert.doesNotThrow(() => {
    audioBeacon.updatePlayerPosition(400, 300, 800, 600);
    audioBeacon.setHazards([{ x: 200, y: 150 }]);
    audioBeacon.stopRadar();
  });
});

test('ArcadeVerse SDK exposes a11y audio beacon bridge methods', () => {
  const sdkContent = fs.readFileSync(path.join(__dirname, '../assets/js/arcadeverse-sdk.js'), 'utf8');
  assert.ok(sdkContent.includes('sonifyEntity'), 'SDK must expose sonifyEntity');
  assert.ok(sdkContent.includes('updatePlayerPosition'), 'SDK must expose updatePlayerPosition');
  assert.ok(sdkContent.includes('isAudioBeaconEnabled'), 'SDK must expose isAudioBeaconEnabled');
  assert.ok(sdkContent.includes('toggleAudioBeacon'), 'SDK must expose toggleAudioBeacon');
});

test('Ensures zero Unicode emojis across all modified files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/a11y-audio-beacon.js',
    'assets/js/a11y-engine.js',
    'assets/js/keyboard-shortcuts.js',
    'scripts/test-a11y-audio-beacon.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
