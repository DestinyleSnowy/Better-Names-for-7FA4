const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.resolve(__dirname, '../../main.js'), 'utf8');
const startMarker = '/* === Unified Submission Guard (self+100pt single source) === */';
const endMarker = '/* === BN PATCH: user menu animation + shadow === */';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start === -1 || end === -1) {
  throw new Error('Unable to locate unified guard source block in main.js');
}
const guardSource = source.slice(start, end);

function makeLocation(url) {
  const base = new URL(url || 'http://example.com/');
  const loc = {
    href: base.href,
    origin: base.origin,
    protocol: base.protocol,
    host: base.host,
    hostname: base.hostname,
    port: base.port,
    pathname: base.pathname,
    search: base.search,
    hash: base.hash,
    assign(nextHref) {
      const resolved = new URL(nextHref, this.href);
      this.href = resolved.href;
      this.origin = resolved.origin;
      this.protocol = resolved.protocol;
      this.host = resolved.host;
      this.hostname = resolved.hostname;
      this.port = resolved.port;
      this.pathname = resolved.pathname;
      this.search = resolved.search;
      this.hash = resolved.hash;
      this.lastAssigned = resolved.href;
    },
    toString() { return this.href; },
  };
  return loc;
}

function loadGuardModule({ context, overrides } = {}) {
  const ctx = context || vm.createContext({});
  const globalLike = ctx;
  if (!('globalThis' in globalLike)) globalLike.globalThis = globalLike;
  if (!('window' in globalLike)) globalLike.window = globalLike;
  if (!('self' in globalLike)) globalLike.self = globalLike;
  if (!('console' in globalLike)) globalLike.console = console;
  if (!('AbortController' in globalLike)) globalLike.AbortController = globalThis.AbortController;
  if (!('setTimeout' in globalLike)) globalLike.setTimeout = setTimeout;
  if (!('clearTimeout' in globalLike)) globalLike.clearTimeout = clearTimeout;
  if (!('URL' in globalLike)) globalLike.URL = URL;
  if (!('URLSearchParams' in globalLike)) globalLike.URLSearchParams = URLSearchParams;
  if (!('Promise' in globalLike)) globalLike.Promise = Promise;
  if (!('Map' in globalLike)) globalLike.Map = Map;
  if (!('location' in globalLike)) {
    globalLike.location = makeLocation();
  }
  if (overrides && typeof overrides === 'object') {
    Object.assign(globalLike, overrides);
  }

  vm.runInContext(guardSource, ctx);
  return { context: ctx, guard: globalLike.__bnUnifiedGuard };
}

module.exports = {
  loadGuardModule,
  makeLocation,
  guardSource,
};
