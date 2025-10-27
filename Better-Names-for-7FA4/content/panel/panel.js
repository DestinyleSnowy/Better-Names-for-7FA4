// Panel frontend extracted from the main content script.
(async function () {
  'use strict';
  if (typeof window.__GM_ready === 'function') await window.__GM_ready();

  const btEnabled = GM_getValue('bt_enabled', false);
  const storedBgEnabled = GM_getValue('bg_enabled', false);
  const storedBgImageUrl = GM_getValue('bg_imageUrl', '');
  const storedBgOpacity = GM_getValue('bg_opacity', '0.1');
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
  const BN_TABLE_ROWS_SELECTOR = 'table.ui.very.basic.center.aligned.table tbody tr';

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

  function applyBackgroundOverlay(enabled, url, opacity) {
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
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover'
        });
        document.body.insertAdjacentElement('afterbegin', layer);
      }
      layer.style.opacity = String(clampOpacity(opacity));
      layer.style.backgroundImage = `url("${trimmedUrl}")`;
    });
  }
  const normalizedBgUrl = typeof storedBgImageUrl === 'string' ? storedBgImageUrl.trim() : '';
  const normalizedBgOpacity = String(clampOpacity(storedBgOpacity));
  applyBackgroundOverlay(storedBgEnabled, normalizedBgUrl, normalizedBgOpacity);

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
    light: { x4: '#5a5a5a', x5: '#92800b', x6: '#77dd02', c1: '#ff0000', c2: '#ff6629', c3: '#ffbb00', g1: '#ca00ca', g2: '#62ca00', g3: '#13c2c2', d1: '#9900ff', d2: '#000cff', d3: '#597ef7', d4: '#896e00', by: '#8c8c8c', jl: '#ff85c0', uk: '#5e6e5e' }
  };

  const palette = Object.assign({}, palettes.light, useCustomColors ? storedPalette : {});

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
  const bgEnabledInput = document.getElementById('bn-bg-enabled');
  const bgUrlInput = document.getElementById('bn-bg-image-url');
  const bgOpacityInput = document.getElementById('bn-bg-opacity');
  const bgOpacityValueSpan = document.getElementById('bn-bg-opacity-value');
  const hiToiletInput = document.getElementById('bn-bt-enabled');
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

  const colorSidebar = document.getElementById('bn-color-sidebar');
  const saveActions = document.getElementById('bn-save-actions');
  const chkVj = document.getElementById('bn-enable-vj');
  const chkHideDoneSkip = document.getElementById('bn-hide-done-skip');
  const chkQuickSkip = document.getElementById('bn-enable-quick-skip');

  chkTitleTr.checked = isFinite(maxTitleUnits);
  titleInp.value = isFinite(maxTitleUnits) ? maxTitleUnits : '';
  titleInp.disabled = !chkTitleTr.checked;

  chkUserTr.checked = isFinite(maxUserUnits);
  userInp.value = isFinite(maxUserUnits) ? maxUserUnits : '';
  userInp.disabled = !chkUserTr.checked;

  if (widthModeSel) widthModeSel.value = widthMode;

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
    bgEnabled: storedBgEnabled,
    bgImageUrl: normalizedBgUrl,
    bgOpacity: normalizedBgOpacity,
    btEnabled: btEnabled
  };

  if (!enableGuard) {
    disableNeedWarn();
  }

  pinBtn.classList.toggle('bn-pinned', pinned);
  if (pinned) {
    panel.classList.add('bn-show');
  }
  updateContainerState();

  titleInp.disabled = !originalConfig.titleTruncate;
  userInp.disabled = !originalConfig.userTruncate;
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
      ((document.getElementById('bn-width-mode')?.value ?? originalConfig.widthMode) !== originalConfig.widthMode) ||
      (document.getElementById('bn-bg-enabled').checked !== originalConfig.bgEnabled) ||
      (document.getElementById('bn-bg-image-url').value !== originalConfig.bgImageUrl) ||
      (document.getElementById('bn-bg-opacity').value !== originalConfig.bgOpacity) ||
      (document.getElementById('bn-bt-enabled').checked !== originalConfig.btEnabled) ||
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
  if (widthModeSel) widthModeSel.onchange = checkChanged;

  document.getElementById('bn-color-reset').onclick = () => {
    const base = palettes.light;
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
    const widthModeValue = (widthModeSel && widthModeSel.value) ? widthModeSel.value : widthMode;
    GM_setValue(WIDTH_MODE_KEY, widthModeValue);

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

    const obj = {};
    COLOR_KEYS.forEach(k => { if (colorPickers[k]) obj[k] = colorPickers[k].value; });
    GM_setValue('userPalette', JSON.stringify(obj));
    GM_setValue('useCustomColors', chkUseColor.checked);

    syncSubmitterState(chkSubmitter.checked);

    const bgEnabled = bgEnabledInput ? bgEnabledInput.checked : false;
    const bgImageUrl = bgUrlInput ? bgUrlInput.value.trim() : '';
    const bgOpacityRaw = bgOpacityInput ? bgOpacityInput.value : normalizedBgOpacity;
    const bgOpacity = String(clampOpacity(bgOpacityRaw));
    const btEnabled = hiToiletInput ? hiToiletInput.checked : !!(document.getElementById('bn-bt-enabled')?.checked);
    
    GM_setValue('bg_enabled', bgEnabled);
    GM_setValue('bg_imageUrl', bgImageUrl);
    GM_setValue('bg_opacity', bgOpacity);
    GM_setValue('bt_enabled', btEnabled);

    applyBackgroundOverlay(bgEnabled, bgImageUrl, bgOpacity);
    if (bgOpacityInput) bgOpacityInput.value = bgOpacity;
    if (bgOpacityValueSpan) bgOpacityValueSpan.textContent = formatOpacityText(bgOpacity);

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
    if (hiToiletInput) hiToiletInput.checked = originalConfig.btEnabled;
    titleInp.disabled = !chkTitleTrEl.checked;
    userInp.disabled = !chkUserTrEl.checked;
    planOpts.style.display = chkPlan.checked ? 'block' : 'none';
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
    if (bgEnabledInput) bgEnabledInput.checked = originalConfig.bgEnabled;
    if (bgUrlInput) bgUrlInput.value = originalConfig.bgImageUrl;
    if (bgOpacityInput) bgOpacityInput.value = originalConfig.bgOpacity;
    if (bgOpacityValueSpan) bgOpacityValueSpan.textContent = formatOpacityText(originalConfig.bgOpacity);
    applyBackgroundOverlay(originalConfig.bgEnabled, originalConfig.bgImageUrl, originalConfig.bgOpacity);
    checkChanged();
  }
  restoreOriginalConfig();
  document.getElementById('bn-cancel-changes').onclick = () => {
    restoreOriginalConfig();
  };

  if (bgEnabledInput && bgUrlInput && bgOpacityInput && bgOpacityValueSpan) {
    const updateBackgroundPreview = () => {
      bgOpacityValueSpan.textContent = formatOpacityText(bgOpacityInput.value);
      applyBackgroundOverlay(bgEnabledInput.checked, bgUrlInput.value, bgOpacityInput.value);
      checkChanged();
    };
    bgEnabledInput.addEventListener('change', updateBackgroundPreview);
    bgUrlInput.addEventListener('input', updateBackgroundPreview);
    bgOpacityInput.addEventListener('input', updateBackgroundPreview);
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
  if (hiToiletInput) hiToiletInput.addEventListener('change', checkChanged);
  else document.getElementById('bn-bt-enabled')?.addEventListener('change', checkChanged);
  const HI_TOILET_POLL_INTERVAL = 2000;
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
    hiToiletTimer = setTimeout(runHiToiletOnce, HI_TOILET_POLL_INTERVAL);
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
