// Lightweight avatar blocking helper extracted from panel.js.
// Exports a factory so callers can inject their own "is enabled" predicate.
export const AVATAR_BLOCK_HOSTS = new Set(['gravatar.loli.net']);

export function createAvatarBlocker({
  isBlockingEnabled = () => false,
  placeholderSrc = '',
  debugLog = () => {},
} = {}) {
  const INSTALL_FLAG = '__BN_AVATAR_BLOCKER_INSTALLED__';
  const INSTALLING_FLAG = '__BN_AVATAR_BLOCKER_INSTALLING__';
  const FAILED_FLAG = '__BN_AVATAR_BLOCKER_FAILED__';

  const isEnabled = () => {
    try { return !!(typeof isBlockingEnabled === 'function' ? isBlockingEnabled() : isBlockingEnabled); }
    catch (_) { return false; }
  };

  const shouldBlockAvatarUrl = (url) => {
    if (url === undefined || url === null) return false;
    try {
      const parsed = new URL(String(url), typeof window !== 'undefined' ? window.location.href : undefined);
      const host = parsed.hostname ? parsed.hostname.toLowerCase() : '';
      return host && AVATAR_BLOCK_HOSTS.has(host);
    } catch (_) {
      return false;
    }
  };

  const applyPlaceholder = (img, assignSrc) => {
    if (!img) return;
    assignSrc(img, placeholderSrc);
    try {
      img.dataset.bnAvatarBlocked = 'true';
    } catch (_) { /* ignore */ }
  };

  function installAvatarBlocker() {
    if (typeof window === 'undefined') return false;
    if (window[INSTALL_FLAG] || window[INSTALLING_FLAG]) return true;
    if (!document || typeof document.querySelectorAll !== 'function') return false;
    const imgCtor = (typeof HTMLImageElement === 'undefined') ? null : HTMLImageElement;
    if (!imgCtor || !imgCtor.prototype) return false;
    window[INSTALLING_FLAG] = true;
    try {
      const nativeSrcDescriptor = Object.getOwnPropertyDescriptor(imgCtor.prototype, 'src');
      const elementProto = (typeof Element !== 'undefined' && Element.prototype) ? Element.prototype : null;
      const nativeSetAttribute = (imgCtor.prototype.setAttribute || (elementProto && elementProto.setAttribute));
      if (!nativeSetAttribute) return false;
      const nativeFetch = typeof window.fetch === 'function' ? window.fetch : null;
      const nativeXhrOpen = (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) ? XMLHttpRequest.prototype.open : null;
      const nativeXhrSend = (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.send) ? XMLHttpRequest.prototype.send : null;
      const shouldBlockLoad = (value) => isEnabled() && shouldBlockAvatarUrl(value);

      const assignSrc = (img, value) => {
        if (!img) return;
        if (nativeSrcDescriptor && typeof nativeSrcDescriptor.set === 'function') {
          try {
            nativeSrcDescriptor.set.call(img, value);
            return;
          } catch (_) { /* ignore */ }
        }
        try {
          nativeSetAttribute.call(img, 'src', value);
        } catch (error) {
          debugLog('Failed to assign placeholder avatar', error);
        }
      };

      if (nativeSrcDescriptor && nativeSrcDescriptor.configurable !== false) {
        try {
          Object.defineProperty(imgCtor.prototype, 'src', {
            configurable: true,
            enumerable: nativeSrcDescriptor ? nativeSrcDescriptor.enumerable : false,
            get() {
              if (nativeSrcDescriptor && typeof nativeSrcDescriptor.get === 'function') {
                try {
                  return nativeSrcDescriptor.get.call(this);
                } catch (_) { /* ignore */ }
              }
              return this.getAttribute('src') || '';
            },
            set(value) {
              if (shouldBlockLoad(value)) {
                if (isEnabled()) applyPlaceholder(this, assignSrc);
                return;
              }
              assignSrc(this, value);
            },
          });
        } catch (error) {
          debugLog('Failed to patch HTMLImageElement.src', error);
        }
      }

      try {
        imgCtor.prototype.setAttribute = function (name, value) {
          if (
            typeof name === 'string' &&
            name.toLowerCase() === 'src' &&
            shouldBlockLoad(String(value || ''))
          ) {
            if (isEnabled()) applyPlaceholder(this, assignSrc);
            return;
          }
          return nativeSetAttribute.call(this, name, value);
        };
      } catch (error) {
        debugLog('Failed to patch image setAttribute', error);
      }

      const sanitizeExistingImages = () => {
        if (!isEnabled()) return;
        try {
          document.querySelectorAll('img').forEach(img => {
            const current = img.getAttribute('src') || img.currentSrc || img.src || '';
            if (shouldBlockAvatarUrl(current)) applyPlaceholder(img, assignSrc);
          });
        } catch (error) {
          debugLog('Avatar sanitize iteration failed', error);
        }
      };
      window.__BN_FORCE_AVATAR_SANITIZE__ = sanitizeExistingImages;

      const extractUrlFromFetchArgs = (input, init) => {
        if (typeof input === 'string') return input;
        if (input && typeof input === 'object') {
          if (typeof input.url === 'string') return input.url;
          if (typeof input.href === 'string') return input.href;
        }
        if (init && typeof init.url === 'string') return init.url;
        return '';
      };
      const createBlockedFetchResponse = () => {
        if (typeof Response === 'function') {
          try {
            return new Response('', { status: 204, statusText: 'BN Avatar blocked' });
          } catch (_) { /* ignore */ }
        }
        return {
          ok: true,
          status: 204,
          statusText: 'BN Avatar blocked',
          text: () => Promise.resolve(''),
          json: () => Promise.resolve(null),
          blob: () => Promise.resolve((typeof Blob === 'function') ? new Blob() : ''),
          arrayBuffer: () => Promise.resolve((typeof ArrayBuffer === 'function') ? new ArrayBuffer(0) : null),
          clone() { return this; },
        };
      };

      if (nativeFetch) {
        try {
          window.fetch = function patchedFetch(input, init) {
            try {
              if (shouldBlockLoad(extractUrlFromFetchArgs(input, init))) {
                return Promise.resolve(createBlockedFetchResponse());
              }
            } catch (_) { /* ignore */ }
            return nativeFetch.call(this, input, init);
          };
        } catch (error) {
          debugLog('Failed to patch window.fetch', error);
        }
      }

      if (nativeXhrOpen && nativeXhrSend) {
        try {
          XMLHttpRequest.prototype.open = function patchedOpen(method, url, async, user, password) {
            this.__bnAvatarBlocked__ = shouldBlockLoad(url);
            return nativeXhrOpen.call(this, method, url, async, user, password);
          };
          XMLHttpRequest.prototype.send = function patchedSend(body) {
            if (this.__bnAvatarBlocked__) {
              const errorEvent = (typeof ProgressEvent === 'function') ? new ProgressEvent('error') : new Event('error');
              try { if (typeof this.onerror === 'function') this.onerror(errorEvent); } catch (_) { /* ignore */ }
              try { this.dispatchEvent(errorEvent); } catch (_) { /* ignore */ }
              const loadEndEvent = (typeof ProgressEvent === 'function') ? new ProgressEvent('loadend') : new Event('loadend');
              try { if (typeof this.onloadend === 'function') this.onloadend(loadEndEvent); } catch (_) { /* ignore */ }
              try { this.dispatchEvent(loadEndEvent); } catch (_) { /* ignore */ }
              return;
            }
            return nativeXhrSend.call(this, body);
          };
        } catch (error) {
          debugLog('Failed to patch XMLHttpRequest', error);
        }
      }

      if (typeof document.addEventListener === 'function') {
        try {
          document.addEventListener('beforeload', (event) => {
            if (!isEnabled()) return;
            const target = event.target;
            const url = (target && (target.currentSrc || target.src || target.href)) || event.url;
            if (!shouldBlockAvatarUrl(url)) return;
            try { event.preventDefault(); } catch (_) { /* ignore */ }
            if (target && target.tagName === 'IMG') applyPlaceholder(target, assignSrc);
          }, true);
        } catch (error) {
          debugLog('Failed to attach beforeload listener', error);
        }
      }

      sanitizeExistingImages();
      if (typeof MutationObserver === 'function') {
        try {
          const mo = new MutationObserver(() => sanitizeExistingImages());
          mo.observe(document, { childList: true, subtree: true });
          window.__BN_AVATAR_BLOCKER_MO__ = mo;
        } catch (error) {
          debugLog('Avatar blocker MutationObserver failed', error);
        }
      }

      window[INSTALL_FLAG] = true;
      return true;
    } finally {
      delete window[INSTALLING_FLAG];
    }
  }

  function ensureAvatarBlockerInstalled(forceRetry = false) {
    if (typeof window === 'undefined') return false;
    if (window[INSTALL_FLAG]) return true;
    if (forceRetry) delete window[FAILED_FLAG];
    if (window[FAILED_FLAG]) return false;
    try {
      const ok = installAvatarBlocker();
      if (!ok) {
        window[FAILED_FLAG] = true;
        debugLog('Avatar blocker prerequisites unavailable; will retry later');
        return false;
      }
      return true;
    } catch (error) {
      window[FAILED_FLAG] = true;
      debugLog('Failed to install avatar blocker', error);
      return false;
    }
  }

  function runAvatarSanitizer() {
    try {
      if (typeof window !== 'undefined' && typeof window.__BN_FORCE_AVATAR_SANITIZE__ === 'function') {
        window.__BN_FORCE_AVATAR_SANITIZE__();
      }
    } catch (error) {
      debugLog('Avatar sanitizer failed', error);
    }
  }

  return {
    ensureAvatarBlockerInstalled,
    runAvatarSanitizer,
    shouldBlockAvatarUrl,
  };
}
