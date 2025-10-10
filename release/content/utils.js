(function () {
  'use strict';

  const globalObject = window;
  globalObject.BN = globalObject.BN || {};

  function getCurrentUserId() {
    const ud = document.querySelector('#user-dropdown');
    if (ud && ud.dataset && (ud.dataset.user_id || ud.dataset.userId)) {
      return Number(ud.dataset.user_id || ud.dataset.userId);
    }
    const a1 = document.querySelector('#user-dropdown a[href^="/user/"]');
    const m1 = a1 && a1.getAttribute('href').match(/\/user\/(\d+)/);
    if (m1) return Number(m1[1]);
    const a2 = document.querySelector('a[href^="/user_plans/"]');
    const m2 = a2 && a2.getAttribute('href').match(/\/user_plans\/(\d+)/);
    if (m2) return Number(m2[1]);
    return NaN;
  }

  globalObject.getCurrentUserId = getCurrentUserId;
  globalObject.BN.getCurrentUserId = getCurrentUserId;
})();
