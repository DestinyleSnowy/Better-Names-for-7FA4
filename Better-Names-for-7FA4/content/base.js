(function () {
    'use strict';
    marked.use({breaks: true});
    Prism.manual = true;
    const CODE_THEME_ENABLED_KEY = 'codeThemeEnabled';
    const CODE_THEME_SOURCE_KEY = 'codeThemeSource';
    const CUSTOM_THEME_CSS_KEY = 'customThemeCss';
    const BUILTIN_CODE_THEME_CSS = `
/* PrismJS theme tuned for Better Names light pages. */
code[class*="language-"],
pre[class*="language-"] {
    color: #1f2937;
    background: none;
    font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
    font-size: 0.95em;
    text-align: left;
    white-space: pre;
    word-spacing: normal;
    word-break: normal;
    word-wrap: normal;
    line-height: 1.55;
    -moz-tab-size: 4;
    -o-tab-size: 4;
    tab-size: 4;
    -webkit-hyphens: none;
    -moz-hyphens: none;
    -ms-hyphens: none;
    hyphens: none;
}

:not(pre) > code[class*="language-"],
pre[class*="language-"] {
    background: #f8fafc;
}

pre[class*="language-"] {
    padding: 1em;
    margin: 0.75em 0;
    overflow: auto;
    border: 1px solid #dbe4f0;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

:not(pre) > code[class*="language-"] {
    padding: 0.12em 0.32em;
    border: 1px solid #dbe4f0;
    border-radius: 5px;
    color: #334155;
    white-space: normal;
}

.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
    color: #64748b;
}

.token.punctuation {
    color: #475569;
}

.token.namespace {
    opacity: 0.75;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol {
    color: #dc2626;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
    color: #16a34a;
}

.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string,
.token.variable {
    color: #0f766e;
}

.token.atrule,
.token.attr-value,
.token.function,
.token.class-name {
    color: #2563eb;
}

.token.keyword {
    color: #7c3aed;
}

.token.regex,
.token.important {
    color: #ea580c;
}

.token.deleted {
    color: #e11d48;
}

.token.important,
.token.bold {
    font-weight: 700;
}

.token.italic {
    font-style: italic;
}

.token.entity {
    cursor: help;
}

pre[data-line] {
    position: relative;
    padding: 1em 0 1em 3em;
}

.line-highlight {
    position: absolute;
    left: 0;
    right: 0;
    padding: inherit 0;
    margin-top: 1em;
    background: linear-gradient(to right, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0));
    pointer-events: none;
    line-height: inherit;
    white-space: pre;
}

@media print {
    code[class*="language-"],
    pre[class*="language-"],
    .line-highlight {
        text-shadow: none;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
    }
}

.line-highlight:before,
.line-highlight[data-end]:after {
    content: attr(data-start);
    position: absolute;
    top: 0.4em;
    left: 0.6em;
    min-width: 1em;
    padding: 0 0.5em;
    background-color: #dbeafe;
    color: #1d4ed8;
    font: bold 65%/1.5 sans-serif;
    text-align: center;
    vertical-align: 0.3em;
    border-radius: 999px;
}

.line-highlight[data-end]:after {
    content: attr(data-end);
    top: auto;
    bottom: 0.4em;
}

.line-numbers .line-highlight:before,
.line-numbers .line-highlight:after {
    content: none;
}

pre[id].linkable-line-numbers span.line-numbers-rows {
    pointer-events: all;
}

pre[id].linkable-line-numbers span.line-numbers-rows > span:before {
    cursor: pointer;
}

pre[id].linkable-line-numbers span.line-numbers-rows > span:hover:before {
    background-color: rgba(37, 99, 235, 0.12);
}

pre[class*="language-"].line-numbers {
    position: relative;
    padding-left: 3.8em;
    counter-reset: linenumber;
}

pre[class*="language-"].line-numbers > code {
    position: relative;
    white-space: inherit;
}

.line-numbers .line-numbers-rows {
    position: absolute;
    pointer-events: none;
    top: 0;
    left: -3.8em;
    width: 3em;
    font-size: 100%;
    letter-spacing: 0;
    border-right: 1px solid #dbe4f0;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

.line-numbers-rows > span {
    display: block;
    counter-increment: linenumber;
}

.line-numbers-rows > span:before {
    content: counter(linenumber);
    color: #94a3b8;
    display: block;
    padding-right: 0.8em;
    text-align: right;
}

.token a {
    color: inherit;
}

div.code-toolbar {
    position: relative;
}

div.code-toolbar > .toolbar {
    position: absolute;
    z-index: 10;
    top: 0.45em;
    right: 0.45em;
    transition: opacity 0.2s ease-in-out;
    opacity: 0;
}

div.code-toolbar:hover > .toolbar,
div.code-toolbar:focus-within > .toolbar {
    opacity: 1;
}

div.code-toolbar > .toolbar > .toolbar-item {
    display: inline-block;
}

div.code-toolbar > .toolbar > .toolbar-item > a {
    cursor: pointer;
}

div.code-toolbar > .toolbar > .toolbar-item > button {
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    line-height: normal;
    overflow: visible;
    padding: 0;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

div.code-toolbar > .toolbar > .toolbar-item > a,
div.code-toolbar > .toolbar > .toolbar-item > button,
div.code-toolbar > .toolbar > .toolbar-item > span {
    color: #475569;
    font-size: 0.78em;
    padding: 0.2em 0.6em;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

div.code-toolbar > .toolbar > .toolbar-item > a:focus,
div.code-toolbar > .toolbar > .toolbar-item > a:hover,
div.code-toolbar > .toolbar > .toolbar-item > button:focus,
div.code-toolbar > .toolbar > .toolbar-item > button:hover,
div.code-toolbar > .toolbar > .toolbar-item > span:focus,
div.code-toolbar > .toolbar > .toolbar-item > span:hover {
    color: #1d4ed8;
    border-color: #93c5fd;
    text-decoration: none;
}
`;

    const hasChromeStorage = !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);

    function mirrorToChromeStorage(key, value) {
        try {
            if (!hasChromeStorage) return;
            const obj = {};
            obj[key] = value;
            chrome.storage.local.set(obj);
        } catch (e) {
        }
    }

    function readFromChromeStorage(keys, cb) {
        if (!hasChromeStorage) {
            cb({});
            return;
        }
        try {
            chrome.storage.local.get(keys, cb);
        } catch (e) {
            cb({});
        }
    }

    const gmStore = Object.create(null);

    function gmLocalGet(key, defVal) {
        try {
            if (!Object.prototype.hasOwnProperty.call(gmStore, key)) return defVal;
            const value = gmStore[key];
            return value === undefined ? defVal : value;
        } catch (e) {
            return defVal;
        }
    }

    function gmLocalSet(key, value) {
        try {
            gmStore[key] = value;
            mirrorToChromeStorage(key, value);
        } catch (e) {
        }
    }

    const gmReadyPromise = new Promise((resolve) => {
        try {
            readFromChromeStorage(null, (all) => {
                try {
                    if (all) {
                        Object.keys(all).forEach(k => {
                            gmStore[k] = all[k];
                        });
                    }
                } catch (e) {
                }
                resolve();
            });
        } catch (_) {
            resolve();
        }
    });

    window.__GM_ready = function () {
        return gmReadyPromise;
    };

    function GM_addStyle(css) {
        try {
            const s = document.createElement('style');
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
            return s;
        } catch (e) {
            return null;
        }
    }

    let codeThemeStyleEl = null;
    let currentCodeThemeEnabled = false;

    function getCodeThemeCss(enabled, source, css) {
        if (!enabled) return '';
        if (source === 'custom') return typeof css === 'string' ? css : '';
        return BUILTIN_CODE_THEME_CSS;
    }

    function applyCodeThemePreference(enabled, source, css) {
        try {
            currentCodeThemeEnabled = !!enabled;
            if (codeThemeStyleEl && codeThemeStyleEl.parentNode) {
                codeThemeStyleEl.parentNode.removeChild(codeThemeStyleEl);
            }
            codeThemeStyleEl = null;
            const content = getCodeThemeCss(!!enabled, source, css).trim();
            if (!content) {
                updateFormattedCodeButtonPosition();
                cleanupCodeThemeEnhancements();
                return;
            }
            codeThemeStyleEl = GM_addStyle(content);
            if (codeThemeStyleEl) codeThemeStyleEl.id = 'bn-code-theme-css';
            refreshCodeThemeEnhancements();
            updateFormattedCodeButtonPosition();
        } catch (e) {
        }
    }

    function isCodeThemeEnabled() {
        return !!currentCodeThemeEnabled;
    }

    function updateFormattedCodeButtonPosition(root) {
        try {
            const scope = root && root.querySelectorAll ? root : document;
            scope.querySelectorAll('a[onclick*="toggleFormattedCode"]').forEach(button => {
                if (!Object.prototype.hasOwnProperty.call(button.dataset, 'bnFormattedCodeOriginalStyle')) {
                    button.dataset.bnFormattedCodeOriginalStyle = button.getAttribute('style') || '';
                }
                if (!currentCodeThemeEnabled) {
                    const originalStyle = button.dataset.bnFormattedCodeOriginalStyle;
                    if (originalStyle) {
                        button.setAttribute('style', originalStyle);
                    } else {
                        button.removeAttribute('style');
                    }
                    delete button.dataset.bnFormattedCodeOriginalStyle;
                    return;
                }
                button.style.position = 'fixed';
                button.style.top = '72px';
                button.style.right = '24px';
                button.style.zIndex = '2147483647';
            });
        } catch (_) {
        }
    }

    gmReadyPromise.then(() => applyCodeThemePreference(
        !!gmLocalGet(CODE_THEME_ENABLED_KEY, false),
        gmLocalGet(CODE_THEME_SOURCE_KEY, 'builtin'),
        gmLocalGet(CUSTOM_THEME_CSS_KEY, '')
    ));

    function cleanupCodeThemeEnhancements(root) {
        try {
            const scope = root || document;
            scope.querySelectorAll('div.code-toolbar').forEach(wrapper => {
                const pre = Array.from(wrapper.children).find(child => child && child.tagName === 'PRE');
                if (!pre || !pre.dataset || pre.dataset.bnCodeThemeEnhanced !== '1') return;
                if (wrapper.parentNode) {
                    wrapper.parentNode.insertBefore(pre, wrapper);
                }
                wrapper.remove();
            });
            scope.querySelectorAll('pre').forEach(pre => {
                if (!pre.dataset || pre.dataset.bnCodeThemeEnhanced !== '1') return;
                pre.classList.remove('line-numbers', 'linkable-line-numbers');
                pre.removeAttribute('data-prismjs-copy');
                pre.removeAttribute('data-prismjs-copy-error');
                pre.removeAttribute('data-prismjs-copy-success');
                pre.removeAttribute('data-prismjs-copy-timeout');
                if (pre.dataset) delete pre.dataset.bnCodeThemeEnhanced;
                pre.querySelectorAll('.line-numbers-rows, .line-numbers-sizer, .line-highlight').forEach(el => el.remove());
            });
        } catch (e) {
        }
    }

    function installCodeThemeToolbarGate() {
        try {
            if (!Prism || !Prism.plugins || !Prism.plugins.toolbar || !Prism.plugins.toolbar.hook) return;
            if (Prism.plugins.toolbar.__bnCodeThemeGated) return;
            const originalHook = Prism.plugins.toolbar.hook;
            const gatedHook = function (env) {
                if (!currentCodeThemeEnabled) return;
                return originalHook.call(this, env);
            };
            Prism.plugins.toolbar.hook = gatedHook;
            Prism.plugins.toolbar.__bnCodeThemeGated = true;
            const completeHooks = Prism.hooks && Prism.hooks.all && Prism.hooks.all.complete;
            if (Array.isArray(completeHooks)) {
                const index = completeHooks.indexOf(originalHook);
                if (index !== -1) completeHooks[index] = gatedHook;
            }
        } catch (e) {
        }
    }

    function refreshCodeThemeEnhancements() {
        try {
            if (!currentCodeThemeEnabled) return;
            document.querySelectorAll('pre').forEach(pre => addPrism(pre));
            document.querySelectorAll('.hljs').forEach(el => el.classList.remove('hljs'));
            if (Prism && typeof Prism.highlightAll === 'function') Prism.highlightAll();
            updateFormattedCodeButtonPosition();
        } catch (e) {
        }
    }

    function highlightCodeTheme(root) {
        try {
            if (!currentCodeThemeEnabled) return;
            const scope = root || document;
            scope.querySelectorAll('pre').forEach(pre => addPrism(pre));
            scope.querySelectorAll('.hljs').forEach(el => el.classList.remove('hljs'));
            if (Prism && typeof Prism.highlightAllUnder === 'function' && scope !== document) {
                Prism.highlightAllUnder(scope);
            } else if (Prism && typeof Prism.highlightAll === 'function') {
                Prism.highlightAll();
            }
            updateFormattedCodeButtonPosition(scope);
        } catch (e) {
        }
    }

    async function GM_setClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(String(text));
                return;
            }
        } catch (e) {
        }
        try {
            const ta = document.createElement('textarea');
            ta.value = String(text);
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        } catch (e) {
        }
    }

    function GM_notification(details) {
        try {
            if (typeof details === 'string') details = {text: details};
            const payload = {
                title: details.title || 'Notification',
                message: details.text || details.message || '',
                iconUrl: details.image || details.icon || undefined
            };
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({type: 'gm_notify', payload});
            } else if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(payload.title, {body: payload.message, icon: payload.iconUrl});
                } else {
                    Notification.requestPermission().then(p => {
                        if (p === 'granted') new Notification(payload.title, {
                            body: payload.message,
                            icon: payload.iconUrl
                        });
                    });
                }
            } else {
                alert(payload.title + "\n\n" + payload.message);
            }
        } catch (e) {
        }
    }

    function GM_xmlhttpRequest(details) {
        const requestId = Math.random().toString(36).slice(2);
        if (!(chrome && chrome.runtime && chrome.runtime.sendMessage)) {
            const url = details.url;
            const method = (details.method || 'GET').toUpperCase();
            const headers = details.headers || {};
            const body = details.data;
            fetch(url, {method, headers, body, credentials: (details.anonymous ? 'omit' : 'include')})
                .then(async resp => {
                    const text = await resp.text();
                    details.onload && details.onload({
                        responseText: text,
                        status: resp.status,
                        statusText: resp.statusText,
                        responseHeaders: Array.from(resp.headers.entries()).map(([k, v]) => k + ': ' + v).join('\r\n')
                    });
                })
                .catch(err => {
                    details.onerror && details.onerror({error: String(err)});
                });
            return;
        }
        chrome.runtime.sendMessage({type: 'gm_xhr', requestId, details}, (resp) => {
            if (!resp) return;
            if (resp.ok) {
                details.onload && details.onload({
                    responseText: resp.text,
                    status: resp.status,
                    statusText: resp.statusText,
                    responseHeaders: resp.headersRaw
                });
            } else {
                details.onerror && details.onerror({error: resp.error || 'GM_xmlhttpRequest failed'});
            }
        });
    }

    const RENDER_MATH_DELIMITERS = [
        {left: '$', right: '$', display: false},
        {left: '$$', right: '$$', display: true},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
    ];

    function getAccessSourceMap() {
        if (window.access_src instanceof Map) return window.access_src;
        const next = new Map();
        window.access_src = next;
        return next;
    }

    function CanShow(url) {
        if (typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith('data:')) return true;
        try {
            const abs = new URL(trimmed, location.href);
            return getAccessSourceMap().has(abs.href);
        } catch (error) {
            return false;
        }
    }

    const SAFE_MARKDOWN_URI_PATTERN = /^(?:(?:https?|mailto|tel):|#|\/(?!\/)|\.\.?\/|[a-z0-9+.\-]+(?:[^a-z0-9+.\-:]|$)|[^a-z]|data:image\/(?:png|gif|jpe?g|webp|bmp);|data:text\/plain|data:application\/json|data:application\/octet-stream)/i;

    function sanitizeMarkdownHTML(dirtyHTML) {
        return DOMPurify.sanitize(dirtyHTML, {
            FORBID_TAGS: ["style", "link", "iframe", "script", "frame"],
            FORBID_ATTR: ["id", "onerror", "onload", "onclick", "onmouseover"],
            ALLOWED_URI_REGEXP: SAFE_MARKDOWN_URI_PATTERN
        });
    }

    function RenderMarkdown(el, md) {
        if (!el) return;
        el.innerHTML = sanitizeMarkdownHTML(marked.parse(md || ''));
        renderMathInElement(el, {
            delimeters: RENDER_MATH_DELIMITERS,
            throwOnError: false
        });
        for (let elem of el.querySelectorAll("pre"))
            addPrism(elem);
    }

    function removeFixed(el) {
        const elements = el.querySelectorAll('*');
        for (let elem of elements) {
            elem.style.position = 'relative';
        }
    }

    function addPrism(pre) {
        if (!currentCodeThemeEnabled) return;
        pre.setAttribute("data-prismjs-copy", "复制");
        pre.setAttribute("data-prismjs-copy-error", "复制失败");
        pre.setAttribute("data-prismjs-copy-success", "复制成功");
        pre.setAttribute("data-prismjs-copy-timeout", 1000);
        pre.classList.add("line-numbers");
        if (pre.dataset) pre.dataset.bnCodeThemeEnhanced = '1';
    }

    function downloadCode(codeElement, langClass, fileName) {
        const codeContent = codeElement;
        const {fileType, fileExt} = getSuffix(langClass);
        if (! fileName) fileName = "code." + fileExt;
        const blob = new Blob([codeContent], {type: fileType});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }

    function getSuffix(langClass) {
        const extMap = {
            'python': 'py',
            'javascript': 'js',
            'c': 'c',
            'cpp': 'cpp',
            'java': 'java',
            'bash': 'sh',
            'typescript': 'ts',
            'py': 'py', // 新增短名称映射
            'js': 'js',
            'html': 'html',
            'css': 'css',
            'txt': 'txt',
            'shell': 'sh',
            'text': 'txt',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'markdown': 'md',
            'md': 'md',
            'sql': 'sql',
            'ruby': 'rb',
            'php': 'php',
            'go': 'go',
            'perl': 'pl',
            'rust': 'rs',
            'kotlin': 'kt',
            'swift': 'swift',
            'dart': 'dart',
            'lua': 'lua',
            'sh': 'sh',
            'powershell': 'ps1',
            'haskell': 'hs',
            'r': 'r',
            'scala': 'scala',
            'vb': 'vb',
            'bat': 'bat',
            'ps1': 'ps1',
        };
        // 修改类名解析逻辑
        const lang = langClass ?
            langClass.replace('language-', '')
                .replace(/^html$/, 'markup')  // 转换html到markup
                .toLowerCase()
            : 'txt';
        const fileExt = extMap[lang] || "txt";  // 优先使用映射表

        // 设置MIME类型映射
        const mimeTypes = {
            js: 'application/javascript',
            py: 'text/x-python',
            html: 'text/html',
            css: 'text/css',
            txt: 'text/plain',
            sh: 'text/x-shellscript',
            ts: 'text/typescript',
            c: 'text/x-c',
            cpp: 'text/x-c++',
            java: 'text/x-java-source'
        };

        const fileType = mimeTypes[fileExt] || 'text/plain';
        return {fileType, fileExt};
    }

    function getLang(suffix){
        const extMap = {
            py: 'python',
            js: 'javascript',
            html: 'html',
            css: 'css',
            txt: 'text',
            sh: 'shell',
            ts: 'typescript',
            c: 'c',
            cpp: 'cpp',
            java: 'java',
            md: "markdown",
        };
        return extMap[suffix] || suffix;
    }

    function WriteCleanHTML(el, dirtyHTML) {
        if (!el) return;
        dirtyHTML = marked.parse(dirtyHTML);
        let cleanHTML = sanitizeMarkdownHTML(dirtyHTML);
        cleanHTML = cleanHTML.replaceAll(
            /(<img.*)src=(.*>)/g,
            "$1data-src=$2"
        )
        cleanHTML = cleanHTML.replaceAll(
            /[a-zA-Z\-] *: *url\((.*)\)/g,
            ""
        )
        cleanHTML = cleanHTML.replaceAll(
            /!\[(.*)](.*)/g,
            `<img alt="$1" data-src="$2">`
        )
        el.innerHTML = cleanHTML;
        // 输出安全 HTML
        el.querySelectorAll("img").forEach(img => {
            if (CanShow(img.dataset.src)) {
                img.src = img.dataset.src;
                img.removeAttribute("data-src");
                return;
            }
            img.classList.add("bn-img-lazy");
            img.removeAttribute("src");
            const showtext = `${img.dataset.src}，\n点击加载`;
            const container = document.createElement("span");
            container.dataset.tooltip = showtext;
            img.parentNode.insertBefore(container, img);
            container.appendChild(img);
        })
        removeFixed(el);
        renderMathInElement(el, {
            delimeters: RENDER_MATH_DELIMITERS,
            throwOnError: false
        });
        for (let elem of el.querySelectorAll("pre"))
            addPrism(elem);
    }

    window.RenderMarkdown = RenderMarkdown;
    window.addPrism = addPrism;
    window.__BN_applyCodeThemePreference = applyCodeThemePreference;
    window.__BN_isCodeThemeEnabled = isCodeThemeEnabled;
    window.__BN_highlightCodeTheme = highlightCodeTheme;
    window.__BN_refreshCodeThemeEnhancements = refreshCodeThemeEnhancements;
    window.__BN_updateFormattedCodeButtonPosition = updateFormattedCodeButtonPosition;
    window.getLang = getLang;
    window.WriteCleanHTML = WriteCleanHTML;
    window.GM_addStyle = GM_addStyle;
    window.GM_setClipboard = GM_setClipboard;
    window.GM_notification = GM_notification;
    window.GM_xmlhttpRequest = GM_xmlhttpRequest;
    installCodeThemeToolbarGate();
    Prism.plugins.toolbar.registerButton('download', {
        text: '下载代码',
        onClick: function (env) {
            downloadCode(env.code, env.language, env.element.parentElement.dataset.download);
        }
    });
    window.GM_getValue = function (key, defVal) {
        return gmLocalGet(key, defVal);
    };
    window.GM_setValue = function (key, val) {
        return gmLocalSet(key, val);
    };
    window.GM = window.GM || {};
    window.GM.addStyle = GM_addStyle;
    window.GM.setClipboard = GM_setClipboard;
    window.GM.xmlHttpRequest = GM_xmlhttpRequest;
    window.GM.getValue = async (k, d) => gmLocalGet(k, d);
    window.GM.setValue = async (k, v) => gmLocalSet(k, v);
})();
