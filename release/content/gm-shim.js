// Lightweight GM_* shim for MV3 content scripts.
// Storage: use localStorage (sync) for immediate availability; mirror to chrome.storage asynchronously.
(function() {
  'use strict';

  const hasChromeStorage = !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
  // Best-effort mirror
  function mirrorToChromeStorage(key, value) {
    try {
      if (!hasChromeStorage) return;
      const obj = {};
      obj[key] = value;
      chrome.storage.local.set(obj);
    } catch (e) {}
  }
  function readFromChromeStorage(keys, cb) {
    if (!hasChromeStorage) { cb({}); return; }
    try {
      chrome.storage.local.get(keys, cb);
    } catch (e) { cb({}); }
  }

  function gmLocalGet(key, defVal) {
    try {
      const k = "__gm__" + key;
      const v = localStorage.getItem(k);
      if (v === null || v === undefined) return defVal;
      try { return JSON.parse(v); } catch { return v; }
    } catch (e) {
      return defVal;
    }
  }
  function gmLocalSet(key, value) {
    try {
      const k = "__gm__" + key;
      const v = (typeof value === 'string') ? value : JSON.stringify(value);
      localStorage.setItem(k, v);
      mirrorToChromeStorage(key, value);
    } catch (e) {}
  }

  // Initial backfill from chrome.storage -> localStorage (non-blocking)
  readFromChromeStorage(null, (all) => {
    if (!all) return;
    try {
      Object.keys(all).forEach(k => {
        const lk = "__gm__" + k;
        if (localStorage.getItem(lk) === null) {
          const v = all[k];
          localStorage.setItem(lk, (typeof v === 'string') ? v : JSON.stringify(v));
        }
      });
    } catch (e) {}
  });

  // GM_addStyle
  function GM_addStyle(css) {
    try {
      const s = document.createElement('style');
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
      return s;
    } catch (e) { return null; }
  }

  // GM_setClipboard
  async function GM_setClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(text));
        return;
      }
    } catch (e) {}
    // fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = String(text);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch (e) {}
  }

  // GM_notification
  function GM_notification(details) {
    try {
      // Accept both string and object
      if (typeof details === 'string') details = { text: details };
      const payload = {
        title: details.title || 'Notification',
        message: details.text || details.message || '',
        iconUrl: details.image || details.icon || undefined
      };
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'gm_notify', payload });
      } else if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(payload.title, { body: payload.message, icon: payload.iconUrl });
        } else {
          Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(payload.title, { body: payload.message, icon: payload.iconUrl });
          });
        }
      } else {
        alert(payload.title + "\n\n" + payload.message);
      }
    } catch (e) {}
  }

  // GM_xmlhttpRequest via background service worker for cross-origin
  function GM_xmlhttpRequest(details) {
    const requestId = Math.random().toString(36).slice(2);
    if (!(chrome && chrome.runtime && chrome.runtime.sendMessage)) {
      // Fallback to fetch in-page (CORS-bound)
      const url = details.url;
      const method = (details.method || 'GET').toUpperCase();
      const headers = details.headers || {};
      const body = details.data;
      fetch(url, { method, headers, body, credentials: (details.anonymous ? 'omit' : 'include') })
        .then(async resp => {
          const text = await resp.text();
          details.onload && details.onload({ responseText: text, status: resp.status, statusText: resp.statusText, responseHeaders: Array.from(resp.headers.entries()).map(([k,v])=>k+': '+v).join('\r\n') });
        })
        .catch(err => {
          details.onerror && details.onerror({ error: String(err) });
        });
      return;
    }
    chrome.runtime.sendMessage({ type: 'gm_xhr', requestId, details }, (resp) => {
      if (!resp) return;
      if (resp.ok) {
        details.onload && details.onload({
          responseText: resp.text,
          status: resp.status,
          statusText: resp.statusText,
          responseHeaders: resp.headersRaw
        });
      } else {
        details.onerror && details.onerror({ error: resp.error || 'GM_xmlhttpRequest failed' });
      }
    });
  }

  // Expose legacy API names
  window.GM_addStyle = GM_addStyle;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_notification = GM_notification;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_getValue = function(key, defVal) { return gmLocalGet(key, defVal); };
  window.GM_setValue = function(key, val) { return gmLocalSet(key, val); };

  // Also expose GM namespace style (subset)
  window.GM = window.GM || {};
  window.GM.addStyle = GM_addStyle;
  window.GM.setClipboard = GM_setClipboard;
  window.GM.xmlHttpRequest = GM_xmlhttpRequest;
  window.GM.getValue = async (k, d) => gmLocalGet(k, d);
  window.GM.setValue = async (k, v) => gmLocalSet(k, v);
})();
