const BASE = (window.CFG && window.CFG.base) ? window.CFG.base : location.origin;

function sameOrigin(u) {
  try { return new URL(u, location.origin).origin === location.origin; } catch { return false; }
}
function fetchText(u, headers) {
  const opt = { headers: headers || {} };
  if (sameOrigin(u) || (typeof u === 'string' && u.indexOf('/') === 0)) opt.credentials = 'include';
  return fetch(u, opt).then(r => r.text());
}

function getUid() {
  const ud = document.querySelector('#user-dropdown');
  if (ud && ud.dataset && (ud.dataset.user_id || ud.dataset.userId)) return ud.dataset.user_id || ud.dataset.userId;
  const a1 = document.querySelector('#user-dropdown a[href^="/user/"]');
  const m1 = a1 && a1.getAttribute('href').match(/\/user\/(\d+)/);
  if (m1) return m1[1];
  const a2 = document.querySelector('a[href^="/user_plans/"]');
  const m2 = a2 && a2.getAttribute('href').match(/\/user_plans\/(\d+)/);
  if (m2) return m2[1];
  return null;
}

function parseItemList(html) {
  const m = html && html.match(/const\s+itemList\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return null;
  const raw = m[1];
  try { return JSON.parse(raw); }
  catch { try { return Function('"use strict";return (' + raw + ')')(); } catch { return null; } }
}

function userSeenAndAnyACFromList(list, uid) {
  if (!Array.isArray(list)) return { seen: false, anyAC: false };
  let seen = false, anyAC = false;
  for (let i = 0; i < list.length; i++) {
    const it = list[i] || {};
    const info = it.info || {}, res = it.result || {};
    if (Number(info.userId) !== Number(uid)) continue;
    seen = true;
    const score = typeof res.score === 'number' ? res.score : parseInt(res.score || 0, 10);
    if (res.result === 'Accepted' || score === 100) { anyAC = true; break; }
  }
  return { seen, anyAC };
}

function userSeenAndAnyACFromTable(html, uid) {
  const m = html && html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!m) return { seen: false, anyAC: false };
  let seen = false, anyAC = false;
  const rows = m[1].split(/<\/tr>/i);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.indexOf('/user/' + uid) === -1) continue;
    seen = true;
    if (/\bstatus\b[^>]*\baccepted\b/i.test(row) || />\s*Accepted\s*</i.test(row)) { anyAC = true; break; }
  }
  return { seen, anyAC };
}

async function hasAnyAcceptedAcrossAll(problemId) {
  const uid = getUid();
  if (!uid) return null;

  try {
    const urlOk = BASE + '/submissions?problem_id=' + encodeURIComponent(problemId)
      + '&submitter=' + encodeURIComponent(uid)
      + '&min_score=100&max_score=100&language=&status=';
    const hOk = await fetchText(urlOk, { 'X-Requested-With': 'XMLHttpRequest' });
    const listOk = parseItemList(hOk);
    if (listOk) {
      const r1 = userSeenAndAnyACFromList(listOk, uid);
      if (r1.seen) return true;
    } else {
      if (/class="[^"]*\bstatus\b[^"]*\baccepted\b[^"]*"/i.test(hOk) || />\s*Accepted\s*</i.test(hOk)) return true;
      if (new RegExp('/user/' + uid).test(hOk)) return false;
    }
  } catch {}

  try {
    const url = BASE + '/submissions?problem_id=' + encodeURIComponent(problemId);
    const html = await fetchText(url, { 'X-Requested-With': 'XMLHttpRequest' });
    const list = parseItemList(html);
    if (list) {
      const r2 = userSeenAndAnyACFromList(list, uid);
      if (r2.seen) return r2.anyAC;
    } else {
      const r3 = userSeenAndAnyACFromTable(html, uid);
      if (r3.seen) return r3.anyAC;
    }
  } catch {}

  return null;
}

export async function needWarn(problemId) {
  try {
    const passed = await hasAnyAcceptedAcrossAll(problemId);
    if (passed === true) return false;
    if (passed === false) return true;
  } catch {}

  try {
    const ph = await fetchText(BASE + '/problem/' + encodeURIComponent(problemId), { 'X-Requested-With': 'XMLHttpRequest' });
    if (/class="[^"]*check-need-button[^"]*"\s+data-href="\/submissions\?problem_id=\d+"/.test(ph)
      || /class="[^"]*check-need-button[^"]*"\s+data-href="\/problem\/\d+\/statistics/.test(ph)) {
      return true;
    }
  } catch {}

  return false;
}

export default needWarn;
