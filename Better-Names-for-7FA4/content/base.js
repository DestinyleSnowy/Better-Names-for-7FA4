(function () {
    'use strict';
    marked.use({breaks: true});
    Prism.manual = true;

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

    function RenderMarkdown(el, md) {
        el.innerHTML = marked.parse(md);
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
        pre.setAttribute("data-prismjs-copy", "复制");
        pre.setAttribute("data-prismjs-copy-error", "复制失败");
        pre.setAttribute("data-prismjs-copy-success", "复制成功");
        pre.setAttribute("data-prismjs-copy-timeout", 1000);
        pre.classList.add("line-numbers");
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
        let cleanHTML = DOMPurify.sanitize(
            dirtyHTML, {
                FORBID_TAGS: ["style", "link", "iframe", "script", 'frame'],
                FORBID_ATTR: ["id"],
                ALLOWED_URI_REGEXP: /^.*/
            }
        );
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
    window.getLang = getLang;
    window.WriteCleanHTML = WriteCleanHTML;
    window.GM_addStyle = GM_addStyle;
    window.GM_setClipboard = GM_setClipboard;
    window.GM_notification = GM_notification;
    window.GM_xmlhttpRequest = GM_xmlhttpRequest;
    Prism.plugins.lineNumbers = true;
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
