/**
 * React-Style Dynamic Toast Notification System
 * Fixed at top of viewport/screen irrespective of scroll position,
 * with smooth enter/exit animations, cross dismiss button, and automatic timeout.
 */
(function () {
  'use strict';

  const DEFAULT_DISMISS_MS = 5000;
  const EXIT_DURATION_MS = 250;

  const ALERT_SELECTOR = '[data-alert]';
  const CONTAINER_SELECTOR = '[data-alert-container]';
  const HIDDEN_MESSAGES = new Set(['Session_expired']);

  function isHiddenMessage(message) {
    if (!message) return false;
    return HIDDEN_MESSAGES.has(String(message).trim());
  }

  // Ensure the container is directly under document.body so no parent with CSS transform
  // can break position: fixed relative to the viewport.
  function getContainer() {
    let container = document.querySelector(CONTAINER_SELECTOR);
    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-alert-container', '');
    }

    container.className =
      'fixed top-6 left-1/2 -translate-x-1/2 z-[99999] w-full max-w-md px-4 pointer-events-none flex flex-col items-center gap-3';

    if (container.parentElement !== document.body) {
      document.body.appendChild(container);
    }
    return container;
  }

  function dismissAlert(el) {
    if (!el || el.dataset.alertClosing === 'true') return;
    el.dataset.alertClosing = 'true';
    el.style.transition =
      'opacity 220ms ease, transform 220ms cubic-bezier(0.4, 0, 0.2, 1), margin 220ms ease, max-height 220ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-24px) scale(0.95)';
    window.setTimeout(() => {
      el.remove();
    }, EXIT_DURATION_MS);
  }

  function mountAlert(el) {
    if (!el) return;

    const rawDismiss = el.getAttribute('data-alert-dismiss');
    const dismissMs = rawDismiss ? Number(rawDismiss) : DEFAULT_DISMISS_MS;

    if (Number.isFinite(dismissMs) && dismissMs > 0) {
      let timeoutId = window.setTimeout(() => dismissAlert(el), dismissMs);

      // Pause timer when mouse is hovering the notification
      el.addEventListener('mouseenter', () => {
        window.clearTimeout(timeoutId);
      });
      el.addEventListener('mouseleave', () => {
        timeoutId = window.setTimeout(() => dismissAlert(el), 2500);
      });
    }
  }

  function createAlertElement(type, message, source) {
    if (isHiddenMessage(message)) return null;

    const wrapper = document.createElement('div');
    const isError = type === 'error';
    const isSuccess = type === 'success';

    let borderClass = 'border-emerald-200/80 dark:border-emerald-500/30 shadow-emerald-500/10';
    let iconBg = 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    let titleText = 'Success';
    let titleClass = 'text-emerald-600 dark:text-emerald-400';
    let iconSvg =
      '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>';

    if (isError) {
      borderClass = 'border-rose-200/80 dark:border-rose-500/30 shadow-rose-500/10';
      iconBg = 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400';
      titleText = 'Error';
      titleClass = 'text-rose-600 dark:text-rose-400';
      iconSvg =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
    } else if (!isSuccess) {
      borderClass = 'border-amber-200/80 dark:border-amber-500/30 shadow-amber-500/10';
      iconBg = 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
      titleText = 'Notice';
      titleClass = 'text-amber-600 dark:text-amber-400';
      iconSvg =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
    }

    wrapper.className = `pointer-events-auto w-full rounded-2xl border ${borderClass} bg-white/95 dark:bg-[#0c111d]/95 backdrop-blur-xl p-3.5 shadow-2xl dark:shadow-black/70 animate-toastIn flex items-start gap-3.5 transition-all duration-300`;
    wrapper.setAttribute('role', 'alert');
    wrapper.setAttribute('data-alert', '');
    wrapper.setAttribute('data-alert-type', type);
    wrapper.setAttribute('data-alert-dismiss', isError ? '7000' : '5000');
    if (source) wrapper.setAttribute('data-alert-source', source);

    wrapper.innerHTML = `
      <div class="w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-xs mt-0.5">
        ${iconSvg}
      </div>
      <div class="flex-1 min-w-0 pt-0.5">
        <p class="text-[11px] font-extrabold uppercase tracking-wider ${titleClass}">${titleText}</p>
        <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 leading-normal" data-alert-message></p>
      </div>
      <button type="button" class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer" data-alert-close aria-label="Dismiss alert">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;
    wrapper.querySelector('[data-alert-message]').textContent = message;
    return wrapper;
  }

  function parseQueryAlerts() {
    const params = new URLSearchParams(window.location.search);
    const result = { success: null, error: null, warning: null };

    const directSuccess = params.get('success');
    const directError = params.get('error');
    const directWarning = params.get('warning');
    if (directSuccess) result.success = directSuccess;
    if (directError) result.error = directError;
    if (directWarning) result.warning = directWarning;

    const jsonAlert = params.get('alert');
    if (jsonAlert) {
      try {
        const parsed = JSON.parse(jsonAlert);
        if (parsed && typeof parsed === 'object') {
          if (!result.success && typeof parsed.success === 'string') result.success = parsed.success;
          if (!result.error && typeof parsed.error === 'string') result.error = parsed.error;
          if (!result.warning && typeof parsed.warning === 'string') result.warning = parsed.warning;
        }
      } catch (_) {}
    }

    if (directSuccess || directError || directWarning || jsonAlert) {
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('error');
      url.searchParams.delete('warning');
      url.searchParams.delete('alert');
      window.history.replaceState({}, '', url);
    }

    if (isHiddenMessage(result.success)) result.success = null;
    if (isHiddenMessage(result.error)) result.error = null;
    if (isHiddenMessage(result.warning)) result.warning = null;

    return result;
  }

  function getExistingMessages() {
    const messages = new Set();
    document.querySelectorAll(ALERT_SELECTOR).forEach((el) => {
      const messageEl = el.querySelector('[data-alert-message]');
      const text = messageEl ? messageEl.textContent : el.textContent;
      if (text) messages.add(text.trim());
    });
    return messages;
  }

  function init() {
    // 1. Teleport/ensure container is directly under document.body
    const container = getContainer();

    // 2. Mount existing SSR-rendered alerts and ensure they are inside the body-level container
    document.querySelectorAll(ALERT_SELECTOR).forEach((el) => {
      const messageEl = el.querySelector('[data-alert-message]');
      const text = messageEl ? messageEl.textContent : el.textContent;
      if (isHiddenMessage(text)) {
        el.remove();
        return;
      }
      if (el.parentElement !== container) {
        container.appendChild(el);
      }
      mountAlert(el);
    });

    // 3. Process URL query alerts
    const { success, error, warning } = parseQueryAlerts();
    const existingMessages = getExistingMessages();

    if (error && !existingMessages.has(error.trim())) {
      const alertEl = createAlertElement('error', error, 'query');
      if (alertEl) {
        container.prepend(alertEl);
        mountAlert(alertEl);
      }
    }

    if (warning && !existingMessages.has(warning.trim())) {
      const alertEl = createAlertElement('warning', warning, 'query');
      if (alertEl) {
        container.prepend(alertEl);
        mountAlert(alertEl);
      }
    }

    if (success && !existingMessages.has(success.trim())) {
      const alertEl = createAlertElement('success', success, 'query');
      if (alertEl) {
        container.prepend(alertEl);
        mountAlert(alertEl);
      }
    }
  }

  // Dismiss on clicking cross button
  document.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('[data-alert-close]');
    if (!closeBtn) return;
    const alertEl = closeBtn.closest(ALERT_SELECTOR);
    dismissAlert(alertEl);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
