// 浏览器单机版：在 Web Worker 中运行原服务端代码所需的 Node 内置模块替身（fs / path / crypto / http / events）。
// 由 tools/build-demo.js 拼接到 server.bundle.js 开头。
/* global __MODULES__, __FILES__, __ENTRY__ */
'use strict';
const post = m => self.postMessage(m);
// ---------- path ----------
const P = {
  sep: '/',
  normalize(p) {
    const abs = p.startsWith('/'), out = [];
    for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    return (abs ? '/' : '') + out.join('/');
  },
  join(...a) { return P.normalize(a.filter(x => x !== '').join('/')); },
  resolve(...a) { let r = ''; for (const x of a) r = x.startsWith('/') ? x : r + '/' + x; return P.normalize(r || '/'); },
  dirname(p) { const n = P.normalize(p); const i = n.lastIndexOf('/'); return i <= 0 ? '/' : n.slice(0, i); },
  basename(p, ext) { const b = P.normalize(p).split('/').pop() || ''; return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
  extname(p) { const b = P.basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },
};
// ---------- fs（内存文件系统；/palworld-data 下的写入同步到页面 localStorage） ----------
const FILES = new Map(Object.entries(__FILES__));
const PERSIST = '/palworld-data/';
const enoent = p => { const e = new Error('ENOENT: ' + p); e.code = 'ENOENT'; return e; };
const persist = (p, d) => { if (p.startsWith(PERSIST)) post({ t: 'save', path: p, data: d }); };
const FS = {
  readFileSync(p) { p = P.normalize(p); if (!FILES.has(p)) throw enoent(p); return FILES.get(p); },
  writeFileSync(p, s) { p = P.normalize(p); s = String(s); FILES.set(p, s); persist(p, s); },
  writeFile(p, s, cb) { try { FS.writeFileSync(p, s); cb && cb(null); } catch (e) { cb && cb(e); } },
  renameSync(a, b) { a = P.normalize(a); b = P.normalize(b); if (!FILES.has(a)) throw enoent(a); const d = FILES.get(a); FILES.delete(a); FILES.set(b, d); persist(a, null); persist(b, d); },
  copyFileSync(a, b) { FS.writeFileSync(b, FS.readFileSync(a)); },
  existsSync(p) { p = P.normalize(p); if (FILES.has(p)) return true; for (const k of FILES.keys()) if (k.startsWith(p + '/')) return true; return false; },
  mkdirSync() { },
  readdirSync(d) {
    d = P.normalize(d) + '/'; const out = new Set();
    for (const k of FILES.keys()) if (k.startsWith(d)) out.add(k.slice(d.length).split('/')[0]);
    return [...out];
  },
  stat(p, cb) { p = P.normalize(p); setTimeout(() => FILES.has(p) ? cb(null, { isFile: () => true, size: FILES.get(p).length }) : cb(enoent(p))); },
  rm(p, o, cb) { cb = typeof o === 'function' ? o : cb; p = P.normalize(p); FILES.delete(p); persist(p, null); cb && cb(null); },
  unlinkSync(p) { p = P.normalize(p); FILES.delete(p); persist(p, null); },
  createWriteStream() { throw new Error('单机版不支持上传文件'); },
  createReadStream() { throw new Error('单机版不支持读取文件流'); },
};
// ---------- crypto ----------
function sha256(msg) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const b = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
  const l = b.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(b); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
  const r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = W[i - 15], c = W[i - 2]; W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(c, 17) ^ r(c, 19) ^ (c >>> 10))) >>> 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32); const ov = new DataView(out.buffer); H.forEach((x, i) => ov.setUint32(i * 4, x)); return out;
}
const bytes = u8 => ({ u8, length: u8.length, toString: () => [...u8].map(x => x.toString(16).padStart(2, '0')).join(''), readUInt32LE: (o = 0) => new DataView(u8.buffer).getUint32(o, true) });
const CR = {
  randomUUID: () => self.crypto.randomUUID(),
  randomBytes: n => bytes(self.crypto.getRandomValues(new Uint8Array(n))),
  createHash() { let s = ''; const h = { update(x) { s += String(x); return h; }, digest() { return bytes(sha256(s)).toString(); } }; return h; },
  scryptSync(pw, salt, len) { let h = sha256(String(pw) + '|' + salt); for (let i = 0; i < 2000; i++) h = sha256(h); return bytes(h.slice(0, len)); },
};
// ---------- events ----------
class EventEmitter {
  constructor() { this._ev = {}; }
  on(e, f) { (this._ev[e] = this._ev[e] || []).push(f); return this; }
  once(e, f) { const w = (...a) => { this.off(e, w); f(...a); }; return this.on(e, w); }
  off(e, f) { this._ev[e] = (this._ev[e] || []).filter(x => x !== f); return this; }
  removeListener(e, f) { return this.off(e, f); }
  emit(e, ...a) { for (const f of (this._ev[e] || []).slice()) f(...a); return true; }
}
// ---------- http（把页面发来的请求交给原服务端的处理函数） ----------
let SERVER = null;
const HTTP = { createServer(handler) { SERVER = new EventEmitter(); SERVER.handler = handler; SERVER.listen = (p, cb) => { cb && cb(); }; return SERVER; } };
const WSMOD = { upgrade: (req, socket) => socket };
const BUILTIN = { fs: FS, path: P, crypto: CR, http: HTTP, events: EventEmitter, '#ws': WSMOD };
const process = { env: { AI_DELAY: '600', PTCG_DATA: '/palworld-data' }, pid: 1, on() { }, platform: 'browser', cwd: () => '/app' };
self.process = process;
// ---------- 模块系统 ----------
const CACHE = {};
function load(id) {
  if (BUILTIN[id]) return BUILTIN[id];
  if (CACHE[id]) return CACHE[id].exports;
  const def = __MODULES__[id]; if (!def) throw new Error('模块不存在：' + id);
  const module = { exports: {} }; CACHE[id] = module;
  if (def.json !== undefined) { module.exports = JSON.parse(def.json); return module.exports; }
  def.fn(module, module.exports, spec => load(def.deps[spec] || spec), P.dirname(id), id, process);
  return module.exports;
}
// ---------- 与页面通信 ----------
const sockets = new Map(); let ready = false; const queue = [];
function handle(m) {
  if (m.t === 'req') {
    const req = new EventEmitter(); req.url = m.url; req.method = m.method; req.headers = m.headers || {}; req.destroy = () => { };
    let done = false, status = 200, headers = {};
    const res = {
      statusCode: 200, setHeader(k, v) { headers[k.toLowerCase()] = v; },
      writeHead(c, h) { status = c; Object.assign(headers, h || {}); return res; },
      write() { }, end(body) { if (done) return; done = true; post({ t: 'res', id: m.id, status, headers, body: body == null ? '' : String(body) }); },
      on() { }, once() { }, emit() { },
    };
    try { SERVER.handler(req, res); } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    setTimeout(() => { if (m.body) req.emit('data', m.body); req.emit('end'); });
  } else if (m.t === 'wsopen') {
    const ws = new EventEmitter(); ws.open = true;
    ws.send = o => { if (ws.open) post({ t: 'wsmsg', cid: m.cid, data: typeof o === 'string' ? o : JSON.stringify(o) }); };
    ws.close = () => { if (!ws.open) return; ws.open = false; post({ t: 'wsclose', cid: m.cid }); ws.emit('close'); };
    sockets.set(m.cid, ws); SERVER.emit('upgrade', { headers: {}, url: '/' }, ws);
  } else if (m.t === 'wsmsg') { const ws = sockets.get(m.cid); if (ws && ws.open) ws.emit('message', m.data); }
  else if (m.t === 'wsclose') { const ws = sockets.get(m.cid); if (ws && ws.open) { ws.open = false; ws.emit('close'); } sockets.delete(m.cid); }
}
self.onmessage = e => {
  const m = e.data;
  if (m.t === 'init') {
    for (const [k, v] of Object.entries(m.files || {})) FILES.set(k, v);
    try { load(__ENTRY__); } catch (err) { post({ t: 'fatal', error: String(err && err.stack || err) }); return; }
    ready = true; post({ t: 'ready' }); queue.splice(0).forEach(handle); return;
  }
  if (!ready) queue.push(m); else handle(m);
};
