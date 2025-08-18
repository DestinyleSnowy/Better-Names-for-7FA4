// ==UserScript==
// @name         Better Names for 7FA4
// @namespace    http://tampermonkey.net/
// @version      v5.1
// @description  Better Names for 7FA4 v5.1: Added submission guard.
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

  /* ----------------------------------------------------------------
   *  0) 配置读取 & 常量
   * ---------------------------------------------------------------- */

  const DEFAULT_MAX_UNITS = 10;
  const storedTitleUnits = GM_getValue('maxTitleUnits', DEFAULT_MAX_UNITS);
  const storedUserUnits = GM_getValue('maxUserUnits', DEFAULT_MAX_UNITS);
  const maxTitleUnits = (storedTitleUnits === 'none') ? Infinity : parseInt(storedTitleUnits, 10);
  const maxUserUnits = (storedUserUnits === 'none') ? Infinity : parseInt(storedUserUnits, 10);
  const hideAvatar = GM_getValue('hideAvatar', false);
  const enableCopy = GM_getValue('enableCopy', false);
  const copyNotify = GM_getValue('copyNotify', false);
  const hideOrig = GM_getValue('hideOrig', false);
  const enableMenu = GM_getValue('enableUserMenu', false);
  const enablePlanAdder = GM_getValue('enablePlanAdder', false);
  const initialAutoExit = GM_getValue('planAdder.autoExit', false);
  const enableVjLink = GM_getValue('enableVjLink', false);


  const hideDoneSkip = GM_getValue('hideDoneSkip', false);
  // 新增：截断“计数方式” (visual|char|byte)
  const WIDTH_MODE_KEY = 'truncate.widthMode';
  const widthMode = GM_getValue(WIDTH_MODE_KEY, 'visual'); // 默认保留你原来的“中文=2”逻辑

  // 新增：主题选择（auto|light|dark），用于挑选默认调色板；面板 UI 也会跟着变暗
  const THEME_KEY = 'colorTheme';
  const themeMode = GM_getValue(THEME_KEY, 'auto');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveTheme = themeMode === 'auto' ? (prefersDark ? 'dark' : 'light') : themeMode;

  let autoExit = initialAutoExit;

  const COLOR_KEYS = ['low3', 'low2', 'low1', 'is', 'upp1', 'upp2', 'upp3', 'upp4', 'upp5', 'upp6', 'oth', 'tch']; // 新增 tch（教师）
  const COLOR_LABELS = {
    low3: '初2025级',
    low2: '初2024级',
    low1: '初2023级',
    is: '高2025级',
    upp1: '高2024级',
    upp2: '高2023级',
    upp3: '大2025级',
    upp4: '大2024级',
    upp5: '大2023级',
    upp6: '大2022级',
    oth: '成都七中',
    tch: '教师'
  };
  const GRADE_LABELS = {
    is: '高2025级',
    upp1: '高2024级',
    upp2: '高2023级',
    upp3: '大2025级',
    upp4: '大2024级',
    upp5: '大2023级',
    upp6: '大2022级',
    low3: '初2025级',
    low2: '初2024级',
    low1: '初2023级',
    oth: '成都七中',
    tch: '教师'
  };

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
    light: {
      low3: '#ff0101',
      low2: '#ff6629',
      low1: '#ffbb00',
      upp1: '#62ca00',
      upp2: '#00b972',
      upp3: '#9900ff',
      is: '#ca00ca',
      oth: '#5a5a5a',
      upp4: '#000cff',
      upp5: '#896e00',
      upp6: '#00ffff',
      tch: '#333333'
    },
    dark: {
      // 深色背景上更通透饱和的色
      low3: '#ff5b5b',
      low2: '#ff8a4d',
      low1: '#ffd24d',
      upp1: '#7be14a',
      upp2: '#24d39a',
      upp3: '#b06bff',
      is: '#ff73ff',
      oth: '#cfcfcf',
      upp4: '#6b86ff',
      upp5: '#d2b04d',
      upp6: '#00ffff',
      tch: '#e0e0e0'
    }
  };

  const basePalette = palettes[effectiveTheme] || palettes.light;
  const palette = Object.assign({}, basePalette, useCustomColors ? storedPalette : {});

  /* ----------------------------------------------------------------
   *  1) 样式（支持暗色）
   * ---------------------------------------------------------------- */
  const css = `
    /* 基础变量：根据 light / dark 切换 */
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

      /* 新增：让保存条不再推挤布局 */
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
      margin: 0; display: flex; align-items: center; gap: 8px;
    }
    .bn-panel-subtitle { font-size: 12px; color: var(--bn-text-muted); margin: 4px 0 0 0; }

    .bn-panel-content {
      display: flex; transition: all .4s cubic-bezier(.4,0,.2,1);
      /* 永远为保存条+版本栏预留空间，避免跳变 */
      padding-bottom: calc(var(--bn-savebar-h) + var(--bn-version-h));
    }
    .bn-main-content {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      flex: 1;
      min-width: 0;
      /* 只给中间网格（每个“框”所在区域）留白，侧栏不动 */
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

    /* ⚠️ 保存条改为“悬浮”，通过透明度显示，避免面板跳变 */
    .bn-save-actions {
      position: absolute;
      left: 0; right: 0;
      bottom: var(--bn-version-h);
      height: var(--bn-savebar-h);
      padding: 0 20px;
      border-top: 1px solid var(--bn-border-subtle);
      background: var(--bn-bg);
      display: flex; gap: 8px; justify-content: flex-end; align-items: center;

      opacity: 0; pointer-events: none; transform: translateY(6px);
      transition: opacity .2s ease, transform .2s ease;
      will-change: opacity, transform;
    }
    .bn-save-actions.bn-visible {
      opacity: 1; pointer-events: auto; transform: translateY(0);
    }

    /* 子菜单：默认不带动画（仅在切换时由 JS 注入动画） */
    #bn-copy-options {
      margin-left: 24px; display: ${enableCopy ? 'block' : 'none'}; padding-top: 8px; border-top: 1px solid var(--bn-border-subtle);
      margin-top: 8px;
    }
    #bn-plan-options {
      margin-left: 24px; display: ${enablePlanAdder ? 'block' : 'none'}; padding-top: 8px; border-top: 1px solid var(--bn-border-subtle);
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
      /* 背景颜色采用主题色或白色，并叠加由右至左渐深的浅蓝色阴影 */
      background-color: var(--bn-bg, #fff);
      /* 渐变从右（深）到左（浅） */
      background-image: linear-gradient(to left, rgba(124, 191, 255, 0.15), rgba(124, 191, 255, 0));
      background-repeat: no-repeat;
      box-shadow: var(--bn-panel-shadow);
      border-radius: 8px;
      padding: 8px 0;
      display: none;
      flex-direction: column;
      min-width: 160px;
      overflow: hidden;
      /* 默认边框，不做额外定制 */
      border: 1px solid var(--bn-border);
    }
    #bn-user-menu a {
      padding: 10px 16px; color: var(--bn-text-sub); text-decoration: none; font-size: 13px; white-space: nowrap; transition: all .2s ease; position: relative;
    }
    #bn-user-menu a::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #007bff; transform: scaleY(0); transition: transform .2s ease;
    }
    #bn-user-menu a:hover { background: var(--bn-hover-bg); color: var(--bn-text); padding-left: 20px; }
    #bn-user-menu a:hover::before { transform: scaleY(1); }

    .bn-version {
      text-align: center; padding: 12px 20px;
      background: linear-gradient(135deg, var(--bn-bg-grad-1) 0%, var(--bn-bg-grad-2) 100%);
      border-top: 1px solid var(--bn-border-subtle);
      font-size: 11px; color: var(--bn-text-muted); font-weight: 500;

      /* 新增：固定高度，给保存条预留落点 */
      min-height: var(--bn-version-h);
      display: flex; align-items: center; justify-content: center;
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
  GM_addStyle(`/* === 角落定位 & 面板展开方向 === */
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

/* 隐藏行样式 */
.bn-hide-done-skip{display:none!important;}`);

  /* ----------------------------------------------------------------
   *  2) 面板 DOM
   * ---------------------------------------------------------------- */
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
          <svg class="bn-icon bn-icon-settings" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          Better Names for 7FA4 设置
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
                      <label><input type=\"checkbox\" id=\"bn-hide-done-skip\" ${hideDoneSkip ? 'checked' : ''}/> 隐藏已通过&已跳过题目</label>
</div>

          <div class="bn-section">
            <div class="bn-title">
              <svg class="bn-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              复制功能
            </div>
            <label><input type="checkbox" id="bn-enable-copy" ${enableCopy ? 'checked' : ''}/> 启用题面复制</label>
            <div id="bn-copy-options">
              <label><input type="checkbox" id="bn-copy-notify" ${copyNotify ? 'checked' : ''}/> 显示复制提示</label>
              <label><input type="checkbox" id="bn-hide-orig" ${hideOrig ? 'checked' : ''}/> 隐藏原始按钮</label>
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
      <div class="bn-version">Public Release | v5.1</div>
    </div>`;
  document.body.appendChild(container);
  container.style.pointerEvents = 'none';

  /* ----------------------------------------------------------------
   *  3) 元素引用
   * ---------------------------------------------------------------- */
  const trigger = document.getElementById('bn-trigger');
  const panel = document.getElementById('bn-panel');
  const pinBtn = document.getElementById('bn-pin');
  let pinned = !!GM_getValue('panelPinned', false);
  /* === 角落状态与拖拽逻辑 === */
  const CORNER_KEY = 'bn.corner';
  const SNAP_MARGIN = 20;
  let isDragging = false;
  let wasPinned = false;
  let gearW = 48, gearH = 48;
  let __bn_trail = [];
  let __bn_raf = null;
  let __bn_dragX = 0, __bn_dragY = 0;
  let __bn_pointerId = null;
  let __bn_prevTransition = '';
  let __bn_prevWillChange = '';

  function applyCorner(pos /* 'br'|'bl'|'tr'|'tl' */) {
    container.classList.remove('bn-pos-br', 'bn-pos-bl', 'bn-pos-tr', 'bn-pos-tl');
    container.classList.add('bn-pos-' + pos);
    GM_setValue(CORNER_KEY, pos);
  }
  // 初始化角落（默认右下）
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
  const chkNt = document.getElementById('bn-copy-notify');
  const chkHo = document.getElementById('bn-hide-orig');
  const copyOpts = document.getElementById('bn-copy-options');

  const chkMenu = document.getElementById('bn-enable-user-menu');
  const chkPlan = document.getElementById('bn-enable-plan');
  const planOpts = document.getElementById('bn-plan-options');
  const chkPlanAuto = document.getElementById('bn-plan-auto');
  const chkUseColor = document.getElementById('bn-use-custom-color');
  const themeSelect = document.getElementById('bn-theme-select');

  const colorSidebar = document.getElementById('bn-color-sidebar');
  const saveActions = document.getElementById('bn-save-actions');
  const chkVj = document.getElementById('bn-enable-vj');
  const chkHideDoneSkip = document.getElementById('bn-hide-done-skip');

  const colorPickers = {};
  const hexInputs = {};

  const originalConfig = {
    titleTruncate: isFinite(maxTitleUnits),
    userTruncate: isFinite(maxUserUnits),
    maxTitleUnits,
    maxUserUnits,
    hideAvatar,
    enableCopy,
    copyNotify,
    hideOrig,
    enableMenu,
    enablePlanAdder,
    autoExit: initialAutoExit,
    useCustomColors,
    palette: Object.assign({}, palette),
    enableVjLink,
    hideDoneSkip,
    widthMode,
    themeMode
  };

  /* ----------------------------------------------------------------
   *  4) 固定/显示逻辑
   * ---------------------------------------------------------------- */
  pinBtn.classList.toggle('bn-pinned', pinned);
  if (pinned) {
    panel.classList.add('bn-show');
    container.style.pointerEvents = 'auto';
  }

  titleOpts.style.display = originalConfig.titleTruncate ? 'block' : 'none';
  userOpts.style.display = originalConfig.userTruncate ? 'block' : 'none';
  copyOpts.style.display = originalConfig.enableCopy ? 'block' : 'none';
  planOpts.style.display = originalConfig.enablePlanAdder ? 'block' : 'none';

  // 初始化颜色选择器
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

  // 初始化颜色面板状态
  if (useCustomColors) {
    container.classList.add('bn-expanded');
    panel.classList.add('bn-expanded');
    colorSidebar.classList.add('bn-show');
  }

  // 主题选择
  themeSelect.onchange = () => {
    const v = themeSelect.value;
    if (v === 'dark') container.classList.add('bn-dark');
    else if (v === 'light') container.classList.remove('bn-dark');
    else { // auto
      prefersDark ? container.classList.add('bn-dark') : container.classList.remove('bn-dark');
    }
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
  // === 可拖拽齿轮（100ms 滞后跟随）===
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

  /* ----------------------------------------------------------------
   *  5) 工具 & 变更检测
   * ---------------------------------------------------------------- */
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
      (document.getElementById('bn-copy-notify').checked !== originalConfig.copyNotify) ||
      (document.getElementById('bn-hide-orig').checked !== originalConfig.hideOrig) ||
      (document.getElementById('bn-enable-user-menu').checked !== originalConfig.enableMenu) ||
      (document.getElementById('bn-enable-plan').checked !== originalConfig.enablePlanAdder) ||
      (document.getElementById('bn-enable-vj').checked !== originalConfig.enableVjLink) ||
      (document.getElementById('bn-hide-done-skip').checked !== originalConfig.hideDoneSkip) ||
      (document.getElementById('bn-plan-auto').checked !== originalConfig.autoExit) ||
      (document.getElementById('bn-use-custom-color').checked !== originalConfig.useCustomColors) ||
      (document.getElementById('bn-width-mode').value !== originalConfig.widthMode) ||
      (document.getElementById('bn-theme-select').value !== originalConfig.themeMode) ||
      paletteChanged;

    // 改为“透明度显隐”，避免布局跳变
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
  chkCp.onchange = () => { toggleOption(chkCp, copyOpts); checkChanged(); };
  chkNt.onchange = checkChanged;
  chkHo.onchange = checkChanged;
  chkMenu.onchange = checkChanged;
  chkVj.onchange = checkChanged;
  chkHideDoneSkip.onchange = () => { applyHideDoneSkip(chkHideDoneSkip.checked); checkChanged(); };
  chkPlan.onchange = () => { toggleOption(chkPlan, planOpts); checkChanged(); };
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
    // 保存截断
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

    // 显示 & 复制 & 菜单 & 计划
    GM_setValue('hideAvatar', chkAv.checked);
    GM_setValue('enableCopy', chkCp.checked);
    GM_setValue('copyNotify', chkNt.checked);
    GM_setValue('hideOrig', chkHo.checked);
    GM_setValue('hideDoneSkip', chkHideDoneSkip.checked);
    GM_setValue('enableUserMenu', chkMenu.checked);
    GM_setValue('enableVjLink', chkVj.checked);
    GM_setValue('enablePlanAdder', chkPlan.checked);
    GM_setValue('planAdder.autoExit', chkPlanAuto.checked);
    autoExit = chkPlanAuto.checked;

    // 主题
    GM_setValue(THEME_KEY, themeSelect.value);

    // 颜色
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
    chkNt.checked = originalConfig.copyNotify;
    chkHo.checked = originalConfig.hideOrig;
    chkMenu.checked = originalConfig.enableMenu;
    chkVj.checked = originalConfig.enableVjLink;
    chkHideDoneSkip.checked = originalConfig.hideDoneSkip;
    applyHideDoneSkip(originalConfig.hideDoneSkip);
    chkPlan.checked = originalConfig.enablePlanAdder;
    chkPlanAuto.checked = originalConfig.autoExit;
    autoExit = originalConfig.autoExit;
    chkUseColor.checked = originalConfig.useCustomColors;
    themeSelect.value = originalConfig.themeMode;

    titleOpts.style.display = chkTitleTrEl.checked ? 'block' : 'none';
    userOpts.style.display = chkUserTrEl.checked ? 'block' : 'none';
    copyOpts.style.display = chkCp.checked ? 'block' : 'none';
    planOpts.style.display = chkPlan.checked ? 'block' : 'none';

    // 主题还原
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

  /* ----------------------------------------------------------------
   *  6) 截断与图标
   * ---------------------------------------------------------------- */
  function unitOfCharByMode(codePoint, mode) {
    if (mode === 'char') return 1;
    if (mode === 'visual') return codePoint > 255 ? 2 : 1;
    // UTF-8 字节数近似（严格：<=0x7F:1, <=0x7FF:2, <=0xFFFF:3, 其它:4）
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
  /* ----------------------------------------------------------------
   *  7) 数据（用户）
   * ---------------------------------------------------------------- */
  const users = {
    1: { name: "陈许旻", colorKey: "tch" },
    2: { name: "唐子杰", colorKey: "tch" },
    3: { name: "杨智涵", colorKey: "tch" },
    4: { name: "杨智涵", colorKey: "upp2" },
    5: { name: "蔡家翔", colorKey: "upp3" },
    6: { name: "邵逸宸", colorKey: "upp6" },
    7: { name: "徐子涵", colorKey: "upp2" },
    8: { name: "周岳安慧", colorKey: "tch" },
    9: { name: "李彦铮", colorKey: "upp2" },
    10: { name: "周徐吉", colorKey: "upp3" },
    11: { name: "何骐玮", colorKey: "upp1" },
    12: { name: "张语桐", colorKey: "upp3" },
    13: { name: "胡轩宁", colorKey: "upp2" },
    14: { name: "罗翰昭", colorKey: "upp2" },
    15: { name: "黄嘉玮", colorKey: "upp2" },
    16: { name: "刘彻", colorKey: "upp2" },
    17: { name: "梁佳俊", colorKey: "upp1" },
    18: { name: "黄诗哲", colorKey: "upp1" },
    19: { name: "刘承兴", colorKey: "tch" },
    20: { name: "书承", colorKey: "tch" },
    21: { name: "雷诣桁", colorKey: "upp2" },
    22: { name: "冯思韬", colorKey: "upp2" },
    23: { name: "黄皓坤", colorKey: "upp2" },
    24: { name: "张宗耀", colorKey: "upp2" },
    25: { name: "苏子洲", colorKey: "upp2" },
    26: { name: "陈砚博", colorKey: "tch" },
    27: { name: "陈俊懿", colorKey: "upp2" },
    28: { name: "刘晋亨", colorKey: "upp1" },
    29: { name: "彭俣哲", colorKey: "tch" },
    30: { name: "宗天傲", colorKey: "upp2" },
    31: { name: "李至擎", colorKey: "tch" },
    32: { name: "张庭豪", colorKey: "tch" },
    33: { name: "王翎熹", colorKey: "tch" },
    34: { name: "李弩翰", colorKey: "upp2" },
    35: { name: "周鸿博", colorKey: "upp2" },
    36: { name: "张芮嘉", colorKey: "upp2" },
    37: { name: "朱懿韬", colorKey: "upp2" },
    38: { name: "陈邹睿洋", colorKey: "tch" },
    39: { name: "林轩宇", colorKey: "upp2" },
    40: { name: "陈邹睿洋", colorKey: "upp2" },
    41: { name: "张迦尧", colorKey: "upp2" },
    42: { name: "鞠子淇", colorKey: "upp2" },
    43: { name: "彭俣哲", colorKey: "upp2" },
    44: { name: "熊鹭飏", colorKey: "upp2" },
    45: { name: "梁家瑞", colorKey: "upp2" },
    46: { name: "谢奥升", colorKey: "upp2" },
    47: { name: "谭轶丹", colorKey: "upp2" },
    48: { name: "赵思哲", colorKey: "upp2" },
    49: { name: "徐若宸", colorKey: "upp2" },
    50: { name: "唐梓棋", colorKey: "upp2" },
    51: { name: "鹿露", colorKey: "upp1" },
    52: { name: "温骐睿", colorKey: "upp3" },
    53: { name: "谭尚贤", colorKey: "upp2" },
    54: { name: "陈科岐", colorKey: "upp2" },
    55: { name: "张宸瑞", colorKey: "upp2" },
    56: { name: "纪博勋", colorKey: "upp2" },
    57: { name: "董穆朗", colorKey: "upp2" },
    58: { name: "叶孟洋", colorKey: "upp2" },
    59: { name: "谢明睿", colorKey: "upp2" },
    60: { name: "刘彦辰", colorKey: "upp2" },
    61: { name: "胡盛文", colorKey: "upp2" },
    62: { name: "郑淇元", colorKey: "upp2" },
    63: { name: "任冠宇", colorKey: "upp2" },
    64: { name: "张文灏", colorKey: "upp2" },
    65: { name: "邵逸宸", colorKey: "upp1" },
    66: { name: "杨坤翰", colorKey: "upp2" },
    67: { name: "杨浩诚", colorKey: "upp1" },
    68: { name: "赵天行", colorKey: "upp2" },
    69: { name: "侯翔文", colorKey: "upp2" },
    70: { name: "丁雍柯", colorKey: "upp2" },
    71: { name: "母梓言", colorKey: "upp1" },
    72: { name: "叶淏然", colorKey: "upp1" },
    73: { name: "管公尧", colorKey: "upp1" },
    74: { name: "林川石", colorKey: "upp1" },
    75: { name: "徐菡", colorKey: "upp1" },
    76: { name: "杜雨珅", colorKey: "upp2" },
    77: { name: "张力玺", colorKey: "upp3" },
    78: { name: "严宏玮", colorKey: "upp4" },
    79: { name: "服务器", colorKey: "tch" },
    80: { name: "陆籽澄", colorKey: "upp2" },
    81: { name: "杨金强", colorKey: "tch" },
    82: { name: "赖柯宇", colorKey: "upp2" },
    83: { name: "任净月", colorKey: "upp3" },
    84: { name: "侯方圆", colorKey: "upp1" },
    85: { name: "程宇轩", colorKey: "tch" },
    86: { name: "徐向东", colorKey: "upp5" },
    87: { name: "王嵩睿", colorKey: "upp5" },
    88: { name: "姜云华", colorKey: "upp5" },
    89: { name: "张旭睿", colorKey: "upp5" },
    90: { name: "王星宁", colorKey: "upp5" },
    91: { name: "吴清扬", colorKey: "upp5" },
    92: { name: "陈琢", colorKey: "upp5" },
    93: { name: "黄兰乔", colorKey: "upp5" },
    94: { name: "蔡清硕", colorKey: "upp5" },
    95: { name: "文军", colorKey: "upp5" },
    96: { name: "熊禹轩", colorKey: "upp5" },
    97: { name: "袁科键", colorKey: "upp5" },
    98: { name: "何秋洋", colorKey: "upp5" },
    99: { name: "杨可", colorKey: "upp6" },
    100: { name: "郑发伟", colorKey: "upp6" },
    101: { name: "钟欣瑞", colorKey: "upp6" },
    102: { name: "李佳龙", colorKey: "upp6" },
    103: { name: "葛嘉铭", colorKey: "upp6" },
    104: { name: "郑乔月", colorKey: "upp6" },
    105: { name: "胡瑞李臻", colorKey: "upp6" },
    106: { name: "夏兴宇", colorKey: "upp6" },
    107: { name: "吴振喆", colorKey: "upp6" },
    108: { name: "穆云瑞", colorKey: "upp6" },
    109: { name: "袁世豪", colorKey: "upp3" },
    110: { name: "张翔宇", colorKey: "upp3" },
    111: { name: "陈佳豪", colorKey: "upp3" },
    112: { name: "陈明远", colorKey: "upp3" },
    113: { name: "李思雨", colorKey: "upp3" },
    114: { name: "项雨源", colorKey: "upp3" },
    115: { name: "张志豪", colorKey: "upp3" },
    116: { name: "冉宇峰", colorKey: "upp3" },
    117: { name: "张希皓", colorKey: "upp3" },
    118: { name: "姜义都", colorKey: "upp3" },
    119: { name: "王小波", colorKey: "tch" },
    120: { name: "肖镜东", colorKey: "upp4" },
    121: { name: "杨智伟", colorKey: "upp5" },
    122: { name: "严成林", colorKey: "tch" },
    123: { name: "杨艾忱", colorKey: "upp2" },
    124: { name: "骆洋溢", colorKey: "upp2" },
    125: { name: "何欣静", colorKey: "upp1" },
    126: { name: "杨一诺", colorKey: "upp3" },
    127: { name: "邓响", colorKey: "upp2" },
    128: { name: "曾国恒", colorKey: "upp1" },
    129: { name: "萧皓文", colorKey: "upp2" },
    130: { name: "李彦岑", colorKey: "is" },
    131: { name: "张祝仲谋", colorKey: "upp2" },
    132: { name: "邓融阔", colorKey: "upp1" },
    133: { name: "邓歆瀚", colorKey: "upp2" },
    134: { name: "刘皓伦", colorKey: "upp2" },
    135: { name: "彭博", colorKey: "is" },
    136: { name: "何宜川", colorKey: "upp2" },
    137: { name: "兰洪玮", colorKey: "is" },
    138: { name: "张恩敬", colorKey: "upp1" },
    139: { name: "刘思源", colorKey: "upp4" },
    140: { name: "彭奕力", colorKey: "low1" },
    141: { name: "蒋璐阳", colorKey: "upp2" },
    142: { name: "潘轩宇", colorKey: "is" },
    143: { name: "张卓然", colorKey: "upp3" },
    144: { name: "张蓝心", colorKey: "upp1" },
    145: { name: "罗斯汀", colorKey: "upp6" },
    146: { name: "蔡昊洋", colorKey: "upp6" },
    147: { name: "侯智航", colorKey: "upp6" },
    148: { name: "廖思齐", colorKey: "upp6" },
    149: { name: "胡星池", colorKey: "upp6" },
    150: { name: "李坤洋", colorKey: "upp6" },
    151: { name: "程书涵", colorKey: "upp5" },
    152: { name: "马平川", colorKey: "upp5" },
    153: { name: "李美琳", colorKey: "tch" },
    154: { name: "龙贵全", colorKey: "upp5" },
    155: { name: "李阳", colorKey: "upp5" },
    156: { name: "薛振鹏", colorKey: "upp5" },
    157: { name: "刘佳艳", colorKey: "upp5" },
    158: { name: "李万博", colorKey: "upp5" },
    159: { name: "徐砺寒", colorKey: "upp5" },
    160: { name: "李思哲", colorKey: "upp5" },
    161: { name: "徐若瑜", colorKey: "upp5" },
    162: { name: "韩恩鲜", colorKey: "upp5" },
    163: { name: "杨依芮", colorKey: "upp5" },
    164: { name: "秦北辰", colorKey: "upp5" },
    165: { name: "古康圆", colorKey: "upp5" },
    166: { name: "王梓淇", colorKey: "upp5" },
    167: { name: "周子瑜", colorKey: "upp5" },
    168: { name: "陈霁兮", colorKey: "upp5" },
    169: { name: "戴金杨", colorKey: "upp5" },
    170: { name: "王子仪", colorKey: "upp5" },
    171: { name: "周潍可", colorKey: "upp5" },
    172: { name: "王希贤", colorKey: "upp5" },
    173: { name: "缪言", colorKey: "upp5" },
    174: { name: "石鹏屹", colorKey: "upp5" },
    175: { name: "曾浩桐", colorKey: "upp2" },
    176: { name: "侯栎晗", colorKey: "upp2" },
    177: { name: "熊梓贤", colorKey: "upp1" },
    178: { name: "李禹衡", colorKey: "upp1" },
    179: { name: "文子蕴", colorKey: "upp3" },
    180: { name: "娄运筹", colorKey: "upp5" },
    181: { name: "彭彦熙", colorKey: "upp3" },
    182: { name: "李九汝", colorKey: "upp1" },
    183: { name: "刘昊昕", colorKey: "tch" },
    184: { name: "王小波", colorKey: "tch" },
    185: { name: "孙瑞国", colorKey: "upp4" },
    186: { name: "曾子恒", colorKey: "upp1" },
    187: { name: "李济同", colorKey: "upp3" },
    188: { name: "周贤德", colorKey: "upp1" },
    189: { name: "李宇春", colorKey: "tch" },
    190: { name: "方元", colorKey: "tch" },
    191: { name: "雷宇", colorKey: "upp5" },
    192: { name: "邹潘", colorKey: "upp5" },
    193: { name: "何振龙", colorKey: "tch" },
    194: { name: "薛阳", colorKey: "tch" },
    195: { name: "储一帆", colorKey: "tch" },
    196: { name: "陈立果", colorKey: "tch" },
    197: { name: "王子周", colorKey: "upp2" },
    198: { name: "段老师", colorKey: "tch" },
    199: { name: "赖老师", colorKey: "tch" },
    200: { name: "江宇粟", colorKey: "upp1" },
    201: { name: "韦言", colorKey: "upp1" },
    202: { name: "高维劭", colorKey: "upp1" },
    203: { name: "周静远", colorKey: "is" },
    204: { name: "荣程", colorKey: "upp2" },
    205: { name: "测试", colorKey: "tch" },
    206: { name: "任翼君", colorKey: "upp1" },
    207: { name: "郭又嘉", colorKey: "upp1" },
    208: { name: "刘雨泽", colorKey: "upp1" },
    209: { name: "石若水", colorKey: "upp1" },
    210: { name: "叶军", colorKey: "upp2" },
    211: { name: "姜仕文", colorKey: "upp2" },
    212: { name: "曲峻泽", colorKey: "upp2" },
    213: { name: "王彦儒", colorKey: "upp2" },
    214: { name: "吕明慷", colorKey: "upp2" },
    215: { name: "吴俊达", colorKey: "upp2" },
    216: { name: "周嘉熙", colorKey: "upp2" },
    217: { name: "曹新鑫", colorKey: "upp2" },
    218: { name: "张芮宁", colorKey: "upp2" },
    219: { name: "刘涵靖", colorKey: "upp2" },
    220: { name: "董峻宾", colorKey: "upp2" },
    221: { name: "冯子健", colorKey: "upp2" },
    222: { name: "杨晖尊", colorKey: "upp2" },
    223: { name: "董艺蕾", colorKey: "upp2" },
    224: { name: "王浩宇", colorKey: "upp2" },
    225: { name: "乔博文", colorKey: "upp2" },
    226: { name: "王奥钰", colorKey: "upp2" },
    227: { name: "高子铭", colorKey: "upp2" },
    228: { name: "李君昊", colorKey: "upp2" },
    229: { name: "李丙椿", colorKey: "upp2" },
    230: { name: "李知航", colorKey: "upp2" },
    231: { name: "张笑晴", colorKey: "upp2" },
    232: { name: "岳金泽", colorKey: "upp2" },
    233: { name: "路程锦", colorKey: "upp2" },
    234: { name: "王昭然", colorKey: "upp2" },
    235: { name: "宋潮", colorKey: "upp2" },
    236: { name: "张笑安别抄了", colorKey: "upp2" },
    237: { name: "鞠明轩", colorKey: "upp2" },
    238: { name: "邓博航", colorKey: "upp2" },
    239: { name: "韩霄杨", colorKey: "upp2" },
    240: { name: "李天宇", colorKey: "upp2" },
    241: { name: "郭衍泽", colorKey: "upp2" },
    242: { name: "姜棣瀚", colorKey: "upp2" },
    243: { name: "张金峻", colorKey: "upp2" },
    244: { name: "毛泽福", colorKey: "upp2" },
    245: { name: "高天", colorKey: "upp2" },
    246: { name: "林柏润", colorKey: "upp2" },
    247: { name: "张含硕", colorKey: "upp2" },
    248: { name: "董佳凝", colorKey: "upp2" },
    249: { name: "吕宗朴", colorKey: "upp2" },
    250: { name: "孙哲文", colorKey: "upp2" },
    251: { name: "马德燊", colorKey: "upp2" },
    252: { name: "王靖予", colorKey: "upp2" },
    253: { name: "赵一诺", colorKey: "upp2" },
    254: { name: "侯伊曼", colorKey: "upp2" },
    255: { name: "陈志宏", colorKey: "upp2" },
    256: { name: "杨云帆", colorKey: "upp2" },
    257: { name: "郭丁荣", colorKey: "upp2" },
    258: { name: "侯杰瑞", colorKey: "upp2" },
    259: { name: "张绮涵", colorKey: "upp2" },
    260: { name: "侯杰瑞", colorKey: "upp2" },
    261: { name: "张博涵", colorKey: "upp2" },
    262: { name: "孙铭宏", colorKey: "upp2" },
    263: { name: "范晓藤", colorKey: "upp2" },
    264: { name: "马名泽", colorKey: "upp2" },
    265: { name: "袁天泽", colorKey: "upp2" },
    266: { name: "王婕鑫", colorKey: "upp2" },
    267: { name: "卢本伟", colorKey: "upp2" },
    268: { name: "邱超凡", colorKey: "upp2" },
    269: { name: "王彦儒", colorKey: "upp2" },
    270: { name: "韩沙沙", colorKey: "upp2" },
    271: { name: "王飞", colorKey: "upp2" },
    272: { name: "刘一鸣", colorKey: "upp2" },
    273: { name: "王耀弘", colorKey: "upp2" },
    274: { name: "张海宇", colorKey: "upp2" },
    275: { name: "张瑞熙", colorKey: "upp2" },
    276: { name: "赵浩辰", colorKey: "upp2" },
    277: { name: "陈振", colorKey: "upp2" },
    278: { name: "程佳韵", colorKey: "upp2" },
    279: { name: "路昕瑞", colorKey: "upp2" },
    280: { name: "王洪波", colorKey: "upp2" },
    281: { name: "王佳烨", colorKey: "upp2" },
    282: { name: "刘力文", colorKey: "upp2" },
    283: { name: "姜刘子硕", colorKey: "upp2" },
    284: { name: "李岩", colorKey: "upp2" },
    285: { name: "仝博文", colorKey: "upp2" },
    286: { name: "张含硕", colorKey: "upp2" },
    287: { name: "马德燊", colorKey: "upp2" },
    288: { name: "王思涵", colorKey: "upp2" },
    289: { name: "张莉", colorKey: "upp2" },
    290: { name: "邓博航", colorKey: "upp2" },
    291: { name: "范子瑜", colorKey: "upp2" },
    292: { name: "马凯瑞", colorKey: "upp2" },
    293: { name: "殷延隆", colorKey: "upp2" },
    294: { name: "孙钰坤", colorKey: "upp2" },
    295: { name: "孙研淳", colorKey: "upp2" },
    296: { name: "赵昊祺", colorKey: "upp2" },
    297: { name: "封婉萍", colorKey: "upp2" },
    298: { name: "王思齐", colorKey: "upp2" },
    299: { name: "王荣森", colorKey: "upp2" },
    300: { name: "李楷瑞", colorKey: "upp2" },
    301: { name: "王茜瑶", colorKey: "upp2" },
    302: { name: "黄秋垚", colorKey: "upp2" },
    303: { name: "舒承喆", colorKey: "upp2" },
    304: { name: "高宇阳", colorKey: "upp2" },
    305: { name: "蔡铭浩", colorKey: "upp2" },
    306: { name: "张闻雨", colorKey: "upp2" },
    307: { name: "李天瑞", colorKey: "upp2" },
    308: { name: "韩奕晨", colorKey: "upp2" },
    309: { name: "刘科力", colorKey: "upp2" },
    310: { name: "何柏霄", colorKey: "upp2" },
    311: { name: "王子宸", colorKey: "upp2" },
    312: { name: "杨恩泽", colorKey: "upp2" },
    313: { name: "龙鹏旭", colorKey: "upp2" },
    314: { name: "孙士雅", colorKey: "upp2" },
    315: { name: "顾子涵", colorKey: "upp2" },
    316: { name: "隆君昊", colorKey: "upp2" },
    317: { name: "王智永", colorKey: "upp2" },
    318: { name: "高林凡", colorKey: "upp2" },
    319: { name: "王永发", colorKey: "upp2" },
    320: { name: "周昊宇", colorKey: "upp2" },
    321: { name: "丁星瑜", colorKey: "upp2" },
    322: { name: "朱天", colorKey: "upp2" },
    323: { name: "王雨晗", colorKey: "upp2" },
    324: { name: "边珈瑞", colorKey: "upp2" },
    325: { name: "朱奕璇", colorKey: "upp2" },
    326: { name: "方毅刚", colorKey: "upp2" },
    327: { name: "俎梓瑞", colorKey: "upp2" },
    328: { name: "姚泽峰", colorKey: "upp2" },
    329: { name: "于子涵", colorKey: "upp2" },
    330: { name: "王淇", colorKey: "upp2" },
    331: { name: "鲁延文", colorKey: "upp2" },
    332: { name: "杨昕桐", colorKey: "upp2" },
    333: { name: "钟延宸", colorKey: "upp2" },
    334: { name: "牟俊如", colorKey: "upp2" },
    335: { name: "韩政", colorKey: "upp2" },
    336: { name: "樊骜川", colorKey: "upp2" },
    337: { name: "张宸溪", colorKey: "upp2" },
    338: { name: "王佳林", colorKey: "upp2" },
    339: { name: "赵笑宇", colorKey: "upp2" },
    340: { name: "高一鸣", colorKey: "upp2" },
    341: { name: "赵文博", colorKey: "upp2" },
    342: { name: "石晏临", colorKey: "upp2" },
    343: { name: "王献迪", colorKey: "upp2" },
    344: { name: "刘依杨", colorKey: "upp2" },
    345: { name: "司洪凯", colorKey: "upp2" },
    346: { name: "李韶轩", colorKey: "upp2" },
    347: { name: "张琦", colorKey: "upp2" },
    348: { name: "刘子涵", colorKey: "upp2" },
    349: { name: "王晓琳略略略", colorKey: "upp2" },
    350: { name: "王琪略略略", colorKey: "upp2" },
    351: { name: "高宁", colorKey: "upp2" },
    352: { name: "田润泽", colorKey: "upp2" },
    353: { name: "杨文玉略略略", colorKey: "upp2" },
    354: { name: "周晓冉", colorKey: "upp2" },
    355: { name: "李金融", colorKey: "upp2" },
    356: { name: "蒋会辰", colorKey: "upp2" },
    357: { name: "程文珂", colorKey: "upp2" },
    358: { name: "常家赫", colorKey: "upp2" },
    359: { name: "贾宏璨", colorKey: "upp2" },
    360: { name: "温超", colorKey: "upp2" },
    361: { name: "王子晨", colorKey: "upp2" },
    362: { name: "吴波", colorKey: "upp2" },
    363: { name: "王嘉怡", colorKey: "upp2" },
    364: { name: "李奕涵", colorKey: "upp2" },
    365: { name: "徐梓航", colorKey: "upp2" },
    366: { name: "高雨嘉", colorKey: "upp2" },
    367: { name: "王宁", colorKey: "upp2" },
    368: { name: "刘华瑞", colorKey: "upp2" },
    369: { name: "张莉略略略", colorKey: "upp2" },
    370: { name: "张茹月", colorKey: "upp2" },
    371: { name: "边金凯略略略", colorKey: "upp2" },
    372: { name: "孙咏政", colorKey: "upp2" },
    373: { name: "李泓睿", colorKey: "upp2" },
    374: { name: "张志强略略略", colorKey: "upp2" },
    375: { name: "刘天怡", colorKey: "upp2" },
    376: { name: "蔡明欣", colorKey: "upp2" },
    377: { name: "宫恪勉", colorKey: "upp2" },
    378: { name: "王钰泽", colorKey: "upp2" },
    379: { name: "王敏哲", colorKey: "upp2" },
    380: { name: "孙永艳略略略", colorKey: "upp2" },
    381: { name: "房冠睿", colorKey: "upp2" },
    382: { name: "温家乐", colorKey: "upp2" },
    383: { name: "尚文迪", colorKey: "upp2" },
    384: { name: "温晓晨", colorKey: "upp2" },
    385: { name: "杨兆冉", colorKey: "upp2" },
    386: { name: "熊锦瑞", colorKey: "upp2" },
    387: { name: "刘柏郡", colorKey: "upp2" },
    388: { name: "郑丽梦", colorKey: "upp2" },
    389: { name: "祁皓田", colorKey: "upp2" },
    390: { name: "刘文静", colorKey: "upp2" },
    391: { name: "王泽川", colorKey: "upp2" },
    392: { name: "贾博淼", colorKey: "upp2" },
    393: { name: "史润轩", colorKey: "upp2" },
    394: { name: "王鹏宇", colorKey: "upp2" },
    395: { name: "宁尚哲别抄了", colorKey: "upp2" },
    396: { name: "刘晓冬", colorKey: "upp2" },
    397: { name: "辛伟宸", colorKey: "upp2" },
    398: { name: "靳博涵", colorKey: "upp2" },
    399: { name: "宁欣悦", colorKey: "upp2" },
    400: { name: "王海璐", colorKey: "upp2" },
    401: { name: "高文昊", colorKey: "upp2" },
    402: { name: "王玲", colorKey: "upp2" },
    403: { name: "张家璘", colorKey: "upp2" },
    404: { name: "王雨晗", colorKey: "upp2" },
    405: { name: "管建航", colorKey: "upp2" },
    406: { name: "迟向阳", colorKey: "upp2" },
    407: { name: "李学蕙", colorKey: "upp2" },
    408: { name: "楚然", colorKey: "upp2" },
    409: { name: "温兆续", colorKey: "upp2" },
    410: { name: "孙浩诚", colorKey: "upp2" },
    411: { name: "李雨泽", colorKey: "upp2" },
    412: { name: "王笑航", colorKey: "upp2" },
    413: { name: "宋科辛", colorKey: "upp2" },
    414: { name: "温新彬", colorKey: "upp2" },
    415: { name: "刘建亿", colorKey: "upp2" },
    416: { name: "董艳", colorKey: "upp2" },
    417: { name: "孙梦瑞", colorKey: "upp2" },
    418: { name: "李文雅", colorKey: "upp2" },
    419: { name: "吕宗朴", colorKey: "upp2" },
    420: { name: "徐梦熠", colorKey: "upp2" },
    421: { name: "孟睿婕", colorKey: "upp2" },
    422: { name: "张懿可", colorKey: "upp2" },
    423: { name: "翟骐骏", colorKey: "upp2" },
    424: { name: "李玟慧", colorKey: "upp2" },
    425: { name: "张雨泽", colorKey: "upp2" },
    426: { name: "张莉", colorKey: "upp2" },
    427: { name: "田昕宴", colorKey: "upp2" },
    428: { name: "张金峻", colorKey: "upp2" },
    429: { name: "贺延青", colorKey: "upp2" },
    430: { name: "?", colorKey: "upp2" },
    431: { name: "梁兴璞", colorKey: "upp2" },
    432: { name: "高瞻航", colorKey: "upp2" },
    433: { name: "薛新波", colorKey: "upp2" },
    434: { name: "志明", colorKey: "upp2" },
    435: { name: "何炎堃", colorKey: "upp2" },
    436: { name: "李浩然", colorKey: "upp2" },
    437: { name: "刘欣琪", colorKey: "upp2" },
    438: { name: "刘震", colorKey: "upp2" },
    439: { name: "姚家泽", colorKey: "upp2" },
    440: { name: "徐赫徽", colorKey: "upp2" },
    441: { name: "代睿", colorKey: "upp2" },
    442: { name: "李胤诚", colorKey: "upp2" },
    443: { name: "李垚嘉", colorKey: "upp2" },
    444: { name: "陈泽予", colorKey: "upp2" },
    445: { name: "何一鸣", colorKey: "upp2" },
    446: { name: "王伟力", colorKey: "upp2" },
    447: { name: "孙嘉宇", colorKey: "upp2" },
    448: { name: "刘畅", colorKey: "upp2" },
    449: { name: "仲宇航", colorKey: "upp2" },
    450: { name: "邓亦珊", colorKey: "upp2" },
    451: { name: "徐博魏", colorKey: "upp2" },
    452: { name: "陈睿", colorKey: "upp2" },
    453: { name: "李恺文", colorKey: "upp2" },
    454: { name: "赵鹏博", colorKey: "upp2" },
    455: { name: "亚一鸣", colorKey: "upp2" },
    456: { name: "贺云飞", colorKey: "upp2" },
    457: { name: "袁纳海", colorKey: "upp2" },
    458: { name: "张海笑", colorKey: "upp2" },
    459: { name: "杜宇丰", colorKey: "upp2" },
    460: { name: "罗煜程", colorKey: "upp1" },
    461: { name: "韩俊潇", colorKey: "upp2" },
    462: { name: "韩靖坤", colorKey: "upp2" },
    463: { name: "张嘉鑫", colorKey: "upp2" },
    464: { name: "高佳棋", colorKey: "upp2" },
    465: { name: "杨素倩", colorKey: "upp2" },
    466: { name: "李路岩", colorKey: "upp2" },
    467: { name: "王晓涵", colorKey: "upp2" },
    468: { name: "张旭", colorKey: "upp2" },
    469: { name: "宫恪勉", colorKey: "upp2" },
    470: { name: "张立婷", colorKey: "upp2" },
    471: { name: "张欣诺", colorKey: "upp2" },
    472: { name: "温雅琪", colorKey: "upp2" },
    473: { name: "张裕奇", colorKey: "upp2" },
    474: { name: "辛姗姗", colorKey: "upp2" },
    475: { name: "翟文浩", colorKey: "upp2" },
    476: { name: "王浩宇", colorKey: "upp2" },
    477: { name: "张建平", colorKey: "upp2" },
    478: { name: "赵子木", colorKey: "upp2" },
    479: { name: "隆奇瑞", colorKey: "upp2" },
    480: { name: "王锦毅", colorKey: "upp2" },
    481: { name: "张孟锐", colorKey: "upp2" },
    482: { name: "李安妮", colorKey: "upp2" },
    483: { name: "张鸣宇", colorKey: "upp2" },
    484: { name: "樊曰阳", colorKey: "upp2" },
    485: { name: "庞云轩", colorKey: "upp2" },
    486: { name: "魏梓赫", colorKey: "upp2" },
    487: { name: "刘凯鑫", colorKey: "upp2" },
    488: { name: "王辉煌", colorKey: "upp2" },
    489: { name: "张寒露", colorKey: "upp2" },
    490: { name: "刘子涵", colorKey: "upp2" },
    491: { name: "孙敬航", colorKey: "upp2" },
    492: { name: "衣珈成", colorKey: "upp2" },
    493: { name: "都轶可", colorKey: "upp2" },
    494: { name: "平雨辰", colorKey: "upp2" },
    495: { name: "郭梓婕", colorKey: "upp2" },
    496: { name: "李虹毅", colorKey: "upp2" },
    497: { name: "刘承轩", colorKey: "upp2" },
    498: { name: "王钰梁", colorKey: "upp2" },
    499: { name: "孙宇泽", colorKey: "upp2" },
    500: { name: "安洋", colorKey: "upp2" },
    501: { name: "张博儒", colorKey: "upp2" },
    502: { name: "赵鹏煊", colorKey: "upp2" },
    503: { name: "温锦钰", colorKey: "upp2" },
    504: { name: "高翊皓", colorKey: "upp2" },
    505: { name: "刘诗泽", colorKey: "upp2" },
    506: { name: "朱天宁", colorKey: "upp2" },
    507: { name: "郭静霏", colorKey: "upp2" },
    508: { name: "杨文悦", colorKey: "upp2" },
    509: { name: "刘子阳", colorKey: "upp2" },
    510: { name: "韩俊潇", colorKey: "upp2" },
    511: { name: "韩靖坤", colorKey: "upp2" },
    512: { name: "张嘉鑫", colorKey: "upp2" },
    513: { name: "高佳棋", colorKey: "upp2" },
    514: { name: "杨素倩", colorKey: "upp2" },
    515: { name: "李路岩", colorKey: "upp2" },
    516: { name: "王晓涵", colorKey: "upp2" },
    517: { name: "张旭", colorKey: "upp2" },
    518: { name: "宫恪勉", colorKey: "upp2" },
    519: { name: "张立婷", colorKey: "upp2" },
    520: { name: "张欣诺", colorKey: "upp2" },
    521: { name: "温雅琪", colorKey: "upp2" },
    522: { name: "张裕奇", colorKey: "upp2" },
    523: { name: "辛姗姗", colorKey: "upp2" },
    524: { name: "翟文浩", colorKey: "upp2" },
    525: { name: "王浩宇", colorKey: "upp2" },
    526: { name: "张建平", colorKey: "upp2" },
    527: { name: "赵子木", colorKey: "upp2" },
    528: { name: "隆奇瑞", colorKey: "upp2" },
    529: { name: "王锦毅", colorKey: "upp2" },
    530: { name: "张孟锐", colorKey: "upp2" },
    531: { name: "李安妮", colorKey: "upp2" },
    532: { name: "张鸣宇", colorKey: "upp2" },
    533: { name: "樊曰阳", colorKey: "upp2" },
    534: { name: "庞云轩", colorKey: "upp2" },
    535: { name: "魏梓赫", colorKey: "upp2" },
    536: { name: "刘凯鑫", colorKey: "upp2" },
    537: { name: "王辉煌", colorKey: "upp2" },
    538: { name: "张寒露", colorKey: "upp2" },
    539: { name: "刘子涵", colorKey: "upp2" },
    540: { name: "孙敬航", colorKey: "upp2" },
    541: { name: "衣珈成", colorKey: "upp2" },
    542: { name: "都轶可", colorKey: "upp2" },
    543: { name: "平雨辰", colorKey: "upp2" },
    544: { name: "郭梓婕", colorKey: "upp2" },
    545: { name: "李虹毅", colorKey: "upp2" },
    546: { name: "刘承轩", colorKey: "upp2" },
    547: { name: "王钰梁", colorKey: "upp2" },
    548: { name: "孙宇泽", colorKey: "upp2" },
    549: { name: "安洋", colorKey: "upp2" },
    550: { name: "张博儒", colorKey: "upp2" },
    551: { name: "赵鹏煊", colorKey: "upp2" },
    552: { name: "温锦钰", colorKey: "upp2" },
    553: { name: "高翊皓", colorKey: "upp2" },
    554: { name: "刘诗泽", colorKey: "upp2" },
    555: { name: "朱天宁", colorKey: "upp2" },
    556: { name: "郭静霏", colorKey: "upp2" },
    557: { name: "杨文悦", colorKey: "upp2" },
    558: { name: "刘子阳", colorKey: "upp2" },
    559: { name: "叶军", colorKey: "upp2" },
    560: { name: "张建平", colorKey: "upp2" },
    561: { name: "张孟锐", colorKey: "upp2" },
    562: { name: "王一多", colorKey: "upp2" },
    563: { name: "吴晗", colorKey: "upp2" },
    564: { name: "樊曰阳", colorKey: "upp2" },
    565: { name: "鞠智博", colorKey: "upp2" },
    566: { name: "衣珈成", colorKey: "upp2" },
    567: { name: "杨云帆", colorKey: "upp2" },
    568: { name: "张芮宁", colorKey: "upp2" },
    569: { name: "李虹毅", colorKey: "upp2" },
    570: { name: "张轩睿", colorKey: "upp2" },
    571: { name: "孙华", colorKey: "upp2" },
    572: { name: "?", colorKey: "upp2" },
    573: { name: "张华", colorKey: "upp2" },
    574: { name: "李俞辰", colorKey: "upp2" },
    575: { name: "张丽美", colorKey: "upp2" },
    576: { name: "毛焓瑞", colorKey: "upp2" },
    577: { name: "黄万玉", colorKey: "upp2" },
    578: { name: "张海笑", colorKey: "upp2" },
    579: { name: "李恺文", colorKey: "upp2" },
    580: { name: "贺云飞", colorKey: "upp2" },
    581: { name: "孙劲松", colorKey: "upp2" },
    582: { name: "徐博巍", colorKey: "upp2" },
    583: { name: "陈睿", colorKey: "upp2" },
    584: { name: "南树康", colorKey: "upp2" },
    585: { name: "楚然", colorKey: "upp2" },
    586: { name: "谷冬宇", colorKey: "upp2" },
    587: { name: "李秀琪", colorKey: "upp2" },
    588: { name: "李旭尧", colorKey: "upp2" },
    589: { name: "宋鑫玥", colorKey: "upp2" },
    590: { name: "商晓婧", colorKey: "upp2" },
    591: { name: "孙雨桐", colorKey: "upp2" },
    592: { name: "张永", colorKey: "upp2" },
    593: { name: "任璟泽", colorKey: "upp2" },
    594: { name: "赵源博", colorKey: "upp2" },
    595: { name: "程峥", colorKey: "upp2" },
    596: { name: "宫德卿", colorKey: "upp2" },
    597: { name: "朱学平", colorKey: "upp2" },
    598: { name: "温晓晨", colorKey: "upp2" },
    599: { name: "张诺雅", colorKey: "upp2" },
    600: { name: "张宸赫", colorKey: "upp2" },
    601: { name: "许乐简", colorKey: "upp2" },
    602: { name: "黄禹博", colorKey: "upp2" },
    603: { name: "刘一鸣", colorKey: "upp2" },
    604: { name: "庄子文", colorKey: "upp2" },
    605: { name: "孙华", colorKey: "upp2" },
    606: { name: "黄万玉", colorKey: "upp2" },
    607: { name: "楚然", colorKey: "upp2" },
    608: { name: "刘欣琪", colorKey: "upp2" },
    609: { name: "马志涛", colorKey: "upp2" },
    610: { name: "王亚芳", colorKey: "upp2" },
    611: { name: "南兆杰", colorKey: "upp2" },
    612: { name: "郭一鸣", colorKey: "upp2" },
    613: { name: "谭鑫鑫", colorKey: "upp2" },
    614: { name: "张可心", colorKey: "upp2" },
    615: { name: "孙文秀", colorKey: "upp2" },
    616: { name: "李辉", colorKey: "upp2" },
    617: { name: "王宥鼎", colorKey: "upp2" },
    618: { name: "郑博元", colorKey: "upp2" },
    619: { name: "杨云帆", colorKey: "upp2" },
    620: { name: "詹语谦", colorKey: "upp1" },
    621: { name: "赵梓皓", colorKey: "upp1" },
    622: { name: "李昊阳", colorKey: "upp1" },
    623: { name: "李雨泽", colorKey: "upp1" },
    624: { name: "熊梓贤", colorKey: "upp1" },
    625: { name: "杨晋哲", colorKey: "upp3" },
    626: { name: "邱梓轩", colorKey: "upp1" },
    627: { name: "李昕乐", colorKey: "upp3" },
    628: { name: "曾子恒", colorKey: "upp1" },
    629: { name: "曹灿", colorKey: "upp1" },
    630: { name: "徐镱嘉", colorKey: "upp2" },
    631: { name: "孙鱼跃", colorKey: "upp1" },
    632: { name: "张徐璟", colorKey: "upp1" },
    633: { name: "嘉嘉妈", colorKey: "tch" },
    634: { name: "鲜博宇", colorKey: "upp3" },
    635: { name: "王文鼎", colorKey: "upp3" },
    636: { name: "杜星睿", colorKey: "upp1" },
    637: { name: "鲜星辰", colorKey: "upp1" },
    638: { name: "黄籽豪", colorKey: "upp1" },
    639: { name: "蒋雨成", colorKey: "upp1" },
    640: { name: "曾禹为", colorKey: "is" },
    641: { name: "周子杰", colorKey: "upp2" },
    642: { name: "徐冉", colorKey: "low1" },
    643: { name: "赵一哲", colorKey: "upp2" },
    644: { name: "曾禹为", colorKey: "is" },
    645: { name: "赖明宇", colorKey: "upp3" },
    646: { name: "张均豪", colorKey: "upp1" },
    647: { name: "张均豪", colorKey: "upp1" },
    648: { name: "呵呵哒", colorKey: "tch" },
    649: { name: "张之弥", colorKey: "tch" },
    650: { name: "李钰曦", colorKey: "upp4" },
    651: { name: "黄郅为", colorKey: "low1" },
    652: { name: "潘昱霖", colorKey: "low1" },
    653: { name: "张雨轲", colorKey: "low1" },
    654: { name: "罗涵哲", colorKey: "low1" },
    655: { name: "梁殿宸", colorKey: "low1" },
    656: { name: "李坤洋", colorKey: "is" },
    657: { name: "许晋瑄", colorKey: "is" },
    658: { name: "曾祥睿", colorKey: "is" },
    659: { name: "谭天辰", colorKey: "upp1" },
    660: { name: "袁启航", colorKey: "upp1" },
    661: { name: "国皓语", colorKey: "upp1" },
    662: { name: "陈思睿", colorKey: "upp1" },
    663: { name: "?", colorKey: "upp1" },
    664: { name: "张桐尧", colorKey: "upp1" },
    665: { name: "刘希成", colorKey: "tch" },
    666: { name: "张铭杰", colorKey: "upp1" },
    667: { name: "钟胡天翔", colorKey: "tch" },
    668: { name: "张子川", colorKey: "upp1" },
    669: { name: "苏世锋", colorKey: "upp1" },
    670: { name: "杨耘嘉", colorKey: "is" },
    671: { name: "漆小凡", colorKey: "low1" },
    672: { name: "王子涵", colorKey: "upp5" },
    673: { name: "丁德正", colorKey: "upp4" },
    674: { name: "康睿涵", colorKey: "upp3" },
    675: { name: "熊海涛", colorKey: "upp2" },
    676: { name: "张旭桐", colorKey: "upp1" },
    677: { name: "贾承羲", colorKey: "is" },
    678: { name: "王思涵", colorKey: "low1" },
    679: { name: "袁若菡", colorKey: "low2" },
    680: { name: "温粮丞", colorKey: "upp5" },
    681: { name: "伍心一", colorKey: "upp1" },
    682: { name: "苏彦旭", colorKey: "upp2" },
    683: { name: "林祥威", colorKey: "upp3" },
    684: { name: "袁梓涵", colorKey: "low1" },
    685: { name: "李杜宇", colorKey: "is" },
    686: { name: "曾禹为", colorKey: "upp3" },
    687: { name: "曾圣炜", colorKey: "low1" },
    688: { name: "王梓涵", colorKey: "low1" },
    689: { name: "陈唯宸", colorKey: "low2" },
    690: { name: "舒昕", colorKey: "upp2" },
    691: { name: "袁梓涵", colorKey: "low1" },
    692: { name: "李杜宇", colorKey: "is" },
    693: { name: "徐梓瑞", colorKey: "is" },
    694: { name: "曾圣炜", colorKey: "low1" },
    695: { name: "王梓涵", colorKey: "low1" },
    696: { name: "陈唯宸", colorKey: "low2" },
    697: { name: "舒昕", colorKey: "upp2" },
    698: { name: "贺行言", colorKey: "is" },
    699: { name: "周静远", colorKey: "is" },
    700: { name: "?", colorKey: "tch" },
    701: { name: "周星宇", colorKey: "upp1" },
    702: { name: "陈可可", colorKey: "upp3" },
    703: { name: "刘笃行", colorKey: "upp3" },
    704: { name: "陈思然", colorKey: "upp3" },
    705: { name: "崔语珂", colorKey: "upp3" },
    706: { name: "贾博皓", colorKey: "upp3" },
    707: { name: "李佳洁", colorKey: "upp3" },
    708: { name: "杨浩然", colorKey: "upp3" },
    709: { name: "龚信维", colorKey: "upp3" },
    710: { name: "黄麒升", colorKey: "upp3" },
    711: { name: "王文轩", colorKey: "upp3" },
    712: { name: "廖旭涛", colorKey: "upp3" },
    713: { name: "刘泰宏", colorKey: "upp3" },
    714: { name: "张廷语", colorKey: "upp3" },
    715: { name: "张廷歌", colorKey: "upp3" },
    716: { name: "罗浩元", colorKey: "upp3" },
    717: { name: "蒋宇恒", colorKey: "upp4" },
    718: { name: "吴雨松", colorKey: "upp4" },
    719: { name: "郑奕杰", colorKey: "upp4" },
    720: { name: "丘月丞", colorKey: "upp4" },
    721: { name: "江来", colorKey: "upp4" },
    722: { name: "彭煜潇", colorKey: "upp4" },
    723: { name: "?", colorKey: "upp2" },
    724: { name: "?", colorKey: "upp2" },
    725: { name: "龚天佑", colorKey: "upp1" },
    726: { name: "姜婷玉", colorKey: "upp2" },
    727: { name: "王子涵", colorKey: "is" },
    728: { name: "王子杨", colorKey: "upp1" },
    729: { name: "刘逸轩", colorKey: "upp1" },
    730: { name: "彭煜潇", colorKey: "upp1" },
    731: { name: "魏义鲲", colorKey: "upp1" },
    732: { name: "吴澄江", colorKey: "upp2" },
    733: { name: "左宇轩", colorKey: "upp1" },
    734: { name: "蒋知楠", colorKey: "upp2" },
    735: { name: "宋成宸", colorKey: "upp1" },
    736: { name: "程鑫", colorKey: "upp1" },
    737: { name: "胡书菡", colorKey: "upp1" },
    738: { name: "陈泽州", colorKey: "upp4" },
    739: { name: "肖瑾瑜", colorKey: "upp5" },
    740: { name: "喻奕杰", colorKey: "upp5" },
    741: { name: "苟城玮", colorKey: "upp5" },
    742: { name: "李天阳", colorKey: "upp5" },
    743: { name: "李屿霏", colorKey: "upp5" },
    744: { name: "柳絮源", colorKey: "upp5" },
    745: { name: "陈恒宇", colorKey: "tch" },
    746: { name: "李涵睿", colorKey: "upp2" },
    747: { name: "熊涵语", colorKey: "upp4" },
    748: { name: "李莫非", colorKey: "upp5" },
    749: { name: "庹铭宇", colorKey: "upp5" },
    750: { name: "赵天琦", colorKey: "upp5" },
    751: { name: "张彧铭", colorKey: "upp3" },
    752: { name: "张铭煜", colorKey: "upp3" },
    753: { name: "李秉恒", colorKey: "upp3" },
    754: { name: "李昊葭", colorKey: "upp3" },
    755: { name: "宋宇洋", colorKey: "upp3" },
    756: { name: "黄洛天", colorKey: "upp4" },
    757: { name: "邱志匀", colorKey: "upp4" },
    758: { name: "胡越", colorKey: "upp3" },
    759: { name: "?", colorKey: "tch" },
    760: { name: "罗子皓", colorKey: "low1" },
    761: { name: "?", colorKey: "low1" },
    762: { name: "刘语涵", colorKey: "is" },
    763: { name: "艾泉孜", colorKey: "low1" },
    764: { name: "胡承旭", colorKey: "low1" },
    765: { name: "邹宇瞰", colorKey: "low1" },
    766: { name: "彭睿鑫", colorKey: "low1" },
    767: { name: "苟悦熙", colorKey: "low1" },
    768: { name: "于涵涵", colorKey: "low1" },
    769: { name: "张馨予", colorKey: "low1" },
    770: { name: "窦文蕊", colorKey: "low1" },
    771: { name: "黄恋茜", colorKey: "low1" },
    772: { name: "李瑜森", colorKey: "low1" },
    773: { name: "韩俊晨", colorKey: "low1" },
    774: { name: "刘子涵", colorKey: "low1" },
    775: { name: "赵娅淇", colorKey: "low1" },
    776: { name: "唐一心", colorKey: "low2" },
    777: { name: "文子豪", colorKey: "low2" },
    778: { name: "夏宇承", colorKey: "low2" },
    779: { name: "彭浩洋", colorKey: "low2" },
    780: { name: "费熙童", colorKey: "low2" },
    781: { name: "李晨杰", colorKey: "low2" },
    782: { name: "薛皓天", colorKey: "low2" },
    783: { name: "马瑞辰", colorKey: "low2" },
    784: { name: "祝煜涵", colorKey: "is" },
    785: { name: "王浩宇", colorKey: "is" },
    786: { name: "杨佳函", colorKey: "is" },
    787: { name: "杨诗琪", colorKey: "low2" },
    788: { name: "李昊轩", colorKey: "low2" },
    789: { name: "程晨", colorKey: "low2" },
    790: { name: "赵俊涵", colorKey: "low2" },
    791: { name: "宋明阳", colorKey: "is" },
    792: { name: "陈泳蒽", colorKey: "is" },
    793: { name: "孙邦博", colorKey: "is" },
    794: { name: "施宇翔", colorKey: "upp1" },
    795: { name: "曾俊霖", colorKey: "upp1" },
    796: { name: "张桢曜", colorKey: "upp1" },
    797: { name: "宋正锡", colorKey: "upp1" },
    798: { name: "饶宸嘉", colorKey: "upp1" },
    799: { name: "何浩月", colorKey: "upp1" },
    800: { name: "杨佑辉", colorKey: "upp2" },
    801: { name: "李俊贤", colorKey: "upp1" },
    802: { name: "康与邹", colorKey: "upp2" },
    803: { name: "杨恬冰", colorKey: "upp2" },
    804: { name: "张皓嘉", colorKey: "upp2" },
    805: { name: "廖元柯", colorKey: "upp4" },
    806: { name: "陈炜乐", colorKey: "upp4" },
    807: { name: "刘博文", colorKey: "upp4" },
    808: { name: "杨谨源", colorKey: "low1" },
    809: { name: "李悦杨", colorKey: "upp1" },
    810: { name: "曾思玮", colorKey: "upp1" },
    811: { name: "杨笑", colorKey: "is" },
    812: { name: "曾帅鸣", colorKey: "low1" },
    813: { name: "唐一为", colorKey: "upp1" },
    814: { name: "冯傲林", colorKey: "upp1" },
    815: { name: "李兆瑨", colorKey: "upp1" },
    816: { name: "韩穆志霖", colorKey: "upp1" },
    817: { name: "郭展铄", colorKey: "upp3" },
    818: { name: "周梦萱", colorKey: "upp3" },
    819: { name: "韩政旭", colorKey: "upp3" },
    820: { name: "马孟哲", colorKey: "upp4" },
    821: { name: "管泽昊", colorKey: "upp4" },
    822: { name: "王凯正", colorKey: "upp4" },
    823: { name: "刘俊凯", colorKey: "upp4" },
    824: { name: "楚一飞", colorKey: "upp4" },
    825: { name: "张士豪", colorKey: "upp4" },
    826: { name: "王晨曦", colorKey: "upp4" },
    827: { name: "郑心悦", colorKey: "upp4" },
    828: { name: "车冉冉", colorKey: "upp4" },
    829: { name: "徐淑君", colorKey: "tch" },
    830: { name: "郑森元", colorKey: "upp2" },
    831: { name: "王曦田", colorKey: "upp3" },
    832: { name: "高怡凡", colorKey: "is" },
    835: { name: "张凌熙", colorKey: "is" },
    836: { name: "姜懿轩", colorKey: "upp3" },
    837: { name: "郭志安", colorKey: "upp3" },
    838: { name: "郭志康", colorKey: "upp3" },
    839: { name: "刘易笑", colorKey: "low1" },
    840: { name: "赵思危", colorKey: "is" },
    841: { name: "谭棋源", colorKey: "is" },
    842: { name: "邓璐非", colorKey: "is" },
    843: { name: "张峻滔", colorKey: "is" },
    844: { name: "宋知谦", colorKey: "is" },
    845: { name: "白书行", colorKey: "is" },
    846: { name: "谢宇浩", colorKey: "is" },
    847: { name: "苏庆朗", colorKey: "is" },
    848: { name: "张宇鑫", colorKey: "is" },
    849: { name: "邓鹏", colorKey: "is" },
    850: { name: "王子福", colorKey: "is" },
    851: { name: "牟划", colorKey: "is" },
    852: { name: "张兮灿", colorKey: "is" },
    853: { name: "谢同宸", colorKey: "is" },
    854: { name: "杨雨萱", colorKey: "is" },
    855: { name: "刘宬汐", colorKey: "is" },
    856: { name: "曹适青", colorKey: "is" },
    857: { name: "何席毅", colorKey: "is" },
    858: { name: "兰博文", colorKey: "is" },
    859: { name: "潘钦臣", colorKey: "is" },
    860: { name: "孙乐天", colorKey: "is" },
    861: { name: "吴欣淼", colorKey: "is" },
    862: { name: "陈卓佳", colorKey: "is" },
    863: { name: "刘悟臻", colorKey: "is" },
    864: { name: "胡浩轩", colorKey: "is" },
    865: { name: "肖涵畅", colorKey: "is" },
    866: { name: "王亦曹", colorKey: "upp1" },
    867: { name: "李卓恒", colorKey: "upp3" },
    868: { name: "李承佑", colorKey: "upp3" },
    869: { name: "罗翰扬", colorKey: "upp3" },
    870: { name: "陈致霖", colorKey: "is" },
    871: { name: "张平京渝", colorKey: "low1" },
    872: { name: "黄蔚尧", colorKey: "upp6" },
    873: { name: "刘晨宇", colorKey: "upp6" },
    874: { name: "陈霖瑄", colorKey: "is" },
    875: { name: "程翊宸", colorKey: "is" },
    876: { name: "蒋思齐", colorKey: "is" },
    877: { name: "刘松林", colorKey: "is" },
    878: { name: "王译萱", colorKey: "is" },
    879: { name: "张子佩", colorKey: "is" },
    880: { name: "陈统峙", colorKey: "is" },
    881: { name: "郑凯文", colorKey: "upp3" },
    882: { name: "唐若轩", colorKey: "low1" },
    883: { name: "李坤洋", colorKey: "is" },
    884: { name: "卢治屹", colorKey: "is" },
    885: { name: "陈彦南", colorKey: "low1" },
    886: { name: "刘苏熳", colorKey: "low1" },
    887: { name: "漆小凡", colorKey: "low1" },
    888: { name: "钱旻灏", colorKey: "upp3" },
    889: { name: "梁殿宸", colorKey: "low1" },
    890: { name: "王腾立", colorKey: "is" },
    891: { name: "周子黄", colorKey: "is" },
    892: { name: "杨楚琰", colorKey: "low2" },
    893: { name: "张雨轲", colorKey: "low1" },
    894: { name: "曾溢崃", colorKey: "is" },
    895: { name: "江晟德", colorKey: "low1" },
    896: { name: "王瑞", colorKey: "upp1" },
    897: { name: "赵宸", colorKey: "is" },
    898: { name: "韦潮汐", colorKey: "upp1" },
    899: { name: "朱炫宇", colorKey: "is" },
    900: { name: "王浩翔", colorKey: "is" },
    901: { name: "许嘉程", colorKey: "low3" },
    902: { name: "李承熙", colorKey: "low3" },
    903: { name: "曹明杰", colorKey: "is" },
    904: { name: "周俊锡", colorKey: "low3" },
    905: { name: "?", colorKey: "low3" },
    906: { name: "王鑫桐", colorKey: "low3" },
    907: { name: "方昕瑞", colorKey: "low3" },
    908: { name: "王皓阳", colorKey: "low3" },
    909: { name: "杨笑", colorKey: "is" },
    910: { name: "?", colorKey: "low3" },
    911: { name: "杨晟宣", colorKey: "low3" },
    912: { name: "张馨元", colorKey: "low3" },
    913: { name: "侯淳逸", colorKey: "low3" },
    914: { name: "张怀艺", colorKey: "is" },
    915: { name: "罗曼", colorKey: "is" },
    916: { name: "文康懿", colorKey: "is" },
    917: { name: "伍尚洵", colorKey: "is" },
    918: { name: "黄浩源", colorKey: "upp1" },
    919: { name: "欧阳裕漪", colorKey: "low2" },
    920: { name: "谭筱丸", colorKey: "low1" },
    921: { name: "黄麟懿", colorKey: "low1" },
    922: { name: "余思桐", colorKey: "low1" },
    923: { name: "刘轩诚", colorKey: "low1" },
    924: { name: "夏瑞", colorKey: "low1" },
    925: { name: "常津宁", colorKey: "low1" },
    926: { name: "杨葆源", colorKey: "low1" },
    927: { name: "陈景初", colorKey: "low1" },
    928: { name: "王灏霆", colorKey: "is" },
    929: { name: "陈泓宇", colorKey: "is" },
    930: { name: "尹致帷", colorKey: "is" },
    931: { name: "蒋思成", colorKey: "upp1" },
    932: { name: "刘曦文", colorKey: "upp1" },
    933: { name: "董博远", colorKey: "tch" },
    934: { name: "孟庆芸", colorKey: "tch" },
    935: { name: "袁子川", colorKey: "is" },
    936: { name: "李凡希", colorKey: "low1" },
    937: { name: "黄翊航", colorKey: "is" },
    938: { name: "何思成", colorKey: "is" },
    939: { name: "钱桥", colorKey: "tch" },
    947: { name: "张凌熙", colorKey: "is" },
    948: { name: "陈思诚", colorKey: "is" },
    949: { name: "郭岱颉", colorKey: "upp2" },
    950: { name: "周子黄", colorKey: "is" },
    951: { name: "胡伊洋", colorKey: "upp2" },
    952: { name: "杨汶锦", colorKey: "is" },
    953: { name: "兰博文", colorKey: "upp2" },
    954: { name: "李颢龙", colorKey: "upp2" },
    956: { name: "测试", colorKey: "tch" },
    957: { name: "朱翰篪", colorKey: "is" },
    958: { name: "邹阳扬", colorKey: "is" },
    959: { name: "钟博翰", colorKey: "upp3" },
    960: { name: "钟弘毅", colorKey: "low2" },
    961: { name: "钱雨恩", colorKey: "low1" },
    962: { name: "李卓衡", colorKey: "low1" },
    963: { name: "李钰沣", colorKey: "low2" },
    964: { name: "钱承泽", colorKey: "low1" },
    965: { name: "李晔涵", colorKey: "low2" },
    966: { name: "公子文", colorKey: "low1" },
    967: { name: "诸逸伦", colorKey: "low1" },
    968: { name: "张梓瑞", colorKey: "low1" },
    969: { name: "江培源", colorKey: "low1" },
    970: { name: "刘乙阳", colorKey: "low1" },
    971: { name: "王梓丞", colorKey: "low1" },
    972: { name: "赖俊岑", colorKey: "low1" },
    973: { name: "马一逍", colorKey: "low1" },
    974: { name: "宋泰然", colorKey: "low1" },
    975: { name: "王品羲", colorKey: "low1" },
    976: { name: "汪泽浩", colorKey: "low1" },
    977: { name: "吴雨翔", colorKey: "low1" },
    978: { name: "李骁畅", colorKey: "low1" },
    979: { name: "顾元淳", colorKey: "low1" },
    980: { name: "易天雨", colorKey: "low1" },
    981: { name: "叶柏岑", colorKey: "low1" },
    982: { name: "蒲思臣", colorKey: "low1" },
    983: { name: "官政", colorKey: "low1" },
    984: { name: "王瑞宁", colorKey: "low1" },
    985: { name: "巫昱恺", colorKey: "is" },
    986: { name: "张轩诚", colorKey: "upp2" },
    987: { name: "严家乐", colorKey: "upp2" },
    988: { name: "陈翔宇", colorKey: "upp2" },
    989: { name: "张宇衡", colorKey: "upp2" },
    990: { name: "谢宇轩", colorKey: "upp2" },
    991: { name: "周圣青", colorKey: "low1" },
    992: { name: "刘文驭", colorKey: "low1" },
    993: { name: "彭钰涵", colorKey: "low2" },
    994: { name: "黎莫轩", colorKey: "upp2" },
    995: { name: "彭奕力", colorKey: "low1" },
    996: { name: "漆小凡", colorKey: "low1" },
    997: { name: "蓝静远", colorKey: "upp2" },
    998: { name: "李佳翼", colorKey: "upp2" },
    999: { name: "聂文涛", colorKey: "upp2" },
    1000: { name: "杨铠齐", colorKey: "upp2" },
    1001: { name: "吕俊呈", colorKey: "upp1" },
    1002: { name: "姚成洋", colorKey: "low1" },
    1003: { name: "吴秉岩", colorKey: "low1" },
    1004: { name: "王子远", colorKey: "low1" },
    1005: { name: "陈景初", colorKey: "low1" },
    1006: { name: "曹曾曾", colorKey: "low1" },
    1007: { name: "张恩瑞", colorKey: "low1" },
    1008: { name: "姜琉", colorKey: "low1" },
    1009: { name: "刘一诺", colorKey: "low1" },
    1010: { name: "孙思羽", colorKey: "low1" },
    1011: { name: "罗禾和", colorKey: "low1" },
    1012: { name: "王瀚森", colorKey: "low1" },
    1013: { name: "伍鸿轩", colorKey: "low1" },
    1014: { name: "田明翰", colorKey: "low1" },
    1015: { name: "陈瑞端", colorKey: "low1" },
    1016: { name: "江宜轩", colorKey: "low1" },
    1017: { name: "黄毅灿", colorKey: "low1" },
    1018: { name: "秦梦煊", colorKey: "low1" },
    1019: { name: "丁若琳", colorKey: "low1" },
    1020: { name: "陈乐章", colorKey: "low1" },
    1021: { name: "冯亭翔", colorKey: "low1" },
    1022: { name: "李晟铭", colorKey: "low1" },
    1023: { name: "刘崧霖", colorKey: "low1" },
    1024: { name: "刘启德", colorKey: "low1" },
    1025: { name: "朱子墨", colorKey: "low1" },
    1026: { name: "高晨朗", colorKey: "low2" },
    1027: { name: "张之瀚", colorKey: "low1" },
    1028: { name: "宋正锡", colorKey: "upp1" },
    1029: { name: "杨骏", colorKey: "tch" },
    1030: { name: "刘思淇", colorKey: "low1" },
    1031: { name: "王炫理", colorKey: "low2" },
    1032: { name: "荣国文", colorKey: "low1" },
    1033: { name: "胡承旭", colorKey: "is" },
    1034: { name: "?", colorKey: "low1" },
    1035: { name: "吴沛宸", colorKey: "low1" },
    1036: { name: "张立言", colorKey: "low2" },
    1037: { name: "刘溯理", colorKey: "low2" },
    1038: { name: "杜锦祚", colorKey: "low2" },
    1039: { name: "李子杰", colorKey: "low2" },
    1040: { name: "易米修", colorKey: "low2" },
    1041: { name: "李知之", colorKey: "low2" },
    1042: { name: "邵许", colorKey: "low2" },
    1043: { name: "曹子杰", colorKey: "low2" },
    1044: { name: "邝岳弘", colorKey: "low2" },
    1045: { name: "李炎泽", colorKey: "low2" },
    1046: { name: "张浩然", colorKey: "low2" },
    1047: { name: "罗一宸", colorKey: "low2" },
    1048: { name: "袁珮珆", colorKey: "low2" },
    1049: { name: "张瀚霖", colorKey: "low2" },
    1050: { name: "叶威濂", colorKey: "low2" },
    1051: { name: "蓝乙崴", colorKey: "is" },
    1052: { name: "胡长治", colorKey: "low2" },
    1053: { name: "王韵涵", colorKey: "low2" },
    1054: { name: "王子睿", colorKey: "low2" },
    1055: { name: "刘同垚", colorKey: "low1" },
    1056: { name: "魏方博", colorKey: "low2" },
    1057: { name: "周博涵", colorKey: "low2" },
    1058: { name: "王梓彧", colorKey: "low1" },
    1059: { name: "龚俊与", colorKey: "upp2" },
    1060: { name: "田芩熹", colorKey: "low1" },
    1061: { name: "李远浩", colorKey: "upp2" },
    1062: { name: "王松涛", colorKey: "tch" },
    1063: { name: "陈恒宇", colorKey: "tch" },
    1064: { name: "肖翊", colorKey: "low1" },
    1065: { name: "临时", colorKey: "tch" },
    1066: { name: "伍霁葳", colorKey: "upp1" },
    1067: { name: "伍霁葳", colorKey: "upp1" },
    1068: { name: "姜羽璘", colorKey: "is" },
    1069: { name: "李思阳", colorKey: "is" },
    1070: { name: "章正瀚", colorKey: "low1" },
    1071: { name: "章正瀚", colorKey: "low1" },
    1072: { name: "刘芮圻", colorKey: "low1" },
    1073: { name: "袁小涛", colorKey: "low1" },
    1074: { name: "罗涵哲", colorKey: "low1" },
    1075: { name: "王睿", colorKey: "upp1" },
    1076: { name: "钟凯宇", colorKey: "low1" },
    1077: { name: "杨浩然", colorKey: "upp1" },
    1078: { name: "张嘉芸", colorKey: "low2" },
    1079: { name: "裴雨森", colorKey: "upp1" },
    1080: { name: "陈姿彤", colorKey: "upp1" },
    1081: { name: "陈奕璇", colorKey: "upp1" },
    1082: { name: "毛馨仪", colorKey: "low2" },
    1083: { name: "陈君睿", colorKey: "upp1" },
    1084: { name: "蔡尚东", colorKey: "upp3" },
    1085: { name: "汪士恒", colorKey: "upp1" },
    1086: { name: "黄梓涵", colorKey: "is" },
    1087: { name: "冯奕歌", colorKey: "low1" },
    1088: { name: "王玺然", colorKey: "low1" },
    1089: { name: "巫沐", colorKey: "low1" },
    1090: { name: "刘言果", colorKey: "low3" },
    1091: { name: "黄尚麟", colorKey: "low2" },
    1092: { name: "黄尚麒", colorKey: "low2" },
    1093: { name: "林皓宸", colorKey: "low2" },
    1094: { name: "文星杰", colorKey: "upp1" },
    1095: { name: "赖云喆", colorKey: "upp1" },
    1096: { name: "杨博钧", colorKey: "upp1" },
    1097: { name: "张学成", colorKey: "upp1" },
    1098: { name: "尹尧", colorKey: "upp1" },
    1099: { name: "胡宸衍", colorKey: "upp1" },
    1100: { name: "张思睿", colorKey: "upp1" },
    1101: { name: "胡傅睿", colorKey: "low2" },
    1102: { name: "孙彦倞", colorKey: "low2" },
    1103: { name: "张子豪", colorKey: "low2" },
    1104: { name: "陈泽予", colorKey: "low2" },
    1105: { name: "何正让", colorKey: "low1" },
    1106: { name: "王思勋", colorKey: "low3" },
    1107: { name: "吕承泽", colorKey: "low2" },
    1108: { name: "黄祺远", colorKey: "low2" },
    1109: { name: "贾慎知", colorKey: "low2" },
    1110: { name: "郑嘉珺", colorKey: "low2" },
    1111: { name: "刘子昂", colorKey: "low2" },
    1112: { name: "吴玥濛", colorKey: "low2" },
    1113: { name: "佘睿扬", colorKey: "low2" },
    1114: { name: "刘子豪", colorKey: "low2" },
    1115: { name: "杨文轩", colorKey: "low2" },
    1116: { name: "郑佑宸", colorKey: "low2" },
    1117: { name: "李子肖", colorKey: "low2" },
    1118: { name: "谢语皓同", colorKey: "low2" },
    1119: { name: "万家栋", colorKey: "low2" },
    1120: { name: "韩思宇", colorKey: "low2" },
    1121: { name: "廖一泽", colorKey: "low2" },
    1122: { name: "曾讷言", colorKey: "low2" },
    1123: { name: "陈靖澔", colorKey: "low2" },
    1124: { name: "刘淳智", colorKey: "low2" },
    1125: { name: "王柯皓", colorKey: "low2" },
    1126: { name: "李承骏", colorKey: "low2" },
    1127: { name: "朱志宇", colorKey: "low2" },
    1128: { name: "赖奕菡", colorKey: "low2" },
    1129: { name: "刘丰睿", colorKey: "low2" },
    1130: { name: "宋浚哲", colorKey: "low2" },
    1131: { name: "吴峻熙", colorKey: "low2" },
    1132: { name: "申知非", colorKey: "low2" },
    1133: { name: "向奕涵", colorKey: "low2" },
    1134: { name: "龙玺尧", colorKey: "low2" },
    1135: { name: "肖宇阳", colorKey: "low2" },
    1136: { name: "沈楷伦", colorKey: "low2" },
    1137: { name: "陈玺龙", colorKey: "low2" },
    1138: { name: "王梓渊", colorKey: "low2" },
    1139: { name: "陶俊名", colorKey: "low2" },
    1140: { name: "叶林洲", colorKey: "low2" },
    1141: { name: "于孟辰", colorKey: "low2" },
    1142: { name: "葛怡佳", colorKey: "low2" },
    1143: { name: "牛志成", colorKey: "low2" },
    1144: { name: "郭芸熙", colorKey: "low2" },
    1145: { name: "高铭", colorKey: "low2" },
    1146: { name: "许添韵", colorKey: "low2" },
    1147: { name: "马正洋", colorKey: "low2" },
    1148: { name: "刘皓轩", colorKey: "low2" },
    1149: { name: "胡杰垚", colorKey: "low1" },
    1150: { name: "黄梓轩", colorKey: "upp1" },
    1151: { name: "杨佑晖", colorKey: "upp1" },
    1152: { name: "王星集", colorKey: "low2" },
    1153: { name: "?", colorKey: "is" },
    1154: { name: "刘楚谦", colorKey: "is" },
    1155: { name: "蒋锦涛", colorKey: "low2" },
    1156: { name: "陈为仪", colorKey: "low2" },
    1157: { name: "陈骏贤", colorKey: "low2" },
    1158: { name: "刘泽宇", colorKey: "low3" },
    1159: { name: "黄奕珲", colorKey: "low3" },
    1160: { name: "刘厚朴", colorKey: "low2" },
    1161: { name: "李泽轩", colorKey: "low2" },
    1162: { name: "何梓滔", colorKey: "low2" },
    1163: { name: "敬沐年", colorKey: "low2" },
    1164: { name: "柯睿思", colorKey: "low2" },
    1165: { name: "陈科帆", colorKey: "low3" },
    1166: { name: "田亮", colorKey: "is" },
    1167: { name: "史梓琛", colorKey: "low2" },
    1168: { name: "庄乐言", colorKey: "low2" },
    1169: { name: "曾泽辉", colorKey: "low1" },
    1170: { name: "贾淏文", colorKey: "low1" },
    1171: { name: "徐静丹", colorKey: "low2" },
    1172: { name: "徐苒茨", colorKey: "tch" },
    1173: { name: "刘思成", colorKey: "upp1" },
    1174: { name: "钟沐霖", colorKey: "low2" },
    1175: { name: "刘佩林", colorKey: "low2" },
    1176: { name: "杨辰瑾", colorKey: "low2" },
    1177: { name: "姚烨栋", colorKey: "low2" },
    1178: { name: "马琳峰", colorKey: "is" },
    1179: { name: "赖今羿", colorKey: "upp1" },
    1180: { name: "测试", colorKey: "low1" },
    1181: { name: "测试", colorKey: "upp3" },
    1182: { name: "代唯祺", colorKey: "low3" },
    1183: { name: "?", colorKey: "tch" },
    1184: { name: "赵淀磊", colorKey: "low1" },
    1185: { name: "税义翔", colorKey: "low1" },
    1186: { name: "张旷玉", colorKey: "low1" },
    1187: { name: "张辰睿", colorKey: "low1" },
    1188: { name: "杨关赵耀", colorKey: "low1" },
    1189: { name: "何秉轩", colorKey: "low1" },
    1190: { name: "汪梓澜", colorKey: "low2" },
    1191: { name: "宁亦檬", colorKey: "is" },
    1192: { name: "唐煜骅", colorKey: "is" },
    1193: { name: "申璟浩", colorKey: "low2" },
    1194: { name: "罗子忱", colorKey: "low2" },
    1195: { name: "邓岚膑", colorKey: "tch" },
    1196: { name: "?", colorKey: "upp5" },
    1197: { name: "?", colorKey: "upp5" },
    1198: { name: "?", colorKey: "upp5" },
    1199: { name: "段凯霖", colorKey: "is" },
    1200: { name: "刘星宇", colorKey: "is" },
    1201: { name: "?", colorKey: "upp5" },
    1202: { name: "?", colorKey: "upp5" },
    1203: { name: "?", colorKey: "upp5" },
    1204: { name: "?", colorKey: "upp5" },
    1205: { name: "卢智杰", colorKey: "is" },
    1206: { name: "莫鹏聪", colorKey: "is" },
    1207: { name: "汪嘉越", colorKey: "is" },
    1208: { name: "?", colorKey: "upp5" },
    1209: { name: "冯子上", colorKey: "is" },
    1210: { name: "?", colorKey: "upp5" },
    1211: { name: "?", colorKey: "upp5" },
    1212: { name: "林威", colorKey: "is" },
    1213: { name: "?", colorKey: "upp5" },
    1214: { name: "?", colorKey: "upp5" },
    1215: { name: "何泓谦", colorKey: "is" },
    1216: { name: "?", colorKey: "upp5" },
    1217: { name: "王梓烨", colorKey: "upp1" },
    1218: { name: "?", colorKey: "upp5" },
    1219: { name: "邹浩楠", colorKey: "is" },
    1220: { name: "?", colorKey: "upp5" },
    1221: { name: "?", colorKey: "upp5" },
    1222: { name: "?", colorKey: "upp5" },
    1223: { name: "邝思远", colorKey: "is" },
    1224: { name: "?", colorKey: "upp5" },
    1225: { name: "?", colorKey: "upp5" },
    1226: { name: "?", colorKey: "upp5" },
    1227: { name: "?", colorKey: "upp5" },
    1228: { name: "张清扬", colorKey: "low1" },
    1229: { name: "?", colorKey: "upp5" },
    1230: { name: "陈璟熙", colorKey: "upp1" },
    1231: { name: "杨嘉宇", colorKey: "is" },
    1232: { name: "?", colorKey: "upp5" },
    1233: { name: "?", colorKey: "upp5" },
    1234: { name: "汪嘉超", colorKey: "is" },
    1235: { name: "?", colorKey: "upp5" },
    1236: { name: "?", colorKey: "upp5" },
    1237: { name: "?", colorKey: "upp5" },
    1238: { name: "?", colorKey: "upp5" },
    1239: { name: "邓正浩", colorKey: "upp1" },
    1240: { name: "?", colorKey: "upp5" },
    1241: { name: "殷泽轩", colorKey: "is" },
    1242: { name: "?", colorKey: "upp5" },
    1243: { name: "?", colorKey: "upp5" },
    1244: { name: "庞睿康", colorKey: "low1" },
    1245: { name: "?", colorKey: "upp5" },
    1246: { name: "?", colorKey: "upp5" },
    1247: { name: "?", colorKey: "upp5" },
    1248: { name: "?", colorKey: "upp5" },
    1249: { name: "?", colorKey: "upp5" },
    1250: { name: "何明恩", colorKey: "is" },
    1251: { name: "?", colorKey: "upp5" },
    1252: { name: "?", colorKey: "upp5" },
    1253: { name: "何奕", colorKey: "is" },
    1254: { name: "?", colorKey: "upp5" },
    1255: { name: "?", colorKey: "upp5" },
    1256: { name: "徐晓彬", colorKey: "upp1" },
    1257: { name: "黄子信", colorKey: "upp1" },
    1258: { name: "?", colorKey: "upp5" },
    1259: { name: "罗伟祺", colorKey: "is" },
    1260: { name: "?", colorKey: "upp5" },
    1261: { name: "冯乐天", colorKey: "upp1" },
    1262: { name: "?", colorKey: "upp5" },
    1263: { name: "?", colorKey: "upp5" },
    1264: { name: "?", colorKey: "upp5" },
    1265: { name: "朱浩源", colorKey: "is" },
    1266: { name: "?", colorKey: "upp5" },
    1267: { name: "?", colorKey: "upp5" },
    1268: { name: "?", colorKey: "upp5" },
    1269: { name: "林致远", colorKey: "low2" },
    1270: { name: "?", colorKey: "upp5" },
    1271: { name: "?", colorKey: "upp5" },
    1272: { name: "?", colorKey: "upp5" },
    1273: { name: "?", colorKey: "upp5" },
    1274: { name: "?", colorKey: "upp5" },
    1275: { name: "雷德轩", colorKey: "low1" },
    1276: { name: "?", colorKey: "upp5" },
    1277: { name: "?", colorKey: "upp5" },
    1278: { name: "?", colorKey: "upp5" },
    1279: { name: "陈子楠", colorKey: "upp2" },
    1280: { name: "?", colorKey: "upp5" },
    1281: { name: "?", colorKey: "upp5" },
    1282: { name: "?", colorKey: "upp5" },
    1283: { name: "?", colorKey: "upp5" },
    1284: { name: "祁明锐", colorKey: "low2" },
    1285: { name: "贾淏文", colorKey: "low1" },
    1286: { name: "刘晨煜", colorKey: "low2" },
    1287: { name: "?", colorKey: "upp5" },
    1288: { name: "?", colorKey: "upp5" },
    1289: { name: "田滨诚", colorKey: "is" },
    1290: { name: "冯潇文", colorKey: "low2" },
    1291: { name: "王誉皓", colorKey: "upp1" },
    1292: { name: "廖佳怡", colorKey: "upp3" },
    1293: { name: "黎铭瀚", colorKey: "upp3" },
    1294: { name: "李卓宸", colorKey: "upp3" },
    1295: { name: "郭彦凯", colorKey: "upp3" },
    1296: { name: "?", colorKey: "tch" },
    1297: { name: "尹致帷", colorKey: "tch" },
    1298: { name: "肖柘天", colorKey: "low3" },
    1299: { name: "邝岳弘", colorKey: "tch" },
    1300: { name: "徐守中", colorKey: "low2" },
    1301: { name: "谢易轩", colorKey: "low2" },
    1302: { name: "?", colorKey: "tch" },
    1303: { name: "?", colorKey: "tch" },
    1304: { name: "?", colorKey: "tch" },
    1305: { name: "杨景熙", colorKey: "low2" },
    1306: { name: "杨智予", colorKey: "low2" },
    1307: { name: "?", colorKey: "tch" },
    1308: { name: "贺羿文", colorKey: "tch" },
    1309: { name: "彭佳睿", colorKey: "tch" },
    1310: { name: "邹阳扬", colorKey: "tch" },
    1311: { name: "曾陈", colorKey: "tch" },
    1312: { name: "贺淏", colorKey: "tch" },
    1313: { name: "王秉轩", colorKey: "low2" },
    1314: { name: "黄奕衡", colorKey: "low3" },
    1315: { name: "庞昊轩", colorKey: "low3" },
    1316: { name: "谭珺桐", colorKey: "low3" },
    1317: { name: "袁子霖", colorKey: "tch" },
    1318: { name: "张御霖", colorKey: "tch" },
    1319: { name: "董博远", colorKey: "tch" },
    1320: { name: "刘婉", colorKey: "tch" },
    1321: { name: "唐振强", colorKey: "tch" },
    1322: { name: "林涛", colorKey: "tch" },
    1323: { name: "?", colorKey: "tch" },
    1324: { name: "李昱燊", colorKey: "tch" },
    1325: { name: "夏瑞", colorKey: "tch" },
    1326: { name: "余思桐", colorKey: "tch" },
    1327: { name: "李凡希", colorKey: "tch" },
    1328: { name: "刘罗乐", colorKey: "tch" },
    1329: { name: "文秋画", colorKey: "tch" },
    1330: { name: "陈仟阅", colorKey: "low3" },
    1331: { name: "李羿宏", colorKey: "low3" },
    1332: { name: "宁梓骁", colorKey: "low3" },
    1333: { name: "廖晓晨", colorKey: "low3" },
    1334: { name: "唐云旂", colorKey: "low3" },
    1335: { name: "?", colorKey: "tch" },
    1336: { name: "何梓馨", colorKey: "low3" },
    1337: { name: "黄旭", colorKey: "tch" },
    1338: { name: "刘嘉睿", colorKey: "low3" },
    1339: { name: "王海烨", colorKey: "upp1" },
    1340: { name: "?", colorKey: "tch" },
    1341: { name: "牟益", colorKey: "low3" },
    1342: { name: "程王浩", colorKey: "low3" },
    1343: { name: "金敬淳", colorKey: "low3" },
    1344: { name: "张浩渺", colorKey: "low3" },
    1345: { name: "熊浩然", colorKey: "low2" },
    1346: { name: "刘泓成", colorKey: "low3" },
    1347: { name: "朱侯睿", colorKey: "low3" },
    1348: { name: "?", colorKey: "upp5" },
    1349: { name: "?", colorKey: "upp5" },
    1350: { name: "?", colorKey: "upp5" },
    1351: { name: "?", colorKey: "upp5" },
    1352: { name: "?", colorKey: "upp5" },
    1353: { name: "?", colorKey: "upp5" },
    1354: { name: "?", colorKey: "upp5" },
    1355: { name: "?", colorKey: "upp5" },
    1356: { name: "?", colorKey: "upp5" },
    1357: { name: "?", colorKey: "upp5" },
    1358: { name: "?", colorKey: "upp5" },
    1359: { name: "?", colorKey: "upp5" },
    1360: { name: "?", colorKey: "upp5" },
    1361: { name: "?", colorKey: "upp5" },
    1362: { name: "?", colorKey: "upp5" },
    1363: { name: "?", colorKey: "upp5" },
    1364: { name: "?", colorKey: "upp5" },
    1365: { name: "?", colorKey: "upp5" },
    1366: { name: "黄子轩", colorKey: "upp2" },
    1367: { name: "?", colorKey: "upp5" },
    1368: { name: "?", colorKey: "upp5" },
    1369: { name: "?", colorKey: "upp5" },
    1370: { name: "?", colorKey: "upp5" },
    1371: { name: "?", colorKey: "upp5" },
    1372: { name: "?", colorKey: "upp5" },
    1373: { name: "?", colorKey: "upp5" },
    1374: { name: "?", colorKey: "upp5" },
    1375: { name: "?", colorKey: "upp5" },
    1376: { name: "?", colorKey: "upp5" },
    1377: { name: "?", colorKey: "upp5" },
    1378: { name: "?", colorKey: "upp5" },
    1379: { name: "?", colorKey: "upp5" },
    1380: { name: "?", colorKey: "upp5" },
    1381: { name: "?", colorKey: "upp5" },
    1382: { name: "?", colorKey: "upp5" },
    1383: { name: "?", colorKey: "upp5" },
    1384: { name: "?", colorKey: "upp5" },
    1385: { name: "?", colorKey: "upp5" },
    1386: { name: "?", colorKey: "upp5" },
    1387: { name: "?", colorKey: "upp5" },
    1388: { name: "?", colorKey: "upp5" },
    1389: { name: "?", colorKey: "upp5" },
    1390: { name: "?", colorKey: "upp5" },
    1391: { name: "?", colorKey: "upp5" },
    1392: { name: "谭竣铭", colorKey: "upp2" },
    1393: { name: "邓正浩", colorKey: "upp5" },
    1394: { name: "?", colorKey: "upp5" },
    1395: { name: "蔡弈凡", colorKey: "upp1" },
    1396: { name: "范苇林", colorKey: "is" },
    1397: { name: "蒋周运", colorKey: "is" },
    1398: { name: "金戈", colorKey: "is" },
    1399: { name: "江子民", colorKey: "upp1" },
    1400: { name: "李烨霖", colorKey: "is" },
    1401: { name: "王韬淳", colorKey: "is" },
    1402: { name: "?", colorKey: "upp5" },
    1403: { name: "?", colorKey: "upp5" },
    1404: { name: "?", colorKey: "upp5" },
    1405: { name: "应昊廷", colorKey: "upp1" },
    1406: { name: "?", colorKey: "upp5" },
    1407: { name: "左天佑", colorKey: "is" },
    1408: { name: "?", colorKey: "upp5" },
    1409: { name: "付泠菲", colorKey: "upp1" },
    1410: { name: "刘萃情", colorKey: "upp1" },
    1411: { name: "?", colorKey: "upp5" },
    1412: { name: "?", colorKey: "upp5" },
    1413: { name: "?", colorKey: "upp5" },
    1414: { name: "?", colorKey: "upp5" },
    1415: { name: "?", colorKey: "upp5" },
    1416: { name: "?", colorKey: "upp5" },
    1417: { name: "?", colorKey: "upp5" },
    1418: { name: "?", colorKey: "upp5" },
    1419: { name: "?", colorKey: "upp5" },
    1420: { name: "?", colorKey: "upp5" },
    1421: { name: "?", colorKey: "upp5" },
    1422: { name: "?", colorKey: "upp5" },
    1423: { name: "?", colorKey: "upp5" },
    1424: { name: "?", colorKey: "upp5" },
    1425: { name: "冷林轩", colorKey: "low3" },
    1426: { name: "楚景琰", colorKey: "tch" },
    1427: { name: "邱家毅", colorKey: "low3" },
    1428: { name: "杨博文", colorKey: "tch" },
    1429: { name: "?", colorKey: "upp5" },
    1430: { name: "?", colorKey: "upp5" },
    1431: { name: "?", colorKey: "upp5" },
    1432: { name: "?", colorKey: "upp5" },
    1433: { name: "黄宇曦", colorKey: "low1" },
    1434: { name: "江子民", colorKey: "upp1" },
    1435: { name: "?", colorKey: "upp5" },
    1436: { name: "?", colorKey: "upp5" },
    1437: { name: "贺思恺", colorKey: "is" },
    1438: { name: "?", colorKey: "upp5" },
    1439: { name: "?", colorKey: "upp5" },
    1440: { name: "麦隽轩", colorKey: "low1" },
    1441: { name: "?", colorKey: "upp5" },
    1442: { name: "?", colorKey: "upp5" },
    1443: { name: "?", colorKey: "upp5" },
    1444: { name: "陈朗", colorKey: "upp1" },
    1445: { name: "冯智凡", colorKey: "is" },
    1446: { name: "陈玥影", colorKey: "low3" },
    1447: { name: "邱振凯", colorKey: "low3" },
    1448: { name: "祝晗泽", colorKey: "low2" },
    1449: { name: "陈沛霖", colorKey: "low2" },
    1450: { name: "朱梓宁", colorKey: "low3" },
    1451: { name: "刘星宇", colorKey: "tch" },
    1452: { name: "李崇楷", colorKey: "low3" },
    1453: { name: "张恩硕", colorKey: "low3" },
    1454: { name: "孙滋凯", colorKey: "low3" },
    1455: { name: "聂梓航", colorKey: "low3" },
    1456: { name: "?", colorKey: "low3" },
    1457: { name: "杨迪程", colorKey: "low3" },
    1458: { name: "彭博彦", colorKey: "low3" },
    1459: { name: "石皓霆", colorKey: "low3" },
    1460: { name: "张文雨萱", colorKey: "low2" },
    1461: { name: "廖昶懿", colorKey: "low2" },
    1462: { name: "王彦婷", colorKey: "low2" },
    1463: { name: "黄王彦傑", colorKey: "low3" },
    1464: { name: "向靖宇", colorKey: "low3" },
    1465: { name: "申梓呈", colorKey: "low3" },
    1466: { name: "陈志嘉", colorKey: "low3" },
    1467: { name: "黄天皓", colorKey: "low3" },
    1468: { name: "张朕浩", colorKey: "low3" },
    1469: { name: "钱廷李", colorKey: "low3" },
    1470: { name: "黄培与", colorKey: "low3" },
    1471: { name: "牛静远", colorKey: "low3" },
    1472: { name: "文昱皓", colorKey: "low2" },
    1473: { name: "何坤壕", colorKey: "low3" },
    1474: { name: "苏子洲", colorKey: "upp1" },
    1475: { name: "陈俊贤", colorKey: "low2" },
    1476: { name: "王彦婷", colorKey: "low2" },
    1477: { name: "陶丁鹏", colorKey: "low2" },
    1478: { name: "熊思博", colorKey: "low2" },
    1479: { name: "郑喻铭", colorKey: "low3" },
    1480: { name: "廖昶懿", colorKey: "low2" },
    1481: { name: "杨嘉缘", colorKey: "upp2" },
    1482: { name: "打印机", colorKey: "tch" },
    1483: { name: "?", colorKey: "upp5" },
    1484: { name: "?", colorKey: "upp5" },
    1485: { name: "?", colorKey: "upp5" },
    1486: { name: "?", colorKey: "upp5" },
    1487: { name: "?", colorKey: "upp5" },
    1488: { name: "?", colorKey: "upp5" },
    1489: { name: "?", colorKey: "upp5" },
    1490: { name: "?", colorKey: "upp5" },
    1491: { name: "?", colorKey: "upp5" },
    1492: { name: "赵牧兮", colorKey: "low2" },
    1493: { name: "?", colorKey: "upp5" },
    1494: { name: "孙伟宸", colorKey: "is" },
    1495: { name: "?", colorKey: "upp5" },
    1496: { name: "卜梓轩", colorKey: "upp1" },
    1497: { name: "顾梓程", colorKey: "upp1" },
    1498: { name: "?", colorKey: "upp5" },
    1499: { name: "许恒毅", colorKey: "low1" },
    1500: { name: "徐子叶", colorKey: "upp5" },
    1501: { name: "曾启阳", colorKey: "is" },
    1502: { name: "展伟杰", colorKey: "upp1" },
    1503: { name: "赵泽楷", colorKey: "upp5" },
    1504: { name: "朱毅乐", colorKey: "upp2" },
    1505: { name: "任桢昊", colorKey: "upp5" },
    1506: { name: "?", colorKey: "upp5" },
    1507: { name: "张一凡", colorKey: "upp5" },
    1508: { name: "张世豪", colorKey: "upp5" },
    1509: { name: "张锦锋", colorKey: "upp5" },
    1510: { name: "杨沅鑫", colorKey: "upp5" },
    1511: { name: "楼书浩", colorKey: "upp5" },
    1512: { name: "毛沈兴", colorKey: "upp5" },
    1513: { name: "罗煊皓", colorKey: "upp5" },
    1514: { name: "胡思成", colorKey: "upp1" },
    1515: { name: "褚烯南", colorKey: "low1" },
    1516: { name: "邵泽楠", colorKey: "low1" },
    1517: { name: "陈宇阳", colorKey: "upp1" },
    1518: { name: "黄诗然", colorKey: "upp5" },
    1519: { name: "张之恒", colorKey: "upp5" },
    1520: { name: "舒航", colorKey: "upp1" },
    1521: { name: "杨昊鑫", colorKey: "low2" },
    1522: { name: "王羿洋", colorKey: "low2" },
    1523: { name: "李鑫铭", colorKey: "low2" },
    1524: { name: "林书豪", colorKey: "low2" },
    1525: { name: "吴展睿", colorKey: "low2" },
    1526: { name: "向星豫", colorKey: "low2" },
    1527: { name: "席恩蕊", colorKey: "low2" },
    1528: { name: "陈希睿", colorKey: "low2" },
    1529: { name: "欧阳驰盛", colorKey: "low2" },
    1530: { name: "何昊恩", colorKey: "low2" },
    1531: { name: "梁朝文", colorKey: "low2" },
    1532: { name: "刘耀泽", colorKey: "low2" },
    1533: { name: "陈臻昊", colorKey: "low2" },
    1534: { name: "舒玺豫", colorKey: "low2" },
    1535: { name: "肖江浪", colorKey: "low2" },
    1536: { name: "赵星瑞", colorKey: "low2" },
    1537: { name: "段佩言", colorKey: "low2" },
    1538: { name: "霍启成", colorKey: "low2" },
    1539: { name: "姜佑锴", colorKey: "low3" },
    1540: { name: "潘祠熠", colorKey: "low3" },
    1541: { name: "刘轩宇", colorKey: "low3" },
    1542: { name: "田墌尧", colorKey: "low3" },
    1543: { name: "韩辰宇", colorKey: "low3" },
    1544: { name: "戴千皓", colorKey: "low3" },
    1545: { name: "林才涵", colorKey: "low3" },
    1546: { name: "安思源", colorKey: "low3" },
    1547: { name: "张正宇", colorKey: "low3" },
    1548: { name: "冯学嗣", colorKey: "low3" },
    1549: { name: "陈泓昊", colorKey: "low3" },
    1550: { name: "赵若婷", colorKey: "low3" },
    1551: { name: "王毅阳", colorKey: "low3" },
    1552: { name: "刘雨泽", colorKey: "low3" },
    1553: { name: "余瑾", colorKey: "low3" },
    1554: { name: "刘霂轩", colorKey: "low3" },
    1555: { name: "严嘉毅", colorKey: "low3" },
    1556: { name: "罗国航", colorKey: "low3" },
    1557: { name: "陈宇轩", colorKey: "low3" },
    1558: { name: "尼哲林", colorKey: "low3" },
    1559: { name: "祁钰雯", colorKey: "low3" },
    1560: { name: "王嘉诚", colorKey: "low3" },
    1561: { name: "祝晗泽", colorKey: "low2" },
    1562: { name: "李思锐", colorKey: "low3" },
    1563: { name: "齐竟然", colorKey: "low3" },
    1564: { name: "王皓轩", colorKey: "low3" },
    1565: { name: "兰宗霖", colorKey: "low3" },
    1566: { name: "杨洛熹", colorKey: "low3" },
    1567: { name: "陈梓豪", colorKey: "low3" },
    1568: { name: "徐子叶", colorKey: "upp5" },
    1569: { name: "?", colorKey: "upp5" },
    1570: { name: "?", colorKey: "upp5" },
    1571: { name: "陈鸣烨", colorKey: "upp1" },
    1572: { name: "王炜哲", colorKey: "upp5" },
    1573: { name: "?", colorKey: "upp5" },
    1574: { name: "?", colorKey: "upp5" },
    1575: { name: "?", colorKey: "upp5" },
    1576: { name: "石浩天", colorKey: "upp1" },
    1577: { name: "彭赞滔", colorKey: "upp1" },
    1578: { name: "王简博", colorKey: "low2" },
    1579: { name: "李梓潇", colorKey: "low2" },
    1580: { name: "代倬尘", colorKey: "low1" },
    1581: { name: "?", colorKey: "upp5" },
    1582: { name: "陈西贝", colorKey: "low2" },
    1584: { name: "?", colorKey: "upp5" },
    1585: { name: "?", colorKey: "upp5" },
    1586: { name: "牛梓瑞", colorKey: "upp1" },
    1587: { name: "王沐天", colorKey: "is" },
    1588: { name: "张君维", colorKey: "is" },
    1589: { name: "殷子嘉", colorKey: "upp2" },
    1590: { name: "黄镜元", colorKey: "upp3" },
    1591: { name: "张晋嘉", colorKey: "low3" },
    1592: { name: "张泰祯", colorKey: "low3" },
    1593: { name: "吴寒", colorKey: "low3" },
    1594: { name: "汤涵洋溢", colorKey: "low3" },
    1595: { name: "尹绘豪", colorKey: "low2" },
    1596: { name: "杨拾秋", colorKey: "low3" },
    1597: { name: "袁嘉栋", colorKey: "tch" },
    1598: { name: "陈世杰", colorKey: "tch" },
    1599: { name: "刘子悦", colorKey: "tch" },
    1600: { name: "郭懿萱", colorKey: "tch" },
    1601: { name: "汤马宽芯", colorKey: "tch" },
    1602: { name: "罗恺睎", colorKey: "tch" },
    1603: { name: "柯秉逸", colorKey: "tch" },
    1604: { name: "周子杰", colorKey: "tch" },
    1605: { name: "谢乐逸", colorKey: "tch" },
    1606: { name: "赵启杰", colorKey: "tch" },
    1607: { name: "黄紫怡", colorKey: "tch" },
    1608: { name: "张沐岩", colorKey: "tch" },
    1609: { name: "赵晟汐", colorKey: "tch" },
    1610: { name: "汪子叶", colorKey: "tch" },
    1611: { name: "叶依辰", colorKey: "tch" },
    1612: { name: "罗增睿", colorKey: "tch" },
    1613: { name: "龙映汐", colorKey: "low3" },
    1614: { name: "何义金辰", colorKey: "low3" },
    1615: { name: "陈锐欣", colorKey: "low3" },
    1616: { name: "吴安极", colorKey: "low3" },
    1617: { name: "张国智", colorKey: "low3" },
    1618: { name: "张天宇", colorKey: "low3" },
    1619: { name: "江天一", colorKey: "low3" },
    1620: { name: "肖梓逸", colorKey: "low3" },
    1621: { name: "王博恩", colorKey: "low3" },
    1622: { name: "张哲嘉", colorKey: "low3" },
    1623: { name: "熊嘉浩", colorKey: "low3" },
    1624: { name: "易垚鑫", colorKey: "low3" },
    1625: { name: "赵艺然", colorKey: "low2" },
    1626: { name: "李一涵", colorKey: "low2" },
    1627: { name: "何青屹", colorKey: "low2" },
    1628: { name: "赵文婷", colorKey: "low2" },
    1629: { name: "吴牧轩", colorKey: "low2" },
    1630: { name: "袁嘉志", colorKey: "low2" },
    1631: { name: "席梓翔", colorKey: "low2" },
    1632: { name: "曹天意", colorKey: "low2" },
    1633: { name: "钱林齐", colorKey: "low2" },
    1634: { name: "何枘勐", colorKey: "low2" },
    1635: { name: "罗珊", colorKey: "tch" },
    1636: { name: "周彦汐", colorKey: "tch" },
    1637: { name: "宋显然", colorKey: "low1" },
    1638: { name: "高振翔", colorKey: "low3" },
    1639: { name: "王思达", colorKey: "low2" },
    1640: { name: "比赛队伍一", colorKey: "low2" },
    1641: { name: "比赛队伍二", colorKey: "low2" },
    1642: { name: "比赛队伍三", colorKey: "low2" },
    1643: { name: "比赛队伍四", colorKey: "low2" },
    1644: { name: "比赛队伍五", colorKey: "low2" },
    1645: { name: "比赛队伍六", colorKey: "low2" },
    1646: { name: "比赛队伍七", colorKey: "low2" },
    1647: { name: "五年级比赛队", colorKey: "low3" },
    1648: { name: "五年级比赛队", colorKey: "low3" },
    1649: { name: "五年级比赛队", colorKey: "low3" },
    1650: { name: "蒋曜檀", colorKey: "low3" },
    1651: { name: "五年级比赛队", colorKey: "low3" },
    1652: { name: "五年级比赛队", colorKey: "low3" },
    1653: { name: "五年级比赛队", colorKey: "low3" },
    1654: { name: "五年级比赛队", colorKey: "low3" },
    1655: { name: "五年级比赛队", colorKey: "low3" },
    1656: { name: "五年级比赛队", colorKey: "low3" },
    1657: { name: "五年级比赛队", colorKey: "low3" },
    1658: { name: "五年级比赛队", colorKey: "low3" },
    1659: { name: "罗奕诚", colorKey: "tch" },
    1660: { name: "比赛队伍二十", colorKey: "low2" },
    1661: { name: "余思桐", colorKey: "low1" },
    1662: { name: "汤晟睿", colorKey: "low2" },
    1663: { name: "唐梓翔", colorKey: "low1" },
    1664: { name: "唐梓翔", colorKey: "low1" },
    1665: { name: "?", colorKey: "upp5" },
    1666: { name: "?", colorKey: "upp5" },
    1667: { name: "?", colorKey: "upp5" },
    1668: { name: "?", colorKey: "upp5" },
    1669: { name: "?", colorKey: "upp5" },
    1670: { name: "?", colorKey: "upp5" },
    1671: { name: "?", colorKey: "upp5" },
    1672: { name: "?", colorKey: "upp5" },
    1673: { name: "?", colorKey: "upp5" },
    1674: { name: "?", colorKey: "upp5" },
    1675: { name: "?", colorKey: "upp5" },
    1676: { name: "陈泽聪", colorKey: "is" },
    1677: { name: "?", colorKey: "upp5" },
    1678: { name: "吴昊燃", colorKey: "low3" },
    1679: { name: "王翊临", colorKey: "upp1" },
    1680: { name: "龚子昂", colorKey: "is" },
    1681: { name: "高云朗", colorKey: "low2" },
    1682: { name: "陈庆", colorKey: "tch" },
    1683: { name: "胡伟栋", colorKey: "tch" },
    1684: { name: "汪星明", colorKey: "tch" },
    1685: { name: "宋新波", colorKey: "tch" },
    1686: { name: "黄新军", colorKey: "tch" },
    1687: { name: "曾艺卿", colorKey: "tch" },
    1688: { name: "熊超", colorKey: "tch" },
    1689: { name: "向期中", colorKey: "tch" },
    1690: { name: "曹利国", colorKey: "tch" },
    1691: { name: "曹文", colorKey: "tch" },
    1692: { name: "杜沁仪", colorKey: "tch" },
    1693: { name: "屈运华", colorKey: "tch" },
    1694: { name: "徐先友", colorKey: "tch" },
    1695: { name: "周邦", colorKey: "tch" },
    1696: { name: "李天呈", colorKey: "upp3" },
    1697: { name: "施陈豪", colorKey: "upp3" },
    1698: { name: "吴童", colorKey: "upp3" },
    1699: { name: "胡瀚锴", colorKey: "upp2" },
    1700: { name: "黄俊淇", colorKey: "upp2" },
    1701: { name: "任清扬", colorKey: "upp2" },
    1702: { name: "张子卓", colorKey: "upp2" },
    1703: { name: "谷宣萱", colorKey: "upp2" },
    1704: { name: "李青阳", colorKey: "upp2" },
    1705: { name: "孙嘉乐", colorKey: "upp2" },
    1706: { name: "张程皓", colorKey: "upp2" },
    1707: { name: "周乐达", colorKey: "upp1" },
    1708: { name: "周裕杭", colorKey: "upp1" },
    1709: { name: "黄锦扬", colorKey: "upp1" },
    1710: { name: "陈信允", colorKey: "is" },
    1711: { name: "左欣颖", colorKey: "upp3" },
    1712: { name: "董彦成", colorKey: "upp2" },
    1713: { name: "施宇轩", colorKey: "upp2" },
    1714: { name: "武林", colorKey: "upp2" },
    1715: { name: "韩思远", colorKey: "upp2" },
    1716: { name: "刘亦乐", colorKey: "upp2" },
    1717: { name: "殷骏", colorKey: "upp1" },
    1718: { name: "李劭鸿", colorKey: "upp1" },
    1719: { name: "孙志航", colorKey: "upp1" },
    1720: { name: "杨圳", colorKey: "upp3" },
    1721: { name: "马梓航", colorKey: "upp3" },
    1722: { name: "何传奇", colorKey: "upp3" },
    1723: { name: "徐恺", colorKey: "upp3" },
    1724: { name: "马恺阳", colorKey: "upp2" },
    1725: { name: "靳棋皓", colorKey: "upp2" },
    1726: { name: "江俊宏", colorKey: "upp2" },
    1727: { name: "曾韦皓", colorKey: "upp2" },
    1728: { name: "刘家炜", colorKey: "upp2" },
    1729: { name: "潘梓睿", colorKey: "upp3" },
    1730: { name: "李宇瀚", colorKey: "upp3" },
    1731: { name: "师小川", colorKey: "upp3" },
    1732: { name: "徐骁扬", colorKey: "upp3" },
    1733: { name: "林唯宇", colorKey: "upp2" },
    1734: { name: "吴瑞祺", colorKey: "upp2" },
    1735: { name: "张睿宸", colorKey: "upp2" },
    1736: { name: "陈韵霖", colorKey: "upp2" },
    1737: { name: "罗汇翔", colorKey: "upp3" },
    1738: { name: "胡一凡", colorKey: "upp3" },
    1739: { name: "李铭乐洋", colorKey: "upp3" },
    1740: { name: "杨博", colorKey: "upp3" },
    1741: { name: "杨子鉴", colorKey: "upp3" },
    1742: { name: "龚咏乔", colorKey: "upp2" },
    1743: { name: "李文轩", colorKey: "upp2" },
    1744: { name: "林国盛", colorKey: "upp2" },
    1745: { name: "刘丰", colorKey: "upp2" },
    1746: { name: "刘钾", colorKey: "upp2" },
    1747: { name: "谭熙", colorKey: "upp2" },
    1748: { name: "叶书辰", colorKey: "upp2" },
    1749: { name: "万彦麟", colorKey: "upp2" },
    1750: { name: "殷潇轩", colorKey: "upp2" },
    1751: { name: "赵海鲲", colorKey: "upp2" },
    1752: { name: "左天佑", colorKey: "is" },
    1753: { name: "王翊临", colorKey: "upp1" },
    1754: { name: "张书华", colorKey: "upp3" },
    1755: { name: "吕若尘", colorKey: "upp3" },
    1756: { name: "李凌岳", colorKey: "upp3" },
    1757: { name: "王翼天", colorKey: "upp3" },
    1758: { name: "封承成", colorKey: "upp2" },
    1759: { name: "陈诺", colorKey: "upp3" },
    1760: { name: "黄思远", colorKey: "upp3" },
    1761: { name: "张恒毅", colorKey: "upp3" },
    1762: { name: "章弥炫", colorKey: "upp3" },
    1763: { name: "朱翔宇", colorKey: "upp3" },
    1764: { name: "姜子米", colorKey: "upp1" },
    1765: { name: "林诚凯", colorKey: "upp1" },
    1766: { name: "孙梓航", colorKey: "upp1" },
    1767: { name: "胡筝", colorKey: "upp1" },
    1768: { name: "李凯霖", colorKey: "upp3" },
    1769: { name: "孙培轩", colorKey: "upp3" },
    1770: { name: "柳易辰", colorKey: "upp2" },
    1771: { name: "宋弘毅", colorKey: "upp2" },
    1772: { name: "叶焕宸", colorKey: "upp3" },
    1773: { name: "易楚曦", colorKey: "upp3" },
    1774: { name: "李悠然", colorKey: "upp1" },
    1775: { name: "施轩杰", colorKey: "upp1" },
    1776: { name: "全柏锋", colorKey: "upp2" },
    1777: { name: "黄镜元", colorKey: "upp3" },
    1778: { name: "殷子嘉", colorKey: "upp2" },
    1779: { name: "李欣源", colorKey: "upp3" },
    1780: { name: "赵云帆", colorKey: "upp1" },
    1781: { name: "林致远", colorKey: "low2" },
    1782: { name: "林子睿", colorKey: "upp2" },
    1783: { name: "陈朗宁", colorKey: "upp1" },
    1784: { name: "燕子何", colorKey: "upp1" },
    1785: { name: "朱菁轩", colorKey: "upp1" },
    1786: { name: "邱明夷", colorKey: "low3" },
    1787: { name: "王梓", colorKey: "is" },
    1788: { name: "郭铠瑞", colorKey: "is" },
    1789: { name: "胡宸熏", colorKey: "low1" },
    1790: { name: "张博然", colorKey: "low2" },
    1791: { name: "伍芷萱", colorKey: "upp1" },
    1792: { name: "郑焱天", colorKey: "is" },
    1793: { name: "叶明子", colorKey: "is" },
    1794: { name: "?", colorKey: "low1" },
    1795: { name: "周懿轩", colorKey: "low1" },
    1796: { name: "刘安洋", colorKey: "is" },
    1797: { name: "李锦源", colorKey: "low2" },
    1798: { name: "刘丁瑞杰", colorKey: "is" },
    1799: { name: "张益瑞", colorKey: "low3" },
    1800: { name: "?", colorKey: "is" },
    1801: { name: "?", colorKey: "low2" },
    1802: { name: "周梓祺", colorKey: "low1" },
    1803: { name: "谭茗铭", colorKey: "low2" },
    1804: { name: "王诗娴", colorKey: "low2" },
    1805: { name: "温俊锋", colorKey: "low2" },
    1806: { name: "杨宸林子", colorKey: "low2" },
    1807: { name: "程钦荻", colorKey: "low2" },
    1808: { name: "杨景熙", colorKey: "low2" },
    1809: { name: "?", colorKey: "low1" },
    1810: { name: "刘川鲁", colorKey: "low1" },
    1811: { name: "?", colorKey: "low3" },
    1812: { name: "黎红宇", colorKey: "is" },
    1813: { name: "邓岚元", colorKey: "low3" },
    1814: { name: "?", colorKey: "low1" },
    1815: { name: "谢卓成", colorKey: "low2" },
    1816: { name: "吴镕博", colorKey: "low2" },
    1817: { name: "田浩霖", colorKey: "low2" },
    1818: { name: "陈铭轩", colorKey: "low2" },
    1819: { name: "张玹予", colorKey: "low2" },
    1820: { name: "杨明洲", colorKey: "low2" },
    1821: { name: "张舜", colorKey: "low2" },
    1822: { name: "龙隐", colorKey: "low2" },
    1823: { name: "陈炯锟", colorKey: "tch" },
    1824: { name: "王子灏", colorKey: "low2" },
    1825: { name: "龙隐涛", colorKey: "low2" },
    1826: { name: "?", colorKey: "tch" },
    1827: { name: "?", colorKey: "tch" },
    1828: { name: "?", colorKey: "tch" },
    1829: { name: "高洁", colorKey: "tch" },
    1830: { name: "张鑫宇", colorKey: "low2" },
    1831: { name: "张诗语", colorKey: "low2" },
    1832: { name: "戴一诺", colorKey: "low3" },
    1833: { name: "谭景元", colorKey: "upp1" },
    1834: { name: "李映潮", colorKey: "low3" },
    1835: { name: "邓植文", colorKey: "low3" },
    1836: { name: "徐逸涵", colorKey: "tch" },
    1837: { name: "邓培茜", colorKey: "low3" },
    1838: { name: "冯潇文", colorKey: "low2" },
    1839: { name: "葛梓涵", colorKey: "tch" },
    1840: { name: "卢彦希", colorKey: "low3" },
    1841: { name: "谭载铭", colorKey: "tch" },
    1842: { name: "陈炯锟", colorKey: "tch" },
    1843: { name: "于嘉睿", colorKey: "low2" },
    1844: { name: "吴其畅", colorKey: "low2" },
    1845: { name: "罗新然", colorKey: "low2" },
    1846: { name: "贾诺", colorKey: "low2" },
    1847: { name: "顾静浩", colorKey: "low2" },
    1848: { name: "骆泊成", colorKey: "low2" },
    1849: { name: "余宸浩", colorKey: "low1" },
    1850: { name: "周宥丞", colorKey: "low1" },
    1851: { name: "李悦廷", colorKey: "low1" },
    1852: { name: "杨安琪", colorKey: "low1" },
    1853: { name: "万开阳", colorKey: "tch" },
    1854: { name: "刘凌逍", colorKey: "low3" },
    1855: { name: "常宸铭", colorKey: "low3" },
    1856: { name: "张中乾", colorKey: "low3" },
    1857: { name: "李星沂", colorKey: "tch" },
    1858: { name: "王思陈", colorKey: "low3" },
    1859: { name: "郑立煊", colorKey: "low3" },
    1860: { name: "余辰浩", colorKey: "low2" },
    1861: { name: "夏悦翔", colorKey: "low2" },
    1862: { name: "张家睿", colorKey: "low2" },
    1863: { name: "李东哲", colorKey: "low2" },
    1864: { name: "杨程博", colorKey: "low2" },
    1865: { name: "邹宇霄", colorKey: "low2" },
    1866: { name: "仲峻泽", colorKey: "is" },
    1867: { name: "何汶珀", colorKey: "is" },
    1868: { name: "卿皓方", colorKey: "is" },
    1869: { name: "吴佑祺", colorKey: "is" },
    1870: { name: "李柯慰", colorKey: "is" },
    1871: { name: "谢一宸", colorKey: "is" },
    1872: { name: "陈屹瑶", colorKey: "is" },
    1873: { name: "王志航", colorKey: "low1" },
    1874: { name: "苗域腾", colorKey: "low1" },
    1875: { name: "邓贺一", colorKey: "low1" },
    1876: { name: "陶成赟", colorKey: "low1" },
    1877: { name: "何浩榕", colorKey: "upp1" },
    1878: { name: "傅炫淅", colorKey: "upp1" },
    1879: { name: "冯子涵", colorKey: "upp1" },
    1880: { name: "刘瑞然", colorKey: "upp1" },
    1881: { name: "吕欣阳", colorKey: "upp1" },
    1882: { name: "孙崇文", colorKey: "upp1" },
    1883: { name: "宋翰翔", colorKey: "upp1" },
    1884: { name: "岳志远", colorKey: "upp1" },
    1885: { name: "张凯越", colorKey: "upp1" },
    1886: { name: "张晖毓", colorKey: "upp1" },
    1887: { name: "彭飞", colorKey: "upp1" },
    1888: { name: "徐振洋", colorKey: "upp1" },
    1889: { name: "晏紫哲", colorKey: "upp1" },
    1890: { name: "曹艺航", colorKey: "upp1" },
    1891: { name: "曾旷宇", colorKey: "upp1" },
    1892: { name: "朱彦宁", colorKey: "upp1" },
    1893: { name: "林思翰", colorKey: "upp1" },
    1894: { name: "梅歆岚", colorKey: "upp1" },
    1895: { name: "汤孟翰", colorKey: "upp1" },
    1896: { name: "汪润桐", colorKey: "upp1" },
    1897: { name: "沈嘉祺", colorKey: "upp1" },
    1898: { name: "王冠杰", colorKey: "upp1" },
    1899: { name: "王子扬", colorKey: "upp1" },
    1900: { name: "秦遥昕", colorKey: "upp1" },
    1901: { name: "蒋逸菲", colorKey: "upp1" },
    1902: { name: "赖钇江", colorKey: "upp1" },
    1903: { name: "赵熠辉", colorKey: "upp1" },
    1904: { name: "黄爱鑫", colorKey: "upp1" },
    1905: { name: "余子宸", colorKey: "upp2" },
    1906: { name: "吴家旭", colorKey: "upp1" },
    1907: { name: "吴诺轩", colorKey: "upp2" },
    1908: { name: "夏瑞焓", colorKey: "upp1" },
    1909: { name: "崔景皓", colorKey: "upp1" },
    1910: { name: "彭云开", colorKey: "upp1" },
    1911: { name: "申翼豪", colorKey: "upp1" },
    1912: { name: "蒲恩伋", colorKey: "upp2" },
    1913: { name: "邓心宇", colorKey: "upp2" },
    1914: { name: "龙柄翰", colorKey: "upp2" },
    1915: { name: "况奕辛", colorKey: "upp5" },
    1916: { name: "宋子瑜", colorKey: "is" },
    1917: { name: "宋正航", colorKey: "upp5" },
    1918: { name: "张芮杨", colorKey: "is" },
    1919: { name: "曹杨弋航", colorKey: "upp5" },
    1920: { name: "朱航亿", colorKey: "upp5" },
    1921: { name: "梁睿宸", colorKey: "upp2" },
    1922: { name: "杨峥圻", colorKey: "upp5" },
    1923: { name: "杨骑瑞", colorKey: "upp5" },
    1924: { name: "林凯鑫", colorKey: "upp5" },
    1925: { name: "李杭", colorKey: "upp5" },
    1926: { name: "段凯迪", colorKey: "upp1" },
    1927: { name: "沈钰宸", colorKey: "upp1" },
    1928: { name: "洪子杰", colorKey: "upp2" },
    1929: { name: "白益宁", colorKey: "upp2" },
    1930: { name: "郑栋文", colorKey: "upp5" },
    1931: { name: "?", colorKey: "upp5" },
    1932: { name: "侯宇彤", colorKey: "upp1" },
    1933: { name: "李昊儒", colorKey: "is" },
    1934: { name: "林天辰", colorKey: "upp1" },
    1935: { name: "刘锦晨", colorKey: "tch" },
    1936: { name: "唐潮", colorKey: "tch" },
    1937: { name: "徐计辰", colorKey: "tch" },
    1938: { name: "徐宥一", colorKey: "upp1" },
    1939: { name: "杨持", colorKey: "low1" },
    1940: { name: "叶彦哲", colorKey: "is" },
    1941: { name: "?", colorKey: "upp5" },
    1942: { name: "?", colorKey: "upp5" },
    1943: { name: "周裕博", colorKey: "upp3" },
    1944: { name: "李天憬", colorKey: "upp2" },
    1945: { name: "叶禹超", colorKey: "upp5" },
    1946: { name: "吕佳锴", colorKey: "upp2" },
    1947: { name: "周昊宇", colorKey: "upp5" },
    1948: { name: "朱梓煊", colorKey: "upp1" },
    1949: { name: "凌一璐", colorKey: "upp2" },
    1950: { name: "王吴凡", colorKey: "upp2" },
    1951: { name: "王子赫", colorKey: "upp1" },
    1952: { name: "谢雨轩", colorKey: "upp2" },
    1953: { name: "陆冠宇", colorKey: "upp1" },
    1954: { name: "陈凌寒", colorKey: "upp2" },
    1955: { name: "汤陈辉", colorKey: "upp2" },
    1956: { name: "王舟扬", colorKey: "upp2" },
    1957: { name: "武子宸", colorKey: "upp2" },
    1958: { name: "杨博宇", colorKey: "upp2" },
    1959: { name: "戚宏哲", colorKey: "upp2" },
    1960: { name: "刘翀羽", colorKey: "upp1" },
    1961: { name: "孔肖婷", colorKey: "upp1" },
    1962: { name: "孙睿泽", colorKey: "is" },
    1963: { name: "?", colorKey: "upp5" },
    1964: { name: "张家瑜", colorKey: "upp5" },
    1965: { name: "徐章涵", colorKey: "upp1" },
    1966: { name: "朱晗俊", colorKey: "upp1" },
    1967: { name: "林晋逸", colorKey: "upp5" },
    1968: { name: "潘相州", colorKey: "upp1" },
    1969: { name: "窦铭泽", colorKey: "is" },
    1970: { name: "童振轩", colorKey: "upp2" },
    1971: { name: "缪修楚", colorKey: "upp1" },
    1972: { name: "?", colorKey: "upp5" },
    1973: { name: "薛淦", colorKey: "upp1" },
    1974: { name: "黄仁和", colorKey: "upp1" },
    1975: { name: "黄林宸", colorKey: "upp5" },
    1976: { name: "杨子瀚", colorKey: "low2" },
    1977: { name: "倪宇梒", colorKey: "upp2" },
    1978: { name: "张承淇", colorKey: "low3" },
    1979: { name: "姚景耀", colorKey: "upp1" },
    1980: { name: "张东懿", colorKey: "upp1" },
    1981: { name: "张宇轩", colorKey: "upp2" },
    1982: { name: "张涵博", colorKey: "upp2" },
    1983: { name: "郭子轩", colorKey: "upp2" },
    1984: { name: "?", colorKey: "upp5" },
    1985: { name: "黄柏铭", colorKey: "is" },
    1986: { name: "王一帆", colorKey: "low3" },
    1987: { name: "谢腾毅", colorKey: "low2" },
    1988: { name: "蒋洋", colorKey: "low2" },
    1989: { name: "常裕宸", colorKey: "upp2" },
    1990: { name: "?", colorKey: "upp5" },
    1991: { name: "?", colorKey: "upp5" },
    1992: { name: "吴禹谦", colorKey: "low3" },
    1993: { name: "丁瑾辰", colorKey: "low2" },
    1994: { name: "刘腾骏", colorKey: "tch" },
    1995: { name: "陈忠亮", colorKey: "is" },
    1996: { name: "栗稼浩", colorKey: "low1" },
    1997: { name: "魏俊康", colorKey: "tch" },
    1998: { name: "唐睿思", colorKey: "low3" },
    1999: { name: "张小语", colorKey: "tch" },
    2000: { name: "杨安琪", colorKey: "low1" },
    2001: { name: "尹想雳", colorKey: "low2" },
    2002: { name: "李九源", colorKey: "low1" },
    2003: { name: "雷鈜森", colorKey: "is" },
    2004: { name: "王梓涵", colorKey: "low2" },
    2005: { name: "涂志诚", colorKey: "low1" },
    2006: { name: "朱晨希", colorKey: "low3" },
    2007: { name: "吴子越", colorKey: "low1" },
    2008: { name: "张一言", colorKey: "upp2" },
    2009: { name: "王勋", colorKey: "upp2" },
    2010: { name: "张恩齐", colorKey: "is" },
    2011: { name: "?", colorKey: "upp5" },
    2012: { name: "?", colorKey: "upp5" },
    2013: { name: "?", colorKey: "upp5" },
    2014: { name: "?", colorKey: "upp5" },
    2015: { name: "?", colorKey: "upp5" },
    2016: { name: "?", colorKey: "upp5" },
    2017: { name: "?", colorKey: "upp5" },
    2018: { name: "黄显哲", colorKey: "low3" },
    2019: { name: "强轩铭", colorKey: "low3" },
    2020: { name: "郭籽辰", colorKey: "low3" },
    2021: { name: "刘缤年", colorKey: "low3" },
    2022: { name: "吴呢玥", colorKey: "low3" },
    2023: { name: "佘浚豪", colorKey: "tch" },
    2024: { name: "吴文曦", colorKey: "low1" },
    2025: { name: "?", colorKey: "low3" },
    2026: { name: "?", colorKey: "low3" },
    2027: { name: "?", colorKey: "low3" },
    2028: { name: "?", colorKey: "low3" },
    2029: { name: "?", colorKey: "low3" },
    2030: { name: "?", colorKey: "low3" },
    2031: { name: "?", colorKey: "low3" },
    2032: { name: "?", colorKey: "low3" },
    2033: { name: "?", colorKey: "low3" },
    2034: { name: "?", colorKey: "low3" },
    2035: { name: "?", colorKey: "low3" },
    2036: { name: "?", colorKey: "low3" },
    2037: { name: "?", colorKey: "low3" },
    2038: { name: "?", colorKey: "low3" },
    2039: { name: "?", colorKey: "low3" },
    2040: { name: "?", colorKey: "low3" },
    2041: { name: "?", colorKey: "low3" },
    2042: { name: "?", colorKey: "low3" },
    2043: { name: "?", colorKey: "low3" },
    2044: { name: "?", colorKey: "low3" },
    2045: { name: "?", colorKey: "low3" },
    2046: { name: "?", colorKey: "low3" },
    2047: { name: "?", colorKey: "low3" },
    2048: { name: "?", colorKey: "low3" },
    2049: { name: "?", colorKey: "low3" },
    2050: { name: "?", colorKey: "low3" },
    2051: { name: "?", colorKey: "low3" },
    2052: { name: "?", colorKey: "low3" },
    2053: { name: "?", colorKey: "low3" },
    2054: { name: "?", colorKey: "low3" },
    2055: { name: "?", colorKey: "low3" },
    2056: { name: "?", colorKey: "low3" },
    2057: { name: "?", colorKey: "low3" },
    2058: { name: "?", colorKey: "low3" },
    2059: { name: "?", colorKey: "low3" },
    2060: { name: "?", colorKey: "low3" },
    2061: { name: "?", colorKey: "low3" },
    2062: { name: "?", colorKey: "low3" },
    2063: { name: "?", colorKey: "low3" },
    2064: { name: "?", colorKey: "low3" },
    2065: { name: "?", colorKey: "low3" },
    2066: { name: "?", colorKey: "low3" },
    2067: { name: "?", colorKey: "low3" },
    2068: { name: "?", colorKey: "low3" },
    2069: { name: "?", colorKey: "low3" },
    2070: { name: "?", colorKey: "low3" },
    2071: { name: "?", colorKey: "low3" },
    2072: { name: "?", colorKey: "low3" },
    2073: { name: "?", colorKey: "low3" },
    2074: { name: "?", colorKey: "low3" },
    2075: { name: "?", colorKey: "low3" },
    2076: { name: "?", colorKey: "low3" },
    2077: { name: "?", colorKey: "low3" },
    2078: { name: "?", colorKey: "low3" },
    2079: { name: "?", colorKey: "low3" },
    2080: { name: "?", colorKey: "low3" },
    2081: { name: "?", colorKey: "low3" },
    2082: { name: "?", colorKey: "low3" },
    2083: { name: "?", colorKey: "low3" },
    2084: { name: "?", colorKey: "low3" },
    2085: { name: "?", colorKey: "low3" },
    2086: { name: "?", colorKey: "low3" },
    2087: { name: "?", colorKey: "low3" },
    2088: { name: "?", colorKey: "low3" },
    2089: { name: "?", colorKey: "low3" },
    2090: { name: "?", colorKey: "low3" },
    2091: { name: "?", colorKey: "low3" },
    2092: { name: "?", colorKey: "low3" },
    2093: { name: "?", colorKey: "low3" },
    2094: { name: "?", colorKey: "low3" },
    2095: { name: "?", colorKey: "low3" },
    2096: { name: "?", colorKey: "low3" },
    2097: { name: "?", colorKey: "low3" },
    2098: { name: "?", colorKey: "low3" },
    2099: { name: "?", colorKey: "low3" },
    2100: { name: "?", colorKey: "low3" },
    2101: { name: "?", colorKey: "low3" },
    2102: { name: "?", colorKey: "low3" },
    2103: { name: "?", colorKey: "low3" },
    2104: { name: "?", colorKey: "low3" },
    2105: { name: "?", colorKey: "low3" },
    2106: { name: "?", colorKey: "low3" },
    2107: { name: "?", colorKey: "low3" },
    2108: { name: "?", colorKey: "low3" },
    2109: { name: "?", colorKey: "low3" },
    2110: { name: "?", colorKey: "low3" },
    2111: { name: "?", colorKey: "low3" },
    2112: { name: "?", colorKey: "low3" },
    2113: { name: "?", colorKey: "low3" },
    2114: { name: "?", colorKey: "low3" },
    2115: { name: "?", colorKey: "low3" },
    2116: { name: "?", colorKey: "low3" },
    2117: { name: "?", colorKey: "low3" },
    2118: { name: "?", colorKey: "low3" },
    2119: { name: "?", colorKey: "low3" },
    2120: { name: "张晗弈", colorKey: "low3" },
    2121: { name: "钟佳润", colorKey: "tch" },
    2122: { name: "陈世海", colorKey: "low1" },
    2123: { name: "但思喆", colorKey: "low3" },
    2124: { name: "?", colorKey: "low3" },
    2125: { name: "冯昱皓", colorKey: "low3" },
    2126: { name: "邓诣恬", colorKey: "low3" },
    2127: { name: "王皓轩", colorKey: "low3" },
    2128: { name: "刘尚宸", colorKey: "low3" },
    2129: { name: "张奕晨", colorKey: "low3" },
    2130: { name: "李凌舟", colorKey: "low3" },
    2131: { name: "方思为", colorKey: "low3" },
    2132: { name: "杨箪语", colorKey: "low3" },
    2133: { name: "戴柏霖", colorKey: "low3" },
    2134: { name: "胡竞洋", colorKey: "low3" },
    2135: { name: "王德汭", colorKey: "low3" },
    2136: { name: "陈俊皓", colorKey: "low3" },
    2137: { name: "杨卓晗", colorKey: "low3" },
    2138: { name: "陆逸倩", colorKey: "low3" },
    2139: { name: "郑好", colorKey: "low3" },
    2140: { name: "唐润东", colorKey: "low3" },
    2141: { name: "罗辰晔", colorKey: "low3" },
    2142: { name: "张皓跃", colorKey: "low3" },
    2143: { name: "易子浩", colorKey: "low3" },
    2144: { name: "吴呢玥", colorKey: "low3" },
    2145: { name: "鲍冠臣", colorKey: "low1" },
    2146: { name: "钟皓宸", colorKey: "low3" },
    2147: { name: "强昊森", colorKey: "low3" },
    2148: { name: "张泽坤", colorKey: "low3" },
    2149: { name: "鲜子周", colorKey: "low2" },
    2150: { name: "刘璟衫", colorKey: "low3" },
    2151: { name: "陈唐致君", colorKey: "tch" },
    2152: { name: "李景辰", colorKey: "low2" },
    2153: { name: "何洺燃", colorKey: "is" },
    2154: { name: "何牧阳", colorKey: "low2" },
    2155: { name: "袁楚为", colorKey: "low2" },
    2156: { name: "陈红火", colorKey: "low2" },
    2157: { name: "陈子祺", colorKey: "low2" },
    2158: { name: "李修瀚", colorKey: "low3" },
    2159: { name: "程楷倢", colorKey: "tch" },
    2160: { name: "李子木", colorKey: "low3" },
    2161: { name: "吕沛霖", colorKey: "low2" },
    2162: { name: "陈一豪", colorKey: "low2" },
    2163: { name: "陈红火", colorKey: "low2" },
    2164: { name: "袁楚为", colorKey: "low2" },
    2165: { name: "杨雨彤", colorKey: "low2" },
    2166: { name: "何牧阳", colorKey: "low2" },
    2167: { name: "皮杨", colorKey: "tch" },
    2168: { name: "胡琰皓", colorKey: "low3" },
    2169: { name: "陈艳梅", colorKey: "tch" },
    2170: { name: "王多灵", colorKey: "tch" },
    2171: { name: "彭渝涵", colorKey: "is" },
    2172: { name: "李泓烨", colorKey: "is" },
    2173: { name: "张蜀珺", colorKey: "is" },
    2174: { name: "王彦杰", colorKey: "is" },
    2175: { name: "李雪梅", colorKey: "upp3" },
    2176: { name: "刘子墨", colorKey: "is" },
    2177: { name: "张尽欢", colorKey: "is" },
    2178: { name: "陈一铭", colorKey: "tch" },
    2179: { name: "唐东来", colorKey: "low3" },
    2180: { name: "杨韵栩", colorKey: "low3" },
    2181: { name: "郑茗腾", colorKey: "low2" },
    2182: { name: "蔡明宸", colorKey: "tch" },
    2183: { name: "管文豪", colorKey: "low3" },
    2184: { name: "张逸宸", colorKey: "low3" },
    2185: { name: "张子睿", colorKey: "tch" },
    2186: { name: "王浩丞", colorKey: "tch" },
    2187: { name: "佘浚豪", colorKey: "tch" },
    2188: { name: "李晨文", colorKey: "tch" },
    2189: { name: "王振衣", colorKey: "tch" },
    2190: { name: "陈炯锟", colorKey: "tch" },
    2191: { name: "张照理", colorKey: "tch" },
    2192: { name: "兰熙荣", colorKey: "tch" },
    2193: { name: "郑楚扬", colorKey: "low3" },
    2194: { name: "何乐", colorKey: "tch" },
    2195: { name: "石菲雨", colorKey: "tch" },
    2196: { name: "雷迪文", colorKey: "low3" },
    2197: { name: "陈唐致君", colorKey: "tch" },
    2198: { name: "张小语", colorKey: "tch" },
    2199: { name: "赵子一", colorKey: "tch" },
    2200: { name: "刘奕辰", colorKey: "tch" },
    2201: { name: "汪楷宸", colorKey: "tch" },
    2202: { name: "唐一诺", colorKey: "tch" },
    2203: { name: "韩贝怡", colorKey: "tch" },
    2204: { name: "蒋予希", colorKey: "tch" },
    2205: { name: "梁煜晨", colorKey: "tch" },
    2206: { name: "刘昭远", colorKey: "tch" },
    2207: { name: "刘梓皓", colorKey: "tch" },
    2208: { name: "彭亦凡", colorKey: "tch" },
    2209: { name: "任宇晨", colorKey: "tch" },
    2210: { name: "刘腾骏", colorKey: "tch" },
    2211: { name: "陈笑涵", colorKey: "low3" },
    2212: { name: "刁一一", colorKey: "tch" },
    2213: { name: "陈旻柯", colorKey: "tch" },
    2214: { name: "栾稚睿", colorKey: "tch" },
    2215: { name: "郭一琛", colorKey: "tch" },
    2216: { name: "姚宸羽", colorKey: "tch" },
    2217: { name: "李芊妤", colorKey: "tch" },
    2218: { name: "贺礼博", colorKey: "tch" },
    2219: { name: "路海川", colorKey: "tch" },
    2220: { name: "彭弈之", colorKey: "tch" },
    2221: { name: "赵文鼎", colorKey: "tch" },
    2222: { name: "吴志涵", colorKey: "tch" },
    2223: { name: "王皓霖", colorKey: "tch" },
    2224: { name: "王语桐", colorKey: "tch" },
    2225: { name: "王子骏", colorKey: "tch" },
    2226: { name: "刘思远", colorKey: "tch" },
    2227: { name: "刘历桐", colorKey: "tch" },
    2228: { name: "米云铎", colorKey: "tch" },
    2229: { name: "贾致远", colorKey: "tch" },
    2230: { name: "冯绍峰", colorKey: "tch" },
    2231: { name: "黄馨頨", colorKey: "tch" },
    2232: { name: "罗奕诚", colorKey: "tch" },
    2233: { name: "成中天", colorKey: "tch" },
    2234: { name: "谭载铭", colorKey: "tch" },
    2235: { name: "万开阳", colorKey: "tch" },
    2236: { name: "葛梓涵", colorKey: "tch" },
    2237: { name: "赵屿筝", colorKey: "tch" },
    2238: { name: "龚科宇", colorKey: "tch" },
    2239: { name: "李昊睿", colorKey: "tch" },
    2240: { name: "李泓铖", colorKey: "tch" },
    2241: { name: "杨拾秋", colorKey: "low3" },
    2242: { name: "王晨鑫", colorKey: "low3" },
    2243: { name: "韩辰宇", colorKey: "low3" },
    2244: { name: "田墌尧", colorKey: "low3" },
    2245: { name: "曹熙之", colorKey: "tch" },
    2246: { name: "肖尧腾", colorKey: "low3" },
    2247: { name: "张浩玺", colorKey: "low3" },
    2248: { name: "张钦赫", colorKey: "low2" },
    2249: { name: "罗皓扬", colorKey: "tch" },
    2250: { name: "杨梦", colorKey: "tch" },
    2251: { name: "梁凯", colorKey: "tch" },
    2252: { name: "韦莉娜", colorKey: "tch" },
    2253: { name: "欧阳宇轩", colorKey: "low2" },
    2254: { name: "张淑华", colorKey: "low2" },
    2255: { name: "?", colorKey: "upp5" },
    2256: { name: "?", colorKey: "upp5" },
    2257: { name: "?", colorKey: "upp5" },
    2258: { name: "?", colorKey: "upp5" },
    2259: { name: "?", colorKey: "upp5" },
    2260: { name: "?", colorKey: "upp5" },
    2261: { name: "?", colorKey: "upp5" },
    2262: { name: "?", colorKey: "upp5" },
    2263: { name: "?", colorKey: "upp5" },
    2264: { name: "?", colorKey: "upp5" },
    2265: { name: "?", colorKey: "upp5" },
    2266: { name: "?", colorKey: "upp5" },
    2267: { name: "?", colorKey: "upp5" },
    2268: { name: "?", colorKey: "upp5" },
    2269: { name: "孙瑞泽", colorKey: "upp5" },
    2270: { name: "?", colorKey: "upp5" },
    2271: { name: "?", colorKey: "upp5" },
    2272: { name: "?", colorKey: "upp5" },
    2273: { name: "?", colorKey: "upp5" },
    2274: { name: "?", colorKey: "upp5" },
    2275: { name: "?", colorKey: "upp5" },
    2276: { name: "?", colorKey: "upp5" },
    2277: { name: "?", colorKey: "upp5" },
    2278: { name: "?", colorKey: "upp5" },
    2279: { name: "?", colorKey: "upp5" },
    2280: { name: "?", colorKey: "upp5" },
    2281: { name: "?", colorKey: "upp5" },
    2282: { name: "?", colorKey: "upp5" },
    2283: { name: "?", colorKey: "upp5" },
    2284: { name: "?", colorKey: "upp5" },
    2285: { name: "?", colorKey: "upp5" },
    2286: { name: "?", colorKey: "upp5" },
    2287: { name: "?", colorKey: "upp5" },
    2288: { name: "?", colorKey: "upp5" },
    2289: { name: "?", colorKey: "upp5" },
    2290: { name: "?", colorKey: "upp5" },
    2291: { name: "?", colorKey: "upp5" },
    2292: { name: "?", colorKey: "upp5" },
    2293: { name: "?", colorKey: "upp5" },
    2294: { name: "?", colorKey: "upp5" },
    2295: { name: "?", colorKey: "upp5" },
    2296: { name: "?", colorKey: "upp5" },
    2297: { name: "?", colorKey: "upp5" },
    2298: { name: "?", colorKey: "upp5" },
    2299: { name: "?", colorKey: "upp5" },
    2300: { name: "杨卓霖", colorKey: "low3" },
    2301: { name: "吴卓衡", colorKey: "low3" },
    2302: { name: "张宸弋", colorKey: "low3" },
    2303: { name: "周靖朗", colorKey: "low3" },
    2304: { name: "罗浚宸", colorKey: "low1" },
    2305: { name: "何政霄", colorKey: "low1" },
    2306: { name: "黎相廷", colorKey: "low1" },
    2307: { name: "敖梓轩", colorKey: "low3" },
    2308: { name: "王泽睿", colorKey: "tch" },
    2309: { name: "张中乾", colorKey: "low3" },
    2310: { name: "徐晨骁", colorKey: "tch" },
    2311: { name: "刘慧胤", colorKey: "tch" },
    2312: { name: "朱丹蕾", colorKey: "tch" },
    2313: { name: "廖赵吕", colorKey: "tch" },
    2314: { name: "雷欣", colorKey: "tch" },
    2315: { name: "晁敬知", colorKey: "low3" },
    2316: { name: "付垚叡", colorKey: "low3" },
    2317: { name: "张珈源", colorKey: "upp2" },
    2318: { name: "肖浩宇", colorKey: "upp1" },
    2319: { name: "陈浩哲", colorKey: "low3" },
    2320: { name: "李秉樾", colorKey: "low1" },
    2321: { name: "黄子宸", colorKey: "tch" },
    2322: { name: "王彬翰", colorKey: "tch" },
    2323: { name: "刘若涵", colorKey: "low3" },
    2324: { name: "卓凯琳", colorKey: "tch" },
    2325: { name: "刘佳欣", colorKey: "tch" },
    2326: { name: "黄柱寰", colorKey: "low3" },
    2327: { name: "熊浩成", colorKey: "low3" },
    2328: { name: "刘子谦", colorKey: "low2" },
    2329: { name: "马浚杰", colorKey: "low1" },
    2330: { name: "黄秉南", colorKey: "low1" },
    2331: { name: "邓宗浩", colorKey: "low1" },
    2332: { name: "?", colorKey: "upp5" },
    2333: { name: "朱君浩", colorKey: "upp5" },
    2334: { name: "刘峻铭", colorKey: "low3" },
    2335: { name: "龙俊希", colorKey: "low3" },
    2336: { name: "冷思辰", colorKey: "is" },
    2337: { name: "张健佳", colorKey: "upp2" },
    2338: { name: "谢来恩", colorKey: "tch" },
    2339: { name: "胥国豪", colorKey: "is" },
    2340: { name: "周一可", colorKey: "tch" },
    2341: { name: "赵钰轩", colorKey: "tch" },
    2342: { name: "申鸿程", colorKey: "upp1" },
    2343: { name: "蒙柏宇", colorKey: "tch" },
    2344: { name: "雷振宇", colorKey: "tch" },
    2345: { name: "张博艺", colorKey: "tch" },
    2346: { name: "文兴忞", colorKey: "tch" },
    2347: { name: "马徐元", colorKey: "tch" },
    2348: { name: "邵令芃", colorKey: "tch" },
    2349: { name: "陆博观", colorKey: "tch" },
    2350: { name: "毛晨阳", colorKey: "tch" },
    2351: { name: "任思澄", colorKey: "tch" },
    2352: { name: "任书成", colorKey: "tch" },
    2353: { name: "余宝桢", colorKey: "tch" },
    2354: { name: "袁梓瑞", colorKey: "tch" },
    2355: { name: "邓皓轩", colorKey: "low1" },
    2356: { name: "付彦哲", colorKey: "tch" },
    2357: { name: "张梓骁", colorKey: "low1" },
    2358: { name: "马骁", colorKey: "tch" },
    2359: { name: "高子琪", colorKey: "tch" },
    2360: { name: "罗梓轩", colorKey: "tch" },
    2361: { name: "张子轩", colorKey: "tch" },
    2362: { name: "殷浩诚", colorKey: "tch" },
    2363: { name: "殷浩然", colorKey: "tch" },
    2364: { name: "何云汎", colorKey: "tch" },
    2365: { name: "周蛇飞", colorKey: "tch" },
    2366: { name: "徐一丁", colorKey: "tch" },
    2367: { name: "龚鑫宇", colorKey: "tch" },
    2368: { name: "林欣宜", colorKey: "low3" },
    2369: { name: "魏圣懿", colorKey: "tch" },
    2370: { name: "蒋其恒", colorKey: "tch" },
    2371: { name: "胡佳文", colorKey: "tch" },
    2372: { name: "王南棠", colorKey: "low3" },
    2373: { name: "黄瑞浩", colorKey: "low3" },
    2374: { name: "卢钇宁", colorKey: "low3" },
    2375: { name: "佘佳霖", colorKey: "upp1" },
    2376: { name: "蔡峻安", colorKey: "low1" },
    2377: { name: "章启钰", colorKey: "low3" },
    2378: { name: "雷鈜森", colorKey: "upp1" },
    2379: { name: "王子南", colorKey: "low1" },
    2380: { name: "鄢瑞羲", colorKey: "low3" },
    2381: { name: "徐煜恒", colorKey: "low3" },
    2382: { name: "沙源清", colorKey: "tch" },
    2383: { name: "何云", colorKey: "low3" },
    2384: { name: "程锦熙", colorKey: "tch" },
    2385: { name: "李铭瀚", colorKey: "low2" },
    2386: { name: "林悦", colorKey: "low2" },
    2387: { name: "刘锦潮", colorKey: "low2" },
    2388: { name: "刘锦蒙", colorKey: "low2" },
    2389: { name: "刘彦彤", colorKey: "low2" },
    2390: { name: "牟林锋", colorKey: "low2" },
    2391: { name: "汤马宽", colorKey: "low2" },
    2392: { name: "杨孝晨", colorKey: "low3" },
    2393: { name: "喻浩轩", colorKey: "low2" },
    2394: { name: "王紫淇", colorKey: "low2" },
    2395: { name: "章启钰", colorKey: "tch" },
    2396: { name: "彭有有", colorKey: "low3" },
    2397: { name: "徐煜恒", colorKey: "low2" },
    2398: { name: "鄢瑞", colorKey: "low3" },
    2399: { name: "周峻西", colorKey: "low3" },
    2400: { name: "徐守中", colorKey: "low2" },
    2401: { name: "陈奕辰", colorKey: "low1" },
    2402: { name: "王语哲", colorKey: "tch" },
    2403: { name: "李俊贤", colorKey: "upp1" },
    2404: { name: "白梓铎", colorKey: "low2" },
    2405: { name: "张博恩", colorKey: "low1" },
    2406: { name: "林先洋", colorKey: "low2" },
    2407: { name: "王梓涵", colorKey: "low1" },
    2408: { name: "李一杭", colorKey: "low2" },
    2409: { name: "王白逸飞", colorKey: "tch" },
    2410: { name: "刘子默", colorKey: "low3" },
    2411: { name: "汤马宽芯", colorKey: "low3" },
    2412: { name: "谢东峻", colorKey: "low3" },
    2413: { name: "张棕钲", colorKey: "low3" },
    2414: { name: "李子睿", colorKey: "tch" },
    2415: { name: "刘琪娅", colorKey: "tch" },
    2416: { name: "王奕程", colorKey: "low2" },
    2417: { name: "任俊帆", colorKey: "is" },
    2418: { name: "王彦杰", colorKey: "is" },
    2419: { name: "詹智程", colorKey: "is" },
    2420: { name: "蔡子彧", colorKey: "low3" },
    2421: { name: "赖俊谚", colorKey: "low3" },
    2422: { name: "罗晨洋", colorKey: "low3" },
    2423: { name: "史浩言", colorKey: "low3" },
    2424: { name: "张晗奕", colorKey: "low3" },
    2425: { name: "熊佑齐", colorKey: "tch" },
    2426: { name: "李品均", colorKey: "tch" },
    2427: { name: "杨书", colorKey: "tch" },
    2428: { name: "段程源", colorKey: "tch" },
    2429: { name: "蒋洋", colorKey: "low2" },
    2430: { name: "李卓庭", colorKey: "low3" },
    2431: { name: "董黎昕", colorKey: "tch" },
    2432: { name: "刘泽慧", colorKey: "low1" }
  };

  /* ----------------------------------------------------------------
   *  8) 页面特定逻辑
   * ---------------------------------------------------------------- */
  function firstVisibleCharOfTitle() {
    const h1 = document.querySelector('body > div:nth-child(2) > div > div.ui.center.aligned.grid > div > h1');
    if (!h1) return '';
    const s = (h1.textContent || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    return s ? s[0].toUpperCase() : '';
  }

  function fEasierClip() {
    if (!/\/problem\//.test(location.pathname)) return;
    if (firstVisibleCharOfTitle() === 'L') return;
    if (document.getElementById('bn-copy-btn')) return; // 防重复

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
    // 放在 fEasierClip 内、fetch 之后，复制之前
    function stripLeadingBlank(text) {
      // 1) 统一换行为 \n，避免 \r\n 干扰
      let s = text.replace(/\r\n/g, '\n');
      // 2) 去掉 BOM、零宽空格/连接符等“不可见字符”
      s = s.replace(/^[\uFEFF\u200B-\u200D\u2060]+/, '');
      // 3) 去掉「若干空格/Tab 后跟换行」形成的“空白行块”
      s = s.replace(/^(?:[ \t]*\n)+/, '');
      return s;
    }

    btn.onclick = async () => {
      const originalText = btn.textContent;
      const originalBg = btn.style.backgroundColor;
      const originalColor = btn.style.color;

      // 处理中态（样式保持原样、仅改文字并禁用点击）
      btn.textContent = '处理中…';
      btn.style.pointerEvents = 'none';

      try {
        const res = await fetch(location.href.replace(/\/$/, '') + '/markdown/text', { credentials: 'include' });
        let text = await res.text();
        text = stripLeadingBlank(text);   // ← 关键：清理开头空行/不可见字符

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

        // 成功：绿底白字“复制成功”，短暂后恢复
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
        // 失败：恢复并发通知（失败保留原逻辑）
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

    // 站点解析更丰富：cf/atc/luogu/uoj/hdu/poj/zoj/uva/loj(lightoj)
    const parser = {
      cf: pid => `https://vjudge.net/problem/CodeForces-${pid.slice(2)}`,
      codeforces: pid => `https://vjudge.net/problem/CodeForces-${pid.replace(/^codeforces/, '')}`,
      atc: pid => {
        // atcabc123a / atcabc123_a / 其它情况尽力匹配
        const m = pid.match(/^atc([a-z]+)(\d+)[_-]?([a-z])$/);
        if (m) return `https://vjudge.net/problem/AtCoder-${m[1]}${m[2]}_${m[3]}`;
        // 回退：去掉前缀 atc，末尾字母
        const base = pid.slice(3, -1), last = pid.slice(-1);
        return `https://vjudge.net/problem/AtCoder-${base}_${last}`;
      },
      luogu: pid => `https://vjudge.net/problem/洛谷-${pid.slice(5)}`,
      uoj: pid => `https://vjudge.net/problem/UniversalOJ-${pid.slice(3)}`,
      hdu: pid => `https://vjudge.net/problem/HDU-${pid.slice(3)}`,
      poj: pid => `https://vjudge.net/problem/POJ-${pid.slice(3)}`,
      zoj: pid => `https://vjudge.net/problem/ZOJ-${pid.slice(3)}`,
      uva: pid => `https://vjudge.net/problem/UVA-${pid.slice(3)}`,
      loj: pid => `https://vjudge.net/problem/LightOJ-${pid.slice(3)}` // lightoj 简写 loj
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
    // 调整按钮样式为橙色背景、白色文字
    vj.style.backgroundColor = '#f2711c';
    vj.style.color = '#ffffff';
    // 将按钮插入到“投稿/外站提交”所在的左侧按钮组；若不存在，再回退到右侧按钮组
    const leftGroup = document.querySelector('div.ui.buttons:not(.right.floated)');
    if (leftGroup) {
      leftGroup.appendChild(vj);
    } else if (firstBtn && firstBtn.parentNode) {
      // 插入到右侧按钮组最左边，使其靠近左侧
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
    // 修复菜单背景透明问题：为菜单容器设置不透明白色背景
    // 设置背景颜色，但不要覆盖背景渐变
    menu.style.backgroundColor = '#ffffff';
    menu.style.opacity = '1';

    const home = menu.querySelector('#bn-menu-home');
    const subProblem = menu.querySelector('#bn-menu-sub-problem');
    const subAll = menu.querySelector('#bn-menu-sub-all');
    const plan = menu.querySelector('#bn-menu-plan');
    const hide = () => { menu.style.display = 'none'; };

    document.addEventListener('click', hide);

    document.addEventListener('contextmenu', e => {
      const a = e.target.closest('a[href^="/user/"]');
      if (a) {
        const m = a.getAttribute('href').match(/^\/user\/(\d+)/);
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
          return;
        }
      }
      hide();
    });
  }

  /* ----------------------------------------------------------------
   *  9) 用户名/标题处理（只处理一次 + 最小 DOM 改动）
   * ---------------------------------------------------------------- */
  function processUserLink(a) {
    if (!a || !a.matches('a[href^="/user/"]')) return;
    if (!markOnce(a, 'UserDone')) return; // 已处理过就跳过

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

    // 清理旧挂件
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
  }

  /* ----------------------------------------------------------------
   *  X) 隐藏“已通过/已跳过”的题目（仅 Q/H/E/S 开头）
   * ---------------------------------------------------------------- */
  function __bn_shouldHideRow(tr) {
    try {
      const tds = tr.querySelectorAll('td');
      if (!tds || tds.length < 3) return false;
      const codeCell = tds[2];
      const idText = (codeCell.textContent || '').trim();
      if (!/^[QHES]/.test(idText)) return false; // 只处理 Q/H/E/S
      const statusTd = tds[1];
      const evalTd = tds[0];
      const isPass = !!statusTd.querySelector('.status.accepted, .status .accepted, span.status.accepted, i.checkmark.icon');
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

    // 更新表头提示
    try { updateHideBadge(enabled); } catch (e) { }
  }



  // 在「名称」表头后追加亮绿色提示
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

  const enablePlanAdder = GM_getValue('enablePlanAdder', false);
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
  if (location.pathname.indexOf('/submissions') !== 0) return;
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

  // 是否已通过：查看自己在该题是否有 Accepted / 100 分提交
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
      let mask = document.getElementById('bn-guard-mask');
      if (mask) return mask;
      mask = document.createElement('div');
      mask.id = 'bn-guard-mask';
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.0);display:flex;align-items:center;justify-content:center;z-index:2147483647;opacity:0;transition:opacity .25s ease';
      const box = document.createElement('div');
      box.id = 'bn-guard-box';
      box.style.cssText = 'min-width:420px;max-width:720px;padding:28px 24px;border-radius:10px;background:#1f232a;color:#fff;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.35);transform:scale(.9);opacity:0;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .25s ease;font-size:16px;line-height:1.65';
      box.innerHTML = '<div style="font-size:46px;opacity:.85;margin-bottom:8px;">⚠️</div>' +
        '<div style="font-size:22px;margin-bottom:6px;font-weight:700;letter-spacing:.1em;">是否继续</div>' +
        '<div id="bn-guard-msg" style="opacity:.9;margin:6px 0 18px;">未通过题目前查看他人答案将获得较低的评判，请经过深入思考以后，确实难以解决再选择查看。</div>' +
        '<div style="display:flex;gap:14px;justify-content:center;margin-top:8px;">' +
        '<button id="bn-guard-ok" style="min-width:96px;padding:10px 18px;border:0;border-radius:8px;background:#ef4444;color:#fff;cursor:pointer;font-weight:700;">确认</button>' +
        '<button id="bn-guard-cancel" style="min-width:96px;padding:10px 18px;border:1px solid #7dd3fc;border-radius:8px;background:#0b1220;color:#7dd3fc;cursor:pointer;font-weight:700;">取消</button>' +
        '</div>';
      mask.appendChild(box);
      document.body.appendChild(mask);
      requestAnimationFrame(() => {
        mask.style.opacity = '1';
        mask.style.background = 'rgba(0,0,0,.7)';
        box.style.opacity = '1';
        box.style.transform = 'scale(1)';
      });
      mask.bnClose = function (cb) {
        box.style.transform = 'scale(.9)';
        box.style.opacity = '0';
        mask.style.opacity = '0';
        mask.style.background = 'rgba(0,0,0,0)';
        setTimeout(() => { mask.remove(); cb && cb(); }, 250);
      };
      mask.bnConfirm = function (cb) {
        const ok = mask.querySelector('#bn-guard-ok');
        const cancel = mask.querySelector('#bn-guard-cancel');
        ok.onclick = () => mask.bnClose(cb);
        cancel.onclick = () => mask.bnClose();
      };
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
      var uid = getCurrentUserId();
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

    // 覆写 needWarn：有 AC => 不拦；无 AC => 拦；无法判定 => 兜底看题目页
    window.needWarn = async function (problemId) {
      try {
        var passed = await hasAnyAcceptedAcrossAll(problemId);
        if (passed === true) return false;
        if (passed === false) return true;
      } catch (e) { /* ignore */ }

      try {
        var ph = await fetchText(BASE + '/problem/' + encodeURIComponent(problemId), { 'X-Requested-With': 'XMLHttpRequest' });
        if (/class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(ph)
          || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(ph)) {
          return true;
        }
      } catch (e) { /* ignore */ }

      return false; // 默认放行，避免“全拦”
    };
  } catch (_e) { /* ignore */ }
})();

