// Panel frontend extracted from the main content script.
(async function () {
  'use strict';
  if (typeof window.__GM_ready === 'function') await window.__GM_ready();
  const backgroundStyles = [
    "center/cover no-repeat",
    "center/contain no-repeat",
    "center/100% 100% no-repeat",
    "repeat",
    "center no-repeat",
  ];
  const btEnabled = GM_getValue('bt_enabled', false);
  const DEFAULT_BT_INTERVAL = 2000;
  const HI_TOILET_INTERVAL_MIN = 10;
  const HI_TOILET_INTERVAL_MAX = 2000;
  const storedBtInterval = clampHiToiletInterval(GM_getValue('bt_interval', DEFAULT_BT_INTERVAL));
  const storedBgEnabled = GM_getValue('bg_enabled', false);
  const storedBgfillway = GM_getValue('bg_fillway', 2);
  console.log(storedBgfillway);
  const storedBgImageUrl = GM_getValue('bg_imageUrl', '');
  const storedBgImageData = GM_getValue('bg_imageData', '');
  const storedBgImageDataName = GM_getValue('bg_imageDataName', '');
  const storedBgSourceTypeRaw = GM_getValue('bg_imageSourceType', '');
  const storedBgOpacity = GM_getValue('bg_opacity', '0.1');
  const DEFAULT_THEME_MODE = 'light';
  const storedThemeModeRaw = GM_getValue('panelThemeMode', DEFAULT_THEME_MODE);
  const DEFAULT_THEME_COLOR = '#007bff';
  const storedThemeColorRaw = GM_getValue('themeColor', DEFAULT_THEME_COLOR);
  const DEFAULT_MAX_UNITS = 10;
  const storedTitleUnits = GM_getValue('maxTitleUnits', DEFAULT_MAX_UNITS);
  const storedUserUnits = GM_getValue('maxUserUnits', DEFAULT_MAX_UNITS);
  const maxTitleUnits = (storedTitleUnits === 'none') ? Infinity : parseInt(storedTitleUnits, 10);
  const maxUserUnits = (storedUserUnits === 'none') ? Infinity : parseInt(storedUserUnits, 10);
  let hideAvatar = GM_getValue('hideAvatar', true);
  const AVATAR_BLOCK_HOST = 'gravatar.loli.net';
  const AVATAR_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const enableCopy = GM_getValue('enableCopy', true);
  const enableDescCopy = GM_getValue('enableDescCopy', false);
  const hideOrig = GM_getValue('hideOrig', true);
  const showUserNickname = GM_getValue('showUserNickname', false);
  const enableMenu = GM_getValue('enableUserMenu', true);
  const enablePlanAdder = GM_getValue('enablePlanAdder', true);
  const enableGuard = GM_getValue('enableGuard', false);
  const enableAutoRenew = GM_getValue('enableAutoRenew', false);
  const SUBMITTERS_CONFIG_URL = 'submitter/submitters.json';
  const SUPPORTED_PORTS = new Set(['', '8888', '5283']);
  const SUPPORTED_HOSTS = new Set(['7fa4.cn', '10.210.57.10', '211.137.101.118']);
  const REMOTE_VERSION_URL = 'http://jx.7fa4.cn:9080/yx/better-names-for-7fa4/-/raw/main/version';
  const REMOTE_VERSION_FALLBACK_URL = 'http://in.7fa4.cn:9080/yx/better-names-for-7fa4/-/raw/main/version';
  const REMOTE_VERSION_URLS = [REMOTE_VERSION_URL, REMOTE_VERSION_FALLBACK_URL];
  const REMOTE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/;
  const UPDATE_PAGE_URL = 'http://jx.7fa4.cn:9080/yx/better-names-for-7fa4';
  const manifestVersion = normalizeVersionString(readManifestVersion());
  const isSupportedHostname = (host) => {
    if (typeof host !== 'string' || !host) return false;
    if (SUPPORTED_HOSTS.has(host)) return true;
    return host.endsWith('.7fa4.cn');
  };
  const storedSelectedSubmitter = GM_getValue('selectedSubmitter', 'none');
  const enableRankingFilterSetting = GM_getValue('rankingFilter.enabled', false);
  const enableColumnSwitchSetting = GM_getValue('rankingFilter.columnSwitch.enabled', true) !== false;
  const enableMergeAssistantSetting = GM_getValue('rankingMerge.enabled', true) !== false;
  const enableVjLink = GM_getValue('enableVjLink', true);
  const hideDoneSkip = GM_getValue('hideDoneSkip', false);
  let rawQuickSkip;
  let quickSkipMigrated = false;
  try {
    rawQuickSkip = GM_getValue('enableQuickSkip');
  } catch (err) {
    rawQuickSkip = undefined;
  }
  try {
    quickSkipMigrated = !!GM_getValue('quickSkip.migrated.v1', false);
  } catch (err) {
    quickSkipMigrated = false;
  }
  const normalizeQuickSkip = (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return false;
      if (/^(false|0)$/i.test(trimmed)) return false;
      if (/^(true|1)$/i.test(trimmed)) return true;
      return true;
    }
    return true;
  };
  let enableQuickSkip = normalizeQuickSkip(rawQuickSkip);
  if (!quickSkipMigrated) {
    if (enableQuickSkip === undefined || enableQuickSkip === false) {
      enableQuickSkip = true;
    }
    try {
      GM_setValue('enableQuickSkip', enableQuickSkip);
      GM_setValue('quickSkip.migrated.v1', true);
      quickSkipMigrated = true;
    } catch (_) { /* ignore */ }
  }
  if (enableQuickSkip === undefined) enableQuickSkip = true;
  const enableTitleOptimization = GM_getValue('enableTitleOptimization', true);
  const WIDTH_MODE_KEY = 'truncate.widthMode';
  const widthMode = GM_getValue(WIDTH_MODE_KEY, 'visual');
  const BN_TABLE_ROWS_SELECTOR = 'table.ui.very.basic.center.aligned.table tbody tr';
  const MAX_LOCAL_BG_SIZE = 2 * 1024 * 1024;

  const RENEW_PATH_RE = /^\/problems\/tag\/(\d+)\/?$/;
  const RENEW_SUFFIX_RE = /\/renew\/?$/;
  const AUTO_RENEW_MEMORY_KEY = 'bn:autoRenew:lastRedirect';
  const AUTO_RENEW_MEMORY_TTL = 120000;

  function clampOpacity(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0.1;
    if (num <= 0) return 0.01;
    if (num > 1) return 1;
    return num;
  }
  function formatOpacityText(value) {
    const num = clampOpacity(value);
    return num.toFixed(2).replace(/\.?0+$/, '');
  }
  function clampHiToiletInterval(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_BT_INTERVAL;
    const rounded = Math.round(num);
    if (rounded < HI_TOILET_INTERVAL_MIN) return HI_TOILET_INTERVAL_MIN;
    if (rounded > HI_TOILET_INTERVAL_MAX) return HI_TOILET_INTERVAL_MAX;
    return rounded;
  }
  const isAvatarBlockingEnabled = () => !!hideAvatar;
  function runAvatarSanitizer() {
    if (typeof window.__BN_FORCE_AVATAR_SANITIZE__ !== 'function') return;
    try {
      window.__BN_FORCE_AVATAR_SANITIZE__();
    } catch (error) {
      console.warn('[BN] Avatar sanitizer failed', error);
    }
  }
  function ensureAvatarBlockerInstalled(forceRetry = false) {
    if (window.__BN_AVATAR_BLOCKER_INSTALLED__) return true;
    if (forceRetry) delete window.__BN_AVATAR_BLOCKER_FAILED__;
    if (window.__BN_AVATAR_BLOCKER_FAILED__) return false;
    try {
      const ok = installAvatarBlocker();
      if (!ok) {
        window.__BN_AVATAR_BLOCKER_FAILED__ = true;
        console.warn('[BN] Avatar blocker prerequisites unavailable; will retry later');
        return false;
      }
      return true;
    } catch (error) {
      window.__BN_AVATAR_BLOCKER_FAILED__ = true;
      console.warn('[BN] Failed to install avatar blocker', error);
      return false;
    }
  }
  // Prevent loading third-party avatar hosts whenever avatars are hidden.
  function shouldBlockAvatarUrl(url) {
    if (url === undefined || url === null) return false;
    try {
      const parsed = new URL(String(url), window.location.href);
      return parsed.hostname && parsed.hostname.toLowerCase() === AVATAR_BLOCK_HOST;
    } catch (_) {
      return false;
    }
  }
  function installAvatarBlocker() {
    if (window.__BN_AVATAR_BLOCKER_INSTALLED__ || window.__BN_AVATAR_BLOCKER_INSTALLING__) return true;
    if (!document || typeof document.querySelectorAll !== 'function') return false;
    const imgCtor = (typeof HTMLImageElement === 'undefined') ? null : HTMLImageElement;
    if (!imgCtor || !imgCtor.prototype) return false;
    window.__BN_AVATAR_BLOCKER_INSTALLING__ = true;
    try {
      const nativeSrcDescriptor = Object.getOwnPropertyDescriptor(imgCtor.prototype, 'src');
      const elementProto = (typeof Element !== 'undefined' && Element.prototype) ? Element.prototype : null;
      const nativeSetAttribute = (imgCtor.prototype.setAttribute || (elementProto && elementProto.setAttribute));
      if (!nativeSetAttribute) return false;
      const nativeFetch = typeof window.fetch === 'function' ? window.fetch : null;
      const nativeXhrOpen = (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) ? XMLHttpRequest.prototype.open : null;
      const nativeXhrSend = (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.send) ? XMLHttpRequest.prototype.send : null;
      const shouldBlockLoad = (value) => isAvatarBlockingEnabled() && shouldBlockAvatarUrl(value);

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
          console.warn('[BN] Failed to assign placeholder avatar', error);
        }
      };
      const applyPlaceholder = (img) => {
        if (!img) return;
        assignSrc(img, AVATAR_PLACEHOLDER_SRC);
        try {
          img.dataset.bnAvatarBlocked = 'true';
        } catch (_) { /* ignore */ }
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
                if (isAvatarBlockingEnabled()) applyPlaceholder(this);
                return;
              }
              assignSrc(this, value);
            },
          });
        } catch (error) {
          console.warn('[BN] Failed to patch HTMLImageElement.src', error);
        }
      }

      try {
        imgCtor.prototype.setAttribute = function (name, value) {
          if (
            typeof name === 'string' &&
            name.toLowerCase() === 'src' &&
            shouldBlockLoad(String(value || ''))
          ) {
            if (isAvatarBlockingEnabled()) applyPlaceholder(this);
            return;
          }
          return nativeSetAttribute.call(this, name, value);
        };
      } catch (error) {
        console.warn('[BN] Failed to patch image setAttribute', error);
      }

      const sanitizeExistingImages = () => {
        if (!isAvatarBlockingEnabled()) return;
        try {
          document.querySelectorAll('img').forEach(img => {
            const current = img.getAttribute('src') || img.currentSrc || img.src || '';
            if (shouldBlockAvatarUrl(current)) applyPlaceholder(img);
          });
        } catch (error) {
          console.warn('[BN] Avatar sanitize iteration failed', error);
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
          console.warn('[BN] Failed to patch window.fetch', error);
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
          console.warn('[BN] Failed to patch XMLHttpRequest', error);
        }
      }

      if (typeof document.addEventListener === 'function') {
        try {
          document.addEventListener('beforeload', (event) => {
            if (!isAvatarBlockingEnabled()) return;
            const target = event.target;
            const url = (target && (target.currentSrc || target.src || target.href)) || event.url;
            if (!shouldBlockAvatarUrl(url)) return;
            try { event.preventDefault(); } catch (_) { /* ignore */ }
            if (target && target.tagName === 'IMG') applyPlaceholder(target);
          }, true);
        } catch (error) {
          console.warn('[BN] Failed to attach beforeload listener', error);
        }
      }

      sanitizeExistingImages();
      if (typeof MutationObserver === 'function') {
        try {
          const mo = new MutationObserver(() => sanitizeExistingImages());
          mo.observe(document, { childList: true, subtree: true });
          window.__BN_AVATAR_BLOCKER_MO__ = mo;
        } catch (error) {
          console.warn('[BN] Avatar blocker MutationObserver failed', error);
        }
      }

      window.__BN_AVATAR_BLOCKER_INSTALLED__ = true;
      return true;
    } finally {
      delete window.__BN_AVATAR_BLOCKER_INSTALLING__;
    }
  }
  function readManifestVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
        const manifest = chrome.runtime.getManifest();
        if (manifest && manifest.version) {
          return String(manifest.version);
        }
      }
    } catch (error) {
      console.warn('[BN] 读取 manifest 版本失败', error);
    }
    return '';
  }
  function normalizeVersionString(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const newlineIndex = trimmed.indexOf('\n');
    const sliced = newlineIndex >= 0 ? trimmed.slice(0, newlineIndex) : trimmed;
    return sliced.replace(/\r/g, '');
  }
  function normalizeHexColor(value, fallback = DEFAULT_THEME_COLOR) {
    const normalizedFallback = (() => {
      if (typeof fallback === 'string') {
        const trimmed = fallback.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.slice(1).toLowerCase()}`;
      }
      return DEFAULT_THEME_COLOR;
    })();
    if (typeof value !== 'string') return normalizedFallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.slice(1).toLowerCase()}`;
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const hex = trimmed.slice(1);
      const expanded = hex.split('').map(ch => `${ch}${ch}`).join('');
      return `#${expanded.toLowerCase()}`;
    }
    return normalizedFallback;
  }
  function normalizeThemeMode(value) {
    if (typeof value === 'string' && value.toLowerCase() === 'dark') return 'dark';
    return 'light';
  }
  function ensureBody(callback) {
    if (document.body) {
      callback();
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    requestAnimationFrame(callback);
  }

  function applyBackgroundOverlay(enabled,fillway,url, opacity) {
    ensureBody(() => {
      let layer = document.getElementById('bn-background-image');
      const trimmedUrl = typeof url === 'string' ? url.trim() : '';
      if (!enabled || !trimmedUrl) {
        if (layer) layer.remove();
        return;
      }
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'bn-background-image';
        Object.assign(layer.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          zIndex: '9999',
          pointerEvents: 'none',
        });
        document.body.insertAdjacentElement('afterbegin', layer);
      }
      layer.style.opacity = String(clampOpacity(opacity));
      layer.style.background = `url("${trimmedUrl}") ${backgroundStyles[fillway]}`;
    });
  }
  const normalizedBgData = typeof storedBgImageData === 'string' ? storedBgImageData.trim() : '';
  const normalizedBgfillway = storedBgfillway;
  const normalizedBgUrl = typeof storedBgImageUrl === 'string' ? storedBgImageUrl.trim() : '';
  console.log(normalizedBgUrl);
  console.log(normalizedBgfillway);
  const normalizedBgSourceType = (() => {
    if (storedBgSourceTypeRaw === 'local' && normalizedBgData) return 'local';
    if (storedBgSourceTypeRaw === 'remote') return 'remote';
    return normalizedBgData ? 'local' : 'remote';
  })();
  const normalizedBgFileName = typeof storedBgImageDataName === 'string' ? storedBgImageDataName : '';
  const normalizedBgOpacity = String(clampOpacity(storedBgOpacity));
  const initialBackgroundSource = (normalizedBgSourceType === 'local' && normalizedBgData)
    ? normalizedBgData
    : normalizedBgUrl;
  applyBackgroundOverlay(storedBgEnabled,storedBgfillway, initialBackgroundSource, normalizedBgOpacity);

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
      if (!SUPPORTED_PORTS.has(url.port || '')) return null;
      const host = url.hostname || '';
      if (!isSupportedHostname(host)) return null;
      if (RENEW_SUFFIX_RE.test(url.pathname)) return null;
      const match = url.pathname.match(RENEW_PATH_RE);
      if (!match || match[1] % 100 == 0) return null;
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

  pruneAutoRenewMemory();

  if (enableAutoRenew) {
    const redirectTarget = computeRenewUrl(location.href);
    if (redirectTarget && redirectTarget !== location.href) {
      const currentTagMatch = location.pathname.match(RENEW_PATH_RE);
      if (!currentTagMatch || !consumeAutoRenewRedirect(currentTagMatch[1])) {
        const tagMatch = currentTagMatch || redirectTarget.match(/\/problems\/tag\/(\d+)\/renew\/?$/);
        const tagId = tagMatch ? tagMatch[1] : null;
        if (tagId) markAutoRenewRedirect(tagId);
        location.replace(redirectTarget);
        return;
      }
    }
  }

  const COLOR_KEYS = ['x4', 'x5', 'x6', 'c1', 'c2', 'c3', 'g1', 'g2', 'g3', 'd1', 'd2', 'd3', 'd4', 'by', 'jl', 'uk'];
  const COLOR_LABELS = { x4: '小2022级', x5: '小2021级', x6: '小2020级', c1: '初2025级', c2: '初2024级', c3: '初2023级', g1: '高2025级', g2: '高2024级', g3: '高2023级', d1: '大2025级', d2: '大2024级', d3: '大2023级', d4: '大2022级', by: '毕业', jl: '教练', uk: '其他' };
  const GRADE_LABELS = { x4: '小2022级', x5: '小2021级', x6: '小2020级', c1: '初2025级', c2: '初2024级', c3: '初2023级', g1: '高2025级', g2: '高2024级', g3: '高2023级', d1: '大2025级', d2: '大2024级', d3: '大2023级', d4: '大2022级', by: '毕业', jl: '教练', uk: '其他' };

  function safeGetJSON(key, fallback) {
    try {
      const v = GM_getValue(key, null);
      if (v == null) return fallback;
      if (typeof v === 'string') return JSON.parse(v);
      if (typeof v === 'object') return v;
      return fallback;
    } catch { return fallback; }
  }
  const themeColor = normalizeHexColor(storedThemeColorRaw, DEFAULT_THEME_COLOR);
  const themeMode = normalizeThemeMode(storedThemeModeRaw);
  const storedPalette = safeGetJSON('userPalette', {});
  const useCustomColors = GM_getValue('useCustomColors', false);

  const palettes = {
    light: { x4: '#5a5a5a', x5: '#92800b', x6: '#b2ad2a', c1: '#ff0000', c2: '#ff6629', c3: '#ffbb00', g1: '#ca00ca', g2: '#62ca00', g3: '#13c2c2', d1: '#9900ff', d2: '#000cff', d3: '#597ef7', d4: '#186334', by: '#8c8c8c', jl: '#ff85c0', uk: '#5e6e5e' }
  };

  const palette = Object.assign({}, palettes.light, useCustomColors ? storedPalette : {});
  let currentThemeMode = themeMode;

  const runtimeApi = (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.getURL === 'function')
    ? browser.runtime
    : ((typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') ? chrome.runtime : null);

  async function fetchPanelTemplate() {
    const templateUrl = runtimeApi && typeof runtimeApi.getURL === 'function'
      ? runtimeApi.getURL('content/panel/panel.html')
      : null;
    if (!templateUrl) {
      console.warn('[BN] runtime API 不可用，回退至内置面板模板');
      return FALLBACK_PANEL_TEMPLATE;
    }
    try {
      const response = await fetch(templateUrl, { mode: 'same-origin', cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      return text && text.trim() ? text : FALLBACK_PANEL_TEMPLATE;
    } catch (error) {
      console.error('[BN] 加载面板模板失败，使用内置模板:', error);
      return FALLBACK_PANEL_TEMPLATE;
    }
  }

  const colorInputsHTML = COLOR_KEYS.map(k => `
    <div class="bn-color-item">
      <label>${COLOR_LABELS[k] || k}:</label>
      <input type="color" id="bn-color-${k}" value="${palette[k]}">
      <input type="text" class="bn-color-hex" id="bn-color-${k}-hex" value="${palette[k]}">
    </div>
  `).join('');

  const panelTemplate = await fetchPanelTemplate();
  if (!panelTemplate) {
    console.error('[BN] 未能获取面板模板，初始化中止');
    return;
  }

  const container = document.createElement('div');
  container.id = 'bn-container';
  container.innerHTML = panelTemplate;
  container.style.setProperty('--bn-theme-color', themeColor);
  applyThemeMode(currentThemeMode);

  const colorGrid = container.querySelector('#bn-color-grid');
  if (colorGrid) {
    colorGrid.innerHTML = colorInputsHTML;
  }

  if (!document.body) {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  document.body.appendChild(container);
  bringContainerToFront();

  const panel = document.getElementById('bn-panel');
  const pinBtn = document.getElementById('bn-pin');
  const trigger = document.getElementById('bn-trigger');
  const themeColorInput = document.getElementById('bn-theme-color');
  const themeColorHexInput = document.getElementById('bn-theme-color-hex');
  const themeModeRadios = container.querySelectorAll('input[name="bn-theme-mode"]');
  const bgEnabledInput = document.getElementById('bn-bg-enabled');
  const bgfillwayInput = document.getElementById('bn-bg-fillway');
  const bgUrlInput = document.getElementById('bn-bg-image-url');
  const bgOpacityInput = document.getElementById('bn-bg-opacity');
  const bgOpacityValueSpan = document.getElementById('bn-bg-opacity-value');
  const bgFileInput = document.getElementById('bn-bg-image-file');
  const bgFilePickBtn = document.getElementById('bn-bg-image-file-btn');
  const bgFileNameSpan = document.getElementById('bn-bg-image-file-name');
  const bgFileClearBtn = document.getElementById('bn-bg-clear-local');
  const bgSourceHint = document.getElementById('bn-bg-source-hint');
  const hiToiletInput = document.getElementById('bn-bt-enabled');
  const hiToiletIntervalInput = document.getElementById('bn-bt-interval');
  const hiToiletIntervalValue = document.getElementById('bn-bt-interval-value');
  const versionTextEl = document.getElementById('bn-version-text');
  const updateNoticeEl = document.getElementById('bn-update-notice');
  const updateVersionEl = document.getElementById('bn-update-version');
  const updateLinkEl = document.getElementById('bn-update-link');
  if (!panel || !pinBtn || !trigger) {
    console.error('[BN] 面板初始化失败：缺少必要的 DOM 元素');
    container.remove();
    return;
  }
  if (versionTextEl && manifestVersion) {
    const slogan = (versionTextEl.dataset && versionTextEl.dataset.slogan) ? String(versionTextEl.dataset.slogan).trim() : '';
    versionTextEl.textContent = slogan ? `${manifestVersion} · ${slogan}` : manifestVersion;
  }
  if (updateLinkEl) {
    updateLinkEl.href = UPDATE_PAGE_URL;
  }
  if (updateNoticeEl && manifestVersion) {
    checkForPanelUpdates(updateNoticeEl, updateVersionEl);
  }
  syncThemeModeUI(currentThemeMode);
  applyThemeMode(currentThemeMode);
  let pinned = !!GM_getValue('panelPinned', false);
  const CORNER_KEY = 'bn.corner';
  const SNAP_MARGIN = 20;
  const DRAG_THRESHOLD = 6;
  let isDragging = false;
  let dragPending = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let gearW = 48, gearH = 48;
  let __bn_trail = [];
  let __bn_raf = null;
  let __bn_dragX = 0, __bn_dragY = 0;
  let __bn_pointerId = null;
  let currentBgSourceType = normalizedBgSourceType;
  let currentBgImageData = normalizedBgData;
  let currentBgImageDataName = normalizedBgFileName;

  initSubmittersSelector();

  function applyThemeMode(mode) {
    const nextMode = (mode === 'dark') ? 'dark' : 'light';
    currentThemeMode = nextMode;
    container.classList.toggle('bn-theme-dark', nextMode === 'dark');
  }
  function syncThemeModeUI(mode) {
    if (!themeModeRadios || !themeModeRadios.length) return;
    themeModeRadios.forEach(radio => {
      radio.checked = radio.value === mode;
    });
  }
  function getSelectedThemeMode() {
    if (!themeModeRadios || !themeModeRadios.length) return currentThemeMode;
    const active = Array.from(themeModeRadios).find(radio => radio.checked);
    return active && active.value === 'dark' ? 'dark' : 'light';
  }

  function bringContainerToFront() {
    try {
      container.style.zIndex = '2147483647';
      const parent = container.parentElement;
      if (parent && parent.lastElementChild !== container) {
        parent.appendChild(container);
      }
    } catch (error) {
      console.warn('[BN] Failed to elevate panel container', error);
    }
  }

  function updateContainerState() {
    if (isDragging || container.classList.contains('bn-dragging')) {
      container.classList.add('bn-collapsed');
      return;
    }
    if (pinned || panel.classList.contains('bn-show')) {
      container.classList.remove('bn-collapsed');
    } else {
      container.classList.add('bn-collapsed');
    }
  }

  function applyCorner(pos) {
    container.classList.remove('bn-pos-br', 'bn-pos-bl', 'bn-pos-tr', 'bn-pos-tl');
    container.classList.add('bn-pos-' + pos);
    const offset = `${SNAP_MARGIN}px`;
    switch (pos) {
      case 'tl':
        container.style.top = offset;
        container.style.left = offset;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        break;
      case 'tr':
        container.style.top = offset;
        container.style.right = offset;
        container.style.left = 'auto';
        container.style.bottom = 'auto';
        break;
      case 'bl':
        container.style.bottom = offset;
        container.style.left = offset;
        container.style.right = 'auto';
        container.style.top = 'auto';
        break;
      case 'br':
      default:
        container.style.bottom = offset;
        container.style.right = offset;
        container.style.left = 'auto';
        container.style.top = 'auto';
        break;
    }
    try {
      GM_setValue(CORNER_KEY, pos);
    } catch (_) {}
  }

  const initialCorner = GM_getValue(CORNER_KEY, 'br');
  applyCorner(initialCorner);
  updateContainerState();

  const titleInp = document.getElementById('bn-title-input');
  const userInp = document.getElementById('bn-user-input');
  const chkTitleTr = document.getElementById('bn-enable-title-truncate');
  const chkUserTr = document.getElementById('bn-enable-user-truncate');
  const widthModeSel = document.getElementById('bn-width-mode');

  const chkAv = document.getElementById('bn-hide-avatar');
  const chkCp = document.getElementById('bn-enable-copy');
  const chkDescCp = document.getElementById('bn-enable-desc-copy');
  const chkHo = document.getElementById('bn-hide-orig');
  const chkShowNickname = document.getElementById('bn-show-user-nickname');

  const chkMenu = document.getElementById('bn-enable-user-menu');
  const chkPlan = document.getElementById('bn-enable-plan');
  const chkAutoRenew = document.getElementById('bn-enable-renew');
  const chkRankingFilter = document.getElementById('bn-enable-ranking-filter');
  const chkColumnSwitch = document.getElementById('bn-enable-column-switch');
  const chkMergeAssistant = document.getElementById('bn-enable-merge-assistant');
  const submitterSelect = document.getElementById('bn-submitter-select');
  const submitterDescription = document.getElementById('bn-submitter-description');
  const chkUseColor = document.getElementById('bn-use-custom-color');

  const colorSidebar = document.getElementById('bn-color-sidebar');
  const saveActions = document.getElementById('bn-save-actions');
  const chkVj = document.getElementById('bn-enable-vj');
  const chkHideDoneSkip = document.getElementById('bn-hide-done-skip');
  const chkQuickSkip = document.getElementById('bn-enable-quick-skip');
  const chkTitleOpt = document.getElementById('bn-enable-title-optimization');

  chkTitleTr.checked = isFinite(maxTitleUnits);
  titleInp.value = isFinite(maxTitleUnits) ? maxTitleUnits : '';
  titleInp.disabled = !chkTitleTr.checked;

  chkUserTr.checked = isFinite(maxUserUnits);
  userInp.value = isFinite(maxUserUnits) ? maxUserUnits : '';
  userInp.disabled = !chkUserTr.checked;

  if (widthModeSel) widthModeSel.value = widthMode;

  chkAv.checked = hideAvatar;
  chkCp.checked = enableCopy;
  chkDescCp.checked = enableDescCopy;
  chkHo.checked = hideOrig;
  chkShowNickname.checked = showUserNickname;
  chkMenu.checked = enableMenu;
  chkPlan.checked = enablePlanAdder;
  chkAutoRenew.checked = enableAutoRenew;
  chkRankingFilter.checked = enableRankingFilterSetting;
  if (chkColumnSwitch) chkColumnSwitch.checked = enableColumnSwitchSetting;
  if (chkMergeAssistant) chkMergeAssistant.checked = enableMergeAssistantSetting;

  chkUseColor.checked = useCustomColors;

  chkVj.checked = enableVjLink;
  chkHideDoneSkip.checked = hideDoneSkip;
  chkQuickSkip.checked = enableQuickSkip;
  chkTitleOpt.checked = enableTitleOptimization;

  const disableNeedWarn = () => {
    if (typeof window.needWarn === 'function' && !window.__bnGuardOriginalNeedWarn) {
      window.__bnGuardOriginalNeedWarn = window.needWarn;
    }
    window.needWarn = async () => false;
  };

  const infoPairs = [];
  panel.querySelectorAll('.bn-info').forEach((info, index) => {
    const icon = info.querySelector('.bn-info-icon');
    const tooltip = info.querySelector('.bn-info-tooltip');
    if (!icon) return;

    if (tooltip) {
      if (!tooltip.id) {
        tooltip.id = `bn-info-tooltip-${index}`;
      }
      icon.setAttribute('aria-describedby', tooltip.id);
    }

    const activateInfo = () => {
      info.classList.add('bn-info-active');
    };
    const deactivateInfo = () => {
      if (info.contains(document.activeElement)) return;
      info.classList.remove('bn-info-active');
    };

    icon.addEventListener('pointerenter', activateInfo);
    icon.addEventListener('pointerleave', deactivateInfo);
    icon.addEventListener('focus', activateInfo);
    icon.addEventListener('blur', () => {
      info.classList.remove('bn-info-active');
    });

    infoPairs.push({ info, icon });
  });

  if (infoPairs.length) {
    document.addEventListener('pointerdown', (event) => {
      infoPairs.forEach(({ info, icon }) => {
        if (info.contains(event.target)) return;
        if (document.activeElement === icon) {
          icon.blur();
        }
        info.classList.remove('bn-info-active');
      });
    });
  }

  const colorPickers = {};
  const hexInputs = {};
  const originalConfig = {
    titleTruncate: isFinite(maxTitleUnits),
    userTruncate: isFinite(maxUserUnits),
    maxTitleUnits,
    maxUserUnits,
    hideAvatar,
    enableCopy,
    enableDescCopy,
    hideOrig,
    showUserNickname,
    enableMenu,
    enablePlanAdder,
    enableAutoRenew,
    enableRankingFilter: enableRankingFilterSetting,
    columnSwitchEnabled: enableColumnSwitchSetting,
    mergeAssistantEnabled: enableMergeAssistantSetting,
    selectedSubmitter: storedSelectedSubmitter,
    useCustomColors,
    themeColor,
    themeMode: currentThemeMode,
    palette: Object.assign({}, palette),
    enableVjLink,
    hideDoneSkip,
    enableQuickSkip,
    enableTitleOptimization,
    widthMode,
    bgEnabled: storedBgEnabled,
    bgfillway:normalizedBgfillway,
    bgImageUrl: normalizedBgUrl,
    bgImageData: normalizedBgData,
    bgImageDataName: normalizedBgFileName,
    bgSourceType: normalizedBgSourceType,
    bgOpacity: normalizedBgOpacity,
    btEnabled: btEnabled,
    btInterval: storedBtInterval
  };
  currentBgSourceType = originalConfig.bgSourceType;
  currentBgImageData = originalConfig.bgImageData;
  currentBgImageDataName = originalConfig.bgImageDataName;

  if (!enableGuard) {
    disableNeedWarn();
  }

  const WAKE_REASON_PIN = 'pin';
  const WAKE_REASON_TRIGGER = 'hover:trigger';
  const WAKE_REASON_PANEL = 'hover:panel';
  const WAKE_REASON_FOCUS = 'focus';
  const PANEL_HIDE_DELAY = 300;
  const HOVER_SUPPRESS_MS = 600;
  const wakeReasons = new Set();
  let pointerMovedSinceLoad = false;
  const hoverSuppressUntil = (() => {
    if (typeof performance !== 'undefined' && performance.now) return performance.now() + HOVER_SUPPRESS_MS;
    return Date.now() + HOVER_SUPPRESS_MS;
  })();
  const nowTs = () => {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  };

  window.addEventListener('pointermove', () => { pointerMovedSinceLoad = true; }, { once: true, passive: true });
  const canHonorHoverWake = () => pointerMovedSinceLoad && nowTs() >= hoverSuppressUntil;

  let hideTimer = null;
  let initialRevealPending = true;
  let initialRevealFrame = null;

  const cancelPendingReveal = () => {
    if (initialRevealFrame != null) {
      cancelAnimationFrame(initialRevealFrame);
      initialRevealFrame = null;
    }
  };
  const shouldRevealPanel = () => pinned || wakeReasons.size > 0;

  const cancelHide = () => {
    if (hideTimer != null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const showPanel = () => {
    if (isDragging || container.classList.contains('bn-dragging')) return;
    bringContainerToFront();
    if (panel.classList.contains('bn-show')) {
      cancelPendingReveal();
      panel.classList.add('bn-show');
      updateContainerState();
      return;
    }
    const commitReveal = () => {
      initialRevealFrame = null;
      if (!shouldRevealPanel()) return;
      panel.classList.add('bn-show');
      updateContainerState();
    };
    if (initialRevealPending) {
      initialRevealPending = false;
      initialRevealFrame = requestAnimationFrame(() => {
        initialRevealFrame = requestAnimationFrame(commitReveal);
      });
    } else {
      commitReveal();
    }
  };
  const hidePanel = () => {
    if (pinned) return;
    cancelPendingReveal();
    panel.classList.remove('bn-show');
    if (panel.contains(document.activeElement)) document.activeElement.blur();
    updateContainerState();
  };
  const detectHoverReason = () => {
    try {
      if (panel.matches(':hover')) return WAKE_REASON_PANEL;
      if (trigger.matches(':hover')) return WAKE_REASON_TRIGGER;
    } catch (_) { /* ignore */ }
    return null;
  };

  const requestWake = (reason) => {
    if (reason) wakeReasons.add(reason);
    cancelHide();
    showPanel();
  };
  const scheduleHide = () => {
    cancelHide();
    if (wakeReasons.size || pinned) return;
    hideTimer = setTimeout(() => {
      if (pinned || wakeReasons.size) return;
      const hoverReason = detectHoverReason();
      if (hoverReason) {
        if (canHonorHoverWake()) {
          requestWake(hoverReason);
        }
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement && container.contains(activeElement)) {
        if (panel.classList.contains('bn-show') || canHonorHoverWake()) {
          requestWake(WAKE_REASON_FOCUS);
        }
        return;
      }
      hidePanel();
    }, PANEL_HIDE_DELAY);
  };
  const releaseWake = (reason) => {
    if (!reason) return;
    if (!wakeReasons.delete(reason)) return;
    if (!wakeReasons.size && !pinned) scheduleHide();
  };

  const attachHoverWake = (element, reason) => {
    if (!element) return;
    element.addEventListener('mouseenter', () => {
      if (!canHonorHoverWake()) return;
      requestWake(reason);
    });
    element.addEventListener('mouseleave', () => releaseWake(reason));
  };

  const syncPinnedState = () => {
    pinBtn.classList.toggle('bn-pinned', pinned);
    if (pinned) requestWake(WAKE_REASON_PIN);
    else releaseWake(WAKE_REASON_PIN);
  };

  syncPinnedState();
  updateContainerState();

  titleInp.disabled = !originalConfig.titleTruncate;
  userInp.disabled = !originalConfig.userTruncate;
  if (themeColorInput) {
    themeColorInput.value = themeColor;
    themeColorInput.addEventListener('input', () => {
      const normalized = normalizeHexColor(themeColorInput.value, originalConfig.themeColor);
      themeColorInput.value = normalized;
      if (themeColorHexInput) themeColorHexInput.value = normalized;
      container.style.setProperty('--bn-theme-color', normalized);
      checkChanged();
    });
  }
  if (themeModeRadios && themeModeRadios.length) {
    themeModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const nextMode = getSelectedThemeMode();
        applyThemeMode(nextMode);
        checkChanged();
      });
    });
  }
  if (themeColorHexInput) {
    themeColorHexInput.value = themeColor;
    const syncThemeColorFromHex = (value) => {
      const trimmed = value.trim();
      const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
      const normalized = normalizeHexColor(prefixed, themeColorInput ? themeColorInput.value : originalConfig.themeColor);
      if (themeColorInput) themeColorInput.value = normalized;
      themeColorHexInput.value = normalized;
      container.style.setProperty('--bn-theme-color', normalized);
    };
    themeColorHexInput.addEventListener('input', () => {
      const raw = themeColorHexInput.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
        syncThemeColorFromHex(raw.startsWith('#') ? raw : `#${raw}`);
      }
      checkChanged();
    });
    themeColorHexInput.addEventListener('blur', () => {
      syncThemeColorFromHex(themeColorHexInput.value);
      checkChanged();
    });
    themeColorHexInput.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        syncThemeColorFromHex(themeColorHexInput.value);
        themeColorHexInput.blur();
      }
    });
  }

  COLOR_KEYS.forEach(k => {
    colorPickers[k] = document.getElementById(`bn-color-${k}`);
    hexInputs[k] = document.getElementById(`bn-color-${k}-hex`);

    if (colorPickers[k] && hexInputs[k]) {
      colorPickers[k].value = palette[k];
      hexInputs[k].value = palette[k];

      colorPickers[k].oninput = () => {
        hexInputs[k].value = colorPickers[k].value;
        checkChanged();
      };
      hexInputs[k].oninput = () => {
        const v = hexInputs[k].value.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
          const val = v.startsWith('#') ? v : '#' + v;
          colorPickers[k].value = val;
        }
        checkChanged();
      };
    }
  });

  chkUseColor.onchange = () => {
    const isChecked = chkUseColor.checked;
    if (isChecked) {
      container.classList.add('bn-expanded');
      panel.classList.add('bn-expanded');
      setTimeout(() => colorSidebar.classList.add('bn-show'), 200);
    } else {
      colorSidebar.classList.remove('bn-show');
      setTimeout(() => { container.classList.remove('bn-expanded'); panel.classList.remove('bn-expanded'); }, 200);
    }
    checkChanged();
  };

  if (useCustomColors) {
    container.classList.add('bn-expanded');
    panel.classList.add('bn-expanded');
    colorSidebar.classList.add('bn-show');
  }

  attachHoverWake(trigger, WAKE_REASON_TRIGGER);
  attachHoverWake(panel, WAKE_REASON_PANEL);
  trigger.addEventListener('click', (event) => {
    if (isDragging || container.classList.contains('bn-dragging')) return;
    event.preventDefault();
    if (panel.classList.contains('bn-show')) {
      releaseWake(WAKE_REASON_TRIGGER);
      hidePanel();
    } else {
      requestWake(WAKE_REASON_TRIGGER);
      showPanel();
    }
  });
  container.addEventListener('focusin', () => {
    if (!panel.classList.contains('bn-show') && !canHonorHoverWake()) return;
    requestWake(WAKE_REASON_FOCUS);
  });
  container.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next && container.contains(next)) return;
    releaseWake(WAKE_REASON_FOCUS);
  });

  const __bn_lagMs = 100;
  const __bn_trailWindow = 400;
  const __bn_now = () => (window.performance && performance.now) ? performance.now() : Date.now();

  function __bn_pushTrail(e) {
    const t = __bn_now();
    __bn_trail.push({ t, x: e.clientX, y: e.clientY });
    const cutoff = t - __bn_trailWindow;
    while (__bn_trail.length && __bn_trail[0].t < cutoff) __bn_trail.shift();
  }
  function __bn_sampleAt(tgt) {
    if (!__bn_trail.length) return null;
    if (tgt <= __bn_trail[0].t) return __bn_trail[0];
    const last = __bn_trail[__bn_trail.length - 1];
    if (tgt >= last.t) return last;
    let lo = 0, hi = __bn_trail.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; (__bn_trail[mid].t < tgt) ? (lo = mid + 1) : (hi = mid - 1); }
    const a = __bn_trail[lo - 1], b = __bn_trail[lo];
    const r = (tgt - a.t) / Math.max(1, b.t - a.t);
    return { t: tgt, x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  }
  function __bn_applyTransform(x, y) {
    __bn_dragX = x; __bn_dragY = y;
    trigger.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  function __bn_beginDrag(e) {
    dragPending = false;
    isDragging = true;
    panel.classList.remove('bn-show');

    const rect = trigger.getBoundingClientRect();
    gearW = rect.width; gearH = rect.height;
    trigger.style.position = 'fixed';
    trigger.style.left = '0px'; trigger.style.top = '0px';
    trigger.style.bottom = 'auto'; trigger.style.right = 'auto';
    trigger.style.transition = 'none';
    trigger.style.willChange = 'transform';
    trigger.style.touchAction = 'none';

    container.classList.add('bn-dragging');
    updateContainerState();

    __bn_trail = [];
    __bn_applyTransform(e.clientX - gearW / 2, e.clientY - gearH / 2);

    if (!__bn_raf) __bn_raf = requestAnimationFrame(__bn_tick);
  }
  function __bn_cleanupPointer() {
    dragPending = false;
    if (__bn_pointerId !== null && trigger.releasePointerCapture) {
      try { trigger.releasePointerCapture(__bn_pointerId); } catch (_) { }
    }
    document.removeEventListener('pointermove', __bn_onMove);
    document.removeEventListener('pointerup', __bn_onUp);
    document.removeEventListener('mousemove', __bn_onMove);
    document.removeEventListener('mouseup', __bn_onUp);
    __bn_trail = [];
    __bn_pointerId = null;
  }
  function __bn_tick() {
    if (!isDragging) { __bn_raf = null; return; }
    const s = __bn_sampleAt(__bn_now() - __bn_lagMs);
    if (s) __bn_applyTransform(s.x - gearW / 2, s.y - gearH / 2);
    __bn_raf = requestAnimationFrame(__bn_tick);
  }
  function __bn_onMove(e) {
    if (dragPending) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if ((dx * dx + dy * dy) >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        __bn_beginDrag(e);
      } else {
        return;
      }
    }
    if (!isDragging) return;
    __bn_pushTrail(e);
    if (!__bn_raf) __bn_raf = requestAnimationFrame(__bn_tick);
  }
  function __bn_onUp(e) {
    if (dragPending) {
      dragPending = false;
      if (__bn_raf) cancelAnimationFrame(__bn_raf);
      __bn_raf = null;
      __bn_cleanupPointer();
      return;
    }
    if (!isDragging) {
      __bn_cleanupPointer();
      return;
    }
    isDragging = false;
    if (__bn_raf) cancelAnimationFrame(__bn_raf);
    __bn_raf = null;

    const cx = __bn_dragX + gearW / 2;
    const cy = __bn_dragY + gearH / 2;
    const W = window.innerWidth, H = window.innerHeight;
    const corners = {
      tl: { x: SNAP_MARGIN + gearW / 2, y: SNAP_MARGIN + gearH / 2 },
      tr: { x: W - SNAP_MARGIN - gearW / 2, y: SNAP_MARGIN + gearH / 2 },
      bl: { x: SNAP_MARGIN + gearW / 2, y: H - SNAP_MARGIN - gearH / 2 },
      br: { x: W - SNAP_MARGIN - gearW / 2, y: H - SNAP_MARGIN - gearH / 2 },
    };
    let best = 'br', bestDist = Infinity;
    for (const k in corners) {
      const p = corners[k]; const dx = p.x - cx, dy = p.y - cy; const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) { bestDist = d2; best = k; }
    }
    const fx = corners[best].x - gearW / 2;
    const fy = corners[best].y - gearH / 2;

    let finalized = false;
    let fallbackTimer = null;
    const finalize = () => {
      if (finalized) return;
      finalized = true;

      trigger.style.transition = '';
      trigger.style.position = '';
      trigger.style.left = trigger.style.top = '';
      trigger.style.bottom = trigger.style.right = '';
      trigger.style.transform = '';
      trigger.style.touchAction = '';
      trigger.style.willChange = '';

      applyCorner(best);
      container.classList.remove('bn-dragging');
      if (wakeReasons.size) showPanel();
      updateContainerState();
      __bn_cleanupPointer();
    };

    const onTransitionEnd = (event) => {
      if (event.propertyName && event.propertyName !== 'transform') return;
      trigger.removeEventListener('transitionend', onTransitionEnd);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      finalize();
    };

    trigger.addEventListener('transitionend', onTransitionEnd);
    fallbackTimer = setTimeout(() => {
      trigger.removeEventListener('transitionend', onTransitionEnd);
      finalize();
    }, 320);

    trigger.style.transition = 'transform 0.24s ease-out';
    __bn_applyTransform(fx, fy);
  }
  const __bn_onDown = (e) => {
    if (e.type === 'mousedown' && window.PointerEvent) return;
    if ((e.type === 'mousedown' || e.type === 'pointerdown') && e.button !== 0) return;
    e.preventDefault();

    dragPending = true;
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    __bn_trail = [];

    if (e.pointerId != null && trigger.setPointerCapture) {
      __bn_pointerId = e.pointerId;
      try { trigger.setPointerCapture(e.pointerId); } catch (_) { }
      document.addEventListener('pointermove', __bn_onMove);
      document.addEventListener('pointerup', __bn_onUp);
    } else {
      document.addEventListener('mousemove', __bn_onMove);
      document.addEventListener('mouseup', __bn_onUp);
    }
  };
  if (window.PointerEvent) {
    trigger.addEventListener('pointerdown', __bn_onDown, { passive: false });
  } else {
    trigger.addEventListener('mousedown', __bn_onDown, { passive: false });
  }

  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    GM_setValue('panelPinned', pinned);
    syncPinnedState();
    updateContainerState();
  });

  function markOnce(el, key) {
    const k = `bn${key}`;
    if (!el || !el.dataset) return true;
    if (el.dataset[k]) return false;
    el.dataset[k] = '1';
    return true;
  }

  function checkChanged() {
    const ti = parseInt(titleInp.value, 10);
    const ui = parseInt(userInp.value, 10);
    const paletteChanged = COLOR_KEYS.some(k => {
      return colorPickers[k] && colorPickers[k].value.toLowerCase() !== (originalConfig.palette[k] || '').toLowerCase();
    });
    const currentThemeColor = themeColorInput
      ? normalizeHexColor(themeColorInput.value, originalConfig.themeColor)
      : originalConfig.themeColor;
    const themeColorChanged = themeColorInput
      ? currentThemeColor.toLowerCase() !== (originalConfig.themeColor || '').toLowerCase()
      : false;
    const currentBgEnabled = bgEnabledInput ? bgEnabledInput.checked : originalConfig.bgEnabled;
    const currentBgfillway = bgfillwayInput ? bgfillwayInput.value : originalConfig.bgfillway;
    const currentBgOpacity = bgOpacityInput ? bgOpacityInput.value : originalConfig.bgOpacity;
    const currentBgUrl = bgUrlInput ? bgUrlInput.value.trim() : '';
    let bgSourceChanged = false;
    if (currentBgSourceType === 'local') {
      if (originalConfig.bgSourceType !== 'local' ||
        currentBgImageData !== originalConfig.bgImageData ||
        (currentBgImageDataName || '') !== (originalConfig.bgImageDataName || '')) {
        bgSourceChanged = true;
      }
    } else if (originalConfig.bgSourceType !== 'remote' || currentBgUrl !== originalConfig.bgImageUrl) {
      bgSourceChanged = true;
    }
    const submitterSelect = document.getElementById('bn-submitter-select');
    const submitterInitialized = submitterSelect?.dataset?.bnInitialized === '1';

    const changed =
      (document.getElementById('bn-enable-title-truncate').checked !== originalConfig.titleTruncate) ||
      (document.getElementById('bn-enable-user-truncate').checked !== originalConfig.userTruncate) ||
      (document.getElementById('bn-enable-title-truncate').checked && ti !== originalConfig.maxTitleUnits) ||
      (document.getElementById('bn-enable-user-truncate').checked && ui !== originalConfig.maxUserUnits) ||
      (document.getElementById('bn-hide-avatar').checked !== originalConfig.hideAvatar) ||
      (document.getElementById('bn-enable-copy').checked !== originalConfig.enableCopy) ||
      (document.getElementById('bn-enable-desc-copy').checked !== originalConfig.enableDescCopy) ||
      (document.getElementById('bn-hide-orig').checked !== originalConfig.hideOrig) ||
      (document.getElementById('bn-show-user-nickname').checked !== originalConfig.showUserNickname) ||
      (document.getElementById('bn-enable-user-menu').checked !== originalConfig.enableMenu) ||
      (document.getElementById('bn-enable-plan').checked !== originalConfig.enablePlanAdder) ||
      (document.getElementById('bn-enable-renew').checked !== originalConfig.enableAutoRenew) ||
      (document.getElementById('bn-enable-ranking-filter').checked !== originalConfig.enableRankingFilter) ||
      (document.getElementById('bn-enable-column-switch').checked !== originalConfig.columnSwitchEnabled) ||
      (document.getElementById('bn-enable-merge-assistant').checked !== originalConfig.mergeAssistantEnabled) ||
      (document.getElementById('bn-enable-vj').checked !== originalConfig.enableVjLink) ||
      (document.getElementById('bn-hide-done-skip').checked !== originalConfig.hideDoneSkip) ||
      (document.getElementById('bn-enable-quick-skip').checked !== originalConfig.enableQuickSkip) ||
      (document.getElementById('bn-enable-title-optimization').checked !== originalConfig.enableTitleOptimization) ||
      (document.getElementById('bn-use-custom-color').checked !== originalConfig.useCustomColors) ||
      ((document.getElementById('bn-width-mode')?.value ?? originalConfig.widthMode) !== originalConfig.widthMode) ||
      (currentBgEnabled !== originalConfig.bgEnabled) ||
      bgSourceChanged ||(currentBgfillway != originalConfig.bgfillway)||
      (currentBgOpacity !== originalConfig.bgOpacity) ||
      (document.getElementById('bn-bt-enabled').checked !== originalConfig.btEnabled) ||
      (submitterInitialized && submitterSelect.value !== originalConfig.selectedSubmitter) ||
      (hiToiletIntervalInput && clampHiToiletInterval(hiToiletIntervalInput.value) !== originalConfig.btInterval) ||
      (getSelectedThemeMode() !== originalConfig.themeMode) ||
      themeColorChanged ||
      paletteChanged;

    saveActions.classList.toggle('bn-visible', changed);
  }

  function getEffectiveBackgroundUrl() {
    if (currentBgSourceType === 'local' && currentBgImageData) return currentBgImageData;
    return bgUrlInput ? bgUrlInput.value.trim() : '';
  }

  function updateBgSourceUI() {
    if (bgFileNameSpan) {
      if (currentBgSourceType === 'local' && currentBgImageData) {
        const name = currentBgImageDataName || '已选择本地图片';
        bgFileNameSpan.textContent = name;
        bgFileNameSpan.title = name;
      } else {
        bgFileNameSpan.textContent = '未选择本地图片';
        bgFileNameSpan.title = '';
      }
    }
    if (bgSourceHint) {
      if (currentBgSourceType === 'local' && currentBgImageData) {
        const name = currentBgImageDataName ? ` (${currentBgImageDataName})` : '';
        bgSourceHint.textContent = `当前背景来源：本地图片${name}`;
      } else {
        bgSourceHint.textContent = '当前背景来源：远程图片';
      }
    }
    if (bgFileClearBtn) {
      const shouldEnable = currentBgSourceType === 'local' && !!currentBgImageData;
      bgFileClearBtn.disabled = !shouldEnable;
    }
  }

  const chkTitleTrEl = document.getElementById('bn-enable-title-truncate');
  const chkUserTrEl = document.getElementById('bn-enable-user-truncate');
  const updateTruncateState = (chk, input) => {
    input.disabled = !chk.checked;
  };
  chkTitleTrEl.onchange = () => {
    updateTruncateState(chkTitleTrEl, titleInp);
    checkChanged();
  };
  chkUserTrEl.onchange = () => {
    updateTruncateState(chkUserTrEl, userInp);
    checkChanged();
  };
  titleInp.oninput = checkChanged;
  userInp.oninput = checkChanged;

  chkAv.onchange = () => {
    hideAvatar = chkAv.checked;
    if (hideAvatar && ensureAvatarBlockerInstalled(true)) {
      runAvatarSanitizer();
    }
    checkChanged();
  };
  chkCp.onchange = () => { checkChanged(); };
  chkDescCp.onchange = checkChanged;
  chkHo.onchange = checkChanged;
  chkShowNickname.onchange = checkChanged;
  chkMenu.onchange = checkChanged;
  chkVj.onchange = checkChanged;
  chkHideDoneSkip.onchange = () => { applyHideDoneSkip(chkHideDoneSkip.checked); checkChanged(); };
  chkQuickSkip.onchange = () => { applyQuickSkip(chkQuickSkip.checked); checkChanged(); };
  chkTitleOpt.onchange = checkChanged;
  chkPlan.onchange = checkChanged;
  chkAutoRenew.onchange = checkChanged;
  chkRankingFilter.onchange = checkChanged;
  if (chkColumnSwitch) chkColumnSwitch.onchange = checkChanged;
  if (chkMergeAssistant) chkMergeAssistant.onchange = checkChanged;
  if (widthModeSel) widthModeSel.onchange = checkChanged;

  document.getElementById('bn-color-reset').onclick = () => {
    const base = palettes.light;
    const defaultTheme = normalizeHexColor(DEFAULT_THEME_COLOR, DEFAULT_THEME_COLOR);
    COLOR_KEYS.forEach(k => {
      if (colorPickers[k] && hexInputs[k]) {
        colorPickers[k].value = base[k];
        hexInputs[k].value = base[k];
      }
    });
    if (themeColorInput) themeColorInput.value = defaultTheme;
    if (themeColorHexInput) themeColorHexInput.value = defaultTheme;
    container.style.setProperty('--bn-theme-color', defaultTheme);
    chkUseColor.checked = true;
    container.classList.add('bn-expanded'); panel.classList.add('bn-expanded'); colorSidebar.classList.add('bn-show');
    checkChanged();
  };

  document.getElementById('bn-save-config').onclick = () => {
    if (chkTitleTrEl.checked) {
      const v = parseInt(titleInp.value, 10);
      if (isNaN(v) || v <= 0) { alert('请输入大于 0 的正整数'); return; }
      GM_setValue('maxTitleUnits', v);
    } else {
      GM_setValue('maxTitleUnits', 'none');
    }
    if (chkUserTrEl.checked) {
      const v = parseInt(userInp.value, 10);
      if (isNaN(v) || v <= 0) { alert('请输入大于 0 的正整数'); return; }
      GM_setValue('maxUserUnits', v);
    } else {
      GM_setValue('maxUserUnits', 'none');
    }
    const widthModeValue = (widthModeSel && widthModeSel.value) ? widthModeSel.value : widthMode;
    GM_setValue(WIDTH_MODE_KEY, widthModeValue);

    GM_setValue('hideAvatar', chkAv.checked);
    hideAvatar = chkAv.checked;
    if (hideAvatar && ensureAvatarBlockerInstalled(true)) {
      runAvatarSanitizer();
    }
    GM_setValue('enableCopy', chkCp.checked);
    GM_setValue('enableDescCopy', chkDescCp.checked);
    GM_setValue('hideOrig', chkHo.checked);
    GM_setValue('showUserNickname', chkShowNickname.checked);
    GM_setValue('hideDoneSkip', chkHideDoneSkip.checked);
    GM_setValue('enableQuickSkip', chkQuickSkip.checked);
    GM_setValue('enableTitleOptimization', chkTitleOpt.checked);
    GM_setValue('enableUserMenu', chkMenu.checked);
    GM_setValue('enableVjLink', chkVj.checked);
    GM_setValue('enablePlanAdder', chkPlan.checked);
    GM_setValue('enableAutoRenew', chkAutoRenew.checked);
    GM_setValue('rankingFilter.enabled', chkRankingFilter.checked);
    if (chkColumnSwitch) GM_setValue('rankingFilter.columnSwitch.enabled', chkColumnSwitch.checked);
    if (chkMergeAssistant) GM_setValue('rankingMerge.enabled', chkMergeAssistant.checked);

    const obj = {};
    COLOR_KEYS.forEach(k => { if (colorPickers[k]) obj[k] = colorPickers[k].value; });
    GM_setValue('userPalette', JSON.stringify(obj));
    GM_setValue('useCustomColors', chkUseColor.checked);
    const themeColorValue = themeColorInput
      ? normalizeHexColor(themeColorInput.value, originalConfig.themeColor)
      : originalConfig.themeColor;
    GM_setValue('themeColor', themeColorValue);
    container.style.setProperty('--bn-theme-color', themeColorValue);
    if (themeColorInput) themeColorInput.value = themeColorValue;
    if (themeColorHexInput) themeColorHexInput.value = themeColorValue;
    originalConfig.themeColor = themeColorValue;
    const nextThemeMode = getSelectedThemeMode();
    GM_setValue('panelThemeMode', nextThemeMode);
    originalConfig.themeMode = nextThemeMode;
    applyThemeMode(nextThemeMode);
    const bgEnabled = bgEnabledInput ? bgEnabledInput.checked : false;
    const bgfillway = bgfillwayInput.value ;
    const rawBgUrl = bgUrlInput ? bgUrlInput.value.trim() : '';
    const bgOpacityRaw = bgOpacityInput ? bgOpacityInput.value : normalizedBgOpacity;
    const bgOpacity = String(clampOpacity(bgOpacityRaw));
    const btEnabled = hiToiletInput ? hiToiletInput.checked : !!(document.getElementById('bn-bt-enabled')?.checked);
    const btInterval = hiToiletIntervalInput ? clampHiToiletInterval(hiToiletIntervalInput.value) : originalConfig.btInterval;
    let bgImageSourceType = (currentBgSourceType === 'local' && currentBgImageData) ? 'local' : 'remote';
    let bgImageUrlToSave = rawBgUrl;
    let bgImageDataToSave = '';
    let bgImageDataNameToSave = '';
    if (bgImageSourceType === 'local') {
      bgImageUrlToSave = '';
      bgImageDataToSave = currentBgImageData;
      bgImageDataNameToSave = currentBgImageDataName || '';
    }
    const overlaySource = bgImageSourceType === 'local' && bgImageDataToSave
      ? bgImageDataToSave
      : bgImageUrlToSave;
    
    GM_setValue('bg_enabled', bgEnabled);
    GM_setValue('bg_fillway', bgfillway);
    console.log(bgfillway);
    GM_setValue('bg_imageSourceType', bgImageSourceType);
    GM_setValue('bg_imageUrl', bgImageUrlToSave);
    GM_setValue('bg_imageData', bgImageDataToSave);
    GM_setValue('bg_imageDataName', bgImageDataNameToSave);
    GM_setValue('bg_opacity', bgOpacity);
    GM_setValue('bt_enabled', btEnabled);
    GM_setValue('bt_interval', btInterval);
    originalConfig.btInterval = btInterval;
    originalConfig.btEnabled = btEnabled;
    originalConfig.bgEnabled = bgEnabled;
    originalConfig.bgImageUrl = bgImageUrlToSave;
    originalConfig.bgImageData = bgImageDataToSave;
    originalConfig.bgImageDataName = bgImageDataNameToSave;
    originalConfig.bgSourceType = bgImageSourceType;
    originalConfig.bgOpacity = bgOpacity;
    currentBgSourceType = bgImageSourceType;
    currentBgImageData = bgImageDataToSave;
    currentBgImageDataName = bgImageDataNameToSave;

    updateBgSourceUI();
    applyBackgroundOverlay(bgEnabled,bgfillway, overlaySource, bgOpacity);
    if (bgOpacityInput) bgOpacityInput.value = bgOpacity;
    if (bgOpacityValueSpan) bgOpacityValueSpan.textContent = formatOpacityText(bgOpacity);

    const selectedSubmitter = submitterSelect.value;
    GM_setValue('selectedSubmitter', selectedSubmitter);
    syncSubmitterState(selectedSubmitter);

    setTimeout(() => location.reload(), 50);
  };

  function restoreOriginalConfig() {
    chkTitleTrEl.checked = originalConfig.titleTruncate;
    chkUserTrEl.checked = originalConfig.userTruncate;
    titleInp.value = isFinite(originalConfig.maxTitleUnits) ? originalConfig.maxTitleUnits : '';
    userInp.value = isFinite(originalConfig.maxUserUnits) ? originalConfig.maxUserUnits : '';
    if (widthModeSel) widthModeSel.value = originalConfig.widthMode;
    chkAv.checked = originalConfig.hideAvatar;
    chkCp.checked = originalConfig.enableCopy;
    chkDescCp.checked = originalConfig.enableDescCopy;
    chkHo.checked = originalConfig.hideOrig;
    chkShowNickname.checked = originalConfig.showUserNickname;
    chkMenu.checked = originalConfig.enableMenu;
    chkVj.checked = originalConfig.enableVjLink;
    chkHideDoneSkip.checked = originalConfig.hideDoneSkip;
    applyHideDoneSkip(originalConfig.hideDoneSkip);
    chkQuickSkip.checked = originalConfig.enableQuickSkip;
    applyQuickSkip(originalConfig.enableQuickSkip);
    chkTitleOpt.checked = originalConfig.enableTitleOptimization;
    chkPlan.checked = originalConfig.enablePlanAdder;
    chkAutoRenew.checked = originalConfig.enableAutoRenew;
    chkRankingFilter.checked = originalConfig.enableRankingFilter;
    if (chkColumnSwitch) chkColumnSwitch.checked = originalConfig.columnSwitchEnabled;
    if (chkMergeAssistant) chkMergeAssistant.checked = originalConfig.mergeAssistantEnabled;
    chkUseColor.checked = originalConfig.useCustomColors;
    if (submitterSelect) {
      submitterSelect.value = originalConfig.selectedSubmitter;
      updateSubmitterDescription(originalConfig.selectedSubmitter);
    }
    if (hiToiletInput) hiToiletInput.checked = originalConfig.btEnabled;
    setHiToiletIntervalDisplay(originalConfig.btInterval);
    titleInp.disabled = !chkTitleTrEl.checked;
    userInp.disabled = !chkUserTrEl.checked;
    if (chkUseColor.checked) {
      container.classList.add('bn-expanded');
      panel.classList.add('bn-expanded');
      colorSidebar.classList.add('bn-show');
    } else {
      colorSidebar.classList.remove('bn-show');
      container.classList.remove('bn-expanded');
      panel.classList.remove('bn-expanded');
    }
    COLOR_KEYS.forEach(k => {
      if (colorPickers[k] && hexInputs[k]) {
        colorPickers[k].value = originalConfig.palette[k];
        hexInputs[k].value = originalConfig.palette[k];
      }
    });
    if (themeColorInput) themeColorInput.value = originalConfig.themeColor;
    if (themeColorHexInput) themeColorHexInput.value = originalConfig.themeColor;
    container.style.setProperty('--bn-theme-color', originalConfig.themeColor);
    syncThemeModeUI(originalConfig.themeMode);
    applyThemeMode(originalConfig.themeMode);
    if (bgEnabledInput) bgEnabledInput.checked = originalConfig.bgEnabled;
    if (bgfillwayInput) bgfillwayInput.value = originalConfig.bgfillway;
    if (bgUrlInput) bgUrlInput.value = originalConfig.bgImageUrl;
    currentBgSourceType = originalConfig.bgSourceType;
    currentBgImageData = originalConfig.bgImageData;
    currentBgImageDataName = originalConfig.bgImageDataName;
    if (bgFileInput) bgFileInput.value = '';
    if (bgOpacityInput) bgOpacityInput.value = originalConfig.bgOpacity;
    if (bgOpacityValueSpan) bgOpacityValueSpan.textContent = formatOpacityText(originalConfig.bgOpacity);
    updateBgSourceUI();
    const restoreSource = (originalConfig.bgSourceType === 'local' && originalConfig.bgImageData)
      ? originalConfig.bgImageData
      : originalConfig.bgImageUrl;
    applyBackgroundOverlay(originalConfig.bgEnabled,originalConfig.bgfillway, restoreSource, originalConfig.bgOpacity);
    checkChanged();
  }
  restoreOriginalConfig();
  document.getElementById('bn-cancel-changes').onclick = () => {
    restoreOriginalConfig();
  };

  if (bgEnabledInput && bgOpacityInput && bgOpacityValueSpan) {
    const updateBackgroundPreview = () => {
      bgOpacityValueSpan.textContent = formatOpacityText(bgOpacityInput.value);
      applyBackgroundOverlay(bgEnabledInput.checked, bgfillwayInput.value,getEffectiveBackgroundUrl(), bgOpacityInput.value);
      console.log(bgfillwayInput.value);
      checkChanged();
    };
    const handleBgUrlInput = () => {
      if (currentBgSourceType === 'local') {
        currentBgSourceType = 'remote';
        currentBgImageData = '';
        currentBgImageDataName = '';
        if (bgFileInput) bgFileInput.value = '';
        updateBgSourceUI();
      }
      updateBackgroundPreview();
    };
    bgEnabledInput.addEventListener('change', updateBackgroundPreview);
    bgfillwayInput.addEventListener('change', updateBackgroundPreview);
    if (bgUrlInput) bgUrlInput.addEventListener('input', handleBgUrlInput);
    bgOpacityInput.addEventListener('input', updateBackgroundPreview);
    if (bgFilePickBtn && bgFileInput) {
      bgFilePickBtn.addEventListener('click', () => bgFileInput.click());
    }
    if (bgFileInput) {
      bgFileInput.addEventListener('change', () => {
        const file = bgFileInput.files && bgFileInput.files[0];
        if (!file) return;
        if (file.size > MAX_LOCAL_BG_SIZE) {
          const maxSizeMb = (MAX_LOCAL_BG_SIZE / (1024 * 1024)).toFixed(1);
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(`本地图片大小超过 ${maxSizeMb} MB，请选择更小的文件。`);
          }
          bgFileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = typeof reader.result === 'string' ? reader.result : '';
            if (!/^data:image\//i.test(result)) {
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('仅支持图片文件作为背景。');
              }
              return;
            }
            currentBgSourceType = 'local';
            currentBgImageData = result;
            currentBgImageDataName = file.name || '';
            if (bgUrlInput) bgUrlInput.value = '';
            updateBgSourceUI();
            updateBackgroundPreview();
          } catch (err) {
            console.error('[BN] 读取本地背景图片失败', err);
          } finally {
            bgFileInput.value = '';
          }
        };
        reader.onerror = () => {
          console.error('[BN] 读取本地背景图片失败', reader.error);
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert('读取本地图片失败，请重试。');
          }
          bgFileInput.value = '';
        };
        reader.readAsDataURL(file);
      });
    }
    if (bgFileClearBtn) {
      bgFileClearBtn.addEventListener('click', () => {
        if (currentBgSourceType === 'remote' && !currentBgImageData) return;
        currentBgSourceType = 'remote';
        currentBgImageData = '';
        currentBgImageDataName = '';
        if (bgFileInput) bgFileInput.value = '';
        updateBgSourceUI();
        updateBackgroundPreview();
      });
    }
  } else {
    document.getElementById('bn-bg-enabled')?.addEventListener('change', checkChanged);
    document.getElementById('bn-bg-image-url')?.addEventListener('input', checkChanged);
    const fallbackBgOpacity = document.getElementById('bn-bg-opacity');
    if (fallbackBgOpacity) {
      fallbackBgOpacity.addEventListener('input', () => {
        const s = document.getElementById('bn-bg-opacity-value');
        if (s) s.textContent = fallbackBgOpacity.value;
        checkChanged();
      });
    }
  }
  function setHiToiletIntervalDisplay(value) {
    const clamped = clampHiToiletInterval(value);
    if (hiToiletIntervalInput) hiToiletIntervalInput.value = String(clamped);
    if (hiToiletIntervalValue) hiToiletIntervalValue.textContent = String(clamped);
  }
  function refreshHiToiletIntervalDisplayFromInput() {
    if (!hiToiletIntervalInput) return;
    const clamped = clampHiToiletInterval(hiToiletIntervalInput.value);
    if (hiToiletIntervalValue) hiToiletIntervalValue.textContent = String(clamped);
  }
  if (hiToiletIntervalInput) {
    hiToiletIntervalInput.addEventListener('input', () => {
      refreshHiToiletIntervalDisplayFromInput();
      checkChanged();
    });
    hiToiletIntervalInput.addEventListener('change', () => {
      setHiToiletIntervalDisplay(hiToiletIntervalInput.value);
      checkChanged();
    });
  } else if (hiToiletIntervalValue) {
    hiToiletIntervalValue.textContent = String(originalConfig.btInterval);
  }
  if (hiToiletInput) hiToiletInput.addEventListener('change', checkChanged);
  else document.getElementById('bn-bt-enabled')?.addEventListener('change', checkChanged);
  function getHiToiletPollDelay() {
    return clampHiToiletInterval(originalConfig.btInterval);
  }
  let hiToiletTimer = null;
  function getContestIdFromPath(pathname) {
    const match = /^\/contest\/(\d+)/.exec(pathname || '');
    return match ? match[1] : null;
  }
  function stopHiToiletPolling() {
    if (hiToiletTimer) {
      clearTimeout(hiToiletTimer);
      hiToiletTimer = null;
    }
  }
  function scheduleHiToiletPolling() {
    stopHiToiletPolling();
    if (!originalConfig.btEnabled) return;
    const delay = getHiToiletPollDelay();
    hiToiletTimer = setTimeout(runHiToiletOnce, delay);
  }
  async function runHiToiletOnce() {
    stopHiToiletPolling();
    if (!originalConfig.btEnabled) return;
    const contestId = getContestIdFromPath(location.pathname);
    if (!contestId) return;
    let shouldContinue = true;
    try {
      const response = await fetch(`/contest/${contestId}/toilet?go=0`, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (err) {
          console.warn('[BN] HiToilet: unable to parse response JSON', err);
        }
      }
      if (!data || data.success === false) {
        if (data && data.err) console.log('[BN] HiToilet:', data.err);
      } else {
        if (typeof window.upd === 'function') {
          try { window.upd(); } catch (err) { console.warn('[BN] HiToilet: upd() failed', err); }
        }
        
        if (data.result) {
          alert(`HiToilet success: ${data.result}`);
          if (hiToiletInput) hiToiletInput.checked = false;
          originalConfig.btEnabled = false;
          try { GM_setValue('bt_enabled', false); } catch (e) { }
          try { checkChanged(); } catch (e) { }
          shouldContinue = false;
          setTimeout(() => { try { location.reload(); } catch (e) { } }, 50);
          shouldContinue = false;
        }
      }
    } catch (error) {
      console.warn('[BN] HiToilet request failed', error);
    }
    if (shouldContinue && originalConfig.btEnabled) {
      scheduleHiToiletPolling();
    }
  }
  if (originalConfig.btEnabled) {
    runHiToiletOnce();
  }

  if (enableAutoRenew) initAutoRenew();

  function unitOfCharByMode(codePoint, mode) {
    if (mode === 'char') return 1;
    if (mode === 'visual') return codePoint > 255 ? 2 : 1;
    if (codePoint <= 0x7F) return 1;
    if (codePoint <= 0x7FF) return 2;
    if (codePoint <= 0xFFFF) return 3;
    return 4;
  }
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Sanitize a small subset of HTML allowed in submitter descriptions.
  // Only allow <a href="...">text</a> and strip other tags/attributes.
  function sanitizeSubmitterDescription(raw) {
    if (typeof raw !== 'string' || !raw) return '';
    // Quick path: if there's no '<', it's safe text
    if (raw.indexOf('<') === -1) return escapeHtml(raw);

    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const container = document.createElement('span');
      for (const node of Array.from(doc.body.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          container.appendChild(document.createTextNode(node.textContent || ''));
          continue;
        }
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'a') {
          const a = document.createElement('a');
          const href = node.getAttribute('href') || '';
          // Only allow http/https and relative URLs; normalize via URL when possible
          try {
            const url = new URL(href, location.href);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              a.href = url.toString();
            } else {
              // disallow other protocols
              a.href = '#';
            }
          } catch (e) {
            // malformed href -> treat as text
            a.href = '#';
          }
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = node.textContent || node.getAttribute('title') || a.href;
          container.appendChild(a);
          continue;
        }
        // For any other element, append its text content (safe)
        container.appendChild(document.createTextNode(node.textContent || ''));
      }
      return container.innerHTML;
    } catch (e) {
      // Fallback: escape everything
      return escapeHtml(raw);
    }
  }

  function truncateByUnits(str, maxU) {
    if (!isFinite(maxU)) return str;
    let used = 0, out = '';
    const selectedWidthMode = (widthModeSel && widthModeSel.value) ? widthModeSel.value : widthMode;
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      const w = unitOfCharByMode(cp, selectedWidthMode);
      if (used + w > maxU) { out += '...'; break; }
      out += ch; used += w;
    }
    return out;
  }

  async function loadSubmittersConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        try {
          const url = chrome.runtime.getURL('submitter/submitters.json');
          console.log('Loading submitters config from:', url);
          const response = await fetch(url, { cache: 'no-store' });
          if (response && response.ok) {
            const config = await response.json();
            console.log('Successfully loaded submitters config');
            return config;
          }
        } catch (err) {
          console.warn('Failed to load submitters config via chrome.runtime.getURL:', err);
        }
      }
      
      try {
        const response = await fetch('/submitter/submitters.json', { cache: 'no-store' });
        if (response && response.ok) {
          const config = await response.json();
          console.log('Successfully loaded submitters config from relative path');
          return config;
        }
      } catch (err) {
        console.warn('Failed to load submitters config from relative path:', err);
      }
      
      throw new Error('All attempts to load submitters config failed');
      
    } catch (error) {
      console.error('Error loading submitters config, using fallback:', error);
      throw error;
    }
  }

  async function initSubmittersSelector() {
    const config = await loadSubmittersConfig();
    const select = document.getElementById('bn-submitter-select');
    const description = document.getElementById('bn-submitter-description');
    
    if (!select) return;
    
    const disabledOption = select.querySelector('option[value="none"]');
    select.innerHTML = '';
    if (disabledOption) {
      select.appendChild(disabledOption);
    } else {
      const noneOption = document.createElement('option');
      noneOption.value = 'none';
      noneOption.textContent = '禁用';
      select.appendChild(noneOption);
    }
    
    config.submitters.forEach(submitter => {
      const option = document.createElement('option');
      option.value = submitter.id;
      option.textContent = submitter.name;
      option.dataset.description = submitter.description || '';
      option.dataset.popup = submitter.popup || '';
      select.appendChild(option);
    });
    select.value = storedSelectedSubmitter;
    updateSubmitterDescription(select.value);
    select.dataset.bnInitialized = '1';
    checkChanged();

    select.addEventListener('change', function() {
      updateSubmitterDescription(this.value);
      checkChanged();
    });
  }

  function updateSubmitterDescription(selectedId) {
    const description = document.getElementById('bn-submitter-description');
    if (!description) return;
    
    if (selectedId === 'none') {
      description.textContent = 'Submitter 功能已禁用';
      description.className = 'bn-submitter-description bn-submitter-disabled';
      return;
    }
    
    const submitterSelect = document.getElementById('bn-submitter-select');
    const selectedOption = submitterSelect?.querySelector(`option[value="${selectedId}"]`);
    
    if (selectedOption && selectedOption.dataset.description) {
      const raw = selectedOption.dataset.description || '';
      // Use a small sanitizer that allows only anchor tags; fall back to plain text
      const safe = sanitizeSubmitterDescription(raw);
      // If sanitizer returned a string with '<', it contains allowed HTML (anchors), set as HTML
      if (safe.indexOf('<') !== -1) {
        description.innerHTML = safe;
      } else {
        description.textContent = safe;
      }
      description.className = 'bn-submitter-description';
    } else {
      description.textContent = '未知的 Submitter';
      description.className = 'bn-submitter-description bn-submitter-unknown';
    }
  }

  function syncSubmitterState(selectedSubmitter) {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') return;
    try {
      const enabled = selectedSubmitter !== 'none';
      chrome.runtime.sendMessage({ 
        type: 'bn_toggle_submitter', 
        enabled,
        submitterId: selectedSubmitter
      });
    } catch (e) {
      console.warn('Failed to sync submitter state:', e);
    }
  }

  async function loadUsersData() {
    const urls = [];
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      try {
        urls.push(chrome.runtime.getURL('data/users.json'));
      } catch (err) {
        // console.warn('Failed to resolve users.json via chrome.runtime.getURL', err);
      }
    }
    urls.push('data/users.json');
    for (const url of urls) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp && resp.ok) {
          return await resp.json();
        }
        // console.warn(`Failed to load users.json from ${url}: ${resp ? resp.status : 'no response'}`);
      } catch (err) {
        // console.warn(`Failed to load users.json from ${url}`, err);
      }
    }
    // console.warn('Users data could not be loaded; using empty map.');
    return {};
  }

  function normalizeSpecialRules(raw) {
    if (!raw || typeof raw !== 'object') {
      return { users: {}, tags: { definitions: {}, assignments: {} } };
    }
    const users = (raw.users && typeof raw.users === 'object' && !Array.isArray(raw.users)) ? raw.users : {};
    const tags = (raw.tags && typeof raw.tags === 'object') ? raw.tags : {};
    const definitions = (tags.definitions && typeof tags.definitions === 'object' && !Array.isArray(tags.definitions))
      ? tags.definitions : {};
    const assignments = (tags.assignments && typeof tags.assignments === 'object' && !Array.isArray(tags.assignments))
      ? tags.assignments : {};
    return { users, tags: { definitions, assignments } };
  }

  async function loadSpecialRules() {
    const urls = [];
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      try {
        urls.push(chrome.runtime.getURL('data/special_users.json'));
      } catch (err) {
        // ignore
      }
    }
    urls.push('data/special_users.json');
    for (const url of urls) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp && resp.ok) {
          const data = await resp.json();
          return normalizeSpecialRules(data);
        }
      } catch (err) {
        // ignore
      }
    }
    return normalizeSpecialRules(null);
  }

  function applySpecialRules(users, rules) {
    if (!users || typeof users !== 'object') return;
    const normalized = normalizeSpecialRules(rules);
    const overrides = normalized.users;
    const tagDefs = normalized.tags.definitions;
    const tagAssignments = normalized.tags.assignments;

    const ensureUser = (uid) => {
      const key = String(uid);
      let info = users[key];
      if (!info || typeof info !== 'object') {
        info = { name: '', colorKey: 'uk' };
        users[key] = info;
      }
      if (typeof info.name !== 'string') info.name = String(info.name || '');
      if (typeof info.colorKey !== 'string' || !info.colorKey) info.colorKey = 'uk';
      return info;
    };

    if (overrides && typeof overrides === 'object') {
      for (const [uid, override] of Object.entries(overrides)) {
        if (!override || typeof override !== 'object') continue;
        const info = ensureUser(uid);
        if (typeof override.name === 'string' && override.name.trim()) {
          info.name = override.name;
        }
        if (typeof override.colorKey === 'string' && override.colorKey.trim()) {
          info.colorKey = override.colorKey.trim();
        }
      }
    }

    Object.values(users).forEach(info => {
      if (info && typeof info === 'object' && 'tags' in info) delete info.tags;
    });

    if (!tagDefs || !tagAssignments) return;
    const tagPayloads = {};
    for (const [key, data] of Object.entries(tagDefs)) {
      if (!data || typeof data !== 'object') continue;
      const tagId = String(data.id || key);
      const name = String(data.name || tagId).trim() || tagId;
      const color = typeof data.color === 'string' ? data.color.trim() : '';
      const payload = { id: tagId, name, color };
      tagPayloads[String(key)] = payload;
      tagPayloads[tagId] = payload;
    }

    for (const [uid, tagIds] of Object.entries(tagAssignments || {})) {
      if (!Array.isArray(tagIds) || !tagIds.length) continue;
      const resolved = [];
      const seen = new Set();
      for (const tid of tagIds) {
        const payload = tagPayloads[String(tid)];
        if (!payload) continue;
        const key = `${payload.id}|${payload.name}|${payload.color}`;
        if (seen.has(key)) continue;
        seen.add(key);
        resolved.push({ id: payload.id, name: payload.name, color: payload.color });
      }
      if (resolved.length) {
        const info = ensureUser(uid);
        info.tags = resolved;
      }
    }
  }

  const [users, specialRules] = await Promise.all([
    loadUsersData(),
    loadSpecialRules(),
  ]);
  applySpecialRules(users, specialRules);

  function firstVisibleCharOfTitle() {
    const h1 = document.querySelector('body > div:nth-child(2) > div > div.ui.center.aligned.grid > div > h1');
    if (!h1) return '';
    const s = (h1.textContent || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    return s ? s[0].toUpperCase() : '';
  }

  function stripLeadingBlank(text) {
    if (typeof text !== 'string') return '';
    let s = text.replace(/\r\n/g, '\n');
    s = s.replace(/^[\uFEFF\u200B-\u200D\u2060]+/, '');
    s = s.replace(/^(?:[ \t]*\n)+/, '');
    return s;
  }

  function findProblemActionLink() {
    const direct = document.querySelector('div.ui.buttons.right.floated > a[href]');
    if (direct) return direct;
    for (const g of document.querySelectorAll('div.ui.center.aligned.grid')) {
      const candBox = g.querySelector('div.ui.buttons.right.floated');
      if (!candBox) continue;
      const anchor = candBox.querySelector('a[href]');
      if (anchor) return anchor;
    }
    return null;
  }

  function sliceDescriptionSection(markdown) {
    if (typeof markdown !== 'string' || !markdown) return null;
    const normalized = markdown.replace(/\r\n/g, '\n');
    const descHeadingRe = /(^|\n)##\s*题目描述\s*(\n|$)/;
    const descMatch = descHeadingRe.exec(normalized);
    if (!descMatch) return null;
    const startIndex = descMatch.index + (descMatch[1] ? descMatch[1].length : 0);
    const remainder = normalized.slice(startIndex);
    const inputHeadingRe = /(^|\n)##\s*输入格式\s*(\n|$)/;
    const inputMatch = inputHeadingRe.exec(remainder);
    const endIndex = inputMatch ? startIndex + inputMatch.index : normalized.length;
    const segment = normalized.slice(startIndex, endIndex);
    const cleaned = stripLeadingBlank(segment).trimEnd();
    return cleaned ? cleaned : null;
  }

  function fEasierClip() {
    if (!/\/problem\//.test(location.pathname)) return;
    if (firstVisibleCharOfTitle() === 'L') return;
    if (document.getElementById('bn-copy-btn')) return;

    const link = findProblemActionLink();
    if (!link) return;
    if (hideOrig) link.style.display = 'none';

    const btn = document.createElement('a');
    btn.id = 'bn-copy-btn';
    btn.className = 'small ui button';
    btn.textContent = '复制题面';

    btn.onclick = async () => {
      const originalText = btn.textContent;
      const originalBg = btn.style.backgroundColor;
      const originalColor = btn.style.color;

      btn.textContent = '处理中…';
      btn.style.pointerEvents = 'none';

      try {
        const res = await fetch(location.href.replace(/\/$/, '') + '/markdown/text', { credentials: 'include' });
        let text = await res.text();
        text = stripLeadingBlank(text);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }

        btn.textContent = '复制成功';
        btn.style.backgroundColor = '#21ba45';
        btn.style.color = '#ffffff';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = originalBg;
          btn.style.color = originalColor;
          btn.style.pointerEvents = '';
        }, 1200);

      } catch (e) {
        btn.textContent = originalText;
        btn.style.backgroundColor = originalBg;
        btn.style.color = originalColor;
        btn.style.pointerEvents = '';
        GM_notification({ text: '复制失败：' + e, timeout: 3000 });
      }
    };

    link.parentNode.insertBefore(btn, link);
  }

  function fEasierDescClip() {
    if (!/\/problem\//.test(location.pathname)) return;
    if (firstVisibleCharOfTitle() === 'L') return;
    if (document.getElementById('bn-copy-desc-btn')) return;

    const link = findProblemActionLink();
    if (!link) return;
    if (hideOrig) link.style.display = 'none';

    const btn = document.createElement('a');
    btn.id = 'bn-copy-desc-btn';
    btn.className = 'small ui button';
    btn.textContent = '复制题面描述';

    btn.onclick = async () => {
      const originalText = btn.textContent;
      const originalBg = btn.style.backgroundColor;
      const originalColor = btn.style.color;

      btn.textContent = '处理中…';
      btn.style.pointerEvents = 'none';

      try {
        const res = await fetch(location.href.replace(/\/$/, '') + '/markdown/text', { credentials: 'include' });
        let text = await res.text();
        text = stripLeadingBlank(text);
        const sliced = sliceDescriptionSection(text);
        const target = sliced ? sliced : text;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(target);
        } else {
          const ta = document.createElement('textarea');
          ta.value = target;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }

        btn.textContent = '复制成功';
        btn.style.backgroundColor = '#21ba45';
        btn.style.color = '#ffffff';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = originalBg;
          btn.style.color = originalColor;
          btn.style.pointerEvents = '';
        }, 1200);
      } catch (e) {
        btn.textContent = originalText;
        btn.style.backgroundColor = originalBg;
        btn.style.color = originalColor;
        btn.style.pointerEvents = '';
        GM_notification({ text: '复制失败：' + e, timeout: 3000 });
      }
    };

    link.parentNode.insertBefore(btn, link);
  }

  function fVjudgeLink() {
      if (!enableVjLink) return;
      if (!/^\/problem\/\d+\/?$/.test(location.pathname)) return;
      if (document.getElementById('bn-vjudge-btn')) return;

      let raw = '';
      for (const s of document.querySelectorAll('div.ui.center.aligned.grid span')) {
        const t = (s.textContent || '').trim();
        if (/^题目名称[:：]/.test(t)) { raw = t.replace(/^题目名称[:：]\s*/, '').trim(); break; }
      }
      if (!raw) return;
      const parser = {
        cfgym: pid=> `https://vjudge.net/problem/Gym-${pid}`,
        cf: pid => `https://vjudge.net/problem/CodeForces-${pid}`,
        codeforces: pid => `https://vjudge.net/problem/CodeForces-${pid}`,
        atc: pid => {
          const m = pid.match(/^atc([a-z]+)(\d+)[_-]?([a-z])$/);
          if (m) return `https://vjudge.net/problem/AtCoder-${m[0]}${m[1]}_${m[2]}`;
          const base = pid.slice(0, -1), last = pid.slice(-1);
          return `https://vjudge.net/problem/AtCoder-${base}_${last}`;
        },
        luogu: pid => `https://vjudge.net/problem/洛谷-${pid}`,
        LG: pid => `https://vjudge.net/problem/洛谷-p${pid}`,
        uoj: pid => `https://vjudge.net/problem/UniversalOJ-${pid}`,
        qoj: pid => `https://vjudge.net/problem/QOJ-${pid}`,
        poj: pid => `https://vjudge.net/problem/POJ-${pid}`,
        zoj: pid => `https://vjudge.net/problem/ZOJ-${pid}`,
        uva: pid => `https://vjudge.net/problem/UVA-${pid}`,
        loj: pid => `https://vjudge.net/problem/LightOJ-${pid}`,
        vj: pid => `https://vjudge.net/problem/${pid}`
      };
      function extractOJAndProblem(buttonElement) {
        const tooltip = buttonElement.getAttribute('data-tooltip');
        if (!tooltip) {
            return null;
        }

        const separator = tooltip.includes('：') ? '：' : ':';
        const parts = tooltip.split(separator);
        if (parts.length != 2) {
            return null;
        }

        const oj = parts[0].trim();
        const problemNumber = parts[1].trim();

        return { oj, problemNumber };
      }

      const button = document.querySelector('a.small.ui.green.button[data-tooltip]');
      if(!button)
          return;
      const result = extractOJAndProblem(button);
      if(!result)
          return;
      const lower=result.problemNumber.toLowerCase()
      let vjUrl = '';
      for (const k of Object.keys(parser)) {
        if (result.oj.includes(k)) { try { vjUrl = parser[k](lower); } catch { } break; }
      }
      if (!vjUrl) return;

      let firstBtn = document.querySelector('div.ui.buttons.right.floated > a');
      if (!firstBtn) {
        for (const g of document.querySelectorAll('div.ui.center.aligned.grid')) {
          const candBox = g.querySelector('div.ui.buttons.right.floated');
          if (candBox?.firstElementChild?.tagName === 'A') { firstBtn = candBox.firstElementChild; break; }
        }
      }
      if (!firstBtn) return;

      const vj = document.createElement('a');
      vj.id = 'bn-vjudge-btn';
      vj.className = 'small ui button';
      vj.href = vjUrl;
      vj.target = '_blank';
      vj.rel = 'noopener';
      if(result.oj!='vj')
        vj.setAttribute('data-tooltip', `vj-${result.oj}-${lower}`);
      else
        vj.setAttribute('data-tooltip', `${result.oj}-${lower}`);
      vj.textContent = 'Vjudge';
      vj.style.backgroundColor = '#f2711c';
      vj.style.color = '#ffffff';
      const leftGroup = document.querySelector('div.ui.buttons:not(.right.floated)');
      if (leftGroup) {
        leftGroup.appendChild(vj);
      } else if (firstBtn && firstBtn.parentNode) {
        firstBtn.parentNode.insertBefore(vj, firstBtn);
      } else {
        const container = document.querySelector('div.ui.buttons.right.floated') || document.querySelector('div.ui.buttons');
        if (container) container.appendChild(vj);
      }
  }

  function initUserMenu() {
    if (document.getElementById('bn-user-menu')) return;

    const menu = document.createElement('div');
    menu.id = 'bn-user-menu';
    menu.innerHTML = `
    <a id="bn-menu-home" href="#">转到主页</a>
    <a id="bn-menu-sub-problem" href="#" style="display:none;">转到该题提交记录</a>
    <a id="bn-menu-sub-all" href="#">转到提交记录</a>
    <a id="bn-menu-plan" href="#">转到计划</a>
  `;
    document.body.appendChild(menu);

    const home = menu.querySelector('#bn-menu-home');
    const subProblem = menu.querySelector('#bn-menu-sub-problem');
    const subAll = menu.querySelector('#bn-menu-sub-all');
    const plan = menu.querySelector('#bn-menu-plan');

    const hide = () => { menu.classList.remove('bn-show'); menu.classList.remove('bn-show'); menu.style.display = 'none'; };
    document.addEventListener('click', hide);

    document.addEventListener('contextmenu', (e) => {
      const a = e.target.closest('a[href^="/user/"]');
      if (a) {
        const m = (a.getAttribute('href') || '').match(/^\/user\/(\d+)/);
        if (m) {
          e.preventDefault();
          const uid = m[1];
          home.href = `/user/${uid}`;
          let pid = '';
          let pm = location.search.match(/problem_id=(\d+)/);
          if (!pm) pm = location.pathname.match(/\/problem\/(\d+)/);
          if (pm) pid = pm[1];
          if (pid) {
            subProblem.style.display = 'block';
            subProblem.href = `/submissions?contest=&problem_id=${pid}&submitter=${uid}&min_score=0&max_score=100&language=&status=`;
            subAll.textContent = '转到所有提交记录';
          } else {
            subProblem.style.display = 'none';
            subAll.textContent = '转到提交记录';
          }
          subAll.href = `/submissions?contest=&problem_id=&submitter=${uid}&min_score=0&max_score=100&language=&status=`;
          plan.href = `/user_plans/${uid}`;
          menu.style.left = e.pageX + 'px';
          menu.style.top = e.pageY + 'px';
          menu.style.display = 'flex';
          menu.classList.remove('bn-show');
          void menu.offsetWidth;
          requestAnimationFrame(function () { try { menu.classList.add('bn-show'); } catch (e) { } });

          requestAnimationFrame(() => menu.classList.add('bn-show'));
          return;
        }
      }
      // Not a user link -> fall through to native menu
    }, true);
  }

  function extractOriginalNickname(rawText) {
    if (typeof rawText !== 'string') return '';
    let normalized = rawText.replace(/[\u00A0\s]+/g, ' ');
    normalized = normalized.trim();
    if (!normalized) return '';
    const fullIdx = normalized.indexOf('（');
    const halfIdx = normalized.indexOf('(');
    let firstParenIdx = -1;
    if (fullIdx >= 0 && halfIdx >= 0) {
      firstParenIdx = Math.min(fullIdx, halfIdx);
    } else {
      firstParenIdx = Math.max(fullIdx, halfIdx);
    }
    if (firstParenIdx > 0) {
      const prefix = normalized.slice(0, firstParenIdx).trim();
      if (prefix) return prefix;
    }
    const match = normalized.match(/[（(]\s*([^（）()]+?)\s*[）)]/);
    if (match && match[1]) {
      const inner = match[1].trim();
      if (inner) return inner;
    }
    return '';
  }

  function parseColorToRgb(color) {
    if (typeof color !== 'string') return null;
    const value = color.trim();
    if (!value) return null;
    const hex = value.replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
    const rgbMatch = value.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
      const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
      const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
      const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
      return { r, g, b };
    }
    return null;
  }

  function pickTagTextColor(color) {
    const rgb = parseColorToRgb(color);
    if (!rgb) return '#fff';
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? '#222' : '#fff';
  }

  function renderUserTags(anchor, tags) {
    if (!anchor) return;
    anchor.querySelectorAll('.bn-user-tags').forEach(el => el.remove());
    if (!Array.isArray(tags) || !tags.length) return;
    const container = document.createElement('span');
    container.className = 'bn-user-tags';
    tags.forEach(tag => {
      if (!tag || typeof tag !== 'object') return;
      const label = typeof tag.name === 'string' ? tag.name.trim() : '';
      if (!label) return;
      const el = document.createElement('span');
      el.className = 'bn-user-tag';
      el.textContent = label;
      if (tag.id) {
        el.dataset.tagId = String(tag.id);
      }
      const color = typeof tag.color === 'string' ? tag.color.trim() : '';
      if (color) {
        el.style.backgroundColor = color;
        el.style.borderColor = color;
        el.style.color = pickTagTextColor(color);
      }
      container.appendChild(el);
    });
    if (container.childNodes.length) {
      anchor.appendChild(container);
    }
  }

  function processUserLink(a) {
    if (!a || !a.matches('a[href^="/user/"]')) return;
    if (!markOnce(a, 'UserDone')) return;

    if (
      a.matches('#user-dropdown > a') ||
      a.matches('#user-dropdown > div > a:nth-child(1)') ||
      a.matches('body > div.ui.fixed.borderless.menu > div > div > a') ||
      a.matches('#form > div > div:nth-child(13) > a')
    ) return;

    const m = (a.getAttribute('href') || '').match(/^\/user\/(\d+)\/?$/);
    if (!m) return;

    const uid = m[1];
    const info = users[uid];
    if (info && GRADE_LABELS[info.colorKey]) a.setAttribute('title', GRADE_LABELS[info.colorKey]);

    const img = a.querySelector('img');
    if (img && hideAvatar) img.remove();

    a.querySelectorAll('.bn-icon').forEach(el => el.remove());
    a.querySelectorAll('.bn-user-tags').forEach(el => el.remove());

    let baseText = '';
    a.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) baseText += n.textContent; });
    baseText = baseText.trim();
    const defaultSource = baseText || (a.textContent || '').trim();
    const originalNickname = (showUserNickname && info) ? extractOriginalNickname(baseText) : '';

    let combinedName = defaultSource;
    if (info) {
      combinedName = typeof info.name === 'string' ? info.name : (defaultSource || '');
      if (showUserNickname && originalNickname) {
        combinedName += `（${originalNickname}）`;
      }
      const c = palette[info.colorKey];
      if (c) a.style.color = c;
    }

    const limitedName = truncateByUnits(combinedName || '', maxUserUnits);
    const finalText = (img ? '\u00A0' : '') + escapeHtml(limitedName);

    Array.from(a.childNodes).forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
    a.insertAdjacentHTML('beforeend', finalText);
    renderUserTags(a, info?.tags);
  }

  function processProblemTitle(span) {
    if (!span || !span.matches('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span')) return;
    if (!markOnce(span, 'TitleDone')) return;

    let prefix = '';
    const b = span.querySelector('b');
    if (b) prefix = b.outerHTML + ' ';

    let text = '';
    span.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) text += n.textContent; });
    text = text.trim();
    if (b && text.startsWith(b.textContent)) text = text.slice(b.textContent.length).trim();

    const truncated = truncateByUnits(text, maxTitleUnits);
    Array.from(span.childNodes).forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
    span.innerHTML = prefix + truncated;

    // BN PATCH: force uniform font size on submissions page when title truncation is enabled
    try {
      if (Number.isFinite(maxTitleUnits)) {
        // Some pages run textFit() and write inline font-size on the span, causing inconsistent sizes.
        // Override it: use 14px and mark the node.
        span.setAttribute('data-bn-title-done', '1');
        span.style.setProperty('font-size', '14px', 'important');
        // Also undo any transform scaling that textFit might apply (defensive)
        span.style.removeProperty('transform');
        span.style.removeProperty('line-height');
      }
    } catch (e) {}

  }

  function getProblemIdFromRow(tr) {
    if (!tr || typeof tr.querySelector !== 'function') return null;
    const dataEl = tr.querySelector('[data-problem_id], [data-problem-id], [data-problemId]');
    let pid = null;
    if (dataEl) {
      const ds = dataEl.dataset || {};
      pid = ds.problemId || ds.problem_id || ds.problemid || ds.problemID || null;
      if (!pid) {
        pid = dataEl.getAttribute('data-problem_id') || dataEl.getAttribute('data-problem-id') || dataEl.getAttribute('data-problemId');
      }
    }
    if (!pid) {
      const anchors = tr.querySelectorAll('a[href^="/problem/"]');
      for (const anchor of anchors) {
        if (!anchor || anchor.getAttribute('data-bn-quick-skip') === '1') continue;
        const href = anchor.getAttribute('href') || '';
        const match = href.match(/^\/problem\/(\d+)(?:[\/?#]|$)/);
        if (match) { pid = match[1]; break; }
      }
    }
    if (!pid) return null;
    // Only allow problem IDs that are all-digits (positive integers)
    if (!/^\d+$/.test(String(pid))) return null;
    return String(pid);
  }

  function removeQuickSkip(tr) {
    if (!tr || !tr.cells) return;
    for (let i = tr.cells.length - 1; i >= 0; i--) {
      const cell = tr.cells[i];
      if (!cell) continue;
      if (cell.dataset && cell.dataset.bnQuickSkipCell === '1') {
        try { tr.deleteCell(i); } catch (e) { }
        continue;
      }
      cell.querySelectorAll('a[data-bn-quick-skip="1"]').forEach(el => {
        try { el.remove(); } catch (e) { }
      });
    }
  }

  function ensureQuickSkipHeaderCell(table, insertIndex) {
    if (!table || typeof insertIndex !== 'number' || insertIndex < 0) return;
    const headRow = table.querySelector('thead > tr');
    if (!headRow) return;
    const headerCells = Array.from(headRow.children);
    const boundedIndex = Math.min(insertIndex, headerCells.length);
    let th = headerCells.find(cell => cell.dataset && cell.dataset.bnQuickSkipHeader === '1');
    const reference = headRow.children[boundedIndex] || null;
    if (th) {
      if (Array.prototype.indexOf.call(headRow.children, th) !== boundedIndex) {
        headRow.insertBefore(th, reference);
      }
    } else {
      th = document.createElement('th');
      th.dataset.bnQuickSkipHeader = '1';
      th.classList.add('bn-quick-skip-head');
      th.innerHTML = '<i class="coffee icon" aria-hidden="true"></i>';
      headRow.insertBefore(th, reference);
    }
    if (table.dataset) table.dataset.bnQuickSkipIndex = String(boundedIndex);
  }

  function pruneQuickSkipHeaders() {
    document.querySelectorAll('th[data-bn-quick-skip-header="1"]').forEach(th => {
      const table = th.closest('table');
      if (!table) { th.remove(); return; }
      if (!table.querySelector('td[data-bn-quick-skip-cell="1"]')) {
        if (table.dataset) delete table.dataset.bnQuickSkipIndex;
        th.remove();
      }
    });
  }

  function analyzeQuickSkipRow(tr) {
    if (!tr || !tr.cells) return { qualifies: false, insertIndex: null, questionIcon: false };
    const cells = Array.from(tr.cells);
    if (!cells.length) return { qualifies: false, insertIndex: null, questionIcon: false };

    const questionIconEl = Array.from(tr.querySelectorAll('i.question.icon')).find(icon => {
      if (!icon) return false;
      const cs = getComputedStyle(icon || {});
      const col = (cs && (cs.color || cs.fill || '') || '').toLowerCase();
      if (
        !icon.classList.contains('gold') &&
        !icon.classList.contains('yellow') &&
        !/gold|yellow|#ffd700|#ffb100|#ffc107|rgb\(\s*255\s*,\s*215\s*,\s*0\s*\)|rgb\(\s*255\s*,\s*193\s*,\s*7\s*\)/i.test(col)
      ) return false;
      const skipCell = icon.closest('td[data-bn-quick-skip-cell="1"]');
      return !skipCell;
    });
    if (!questionIconEl) return { qualifies: false, insertIndex: null, questionIcon: false };

    let computedIndex = null;

    const anchorIndex = cells.findIndex(td => {
      const anchor = td.querySelector('a[href^="/problem/"]');
      if (!anchor || anchor.getAttribute('data-bn-quick-skip') === '1') return false;
      const text = (anchor.textContent || '').trim();
      if (!text) return false;
      if (/^L/i.test(text)) return false;
      return /^[A-Za-z]/.test(text);
    });
    if (anchorIndex > -1) computedIndex = anchorIndex + 1;

    if (computedIndex === null) {
      const codeCellIndex = cells.findIndex(td => {
        const bold = td.querySelector('b');
        if (!bold) return false;
        const text = (bold.textContent || '').trim();
        if (!text) return false;
        if (/^L/i.test(text)) return false;
        return /^[A-Za-z]/.test(text);
      });
      if (codeCellIndex > -1) computedIndex = codeCellIndex;
    }

    if (computedIndex === null) return { qualifies: false, insertIndex: null, questionIcon: true };

    return { qualifies: true, insertIndex: computedIndex, questionIcon: true };
  }

  // Utility to safely construct a problem URL path segment
  function safeProblemUrl(problemId) {
    // Accept only strings of digits
    if (typeof problemId !== 'string' && typeof problemId !== 'number') return null;
    const pidStr = String(problemId);
    if (!/^\d+$/.test(pidStr)) return null;
    return `/problem/${pidStr}/skip`;
  }
  ensureAvatarBlockerInstalled();
  function updatePanelEvalIconToCoffee(tr) {
    if (!tr) return;
    const evalCell = tr.cells?.[0] || tr.querySelector('td:first-child');
    if (!evalCell) return;
    const iconEl = evalCell.querySelector('i.question.icon');
    if (!iconEl) return;
    iconEl.classList.remove('question');
    iconEl.classList.add('coffee');
    iconEl.setAttribute('aria-hidden', 'true');
    const fontEl = iconEl.closest('font');
    if (fontEl) fontEl.setAttribute('color', 'Purple');
  }
  function clearPanelQuickSkipCell(tr) {
    if (!tr) return;
    const cell = tr.querySelector('td[data-bn-quick-skip-cell="1"]');
    if (!cell) return;
    cell.innerHTML = '&nbsp;';
    cell.classList.remove('bn-plan-quick-skip-target');
  }
  function markPanelRowAsQuickSkipped(tr) {
    if (!tr) return;
    updatePanelEvalIconToCoffee(tr);
    clearPanelQuickSkipCell(tr);
  }

  function createQuickSkipButton(problemId) {
    const btn = document.createElement('a');
    btn.setAttribute('data-bn-quick-skip', '1');
    const safeHref = safeProblemUrl(problemId);
    if (!safeHref) {
      throw new Error('Invalid problemId in createQuickSkipButton: ' + problemId);
    }
    btn.href = safeHref;
    btn.dataset.problemId = String(problemId);
    btn.className = 'bn-quick-skip';
    btn.innerHTML = '<i class="coffee icon" aria-hidden="true"></i><span>Skip</span>';
    btn.setAttribute('title', '跳过该题目');
    btn.setAttribute('aria-label', '跳过该题目');
    const handleClick = async (event) => {
      if (!event) return;
      if (event.defaultPrevented) return;
      if (typeof event.button === 'number' && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (btn.dataset.bnQuickSkipPending === '1') return;
      btn.dataset.bnQuickSkipPending = '1';
      const targetUrl = btn.href;
      try {
        const response = await fetch(targetUrl, {
          method: 'GET',
          credentials: 'include',
          redirect: 'follow',
        });
        if (!response || !response.ok) throw new Error('Skip request failed');
      } catch (err) {
        delete btn.dataset.bnQuickSkipPending;
        location.href = targetUrl;
        return;
      }
      delete btn.dataset.bnQuickSkipPending;
      const row = btn.closest('tr');
      if (row) markPanelRowAsQuickSkipped(row);
    };
    btn.addEventListener('click', handleClick);
    return btn;
  }

  function isQuickSkipProhibitedTable(table) {
    if (!table) return false;
    const path = (location && typeof location.pathname === 'string') ? location.pathname : '';
    const normalizedPath = path ? path.replace(/\/+/g, '/').replace(/\/$/, '') : '';
    const isHomePath = normalizedPath === '' || normalizedPath === '/' || normalizedPath === '/index' || normalizedPath === '/index.html';
    if (isHomePath) return true;
    if (normalizedPath === '/problems') {
      const search = (location && typeof location.search === 'string') ? location.search : '';
      let hasMyTemplates = false;
      if (search) {
        try {
          const params = new URLSearchParams(search);
          hasMyTemplates = params.has('my_templates');
        } catch (e) {
          hasMyTemplates = /\bmy_templates=/.test(search);
        }
      }
      if (hasMyTemplates) return true;
    }
    if (table.querySelector('tbody#announces')) return true;
    return false;
  }

  function ensureQuickSkipCellAt(tr, insertIndex) {
    if (!tr || typeof insertIndex !== 'number' || Number.isNaN(insertIndex)) return null;
    let targetIndex = insertIndex;
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > tr.cells.length) targetIndex = tr.cells.length;
    let cell = tr.cells[targetIndex];
    if (!cell || !(cell.dataset && cell.dataset.bnQuickSkipCell === '1')) {
      try {
        cell = tr.insertCell(targetIndex);
      } catch (e) {
        cell = document.createElement('td');
        const reference = tr.children[targetIndex] || null;
        tr.insertBefore(cell, reference);
      }
    }
    if (!cell) return null;
    cell.dataset.bnQuickSkipCell = '1';
    cell.classList.add('bn-quick-skip-cell');
    return cell;
  }

  function computeQuickSkipInsertIndex(table, rows) {
    if (!table || !rows || !rows.length) return null;
    for (const tr of rows) {
      const info = analyzeQuickSkipRow(tr);
      if (info && info.qualifies && typeof info.insertIndex === 'number') return info.insertIndex;
    }
    return null;
  }

  function applyQuickSkip(enabled, scopeRoot) {
    const roots = [];
    if (scopeRoot && typeof scopeRoot.querySelectorAll === 'function') roots.push(scopeRoot);
    if (scopeRoot && scopeRoot.matches && scopeRoot.matches(BN_TABLE_ROWS_SELECTOR)) roots.push(scopeRoot);
    if (!roots.length) roots.push(document);

    const tables = new Set();
    roots.forEach(root => {
      if (!root) return;
      if (root.matches && root.matches('table.ui.very.basic.center.aligned.table')) tables.add(root);
      if (root.matches && root.matches(BN_TABLE_ROWS_SELECTOR)) {
        const tbl = root.closest('table.ui.very.basic.center.aligned.table');
        if (tbl) tables.add(tbl);
      }
      if (root.querySelectorAll) {
        root.querySelectorAll('table.ui.very.basic.center.aligned.table').forEach(tbl => tables.add(tbl));
      }
    });

    tables.forEach(table => {
      const rows = Array.from(table.querySelectorAll('tbody > tr'));
      rows.forEach(removeQuickSkip);

      if (!enabled || isQuickSkipProhibitedTable(table)) {
        const header = table.querySelector('th[data-bn-quick-skip-header="1"]');
        if (header) header.remove();
        if (table.dataset) delete table.dataset.bnQuickSkipIndex;
        return;
      }

      const insertIndex = computeQuickSkipInsertIndex(table, rows);
      if (insertIndex === null) {
        const header = table.querySelector('th[data-bn-quick-skip-header="1"]');
        if (header) header.remove();
        if (table.dataset) delete table.dataset.bnQuickSkipIndex;
        return;
      }

      ensureQuickSkipHeaderCell(table, insertIndex);

      rows.forEach(tr => {
        const cell = ensureQuickSkipCellAt(tr, insertIndex);
        if (!cell) return;
        cell.innerHTML = '';
        const info = analyzeQuickSkipRow(tr);
        if (info && info.qualifies) {
          const pid = getProblemIdFromRow(tr);
          if (!pid) return;
          const btn = createQuickSkipButton(pid);
          cell.appendChild(btn);
        } else {
          cell.innerHTML = '&nbsp;';
        }
      });
    });

    if (!enabled) {
      pruneQuickSkipHeaders();
      return;
    }

    pruneQuickSkipHeaders();
  }

  function __bn_shouldHideRow(tr) {
    try {
      const tds = tr.querySelectorAll('td');
      if (!tds || tds.length < 3) return false;
      const codeCell = tds[2];
      const idText = (codeCell.textContent || '').trim();
      if (!/^[QHEST]/.test(idText)) return false;
      const statusTd = tds[1];
      const evalTd = tds[0];
      const isPass = !!statusTd.querySelector('.status.accepted, .status .accepted, span.status.accepted, i.checkmark.icon, i.thumbs.up.icon, i.check.icon');
      const skipIcon = evalTd.querySelector('i.coffee.icon');
      const isSkip = !!(skipIcon && !skipIcon.closest('a[data-bn-quick-skip="1"]'));
      return isPass || isSkip;
    } catch (e) { return false; }
  }
  function applyHideDoneSkip(enabled, scopeRoot) {
    const root = scopeRoot || document;
    const rows = root.querySelectorAll('table.ui.very.basic.center.aligned.table tbody tr');
    rows.forEach(tr => {
      if (enabled && __bn_shouldHideRow(tr)) tr.classList.add('bn-hide-done-skip');
      else tr.classList.remove('bn-hide-done-skip');
    });
    try { updateHideBadge(enabled); } catch (e) { }
  }

  function updateHideBadge(enabled) {
    try {
      const headRow = document.querySelector('table.ui.very.basic.center.aligned.table thead > tr');
      if (!headRow) return;
      let nameTh = null;
      const ths = headRow.querySelectorAll('th');
      for (const th of ths) {
        const t = (th.textContent || '').replace(/\s+/g, '');
        if (t.startsWith('名称')) { nameTh = th; break; }
      }
      if (!nameTh) return;
      let badge = nameTh.querySelector('#bn-hide-note');
      if (enabled) {
        if (!badge) {
          badge = document.createElement('span');
          badge.id = 'bn-hide-note';
          badge.textContent = ' [已隐藏已通过&已跳过题目]';
          badge.style.color = '#16c60c'; // 亮绿色
          badge.style.fontWeight = '600';
          badge.style.marginLeft = '6px';
          nameTh.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    } catch (e) { }
  }
  async function checkForPanelUpdates(noticeEl, remoteVersionEl) {
    try {
      const remoteVersion = await fetchRemotePanelVersion();
      if (!remoteVersion || remoteVersion === manifestVersion) return;
      if (remoteVersionEl) remoteVersionEl.textContent = remoteVersion;
      noticeEl.classList.add('bn-visible');
      noticeEl.removeAttribute('hidden');
    } catch (error) {
      console.warn('[BN] 检测更新失败', error);
    }
  }
  async function fetchRemotePanelVersion() {
    let lastError = null;
    for (const baseUrl of REMOTE_VERSION_URLS) {
      if (!baseUrl) continue;
      try {
        const rawText = await fetchRemotePanelVersionText(baseUrl);
        const normalized = normalizeVersionString(typeof rawText === 'string' ? rawText : '');
        if (normalized && REMOTE_VERSION_PATTERN.test(normalized)) {
          return normalized;
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    if (lastError) throw lastError;
    return '';
  }

  function fetchRemotePanelVersionText(baseUrl) {
    const url = `${baseUrl}?_=${Date.now()}`;
    return new Promise((resolve, reject) => {
      const handleText = (text) => resolve(text || '');
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          url,
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 8000,
          onload: (resp) => {
            if (resp && resp.status >= 200 && resp.status < 300) {
              handleText(resp.responseText || '');
            } else {
              reject(new Error(resp ? `HTTP ${resp.status}` : 'GM_xmlhttpRequest empty response'));
            }
          },
          onerror: (err) => reject(new Error((err && err.error) || 'GM_xmlhttpRequest failed')),
          ontimeout: () => reject(new Error('GM_xmlhttpRequest timeout')),
        });
        return;
      }
      fetch(url, { cache: 'no-store', credentials: 'omit' })
        .then(response => {
          if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : '0'}`);
          return response.text();
        })
        .then(handleText)
        .catch(reject);
    });
  }
  // 初次遍历
  document.querySelectorAll('a[href^="/user/"]').forEach(processUserLink);
  document.querySelectorAll('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span').forEach(processProblemTitle)
  applyQuickSkip(enableQuickSkip);
  applyHideDoneSkip(hideDoneSkip);
  ;

  let submittersConfig = null;

  // 批处理观察器（rAF 合批）
  let moQueue = new Set();
  let moScheduled = false;
  function flushMO() {
    moScheduled = false;
    const nodes = Array.from(moQueue); moQueue.clear();
    let quickSkipSetting = enableQuickSkip;
    try {
      const quickChk = document.getElementById('bn-enable-quick-skip');
      if (quickChk) quickSkipSetting = quickChk.checked;
    } catch (e) { }
    for (const node of nodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('a[href^="/user/"]')) processUserLink(node);
      if (node.matches?.('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span')) processProblemTitle(node);
      node.querySelectorAll?.('a[href^="/user/"]').forEach(processUserLink);
      node.querySelectorAll?.('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span').forEach(processProblemTitle);
      try { applyQuickSkip(quickSkipSetting, node); } catch (e) { }
    }

    try { const _c = document.getElementById('bn-hide-done-skip'); applyHideDoneSkip(_c ? _c.checked : hideDoneSkip); } catch (e) { }
  }
  const observer = new MutationObserver(muts => {
    for (const mut of muts) mut.addedNodes.forEach(n => moQueue.add(n));
    if (!moScheduled) { moScheduled = true; requestAnimationFrame(flushMO); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (enableCopy) fEasierClip();
  if (enableDescCopy) fEasierDescClip();
  if (enableMenu) initUserMenu();
  if (enableVjLink) fVjudgeLink();

})();
