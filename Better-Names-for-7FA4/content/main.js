// Better Names for 7FA4
// 6.0.0 SP16 Developer

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
window.getCurrentUserId = getCurrentUserId;

(async function () {
  'use strict';
  if (typeof window.__GM_ready === 'function') await window.__GM_ready();

  const DEFAULT_MAX_UNITS = 10;
  const storedTitleUnits = GM_getValue('maxTitleUnits', DEFAULT_MAX_UNITS);
  const storedUserUnits = GM_getValue('maxUserUnits', DEFAULT_MAX_UNITS);
  const maxTitleUnits = (storedTitleUnits === 'none') ? Infinity : parseInt(storedTitleUnits, 10);
  const maxUserUnits = (storedUserUnits === 'none') ? Infinity : parseInt(storedUserUnits, 10);
  const hideAvatar = GM_getValue('hideAvatar', true);
  const enableCopy = GM_getValue('enableCopy', true);
  const hideOrig = GM_getValue('hideOrig', true);
  const enableMenu = GM_getValue('enableUserMenu', true);
  const enablePlanAdder = GM_getValue('enablePlanAdder', true);
  const enableGuard = GM_getValue('enableGuard', false);
  const enableAutoRenew = GM_getValue('enableAutoRenew', false);
  const enableSubmitter = GM_getValue('enableSubmitter', true);
  const enableRankingFilterSetting = GM_getValue('rankingFilter.enabled', false);
  const initialAutoExit = GM_getValue('planAdder.autoExit', true);
  let autoExit = initialAutoExit;
  const enableVjLink = GM_getValue('enableVjLink', true);
  const hideDoneSkip = GM_getValue('hideDoneSkip', false);
  const enableQuickSkip = GM_getValue('enableQuickSkip', false);
  const WIDTH_MODE_KEY = 'truncate.widthMode';
  const widthMode = GM_getValue(WIDTH_MODE_KEY, 'visual');
  const THEME_KEY = 'colorTheme';
  const themeMode = GM_getValue(THEME_KEY, 'auto');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveTheme = themeMode === 'auto' ? (prefersDark ? 'dark' : 'light') : themeMode;
  const BN_TABLE_ROWS_SELECTOR = 'table.ui.very.basic.center.aligned.table tbody tr';

  const REPO_URLS = {
    github: 'https://github.com/DestinyleSnowy/Better-Names-for-7FA4',
    gitlab: 'http://jx.7fa4.cn:9080/yx/better-names-for-7fa4',
  };

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
  const storedPalette = safeGetJSON('userPalette', {});
  const useCustomColors = GM_getValue('useCustomColors', false);

  const palettes = {
    light: { x4: '#5a5a5a', x5: '#92800b', x6: '#77dd02', c1: '#ff0000', c2: '#ff6629', c3: '#ffbb00', g1: '#ca00ca', g2: '#62ca00', g3: '#13c2c2', d1: '#9900ff', d2: '#000cff', d3: '#597ef7', d4: '#896e00', by: '#8c8c8c', jl: '#ff85c0', uk: '#5e6e5e' },
    dark: { x4: '#777676', x5: '#c7af11', x6: '#88ff00', c1: '#fc6363', c2: '#fd895b', c3: '#ffc069', g1: '#ce4dce', g2: '#93cc5e', g3: '#36cfc9', d1: '#b37feb', d2: '#666efcff', d3: '#85a5ff', d4: '#b3a15cff', by: '#d9d9d9', jl: '#ffadd2', uk: '#8c8c8c' }
  };

  const basePalette = palettes[effectiveTheme] || palettes.light;
  const palette = Object.assign({}, basePalette, useCustomColors ? storedPalette : {});
  const css = `
    #bn-container {
      --bn-bg: #ffffff;
      --bn-bg-subtle: #fafbfc;
      --bn-bg-grad-1: #f8f9fa;
      --bn-bg-grad-2: #f1f3f4;
      --bn-border: #e0e0e0;
      --bn-border-subtle:#e9ecef;
      --bn-text: #333;
      --bn-text-sub: #495057;
      --bn-text-muted: #6c757d;
      --bn-btn-bg: #fff;
      --bn-btn-text:#495057;
      --bn-shadow: 0 8px 32px rgba(0,0,0,0.12);
      --bn-panel-shadow: 0 8px 32px rgba(0,0,0,0.12);
      --bn-trigger-shadow: 0 4px 12px rgba(0,0,0,0.1);
      --bn-hover-bg:#f8f9fa;
      --bn-version-h: 44px;
    }
    #bn-container.bn-dark {
      --bn-bg: #1f2227;
      --bn-bg-subtle: #15171c;
      --bn-bg-grad-1: #23262c;
      --bn-bg-grad-2: #1e2126;
      --bn-border: #2c313a;
      --bn-border-subtle:#2a2f37;
      --bn-text: #e8eaed;
      --bn-text-sub: #d5d7db;
      --bn-text-muted: #aab0b7;
      --bn-btn-bg: #23262c;
      --bn-btn-text:#d5d7db;
      --bn-shadow: 0 8px 32px rgba(0,0,0,0.4);
      --bn-panel-shadow: 0 8px 32px rgba(0,0,0,0.5);
      --bn-trigger-shadow: 0 4px 12px rgba(0,0,0,0.35);
      --bn-hover-bg:#2a2f37;
    }

    #bn-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 600px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #bn-container.bn-expanded { width: 1120px; }
    #bn-container * { pointer-events: auto; box-sizing: border-box; }
    #bn-container .bn-info-tooltip { pointer-events: none; }

    @media (max-width: 600px) {
      #bn-container, #bn-container.bn-expanded { width: calc(100vw - 40px); }
      #bn-panel, #bn-panel.bn-expanded { width: 100%; }
    }

    #bn-trigger {
      position: absolute; bottom: 0; right: 0;
      width: 48px; height: 48px;
      background: var(--bn-bg);
      border: 1px solid var(--bn-border);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: var(--bn-text-muted); font-size: 18px;
      cursor: pointer; transition: all .3s cubic-bezier(.4,0,.2,1);
      box-shadow: var(--bn-trigger-shadow);
    }
    #bn-trigger:hover {
      background: var(--bn-hover-bg);
      border-color: var(--bn-border-subtle);
      color: var(--bn-text);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.18);
    }

    #bn-panel {
      position: absolute; bottom: 58px; right: 0;
      width: 600px; padding: 0; background: var(--bn-bg);
      box-shadow: var(--bn-panel-shadow);
      border: 1px solid var(--bn-border); border-radius: 12px;
      max-height: calc(100vh - 80px); overflow-y: auto;
      transform: scale(.95) translateY(10px);
      transform-origin: bottom right; opacity: 0; visibility: hidden; pointer-events: none;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #bn-panel.bn-show { transform: scale(1) translateY(0); opacity: 1; visibility: visible; pointer-events: auto; }
    #bn-panel.bn-expanded { width: 1120px; }

    .bn-panel-header {
      position: relative; padding: 16px 20px;
      background: linear-gradient(135deg, var(--bn-bg-grad-1) 0%, var(--bn-bg-grad-2) 100%);
      border-bottom: 1px solid var(--bn-border-subtle);
    }
    #bn-pin {
      position: absolute; top: 12px; right: 12px; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      color: #999; transition: color .2s, transform .2s;
    }
    #bn-pin svg { width: 100%; height: 100%; fill: currentColor; }
    #bn-pin:hover { color: var(--bn-text); transform: scale(1.2); }
    #bn-pin.bn-pinned { color: #007bff; transform: rotate(45deg); }

    .bn-panel-title {
      font-size: 16px; font-weight: 600; color: var(--bn-text);
      margin: 0; display: flex; align-items: center; gap: 12px;
    }
    .bn-panel-repo-icons {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bn-panel-repo-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      color: var(--bn-text-muted);
      background: transparent;
      transition: color .2s ease, background-color .2s ease, transform .2s ease;
    }
    .bn-panel-repo-link:hover,
    .bn-panel-repo-link:focus-visible {
      color: var(--bn-text);
      background: var(--bn-hover-bg);
      outline: none;
      transform: translateY(-1px);
    }
    .bn-panel-repo-link svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    .bn-panel-subtitle { font-size: 12px; color: var(--bn-text-muted); margin: 4px 0 0 0; }

    .bn-panel-content {
      display: flex; transition: all .4s cubic-bezier(.4,0,.2,1);
      padding-bottom: var(--bn-version-h);
    }
    .bn-main-content {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      flex: 1;
      min-width: 0;
      padding: 16px 20px 0 20px;
    }

    @media (max-width: 600px) {
      .bn-main-content {
        padding: 12px 12px 0 12px;
      }
    }

    .bn-color-sidebar {
      width: 480px; background: var(--bn-bg-subtle);
      border-left: 1px solid var(--bn-border-subtle);
      opacity: 0; transform: translateX(20px); transition: all .4s cubic-bezier(.4,0,.2,1);
      pointer-events: none; display: none;
    }
    .bn-color-sidebar.bn-show { opacity: 1; transform: translateX(0); pointer-events: auto; display: block; }

    .bn-section {
      padding: 12px 16px; border: 1px solid var(--bn-border-subtle);
      border-radius: 8px; background: var(--bn-bg);
      transition: background-color .2s ease;
    }
    .bn-section:hover { background: rgba(248, 249, 250, 0.04); }

    .bn-title { font-weight: 600; font-size: 14px; color: var(--bn-text-sub); margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px; }
    .bn-title svg { width: 20px; height: 20px; flex-shrink: 0; }
    .bn-icon { width: 16px; height: 16px; opacity: .75; flex-shrink: 0; }
    .bn-desc { font-size: 12px; color: var(--bn-text-muted); margin: 0 0 12px 0; line-height: 1.4; }

    .bn-info {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
    }
    .bn-info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bn-border-subtle);
      color: var(--bn-text-muted);
      font-size: 11px;
      font-weight: 600;
      transition: background-color .2s ease, color .2s ease, box-shadow .2s ease;
      cursor: pointer;
    }
    .bn-info.bn-info-active .bn-info-icon,
    .bn-info .bn-info-icon:hover,
    .bn-info .bn-info-icon:focus-visible {
      background: #007bff;
      color: #fff;
      box-shadow: 0 2px 6px rgba(0,123,255,0.35);
    }
    .bn-info-icon.bn-info-icon-warning {
      background: rgba(255,193,7,0.18);
      color: #a66a00;
    }
    .bn-info-icon.bn-info-icon-warning svg {
      width: 10px;
      height: 10px;
      fill: currentColor;
    }
    .bn-info.bn-info-active .bn-info-icon.bn-info-icon-warning,
    .bn-info .bn-info-icon.bn-info-icon-warning:hover,
    .bn-info .bn-info-icon.bn-info-icon-warning:focus-visible {
      background: #ffb100;
      color: #3f2a00;
      box-shadow: 0 2px 6px rgba(255,177,0,0.4);
    }
    .bn-info-tooltip {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translate(-50%, -6px);
      background: var(--bn-bg);
      color: var(--bn-text-sub);
      border: 1px solid var(--bn-border-subtle);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.5;
      min-width: 220px;
      max-width: 280px;
      box-shadow: var(--bn-panel-shadow);
      opacity: 0;
      pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
      z-index: 20;
      text-align: left;
      white-space: normal;
    }
    .bn-info.bn-info-active .bn-info-tooltip,
    .bn-info .bn-info-icon:hover + .bn-info-tooltip,
    .bn-info .bn-info-icon:focus-visible + .bn-info-tooltip,
    .bn-info:focus-within .bn-info-tooltip {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    #bn-panel label {
      display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--bn-text-sub);
      cursor: pointer; padding: 4px 0; transition: all .2s ease; border-radius: 6px;
      margin: 0 -4px; padding-left: 4px; padding-right: 4px; white-space: nowrap;
    }
    #bn-panel label:hover { background: var(--bn-hover-bg); color: var(--bn-text); }

    #bn-panel input[type="checkbox"] { width: 16px; height: 16px; accent-color: #007bff; cursor: pointer; flex-shrink: 0; }

    #bn-panel input[type="number"], #bn-panel select {
      width: 100%; max-width: 180px; padding: 6px 8px; border: 1px solid var(--bn-border-subtle);
      border-radius: 8px; font-size: 13px; background: var(--bn-bg); margin-bottom: 8px; color: var(--bn-text);
      transition: all .2s ease;
    }
    #bn-panel input[type="number"]:focus, #bn-panel select:focus {
      border-color: #007bff; outline: none; box-shadow: 0 0 0 3px rgba(0,123,255,0.1); transform: translateY(-1px);
    }

    .bn-btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    .bn-btn-group.bn-btn-group-4 { grid-template-columns: repeat(4,1fr); gap: 6px; }

    .bn-btn {
      padding: 8px 12px; font-size: 12px; font-weight: 500; border: 1px solid var(--bn-border-subtle);
      border-radius: 6px; cursor: pointer; background: var(--bn-btn-bg); color: var(--bn-btn-text);
      transition: all .3s cubic-bezier(.4,0,.2,1); position: relative; overflow: hidden;
    }
    .bn-btn::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
      transition: left .5s ease;
    }
    .bn-btn:hover::before { left: 100%; }
    .bn-btn:hover { background: var(--bn-hover-bg); border-color: var(--bn-border); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.14); }
    .bn-btn:active { transform: translateY(0); transition: all .1s ease; }
    .bn-btn.bn-btn-primary { background: #007bff; color: #fff; border-color: #007bff; }
    .bn-btn.bn-btn-primary:hover { background: #0056b3; border-color: #0056b3; box-shadow: 0 4px 12px rgba(0,123,255,0.3); }

    .bn-color-header { padding: 16px 20px; border-bottom: 1px solid var(--bn-border-subtle); background: var(--bn-bg); }
    .bn-color-title { font-size: 14px; font-weight: 600; color: var(--bn-text-sub); margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px; }
    .bn-color-content { padding: 20px; }
    .bn-color-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 20px; }

    .bn-color-item {
      display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bn-bg);
      border-radius: 8px; border: 1px solid var(--bn-border-subtle); transition: all .3s ease; position: relative; overflow: hidden;
    }
    .bn-color-item::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(248,249,250,0.16), transparent);
      transition: left .6s ease;
    }
    .bn-color-item:hover::before { left: 100%; }
    .bn-color-item:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.18); border-color: #007bff; }
    .bn-color-item label {
      width: 84px;
      text-align: right;
      font-size: 11px;
      font-weight: 600;
      color: var(--bn-text-muted);
      margin: 0;
      padding: 0;
      text-transform: uppercase;
      letter-spacing: .5px;
      flex-shrink: 0;
    }
    .bn-color-item input[type="color"] {
      width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.16); transition: all .2s ease; flex-shrink: 0;
    }
    .bn-color-item input[type="color"]:hover { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.24); }
    .bn-color-item input[type="text"] {
      flex: 1; padding: 6px 10px; border: 1px solid var(--bn-border-subtle); border-radius: 6px; font-size: 11px;
      font-family: 'SF Mono','Monaco','Consolas',monospace; background: var(--bn-bg-subtle); color: var(--bn-text);
      transition: all .2s ease;
    }
    .bn-color-item input[type="text"]:focus { border-color: #007bff; background: var(--bn-bg); box-shadow: 0 0 0 2px rgba(0,123,255,0.14); outline: none; }
    .bn-color-actions { display: flex; gap: 8px; }
    .bn-color-actions .bn-btn { flex: 1; padding: 10px 16px; font-size: 12px; }
    #bn-plan-options {
      margin-left: 24px; display: ${enablePlanAdder ? 'block' : 'none'};
    }
    #bn-title-options, #bn-user-options {
      margin-left: 24px;
    }
    #bn-title-options { display: ${isFinite(maxTitleUnits) ? 'block' : 'none'}; }
    #bn-user-options  { display: ${isFinite(maxUserUnits) ? 'block' : 'none'}; }

    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px);} to { opacity: 1; transform: translateY(0);} }
    @keyframes slideUp   { from { opacity: 1; transform: translateY(0);}     to { opacity: 0; transform: translateY(-10px);} }

    .bn-medal { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; color: #fff; font-size: 9px; font-weight: bold; vertical-align: middle; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .bn-medal-gold { background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); }
    .bn-medal-silver { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); }
    .bn-medal-bronze { background: linear-gradient(135deg, #fd7e14 0%, #dc3545 100%); }
    .bn-medal-iron { background: linear-gradient(135deg, #495057 0%, #343a40 100%); }

    #bn-user-menu {
      position: fixed;
      z-index: 10001;
      background-color: var(--bn-bg, #fff);
      background-image: linear-gradient(to left, rgba(124, 191, 255, 0.15), rgba(124, 191, 255, 0));
      background-repeat: no-repeat;
      box-shadow: var(--bn-panel-shadow), 0 8px 24px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12);
      border-radius: 8px;
      padding: 8px 0;
      display: none;
      opacity: 0;
      transform: scale(0.98);
      transition: opacity .12s ease-out, transform .12s ease-out;
      will-change: opacity, transform;
      flex-direction: column;
      min-width: 160px;
      overflow: hidden;
      border: 1px solid var(--bn-border);
    }
    #bn-user-menu.bn-show { opacity: 1; transform: scale(1); }

    #bn-user-menu a {
      padding: 10px 16px; color: var(--bn-text-sub); text-decoration: none; font-size: 13px; white-space: nowrap; transition: all .2s ease; position: relative;
    }
    #bn-user-menu a::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #007bff; transform: scaleY(0); transition: transform .2s ease;
    }
    #bn-user-menu a:hover { background: var(--bn-hover-bg); color: var(--bn-text); padding-left: 20px; }
    #bn-user-menu a:hover::before { transform: scaleY(1); }

    .bn-version {
      position: relative;
      text-align: center;
      padding: 12px 20px;
      background: linear-gradient(135deg, var(--bn-bg-grad-1) 0%, var(--bn-bg-grad-2) 100%);
      border-top: 1px solid var(--bn-border-subtle);
      font-size: 11px; color: var(--bn-text-muted); font-weight: 500;
      min-height: var(--bn-version-h);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bn-version-text {
      text-align: center;
    }

    a[data-bn-quick-skip="1"],
    .bn-quick-skip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #f1e5ff;
      color: #4b2c92;
      font-size: 12px;
      line-height: 1;
      text-decoration: none;
      border: 1px solid rgba(123, 76, 217, 0.28);
      white-space: nowrap;
      transition: background .2s ease, color .2s ease, transform .2s ease, box-shadow .2s ease;
    }
    a[data-bn-quick-skip="1"]:hover,
    .bn-quick-skip:hover {
      background: #e4d4ff;
      color: #3d237e;
      box-shadow: 0 3px 8px rgba(79, 46, 138, 0.25);
      transform: translateY(-1px);
    }
    a[data-bn-quick-skip="1"]:visited,
    .bn-quick-skip:visited {
      color: #4b2c92;
    }
    a[data-bn-quick-skip="1"]:active,
    .bn-quick-skip:active {
      transform: translateY(0);
      box-shadow: none;
    }
    a[data-bn-quick-skip="1"] i.icon,
    .bn-quick-skip i.icon {
      margin: 0 !important;
      color: #7f3dcf;
    }
    .bn-quick-skip-cell {
      text-align: center;
      vertical-align: middle;
      white-space: nowrap;
      padding: 4px 6px !important;
    }
    .bn-quick-skip-head {
      text-align: center;
      color: #7f3dcf;
      width: 1%;
    }
    .bn-quick-skip-head i.icon {
      margin: 0 !important;
      color: #7f3dcf;
    }

    @media (max-width: 600px) {
      #bn-container { width: 300px; right: 16px; bottom: 16px; }
      #bn-container.bn-expanded { width: calc(100vw - 32px); max-width: 520px; }
      #bn-panel { width: 300px; }
      #bn-panel.bn-expanded { width: calc(100vw - 32px); max-width: 520px; }
      .bn-color-sidebar { width: 200px; }
    }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  GM_addStyle(`
  #bn-container.bn-pos-br { bottom:20px; right:20px; top:auto; left:auto; }
  #bn-container.bn-pos-bl { bottom:20px; left:20px;  top:auto; right:auto; }
  #bn-container.bn-pos-tr { top:20px;    right:20px; bottom:auto; left:auto; }
  #bn-container.bn-pos-tl { top:20px;    left:20px;  bottom:auto; right:auto; }

  #bn-container.bn-pos-br #bn-trigger { bottom:0; right:0;  top:auto;   left:auto; }
  #bn-container.bn-pos-bl #bn-trigger { bottom:0; left:0;   top:auto;   right:auto; }
  #bn-container.bn-pos-tr #bn-trigger { top:0;    right:0;  bottom:auto; left:auto; }
  #bn-container.bn-pos-tl #bn-trigger { top:0;    left:0;   bottom:auto; right:auto; }

  #bn-container.bn-pos-br #bn-panel { bottom:58px; right:0;  top:auto;   left:auto;  transform-origin: bottom right; }
  #bn-container.bn-pos-bl #bn-panel { bottom:58px; left:0;   top:auto;   right:auto; transform-origin: bottom left; }
  #bn-container.bn-pos-tr #bn-panel { top:58px;    right:0;  bottom:auto; left:auto;  transform-origin: top right; }
  #bn-container.bn-pos-tl #bn-panel { top:58px;    left:0;   bottom:auto; right:auto; transform-origin: top left; }

  #bn-container.bn-pos-tr #bn-panel,
  #bn-container.bn-pos-tl #bn-panel { transform: scale(.95) translateY(-10px); }

  #bn-container.bn-dragging #bn-panel { display: none !important; }
  .bn-hide-done-skip{display:none!important;}`);

  const colorInputsHTML = COLOR_KEYS.map(k => `
    <div class="bn-color-item">
      <label>${COLOR_LABELS[k] || k}:</label>
      <input type="color" id="bn-color-${k}" value="${palette[k]}">
      <input type="text" class="bn-color-hex" id="bn-color-${k}-hex" value="${palette[k]}">
    </div>
  `).join('');

  const container = document.createElement('div'); container.id = 'bn-container';
  if (effectiveTheme === 'dark') container.classList.add('bn-dark');

  container.innerHTML = `
    <div id="bn-trigger">⚙️</div>
    <div id="bn-panel">
      <div class="bn-panel-header">
        <div class="bn-panel-title">
          <div class="bn-panel-repo-icons">
            <a class="bn-panel-repo-link" href="${REPO_URLS.github}" target="_blank" rel="noopener noreferrer" aria-label="打开 GitHub 仓库">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8Z"/></svg>
            </a>
            <a class="bn-panel-repo-link" href="${REPO_URLS.gitlab}" target="_blank" rel="noopener noreferrer" aria-label="打开 GitLab 仓库">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M15.66 9.27l-1.2-3.7a.58.58 0 00-.55-.4.58.58 0 00-.56.4l-1.18 3.63H3.83L2.65 5.57a.58.58 0 00-.55-.4.58.58 0 00-.56.4l-1.2 3.7a1.16 1.16 0 00.43 1.3l6.44 4.8c.21.16.47.23.73.23.26 0 .52-.07.73-.23l6.44-4.8c.45-.34.64-.93.44-1.3zM3.72 7.98l1.32 3.25-3.02-2.25.92-3zm6.03 6.45c-.23.17-.52.26-.81.26a1.3 1.3 0 01-.8-.26L7.3 13.72l.7-1.8h1.94l.7 1.8-1.89 1.43zm-2.53-3.14l.78-2.02h1.02l.78 2.02H7.22zm4.95-.06l1.32-3.25 1.78 5.25-3.1-2.3z"/></svg>
            </a>
          </div>
          Better Names for 7FA4 面板
        </div>
        <div id="bn-pin" title="固定面板">
          <svg class="bn-icon bn-icon-pin" viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>
        </div>
        <div class="bn-panel-subtitle">Generated By ChatGPT (o3, GPT-5 Thinking, GPT-5 Pro DeepResearch, Codex) and Manus</div>
      </div>
      <div class="bn-panel-content">
        <div class="bn-main-content">
          <div class="bn-section">
            <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M17.18 16.1Q16.37 16.1 15.65 16.56L13.06 13.92L16.7 10.27Q16.92 10.06 16.92 9.74Q16.92 9.43 16.7 9.22Q16.49 9 16.18 9Q15.86 9 15.65 9.22L12 12.86L8.33 9.22Q8.11 9 7.8 9Q7.49 9 7.27 9.22Q7.06 9.43 7.06 9.74Q7.06 10.06 7.27 10.27L10.92 13.92L8.3 16.54Q7.63 16.13 6.82 16.13Q6 16.13 5.3 16.52Q4.61 16.92 4.21 17.62Q3.82 18.31 3.82 19.13Q3.82 19.94 4.21 20.63Q4.61 21.31 5.3 21.72Q6 22.13 6.82 22.13Q7.63 22.13 8.32 21.72Q9 21.31 9.41 20.63Q9.82 19.94 9.82 19.13Q9.82 18.72 9.71 18.34Q9.6 17.95 9.38 17.59L12 15L14.54 17.54Q14.18 18.17 14.18 19.1Q14.18 19.92 14.59 20.6Q15 21.29 15.68 21.7Q16.37 22.1 17.18 22.1Q18 22.1 18.68 21.7Q19.37 21.29 19.78 20.6Q20.18 19.92 20.18 19.1Q20.18 18.29 19.78 17.6Q19.37 16.92 18.68 16.51Q18 16.1 17.18 16.1ZM6.82 20.62Q6.19 20.62 5.75 20.17Q5.3 19.73 5.3 19.1Q5.3 18.48 5.75 18.05Q6.19 17.62 6.82 17.62Q7.44 17.62 7.87 18.05Q8.3 18.48 8.3 19.1Q8.3 19.73 7.87 20.17Q7.44 20.62 6.82 20.62ZM17.18 20.62Q16.56 20.62 16.13 20.17Q15.7 19.73 15.7 19.1Q15.7 18.48 16.14 18.05Q16.58 17.62 17.18 17.62Q17.81 17.62 18.25 18.05Q18.7 18.48 18.7 19.1Q18.7 19.73 18.25 20.17Q17.81 20.62 17.18 20.62Z" fill="rgba(0,0,0,0.9019607843137255)"></path><path d="M19.2 14.69Q19.97 14.69 20.6 14.32Q21.24 13.94 21.62 13.3Q22.01 12.65 22.01 11.88L22.01 4.68Q22.01 3.91 21.64 3.28Q21.26 2.64 20.62 2.26Q19.97 1.87 19.2 1.87L4.8 1.87Q4.03 1.87 3.38 2.26Q2.74 2.64 2.36 3.28Q1.99 3.91 1.99 4.68L1.99 11.88Q1.99 12.65 2.36 13.3Q2.74 13.94 3.38 14.32Q4.03 14.69 4.8 14.69L5.83 14.69Q6.14 14.69 6.36 14.47Q6.58 14.26 6.58 13.94Q6.58 13.63 6.36 13.42Q6.14 13.2 5.83 13.2L4.8 13.2Q4.27 13.2 3.89 12.82Q3.5 12.43 3.5 11.88L3.5 4.68Q3.5 4.13 3.89 3.76Q4.27 3.38 4.8 3.38L19.2 3.38Q19.75 3.38 20.12 3.76Q20.5 4.13 20.5 4.68L20.5 11.88Q20.5 12.43 20.11 12.82Q19.73 13.2 19.2 13.2L18.17 13.2Q17.86 13.2 17.63 13.42Q17.4 13.63 17.4 13.94Q17.4 14.26 17.63 14.47Q17.86 14.69 18.17 14.69L19.2 14.69Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              截断功能
            </div>
            <label><input type="checkbox" id="bn-enable-title-truncate" ${isFinite(maxTitleUnits) ? 'checked' : ''}/> 启用题目名截断</label>
            <div id="bn-title-options">
              <label>截断长度：
                <input id="bn-title-input" type="number" min="1" step="1" value="${isFinite(maxTitleUnits) ? maxTitleUnits : ''}" placeholder="输入正整数">
              </label>
            </div>
            <label><input type="checkbox" id="bn-enable-user-truncate" ${isFinite(maxUserUnits) ? 'checked' : ''}/> 启用用户名截断</label>
            <div id="bn-user-options">
              <label>截断长度：
                <input id="bn-user-input" type="number" min="1" step="1" value="${isFinite(maxUserUnits) ? maxUserUnits : ''}" placeholder="输入正整数">
              </label>
            </div>
            <div>
              <label>计数方式：
                <select id="bn-width-mode">
                  <option value="visual" ${widthMode === 'visual' ? 'selected' : ''}>视觉宽度（中文=2）</option>
                  <option value="char" ${widthMode === 'char' ? 'selected' : ''}>等宽字符数（每字=1）</option>
                  <option value="byte" ${widthMode === 'byte' ? 'selected' : ''}>UTF-8 字节数</option>
                </select>
              </label>
            </div>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M22.87 11.47Q21.77 9.48 20.04 8.02Q18.31 6.55 16.24 5.77Q14.16 4.99 12 4.99Q9.84 4.99 7.76 5.77Q5.69 6.55 3.96 8.02Q2.23 9.48 1.13 11.47Q1.01 11.69 1.01 11.94Q1.01 12.19 1.13 12.43Q2.23 14.4 3.96 15.89Q5.69 17.38 7.78 18.18Q9.86 18.98 12 18.98Q14.16 18.98 16.24 18.18Q18.31 17.38 20.04 15.9Q21.77 14.42 22.87 12.43Q22.99 12.19 22.99 11.94Q22.99 11.69 22.87 11.47ZM10.15 17.33Q7.85 16.8 5.87 15.41Q3.89 14.02 2.66 12L2.66 11.83Q4.13 9.38 6.66 7.94Q9.19 6.5 12 6.5Q14.86 6.5 17.38 7.96Q19.9 9.41 21.36 11.86L21.36 12.05Q20.14 14.06 18.17 15.44Q16.2 16.82 13.92 17.35Q12.05 17.76 10.15 17.33ZM11.98 17.62Q13.39 17.62 14.58 16.92Q15.77 16.22 16.46 15.02Q17.16 13.82 17.16 12.41Q17.16 10.99 16.46 9.8Q15.77 8.62 14.58 7.92Q13.39 7.22 11.98 7.22Q11.09 7.22 10.25 7.51Q10.01 7.61 10.01 7.7Q10.01 7.8 10.27 7.92Q10.82 8.18 11.16 8.7Q11.5 9.22 11.5 9.84Q11.5 10.73 10.87 11.35Q10.25 11.98 9.38 11.98Q8.83 11.98 8.35 11.7Q7.87 11.42 7.58 10.97Q7.39 10.68 7.22 10.68Q7.06 10.68 6.96 10.99Q6.77 11.71 6.77 12.41Q6.77 13.82 7.46 15.02Q8.16 16.22 9.36 16.92Q10.56 17.62 11.98 17.62Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              显示选项
            </div>
            <label><input type="checkbox" id="bn-hide-avatar" ${hideAvatar ? 'checked' : ''}/> 隐藏用户头像</label>
            <label><input type="checkbox" id="bn-enable-user-menu" ${enableMenu ? 'checked' : ''}/> 启用用户菜单</label>
            <label><input type="checkbox" id="bn-enable-vj" ${enableVjLink ? 'checked' : ''}/> 外站题目链接 Vjudge 按钮</label>
            <label><input type="checkbox" id="bn-enable-copy" ${enableCopy ? 'checked' : ''}/> 启用题面快捷复制</label>
            <label><input type="checkbox" id="bn-hide-orig" ${hideOrig ? 'checked' : ''}/> 隐藏题目源码按钮</label>
            <label><input type="checkbox" id="bn-hide-done-skip" ${hideDoneSkip ? 'checked' : ''}/> 隐藏已通过&已跳过题目</label>
            <label><input type="checkbox" id="bn-enable-quick-skip" ${enableQuickSkip ? 'checked' : ''}/> 启用快捷跳过按钮</label>
          </div>
          <div class="bn-section">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M10.73 15.74Q11.11 15.74 11.46 15.6Q11.81 15.46 12.1 15.19L17.28 10.01Q17.5 9.79 17.5 9.48Q17.5 9.17 17.28 8.93Q17.04 8.71 16.74 8.71Q16.44 8.71 16.2 8.93L11.04 14.11Q10.92 14.23 10.73 14.23Q10.54 14.23 10.42 14.11L7.78 11.47Q7.56 11.26 7.25 11.26Q6.94 11.26 6.72 11.47Q6.5 11.69 6.5 12Q6.5 12.31 6.72 12.53L9.36 15.19Q9.96 15.74 10.73 15.74Z" fill="rgba(0,0,0,0.9019607843137255)"></path><path d="M11.42 22.92Q11.69 22.99 12.04 22.99Q12.38 22.99 12.6 22.92Q15.17 22.15 17.15 20.42Q19.13 18.7 20.21 16.31Q21.29 13.92 21.29 11.23L21.29 6.43Q21.29 5.81 20.98 5.3Q20.66 4.8 20.11 4.56L12.96 1.2Q12.5 1.01 12.01 1.01Q11.52 1.01 11.06 1.2L3.89 4.56Q3.36 4.8 3.04 5.29Q2.71 5.78 2.71 6.41L2.71 11.21Q2.71 13.85 3.82 16.25Q4.92 18.65 6.9 20.4Q8.88 22.15 11.42 22.92ZM11.86 21.48Q9.65 20.81 7.9 19.27Q6.14 17.74 5.17 15.62Q4.2 13.51 4.2 11.21L4.2 6.41Q4.2 6.24 4.28 6.11Q4.37 5.98 4.51 5.9L11.69 2.54Q11.83 2.5 12.01 2.5Q12.19 2.5 12.34 2.54L19.49 5.9Q19.63 5.98 19.72 6.11Q19.8 6.24 19.8 6.41L19.8 11.21Q19.8 13.56 18.84 15.66Q17.88 17.76 16.16 19.28Q14.45 20.81 12.19 21.48Q12 21.53 11.86 21.48Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              二三帮守护
              <span class="bn-info">
                <span class="bn-info-icon bn-info-icon-warning" tabindex="0" role="button" aria-label="该功能仍在实现中，存在在“统计”页面若该题未在第一次提交通过会错误触发拦截功能的问题。">
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.89 0 1.438-.99.982-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                  </svg>
                </span>
                <span class="bn-info-tooltip" role="tooltip">该功能仍在实现中，存在在“统计”页面若该题未在第一次提交通过会错误触发拦截功能的问题。</span>
              </span>
            </div>
            <label><input type="checkbox" id="bn-enable-guard" ${enableGuard ? 'checked' : ''}/> 启用二三帮守护</label>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="25" height="24"><rect width="25" height="24" opacity="0"></rect><g mask="url(#hms_mask_0)"><path d="M17.37 2.5L17.37 2.11Q17.37 1.7 17.07 1.4Q16.77 1.1 16.36 1.1Q15.96 1.1 15.66 1.4Q15.36 1.7 15.36 2.11L15.36 2.5L9.38 2.5L9.38 2.11Q9.38 1.7 9.09 1.4Q8.8 1.1 8.4 1.1Q7.96 1.1 7.68 1.4Q7.39 1.7 7.39 2.11L7.39 2.5L5.35 2.5Q4.53 2.5 3.85 2.9Q3.16 3.31 2.76 4Q2.35 4.68 2.35 5.5L2.35 19.01Q2.35 19.82 2.76 20.51Q3.16 21.19 3.85 21.6Q4.53 22.01 5.35 22.01L19.36 22.01Q20.18 22.01 20.86 21.6Q21.55 21.19 21.96 20.51Q22.36 19.82 22.36 19.01L22.36 5.5Q22.36 4.68 21.96 4Q21.55 3.31 20.86 2.9Q20.18 2.5 19.36 2.5ZM7.39 4.01L7.39 4.2Q7.39 4.46 7.52 4.7Q7.65 4.94 7.88 5.08Q8.11 5.21 8.4 5.21Q8.66 5.21 8.89 5.08Q9.12 4.94 9.25 4.7Q9.38 4.46 9.38 4.2L9.38 4.01L15.36 4.01L15.36 4.2Q15.36 4.46 15.49 4.7Q15.62 4.94 15.85 5.08Q16.08 5.21 16.36 5.21Q16.63 5.21 16.86 5.08Q17.08 4.94 17.22 4.7Q17.35 4.46 17.35 4.2L17.35 4.01L19.36 4.01Q19.99 4.01 20.42 4.44Q20.85 4.87 20.85 5.5L20.85 7.7L3.86 7.7L3.86 5.5Q3.86 4.87 4.3 4.44Q4.75 4.01 5.35 4.01ZM5.35 20.5Q4.75 20.5 4.3 20.05Q3.86 19.61 3.86 19.01L3.86 9.19L20.88 9.19L20.88 19.01Q20.88 19.61 20.43 20.05Q19.99 20.5 19.36 20.5L5.35 20.5ZM6.84 13.34Q7.24 13.34 7.54 13.04Q7.84 12.74 7.84 12.34Q7.84 11.93 7.54 11.63Q7.24 11.33 6.84 11.33Q6.43 11.33 6.13 11.63Q5.83 11.93 5.83 12.34Q5.83 12.74 6.13 13.04Q6.43 13.34 6.84 13.34ZM10.56 13.34Q10.96 13.34 11.26 13.04Q11.56 12.74 11.56 12.34Q11.56 11.93 11.26 11.63Q10.96 11.33 10.56 11.33Q10.15 11.33 9.85 11.63Q9.55 11.93 9.55 12.34Q9.55 12.74 9.85 13.04Q10.15 13.34 10.56 13.34ZM14.3 13.34Q14.71 13.34 15.01 13.04Q15.31 12.74 15.31 12.34Q15.31 11.93 15.01 11.63Q14.71 11.33 14.3 11.33Q13.89 11.33 13.59 11.63Q13.29 11.93 13.29 12.34Q13.29 12.74 13.59 13.04Q13.89 13.34 14.3 13.34ZM18.02 13.34Q18.43 13.34 18.73 13.04Q19.03 12.74 19.03 12.34Q19.03 11.93 18.73 11.63Q18.43 11.33 18.02 11.33Q17.61 11.33 17.31 11.63Q17.01 11.93 17.01 12.34Q17.01 12.74 17.31 13.04Q17.61 13.34 18.02 13.34ZM6.84 17.35Q7.24 17.35 7.54 17.05Q7.84 16.75 7.84 16.34Q7.84 15.94 7.54 15.64Q7.24 15.34 6.84 15.34Q6.43 15.34 6.13 15.64Q5.83 15.94 5.83 16.34Q5.83 16.75 6.13 17.05Q6.43 17.35 6.84 17.35ZM10.56 17.35Q10.96 17.35 11.26 17.05Q11.56 16.75 11.56 16.34Q11.56 15.94 11.26 15.64Q10.96 15.34 10.56 15.34Q10.15 15.34 9.85 15.64Q9.55 15.94 9.55 16.34Q9.55 16.75 9.85 17.05Q10.15 17.35 10.56 17.35Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g><defs><mask id="hms_mask_0"><rect width="25" height="24" fill="#ffffff"></rect><g><path d="M19.34 13.25Q17.9 13.25 16.69 13.96Q15.48 14.66 14.77 15.88Q14.06 17.09 14.06 18.53Q14.06 19.97 14.77 21.19Q15.48 22.42 16.69 23.12Q17.9 23.83 19.34 23.83Q20.78 23.83 22 23.12Q23.23 22.42 23.94 21.19Q24.64 19.97 24.64 18.53Q24.64 17.09 23.92 15.88Q23.2 14.66 21.99 13.96Q20.78 13.25 19.34 13.25Z" fill="#000000"></path></g></mask></defs><g><path d="M15.36 18.53Q15.36 19.63 15.9 20.54Q16.44 21.46 17.35 22Q18.26 22.54 19.34 22.54Q20.42 22.54 21.34 22Q22.27 21.46 22.81 20.54Q23.35 19.63 23.35 18.53Q23.35 17.45 22.81 16.54Q22.27 15.62 21.34 15.08Q20.42 14.54 19.34 14.54Q18.26 14.54 17.35 15.08Q16.44 15.62 15.9 16.54Q15.36 17.45 15.36 18.53ZM21.19 19.68Q21.36 19.85 21.34 20.04Q21.33 20.23 21.19 20.4Q21.04 20.54 20.84 20.54Q20.64 20.54 20.49 20.4L19 18.91Q18.86 18.77 18.86 18.55L18.86 16.51Q18.86 16.3 19 16.15Q19.15 16.01 19.36 16.01Q19.58 16.01 19.72 16.15Q19.87 16.3 19.87 16.51L19.87 18.36L21.19 19.68Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
               添加计划
            </div>
            <label><input type="checkbox" id="bn-enable-plan" ${enablePlanAdder ? 'checked' : ''}/> 启用添加计划</label>
            <div id="bn-plan-options">
              <label><input type="checkbox" id="bn-plan-auto" ${initialAutoExit ? 'checked' : ''}/> 完成后退出</label>
            </div>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M12.74 20.5L12.74 3.5L13.87 3.5Q14.18 3.5 14.4 3.29Q14.62 3.07 14.62 2.76Q14.62 2.45 14.4 2.23Q14.18 2.02 13.87 2.02L10.13 2.02Q9.82 2.02 9.59 2.23Q9.36 2.45 9.36 2.76Q9.36 3.07 9.59 3.29Q9.82 3.5 10.13 3.5L11.23 3.5L11.23 20.5L10.13 20.5Q9.82 20.5 9.59 20.71Q9.36 20.93 9.36 21.24Q9.36 21.55 9.59 21.77Q9.82 21.98 10.13 21.98L13.87 21.98Q14.18 21.98 14.4 21.77Q14.62 21.55 14.62 21.24Q14.62 20.93 14.4 20.71Q14.18 20.5 13.87 20.5ZM2.88 12.07L4.51 10.44Q4.7 10.22 4.7 9.9Q4.7 9.58 4.51 9.38Q4.27 9.14 3.96 9.14Q3.65 9.14 3.43 9.38L1.42 11.4Q1.15 11.66 1.15 12.06Q1.15 12.46 1.42 12.72L3.43 14.76Q3.72 15.02 4.02 14.99Q4.32 14.95 4.51 14.76Q4.73 14.54 4.73 14.22Q4.73 13.9 4.51 13.68ZM19.49 13.68Q19.27 13.9 19.27 14.22Q19.27 14.54 19.49 14.76Q19.7 14.98 19.99 14.98Q20.28 14.98 20.57 14.74L22.56 12.72Q22.85 12.46 22.85 12.06Q22.85 11.66 22.56 11.4L20.57 9.38L20.52 9.34Q20.3 9.14 20 9.16Q19.7 9.17 19.51 9.38Q19.27 9.58 19.27 9.9Q19.27 10.22 19.51 10.44L21.12 12.07L19.49 13.68Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              榜单筛选
            </div>
            <label><input type="checkbox" id="bn-enable-ranking-filter" ${enableRankingFilterSetting ? 'checked' : ''}/> 启用榜单筛选</label>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M21.34 13.39Q21.91 13.13 22.12 12.56Q22.32 12 22.12 11.45Q21.91 10.9 21.34 10.63L3.86 2.93Q3.24 2.64 2.66 2.9Q2.09 3.17 1.85 3.74Q1.61 4.32 1.9 4.92L4.73 10.94L18.14 11.69Q18.34 11.69 18.41 11.83Q18.48 11.98 18.41 12.13Q18.34 12.29 18.14 12.29L4.75 13.03L1.9 19.03Q1.61 19.63 1.85 20.22Q2.09 20.81 2.66 21.07Q3.24 21.34 3.86 21.05L21.34 13.39Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              Submitter
            </div>
            <label><input type="checkbox" id="bn-enable-submitter" ${enableSubmitter ? 'checked' : ''}/> 启用 Submitter</label>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M22.99 12.1Q22.99 9.22 21.6 6.72Q20.21 4.22 17.81 2.69Q15.41 1.15 12.53 1.01Q10.34 0.91 8.29 1.63Q6.24 2.35 4.61 3.84Q2.98 5.33 2.05 7.3Q1.13 9.26 1.01 11.47Q0.91 13.66 1.63 15.71Q2.35 17.76 3.84 19.39Q5.33 21.02 7.3 21.95Q9.26 22.87 11.47 22.97Q13.9 22.97 15.68 22.38Q17.47 21.79 19.2 20.28Q19.44 20.09 19.46 19.78Q19.49 19.46 19.27 19.22Q19.08 18.98 18.77 18.96Q18.46 18.94 18.22 19.15Q16.82 20.38 15.1 20.98Q13.37 21.58 11.52 21.48Q9.62 21.38 7.92 20.58Q6.22 19.78 4.94 18.36Q3.67 16.97 3.04 15.2Q2.4 13.44 2.5 11.54Q2.59 9.65 3.38 7.94Q4.18 6.24 5.59 4.97Q6.98 3.67 8.75 3.04Q10.51 2.4 12.43 2.5Q14.93 2.62 16.99 3.92Q19.06 5.23 20.26 7.37Q21.46 9.5 21.46 12L19.85 12Q19.73 12 19.63 12.08Q19.54 12.17 19.51 12.29Q19.49 12.41 19.56 12.53L21.62 15.89Q21.7 16.01 21.83 16.04Q21.96 16.08 22.09 16.03Q22.22 15.98 22.27 15.84Q22.58 15 22.79 13.96Q22.99 12.91 22.99 12.1Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              自动更新
              <span class="bn-info">
                <span class="bn-info-icon bn-info-icon-warning" tabindex="0" role="button" aria-label="由于用户脚本只能在首个请求返回后才能运行，因此首个“原始”页面请求无法被阻止，当前实现已经尽快中止并改写。">
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.89 0 1.438-.99.982-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                  </svg>
                </span>
                <span class="bn-info-tooltip" role="tooltip">由于用户脚本只能在首个请求返回后才能运行，因此首个“原始”页面请求无法被阻止，当前实现已经尽快中止并改写。</span>
              </span>
            </div>
            <label><input type="checkbox" id="bn-enable-renew" ${enableAutoRenew ? 'checked' : ''}/> 启用题目自动更新</label>
          </div>
          <div class="bn-section bn-section-color-theme">
            <div class="bn-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M11.83 21.89Q12.82 21.89 13.44 21.38Q14.06 20.88 14.23 20.16Q14.4 19.44 14.14 18.86Q13.94 18.36 13.66 18.05Q13.42 17.69 13.49 17.4Q13.56 17.11 13.88 16.96Q14.21 16.8 14.74 16.82Q16.51 16.94 18 16.45Q19.49 15.96 20.48 14.86Q21.48 13.75 21.79 12.07Q22.08 10.49 21.62 8.86Q21.17 7.22 20.35 6.17Q18.24 3.48 15.5 2.62Q12.77 1.75 10.24 2.27Q7.7 2.78 6.12 4.03Q4.42 5.35 3.26 7.33Q2.11 9.31 2.11 12.6Q2.11 14.57 3.35 16.75Q4.58 18.94 6.82 20.41Q9.05 21.89 11.83 21.89ZM7.03 5.23Q8.4 4.18 10.54 3.73Q12.67 3.29 15 4.02Q17.33 4.75 19.18 7.08Q19.8 7.9 20.16 9.24Q20.52 10.58 20.3 11.81Q19.94 13.75 18.49 14.62Q17.04 15.48 14.81 15.31Q13.46 15.24 12.74 15.86Q12.02 16.49 11.96 17.39Q11.9 18.29 12.46 18.94Q12.62 19.13 12.77 19.46Q12.82 19.56 12.78 19.79Q12.74 20.02 12.52 20.21Q12.29 20.4 11.83 20.4Q9.48 20.4 7.6 19.16Q5.71 17.93 4.66 16.09Q3.6 14.26 3.6 12.6Q3.6 9.77 4.58 8.06Q5.57 6.36 7.03 5.23ZM7.32 8.66Q6.77 8.66 6.37 9.05Q5.98 9.43 5.98 9.98Q5.98 10.54 6.37 10.93Q6.77 11.33 7.32 11.33Q7.87 11.33 8.27 10.93Q8.66 10.54 8.66 9.98Q8.66 9.43 8.27 9.05Q7.87 8.66 7.32 8.66ZM9.98 5.3Q9.43 5.3 9.05 5.7Q8.66 6.1 8.66 6.65Q8.66 7.2 9.05 7.6Q9.43 7.99 9.98 7.99Q10.54 7.99 10.93 7.6Q11.33 7.2 11.33 6.65Q11.33 6.1 10.93 5.7Q10.54 5.3 9.98 5.3ZM14.26 5.3Q13.7 5.3 13.31 5.7Q12.91 6.1 12.91 6.65Q12.91 7.2 13.31 7.6Q13.7 7.99 14.26 7.99Q14.81 7.99 15.19 7.6Q15.58 7.2 15.58 6.65Q15.58 6.1 15.19 5.7Q14.81 5.3 14.26 5.3ZM16.92 8.66Q16.37 8.66 15.97 9.05Q15.58 9.43 15.58 9.98Q15.58 10.54 15.97 10.93Q16.37 11.33 16.92 11.33Q17.47 11.33 17.87 10.93Q18.26 10.54 18.26 9.98Q18.26 9.43 17.87 9.05Q17.47 8.66 16.92 8.66Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
              颜色 & 主题
            </div>
            <label><input type="checkbox" id="bn-use-custom-color" ${useCustomColors ? 'checked' : ''}/> 启用自定义颜色</label>
            <div>
              <label>主题：
                <select id="bn-theme-select">
                  <option value="auto" ${themeMode === 'auto' ? 'selected' : ''}>跟随系统</option>
                  <option value="light" ${themeMode === 'light' ? 'selected' : ''}>浅色</option>
                  <option value="dark" ${themeMode === 'dark' ? 'selected' : ''}>深色</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div class="bn-color-sidebar" id="bn-color-sidebar">
          <div class="bn-color-header">
            <div class="bn-color-title">
              <svg class="bn-icon" viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              自定义颜色
            </div>
          </div>
          <div class="bn-color-content">
            <div class="bn-color-grid">${colorInputsHTML}</div>
            <div class="bn-color-actions">
              <button class="bn-btn" id="bn-color-reset">重置默认</button>
            </div>
          </div>
        </div>
      </div>
      <div class="bn-version">
        <div class="bn-version-text">6.0.0 SP16 Developer</div>
      </div>
    </div>`;
  document.body.appendChild(container);
  container.style.pointerEvents = 'none';

  const trigger = document.getElementById('bn-trigger');
  const panel = document.getElementById('bn-panel');
  const pinBtn = document.getElementById('bn-pin');
  let pinned = !!GM_getValue('panelPinned', false);
  const CORNER_KEY = 'bn.corner';
  const SNAP_MARGIN = 20;
  let isDragging = false;
  let wasPinned = false;
  let gearW = 48, gearH = 48;
  let __bn_trail = [];
  let __bn_raf = null;
  let __bn_dragX = 0, __bn_dragY = 0;
  let __bn_pointerId = null;

  function applyCorner(pos) {
    container.classList.remove('bn-pos-br', 'bn-pos-bl', 'bn-pos-tr', 'bn-pos-tl');
    container.classList.add('bn-pos-' + pos);
    GM_setValue(CORNER_KEY, pos);
  }

  applyCorner(GM_getValue(CORNER_KEY, 'br'));

  const titleInp = document.getElementById('bn-title-input');
  const userInp = document.getElementById('bn-user-input');
  const chkTitleTr = document.getElementById('bn-enable-title-truncate');
  const chkUserTr = document.getElementById('bn-enable-user-truncate');
  const titleOpts = document.getElementById('bn-title-options');
  const userOpts = document.getElementById('bn-user-options');

  const widthModeSel = document.getElementById('bn-width-mode');

  const chkAv = document.getElementById('bn-hide-avatar');
  const chkCp = document.getElementById('bn-enable-copy');
  const chkHo = document.getElementById('bn-hide-orig');

  const chkMenu = document.getElementById('bn-enable-user-menu');
  const chkGuard = document.getElementById('bn-enable-guard');
  const chkPlan = document.getElementById('bn-enable-plan');
  const chkAutoRenew = document.getElementById('bn-enable-renew');
  const chkRankingFilter = document.getElementById('bn-enable-ranking-filter');
  const chkSubmitter = document.getElementById('bn-enable-submitter');
  const planOpts = document.getElementById('bn-plan-options');
  const chkPlanAuto = document.getElementById('bn-plan-auto');
  const chkUseColor = document.getElementById('bn-use-custom-color');
  const themeSelect = document.getElementById('bn-theme-select');

  const colorSidebar = document.getElementById('bn-color-sidebar');
  const chkVj = document.getElementById('bn-enable-vj');
  const chkHideDoneSkip = document.getElementById('bn-hide-done-skip');
  const chkQuickSkip = document.getElementById('bn-enable-quick-skip');

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

  const configState = {
    titleTruncate: isFinite(maxTitleUnits),
    userTruncate: isFinite(maxUserUnits),
    maxTitleUnits: isFinite(maxTitleUnits) ? maxTitleUnits : DEFAULT_MAX_UNITS,
    maxUserUnits: isFinite(maxUserUnits) ? maxUserUnits : DEFAULT_MAX_UNITS,
    hideAvatar,
    enableCopy,
    hideOrig,
    enableMenu,
    enableGuard,
    enablePlanAdder,
    enableAutoRenew,
    enableRankingFilter: enableRankingFilterSetting,
    enableSubmitter,
    autoExit: initialAutoExit,
    useCustomColors,
    palette: Object.assign({}, palette),
    enableVjLink,
    hideDoneSkip,
    enableQuickSkip,
    widthMode,
    themeMode
  };

  if (!enableGuard) {
    disableNeedWarn();
  }

  pinBtn.classList.toggle('bn-pinned', pinned);
  if (pinned) {
    panel.classList.add('bn-show');
    container.style.pointerEvents = 'auto';
  }

  titleOpts.style.display = configState.titleTruncate ? 'block' : 'none';
  userOpts.style.display = configState.userTruncate ? 'block' : 'none';
  planOpts.style.display = configState.enablePlanAdder ? 'block' : 'none';

  COLOR_KEYS.forEach(k => {
    colorPickers[k] = document.getElementById(`bn-color-${k}`);
    hexInputs[k] = document.getElementById(`bn-color-${k}-hex`);

    if (colorPickers[k] && hexInputs[k]) {
      const initial = configState.palette[k] || palette[k];
      colorPickers[k].value = initial;
      hexInputs[k].value = initial;

      colorPickers[k].addEventListener('input', () => {
        hexInputs[k].value = colorPickers[k].value;
      });
      colorPickers[k].addEventListener('change', () => {
        const val = colorPickers[k].value;
        hexInputs[k].value = val;
        configState.palette[k] = val;
        palette[k] = val;
        if (!chkUseColor.checked) {
          chkUseColor.checked = true;
          configState.useCustomColors = true;
          container.classList.add('bn-expanded');
          panel.classList.add('bn-expanded');
          colorSidebar.classList.add('bn-show');
        }
        commitChanges();
      });
      hexInputs[k].addEventListener('input', () => {
        const v = hexInputs[k].value.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
          const val = v.startsWith('#') ? v : '#' + v;
          colorPickers[k].value = val;
        }
      });
      hexInputs[k].addEventListener('change', () => {
        const v = hexInputs[k].value.trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(v)) {
          hexInputs[k].value = configState.palette[k];
          alert('请输入有效的 6 位十六进制颜色值');
          return;
        }
        const val = v.startsWith('#') ? v : '#' + v;
        colorPickers[k].value = val;
        configState.palette[k] = val;
        palette[k] = val;
        if (!chkUseColor.checked) {
          chkUseColor.checked = true;
          configState.useCustomColors = true;
          container.classList.add('bn-expanded');
          panel.classList.add('bn-expanded');
          colorSidebar.classList.add('bn-show');
        }
        commitChanges();
      });
    }
  });

  function parsePositiveInt(value) {
    const v = parseInt(value, 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  const RELOAD_DELAY = 800;
  let reloadTimer = null;
  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => location.reload(), RELOAD_DELAY);
  }

  function persistConfig() {
    GM_setValue('maxTitleUnits', configState.titleTruncate ? configState.maxTitleUnits : 'none');
    GM_setValue('maxUserUnits', configState.userTruncate ? configState.maxUserUnits : 'none');
    GM_setValue(WIDTH_MODE_KEY, configState.widthMode);
    GM_setValue('hideAvatar', configState.hideAvatar);
    GM_setValue('enableCopy', configState.enableCopy);
    GM_setValue('hideOrig', configState.hideOrig);
    GM_setValue('hideDoneSkip', configState.hideDoneSkip);
    GM_setValue('enableQuickSkip', configState.enableQuickSkip);
    GM_setValue('enableUserMenu', configState.enableMenu);
    GM_setValue('enableGuard', configState.enableGuard);
    GM_setValue('enableVjLink', configState.enableVjLink);
    GM_setValue('enablePlanAdder', configState.enablePlanAdder);
    GM_setValue('enableAutoRenew', configState.enableAutoRenew);
    GM_setValue('enableSubmitter', configState.enableSubmitter);
    GM_setValue('rankingFilter.enabled', configState.enableRankingFilter);
    GM_setValue('planAdder.autoExit', configState.autoExit);
    autoExit = configState.autoExit;
    GM_setValue(THEME_KEY, configState.themeMode);
    const obj = {};
    COLOR_KEYS.forEach(k => {
      obj[k] = configState.palette[k] || palette[k];
    });
    GM_setValue('userPalette', JSON.stringify(obj));
    GM_setValue('useCustomColors', configState.useCustomColors);
  }

  function commitChanges() {
    persistConfig();
    scheduleReload();
  }

  function toggleOption(chk, el) {
    if (chk.checked) {
      el.style.display = 'block';
      el.style.animation = 'slideDown 0.3s ease-out';
    } else {
      el.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => { el.style.display = 'none'; }, 300);
    }
  }

  function syncSubmitterState(enabled) {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') return;
    try {
      chrome.runtime.sendMessage({ type: 'bn_toggle_submitter', enabled });
    } catch (e) {}
  }

  const chkTitleTrEl = document.getElementById('bn-enable-title-truncate');
  const chkUserTrEl = document.getElementById('bn-enable-user-truncate');

  chkTitleTrEl.addEventListener('change', () => {
    toggleOption(chkTitleTrEl, titleOpts);
    configState.titleTruncate = chkTitleTrEl.checked;
    if (chkTitleTrEl.checked) {
      const parsed = parsePositiveInt(titleInp.value);
      if (parsed === null) {
        titleInp.value = configState.maxTitleUnits;
      } else {
        configState.maxTitleUnits = parsed;
      }
    }
    commitChanges();
  });
  chkUserTrEl.addEventListener('change', () => {
    toggleOption(chkUserTrEl, userOpts);
    configState.userTruncate = chkUserTrEl.checked;
    if (chkUserTrEl.checked) {
      const parsed = parsePositiveInt(userInp.value);
      if (parsed === null) {
        userInp.value = configState.maxUserUnits;
      } else {
        configState.maxUserUnits = parsed;
      }
    }
    commitChanges();
  });
  titleInp.addEventListener('change', () => {
    if (!chkTitleTrEl.checked) return;
    const parsed = parsePositiveInt(titleInp.value);
    if (parsed === null) {
      alert('请输入大于 0 的正整数');
      titleInp.value = configState.maxTitleUnits;
      return;
    }
    configState.maxTitleUnits = parsed;
    commitChanges();
  });
  userInp.addEventListener('change', () => {
    if (!chkUserTrEl.checked) return;
    const parsed = parsePositiveInt(userInp.value);
    if (parsed === null) {
      alert('请输入大于 0 的正整数');
      userInp.value = configState.maxUserUnits;
      return;
    }
    configState.maxUserUnits = parsed;
    commitChanges();
  });

  chkAv.addEventListener('change', () => {
    configState.hideAvatar = chkAv.checked;
    commitChanges();
  });
  chkCp.addEventListener('change', () => {
    configState.enableCopy = chkCp.checked;
    commitChanges();
  });
  chkHo.addEventListener('change', () => {
    configState.hideOrig = chkHo.checked;
    commitChanges();
  });
  chkMenu.addEventListener('change', () => {
    configState.enableMenu = chkMenu.checked;
    commitChanges();
  });
  chkGuard.addEventListener('change', () => {
    configState.enableGuard = chkGuard.checked;
    if (!chkGuard.checked) {
      disableNeedWarn();
    } else if (typeof window.__bnGuardOriginalNeedWarn === 'function') {
      window.needWarn = window.__bnGuardOriginalNeedWarn;
    } else {
      try {
        delete window.needWarn;
      } catch (e) {
        window.needWarn = undefined;
      }
    }
    commitChanges();
  });
  chkVj.addEventListener('change', () => {
    configState.enableVjLink = chkVj.checked;
    commitChanges();
  });
  chkHideDoneSkip.addEventListener('change', () => {
    configState.hideDoneSkip = chkHideDoneSkip.checked;
    applyHideDoneSkip(chkHideDoneSkip.checked);
    commitChanges();
  });
  chkQuickSkip.addEventListener('change', () => {
    configState.enableQuickSkip = chkQuickSkip.checked;
    applyQuickSkip(chkQuickSkip.checked);
    commitChanges();
  });
  chkPlan.addEventListener('change', () => {
    toggleOption(chkPlan, planOpts);
    configState.enablePlanAdder = chkPlan.checked;
    commitChanges();
  });
  chkAutoRenew.addEventListener('change', () => {
    configState.enableAutoRenew = chkAutoRenew.checked;
    commitChanges();
  });
  chkRankingFilter.addEventListener('change', () => {
    configState.enableRankingFilter = chkRankingFilter.checked;
    commitChanges();
  });
  chkSubmitter.addEventListener('change', () => {
    configState.enableSubmitter = chkSubmitter.checked;
    syncSubmitterState(chkSubmitter.checked);
    commitChanges();
  });
  chkPlanAuto.addEventListener('change', () => {
    configState.autoExit = chkPlanAuto.checked;
    autoExit = chkPlanAuto.checked;
    commitChanges();
  });
  widthModeSel.addEventListener('change', () => {
    configState.widthMode = widthModeSel.value;
    commitChanges();
  });

  chkUseColor.onchange = () => {
    const isChecked = chkUseColor.checked;
    configState.useCustomColors = isChecked;
    if (isChecked) {
      container.classList.add('bn-expanded');
      panel.classList.add('bn-expanded');
      setTimeout(() => colorSidebar.classList.add('bn-show'), 200);
    } else {
      colorSidebar.classList.remove('bn-show');
      setTimeout(() => { container.classList.remove('bn-expanded'); panel.classList.remove('bn-expanded'); }, 200);
    }
    commitChanges();
  };

  if (configState.useCustomColors) {
    container.classList.add('bn-expanded');
    panel.classList.add('bn-expanded');
    colorSidebar.classList.add('bn-show');
  }

  themeSelect.onchange = () => {
    const v = themeSelect.value;
    configState.themeMode = v;
    if (v === 'dark') container.classList.add('bn-dark');
    else if (v === 'light') container.classList.remove('bn-dark');
    else { prefersDark ? container.classList.add('bn-dark') : container.classList.remove('bn-dark'); }
    commitChanges();
  };

  let hideTimer = null;
  const showPanel = () => {
    if (isDragging || container.classList.contains('bn-dragging')) return;
    clearTimeout(hideTimer);
    panel.classList.add('bn-show');
    container.style.pointerEvents = 'auto';
  };
  const hidePanel = () => {
    if (pinned) return;
    panel.classList.remove('bn-show');
    container.style.pointerEvents = 'none';
    if (panel.contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (e) { }
    }
  };
  trigger.addEventListener('mouseenter', showPanel);
  trigger.addEventListener('focus', showPanel);
  const maybeHidePanel = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!pinned && !trigger.matches(':hover') && !panel.matches(':hover') && !container.matches(':hover')) {
        hidePanel();
      }
    }, 300);
  };
  trigger.addEventListener('mouseleave', maybeHidePanel);
  trigger.addEventListener('blur', maybeHidePanel);
  panel.addEventListener('mouseleave', maybeHidePanel);
  panel.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  panel.addEventListener('focusin', () => clearTimeout(hideTimer));

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
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (__bn_trail[mid].t < tgt) lo = mid + 1;
      else hi = mid - 1;
    }
    const a = __bn_trail[lo - 1], b = __bn_trail[lo];
    const r = (tgt - a.t) / Math.max(1, b.t - a.t);
    return { t: tgt, x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  }
  function __bn_applyTransform(x, y) {
    __bn_dragX = x;
    __bn_dragY = y;
    trigger.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  function __bn_tick() {
    if (!isDragging) { __bn_raf = null; return; }
    const sample = __bn_sampleAt(__bn_now() - __bn_lagMs);
    if (sample) __bn_applyTransform(sample.x - gearW / 2, sample.y - gearH / 2);
    __bn_raf = requestAnimationFrame(__bn_tick);
  }
  function __bn_onMove(e) {
    if (!isDragging) return;
    __bn_pushTrail(e);
    if (!__bn_raf) __bn_raf = requestAnimationFrame(__bn_tick);
  }
  function __bn_onUp(e) {
    if (!isDragging) return;
    isDragging = false;
    if (__bn_raf) cancelAnimationFrame(__bn_raf);
    __bn_raf = null;

    const cx = __bn_dragX + gearW / 2;
    const cy = __bn_dragY + gearH / 2;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const corners = {
      tl: { x: SNAP_MARGIN + gearW / 2, y: SNAP_MARGIN + gearH / 2 },
      tr: { x: W - SNAP_MARGIN - gearW / 2, y: SNAP_MARGIN + gearH / 2 },
      bl: { x: SNAP_MARGIN + gearW / 2, y: H - SNAP_MARGIN - gearH / 2 },
      br: { x: W - SNAP_MARGIN - gearW / 2, y: H - SNAP_MARGIN - gearH / 2 },
    };
    let best = 'br';
    let bestDist = Infinity;
    for (const key in corners) {
      const point = corners[key];
      const dx = point.x - cx;
      const dy = point.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = key;
      }
    }
    const finalX = corners[best].x - gearW / 2;
    const finalY = corners[best].y - gearH / 2;

    trigger.style.transition = 'transform 0.24s ease-out';
    __bn_applyTransform(finalX, finalY);

    setTimeout(() => {
      trigger.style.transition = '';
      applyCorner(best);
      trigger.style.position = '';
      trigger.style.left = trigger.style.top = '';
      trigger.style.bottom = trigger.style.right = '';
      trigger.style.transform = '';
      container.classList.remove('bn-dragging');
      if (wasPinned) showPanel();

      if (__bn_pointerId !== null && trigger.releasePointerCapture) {
        try { trigger.releasePointerCapture(__bn_pointerId); } catch (err) { }
      }
      document.removeEventListener('pointermove', __bn_onMove);
      document.removeEventListener('pointerup', __bn_onUp);
      document.removeEventListener('mousemove', __bn_onMove);
      document.removeEventListener('mouseup', __bn_onUp);
      __bn_trail = [];
      __bn_pointerId = null;
    }, 260);
  }
  const __bn_onDown = (e) => {
    if (e.type === 'mousedown' && window.PointerEvent) return;
    if ((e.type === 'mousedown' || e.type === 'pointerdown') && e.button !== 0) return;
    e.preventDefault();

    wasPinned = pinned;
    panel.classList.remove('bn-show');
    container.style.pointerEvents = 'none';

    const rect = trigger.getBoundingClientRect();
    gearW = rect.width;
    gearH = rect.height;
    trigger.style.position = 'fixed';
    trigger.style.left = '0px';
    trigger.style.top = '0px';
    trigger.style.bottom = 'auto';
    trigger.style.right = 'auto';
    trigger.style.transition = 'none';
    trigger.style.willChange = 'transform';
    trigger.style.touchAction = 'none';

    isDragging = true;
    container.classList.add('bn-dragging');

    __bn_trail = [];
    __bn_pushTrail(e);
    __bn_applyTransform(e.clientX - gearW / 2, e.clientY - gearH / 2);

    if (e.pointerId != null && trigger.setPointerCapture) {
      __bn_pointerId = e.pointerId;
      try { trigger.setPointerCapture(e.pointerId); } catch (err) { }
      document.addEventListener('pointermove', __bn_onMove);
      document.addEventListener('pointerup', __bn_onUp);
    } else {
      document.addEventListener('mousemove', __bn_onMove);
      document.addEventListener('mouseup', __bn_onUp);
    }
    if (!__bn_raf) __bn_raf = requestAnimationFrame(__bn_tick);
  };
  if (window.PointerEvent) {
    trigger.addEventListener('pointerdown', __bn_onDown, { passive: false });
  } else {
    trigger.addEventListener('mousedown', __bn_onDown, { passive: false });
  }

  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    GM_setValue('panelPinned', pinned);
    pinBtn.classList.toggle('bn-pinned', pinned);
    if (pinned) showPanel();
    else if (!trigger.matches(':hover') && !panel.matches(':hover')) hidePanel();
  });

  function markOnce(el, key) {
    const dataKey = `bn${key}`;
    if (!el || !el.dataset) return true;
    if (el.dataset[dataKey]) return false;
    el.dataset[dataKey] = '1';
    return true;
  }

  document.getElementById('bn-color-reset').onclick = () => {
    const base = palettes[(themeSelect.value === 'auto' ? (prefersDark ? 'dark' : 'light') : themeSelect.value)] || palettes.light;
    COLOR_KEYS.forEach(k => {
      if (colorPickers[k] && hexInputs[k]) {
        colorPickers[k].value = base[k];
        hexInputs[k].value = base[k];
        configState.palette[k] = base[k];
        palette[k] = base[k];
      }
    });
    chkUseColor.checked = true;
    configState.useCustomColors = true;
    container.classList.add('bn-expanded'); panel.classList.add('bn-expanded'); colorSidebar.classList.add('bn-show');
    commitChanges();
  };

  if (enableAutoRenew) initAutoRenew();

  function unitOfCharByMode(codePoint, mode) {
    if (mode === 'char') return 1;
    if (mode === 'visual') return codePoint > 255 ? 2 : 1;
    if (codePoint <= 0x7F) return 1;
    if (codePoint <= 0x7FF) return 2;
    if (codePoint <= 0xFFFF) return 3;
    return 4;
  }
  function truncateByUnits(str, maxU) {
    if (!isFinite(maxU)) return str;
    let used = 0, out = '';
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      const w = unitOfCharByMode(cp, widthModeSel.value || widthMode);
      if (used + w > maxU) { out += '...'; break; }
      out += ch; used += w;
    }
    return out;
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

  const users = await loadUsersData();

  function firstVisibleCharOfTitle() {
    const h1 = document.querySelector('body > div:nth-child(2) > div > div.ui.center.aligned.grid > div > h1');
    if (!h1) return '';
    const s = (h1.textContent || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    return s ? s[0].toUpperCase() : '';
  }

  function fEasierClip() {
    if (!/\/problem\//.test(location.pathname)) return;
    if (firstVisibleCharOfTitle() === 'L') return;
    if (document.getElementById('bn-copy-btn')) return;

    let link = document.querySelector('div.ui.buttons.right.floated > a');
    if (!link) {
      for (const g of document.querySelectorAll('div.ui.center.aligned.grid')) {
        const candBox = g.querySelector('div.ui.buttons.right.floated');
        if (candBox?.firstElementChild?.tagName === 'A') { link = candBox.firstElementChild; break; }
      }
    } else if (link.previousSibling) {
      link = link.parentElement?.firstElementChild || link;
    }
    if (!link) return;
    if (hideOrig) link.style.display = 'none';

    const btn = document.createElement('a');
    btn.id = 'bn-copy-btn';
    btn.className = 'small ui button';
    btn.textContent = '复制题面';
    function stripLeadingBlank(text) {
      let s = text.replace(/\r\n/g, '\n');
      s = s.replace(/^[\uFEFF\u200B-\u200D\u2060]+/, '');
      s = s.replace(/^(?:[ \t]*\n)+/, '');
      return s;
    }

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

    let baseText = '';
    a.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) baseText += n.textContent; });
    baseText = baseText.trim();

    let finalText = '';
    if (info) {
      finalText = (img ? '\u00A0' : '') + info.name;
      const c = palette[info.colorKey];
      if (c) a.style.color = c;
    } else {
      finalText = (img ? '\u00A0' : '') + truncateByUnits(baseText || a.textContent.trim(), maxUserUnits);
    }

    Array.from(a.childNodes).forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
    a.insertAdjacentHTML('beforeend', finalText);
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

  function createQuickSkipButton(problemId) {
    const btn = document.createElement('a');
    btn.setAttribute('data-bn-quick-skip', '1');
    btn.href = `/problem/${problemId}/skip`;
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
      location.reload();
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
  // 初次遍历
  document.querySelectorAll('a[href^="/user/"]').forEach(processUserLink);
  document.querySelectorAll('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span').forEach(processProblemTitle)
  applyQuickSkip(enableQuickSkip);
  applyHideDoneSkip(hideDoneSkip);
  ;

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
  if (enableMenu) initUserMenu();
  if (enableVjLink) fVjudgeLink();

})();

/* =================================================================
 *  二、计划添加器（PlanAdder）—— 轻量优化：列索引缓存、防重复等
 * ================================================================= */
(function () {
  'use strict';

  const CFG = {
    base: location.origin,
    tzOffsetHours: 8,
    DEBUG: true,
    DELIM: '|'
  };

  const SEL = {
    table: 'table.ui.very.basic.center.aligned.table',
    thead: 'table.ui.very.basic.center.aligned.table thead > tr',
    tbody: 'table.ui.very.basic.center.aligned.table tbody',
    rows: 'table.ui.very.basic.center.aligned.table tbody > tr',
    linkIn: 'a[href^="/problem/"]'
  };

  const KEY = {
    mode: 'planAdder.mode',
    selected: 'planAdder.selected.v4', // { [iso]: [{pid, code}] }
    date: 'planAdder.date',
    barPos: 'planAdder.barPos',
    autoExit: 'planAdder.autoExit',
    pending: 'planAdder.pending.v1'
  };

  const enablePlanAdder = GM_getValue('enablePlanAdder', true);
  let modeOn = !!GM_getValue(KEY.mode, false);
  const PADDER_HANDLED_FLAG = '__bnPlanHandled';

  const normalizeSelectedEntry = (o) => {
    if (!o || typeof o !== 'object') return null;
    const rawPid = o.pid;
    const pidNum = Number(rawPid);
    const pid = pidNum || (typeof rawPid === 'string' ? rawPid : null);
    const code = typeof o.code === 'string' ? o.code.trim() : '';
    if (!pid || !code || /^L/i.test(code)) return null;
    return { pid, code };
  };

  const loadSelectionStore = () => {
    const raw = GM_getValue(KEY.selected, {});
    if (Array.isArray(raw)) {
      const legacy = raw
        .map(normalizeSelectedEntry)
        .filter(Boolean);
      return legacy.length ? { __legacy__: legacy } : {};
    }
    if (!raw || typeof raw !== 'object') return {};
    const store = {};
    for (const [iso, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      const cleaned = list
        .map(normalizeSelectedEntry)
        .filter(Boolean);
      if (cleaned.length) store[iso] = cleaned;
    }
    return store;
  };

  let selectionStore = loadSelectionStore();
  const persistSelectionStore = () => GM_setValue(KEY.selected, selectionStore);
  const maybeAdoptLegacySelection = (iso) => {
    if (!iso || typeof iso !== 'string') return;
    if (!selectionStore[iso] && selectionStore.__legacy__) {
      selectionStore[iso] = selectionStore.__legacy__;
      delete selectionStore.__legacy__;
      persistSelectionStore();
    }
  };
  const selectionFor = (iso) => {
    if (iso && selectionStore[iso]) {
      return new Map(selectionStore[iso].map(({ pid, code }) => [pid, code]));
    }
    if (selectionStore.__legacy__) {
      return new Map(selectionStore.__legacy__.map(({ pid, code }) => [pid, code]));
    }
    return new Map();
  };
  const persistSelectionFor = (iso, map) => {
    const key = (iso && typeof iso === 'string') ? iso : '__legacy__';
    const arr = [...map]
      .map(([pid, code]) => ({ pid: Number(pid) || pid, code: typeof code === 'string' ? code : '' }))
      .map(normalizeSelectedEntry)
      .filter(Boolean);
    if (arr.length) selectionStore[key] = arr;
    else delete selectionStore[key];
    persistSelectionStore();
  };

  let selected = new Map();
  let autoExit = GM_getValue(KEY.autoExit, true);
  let observer = null;
  let currentDateIso = null;
  const planCache = new Map();
  let planRequestToken = 0;
  const normalizePendingEntry = (o) => {
    if (!o || typeof o !== 'object') return null;
    const pid = Number(o.pid);
    const code = typeof o.code === 'string' ? o.code.trim() : '';
    if (!pid || !code || /^L/i.test(code)) return null;
    return { pid, code };
  };
  const loadPendingStore = () => {
    const raw = GM_getValue(KEY.pending, {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const store = {};
    for (const [iso, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      const cleaned = list
        .map(normalizePendingEntry)
        .filter(Boolean);
      if (cleaned.length) store[iso] = cleaned;
    }
    return store;
  };
  let pendingStore = loadPendingStore();
  const pendingFor = (iso) => {
    if (!iso || typeof iso !== 'string') return new Map();
    const list = pendingStore[iso] || [];
    return new Map(list.map(({ pid, code }) => [Number(pid), code]));
  };
  const persistPendingStore = () => GM_setValue(KEY.pending, pendingStore);
  const persistPendingFor = (iso, map) => {
    if (!iso || typeof iso !== 'string') return;
    const arr = [...map]
      .map(([pid, code]) => ({ pid: Number(pid), code: typeof code === 'string' ? code : '' }))
      .map(normalizePendingEntry)
      .filter(Boolean);
    if (arr.length) pendingStore[iso] = arr;
    else delete pendingStore[iso];
    persistPendingStore();
  };
  let pendingSelected = new Map();
  const persistPending = () => {
    if (!currentDateIso) return;
    persistPendingFor(currentDateIso, pendingSelected);
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => CFG.DEBUG && console.log('[PlanAdder]', ...a);
  const txt = el => (el ? el.textContent.trim() : '');

  const tomorrowISO = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  };

  function patchDatePicker() {
    const install = (input) => {
      if (!input || input.dataset.bnTomorrowInstalled) return;
      const tomorrow = tomorrowISO();
      input.min = tomorrow;
      if (input.value < tomorrow) input.value = tomorrow;
      input.addEventListener('change', () => {
        if (input.value < tomorrow) input.value = tomorrow;
      });
      input.dataset.bnTomorrowInstalled = '1';
    };
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'date') install(el);
    }, true);
  }
  const offsetStr = h => { const s = h >= 0 ? '+' : '-', a = Math.abs(h); return `${s}${String(Math.floor(a)).padStart(2, '0')}:${String(Math.round((a - Math.floor(a)) * 60)).padStart(2, '0')}`; };
  const dateToEpoch = (iso, tz) => Math.floor(new Date(`${iso}T00:00:00${offsetStr(tz)}`).getTime() / 1000);

  const notify = m => GM_notification({ text: m, timeout: 2600 });

  let planToastStyleInjected = false;
  function showPlanToast(message) {
    if (!message) return;
    if (!planToastStyleInjected) {
      GM_addStyle(`
        #bn-plan-toast-container{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;z-index:99999;pointer-events:none;}
        .bn-plan-toast{background:rgba(33,133,208,.92);color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;line-height:1.45;box-shadow:0 12px 28px rgba(0,0,0,.18);max-width:320px;opacity:0;transform:translateY(14px);transition:opacity .24s ease,transform .24s ease;pointer-events:auto;word-break:break-word;white-space:pre-line;}
        .bn-plan-toast.bn-plan-toast-visible{opacity:1;transform:translateY(0);}
      `);
      planToastStyleInjected = true;
    }
    let container = document.getElementById('bn-plan-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bn-plan-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'bn-plan-toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('bn-plan-toast-visible'));
    const duration = 3200;
    window.setTimeout(() => {
      toast.classList.remove('bn-plan-toast-visible');
      window.setTimeout(() => {
        toast.remove();
        if (!container.childElementCount) container.remove();
      }, 280);
    }, duration);
  }
  const persist = () => {
    const iso = currentDateIso && typeof currentDateIso === 'string' ? currentDateIso : null;
    persistSelectionFor(iso, selected);
  };

  let _codeColIdx = null; // 缓存编号列索引
  function codeColIndex() {
    if (_codeColIdx != null) return _codeColIdx;
    const ths = $$(SEL.thead + ' > th');
    for (let i = 0; i < ths.length; i++) {
      if (txt(ths[i]).replace(/\s+/g, '').includes('编号')) { _codeColIdx = i + 1; return _codeColIdx; }
    }
    _codeColIdx = null; return null;
  }
  const pidFromRow = r => (r.querySelector(SEL.linkIn)?.href.match(/\/problem\/(\d+)/) || [])[1] || null;
  const codeFromRow = r => {
    const idx = codeColIndex();
    if (!idx) return null;
    const td = r.querySelector(`td:nth-child(${idx})`);
    return txt(td?.querySelector('b') || td);
  };
  const isLProblemRow = (row) => {
    const code = codeFromRow(row);
    return !!code && /^L/i.test(code);
  };

  const findRowByPid = (pid) => {
    const num = Number(pid);
    if (!num) return null;
    return $$(SEL.rows).find(row => Number(pidFromRow(row)) === num) || null;
  };

  function ensureRowSelection(pid, on) {
    const row = findRowByPid(pid);
    if (!row) return;
    if (on && !row.querySelector('td.padder-cell')) {
      const cell = makeCell(row, pid);
      if (cell) row.prepend(cell);
    }
    attachRowToggle(row);
    const cb = row.querySelector('td.padder-cell input');
    if (cb) cb.checked = !!on;
    row.classList.toggle('padder-selected', !!(cb && cb.checked));
    if (cb) animateSelection(row);
  }

  function applyPlanSelections(ids, { replace = false } = {}) {
    if (replace) {
      selected.clear();
      $$(SEL.rows).forEach(row => {
        row.classList.remove('padder-selected');
        const cb = row.querySelector('td.padder-cell input');
        if (cb) cb.checked = false;
      });
    }
    const list = Array.isArray(ids) ? ids : [];
    const planIds = replace ? new Set() : null;
    for (const rawId of list) {
      const pid = Number(rawId);
      if (!pid) continue;
      if (planIds) planIds.add(pid);
      const row = findRowByPid(pid);
      const code = row ? (codeFromRow(row) || `#${pid}`) : `#${pid}`;
      const prev = selected.get(pid);
      if (!prev) {
        selected.set(pid, code);
      } else if (typeof prev === 'string' && prev.startsWith('#') && code && !code.startsWith('#')) {
        selected.set(pid, code);
      }
      ensureRowSelection(pid, true);
    }
    if (replace && planIds && planIds.size && pendingSelected.size) {
      let pendingChanged = false;
      for (const pid of [...pendingSelected.keys()]) {
        const num = Number(pid);
        if (num && planIds.has(num)) {
          pendingSelected.delete(pid);
          pendingChanged = true;
        }
      }
      if (pendingChanged) {
        persistPending();
      }
    }
    if (replace && pendingSelected.size) {
      for (const [rawPid, rawCode] of pendingSelected) {
        const pid = Number(rawPid);
        if (!pid) continue;
        const code = rawCode || `#${pid}`;
        selected.set(pid, code);
        ensureRowSelection(pid, true);
      }
    }
    persist();
    syncHeader();
    count();
  }

  function toggleButton() {
    const host = $('.ui.grid .row .four.wide.right.aligned.column') || document.body;
    if ($('#plan-toggle', host)) return;
    const btn = document.createElement('button');
    btn.id = 'plan-toggle'; btn.className = 'ui mini button'; btn.style.marginLeft = '8px';
    btn.textContent = modeOn ? '退出【添加计划】模式' : '进入【添加计划】模式';
    btn.onclick = () => { modeOn ? exitMode() : enterMode(); btn.textContent = modeOn ? '退出【添加计划】模式' : '进入【添加计划】模式'; };
    host.appendChild(btn);
  }

  function insertSelectColumn() {
    _codeColIdx = null; // 表头可能变化，先失效缓存

    const tr = $(SEL.thead);
    if (tr && !$('#padder-th', tr)) {
      const th = document.createElement('th');
      th.id = 'padder-th'; th.className = 'collapsing'; th.style.whiteSpace = 'nowrap';
      th.innerHTML = `<label title="本页全选"><input id="padder-all" type="checkbox" style="vertical-align:middle;"><span style="margin-left:4px;font-weight:normal;">全选</span></label>`;
      tr.prepend(th);
      $('#padder-all').onchange = e => {
        const on = e.target.checked;
        $$(SEL.rows).forEach(row => {
          const pid = +pidFromRow(row); if (!pid || isLProblemRow(row)) return;
          let cell = row.querySelector('td.padder-cell');
          if (!cell) { cell = makeCell(row, pid); if (cell) row.prepend(cell); }
          if (!cell) return;
          const cb = cell.firstChild; cb.checked = on;
          toggleSelect(row, pid, on, true);
        });
        count();
      };
    }
    $$(SEL.rows).forEach(row => {
      const pid = +pidFromRow(row); if (!pid) { row.querySelector('td.padder-cell')?.remove(); return; }
      if (!row.querySelector('td.padder-cell')) {
        const cell = makeCell(row, pid); if (cell) row.prepend(cell);
      }
      attachRowToggle(row);
      const on = selected.has(pid);
      const cb = row.querySelector('td.padder-cell input');
      if (cb) { cb.checked = on; }
      row.classList.toggle('padder-selected', on);
    });
    syncHeader();
  }
  function handlePlanRowClick(event, row) {
    if (!modeOn || event.defaultPrevented || event.button !== 0) return false;
    if (event[PADDER_HANDLED_FLAG]) return true;
    if (event.target?.closest?.('td.padder-cell')) return false;
    const pid = Number(pidFromRow(row));
    if (!pid || isLProblemRow(row)) return false;
    const cb = row.querySelector('td.padder-cell input');
    if (!cb) return false;
    const interactive = event.target?.closest?.('a,button,input,select,textarea,label');
    const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (interactive && interactive !== cb) {
      if (hasModifier) return false;
      if (interactive.matches?.('a[href]')) return false;
      event.preventDefault();
      event.stopPropagation();
    }
    event[PADDER_HANDLED_FLAG] = true;
    const next = !cb.checked;
    cb.checked = next;
    toggleSelect(row, pid, next, false);
    count();
    return true;
  }
  function attachRowToggle(row) {
    if (!row || row.dataset.padderToggleBound) return;
    row.dataset.padderToggleBound = '1';
    row.addEventListener('click', event => {
      if (event[PADDER_HANDLED_FLAG]) return;
      handlePlanRowClick(event, row);
    });
  }
  document.addEventListener('click', event => {
    if (!modeOn || event.defaultPrevented || event.button !== 0) return;
    if (event[PADDER_HANDLED_FLAG]) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target?.closest?.('td.padder-cell')) return;
    const row = event.target?.closest?.(SEL.rows);
    if (!row) return;
    handlePlanRowClick(event, row);
  }, true);
  function makeCell(row, pid) {
    const td = document.createElement('td');
    td.className = 'padder-cell'; td.style.textAlign = 'center'; td.style.padding = '6px';
    td.innerHTML = `<input type="checkbox" style="vertical-align:middle;">`;
    const cb = td.firstChild;
    cb.checked = selected.has(pid);
    cb.onchange = () => { toggleSelect(row, pid, cb.checked, false); count(); };
    row.classList.toggle('padder-selected', cb.checked);
    return td;
  }
  function animateSelection(row) {
    if (!row) return;
    row.classList.remove('padder-animate');
    void row.offsetWidth;
    row.classList.add('padder-animate');
  }
  function toggleSelect(row, pid, on, fromHeader) {
    const pidNum = Number(pid) || Number(pidFromRow(row));
    const key = pidNum || pid;
    const code = codeFromRow(row) || `#${pidNum || pid}`;
    if (on) selected.set(key, code); else selected.delete(key);
    if (pidNum) {
      if (on) pendingSelected.set(pidNum, code);
      else pendingSelected.delete(pidNum);
      persistPending();
    }
    row.classList.toggle('padder-selected', on);
    animateSelection(row);
    if (!fromHeader) syncHeader();
    persist();
  }
  function syncHeader() {
    const h = $('#padder-all'); if (!h) return;
    const ids = $$(SEL.rows)
      .filter(r => !isLProblemRow(r))
      .map(pidFromRow)
      .filter(Boolean)
      .map(Number);
    h.checked = ids.length && ids.every(id => selected.has(id));
  }

  function clearSelections(options = {}) {
    const {
      preservePending = false,
      preserveSelected = false,
      clearAll = false
    } = options;

    const pendingKeys = new Set(pendingSelected.keys());

    if (clearAll) {
      selected.clear();
    } else {
      for (const key of pendingKeys) {
        const pid = Number(key);
        const mapKey = Number.isNaN(pid) ? key : pid;
        selected.delete(mapKey);
        selected.delete(String(mapKey));
      }
    }

    if (!preservePending) {
      pendingSelected.clear();
    }

    persistPending();

    if (!preserveSelected) {
      persist();
    }

    if (clearAll) {
      $$('.padder-cell input').forEach(cb => cb.checked = false);
      $$(SEL.rows).forEach(r => r.classList.remove('padder-selected'));
    } else {
      for (const key of pendingKeys) {
        const row = findRowByPid(key);
        if (!row) continue;
        const cb = row.querySelector('td.padder-cell input');
        if (cb) cb.checked = false;
        row.classList.remove('padder-selected');
      }
    }

    syncHeader();
    count();
  }

  function toolbar() {
    if ($('#plan-bar')) return;
    const bar = document.createElement('div'); bar.id = 'plan-bar';
    bar.innerHTML = `
      <div class="padder">
        <span id="pad-handle" title="拖拽">⠿</span>
        <label>日期：<input type="date" id="pad-date"></label>
        <button class="ui mini button" id="pad-copy">复制编号</button>
        <button class="ui mini button" id="pad-clear">清空</button>
        <button class="ui mini red button" id="pad-delete-all">删除所有计划</button>
        <button class="ui mini primary button" id="pad-ok">确定（<span id="pad-count">0</span>）</button>
      </div>`;
    document.body.appendChild(bar);

    GM_addStyle(`
      #plan-bar{position:fixed;right:16px;bottom:120px;z-index:9999;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-width:calc(100vw - 32px);}
      #plan-bar .padder{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;white-space:nowrap;}
      #plan-bar .padder>*{flex:0 0 auto;}
      #pad-handle{cursor:move;opacity:.7}
      th#padder-th,td.padder-cell{width:46px;}
      .padder-selected{background:rgba(0,150,255,.06)!important;transition:background-color .24s ease;}
      .padder-animate{animation:padder-pulse .45s ease;}
      @keyframes padder-pulse{0%{box-shadow:0 0 0 0 rgba(0,150,255,0);transform:scale(1);}40%{box-shadow:0 0 0 6px rgba(0,150,255,.18);transform:scale(1.01);}100%{box-shadow:0 0 0 0 rgba(0,150,255,0);transform:scale(1);}}
    `);

    const date = $('#pad-date');
    const tomorrow = tomorrowISO();
    date.min = tomorrow;
    date.value = GM_getValue(KEY.date, tomorrow);
    if (date.value < tomorrow) date.value = tomorrow;
    currentDateIso = date.value;
    maybeAdoptLegacySelection(currentDateIso);
    selected = selectionFor(currentDateIso);
    insertSelectColumn();
    persist();
    pendingSelected = pendingFor(currentDateIso);
    if (pendingSelected.size) {
      let changed = false;
      for (const [pid, code] of pendingSelected) {
        const pidNum = Number(pid);
        if (!pidNum) continue;
        if (!selected.has(pidNum)) { selected.set(pidNum, code); changed = true; }
        ensureRowSelection(pidNum, true);
      }
      if (changed) persist();
      syncHeader();
      count();
    }
    const initSync = syncExistingPlan(currentDateIso, { force: true, silent: true });
    if (initSync && typeof initSync.catch === 'function') {
      initSync.catch(err => log('initial sync failed', err));
    }
    date.onchange = async () => {
      if (date.value < tomorrow) date.value = tomorrow;
      GM_setValue(KEY.date, date.value);
      const newIso = date.value;
      const oldIso = currentDateIso;
      const changed = newIso !== currentDateIso;
      const previousPending = changed ? new Map(pendingSelected) : null;
      if (changed) clearSelections({ preservePending: true, preserveSelected: true, clearAll: true });
      currentDateIso = newIso;
      maybeAdoptLegacySelection(newIso);
      selected = selectionFor(newIso);
      insertSelectColumn();
      persist();
      pendingSelected = pendingFor(newIso);
      if (changed && previousPending && previousPending.size) {
        if (oldIso) persistPendingFor(oldIso, new Map());
        for (const [pid, code] of previousPending) {
          const pidNum = Number(pid);
          if (!pidNum) continue;
          pendingSelected.set(pidNum, code);
        }
        persistPendingFor(newIso, pendingSelected);
        pendingSelected = pendingFor(newIso);
      }
      if (pendingSelected.size) {
        let changedSelections = false;
        for (const [pid, code] of pendingSelected) {
          const pidNum = Number(pid);
          if (!pidNum) continue;
          if (!selected.has(pidNum)) { selected.set(pidNum, code); changedSelections = true; }
          ensureRowSelection(pidNum, true);
        }
        if (changedSelections) persist();
        syncHeader();
        count();
      }
      await syncExistingPlan(newIso, { force: true });
    };
    $('#pad-copy').onclick = () => { GM_setClipboard(JSON.stringify({ date: date.value, codes: [...selected.values()] }, null, 2)); notify(`已复制 ${selected.size} 个编号`); };
    $('#pad-clear').onclick = () => { if (!selected.size || !confirm('确认清空？')) return; clearSelections(); };
    $('#pad-delete-all').onclick = deleteAllPlans;
    $('#pad-ok').onclick = submitPlan;

    count();
    const pos = GM_getValue(KEY.barPos, null);
    if (pos) { bar.style.left = pos.left; bar.style.top = pos.top; bar.style.right = 'auto'; bar.style.bottom = 'auto'; }
    drag(bar, $('#pad-handle'));
  }
  function count() { const el = $('#pad-count'); if (el) el.textContent = selected.size; }
  function drag(el, handle) {
    let sx, sy, sl, st, d = false;
    handle.onmousedown = e => {
      d = true; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); sl = r.left; st = r.top;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      window.onmousemove = ev => { if (!d) return; const L = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, sl + ev.clientX - sx)); const T = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, st + ev.clientY - sy)); el.style.left = L + 'px'; el.style.top = T + 'px'; };
      window.onmouseup = () => { d = false; window.onmousemove = null; window.onmouseup = null; GM_setValue(KEY.barPos, { left: el.style.left, top: el.style.top }); };
      e.preventDefault();
    };
  }

  function observe() {
    const root = $(SEL.tbody) || document.body;
    observer?.disconnect();
    observer = new MutationObserver(() => { if (modeOn) insertSelectColumn(); });
    observer.observe(root, { childList: true, subtree: true });
  }

  function gmFetch(opts) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        ...opts, withCredentials: true,
        onload: r => {
          log(opts.method || 'GET', opts.url, r.status, (r.responseText || '').slice(0, 160));
          r.status >= 200 && r.status < 300 ? res(r) : rej(new Error(`HTTP ${r.status}: ${(r.responseText || '').slice(0, 200)}`));
        },
        onerror: e => rej(new Error(e.error || '网络错误'))
      });
    });
  }

  async function fetchPlanJSON({ uid, epoch }) {
    const r = await gmFetch({
      url: CFG.base + `/user_plan?user_id=${uid}&date=${epoch}&type=day&format=json`,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Referer': `${CFG.base}/user_plans/${uid}`
      }
    });
    let j = {};
    try { j = JSON.parse(r.responseText || '{}'); } catch { }
    const up = j.user_plan || {};
    const arr = String(up.problem_ids || '')
      .split(/[|,\s]+/)
      .map(x => Number(x))
      .filter(Boolean);
    return { id: up.id || up.plan_id || '', problemIds: arr };
  }

  async function syncExistingPlan(dateIso, { force = false, silent = false } = {}) {
    if (!dateIso) return null;
    const uid = getCurrentUserId();
    if (!uid) return null;
    const requestId = ++planRequestToken;
    const epoch = dateToEpoch(dateIso, CFG.tzOffsetHours);
    let meta = planCache.get(dateIso);
    if (!meta || force) {
      try {
        meta = await fetchPlanJSON({ uid, epoch });
        planCache.set(dateIso, { ...meta, epoch });
      } catch (err) {
        log('syncExistingPlan: fetch failed', err);
        if (requestId === planRequestToken && !silent) notify('[错误代码 D1] 未能读取计划，请稍后重试');
        return null;
      }
    }
    if (requestId !== planRequestToken) return meta || null;
    applyPlanSelections((meta && Array.isArray(meta.problemIds)) ? meta.problemIds : [], { replace: true });
    return meta;
  }

  function buildBody({ id, epoch, uid, values }) {
    const p = new URLSearchParams();
    if (id) p.set('id', String(id));
    p.set('type', 'day');
    p.set('date', String(epoch));
    p.set('user_id', String(uid));
    p.set('plan', ''); p.set('result', ''); p.set('tweak', '');
    p.set('problem_ids', values.join(CFG.DELIM));  // 用 | 分隔的数字ID
    return p.toString();
  }

  function postPlan(body, uid) {
    return gmFetch({
      url: CFG.base + '/user_plan',
      method: 'POST',
      data: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Origin': CFG.base,
        'Referer': `${CFG.base}/user_plans/${uid}`
      }
    });
  }

  function afterSuccess() {
    if (autoExit) {
      clearSelections({ clearAll: true });
      exitMode();
    }
  }

  async function deleteAllPlans() {
    const iso = $('#pad-date')?.value || tomorrowISO();
    currentDateIso = iso;
    const epoch = dateToEpoch(iso, CFG.tzOffsetHours);
    const uid = getCurrentUserId();
    if (!uid) { notify('[错误代码 DA1] 无法识别 user_id'); return; }

    let meta;
    try {
      meta = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...meta, epoch });
    } catch (err) {
      log('deleteAllPlans: fetch existing plan failed', err);
      notify('[错误代码 DA2] 获取已有计划失败，请稍后再试');
      return;
    }

    const hasServerPlan = Array.isArray(meta.problemIds) && meta.problemIds.length > 0;
    const hasLocalPlan = selected.size > 0 || pendingSelected.size > 0;

    if (!hasServerPlan && !hasLocalPlan && !meta.id) {
      clearSelections({ clearAll: true });
      planCache.set(iso, { ...meta, epoch, problemIds: [] });
      notify(`当前 ${iso} 无计划可删除`);
      return;
    }

    if (!confirm(`确认删除 ${iso} 的所有计划？此操作无法恢复。`)) return;

    if (!hasServerPlan && !meta.id) {
      clearSelections({ clearAll: true });
      planCache.set(iso, { ...meta, epoch, problemIds: [] });
      notify(`已删除 ${iso} 的所有计划`);
      showPlanToast(`计划删除完成\n已清空 ${iso} 的所有题目`);
      return;
    }

    try {
      const body = buildBody({ id: meta.id, epoch, uid, values: [] });
      await postPlan(body, uid);
      const after = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...after, epoch });
      const cleared = !Array.isArray(after.problemIds) || after.problemIds.length === 0;
      if (cleared) {
        clearSelections({ clearAll: true });
        notify(`已删除 ${iso} 的所有计划`);
        showPlanToast(`计划删除完成\n已清空 ${iso} 的所有题目`);
        return;
      }
    } catch (err) {
      log('deleteAllPlans: delete failed', err);
    }

    notify('[错误代码 DA3] 未能删除计划，请稍后再试');
  }

  async function submitPlan() {
    const iso = $('#pad-date')?.value || tomorrowISO();
    currentDateIso = iso;
    const epoch = dateToEpoch(iso, CFG.tzOffsetHours);
    const uid = getCurrentUserId();
    if (!uid) { notify('[错误代码 B1] 无法识别 user_id'); return; }

    const rawSelectedKeys = [...selected.keys()];
    const selectedIds = rawSelectedKeys.map(Number).filter(Boolean);
    if (!selectedIds.length && selected.size) {
      notify('[错误代码 B2] 未解析到数字ID');
      return;
    }

    let meta;
    try {
      meta = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...meta, epoch });
    } catch (err) {
      log('submitPlan: fetch existing plan failed', err);
      notify('[错误代码 B3] 获取已有计划失败，请稍后再试');
      return;
    }

    const baseList = Array.isArray(meta.problemIds) ? meta.problemIds.map(Number).filter(Boolean) : [];
    const baseSet = new Set(baseList);
    const selectedSet = new Set(selectedIds);

    if (!selectedSet.size && !baseSet.size) {
      notify('[提示] 当前无题目可提交');
      return;
    }

    const desired = [];
    const seen = new Set();
    for (const id of baseList) {
      if (selectedSet.has(id) && !seen.has(id)) { desired.push(id); seen.add(id); }
    }
    for (const id of selectedIds) {
      if (!seen.has(id)) { desired.push(id); seen.add(id); }
    }

    const addedCount = desired.filter(id => !baseSet.has(id)).length;
    const removedCount = baseList.filter(id => !selectedSet.has(id)).length;
    const confirmMsg = `将提交 ${desired.length} 个题目（新增 ${addedCount} 个，移除 ${removedCount} 个）到 ${iso}？`;
    if (!confirm(confirmMsg)) return;

    const planId = meta.id;

    try {
      const body = buildBody({ id: planId, epoch, uid, values: desired });
      await postPlan(body, uid);
      const after = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...after, epoch });
      const ok = Array.isArray(after.problemIds)
        && desired.length === after.problemIds.length
        && desired.every((x, i) => after.problemIds[i] === x);
      if (ok) {
        pendingSelected.clear();
        persistPending();
        if (!autoExit) applyPlanSelections(after.problemIds || [], { replace: true });
        const successMsg = `保存成功：新增 ${addedCount} 题，移除 ${removedCount} 题，共 ${desired.length} 题`;
        notify(successMsg);
        showPlanToast(`计划修改完成\n${successMsg}`);
        afterSuccess();
        return;
      }
    } catch (e) { }

    const removedList = baseList.filter(id => !selectedSet.has(id));

    // 逐条同步，优先移除再补充
    try {
      let workingSet = new Set(baseList);
      let workingPlanId = planId;
      let latest = meta;

      for (const id of removedList) {
        if (!workingSet.has(id)) continue;
        workingSet.delete(id);
        const body2 = buildBody({ id: workingPlanId, epoch, uid, values: [...workingSet] });
        await postPlan(body2, uid);
        latest = await fetchPlanJSON({ uid, epoch });
        workingSet = new Set(latest.problemIds || []);
        workingPlanId = latest.id || workingPlanId;
      }

      for (const id of desired) {
        if (workingSet.has(id)) continue;
        workingSet.add(id);
        const body3 = buildBody({ id: workingPlanId, epoch, uid, values: [...workingSet] });
        await postPlan(body3, uid);
        latest = await fetchPlanJSON({ uid, epoch });
        workingSet = new Set(latest.problemIds || []);
        workingPlanId = latest.id || workingPlanId;
      }

      const bodyFinal = buildBody({ id: latest.id || workingPlanId, epoch, uid, values: desired });
      await postPlan(bodyFinal, uid);
      const final = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...final, epoch });
      const ok2 = Array.isArray(final.problemIds)
        && desired.length === final.problemIds.length
        && desired.every((x, i) => final.problemIds[i] === x);
      if (ok2) {
        pendingSelected.clear();
        persistPending();
        if (!autoExit) applyPlanSelections(final.problemIds || [], { replace: true });
        const successMsg2 = `保存成功（逐条同步）：新增 ${addedCount} 题，移除 ${removedCount} 题，共 ${desired.length} 题`;
        notify(successMsg2);
        showPlanToast(`计划修改完成\n${successMsg2}`);
        afterSuccess();
        return;
      }
    } catch (e) { }

    notify('[错误代码 C1] 提交未生效');
  }

  /* ========= 模式切换 ========= */
  function enterMode() {
    modeOn = true; GM_setValue(KEY.mode, true); insertSelectColumn(); toolbar(); observe();
    const b = $('#plan-toggle'); if (b) b.textContent = '退出【添加计划】';
  }
  function exitMode() {
    modeOn = false; GM_setValue(KEY.mode, false);
    $('#plan-bar')?.remove(); $('#padder-th')?.remove();
    $$(SEL.rows).forEach(r => { r.classList.remove('padder-selected'); r.querySelector('td.padder-cell')?.remove(); });
    const b = $('#plan-toggle'); if (b) b.textContent = '进入【添加计划】';
  }

  /* ========= 启动 ========= */
  patchDatePicker();
  const onTagPage = /\/problems\/tag\//.test(location.pathname);
  (function start() {
    if (enablePlanAdder && onTagPage) {
      toggleButton();
      if (modeOn) enterMode();
    } else {
      modeOn = false; GM_setValue(KEY.mode, false);
    }
  })();

})();

/* =================================================================
 *  六、提交记录页守护（未通过题目 → 弹出“是否继续”提示）
 * ================================================================= */
(function () {
  'use strict';
  try {
    if (!/\/submissions(\/|$)/.test(location.pathname)) return;

    const CFG = { base: location.origin };

    // 轻量选择器
    const $ = (s, r) => (r || document).querySelector(s);

    // 统一 GM_xhr（脚本前面已有 gmFetch，若不可用则降级到 fetch）
    const gmFetch = (opts) => new Promise((res, rej) => {
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            ...opts,
            withCredentials: true,
            onload: r => res(r),
            onerror: e => rej(new Error(e.error || '网络错误'))
          });
        } else {
          fetch(opts.url, { method: opts.method || 'GET', credentials: 'include' })
            .then(r => r.text().then(t => res({ status: r.status, responseText: t })))
            .catch(err => rej(err));
        }
      } catch (err) { rej(err); }
    });



    function ensureModal() {
      var IN_DURATION = 420;
      var OUT_DURATION = 420;
      var EASE_BOX = 'cubic-bezier(.2,.8,.2,1)';
      var SCALE_FROM = 0.88;

      // 强制全屏 & 居中，避免被站内样式拉到左上
      if (!document.getElementById('bn-center-css')) {
        var cs = document.createElement('style');
        cs.id = 'bn-center-css';
        cs.textContent = [
          '#bn-guard-mask{position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:2147483647!important;pointer-events:auto!important;}',
          '#bn-guard-box{position:static!important;top:auto!important;left:auto!important;margin:0!important;}'
        ].join('\n');
        document.head.appendChild(cs);
      }

      // 构建 DOM（保持站内结构/类名）
      var mask = document.getElementById('bn-guard-mask');
      if (!mask) {
        mask = document.createElement('div');
        mask.id = 'bn-guard-mask';
        document.body.appendChild(mask);
      }
      mask.className = 'ui dimmer modals page transition visible active';
      mask.style.display = 'flex';
      try { document.body.classList.add('dimmed'); } catch (e) { }
      mask.innerHTML = '';

      var modal = document.createElement('div');
      modal.id = 'bn-guard-box';
      modal.className = 'ui basic modal check-need-modal transition visible active';
      modal.style.position = 'static';
      modal.style.margin = '0';

      var header = document.createElement('div');
      header.className = 'ui icon header';
      var icon = document.createElement('i'); icon.className = 'exclamation triangle icon';
      header.appendChild(icon);
      header.appendChild(document.createTextNode('是否继续'));

      var content = document.createElement('div');
      content.className = 'content';
      content.textContent = '未通过题目前查看他人答案将获得较低的评级，请经过深入思考以后，确实难以解决再选择查看。';

      var actions = document.createElement('div');
      actions.className = 'actions';
      var ok = document.createElement('a'); ok.className = 'ui red ok inverted button'; ok.textContent = '确认';
      // 关键：取消按钮不要含 ok/approve/deny，避免被 Semantic UI 接管
      var cancel = document.createElement('button'); cancel.type = 'button';
      cancel.className = 'ui green inverted button bn-cancel';
      cancel.textContent = '取消';
      actions.appendChild(ok); actions.appendChild(cancel);

      modal.appendChild(header); modal.appendChild(content); modal.appendChild(actions);
      mask.appendChild(modal);

      // 捕获阶段阻断站内委托（只作用于本弹窗内部），避免立即关闭导致看不到动画
      function captureBlocker(ev) {
        // 只在我们这个弹窗内部拦截“无关点击”，放行确认和取消
        if (modal.contains(ev.target)) {
          // 放行确认按钮
          if (ev.target === ok) return;
          // 放行取消按钮（带 .bn-cancel 的元素或其子元素）
          if (ev.target.closest && ev.target.closest('.bn-cancel')) return;

          // 其它点击才拦截，避免被站内委托（Semantic UI）抢走
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        }
      }

      document.addEventListener('click', captureBlocker, true);

      // 工具
      var supportsWAAPI = typeof modal.animate === 'function';
      var animatingIn = true;
      var closing = false;
      actions.style.pointerEvents = 'none';

      function cleanup() {
        try { document.removeEventListener('click', captureBlocker, true); } catch (e) { }
        try { mask.remove(); } catch (e) { }
        try { document.body.classList.remove('dimmed'); } catch (e) { }
        if (mask.dataset) delete mask.dataset.bnHref;
        delete window.__bnConfirmCb;
      }
      function onTransitionEndOnce(el, cb, timeout) {
        var done = false;
        function finish() { if (done) return; done = true; try { el.removeEventListener('transitionend', handler); } catch (e) { }; cb && cb(); }
        function handler(ev) { if (ev && ev.target !== el) return; finish(); }
        el.addEventListener('transitionend', handler);
        setTimeout(finish, typeof timeout === 'number' ? timeout : 600);
      }
      function finished(anim, timeout) {
        return new Promise(function (resolve) {
          var done = false; function fin() { if (done) return; done = true; resolve(); }
          if (anim && anim.finished && typeof anim.finished.then === 'function') anim.finished.then(fin).catch(fin);
          else setTimeout(fin, timeout || 600);
        });
      }

      // 入场
      function animateIn() {
        mask.style.backgroundColor = 'rgba(0,0,0,0)';
        modal.style.transformOrigin = 'center center';
        if (supportsWAAPI) {
          var maskIn = mask.animate(
            [{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,0.85)' }],
            { duration: IN_DURATION, easing: 'ease', fill: 'forwards' }
          );
          var boxIn = modal.animate(
            [{ transform: 'scale(' + SCALE_FROM + ')', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
            { duration: IN_DURATION, easing: EASE_BOX, fill: 'forwards' }
          );
          Promise.all([finished(maskIn, IN_DURATION + 80), finished(boxIn, IN_DURATION + 80)]).then(function () {
            animatingIn = false; actions.style.pointerEvents = '';
          });
        } else {
          modal.style.transition = 'transform ' + IN_DURATION + 'ms ' + EASE_BOX + ', opacity ' + IN_DURATION + 'ms ease';
          mask.style.transition = 'background-color ' + IN_DURATION + 'ms ease';
          modal.style.transform = 'scale(' + SCALE_FROM + ')'; modal.style.opacity = '0';
          void modal.offsetHeight;
          requestAnimationFrame(function () {
            mask.style.backgroundColor = 'rgba(0,0,0,0.85)';
            modal.style.transform = 'scale(1)'; modal.style.opacity = '1';
            onTransitionEndOnce(modal, function () { animatingIn = false; actions.style.pointerEvents = ''; }, IN_DURATION + 80);
          });
        }
      }

      // 出场（反向动画）
      function animateOut(after) {
        if (closing || animatingIn) return;
        closing = true; actions.style.pointerEvents = 'none';
        var fromBg = getComputedStyle(mask).backgroundColor || 'rgba(0,0,0,0.85)';
        if (supportsWAAPI) {
          var maskOut = mask.animate(
            [{ backgroundColor: fromBg }, { backgroundColor: 'rgba(0,0,0,0)' }],
            { duration: OUT_DURATION, easing: 'ease', fill: 'forwards' }
          );
          var boxOut = modal.animate(
            [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(' + SCALE_FROM + ')', opacity: 0 }],
            { duration: OUT_DURATION, easing: EASE_BOX, fill: 'forwards' }
          );
          Promise.all([finished(maskOut, OUT_DURATION + 80), finished(boxOut, OUT_DURATION + 80)]).then(function () {

  // Disabled legacy guard in favor of final guard
  if (window.__bnUseFinalGuard) { return; }
            cleanup(); if (typeof after === 'function') try { after(); } catch (e) { }
          });
        } else {
          modal.style.transition = 'transform ' + OUT_DURATION + 'ms ' + EASE_BOX + ', opacity ' + OUT_DURATION + 'ms ease';
          mask.style.transition = 'background-color ' + OUT_DURATION + 'ms ease';
          mask.style.backgroundColor = 'rgba(0,0,0,0)';
          modal.style.transform = 'scale(' + SCALE_FROM + ')'; modal.style.opacity = '0';
          onTransitionEndOnce(modal, function () { cleanup(); if (typeof after === 'function') try { after(); } catch (e) { }; }, OUT_DURATION + 80);
        }
      }

      // 点击遮罩空白 => 反向动画
      mask.addEventListener('click', function (e) { if (e.target === mask) animateOut(); }, { once: true });

      // 外部 API（保持兼容）
      mask.bnConfirm = function (onYesOrHref) {
        if (typeof onYesOrHref === 'function') {
          window.__bnConfirmCb = onYesOrHref;
          if (mask.dataset) delete mask.dataset.bnHref;
        } else if (typeof onYesOrHref === 'string') {
          if (mask.dataset) mask.dataset.bnHref = onYesOrHref;
          window.__bnConfirmCb = null;
        }
        // 确认：立即关闭并跳转/回调
        ok.onclick = function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          cleanup();
          var href = (mask.dataset && mask.dataset.bnHref) || window.__bnPendingHref || ok.getAttribute('href');
          if (typeof window.__bnConfirmCb === 'function') { try { window.__bnConfirmCb(); } catch (e) { } }
          else if (href) { location.assign(href); }
        };
        // 取消：反向动画
        cancel.onclick = function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); // 双保险
          animateOut();
        };

      };

      // 兜底
      mask.bnAnimateOut = function () { animateOut(); };

      animateIn();
      return mask;
    }
    async function needWarn(problemId) {
      try {
        const r = await gmFetch({
          url: CFG.base + `/problem/${problemId}`,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const html = r.responseText || '';
        // 题目页上“提交记录/统计”按钮带有 check-need-button 时，代表未通过（element1.txt）
        return /class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(html)
          || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(html);
      } catch { return false; }
    }

    function extractProblemIdFromRow(row) {
      const a = $('a[href^="/problem/"]', row);
      const m = a && a.getAttribute('href').match(/\/problem\/(\d+)/);
      return m ? m[1] : null;
    }


    function extractSubmitterIdFromRow(row) {
      const a = $('a[href^="/user/"]', row);
      const m = a && a.getAttribute('href').match(/\/user\/(\d+)/);
      return m ? m[1] : null;
    }
    // 事件委托，拦截点击 /submission/{id}
    document.addEventListener('click', async (e) => {
      const a = e.target && (e.target.closest && e.target.closest('a[href^="/submission/"]'));
      if (!a) return;
      // 仅左键 & 非修饰键
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const tr = a.closest('tr');
      const pid = tr && extractProblemIdFromRow(tr);
      if (!pid) return; // 找不到题号就放行
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const warn = await (window.needWarn ? window.needWarn(pid) : needWarn(pid));
      if (!warn) {
        location.href = a.href;
        return;
      }
      const mask = ensureModal();
      mask.bnConfirm(() => { location.href = a.href; });
    }, true);

  } catch (err) {
    // console.warn('[7fa4-better] submissions-guard error:', err);
  }
})();


(function () {
  // Enable guard on /submissions and /problem/*/statistics/* pages
  var __bn_path = location.pathname || '';
  var __bn_onSubmissions = __bn_path.indexOf('/submissions') === 0;
  var __bn_onProblemStats = /^\/problem\/[^\/]+\/statistics(\/|$)/.test(__bn_path);
  if (!(__bn_onSubmissions || __bn_onProblemStats)) return;
  if (window.__bnGlobalBound) return;
  window.__bnGlobalBound = true;

  // 捕获最近点击的“提交记录”链接，作为确认时的兜底跳转目标
  document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest && e.target.closest('a[href^="/submission/"]');
    if (a) {
      window.__bnPendingHref = a.href;
    }
  }, true);

  // 保险：万一按钮监听丢失，用事件委托兜底
  document.addEventListener('click', function (e) {
    const okBtn = e.target && e.target.closest && e.target.closest('#bn-guard-box .ui.red.ok.inverted.button');
    if (okBtn) {
      e.preventDefault(); e.stopPropagation();
      const mask = document.getElementById('bn-guard-mask');
      if (mask) {
        const href = (mask.dataset && mask.dataset.bnHref) || window.__bnPendingHref || okBtn.getAttribute('href');
        try { mask.remove(); } catch { }
        try { document.body.classList.remove('dimmed'); } catch { }
        if (typeof window.__bnConfirmCb === 'function') {
          try { window.__bnConfirmCb(); } catch { }
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
        try { mask.remove(); } catch { }
        try { document.body.classList.remove('dimmed'); } catch { }
        delete window.__bnConfirmCb;
        if (mask.dataset) delete mask.dataset.bnHref;
      }
    }
  }, true);
})();

/* ===== SAFE PATCH: only warn when NOT passed (append-only) ===== */
(function () {
  const BASE = (window.CFG && window.CFG.base) ? window.CFG.base : '';

  // 兼容 gmFetch；没有就用 fetch 简实现
  const gmf = (typeof window.gmFetch === 'function')
    ? window.gmFetch
    : function (opt) {
      return fetch(opt.url, { headers: opt.headers || {} })
        .then(r => r.text())
        .then(t => ({ responseText: t }));
    };

  async function hasAccepted(problemId) {
    const uid = getCurrentUserId();
    if (!uid) return false;
    try {
      const url = `${BASE}/submissions?problem_id=${problemId}&submitter=${uid}&min_score=100&max_score=100&language=&status=`;
      const r = await gmf({ url, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const html = r && (r.responseText || r) || '';
      return /class="[^"]*\bstatus\b[^"]*\baccepted\b[^"]*"/i.test(html) || />\s*Accepted\s*</i.test(html);
    } catch (e) {
      return false;
    }
  }

  // 仅对“未通过”的题目弹窗：已通过 → false；否则兜底看题目页是否仍有 check-need-button
  window.needWarn = async function (problemId) {
    try {
      if (await hasAccepted(problemId)) return false;
    } catch (e) { /* ignore */ }

    try {
      const r = await gmf({ url: `${BASE}/problem/${problemId}`, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const html = r && (r.responseText || r) || '';
      return /class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(html)
        || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(html);
    } catch (e) {
      return false; // 失败则不弹，避免误伤
    }
  };
})();


/* ===== FINAL PATCH: needWarn uses itemList + userId to guard only when NOT passed ===== */
(function () {
  const BASE = (window.CFG && window.CFG.base) ? window.CFG.base : '';

  function sameOrigin(url) {
    try { return new URL(url, location.origin).origin === location.origin; } catch { return false; }
  }
  function safeFetch(url, headers) {
    if (sameOrigin(url) || url.startsWith('/')) {
      return fetch(url, { headers: headers || {}, credentials: 'include' })
        .then(r => r.text()).then(t => ({ responseText: t }));
    }
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url, headers: headers || {}, withCredentials: true,
          onload: r => resolve({ responseText: r.responseText }),
          onerror: reject, ontimeout: reject
        });
      });
    }
    return fetch(url, { headers: headers || {} }).then(r => r.text()).then(t => ({ responseText: t }));
  }

  function parseItemList(html) {
    const m = html && html.match(/const\s+itemList\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) {
      try { return Function('"use strict";return (' + m[1] + ')')(); } catch { return null; }
    }
  }

  function seenMineAndAccepted(list, uid) {
    let seenMine = false, hasAC = false;
    for (const it of (Array.isArray(list) ? list : [])) {
      const info = it && it.info;
      const res = it && it.result;
      if (!info || !res) continue;
      if (Number(info.userId) !== Number(uid)) continue;
      seenMine = true;
      const score = typeof res.score === 'number' ? res.score : parseInt(res.score || 0, 10);
      if ((res.result === 'Accepted') || (score === 100)) { hasAC = true; break; }
    }
    return { seenMine, hasAC };
  }

  function tableSeenMineAndAccepted(html, uid) {
    const m = html && html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!m) return { seenMine: false, hasAC: false };
    const tbody = m[1];
    const rows = tbody.split(/<\/tr>/i);
    let seenMine = false, hasAC = false;
    for (const row of rows) {
      if (row.indexOf('/user/' + uid) === -1) continue;
      seenMine = true;
      if (/\bstatus\b[^>]*\baccepted\b/i.test(row) || />\s*Accepted\s*</i.test(row)) { hasAC = true; break; }
    }
    return { seenMine, hasAC };
  }

  window.needWarn = async function (problemId) {
    const uid = getCurrentUserId();

    // 1) submissions 列表判断（首选）
    try {
      const r = await safeFetch(`${BASE}/submissions?problem_id=${encodeURIComponent(problemId)}`, { 'X-Requested-With': 'XMLHttpRequest' });
      const html = r && (r.responseText || r) || '';

      const list = parseItemList(html);
      if (list && Number.isFinite(uid)) {
        const { seenMine, hasAC } = seenMineAndAccepted(list, uid);
        if (seenMine) return !hasAC; // 看到了我的提交：有 AC 不拦；否则拦
        return true;                 // 没有任何我的提交：视为未通过 → 拦
      }
      if (Number.isFinite(uid)) {
        const { seenMine, hasAC } = tableSeenMineAndAccepted(html, uid);
        if (seenMine) return !hasAC;
        return true;
      }
    } catch (e) {
      // 继续走兜底
    }

    // 2) 题目页兜底（存在 check-need-button 通常代表未通过）
    try {
      const r2 = await safeFetch(`${BASE}/problem/${encodeURIComponent(problemId)}`, { 'X-Requested-With': 'XMLHttpRequest' });
      const h2 = r2 && (r2.responseText || r2) || '';
      if (/class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(h2)
        || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(h2)) {
        return true;
      }
      return false;
    } catch (e) {
      // 3) 最后兜底：保守拦，避免“全不拦”
      return true;
    }
  };
})();
/* === Patch: global needWarn (only guard when NOT passed) === */
(function () {
  try {
    if (window.__bnNeedWarnShimAdded) return; window.__bnNeedWarnShimAdded = true;
    const BASE = (window.CFG && window.CFG.base) ? window.CFG.base : location.origin;
    const gmf = (typeof window.gmFetch === 'function')
      ? window.gmFetch
      : (opt) => fetch(opt.url, { headers: opt.headers || {}, credentials: 'include' })
        .then(r => r.text()).then(t => ({ responseText: t }));

    async function hasAccepted(problemId) {
      const uid = getCurrentUserId();
      if (!uid) return false;
      try {
        const url = `${BASE}/submissions?problem_id=${problemId}&submitter=${uid}&min_score=100&max_score=100&language=&status=`;
        const r = await gmf({ url, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const html = r && (r.responseText || r) || '';
        return /class="[^"]*\bstatus\b[^"]*\baccepted\b[^"]*"/i.test(html) || />\s*Accepted\s*</i.test(html);
      } catch (e) { return False; }
    }

    if (typeof window.needWarn !== 'function') {
      window.needWarn = async function (problemId) {
        try { if (await hasAccepted(problemId)) return false; } catch (e) { }
        try {
          const r = await gmf({ url: `${BASE}/problem/${problemId}`, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          const html = r && (r.responseText || r) || '';
          return /class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(html)
            || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(html);
        } catch (e) { return false; }
      };
    }
  } catch (_e) { }
})();
/* === 7fa4 Better | Submission Guard (final) === */
(function () {
  try {
    if (window.__bnGuardFinalBound) return;
    window.__bnGuardFinalBound = true;

    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
    function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch { return true; } }
    function fetchText(u, headers) {
      if (sameOrigin(u) || u.startsWith('/')) return fetch(u, { credentials: 'include', headers: headers || {} }).then(r => r.text());
      return fetch(u, { headers: headers || {} }).then(r => r.text());
    }

    function parseItemList(html) {
      const m = html && html.match(/const\s+itemList\s*=\s*(\[[\s\S]*?\]);/);
      if (!m) return null;
      const raw = m[1];
      try { return JSON.parse(raw); } catch (e) {
        try { return Function('"use strict";return (' + raw + ')')(); } catch { return null; }
      }
    }
    function userAcceptedFromItemList(list, uid) {
      if (!Array.isArray(list)) return { seen: false, ac: false };
      let seen = false, ac = false;
      for (const it of list) {
        const info = (it && it.info) || {}; const res = (it && it.result) || {};
        if (Number(info.userId) !== Number(uid)) continue;
        seen = true;
        const score = typeof res.score === 'number' ? res.score : parseInt(res.score || 0, 10);
        if (res.result === 'Accepted' || score === 100) { ac = true; break; }
      }
      return { seen, ac };
    }
    function userAcceptedFromTable(html, uid) {
      const m = html && html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      if (!m) return { seen: false, ac: false };
      let seen = false, ac = false;
      const rows = m[1].split(/<\/tr>/i);
      for (const row of rows) {
        if (row.indexOf('/user/' + uid) === -1) continue;
        seen = true;
        if (/\bstatus\b[^>]*\baccepted\b/i.test(row) || />\s*Accepted\s*</i.test(row)) { ac = true; break; }
      }
      return { seen, ac };
    }

    async function needWarn(problemId) {
      const uid = getCurrentUserId();
      try {
        const html = await fetchText(`/submissions?problem_id=${encodeURIComponent(problemId)}`, { 'X-Requested-With': 'XMLHttpRequest' });
        if (Number.isFinite(uid)) {
          const list = parseItemList(html);
          if (list) {
            const { seen, ac } = userAcceptedFromItemList(list, uid);
            if (seen) return !ac; // seen & not AC => warn (true)
          } else {
            const { seen, ac } = userAcceptedFromTable(html, uid);
            if (seen) return !ac;
          }
        }
      } catch (e) {/* ignore */ }
      // fallback: look for check-need-button on problem page – existence means NOT passed
      try {
        const ph = await fetchText(`/problem/${encodeURIComponent(problemId)}`, { 'X-Requested-With': 'XMLHttpRequest' });
        if (/class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(ph)
          || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(ph)) {
          return true;
        }
      } catch (e) { }
      return false; // default allow
    }
    window.needWarn = needWarn; // expose

    function ensureSimpleModal() {
      var IN_DURATION = 420;
      var OUT_DURATION = 420;
      var EASE_BOX = 'cubic-bezier(.2,.8,.2,1)';
      var SCALE_FROM = 0.88;

      // 强制全屏 & 居中，避免被站内样式拉到左上
      if (!document.getElementById('bn-center-css')) {
        var cs = document.createElement('style');
        cs.id = 'bn-center-css';
        cs.textContent = [
          '#bn-guard-mask{position:fixed!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:2147483647!important;pointer-events:auto!important;}',
          '#bn-guard-box{position:static!important;top:auto!important;left:auto!important;margin:0!important;}'
        ].join('\n');
        document.head.appendChild(cs);
      }

      // 构建 DOM（保持站内结构/类名）
      var mask = document.getElementById('bn-guard-mask');
      if (!mask) {
        mask = document.createElement('div');
        mask.id = 'bn-guard-mask';
        document.body.appendChild(mask);
      }
      mask.className = 'ui dimmer modals page transition visible active';
      mask.style.display = 'flex';
      try { document.body.classList.add('dimmed'); } catch (e) { }
      mask.innerHTML = '';

      var modal = document.createElement('div');
      modal.id = 'bn-guard-box';
      modal.className = 'ui basic modal check-need-modal transition visible active';
      modal.style.position = 'static';
      modal.style.margin = '0';

      var header = document.createElement('div');
      header.className = 'ui icon header';
      var icon = document.createElement('i'); icon.className = 'exclamation triangle icon';
      header.appendChild(icon);
      header.appendChild(document.createTextNode('是否继续'));

      var content = document.createElement('div');
      content.className = 'content';
      content.textContent = '未通过题目前查看他人答案将获得较低的评级，请经过深入思考以后，确实难以解决再选择查看。';

      var actions = document.createElement('div');
      actions.className = 'actions';
      var ok = document.createElement('a'); ok.className = 'ui red ok inverted button'; ok.textContent = '确认';
      // 关键：取消按钮不要含 ok/approve/deny，避免被 Semantic UI 接管
      var cancel = document.createElement('button'); cancel.type = 'button';
      cancel.className = 'ui green inverted button bn-cancel';
      cancel.textContent = '取消';
      actions.appendChild(ok); actions.appendChild(cancel);

      modal.appendChild(header); modal.appendChild(content); modal.appendChild(actions);
      mask.appendChild(modal);

      // 捕获阶段阻断站内委托（只作用于本弹窗内部），避免立即关闭导致看不到动画
      function captureBlocker(ev) {
        // 只在我们这个弹窗内部拦截“无关点击”，放行确认和取消
        if (modal.contains(ev.target)) {
          // 放行确认按钮
          if (ev.target === ok) return;
          // 放行取消按钮（带 .bn-cancel 的元素或其子元素）
          if (ev.target.closest && ev.target.closest('.bn-cancel')) return;

          // 其它点击才拦截，避免被站内委托（Semantic UI）抢走
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        }
      }

      document.addEventListener('click', captureBlocker, true);

      // 工具
      var supportsWAAPI = typeof modal.animate === 'function';
      var animatingIn = true;
      var closing = false;
      actions.style.pointerEvents = 'none';

      function cleanup() {
        try { document.removeEventListener('click', captureBlocker, true); } catch (e) { }
        try { mask.remove(); } catch (e) { }
        try { document.body.classList.remove('dimmed'); } catch (e) { }
        if (mask.dataset) delete mask.dataset.bnHref;
        delete window.__bnConfirmCb;
      }
      function onTransitionEndOnce(el, cb, timeout) {
        var done = false;
        function finish() { if (done) return; done = true; try { el.removeEventListener('transitionend', handler); } catch (e) { }; cb && cb(); }
        function handler(ev) { if (ev && ev.target !== el) return; finish(); }
        el.addEventListener('transitionend', handler);
        setTimeout(finish, typeof timeout === 'number' ? timeout : 600);
      }
      function finished(anim, timeout) {
        return new Promise(function (resolve) {
          var done = false; function fin() { if (done) return; done = true; resolve(); }
          if (anim && anim.finished && typeof anim.finished.then === 'function') anim.finished.then(fin).catch(fin);
          else setTimeout(fin, timeout || 600);
        });
      }

      // 入场
      function animateIn() {
        mask.style.backgroundColor = 'rgba(0,0,0,0)';
        modal.style.transformOrigin = 'center center';
        if (supportsWAAPI) {
          var maskIn = mask.animate(
            [{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,0.85)' }],
            { duration: IN_DURATION, easing: 'ease', fill: 'forwards' }
          );
          var boxIn = modal.animate(
            [{ transform: 'scale(' + SCALE_FROM + ')', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
            { duration: IN_DURATION, easing: EASE_BOX, fill: 'forwards' }
          );
          Promise.all([finished(maskIn, IN_DURATION + 80), finished(boxIn, IN_DURATION + 80)]).then(function () {
            animatingIn = false; actions.style.pointerEvents = '';
          });
        } else {
          modal.style.transition = 'transform ' + IN_DURATION + 'ms ' + EASE_BOX + ', opacity ' + IN_DURATION + 'ms ease';
          mask.style.transition = 'background-color ' + IN_DURATION + 'ms ease';
          modal.style.transform = 'scale(' + SCALE_FROM + ')'; modal.style.opacity = '0';
          void modal.offsetHeight;
          requestAnimationFrame(function () {
            mask.style.backgroundColor = 'rgba(0,0,0,0.85)';
            modal.style.transform = 'scale(1)'; modal.style.opacity = '1';
            onTransitionEndOnce(modal, function () { animatingIn = false; actions.style.pointerEvents = ''; }, IN_DURATION + 80);
          });
        }
      }

      // 出场（反向动画）
      function animateOut(after) {
        if (closing || animatingIn) return;
        closing = true; actions.style.pointerEvents = 'none';
        var fromBg = getComputedStyle(mask).backgroundColor || 'rgba(0,0,0,0.85)';
        if (supportsWAAPI) {
          var maskOut = mask.animate(
            [{ backgroundColor: fromBg }, { backgroundColor: 'rgba(0,0,0,0)' }],
            { duration: OUT_DURATION, easing: 'ease', fill: 'forwards' }
          );
          var boxOut = modal.animate(
            [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(' + SCALE_FROM + ')', opacity: 0 }],
            { duration: OUT_DURATION, easing: EASE_BOX, fill: 'forwards' }
          );
          Promise.all([finished(maskOut, OUT_DURATION + 80), finished(boxOut, OUT_DURATION + 80)]).then(function () {

  // Disabled legacy guard in favor of final guard
  if (window.__bnUseFinalGuard) { return; }
            cleanup(); if (typeof after === 'function') try { after(); } catch (e) { }
          });
        } else {
          modal.style.transition = 'transform ' + OUT_DURATION + 'ms ' + EASE_BOX + ', opacity ' + OUT_DURATION + 'ms ease';
          mask.style.transition = 'background-color ' + OUT_DURATION + 'ms ease';
          mask.style.backgroundColor = 'rgba(0,0,0,0)';
          modal.style.transform = 'scale(' + SCALE_FROM + ')'; modal.style.opacity = '0';
          onTransitionEndOnce(modal, function () { cleanup(); if (typeof after === 'function') try { after(); } catch (e) { }; }, OUT_DURATION + 80);
        }
      }

      // 点击遮罩空白 => 反向动画
      mask.addEventListener('click', function (e) { if (e.target === mask) animateOut(); }, { once: true });

      // 外部 API（保持兼容）
      mask.bnConfirm = function (onYesOrHref) {
        if (typeof onYesOrHref === 'function') {
          window.__bnConfirmCb = onYesOrHref;
          if (mask.dataset) delete mask.dataset.bnHref;
        } else if (typeof onYesOrHref === 'string') {
          if (mask.dataset) mask.dataset.bnHref = onYesOrHref;
          window.__bnConfirmCb = null;
        }
        // 确认：立即关闭并跳转/回调
        ok.onclick = function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          cleanup();
          var href = (mask.dataset && mask.dataset.bnHref) || window.__bnPendingHref || ok.getAttribute('href');
          if (typeof window.__bnConfirmCb === 'function') { try { window.__bnConfirmCb(); } catch (e) { } }
          else if (href) { location.assign(href); }
        };
        // 取消：反向动画
        cancel.onclick = function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); // 双保险
          animateOut();
        };

      };

      // 兜底
      mask.bnAnimateOut = function () { animateOut(); };

      animateIn();
      return mask;
    }

    function getPidFromRow(tr) {
      const a = tr && tr.querySelector('td:nth-child(2) a[href^="/problem/"]');
      if (!a) return null;
      const m = a.getAttribute('href').match(/\/problem\/(\d+)/);
      return m ? m[1] : null;
    }

    // Capture-phase click interception for /submission/{id}
    document.addEventListener('click', async function (e) {
      const a = e.target && (e.target.closest && e.target.closest('a[href^="/submission/"]'));
      if (!a) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const tr = a.closest('tr');
      const pid = getPidFromRow(tr);
      if (!pid) return; // unknown problem -> let it go

      e.preventDefault();
      try {
        const warn = await needWarn(pid); // true => 未通过，需要弹窗
        if (!warn) {
          location.href = a.href;
          return;
        }
      } catch (_) { /* on error, fall through to warn */ }

      const mask = (typeof window.ensureModal === 'function' ? ensureModal() : ensureSimpleModal());
      if (mask && typeof mask.bnConfirm === 'function') {
        mask.bnConfirm(() => { location.href = a.href; });
      }
    }, true);
  } catch (_e) { }
})();
/* === Patch: Submission Guard — scan *all* submissions (any AC across all pages) ===
 * 说明：这一补丁不删除原逻辑，只在文件末尾**覆写** window.needWarn：
 * - 先用带过滤条件的“提交记录”列表（submitter + score=100）直接判断是否存在任何 AC（跨页有效）；
 * - 若无法判定，再退回未过滤的提交记录页面，解析 itemList/table 看本页是否看到本人且是否有 AC；
 * - 仍无法判定，最后通过题目页上的 check-need-button 作为兜底（存在则拦）。
 * 结论：只要“所有提交中出现过一次 AC”（已通过），就不拦；否则就拦。
 */
(function () {
  try {
    var BASE = (window.CFG && window.CFG.base) ? window.CFG.base : location.origin;

    function sameOrigin(u) { try { return new URL(u, location.origin).origin === location.origin; } catch (e) { return false; } }
    function fetchText(u, headers) {
      var opt = { headers: headers || {} };
      if (sameOrigin(u) || (typeof u === 'string' && u.indexOf('/') === 0)) opt.credentials = 'include';
      return fetch(u, opt).then(function (r) { return r.text(); });
    }

    function parseItemList(html) {
      var m = html && html.match(/const\s+itemList\s*=\s*(\[[\s\S]*?\]);/);
      if (!m) return null;
      var raw = m[1];
      try { return JSON.parse(raw); }
      catch (e) { try { return Function('"use strict";return (' + raw + ')')(); } catch (_e) { return null; } }
    }

    function userSeenAndAnyACFromList(list, uid) {
      if (!Array.isArray(list)) return { seen: false, anyAC: false };
      var seen = false, anyAC = false;
      for (var i = 0; i < list.length; i++) {
        var it = list[i] || {};
        var info = it.info || {}, res = it.result || {};
        if (Number(info.userId) !== Number(uid)) continue;
        seen = true;
        var score = typeof res.score === 'number' ? res.score : parseInt(res.score || 0, 10);
        if (res.result === 'Accepted' || score === 100) { anyAC = true; break; }
      }
      return { seen: seen, anyAC: anyAC };
    }

    function userSeenAndAnyACFromTable(html, uid) {
      var m = html && html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
      if (!m) return { seen: false, anyAC: false };
      var seen = false, anyAC = false;
      var rows = m[1].split(/<\/tr>/i);
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.indexOf('/user/' + uid) === -1) continue;
        seen = true;
        if (/\bstatus\b[^>]*\baccepted\b/i.test(row) || />\s*Accepted\s*</i.test(row)) { anyAC = true; break; }
      }
      return { seen: seen, anyAC: anyAC };
    }

    async function hasAnyAcceptedAcrossAll(problemId) {
      const uid = getCurrentUserId();
      if (!uid) return null; // 无法识别登录用户

      // 1) 首选：使用过滤后的“仅本人 + 成功(100 分)”列表，天然跨页
      try {
        var urlOk = BASE + '/submissions?problem_id=' + encodeURIComponent(problemId)
          + '&submitter=' + encodeURIComponent(uid)
          + '&min_score=100&max_score=100&language=&status=';
        var hOk = await fetchText(urlOk, { 'X-Requested-With': 'XMLHttpRequest' });
        var listOk = parseItemList(hOk);
        if (listOk) {
          var r1 = userSeenAndAnyACFromList(listOk, uid);
          // 该过滤已限定“只看 100 分”，因此 seen=true 即视为存在 AC
          if (r1.seen) return true;
        } else {
          // 直接字符串判断 “Accepted” 即可
          if (/class="[^"]*\bstatus\b[^"]*\baccepted\b[^"]*"/i.test(hOk) || />\s*Accepted\s*</i.test(hOk)) return true;
          // 若能看到本人但没看到 Accepted，保守返回 false（见到本人但没有 AC）
          if (new RegExp('/user/' + uid).test(hOk)) return false;
        }
      } catch (e) { /* ignore */ }

      // 2) 次选：不加过滤，解析 itemList/table —— 仅能看到“当前页”的本人提交
      try {
        var url = BASE + '/submissions?problem_id=' + encodeURIComponent(problemId);
        var html = await fetchText(url, { 'X-Requested-With': 'XMLHttpRequest' });
        var list = parseItemList(html);
        if (list) {
          var r2 = userSeenAndAnyACFromList(list, uid);
          if (r2.seen) return r2.anyAC;
        } else {
          var r3 = userSeenAndAnyACFromTable(html, uid);
          if (r3.seen) return r3.anyAC;
        }
      } catch (e) { /* ignore */ }

      return null; // 仍无法判定，交给兜底
    }

    var WARN_CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存
    var warnCache = new Map();

    async function needWarnFallback(pid) {
      try {
        var ph = await fetchText(BASE + '/problem/' + encodeURIComponent(pid), { 'X-Requested-With': 'XMLHttpRequest' });
        if (/class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(ph)
          || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(ph)) {
          return true;
        }
      } catch (e) { /* ignore */ }
      return false;
    }

    // 覆写 needWarn：有 AC => 不拦；无 AC => 拦；无法判定 => 兜底看题目页
    window.needWarn = async function (problemId, opt) {
      var force = opt && opt.force;
      var now = Date.now();
      var hit = warnCache.get(problemId);
      if (!force && hit && now - hit.time < WARN_CACHE_TTL) return hit.value;

      var warn;
      try {
        var passed = await hasAnyAcceptedAcrossAll(problemId);
        if (passed === true) warn = false;
        else if (passed === false) warn = true;
      } catch (e) { /* ignore */ }
      if (warn === undefined) warn = await needWarnFallback(problemId);
      warnCache.set(problemId, { value: warn, time: now });
      return warn;
    };
    window.needWarn.clearCache = function () { warnCache.clear(); };
  } catch (_e) { /* ignore */ }
})();

/* === Guard Toggle Enforcement === */
(function () {
  try {
    const guardEnabled = !!GM_getValue('enableGuard', false);
    if (typeof window.needWarn === 'function' && !window.__bnGuardOriginalNeedWarn) {
      window.__bnGuardOriginalNeedWarn = window.needWarn;
    }
    if (!guardEnabled) {
      window.needWarn = async () => false;
    } else if (typeof window.__bnGuardOriginalNeedWarn === 'function') {
      window.needWarn = window.__bnGuardOriginalNeedWarn;
    }
  } catch (e) { /* ignore */ }
})();

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

/* =================================================================
 *  榜单页：学校筛选
 * ================================================================= */
(function () {
  'use strict';

  const PATH_RE = /^\/progress\/quiz/;
  if (!PATH_RE.test(location.pathname)) return;

  const TABLE_SELECTORS = [
    '.progress-table table',
    '.progress-container table',
    '.contest-table table',
    'table.ui.table',
    'table.table'
  ];

  const collator = (typeof Intl !== 'undefined' && typeof Intl.Collator === 'function')
    ? new Intl.Collator(['zh-Hans-CN', 'zh-CN', 'zh', 'zh-Hans'], { sensitivity: 'base', usage: 'sort' })
    : null;
  const FALLBACK_SCHOOL_NAME = '其他';
  const FALLBACK_GRADE_NAME = '未填写时年';

  let cssInjected = false;
  const RANKING_FILTER_ENABLED_KEY = 'rankingFilter.enabled';
  const RANKING_FILTER_SELECTED_KEY = 'rankingFilter.selected';
  const RANKING_FILTER_GRADE_KEY = 'rankingFilter.grade.selected';

  function injectCSS() {
    if (cssInjected) return;
    const css = `
    .bn-ranking-filter.ui.segment { margin-bottom: 1.5em; }
    .bn-ranking-filter .bn-filter-header { display: flex; align-items: center; justify-content: space-between; gap: .75em; flex-wrap: wrap; }
    .bn-ranking-filter .bn-filter-title { font-weight: 600; font-size: 1.05em; }
    .bn-ranking-filter .bn-filter-summary { margin-top: .5em; font-size: .9em; color: rgba(0,0,0,.6); }
    .bn-ranking-filter .bn-filter-summary.bn-active { color: #2185d0; font-weight: 600; }
    .bn-ranking-filter .bn-filter-count { margin-top: .25em; font-size: .85em; color: rgba(0,0,0,.5); }
    .bn-filter-group { margin-top: .75em; }
    .bn-filter-group-title { font-weight: 600; font-size: .95em; color: rgba(0,0,0,.55); }
    .bn-filter-options { display: flex; margin-top: .35em; gap: .35em 1.25em; flex-wrap: wrap; }
    .bn-filter-options label { display: inline-flex; align-items: center; gap: .4em; padding: .2em .4em; border-radius: .3em; cursor: pointer; }
    .bn-filter-options label:hover { background: rgba(33,133,208,.08); }
    .bn-filter-options input[type="checkbox"] { width: 16px; height: 16px; margin: 0; }
    .bn-filter-actions { margin-top: .75em; display: flex; gap: .5em; flex-wrap: wrap; }
    .bn-filter-actions .ui.button { flex-shrink: 0; }
    .bn-filter-hide { display: none !important; }
    @media (max-width: 640px) {
      .bn-filter-options { flex-direction: column; align-items: flex-start; }
      .bn-filter-actions { flex-direction: column; align-items: stretch; }
    }`;
    if (typeof GM_addStyle === 'function') GM_addStyle(css);
    else {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
    cssInjected = true;
  }

  function getText(node) {
    return (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function findTable(root = document) {
    for (const selector of TABLE_SELECTORS) {
      const table = root.querySelector(selector);
      if (table && table.tBodies && table.tBodies.length) return table;
    }
    const tables = root.querySelectorAll('table');
    for (const table of tables) {
      if (table && table.tBodies && table.tBodies.length) return table;
    }
    return null;
  }

  function waitForTable(timeout = 12000) {
    const existing = findTable();
    if (existing) return Promise.resolve(existing);
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const table = findTable();
        if (table) {
          observer.disconnect();
          resolve(table);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(findTable());
      }, timeout);
    });
  }

  function getCellValue(row, index) {
    if (!row || typeof index !== 'number' || index < 0) return '';
    const cell = row.cells && row.cells[index];
    if (!cell) return '';
    return getText(cell);
  }

  function isHeaderCell(row, index, headerText) {
    if (!row || typeof index !== 'number' || index < 0) return false;
    const cell = row.cells && row.cells[index];
    if (!cell) return false;
    const tag = (cell.tagName || '').toUpperCase();
    if (tag === 'TH') return true;
    const value = getText(cell);
    return !!headerText && value === headerText;
  }

  function annotateRow(row, schoolIndex, schoolHeaderText, gradeIndex, gradeHeaderText) {
    if (!row) return;
    const header = isHeaderCell(row, schoolIndex, schoolHeaderText)
      || isHeaderCell(row, gradeIndex, gradeHeaderText);
    if (header) row.dataset.bnHeaderRow = '1';
    else delete row.dataset.bnHeaderRow;

    if (typeof schoolIndex === 'number' && schoolIndex >= 0) {
      const value = header ? '' : getCellValue(row, schoolIndex) || FALLBACK_SCHOOL_NAME;
      row.dataset.bnSchool = value;
    } else {
      delete row.dataset.bnSchool;
    }

    if (typeof gradeIndex === 'number' && gradeIndex >= 0) {
      const value = header ? '' : getCellValue(row, gradeIndex) || FALLBACK_GRADE_NAME;
      row.dataset.bnGrade = value;
    } else {
      delete row.dataset.bnGrade;
    }
  }

  function isHeaderRow(row) {
    if (!row || !row.cells || !row.cells.length) return false;
    return Array.from(row.cells).every(cell => (cell.tagName || '').toUpperCase() === 'TH');
  }

  function collectRows(table) {
    const rows = [];
    if (!table || !table.tBodies) return rows;
    Array.from(table.tBodies).forEach(tbody => {
      rows.push(...Array.from(tbody.rows || []).filter(row => !isHeaderRow(row)));
    });
    return rows;
  }

  function detectSchoolColumn(table) {
    if (!table) return -1;
    const headers = table.querySelectorAll('thead th, th');
    for (let i = 0; i < headers.length; i += 1) {
      const text = getText(headers[i]);
      if (/学校|院校|单位|School/i.test(text)) return i;
    }
    const firstRow = table.tBodies && table.tBodies[0] && table.tBodies[0].rows[0];
    if (firstRow) {
      const cells = Array.from(firstRow.cells || []);
      for (let i = 0; i < cells.length; i += 1) {
        const text = getText(cells[i]);
        if (/大学|学院|学校|中学/.test(text)) return i;
      }
    }
    return -1;
  }

  function detectGradeColumn(table) {
    if (!table) return -1;
    const headers = table.querySelectorAll('thead th, th');
    for (let i = 0; i < headers.length; i += 1) {
      const text = getText(headers[i]);
      if (/时年|年级|年紀|年級|Grade/i.test(text)) return i;
    }
    const firstRow = table.tBodies && table.tBodies[0] && table.tBodies[0].rows[0];
    if (firstRow) {
      const cells = Array.from(firstRow.cells || []);
      for (let i = 0; i < cells.length; i += 1) {
        const text = getText(cells[i]);
        const className = cells[i].className || '';
        if (/时年|年级|年紀|年級|高一|高二|高三|初一|初二|初三|小学|一年级|二年级|Grade/i.test(text)) return i;
        if (/\bgrade\b/i.test(className) || /grade_\d+/i.test(className)) return i;
      }
    }
    return -1;
  }

  function uniqueSorted(values) {
    const arr = Array.from(new Set(values.filter(Boolean)));
    if (!arr.length) return arr;
    if (collator) return arr.sort((a, b) => collator.compare(a, b));
    return arr.sort((a, b) => a.localeCompare(b));
  }

  // Custom grade sorter: try to order grades from youngest -> oldest
  // e.g. 小一..小学.. -> 初一..初三 -> 高一..高三 -> 大一..大四 -> 毕业 / other
  function sortGrades(values) {
    const arr = Array.from(new Set(values.filter(Boolean)));
    if (!arr.length) return arr;

    const chineseMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

    function extractNum(s) {
      if (!s) return null;
      // try arabic numbers first
      const m = s.match(/(\d{1,4})/);
      if (m) return Number(m[1]);
      // try chinese numerals like 小五 初三
      const mc = s.match(/[一二三四五六七八九十]+/);
      if (mc) {
        const chars = mc[0].split('');
        // handle simple up to 10
        let v = 0;
        if (chars.length === 1) return chineseMap[chars[0]] || null;
        // rudimentary handling for 十, e.g. 十一
        for (let i = 0; i < chars.length; i++) v += chineseMap[chars[i]] || 0;
        return v || null;
      }
      return null;
    }

    function gradeKey(s) {
      const text = (s || '').trim();
      // level order: 小(小学) -> 初(初中) -> 高(高中) -> 大(大学) -> 毕业 -> 教练 -> 其他
      let level = 6;
      if (/小|小学|小学部/.test(text)) level = 0;
      else if (/初|初中|初级/.test(text)) level = 1;
      else if (/高|高中|高级/.test(text)) level = 2;
      else if (/大|大学|本科/.test(text)) level = 3;
      else if (/毕业|已毕业/.test(text)) level = 4;
      else if (/教练|老师|教师/.test(text)) level = 5;

      const num = extractNum(text);
      // For cohort-like labels such as "2022级", try to invert order so lower grade (more recent) considered younger
      // but keep numeric if it's small (<=12) as grade number
      let numKey = null;
      if (num != null) {
        if (num <= 12) numKey = num; // typical grade numbers
        else numKey = num; // fallback: large numbers will still be compared
      }
      return { level, num: numKey, raw: text };
    }

    arr.sort((a, b) => {
      const A = gradeKey(a);
      const B = gradeKey(b);
      if (A.level !== B.level) return A.level - B.level;
      if (A.num != null && B.num != null) return A.num - B.num;
      if (A.num != null) return -1;
      if (B.num != null) return 1;
      // fallback to locale compare
      if (collator) return collator.compare(A.raw, B.raw);
      return (A.raw || '').localeCompare(B.raw || '');
    });
    return arr;
  }

  function applyFilter(table, state) {
    const rows = collectRows(table).filter(row => row.dataset?.bnHeaderRow !== '1');
    const total = rows.length;
    if (!total) return { visible: 0, total: 0, summary: '暂无数据', active: false };
    if (!state.enabled) {
      rows.forEach(row => row.classList.remove('bn-filter-hide'));
      return { visible: total, total, summary: '未启用筛选', active: false };
    }
    const hasSchoolFilter = state.schoolSelected && state.schoolSelected.size > 0;
    const hasGradeFilter = state.gradeSelected && state.gradeSelected.size > 0;
    if (!hasSchoolFilter && !hasGradeFilter) {
      rows.forEach(row => row.classList.remove('bn-filter-hide'));
      return { visible: total, total, summary: '未选择筛选条件，显示全部', active: false };
    }
    let visible = 0;
    rows.forEach(row => {
      const key = row.dataset?.bnSchool || FALLBACK_SCHOOL_NAME;
      const grade = row.dataset?.bnGrade || FALLBACK_GRADE_NAME;
      const matchSchool = !hasSchoolFilter || state.schoolSelected.has(key);
      const matchGrade = !hasGradeFilter || state.gradeSelected.has(grade);
      if (matchSchool && matchGrade) {
        row.classList.remove('bn-filter-hide');
        visible += 1;
      } else {
        row.classList.add('bn-filter-hide');
      }
    });
    const parts = [];
    if (hasSchoolFilter) parts.push(`学校：${Array.from(state.schoolSelected).join('、')}`);
    if (hasGradeFilter) parts.push(`时年：${Array.from(state.gradeSelected).join('、')}`);
    return {
      visible,
      total,
      summary: parts.length ? `已选${parts.join('；')}` : '未选择筛选条件，显示全部',
      active: true
    };
  }

  function csvEscape(value) {
    const text = (value || '').replace(/\r?\n|\r/g, ' ').trim();
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function buildCsvFileName() {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `ranking-${iso}.csv`;
  }

  function exportVisibleRows(table) {
    const rows = collectRows(table).filter(row => row.dataset?.bnHeaderRow !== '1');
    if (!rows.length) return false;
    const headerRows = [];
    if (table.tHead && table.tHead.rows.length) {
      const head = table.tHead.rows[0];
      headerRows.push(Array.from(head.cells || []).map(cell => csvEscape(getText(cell))));
    }
    const bodyRows = rows
      .filter(row => !row.classList.contains('bn-filter-hide'))
      .map(row => Array.from(row.cells || []).map(cell => csvEscape(getText(cell))));
    if (!bodyRows.length) return false;
    const lines = [...headerRows, ...bodyRows].map(cols => cols.join(','));
    const content = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildCsvFileName();
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 0);
    return true;
  }

  function attachDownloadButton(table) {
    const button = document.querySelector('#table_download');
    if (!button) return null;
    if (button.classList) button.classList.add('ui', 'button', 'primary');
    if (!button.dataset.bnDownloadBound) {
      button.addEventListener('click', event => {
        const exported = exportVisibleRows(table);
        if (exported) {
          event.preventDefault();
        }
      });
      button.dataset.bnDownloadBound = '1';
    }
    return button;
  }

  function setupFilterUI(table, state, schools, grades) {
    injectCSS();
    const parent = table.parentElement || table;
    const panel = document.createElement('div');
    panel.className = 'ui segment bn-ranking-filter';
    panel.style.display = state.enabled && (schools.length || grades.length) ? '' : 'none';

    const header = document.createElement('div');
    header.className = 'bn-filter-header';
    const title = document.createElement('div');
    title.className = 'bn-filter-title';
    title.textContent = '榜单筛选';
    header.appendChild(title);
    panel.appendChild(header);

    const summary = document.createElement('div');
    summary.className = 'bn-filter-summary';
    summary.textContent = state.enabled ? '筛选已启用' : '未启用筛选';
    panel.appendChild(summary);

    const count = document.createElement('div');
    count.className = 'bn-filter-count';
    panel.appendChild(count);

    const schoolCheckboxRefs = [];
    const gradeCheckboxRefs = [];

    function createOptionGroup(titleText, options, checkboxRefs, type) {
      if (!options.length) return null;
      const group = document.createElement('div');
      group.className = 'bn-filter-group';
      const groupTitle = document.createElement('div');
      groupTitle.className = 'bn-filter-group-title';
      groupTitle.textContent = titleText;
      group.appendChild(groupTitle);
      const list = document.createElement('div');
      list.className = `bn-filter-options bn-${type}-select`;
      if (type === 'school') list.id = 'bn-school-select';
      if (type === 'grade') list.id = 'bn-grade-select';
      options.forEach(name => {
        const label = document.createElement('label');
        label.className = 'bn-filter-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        if (type === 'school') checkbox.dataset.school = name;
        if ((type === 'school' ? state.schoolSelected : state.gradeSelected).has(name)) checkbox.checked = true;
        label.append(checkbox, document.createTextNode(name));
        list.appendChild(label);
        checkboxRefs.push(checkbox);
      });
      group.appendChild(list);
      panel.appendChild(group);
      return list;
    }

    const schoolList = createOptionGroup('按学校', schools, schoolCheckboxRefs, 'school');
    const gradeList = createOptionGroup('按时年', grades, gradeCheckboxRefs, 'grade');

    if (!schools.length && !grades.length) {
      summary.textContent = '未找到可筛选的信息，暂无法筛选';
    }

    attachDownloadButton(table);

    if (parent && parent.insertBefore) parent.insertBefore(panel, table);
    else document.body.insertBefore(panel, document.body.firstChild);

    function syncCheckboxStates() {
      schoolCheckboxRefs.forEach(checkbox => {
        checkbox.checked = state.schoolSelected.has(checkbox.value);
        checkbox.disabled = !state.enabled;
      });
      gradeCheckboxRefs.forEach(checkbox => {
        checkbox.checked = state.gradeSelected.has(checkbox.value);
        checkbox.disabled = !state.enabled;
      });
    }

    function syncVisibility() {
      const visible = state.enabled && (schools.length > 0 || grades.length > 0);
      panel.style.display = visible ? '' : 'none';
    }

    function refresh() {
      syncCheckboxStates();
      const result = applyFilter(table, state);
      if (!schools.length && !grades.length) {
        summary.textContent = '未找到可筛选的信息，暂无法筛选';
        summary.classList.remove('bn-active');
        count.textContent = result.total ? `当前显示 ${result.visible} / ${result.total}` : '';
        return;
      }
      summary.textContent = result.summary;
      summary.classList.toggle('bn-active', !!result.active);
      count.textContent = result.total ? `当前显示 ${result.visible} / ${result.total}` : '';
    }

    function bindList(list, selectedSet, storageKey) {
      if (!list) return;
      list.addEventListener('change', event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
        if (!state.enabled) {
          target.checked = selectedSet.has(target.value);
          return;
        }
        if (target.checked) selectedSet.add(target.value);
        else selectedSet.delete(target.value);
        GM_setValue(storageKey, Array.from(selectedSet));
        refresh();
      });
    }

    bindList(schoolList, state.schoolSelected, RANKING_FILTER_SELECTED_KEY);
    bindList(gradeList, state.gradeSelected, RANKING_FILTER_GRADE_KEY);

    refresh();
    syncVisibility();

    return { panel, refresh, syncVisibility, syncCheckboxStates };
  }

  async function init() {
    injectCSS();
    const table = await waitForTable();
    if (!table) return;
    const schoolIndex = detectSchoolColumn(table);
    const gradeIndex = detectGradeColumn(table);
    const rows = collectRows(table);
    let schoolHeaderText = '';
    if (schoolIndex >= 0) {
      const headRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
      if (headRow && headRow.cells && headRow.cells[schoolIndex]) {
        schoolHeaderText = getText(headRow.cells[schoolIndex]);
      }
      if (!schoolHeaderText && table.tBodies && table.tBodies.length) {
        const maybeHeaderRow = table.tBodies[0].rows && table.tBodies[0].rows[0];
        if (maybeHeaderRow && maybeHeaderRow.cells && maybeHeaderRow.cells[schoolIndex]) {
          const candidateCell = maybeHeaderRow.cells[schoolIndex];
          const candidateText = getText(candidateCell);
          if ((candidateCell.tagName || '').toUpperCase() === 'TH' || /学校|院校|单位|School/i.test(candidateText)) {
            schoolHeaderText = candidateText;
          }
        }
      }
    }

    let gradeHeaderText = '';
    if (gradeIndex >= 0) {
      const headRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
      if (headRow && headRow.cells && headRow.cells[gradeIndex]) {
        gradeHeaderText = getText(headRow.cells[gradeIndex]);
      }
      if (!gradeHeaderText && table.tBodies && table.tBodies.length) {
        const maybeHeaderRow = table.tBodies[0].rows && table.tBodies[0].rows[0];
        if (maybeHeaderRow && maybeHeaderRow.cells && maybeHeaderRow.cells[gradeIndex]) {
          const candidateCell = maybeHeaderRow.cells[gradeIndex];
          const candidateText = getText(candidateCell);
          if ((candidateCell.tagName || '').toUpperCase() === 'TH' || /时年|年级|年紀|年級|Grade/i.test(candidateText)) {
            gradeHeaderText = candidateText;
          } 
        }
      }
    }

    rows.forEach(row => annotateRow(row, schoolIndex, schoolHeaderText, gradeIndex, gradeHeaderText));
    const schools = schoolIndex >= 0
      ? uniqueSorted(rows
        .filter(row => row.dataset?.bnHeaderRow !== '1')
        .map(row => row.dataset?.bnSchool || FALLBACK_SCHOOL_NAME))
      : [];
    const grades = gradeIndex >= 0
      ? sortGrades(rows
        .filter(row => row.dataset?.bnHeaderRow !== '1')
        .map(row => row.dataset?.bnGrade || FALLBACK_GRADE_NAME))
      : [];

    const savedSelectionRaw = GM_getValue(RANKING_FILTER_SELECTED_KEY, []);
    const savedSelection = Array.isArray(savedSelectionRaw)
      ? savedSelectionRaw
        .map(name => (typeof name === 'string' ? name.trim() : ''))
        .map(name => name || FALLBACK_SCHOOL_NAME)
        .filter(Boolean)
      : [];
    const dedupedSelection = Array.from(new Set(savedSelection));
    const validSelected = dedupedSelection.filter(name => schools.includes(name));
    if (validSelected.length !== dedupedSelection.length) {
      GM_setValue(RANKING_FILTER_SELECTED_KEY, validSelected);
    }

    const savedGradeRaw = GM_getValue(RANKING_FILTER_GRADE_KEY, []);
    const savedGrades = Array.isArray(savedGradeRaw)
      ? savedGradeRaw
        .map(name => (typeof name === 'string' ? name.trim() : ''))
        .map(name => name || FALLBACK_GRADE_NAME)
        .filter(Boolean)
      : [];
    const dedupedGrades = Array.from(new Set(savedGrades));
    const validGrades = dedupedGrades.filter(name => grades.includes(name));
    if (validGrades.length !== dedupedGrades.length) {
      GM_setValue(RANKING_FILTER_GRADE_KEY, validGrades);
    }

    const requestedEnabled = !!GM_getValue(RANKING_FILTER_ENABLED_KEY, false);
    const state = {
      enabled: requestedEnabled && (schools.length > 0 || grades.length > 0),
      requested: requestedEnabled,
      schoolSelected: new Set(validSelected),
      gradeSelected: new Set(validGrades)
    };

    setupFilterUI(table, state, schools, grades);
  }

  init().catch(err => console.error('[BN] Ranking enhancement failed', err));
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

