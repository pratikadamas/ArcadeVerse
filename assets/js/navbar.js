/**
 * ArcadeVerse - Global Navigation & Theme Engine
 * Handles responsive mobile navigation drawer, hamburger button state,
 * ARIA accessibility attributes, navbar scroll effects, Back to Top button,
 * and seamless Dark / Light Mode theme switching.
 */

(() => {
  // Theme Switching Engine
  const THEME_KEY = "arcadeverse_theme_mode";

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  function applyThemeMode(mode) {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    localStorage.setItem(THEME_KEY, mode);

    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.setAttribute("aria-label", mode === "light" ? "Switch to dark theme" : "Switch to light theme");
      btn.setAttribute("title", mode === "light" ? "Switch to dark theme" : "Switch to light theme");
      const iconWrap = btn.querySelector(".theme-icon-wrap");
      if (iconWrap) {
        iconWrap.innerHTML = mode === "light" ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
      }
    });

    if (window.lucide) {
      lucide.createIcons();
    }

    window.dispatchEvent(new CustomEvent("arcadeverse:theme-mode-changed", { detail: { mode } }));
  }

  function toggleThemeMode() {
    const current = getStoredTheme();
    const next = current === "light" ? "dark" : "light";
    applyThemeMode(next);
  }

  // Apply immediately to prevent flash
  const initialMode = getStoredTheme();
  document.documentElement.setAttribute("data-theme", initialMode);

  document.addEventListener("DOMContentLoaded", () => {
    applyThemeMode(initialMode);

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

    // Smooth navbar squeeze on scroll
    if (navbar) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 40) {
          navbar.classList.add("scrolled");
        } else {
          navbar.classList.remove("scrolled");
        }
      }, { passive: true });
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
          loader.classList.add('active');
          setTimeout(hideLoader, 2500);
          setTimeout(() => {
            window.location.href = href;
          }, 140);
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bindPageTransitionLoader);

})();
  // ========================================================
  // ACCENT COLORWAY CONTROLLER (CYBER CYAN, PINK, LIME, ORANGE, PURPLE, AMBER)
  // ========================================================
  const COLORWAY_KEY = "arcadeverse_accent_colorway";
  const DEFAULT_COLORWAY = "cyan";

  function getStoredColorway() {
    return localStorage.getItem(COLORWAY_KEY) || DEFAULT_COLORWAY;
  }

  function applyColorway(colorway) {
    const root = document.documentElement;
    root.setAttribute("data-colorway", colorway);
    localStorage.setItem(COLORWAY_KEY, colorway);

    // Update active state in colorway buttons
    document.querySelectorAll(".colorway-btn").forEach((btn) => {
      const match = btn.getAttribute("data-colorway") === colorway;
      btn.classList.toggle("active", match);
      btn.setAttribute("aria-selected", match ? "true" : "false");
    });

    // Update current indicator dot
    const currentDot = document.getElementById("currentColorwayDot");
    if (currentDot) {
      const activeBtn = document.querySelector(`.colorway-btn[data-colorway="${colorway}"] .colorway-dot`);
      if (activeBtn) {
        currentDot.style.background = activeBtn.style.background;
        currentDot.style.boxShadow = activeBtn.style.boxShadow;
      }
    }

    window.dispatchEvent(new CustomEvent("arcadeverse:colorway-changed", { detail: { colorway } }));
  }

  function initColorwayPicker() {
    const trigger = document.getElementById("colorway-trigger-btn");
    const popover = document.getElementById("colorway-popover");
    if (!trigger || !popover) return;

    // Apply saved or default colorway immediately
    const initial = getStoredColorway();
    applyColorway(initial);

    // Toggle popover on trigger click
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = popover.classList.contains("open");
      popover.classList.toggle("open", !isOpen);
      trigger.setAttribute("aria-expanded", !isOpen ? "true" : "false");
    });

    // Colorway button selection
    document.querySelectorAll(".colorway-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const selected = btn.getAttribute("data-colorway");
        if (selected) {
          applyColorway(selected);
          popover.classList.remove("open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    });

    // Close popover when clicking outside
    document.addEventListener("click", (e) => {
      if (!popover.contains(e.target) && !trigger.contains(e.target)) {
        popover.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    // Close popover on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && popover.classList.contains("open")) {
        popover.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus();
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initColorwayPicker);
  } else {
    initColorwayPicker();
  }
