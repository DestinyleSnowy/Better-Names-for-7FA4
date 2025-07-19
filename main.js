// ==UserScript==
// @name         Better Names
// @namespace    http://tampermonkey.net/
// @version      3.5.0.dev.beta
// @description  修复“可批阅习题栏”用户名替换错误
// @author       wwx
// @match        http://*.7fa4.cn:8888/*
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

    const css = `
    #bn-container { position: fixed; bottom: 20px; right: 20px; width: 260px; z-index: 10000; }
    #bn-container * { pointer-events: auto; }
    #bn-trigger { position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; background: rgba(0,0,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; cursor: pointer; transition: background 0.2s; }
    #bn-trigger:hover { background: rgba(0,0,0,0.6); }
    #bn-panel { position: absolute; bottom: 40px; right: 0; width: 260px; padding: 12px; background: rgba(255,255,255,0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.2); border-radius: 6px; transform: scale(0.8); transform-origin: bottom right; opacity: 0; transition: transform 0.2s ease-out, opacity 0.2s ease-out; }
    #bn-container:hover #bn-panel { transform: scale(1); opacity: 1; }
    .bn-title { font-weight: bold; margin-bottom: 4px; font-size: 14px; color: #333; }
    .bn-desc  { font-size: 12px; color: #666; margin-bottom: 8px; }
    #bn-panel label { display: block; margin-bottom: 6px; font-size: 13px; }
    #bn-panel input[type="number"] { width: 100%; padding: 6px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    #bn-panel .bn-btn { margin: 4px 4px 0 0; padding: 6px 8px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer; background: #2185d0; color: #fff; transition: background 0.2s; }
    #bn-panel .bn-btn:hover { background: #1678c2; }
    #bn-copy-options { margin-left: 16px; display: ${enableCopy ? 'block' : 'none'}; }
    .bn-icon { margin-left: 2px; vertical-align: middle; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    const container = document.createElement('div'); container.id = 'bn-container';
    container.innerHTML = `
      <div id="bn-trigger">⚙️</div>
      <div id="bn-panel">
        <div class="bn-title">【截断功能】</div>
        <div class="bn-desc">超过长度后自动添加 "..."（中2字、英1字）</div>
        <input id="bn-input" type="number" min="1" step="1" value="${isFinite(maxUnits)? maxUnits : ''}" placeholder="正整数">
        <div>
          <button class="bn-btn" id="bn-confirm">确定</button>
          <button class="bn-btn" id="bn-default">恢复默认</button>
          <button class="bn-btn" id="bn-none">不截断</button>
          <button class="bn-btn" id="bn-cancel">取消</button>
        </div>
        <br />
        <div class="bn-title">【隐藏头像】</div>
        <label><input type="checkbox" id="bn-hide-avatar" ${hideAvatar?'checked':''}/> 隐藏头像</label>
        <br />
        <div class="bn-title">【一键复制】</div>
        <label><input type="checkbox" id="bn-enable-copy" ${enableCopy?'checked':''}/> 启用复制</label>
        <div id="bn-copy-options">
          <label><input type="checkbox" id="bn-copy-notify" ${copyNotify?'checked':''}/> 提示复制成功</label>
          <label><input type="checkbox" id="bn-hide-orig" ${hideOrig?'checked':''}/> 隐藏原“题目源码”链接</label>
        </div>
        <br />
        <div class="bn-title">【显示钩子】</div>
        <label><input type="checkbox" id="bn-show-hook" ${showHook?'checked':''}/> 显示钩子</label>
        <br />
        <div class="bn-title">【NOI 奖牌】</div>
        <label><input type="checkbox" id="bn-show-medal" ${showMedal?'checked':''}/> 显示NOI奖牌</label>
      </div>`;
    document.body.appendChild(container);

    const inp      = document.getElementById('bn-input');
    const chkAv    = document.getElementById('bn-hide-avatar');
    const chkCp    = document.getElementById('bn-enable-copy');
    const chkNt    = document.getElementById('bn-copy-notify');
    const chkHo    = document.getElementById('bn-hide-orig');
    const copyOpts = document.getElementById('bn-copy-options');
    const chkHook  = document.getElementById('bn-show-hook');
    const chkMedal = document.getElementById('bn-show-medal');

    chkAv.onchange = () => { GM_setValue('hideAvatar', chkAv.checked); location.reload(); };
    chkCp.onchange = () => { GM_setValue('enableCopy', chkCp.checked); location.reload(); };
    chkNt.onchange = () => { GM_setValue('copyNotify', chkNt.checked); location.reload(); };
    chkHo.onchange = () => { GM_setValue('hideOrig', chkHo.checked); location.reload(); };
    chkHook.onchange = () => { GM_setValue('showHook', chkHook.checked); location.reload(); };
    chkMedal.onchange = () => { GM_setValue('showMedal', chkMedal.checked); location.reload(); };

    document.getElementById('bn-cancel').onclick = () => {
        inp.value      = isFinite(maxUnits) ? maxUnits : '';
        chkAv.checked  = hideAvatar;
        chkCp.checked  = enableCopy;
        chkNt.checked  = copyNotify;
        chkHo.checked  = hideOrig;
        chkHook.checked = showHook;
        chkMedal.checked = showMedal;
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

    const HOOK_GREEN = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#5eb95e" style="margin-bottom: -3px;"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>';
    const HOOK_BLUE  = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#3498db" style="margin-bottom: -3px;"><path d="M16 8C16 6.84375 15.25 5.84375 14.1875 5.4375C14.6562 4.4375 14.4688 3.1875 13.6562 2.34375C12.8125 1.53125 11.5625 1.34375 10.5625 1.8125C10.1562 0.75 9.15625 0 8 0C6.8125 0 5.8125 0.75 5.40625 1.8125C4.40625 1.34375 3.15625 1.53125 2.34375 2.34375C1.5 3.1875 1.3125 4.4375 1.78125 5.4375C0.71875 5.84375 0 6.84375 0 8C0 9.1875 0.71875 10.1875 1.78125 10.5938C1.3125 11.5938 1.5 12.8438 2.34375 13.6562C3.15625 14.5 4.40625 14.6875 5.40625 14.2188C5.8125 15.2812 6.8125 16 8 16C9.15625 16 10.1562 15.2812 10.5625 14.2188C11.5938 14.6875 12.8125 14.5 13.6562 13.6562C14.4688 12.8438 14.6562 11.5938 14.1875 10.5938C15.25 10.1875 16 9.1875 16 8ZM11.4688 6.625L7.375 10.6875C7.21875 10.8438 7 10.8125 6.875 10.6875L4.5 8.3125C4.375 8.1875 4.375 7.96875 4.5 7.8125L5.3125 7C5.46875 6.875 5.6875 6.875 5.8125 7.03125L7.125 8.34375L10.1562 5.34375C10.3125 5.1875 10.5312 5.1875 10.6562 5.34375L11.4688 6.15625C11.5938 6.28125 11.5938 6.5 11.4688 6.625Z"></path></svg>';
    const HOOK_GOLD = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor" style="color:#f1c40f;margin-bottom:-3px;"><g class="fa-duotone-group"><path fill="currentColor" d="M256 0c36.8 0 68.8 20.7 84.9 51.1C373.8 41 411 49 437 75s34 63.3 23.9 96.1C491.3 187.2 512 219.2 512 256s-20.7 68.8-51.1 84.9C471 373.8 463 411 437 437s-63.3 34-96.1 23.9C324.8 491.3 292.8 512 256 512s-68.8-20.7-84.9-51.1C138.2 471 101 463 75 437s-34-63.3-23.9-96.1C20.7 324.8 0 292.8 0 256s20.7-68.8 51.1-84.9C41 138.2 49 101 75 75s63.3-34 96.1-23.9C187.2 20.7 219.2 0 256 0zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z" class="fa-secondary"></path><path fill="currentColor" d="M369 175c9.4 9.4 9.4 24.6 0 33.9L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0z" class="fa-primary"></path></g></svg>';

    const MEDAL_ICONS = {
        gold: '🥇',
        silver: '🥈',
        bronze: '🥉'
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

    const palettes = {
        dark: {
            low3:  'rgb(255, 111, 111)',
            low2:  'rgb(255, 157, 118)',
            low1:  'rgb(255, 218, 117)',
            upp1:  'rgb(191, 255, 132)',
            upp2:  'rgb(136, 255, 182)',
            upp3:  'rgb(161, 159, 252)',
            is:    'rgb(218, 162, 255)',
            oth:   'rgb(204, 204, 204)'
        },
        light: {
            low3:  'rgb(255, 1, 1)',
            low2:  'rgb(255, 102, 41)',
            low1:  'rgb(255, 187, 0)',
            upp1:  'rgb(98, 202, 0)',
            upp2:  'rgb(0, 185, 114)',
            upp3:  'rgb(153, 0, 255)',
            is:    'rgb(202, 0, 202)',
            oth:   'rgb(90, 90, 90)'
        }
    };

    const users = {
        1458: { name: "彭博彦", colorKey: 'low3', hook: 8, medal: 'gold' },
        966:  { name: "公子文", colorKey: 'low1', hook: 4, medal: 'silver' },
        882:  { name: "唐若轩", colorKey: 'low1', hook: 7, medal: 'bronze' },
        811:  { name: "杨笑",   colorKey: 'is'   },
        629:  { name: "曹灿",   colorKey: 'oth'  },
        2010: { name: "张恩齐", colorKey: 'is'   },
        2177: { name: "张尽欢", colorKey: 'is'   },
        2176: { name: "刘子墨", colorKey: 'is'   },
        994:  { name: "黎莫轩", colorKey: 'upp2' },
        34:   { name: "李弩翰", colorKey: 'upp2' },
        1094: { name: "文星杰", colorKey: 'upp1' },
        1179: { name: "赖今羿", colorKey: 'upp1' },
        661:  { name: "国皓语", colorKey: 'upp1' },
        1085: { name: "汪士恒", colorKey: 'upp1' },
        1339: { name: "王海烨", colorKey: 'upp1' },
        1577: { name: "彭赞滔", colorKey: 'upp1' },
        18:   { name: "黄诗哲", colorKey: 'upp1' },
        735:  { name: "宋成宸", colorKey: 'upp1' },
        880:  { name: "陈统峙", colorKey: 'oth'  },
        874:  { name: "陈霖瑄", colorKey: 'is'   },
        793:  { name: "孙邦博", colorKey: 'is'   },
        890:  { name: "王腾立", colorKey: 'is'   },
        1069: { name: "李思阳", colorKey: 'is'   },
        878:  { name: "王译萱", colorKey: 'is'   },
        879:  { name: "张子佩", colorKey: 'is'   },
        875:  { name: "程翊宸", colorKey: 'oth'  },
        1070: { name: "章正瀚", colorKey: 'low1' },
        887:  { name: "漆小凡", colorKey: 'low1' },
        2317: { name: "张珈源", colorKey: 'upp2' },
        2318: { name: "肖浩宇", colorKey: 'upp1' },
        2337: { name: "张健佳", colorKey: 'upp2' },
        920:  { name: "谭筱丸", colorKey: 'low1' },
        977:  { name: "吴雨翔", colorKey: 'low1' },
        976:  { name: "汪泽浩", colorKey: 'low1' },
        992:  { name: "刘文驭", colorKey: 'low1' },
        974:  { name: "宋泰然", colorKey: 'low1' },
        889:  { name: "梁殿宸", colorKey: 'low1' },
        871:  { name: "张平京渝", colorKey: 'low1' },
        972:  { name: "赖俊岑", colorKey: 'low1' },
        1064: { name: "肖翊",   colorKey: 'low1' },
        1184: { name: "赵淀磊", colorKey: 'low1' },
        991:  { name: "周圣青", colorKey: 'low1' },
        1030: { name: "刘思淇", colorKey: 'low1' },
        808:  { name: "杨谨源", colorKey: 'low1' },
        812:  { name: "曾帅鸣", colorKey: 'low1' },
        981:  { name: "叶柏岑", colorKey: 'low1' },
        1:    { name: "陈许旻", colorKey: 'tch'  },
        1166: { name: "田亮",   colorKey: 'is'   },
        745:  { name: "陈恒宇", colorKey: 'tch'  },
        2175: { name: "李雪梅", colorKey: 'tch'  },
        2170: { name: "王多灵", colorKey: 'tch'  },
        85:   { name: "程宇轩", colorKey: 'tch'  },
        667:  { name: "钟胡天翔", colorKey: 'tch' },
        1172: { name: "徐苒茨", colorKey: 'tch'  },
        829:  { name: "徐淑君", colorKey: 'tch'  },
        1106: { name: "王思勋", colorKey: 'low3' },
        995:  { name: "彭奕力", colorKey: 'low1' },
        962:  { name: "李卓衡", colorKey: 'low1' },
        1191: { name: "柠亦蒙", colorKey: 'is' },
        792:  { name: "陈泳蒽", colorKey: 'is' },
        791:  { name: "宋明阳", colorKey: 'is' },
        785:  { name: "祝煜涵", colorKey: 'is' },
        794:  { name: "施宇翔", colorKey: 'upp1' },
        1481: { name: "杨嘉缘", colorKey: 'upp2' },
        22:   { name: "冯思韬", colorKey: 'upp2' },
        987:  { name: "谢宇璇", colorKey: 'upp2' },
        990:  { name: "严家乐", colorKey: 'upp2' },
        701:  { name: "周星宇", colorKey: 'upp1' },
        918:  { name: "黄浩源", colorKey: 'upp1' },
        881:  { name: "郑凯文", colorKey: 'upp3' },
        666:  { name: "张铭杰", colorKey: 'upp1' },
        135:  { name: "彭博", colorKey: 'is' },
        1154: { name: "刘楚谦", colorKey: 'is' },
        973:  { name: "马逸逍", colorKey: 'low1' },
        1031: { name: "王炫理", colorKey: 'low2' },
        1157: { name: "陈骏贤", colorKey: 'low2' },
        1045: { name: "李炎泽", colorKey: 'low2' },
        1161: { name: "李泽轩", colorKey: 'low2' },
        1448: { name: "祝晗泽", colorKey: 'low2' },
        1036: { name: "张立言", colorKey: 'low2' },
        1175: { name: "刘佩林", colorKey: 'low2' },
        1108: { name: "黄祺远", colorKey: 'low2' },
        1176: { name: "杨辰瑾", colorKey: 'low2' },
        1177: { name: "姚烨拣", colorKey: 'low2' },
        1037: { name: "刘溯理", colorKey: 'low2' },
        1082: { name: "毛馨仪", colorKey: 'low2' },
        1174: { name: "钟沐霖", colorKey: 'low2' },
        1681: { name: "高云朗", colorKey: 'low2' },
        1171: { name: "徐静丹", colorKey: 'low2' }
    };

    function isPageDark() {
        const bg = getComputedStyle(document.body).backgroundColor;
        const [r,g,b] = bg.slice(bg.indexOf('(')+1,-1).split(',').map(Number);
        return (0.299*r + 0.587*g + 0.114*b) < 128;
    }
    const mode    = isPageDark() ? 'dark' : 'light';
    const palette = palettes[mode];

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
            a.matches('body > div.ui.fixed.borderless.menu > div > div > a')
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
                newHTML += ' <span class="bn-icon" title="OI 程序设计能力评级">' + getHookIcon(info.hook) + '</span>';
            }
            if (showMedal && info.medal) {
                const label = info.medal === 'gold' ? '金牌' : info.medal === 'silver' ? '银牌' : '铜牌';
                newHTML += ' <span class="bn-icon" title="NOI奖牌：' + label + '">' + getMedalIcon(info.medal) + '</span>';
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
})();