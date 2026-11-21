(function() {
  function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('color-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('color-theme', 'dark');
    }
  }

  window.toggleTheme = toggleTheme;

  document.addEventListener('click', function(e) {
    const btn = e.target.closest('#themeToggle, #themeToggleMobile, .theme-toggle-btn');
    if (btn) {
      toggleTheme();
    }
  });
})();
