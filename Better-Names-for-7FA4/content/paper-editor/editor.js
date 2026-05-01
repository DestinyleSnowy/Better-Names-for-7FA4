(function () {
    'use strict';

    // ---- 页面检测 ----
    const path = location.pathname || '';
    if (!/^\/problem\/7\d{3,}/.test(path)) return;

    const isPaperPage = () => document.body?.textContent.includes('这是一道纸面作业');

    const waitForDeps = () => new Promise(resolve => {
        const iv = setInterval(() => {
            if (typeof marked !== 'undefined' && typeof renderMathInElement === 'function' && document.querySelector('#submit_code'))
                { clearInterval(iv); resolve(true); }
        }, 200);
        setTimeout(() => { clearInterval(iv); resolve(false); }, 15000);
    });

    // ---- 注入资源 ----
    async function injectAssets() {
        // 用 <style> 内联注入 CSS，而非 <link>，这样 html2canvas 克隆 DOM 时 CSS 文本会被一同复制
        if (!document.getElementById('bn-pe-style')) {
            const style = document.createElement('style');
            style.id = 'bn-pe-style';
            try {
                const url = chrome.runtime.getURL('content/paper-editor/editor.css');
                const resp = await fetch(url);
                style.textContent = await resp.text();
            } catch (e) {
                console.error('[BN-Paper] 加载 editor.css 失败:', e);
            }
            document.head.appendChild(style);
        }

        if (!document.getElementById('bn-pe-katex-fonts')) {
            const base = chrome.runtime.getURL('content/libs/katex/fonts/');
            const fonts = [
                ['KaTeX_AMS','KaTeX_AMS-Regular.woff2'],
                ['KaTeX_Caligraphic','KaTeX_Caligraphic-Regular.woff2'],
                ['KaTeX_Caligraphic','KaTeX_Caligraphic-Bold.woff2','bold'],
                ['KaTeX_Fraktur','KaTeX_Fraktur-Regular.woff2'],
                ['KaTeX_Fraktur','KaTeX_Fraktur-Bold.woff2','bold'],
                ['KaTeX_Main','KaTeX_Main-Regular.woff2'],
                ['KaTeX_Main','KaTeX_Main-Italic.woff2','normal','italic'],
                ['KaTeX_Main','KaTeX_Main-Bold.woff2','bold'],
                ['KaTeX_Main','KaTeX_Main-BoldItalic.woff2','bold','italic'],
                ['KaTeX_Math','KaTeX_Math-Italic.woff2','normal','italic'],
                ['KaTeX_Math','KaTeX_Math-BoldItalic.woff2','bold','italic'],
                ['KaTeX_SansSerif','KaTeX_SansSerif-Regular.woff2'],
                ['KaTeX_SansSerif','KaTeX_SansSerif-Italic.woff2','normal','italic'],
                ['KaTeX_SansSerif','KaTeX_SansSerif-Bold.woff2','bold'],
                ['KaTeX_Script','KaTeX_Script-Regular.woff2'],
                ['KaTeX_Size1','KaTeX_Size1-Regular.woff2'],
                ['KaTeX_Size2','KaTeX_Size2-Regular.woff2'],
                ['KaTeX_Size3','KaTeX_Size3-Regular.woff2'],
                ['KaTeX_Size4','KaTeX_Size4-Regular.woff2'],
                ['KaTeX_Typewriter','KaTeX_Typewriter-Regular.woff2']
            ];
            const fontStyle = document.createElement('style');
            fontStyle.id = 'bn-pe-katex-fonts';
            fontStyle.textContent = fonts.map(([name, file, w = 'normal', st = 'normal']) =>
                `@font-face{font-family:'${name}';src:url('${base}${file}') format('woff2');font-weight:${w};font-style:${st};font-display:swap;}`
            ).join('');
            document.head.appendChild(fontStyle);
        }
    }

    // ---- 常量 ----
    const CID = 'bn-paper-container', EID = 'bn-paper-editor', PID = 'bn-paper-preview';
    let _segs = [];

    // ---- localStorage 持久化 ----
    const STORAGE_KEY = 'bn-pe-md-' + location.pathname;
    const saveDraft = text => {
        try { localStorage.setItem(STORAGE_KEY, text); } catch {}
    };
    const loadDraft = () => {
        try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
    };
    const clearDraft = () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
    };

    // ---- Markdown 公式保护 ----
    const protect = t => {
        _segs = [];
        t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => { const i = _segs.length; _segs.push({ k: `BNB_${i}_`, v: f.trim(), b: 1 }); return _segs[i].k; });
        return t.replace(/\$([^\$\n]+?)\$/g, (_, f) => { const i = _segs.length; _segs.push({ k: `BNI_${i}_`, v: f.trim(), b: 0 }); return _segs[i].k; });
    };

    const restore = h => {
        _segs.forEach(s => {
            try {
                const el = document.createElement(s.b ? 'div' : 'span');
                katex.render(s.v, el, { displayMode: !!s.b, throwOnError: false, strict: false });
                h = h.split(s.k).join(el.outerHTML);
            } catch { h = h.split(s.k).join(s.v); }
        });
        return h;
    };

    // ---- 编辑器操作 ----
    const wrapSel = (ta, a, b) => {
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.substring(s, e);
        ta.value = ta.value.substring(0, s) + a + sel + b + ta.value.substring(e);
        const pos = s + a.length + sel.length;
        ta.setSelectionRange(pos, pos);
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const ins = (ta, txt) => {
        const s = ta.selectionStart;
        ta.value = ta.value.substring(0, s) + txt + ta.value.substring(ta.selectionEnd);
        ta.setSelectionRange(s + txt.length, s + txt.length);
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // ---- Lucide 风格图标（stroke 线条） ----
    const S = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
    const icon = path => S + path + '</svg>';

    const I = {
        B:    icon('<path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/>'),
        I:    icon('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>'),
        S:    icon('<line x1="4" y1="12" x2="20" y2="12"/>'),
        HR:   icon('<line x1="3" y1="12" x2="21" y2="12"/><line x1="8" y1="8" x2="4" y2="8" opacity=".4"/><line x1="20" y1="16" x2="16" y2="16" opacity=".4"/>'),
        H:    icon('<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8l-3-2"/><path d="M21 12h-1"/>'),
        Q:    icon('<path d="M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4c0 3-1.5 4.5-4 5.5"/><path d="M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4c0 3-1.5 4.5-4 5.5"/>'),
        C:    icon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
        FX:   icon('<text x="3" y="17" font-size="13" fill="currentColor" stroke="none" font-family="serif" font-style="italic">f</text><text x="11" y="17" font-size="13" fill="currentColor" stroke="none" font-family="serif" font-style="italic">x</text>'),
        LK:   icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
        IMG:  icon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
        TBL:  icon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>'),
        UL:   icon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
        OL:   icon('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="8" font-size="9" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="3" y="14" font-size="9" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="3" y="20" font-size="9" fill="currentColor" stroke="none" font-family="sans-serif">3</text>'),
        TK:   icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    };

    // ---- 模态弹窗 ----
    let modalEl = null;

    /**
     * 显示多字段模态弹窗
     * @param {Array<{label: string, placeholder: string, value?: string}>} fields - 字段配置数组
     * @param {Function} cb - 回调，参数为各字段值的数组
     */
    const showModal = (fields, cb) => {
        hideModal();
        if (!Array.isArray(fields)) fields = [fields];
        modalEl = document.createElement('div');
        modalEl.id = 'bn-pe-modal';

        const fieldsHtml = fields.map((f, i) =>
            `<div class="field-group">` +
            `  <label>${f.label}</label>` +
            `  <input type="text" data-idx="${i}" placeholder="${f.placeholder || ''}" value="${f.value || ''}">` +
            `</div>`
        ).join('');

        modalEl.innerHTML =
            `<div class="bn-pe-modal-bg"></div>` +
            `<div class="bn-pe-modal-card">` +
            fieldsHtml +
            `  <div class="actions"><button class="cancel">取消</button><button class="ok">确定</button></div>` +
            `</div>`;
        document.body.appendChild(modalEl);

        const inputs = modalEl.querySelectorAll('input[type="text"]');
        const ok = modalEl.querySelector('.ok');
        const cancel = () => hideModal();

        ok.onclick = () => {
            const values = Array.from(inputs).map(inp => inp.value.trim());
            cb(values.length === 1 ? values[0] : values);
            cancel();
        };

        modalEl.querySelector('.cancel').onclick = cancel;
        modalEl.querySelector('.bn-pe-modal-bg').onclick = cancel;

        // 回车跳到下一个输入框，最后一个回车提交
        inputs.forEach((inp, i) => {
            inp.onkeydown = e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < inputs.length - 1) {
                        inputs[i + 1].focus();
                    } else {
                        ok.click();
                    }
                }
                if (e.key === 'Escape') cancel();
            };
        });

        setTimeout(() => inputs[0].focus(), 60);
    };

    const hideModal = () => { modalEl?.remove(); modalEl = null; };

    // ---- 渲染 ----
    const render = (el, text) => {
        if (!text) { el.innerHTML = ''; return; }
        try {
            const h = restore(DOMPurify.sanitize(marked.parse(protect(text)), {
                FORBID_TAGS: ['style', 'link', 'iframe', 'script', 'frame'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
                ADD_TAGS: ['math', 'mrow', 'mi', 'mo', 'msup', 'msub', 'mfrac', 'msqrt', 'munder', 'mover', 'annotation', 'semantics'],
                ADD_ATTR: ['xmlns']
            }));
            el.innerHTML = h;
            window.Prism?.highlightAllUnder?.(el);
        } catch (err) {
            el.innerHTML = `<p style="color:#db2828">渲染出错: ${err.message}</p>`;
        }
    };

    // ---- 截屏 ----
    const loadDomToImage = () => new Promise((resolve, reject) => {
        if (typeof domtoimage !== 'undefined') return resolve();
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('content/libs/dom-to-image/dom-to-image.min.js');
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('dom-to-image 加载失败'));
        document.head.appendChild(script);
    });

    async function capture(el) {
        await loadDomToImage();
        await document.fonts.ready;
        try {
            const dataUrl = await domtoimage.toPng(el, {
                scale: Math.min(2, devicePixelRatio || 1.5),
                bgcolor: '#ffffff',
                quality: 1
            });
            if (!dataUrl) throw new Error('截图生成失败');
            return dataUrl;
        } catch (e) {
            console.error('[BN-Paper] 截屏失败:', e);
            alert('截屏失败: ' + e.message);
            return null;
        }
    }

    const dataURLtoBlob = u => {
        const [m, b] = [u.match(/:(.*?);/)[1], atob(u.split(',')[1])];
        const a = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
        return new Blob([a], { type: m });
    };

    // ---- 工具栏 ----
    const createToolbar = ta => {
        const tb = document.createElement('div');
        tb.id = 'bn-pe-toolbar';

        const defs = [
            [I.B,   '粗体 (Ctrl+B)',     () => wrapSel(ta, '**', '**')],
            [I.I,   '斜体 (Ctrl+I)',     () => wrapSel(ta, '*', '*')],
            [I.S,   '删除线',             () => wrapSel(ta, '~~', '~~')],
            [I.HR,  '分隔线',             () => ins(ta, '\n\n---\n\n')],
            [I.H,   '标题',               () => ins(ta, '## ')],
            [I.Q,   '引用',               () => wrapSel(ta, '> ', '')],
            [I.C,   '行内代码',           () => wrapSel(ta, '`', '`')],
            [I.FX,  '公式块',             () => wrapSel(ta, '\n$$\n', '\n$$\n')],
            [I.LK,  '链接',               () => {
                const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                if (sel) {
                    // 有选中文本：只需输入链接地址
                    showModal([{ label: '链接地址', placeholder: 'https://', value: '' }], url => {
                        if (!url) return;
                        wrapSel(ta, '[', `](${url})`);
                    });
                } else {
                    // 无选中文本：同时输入文本和地址
                    showModal([
                        { label: '链接文本', placeholder: '显示文字', value: '' },
                        { label: '链接地址', placeholder: 'https://', value: '' }
                    ], vals => {
                        const [text, url] = vals;
                        if (!url) return;
                        ins(ta, `[${text || url}](${url})`);
                    });
                }
            }],
            [I.IMG, '图片',               () => {
                showModal([
                    { label: '图片地址', placeholder: 'https://', value: '' },
                    { label: 'Alt 文本（可选）', placeholder: '图片描述', value: '' }
                ], vals => {
                    const [url, alt] = vals;
                    if (!url) return;
                    ins(ta, `![${alt || ''}](${url})`);
                });
            }],
            [I.TBL, '表格',               () => {
                showModal([
                    { label: '行数', placeholder: '3', value: '3' },
                    { label: '列数', placeholder: '3', value: '3' }
                ], vals => {
                    const [rv, cv] = vals;
                    const r = Math.max(0, +rv || 3), c = Math.max(1, +cv || 3);
                    let t = '\n|' + Array.from({ length: c }, (_, i) => ` 表头${i + 1} |`).join('');
                    t += '\n|' + Array(c).fill(' --- |').join('');
                    for (let j = 0; j < r; j++) t += '\n|' + Array(c).fill(' 单元格 |').join('');
                    ins(ta, t + '\n');
                });
            }],
            [I.UL,  '无序列表',           () => ins(ta, '\n- ')],
            [I.OL,  '有序列表',           () => ins(ta, '\n1. ')],
            [I.TK,  '任务列表',           () => ins(ta, '\n- [ ] ')],
        ];

        // 在合适位置插入分隔符
        const seps = new Set([4, 7, 9]); // HR 后、C 后、FX 后
        defs.forEach(([svg, title, fn], i) => {
            if (seps.has(i)) {
                const sep = document.createElement('div');
                sep.className = 'bn-pe-btn sep';
                tb.appendChild(sep);
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = title;
            btn.innerHTML = svg;
            btn.className = 'bn-pe-btn';
            btn.addEventListener('click', e => { e.preventDefault(); fn(); });
            tb.appendChild(btn);
        });

        return tb;
    };

    // ---- 按钮加载态 ----
    const setBtnLoading = (btn, loading, text) => {
        btn.disabled = loading;
        btn.innerHTML = loading
            ? '<i class="spinner loading icon"></i> ' + (text || '处理中...')
            : (text || '<i class="send icon"></i> 提交答案');
    };

    // ---- 构建 UI ----
    function build(formEl) {
        const origField = formEl.querySelector('#answer');
        let submitBtn = formEl.querySelector('#submit-button');
        if (!origField || !submitBtn) return null;

        // 清理原站事件绑定
        formEl.removeAttribute('onsubmit');
        formEl.onsubmit = null;
        const cleanBtn = submitBtn.cloneNode(true);
        cleanBtn.type = 'button';
        submitBtn.parentNode.replaceChild(cleanBtn, submitBtn);
        submitBtn = cleanBtn;

        // 创建 DOM
        const container = document.createElement('div');
        container.id = CID;

        const toolbar = createToolbar(null);

        const body = document.createElement('div');
        body.className = 'bn-pe-body';

        const ewrap = document.createElement('div');
        ewrap.className = 'bn-pe-edit-wrap';
        const textarea = document.createElement('textarea');
        textarea.id = EID;
        textarea.placeholder = '在此输入 Markdown...';
        ewrap.appendChild(textarea);

        const handle = document.createElement('div');
        handle.className = 'bn-pe-grip';

        const pwrap = document.createElement('div');
        pwrap.className = 'bn-pe-prev-wrap';
        const phdr = document.createElement('div');
        phdr.className = 'bn-pe-prev-hdr';
        phdr.innerHTML = icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>') + ' 实时预览';
        const previewEl = document.createElement('div');
        previewEl.id = PID;
        pwrap.append(phdr, previewEl);

        body.append(ewrap, handle, pwrap);

        const sb = document.createElement('div');
        sb.className = 'bn-pe-statusbar';
        const cc = document.createElement('span');
        cc.textContent = '0 字符';
        sb.appendChild(cc);

        container.append(toolbar, body, sb);

        // 插入表单
        const grid = formEl.querySelector('.ui.grid');
        grid ? grid.insertBefore(container, grid.firstChild) : formEl.insertBefore(container, formEl.firstChild);

        // 替换为绑定好的工具栏
        toolbar.replaceWith(createToolbar(textarea));

        // 拖拽分割
        let dragging = false, startX = 0, startW = 0;
        handle.addEventListener('pointerdown', e => {
            dragging = true;
            startX = e.clientX;
            startW = ewrap.offsetWidth;
            handle.classList.add('active');
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        const onMove = e => {
            if (!dragging) return;
            const delta = e.clientX - startX;
            const totalW = body.offsetWidth - 4;
            const nw = Math.max(totalW * .2, Math.min(totalW * .8, startW + delta));
            ewrap.style.flex = 'none';
            ewrap.style.width = nw + 'px';
        };
        const onUp = () => { dragging = false; };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);

        // 从 localStorage 恢复草稿
        const draft = loadDraft();
        if (draft) {
            textarea.value = draft;
            cc.textContent = draft.length + ' 字符';
            render(previewEl, draft);
            // 显示草稿恢复提示
            const hint = document.createElement('span');
            hint.textContent = '已恢复草稿';
            hint.style.cssText = 'color:var(--bn-primary);font-size:11px;margin-left:auto;opacity:1;transition:opacity .6s ease 2s;';
            sb.appendChild(hint);
            setTimeout(() => { hint.style.opacity = '0'; setTimeout(() => hint.remove(), 700); }, 100);
        }

        // 输入事件
        textarea.addEventListener('input', () => {
            const val = textarea.value;
            cc.textContent = val.length + ' 字符';
            render(previewEl, val);
            saveDraft(val);
        });
        textarea.addEventListener('keydown', e => {
            if (e.key === 'Tab') { e.preventDefault(); ins(textarea, '    '); }
        });

        // 提交拦截
        async function handleSubmit(e) {
            e?.preventDefault();
            e?.stopPropagation();
            e?.stopImmediatePropagation?.();

            // 如果已有文件，直接提交
            if (origField.files?.length) {
                setBtnLoading(submitBtn, true, '提交中...');
                try { HTMLFormElement.prototype.submit.call(formEl); }
                catch (er) { alert(er.message); setBtnLoading(submitBtn, false); }
                return;
            }

            if (!textarea.value.trim()) { alert('请输入内容！'); return; }

            const oldHtml = submitBtn.innerHTML;
            setBtnLoading(submitBtn, true, '截屏中...');
            try {
                render(previewEl, textarea.value.trim());
                await new Promise(r => setTimeout(r, 300));

                const dataUrl = await capture(previewEl);
                if (!dataUrl) { setBtnLoading(submitBtn, false, oldHtml); return; }

                const dt = new DataTransfer();
                dt.items.add(new File([dataURLtoBlob(dataUrl)], 'answer.png', { type: 'image/png' }));
                origField.files = dt.files;

                setBtnLoading(submitBtn, true, '提交中...');
                clearDraft(); // 提交成功，清除草稿
                HTMLFormElement.prototype.submit.call(formEl);
            } catch (err) {
                alert('提交失败: ' + err.message);
                setBtnLoading(submitBtn, false, oldHtml);
            }
        }

        formEl.addEventListener('submit', handleSubmit, true);
        submitBtn.addEventListener('click', handleSubmit, true);

        return { textarea, previewEl };
    }

    // ---- 入口 ----
    async function init() {
        if (!isPaperPage()) return;
        console.log('[BN-Paper-Editor] 初始化...');
        if (!(await waitForDeps())) return;
        await injectAssets();
        await new Promise(r => setTimeout(r, 300));

        const formEl = document.querySelector('#submit_code');
        if (!formEl || document.getElementById(CID)) return;
        build(formEl);
        console.log('[BN-Paper-Editor] ✓ 就绪');
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', init)
        : setTimeout(init, 500);
})();
