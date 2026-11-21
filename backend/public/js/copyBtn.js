(function () {
  const FEEDBACK_MS = 1500;

  async function writeToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  function extractTextFromElement(el) {
    if (!el) return null;
    const tagName = el.tagName ? el.tagName.toUpperCase() : '';
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      return el.value;
    }
    return el.innerText || el.textContent || '';
  }

  function resolveCopyText(btn) {
    const direct = btn.getAttribute('data-copy-text');
    if (direct !== null) return direct;

    const targetId = btn.getAttribute('data-copy-target');
    if (!targetId) return null;

    const targetEl = document.getElementById(targetId);
    if (!targetEl) return null;

    return extractTextFromElement(targetEl);
  }

  function setButtonFeedback(btn, active) {
    const labelEl = btn.querySelector('[data-copy-label]') || btn.querySelector('.copy-btn-label');
    if (labelEl) {
      if (!btn.dataset.copyOriginalLabel) {
        btn.dataset.copyOriginalLabel = labelEl.textContent || '';
      }
      labelEl.textContent = active ? 'Copied ✓' : btn.dataset.copyOriginalLabel;
    }

    if (btn.hasAttribute('title')) {
      if (!btn.dataset.copyOriginalTitle) {
        btn.dataset.copyOriginalTitle = btn.getAttribute('title') || '';
      }
      btn.setAttribute('title', active ? 'Copied' : btn.dataset.copyOriginalTitle);
    }
  }

  async function handleCopy(text, btn) {
    if (text === null || typeof text === 'undefined') return false;

    try {
      await writeToClipboard(text);
      if (btn) {
        setButtonFeedback(btn, true);
        window.setTimeout(() => setButtonFeedback(btn, false), FEEDBACK_MS);
      }
      return true;
    } catch (err) {
      console.error('Copy failed:', err);
      return false;
    }
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const text = resolveCopyText(btn);
    if (text === null) return;

    await handleCopy(text, btn);
  });

  window.copyToClipboard = async function (text, btn) {
    return handleCopy(text, btn);
  };
})();
