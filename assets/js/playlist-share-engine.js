/**
 * ArcadeVerse - Curated Game Playlist Export via Base64 URL & Dynamic QR Code Sharing
 * Architectural Implementation for Issue #1098
 *
 * Features:
 * - Compact URL-safe Base64 hash serialization (#playlist=...) for playlist title + game IDs.
 * - Boot-time hash detection, GAMES_REGISTRY validation, and non-destructive Importer prompt.
 * - Pure Vanilla JS QR Code matrix generator (Byte mode, ECC Level L, GF(256) Reed-Solomon)
 *   rendering crisp in-memory SVG QR codes and downloadable PNG QR cards.
 * - Zero external dependencies or backend storage.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadePlaylistShare = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HASH_PREFIX = '#playlist=';
  var MAX_HASH_LENGTH = 32768;

  // =========================================================================
  // 1. URL-Safe Base64 Playlist Serialization & Registry Validation
  // =========================================================================

  function toUrlSafeBase64(uint8Arr) {
    var bin = '';
    for (var i = 0; i < uint8Arr.length; i++) {
      bin += String.fromCharCode(uint8Arr[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromUrlSafeBase64(b64) {
    var padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4 !== 0) {
      padded += '=';
    }
    var bin = atob(padded);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Encodes a playlist object ({ name/title, games }) into a URL-safe Base64 token.
   *
   * @param {Object} playlist - Playlist object
   * @returns {string} URL-safe Base64 string
   */
  function encodePlaylistToken(playlist) {
    if (!playlist || typeof playlist !== 'object') {
      throw new Error('Invalid playlist object.');
    }
    var title = String(playlist.title || playlist.name || '').trim();
    if (!title || title.length > 100) {
      throw new Error('Playlist title must be 1 to 100 characters.');
    }
    if (!Array.isArray(playlist.games)) {
      throw new Error('Playlist games must be an array.');
    }
    var uniqueGames = [];
    var seen = new Set();
    for (var i = 0; i < playlist.games.length; i++) {
      var id = playlist.games[i];
      if (typeof id === 'string' && id.trim() && !seen.has(id)) {
        seen.add(id);
        uniqueGames.push(id);
      }
    }

    var payload = JSON.stringify({ title: title, games: uniqueGames });
    var bytes = new TextEncoder().encode(payload);
    var token = toUrlSafeBase64(bytes);
    if (token.length > MAX_HASH_LENGTH) {
      throw new Error('Playlist is too large to serialize into a URL.');
    }
    return token;
  }

  /**
   * Builds a full shareable URL with #playlist=<token>.
   *
   * @param {Object} playlist - Playlist object
   * @param {string} [baseUrl] - Optional base URL override
   * @returns {string} Full shareable URL
   */
  function buildShareUrl(playlist, baseUrl) {
    var token = encodePlaylistToken(playlist);
    var base = baseUrl;
    if (!base) {
      if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
        base = window.location.origin + window.location.pathname;
      } else {
        base = 'https://debasmitabose0.github.io/ArcadeVerse/';
      }
    }
    base = base.split('#')[0];
    return base + HASH_PREFIX + token;
  }

  /**
   * Decodes a #playlist=<token> hash or full URL back into { title, games }.
   *
   * @param {string} hashOrUrl - URL hash or full URL
   * @returns {{ title: string, games: Array<string> }|null}
   */
  function decodePlaylistFromHash(hashOrUrl) {
    if (typeof hashOrUrl !== 'string') return null;
    var idx = hashOrUrl.indexOf(HASH_PREFIX);
    if (idx === -1) return null;

    var token = hashOrUrl.slice(idx + HASH_PREFIX.length).trim();
    if (!token || token.length > MAX_HASH_LENGTH || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(token)) {
      throw new Error('Malformed playlist share link.');
    }

    var parsed;
    try {
      var bytes = fromUrlSafeBase64(token);
      var jsonStr = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      throw new Error('Corrupted or invalid Base64 playlist data.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid playlist payload structure.');
    }

    var title = String(parsed.title || parsed.name || '').trim();
    if (!title || title.length > 100 || !Array.isArray(parsed.games) || parsed.games.length > 1000) {
      throw new Error('Invalid playlist title or games list.');
    }

    var uniqueGames = [];
    var seen = new Set();
    for (var i = 0; i < parsed.games.length; i++) {
      var g = parsed.games[i];
      if (typeof g === 'string' && !seen.has(g)) {
        seen.add(g);
        uniqueGames.push(g);
      }
    }

    return {
      title: title,
      games: uniqueGames
    };
  }

  /**
   * Validates decoded playlist game IDs against GAMES_REGISTRY.
   *
   * @param {{ title: string, games: Array<string> }} decoded
   * @param {Array<Object>} [registry]
   * @returns {{ title: string, validGames: Array<string>, matchedEntries: Array<Object>, missingGames: Array<string> }}
   */
  function validateAgainstRegistry(decoded, registry) {
    var catalog = registry || (typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : []);
    var mapById = new Map();
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i] && catalog[i].id) {
        mapById.set(catalog[i].id, catalog[i]);
      }
    }

    var validGames = [];
    var matchedEntries = [];
    var missingGames = [];

    for (var j = 0; j < decoded.games.length; j++) {
      var id = decoded.games[j];
      if (mapById.has(id)) {
        validGames.push(id);
        matchedEntries.push(mapById.get(id));
      } else {
        missingGames.push(id);
      }
    }

    return {
      title: decoded.title,
      validGames: validGames,
      matchedEntries: matchedEntries,
      missingGames: missingGames
    };
  }

  // =========================================================================
  // 2. Pure Vanilla JS QR Code Encoder (Byte Mode, ECC Level L, Version 1-14)
  // =========================================================================

  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);
  (function initGaloisField() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) {
      GF_EXP[j] = GF_EXP[j - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(ecLen) {
    var poly = [1];
    for (var i = 0; i < ecLen; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(dataBytes, ecLen) {
    var gen = rsGeneratorPoly(ecLen);
    var res = new Array(dataBytes.length + ecLen).fill(0);
    for (var i = 0; i < dataBytes.length; i++) res[i] = dataBytes[i];
    for (var j = 0; j < dataBytes.length; j++) {
      var coef = res[j];
      if (coef !== 0) {
        for (var k = 0; k < gen.length; k++) {
          res[j + k] ^= gfMul(gen[k], coef);
        }
      }
    }
    return res.slice(dataBytes.length);
  }

  // Version table for ECC Level L: [version, totalDataBytes, ecBytesPerBlock, numBlocksGroup1, dataPerBlockG1, numBlocksG2, dataPerBlockG2, alignmentCoords]
  var QR_VERSIONS_L = [
    null,
    [1, 19, 7, 1, 19, 0, 0, []],
    [2, 34, 10, 1, 34, 0, 0, [6, 18]],
    [3, 55, 15, 1, 55, 0, 0, [6, 22]],
    [4, 80, 20, 1, 80, 0, 0, [6, 26]],
    [5, 108, 26, 1, 108, 0, 0, [6, 30]],
    [6, 136, 18, 2, 68, 0, 0, [6, 34]],
    [7, 156, 20, 2, 78, 0, 0, [6, 22, 38]],
    [8, 194, 24, 2, 97, 0, 0, [6, 24, 42]],
    [9, 232, 30, 2, 116, 0, 0, [6, 26, 46]],
    [10, 274, 18, 2, 68, 2, 69, [6, 28, 50]],
    [11, 324, 20, 4, 81, 0, 0, [6, 30, 54]],
    [12, 370, 24, 2, 92, 2, 93, [6, 32, 58]],
    [13, 428, 26, 4, 107, 0, 0, [6, 34, 62]],
    [14, 461, 30, 3, 115, 1, 116, [6, 26, 46, 66]]
  ];

  // Precomputed 15-bit format info for ECC Level L (01) and Mask 0..7 with BCH(15,5) + 0x5412 mask
  var FORMAT_INFO_L = [
    0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976
  ];

  function selectQrVersion(byteLen) {
    for (var v = 1; v < QR_VERSIONS_L.length; v++) {
      var cap = QR_VERSIONS_L[v][1];
      var headerBytes = v <= 9 ? 2 : 3; // 4-bit mode + 8/16-bit len + 4-bit terminator
      if (byteLen + headerBytes <= cap) {
        return QR_VERSIONS_L[v];
      }
    }
    throw new Error('Playlist URL exceeds maximum QR code capacity.');
  }

  /**
   * Generates a 2D boolean QR code matrix (true = dark module, false = light module).
   *
   * @param {string} text - Text/URL to encode
   * @returns {Array<Array<boolean>>} Square QR matrix
   */
  function encodeQrMatrix(text) {
    var utf8 = new TextEncoder().encode(String(text || ''));
    var spec = selectQrVersion(utf8.length);
    var version = spec[0];
    var totalDataBytes = spec[1];
    var ecPerBlock = spec[2];
    var g1Blocks = spec[3];
    var g1Data = spec[4];
    var g2Blocks = spec[5];
    var g2Data = spec[6];
    var alignCoords = spec[7];

    // 1. Build bit stream (Mode 0100 = Byte)
    var bits = [];
    function pushBits(val, len) {
      for (var i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }
    pushBits(4, 4);
    pushBits(utf8.length, version <= 9 ? 8 : 16);
    for (var b = 0; b < utf8.length; b++) {
      pushBits(utf8[b], 8);
    }
    // Terminator
    var maxBits = totalDataBytes * 8;
    for (var t = 0; t < 4 && bits.length < maxBits; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    var dataCodewords = [];
    for (var k = 0; k < bits.length; k += 8) {
      var byteVal = 0;
      for (var bit = 0; bit < 8; bit++) {
        byteVal = (byteVal << 1) | bits[k + bit];
      }
      dataCodewords.push(byteVal);
    }
    var padIdx = 0;
    while (dataCodewords.length < totalDataBytes) {
      dataCodewords.push(padIdx % 2 === 0 ? 0xec : 0x11);
      padIdx++;
    }

    // 2. Split blocks & compute Reed-Solomon ECC
    var dataBlocks = [];
    var ecBlocks = [];
    var offset = 0;
    for (var b1 = 0; b1 < g1Blocks; b1++) {
      var blk1 = dataCodewords.slice(offset, offset + g1Data);
      offset += g1Data;
      dataBlocks.push(blk1);
      ecBlocks.push(rsEncode(blk1, ecPerBlock));
    }
    for (var b2 = 0; b2 < g2Blocks; b2++) {
      var blk2 = dataCodewords.slice(offset, offset + g2Data);
      offset += g2Data;
      dataBlocks.push(blk2);
      ecBlocks.push(rsEncode(blk2, ecPerBlock));
    }

    // Interleave data & ECC codewords
    var interleaved = [];
    var maxDataLen = Math.max(g1Data, g2Data);
    for (var col = 0; col < maxDataLen; col++) {
      for (var row = 0; row < dataBlocks.length; row++) {
        if (col < dataBlocks[row].length) interleaved.push(dataBlocks[row][col]);
      }
    }
    for (var ecol = 0; ecol < ecPerBlock; ecol++) {
      for (var erow = 0; erow < ecBlocks.length; erow++) {
        interleaved.push(ecBlocks[erow][ecol]);
      }
    }

    // 3. Initialize matrix & place function patterns
    var size = version * 4 + 17;
    var modules = Array.from({ length: size }, function () { return new Array(size).fill(false); });
    var isFunction = Array.from({ length: size }, function () { return new Array(size).fill(false); });

    function setFunctionModule(r, c, dark) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        modules[r][c] = dark;
        isFunction[r][c] = true;
      }
    }

    function drawFinder(top, left) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = top + r;
          var cc = left + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var isBorder = r === -1 || r === 7 || c === -1 || c === 7;
          var isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          var isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setFunctionModule(rr, cc, !isBorder && (isOuter || isInner));
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (var p = 8; p < size - 8; p++) {
      setFunctionModule(6, p, p % 2 === 0);
      setFunctionModule(p, 6, p % 2 === 0);
    }

    // Alignment patterns
    for (var ai = 0; ai < alignCoords.length; ai++) {
      for (var aj = 0; aj < alignCoords.length; aj++) {
        var ar = alignCoords[ai];
        var ac = alignCoords[aj];
        if (isFunction[ar][ac]) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setFunctionModule(ar + dr, ac + dc, dark);
          }
        }
      }
    }

    // Dark module & reserve format info areas
    setFunctionModule(size - 8, 8, true);
    for (var f = 0; f < 9; f++) {
      if (f !== 6) {
        isFunction[8][f] = true;
        isFunction[f][8] = true;
      }
    }
    for (var f2 = 0; f2 < 8; f2++) {
      isFunction[8][size - 1 - f2] = true;
      isFunction[size - 1 - f2][8] = true;
    }
    if (version >= 7) {
      for (var vr = 0; vr < 6; vr++) {
        for (var vc = 0; vc < 3; vc++) {
          isFunction[vr][size - 11 + vc] = true;
          isFunction[size - 11 + vc][vr] = true;
        }
      }
    }

    // 4. Place data bits in zig-zag order
    var bitIdx = 0;
    var totalBits = interleaved.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var side = 0; side < 2; side++) {
          var cc = right - side;
          var upward = ((right + 1) & 2) === 0;
          var rr = upward ? size - 1 - vert : vert;
          if (!isFunction[rr][cc]) {
            var bit = false;
            if (bitIdx < totalBits) {
              bit = ((interleaved[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
              bitIdx++;
            }
            modules[rr][cc] = bit;
          }
        }
      }
    }

    // 5. Apply Mask 0 ((r + c) % 2 === 0) and write Format Info
    var maskPattern = 0;
    for (var mr = 0; mr < size; mr++) {
      for (var mc = 0; mc < size; mc++) {
        if (!isFunction[mr][mc] && ((mr + mc) % 2 === 0)) {
          modules[mr][mc] = !modules[mr][mc];
        }
      }
    }

    var fmt = FORMAT_INFO_L[maskPattern];
    for (var fi = 0; fi < 15; fi++) {
      var bitVal = ((fmt >> fi) & 1) === 1;
      if (fi < 6) modules[fi][8] = bitVal;
      else if (fi < 8) modules[fi + 1][8] = bitVal;
      else modules[size - 15 + fi][8] = bitVal;

      if (fi < 8) modules[8][size - 1 - fi] = bitVal;
      else if (fi < 9) modules[8][15 - fi] = bitVal;
      else modules[8][14 - fi] = bitVal;
    }

    return modules;
  }

  /**
   * Generates a crisp vector SVG string for a QR code.
   *
   * @param {string} text - Content to encode
   * @param {Object} [options] - { quietZone, darkColor, lightColor }
   * @returns {string} SVG markup
   */
  function generateQrSvg(text, options) {
    var matrix = encodeQrMatrix(text);
    var quiet = (options && options.quietZone) !== undefined ? options.quietZone : 4;
    var dark = (options && options.darkColor) || '#0f172a';
    var light = (options && options.lightColor) || '#ffffff';
    var dim = matrix.length + quiet * 2;

    var paths = [];
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          paths.push('M' + (c + quiet) + ',' + (r + quiet) + 'h1v1h-1z');
        }
      }
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="Playlist QR Code">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path d="' + paths.join('') + '" fill="' + dark + '"/>' +
      '</svg>';
  }

  // =========================================================================
  // 3. Share Modal & QR Card Download + Boot-time Importer Drawer
  // =========================================================================

  function downloadQrCard(playlist, shareUrl) {
    if (typeof document === 'undefined') return false;
    var matrix = encodeQrMatrix(shareUrl);
    var canvas = document.createElement('canvas');
    var width = 420;
    var height = 520;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Card background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Header text
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARCADEVERSE CURATED PLAYLIST', width / 2, 46);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px sans-serif';
    var title = String(playlist.name || playlist.title || 'Playlist').slice(0, 28);
    ctx.fillText(title, width / 2, 82);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText((playlist.games ? playlist.games.length : 0) + ' Games Included', width / 2, 108);

    // QR Code white card
    var qrArea = 280;
    var qrX = (width - qrArea) / 2;
    var qrY = 134;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX, qrY, qrArea, qrArea);

    var quiet = 4;
    var cells = matrix.length + quiet * 2;
    var cellSize = qrArea / cells;
    ctx.fillStyle = '#0f172a';
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            qrX + (c + quiet) * cellSize,
            qrY + (r + quiet) * cellSize,
            Math.ceil(cellSize),
            Math.ceil(cellSize)
          );
        }
      }
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px sans-serif';
    ctx.fillText('Scan to import directly into ArcadeVerse', width / 2, 456);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('100% Client-Side Hash Serialization', width / 2, 482);

    var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'playlist';
    var link = document.createElement('a');
    link.download = 'arcadeverse-' + slug + '-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  }

  function ensureShareModal() {
    if (typeof document === 'undefined') return null;
    var existing = document.getElementById('playlist-share-modal');
    if (existing) return existing;

    var html = '' +
      '<div class="pl-share-modal-overlay" id="playlist-share-modal" role="dialog" aria-modal="true" aria-labelledby="pl-share-title" aria-hidden="true">' +
      '  <div class="pl-share-modal-card">' +
      '    <div class="pl-modal-header">' +
      '      <div class="pl-modal-title-wrap">' +
      '        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>' +
      '        <h3 class="pl-modal-title" id="pl-share-title">Share Playlist &amp; QR Code</h3>' +
      '      </div>' +
      '      <button type="button" class="pl-modal-close" id="pl-share-close-btn" aria-label="Close Share Modal">' +
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '      </button>' +
      '    </div>' +
      '    <div class="pl-modal-body">' +
      '      <div class="pl-share-meta">' +
      '        <span class="pl-share-name" id="pl-share-name"></span>' +
      '        <span class="pl-share-count" id="pl-share-count">0 games</span>' +
      '      </div>' +
      '      <div class="pl-qr-stage" id="pl-qr-stage"></div>' +
      '      <div class="pl-url-box">' +
      '        <input type="text" class="pl-url-input" id="pl-share-url-input" readonly aria-label="Shareable Playlist URL">' +
      '      </div>' +
      '      <div class="pl-share-actions">' +
      '        <button type="button" class="pl-btn pl-btn-primary" id="pl-btn-copy-url">Copy Shareable Link</button>' +
      '        <button type="button" class="pl-btn" id="pl-btn-download-qr">Download QR Card</button>' +
      '      </div>' +
      '      <div class="pl-status-msg" id="pl-share-status-msg" role="status" aria-live="polite"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    var modal = document.getElementById('playlist-share-modal');
    var closeBtn = document.getElementById('pl-share-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeShareModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeShareModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeShareModal();
      }
    });

    return modal;
  }

  function openShareModal(playlist) {
    if (!playlist || typeof document === 'undefined') return;
    var modal = ensureShareModal();
    var shareUrl = buildShareUrl(playlist);
    var qrSvg = generateQrSvg(shareUrl);

    document.getElementById('pl-share-name').textContent = playlist.name || playlist.title;
    document.getElementById('pl-share-count').textContent = (playlist.games ? playlist.games.length : 0) + ' games';
    document.getElementById('pl-qr-stage').innerHTML = qrSvg + '<span class="pl-qr-caption">Scan to Import Playlist</span>';
    document.getElementById('pl-share-url-input').value = shareUrl;
    document.getElementById('pl-share-status-msg').textContent = '';

    var copyBtn = document.getElementById('pl-btn-copy-url');
    copyBtn.onclick = async function () {
      var statusEl = document.getElementById('pl-share-status-msg');
      try {
        await navigator.clipboard.writeText(shareUrl);
        statusEl.textContent = 'Shareable URL copied to clipboard!';
      } catch (_) {
        var inp = document.getElementById('pl-share-url-input');
        inp.select();
        statusEl.textContent = 'Press Ctrl+C to copy the link above.';
      }
    };

    var dlBtn = document.getElementById('pl-btn-download-qr');
    dlBtn.onclick = function () {
      downloadQrCard(playlist, shareUrl);
      document.getElementById('pl-share-status-msg').textContent = 'QR Card PNG downloaded!';
    };

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeShareModal() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('playlist-share-modal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function clearUrlHash() {
    if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) {}
    }
  }

  function showImportPrompt(validated) {
    if (typeof document === 'undefined') return;
    var existing = document.getElementById('playlist-import-modal');
    if (existing) existing.remove();

    var html = '' +
      '<div class="pl-import-modal-overlay is-open" id="playlist-import-modal" role="dialog" aria-modal="true" aria-labelledby="pl-import-title" aria-hidden="false">' +
      '  <div class="pl-import-modal-card">' +
      '    <div class="pl-modal-header">' +
      '      <div class="pl-modal-title-wrap">' +
      '        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
      '        <h3 class="pl-modal-title" id="pl-import-title">Import Shared Playlist</h3>' +
      '      </div>' +
      '      <button type="button" class="pl-modal-close" id="pl-import-close-btn" aria-label="Dismiss Import">' +
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '      </button>' +
      '    </div>' +
      '    <div class="pl-modal-body">' +
      '      <p class="pl-import-prompt-text" id="pl-import-prompt-msg"></p>' +
      '      <div class="pl-import-games-list" id="pl-import-games-list"></div>' +
      '      <div class="pl-share-actions">' +
      '        <button type="button" class="pl-btn pl-btn-primary" id="pl-btn-confirm-import">Import Playlist</button>' +
      '        <button type="button" class="pl-btn" id="pl-btn-cancel-import">Cancel</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    var modal = document.getElementById('playlist-import-modal');
    var promptMsg = document.getElementById('pl-import-prompt-msg');
    promptMsg.textContent = 'Import "' + validated.title + '" Playlist? (' + validated.validGames.length + ' Games)';

    var listEl = document.getElementById('pl-import-games-list');
    validated.matchedEntries.forEach(function (g) {
      var chip = document.createElement('span');
      chip.className = 'pl-import-game-chip';
      chip.textContent = g.title || g.id;
      listEl.appendChild(chip);
    });

    function dismiss() {
      modal.remove();
      clearUrlHash();
    }

    document.getElementById('pl-import-close-btn').addEventListener('click', dismiss);
    document.getElementById('pl-btn-cancel-import').addEventListener('click', dismiss);

    document.getElementById('pl-btn-confirm-import').addEventListener('click', function () {
      if (window.ArcadePlaylists) {
        var existingPls = window.ArcadePlaylists.getPlaylists();
        var newPlaylist = {
          id: 'playlist-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
          name: validated.title,
          description: 'Imported via shared playlist link',
          icon: 'list-music',
          games: validated.validGames,
          createdAt: Date.now()
        };
        window.ArcadePlaylists.savePlaylists(existingPls.concat([newPlaylist]));
        window.ArcadePlaylists.updateDrawerList();
        window.ArcadePlaylists.openDrawer();
        window.ArcadePlaylists.showShareStatus('Imported "' + validated.title + '" (' + validated.validGames.length + ' games).');
      }
      dismiss();
    });
  }

  function checkBootHash() {
    if (typeof window === 'undefined' || !window.location || !window.location.hash) return null;
    if (window.location.hash.indexOf(HASH_PREFIX) !== 0) return null;

    try {
      var decoded = decodePlaylistFromHash(window.location.hash);
      if (!decoded) return null;
      var validated = validateAgainstRegistry(decoded);
      if (validated.validGames.length === 0) return null;
      showImportPrompt(validated);
      return validated;
    } catch (err) {
      console.warn('Playlist hash import ignored:', err.message);
      return null;
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', checkBootHash);
    window.addEventListener('hashchange', checkBootHash);
  }

  return {
    HASH_PREFIX: HASH_PREFIX,
    encodePlaylistToken: encodePlaylistToken,
    buildShareUrl: buildShareUrl,
    decodePlaylistFromHash: decodePlaylistFromHash,
    validateAgainstRegistry: validateAgainstRegistry,
    encodeQrMatrix: encodeQrMatrix,
    generateQrSvg: generateQrSvg,
    downloadQrCard: downloadQrCard,
    openShareModal: openShareModal,
    closeShareModal: closeShareModal,
    checkBootHash: checkBootHash
  };
});
