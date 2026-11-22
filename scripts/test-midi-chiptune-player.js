const test = require('node:test');
const assert = require('node:assert/strict');
const MidiChiptunePlayer = require('../assets/js/midi-chiptune-player.js');

// Tiny SMF Format 0 MIDI file representation in Base64 (MThd header + 1 MTrk track with NoteOn)
const SAMPLE_MIDI_B64 = 'TVRoZAAAAAYAAAABAOBNVHJrAAAAEQAA/1ECA8AAMACQPEBkAIA8QAA=';

test('MidiChiptunePlayer parses SMF header, format, and note-on tracks', () => {
  const player = new MidiChiptunePlayer();
  player.load(SAMPLE_MIDI_B64);

  assert.ok(player.parsedMidi !== null);
  assert.equal(player.parsedMidi.format, 0);
  assert.equal(player.parsedMidi.trackCount, 1);
  assert.ok(player.parsedMidi.tracks.length > 0);
});

test('MidiChiptunePlayer manages voice playback and stop termination', () => {
  const player = new MidiChiptunePlayer();
  player.load(SAMPLE_MIDI_B64);

  player.setVolume(0.8);
  assert.equal(player.volume, 0.8);

  player.stop();
  assert.equal(player.isPlaying, false);
  assert.equal(player.scheduledEvents.length, 0);
});
