function getCurrentUserId() {
  const ud = document.querySelector('#user-dropdown');
  if (ud && ud.dataset && (ud.dataset.user_id || ud.dataset.userId)) {
    return Number(ud.dataset.user_id || ud.dataset.userId);
  }
  const a1 = document.querySelector('#user-dropdown a[href^="/user/"]');
  const m1 = a1 && a1.getAttribute('href').match(/\/user\/(\d+)/);
  if (m1) return Number(m1[1]);
  const a2 = document.querySelector('a[href^="/user_plans/"]');
  const m2 = a2 && a2.getAttribute('href').match(/\/user_plans\/(\d+)/);
  if (m2) return Number(m2[1]);
  return NaN;
}
window.getCurrentUserId = getCurrentUserId;

/* 计划添加器 */
(function () {
  'use strict';

  const CFG = {
    base: location.origin,
    tzOffsetHours: 8,
    DEBUG: true,
    DELIM: '|'
  };

  const SEL = {
    table: 'table.ui.very.basic.center.aligned.table',
    thead: 'table.ui.very.basic.center.aligned.table thead > tr',
    tbody: 'table.ui.very.basic.center.aligned.table tbody',
    rows: 'table.ui.very.basic.center.aligned.table tbody > tr',
    linkIn: 'a[href^="/problem/"]'
  };

  const KEY = {
    mode: 'planAdder.mode',
    selected: 'planAdder.selected.v4', 
    date: 'planAdder.date',
    barPos: 'planAdder.barPos',
    autoExit: 'planAdder.autoExit',
    pending: 'planAdder.pending.v1'
  };

  const enablePlanAdder = GM_getValue('enablePlanAdder', true);
  let modeOn = !!GM_getValue(KEY.mode, false);
  const PADDER_HANDLED_FLAG = '__bnPlanHandled';

  const normalizeSelectedEntry = (o) => {
    if (!o || typeof o !== 'object') return null;
    const rawPid = o.pid;
    const pidNum = Number(rawPid);
    const pid = pidNum || (typeof rawPid === 'string' ? rawPid : null);
    const code = typeof o.code === 'string' ? o.code.trim() : '';
    if (!pid || !code || /^L/i.test(code)) return null;
    return { pid, code };
  };

  const loadSelectionStore = () => {
    const raw = GM_getValue(KEY.selected, {});
    if (Array.isArray(raw)) {
      const legacy = raw
        .map(normalizeSelectedEntry)
        .filter(Boolean);
      return legacy.length ? { __legacy__: legacy } : {};
    }
    if (!raw || typeof raw !== 'object') return {};
    const store = {};
    for (const [iso, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      const cleaned = list
        .map(normalizeSelectedEntry)
        .filter(Boolean);
      if (cleaned.length) store[iso] = cleaned;
    }
    return store;
  };

  let selectionStore = loadSelectionStore();
  const persistSelectionStore = () => GM_setValue(KEY.selected, selectionStore);
  const maybeAdoptLegacySelection = (iso) => {
    if (!iso || typeof iso !== 'string') return;
    if (!selectionStore[iso] && selectionStore.__legacy__) {
      selectionStore[iso] = selectionStore.__legacy__;
      delete selectionStore.__legacy__;
      persistSelectionStore();
    }
  };
  const selectionFor = (iso) => {
    if (iso && selectionStore[iso]) {
      return new Map(selectionStore[iso].map(({ pid, code }) => [pid, code]));
    }
    if (selectionStore.__legacy__) {
      return new Map(selectionStore.__legacy__.map(({ pid, code }) => [pid, code]));
    }
    return new Map();
  };
  const persistSelectionFor = (iso, map) => {
    const key = (iso && typeof iso === 'string') ? iso : '__legacy__';
    const arr = [...map]
      .map(([pid, code]) => ({ pid: Number(pid) || pid, code: typeof code === 'string' ? code : '' }))
      .map(normalizeSelectedEntry)
      .filter(Boolean);
    if (arr.length) selectionStore[key] = arr;
    else delete selectionStore[key];
    persistSelectionStore();
  };

  let selected = new Map();
  GM_setValue(KEY.autoExit, true);
  const autoExit = true;
  let observer = null;
  let currentDateIso = null;
  const planCache = new Map();
  let planRequestToken = 0;
  const normalizePendingEntry = (o) => {
    if (!o || typeof o !== 'object') return null;
    const pid = Number(o.pid);
    const code = typeof o.code === 'string' ? o.code.trim() : '';
    if (!pid || !code || /^L/i.test(code)) return null;
    return { pid, code };
  };
  const loadPendingStore = () => {
    const raw = GM_getValue(KEY.pending, {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const store = {};
    for (const [iso, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      const cleaned = list
        .map(normalizePendingEntry)
        .filter(Boolean);
      if (cleaned.length) store[iso] = cleaned;
    }
    return store;
  };
  let pendingStore = loadPendingStore();
  const pendingFor = (iso) => {
    if (!iso || typeof iso !== 'string') return new Map();
    const list = pendingStore[iso] || [];
    return new Map(list.map(({ pid, code }) => [Number(pid), code]));
  };
  const persistPendingStore = () => GM_setValue(KEY.pending, pendingStore);
  const persistPendingFor = (iso, map) => {
    if (!iso || typeof iso !== 'string') return;
    const arr = [...map]
      .map(([pid, code]) => ({ pid: Number(pid), code: typeof code === 'string' ? code : '' }))
      .map(normalizePendingEntry)
      .filter(Boolean);
    if (arr.length) pendingStore[iso] = arr;
    else delete pendingStore[iso];
    persistPendingStore();
  };
  let pendingSelected = new Map();
  const persistPending = () => {
    if (!currentDateIso) return;
    persistPendingFor(currentDateIso, pendingSelected);
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => CFG.DEBUG && console.log('[PlanAdder]', ...a);
  const txt = el => (el ? el.textContent.trim() : '');

  const tomorrowISO = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  };

  function patchDatePicker() {
    const install = (input) => {
      if (!input || input.dataset.bnTomorrowInstalled) return;
      const tomorrow = tomorrowISO();
      input.min = tomorrow;
      if (input.value < tomorrow) input.value = tomorrow;
      input.addEventListener('change', () => {
        if (input.value < tomorrow) input.value = tomorrow;
      });
      input.dataset.bnTomorrowInstalled = '1';
    };
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'date') install(el);
    }, true);
  }
  const offsetStr = h => { const s = h >= 0 ? '+' : '-', a = Math.abs(h); return `${s}${String(Math.floor(a)).padStart(2, '0')}:${String(Math.round((a - Math.floor(a)) * 60)).padStart(2, '0')}`; };
  const dateToEpoch = (iso, tz) => Math.floor(new Date(`${iso}T00:00:00${offsetStr(tz)}`).getTime() / 1000);

  const notify = m => GM_notification({ text: m, timeout: 2600 });

  let planToastStyleInjected = false;
  function showPlanToast(message) {
    if (!message) return;
    if (!planToastStyleInjected) {
      GM_addStyle(`
        #bn-plan-toast-container{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;z-index:99999;pointer-events:none;}
        .bn-plan-toast{background:rgba(33,133,208,.92);color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;line-height:1.45;box-shadow:0 12px 28px rgba(0,0,0,.18);max-width:320px;opacity:0;transform:translateY(14px);transition:opacity .24s ease,transform .24s ease;pointer-events:auto;word-break:break-word;white-space:pre-line;}
        .bn-plan-toast.bn-plan-toast-visible{opacity:1;transform:translateY(0);}
      `);
      planToastStyleInjected = true;
    }
    let container = document.getElementById('bn-plan-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bn-plan-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'bn-plan-toast';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('bn-plan-toast-visible'));
    const duration = 3200;
    window.setTimeout(() => {
      toast.classList.remove('bn-plan-toast-visible');
      window.setTimeout(() => {
        toast.remove();
        if (!container.childElementCount) container.remove();
      }, 280);
    }, duration);
  }
  const persist = () => {
    const iso = currentDateIso && typeof currentDateIso === 'string' ? currentDateIso : null;
    persistSelectionFor(iso, selected);
  };

  let _codeColIdx = null; // 缓存编号列索引
  function codeColIndex() {
    if (_codeColIdx != null) return _codeColIdx;
    const ths = $$(SEL.thead + ' > th');
    for (let i = 0; i < ths.length; i++) {
      if (txt(ths[i]).replace(/\s+/g, '').includes('编号')) { _codeColIdx = i + 1; return _codeColIdx; }
    }
    _codeColIdx = null; return null;
  }
  const pidFromRow = r => (r.querySelector(SEL.linkIn)?.href.match(/\/problem\/(\d+)/) || [])[1] || null;
  const codeFromRow = r => {
    const idx = codeColIndex();
    if (!idx) return null;
    const td = r.querySelector(`td:nth-child(${idx})`);
    return txt(td?.querySelector('b') || td);
  };
  const isLProblemRow = (row) => {
    const code = codeFromRow(row);
    return !!code && /^L/i.test(code);
  };

  const findRowByPid = (pid) => {
    const num = Number(pid);
    if (!num) return null;
    return $$(SEL.rows).find(row => Number(pidFromRow(row)) === num) || null;
  };

  function ensureRowSelection(pid, on) {
    const row = findRowByPid(pid);
    if (!row) return;
    if (on && !row.querySelector('td.padder-cell')) {
      const cell = makeCell(row, pid);
      if (cell) row.prepend(cell);
    }
    attachRowToggle(row);
    const cb = row.querySelector('td.padder-cell input');
    if (cb) cb.checked = !!on;
    row.classList.toggle('padder-selected', !!(cb && cb.checked));
    if (cb) animateSelection(row);
  }

  function applyPlanSelections(ids, { replace = false } = {}) {
    if (replace) {
      selected.clear();
      $$(SEL.rows).forEach(row => {
        row.classList.remove('padder-selected');
        const cb = row.querySelector('td.padder-cell input');
        if (cb) cb.checked = false;
      });
    }
    const list = Array.isArray(ids) ? ids : [];
    const planIds = replace ? new Set() : null;
    for (const rawId of list) {
      const pid = Number(rawId);
      if (!pid) continue;
      if (planIds) planIds.add(pid);
      const row = findRowByPid(pid);
      const code = row ? (codeFromRow(row) || `#${pid}`) : `#${pid}`;
      const prev = selected.get(pid);
      if (!prev) {
        selected.set(pid, code);
      } else if (typeof prev === 'string' && prev.startsWith('#') && code && !code.startsWith('#')) {
        selected.set(pid, code);
      }
      ensureRowSelection(pid, true);
    }
    if (replace && planIds && planIds.size && pendingSelected.size) {
      let pendingChanged = false;
      for (const pid of [...pendingSelected.keys()]) {
        const num = Number(pid);
        if (num && planIds.has(num)) {
          pendingSelected.delete(pid);
          pendingChanged = true;
        }
      }
      if (pendingChanged) {
        persistPending();
      }
    }
    if (replace && pendingSelected.size) {
      for (const [rawPid, rawCode] of pendingSelected) {
        const pid = Number(rawPid);
        if (!pid) continue;
        const code = rawCode || `#${pid}`;
        selected.set(pid, code);
        ensureRowSelection(pid, true);
      }
    }
    persist();
    syncHeader();
    count();
  }

  function toggleButton() {
    const host = $('.ui.grid .row .four.wide.right.aligned.column') || document.body;
    if ($('#plan-toggle', host)) return;
    const btn = document.createElement('button');
    btn.id = 'plan-toggle'; btn.className = 'ui mini button'; btn.style.marginLeft = '8px';
    btn.textContent = modeOn ? '退出【添加计划】模式' : '进入【添加计划】模式';
    btn.onclick = () => { modeOn ? exitMode() : enterMode(); btn.textContent = modeOn ? '退出【添加计划】模式' : '进入【添加计划】模式'; };
    host.appendChild(btn);
  }

  function insertSelectColumn() {
    _codeColIdx = null; // 表头可能变化，先失效缓存

    const tr = $(SEL.thead);
    if (tr && !$('#padder-th', tr)) {
      const th = document.createElement('th');
      th.id = 'padder-th'; th.className = 'collapsing'; th.style.whiteSpace = 'nowrap';
      th.innerHTML = `<label title="本页全选"><input id="padder-all" type="checkbox" style="vertical-align:middle;"><span style="margin-left:4px;font-weight:normal;">全选</span></label>`;
      tr.prepend(th);
      $('#padder-all').onchange = e => {
        const on = e.target.checked;
        $$(SEL.rows).forEach(row => {
          const pid = +pidFromRow(row); if (!pid || isLProblemRow(row)) return;
          let cell = row.querySelector('td.padder-cell');
          if (!cell) { cell = makeCell(row, pid); if (cell) row.prepend(cell); }
          if (!cell) return;
          const cb = cell.firstChild; cb.checked = on;
          toggleSelect(row, pid, on, true);
        });
        count();
      };
    }
    $$(SEL.rows).forEach(row => {
      const pid = +pidFromRow(row); if (!pid) { row.querySelector('td.padder-cell')?.remove(); return; }
      if (!row.querySelector('td.padder-cell')) {
        const cell = makeCell(row, pid); if (cell) row.prepend(cell);
      }
      attachRowToggle(row);
      const on = selected.has(pid);
      const cb = row.querySelector('td.padder-cell input');
      if (cb) { cb.checked = on; }
      row.classList.toggle('padder-selected', on);
    });
    syncHeader();
  }
  function handlePlanRowClick(event, row) {
    if (!modeOn || event.defaultPrevented || event.button !== 0) return false;
    if (event[PADDER_HANDLED_FLAG]) return true;
    if (event.target?.closest?.('td.padder-cell')) return false;
    const pid = Number(pidFromRow(row));
    if (!pid || isLProblemRow(row)) return false;
    const cb = row.querySelector('td.padder-cell input');
    if (!cb) return false;
    const interactive = event.target?.closest?.('a,button,input,select,textarea,label');
    const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (interactive && interactive !== cb) {
      if (hasModifier) return false;
      if (interactive.matches?.('a[href]')) return false;
      event.preventDefault();
      event.stopPropagation();
    }
    event[PADDER_HANDLED_FLAG] = true;
    const next = !cb.checked;
    cb.checked = next;
    toggleSelect(row, pid, next, false);
    count();
    return true;
  }
  function attachRowToggle(row) {
    if (!row || row.dataset.padderToggleBound) return;
    row.dataset.padderToggleBound = '1';
    row.addEventListener('click', event => {
      if (event[PADDER_HANDLED_FLAG]) return;
      handlePlanRowClick(event, row);
    });
  }
  document.addEventListener('click', event => {
    if (!modeOn || event.defaultPrevented || event.button !== 0) return;
    if (event[PADDER_HANDLED_FLAG]) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target?.closest?.('td.padder-cell')) return;
    const row = event.target?.closest?.(SEL.rows);
    if (!row) return;
    handlePlanRowClick(event, row);
  }, true);
  function makeCell(row, pid) {
    const td = document.createElement('td');
    td.className = 'padder-cell'; td.style.textAlign = 'center'; td.style.padding = '6px';
    td.innerHTML = `<input type="checkbox" style="vertical-align:middle;">`;
    const cb = td.firstChild;
    cb.checked = selected.has(pid);
    cb.onchange = () => { toggleSelect(row, pid, cb.checked, false); count(); };
    row.classList.toggle('padder-selected', cb.checked);
    return td;
  }
  function animateSelection(row) {
    if (!row) return;
    row.classList.remove('padder-animate');
    void row.offsetWidth;
    row.classList.add('padder-animate');
  }
  function toggleSelect(row, pid, on, fromHeader) {
    const pidNum = Number(pid) || Number(pidFromRow(row));
    const key = pidNum || pid;
    const code = codeFromRow(row) || `#${pidNum || pid}`;
    if (on) selected.set(key, code); else selected.delete(key);
    if (pidNum) {
      if (on) pendingSelected.set(pidNum, code);
      else pendingSelected.delete(pidNum);
      persistPending();
    }
    row.classList.toggle('padder-selected', on);
    animateSelection(row);
    if (!fromHeader) syncHeader();
    persist();
  }
  function syncHeader() {
    const h = $('#padder-all'); if (!h) return;
    const ids = $$(SEL.rows)
      .filter(r => !isLProblemRow(r))
      .map(pidFromRow)
      .filter(Boolean)
      .map(Number);
    h.checked = ids.length && ids.every(id => selected.has(id));
  }

  function clearSelections(options = {}) {
    const {
      preservePending = false,
      preserveSelected = false,
      clearAll = false
    } = options;

    const pendingKeys = new Set(pendingSelected.keys());

    if (clearAll) {
      selected.clear();
    } else {
      for (const key of pendingKeys) {
        const pid = Number(key);
        const mapKey = Number.isNaN(pid) ? key : pid;
        selected.delete(mapKey);
        selected.delete(String(mapKey));
      }
    }

    if (!preservePending) {
      pendingSelected.clear();
    }

    persistPending();

    if (!preserveSelected) {
      persist();
    }

    if (clearAll) {
      $$('.padder-cell input').forEach(cb => cb.checked = false);
      $$(SEL.rows).forEach(r => r.classList.remove('padder-selected'));
    } else {
      for (const key of pendingKeys) {
        const row = findRowByPid(key);
        if (!row) continue;
        const cb = row.querySelector('td.padder-cell input');
        if (cb) cb.checked = false;
        row.classList.remove('padder-selected');
      }
    }

    syncHeader();
    count();
  }

  function toolbar() {
    if ($('#plan-bar')) return;
    const bar = document.createElement('div'); bar.id = 'plan-bar';
    bar.innerHTML = `
      <div class="padder">
        <span id="pad-handle" title="拖拽">⠿</span>
        <label>日期：<input type="date" id="pad-date"></label>
        <button class="ui mini button" id="pad-copy">复制编号</button>
        <button class="ui mini button" id="pad-clear">清空</button>
        <button class="ui mini red button" id="pad-delete-all">删除所有计划</button>
        <button class="ui mini primary button" id="pad-ok">确定（<span id="pad-count">0</span>）</button>
      </div>`;
    document.body.appendChild(bar);

    GM_addStyle(`
      #plan-bar{position:fixed;right:16px;bottom:120px;z-index:9999;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-width:calc(100vw - 32px);}
      #plan-bar .padder{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;white-space:nowrap;}
      #plan-bar .padder>*{flex:0 0 auto;}
      #pad-handle{cursor:move;opacity:.7}
      th#padder-th,td.padder-cell{width:46px;}
      .padder-selected{background:rgba(0,150,255,.06)!important;transition:background-color .24s ease;}
      .padder-animate{animation:padder-pulse .45s ease;}
      @keyframes padder-pulse{0%{box-shadow:0 0 0 0 rgba(0,150,255,0);transform:scale(1);}40%{box-shadow:0 0 0 6px rgba(0,150,255,.18);transform:scale(1.01);}100%{box-shadow:0 0 0 0 rgba(0,150,255,0);transform:scale(1);}}
    `);

    const date = $('#pad-date');
    const tomorrow = tomorrowISO();
    date.min = tomorrow;
    date.value = GM_getValue(KEY.date, tomorrow);
    if (date.value < tomorrow) date.value = tomorrow;
    currentDateIso = date.value;
    maybeAdoptLegacySelection(currentDateIso);
    selected = selectionFor(currentDateIso);
    insertSelectColumn();
    persist();
    pendingSelected = pendingFor(currentDateIso);
    if (pendingSelected.size) {
      let changed = false;
      for (const [pid, code] of pendingSelected) {
        const pidNum = Number(pid);
        if (!pidNum) continue;
        if (!selected.has(pidNum)) { selected.set(pidNum, code); changed = true; }
        ensureRowSelection(pidNum, true);
      }
      if (changed) persist();
      syncHeader();
      count();
    }
    const initSync = syncExistingPlan(currentDateIso, { force: true, silent: true });
    if (initSync && typeof initSync.catch === 'function') {
      initSync.catch(err => log('initial sync failed', err));
    }
    date.onchange = async () => {
      if (date.value < tomorrow) date.value = tomorrow;
      GM_setValue(KEY.date, date.value);
      const newIso = date.value;
      const oldIso = currentDateIso;
      const changed = newIso !== currentDateIso;
      const previousPending = changed ? new Map(pendingSelected) : null;
      if (changed) clearSelections({ preservePending: true, preserveSelected: true, clearAll: true });
      currentDateIso = newIso;
      maybeAdoptLegacySelection(newIso);
      selected = selectionFor(newIso);
      insertSelectColumn();
      persist();
      pendingSelected = pendingFor(newIso);
      if (changed && previousPending && previousPending.size) {
        if (oldIso) persistPendingFor(oldIso, new Map());
        for (const [pid, code] of previousPending) {
          const pidNum = Number(pid);
          if (!pidNum) continue;
          pendingSelected.set(pidNum, code);
        }
        persistPendingFor(newIso, pendingSelected);
        pendingSelected = pendingFor(newIso);
      }
      if (pendingSelected.size) {
        let changedSelections = false;
        for (const [pid, code] of pendingSelected) {
          const pidNum = Number(pid);
          if (!pidNum) continue;
          if (!selected.has(pidNum)) { selected.set(pidNum, code); changedSelections = true; }
          ensureRowSelection(pidNum, true);
        }
        if (changedSelections) persist();
        syncHeader();
        count();
      }
      await syncExistingPlan(newIso, { force: true });
    };
    $('#pad-copy').onclick = () => { GM_setClipboard(JSON.stringify({ date: date.value, codes: [...selected.values()] }, null, 2)); notify(`已复制 ${selected.size} 个编号`); };
    $('#pad-clear').onclick = () => { if (!selected.size || !confirm('确认清空？')) return; clearSelections(); };
    $('#pad-delete-all').onclick = deleteAllPlans;
    $('#pad-ok').onclick = submitPlan;

    count();
    const pos = GM_getValue(KEY.barPos, null);
    if (pos) { bar.style.left = pos.left; bar.style.top = pos.top; bar.style.right = 'auto'; bar.style.bottom = 'auto'; }
    drag(bar, $('#pad-handle'));
  }
  function count() { const el = $('#pad-count'); if (el) el.textContent = selected.size; }
  function drag(el, handle) {
    let sx, sy, sl, st, d = false;
    handle.onmousedown = e => {
      d = true; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); sl = r.left; st = r.top;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      window.onmousemove = ev => { if (!d) return; const L = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, sl + ev.clientX - sx)); const T = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, st + ev.clientY - sy)); el.style.left = L + 'px'; el.style.top = T + 'px'; };
      window.onmouseup = () => { d = false; window.onmousemove = null; window.onmouseup = null; GM_setValue(KEY.barPos, { left: el.style.left, top: el.style.top }); };
      e.preventDefault();
    };
  }

  function observe() {
    const root = $(SEL.tbody) || document.body;
    observer?.disconnect();
    observer = new MutationObserver(() => { if (modeOn) insertSelectColumn(); });
    observer.observe(root, { childList: true, subtree: true });
  }

  function gmFetch(opts) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        ...opts, withCredentials: true,
        onload: r => {
          log(opts.method || 'GET', opts.url, r.status, (r.responseText || '').slice(0, 160));
          r.status >= 200 && r.status < 300 ? res(r) : rej(new Error(`HTTP ${r.status}: ${(r.responseText || '').slice(0, 200)}`));
        },
        onerror: e => rej(new Error(e.error || '网络错误'))
      });
    });
  }

  async function fetchPlanJSON({ uid, epoch }) {
    const r = await gmFetch({
      url: CFG.base + `/user_plan?user_id=${uid}&date=${epoch}&type=day&format=json`,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Referer': `${CFG.base}/user_plans/${uid}`
      }
    });
    let j = {};
    try { j = JSON.parse(r.responseText || '{}'); } catch { }
    const up = j.user_plan || {};
    const arr = String(up.problem_ids || '')
      .split(/[|,\s]+/)
      .map(x => Number(x))
      .filter(Boolean);
    return { id: up.id || up.plan_id || '', problemIds: arr };
  }

  async function syncExistingPlan(dateIso, { force = false, silent = false } = {}) {
    if (!dateIso) return null;
    const uid = getCurrentUserId();
    if (!uid) return null;
    const requestId = ++planRequestToken;
    const epoch = dateToEpoch(dateIso, CFG.tzOffsetHours);
    let meta = planCache.get(dateIso);
    if (!meta || force) {
      try {
        meta = await fetchPlanJSON({ uid, epoch });
        planCache.set(dateIso, { ...meta, epoch });
      } catch (err) {
        log('syncExistingPlan: fetch failed', err);
        if (requestId === planRequestToken && !silent) notify('[错误代码 D1] 未能读取计划，请稍后重试');
        return null;
      }
    }
    if (requestId !== planRequestToken) return meta || null;
    applyPlanSelections((meta && Array.isArray(meta.problemIds)) ? meta.problemIds : [], { replace: true });
    return meta;
  }

  function buildBody({ id, epoch, uid, values }) {
    const p = new URLSearchParams();
    if (id) p.set('id', String(id));
    p.set('type', 'day');
    p.set('date', String(epoch));
    p.set('user_id', String(uid));
    p.set('plan', ''); p.set('result', ''); p.set('tweak', '');
    p.set('problem_ids', values.join(CFG.DELIM));  // 用 | 分隔的数字ID
    return p.toString();
  }

  function postPlan(body, uid) {
    return gmFetch({
      url: CFG.base + '/user_plan',
      method: 'POST',
      data: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Origin': CFG.base,
        'Referer': `${CFG.base}/user_plans/${uid}`
      }
    });
  }

  function afterSuccess() {
    if (autoExit) {
      clearSelections({ clearAll: true });
      exitMode();
    }
  }

  async function deleteAllPlans() {
    const iso = $('#pad-date')?.value || tomorrowISO();
    currentDateIso = iso;
    const epoch = dateToEpoch(iso, CFG.tzOffsetHours);
    const uid = getCurrentUserId();
    if (!uid) { notify('[错误代码 DA1] 无法识别 user_id'); return; }

    let meta;
    try {
      meta = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...meta, epoch });
    } catch (err) {
      log('deleteAllPlans: fetch existing plan failed', err);
      notify('[错误代码 DA2] 获取已有计划失败，请稍后再试');
      return;
    }

    const hasServerPlan = Array.isArray(meta.problemIds) && meta.problemIds.length > 0;
    const hasLocalPlan = selected.size > 0 || pendingSelected.size > 0;

    if (!hasServerPlan && !hasLocalPlan && !meta.id) {
      clearSelections({ clearAll: true });
      planCache.set(iso, { ...meta, epoch, problemIds: [] });
      notify(`当前 ${iso} 无计划可删除`);
      return;
    }

    if (!confirm(`确认删除 ${iso} 的所有计划？此操作无法恢复。`)) return;

    if (!hasServerPlan && !meta.id) {
      clearSelections({ clearAll: true });
      planCache.set(iso, { ...meta, epoch, problemIds: [] });
      notify(`已删除 ${iso} 的所有计划`);
      showPlanToast(`计划删除完成\n已清空 ${iso} 的所有题目`);
      return;
    }

    try {
      const body = buildBody({ id: meta.id, epoch, uid, values: [] });
      await postPlan(body, uid);
      const after = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...after, epoch });
      const cleared = !Array.isArray(after.problemIds) || after.problemIds.length === 0;
      if (cleared) {
        clearSelections({ clearAll: true });
        notify(`已删除 ${iso} 的所有计划`);
        showPlanToast(`计划删除完成\n已清空 ${iso} 的所有题目`);
        return;
      }
    } catch (err) {
      log('deleteAllPlans: delete failed', err);
    }

    notify('[错误代码 DA3] 未能删除计划，请稍后再试');
  }

  async function submitPlan() {
    const iso = $('#pad-date')?.value || tomorrowISO();
    currentDateIso = iso;
    const epoch = dateToEpoch(iso, CFG.tzOffsetHours);
    const uid = getCurrentUserId();
    if (!uid) { notify('[错误代码 B1] 无法识别 user_id'); return; }

    const rawSelectedKeys = [...selected.keys()];
    const selectedIds = rawSelectedKeys.map(Number).filter(Boolean);
    if (!selectedIds.length && selected.size) {
      notify('[错误代码 B2] 未解析到数字ID');
      return;
    }

    let meta;
    try {
      meta = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...meta, epoch });
    } catch (err) {
      log('submitPlan: fetch existing plan failed', err);
      notify('[错误代码 B3] 获取已有计划失败，请稍后再试');
      return;
    }

    const baseList = Array.isArray(meta.problemIds) ? meta.problemIds.map(Number).filter(Boolean) : [];
    const baseSet = new Set(baseList);
    const selectedSet = new Set(selectedIds);

    if (!selectedSet.size && !baseSet.size) {
      notify('[提示] 当前无题目可提交');
      return;
    }

    const desired = [];
    const seen = new Set();
    for (const id of baseList) {
      if (selectedSet.has(id) && !seen.has(id)) { desired.push(id); seen.add(id); }
    }
    for (const id of selectedIds) {
      if (!seen.has(id)) { desired.push(id); seen.add(id); }
    }

    const addedCount = desired.filter(id => !baseSet.has(id)).length;
    const removedCount = baseList.filter(id => !selectedSet.has(id)).length;
    const confirmMsg = `将提交 ${desired.length} 个题目（新增 ${addedCount} 个，移除 ${removedCount} 个）到 ${iso}？`;
    if (!confirm(confirmMsg)) return;

    const planId = meta.id;

    try {
      const body = buildBody({ id: planId, epoch, uid, values: desired });
      await postPlan(body, uid);
      const after = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...after, epoch });
      const ok = Array.isArray(after.problemIds)
        && desired.length === after.problemIds.length
        && desired.every((x, i) => after.problemIds[i] === x);
      if (ok) {
        pendingSelected.clear();
        persistPending();
        if (!autoExit) applyPlanSelections(after.problemIds || [], { replace: true });
        const successMsg = `保存成功：新增 ${addedCount} 题，移除 ${removedCount} 题，共 ${desired.length} 题`;
        notify(successMsg);
        showPlanToast(`计划修改完成\n${successMsg}`);
        afterSuccess();
        return;
      }
    } catch (e) { }

    const removedList = baseList.filter(id => !selectedSet.has(id));

    // 逐条同步，优先移除再补充
    try {
      let workingSet = new Set(baseList);
      let workingPlanId = planId;
      let latest = meta;

      for (const id of removedList) {
        if (!workingSet.has(id)) continue;
        workingSet.delete(id);
        const body2 = buildBody({ id: workingPlanId, epoch, uid, values: [...workingSet] });
        await postPlan(body2, uid);
        latest = await fetchPlanJSON({ uid, epoch });
        workingSet = new Set(latest.problemIds || []);
        workingPlanId = latest.id || workingPlanId;
      }

      for (const id of desired) {
        if (workingSet.has(id)) continue;
        workingSet.add(id);
        const body3 = buildBody({ id: workingPlanId, epoch, uid, values: [...workingSet] });
        await postPlan(body3, uid);
        latest = await fetchPlanJSON({ uid, epoch });
        workingSet = new Set(latest.problemIds || []);
        workingPlanId = latest.id || workingPlanId;
      }

      const bodyFinal = buildBody({ id: latest.id || workingPlanId, epoch, uid, values: desired });
      await postPlan(bodyFinal, uid);
      const final = await fetchPlanJSON({ uid, epoch });
      planCache.set(iso, { ...final, epoch });
      const ok2 = Array.isArray(final.problemIds)
        && desired.length === final.problemIds.length
        && desired.every((x, i) => final.problemIds[i] === x);
      if (ok2) {
        pendingSelected.clear();
        persistPending();
        if (!autoExit) applyPlanSelections(final.problemIds || [], { replace: true });
        const successMsg2 = `保存成功（逐条同步）：新增 ${addedCount} 题，移除 ${removedCount} 题，共 ${desired.length} 题`;
        notify(successMsg2);
        showPlanToast(`计划修改完成\n${successMsg2}`);
        afterSuccess();
        return;
      }
    } catch (e) { }

    notify('[错误代码 C1] 提交未生效');
  }

  /* ========= 模式切换 ========= */
  function enterMode() {
    modeOn = true; GM_setValue(KEY.mode, true); insertSelectColumn(); toolbar(); observe();
    const b = $('#plan-toggle'); if (b) b.textContent = '退出【添加计划】';
  }
  function exitMode() {
    modeOn = false; GM_setValue(KEY.mode, false);
    $('#plan-bar')?.remove(); $('#padder-th')?.remove();
    $$(SEL.rows).forEach(r => { r.classList.remove('padder-selected'); r.querySelector('td.padder-cell')?.remove(); });
    const b = $('#plan-toggle'); if (b) b.textContent = '进入【添加计划】';
  }

  /* ========= 启动 ========= */
  patchDatePicker();
  const onTagPage = /\/problems\/tag\//.test(location.pathname);
  (function start() {
    if (enablePlanAdder && onTagPage) {
      toggleButton();
      if (modeOn) enterMode();
    } else {
      modeOn = false; GM_setValue(KEY.mode, false);
    }
  })();

})();

/* === BN PATCH: user menu animation + shadow === */
(function () {
  const css = `
  #bn-user-menu {
    opacity: 0 !important;
    transform: translateY(2px) scale(0.98) !important;
    transform-origin: left top !important;
    transition: opacity 133ms cubic-bezier(.2,0,0,1), transform 133ms cubic-bezier(.2,0,0,1) !important;
    will-change: opacity, transform;
    /* Native-like layered shadow */
    box-shadow:
      0 12px 28px rgba(0,0,0,.20),
      0 6px 16px rgba(0,0,0,.18),
      0 2px 4px rgba(0,0,0,.12) !important;
  }
  #bn-user-menu.bn-show {
    opacity: 1 !important;
    transform: translateY(0) scale(1) !important;
  }
  @media (prefers-color-scheme: dark) {
    #bn-user-menu {
      background: #1f1f1f !important;
      color: #eaeaea !important;
      border-color: rgba(255,255,255,.08) !important;
      box-shadow:
        0 12px 28px rgba(0,0,0,.45),
        0 6px 16px rgba(0,0,0,.35),
        0 2px 4px rgba(0,0,0,.25) !important;
    }
    #bn-user-menu a { color: #eaeaea !important; }
    #bn-user-menu a:hover { background: rgba(255,255,255,.08) !important; }
  }`;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
})();

/* =================================================================
 *  榜单页：学校筛选
 * ================================================================= */
(function () {
  'use strict';

  const PATH_RE = /^\/progress\/quiz/;
  if (!PATH_RE.test(location.pathname)) return;

  const TABLE_SELECTORS = [
    '.progress-table table',
    '.progress-container table',
    '.contest-table table',
    'table.ui.table',
    'table.table'
  ];

  const collator = (typeof Intl !== 'undefined' && typeof Intl.Collator === 'function')
    ? new Intl.Collator(['zh-Hans-CN', 'zh-CN', 'zh', 'zh-Hans'], { sensitivity: 'base', usage: 'sort' })
    : null;
  const FALLBACK_SCHOOL_NAME = '其他';
  const FALLBACK_GRADE_NAME = '未填写时年';

  let cssInjected = false;
  let filterInitPromise = null;
  const RANKING_FILTER_ENABLED_KEY = 'rankingFilter.enabled';
  const RANKING_FILTER_SELECTED_KEY = 'rankingFilter.selected';
  const RANKING_FILTER_GRADE_KEY = 'rankingFilter.grade.selected';

  function injectCSS() {
    if (cssInjected) return;
    const css = `
    .bn-ranking-filter.ui.segment { margin-bottom: 1.5em; }
    .bn-ranking-filter .bn-filter-header { display: flex; align-items: center; justify-content: space-between; gap: .75em; flex-wrap: wrap; }
    .bn-ranking-filter .bn-filter-title { font-weight: 600; font-size: 1.05em; }
    .bn-ranking-filter .bn-filter-summary { margin-top: .5em; font-size: .9em; color: rgba(0,0,0,.6); }
    .bn-ranking-filter .bn-filter-summary.bn-active { color: #2185d0; font-weight: 600; }
    .bn-ranking-filter .bn-filter-count { margin-top: .25em; font-size: .85em; color: rgba(0,0,0,.5); }
    .bn-filter-group { margin-top: .75em; }
    .bn-filter-group-title { font-weight: 600; font-size: .95em; color: rgba(0,0,0,.55); }
    .bn-filter-options { display: flex; margin-top: .35em; gap: .35em 1.25em; flex-wrap: wrap; }
    .bn-filter-options label { display: inline-flex; align-items: center; gap: .4em; padding: .2em .4em; border-radius: .3em; cursor: pointer; }
    .bn-filter-options label:hover { background: rgba(33,133,208,.08); }
    .bn-filter-options input[type="checkbox"] { width: 16px; height: 16px; margin: 0; }
    .bn-filter-actions { margin-top: .75em; display: flex; gap: .5em; flex-wrap: wrap; }
    .bn-filter-actions .ui.button { flex-shrink: 0; }
    .bn-filter-hide { display: none !important; }
    @media (max-width: 640px) {
      .bn-filter-options { flex-direction: column; align-items: flex-start; }
      .bn-filter-actions { flex-direction: column; align-items: stretch; }
    }`;
    if (typeof GM_addStyle === 'function') GM_addStyle(css);
    else {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
    cssInjected = true;
  }

  function getText(node) {
    return (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function findTable(root = document) {
    for (const selector of TABLE_SELECTORS) {
      const table = root.querySelector(selector);
      if (table && table.tBodies && table.tBodies.length) return table;
    }
    const tables = root.querySelectorAll('table');
    for (const table of tables) {
      if (table && table.tBodies && table.tBodies.length) return table;
    }
    return null;
  }

  function waitForTable(timeout = 12000) {
    const existing = findTable();
    if (existing) return Promise.resolve(existing);
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const table = findTable();
        if (table) {
          observer.disconnect();
          resolve(table);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(findTable());
      }, timeout);
    });
  }

  function getCellValue(row, index) {
    if (!row || typeof index !== 'number' || index < 0) return '';
    const cell = row.cells && row.cells[index];
    if (!cell) return '';
    return getText(cell);
  }

  function isHeaderCell(row, index, headerText) {
    if (!row || typeof index !== 'number' || index < 0) return false;
    const cell = row.cells && row.cells[index];
    if (!cell) return false;
    const tag = (cell.tagName || '').toUpperCase();
    if (tag === 'TH') return true;
    const value = getText(cell);
    return !!headerText && value === headerText;
  }

  function annotateRow(row, schoolIndex, schoolHeaderText, gradeIndex, gradeHeaderText) {
    if (!row) return;
    const header = isHeaderCell(row, schoolIndex, schoolHeaderText)
      || isHeaderCell(row, gradeIndex, gradeHeaderText);
    if (header) row.dataset.bnHeaderRow = '1';
    else delete row.dataset.bnHeaderRow;

    if (typeof schoolIndex === 'number' && schoolIndex >= 0) {
      const value = header ? '' : getCellValue(row, schoolIndex) || FALLBACK_SCHOOL_NAME;
      row.dataset.bnSchool = value;
    } else {
      delete row.dataset.bnSchool;
    }

    if (typeof gradeIndex === 'number' && gradeIndex >= 0) {
      const value = header ? '' : getCellValue(row, gradeIndex) || FALLBACK_GRADE_NAME;
      row.dataset.bnGrade = value;
    } else {
      delete row.dataset.bnGrade;
    }
  }

  function isHeaderRow(row) {
    if (!row || !row.cells || !row.cells.length) return false;
    return Array.from(row.cells).every(cell => (cell.tagName || '').toUpperCase() === 'TH');
  }

  function collectRows(table) {
    const rows = [];
    if (!table || !table.tBodies) return rows;
    Array.from(table.tBodies).forEach(tbody => {
      rows.push(...Array.from(tbody.rows || []).filter(row => !isHeaderRow(row)));
    });
    return rows;
  }

  function detectSchoolColumn(table) {
    if (!table) return -1;
    const headers = table.querySelectorAll('thead th, th');
    for (let i = 0; i < headers.length; i += 1) {
      const text = getText(headers[i]);
      if (/学校|院校|单位|School/i.test(text)) return i;
    }
    const firstRow = table.tBodies && table.tBodies[0] && table.tBodies[0].rows[0];
    if (firstRow) {
      const cells = Array.from(firstRow.cells || []);
      for (let i = 0; i < cells.length; i += 1) {
        const text = getText(cells[i]);
        if (/大学|学院|学校|中学/.test(text)) return i;
      }
    }
    return -1;
  }

  function detectGradeColumn(table) {
    if (!table) return -1;
    const headers = table.querySelectorAll('thead th, th');
    for (let i = 0; i < headers.length; i += 1) {
      const text = getText(headers[i]);
      if (/时年|年级|年紀|年級|Grade/i.test(text)) return i;
    }
    const firstRow = table.tBodies && table.tBodies[0] && table.tBodies[0].rows[0];
    if (firstRow) {
      const cells = Array.from(firstRow.cells || []);
      for (let i = 0; i < cells.length; i += 1) {
        const text = getText(cells[i]);
        const className = cells[i].className || '';
        if (/时年|年级|年紀|年級|高一|高二|高三|初一|初二|初三|小学|一年级|二年级|Grade/i.test(text)) return i;
        if (/\bgrade\b/i.test(className) || /grade_\d+/i.test(className)) return i;
      }
    }
    return -1;
  }

  function uniqueSorted(values) {
    const arr = Array.from(new Set(values.filter(Boolean)));
    if (!arr.length) return arr;
    if (collator) return arr.sort((a, b) => collator.compare(a, b));
    return arr.sort((a, b) => a.localeCompare(b));
  }

  // Custom grade sorter: try to order grades from youngest -> oldest
  // e.g. 小一..小学.. -> 初一..初三 -> 高一..高三 -> 大一..大四 -> 毕业 / other
  function sortGrades(values) {
    const arr = Array.from(new Set(values.filter(Boolean)));
    if (!arr.length) return arr;

    const chineseMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

    function extractNum(s) {
      if (!s) return null;
      // try arabic numbers first
      const m = s.match(/(\d{1,4})/);
      if (m) return Number(m[1]);
      // try chinese numerals like 小五 初三
      const mc = s.match(/[一二三四五六七八九十]+/);
      if (mc) {
        const chars = mc[0].split('');
        // handle simple up to 10
        let v = 0;
        if (chars.length === 1) return chineseMap[chars[0]] || null;
        // rudimentary handling for 十, e.g. 十一
        for (let i = 0; i < chars.length; i++) v += chineseMap[chars[i]] || 0;
        return v || null;
      }
      return null;
    }

    function gradeKey(s) {
      const text = (s || '').trim();
      // level order: 小(小学) -> 初(初中) -> 高(高中) -> 大(大学) -> 毕业 -> 教练 -> 其他
      let level = 6;
      if (/小|小学|小学部/.test(text)) level = 0;
      else if (/初|初中|初级/.test(text)) level = 1;
      else if (/高|高中|高级/.test(text)) level = 2;
      else if (/大|大学|本科/.test(text)) level = 3;
      else if (/毕业|已毕业/.test(text)) level = 4;
      else if (/教练|老师|教师/.test(text)) level = 5;

      const num = extractNum(text);
      // For cohort-like labels such as "2022级", try to invert order so lower grade (more recent) considered younger
      // but keep numeric if it's small (<=12) as grade number
      let numKey = null;
      if (num != null) {
        if (num <= 12) numKey = num; // typical grade numbers
        else numKey = num; // fallback: large numbers will still be compared
      }
      return { level, num: numKey, raw: text };
    }

    arr.sort((a, b) => {
      const A = gradeKey(a);
      const B = gradeKey(b);
      if (A.level !== B.level) return A.level - B.level;
      if (A.num != null && B.num != null) return A.num - B.num;
      if (A.num != null) return -1;
      if (B.num != null) return 1;
      // fallback to locale compare
      if (collator) return collator.compare(A.raw, B.raw);
      return (A.raw || '').localeCompare(B.raw || '');
    });
    return arr;
  }

  function applyFilter(table, state) {
    const rows = collectRows(table).filter(row => row.dataset?.bnHeaderRow !== '1');
    const total = rows.length;
    if (!total) return { visible: 0, total: 0, summary: '暂无数据', active: false };
    if (!state.enabled) {
      rows.forEach(row => row.classList.remove('bn-filter-hide'));
      return { visible: total, total, summary: '未启用筛选', active: false };
    }
    const hasSchoolFilter = state.schoolSelected && state.schoolSelected.size > 0;
    const hasGradeFilter = state.gradeSelected && state.gradeSelected.size > 0;
    if (!hasSchoolFilter && !hasGradeFilter) {
      rows.forEach(row => row.classList.remove('bn-filter-hide'));
      return { visible: total, total, summary: '未选择筛选条件，显示全部', active: false };
    }
    let visible = 0;
    rows.forEach(row => {
      const key = row.dataset?.bnSchool || FALLBACK_SCHOOL_NAME;
      const grade = row.dataset?.bnGrade || FALLBACK_GRADE_NAME;
      const matchSchool = !hasSchoolFilter || state.schoolSelected.has(key);
      const matchGrade = !hasGradeFilter || state.gradeSelected.has(grade);
      if (matchSchool && matchGrade) {
        row.classList.remove('bn-filter-hide');
        visible += 1;
      } else {
        row.classList.add('bn-filter-hide');
      }
    });
    const parts = [];
    if (hasSchoolFilter) parts.push(`学校：${Array.from(state.schoolSelected).join('、')}`);
    if (hasGradeFilter) parts.push(`时年：${Array.from(state.gradeSelected).join('、')}`);
    return {
      visible,
      total,
      summary: parts.length ? `已选${parts.join('；')}` : '未选择筛选条件，显示全部',
      active: true
    };
  }

  function csvEscape(value) {
    const text = (value || '').replace(/\r?\n|\r/g, ' ').trim();
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function buildCsvFileName() {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10).replace(/-/g, '');
    return `ranking-${iso}.csv`;
  }

  function exportVisibleRows(table) {
    const rows = collectRows(table).filter(row => row.dataset?.bnHeaderRow !== '1');
    if (!rows.length) return false;
    const headerRows = [];
    if (table.tHead && table.tHead.rows.length) {
      const head = table.tHead.rows[0];
      headerRows.push(Array.from(head.cells || []).map(cell => csvEscape(getText(cell))));
    }
    const bodyRows = rows
      .filter(row => !row.classList.contains('bn-filter-hide'))
      .map(row => Array.from(row.cells || []).map(cell => csvEscape(getText(cell))));
    if (!bodyRows.length) return false;
    const lines = [...headerRows, ...bodyRows].map(cols => cols.join(','));
    const content = '\ufeff' + lines.join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildCsvFileName();
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 0);
    return true;
  }

  function attachDownloadButton(table) {
    const button = document.querySelector('#table_download');
    if (!button) return null;
    if (button.classList) button.classList.add('ui', 'button', 'primary');
    if (!button.dataset.bnDownloadBound) {
      button.addEventListener('click', event => {
        const exported = exportVisibleRows(table);
        if (exported) {
          event.preventDefault();
        }
      });
      button.dataset.bnDownloadBound = '1';
    }
    return button;
  }

  function setupFilterUI(table, state, schools, grades) {
    injectCSS();
    const parent = table.parentElement || table;
    const panel = document.createElement('div');
    panel.className = 'ui segment bn-ranking-filter';
    panel.style.display = state.enabled && (schools.length || grades.length) ? '' : 'none';

    const header = document.createElement('div');
    header.className = 'bn-filter-header';
    const title = document.createElement('div');
    title.className = 'bn-filter-title';
    title.textContent = '榜单筛选';
    header.appendChild(title);
    panel.appendChild(header);

    const summary = document.createElement('div');
    summary.className = 'bn-filter-summary';
    summary.textContent = state.enabled ? '筛选已启用' : '未启用筛选';
    panel.appendChild(summary);

    const count = document.createElement('div');
    count.className = 'bn-filter-count';
    panel.appendChild(count);

    const schoolCheckboxRefs = [];
    const gradeCheckboxRefs = [];

    function createOptionGroup(titleText, options, checkboxRefs, type) {
      if (!options.length) return null;
      const group = document.createElement('div');
      group.className = 'bn-filter-group';
      const groupTitle = document.createElement('div');
      groupTitle.className = 'bn-filter-group-title';
      groupTitle.textContent = titleText;
      group.appendChild(groupTitle);
      const list = document.createElement('div');
      list.className = `bn-filter-options bn-${type}-select`;
      if (type === 'school') list.id = 'bn-school-select';
      if (type === 'grade') list.id = 'bn-grade-select';
      options.forEach(name => {
        const label = document.createElement('label');
        label.className = 'bn-filter-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        if (type === 'school') checkbox.dataset.school = name;
        if ((type === 'school' ? state.schoolSelected : state.gradeSelected).has(name)) checkbox.checked = true;
        label.append(checkbox, document.createTextNode(name));
        list.appendChild(label);
        checkboxRefs.push(checkbox);
      });
      group.appendChild(list);
      panel.appendChild(group);
      return list;
    }

    const schoolList = createOptionGroup('按学校', schools, schoolCheckboxRefs, 'school');
    const gradeList = createOptionGroup('按时年', grades, gradeCheckboxRefs, 'grade');

    if (!schools.length && !grades.length) {
      summary.textContent = '未找到可筛选的信息，暂无法筛选';
    }

    attachDownloadButton(table);

    if (parent && parent.insertBefore) parent.insertBefore(panel, table);
    else document.body.insertBefore(panel, document.body.firstChild);

    function syncCheckboxStates() {
      schoolCheckboxRefs.forEach(checkbox => {
        checkbox.checked = state.schoolSelected.has(checkbox.value);
        checkbox.disabled = !state.enabled;
      });
      gradeCheckboxRefs.forEach(checkbox => {
        checkbox.checked = state.gradeSelected.has(checkbox.value);
        checkbox.disabled = !state.enabled;
      });
    }

    function syncVisibility() {
      const visible = state.enabled && (schools.length > 0 || grades.length > 0);
      panel.style.display = visible ? '' : 'none';
    }

    function refresh() {
      syncCheckboxStates();
      const result = applyFilter(table, state);
      if (!schools.length && !grades.length) {
        summary.textContent = '未找到可筛选的信息，暂无法筛选';
        summary.classList.remove('bn-active');
        count.textContent = result.total ? `当前显示 ${result.visible} / ${result.total}` : '';
        return;
      }
      summary.textContent = result.summary;
      summary.classList.toggle('bn-active', !!result.active);
      count.textContent = result.total ? `当前显示 ${result.visible} / ${result.total}` : '';
    }

    function bindList(list, selectedSet, storageKey) {
      if (!list) return;
      list.addEventListener('change', event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
        if (!state.enabled) {
          target.checked = selectedSet.has(target.value);
          return;
        }
        if (target.checked) selectedSet.add(target.value);
        else selectedSet.delete(target.value);
        GM_setValue(storageKey, Array.from(selectedSet));
        refresh();
      });
    }

    bindList(schoolList, state.schoolSelected, RANKING_FILTER_SELECTED_KEY);
    bindList(gradeList, state.gradeSelected, RANKING_FILTER_GRADE_KEY);

    refresh();
    syncVisibility();

    return { panel, refresh, syncVisibility, syncCheckboxStates };
  }

  async function performRankingFilterInit() {
    injectCSS();
    const table = await waitForTable();
    if (!table) return;
    const schoolIndex = detectSchoolColumn(table);
    const gradeIndex = detectGradeColumn(table);
    const rows = collectRows(table);
    let schoolHeaderText = '';
    if (schoolIndex >= 0) {
      const headRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
      if (headRow && headRow.cells && headRow.cells[schoolIndex]) {
        schoolHeaderText = getText(headRow.cells[schoolIndex]);
      }
      if (!schoolHeaderText && table.tBodies && table.tBodies.length) {
        const maybeHeaderRow = table.tBodies[0].rows && table.tBodies[0].rows[0];
        if (maybeHeaderRow && maybeHeaderRow.cells && maybeHeaderRow.cells[schoolIndex]) {
          const candidateCell = maybeHeaderRow.cells[schoolIndex];
          const candidateText = getText(candidateCell);
          if ((candidateCell.tagName || '').toUpperCase() === 'TH' || /学校|院校|单位|School/i.test(candidateText)) {
            schoolHeaderText = candidateText;
          }
        }
      }
    }

    let gradeHeaderText = '';
    if (gradeIndex >= 0) {
      const headRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
      if (headRow && headRow.cells && headRow.cells[gradeIndex]) {
        gradeHeaderText = getText(headRow.cells[gradeIndex]);
      }
      if (!gradeHeaderText && table.tBodies && table.tBodies.length) {
        const maybeHeaderRow = table.tBodies[0].rows && table.tBodies[0].rows[0];
        if (maybeHeaderRow && maybeHeaderRow.cells && maybeHeaderRow.cells[gradeIndex]) {
          const candidateCell = maybeHeaderRow.cells[gradeIndex];
          const candidateText = getText(candidateCell);
          if ((candidateCell.tagName || '').toUpperCase() === 'TH' || /时年|年级|年紀|年級|Grade/i.test(candidateText)) {
            gradeHeaderText = candidateText;
          } 
        }
      }
    }

    rows.forEach(row => annotateRow(row, schoolIndex, schoolHeaderText, gradeIndex, gradeHeaderText));
    const schools = schoolIndex >= 0
      ? uniqueSorted(rows
        .filter(row => row.dataset?.bnHeaderRow !== '1')
        .map(row => row.dataset?.bnSchool || FALLBACK_SCHOOL_NAME))
      : [];
    const grades = gradeIndex >= 0
      ? sortGrades(rows
        .filter(row => row.dataset?.bnHeaderRow !== '1')
        .map(row => row.dataset?.bnGrade || FALLBACK_GRADE_NAME))
      : [];

    const savedSelectionRaw = GM_getValue(RANKING_FILTER_SELECTED_KEY, []);
    const savedSelection = Array.isArray(savedSelectionRaw)
      ? savedSelectionRaw
        .map(name => (typeof name === 'string' ? name.trim() : ''))
        .map(name => name || FALLBACK_SCHOOL_NAME)
        .filter(Boolean)
      : [];
    const dedupedSelection = Array.from(new Set(savedSelection));
    const validSelected = dedupedSelection.filter(name => schools.includes(name));
    if (validSelected.length !== dedupedSelection.length) {
      GM_setValue(RANKING_FILTER_SELECTED_KEY, validSelected);
    }

    const savedGradeRaw = GM_getValue(RANKING_FILTER_GRADE_KEY, []);
    const savedGrades = Array.isArray(savedGradeRaw)
      ? savedGradeRaw
        .map(name => (typeof name === 'string' ? name.trim() : ''))
        .map(name => name || FALLBACK_GRADE_NAME)
        .filter(Boolean)
      : [];
    const dedupedGrades = Array.from(new Set(savedGrades));
    const validGrades = dedupedGrades.filter(name => grades.includes(name));
    if (validGrades.length !== dedupedGrades.length) {
      GM_setValue(RANKING_FILTER_GRADE_KEY, validGrades);
    }

    const requestedEnabled = !!GM_getValue(RANKING_FILTER_ENABLED_KEY, false);
    const state = {
      enabled: requestedEnabled && (schools.length > 0 || grades.length > 0),
      requested: requestedEnabled,
      schoolSelected: new Set(validSelected),
      gradeSelected: new Set(validGrades)
    };

    setupFilterUI(table, state, schools, grades);
  }

  async function init() {
    if (filterInitPromise) return filterInitPromise;
    filterInitPromise = (async () => {
      try {
        await performRankingFilterInit();
      } finally {
        filterInitPromise = null;
      }
    })();
    return filterInitPromise;
  }

  async function reloadRankingFilter() {
    try {
      if (filterInitPromise) {
        await filterInitPromise.catch(() => {});
      }
    } catch (_) {
      // ignore
    }
    try {
      const panel = document.querySelector('.bn-ranking-filter');
      if (panel && panel.parentElement) panel.parentElement.removeChild(panel);
    } catch (err) {
      console.warn('[BN] Failed to remove existing ranking filter panel', err);
    }
    try {
      await init();
    } catch (err) {
      console.error('[BN] Ranking filter reload failed', err);
    }
  }

  window.__bnReloadRankingFilter = reloadRankingFilter;
  window.addEventListener('bn:reload-filter', () => {
    reloadRankingFilter();
  });

  init().catch(err => console.error('[BN] Ranking enhancement failed', err));
})();

/* === BN PATCH 2: user menu pure fade-in (no size change) + shadow fade === */
(function () {
  const css = `
  #bn-user-menu {
    opacity: 0 !important;
    box-shadow:
      0 12px 28px rgba(0,0,0,0.00),
      0 6px 16px rgba(0,0,0,0.00),
      0 2px 4px rgba(0,0,0,0.00) !important;
    transition:
      opacity 300ms cubic-bezier(.2,0,0,1),
      box-shadow 300ms cubic-bezier(.2,0,0,1) !important;
    will-change: opacity, box-shadow;
  }
  #bn-user-menu.bn-show {
    opacity: 1 !important;
    box-shadow:
      0 12px 28px rgba(0,0,0,.20),
      0 6px 16px rgba(0,0,0,.18),
      0 2px 4px rgba(0,0,0,.12) !important;
  }
  @media (prefers-color-scheme: dark) {
    #bn-user-menu {
      box-shadow:
        0 12px 28px rgba(0,0,0,0.00),
        0 6px 16px rgba(0,0,0,0.00),
        0 2px 4px rgba(0,0,0,0.00) !important;
    }
    #bn-user-menu.bn-show {
      box-shadow:
        0 12px 28px rgba(0,0,0,.45),
        0 6px 16px rgba(0,0,0,.35),
        0 2px 4px rgba(0,0,0,.25) !important;
    }
  }`;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
})();

