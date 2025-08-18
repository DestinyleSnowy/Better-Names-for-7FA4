import { ensureModal } from './modal.js';
import { needWarn } from './needWarn.js';

function extractProblemIdFromRow(row) {
  const a = row?.querySelector('a[href^="/problem/"]');
  const m = a && a.getAttribute('href').match(/\/problem\/(\d+)/);
  return m ? m[1] : null;
}

export function installSubmissionGuard() {
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

export default installSubmissionGuard;
