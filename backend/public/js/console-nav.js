(function() {
  function initConsoleNav() {
    const toggleBtn = document.getElementById('consoleNavToggle');
    const closeBtn = document.getElementById('consoleCloseBtn');
    const sidebar = document.getElementById('consoleSidebar');
    const backdrop = document.getElementById('consoleBackdrop');

    if (!sidebar) return;

    // Restore desktop collapsed state on load
    try {
      if (window.innerWidth >= 1024 && localStorage.getItem('pramaan_console_sidebar_collapsed') === 'true') {
        sidebar.classList.add('sidebar-collapsed');
        document.documentElement.classList.add('console-sidebar-collapsed');
      }
    } catch (_e) {}

    function openMobileSidebar() {
      sidebar.classList.add('sidebar-open');
      if (backdrop) {
        backdrop.classList.add('backdrop-open');
        backdrop.classList.remove('hidden');
      }
      document.body.classList.add('overflow-hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMobileSidebar() {
      sidebar.classList.remove('sidebar-open');
      if (backdrop) {
        backdrop.classList.remove('backdrop-open');
        setTimeout(function() {
          if (!sidebar.classList.contains('sidebar-open')) {
            backdrop.classList.add('hidden');
          }
        }, 150);
      }
      document.body.classList.remove('overflow-hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar(e) {
      if (e) e.stopPropagation();
      if (window.innerWidth >= 1024) {
        const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
        document.documentElement.classList.toggle('console-sidebar-collapsed', isCollapsed);
        try {
          localStorage.setItem('pramaan_console_sidebar_collapsed', isCollapsed ? 'true' : 'false');
        } catch (_err) {}
      } else {
        if (sidebar.classList.contains('sidebar-open')) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      }
    }

    if (toggleBtn) {
      toggleBtn.onclick = toggleSidebar;
    }

    if (closeBtn) {
      closeBtn.onclick = function(e) {
        e.stopPropagation();
        closeMobileSidebar();
      };
    }

    if (backdrop) {
      backdrop.onclick = function(e) {
        e.stopPropagation();
        closeMobileSidebar();
      };
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && sidebar.classList.contains('sidebar-open')) {
        closeMobileSidebar();
      }
    });

    const navLinks = sidebar.querySelectorAll('a[href*="#"]');

    function setActiveNavLink(hash) {
      if (!hash) return;
      navLinks.forEach(function(link) {
        const linkHref = link.getAttribute('href');
        if (linkHref && linkHref.endsWith(hash)) {
          link.classList.add('nav-item-active');
        } else {
          link.classList.remove('nav-item-active');
        }
      });
    }

    // Handle in-page anchor smooth scroll
    navLinks.forEach(function(link) {
      link.addEventListener('click', function(e) {
        const href = link.getAttribute('href');
        const hashIndex = href.indexOf('#');
        if (hashIndex === -1) return;

        const hash = href.substring(hashIndex);
        const pathBeforeHash = href.substring(0, hashIndex);
        const currentPath = window.location.pathname;
        const isSamePage = !pathBeforeHash || pathBeforeHash === currentPath;

        if (isSamePage && hash.length > 1) {
          e.preventDefault();
          const target = document.querySelector(hash);
          const main = document.getElementById('consoleMain') || document.querySelector('main');
          if (target && main) {
            const mainRect = main.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const offset = targetRect.top - mainRect.top + main.scrollTop - 20;
            main.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
            history.replaceState(null, '', hash);
            setActiveNavLink(hash);
          } else if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', hash);
            setActiveNavLink(hash);
          }
        }

        if (window.innerWidth < 1024) {
          closeMobileSidebar();
        }
      });
    });

    // Close on non-hash links on mobile
    sidebar.querySelectorAll('a:not([href*="#"])').forEach(function(link) {
      link.addEventListener('click', function() {
        if (window.innerWidth < 1024) {
          closeMobileSidebar();
        }
      });
    });

    // Initial hash active state
    if (window.location.hash) {
      setActiveNavLink(window.location.hash);
      requestAnimationFrame(function() {
        const target = document.querySelector(window.location.hash);
        const main = document.getElementById('consoleMain') || document.querySelector('main');
        if (target && main) {
          setTimeout(function() {
            const mainRect = main.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const offset = targetRect.top - mainRect.top + main.scrollTop - 20;
            main.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
          }, 100);
        } else if (target) {
          setTimeout(function() {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      });
    } else {
      // Default to first anchor link if on an anchor-based page
      const firstAnchor = sidebar.querySelector('.console-nav-link');
      if (firstAnchor) {
        firstAnchor.classList.add('nav-item-active');
      }
    }

    // ScrollSpy using IntersectionObserver on RHS sections
    const scrollContainer = document.getElementById('consoleMain') || document.querySelector('main');
    const sections = document.querySelectorAll('section[id]');
    if (sections.length > 0 && 'IntersectionObserver' in window && scrollContainer) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            setActiveNavLink('#' + entry.target.id);
          }
        });
      }, {
        root: scrollContainer,
        rootMargin: '-15% 0px -65% 0px',
        threshold: 0
      });

      sections.forEach(function(sec) {
        observer.observe(sec);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsoleNav);
  } else {
    initConsoleNav();
  }
})();
