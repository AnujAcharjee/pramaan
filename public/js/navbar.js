document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('menuBtn') || document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');

  if (btn && menu) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('hidden');
    });

    // Close mobile menu when clicking an in-page anchor link
    menu.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        menu.classList.add('hidden');
      });
    });
  }

  // Smooth scroll handler for in-page navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#' || targetId === '#!') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        if (history.pushState) {
          history.pushState(null, '', targetId);
        }
      }
    });
  });
});
