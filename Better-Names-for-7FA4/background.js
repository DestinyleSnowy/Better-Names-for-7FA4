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


// background.js — show-all injection (完整)
// Paste this into your extension's background.js (service worker).

// 判断是否为榜单页面 URL（/progress/* 等）
function isRankingUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const p = (u.pathname || '').toLowerCase();
    if (!p.startsWith('/progress/')) return false;
    if (p.startsWith('/progress/quiz')) return true;
    if (p.startsWith('/progress/contest_table')) return true;
    if (p.startsWith('/progress/contest')) return true;
    if (u.search && u.search.toLowerCase().includes('tables=')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// 注入到页面主世界的函数（会被 chrome.scripting.executeScript 注入）
function patchJQueryGet() {
  try {
    if (window.__fa4_patch_installed) return;
    window.__fa4_patch_installed = true;
    console.log('show-all: patchJQueryGet running in page context');

    const nativeFetch = (typeof window.fetch === 'function') ? window.fetch.bind(window) : null;
    function parseUrl(u){ try { return new URL(u, location.href); } catch(e) { return null; } }
    function extractItems(json){
      if(!json) return null;
      if(Array.isArray(json)) return json;
      if(Array.isArray(json.users)) return json.users;
      if(Array.isArray(json.items)) return json.items;
      if(Array.isArray(json.data)) return json.data;
      if(Array.isArray(json.rows)) return json.rows;
      if(Array.isArray(json.list)) return json.list;
      for(const k in json) if(Array.isArray(json[k])) return json[k];
      return null;
    }

  async function ensureRowsForUsers(originalUrlStr, users){
    try {
      const u = parseUrl(originalUrlStr);
      if(!u) return;
      const tid = u.searchParams.get('tid') || '';
      const table_id = u.searchParams.get('table_id') || '0';
      const type = u.searchParams.get('type') || 'contest';

      const tableContainer = document.getElementById('table-' + table_id) || document.querySelector(`#table-${table_id}`);

      // 解析页头，得到 headerCells（严格的列顺序）
      function getHeaderCells(){
        let headerRow = null;
        if(tableContainer){
          headerRow = tableContainer.querySelector('#title-' + table_id) || tableContainer.querySelector('thead tr');
        } else {
          headerRow = document.querySelector(`#title-${table_id}`) || document.querySelector('thead tr');
        }
        return headerRow ? Array.from(headerRow.children) : [];
      }

      // 根据 headerCells 构造列映射（找出 school/grade 列索引）
      function buildHeaderMapping(cells){
        const mapping = []; // { kind: 'rank'|'name'|'school'|'grade'|'sum'|'problem'|'generic', pid?, part? }
        let sumSeen = 0;
        for(const el of cells){
          const id = el && el.id ? el.id : '';
          const text = el && el.textContent ? el.textContent.trim() : '';
          // problem header by id
          const pm = id.match(new RegExp('^problem-' + table_id + '-(\\d+)-([cr])$'));
          if(pm){
            mapping.push({ kind:'problem', pid: pm[1], cr: pm[2] });
            continue;
          }
          if(/排序|排名/.test(text) || /rank/i.test(id)){ mapping.push({kind:'rank'}); continue; }
          if(/昵称|名字|用户名/.test(text) || /nickname/i.test(id)){ mapping.push({kind:'name'}); continue; }
          if(/学校/.test(text)){ mapping.push({kind:'school'}); continue; }
          if(/年|时年|年级/.test(text)){ mapping.push({kind:'grade'}); continue; }
          if(/总分/.test(text) || id.indexOf('sum') !== -1){
            sumSeen++; mapping.push({kind:'sum', part: sumSeen===1 ? 'c' : 'r'}); continue;
          }
          mapping.push({kind:'generic'});
        }
        return mapping;
      }

      const headerCells = getHeaderCells();
      const mapping = (headerCells.length>0) ? buildHeaderMapping(headerCells) : null;

      // helper: find displayed rows and compute which uids lack school or grade
      const displayedRows = Array.from(document.querySelectorAll(`[id^="line-${table_id}-"]`));
      const displayedMap = new Map(); // uid -> tr
      for(const tr of displayedRows){
        const parts = tr.id.split('-');
        const uid = parts.length >= 3 ? parts[2] : null;
        if(uid) displayedMap.set(String(uid), tr);
      }

      // find index numbers for school and grade using mapping
      let idxSchool = -1, idxGrade = -1;
      if(mapping){
        for(let i=0;i<mapping.length;i++){
          if(mapping[i].kind === 'school') idxSchool = i;
          if(mapping[i].kind === 'grade') idxGrade = i;
        }
      } else {
        // fallback guesses: school at 2, grade at 3 (0-based)
        idxSchool = 2; idxGrade = 3;
      }

      // Build missing set: UIDs for which displayed row exists but school or grade empty, OR UID not displayed at all
      const missingSet = new Set();
      for(const user of users){
        const uid = String(user.id);
        const tr = displayedMap.get(uid);
        if(!tr){
          missingSet.add(uid);
        } else {
          // check school and grade text
          const tds = tr.querySelectorAll('td');
          const schoolText = (tds[idxSchool] ? tds[idxSchool].textContent.trim() : '');
          const gradeText  = (tds[idxGrade]  ? tds[idxGrade].textContent.trim()  : '');
          if(!schoolText || !gradeText) missingSet.add(uid);
        }
      }

      if(missingSet.size === 0){
        console.log('show-all: no missing school/grade rows; nothing to fetch for table_id=', table_id);
        return;
      }

      console.log('show-all: ensureRowsForUsers: need to fetch/replace rows for', missingSet.size, 'users for table_id=', table_id);

      // Ensure pool exists
      let pool = document.getElementById('__fa4_row_pool');
      if(!pool){ pool = document.createElement('div'); pool.id='__fa4_row_pool'; pool.style.display='none'; document.body.appendChild(pool); }

      // Try to fetch table html pages to find real rows for missing UIDs
      if(window.jQuery && typeof window.jQuery.get === 'function'){
        const paramsObj = {};
        for(const [k,v] of (new URL(originalUrlStr, location.href)).searchParams.entries()){
          paramsObj[k] = v;
        }
        const MAX_HTML_PAGES = 50;
        const startPage = paramsObj.page ? Number(paramsObj.page) : 1;

        for(let p = startPage; p < startPage + MAX_HTML_PAGES && missingSet.size > 0; p++){
          try {
            const q = Object.assign({}, paramsObj); q.page = p;
            console.log('show-all: fetching table html page', p, 'for table_id=', table_id);
            const html = await new Promise((resolve, reject) => {
              try { window.jQuery.get(`/progress/${type}_table/html`, q, res => resolve(res)); }
              catch(e){ reject(e); }
            });
            const tmp = document.createElement('div'); tmp.innerHTML = html;

            // find tr's with id like line-<table_id>-<uid>
            const trs = tmp.querySelectorAll(`[id^="line-${table_id}-"]`);
            if(!trs || trs.length === 0){
              // if this page has no rows, we are probably past last page
              console.log('show-all: html page', p, 'contains no line rows — stopping html fetch');
              break;
            }

            for(const tr of trs){
              const id = tr.id;
              const parts = id.split('-');
              const uid = parts.length >= 3 ? parts[2] : null;
              if(uid && missingSet.has(String(uid))){
                // replace existing tr in DOM if present, otherwise append to pool
                const existing = document.getElementById(`line-${table_id}-${uid}`);
                const clone = tr.cloneNode(true);
                if(existing && existing.parentNode){
                  existing.parentNode.replaceChild(clone, existing);
                  console.log(`show-all: replaced minimal row with real HTML for uid=${uid}`);
                } else {
                  pool.appendChild(clone);
                  console.log(`show-all: appended real HTML row to pool for uid=${uid}`);
                }
                missingSet.delete(String(uid));
              }
            }
            // polite small delay
            await new Promise(r => setTimeout(r, 60));
          } catch(e){
            console.warn('show-all: error while fetching/parsing table html page', p, e);
            break;
          }
        }
      } // end if can fetch html

      // For any uids still missing, try to fill school/grade from JSON into existing rows (if row exists)
      if(missingSet.size > 0){
        console.log('show-all: filling remaining', missingSet.size, 'users from JSON fields if available');
        // build quick map from users-by-id
        const userMap = new Map();
        for(const uobj of users) userMap.set(String(uobj.id), uobj);

        for(const uid of Array.from(missingSet)){
          const tr = document.getElementById(`line-${table_id}-${uid}`);
          const userObj = userMap.get(uid);
          if(tr && userObj){
            const tds = tr.querySelectorAll('td');
            if(idxSchool >= 0 && tds[idxSchool]){
              const schoolText = userObj.school || userObj.school_name || userObj.school_oifc || '';
              if(schoolText) tds[idxSchool].textContent = schoolText;
            }
            if(idxGrade >= 0 && tds[idxGrade]){
              const gradeText = userObj.grade || userObj.year || '';
              if(gradeText){
                tds[idxGrade].textContent = gradeText;
                // optionally set grade class
                tds[idxGrade].className = gradeText ? `grade ${gradeText}` : tds[idxGrade].className;
              }
            }
            // done => remove from missingSet (we filled from JSON)
            missingSet.delete(uid);
            console.log(`show-all: filled JSON school/grade for uid=${uid}`);
          }
        }
      }

      // Final log
      if(missingSet.size > 0){
        console.warn('show-all: after attempts still missing', missingSet.size, 'rows (no HTML found & no JSON fields) for table_id=', table_id);
      } else {
        console.log('show-all: ensureRowsForUsers completed; all missing school/grade handled for table_id=', table_id);
      }

    } catch(e){
      console.error('show-all: ensureRowsForUsers unexpected error', e);
    }
  }


    // ---- gatherAllPages (unchanged) ----
    async function gatherAllPages(originalUrlStr, opts = { delayMs: 120, pageLimit: 500 }) {
      if(!nativeFetch) throw new Error('native fetch not available in page context');
      const orig = parseUrl(originalUrlStr);
      if(!orig) throw new Error('invalid url ' + originalUrlStr);

      const paramsBase = {};
      for(const [k,v] of orig.searchParams.entries()) paramsBase[k]=v;
      paramsBase.page = paramsBase.page || '1';

      const makeUrl = (p) => {
        const u = new URL(orig.pathname, orig.origin);
        u.protocol = orig.protocol;
        u.host = orig.host;
        const sp = new URLSearchParams();
        for(const k in paramsBase) sp.set(k, paramsBase[k]);
        sp.set('page', String(p));
        u.search = sp.toString();
        return u.toString();
      };

      const fetchJson = async (u) => {
        console.log('show-all: native fetch ->', u);
        const res = await nativeFetch(u, {
          credentials: 'include',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
          }
        });
        if(!res.ok) throw new Error('HTTP ' + res.status + ' for ' + u);
        return await res.json();
      };

      console.log('show-all: fetching page 1');
      const first = await fetchJson(makeUrl(1));
      if(first && first.success === false){
        console.warn('show-all: first page returned success=false, aborting gather');
        return first;
      }
      let users = extractItems(first) || [];
      const isTopArray = Array.isArray(first);
      const mergedUsers = users.slice();
      const mergedTable = (first && first.table && typeof first.table === 'object') ? Object.assign({}, first.table) : {};
      const totalHint = first && (first.total || first.total_count || first.count);
      let page = 2;
      while(true){
        if(page > opts.pageLimit) { console.warn('show-all: page limit reached', page); break; }
        if(totalHint && mergedUsers.length >= totalHint) { console.log('show-all: reached totalHint', totalHint); break; }

        const urlPage = makeUrl(page);
        try {
          console.log('show-all: fetching page', page);
          const j = await fetchJson(urlPage);
          if(j && j.success === false){ console.warn('show-all: page', page, 'returned success=false — stop'); break; }
          const a = extractItems(j) || [];
          if(!a || a.length === 0){ console.log('show-all: page', page, 'empty — stop'); break; }
          mergedUsers.push(...a);
          if(j && j.table && typeof j.table === 'object'){
            for(const k in j.table) mergedTable[k] = j.table[k];
          }
        } catch(e){
          console.error('show-all: error fetching page', page, e);
          break;
        }
        page++;
        if(opts.delayMs) await new Promise(r=>setTimeout(r, opts.delayMs));
      }

      if(isTopArray) return mergedUsers;
      const out = JSON.parse(JSON.stringify(first || {}));
      if(Array.isArray(out.users)) out.users = mergedUsers;
      else {
        let placed = false;
        for(const k in out){
          if(Array.isArray(out[k])){ out[k] = mergedUsers; placed = true; break; }
        }
        if(!placed) out.users = mergedUsers;
      }
      if(out.table || Object.keys(mergedTable).length>0) out.table = mergedTable;
      const newTotal = mergedUsers.length;
      if('total' in out) out.total = newTotal;
      else if('total_count' in out) out.total_count = newTotal;
      else if('count' in out) out.count = newTotal;
      else out.total = newTotal;
      console.log('show-all: gatherAllPages done. total merged users =', mergedUsers.length);

      try { await ensureRowsForUsers(originalUrlStr, mergedUsers); } catch(e){ console.warn('show-all: ensure rows error', e); }
      return out;
    }

    // waitForjQuery & patch $.get (unchanged)
    function waitForjQuery(timeout = 6000) {
      return new Promise((resolve, reject) => {
        if(window.jQuery) return resolve(window.jQuery);
        let t = 0;
        const iv = setInterval(() => {
          if(window.jQuery){ clearInterval(iv); return resolve(window.jQuery); }
          t += 100;
          if(t >= timeout){ clearInterval(iv); return reject(new Error('jQuery not found')); }
        }, 100);
      });
    }

    (async ()=>{
      try {
        const $ = await waitForjQuery(6000).catch(e => { console.warn('show-all: jQuery not found in time'); return null; });
        if(!$ || typeof $.get !== 'function'){ console.warn('show-all: cannot patch $.get'); return; }

        const origGet = $.get.bind($);
        $.get = function(url /*, success, dataType */){
          let urlStr = (typeof url === 'string') ? url : (url && url.url ? url.url : '');
          if(typeof urlStr === 'string' && urlStr.indexOf('/progress/contest_table/json') !== -1){
            let success = null;
            if(arguments.length >= 2 && typeof arguments[1] === 'function') success = arguments[1];
            else if(arguments.length >= 3 && typeof arguments[2] === 'function') success = arguments[2];

            const d = $.Deferred();
            (async () => {
              try {
                const merged = await gatherAllPages(urlStr, { delayMs: 100 });
                if(merged && merged.success === false){
                  if(typeof success === 'function'){ try { success(merged); } catch(e){ console.error('show-all: success cb threw', e); } }
                  d.resolve(merged);
                  return;
                }
                if(typeof success === 'function'){ try { success(merged); } catch(e){ console.error('show-all: success cb threw', e); } }
                d.resolve(merged);
              } catch(err){
                console.error('show-all: gatherAllPages error', err);
                try {
                  const orig = origGet.apply($, arguments);
                  orig.done && orig.done(r=>d.resolve(r));
                  orig.fail && orig.fail(e=>d.reject(e));
                } catch(e2){
                  d.reject(err);
                }
              }
            })();
            return d.promise();
          }
          return origGet.apply($, arguments);
        };

        console.log('show-all: $.get patched for contest_table/json (page context)');
      } catch(e){
        console.error('show-all: patchJQueryGet error', e);
      }
    })();

  } catch(e){
    console.error('show-all: patchJQueryGet top-level error', e);
  }
}


// 在标签更新完成且为榜单页时注入
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo && changeInfo.status === 'complete' && tab && tab.url && isRankingUrl(tab.url)) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: patchJQueryGet,
        world: 'MAIN'
      }).then(() => {
        console.log('show-all: patchJQueryGet injected to', tab.url);
      }).catch((err) => {
        console.error('show-all: failed to inject patchJQueryGet', err);
      });
    }
  } catch(e){
    console.error('show-all tab onUpdated handler error', e);
  }
});
