// update.js
const REMOTE_VERSION_URL = 'http://jx.7fa4.cn:9080/tools/submitter/-/raw/main/VERSION';
const LOCAL_VERSION_PATHS = [
  'VERSION',
  'submitter/submitter/VERSION'
];

const storage = {
  async get(key) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise((res) => chrome.storage.local.get([key], (obj) => res(obj[key])));
    } else {
      return Promise.resolve(window.localStorage.getItem(key));
    }
  },
  async set(key, value) {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      return new Promise((res) => chrome.storage.local.set({ [key]: value }, () => res()));
    } else {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    }
  }
};

async function fetchText(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`fetch ${url} failed ${r.status}`);
    const t = await r.text();
    return (t ?? '').trim();
  } catch (e) {
    console.warn('update.js: fetch failed', e);
    return null;
  }
}

async function getLocalVersion() {
  const paths = Array.isArray(LOCAL_VERSION_PATHS) && LOCAL_VERSION_PATHS.length
    ? LOCAL_VERSION_PATHS
    : [LOCAL_VERSION_PATHS];

  for (const path of paths) {
    if (!path) continue;
    try {
      const url = chrome && chrome.runtime ? chrome.runtime.getURL(path) : path;
      const version = await fetchText(url);
      if (version) return version;
    } catch (e) {
      console.warn('update.js: getLocalVersion failed for', path, e);
    }
  }
  return null;
}

function makeNotice(remoteVer, localVer, remoteBase) {
  // const container = document.createElement('div');
  // container.id = 'update-notice';

  // const title = document.createElement('div');
  // title.textContent = '检测到可用更新';
  // container.appendChild(title);

  // const info = document.createElement('div');
  // info.className = 'version-info';
  // info.innerHTML = `
  //   <div>远端版本：<b>${remoteVer ?? '未知'}</b></div>
  //   <div>本地版本：<b>${localVer ?? '未知'}</b></div>
  // `;
  // container.appendChild(info);
  document.getElementById('verLocal').innerText = localVer;
  document.getElementById('verRemote').innerText = remoteVer;
  if(localVer != remoteVer) {
    document.getElementById('versionLocal').style = "color: red;";
  }

  // return container;
}

async function checkForUpdate({ remoteUrl = REMOTE_VERSION_URL, showOnSame = false } = {}) {
  const remoteBase = remoteUrl.replace(/\/VERSION\s*$/i, '') || remoteUrl;

  const [localVer, remoteVer] = await Promise.all([
    getLocalVersion(),
    fetchText(remoteUrl)
  ]);

  if (localVer == null && remoteVer == null) return;

  const lv = (localVer ?? '').trim();
  const rv = (remoteVer ?? '').trim();

  // if (lv === rv && !showOnSame) return;

  // const ignored = await storage.get('update_ignore');
  // if (ignored && String(ignored).trim() === rv && rv !== '') return;

  // const existing = document.getElementById('update-notice');
  // if (existing) existing.remove();
  makeNotice(rv, lv, remoteBase);

  // document.body.appendChild(notice);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => checkForUpdate().catch(e => console.warn(e)));
} else {
  checkForUpdate().catch(e => console.warn(e));
}

window.updateChecker = {
  check: checkForUpdate,
  setRemoteUrl(u) { return checkForUpdate({ remoteUrl: u }); }
};
