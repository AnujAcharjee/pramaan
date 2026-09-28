(function () {
  const form = document.getElementById('consent-form');
  const allowBtn = document.getElementById('allow-btn');
  const denyBtn = document.getElementById('deny-btn');
  const allowSpinner = document.getElementById('allow-spinner');
  const allowText = document.getElementById('allow-btn-text');
  const decisionInput = document.getElementById('decision-input');

  if (!form || !allowBtn || !denyBtn || !decisionInput) return;

  let isSubmitting = false;

  denyBtn.addEventListener('click', function (e) {
    if (isSubmitting) {
      e.preventDefault();
      return;
    }
    decisionInput.value = 'deny';
    isSubmitting = true;
    denyBtn.classList.add('opacity-60', 'pointer-events-none');
    allowBtn.classList.add('opacity-50', 'pointer-events-none');
  });

  allowBtn.addEventListener('click', function (e) {
    if (isSubmitting) {
      e.preventDefault();
      return;
    }
    decisionInput.value = 'approve';
    isSubmitting = true;

    // Show loading state
    if (allowSpinner) {
      allowSpinner.classList.remove('hidden');
    }
    if (allowText) {
      allowText.textContent = 'Authorizing...';
    }

    allowBtn.classList.add('opacity-90', 'pointer-events-none', 'cursor-wait');
    denyBtn.classList.add('opacity-50', 'pointer-events-none');
  });

  form.addEventListener('submit', function () {
    if (decisionInput.value === 'approve') {
      if (allowSpinner) allowSpinner.classList.remove('hidden');
      if (allowText) allowText.textContent = 'Authorizing...';
      allowBtn.classList.add('opacity-90', 'pointer-events-none', 'cursor-wait');
      denyBtn.classList.add('opacity-50', 'pointer-events-none');
    }
  });
})();
