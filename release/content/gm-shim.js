// content/gm-shim.js
(() => {
  const cache = Object.create(null);
  let resolveReady;
  const readyPromise = new Promise(res => (resolveReady = res));
  // 暴露一个“就绪”钩子；如需严格等到存储加载完成，可在 main.js 里等待它（见下文“可选小改动”）
  window.__GM_ready = () => readyPromise;

  try {
    chrome.storage.local.get(null, (all) => {
      Object.assign(cache, all || {});
      resolveReady();
    });
  } catch {
    resolveReady();
  }

  // —— GM_* 映射 ——
  function GM_getValue(key, def) { return (key in cache) ? cache[key] : def; }
  function GM_setValue(key, value) {
    cache[key] = value;
    try { chrome.storage.local.set({ [key]: value }); } catch {}
  }
  function GM_addStyle(cssText) {
    const el = document.createElement("style");
    el.textContent = cssText;
    (document.head || document.documentElement).appendChild(el);
    return el;
  }
  async function GM_setClipboard(text) {
    try { await navigator.clipboard.writeText(String(text)); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = String(text);
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  }
  function GM_notification(arg1, title, image) {
    const opts = (typeof arg1 === "string") ? { text: arg1, title, image } : (arg1 || {});
    chrome.runtime.sendMessage({ type: "gm:notify", ...opts }, () => {});
  }
  function GM_xmlhttpRequest(details) {
    const { url, method = "GET", headers = {}, data, responseType } = details;
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "gm:xhr", url, method, headers, data, responseType }, (res) => {
        if (!res || res.ok !== true) {
          details.onerror && details.onerror(res);
          reject(res?.error || "GM_xmlhttpRequest failed");
          return;
        }
        const response = {
          responseText: (typeof res.body === "string") ? res.body : "",
          response: res.body,
          status: res.status,
          headers: res.headers
        };
        details.onload && details.onload(response);
        resolve(response);
      });
    });
  }

  Object.assign(window, {
    GM_getValue, GM_setValue, GM_addStyle, GM_setClipboard, GM_notification, GM_xmlhttpRequest
  });
})();
