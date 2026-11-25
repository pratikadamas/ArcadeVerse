/**
 * ArcadeVerse - Web Serial & Web Bluetooth DIY Arcade Controller Hardware Bridge
 * Architectural Implementation for Issue #1100
 *
 * Connects DIY microcontrollers (Arduino, ESP32, Raspberry Pi Pico) directly to
 * ArcadeVerse via Web Serial API and Web Bluetooth API:
 * - Reads 115200 baud (configurable) serial line JSON or binary byte bitmasks.
 * - Reads BLE GATT notifications from wireless ESP32 arcade controllers.
 * - Translates hardware inputs into zero-latency KeyboardEvents routed to #game-iframe
 *   and exposes a virtual Gamepad API state snapshot.
 * - Provides a visual Hardware Connection Assistant Modal with baud switcher,
 *   virtual pad visualizer, live packet monitor, and browser compatibility notice.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeHardwareBridge = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUPPORTED_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 921600];
  var DEFAULT_BAUD_RATE = 115200;
  var ANALOG_THRESHOLD = 0.35;
  var MAX_LOG_LINES = 60;

  // Standard BLE UART (Nordic UART Service) & common DIY ESP32 HID/Custom services
  var BLE_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  var BLE_CUSTOM_SERVICE = 0xffe0;

  var KEY_MAPPINGS = {
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    a: { key: ' ', code: 'Space', keyCode: 32 },
    b: { key: 'z', code: 'KeyZ', keyCode: 90 },
    x: { key: 'x', code: 'KeyX', keyCode: 88 },
    y: { key: 'Enter', code: 'Enter', keyCode: 13 },
    start: { key: 'Escape', code: 'Escape', keyCode: 27 },
    select: { key: 'Tab', code: 'Tab', keyCode: 9 }
  };

  // Bitmask protocol mapping (1 byte: bit 0..7)
  // Bit 0: Up, Bit 1: Down, Bit 2: Left, Bit 3: Right,
  // Bit 4: A, Bit 5: B, Bit 6: X, Bit 7: Start
  var BITMASK_ORDER = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'start'];

  var connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
  var connectionType = null; // 'serial' | 'bluetooth' | null
  var deviceLabel = 'None';
  var baudRate = DEFAULT_BAUD_RATE;
  var protocolMode = 'auto'; // 'auto' | 'json' | 'bitmask'

  var serialPort = null;
  var serialReader = null;
  var serialReadKeepGoing = false;
  var bleDevice = null;
  var bleCharacteristic = null;

  var activeVirtualKeys = new Set();
  var packetCount = 0;
  var lastLatencyMs = 0;
  var monitorPaused = false;
  var logBuffer = [];

  var virtualGamepad = createEmptyGamepad();

  function createEmptyGamepad() {
    return {
      id: 'ArcadeVerse DIY Hardware Bridge (WebSerial/BLE)',
      index: 99,
      connected: false,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, function () {
        return { pressed: false, touched: false, value: 0 };
      }),
      timestamp: 0
    };
  }

  /**
   * Detects browser support for Web Serial and Web Bluetooth APIs.
   *
   * @param {Object} [navOverride] - Optional navigator object for testing
   * @returns {{ serial: boolean, bluetooth: boolean, supported: boolean, message: string }}
   */
  function getCapabilities(navOverride) {
    var nav = navOverride || (typeof navigator !== 'undefined' ? navigator : {});
    var hasSerial = Boolean(nav && 'serial' in nav && nav.serial);
    var hasBluetooth = Boolean(nav && 'bluetooth' in nav && nav.bluetooth);
    var supported = hasSerial || hasBluetooth;

    var message = supported
      ? 'Web Serial / Web Bluetooth APIs detected. Ready to connect Arduino, ESP32, or Raspberry Pi Pico controllers.'
      : 'Your current browser (such as Safari or Firefox) does not support the Web Serial or Web Bluetooth API. Please use Google Chrome, Microsoft Edge, or Opera to connect physical hardware, or use the Packet Simulator below to test controls.';

    return {
      serial: hasSerial,
      bluetooth: hasBluetooth,
      supported: supported,
      message: message
    };
  }

  /**
   * Normalizes an analog axis value (-128..127 or -1.0..1.0) into [-1.0, 1.0].
   *
   * @param {number} val - Raw axis reading
   * @returns {number} Normalized axis value
   */
  function normalizeAxis(val) {
    var n = Number(val);
    if (isNaN(n)) return 0;
    if (Math.abs(n) > 1.0) {
      n = n / 128.0;
    }
    if (n < -1.0) n = -1.0;
    if (n > 1.0) n = 1.0;
    return Math.round(n * 1000) / 1000;
  }

  /**
   * Parses a single byte bitmask into normalized button states.
   *
   * @param {number} byteVal - Integer 0..255
   * @returns {Object} Normalized packet state
   */
  function parseBitmaskByte(byteVal) {
    var mask = Number(byteVal) & 0xff;
    var buttons = {
      up: Boolean(mask & 0x01),
      down: Boolean(mask & 0x02),
      left: Boolean(mask & 0x04),
      right: Boolean(mask & 0x08),
      a: Boolean(mask & 0x10),
      b: Boolean(mask & 0x20),
      x: Boolean(mask & 0x40),
      y: false,
      start: Boolean(mask & 0x80),
      select: false
    };

    var axisX = (buttons.right ? 1 : 0) - (buttons.left ? 1 : 0);
    var axisY = (buttons.down ? 1 : 0) - (buttons.up ? 1 : 0);

    return {
      format: 'bitmask',
      axes: [axisX, axisY],
      buttons: buttons,
      raw: '0x' + mask.toString(16).toUpperCase().padStart(2, '0')
    };
  }

  /**
   * Parses incoming hardware packet (JSON line, hex bitmask string, or Uint8Array).
   *
   * @param {string|Uint8Array|Array<number>} rawInput - Raw serial/BLE packet
   * @param {string} [mode='auto'] - 'auto' | 'json' | 'bitmask'
   * @returns {Object|null} Parsed hardware state or null if invalid
   */
  function parseSerialPacket(rawInput, mode) {
    var activeMode = mode || protocolMode || 'auto';

    if (rawInput == null) return null;

    // Binary Uint8Array or byte array
    if (rawInput instanceof Uint8Array || Array.isArray(rawInput)) {
      if (rawInput.length === 0) return null;
      // If single byte or explicit bitmask mode, parse first byte as bitmask
      if (activeMode === 'bitmask' || (rawInput.length === 1 && rawInput[0] !== 123)) {
        return parseBitmaskByte(rawInput[0]);
      }
      // Otherwise decode UTF-8 text
      try {
        var decoded = typeof TextDecoder !== 'undefined'
          ? new TextDecoder().decode(new Uint8Array(rawInput))
          : String.fromCharCode.apply(null, rawInput);
        rawInput = decoded;
      } catch (_) {
        return parseBitmaskByte(rawInput[0]);
      }
    }

    if (typeof rawInput !== 'string') return null;
    var trimmed = rawInput.trim();
    if (!trimmed) return null;

    // JSON Line Protocol: {"btnA":1, "joyX":-128}
    if (activeMode === 'json' || (activeMode === 'auto' && trimmed.charAt(0) === '{')) {
      try {
        var obj = JSON.parse(trimmed);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

        var axisX = normalizeAxis(
          obj.joyX !== undefined ? obj.joyX : (obj.xAxis !== undefined ? obj.xAxis : obj.lx)
        );
        var axisY = normalizeAxis(
          obj.joyY !== undefined ? obj.joyY : (obj.yAxis !== undefined ? obj.yAxis : obj.ly)
        );

        var buttons = {
          up: Boolean(obj.up || obj.btnUp || axisY < -ANALOG_THRESHOLD),
          down: Boolean(obj.down || obj.btnDown || axisY > ANALOG_THRESHOLD),
          left: Boolean(obj.left || obj.btnLeft || axisX < -ANALOG_THRESHOLD),
          right: Boolean(obj.right || obj.btnRight || axisX > ANALOG_THRESHOLD),
          a: Boolean(obj.btnA || obj.a),
          b: Boolean(obj.btnB || obj.b),
          x: Boolean(obj.btnX || obj.x),
          y: Boolean(obj.btnY || obj.y),
          start: Boolean(obj.btnStart || obj.start),
          select: Boolean(obj.btnSelect || obj.select)
        };

        return {
          format: 'json',
          axes: [axisX, axisY],
          buttons: buttons,
          raw: trimmed
        };
      } catch (_) {
        if (activeMode === 'json') return null;
      }
    }

    // String bitmask formats: "MASK:0x15", "0x15", or decimal "21"
    if (activeMode === 'bitmask' || activeMode === 'auto') {
      var hexMatch = trimmed.match(/^(?:MASK:)?0x([0-9a-fA-F]{1,2})$/i);
      if (hexMatch) {
        return parseBitmaskByte(parseInt(hexMatch[1], 16));
      }
      if (/^\d{1,3}$/.test(trimmed)) {
        var num = parseInt(trimmed, 10);
        if (num >= 0 && num <= 255) {
          return parseBitmaskByte(num);
        }
      }
    }

    return null;
  }

  /**
   * Dispatches a synthetic KeyboardEvent to window and active #game-iframe.
   *
   * @param {Object} mapping - Key descriptor { key, code, keyCode }
   * @param {string} type - 'keydown' | 'keyup'
   */
  function dispatchKey(mapping, type) {
    if (typeof window === 'undefined' || typeof KeyboardEvent === 'undefined') return;

    var eventInit = {
      key: mapping.key,
      code: mapping.code,
      keyCode: mapping.keyCode,
      which: mapping.keyCode,
      bubbles: true,
      cancelable: true
    };

    try {
      window.dispatchEvent(new KeyboardEvent(type, eventInit));
    } catch (_) {}

    if (typeof document !== 'undefined') {
      var gameIframe = document.getElementById('game-iframe');
      if (gameIframe && gameIframe.contentWindow) {
        try {
          var frameDoc = gameIframe.contentDocument || gameIframe.contentWindow.document;
          if (frameDoc) {
            frameDoc.dispatchEvent(new KeyboardEvent(type, eventInit));
          }
        } catch (_) {
          // Cross-origin fallback via postMessage
          try {
            var targetOrigin = (typeof window.getTrustedTargetOrigin === 'function')
              ? window.getTrustedTargetOrigin()
              : (window.location && window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*');

            gameIframe.contentWindow.postMessage({
              type: 'ARCADEVERSE_GAMEPAD_KEY',
              eventType: type,
              key: mapping.key,
              code: mapping.code
            }, targetOrigin);
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Updates virtual Gamepad snapshot and emits synthetic KeyboardEvents on state changes.
   *
   * @param {Object} parsedState - Output from parseSerialPacket()
   * @returns {{ latencyMs: number, activeKeys: Array<string> }}
   */
  function applyHardwareState(parsedState) {
    if (!parsedState || !parsedState.buttons) {
      return { latencyMs: 0, activeKeys: Array.from(activeVirtualKeys) };
    }

    var startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var btns = parsedState.buttons;

    // Diff virtual keys and emit keydown/keyup only on transitions
    var actions = Object.keys(KEY_MAPPINGS);
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      var isPressed = Boolean(btns[action]);
      var wasPressed = activeVirtualKeys.has(action);

      if (isPressed && !wasPressed) {
        activeVirtualKeys.add(action);
        dispatchKey(KEY_MAPPINGS[action], 'keydown');
      } else if (!isPressed && wasPressed) {
        activeVirtualKeys.delete(action);
        dispatchKey(KEY_MAPPINGS[action], 'keyup');
      }
    }

    // Update W3C-compatible virtual Gamepad state
    virtualGamepad.connected = true;
    virtualGamepad.axes[0] = parsedState.axes[0] || 0;
    virtualGamepad.axes[1] = parsedState.axes[1] || 0;
    virtualGamepad.timestamp = startTime;

    var w3cButtonMap = [
      btns.a, btns.b, btns.x, btns.y,
      false, false, false, false,
      btns.select, btns.start,
      false, false,
      btns.up, btns.down, btns.left, btns.right
    ];
    for (var b = 0; b < 16; b++) {
      var pressed = Boolean(w3cButtonMap[b]);
      virtualGamepad.buttons[b].pressed = pressed;
      virtualGamepad.buttons[b].touched = pressed;
      virtualGamepad.buttons[b].value = pressed ? 1 : 0;
    }

    var endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    lastLatencyMs = Math.max(0.1, Math.round((endTime - startTime) * 100) / 100);
    packetCount += 1;

    appendLog('[' + parsedState.format.toUpperCase() + '] ' + parsedState.raw);
    updateVisualizer(btns);
    updateTelemetryUI();

    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcadeverse:hardware-input', {
        detail: {
          state: parsedState,
          gamepad: virtualGamepad,
          latencyMs: lastLatencyMs
        }
      }));
    }

    return {
      latencyMs: lastLatencyMs,
      activeKeys: Array.from(activeVirtualKeys)
    };
  }

  /**
   * Releases all currently held synthesized keys.
   */
  function clearAllKeys() {
    activeVirtualKeys.forEach(function (action) {
      var mapping = KEY_MAPPINGS[action];
      if (mapping) {
        dispatchKey(mapping, 'keyup');
      }
    });
    activeVirtualKeys.clear();
    virtualGamepad.connected = false;
    updateVisualizer({});
  }

  /**
   * Connects to a USB/UART microcontroller via Web Serial API.
   *
   * @param {Object} [options] - { baudRate }
   */
  async function connectSerial(options) {
    var caps = getCapabilities();
    if (!caps.serial) {
      appendLog('[WARN] Web Serial API not supported in this browser.');
      return { ok: false, error: 'UNSUPPORTED_BROWSER', message: caps.message };
    }

    if (connectionState === 'connected') {
      await disconnect();
    }

    var targetBaud = (options && options.baudRate) || baudRate || DEFAULT_BAUD_RATE;
    baudRate = Number(targetBaud) || DEFAULT_BAUD_RATE;
    connectionState = 'connecting';
    updateTelemetryUI();

    try {
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: baudRate });

      var info = serialPort.getInfo ? serialPort.getInfo() : {};
      var vid = info.usbVendorId ? '0x' + info.usbVendorId.toString(16).toUpperCase() : 'UART';
      var pid = info.usbProductId ? '0x' + info.usbProductId.toString(16).toUpperCase() : 'PORT';
      deviceLabel = 'Serial (' + vid + ':' + pid + ' @ ' + baudRate + ')';
      connectionType = 'serial';
      connectionState = 'connected';
      serialReadKeepGoing = true;

      appendLog('[INFO] Connected to ' + deviceLabel);
      updateConnectionUI();
      readSerialLoop();

      return { ok: true, device: deviceLabel };
    } catch (err) {
      connectionState = 'disconnected';
      connectionType = null;
      serialPort = null;
      appendLog('[ERROR] Serial connection cancelled or failed: ' + (err && err.message ? err.message : err));
      updateConnectionUI();
      return { ok: false, error: 'SERIAL_ERROR', message: err && err.message ? err.message : String(err) };
    }
  }

  async function readSerialLoop() {
    if (!serialPort || !serialPort.readable) return;
    var decoder = new TextDecoder();
    var lineBuffer = '';

    while (serialPort.readable && serialReadKeepGoing) {
      try {
        serialReader = serialPort.readable.getReader();
        while (serialReadKeepGoing) {
          var result = await serialReader.read();
          if (result.done) break;
          if (!result.value) continue;

          if (protocolMode === 'bitmask') {
            for (var i = 0; i < result.value.length; i++) {
              var parsedByte = parseSerialPacket(new Uint8Array([result.value[i]]), 'bitmask');
              if (parsedByte) applyHardwareState(parsedByte);
            }
          } else {
            lineBuffer += decoder.decode(result.value, { stream: true });
            var lines = lineBuffer.split(/\r?\n/);
            lineBuffer = lines.pop() || '';
            for (var j = 0; j < lines.length; j++) {
              var parsed = parseSerialPacket(lines[j], protocolMode);
              if (parsed) applyHardwareState(parsed);
            }
          }
        }
      } catch (err) {
        if (serialReadKeepGoing) {
          appendLog('[WARN] Serial stream interrupted: ' + (err && err.message ? err.message : err));
        }
      } finally {
        if (serialReader) {
          try { serialReader.releaseLock(); } catch (_) {}
          serialReader = null;
        }
      }
    }
  }

  /**
   * Connects to a wireless ESP32 / BLE arcade controller via Web Bluetooth API.
   */
  async function connectBluetooth() {
    var caps = getCapabilities();
    if (!caps.bluetooth) {
      appendLog('[WARN] Web Bluetooth API not supported in this browser.');
      return { ok: false, error: 'UNSUPPORTED_BROWSER', message: caps.message };
    }

    if (connectionState === 'connected') {
      await disconnect();
    }

    connectionState = 'connecting';
    updateTelemetryUI();

    try {
      bleDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_UART_SERVICE, BLE_CUSTOM_SERVICE]
      });

      bleDevice.addEventListener('gattserverdisconnected', function () {
        appendLog('[INFO] BLE controller disconnected.');
        connectionState = 'disconnected';
        connectionType = null;
        deviceLabel = 'None';
        clearAllKeys();
        updateConnectionUI();
      });

      var server = await bleDevice.gatt.connect();
      var services = await server.getPrimaryServices();
      var notifyChar = null;

      for (var s = 0; s < services.length && !notifyChar; s++) {
        var chars = await services[s].getCharacteristics();
        for (var c = 0; c < chars.length; c++) {
          if (chars[c].properties && (chars[c].properties.notify || chars[c].properties.indicate)) {
            notifyChar = chars[c];
            break;
          }
        }
      }

      if (!notifyChar) {
        throw new Error('No notify GATT characteristic found on device.');
      }

      bleCharacteristic = notifyChar;
      bleCharacteristic.addEventListener('characteristicvaluechanged', function (e) {
        var dv = e.target.value;
        if (!dv) return;
        var bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
        var parsed = parseSerialPacket(bytes, protocolMode);
        if (parsed) applyHardwareState(parsed);
      });
      await bleCharacteristic.startNotifications();

      deviceLabel = 'BLE (' + (bleDevice.name || 'ESP32 Controller') + ')';
      connectionType = 'bluetooth';
      connectionState = 'connected';
      appendLog('[INFO] Connected to ' + deviceLabel);
      updateConnectionUI();

      return { ok: true, device: deviceLabel };
    } catch (err) {
      connectionState = 'disconnected';
      connectionType = null;
      bleDevice = null;
      appendLog('[ERROR] BLE connection failed: ' + (err && err.message ? err.message : err));
      updateConnectionUI();
      return { ok: false, error: 'BLE_ERROR', message: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Disconnects any active Serial or Bluetooth hardware controller.
   */
  async function disconnect() {
    serialReadKeepGoing = false;
    if (serialReader) {
      try { await serialReader.cancel(); } catch (_) {}
      serialReader = null;
    }
    if (serialPort) {
      try { await serialPort.close(); } catch (_) {}
      serialPort = null;
    }
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
      try { bleDevice.gatt.disconnect(); } catch (_) {}
    }
    bleDevice = null;
    bleCharacteristic = null;
    connectionState = 'disconnected';
    connectionType = null;
    deviceLabel = 'None';
    clearAllKeys();
    appendLog('[INFO] Hardware controller disconnected.');
    updateConnectionUI();
  }

  function setBaudRate(rate) {
    var num = Number(rate);
    if (SUPPORTED_BAUD_RATES.indexOf(num) !== -1) {
      baudRate = num;
    }
    return baudRate;
  }

  function setProtocolMode(mode) {
    if (mode === 'auto' || mode === 'json' || mode === 'bitmask') {
      protocolMode = mode;
    }
    return protocolMode;
  }

  function appendLog(line) {
    if (monitorPaused) return;
    logBuffer.push(line);
    if (logBuffer.length > MAX_LOG_LINES) {
      logBuffer.shift();
    }
    if (typeof document !== 'undefined') {
      var logEl = document.getElementById('hw-packet-log');
      if (logEl) {
        logEl.textContent = logBuffer.join('\n');
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  }

  function updateVisualizer(btns) {
    if (typeof document === 'undefined') return;
    var keys = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'start', 'select'];
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById('hw-vis-' + keys[i]);
      if (el) {
        el.classList.toggle('is-active', Boolean(btns && btns[keys[i]]));
      }
    }
  }

  function updateTelemetryUI() {
    if (typeof document === 'undefined') return;
    var stateEl = document.getElementById('hw-stat-state');
    var devEl = document.getElementById('hw-stat-device');
    var latEl = document.getElementById('hw-stat-latency');
    var pktEl = document.getElementById('hw-stat-packets');

    if (stateEl) {
      stateEl.textContent = connectionState.toUpperCase();
      stateEl.classList.toggle('is-connected', connectionState === 'connected');
    }
    if (devEl) devEl.textContent = deviceLabel;
    if (latEl) latEl.textContent = lastLatencyMs ? lastLatencyMs.toFixed(2) + ' ms' : '-- ms';
    if (pktEl) pktEl.textContent = String(packetCount);
  }

  function updateConnectionUI() {
    updateTelemetryUI();
    if (typeof document === 'undefined') return;
    var navBtn = document.getElementById('hardware-bridge-trigger-btn');
    if (navBtn) {
      navBtn.classList.toggle('is-connected', connectionState === 'connected');
    }
    var discBtn = document.getElementById('hw-btn-disconnect');
    if (discBtn) {
      discBtn.disabled = connectionState !== 'connected';
    }
  }

  function simulateDemoPacket() {
    var samples = [
      '{"btnA":1,"joyX":-128,"joyY":0}',
      '{"btnB":1,"joyX":127,"joyY":0}',
      '{"btnX":1,"joyX":0,"joyY":-128}',
      '0x15',
      '{"btnA":0,"btnB":0,"btnX":0,"joyX":0,"joyY":0}'
    ];
    var idx = packetCount % samples.length;
    var parsed = parseSerialPacket(samples[idx], 'auto');
    if (parsed) {
      applyHardwareState(parsed);
    }
    return parsed;
  }

  function injectModalAndBindings() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('hardware-bridge-modal')) return;

    var caps = getCapabilities();

    var modalHtml = '' +
      '<div class="hw-modal-overlay" id="hardware-bridge-modal" role="dialog" aria-modal="true" aria-labelledby="hw-modal-title" aria-hidden="true">' +
      '  <div class="hw-modal-card">' +
      '    <div class="hw-modal-header">' +
      '      <div class="hw-modal-title-wrap">' +
      '        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '          <rect x="4" y="4" width="16" height="16" rx="2"></rect>' +
      '          <rect x="9" y="9" width="6" height="6"></rect>' +
      '          <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"></path>' +
      '        </svg>' +
      '        <div>' +
      '          <h3 class="hw-modal-title" id="hw-modal-title">DIY Arcade Hardware Controller Bridge</h3>' +
      '          <p class="hw-modal-subtitle">Web Serial &amp; Web Bluetooth input gateway for Arduino, ESP32, and Raspberry Pi Pico</p>' +
      '        </div>' +
      '      </div>' +
      '      <button type="button" class="hw-modal-close" id="hw-modal-close-btn" aria-label="Close Hardware Bridge Modal">' +
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '      </button>' +
      '    </div>' +
      '    <div class="hw-modal-body">' +
      '      <div class="hw-compat-banner ' + (caps.supported ? 'is-supported' : '') + '" id="hw-compat-banner">' +
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
      '        <span>' + caps.message + '</span>' +
      '      </div>' +
      '      <div class="hw-controls-grid">' +
      '        <div class="hw-field-group">' +
      '          <label class="hw-field-label" for="hw-baud-select">Serial Baud Rate</label>' +
      '          <select class="hw-select" id="hw-baud-select">' +
      '            <option value="9600">9600 bps</option>' +
      '            <option value="19200">19200 bps</option>' +
      '            <option value="38400">38400 bps</option>' +
      '            <option value="57600">57600 bps</option>' +
      '            <option value="115200" selected>115200 bps (Standard)</option>' +
      '            <option value="230400">230400 bps</option>' +
      '            <option value="921600">921600 bps</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="hw-field-group">' +
      '          <label class="hw-field-label" for="hw-protocol-select">Line Protocol</label>' +
      '          <select class="hw-select" id="hw-protocol-select">' +
      '            <option value="auto" selected>Auto-Detect (JSON / Bitmask)</option>' +
      '            <option value="json">JSON Line ({"btnA":1})</option>' +
      '            <option value="bitmask">Raw Byte Bitmask (0x00..0xFF)</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="hw-btn-row">' +
      '          <button type="button" class="hw-btn hw-btn-serial" id="hw-btn-connect-serial"' + (caps.serial ? '' : ' disabled') + '>Connect USB Serial</button>' +
      '          <button type="button" class="hw-btn hw-btn-ble" id="hw-btn-connect-ble"' + (caps.bluetooth ? '' : ' disabled') + '>Connect BLE</button>' +
      '          <button type="button" class="hw-btn hw-btn-danger" id="hw-btn-disconnect" disabled>Disconnect</button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="hw-telemetry-strip">' +
      '        <div class="hw-stat-item"><span class="hw-stat-label">Status</span><span class="hw-stat-value" id="hw-stat-state">DISCONNECTED</span></div>' +
      '        <div class="hw-stat-item"><span class="hw-stat-label">Active Port / Device</span><span class="hw-stat-value" id="hw-stat-device">None</span></div>' +
      '        <div class="hw-stat-item"><span class="hw-stat-label">Bridge Latency</span><span class="hw-stat-value" id="hw-stat-latency">-- ms</span></div>' +
      '        <div class="hw-stat-item"><span class="hw-stat-label">Packets Processed</span><span class="hw-stat-value" id="hw-stat-packets">0</span></div>' +
      '      </div>' +
      '      <div class="hw-workspace-grid">' +
      '        <div class="hw-pad-visualizer">' +
      '          <span class="hw-pad-title">Live Input Visualizer</span>' +
      '          <div class="hw-dpad-cross">' +
      '            <div></div><div class="hw-pad-key" id="hw-vis-up">U</div><div></div>' +
      '            <div class="hw-pad-key" id="hw-vis-left">L</div><div class="hw-dpad-center"></div><div class="hw-pad-key" id="hw-vis-right">R</div>' +
      '            <div></div><div class="hw-pad-key" id="hw-vis-down">D</div><div></div>' +
      '          </div>' +
      '          <div class="hw-action-cluster">' +
      '            <div class="hw-pad-btn" id="hw-vis-a">A</div>' +
      '            <div class="hw-pad-btn" id="hw-vis-b">B</div>' +
      '            <div class="hw-pad-btn" id="hw-vis-x">X</div>' +
      '            <div class="hw-pad-btn" id="hw-vis-y">Y</div>' +
      '          </div>' +
      '          <div class="hw-meta-cluster">' +
      '            <div class="hw-pad-pill" id="hw-vis-select">SELECT</div>' +
      '            <div class="hw-pad-pill" id="hw-vis-start">START</div>' +
      '          </div>' +
      '        </div>' +
      '        <div class="hw-monitor-panel">' +
      '          <div class="hw-monitor-toolbar">' +
      '            <span>Incoming Packet Monitor</span>' +
      '            <div class="hw-monitor-actions">' +
      '              <button type="button" class="hw-mini-btn" id="hw-btn-simulate">Simulate Packet</button>' +
      '              <button type="button" class="hw-mini-btn" id="hw-btn-pause-log">Pause</button>' +
      '              <button type="button" class="hw-mini-btn" id="hw-btn-clear-log">Clear</button>' +
      '            </div>' +
      '          </div>' +
      '          <pre class="hw-packet-log" id="hw-packet-log">[READY] Waiting for hardware stream or simulated packet...</pre>' +
      '        </div>' +
      '      </div>' +
      '      <details class="hw-firmware-details">' +
      '        <summary>Arduino / ESP32 / Pico Firmware Protocol Reference (115200 baud)</summary>' +
      '        <pre class="hw-firmware-code">// Example Arduino / ESP32 Serial Output (115200 baud)\nvoid setup() { Serial.begin(115200); }\nvoid loop() {\n  int btnA = !digitalRead(2);\n  int joyX = map(analogRead(A0), 0, 1023, -128, 127);\n  Serial.printf("{\\"btnA\\":%d,\\"joyX\\":%d}\\n", btnA, joyX);\n  delay(8);\n}</pre>' +
      '      </details>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml;
    document.body.appendChild(wrapper.firstElementChild);

    var overlay = document.getElementById('hardware-bridge-modal');
    var closeBtn = document.getElementById('hw-modal-close-btn');
    var baudSel = document.getElementById('hw-baud-select');
    var protoSel = document.getElementById('hw-protocol-select');
    var serialBtn = document.getElementById('hw-btn-connect-serial');
    var bleBtn = document.getElementById('hw-btn-connect-ble');
    var discBtn = document.getElementById('hw-btn-disconnect');
    var simBtn = document.getElementById('hw-btn-simulate');
    var pauseBtn = document.getElementById('hw-btn-pause-log');
    var clearBtn = document.getElementById('hw-btn-clear-log');
    var triggerBtn = document.getElementById('hardware-bridge-trigger-btn');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', openModal);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }
    if (baudSel) {
      baudSel.addEventListener('change', function () {
        setBaudRate(baudSel.value);
        appendLog('[INFO] Baud rate set to ' + baudRate + ' bps');
      });
    }
    if (protoSel) {
      protoSel.addEventListener('change', function () {
        setProtocolMode(protoSel.value);
        appendLog('[INFO] Protocol switched to ' + protocolMode);
      });
    }
    if (serialBtn) {
      serialBtn.addEventListener('click', function () {
        connectSerial({ baudRate: baudRate });
      });
    }
    if (bleBtn) {
      bleBtn.addEventListener('click', function () {
        connectBluetooth();
      });
    }
    if (discBtn) {
      discBtn.addEventListener('click', function () {
        disconnect();
      });
    }
    if (simBtn) {
      simBtn.addEventListener('click', function () {
        simulateDemoPacket();
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        monitorPaused = !monitorPaused;
        pauseBtn.textContent = monitorPaused ? 'Resume' : 'Pause';
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        logBuffer = [];
        var logEl = document.getElementById('hw-packet-log');
        if (logEl) logEl.textContent = '';
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  function openModal() {
    if (typeof document === 'undefined') return;
    injectModalAndBindings();
    var overlay = document.getElementById('hardware-bridge-modal');
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      var closeBtn = document.getElementById('hw-modal-close-btn');
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeModal() {
    if (typeof document === 'undefined') return;
    var overlay = document.getElementById('hardware-bridge-modal');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      var triggerBtn = document.getElementById('hardware-bridge-trigger-btn');
      if (triggerBtn) triggerBtn.focus();
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectModalAndBindings);
    } else {
      injectModalAndBindings();
    }
  }

  return {
    SUPPORTED_BAUD_RATES: SUPPORTED_BAUD_RATES,
    DEFAULT_BAUD_RATE: DEFAULT_BAUD_RATE,
    KEY_MAPPINGS: KEY_MAPPINGS,
    BITMASK_ORDER: BITMASK_ORDER,
    getCapabilities: getCapabilities,
    normalizeAxis: normalizeAxis,
    parseBitmaskByte: parseBitmaskByte,
    parseSerialPacket: parseSerialPacket,
    applyHardwareState: applyHardwareState,
    clearAllKeys: clearAllKeys,
    connectSerial: connectSerial,
    connectBluetooth: connectBluetooth,
    disconnect: disconnect,
    setBaudRate: setBaudRate,
    setProtocolMode: setProtocolMode,
    simulateDemoPacket: simulateDemoPacket,
    openModal: openModal,
    closeModal: closeModal,
    getVirtualGamepad: function () { return virtualGamepad; },
    getStatus: function () {
      return {
        state: connectionState,
        type: connectionType,
        device: deviceLabel,
        baudRate: baudRate,
        protocol: protocolMode,
        packetCount: packetCount,
        lastLatencyMs: lastLatencyMs
      };
    }
  };
});
