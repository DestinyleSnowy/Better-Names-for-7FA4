// Better Names for 7FA4
// 6.0.0 SP7 Developer

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
  const enableAutoRenew = GM_getValue('enableAutoRenew', false);
  const enableSubmitter = GM_getValue('enableSubmitter', true);
  const initialAutoExit = GM_getValue('planAdder.autoExit', true);
  let autoExit = initialAutoExit;
  const enableVjLink = GM_getValue('enableVjLink', true);
  const hideDoneSkip = GM_getValue('hideDoneSkip', false);
  const WIDTH_MODE_KEY = 'truncate.widthMode';
  const widthMode = GM_getValue(WIDTH_MODE_KEY, 'visual');
  const THEME_KEY = 'colorTheme';
  const themeMode = GM_getValue(THEME_KEY, 'auto');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveTheme = themeMode === 'auto' ? (prefersDark ? 'dark' : 'light') : themeMode;

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
      --bn-savebar-h: 48px;
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
      padding-bottom: calc(var(--bn-savebar-h) + var(--bn-version-h));
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
    .bn-save-actions {
      position: absolute;
      left: 0; right: 0;
      bottom: var(--bn-version-h);
      height: var(--bn-savebar-h);
      padding: 0 20px;
      border-top: 1px solid var(--bn-border-subtle);
      background: var(--bn-bg);
      display: flex; gap: 8px; justify-content: flex-end; align-items: center;
      opacity: 0; pointer-events: none; transform: translateY(12px);
      transition: opacity .28s cubic-bezier(.4, 0, .2, 1), transform .28s cubic-bezier(.4, 0, .2, 1);
      will-change: opacity, transform;
    }
    .bn-save-actions.bn-visible {
      opacity: 1; pointer-events: auto; transform: translateY(0);
    }

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

    @media (prefers-reduced-motion: reduce) {
      .bn-save-actions {
        transition: none;
        transform: none;
      }
      .bn-save-actions.bn-visible {
        transform: none;
      }
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
        <div class="bn-panel-subtitle">Generated By ChatGPT (o3, GPT-5 Thinking, Codex) and Manus</div>
      </div>
      <div class="bn-panel-content">
        <div class="bn-main-content">
          <div class="bn-section">
            <div class="bn-title">
              <svg class="bn-icon" viewBox="0 0 24 24"><path d="M6.13 1L6 16a2 2 0 002 2h15"/><path d="M1 6.13L16 6a2 2 0 012 2v15"/></svg>
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
              <svg class="bn-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              显示选项
            </div>
            <label><input type="checkbox" id="bn-hide-avatar" ${hideAvatar ? 'checked' : ''}/> 隐藏用户头像</label>
            <label><input type="checkbox" id="bn-enable-user-menu" ${enableMenu ? 'checked' : ''}/> 启用用户菜单</label>
            <label><input type="checkbox" id="bn-enable-vj" ${enableVjLink ? 'checked' : ''}/> 外站题目链接 Vjudge 按钮</label>
            <label><input type="checkbox" id="bn-enable-copy" ${enableCopy ? 'checked' : ''}/> 启用题面快捷复制</label>
            <label><input type="checkbox" id="bn-hide-orig" ${hideOrig ? 'checked' : ''}/> 隐藏题目源码按钮</label>
            <label><input type="checkbox" id="bn-hide-done-skip" ${hideDoneSkip ? 'checked' : ''}/> 隐藏已通过&已跳过题目</label>
          </div>
          <div class="bn-section">
          <div class="bn-title">
              <svg class="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              二三帮守护
            </div>
            <div class="bn-desc">该功能仍在精细实现中，仅供内部开发使用，暂未开放。</div>
          </div>
          <div class="bn-section">
            <div class="bn-title">
            <svg class="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <line x1="3" y1="12" x2="21" y2="12"/> <line x1="3" y1="6" x2="21" y2="6"/> <line x1="3" y1="18" x2="21" y2="18"/></svg>
              添加计划
            </div>
            <label><input type="checkbox" id="bn-enable-plan" ${enablePlanAdder ? 'checked' : ''}/> 启用添加计划</label>
            <div id="bn-plan-options">
              <label><input type="checkbox" id="bn-plan-auto" ${initialAutoExit ? 'checked' : ''}/> 完成后退出</label>
            </div>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg class="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.58-3.36L23 10"/>
                <path d="M20.49 15a9 9 0 0 1-14.58 3.36L1 14"/>
              </svg>
              自动更新
              <span class="bn-info">
                <span class="bn-info-icon" tabindex="0" role="button" aria-label="由于用户脚本只能在首个请求返回后才能运行，因此首个“原始”页面请求无法被阻止，当前实现已经尽快中止并改写。">?</span>
                <span class="bn-info-tooltip" role="tooltip">由于用户脚本只能在首个请求返回后才能运行，因此首个“原始”页面请求无法被阻止，当前实现已经尽快中止并改写。</span>
              </span>
            </div>
            <label><input type="checkbox" id="bn-enable-renew" ${enableAutoRenew ? 'checked' : ''}/> 启用题目自动更新</label>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg class="bn-icon" viewBox="0 0 24 24">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
              </svg>
              Submitter
            </div>
            <label><input type="checkbox" id="bn-enable-submitter" ${enableSubmitter ? 'checked' : ''}/> 启用 Submitter</label>
          </div>
          <div class="bn-section">
            <div class="bn-title">
              <svg class="bn-icon" viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
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
      <div class="bn-save-actions" id="bn-save-actions">
        <button class="bn-btn bn-btn-primary" id="bn-save-config">保存配置</button>
        <button class="bn-btn" id="bn-cancel-changes">取消更改</button>
      </div>
      <div class="bn-version">
        <div class="bn-version-text">6.0.0 SP7 Developer</div>
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
  const chkPlan = document.getElementById('bn-enable-plan');
  const chkAutoRenew = document.getElementById('bn-enable-renew');
  const chkSubmitter = document.getElementById('bn-enable-submitter');
  const planOpts = document.getElementById('bn-plan-options');
  const chkPlanAuto = document.getElementById('bn-plan-auto');
  const chkUseColor = document.getElementById('bn-use-custom-color');
  const themeSelect = document.getElementById('bn-theme-select');

  const colorSidebar = document.getElementById('bn-color-sidebar');
  const saveActions = document.getElementById('bn-save-actions');
  const chkVj = document.getElementById('bn-enable-vj');
  const chkHideDoneSkip = document.getElementById('bn-hide-done-skip');

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
    hideOrig,
    enableMenu,
    enablePlanAdder,
    enableAutoRenew,
    enableSubmitter,
    autoExit: initialAutoExit,
    useCustomColors,
    palette: Object.assign({}, palette),
    enableVjLink,
    hideDoneSkip,
    widthMode,
    themeMode
  };

  pinBtn.classList.toggle('bn-pinned', pinned);
  if (pinned) {
    panel.classList.add('bn-show');
    container.style.pointerEvents = 'auto';
  }

  titleOpts.style.display = originalConfig.titleTruncate ? 'block' : 'none';
  userOpts.style.display = originalConfig.userTruncate ? 'block' : 'none';
  planOpts.style.display = originalConfig.enablePlanAdder ? 'block' : 'none';

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

  themeSelect.onchange = () => {
    const v = themeSelect.value;
    if (v === 'dark') container.classList.add('bn-dark');
    else if (v === 'light') container.classList.remove('bn-dark');
    else { prefersDark ? container.classList.add('bn-dark') : container.classList.remove('bn-dark'); }
    checkChanged();
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
    if (panel.contains(document.activeElement)) document.activeElement.blur();
  };
  trigger.addEventListener('mouseenter', showPanel);
  const maybeHidePanel = () => {
    hideTimer = setTimeout(() => {
      if (!pinned && !trigger.matches(':hover') && !panel.matches(':hover') && !container.matches(':hover')) {
        hidePanel();
      }
    }, 300);
  };
  trigger.addEventListener('mouseleave', maybeHidePanel);
  panel.addEventListener('mouseleave', maybeHidePanel);

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
  function __bn_tick() {
    if (!isDragging) { __bn_raf = null; return; }
    const s = __bn_sampleAt(__bn_now() - __bn_lagMs);
    if (s) __bn_applyTransform(s.x - gearW / 2, s.y - gearH / 2);
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

    trigger.style.transition = 'transform 0.24s ease-out';
    __bn_applyTransform(fx, fy);

    setTimeout(() => {
      trigger.style.transition = '';
      applyCorner(best);
      trigger.style.position = '';
      trigger.style.left = trigger.style.top = '';
      trigger.style.bottom = trigger.style.right = '';
      trigger.style.transform = '';
      container.classList.remove('bn-dragging');
      if (wasPinned) { panel.classList.add('bn-show'); container.style.pointerEvents = 'auto'; }

      if (__bn_pointerId !== null && trigger.releasePointerCapture) { try { trigger.releasePointerCapture(__bn_pointerId); } catch (_) { } }
      document.removeEventListener('pointermove', __bn_onMove);
      document.removeEventListener('pointerup', __bn_onUp);
      document.removeEventListener('mousemove', __bn_onMove);
      document.removeEventListener('mouseup', __bn_onUp);
      __bn_trail = []; __bn_pointerId = null;
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
    gearW = rect.width; gearH = rect.height;
    trigger.style.position = 'fixed';
    trigger.style.left = '0px'; trigger.style.top = '0px';
    trigger.style.bottom = 'auto'; trigger.style.right = 'auto';
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
      try { trigger.setPointerCapture(e.pointerId); } catch (_) { }
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
    const changed =
      (document.getElementById('bn-enable-title-truncate').checked !== originalConfig.titleTruncate) ||
      (document.getElementById('bn-enable-user-truncate').checked !== originalConfig.userTruncate) ||
      (document.getElementById('bn-enable-title-truncate').checked && ti !== originalConfig.maxTitleUnits) ||
      (document.getElementById('bn-enable-user-truncate').checked && ui !== originalConfig.maxUserUnits) ||
      (document.getElementById('bn-hide-avatar').checked !== originalConfig.hideAvatar) ||
      (document.getElementById('bn-enable-copy').checked !== originalConfig.enableCopy) ||
      (document.getElementById('bn-hide-orig').checked !== originalConfig.hideOrig) ||
      (document.getElementById('bn-enable-user-menu').checked !== originalConfig.enableMenu) ||
      (document.getElementById('bn-enable-plan').checked !== originalConfig.enablePlanAdder) ||
      (document.getElementById('bn-enable-renew').checked !== originalConfig.enableAutoRenew) ||
      (document.getElementById('bn-enable-submitter').checked !== originalConfig.enableSubmitter) ||
      (document.getElementById('bn-enable-vj').checked !== originalConfig.enableVjLink) ||
      (document.getElementById('bn-hide-done-skip').checked !== originalConfig.hideDoneSkip) ||
      (document.getElementById('bn-plan-auto').checked !== originalConfig.autoExit) ||
      (document.getElementById('bn-use-custom-color').checked !== originalConfig.useCustomColors) ||
      (document.getElementById('bn-width-mode').value !== originalConfig.widthMode) ||
      (document.getElementById('bn-theme-select').value !== originalConfig.themeMode) ||
      paletteChanged;

    saveActions.classList.toggle('bn-visible', changed);
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

  chkTitleTrEl.onchange = () => { toggleOption(chkTitleTrEl, titleOpts); checkChanged(); };
  chkUserTrEl.onchange = () => { toggleOption(chkUserTrEl, userOpts); checkChanged(); };
  titleInp.oninput = checkChanged;
  userInp.oninput = checkChanged;

  chkAv.onchange = checkChanged;
  chkCp.onchange = () => { checkChanged(); };
  chkHo.onchange = checkChanged;
  chkMenu.onchange = checkChanged;
  chkVj.onchange = checkChanged;
  chkHideDoneSkip.onchange = () => { applyHideDoneSkip(chkHideDoneSkip.checked); checkChanged(); };
  chkPlan.onchange = () => { toggleOption(chkPlan, planOpts); checkChanged(); };
  chkAutoRenew.onchange = checkChanged;
  chkSubmitter.onchange = checkChanged;
  chkPlanAuto.onchange = () => { autoExit = chkPlanAuto.checked; checkChanged(); };
  widthModeSel.onchange = checkChanged;

  document.getElementById('bn-color-reset').onclick = () => {
    const base = palettes[(themeSelect.value === 'auto' ? (prefersDark ? 'dark' : 'light') : themeSelect.value)] || palettes.light;
    COLOR_KEYS.forEach(k => {
      if (colorPickers[k] && hexInputs[k]) {
        colorPickers[k].value = base[k];
        hexInputs[k].value = base[k];
      }
    });
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
    GM_setValue(WIDTH_MODE_KEY, widthModeSel.value);

    GM_setValue('hideAvatar', chkAv.checked);
    GM_setValue('enableCopy', chkCp.checked);
    GM_setValue('hideOrig', chkHo.checked);
    GM_setValue('hideDoneSkip', chkHideDoneSkip.checked);
    GM_setValue('enableUserMenu', chkMenu.checked);
    GM_setValue('enableVjLink', chkVj.checked);
    GM_setValue('enablePlanAdder', chkPlan.checked);
    GM_setValue('enableAutoRenew', chkAutoRenew.checked);
    GM_setValue('enableSubmitter', chkSubmitter.checked);
    GM_setValue('planAdder.autoExit', chkPlanAuto.checked);
    autoExit = chkPlanAuto.checked;

    GM_setValue(THEME_KEY, themeSelect.value);

    const obj = {};
    COLOR_KEYS.forEach(k => { if (colorPickers[k]) obj[k] = colorPickers[k].value; });
    GM_setValue('userPalette', JSON.stringify(obj));
    GM_setValue('useCustomColors', chkUseColor.checked);

    syncSubmitterState(chkSubmitter.checked);

    setTimeout(() => location.reload(), 50);
  };

  document.getElementById('bn-cancel-changes').onclick = () => {
    chkTitleTrEl.checked = originalConfig.titleTruncate;
    chkUserTrEl.checked = originalConfig.userTruncate;
    titleInp.value = isFinite(originalConfig.maxTitleUnits) ? originalConfig.maxTitleUnits : '';
    userInp.value = isFinite(originalConfig.maxUserUnits) ? originalConfig.maxUserUnits : '';
    widthModeSel.value = originalConfig.widthMode;

    chkAv.checked = originalConfig.hideAvatar;
    chkCp.checked = originalConfig.enableCopy;
    chkHo.checked = originalConfig.hideOrig;
    chkMenu.checked = originalConfig.enableMenu;
    chkVj.checked = originalConfig.enableVjLink;
    chkHideDoneSkip.checked = originalConfig.hideDoneSkip;
    applyHideDoneSkip(originalConfig.hideDoneSkip);
    chkPlan.checked = originalConfig.enablePlanAdder;
    chkAutoRenew.checked = originalConfig.enableAutoRenew;
    chkSubmitter.checked = originalConfig.enableSubmitter;
    chkPlanAuto.checked = originalConfig.autoExit;
    autoExit = originalConfig.autoExit;
    chkUseColor.checked = originalConfig.useCustomColors;
    themeSelect.value = originalConfig.themeMode;

    titleOpts.style.display = chkTitleTrEl.checked ? 'block' : 'none';
    userOpts.style.display = chkUserTrEl.checked ? 'block' : 'none';
    planOpts.style.display = chkPlan.checked ? 'block' : 'none';

    if (themeSelect.value === 'dark') container.classList.add('bn-dark');
    else if (themeSelect.value === 'light') container.classList.remove('bn-dark');
    else { prefersDark ? container.classList.add('bn-dark') : container.classList.remove('bn-dark'); }

    COLOR_KEYS.forEach(k => {
      if (colorPickers[k] && hexInputs[k]) {
        colorPickers[k].value = originalConfig.palette[k];
        hexInputs[k].value = originalConfig.palette[k];
      }
    });
    checkChanged();
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
        console.warn('Failed to resolve users.json via chrome.runtime.getURL', err);
      }
    }
    urls.push('data/users.json');
    for (const url of urls) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp && resp.ok) {
          return await resp.json();
        }
        console.warn(`Failed to load users.json from ${url}: ${resp ? resp.status : 'no response'}`);
      } catch (err) {
        console.warn(`Failed to load users.json from ${url}`, err);
      }
    }
    console.warn('Users data could not be loaded; using empty map.');
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
      const isSkip = !!evalTd.querySelector('i.coffee.icon');
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
  applyHideDoneSkip(hideDoneSkip);
  ;

  // 批处理观察器（rAF 合批）
  let moQueue = new Set();
  let moScheduled = false;
  function flushMO() {
    moScheduled = false;
    const nodes = Array.from(moQueue); moQueue.clear();
    for (const node of nodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('a[href^="/user/"]')) processUserLink(node);
      if (node.matches?.('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span')) processProblemTitle(node);
      node.querySelectorAll?.('a[href^="/user/"]').forEach(processUserLink);
      node.querySelectorAll?.('#vueAppFuckSafari > tbody > tr > td:nth-child(2) > a > span').forEach(processProblemTitle);
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
    selected: 'planAdder.selected.v4', // [{pid, code}]
    date: 'planAdder.date',
    barPos: 'planAdder.barPos',
    autoExit: 'planAdder.autoExit'
  };

  const enablePlanAdder = GM_getValue('enablePlanAdder', true);
  let modeOn = !!GM_getValue(KEY.mode, false);
  let selected = new Map(
    (GM_getValue(KEY.selected, []) || [])
      .filter(o => o.code && !/^L/i.test(o.code))
      .map(o => [o.pid, o.code])
  );
  let autoExit = GM_getValue(KEY.autoExit, true);
  let observer = null;

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
  const persist = () => GM_setValue(KEY.selected, [...selected].map(([pid, code]) => ({ pid, code })));

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
  const skipRow = r => {
    const c = codeFromRow(r);
    return c && /^L/i.test(c);
  };

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
          const pid = +pidFromRow(row); if (!pid || skipRow(row)) return;
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
      const pid = +pidFromRow(row); if (!pid || skipRow(row)) { row.querySelector('td.padder-cell')?.remove(); return; }
      if (!row.querySelector('td.padder-cell')) {
        const cell = makeCell(row, pid); if (cell) row.prepend(cell);
      }
      const on = selected.has(pid);
      const cb = row.querySelector('td.padder-cell input');
      if (cb) { cb.checked = on; }
      row.classList.toggle('padder-selected', on);
    });
    syncHeader();
  }
  function makeCell(row, pid) {
    if (skipRow(row)) return null;
    const td = document.createElement('td');
    td.className = 'padder-cell'; td.style.textAlign = 'center'; td.style.padding = '6px';
    td.innerHTML = `<input type="checkbox" style="vertical-align:middle;">`;
    const cb = td.firstChild;
    cb.checked = selected.has(pid);
    cb.onchange = () => { toggleSelect(row, pid, cb.checked, false); count(); };
    row.classList.toggle('padder-selected', cb.checked);
    return td;
  }
  function toggleSelect(row, pid, on, fromHeader) {
    if (skipRow(row)) return;
    const code = codeFromRow(row) || `#${pid}`;
    on ? selected.set(pid, code) : selected.delete(pid);
    row.classList.toggle('padder-selected', on);
    if (!fromHeader) syncHeader();
    persist();
  }
  function syncHeader() {
    const h = $('#padder-all'); if (!h) return;
    const ids = $$(SEL.rows)
      .filter(r => !skipRow(r))
      .map(pidFromRow)
      .filter(Boolean)
      .map(Number);
    h.checked = ids.length && ids.every(id => selected.has(id));
  }

  function clearSelections() {
    selected.clear();
    persist();
    $$('.padder-cell input').forEach(cb => cb.checked = false);
    $$(SEL.rows).forEach(r => r.classList.remove('padder-selected'));
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
        <button class="ui mini primary button" id="pad-ok">确定（<span id="pad-count">0</span>）</button>
      </div>`;
    document.body.appendChild(bar);

    GM_addStyle(`
      #plan-bar{position:fixed;right:16px;bottom:120px;z-index:9999;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:460px;max-width:90vw;}
      #plan-bar .padder{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      #pad-handle{cursor:move;opacity:.7}
      th#padder-th,td.padder-cell{width:46px;}
      .padder-selected{background:rgba(0,150,255,.06)!important;}
    `);

    const date = $('#pad-date');
    const tomorrow = tomorrowISO();
    date.min = tomorrow;
    date.value = GM_getValue(KEY.date, tomorrow);
    date.onchange = () => { if (date.value < tomorrow) date.value = tomorrow; GM_setValue(KEY.date, date.value); };
    $('#pad-copy').onclick = () => { GM_setClipboard(JSON.stringify({ date: date.value, codes: [...selected.values()] }, null, 2)); notify(`已复制 ${selected.size} 个编号`); };
    $('#pad-clear').onclick = () => { if (!selected.size || !confirm('确认清空？')) return; clearSelections(); };
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
      clearSelections();
      exitMode();
    }
  }

  async function submitPlan() {
    if (!selected.size) return notify('[错误代码 A1] 请先勾选题目');

    const iso = $('#pad-date')?.value || tomorrowISO();
    const epoch = dateToEpoch(iso, CFG.tzOffsetHours);
    const uid = getCurrentUserId(); if (!uid) { notify('[错误代码 B1] 无法识别 user_id'); return; }

    const addIds = [...selected.keys()].map(Number);
    if (!addIds.length) return notify('[错误代码 B2] 未解析到数字ID');

    if (!confirm(`将提交 ${addIds.length} 个题到 ${iso}？`)) return;

    // 1) 读取现有 plan → id + 已有IDs
    const meta = await fetchPlanJSON({ uid, epoch });
    const planId = meta.id;
    const set = new Set(meta.problemIds);
    addIds.forEach(i => set.add(i));
    const union = [...set];

    try {
      const body = buildBody({ id: planId, epoch, uid, values: union });
      await postPlan(body, uid);
      const after = await fetchPlanJSON({ uid, epoch });
      const ok = union.every(x => after.problemIds.includes(x));
      if (ok) { notify(`保存成功：加入 ${addIds.length} 题（共 ${union.length} 题）`); afterSuccess(); return; }
    } catch (e) { }

    // 逐条补齐
    try {
      for (const id of addIds) {
        const latest = await fetchPlanJSON({ uid, epoch });
        const s2 = new Set(latest.problemIds); s2.add(id);
        const body2 = buildBody({ id: latest.id || planId, epoch, uid, values: [...s2] });
        await postPlan(body2, uid);
      }
      const final = await fetchPlanJSON({ uid, epoch });
      const ok2 = union.every(x => final.problemIds.includes(x));
      if (ok2) { notify(`保存成功（逐条补齐）：加入 ${addIds.length} 题（共 ${union.length} 题）`); afterSuccess(); return; }
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
    console.warn('[7fa4-better] submissions-guard error:', err);
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
