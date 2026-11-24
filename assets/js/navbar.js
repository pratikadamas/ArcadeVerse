/**
 * ArcadeVerse - Global Navigation & Theme Engine
 * Handles responsive mobile navigation drawer, hamburger button state,
 * ARIA accessibility attributes, navbar scroll effects, Back to Top button,
 * and seamless Dark / Light Mode theme switching.
 */

(() => {
  // Theme Switching Engine
  const THEME_KEY = "arcadeverse_theme_mode";
  const THEME_ALT_KEY = "arcadeverse_theme";
  const THEME_MANUAL_KEY = "arcadeverse_theme_manual";

  function getSystemTheme() {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }

  function getStoredTheme() {
    try {
      const isManual = localStorage.getItem(THEME_MANUAL_KEY) === "true";
      const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_ALT_KEY);
      if (isManual && (saved === "light" || saved === "dark")) {
        return saved;
      }
    } catch (_) {}
    return getSystemTheme();
  }

  function applyThemeMode(mode, persist = true) {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, mode);
        localStorage.setItem(THEME_ALT_KEY, mode);
        localStorage.setItem(THEME_MANUAL_KEY, "true");
      } catch (_) {}
    }

    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      const nextLabel = mode === "light" ? "Switch to dark theme" : "Switch to light theme";
      btn.setAttribute("aria-label", nextLabel);
      btn.setAttribute("title", nextLabel);
      const iconWrap = btn.querySelector(".theme-icon-wrap") || btn.querySelector(".mobile-nav-icon");
      if (iconWrap) {
        iconWrap.innerHTML = mode === "light" ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
      }
      const labelText = btn.querySelector(".theme-label-text");
      if (labelText) {
        labelText.textContent = mode === "light" ? "Switch to Dark Theme" : "Switch to Light Theme";
      }
    });

    if (window.lucide) {
      lucide.createIcons();
    }

    window.dispatchEvent(new CustomEvent("arcadeverse:theme-mode-changed", {
      detail: {
        mode,
        isManual: persist,
        systemMode: getSystemTheme()
      }
    }));
  }

  function toggleThemeMode() {
    const current = document.documentElement.getAttribute("data-theme") || getStoredTheme();
    const next = current === "light" ? "dark" : "light";
    applyThemeMode(next, true);
  }

  // Apply immediately to prevent flash of wrong theme (FOUC)
  const initialMode = getStoredTheme();
  document.documentElement.setAttribute("data-theme", initialMode);

  // Respect system color preference changes dynamically if no custom manual preference is saved (#896)
  if (typeof window !== "undefined" && window.matchMedia) {
    const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemThemeChange = (e) => {
      try {
        const isManual = localStorage.getItem(THEME_MANUAL_KEY) === "true";
        if (!isManual) {
          applyThemeMode(e.matches ? "light" : "dark", false);
        }
      } catch (_) {}
    };
    if (typeof colorSchemeMedia.addEventListener === "function") {
      colorSchemeMedia.addEventListener("change", onSystemThemeChange);
    } else if (typeof colorSchemeMedia.addListener === "function") {
      colorSchemeMedia.addListener(onSystemThemeChange);
    }
  }

  // Expose global ArcadeTheme helper for accessibility and shortcuts
  window.ArcadeTheme = {
    getTheme: () => document.documentElement.getAttribute("data-theme") || getStoredTheme(),
    toggleTheme: toggleThemeMode,
    setTheme: (m) => applyThemeMode(m, true)
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyThemeMode(initialMode, false);

    // Bind all theme toggle buttons
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleThemeMode();
      });
    });

    const navbar = document.getElementById("navbar");
    const menuBtn = document.getElementById("mobile-menu-btn") || document.getElementById("hamburger-btn");
    const mobileDrawer = document.getElementById("mobile-nav-drawer");

    if (menuBtn && mobileDrawer) {
      // Screen-reader dialog containment attributes
      if (!mobileDrawer.hasAttribute("role")) {
        mobileDrawer.setAttribute("role", "dialog");
      }
      mobileDrawer.setAttribute("aria-modal", "true");
      if (!mobileDrawer.hasAttribute("aria-label")) {
        mobileDrawer.setAttribute("aria-label", "Mobile navigation menu");
      }

      function getFocusableElements() {
        const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.from(mobileDrawer.querySelectorAll(selector)).filter((el) => {
          return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        });
      }

      function openMobileMenu() {
        menuBtn.classList.add("active");
        menuBtn.setAttribute("aria-expanded", "true");
        mobileDrawer.classList.add("open");
        mobileDrawer.setAttribute("aria-hidden", "false");

        // Transfer keyboard focus to the first focusable element inside the drawer
        requestAnimationFrame(() => {
          const focusables = getFocusableElements();
          if (focusables.length > 0) {
            focusables[0].focus();
          } else {
            mobileDrawer.setAttribute("tabindex", "-1");
            mobileDrawer.focus();
          }
        });
      }

      function closeMobileMenu(restoreFocus = true) {
        menuBtn.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");

        if (restoreFocus) {
          menuBtn.focus();
        }
      }

      function toggleMobileMenu() {
        const isOpen = mobileDrawer.classList.contains("open");
        if (isOpen) {
          closeMobileMenu(true);
        } else {
          openMobileMenu();
        }
      }

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMobileMenu();
      });

      // Close when clicking any nav link inside drawer
      const drawerLinks = mobileDrawer.querySelectorAll("a");
      drawerLinks.forEach((link) => {
        link.addEventListener("click", () => {
          closeMobileMenu(false);
        });
      });

      // Close on click outside navbar and restore focus to hamburger toggle
      document.addEventListener("click", (e) => {
        if (mobileDrawer.classList.contains("open") && navbar && !navbar.contains(e.target)) {
          closeMobileMenu(true);
        }
      });

      // Keyboard Focus Trap & Escape Dismissal
      document.addEventListener("keydown", (e) => {
        if (!mobileDrawer.classList.contains("open")) return;

        // Escape dismisses drawer cleanly and restores focus to hamburger toggle
        if (e.key === "Escape") {
          e.preventDefault();
          closeMobileMenu(true);
          return;
        }

        // Tab Navigation Containment Trap
        if (e.key === "Tab") {
          const focusables = getFocusableElements();
          if (focusables.length === 0) {
            e.preventDefault();
            return;
          }

          const firstEl = focusables[0];
          const lastEl = focusables[focusables.length - 1];

          if (e.shiftKey) {
            // Shift + Tab: wrap from first element to last
            if (document.activeElement === firstEl || !mobileDrawer.contains(document.activeElement)) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            // Tab: wrap from last element to first
            if (document.activeElement === lastEl || !mobileDrawer.contains(document.activeElement)) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
      });

      // Close without focus stealing if window is resized beyond mobile breakpoint
      window.addEventListener("resize", () => {
        if (window.innerWidth > 1280 && mobileDrawer.classList.contains("open")) {
          closeMobileMenu(false);
        }
      }, { passive: true });
    }

    // Smooth navbar squeeze & glassy effect on scroll
    if (navbar) {
      const handleNavbarScroll = (scrollPos) => {
        if (scrollPos > 30) {
          navbar.classList.add("scrolled");
        } else {
          navbar.classList.remove("scrolled");
        }
      };

      window.addEventListener("scroll", () => {
        handleNavbarScroll(window.scrollY);
      }, { passive: true });

      // Support scroll containers (e.g. docs-content-pane in docs.html dual-pane viewport)
      const docsPane = document.getElementById("docs-content-pane");
      if (docsPane) {
        docsPane.addEventListener("scroll", () => {
          handleNavbarScroll(docsPane.scrollTop);
        }, { passive: true });
      }
    }

    // Back to Top Button Engine
    const backToTopBtn = document.getElementById("back-to-top-btn");
    if (backToTopBtn) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
          backToTopBtn.classList.add("visible");
        } else {
          backToTopBtn.classList.remove("visible");
        }
      }, { passive: true });

      backToTopBtn.addEventListener("click", () => {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      });
    }

    // Ensure active navbar pill matches the current active page
    const currentPath = (window.location.pathname || "").toLowerCase();
    const pageName = currentPath.split("/").pop() || "index.html";

    document.querySelectorAll(".nav-item, .mobile-nav-item").forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      const targetPage = href.split("#")[0].split("/").pop() || "index.html";

      let isActive = false;
      if (pageName === "leaderboard.html" && targetPage === "leaderboard.html") {
        isActive = true;
      } else if (pageName === "docs.html" && targetPage === "docs.html") {
        isActive = true;
      } else if (pageName === "faqs.html" && targetPage === "faqs.html") {
        isActive = true;
      } else if (pageName === "terms.html" && targetPage === "terms.html") {
        isActive = true;
      } else if (pageName === "privacy.html" && targetPage === "privacy.html") {
        isActive = true;
      } else if ((pageName === "index.html" || pageName === "" || pageName === "/") && (targetPage === "index.html" || targetPage === "")) {
        isActive = true;
      }

      if (isActive) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });

    // Smooth In-Page Anchor Scrolling with Fixed Navbar Offset (Redirect to Top of Section)
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const hash = anchor.getAttribute('href');
        if (!hash || hash === '#' || hash === '#!') return;
        const targetEl = document.querySelector(hash);
        if (targetEl) {
          e.preventDefault();
          const navEl = document.getElementById('navbar');
          const navH = navEl ? navEl.offsetHeight : 70;
          const pos = targetEl.getBoundingClientRect().top + window.pageYOffset - navH - 18;
          window.scrollTo({
            top: Math.max(0, pos),
            behavior: 'smooth'
          });
          if (history.pushState) {
            history.pushState(null, null, hash);
          }
        }
      });
    });
  });

  // Page Transition Circular Loader Engine
  function bindPageTransitionLoader() {
    const loader = document.getElementById('page-transition-loader');
    if (!loader) return;

    // Smoothly hide on page load & back-forward navigation cache restore
    const hideLoader = () => loader.classList.remove('active');
    hideLoader();
    window.addEventListener('pageshow', hideLoader);

    // Global helper to trigger page transition programmatically
    window.triggerPageTransition = function (url) {
      if (!url) return;
      loader.classList.add('active');
      setTimeout(hideLoader, 2500);
      setTimeout(() => {
        window.location.href = url;
      }, 140);
    };

    // Intercept clicks on links specifically moving from ONE PAGE TO ANOTHER
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      if (link.target === '_blank') return;

      // Never show loader for in-page anchors / subsections
      if (href.startsWith('#')) return;

      const currentFile = window.location.pathname.split('/').pop() || 'index.html';
      const targetBase = href.split('#')[0].replace(/^\.\//, '');
      const targetFile = targetBase === '' ? 'index.html' : targetBase;

      const platformPages = ['index.html', 'leaderboard.html', 'docs.html', 'faqs.html', 'terms.html', 'privacy.html'];

      // Only trigger loader when genuinely navigating to a DIFFERENT platform page
      if (platformPages.includes(targetFile) && targetFile !== currentFile) {
        link.addEventListener('click', (e) => {
          if (e.metaKey || e.ctrlKey || e.button !== 0) return;
          e.preventDefault();
          window.triggerPageTransition(href);
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bindPageTransitionLoader);

  // Non-intrusive Service Worker Registration for PWA & Offline Shell Support
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
      );
      if (window.location.protocol === 'https:' || isLocalhost || window.location.protocol === 'http:') {
        navigator.serviceWorker
          .register('./sw.js', { scope: './' })
          .catch(() => {
            // Graceful fallback: non-intrusive if restricted or offline
          });
      }
    });
  }

})();

