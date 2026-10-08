// 在 Node 中模拟浏览器 Worker 运行 dist/server.bundle.js：注册账号 → 人机对战（地狱）打完整局 → 残局 → 复盘接口
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'server.bundle.js'), 'utf8');
const saved = {}; let onmsg = null; const handlers = [];
const self = { postMessage: m => handlers.forEach(h => h(m)), crypto: require('crypto').webcrypto };
const ctx = vm.createContext({ self, console, setTimeout, clearTimeout, setInterval, clearInterval, TextEncoder, URL, Date, Math, JSON });
vm.runInContext(src, ctx);
const post = m => self.onmessage({ data: m });
let rid = 0; const reqs = {}, socks = {};
handlers.push(m => {
  if (m.t === 'save') { if (m.data === null) delete saved[m.path]; else saved[m.path] = m.data; }
  if (m.t === 'res') reqs[m.id](m);
  if (m.t === 'wsmsg') socks[m.cid](JSON.parse(m.data));
  if (m.t === 'fatal') { console.error(m.error); process.exit(1); }
});
const api = (url, method = 'GET', body) => new Promise(r => { const id = ++rid; reqs[id] = r; post({ t: 'req', id, url, method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); });
post({ t: 'init', files: {} });
function play(first, pick) {
  return new Promise(done => {
    const cid = ++rid; let last = -1, t0 = Date.now();
    socks[cid] = m => {
      if (m.type !== 'state' || !m.state) return;
      const s = m.state;
      if (s.over) { post({ t: 'wsclose', cid }); return done({ over: s.over, turn: s.turn, sec: (Date.now() - t0) / 1000 }); }
      const a = s.ask; if (!a || a.v === last) return; last = a.v;
      post({ t: 'wsmsg', cid, data: JSON.stringify({ type: 'answer', ans: pick(a, s), v: s.version }) });
    };
    post({ t: 'wsopen', cid }); post({ t: 'wsmsg', cid, data: JSON.stringify(first) });
  });
}
// 简单玩家：主要阶段优先出牌/攻击，其次结束；选项取第一个；选择取最少数量
const simple = a => {
  if (a.kind === 'main') { const i = a.actions.findIndex(x => x.t !== 'end'); return a.quick ? a.actions.findIndex(x => x.t === 'end') : i >= 0 && Math.random() < 0.8 ? i : a.actions.findIndex(x => x.t === 'end'); }
  if (a.kind === 'option') return 0;
  return (a.cands || []).slice(0, a.min || 0).map(c => c.uid || c);
};
(async () => {
  const cards = JSON.parse((await api('/api/cards')).body); console.log('cards', cards.length);
  const reg = JSON.parse((await api('/api/account/register', 'POST', { username: 'tester', password: 'pw123456' })).body); console.log('register', Object.keys(reg));
  const pz = JSON.parse((await api('/api/puzzles')).body); console.log('puzzles', pz.length);
  const deck = JSON.parse((await api('/api/random-deck')).body);
  for (const level of ['easy', 'hell']) {
    const r = await play({ type: 'pve', level, deck, name: 'tester', token: 'tk' }, simple);
    console.log(level, JSON.stringify(r));
  }
  const g = await api('/api/account/me', 'POST');
  console.log('persisted files', Object.keys(saved).length, Object.keys(saved).slice(0, 4));
  const gid = Object.keys(saved).find(k => k.includes('/games/')).split('/').pop().replace('.json', '');
  const rp = JSON.parse((await api('/api/replay/' + gid + '?n=5')).body); console.log('replay', rp.n, rp.total);
  process.exit(0);
})();
