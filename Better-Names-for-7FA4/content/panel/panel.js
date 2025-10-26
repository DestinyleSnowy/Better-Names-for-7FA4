// Panel frontend extracted from the main content script.
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

  const runtimeApi = (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.getURL === 'function')
    ? browser.runtime
    : ((typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') ? chrome.runtime : null);

  const FALLBACK_PANEL_TEMPLATE = /* html */ `
<div id="bn-trigger"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M12.02 9Q12.84 9 13.52 9.41Q14.21 9.82 14.6 10.51Q15 11.21 15 12.02Q15 12.84 14.6 13.52Q14.21 14.21 13.52 14.6Q12.84 15 12 15Q11.18 15 10.49 14.59Q9.79 14.18 9.4 13.49Q9 12.79 9 11.98Q9 11.16 9.41 10.48Q9.82 9.79 10.51 9.4Q11.21 9 12.02 9ZM12.05 7.51Q10.82 7.51 9.78 8.11Q8.74 8.71 8.12 9.73Q7.51 10.75 7.51 11.98Q7.51 13.2 8.11 14.24Q8.71 15.29 9.74 15.9Q10.78 16.51 12 16.51Q13.22 16.51 14.26 15.91Q15.29 15.31 15.9 14.28Q16.51 13.25 16.51 12.02Q16.51 10.8 15.91 9.77Q15.31 8.74 14.29 8.12Q13.27 7.51 12.05 7.51ZM13.56 22.66Q14.02 22.66 14.4 22.4Q14.78 22.15 14.98 21.74L15.79 19.85L15.98 19.75Q16.42 19.49 16.85 19.22L18.91 19.49Q19.39 19.54 19.8 19.33Q20.21 19.13 20.45 18.72L22.03 15.98Q22.27 15.58 22.24 15.12Q22.2 14.66 21.94 14.28L20.69 12.6L20.69 11.42L21.94 9.74Q22.22 9.36 22.25 8.9Q22.27 8.45 22.03 8.04L20.45 5.28Q20.23 4.9 19.82 4.68Q19.42 4.46 18.94 4.51L16.85 4.78Q16.42 4.46 15.86 4.2L15.02 2.23Q14.83 1.82 14.45 1.56Q14.06 1.3 13.61 1.3L10.44 1.3Q9.98 1.3 9.59 1.56Q9.19 1.82 9 2.23L8.16 4.2L7.92 4.34Q7.73 4.44 7.55 4.54Q7.37 4.63 7.2 4.75L5.09 4.51Q4.63 4.44 4.21 4.64Q3.79 4.85 3.55 5.26L1.97 8.02Q1.73 8.4 1.76 8.87Q1.8 9.34 2.06 9.72L3.34 11.42L3.34 12.53L2.06 14.23Q1.78 14.62 1.75 15.07Q1.73 15.53 1.97 15.94L3.53 18.67Q3.77 19.08 4.18 19.28Q4.58 19.49 5.06 19.44L7.13 19.2Q7.8 19.63 8.14 19.8L8.98 21.72Q9.14 22.15 9.53 22.4Q9.91 22.66 10.39 22.66L13.56 22.66ZM7.08 17.66L4.8 17.9L3.22 15.1L4.58 13.27Q4.8 12.94 4.8 12.6Q4.78 12.31 4.78 11.95Q4.78 11.59 4.8 11.3Q4.8 10.92 4.58 10.61L3.22 8.74L4.85 5.95L7.15 6.24Q7.37 6.26 7.55 6.22Q7.73 6.17 7.87 6.07Q8.3 5.76 8.93 5.47Q9.29 5.28 9.43 4.94L10.39 2.78L13.61 2.81L14.52 4.94Q14.64 5.26 15.02 5.47Q15.55 5.71 16.1 6.1Q16.46 6.34 16.82 6.26L19.13 6.02L20.71 8.83L19.37 10.63Q19.1 10.92 19.15 11.33Q19.18 11.64 19.18 12.01Q19.18 12.38 19.15 12.67Q19.13 13.06 19.37 13.37L20.71 15.19L19.08 17.98L16.85 17.71Q16.66 17.69 16.46 17.72Q16.27 17.76 16.13 17.88Q15.6 18.26 15 18.53Q14.83 18.62 14.69 18.76Q14.54 18.89 14.47 19.06L13.56 21.14L10.34 21.12L9.46 19.03Q9.29 18.67 8.95 18.5Q8.47 18.29 7.85 17.88Q7.58 17.69 7.25 17.69Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg></div>
  <div id="bn-panel">
    <div class="bn-panel-header">
      <div class="bn-panel-title">
        <div class="bn-panel-repo-icons">
          <a class="bn-panel-repo-link" href="https://github.com/DestinyleSnowy/Better-Names-for-7FA4" target="_blank" rel="noopener noreferrer" aria-label="打开 GitHub 仓库">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8Z"/></svg>
          </a>
          <a class="bn-panel-repo-link" href="http://jx.7fa4.cn:9080/yx/better-names-for-7fa4" target="_blank" rel="noopener noreferrer" aria-label="打开 GitLab 仓库">
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
          <label><input type="checkbox" id="bn-enable-title-truncate" /> 启用题目名截断</label>
          <div id="bn-title-options">
            <label>截断长度：
              <input id="bn-title-input" type="number" min="1" step="1" value="" placeholder="输入正整数">
            </label>
          </div>
          <label><input type="checkbox" id="bn-enable-user-truncate" /> 启用用户名截断</label>
          <div id="bn-user-options">
            <label>截断长度：
              <input id="bn-user-input" type="number" min="1" step="1" value="" placeholder="输入正整数">
            </label>
          </div>
          <div>
            <label>计数方式：
              <select id="bn-width-mode">
                <option value="visual" >视觉宽度（中文=2）</option>
                <option value="char" >等宽字符数（每字=1）</option>
                <option value="byte" >UTF-8 字节数</option>
              </select>
            </label>
          </div>
        </div>
        <div class="bn-section">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M22.87 11.47Q21.77 9.48 20.04 8.02Q18.31 6.55 16.24 5.77Q14.16 4.99 12 4.99Q9.84 4.99 7.76 5.77Q5.69 6.55 3.96 8.02Q2.23 9.48 1.13 11.47Q1.01 11.69 1.01 11.94Q1.01 12.19 1.13 12.43Q2.23 14.4 3.96 15.89Q5.69 17.38 7.78 18.18Q9.86 18.98 12 18.98Q14.16 18.98 16.24 18.18Q18.31 17.38 20.04 15.9Q21.77 14.42 22.87 12.43Q22.99 12.19 22.99 11.94Q22.99 11.69 22.87 11.47ZM10.15 17.33Q7.85 16.8 5.87 15.41Q3.89 14.02 2.66 12L2.66 11.83Q4.13 9.38 6.66 7.94Q9.19 6.5 12 6.5Q14.86 6.5 17.38 7.96Q19.9 9.41 21.36 11.86L21.36 12.05Q20.14 14.06 18.17 15.44Q16.2 16.82 13.92 17.35Q12.05 17.76 10.15 17.33ZM11.98 17.62Q13.39 17.62 14.58 16.92Q15.77 16.22 16.46 15.02Q17.16 13.82 17.16 12.41Q17.16 10.99 16.46 9.8Q15.77 8.62 14.58 7.92Q13.39 7.22 11.98 7.22Q11.09 7.22 10.25 7.51Q10.01 7.61 10.01 7.7Q10.01 7.8 10.27 7.92Q10.82 8.18 11.16 8.7Q11.5 9.22 11.5 9.84Q11.5 10.73 10.87 11.35Q10.25 11.98 9.38 11.98Q8.83 11.98 8.35 11.7Q7.87 11.42 7.58 10.97Q7.39 10.68 7.22 10.68Q7.06 10.68 6.96 10.99Q6.77 11.71 6.77 12.41Q6.77 13.82 7.46 15.02Q8.16 16.22 9.36 16.92Q10.56 17.62 11.98 17.62Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
            显示选项
          </div>
          <label><input type="checkbox" id="bn-hide-avatar" /> 隐藏用户头像</label>
          <label><input type="checkbox" id="bn-enable-user-menu" /> 启用用户菜单</label>
          <label><input type="checkbox" id="bn-enable-vj" /> 外站题目链接 Vjudge 按钮</label>
          <label><input type="checkbox" id="bn-enable-copy" /> 启用题面快捷复制</label>
          <label><input type="checkbox" id="bn-hide-orig" /> 隐藏题目源码按钮</label>
          <label><input type="checkbox" id="bn-hide-done-skip" /> 隐藏已通过&已跳过题目</label>
          <label><input type="checkbox" id="bn-enable-quick-skip" /> 启用快捷跳过按钮</label>
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
          <label><input type="checkbox" id="bn-enable-guard" /> 启用二三帮守护</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="24"><rect width="25" height="24" opacity="0"></rect><g mask="url(#hms_mask_0)"><path d="M17.37 2.5L17.37 2.11Q17.37 1.7 17.07 1.4Q16.77 1.1 16.36 1.1Q15.96 1.1 15.66 1.4Q15.36 1.7 15.36 2.11L15.36 2.5L9.38 2.5L9.38 2.11Q9.38 1.7 9.09 1.4Q8.8 1.1 8.4 1.1Q7.96 1.1 7.68 1.4Q7.39 1.7 7.39 2.11L7.39 2.5L5.35 2.5Q4.53 2.5 3.85 2.9Q3.16 3.31 2.76 4Q2.35 4.68 2.35 5.5L2.35 19.01Q2.35 19.82 2.76 20.51Q3.16 21.19 3.85 21.6Q4.53 22.01 5.35 22.01L19.36 22.01Q20.18 22.01 20.86 21.6Q21.55 21.19 21.96 20.51Q22.36 19.82 22.36 19.01L22.36 5.5Q22.36 4.68 21.96 4Q21.55 3.31 20.86 2.9Q20.18 2.5 19.36 2.5ZM7.39 4.01L7.39 4.2Q7.39 4.46 7.52 4.7Q7.65 4.94 7.88 5.08Q8.11 5.21 8.4 5.21Q8.66 5.21 8.89 5.08Q9.12 4.94 9.25 4.7Q9.38 4.46 9.38 4.2L9.38 4.01L15.36 4.01L15.36 4.2Q15.36 4.46 15.49 4.7Q15.62 4.94 15.85 5.08Q16.08 5.21 16.36 5.21Q16.63 5.21 16.86 5.08Q17.08 4.94 17.22 4.7Q17.35 4.46 17.35 4.2L17.35 4.01L19.36 4.01Q19.99 4.01 20.42 4.44Q20.85 4.87 20.85 5.5L20.85 7.7L3.86 7.7L3.86 5.5Q3.86 4.87 4.3 4.44Q4.75 4.01 5.35 4.01ZM5.35 20.5Q4.75 20.5 4.3 20.05Q3.86 19.61 3.86 19.01L3.86 9.19L20.88 9.19L20.88 19.01Q20.88 19.61 20.43 20.05Q19.99 20.5 19.36 20.5L5.35 20.5ZM6.84 13.34Q7.24 13.34 7.54 13.04Q7.84 12.74 7.84 12.34Q7.84 11.93 7.54 11.63Q7.24 11.33 6.84 11.33Q6.43 11.33 6.13 11.63Q5.83 11.93 5.83 12.34Q5.83 12.74 6.13 13.04Q6.43 13.34 6.84 13.34ZM10.56 13.34Q10.96 13.34 11.26 13.04Q11.56 12.74 11.56 12.34Q11.56 11.93 11.26 11.63Q10.96 11.33 10.56 11.33Q10.15 11.33 9.85 11.63Q9.55 11.93 9.55 12.34Q9.55 12.74 9.85 13.04Q10.15 13.34 10.56 13.34ZM14.3 13.34Q14.71 13.34 15.01 13.04Q15.31 12.74 15.31 12.34Q15.31 11.93 15.01 11.63Q14.71 11.33 14.3 11.33Q13.89 11.33 13.59 11.63Q13.29 11.93 13.29 12.34Q13.29 12.74 13.59 13.04Q13.89 13.34 14.3 13.34ZM18.02 13.34Q18.43 13.34 18.73 13.04Q19.03 12.74 19.03 12.34Q19.03 11.93 18.73 11.63Q18.43 11.33 18.02 11.33Q17.61 11.33 17.31 11.63Q17.01 11.93 17.01 12.34Q17.01 12.74 17.31 13.04Q17.61 13.34 18.02 13.34ZM6.84 17.35Q7.24 17.35 7.54 17.05Q7.84 16.75 7.84 16.34Q7.84 15.94 7.54 15.64Q7.24 15.34 6.84 15.34Q6.43 15.34 6.13 15.64Q5.83 15.94 5.83 16.34Q5.83 16.75 6.13 17.05Q6.43 17.35 6.84 17.35ZM10.56 17.35Q10.96 17.35 11.26 17.05Q11.56 16.75 11.56 16.34Q11.56 15.94 11.26 15.64Q10.96 15.34 10.56 15.34Q10.15 15.34 9.85 15.64Q9.55 15.94 9.55 16.34Q9.55 16.75 9.85 17.05Q10.15 17.35 10.56 17.35Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g><defs><mask id="hms_mask_0"><rect width="25" height="24" fill="#ffffff"></rect><g><path d="M19.34 13.25Q17.9 13.25 16.69 13.96Q15.48 14.66 14.77 15.88Q14.06 17.09 14.06 18.53Q14.06 19.97 14.77 21.19Q15.48 22.42 16.69 23.12Q17.9 23.83 19.34 23.83Q20.78 23.83 22 23.12Q23.23 22.42 23.94 21.19Q24.64 19.97 24.64 18.53Q24.64 17.09 23.92 15.88Q23.2 14.66 21.99 13.96Q20.78 13.25 19.34 13.25Z" fill="#000000"></path></g></mask></defs><g><path d="M15.36 18.53Q15.36 19.63 15.9 20.54Q16.44 21.46 17.35 22Q18.26 22.54 19.34 22.54Q20.42 22.54 21.34 22Q22.27 21.46 22.81 20.54Q23.35 19.63 23.35 18.53Q23.35 17.45 22.81 16.54Q22.27 15.62 21.34 15.08Q20.42 14.54 19.34 14.54Q18.26 14.54 17.35 15.08Q16.44 15.62 15.9 16.54Q15.36 17.45 15.36 18.53ZM21.19 19.68Q21.36 19.85 21.34 20.04Q21.33 20.23 21.19 20.4Q21.04 20.54 20.84 20.54Q20.64 20.54 20.49 20.4L19 18.91Q18.86 18.77 18.86 18.55L18.86 16.51Q18.86 16.3 19 16.15Q19.15 16.01 19.36 16.01Q19.58 16.01 19.72 16.15Q19.87 16.3 19.87 16.51L19.87 18.36L21.19 19.68Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
             添加计划
          </div>
          <label><input type="checkbox" id="bn-enable-plan" /> 启用添加计划</label>
          <div id="bn-plan-options"></div>
        </div>
        <div class="bn-section">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="24"><rect width="25" height="24" opacity="0"></rect><g mask="url(#hms_mask_0)"><path d="M18.1 21.6Q19.11 21.6 19.98 21.1Q20.84 20.59 21.34 19.73Q21.85 18.86 21.85 17.86L21.85 6.36Q21.85 5.35 21.34 4.49Q20.84 3.62 19.98 3.12Q19.11 2.62 18.1 2.62L6.61 2.62Q5.58 2.62 4.71 3.12Q3.85 3.62 3.34 4.49Q2.84 5.35 2.84 6.36L2.84 17.86Q2.84 18.86 3.34 19.73Q3.85 20.59 4.71 21.1Q5.58 21.6 6.61 21.6L18.1 21.6ZM18.1 4.1Q19.02 4.1 19.69 4.76Q20.36 5.42 20.36 6.36L20.36 17.83Q20.36 18.77 19.69 19.43Q19.02 20.09 18.1 20.09L6.61 20.09Q5.67 20.09 5.01 19.43Q4.35 18.77 4.35 17.83L4.35 6.36Q4.35 5.42 5.01 4.76Q5.67 4.1 6.61 4.1L18.1 4.1Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g><defs><mask id="hms_mask_0"><rect width="25" height="24" fill="#ffffff"></rect><g><path d="M23.86 0.65Q23.55 0.34 23.13 0.17Q22.71 0 22.26 0Q21.8 0 21.38 0.17Q20.96 0.34 20.65 0.65L11.1 10.22Q10.88 10.44 10.76 10.66L9.39 13.08Q9.2 13.46 9.2 13.86Q9.2 14.26 9.42 14.57Q9.61 14.9 9.96 15.11Q10.3 15.31 10.69 15.31Q11.05 15.31 11.38 15.12L13.83 13.73Q14.05 13.63 14.29 13.39L23.86 3.84Q24.51 3.17 24.51 2.24Q24.51 1.32 23.86 0.65Z" fill="#000000"></path></g></mask></defs><g><path d="M10.4 13.7Q10.33 13.82 10.38 13.94Q10.42 14.06 10.56 14.11Q10.69 14.16 10.81 14.11L12.61 13.1Q12.8 12.98 12.97 12.86L13.14 12.74L11.77 11.4L11.62 11.62Q11.55 11.71 11.52 11.77Q11.48 11.83 11.41 11.93L10.4 13.7ZM23.02 1.49Q22.71 1.18 22.27 1.18Q21.82 1.18 21.51 1.49L12.51 10.49L12.42 10.58Q12.34 10.68 12.25 10.8L13.71 12.26Q13.83 12.19 14.02 12L23.02 3Q23.36 2.69 23.36 2.24Q23.36 1.8 23.02 1.49Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
            榜单筛选
          </div>
          <label><input type="checkbox" id="bn-enable-ranking-filter" /> 启用榜单筛选</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M13.32 2.47Q13.1 2.14 12.74 1.94Q12.38 1.75 12 1.75Q11.59 1.75 11.21 1.99Q10.82 2.23 10.63 2.64L2.93 20.11Q2.64 20.78 2.92 21.34Q3.19 21.89 3.79 22.1Q4.39 22.32 4.94 22.08L12 18.74L19.06 22.08Q19.61 22.32 20.21 22.1Q20.81 21.89 21.08 21.34Q21.36 20.78 21.05 20.11L13.39 2.64ZM12.29 5.81Q12.29 5.62 12.13 5.54Q11.98 5.47 11.83 5.54Q11.69 5.62 11.69 5.81L11.02 17.54L4.3 20.71L12 3.26L19.68 20.71L12.96 17.52L12.29 5.81Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
            Submitter
          </div>
          <label><input type="checkbox" id="bn-enable-submitter" /> 启用 Submitter</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M0.98 12.1Q0.98 12.91 1.19 13.96Q1.39 15 1.7 15.84Q1.75 15.98 1.88 16.03Q2.02 16.08 2.15 16.04Q2.28 16.01 2.35 15.89L4.42 12.53Q4.49 12.41 4.46 12.29Q4.44 12.17 4.34 12.08Q4.25 12 4.13 12L2.52 12Q2.52 9.5 3.72 7.37Q4.92 5.23 6.98 3.92Q9.05 2.62 11.54 2.5Q13.46 2.4 15.23 3.04Q16.99 3.67 18.38 4.97Q19.8 6.24 20.59 7.94Q21.38 9.65 21.48 11.54Q21.58 13.44 20.94 15.2Q20.3 16.97 19.03 18.36Q17.76 19.78 16.06 20.58Q14.35 21.38 12.46 21.48Q10.61 21.58 8.88 20.98Q7.15 20.38 5.76 19.15Q5.52 18.94 5.21 18.96Q4.9 18.98 4.7 19.22Q4.49 19.46 4.51 19.78Q4.54 20.09 4.78 20.28Q6.5 21.79 8.29 22.38Q10.08 22.97 12.5 22.97Q14.71 22.87 16.68 21.95Q18.65 21.02 20.14 19.39Q21.62 17.76 22.34 15.71Q23.06 13.66 22.97 11.47Q22.85 9.26 21.92 7.3Q21 5.33 19.37 3.84Q17.74 2.35 15.68 1.63Q13.63 0.91 11.45 1.01Q8.57 1.15 6.17 2.69Q3.77 4.22 2.38 6.72Q0.98 9.22 0.98 12.1Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>\
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
          <label><input type="checkbox" id="bn-enable-renew" /> 启用题目自动更新</label>
        </div>
        <div class="bn-section bn-section-color-theme">
          <div class="bn-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" opacity="0"></rect><g><path d="M11.83 21.89Q12.82 21.89 13.44 21.38Q14.06 20.88 14.23 20.16Q14.4 19.44 14.14 18.86Q13.94 18.36 13.66 18.05Q13.42 17.69 13.49 17.4Q13.56 17.11 13.88 16.96Q14.21 16.8 14.74 16.82Q16.51 16.94 18 16.45Q19.49 15.96 20.48 14.86Q21.48 13.75 21.79 12.07Q22.08 10.49 21.62 8.86Q21.17 7.22 20.35 6.17Q18.24 3.48 15.5 2.62Q12.77 1.75 10.24 2.27Q7.7 2.78 6.12 4.03Q4.42 5.35 3.26 7.33Q2.11 9.31 2.11 12.6Q2.11 14.57 3.35 16.75Q4.58 18.94 6.82 20.41Q9.05 21.89 11.83 21.89ZM7.03 5.23Q8.4 4.18 10.54 3.73Q12.67 3.29 15 4.02Q17.33 4.75 19.18 7.08Q19.8 7.9 20.16 9.24Q20.52 10.58 20.3 11.81Q19.94 13.75 18.49 14.62Q17.04 15.48 14.81 15.31Q13.46 15.24 12.74 15.86Q12.02 16.49 11.96 17.39Q11.9 18.29 12.46 18.94Q12.62 19.13 12.77 19.46Q12.82 19.56 12.78 19.79Q12.74 20.02 12.52 20.21Q12.29 20.4 11.83 20.4Q9.48 20.4 7.6 19.16Q5.71 17.93 4.66 16.09Q3.6 14.26 3.6 12.6Q3.6 9.77 4.58 8.06Q5.57 6.36 7.03 5.23ZM7.32 8.66Q6.77 8.66 6.37 9.05Q5.98 9.43 5.98 9.98Q5.98 10.54 6.37 10.93Q6.77 11.33 7.32 11.33Q7.87 11.33 8.27 10.93Q8.66 10.54 8.66 9.98Q8.66 9.43 8.27 9.05Q7.87 8.66 7.32 8.66ZM9.98 5.3Q9.43 5.3 9.05 5.7Q8.66 6.1 8.66 6.65Q8.66 7.2 9.05 7.6Q9.43 7.99 9.98 7.99Q10.54 7.99 10.93 7.6Q11.33 7.2 11.33 6.65Q11.33 6.1 10.93 5.7Q10.54 5.3 9.98 5.3ZM14.26 5.3Q13.7 5.3 13.31 5.7Q12.91 6.1 12.91 6.65Q12.91 7.2 13.31 7.6Q13.7 7.99 14.26 7.99Q14.81 7.99 15.19 7.6Q15.58 7.2 15.58 6.65Q15.58 6.1 15.19 5.7Q14.81 5.3 14.26 5.3ZM16.92 8.66Q16.37 8.66 15.97 9.05Q15.58 9.43 15.58 9.98Q15.58 10.54 15.97 10.93Q16.37 11.33 16.92 11.33Q17.47 11.33 17.87 10.93Q18.26 10.54 18.26 9.98Q18.26 9.43 17.87 9.05Q17.47 8.66 16.92 8.66Z" fill="rgba(0,0,0,0.9019607843137255)"></path></g></svg>
            颜色 & 主题
          </div>
          <label><input type="checkbox" id="bn-use-custom-color" /> 启用自定义颜色</label>
          <div>
            <label>主题：
              <select id="bn-theme-select">
                <option value="auto" >跟随系统</option>
                <option value="light" >浅色</option>
                <option value="dark" >深色</option>
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
          <div class="bn-color-grid" id="bn-color-grid"></div>
          <div class="bn-color-actions">
            <button class="bn-btn" id="bn-color-reset">重置默认</button>
          </div>
        </div>
      </div>
    </div>
    <div class="bn-footer">
      <div class="bn-save-actions" id="bn-save-actions">
        <button class="bn-btn bn-btn-primary" id="bn-save-config">保存配置</button>
        <button class="bn-btn" id="bn-cancel-changes">取消更改</button>
      </div>
      <div class="bn-version">
        <div class="bn-version-text">6.0.0 SP17 Developer</div>
      </div>
    </div>
  </div>
`;

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
  if (effectiveTheme === 'dark') container.classList.add('bn-dark');
  container.innerHTML = panelTemplate;

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

  const panel = document.getElementById('bn-panel');
  const pinBtn = document.getElementById('bn-pin');
  const trigger = document.getElementById('bn-trigger');
  if (!panel || !pinBtn || !trigger) {
    console.error('[BN] 面板初始化失败：缺少必要的 DOM 元素');
    container.remove();
    return;
  }
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
    GM_setValue(CORNER_KEY, pos);
  }

  applyCorner(GM_getValue(CORNER_KEY, 'br'));
  updateContainerState();

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
  const chkUseColor = document.getElementById('bn-use-custom-color');
  const themeSelect = document.getElementById('bn-theme-select');

  const colorSidebar = document.getElementById('bn-color-sidebar');
  const saveActions = document.getElementById('bn-save-actions');
  const chkVj = document.getElementById('bn-enable-vj');
  const chkHideDoneSkip = document.getElementById('bn-hide-done-skip');
  const chkQuickSkip = document.getElementById('bn-enable-quick-skip');

  chkTitleTr.checked = isFinite(maxTitleUnits);
  titleInp.value = isFinite(maxTitleUnits) ? maxTitleUnits : '';
  titleOpts.style.display = chkTitleTr.checked ? 'block' : 'none';

  chkUserTr.checked = isFinite(maxUserUnits);
  userInp.value = isFinite(maxUserUnits) ? maxUserUnits : '';
  userOpts.style.display = chkUserTr.checked ? 'block' : 'none';

  widthModeSel.value = widthMode;

  chkAv.checked = hideAvatar;
  chkCp.checked = enableCopy;
  chkHo.checked = hideOrig;
  chkMenu.checked = enableMenu;
  chkGuard.checked = enableGuard;
  chkPlan.checked = enablePlanAdder;
  chkAutoRenew.checked = enableAutoRenew;
  chkRankingFilter.checked = enableRankingFilterSetting;
  chkSubmitter.checked = enableSubmitter;
  planOpts.style.display = enablePlanAdder ? 'block' : 'none';

  chkUseColor.checked = useCustomColors;
  themeSelect.value = themeMode;

  chkVj.checked = enableVjLink;
  chkHideDoneSkip.checked = hideDoneSkip;
  chkQuickSkip.checked = enableQuickSkip;

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
    hideOrig,
    enableMenu,
    enableGuard,
    enablePlanAdder,
    enableAutoRenew,
    enableRankingFilter: enableRankingFilterSetting,
    enableSubmitter,
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
  }
  updateContainerState();

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
    updateContainerState();
  };
  const hidePanel = () => {
    if (pinned) return;
    panel.classList.remove('bn-show');
    if (panel.contains(document.activeElement)) document.activeElement.blur();
    updateContainerState();
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
      if (wasPinned) { panel.classList.add('bn-show'); }
      updateContainerState();

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
    updateContainerState();

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
    const changed =
      (document.getElementById('bn-enable-title-truncate').checked !== originalConfig.titleTruncate) ||
      (document.getElementById('bn-enable-user-truncate').checked !== originalConfig.userTruncate) ||
      (document.getElementById('bn-enable-title-truncate').checked && ti !== originalConfig.maxTitleUnits) ||
      (document.getElementById('bn-enable-user-truncate').checked && ui !== originalConfig.maxUserUnits) ||
      (document.getElementById('bn-hide-avatar').checked !== originalConfig.hideAvatar) ||
      (document.getElementById('bn-enable-copy').checked !== originalConfig.enableCopy) ||
      (document.getElementById('bn-hide-orig').checked !== originalConfig.hideOrig) ||
      (document.getElementById('bn-enable-user-menu').checked !== originalConfig.enableMenu) ||
      (document.getElementById('bn-enable-guard').checked !== originalConfig.enableGuard) ||
      (document.getElementById('bn-enable-plan').checked !== originalConfig.enablePlanAdder) ||
      (document.getElementById('bn-enable-renew').checked !== originalConfig.enableAutoRenew) ||
      (document.getElementById('bn-enable-ranking-filter').checked !== originalConfig.enableRankingFilter) ||
      (document.getElementById('bn-enable-submitter').checked !== originalConfig.enableSubmitter) ||
      (document.getElementById('bn-enable-vj').checked !== originalConfig.enableVjLink) ||
      (document.getElementById('bn-hide-done-skip').checked !== originalConfig.hideDoneSkip) ||
      (document.getElementById('bn-enable-quick-skip').checked !== originalConfig.enableQuickSkip) ||
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
  chkGuard.onchange = () => {
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
    checkChanged();
  };
  chkVj.onchange = checkChanged;
  chkHideDoneSkip.onchange = () => { applyHideDoneSkip(chkHideDoneSkip.checked); checkChanged(); };
  chkQuickSkip.onchange = () => { applyQuickSkip(chkQuickSkip.checked); checkChanged(); };
  chkPlan.onchange = () => { toggleOption(chkPlan, planOpts); checkChanged(); };
  chkAutoRenew.onchange = checkChanged;
  chkRankingFilter.onchange = checkChanged;
  chkSubmitter.onchange = checkChanged;
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
    GM_setValue('enableQuickSkip', chkQuickSkip.checked);
    GM_setValue('enableUserMenu', chkMenu.checked);
    GM_setValue('enableGuard', chkGuard.checked);
    GM_setValue('enableVjLink', chkVj.checked);
    GM_setValue('enablePlanAdder', chkPlan.checked);
    GM_setValue('enableAutoRenew', chkAutoRenew.checked);
    GM_setValue('enableSubmitter', chkSubmitter.checked);
    GM_setValue('rankingFilter.enabled', chkRankingFilter.checked);

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
    chkGuard.checked = originalConfig.enableGuard;
    if (!originalConfig.enableGuard) {
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
    chkVj.checked = originalConfig.enableVjLink;
    chkHideDoneSkip.checked = originalConfig.hideDoneSkip;
    applyHideDoneSkip(originalConfig.hideDoneSkip);
    chkQuickSkip.checked = originalConfig.enableQuickSkip;
    applyQuickSkip(originalConfig.enableQuickSkip);
    chkPlan.checked = originalConfig.enablePlanAdder;
    chkAutoRenew.checked = originalConfig.enableAutoRenew;
    chkRankingFilter.checked = originalConfig.enableRankingFilter;
    chkSubmitter.checked = originalConfig.enableSubmitter;
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
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      // If info.name could potentially contain unsafe chars, escape it as well:
      finalText = (img ? '\u00A0' : '') + escapeHtml(info.name);
      const c = palette[info.colorKey];
      if (c) a.style.color = c;
    } else {
      const safeTruncated = escapeHtml(truncateByUnits(baseText || a.textContent.trim(), maxUserUnits));
      finalText = (img ? '\u00A0' : '') + safeTruncated;
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
