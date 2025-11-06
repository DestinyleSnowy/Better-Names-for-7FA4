// update.js
// 默认远端 VERSION 文件地址（修改为你的仓库地址或替换为变量）
const REMOTE_VERSION_URL = 'http://jx.7fa4.cn:9080/tools/submitter/-/raw/main/VERSION';
const LOCAL_VERSION_PATH = 'VERSION'; // extension 根目录下的文件

// 小工具：优先使用 chrome.storage.local，否则退回 localStorage
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
  try {
    const url = chrome && chrome.runtime ? chrome.runtime.getURL(LOCAL_VERSION_PATH) : LOCAL_VERSION_PATH;
    console.log(url);
    return await fetchText(url);
  } catch (e) {
    console.warn('update.js: getLocalVersion failed', e);
    return null;
  }
}

function makeNotice(remoteVer, localVer, remoteBase) {
  // 如果 popup 有样式冲突，这里用内联样式尽量避免影响
  const container = document.createElement('div');
  container.id = 'update-notice';
  container.style.cssText = `
    font-family: Arial, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei";
    border: 1px solid #727272; padding:2px 15px; border-radius:8px;
    background:linear-gradient(180deg,#fff,#fffefc); box-shadow:0 2px 8px rgba(0,0,0,0.08);
    margin:8px; color:#111;
  `;

  const title = document.createElement('div');
  title.textContent = '检测到可用更新';
  title.style.cssText = 'font-weight:600; margin-bottom:8px;';
  container.appendChild(title);

  const info = document.createElement('div');
  info.innerHTML = `
    <div style="font-size:12px; ">远端版本：<b>${remoteVer ?? '未知'}</b></div>
    <div style="font-size:12px; ">本地版本：<b>${localVer ?? '未知'}</b></div>
  `;
  container.appendChild(info);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:8px;';

  // const viewBtn = document.createElement('button');
  // viewBtn.textContent = '查看更新';
  // viewBtn.style.cssText = 'padding:6px 10px; border-radius:6px; cursor:pointer;';
  // viewBtn.onclick = () => {
  //   // 打开远端目录（去掉 /VERSION）
  //   window.open(remoteBase, '_blank');
  // };
  // btnRow.appendChild(viewBtn);

  // const ignoreBtn = document.createElement('button');
  // ignoreBtn.textContent = '忽略此版本';
  // ignoreBtn.style.cssText = 'padding:6px 10px; border-radius:6px; cursor:pointer;';
  // ignoreBtn.onclick = async () => {
  //   await storage.set('update_ignore', remoteVer);
  //   container.remove();
  // };
  // btnRow.appendChild(ignoreBtn);

  // const closeBtn = document.createElement('button');
  // closeBtn.textContent = '关闭';
  // closeBtn.style.cssText = 'padding:6px 10px; border-radius:6px; cursor:pointer;';
  // closeBtn.onclick = () => container.remove();
  // btnRow.appendChild(closeBtn);

  // container.appendChild(btnRow);
  return container;
}

async function checkForUpdate({ remoteUrl = REMOTE_VERSION_URL, showOnSame = false } = {}) {
  // 远端 base（用于打开目录）
  const remoteBase = remoteUrl.replace(/\/VERSION\s*$/i, '') || remoteUrl;

  const [localVer, remoteVer] = await Promise.all([
    getLocalVersion(),
    fetchText(remoteUrl)
  ]);

  if (localVer == null && remoteVer == null) {
    // 两边都读不出来，静默返回
    return;
  }

  // 若都能读，比较
  const lv = (localVer ?? '').trim();
  const rv = (remoteVer ?? '').trim();

  // 如果相同且不需要在相同时提示，则不显示
  if (lv === rv && !showOnSame) return;

  // 检查忽略设置
  const ignored = await storage.get('update_ignore');
  if (ignored && String(ignored).trim() === rv && rv !== '') {
    // 用户已忽略此版本
    return;
  }

  // 在 popup DOM 中插入提示（在 body 开头）
  const existing = document.getElementById('update-notice');
  if (existing) existing.remove();
  const notice = makeNotice(rv, lv, remoteBase);

  // 插入到页面：优先放入 id="root" 或 body 开头
  const anchor = document.getElementById('root') || document.body || document.documentElement;
  // if (anchor) {
  //   anchor.insertBefore(notice, anchor.firstChild);
  // } else {
    document.body.appendChild(notice);
  // }
}

// 自动在 DOMContentLoaded 时检查更新（popup 页面打开时运行一次）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => checkForUpdate().catch(e => console.warn(e)));
} else {
  // already loaded
  checkForUpdate().catch(e => console.warn(e));
}

// 导出以便 popup 的其它脚本可手动触发（可选）
window.updateChecker = {
  check: checkForUpdate,
  setRemoteUrl(u) { return checkForUpdate({ remoteUrl: u }); }
};