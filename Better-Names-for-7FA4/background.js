// MV3 service worker for notifications and cross-origin requests
self.addEventListener('install', () => {
  // Keep service worker alive for immediate use
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

const DEFAULT_SUBMITTER_ID = 'origin';
const DEFAULT_SUBMITTER_POPUP = 'submitter/submitter/popup.html';
const AVATAR_BLOCK_RULE_ID = 1001;
const AVATAR_BLOCK_URL_FILTER = '||gravatar.loli.net^';
const AVATAR_BLOCK_RESOURCE_TYPES = [
  'image',
  'xmlhttprequest',
  'media',
  'font',
  'stylesheet',
  'script',
  'sub_frame',
  'other',
  'ping'
];

const RANKING_MERGE_STORAGE_KEY = 'rankingMerge.enabled';
let rankingMergeEnabled = true;

function refreshRankingMergePreference() {
  try {
    if (!chrome?.storage?.local) {
      rankingMergeEnabled = true;
      return;
    }
    chrome.storage.local.get([RANKING_MERGE_STORAGE_KEY], (items) => {
      try {
        const hasValue = items && Object.prototype.hasOwnProperty.call(items, RANKING_MERGE_STORAGE_KEY);
        rankingMergeEnabled = hasValue ? Boolean(items[RANKING_MERGE_STORAGE_KEY]) : true;
      } catch (error) {
        console.warn('[BN] Failed to read ranking merge preference', error);
        rankingMergeEnabled = true;
      }
    });
  } catch (error) {
    console.warn('[BN] Failed to refresh ranking merge preference', error);
    rankingMergeEnabled = true;
  }
}

async function updateAvatarBlockingRule(enabled) {
  try {
    if (!chrome?.declarativeNetRequest?.updateDynamicRules) return;
    const addRules = enabled ? [{
      id: AVATAR_BLOCK_RULE_ID,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: AVATAR_BLOCK_URL_FILTER,
        resourceTypes: AVATAR_BLOCK_RESOURCE_TYPES
      }
    }] : [];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [AVATAR_BLOCK_RULE_ID],
      addRules
    });
  } catch (error) {
    console.warn('[BN] Failed to update avatar blocking rule', error);
  }
}

function syncAvatarBlockingRuleFromStorage() {
  try {
    if (!chrome?.storage?.local) {
      void updateAvatarBlockingRule(true);
      return;
    }
    chrome.storage.local.get(['hideAvatar'], (items) => {
      try {
        const hasValue = items && Object.prototype.hasOwnProperty.call(items, 'hideAvatar');
        const enabled = hasValue ? Boolean(items.hideAvatar) : true;
        void updateAvatarBlockingRule(enabled);
      } catch (error) {
        console.warn('[BN] Failed to read hideAvatar for blocking rule', error);
        void updateAvatarBlockingRule(true);
      }
    });
  } catch (error) {
    console.warn('[BN] Failed to sync avatar blocking rule', error);
    void updateAvatarBlockingRule(true);
  }
}

async function loadSubmittersConfig() {
  const fallback = { submitters: [], default: DEFAULT_SUBMITTER_ID };
  try {
    const url = chrome.runtime.getURL('submitter/submitters.json');
    const response = await fetch(url);
    if (!response || !response.ok) return fallback;
    const data = await response.json();
    if (!data || typeof data !== 'object') return fallback;
    if (!Array.isArray(data.submitters)) data.submitters = [];
    if (!data.default) data.default = DEFAULT_SUBMITTER_ID;
    return data;
  } catch (e) {
    console.error('Failed to load submitters config', e);
    return fallback;
  }
}

function findSubmitter(config, id) {
  if (!config || !Array.isArray(config.submitters)) return null;
  return config.submitters.find((s) => s && s.id === id) || null;
}

function resolveDefaultSubmitter(config) {
  const defaultId = (config && config.default) || DEFAULT_SUBMITTER_ID;
  const found = findSubmitter(config, defaultId);
  const popup = (found && found.popup) ? found.popup : DEFAULT_SUBMITTER_POPUP;
  return { id: found ? found.id : defaultId, popup };
}

function applySubmitterState(enabled, popup = DEFAULT_SUBMITTER_POPUP) {
  try {
    if (!chrome || !chrome.action) return;
    
    if (chrome.action.setPopup) {
      chrome.action.setPopup({ popup }, () => {
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

async function ensureSubmitterStateFromStorage() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      applySubmitterState(true, DEFAULT_SUBMITTER_POPUP);
      return;
    }
    
    const config = await loadSubmittersConfig();
    const defaultSubmitter = resolveDefaultSubmitter(config);

    chrome.storage.local.get(['selectedSubmitter'], (items) => {
      try {
        const hasStoredValue = items && Object.prototype.hasOwnProperty.call(items, 'selectedSubmitter');
        const selectedSubmitter = hasStoredValue ? items.selectedSubmitter : defaultSubmitter.id;
        const enabled = selectedSubmitter !== 'none';
        let popup = defaultSubmitter.popup;
        
        if (enabled) {
          const submitter = findSubmitter(config, selectedSubmitter);
          if (submitter && submitter.popup) {
            popup = submitter.popup;
          }
        }
        
        if (!hasStoredValue && selectedSubmitter && selectedSubmitter !== 'none') {
          try { chrome.storage.local.set({ selectedSubmitter }); } catch (_) { /* ignore */ }
        }
        
        applySubmitterState(enabled, popup);
      } catch (e) {
        applySubmitterState(true, defaultSubmitter.popup);
      }
    });
  } catch (e) {
    applySubmitterState(true, DEFAULT_SUBMITTER_POPUP);
  }
}

ensureSubmitterStateFromStorage();
syncAvatarBlockingRuleFromStorage();
refreshRankingMergePreference();

if (chrome && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    ensureSubmitterStateFromStorage();
    syncAvatarBlockingRuleFromStorage();
    refreshRankingMergePreference();
  });
}
if (chrome && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    ensureSubmitterStateFromStorage();
    syncAvatarBlockingRuleFromStorage();
    refreshRankingMergePreference();
  });
}
if (chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (Object.prototype.hasOwnProperty.call(changes, 'selectedSubmitter')) {
      const change = changes.selectedSubmitter;
      const selectedSubmitter = change && Object.prototype.hasOwnProperty.call(change, 'newValue')
        ? change.newValue
        : 'none';
      
      ensureSubmitterStateFromStorage();
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'hideAvatar')) {
      const change = changes.hideAvatar;
      const newValue = (change && Object.prototype.hasOwnProperty.call(change, 'newValue'))
        ? change.newValue
        : true;
      void updateAvatarBlockingRule(Boolean(newValue));
    }

    if (Object.prototype.hasOwnProperty.call(changes, RANKING_MERGE_STORAGE_KEY)) {
      const change = changes[RANKING_MERGE_STORAGE_KEY];
      const hasNewValue = change && Object.prototype.hasOwnProperty.call(change, 'newValue');
      rankingMergeEnabled = hasNewValue ? Boolean(change.newValue) : true;
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'bn_toggle_submitter') {
    const enabled = msg.enabled !== false;
    const submitterId = msg.submitterId || 'none';
    try {
      chrome.storage.local.set({ selectedSubmitter: enabled ? submitterId : 'none' });
    } catch (e) {
      console.warn('Failed to save submitter state:', e);
    }
    ensureSubmitterStateFromStorage();
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
function patchJQueryGet(options) {
  try {
    const prefEnabled = !options || options.enabled !== false;
    if (!prefEnabled) {
      console.log('show-all: merge assistant disabled via settings');
      return;
    }
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

    const GOLD_ROW_CLASS = 'bn-merge-gold-row';
    const GOLD_STYLE_ID = 'bn-merge-gold-style';
    const GOLD_KEYWORD_RE = /(省选|NOI|国赛)/i;
    const SUM_C_SORT_TOKEN = 'sort":"sum_c';

    function containsSumCSortToken(text) {
      if (!text) return false;
      if (text.includes(SUM_C_SORT_TOKEN)) return true;
      try {
        const decoded = decodeURIComponent(text);
        if (decoded.includes(SUM_C_SORT_TOKEN)) return true;
      } catch (_) {
        // ignore decode errors
      }
      return false;
    }

    function isSortedBySumC() {
      try {
        const href = (typeof location === 'object' && location && location.href) ? location.href : '';
        if (containsSumCSortToken(href)) return true;
        const search = (typeof location === 'object' && location && location.search) ? location.search : '';
        if (search) {
          const params = new URLSearchParams(search);
          for (const value of params.values()) {
            if (containsSumCSortToken(value)) return true;
          }
        }
      } catch (err) {
        console.warn('show-all: unable to inspect location info for gold highlight check', err);
      }
      return false;
    }

    function ensureGoldRowStyle(){
      if(document.getElementById(GOLD_STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = GOLD_STYLE_ID;
      style.textContent = `
        .${GOLD_ROW_CLASS} {
          background-image: linear-gradient(90deg, rgba(255, 215, 0, 0.18), rgba(255, 243, 205, 0.08)) !important;
          box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.35);
          transition: background 0.25s ease, box-shadow 0.25s ease;
        }
        .${GOLD_ROW_CLASS} td {
          background-color: transparent !important;
        }
      `;
      const target = document.head || document.documentElement || document.body;
      if(target) target.appendChild(style);
    }

    let latestGoldContext = null;
    let goldHighlightReapplyTimer = null;
    const GOLD_REAPPLY_DELAY_MS = 420;

    function scheduleGoldHighlightReapply(delay = GOLD_REAPPLY_DELAY_MS){
      if(!latestGoldContext) return;
      if(goldHighlightReapplyTimer){
        clearTimeout(goldHighlightReapplyTimer);
        goldHighlightReapplyTimer = null;
      }
      goldHighlightReapplyTimer = window.setTimeout(() => {
        goldHighlightReapplyTimer = null;
        const ctx = latestGoldContext;
        if(!ctx) return;
        applyGoldHighlightForTable(ctx.tableId, ctx.users, ctx.mapping);
      }, typeof delay === 'number' && delay >= 0 ? delay : GOLD_REAPPLY_DELAY_MS);
    }

    function extractNumericValue(value){
      if(typeof value === 'number'){
        return Number.isFinite(value) ? value : NaN;
      }
      if(typeof value === 'string'){
        const normalized = value.replace(/[,，]/g, '');
        const match = normalized.match(/-?\d+(\.\d+)?/);
        return match ? Number(match[0]) : NaN;
      }
      return NaN;
    }

    function resolveUserId(user){
      if(!user || typeof user !== 'object') return null;
      const keys = ['id', 'uid', 'user_id', 'userId', 'userID'];
      for(const key of keys){
        if(Object.prototype.hasOwnProperty.call(user, key)){
          const value = user[key];
          if(value !== undefined && value !== null && String(value).trim() !== ''){
            return String(value);
          }
        }
      }
      return null;
    }

    function buildUserLookup(users){
      const map = new Map();
      if(!Array.isArray(users)) return map;
      for(const user of users){
        const uid = resolveUserId(user);
        if(uid) map.set(uid, user);
      }
      return map;
    }

    const SCORE_KEYS = [
      'sum', 'total', 'score', 'total_score', 'sum_score', 'sumScore',
      'totalScore', 'score_total', 'scoreTotal', 'sum_c', 'sumC',
      'sum_r', 'sumR', 'score_c', 'scoreC', 'score_r', 'scoreR'
    ];
    const SCORE_KEY_HINT_RE = /(score|sum|total)/i;

    function resolveUserScore(user, depth = 0, visited = null){
      if(user === null || user === undefined) return NaN;
      const valueType = typeof user;
      if(valueType === 'number' || valueType === 'string'){
        return extractNumericValue(user);
      }
      if(valueType !== 'object') return NaN;
      const seen = visited || new WeakSet();
      if(seen.has(user) || depth > 4) return NaN;
      seen.add(user);

      for(const key of SCORE_KEYS){
        if(Object.prototype.hasOwnProperty.call(user, key)){
          const num = extractNumericValue(user[key]);
          if(Number.isFinite(num)) return num;
        }
      }

      for(const [key, value] of Object.entries(user)){
        if(value === null || value === undefined) continue;
        const valType = typeof value;
        if(valType === 'number' || valType === 'string'){
          if(SCORE_KEY_HINT_RE.test(key)){
            const num = extractNumericValue(value);
            if(Number.isFinite(num)) return num;
          }
          continue;
        }
        if(valType === 'object'){
          if(Array.isArray(value)){
            for(const item of value){
              const nested = resolveUserScore(item, depth + 1, seen);
              if(Number.isFinite(nested)) return nested;
            }
          } else {
            const nested = resolveUserScore(value, depth + 1, seen);
            if(Number.isFinite(nested)) return nested;
          }
        }
      }
      return NaN;
    }

    function countNonZeroUsers(users){
      if(!Array.isArray(users)) return 0;
      let count = 0;
      for(const user of users){
        const score = resolveUserScore(user);
        if(Number.isFinite(score) && score > 0) count++;
      }
      return count;
    }

    function resolveSumIndex(mapping){
      if(!Array.isArray(mapping)) return -1;
      for(let i = 0; i < mapping.length; i++){
        const item = mapping[i];
        if(item && item.kind === 'sum') return i;
      }
      return -1;
    }

    function findHeaderRow(tableId){
      const direct = document.querySelector(`#title-${tableId}`);
      if(direct) return direct;
      const table = document.getElementById(`table-${tableId}`) || document.querySelector(`#table-${tableId}`);
      if(table){
        const headRow = table.querySelector('thead tr');
        if(headRow) return headRow;
      }
      return null;
    }

    function resolveScoreColumnIndex(tableId, mapping){
      const sumIndex = resolveSumIndex(mapping);
      if(sumIndex >= 0) return sumIndex;
      const headerRow = findHeaderRow(tableId);
      if(!headerRow) return -1;
      const cells = Array.from(headerRow.children || []);
      if(!cells.length) return -1;
      const explicitIndex = cells.findIndex(cell => /总分|成绩|total|score/i.test((cell.textContent || '').trim()));
      if(explicitIndex >= 0) return explicitIndex;
      if(cells.length >= 5) return 4;
      return cells.length - 1;
    }

    function readScoreFromRow(row, scoreIndex){
      if(!row || scoreIndex < 0) return NaN;
      const cells = row.querySelectorAll ? row.querySelectorAll('td') : null;
      if(!cells || !cells.length || !cells[scoreIndex]) return NaN;
      const cell = cells[scoreIndex];
      return extractNumericValue((cell.textContent || cell.innerText || '').trim());
    }

    function determineRowScore(row, scoreIndex, userLookup){
      if(!row) return 0;
      const domScore = readScoreFromRow(row, scoreIndex);
      if(Number.isFinite(domScore)) return domScore;
      const rowId = row.id || '';
      let uid = null;
      if(row.dataset && row.dataset.uid){
        uid = String(row.dataset.uid);
      } else {
        const parts = rowId.split('-');
        uid = parts.length >= 3 ? parts[2] : null;
      }
      if(uid && userLookup && userLookup.size){
        const user = userLookup.get(String(uid));
        const userScore = resolveUserScore(user);
        if(Number.isFinite(userScore)) return userScore;
      }
      return 0;
    }

    function computeHighlightRatio(tableId){
      if(!isSortedBySumC()) return 0;
      let ratio = 0.2;
      try {
        const anchor = document.querySelector(`#table-${tableId} > div > h1 > a`);
        const text = anchor ? (anchor.textContent || '').trim() : '';
        if(text && GOLD_KEYWORD_RE.test(text)) ratio = 0.5;
      } catch(_) {
        /* ignore */
      }
      return ratio;
    }

    function applyGoldHighlightForTable(tableId, users, mapping){
      try {
        const table = document.getElementById(`table-${tableId}`) || document.querySelector(`#table-${tableId}`);
        if(!table) return;
        const rows = Array.from(table.querySelectorAll(`tr[id^="line-${tableId}-"]`));
        if(!rows.length) return;
        const ratio = computeHighlightRatio(tableId);
        rows.forEach(row => row.classList.remove(GOLD_ROW_CLASS));
        if(!(ratio > 0)) return;
        latestGoldContext = {
          tableId,
          users: Array.isArray(users) ? users : [],
          mapping
        };
        const userLookup = buildUserLookup(users);
        const scoreIndex = resolveScoreColumnIndex(tableId, mapping);
        const domNonZeroRows = [];
        for(const row of rows){
          const score = determineRowScore(row, scoreIndex, userLookup);
          if(score > 0) domNonZeroRows.push(row);
        }
        if(!domNonZeroRows.length) return;
        ensureGoldRowStyle();
        const baseTotal = countNonZeroUsers(users);
        const totalNonZero = baseTotal > 0 ? baseTotal : domNonZeroRows.length;
        const highlightCount = Math.min(
          domNonZeroRows.length,
          Math.max(0, Math.ceil(totalNonZero * ratio))
        );
        if(!highlightCount) return;
        const scoredRows = domNonZeroRows.map((row, order) => ({
          row,
          score: determineRowScore(row, scoreIndex, userLookup),
          order
        }));
        scoredRows.sort((a, b) => {
          if(b.score !== a.score) return b.score - a.score;
          return a.order - b.order;
        });
        if(highlightCount){
          const capped = Math.min(highlightCount, scoredRows.length);
          const finiteRows = scoredRows.filter(({ score }) => Number.isFinite(score));
          if(!finiteRows.length) return;
          const candidates = Math.min(capped, finiteRows.length);
          if(!candidates) return;
          const cutoffScore = finiteRows[candidates - 1].score;
          if(!Number.isFinite(cutoffScore)) return;
          let lastIndex = candidates - 1;
          while(lastIndex + 1 < finiteRows.length && finiteRows[lastIndex + 1].score === cutoffScore){
            lastIndex++;
          }
          const selected = finiteRows.slice(0, lastIndex + 1);
          selected.forEach(({ row }) => row.classList.add(GOLD_ROW_CLASS));
        }
      } catch(err) {
        console.warn('show-all: applyGoldHighlight error', err);
      }
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

      applyGoldHighlightForTable(table_id, Array.isArray(users) ? users : [], mapping);

    } catch(e){
      console.error('show-all: ensureRowsForUsers unexpected error', e);
    }
  }


        // ---- gatherAllPages (with progress support) ----
    async function gatherAllPages(originalUrlStr, opts = {}) {
      const options = Object.assign({ delayMs: 120, pageLimit: 500, onProgress: null }, opts || {});
      const delayMs = typeof options.delayMs === 'number' ? options.delayMs : 120;
      const pageLimit = typeof options.pageLimit === 'number' ? options.pageLimit : 500;
      const progressCb = typeof options.onProgress === 'function' ? options.onProgress : null;

      let mergedUsers = [];
      let pagesFetched = 0;
      const startTime = Date.now();

      const buildStats = () => ({
        pages: pagesFetched,
        users: mergedUsers.length,
        elapsedMs: Date.now() - startTime
      });

      const emit = (payload) => {
        if(!progressCb) return;
        const base = { type: 'update', stats: buildStats() };
        let data;
        if(payload && typeof payload === 'object' && !Array.isArray(payload)){
          data = payload;
        } else if(typeof payload === 'string'){
          data = { text: payload };
        } else {
          data = {};
        }
        try { progressCb(Object.assign({}, base, data)); } catch(_) { /* ignore progress errors */ }
      };

      emit({ text: '准备抓取所有页面...', stage: 'init' });
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

      const fetchJson = async (u, pageNumber) => {
        console.log('show-all: native fetch ->', u);
        emit({ text: `正在抓取第 ${pageNumber} 页...`, stage: 'fetch', currentPage: pageNumber });
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
      const first = await fetchJson(makeUrl(1), 1);
      if(first && first.success === false){
        console.warn('show-all: first page returned success=false, aborting gather');
        emit({ text: '首页返回 success=false，已停止合并', stage: 'error', tone: 'warning' });
        return first;
      }
      let users = extractItems(first) || [];
      const isTopArray = Array.isArray(first);
      mergedUsers = users.slice();
      pagesFetched = 1;
      const mergedTable = (first && first.table && typeof first.table === 'object') ? Object.assign({}, first.table) : {};
      const totalHint = first && (first.total || first.total_count || first.count);
      emit({ text: `第 1 页抓取完成，累计 ${mergedUsers.length} 条数据`, stage: 'page-complete', currentPage: 1 });
      let page = 2;
      while(true){
        if(page > pageLimit) { console.warn('show-all: page limit reached', page); emit({ text: `达到抓取页数上限 ${pageLimit}，停止合并`, stage: 'limit', tone: 'warning' }); break; }
        if(totalHint && mergedUsers.length >= totalHint) { console.log('show-all: reached totalHint', totalHint); break; }

        const urlPage = makeUrl(page);
        try {
          console.log('show-all: fetching page', page);
          const j = await fetchJson(urlPage, page);
          if(j && j.success === false){ console.warn('show-all: page', page, 'returned success=false - stop'); emit({ text: `第 ${page} 页返回 success=false，停止合并`, stage: 'error', tone: 'warning', currentPage: page }); break; }
          const a = extractItems(j) || [];
          if(!a || a.length === 0){ console.log('show-all: page', page, 'empty - stop'); emit({ text: `第 ${page} 页没有更多数据，停止合并`, stage: 'empty', tone: 'info', currentPage: page }); break; }
          mergedUsers.push(...a);
          if(j && j.table && typeof j.table === 'object'){
            for(const k in j.table) mergedTable[k] = j.table[k];
          }
          pagesFetched = Math.max(pagesFetched, page);
          emit({ text: `第 ${page} 页抓取完成，累计 ${mergedUsers.length} 条数据`, stage: 'page-complete', currentPage: page });
        } catch(e){
          console.error('show-all: error fetching page', page, e);
          emit({ text: `抓取第 ${page} 页失败：${e && e.message ? e.message : e}`, stage: 'error', tone: 'error', currentPage: page });
          break;
        }
        page++;
        if(delayMs) await new Promise(r=>setTimeout(r, delayMs));
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
      emit({ text: `合并完成，共 ${mergedUsers.length} 条数据`, stage: 'done', tone: 'success' });

      emit({ text: '正在渲染榜单...', stage: 'render', tone: 'info' });
      try {
        await ensureRowsForUsers(originalUrlStr, mergedUsers);
        emit({ text: '渲染完成', stage: 'render-done', tone: 'success' });
      } catch(e){
        console.warn('show-all: ensure rows error', e);
        emit({ text: '渲染阶段出现问题，请检查控制台', stage: 'render-error', tone: 'warning' });
      }
      return out;
    }

// waitForjQuery & patch $.get (manual trigger UI)
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

        const shouldEnableMergeAssistant = (() => {
          try {
            const params = new URLSearchParams(location.search || '');
            const tidParam = params.get('tid');
            if (tidParam && tidParam.trim().startsWith('3')) return true;
            const tablesParams = params.getAll('tables');
            if (tablesParams && tablesParams.length > 0) {
              const regexes = [
                /"tid"\s*:\s*"?(\d+)/g,
                /'tid'\s*:\s*'?(\d+)/g,
              ];
              for (const raw of tablesParams) {
                if (!raw) continue;
                let str = raw;
                try { str = decodeURIComponent(str); } catch (e) { /* ignore decode issues */ }
                for (const re of regexes) {
                  re.lastIndex = 0;
                  let match;
                  while ((match = re.exec(str)) !== null) {
                    const tidValue = String(match[1] || '').trim();
                    if (tidValue.startsWith('3')) return true;
                  }
                }
              }
            }
          } catch (err) {
            console.warn('show-all: merge assistant tid check failed', err);
          }
          return false;
        })();
        if(!shouldEnableMergeAssistant){
          console.log('show-all: merge assistant disabled for this URL');
          return;
        }

        const origGet = $.get.bind($);
        let gatherRequested = false;
        let gatherInProgress = false;
        let replayLastGet = null;
        let statsRefs = null;
        let lastStats = { pages: 0, users: 0, elapsedMs: 0 };
        const MERGE_REQUEST_TIMEOUT_MS = 2600;
        let pendingMergeKick = null;

        const CONTROL_ID = 'bn-merge-container';
        const BUTTON_ID = 'bn-merge-button';
        const TITLE_CLASS = 'bn-merge-title';
        const STATS_CLASS = 'bn-merge-stats';
        const STAT_ITEM_CLASS = 'bn-merge-stat';
        const STAT_VALUE_CLASS = 'bn-merge-stat-value';
        const DEFAULT_IDLE_TEXT = '合并榜单';
        const RETRY_TEXT = '重新合并';
        const ERROR_RETRY_TEXT = '重试合并';
        const MERGE_POS_STORAGE_KEY = 'bn.mergeControl.position';
        const DEFAULT_CONTAINER_TOP = 86;
        const DEFAULT_CONTAINER_RIGHT = 16;
        const MERGE_VIEWPORT_PADDING = 12;
        const mergePositionStorage = (() => {
          try {
            if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
          } catch (_) { /* ignore */ }
          return null;
        })();

        let mergeControlPosition = loadMergeControlPosition();
        let mergeContainerRef = null;
        let mergeDragState = null;
        let mergePointerListenersBound = false;
        let mergeResizeListenerBound = false;

        function loadMergeControlPosition() {
          if (!mergePositionStorage) return null;
          try {
            const raw = mergePositionStorage.getItem(MERGE_POS_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const top = Number(parsed.top);
            const left = Number(parsed.left);
            if (Number.isFinite(top) && Number.isFinite(left)) return { top, left };
          } catch (err) {
            console.warn('show-all: failed to parse merge control position', err);
          }
          return null;
        }

        const isValidMergePosition = (pos) => pos && Number.isFinite(pos.top) && Number.isFinite(pos.left);

        function persistMergeControlPosition() {
          if (!mergePositionStorage) return;
          if (!isValidMergePosition(mergeControlPosition)) return;
          try {
            mergePositionStorage.setItem(MERGE_POS_STORAGE_KEY, JSON.stringify({
              top: Math.round(mergeControlPosition.top),
              left: Math.round(mergeControlPosition.left)
            }));
          } catch (err) {
            console.warn('show-all: failed to store merge control position', err);
          }
        }

        function clampMergeControlPosition(top, left, el) {
          const docEl = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement : null;
          const body = (typeof document !== 'undefined') ? document.body : null;
          const viewportWidth = Math.max(
            typeof window !== 'undefined' ? window.innerWidth || 0 : 0,
            docEl ? docEl.clientWidth || 0 : 0,
            body ? body.clientWidth || 0 : 0,
            0
          ) || 1280;
          const viewportHeight = Math.max(
            typeof window !== 'undefined' ? window.innerHeight || 0 : 0,
            docEl ? docEl.clientHeight || 0 : 0,
            body ? body.clientHeight || 0 : 0,
            0
          ) || 720;
          let width = 260;
          let height = 160;
          if (el) {
            const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
            width = (rect && rect.width) || el.offsetWidth || width;
            height = (rect && rect.height) || el.offsetHeight || height;
          }
          const minLeft = MERGE_VIEWPORT_PADDING;
          const minTop = MERGE_VIEWPORT_PADDING;
          const maxLeft = Math.max(minLeft, viewportWidth - width - MERGE_VIEWPORT_PADDING);
          const maxTop = Math.max(minTop, viewportHeight - height - MERGE_VIEWPORT_PADDING);
          const clampedLeft = Math.min(Math.max(left, minLeft), maxLeft);
          const clampedTop = Math.min(Math.max(top, minTop), maxTop);
          return { top: clampedTop, left: clampedLeft };
        }

        function applyMergePositionStyles(el) {
          if (!el) return;
          if (isValidMergePosition(mergeControlPosition)) {
            const next = clampMergeControlPosition(mergeControlPosition.top, mergeControlPosition.left, el);
            mergeControlPosition = next;
            el.style.top = `${next.top}px`;
            el.style.left = `${next.left}px`;
            el.style.right = 'auto';
          } else {
            el.style.top = `${DEFAULT_CONTAINER_TOP}px`;
            el.style.right = `${DEFAULT_CONTAINER_RIGHT}px`;
            el.style.left = 'auto';
          }
        }

        function bindMergePointerListeners() {
          if (mergePointerListenersBound) return;
          if (typeof window === 'undefined') return;
          mergePointerListenersBound = true;
          window.addEventListener('pointermove', (event) => continueMergeDrag(event));
          window.addEventListener('pointerup', (event) => finishMergeDrag(event));
          window.addEventListener('pointercancel', (event) => finishMergeDrag(event));
          window.addEventListener('blur', () => finishMergeDrag());
        }

        function handleMergeResize() {
          if (!mergeContainerRef) return;
          if (isValidMergePosition(mergeControlPosition)) {
            const next = clampMergeControlPosition(mergeControlPosition.top, mergeControlPosition.left, mergeContainerRef);
            mergeControlPosition = next;
            mergeContainerRef.style.top = `${next.top}px`;
            mergeContainerRef.style.left = `${next.left}px`;
            mergeContainerRef.style.right = 'auto';
            persistMergeControlPosition();
          } else {
            applyMergePositionStyles(mergeContainerRef);
          }
        }

        function bindMergeResizeListener() {
          if (mergeResizeListenerBound) return;
          if (typeof window === 'undefined') return;
          mergeResizeListenerBound = true;
          window.addEventListener('resize', () => handleMergeResize());
        }

        function shouldIgnoreDragTarget(target) {
          if (!target || typeof target.closest !== 'function') return false;
          return !!target.closest('button, a, input, textarea, select');
        }

        function startMergeDrag(event, container) {
          if (!container) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          if (typeof event.button === 'number' && event.pointerType !== 'touch' && event.pointerType !== 'pen' && event.button !== 0) return;
          if (shouldIgnoreDragTarget(event.target)) return;
          const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : { top: DEFAULT_CONTAINER_TOP, left: DEFAULT_CONTAINER_RIGHT };
          mergeDragState = {
            pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
            startX: event.clientX || 0,
            startY: event.clientY || 0,
            startTop: rect.top ?? DEFAULT_CONTAINER_TOP,
            startLeft: rect.left ?? DEFAULT_CONTAINER_RIGHT,
            container
          };
          container.style.cursor = 'grabbing';
          container.style.userSelect = 'none';
          if (typeof container.setPointerCapture === 'function' && mergeDragState.pointerId !== null) {
            try { container.setPointerCapture(mergeDragState.pointerId); } catch (_) { /* ignore */ }
          }
          if (event.cancelable) event.preventDefault();
        }

        function continueMergeDrag(event) {
          if (!mergeDragState) return;
          if (mergeDragState.pointerId !== null && typeof event.pointerId === 'number' && event.pointerId !== mergeDragState.pointerId) return;
          const container = mergeDragState.container;
          if (!container) return;
          const deltaX = (event.clientX || 0) - mergeDragState.startX;
          const deltaY = (event.clientY || 0) - mergeDragState.startY;
          const next = clampMergeControlPosition(mergeDragState.startTop + deltaY, mergeDragState.startLeft + deltaX, container);
          mergeControlPosition = next;
          container.style.top = `${next.top}px`;
          container.style.left = `${next.left}px`;
          container.style.right = 'auto';
        }

        function finishMergeDrag(event) {
          if (!mergeDragState) return;
          if (event && mergeDragState.pointerId !== null && typeof event.pointerId === 'number' && event.pointerId !== mergeDragState.pointerId) {
            return;
          }
          const container = mergeDragState.container;
          if (container) {
            container.style.cursor = 'grab';
            container.style.userSelect = '';
            if (mergeDragState.pointerId !== null && typeof container.releasePointerCapture === 'function') {
              try { container.releasePointerCapture(mergeDragState.pointerId); } catch (_) { /* ignore */ }
            }
          }
          mergeDragState = null;
          persistMergeControlPosition();
        }

        function enableMergeDrag(container) {
          if (!container) return;
          mergeContainerRef = container;
          bindMergePointerListeners();
          bindMergeResizeListener();
          if (!container.__bnMergeDragInit) {
            container.addEventListener('pointerdown', (event) => startMergeDrag(event, container));
            container.__bnMergeDragInit = true;
          }
          applyMergePositionStyles(container);
        }

        const applyContainerStyles = (el) => {
          el.style.position = 'fixed';
          el.style.zIndex = '2147483647';
          el.style.color = '#1f2933';
          el.style.padding = '14px 16px';
          el.style.minWidth = '220px';
          el.style.borderRadius = '12px';
          el.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,247,250,0.96))';
          el.style.border = '1px solid rgba(209, 213, 219, 0.7)';
          el.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.18)';
          el.style.backdropFilter = 'blur(12px)';
          el.style.fontSize = '13px';
          el.style.lineHeight = '1.5';
          el.style.display = 'flex';
          el.style.flexDirection = 'column';
          el.style.alignItems = 'stretch';
          el.style.gap = '8px';
          el.style.cursor = 'grab';
          el.style.touchAction = 'none';
          applyMergePositionStyles(el);
        };

        const styleButton = (btn, isNew) => {
          btn.type = 'button';
          btn.id = BUTTON_ID;
          if(isNew) btn.textContent = DEFAULT_IDLE_TEXT;
          btn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
          btn.style.color = '#ffffff';
          btn.style.border = 'none';
          btn.style.padding = '8px 18px';
          btn.style.borderRadius = '20px';
          btn.style.cursor = 'pointer';
          btn.style.fontSize = '13px';
          btn.style.fontWeight = '600';
          btn.style.letterSpacing = '0.02em';
          btn.style.boxShadow = '0 6px 18px rgba(99, 102, 241, 0.35)';
          btn.style.transition = 'all 0.2s ease';
          btn.onmouseenter = () => {
            if(btn.disabled) return;
            btn.style.boxShadow = '0 8px 22px rgba(79, 70, 229, 0.38)';
            btn.style.transform = 'translateY(-1px)';
          };
          btn.onmouseleave = () => {
            btn.style.boxShadow = btn.disabled ? '0 0 0 rgba(0,0,0,0)' : '0 6px 18px rgba(99, 102, 241, 0.35)';
            btn.style.transform = 'translateY(0)';
          };
        };

        const createStatsElements = () => {
          const wrap = document.createElement('div');
          wrap.className = STATS_CLASS;
          wrap.style.display = 'flex';
          wrap.style.justifyContent = 'space-between';
          wrap.style.alignItems = 'center';
          wrap.style.gap = '12px';
          wrap.style.background = 'rgba(255,255,255,0.7)';
          wrap.style.border = '1px solid rgba(209,213,219,0.6)';
          wrap.style.borderRadius = '10px';
          wrap.style.padding = '8px 12px';
          wrap.style.fontSize = '11px';
          wrap.style.color = '#6b7280';

          const makeItem = (label) => {
            const item = document.createElement('div');
            item.className = STAT_ITEM_CLASS;
            item.style.display = 'flex';
            item.style.flexDirection = 'column';
            item.style.alignItems = 'flex-start';
            item.style.gap = '2px';

            const value = document.createElement('span');
            value.className = STAT_VALUE_CLASS;
            value.textContent = '--';
            value.style.fontSize = '14px';
            value.style.fontWeight = '600';
            value.style.color = '#111827';

            const labelEl = document.createElement('span');
            labelEl.textContent = label;
            labelEl.style.fontSize = '11px';
            labelEl.style.letterSpacing = '0.02em';

            item.appendChild(value);
            item.appendChild(labelEl);
            wrap.appendChild(item);
            return value;
          };

          return {
            wrap,
            pages: makeItem('抓取页数'),
            users: makeItem('抓取人数'),
            time: makeItem('耗时')
          };
        };

        const ensureStats = (container) => {
          if(!container) return null;
          if(!statsRefs || !statsRefs.wrap || !statsRefs.wrap.isConnected){
            statsRefs = createStatsElements();
            const title = container.querySelector('.' + TITLE_CLASS);
            if(title && title.nextSibling){
              container.insertBefore(statsRefs.wrap, title.nextSibling);
            } else {
              container.appendChild(statsRefs.wrap);
            }
          } else if(statsRefs.wrap.parentElement !== container){
            const title = container.querySelector('.' + TITLE_CLASS);
            if(title && title.nextSibling){
              container.insertBefore(statsRefs.wrap, title.nextSibling);
            } else {
              container.appendChild(statsRefs.wrap);
            }
          }
          return statsRefs;
        };

        const normalizeStats = (stats) => {
          const toInt = (v) => {
            const num = Number(v);
            return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
          };
          const toMs = (v) => {
            const num = Number(v);
            return Number.isFinite(num) && num >= 0 ? num : 0;
          };
          if(!stats || typeof stats !== 'object') return { pages: 0, users: 0, elapsedMs: 0 };
          return {
            pages: toInt(stats.pages),
            users: toInt(stats.users),
            elapsedMs: toMs(stats.elapsedMs)
          };
        };

        const formatDuration = (ms) => {
          const num = Number(ms);
          if(!Number.isFinite(num) || num <= 0) return '0.0s';
          const seconds = num / 1000;
          if(seconds < 60) return `${seconds.toFixed(1)}s`;
          const minutes = Math.floor(seconds / 60);
          const remain = seconds - minutes * 60;
          return `${minutes}m${remain.toFixed(1)}s`;
        };

        const updateStatsDisplay = (stats) => {
          const refs = statsRefs;
          if(stats && typeof stats === 'object'){
            lastStats = normalizeStats(stats);
          }
          if(!refs) return;
          const data = lastStats;
          refs.pages.textContent = String(data.pages ?? 0);
          refs.users.textContent = String(data.users ?? 0);
          refs.time.textContent = formatDuration(data.elapsedMs);
        };

        const resetStatsDisplay = () => {
          lastStats = { pages: 0, users: 0, elapsedMs: 0 };
          if((!statsRefs || !statsRefs.wrap || !statsRefs.wrap.isConnected) && typeof document !== 'undefined'){
            const container = document.getElementById(CONTROL_ID);
            if(container) ensureStats(container);
          }
          updateStatsDisplay(lastStats);
        };

        const triggerFilterReload = () => {
          try {
            window.dispatchEvent(new CustomEvent('bn:reload-filter'));
          } catch(e){
            console.warn('show-all: dispatch bn:reload-filter failed', e);
          }
          try {
            if(typeof window.__bnReloadRankingFilter === 'function'){
              window.__bnReloadRankingFilter();
            }
          } catch(e){
            console.warn('show-all: __bnReloadRankingFilter call failed', e);
          }
        };

        const ensureTitle = (container) => {
          let title = container.querySelector('.' + TITLE_CLASS);
          if(!title){
            title = document.createElement('div');
            title.className = TITLE_CLASS;
            title.style.display = 'flex';
            title.style.alignItems = 'center';
            title.style.gap = '8px';
            title.style.fontSize = '13px';
            title.style.fontWeight = '600';
            title.style.color = '#111827';
            const dot = document.createElement('span');
            dot.textContent = '●';
            dot.style.color = '#6366f1';
            dot.style.fontSize = '10px';
            dot.style.marginTop = '-2px';
            const text = document.createElement('span');
            text.textContent = '榜单助手';
            title.appendChild(dot);
            title.appendChild(text);
            container.insertBefore(title, container.firstChild);
          }
          return title;
        };

        const ensureControls = () => {
          try {
            if(!document || !document.body) return null;
          } catch(_) {
            return null;
          }
          let container = document.getElementById(CONTROL_ID);
          if(!container){
            container = document.createElement('div');
            container.id = CONTROL_ID;
            applyContainerStyles(container);
            const button = document.createElement('button');
            styleButton(button, true);
            ensureTitle(container);
            statsRefs = ensureStats(container);
            container.appendChild(button);
            document.body.appendChild(container);
            enableMergeDrag(container);
            updateStatsDisplay(lastStats);
            return { button, status: null };
          }
          applyContainerStyles(container);
          ensureTitle(container);
          statsRefs = ensureStats(container);
          updateStatsDisplay(lastStats);
          enableMergeDrag(container);
          let button = container.querySelector('#' + BUTTON_ID);
          if(!button){
            button = document.createElement('button');
            styleButton(button, true);
            container.appendChild(button);
          } else {
            styleButton(button, false);
          }
          return { button, status: null };
        };

        const controls = ensureControls();
        const mergeButton = controls && controls.button;
        const statusEl = controls && controls.status;
        const clearPendingMergeKick = () => {
          if(pendingMergeKick){
            clearTimeout(pendingMergeKick);
            pendingMergeKick = null;
          }
        };

        const setStatus = (text, tone = 'info') => {
          if(statusEl){
            statusEl.textContent = text || '';
            let color = '#4b5563';
            if(tone === 'success') color = '#047857';
            else if(tone === 'error') color = '#b91c1c';
            else if(tone === 'warning') color = '#b45309';
            statusEl.style.color = color;
          }
        };
        const setButtonIdle = (label) => {
          if(!mergeButton) return;
          mergeButton.disabled = false;
          mergeButton.textContent = label || DEFAULT_IDLE_TEXT;
          mergeButton.style.opacity = '1';
          mergeButton.style.cursor = 'pointer';
          mergeButton.style.boxShadow = '0 6px 18px rgba(99, 102, 241, 0.35)';
          mergeButton.style.transform = 'translateY(0)';
        };
        const setButtonBusy = (label) => {
          if(!mergeButton) return;
          mergeButton.disabled = true;
          mergeButton.textContent = label || '合并中...';
          mergeButton.style.opacity = '0.6';
          mergeButton.style.cursor = 'default';
          mergeButton.style.boxShadow = '0 0 0 rgba(0,0,0,0)';
          mergeButton.style.transform = 'translateY(0)';
        };

        if(mergeButton && !mergeButton.dataset.bnMergeBound){
          mergeButton.dataset.bnMergeBound = '1';
          setButtonIdle(DEFAULT_IDLE_TEXT);
          setStatus('等待榜单加载...');
          mergeButton.addEventListener('click', () => {
            if(gatherInProgress){
              return;
            }
            if(typeof replayLastGet !== 'function'){
              gatherRequested = true;
              gatherInProgress = true;
              resetStatsDisplay();
              setButtonBusy('刷新中...');
              setStatus('正在刷新榜单并捕获请求...', 'info');
              clearPendingMergeKick();
              pendingMergeKick = setTimeout(() => {
                if(gatherInProgress){
                  gatherRequested = false;
                  gatherInProgress = false;
                  setButtonIdle(ERROR_RETRY_TEXT);
                  setStatus('未捕获到榜单请求，请刷新后重试', 'warning');
                }
              }, MERGE_REQUEST_TIMEOUT_MS);
              try {
                triggerFilterReload();
              } catch(err){
                console.warn('show-all: failed to trigger filter reload for merge', err);
              }
              return;
            }
            gatherRequested = true;
            gatherInProgress = true;
            resetStatsDisplay();
            setButtonBusy('合并中...');
            setStatus('准备抓取所有页面...', 'info');
            clearPendingMergeKick();
            try {
              replayLastGet();
            } catch(err){
              console.error('show-all: failed to trigger manual merge', err);
              gatherRequested = false;
              gatherInProgress = false;
              setStatus(`触发合并失败：${err && err.message ? err.message : err}`, 'error');
              setButtonIdle(ERROR_RETRY_TEXT);
            }
          });
        }

        const patchedGet = function(...args){
          const urlArg = args[0];
          const urlStr = (typeof urlArg === 'string') ? urlArg : (urlArg && urlArg.url ? urlArg.url : '');
          if(typeof urlStr === 'string' && urlStr.indexOf('/progress/contest_table/json') !== -1){
            let success = null;
            if(args.length >= 2 && typeof args[1] === 'function') success = args[1];
            else if(args.length >= 3 && typeof args[2] === 'function') success = args[2];

            const argsCopy = args.slice();
            replayLastGet = () => patchedGet.apply($, argsCopy);
            clearPendingMergeKick();

            if(!gatherRequested){
              if(!gatherInProgress) setStatus('检测到榜单数据，可点击「合并榜单」', 'info');
              return origGet.apply($, args);
            }

            gatherRequested = false;
            gatherInProgress = true;
            setButtonBusy('合并中...');
            const deferred = $.Deferred();

            const notifyProgress = (payload) => {
              if(payload && typeof payload === 'object'){
                if(payload.stats) updateStatsDisplay(payload.stats);
                const tone = payload.tone || (payload.text
                  ? (/失败|错误|异常/.test(payload.text) ? 'error'
                    : /完成|成功/.test(payload.text) ? 'success'
                    : /警|warning/i.test(payload.stage || '') ? 'warning'
                    : 'info')
                  : null);
                if(typeof payload.text === 'string' && payload.text.length > 0){
                  setStatus(payload.text, tone || 'info');
                } else if(payload.stage === 'done'){
                  setStatus('合并完成', 'success');
                }
                return;
              }
              if(!payload){
                return;
              }
              const text = String(payload);
              let tone = 'info';
              if(/失败|错误|异常/.test(text)) tone = 'error';
              else if(/完成|成功/.test(text)) tone = 'success';
              setStatus(text, tone);
            };

            const fallbackToOriginal = () => {
              try {
                const orig = origGet.apply($, argsCopy);
                if(orig && typeof orig.done === 'function'){
                  orig.done((r) => deferred.resolve(r));
                  if(typeof orig.fail === 'function'){
                    orig.fail((err) => deferred.reject(err));
                  }
                  return;
                }
                if(orig && typeof orig.then === 'function'){
                  orig.then((val) => deferred.resolve(val), (err) => deferred.reject(err));
                  return;
                }
                deferred.resolve(orig);
              } catch(e2){
                deferred.reject(e2);
              }
            };

            (async () => {
              try {
                const merged = await gatherAllPages(urlStr, { delayMs: 100, onProgress: notifyProgress });
                if(merged && merged.success === false){
                  setStatus('接口返回 success=false，已保持原状', 'warning');
                  if(typeof success === 'function'){
                    try { success(merged); } catch(cbErr){
                      console.error('show-all: success cb threw', cbErr);
                    }
                  }
                  gatherInProgress = false;
                  setButtonIdle(RETRY_TEXT);
                  deferred.resolve(merged);
                  return;
                }
                if(typeof success === 'function'){
                  try { success(merged); } catch(cbErr){
                    console.error('show-all: success cb threw', cbErr);
                  }
                }
                gatherInProgress = false;
                setButtonIdle(RETRY_TEXT);
                setStatus('合并完成，可重新执行合并', 'success');
                triggerFilterReload();
                scheduleGoldHighlightReapply();
                deferred.resolve(merged);
              } catch(err){
                console.error('show-all: gatherAllPages error', err);
                setStatus('合并失败，回退到原始请求', 'error');
                setButtonIdle(ERROR_RETRY_TEXT);
                gatherInProgress = false;
                fallbackToOriginal();
              }
            })();

            return deferred.promise();
          }
          return origGet.apply($, args);
        };

        $.get = patchedGet;

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
      if (!rankingMergeEnabled) {
        console.log('show-all: merge assistant disabled globally; skip injection for', tab.url);
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: patchJQueryGet,
        args: [{ enabled: rankingMergeEnabled }],
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
