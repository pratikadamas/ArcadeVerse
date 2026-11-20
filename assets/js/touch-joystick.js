/**
 * ArcadeVerse Floating Virtual Joystick
 * Ergonomic floating virtual joystick with dynamic touch origin anchored at touch start
 * Clamped 40px radius, dispatches synthesized KeyboardEvent arrow keys to active game iframe
 */

(() => {
  'use strict';

  // Only activate on touch-capable devices
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
    return;
  }

  const JOYSTICK_MAX_RADIUS = 40;
  let activeTouchId = null;
  let originX = 0;
  let originY = 0;
  let activeKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
  };

  // Create UI Container
  const baseEl = document.createElement('div');
  baseEl.className = 'floating-joystick-base';
  baseEl.style.display = 'none';

  const thumbEl = document.createElement('div');
  thumbEl.className = 'floating-joystick-thumb';
  baseEl.appendChild(thumbEl);

  document.body.appendChild(baseEl);

  function getTargetWindow() {
    const modal = document.getElementById('game-modal');
    if (modal && !modal.classList.contains('hidden')) {
      const iframe = document.getElementById('game-frame');
      if (iframe && iframe.contentWindow) {
        return iframe.contentWindow;
      }
    }
    return window;
  }

  function dispatchKeyEvent(key, type) {
    const win = getTargetWindow();
    try {
      const evt = new win.KeyboardEvent(type, {
        key: key,
        code: key,
        bubbles: true,
        cancelable: true
      });
      win.document.dispatchEvent(evt);
    } catch (_) {
      try {
        const evt = new KeyboardEvent(type, {
          key: key,
          code: key,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(evt);
      } catch (__) {}
    }
  }

  function setKey(key, state) {
    if (activeKeys[key] !== state) {
      activeKeys[key] = state;
      dispatchKeyEvent(key, state ? 'keydown' : 'keyup');
    }
  }

  function releaseAllKeys() {
    for (const key in activeKeys) {
      if (activeKeys[key]) {
        setKey(key, false);
      }
    }
  }

  window.addEventListener('touchstart', (e) => {
    // Only capture on left half of screen when game modal is open
    const modal = document.getElementById('game-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth * 0.5 && activeTouchId === null) {
        activeTouchId = t.identifier;
        originX = t.clientX;
        originY = t.clientY;

        baseEl.style.left = `${originX}px`;
        baseEl.style.top = `${originY}px`;
        baseEl.style.display = 'block';
        thumbEl.style.transform = 'translate(-50%, -50%)';
        break;
      }
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (activeTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId) {
        const dx = t.clientX - originX;
        const dy = t.clientY - originY;
        const dist = Math.hypot(dx, dy);

        let clampedX = dx;
        let clampedY = dy;
        if (dist > JOYSTICK_MAX_RADIUS) {
          clampedX = (dx / dist) * JOYSTICK_MAX_RADIUS;
          clampedY = (dy / dist) * JOYSTICK_MAX_RADIUS;
        }

        thumbEl.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

        // Update direction states with 12px threshold
        const threshold = 12;
        setKey('ArrowRight', clampedX > threshold);
        setKey('ArrowLeft', clampedX < -threshold);
        setKey('ArrowDown', clampedY > threshold);
        setKey('ArrowUp', clampedY < -threshold);
        break;
      }
    }
  }, { passive: true });

  function endTouch(e) {
    if (activeTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        activeTouchId = null;
        baseEl.style.display = 'none';
        releaseAllKeys();
        break;
      }
    }
  }

  window.addEventListener('touchend', endTouch, { passive: true });
  window.addEventListener('touchcancel', endTouch, { passive: true });
})();
