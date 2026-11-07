/**
 * ArcadeVerse - Global Navigation & Theme Engine
 * Handles responsive mobile navigation drawer, hamburger button state,
 * ARIA accessibility attributes, navbar scroll effects, Back to Top button,
 * and seamless Dark / Light Mode theme switching.
 */

(() => {
  // Theme Switching Engine
  const THEME_KEY = "arcadeverse_theme_mode";

  function getSystemTheme() {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }

  function getStoredTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") {
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
      } catch (_) {}
    }

    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      const nextLabel = mode === "light" ? "Switch to dark theme" : "Switch to light theme";
      btn.setAttribute("aria-label", nextLabel);
      btn.setAttribute("title", nextLabel);
      const iconWrap = btn.querySelector(".theme-icon-wrap");
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

    window.dispatchEvent(new CustomEvent("arcadeverse:theme-mode-changed", { detail: { mode } }));
  }

  function toggleThemeMode() {
    const current = document.documentElement.getAttribute("data-theme") || getStoredTheme();
    const next = current === "light" ? "dark" : "light";
    applyThemeMode(next, true);
  }

  // Apply immediately to prevent flash of wrong theme (FOUC)
  const initialMode = getStoredTheme();
  document.documentElement.setAttribute("data-theme", initialMode);

  // Respect system color preference changes dynamically if no custom preference is saved
  if (typeof window !== "undefined" && window.matchMedia) {
    const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemThemeChange = (e) => {
      try {
        if (!localStorage.getItem(THEME_KEY)) {
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
    const menuBtn = document.getElementById("mobile-menu-btn");
    const mobileDrawer = document.getElementById("mobile-nav-drawer");

    if (menuBtn && mobileDrawer) {
      function openMobileMenu() {
        menuBtn.classList.add("active");
        menuBtn.setAttribute("aria-expanded", "true");
        mobileDrawer.classList.add("open");
        mobileDrawer.setAttribute("aria-hidden", "false");
      }

      function closeMobileMenu() {
        menuBtn.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
      }

      function toggleMobileMenu() {
        const isOpen = mobileDrawer.classList.contains("open");
        if (isOpen) {
          closeMobileMenu();
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
          closeMobileMenu();
        });
      });

      // Close on click outside navbar
      document.addEventListener("click", (e) => {
        if (mobileDrawer.classList.contains("open") && navbar && !navbar.contains(e.target)) {
          closeMobileMenu();
        }
      });

      // Close on Escape key press
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && mobileDrawer.classList.contains("open")) {
          closeMobileMenu();
          menuBtn.focus();
        }
      });

      // Close if window is resized beyond mobile breakpoint
      window.addEventListener("resize", () => {
        if (window.innerWidth > 1280 && mobileDrawer.classList.contains("open")) {
          closeMobileMenu();
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

})();

