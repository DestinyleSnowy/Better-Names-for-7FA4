// MV3 service worker for notifications and cross-origin requests
self.addEventListener('install', () => {
  // Keep service worker alive for immediate use
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'gm_notify') {
    const { title, message, iconUrl } = msg.payload || {};
    try {
      chrome.notifications.create('', {
        type: 'basic',
        title: title || 'Notification',
        message: message || '',
        iconUrl: iconUrl || 'icon128.png'
      }, () => {});
    } catch (e) {
      // ignore
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'gm_xhr') {
    const { requestId, details } = msg;
    const method = (details.method || 'GET').toUpperCase();
    const headers = details.headers || {};
    const body = details.data;
    const url = details.url;

    fetch(url, {
      method,
      headers,
      body,
      // Use credentials if not anonymous; requires the origin to be allowed
      credentials: details.anonymous ? 'omit' : 'include',
      // mode: 'cors' // default
    })
      .then(async (r) => {
        const text = await r.text();
        const headersRaw = Array.from(r.headers.entries()).map(([k, v]) => k + ': ' + v).join('\\r\\n');
        sendResponse({ ok: true, status: r.status, statusText: r.statusText, text, headersRaw });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // async
  }
});
