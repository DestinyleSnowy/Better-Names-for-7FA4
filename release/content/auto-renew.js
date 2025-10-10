(function () {
  'use strict';

  const BN = window.BN = window.BN || {};

  const RENEW_PATH_RE = /^\/problems\/tag\/(\d+)\/?$/;
  const RENEW_SUFFIX_RE = /\/renew\/?$/;
  const AUTO_RENEW_MEMORY_KEY = 'bn:autoRenew:lastRedirect';
  const AUTO_RENEW_MEMORY_TTL = 120000;

  function readAutoRenewMemory() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem(AUTO_RENEW_MEMORY_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch {
      return null;
    }
  }

  function writeAutoRenewMemory(data) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(AUTO_RENEW_MEMORY_KEY, JSON.stringify(data));
    } catch {}
  }

  function clearAutoRenewMemory() {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem(AUTO_RENEW_MEMORY_KEY);
    } catch {}
  }

  function markAutoRenewRedirect(tagId) {
    writeAutoRenewMemory({
      tagId: String(tagId),
      host: location.host,
      port: location.port || '',
      timestamp: Date.now(),
    });
  }

  function consumeAutoRenewRedirect(tagId) {
    const memory = readAutoRenewMemory();
    if (!memory) return false;
    if (memory.tagId && String(memory.tagId) !== String(tagId)) return false;
    if (memory.host && memory.host !== location.host) return false;
    if (typeof memory.port === 'string' && memory.port !== (location.port || '')) return false;
    if (typeof memory.timestamp === 'number' && Date.now() - memory.timestamp > AUTO_RENEW_MEMORY_TTL) {
      clearAutoRenewMemory();
      return false;
    }
    clearAutoRenewMemory();
    return true;
  }

  function pruneAutoRenewMemory() {
    const memory = readAutoRenewMemory();
    if (!memory) return;
    if (typeof memory.timestamp === 'number' && Date.now() - memory.timestamp <= AUTO_RENEW_MEMORY_TTL) return;
    clearAutoRenewMemory();
  }

  function computeRenewUrl(rawHref, baseHref) {
    if (!rawHref) return null;
    try {
      const url = new URL(rawHref, baseHref || location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (url.port && url.port !== '8888') return null;
      const host = url.hostname || '';
      if (!(host === '7fa4.cn' || host.endsWith('.7fa4.cn'))) return null;
      if (RENEW_SUFFIX_RE.test(url.pathname)) return null;
      const match = url.pathname.match(RENEW_PATH_RE);
      if (!match) return null;
      url.pathname = `/problems/tag/${match[1]}/renew`;
      return url.toString();
    } catch (err) {
      return null;
    }
  }

  function applyRenewToAnchor(anchor) {
    if (!anchor || typeof anchor.getAttribute !== 'function') return;
    const hrefAttr = anchor.getAttribute('href');
    const newHref = computeRenewUrl(hrefAttr, location.href);
    if (newHref && anchor.href !== newHref) {
      anchor.href = newHref;
    }
  }

  function applyRenewWithin(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const anchors = root.querySelectorAll('a[href]');
    anchors.forEach(applyRenewToAnchor);
  }

  function initAutoRenew() {
    const handleMutations = (mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node && node.nodeType === Node.ELEMENT_NODE) {
              if (typeof node.matches === 'function' && node.matches('a[href]')) applyRenewToAnchor(node);
              applyRenewWithin(node);
            }
          });
        } else if (mutation.type === 'attributes' && mutation.target) {
          const target = mutation.target;
          if (target && typeof target.matches === 'function' && target.matches('a[href]')) {
            applyRenewToAnchor(target);
          }
        }
      });
    };

    const observer = new MutationObserver(handleMutations);
    const start = () => {
      applyRenewWithin(document);
      const target = document.body;
      if (!target) {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(start);
        else setTimeout(start, 50);
        return;
      }
      observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }

    const ensureAnchor = (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (anchor) applyRenewToAnchor(anchor);
    };
    document.addEventListener('click', ensureAnchor, true);
    document.addEventListener('auxclick', ensureAnchor, true);
  }

  function handleRedirect(enableAutoRenew) {
    pruneAutoRenewMemory();
    if (!enableAutoRenew) return false;
    const redirectTarget = computeRenewUrl(location.href);
    if (redirectTarget && redirectTarget !== location.href) {
      const currentTagMatch = location.pathname.match(RENEW_PATH_RE);
      if (!currentTagMatch || !consumeAutoRenewRedirect(currentTagMatch[1])) {
        const tagMatch = currentTagMatch || redirectTarget.match(/\/problems\/tag\/(\d+)\/renew\/?$/);
        const tagId = tagMatch ? tagMatch[1] : null;
        if (tagId) markAutoRenewRedirect(tagId);
        location.replace(redirectTarget);
        return true;
      }
    }
    return false;
  }

  BN.autoRenew = {
    init: initAutoRenew,
    computeRenewUrl,
    applyRenewToAnchor,
    applyRenewWithin,
    markRedirect: markAutoRenewRedirect,
    consumeRedirect: consumeAutoRenewRedirect,
    pruneMemory: pruneAutoRenewMemory,
    handleRedirect,
  };
})();
