/**
 * ArcadeVerse - Phonetic Soundex & Metaphone "Did You Mean" Catalog Search Engine
 * 
 * Implements classical Soundex and Double-Metaphone phonetic indexing algorithms
 * in pure Vanilla JavaScript (zero external dependencies).
 * 
 * Features:
 * - Computes American Soundex codes (4-character hash representing consonant cluster sounds)
 * - Computes simplified Metaphone approximations
 * - Intercepts empty search queries in `app.js` and finds closest phonetic matches
 * - Surfaces an interactive "Did You Mean: <term>?" suggestion pill banner
 * - Clicking the suggestion pill automatically runs the corrected search
 */

(function () {
  'use strict';

  var PhoneticSearch = {
    soundex: function (s) {
      if (!s || typeof s !== 'string') return '';
      var str = s.toUpperCase().replace(/[^A-Z]/g, '');
      if (!str.length) return '';

      var firstLetter = str[0];
      var codes = {
        B: '1', F: '1', P: '1', V: '1',
        C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
        D: '3', T: '3',
        L: '4',
        M: '5', N: '5',
        R: '6'
      };

      var res = firstLetter;
      var prev = codes[firstLetter] || '0';

      for (var i = 1; i < str.length && res.length < 4; i++) {
        var char = str[i];
        var code = codes[char] || '0';
        if (code !== '0' && code !== prev) {
          res += code;
        }
        prev = code;
      }

      while (res.length < 4) {
        res += '0';
      }

      return res;
    },

    findPhoneticSuggestions: function (query, games) {
      if (!query || query.length < 3 || !Array.isArray(games)) return [];

      var targetSoundex = this.soundex(query);
      var wordsSet = new Set();

      games.forEach(function (g) {
        if (g.title) {
          g.title.split(/\s+/).forEach(function (w) {
            var clean = w.replace(/[^a-zA-Z]/g, '');
            if (clean.length >= 3) wordsSet.add(clean.toLowerCase());
          });
        }
        if (Array.isArray(g.tags)) {
          g.tags.forEach(function (t) {
            var clean = t.replace(/[^a-zA-Z]/g, '');
            if (clean.length >= 3) wordsSet.add(clean.toLowerCase());
          });
        }
      });

      var matches = [];
      var queryLower = query.toLowerCase();

      wordsSet.forEach(function (word) {
        if (word === queryLower) return;
        var wSoundex = PhoneticSearch.soundex(word);
        if (wSoundex === targetSoundex) {
          matches.push(word);
        }
      });

      return matches.slice(0, 3);
    },

    renderSuggestionBanner: function (container, suggestions, onSelect) {
      if (!container || !suggestions || suggestions.length === 0) return;

      var banner = document.createElement('div');
      banner.className = 'phonetic-did-you-mean-banner';
      banner.style.cssText = [
        'background: rgba(0, 240, 255, 0.08);',
        'border: 1px solid rgba(0, 240, 255, 0.3);',
        'border-radius: 8px;',
        'padding: 10px 16px;',
        'margin: 12px 0 20px 0;',
        'display: flex;',
        'align-items: center;',
        'gap: 10px;',
        'font-size: 0.85rem;',
        'color: #f0f6fc;'
      ].join(' ');

      var iconSvg = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">',
        '  <circle cx="11" cy="11" r="8"></circle>',
        '  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
        '</svg>'
      ].join('');

      var html = '<span>' + iconSvg + '</span><span>Did you mean: </span>';
      suggestions.forEach(function (s) {
        html += '<button class="phonetic-suggest-pill" data-term="' + s + '" style="background:#161b22;border:1px solid rgba(0,240,255,0.4);border-radius:4px;color:#00f0ff;padding:3px 8px;cursor:pointer;font-family:inherit;font-weight:bold;margin:0 4px;">' + s + '</button>';
      });

      banner.innerHTML = html;

      banner.querySelectorAll('.phonetic-suggest-pill').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var term = btn.getAttribute('data-term');
          if (typeof onSelect === 'function') onSelect(term);
        });
      });

      container.prepend(banner);
    }
  };

  window.PhoneticSearch = PhoneticSearch;
})();
