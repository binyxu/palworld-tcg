// 联机悔棋：A 申请，B 同意/拒绝
const PORT = process.env.PORT || 8932;
const deck = async () => (await fetch(`http://localhost:${PORT}/api/random-deck?colors=green,red`)).json();
const cli = () => { const ws = new WebSocket(`ws://localhost:${PORT}`); const c = { ws, st: null, errs: [], send: m => ws.send(JSON.stringify(m)) };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'state') { c.st = m.state; c.room = m.room; } if (m.type === 'error') c.errs.push(m.msg); }; return new Promise(r => ws.onopen = () => r(c)); };
const sl = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const d = await deck(); console.log('colors', [...new Set(d.map(id => id.slice(0, 4)))].length, 'cards', d.length);
  const A = await cli(), B = await cli();
  A.send({ type: 'create', deck: d, name: 'A', token: 'ta' }); await sl(200);
  B.send({ type: 'join', code: A.room, deck: await deck(), name: 'B', token: 'tb' }); await sl(300);
  // 推进到某人做出一个可悔操作
  const step = async () => { for (const [c, i] of [[A, 0], [B, 1]]) { const s = c.st; if (s && s.ask) { const a = s.ask; c.send({ type: 'answer', v: s.version, ans: a.kind === 'select' ? a.cands.slice(0, a.min).map(x => x.uid) : a.kind === 'option' ? 0 : a.actions.findIndex(x => x.t === 'play') >= 0 ? a.actions.findIndex(x => x.t === 'play') : a.actions.findIndex(x => x.t === 'end') }); await sl(80); return; } } };
  for (let k = 0; k < 12; k++) await step();
  const who = A.st.canUndo ? A : B, other = who === A ? B : A;
  const v0 = who.st.version; who.send({ type: 'undo' }); await sl(200);
  console.log('req mine:', who.st.undoReq, 'theirs:', other.st.undoReq);
  other.send({ type: 'undoReply', ok: false }); await sl(200);
  console.log('after reject undos', who.st.undos, 'err', who.errs.slice(-1)[0]);
  who.send({ type: 'undo' }); await sl(200); other.send({ type: 'undoReply', ok: true }); await sl(200);
  console.log('after accept undos', who.st.undos, 'req', who.st.undoReq, 'log', who.st.log.slice(-1)[0]);
  process.exit(0);
})();
