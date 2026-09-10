/**
 * Instant Scroll Lock for SSR Dashboards (Account & Client Dashboards)
 * Preserves the user's exact scroll position across SSR form submissions and actions
 * without modifying URL hashes or triggering full-page jump re-renders.
 */
(function () {
  'use strict';

  const pagePath = window.location.pathname;
  const storageKey = 'pramaan_scroll_' + pagePath;

  // 1. Immediately tell the browser to disable automatic scroll restoration
  if ('scrollRestoration' in history) {
    try {
      history.scrollRestoration = 'manual';
    } catch (_) {}
  }

  // Helper to save current scroll coordinate
  function saveScroll() {
    try {
      const y = Math.round(window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0);
      sessionStorage.setItem(storageKey, String(y));
    } catch (_) {}
  }

  // 2. Read saved scroll position ONCE into memory and clear storage
  let targetY = null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw !== null) {
      sessionStorage.removeItem(storageKey);
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetY = parsed;
      }
    }
  } catch (_) {}

  // 3. Multi-phase restoration function
  function restoreScroll() {
    if (targetY === null) return;
    window.scrollTo({ top: targetY, behavior: 'instant' });
  }

  if (targetY !== null) {
    // Attempt 1: Immediate jump
    restoreScroll();

    // Attempt 2: Next animation frame
    requestAnimationFrame(restoreScroll);

    // Attempt 3: On DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
    }

    // Attempt 4: Timed adjustments to counter image/font layout shifts
    setTimeout(restoreScroll, 50);
    setTimeout(restoreScroll, 150);
    setTimeout(restoreScroll, 350);

    // Attempt 5: Final lock on complete window load
    window.addEventListener('load', () => {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    });
  }

  // 4. Capture scroll on standard form submit events
  document.addEventListener('submit', () => {
    saveScroll();
  }, true);

  // 5. Intercept programmatic form.submit() (used by avatar auto-uploads & remove buttons)
  if (typeof HTMLFormElement !== 'undefined' && HTMLFormElement.prototype) {
    const originalSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      saveScroll();
      return originalSubmit.apply(this, arguments);
    };
  }

  // 6. Capture scroll on action links that perform redirects back to the current dashboard
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;

    if (
      href.includes('/environment?') ||
      href.includes('/revoke-consent') ||
      href.includes('/reissue-consent')
    ) {
      saveScroll();
    }
  }, true);
})();
