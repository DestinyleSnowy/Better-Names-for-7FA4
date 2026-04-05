(function () {
    'use strict';

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
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
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

    function sanitizeRichHtml(unsafeHtml) {
        if (typeof DOMPurify === 'undefined' || typeof DOMPurify.sanitize !== 'function') {
            const fallback = document.createElement('div');
            fallback.textContent = String(unsafeHtml ?? '');
            return fallback.innerHTML;
        }
        return DOMPurify.sanitize(String(unsafeHtml ?? ''), {
            FORBID_TAGS: ['style', 'link', 'aframe', 'script', 'frame', 'iframe', 'object', 'embed', 'form'],
            FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload', 'srcdoc']
        });
    }

    function postProcessRenderedImages(root) {
        if (!root) return;
        root.querySelectorAll('img').forEach((img) => {
            const source = (img.getAttribute('src') || img.dataset.src || '').trim();
            if (!source) {
                img.remove();
                return;
            }
            if (CanShow(source)) {
                img.setAttribute('src', source);
                img.removeAttribute('data-src');
                img.classList.remove('bn-img-lazy');
                return;
            }
            img.dataset.src = source;
            img.removeAttribute('src');
            img.classList.add('bn-img-lazy');
            img.src = '/';
            const showtext = `${source}，\n点击加载`;
            const container = document.createElement('span');
            container.dataset.tooltip = showtext;
            img.parentNode.insertBefore(container, img);
            container.appendChild(img);
        });
    }

    function RenderMarkdown(el, md) {
        if (!el) return;
        const rawText = typeof md === 'string' ? md : String(md ?? '');
        let renderedHtml = rawText;
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            renderedHtml = marked.parse(rawText);
        }
        el.innerHTML = sanitizeRichHtml(renderedHtml);
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(el, {
                delimiters: RENDER_MATH_DELIMITERS,
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'option', 'code'],
                throwOnError: false,
                strict: 'ignore'
            });
        }
        postProcessRenderedImages(el);
    }

    function removeFixed(el) {
        const elements = el.querySelectorAll('*');
        for (let elem of elements) {
            elem.style.position = 'relative';
        }
    }

    function WriteCleanHTML(el, dirtyHTML) {
        if (!el) return;
<<<<<<< HEAD
        RenderMarkdown(el, sanitizeRichHtml(dirtyHTML));
=======
        let cleanHTML = DOMPurify.sanitize(
            dirtyHTML, {
                FORBID_TAGS: ["style", "link", "aframe", "script", 'frame'],
                FORBID_ATTR: ["style", "onclick", "id"]
            }
        );
        cleanHTML = cleanHTML.replaceAll(
            /(<img.*)src=(.*>)/g,
            "$1data-src=$2"
        )
        cleanHTML = cleanHTML.replaceAll(
            /![(.*)](.*)/g,
            `<img alt="$1" data-src="$2">`
        )
        RenderMarkdown(el, cleanHTML);
        // 输出安全 HTML
        el.querySelectorAll("img").forEach(img => {
            if (CanShow(img.dataset.src)) {
                img.src = img.dataset.src;
                img.removeAttribute("data-src");
                return;
            }
            img.classList.add("bn-img-lazy");
            img.src = "/";
            const showtext = `${img.dataset.src}，\n点击加载`;
            const container = document.createElement("span");
            container.dataset.tooltip = showtext;
            img.parentNode.insertBefore(container, img);
            container.appendChild(img);
        })
        removeFixed(el);
>>>>>>> a812624192473cfc0ec7b939755c7bc3647f086b
    }

    window.RenderMarkdown = RenderMarkdown;
    window.CanShow = CanShow;
    window.WriteCleanHTML = WriteCleanHTML;
    window.GM_addStyle = GM_addStyle;
    window.GM_setClipboard = GM_setClipboard;
    window.GM_notification = GM_notification;
    window.GM_xmlhttpRequest = GM_xmlhttpRequest;
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
