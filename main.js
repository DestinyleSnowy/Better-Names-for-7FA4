// ==UserScript==
// @name         Better Names for 7FA4
// @namespace    http://tampermonkey.net/
// @version      v5.4.0
// @description  Better Names for 7FA4 v5.4.0.
// @author       wwxz
// @match        http://*.7fa4.cn:8888/*
// @exclude      http://*.7fa4.cn:9080/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// ==/UserScript==

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

(function () {
  'use strict';

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
    gitlab: 'http://jx.7fa4.cn:9080/yx/drive/-/tree/main/Better%20Names%20for%207FA4',
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
      margin-left: 24px; display: ${enablePlanAdder ? 'block' : 'none'}; padding-top: 8px;
      margin-top: 8px;
    }
    #bn-title-options, #bn-user-options {
      margin-left: 24px; padding-top: 8px; border-top: 1px solid var(--bn-border-subtle);
      margin-top: 8px;
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
        <div class="bn-version-text">v5.4.0</div>
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
    GM_setValue('planAdder.autoExit', chkPlanAuto.checked);
    autoExit = chkPlanAuto.checked;

    GM_setValue(THEME_KEY, themeSelect.value);

    const obj = {};
    COLOR_KEYS.forEach(k => { if (colorPickers[k]) obj[k] = colorPickers[k].value; });
    GM_setValue('userPalette', JSON.stringify(obj));
    GM_setValue('useCustomColors', chkUseColor.checked);

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

  const users = {
    1: { name: "陈许旻", colorKey: "jl" },
  2: { name: "唐子杰", colorKey: "uk" },
  3: { name: "杨智涵", colorKey: "uk" },
  4: { name: "杨智涵", colorKey: "g3" },
  5: { name: "蔡家翔", colorKey: "d1" },
  6: { name: "邵逸宸", colorKey: "d4" },
  7: { name: "徐子涵", colorKey: "g3" },
  8: { name: "周岳安慧", colorKey: "by" },
  9: { name: "李彦铮", colorKey: "g3" },
  10: { name: "周徐吉", colorKey: "d1" },
  11: { name: "何骐玮", colorKey: "g2" },
  12: { name: "张语桐", colorKey: "d1" },
  13: { name: "胡轩宁", colorKey: "g3" },
  14: { name: "罗翰昭", colorKey: "g3" },
  15: { name: "黄嘉玮", colorKey: "g3" },
  16: { name: "刘彻", colorKey: "g3" },
  17: { name: "梁佳俊", colorKey: "g2" },
  18: { name: "黄诗哲", colorKey: "g2" },
  19: { name: "刘承兴", colorKey: "by" },
  20: { name: "书承", colorKey: "by" },
  21: { name: "雷诣桁", colorKey: "g3" },
  22: { name: "冯思韬", colorKey: "g3" },
  23: { name: "黄皓坤", colorKey: "g3" },
  24: { name: "张宗耀", colorKey: "g3" },
  25: { name: "苏子洲", colorKey: "g3" },
  26: { name: "陈砚博", colorKey: "by" },
  27: { name: "陈俊懿", colorKey: "g3" },
  28: { name: "刘晋亨", colorKey: "g2" },
  29: { name: "彭俣哲", colorKey: "by" },
  30: { name: "宗天傲", colorKey: "g3" },
  31: { name: "李至擎", colorKey: "by" },
  32: { name: "张庭豪", colorKey: "by" },
  33: { name: "王翎熹", colorKey: "by" },
  34: { name: "李弩翰", colorKey: "g3" },
  35: { name: "周鸿博", colorKey: "g3" },
  36: { name: "张芮嘉", colorKey: "g3" },
  37: { name: "朱懿韬", colorKey: "g3" },
  38: { name: "陈邹睿洋", colorKey: "by" },
  39: { name: "林轩宇", colorKey: "g3" },
  40: { name: "陈邹睿洋", colorKey: "g3" },
  41: { name: "张迦尧", colorKey: "g3" },
  42: { name: "鞠子淇", colorKey: "g3" },
  43: { name: "彭俣哲", colorKey: "g3" },
  44: { name: "熊鹭飏", colorKey: "g3" },
  45: { name: "梁家瑞", colorKey: "g3" },
  46: { name: "谢奥升", colorKey: "g3" },
  47: { name: "谭轶丹", colorKey: "g3" },
  48: { name: "赵思哲", colorKey: "g3" },
  49: { name: "徐若宸", colorKey: "g3" },
  50: { name: "唐梓棋", colorKey: "g3" },
  51: { name: "鹿露", colorKey: "g2" },
  52: { name: "温骐睿", colorKey: "d1" },
  53: { name: "谭尚贤", colorKey: "g3" },
  54: { name: "陈科岐", colorKey: "g3" },
  55: { name: "张宸瑞", colorKey: "g3" },
  56: { name: "纪博勋", colorKey: "g3" },
  57: { name: "董穆朗", colorKey: "g3" },
  58: { name: "叶孟洋", colorKey: "g3" },
  59: { name: "谢明睿", colorKey: "g3" },
  60: { name: "刘彦辰", colorKey: "g3" },
  61: { name: "胡盛文", colorKey: "g3" },
  62: { name: "郑淇元", colorKey: "g3" },
  63: { name: "任冠宇", colorKey: "g3" },
  64: { name: "张文灏", colorKey: "g3" },
  65: { name: "邵逸宸", colorKey: "g2" },
  66: { name: "杨坤翰", colorKey: "g3" },
  67: { name: "杨浩诚", colorKey: "g2" },
  68: { name: "赵天行", colorKey: "g3" },
  69: { name: "侯翔文", colorKey: "g3" },
  70: { name: "丁雍柯", colorKey: "g3" },
  71: { name: "母梓言", colorKey: "g2" },
  72: { name: "叶淏然", colorKey: "g2" },
  73: { name: "管公尧", colorKey: "g2" },
  74: { name: "林川石", colorKey: "g2" },
  75: { name: "徐菡", colorKey: "g2" },
  76: { name: "杜雨珅", colorKey: "g3" },
  77: { name: "张力玺", colorKey: "d1" },
  78: { name: "严宏玮", colorKey: "d2" },
  79: { name: "服务器", colorKey: "uk" },
  80: { name: "陆籽澄", colorKey: "g3" },
  81: { name: "杨金强", colorKey: "by" },
  82: { name: "赖柯宇", colorKey: "g3" },
  83: { name: "任净月", colorKey: "d1" },
  84: { name: "侯方圆", colorKey: "g2" },
  85: { name: "程宇轩", colorKey: "jl" },
  86: { name: "徐向东", colorKey: "d3" },
  87: { name: "王嵩睿", colorKey: "d3" },
  88: { name: "姜云华", colorKey: "d3" },
  89: { name: "张旭睿", colorKey: "d3" },
  90: { name: "王星宁", colorKey: "d3" },
  91: { name: "吴清扬", colorKey: "d3" },
  92: { name: "陈琢", colorKey: "d3" },
  93: { name: "黄兰乔", colorKey: "d3" },
  94: { name: "蔡清硕", colorKey: "d3" },
  95: { name: "文军", colorKey: "d3" },
  96: { name: "熊禹轩", colorKey: "d3" },
  97: { name: "袁科键", colorKey: "d3" },
  98: { name: "何秋洋", colorKey: "d3" },
  99: { name: "杨可", colorKey: "d4" },
  100: { name: "郑发伟", colorKey: "d4" },
  101: { name: "钟欣瑞", colorKey: "d4" },
  102: { name: "李佳龙", colorKey: "d4" },
  103: { name: "葛嘉铭", colorKey: "d4" },
  104: { name: "郑乔月", colorKey: "d4" },
  105: { name: "胡瑞李臻", colorKey: "d4" },
  106: { name: "夏兴宇", colorKey: "d4" },
  107: { name: "吴振喆", colorKey: "d4" },
  108: { name: "穆云瑞", colorKey: "d4" },
  109: { name: "袁世豪", colorKey: "d1" },
  110: { name: "张翔宇", colorKey: "d1" },
  111: { name: "陈佳豪", colorKey: "d1" },
  112: { name: "陈明远", colorKey: "d1" },
  113: { name: "李思雨", colorKey: "d1" },
  114: { name: "项雨源", colorKey: "d1" },
  115: { name: "张志豪", colorKey: "d1" },
  116: { name: "冉宇峰", colorKey: "d1" },
  117: { name: "张希皓", colorKey: "d1" },
  118: { name: "姜义都", colorKey: "d1" },
  119: { name: "王小波", colorKey: "by" },
  120: { name: "肖镜东", colorKey: "d2" },
  121: { name: "杨智伟", colorKey: "d3" },
  122: { name: "严成林", colorKey: "uk" },
  123: { name: "杨艾忱", colorKey: "g3" },
  124: { name: "骆洋溢", colorKey: "g3" },
  125: { name: "何欣静", colorKey: "g2" },
  126: { name: "杨一诺", colorKey: "d1" },
  127: { name: "邓响", colorKey: "g3" },
  128: { name: "曾国恒", colorKey: "g2" },
  129: { name: "萧皓文", colorKey: "g3" },
  130: { name: "李彦岑", colorKey: "g1" },
  131: { name: "张祝仲谋", colorKey: "g3" },
  132: { name: "邓融阔", colorKey: "g2" },
  133: { name: "邓歆瀚", colorKey: "g3" },
  134: { name: "刘皓伦", colorKey: "g3" },
  135: { name: "彭博", colorKey: "g1" },
  136: { name: "何宜川", colorKey: "g3" },
  137: { name: "兰洪玮", colorKey: "g1" },
  138: { name: "张恩敬", colorKey: "g2" },
  139: { name: "刘思源", colorKey: "d2" },
  140: { name: "彭奕力2", colorKey: "c3" },
  141: { name: "蒋璐阳", colorKey: "g3" },
  142: { name: "潘轩宇", colorKey: "g1" },
  143: { name: "张卓然", colorKey: "d1" },
  144: { name: "张蓝心", colorKey: "g2" },
  145: { name: "罗斯汀", colorKey: "d4" },
  146: { name: "蔡昊洋", colorKey: "d4" },
  147: { name: "侯智航", colorKey: "d4" },
  148: { name: "廖思齐", colorKey: "d4" },
  149: { name: "胡星池", colorKey: "d4" },
  150: { name: "李坤洋-jkf", colorKey: "d4" },
  151: { name: "程书涵", colorKey: "d3" },
  152: { name: "马平川", colorKey: "d3" },
  153: { name: "李美琳", colorKey: "by" },
  154: { name: "龙贵全", colorKey: "d3" },
  155: { name: "李阳", colorKey: "d3" },
  156: { name: "薛振鹏", colorKey: "d3" },
  157: { name: "刘佳艳", colorKey: "d3" },
  158: { name: "李万博", colorKey: "d3" },
  159: { name: "徐砺寒", colorKey: "d3" },
  160: { name: "李思哲", colorKey: "d3" },
  161: { name: "徐若瑜", colorKey: "d3" },
  162: { name: "韩恩鲜", colorKey: "d3" },
  163: { name: "杨依芮", colorKey: "d3" },
  164: { name: "秦北辰", colorKey: "d3" },
  165: { name: "古康圆", colorKey: "d3" },
  166: { name: "王梓淇", colorKey: "d3" },
  167: { name: "周子瑜", colorKey: "d3" },
  168: { name: "陈霁兮", colorKey: "d3" },
  169: { name: "戴金杨", colorKey: "d3" },
  170: { name: "王子仪", colorKey: "d3" },
  171: { name: "周潍可", colorKey: "d3" },
  172: { name: "王希贤", colorKey: "d3" },
  173: { name: "缪言", colorKey: "d3" },
  174: { name: "石鹏屹", colorKey: "d3" },
  175: { name: "曾浩桐", colorKey: "g3" },
  176: { name: "侯栎晗", colorKey: "g3" },
  177: { name: "熊梓贤", colorKey: "g2" },
  178: { name: "李禹衡", colorKey: "g2" },
  179: { name: "文子蕴", colorKey: "d1" },
  180: { name: "娄运筹", colorKey: "d3" },
  181: { name: "彭彦熙", colorKey: "d1" },
  182: { name: "李九汝", colorKey: "g2" },
  183: { name: "刘昊昕", colorKey: "by" },
  184: { name: "王小波", colorKey: "by" },
  185: { name: "孙瑞国", colorKey: "d2" },
  186: { name: "曾子恒", colorKey: "g2" },
  187: { name: "李济同", colorKey: "d1" },
  188: { name: "周贤德", colorKey: "g2" },
  189: { name: "李宇春", colorKey: "by" },
  190: { name: "方元", colorKey: "by" },
  191: { name: "雷宇", colorKey: "d3" },
  192: { name: "邹潘", colorKey: "d3" },
  193: { name: "何振龙", colorKey: "by" },
  194: { name: "薛阳", colorKey: "by" },
  195: { name: "储一帆", colorKey: "by" },
  196: { name: "陈立果", colorKey: "by" },
  197: { name: "王子周", colorKey: "g3" },
  198: { name: "段老师", colorKey: "by" },
  199: { name: "赖老师", colorKey: "by" },
  200: { name: "江宇粟", colorKey: "g2" },
  201: { name: "韦言", colorKey: "g2" },
  202: { name: "高维劭", colorKey: "g2" },
  203: { name: "周静远", colorKey: "g1" },
  204: { name: "荣程", colorKey: "g3" },
  205: { name: "测试", colorKey: "uk" },
  206: { name: "任翼君", colorKey: "g2" },
  207: { name: "郭又嘉", colorKey: "g2" },
  208: { name: "刘雨泽", colorKey: "g2" },
  209: { name: "石若水", colorKey: "g2" },
  210: { name: "叶军", colorKey: "g3" },
  211: { name: "姜仕文", colorKey: "g3" },
  212: { name: "曲峻泽", colorKey: "g3" },
  213: { name: "王彦儒", colorKey: "g3" },
  214: { name: "吕明慷", colorKey: "g3" },
  215: { name: "吴俊达", colorKey: "g3" },
  216: { name: "周嘉熙", colorKey: "g3" },
  217: { name: "曹新鑫", colorKey: "g3" },
  218: { name: "张芮宁", colorKey: "g3" },
  219: { name: "刘涵靖", colorKey: "g3" },
  220: { name: "董峻宾", colorKey: "g3" },
  221: { name: "冯子健", colorKey: "g3" },
  222: { name: "杨晖尊", colorKey: "g3" },
  223: { name: "董艺蕾", colorKey: "g3" },
  224: { name: "王浩宇", colorKey: "g3" },
  225: { name: "乔博文", colorKey: "g3" },
  226: { name: "王奥钰", colorKey: "g3" },
  227: { name: "高子铭", colorKey: "g3" },
  228: { name: "李君昊", colorKey: "g3" },
  229: { name: "李丙椿", colorKey: "g3" },
  230: { name: "李知航", colorKey: "g3" },
  231: { name: "张笑晴", colorKey: "g3" },
  232: { name: "岳金泽", colorKey: "g3" },
  233: { name: "路程锦", colorKey: "g3" },
  234: { name: "王昭然", colorKey: "g3" },
  235: { name: "宋潮", colorKey: "g3" },
  236: { name: "张笑安别抄了", colorKey: "g3" },
  237: { name: "鞠明轩", colorKey: "g3" },
  238: { name: "邓博航", colorKey: "g3" },
  239: { name: "韩霄杨", colorKey: "g3" },
  240: { name: "李天宇", colorKey: "g3" },
  241: { name: "郭衍泽", colorKey: "g3" },
  242: { name: "姜棣瀚", colorKey: "g3" },
  243: { name: "张金峻", colorKey: "g3" },
  244: { name: "毛泽福", colorKey: "g3" },
  245: { name: "高天", colorKey: "g3" },
  246: { name: "林柏润", colorKey: "g3" },
  247: { name: "张含硕", colorKey: "g3" },
  248: { name: "董佳凝", colorKey: "g3" },
  249: { name: "吕宗朴", colorKey: "g3" },
  250: { name: "孙哲文", colorKey: "g3" },
  251: { name: "马德燊", colorKey: "g3" },
  252: { name: "王靖予", colorKey: "g3" },
  253: { name: "赵一诺", colorKey: "g3" },
  254: { name: "侯伊曼", colorKey: "g3" },
  255: { name: "陈志宏", colorKey: "g3" },
  256: { name: "杨云帆", colorKey: "g3" },
  257: { name: "郭丁荣", colorKey: "g3" },
  258: { name: "侯杰瑞", colorKey: "g3" },
  259: { name: "张绮涵", colorKey: "g3" },
  260: { name: "侯杰瑞", colorKey: "g3" },
  261: { name: "张博涵", colorKey: "g3" },
  262: { name: "孙铭宏", colorKey: "g3" },
  263: { name: "范晓藤", colorKey: "g3" },
  264: { name: "马名泽", colorKey: "g3" },
  265: { name: "袁天泽", colorKey: "g3" },
  266: { name: "王婕鑫", colorKey: "g3" },
  267: { name: "卢本伟", colorKey: "g3" },
  268: { name: "邱超凡", colorKey: "g3" },
  269: { name: "王彦儒", colorKey: "g3" },
  270: { name: "韩沙沙", colorKey: "g3" },
  271: { name: "王飞", colorKey: "g3" },
  272: { name: "刘一鸣", colorKey: "g3" },
  273: { name: "王耀弘", colorKey: "g3" },
  274: { name: "张海宇", colorKey: "g3" },
  275: { name: "张瑞熙", colorKey: "g3" },
  276: { name: "赵浩辰", colorKey: "g3" },
  277: { name: "陈振", colorKey: "g3" },
  278: { name: "程佳韵", colorKey: "g3" },
  279: { name: "路昕瑞", colorKey: "g3" },
  280: { name: "王洪波", colorKey: "g3" },
  281: { name: "王佳烨", colorKey: "g3" },
  282: { name: "刘力文", colorKey: "g3" },
  283: { name: "姜刘子硕", colorKey: "g3" },
  284: { name: "李岩", colorKey: "g3" },
  285: { name: "仝博文", colorKey: "g3" },
  286: { name: "张含硕", colorKey: "g3" },
  287: { name: "马德燊", colorKey: "g3" },
  288: { name: "王思涵", colorKey: "g3" },
  289: { name: "张莉", colorKey: "g3" },
  290: { name: "邓博航", colorKey: "g3" },
  291: { name: "范子瑜", colorKey: "g3" },
  292: { name: "马凯瑞", colorKey: "g3" },
  293: { name: "殷延隆", colorKey: "g3" },
  294: { name: "孙钰坤", colorKey: "g3" },
  295: { name: "孙研淳", colorKey: "g3" },
  296: { name: "赵昊祺", colorKey: "g3" },
  297: { name: "封婉萍", colorKey: "g3" },
  298: { name: "王思齐", colorKey: "g3" },
  299: { name: "王荣森", colorKey: "g3" },
  300: { name: "李楷瑞", colorKey: "g3" },
  301: { name: "王茜瑶", colorKey: "g3" },
  302: { name: "黄秋垚", colorKey: "g3" },
  303: { name: "舒承喆", colorKey: "g3" },
  304: { name: "高宇阳", colorKey: "g3" },
  305: { name: "蔡铭浩", colorKey: "g3" },
  306: { name: "张闻雨", colorKey: "g3" },
  307: { name: "李天瑞", colorKey: "g3" },
  308: { name: "韩奕晨", colorKey: "g3" },
  309: { name: "刘科力", colorKey: "g3" },
  310: { name: "何柏霄", colorKey: "g3" },
  311: { name: "王子宸", colorKey: "g3" },
  312: { name: "杨恩泽", colorKey: "g3" },
  313: { name: "龙鹏旭", colorKey: "g3" },
  314: { name: "孙士雅", colorKey: "g3" },
  315: { name: "顾子涵", colorKey: "g3" },
  316: { name: "隆君昊", colorKey: "g3" },
  317: { name: "王智永", colorKey: "g3" },
  318: { name: "高林凡", colorKey: "g3" },
  319: { name: "王永发", colorKey: "g3" },
  320: { name: "周昊宇", colorKey: "g3" },
  321: { name: "丁星瑜", colorKey: "g3" },
  322: { name: "朱天", colorKey: "g3" },
  323: { name: "王雨晗", colorKey: "g3" },
  324: { name: "边珈瑞", colorKey: "g3" },
  325: { name: "朱奕璇", colorKey: "g3" },
  326: { name: "方毅刚", colorKey: "g3" },
  327: { name: "俎梓瑞", colorKey: "g3" },
  328: { name: "姚泽峰", colorKey: "g3" },
  329: { name: "于子涵", colorKey: "g3" },
  330: { name: "王淇", colorKey: "g3" },
  331: { name: "鲁延文", colorKey: "g3" },
  332: { name: "杨昕桐", colorKey: "g3" },
  333: { name: "钟延宸", colorKey: "g3" },
  334: { name: "牟俊如", colorKey: "g3" },
  335: { name: "韩政", colorKey: "g3" },
  336: { name: "樊骜川", colorKey: "g3" },
  337: { name: "张宸溪", colorKey: "g3" },
  338: { name: "王佳林", colorKey: "g3" },
  339: { name: "赵笑宇", colorKey: "g3" },
  340: { name: "高一鸣", colorKey: "g3" },
  341: { name: "赵文博", colorKey: "g3" },
  342: { name: "石晏临", colorKey: "g3" },
  343: { name: "王献迪", colorKey: "g3" },
  344: { name: "刘依杨", colorKey: "g3" },
  345: { name: "司洪凯", colorKey: "g3" },
  346: { name: "李韶轩", colorKey: "g3" },
  347: { name: "张琦", colorKey: "g3" },
  348: { name: "刘子涵", colorKey: "g3" },
  349: { name: "王晓琳略略略", colorKey: "g3" },
  350: { name: "王琪略略略", colorKey: "g3" },
  351: { name: "高宁", colorKey: "g3" },
  352: { name: "田润泽", colorKey: "g3" },
  353: { name: "杨文玉略略略", colorKey: "g3" },
  354: { name: "周晓冉", colorKey: "g3" },
  355: { name: "李金融", colorKey: "g3" },
  356: { name: "蒋会辰", colorKey: "g3" },
  357: { name: "程文珂", colorKey: "g3" },
  358: { name: "常家赫", colorKey: "g3" },
  359: { name: "贾宏璨", colorKey: "g3" },
  360: { name: "温超", colorKey: "g3" },
  361: { name: "王子晨", colorKey: "g3" },
  362: { name: "吴波", colorKey: "g3" },
  363: { name: "王嘉怡", colorKey: "g3" },
  364: { name: "李奕涵", colorKey: "g3" },
  365: { name: "徐梓航", colorKey: "g3" },
  366: { name: "高雨嘉", colorKey: "g3" },
  367: { name: "王宁", colorKey: "g3" },
  368: { name: "刘华瑞", colorKey: "g3" },
  369: { name: "张莉略略略", colorKey: "g3" },
  370: { name: "张茹月", colorKey: "g3" },
  371: { name: "边金凯略略略", colorKey: "g3" },
  372: { name: "孙咏政", colorKey: "g3" },
  373: { name: "李泓睿", colorKey: "g3" },
  374: { name: "张志强略略略", colorKey: "g3" },
  375: { name: "刘天怡", colorKey: "g3" },
  376: { name: "蔡明欣", colorKey: "g3" },
  377: { name: "宫恪勉", colorKey: "g3" },
  378: { name: "王钰泽", colorKey: "g3" },
  379: { name: "王敏哲", colorKey: "g3" },
  380: { name: "孙永艳略略略", colorKey: "g3" },
  381: { name: "房冠睿", colorKey: "g3" },
  382: { name: "温家乐", colorKey: "g3" },
  383: { name: "尚文迪", colorKey: "g3" },
  384: { name: "温晓晨", colorKey: "g3" },
  385: { name: "杨兆冉", colorKey: "g3" },
  386: { name: "熊锦瑞", colorKey: "g3" },
  387: { name: "刘柏郡", colorKey: "g3" },
  388: { name: "郑丽梦", colorKey: "g3" },
  389: { name: "祁皓田", colorKey: "g3" },
  390: { name: "刘文静", colorKey: "g3" },
  391: { name: "王泽川", colorKey: "g3" },
  392: { name: "贾博淼", colorKey: "g3" },
  393: { name: "史润轩", colorKey: "g3" },
  394: { name: "王鹏宇", colorKey: "g3" },
  395: { name: "宁尚哲别抄了", colorKey: "g3" },
  396: { name: "刘晓冬", colorKey: "g3" },
  397: { name: "辛伟宸", colorKey: "g3" },
  398: { name: "靳博涵", colorKey: "g3" },
  399: { name: "宁欣悦", colorKey: "g3" },
  400: { name: "王海璐", colorKey: "g3" },
  401: { name: "高文昊", colorKey: "g3" },
  402: { name: "王玲", colorKey: "g3" },
  403: { name: "张家璘", colorKey: "g3" },
  404: { name: "王雨晗", colorKey: "g3" },
  405: { name: "管建航", colorKey: "g3" },
  406: { name: "迟向阳", colorKey: "g3" },
  407: { name: "李学蕙", colorKey: "g3" },
  408: { name: "楚然", colorKey: "g3" },
  409: { name: "温兆续", colorKey: "g3" },
  410: { name: "孙浩诚", colorKey: "g3" },
  411: { name: "李雨泽-del", colorKey: "g3" },
  412: { name: "王笑航", colorKey: "g3" },
  413: { name: "宋科辛", colorKey: "g3" },
  414: { name: "温新彬", colorKey: "g3" },
  415: { name: "刘建亿", colorKey: "g3" },
  416: { name: "董艳", colorKey: "g3" },
  417: { name: "孙梦瑞", colorKey: "g3" },
  418: { name: "李文雅", colorKey: "g3" },
  419: { name: "吕宗朴", colorKey: "g3" },
  420: { name: "徐梦熠", colorKey: "g3" },
  421: { name: "孟睿婕", colorKey: "g3" },
  422: { name: "张懿可", colorKey: "g3" },
  423: { name: "翟骐骏", colorKey: "g3" },
  424: { name: "李玟慧", colorKey: "g3" },
  425: { name: "张雨泽", colorKey: "g3" },
  426: { name: "张莉", colorKey: "g3" },
  427: { name: "田昕宴", colorKey: "g3" },
  428: { name: "张金峻", colorKey: "g3" },
  429: { name: "贺延青", colorKey: "g3" },
  430: { name: "徐", colorKey: "g3" },
  431: { name: "梁兴璞", colorKey: "g3" },
  432: { name: "高瞻航", colorKey: "g3" },
  433: { name: "薛新波", colorKey: "g3" },
  434: { name: "志明", colorKey: "g3" },
  435: { name: "何炎堃", colorKey: "g3" },
  436: { name: "李浩然", colorKey: "g3" },
  437: { name: "刘欣琪", colorKey: "g3" },
  438: { name: "刘震", colorKey: "g3" },
  439: { name: "姚家泽", colorKey: "g3" },
  440: { name: "徐赫徽", colorKey: "g3" },
  441: { name: "代睿", colorKey: "g3" },
  442: { name: "李胤诚", colorKey: "g3" },
  443: { name: "李垚嘉", colorKey: "g3" },
  444: { name: "陈泽予-外校", colorKey: "g3" },
  445: { name: "何一鸣", colorKey: "g3" },
  446: { name: "王伟力", colorKey: "g3" },
  447: { name: "孙嘉宇", colorKey: "g3" },
  448: { name: "刘畅", colorKey: "g3" },
  449: { name: "仲宇航", colorKey: "g3" },
  450: { name: "邓亦珊", colorKey: "g3" },
  451: { name: "徐博魏", colorKey: "g3" },
  452: { name: "陈睿", colorKey: "g3" },
  453: { name: "李恺文", colorKey: "g3" },
  454: { name: "赵鹏博", colorKey: "g3" },
  455: { name: "亚一鸣", colorKey: "g3" },
  456: { name: "贺云飞", colorKey: "g3" },
  457: { name: "袁纳海", colorKey: "g3" },
  458: { name: "张海笑", colorKey: "g3" },
  459: { name: "杜宇丰", colorKey: "g3" },
  460: { name: "罗煜程", colorKey: "g2" },
  461: { name: "韩俊潇", colorKey: "g3" },
  462: { name: "韩靖坤", colorKey: "g3" },
  463: { name: "张嘉鑫", colorKey: "g3" },
  464: { name: "高佳棋", colorKey: "g3" },
  465: { name: "杨素倩", colorKey: "g3" },
  466: { name: "李路岩", colorKey: "g3" },
  467: { name: "王晓涵", colorKey: "g3" },
  468: { name: "张旭", colorKey: "g3" },
  469: { name: "宫恪勉", colorKey: "g3" },
  470: { name: "张立婷", colorKey: "g3" },
  471: { name: "张欣诺", colorKey: "g3" },
  472: { name: "温雅琪", colorKey: "g3" },
  473: { name: "张裕奇", colorKey: "g3" },
  474: { name: "辛姗姗", colorKey: "g3" },
  475: { name: "翟文浩", colorKey: "g3" },
  476: { name: "王浩宇", colorKey: "g3" },
  477: { name: "张建平", colorKey: "g3" },
  478: { name: "赵子木", colorKey: "g3" },
  479: { name: "隆奇瑞", colorKey: "g3" },
  480: { name: "王锦毅", colorKey: "g3" },
  481: { name: "张孟锐", colorKey: "g3" },
  482: { name: "李安妮", colorKey: "g3" },
  483: { name: "张鸣宇", colorKey: "g3" },
  484: { name: "樊曰阳", colorKey: "g3" },
  485: { name: "庞云轩", colorKey: "g3" },
  486: { name: "魏梓赫", colorKey: "g3" },
  487: { name: "刘凯鑫", colorKey: "g3" },
  488: { name: "王辉煌", colorKey: "g3" },
  489: { name: "张寒露", colorKey: "g3" },
  490: { name: "刘子涵", colorKey: "g3" },
  491: { name: "孙敬航", colorKey: "g3" },
  492: { name: "衣珈成", colorKey: "g3" },
  493: { name: "都轶可", colorKey: "g3" },
  494: { name: "平雨辰", colorKey: "g3" },
  495: { name: "郭梓婕", colorKey: "g3" },
  496: { name: "李虹毅", colorKey: "g3" },
  497: { name: "刘承轩", colorKey: "g3" },
  498: { name: "王钰梁", colorKey: "g3" },
  499: { name: "孙宇泽", colorKey: "g3" },
  500: { name: "安洋", colorKey: "g3" },
  501: { name: "张博儒", colorKey: "g3" },
  502: { name: "赵鹏煊", colorKey: "g3" },
  503: { name: "温锦钰", colorKey: "g3" },
  504: { name: "高翊皓", colorKey: "g3" },
  505: { name: "刘诗泽", colorKey: "g3" },
  506: { name: "朱天宁", colorKey: "g3" },
  507: { name: "郭静霏", colorKey: "g3" },
  508: { name: "杨文悦", colorKey: "g3" },
  509: { name: "刘子阳", colorKey: "g3" },
  510: { name: "韩俊潇", colorKey: "g3" },
  511: { name: "韩靖坤", colorKey: "g3" },
  512: { name: "张嘉鑫", colorKey: "g3" },
  513: { name: "高佳棋", colorKey: "g3" },
  514: { name: "杨素倩", colorKey: "g3" },
  515: { name: "李路岩", colorKey: "g3" },
  516: { name: "王晓涵", colorKey: "g3" },
  517: { name: "张旭", colorKey: "g3" },
  518: { name: "宫恪勉", colorKey: "g3" },
  519: { name: "张立婷", colorKey: "g3" },
  520: { name: "张欣诺", colorKey: "g3" },
  521: { name: "温雅琪", colorKey: "g3" },
  522: { name: "张裕奇", colorKey: "g3" },
  523: { name: "辛姗姗", colorKey: "g3" },
  524: { name: "翟文浩", colorKey: "g3" },
  525: { name: "王浩宇", colorKey: "g3" },
  526: { name: "张建平", colorKey: "g3" },
  527: { name: "赵子木", colorKey: "g3" },
  528: { name: "隆奇瑞", colorKey: "g3" },
  529: { name: "王锦毅", colorKey: "g3" },
  530: { name: "张孟锐", colorKey: "g3" },
  531: { name: "李安妮", colorKey: "g3" },
  532: { name: "张鸣宇", colorKey: "g3" },
  533: { name: "樊曰阳", colorKey: "g3" },
  534: { name: "庞云轩", colorKey: "g3" },
  535: { name: "魏梓赫", colorKey: "g3" },
  536: { name: "刘凯鑫", colorKey: "g3" },
  537: { name: "王辉煌", colorKey: "g3" },
  538: { name: "张寒露", colorKey: "g3" },
  539: { name: "刘子涵", colorKey: "g3" },
  540: { name: "孙敬航", colorKey: "g3" },
  541: { name: "衣珈成", colorKey: "g3" },
  542: { name: "都轶可", colorKey: "g3" },
  543: { name: "平雨辰", colorKey: "g3" },
  544: { name: "郭梓婕", colorKey: "g3" },
  545: { name: "李虹毅", colorKey: "g3" },
  546: { name: "刘承轩", colorKey: "g3" },
  547: { name: "王钰梁", colorKey: "g3" },
  548: { name: "孙宇泽", colorKey: "g3" },
  549: { name: "安洋", colorKey: "g3" },
  550: { name: "张博儒", colorKey: "g3" },
  551: { name: "赵鹏煊", colorKey: "g3" },
  552: { name: "温锦钰", colorKey: "g3" },
  553: { name: "高翊皓", colorKey: "g3" },
  554: { name: "刘诗泽", colorKey: "g3" },
  555: { name: "朱天宁", colorKey: "g3" },
  556: { name: "郭静霏", colorKey: "g3" },
  557: { name: "杨文悦", colorKey: "g3" },
  558: { name: "刘子阳", colorKey: "g3" },
  559: { name: "叶军", colorKey: "g3" },
  560: { name: "张建平", colorKey: "g3" },
  561: { name: "张孟锐", colorKey: "g3" },
  562: { name: "王一多", colorKey: "g3" },
  563: { name: "吴晗", colorKey: "g3" },
  564: { name: "樊曰阳", colorKey: "g3" },
  565: { name: "鞠智博", colorKey: "g3" },
  566: { name: "衣珈成", colorKey: "g3" },
  567: { name: "杨云帆", colorKey: "g3" },
  568: { name: "张芮宁", colorKey: "g3" },
  569: { name: "李虹毅", colorKey: "g3" },
  570: { name: "张轩睿", colorKey: "g3" },
  571: { name: "孙华", colorKey: "g3" },
  572: { name: "2021009343小李", colorKey: "g3" },
  573: { name: "张华", colorKey: "g3" },
  574: { name: "李俞辰", colorKey: "g3" },
  575: { name: "张丽美", colorKey: "g3" },
  576: { name: "毛焓瑞", colorKey: "g3" },
  577: { name: "黄万玉", colorKey: "g3" },
  578: { name: "张海笑", colorKey: "g3" },
  579: { name: "李恺文", colorKey: "g3" },
  580: { name: "贺云飞", colorKey: "g3" },
  581: { name: "孙劲松", colorKey: "g3" },
  582: { name: "徐博巍", colorKey: "g3" },
  583: { name: "陈睿", colorKey: "g3" },
  584: { name: "南树康", colorKey: "g3" },
  585: { name: "楚然", colorKey: "g3" },
  586: { name: "谷冬宇", colorKey: "g3" },
  587: { name: "李秀琪", colorKey: "g3" },
  588: { name: "李旭尧", colorKey: "g3" },
  589: { name: "宋鑫玥", colorKey: "g3" },
  590: { name: "商晓婧", colorKey: "g3" },
  591: { name: "孙雨桐", colorKey: "g3" },
  592: { name: "张永", colorKey: "g3" },
  593: { name: "任璟泽", colorKey: "g3" },
  594: { name: "赵源博", colorKey: "g3" },
  595: { name: "程峥", colorKey: "g3" },
  596: { name: "宫德卿", colorKey: "g3" },
  597: { name: "朱学平", colorKey: "g3" },
  598: { name: "温晓晨", colorKey: "g3" },
  599: { name: "张诺雅", colorKey: "g3" },
  600: { name: "张宸赫", colorKey: "g3" },
  601: { name: "许乐简", colorKey: "g3" },
  602: { name: "黄禹博", colorKey: "g3" },
  603: { name: "刘一鸣", colorKey: "g3" },
  604: { name: "庄子文", colorKey: "g3" },
  605: { name: "孙华", colorKey: "g3" },
  606: { name: "黄万玉", colorKey: "g3" },
  607: { name: "楚然", colorKey: "g3" },
  608: { name: "刘欣琪", colorKey: "g3" },
  609: { name: "马志涛", colorKey: "g3" },
  610: { name: "王亚芳", colorKey: "g3" },
  611: { name: "南兆杰", colorKey: "g3" },
  612: { name: "郭一鸣", colorKey: "g3" },
  613: { name: "谭鑫鑫", colorKey: "g3" },
  614: { name: "张可心", colorKey: "g3" },
  615: { name: "孙文秀", colorKey: "g3" },
  616: { name: "李辉", colorKey: "g3" },
  617: { name: "王宥鼎", colorKey: "g3" },
  618: { name: "郑博元", colorKey: "g3" },
  619: { name: "杨云帆", colorKey: "g3" },
  620: { name: "詹语谦", colorKey: "g2" },
  621: { name: "赵梓皓", colorKey: "g2" },
  622: { name: "李昊阳", colorKey: "g2" },
  623: { name: "李雨泽", colorKey: "g2" },
  624: { name: "熊梓贤", colorKey: "g2" },
  625: { name: "杨晋哲", colorKey: "d1" },
  626: { name: "邱梓轩", colorKey: "g2" },
  627: { name: "李昕乐", colorKey: "d1" },
  628: { name: "曾子恒", colorKey: "g2" },
  629: { name: "曹灿", colorKey: "g2" },
  630: { name: "徐镱嘉", colorKey: "g3" },
  631: { name: "孙鱼跃", colorKey: "g2" },
  632: { name: "张徐璟", colorKey: "g2" },
  633: { name: "嘉嘉妈", colorKey: "by" },
  634: { name: "鲜博宇", colorKey: "d1" },
  635: { name: "王文鼎", colorKey: "d1" },
  636: { name: "杜星睿", colorKey: "g2" },
  637: { name: "鲜星辰", colorKey: "g2" },
  638: { name: "黄籽豪", colorKey: "g2" },
  639: { name: "蒋雨成", colorKey: "g2" },
  640: { name: "曾禹为", colorKey: "g1" },
  641: { name: "周子杰", colorKey: "g3" },
  642: { name: "徐冉", colorKey: "c3" },
  643: { name: "赵一哲", colorKey: "g3" },
  644: { name: "曾禹为", colorKey: "g1" },
  645: { name: "赖明宇", colorKey: "d1" },
  646: { name: "张均豪", colorKey: "g2" },
  647: { name: "张均豪", colorKey: "g2" },
  648: { name: "呵呵哒", colorKey: "by" },
  649: { name: "张之弥", colorKey: "by" },
  650: { name: "李钰曦", colorKey: "d2" },
  651: { name: "黄郅为", colorKey: "c3" },
  652: { name: "潘昱霖", colorKey: "c3" },
  653: { name: "张雨轲-del", colorKey: "c3" },
  654: { name: "罗涵哲", colorKey: "uk" },
  655: { name: "梁殿宸-del", colorKey: "c3" },
  656: { name: "李坤洋-del", colorKey: "g1" },
  657: { name: "许晋瑄", colorKey: "g1" },
  658: { name: "曾祥睿", colorKey: "g1" },
  659: { name: "谭天辰", colorKey: "g2" },
  660: { name: "袁启航", colorKey: "g2" },
  661: { name: "国皓语", colorKey: "g2" },
  662: { name: "陈思睿", colorKey: "g2" },
  663: { name: "", colorKey: "g2" },
  664: { name: "张桐尧", colorKey: "g2" },
  665: { name: "刘希成", colorKey: "by" },
  666: { name: "张铭杰", colorKey: "g2" },
  667: { name: "钟胡天翔", colorKey: "jl" },
  668: { name: "张子川", colorKey: "g2" },
  669: { name: "苏世锋", colorKey: "g2" },
  670: { name: "杨耘嘉", colorKey: "g1" },
  671: { name: "漆小凡-del", colorKey: "c3" },
  672: { name: "王子涵", colorKey: "d3" },
  673: { name: "丁德正", colorKey: "d2" },
  674: { name: "康睿涵", colorKey: "d1" },
  675: { name: "熊海涛", colorKey: "g3" },
  676: { name: "张旭桐", colorKey: "g2" },
  677: { name: "贾承羲", colorKey: "g1" },
  678: { name: "王思涵", colorKey: "c3" },
  679: { name: "袁若菡", colorKey: "c2" },
  680: { name: "温粮丞", colorKey: "d3" },
  681: { name: "伍心一", colorKey: "g2" },
  682: { name: "苏彦旭", colorKey: "g3" },
  683: { name: "林祥威", colorKey: "d1" },
  684: { name: "袁梓涵", colorKey: "c3" },
  685: { name: "李杜宇", colorKey: "g1" },
  686: { name: "曾禹为", colorKey: "d1" },
  687: { name: "曾圣炜", colorKey: "c3" },
  688: { name: "王梓涵-del", colorKey: "c3" },
  689: { name: "陈唯宸", colorKey: "c2" },
  690: { name: "舒昕", colorKey: "g3" },
  691: { name: "袁梓涵", colorKey: "c3" },
  692: { name: "李杜宇", colorKey: "g1" },
  693: { name: "徐梓瑞", colorKey: "g1" },
  694: { name: "曾圣炜", colorKey: "c3" },
  695: { name: "王梓涵-del", colorKey: "c3" },
  696: { name: "陈唯宸", colorKey: "c2" },
  697: { name: "舒昕", colorKey: "g3" },
  698: { name: "贺行言", colorKey: "g1" },
  699: { name: "周静远", colorKey: "g1" },
  700: { name: "cyx-test", colorKey: "uk" },
  701: { name: "周星宇", colorKey: "g2" },
  702: { name: "陈可可", colorKey: "d1" },
  703: { name: "刘笃行", colorKey: "d1" },
  704: { name: "陈思然", colorKey: "d1" },
  705: { name: "崔语珂", colorKey: "d1" },
  706: { name: "贾博皓", colorKey: "d1" },
  707: { name: "李佳洁", colorKey: "d1" },
  708: { name: "杨浩然-del", colorKey: "d1" },
  709: { name: "龚信维", colorKey: "d1" },
  710: { name: "黄麒升", colorKey: "d1" },
  711: { name: "王文轩", colorKey: "d1" },
  712: { name: "廖旭涛", colorKey: "d1" },
  713: { name: "刘泰宏", colorKey: "d1" },
  714: { name: "张廷语", colorKey: "d1" },
  715: { name: "张廷歌", colorKey: "d1" },
  716: { name: "罗浩元", colorKey: "d1" },
  717: { name: "蒋宇恒", colorKey: "d2" },
  718: { name: "吴雨松", colorKey: "d2" },
  719: { name: "郑奕杰", colorKey: "d2" },
  720: { name: "丘月丞", colorKey: "d2" },
  721: { name: "江来", colorKey: "d2" },
  722: { name: "彭煜潇", colorKey: "d2" },
  723: { name: "", colorKey: "g3" },
  724: { name: "guohao", colorKey: "g3" },
  725: { name: "龚天佑", colorKey: "g2" },
  726: { name: "姜婷玉", colorKey: "g3" },
  727: { name: "王子涵", colorKey: "g1" },
  728: { name: "王子杨", colorKey: "g2" },
  729: { name: "刘逸轩", colorKey: "g2" },
  730: { name: "彭煜潇", colorKey: "g2" },
  731: { name: "魏义鲲", colorKey: "g2" },
  732: { name: "吴澄江", colorKey: "g3" },
  733: { name: "左宇轩", colorKey: "g2" },
  734: { name: "蒋知楠", colorKey: "g3" },
  735: { name: "宋成宸", colorKey: "g2" },
  736: { name: "程鑫", colorKey: "g2" },
  737: { name: "胡书菡", colorKey: "g2" },
  738: { name: "陈泽州", colorKey: "d2" },
  739: { name: "肖瑾瑜", colorKey: "d3" },
  740: { name: "喻奕杰", colorKey: "d3" },
  741: { name: "苟城玮", colorKey: "d3" },
  742: { name: "李天阳", colorKey: "d3" },
  743: { name: "李屿霏", colorKey: "d3" },
  744: { name: "柳絮源", colorKey: "d3" },
  745: { name: "陈恒宇", colorKey: "jl" },
  746: { name: "李涵睿", colorKey: "g3" },
  747: { name: "熊涵语", colorKey: "d2" },
  748: { name: "李莫非", colorKey: "d3" },
  749: { name: "庹铭宇", colorKey: "d3" },
  750: { name: "赵天琦", colorKey: "d3" },
  751: { name: "张彧铭", colorKey: "d1" },
  752: { name: "张铭煜", colorKey: "d1" },
  753: { name: "李秉恒", colorKey: "d1" },
  754: { name: "李昊葭", colorKey: "d1" },
  755: { name: "宋宇洋", colorKey: "d1" },
  756: { name: "黄洛天", colorKey: "d2" },
  757: { name: "邱志匀", colorKey: "d2" },
  758: { name: "胡越", colorKey: "d1" },
  759: { name: "std", colorKey: "by" },
  760: { name: "罗子皓", colorKey: "c3" },
  761: { name: "杨", colorKey: "c3" },
  762: { name: "刘语涵", colorKey: "g1" },
  763: { name: "艾泉孜", colorKey: "c3" },
  764: { name: "胡承旭", colorKey: "c3" },
  765: { name: "邹宇瞰", colorKey: "c3" },
  766: { name: "彭睿鑫", colorKey: "c3" },
  767: { name: "苟悦熙", colorKey: "c3" },
  768: { name: "于涵涵", colorKey: "c3" },
  769: { name: "张馨予", colorKey: "c3" },
  770: { name: "窦文蕊", colorKey: "c3" },
  771: { name: "黄恋茜", colorKey: "c3" },
  772: { name: "李瑜森", colorKey: "c3" },
  773: { name: "韩俊晨", colorKey: "c3" },
  774: { name: "刘子涵", colorKey: "c3" },
  775: { name: "赵娅淇", colorKey: "c3" },
  776: { name: "唐一心", colorKey: "c2" },
  777: { name: "文子豪", colorKey: "c2" },
  778: { name: "夏宇承", colorKey: "c2" },
  779: { name: "彭浩洋", colorKey: "c2" },
  780: { name: "费熙童", colorKey: "c2" },
  781: { name: "李晨杰", colorKey: "c2" },
  782: { name: "薛皓天", colorKey: "c2" },
  783: { name: "马瑞辰", colorKey: "c2" },
  784: { name: "祝煜涵", colorKey: "g1" },
  785: { name: "王浩宇", colorKey: "g1" },
  786: { name: "杨佳函", colorKey: "g1" },
  787: { name: "杨诗琪", colorKey: "c2" },
  788: { name: "李昊轩", colorKey: "c2" },
  789: { name: "程晨", colorKey: "c2" },
  790: { name: "赵俊涵", colorKey: "c2" },
  791: { name: "宋明阳", colorKey: "g1" },
  792: { name: "陈泳蒽", colorKey: "g1" },
  793: { name: "孙邦博", colorKey: "g1" },
  794: { name: "施宇翔", colorKey: "g2" },
  795: { name: "曾俊霖", colorKey: "g2" },
  796: { name: "张桢曜", colorKey: "g2" },
  797: { name: "宋正锡-del", colorKey: "g2" },
  798: { name: "饶宸嘉", colorKey: "g2" },
  799: { name: "何浩月", colorKey: "g2" },
  800: { name: "杨佑辉", colorKey: "g3" },
  801: { name: "李俊贤", colorKey: "uk" },
  802: { name: "康与邹", colorKey: "g3" },
  803: { name: "杨恬冰", colorKey: "g3" },
  804: { name: "张皓嘉", colorKey: "g3" },
  805: { name: "廖元柯", colorKey: "d2" },
  806: { name: "陈炜乐", colorKey: "d2" },
  807: { name: "刘博文", colorKey: "d2" },
  808: { name: "杨谨源", colorKey: "c3" },
  809: { name: "李悦杨", colorKey: "g2" },
  810: { name: "曾思玮", colorKey: "g2" },
  811: { name: "杨笑", colorKey: "g1" },
  812: { name: "曾帅鸣", colorKey: "c3" },
  813: { name: "唐一为", colorKey: "g2" },
  814: { name: "冯傲林", colorKey: "g2" },
  815: { name: "李兆瑨", colorKey: "g2" },
  816: { name: "韩穆志霖", colorKey: "g2" },
  817: { name: "郭展铄", colorKey: "d1" },
  818: { name: "周梦萱", colorKey: "d1" },
  819: { name: "韩政旭", colorKey: "d1" },
  820: { name: "马孟哲", colorKey: "d2" },
  821: { name: "管泽昊", colorKey: "d2" },
  822: { name: "王凯正", colorKey: "d2" },
  823: { name: "刘俊凯", colorKey: "d2" },
  824: { name: "楚一飞", colorKey: "d2" },
  825: { name: "张士豪", colorKey: "d2" },
  826: { name: "王晨曦", colorKey: "d2" },
  827: { name: "郑心悦", colorKey: "d2" },
  828: { name: "车冉冉", colorKey: "d2" },
  829: { name: "徐淑君", colorKey: "jl" },
  830: { name: "郑森元", colorKey: "g3" },
  831: { name: "王曦田", colorKey: "d1" },
  832: { name: "高怡凡", colorKey: "g1" },
  833: { name: "", colorKey: "uk" },
  834: { name: "", colorKey: "uk" },
  835: { name: "张凌熙", colorKey: "g1" },
  836: { name: "姜懿轩", colorKey: "d1" },
  837: { name: "郭志安", colorKey: "d1" },
  838: { name: "郭志康", colorKey: "d1" },
  839: { name: "刘易笑", colorKey: "c3" },
  840: { name: "赵思危", colorKey: "g1" },
  841: { name: "谭棋源", colorKey: "g1" },
  842: { name: "邓璐非", colorKey: "g1" },
  843: { name: "张峻滔", colorKey: "g1" },
  844: { name: "宋知谦", colorKey: "g1" },
  845: { name: "白书行", colorKey: "g1" },
  846: { name: "谢宇浩", colorKey: "g1" },
  847: { name: "苏庆朗", colorKey: "g1" },
  848: { name: "张宇鑫", colorKey: "g1" },
  849: { name: "邓鹏", colorKey: "g1" },
  850: { name: "王子福", colorKey: "g1" },
  851: { name: "牟划", colorKey: "g1" },
  852: { name: "张兮灿", colorKey: "g1" },
  853: { name: "谢同宸", colorKey: "g1" },
  854: { name: "杨雨萱", colorKey: "g1" },
  855: { name: "刘宬汐", colorKey: "g1" },
  856: { name: "曹适青", colorKey: "g1" },
  857: { name: "何席毅", colorKey: "g1" },
  858: { name: "兰博文", colorKey: "g1" },
  859: { name: "潘钦臣", colorKey: "g1" },
  860: { name: "孙乐天", colorKey: "g1" },
  861: { name: "吴欣淼", colorKey: "g1" },
  862: { name: "陈卓佳", colorKey: "g1" },
  863: { name: "刘悟臻", colorKey: "g1" },
  864: { name: "胡浩轩", colorKey: "g1" },
  865: { name: "肖涵畅", colorKey: "g1" },
  866: { name: "王亦曹", colorKey: "g2" },
  867: { name: "李卓恒", colorKey: "d1" },
  868: { name: "李承佑", colorKey: "d1" },
  869: { name: "罗翰扬", colorKey: "d1" },
  870: { name: "陈致霖", colorKey: "g1" },
  871: { name: "张平京渝", colorKey: "c3" },
  872: { name: "黄蔚尧", colorKey: "d4" },
  873: { name: "刘晨宇", colorKey: "d4" },
  874: { name: "陈霖瑄", colorKey: "g1" },
  875: { name: "程翊宸", colorKey: "g1" },
  876: { name: "蒋思齐", colorKey: "g1" },
  877: { name: "刘松林", colorKey: "g1" },
  878: { name: "王译萱", colorKey: "g1" },
  879: { name: "张子佩", colorKey: "g1" },
  880: { name: "陈统峙", colorKey: "g1" },
  881: { name: "郑凯文", colorKey: "d1" },
  882: { name: "唐若轩", colorKey: "c3" },
  883: { name: "李坤洋", colorKey: "g1" },
  884: { name: "卢治屹", colorKey: "g1" },
  885: { name: "陈彦南", colorKey: "c3" },
  886: { name: "刘苏熳", colorKey: "c3" },
  887: { name: "漆小凡", colorKey: "c3" },
  888: { name: "钱旻灏", colorKey: "d1" },
  889: { name: "梁殿宸", colorKey: "c3" },
  890: { name: "王腾立", colorKey: "g1" },
  891: { name: "周子黄", colorKey: "g1" },
  892: { name: "杨楚琰", colorKey: "c2" },
  893: { name: "张雨轲", colorKey: "c3" },
  894: { name: "曾溢崃", colorKey: "g1" },
  895: { name: "江晟德", colorKey: "c3" },
  896: { name: "王瑞", colorKey: "g2" },
  897: { name: "赵宸", colorKey: "g1" },
  898: { name: "韦潮汐", colorKey: "g2" },
  899: { name: "朱炫宇", colorKey: "g1" },
  900: { name: "王浩翔", colorKey: "g1" },
  901: { name: "许嘉程", colorKey: "c1" },
  902: { name: "李承熙", colorKey: "c1" },
  903: { name: "曹明杰", colorKey: "g1" },
  904: { name: "周俊锡", colorKey: "c1" },
  905: { name: "王", colorKey: "c1" },
  906: { name: "王鑫桐", colorKey: "c1" },
  907: { name: "方昕瑞", colorKey: "c1" },
  908: { name: "王皓阳", colorKey: "c1" },
  909: { name: "杨笑2028", colorKey: "g1" },
  910: { name: "杨", colorKey: "c1" },
  911: { name: "杨晟宣", colorKey: "c1" },
  912: { name: "张馨元", colorKey: "c1" },
  913: { name: "侯淳逸", colorKey: "c1" },
  914: { name: "张怀艺", colorKey: "g1" },
  915: { name: "罗曼", colorKey: "g1" },
  916: { name: "文康懿", colorKey: "g1" },
  917: { name: "伍尚洵", colorKey: "g1" },
  918: { name: "黄浩源", colorKey: "g2" },
  919: { name: "欧阳裕漪", colorKey: "c2" },
  920: { name: "谭筱丸", colorKey: "c3" },
  921: { name: "黄麟懿", colorKey: "c3" },
  922: { name: "余思桐-del", colorKey: "c3" },
  923: { name: "刘轩诚", colorKey: "c3" },
  924: { name: "夏瑞", colorKey: "c3" },
  925: { name: "常津宁", colorKey: "c3" },
  926: { name: "杨葆源", colorKey: "c3" },
  927: { name: "陈景初", colorKey: "c3" },
  928: { name: "王灏霆", colorKey: "g1" },
  929: { name: "陈泓宇", colorKey: "g1" },
  930: { name: "尹致帷", colorKey: "g1" },
  931: { name: "蒋思成", colorKey: "g2" },
  932: { name: "刘曦文", colorKey: "g2" },
  933: { name: "董博远", colorKey: "by" },
  934: { name: "孟庆芸", colorKey: "by" },
  935: { name: "袁子川", colorKey: "g1" },
  936: { name: "李凡希", colorKey: "c3" },
  937: { name: "黄翊航", colorKey: "g1" },
  938: { name: "何思成", colorKey: "g1" },
  939: { name: "钱桥", colorKey: "by" },
  940: { name: "", colorKey: "uk" },
  941: { name: "", colorKey: "uk" },
  942: { name: "", colorKey: "uk" },
  943: { name: "", colorKey: "uk" },
  944: { name: "", colorKey: "uk" },
  945: { name: "", colorKey: "uk" },
  946: { name: "", colorKey: "uk" },
  947: { name: "张凌熙", colorKey: "uk" },
  948: { name: "陈思诚", colorKey: "g1" },
  949: { name: "郭岱颉", colorKey: "g3" },
  950: { name: "周子黄", colorKey: "g1" },
  951: { name: "胡伊洋", colorKey: "g3" },
  952: { name: "杨汶锦", colorKey: "g1" },
  953: { name: "兰博文", colorKey: "g3" },
  954: { name: "李颢龙", colorKey: "g3" },
  955: { name: "", colorKey: "uk" },
  956: { name: "测试-1", colorKey: "by" },
  957: { name: "朱翰篪", colorKey: "g1" },
  958: { name: "邹阳扬", colorKey: "g1" },
  959: { name: "钟博翰", colorKey: "d1" },
  960: { name: "钟弘毅", colorKey: "c2" },
  961: { name: "钱雨恩", colorKey: "c3" },
  962: { name: "李卓衡", colorKey: "c3" },
  963: { name: "李钰沣", colorKey: "c2" },
  964: { name: "钱承泽", colorKey: "c3" },
  965: { name: "李晔涵", colorKey: "c2" },
  966: { name: "公子文", colorKey: "c3" },
  967: { name: "诸逸伦", colorKey: "c3" },
  968: { name: "张梓瑞", colorKey: "c3" },
  969: { name: "江培源", colorKey: "c3" },
  970: { name: "刘乙阳", colorKey: "c3" },
  971: { name: "王梓丞", colorKey: "c3" },
  972: { name: "赖俊岑", colorKey: "c3" },
  973: { name: "马一逍", colorKey: "c3" },
  974: { name: "宋泰然", colorKey: "c3" },
  975: { name: "王品羲", colorKey: "c3" },
  976: { name: "汪泽浩", colorKey: "c3" },
  977: { name: "吴雨翔", colorKey: "c3" },
  978: { name: "李骁畅", colorKey: "c3" },
  979: { name: "顾元淳", colorKey: "c3" },
  980: { name: "易天雨", colorKey: "c3" },
  981: { name: "叶柏岑", colorKey: "c3" },
  982: { name: "蒲思臣", colorKey: "c3" },
  983: { name: "官政", colorKey: "c3" },
  984: { name: "王瑞宁", colorKey: "c3" },
  985: { name: "巫昱恺", colorKey: "g1" },
  986: { name: "张轩诚", colorKey: "g3" },
  987: { name: "严家乐", colorKey: "g3" },
  988: { name: "陈翔宇", colorKey: "g3" },
  989: { name: "张宇衡", colorKey: "g3" },
  990: { name: "谢宇轩", colorKey: "g3" },
  991: { name: "周圣青", colorKey: "c3" },
  992: { name: "刘文驭", colorKey: "c3" },
  993: { name: "彭钰涵", colorKey: "c2" },
  994: { name: "黎莫轩", colorKey: "g3" },
  995: { name: "彭奕力", colorKey: "c3" },
  996: { name: "漆小凡2", colorKey: "c3" },
  997: { name: "蓝静远", colorKey: "g3" },
  998: { name: "李佳翼", colorKey: "g3" },
  999: { name: "聂文涛", colorKey: "g3" },
  1000: { name: "杨铠齐", colorKey: "g3" },
  1001: { name: "吕俊呈", colorKey: "g2" },
  1002: { name: "姚成洋", colorKey: "c3" },
  1003: { name: "吴秉岩", colorKey: "c3" },
  1004: { name: "王子远", colorKey: "c3" },
  1005: { name: "陈景初", colorKey: "c3" },
  1006: { name: "曹曾曾", colorKey: "c3" },
  1007: { name: "张恩瑞", colorKey: "c3" },
  1008: { name: "姜琉", colorKey: "c3" },
  1009: { name: "刘一诺", colorKey: "c3" },
  1010: { name: "孙思羽", colorKey: "c3" },
  1011: { name: "罗禾和", colorKey: "c3" },
  1012: { name: "王瀚森", colorKey: "c3" },
  1013: { name: "伍鸿轩", colorKey: "c3" },
  1014: { name: "田明翰", colorKey: "c3" },
  1015: { name: "陈瑞端", colorKey: "c3" },
  1016: { name: "江宜轩", colorKey: "c3" },
  1017: { name: "黄毅灿", colorKey: "c3" },
  1018: { name: "秦梦煊", colorKey: "c3" },
  1019: { name: "丁若琳", colorKey: "c3" },
  1020: { name: "陈乐章", colorKey: "c3" },
  1021: { name: "冯亭翔", colorKey: "c3" },
  1022: { name: "李晟铭", colorKey: "c3" },
  1023: { name: "刘崧霖", colorKey: "c3" },
  1024: { name: "刘启德", colorKey: "c3" },
  1025: { name: "朱子墨", colorKey: "c3" },
  1026: { name: "高晨朗", colorKey: "c2" },
  1027: { name: "张之瀚", colorKey: "c3" },
  1028: { name: "宋正锡", colorKey: "g2" },
  1029: { name: "杨骏", colorKey: "by" },
  1030: { name: "刘思淇", colorKey: "c3" },
  1031: { name: "王炫理", colorKey: "c2" },
  1032: { name: "荣国文", colorKey: "c3" },
  1033: { name: "胡承旭", colorKey: "g1" },
  1034: { name: "2023001013", colorKey: "c3" },
  1035: { name: "吴沛宸", colorKey: "c3" },
  1036: { name: "张立言", colorKey: "c2" },
  1037: { name: "刘溯理", colorKey: "c2" },
  1038: { name: "杜锦祚", colorKey: "c2" },
  1039: { name: "李子杰", colorKey: "c2" },
  1040: { name: "易米修", colorKey: "c2" },
  1041: { name: "李知之", colorKey: "c2" },
  1042: { name: "邵许", colorKey: "c2" },
  1043: { name: "曹子杰", colorKey: "c2" },
  1044: { name: "邝岳弘", colorKey: "c2" },
  1045: { name: "李炎泽", colorKey: "c2" },
  1046: { name: "张浩然", colorKey: "c2" },
  1047: { name: "罗一宸", colorKey: "c2" },
  1048: { name: "袁珮珆", colorKey: "c2" },
  1049: { name: "张瀚霖", colorKey: "c2" },
  1050: { name: "叶威濂", colorKey: "c2" },
  1051: { name: "蓝乙崴", colorKey: "g1" },
  1052: { name: "胡长治", colorKey: "c2" },
  1053: { name: "王韵涵", colorKey: "c2" },
  1054: { name: "王子睿", colorKey: "c2" },
  1055: { name: "刘同垚", colorKey: "c3" },
  1056: { name: "魏方博", colorKey: "c2" },
  1057: { name: "周博涵", colorKey: "c2" },
  1058: { name: "王梓彧", colorKey: "c3" },
  1059: { name: "龚俊与", colorKey: "g3" },
  1060: { name: "田芩熹", colorKey: "c3" },
  1061: { name: "李远浩", colorKey: "g3" },
  1062: { name: "王松涛", colorKey: "by" },
  1063: { name: "陈恒宇-del", colorKey: "by" },
  1064: { name: "肖翊", colorKey: "c3" },
  1065: { name: "临时", colorKey: "by" },
  1066: { name: "伍霁葳-del", colorKey: "g2" },
  1067: { name: "伍霁葳", colorKey: "g2" },
  1068: { name: "姜羽璘", colorKey: "g1" },
  1069: { name: "李思阳", colorKey: "g1" },
  1070: { name: "章正瀚", colorKey: "c3" },
  1071: { name: "章正瀚-del", colorKey: "c3" },
  1072: { name: "刘芮圻", colorKey: "c3" },
  1073: { name: "袁小涛", colorKey: "c3" },
  1074: { name: "罗涵哲", colorKey: "c3" },
  1075: { name: "王睿", colorKey: "g2" },
  1076: { name: "钟凯宇", colorKey: "c3" },
  1077: { name: "杨浩然", colorKey: "g2" },
  1078: { name: "张嘉芸", colorKey: "c2" },
  1079: { name: "裴雨森", colorKey: "g2" },
  1080: { name: "陈姿彤", colorKey: "g2" },
  1081: { name: "陈奕璇", colorKey: "g2" },
  1082: { name: "毛馨仪", colorKey: "c2" },
  1083: { name: "陈君睿", colorKey: "g2" },
  1084: { name: "蔡尚东", colorKey: "d1" },
  1085: { name: "汪士恒", colorKey: "g2" },
  1086: { name: "黄梓涵", colorKey: "g1" },
  1087: { name: "冯奕歌", colorKey: "c3" },
  1088: { name: "王玺然", colorKey: "c3" },
  1089: { name: "巫沐", colorKey: "c3" },
  1090: { name: "刘言果", colorKey: "c1" },
  1091: { name: "黄尚麟", colorKey: "c2" },
  1092: { name: "黄尚麒", colorKey: "c2" },
  1093: { name: "林皓宸", colorKey: "c2" },
  1094: { name: "文星杰", colorKey: "g2" },
  1095: { name: "赖云喆", colorKey: "g2" },
  1096: { name: "杨博钧", colorKey: "g2" },
  1097: { name: "张学成", colorKey: "g2" },
  1098: { name: "尹尧", colorKey: "g2" },
  1099: { name: "胡宸衍", colorKey: "g2" },
  1100: { name: "张思睿", colorKey: "g2" },
  1101: { name: "胡傅睿", colorKey: "c2" },
  1102: { name: "孙彦倞", colorKey: "c2" },
  1103: { name: "张子豪", colorKey: "c2" },
  1104: { name: "陈泽予", colorKey: "c2" },
  1105: { name: "何正让", colorKey: "c3" },
  1106: { name: "王思勋", colorKey: "c1" },
  1107: { name: "吕承泽", colorKey: "c2" },
  1108: { name: "黄祺远", colorKey: "c2" },
  1109: { name: "贾慎知", colorKey: "c2" },
  1110: { name: "郑嘉珺", colorKey: "c2" },
  1111: { name: "刘子昂", colorKey: "c2" },
  1112: { name: "吴玥濛", colorKey: "c2" },
  1113: { name: "佘睿扬", colorKey: "c2" },
  1114: { name: "刘子豪", colorKey: "c2" },
  1115: { name: "杨文轩", colorKey: "c2" },
  1116: { name: "郑佑宸", colorKey: "c2" },
  1117: { name: "李子肖", colorKey: "c2" },
  1118: { name: "谢语皓同", colorKey: "c2" },
  1119: { name: "万家栋", colorKey: "c2" },
  1120: { name: "韩思宇", colorKey: "c2" },
  1121: { name: "廖一泽", colorKey: "c2" },
  1122: { name: "曾讷言", colorKey: "c2" },
  1123: { name: "陈靖澔", colorKey: "c2" },
  1124: { name: "刘淳智", colorKey: "c2" },
  1125: { name: "王柯皓", colorKey: "c2" },
  1126: { name: "李承骏", colorKey: "c2" },
  1127: { name: "朱志宇", colorKey: "c2" },
  1128: { name: "赖奕菡", colorKey: "c2" },
  1129: { name: "刘丰睿", colorKey: "c2" },
  1130: { name: "宋浚哲", colorKey: "c2" },
  1131: { name: "吴峻熙", colorKey: "c2" },
  1132: { name: "申知非", colorKey: "c2" },
  1133: { name: "向奕涵", colorKey: "c2" },
  1134: { name: "龙玺尧", colorKey: "c2" },
  1135: { name: "肖宇阳", colorKey: "c2" },
  1136: { name: "沈楷伦", colorKey: "c2" },
  1137: { name: "陈玺龙", colorKey: "c2" },
  1138: { name: "王梓渊", colorKey: "c2" },
  1139: { name: "陶俊名", colorKey: "c2" },
  1140: { name: "叶林洲", colorKey: "c2" },
  1141: { name: "于孟辰", colorKey: "c2" },
  1142: { name: "葛怡佳", colorKey: "c2" },
  1143: { name: "牛志成", colorKey: "c2" },
  1144: { name: "郭芸熙", colorKey: "c2" },
  1145: { name: "高铭", colorKey: "c2" },
  1146: { name: "许添韵", colorKey: "c2" },
  1147: { name: "马正洋", colorKey: "c2" },
  1148: { name: "刘皓轩", colorKey: "c2" },
  1149: { name: "胡杰垚", colorKey: "c3" },
  1150: { name: "黄梓轩", colorKey: "g2" },
  1151: { name: "杨佑晖", colorKey: "g2" },
  1152: { name: "王星集", colorKey: "c2" },
  1153: { name: "None", colorKey: "g1" },
  1154: { name: "刘楚谦", colorKey: "g1" },
  1155: { name: "蒋锦涛", colorKey: "c2" },
  1156: { name: "陈为仪", colorKey: "c2" },
  1157: { name: "陈骏贤", colorKey: "c2" },
  1158: { name: "刘泽宇", colorKey: "c1" },
  1159: { name: "黄奕珲", colorKey: "c1" },
  1160: { name: "刘厚朴", colorKey: "c2" },
  1161: { name: "李泽轩", colorKey: "c2" },
  1162: { name: "何梓滔", colorKey: "c2" },
  1163: { name: "敬沐年", colorKey: "c2" },
  1164: { name: "柯睿思", colorKey: "c2" },
  1165: { name: "陈科帆", colorKey: "c1" },
  1166: { name: "田亮", colorKey: "g1" },
  1167: { name: "史梓琛", colorKey: "c2" },
  1168: { name: "庄乐言", colorKey: "c2" },
  1169: { name: "曾泽辉", colorKey: "c3" },
  1170: { name: "贾淏文", colorKey: "c3" },
  1171: { name: "徐静丹", colorKey: "c2" },
  1172: { name: "徐苒茨", colorKey: "jl" },
  1173: { name: "刘思成", colorKey: "g2" },
  1174: { name: "钟沐霖", colorKey: "c2" },
  1175: { name: "刘佩林", colorKey: "c2" },
  1176: { name: "杨辰瑾", colorKey: "c2" },
  1177: { name: "姚烨栋", colorKey: "c2" },
  1178: { name: "马琳峰", colorKey: "g1" },
  1179: { name: "赖今羿", colorKey: "g2" },
  1180: { name: "测试", colorKey: "c3" },
  1181: { name: "测试", colorKey: "d1" },
  1182: { name: "代唯祺", colorKey: "c1" },
  1183: { name: "he", colorKey: "by" },
  1184: { name: "赵淀磊", colorKey: "c3" },
  1185: { name: "税义翔", colorKey: "c3" },
  1186: { name: "张旷玉", colorKey: "c3" },
  1187: { name: "张辰睿", colorKey: "c3" },
  1188: { name: "杨关赵耀", colorKey: "c3" },
  1189: { name: "何秉轩", colorKey: "c3" },
  1190: { name: "汪梓澜", colorKey: "c2" },
  1191: { name: "宁亦檬", colorKey: "g1" },
  1192: { name: "唐煜骅", colorKey: "g1" },
  1193: { name: "申璟浩", colorKey: "c2" },
  1194: { name: "罗子忱", colorKey: "c2" },
  1195: { name: "邓岚膑", colorKey: "by" },
  1196: { name: "test", colorKey: "d3" },
  1197: { name: "mydc-cyx", colorKey: "d3" },
  1198: { name: "arbiter", colorKey: "d3" },
  1199: { name: "段凯霖", colorKey: "g1" },
  1200: { name: "刘星宇（外校）", colorKey: "g1" },
  1201: { name: "fengenrong", colorKey: "c3" },
  1202: { name: "zhaojunyi", colorKey: "g2" },
  1203: { name: "wanghan", colorKey: "c3" },
  1204: { name: "yangshangqi", colorKey: "d3" },
  1205: { name: "卢智杰", colorKey: "g1" },
  1206: { name: "莫鹏聪", colorKey: "g1" },
  1207: { name: "汪嘉越", colorKey: "g1" },
  1208: { name: "fengziyang", colorKey: "g3" },
  1209: { name: "冯子上", colorKey: "g1" },
  1210: { name: "liangwenzheng", colorKey: "c3" },
  1211: { name: "xiechenrui", colorKey: "g2" },
  1212: { name: "林威", colorKey: "g1" },
  1213: { name: "jiangxinrui", colorKey: "d3" },
  1214: { name: "ouyangcheng", colorKey: "c1" },
  1215: { name: "何泓谦", colorKey: "g1" },
  1216: { name: "cuijinwei", colorKey: "d3" },
  1217: { name: "王梓烨", colorKey: "g2" },
  1218: { name: "zhangziheng", colorKey: "c3" },
  1219: { name: "邹浩楠", colorKey: "g1" },
  1220: { name: "fengzhijian", colorKey: "d3" },
  1221: { name: "xiongbotao", colorKey: "c3" },
  1222: { name: "hehuilang", colorKey: "c3" },
  1223: { name: "邝思远", colorKey: "g1" },
  1224: { name: "huangbolin", colorKey: "d3" },
  1225: { name: "daibeiqi", colorKey: "d3" },
  1226: { name: "xiongyifan", colorKey: "g2" },
  1227: { name: "zhangtianzhi", colorKey: "c3" },
  1228: { name: "张清扬", colorKey: "c3" },
  1229: { name: "liuruian", colorKey: "c3" },
  1230: { name: "陈璟熙", colorKey: "g2" },
  1231: { name: "杨嘉宇", colorKey: "g1" },
  1232: { name: "luhongxi", colorKey: "g2" },
  1233: { name: "fangziqian", colorKey: "c3" },
  1234: { name: "汪嘉超", colorKey: "g1" },
  1235: { name: "zhoulilin", colorKey: "d3" },
  1236: { name: "shangjiasen", colorKey: "g1" },
  1237: { name: "lizhaoyan", colorKey: "d3" },
  1238: { name: "anjiachang", colorKey: "g3" },
  1239: { name: "邓正浩", colorKey: "g2" },
  1240: { name: "maijunxuan", colorKey: "d3" },
  1241: { name: "殷泽轩", colorKey: "g1" },
  1242: { name: "huangboming", colorKey: "d3" },
  1243: { name: "hujinhong", colorKey: "g1" },
  1244: { name: "庞睿康", colorKey: "c3" },
  1245: { name: "luzirui", colorKey: "c3" },
  1246: { name: "songzhenghao", colorKey: "c3" },
  1247: { name: "wangtianyu", colorKey: "g2" },
  1248: { name: "chendanyu", colorKey: "d3" },
  1249: { name: "liuchikai", colorKey: "c3" },
  1250: { name: "何明恩", colorKey: "g1" },
  1251: { name: "weiyizhong", colorKey: "d3" },
  1252: { name: "lizhaoyuan", colorKey: "c3" },
  1253: { name: "何奕", colorKey: "g1" },
  1254: { name: "fangliheng", colorKey: "c3" },
  1255: { name: "wangzihang", colorKey: "g3" },
  1256: { name: "徐晓彬", colorKey: "g2" },
  1257: { name: "黄子信", colorKey: "g2" },
  1258: { name: "liqinchuan", colorKey: "d3" },
  1259: { name: "罗伟祺", colorKey: "g1" },
  1260: { name: "xuyalin", colorKey: "g3" },
  1261: { name: "冯乐天", colorKey: "g2" },
  1262: { name: "yuanshengming", colorKey: "g2" },
  1263: { name: "wangchunjie", colorKey: "g2" },
  1264: { name: "tianbingcheng", colorKey: "uk" },
  1265: { name: "朱浩源", colorKey: "g1" },
  1266: { name: "hanyilin", colorKey: "d3" },
  1267: { name: "lijiankun", colorKey: "c2" },
  1268: { name: "wangzihe", colorKey: "g1" },
  1269: { name: "林致远", colorKey: "uk" },
  1270: { name: "luyiran", colorKey: "g1" },
  1271: { name: "黄思源", colorKey: "g1" },
  1272: { name: "wangziyue", colorKey: "d3" },
  1273: { name: "zhangxuanyu", colorKey: "g1" },
  1274: { name: "wangyizhen", colorKey: "c3" },
  1275: { name: "雷德轩", colorKey: "c3" },
  1276: { name: "zhangzhe", colorKey: "d3" },
  1277: { name: "wangqihang", colorKey: "g1" },
  1278: { name: "wengpeifeng", colorKey: "c3" },
  1279: { name: "陈子楠", colorKey: "g3" },
  1280: { name: "lingruibang", colorKey: "d3" },
  1281: { name: "wangruohan", colorKey: "g2" },
  1282: { name: "xiezihan", colorKey: "c3" },
  1283: { name: "cuichengxi", colorKey: "g2" },
  1284: { name: "祁明锐", colorKey: "c2" },
  1285: { name: "贾淏文-del", colorKey: "c3" },
  1286: { name: "刘晨煜", colorKey: "c2" },
  1287: { name: "wangshiqing", colorKey: "c1" },
  1288: { name: "zhangjiashu", colorKey: "c3" },
  1289: { name: "田滨诚", colorKey: "g1" },
  1290: { name: "冯潇文", colorKey: "c2" },
  1291: { name: "王誉皓", colorKey: "g2" },
  1292: { name: "廖佳怡", colorKey: "d1" },
  1293: { name: "黎铭瀚", colorKey: "d1" },
  1294: { name: "李卓宸", colorKey: "d1" },
  1295: { name: "郭彦凯", colorKey: "d1" },
  1296: { name: "del_黎红宇", colorKey: "by" },
  1297: { name: "尹致帷-del", colorKey: "by" },
  1298: { name: "肖柘天", colorKey: "c1" },
  1299: { name: "邝岳弘-del", colorKey: "by" },
  1300: { name: "徐守中", colorKey: "c2" },
  1301: { name: "谢易轩", colorKey: "c2" },
  1302: { name: "del_温俊锋", colorKey: "by" },
  1303: { name: "del_杨宸林子", colorKey: "by" },
  1304: { name: "del_程钦荻", colorKey: "by" },
  1305: { name: "杨景熙", colorKey: "uk" },
  1306: { name: "del-杨智予", colorKey: "c2" },
  1307: { name: "del_邓岚元", colorKey: "by" },
  1308: { name: "贺羿文", colorKey: "by" },
  1309: { name: "彭佳睿", colorKey: "by" },
  1310: { name: "邹阳扬-del", colorKey: "uk" },
  1311: { name: "曾陈", colorKey: "by" },
  1312: { name: "贺淏", colorKey: "by" },
  1313: { name: "王秉轩", colorKey: "c2" },
  1314: { name: "黄奕衡", colorKey: "c1" },
  1315: { name: "庞昊轩", colorKey: "c1" },
  1316: { name: "谭珺桐", colorKey: "c1" },
  1317: { name: "袁子霖", colorKey: "by" },
  1318: { name: "张御霖", colorKey: "by" },
  1319: { name: "董博远", colorKey: "by" },
  1320: { name: "刘婉", colorKey: "by" },
  1321: { name: "唐振强", colorKey: "by" },
  1322: { name: "林涛", colorKey: "by" },
  1323: { name: "del_刘川鲁", colorKey: "by" },
  1324: { name: "李昱燊", colorKey: "by" },
  1325: { name: "夏瑞", colorKey: "by" },
  1326: { name: "余思桐 -del2", colorKey: "by" },
  1327: { name: "李凡希", colorKey: "by" },
  1328: { name: "刘罗乐", colorKey: "by" },
  1329: { name: "文秋画", colorKey: "by" },
  1330: { name: "陈仟阅", colorKey: "c1" },
  1331: { name: "李羿宏", colorKey: "c1" },
  1332: { name: "宁梓骁", colorKey: "c1" },
  1333: { name: "廖晓晨", colorKey: "c1" },
  1334: { name: "唐云旂", colorKey: "c1" },
  1335: { name: "del_陈科帆", colorKey: "by" },
  1336: { name: "何梓馨", colorKey: "c1" },
  1337: { name: "黄旭", colorKey: "x6" },
  1338: { name: "刘嘉睿", colorKey: "c1" },
  1339: { name: "王海烨", colorKey: "g2" },
  1340: { name: "", colorKey: "by" },
  1341: { name: "牟益", colorKey: "c1" },
  1342: { name: "程王浩", colorKey: "c1" },
  1343: { name: "金敬淳", colorKey: "c1" },
  1344: { name: "张浩渺", colorKey: "c1" },
  1345: { name: "熊浩然", colorKey: "c2" },
  1346: { name: "刘泓成", colorKey: "c1" },
  1347: { name: "朱侯睿", colorKey: "c1" },
  1348: { name: "dygxchenlang", colorKey: "uk" },
  1349: { name: "dygxzhangtianzhi2023", colorKey: "uk" },
  1350: { name: "dygx_Z", colorKey: "d3" },
  1351: { name: "dygxluzirui2023", colorKey: "uk" },
  1352: { name: "wcj", colorKey: "uk" },
  1353: { name: "dygxweiyizhong2023", colorKey: "uk" },
  1354: { name: "dygxlingruibang2023", colorKey: "uk" },
  1355: { name: "dygxzhuziqian2023", colorKey: "uk" },
  1356: { name: "dygxluhongxi2023", colorKey: "uk" },
  1357: { name: "dygxxiongbotao2023", colorKey: "uk" },
  1358: { name: "dygxfangziqian2023", colorKey: "uk" },
  1359: { name: "dygxhanyilin2023", colorKey: "uk" },
  1360: { name: "dygxliuruian2023", colorKey: "uk" },
  1361: { name: "dygxsongzhenghao2023", colorKey: "uk" },
  1362: { name: "dygxhuangbolin2023", colorKey: "uk" },
  1363: { name: "dygxzhangziheng2023", colorKey: "uk" },
  1364: { name: "dygxzhoulilin2023", colorKey: "uk" },
  1365: { name: "dygxchenzinan", colorKey: "uk" },
  1366: { name: "黄子轩", colorKey: "g3" },
  1367: { name: "dygxliangwenzheng2023", colorKey: "uk" },
  1368: { name: "dygxzhangtianzhi", colorKey: "uk" },
  1369: { name: "dygxluzirui", colorKey: "uk" },
  1370: { name: "dygxweiyizhong", colorKey: "uk" },
  1371: { name: "dygxlingruibang", colorKey: "uk" },
  1372: { name: "dygxzhuziqian", colorKey: "d3" },
  1373: { name: "dygxluhongxi", colorKey: "uk" },
  1374: { name: "dygxxiongbotao", colorKey: "uk" },
  1375: { name: "dygxfangziqian", colorKey: "uk" },
  1376: { name: "dygxhanyilin", colorKey: "uk" },
  1377: { name: "dygxliuruian", colorKey: "uk" },
  1378: { name: "dygxzhangziheng", colorKey: "uk" },
  1379: { name: "dygxzhoulilin", colorKey: "uk" },
  1380: { name: "dygxliangwenzheng", colorKey: "uk" },
  1381: { name: "dygxhuangyuxi", colorKey: "uk" },
  1382: { name: "dygxwanghan", colorKey: "uk" },
  1383: { name: "dygxjiangxinrui", colorKey: "uk" },
  1384: { name: "dygxfengenrong", colorKey: "uk" },
  1385: { name: "dygxlizhaoyan", colorKey: "uk" },
  1386: { name: "dygxchendanyu", colorKey: "uk" },
  1387: { name: "dygxmaijuanxuan", colorKey: "uk" },
  1388: { name: "dygxyangshangqi", colorKey: "uk" },
  1389: { name: "dygxfangliheng", colorKey: "uk" },
  1390: { name: "dygxsongzhenghao", colorKey: "uk" },
  1391: { name: "dygxzhangzhe", colorKey: "uk" },
  1392: { name: "谭竣铭", colorKey: "g3" },
  1393: { name: "邓正浩", colorKey: "d3" },
  1394: { name: "dygxhuangbolin", colorKey: "uk" },
  1395: { name: "蔡弈凡", colorKey: "g2" },
  1396: { name: "范苇林", colorKey: "g1" },
  1397: { name: "蒋周运", colorKey: "g1" },
  1398: { name: "金戈", colorKey: "g1" },
  1399: { name: "江子民", colorKey: "g2" },
  1400: { name: "李烨霖", colorKey: "g1" },
  1401: { name: "王韬淳", colorKey: "g1" },
  1402: { name: "xuhaodong", colorKey: "c3" },
  1403: { name: "xuruicheng", colorKey: "g1" },
  1404: { name: "xuruiheng", colorKey: "g1" },
  1405: { name: "应昊廷", colorKey: "g2" },
  1406: { name: "zhouyichen", colorKey: "g2" },
  1407: { name: "左天佑", colorKey: "uk" },
  1408: { name: "sunweichen", colorKey: "g1" },
  1409: { name: "付泠菲", colorKey: "g2" },
  1410: { name: "刘萃情", colorKey: "g2" },
  1411: { name: "niuziru", colorKey: "d3" },
  1412: { name: "tbc", colorKey: "uk" },
  1413: { name: "zhaoyunfan", colorKey: "d3" },
  1414: { name: "dygxchendanyu2023", colorKey: "d3" },
  1415: { name: "dygxfangliheng2023", colorKey: "uk" },
  1416: { name: "dygxfengenrong2023", colorKey: "uk" },
  1417: { name: "dygxhuangyuxi2023", colorKey: "uk" },
  1418: { name: "dygxjiangxinrui2023", colorKey: "uk" },
  1419: { name: "dygxlizhaoyan2023", colorKey: "uk" },
  1420: { name: "dygxmaijuanxuan2023", colorKey: "uk" },
  1421: { name: "dygxwanghan2023", colorKey: "uk" },
  1422: { name: "dygxyangshangqi2023", colorKey: "uk" },
  1423: { name: "dygxzhangzhe2023", colorKey: "uk" },
  1424: { name: "weimingmingwenjianjia", colorKey: "d3" },
  1425: { name: "冷林轩", colorKey: "c1" },
  1426: { name: "楚景琰", colorKey: "x6" },
  1427: { name: "邱家毅", colorKey: "c1" },
  1428: { name: "杨博文", colorKey: "by" },
  1429: { name: "path", colorKey: "d3" },
  1430: { name: "graph", colorKey: "d3" },
  1431: { name: "darksoul", colorKey: "d3" },
  1432: { name: "creed", colorKey: "d3" },
  1433: { name: "黄宇曦", colorKey: "c3" },
  1434: { name: "江子民", colorKey: "uk" },
  1435: { name: "zjy", colorKey: "uk" },
  1436: { name: "qhfz-hujinhong", colorKey: "uk" },
  1437: { name: "贺思恺", colorKey: "g1" },
  1438: { name: "std", colorKey: "d3" },
  1439: { name: "dygx__xiezihan", colorKey: "uk" },
  1440: { name: "麦隽轩", colorKey: "c3" },
  1441: { name: "huagnzixin", colorKey: "uk" },
  1442: { name: "zhouyichen", colorKey: "uk" },
  1443: { name: "wyl", colorKey: "uk" },
  1444: { name: "陈朗", colorKey: "g2" },
  1445: { name: "冯智凡", colorKey: "g1" },
  1446: { name: "陈玥影", colorKey: "c1" },
  1447: { name: "邱振凯", colorKey: "c1" },
  1448: { name: "祝晗泽", colorKey: "c2" },
  1449: { name: "陈沛霖", colorKey: "c2" },
  1450: { name: "朱梓宁", colorKey: "c1" },
  1451: { name: "刘星宇", colorKey: "x6" },
  1452: { name: "李崇楷", colorKey: "c1" },
  1453: { name: "张恩硕", colorKey: "c1" },
  1454: { name: "孙滋凯", colorKey: "c1" },
  1455: { name: "聂梓航", colorKey: "c1" },
  1456: { name: "del_聂梓航", colorKey: "c1" },
  1457: { name: "杨迪程", colorKey: "c1" },
  1458: { name: "彭博彦", colorKey: "c1" },
  1459: { name: "石皓霆", colorKey: "c1" },
  1460: { name: "张文雨萱", colorKey: "c2" },
  1461: { name: "del-廖昶懿", colorKey: "c2" },
  1462: { name: "del-王彦婷", colorKey: "c2" },
  1463: { name: "黄王彦傑", colorKey: "c1" },
  1464: { name: "向靖宇", colorKey: "c1" },
  1465: { name: "申梓呈", colorKey: "c1" },
  1466: { name: "陈志嘉", colorKey: "c1" },
  1467: { name: "黄天皓", colorKey: "c1" },
  1468: { name: "张朕浩", colorKey: "c1" },
  1469: { name: "钱廷李", colorKey: "c1" },
  1470: { name: "黄培与", colorKey: "c1" },
  1471: { name: "牛静远", colorKey: "c1" },
  1472: { name: "文昱皓", colorKey: "c2" },
  1473: { name: "何坤壕", colorKey: "c1" },
  1474: { name: "苏子洲", colorKey: "g2" },
  1475: { name: "陈俊贤", colorKey: "c2" },
  1476: { name: "王彦婷", colorKey: "c2" },
  1477: { name: "陶丁鹏", colorKey: "c2" },
  1478: { name: "熊思博", colorKey: "c2" },
  1479: { name: "郑喻铭", colorKey: "c1" },
  1480: { name: "廖昶懿", colorKey: "c2" },
  1481: { name: "杨嘉缘", colorKey: "g3" },
  1482: { name: "打印机", colorKey: "by" },
  1483: { name: "caocan", colorKey: "d3" },
  1484: { name: "huanghaoyuan", colorKey: "d3" },
  1485: { name: "huangshizhe", colorKey: "d3" },
  1486: { name: "huangzixuan", colorKey: "uk" },
  1487: { name: "laijinyi", colorKey: "d3" },
  1488: { name: "songchengchen", colorKey: "d3" },
  1489: { name: "wangshiheng", colorKey: "d3" },
  1490: { name: "wenxingjie", colorKey: "d3" },
  1491: { name: "zhouxingyu", colorKey: "d3" },
  1492: { name: "赵牧兮", colorKey: "c2" },
  1493: { name: "dygx__liuchikai", colorKey: "uk" },
  1494: { name: "孙伟宸", colorKey: "g1" },
  1495: { name: "tianbincheng", colorKey: "d3" },
  1496: { name: "卜梓轩", colorKey: "g2" },
  1497: { name: "顾梓程", colorKey: "g2" },
  1498: { name: "yyhs-shihaotian", colorKey: "uk" },
  1499: { name: "许恒毅", colorKey: "c3" },
  1500: { name: "徐子叶", colorKey: "uk" },
  1501: { name: "曾启阳", colorKey: "g1" },
  1502: { name: "展伟杰", colorKey: "g2" },
  1503: { name: "赵泽楷", colorKey: "c2" },
  1504: { name: "朱毅乐", colorKey: "g3" },
  1505: { name: "任桢昊", colorKey: "g2" },
  1506: { name: "luyanlin", colorKey: "c2" },
  1507: { name: "张一凡", colorKey: "c1" },
  1508: { name: "张世豪", colorKey: "c2" },
  1509: { name: "张锦锋", colorKey: "c2" },
  1510: { name: "杨沅鑫", colorKey: "g2" },
  1511: { name: "楼书浩", colorKey: "c2" },
  1512: { name: "毛沈兴", colorKey: "c2" },
  1513: { name: "罗煊皓", colorKey: "c2" },
  1514: { name: "胡思成", colorKey: "g2" },
  1515: { name: "褚烯南", colorKey: "c3" },
  1516: { name: "邵泽楠", colorKey: "c3" },
  1517: { name: "陈宇阳", colorKey: "g2" },
  1518: { name: "黄诗然", colorKey: "d3" },
  1519: { name: "张之恒", colorKey: "g2" },
  1520: { name: "舒航", colorKey: "g2" },
  1521: { name: "杨昊鑫", colorKey: "c2" },
  1522: { name: "王羿洋", colorKey: "c2" },
  1523: { name: "李鑫铭", colorKey: "c2" },
  1524: { name: "林书豪", colorKey: "c2" },
  1525: { name: "吴展睿", colorKey: "c2" },
  1526: { name: "向星豫", colorKey: "c2" },
  1527: { name: "席恩蕊", colorKey: "c2" },
  1528: { name: "陈希睿", colorKey: "c2" },
  1529: { name: "欧阳驰盛", colorKey: "c2" },
  1530: { name: "何昊恩", colorKey: "c2" },
  1531: { name: "梁朝文", colorKey: "c2" },
  1532: { name: "刘耀泽", colorKey: "c2" },
  1533: { name: "陈臻昊", colorKey: "c2" },
  1534: { name: "舒玺豫", colorKey: "c2" },
  1535: { name: "肖江浪", colorKey: "c2" },
  1536: { name: "赵星瑞", colorKey: "c2" },
  1537: { name: "段佩言", colorKey: "c2" },
  1538: { name: "霍启成", colorKey: "c2" },
  1539: { name: "姜佑锴", colorKey: "c1" },
  1540: { name: "潘祠熠", colorKey: "c1" },
  1541: { name: "刘轩宇", colorKey: "c1" },
  1542: { name: "田墌尧", colorKey: "uk" },
  1543: { name: "韩辰宇", colorKey: "uk" },
  1544: { name: "戴千皓", colorKey: "c1" },
  1545: { name: "林才涵", colorKey: "c1" },
  1546: { name: "安思源", colorKey: "c1" },
  1547: { name: "张正宇", colorKey: "c1" },
  1548: { name: "冯学嗣", colorKey: "c1" },
  1549: { name: "陈泓昊", colorKey: "c1" },
  1550: { name: "赵若婷", colorKey: "c1" },
  1551: { name: "王毅阳", colorKey: "c1" },
  1552: { name: "刘雨泽", colorKey: "c1" },
  1553: { name: "余瑾", colorKey: "c1" },
  1554: { name: "刘霂轩", colorKey: "c1" },
  1555: { name: "严嘉毅", colorKey: "c1" },
  1556: { name: "罗国航", colorKey: "c1" },
  1557: { name: "陈宇轩", colorKey: "c1" },
  1558: { name: "尼哲林", colorKey: "c1" },
  1559: { name: "祁钰雯", colorKey: "c1" },
  1560: { name: "王嘉诚", colorKey: "c1" },
  1561: { name: "del-祝晗泽", colorKey: "c2" },
  1562: { name: "李思锐", colorKey: "c1" },
  1563: { name: "齐竟然", colorKey: "c1" },
  1564: { name: "王皓轩", colorKey: "uk" },
  1565: { name: "兰宗霖", colorKey: "c1" },
  1566: { name: "杨洛熹", colorKey: "c1" },
  1567: { name: "陈梓豪", colorKey: "c1" },
  1568: { name: "徐子叶", colorKey: "c1" },
  1569: { name: "binbin", colorKey: "d3" },
  1570: { name: "wangruohan", colorKey: "d3" },
  1571: { name: "陈鸣烨", colorKey: "g2" },
  1572: { name: "王炜哲", colorKey: "c3" },
  1573: { name: "yysh-zhaozekai", colorKey: "d3" },
  1574: { name: "huangzixin", colorKey: "uk" },
  1575: { name: "fengletian", colorKey: "uk" },
  1576: { name: "石浩天", colorKey: "g2" },
  1577: { name: "彭赞滔", colorKey: "g2" },
  1578: { name: "王简博", colorKey: "c2" },
  1579: { name: "李梓潇", colorKey: "c2" },
  1580: { name: "代倬尘", colorKey: "c3" },
  1581: { name: "yyhs-szn", colorKey: "uk" },
  1582: { name: "陈西贝", colorKey: "c2" },
  1583: { name: "", colorKey: "uk" },
  1584: { name: "huangdi", colorKey: "d3" },
  1585: { name: "xiejiazheng", colorKey: "d3" },
  1586: { name: "牛梓瑞", colorKey: "g2" },
  1587: { name: "王沐天", colorKey: "g1" },
  1588: { name: "张君维", colorKey: "g1" },
  1589: { name: "殷子嘉", colorKey: "uk" },
  1590: { name: "黄镜元", colorKey: "uk" },
  1591: { name: "张晋嘉", colorKey: "c1" },
  1592: { name: "张泰祯", colorKey: "c1" },
  1593: { name: "吴寒", colorKey: "c1" },
  1594: { name: "汤涵洋溢", colorKey: "c1" },
  1595: { name: "尹绘豪", colorKey: "c2" },
  1596: { name: "杨拾秋", colorKey: "uk" },
  1597: { name: "袁嘉栋", colorKey: "x5" },
  1598: { name: "陈世杰", colorKey: "x6" },
  1599: { name: "刘子悦", colorKey: "x6" },
  1600: { name: "郭懿萱", colorKey: "x6" },
  1601: { name: "汤马宽芯", colorKey: "uk" },
  1602: { name: "罗恺睎", colorKey: "x6" },
  1603: { name: "柯秉逸", colorKey: "x6" },
  1604: { name: "周子杰", colorKey: "x6" },
  1605: { name: "谢乐逸", colorKey: "x6" },
  1606: { name: "赵启杰", colorKey: "x6" },
  1607: { name: "黄紫怡", colorKey: "x6" },
  1608: { name: "张沐岩", colorKey: "x6" },
  1609: { name: "赵晟汐", colorKey: "x6" },
  1610: { name: "汪子叶", colorKey: "x6" },
  1611: { name: "叶依辰", colorKey: "x6" },
  1612: { name: "罗增睿", colorKey: "x6" },
  1613: { name: "龙映汐", colorKey: "c1" },
  1614: { name: "何义金辰", colorKey: "c1" },
  1615: { name: "陈锐欣", colorKey: "c1" },
  1616: { name: "吴安极", colorKey: "c1" },
  1617: { name: "张国智", colorKey: "c1" },
  1618: { name: "张天宇", colorKey: "c1" },
  1619: { name: "江天一", colorKey: "c1" },
  1620: { name: "肖梓逸", colorKey: "c1" },
  1621: { name: "王博恩", colorKey: "c1" },
  1622: { name: "张哲嘉", colorKey: "c1" },
  1623: { name: "熊嘉浩", colorKey: "c1" },
  1624: { name: "易垚鑫", colorKey: "c1" },
  1625: { name: "赵艺然", colorKey: "c2" },
  1626: { name: "李一涵", colorKey: "c2" },
  1627: { name: "何青屹", colorKey: "c2" },
  1628: { name: "赵文婷", colorKey: "c2" },
  1629: { name: "吴牧轩", colorKey: "c2" },
  1630: { name: "袁嘉志", colorKey: "c2" },
  1631: { name: "席梓翔", colorKey: "c2" },
  1632: { name: "曹天意", colorKey: "c2" },
  1633: { name: "钱林齐", colorKey: "c2" },
  1634: { name: "何枘勐", colorKey: "c2" },
  1635: { name: "罗珊", colorKey: "by" },
  1636: { name: "周彦汐", colorKey: "by" },
  1637: { name: "宋显然", colorKey: "c3" },
  1638: { name: "高振翔", colorKey: "c1" },
  1639: { name: "王思达", colorKey: "c2" },
  1640: { name: "比赛队伍一", colorKey: "c2" },
  1641: { name: "比赛队伍二", colorKey: "c2" },
  1642: { name: "比赛队伍三", colorKey: "c2" },
  1643: { name: "比赛队伍四", colorKey: "c2" },
  1644: { name: "比赛队伍五", colorKey: "c2" },
  1645: { name: "比赛队伍六", colorKey: "c2" },
  1646: { name: "比赛队伍七", colorKey: "c2" },
  1647: { name: "五年级比赛队伍一", colorKey: "c1" },
  1648: { name: "五年级比赛队伍二", colorKey: "c1" },
  1649: { name: "五年级比赛队伍三", colorKey: "c1" },
  1650: { name: "蒋曜檀", colorKey: "c1" },
  1651: { name: "五年级比赛队伍四", colorKey: "c1" },
  1652: { name: "五年级比赛队伍五", colorKey: "c1" },
  1653: { name: "五年级比赛队伍六", colorKey: "c1" },
  1654: { name: "五年级比赛队伍七", colorKey: "c1" },
  1655: { name: "五年级比赛队伍八", colorKey: "c1" },
  1656: { name: "五年级比赛队伍九", colorKey: "c1" },
  1657: { name: "五年级比赛队伍十", colorKey: "c1" },
  1658: { name: "五年级比赛队伍十一", colorKey: "c1" },
  1659: { name: "罗奕诚", colorKey: "uk" },
  1660: { name: "比赛队伍二十", colorKey: "c2" },
  1661: { name: "余思桐", colorKey: "c3" },
  1662: { name: "汤晟睿", colorKey: "c2" },
  1663: { name: "唐梓翔-del", colorKey: "c3" },
  1664: { name: "唐梓翔", colorKey: "c3" },
  1665: { name: "chengyichen", colorKey: "d3" },
  1666: { name: "cdjx_chenlinxuan", colorKey: "d3" },
  1667: { name: "cdjx_chentongzhi", colorKey: "d3" },
  1668: { name: "cdjx_guohaoyu", colorKey: "d3" },
  1669: { name: "cdjx_limoxuan", colorKey: "d3" },
  1670: { name: "cdjx_linuhan", colorKey: "d3" },
  1671: { name: "cdjx_sunbangbo", colorKey: "d3" },
  1672: { name: "cdjx_wanghaiye", colorKey: "d3" },
  1673: { name: "cdjx_wangtengli", colorKey: "d3" },
  1674: { name: "cdjx_wangyixuan", colorKey: "d3" },
  1675: { name: "cdjx_zhangzipei", colorKey: "d3" },
  1676: { name: "陈泽聪", colorKey: "g1" },
  1677: { name: "buzixun", colorKey: "d3" },
  1678: { name: "吴昊燃", colorKey: "c1" },
  1679: { name: "王翊临", colorKey: "uk" },
  1680: { name: "龚子昂", colorKey: "g1" },
  1681: { name: "高云朗", colorKey: "c2" },
  1682: { name: "陈庆", colorKey: "by" },
  1683: { name: "胡伟栋", colorKey: "by" },
  1684: { name: "汪星明", colorKey: "by" },
  1685: { name: "宋新波", colorKey: "by" },
  1686: { name: "黄新军", colorKey: "by" },
  1687: { name: "曾艺卿", colorKey: "by" },
  1688: { name: "熊超", colorKey: "by" },
  1689: { name: "向期中", colorKey: "by" },
  1690: { name: "曹利国", colorKey: "by" },
  1691: { name: "曹文", colorKey: "by" },
  1692: { name: "杜沁仪", colorKey: "by" },
  1693: { name: "屈运华", colorKey: "by" },
  1694: { name: "徐先友", colorKey: "by" },
  1695: { name: "周邦", colorKey: "by" },
  1696: { name: "李天呈", colorKey: "d1" },
  1697: { name: "施陈豪", colorKey: "d1" },
  1698: { name: "吴童", colorKey: "d1" },
  1699: { name: "胡瀚锴", colorKey: "g3" },
  1700: { name: "黄俊淇", colorKey: "g3" },
  1701: { name: "任清扬", colorKey: "g3" },
  1702: { name: "张子卓", colorKey: "g3" },
  1703: { name: "谷宣萱", colorKey: "g3" },
  1704: { name: "李青阳", colorKey: "g3" },
  1705: { name: "孙嘉乐", colorKey: "g3" },
  1706: { name: "张程皓", colorKey: "g3" },
  1707: { name: "周乐达", colorKey: "g2" },
  1708: { name: "周裕杭", colorKey: "g2" },
  1709: { name: "黄锦扬", colorKey: "g2" },
  1710: { name: "陈信允", colorKey: "g1" },
  1711: { name: "左欣颖", colorKey: "d1" },
  1712: { name: "董彦成", colorKey: "g3" },
  1713: { name: "施宇轩", colorKey: "g3" },
  1714: { name: "武林", colorKey: "g3" },
  1715: { name: "韩思远", colorKey: "g3" },
  1716: { name: "刘亦乐", colorKey: "g3" },
  1717: { name: "殷骏", colorKey: "g2" },
  1718: { name: "李劭鸿", colorKey: "g2" },
  1719: { name: "孙志航", colorKey: "g2" },
  1720: { name: "杨圳", colorKey: "d1" },
  1721: { name: "马梓航", colorKey: "d1" },
  1722: { name: "何传奇", colorKey: "d1" },
  1723: { name: "徐恺", colorKey: "d1" },
  1724: { name: "马恺阳", colorKey: "g3" },
  1725: { name: "靳棋皓", colorKey: "g3" },
  1726: { name: "江俊宏", colorKey: "g3" },
  1727: { name: "曾韦皓", colorKey: "g3" },
  1728: { name: "刘家炜", colorKey: "g3" },
  1729: { name: "潘梓睿", colorKey: "d1" },
  1730: { name: "李宇瀚", colorKey: "d1" },
  1731: { name: "师小川", colorKey: "d1" },
  1732: { name: "徐骁扬", colorKey: "d1" },
  1733: { name: "林唯宇", colorKey: "g3" },
  1734: { name: "吴瑞祺", colorKey: "g3" },
  1735: { name: "张睿宸", colorKey: "g3" },
  1736: { name: "陈韵霖", colorKey: "g3" },
  1737: { name: "罗汇翔", colorKey: "d1" },
  1738: { name: "胡一凡", colorKey: "d1" },
  1739: { name: "李铭乐洋", colorKey: "d1" },
  1740: { name: "杨博", colorKey: "d1" },
  1741: { name: "杨子鉴", colorKey: "d1" },
  1742: { name: "龚咏乔", colorKey: "g3" },
  1743: { name: "李文轩", colorKey: "g3" },
  1744: { name: "林国盛", colorKey: "g3" },
  1745: { name: "刘丰", colorKey: "g3" },
  1746: { name: "刘钾", colorKey: "g3" },
  1747: { name: "谭熙", colorKey: "g3" },
  1748: { name: "叶书辰", colorKey: "g3" },
  1749: { name: "万彦麟", colorKey: "g3" },
  1750: { name: "殷潇轩", colorKey: "g3" },
  1751: { name: "赵海鲲", colorKey: "g3" },
  1752: { name: "左天佑", colorKey: "g1" },
  1753: { name: "王翊临", colorKey: "g2" },
  1754: { name: "张书华", colorKey: "d1" },
  1755: { name: "吕若尘", colorKey: "d1" },
  1756: { name: "李凌岳", colorKey: "d1" },
  1757: { name: "王翼天", colorKey: "d1" },
  1758: { name: "封承成", colorKey: "g3" },
  1759: { name: "陈诺", colorKey: "d1" },
  1760: { name: "黄思远", colorKey: "d1" },
  1761: { name: "张恒毅", colorKey: "d1" },
  1762: { name: "章弥炫", colorKey: "d1" },
  1763: { name: "朱翔宇", colorKey: "d1" },
  1764: { name: "姜子米", colorKey: "g2" },
  1765: { name: "林诚凯", colorKey: "g2" },
  1766: { name: "孙梓航", colorKey: "g2" },
  1767: { name: "胡筝", colorKey: "g2" },
  1768: { name: "李凯霖", colorKey: "d1" },
  1769: { name: "孙培轩", colorKey: "d1" },
  1770: { name: "柳易辰", colorKey: "g3" },
  1771: { name: "宋弘毅", colorKey: "g3" },
  1772: { name: "叶焕宸", colorKey: "d1" },
  1773: { name: "易楚曦", colorKey: "d1" },
  1774: { name: "李悠然", colorKey: "g2" },
  1775: { name: "施轩杰", colorKey: "g2" },
  1776: { name: "全柏锋", colorKey: "g3" },
  1777: { name: "黄镜元", colorKey: "d1" },
  1778: { name: "殷子嘉", colorKey: "g3" },
  1779: { name: "李欣源", colorKey: "d1" },
  1780: { name: "赵云帆", colorKey: "g2" },
  1781: { name: "林致远", colorKey: "c2" },
  1782: { name: "林子睿", colorKey: "g3" },
  1783: { name: "陈朗宁", colorKey: "g2" },
  1784: { name: "燕子何", colorKey: "g2" },
  1785: { name: "朱菁轩", colorKey: "g2" },
  1786: { name: "邱明夷", colorKey: "c1" },
  1787: { name: "王梓", colorKey: "g1" },
  1788: { name: "郭铠瑞", colorKey: "g1" },
  1789: { name: "胡宸熏", colorKey: "c3" },
  1790: { name: "张博然", colorKey: "c2" },
  1791: { name: "伍芷萱", colorKey: "g2" },
  1792: { name: "郑焱天", colorKey: "g1" },
  1793: { name: "叶明子", colorKey: "g1" },
  1794: { name: "kham", colorKey: "c3" },
  1795: { name: "周懿轩", colorKey: "c3" },
  1796: { name: "刘安洋", colorKey: "g1" },
  1797: { name: "李锦源", colorKey: "c2" },
  1798: { name: "刘丁瑞杰", colorKey: "g1" },
  1799: { name: "张益瑞", colorKey: "c1" },
  1800: { name: "del_邹阳扬", colorKey: "uk" },
  1801: { name: "del_王秉轩", colorKey: "c2" },
  1802: { name: "周梓祺", colorKey: "c3" },
  1803: { name: "谭茗铭", colorKey: "c2" },
  1804: { name: "王诗娴", colorKey: "c2" },
  1805: { name: "温俊锋", colorKey: "c2" },
  1806: { name: "杨宸林子", colorKey: "c2" },
  1807: { name: "程钦荻", colorKey: "c2" },
  1808: { name: "杨景熙", colorKey: "c2" },
  1809: { name: "del_尹致帷", colorKey: "c3" },
  1810: { name: "刘川鲁", colorKey: "c3" },
  1811: { name: "del_谭珺桐", colorKey: "c1" },
  1812: { name: "黎红宇", colorKey: "g1" },
  1813: { name: "邓岚元", colorKey: "c1" },
  1814: { name: "del_文秋画", colorKey: "c3" },
  1815: { name: "谢卓成", colorKey: "c2" },
  1816: { name: "吴镕博", colorKey: "c2" },
  1817: { name: "田浩霖", colorKey: "c2" },
  1818: { name: "陈铭轩", colorKey: "c2" },
  1819: { name: "张玹予", colorKey: "c2" },
  1820: { name: "杨明洲", colorKey: "c2" },
  1821: { name: "张舜", colorKey: "c2" },
  1822: { name: "龙隐", colorKey: "c2" },
  1823: { name: "陈炯锟", colorKey: "uk" },
  1824: { name: "王子灏", colorKey: "c2" },
  1825: { name: "龙隐涛", colorKey: "c2" },
  1826: { name: "del_林涛", colorKey: "by" },
  1827: { name: "del_董博远", colorKey: "by" },
  1828: { name: "del_刘婉", colorKey: "by" },
  1829: { name: "高洁", colorKey: "by" },
  1830: { name: "张鑫宇", colorKey: "c2" },
  1831: { name: "张诗语", colorKey: "c2" },
  1832: { name: "戴一诺", colorKey: "c1" },
  1833: { name: "谭景元", colorKey: "g2" },
  1834: { name: "李映潮", colorKey: "c1" },
  1835: { name: "邓植文", colorKey: "c1" },
  1836: { name: "徐逸涵", colorKey: "by" },
  1837: { name: "邓培茜", colorKey: "c1" },
  1838: { name: "冯潇文", colorKey: "uk" },
  1839: { name: "葛梓涵", colorKey: "uk" },
  1840: { name: "卢彦希", colorKey: "c1" },
  1841: { name: "谭载铭", colorKey: "uk" },
  1842: { name: "陈炯锟", colorKey: "uk" },
  1843: { name: "于嘉睿", colorKey: "c2" },
  1844: { name: "吴其畅", colorKey: "c2" },
  1845: { name: "罗新然", colorKey: "c2" },
  1846: { name: "贾诺", colorKey: "c2" },
  1847: { name: "顾静浩", colorKey: "c2" },
  1848: { name: "骆泊成", colorKey: "c2" },
  1849: { name: "余宸浩", colorKey: "c3" },
  1850: { name: "周宥丞", colorKey: "c3" },
  1851: { name: "李悦廷", colorKey: "c3" },
  1852: { name: "杨安琪", colorKey: "uk" },
  1853: { name: "万开阳", colorKey: "uk" },
  1854: { name: "刘凌逍", colorKey: "c1" },
  1855: { name: "常宸铭", colorKey: "c1" },
  1856: { name: "张中乾", colorKey: "uk" },
  1857: { name: "李星沂", colorKey: "x6" },
  1858: { name: "王思陈", colorKey: "c1" },
  1859: { name: "郑立煊", colorKey: "c1" },
  1860: { name: "余辰浩", colorKey: "c2" },
  1861: { name: "夏悦翔", colorKey: "c2" },
  1862: { name: "张家睿", colorKey: "c2" },
  1863: { name: "李东哲", colorKey: "c2" },
  1864: { name: "杨程博", colorKey: "c2" },
  1865: { name: "邹宇霄", colorKey: "c2" },
  1866: { name: "仲峻泽", colorKey: "g1" },
  1867: { name: "何汶珀", colorKey: "g1" },
  1868: { name: "卿皓方", colorKey: "g1" },
  1869: { name: "吴佑祺", colorKey: "g1" },
  1870: { name: "李柯慰", colorKey: "g1" },
  1871: { name: "谢一宸", colorKey: "g1" },
  1872: { name: "陈屹瑶", colorKey: "g1" },
  1873: { name: "王志航", colorKey: "c3" },
  1874: { name: "苗域腾", colorKey: "c3" },
  1875: { name: "邓贺一", colorKey: "c3" },
  1876: { name: "陶成赟", colorKey: "c3" },
  1877: { name: "何浩榕", colorKey: "g2" },
  1878: { name: "傅炫淅", colorKey: "g2" },
  1879: { name: "冯子涵", colorKey: "g2" },
  1880: { name: "刘瑞然", colorKey: "g2" },
  1881: { name: "吕欣阳", colorKey: "g2" },
  1882: { name: "孙崇文", colorKey: "g2" },
  1883: { name: "宋翰翔", colorKey: "g2" },
  1884: { name: "岳志远", colorKey: "g2" },
  1885: { name: "张凯越", colorKey: "g2" },
  1886: { name: "张晖毓", colorKey: "g2" },
  1887: { name: "彭飞", colorKey: "g2" },
  1888: { name: "徐振洋", colorKey: "g2" },
  1889: { name: "晏紫哲", colorKey: "g2" },
  1890: { name: "曹艺航", colorKey: "g2" },
  1891: { name: "曾旷宇", colorKey: "g2" },
  1892: { name: "朱彦宁", colorKey: "g2" },
  1893: { name: "林思翰", colorKey: "g2" },
  1894: { name: "梅歆岚", colorKey: "g2" },
  1895: { name: "汤孟翰", colorKey: "g2" },
  1896: { name: "汪润桐", colorKey: "g2" },
  1897: { name: "沈嘉祺", colorKey: "g2" },
  1898: { name: "王冠杰", colorKey: "g2" },
  1899: { name: "王子扬", colorKey: "g2" },
  1900: { name: "秦遥昕", colorKey: "g2" },
  1901: { name: "蒋逸菲", colorKey: "g2" },
  1902: { name: "赖钇江", colorKey: "g2" },
  1903: { name: "赵熠辉", colorKey: "g2" },
  1904: { name: "黄爱鑫", colorKey: "g2" },
  1905: { name: "余子宸", colorKey: "g3" },
  1906: { name: "吴家旭", colorKey: "g2" },
  1907: { name: "吴诺轩", colorKey: "g3" },
  1908: { name: "夏瑞焓", colorKey: "g2" },
  1909: { name: "崔景皓", colorKey: "g2" },
  1910: { name: "彭云开", colorKey: "g2" },
  1911: { name: "申翼豪", colorKey: "g2" },
  1912: { name: "蒲恩伋", colorKey: "g3" },
  1913: { name: "邓心宇", colorKey: "g3" },
  1914: { name: "龙柄翰", colorKey: "g3" },
  1915: { name: "况奕辛", colorKey: "g1" },
  1916: { name: "宋子瑜", colorKey: "g1" },
  1917: { name: "宋正航", colorKey: "g1" },
  1918: { name: "张芮杨", colorKey: "g1" },
  1919: { name: "曹杨弋航", colorKey: "g2" },
  1920: { name: "朱航亿", colorKey: "g1" },
  1921: { name: "梁睿宸", colorKey: "g3" },
  1922: { name: "杨峥圻", colorKey: "g1" },
  1923: { name: "杨骑瑞", colorKey: "c3" },
  1924: { name: "林凯鑫", colorKey: "g1" },
  1925: { name: "李杭", colorKey: "g2" },
  1926: { name: "段凯迪", colorKey: "g2" },
  1927: { name: "沈钰宸", colorKey: "g2" },
  1928: { name: "洪子杰", colorKey: "g3" },
  1929: { name: "白益宁", colorKey: "g3" },
  1930: { name: "郑栋文", colorKey: "g1" },
  1931: { name: "buzichun", colorKey: "d3" },
  1932: { name: "侯宇彤", colorKey: "g2" },
  1933: { name: "李昊儒", colorKey: "g1" },
  1934: { name: "林天辰", colorKey: "g2" },
  1935: { name: "刘锦晨", colorKey: "by" },
  1936: { name: "唐潮", colorKey: "by" },
  1937: { name: "徐计辰", colorKey: "by" },
  1938: { name: "徐宥一", colorKey: "g2" },
  1939: { name: "杨持", colorKey: "c3" },
  1940: { name: "叶彦哲", colorKey: "g1" },
  1941: { name: "张嘉铖", colorKey: "g1" },
  1942: { name: "zhangyifan", colorKey: "g2" },
  1943: { name: "周裕博", colorKey: "d1" },
  1944: { name: "李天憬", colorKey: "g3" },
  1945: { name: "叶禹超", colorKey: "g3" },
  1946: { name: "吕佳锴", colorKey: "g3" },
  1947: { name: "周昊宇", colorKey: "g3" },
  1948: { name: "朱梓煊", colorKey: "g2" },
  1949: { name: "凌一璐", colorKey: "g3" },
  1950: { name: "王吴凡", colorKey: "g3" },
  1951: { name: "王子赫", colorKey: "g2" },
  1952: { name: "谢雨轩", colorKey: "g3" },
  1953: { name: "陆冠宇", colorKey: "g2" },
  1954: { name: "陈凌寒", colorKey: "g3" },
  1955: { name: "汤陈辉", colorKey: "g3" },
  1956: { name: "王舟扬", colorKey: "g3" },
  1957: { name: "武子宸", colorKey: "g3" },
  1958: { name: "杨博宇", colorKey: "g3" },
  1959: { name: "戚宏哲", colorKey: "g3" },
  1960: { name: "刘翀羽", colorKey: "g2" },
  1961: { name: "孔肖婷", colorKey: "g2" },
  1962: { name: "孙睿泽", colorKey: "g1" },
  1963: { name: "liaozihe", colorKey: "g3" },
  1964: { name: "张家瑜", colorKey: "g2" },
  1965: { name: "徐章涵", colorKey: "g2" },
  1966: { name: "朱晗俊", colorKey: "g2" },
  1967: { name: "林晋逸", colorKey: "g2" },
  1968: { name: "潘相州", colorKey: "g2" },
  1969: { name: "窦铭泽", colorKey: "g1" },
  1970: { name: "童振轩", colorKey: "g3" },
  1971: { name: "缪修楚", colorKey: "g2" },
  1972: { name: "xiaofangce", colorKey: "d3" },
  1973: { name: "薛淦", colorKey: "g2" },
  1974: { name: "黄仁和", colorKey: "g2" },
  1975: { name: "黄林宸", colorKey: "g2" },
  1976: { name: "杨子瀚", colorKey: "c2" },
  1977: { name: "倪宇梒", colorKey: "g3" },
  1978: { name: "张承淇", colorKey: "c1" },
  1979: { name: "姚景耀", colorKey: "g2" },
  1980: { name: "张东懿", colorKey: "g2" },
  1981: { name: "张宇轩", colorKey: "g3" },
  1982: { name: "张涵博", colorKey: "g3" },
  1983: { name: "郭子轩", colorKey: "g3" },
  1984: { name: "dygx_cjx", colorKey: "uk" },
  1985: { name: "黄柏铭", colorKey: "g1" },
  1986: { name: "王一帆", colorKey: "c1" },
  1987: { name: "谢腾毅", colorKey: "c2" },
  1988: { name: "蒋洋", colorKey: "c2" },
  1989: { name: "常裕宸", colorKey: "g3" },
  1990: { name: "zhangziqian", colorKey: "g3" },
  1991: { name: "cyez__lihaoru", colorKey: "uk" },
  1992: { name: "吴禹谦", colorKey: "c1" },
  1993: { name: "丁瑾辰", colorKey: "c2" },
  1994: { name: "刘腾骏", colorKey: "uk" },
  1995: { name: "陈忠亮", colorKey: "g1" },
  1996: { name: "栗稼浩", colorKey: "c3" },
  1997: { name: "魏俊康", colorKey: "by" },
  1998: { name: "唐睿思", colorKey: "c1" },
  1999: { name: "张小语", colorKey: "uk" },
  2000: { name: "杨安琪", colorKey: "c3" },
  2001: { name: "尹想雳", colorKey: "c2" },
  2002: { name: "李九源", colorKey: "c3" },
  2003: { name: "雷鈜森", colorKey: "g1" },
  2004: { name: "王梓涵2", colorKey: "c2" },
  2005: { name: "涂志诚", colorKey: "c3" },
  2006: { name: "朱晨希", colorKey: "c1" },
  2007: { name: "吴子越", colorKey: "c3" },
  2008: { name: "张一言", colorKey: "g3" },
  2009: { name: "王勋", colorKey: "g3" },
  2010: { name: "张恩齐", colorKey: "g1" },
  2011: { name: "xuhaoxuan", colorKey: "c3" },
  2012: { name: "dygx_yinzexuan_", colorKey: "uk" },
  2013: { name: "dygx_mpc_", colorKey: "uk" },
  2014: { name: "dygx_wangjiachao_", colorKey: "uk" },
  2015: { name: "dygx_hehongqian_", colorKey: "uk" },
  2016: { name: "dygx_zouhaonan_", colorKey: "uk" },
  2017: { name: "dygx_wangjiayue_", colorKey: "uk" },
  2018: { name: "黄显哲", colorKey: "c1" },
  2019: { name: "强轩铭", colorKey: "c1" },
  2020: { name: "郭籽辰", colorKey: "c1" },
  2021: { name: "刘缤年", colorKey: "c1" },
  2022: { name: "吴呢玥", colorKey: "uk" },
  2023: { name: "佘浚豪", colorKey: "uk" },
  2024: { name: "吴文曦", colorKey: "c3" },
  2025: { name: "24年乐山001", colorKey: "c1" },
  2026: { name: "24年乐山002", colorKey: "c1" },
  2027: { name: "24年乐山003", colorKey: "c1" },
  2028: { name: "24年乐山004", colorKey: "c1" },
  2029: { name: "24年乐山005", colorKey: "c1" },
  2030: { name: "24年乐山006", colorKey: "c1" },
  2031: { name: "24年乐山007", colorKey: "c1" },
  2032: { name: "24年乐山008", colorKey: "c1" },
  2033: { name: "24年乐山009", colorKey: "c1" },
  2034: { name: "24年乐山010", colorKey: "c1" },
  2035: { name: "24年乐山011", colorKey: "c1" },
  2036: { name: "24年乐山012", colorKey: "c1" },
  2037: { name: "24年乐山013", colorKey: "c1" },
  2038: { name: "24年乐山014", colorKey: "c1" },
  2039: { name: "24年乐山015", colorKey: "c1" },
  2040: { name: "24年乐山016", colorKey: "c1" },
  2041: { name: "24年乐山017", colorKey: "c1" },
  2042: { name: "24年乐山018", colorKey: "c1" },
  2043: { name: "24年乐山019", colorKey: "c1" },
  2044: { name: "24年乐山020", colorKey: "c1" },
  2045: { name: "24年乐山021", colorKey: "c1" },
  2046: { name: "24年乐山022", colorKey: "c1" },
  2047: { name: "24年乐山023", colorKey: "c1" },
  2048: { name: "24年乐山024", colorKey: "c1" },
  2049: { name: "24年乐山025", colorKey: "c1" },
  2050: { name: "24年乐山026", colorKey: "c1" },
  2051: { name: "24年乐山027", colorKey: "c1" },
  2052: { name: "24年乐山028", colorKey: "c1" },
  2053: { name: "24年乐山029", colorKey: "c1" },
  2054: { name: "24年乐山030", colorKey: "c1" },
  2055: { name: "24年乐山031", colorKey: "c1" },
  2056: { name: "24年乐山032", colorKey: "c1" },
  2057: { name: "24年乐山033", colorKey: "c1" },
  2058: { name: "24年乐山034", colorKey: "c1" },
  2059: { name: "24年乐山035", colorKey: "c1" },
  2060: { name: "24年乐山036", colorKey: "c1" },
  2061: { name: "24年乐山037", colorKey: "c1" },
  2062: { name: "24年乐山038", colorKey: "c1" },
  2063: { name: "24年乐山039", colorKey: "c1" },
  2064: { name: "24年乐山040", colorKey: "c1" },
  2065: { name: "24年乐山041", colorKey: "c1" },
  2066: { name: "24年乐山042", colorKey: "c1" },
  2067: { name: "24年乐山043", colorKey: "c1" },
  2068: { name: "24年乐山044", colorKey: "c1" },
  2069: { name: "24年乐山045", colorKey: "c1" },
  2070: { name: "24年乐山046", colorKey: "c1" },
  2071: { name: "24年乐山047", colorKey: "c1" },
  2072: { name: "24年乐山048", colorKey: "c1" },
  2073: { name: "24年乐山049", colorKey: "c1" },
  2074: { name: "24年乐山050", colorKey: "c1" },
  2075: { name: "24年乐山051", colorKey: "c1" },
  2076: { name: "24年乐山052", colorKey: "c1" },
  2077: { name: "24年乐山053", colorKey: "c1" },
  2078: { name: "24年乐山054", colorKey: "c1" },
  2079: { name: "24年乐山055", colorKey: "c1" },
  2080: { name: "24年乐山056", colorKey: "c1" },
  2081: { name: "24年乐山057", colorKey: "c1" },
  2082: { name: "24年乐山058", colorKey: "c1" },
  2083: { name: "24年乐山059", colorKey: "c1" },
  2084: { name: "24年乐山060", colorKey: "c1" },
  2085: { name: "24年乐山061", colorKey: "c1" },
  2086: { name: "24年乐山062", colorKey: "c1" },
  2087: { name: "24年乐山063", colorKey: "c1" },
  2088: { name: "24年乐山064", colorKey: "c1" },
  2089: { name: "24年乐山065", colorKey: "c1" },
  2090: { name: "24年乐山066", colorKey: "c1" },
  2091: { name: "24年乐山067", colorKey: "c1" },
  2092: { name: "24年乐山068", colorKey: "c1" },
  2093: { name: "24年乐山069", colorKey: "c1" },
  2094: { name: "24年乐山070", colorKey: "c1" },
  2095: { name: "24年乐山071", colorKey: "c1" },
  2096: { name: "24年乐山072", colorKey: "c1" },
  2097: { name: "24年乐山073", colorKey: "c1" },
  2098: { name: "24年乐山074", colorKey: "c1" },
  2099: { name: "24年乐山075", colorKey: "c1" },
  2100: { name: "24年乐山076", colorKey: "c1" },
  2101: { name: "24年乐山077", colorKey: "c1" },
  2102: { name: "24年乐山078", colorKey: "c1" },
  2103: { name: "24年乐山079", colorKey: "c1" },
  2104: { name: "24年乐山080", colorKey: "c1" },
  2105: { name: "24年乐山081", colorKey: "c1" },
  2106: { name: "24年乐山082", colorKey: "c1" },
  2107: { name: "24年乐山083", colorKey: "c1" },
  2108: { name: "24年乐山084", colorKey: "c1" },
  2109: { name: "24年乐山085", colorKey: "c1" },
  2110: { name: "24年乐山086", colorKey: "c1" },
  2111: { name: "24年乐山087", colorKey: "c1" },
  2112: { name: "24年乐山088", colorKey: "c1" },
  2113: { name: "24年乐山089", colorKey: "c1" },
  2114: { name: "24年乐山090", colorKey: "c1" },
  2115: { name: "24年乐山091", colorKey: "c1" },
  2116: { name: "24年乐山092", colorKey: "c1" },
  2117: { name: "24年乐山093", colorKey: "c1" },
  2118: { name: "24年乐山094", colorKey: "c1" },
  2119: { name: "24年乐山095", colorKey: "c1" },
  2120: { name: "张晗弈", colorKey: "c1" },
  2121: { name: "钟佳润", colorKey: "x6" },
  2122: { name: "陈世海", colorKey: "c3" },
  2123: { name: "但思喆", colorKey: "c1" },
  2124: { name: "24年乐山100", colorKey: "c1" },
  2125: { name: "冯昱皓", colorKey: "c1" },
  2126: { name: "邓诣恬", colorKey: "c1" },
  2127: { name: "王皓轩", colorKey: "c1" },
  2128: { name: "刘尚宸", colorKey: "c1" },
  2129: { name: "张奕晨", colorKey: "c1" },
  2130: { name: "李凌舟", colorKey: "c1" },
  2131: { name: "方思为", colorKey: "c1" },
  2132: { name: "杨箪语", colorKey: "c1" },
  2133: { name: "戴柏霖", colorKey: "c1" },
  2134: { name: "胡竞洋", colorKey: "c1" },
  2135: { name: "王德汭", colorKey: "c1" },
  2136: { name: "陈俊皓", colorKey: "c1" },
  2137: { name: "杨卓晗", colorKey: "c1" },
  2138: { name: "陆逸倩", colorKey: "c1" },
  2139: { name: "郑好", colorKey: "c1" },
  2140: { name: "唐润东", colorKey: "c1" },
  2141: { name: "罗辰晔", colorKey: "c1" },
  2142: { name: "张皓跃", colorKey: "c1" },
  2143: { name: "易子浩", colorKey: "c1" },
  2144: { name: "吴呢玥", colorKey: "c1" },
  2145: { name: "鲍冠臣", colorKey: "c3" },
  2146: { name: "钟皓宸", colorKey: "c1" },
  2147: { name: "强昊森", colorKey: "c1" },
  2148: { name: "张泽坤", colorKey: "c1" },
  2149: { name: "鲜子周", colorKey: "c2" },
  2150: { name: "刘璟衫", colorKey: "c1" },
  2151: { name: "陈唐致君", colorKey: "uk" },
  2152: { name: "李景辰", colorKey: "c2" },
  2153: { name: "何洺燃", colorKey: "g1" },
  2154: { name: "del-何牧阳", colorKey: "c2" },
  2155: { name: "del-袁楚为", colorKey: "c2" },
  2156: { name: "del-陈红火", colorKey: "c2" },
  2157: { name: "陈子祺", colorKey: "c2" },
  2158: { name: "李修瀚", colorKey: "c1" },
  2159: { name: "程楷倢", colorKey: "by" },
  2160: { name: "李子木", colorKey: "c1" },
  2161: { name: "吕沛霖", colorKey: "c2" },
  2162: { name: "陈一豪", colorKey: "c2" },
  2163: { name: "陈红火", colorKey: "c2" },
  2164: { name: "袁楚为", colorKey: "c2" },
  2165: { name: "杨雨彤", colorKey: "c2" },
  2166: { name: "何牧阳", colorKey: "c2" },
  2167: { name: "皮杨", colorKey: "by" },
  2168: { name: "胡琰皓", colorKey: "c1" },
  2169: { name: "陈艳梅", colorKey: "by" },
  2170: { name: "王多灵", colorKey: "jl" },
  2171: { name: "彭渝涵", colorKey: "g1" },
  2172: { name: "李泓烨", colorKey: "g1" },
  2173: { name: "张蜀珺", colorKey: "g1" },
  2174: { name: "王彦杰", colorKey: "g1" },
  2175: { name: "李雪梅", colorKey: "jl" },
  2176: { name: "刘子墨", colorKey: "g1" },
  2177: { name: "张尽欢", colorKey: "g1" },
  2178: { name: "陈一铭", colorKey: "by" },
  2179: { name: "唐东来", colorKey: "c1" },
  2180: { name: "杨韵栩", colorKey: "c1" },
  2181: { name: "郑茗腾", colorKey: "c2" },
  2182: { name: "蔡明宸", colorKey: "x6" },
  2183: { name: "管文豪", colorKey: "c1" },
  2184: { name: "张逸宸", colorKey: "c1" },
  2185: { name: "张子睿", colorKey: "x6" },
  2186: { name: "王浩丞", colorKey: "x6" },
  2187: { name: "佘浚豪", colorKey: "x6" },
  2188: { name: "李晨文", colorKey: "x6" },
  2189: { name: "王振衣", colorKey: "x6" },
  2190: { name: "陈炯锟", colorKey: "x6" },
  2191: { name: "张照理", colorKey: "x6" },
  2192: { name: "兰熙荣", colorKey: "x6" },
  2193: { name: "郑楚扬", colorKey: "c1" },
  2194: { name: "何乐", colorKey: "x6" },
  2195: { name: "石菲雨", colorKey: "x6" },
  2196: { name: "雷迪文", colorKey: "c1" },
  2197: { name: "陈唐致君", colorKey: "x6" },
  2198: { name: "张小语", colorKey: "x4" },
  2199: { name: "赵子一", colorKey: "x6" },
  2200: { name: "刘奕辰", colorKey: "x6" },
  2201: { name: "汪楷宸", colorKey: "x6" },
  2202: { name: "唐一诺", colorKey: "x4" },
  2203: { name: "韩贝怡", colorKey: "x6" },
  2204: { name: "蒋予希", colorKey: "x6" },
  2205: { name: "梁煜晨", colorKey: "x6" },
  2206: { name: "刘昭远", colorKey: "x6" },
  2207: { name: "刘梓皓", colorKey: "x6" },
  2208: { name: "彭亦凡", colorKey: "x6" },
  2209: { name: "任宇晨", colorKey: "x6" },
  2210: { name: "刘腾骏", colorKey: "x6" },
  2211: { name: "陈笑涵", colorKey: "c1" },
  2212: { name: "刁一一", colorKey: "x6" },
  2213: { name: "陈旻柯", colorKey: "x6" },
  2214: { name: "栾稚睿", colorKey: "x6" },
  2215: { name: "郭一琛", colorKey: "x6" },
  2216: { name: "姚宸羽", colorKey: "x6" },
  2217: { name: "李芊妤", colorKey: "x6" },
  2218: { name: "贺礼博", colorKey: "x6" },
  2219: { name: "路海川", colorKey: "x5" },
  2220: { name: "彭弈之", colorKey: "x6" },
  2221: { name: "赵文鼎", colorKey: "x5" },
  2222: { name: "吴志涵", colorKey: "x6" },
  2223: { name: "王皓霖", colorKey: "x6" },
  2224: { name: "王语桐", colorKey: "x6" },
  2225: { name: "王子骏", colorKey: "x6" },
  2226: { name: "刘思远", colorKey: "x6" },
  2227: { name: "刘历桐", colorKey: "x6" },
  2228: { name: "米云铎", colorKey: "x6" },
  2229: { name: "贾致远", colorKey: "x6" },
  2230: { name: "冯绍峰", colorKey: "x6" },
  2231: { name: "黄馨頨-old", colorKey: "uk" },
  2232: { name: "罗奕诚", colorKey: "x6" },
  2233: { name: "成中天", colorKey: "x6" },
  2234: { name: "谭载铭", colorKey: "x6" },
  2235: { name: "万开阳", colorKey: "x6" },
  2236: { name: "葛梓涵", colorKey: "x6" },
  2237: { name: "赵屿筝", colorKey: "x6" },
  2238: { name: "龚科宇", colorKey: "x6" },
  2239: { name: "李昊睿", colorKey: "x6" },
  2240: { name: "李泓铖", colorKey: "x6" },
  2241: { name: "杨拾秋", colorKey: "c1" },
  2242: { name: "王晨鑫", colorKey: "c1" },
  2243: { name: "韩辰宇", colorKey: "c1" },
  2244: { name: "田墌尧", colorKey: "c1" },
  2245: { name: "曹熙之", colorKey: "x5" },
  2246: { name: "肖尧腾", colorKey: "c1" },
  2247: { name: "张浩玺", colorKey: "c1" },
  2248: { name: "张钦赫", colorKey: "c2" },
  2249: { name: "罗皓扬", colorKey: "x6" },
  2250: { name: "杨梦", colorKey: "by" },
  2251: { name: "梁凯", colorKey: "by" },
  2252: { name: "韦莉娜", colorKey: "by" },
  2253: { name: "欧阳宇轩", colorKey: "c2" },
  2254: { name: "张淑华", colorKey: "c2" },
  2255: { name: "cyl", colorKey: "c3" },
  2256: { name: "xuchengjun", colorKey: "d3" },
  2257: { name: "xiaofangce", colorKey: "d3" },
  2258: { name: "lijunjie", colorKey: "d3" },
  2259: { name: "zhangjiayu", colorKey: "g2" },
  2260: { name: "asn", colorKey: "d3" },
  2261: { name: "zhougangxiao", colorKey: "c2" },
  2262: { name: "cqyz_zry", colorKey: "uk" },
  2263: { name: "kz", colorKey: "c3" },
  2264: { name: "wzhs_huangrenhe", colorKey: "uk" },
  2265: { name: "wangmeixin", colorKey: "d3" },
  2266: { name: "zhangshuai", colorKey: "g1" },
  2267: { name: "wyz", colorKey: "c3" },
  2268: { name: "tanyuxin", colorKey: "d3" },
  2269: { name: "孙瑞泽", colorKey: "g2" },
  2270: { name: "songfangyin", colorKey: "d3" },
  2271: { name: "panxiangzhou", colorKey: "g2" },
  2272: { name: "lyf", colorKey: "c3" },
  2273: { name: "zhouweixiang", colorKey: "d3" },
  2274: { name: "pengzhejun", colorKey: "c2" },
  2275: { name: "lcdd", colorKey: "d3" },
  2276: { name: "hezihao", colorKey: "d3" },
  2277: { name: "maozicheng", colorKey: "c1" },
  2278: { name: "zhouyusen", colorKey: "c2" },
  2279: { name: "huangkailing", colorKey: "d3" },
  2280: { name: "houxingyu", colorKey: "d3" },
  2281: { name: "longyucheng", colorKey: "c2" },
  2282: { name: "lvboyuan", colorKey: "c2" },
  2283: { name: "liangzhenxuan", colorKey: "d3" },
  2284: { name: "lindan", colorKey: "d3" },
  2285: { name: "xuzhanghan", colorKey: "g2" },
  2286: { name: "zdw", colorKey: "g1" },
  2287: { name: "szy", colorKey: "g1" },
  2288: { name: "朱修齐", colorKey: "g1" },
  2289: { name: "linjinyi", colorKey: "g2" },
  2290: { name: "huanglinchen", colorKey: "uk" },
  2291: { name: "hongjiajun", colorKey: "c3" },
  2292: { name: "zhy", colorKey: "g1" },
  2293: { name: "x_wengpeifeng", colorKey: "c3" },
  2294: { name: "卓成杰", colorKey: "g1" },
  2295: { name: "cqyz_yqr", colorKey: "uk" },
  2296: { name: "linkai", colorKey: "d3" },
  2297: { name: "xhy", colorKey: "d3" },
  2298: { name: "yanzixuan", colorKey: "d3" },
  2299: { name: "zyc", colorKey: "c3" },
  2300: { name: "杨卓霖", colorKey: "c1" },
  2301: { name: "吴卓衡", colorKey: "c1" },
  2302: { name: "张宸弋", colorKey: "c1" },
  2303: { name: "周靖朗", colorKey: "c1" },
  2304: { name: "罗浚宸", colorKey: "c3" },
  2305: { name: "何政霄", colorKey: "c3" },
  2306: { name: "黎相廷", colorKey: "c3" },
  2307: { name: "敖梓轩", colorKey: "c1" },
  2308: { name: "王泽睿", colorKey: "x4" },
  2309: { name: "张中乾", colorKey: "c1" },
  2310: { name: "徐晨骁", colorKey: "by" },
  2311: { name: "刘慧胤", colorKey: "by" },
  2312: { name: "朱丹蕾", colorKey: "by" },
  2313: { name: "廖赵吕", colorKey: "by" },
  2314: { name: "雷欣", colorKey: "by" },
  2315: { name: "晁敬知", colorKey: "c1" },
  2316: { name: "付垚叡", colorKey: "c1" },
  2317: { name: "张珈源", colorKey: "g3" },
  2318: { name: "肖浩宇", colorKey: "g2" },
  2319: { name: "陈浩哲", colorKey: "c1" },
  2320: { name: "李秉樾", colorKey: "c3" },
  2321: { name: "黄子宸", colorKey: "x6" },
  2322: { name: "王彬翰", colorKey: "x6" },
  2323: { name: "刘若涵", colorKey: "c1" },
  2324: { name: "卓凯琳", colorKey: "x6" },
  2325: { name: "刘佳欣", colorKey: "x6" },
  2326: { name: "黄柱寰", colorKey: "c1" },
  2327: { name: "熊浩成", colorKey: "c1" },
  2328: { name: "刘子谦", colorKey: "c2" },
  2329: { name: "马浚杰", colorKey: "c3" },
  2330: { name: "黄秉南", colorKey: "c3" },
  2331: { name: "邓宗浩", colorKey: "c3" },
  2332: { name: "caiweibo", colorKey: "d3" },
  2333: { name: "朱君浩", colorKey: "g1" },
  2334: { name: "刘峻铭", colorKey: "c1" },
  2335: { name: "龙俊希", colorKey: "c1" },
  2336: { name: "冷思辰", colorKey: "g1" },
  2337: { name: "张健佳", colorKey: "g3" },
  2338: { name: "谢来恩", colorKey: "x6" },
  2339: { name: "胥国豪", colorKey: "g1" },
  2340: { name: "周一可", colorKey: "x6" },
  2341: { name: "赵钰轩", colorKey: "x6" },
  2342: { name: "申鸿程", colorKey: "g2" },
  2343: { name: "蒙柏宇", colorKey: "x6" },
  2344: { name: "雷振宇", colorKey: "x6" },
  2345: { name: "张博艺", colorKey: "x6" },
  2346: { name: "文兴忞", colorKey: "x6" },
  2347: { name: "马徐元", colorKey: "x6" },
  2348: { name: "邵令芃", colorKey: "x6" },
  2349: { name: "陆博观", colorKey: "x6" },
  2350: { name: "毛晨阳", colorKey: "x6" },
  2351: { name: "任思澄", colorKey: "x6" },
  2352: { name: "任书成", colorKey: "x6" },
  2353: { name: "余宝桢", colorKey: "x6" },
  2354: { name: "袁梓瑞", colorKey: "x6" },
  2355: { name: "邓皓轩", colorKey: "c3" },
  2356: { name: "付彦哲", colorKey: "x5" },
  2357: { name: "张梓骁", colorKey: "c3" },
  2358: { name: "马骁", colorKey: "x5" },
  2359: { name: "高子琪", colorKey: "x5" },
  2360: { name: "罗梓轩", colorKey: "x5" },
  2361: { name: "张子轩", colorKey: "x5" },
  2362: { name: "殷浩诚", colorKey: "x5" },
  2363: { name: "殷浩然", colorKey: "x5" },
  2364: { name: "何云汎", colorKey: "x5" },
  2365: { name: "周蛇飞", colorKey: "x5" },
  2366: { name: "徐一丁", colorKey: "x5" },
  2367: { name: "龚鑫宇", colorKey: "x6" },
  2368: { name: "林欣宜", colorKey: "c1" },
  2369: { name: "魏圣懿", colorKey: "x5" },
  2370: { name: "蒋其恒", colorKey: "x5" },
  2371: { name: "胡佳文", colorKey: "x5" },
  2372: { name: "王南棠", colorKey: "c1" },
  2373: { name: "黄瑞浩", colorKey: "c1" },
  2374: { name: "卢钇宁", colorKey: "c1" },
  2375: { name: "佘佳霖", colorKey: "g2" },
  2376: { name: "蔡峻安", colorKey: "c3" },
  2377: { name: "章启钰", colorKey: "uk" },
  2378: { name: "雷鈜森", colorKey: "uk" },
  2379: { name: "王子南", colorKey: "c3" },
  2380: { name: "鄢瑞羲", colorKey: "c1" },
  2381: { name: "徐煜恒", colorKey: "uk" },
  2382: { name: "沙源清", colorKey: "x6" },
  2383: { name: "何云yun", colorKey: "c1" },
  2384: { name: "程锦熙", colorKey: "x6" },
  2385: { name: "李铭瀚", colorKey: "c2" },
  2386: { name: "林悦", colorKey: "c2" },
  2387: { name: "刘锦潮", colorKey: "c2" },
  2388: { name: "刘锦蒙", colorKey: "c2" },
  2389: { name: "刘彦彤", colorKey: "c2" },
  2390: { name: "牟林锋", colorKey: "c2" },
  2391: { name: "汤马宽xin", colorKey: "c2" },
  2392: { name: "杨孝晨", colorKey: "c1" },
  2393: { name: "喻浩轩", colorKey: "c2" },
  2394: { name: "王紫淇", colorKey: "c2" },
  2395: { name: "章启钰", colorKey: "x6" },
  2396: { name: "彭有有", colorKey: "c1" },
  2397: { name: "徐煜恒", colorKey: "c2" },
  2398: { name: "鄢瑞xi", colorKey: "c1" },
  2399: { name: "周峻西", colorKey: "c1" },
  2400: { name: "徐守中1", colorKey: "c2" },
  2401: { name: "陈奕辰", colorKey: "c3" },
  2402: { name: "王语哲", colorKey: "x6" },
  2403: { name: "李俊贤", colorKey: "g2" },
  2404: { name: "白梓铎", colorKey: "c2" },
  2405: { name: "张博恩", colorKey: "c3" },
  2406: { name: "林先洋", colorKey: "c2" },
  2407: { name: "王梓涵", colorKey: "c2" },
  2408: { name: "李一杭", colorKey: "c2" },
  2409: { name: "王白逸飞", colorKey: "x5" },
  2410: { name: "刘子默", colorKey: "c1" },
  2411: { name: "汤马宽芯", colorKey: "c1" },
  2412: { name: "谢东峻", colorKey: "c1" },
  2413: { name: "张棕钲", colorKey: "c1" },
  2414: { name: "李子睿", colorKey: "x6" },
  2415: { name: "刘琪娅", colorKey: "x6" },
  2416: { name: "王奕程", colorKey: "c2" },
  2417: { name: "任俊帆", colorKey: "g1" },
  2418: { name: "王彦杰", colorKey: "uk" },
  2419: { name: "詹智程", colorKey: "g1" },
  2420: { name: "蔡子彧", colorKey: "c1" },
  2421: { name: "赖俊谚", colorKey: "c1" },
  2422: { name: "罗晨洋", colorKey: "c1" },
  2423: { name: "史浩言", colorKey: "c1" },
  2424: { name: "张晗奕", colorKey: "c1" },
  2425: { name: "熊佑齐", colorKey: "c1" },
  2426: { name: "李品均", colorKey: "x5" },
  2427: { name: "杨书", colorKey: "x5" },
  2428: { name: "段程源", colorKey: "x6" },
  2429: { name: "蒋洋", colorKey: "uk" },
  2430: { name: "李卓庭", colorKey: "c1" },
  2431: { name: "董黎昕", colorKey: "x5" },
  2432: { name: "刘泽慧", colorKey: "c3" },
  2433: { name: "牟亚", colorKey: "c3" },
  2434: { name: "李敏慎-old", colorKey: "uk" },
  2435: { name: "季懿煊", colorKey: "c3" },
  2436: { name: "李奕瑶", colorKey: "g1" },
  2437: { name: "梁跃宝", colorKey: "c1" },
  2438: { name: "黄泊尘", colorKey: "c1" },
  2439: { name: "王彦喆", colorKey: "c1" },
  2440: { name: "范云天", colorKey: "c1" },
  2441: { name: "罗丁奕", colorKey: "c1" },
  2442: { name: "周思宇", colorKey: "c1" },
  2443: { name: "谢松辰", colorKey: "c1" },
  2444: { name: "余卓宸", colorKey: "x5" },
  2445: { name: "张开敏", colorKey: "x5" },
  2446: { name: "叶思池", colorKey: "x5" },
  2447: { name: "李宇茂", colorKey: "x5" },
  2448: { name: "袁骁芃", colorKey: "x5" },
  2449: { name: "万昱睿", colorKey: "x5" },
  2450: { name: "何语航", colorKey: "x5" },
  2451: { name: "涂墨琰", colorKey: "x5" },
  2452: { name: "刘胤泽", colorKey: "x5" },
  2453: { name: "何雨泽", colorKey: "x5" },
  2454: { name: "邱宇彤", colorKey: "x5" },
  2455: { name: "胡修瑜", colorKey: "x5" },
  2456: { name: "曾芃宸", colorKey: "x5" },
  2457: { name: "黄馨頨", colorKey: "x6" },
  2458: { name: "李敏慎", colorKey: "x6" },
  2459: { name: "肖懿洋", colorKey: "x6" },
  2460: { name: "邱晨轩", colorKey: "x6" },
  2461: { name: "王欣屹", colorKey: "x6" },
  2462: { name: "何山", colorKey: "x6" },
  2463: { name: "刘芯汝", colorKey: "x6" },
  2464: { name: "钟鸿蔚", colorKey: "x6" },
  2465: { name: "蒋耀宇", colorKey: "x6" },
  2466: { name: "马稚然", colorKey: "x6" },
  2467: { name: "苟家齐", colorKey: "x6" },
  2468: { name: "王子燊", colorKey: "x6" },
  2469: { name: "刘奕辰1", colorKey: "x6" },
  2470: { name: "王诗杰", colorKey: "x6" },
  2471: { name: "王亦周", colorKey: "x6" },
  2472: { name: "夏米可", colorKey: "x6" },
  2473: { name: "余涓宁", colorKey: "x6" },
  2474: { name: "胡骋翔", colorKey: "x6" },
  2475: { name: "曾佳汀", colorKey: "x6" },
  2476: { name: "吕昍宸", colorKey: "x6" },
  2477: { name: "陈奕帆", colorKey: "x6" },
  2478: { name: "杨名之", colorKey: "x6" },
  2479: { name: "黄浩宸", colorKey: "x6" },
  2480: { name: "贺景晨", colorKey: "x6" },
  2481: { name: "李锦宸", colorKey: "x6" },
  2482: { name: "陈奕铭", colorKey: "x6" },
  2483: { name: "刘孝言", colorKey: "x6" },
  2484: { name: "王谢祎", colorKey: "x6" },
  2485: { name: "姜策", colorKey: "x6" },
  2486: { name: "方子沐", colorKey: "x6" },
  2487: { name: "刘善维", colorKey: "x6" },
  2488: { name: "陈传卓", colorKey: "x6" },
  2489: { name: "刘昕稦", colorKey: "x6" },
  2490: { name: "蔡一平", colorKey: "x6" },
  2491: { name: "孟东宸", colorKey: "x6" },
  2492: { name: "郭祖铭", colorKey: "x6" },
  2493: { name: "龙珂晗", colorKey: "x6" },
  2494: { name: "陈渲予", colorKey: "x6" },
  2495: { name: "罗逸桐", colorKey: "x6" },
  2496: { name: "刘晋瑞", colorKey: "x6" },
  2497: { name: "庞伍逸", colorKey: "x6" },
  2498: { name: "王漠涵", colorKey: "d3" },
  2499: { name: "杨锦驿", colorKey: "g1" },
  2500: { name: "周宇", colorKey: "c3" },
  2501: { name: "康哲", colorKey: "c3" },
  2502: { name: "陈翔宇", colorKey: "g1" },
  2503: { name: "张家锐", colorKey: "c3" },
  2504: { name: "李泽宇", colorKey: "g2" },
  2505: { name: "翟煜峰", colorKey: "g2" },
  2506: { name: "朱子墨", colorKey: "g2" },
  2507: { name: "毛振嘉", colorKey: "c3" },
  2508: { name: "曾率淇", colorKey: "c3" },
  2509: { name: "姚书恩", colorKey: "g1" },
  2510: { name: "吉星灿", colorKey: "g2" },
  2511: { name: "陈昱硕", colorKey: "c3" },
  2512: { name: "刘子轩", colorKey: "g1" },
  2513: { name: "吴俊陈", colorKey: "g1" },
  2514: { name: "袁皓然", colorKey: "g2" },
  2515: { name: "华宇轩", colorKey: "d3" },
  2516: { name: "李博涵", colorKey: "g1" },
  2517: { name: "周奇好", colorKey: "g1" },
  2518: { name: "徐至", colorKey: "g1" },
  2519: { name: "杨羽轩", colorKey: "d3" },
  2520: { name: "王乾辰", colorKey: "c2" },
  2521: { name: "程嘉同", colorKey: "g1" },
  2522: { name: "胡启正", colorKey: "g2" },
  2523: { name: "包丞泽", colorKey: "g1" },
  2524: { name: "杨德祚", colorKey: "g1" },
  2525: { name: "卓灵婧", colorKey: "by" },
  2526: { name: "陈奕佑", colorKey: "g1" },
  2527: { name: "wangweihze", colorKey: "d3" },
  2528: { name: "祝承煜", colorKey: "c2" },
  2529: { name: "王沛涵", colorKey: "g1" },
  2530: { name: "李熙澳", colorKey: "c3" },
  2531: { name: "孙振洋", colorKey: "g1" },
  2532: { name: "黄晨喧", colorKey: "g1" },
  2533: { name: "杜成竹", colorKey: "g2" },
  2534: { name: "王竞扬", colorKey: "d3" },
  2535: { name: "徐烁", colorKey: "d3" },
  2536: { name: "李雨泽", colorKey: "g2" },
  2537: { name: "牛思远", colorKey: "g1" },
  2538: { name: "李苑爱", colorKey: "c2" },
  2539: { name: "梁天泽", colorKey: "c2" },
  2540: { name: "柳景珣", colorKey: "c2" },
  2541: { name: "缪宗棠", colorKey: "c2" },
  2542: { name: "彭科霖", colorKey: "c2" },
  2543: { name: "卿晨", colorKey: "c2" },
  2544: { name: "田羽明", colorKey: "c2" },
  2545: { name: "王一诺", colorKey: "c2" },
  2546: { name: "谢政晓", colorKey: "c2" },
  2547: { name: "杨祁雯", colorKey: "c2" },
  2548: { name: "余鸿程", colorKey: "c2" },
  2549: { name: "袁芮昕", colorKey: "c2" },
  2550: { name: "张承瀚", colorKey: "c2" },
  2551: { name: "张珑译", colorKey: "c2" },
  2552: { name: "张翁铭", colorKey: "c2" },
  2553: { name: "张伊橙", colorKey: "c2" },
  2554: { name: "赵奇灵", colorKey: "c2" },
  2555: { name: "周晓妍", colorKey: "c2" },
  2556: { name: "周星羽", colorKey: "c2" },
  2557: { name: "周子歆", colorKey: "c2" },
  2558: { name: "陈枳贝", colorKey: "g2" },
  2559: { name: "邓江睿洋", colorKey: "g2" },
  2560: { name: "冯婷", colorKey: "g2" },
  2561: { name: "何明轩", colorKey: "g2" },
  2562: { name: "何欣瑞", colorKey: "g2" },
  2563: { name: "胡梓迅", colorKey: "g2" },
  2564: { name: "李保宁", colorKey: "g2" },
  2565: { name: "李浩铭", colorKey: "g2" },
  2566: { name: "李林哲", colorKey: "g2" },
  2567: { name: "李亚宸", colorKey: "g2" },
  2568: { name: "刘芷麟", colorKey: "g2" },
  2569: { name: "龙义芝", colorKey: "g2" },
  2570: { name: "毛译兴", colorKey: "g2" },
  2571: { name: "潘牧原", colorKey: "g2" },
  2572: { name: "秦艺玮", colorKey: "g2" },
  2573: { name: "唐子恩", colorKey: "g2" },
  2574: { name: "王祎凡", colorKey: "g2" },
  2575: { name: "徐麟", colorKey: "g2" },
  2576: { name: "薛佳豪", colorKey: "g2" },
  2577: { name: "袁浩宸", colorKey: "g2" },
  2578: { name: "张钰杰", colorKey: "g2" },
  2579: { name: "赵浩羽", colorKey: "g2" },
  2580: { name: "赵希然", colorKey: "g2" },
  2581: { name: "周思臣", colorKey: "g2" },
  2582: { name: "邹浩林", colorKey: "g2" },
  2583: { name: "陈嘉懿", colorKey: "g1" },
  2584: { name: "鞠明辰", colorKey: "g1" },
  2585: { name: "李嘉言", colorKey: "g1" },
  2586: { name: "马亦中", colorKey: "g1" },
  2587: { name: "唐弋洲", colorKey: "g1" },
  2588: { name: "王长凯", colorKey: "g1" },
  2589: { name: "姚懿轩", colorKey: "g1" },
  2590: { name: "叶家瑞", colorKey: "g1" },
  2591: { name: "张翼飞", colorKey: "g1" },
  2592: { name: "张钰泽", colorKey: "g1" },
  2593: { name: "朱稀阳", colorKey: "g1" },
  2594: { name: "谷国瑞", colorKey: "c3" },
  2595: { name: "胡昕宸", colorKey: "c3" },
  2596: { name: "刘芳贝", colorKey: "c3" },
  2597: { name: "沈泓廷", colorKey: "c3" },
  2598: { name: "宋知行", colorKey: "c3" },
  2599: { name: "王槊", colorKey: "c3" },
  2600: { name: "尹熙源", colorKey: "c3" },
  2601: { name: "张耀文", colorKey: "c3" },
  2602: { name: "明子轩", colorKey: "c1" },
  2603: { name: "庞以名", colorKey: "c1" },
  2604: { name: "彭奕皓", colorKey: "c1" },
  2605: { name: "杨峥", colorKey: "c1" },
  2606: { name: "余运博", colorKey: "c1" },
  2607: { name: "赵政恺", colorKey: "c1" },
  2608: { name: "李亚峰", colorKey: "x6" },
  2609: { name: "闵梓洋", colorKey: "x6" },
  2610: { name: "冯颂哲", colorKey: "x6" },
  2611: { name: "任翔宇", colorKey: "x6" },
  2612: { name: "李博衍", colorKey: "c1" },
  2613: { name: "黄梓瑞", colorKey: "x6" },
  2614: { name: "刘易衡", colorKey: "x5" },
  2615: { name: "梁羽歌", colorKey: "x5" },
  2616: { name: "王劲尧", colorKey: "x5" },
  2617: { name: "廖锦川", colorKey: "x5" },
  2618: { name: "伍常齐", colorKey: "x5" },
  2619: { name: "付一诺", colorKey: "x4" },
  2620: { name: "张子墨", colorKey: "x4" },
  2621: { name: "李承芮", colorKey: "x4" },
  2622: { name: "柳苏宸", colorKey: "x4" },
  2623: { name: "王允今", colorKey: "x4" },
  2624: { name: "高施远", colorKey: "x4" },
  2625: { name: "姜淳安", colorKey: "x4" },
  2626: { name: "汪振皓", colorKey: "d3" },
  2627: { name: "蔡维柏", colorKey: "g1" },
  2628: { name: "林子为", colorKey: "g1" },
  2629: { name: "谭舜予", colorKey: "c3" },
  2630: { name: "李华洛", colorKey: "by" },
  2631: { name: "惠雨辰", colorKey: "g2" },
  2632: { name: "苑景丰", colorKey: "g2" },
  2633: { name: "高启哲", colorKey: "g2" },
  2634: { name: "董晋滔", colorKey: "c1" },
  2635: { name: "苏涌泉", colorKey: "g1" },
  2636: { name: "殷昊炜", colorKey: "g2" },
  2637: { name: "陈子睿", colorKey: "x6" },
  2638: { name: "田佳昊", colorKey: "d3" },
  2639: { name: "陈其睿", colorKey: "d3" },
  2640: { name: "高正", colorKey: "c1" },
  2641: { name: "刘城铭", colorKey: "c1" },
  2642: { name: "罗浩铭", colorKey: "c1" },
  2643: { name: "王泓懿", colorKey: "c1" },
  2644: { name: "杨钦荣", colorKey: "c1" },
  2645: { name: "张哲瑞", colorKey: "c2" },
  2646: { name: "杨智予", colorKey: "c2" },
  2647: { name: "匡宸锐", colorKey: "g2" },
  2648: { name: "程怀德", colorKey: "g2" },
  2649: { name: "史振烨", colorKey: "g1" },
  2650: { name: "岳双泽", colorKey: "g1" },
  2651: { name: "胡金勇", colorKey: "g1" },
  2652: { name: "杨佳熹", colorKey: "g1" },
  2653: { name: "蔡大为", colorKey: "c2" },
  2654: { name: "蔡明辉", colorKey: "g1" },
  2655: { name: "谢哲源", colorKey: "g2" },
  2656: { name: "袁煜智", colorKey: "c3" },
  2657: { name: "黄浩翔", colorKey: "g1" },
  2658: { name: "沈子荦", colorKey: "g2" },
  2659: { name: "李雨泽", colorKey: "g1" },
  2660: { name: "黄景梵", colorKey: "g1" },
  2661: { name: "张宗岳", colorKey: "g2" },
  2662: { name: "许家澍", colorKey: "c3" },
  2663: { name: "谢雨衡", colorKey: "g1" },
  2664: { name: "杨济帆", colorKey: "g1" },
  2665: { name: "邓承羽", colorKey: "g1" },
  2666: { name: "关永丞", colorKey: "c3" },
  2667: { name: "钟尚恒", colorKey: "g1" },
  2668: { name: "吕启航", colorKey: "g2" },
  2669: { name: "张炜丞", colorKey: "g2" },
  2670: { name: "肖煜航", colorKey: "c3" },
  2671: { name: "夏恩泽", colorKey: "g2" },
  2672: { name: "庞子诚", colorKey: "g1" },
  2673: { name: "毕泽轩", colorKey: "g1" },
  2674: { name: "吕牧泽", colorKey: "g2" },
  2675: { name: "李昭燃", colorKey: "by" },
  2676: { name: "陈积斌", colorKey: "g2" },
  2677: { name: "齐冠宇", colorKey: "g1" },
  2678: { name: "陈艺清", colorKey: "g2" },
  2679: { name: "严谨", colorKey: "c3" },
  2680: { name: "程竹", colorKey: "g2" },
  2681: { name: "周祎", colorKey: "g1" },
  2682: { name: "王泰然", colorKey: "g1" },
  2683: { name: "杜子睿", colorKey: "g1" },
  2684: { name: "金邱羽", colorKey: "g1" },
  2685: { name: "王涵", colorKey: "g1" },
  2686: { name: "李睿康", colorKey: "g1" },
  2687: { name: "黄子曜", colorKey: "c3" },
  2688: { name: "廖奕晨", colorKey: "g2" },
  2689: { name: "黄梓羲", colorKey: "g2" },
  2690: { name: "杨世承", colorKey: "c3" },
  2691: { name: "胡瀚深", colorKey: "c2" },
  2692: { name: "程浩佳", colorKey: "g1" },
  2693: { name: "汪志霖", colorKey: "g1" },
  2694: { name: "凌子皓", colorKey: "by" },
  2695: { name: "申洵宇", colorKey: "g1" },
  2696: { name: "陈奕能", colorKey: "c1" },
  2697: { name: "周烁宇", colorKey: "by" },
  2698: { name: "彭炜翔", colorKey: "g1" },
  2699: { name: "龙赟泽", colorKey: "g1" },
  2700: { name: "王子诚", colorKey: "c2" },
  2701: { name: "宋金哲", colorKey: "g2" },
  2702: { name: "刘湛庐", colorKey: "g1" },
  2703: { name: "黎灏", colorKey: "g1" },
  2704: { name: "钟子杰", colorKey: "g1" },
  2705: { name: "冼言信", colorKey: "by" },
  2706: { name: "莫丰瑞", colorKey: "g1" },
  2707: { name: "吴辰煜", colorKey: "g1" },
  2708: { name: "胡浩铭", colorKey: "c3" },
  2709: { name: "肖景壬", colorKey: "c2" },
  2710: { name: "徐钰源", colorKey: "g1" },
  2711: { name: "黎裕晴", colorKey: "c3" },
  2712: { name: "邓承卓", colorKey: "g2" },
  2713: { name: "徐米豪", colorKey: "by" },
  2714: { name: "贺中鸿", colorKey: "c3" },
  2715: { name: "邓致远", colorKey: "c2" },
  2716: { name: "桂子易", colorKey: "c3" },
  2717: { name: "楼天佑", colorKey: "g1" },
  2718: { name: "全智贤", colorKey: "c3" },
  2719: { name: "段奕然", colorKey: "by" },
  2720: { name: "何龙云", colorKey: "c1" },
  2721: { name: "周炫泽", colorKey: "g1" },
  2722: { name: "吴同春", colorKey: "g2" },
  2723: { name: "区誉誊", colorKey: "g1" },
  2724: { name: "endswitch", colorKey: "g1" },
  2725: { name: "杨静远", colorKey: "g1" },
  2726: { name: "黄品滔", colorKey: "c2" },
  2727: { name: "阳毅", colorKey: "c2" },
  2728: { name: "梁友霖", colorKey: "c3" },
  2729: { name: "叶雨皓", colorKey: "c3" },
  2730: { name: "程奕霖", colorKey: "c3" },
  2731: { name: "游家瑞", colorKey: "g1" },
  2732: { name: "郑思哲", colorKey: "c2" },
  2733: { name: "赵俊杰", colorKey: "by" },
  2734: { name: "陈彦均", colorKey: "c3" },
  2735: { name: "刘懿轩", colorKey: "g1" },
  2736: { name: "付壹宁", colorKey: "g1" },
  2737: { name: "杨霖泽", colorKey: "by" },
  2738: { name: "师禹田", colorKey: "c2" },
  2739: { name: "翁一凡", colorKey: "c1" },
  2740: { name: "肖宇浩", colorKey: "c2" },
  2741: { name: "肖涵予", colorKey: "g1" },
  2742: { name: "梁云博", colorKey: "g1" },
  2743: { name: "许子宸", colorKey: "c3" },
  2744: { name: "张宇皓", colorKey: "g1" },
  2745: { name: "张书齐", colorKey: "g1" },
  2746: { name: "梁君熙", colorKey: "c3" },
  2747: { name: "廖子健", colorKey: "by" },
  2748: { name: "易书瑶", colorKey: "c1" },
  2749: { name: "周行健", colorKey: "c2" },
  2750: { name: "许程景", colorKey: "g1" },
  2751: { name: "黄靖钊", colorKey: "c2" },
  2752: { name: "林沐春", colorKey: "g1" },
  2753: { name: "叶荣添", colorKey: "c2" },
  2754: { name: "蒋子杨", colorKey: "g2" },
  2755: { name: "易田星雨", colorKey: "g2" },
  2756: { name: "陈景皓", colorKey: "c2" },
  2757: { name: "陈信允", colorKey: "g1" },
  2758: { name: "龚瑞信", colorKey: "c2" },
  2759: { name: "钟宇杰", colorKey: "c2" },
  2760: { name: "周仪修", colorKey: "g1" },
  2761: { name: "龚诚", colorKey: "g2" },
  2762: { name: "江洪宇", colorKey: "g2" },
  2763: { name: "付城嘉", colorKey: "g2" },
  2764: { name: "梁轩华", colorKey: "c3" },
  2765: { name: "林琬馨", colorKey: "g1" },
  2766: { name: "袁浩然", colorKey: "c2" },
  2767: { name: "彭浩坤", colorKey: "g1" },
  2768: { name: "陈天一", colorKey: "c3" },
  2769: { name: "严启晋", colorKey: "c3" },
  2770: { name: "于天浩", colorKey: "g2" },
  2771: { name: "常哲恺", colorKey: "g1" },
  2772: { name: "lml", colorKey: "by" },
    2773: { name: "张弼粥", colorKey: "g2" },
    2774: { name: "邱梓懿", colorKey: "by" },
    2775: { name: "袁泇葳", colorKey: "g2" },
    2776: { name: "马姚源", colorKey: "g1" },
    2777: { name: "杜泓毅", colorKey: "g2" },
    2778: { name: "殷成伟", colorKey: "c3" },
    2779: { name: "林子萱", colorKey: "c3" },
    2780: { name: "袁嘉烨", colorKey: "c2" },
    2781: { name: "贾烁冉", colorKey: "g1" },
    2782: { name: "鞠文远", colorKey: "by" },
    2783: { name: "宋奕龙", colorKey: "c1" },
    2784: { name: "张君维", colorKey: "g1" },
    2785: { name: "熊墨章", colorKey: "g1" },
    2786: { name: "赵伊凌", colorKey: "c3" },
    2787: { name: "马铭霄", colorKey: "g1" },
    2788: { name: "谭臻阳", colorKey: "g2" },
    2789: { name: "孙祥哲", colorKey: "g1" },
    2790: { name: "崔朔", colorKey: "g1" },
    2791: { name: "唐善民", colorKey: "c3" },
    2792: { name: "凌梓亿", colorKey: "g2" },
    2793: { name: "张万珈", colorKey: "g1" },
    2794: { name: "王逸文", colorKey: "c3" },
    2795: { name: "胡茂行", colorKey: "c2" },
    2796: { name: "张肇伦", colorKey: "c1" },
    2797: { name: "魏芷清", colorKey: "g1" },
    2798: { name: "吕武凡", colorKey: "g1" },
    2799: { name: "申登博", colorKey: "c2" },
    2800: { name: "尹子谦", colorKey: "g1" },
    2801: { name: "樊宇辰", colorKey: "c3" },
    2802: { name: "孙轩宇", colorKey: "c2" },
    2803: { name: "王宇轩", colorKey: "c2" },
    2804: { name: "王铭栋", colorKey: "g1" },
    2805: { name: "徐昊轩", colorKey: "c3" },
    2806: { name: "朱煜宸", colorKey: "g1" },
    2807: { name: "杨子轩", colorKey: "c3" },
    2808: { name: "刘家铄", colorKey: "g2" },
    2809: { name: "王桉琦", colorKey: "g2" },
    2810: { name: "贺予辰", colorKey: "c2" },
    2811: { name: "王筱潇", colorKey: "c2" },
    2812: { name: "贾翔瑞", colorKey: "c3" },
    2813: { name: "黄俊齐", colorKey: "c1" },
    2814: { name: "喻添翼", colorKey: "g1" },
    2815: { name: "李子霖", colorKey: "c1" },
    2816: { name: "刘正燊", colorKey: "by" },
    2817: { name: "付宇辰", colorKey: "c1" },
    2818: { name: "张涵宇", colorKey: "c3" },
    2819: { name: "刘宝楷", colorKey: "c2" },
    2820: { name: "朱晨峻", colorKey: "g1" },
    2821: { name: "李东璟", colorKey: "by" },
    2822: { name: "张家豪", colorKey: "by" },
    2823: { name: "周辰旭", colorKey: "g1" },
    2824: { name: "陈泽瀚", colorKey: "by" },
    2825: { name: "吴越", colorKey: "g1" },
    2826: { name: "崔瑞麟", colorKey: "c3" },
    2827: { name: "曹子恒", colorKey: "g1" },
    2828: { name: "王墨凡", colorKey: "g1" },
    2829: { name: "邓学楷", colorKey: "g1" },
    2830: { name: "王思杰", colorKey: "c1" },
    2831: { name: "谢鑫", colorKey: "g1" },
    2832: { name: "刘康哲", colorKey: "by" },
    2833: { name: "陈洛炜", colorKey: "g1" },
    2834: { name: "张恒瑞哲", colorKey: "g1" },
    2835: { name: "李金城", colorKey: "by" },
    2836: { name: "郭翘楚", colorKey: "c2" },
    2837: { name: "滕思湘", colorKey: "by" },
    2838: { name: "王奕博", colorKey: "g1" },
    2839: { name: "党熙雯", colorKey: "g1" },
    2840: { name: "解尚繁", colorKey: "by" },
    2841: { name: "孙浩宸", colorKey: "by" },
    2842: { name: "伍敬宇", colorKey: "g1" },
    2843: { name: "唐一城", colorKey: "c3" },
    2844: { name: "王昱道", colorKey: "c3" },
    2845: { name: "吴慕瑶", colorKey: "c1" },
    2846: { name: "许政凯", colorKey: "by" },
    2847: { name: "郭雨棣", colorKey: "c3" },
    2848: { name: "雷宜轩", colorKey: "g2" },
    2849: { name: "单怡贝", colorKey: "c3" },
    2850: { name: "岑熹", colorKey: "c2" },
  };



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
    const lower = raw.replace(/\s+/g, '').toLowerCase();
    const parser = {
      cf: pid => `https://vjudge.net/problem/CodeForces-${pid.slice(2)}`,
      codeforces: pid => `https://vjudge.net/problem/CodeForces-${pid.replace(/^codeforces/, '')}`,
      atc: pid => {
        const m = pid.match(/^atc([a-z]+)(\d+)[_-]?([a-z])$/);
        if (m) return `https://vjudge.net/problem/AtCoder-${m[1]}${m[2]}_${m[3]}`;
        const base = pid.slice(3, -1), last = pid.slice(-1);
        return `https://vjudge.net/problem/AtCoder-${base}_${last}`;
      },
      luogu: pid => `https://vjudge.net/problem/洛谷-${pid.slice(5)}`,
      LG: pid => `https://vjudge.net/problem/洛谷-p${pid.slice(2)}`,
      uoj: pid => `https://vjudge.net/problem/UniversalOJ-${pid.slice(3)}`,
      poj: pid => `https://vjudge.net/problem/POJ-${pid.slice(3)}`,
      zoj: pid => `https://vjudge.net/problem/ZOJ-${pid.slice(3)}`,
      uva: pid => `https://vjudge.net/problem/UVA-${pid.slice(3)}`,
      loj: pid => `https://vjudge.net/problem/LightOJ-${pid.slice(3)}`
    };

    let vjUrl = '';
    for (const k of Object.keys(parser)) {
      if (lower.includes(k)) { try { vjUrl = parser[k](lower); } catch { } break; }
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
    vj.setAttribute('data-tooltip', `vj-${lower}`);
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
  let autoExit = GM_getValue(KEY.autoExit, false);
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
