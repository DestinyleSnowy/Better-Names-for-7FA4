/* === BN PATCH: user menu animation + shadow === */
(function () {
  const css = `
  #bn-user-menu {
    opacity: 0 !important;
    transform: translateY(2px) scale(0.98) !important;
    transform-origin: left top !important;
    transition: opacity 133ms cubic-bezier(.2,0,0,1), transform 133ms cubic-bezier(.2,0,0,1) !important;
    will-change: opacity, transform;
    /* Native-like layered shadow */
    box-shadow:
      0 12px 28px rgba(0,0,0,.20),
      0 6px 16px rgba(0,0,0,.18),
      0 2px 4px rgba(0,0,0,.12) !important;
  }
  #bn-user-menu.bn-show {
    opacity: 1 !important;
    transform: translateY(0) scale(1) !important;
  }
  @media (prefers-color-scheme: dark) {
    #bn-user-menu {
      background: #1f1f1f !important;
      color: #eaeaea !important;
      border-color: rgba(255,255,255,.08) !important;
      box-shadow:
        0 12px 28px rgba(0,0,0,.45),
        0 6px 16px rgba(0,0,0,.35),
        0 2px 4px rgba(0,0,0,.25) !important;
    }
    #bn-user-menu a { color: #eaeaea !important; }
    #bn-user-menu a:hover { background: rgba(255,255,255,.08) !important; }
  }`;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
})();

/* === BN PATCH 2: user menu pure fade-in (no size change) + shadow fade === */
(function () {
  const css = `
  #bn-user-menu {
    opacity: 0 !important;
    box-shadow:
      0 12px 28px rgba(0,0,0,0.00),
      0 6px 16px rgba(0,0,0,0.00),
      0 2px 4px rgba(0,0,0,0.00) !important;
    transition:
      opacity 300ms cubic-bezier(.2,0,0,1),
      box-shadow 300ms cubic-bezier(.2,0,0,1) !important;
    will-change: opacity, box-shadow;
  }
  #bn-user-menu.bn-show {
    opacity: 1 !important;
    box-shadow:
      0 12px 28px rgba(0,0,0,.20),
      0 6px 16px rgba(0,0,0,.18),
      0 2px 4px rgba(0,0,0,.12) !important;
  }
  @media (prefers-color-scheme: dark) {
    #bn-user-menu {
      box-shadow:
        0 12px 28px rgba(0,0,0,0.00),
        0 6px 16px rgba(0,0,0,0.00),
        0 2px 4px rgba(0,0,0,0.00) !important;
    }
    #bn-user-menu.bn-show {
      box-shadow:
        0 12px 28px rgba(0,0,0,.45),
        0 6px 16px rgba(0,0,0,.35),
        0 2px 4px rgba(0,0,0,.25) !important;
    }
  }`;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
})();
