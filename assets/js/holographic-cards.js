/**
 * ArcadeVerse 3D Holographic Card Gyroscope & Specular Glare Engine (#1055, #1056)
 * High-performance requestAnimationFrame 3D perspective tilt matrix, dynamic specular glare,
 * and particle edge glow with smooth spring return physics and reduced-motion fallback.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeHolographicCard = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isReducedMotion() {
    try {
      if (typeof window !== 'undefined' && window.ArcadeVerseA11y && typeof window.ArcadeVerseA11y.isReducedMotion === 'function') {
        return window.ArcadeVerseA11y.isReducedMotion();
      }
      if (typeof window !== 'undefined' && window.A11yEngine && window.A11yEngine.prefs && window.A11yEngine.prefs.reducedMotion) {
        return true;
      }
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(hover: none)').matches;
      }
    } catch (_) {}
    return false;
  }

  function attachCardEffect(card) {
    if (!card || card._holographicAttached) return;
    card._holographicAttached = true;

    // Ensure inner element exists for 3D preserve
    var inner = card.querySelector('.game-card-inner') || card;
    inner.style.transformStyle = 'preserve-3d';
    inner.style.transition = 'transform 0.15s ease-out';

    // Add glare layer
    var glare = card.querySelector('.game-card-glare');
    if (!glare) {
      glare = document.createElement('div');
      glare.className = 'game-card-glare';
      glare.style.position = 'absolute';
      glare.style.top = '0';
      glare.style.left = '0';
      glare.style.width = '100%';
      glare.style.height = '100%';
      glare.style.pointerEvents = 'none';
      glare.style.borderRadius = 'inherit';
      glare.style.opacity = '0';
      glare.style.mixBlendMode = 'overlay';
      glare.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, rgba(0,245,255,0.2) 40%, transparent 80%)';
      glare.style.transition = 'opacity 0.2s ease-out';
      glare.style.zIndex = '3';
      card.style.position = 'relative';
      card.appendChild(glare);
    }

    var rafId = null;
    var targetRotX = 0;
    var targetRotY = 0;
    var glareX = 50;
    var glareY = 50;

    function onPointerMove(e) {
      if (isReducedMotion()) return;

      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;

      var centerX = rect.width / 2;
      var centerY = rect.height / 2;

      // Calculate tilt angles: max 12 deg
      targetRotX = ((y - centerY) / centerY) * -12;
      targetRotY = ((x - centerX) / centerX) * 12;

      glareX = (x / rect.width) * 100;
      glareY = (y / rect.height) * 100;

      if (!rafId) {
        rafId = requestAnimationFrame(function () {
          inner.style.transform = 'perspective(1000px) rotateX(' + targetRotX.toFixed(2) + 'deg) rotateY(' + targetRotY.toFixed(2) + 'deg)';
          glare.style.opacity = '0.6';
          glare.style.background = 'radial-gradient(circle at ' + glareX.toFixed(1) + '% ' + glareY.toFixed(1) + '%, rgba(255,255,255,0.45) 0%, rgba(0,245,255,0.25) 35%, transparent 75%)';
          rafId = null;
        });
      }
    }

    function onPointerLeave() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      inner.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
      inner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      glare.style.opacity = '0';
      setTimeout(function () {
        inner.style.transition = 'transform 0.15s ease-out';
      }, 400);
    }

    card.addEventListener('pointermove', onPointerMove, { passive: true });
    card.addEventListener('pointerleave', onPointerLeave);
  }

  function bindAllCards() {
    var cards = document.querySelectorAll('.game-card');
    cards.forEach(function (card) {
      attachCardEffect(card);
    });
  }

  function init() {
    bindAllCards();

    // Observe dynamic card additions
    var grid = document.getElementById('games-grid') || document.querySelector('.games-grid');
    if (grid && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        bindAllCards();
      });
      observer.observe(grid, { childList: true });
    }
  }

  return {
    init: init,
    attachCardEffect: attachCardEffect,
    bindAllCards: bindAllCards
  };
});
