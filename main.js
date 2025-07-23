// ==UserScript==
// @name         Better Names
// @namespace    http://tampermonkey.net/
// @version      4.0.0.dev.beta
// @description  新增自定义配色面板并修复若干问题
// @author       wwx
// @match        http://*.7fa4.cn:8888/*
// @exclude      http://*.7fa4.cn:9080/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    const DEFAULT_MAX_UNITS = 10;
    const storedUnits = GM_getValue('maxNameUnits', DEFAULT_MAX_UNITS);
    const maxUnits    = (storedUnits === 'none') ? Infinity : parseInt(storedUnits, 10);
    const hideAvatar  = GM_getValue('hideAvatar', false);
    const enableCopy  = GM_getValue('enableCopy', false);
    const copyNotify  = GM_getValue('copyNotify', false);
    const hideOrig    = GM_getValue('hideOrig', false);
    const showHook    = GM_getValue('showHook', true);
    const showMedal   = GM_getValue('showMedal', true);
    const enableMenu  = GM_getValue('enableUserMenu', false);
    const COLOR_KEYS = ['low3','low2','low1','upp1','upp2','upp3','is','oth'];
    const storedPalette = JSON.parse(GM_getValue('userPalette', '{}'));
    const useCustomColors = GM_getValue('useCustomColors', false);

    const palettes = {
        dark: {
            low3:  '#ff6f6f',
            low2:  '#ff9d76',
            low1:  '#ffda75',
            upp1:  '#bfff84',
            upp2:  '#88ffb6',
            upp3:  '#a19ffc',
            is:    '#daa2ff',
            oth:   '#cccccc'
        },
        light: {
            low3:  '#ff0101',
            low2:  '#ff6629',
            low1:  '#ffbb00',
            upp1:  '#62ca00',
            upp2:  '#00b972',
            upp3:  '#9900ff',
            is:    '#ca00ca',
            oth:   '#5a5a5a'
        }
    };

    function isPageDark() {
        const bg = getComputedStyle(document.body).backgroundColor;
        const [r,g,b] = bg.slice(bg.indexOf('(')+1,-1).split(',').map(Number);
        return (0.299*r + 0.587*g + 0.114*b) < 128;
    }

    const mode    = isPageDark() ? 'dark' : 'light';
    const palette = Object.assign({}, palettes[mode], useCustomColors ? storedPalette : {});

    const css = `
    #bn-container { position: fixed; bottom: 20px; right: 20px; width: 320px; z-index: 10000; }
    #bn-container * { pointer-events: auto; }
    #bn-trigger { position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; background: rgba(0,0,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; cursor: pointer; transition: background 0.2s; }
    #bn-trigger:hover { background: rgba(0,0,0,0.6); }
    #bn-panel { position: absolute; bottom: 40px; right: 0; width: 320px; padding: 12px; background: rgba(255,255,255,0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.2); border-radius: 6px; transform: scale(0.8); transform-origin: bottom right; opacity: 0; pointer-events: none; transition: transform 0.2s ease-out, opacity 0.2s ease-out; display: flex; flex-direction: column; gap: 12px; }
    #bn-panel.bn-show { transform: scale(1); opacity: 1; pointer-events: auto; }
    .bn-section { border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    .bn-section:last-child { border-bottom: none; }
    .bn-btn-group { display: flex; flex-wrap: wrap; gap: 4px; }
    .bn-color-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .bn-color-item { display: flex; align-items: center; gap: 4px; }
    .bn-color-item input[type="text"] { width: 70px; }
    .bn-title { font-weight: bold; margin-bottom: 4px; font-size: 14px; color: #333; }
    .bn-desc  { font-size: 12px; color: #666; margin-bottom: 8px; }
    #bn-panel label { display: block; margin-bottom: 6px; font-size: 13px; }
    #bn-panel input[type="number"] { width: 100%; padding: 6px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    #bn-panel .bn-btn { padding: 6px 8px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer; background: #2185d0; color: #fff; transition: background 0.2s; }
    #bn-panel .bn-btn:hover { background: #1678c2; }
    #bn-copy-options { margin-left: 16px; display: ${enableCopy ? 'block' : 'none'}; }
    .bn-icon { margin-left: 2px; vertical-align: middle; display: inline-flex; align-items: center; }
    .bn-icon svg { width: 16px; height: 16px; display: ${enableCopy ? 'block' : 'none'}; }
    .bn-medal { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; line-height: 16px; border-radius: 50%; color: #fff; font-size: 10px; text-align: center; font-weight: bold; vertical-align: middle; }
    .bn-medal-gold { background: #f1c40f; }
    .bn-medal-silver { background: #bdc3c7; }
    .bn-medal-bronze { background: #e67e22; }
    .bn-medal-iron { background: #767778; }
    #bn-user-menu { position: fixed; z-index: 10001; background: rgba(255,255,255,0.95); box-shadow: 0 2px 6px rgba(0,0,0,0.2); border-radius: 4px; padding: 4px 0; display: none; flex-direction: column; }
    #bn-user-menu a { padding: 6px 12px; color: #333; text-decoration: none; font-size: 13px; white-space: nowrap; }
    #bn-user-menu a:hover { background: #f0f0f0; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    const colorInputs = COLOR_KEYS.map(k => `
            <div class="bn-color-item">
                <label>${k}:</label>
                <input type="color" id="bn-color-${k}" value="${palette[k]}">
                <input type="text" class="bn-color-hex" id="bn-color-${k}-hex" value="${palette[k]}">
            </div>
        `).join('');

    const container = document.createElement('div'); container.id = 'bn-container';
    container.innerHTML = `
      <div id="bn-trigger">⚙️</div>
      <div id="bn-panel">
        <div class="bn-section">
            <div class="bn-title">【截断功能】</div>
            <div class="bn-desc">超过长度后自动添加 "..."（中2字、英1字）</div>
          <input id="bn-input" type="number" min="1" step="1" value="${isFinite(maxUnits)? maxUnits : ''}" placeholder="正整数">
          <div class="bn-btn-group">
            <button class="bn-btn" id="bn-confirm">确定</button>
            <button class="bn-btn" id="bn-default">恢复默认</button>
            <button class="bn-btn" id="bn-none">不截断</button>
            <button class="bn-btn" id="bn-cancel">取消</button>
          </div>
        </div>
        <div class="bn-section">
          <div class="bn-title">【隐藏头像】</div>
          <label><input type="checkbox" id="bn-hide-avatar" ${hideAvatar?'checked':''}/> 隐藏头像</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">【一键复制】</div>
          <label><input type="checkbox" id="bn-enable-copy" ${enableCopy?'checked':''}/> 启用复制</label>
          <div id="bn-copy-options">
            <label><input type="checkbox" id="bn-copy-notify" ${copyNotify?'checked':''}/> 提示复制成功</label>
            <label><input type="checkbox" id="bn-hide-orig" ${hideOrig?'checked':''}/> 隐藏原“题目源码”链接</label>
          </div>
        </div>
        <div class="bn-section">
          <div class="bn-title">【显示钩子】</div>
          <label><input type="checkbox" id="bn-show-hook" ${showHook?'checked':''}/> 显示钩子</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">【NOI 奖牌】</div>
          <label><input type="checkbox" id="bn-show-medal" ${showMedal?'checked':''}/> 显示NOI奖牌</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">【用户菜单】</div>
          <label><input type="checkbox" id="bn-enable-user-menu" ${enableMenu?'checked':''}/> 右键显示用户菜单</label>
        </div>
        <div class="bn-section">
          <div class="bn-title">【颜色配置】</div>
          <label><input type="checkbox" id="bn-use-custom-color" ${useCustomColors?'checked':''}/> 使用自定义颜色</label>
          <div id="bn-color-panel" style="display:${useCustomColors?'block':'none'}">
            <div class="bn-color-grid">${colorInputs}</div>
            <div class="bn-btn-group">
              <button class="bn-btn" id="bn-color-save">保存</button>
              <button class="bn-btn" id="bn-color-cancel">取消</button>
              <button class="bn-btn" id="bn-color-reset">恢复默认</button>
            </div>
          </div>
        </div>
        <div class="bn-section">
          <div class="bn-desc">4.0.0.dev.beta</div>
        </div>
      </div>`;
    document.body.appendChild(container);
    container.style.pointerEvents = 'none';

    const trigger  = document.getElementById('bn-trigger');
    const panel    = document.getElementById('bn-panel');
    const inp      = document.getElementById('bn-input');
    const chkAv    = document.getElementById('bn-hide-avatar');
    const chkCp    = document.getElementById('bn-enable-copy');
    const chkNt    = document.getElementById('bn-copy-notify');
    const chkHo    = document.getElementById('bn-hide-orig');
    const copyOpts = document.getElementById('bn-copy-options');
    const chkHook  = document.getElementById('bn-show-hook');
    const chkMedal = document.getElementById('bn-show-medal');
    const chkMenu  = document.getElementById('bn-enable-user-menu');
    const chkUseColor = document.getElementById('bn-use-custom-color');
    const colorPanel  = document.getElementById('bn-color-panel');
    const colorPickers = {};
    const hexInputs = {};
    COLOR_KEYS.forEach(k => {
        colorPickers[k] = document.getElementById(`bn-color-${k}`);
        hexInputs[k]    = document.getElementById(`bn-color-${k}-hex`);
        colorPickers[k].oninput = () => { hexInputs[k].value = colorPickers[k].value; };
        hexInputs[k].oninput = () => {
            const v = hexInputs[k].value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
                const val = v.startsWith('#') ? v : '#' + v;
                colorPickers[k].value = val;
            }
        };
    });
    chkUseColor.onchange = () => {
        colorPanel.style.display = chkUseColor.checked ? 'block' : 'none';
    };

    let hideTimer = null;
    const showPanel = () => {
        clearTimeout(hideTimer);
        panel.classList.add('bn-show');
        container.style.pointerEvents = 'auto';
    };
    const hidePanel = () => {
        panel.classList.remove('bn-show');
        container.style.pointerEvents = 'none';
    };
    trigger.addEventListener('mouseenter', showPanel);
    trigger.addEventListener('mouseleave', () => {
        hideTimer = setTimeout(() => {
            if (!trigger.matches(':hover') && !panel.matches(':hover') && !container.matches(':hover')) hidePanel();
        }, 200);
    });
    panel.addEventListener('mouseleave', () => {
        hideTimer = setTimeout(() => {
            if (!trigger.matches(':hover') && !panel.matches(':hover') && !container.matches(':hover')) hidePanel();
        }, 200);
    });

    chkAv.onchange = () => { GM_setValue('hideAvatar', chkAv.checked); location.reload(); };
    chkCp.onchange = () => { GM_setValue('enableCopy', chkCp.checked); location.reload(); };
    chkNt.onchange = () => { GM_setValue('copyNotify', chkNt.checked); location.reload(); };
    chkHo.onchange = () => { GM_setValue('hideOrig', chkHo.checked); location.reload(); };
    chkHook.onchange = () => { GM_setValue('showHook', chkHook.checked); location.reload(); };
    chkMedal.onchange = () => { GM_setValue('showMedal', chkMedal.checked); location.reload(); };
    chkMenu.onchange = () => { GM_setValue('enableUserMenu', chkMenu.checked); location.reload(); };

    document.getElementById('bn-cancel').onclick = () => {
        inp.value      = isFinite(maxUnits) ? maxUnits : '';
        chkAv.checked  = hideAvatar;
        chkCp.checked  = enableCopy;
        chkNt.checked  = copyNotify;
        chkHo.checked  = hideOrig;
        chkHook.checked = showHook;
        chkMedal.checked = showMedal;
        chkMenu.checked = enableMenu;
        copyOpts.style.display = enableCopy ? 'block' : 'none';
    };
    document.getElementById('bn-default').onclick = () => { GM_setValue('maxNameUnits', DEFAULT_MAX_UNITS); location.reload(); };
    document.getElementById('bn-none').onclick    = () => { GM_setValue('maxNameUnits', 'none'); location.reload(); };
    document.getElementById('bn-confirm').onclick = () => {
        const v = parseInt(inp.value, 10);
        if (isNaN(v) || v <= 0) { alert('请输入大于 0 的正整数'); inp.value = isFinite(maxUnits)? maxUnits : ''; return; }
        GM_setValue('maxNameUnits', v);
        GM_setValue('hideAvatar', chkAv.checked);
        GM_setValue('enableCopy', chkCp.checked);
        GM_setValue('copyNotify', chkNt.checked);
        GM_setValue('hideOrig', chkHo.checked);
        GM_setValue('showHook', chkHook.checked);
        GM_setValue('showMedal', chkMedal.checked);
        GM_setValue('enableUserMenu', chkMenu.checked);
        location.reload();
    };
    document.getElementById('bn-color-save').onclick = () => {
        const obj = {};
        for (const k of COLOR_KEYS) {
            const v = hexInputs[k].value.trim();
            if (!/^#?[0-9a-fA-F]{6}$/.test(v)) {
                alert('颜色码格式错误，请输入六位十六进制');
                return;
            }
            obj[k] = v.startsWith('#') ? v : '#' + v;
        }
        GM_setValue('userPalette', JSON.stringify(obj));
        GM_setValue('useCustomColors', chkUseColor.checked);
        location.reload();
    };
    document.getElementById('bn-color-cancel').onclick = () => {
        chkUseColor.checked = useCustomColors;
        colorPanel.style.display = useCustomColors ? 'block' : 'none';
        COLOR_KEYS.forEach(k => {
            colorPickers[k].value = palette[k];
            hexInputs[k].value = palette[k];
        });
    };
    document.getElementById('bn-color-reset').onclick = () => {
        GM_setValue('userPalette', '{}');
        GM_setValue('useCustomColors', false);
        location.reload();
    };

    function fEasierClip() {
        if (!/problem\/\d+$/.test(location.href)) return;
        const ref = document.querySelector("body > div:nth-child(2) > div > div:nth-child(8) > div:nth-child(1) > div > div.ui.buttons.right.floated > a:nth-child(1)");
        if (!ref) return;
        if (hideOrig) {
            ref.style.display = 'none';
        }
        const btn = document.createElement('a');
        btn.className = 'small ui button';
        btn.textContent = '复制题面';
        btn.onclick = async () => {
            try {
                const res = await fetch(location.href + '/markdown/text');
                const text = await res.text();
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                if (copyNotify) {
                    GM_notification({ text: '复制成功！', timeout: 2000 });
                } else {
                    console.log('复制成功！');
                }
            } catch (e) {
                GM_notification({ text: '复制失败：' + e, timeout: 3000 });
            }
        };
        ref.parentNode.insertBefore(btn, ref);
    }

    function initUserMenu() {
        const menu = document.createElement('div');
        menu.id = 'bn-user-menu';
        menu.innerHTML = `
            <a id="bn-menu-home" href="#">转到主页</a>
            <a id="bn-menu-sub" href="#">转到提交记录</a>
            <a id="bn-menu-plan" href="#">转到计划</a>
        `;
        document.body.appendChild(menu);
        const home = menu.querySelector('#bn-menu-home');
        const sub  = menu.querySelector('#bn-menu-sub');
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
                    sub.href = `/submissions?contest=&problem_id=&submitter=${uid}&min_score=0&max_score=100&language=&status=`;
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


    const HOOK_GREEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#5eb95e" style="margin-bottom: -3px;"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>';
    const HOOK_BLUE  = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#3498db" style="margin-bottom: -3px;"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>';
    const HOOK_GOLD  = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#ffc116" style="margin-bottom: -3px;"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>';
    const MEDAL_ICONS = {
        gold: '<span class="bn-medal bn-medal-gold"></span>',
        silver: '<span class="bn-medal bn-medal-silver"></span>',
        bronze: '<span class="bn-medal bn-medal-bronze"></span>',
        iron: '<span class="bn-medal bn-medal-iron"></span>'
    };

    function getMedalIcon(type) {
        return MEDAL_ICONS[type] || '';
    }

    function getHookIcon(lv) {
        if (lv <= 0) return '';
        if (lv <= 5) return HOOK_GREEN;
        if (lv <= 7) return HOOK_BLUE;
        return HOOK_GOLD;
    }

    const users = {
        1458: { name: "彭博彦", colorKey: 'low3', hook: 5 },
        966:  { name: "公子文", colorKey: 'low1', hook: 5 },
        882:  { name: "唐若轩", colorKey: 'low1', hook: 6 },
        811:  { name: "杨笑",   colorKey: 'is',   hook: 6 },
        629:  { name: "曹灿",   colorKey: 'oth',  hook: 7 },
        2010: { name: "张恩齐", colorKey: 'is',   hook: 5 },
        2177: { name: "张尽欢", colorKey: 'is',   hook: 6, medal: 'iron' },
        2176: { name: "刘子墨", colorKey: 'is',   hook: 5 },
        994:  { name: "黎莫轩", colorKey: 'upp2', hook: 10, medal: 'gold' },
        34:   { name: "李弩翰", colorKey: 'upp2', hook: 8 },
        1094: { name: "文星杰", colorKey: 'upp1', hook: 8, medal: 'bronze' },
        1179: { name: "赖今羿", colorKey: 'upp1', hook: 7 },
        661:  { name: "国皓语", colorKey: 'upp1', hook: 7 },
        1085: { name: "汪士恒", colorKey: 'upp1', hook: 8, medal: 'bronze' },
        1339: { name: "王海烨", colorKey: 'upp1', hook: 7, medal: 'bronze' },
        1577: { name: "彭赞滔", colorKey: 'upp1', hook: 7 },
        18:   { name: "黄诗哲", colorKey: 'upp1', hook: 7, medal: 'bronze' },
        735:  { name: "宋成宸", colorKey: 'upp1', hook: 7 },
        880:  { name: "陈统峙", colorKey: 'oth',  hook: 9 },
        874:  { name: "陈霖瑄", colorKey: 'is', hook: 7, medal: 'bronze' },
        793:  { name: "孙邦博", colorKey: 'is', hook: 7 },
        890:  { name: "王腾立", colorKey: 'is', hook: 6 },
        1069: { name: "李思阳", colorKey: 'is', hook: 6 },
        878:  { name: "王译萱", colorKey: 'is', hook: 8, medal: 'silver' },
        879:  { name: "张子佩", colorKey: 'is', hook: 8 },
        875:  { name: "程翊宸", colorKey: 'oth', hook: 8, medal: 'bronze' },
        1070: { name: "章正瀚", colorKey: 'low1', hook: 7 },
        887:  { name: "漆小凡", colorKey: 'low1', hook: 7 },
        2317: { name: "张珈源", colorKey: 'upp2', hook: 8, medal: 'bronze' },
        2318: { name: "肖浩宇", colorKey: 'upp1', hook: 8, medal: 'bronze' },
        2337: { name: "张健佳", colorKey: 'upp2', hook: 8, medal: 'bronze' },
        920:  { name: "谭筱丸", colorKey: 'low1', hook: 7 },
        977:  { name: "吴雨翔", colorKey: 'low1', hook: 5 },
        976:  { name: "汪泽浩", colorKey: 'low1', hook: 6 },
        992:  { name: "刘文驭", colorKey: 'low1', hook: 6 },
        974:  { name: "宋泰然", colorKey: 'low1', hook: 6 },
        889:  { name: "梁殿宸", colorKey: 'low1', hook: 6 },
        871:  { name: "张平京渝", colorKey: 'low1', hook: 7 },
        972:  { name: "赖俊岑", colorKey: 'low1', hook: 5 },
        1064: { name: "肖翊",   colorKey: 'low1', hook: 6 },
        1184: { name: "赵淀磊", colorKey: 'low1', hook: 5 },
        991:  { name: "周圣青", colorKey: 'low1', hook: 6 },
        1030: { name: "刘思淇", colorKey: 'low1', hook: 5 },
        808:  { name: "杨谨源", colorKey: 'low1', hook: 6 },
        812:  { name: "曾帅鸣", colorKey: 'low1', hook: 4 },
        981:  { name: "叶柏岑", colorKey: 'low1' },
        1:    { name: "陈许旻", colorKey: 'tch', hook: 10, medal: 'gold' },
        1166: { name: "田亮",   colorKey: 'is',   hook: 7 },
        745:  { name: "陈恒宇", colorKey: 'tch'  },
        2175: { name: "李雪梅", colorKey: 'tch'  },
        2170: { name: "王多灵", colorKey: 'tch',  hook: 4 },
        85:   { name: "程宇轩", colorKey: 'tch',  hook: 7 },
        667:  { name: "钟胡天翔", colorKey: 'tch' },
        1172: { name: "徐苒茨", colorKey: 'tch',  hook: 8, medal: 'bronze' },
        829:  { name: "徐淑君", colorKey: 'tch'  },
        1106: { name: "王思勋", colorKey: 'low3', hook: 6 },
        995:  { name: "彭奕力", colorKey: 'low1', hook: 6 },
        962:  { name: "李卓衡", colorKey: 'low1', hook: 7 },
        1191: { name: "宁亦檬", colorKey: 'is',   hook: 6 },
        792:  { name: "陈泳蒽", colorKey: 'is',   hook: 4 },
        791:  { name: "宋明阳", colorKey: 'is',   hook: 4 },
        785:  { name: "祝煜涵", colorKey: 'is' },
        794:  { name: "施宇翔", colorKey: 'upp1' },
        1481: { name: "杨嘉缘", colorKey: 'upp2', hook: 6 },
        22:   { name: "冯思韬", colorKey: 'upp2', hook: 7 },
        987:  { name: "谢宇轩", colorKey: 'upp2', hook: 5 },
        990:  { name: "严家乐", colorKey: 'upp2', hook: 7 },
        701:  { name: "周星宇", colorKey: 'upp1', hook: 6 },
        918:  { name: "黄浩源", colorKey: 'upp1', hook: 6 },
        881:  { name: "郑凯文", colorKey: 'upp3', hook: 7 },
        666:  { name: "张铭杰", colorKey: 'upp1', hook: 7 },
        135:  { name: "彭博", colorKey: 'is',     hook: 7 },
        1154: { name: "刘楚谦", colorKey: 'is' },
        973:  { name: "马逸逍", colorKey: 'low1' },
        1031: { name: "王炫理", colorKey: 'low2', hook: 7 },
        1157: { name: "陈骏贤", colorKey: 'low2', hook: 7 },
        1045: { name: "李炎泽", colorKey: 'low2', hook: 6 },
        1161: { name: "李泽轩", colorKey: 'low2', hook: 6 },
        1448: { name: "祝晗泽", colorKey: 'low2', hook: 5 },
        1036: { name: "张立言", colorKey: 'low2', hook: 6 },
        1175: { name: "刘佩林", colorKey: 'low2', hook: 6 },
        1108: { name: "黄祺远", colorKey: 'low2', hook: 5 },
        1176: { name: "杨辰瑾", colorKey: 'low2', hook: 6 },
        1177: { name: "姚烨拣", colorKey: 'low2' },
        1037: { name: "刘溯理", colorKey: 'low2', hook: 5 },
        1082: { name: "毛馨仪", colorKey: 'low2', hook: 5 },
        1174: { name: "钟沐霖", colorKey: 'low2', hook: 6 },
        1681: { name: "高云朗", colorKey: 'low2', hook: 5 },
        1171: { name: "徐静丹", colorKey: 'low2', hook: 5 },
        2355: { name: "邓皓轩", colorKey: 'low1', hook: 7 },
        1158: { name: "刘泽宇", colorKey: 'low3', hook: 7 },
        2375: { name: "佘佳霖", colorKey: 'upp1', hook: 4 },
        1150: { name: "黄梓轩", colorKey: 'upp1', hook: 7 }
    };

    function truncateByUnits(str, maxU) {
        if (!isFinite(maxU)) return str;
        let used=0, out='';
        for (const ch of str) {
            const w = ch.charCodeAt(0)>255 ? 2:1;
            if (used + w > maxU) { out += '...'; break; }
            out += ch; used += w;
        }
        return out;
    }

    function processUserLink(a) {
        if (
            a.matches('#user-dropdown > a') ||
            a.matches('#user-dropdown > div > a:nth-child(1)') ||
            a.matches('body > div.ui.fixed.borderless.menu > div > div > a') ||
            a.matches('#form > div > div:nth-child(13) > a')
        ) return;

        const href = a.getAttribute('href');
        const m = href.match(/^\/user\/(\d+)\/?$/);
        if (!m) return;
        const uid  = m[1];
        const info = users[uid];
        const img  = a.querySelector('img');

        if (img && hideAvatar) img.remove();

        a.querySelectorAll('.bn-icon').forEach(el => el.remove());

        let newHTML;
        if (info) {
            newHTML = (img ? '&nbsp;' : '') + info.name;
            const c = palette[info.colorKey];
            if (c) a.style.color = c;
            if (showHook && info.hook) {
                newHTML += ' <span class="bn-icon" title="OI 程序设计能力评级：' + info.hook + ' 级">' + getHookIcon(info.hook) + '</span>';
            }
            if (showMedal && info.medal) {
                const label = info.medal === 'gold' ? '金牌' : info.medal === 'silver' ? '银牌' : info.medal === 'iron' ? '铁' : '铜牌';
                if (info.medal != 'iron') newHTML += ' <span class="bn-icon" title="NOI奖牌：' + label + '">' + getMedalIcon(info.medal) + '</span>';
                // else newHTML += ' <span class="bn-icon" title="荣誉铁">' + getMedalIcon(info.medal) + '</span>';
            }
        } else {
            let original = '';
            a.childNodes.forEach(n => {
                if (n.nodeType === Node.TEXT_NODE) original += n.textContent;
            });
            original = original.trim();
            newHTML = (img ? '&nbsp;' : '') + truncateByUnits(original, maxUnits);
        }

        Array.from(a.childNodes).forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) a.removeChild(n);
        });
        a.insertAdjacentHTML('beforeend', newHTML);
    }

    document.querySelectorAll('a[href^="/user/"]').forEach(processUserLink);

    const observer = new MutationObserver(mutations => {
        for (const mut of mutations) {
            mut.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.matches && node.matches('a[href^="/user/"]')) {
                    processUserLink(node);
                }
                node.querySelectorAll &&
                    node.querySelectorAll('a[href^="/user/"]').forEach(processUserLink);
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (enableCopy) fEasierClip();
    if (enableMenu) initUserMenu();
})();
