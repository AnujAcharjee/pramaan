(function() {
  function toggleInput(input, btn) {
    if (!input) return;
    const showIcon = btn ? btn.querySelector('.show-icon') : input.parentElement?.querySelector('.show-icon');
    const hideIcon = btn ? btn.querySelector('.hide-icon') : input.parentElement?.querySelector('.hide-icon');

    if (input.type === 'password') {
      input.type = 'text';
      if (showIcon) showIcon.classList.add('hidden');
      if (hideIcon) hideIcon.classList.remove('hidden');
    } else {
      input.type = 'password';
      if (showIcon) showIcon.classList.remove('hidden');
      if (hideIcon) hideIcon.classList.add('hidden');
    }
  }

  // Global helper for backwards compatibility
  window.togglePasswordVisibility = function(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const btn = input.parentElement ? input.parentElement.querySelector('.password-toggle-btn') : null;
    toggleInput(input, btn);
  };

  // Delegated click handler - completely CSP compliant (no inline onclick needed)
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.password-toggle-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const targetId = btn.getAttribute('data-password-target');
    let input = targetId ? document.getElementById(targetId) : null;
    if (!input) {
      input = btn.closest('.relative')?.querySelector('input');
    }
    toggleInput(input, btn);
  });
})();
