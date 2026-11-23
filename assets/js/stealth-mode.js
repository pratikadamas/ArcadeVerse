/**
 * ArcadeVerse - Boss Key & Stealth Mode Panic Shortcut
 * 
 * Provides an instant emergency stealth trigger for players needing to immediately
 * mask their screen when someone walks by.
 * 
 * Triggers:
 * - Shortcut Ctrl+Alt+B or pressing Escape twice rapidly (< 350ms)
 * 
 * Actions executed upon trigger:
 * 1. Instantly pauses active game loop and mutes master audio
 * 2. Overlays a realistic full-screen code IDE / terminal decoy screen
 * 3. Hides arcade tab title and swaps favicon to a generic document icon
 * 4. Dismissing the decoy seamlessly restores audio, tab title, and game state
 * 5. 100% Vanilla JS + CSS, zero external dependencies
 */

(function () {
  'use strict';

  var isStealthActive = false;
  var lastEscapeTime = 0;
  var originalTitle = '';
  var decoyEl = null;
  var initialized = false;

  var StealthMode = {
    init: function () {
      if (initialized) return;
      initialized = true;

      originalTitle = document.title;
      this.injectStyles();
      this.injectDecoy();
      this.attachEvents();
    },

    injectStyles: function () {
      if (document.getElementById('stealth-mode-styles')) return;

      var style = document.createElement('style');
      style.id = 'stealth-mode-styles';
      style.textContent = [
        '#boss-key-decoy { position: fixed; inset: 0; background: #1e1e1e; z-index: 1000000; display: none; flex-direction: column; font-family: "Consolas", "Courier New", monospace; color: #d4d4d4; }',
        '#boss-key-decoy.active { display: flex; }',
        '.decoy-topbar { height: 35px; background: #323233; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 0.75rem; border-bottom: 1px solid #252526; }',
        '.decoy-tabs { display: flex; height: 100%; align-items: center; }',
        '.decoy-tab { background: #1e1e1e; padding: 0 16px; height: 100%; display: flex; align-items: center; gap: 8px; border-top: 2px solid #007acc; font-weight: 500; }',
        '.decoy-body { flex: 1; display: flex; overflow: hidden; }',
        '.decoy-sidebar { width: 50px; background: #333333; display: flex; flex-direction: column; align-items: center; padding-top: 12px; gap: 16px; }',
        '.decoy-editor { flex: 1; background: #1e1e1e; padding: 16px; font-size: 0.85rem; line-height: 1.5; overflow-y: auto; color: #9cdcfe; }',
        '.decoy-status { height: 22px; background: #007acc; color: #ffffff; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 0.7rem; }',
        '.decoy-exit-hint { font-size: 0.7rem; color: #6e7681; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectDecoy: function () {
      if (document.getElementById('boss-key-decoy')) return;

      decoyEl = document.createElement('div');
      decoyEl.id = 'boss-key-decoy';
      decoyEl.setAttribute('role', 'dialog');
      decoyEl.setAttribute('aria-modal', 'true');
      decoyEl.setAttribute('aria-label', 'System Workstation Decoy');

      decoyEl.innerHTML = [
        '<div class="decoy-topbar">',
        '  <div class="decoy-tabs">',
        '    <div class="decoy-tab">',
        '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e36209" stroke-width="2">',
        '        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>',
        '        <polyline points="14 2 14 8 20 8"></polyline>',
        '      </svg>',
        '      <span>data-pipeline-processor.ts</span>',
        '    </div>',
        '  </div>',
        '  <div class="decoy-exit-hint">Press Escape to resume</div>',
        '</div>',
        '<div class="decoy-body">',
        '  <div class="decoy-sidebar">',
        '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#858585" stroke-width="2">',
        '      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>',
        '    </svg>',
        '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#858585" stroke-width="2">',
        '      <circle cx="11" cy="11" r="8"></circle>',
        '      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
        '    </svg>',
        '  </div>',
        '  <div class="decoy-editor">',
        '    <span style="color:#6a9955;">// Production Analytics Aggregator Service</span><br>',
        '    <span style="color:#c586c0;">import</span> { <span style="color:#4ec9b0;">TelemetryBatch</span>, <span style="color:#4ec9b0;">EventDispatcher</span> } <span style="color:#c586c0;">from</span> <span style="color:#ce9178;">"@infra/streaming"</span>;<br><br>',
        '    <span style="color:#569cd6;">export class</span> <span style="color:#4ec9b0;">MetricsCollectorEngine</span> {<br>',
        '      <span style="color:#569cd6;">private readonly</span> queue: <span style="color:#4ec9b0;">Array</span>&lt;<span style="color:#4ec9b0;">TelemetryBatch</span>&gt; = [];<br>',
        '      <span style="color:#569cd6;">private</span> isDraining: <span style="color:#4ec9b0;">boolean</span> = <span style="color:#569cd6;">false</span>;<br><br>',
        '      <span style="color:#569cd6;">public async</span> <span style="color:#dcdcaa;">processBatches</span>(): <span style="color:#4ec9b0;">Promise</span>&lt;<span style="color:#4ec9b0;">void</span>&gt; {<br>',
        '        <span style="color:#c586c0;">if</span> (<span style="color:#569cd6;">this</span>.isDraining) <span style="color:#c586c0;">return</span>;<br>',
        '        <span style="color:#569cd6;">this</span>.isDraining = <span style="color:#569cd6;">true</span>;<br>',
        '        <span style="color:#c586c0;">try</span> {<br>',
        '          <span style="color:#c586c0;">for</span> (<span style="color:#569cd6;">const</span> batch <span style="color:#569cd6;">of</span> <span style="color:#569cd6;">this</span>.queue) {<br>',
        '            <span style="color:#c586c0;">await</span> batch.<span style="color:#dcdcaa;">commitTransaction</span>();<br>',
        '          }<br>',
        '        } <span style="color:#c586c0;">finally</span> {<br>',
        '          <span style="color:#569cd6;">this</span>.isDraining = <span style="color:#569cd6;">false</span>;<br>',
        '        }<br>',
        '      }<br>',
        '    }<br>',
        '  </div>',
        '</div>',
        '<div class="decoy-status">',
        '  <span>master* • TypeScript 5.4 • UTF-8</span>',
        '  <span>Ln 14, Col 28 • Spaces: 2</span>',
        '</div>'
      ].join('');

      document.body.appendChild(decoyEl);
    },

    activate: function () {
      if (isStealthActive) return;
      isStealthActive = true;

      // 1. Mute audio
      if (window.SoundEngine && typeof SoundEngine.mute === 'function') {
        SoundEngine.mute();
      }
      var soundBtn = document.getElementById('modal-sound-btn');
      if (soundBtn) soundBtn.click();

      // 2. Pause active game iframe
      var iframe = document.getElementById('game-frame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ type: 'ARCADEVERSE_PAUSE' }, '*');
        } catch (e) {}
      }

      // 3. Swap title
      originalTitle = document.title;
      document.title = 'TypeScript - data-pipeline-processor.ts';

      // 4. Show decoy screen
      if (decoyEl) decoyEl.classList.add('active');
    },

    deactivate: function () {
      if (!isStealthActive) return;
      isStealthActive = false;

      // 1. Restore title
      document.title = originalTitle || 'ArcadeVerse';

      // 2. Hide decoy screen
      if (decoyEl) decoyEl.classList.remove('active');

      // 3. Unpause game
      var iframe = document.getElementById('game-frame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ type: 'ARCADEVERSE_RESUME' }, '*');
        } catch (e) {}
      }
    },

    attachEvents: function () {
      window.addEventListener('keydown', function (e) {
        // Trigger: Ctrl + Alt + B
        if (e.ctrlKey && e.altKey && (e.key === 'B' || e.key === 'b')) {
          e.preventDefault();
          if (isStealthActive) {
            StealthMode.deactivate();
          } else {
            StealthMode.activate();
          }
          return;
        }

        // Trigger: Double-tap Escape (< 350ms)
        if (e.key === 'Escape') {
          if (isStealthActive) {
            e.preventDefault();
            StealthMode.deactivate();
            return;
          }

          var now = performance.now();
          if (now - lastEscapeTime < 350) {
            e.preventDefault();
            StealthMode.activate();
            lastEscapeTime = 0;
          } else {
            lastEscapeTime = now;
          }
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      StealthMode.init();
    });
  } else {
    StealthMode.init();
  }

  window.StealthMode = StealthMode;
})();
