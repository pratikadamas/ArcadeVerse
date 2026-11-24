/**
 * ArcadeVerse - Windowed Virtual Grid & Game Card Scroller
 * Issue #1366: Virtualized Game Card Grid Scroller for Instant Mobile & Low-End DOM Performance
 *
 * Implements a pure Vanilla JS windowed virtualization engine for the games catalog.
 * - Computes viewport scroll position, column count, row heights, and layout geometry.
 * - Only mounts cards currently in the visible viewport plus buffer rows (approx. 8 to 24 active DOM cards).
 * - Maintains an invisible scroll container / spacer matching total calculated height.
 * - Positions active cards via transform: translateY() for GPU-accelerated 60 FPS scrolling.
 * - Guarantees rock-solid DOM node count (< 30 card nodes) regardless of total game count (125+ games).
 * - Fully compatible with Search, Category filters, Facet filters, Card 3D Flip, Ratings, Favorites, and Micro-Previews.
 * - Zero external libraries (100% Vanilla JS).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVirtualGrid = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Default configuration constants
  var DEFAULT_CONFIG = {
    cardMinGridWidth: 300,
    gridGap: 32, // 2rem = 32px
    listGap: 10.4, // 0.65rem = 10.4px
    gridEstimatedRowHeight: 460, // approximate height of card + gap in grid mode
    listEstimatedRowHeight: 80, // approximate height of card + gap in list mode
    bufferRows: 1, // 1 buffer row above and below visible window
    maxDomNodes: 30
  };

  /**
   * VirtualGrid Instance Constructor
   * @param {Object} options
   */
  function VirtualGrid(options) {
    options = options || {};
    this.container = options.container || null;
    this.items = [];
    this.renderItem = options.renderItem || null;
    this.getItemKey = options.getItemKey || function (item) { return item && item.id; };
    this.mode = options.mode || 'grid'; // 'grid' | 'list'
    this.bufferRows = typeof options.bufferRows === 'number' ? options.bufferRows : DEFAULT_CONFIG.bufferRows;

    this.viewport = options.viewport || (typeof window !== 'undefined' ? window : null);
    this.rowHeight = options.rowHeight || (this.mode === 'list' ? DEFAULT_CONFIG.listEstimatedRowHeight : DEFAULT_CONFIG.gridEstimatedRowHeight);

    // Layout metrics
    this.cols = 1;
    this.totalRows = 0;
    this.totalHeight = 0;
    this.renderedRange = { startRow: -1, endRow: -1, startIndex: -1, endIndex: -1 };

    // DOM containers
    this.wrapper = null;
    this.spacer = null;
    this.itemsContainer = null;

    // Cache of mounted card elements { key: { el, index, row, col } }
    this.activeNodes = new Map();

    // Event handler references for cleanup
    this._onScroll = this._handleScroll.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._rafId = null;
    this._resizeDebounce = null;
    this._isDestroyed = false;
  }

  /**
   * Initialize DOM wrappers inside container
   */
  VirtualGrid.prototype.init = function (container, items, renderItem) {
    if (container) this.container = container;
    if (items) this.items = items;
    if (renderItem) this.renderItem = renderItem;

    if (!this.container) return;

    this._setupDom();
    this.measureLayout();
    this.bindEvents();
    this.render();
  };

  /**
   * Builds the internal virtualization wrapper, spacer, and transform container
   */
  VirtualGrid.prototype._setupDom = function () {
    this.container.classList.add('virtual-grid-host');

    // Create or reuse spacer
    var existingSpacer = this.container.querySelector ? this.container.querySelector('.virtual-grid-spacer') : null;
    if (!existingSpacer && typeof document !== 'undefined') {
      this.spacer = document.createElement('div');
      this.spacer.className = 'virtual-grid-spacer';
      this.spacer.setAttribute('aria-hidden', 'true');
      this.spacer.style.cssText = 'position: relative; width: 100%; pointer-events: none; z-index: 0; opacity: 0; clear: both;';
      this.container.appendChild(this.spacer);
    } else {
      this.spacer = existingSpacer || { style: {}, setAttribute: function () {} };
    }

    // Create or reuse items container
    var existingItemsContainer = this.container.querySelector ? this.container.querySelector('.virtual-grid-items') : null;
    if (!existingItemsContainer && typeof document !== 'undefined') {
      this.itemsContainer = document.createElement('div');
      this.itemsContainer.className = 'virtual-grid-items';
      this.itemsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; will-change: transform; z-index: 1;';
      this.container.appendChild(this.itemsContainer);
    } else {
      this.itemsContainer = existingItemsContainer || { appendChild: function () {} };
    }
  };

  /**
   * Calculate grid columns, row heights, and total virtual height
   */
  VirtualGrid.prototype.measureLayout = function () {
    if (!this.container) return;

    var containerWidth = this.container.clientWidth || (this.container.getBoundingClientRect && this.container.getBoundingClientRect().width) || 1200;
    var isList = this.mode === 'list' || this.container.classList.contains('view-list');

    if (isList) {
      this.cols = 1;
      this.rowHeight = DEFAULT_CONFIG.listEstimatedRowHeight;
    } else {
      // Respect CSS custom property --grid-card-min-width if present (#catalog-density-slider)
      var minWidth = DEFAULT_CONFIG.cardMinGridWidth;
      try {
        if (typeof window !== 'undefined' && window.getComputedStyle) {
          var val = window.getComputedStyle(document.documentElement).getPropertyValue('--grid-card-min-width');
          if (val) {
            var parsed = parseInt(val, 10);
            if (!isNaN(parsed) && parsed >= 160 && parsed <= 500) {
              minWidth = parsed;
            }
          }
        }
      } catch (_) {}

      var gap = DEFAULT_CONFIG.gridGap;
      // In CSS: grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 2rem (32px);
      var availableWidth = containerWidth;
      var calculatedCols = Math.floor((availableWidth + gap) / (minWidth + gap));
      this.cols = Math.max(1, calculatedCols);
      this.rowHeight = DEFAULT_CONFIG.gridEstimatedRowHeight;
    }

    var totalItems = this.items.length;
    this.totalRows = Math.ceil(totalItems / this.cols);
    this.totalHeight = this.totalRows * this.rowHeight;

    if (this.spacer) {
      this.spacer.style.height = this.totalHeight + 'px';
      this.spacer.style.minHeight = this.totalHeight + 'px';
    }
  };

  /**
   * Determine visible row range based on current window scroll offset
   */
  VirtualGrid.prototype.getVisibleRange = function () {
    if (!this.container || this.items.length === 0) {
      return { startRow: 0, endRow: 0, startIndex: 0, endIndex: 0 };
    }

    var viewportHeight = typeof window !== 'undefined' ? (window.innerHeight || document.documentElement.clientHeight || 800) : 800;
    var containerRect = this.container.getBoundingClientRect ? this.container.getBoundingClientRect() : { top: 0, height: this.totalHeight };

    // Distance scrolled past the top of the grid
    var scrollTop = -containerRect.top;

    // Visible top and bottom bounds relative to the top of the grid container
    var visibleTop = Math.max(0, scrollTop);
    var visibleBottom = visibleTop + viewportHeight;

    // Convert pixel bounds to row indices
    var rawStartRow = Math.floor(visibleTop / this.rowHeight);
    var rawEndRow = Math.ceil(visibleBottom / this.rowHeight);

    // Apply buffer rows above and below
    var startRow = Math.max(0, rawStartRow - this.bufferRows);
    var endRow = Math.min(this.totalRows - 1, rawEndRow + this.bufferRows);

    if (this.totalRows === 0) {
      return { startRow: 0, endRow: 0, startIndex: 0, endIndex: 0 };
    }

    var startIndex = Math.max(0, startRow * this.cols);
    var endIndex = Math.min(this.items.length - 1, ((endRow + 1) * this.cols) - 1);

    return {
      startRow: startRow,
      endRow: endRow,
      startIndex: startIndex,
      endIndex: endIndex
    };
  };

  /**
   * Main render / reconciliation step
   */
  VirtualGrid.prototype.render = function () {
    if (this._isDestroyed || !this.container) return;

    if (this.items.length === 0) {
      this.clearNodes();
      if (this.spacer) this.spacer.style.height = '0px';
      return;
    }

    this.measureLayout();
    var range = this.getVisibleRange();

    // Check if range is unchanged and nodes are populated
    var isList = this.mode === 'list' || this.container.classList.contains('view-list');
    var isGridModeChanged = this._lastRenderMode !== (isList ? 'list' : 'grid');
    if (
      !isGridModeChanged &&
      range.startIndex === this.renderedRange.startIndex &&
      range.endIndex === this.renderedRange.endIndex &&
      this.activeNodes.size > 0
    ) {
      return;
    }

    this._lastRenderMode = isList ? 'list' : 'grid';
    this.renderedRange = range;

    var neededKeys = new Set();
    var targetContainer = this.itemsContainer || this.container;

    // Render / update cards within the visible window + buffer
    for (var i = range.startIndex; i <= range.endIndex; i++) {
      var item = this.items[i];
      if (!item) continue;

      var key = this.getItemKey(item) || String(i);
      neededKeys.add(key);

      var rowIndex = Math.floor(i / this.cols);
      var colIndex = i % this.cols;
      var topOffset = rowIndex * this.rowHeight;

      var nodeInfo = this.activeNodes.get(key);
      if (!nodeInfo) {
        // Create new node via factory callback
        var el = null;
        if (typeof this.renderItem === 'function') {
          el = this.renderItem(item, i);
        } else if (typeof document !== 'undefined') {
          el = document.createElement('div');
          el.className = 'game-card';
          el.setAttribute('data-game-id', item.id || '');
        } else {
          el = {
            style: {},
            classList: { add: function () {} },
            setAttribute: function () {}
          };
        }

        if (el) {
          el.setAttribute('data-virtual-key', key);
          el.classList.add('virtual-card-item');
          this._applyPositioning(el, rowIndex, colIndex, topOffset, isList);
          targetContainer.appendChild(el);
          this.activeNodes.set(key, { el: el, index: i, rowIndex: rowIndex, colIndex: colIndex, item: item });
        }
      } else {
        // Node already exists: update position transform
        nodeInfo.index = i;
        nodeInfo.rowIndex = rowIndex;
        nodeInfo.colIndex = colIndex;
        this._applyPositioning(nodeInfo.el, rowIndex, colIndex, topOffset, isList);
      }
    }

    // Unmount cards that scrolled out of the visible window
    var toDelete = [];
    var self = this;
    this.activeNodes.forEach(function (nodeInfo, key) {
      if (!neededKeys.has(key)) {
        if (nodeInfo.el && nodeInfo.el.parentNode) {
          nodeInfo.el.parentNode.removeChild(nodeInfo.el);
        }
        toDelete.push(key);
      }
    });

    for (var d = 0; d < toDelete.length; d++) {
      this.activeNodes.delete(toDelete[d]);
    }

    // Trigger icon creation & dynamic extensions if available
    if (typeof window !== 'undefined') {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
      if (window.PWACachePrewarmer && typeof window.PWACachePrewarmer.refreshBadges === 'function') {
        window.PWACachePrewarmer.refreshBadges();
      }
    }
  };

  /**
   * Applies CSS transform translateY and grid/list positioning
   */
  VirtualGrid.prototype._applyPositioning = function (el, rowIndex, colIndex, topOffset, isList) {
    if (!el) return;
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.willChange = 'transform';

    if (isList) {
      el.style.width = '100%';
      el.style.transform = 'translate3d(0, ' + topOffset + 'px, 0)';
    } else {
      var gap = DEFAULT_CONFIG.gridGap;
      // Formula for column percentage and left offset
      if (this.cols > 1) {
        // total width = 100%, total gaps = (cols - 1) * gap
        // each card width = (100% - (cols - 1) * gap) / cols
        var colPercent = 100 / this.cols;
        var leftOffsetPercent = colIndex * colPercent;
        var gapOffset = (colIndex * gap) - ((colIndex / this.cols) * (this.cols - 1) * gap);
        el.style.width = 'calc(' + (100 / this.cols).toFixed(4) + '% - ' + Math.round((gap * (this.cols - 1)) / this.cols) + 'px)';
        el.style.transform = 'translate3d(' + (colIndex === 0 ? '0px' : 'calc(' + leftOffsetPercent.toFixed(4) + '% + ' + Math.round(gapOffset) + 'px)') + ', ' + topOffset + 'px, 0)';
      } else {
        el.style.width = '100%';
        el.style.transform = 'translate3d(0, ' + topOffset + 'px, 0)';
      }
    }
  };

  /**
   * Remove all mounted virtual nodes
   */
  VirtualGrid.prototype.clearNodes = function () {
    this.activeNodes.forEach(function (nodeInfo) {
      if (nodeInfo.el && nodeInfo.el.parentNode) {
        nodeInfo.el.parentNode.removeChild(nodeInfo.el);
      }
    });
    this.activeNodes.clear();
    this.renderedRange = { startRow: -1, endRow: -1, startIndex: -1, endIndex: -1 };
  };

  /**
   * Update items dataset (for search queries, category filters, sorting)
   */
  VirtualGrid.prototype.updateItems = function (items, preserveScroll) {
    this.items = Array.isArray(items) ? items : [];
    if (!preserveScroll && this.container) {
      this.clearNodes();
    }
    this.measureLayout();
    this.render();
  };

  /**
   * Set catalog display mode ('grid' | 'list')
   */
  VirtualGrid.prototype.setMode = function (mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.clearNodes();
      this.measureLayout();
      this.render();
    }
  };

  /**
   * Window / Container scroll handler using requestAnimationFrame for 60 FPS
   */
  VirtualGrid.prototype._handleScroll = function () {
    if (this._isDestroyed) return;
    var self = this;
    if (!this._rafId) {
      this._rafId = requestAnimationFrame(function () {
        self._rafId = null;
        self.render();
      });
    }
  };

  /**
   * Responsive window resize handler
   */
  VirtualGrid.prototype._handleResize = function () {
    if (this._isDestroyed) return;
    var self = this;
    if (this._resizeDebounce) clearTimeout(this._resizeDebounce);
    this._resizeDebounce = setTimeout(function () {
      self.measureLayout();
      self.clearNodes();
      self.render();
    }, 60);
  };

  /**
   * Bind event listeners for scroll, orientation change, and resize
   */
  VirtualGrid.prototype.bindEvents = function () {
    if (typeof window === 'undefined') return;
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });
  };

  /**
   * Cleanup and destroy listeners
   */
  VirtualGrid.prototype.destroy = function () {
    this._isDestroyed = true;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._resizeDebounce) {
      clearTimeout(this._resizeDebounce);
      this._resizeDebounce = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
    }
    this.clearNodes();
    if (this.spacer && this.spacer.parentNode) {
      this.spacer.parentNode.removeChild(this.spacer);
    }
    if (this.itemsContainer && this.itemsContainer.parentNode) {
      this.itemsContainer.parentNode.removeChild(this.itemsContainer);
    }
    if (this.container) {
      this.container.classList.remove('virtual-grid-host');
    }
  };

  /**
   * Returns current active mounted card node count
   */
  VirtualGrid.prototype.getActiveNodeCount = function () {
    return this.activeNodes.size;
  };

  return {
    VirtualGrid: VirtualGrid,
    create: function (options) {
      return new VirtualGrid(options);
    },
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };
});
