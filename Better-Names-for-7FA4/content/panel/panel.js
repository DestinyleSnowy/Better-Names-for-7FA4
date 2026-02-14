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
  const DEFAULT_BT_INTERVAL = 2000;
  const HI_TOILET_INTERVAL_MIN = 10;
  const HI_TOILET_INTERVAL_MAX = 2000;
  const DEFAULT_THEME_MODE = 'light';
  const DEFAULT_THEME_COLOR = '#007bff';
  const DEFAULT_SUBMITTER_ID = 'origin';
  const DEFAULT_MAX_UNITS = 10;
  const WIDTH_MODE_KEY = 'truncate.widthMode';
  const CORNER_KEY = 'bn.corner';
  const CONFIG_DEFAULTS = Object.freeze({
    bt_enabled: false,
    bt_interval: DEFAULT_BT_INTERVAL,
    bg_enabled: false,
    bg_fillway: 2,
    bg_imageUrl: '',
    bg_imageData: '',
    bg_imageDataName: '',
    bg_imageSourceType: '',
    bg_opacity: '0.1',
    bg_blur: 0,
    panelThemeMode: DEFAULT_THEME_MODE,
    themeColor: DEFAULT_THEME_COLOR,
    maxTitleUnits: DEFAULT_MAX_UNITS,
    maxUserUnits: 'none',
    hideAvatar: true,
    enableCopy: true,
    enableDescCopy: false,
    hideOrig: true,
    enableContestDownloadButtons: true,
    enableContestReviewButtons: true,
    showUserNickname: true,
    enableUserMenu: true,
    enablePlanAdder: true,
    enableTemplateBulkAdd: true,
    enableGuard: false,
    enableAutoRenew: false,
    selectedSubmitter: DEFAULT_SUBMITTER_ID,
    'rankingFilter.enabled': true,
    'rankingFilter.columnSwitch.enabled': true,
    'rankingMerge.enabled': true,
    enableVjLink: true,
    hideDoneSkip: false,
    enableQuickSkip: undefined,
    'quickSkip.migrated.v1': false,
    enableTitleOptimization: true,
    debug: false,
    [WIDTH_MODE_KEY]: 'visual',
    panelPinned: false,
    [CORNER_KEY]: 'br',
    useCustomColors: false,
    userPalette: {},
  });

  const readConfigValue = (key) => {
    const hasDefault = Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, key);
    const fallback = hasDefault ? CONFIG_DEFAULTS[key] : undefined;
    try {
      return GM_getValue(key, fallback);
    } catch (_) {
      return fallback;
    }
  };

  const DEBUG = !!readConfigValue('debug');
  const debugLog = (...args) => {
    if (!DEBUG) return;
    try { console.log('[BN][debug]', ...args); } catch (_) { /* ignore */ }
  };
  const resolveRuntimeUrl = (path) => {
    try {
      if (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.getURL === 'function') {
        return browser.runtime.getURL(path);
      }
    } catch (_) { /* ignore */ }
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(path);
      }
    } catch (_) { /* ignore */ }
    return path;
  };

  let ensureAvatarBlockerInstalled = () => false;
  let runAvatarSanitizer = () => {};
  const avatarModuleCandidates = [resolveRuntimeUrl('content/panel/avatar-blocker.js'), './avatar-blocker.js'];
  for (const candidate of avatarModuleCandidates) {
    try {
      const avatarModule = await import(candidate);
      if (avatarModule && typeof avatarModule.createAvatarBlocker === 'function') {
        const blocker = avatarModule.createAvatarBlocker({
          isBlockingEnabled: () => !!hideAvatar,
          placeholderSrc: AVATAR_PLACEHOLDER_SRC,
          debugLog,
        });
        ensureAvatarBlockerInstalled = blocker.ensureAvatarBlockerInstalled;
        runAvatarSanitizer = blocker.runAvatarSanitizer;
        break;
      }
    } catch (error) {
      debugLog('Avatar blocker module load failed', candidate, error);
    }
  }

  function safeGetJSON(key, fallback) {
    try {
      const v = readConfigValue(key);
      if (v == null) return fallback;
      if (typeof v === 'string') return JSON.parse(v);
      if (typeof v === 'object') return v;
      return fallback;
    } catch {
      return fallback;
    }
  }

  const storedBtInterval = clampHiToiletInterval(readConfigValue('bt_interval'));
  const btEnabled = !!readConfigValue('bt_enabled');
  const storedBgEnabled = readConfigValue('bg_enabled');
  const storedBgfillway = readConfigValue('bg_fillway');
  debugLog('Background fill mode loaded', storedBgfillway);
  const storedBgImageUrl = readConfigValue('bg_imageUrl');
  const storedBgImageData = readConfigValue('bg_imageData');
  const storedBgImageDataName = readConfigValue('bg_imageDataName');
  const storedBgSourceTypeRaw = readConfigValue('bg_imageSourceType');
  const storedBgOpacity = readConfigValue('bg_opacity');
  const storedBgBlur = readConfigValue('bg_blur');
  const storedThemeModeRaw = readConfigValue('panelThemeMode');
  const storedThemeColorRaw = readConfigValue('themeColor');
  const storedTitleUnits = readConfigValue('maxTitleUnits');
  const storedUserUnits = readConfigValue('maxUserUnits');
  let templateBulkRetryTimer = null;
  const maxTitleUnits = (storedTitleUnits === 'none') ? Infinity : parseInt(storedTitleUnits, 10);
  const maxUserUnits = (storedUserUnits === 'none') ? Infinity : parseInt(storedUserUnits, 10);
  let hideAvatar = readConfigValue('hideAvatar');
  const AVATAR_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const enableCopy = readConfigValue('enableCopy');
  const enableDescCopy = readConfigValue('enableDescCopy');
  const hideOrig = readConfigValue('hideOrig');
  const enableContestDownloadButtons = readConfigValue('enableContestDownloadButtons');
  const enableContestReviewButtons = readConfigValue('enableContestReviewButtons');
  const showUserNickname = readConfigValue('showUserNickname');
  const enableMenu = readConfigValue('enableUserMenu');
  const enablePlanAdder = true;
  try { GM_setValue('enablePlanAdder', true); } catch (_) { /* ignore */ }
  const enableTemplateBulkAdd = readConfigValue('enableTemplateBulkAdd');
  const enableGuard = readConfigValue('enableGuard');
  const enableAutoRenew = readConfigValue('enableAutoRenew');
  const SUBMITTERS_CONFIG_URL = 'submitter/submitters.json';
  const SUPPORTED_PORTS = new Set(['', '8888', '5283']);
  const SUPPORTED_HOSTS = new Set(['7fa4.cn', '10.210.57.10', '211.137.101.118']);
  const REMOTE_VERSION_URL = 'http://jx.7fa4.cn:9080/yx/better-names-for-7fa4/-/raw/main/version';
  const REMOTE_VERSION_FALLBACK_URL = 'http://in.7fa4.cn:9080/yx/better-names-for-7fa4/-/raw/main/version';
  const REMOTE_VERSION_URLS = [REMOTE_VERSION_URL, REMOTE_VERSION_FALLBACK_URL];
  const VERSION_LINE_PREFIX_RE = /^(?:version|ver)\s*[:=]\s*/i;
  const VERSION_CANDIDATE_RE = /^v?\d+(?:\.\d+){1,3}(?:[-_][0-9A-Za-z.-]+)?$/;
  const VERSION_CANDIDATE_IN_LINE_RE = /(v?\d+(?:\.\d+){1,3}(?:[-_][0-9A-Za-z.-]+)?)/i;
  const UPDATE_PAGE_URL = 'http://jx.7fa4.cn:9080/yx/better-names-for-7fa4';
  const UPDATE_MANUAL_SYNC_MESSAGE = '登录 Gitlab 同步最新版本';
  const manifestVersion = normalizeVersionString(readManifestVersion());
  const manifestVersionInfo = parseComparableVersion(manifestVersion);
  const isSupportedHostname = (host) => {
    if (typeof host !== 'string' || !host) return false;
    if (SUPPORTED_HOSTS.has(host)) return true;
    return host.endsWith('.7fa4.cn');
  };
  const storedSelectedSubmitter = readConfigValue('selectedSubmitter');
  const enableRankingFilterSetting = readConfigValue('rankingFilter.enabled');
  const enableColumnSwitchSetting = readConfigValue('rankingFilter.columnSwitch.enabled') !== false;
  const enableMergeAssistantSetting = readConfigValue('rankingMerge.enabled') !== false;
  const enableVjLink = readConfigValue('enableVjLink');
  const hideDoneSkip = readConfigValue('hideDoneSkip');
  let rawQuickSkip;
  let quickSkipMigrated = false;
  try {
    rawQuickSkip = readConfigValue('enableQuickSkip');
  } catch (err) {
    rawQuickSkip = undefined;
  }
  try {
    quickSkipMigrated = !!readConfigValue('quickSkip.migrated.v1');
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
  const enableTitleOptimization = readConfigValue('enableTitleOptimization');
  const widthMode = readConfigValue(WIDTH_MODE_KEY);
  // Centralized configuration groups for easier export/reset flows.
  const backgroundConfig = {
    enabled: storedBgEnabled,
    fillway: storedBgfillway,
    imageUrl: storedBgImageUrl,
    imageData: storedBgImageData,
    imageDataName: storedBgImageDataName,
    sourceType: storedBgSourceTypeRaw,
    opacity: storedBgOpacity,
    blur: storedBgBlur,
  };
  const themeConfig = { mode: storedThemeModeRaw, color: storedThemeColorRaw };
  const truncationConfig = {
    rawTitleUnits: storedTitleUnits,
    rawUserUnits: storedUserUnits,
    maxTitleUnits,
    maxUserUnits,
    widthMode,
  };
  const hiToiletConfig = { enabled: btEnabled, interval: storedBtInterval };
  const featureFlags = {
    hideAvatar,
    enableCopy,
    enableDescCopy,
    hideOrig,
    enableContestDownloadButtons,
    enableContestReviewButtons,
    showUserNickname,
    enableMenu,
    enablePlanAdder,
    enableTemplateBulkAdd,
    enableGuard,
    enableAutoRenew,
    enableVjLink,
    hideDoneSkip,
    enableQuickSkip,
    enableTitleOptimization,
  };
  const rankingConfig = {
    enableRankingFilterSetting,
    enableColumnSwitchSetting,
    enableMergeAssistantSetting,
  };
  const submitterConfig = { selected: storedSelectedSubmitter };
  const quickSkipState = { raw: rawQuickSkip, migrated: quickSkipMigrated, enabled: enableQuickSkip };
  const layoutConfig = {
    pinned: !!readConfigValue('panelPinned'),
    corner: readConfigValue(CORNER_KEY),
  };
  const paletteConfig = {
    storedPalette: safeGetJSON('userPalette', CONFIG_DEFAULTS.userPalette),
    useCustomColors: readConfigValue('useCustomColors'),
  };
  const configCenter = {
    defaults: CONFIG_DEFAULTS,
    background: backgroundConfig,
    theme: themeConfig,
    truncation: truncationConfig,
    hiToilet: hiToiletConfig,
    featureFlags,
    ranking: rankingConfig,
    submitters: submitterConfig,
    quickSkip: quickSkipState,
    layout: layoutConfig,
    palette: paletteConfig,
    debug: DEBUG,
  };
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
  function clampBlur(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num < 0) return 0;
    if (num > 50) return 50;
    return Number(num.toFixed(2));
  }
  function formatBlurText(value) {
    const num = clampBlur(value);
    return num.toFixed(1).replace(/\.0+$/, '');
  }
  function clampHiToiletInterval(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_BT_INTERVAL;
    const rounded = Math.round(num);
    if (rounded < HI_TOILET_INTERVAL_MIN) return HI_TOILET_INTERVAL_MIN;
    if (rounded > HI_TOILET_INTERVAL_MAX) return HI_TOILET_INTERVAL_MAX;
    return rounded;
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
    return sliced.replace(/^\uFEFF/, '').replace(/\r/g, '');
  }
  function extractVersionCandidate(value) {
    const normalized = normalizeVersionString(value);
    if (!normalized) return '';
    if (/^\s*</.test(normalized)) return '';
    const stripped = normalized.replace(VERSION_LINE_PREFIX_RE, '').trim();
    if (!stripped) return '';
    if (VERSION_CANDIDATE_RE.test(stripped)) return stripped;
    const matched = stripped.match(VERSION_CANDIDATE_IN_LINE_RE);
    return matched ? matched[1] : '';
  }
  function parseComparableVersion(value) {
    const candidate = extractVersionCandidate(value);
    if (!candidate) return null;
    const normalized = candidate.toLowerCase().replace(/^v(?=\d)/, '');
    const [coreRaw, suffixRaw = ''] = normalized.split(/[-_]/, 2);
    if (!coreRaw) return null;
    const coreParts = coreRaw
      .split('.')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        if (!/^\d+$/.test(part)) return NaN;
        return Number(part);
      });
    if (!coreParts.length || coreParts.some(part => !Number.isFinite(part))) return null;
    const safeSuffix = suffixRaw.replace(/[^0-9a-z.-]/g, '');
    return {
      display: candidate,
      canonical: `${coreParts.join('.')}${safeSuffix ? `-${safeSuffix}` : ''}`,
      coreParts,
      suffix: safeSuffix,
    };
  }
  function compareParsedVersions(left, right) {
    if (!left || !right) return null;
    const maxLen = Math.max(left.coreParts.length, right.coreParts.length);
    for (let i = 0; i < maxLen; i += 1) {
      const lv = left.coreParts[i] ?? 0;
      const rv = right.coreParts[i] ?? 0;
      if (lv > rv) return 1;
      if (lv < rv) return -1;
    }
    const leftStable = !left.suffix;
    const rightStable = !right.suffix;
    if (leftStable !== rightStable) return leftStable ? 1 : -1;
    if (left.suffix === right.suffix) return 0;
    return left.suffix > right.suffix ? 1 : -1;
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

  function applyBackgroundOverlay(enabled,fillway,url, opacity, blurPx) {
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
      const blurValue = clampBlur(blurPx);
      layer.style.filter = blurValue > 0 ? `blur(${blurValue}px)` : 'none';
      layer.style.background = `url("${trimmedUrl}") ${backgroundStyles[fillway]}`;
    });
  }
  const normalizedBgData = typeof storedBgImageData === 'string' ? storedBgImageData.trim() : '';
  const normalizedBgfillway = storedBgfillway;
  const normalizedBgUrl = typeof storedBgImageUrl === 'string' ? storedBgImageUrl.trim() : '';
  debugLog('Background remote url normalized:', normalizedBgUrl);
  debugLog('Background fillway normalized:', normalizedBgfillway);
  const normalizedBgSourceType = (() => {
    if (storedBgSourceTypeRaw === 'local' && normalizedBgData) return 'local';
    if (storedBgSourceTypeRaw === 'remote') return 'remote';
    return normalizedBgData ? 'local' : 'remote';
  })();
  const normalizedBgFileName = typeof storedBgImageDataName === 'string' ? storedBgImageDataName : '';
  const normalizedBgOpacity = String(clampOpacity(storedBgOpacity));
  const normalizedBgBlur = clampBlur(storedBgBlur);
  const initialBackgroundSource = (normalizedBgSourceType === 'local' && normalizedBgData)
    ? normalizedBgData
    : normalizedBgUrl;
  applyBackgroundOverlay(storedBgEnabled,storedBgfillway, initialBackgroundSource, normalizedBgOpacity, normalizedBgBlur);

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
  const LEVEL_LABELS = { x4: '小2022级', x5: '小2021级', x6: '小2020级', c1: '初2025级', c2: '初2024级', c3: '初2023级', g1: '高2025级', g2: '高2024级', g3: '高2023级', d1: '大2025级', d2: '大2024级', d3: '大2023级', d4: '大2022级', by: '毕业', jl: '教练', uk: '其他' };
  const COLOR_LABELS = LEVEL_LABELS;
  const GRADE_LABELS = LEVEL_LABELS;

  const themeColor = normalizeHexColor(storedThemeColorRaw, DEFAULT_THEME_COLOR);
  const themeMode = normalizeThemeMode(storedThemeModeRaw);
  const storedPalette = configCenter.palette.storedPalette;
  const useCustomColors = configCenter.palette.useCustomColors;

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
  let fireworksBtn = document.getElementById('bn-fireworks');
  const trigger = document.getElementById('bn-trigger');
  const themeColorInput = document.getElementById('bn-theme-color');
  const themeColorHexInput = document.getElementById('bn-theme-color-hex');
  const themeModeRadios = container.querySelectorAll('input[name="bn-theme-mode"]');
  const bgEnabledInput = document.getElementById('bn-bg-enabled');
  const bgfillwayInput = document.getElementById('bn-bg-fillway');
  const bgUrlInput = document.getElementById('bn-bg-image-url');
  const bgOpacityInput = document.getElementById('bn-bg-opacity');
  const bgOpacityValueSpan = document.getElementById('bn-bg-opacity-value');
  const bgBlurInput = document.getElementById('bn-bg-blur');
  const bgBlurValueSpan = document.getElementById('bn-bg-blur-value');
  const bgFileInput = document.getElementById('bn-bg-image-file');
  const bgFilePickBtn = document.getElementById('bn-bg-image-file-btn');
  const bgFileNameSpan = document.getElementById('bn-bg-image-file-name');
  const bgFileClearBtn = document.getElementById('bn-bg-clear-local');
  const bgSourceHint = document.getElementById('bn-bg-source-hint');
  const hiToiletInput = document.getElementById('bn-bt-enabled');
  const hiToiletIntervalInput = document.getElementById('bn-bt-interval');
  const hiToiletIntervalValue = document.getElementById('bn-bt-interval-value');
  function getHiToiletEnabledState() {
    if (hiToiletInput) return hiToiletInput.checked;
    const fallback = document.getElementById('bn-bt-enabled');
    if (fallback) return fallback.checked;
    return originalConfig.btEnabled;
  }
  const versionTextEl = document.getElementById('bn-version-text');
  const updateNoticeEl = document.getElementById('bn-update-notice');
  const updateVersionEl = document.getElementById('bn-update-version');
  const updateLinkEl = document.getElementById('bn-update-link');
  const joinPlanStatusTextEl = container.querySelector('#bn-plan-membership-text');
  const joinPlanDetailBtnEl = container.querySelector('#bn-plan-join-detail-btn');
  const joinPlanModalEl = container.querySelector('#bn-plan-detail-modal');
  const joinPlanModalBodyEl = container.querySelector('#bn-plan-detail-modal-body');
  const joinPlanModalCloseEls = container.querySelectorAll('[data-bn-plan-modal-close="1"]');
  const joinPlanModalCloseBtnEl = container.querySelector('.bn-plan-detail-modal-close');
  const UPDATE_NOTICE_WARNING_CLASS = 'bn-state-warning';
  const UPDATE_NOTICE_ERROR_CLASS = 'bn-state-error';
  if (!panel || !pinBtn || !trigger) {
    console.error('[BN] 面板初始化失败：缺少必要的 DOM 元素');
    container.remove();
    return;
  }
  if (!fireworksBtn) {
    fireworksBtn = createFireworksButton(pinBtn);
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
  let pinned = !!configCenter.layout.pinned;
  const SNAP_MARGIN = 20;
  const DRAG_THRESHOLD = 6;
  let isDragging = false;
  let dragPending = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let gearW = 48, gearH = 48;
  let __bn_dragX = 0, __bn_dragY = 0;
  let __bn_dragOffsetX = 24, __bn_dragOffsetY = 24;
  let __bn_pointerId = null;
  let __bn_pointerMode = null;
  let __bn_dragRafId = null;
  let __bn_snapRafId = null;
  let __bn_settleTimer = null;
  let __bn_dragPendingX = 0;
  let __bn_dragPendingY = 0;
  let __bn_suppressTriggerClickUntil = 0;
  const __bn_nowMs = () => (window.performance && performance.now) ? performance.now() : Date.now();
  let currentBgSourceType = normalizedBgSourceType;
  let currentBgImageData = normalizedBgData;
  let currentBgImageDataName = normalizedBgFileName;
  let fireworksEngine = null;
  let fireworksActiveTimer = null;
  const FIREWORKS_ICON_SVG = `
      <svg class="bn-icon bn-icon-fireworks" viewBox="0 0 1088 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M528.991209 435.636191c-0.50423-4.117882-0.840384-7.563457-1.176537-11.345185s-0.50423-7.39538-0.672308-11.177108v-22.102101a379.853598 379.853598 0 0 1 4.117882-44.540355 279.763855 279.763855 0 0 1 10.504801-44.288241 249.341952 249.341952 0 0 1 77.987641-118.494153 285.730582 285.730582 0 0 1 85.130906-48.574199h0.672307a42.523434 42.523434 0 0 1 29.58152 79.752448 44.120163 44.120163 0 0 1-7.899611 2.184998 208.247171 208.247171 0 0 0-67.987071 22.774409 185.724878 185.724878 0 0 0-29.833634 20.673448A195.809487 195.809487 0 0 0 603.617314 287.224365a221.777355 221.777355 0 0 0-21.177678 32.18671 272.284437 272.284437 0 0 0-16.219413 36.304591A304.219032 304.219032 0 0 0 554.791 394.457372c-1.428653 6.723073-2.773267 13.278068-3.781728 20.169217-0.50423 3.445575-1.008461 6.723073-1.260576 10.168647s-0.672307 6.891149-0.840384 9.832494v0.50423a9.916532 9.916532 0 0 1-10.924993 9.328264 10.168647 10.168647 0 0 1-9.328263-8.824033z" fill="#FFC229"></path>
        <path d="M584.624634 491.101539c2.437114-2.941344 4.706151-5.378458 7.059227-8.40384s4.706151-5.042304 7.227303-7.479419c4.874228-4.958266 10.00057-9.748455 15.210951-14.286529a313.29518 313.29518 0 0 1 33.615363-25.631714 270.687707 270.687707 0 0 1 78.57591-36.640745 238.753113 238.753113 0 0 1 44.792471-7.647495c3.781728-0.50423 7.731533 0 11.513261-0.50423h11.513262c3.949805 0 7.731533 0 11.681338 0.672307l11.597301 1.260576a262.031752 262.031752 0 0 1 88.324365 30.085749 42.439395 42.439395 0 1 1-40.758627 74.794182 33.615363 33.615363 0 0 1-6.134804-3.949805l-6.554996-5.294419a79.500333 79.500333 0 0 0-6.554995-5.042305 157.824127 157.824127 0 0 0-13.782299-9.244225 166.227968 166.227968 0 0 0-29.665558-14.286529l-7.89961-2.60519c-2.605191-0.840384-5.462496-1.512691-8.40384-2.10096l-4.285959-1.0925-4.117882-0.840384c-2.773267-0.50423-5.546535-1.176538-8.403841-1.428653a168.076813 168.076813 0 0 0-34.455746-1.176537 224.550622 224.550622 0 0 0-70.760339 16.807681 310.942104 310.942104 0 0 0-34.119593 16.807681c-5.630573 3.109421-11.009031 6.386919-16.303451 10.000571l-7.815571 5.462496a80.67687 80.67687 0 0 0-7.39538 5.546535h-0.504231a10.00057 10.00057 0 0 1-13.950375-1.59673 9.748455 9.748455 0 0 1 0.50423-12.353646z" fill="#FFE045"></path>
        <path d="M580.002522 557.912072c3.613651 1.176538 6.554996 2.10096 9.832494 3.277498l9.49634 3.445575c6.30288 2.437114 12.521723 5.126343 18.572487 7.89961a335.565357 335.565357 0 0 1 35.968438 19.160757 290.184618 290.184618 0 0 1 64.625535 53.028234 230.013119 230.013119 0 0 1 26.472098 34.791901A225.895237 225.895237 0 0 1 764.887016 719.601967c0.672307 1.764807 1.512691 3.445575 2.100961 5.210381l1.848845 5.462496c1.176538 3.613651 2.437114 7.227303 3.445574 10.840955 1.764807 7.39538 3.949805 14.79076 5.126343 22.270177a287.999619 287.999619 0 0 1 4.20192 45.632855 42.523434 42.523434 0 1 1-84.962829 2.353075 57.230155 57.230155 0 0 1 0.588269-8.40384v-0.840384a181.43892 181.43892 0 0 0 3.949805-31.68248c0.50423-5.378458 0-10.672878 0-15.883258 0-2.605191-0.50423-5.29442-0.672307-8.403841v-3.949805c0-1.260576-0.50423-2.605191-0.672307-3.865767a159.672972 159.672972 0 0 0-8.403841-31.682479 176.480654 176.480654 0 0 0-14.454606-30.758057 246.064454 246.064454 0 0 0-44.624394-55.465348 349.011502 349.011502 0 0 0-28.236904-23.782869c-4.958266-3.613651-10.00057-7.39538-15.29499-10.672878-2.605191-1.680768-5.210381-3.445575-7.815572-4.958266s-5.462496-3.277498-7.89961-4.538074h-0.504231a10.084609 10.084609 0 0 1-3.949805-13.614222 9.076148 9.076148 0 0 1 11.345185-4.958266z m-116.729347-76.811103c-2.269037-2.437114-4.874228-5.210381-7.563456-7.731534s-5.378458-5.042304-8.403841-7.731533c-5.462496-5.042304-11.177108-9.832494-16.807681-14.370568A341.616123 341.616123 0 0 0 395.118028 425.63562 327.245555 327.245555 0 0 0 356.796514 404.878134a258.081946 258.081946 0 0 0-39.750166-14.118452 183.876034 183.876034 0 0 0-40.170358-6.554996 175.64027 175.64027 0 0 0-39.414013 1.428653 41.094781 41.094781 0 0 0-4.790189 0.672307l-4.706151 1.008461c-3.193459 0.672307-6.470957 1.092499-9.580378 1.932883a181.018728 181.018728 0 0 0-18.48845 5.79865 225.306968 225.306968 0 0 0-35.128054 16.219413l-1.00846 0.50423a42.523434 42.523434 0 1 1-40.422474-74.87822 52.608042 52.608042 0 0 1 6.723073-2.941344A330.270938 330.270938 0 0 1 181.660475 320.839728a256.485217 256.485217 0 0 1 26.38806-3.109422c4.454036 0 8.908071 0 13.278068-0.50423h13.362107a249.678106 249.678106 0 0 1 52.019773 7.39538 264.636942 264.636942 0 0 1 48.238046 16.807681A308.841144 308.841144 0 0 1 378.310346 366.388544 363.718223 363.718223 0 0 1 416.547821 396.474293a401.619545 401.619545 0 0 1 33.615363 34.28767c5.126343 6.134804 10.168647 12.185569 15.126913 18.404411 2.437114 3.109421 4.706151 6.386919 7.059226 9.49634l6.89115 10.084609a9.916532 9.916532 0 0 1-15.631144 12.101531z" fill="#FFC229"></path>
        <path d="M444.280496 298.905703c-1.344615-4.958266-2.941344-10.336724-4.79019-15.547105s-3.613651-10.420762-5.714611-15.631143c-4.117882-10.336724-8.403841-20.337294-13.446145-30.169788a377.500522 377.500522 0 0 0-33.615363-55.38131c-6.386919-8.403841-13.109991-16.807681-20.169217-24.623253s-14.454606-15.210952-22.18614-22.102101a303.378648 303.378648 0 0 0-49.078429-36.304592 42.607472 42.607472 0 0 1 43.699971-73.197452 43.699971 43.699971 0 0 1 7.89961 6.050765l0.756346 0.840384a383.971479 383.971479 0 0 1 48.910353 58.826885c7.059226 10.504801 13.530183 21.177678 19.580948 32.018633s11.345185 22.018063 16.051336 33.615362A420.192033 420.192033 0 0 1 453.944912 225.708251c2.605191 11.681339 4.874228 23.278639 6.554996 35.128054 0.840384 5.882688 1.512691 11.849415 2.10096 17.732104s1.008461 11.681339 1.008461 18.236334A10.00057 10.00057 0 0 1 453.944912 306.97339a9.832494 9.832494 0 0 1-9.832493-7.395379zM291.246557 549.256116c-4.874228 0.756346-10.672878 1.764807-15.883259 2.941345s-10.672878 2.437114-16.051335 3.949805c-10.672878 2.941344-21.177678 6.386919-31.346326 10.168647a361.365148 361.365148 0 0 0-58.826884 27.900751C159.810489 599.595122 151.406649 605.561849 143.002808 611.612614s-16.807681 12.773838-24.455176 19.49691a310.942104 310.942104 0 0 0-41.346896 44.960548A42.691511 42.691511 0 1 1 8.541358 624.722606a43.111703 43.111703 0 0 1 6.891149-7.227303l0.840384-0.672308a376.5761 376.5761 0 0 1 63.533035-42.019203c11.177108-5.882688 22.438255-11.09307 33.615363-15.883259s23.110562-8.908071 34.7919-12.521722A411.788192 411.788192 0 0 1 219.729873 530.935744a337.246125 337.246125 0 0 1 35.632285-2.773268h17.90018c6.134804 0 11.765377 0 18.152296 0.924423a10.084609 10.084609 0 0 1 0.672307 19.917102h-0.840384z m514.315048 33.615363c6.218842 1.008461 11.765377 2.10096 17.564027 3.445575s11.261146 2.773267 16.807682 4.454035c11.261146 3.109421 22.270178 7.059226 33.615362 11.261147a373.802832 373.802832 0 0 1 63.869189 32.354786 366.155337 366.155337 0 0 1 57.734385 45.128625 373.634755 373.634755 0 0 1 48.658238 57.48227v0.840384a42.691511 42.691511 0 1 1-70.340146 48.406122 38.657667 38.657667 0 0 1-4.79019-9.244225 306.824222 306.824222 0 0 0-26.135944-52.776119 299.680958 299.680958 0 0 0-37.901321-48.322084 339.851316 339.851316 0 0 0-48.069969-41.178819c-8.403841-6.218842-17.732104-11.933454-27.228444-17.39595L815.31006 609.259539c-4.790189-2.437114-9.832494-4.706151-14.454606-6.554996h-0.672307a10.00057 10.00057 0 0 1-5.378458-13.109991 10.420762 10.420762 0 0 1 11.009031-6.050766z" fill="#CE111B"></path>
        <path d="M522.688329 674.809496c2.941344 25.211522 6.134804 50.002852 8.908071 75.130335s5.042304 50.423044 6.723072 76.222835c3.445575 51.011313 4.454036 102.190702 4.874228 153.117977a42.523434 42.523434 0 1 1-84.962829 0.672307 45.548816 45.548816 0 0 1 0.924423-9.076148c10.252686-48.742276 19.917102-97.652628 27.144405-146.731058 3.613651-24.287099 6.891149-49.498621 9.664417-74.037836s4.958266-49.918813 7.227303-74.962259a10.00057 10.00057 0 0 1 11.009031-9.076147 9.832494 9.832494 0 0 1 8.40384 8.40384z m221.777355-356.658997c5.210381-3.781728 10.00057-6.723073 15.29499-9.916532s10.168647-6.050765 15.379028-8.403841c10.504801-5.714612 21.177678-10.840954 32.18671-15.631144a422.545108 422.545108 0 0 1 68.743416-22.774408c12.017492-2.773267 24.203061-5.126343 36.304592-6.723072s25.211522-2.773267 37.229014-3.277498a388.761669 388.761669 0 0 1 76.222835 4.70615h0.756345a42.691511 42.691511 0 0 1-13.614221 84.038407 37.565168 37.565168 0 0 1-9.664417-2.773267 299.260766 299.260766 0 0 0-89.416865-22.606332c-10.504801-1.008461-21.009602-1.680768-31.850556-1.680768a383.551287 383.551287 0 0 0-64.709573 5.378458 328.338054 328.338054 0 0 0-32.18671 7.059226l-15.883258 4.622113c-5.29442 1.680768-10.672878 3.613651-15.29499 5.462496h-0.504231a10.084609 10.084609 0 0 1-12.941914-5.630573 10.840954 10.840954 0 0 1 3.949805-11.849415z" fill="#FF2528"></path>
        <path d="M477.055474 569.08918c-2.941344 0.840384-6.386919 1.932883-9.664417 3.109421s-6.554996 2.269037-9.832493 3.613652c-6.554996 2.437114-12.773838 5.210381-19.244795 8.403841a298.840574 298.840574 0 0 0-36.220554 19.49691 247.661184 247.661184 0 0 0-60.255537 51.515543 178.497575 178.497575 0 0 0-34.959977 65.045727 174.463732 174.463732 0 0 0-6.386919 35.464207 159.672972 159.672972 0 0 0-0.672307 18.068258 80.424755 80.424755 0 0 0 0 8.992109l0.840384 8.655956v1.680768a42.523434 42.523434 0 0 1-84.878791 4.790189 42.943626 42.943626 0 0 1 0-8.40384l1.59673-12.521723c0.672307-4.033844 1.008461-8.403841 2.016922-12.269607a245.560224 245.560224 0 0 1 6.218842-23.698831 240.097727 240.097727 0 0 1 79.920524-123.536457A290.268656 290.268656 0 0 1 386.714187 571.022064a343.128814 343.128814 0 0 1 43.195741-13.614222c7.227303-1.764807 14.622683-3.445575 22.018063-4.706151a234.752885 234.752885 0 0 1 22.606331-3.193459 10.084609 10.084609 0 0 1 10.840954 9.076148 9.832494 9.832494 0 0 1-7.227303 10.5048z" fill="#FFE045"></path>
        <path d="M451.171645 31.243379a29.749596 29.749596 0 0 0 59.415153 0 29.749596 29.749596 0 1 0-59.415153 0z" fill="#FF2528"></path>
        <path d="M1026.330499 610.099923a27.060367 27.060367 0 1 0 27.060367-27.060367 27.060367 27.060367 0 0 0-27.060367 27.060367z" fill="#FFC229"></path>
        <path d="M342.173832 986.507946a21.849986 21.849986 0 1 0 21.849985-21.849986 21.765947 21.765947 0 0 0-21.849985 21.849986zM1041.03722 217.472487a21.849986 21.849986 0 0 0 43.699972 0 21.849986 21.849986 0 0 0-43.699972 0z" fill="#FF2528"></path>
        <path d="M55.602865 783.975386a20.673448 20.673448 0 1 0 41.346896 0 20.673448 20.673448 0 1 0-41.346896 0z" fill="#FFC229"></path>
      </svg>
  `;

  function createFireworksButton(pinElement) {
    if (!pinElement || !pinElement.parentElement) return null;
    const button = document.createElement('div');
    button.id = 'bn-fireworks';
    button.setAttribute('title', '放烟花');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', '放烟花');
    button.innerHTML = FIREWORKS_ICON_SVG;
    pinElement.insertAdjacentElement('beforebegin', button);
    return button;
  }

  function createFireworksEngine() {
    if (!document.body) return null;
    const canvas = document.createElement('canvas');
    canvas.id = 'bn-fireworks-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    document.body.appendChild(canvas);

    let dpr = 1;
    let width = 1;
    let height = 1;
    let rafId = null;
    let lastTs = 0;
    let activeUntil = 0;
    const particles = [];
    const pendingTimers = new Set();

    const nowMs = () => (window.performance && typeof performance.now === 'function') ? performance.now() : Date.now();
    const rand = (min, max) => min + Math.random() * (max - min);
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const BURST_STYLES = Object.freeze(['sphere', 'ring', 'chrysanthemum', 'willow', 'strobe', 'double']);

    const resize = () => {
      width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const scheduleBurst = (delay, fn) => {
      const timerId = window.setTimeout(() => {
        pendingTimers.delete(timerId);
        fn();
      }, Math.max(0, delay));
      pendingTimers.add(timerId);
    };

    const spawnParticle = (x, y, angle, speed, options = {}) => {
      const ttl = options.ttl ?? rand(0.9, 1.9);
      const life = options.life ?? ttl;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        ttl,
        size: options.size ?? rand(1.2, 3.6),
        drag: options.drag ?? rand(0.9, 0.965),
        gravity: options.gravity ?? rand(90, 240),
        alpha: options.alpha ?? rand(0.68, 1),
        hue: options.hue ?? randInt(0, 359),
        sat: options.sat ?? randInt(70, 100),
        light: options.light ?? randInt(52, 72),
        trail: options.trail ?? rand(0.7, 1.8),
        twinkle: options.twinkle ?? rand(0.4, 1.2),
      });
    };

    const spawnBurst = (x, y, options = {}) => {
      const style = options.style || BURST_STYLES[randInt(0, BURST_STYLES.length - 1)];
      const sizeScale = Math.max(0.55, Math.min(2.4, Number(options.sizeScale) || rand(0.68, 2.05)));
      const baseHue = randInt(0, 359);
      const baseCount = Math.max(20, Math.round(rand(42, 92) * sizeScale));
      const basePower = rand(145, 325) * (0.72 + sizeScale * 0.42);
      const baseGravity = rand(85, 220) * (0.8 + sizeScale * 0.2);
      const addCore = options.addCore !== false;

      if (addCore) {
        spawnParticle(x, y, rand(0, Math.PI * 2), rand(20, 55), {
          size: rand(2.4, 4.4) * Math.min(1.35, sizeScale),
          ttl: rand(0.25, 0.45),
          life: rand(0.25, 0.45),
          drag: rand(0.84, 0.9),
          gravity: rand(40, 90),
          alpha: rand(0.85, 1),
          hue: (baseHue + rand(-14, 14) + 360) % 360,
          sat: randInt(75, 100),
          light: randInt(68, 92),
          trail: rand(0.22, 0.5),
          twinkle: rand(0.9, 1.8),
        });
      }

      const emit = (angle, speed, overrides = {}) => {
        const hue = overrides.hue ?? (baseHue + rand(-68, 68) + 360) % 360;
        spawnParticle(x, y, angle, speed, {
          gravity: baseGravity,
          hue,
          ...overrides,
        });
      };

      if (style === 'ring') {
        const count = Math.max(18, Math.round(baseCount * 0.85));
        for (let i = 0; i < count; i += 1) {
          const angle = (Math.PI * 2 * i) / count + rand(-0.03, 0.03);
          const speed = basePower * rand(0.9, 1.1);
          emit(angle, speed, {
            size: rand(1.2, 3.2) * Math.min(1.5, sizeScale),
            ttl: rand(1.1, 2.1),
            drag: rand(0.922, 0.97),
            trail: rand(1.05, 2.1),
            alpha: rand(0.72, 0.96),
          });
        }
        return;
      }

      if (style === 'chrysanthemum') {
        const spokes = randInt(9, 18);
        const rings = randInt(2, 3);
        for (let ring = 0; ring < rings; ring += 1) {
          const speedFactor = 0.6 + ring * 0.22;
          for (let i = 0; i < spokes; i += 1) {
            const stem = (Math.PI * 2 * i) / spokes + rand(-0.05, 0.05);
            for (let j = 0; j < randInt(2, 4); j += 1) {
              const angle = stem + rand(-0.075, 0.075);
              const speed = basePower * speedFactor * rand(0.78, 1.1);
              emit(angle, speed, {
                size: rand(1, 3) * Math.min(1.35, sizeScale),
                ttl: rand(1.1, 2.1),
                drag: rand(0.918, 0.968),
                trail: rand(0.95, 1.9),
              });
            }
          }
        }
        return;
      }

      if (style === 'willow') {
        const count = Math.max(18, Math.round(baseCount * 0.72));
        for (let i = 0; i < count; i += 1) {
          const angle = rand(0, Math.PI * 2);
          const speed = basePower * rand(0.3, 0.78);
          emit(angle, speed, {
            gravity: baseGravity * rand(1.15, 1.5),
            size: rand(1.2, 3.1) * Math.min(1.55, sizeScale),
            ttl: rand(1.5, 2.8),
            drag: rand(0.938, 0.982),
            trail: rand(1.6, 2.9),
            alpha: rand(0.62, 0.9),
            sat: randInt(62, 95),
            light: randInt(50, 70),
          });
        }
        return;
      }

      if (style === 'strobe') {
        const count = Math.max(24, Math.round(baseCount * 1.25));
        for (let i = 0; i < count; i += 1) {
          const angle = rand(0, Math.PI * 2);
          const speed = basePower * rand(0.36, 1.04);
          emit(angle, speed, {
            size: rand(0.9, 2.1) * Math.min(1.35, sizeScale),
            ttl: rand(0.58, 1.08),
            drag: rand(0.88, 0.93),
            trail: rand(0.45, 1.1),
            twinkle: rand(1.4, 3.3),
            alpha: rand(0.72, 1),
          });
        }
        return;
      }

      if (style === 'double') {
        spawnBurst(x, y, { style: 'ring', sizeScale, addCore });
        scheduleBurst(randInt(80, 170), () => {
          spawnBurst(x + rand(-14, 14), y + rand(-12, 12), {
            style: BURST_STYLES[randInt(0, BURST_STYLES.length - 2)],
            sizeScale: Math.max(0.55, sizeScale * rand(0.52, 0.78)),
            addCore: true,
          });
        });
        return;
      }

      for (let i = 0; i < baseCount; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const distanceScale = Math.pow(Math.random(), 0.42);
        const speed = basePower * (0.42 + distanceScale);
        emit(angle, speed, {
          size: rand(1.15, 3.45) * Math.min(1.45, sizeScale),
          ttl: rand(0.95, 1.95),
          drag: rand(0.9, 0.965),
          trail: rand(0.75, 1.85),
        });
      }
    };

    const stop = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    };

    const frame = (ts) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const lifeRatio = Math.max(0, p.life / p.ttl);
        const prevX = p.x;
        const prevY = p.y;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const alpha = Math.max(0, lifeRatio * p.alpha * (0.7 + Math.sin(ts * 0.015 * p.twinkle) * 0.3));
        if (alpha <= 0) continue;

        ctx.strokeStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha * 0.55})`;
        ctx.lineWidth = Math.max(0.6, p.size * p.trail * lifeRatio);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${Math.min(92, p.light + 14)}%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * lifeRatio), 0, Math.PI * 2);
        ctx.fill();
      }

      if (!particles.length && ts > activeUntil) {
        stop();
        return;
      }
      rafId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (rafId != null) return;
      lastTs = 0;
      rafId = requestAnimationFrame(frame);
    };

    const launch = () => {
      resize();
      if (canvas.parentElement && canvas.parentElement.lastElementChild !== canvas) {
        canvas.parentElement.appendChild(canvas);
      }
      const waveCount = randInt(2, 6);
      const now = nowMs();
      activeUntil = Math.max(activeUntil, now + 2700);

      for (let i = 0; i < waveCount; i += 1) {
        const delay = i * randInt(90, 240) + randInt(0, 180);
        const burstStyle = BURST_STYLES[randInt(0, BURST_STYLES.length - 1)];
        const burstScale = rand(0.62, 2.18);
        scheduleBurst(delay, () => {
          const x = rand(width * 0.12, width * 0.88);
          const y = rand(height * 0.08, height * (0.54 - Math.min(0.18, burstScale * 0.06)));
          spawnBurst(x, y, { style: burstStyle, sizeScale: burstScale, addCore: true });
          activeUntil = Math.max(activeUntil, nowMs() + 2050 + burstScale * 320);
          start();
        });
      }

      if (Math.random() < 0.35) {
        scheduleBurst(randInt(420, 760), () => {
          const centerX = rand(width * 0.3, width * 0.7);
          const centerY = rand(height * 0.12, height * 0.3);
          spawnBurst(centerX, centerY, { style: 'double', sizeScale: rand(1.45, 2.3), addCore: true });
          activeUntil = Math.max(activeUntil, nowMs() + 2500);
          start();
        });
      }

      start();
    };

    const destroy = () => {
      stop();
      pendingTimers.forEach(timerId => clearTimeout(timerId));
      pendingTimers.clear();
      window.removeEventListener('resize', resize);
      canvas.remove();
    };

    window.addEventListener('resize', resize);
    resize();

    return {
      launch,
      destroy,
    };
  }

  function ensureFireworksEngine() {
    if (!fireworksEngine) fireworksEngine = createFireworksEngine();
    return fireworksEngine;
  }

  function triggerFireworks() {
    const engine = ensureFireworksEngine();
    if (!engine) return;
    engine.launch();
    if (!fireworksBtn) return;
    fireworksBtn.classList.add('bn-active');
    if (fireworksActiveTimer) clearTimeout(fireworksActiveTimer);
    fireworksActiveTimer = setTimeout(() => {
      fireworksBtn?.classList.remove('bn-active');
      fireworksActiveTimer = null;
    }, 320);
  }

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

  const initialCorner = configCenter.layout.corner;
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
  const chkContestDownload = document.getElementById('bn-enable-contest-download');
  const chkContestReview = document.getElementById('bn-enable-contest-review');
  const chkShowNickname = document.getElementById('bn-show-user-nickname');

  const chkMenu = document.getElementById('bn-enable-user-menu');
  let chkTemplateBulkAdd = document.getElementById('bn-enable-template-bulk-add');
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

  if (!chkTemplateBulkAdd) {
    const displaySection = chkTitleOpt?.closest('.bn-section');
    const anchorLabel = chkTitleOpt?.closest('label');
    const label = document.createElement('label');
    label.innerHTML = '<input type="checkbox" id="bn-enable-template-bulk-add" /> 启用一键添加所有模板按钮';
    if (anchorLabel && anchorLabel.parentElement) {
      anchorLabel.parentElement.insertBefore(label, anchorLabel.nextSibling);
      chkTemplateBulkAdd = label.querySelector('input');
    } else if (displaySection) {
      displaySection.appendChild(label);
      chkTemplateBulkAdd = label.querySelector('input');
    }
  }

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
  chkContestDownload.checked = enableContestDownloadButtons;
  chkContestReview.checked = enableContestReviewButtons;
  chkShowNickname.checked = showUserNickname;
  chkMenu.checked = enableMenu;
  if (chkTemplateBulkAdd) chkTemplateBulkAdd.checked = enableTemplateBulkAdd;
  chkAutoRenew.checked = enableAutoRenew;
  chkRankingFilter.checked = enableRankingFilterSetting;
  if (chkColumnSwitch) chkColumnSwitch.checked = enableColumnSwitchSetting;
  if (chkMergeAssistant) chkMergeAssistant.checked = enableMergeAssistantSetting;

  chkUseColor.checked = useCustomColors;

  chkVj.checked = enableVjLink;
  chkHideDoneSkip.checked = hideDoneSkip;
  chkQuickSkip.checked = enableQuickSkip;
  chkTitleOpt.checked = enableTitleOptimization;
  if (bgOpacityValueSpan) bgOpacityValueSpan.textContent = formatOpacityText(normalizedBgOpacity);
  if (bgBlurInput && bgBlurValueSpan) {
    bgBlurInput.value = normalizedBgBlur;
    bgBlurValueSpan.textContent = formatBlurText(normalizedBgBlur);
  }

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
    enableContestDownloadButtons,
    enableContestReviewButtons,
    showUserNickname,
    enableMenu,
    enablePlanAdder,
    enableTemplateBulkAdd,
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
    bgBlur: normalizedBgBlur,
    btEnabled: btEnabled,
    btInterval: storedBtInterval
  };
  currentBgSourceType = originalConfig.bgSourceType;
  currentBgImageData = originalConfig.bgImageData;
  currentBgImageDataName = originalConfig.bgImageDataName;

  if (!enableGuard) {
    disableNeedWarn();
  }

  function createPanelWakeController() {
    const reasons = Object.freeze({
      PIN: 'pin',
      TRIGGER: 'hover:trigger',
      PANEL: 'hover:panel',
      BRIDGE: 'hover:bridge',
      FOCUS: 'focus',
    });
    const PANEL_HIDE_DELAY = 300;
    const HOVER_SUPPRESS_MS = 600;
    const DRAG_HOVER_SUPPRESS_MS = 260;
    const HOVER_BRIDGE_PADDING = 2;
    const HOVER_BRIDGE_GAP_MAX = 24;
    const wakeReasons = new Set();

    let pointerMovedSinceLoad = false;
    let lastPointerClientX = null;
    let lastPointerClientY = null;
    const nowTs = () => {
      if (typeof performance !== 'undefined' && performance.now) return performance.now();
      return Date.now();
    };
    const hoverSuppressUntil = nowTs() + HOVER_SUPPRESS_MS;
    window.addEventListener('pointermove', (event) => {
      pointerMovedSinceLoad = true;
      if (!event) return;
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      lastPointerClientX = event.clientX;
      lastPointerClientY = event.clientY;
    }, { passive: true });

    let hideTimer = null;
    let initialRevealPending = true;
    let initialRevealFrame = null;
    let hoverWakeBlockedUntil = 0;

    const isHoverWakeBlocked = () => nowTs() < hoverWakeBlockedUntil;
    const canHonorHoverWake = () => pointerMovedSinceLoad && nowTs() >= hoverSuppressUntil && !isHoverWakeBlocked();
    const shouldRevealPanel = () => pinned || wakeReasons.size > 0;
    const cancelPendingReveal = () => {
      if (initialRevealFrame != null) {
        cancelAnimationFrame(initialRevealFrame);
        initialRevealFrame = null;
      }
    };
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

    const isPointerInHoverBridge = () => {
      if (!Number.isFinite(lastPointerClientX) || !Number.isFinite(lastPointerClientY)) return false;
      let panelRect;
      let triggerRect;
      try {
        panelRect = panel.getBoundingClientRect();
        triggerRect = trigger.getBoundingClientRect();
      } catch (_) {
        return false;
      }
      if (!panelRect || !triggerRect) return false;
      const px = lastPointerClientX;
      const py = lastPointerClientY;

      const overlapLeft = Math.max(panelRect.left, triggerRect.left) - HOVER_BRIDGE_PADDING;
      const overlapRight = Math.min(panelRect.right, triggerRect.right) + HOVER_BRIDGE_PADDING;
      if (overlapRight <= overlapLeft) return false;
      if (px < overlapLeft || px > overlapRight) return false;

      const panelAboveGap = triggerRect.top - panelRect.bottom;
      if (panelAboveGap > 0 && panelAboveGap <= HOVER_BRIDGE_GAP_MAX) {
        const bridgeTop = panelRect.bottom - HOVER_BRIDGE_PADDING;
        const bridgeBottom = triggerRect.top + HOVER_BRIDGE_PADDING;
        return py >= bridgeTop && py <= bridgeBottom;
      }

      const panelBelowGap = panelRect.top - triggerRect.bottom;
      if (panelBelowGap > 0 && panelBelowGap <= HOVER_BRIDGE_GAP_MAX) {
        const bridgeTop = triggerRect.bottom - HOVER_BRIDGE_PADDING;
        const bridgeBottom = panelRect.top + HOVER_BRIDGE_PADDING;
        return py >= bridgeTop && py <= bridgeBottom;
      }

      return false;
    };

    const detectHoverReason = () => {
      if (isDragging || container.classList.contains('bn-dragging') || isHoverWakeBlocked()) return null;
      try {
        if (panel.matches(':hover')) return reasons.PANEL;
        if (trigger.matches(':hover')) return reasons.TRIGGER;
        if (isPointerInHoverBridge()) return reasons.BRIDGE;
      } catch (_) { /* ignore */ }
      return null;
    };

    const requestWake = (reason) => {
      if ((isDragging || container.classList.contains('bn-dragging')) && reason !== reasons.PIN) return;
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
          if (hoverReason === reasons.BRIDGE) {
            scheduleHide();
            return;
          }
          if (canHonorHoverWake()) requestWake(hoverReason);
          return;
        }
        const activeElement = document.activeElement;
        if (activeElement && container.contains(activeElement)) {
          if (panel.classList.contains('bn-show') || canHonorHoverWake()) {
            requestWake(reasons.FOCUS);
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
        if (isDragging || container.classList.contains('bn-dragging')) return;
        if (!canHonorHoverWake()) return;
        requestWake(reason);
      });
      element.addEventListener('mouseleave', () => releaseWake(reason));
    };

    const syncPinnedState = () => {
      pinBtn.classList.toggle('bn-pinned', pinned);
      if (pinned) requestWake(reasons.PIN);
      else releaseWake(reasons.PIN);
    };

    const toggleFromTrigger = () => {
      if (panel.classList.contains('bn-show')) {
        releaseWake(reasons.TRIGGER);
        hidePanel();
        return;
      }
      requestWake(reasons.TRIGGER);
      showPanel();
    };

    const onFocusIn = () => {
      if (!panel.classList.contains('bn-show') && !canHonorHoverWake()) return;
      requestWake(reasons.FOCUS);
    };

    const onFocusOut = (event) => {
      const next = event.relatedTarget;
      if (next && container.contains(next)) return;
      releaseWake(reasons.FOCUS);
    };

    const onDragStart = () => {
      hoverWakeBlockedUntil = Number.POSITIVE_INFINITY;
      wakeReasons.delete(reasons.TRIGGER);
      wakeReasons.delete(reasons.PANEL);
      wakeReasons.delete(reasons.FOCUS);
      cancelPendingReveal();
      cancelHide();
      if (!pinned) panel.classList.remove('bn-show');
      updateContainerState();
    };

    const onDragEnd = () => {
      hoverWakeBlockedUntil = nowTs() + DRAG_HOVER_SUPPRESS_MS;
      wakeReasons.delete(reasons.TRIGGER);
      wakeReasons.delete(reasons.PANEL);
      wakeReasons.delete(reasons.FOCUS);
      if (pinned) requestWake(reasons.PIN);
      else panel.classList.remove('bn-show');
      updateContainerState();
    };

    return {
      reasons,
      attachHoverWake,
      syncPinnedState,
      toggleFromTrigger,
      onFocusIn,
      onFocusOut,
      onDragStart,
      onDragEnd,
    };
  }

  const wakeController = createPanelWakeController();
  wakeController.syncPinnedState();
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

  wakeController.attachHoverWake(trigger, wakeController.reasons.TRIGGER);
  wakeController.attachHoverWake(panel, wakeController.reasons.PANEL);
  trigger.addEventListener('click', (event) => {
    if (isDragging || container.classList.contains('bn-dragging')) return;
    if (__bn_nowMs() < __bn_suppressTriggerClickUntil) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    wakeController.toggleFromTrigger();
  });
  container.addEventListener('focusin', wakeController.onFocusIn);
  container.addEventListener('focusout', wakeController.onFocusOut);

  function __bn_applyTransform(x, y) {
    __bn_dragX = x; __bn_dragY = y;
    trigger.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  function __bn_dragLeft(clientX) {
    return clientX - __bn_dragOffsetX;
  }
  function __bn_dragTop(clientY) {
    return clientY - __bn_dragOffsetY;
  }
  function __bn_cancelDragRaf() {
    if (__bn_dragRafId !== null) {
      cancelAnimationFrame(__bn_dragRafId);
      __bn_dragRafId = null;
    }
  }
  function __bn_cancelSnapRaf() {
    if (__bn_snapRafId !== null) {
      cancelAnimationFrame(__bn_snapRafId);
      __bn_snapRafId = null;
    }
  }
  function __bn_clearSettleState() {
    if (__bn_settleTimer !== null) {
      clearTimeout(__bn_settleTimer);
      __bn_settleTimer = null;
    }
    container.classList.remove('bn-drag-settling');
  }
  function __bn_scheduleDragApply(clientX, clientY) {
    __bn_dragPendingX = clientX;
    __bn_dragPendingY = clientY;
    if (__bn_dragRafId !== null) return;
    __bn_dragRafId = requestAnimationFrame(() => {
      __bn_dragRafId = null;
      if (!isDragging) return;
      __bn_applyTransform(__bn_dragLeft(__bn_dragPendingX), __bn_dragTop(__bn_dragPendingY));
    });
  }
  function __bn_detachDragListeners() {
    document.removeEventListener('pointermove', __bn_onPointerMove);
    document.removeEventListener('pointerup', __bn_onPointerUp);
    document.removeEventListener('pointercancel', __bn_onPointerCancel);
    document.removeEventListener('mousemove', __bn_onMouseMove);
    document.removeEventListener('mouseup', __bn_onMouseUp);
    trigger.removeEventListener('lostpointercapture', __bn_onLostPointerCapture);
  }
  function __bn_cleanupPointer() {
    dragPending = false;
    __bn_cancelDragRaf();
    __bn_cancelSnapRaf();
    __bn_detachDragListeners();
    if (__bn_pointerMode === 'pointer' && __bn_pointerId !== null && trigger.releasePointerCapture) {
      try { trigger.releasePointerCapture(__bn_pointerId); } catch (_) { }
    }
    __bn_pointerId = null;
    __bn_pointerMode = null;
  }
  function __bn_beginDrag(clientX, clientY) {
    dragPending = false;
    isDragging = true;
    __bn_clearSettleState();
    wakeController.onDragStart();
    panel.classList.remove('bn-show');

    const rect = trigger.getBoundingClientRect();
    gearW = rect.width; gearH = rect.height;
    __bn_dragOffsetX = Math.max(0, Math.min(gearW, __bn_dragOffsetX));
    __bn_dragOffsetY = Math.max(0, Math.min(gearH, __bn_dragOffsetY));
    trigger.style.position = 'fixed';
    trigger.style.left = '0px'; trigger.style.top = '0px';
    trigger.style.bottom = 'auto'; trigger.style.right = 'auto';
    trigger.style.transition = 'none';
    trigger.style.willChange = 'transform';
    trigger.style.touchAction = 'none';

    container.classList.add('bn-dragging');
    updateContainerState();

    __bn_applyTransform(__bn_dragLeft(clientX), __bn_dragTop(clientY));
  }
  function __bn_findNearestCorner() {
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
      const p = corners[k];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = k;
      }
    }
    return { best, corners };
  }
  function __bn_finalizeDragCorner(best) {
    // Prevent visual jump while switching from fixed drag state back to anchored layout.
    trigger.style.transition = 'none';
    applyCorner(best);

    trigger.style.position = '';
    trigger.style.left = trigger.style.top = '';
    trigger.style.bottom = trigger.style.right = '';
    trigger.style.transform = '';
    trigger.style.touchAction = '';
    trigger.style.willChange = '';
    container.classList.remove('bn-dragging');
    container.classList.add('bn-drag-settling');
    __bn_settleTimer = setTimeout(() => {
      __bn_settleTimer = null;
      if (!isDragging) trigger.style.transition = '';
      container.classList.remove('bn-drag-settling');
    }, 180);
    wakeController.onDragEnd();
    __bn_cleanupPointer();
  }
  function __bn_completeDrag() {
    if (dragPending) {
      __bn_cleanupPointer();
      return;
    }
    if (!isDragging) {
      __bn_cleanupPointer();
      return;
    }
    isDragging = false;
    __bn_suppressTriggerClickUntil = __bn_nowMs() + 320;
    const { best, corners } = __bn_findNearestCorner();
    const fromX = __bn_dragX;
    const fromY = __bn_dragY;
    let toX = fromX;
    let toY = fromY;
    if (corners && corners[best]) {
      toX = corners[best].x - gearW / 2;
      toY = corners[best].y - gearH / 2;
    }
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);

    if (!Number.isFinite(dist) || dist < 2) {
      __bn_applyTransform(toX, toY);
      __bn_finalizeDragCorner(best);
      return;
    }

    // Quadratic-bezier snap path so the trigger returns along a parabola instead of a straight line.
    const side = (best === 'tl' || best === 'br') ? -1 : 1;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const arc = Math.max(18, Math.min(72, dist * 0.2));
    const ctrlX = (fromX + toX) * 0.5 + perpX * arc * side;
    const ctrlY = (fromY + toY) * 0.5 + perpY * arc * side;
    const bezierAt = (t) => {
      const it = 1 - t;
      return {
        x: it * it * fromX + 2 * it * t * ctrlX + t * t * toX,
        y: it * it * fromY + 2 * it * t * ctrlY + t * t * toY,
      };
    };
    const steps = Math.max(20, Math.min(72, Math.ceil(dist / 7)));
    const points = [];
    const lengths = [0];
    let totalLen = 0;
    for (let i = 0; i <= steps; i++) {
      const p = bezierAt(i / steps);
      points.push(p);
      if (i > 0) {
        const prev = points[i - 1];
        totalLen += Math.hypot(p.x - prev.x, p.y - prev.y);
        lengths.push(totalLen);
      }
    }
    if (!Number.isFinite(totalLen) || totalLen < 1) {
      __bn_applyTransform(toX, toY);
      __bn_finalizeDragCorner(best);
      return;
    }
    const speedPxPerMs = 1.9;
    const duration = Math.max(150, Math.min(320, totalLen / speedPxPerMs));
    const start = __bn_nowMs();

    __bn_cancelSnapRaf();
    const tick = () => {
      const elapsed = __bn_nowMs() - start;
      const targetLen = Math.min(totalLen, (elapsed / duration) * totalLen);
      if (targetLen >= totalLen) {
        __bn_snapRafId = null;
        __bn_applyTransform(toX, toY);
        __bn_finalizeDragCorner(best);
        return;
      }
      let hi = lengths.length - 1;
      let lo = 0;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (lengths[mid] < targetLen) lo = mid + 1;
        else hi = mid;
      }
      const idx = Math.max(1, lo);
      const segStart = lengths[idx - 1];
      const segEnd = lengths[idx];
      const segSpan = Math.max(1e-6, segEnd - segStart);
      const r = (targetLen - segStart) / segSpan;
      const a = points[idx - 1];
      const b = points[idx];
      const x = a.x + (b.x - a.x) * r;
      const y = a.y + (b.y - a.y) * r;
      __bn_applyTransform(x, y);
      __bn_snapRafId = requestAnimationFrame(tick);
    };
    __bn_snapRafId = requestAnimationFrame(tick);
  }
  function __bn_onMove(clientX, clientY) {
    if (dragPending) {
      const dx = clientX - dragStartX;
      const dy = clientY - dragStartY;
      if ((dx * dx + dy * dy) >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        __bn_beginDrag(clientX, clientY);
      } else {
        return;
      }
    }
    if (!isDragging) return;
    __bn_scheduleDragApply(clientX, clientY);
  }
  function __bn_onPointerMove(e) {
    if (__bn_pointerId !== null && e.pointerId !== __bn_pointerId) return;
    __bn_onMove(e.clientX, e.clientY);
  }
  function __bn_onMouseMove(e) {
    __bn_onMove(e.clientX, e.clientY);
  }
  function __bn_onPointerUp(e) {
    if (__bn_pointerId !== null && e.pointerId !== __bn_pointerId) return;
    if (isDragging) {
      __bn_cancelDragRaf();
      __bn_applyTransform(__bn_dragLeft(e.clientX), __bn_dragTop(e.clientY));
    }
    __bn_completeDrag();
  }
  function __bn_onMouseUp(e) {
    if (isDragging) {
      __bn_cancelDragRaf();
      __bn_applyTransform(__bn_dragLeft(e.clientX), __bn_dragTop(e.clientY));
    }
    __bn_completeDrag();
  }
  function __bn_onPointerCancel(e) {
    if (__bn_pointerId !== null && e.pointerId !== __bn_pointerId) return;
    __bn_completeDrag();
  }
  function __bn_onLostPointerCapture(e) {
    if (__bn_pointerId !== null && e.pointerId !== __bn_pointerId) return;
    if (!dragPending && !isDragging) return;
    __bn_completeDrag();
  }
  const __bn_onDown = (e) => {
    if (container.classList.contains('bn-dragging')) return;
    if (e.type === 'mousedown' && window.PointerEvent) return;
    if ((e.type === 'mousedown' || e.type === 'pointerdown') && e.button !== 0) return;
    if (e.type === 'pointerdown' && e.isPrimary === false) return;
    e.preventDefault();

    dragPending = true;
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const downRect = trigger.getBoundingClientRect();
    __bn_dragOffsetX = e.clientX - downRect.left;
    __bn_dragOffsetY = e.clientY - downRect.top;
    __bn_dragOffsetX = Math.max(0, Math.min(downRect.width || gearW, __bn_dragOffsetX));
    __bn_dragOffsetY = Math.max(0, Math.min(downRect.height || gearH, __bn_dragOffsetY));

    if (e.pointerId != null) {
      __bn_pointerMode = 'pointer';
      __bn_pointerId = e.pointerId;
      trigger.addEventListener('lostpointercapture', __bn_onLostPointerCapture);
      if (trigger.setPointerCapture) {
        try { trigger.setPointerCapture(e.pointerId); } catch (_) { }
      }
      document.addEventListener('pointermove', __bn_onPointerMove);
      document.addEventListener('pointerup', __bn_onPointerUp);
      document.addEventListener('pointercancel', __bn_onPointerCancel);
      return;
    }
    __bn_pointerMode = 'mouse';
    __bn_pointerId = null;
    document.addEventListener('mousemove', __bn_onMouseMove);
    document.addEventListener('mouseup', __bn_onMouseUp);
  };
  if (window.PointerEvent) {
    trigger.addEventListener('pointerdown', __bn_onDown, { passive: false });
  } else {
    trigger.addEventListener('mousedown', __bn_onDown, { passive: false });
  }

  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    GM_setValue('panelPinned', pinned);
    wakeController.syncPinnedState();
    updateContainerState();
  });
  if (fireworksBtn) {
    const launchFromFireworksButton = (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      triggerFireworks();
    };
    fireworksBtn.addEventListener('click', launchFromFireworksButton);
    fireworksBtn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      launchFromFireworksButton(event);
    });
  }
  window.addEventListener('pagehide', () => {
    if (!fireworksEngine) return;
    fireworksEngine.destroy();
    fireworksEngine = null;
  }, { once: true });

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
    const currentBgBlur = bgBlurInput ? bgBlurInput.value : originalConfig.bgBlur;
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
    const currentBtEnabled = getHiToiletEnabledState();
    const templateBulkAddChk = document.getElementById('bn-enable-template-bulk-add');

    const changed =
      (document.getElementById('bn-enable-title-truncate').checked !== originalConfig.titleTruncate) ||
      (document.getElementById('bn-enable-user-truncate').checked !== originalConfig.userTruncate) ||
      (document.getElementById('bn-enable-title-truncate').checked && ti !== originalConfig.maxTitleUnits) ||
      (document.getElementById('bn-enable-user-truncate').checked && ui !== originalConfig.maxUserUnits) ||
      (document.getElementById('bn-hide-avatar').checked !== originalConfig.hideAvatar) ||
      (document.getElementById('bn-enable-copy').checked !== originalConfig.enableCopy) ||
      (document.getElementById('bn-enable-desc-copy').checked !== originalConfig.enableDescCopy) ||
      (document.getElementById('bn-hide-orig').checked !== originalConfig.hideOrig) ||
      (document.getElementById('bn-enable-contest-download').checked !== originalConfig.enableContestDownloadButtons) ||
      (document.getElementById('bn-enable-contest-review').checked !== originalConfig.enableContestReviewButtons) ||
      (document.getElementById('bn-show-user-nickname').checked !== originalConfig.showUserNickname) ||
      (document.getElementById('bn-enable-user-menu').checked !== originalConfig.enableMenu) ||
      ((templateBulkAddChk ? templateBulkAddChk.checked : originalConfig.enableTemplateBulkAdd) !== originalConfig.enableTemplateBulkAdd) ||
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
      (clampBlur(currentBgBlur) !== clampBlur(originalConfig.bgBlur)) ||
      (currentBtEnabled !== originalConfig.btEnabled) ||
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
  chkContestDownload.onchange = checkChanged;
  chkContestReview.onchange = checkChanged;
  chkShowNickname.onchange = checkChanged;
  chkMenu.onchange = checkChanged;
  chkVj.onchange = checkChanged;
  chkHideDoneSkip.onchange = () => { applyHideDoneSkip(chkHideDoneSkip.checked); checkChanged(); };
  chkQuickSkip.onchange = () => { applyQuickSkip(chkQuickSkip.checked); checkChanged(); };
  chkTitleOpt.onchange = checkChanged;
  if (chkTemplateBulkAdd) {
    chkTemplateBulkAdd.onchange = () => {
      applyTemplateBulkAddButton(chkTemplateBulkAdd.checked);
      scheduleTemplateBulkButton(chkTemplateBulkAdd.checked);
      checkChanged();
    };
  }
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
    GM_setValue('enableContestDownloadButtons', chkContestDownload.checked);
    GM_setValue('enableContestReviewButtons', chkContestReview.checked);
    GM_setValue('showUserNickname', chkShowNickname.checked);
    GM_setValue('hideDoneSkip', chkHideDoneSkip.checked);
    GM_setValue('enableQuickSkip', chkQuickSkip.checked);
    GM_setValue('enableTitleOptimization', chkTitleOpt.checked);
    GM_setValue('enableUserMenu', chkMenu.checked);
    GM_setValue('enableVjLink', chkVj.checked);
    GM_setValue('enablePlanAdder', true);
    GM_setValue('enableTemplateBulkAdd', chkTemplateBulkAdd ? chkTemplateBulkAdd.checked : enableTemplateBulkAdd);
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
    const bgBlurRaw = bgBlurInput ? bgBlurInput.value : normalizedBgBlur;
    const bgOpacity = String(clampOpacity(bgOpacityRaw));
    const bgBlur = clampBlur(bgBlurRaw);
    const btEnabled = getHiToiletEnabledState();
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
    debugLog('Saved bg fillway', bgfillway);
    GM_setValue('bg_imageSourceType', bgImageSourceType);
    GM_setValue('bg_imageUrl', bgImageUrlToSave);
    GM_setValue('bg_imageData', bgImageDataToSave);
    GM_setValue('bg_imageDataName', bgImageDataNameToSave);
    GM_setValue('bg_opacity', bgOpacity);
    GM_setValue('bg_blur', bgBlur);
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
    originalConfig.bgBlur = bgBlur;
    currentBgSourceType = bgImageSourceType;
    currentBgImageData = bgImageDataToSave;
    currentBgImageDataName = bgImageDataNameToSave;

    updateBgSourceUI();
    applyBackgroundOverlay(bgEnabled,bgfillway, overlaySource, bgOpacity, bgBlur);
    if (bgOpacityInput) bgOpacityInput.value = bgOpacity;
    if (bgOpacityValueSpan) bgOpacityValueSpan.textContent = formatOpacityText(bgOpacity);
    if (bgBlurInput) bgBlurInput.value = bgBlur;
    if (bgBlurValueSpan) bgBlurValueSpan.textContent = formatBlurText(bgBlur);

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
    chkContestDownload.checked = originalConfig.enableContestDownloadButtons;
    chkContestReview.checked = originalConfig.enableContestReviewButtons;
    chkShowNickname.checked = originalConfig.showUserNickname;
    chkMenu.checked = originalConfig.enableMenu;
    chkVj.checked = originalConfig.enableVjLink;
    chkHideDoneSkip.checked = originalConfig.hideDoneSkip;
    applyHideDoneSkip(originalConfig.hideDoneSkip);
    chkQuickSkip.checked = originalConfig.enableQuickSkip;
    applyQuickSkip(originalConfig.enableQuickSkip);
    chkTitleOpt.checked = originalConfig.enableTitleOptimization;
    if (chkTemplateBulkAdd) chkTemplateBulkAdd.checked = originalConfig.enableTemplateBulkAdd;
    const bulkEnabled = chkTemplateBulkAdd ? chkTemplateBulkAdd.checked : originalConfig.enableTemplateBulkAdd;
    applyTemplateBulkAddButton(bulkEnabled);
    scheduleTemplateBulkButton(bulkEnabled);
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
    if (bgBlurInput) bgBlurInput.value = originalConfig.bgBlur;
    if (bgBlurValueSpan) bgBlurValueSpan.textContent = formatBlurText(originalConfig.bgBlur);
    updateBgSourceUI();
    const restoreSource = (originalConfig.bgSourceType === 'local' && originalConfig.bgImageData)
      ? originalConfig.bgImageData
      : originalConfig.bgImageUrl;
    applyBackgroundOverlay(originalConfig.bgEnabled,originalConfig.bgfillway, restoreSource, originalConfig.bgOpacity, originalConfig.bgBlur);
    checkChanged();
  }
  restoreOriginalConfig();
  document.getElementById('bn-cancel-changes').onclick = () => {
    restoreOriginalConfig();
  };

  if (bgEnabledInput && bgOpacityInput && bgOpacityValueSpan) {
    const updateBackgroundPreview = () => {
      bgOpacityValueSpan.textContent = formatOpacityText(bgOpacityInput.value);
      const blurValue = bgBlurInput ? bgBlurInput.value : normalizedBgBlur;
      if (bgBlurValueSpan) bgBlurValueSpan.textContent = formatBlurText(blurValue);
      applyBackgroundOverlay(bgEnabledInput.checked, bgfillwayInput.value,getEffectiveBackgroundUrl(), bgOpacityInput.value, blurValue);
      debugLog('Preview bg fillway change', bgfillwayInput.value);
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
    if (bgBlurInput) bgBlurInput.addEventListener('input', updateBackgroundPreview);
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
        if (data && data.err) debugLog('[BN] HiToilet:', data.err);
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
          debugLog('Loading submitters config from:', url);
          const response = await fetch(url, { cache: 'no-store' });
          if (response && response.ok) {
            const config = await response.json();
            debugLog('Successfully loaded submitters config');
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
          debugLog('Successfully loaded submitters config from relative path');
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
    const availableIds = new Set(config.submitters.map(submitter => submitter.id));
    const defaultSubmitterId = config.default || DEFAULT_SUBMITTER_ID;
    let initialSelection = storedSelectedSubmitter;
    if (!initialSelection) {
      initialSelection = defaultSubmitterId;
    }
    if (initialSelection !== 'none' && !availableIds.has(initialSelection)) {
      initialSelection = availableIds.has(defaultSubmitterId)
        ? defaultSubmitterId
        : (config.submitters[0]?.id || 'none');
    }
    select.value = initialSelection;
    updateSubmitterDescription(initialSelection);
    if (initialSelection !== storedSelectedSubmitter) {
      try { GM_setValue('selectedSubmitter', initialSelection); } catch (_) { /* ignore */ }
    }
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

  const USER_LINK_SELECTOR = 'a[href*="/user/"], a[href*="user_id="], a[href*="uid="]';
  const USER_ID_KEYS = ['user_id', 'userId', 'userID', 'uid', 'id'];

  function isLikelyUrlLabel(text, rawHref) {
    if (typeof text !== 'string') return false;
    const t = text.trim();
    if (!t) return false;
    const raw = typeof rawHref === 'string' ? rawHref.trim() : '';
    if (raw) {
      let decoded = '';
      try { decoded = decodeURIComponent(raw); } catch (_) { decoded = ''; }
      if (t === raw || (decoded && t === decoded)) return true;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return true;
    if (t.startsWith('//')) return true;
    if (/^www\./i.test(t)) return true;
    if (/\/user\/\d+/i.test(t)) return true;
    if (/[?&](?:user_id|userId|uid)=\d+/i.test(t)) return true;
    return false;
  }

  function isBareUserProfileHref(rawHref, uid) {
    if (!rawHref) return false;
    let pathname = '';
    try {
      const url = new URL(rawHref, location.href);
      pathname = url.pathname || '';
    } catch (_) {
      pathname = String(rawHref || '').split(/[?#]/)[0] || '';
      if (!pathname.startsWith('/')) pathname = '/' + pathname;
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 2) return false;
    if (segments[0] !== 'user') return false;
    if (!/^\d+$/.test(segments[1])) return false;
    return segments[1] === String(uid);
  }

  function resolveUidFromHref(href, el) {
    const pickDataset = (element) => {
      if (!element || !element.dataset) return null;
      for (const key of USER_ID_KEYS) {
        const k = key.replace(/[-_]/g, '');
        const value = element.dataset[k] || element.dataset[key];
        if (value && /^\d+$/.test(value)) return value;
      }
      return null;
    };
    const ds = pickDataset(el);
    if (ds) return ds;

    if (typeof href !== 'string') return null;
    const direct = href.trim();

    const directMatch = direct.match(/\/user\/(\d+)(?:[/?#].*)?$/);
    if (directMatch) return directMatch[1];

    const queryMatch = direct.match(/[?&#](?:user_id|userId|uid)=([0-9]+)/);
    if (queryMatch) return queryMatch[1];

    try {
      const url = new URL(direct, location.href);
      for (const key of USER_ID_KEYS) {
        const v = url.searchParams.get(key);
        if (v && /^\d+$/.test(v)) return v;
      }
      const pathMatch = url.pathname.match(/\/user\/(\d+)(?:\/.*)?$/);
      if (pathMatch) return pathMatch[1];
    } catch (_) {
      // ignore URL parse errors
    }

    const looseMatch = direct.match(/\/user\/(\d+)(?:[/?#]|$)/);
    return looseMatch ? looseMatch[1] : null;
  }

  function processUserLink(a) {
    if (!a || !a.matches(USER_LINK_SELECTOR)) return;

    const rawHref = a.getAttribute('href') || '';
    // Skip review actions; they are not user-name labels.
    if (/\/review\/user_tag/i.test(rawHref)) return;

    if (
      a.matches('#user-dropdown > a') ||
      a.matches('#user-dropdown > div > a:nth-child(1)') ||
      a.matches('body > div.ui.fixed.borderless.menu > div > div > a') ||
      a.matches('#form > div > div:nth-child(13) > a')
    ) return;

    const uid = resolveUidFromHref(rawHref, a);
    if (!uid) return;
    if (!markOnce(a, 'UserDone')) return;
    if (!isBareUserProfileHref(rawHref, uid)) return;
    const info = users[uid];
    if (info && GRADE_LABELS[info.colorKey]) a.setAttribute('title', GRADE_LABELS[info.colorKey]);

    let baseText = '';
    a.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) baseText += n.textContent; });
    baseText = baseText.trim();
    const defaultSource = baseText || (a.textContent || '').trim();
    if (isLikelyUrlLabel(defaultSource, rawHref)) return;
    const originalNickname = (showUserNickname && info) ? extractOriginalNickname(baseText) : '';

    const img = a.querySelector('img');
    if (img && hideAvatar) img.remove();

    a.querySelectorAll('.bn-icon').forEach(el => el.remove());
    a.querySelectorAll('.bn-user-tags').forEach(el => el.remove());

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

    // Prefer the problem code cell (usually wrapped in <b>) to anchor text to avoid
    // placing the skip column after the title when titles start with Latin letters.
    const codeCellIndex = cells.findIndex(td => {
      const bold = td.querySelector('b');
      if (!bold) return false;
      const text = (bold.textContent || '').trim();
      if (!text) return false;
      if (/^L/i.test(text)) return false;
      return /^[A-Za-z]/.test(text);
    });
    if (codeCellIndex > -1) computedIndex = codeCellIndex;

    if (computedIndex === null) {
      const anchorIndex = cells.findIndex(td => {
        const anchor = td.querySelector('a[href^="/problem/"]');
        if (!anchor || anchor.getAttribute('data-bn-quick-skip') === '1') return false;
        const text = (anchor.textContent || '').trim();
        if (!text) return false;
        if (/^L/i.test(text)) return false;
        if (!/[0-9]/.test(text)) return false; // titles with letters but no digits should not drive placement
        return /^[A-Za-z]/.test(text);
      });
      if (anchorIndex > -1) computedIndex = anchorIndex + 1;
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

  function scheduleTemplateBulkButton(enabled) {
    if (templateBulkRetryTimer) {
      clearTimeout(templateBulkRetryTimer);
      templateBulkRetryTimer = null;
    }
    if (!enabled) return;
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      const ok = applyTemplateBulkAddButton(true);
      if (ok || attempts >= 10) {
        templateBulkRetryTimer = null;
        return;
      }
      templateBulkRetryTimer = setTimeout(tick, 800);
    };
    tick();
  }

  function triggerAddAllTemplates() {
    try {
      if (typeof window.$ === 'function') {
        window.$('.plus.icon').click();
        return true;
      }
      const icons = document.querySelectorAll('.plus.icon');
      icons.forEach((icon) => {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        icon.dispatchEvent(evt);
      });
      return icons.length > 0;
    } catch (error) {
      console.warn('[BN] Failed to trigger bulk template add', error);
      return false;
    }
  }

  function findTemplateAnchor(scopeRoot) {
    const preciseSelector = 'body > div.pusher > div > div > div.padding > div.ui.grid > div > div.eight.wide.column > a.ui.mini.yellow.button';
    const candidates = [];
    const roots = [];
    if (scopeRoot) roots.push(scopeRoot);
    roots.push(document);
    for (const root of roots) {
      if (!root) continue;
      const precise = root.querySelector ? root.querySelector(preciseSelector) : null;
      if (precise) candidates.push(precise);
      if (root.matches && root.matches('a[href="/problems"].ui.mini.yellow.button')) candidates.push(root);
      if (root.querySelectorAll) {
        root.querySelectorAll('a[href="/problems"].ui.mini.yellow.button').forEach(a => candidates.push(a));
      }
    }
    const textMatched = candidates.find(a => /模板题/.test((a.textContent || '').trim()));
    return textMatched || candidates[0] || null;
  }

  function applyTemplateBulkAddButton(enabled, scopeRoot) {
    let exists = false;
    const existingBtn = document.getElementById('bn-add-all-templates');
    if (!enabled) {
      if (existingBtn) existingBtn.remove();
      return exists;
    }
    const anchor = findTemplateAnchor(scopeRoot);
    if (!anchor) {
      if (existingBtn) existingBtn.remove();
      return exists;
    }
    let btn = existingBtn;
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'bn-add-all-templates';
      btn.href = '#';
      btn.className = 'ui mini teal button';
      btn.style.marginLeft = '6px';
      btn.textContent = '添加所有模板';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const ok = triggerAddAllTemplates();
        if (!ok) debugLog('Bulk template add triggered but no .plus.icon found');
      });
    }
    if (btn.parentElement !== anchor.parentElement || anchor.nextElementSibling !== btn) {
      btn.remove();
      anchor.insertAdjacentElement('afterend', btn);
    }
    exists = true;
    return exists;
  }

  function setUpdateNoticeState(noticeEl, state) {
    if (!noticeEl) return;
    noticeEl.classList.remove(UPDATE_NOTICE_WARNING_CLASS, UPDATE_NOTICE_ERROR_CLASS);
    if (!state) return;
    const nextClass = state === 'error' ? UPDATE_NOTICE_ERROR_CLASS : UPDATE_NOTICE_WARNING_CLASS;
    noticeEl.classList.add(nextClass);
  }

  const JOIN_PLAN_DETAIL_TEXT = `加入 Better Names 计划将会把您的基本个人信息（姓名、班级、性别、用户名、邮箱、学校、座位、教练、电话号码）公开给也加入此项目的同学，所有加入此项目的人均可用 ./better_names 查看所有其他人的这些信息，以便 Better Names 的数据库更新。

您可前往【修改资料】-> 【加入 Better Names】加入该计划，加入后接下来 90 天内不可以取消。

我们强烈建议您参与此项目，因为此项目后续版本可能会禁止非计划内成员使用。`;
  const JOIN_PLAN_STATUS_CLASSES = ['bn-plan-status-loading', 'bn-plan-status-success', 'bn-plan-status-danger'];
  const JOIN_PLAN_MODAL_ANIMATION_MS = 230;
  let joinPlanModalScrollRestore = null;
  let joinPlanModalCloseTimer = null;
  let joinPlanModalOpenRaf = 0;

  function readElementPaddingRight(element) {
    if (!element || typeof window.getComputedStyle !== 'function') return 0;
    const raw = window.getComputedStyle(element).paddingRight;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function resolveViewportScrollbarWidth() {
    const docEl = document.documentElement;
    const viewportWidth = window.innerWidth || 0;
    const contentWidth = docEl ? docEl.clientWidth : 0;
    const scrollbarWidth = viewportWidth - contentWidth;
    if (!Number.isFinite(scrollbarWidth)) return 0;
    return Math.max(0, scrollbarWidth);
  }

  function lockJoinPlanModalScroll() {
    if (joinPlanModalScrollRestore) return;
    const docEl = document.documentElement;
    const bodyEl = document.body;
    const scrollbarWidth = resolveViewportScrollbarWidth();
    joinPlanModalScrollRestore = {
      docOverflow: docEl ? docEl.style.overflow : '',
      bodyOverflow: bodyEl ? bodyEl.style.overflow : '',
      bodyPaddingRight: bodyEl ? bodyEl.style.paddingRight : ''
    };
    if (docEl) docEl.style.overflow = 'hidden';
    if (bodyEl) {
      bodyEl.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        const currentPadding = readElementPaddingRight(bodyEl);
        bodyEl.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
      }
    }
  }

  function unlockJoinPlanModalScroll() {
    if (!joinPlanModalScrollRestore) return;
    const docEl = document.documentElement;
    const bodyEl = document.body;
    if (docEl) docEl.style.overflow = joinPlanModalScrollRestore.docOverflow || '';
    if (bodyEl) {
      bodyEl.style.overflow = joinPlanModalScrollRestore.bodyOverflow || '';
      bodyEl.style.paddingRight = joinPlanModalScrollRestore.bodyPaddingRight || '';
    }
    joinPlanModalScrollRestore = null;
  }

  function setJoinPlanStatus(kind, text) {
    if (!joinPlanStatusTextEl) return;
    joinPlanStatusTextEl.classList.remove(...JOIN_PLAN_STATUS_CLASSES);
    const nextClass = kind === 'success'
      ? 'bn-plan-status-success'
      : (kind === 'danger' ? 'bn-plan-status-danger' : 'bn-plan-status-loading');
    joinPlanStatusTextEl.classList.add(nextClass);
    joinPlanStatusTextEl.textContent = text;
  }

  function setJoinPlanDetailVisibility(showButton, showPanel) {
    if (joinPlanDetailBtnEl) {
      joinPlanDetailBtnEl.hidden = !showButton;
      if (!showButton) {
        closeJoinPlanDetailModal(false);
      }
    }
  }

  function setJoinPlanDetailContent(text) {
    if (!joinPlanModalBodyEl) return;
    joinPlanModalBodyEl.textContent = (typeof text === 'string' && text.trim())
      ? text.trim()
      : JOIN_PLAN_DETAIL_TEXT;
  }

  function closeJoinPlanDetailModal(returnFocus = true) {
    let unlockDelayed = false;
    if (joinPlanModalOpenRaf) {
      window.cancelAnimationFrame(joinPlanModalOpenRaf);
      joinPlanModalOpenRaf = 0;
    }
    if (joinPlanModalCloseTimer) {
      window.clearTimeout(joinPlanModalCloseTimer);
      joinPlanModalCloseTimer = null;
    }
    if (joinPlanModalEl) {
      const shouldAnimateClose = !joinPlanModalEl.hidden;
      joinPlanModalEl.classList.remove('is-open');
      if (shouldAnimateClose) {
        unlockDelayed = true;
        joinPlanModalEl.classList.add('is-closing');
        joinPlanModalCloseTimer = window.setTimeout(() => {
          if (!joinPlanModalEl) return;
          joinPlanModalEl.hidden = true;
          joinPlanModalEl.classList.remove('is-closing');
          joinPlanModalCloseTimer = null;
          unlockJoinPlanModalScroll();
        }, JOIN_PLAN_MODAL_ANIMATION_MS);
      } else {
        joinPlanModalEl.hidden = true;
        joinPlanModalEl.classList.remove('is-closing');
      }
    }
    if (joinPlanDetailBtnEl) joinPlanDetailBtnEl.setAttribute('aria-expanded', 'false');
    if (!unlockDelayed) {
      unlockJoinPlanModalScroll();
    }
    if (returnFocus && joinPlanDetailBtnEl && !joinPlanDetailBtnEl.hidden) {
      joinPlanDetailBtnEl.focus();
    }
  }

  function openJoinPlanDetailModal() {
    if (!joinPlanModalEl || !joinPlanDetailBtnEl || joinPlanDetailBtnEl.hidden) return;
    if (joinPlanModalCloseTimer) {
      window.clearTimeout(joinPlanModalCloseTimer);
      joinPlanModalCloseTimer = null;
    }
    if (joinPlanModalOpenRaf) {
      window.cancelAnimationFrame(joinPlanModalOpenRaf);
      joinPlanModalOpenRaf = 0;
    }
    joinPlanModalEl.hidden = false;
    joinPlanModalEl.classList.remove('is-closing');
    joinPlanModalEl.classList.remove('is-open');
    joinPlanModalOpenRaf = window.requestAnimationFrame(() => {
      if (!joinPlanModalEl) return;
      joinPlanModalEl.classList.add('is-open');
      joinPlanModalOpenRaf = 0;
    });
    joinPlanDetailBtnEl.setAttribute('aria-expanded', 'true');
    lockJoinPlanModalScroll();
    if (joinPlanModalCloseBtnEl) {
      joinPlanModalCloseBtnEl.focus();
    }
  }

  function bindJoinPlanDetailToggle() {
    if (!joinPlanDetailBtnEl || !joinPlanModalEl) return;
    joinPlanDetailBtnEl.addEventListener('click', () => {
      openJoinPlanDetailModal();
    });
    joinPlanModalCloseEls.forEach((el) => {
      el.addEventListener('click', closeJoinPlanDetailModal);
    });
    document.addEventListener('keydown', (event) => {
      if (!event || event.key !== 'Escape') return;
      if (joinPlanModalEl.hidden) return;
      closeJoinPlanDetailModal();
    });
  }

  function resolveCurrentUserIdForJoinPlan() {
    try {
      if (typeof window.getCurrentUserId === 'function') {
        const current = Number(window.getCurrentUserId());
        if (Number.isFinite(current) && current > 0) return current;
      }
    } catch (_) { /* ignore */ }

    const dropdown = document.querySelector('#user-dropdown');
    if (dropdown && dropdown.dataset) {
      const raw = dropdown.dataset.user_id
        || dropdown.dataset.userId
        || dropdown.getAttribute('data-user_id')
        || dropdown.getAttribute('data-user-id');
      if (raw && /^\d+$/.test(String(raw))) {
        const value = Number(raw);
        if (Number.isFinite(value) && value > 0) return value;
      }
    }

    const link = document.querySelector('#user-dropdown a[href^="/user/"]');
    if (link) {
      const match = (link.getAttribute('href') || '').match(/\/user\/(\d+)/);
      if (match) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > 0) return value;
      }
    }
    return NaN;
  }

  async function fetchBetterNamesUsers() {
    const fetchJsonWithTimeout = async (url, timeoutMs = 7000) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            url,
            method: 'GET',
            timeout: timeoutMs,
            headers: { 'Cache-Control': 'no-cache' },
            onload: (resp) => {
              if (!resp || resp.status < 200 || resp.status >= 300) {
                reject(new Error(`HTTP ${resp ? resp.status : '0'}`));
                return;
              }
              try {
                const payload = JSON.parse(resp.responseText || '');
                resolve(payload);
              } catch (_) {
                reject(new Error('Invalid JSON payload'));
              }
            },
            onerror: (err) => reject(new Error((err && err.error) || 'GM_xmlhttpRequest failed')),
            ontimeout: () => reject(new Error('Request timeout')),
          });
        });
      }

      const controller = (typeof AbortController === 'function') ? new AbortController() : null;
      let timeoutId = null;
      try {
        const opPromise = (async () => {
          const response = await fetch(url, {
            cache: 'no-store',
            credentials: 'include',
            signal: controller ? controller.signal : undefined
          });
          if (!response || !response.ok) {
            throw new Error(`HTTP ${response ? response.status : '0'}`);
          }
          const rawText = await response.text();
          let payload = null;
          try {
            payload = JSON.parse(rawText);
          } catch (_) {
            throw new Error('Invalid JSON payload');
          }
          return payload;
        })();
        const timeoutPromise = new Promise((_, rejectTimeout) => {
          timeoutId = window.setTimeout(() => {
            if (controller) {
              try { controller.abort(); } catch (_) { /* ignore */ }
            }
            rejectTimeout(new Error('Request timeout'));
          }, timeoutMs);
        });
        return await Promise.race([opPromise, timeoutPromise]);
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    const candidates = [];
    const seen = new Set();
    const pushCandidate = (value) => {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text || seen.has(text)) return;
      seen.add(text);
      candidates.push(text);
    };
    try { pushCandidate(new URL('./better_names', location.href).toString()); } catch (_) { /* ignore */ }
    try { pushCandidate(new URL('better_names', location.href).toString()); } catch (_) { /* ignore */ }
    try { pushCandidate(new URL('../better_names', location.href).toString()); } catch (_) { /* ignore */ }
    try { pushCandidate(new URL('/better_names', location.origin).toString()); } catch (_) { /* ignore */ }

    let lastError = null;
    for (const url of candidates) {
      try {
        const payload = await fetchJsonWithTimeout(url, 2500);
        if (!payload || typeof payload !== 'object') {
          lastError = new Error('Invalid payload');
          continue;
        }
        if (payload.success === false) {
          lastError = new Error('API returned success=false');
          continue;
        }
        return Array.isArray(payload.users) ? payload.users : [];
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  }

  function isUserInBetterNames(usersList, uid) {
    if (!Array.isArray(usersList) || !Number.isFinite(uid)) return false;
    return usersList.some((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const rawId = entry.id ?? entry.user_id ?? entry.uid;
      const parsed = Number(rawId);
      return Number.isFinite(parsed) && parsed === uid;
    });
  }

  async function refreshJoinPlanStatus() {
    if (!joinPlanStatusTextEl) return;
    setJoinPlanStatus('loading', '正在检查加入状态...');
    setJoinPlanDetailContent(JOIN_PLAN_DETAIL_TEXT);
    setJoinPlanDetailVisibility(false, false);

    const uid = resolveCurrentUserIdForJoinPlan();
    if (!Number.isFinite(uid) || uid <= 0) {
      setJoinPlanStatus('danger', '未识别当前用户，暂无法判断是否已加入');
      setJoinPlanDetailContent(JOIN_PLAN_DETAIL_TEXT);
      setJoinPlanDetailVisibility(true, false);
      return;
    }

    try {
      const usersList = await Promise.race([
        fetchBetterNamesUsers(),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Join status check timeout')), 9000);
        })
      ]);
      if (isUserInBetterNames(usersList, uid)) {
        setJoinPlanStatus('success', '你已加入 Better Names 计划');
        setJoinPlanDetailVisibility(false, false);
      } else {
        setJoinPlanStatus('danger', '你还未加入 Better Names 计划');
        setJoinPlanDetailContent(JOIN_PLAN_DETAIL_TEXT);
        setJoinPlanDetailVisibility(true, false);
      }
    } catch (error) {
      console.warn('[BN] Failed to check Better Names plan status', error);
      setJoinPlanStatus('danger', '你还未加入 Better Names 计划');
      setJoinPlanDetailContent(JOIN_PLAN_DETAIL_TEXT);
      setJoinPlanDetailVisibility(true, false);
    }
  }

  async function checkForPanelUpdates(noticeEl, remoteVersionEl) {
    const showManualSyncNotice = () => {
      if (!noticeEl) return;
      const copyEl = noticeEl.querySelector('.bn-update-copy');
      if (copyEl) copyEl.textContent = UPDATE_MANUAL_SYNC_MESSAGE;
      setUpdateNoticeState(noticeEl, 'error');
      noticeEl.classList.add('bn-visible');
      noticeEl.removeAttribute('hidden');
    };
    try {
      const remoteVersionInfo = await fetchRemotePanelVersion();
      if (!remoteVersionInfo) {
        showManualSyncNotice();
        return;
      }
      if (manifestVersionInfo) {
        const compareResult = compareParsedVersions(remoteVersionInfo, manifestVersionInfo);
        if (compareResult !== null && compareResult <= 0) return;
      } else if (remoteVersionInfo.display === manifestVersion) {
        return;
      }
      if (remoteVersionEl) remoteVersionEl.textContent = remoteVersionInfo.display;
      setUpdateNoticeState(noticeEl, 'warning');
      noticeEl.classList.add('bn-visible');
      noticeEl.removeAttribute('hidden');
    } catch (error) {
      console.warn('[BN] Failed to check panel updates', error);
      showManualSyncNotice();
    }
  }

  async function fetchRemotePanelVersion() {
    let lastError = null;
    for (const baseUrl of REMOTE_VERSION_URLS) {
      if (!baseUrl) continue;
      try {
        const rawText = await fetchRemotePanelVersionText(baseUrl);
        const parsed = parseComparableVersion(rawText);
        if (parsed) return parsed;
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
  bindJoinPlanDetailToggle();
  refreshJoinPlanStatus();
  // 初次遍历
  document.querySelectorAll(USER_LINK_SELECTOR).forEach(processUserLink);
  document.querySelectorAll('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span').forEach(processProblemTitle)
  applyQuickSkip(enableQuickSkip);
  applyHideDoneSkip(hideDoneSkip);
  applyTemplateBulkAddButton(enableTemplateBulkAdd);
  scheduleTemplateBulkButton(enableTemplateBulkAdd);
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
    let bulkAddSetting = enableTemplateBulkAdd;
    try {
      const bulkChk = document.getElementById('bn-enable-template-bulk-add');
      if (bulkChk) bulkAddSetting = bulkChk.checked;
    } catch (e) { }
    for (const node of nodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.(USER_LINK_SELECTOR)) processUserLink(node);
      if (node.matches?.('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span')) processProblemTitle(node);
      node.querySelectorAll?.(USER_LINK_SELECTOR).forEach(processUserLink);
      node.querySelectorAll?.('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span').forEach(processProblemTitle);
      try { applyQuickSkip(quickSkipSetting, node); } catch (e) { }
    }

    try { const _c = document.getElementById('bn-hide-done-skip'); applyHideDoneSkip(_c ? _c.checked : hideDoneSkip); } catch (e) { }
    try { const ok = applyTemplateBulkAddButton(bulkAddSetting); if (!ok) scheduleTemplateBulkButton(bulkAddSetting); } catch (e) { }
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
