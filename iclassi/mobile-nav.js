(function() {
  function initMobileNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true">☰</span>';

    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'mobile-nav-overlay';
    overlay.setAttribute('aria-label', 'Close navigation');

    document.body.appendChild(toggle);
    document.body.appendChild(overlay);

    function openNav() {
      document.body.classList.add('mobile-nav-open');
      toggle.setAttribute('aria-label', 'Close navigation');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.innerHTML = '<span aria-hidden="true">×</span>';
    }

    function closeNav() {
      document.body.classList.remove('mobile-nav-open');
      toggle.setAttribute('aria-label', 'Open navigation');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span aria-hidden="true">☰</span>';
    }

    toggle.addEventListener('click', () => {
      if (document.body.classList.contains('mobile-nav-open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    overlay.addEventListener('click', closeNav);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeNav();
    });

    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeNav);
    });
  }

  function initNavigatorToggles() {
    document.querySelectorAll('[data-toggle-navigator]').forEach(button => {
      const target = document.getElementById(button.dataset.toggleNavigator);
      if (!target) return;
      button.addEventListener('click', () => {
        const collapsed = target.classList.toggle('navigator-collapsed');
        button.textContent = collapsed ? 'Show navigator' : 'Hide navigator';
        button.setAttribute('aria-expanded', String(!collapsed));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
      });
      button.setAttribute('aria-expanded', String(!target.classList.contains('navigator-collapsed')));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initMobileNav();
      initNavigatorToggles();
    }, { once: true });
  } else {
    initMobileNav();
    initNavigatorToggles();
  }
})();
