'use strict';
// 幻兽帕鲁卡牌游戏 在线对战服务器（零依赖）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { db, Game, publicList } = require('./engine');
const { validateDeck, randomDeck } = require('./engine/decks');
const { PRESETS } = require('./engine/presets');
const { PUZZLES } = require('./puzzles');
const { PuzzleAI } = require('./solver');
const { TUTORIALS, TutorAI } = require('./tutorials');
// 稀有版本：rare=max 每张都用最高稀有度版本；rare=mix 随机混入稀有版本
const RARITY = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'rarity.json'), 'utf8')); } catch (e) { return {}; } })();
const RTIER = { SSS: 9, SSP: 8, TSP: 7, SP: 7, OSR: 6, PR: 5, TSR: 4, SR: 4, TDR: 3, RR: 2, R: 1 };
function variantTier(c, v) { const k = v.replace(/^SS01-/, 'SS-'); const f = c.imgs.find(x => x.split('/').pop().replace(/\.png$/, '') === k); const r = f && RARITY[f]; return r === 'PR' ? (/S\.png$/.test(f) ? 6 : 1) : (RTIER[r] || 0); }
function rarify(deck, mode) {
  if (mode !== 'max' && mode !== 'mix') return deck;
  return deck.map(id => {
    const c = db[id]; if (!c || !c.variants || c.variants.length < 2) return id;
    const vs = c.variants.map(v => [v, variantTier(c, v)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    if (!vs.length) return id;
    if (mode === 'max') return vs[0][0];
    return Math.random() < .55 ? vs[Math.floor(Math.random() * vs.length)][0] : id;
  });
}
function puzzleArt(p) {
  const ids = []; for (const pl of [p.sc.players[0], p.sc.players[1]]) for (const x of [...(pl.base || []), ...(pl.hand || [])]) ids.push(typeof x === 'string' ? x : x.id);
  const d = id => db[id] || {};
  const hit = ids.find(id => { const n = d(id).name || ''; const last = n.split(' ').pop(); return last && (p.title.includes(n) || p.title.includes(last)); });
  if (hit) return hit;
  return ids.filter(id => d(id).kind === 'pal').sort((a, b) => (d(b).cost || 0) - (d(a).cost || 0))[0] || ids[0];
}
const PUZZLE_PW = process.env.PUZZLE_PW || 'palworld';
const { AI } = require('./ai');
const { DeepAI } = require('./ai_deep');
const { viewFor } = require('./view');
const { upgrade } = require('./ws');
const crypto = require('crypto');
// ---------- 对局记录（复盘） ----------
const Accounts = require('./accounts');
const GP = require('./gp');
const EMOTES = require('../public/emotes.js');
// 对局记录存放在版本无关的数据目录；旧版本目录下的记录仍可读取
const GAMES = path.join(Accounts.DATA, 'games');
const GAMES_OLD = path.join(__dirname, '..', 'games');
fs.mkdirSync(GAMES, { recursive: true });
function saveGame(room) {
  const g = room.game; if (!g) return;
  const rec = { id: room.gid, created: room.created, updated: Date.now(), pve: room.pve ? (room.tutorial ? 'tutorial:' + room.tutorial.id : room.puzzle ? 'puzzle:' + room.puzzle.id : room.gp ? 'gp' : room.level) : null, names: g.init.names,
    decks: g.init.decks, seed: g.init.seed, scenario: g.init.scenario || null, hist: g.hist, undoLog: room.undoLog, over: g.over, turn: g.turnNo };
  fs.writeFile(path.join(GAMES, room.gid + '.json'), JSON.stringify(rec), () => {});
}
function loadGame(id) {
  id = String(id || '').replace(/[^0-9a-f-]/gi, '').toLowerCase(); if (id.length < 6) return null;
  for (const dir of [GAMES, GAMES_OLD]) {
    let f; try { f = fs.readdirSync(dir).find(x => x.startsWith(id)); } catch (e) { }
    if (f) return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
  }
  return null;
}
function replayAt(rec, n) {
  const g = new Game({ db, decks: rec.decks, names: rec.names, seed: rec.seed, scenario: rec.scenario || undefined });
  g.quiet = true;
  for (const h of rec.hist.slice(0, n)) { g.advance(h[1]); g.hist.push(h); }
  return g;
}

const PORT = +process.env.PORT || 8930;
const PUB = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const CARDS_JSON = JSON.stringify(publicList());

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (Accounts.handle(req, res, url, send)) return;
  if (GP.handle(req, res, url, send)) return;
  if (url.pathname === '/api/cards') return send(res, 200, CARDS_JSON, MIME['.json']);
  if (url.pathname === '/api/random-deck') {
    const cols = (url.searchParams.get('colors') || '').split(',').filter(c => ['red', 'blue', 'green', 'purple'].includes(c)).slice(0, 2);
    const mode = url.searchParams.get('mode') || 'true';
    if (mode === 'preset') {
      const ok = PRESETS.filter(p => !cols.length || p.colors.every(c => cols.includes(c)) || p.colors.some(c => cols.includes(c)));
      const p = (ok.length ? ok : PRESETS)[Math.floor(Math.random() * (ok.length || PRESETS.length))];
      return send(res, 200, JSON.stringify(rarify(p.cards, url.searchParams.get('rare'))), MIME['.json']);
    }
    return send(res, 200, JSON.stringify(rarify(randomDeck(Math.random, cols.length ? cols : null, url.searchParams.get('strong') === '1' || mode === 'curve', mode === 'curve' ? 'curve' : mode), url.searchParams.get('rare'))), MIME['.json']);
  }
  if (url.pathname === '/api/puzzles') {
    return send(res, 200, JSON.stringify(PUZZLES.map(p => ({ id: p.id, level: p.level, mill: !!p.mill, art: puzzleArt(p), title: p.title, desc: p.desc, hint: p.hint, turns: (p.sc.limit.turn - p.sc.turnNo) / 2 + 1 }))), MIME['.json']);
  }
  if (url.pathname === '/api/puzzle-guide') {
    const p = PUZZLES.find(x => x.id === url.searchParams.get('id'));
    if (!p) return send(res, 404, '{"error":"残局不存在"}', MIME['.json']);
    if (url.searchParams.get('pw') !== PUZZLE_PW) return send(res, 403, '{"error":"密码错误"}', MIME['.json']);
    let steps = []; try { steps = JSON.parse(fs.readFileSync(path.join(__dirname, 'puzzle_guides.json'), 'utf8'))[p.id] || []; } catch (e) { }
    return send(res, 200, JSON.stringify({ guide: p.guide, steps }), MIME['.json']);
  }
  if (url.pathname === '/api/tutorials') return send(res, 200, JSON.stringify(TUTORIALS.map(t => ({ id: t.id, no: t.no, title: t.title, desc: t.desc }))), MIME['.json']);
  if (url.pathname === '/api/presets') {
    return send(res, 200, JSON.stringify(PRESETS), MIME['.json']);
  }
  let mm;
  if ((mm = url.pathname.match(/^\/api\/replay\/([0-9a-fA-F-]+)$/))) {
    const rec = loadGame(mm[1]); if (!rec) return send(res, 404, JSON.stringify({ error: '找不到该对局' }), MIME['.json']);
    const n = Math.max(0, Math.min(rec.hist.length, +(url.searchParams.get('n') ?? rec.hist.length)));
    const pov = +url.searchParams.get('pov') || 0;
    const g = replayAt(rec, n);
    const st = viewFor(g, pov, { all: url.searchParams.get('all') === '1' });
    st.ask = null; // 复盘中不可操作
    const nxt = rec.hist[n];
    return send(res, 200, JSON.stringify({ id: rec.id, n, total: rec.hist.length, names: rec.names, pve: rec.pve, over: rec.over, created: rec.created,
      next: nxt ? { player: nxt[0], ans: nxt[1], prompt: g.pending && g.pending.prompt, label: g.pending && (g.pending.kind === 'main' ? (g.pending.actions[nxt[1]] || {}).label : g.pending.kind === 'option' ? g.pending.options[nxt[1]] : JSON.stringify(nxt[1])) } : null,
      state: st }), MIME['.json']);
  }
  // 自备原声带：<数据目录>/music/<场景>/*.mp3|ogg|m4a|flac|wav（场景：title menu battle draft win lose）
  if (url.pathname === '/api/music') {
    const root = path.join(Accounts.DATA, 'music'), out = {};
    const AU = /\.(mp3|ogg|m4a|aac|flac|wav|opus|webm)$/i;
    for (const sc of ['title', 'menu', 'battle', 'draft', 'win', 'lose']) {
      try { out[sc] = fs.readdirSync(path.join(root, sc)).filter(f => AU.test(f)).sort().map(f => `/music/${sc}/${encodeURIComponent(f)}`); } catch (e) { out[sc] = []; }
    }
    // 直接放在 music/ 根目录的文件按曲名自动归类
    const RULES = [[/hello.{0,3}pal ?world/i, ['title', 'menu']], [/boss|engraved|myth|savage|dudes|battle|戦闘|战斗/i, ['battle']], [/victory|win|胜利/i, ['win']], [/defeat|lose|失败/i, ['lose']]];
    try {
      for (const f of fs.readdirSync(root).filter(f => AU.test(f)).sort()) {
        const r = RULES.find(([re]) => re.test(f)); const u = `/music/${encodeURIComponent(f)}`;
        for (const sc of r ? r[1] : ['menu']) out[sc].push(u);
      }
    } catch (e) { }
    // 开场固定 Hello, Palworld 置顶
    for (const sc of ['title', 'menu']) out[sc].sort((a, b) => /hello/i.test(decodeURIComponent(b)) - /hello/i.test(decodeURIComponent(a)));
    return send(res, 200, JSON.stringify({ dir: root, tracks: out }), MIME['.json']);
  }
  if (url.pathname === '/api/music/upload' && req.method === 'POST') {
    const root = path.join(Accounts.DATA, 'music'), name = path.basename(String(url.searchParams.get('name') || '')).replace(/[\\/:*?"<>|]/g, '_');
    if (!/\.(mp3|ogg|m4a|aac|flac|wav|opus|webm)$/i.test(name)) return send(res, 400, '{"error":"仅支持音频文件"}', MIME['.json']);
    fs.mkdirSync(root, { recursive: true });
    let size = 0; const tmp = path.join(root, '.up-' + Date.now()), ws = fs.createWriteStream(tmp);
    req.on('data', d => { size += d.length; if (size > 80e6) { req.destroy(); ws.destroy(); fs.rm(tmp, () => { }); } });
    req.pipe(ws); ws.on('finish', () => { fs.renameSync(tmp, path.join(root, name)); send(res, 200, JSON.stringify({ ok: true, name }), MIME['.json']); });
    return;
  }
  if (url.pathname.startsWith('/music/')) {
    const root = path.join(Accounts.DATA, 'music'), f = path.normalize(path.join(root, decodeURIComponent(url.pathname.slice(7))));
    if (path.basename(f).startsWith('.')) return send(res, 404, 'not found');
    if (!f.startsWith(root + path.sep)) return send(res, 403, 'forbidden');
    return fs.stat(f, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'not found');
      const AM = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.wav': 'audio/wav', '.webm': 'audio/webm' };
      const type = AM[path.extname(f).toLowerCase()] || 'application/octet-stream', rg = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (rg) {
        const a = rg[1] ? +rg[1] : st.size - +rg[2], b = rg[1] && rg[2] ? Math.min(+rg[2], st.size - 1) : st.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1, 'Cache-Control': 'max-age=3600' });
        return fs.createReadStream(f, { start: a, end: b }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size, 'Cache-Control': 'max-age=3600' });
      fs.createReadStream(f).pipe(res);
    });
  }
  if (url.pathname === '/api/rooms') return send(res, 200, JSON.stringify(listRooms()), MIME['.json']);
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB)) return send(res, 403, 'forbidden');
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': /\.(png|jpg)$/.test(f) ? 'max-age=86400' : 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
});
function send(res, code, body, type = 'text/plain; charset=utf-8') { res.writeHead(code, { 'Content-Type': type }); res.end(body); }

// ---------- 房间 ----------
const rooms = new Map();
function code() { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(c)); return c; }
function listRooms() {
  return [...rooms.values()].filter(r => !r.pve && !r.game && r.seats[0] && !r.seats[1]).map(r => ({ code: r.code, host: r.seats[0].name }));
}
class Room {
  constructor(pve) { this.code = code(); this.pve = pve; this.seats = [null, null]; this.game = null; this.ai = null; this.aiTimer = null; this.undos = [10, 10]; this.undoReq = null; rooms.set(this.code, this); }
  canCancel(i) { return !!(this.game && !this.game.over && this.game.cancelPoint(i, !this.pve) >= 0); }
  doCancel(i) {
    const n = this.game.cancelPoint(i, !this.pve); if (n < 0) return false;
    clearTimeout(this.aiTimer); this.aiTimer = null;
    const g = this.game.rewind(n);
    this.undoLog.push({ by: i, from: this.game.hist.length, to: n, at: Date.now(), cancel: true });
    this.game = g; this.undoReq = null;
    return true;
  }
  canUndo(i) { return !!(this.game && !this.game.over && this.undos[i] > 0 && this.game.undoPoint(i) >= 0); }
  doUndo(i) {
    const n = this.game.undoPoint(i); if (n < 0) return false;
    clearTimeout(this.aiTimer); this.aiTimer = null;
    const g = this.game.rewind(n);
    g.say(`↶ ${this.seats[i].name} 悔棋（剩余 ${this.undos[i] - 1} 次）`);
    this.undoLog.push({ by: i, from: this.game.hist.length, to: n, at: Date.now() });
    this.game = g; this.undos[i]--; this.undoReq = null;
    return true;
  }
  broadcast() {
    saveGame(this);
    if (this.pve && !this.puzzle && !this.tutorial && this.game && this.game.over && !this.overEmote) {
      this.overEmote = true;
      if (Math.random() < 0.7) setTimeout(() => this.seats[0] && this.emote(1, 'taunt', this.game.over.winner === 1 ? [2, 6, 16][Math.floor(Math.random() * 3)] : [1, 2][Math.floor(Math.random() * 2)]), 2600);
    }
    if (this.gp && this.game && this.game.over && !this.gp.done) {
      this.gp.done = true;
      const w = this.game.over.winner;
      this.gp.result = GP.settle(this.gp.run, this.gp.gameId, w === 0, w === 0 ? '' : this.game.over.reason);
    }
    for (let i = 0; i < 2; i++) {
      const s = this.seats[i];
      if (s && s.ws) s.ws.send({ type: 'state', room: this.code, state: this.game ? Object.assign(viewFor(this.game, i, { all: !!this.puzzle }), this.tutorial ? { tutorial: { id: this.tutorial.id, no: this.tutorial.no, title: this.tutorial.title, steps: this.tutorial.steps, total: TUTORIALS.length, next: (TUTORIALS[this.tutorial.no] || {}).id || null }, deckTop: this.game.p.map(p => p.deck.slice(0, 3).map(c => c.id)) } : {}, this.puzzle ? { puzzle: { id: this.puzzle.id, title: this.puzzle.title, desc: this.puzzle.desc, hint: this.puzzle.hint, limit: this.game.limit }, deckTop: this.game.p.map(p => p.deck.slice(0, 10).map(c => c.id)) } : {}, { gid: this.gid, pve: this.pve, gp: this.gp ? { style: this.gp.style, result: this.gp.result || null } : undefined, undos: this.undos[i], canUndo: this.canUndo(i), canCancel: this.canCancel(i), undoReq: this.undoReq === null ? null : this.undoReq === i ? 'mine' : 'theirs' }) : null, seats: this.seats.map(x => x && { name: x.name, ready: !!x.deck, online: !!(x.ws && x.ws.open) }) });
    }
    this.scheduleAI();
  }
  start(scenario, seed) {
    this.gid = crypto.randomUUID(); this.created = Date.now(); this.undoLog = [];
    const decks = this.seats.map(s => s.deck);
    this.game = new Game({ db, decks, names: this.seats.map(s => s.name), scenario, seed });
    this.broadcast();
  }
  emote(seat, kind, i) {
    const from = this.seats[seat] && this.seats[seat].name;
    for (let k = 0; k < 2; k++) { const s = this.seats[k]; if (s && s.ws) s.ws.send({ type: 'emote', seat, me: k === seat, from, kind, i }); }
  }
  scheduleAI() {
    if (!this.ai || !this.game || this.game.over || this.aiTimer) return;
    const q = this.game.pending;
    if (!q || q.player !== 1) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      if (!this.game || this.game.over || !this.game.pending || this.game.pending.player !== 1) return;
      try { const a = this.ai.decide(this.game, 1); this.game.answer(1, a); }
      catch (e) { console.error('AI 错误', e); this.game.concede(1); }
      this.broadcast();
    }, +process.env.AI_DELAY || 750);
  }
  leave(i) {
    const s = this.seats[i]; if (!s) return;
    s.ws = null;
    if (!this.seats.some(x => x && x.ws && x.ws.open)) setTimeout(() => { if (!this.seats.some(x => x && x.ws && x.ws.open)) { clearTimeout(this.aiTimer); rooms.delete(this.code); } }, 5 * 60 * 1000);
    else this.broadcast();
  }
}
const AI_NAMES = { easy: '电脑（简单）', normal: '电脑（普通）', hard: '电脑（困难）', hell: '电脑（地狱）' };

server.on('upgrade', (req, socket) => {
  const ws = upgrade(req, socket); if (!ws) return;
  let room = null, seat = -1;
  const err = m => ws.send({ type: 'error', msg: m });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    try {
      if (m.type === 'pve' || m.type === 'create' || m.type === 'join') {
        if (m.type === 'pve' && m.tutorial) {
          const T = TUTORIALS.find(x => x.id === m.tutorial); if (!T) return err('教程不存在');
          room = new Room(true); seat = 0;
          room.seats[0] = { name: String(m.name || '玩家').slice(0, 16), deck: [], ws, token: m.token };
          room.seats[1] = { name: '教练', deck: [] };
          room.ai = new TutorAI(T.opp); room.level = 'tutorial'; room.tutorial = T; room.undos = [99, 0];
          const sc = JSON.parse(JSON.stringify(T.sc)); sc.players[0].name = room.seats[0].name;
          room.start(sc, 7);
          return;
        }
        if (m.type === 'pve' && m.puzzle) {
          const pz = PUZZLES.find(x => x.id === m.puzzle); if (!pz) return err('残局不存在');
          room = new Room(true); seat = 0;
          room.seats[0] = { name: String(m.name || '玩家').slice(0, 16), deck: [], ws, token: m.token };
          room.seats[1] = { name: '残局对手', deck: [] };
          room.ai = new PuzzleAI(0); room.level = 'puzzle'; room.puzzle = pz; room.undos = [99, 0];
          room.start(JSON.parse(JSON.stringify(pz.sc)), 7);
          return;
        }
        if (m.type === 'pve' && m.gp) {
          const mt = GP.nextMatch(m.auth || '', { guest: m.token, name: m.name });
          if (mt.error) return err(mt.error);
          room = new Room(true); seat = 0;
          room.seats[0] = { name: String(m.name || '玩家').slice(0, 16), deck: mt.deck, ws, token: m.token };
          room.seats[1] = { name: mt.oppName, deck: mt.oppDeck };
          room.ai = new DeepAI(Date.now(), { cheat: true }); room.level = 'hell'; room.undos = [0, 0];
          room.gp = { run: mt.run, gameId: mt.gameId, style: mt.style };
          room.start();
          return;
        }
        const errs = validateDeck(m.deck);
        if (errs.length) return err('卡组不合法：' + errs.join('；'));
        const name = String(m.name || '玩家').slice(0, 16);
        if (m.type === 'pve') {
          const lv = ['easy', 'normal', 'hard', 'hell'].includes(m.level) ? m.level : 'normal';
          room = new Room(true); seat = 0;
          room.seats[0] = { name, deck: m.deck, ws, token: m.token };
          room.seats[1] = { name: AI_NAMES[lv], deck: Array.isArray(m.oppDeck) && !validateDeck(m.oppDeck).length ? m.oppDeck : randomDeck(Math.random, null, lv === 'hard' || lv === 'hell') };
          room.ai = lv === 'hell' ? new DeepAI(Date.now(), { cheat: true }) : lv === 'hard' ? new DeepAI(Date.now()) : new AI(lv, Date.now()); room.level = lv;
          room.start(process.env.DEV && m.scenario ? m.scenario : undefined);
        } else if (m.type === 'create') {
          room = new Room(false); seat = 0;
          room.seats[0] = { name, deck: m.deck, ws, token: m.token };
          room.broadcast();
        } else {
          const r = rooms.get(String(m.code));
          if (!r || r.pve) return err('房间不存在');
          if (r.seats[1]) return err('房间已满');
          room = r; seat = 1;
          room.seats[1] = { name, deck: m.deck, ws, token: m.token };
          room.start();
        }
      } else if (m.type === 'rejoin') {
        const r = rooms.get(String(m.code));
        const i = r ? r.seats.findIndex(s => s && s.token && s.token === m.token) : -1;
        if (i < 0) return ws.send({ type: 'rejoinFail' });
        room = r; seat = i; r.seats[i].ws = ws; r.broadcast();
      } else if (!room) {
        return err('尚未加入房间');
      } else if (m.type === 'answer') {
        const g = room.game;
        if (!g || g.over) return;
        if (m.v !== undefined && m.v !== g.version) return; // 过期操作
        g.answer(seat, m.ans);
        room.undoReq = null;
        room.broadcast();
      } else if (m.type === 'cancel') {
        if (!room.doCancel(seat)) return err('当前没有可取消的操作');
        room.broadcast();
      } else if (m.type === 'undo') {
        if (!room.canUndo(seat)) return err('当前无法悔棋（每局最多 3 次）');
        if (room.pve) { room.doUndo(seat); room.broadcast(); }
        else { room.undoReq = seat; room.broadcast(); }
      } else if (m.type === 'undoReply') {
        const r = room.undoReq; if (r === null || r === seat) return;
        if (m.ok && room.canUndo(r)) room.doUndo(r);
        else { room.undoReq = null; const s = room.seats[r]; if (s && s.ws) s.ws.send({ type: 'error', msg: '对方拒绝了悔棋申请' }); }
        room.broadcast();
      } else if (m.type === 'concede') {
        if (room.game && !room.game.over) { room.game.concede(seat); room.broadcast(); }
      } else if (m.type === 'chat') {
        const txt = String(m.text || '').slice(0, 200);
        for (const s of room.seats) if (s && s.ws) s.ws.send({ type: 'chat', from: room.seats[seat].name, text: txt });
      } else if (m.type === 'emote') {
        const kind = m.kind === 'emoji' ? 'emoji' : 'taunt', i = m.i | 0;
        if (!(i >= 0 && i < EMOTES[kind].length)) return;
        const now = Date.now(); room.emoteT = room.emoteT || [0, 0];
        if (now - room.emoteT[seat] < 1500) return; room.emoteT[seat] = now;
        room.emote(seat, kind, i);
        // 人机：AI 偶尔回应（残局对手不说话）
        if (room.pve && !room.puzzle && !room.tutorial && room.game && Math.random() < 0.6) {
          const g = room.game, winning = !g.over && g.p[1].life >= g.p[0].life, R = EMOTES.aiReply;
          let k2, j;
          if (g.over) { k2 = 'taunt'; j = g.over.winner === 1 ? 2 : 1; }
          else if (Math.random() < 0.45) { k2 = 'emoji'; j = R.emoji[Math.floor(Math.random() * R.emoji.length)]; }
          else { k2 = 'taunt'; j = winning ? R.taunt[Math.floor(Math.random() * R.taunt.length)] : [1, 5, 16][Math.floor(Math.random() * 3)]; }
          setTimeout(() => room.seats[0] && room.emote(1, k2, j), 900 + Math.random() * 900);
        }
      } else if (m.type === 'leave') {
        room.leave(seat); room = null;
      }
    } catch (e) {
      err(e.message);
      if (room) room.broadcast();
    }
  });
  ws.on('close', () => { if (room) room.leave(seat); });
});

server.listen(PORT, () => console.log(`幻兽帕鲁卡牌游戏 对战平台已启动：http://localhost:${PORT}`));
