(function () {
    'use strict';

    // ---- 页面检测 ----
    const path = location.pathname || '';
    if (!/^\/problem\/7\d{3,}/.test(path)) return;

    const KATEX_FONTS = [
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

    const isEnabled = () => {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue('enablePaperEditor', true) !== false;
        } catch {}
        return true;
    };

    const isPaperPage = () => document.body?.textContent.includes('这是一道纸面作业');

    const waitForDeps = () => new Promise(resolve => {
        const iv = setInterval(() => {
            if (typeof marked !== 'undefined' && typeof renderMathInElement === 'function' && typeof snapdom === 'function' && document.querySelector('#submit_code'))
                { clearInterval(iv); resolve(true); }
        }, 200);
        setTimeout(() => { clearInterval(iv); resolve(false); }, 15000);
    });

    // ---- 注入资源 ----
    async function injectAssets() {
        if (!document.getElementById('bn-pe-style')) {
            const link = document.createElement('link');
            link.id = 'bn-pe-style';
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('content/paper-editor/editor.css');
            document.head.appendChild(link);
        }

        if (!document.getElementById('bn-pe-katex-css')) {
            try {
                const cssUrl = chrome.runtime.getURL('content/libs/katex/katex.min.css');
                const fontBase = chrome.runtime.getURL('content/libs/katex/fonts/');
                const css = await fetch(cssUrl).then(r => r.ok ? r.text() : '');
                if (css) {
                    const style = document.createElement('style');
                    style.id = 'bn-pe-katex-css';
                    style.textContent = css.replace(/url\(fonts\//g, `url(${fontBase}`);
                    document.head.appendChild(style);
                }
            } catch (error) {
                console.warn('[BN-Paper-Editor] KaTeX CSS 注入失败:', error);
            }
        }

        if (document.getElementById('bn-pe-katex-fonts')) return;
        const base = chrome.runtime.getURL('content/libs/katex/fonts/');
        const style = document.createElement('style');
        style.id = 'bn-pe-katex-fonts';
        style.textContent = KATEX_FONTS.map(([name, file, w = 'normal', st = 'normal']) =>
            `@font-face{font-family:'${name}';src:url('${base}${file}') format('woff2');font-weight:${w};font-style:${st};font-display:swap;}`
        ).join('');
        document.head.appendChild(style);
    }

    // ---- 常量 ----
    const CID = 'bn-paper-container', EID = 'bn-paper-editor', PID = 'bn-paper-preview';
    const CAPTURE_MIN_WIDTH = 760;
    const CAPTURE_MAX_WIDTH = 1440;
    const CAPTURE_TARGET_SCALE = 2.25;
    const CAPTURE_MAX_SIDE = 16000;
    const CAPTURE_MAX_PIXELS = 90000000;
    let _segs = [];

    // ---- localStorage 持久化 ----
    const STORAGE_KEY = 'bn-pe-md-' + location.pathname;
    const saveDraft = text => {
        try { localStorage.setItem(STORAGE_KEY, text); } catch {}
    };
    const loadDraft = () => {
        try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
    };

    // ---- Markdown 公式保护 ----
    const protect = t => {
        _segs = [];
        const stash = (formula, block) => {
            const i = _segs.length;
            _segs.push({ k: `BNMATH${i}END`, v: formula.trim(), b: block ? 1 : 0 });
            return _segs[i].k;
        };
        t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => stash(f, true));
        t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => stash(f, true));
        t = t.replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => stash(f, false));
        return t.replace(/\$([^\$\n]+?)\$/g, (_, f) => stash(f, false));
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
    const replaceText = (ta, start, end, text, caret) => {
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(start, end);

        // Chromium 会把 execCommand('insertText') 记入 textarea 的原生撤销栈。
        // setRangeText 仅作为不支持该命令时的兼容回退。
        let recordedByBrowser = false;
        try {
            recordedByBrowser = ta.ownerDocument.execCommand('insertText', false, text);
        } catch {}
        if (!recordedByBrowser) {
            ta.setRangeText(text, start, end, 'end');
            ta.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: text,
            }));
        }

        ta.setSelectionRange(caret, caret);
        ta.focus({ preventScroll: true });
    };

    const wrapSel = (ta, a, b) => {
        const s = ta.selectionStart, e = ta.selectionEnd;
        const sel = ta.value.substring(s, e);
        const pos = s + a.length + sel.length;
        replaceText(ta, s, e, a + sel + b, pos);
    };

    const ins = (ta, txt) => {
        const s = ta.selectionStart, e = ta.selectionEnd;
        replaceText(ta, s, e, txt, s + txt.length);
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

    // ---- 生成提交图片 ----
    const waitSnapdom = () => new Promise((resolve, reject) => {
        if (typeof snapdom === 'function') return resolve();
        let n = 0;
        const iv = setInterval(() => {
            if (typeof snapdom === 'function') { clearInterval(iv); resolve(); }
            else if (++n > 80) { clearInterval(iv); reject(new Error('SnapDOM 未加载')); }
        }, 50);
    });

    const blobToDataUrl = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('读取字体失败'));
        reader.readAsDataURL(blob);
    });

    const runtimeUrl = path => chrome.runtime.getURL(path);
    const fontDataUrlCache = new Map();
    let katexLocalFontsPromise = null;

    async function getFontDataUrl(url) {
        if (fontDataUrlCache.has(url)) return fontDataUrlCache.get(url);
        const dataUrl = await fetch(url).then(response => {
            if (!response.ok) throw new Error(`字体加载失败: ${response.status}`);
            return response.blob();
        }).then(blobToDataUrl);
        fontDataUrlCache.set(url, dataUrl);
        return dataUrl;
    }

    async function getKatexLocalFonts() {
        if (!katexLocalFontsPromise) {
            katexLocalFontsPromise = Promise.all(KATEX_FONTS.map(async ([family, file, weight = 'normal', style = 'normal']) => {
                try {
                    return {
                        family,
                        src: await getFontDataUrl(runtimeUrl(`content/libs/katex/fonts/${file}`)),
                        weight,
                        style,
                    };
                } catch (error) {
                    console.warn('[BN-Paper] KaTeX 字体内联失败:', file, error);
                    return null;
                }
            })).then(fonts => fonts.filter(Boolean));
        }
        return katexLocalFontsPromise;
    }

    const canvasHasInk = canvas => {
        const sample = document.createElement('canvas');
        sample.width = Math.min(320, canvas.width);
        sample.height = Math.min(320, canvas.height);
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        if (!ctx) return true;
        if (!sample.width || !sample.height) return false;
        ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
        const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) return true;
        }
        return false;
    };

    async function pngBlobFromCanvas(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('PNG 编码失败'));
            }, 'image/png');
        });
    }

    const getHorizontalPadding = el => {
        const style = getComputedStyle(el);
        return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    };

    const getCaptureContentWidth = node => Math.max(1, node.clientWidth - getHorizontalPadding(node));

    function getElementNaturalWidth(el) {
        const rect = el.getBoundingClientRect();
        return Math.ceil(Math.max(el.scrollWidth || 0, el.offsetWidth || 0, rect.width || 0));
    }

    function chooseCaptureWidth(node) {
        const paddingX = getHorizontalPadding(node);
        const currentWidth = Math.max(CAPTURE_MIN_WIDTH, node.clientWidth || 0);
        let desiredContentWidth = Math.max(1, currentWidth - paddingX);
        node.querySelectorAll('.katex-display > .katex, table, pre').forEach(el => {
            desiredContentWidth = Math.max(desiredContentWidth, getElementNaturalWidth(el));
        });
        return Math.ceil(Math.min(CAPTURE_MAX_WIDTH, Math.max(CAPTURE_MIN_WIDTH, desiredContentWidth + paddingX)));
    }

    function fitOversizedMath(node) {
        const contentWidth = getCaptureContentWidth(node);
        node.querySelectorAll('.katex-display').forEach(display => {
            const katexEl = display.querySelector(':scope > .katex') || display.querySelector('.katex');
            if (!katexEl) return;

            display.scrollLeft = 0;
            Object.assign(display.style, {
                overflow: 'visible',
                overflowX: 'visible',
                overflowY: 'visible',
                width: '100%',
            });
            Object.assign(katexEl.style, {
                display: 'inline-block',
                maxWidth: 'none',
                transform: '',
                transformOrigin: 'top left',
                marginLeft: '',
            });

            const rect = katexEl.getBoundingClientRect();
            const naturalWidth = Math.ceil(Math.max(katexEl.scrollWidth || 0, rect.width || 0));
            const naturalHeight = Math.ceil(Math.max(katexEl.scrollHeight || 0, rect.height || 0));
            if (!naturalWidth || naturalWidth <= contentWidth) {
                display.style.height = '';
                return;
            }

            const scale = contentWidth / naturalWidth;
            katexEl.style.transform = `scale(${scale})`;
            katexEl.style.marginLeft = '0';
            display.style.height = Math.ceil(naturalHeight * scale) + 'px';
        });
    }

    function getCaptureScale(width, height) {
        const sideLimit = Math.min(CAPTURE_MAX_SIDE / Math.max(1, width), CAPTURE_MAX_SIDE / Math.max(1, height));
        const areaLimit = Math.sqrt(CAPTURE_MAX_PIXELS / Math.max(1, width * height));
        return Math.max(0.75, Math.min(CAPTURE_TARGET_SCALE, sideLimit, areaLimit));
    }

    function createCaptureNode(el) {
        const node = el.cloneNode(true);
        node.id = 'bn-paper-capture';
        Object.assign(node.style, {
            width: Math.max(CAPTURE_MIN_WIDTH, el.clientWidth || CAPTURE_MIN_WIDTH) + 'px',
            boxSizing: 'border-box',
            background: '#fff',
            padding: '24px 28px',
            overflow: 'visible',
        });
        node.querySelectorAll('.katex-mathml').forEach(mathml => mathml.remove());
        return node;
    }

    async function captureWithSnapdom(node, width, height) {
        await waitSnapdom();
        const scale = getCaptureScale(width, height);
        const options = {
            type: 'png',
            format: 'png',
            width,
            height,
            scale,
            dpr: 1,
            backgroundColor: '#fff',
            embedFonts: true,
            localFonts: await getKatexLocalFonts(),
            cache: 'disabled',
            outerTransforms: false,
            outerShadows: false,
            fast: false,
            debug: false,
        };
        const canvas = await snapdom.toCanvas(node, options);
        if (!canvas.width || !canvas.height) throw new Error('生成图片尺寸为空');
        if (!canvasHasInk(canvas)) {
            throw new Error('生成图片为空白，请检查内容或图片资源');
        }
        const blob = await pngBlobFromCanvas(canvas);
        if (!blob.size) throw new Error('生成图片为空');
        return blob;
    }

    async function capture(el) {
        try {
            await document.fonts?.ready;
        } catch {}
        const node = createCaptureNode(el);
        Object.assign(node.style, {
            position: 'fixed',
            left: '-10000px',
            top: '0',
            zIndex: '-1',
        });
        document.body.appendChild(node);
        try {
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const captureWidth = chooseCaptureWidth(node);
            if (captureWidth !== node.clientWidth) {
                node.style.width = captureWidth + 'px';
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            }
            fitOversizedMath(node);
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const width = Math.ceil(Math.max(CAPTURE_MIN_WIDTH, node.clientWidth || el.clientWidth || CAPTURE_MIN_WIDTH));
            const height = Math.ceil(Math.max(1, node.scrollHeight || node.clientHeight || el.scrollHeight || 1));
            return await captureWithSnapdom(node, width, height);
        } catch (e) {
            console.error('[BN-Paper] 生成提交图片失败:', e);
            alert('生成提交图片失败: ' + e.message);
            return null;
        } finally { node.remove(); }
    }

    const getAnswerImageFileName = () => {
        const matched = (location.pathname || '').match(/\/problem\/([^/?#]+)/);
        const id = matched ? matched[1].replace(/[^\w.-]+/g, '-') : 'paper';
        return `answer-${id}.png`;
    };

    const isSubmittedHomeworkHeader = el => {
        if (!el || !el.matches?.('h4.ui.top.block.attached.header')) return false;
        return (el.textContent || '').replace(/\s+/g, '').includes('已提交作业');
    };

    const getSubmittedHomeworkHeaderFor = el => {
        let node = el;
        while (node && node.nodeType === 1 && node !== document.body) {
            if (isSubmittedHomeworkHeader(node)) return node;
            if (isSubmittedHomeworkHeader(node.previousElementSibling)) return node.previousElementSibling;
            node = node.parentElement;
        }
        return null;
    };

    const isSubmittedHomeworkBlock = el => {
        if (!el) return false;
        if (getSubmittedHomeworkHeaderFor(el)) return true;
        if (!el.querySelectorAll) return false;
        return Array.from(el.querySelectorAll('h4.ui.top.block.attached.header')).some(isSubmittedHomeworkHeader);
    };

    const findEditorInsertionTarget = (formEl, origField) => {
        let directChild = origField;
        while (directChild.parentElement && directChild.parentElement !== formEl) {
            directChild = directChild.parentElement;
        }
        const submittedHeader = getSubmittedHomeworkHeaderFor(directChild);
        if (submittedHeader && submittedHeader.parentElement) {
            return { parent: submittedHeader.parentElement, anchor: submittedHeader };
        }
        if (directChild && directChild !== formEl && !isSubmittedHomeworkBlock(directChild)) {
            return { parent: formEl, anchor: directChild };
        }

        const selectors = ['.ui.grid', '.fields', '.field', '.ui.segment'];
        for (const selector of selectors) {
            const candidate = origField.closest(selector);
            if (candidate && candidate.parentElement && formEl.contains(candidate) && !isSubmittedHomeworkBlock(candidate)) {
                return { parent: candidate.parentElement, anchor: candidate };
            }
        }
        return { parent: formEl, anchor: formEl.firstChild };
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
            btn.addEventListener('mousedown', e => e.preventDefault());
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

    const setExportButtonState = (btn, state = 'idle') => {
        const icon = document.createElement('i');
        const label = document.createElement('span');
        if (state === 'working') {
            icon.className = 'spinner loading icon';
            label.textContent = '正在导出…';
        } else if (state === 'done') {
            icon.className = 'check icon';
            label.textContent = '导出成功';
        } else {
            icon.className = 'download icon';
            label.textContent = '导出图片';
        }
        btn.replaceChildren(icon, label);
        btn.disabled = state === 'working';
    };

    const downloadBlob = (blob, filename) => {
        if (!(blob instanceof Blob) || !blob.size) throw new Error('导出图片为空');
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.hidden = true;
        document.body.appendChild(link);
        try {
            link.click();
        } finally {
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
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
        cleanBtn.disabled = false;
        submitBtn.parentNode.replaceChild(cleanBtn, submitBtn);
        submitBtn = cleanBtn;
        const originalSubmitHtml = submitBtn.innerHTML;

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
        const statusInfo = document.createElement('div');
        statusInfo.className = 'bn-pe-status-info';
        const cc = document.createElement('span');
        cc.textContent = '0 字符';
        statusInfo.appendChild(cc);
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'bn-pe-export-btn';
        exportBtn.title = '将当前 Markdown 和 LaTeX 预览导出为 PNG 图片';
        setExportButtonState(exportBtn);
        const editorSubmitBtn = document.createElement('button');
        editorSubmitBtn.type = 'button';
        editorSubmitBtn.className = 'bn-pe-export-btn bn-pe-submit-btn';
        editorSubmitBtn.title = '将当前 Markdown 和 LaTeX 预览生成为图片并提交';
        setBtnLoading(editorSubmitBtn, false);
        const statusActions = document.createElement('div');
        statusActions.className = 'bn-pe-status-actions';
        statusActions.append(exportBtn, editorSubmitBtn);
        sb.append(statusInfo, statusActions);

        container.append(toolbar, body, sb);

        // 插入到原始上传框所在区域之前，避免命中“已提交作业”面板内的 grid。
        const insertion = findEditorInsertionTarget(formEl, origField);
        insertion.parent.insertBefore(container, insertion.anchor);

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
            hint.style.cssText = 'color:var(--bn-primary);font-size:11px;margin-left:8px;opacity:1;transition:opacity .6s ease 2s;';
            statusInfo.appendChild(hint);
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
        let submitting = false;
        let exporting = false;
        let exportFeedbackTimer = null;
        const setSubmitLoading = (loading, text) => {
            setBtnLoading(submitBtn, loading, loading ? text : originalSubmitHtml);
            setBtnLoading(editorSubmitBtn, loading, loading ? text : undefined);
            exportBtn.disabled = loading || exporting;
        };
        const renderAndCapturePreview = async () => {
            if (!textarea.value.trim()) {
                alert('请输入内容！');
                return null;
            }
            render(previewEl, textarea.value.trim());
            await new Promise(r => setTimeout(r, 300));
            return capture(previewEl);
        };

        async function handleExport(e) {
            e?.preventDefault();
            e?.stopPropagation();
            e?.stopImmediatePropagation?.();
            if (exporting || submitting) return;

            exporting = true;
            clearTimeout(exportFeedbackTimer);
            setExportButtonState(exportBtn, 'working');
            submitBtn.disabled = true;
            editorSubmitBtn.disabled = true;
            let succeeded = false;
            try {
                const imageBlob = await renderAndCapturePreview();
                if (!imageBlob) return;
                downloadBlob(imageBlob, getAnswerImageFileName());
                succeeded = true;
            } catch (err) {
                console.error('[BN-Paper] 导出图片失败:', err);
                alert('导出图片失败: ' + err.message);
            } finally {
                exporting = false;
                submitBtn.disabled = false;
                editorSubmitBtn.disabled = false;
                setExportButtonState(exportBtn, succeeded ? 'done' : 'idle');
                if (succeeded) {
                    exportFeedbackTimer = setTimeout(() => {
                        if (!exporting && !submitting) setExportButtonState(exportBtn, 'idle');
                    }, 1600);
                }
            }
        }

        async function handleSubmit(e) {
            e?.preventDefault();
            e?.stopPropagation();
            e?.stopImmediatePropagation?.();
            if (submitting || exporting) return;
            submitting = true;

            // 如果已有文件，直接提交
            if (origField.files?.length) {
                setSubmitLoading(true, '提交中...');
                try { HTMLFormElement.prototype.submit.call(formEl); }
                catch (er) {
                    alert(er.message);
                    submitting = false;
                    setSubmitLoading(false);
                }
                return;
            }

            setSubmitLoading(true, '生成图片中...');
            try {
                const imageBlob = await renderAndCapturePreview();
                if (!imageBlob) {
                    submitting = false;
                    setSubmitLoading(false);
                    return;
                }

                const dt = new DataTransfer();
                dt.items.add(new File([imageBlob], getAnswerImageFileName(), { type: 'image/png' }));
                origField.files = dt.files;

                setSubmitLoading(true, '提交中...');
                HTMLFormElement.prototype.submit.call(formEl);
            } catch (err) {
                alert('提交失败: ' + err.message);
                submitting = false;
                setSubmitLoading(false);
            }
        }

        formEl.addEventListener('submit', handleSubmit, true);
        submitBtn.addEventListener('click', handleSubmit, true);
        editorSubmitBtn.addEventListener('click', handleSubmit, true);
        exportBtn.addEventListener('click', handleExport, true);

        return { textarea, previewEl };
    }

    // ---- 入口 ----
    async function init() {
        try {
            if (typeof window.__GM_ready === 'function') await window.__GM_ready();
        } catch {}
        if (!isEnabled()) return;
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
