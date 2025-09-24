const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { loadGuardModule, makeLocation } = require('./helpers/load-guard');

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('hasSolved uses 100pt submissions as truth source', async () => {
  const calls = [];
  const fetchStub = async (url) => {
    calls.push(url);
    if (url.startsWith('/api/submissions')) {
      return {
        ok: true,
        json: async () => ({ items: [{}] }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  const { guard } = loadGuardModule({
    overrides: {
      fetch: fetchStub,
      location: makeLocation('http://example.com/'),
    },
  });
  assert.equal(await guard.hasSolved('123'), true);
  assert.equal(await guard.needWarn('123'), false);
  assert.equal(calls.length, 1);
});

test('needWarn returns true when no accepted submission exists', async () => {
  let calls = 0;
  const fetchStub = async (url) => {
    calls += 1;
    if (url.startsWith('/api/submissions')) {
      return {
        ok: true,
        json: async () => ({ items: [] }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  const { guard } = loadGuardModule({
    overrides: {
      fetch: fetchStub,
      location: makeLocation('http://example.com/submissions'),
    },
  });
  assert.equal(await guard.hasSolved('456'), false);
  assert.equal(await guard.needWarn('456'), true);
  assert.equal(calls, 1);
});

test('fallback accepted badge caches with shorter TTL', async () => {
  let now = 1700000000000;
  const FakeDate = class extends Date {
    static now() {
      return now;
    }
  };
  const fetchStub = async (url) => {
    if (url.startsWith('/api/submissions')) {
      throw new Error('primary failure');
    }
    if (url.startsWith('/problem/')) {
      return {
        ok: true,
        text: async () => '<div data-accepted="true">Accepted</div>',
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  const { guard, context } = loadGuardModule({
    overrides: {
      fetch: fetchStub,
      Date: FakeDate,
      location: makeLocation('http://example.com/problem/42/statistics'),
    },
  });
  assert.equal(await guard.hasSolved('789'), true);
  assert.equal(await guard.needWarn('789'), false);
  const cacheEntry = context.__bnUnifiedGuard.solveCache.get('789');
  assert.ok(cacheEntry, 'cache entry missing');
  assert.equal(cacheEntry.expires, now + guard.FALLBACK_TTL_MS);
});

test('caching dedupes requests and obeys TTL/force', async () => {
  let now = 0;
  const FakeDate = class extends Date {
    static now() {
      return now;
    }
  };
  let calls = 0;
  const fetchStub = async (url) => {
    if (!url.startsWith('/api/submissions')) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    calls += 1;
    return {
      ok: true,
      json: async () => ({ items: [{}] }),
    };
  };
  const { guard, context } = loadGuardModule({
    overrides: {
      fetch: fetchStub,
      Date: FakeDate,
      location: makeLocation('http://example.com/'),
    },
  });
  const results = await Promise.all([
    guard.hasSolved('p1'),
    guard.hasSolved('p1'),
    guard.hasSolved('p1'),
  ]);
  assert.deepEqual(results, [true, true, true]);
  assert.equal(calls, 1);

  now += guard.TTL_MS - 1000;
  assert.equal(await guard.hasSolved('p1'), true);
  assert.equal(calls, 1);

  now += 2000;
  assert.equal(await guard.hasSolved('p1'), true);
  assert.equal(calls, 2);

  await guard.hasSolved('p1', { force: true });
  assert.equal(calls, 3);

  guard.clearSolveCache();
  assert.equal(context.__bnUnifiedGuard.solveCache.size, 0);
});

test('needWarn treats failures as warning by default', async () => {
  let calls = 0;
  const fetchStub = async () => {
    calls += 1;
    throw new Error('network failure');
  };
  const { guard } = loadGuardModule({
    overrides: {
      fetch: fetchStub,
      location: makeLocation('http://example.com/problem/11'),
    },
  });
  assert.equal(await guard.hasSolved('11'), false);
  assert.equal(await guard.needWarn('11'), true);
  assert.equal(calls >= 2, true, 'should attempt both primary and fallback sources');
});

test('guard intercepts submission links and prompts when unsolved', async () => {
  const dom = new JSDOM(`
    <table>
      <tr>
        <td></td>
        <td><a href="/problem/42">Problem 42</a></td>
        <td><a id="sub" href="/submission/777">View</a></td>
      </tr>
    </table>
    <a id="other" href="/problem/42">Other</a>
  `, { url: 'http://example.com/submissions?problem_id=42', runScripts: 'outside-only' });

  dom.window.fetch = async (url) => {
    if (url.startsWith('/api/submissions')) {
      return { ok: true, json: async () => ({ items: [] }) };
    }
    if (url.startsWith('/problem/')) {
      return { ok: true, text: async () => '<div></div>' };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  let confirmCount = 0;
  dom.window.confirm = () => { confirmCount += 1; return false; };
  const { context } = loadGuardModule({
    context: dom.getInternalVMContext(),
    overrides: {
      fetch: dom.window.fetch,
      confirm: dom.window.confirm,
    },
  });

  const other = dom.window.document.getElementById('other');
  const otherEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  const otherResult = other.dispatchEvent(otherEvent);
  assert.equal(otherResult, true, 'non-guarded link should not be intercepted');

  const anchor = dom.window.document.getElementById('sub');
  const originalHref = dom.window.location.href;
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  const dispatchResult = anchor.dispatchEvent(event);
  assert.equal(dispatchResult, false, 'guarded link should cancel default navigation');
  await delay();
  assert.equal(confirmCount, 1);
  assert.equal(dom.window.location.href, originalHref);
  assert.equal(context.__bnUnifiedGuard.lastNavigation, null);
});

test('guard allows navigation without prompt when solved', async () => {
  const dom = new JSDOM(`
    <table>
      <tr>
        <td></td>
        <td><a href="/problem/42">Problem 42</a></td>
        <td><a id="sub" href="/submission/888">View</a></td>
      </tr>
    </table>
  `, { url: 'http://example.com/submissions?problem_id=42', runScripts: 'outside-only' });

  dom.window.fetch = async (url) => {
    if (url.startsWith('/api/submissions')) {
      return { ok: true, json: async () => ({ items: [{}] }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  let confirmCount = 0;
  dom.window.confirm = () => { confirmCount += 1; return false; };
  const { context } = loadGuardModule({
    context: dom.getInternalVMContext(),
    overrides: {
      fetch: dom.window.fetch,
      confirm: dom.window.confirm,
    },
  });

  const anchor = dom.window.document.getElementById('sub');
  const originalHref = dom.window.location.href;
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  const dispatchResult = anchor.dispatchEvent(event);
  assert.equal(dispatchResult, false, 'guard should handle navigation');
  await delay();
  assert.equal(confirmCount, 0);
  assert.equal(context.__bnUnifiedGuard.lastNavigation, 'http://example.com/submission/888');
});
