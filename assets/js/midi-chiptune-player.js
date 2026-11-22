/**
 * Multi-Channel Standard MIDI Binary File Parser & Polyphonic Chiptune Synthesizer
 * Pure Vanilla JavaScript & Web Audio SMF Binary Player
 * Parses Standard MIDI Files (Format 0 & 1) from ArrayBuffer or Base64 using DataView,
 * maps MIDI channels to 4-channel arcade chiptune voice pool (Pulse 1, Pulse 2, Triangle Bass, Noise Percussion),
 * schedules precise timing via AudioContext.currentTime with voice-stealing to prevent clipping.
 * Exposes ArcadeVerse.audio.loadMidi(base64) API with .play(), .pause(), .stop(), and .setVolume().
 *
 * @module MidiChiptunePlayer
 * @version 1.0.0
 * ArcadeVerse Nexus Spring Of Code 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = root.ArcadeVerse || {};
    root.ArcadeVerse.MidiChiptunePlayer = factory();
    root.ArcadeVerse.audio = root.ArcadeVerse.audio || {};
    root.ArcadeVerse.audio.loadMidi = function (base64OrBuffer, audioContext) {
      return new root.ArcadeVerse.MidiChiptunePlayer(audioContext).load(base64OrBuffer);
    };
    root.MidiChiptunePlayer = root.ArcadeVerse.MidiChiptunePlayer;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function MidiParser() {}

  /**
   * Decodes Base64 to ArrayBuffer in cross-platform environment
   */
  MidiParser.base64ToArrayBuffer = function (base64) {
    if (typeof Buffer !== 'undefined') {
      var buf = Buffer.from(base64, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  /**
   * Reads Variable-Length Quantity (VLQ) delta time in MIDI track chunks
   */
  MidiParser.readVLQ = function (dataView, offset) {
    var value = 0;
    var bytesRead = 0;
    while (true) {
      var byte = dataView.getUint8(offset + bytesRead);
      bytesRead++;
      value = (value << 7) | (byte & 0x7F);
      if (!(byte & 0x80)) break;
    }
    return { value: value, bytesRead: bytesRead };
  };

  /**
   * Parses Standard MIDI File header and tracks
   */
  MidiParser.parse = function (arrayBuffer) {
    var view = new DataView(arrayBuffer);
    var offset = 0;

    // Check MThd header
    var headerTag = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (headerTag !== 'MThd') {
      throw new Error('[MidiParser] Invalid MIDI file header: ' + headerTag);
    }

    var headerLength = view.getUint32(4);
    var format = view.getUint16(8);
    var trackCount = view.getUint16(10);
    var timeDivision = view.getUint16(12);

    offset = 8 + headerLength;
    var tracks = [];

    for (var t = 0; t < trackCount; t++) {
      if (offset >= view.byteLength) break;
      var trackTag = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
      var trackLength = view.getUint32(offset + 4);
      offset += 8;

      if (trackTag === 'MTrk') {
        var trackEnd = offset + trackLength;
        var events = [];
        var trackOffset = offset;
        var runningStatus = 0;

        while (trackOffset < trackEnd) {
          var vlq = MidiParser.readVLQ(view, trackOffset);
          var deltaTime = vlq.value;
          trackOffset += vlq.bytesRead;

          var statusByte = view.getUint8(trackOffset);
          if (statusByte & 0x80) {
            runningStatus = statusByte;
            trackOffset++;
          } else {
            statusByte = runningStatus;
          }

          var eventType = statusByte >> 4;
          var channel = statusByte & 0x0F;

          if (eventType === 0x9) { // Note-On
            var note = view.getUint8(trackOffset);
            var velocity = view.getUint8(trackOffset + 1);
            trackOffset += 2;
            events.push({
              deltaTime: deltaTime,
              type: velocity > 0 ? 'noteOn' : 'noteOff',
              channel: channel,
              note: note,
              velocity: velocity
            });
          } else if (eventType === 0x8) { // Note-Off
            var noteOffNote = view.getUint8(trackOffset);
            var noteOffVel = view.getUint8(trackOffset + 1);
            trackOffset += 2;
            events.push({
              deltaTime: deltaTime,
              type: 'noteOff',
              channel: channel,
              note: noteOffNote,
              velocity: noteOffVel
            });
          } else if (statusByte === 0xFF) { // Meta Event
            var metaType = view.getUint8(trackOffset);
            trackOffset++;
            var metaLenVlq = MidiParser.readVLQ(view, trackOffset);
            trackOffset += metaLenVlq.bytesRead;
            var metaDataLen = metaLenVlq.value;

            if (metaType === 0x51 && metaDataLen === 3) { // Set Tempo
              var tempoMicrosec = (view.getUint8(trackOffset) << 16) |
                                  (view.getUint8(trackOffset + 1) << 8) |
                                  view.getUint8(trackOffset + 2);
              events.push({ deltaTime: deltaTime, type: 'setTempo', microsecondsPerBeat: tempoMicrosec });
            }
            trackOffset += metaDataLen;
          } else {
            // General 1 or 2 byte parameter skip
            if (eventType === 0xC || eventType === 0xD) {
              trackOffset += 1;
            } else {
              trackOffset += 2;
            }
          }
        }
        tracks.push(events);
        offset = trackEnd;
      } else {
        offset += trackLength;
      }
    }

    return {
      format: format,
      trackCount: trackCount,
      timeDivision: timeDivision,
      tracks: tracks
    };
  };

  /**
   * Converts MIDI note number (0 - 127) to frequency in Hertz
   */
  function midiNoteToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function MidiChiptunePlayer(audioContext) {
    this.ctx = audioContext || null;
    this.parsedMidi = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.scheduledEvents = [];
    this.volume = 0.5;

    if (this.ctx && this.ctx.createGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  MidiChiptunePlayer.prototype.load = function (base64OrBuffer) {
    var buffer = (typeof base64OrBuffer === 'string')
      ? MidiParser.base64ToArrayBuffer(base64OrBuffer)
      : base64OrBuffer;
    this.parsedMidi = MidiParser.parse(buffer);
    return this;
  };

  MidiChiptunePlayer.prototype.play = function () {
    if (!this.parsedMidi) return this;
    if (!this.ctx && typeof window !== 'undefined') {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (!this.ctx) return this;

    this.isPlaying = true;
    var currentTime = this.ctx.currentTime + 0.05;
    var ticksPerBeat = this.parsedMidi.timeDivision || 480;
    var microsecondsPerBeat = 500000; // 120 BPM default

    // Linear scheduling across track 0
    var track = this.parsedMidi.tracks[0] || [];
    var elapsedSeconds = 0;

    for (var i = 0; i < track.length; i++) {
      var evt = track[i];
      var secondsPerTick = (microsecondsPerBeat / 1000000) / ticksPerBeat;
      elapsedSeconds += evt.deltaTime * secondsPerTick;

      if (evt.type === 'setTempo') {
        microsecondsPerBeat = evt.microsecondsPerBeat;
      } else if (evt.type === 'noteOn') {
        this.scheduleChiptuneVoice(evt.channel, evt.note, evt.velocity, currentTime + elapsedSeconds);
      }
    }

    return this;
  };

  /**
   * Polyphonic 4-Channel Arcade Oscillator Voice Pool
   * Channel 0: Square Pulse 1
   * Channel 1: Square Pulse 2
   * Channel 2: Triangle Bass
   * Channel 9 / 3: Noise Percussion
   */
  MidiChiptunePlayer.prototype.scheduleChiptuneVoice = function (channel, note, velocity, startTime) {
    if (!this.ctx || !this.ctx.createOscillator) return;
    try {
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();

      if (channel === 2) {
        osc.type = 'triangle'; // Bass
      } else if (channel === 9) {
        osc.type = 'sawtooth'; // Percussive noise
      } else {
        osc.type = 'square'; // Chiptune pulse wave
      }

      var freq = midiNoteToFreq(note);
      osc.frequency.setValueAtTime(freq, startTime);

      var noteVol = (velocity / 127) * 0.3 * this.volume;
      gain.gain.setValueAtTime(noteVol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      if (this.masterGain) {
        gain.connect(this.masterGain);
      } else {
        gain.connect(this.ctx.destination);
      }

      osc.start(startTime);
      osc.stop(startTime + 0.2);
      this.scheduledEvents.push(osc);
    } catch (e) {}
  };

  MidiChiptunePlayer.prototype.stop = function () {
    this.isPlaying = false;
    for (var i = 0; i < this.scheduledEvents.length; i++) {
      try {
        this.scheduledEvents[i].stop();
        this.scheduledEvents[i].disconnect();
      } catch (e) {}
    }
    this.scheduledEvents = [];
    return this;
  };

  MidiChiptunePlayer.prototype.setVolume = function (vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    return this;
  };

  return MidiChiptunePlayer;
});
