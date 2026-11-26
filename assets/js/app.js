/**
 * ArcadeVerse Home Hub Engine
 * Handles live games catalog, in-app modal launcher, and category/search filtering
 */

if (!window.PWACachePrewarmer && !document.querySelector('script[data-pwa-cache-prewarmer]')) {
  const prewarmerScript = document.createElement("script");
  prewarmerScript.src = new URL("assets/js/pwa-cache-prewarmer.js", document.baseURI).href;
  prewarmerScript.dataset.pwaCachePrewarmer = "true";
  document.head.appendChild(prewarmerScript);
}

document.addEventListener("DOMContentLoaded", () => {
  // Ensure viewport has viewport-fit=cover for safe-area insets on mobile
  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport && !metaViewport.content.includes("viewport-fit=cover")) {
    metaViewport.content += ", viewport-fit=cover";
  }

  // ========================================================
  // ACCESSIBILITY (A11Y) LIVE REGION ANNOUNCER ENGINE (#725)
  // Dynamic aria-live status announcer for NVDA, VoiceOver, and JAWS
  // WCAG 4.1.3 (Status Messages) compliant
  // ========================================================
  function getOrCreateA11yAnnouncer() {
    let announcer = document.getElementById("a11y-announcer");
    if (!announcer) {
      announcer = document.createElement("div");
      announcer.id = "a11y-announcer";
      announcer.className = "sr-only";
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      announcer.style.position = "absolute";
      announcer.style.width = "1px";
      announcer.style.height = "1px";
      announcer.style.padding = "0";
      announcer.style.margin = "-1px";
      announcer.style.overflow = "hidden";
      announcer.style.clip = "rect(0, 0, 0, 0)";
      announcer.style.whiteSpace = "nowrap";
      announcer.style.border = "0";
      if (document.body) {
        document.body.appendChild(announcer);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          if (!document.getElementById("a11y-announcer")) {
            document.body.appendChild(announcer);
          }
        });
      }
    }
    return announcer;
  }

  function announceToScreenReader(message, priority = "polite") {
    if (!message || typeof message !== "string") return;
    const announcer = getOrCreateA11yAnnouncer();
    if (!announcer) return;

    if (priority === "assertive") {
      announcer.setAttribute("aria-live", "assertive");
    } else {
      announcer.setAttribute("aria-live", "polite");
    }

    // Clear prior content to guarantee mutation trigger across VoiceOver & NVDA
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  }

  // Mount persistent announcer element immediately
  getOrCreateA11yAnnouncer();
  window.announceToScreenReader = announceToScreenReader;


  const gamesGrid = document.getElementById("games-grid");
  const totalGamesCount = document.getElementById("total-games-count");
  const totalContributorsCount = document.getElementById("total-contributors-count");
  const searchInput = document.getElementById("game-search-input");
  const categoryPills = document.querySelectorAll(".category-pills .pill[data-category]");

  // Modal elements
  const gameModal = document.getElementById("game-modal");
  const modalOverlay = document.getElementById("modal-overlay");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalGameTitle = document.getElementById("modal-game-title");
  const modalGameBadge = document.getElementById("modal-game-badge");
  const modalGameAuthor = document.getElementById("modal-game-author");
  let gameIframe = document.getElementById("game-iframe");
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const newTabBtn = document.getElementById("new-tab-btn");
  const reloadBtn = document.getElementById("reload-btn");
  const modalWindow = document.querySelector(".modal-window");
  const modalFrameWrapper = document.querySelector(".modal-frame-wrapper");
  if (modalFrameWrapper) {
    modalFrameWrapper.classList.add("game-modal-body");
  }
  const sortSelect = document.getElementById("catalog-sort-select");
  const favoritesCountBadge = document.getElementById("favorites-count-badge");
  const modalFavBtn = document.getElementById("modal-fav-btn");
  const modalSoundBtn = document.getElementById("modal-sound-btn");
  const scratchpadBtn = document.getElementById("modal-scratchpad-btn");
  const scratchpadPanel = document.getElementById("game-scratchpad");
  const scratchpadCloseBtn = document.getElementById("scratchpad-close-btn");
  const scratchpadNotes = document.getElementById("scratchpad-notes");
  const scratchpadTitle = document.getElementById("scratchpad-game-title");
  const scratchpadStatus = document.getElementById("scratchpad-status");
  const scratchpadClearConfirm = document.getElementById("scratchpad-clear-confirm");

  let currentCategory = "all";
  let currentDurationFacet = "all";
  let currentControlsFacet = "all";
  let currentLetterFilter = "all";
  let currentTagFilter = "";
  let currentMixFilter = null; // curated mix filter (#583), read by the catalog filter below
  let searchQuery = "";
  let currentSort = "featured";
  let searchDebounceTimer = null;
  const CATALOG_SORT_STORAGE_KEY = "arcadeverse_catalog_sort";
  const CATALOG_VIEW_STORAGE_KEY = "arcadeverse_catalog_view";
  let currentCatalogView = "grid";
  try {
    const savedView = localStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
    if (savedView === "list" || savedView === "grid" || savedView === "floor") {
      currentCatalogView = savedView;
    }
  } catch (_) {}
  try {
    const savedSort = localStorage.getItem(CATALOG_SORT_STORAGE_KEY);
    if (savedSort && sortSelect && Array.from(sortSelect.options).some((o) => o.value === savedSort)) {
      currentSort = savedSort;
    }
  } catch (_) {}
  let lastFocusedElement = null;

  // Persistent screen reader live region announcer (#702)
  // Supports polite status messages and assertive priority alerts compliant with WCAG 4.1.3
  function announceToScreenReader(message, priority = "polite") {
    if (!message) return;
    let liveRegion = document.getElementById("a11y-announcer") || document.getElementById("a11y-live-region");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "a11y-announcer";
      liveRegion.className = "sr-only";
      liveRegion.setAttribute("role", "status");
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      document.body.appendChild(liveRegion);
    }
    const urgency = priority === "assertive" ? "assertive" : "polite";
    if (liveRegion.getAttribute("aria-live") !== urgency) {
      liveRegion.setAttribute("aria-live", urgency);
    }
    // Clear first so repeated identical messages (e.g. "Game paused.") re-announce reliably
    liveRegion.textContent = "";
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 50);
  }
  window.announceToScreenReader = announceToScreenReader;

  // ========================================================
  // REBINDABLE KEYBOARD CONTROLS SUBSYSTEM (#516)
  // Allows customizing and remapping Up, Down, Left, Right, Action 1, Action 2
  // ========================================================
  const DEFAULT_KEYBINDINGS = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    action1: "Space",
    action2: "z"
  };

  const DEFAULT_KEY_HINTS = {
    up: "ArrowUp / W",
    down: "ArrowDown / S",
    left: "ArrowLeft / A",
    right: "ArrowRight / D",
    action1: "Space",
    action2: "Z"
  };

  const KEYBINDINGS_STORAGE_KEY = "av_keybindings";
  let activeKeybindings = Object.assign({}, DEFAULT_KEYBINDINGS);

  try {
    const savedBindings = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
    if (savedBindings) {
      activeKeybindings = Object.assign({}, DEFAULT_KEYBINDINGS, JSON.parse(savedBindings));
    }
  } catch (_) {}

  function ensureControlsSettingsDOM() {
    let btn = document.getElementById("modal-controls-btn");
    const modalControlsWrap = document.querySelector(".modal-controls");
    if (!btn && modalControlsWrap) {
      btn = document.createElement("button");
      btn.id = "modal-controls-btn";
      btn.type = "button";
      btn.className = "btn btn-sm btn-icon";
      btn.title = "Controls Settings (Rebind Keys)";
      btn.setAttribute("aria-label", "Controls Settings");
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path></svg>`;
      const reloadBtnEl = document.getElementById("reload-btn");
      if (reloadBtnEl && reloadBtnEl.nextSibling) {
        modalControlsWrap.insertBefore(btn, reloadBtnEl.nextSibling);
      } else {
        modalControlsWrap.appendChild(btn);
      }
    }

    let dialog = document.getElementById("controls-settings-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "controls-settings-dialog";
      dialog.className = "controls-dialog";
      dialog.setAttribute("aria-labelledby", "controls-dialog-title");
      dialog.innerHTML = `<div class="controls-dialog-card"><div class="controls-dialog-header"><h3 id="controls-dialog-title" class="controls-dialog-title"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path></svg> Controls Settings</h3><button type="button" class="btn btn-sm btn-icon" id="controls-dialog-close" aria-label="Close Controls Dialog"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><p class="controls-dialog-desc">Customize controls for WASD, Arrow keys, or custom layouts. Click a key to rebind.</p><div id="controls-conflict-warning" style="display:none; color:#f43f5e; font-size:0.85rem; margin-bottom:0.75rem; font-weight:600;"></div><div class="controls-grid" id="controls-rebind-grid"><div class="control-row"><span class="control-label">Move Up</span><button type="button" class="keybind-btn" data-action="up"><kbd id="kb-up">ArrowUp / W</kbd></button></div><div class="control-row"><span class="control-label">Move Down</span><button type="button" class="keybind-btn" data-action="down"><kbd id="kb-down">ArrowDown / S</kbd></button></div><div class="control-row"><span class="control-label">Move Left</span><button type="button" class="keybind-btn" data-action="left"><kbd id="kb-left">ArrowLeft / A</kbd></button></div><div class="control-row"><span class="control-label">Move Right</span><button type="button" class="keybind-btn" data-action="right"><kbd id="kb-right">ArrowRight / D</kbd></button></div><div class="control-row"><span class="control-label">Action 1 (Jump / Select)</span><button type="button" class="keybind-btn" data-action="action1"><kbd id="kb-action1">Space</kbd></button></div><div class="control-row"><span class="control-label">Action 2 (Fire / Secondary)</span><button type="button" class="keybind-btn" data-action="action2"><kbd id="kb-action2">Z</kbd></button></div></div><div class="controls-dialog-footer"><button type="button" class="btn btn-secondary btn-sm" id="controls-reset-btn">Reset to Defaults</button><button type="button" class="btn btn-primary btn-sm" id="controls-save-btn">Save & Close</button></div></div>`;
      document.body.appendChild(dialog);
    }
    return { btn, dialog };
  }

  const { btn: modalControlsBtn, dialog: controlsDialog } = ensureControlsSettingsDOM();
  const closeControlsBtn = document.getElementById("controls-dialog-close");
  const resetControlsBtn = document.getElementById("controls-reset-btn");
  const saveControlsBtn = document.getElementById("controls-save-btn");
  let currentlyRebindingAction = null;

  function cancelRebinding() {
    currentlyRebindingAction = null;
    document.querySelectorAll(".keybind-btn").forEach(b => b.classList.remove("listening"));
    const conflictEl = document.getElementById("controls-conflict-warning");
    if (conflictEl) conflictEl.style.display = "none";
    updateControlsUI();
  }

  function updateControlsUI() {
    const isCustomized = JSON.stringify(activeKeybindings) !== JSON.stringify(DEFAULT_KEYBINDINGS);
    for (const [action, keyVal] of Object.entries(activeKeybindings)) {
      const el = document.getElementById(`kb-${action}`);
      if (el) {
        if (!isCustomized && DEFAULT_KEY_HINTS[action]) {
          el.textContent = DEFAULT_KEY_HINTS[action];
        } else {
          el.textContent = keyVal;
        }
      }
    }
  }

  if (controlsDialog) {
    if (modalControlsBtn) {
      modalControlsBtn.addEventListener("click", () => {
        cancelRebinding();
        if (typeof controlsDialog.showModal === "function") {
          controlsDialog.showModal();
        } else {
          controlsDialog.setAttribute("open", "true");
        }
      });
    }

    if (closeControlsBtn) {
      closeControlsBtn.addEventListener("click", () => {
        cancelRebinding();
        if (typeof controlsDialog.close === "function") controlsDialog.close();
        else controlsDialog.removeAttribute("open");
      });
    }

    controlsDialog.addEventListener("click", (e) => {
      if (e.target === controlsDialog) {
        cancelRebinding();
        if (typeof controlsDialog.close === "function") controlsDialog.close();
        else controlsDialog.removeAttribute("open");
      }
    });

    controlsDialog.addEventListener("close", () => {
      cancelRebinding();
    });

    if (resetControlsBtn) {
      resetControlsBtn.addEventListener("click", () => {
        activeKeybindings = Object.assign({}, DEFAULT_KEYBINDINGS);
        try {
          localStorage.removeItem(KEYBINDINGS_STORAGE_KEY);
        } catch (_) {}
        cancelRebinding();
      });
    }

    if (saveControlsBtn) {
      saveControlsBtn.addEventListener("click", () => {
        try {
          localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(activeKeybindings));
        } catch (_) {}
        cancelRebinding();
        if (typeof controlsDialog.close === "function") controlsDialog.close();
        else controlsDialog.removeAttribute("open");
      });
    }

    document.querySelectorAll(".keybind-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        currentlyRebindingAction = action;
        document.querySelectorAll(".keybind-btn").forEach(b => b.classList.remove("listening"));
        btn.classList.add("listening");
        const kbd = btn.querySelector("kbd");
        if (kbd) kbd.textContent = "Press key (Esc to cancel)...";
        const conflictEl = document.getElementById("controls-conflict-warning");
        if (conflictEl) conflictEl.style.display = "none";
      });
    });

    window.addEventListener("keydown", (e) => {
      if (!currentlyRebindingAction) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape" || e.code === "Escape") {
        cancelRebinding();
        return;
      }

      const newKey = e.code === "Space" ? "Space" : (e.key.length === 1 ? e.key.toLowerCase() : e.key);

      const conflictAction = Object.keys(activeKeybindings).find(
        act => act !== currentlyRebindingAction && activeKeybindings[act].toLowerCase() === newKey.toLowerCase()
      );

      if (conflictAction) {
        const conflictEl = document.getElementById("controls-conflict-warning");
        if (conflictEl) {
          conflictEl.textContent = `"${newKey}" was already bound to ${conflictAction.toUpperCase()}. Swapped automatically!`;
          conflictEl.style.display = "block";
        }
        activeKeybindings[conflictAction] = activeKeybindings[currentlyRebindingAction];
      }

      activeKeybindings[currentlyRebindingAction] = newKey;
      currentlyRebindingAction = null;
      document.querySelectorAll(".keybind-btn").forEach(b => b.classList.remove("listening"));
      updateControlsUI();
    }, true);
  }

  // Runtime Keyboard Remapping Translation Engine (#516)
  // Maps player customized keys to corresponding standard game controls (Arrow keys, Space, Z)
  const ACTION_GAME_DISPATCH = {
    up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    action1: { key: " ", code: "Space", keyCode: 32 },
    action2: { key: "z", code: "KeyZ", keyCode: 90 }
  };

  function translateAndDispatchRemappedKey(e, eventType) {
    if (!gameModal || !gameModal.classList.contains("active") || !activeGame) return;
    if (controlsDialog && controlsDialog.hasAttribute("open")) return;

    const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) return;

    const pressedKey = e.code === "Space" ? "Space" : (e.key.length === 1 ? e.key.toLowerCase() : e.key);

    for (const [action, boundKey] of Object.entries(activeKeybindings)) {
      if (boundKey.toLowerCase() === pressedKey.toLowerCase()) {
        const targetMapping = ACTION_GAME_DISPATCH[action];
        if (!targetMapping) continue;

        const iframe = document.getElementById("game-iframe");
        if (iframe && iframe.contentWindow) {
          try {
            const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
            const FrameKeyboardEvent = iframe.contentWindow.KeyboardEvent || KeyboardEvent;
            const evt = new FrameKeyboardEvent(eventType, {
              key: targetMapping.key,
              code: targetMapping.code,
              keyCode: targetMapping.keyCode,
              which: targetMapping.keyCode,
              bubbles: true,
              cancelable: true
            });
            if (frameDoc) {
              frameDoc.dispatchEvent(evt);
            }
          } catch (_) {
            const targetOrigin = (typeof getTrustedTargetOrigin === "function") ? getTrustedTargetOrigin() : "*";
            iframe.contentWindow.postMessage({
              type: "ARCADEVERSE_GAMEPAD_KEY",
              eventType: eventType,
              key: targetMapping.key,
              code: targetMapping.code,
              keyCode: targetMapping.keyCode
            }, targetOrigin);
          }
        }
        break;
      }
    }
  }

  window.addEventListener("keydown", (e) => translateAndDispatchRemappedKey(e, "keydown"), false);
  window.addEventListener("keyup", (e) => translateAndDispatchRemappedKey(e, "keyup"), false);
  let activeGame = null;
  let modalPushedHistory = false;
  let closeAutocomplete = () => {};
  let resetActiveMutatorSession = () => {};

  // History API State Synchronization & Deep-Linking Engine
  function syncURLState(push = false) {
    try {
      if (typeof window === "undefined" || !window.history || !window.location) return;
      const url = new URL(window.location.href);

      if (currentCategory && currentCategory.toLowerCase() !== "all") {
        url.searchParams.set("category", currentCategory);
      } else {
        url.searchParams.delete("category");
      }

      if (searchQuery && searchQuery.trim().length > 0) {
        url.searchParams.set("search", searchQuery.trim());
      } else {
        url.searchParams.delete("search");
      }

      if (activeGame && activeGame.id) {
        url.searchParams.set("game", activeGame.id);
      } else {
        url.searchParams.delete("game");
      }

      const stateObj = {
        category: currentCategory,
        search: searchQuery,
        game: activeGame ? activeGame.id : null
      };

      const newUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");

      if (push) {
        window.history.pushState(stateObj, "", newUrl);
      } else {
        window.history.replaceState(stateObj, "", newUrl);
      }
    } catch (_) {
      // Gracefully handle file:// or restricted sandbox origins
    }
  }

  // =========================================================================
  // XSS PREVENTION & ATTRIBUTE SANITIZATION UTILITIES (#491)
  // =========================================================================
  const ArcadeSanitizer = (function () {
    // Permitted Lucide icon names whitelist to prevent arbitrary attribute or SVG injection
    const LUCIDE_ICON_WHITELIST = new Set([
      "gamepad-2", "gamepad", "play", "play-circle", "trophy", "star",
      "heart", "heart-crack", "search", "x", "refresh-cw", "maximize",
      "maximize-2", "minimize", "external-link", "volume-2", "volume-x",
      "moon", "sun", "help-circle", "file-code-2", "book-open", "chevron-down",
      "chevron-up", "chevron-right", "chevron-left", "shield", "cpu",
      "zap", "award", "crown", "sparkles", "compass", "target", "crosshair",
      "dices", "layers", "timer", "clock", "hash", "code", "terminal",
      "user", "users", "tag", "tags", "filter", "check", "info", "alert-triangle",
      "alert-circle", "eye", "eye-off", "lock", "unlock", "power", "sliders",
      "copy", "download", "folder", "flame", "skull", "ghost", "radar"
    ]);

    /**
     * Pure vanilla HTML entity encoder for text content
     * Encodes &, <, >, ", ', and ` to neutralize HTML injection
     */
    function escapeHTML(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#96;");
    }

    /**
     * Attribute-safe encoder for HTML attributes (title="...", data-*, aria-*)
     * Strictly neutralizes quote breakout characters and control characters
     */
    function escapeAttr(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/`/g, "&#96;")
        .replace(/=/g, "&#61;");
    }

    /**
     * Validates and returns a safe Lucide icon name from the strict whitelist
     */
    function sanitizeIconName(name) {
      if (!name || typeof name !== "string") return "gamepad-2";
      const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      return LUCIDE_ICON_WHITELIST.has(cleanName) ? cleanName : "gamepad-2";
    }

    /**
     * Generates a safe whitelisted Lucide icon HTML tag
     */
    function renderSafeIcon(name, extraClass = "") {
      const safeName = sanitizeIconName(name);
      const safeClass = escapeAttr(extraClass);
      return `<i data-lucide="${safeName}" class="${safeClass}"></i>`;
    }

    return {
      escapeHTML,
      escapeAttr,
      sanitizeIconName,
      renderSafeIcon,
      LUCIDE_ICON_WHITELIST
    };
  })();

  window.ArcadeSanitizer = ArcadeSanitizer;
  const { escapeHTML, escapeAttr, sanitizeIconName, renderSafeIcon } = ArcadeSanitizer;

  // =========================================================================
  // RESILIENT LOCALSTORAGE QUOTA MANAGER & AUTOMATIC CACHE PRUNING (#490)
  // =========================================================================
  const ArcadeStorageResilience = (function () {
    const TOAST_ID = "av-storage-quota-toast";
    let toastTimeout = null;

    // Ordered eviction priority buckets: least critical items are purged first
    const EVICTION_PRIORITIES = [
      // Priority 1: Ephemeral API & Network Caches
      [
        /^arcadeverse_contributors_cache/,
        /^av_search_cache/,
        /^av_temp_/
      ],
      // Priority 2: Stale session logs, analytics, and telemetry
      [
        /^arcadeverse_recently_played_v2/,
        /^arcadeverse_recently_played/,
        /^av_play_log/,
        /^av_session_/,
        /^arcadeverse_telemetry/
      ],
      // Priority 3: Non-critical UI state toggles & filters
      [
        /^arcadeverse_catalog_sort/,
        /^arcadeverse_catalog_view/,
        /^arcadeverse_last_category/
      ]
      // Priority 4 (PROTECTED & NEVER EVICTED):
      // Favorites (av_favorites), ratings, sound preferences, theme mode
    ];

    const PROTECTED_KEYS = new Set([
      "av_favorites",
      "arcadeverse_favorite_games",
      "arcadeverse:preferences:favorites",
      "arcadeverse_theme",
      "arcadeverse_game_ratings",
      "arcadeverse_master_volume",
      "arcadeverse_muted"
    ]);

    function isQuotaError(err) {
      if (!err) return false;
      return (
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22 ||
        err.code === 1014 ||
        err.number === -2147024882 ||
        (typeof err.message === "string" && err.message.toLowerCase().includes("quota"))
      );
    }

    function showQuotaToast(message) {
      announceToScreenReader(`Storage notice: ${message}`);
      let toast = document.getElementById(TOAST_ID);
      if (!toast) {
        toast = document.createElement("div");
        toast.id = TOAST_ID;
        toast.className = "av-storage-quota-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
      }

      toast.innerHTML = `
        <div class="av-quota-toast-content">
          <svg class="av-quota-toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span class="av-quota-toast-text">${message}</span>
          <button type="button" class="av-quota-toast-close" aria-label="Dismiss Notification">&times;</button>
        </div>
      `;

      toast.querySelector(".av-quota-toast-close").onclick = () => {
        toast.classList.remove("visible");
      };

      toast.classList.add("visible");
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove("visible");
      }, 5500);
    }

    function pruneTier(tierRegexList) {
      let bytesFreed = 0;
      let keysRemoved = 0;
      try {
        const totalKeys = localStorage.length;
        const candidateKeys = [];

        for (let i = 0; i < totalKeys; i++) {
          const key = localStorage.key(i);
          if (!key || PROTECTED_KEYS.has(key)) continue;

          for (let r = 0; r < tierRegexList.length; r++) {
            if (tierRegexList[r].test(key)) {
              candidateKeys.push(key);
              break;
            }
          }
        }

        candidateKeys.forEach((key) => {
          try {
            const val = localStorage.getItem(key) || "";
            bytesFreed += (key.length + val.length) * 2;
            localStorage.removeItem(key);
            keysRemoved++;
          } catch (_) {}
        });
      } catch (_) {}
      return { bytesFreed, keysRemoved };
    }

    function pruneStorageForQuota() {
      let totalFreed = 0;
      let totalRemoved = 0;

      for (let p = 0; p < EVICTION_PRIORITIES.length; p++) {
        const res = pruneTier(EVICTION_PRIORITIES[p]);
        totalFreed += res.bytesFreed;
        totalRemoved += res.keysRemoved;
        if (totalRemoved > 0) break; // Try writing after each tier
      }

      return { totalFreed, totalRemoved };
    }

    function safeSetItem(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (err) {
        if (isQuotaError(err)) {
          console.warn(`[ArcadeVerse Storage] QuotaExceededError writing "${key}". Initiating LRU prune...`);
          const pruneResult = pruneStorageForQuota();

          if (pruneResult.totalRemoved > 0) {
            try {
              localStorage.setItem(key, value);
              showQuotaToast(
                "Storage quota full: old session logs were automatically cleaned up to preserve your favorites."
              );
              return true;
            } catch (retryErr) {
              console.error("[ArcadeVerse Storage] Write failed even after eviction:", retryErr);
            }
          }

          showQuotaToast(
            "Storage quota full: unable to save new data without clearing space."
          );
          return false;
        } else {
          console.warn(`[ArcadeVerse Storage] Failed to set "${key}":`, err);
          return false;
        }
      }
    }

    return {
      safeSetItem,
      showQuotaToast,
      isQuotaError,
      pruneStorageForQuota
    };
  })();

  window.ArcadeStorageResilience = ArcadeStorageResilience;

  // Search & filter UI element refs
  const searchClearBtn = document.getElementById("search-clear-btn");
  const resultsCountEl = document.getElementById("catalog-results-count");
  const searchTagsRow = document.getElementById("search-tags-row");
  const resetFacetsBtn = document.getElementById("btn-reset-facets");

  // Favorites Storage Engine (Issue #533 & Issue #890)
  // Consolidate on single canonical storage key 'av_favorites'
  const FAVORITES_STORAGE_KEY = "av_favorites";
  const LEGACY_FAVORITES_STORAGE_KEY = "arcadeverse_favorite_games";
  const PREFERENCES_FAVORITES_KEY = "arcadeverse:preferences:favorites";

  // Perform one-time migration from legacy storage keys to canonical av_favorites key
  function reconcileFavoritesStorage() {
    try {
      const canonicalRaw = ArcadeStorageResilience.safeGetItem(FAVORITES_STORAGE_KEY, null);
      let mergedSet = new Set();
      if (canonicalRaw) {
        try {
          const list = JSON.parse(canonicalRaw);
          if (Array.isArray(list)) list.forEach(id => mergedSet.add(id));
        } catch (_) { }
      }
      const legacyRaw = ArcadeStorageResilience.safeGetItem(LEGACY_FAVORITES_STORAGE_KEY, null);
      if (legacyRaw) {
        try {
          const list = JSON.parse(legacyRaw);
          if (Array.isArray(list)) list.forEach(id => mergedSet.add(id));
        } catch (_) { }
      }

      const prefRaw = ArcadeStorageResilience.safeGetItem(PREFERENCES_FAVORITES_KEY, null);
      if (prefRaw) {
        try {
          const list = JSON.parse(prefRaw);
          if (Array.isArray(list)) list.forEach(id => mergedSet.add(id));
        } catch (_) { }
      }

      if (mergedSet.size > 0 && !canonicalRaw) {
        ArcadeStorageResilience.safeSetItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(mergedSet)));
      }

      // Purge legacy split storage keys to eliminate split-brain synchronization
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY);
          window.localStorage.removeItem(PREFERENCES_FAVORITES_KEY);
        } catch (_) { }
      }
    } catch (_) { }
  }

  reconcileFavoritesStorage();

  function getFavorites() {
    try {
      const raw = ArcadeStorageResilience.safeGetItem(FAVORITES_STORAGE_KEY, null);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveFavorites(favSet) {
    const list = Array.from(favSet);
    const serialized = JSON.stringify(list);
    // Write solely to single canonical storage key
    ArcadeStorageResilience.safeSetItem(FAVORITES_STORAGE_KEY, serialized);
    updateFavoritesBadge();

    // Offline dispatch queue integration (#554)
    if (typeof navigator !== 'undefined' && !navigator.onLine && window.AvOfflineQueue) {
      window.AvOfflineQueue.enqueue('FAVORITES_SYNC', { favorites: list });
    }
  }

  function isFavorite(gameId) {
    return getFavorites().has(gameId);
  }

  function updateFavoritesBadge() {
    const favCount = getFavorites().size;
    if (favoritesCountBadge) {
      favoritesCountBadge.textContent = favCount;
      favoritesCountBadge.setAttribute("aria-label", `${favCount} favorite games saved`);
    }
    const mobileFavCount = document.getElementById("mobile-fav-count");
    if (mobileFavCount) {
      mobileFavCount.textContent = favCount;
    }
    updateCategoryPillCounts();
  }

  // Canonical category token normalizer & matching helper (#892)
  const CATEGORY_SYNONYMS = {
    shooter: "arcade",
    defense: "strategy",
    towerdefense: "strategy",
    narrative: "adventure",
    escape: "puzzle",
    escaperoom: "puzzle",
    horror: "adventure"
  };

  function extractGameCategoryTokens(categoryStr) {
    if (!categoryStr || typeof categoryStr !== "string") return [];
    return categoryStr
      .split(/[\/,|]+/)
      .map(token => token.trim().toLowerCase())
      .filter(token => token.length > 0)
      .map(token => CATEGORY_SYNONYMS[token.replace(/\s+/g, "")] || token);
  }

  function matchesCategoryFilter(game, activeCategory) {
    if (!game) return false;
    if (!activeCategory || activeCategory === "all") return true;

    if (activeCategory === "favorites") {
      const favs = getFavorites();
      return favs.has(game.id);
    }

    if (activeCategory.startsWith("playlist:")) {
      const plId = activeCategory.replace("playlist:", "");
      const pl = window.ArcadePlaylists ? window.ArcadePlaylists.getPlaylist(plId) : null;
      return pl ? pl.games.includes(game.id) : false;
    }

    const target = activeCategory.toLowerCase().trim();
    if (target === "halloween") {
      return isHalloweenGame(game);
    }

    const normalizedTarget = CATEGORY_SYNONYMS[target.replace(/\s+/g, "")] || target;
    const tokens = extractGameCategoryTokens(game.category);
    return tokens.includes(normalizedTarget) || tokens.includes(target);
  }

  // Dynamic Category Counters & Real-Time Statistics
  function updateCategoryPillCounts() {
    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return;
    const favs = getFavorites();

    const counts = {
      all: GAMES_REGISTRY.length,
      favorites: favs.size,
      halloween: 0
    };

    // Initialize pill count counters based on registered DOM pill keys
    categoryPills.forEach((pill) => {
      const key = (pill.getAttribute("data-category") || "").toLowerCase();
      if (key && counts[key] === undefined) {
        counts[key] = 0;
      }
    });

    GAMES_REGISTRY.forEach((g) => {
      categoryPills.forEach((pill) => {
        const catKey = pill.getAttribute("data-category") || "";
        const lowerKey = catKey.toLowerCase();
        if (lowerKey === "all" || lowerKey === "favorites") return;
        if (matchesCategoryFilter(g, catKey)) {
          counts[lowerKey] = (counts[lowerKey] || 0) + 1;
        }
      });
      if (isHalloweenGame(g)) {
        counts.halloween++;
      }
    });

    categoryPills.forEach((pill) => {
      const categoryKey = (pill.getAttribute("data-category") || "").toLowerCase();
      // Favorites pill already has #favorites-count-badge in index.html; keep in sync
      if (categoryKey === "favorites") {
        const badge = pill.querySelector("#favorites-count-badge") || pill.querySelector(".favorites-count-badge");
        if (badge) {
          badge.textContent = counts.favorites;
          badge.setAttribute("aria-label", `${counts.favorites} favorite games saved`);
        }
        return;
      }
      let badge = pill.querySelector(".pill-count-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "pill-count-badge";
        pill.appendChild(badge);
      }
      const countVal = counts[categoryKey] !== undefined ? counts[categoryKey] : 0;
      badge.textContent = countVal;
      badge.setAttribute("aria-label", `${countVal} games available`);
    });
  }

  function updateModalFavoriteButton(fav) {
    if (!modalFavBtn) return;
    modalFavBtn.classList.toggle("favorited", fav);
    modalFavBtn.setAttribute("aria-pressed", fav ? "true" : "false");
    const label = fav ? "Remove from Favorites" : "Save to Favorites";
    modalFavBtn.title = label;
    modalFavBtn.setAttribute("aria-label", label);
  }

  function toggleFavorite(gameId) {
    const favs = getFavorites();
    const willBeFav = !favs.has(gameId);
    if (willBeFav) {
      favs.add(gameId);
    } else {
      favs.delete(gameId);
    }
    saveFavorites(favs);

    if (currentCategory === "favorites") {
      const targetCard = gamesGrid.querySelector(`.game-card[data-game-id="${gameId}"]`);
      if (targetCard && !willBeFav) {
        // Find adjacent game card ID for smooth keyboard focus handover
        const cardNodes = Array.from(gamesGrid.querySelectorAll(".game-card:not(.removing-favorite)"));
        const currentIndex = cardNodes.findIndex((c) => c.getAttribute("data-game-id") === gameId);
        let nextFocusGameId = null;
        if (currentIndex !== -1) {
          if (currentIndex < cardNodes.length - 1) {
            nextFocusGameId = cardNodes[currentIndex + 1].getAttribute("data-game-id");
          } else if (currentIndex > 0) {
            nextFocusGameId = cardNodes[currentIndex - 1].getAttribute("data-game-id");
          }
        }

        // Immediately update button style inside the card
        const cardBtn = targetCard.querySelector(".btn-card-favorite");
        if (cardBtn) {
          cardBtn.classList.remove("favorited");
          cardBtn.setAttribute("aria-pressed", "false");
          cardBtn.title = "Save to Favorites";
          cardBtn.setAttribute("aria-label", "Save to Favorites");
        }

        // Trigger smooth CSS removal animation
        targetCard.classList.add("removing-favorite");

        // Update live results count header immediately
        updateResultsCount(favs.size);

        setTimeout(() => {
          if (targetCard.parentNode) {
            targetCard.remove();
          }
          if (favs.size === 0) {
            renderGames();
            const resetBtn = document.getElementById("reset-filter-btn");
            if (resetBtn) resetBtn.focus();
          } else if (nextFocusGameId) {
            const nextBtn = gamesGrid.querySelector(`.btn-card-favorite[data-id="${nextFocusGameId}"]`);
            if (nextBtn) nextBtn.focus();
          }
        }, 300);
      } else {
        renderGames();
      }
    } else {
      const cardBtns = document.querySelectorAll(`.btn-card-favorite[data-id="${gameId}"]`);
      cardBtns.forEach((cardBtn) => {
        cardBtn.classList.toggle("favorited", willBeFav);
        cardBtn.setAttribute("aria-pressed", willBeFav ? "true" : "false");
        const label = willBeFav ? "Remove from Favorites" : "Save to Favorites";
        cardBtn.title = label;
        cardBtn.setAttribute("aria-label", label);
      });
    }

    if (activeGame && activeGame.id === gameId) {
      updateModalFavoriteButton(willBeFav);
    }

    window.dispatchEvent(new CustomEvent("arcadeverse:favorites-updated", {
      detail: { gameId, isFavorite: willBeFav, favorites: Array.from(favs), count: favs.size }
    }));
  }

  // Cross-tab real-time favorites synchronization (canonical av_favorites with legacy migration fallback)
  window.addEventListener("storage", (e) => {
    if (e.key === FAVORITES_STORAGE_KEY || e.key === LEGACY_FAVORITES_STORAGE_KEY || e.key === PREFERENCES_FAVORITES_KEY) {
      if (e.key !== FAVORITES_STORAGE_KEY && e.newValue) {
        // If an older tab writes to legacy key, reconcile into canonical storage key
        try {
          ArcadeStorageResilience.safeSetItem(FAVORITES_STORAGE_KEY, e.newValue);
        } catch (_) { }
      }
      updateFavoritesBadge();
      if (currentCategory === "favorites") {
        renderGames();
      } else {
        const favs = getFavorites();
        document.querySelectorAll(".btn-card-favorite").forEach((btn) => {
          const id = btn.getAttribute("data-id");
          const isFav = favs.has(id);
          btn.classList.toggle("favorited", isFav);
          btn.setAttribute("aria-pressed", isFav ? "true" : "false");
          const label = isFav ? "Remove from Favorites" : "Save to Favorites";
          btn.title = label;
          btn.setAttribute("aria-label", label);
        });
      }
      if (activeGame) {
        updateModalFavoriteButton(isFavorite(activeGame.id));
      }
    }
  });

  // Levenshtein / Fuzzy Match Engine for Smart Suggestions
  function getSmartSuggestions(query, category) {
    if (!query || typeof GAMES_REGISTRY === "undefined") {
      // Suggest popular categories if no query was typed but category has 0
      return ["All", "Arcade", "Puzzle", "Retro", "Action"];
    }

    const q = query.toLowerCase().trim();
    const candidatePool = new Set();

    // Populate candidate tokens from categories, titles, authors, and tags
    GAMES_REGISTRY.forEach(g => {
      if (g.category) candidatePool.add(g.category);
      if (g.tags && Array.isArray(g.tags)) {
        g.tags.forEach(t => candidatePool.add(t));
      }
      if (g.title) {
        g.title.split(/\s+/).forEach(word => {
          const clean = word.replace(/[^a-zA-Z0-9]/g, "");
          if (clean.length >= 3) candidatePool.add(clean);
        });
      }
    });

    // Score candidates based on prefix match, substring match, and Levenshtein distance
    const scored = [];
    candidatePool.forEach(term => {
      const t = term.toLowerCase();
      if (t === q) return;

      let score = 0;
      if (t.startsWith(q)) {
        score = 100 - (t.length - q.length);
      } else if (t.includes(q)) {
        score = 80 - (t.length - q.length);
      } else if (q.includes(t)) {
        score = 70;
      } else {
        const dist = levenshteinDistance(q, t);
        if (dist <= 2 && q.length >= 3) {
          score = 60 - dist * 15;
        } else if (dist <= 3 && q.length >= 5) {
          score = 40 - dist * 10;
        }
      }

      if (score > 0) {
        scored.push({ term, score });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    const topPicks = scored.slice(0, 4).map(s => s.term);

    if (topPicks.length === 0) {
      return ["Puzzle", "Arcade", "Retro", "Halloween"];
    }
    return topPicks;
  }

  function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // Lightweight fuzzy matching (Levenshtein distance <= 2) for game titles and tags
  function matchesFuzzyLevenshtein(item, query) {
    if (!item || !query) return false;
    const clean = query.replace(/^by\s+@?/, "").replace(/^@/, "").trim().toLowerCase();
    if (clean.length < 3) return false;

    const qWords = clean.split(/\s+/).filter(Boolean);
    if (qWords.length === 0) return false;

    const titleLower = (item.title || "").toLowerCase();
    const titleWords = titleLower.split(/[\s\-:_]+/);
    const tagsLower = Array.isArray(item.tags) ? item.tags.map((t) => t.toLowerCase()) : [];

    return qWords.every((qWord) => {
      if (qWord.length < 3) {
        return titleLower.includes(qWord) || tagsLower.some((t) => t.includes(qWord));
      }

      // Check full title match
      if (Math.abs(titleLower.length - qWord.length) <= 2 && levenshteinDistance(qWord, titleLower) <= 2) {
        return true;
      }

      // Check title individual words
      for (const w of titleWords) {
        if (w.includes(qWord) || (Math.abs(w.length - qWord.length) <= 2 && levenshteinDistance(qWord, w) <= 2)) {
          return true;
        }
      }

      // Check tags (full tag or individual tag tokens)
      for (const t of tagsLower) {
        if (t.includes(qWord) || (Math.abs(t.length - qWord.length) <= 2 && levenshteinDistance(qWord, t) <= 2)) {
          return true;
        }
        const tWords = t.split(/[\s\-:_]+/);
        for (const tw of tWords) {
          if (tw.includes(qWord) || (Math.abs(tw.length - qWord.length) <= 2 && levenshteinDistance(qWord, tw) <= 2)) {
            return true;
          }
        }
      }

      return false;
    });
  }

  // Update Stats & 60 FPS Animated Count-Up Engine (#1057)
  function animateCountUp(el, targetVal, durationMs = 1200) {
    if (!el || typeof targetVal !== "number") return;
    const isReduced = typeof window !== "undefined" && (
      (window.ArcadeVerseA11y && typeof window.ArcadeVerseA11y.isReducedMotion === "function" && window.ArcadeVerseA11y.isReducedMotion()) ||
      (window.A11yEngine && window.A11yEngine.prefs && window.A11yEngine.prefs.reducedMotion) ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    );

    if (isReduced) {
      el.textContent = targetVal;
      return;
    }

    const startTime = performance.now();
    const startVal = 0;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutExpo: progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(startVal + (targetVal - startVal) * ease);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = targetVal;
      }
    }

    requestAnimationFrame(step);
  }

  function hydrateStatsTelemetry() {
    try {
      const gCount = (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) ? GAMES_REGISTRY.length : 124;
      const cCount = (typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY)) ? CONTRIBUTORS_REGISTRY.length : 48;

      const statsContainer = document.querySelector(".quick-stats");
      if (statsContainer && "IntersectionObserver" in window) {
        let hasAnimated = false;
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasAnimated) {
              hasAnimated = true;
              if (totalGamesCount) animateCountUp(totalGamesCount, gCount);
              if (totalContributorsCount) animateCountUp(totalContributorsCount, cCount);
              observer.disconnect();
            }
          });
        }, { threshold: 0.2 });
        observer.observe(statsContainer);
      } else {
        if (totalGamesCount) totalGamesCount.textContent = gCount;
        if (totalContributorsCount) totalContributorsCount.textContent = cCount;
      }
    } catch (_) {
      if (totalGamesCount) totalGamesCount.textContent = "124";
      if (totalContributorsCount) totalContributorsCount.textContent = "48";
    }
  }

  hydrateStatsTelemetry();
  updateFavoritesBadge();

  // Interactive Telemetry Popover / Micro-Drawer (#1057)
  const statCardGames = document.getElementById("stat-card-games");
  const statCardContributors = document.getElementById("stat-card-contributors");

  function openTelemetryModal(title, contentHtml) {
    let modal = document.getElementById("hero-telemetry-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "hero-telemetry-modal";
      modal.className = "hero-telemetry-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100vw";
      modal.style.height = "100vh";
      modal.style.background = "rgba(10, 15, 26, 0.95)";
      modal.style.zIndex = "10000";
      modal.style.display = "none";
      modal.style.justifyContent = "center";
      modal.style.alignItems = "center";
      modal.style.backdropFilter = "blur(10px)";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f172a; border:1px solid rgba(0,245,255,0.3); border-radius:12px; width:90%; max-width:540px; padding:24px; box-shadow:0 12px 48px rgba(0,0,0,0.8); color:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:16px;">
          <h3 style="margin:0; font-size:1.15rem; color:var(--accent-primary, #00f5ff);">${escapeHTML(title)}</h3>
          <button type="button" id="telemetry-close-btn" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>
        <div>${contentHtml}</div>
      </div>
    `;

    modal.style.display = "flex";
    const closeBtn = document.getElementById("telemetry-close-btn");
    if (closeBtn) {
      closeBtn.focus();
      closeBtn.addEventListener("click", () => { modal.style.display = "none"; });
    }
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }

  if (statCardGames) {
    const handleGamesClick = () => {
      const categoriesMap = {};
      if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
        GAMES_REGISTRY.forEach((g) => {
          const cat = g.category ? g.category.split("/")[0].trim() : "Other";
          categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
        });
      }
      const listItems = Object.keys(categoriesMap).map((cat) => `
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
          <span>${escapeHTML(cat)}</span>
          <strong style="color:var(--accent-primary, #00f5ff);">${categoriesMap[cat]} games</strong>
        </div>
      `).join("");

      openTelemetryModal("Playable Games Distribution", `
        <div style="max-height:280px; overflow-y:auto; padding-right:8px;">${listItems}</div>
      `);
    };
    statCardGames.addEventListener("click", handleGamesClick);
    statCardGames.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleGamesClick(); } });
  }

  if (statCardContributors) {
    const handleContributorsClick = () => {
      const count = typeof CONTRIBUTORS_REGISTRY !== "undefined" && Array.isArray(CONTRIBUTORS_REGISTRY) ? CONTRIBUTORS_REGISTRY.length : 48;
      openTelemetryModal("Community Contributors", `
        <p style="font-size:0.9rem; color:#94a3b8; line-height:1.6; margin-bottom:16px;">
          ArcadeVerse is built by <strong>${count} open source engineers</strong> contributing games, engines, accessibility tools, and sound synthesizers.
        </p>
        <div style="display:flex; gap:12px;">
          <a href="leaderboard.html" class="btn btn-primary" style="font-size:0.85rem; padding:8px 16px; text-decoration:none; border-radius:6px; background:var(--accent-primary, #00f5ff); color:#000; font-weight:700;">View Hall of Fame</a>
          <a href="https://github.com/DebasmitaBose0/ArcadeVerse" target="_blank" rel="noopener noreferrer" style="font-size:0.85rem; padding:8px 16px; text-decoration:none; border-radius:6px; background:rgba(255,255,255,0.1); color:#fff;">GitHub Repository</a>
        </div>
      `);
    };
    statCardContributors.addEventListener("click", handleContributorsClick);
    statCardContributors.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleContributorsClick(); } });
  }

  // Render Games
  
  // --- Facet Filter Summary Indicator Engine ---
  function updateFacetSummaryUI() {
    const summaryContainer = document.getElementById("active-filters-summary");
    if (!summaryContainer) return;

    const activeTags = [];
    if (currentDurationFacet !== "all") {
      activeTags.push({ label: 'Duration: ' + currentDurationFacet, type: 'duration' });
    }
    if (currentControlsFacet !== "all") {
      activeTags.push({ label: 'Controls: ' + currentControlsFacet, type: 'controls' });
    }
    if (currentCategory !== "all") {
      activeTags.push({ label: 'Category: ' + currentCategory, type: 'category' });
    }
    if (currentLetterFilter !== "all") {
      activeTags.push({ label: 'Letter: ' + currentLetterFilter, type: 'letter' });
    }

    if (activeTags.length === 0) {
      summaryContainer.style.display = "none";
      summaryContainer.innerHTML = "";
    } else {
      summaryContainer.style.display = "flex";
      summaryContainer.innerHTML = '<span style="font-weight: 600;">Active Filters:</span>' +
        activeTags.map(t => `<span class="active-filter-tag">${t.label}</span>`).join('');
    }
  }

  // --- Build Dynamic Tag Chips from Registry Metadata ---
  function buildTagChips() {
    if (!searchTagsRow) return;
    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return;

    // Collect all unique tags, excluding generic/noisy ones
    const EXCLUDED = new Set(["nsoc26", "NSOC26", "html5-canvas", "html5"]);
    const tagFreq = {};
    GAMES_REGISTRY.forEach((g) => {
      if (!Array.isArray(g.tags)) return;
      g.tags.forEach((t) => {
        const normalized = t.trim();
        if (!normalized || EXCLUDED.has(normalized.toLowerCase())) return;
        const key = normalized.toLowerCase();
        tagFreq[key] = (tagFreq[key] || 0) + 1;
      });
    });

    // Keep top 10 most-used tags
    const topTags = Object.entries(tagFreq)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag.charAt(0).toUpperCase() + tag.slice(1));

    if (topTags.length === 0) {
      searchTagsRow.innerHTML = "";
      return;
    }

    const label = document.createElement("span");
    label.className = "tag-filter-label";
    label.textContent = "Tags:";
    searchTagsRow.innerHTML = "";
    searchTagsRow.appendChild(label);

    topTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-filter-chip" + (currentTagFilter === tag.toLowerCase() ? " active" : "");
      btn.textContent = tag;
      btn.setAttribute("aria-pressed", currentTagFilter === tag.toLowerCase() ? "true" : "false");
      btn.addEventListener("click", () => {
        if (currentTagFilter === tag.toLowerCase()) {
          currentTagFilter = "";
        } else {
          currentTagFilter = tag.toLowerCase();
        }
        buildTagChips();
        renderGames();
      });
      searchTagsRow.appendChild(btn);
    });

    // Add a clear-tag button if a tag is active
    if (currentTagFilter) {
      const clearTag = document.createElement("button");
      clearTag.type = "button";
      clearTag.className = "tag-filter-clear";
      clearTag.setAttribute("aria-label", "Clear tag filter");
      clearTag.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Clear tag`;
      clearTag.addEventListener("click", () => {
        currentTagFilter = "";
        buildTagChips();
        renderGames();
      });
      searchTagsRow.appendChild(clearTag);
    }
  }

  // --- Live Results Count ---
  function updateResultsCount(count, isFuzzy = false) {
    if (!resultsCountEl) return;
    const total = (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) ? GAMES_REGISTRY.length : 0;
    const isFiltered = searchQuery || currentCategory !== "all" || currentDurationFacet !== "all" || currentControlsFacet !== "all" || currentTagFilter;
    if (isFuzzy && searchQuery) {
      resultsCountEl.textContent = `${count} close match${count !== 1 ? "es" : ""} found for "${searchQuery}"`;
      resultsCountEl.style.display = "";
    } else if (isFiltered) {
      resultsCountEl.textContent = `${count} of ${total} game${total !== 1 ? "s" : ""} match`;
      resultsCountEl.style.display = "";
    } else {
      resultsCountEl.textContent = `${total} game${total !== 1 ? "s" : ""} available`;
      resultsCountEl.style.display = "";
    }
  }

  
  // Helper to identify Halloween Special Games
  function isHalloweenGame(g) {
    if (!g) return false;
    const id = (g.id || "").toLowerCase();
    const title = (g.title || "").toLowerCase();
    const cat = (g.category || "").toLowerCase();
    const tags = Array.isArray(g.tags) ? g.tags.map((t) => t.toLowerCase()) : [];
    return (
      tags.includes("halloween") ||
      cat.includes("horror") ||
      title.includes("halloween") ||
      id.includes("haunted") ||
      id.includes("escape-room") ||
      id.includes("island-survival") ||
      id.includes("midnight-graveyard") ||
      id.includes("pumpkin-express")
    );
  }

  // Virtualized Game Card Grid Instance (#1366)
  let catalogVirtualGrid = null;

  /**
   * Factory to build a single interactive game card DOM element
   * Used by both standard rendering and Windowed Grid Virtualization
   * @param {Object} game
   * @param {Set} favs
   * @returns {HTMLElement}
   */
  function createGameCardElement(game, favs) {
    if (!favs) favs = getFavorites();
    const card = document.createElement("div");
    card.className = "game-card";
    card.setAttribute("data-game-id", escapeAttr(game.id));
    const safeGameId = escapeAttr(game.id);
    const safeTitle = escapeHTML(game.title);
    const safeCategory = escapeHTML(game.category);
    const safeDesc = escapeHTML(game.description || "");
    const safeAuthor = escapeHTML(game.author || game.github || "Contributor");
    const safeGithub = escapeHTML(game.github || game.author || "Contributor");
    const safeAuthorAttr = escapeAttr(game.author || game.github || "Contributor");
    const iconHtml = renderSafeIcon(game.lucideIcon || "gamepad-2");
    const favorited = favs.has(game.id);
    const actionText = `Play Now ${renderSafeIcon("play", "btn-play-icon")}`;

    const userRating = (window.GameRatings && window.GameRatings.ratings[game.id]) || null;
    const displayScore = userRating ? Number(userRating).toFixed(1) : (game.stars ? (game.stars / 10).toFixed(1) : "5.0");
    const currentStar = userRating || Math.min(5, Math.max(1, Math.round((game.stars || 25) / 10)));

    const isHalloween = isHalloweenGame(game);
    const halloweenBadgeHtml = isHalloween ? `
      <span class="badge-halloween-special" title="Halloween Special Games">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4c-1.5 0-3 1.2-3 2.5 0 .5.2 1 .5 1.5C6 9 4 11 4 14c0 3.5 3 6 8 6s8-2.5 8-6c0-3-2-5-5.5-6 .3-.5.5-1 .5-1.5 0-1.3-1.5-2.5-3-2.5z"/>
        </svg>
        Halloween Special Games
      </span>
    ` : "";
    const halloweenTitleBadge = isHalloween ? `<span class="halloween-title-badge" title="Halloween Special Games">Halloween Special Games</span>` : "";

    const flipBtnHtml = window.ArcadeCardFlipManual ? window.ArcadeCardFlipManual.renderFlipButtonHtml(game) : "";
    const cardBackHtml = window.ArcadeCardFlipManual ? window.ArcadeCardFlipManual.renderCardBackHtml(game) : "";

    card.innerHTML = `
      <div class="game-card-inner">
        <div class="game-card-front">
          <div class="game-card-preview">
            <canvas class="card-micro-preview-canvas" width="280" height="140"></canvas>
            <span class="game-category-tag">${safeCategory}</span>
            ${halloweenBadgeHtml}
            ${flipBtnHtml}
            <div class="card-options-top">
              <label class="game-compare-label compare-card-toggle-wrap" title="Select to compare with another game">
                <input type="checkbox" class="game-compare-checkbox compare-card-checkbox" data-game-id="${safeGameId}">
                <span class="compare-custom-box"></span>
              </label>
              <button class="btn-card-favorite ${favorited ? "favorited" : ""}" data-id="${safeGameId}" aria-label="${favorited ? "Remove from Favorites" : "Save to Favorites"}" aria-pressed="${favorited ? "true" : "false"}" title="${favorited ? "Remove from Favorites" : "Save to Favorites"}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fav-heart-icon">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
              </button>
            </div>
            <div class="game-icon">${iconHtml}</div>${playsBadgeHtml}
          </div>
          <div class="game-card-body">
            <h3 class="game-card-title">${safeTitle}${halloweenTitleBadge}</h3>
            <p class="game-card-desc">${safeDesc}</p>
            <div class="game-card-rating-row">
              <div class="game-rating-stars" data-game-id="${safeGameId}" aria-label="Rating for ${escapeAttr(game.title)}">
                ${[1, 2, 3, 4, 5].map(starNum => `
                  <button type="button" class="rate-star-btn ${currentStar >= starNum ? 'voted' : ''}" data-game="${safeGameId}" data-star="${starNum}" title="Rate ${starNum} star${starNum > 1 ? 's' : ''}" aria-label="Rate ${starNum} stars">
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </button>
                `).join('')}
                <span class="rating-badge">${escapeHTML(displayScore)}</span>
              </div>
            </div>
            <div class="game-card-footer">
              <div class="contributor-meta">
                <div class="contributor-avatar">${escapeHTML((game.author || game.github || "A").charAt(0).toUpperCase())}</div>
                <div class="contributor-name">
                  <button type="button" class="author-filter-btn" data-author="${safeAuthorAttr}" title="Filter games by ${safeAuthorAttr}" aria-label="Filter games by author ${safeAuthorAttr}">by @${safeGithub}</button>
                </div>
              </div>
              <button class="btn-play-trigger" data-id="${safeGameId}">${actionText}</button>
            </div>
          </div>
        </div>
        ${cardBackHtml}
      </div>
    `;

    if (window.ArcadeCardFlipManual) {
      window.ArcadeCardFlipManual.bindCard(card, game);
    }

    const ratingBadge = card.querySelector(".rating-badge");
    if (ratingBadge) {
      ratingBadge.style.cursor = "pointer";
      ratingBadge.title = "View ratings breakdown";
      ratingBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.RatingHistogram) window.RatingHistogram.openForGame(game);
      });
    }

    const favBtn = card.querySelector(".btn-card-favorite");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(game.id);
    });

    const playBtn = card.querySelector(".btn-play-trigger");
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openGameModal(game, playBtn);
    });

    // Direct author handle click filter
    const authorBtn = card.querySelector(".author-filter-btn");
    if (authorBtn) {
      authorBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const author = authorBtn.getAttribute("data-author") || game.author || game.github;
        if (searchInput) {
          if (currentCategory !== "all") {
            currentCategory = "all";
            categoryPills.forEach((p) => {
              const isAll = p.getAttribute("data-category") === "all";
              p.classList.toggle("active", isAll);
              p.setAttribute("aria-selected", isAll ? "true" : "false");
            });
          }
          if (currentLetterFilter !== "all") {
            currentLetterFilter = "all";
            if (typeof resetLetterFilterUI === "function") {
              resetLetterFilterUI();
            }
          }
          currentDurationFacet = "all";
          currentControlsFacet = "all";
          currentTagFilter = "";
          const durationChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
          durationChips.forEach((c) => c.classList.toggle("active", c.getAttribute("data-duration") === "all"));
          const controlsChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
          controlsChips.forEach((c) => c.classList.toggle("active", c.getAttribute("data-controls") === "all"));

          searchInput.value = author;
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          closeAutocomplete();
          setTimeout(closeAutocomplete, 50);
        }
        const catalogEl = document.getElementById("games-catalog") || document.getElementById("games");
        if (catalogEl) {
          catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    // Direct star rating click binding - 100% reliable, never triggers game modal
    const starBtns = card.querySelectorAll(".rate-star-btn");
    starBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const gameId = btn.dataset.game;
        const score = parseInt(btn.dataset.star, 10);
        if (window.GameRatings && gameId && score) {
          window.GameRatings.setGameRating(gameId, score);
          window.GameRatings.updateStarUI(gameId, score);
        }
      });
    });

    // Clicking any empty area of the rating row also stops modal launch
    const ratingRow = card.querySelector(".game-card-rating-row");
    if (ratingRow) {
      ratingRow.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    // Interactive Micro-Preview Particle Animation on Hover (#588)
    const previewCanvas = card.querySelector(".card-micro-preview-canvas");
    let microAnimId = null;
    let microParticles = [];

    card.addEventListener("pointerenter", () => {
      if (!previewCanvas) return;
      const pctx = previewCanvas.getContext("2d");
      if (!pctx) return;
      previewCanvas.style.opacity = "1";

      microParticles = [];
      const color = (game.category || "").toLowerCase().includes("action") ? "#ef4444" :
                    (game.category || "").toLowerCase().includes("puzzle") ? "#a855f7" :
                    (game.category || "").toLowerCase().includes("strategy") ? "#10b981" : "#38bdf8";

      for (let i = 0; i < 22; i++) {
        microParticles.push({
          x: Math.random() * previewCanvas.width,
          y: Math.random() * previewCanvas.height,
          vx: (Math.random() - 0.5) * 1.8,
          vy: (Math.random() - 0.5) * 1.8,
          size: Math.random() * 3 + 1,
          color: color
        });
      }

      const startTime = Date.now();
      function loopPreview() {
        if (Date.now() - startTime > 3000) {
          cancelAnimationFrame(microAnimId);
          return;
        }
        pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        pctx.fillStyle = color;
        for (const pt of microParticles) {
          pt.x += pt.vx;
          pt.y += pt.vy;
          if (pt.x < 0) pt.x = previewCanvas.width;
          if (pt.x > previewCanvas.width) pt.x = 0;
          if (pt.y < 0) pt.y = previewCanvas.height;
          if (pt.y > previewCanvas.height) pt.y = 0;

          pctx.beginPath();
          pctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          pctx.fill();
        }
        microAnimId = requestAnimationFrame(loopPreview);
      }
      loopPreview();
    });

    card.addEventListener("pointerleave", () => {
      if (microAnimId) {
        cancelAnimationFrame(microAnimId);
        microAnimId = null;
      }
      if (previewCanvas) {
        const pctx = previewCanvas.getContext("2d");
        if (pctx) pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCanvas.style.opacity = "0";
      }
    });

    return card;
  }

  function renderGames() {
    if (window.ArcadeFloor) window.ArcadeFloor.destroy();
    if (catalogVirtualGrid) {
      catalogVirtualGrid.destroy();
      catalogVirtualGrid = null;
    }
    gamesGrid.innerHTML = "";
    gamesGrid.classList.toggle("view-list", currentCatalogView === "list");
    const favs = getFavorites();

    const currentDataSet = GAMES_REGISTRY;

    const facetMatched = currentDataSet.filter((item) => {
      const matchesCategory = matchesCategoryFilter(item, currentCategory);

      // Tag Facet Filter
      let matchesTag = true;
      if (currentTagFilter) {
        matchesTag = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase() === currentTagFilter);
      }

      // Duration Facet Evaluation
      let matchesDuration = true;
      if (currentDurationFacet !== "all") {
        const text = (item.title + " " + item.category + " " + (item.description || "") + " " + (item.tags || []).join(" ")).toLowerCase();
        const isDeep = text.includes("adventure") || text.includes("rpg") || text.includes("story") || text.includes("survival") || text.includes("mystery") || text.includes("strategy") || text.includes("defense") || text.includes("roguelike") || text.includes("escape") || text.includes("horror");
        const isQuick = text.includes("fast") || text.includes("quick") || text.includes("reflex") || text.includes("speed") || text.includes("endless") || text.includes("runner") || text.includes("jumper") || text.includes("click") || text.includes("burst") || text.includes("whack") || text.includes("typing") || text.includes("breakout") || text.includes("tetris") || text.includes("snake") || text.includes("fall");

        if (currentDurationFacet === "quick") {
          matchesDuration = isQuick && !isDeep;
        } else if (currentDurationFacet === "long") {
          matchesDuration = isDeep;
        } else if (currentDurationFacet === "medium") {
          matchesDuration = (!isDeep && !isQuick) || (isDeep && isQuick) || text.includes("puzzle") || text.includes("logic") || text.includes("arcade");
        }
      }

      // Control Scheme Facet Evaluation
      let matchesControls = true;
      if (currentControlsFacet !== "all") {
        const text = (item.title + " " + item.category + " " + (item.description || "") + " " + (item.tags || []).join(" ")).toLowerCase();
        if (currentControlsFacet === "keyboard") {
          matchesControls = text.includes("keyboard") || text.includes("wasd") || text.includes("arrow") || text.includes("typing") || text.includes("runner") || text.includes("shooter") || text.includes("snake") || text.includes("space") || text.includes("racer") || text.includes("arcade") || text.includes("platformer") || text.includes("action");
        } else if (currentControlsFacet === "mouse") {
          matchesControls = text.includes("mouse") || text.includes("click") || text.includes("drag") || text.includes("puzzle") || text.includes("cards") || text.includes("minesweeper") || text.includes("point & click") || text.includes("burst") || text.includes("aim") || text.includes("slicing") || text.includes("wordle") || text.includes("connect");
        } else if (currentControlsFacet === "touch") {
          matchesControls = item.responsive === true || text.includes("touch") || text.includes("mobile") || text.includes("casual") || text.includes("swipe") || text.includes("click") || text.includes("tap") || text.includes("puzzle") || text.includes("memory") || text.includes("runner");
        }
      }

      // A-Z Alphabetical Title Jump Filter
      let matchesLetter = true;
      if (currentLetterFilter && currentLetterFilter !== "all") {
        const firstChar = item.title.trim().charAt(0).toUpperCase();
        if (currentLetterFilter === "#") {
          matchesLetter = !/[A-Z]/.test(firstChar);
        } else {
          matchesLetter = firstChar === currentLetterFilter;
        }
      }

      // Curated Mix Playlist Filter (#583)
      let matchesCuratedMix = true;
      if (currentMixFilter && Array.isArray(currentMixFilter)) {
        matchesCuratedMix = currentMixFilter.includes(item.id);
      }

      const matchesMultiTag = !window.ArcadeMultiTagFilter || window.ArcadeMultiTagFilter.matchesGame(item);

      return matchesCategory && matchesTag && matchesDuration && matchesControls && matchesLetter && matchesCuratedMix && matchesMultiTag;
    });

    const cleanSearch = searchQuery.replace(/^by\s+@?/, "").replace(/^@/, "").trim();
    const matchesExactSearch = (item) => {
      if (!searchQuery) return true;
      return (
        item.title.toLowerCase().includes(searchQuery) ||
        (item.description && item.description.toLowerCase().includes(searchQuery)) ||
        (item.author && item.author.toLowerCase().includes(searchQuery)) ||
        (cleanSearch && item.author && item.author.toLowerCase().includes(cleanSearch)) ||
        (item.github && item.github.toLowerCase().includes(searchQuery)) ||
        (cleanSearch && item.github && item.github.toLowerCase().includes(cleanSearch)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery)))
      );
    };

    let filtered = facetMatched.filter(matchesExactSearch);
    let isFuzzyFallback = false;

    // Fallback: If exact matches are empty and search query is at least 3 chars, match using Levenshtein distance <= 2 on titles and tags
    if (filtered.length === 0 && searchQuery && searchQuery.length >= 3) {
      filtered = facetMatched.filter((item) => matchesFuzzyLevenshtein(item, searchQuery));
      if (filtered.length > 0) {
        isFuzzyFallback = true;
      }
    }

    function getDifficultyRank(game) {
      if (!game) return 2;
      const raw = String(game.difficulty || "").toLowerCase().trim();
      if (raw.includes("easy") || raw.includes("beginner") || raw.includes("all skill") || raw.includes("casual")) return 1;
      if (raw.includes("hard") || raw.includes("advanced") || raw.includes("expert") || raw.includes("survival")) return 3;
      if (raw.includes("medium") || raw.includes("intermediate")) return 2;

      const text = (String(game.title || "") + " " + String(game.category || "") + " " + (Array.isArray(game.tags) ? game.tags.join(" ") : "") + " " + String(game.description || "")).toLowerCase();
      if (text.includes("easy") || text.includes("casual") || text.includes("relaxing") || text.includes("simple") || text.includes("calm") || text.includes("clicker")) return 1;
      if (text.includes("expert") || text.includes("hardcore") || text.includes("insane") || text.includes("complex") || text.includes("rpg") || text.includes("hard") || text.includes("survival") || text.includes("roguelike")) return 3;
      return 2;
    }

    function getGameReleaseTime(game) {
      if (!game) return 0;
      if (game.releaseDate) {
        const t = new Date(game.releaseDate).getTime();
        if (!isNaN(t)) return t;
      }
      return 0;
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      if (currentSort === "az") {
        return a.title.localeCompare(b.title);
      } else if (currentSort === "za") {
        return b.title.localeCompare(a.title);
      } else if (currentSort === "rating") {
        const rA = (window.GameRatings && window.GameRatings.ratings[a.id]) || (a.stars ? (a.stars / 10) : 5.0);
        const rB = (window.GameRatings && window.GameRatings.ratings[b.id]) || (b.stars ? (b.stars / 10) : 5.0);
        if (rB !== rA) return rB - rA;
        return a.title.localeCompare(b.title);
      } else if (currentSort === "newest") {
        const timeA = getGameReleaseTime(a);
        const timeB = getGameReleaseTime(b);
        if (timeB !== timeA) return timeB - timeA;
        return a.title.localeCompare(b.title);
      } else if (currentSort === "difficulty") {
        const diffA = getDifficultyRank(a);
        const diffB = getDifficultyRank(b);
        if (diffA !== diffB) return diffA - diffB;
        return a.title.localeCompare(b.title);
      } else if (currentSort === "difficulty-desc") {
        const diffA = getDifficultyRank(a);
        const diffB = getDifficultyRank(b);
        if (diffB !== diffA) return diffB - diffA;
        return a.title.localeCompare(b.title);
      } else {
        // "featured": featured items first, then by rating / title
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        const rA = (window.GameRatings && window.GameRatings.ratings[a.id]) || (a.stars ? (a.stars / 10) : 5.0);
        const rB = (window.GameRatings && window.GameRatings.ratings[b.id]) || (b.stars ? (b.stars / 10) : 5.0);
        if (rB !== rA) return rB - rA;
        return a.title.localeCompare(b.title);
      }
    });

    if (currentCatalogView === "floor" && window.ArcadeFloor) {
      updateResultsCount(filtered.length, isFuzzyFallback);
      updateFacetSummaryUI();
      window.ArcadeFloor.render(gamesGrid, filtered);
      announceToScreenReader(`Arcade floor updated. Showing ${filtered.length} cabinets.`);
      return;
    }

    // Handle Empty State with Fuzzy Smart Suggestions
    if (filtered.length === 0) {
      updateResultsCount(0);
      const emptyCard = document.createElement("div");
      emptyCard.className = "catalog-empty-state retro-arcade-terminal";

      if (currentCategory === "favorites") {
        if (favs.size === 0) {
          emptyCard.innerHTML = `
            <div class="retro-terminal-screen">
              <div class="retro-terminal-scanlines" aria-hidden="true"></div>
              <div class="retro-terminal-header">
                <div class="retro-terminal-dots" aria-hidden="true">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                </div>
                <span class="retro-terminal-badge">ARCADE-OS // FAVORITES</span>
                <span class="retro-terminal-tag">STATUS: EMPTY_VAULT</span>
              </div>
              <div class="retro-terminal-body">
                <div class="empty-state-icon" style="color: #f43f5e;"><i data-lucide="heart-crack"></i></div>
                <h3 class="empty-state-title">No Favorite Games Saved Yet</h3>
                <p class="empty-state-desc">
                  You haven't bookmarked any games yet! Click the heart icon on any game card in the catalog to add it to your personal favorites collection.
                </p>
                <div class="empty-state-actions">
                  <button type="button" class="btn btn-primary btn-sm btn-reset-filters" id="reset-filter-btn">
                    <span><i data-lucide="gamepad-2"></i> Browse All Games</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        } else {
          emptyCard.innerHTML = `
            <div class="retro-terminal-screen">
              <div class="retro-terminal-scanlines" aria-hidden="true"></div>
              <div class="retro-terminal-header">
                <div class="retro-terminal-dots" aria-hidden="true">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                </div>
                <span class="retro-terminal-badge">ARCADE-OS // FAVORITES</span>
                <span class="retro-terminal-tag">STATUS: 0 MATCHES</span>
              </div>
              <div class="retro-terminal-body">
                <div class="empty-state-icon" style="color: #f43f5e;"><i data-lucide="search-x"></i></div>
                <h3 class="empty-state-title">No Matching Favorites Found</h3>
                <p class="empty-state-desc">
                  None of your ${favs.size} saved favorite games match the current search query or active facet filters.
                </p>
                <div class="empty-state-actions">
                  <button type="button" class="btn btn-primary btn-sm" id="clear-fav-search-btn">
                    <span><i data-lucide="rotate-ccw"></i> Show All Favorites (${favs.size})</span>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm btn-reset-filters" id="reset-filter-btn">
                    <span><i data-lucide="gamepad-2"></i> Browse All Games</span>
                  </button>
                </div>
              </div>
            </div>
          `;
          const clearFavBtn = emptyCard.querySelector("#clear-fav-search-btn");
          if (clearFavBtn) {
            clearFavBtn.addEventListener("click", () => {
              searchQuery = "";
              currentTagFilter = "";
              currentDurationFacet = "all";
              currentControlsFacet = "all";
              currentLetterFilter = "all";
              resetLetterFilterUI();
              if (searchInput) searchInput.value = "";
              if (searchClearBtn) searchClearBtn.hidden = true;
              closeAutocomplete();
              const durationChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
              durationChips.forEach((c) => {
                if (c.getAttribute("data-duration") === "all") c.classList.add("active");
                else c.classList.remove("active");
              });
              const controlChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
              controlChips.forEach((c) => {
                if (c.getAttribute("data-controls") === "all") c.classList.add("active");
                else c.classList.remove("active");
              });
              renderGames();
            });
          }
        }
      } else {
        // Compute smart suggestions based on query and available game categories/tags
        let suggestions = getSmartSuggestions(searchQuery, currentCategory);
        if ((!suggestions || suggestions.length === 0) && window.PhoneticSearch) {
          suggestions = window.PhoneticSearch.findPhoneticSuggestions(searchQuery, GAMES_REGISTRY);
        }
        let suggestionsHtml = "";
        if (suggestions.length > 0) {
          suggestionsHtml = `
            <div class="smart-tag-suggestions">
              <span class="smart-suggestions-label">Did you mean:</span>
              <div class="smart-suggestions-list">
                ${suggestions.map(s => `<button type="button" class="smart-suggestion-chip" data-suggestion="${s}">${s}</button>`).join('')}
              </div>
            </div>
          `;
        }

        emptyCard.innerHTML = `
          <div class="retro-terminal-screen">
            <div class="retro-terminal-scanlines" aria-hidden="true"></div>
            <div class="retro-terminal-header">
              <div class="retro-terminal-dots" aria-hidden="true">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>
              <span class="retro-terminal-badge">ARCADE-OS // SYSTEM STATUS</span>
              <span class="retro-terminal-tag">STATUS: 0 MATCHES</span>
            </div>
            <div class="retro-terminal-body">
              <div class="arcade-joystick-graphic" aria-hidden="true">
                <svg class="retro-joystick-svg" viewBox="0 0 120 120" width="110" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="retroJoystickBallGlow" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stop-color="#ff7694" />
                      <stop offset="55%" stop-color="#f43f5e" />
                      <stop offset="100%" stop-color="#9f1239" />
                    </radialGradient>
                    <linearGradient id="retroJoystickShaft" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#cbd5e1" />
                      <stop offset="45%" stop-color="#f8fafc" />
                      <stop offset="100%" stop-color="#64748b" />
                    </linearGradient>
                    <linearGradient id="retroTerminalDeck" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#1e293b" />
                      <stop offset="100%" stop-color="#0f172a" />
                    </linearGradient>
                  </defs>
                  <!-- Arcade Control Deck Base -->
                  <rect x="10" y="76" width="100" height="34" rx="8" fill="url(#retroTerminalDeck)" stroke="#00f3ff" stroke-width="2" stroke-opacity="0.6" />
                  <line x1="16" y1="84" x2="104" y2="84" stroke="#00f3ff" stroke-opacity="0.25" stroke-dasharray="2 3" />
                  <!-- Screws / Rivets on Deck -->
                  <circle cx="16" cy="82" r="1.5" fill="#64748b" />
                  <circle cx="104" cy="82" r="1.5" fill="#64748b" />
                  <circle cx="16" cy="102" r="1.5" fill="#64748b" />
                  <circle cx="104" cy="102" r="1.5" fill="#64748b" />
                  <!-- Action Buttons on Right -->
                  <ellipse cx="80" cy="94" rx="6.5" ry="4.5" fill="#0891b2" stroke="#00f3ff" stroke-width="1.5" />
                  <ellipse cx="80" cy="92.5" rx="4.5" ry="2.8" fill="#22d3ee" />
                  <ellipse cx="96" cy="88" rx="6.5" ry="4.5" fill="#d97706" stroke="#fbbf24" stroke-width="1.5" />
                  <ellipse cx="96" cy="86.5" rx="4.5" ry="2.8" fill="#fde047" />
                  <!-- Joystick Washer / Dust Bezel -->
                  <ellipse cx="44" cy="84" rx="18" ry="7" fill="#020617" stroke="#334155" stroke-width="2" />
                  <ellipse cx="44" cy="84" rx="12" ry="4.5" fill="#0f172a" stroke="#00f3ff" stroke-width="1" stroke-opacity="0.4" />
                  <!-- Joystick Shaft / Stick -->
                  <path d="M41 82 L42 42 L46 42 L47 82 Z" fill="url(#retroJoystickShaft)" stroke="#475569" stroke-width="0.5" />
                  <!-- Joystick Ball Top Knob -->
                  <circle cx="44" cy="34" r="15" fill="url(#retroJoystickBallGlow)" />
                  <ellipse cx="39" cy="29" rx="4" ry="2.5" fill="#ffffff" opacity="0.65" transform="rotate(-30 39 29)" />
                </svg>
              </div>
              <h3 class="empty-state-title">No Games Found</h3>
              <p class="empty-state-desc">
                ${searchQuery ? `We couldn't find any games matching "${searchQuery}". Try exploring related categories or resetting all active filters.` : `No games matched the current filter combination. Reset your filters to explore the entire ArcadeVerse collection.`}
              </p>
              ${suggestionsHtml}
              <div class="empty-state-actions">
                <button type="button" class="btn btn-primary btn-reset-filters" id="reset-filter-btn" aria-label="Reset All Filters">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align: -2px; margin-right: 6px;">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  <span>Reset All Filters</span>
                </button>
                <a href="https://github.com/DebasmitaBose0/ArcadeVerse/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align: -2px; margin-right: 4px;">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                    <path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"/>
                  </svg>
                  <span>Build a Game</span>
                </a>
              </div>
            </div>
          </div>
        `;
      }

      // Category, search, and letter filter text come from the user, so set them as text, not markup.
      const emptyTitle = emptyCard.querySelector(".empty-state-title");
      if (emptyTitle && currentCategory !== "favorites") {
        if (searchQuery) {
          emptyTitle.textContent = `No games found matching "${searchQuery}"`;
        } else if (currentLetterFilter !== "all" && currentCategory === "all") {
          emptyTitle.textContent = `No games found starting with "${currentLetterFilter}"`;
        } else if (currentLetterFilter !== "all" && currentCategory !== "all") {
          emptyTitle.textContent = `No games found in "${currentCategory}" starting with "${currentLetterFilter}"`;
        } else if (currentCategory !== "all") {
          emptyTitle.textContent = `No games found in "${currentCategory}" category`;
        } else if (currentDurationFacet !== "all" || currentControlsFacet !== "all" || currentTagFilter) {
          emptyTitle.textContent = "No Games Found for Active Filters";
        } else {
          emptyTitle.textContent = "No Games Found";
        }
      }

      // Comprehensive Reset All Filters handler that instantly restores the full catalog
      function resetAllCatalogFilters() {
        searchQuery = "";
        currentCategory = "all";
        currentTagFilter = "";
        currentLetterFilter = "all";
        currentDurationFacet = "all";
        currentControlsFacet = "all";
        if (typeof resetLetterFilterUI === "function") {
          resetLetterFilterUI();
        }
        if (searchInput) searchInput.value = "";
        if (searchClearBtn) searchClearBtn.hidden = true;
        closeAutocomplete();
        categoryPills.forEach((p) => {
          const isAll = p.getAttribute("data-category") === "all";
          p.classList.toggle("active", isAll);
          p.setAttribute("aria-selected", isAll ? "true" : "false");
        });
        const durationChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
        durationChips.forEach((c) => {
          c.classList.toggle("active", c.getAttribute("data-duration") === "all");
        });
        const controlChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
        controlChips.forEach((c) => {
          c.classList.toggle("active", c.getAttribute("data-controls") === "all");
        });
        if (typeof buildTagChips === "function") {
          buildTagChips();
        }
        renderGames();
        syncURLState(false);
      }

      // Attach reset listener to all reset buttons in empty state
      emptyCard.querySelectorAll("#reset-filter-btn, #reset-all-filters-btn, .btn-reset-filters").forEach((btn) => {
        btn.addEventListener("click", resetAllCatalogFilters);
      });

      // Bind smart suggestion chip clicks
      emptyCard.querySelectorAll(".smart-suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const sug = chip.getAttribute("data-suggestion");
          if (sug) {
            // Check if suggestion is a category
            const matchingPill = Array.from(categoryPills).find(p => p.getAttribute("data-category").toLowerCase() === sug.toLowerCase());
            if (matchingPill) {
              categoryPills.forEach(p => p.classList.remove("active"));
              matchingPill.classList.add("active");
              currentCategory = matchingPill.getAttribute("data-category");
              searchQuery = "";
              if (searchInput) searchInput.value = "";
            } else {
              searchQuery = sug.toLowerCase();
              if (searchInput) searchInput.value = sug;
            }
            closeAutocomplete();
            renderGames();
            syncURLState(false);
          }
        });
      });

      gamesGrid.appendChild(emptyCard);
      updateFacetSummaryUI();
      if (window.lucide) lucide.createIcons();
      return;
    }

    updateResultsCount(filtered.length, isFuzzyFallback);

    // Windowed Grid Virtualization Engine (#1366)
    // Limits mounted DOM nodes to visible viewport + buffer rows (< 30 nodes for 125+ games)
    if (window.ArcadeVirtualGrid && typeof window.ArcadeVirtualGrid.create === "function") {
      catalogVirtualGrid = window.ArcadeVirtualGrid.create({
        container: gamesGrid,
        mode: currentCatalogView === "list" ? "list" : "grid",
        renderItem: (game) => createGameCardElement(game, favs),
        getItemKey: (game) => game.id
      });
      catalogVirtualGrid.init(gamesGrid, filtered);
    } else {
      // Fallback standard DOM rendering
      filtered.forEach((game) => {
        const card = createGameCardElement(game, favs);
        gamesGrid.appendChild(card);
      });
    }

    updateFacetSummaryUI();

    // Lightweight DOM Windowing / Virtualization for Catalog Cards (#590)
    // Ensures silky 60 FPS scrolling on mobile devices by checking IntersectionObserver
    if (window.IntersectionObserver) {
      const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (entry.isIntersecting) {
            el.classList.remove("card-virtual-hidden");
          } else {
            // Keep height spacer for off-screen cards
            el.classList.add("card-virtual-hidden");
          }
        });
      }, { rootMargin: "250px 0px" });

      const allCards = gamesGrid.querySelectorAll(".game-card");
      allCards.forEach((c) => cardObserver.observe(c));
    }

    // Assistive Screen Reader Notification for Catalog Filter/Search Updates (#513)
    if (typeof announceToScreenReader === "function") {
      const count = filtered.length;
      let filterDesc = [];
      if (currentCategory && currentCategory !== "all") filterDesc.push(`category "${currentCategory}"`);
      if (searchQuery) filterDesc.push(`matching "${searchQuery}"`);
      if (currentTagFilter) filterDesc.push(`tag "${currentTagFilter}"`);
      if (currentDurationFacet !== "all") filterDesc.push(`duration "${currentDurationFacet}"`);
      if (currentControlsFacet !== "all") filterDesc.push(`controls "${currentControlsFacet}"`);
      if (currentLetterFilter !== "all") filterDesc.push(`letter "${currentLetterFilter}"`);

      const descString = filterDesc.length > 0 ? ` for ${filterDesc.join(", ")}` : "";
      announceToScreenReader(`Catalog updated. Showing ${count} game${count === 1 ? "" : "s"}${descString}.`);
    }

    if (window.lucide) {
      lucide.createIcons();
    }
    if (window.PWACachePrewarmer && typeof window.PWACachePrewarmer.refreshBadges === "function") {
      window.PWACachePrewarmer.refreshBadges();
    }
  }

  // Global modal state variables
  let iframeLoadTimeout = null;
  let iframeLoadSucceeded = false;

  /**
   * Constructs an isolated game iframe URL with ?gameId= query parameter
   * for namespaced storage isolation (#493, #824).
   * @param {Object|string} gameObj - Game object from registry or path string
   * @returns {string} Fully qualified isolated URL
   */
  function buildIsolatedGameUrl(gameObj) {
    if (!gameObj) return "";
    const rawPath = typeof gameObj === "string" ? gameObj : (gameObj.path || "");
    const gameId = typeof gameObj === "object" && gameObj !== null ? gameObj.id : "";
    if (!rawPath) return "";
    if (gameId && !rawPath.includes("gameId=")) {
      return rawPath + (rawPath.includes("?") ? "&" : "?") + "gameId=" + encodeURIComponent(gameId);
    }
    return rawPath;
  }

  function resetIframeBoundary() {
    if (iframeLoadTimeout) {
      clearTimeout(iframeLoadTimeout);
      iframeLoadTimeout = null;
    }
    const existingError = document.getElementById("modal-error-boundary");
    if (existingError) existingError.remove();
    if (gameIframe) gameIframe.style.display = "block";
  }

  function triggerModalErrorBoundary(gameObj) {
    if (iframeLoadSucceeded) return;
    if (gameIframe) gameIframe.style.display = "none";
    let errorBoundary = document.getElementById("modal-error-boundary");
    if (!errorBoundary) {
      errorBoundary = document.createElement("div");
      errorBoundary.id = "modal-error-boundary";
      errorBoundary.className = "modal-error-boundary";
      const frameWrap = document.querySelector(".modal-frame-wrapper");
      if (frameWrap) frameWrap.appendChild(errorBoundary);
    }

    const isolatedUrl = buildIsolatedGameUrl(gameObj);
    const displayPath = (gameObj && gameObj.path) || (gameObj && gameObj.id) || "game route";

    errorBoundary.innerHTML = `
      <div class="boundary-content">
        <div class="boundary-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ff0055" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 class="boundary-title">Game Route Offline</h3>
        <p class="boundary-desc">
          Failed to establish connection to <code>${displayPath}</code>. The game entrypoint may be undergoing maintenance, corrupted, or unreachable.
        </p>
        <div class="boundary-actions">
          <button class="btn btn-primary btn-sm" id="boundary-retry-btn" aria-label="Retry loading game with storage isolation">
            <span>Retry Load</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="boundary-direct-btn" aria-label="Open isolated route directly">
            <span>Direct Route</span>
          </button>
          <a href="https://github.com/DebasmitaBose0/ArcadeVerse/issues/new" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" aria-label="Report broken route to project issues">
            <span>Report Broken Route</span>
          </a>
        </div>
      </div>
    `;

    const retryBtn = errorBoundary.querySelector("#boundary-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        resetIframeBoundary();
        iframeLoadSucceeded = false;
        if (gameIframe && gameObj) {
          showGameLoader();
          // Ensure storage isolation query parameter is preserved across retries (#878)
          const retryTargetUrl = buildIsolatedGameUrl(gameObj);
          gameIframe.src = retryTargetUrl || gameObj.path;
          if (newTabBtn) {
            newTabBtn.href = retryTargetUrl || gameObj.path;
          }
          startIframeTimeout(gameObj);
        }
      });
    }

    const directBtn = errorBoundary.querySelector("#boundary-direct-btn");
    if (directBtn) {
      directBtn.addEventListener("click", () => {
        if (isolatedUrl) {
          window.open(isolatedUrl, "_blank", "noopener,noreferrer");
        }
      });
    }
  }

  function triggerGameCrashBoundary(gameObj, errorDetails) {
    if (gameIframe) gameIframe.style.display = "none";
    let errorBoundary = document.getElementById("modal-error-boundary");
    if (!errorBoundary) {
      errorBoundary = document.createElement("div");
      errorBoundary.id = "modal-error-boundary";
      errorBoundary.className = "modal-error-boundary";
      const frameWrap = document.querySelector(".modal-frame-wrapper");
      if (frameWrap) frameWrap.appendChild(errorBoundary);
    }

    const errMessage = (errorDetails && errorDetails.message) || "Runtime execution halted.";
    const errStack = (errorDetails && errorDetails.stack) || "No diagnostic stack trace available.";

    errorBoundary.innerHTML = `
      <div class="boundary-content">
        <div class="boundary-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ff0055" stroke-width="2">
            <polygon points="12 2 2 22 22 22"></polygon>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <circle cx="12" cy="17" r="1" fill="#ff0055"></circle>
          </svg>
        </div>
        <h3 class="boundary-title">Game Runtime Crash Detected</h3>
        <p class="boundary-desc">
          An unhandled error occurred in <strong>${(gameObj && gameObj.title) || 'the game'}</strong>: <code>${escapeHTML(errMessage)}</code>
        </p>
        <details class="boundary-diagnostic-details">
          <summary>Diagnostic Error Dump</summary>
          <pre class="boundary-stack-pre"><code>${escapeHTML(errStack)}</code></pre>
        </details>
        <div class="boundary-actions">
          <button class="btn btn-primary btn-sm" id="boundary-restart-btn">
            <span>Restart Game</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="boundary-catalog-btn">
            <span>Return to Catalog</span>
          </button>
        </div>
      </div>
    `;

    const restartBtn = errorBoundary.querySelector("#boundary-restart-btn");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        resetIframeBoundary();
        iframeLoadSucceeded = false;
        if (gameIframe && gameObj) {
          gameIframe.src = buildIsolatedGameUrl(gameObj);
          startIframeTimeout(gameObj);
        }
      });
    }

    const catalogBtn = errorBoundary.querySelector("#boundary-catalog-btn");
    if (catalogBtn) {
      catalogBtn.addEventListener("click", () => {
        closeGameModal();
      });
    }
  }

  // Hook iframe error message broadcaster (#705 / #728)
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "ARCADEVERSE_GAME_CRASH") {
      triggerGameCrashBoundary(activeGame, event.data.error || { message: event.data.message, stack: event.data.stack });
    }
  });

  function startIframeTimeout(gameObj) {
    resetIframeBoundary();
    iframeLoadSucceeded = false;
    // Generous timeout (15s) to account for resource-heavy games or slower network environments
    iframeLoadTimeout = setTimeout(() => {
      if (!iframeLoadSucceeded) {
        triggerModalErrorBoundary(gameObj);
      }
    }, 15000);
  }

  // =========================================================================
  // SECURE IFRAME POSTMESSAGE ORIGIN VALIDATION & CRYPTOGRAPHIC HANDSHAKE (#489)
  // =========================================================================
  let activeGameSession = {
    token: null,
    gameId: null,
    startTime: 0,
    handshakeConfirmed: false,
    handshakeTimeoutId: null
  };

  /**
   * Resolves a trusted targetOrigin for hub-to-iframe postMessage transmissions (#884).
   * Strictly avoids wildcard '*' to prevent leaking session tokens, audio configs, or controller state
   * to untrusted origins if a frame redirects or navigates unexpectedly.
   */
  function getTrustedTargetOrigin() {
    try {
      if (window.location && window.location.origin && window.location.origin !== "null") {
        return window.location.origin;
      }
    } catch (_) {}
    return "*";
  }
  window.getTrustedTargetOrigin = getTrustedTargetOrigin;

  /**
   * Generates a cryptographically strong UUID or fallback random hexadecimal token
   */
  function generateSessionToken() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch (_) {}
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return "av_sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  /**
   * Validates whether an incoming postMessage originates from a verified source & origin
   * @param {MessageEvent} event
   * @returns {boolean}
   */
  function isValidGameMessage(event) {
    if (!event || !event.data || typeof event.data !== "object") return false;

    // 1. Strict Origin Verification:
    // If not local file:// protocol, enforce matching window.location.origin
    if (window.location.origin && window.location.origin !== "null") {
      const allowedOrigin = window.location.origin;
      if (event.origin && event.origin !== "null" && event.origin !== allowedOrigin) {
        console.warn(
          `[ArcadeVerse Security] Rejected message: origin mismatch. Expected "${allowedOrigin}", received "${event.origin}".`
        );
        return false;
      }
    }

    // 2. Strict Source Verification:
    // Message MUST originate from the active game iframe's contentWindow
    if (gameIframe && gameIframe.contentWindow) {
      if (event.source !== gameIframe.contentWindow) {
        console.warn("[ArcadeVerse Security] Rejected message: event.source does not match active gameIframe.contentWindow.");
        return false;
      }
    }

    // 3. Cryptographic Session Token Verification:
    // If an active session token exists, incoming game events must match the active token
    if (activeGameSession.token) {
      // Handshake initiation ACK or standard game events
      if (event.data.sessionToken && event.data.sessionToken !== activeGameSession.token) {
        console.warn(
          "[ArcadeVerse Security] Rejected message: sessionToken mismatch. Possible replay or cross-frame spoof attack."
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Dispatches AV_INIT_SESSION with a unique cryptographic session token to the child game iframe
   */
  function initiateGameIframeSession(game) {
    if (!gameIframe || !gameIframe.contentWindow) return;

    if (activeGameSession.handshakeTimeoutId) {
      clearTimeout(activeGameSession.handshakeTimeoutId);
      activeGameSession.handshakeTimeoutId = null;
    }

    const sessionToken = generateSessionToken();
    activeGameSession = {
      token: sessionToken,
      gameId: game ? game.id : null,
      startTime: Date.now(),
      handshakeConfirmed: false,
      handshakeTimeoutId: null
    };

    const targetOrigin = getTrustedTargetOrigin();

    // Dispatch cryptographically secured handshake challenge
    try {
      gameIframe.contentWindow.postMessage(
        {
          type: "AV_INIT_SESSION",
          sessionToken: sessionToken,
          gameId: game ? game.id : null,
          origin: targetOrigin,
          timestamp: Date.now()
        },
        targetOrigin
      );
    } catch (err) {
      console.warn("[ArcadeVerse Security] Error dispatching AV_INIT_SESSION:", err);
    }

    // Set a 3.5s timeout: if child game does not ACK (e.g. legacy game without SDK),
    // mark handshake as legacy compatible to prevent gameplay disruption
    activeGameSession.handshakeTimeoutId = setTimeout(() => {
      if (!activeGameSession.handshakeConfirmed) {
        // Tolerant fallback for games that don't bundle the SDK yet
        activeGameSession.handshakeConfirmed = true;
      }
    }, 3500);
  }

  // Bind the load / error listeners on the current game iframe. closeGameModal swaps in a fresh
  // iframe node, so this runs again for each new one.
  function bindGameIframeListeners() {
    const frame = gameIframe;
    if (!frame) return;

    frame.addEventListener("load", () => {
      // Ignore blanking resets
      if (frame !== gameIframe || !frame.src || frame.src.includes("about:blank")) return;

      iframeLoadSucceeded = true;
      resetIframeBoundary();
      frame.classList.add("loaded");
      guardIframeTouchInteractions();

      // Establish cryptographic session handshake with child game frame
      initiateGameIframeSession(activeGame);

      // Broadcast initial viewport metrics & aspect-ratio contract (#1182)
      broadcastViewportResize(true);

      try {
        if (window.SoundEngine && typeof window.SoundEngine.broadcastAudioConfig === "function") {
          window.SoundEngine.broadcastAudioConfig();
        } else if (gameIframe.contentWindow) {
          gameIframe.contentWindow.postMessage({
            type: "ARCADEVERSE_AUDIO_CONFIG",
            sessionToken: activeGameSession.token,
            muted: audioState.muted,
            volume: audioState.volume,
            gain: audioState.muted ? 0 : audioState.volume
          }, getTrustedTargetOrigin());
        }
      } catch (_) {}

      // Synchronize game simulation speed multiplier (#656)
      try {
        if (window.GameSpeedRegulator && typeof window.GameSpeedRegulator.broadcastSpeedConfig === "function") {
          window.GameSpeedRegulator.broadcastSpeedConfig();
        }
      } catch (_) {}
    });

    frame.addEventListener("error", () => {
      if (frame !== gameIframe) return;
      iframeLoadSucceeded = false;
      if (activeGame) {
        triggerModalErrorBoundary(activeGame);
      }
    });
  }
  bindGameIframeListeners();

  // =========================================================================
  // HUB-TO-GAME AV_RESIZE DISPATCH PROTOCOL & VIEWPORT SYNCHRONIZER (#1182)
  // =========================================================================
  let resizeDebounceTimer = null;
  function broadcastViewportResize(immediate = false) {
    if (!gameModal || !gameModal.classList.contains("active") || !activeGame || !gameIframe || !gameIframe.contentWindow) {
      return;
    }

    const doBroadcast = () => {
      try {
        const wrapper = modalFrameWrapper || (gameIframe && gameIframe.parentElement) || gameIframe;
        const rect = (wrapper && typeof wrapper.getBoundingClientRect === "function")
          ? wrapper.getBoundingClientRect()
          : { width: wrapper.clientWidth || 800, height: wrapper.clientHeight || 600 };

        const width = Math.round(rect.width || (wrapper && wrapper.clientWidth) || 800);
        const height = Math.round(rect.height || (wrapper && wrapper.clientHeight) || 600);
        const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || (modalWindow && (modalWindow.classList.contains("fullscreen") || modalWindow.classList.contains("pseudo-fullscreen"))));
        const orientation = width >= height ? "landscape" : "portrait";

        const payload = {
          width: width,
          height: height,
          clientWidth: (wrapper && wrapper.clientWidth) || width,
          clientHeight: (wrapper && wrapper.clientHeight) || height,
          dpr: dpr,
          isFullscreen: isFullscreen,
          orientation: orientation,
          aspectRatio: height > 0 ? (width / height) : 1
        };

        const targetOrigin = (window.location && window.location.origin && window.location.origin !== "null") ? window.location.origin : "*";
        gameIframe.contentWindow.postMessage({
          type: "AV_RESIZE",
          sessionToken: (activeGameSession && activeGameSession.token) ? activeGameSession.token : null,
          payload: payload,
          width: width,
          height: height,
          dpr: dpr,
          isFullscreen: isFullscreen,
          orientation: orientation
        }, targetOrigin);

        window.dispatchEvent(new CustomEvent("arcadeverse:modal-resize", { detail: payload }));
      } catch (err) {
        console.warn("[ArcadeVerse] Error broadcasting AV_RESIZE:", err);
      }
    };

    if (immediate) {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
      doBroadcast();
    } else {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = setTimeout(doBroadcast, 100);
    }
  }

  // Active ResizeObserver on modalFrameWrapper (#1182)
  if (typeof ResizeObserver !== "undefined" && modalFrameWrapper) {
    const modalResizeObserver = new ResizeObserver(() => {
      if (gameModal && gameModal.classList.contains("active") && activeGame) {
        broadcastViewportResize(false);
      }
    });
    modalResizeObserver.observe(modalFrameWrapper);
  }

  // =========================================================================
  // TOP-LEVEL NAVIGATION GUARD & ROGUE SCRIPT PROTECTION (#492)
  // =========================================================================
  let isGameSessionActive = false;

  /**
   * Browser navigation guard while a game modal session is active
   * Prevents rogue iframe scripts or accidental redirects from abandoning gameplay
   */
  function handleGameBeforeUnload(e) {
    if (!isGameSessionActive) return;
    const confirmationMessage = "An arcade game is currently running in ArcadeVerse. Are you sure you want to leave?";
    e.preventDefault();
    e.returnValue = confirmationMessage;
    return confirmationMessage;
  }

  // Intercept window top-level frame redirection attempts
  window.addEventListener("beforeunload", handleGameBeforeUnload);

  // Monitor iframe sandbox violations or framebusting attempts
  window.addEventListener("securitypolicyviolation", (e) => {
    if (e && e.violatedDirective && e.violatedDirective.includes("frame")) {
      console.warn("[ArcadeVerse Security Sandbox] Trapped policy boundary event:", e.blockedURI);
    }
  });

  // Modal rapid launch lock flag & cooldown timer to prevent race conditions (#504)
  let isOpeningModal = false;
  let modalLaunchCooldownTimer = null;
  let closeModalCleanupTimer = null;

  // Screen Wake Lock Controller (#700, #723)
  // Keeps screen awake during active gameplay sessions on mobile devices
  let screenWakeLock = null;

  async function requestScreenWakeLock() {
    if (!("wakeLock" in navigator) || typeof navigator.wakeLock.request !== "function") return;
    try {
      if (!screenWakeLock) {
        screenWakeLock = await navigator.wakeLock.request("screen");
        screenWakeLock.addEventListener("release", () => {
          screenWakeLock = null;
        });
      }
    } catch (_) {
      screenWakeLock = null;
    }
  }

  async function releaseScreenWakeLock() {
    if (screenWakeLock) {
      try {
        await screenWakeLock.release();
      } catch (_) {}
      screenWakeLock = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (gameModal && gameModal.classList.contains("active")) {
        requestScreenWakeLock();
      }
    } else {
      releaseScreenWakeLock();
    }
  });

  window.addEventListener("pagehide", () => {
    releaseScreenWakeLock();
  });

  // Modal Handlers
  // Restore the catalog's namespaced storage URL bridge (#493, #824, #878).
  // Ensures that whenever games are launched, retried from error boundaries, or
  // opened in new tabs, the ?gameId= URL query parameter is strictly preserved.
  // This allows SDK localStorage proxies to namespace keys correctly and prevent
  // key collisions or shared quota consumption across different arcade games.
  function buildIsolatedGameUrl(game) {
    if (!game) return "";
    let rawPath = "";
    let gameId = "";

    if (typeof game === "string") {
      rawPath = game;
      try {
        const parsed = new URL(rawPath, document.baseURI);
        gameId = parsed.searchParams.get("gameId") || "";
      } catch (_) {}
    } else if (typeof game === "object") {
      rawPath = game.path || "";
      gameId = game.id || "";
    }

    if (!rawPath) return "";

    try {
      const url = new URL(rawPath, document.baseURI);
      if (gameId && !url.searchParams.has("gameId")) {
        url.searchParams.set("gameId", gameId);
      }
      return url.href;
    } catch (err) {
      console.warn("[ArcadeVerse:Isolation] Failed to format isolated game URL:", err);
      return rawPath;
    }
  }

  // The shared sound engine owns preferences; keep legacy modal/SDK callers
  // working even when the optional multi-channel mixer is not installed.
  function syncAudioPreferences(muted) {
    const engine = window.SoundEngine;
    if (!engine) return { muted: true, volume: 0 };
    if (typeof muted === "boolean" && typeof engine.setMuted === "function") engine.setMuted(muted);
    return { muted: !engine.enabled, volume: Number.isFinite(engine.volume) ? Math.max(0, Math.min(1, engine.volume)) : 0 };
  }

  function broadcastVolumeSyncToGame(muted, volume) {
    if (!gameIframe || !gameIframe.contentWindow) return;
    gameIframe.contentWindow.postMessage(
      { type: "ARCADEVERSE_VOLUME_SYNC", sessionToken: activeGameSession.token, muted, volume, gain: muted ? 0 : volume },
      getTrustedTargetOrigin()
    );
  }

  function openGameModal(game, triggerElement = null, isDirectDeepLink = false) {
    if (!game) return;

    // Guard against rapid duplicate clicks (400ms debounce guard)
    if (isOpeningModal) {
      console.warn(`[ArcadeVerse:Modal] Blocked duplicate rapid launch for: ${game.id}`);
      return;
    }
    isOpeningModal = true;
    document.body.classList.add("modal-launching-in-progress");

    // Cancel any in-flight close cleanup that could rebind or blank the iframe mid-relaunch
    if (closeModalCleanupTimer) { clearTimeout(closeModalCleanupTimer); closeModalCleanupTimer = null; }

    // Clear any previous cooldown
    if (modalLaunchCooldownTimer) clearTimeout(modalLaunchCooldownTimer);
    modalLaunchCooldownTimer = setTimeout(() => {
      isOpeningModal = false;
      document.body.classList.remove("modal-launching-in-progress");
    }, 450);

    flushScratchpadSave();
    activeGame = game;
    loadScratchpadGame(game);
    isGameSessionActive = true;
    gameSessionStartTime = Date.now();
    isConfirmingQuit = false;

    // LRU Game Cache Manager record play touch (#556)
    if (window.AvGameLruCacheManager) {
      window.AvGameLruCacheManager.recordGamePlay(game.id);
    }
    hideQuitConfirmationModal();
    if (typeof resetActiveMutatorSession === "function") {
      resetActiveMutatorSession();
    }
    lastFocusedElement = triggerElement || document.activeElement;

    // Trigger bat animation if launching a Halloween Special Game
    if (isHalloweenGame(game) && typeof window.triggerHalloweenBatAnimation === "function") {
      window.triggerHalloweenBatAnimation(game);
    }

    modalGameTitle.textContent = game.title;
    modalGameBadge.textContent = game.category;
    modalGameAuthor.textContent = `Built by @${game.author}`;
    lastAnnouncedScore = 0;
    lastScoreAnnouncementTime = Date.now();
    if (typeof announceToScreenReader === "function") {
      announceToScreenReader(`Now playing ${game.title}. Category: ${game.category}. Built by ${game.author}. Press Escape to pause or exit.`);
    }
    if (window.ArcadeAnnouncer && typeof window.ArcadeAnnouncer.announce === "function") {
      window.ArcadeAnnouncer.announce("Ready Player One");
    }
    startIframeTimeout(game);

    // Storage Isolation Bridge: Pass gameId via URL parameter so SDK attaches namespaced proxy (#493, #824)
    const iframeUrl = buildIsolatedGameUrl(game);
    gameIframe.src = iframeUrl;
    if (newTabBtn) {
      newTabBtn.href = iframeUrl;
    }

    updateModalFavoriteButton(isFavorite(game.id));
    if (window.SoundEngine && typeof window.SoundEngine.updateUI === "function") {
      window.SoundEngine.updateUI();
    }
    if (window.GameSpeedRegulator && typeof window.GameSpeedRegulator.mountControls === "function") {
      window.GameSpeedRegulator.mountControls();
    }
    if (window.ArcadeDDA) {
      if (typeof window.ArcadeDDA.mountControls === "function") {
        window.ArcadeDDA.mountControls();
      }
      if (typeof window.ArcadeDDA.reset === "function") {
        window.ArcadeDDA.reset();
      }
    }

    // Monitor game frame lifecycle and attach watchdog
    try {
      if (gameIframe) {
        gameIframe.addEventListener('load', () => {
          try {
            const win = gameIframe.contentWindow;
            if (win && win.ArcadeVerse && typeof win.ArcadeVerse.enableAggressiveRAFShield === 'function') {
              win.ArcadeVerse.enableAggressiveRAFShield();
            }
          } catch (_) {}
        }, { once: true });
      }
    } catch (_) {}

    // Record game play in Recently Played drawer
    if (window.ArcadeRecent && typeof window.ArcadeRecent.recordPlayed === "function") {
      window.ArcadeRecent.recordPlayed(game.id, game.title, game.category);
    }
    window.dispatchEvent(new CustomEvent("arcadeverse:game-launched", { detail: game }));

    // Mount animation class to prevent visual tearing
    modalFrameWrapper.classList.add("is-mounting");
    setTimeout(() => {
      modalFrameWrapper.classList.remove("is-mounting");
    }, 350);

    gameModal.classList.add("active");
    gameModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    // Focus Trap Activation: automatically focus close button or iframe canvas
    if (closeModalBtn) {
      setTimeout(() => closeModalBtn.focus(), 50);
    }

    checkOrientationLandscapePrompt(game);

    // "Players Also Played" Intelligent Recommendation Strip in Modal Footer (#591)
    if (typeof renderModalRecommendations === "function") renderModalRecommendations(game);

    if (!isDirectDeepLink) {
      modalPushedHistory = true;
      syncURLState(true);
    } else {
      modalPushedHistory = false;
      syncURLState(false);
    }
  }

  // Expose global helper to open game modal from plugins, search, or recent drawer
  window.openGameModal = openGameModal;
  window.ArcadeApp = {
    openGame: (gameId) => {
      const game = GAMES_REGISTRY.find((g) => g.id === gameId);
      if (game) {
        openGameModal(game);
        return true;
      }
      return false;
    },
    launchRandom: () => {
      launchRandomGame();
    },
    filterFavorites: () => {
      categoryPills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      const favPill = document.querySelector('.category-pills .pill[data-category="favorites"]');
      if (favPill) {
        favPill.classList.add("active");
        favPill.setAttribute("aria-selected", "true");
      }
      currentCategory = "favorites";
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      if (searchClearBtn) searchClearBtn.hidden = true;
      closeAutocomplete();
      renderGames();
      syncURLState(false);
    }
  };

  window.ArcadeFavorites = {
    getFavorites: () => Array.from(getFavorites()),
    isFavorite,
    toggleFavorite,
    count: () => getFavorites().size
  };

  /**
   * Request modal dismissal with score protection check (#503)
   * If game session > 15s, prompt confirmation before discarding session
   * @param {boolean} isFromPopState
   * @param {boolean} bypassConfirmation
   */
  function requestModalClose(isFromPopState = false, bypassConfirmation = false) {
    if (!gameModal || (!gameModal.classList.contains("active") && !activeGame)) return;

    const sessionDurationSec = gameSessionStartTime ? (Date.now() - gameSessionStartTime) / 1000 : 0;
    if (!bypassConfirmation && sessionDurationSec >= 15 && !isConfirmingQuit) {
      showQuitConfirmationModal(isFromPopState);
      return;
    }

    hideQuitConfirmationModal();
    closeControlsLegend();
    closeGameModal(isFromPopState);
  }

  function showQuitConfirmationModal(isFromPopState = false) {
    isConfirmingQuit = true;
    let quitDialog = document.getElementById("game-quit-confirmation-dialog");
    if (!quitDialog) {
      quitDialog = document.createElement("div");
      quitDialog.id = "game-quit-confirmation-dialog";
      quitDialog.className = "game-quit-dialog-backdrop";
      quitDialog.setAttribute("role", "alertdialog");
      quitDialog.setAttribute("aria-modal", "true");
      quitDialog.setAttribute("aria-labelledby", "quit-dialog-title");
      quitDialog.setAttribute("aria-describedby", "quit-dialog-desc");
      quitDialog.innerHTML = `
        <div class="game-quit-dialog-card">
          <div class="game-quit-dialog-header">
            <svg class="quit-warning-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3 id="quit-dialog-title">Quit Current Game Session?</h3>
          </div>
          <p id="quit-dialog-desc">You have an active gameplay session running. Any unsubmitted high scores or session progress will be lost if you return to the catalog.</p>
          <div class="game-quit-dialog-actions">
            <button id="btn-quit-keep-playing" type="button" class="btn-quit-action keep-playing" autofocus>Keep Playing</button>
            <button id="btn-quit-confirm-exit" type="button" class="btn-quit-action confirm-exit">Quit to Catalog</button>
          </div>
        </div>
      `;
      modalWindow.appendChild(quitDialog);

      quitDialog.querySelector("#btn-quit-keep-playing").addEventListener("click", () => {
        hideQuitConfirmationModal();
        announceToScreenReader("Game resumed.");
        if (gameIframe && gameIframe.contentWindow) {
          try {
            gameIframe.contentWindow.focus();
            gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_RESUME" }, getTrustedTargetOrigin());
          } catch (_) { }
        }
      });

      quitDialog.querySelector("#btn-quit-confirm-exit").addEventListener("click", () => {
        hideQuitConfirmationModal();
        closeGameModal(isFromPopState);
      });
    }

    quitDialog.classList.add("active");
    announceToScreenReader("Game paused. Quit confirmation dialog opened. Choose Keep Playing or Quit to Catalog.");
    const keepPlayingBtn = quitDialog.querySelector("#btn-quit-keep-playing");
    if (keepPlayingBtn) {
      setTimeout(() => keepPlayingBtn.focus(), 50);
    }

    // Pause game runtime while confirmation prompt is open
    announceToScreenReader("Game paused.");
    if (gameIframe && gameIframe.contentWindow) {
      try {
        gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_PAUSE" }, getTrustedTargetOrigin());
      } catch (_) { }
    }
  }

  function hideQuitConfirmationModal() {
    isConfirmingQuit = false;
    const quitDialog = document.getElementById("game-quit-confirmation-dialog");
    if (quitDialog) {
      quitDialog.classList.remove("active");
    }
  }

  /**
   * Performs a comprehensive tear-down of child iframe resources (RAF handles, timers, and WebGL contexts).
   * Dynamically probes active RAF ID to ensure multi-minute (or high-refresh-rate 120Hz/144Hz) sessions
   * with >10,000 scheduled frames are safely cancelled, avoiding memory leaks and orphaned worker loops (#879).
   */
  function terminateChildIframeResources(iframe) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      const win = iframe.contentWindow;
      // 1. Post lifecycle shutdown signals to compliant game runtimes
      win.postMessage({ type: "ARCADEVERSE_PAUSE" }, "*");
      win.postMessage({ type: "ARCADEVERSE_TEARDOWN" }, "*");

      // 2. Dynamically probe and sweep active requestAnimationFrame handles
      if (typeof win.cancelAnimationFrame === "function") {
        if (typeof win.requestAnimationFrame === "function") {
          const maxFrameId = win.requestAnimationFrame(() => {});
          win.cancelAnimationFrame(maxFrameId);
          if (typeof maxFrameId === "number" && maxFrameId > 0) {
            // Sweeps downward up to 60,000 frames or down to 1
            const sweepFloor = Math.max(1, maxFrameId - 60000);
            for (let frameId = maxFrameId; frameId >= sweepFloor; frameId--) {
              win.cancelAnimationFrame(frameId);
            }
          }
        } else {
          for (let frameId = 1; frameId <= 1000; frameId++) {
            win.cancelAnimationFrame(frameId);
          }
        }
      }

      // 3. Clear active timeouts and intervals left by runaway loops
      if (typeof win.clearTimeout === "function" && typeof win.clearInterval === "function") {
        const maxTimerId = win.setTimeout(() => {}, 0);
        if (typeof maxTimerId === "number" && maxTimerId > 0) {
          const timerFloor = Math.max(1, maxTimerId - 20000);
          for (let timerId = maxTimerId; timerId >= timerFloor; timerId--) {
            win.clearTimeout(timerId);
            win.clearInterval(timerId);
          }
        }
      }

      // 4. Proactively probe and dispose WebGL contexts in child iframe if accessible
      try {
        const doc = iframe.contentDocument || win.document;
        if (doc) {
          if (window.ArcadeVerseWebGL && typeof window.ArcadeVerseWebGL.disposeAllCanvases === "function") {
            window.ArcadeVerseWebGL.disposeAllCanvases(doc);
          } else if (window.ArcadeWebGLDisposal && typeof window.ArcadeWebGLDisposal.disposeAllCanvases === "function") {
            window.ArcadeWebGLDisposal.disposeAllCanvases(doc);
          } else {
            const canvases = doc.querySelectorAll("canvas");
            canvases.forEach((c) => {
              try {
                const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
                if (gl && !gl.isContextLost()) {
                  const loseExt = gl.getExtension("WEBGL_lose_context") ||
                    gl.getExtension("WEBKIT_WEBGL_lose_context") ||
                    gl.getExtension("MOZ_WEBGL_lose_context");
                  if (loseExt && typeof loseExt.loseContext === "function") {
                    loseExt.loseContext();
                  }
                }
              } catch (_) {}
            });
          }
        }
      } catch (_) {}

      // 5. Abort network or lingering worker tasks if available
      if (typeof win.stop === "function") {
        win.stop();
      }
    } catch (_) {}
  }

  function closeGameModal(isFromPopState = false) {
    if (!gameModal || (!gameModal.classList.contains("active") && !activeGame)) return;
    if (typeof resetActiveMutatorSession === "function") {
      resetActiveMutatorSession();
    }
    activeGame = null;
    isGameSessionActive = false;
    // Stop the 15s load timer so a game closed mid load does not raise the error screen later
    resetIframeBoundary();
    gameModal.classList.remove("active");
    gameModal.setAttribute("aria-hidden", "true");
    window.dispatchEvent(new CustomEvent("arcadeverse:game-closed", { detail: closedGame }));
    if (newTabBtn) {
      newTabBtn.href = "#";
    }

    // Standardized Game Lifecycle Bridge: Dispatch teardown & pause events before unmounting iframe
    try {
      if (gameIframe && gameIframe.contentWindow) {
        const trustedOrigin = getTrustedTargetOrigin();
        gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_PAUSE" }, trustedOrigin);
        gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_TEARDOWN" }, trustedOrigin);

        // Aggressive RAF and Timer Leak Mitigation (#497)
        try {
          const win = gameIframe.contentWindow;
          if (win) {
            // Dynamically discover and cancel active animation frame handles (#497, #825)
            if (typeof win.cancelAnimationFrame === "function") {
              if (typeof win.requestAnimationFrame === "function") {
                const maxFrameId = win.requestAnimationFrame(() => {});
                win.cancelAnimationFrame(maxFrameId);
                if (typeof maxFrameId === "number" && maxFrameId > 0) {
                  const minFrameId = Math.max(1, maxFrameId - 50000);
                  for (let frameId = maxFrameId; frameId >= minFrameId; frameId--) {
                    win.cancelAnimationFrame(frameId);
                  }
                }
              } else {
                for (let frameId = 1; frameId <= 1000; frameId++) {
                  win.cancelAnimationFrame(frameId);
                }
              }
            }
            // Clear any active timeouts/intervals left by rogue loops
            if (typeof win.clearTimeout === "function" && typeof win.clearInterval === "function") {
              const maxTimerId = win.setTimeout(() => {}, 0);
              for (let timerId = 1; timerId <= maxTimerId; timerId++) {
                win.clearTimeout(timerId);
                win.clearInterval(timerId);
              }
            }
          }
        } catch (_) {}

        // Proactively probe and dispose WebGL contexts in child iframe if accessible
        try {
          const doc = gameIframe.contentDocument || gameIframe.contentWindow.document;
          if (doc) {
            if (window.ArcadeVerseWebGL && typeof window.ArcadeVerseWebGL.disposeAllCanvases === "function") {
              window.ArcadeVerseWebGL.disposeAllCanvases(doc);
            } else if (window.ArcadeWebGLDisposal && typeof window.ArcadeWebGLDisposal.disposeAllCanvases === "function") {
              window.ArcadeWebGLDisposal.disposeAllCanvases(doc);
            } else {
              const canvases = doc.querySelectorAll("canvas");
              canvases.forEach((c) => {
                try {
                  const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
                  if (gl && !gl.isContextLost()) {
                    const loseExt = gl.getExtension("WEBGL_lose_context") ||
                                    gl.getExtension("WEBKIT_WEBGL_lose_context") ||
                                    gl.getExtension("MOZ_WEBGL_lose_context");
                    if (loseExt && typeof loseExt.loseContext === "function") {
                      loseExt.loseContext();
                    }
                  }
                } catch (_) {}
              });
            }
          }
        } catch (_) {}
      }
    } catch (_) { }
    
    // Terminate any rogue event listeners or workers in child frame prior to blanking
    try {
      if (gameIframe && gameIframe.contentWindow) {
        const win = gameIframe.contentWindow;
        if (typeof win.stop === "function") {
          win.stop();
        }
      }
    } catch (_) {}

    // Safely blank out iframe after a 100ms grace period to allow games to close AudioContexts and finalize teardown
    const currentFrame = gameIframe;
    closeModalCleanupTimer = setTimeout(() => {
      closeModalCleanupTimer = null;
      try {
        if (currentFrame && currentFrame.contentWindow) {
          const win = currentFrame.contentWindow;
          // Final fallback sweep before replacing location
          if (typeof win.cancelAnimationFrame === "function" && typeof win.requestAnimationFrame === "function") {
            const probeId = win.requestAnimationFrame(() => {});
            win.cancelAnimationFrame(probeId);
            const floor = Math.max(1, probeId - 1000);
            for (let id = probeId; id >= floor; id--) {
              win.cancelAnimationFrame(id);
            }
          }
          currentFrame.contentWindow.location.replace("about:blank");
        } else if (currentFrame) {
          currentFrame.src = "about:blank";
        }
      } catch (e) {
        if (currentFrame) currentFrame.src = "about:blank";
      }

      // Reconstruct clean iframe node to sever all zombie closures and DOM leaks
      try {
        if (currentFrame && currentFrame.parentNode) {
          const parent = currentFrame.parentNode;
          const newIframe = document.createElement("iframe");
          newIframe.id = currentFrame.id;
          newIframe.className = currentFrame.className;
          newIframe.setAttribute("title", currentFrame.getAttribute("title") || "Arcade Game Screen");
          newIframe.setAttribute("loading", "lazy");
          newIframe.setAttribute("allow", "gamepad; autoplay; fullscreen");
          if (currentFrame.hasAttribute("sandbox")) newIframe.setAttribute("sandbox", currentFrame.getAttribute("sandbox"));
          newIframe.src = "about:blank";
          parent.replaceChild(newIframe, currentFrame);
          // The reference and listeners must follow the new node, otherwise the next game
          // is loaded into a detached iframe and never shows
          gameIframe = newIframe;
          bindGameIframeListeners();
        }
      } catch (_) {}
    }, 100);

    cancelPlayTimer();
    if (window.ArcadeAudioBeacon && typeof window.ArcadeAudioBeacon.stopRadar === 'function') {
      window.ArcadeAudioBeacon.stopRadar();
    }
    document.body.style.overflow = "";
    document.body.style.overscrollBehavior = "";
    if (gameIframe) gameIframe.style.touchAction = "";
    const modalBodyReset = document.querySelector(".game-modal-body") || modalFrameWrapper;
    if (modalBodyReset) modalBodyReset.style.touchAction = "";
    document.body.classList.remove("modal-launching-in-progress");
    isOpeningModal = false;
    modalWindow.classList.remove("fullscreen");
    if (gameModal) gameModal.classList.remove("fullscreen-mode");
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
    // Restore focus to triggering card or cached activeElement upon closing (#736)
    const restoreFocus = () => {
      if (elementToRestore && typeof elementToRestore.focus === "function" && document.body.contains(elementToRestore)) {
        try {
          elementToRestore.focus();
          return;
        } catch (_) {}
      }
      if (closedGameId) {
        if (window.ArcadeFloor && window.ArcadeFloor.focusGame(closedGameId)) return;
        const fallbackEl = document.querySelector(`.game-card[data-game-id="${closedGameId}"] .btn-play-trigger`) ||
                           document.querySelector(`.game-card[data-game-id="${closedGameId}"]`);
        if (fallbackEl && typeof fallbackEl.focus === "function") {
          try {
            fallbackEl.focus();
          } catch (_) {}
        }
      }
    };
    restoreFocus();
    setTimeout(restoreFocus, 50);

    if (isFromPopState) {
      modalPushedHistory = false;
    } else {
      if (modalPushedHistory) {
        modalPushedHistory = false;
        try {
          window.history.back();
        } catch (_) {
          syncURLState(false);
        }
      } else {
        syncURLState(false);
      }
    }
  }

  closeModalBtn.addEventListener("click", () => requestModalClose(false));
  modalOverlay.addEventListener("click", () => requestModalClose(false));

  let scratchpadSaveTimer = null;
  let scratchpadHideTimer = null;
  let scratchpadTrigger = scratchpadBtn;
  let scratchpadGameStartTime = 0;

  function getScratchpadStorageKey(gameId) {
    return `arcadeverse_notes_${gameId}`;
  }

  function setScratchpadStatus(message) {
    if (scratchpadStatus) scratchpadStatus.textContent = message;
  }

  function updateScratchpadIndicator(notes) {
    if (!scratchpadBtn) return;
    const hasNotes = Boolean(notes && notes.trim());
    scratchpadBtn.dataset.hasNotes = hasNotes ? "true" : "false";
    scratchpadBtn.setAttribute("aria-label", hasNotes ? "Open Strategy Scratchpad, notes saved" : "Open Strategy Scratchpad");
  }

  function flushScratchpadSave() {
    if (scratchpadSaveTimer) {
      clearTimeout(scratchpadSaveTimer);
      scratchpadSaveTimer = null;
    }
    if (!activeGame || !scratchpadNotes) return;

    const notes = scratchpadNotes.value;
    const key = getScratchpadStorageKey(activeGame.id);
    if (!window.ArcadeStorageResilience || !window.ArcadeStorageResilience.safeSetItem(key, notes)) {
      setScratchpadStatus("Unable to save notes locally");
      return;
    }
    updateScratchpadIndicator(notes);
    setScratchpadStatus("Saved locally per game");
  }

  function scheduleScratchpadSave() {
    if (scratchpadSaveTimer) clearTimeout(scratchpadSaveTimer);
    if (!activeGame || !scratchpadNotes) return;

    const key = getScratchpadStorageKey(activeGame.id);
    const gameId = activeGame.id;
    const notes = scratchpadNotes.value;
    setScratchpadStatus("Saving...");
    scratchpadSaveTimer = setTimeout(() => {
      scratchpadSaveTimer = null;
      if (!window.ArcadeStorageResilience || !window.ArcadeStorageResilience.safeSetItem(key, notes)) {
        setScratchpadStatus("Unable to save notes locally");
        return;
      }
      if (activeGame && activeGame.id === gameId) {
        updateScratchpadIndicator(notes);
        setScratchpadStatus("Saved locally per game");
      }
    }, 300);
  }

  function loadScratchpadGame(game) {
    if (!game || !scratchpadNotes) return;
    scratchpadGameStartTime = Date.now();
    if (scratchpadTitle) scratchpadTitle.textContent = game.title;
    try {
      scratchpadNotes.value = localStorage.getItem(getScratchpadStorageKey(game.id)) || "";
      updateScratchpadIndicator(scratchpadNotes.value);
      setScratchpadStatus("Saved locally per game");
    } catch (error) {
      scratchpadNotes.value = "";
      updateScratchpadIndicator("");
      setScratchpadStatus("Local storage is unavailable");
      console.warn("[ArcadeVerse Scratchpad] Unable to load game notes:", error);
    }
    const clearConfirm = document.getElementById("scratchpad-clear-confirm");
    if (clearConfirm) clearConfirm.hidden = true;
  }

  function openScratchpad() {
    if (!activeGame || !scratchpadPanel || !scratchpadBtn) return;
    if (scratchpadHideTimer) {
      clearTimeout(scratchpadHideTimer);
      scratchpadHideTimer = null;
    }
    scratchpadTrigger = scratchpadBtn;
    scratchpadPanel.hidden = false;
    scratchpadPanel.inert = false;
    scratchpadPanel.setAttribute("aria-hidden", "false");
    scratchpadBtn.setAttribute("aria-expanded", "true");
    modalWindow.classList.add("scratchpad-open");
    requestAnimationFrame(() => {
      scratchpadPanel.classList.add("is-open");
      scratchpadNotes.focus();
    });
  }

  function closeScratchpad(restoreFocus = true) {
    if (!scratchpadPanel || scratchpadPanel.hidden) return;
    flushScratchpadSave();
    scratchpadPanel.inert = true;
    scratchpadPanel.setAttribute("aria-hidden", "true");
    scratchpadPanel.classList.remove("is-open");
    scratchpadBtn.setAttribute("aria-expanded", "false");
    modalWindow.classList.remove("scratchpad-open");
    if (scratchpadHideTimer) clearTimeout(scratchpadHideTimer);
    scratchpadHideTimer = setTimeout(() => {
      scratchpadPanel.hidden = true;
      scratchpadHideTimer = null;
    }, 250);
    if (restoreFocus && scratchpadTrigger && scratchpadTrigger.isConnected) scratchpadTrigger.focus();
  }

  function toggleScratchpad() {
    if (!activeGame) return;
    if (scratchpadPanel.hidden || !scratchpadPanel.classList.contains("is-open")) {
      openScratchpad();
    } else {
      closeScratchpad();
    }
  }

  function formatPlaytime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const remainingSeconds = String(total % 60).padStart(2, "0");
    return `${hours}:${minutes}:${remainingSeconds}`;
  }

  if (scratchpadBtn) scratchpadBtn.addEventListener("click", toggleScratchpad);
  if (scratchpadCloseBtn) scratchpadCloseBtn.addEventListener("click", () => closeScratchpad());
  if (scratchpadNotes) scratchpadNotes.addEventListener("input", scheduleScratchpadSave);

  const scratchpadStampBtn = document.getElementById("scratchpad-stamp-btn");
  if (scratchpadStampBtn) {
    scratchpadStampBtn.addEventListener("click", () => {
      if (!activeGame || !scratchpadNotes) return;
      const start = scratchpadNotes.selectionStart;
      const end = scratchpadNotes.selectionEnd;
      const value = scratchpadNotes.value;
      const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
      const suffix = end < value.length && value[end] !== "\n" ? "\n" : "";
      const stamp = `[${formatPlaytime((Date.now() - scratchpadGameStartTime) / 1000)}] Clue: `;
      const insertion = `${prefix}${stamp}${suffix}`;
      scratchpadNotes.setRangeText(insertion, start, end, "end");
      scratchpadNotes.focus();
      scheduleScratchpadSave();
    });
  }

  const scratchpadCopyBtn = document.getElementById("scratchpad-copy-btn");
  if (scratchpadCopyBtn) {
    scratchpadCopyBtn.addEventListener("click", async () => {
      const text = scratchpadNotes ? scratchpadNotes.value : "";
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(text);
        } else {
          const copyTarget = document.createElement("textarea");
          copyTarget.value = text;
          copyTarget.setAttribute("readonly", "");
          copyTarget.style.position = "fixed";
          copyTarget.style.opacity = "0";
          document.body.appendChild(copyTarget);
          try {
            copyTarget.select();
            if (!document.execCommand("copy")) throw new Error("Clipboard copy command was rejected");
          } finally {
            copyTarget.remove();
          }
        }
        setScratchpadStatus("Notes copied to clipboard");
      } catch (error) {
        setScratchpadStatus("Clipboard access failed");
        console.warn("[ArcadeVerse Scratchpad] Unable to copy notes:", error);
      }
    });
  }

  const scratchpadExportBtn = document.getElementById("scratchpad-export-btn");
  if (scratchpadExportBtn) {
    scratchpadExportBtn.addEventListener("click", () => {
      if (!activeGame || !scratchpadNotes) return;
      const safeTitle = activeGame.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().replace(/\s+/g, "_") || "Game";
      const file = new Blob([scratchpadNotes.value], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ArcadeVerse_${safeTitle}_Notes.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setScratchpadStatus("Notes exported");
    });
  }

  const scratchpadClearBtn = document.getElementById("scratchpad-clear-btn");
  const scratchpadClearConfirmBtn = document.getElementById("scratchpad-clear-confirm-btn");
  const scratchpadClearCancelBtn = document.getElementById("scratchpad-clear-cancel-btn");
  if (scratchpadClearBtn && scratchpadClearConfirm) {
    scratchpadClearBtn.addEventListener("click", () => {
      scratchpadClearConfirm.hidden = false;
      scratchpadClearConfirmBtn.focus();
    });
  }
  if (scratchpadClearConfirmBtn) {
    scratchpadClearConfirmBtn.addEventListener("click", () => {
      if (!scratchpadNotes) return;
      scratchpadNotes.value = "";
      scratchpadClearConfirm.hidden = true;
      scheduleScratchpadSave();
      scratchpadNotes.focus();
    });
  }
  if (scratchpadClearCancelBtn) {
    scratchpadClearCancelBtn.addEventListener("click", () => {
      if (scratchpadClearConfirm) scratchpadClearConfirm.hidden = true;
      if (scratchpadClearBtn) scratchpadClearBtn.focus();
    });
  }

  window.addEventListener("keydown", (event) => {
    if (!gameModal || !gameModal.classList.contains("active")) return;
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleScratchpad();
      return;
    }
    if (!scratchpadPanel || scratchpadPanel.hidden || !scratchpadPanel.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeScratchpad();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(scratchpadPanel.querySelectorAll("button:not([disabled]), textarea:not([disabled])"))
      .filter((element) => !element.closest("[hidden]"));
    if (!focusable.length) {
      event.preventDefault();
      scratchpadPanel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !scratchpadPanel.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !scratchpadPanel.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  if (modalFavBtn) {
    modalFavBtn.addEventListener("click", () => {
      if (activeGame) {
        const wasFav = isFavorite(activeGame.id);
        toggleFavorite(activeGame.id);
        announceToScreenReader(wasFav ? `Removed ${activeGame.title} from favorites.` : `Saved ${activeGame.title} to favorites.`);
      }
    });
  }

  if (modalSoundBtn) {
    modalSoundBtn.addEventListener("click", () => {
      if (window.SoundEngine && typeof window.SoundEngine.toggleMute === "function") {
        window.SoundEngine.toggleMute();
      }
      const audioState = syncAudioPreferences();
      broadcastVolumeSyncToGame(audioState.muted, audioState.volume);
      announceToScreenReader(audioState.muted ? "Game audio muted." : "Game audio unmuted.");
    });
  }

  const globalSoundToggleBtn = document.getElementById("global-sound-toggle-btn");
  if (globalSoundToggleBtn) {
    globalSoundToggleBtn.addEventListener("click", () => {
      setTimeout(() => {
        const audioState = syncAudioPreferences();
        broadcastVolumeSyncToGame(audioState.muted, audioState.volume);
        announceToScreenReader(audioState.muted ? "Global audio muted." : "Global audio unmuted.");
      }, 0);
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      announceToScreenReader("Restarting game...");
      const targetSrc = (activeGame && buildIsolatedGameUrl(activeGame)) || gameIframe.src;
      if (targetSrc) {
        gameIframe.src = "";
        setTimeout(() => {
          gameIframe.src = targetSrc;
        }, 50);
      }
    });
  }

  // ========================================================
  // ESC KEY DUAL-ACTION CONFLICT RESOLVER (#500)
  // Preserves in-game pause menus and prevents accidental game aborts
  // ========================================================
  let escPressTimer = null;
  let escPressCount = 0;

  function showEscExitToast() {
    announceToScreenReader("Game paused. Press Escape again or Shift Escape to exit to catalog.");
    const existing = document.getElementById("esc-exit-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "esc-exit-toast";
    toast.className = "esc-exit-prompt-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <div class="esc-exit-toast-body">
        <span class="esc-badge">ESC</span>
        <span>Game paused. Press <kbd>ESC</kbd> again or <kbd>Shift+ESC</kbd> to exit to catalog.</span>
      </div>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 250);
      }
    }, 2500);
  }

  function handleEscDualAction(e) {
    if (e.key !== "Escape" || !gameModal || !gameModal.classList.contains("active")) return;

    // If game controls legend is open, dismiss it first
    if (controlsLegendDialog && controlsLegendDialog.style.display === "flex") {
      closeControlsLegend();
      return;
    }

    if (isConfirmingQuit) {
      hideQuitConfirmationModal();
      return;
    }

    // Shift + Escape always forces immediate exit via score confirmation
    if (e.shiftKey) {
      if (escPressTimer) clearTimeout(escPressTimer);
      escPressCount = 0;
      requestModalClose(false);
      return;
    }

    // Check if user is actively in confirmation dialog
    const confirmDialog = document.getElementById("game-quit-confirmation-dialog");
    if (confirmDialog && confirmDialog.classList.contains("active")) {
      hideQuitConfirmationModal();
      return;
    }

    // First press: Dispatch pause event to game iframe
    if (escPressTimer) clearTimeout(escPressTimer);

    escPressCount++;
    if (escPressCount === 1) {
      try {
        if (gameIframe && gameIframe.contentWindow) {
          const trustedOrigin = getTrustedTargetOrigin();
          gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_PAUSE" }, trustedOrigin);
          gameIframe.contentWindow.postMessage({ type: "ARCADEVERSE_ESC_PAUSE" }, trustedOrigin);
        }
      } catch (_) {}

      showEscExitToast();

      if (escPressTimer) clearTimeout(escPressTimer);
      escPressTimer = setTimeout(() => {
        escPressCount = 0;
      }, 1500);
    } else if (escPressCount >= 2) {
      // Announce session close to active listeners
      try {
        window.dispatchEvent(new CustomEvent("arcadeverse:esc-exit-confirmed"));
      } catch (_) {}
      // Second press within 1.5s: close modal with protection
      if (escPressTimer) clearTimeout(escPressTimer);
      escPressCount = 0;
      const toast = document.getElementById("esc-exit-toast");
      if (toast) toast.remove();
      requestModalClose(false);
    }
  }

  window.addEventListener("keydown", handleEscDualAction);

  // ========================================================
  // ACCESSIBILITY & GAMEPLAY KEYBOARD SCROLL SUPPRESSOR (#512)
  // Prevents arrow keys and Space from scrolling the underlying background page
  // during active gameplay inside the modal while permitting typing in text inputs
  // ========================================================
  const GAMEPLAY_SCROLL_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    " ",
    "PageUp",
    "PageDown",
    "Home",
    "End"
  ]);

  window.addEventListener("keydown", (e) => {
    if (!gameModal || !gameModal.classList.contains("active")) return;

    // Check if key is a default scroll trigger
    if (!GAMEPLAY_SCROLL_KEYS.has(e.key) && !GAMEPLAY_SCROLL_KEYS.has(e.code)) return;

    // Preserve standard typing / cursor navigation inside form elements (search/report inputs)
    const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    const isEditable = e.target && (e.target.isContentEditable || targetTag === "input" || targetTag === "textarea" || targetTag === "select");
    if (isEditable) return;

    // If modal is active and target is inside modal or focus slipped to window, prevent default page scroll
    const isInsideModal = e.target && (gameModal.contains(e.target) || e.target === document.body || e.target === document.documentElement);
    if (isInsideModal) {
      e.preventDefault();
    }
  }, { passive: false });

  // Listen for forwarded shortcuts and runtime events from inside game iframes
  window.addEventListener("message", (e) => {
    if (!e || !e.data || typeof e.data !== "object") return;

    // Filter non-ArcadeVerse messages quickly
    const type = e.data.type || "";
    if (!type.startsWith("ARCADEVERSE_") && !type.startsWith("AV_")) return;

    // Security origin & source validation
    if (!isValidGameMessage(e)) {
      return;
    }

    // Handle handshake confirmation ACK from ArcadeVerse SDK
    if (type === "AV_SESSION_ACK") {
      activeGameSession.handshakeConfirmed = true;
      if (activeGameSession.handshakeTimeoutId) {
        clearTimeout(activeGameSession.handshakeTimeoutId);
        activeGameSession.handshakeTimeoutId = null;
      }
      return;
    }

    // Handle initial audio configuration request from child game iframe
    if (type === "ARCADEVERSE_REQUEST_AUDIO_CONFIG") {
      const audioState = syncAudioPreferences();
      broadcastVolumeSyncToGame(audioState.muted, audioState.volume);
      if (gameIframe && gameIframe.contentWindow) {
        gameIframe.contentWindow.postMessage({
          type: "ARCADEVERSE_AUDIO_CONFIG",
          sessionToken: activeGameSession.token,
          muted: audioState.muted,
          volume: audioState.volume,
          gain: audioState.muted ? 0 : audioState.volume
        }, getTrustedTargetOrigin());
      }
      return;
    }

    // Handle mobile haptic vibration forwarding from iframe games (#521)
    if (type === "ARCADEVERSE_HAPTIC") {
      try {
        if (navigator && typeof navigator.vibrate === "function") {
          navigator.vibrate(e.data.pattern || 20);
        }
      } catch (_) {}
      return;
    }

    // Handle pause and resume event messages from child games (#702)
    if (type === "ARCADEVERSE_PAUSE" || type === "ARCADEVERSE_GAME_PAUSED") {
      announceToScreenReader("Game paused.");
      return;
    }

    if (type === "ARCADEVERSE_RESUME" || type === "ARCADEVERSE_GAME_RESUMED") {
      announceToScreenReader("Game resumed.");
      return;
    }

    // Handle explicit high score notification messages (#702)
    if (type === "ARCADEVERSE_HIGH_SCORE" || type === "ARCADEVERSE_NEW_HIGH_SCORE") {
      const hs = Number(e.data.score || e.data.highScore) || currentSessionHighScore;
      if (hs > 0) {
        currentSessionHighScore = Math.max(currentSessionHighScore, hs);
        announceToScreenReader(`New high score! ${hs} points.`, "assertive");
      }
      return;
    }

    // Handle score events from verified child games (#513, #702)
    if (type === "ARCADEVERSE_GAME_SCORE") {
      const score = Number(e.data.score) || 0;
      const now = Date.now();

      // Check if player has achieved a new personal high score (#702)
      if (score > currentSessionHighScore && currentSessionHighScore > 0 && !isNewHighScoreAnnounced) {
        isNewHighScoreAnnounced = true;
        currentSessionHighScore = score;
        announceToScreenReader(`New high score! ${score} points.`, "assertive");
      } else if (score > currentSessionHighScore) {
        currentSessionHighScore = score;
        if (typeof announceToScreenReader === "function" && (score >= lastAnnouncedScore + 100 || (now - lastScoreAnnouncementTime > 5000 && score !== lastAnnouncedScore))) {
          announceToScreenReader(`Score: ${score}`);
          lastAnnouncedScore = score;
          lastScoreAnnouncementTime = now;
        }
      } else if (typeof announceToScreenReader === "function" && (score >= lastAnnouncedScore + 100 || (now - lastScoreAnnouncementTime > 5000 && score !== lastAnnouncedScore))) {
        announceToScreenReader(`Score: ${score}`);
        lastAnnouncedScore = score;
        lastScoreAnnouncementTime = now;
      }

      window.dispatchEvent(
        new CustomEvent("arcadeverse:score-update", {
          detail: {
            gameId: activeGame ? activeGame.id : null,
            score: score,
            sessionToken: activeGameSession.token
          }
        })
      );
      return;
    }

    // Handle game-over lifecycle events
    if (type === "ARCADEVERSE_GAME_OVER") {
      if (window.ArcadeDDA && typeof window.ArcadeDDA.recordDeath === "function") {
        try { window.ArcadeDDA.recordDeath(); } catch (_) {}
      }
      const details = e.data.details || {};
      const finalScore = details.score != null ? Number(details.score) : lastAnnouncedScore;
      if (typeof announceToScreenReader === "function") {
        if (details.isHighScore || (finalScore > currentSessionHighScore && finalScore > 0)) {
          currentSessionHighScore = finalScore;
          try {
            if (activeGame) {
              localStorage.setItem(`av_${activeGame.id}_highScore`, String(finalScore));
            }
          } catch (_) { }
          announceToScreenReader(`Game over. New high score: ${finalScore} points!`, "assertive");
        } else {
          announceToScreenReader(`Game over. Final score: ${finalScore}.`);
        }
      }

      // Offline dispatch queue integration (#554)
      if (typeof navigator !== 'undefined' && !navigator.onLine && window.AvOfflineQueue) {
        window.AvOfflineQueue.enqueue('HIGH_SCORE_SYNC', {
          gameId: activeGame ? activeGame.id : null,
          score: finalScore,
          timestamp: Date.now()
        });
      }

      window.dispatchEvent(
        new CustomEvent("arcadeverse:game-over", {
          detail: {
            gameId: activeGame ? activeGame.id : null,
            details: details,
            sessionToken: activeGameSession.token
          }
        })
      );
      return;
    }

    // Handle keyboard shortcut forwarding
    if (type === "ARCADEVERSE_KEY_SHORTCUT") {
      const key = (e.data.key || "").toLowerCase();
      if (e.data.key === "Escape") {
        if (controlsLegendDialog && controlsLegendDialog.style.display === "flex") {
          closeControlsLegend();
          return;
        }
        if (gameModal.classList.contains("active")) {
          if (isConfirmingQuit) {
            hideQuitConfirmationModal();
            return;
          }
          requestModalClose(false);
        }
      } else if (key === "k") {
        if (gameModal.classList.contains("active") && controlsLegendBtn) controlsLegendBtn.click();
      } else if (key === "f") {
        if (gameModal.classList.contains("active") && fullscreenBtn) fullscreenBtn.click();
      } else if (key === "r") {
        if (gameModal.classList.contains("active") && reloadBtn) reloadBtn.click();
      } else if (key === "m") {
        const soundBtn = document.getElementById("global-sound-toggle-btn");
        if (soundBtn) soundBtn.click();
      } else if (key === "t") {
        const themeBtn = document.getElementById("theme-toggle-btn");
        if (themeBtn) themeBtn.click();
      }
    }
  });

  fullscreenBtn.addEventListener("click", () => {
    // Feature-detect native fullscreen support (Safari iOS / mobile WebKit lack requestFullscreen on non-video elements)
    const hasNativeFullscreen = !!(
      modalWindow.requestFullscreen ||
      modalWindow.webkitRequestFullscreen ||
      modalWindow.mozRequestFullScreen ||
      modalWindow.msRequestFullscreen
    );

    const isNowFullscreen = modalWindow.classList.toggle("fullscreen");
    if (gameModal) {
      gameModal.classList.toggle("fullscreen-mode", isNowFullscreen);
    }
    fullscreenBtn.setAttribute("aria-pressed", isNowFullscreen ? "true" : "false");
    fullscreenBtn.title = isNowFullscreen ? "Exit Fullscreen" : "Fullscreen Game";
    announceToScreenReader(isNowFullscreen ? "Entered fullscreen mode." : "Exited fullscreen mode.");

    // Detect iOS / WebKit touch devices to activate pseudo-fullscreen viewport styling
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isNowFullscreen) {
      if (hasNativeFullscreen && !isIOS) {
        try {
          const promise = modalWindow.requestFullscreen
            ? modalWindow.requestFullscreen()
            : (modalWindow.webkitRequestFullscreen ? modalWindow.webkitRequestFullscreen() : null);
          if (promise && promise.catch) {
            promise.catch(() => {
              // Fallback to CSS pseudo-fullscreen if native request is rejected
              activatePseudoFullscreen();
            });
          }
        } catch (_err) {
          activatePseudoFullscreen();
        }
      } else {
        // Direct CSS pseudo-fullscreen fallback on iOS Safari and mobile WebKit viewports
        activatePseudoFullscreen();
      }
    } else {
      deactivatePseudoFullscreen();
      const currentFs = document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      if (currentFs) {
        try {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        } catch (_err) {}
      }
    }

    // Helper to lock body scroll and pin viewport on iOS Safari pseudo-fullscreen
    function activatePseudoFullscreen() {
      document.body.classList.add("modal-pseudo-fullscreen-active");
      modalWindow.classList.add("pseudo-fullscreen");
      if (gameModal) gameModal.classList.add("pseudo-fullscreen-overlay");
      // Scroll to top of viewport to minimize iOS Safari navigation bars
      window.scrollTo(0, 0);

      // Notify game iframe about fullscreen status change
      if (gameFrame && gameFrame.contentWindow) {
        try {
          gameFrame.contentWindow.postMessage({
            type: "AV_FULLSCREEN_CHANGE",
            payload: { isFullscreen: true, mode: "pseudo" }
          }, getTrustedTargetOrigin());
        } catch (_e) { }
      }
      broadcastViewportResize(true);
    }

    function deactivatePseudoFullscreen() {
      document.body.classList.remove("modal-pseudo-fullscreen-active");
      modalWindow.classList.remove("pseudo-fullscreen");
      if (gameModal) gameModal.classList.remove("pseudo-fullscreen-overlay");

      // Notify game iframe about fullscreen status change
      if (gameFrame && gameFrame.contentWindow) {
        try {
          gameFrame.contentWindow.postMessage({
            type: "AV_FULLSCREEN_CHANGE",
            payload: { isFullscreen: false, mode: "pseudo" }
          }, getTrustedTargetOrigin());
        } catch (_e) { }
      }
      broadcastViewportResize(true);
    }
  });

  // Listen to native fullscreen exit (e.g. user presses Esc in native fullscreen)
  const handleNativeFullscreenChange = () => {
    const isNativeFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (!isNativeFs && modalWindow.classList.contains("fullscreen") && !modalWindow.classList.contains("pseudo-fullscreen")) {
      modalWindow.classList.remove("fullscreen");
      if (gameModal) gameModal.classList.remove("fullscreen-mode");
      document.body.classList.remove("modal-pseudo-fullscreen-active");
      fullscreenBtn.setAttribute("aria-pressed", "false");
      fullscreenBtn.title = "Fullscreen Game";
    }
    broadcastViewportResize(true);
  };
  document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleNativeFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleNativeFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleNativeFullscreenChange);

  // Sort Selector Change
  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      ArcadeStorageResilience.safeSetItem(CATALOG_SORT_STORAGE_KEY, currentSort);
      renderGames();
    });
  }

  // ==========================================================================
  // MOBILE TOUCH & GESTURE INTERFERENCE PREVENTION (Issue #519)
  // Prevents Default Pull-to-Refresh & Pinch-Zoom Interference During Touch Play
  // ==========================================================================
  function preventMultiTouchGestures(target) {
    if (!target) return;

    let lastTouchTime = 0;

    // Prevent multi-touch pinch-zoom (2 or more touches)
    target.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    // Prevent pull-to-refresh & browser scrolling interference on touch movements
    target.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    // Prevent accidental double-tap zoom triggers
    target.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchTime <= 300) {
        if (e.cancelable) e.preventDefault();
      }
      lastTouchTime = now;
    }, { passive: false });

    // Prevent iOS WebKit pinch-to-zoom / multi-finger gesture events
    target.addEventListener("gesturestart", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    target.addEventListener("gesturechange", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    target.addEventListener("gestureend", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  // Guard the game modal body / frame wrapper container
  const modalBody = document.querySelector(".game-modal-body") || modalFrameWrapper;
  if (modalBody) {
    preventMultiTouchGestures(modalBody);
  }

  // Prevent multi-touch zooming and gesture scaling on the modal container
  if (gameModal) {
    gameModal.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    gameModal.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    gameModal.addEventListener("gesturestart", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    gameModal.addEventListener("gesturechange", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    gameModal.addEventListener("gestureend", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  // Prevent pull-to-refresh when dragging on backdrop overlay
  if (modalOverlay) {
    modalOverlay.addEventListener("touchmove", (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  // ==========================================================================
  // ADAPTIVE IFRAME TOUCH & GESTURE GUARD (Issue #519, #827)
  // Restricts strict touch-action: none to canvas action games, while enabling
  // native vertical pan-y touch scrolling for scrollable narrative & puzzle games.
  // ==========================================================================
  function guardIframeTouchInteractions(iframeElement) {
    try {
      const targetIframe = (iframeElement && iframeElement.nodeType) ? iframeElement : (document.getElementById("game-iframe") || gameIframe);
      if (!targetIframe) return;
      const win = targetIframe.contentWindow;
      const doc = targetIframe.contentDocument || (win && win.document);
      if (!doc) return;

      // Helper to detect explicit scroll locking attributes
      function hasExplicitScrollLock(targetDoc) {
        if (!targetDoc) return false;
        if (targetDoc.documentElement) {
          const val = targetDoc.documentElement.getAttribute("data-scroll-lock");
          if (val === "true" || val === "") return true;
          if (val === "false") return false;
        }
        if (targetDoc.body) {
          const val = targetDoc.body.getAttribute("data-scroll-lock");
          if (val === "true" || val === "") return true;
          if (val === "false") return false;
        }
        const el = targetDoc.querySelector("[data-scroll-lock]");
        if (el) {
          const val = el.getAttribute("data-scroll-lock");
          return val !== "false";
        }
        return false;
      }

      // Helper to detect explicit scrollable opt-in attributes
      function hasExplicitScrollable(targetDoc) {
        if (!targetDoc) return false;
        if (targetDoc.documentElement) {
          const val = targetDoc.documentElement.getAttribute("data-scrollable");
          if (val === "true" || val === "") return true;
          if (val === "false") return false;
        }
        if (targetDoc.body) {
          const val = targetDoc.body.getAttribute("data-scrollable");
          if (val === "true" || val === "") return true;
          if (val === "false") return false;
        }
        const el = targetDoc.querySelector("[data-scrollable]");
        if (el) {
          const val = el.getAttribute("data-scrollable");
          return val !== "false";
        }
        return false;
      }

      // Determine whether the game document is scrollable or locked
      function detectIsScrollable() {
        try {
          if (!doc) return false;

          // 1. Explicit opt-ins / opt-outs
          if (hasExplicitScrollLock(doc)) return false;
          if (hasExplicitScrollable(doc)) return true;

          // 2. Viewport height vs child document height
          const winHeight = (win && win.innerHeight) || (targetIframe && targetIframe.clientHeight) || window.innerHeight || 0;
          const rootScrollHeight = doc.documentElement ? doc.documentElement.scrollHeight : 0;
          const bodyScrollHeight = doc.body ? doc.body.scrollHeight : 0;
          const maxDocHeight = Math.max(rootScrollHeight, bodyScrollHeight);

          if (winHeight > 0 && maxDocHeight > winHeight + 8) {
            return true;
          }

          // 3. Scrollable non-canvas containers inside child document (e.g. overflow: auto/scroll panels)
          const scrollableContainers = doc.querySelectorAll("div, section, main, article, ul, ol");
          for (let i = 0; i < scrollableContainers.length; i++) {
            const el = scrollableContainers[i];
            if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 8) {
              const compStyle = win && win.getComputedStyle ? win.getComputedStyle(el) : null;
              const overflowY = compStyle ? compStyle.overflowY : "";
              if (overflowY === "auto" || overflowY === "scroll" || el.scrollHeight > winHeight) {
                return true;
              }
            }
          }

          // 4. Pure DOM / puzzle / narrative games without canvas elements
          const canvases = doc.querySelectorAll("canvas, #canvas, .game-canvas");
          if (canvases.length === 0) {
            return true;
          }

          return false;
        } catch (_) {
          return false;
        }
      }

      function applyAdaptiveTouchGuard() {
        try {
          if (!doc || !doc.body) return;
          const isScrollable = detectIsScrollable();

          // Sync parent wrapper and iframe touch-actions
          if (targetIframe) {
            targetIframe.style.touchAction = isScrollable ? "pan-y" : "none";
          }
          const modalBodyEl = document.querySelector(".game-modal-body") || modalFrameWrapper;
          if (modalBodyEl) {
            modalBodyEl.style.touchAction = isScrollable ? "pan-y" : "none";
          }

          let styleEl = doc.getElementById("arcadeverse-touch-guard-css");
          if (!styleEl && doc.head) {
            styleEl = doc.createElement("style");
            styleEl.id = "arcadeverse-touch-guard-css";
            doc.head.appendChild(styleEl);
          }

          if (isScrollable) {
            // Narrative / Puzzle / Scrollable DOM Games
            if (doc.documentElement) {
              doc.documentElement.style.overscrollBehavior = "contain";
              doc.documentElement.style.overscrollBehaviorY = "contain";
              doc.documentElement.style.touchAction = "pan-y";
            }
            if (doc.body) {
              doc.body.style.overscrollBehavior = "contain";
              doc.body.style.overscrollBehaviorY = "contain";
              doc.body.style.touchAction = "pan-y";
            }

            if (styleEl) {
              styleEl.textContent = `
                html, body {
                  touch-action: pan-y !important;
                  overscroll-behavior: contain !important;
                  overscroll-behavior-y: contain !important;
                  -webkit-overflow-scrolling: touch;
                }
                canvas, #canvas, .game-canvas {
                  touch-action: none !important;
                  overscroll-behavior: contain !important;
                  overscroll-behavior-y: contain !important;
                  -webkit-user-select: none !important;
                  user-select: none !important;
                  -webkit-touch-callout: none !important;
                }
              `;
            }
          } else {
            // Full-Viewport Locked Games (e.g. Canvas Action / Joystick Games)
            if (doc.documentElement) {
              doc.documentElement.style.overscrollBehavior = "contain";
              doc.documentElement.style.overscrollBehaviorY = "contain";
              doc.documentElement.style.touchAction = "none";
            }
            if (doc.body) {
              doc.body.style.overscrollBehavior = "contain";
              doc.body.style.overscrollBehaviorY = "contain";
              doc.body.style.touchAction = "none";
            }

            if (styleEl) {
              styleEl.textContent = `
                html, body, canvas, #canvas, .game-canvas {
                  touch-action: none !important;
                  overscroll-behavior: contain !important;
                  overscroll-behavior-y: contain !important;
                  -webkit-user-select: none !important;
                  user-select: none !important;
                  -webkit-touch-callout: none !important;
                }
              `;
            }
          }
        } catch (_) {}
      }

      // Apply initial guard styling
      applyAdaptiveTouchGuard();

      // Attach gesture safety listeners inside child frame (only once per child document)
      if (!doc.__arcadeverseTouchGuarded) {
        doc.__arcadeverseTouchGuarded = true;

        // Prevent multi-touch pinch-zoom (2 or more touches)
        doc.addEventListener("touchstart", (e) => {
          if (e.touches && e.touches.length > 1 && e.cancelable) {
            e.preventDefault();
          }
        }, { passive: false });

        doc.addEventListener("touchmove", (e) => {
          // Block multi-touch pinch-zoom
          if (e.touches && e.touches.length > 1) {
            if (e.cancelable) e.preventDefault();
            return;
          }

          // Allow vertical scrolling on scrollable DOM/narrative games,
          // while blocking pull-to-refresh and unintended scrolling on canvases or locked action games
          const isScrollable = detectIsScrollable();
          const isCanvasTarget = e.target && (
            e.target.tagName === "CANVAS" ||
            (typeof e.target.closest === "function" && e.target.closest("canvas, .game-canvas, #canvas"))
          );

          if (!isScrollable || isCanvasTarget) {
            if (e.cancelable) {
              e.preventDefault();
            }
          }
        }, { passive: false });

        // Prevent iOS WebKit pinch-to-zoom / multi-finger gesture events
        ["gesturestart", "gesturechange", "gestureend"].forEach((evtName) => {
          doc.addEventListener(evtName, (e) => {
            if (e.cancelable) e.preventDefault();
          }, { passive: false });
        });
      }

      // Re-evaluate on orientation change, window resize, or dynamic DOM changes
      let debounceTimer = null;
      function debouncedApply() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          applyAdaptiveTouchGuard();
        }, 50);
      }

      if (win && !win.__arcadeverseTouchGuardBound) {
        win.__arcadeverseTouchGuardBound = true;
        win.addEventListener("resize", debouncedApply, { passive: true });
        win.addEventListener("orientationchange", debouncedApply, { passive: true });

        if (typeof win.ResizeObserver === "function" && doc.body) {
          try {
            const ro = new win.ResizeObserver(() => {
              debouncedApply();
            });
            ro.observe(doc.body);
          } catch (_) {}
        }

        if (typeof win.MutationObserver === "function" && doc.body) {
          try {
            const mo = new win.MutationObserver(() => {
              debouncedApply();
            });
            mo.observe(doc.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ["data-scroll-lock", "data-scrollable", "style", "class"]
            });
          } catch (_) {}
        }
      }

      // Deferred checks to catch delayed async rendering
      setTimeout(applyAdaptiveTouchGuard, 120);
      setTimeout(applyAdaptiveTouchGuard, 400);
      setTimeout(applyAdaptiveTouchGuard, 1000);
    } catch (_) {}
  }

  // ===================================================
  // INTERACTIVE GAME SEARCH AUTOCOMPLETE & QUICK-JUMP
  // ===================================================
  const searchBox = document.querySelector(".search-box");
  let autocompleteDropdown = null;
  let activeSuggestionIndex = -1;
  let currentSuggestions = [];

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightMatch(text, query) {
    const safeText = escapeHTML(text);
    if (!query) return safeText;
    const safeQuery = escapeRegex(escapeHTML(query));
    const regex = new RegExp(`(${safeQuery})`, "gi");
    return safeText.replace(regex, '<span class="autocomplete-match">$1</span>');
  }

  closeAutocomplete = function () {
    if (!autocompleteDropdown) return;
    autocompleteDropdown.style.display = "none";
    autocompleteDropdown.innerHTML = "";
    activeSuggestionIndex = -1;
    currentSuggestions = [];
    if (searchInput) {
      searchInput.setAttribute("aria-expanded", "false");
      searchInput.removeAttribute("aria-activedescendant");
    }
  };

  function updateActiveSuggestion(index) {
    if (!autocompleteDropdown) return;
    const items = autocompleteDropdown.querySelectorAll(".autocomplete-item");
    if (items.length === 0) return;

    activeSuggestionIndex = index;

    items.forEach((item, idx) => {
      if (idx === activeSuggestionIndex) {
        item.classList.add("active");
        item.setAttribute("aria-selected", "true");
        item.scrollIntoView({ block: "nearest" });
        if (searchInput) {
          searchInput.setAttribute("aria-activedescendant", item.id);
        }
      } else {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      }
    });

    if (activeSuggestionIndex === -1 && searchInput) {
      searchInput.removeAttribute("aria-activedescendant");
    }
  }

  function launchSuggestion(game) {
    closeAutocomplete();
    if (game && typeof openGameModal === "function") {
      openGameModal(game, searchInput);
    }
  }

  function renderAutocomplete(query) {
    if (!autocompleteDropdown || !searchInput) return;
    const trimmed = query.trim().toLowerCase();

    if (!trimmed || typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) {
      closeAutocomplete();
      return;
    }

    // Determine candidate game set based on active category / favorites facet (#900)
    let candidateGames = GAMES_REGISTRY;
    if (typeof currentCategory === "string" && currentCategory !== "all") {
      if (currentCategory === "favorites") {
        const favs = typeof getFavorites === "function" ? getFavorites() : new Set();
        candidateGames = GAMES_REGISTRY.filter((g) => favs.has(g.id));
      } else {
        candidateGames = GAMES_REGISTRY.filter((g) => {
          if (typeof matchesCategoryFilter === "function") {
            return matchesCategoryFilter(g, currentCategory);
          }
          const itemCat = (g.category || "").toLowerCase();
          return itemCat.includes(currentCategory.toLowerCase());
        });
      }
    }

    // Author search operator support: "@author" query syntax (#900)
    const isAuthorQuery = trimmed.startsWith("@");
    const authorTarget = isAuthorQuery ? trimmed.slice(1).trim() : "";

    // Filter and score matching games
    const scoredMatches = [];
    for (const game of candidateGames) {
      const titleLower = (game.title || "").toLowerCase();
      const authorLower = (game.author || "").toLowerCase();
      const githubLower = (game.github || "").toLowerCase();
      const categoryLower = (game.category || "").toLowerCase();
      const tagsLower = Array.isArray(game.tags) ? game.tags.map((t) => t.toLowerCase()) : [];

      let score = -1;

      if (isAuthorQuery) {
        if (!authorTarget) {
          score = 50;
        } else if (githubLower.startsWith(authorTarget) || authorLower.startsWith(authorTarget)) {
          score = 100;
        } else if (githubLower.includes(authorTarget) || authorLower.includes(authorTarget)) {
          score = 80;
        }
      } else {
        if (titleLower.startsWith(trimmed)) {
          score = 100;
        } else if (titleLower.includes(trimmed)) {
          score = 80;
        } else if (tagsLower.some((t) => t === trimmed)) {
          score = 60;
        } else if (tagsLower.some((t) => t.includes(trimmed))) {
          score = 50;
        } else if (categoryLower.includes(trimmed)) {
          score = 40;
        } else if (githubLower.includes(trimmed) || authorLower.includes(trimmed)) {
          score = 30;
        }
      }

      if (score >= 0) {
        scoredMatches.push({ game, score });
      }
    }

    // Sort by relevance score descending
    scoredMatches.sort((a, b) => b.score - a.score);

    // Fallback: If exact matches are empty and query length >= 3 (non-author), match using fuzzy Levenshtein
    if (scoredMatches.length === 0 && !isAuthorQuery && trimmed.length >= 3) {
      for (const game of candidateGames) {
        if (typeof matchesFuzzyLevenshtein === "function" && matchesFuzzyLevenshtein(game, trimmed)) {
          scoredMatches.push({ game, score: 25 });
        }
      }
    }

    const totalMatchesCount = scoredMatches.length;
    currentSuggestions = scoredMatches.slice(0, 8).map((item) => item.game);
    activeSuggestionIndex = -1;

    if (currentSuggestions.length === 0) {
      autocompleteDropdown.innerHTML = `
        <div class="autocomplete-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div>No games found matching "<strong>${escapeHTML(query.trim())}</strong>"</div>
        </div>
      `;
      autocompleteDropdown.style.display = "flex";
      searchInput.setAttribute("aria-expanded", "true");
      return;
    }

    const listHtml = currentSuggestions
      .map((game, idx) => {
        const catBadge = game.category ? game.category.split("/")[0].trim() : "Game";
        const authorHandle = game.github || game.author || "";
        const iconName = sanitizeIconName(game.lucideIcon || "gamepad-2");

        return `
          <li class="autocomplete-item"
              id="autocomplete-opt-${idx}"
              role="option"
              data-index="${idx}"
              aria-selected="false">
            <div class="autocomplete-icon-wrap" aria-hidden="true">
              ${renderSafeIcon(iconName)}
            </div>
            <div class="autocomplete-content">
              <div class="autocomplete-title-row">
                <span class="autocomplete-title">${highlightMatch(game.title, isAuthorQuery ? "" : query.trim())}</span>
              </div>
              <div class="autocomplete-meta-row">
                <span class="autocomplete-category-badge">${escapeHTML(catBadge)}</span>
                ${authorHandle ? `<span class="autocomplete-author">by @${escapeHTML(authorHandle)}</span>` : ""}
              </div>
            </div>
          </li>
        `;
      })
      .join("");

    autocompleteDropdown.innerHTML = `
      <ul class="autocomplete-list" role="presentation">
        ${listHtml}
      </ul>
      <div class="autocomplete-footer">
        <span class="autocomplete-footer-count">Showing ${currentSuggestions.length} of ${totalMatchesCount} match${totalMatchesCount > 1 ? "es" : ""}</span>
        <div class="autocomplete-kbd-hints">
          <span class="autocomplete-kbd">↑↓</span> to navigate
          <span class="autocomplete-kbd">↵</span> to play
          <span class="autocomplete-kbd">Esc</span> to close
        </div>
      </div>
    `;

    autocompleteDropdown.style.display = "flex";
    searchInput.setAttribute("aria-expanded", "true");

    // Click events on suggestion items (mousedown ensures execution before input blur)
    const items = autocompleteDropdown.querySelectorAll(".autocomplete-item");
    items.forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt(item.getAttribute("data-index"), 10);
        if (!isNaN(idx) && currentSuggestions[idx]) {
          launchSuggestion(currentSuggestions[idx]);
        }
      });
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  if (searchBox && searchInput) {
    searchInput.setAttribute("role", "combobox");
    searchInput.setAttribute("aria-autocomplete", "list");
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-controls", "game-search-autocomplete");
    searchInput.setAttribute("autocomplete", "off");
    searchInput.setAttribute("spellcheck", "false");

    autocompleteDropdown = document.createElement("div");
    autocompleteDropdown.id = "game-search-autocomplete";
    autocompleteDropdown.className = "search-autocomplete-dropdown";
    autocompleteDropdown.setAttribute("role", "listbox");
    autocompleteDropdown.setAttribute("aria-label", "Search suggestions");
    autocompleteDropdown.style.display = "none";
    searchBox.appendChild(autocompleteDropdown);

    searchInput.addEventListener("focus", () => {
      const val = searchInput.value.trim();
      if (val.length > 0) {
        renderAutocomplete(val);
      }
    });

    searchInput.addEventListener("keydown", (e) => {
      if (!autocompleteDropdown || autocompleteDropdown.style.display === "none") {
        if (e.key === "ArrowDown" && searchInput.value.trim().length > 0) {
          e.preventDefault();
          renderAutocomplete(searchInput.value);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (currentSuggestions.length > 0) {
          const nextIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
          updateActiveSuggestion(nextIndex);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (currentSuggestions.length > 0) {
          const prevIndex = activeSuggestionIndex <= 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
          updateActiveSuggestion(prevIndex);
        }
      } else if (e.key === "Enter") {
        if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
          e.preventDefault();
          launchSuggestion(currentSuggestions[activeSuggestionIndex]);
        } else if (currentSuggestions.length === 1) {
          e.preventDefault();
          launchSuggestion(currentSuggestions[0]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeAutocomplete();
      }
    });

    document.addEventListener("click", (e) => {
      if (!searchBox.contains(e.target)) {
        closeAutocomplete();
      }
    });
  }

  // Filter Search (Debounced 120ms & Typo-Tolerant)
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (searchClearBtn) searchClearBtn.hidden = !val;

      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }

      const executeSearch = () => {
        searchQuery = searchInput.value.toLowerCase().trim();
        renderGames();
        if (searchQuery.length > 0) {
          renderAutocomplete(searchInput.value);
        } else {
          closeAutocomplete();
        }
      };

      if (!e.isTrusted || !val) {
        executeSearch();
      } else {
        searchDebounceTimer = setTimeout(executeSearch, 120);
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
      if (searchInput) searchInput.value = "";
      searchClearBtn.hidden = true;
      searchQuery = "";
      closeAutocomplete();
      renderGames();
      if (searchInput) searchInput.focus();
    });
  }

  // --- Faceted Filters Event Listeners (Duration, Controls, Reset) ---
  const durationFacetChips = document.querySelectorAll("#duration-facet-chips .facet-chip");
  durationFacetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      durationFacetChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentDurationFacet = chip.getAttribute("data-duration") || "all";
      renderGames();
    });
  });

  const controlsFacetChips = document.querySelectorAll("#controls-facet-chips .facet-chip");
  controlsFacetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      controlsFacetChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentControlsFacet = chip.getAttribute("data-controls") || "all";
      renderGames();
    });
  });

  window.addEventListener("arcadeverse:multi-tag-changed", () => {
    renderGames();
  });

  const btnResetFacets = document.getElementById("btn-reset-facets");
  if (btnResetFacets) {
    btnResetFacets.addEventListener("click", () => {
      currentDurationFacet = "all";
      currentControlsFacet = "all";
      currentLetterFilter = "all";
      resetLetterFilterUI();
      durationFacetChips.forEach((c) => {
        if (c.getAttribute("data-duration") === "all") c.classList.add("active");
        else c.classList.remove("active");
      });
      controlsFacetChips.forEach((c) => {
        if (c.getAttribute("data-controls") === "all") c.classList.add("active");
        else c.classList.remove("active");
      });
      renderGames();
    });
  }

  const playlistTrigger = document.getElementById("trigger-playlists-btn");
  if (playlistTrigger) {
    playlistTrigger.addEventListener("click", () => {
      if (window.ArcadePlaylists) {
        window.ArcadePlaylists.openDrawer(playlistTrigger);
      }
    });
  }

  // Listen for filter-playlist event from PlaylistManager
  window.addEventListener("arcadeverse:filter-playlist", (e) => {
    const pl = e.detail;
    if (!pl) return;
    currentCategory = `playlist:${pl.id}`;
    categoryPills.forEach((p) => p.classList.remove("active"));
    if (playlistTrigger) playlistTrigger.classList.add("active");
    renderGames();
  });

  categoryPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      // Auto-close playlists drawer when switching category filters
      const playlistDrawer = document.getElementById("playlist-drawer");
      if (playlistDrawer && playlistDrawer.classList.contains("open")) {
        playlistDrawer.classList.remove("open");
        playlistDrawer.setAttribute("aria-hidden", "true");
      }
      if (playlistTrigger) {
        playlistTrigger.classList.remove("active");
        playlistTrigger.setAttribute("aria-expanded", "false");
      }

      categoryPills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      pill.classList.add("active");
      pill.setAttribute("aria-selected", "true");
      currentCategory = pill.getAttribute("data-category");
      renderGames();
      syncURLState(false);
    });
  });

  // Mobile Navigation Drawer Favorites Shortcut
  const mobileFavLink = document.getElementById("mobile-favorites-link");
  if (mobileFavLink) {
    mobileFavLink.addEventListener("click", (e) => {
      e.preventDefault();
      const mobileDrawer = document.getElementById("mobile-nav-drawer");
      const menuBtn = document.getElementById("mobile-menu-btn");
      if (mobileDrawer) {
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
      }
      if (menuBtn) {
        menuBtn.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
      }

      categoryPills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      const favPill = document.querySelector('.category-pills .pill[data-category="favorites"]');
      if (favPill) {
        favPill.classList.add("active");
        favPill.setAttribute("aria-selected", "true");
      }
      currentCategory = "favorites";
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      if (searchClearBtn) searchClearBtn.hidden = true;
      closeAutocomplete();
      renderGames();
      syncURLState(false);

      const gamesSection = document.getElementById("games");
      if (gamesSection) {
        gamesSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Re-sort when a game rating is updated (debounced to preserve click interaction)
  let ratingSortTimer = null;
  window.addEventListener("rating-updated", () => {
    if (currentSort === "rating") {
      clearTimeout(ratingSortTimer);
      ratingSortTimer = setTimeout(() => {
        renderGames();
      }, 700);
    }
  });


  // Web Audio Chiptune SFX for Hero Roulette Launcher
  function playRouletteSfx() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const notes = [330, 440, 554.37, 659.25, 880];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.08, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.09);
      });
    } catch (e) {
      // Audio autoplay policy or browser unavailable - fail silently
    }
  }

  // Hero Section "Surprise Me / Random Game Roulette" Launcher (#893)
  const randomGameBtn = document.getElementById("hero-random-game-btn");
  let isRollingRandom = false;

  function launchRandomGame() {
    if (isRollingRandom) return;
    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY) || GAMES_REGISTRY.length === 0) {
      console.warn("GAMES_REGISTRY is not available or empty.");
      return;
    }

    const reducedMotion = document.documentElement.classList.contains("a11y-reduced-motion") ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    // If ArcadeSlotReel visual spinner is available and motion is not reduced, launch reel
    if (window.ArcadeSlotReel && typeof window.ArcadeSlotReel.spin === "function" && !reducedMotion) {
      isRollingRandom = true;
      if (randomGameBtn) {
        randomGameBtn.classList.add("is-rolling");
        randomGameBtn.setAttribute("aria-busy", "true");
      }
      window.ArcadeSlotReel.spin(GAMES_REGISTRY, (selectedGame) => {
        if (randomGameBtn) {
          randomGameBtn.classList.remove("is-rolling");
          randomGameBtn.setAttribute("aria-busy", "false");
        }
        isRollingRandom = false;
        if (selectedGame) {
          openGameModal(selectedGame, randomGameBtn);
        }
      });
      return;
    }

    isRollingRandom = true;
    if (randomGameBtn) {
      randomGameBtn.classList.add("is-rolling");
      randomGameBtn.setAttribute("aria-busy", "true");
    }

    playRouletteSfx();

    // 400ms micro-animation for tactile roulette feel
    setTimeout(() => {
      const candidates = GAMES_REGISTRY.filter((g) => g && g.path);
      const pool = candidates.length > 0 ? candidates : GAMES_REGISTRY;
      const picked = pool[Math.floor(Math.random() * pool.length)];

      if (randomGameBtn) {
        randomGameBtn.classList.remove("is-rolling");
        randomGameBtn.setAttribute("aria-busy", "false");
      }
      isRollingRandom = false;

      if (picked) {
        openGameModal(picked, randomGameBtn);
      }
    }, 400);
  }

  if (randomGameBtn) {
    randomGameBtn.addEventListener("click", launchRandomGame);
  }

  // Halloween cards Play Now buttons click handler (delegates to exclusive Halloween bat loader / new tab)
  document.querySelectorAll(".btn-halloween-play").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const gameId = btn.getAttribute("data-game-id");
      if (typeof window.launchHalloweenGame === "function") {
        window.launchHalloweenGame(gameId);
      } else if (typeof GAMES_REGISTRY !== "undefined") {
        const game = GAMES_REGISTRY.find((g) => g.id === gameId);
        if (game) {
          openGameModal(game, btn);
        }
      }
    });
  });

  // Global export
  window.openGameModal = openGameModal;

  // Ensure game modal frame updates aspect ratio dynamically on orientation changes
  window.addEventListener('orientationchange', () => {
    if (gameModal && gameModal.classList.contains('active')) {
      const isFullscreen = modalWindow.classList.contains('fullscreen');
      if (isFullscreen) {
        modalWindow.style.height = (window.innerHeight) + 'px';
      }
      if (activeGame) {
        checkOrientationLandscapePrompt(activeGame);
      }
    }
  });

  // Mobile Landscape Orientation Auto-Prompt Controller (#520)
  let isLandscapePromptDismissed = false;

  function ensureLandscapePromptDOM() {
    let promptEl = document.getElementById("orientation-landscape-prompt");
    if (!promptEl) {
      const wrapper = document.querySelector(".modal-frame-wrapper");
      if (!wrapper) return null;
      promptEl = document.createElement("div");
      promptEl.id = "orientation-landscape-prompt";
      promptEl.className = "orientation-landscape-prompt";
      promptEl.style.display = "none";
      promptEl.setAttribute("aria-live", "polite");
      promptEl.innerHTML = `
        <div class="orientation-prompt-card">
          <div class="orientation-icon-wrapper">
            <svg class="rotate-phone-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect>
              <path d="M12 18h.01"></path>
            </svg>
          </div>
          <h4>Rotate Device for Best Experience</h4>
          <p>This wide-ratio arcade game is designed for horizontal widescreen play.</p>
          <div class="orientation-actions">
            <button type="button" id="dismiss-landscape-prompt-btn" class="btn btn-sm btn-secondary">Play in Portrait Anyway</button>
          </div>
        </div>
      `;
      wrapper.insertBefore(promptEl, wrapper.firstChild);
      const dismissBtn = promptEl.querySelector("#dismiss-landscape-prompt-btn");
      if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
          promptEl.style.display = "none";
          isLandscapePromptDismissed = true;
        });
      }
    }
    return promptEl;
  }

  function hideLandscapePrompt() {
    const promptEl = document.getElementById("orientation-landscape-prompt");
    if (promptEl) {
      promptEl.style.display = "none";
    }
    isLandscapePromptDismissed = false;
  }

  function isWideRatioGame(game) {
    if (!game) return false;

    // Explicitly exclude known portrait-first / vertical-first games
    const portraitKeywords = /bubble-burst|potion|matrix|sudoku|wordle|solitaire|slide|connect-four|minesweeper|stacker/i;
    const gameIdentifier = (game.folderName || game.id || game.title || "");
    if (portraitKeywords.test(gameIdentifier)) {
      return false;
    }

    // Check aspect ratio if declared
    if (game.aspectRatio === "16:9" || game.aspectRatio === "4:3") {
      return true;
    }

    // Inspect iframe canvas dimensions if accessible
    try {
      if (gameIframe && gameIframe.contentDocument) {
        const canvas = gameIframe.contentDocument.querySelector("canvas");
        if (canvas && canvas.width && canvas.height) {
          if (canvas.width > canvas.height * 1.15) {
            return true;
          } else if (canvas.height >= canvas.width) {
            return false;
          }
        }
      }
    } catch (_) {}

    // Match wide action / arcade / racer / flight games
    const wideKeywords = /racer|drive|flight|pong|hockey|lander|defense|invaders|tanks|runner|flappy|space|retro|miner|breakout|curling|glider|rogue|sub|fleet|wave/i;
    const tagsStr = Array.isArray(game.tags) ? game.tags.join(" ") : "";
    return wideKeywords.test(game.title + " " + gameIdentifier + " " + tagsStr);
  }

  function checkOrientationLandscapePrompt(game) {
    if (!game || isLandscapePromptDismissed) return;
    const promptEl = ensureLandscapePromptDOM();
    if (!promptEl) return;

    if (!isWideRatioGame(game)) {
      promptEl.style.display = "none";
      return;
    }

    const isTouch = window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches);
    
    // Check orientation accurately across modern and older mobile browsers
    const isPortrait = (screen.orientation && screen.orientation.type)
      ? screen.orientation.type.startsWith('portrait')
      : (window.innerHeight > window.innerWidth);

    if (isTouch && isPortrait) {
      promptEl.style.display = "flex";
    } else {
      promptEl.style.display = "none";
    }
  }

  window.addEventListener("resize", () => {
    if (gameModal && gameModal.classList.contains("active") && activeGame) {
      setTimeout(() => checkOrientationLandscapePrompt(activeGame), 100);
      broadcastViewportResize(false);
    }
  });

  window.addEventListener("orientationchange", () => {
    if (gameModal && gameModal.classList.contains("active") && activeGame) {
      setTimeout(() => checkOrientationLandscapePrompt(activeGame), 150);
      broadcastViewportResize(true);
    }
  });

  // --- Catalog Layout Switcher Engine ---
  function setCatalogView(view) {
    currentCatalogView = view === "floor" && window.ArcadeFloor ? "floor" : view === "list" ? "list" : "grid";
    ArcadeStorageResilience.safeSetItem(CATALOG_VIEW_STORAGE_KEY, currentCatalogView);
    for (const button of document.querySelectorAll(".catalog-view-switcher [data-view]")) {
      const active = button.dataset.view === currentCatalogView;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    }
    if (gamesGrid) renderGames();
  }

  function initCatalogViewSwitcher() {
    const gridBtn = document.getElementById("view-grid-btn");
    const listBtn = document.getElementById("view-list-btn");
    if (gridBtn) {
      gridBtn.addEventListener("click", () => setCatalogView("grid"));
    }
    if (listBtn) {
      listBtn.addEventListener("click", () => setCatalogView("list"));
    }
    const floorBtn = document.getElementById("view-floor-btn");
    if (floorBtn) floorBtn.addEventListener("click", () => setCatalogView("floor"));
    setCatalogView(currentCatalogView);
  }

  // --- A-Z Alphabetical Catalog Jump Bar Engine ---
  function updateLetterAvailability() {
    const letterButtons = document.querySelectorAll(".az-btn[data-letter]");
    if (!letterButtons.length || typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) return;

    const letterCounts = {};
    GAMES_REGISTRY.forEach((g) => {
      if (!g || !g.title) return;
      const firstChar = g.title.trim().charAt(0).toUpperCase();
      const key = /[A-Z]/.test(firstChar) ? firstChar : "#";
      letterCounts[key] = (letterCounts[key] || 0) + 1;
    });

    letterButtons.forEach((btn) => {
      const letter = btn.getAttribute("data-letter");
      if (!letter || letter.toLowerCase() === "all") {
        btn.disabled = false;
        btn.classList.remove("disabled");
        btn.removeAttribute("aria-disabled");
        return;
      }

      const count = letterCounts[letter] || 0;
      if (count === 0) {
        btn.disabled = true;
        btn.classList.add("disabled");
        btn.setAttribute("aria-disabled", "true");
        btn.title = `No games starting with ${letter}`;
      } else {
        btn.disabled = false;
        btn.classList.remove("disabled");
        btn.removeAttribute("aria-disabled");
        btn.title = `${count} game${count !== 1 ? "s" : ""} starting with ${letter}`;
      }
    });
  }

  function resetLetterFilterUI() {
    currentLetterFilter = "all";
    const letterButtons = document.querySelectorAll(".az-btn[data-letter]");
    letterButtons.forEach((b) => {
      const isAll = b.getAttribute("data-letter") === "all";
      b.classList.toggle("active", isAll);
      b.setAttribute("aria-pressed", isAll ? "true" : "false");
    });
  }

  function initAZJumpBar() {
    updateLetterAvailability();
    const letterButtons = document.querySelectorAll(".az-btn[data-letter]");
    letterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled || btn.classList.contains("disabled")) return;
        const letter = btn.getAttribute("data-letter");
        if (!letter) return;

        currentLetterFilter = letter.toLowerCase() === "all" ? "all" : letter.toUpperCase();

        letterButtons.forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle("active", isActive);
          b.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        renderGames();
      });
    });

    // Keyboard toolbar navigation support (Left/Right arrows)
    const jumpBar = document.getElementById("az-jump-bar");
    if (jumpBar) {
      jumpBar.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const enabledButtons = Array.from(document.querySelectorAll(".az-btn[data-letter]:not(:disabled):not(.disabled)"));
          const currentIndex = enabledButtons.indexOf(document.activeElement);
          if (currentIndex !== -1) {
            e.preventDefault();
            const nextIndex = e.key === "ArrowRight"
              ? (currentIndex + 1) % enabledButtons.length
              : (currentIndex - 1 + enabledButtons.length) % enabledButtons.length;
            enabledButtons[nextIndex].focus();
          }
        }
      });
    }
  }

  // ========================================================
  // STRICT URL QUERY SANITIZATION & DEEP-LINK VALIDATOR (#496)
  // Protects against path traversal, XSS injection, and rogue script links
  // ========================================================
  const URL_PARAM_VALIDATOR = {
    GAME_ID_REGEX: /^[a-z0-9_-]{2,64}$/i,
    CATEGORY_REGEX: /^[a-z0-9_-]{2,32}$/i,
    MAX_SEARCH_QUERY_LENGTH: 80,

    sanitizeSearch(q) {
      if (!q || typeof q !== 'string') return '';
      return q
        .slice(0, this.MAX_SEARCH_QUERY_LENGTH)
        .replace(/[<>"'\\]/g, '')
        .trim();
    },

    sanitizeGameId(id) {
      if (!id || typeof id !== 'string') return null;
      const clean = id.trim().toLowerCase();
      // Reject directory traversal, protocol schemes, slashes
      if (clean.includes('..') || clean.includes('/') || clean.includes('\\') || clean.includes(':')) {
        console.warn('[ArcadeVerse Security] Illegal path traversal characters detected in URL game parameter:', id);
        return null;
      }
      return this.GAME_ID_REGEX.test(clean) ? clean : null;
    },

    sanitizeCategory(cat) {
      if (!cat || typeof cat !== 'string') return 'all';
      const clean = cat.trim().toLowerCase();
      return this.CATEGORY_REGEX.test(clean) ? clean : 'all';
    }
  };

  function showDeepLinkNotFoundNotice(requestedId) {
    announceToScreenReader(`Game not found: The requested game link "${requestedId}" does not exist or has been relocated.`);
    const existing = document.getElementById('deep-link-error-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'deep-link-error-toast';
    toast.className = 'deep-link-notice-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="deep-link-notice-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="deep-link-notice-content">
        <strong>Game Not Found</strong>
        The requested game link <code>${typeof ArcadeSanitizer !== 'undefined' ? ArcadeSanitizer.escapeHTML(requestedId) : requestedId}</code> does not exist or has been relocated.
      </div>
      <button type="button" class="deep-link-notice-close" aria-label="Dismiss">&times;</button>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));

    toast.querySelector('.deep-link-notice-close').addEventListener('click', () => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  // --- History API Deep-Linking & State Initialization ---
  function initURLDeepLinking() {
    try {
      const url = new URL(window.location.href);
      const rawCategory = url.searchParams.get("category");
      const rawSearch = url.searchParams.get("search");
      const rawGame = url.searchParams.get("game");

      const categoryParam = rawCategory ? URL_PARAM_VALIDATOR.sanitizeCategory(rawCategory) : null;
      const searchParam = rawSearch ? URL_PARAM_VALIDATOR.sanitizeSearch(rawSearch) : null;
      const validGameId = rawGame ? URL_PARAM_VALIDATOR.sanitizeGameId(rawGame) : null;

      if (categoryParam) {
        const matchedPill = Array.from(categoryPills).find(
          (p) => (p.getAttribute("data-category") || "").toLowerCase() === categoryParam.toLowerCase()
        );
        if (matchedPill) {
          categoryPills.forEach((p) => {
            p.classList.remove("active");
            p.setAttribute("aria-selected", "false");
          });
          matchedPill.classList.add("active");
          matchedPill.setAttribute("aria-selected", "true");
          currentCategory = matchedPill.getAttribute("data-category");
        } else {
          currentCategory = categoryParam;
        }
      }

      if (searchParam) {
        searchQuery = searchParam.toLowerCase();
        if (searchInput) {
          searchInput.value = searchParam;
        }
        if (searchClearBtn) {
          searchClearBtn.hidden = !searchParam;
        }
      }

      buildTagChips();
      renderGames();

      if (rawGame) {
        if (!validGameId) {
          showDeepLinkNotFoundNotice(rawGame);
          // Strip malicious/invalid game param from URL address bar
          url.searchParams.delete("game");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : ""));
        } else if (typeof GAMES_REGISTRY !== "undefined" && Array.isArray(GAMES_REGISTRY)) {
          const targetGame = GAMES_REGISTRY.find(
            (g) => g && g.id && g.id.toLowerCase() === validGameId
          );
          if (targetGame) {
            openGameModal(targetGame, null, true);
          } else {
            showDeepLinkNotFoundNotice(rawGame);
            url.searchParams.delete("game");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : ""));
          }
        }
      }
    } catch (_) {
      buildTagChips();
      renderGames();
    }
  }

  // Handle browser Back & Forward navigation
  window.addEventListener("popstate", () => {
    try {
      const url = new URL(window.location.href);
      const gameParam = url.searchParams.get("game");
      const categoryParam = url.searchParams.get("category");
      const searchParam = url.searchParams.get("search");

      // 1. Handle Game Modal back/forward
      if (!gameParam) {
        if (gameModal && gameModal.classList.contains("active")) {
          closeGameModal(true);
        }
      } else {
        const sanitizedGameId = URL_PARAM_VALIDATOR.sanitizeGameId(gameParam);
        if (sanitizedGameId && (!activeGame || (activeGame.id && activeGame.id.toLowerCase() !== sanitizedGameId))) {
          const targetGame = Array.isArray(GAMES_REGISTRY) && GAMES_REGISTRY.find((g) => g && g.id && g.id.toLowerCase() === sanitizedGameId);
          if (targetGame) {
            openGameModal(targetGame, null, true);
          }
        }
      }

      // 2. Handle Category back/forward
      const targetCategory = (categoryParam && categoryParam.trim()) || "all";
      if (targetCategory.toLowerCase() !== currentCategory.toLowerCase()) {
        const matchedPill = Array.from(categoryPills).find(
          (p) => (p.getAttribute("data-category") || "").toLowerCase() === targetCategory.toLowerCase()
        );
        currentCategory = matchedPill ? matchedPill.getAttribute("data-category") : targetCategory;
        categoryPills.forEach((p) => {
          const isMatch = (p.getAttribute("data-category") || "").toLowerCase() === currentCategory.toLowerCase();
          p.classList.toggle("active", isMatch);
          p.setAttribute("aria-selected", isMatch ? "true" : "false");
        });
        buildTagChips();
        renderGames();
      }

      // 3. Handle Search back/forward
      const targetSearch = (searchParam && searchParam.trim()) || "";
      if (targetSearch.toLowerCase() !== searchQuery.toLowerCase()) {
        searchQuery = targetSearch.toLowerCase();
        if (searchInput) searchInput.value = targetSearch;
        if (searchClearBtn) searchClearBtn.hidden = !targetSearch;
        closeAutocomplete();
        renderGames();
      }
    } catch (_) {}
  });

  // ========================================================
  // STORAGE RECOVERY TELEMETRY LISTENER (#495)
  // Re-syncs catalog state and favorites if save backup is restored
  // ========================================================
  window.addEventListener("arcadeverse:storage-restored", (e) => {
    try {
      console.info("[ArcadeApp] Save backup restore event received, refreshing favorites and catalog state...", e.detail);
      favoritesSet = null; // force reload from localStorage
      updateFavoritesBadge();
      renderGames();
    } catch (err) {
      console.warn("[ArcadeApp] Failed to refresh UI after storage restore:", err);
    }
  });

  // ========================================================
  // CORS & THIRD-PARTY FONT/RESOURCE PRELOAD RESILIENCE (#494)
  // Detects font preload timeouts or CORS failures and falls back gracefully
  // ========================================================
  function initFontPreloadResilience() {
    if (!("fonts" in document)) return;

    document.documentElement.classList.add("fonts-loading");

    const fontTimeout = setTimeout(() => {
      if (document.documentElement.classList.contains("fonts-loading")) {
        document.documentElement.classList.remove("fonts-loading");
        document.documentElement.classList.add("fonts-failed");
        console.warn("[ArcadeVerse] Webfonts preload timed out (3s). Switched to system font fallbacks.");
        showFontFallbackToast();
      }
    }, 3000);

    Promise.all([
      document.fonts.load('16px "Cambria Math"'),
      document.fonts.load('16px "Permanent Marker"'),
      document.fonts.load('16px "JetBrains Mono"')
    ])
      .then(() => {
        clearTimeout(fontTimeout);
        document.documentElement.classList.remove("fonts-loading");
        document.documentElement.classList.add("fonts-loaded");
      })
      .catch((err) => {
        clearTimeout(fontTimeout);
        document.documentElement.classList.remove("fonts-loading");
        document.documentElement.classList.add("fonts-failed");
        console.warn("[ArcadeVerse] Webfonts preload rejected (CORS or network drop). Switched to system fallbacks.", err);
        showFontFallbackToast();
      });
  }

  function showFontFallbackToast() {
    if (document.getElementById("font-preload-notice-banner")) return;
    const banner = document.createElement("div");
    banner.id = "font-preload-notice-banner";
    banner.className = "font-preload-notice";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <div class="font-preload-notice-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="font-preload-notice-content">
        <strong>Offline Typography Fallback</strong>
        External webfonts were unavailable. System typography was loaded seamlessly with zero layout shift.
      </div>
      <button type="button" class="font-preload-notice-close" aria-label="Dismiss typography notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    document.body.appendChild(banner);
    requestAnimationFrame(() => {
      banner.classList.add("visible");
    });

    const closeBtn = banner.querySelector(".font-preload-notice-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        banner.classList.remove("visible");
        setTimeout(() => banner.remove(), 300);
      });
    }

    // Auto-dismiss notice after 6 seconds
    setTimeout(() => {
      if (banner.parentElement) {
        banner.classList.remove("visible");
        setTimeout(() => banner.remove(), 300);
      }
    }, 6000);
  }

  // ========================================================
  // ARCADE GAME MUTATOR & CHALLENGE MODIFIER WHEEL SUBSYSTEM
  // ========================================================
  const CHALLENGE_MUTATORS = [
    {
      id: "mirror-dimension",
      name: "Mirror Dimension",
      category: "Visual Reflex",
      badgeColor: "cyan",
      description: "Spatial coordinates inverted! Left is right and right is left.",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 2 21 6 17 10"></polyline><line x1="21" y1="6" x2="9" y2="6"></line><path d="M3 10v6a4 4 0 0 0 4 4h10"></path></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "scaleX(-1)";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "speed-blitz",
      name: "90-Second Speed Blitz",
      category: "Time Attack",
      badgeColor: "amber",
      description: "Achieve target score or clear the stage before the 90-second buzzer!",
      timerSeconds: 90,
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "cyber-noir",
      name: "Cyber Noir Monolith",
      category: "Aesthetic Filter",
      badgeColor: "slate",
      description: "Play through high-contrast retro monochrome noir phosphor.",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "grayscale(1) contrast(1.45) brightness(0.95)";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "terminal-phosphor",
      name: "Terminal Phosphor Radar",
      category: "Aesthetic Filter",
      badgeColor: "emerald",
      description: "Vintage CRT monochrome green radar phosphor display.",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "sepia(1) hue-rotate(85deg) saturate(3) contrast(1.2)";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "vaporwave-overdrive",
      name: "Vaporwave Overdrive",
      category: "Aesthetic Filter",
      badgeColor: "fuchsia",
      description: "Supercharged chromatic spectrum shift and hyper-saturation.",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "hue-rotate(180deg) saturate(2)";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "one-handed-commando",
      name: "One-Handed Commando",
      category: "Physical Rule",
      badgeColor: "blue",
      description: "Play this session strictly using only your non-dominant hand!",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "hardcore-ironman",
      name: "Hardcore Iron-Man",
      category: "Precision Rule",
      badgeColor: "rose",
      description: "Zero margin for error. If you take damage or lose a life, instant restart!",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    },
    {
      id: "letterbox-aperture",
      name: "Letterbox Aperture",
      category: "Visual Challenge",
      badgeColor: "purple",
      description: "Narrow aperture widescreen letterbox restricts peripheral vision.",
      iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="2"></rect><line x1="2" y1="8" x2="22" y2="8"></line><line x1="2" y1="16" x2="22" y2="16"></line></svg>',
      apply: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "inset(12% 0 12% 0)";
      },
      cleanup: (frameWrap, iframe) => {
        iframe.style.transform = "";
        iframe.style.filter = "";
        iframe.style.clipPath = "";
      }
    }
  ];

  let activeSessionMutator = null;
  let mutatorTimerInterval = null;
  let mutatorRemainingSeconds = 0;
  let openMutatorWheelDialog = () => {};
  let applyMutatorToSession = () => {};

  // Procedural Web Audio Synthesizer for Retro Arcade Wheel
  let mutatorAudioCtx = null;
  function getMutatorAudioCtx() {
    try {
      if (!mutatorAudioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) mutatorAudioCtx = new AudioClass();
      }
      if (mutatorAudioCtx && mutatorAudioCtx.state === "suspended") {
        mutatorAudioCtx.resume().catch(() => {});
      }
    } catch (_) {}
    return mutatorAudioCtx;
  }

  function playReelTick() {
    try {
      const ctx = getMutatorAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(620 + Math.random() * 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (_) {}
  }

  function playReelSnap() {
    try {
      const ctx = getMutatorAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch (_) {}
  }

  function initArcadeMutatorWheel() {
    const modalControls = document.querySelector(".modal-controls");
    if (!modalControls || document.getElementById("modal-mutator-btn")) return;

    // Create toolbar trigger button
    const mutatorBtn = document.createElement("button");
    mutatorBtn.id = "modal-mutator-btn";
    mutatorBtn.className = "btn btn-sm btn-icon modal-mutator-btn";
    mutatorBtn.type = "button";
    mutatorBtn.title = "Challenge Mutators (Alt+M)";
    mutatorBtn.setAttribute("aria-label", "Open Challenge Mutator Wheel");
    mutatorBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="modal-mutator-icon" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 8h.01"></path>
        <path d="M8 8h.01"></path>
        <path d="M8 16h.01"></path>
        <path d="M16 16h.01"></path>
        <path d="M12 12h.01"></path>
      </svg>
      <span class="mutator-active-indicator" aria-hidden="true"></span>
    `;

    // Mount before close button
    const closeBtn = document.getElementById("close-modal-btn");
    if (closeBtn) {
      modalControls.insertBefore(mutatorBtn, closeBtn);
    } else {
      modalControls.appendChild(mutatorBtn);
    }

    // Build Mutator Spinner Dialog
    let dialogEl = document.getElementById("arcade-mutator-dialog");
    if (!dialogEl) {
      dialogEl = document.createElement("div");
      dialogEl.id = "arcade-mutator-dialog";
      dialogEl.className = "mutator-dialog-backdrop";
      dialogEl.setAttribute("role", "dialog");
      dialogEl.setAttribute("aria-modal", "true");
      dialogEl.setAttribute("aria-labelledby", "mutator-dialog-title");
      dialogEl.setAttribute("aria-hidden", "true");
      dialogEl.innerHTML = `
        <div class="mutator-dialog-card">
          <div class="mutator-dialog-header">
            <div class="mutator-dialog-heading-wrap">
              <span class="mutator-dialog-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                SESSION MODIFIERS
              </span>
              <h2 id="mutator-dialog-title" class="mutator-dialog-title">Arcade Challenge Mutator Wheel</h2>
              <p class="mutator-dialog-subtitle">Spin to assign an optional kinetic or visual modifier to this play session.</p>
            </div>
            <button type="button" class="mutator-dialog-close-btn" id="mutator-dialog-close-btn" aria-label="Close Mutator Wheel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="mutator-reel-container">
            <div class="mutator-reel-frame">
              <div class="mutator-reel-pointer" aria-hidden="true"></div>
              <div class="mutator-reel-viewport">
                <div class="mutator-reel-track" id="mutator-reel-track"></div>
              </div>
            </div>
          </div>

          <div class="mutator-preview-card" id="mutator-preview-card">
            <div class="mutator-preview-icon" id="mutator-preview-icon"></div>
            <div class="mutator-preview-details">
              <div class="mutator-preview-meta">
                <span class="mutator-preview-category" id="mutator-preview-category">Select or Spin</span>
                <span class="mutator-preview-name" id="mutator-preview-name">Arcade Mutator</span>
              </div>
              <p class="mutator-preview-desc" id="mutator-preview-desc">Hit the Spin Wheel button below to randomly draw a game modifier.</p>
            </div>
          </div>

          <div class="mutator-dialog-actions">
            <button type="button" class="btn btn-secondary" id="mutator-spin-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <span>SPIN WHEEL</span>
            </button>
            <button type="button" class="btn btn-primary" id="mutator-apply-btn" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Apply Mutator</span>
            </button>
            <button type="button" class="btn btn-outline mutator-clear-btn" id="mutator-clear-btn" style="display: none;">
              <span>Clear Mutator</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(dialogEl);
    }

    const reelTrack = dialogEl.querySelector("#mutator-reel-track");
    const previewIcon = dialogEl.querySelector("#mutator-preview-icon");
    const previewCat = dialogEl.querySelector("#mutator-preview-category");
    const previewName = dialogEl.querySelector("#mutator-preview-name");
    const previewDesc = dialogEl.querySelector("#mutator-preview-desc");
    const spinBtn = dialogEl.querySelector("#mutator-spin-btn");
    const applyBtn = dialogEl.querySelector("#mutator-apply-btn");
    const clearBtn = dialogEl.querySelector("#mutator-clear-btn");
    const closeDialogBtn = dialogEl.querySelector("#mutator-dialog-close-btn");

    let isSpinning = false;
    let selectedMutator = null;

    // Populate reel cards (3 full cycles for smooth slot-reel momentum)
    function populateReelTrack() {
      if (!reelTrack) return;
      reelTrack.innerHTML = "";
      const cycles = 3;
      for (let c = 0; c < cycles; c++) {
        CHALLENGE_MUTATORS.forEach((m) => {
          const card = document.createElement("div");
          card.className = "mutator-reel-item";
          card.dataset.mutatorId = m.id;
          card.innerHTML = `
            <div class="reel-item-icon">${m.iconSvg}</div>
            <div class="reel-item-text">
              <span class="reel-item-title">${m.name}</span>
              <span class="reel-item-cat">${m.category}</span>
            </div>
          `;
          reelTrack.appendChild(card);
        });
      }
    }
    populateReelTrack();

    function updatePreview(mutator) {
      if (!mutator) {
        previewIcon.innerHTML = CHALLENGE_MUTATORS[0].iconSvg;
        previewCat.textContent = "Select or Spin";
        previewName.textContent = "Arcade Mutator";
        previewDesc.textContent = "Hit the Spin Wheel button below to randomly draw a game modifier.";
        applyBtn.disabled = true;
        selectedMutator = null;
        return;
      }
      selectedMutator = mutator;
      previewIcon.innerHTML = mutator.iconSvg;
      previewCat.textContent = mutator.category;
      previewName.textContent = mutator.name;
      previewDesc.textContent = mutator.description;
      applyBtn.disabled = false;
    }

    function spinReel() {
      if (isSpinning) return;
      isSpinning = true;
      spinBtn.disabled = true;
      applyBtn.disabled = true;

      const targetIndex = Math.floor(Math.random() * CHALLENGE_MUTATORS.length);
      const chosenMutator = CHALLENGE_MUTATORS[targetIndex];

      const itemHeight = 60;
      const cycleOffset = CHALLENGE_MUTATORS.length * itemHeight;
      const targetY = cycleOffset + (targetIndex * itemHeight);

      // Play staggered tick sounds
      const totalTicks = 12;
      for (let t = 0; t < totalTicks; t++) {
        setTimeout(() => {
          playReelTick();
        }, t * (55 + t * 6));
      }

      reelTrack.style.transition = "transform 0.9s cubic-bezier(0.12, 0.88, 0.22, 1.0)";
      reelTrack.style.transform = `translateY(-${targetY}px)`;

      setTimeout(() => {
        isSpinning = false;
        spinBtn.disabled = false;
        applyBtn.disabled = false;
        playReelSnap();
        updatePreview(chosenMutator);

        // Highlight selected reel card
        const allItems = reelTrack.querySelectorAll(".mutator-reel-item");
        allItems.forEach(it => it.classList.remove("selected"));
        const selectedEl = allItems[CHALLENGE_MUTATORS.length + targetIndex];
        if (selectedEl) selectedEl.classList.add("selected");
      }, 950);
    }

    openMutatorWheelDialog = () => {
      dialogEl.classList.add("active");
      dialogEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("mutator-dialog-open");

      if (activeSessionMutator) {
        clearBtn.style.display = "inline-flex";
        updatePreview(activeSessionMutator);
      } else {
        clearBtn.style.display = "none";
        if (!selectedMutator) {
          updatePreview(null);
        }
      }
      setTimeout(() => spinBtn.focus(), 80);
    };

    function closeMutatorWheelDialog() {
      dialogEl.classList.remove("active");
      dialogEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("mutator-dialog-open");
      if (mutatorBtn) mutatorBtn.focus();
    }

    closeDialogBtn.addEventListener("click", closeMutatorWheelDialog);
    dialogEl.addEventListener("click", (e) => {
      if (e.target === dialogEl) closeMutatorWheelDialog();
    });

    spinBtn.addEventListener("click", spinReel);

    applyBtn.addEventListener("click", () => {
      if (!selectedMutator) return;
      applyMutatorToSession(selectedMutator);
      closeMutatorWheelDialog();
    });

    clearBtn.addEventListener("click", () => {
      resetActiveMutatorSession();
      closeMutatorWheelDialog();
    });

    document.addEventListener("keydown", (e) => {
      if (dialogEl.classList.contains("active")) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeMutatorWheelDialog();
        } else if ((e.key === " " || e.key === "Enter") && document.activeElement === spinBtn) {
          e.preventDefault();
          spinReel();
        }
      }
    });

    // LocalStorage completion persistence
    const MUTATOR_STORAGE_KEY = "arcadeverse_mutator_completions";

    function getCompletedMutators(gameId) {
      if (!gameId) return [];
      try {
        const raw = localStorage.getItem(MUTATOR_STORAGE_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data[gameId]) ? data[gameId] : [];
      } catch (_) {
        return [];
      }
    }

    function markMutatorCompleted(gameId, mutatorId) {
      if (!gameId || !mutatorId) return;
      try {
        let data = {};
        const raw = localStorage.getItem(MUTATOR_STORAGE_KEY);
        if (raw) data = JSON.parse(raw) || {};
        if (!Array.isArray(data[gameId])) data[gameId] = [];
        if (!data[gameId].includes(mutatorId)) {
          data[gameId].push(mutatorId);
        }
        localStorage.setItem(MUTATOR_STORAGE_KEY, JSON.stringify(data));
      } catch (_) {}
    }

    function playVictoryFanfare() {
      try {
        const ctx = getMutatorAudioCtx();
        if (!ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.09);
          osc.stop(ctx.currentTime + idx * 0.09 + 0.32);
        });
      } catch (_) {}
    }

    function triggerConfettiBurst() {
      const container = modalWindow || document.body;
      const existing = document.getElementById("mutator-confetti-canvas");
      if (existing) existing.remove();

      const canvas = document.createElement("canvas");
      canvas.id = "mutator-confetti-canvas";
      canvas.className = "mutator-confetti-canvas";
      canvas.width = container.clientWidth || 800;
      canvas.height = container.clientHeight || 600;
      container.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const colors = ["#00f5ff", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#38bdf8"];
      const particles = [];
      const count = 48;

      for (let i = 0; i < count; i++) {
        particles.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 120,
          y: canvas.height * 0.25 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 9,
          vy: -Math.random() * 7 - 3,
          size: Math.random() * 7 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 14,
          alpha: 1.0
        });
      }

      let animHandle = null;
      const startTime = Date.now();

      function render() {
        const elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.28;
          p.vx *= 0.98;
          p.rotation += p.rotSpeed;
          p.alpha = Math.max(0, 1 - (elapsed / 1600));

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }

        if (elapsed < 1600) {
          animHandle = requestAnimationFrame(render);
        } else {
          if (canvas.parentElement) canvas.remove();
        }
      }
      render();
    }

    // Build Mutator HUD Ribbon
    let ribbonEl = document.getElementById("modal-mutator-ribbon");
    if (!ribbonEl && modalWindow) {
      ribbonEl = document.createElement("div");
      ribbonEl.id = "modal-mutator-ribbon";
      ribbonEl.className = "modal-mutator-ribbon";
      ribbonEl.setAttribute("role", "region");
      ribbonEl.setAttribute("aria-label", "Active Game Mutator Challenge");
      ribbonEl.innerHTML = `
        <div class="mutator-ribbon-left">
          <span class="mutator-ribbon-badge" id="mutator-ribbon-badge">
            <span class="mutator-ribbon-icon" id="mutator-ribbon-icon"></span>
            <span class="mutator-ribbon-name" id="mutator-ribbon-name">Modifier</span>
          </span>
          <span class="mutator-ribbon-desc" id="mutator-ribbon-desc">Modifier constraint</span>
        </div>
        <div class="mutator-ribbon-center" id="mutator-ribbon-timer-wrap" style="display: none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span class="mutator-ribbon-timer" id="mutator-ribbon-timer">01:30</span>
        </div>
        <div class="mutator-ribbon-right">
          <button type="button" class="btn btn-sm mutator-complete-btn" id="mutator-complete-btn" title="Mark challenge complete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span id="mutator-complete-text">Mark Complete</span>
          </button>
          <button type="button" class="btn btn-sm btn-icon mutator-ribbon-btn" id="mutator-ribbon-reroll-btn" title="Reroll Mutator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          </button>
          <button type="button" class="btn btn-sm btn-icon mutator-ribbon-btn" id="mutator-ribbon-dismiss-btn" title="Clear Mutator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
      if (modalFrameWrapper) {
        modalWindow.insertBefore(ribbonEl, modalFrameWrapper);
      } else {
        modalWindow.appendChild(ribbonEl);
      }
    }

    const ribbonIcon = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-icon") : null;
    const ribbonName = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-name") : null;
    const ribbonDesc = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-desc") : null;
    const ribbonTimerWrap = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-timer-wrap") : null;
    const ribbonTimer = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-timer") : null;
    const completeBtn = ribbonEl ? ribbonEl.querySelector("#mutator-complete-btn") : null;
    const completeText = ribbonEl ? ribbonEl.querySelector("#mutator-complete-text") : null;
    const rerollRibbonBtn = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-reroll-btn") : null;
    const dismissRibbonBtn = ribbonEl ? ribbonEl.querySelector("#mutator-ribbon-dismiss-btn") : null;

    if (rerollRibbonBtn) {
      rerollRibbonBtn.addEventListener("click", () => {
        openMutatorWheelDialog();
      });
    }

    if (dismissRibbonBtn) {
      dismissRibbonBtn.addEventListener("click", () => {
        resetActiveMutatorSession();
      });
    }

    if (completeBtn) {
      completeBtn.addEventListener("click", () => {
        if (!activeSessionMutator || !activeGame) return;
        markMutatorCompleted(activeGame.id, activeSessionMutator.id);
        completeBtn.classList.add("completed");
        if (completeText) completeText.textContent = "Completed!";
        playVictoryFanfare();
        triggerConfettiBurst();
      });
    }

    function formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }

    applyMutatorToSession = (mutator) => {
      if (!mutator) return;

      if (activeSessionMutator && typeof activeSessionMutator.cleanup === "function") {
        try {
          activeSessionMutator.cleanup(modalFrameWrapper, gameIframe);
        } catch (_) {}
      }
      if (mutatorTimerInterval) {
        clearInterval(mutatorTimerInterval);
        mutatorTimerInterval = null;
      }

      activeSessionMutator = mutator;
      try {
        mutator.apply(modalFrameWrapper, gameIframe);
      } catch (_) {}

      const indicator = document.querySelector(".mutator-active-indicator");
      if (indicator) indicator.classList.add("active");

      if (ribbonEl) {
        if (ribbonIcon) ribbonIcon.innerHTML = mutator.iconSvg;
        if (ribbonName) ribbonName.textContent = mutator.name;
        if (ribbonDesc) ribbonDesc.textContent = mutator.description;

        const completedList = activeGame ? getCompletedMutators(activeGame.id) : [];
        if (completedList.includes(mutator.id)) {
          if (completeBtn) completeBtn.classList.add("completed");
          if (completeText) completeText.textContent = "Completed!";
        } else {
          if (completeBtn) completeBtn.classList.remove("completed");
          if (completeText) completeText.textContent = "Mark Complete";
        }

        if (mutator.timerSeconds && ribbonTimerWrap && ribbonTimer) {
          ribbonTimerWrap.style.display = "inline-flex";
          ribbonTimerWrap.classList.remove("is-warning", "is-expired");
          mutatorRemainingSeconds = mutator.timerSeconds;
          ribbonTimer.textContent = formatTime(mutatorRemainingSeconds);

          mutatorTimerInterval = setInterval(() => {
            mutatorRemainingSeconds--;
            if (mutatorRemainingSeconds <= 10 && mutatorRemainingSeconds > 0) {
              ribbonTimerWrap.classList.add("is-warning");
              playReelTick();
            }
            if (mutatorRemainingSeconds <= 0) {
              clearInterval(mutatorTimerInterval);
              mutatorTimerInterval = null;
              ribbonTimer.textContent = "TIME UP!";
              ribbonTimerWrap.classList.remove("is-warning");
              ribbonTimerWrap.classList.add("is-expired");
            } else {
              ribbonTimer.textContent = formatTime(mutatorRemainingSeconds);
            }
          }, 1000);
        } else if (ribbonTimerWrap) {
          ribbonTimerWrap.style.display = "none";
        }

        ribbonEl.classList.add("active");
      }
    };

    // Reset session helper
    resetActiveMutatorSession = () => {
      if (mutatorTimerInterval) {
        clearInterval(mutatorTimerInterval);
        mutatorTimerInterval = null;
      }
      mutatorRemainingSeconds = 0;
      if (activeSessionMutator && typeof activeSessionMutator.cleanup === "function") {
        try {
          activeSessionMutator.cleanup(modalFrameWrapper, gameIframe);
        } catch (_) {}
      }
      activeSessionMutator = null;
      if (ribbonEl) ribbonEl.classList.remove("active");
      const indicator = document.querySelector(".mutator-active-indicator");
      if (indicator) indicator.classList.remove("active");
      const confetti = document.getElementById("mutator-confetti-canvas");
      if (confetti) confetti.remove();
    };

    mutatorBtn.addEventListener("click", () => {
      if (typeof openMutatorWheelDialog === "function") {
        openMutatorWheelDialog();
      }
    });

    // Keyboard shortcut: Alt+M toggles mutator wheel
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "m" || e.key === "M")) {
        if (gameModal && gameModal.classList.contains("active")) {
          e.preventDefault();
          if (typeof openMutatorWheelDialog === "function") {
            openMutatorWheelDialog();
          }
        }
      }
    });
  }

  // Initial render
  initFontPreloadResilience();
  initCatalogViewSwitcher();
  initAZJumpBar();
  initURLDeepLinking();
  initArcadeMutatorWheel();
});

  // ========================================================
  // INTERACTIVE GAME CONTROLS LEGEND & INPUT MAP ENGINE (#Feature)
  // Dynamic extraction, keymap visualization, and toolbar integration
  // ========================================================
  let controlsLegendDialog = null;
  let controlsLegendBtn = null;
  let closeControlsLegend = () => {};

  function getGameControlsConfig(game) {
    if (!game) {
      return {
        bindings: [
          { keys: ["W", "A", "S", "D"], codeKeys: ["KeyW", "KeyA", "KeyS", "KeyD"], action: "Directional Movement" },
          { keys: ["↑", "←", "↓", "→"], codeKeys: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"], action: "Alternative Directional Move" },
          { keys: ["Space"], codeKeys: ["Space"], action: "Primary Action / Jump" },
          { keys: ["P"], codeKeys: ["KeyP"], action: "Pause / Resume Game" },
          { keys: ["R"], codeKeys: ["KeyR"], action: "Restart Session" },
          { keys: ["Esc"], codeKeys: ["Escape"], action: "Close Game Player" }
        ],
        activeKeys: new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space", "KeyP", "KeyR", "Escape"]),
        touchControls: [
          { label: "Tap Screen", desc: "Jump / Fire / Confirm" },
          { label: "Swipe / Drag", desc: "Directional Motion / Aim" }
        ]
      };
    }

    const category = (game.category || "").toLowerCase();
    const tags = Array.isArray(game.tags) ? game.tags.map((t) => t.toLowerCase()) : [];
    const title = (game.title || "").toLowerCase();
    const desc = (game.description || "").toLowerCase();

    const isShooter = category.includes("shooter") || tags.includes("shooter") || desc.includes("shoot") || desc.includes("blast") || desc.includes("laser");
    const isPlatformer = category.includes("platformer") || tags.includes("platformer") || desc.includes("jump") || desc.includes("bounce");
    const isRacing = category.includes("racing") || tags.includes("racing") || desc.includes("drive") || desc.includes("drift") || desc.includes("racer");
    const isPuzzle = category.includes("puzzle") || tags.includes("puzzle") || category.includes("board") || tags.includes("logic") || tags.includes("word");
    const isRhythm = category.includes("rhythm") || tags.includes("rhythm") || tags.includes("music") || title.includes("typer") || tags.includes("typing");

    const bindings = [];
    const activeKeys = new Set(["KeyP", "KeyR", "Escape"]);

    if (isShooter) {
      bindings.push({ keys: ["W", "A", "S", "D"], codeKeys: ["KeyW", "KeyA", "KeyS", "KeyD"], action: "Thrust & Directional Steering" });
      bindings.push({ keys: ["↑", "←", "↓", "→"], codeKeys: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"], action: "Alternative Arrow Steering" });
      bindings.push({ keys: ["Space"], codeKeys: ["Space"], action: "Primary Fire / Plasma Blaster" });
      bindings.push({ keys: ["Shift"], codeKeys: ["ShiftLeft", "ShiftRight"], action: "Hyper-Drive / Afterburner Boost" });
      ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"].forEach((k) => activeKeys.add(k));
    } else if (isPlatformer || isRacing) {
      bindings.push({ keys: ["A", "D"], codeKeys: ["KeyA", "KeyD"], action: "Steer Left / Steer Right" });
      bindings.push({ keys: ["←", "→"], codeKeys: ["ArrowLeft", "ArrowRight"], action: "Alternative Steering Keys" });
      bindings.push({ keys: ["W", "↑", "Space"], codeKeys: ["KeyW", "ArrowUp", "Space"], action: "Jump / Accelerate" });
      bindings.push({ keys: ["S", "↓"], codeKeys: ["KeyS", "ArrowDown"], action: "Duck / Slide / Brake" });
      ["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "KeyW", "ArrowUp", "Space", "KeyS", "ArrowDown"].forEach((k) => activeKeys.add(k));
    } else if (isRhythm) {
      bindings.push({ keys: ["D", "F", "J", "K"], codeKeys: ["KeyD", "KeyF", "KeyJ", "KeyK"], action: "Rhythm Lane Beats" });
      bindings.push({ keys: ["Space"], codeKeys: ["Space"], action: "Bass Beat / Stomp" });
      bindings.push({ keys: ["A - Z"], codeKeys: ["KeyA", "KeyB", "KeyC", "KeyD", "KeyE", "KeyF"], action: "Typing Terminal Defense Keys" });
      ["KeyD", "KeyF", "KeyJ", "KeyK", "Space", "KeyA", "KeyB", "KeyC"].forEach((k) => activeKeys.add(k));
    } else if (isPuzzle) {
      bindings.push({ keys: ["Left Click"], codeKeys: [], action: "Select & Interact with Puzzle Elements" });
      bindings.push({ keys: ["↑", "←", "↓", "→"], codeKeys: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"], action: "Grid Shift / Tile Navigation" });
      bindings.push({ keys: ["Space"], codeKeys: ["Space"], action: "Confirm / Rotate Piece" });
      ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space"].forEach((k) => activeKeys.add(k));
    } else {
      bindings.push({ keys: ["W", "A", "S", "D"], codeKeys: ["KeyW", "KeyA", "KeyS", "KeyD"], action: "Directional Motion" });
      bindings.push({ keys: ["↑", "←", "↓", "→"], codeKeys: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"], action: "Alternative Arrow Movement" });
      bindings.push({ keys: ["Space"], codeKeys: ["Space"], action: "Primary Action / Start" });
      ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space"].forEach((k) => activeKeys.add(k));
    }

    bindings.push({ keys: ["P"], codeKeys: ["KeyP"], action: "Pause / Resume Gameplay" });
    bindings.push({ keys: ["R"], codeKeys: ["KeyR"], action: "Quick Restart Session" });
    bindings.push({ keys: ["Esc"], codeKeys: ["Escape"], action: "Exit Player Modal" });

    const touchControls = [
      { label: "Tap Screen", desc: "Jump / Fire / Select Action" },
      { label: "Swipe / Drag", desc: "Directional Motion / Aim Cursor" }
    ];

    return { bindings, activeKeys, touchControls };
  }

  function renderKeyboardVisualizer(activeKeys) {
    const isWActive = activeKeys.has("KeyW");
    const isAActive = activeKeys.has("KeyA");
    const isSActive = activeKeys.has("KeyS");
    const isDActive = activeKeys.has("KeyD");
    const isUpActive = activeKeys.has("ArrowUp");
    const isLeftActive = activeKeys.has("ArrowLeft");
    const isDownActive = activeKeys.has("ArrowDown");
    const isRightActive = activeKeys.has("ArrowRight");
    const isSpaceActive = activeKeys.has("Space");
    const isShiftActive = activeKeys.has("ShiftLeft") || activeKeys.has("ShiftRight");
    const isPActive = activeKeys.has("KeyP");
    const isRActive = activeKeys.has("KeyR");
    const isEscActive = activeKeys.has("Escape");

    return `
      <div class="legend-keyboard-grid">
        <div class="legend-keys-cluster-row">
          <!-- WASD Cluster -->
          <div class="legend-keys-cluster">
            <div class="legend-keys-wasd">
              <span class="legend-keycap legend-key-w ${isWActive ? 'highlighted' : ''}" data-code="KeyW" title="Key: W">W</span>
              <span class="legend-keycap legend-key-a ${isAActive ? 'highlighted' : ''}" data-code="KeyA" title="Key: A">A</span>
              <span class="legend-keycap legend-key-s ${isSActive ? 'highlighted' : ''}" data-code="KeyS" title="Key: S">S</span>
              <span class="legend-keycap legend-key-d ${isDActive ? 'highlighted' : ''}" data-code="KeyD" title="Key: D">D</span>
            </div>
          </div>

          <!-- Spacebar -->
          <div class="legend-keys-cluster">
            <span class="legend-keycap legend-keycap-space ${isSpaceActive ? 'highlighted' : ''}" data-code="Space" title="Spacebar">Spacebar</span>
          </div>

          <!-- Arrow Keys Cluster -->
          <div class="legend-keys-cluster">
            <div class="legend-keys-arrows">
              <span class="legend-keycap legend-key-up ${isUpActive ? 'highlighted' : ''}" data-code="ArrowUp" title="Up Arrow">↑</span>
              <span class="legend-keycap legend-key-left ${isLeftActive ? 'highlighted' : ''}" data-code="ArrowLeft" title="Left Arrow">←</span>
              <span class="legend-keycap legend-key-down ${isDownActive ? 'highlighted' : ''}" data-code="ArrowDown" title="Down Arrow">↓</span>
              <span class="legend-keycap legend-key-right ${isRightActive ? 'highlighted' : ''}" data-code="ArrowRight" title="Right Arrow">→</span>
            </div>
          </div>
        </div>

        <div class="legend-keys-cluster-row" style="margin-top: 4px;">
          <span class="legend-keycap legend-keycap-wide ${isShiftActive ? 'highlighted' : ''}" data-code="ShiftLeft" title="Shift">Shift</span>
          <span class="legend-keycap ${isPActive ? 'highlighted' : ''}" data-code="KeyP" title="P (Pause)">P</span>
          <span class="legend-keycap ${isRActive ? 'highlighted' : ''}" data-code="KeyR" title="R (Restart)">R</span>
          <span class="legend-keycap legend-keycap-wide ${isEscActive ? 'highlighted' : ''}" data-code="Escape" title="Esc (Close)">Esc</span>
        </div>
      </div>
    `;
  }

  function initControlsLegend() {
    const modalControls = document.querySelector(".modal-controls");
    const modalWindow = document.querySelector(".modal-window");
    if (!modalControls || !modalWindow) return;

    // Inject Toolbar Button before bug report button or close button
    controlsLegendBtn = document.createElement("button");
    controlsLegendBtn.type = "button";
    controlsLegendBtn.className = "btn btn-sm btn-icon btn-controls-legend";
    controlsLegendBtn.id = "modal-controls-legend-btn";
    controlsLegendBtn.title = "View Game Controls & Input Map (K)";
    controlsLegendBtn.setAttribute("aria-label", "View Game Controls and Input Map");
    controlsLegendBtn.setAttribute("aria-haspopup", "dialog");
    controlsLegendBtn.setAttribute("aria-expanded", "false");
    controlsLegendBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="20" height="16" x="2" y="4" rx="2"></rect>
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"></path>
      </svg>
    `;

    const reportBugBtn = document.getElementById("modal-report-bug-btn");
    const closeBtn = document.getElementById("close-modal-btn");
    if (reportBugBtn) {
      modalControls.insertBefore(controlsLegendBtn, reportBugBtn);
    } else if (closeBtn) {
      modalControls.insertBefore(controlsLegendBtn, closeBtn);
    } else {
      modalControls.appendChild(controlsLegendBtn);
    }

    // Build Floating Controls Legend Dialog
    controlsLegendDialog = document.createElement("div");
    controlsLegendDialog.id = "modal-controls-legend-dialog";
    controlsLegendDialog.className = "controls-legend-overlay";
    controlsLegendDialog.setAttribute("role", "dialog");
    controlsLegendDialog.setAttribute("aria-modal", "true");
    controlsLegendDialog.setAttribute("aria-labelledby", "controls-legend-title");
    controlsLegendDialog.style.display = "none";
    modalWindow.appendChild(controlsLegendDialog);

    function updateControlsContent() {
      const config = getGameControlsConfig(activeGame);
      const gameTitle = activeGame ? activeGame.title : "Community Arcade Game";

      const actionsHtml = config.bindings
        .map((b) => `
          <div class="legend-action-row">
            <div class="legend-action-keys">
              ${b.keys.map((k) => `<span class="legend-action-key-pill">${k}</span>`).join("")}
            </div>
            <span class="legend-action-desc">${b.action}</span>
          </div>
        `)
        .join("");

      const touchHtml = config.touchControls
        .map((t) => `
          <div class="legend-touch-card">
            <svg class="legend-touch-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
            <div class="legend-touch-text">
              <span class="legend-touch-label">${t.label}</span>
              <span class="legend-touch-desc">${t.desc}</span>
            </div>
          </div>
        `)
        .join("");

      controlsLegendDialog.innerHTML = `
        <div class="controls-legend-card">
          <div class="controls-legend-header">
            <div class="controls-legend-title-wrap">
              <svg class="legend-header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"></path>
              </svg>
              <div>
                <h4 id="controls-legend-title" class="controls-legend-title">Game Controls &amp; Input Map</h4>
                <span class="controls-legend-subtitle" id="controls-legend-game-name">${gameTitle}</span>
              </div>
            </div>
            <button type="button" class="btn-legend-close" id="close-controls-legend-btn" aria-label="Close controls legend (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="controls-legend-body">
            <div class="legend-section">
              <div class="legend-section-title-wrap">
                <span class="legend-section-title">Interactive Keymap</span>
                <span class="legend-live-badge">Live Input Tester</span>
              </div>
              ${renderKeyboardVisualizer(config.activeKeys)}
              <p class="legend-hint">Press keys on your keyboard to test inputs in real time</p>
            </div>

            <div class="legend-section">
              <div class="legend-section-title">Action Bindings</div>
              <div class="legend-actions-list">
                ${actionsHtml}
              </div>
            </div>

            <div class="legend-section">
              <div class="legend-section-title">Mouse &amp; Touch Controls</div>
              <div class="legend-touch-grid">
                ${touchHtml}
              </div>
            </div>
          </div>

          <div class="controls-legend-footer">
            <div class="legend-shortcut-tip">
              <span>Shortcut: <kbd class="legend-kbd">K</kbd> Toggle • <kbd class="legend-kbd">Alt+Shift+S</kbd> Snapshot</span>
            </div>
            <button type="button" class="btn btn-sm btn-icon" id="legend-snapshot-btn" title="Capture Snapshot (Alt+Shift+S)" aria-label="Capture Snapshot">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <button type="button" class="btn btn-sm btn-primary btn-legend-dismiss" id="dismiss-controls-legend-btn">
              <span>Got It, Let's Play!</span>
            </button>
          </div>
        </div>
      `;

    const dialogCloseBtn = controlsLegendDialog.querySelector("#close-controls-legend-btn");
    const dialogDismissBtn = controlsLegendDialog.querySelector("#dismiss-controls-legend-btn");
    const legendSnapBtn = controlsLegendDialog.querySelector("#legend-snapshot-btn");
    if (dialogCloseBtn) dialogCloseBtn.addEventListener("click", closeControlsLegend);
    if (dialogDismissBtn) dialogDismissBtn.addEventListener("click", closeControlsLegend);
    if (legendSnapBtn) {
      legendSnapBtn.addEventListener("click", () => {
        closeControlsLegend();
        if (window.ArcadeSnapshot && typeof window.ArcadeSnapshot.capture === "function") {
          window.ArcadeSnapshot.capture();
        }
      });
    }
    }

    // Tactile Web Audio Mechanical Switch Sound Synthesizer
    function playKeycapAudio() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (window.ArcadeAudio && typeof window.ArcadeAudio.isMuted === "function" && window.ArcadeAudio.isMuted()) return;
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sine";
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.02);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.Q.setValueAtTime(2, ctx.currentTime);

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.03);
        setTimeout(() => {
          if (ctx.state !== "closed") ctx.close();
        }, 60);
      } catch (_) {}
    }

    // Live Physical Keypress Tester Event Handlers
    function handleKeyTesterDown(e) {
      if (!controlsLegendDialog || controlsLegendDialog.style.display !== "flex") return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeControlsLegend();
        return;
      }

      const code = e.code;
      const keycap = controlsLegendDialog.querySelector(`.legend-keycap[data-code="${code}"]`);
      if (keycap) {
        if (!keycap.classList.contains("pressed")) {
          keycap.classList.add("pressed");
          playKeycapAudio();
        }
      } else if (code === "ShiftRight") {
        const shiftKeycap = controlsLegendDialog.querySelector(`.legend-keycap[data-code="ShiftLeft"]`);
        if (shiftKeycap && !shiftKeycap.classList.contains("pressed")) {
          shiftKeycap.classList.add("pressed");
          playKeycapAudio();
        }
      }
    }

    function handleKeyTesterUp(e) {
      if (!controlsLegendDialog || controlsLegendDialog.style.display !== "flex") return;
      const code = e.code;
      const keycap = controlsLegendDialog.querySelector(`.legend-keycap[data-code="${code}"]`);
      if (keycap) {
        keycap.classList.remove("pressed");
      } else if (code === "ShiftRight") {
        const shiftKeycap = controlsLegendDialog.querySelector(`.legend-keycap[data-code="ShiftLeft"]`);
        if (shiftKeycap) shiftKeycap.classList.remove("pressed");
      }
    }

    window.addEventListener("keydown", handleKeyTesterDown);
    window.addEventListener("keyup", handleKeyTesterUp);

    closeControlsLegend = function () {
      if (!controlsLegendDialog) return;
      controlsLegendDialog.style.display = "none";
      if (controlsLegendBtn) {
        controlsLegendBtn.classList.remove("active");
        controlsLegendBtn.setAttribute("aria-expanded", "false");
        try {
          controlsLegendBtn.focus();
        } catch (_) {}
      }
      const pressed = controlsLegendDialog.querySelectorAll(".legend-keycap.pressed");
      pressed.forEach((p) => p.classList.remove("pressed"));
    };

    function openControlsLegend() {
      if (!controlsLegendDialog) return;
      updateControlsContent();
      controlsLegendDialog.style.display = "flex";
      if (controlsLegendBtn) {
        controlsLegendBtn.classList.add("active");
        controlsLegendBtn.setAttribute("aria-expanded", "true");
      }
      const closeBtn = controlsLegendDialog.querySelector("#close-controls-legend-btn");
      if (closeBtn) {
        setTimeout(() => closeBtn.focus(), 50);
      }
    }

    controlsLegendBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (controlsLegendDialog.style.display === "flex") {
        closeControlsLegend();
      } else {
        openControlsLegend();
      }
    });

    controlsLegendDialog.addEventListener("click", (e) => {
      if (e.target === controlsLegendDialog) {
        closeControlsLegend();
      }
    });

    // Global 'K' shortcut toggle when modal is active
    window.addEventListener("keydown", (e) => {
      if ((e.key === "k" || e.key === "K") && gameModal && gameModal.classList.contains("active")) {
        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          if (controlsLegendDialog && controlsLegendDialog.style.display === "flex") {
            closeControlsLegend();
          } else if (controlsLegendBtn) {
            controlsLegendBtn.click();
          }
        }
      }
    });
  }

  // ========================================================
  // DAILY GAME LOGIN STREAK CALENDAR & XP MULTIPLIER (#659)
  // Calculates consecutive day UTC streak, tracks av_current_streak_days
  // ========================================================
  function initDailyStreakTracker() {
    const todayUTC = new Date().toISOString().slice(0, 10);
    const lastPlayed = localStorage.getItem("av_last_played_date");
    let streakDays = parseInt(localStorage.getItem("av_current_streak_days") || "0", 10);

    if (lastPlayed) {
      const lastDate = new Date(lastPlayed);
      const currDate = new Date(todayUTC);
      const diffDays = Math.round((currDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streakDays += 1;
        localStorage.setItem("av_current_streak_days", String(streakDays));
        localStorage.setItem("av_last_played_date", todayUTC);
      } else if (diffDays > 1) {
        // Skipped > 48h -> Reset streak cleanly to 1
        streakDays = 1;
        localStorage.setItem("av_current_streak_days", "1");
        localStorage.setItem("av_last_played_date", todayUTC);
      }
    } else {
      streakDays = 1;
      localStorage.setItem("av_current_streak_days", "1");
      localStorage.setItem("av_last_played_date", todayUTC);
    }

    // Render streak widget in navigation header
    const navActions = document.querySelector(".nav-actions");
    if (navActions && !document.getElementById("av-daily-streak-btn")) {
      const streakBtn = document.createElement("button");
      streakBtn.id = "av-daily-streak-btn";
      streakBtn.type = "button";
      streakBtn.className = "nav-streak-pill";
      streakBtn.title = "Daily Game Streak & XP Multiplier";
      streakBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
        <span>${streakDays} Day${streakDays === 1 ? '' : 's'}</span>
      `;
      navActions.insertBefore(streakBtn, navActions.firstChild);
    }
  }


  // ========================================================
  // KONAMI CODE EASTER EGG & RETRO CONFETTI ENGINE (#718)
  // Up Up Down Down Left Right Left Right B A
  // Unlocks 'Retro Enthusiast' achievement and canvas particle shower
  // ========================================================
  function initKonamiCodeRecognizer() {
    const KONAMI_CODE = [
      "arrowup", "arrowup", "arrowdown", "arrowdown",
      "arrowleft", "arrowright", "arrowleft", "arrowright",
      "b", "a"
    ];
    let keyBuffer = [];
    let isPartyModeActive = false;

    window.addEventListener("keydown", (e) => {
      // Guard: Do not intercept when typing in inputs or textareas
      const tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "");
      if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) {
        return;
      }

      // Guard: Do not intercept when active inside an iframe game
      if (gameModal && gameModal.classList.contains("active")) {
        return;
      }

      const key = (e.key || "").toLowerCase();
      keyBuffer.push(key);
      if (keyBuffer.length > KONAMI_CODE.length) {
        keyBuffer.shift();
      }

      if (keyBuffer.length === KONAMI_CODE.length) {
        const isMatch = KONAMI_CODE.every((k, i) => k === keyBuffer[i]);
        if (isMatch) {
          keyBuffer = [];
          triggerKonamiParty();
        }
      }
    });

    function triggerKonamiParty() {
      if (isPartyModeActive) return;
      isPartyModeActive = true;

      // 1. Play 8-bit fanfare synthesizer
      play8BitFanfare();

      // 2. Launch pure-canvas retro pixel confetti shower
      launchRetroPixelConfetti(() => {
        isPartyModeActive = false;
      });

      // 3. Unlock and award 'Retro Enthusiast' achievement badge
      awardRetroEnthusiastBadge();
    }

    function play8BitFanfare() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (window.ArcadeAudio && typeof window.ArcadeAudio.isMuted === "function" && window.ArcadeAudio.isMuted()) return;
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") ctx.resume();

        const notes = [
          { freq: 261.63, dur: 0.1, delay: 0 },    // C4
          { freq: 329.63, dur: 0.1, delay: 0.1 },  // E4
          { freq: 392.00, dur: 0.1, delay: 0.2 },  // G4
          { freq: 523.25, dur: 0.22, delay: 0.3 }, // C5
          { freq: 392.00, dur: 0.12, delay: 0.52 }, // G4
          { freq: 523.25, dur: 0.45, delay: 0.65 } // C5
        ];

        const now = ctx.currentTime;
        notes.forEach((n) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(n.freq, now + n.delay);
          gain.gain.setValueAtTime(0.18, now + n.delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + n.delay + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + n.delay);
          osc.stop(now + n.delay + n.dur + 0.05);
        });

        setTimeout(() => {
          if (ctx.state !== "closed") ctx.close();
        }, 1500);
      } catch (_) {}
    }

    function launchRetroPixelConfetti(onComplete) {
      const canvas = document.createElement("canvas");
      canvas.id = "konami-confetti-canvas";
      canvas.className = "konami-confetti-canvas";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        canvas.remove();
        if (onComplete) onComplete();
        return;
      }

      const colors = ["#38bdf8", "#ec4899", "#eab308", "#10b981", "#a855f7", "#f97316", "#06b6d4", "#f43f5e"];
      const particleCount = 130;
      const particles = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * (canvas.height * 0.4),
          w: Math.floor(Math.random() * 6 + 6),
          h: Math.floor(Math.random() * 5 + 5),
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 3 + 2.5,
          rot: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 8,
          wobble: Math.random() * 10,
          wobbleSpeed: Math.random() * 0.1 + 0.05,
          alpha: 1.0
        });
      }

      let animationId = null;
      const startTime = Date.now();
      const maxDuration = 4500;

      function render() {
        const elapsed = Date.now() - startTime;
        if (elapsed > maxDuration) {
          cancelAnimationFrame(animationId);
          canvas.remove();
          if (onComplete) onComplete();
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let activeCount = 0;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx + Math.sin(p.wobble) * 1.5;
          p.y += p.vy;
          p.wobble += p.wobbleSpeed;
          p.rot += p.vRot;

          if (elapsed > 3200) {
            p.alpha = Math.max(0, 1 - (elapsed - 3200) / 1300);
          }

          if (p.y < canvas.height + 30 && p.alpha > 0) {
            activeCount++;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
          }
        }

        if (activeCount === 0) {
          cancelAnimationFrame(animationId);
          canvas.remove();
          if (onComplete) onComplete();
          return;
        }

        animationId = requestAnimationFrame(render);
      }

      animationId = requestAnimationFrame(render);

      const resizeHandler = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      window.addEventListener("resize", resizeHandler, { once: true });
    }

    function awardRetroEnthusiastBadge() {
      try {
        localStorage.setItem("av_achievement_retro_enthusiast", "true");
        localStorage.setItem("arcadeverse_easter_egg_unlocked", "true");
      } catch (_) {}

      if (typeof announceToScreenReader === "function") {
        announceToScreenReader("Secret Easter Egg Unlocked: Retro Enthusiast! Konami party mode activated.", "assertive");
      }

      const existingToast = document.getElementById("konami-achievement-toast");
      if (existingToast) existingToast.remove();

      const toast = document.createElement("div");
      toast.id = "konami-achievement-toast";
      toast.className = "konami-achievement-toast";
      toast.setAttribute("role", "alert");
      toast.innerHTML = `
        <div class="achievement-toast-inner">
          <div class="achievement-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="6"></circle>
              <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path>
            </svg>
          </div>
          <div class="achievement-text">
            <span class="achievement-kicker">SECRET ACHIEVEMENT UNLOCKED</span>
            <strong class="achievement-title">Retro Enthusiast</strong>
            <p class="achievement-desc">You entered the legendary Konami Code! Retro party mode active.</p>
          </div>
          <button type="button" class="achievement-close-btn" aria-label="Close notification">&times;</button>
        </div>
      `;

      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("visible"));

      const closeBtn = toast.querySelector(".achievement-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          toast.classList.remove("visible");
          setTimeout(() => toast.remove(), 300);
        });
      }

      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.remove("visible");
          setTimeout(() => toast.remove(), 300);
        }
      }, 5000);
    }
  }

  initKonamiCodeRecognizer();
  initDailyStreakTracker();

  // Universal Virtual Touch Controller Loader (#517)
  if (typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))) {
    if (!document.querySelector('script[src*="virtual-controller.js"]')) {
      const vcScript = document.createElement('script');
      vcScript.src = 'assets/js/virtual-controller.js';
      document.body.appendChild(vcScript);
    }
  }

  // ========================================================
  // "PLAYERS ALSO PLAYED" MODAL RECOMMENDATIONS (#591)
  // Recommends 3 relevant games based on Jaccard tag similarity
  // ========================================================
  function renderModalRecommendations(currentGame) {
    if (!currentGame || !modalWindow) return;
    let strip = document.getElementById("modal-recommendations-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "modal-recommendations-strip";
      strip.className = "modal-recommendations-strip";
      modalWindow.appendChild(strip);
    }

    if (typeof GAMES_REGISTRY === "undefined" || !Array.isArray(GAMES_REGISTRY)) {
      strip.style.display = "none";
      return;
    }

    const currentTags = new Set((currentGame.tags || []).map(t => t.toLowerCase()));
    currentTags.add((currentGame.category || "").toLowerCase());

    const candidates = GAMES_REGISTRY.filter(g => g.id !== currentGame.id).map(g => {
      const gTags = new Set((g.tags || []).map(t => t.toLowerCase()));
      gTags.add((g.category || "").toLowerCase());

      // Jaccard similarity
      let intersection = 0;
      for (const t of currentTags) {
        if (gTags.has(t)) intersection++;
      }
      const union = new Set([...currentTags, ...gTags]).size;
      const score = union > 0 ? intersection / union : 0;
      return { game: g, score };
    });

    candidates.sort((a, b) => b.score - a.score);
    const top3 = candidates.slice(0, 3).map(c => c.game);

    if (top3.length === 0) {
      strip.style.display = "none";
      return;
    }

    strip.style.display = "flex";
    strip.innerHTML = `
      <div class="rec-strip-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        <span>Players Also Played:</span>
      </div>
      <div class="rec-chips-wrap">
        ${top3.map(g => `
          <button type="button" class="rec-game-chip" data-game-id="${g.id}">
            <span>${escapeHTML(g.title)}</span>
            <small>• ${escapeHTML(g.category || "Arcade")}</small>
          </button>
        `).join("")}
      </div>
    `;

    strip.querySelectorAll(".rec-game-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const gid = chip.getAttribute("data-game-id");
        const nextGame = GAMES_REGISTRY.find(g => g.id === gid);
        if (nextGame) {
          openGameModal(nextGame);
        }
      });
    });
  }

  // Universal Virtual Touch Controller Loader (#517)
  if (typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))) {
    if (!document.querySelector('script[src*="virtual-controller.js"]')) {
      const vcScript = document.createElement('script');
      vcScript.src = 'assets/js/virtual-controller.js';
      document.body.appendChild(vcScript);
    }
  }

  // COMPARE TWO GAMES MULTI-SELECT INSPECTION DRAWER (#589)
  // Side-by-side comparison of difficulty, duration, controls & ratings
  // ========================================================
  const selectedCompareGameIds = new Set();

  function openCompareDrawer() {
    let drawer = document.getElementById("game-compare-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "game-compare-drawer";
      drawer.className = "game-compare-drawer";
      document.body.appendChild(drawer);
    }

    const ids = Array.from(selectedCompareGameIds);
    if (ids.length !== 2) {
      drawer.classList.remove("visible");
      return;
    }

    const gameA = (typeof GAMES_REGISTRY !== "undefined") ? GAMES_REGISTRY.find(g => g.id === ids[0]) : null;
    const gameB = (typeof GAMES_REGISTRY !== "undefined") ? GAMES_REGISTRY.find(g => g.id === ids[1]) : null;
    if (!gameA || !gameB) return;

    drawer.innerHTML = `
      <div class="compare-drawer-header">
        <div class="compare-drawer-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
          <span>Game Comparison Analysis</span>
        </div>
        <button type="button" class="compare-close-btn" aria-label="Close comparison">&times;</button>
      </div>
      <div class="compare-grid">
        <div class="compare-col">
          <h4 class="compare-game-title">${escapeHTML(gameA.title)}</h4>
          <span class="compare-pill">${escapeHTML(gameA.category || "Arcade")}</span>
          <div class="compare-attr-list">
            <div class="compare-attr-row"><strong>Author:</strong> <span>@${escapeHTML(gameA.github || gameA.author || "Babin")}</span></div>
            <div class="compare-attr-row"><strong>Controls:</strong> <span>${gameA.responsive ? "Keyboard + Touch" : "Keyboard/Mouse"}</span></div>
            <div class="compare-attr-row"><strong>Rating:</strong> <span>${gameA.stars ? (gameA.stars / 10).toFixed(1) : "5.0"} / 5.0</span></div>
            <div class="compare-attr-row"><strong>Tags:</strong> <span>${(gameA.tags || []).slice(0, 3).join(", ") || "arcade, retro"}</span></div>
          </div>
        </div>
        <div class="compare-vs">VS</div>
        <div class="compare-col">
          <h4 class="compare-game-title">${escapeHTML(gameB.title)}</h4>
          <span class="compare-pill">${escapeHTML(gameB.category || "Arcade")}</span>
          <div class="compare-attr-list">
            <div class="compare-attr-row"><strong>Author:</strong> <span>@${escapeHTML(gameB.github || gameB.author || "Babin")}</span></div>
            <div class="compare-attr-row"><strong>Controls:</strong> <span>${gameB.responsive ? "Keyboard + Touch" : "Keyboard/Mouse"}</span></div>
            <div class="compare-attr-row"><strong>Rating:</strong> <span>${gameB.stars ? (gameB.stars / 10).toFixed(1) : "5.0"} / 5.0</span></div>
            <div class="compare-attr-row"><strong>Tags:</strong> <span>${(gameB.tags || []).slice(0, 3).join(", ") || "arcade, retro"}</span></div>
          </div>
        </div>
      </div>
    `;

    drawer.classList.add("visible");
    const closeBtn = drawer.querySelector(".compare-close-btn");
    closeBtn.addEventListener("click", () => {
      drawer.classList.remove("visible");
      selectedCompareGameIds.clear();
      document.querySelectorAll(".game-compare-checkbox").forEach(cb => cb.checked = false);
    });
  }

  document.addEventListener("change", (e) => {
    if (e.target && e.target.classList.contains("game-compare-checkbox")) {
      const gid = e.target.getAttribute("data-game-id");
      if (e.target.checked) {
        if (selectedCompareGameIds.size >= 2) {
          // Uncheck and alert
          e.target.checked = false;
          alert("You can compare up to two games at a time.");
          return;
        }
        selectedCompareGameIds.add(gid);
      } else {
        selectedCompareGameIds.delete(gid);
      }

      if (selectedCompareGameIds.size === 2) {
        openCompareDrawer();
      } else {
        const drawer = document.getElementById("game-compare-drawer");
        if (drawer) drawer.classList.remove("visible");
      }
    }
  });

  // Universal Virtual Touch Controller Loader (#517)
  if (typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))) {
    if (!document.querySelector('script[src*="virtual-controller.js"]')) {
      const vcScript = document.createElement('script');
      vcScript.src = 'assets/js/virtual-controller.js';
      document.body.appendChild(vcScript);
    }
  }

  // ========================================================
  // LRU GAME ASSETS CACHE MANAGER WITH 50MB BUDGET GUARD (#556)
  // Auto-evicts oldest unplayed games while protecting favorites
  // ========================================================
  const AvGameLruCacheManager = (function () {
    const LRU_TRACKER_KEY = 'av_lru_game_access';
    const MAX_BUDGET_BYTES = 50 * 1024 * 1024; // 50MB Threshold
    const GAME_CACHE_PREFIX = 'av-game-';

    function getAccessMap() {
      try {
        const raw = localStorage.getItem(LRU_TRACKER_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (_) {
        return {};
      }
    }

    function saveAccessMap(map) {
      try {
        localStorage.setItem(LRU_TRACKER_KEY, JSON.stringify(map));
      } catch (_) {}
    }

    function recordGamePlay(gameId) {
      if (!gameId) return;
      const map = getAccessMap();
      map[gameId] = Date.now();
      saveAccessMap(map);
      checkStorageBudget();
    }

    async function checkStorageBudget() {
      if (!('storage' in navigator && 'estimate' in navigator.storage)) return;
      if (!('caches' in window)) return;

      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;

        // If usage approaches or exceeds 50MB, perform LRU eviction
        if (usage > MAX_BUDGET_BYTES) {
          await performLruEviction();
        }
      } catch (err) {
        console.warn('[ArcadeVerse:LRU] Storage estimate failed:', err);
      }
    }

    async function performLruEviction() {
      const favSet = getFavorites();
      const accessMap = getAccessMap();
      const allCacheKeys = await caches.keys();
      const gameCaches = allCacheKeys.filter((k) => k.startsWith(GAME_CACHE_PREFIX));

      if (gameCaches.length === 0) return;

      // Map cache to gameId and last accessed timestamp
      const candidates = gameCaches.map((cacheKey) => {
        const gameId = cacheKey.replace(GAME_CACHE_PREFIX, '');
        return {
          cacheKey,
          gameId,
          isFavorite: favSet.has(gameId),
          lastAccess: accessMap[gameId] || 0
        };
      });

      // Filter out favorites (locked and exempt from eviction)
      const evictable = candidates.filter((c) => !c.isFavorite);

      // Sort ascending by lastAccess (oldest unplayed first)
      evictable.sort((a, b) => a.lastAccess - b.lastAccess);

      // Evict oldest unplayed caches until under threshold or top 30% cleared
      const toEvict = evictable.slice(0, Math.max(1, Math.ceil(evictable.length * 0.35)));
      for (const item of toEvict) {
        await caches.delete(item.cacheKey);
        delete accessMap[item.gameId];
        console.log(`[ArcadeVerse:LRU] Evicted game cache under 50MB budget: ${item.gameId}`);
      }
      saveAccessMap(accessMap);

      // Signal Service Worker
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'AV_EVICT_GAME_CACHES',
          evictList: toEvict.map((i) => i.gameId)
        });
      }
    }

    return {
      recordGamePlay,
      checkStorageBudget,
      performLruEviction
    };
  })();

  window.AvGameLruCacheManager = AvGameLruCacheManager;

  function initGameLruCacheManager() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
    // Check initial storage budget on launch
    setTimeout(() => {
      AvGameLruCacheManager.checkStorageBudget();
    }, 2000);
  }

  // ========================================================
  // APP BADGING API ENGINE (#557)
  // Badges dock/taskbar icon for unclaimed daily streaks & trophies
  // ========================================================
  const AvAppBadging = (function () {
    const STREAK_KEY = 'av_daily_streak_date';
    const UNCLAIMED_KEY = 'av_unclaimed_streak_count';

    function isSupported() {
      return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
    }

    function calculateUnclaimedCount() {
      let count = 0;
      try {
        const lastDate = localStorage.getItem(STREAK_KEY);
        const today = new Date().toISOString().slice(0, 10);
        if (lastDate !== today) {
          count += 1; // Unclaimed daily streak for today
        }
        const storedUnclaimed = parseInt(localStorage.getItem(UNCLAIMED_KEY) || '0', 10);
        count += storedUnclaimed;
      } catch (_) {}
      return count;
    }

    async function updateBadge() {
      if (!isSupported()) return;
      const count = calculateUnclaimedCount();
      try {
        if (count > 0) {
          await navigator.setAppBadge(count);
        } else {
          await navigator.clearAppBadge();
        }
      } catch (err) {
        console.warn('[ArcadeVerse:Badging] Failed to set badge:', err);
      }
    }

    async function clearBadge() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem(STREAK_KEY, today);
        localStorage.setItem(UNCLAIMED_KEY, '0');
        if (isSupported()) {
          await navigator.clearAppBadge();
        }
      } catch (err) {
        console.warn('[ArcadeVerse:Badging] Failed to clear badge:', err);
      }
    }

    return {
      isSupported,
      updateBadge,
      clearBadge
    };
  })();

  window.AvAppBadging = AvAppBadging;

  function initAppBadgingManager() {
    AvAppBadging.updateBadge();

    // Clear badge when player interacts with rewards or navigates to leaderboard
    const leaderboardLinks = document.querySelectorAll('a[href*="leaderboard.html"]');
    leaderboardLinks.forEach((link) => {
      link.addEventListener('click', () => {
        AvAppBadging.clearBadge();
      });
    });

    window.addEventListener('arcadeverse:claim-streak', () => {
      AvAppBadging.clearBadge();
    });
  }

  // ========================================================
  // BACKGROUND SYNC API & INDEXEDDB OFFLINE DISPATCH QUEUE (#554)
  // Preserves high scores and favorites across offline sessions
  // ========================================================
  const AvOfflineQueue = (function () {
    const DB_NAME = 'av_offline_queue';
    const DB_VERSION = 1;
    const STORE_NAME = 'dispatch_queue';
    let dbPromise = null;

    function getDB() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          if (typeof indexedDB === 'undefined') {
            resolve(null);
            return;
          }
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            console.warn('[ArcadeVerse:OfflineQueue] IndexedDB open error:', request.error);
            resolve(null);
          };
        });
      }
      return dbPromise;
    }

    async function enqueue(type, payload) {
      try {
        const db = await getDB();
        if (!db) {
          // Fallback to local storage buffer if IndexedDB is unavailable
          const raw = localStorage.getItem('av_offline_fallback_queue') || '[]';
          const arr = JSON.parse(raw);
          arr.push({ type, payload, queuedAt: Date.now() });
          localStorage.setItem('av_offline_fallback_queue', JSON.stringify(arr));
          return;
        }
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.add({ type, payload, queuedAt: Date.now() });
          tx.oncomplete = () => {
            requestBackgroundSync();
            resolve();
          };
          tx.onerror = () => resolve();
        });
      } catch (err) {
        console.warn('[ArcadeVerse:OfflineQueue] Failed to enqueue:', err);
      }
    }

    function requestBackgroundSync() {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg) => {
          return reg.sync.register('av-sync-offline-queue');
        }).catch(() => {});
      }
    }

    async function flushQueue() {
      let flushedCount = 0;
      try {
        const db = await getDB();
        if (db) {
          const items = await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });

          if (items && items.length > 0) {
            for (const item of items) {
              if (item.type === 'FAVORITES_SYNC' && item.payload && Array.isArray(item.payload.favorites)) {
                try {
                  const existing = JSON.parse(localStorage.getItem('av_favorites') || '[]');
                  const merged = Array.from(new Set([...existing, ...item.payload.favorites]));
                  localStorage.setItem('av_favorites', JSON.stringify(merged));
                  localStorage.setItem('arcadeverse_favorite_games', JSON.stringify(merged));
                } catch (_) {}
              } else if (item.type === 'HIGH_SCORE_SYNC' && item.payload && item.payload.gameId) {
                try {
                  const scoreKey = `av_score_${item.payload.gameId}`;
                  const currentScore = parseInt(localStorage.getItem(scoreKey) || '0', 10);
                  if (item.payload.score > currentScore) {
                    localStorage.setItem(scoreKey, item.payload.score.toString());
                  }
                } catch (_) {}
              }
              flushedCount++;
            }

            // Clear flushed items from DB
            await new Promise((resolve) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const clearReq = store.clear();
              clearReq.onsuccess = () => resolve();
              clearReq.onerror = () => resolve();
            });
          }
        }

        // Flush any localStorage fallback queue items
        const rawFallback = localStorage.getItem('av_offline_fallback_queue');
        if (rawFallback) {
          try {
            const fallbackItems = JSON.parse(rawFallback);
            if (Array.isArray(fallbackItems) && fallbackItems.length > 0) {
              flushedCount += fallbackItems.length;
              localStorage.removeItem('av_offline_fallback_queue');
            }
          } catch (_) {}
        }

        if (flushedCount > 0) {
          showSyncToast(`Synced ${flushedCount} offline score${flushedCount > 1 ? 's' : ''} and favorite${flushedCount > 1 ? 's' : ''}!`);
        }
      } catch (err) {
        console.warn('[ArcadeVerse:OfflineQueue] Flush error:', err);
      }
    }

    function showSyncToast(message) {
      if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(message);
      }
      let toast = document.getElementById('av-offline-sync-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'av-offline-sync-toast';
        toast.className = 'av-storage-quota-toast network-toast toast-online';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
      }
      toast.innerHTML = `
        <div class="av-quota-toast-content network-toast-body" style="display:flex;align-items:center;gap:10px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span class="av-quota-toast-text" style="font-weight:600;font-size:0.9rem;">${message}</span>
        </div>
      `;
      toast.classList.add('visible');
      toast.classList.add('toast-visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        toast.classList.remove('toast-visible');
      }, 4500);
    }

    return {
      enqueue,
      flushQueue,
      showSyncToast
    };
  })();

  window.AvOfflineQueue = AvOfflineQueue;

  function initOfflineDispatchQueue() {
    // Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          // Listen for updates or background sync triggers
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'AV_TRIGGER_OFFLINE_SYNC') {
              AvOfflineQueue.flushQueue();
            }
          });
        }).catch((err) => {
          console.warn('[ArcadeVerse:PWA] Service Worker registration failed:', err);
        });
      });
    }

    // Flush automatically upon internet reconnect
    window.addEventListener('online', () => {
      setTimeout(() => {
        AvOfflineQueue.flushQueue();
      }, 500);
    });

    // Check on startup if online and pending items exist
    if (navigator.onLine) {
      setTimeout(() => {
        AvOfflineQueue.flushQueue();
      }, 1500);
    }
  }

  initPwaUpdateNotifier();


// ========================================================
// ========================================================
// GAME SESSION SAVE-STATE BACKUP & RESTORE HANDLER (#747)
// ========================================================
(() => {
  function exportSaveStateBackup() {
    try {
      const backupData = {
        app: 'ArcadeVerse',
        version: '1.0',
        schemaVersion: '1.0',
        exportedAt: new Date().toISOString(),
        totalGames: Array.isArray(window.GAMES_REGISTRY) ? window.GAMES_REGISTRY.length : 0,
        storage: {}
      };

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('av_') || key.startsWith('arcadeverse_') || key.includes('score') || key.includes('favorite') || key.includes('streak'))) {
          backupData.storage[key] = localStorage.getItem(key);
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `arcadeverse-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (typeof showToast === 'function') {
        showToast('Save-state backup downloaded successfully.');
      }
    } catch (err) {
      console.error('[Backup] Export failed:', err);
      if (typeof showToast === 'function') {
        showToast('Failed to export backup file.');
      }
    }
  }

  function restoreSaveStateBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || parsed.app !== 'ArcadeVerse' || !parsed.storage || typeof parsed.storage !== 'object') {
          throw new Error('Invalid ArcadeVerse backup schema.');
        }

        let restoredCount = 0;
        for (const [key, value] of Object.entries(parsed.storage)) {
          if (typeof key === 'string' && typeof value === 'string') {
            // Guard against script injection into storage
            const sanitizedKey = key.replace(/[^a-zA-Z0-9_\-]/g, '');
            if (sanitizedKey.startsWith('av_') || sanitizedKey.startsWith('arcadeverse_')) {
              localStorage.setItem(sanitizedKey, value);
              restoredCount++;
            }
          }
        }

        if (typeof showToast === 'function') {
          showToast(`Successfully restored ${restoredCount} save entries. Reloading...`);
        }
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        console.error('[Backup] Restore failed:', err);
        if (typeof showToast === 'function') {
          showToast('Failed to restore backup: ' + err.message);
        }
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const triggerBtn = document.getElementById('backup-restore-trigger-btn');
    const modal = document.getElementById('backup-restore-modal');
    const closeBtn = document.getElementById('backup-modal-close-btn');
    const exportBtn = document.getElementById('btn-export-backup-json');
    const importBtn = document.getElementById('btn-import-backup-json');
    const fileInput = document.getElementById('backup-file-input');

    if (triggerBtn && modal) {
      triggerBtn.addEventListener('click', () => {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportSaveStateBackup);
    }

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          restoreSaveStateBackup(e.target.files[0]);
        }
      });
    }
  });
})();

// ========================================================
// IN-MODAL VOLUME SLIDER & CROSS-IFRAME BROADCASTER (#735, #887)
// ========================================================
(() => {
  let masterVolume = 0.28;
  try {
    const saved = localStorage.getItem('arcadeverse_master_volume');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        masterVolume = parsed;
      }
    } else if (window.SoundEngine && typeof window.SoundEngine.volume === "number") {
      masterVolume = window.SoundEngine.volume;
    }
  } catch (_) {
    masterVolume = 0.28;
  }

  function broadcastMasterVolume(vol) {
    const normalized = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0.28;
    masterVolume = normalized;
    try {
      localStorage.setItem('arcadeverse_master_volume', normalized.toString());
      if (window.SoundEngine && typeof window.SoundEngine.setVolume === "function") {
        window.SoundEngine.setVolume(normalized);
      }
    } catch (_) {}

    const gameIframe = document.getElementById('game-iframe');
    if (gameIframe && gameIframe.contentWindow) {
      const targetOrigin = (typeof getTrustedTargetOrigin === "function")
        ? getTrustedTargetOrigin()
        : (window.location && window.location.origin && window.location.origin !== "null" ? window.location.origin : "*");

      gameIframe.contentWindow.postMessage({
        type: 'ARCADEVERSE_SET_VOLUME',
        volume: normalized
      }, targetOrigin);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('modal-volume-slider');
    const label = document.getElementById('volume-percentage-label');
    if (slider) {
      slider.value = Math.round(masterVolume * 100);
      if (label) label.textContent = `${Math.round(masterVolume * 100)}%`;

      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const norm = Math.max(0, Math.min(100, val)) / 100;
        if (label) label.textContent = `${val}%`;
        broadcastMasterVolume(norm);
      });
    }

    // Re-broadcast volume whenever a game finishes loading in iframe
    const iframe = document.getElementById('game-iframe');
    if (iframe) {
      iframe.addEventListener('load', () => {
        setTimeout(() => broadcastMasterVolume(masterVolume), 200);
      });
    }
  });
})();
