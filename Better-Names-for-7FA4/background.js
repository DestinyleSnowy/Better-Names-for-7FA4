// MV3 service worker for notifications and cross-origin requests
self.addEventListener('install', () => {
  // Keep service worker alive for immediate use
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

const SUBMITTER_POPUP = 'submitter/popup.html';

function applySubmitterState(enabled) {
  try {
    if (!chrome || !chrome.action) return;
    const popup = enabled ? SUBMITTER_POPUP : '';
    if (chrome.action.setPopup) {
      chrome.action.setPopup({ popup }, () => {
        // Touch lastError to suppress uncontrolled logs
        void chrome.runtime && chrome.runtime.lastError;
      });
    }
    if (enabled) {
      if (chrome.action.enable) chrome.action.enable();
    } else if (chrome.action.disable) {
      chrome.action.disable();
    }
  } catch (e) {
    // ignore
  }
}

function ensureSubmitterStateFromStorage() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      applySubmitterState(true);
      return;
    }
    chrome.storage.local.get({ enableSubmitter: true }, (items) => {
      try {
        const raw = items && Object.prototype.hasOwnProperty.call(items, 'enableSubmitter')
          ? items.enableSubmitter
          : true;
        const enabled = raw !== false;
        applySubmitterState(enabled);
      } catch (e) {
        applySubmitterState(true);
      }
    });
  } catch (e) {
    applySubmitterState(true);
  }
}

ensureSubmitterStateFromStorage();

if (chrome && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => ensureSubmitterStateFromStorage());
}
if (chrome && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => ensureSubmitterStateFromStorage());
}
if (chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (Object.prototype.hasOwnProperty.call(changes, 'enableSubmitter')) {
      const change = changes.enableSubmitter;
      const enabled = change && Object.prototype.hasOwnProperty.call(change, 'newValue')
        ? change.newValue !== false
        : true;
      applySubmitterState(enabled);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'bn_toggle_submitter') {
    const enabled = msg.enabled !== false;
    applySubmitterState(enabled);
    sendResponse({ ok: true });
    return true;
  }

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
