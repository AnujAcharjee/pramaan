(function() {
  function initSignupValidation() {
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const strengthContainer = document.getElementById('passwordStrengthContainer');
    const matchContainer = document.getElementById('passwordMatchContainer');
    const matchText = document.getElementById('passwordMatchText');
    const strengthText = document.getElementById('strengthText');

    if (!passwordInput) return;

    const bars = [
      document.getElementById('strengthBar1'),
      document.getElementById('strengthBar2'),
      document.getElementById('strengthBar3'),
      document.getElementById('strengthBar4')
    ];

    const checks = {
      length: document.getElementById('checkLength'),
      upper: document.getElementById('checkUpper'),
      lower: document.getElementById('checkLower'),
      digit: document.getElementById('checkDigit'),
      special: document.getElementById('checkSpecial')
    };

    const colors = {
      weak: { bar: 'bg-red-500', text: 'text-red-500 dark:text-red-400' },
      fair: { bar: 'bg-amber-500', text: 'text-amber-500 dark:text-amber-400' },
      good: { bar: 'bg-sky-500', text: 'text-sky-500 dark:text-sky-400' },
      strong: { bar: 'bg-emerald-500', text: 'text-emerald-500 dark:text-emerald-400' }
    };

    const passColor = 'text-emerald-500 dark:text-emerald-400 font-semibold';
    const failColor = 'text-slate-400 dark:text-slate-600 font-normal';

    function updateCheck(el, passed) {
      if (!el) return;
      el.className = 'transition-colors duration-300 ' + (passed ? passColor : failColor);
    }

    function updateMatch() {
      if (!confirmInput || !matchContainer || !matchText) return;
      const passVal = passwordInput.value;
      const confVal = confirmInput.value;

      if (confVal.length === 0) {
        matchContainer.classList.add('hidden');
        return;
      }
      matchContainer.classList.remove('hidden');

      if (passVal === confVal) {
        matchText.innerHTML = '<svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg><span class="text-emerald-500 dark:text-emerald-400">Passwords match</span>';
      } else {
        matchText.innerHTML = '<svg class="w-3.5 h-3.5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg><span class="text-red-500 dark:text-red-400">Passwords do not match</span>';
      }
    }

    passwordInput.addEventListener('input', function() {
      const val = this.value;

      if (val.length === 0) {
        if (strengthContainer) strengthContainer.classList.add('hidden');
        if (confirmInput && confirmInput.value.length > 0) updateMatch();
        return;
      }
      if (strengthContainer) strengthContainer.classList.remove('hidden');

      const hasLength = val.length >= 8;
      const hasUpper = /[A-Z]/.test(val);
      const hasLower = /[a-z]/.test(val);
      const hasDigit = /\d/.test(val);
      const hasSpecial = /[@$!%*?&#]/.test(val);

      updateCheck(checks.length, hasLength);
      updateCheck(checks.upper, hasUpper);
      updateCheck(checks.lower, hasLower);
      updateCheck(checks.digit, hasDigit);
      updateCheck(checks.special, hasSpecial);

      const score = [hasLength, hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
      let level, label;

      if (score <= 2) { level = 'weak'; label = 'Weak'; }
      else if (score === 3) { level = 'fair'; label = 'Fair'; }
      else if (score === 4) { level = 'good'; label = 'Good'; }
      else { level = 'strong'; label = 'Strong'; }

      const filledBars = score <= 2 ? 1 : score - 1;

      bars.forEach((bar, i) => {
        if (!bar) return;
        bar.className = bar.className.replace(/bg-\S+/g, '');
        if (i < filledBars) {
          bar.classList.add('h-full', 'w-full', 'rounded-full', 'transition-all', 'duration-300');
          bar.classList.add(...colors[level].bar.split(' '));
        } else {
          bar.classList.add('h-full', 'w-0', 'rounded-full', 'transition-all', 'duration-300');
        }
      });

      if (strengthText) {
        strengthText.className = 'text-[11px] font-medium ml-0.5 transition-colors duration-300 ' + colors[level].text;
        strengthText.textContent = label;
      }

      if (confirmInput && confirmInput.value.length > 0) {
        updateMatch();
      }
    });

    if (confirmInput) {
      confirmInput.addEventListener('input', updateMatch);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSignupValidation);
  } else {
    initSignupValidation();
  }
})();
