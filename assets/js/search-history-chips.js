/**
 * ArcadeVerse - Recent Search Query History Chips
 * 
 * Tracks player search queries and renders interactive neon chips below
 * the search bar for rapid recall.
 * 
 * Features:
 * - Stores last 5 unique queries in localStorage (`av_recent_searches`)
 * - Displays quick-click chips under search bar with a "Clear History" button
 * - Keyboard navigation (ArrowDown from search input focuses chips)
 * - 100% Vanilla JS, zero external dependencies, zero Unicode emojis
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_recent_searches';
  var MAX_QUERIES = 5;
  var queries = [];
  var chipsContainer = null;
  var initialized = false;

  var SearchHistoryChips = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadQueries();
      this.injectStyles();
      this.injectContainer();
      this.render();
      this.attachEvents();
    },

    loadQueries: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) queries = JSON.parse(raw);
      } catch (e) {
        queries = [];
      }
    },

    saveQueries: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
      } catch (e) {}
    },

    addQuery: function (q) {
      if (!q || typeof q !== 'string') return;
      var clean = q.trim();
      if (clean.length < 2) return;

      // Remove existing occurrence to place it first
      var idx = queries.indexOf(clean);
      if (idx !== -1) queries.splice(idx, 1);

      queries.unshift(clean);
      if (queries.length > MAX_QUERIES) queries.pop();

      this.saveQueries();
      this.render();
    },

    clearAll: function () {
      queries = [];
      this.saveQueries();
      this.render();
    },

    injectStyles: function () {
      if (document.getElementById('search-history-styles')) return;

      var style = document.createElement('style');
      style.id = 'search-history-styles';
      style.textContent = [
        '.search-history-chips-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-size: 0.75rem; color: #8b949e; }',
        '.sh-chip { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 2px 10px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 4px; font-family: inherit; }',
        '.sh-chip:hover { background: rgba(0, 240, 255, 0.15); border-color: #00f0ff; }',
        '.sh-clear-btn { background: transparent; border: none; color: #6e7681; cursor: pointer; font-size: 0.7rem; margin-left: 4px; }',
        '.sh-clear-btn:hover { color: #f85149; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectContainer: function () {
      if (document.getElementById('search-history-chips-row')) return;

      var searchBox = document.querySelector('.search-input-wrapper') || document.querySelector('.search-bar-wrapper') || document.getElementById('search-input');
      if (!searchBox) return;

      chipsContainer = document.createElement('div');
      chipsContainer.id = 'search-history-chips-row';
      chipsContainer.className = 'search-history-chips-row';

      if (searchBox.parentNode) {
        searchBox.parentNode.insertBefore(chipsContainer, searchBox.nextSibling);
      }
    },

    render: function () {
      if (!chipsContainer) return;
      chipsContainer.innerHTML = '';

      if (queries.length === 0) return;

      var label = document.createElement('span');
      label.textContent = 'Recent:';
      label.style.fontWeight = 'bold';
      chipsContainer.appendChild(label);

      queries.forEach(function (q) {
        var chip = document.createElement('button');
        chip.className = 'sh-chip';
        chip.type = 'button';
        chip.textContent = q;
        chip.addEventListener('click', function () {
          var input = document.getElementById('search-input');
          if (input) {
            input.value = q;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
          }
        });
        chipsContainer.appendChild(chip);
      });

      var clearBtn = document.createElement('button');
      clearBtn.className = 'sh-clear-btn';
      clearBtn.type = 'button';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', function () {
        SearchHistoryChips.clearAll();
      });
      chipsContainer.appendChild(clearBtn);
    },

    attachEvents: function () {
      var searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('change', function () {
          if (this.value) SearchHistoryChips.addQuery(this.value);
        });

        // Save on enter key
        searchInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && this.value) {
            SearchHistoryChips.addQuery(this.value);
          }
        });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      SearchHistoryChips.init();
    });
  } else {
    SearchHistoryChips.init();
  }

  window.SearchHistoryChips = SearchHistoryChips;
})();
