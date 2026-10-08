'use strict';
// 大奖赛（Grand Prix）：随机 2 色 → 50 轮三选一组成 50 张卡组 → 连续挑战随机困难对手，累计 3 败结束。
// 数据存放在版本无关的数据目录 <DATA>/gp.json，各版本服务器共用；排行榜按单次挑战的最高胜场排名。
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { db } = require('./engine');
const { randomDeck, validateDeck } = require('./engine/decks');
const Accounts = require('./accounts');

const FILE = path.join(Accounts.DATA, 'gp.json');
const PICKS = 50, MAX_LOSS = 3;
const COLORS = ['red', 'blue', 'green', 'purple'];
const CN = { red: '红', blue: '蓝', green: '绿', purple: '紫' };

let S = { runs: {}, board: [] };
function load() { try { S = JSON.parse(fs.readFileSync(FILE, 'utf8')); S.runs ||= {}; S.board ||= []; } catch (e) { if (e.code === 'ENOENT') S = { runs: {}, board: [] }; } }
function save() { const t = FILE + '.tmp' + process.pid; fs.writeFileSync(t, JSON.stringify(S)); fs.renameSync(t, FILE); }
load();
// 多版本服务器共用文件：每次操作前重新读取
const fresh = () => load();

// 身份：已登录用账号 uid，否则用客户端 guest token
function who(tk, body) {
  const a = tk ? Accounts.bySession(tk) : null;
  if (a) return { owner: 'u:' + a.id, name: a.username, acct: true };
  const g = String(body.guest || '').replace(/[^\w]/g, '').slice(0, 40);
  if (!g) return null;
  return { owner: 'g:' + g, name: String(body.name || '玩家').slice(0, 16), acct: false };
}

// ---- 选牌 ----
const POOL_ALL = Object.values(db).filter(c => c.id && !c.id.startsWith('PR'));
function pool(colors) { return POOL_ALL.filter(c => !c.color || colors.includes(c.color)); }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function canAdd(deck, c) {
  const n = deck.filter(id => db[id].ja === c.ja).length;
  if (!c.anyNumber && n >= 4) return false;
  if (c.lucky && deck.filter(id => db[id].lucky).length >= 8) return false;
  return true;
}
// 生成 3 个候选：卡名互不相同；尽量覆盖不同种类，保证有帕鲁可选
function offer(run) {
  const R = rng(run.seed + run.deck.length * 7919);
  const P = pool(run.colors).filter(c => canAdd(run.deck, c));
  const pals = P.filter(c => c.kind === 'pal');
  const palCnt = run.deck.filter(id => db[id].kind === 'pal').length, left = PICKS - run.deck.length;
  const out = [];
  const pick = list => { const L = list.filter(c => !out.some(o => o.ja === c.ja)); if (!L.length) return; out.push(L[Math.floor(R() * L.length)]); };
  // 目标约 30~34 只帕鲁：缺口大时保证候选里有帕鲁，帕鲁过多时少给帕鲁
  const need = 30 - palCnt;
  if (need >= left - 2) { pick(pals); pick(pals); }
  else if (need > 0 && need >= left * 0.6) pick(pals);
  const pp = palCnt >= 36 ? 0.15 : palCnt >= 32 ? 0.35 : 0.5;
  const non = P.filter(c => c.kind !== 'pal');
  while (out.length < 3) { const before = out.length; pick(R() < pp ? pals : non.length ? non : P); if (out.length === before) pick(P); if (out.length === before) break; }
  return out.map(c => c.id);
}

// ---- 排行榜 ----
function boardRow(run) { return { run: run.id, owner: run.owner, name: run.name, acct: run.acct, wins: run.wins, losses: run.losses, colors: run.colors, status: run.status, t: run.updated }; }
function updateBoard(run) {
  S.board = S.board.filter(r => r.run !== run.id);
  if (run.status === 'draft') return;
  S.board.push(boardRow(run));
  // 每位玩家保留最好的 3 次 + 进行中的那次
  const by = {};
  for (const r of S.board) (by[r.owner] ||= []).push(r);
  S.board = Object.values(by).flatMap(l => l.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.t - b.t).filter((r, i) => i < 3 || r.status === 'play'));
}
function leaderboard() {
  fresh();
  const best = {};
  for (const r of S.board) { const b = best[r.owner]; if (!b || r.wins > b.wins || (r.wins === b.wins && r.losses < b.losses)) best[r.owner] = r; }
  const top = Object.values(best).sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.t - b.t).slice(0, 100);
  const live = Object.values(S.runs).filter(r => r.status === 'play').length;
  const total = Object.keys(S.runs).length;
  return { top: top.map(({ owner, ...r }) => r), live, total };
}

const pubRun = r => r && ({ id: r.id, colors: r.colors, colorsCN: r.colors.map(c => CN[c]), deck: r.deck, offer: r.offer, wins: r.wins, losses: r.losses, maxLoss: MAX_LOSS, picks: PICKS, status: r.status, history: r.history, created: r.created, name: r.name });
function current(owner) { return Object.values(S.runs).filter(r => r.owner === owner && r.status !== 'over').sort((a, b) => b.created - a.created)[0] || null; }

const api = {
  state(b, me) { fresh(); return [200, { run: pubRun(current(me.owner)), board: leaderboard() }]; },
  start(b, me) {
    fresh();
    const old = current(me.owner); if (old) { old.status = 'over'; old.updated = Date.now(); updateBoard(old); }
    const cs = COLORS.slice().sort(() => Math.random() - .5).slice(0, 2).sort((a, b) => COLORS.indexOf(a) - COLORS.indexOf(b));
    const run = { id: crypto.randomUUID(), owner: me.owner, name: me.name, acct: me.acct, colors: cs, seed: crypto.randomBytes(4).readUInt32LE(0), deck: [], offer: [], wins: 0, losses: 0, status: 'draft', history: [], created: Date.now(), updated: Date.now(), game: null };
    run.offer = offer(run);
    S.runs[run.id] = run; save();
    return [200, { run: pubRun(run) }];
  },
  pick(b, me) {
    fresh();
    const run = current(me.owner); if (!run || run.status !== 'draft') return [400, { error: '当前没有进行中的选牌' }];
    const id = run.offer[+b.i]; if (!id) return [400, { error: '无效的选择' }];
    run.deck.push(id); run.updated = Date.now();
    if (run.deck.length >= PICKS) {
      const e = validateDeck(run.deck); if (e.length) console.error('GP 卡组异常', e);
      run.status = 'play'; run.offer = []; updateBoard(run);
    } else run.offer = offer(run);
    save();
    return [200, { run: pubRun(run) }];
  },
  abandon(b, me) {
    fresh();
    const run = current(me.owner); if (!run) return [200, { run: null }];
    run.status = 'over'; run.updated = Date.now(); updateBoard(run); save();
    return [200, { run: null, ended: pubRun(run), board: leaderboard() }];
  },
};

function handle(req, res, url, send) {
  if (url.pathname === '/api/gp/board') { send(res, 200, JSON.stringify(leaderboard()), 'application/json; charset=utf-8'); return true; }
  const m = url.pathname.match(/^\/api\/gp\/(\w+)$/); if (!m || !api[m[1]]) return false;
  let body = '';
  req.on('data', d => { body += d; if (body.length > 1e5) req.destroy(); });
  req.on('end', () => {
    let j = {}; try { j = body ? JSON.parse(body) : {}; } catch (e) { }
    const me = who((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), j); if (!me) return send(res, 400, JSON.stringify({ error: '缺少身份信息' }), 'application/json; charset=utf-8');
    let r; try { r = api[m[1]](j, me); } catch (e) { console.error(e); r = [500, { error: '服务器错误' }]; }
    send(res, r[0], JSON.stringify(r[1]), 'application/json; charset=utf-8');
  });
  return true;
}

// ---- 对局 ----
const OPP_NAMES = ['流浪驯兽师', '帕鲁猎人', '遗迹探险家', '雪山向导', '火山矿工', '沙漠商队', '樱岛剑士', '黑市商人', '帕鲁研究员', '塔主候补', '牧场主', '自由佣兵'];
// 由服务器发起下一场：返回 { deck, oppDeck, oppName } 或错误
function nextMatch(tk, body) {
  fresh();
  const me = who(tk, body); if (!me) return { error: '缺少身份信息' };
  const run = current(me.owner); if (!run || run.status !== 'play') return { error: '没有可进行的大奖赛' };
  // 上一场未结束（中途离开）按失败处理
  if (run.game) { settle(run.id, run.game, false, '中途离开'); return nextMatch(tk, body); }
  const { PRESETS } = require('./engine/presets');
  const n = run.wins + run.losses;
  const R = Math.random;
  let oppDeck, style;
  // 对手：精调预设 / 知名卡组 / 强力随机，随胜场增加更偏向强卡组
  const strong = PRESETS.filter(p => (p.wr || 0) >= 0.55), any = PRESETS;
  const x = R();
  if (x < 0.25 + Math.min(0.4, run.wins * 0.05)) { const p = strong[Math.floor(R() * strong.length)] || any[0]; oppDeck = p.cards; style = p.name; }
  else if (x < 0.75) { const p = any[Math.floor(R() * any.length)]; oppDeck = p.cards; style = p.name; }
  else { oppDeck = randomDeck(R, null, true); style = '强力随机卡组'; }
  const gameId = crypto.randomUUID();
  run.game = gameId; run.updated = Date.now(); save();
  return { run: run.id, gameId, deck: run.deck, oppDeck, oppName: `${OPP_NAMES[Math.floor(R() * OPP_NAMES.length)]}（第 ${n + 1} 战）`, style, owner: me.owner };
}
function settle(runId, gameId, won, why) {
  fresh();
  const run = S.runs[runId]; if (!run || run.game !== gameId) return null;
  run.game = null;
  if (won) run.wins++; else run.losses++;
  run.history.push({ w: won ? 1 : 0, why: why || '', t: Date.now() });
  if (run.losses >= MAX_LOSS) run.status = 'over';
  run.updated = Date.now(); updateBoard(run); save();
  return pubRun(run);
}

module.exports = { handle, nextMatch, settle, leaderboard, MAX_LOSS };
