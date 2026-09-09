(function () {
  if (window.__alertInit) return;
  window.__alertInit = true;

  const QUERY_DISMISS_MS = 5000;
  const EXIT_DURATION_MS = 220;

  const ALERT_SELECTOR = '[data-alert]';
  const CONTAINER_SELECTOR = '[data-alert-container]';
  const HIDDEN_MESSAGES = new Set(['Session_expired']);

  function isHiddenMessage(message) {
    if (!message) return false;
    return HIDDEN_MESSAGES.has(String(message).trim());
  }

  function getContainer() {
    let container = document.querySelector(CONTAINER_SELECTOR);
    if (container) return container;

    const main = document.querySelector('main');
    container = document.createElement('div');
    container.setAttribute('data-alert-container', '');
    if (main) {
      main.prepend(container);
    } else {
      document.body.prepend(container);
    }
    return container;
  }

  function createAlertElement(type, message, source) {
    if (isHiddenMessage(message)) return null;
    const wrapper = document.createElement('div');
    wrapper.className =
      type === 'error'
        ? 'mb-6 rounded-2xl border border-rose-100 dark:border-rose-500/15 bg-rose-50/50 dark:bg-rose-500/5 backdrop-blur-md p-4 shadow-md shadow-rose-100/20 dark:shadow-black/10 animate-slideIn'
        : 'mb-6 rounded-2xl border border-green-100 dark:border-emerald-500/15 bg-green-50/50 dark:bg-emerald-500/5 backdrop-blur-md p-4 shadow-md shadow-green-100/20 dark:shadow-black/10 animate-slideIn';
    wrapper.setAttribute('role', 'alert');
    wrapper.setAttribute('data-alert', '');
    wrapper.setAttribute('data-alert-type', type);
    if (source) wrapper.setAttribute('data-alert-source', source);

    const icon = type === 'error'
      ? '<div class="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center"><svg class="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>'
      : '<div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-emerald-500/15 flex items-center justify-center"><svg class="w-5 h-5 text-green-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>';

    const titleText = type === 'error' ? 'Error' : 'Success';
    const titleClass = type === 'error' ? 'text-rose-900 dark:text-rose-300' : 'text-green-900 dark:text-emerald-300';
    const textClass = type === 'error' ? 'text-rose-700 dark:text-emerald-400/80' : 'text-green-700 dark:text-emerald-400/80';
    const closeClass = type === 'error' ? 'text-rose-400 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300' : 'text-green-400 dark:text-emerald-500 hover:bg-green-100 dark:hover:bg-emerald-500/10 hover:text-green-600 dark:hover:text-emerald-300';

    wrapper.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="shrink-0 mt-0.5">${icon}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold ${titleClass} mt-1">${titleText}</p>
          <p class="text-xs ${textClass} mt-0.5 leading-relaxed" data-alert-message></p>
        </div>
        <button type="button" class="ml-2 p-1 rounded-lg ${closeClass} transition-colors cursor-pointer" data-alert-close aria-label="Dismiss alert">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
    wrapper.querySelector('[data-alert-message]').textContent = message;

    return wrapper;
  }

  function dismissAlert(el) {
    if (!el || el.dataset.alertClosing === 'true') return;
    el.dataset.alertClosing = 'true';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    window.setTimeout(() => {
      el.remove();
    }, EXIT_DURATION_MS);
  }

  function mountAlert(el) {
    if (!el) return;
    el.style.transition = 'opacity 180ms ease, transform 180ms ease';

    const dismissMs = Number(el.getAttribute('data-alert-dismiss'));
    if (Number.isFinite(dismissMs) && dismissMs > 0) {
      window.setTimeout(() => dismissAlert(el), dismissMs);
    }
  }

  function parseQueryAlerts() {
    const params = new URLSearchParams(window.location.search);
    const result = { success: null, error: null };

    const directSuccess = params.get('success');
    const directError = params.get('error');
    if (directSuccess) result.success = directSuccess;
    if (directError) result.error = directError;

    const jsonAlert = params.get('alert');
    if (jsonAlert) {
      try {
        const parsed = JSON.parse(jsonAlert);
        if (parsed && typeof parsed === 'object') {
          if (!result.success && typeof parsed.success === 'string') {
            result.success = parsed.success;
          }
          if (!result.error && typeof parsed.error === 'string') {
            result.error = parsed.error;
          }
        }
      } catch (_) {
        // ignore invalid JSON
      }
    }

    if (directSuccess || directError || jsonAlert) {
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('error');
      url.searchParams.delete('alert');
      window.history.replaceState({}, '', url);
    }

    if (isHiddenMessage(result.success)) result.success = null;
    if (isHiddenMessage(result.error)) result.error = null;

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

  document.querySelectorAll(ALERT_SELECTOR).forEach((el) => {
    const messageEl = el.querySelector('[data-alert-message]');
    const text = messageEl ? messageEl.textContent : el.textContent;
    if (isHiddenMessage(text)) {
      el.remove();
      return;
    }
    mountAlert(el);
  });
  document.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('[data-alert-close]');
    if (!closeBtn) return;
    const alertEl = closeBtn.closest(ALERT_SELECTOR);
    dismissAlert(alertEl);
  });

  const { success, error } = parseQueryAlerts();
  const container = getContainer();
  const existingMessages = getExistingMessages();

  if (error && !existingMessages.has(error.trim())) {
    const alertEl = createAlertElement('error', error, 'query');
    if (!alertEl) return;
    alertEl.setAttribute('data-alert-dismiss', String(QUERY_DISMISS_MS));
    container.prepend(alertEl);
    mountAlert(alertEl);
  }

  if (success && !existingMessages.has(success.trim())) {
    const alertEl = createAlertElement('success', success, 'query');
    if (!alertEl) return;
    alertEl.setAttribute('data-alert-dismiss', String(QUERY_DISMISS_MS));
    container.prepend(alertEl);
    mountAlert(alertEl);
  }
})();
