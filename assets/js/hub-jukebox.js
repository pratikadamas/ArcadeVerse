/**
 * ArcadeVerse - Hub Jukebox & Procedural Chiptune BGM Player
 * 
 * Provides an atmospheric procedural 8-bit background music synthesizer
 * for the ArcadeVerse game catalog hub.
 * 
 * Features:
 * - 4 distinct procedural 8-bit tracks (Neon Cyber, Retro Arcade, 8-Bit Dungeon, Starlight Voyage)
 * - Pure Web Audio API procedural synthesis with zero audio file downloads or bandwidth consumption
 * - Animated 4-bar SVG audio equalizer in the navigation header
 * - Automatic background music ducking / pausing when a game is launched (`arcadeverse:game-launched`)
 * - Resumes gracefully on modal close (`arcadeverse:game-closed`)
 * - Volume control and state persistence in localStorage (`av_jukebox_state`)
 */

(function () {
  'use strict';

  var TRACKS = [
    {
      id: 'neon_cyber',
      title: 'Neon Cyber Drift',
      tempo: 128,
      leadNotes: [261.63, 311.13, 392.00, 466.16, 523.25, 466.16, 392.00, 311.13],
      bassNotes: [130.81, 130.81, 155.56, 174.61],
      leadWave: 'square',
      bassWave: 'triangle'
    },
    {
      id: 'retro_arcade',
      title: '8-Bit High Score',
      tempo: 140,
      leadNotes: [329.63, 392.00, 493.88, 587.33, 493.88, 392.00, 440.00, 392.00],
      bassNotes: [164.81, 164.81, 196.00, 220.00],
      leadWave: 'sawtooth',
      bassWave: 'square'
    },
    {
      id: 'dungeon_quest',
      title: 'Pixel Dungeon',
      tempo: 105,
      leadNotes: [220.00, 246.94, 261.63, 293.66, 261.63, 246.94, 220.00, 196.00],
      bassNotes: [110.00, 110.00, 123.47, 98.00],
      leadWave: 'triangle',
      bassWave: 'triangle'
    },
    {
      id: 'starlight_voyage',
      title: 'Starlight Voyage',
      tempo: 120,
      leadNotes: [349.23, 440.00, 523.25, 659.25, 523.25, 440.00, 392.00, 440.00],
      bassNotes: [174.61, 174.61, 220.00, 196.00],
      leadWave: 'sine',
      bassWave: 'sawtooth'
    }
  ];

  var STORAGE_KEY = 'av_jukebox_state';
  var audioCtx = null;
  var masterGain = null;
  var timerId = null;
  var isPlaying = false;
  var currentTrackIndex = 0;
  var stepIndex = 0;
  var volume = 0.3;
  var initialized = false;

  var HubJukebox = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadState();
      this.injectStyles();
      this.injectUI();
      this.attachListeners();
    },

    loadState: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (typeof parsed.trackIndex === 'number') currentTrackIndex = parsed.trackIndex % TRACKS.length;
          if (typeof parsed.volume === 'number') volume = Math.max(0, Math.min(1, parsed.volume));
        }
      } catch (e) {}
    },

    saveState: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          trackIndex: currentTrackIndex,
          volume: volume
        }));
      } catch (e) {}
    },

    initAudio: function () {
      if (audioCtx) return;
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      audioCtx = new AudioCtx();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    },

    injectStyles: function () {
      if (document.getElementById('hub-jukebox-styles')) return;

      var style = document.createElement('style');
      style.id = 'hub-jukebox-styles';
      style.textContent = [
        '.jukebox-navbar-widget { display: flex; align-items: center; gap: 8px; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 20px; padding: 4px 10px; margin-left: 8px; font-family: monospace; font-size: 0.75rem; color: #00f0ff; }',
        '.jukebox-btn { background: transparent; border: none; color: #00f0ff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px; border-radius: 4px; transition: color 0.2s, transform 0.1s; }',
        '.jukebox-btn:hover { color: #fff; transform: scale(1.1); }',
        '.jukebox-title { max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.jukebox-bars { display: flex; align-items: flex-end; gap: 2px; width: 14px; height: 12px; }',
        '.jukebox-bar { width: 2px; background: #00f0ff; border-radius: 1px; height: 3px; transition: height 0.15s ease; }',
        '.jukebox-playing .jukebox-bar:nth-child(1) { animation: jbBar 0.5s ease-in-out infinite alternate; }',
        '.jukebox-playing .jukebox-bar:nth-child(2) { animation: jbBar 0.4s ease-in-out infinite alternate 0.1s; }',
        '.jukebox-playing .jukebox-bar:nth-child(3) { animation: jbBar 0.6s ease-in-out infinite alternate 0.2s; }',
        '.jukebox-playing .jukebox-bar:nth-child(4) { animation: jbBar 0.45s ease-in-out infinite alternate 0.15s; }',
        '@keyframes jbBar { 0% { height: 3px; } 100% { height: 12px; } }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectUI: function () {
      if (document.getElementById('hub-jukebox-widget')) return;

      var navRight = document.querySelector('.navbar .nav-right') || document.querySelector('.nav-right');
      if (!navRight) return;

      var widget = document.createElement('div');
      widget.id = 'hub-jukebox-widget';
      widget.className = 'jukebox-navbar-widget';
      widget.title = 'BGM Jukebox (Procedural Chiptune Audio)';

      widget.innerHTML = [
        '<div class="jukebox-bars" id="jukebox-bars">',
        '  <div class="jukebox-bar"></div>',
        '  <div class="jukebox-bar"></div>',
        '  <div class="jukebox-bar"></div>',
        '  <div class="jukebox-bar"></div>',
        '</div>',
        '<span class="jukebox-title" id="jukebox-track-title">' + TRACKS[currentTrackIndex].title + '</span>',
        '<button class="jukebox-btn" id="jukebox-play-btn" aria-label="Toggle Hub Music" title="Play / Pause Hub Music">',
        '  <svg id="jukebox-play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">',
        '    <polygon points="5 3 19 12 5 21 5 3"></polygon>',
        '  </svg>',
        '</button>',
        '<button class="jukebox-btn" id="jukebox-next-btn" aria-label="Next Track" title="Next Track">',
        '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '    <polygon points="5 4 15 12 5 20 5 4"></polygon>',
        '    <line x1="19" y1="5" x2="19" y2="19"></line>',
        '  </svg>',
        '</button>'
      ].join('');

      navRight.appendChild(widget);

      var playBtn = document.getElementById('jukebox-play-btn');
      playBtn.addEventListener('click', function () {
        HubJukebox.togglePlay();
      });

      var nextBtn = document.getElementById('jukebox-next-btn');
      nextBtn.addEventListener('click', function () {
        HubJukebox.nextTrack();
      });
    },

    playTone: function (freq, type, duration, gainVol) {
      if (!audioCtx || !masterGain || freq <= 0) return;

      try {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();

        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        var vol = (typeof gainVol === 'number') ? gainVol : 0.08;
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {}
    },

    tick: function () {
      if (!isPlaying) return;

      var track = TRACKS[currentTrackIndex];
      var leadNote = track.leadNotes[stepIndex % track.leadNotes.length];
      var bassNote = track.bassNotes[Math.floor(stepIndex / 2) % track.bassNotes.length];

      var stepDuration = (60 / track.tempo) / 2;

      this.playTone(leadNote, track.leadWave, stepDuration * 0.9, 0.06);
      if (stepIndex % 2 === 0) {
        this.playTone(bassNote, track.bassWave, stepDuration * 1.8, 0.09);
      }

      stepIndex++;
      timerId = setTimeout(function () {
        HubJukebox.tick();
      }, stepDuration * 1000);
    },

    togglePlay: function () {
      this.initAudio();
      if (!audioCtx) return;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if (isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },

    play: function () {
      if (isPlaying) return;
      this.initAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

      isPlaying = true;
      stepIndex = 0;
      this.updateUI();
      this.tick();
    },

    pause: function () {
      if (!isPlaying) return;
      isPlaying = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      this.updateUI();
    },

    nextTrack: function () {
      currentTrackIndex = (currentTrackIndex + 1) % TRACKS.length;
      stepIndex = 0;
      this.saveState();
      this.updateUI();

      if (isPlaying && timerId) {
        clearTimeout(timerId);
        timerId = null;
        this.tick();
      }
    },

    updateUI: function () {
      var widget = document.getElementById('hub-jukebox-widget');
      var title = document.getElementById('jukebox-track-title');
      var playIcon = document.getElementById('jukebox-play-icon');

      if (title) title.textContent = TRACKS[currentTrackIndex].title;

      if (widget) {
        if (isPlaying) {
          widget.classList.add('jukebox-playing');
        } else {
          widget.classList.remove('jukebox-playing');
        }
      }

      if (playIcon) {
        if (isPlaying) {
          playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        } else {
          playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
        }
      }
    },

    attachListeners: function () {
      // Auto-duck / pause BGM when a game is launched in the modal
      window.addEventListener('arcadeverse:game-launched', function () {
        if (isPlaying) {
          HubJukebox.pause();
          HubJukebox._wasAutoDucked = true;
        }
      });

      // Resume on game closed if it was playing previously
      window.addEventListener('arcadeverse:game-closed', function () {
        if (HubJukebox._wasAutoDucked) {
          HubJukebox._wasAutoDucked = false;
          HubJukebox.play();
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      HubJukebox.init();
    });
  } else {
    HubJukebox.init();
  }

  window.HubJukebox = HubJukebox;
})();
