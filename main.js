(function () {
  'use strict';

  function ensureModal() {
    const IN_DURATION = 420;
    const OUT_DURATION = 420;
    const EASE_BOX = 'cubic-bezier(.2,.8,.2,1)';
    const SCALE_FROM = 0.88;

    if (!document.getElementById('bn-center-css')) {
      const cs = document.createElement('style');
      cs.id = 'bn-center-css';
      cs.textContent = [
        '#bn-guard-mask{position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:2147483647!important;pointer-events:auto!important;}',
        '#bn-guard-box{position:static!important;top:auto!important;left:auto!important;margin:0!important;}'
      ].join('\n');
      document.head.appendChild(cs);
    }

    let mask = document.getElementById('bn-guard-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'bn-guard-mask';
      document.body.appendChild(mask);
    }
    mask.className = 'ui dimmer modals page transition visible active';
    mask.style.display = 'flex';
    try { document.body.classList.add('dimmed'); } catch {}
    mask.innerHTML = '';

    const modal = document.createElement('div');
    modal.id = 'bn-guard-box';
    modal.className = 'ui basic modal check-need-modal transition visible active';
    modal.style.position = 'static';
    modal.style.margin = '0';

    const header = document.createElement('div');
    header.className = 'ui icon header';
    const icon = document.createElement('i');
    icon.className = 'exclamation triangle icon';
    header.appendChild(icon);
    header.appendChild(document.createTextNode('是否继续'));

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = '未通过题目前查看他人答案将获得较低的评级，请经过深入思考以后，确实难以解决再选择查看。';

    const actions = document.createElement('div');
    actions.className = 'actions';
    const ok = document.createElement('a');
    ok.className = 'ui red ok inverted button';
    ok.textContent = '确认';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ui green inverted button bn-cancel';
    cancel.textContent = '取消';
    actions.appendChild(ok);
    actions.appendChild(cancel);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(actions);
    mask.appendChild(modal);

    function captureBlocker(ev) {
      if (modal.contains(ev.target)) {
        if (ev.target === ok) return;
        if (ev.target.closest && ev.target.closest('.bn-cancel')) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      }
    }
    document.addEventListener('click', captureBlocker, true);

    const supportsWAAPI = typeof modal.animate === 'function';
    let animatingIn = true;
    let closing = false;
    actions.style.pointerEvents = 'none';

    function cleanup() {
      try { document.removeEventListener('click', captureBlocker, true); } catch {}
      try { mask.remove(); } catch {}
      try { document.body.classList.remove('dimmed'); } catch {}
      if (mask.dataset) delete mask.dataset.bnHref;
      delete window.__bnConfirmCb;
    }
    function onTransitionEndOnce(el, cb, timeout) {
      let done = false;
      function finish() { if (done) return; done = true; try { el.removeEventListener('transitionend', handler); } catch {} cb && cb(); }
      function handler(ev) { if (ev && ev.target !== el) return; finish(); }
      el.addEventListener('transitionend', handler);
      setTimeout(finish, timeout );
    }
    function finished(anim, timeout) {
      return new Promise(resolve => {
        let done = false; function fin() { if (done) return; done = true; resolve(); }
        if (anim && anim.finished && typeof anim.finished.then === 'function') anim.finished.then(fin).catch(fin);
        else setTimeout(fin, timeout);
      });
    }

    function animateIn() {
      mask.style.backgroundColor = 'rgba(0,0,0,0)';
      modal.style.transformOrigin = 'center center';
      if (supportsWAAPI) {
        const maskIn = mask.animate(
          [{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,0.85)' }],
          { duration: IN_DURATION, easing: 'ease', fill: 'forwards' }
        );
        const boxIn = modal.animate(
          [{ transform: 'scale(' + SCALE_FROM + ')', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: IN_DURATION, easing: EASE_BOX, fill: 'forwards' }
        );
        Promise.all([finished(maskIn, IN_DURATION + 80), finished(boxIn, IN_DURATION + 80)]).then(() => {
          animatingIn = false; actions.style.pointerEvents = '';
        });
      } else {
        modal.style.transition = 'transform ' + IN_DURATION + 'ms ' + EASE_BOX + ', opacity ' + IN_DURATION + 'ms ease';
        mask.style.transition = 'background-color ' + IN_DURATION + 'ms ease';
        modal.style.transform = 'scale(' + SCALE_FROM + ')'; modal.style.opacity = '0';
        void modal.offsetHeight;
        requestAnimationFrame(() => {
          mask.style.backgroundColor = 'rgba(0,0,0,0.85)';
          modal.style.transform = 'scale(1)'; modal.style.opacity = '1';
          onTransitionEndOnce(modal, () => { animatingIn = false; actions.style.pointerEvents = ''; }, IN_DURATION + 80);
        });
      }
    }

    function animateOut(after) {
      if (closing || animatingIn) return;
      closing = true; actions.style.pointerEvents = 'none';
      const fromBg = getComputedStyle(mask).backgroundColor || 'rgba(0,0,0,0.85)';
      if (supportsWAAPI) {
        const maskOut = mask.animate(
          [{ backgroundColor: fromBg }, { backgroundColor: 'rgba(0,0,0,0)' }],
          { duration: OUT_DURATION, easing: 'ease', fill: 'forwards' }
        );
        const boxOut = modal.animate(
          [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(' + SCALE_FROM + ')', opacity: 0 }],
          { duration: OUT_DURATION, easing: EASE_BOX, fill: 'forwards' }
        );
        Promise.all([finished(maskOut, OUT_DURATION + 80), finished(boxOut, OUT_DURATION + 80)]).then(() => {
          cleanup();      });
      } else {
        modal.style.transition = 'transform ' + OUT_DURATION + 'ms ' + EASE_BOX + ', opacity ' + OUT_DURATION + 'ms ease';
        mask.style.transition = 'background-color ' + OUT_DURATION + 'ms ease';
        mask.style.backgroundColor = 'rgba(0,0,0,0)';
        modal.style.transform = 'scale(' + SCALE_FROM + ')'; modal.style.opacity = '0';
        onTransitionEndOnce(modal, () => { cleanup(); }, OUT_DURATION + 80);
      }
    }

    mask.addEventListener('click', e => { if (e.target === mask) animateOut(); }, { once: true });

    mask.bnConfirm = function (onYesOrHref) {
      if (typeof onYesOrHref === 'function') {
        window.__bnConfirmCb = onYesOrHref;
        if (mask.dataset) delete mask.dataset.bnHref;
      } else if (typeof onYesOrHref === 'string') {
        if (mask.dataset) mask.dataset.bnHref = onYesOrHref;
        window.__bnConfirmCb = null;
      }
      ok.onclick = function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        cleanup();
        const href = (mask.dataset && mask.dataset.bnHref) || window.__bnPendingHref || ok.getAttribute('href');
        if (typeof window.__bnConfirmCb === 'function') { try { window.__bnConfirmCb(); } catch {} }
        else if (href) { location.assign(href); }
      };
      cancel.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        animateOut();
      };
    };

    mask.bnAnimateOut = function () { animateOut(); };

    animateIn();
    return mask;
  }

  const BASE = (window.CFG && window.CFG.base) ? window.CFG.base : location.origin;

  function sameOrigin(u) {
    try { return new URL(u, location.origin).origin === location.origin; } catch { return false; }
  }
  function fetchText(u, headers) {
    const opt = { headers: headers || {} };
    if (sameOrigin(u) || (typeof u === 'string' && u.indexOf('/') === 0)) opt.credentials = 'include';
    return fetch(u, opt).then(r => r.text());
  }

  function getUid() {
    const ud = document.querySelector('#user-dropdown');
    if (ud && ud.dataset && (ud.dataset.user_id || ud.dataset.userId)) return ud.dataset.user_id || ud.dataset.userId;
    const a1 = document.querySelector('#user-dropdown a[href^="/user/"]');
    const m1 = a1 && a1.getAttribute('href').match(/\/user\/(\d+)/);
    if (m1) return m1[1];
    const a2 = document.querySelector('a[href^="/user_plans/"]');
    const m2 = a2 && a2.getAttribute('href').match(/\/user_plans\/(\d+)/);
    if (m2) return m2[1];
    return null;
  }

  function parseItemList(html) {
    const m = html && html.match(/const\s+itemList\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return null;
    const raw = m[1];
    try { return JSON.parse(raw); }
    catch { try { return Function('"use strict";return (' + raw + ')')(); } catch { return null; } }
  }

  function userSeenAndAnyACFromList(list, uid) {
    if (!Array.isArray(list)) return { seen: false, anyAC: false };
    let seen = false, anyAC = false;
    for (let i = 0; i < list.length; i++) {
      const it = list[i] || {};
      const info = it.info || {}, res = it.result || {};
      if (Number(info.userId) !== Number(uid)) continue;
      seen = true;
      const score = typeof res.score === 'number' ? res.score : parseInt(res.score || 0, 10);
      if (res.result === 'Accepted' || score === 100) { anyAC = true; break; }
    }
    return { seen, anyAC };
  }

  function userSeenAndAnyACFromTable(html, uid) {
    const m = html && html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!m) return { seen: false, anyAC: false };
    let seen = false, anyAC = false;
    const rows = m[1].split(/<\/tr>/i);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.indexOf('/user/' + uid) === -1) continue;
      seen = true;
      if (/\bstatus\b[^>]*\baccepted\b/i.test(row) || />\s*Accepted\s*</i.test(row)) { anyAC = true; break; }
    }
    return { seen, anyAC };
  }

  async function hasAnyAcceptedAcrossAll(problemId) {
    const uid = getUid();
    if (!uid) return null;

    try {
      const urlOk = BASE + '/submissions?problem_id=' + encodeURIComponent(problemId)
        + '&submitter=' + encodeURIComponent(uid)
        + '&min_score=100&max_score=100&language=&status=';
      const hOk = await fetchText(urlOk, { 'X-Requested-With': 'XMLHttpRequest' });
      const listOk = parseItemList(hOk);
      if (listOk) {
        const r1 = userSeenAndAnyACFromList(listOk, uid);
        if (r1.seen) return true;
      } else {
        if (/class="[^"]*\bstatus\b[^"]*\baccepted\b[^"]*"/i.test(hOk) || />\s*Accepted\s*</i.test(hOk)) return true;
        if (new RegExp('/user/' + uid).test(hOk)) return false;
      }
    } catch {}

    try {
      const url = BASE + '/submissions?problem_id=' + encodeURIComponent(problemId);
      const html = await fetchText(url, { 'X-Requested-With': 'XMLHttpRequest' });
      const list = parseItemList(html);
      if (list) {
        const r2 = userSeenAndAnyACFromList(list, uid);
        if (r2.seen) return r2.anyAC;
      } else {
        const r3 = userSeenAndAnyACFromTable(html, uid);
        if (r3.seen) return r3.anyAC;
      }
    } catch {}

    return null;
  }

  async function needWarn(problemId) {
    try {
      const passed = await hasAnyAcceptedAcrossAll(problemId);
      if (passed === true) return false;
      if (passed === false) return true;
    } catch {}

    try {
      const ph = await fetchText(BASE + '/problem/' + encodeURIComponent(problemId), { 'X-Requested-With': 'XMLHttpRequest' });
      if (/class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(ph)
        || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(ph)) {
        return true;
      }
    } catch {}

    return false;
  }

  function extractProblemIdFromRow(row) {
    const a = row?.querySelector('a[href^="/problem/"]');
    const m = a && a.getAttribute('href').match(/\/problem\/(\d+)/);
    return m ? m[1] : null;
  }

  function installSubmissionGuard() {
    document.addEventListener('click', async e => {
      const a = e.target && e.target.closest && e.target.closest('a[href^="/submission/"]');
      if (!a) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const tr = a.closest('tr');
      const pid = tr && extractProblemIdFromRow(tr);
      if (!pid) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const warn = await needWarn(pid);
      if (!warn) {
        location.href = a.href;
        return;
      }
      const mask = ensureModal();
      mask.bnConfirm(() => { location.href = a.href; });
    }, true);

    if (location.pathname.indexOf('/submissions') !== 0) return;
    if (window.__bnGlobalBound) return;
    window.__bnGlobalBound = true;

    document.addEventListener('click', e => {
      const a = e.target && e.target.closest && e.target.closest('a[href^="/submission/"]');
      if (a) {
        window.__bnPendingHref = a.href;
      }
    }, true);

    document.addEventListener('click', e => {
      const okBtn = e.target && e.target.closest && e.target.closest('#bn-guard-box .ui.red.ok.inverted.button');
      if (okBtn) {
        e.preventDefault(); e.stopPropagation();
        const mask = document.getElementById('bn-guard-mask');
        if (mask) {
          const href = (mask.dataset && mask.dataset.bnHref) || window.__bnPendingHref || okBtn.getAttribute('href');
          try { mask.remove(); } catch {}
          try { document.body.classList.remove('dimmed'); } catch {}
          if (typeof window.__bnConfirmCb === 'function') {
            try { window.__bnConfirmCb(); } catch {}
          } else if (href) {
            location.assign(href);
          }
        }
        return;
      }
      const cancelBtn = e.target && e.target.closest && e.target.closest('#bn-guard-box .ui.green.ok.inverted.button');
      if (cancelBtn) {
        e.preventDefault(); e.stopPropagation();
        const mask = document.getElementById('bn-guard-mask');
        if (mask) {
          try { mask.remove(); } catch {}
          try { document.body.classList.remove('dimmed'); } catch {}
          delete window.__bnConfirmCb;
          if (mask.dataset) delete mask.dataset.bnHref;
        }
      }
    }, true);
  }

  installSubmissionGuard();

})();
