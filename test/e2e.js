'use strict';
// 端到端：通过 WebSocket 与服务器进行 PVE / PVP 对局（客户端随机合法操作）
const PORT = process.env.PORT || 8930;
const mode = process.argv[2] || 'pve';
function client(first, onState) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  ws.onopen = () => ws.send(JSON.stringify(first));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'error') console.log('ERR', m.msg); onState(m, ws); };
  return ws;
}
function act(s, ws) {
  const a = s.ask; if (!a) return;
  let ans;
  if (a.kind === 'main') { const e = a.actions.findIndex(x => x.t === 'end'); ans = Math.random() < 0.2 && e >= 0 ? e : Math.floor(Math.random() * a.actions.length); }
  else if (a.kind === 'option') ans = Math.floor(Math.random() * a.options.length);
  else ans = a.cands.slice(0, a.max).map(c => c.uid).slice(0, Math.max(a.min, Math.min(a.max, 1)));
  ws.send(JSON.stringify({ type: 'answer', ans, v: s.version }));
}
(async () => {
  const deck = await (await fetch(`http://localhost:${PORT}/api/random-deck`)).json();
  const t0 = Date.now();
  const done = s => { console.log('结束：', s.over.reason, '回合', s.turn, '耗时', Date.now() - t0, 'ms'); process.exit(0); };
  if (mode === 'pve') {
    client({ type: 'pve', level: process.argv[3] || 'hard', deck, name: '测试', token: 't1' }, (m, ws) => {
      if (m.type !== 'state' || !m.state) return; if (m.state.over) return done(m.state); act(m.state, ws);
    });
  } else {
    client({ type: 'create', deck, name: 'A', token: 'a' }, (m, ws) => {
      if (m.type !== 'state') return;
      if (!m.state) { client({ type: 'join', code: m.room, deck, name: 'B', token: 'b' }, (m2, ws2) => { if (m2.type === 'state' && m2.state && !m2.state.over) act(m2.state, ws2); }); return; }
      if (m.state.over) return done(m.state); act(m.state, ws);
    });
  }
  setTimeout(() => { console.log('超时'); process.exit(1); }, 600000);
})();
