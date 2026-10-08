'use strict';
// 账号系统（零依赖）。所有账号数据存放在"版本无关"的数据目录中（默认 <仓库>/userdata，
// 可用环境变量 PTCG_DATA 指定），各版本服务器共用同一目录，升级版本不会丢失进度。
//   accounts/<uid>.json  { id, username, salt, hash, created, updated, data:{键:值}, rev }
//   sessions.json        { token: { uid, t } }
// data 为客户端同步的键值（卡组、对局历史、残局进度、收藏、偏好设置……），服务器按键合并，不解析其内容。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = process.env.PTCG_DATA || path.resolve(__dirname, '..', 'userdata');
const ACC = path.join(DATA, 'accounts');
const SESS = path.join(DATA, 'sessions.json');
fs.mkdirSync(ACC, { recursive: true });

const MAX_DATA = 4 * 1024 * 1024; // 单账号数据上限 4MB
const SESSION_TTL = 180 * 86400e3;  // 登录有效期 180 天

function writeAtomic(f, s) { const t = f + '.tmp' + process.pid; fs.writeFileSync(t, s); fs.renameSync(t, f); }
const uidOf = name => crypto.createHash('sha256').update(String(name).trim().toLowerCase()).digest('hex').slice(0, 20);
const accFile = uid => path.join(ACC, uid + '.json');
function load(uid) { try { return JSON.parse(fs.readFileSync(accFile(uid), 'utf8')); } catch (e) { return null; } }
function save(a) {
  const f = accFile(a.id);
  try { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak'); } catch (e) { }
  a.updated = Date.now(); writeAtomic(f, JSON.stringify(a));
}
// 多个版本的服务器可能同时运行并共用 sessions.json：读取时以磁盘为准，写入时先合并
const readSess = () => { try { return JSON.parse(fs.readFileSync(SESS, 'utf8')); } catch (e) { return {}; } };
let sessions = readSess(); const removed = new Set();
function saveSessions() {
  const now = Date.now(), disk = readSess();
  for (const k of removed) delete disk[k]; removed.clear();
  sessions = Object.assign(disk, sessions);
  for (const k in sessions) if (now - sessions[k].t > SESSION_TTL) delete sessions[k];
  writeAtomic(SESS, JSON.stringify(sessions));
}
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
const pub = a => ({ id: a.id, username: a.username, created: a.created });

function newSession(a) { const tk = crypto.randomBytes(24).toString('hex'); sessions[tk] = { uid: a.id, t: Date.now() }; saveSessions(); return tk; }
function bySession(tk) {
  if (tk && !sessions[tk]) { const d = readSess(); if (d[tk]) sessions[tk] = d[tk]; }
  const s = tk && sessions[tk]; if (!s) return null;
  if (Date.now() - s.t > SESSION_TTL) { delete sessions[tk]; return null; }
  return load(s.uid);
}
function checkName(u) {
  u = String(u || '').trim();
  if (u.length < 2 || u.length > 16) return '用户名需 2~16 个字符';
  if (/[\s<>"'&\\/]/.test(u)) return '用户名不能包含空格或特殊符号';
  return null;
}
// 简单防爆破：同一用户名 10 分钟内失败 10 次即暂时锁定
const fails = new Map();
function tooMany(uid) { const f = fails.get(uid); return f && f.n >= 10 && Date.now() - f.t < 600e3; }
function fail(uid) { const f = fails.get(uid) || { n: 0, t: Date.now() }; if (Date.now() - f.t > 600e3) { f.n = 0; f.t = Date.now(); } f.n++; fails.set(uid, f); }

const api = {
  register({ username, password, data }) {
    const e = checkName(username); if (e) return [400, { error: e }];
    if (String(password || '').length < 4) return [400, { error: '密码至少 4 位' }];
    const uid = uidOf(username); if (load(uid)) return [409, { error: '该用户名已被注册' }];
    const salt = crypto.randomBytes(16).toString('hex');
    const a = { id: uid, username: String(username).trim(), salt, hash: hashPw(password, salt), created: Date.now(), data: {}, rev: 0 };
    if (data && typeof data === 'object') for (const [k, v] of Object.entries(data)) if (typeof v === 'string') a.data[k] = v;
    if (JSON.stringify(a.data).length > MAX_DATA) a.data = {};
    save(a);
    return [200, { token: newSession(a), user: pub(a), data: a.data, rev: a.rev }];
  },
  login({ username, password }) {
    const uid = uidOf(username || ''); if (tooMany(uid)) return [429, { error: '尝试次数过多，请 10 分钟后再试' }];
    const a = load(uid);
    if (!a || hashPw(password || '', a.salt) !== a.hash) { fail(uid); return [403, { error: '用户名或密码错误' }]; }
    fails.delete(uid);
    return [200, { token: newSession(a), user: pub(a), data: a.data, rev: a.rev }];
  },
  me(_, a) { return [200, { user: pub(a), data: a.data, rev: a.rev }]; },
  // patch: { 键: 字符串值 | null(删除) }
  data({ patch }, a) {
    if (!patch || typeof patch !== 'object') return [400, { error: '格式错误' }];
    for (const [k, v] of Object.entries(patch)) {
      if (!/^ptcg_[a-z0-9_]{1,40}$/.test(k)) continue;
      if (v === null) delete a.data[k]; else if (typeof v === 'string') a.data[k] = v;
    }
    if (JSON.stringify(a.data).length > MAX_DATA) return [413, { error: '账号数据过大' }];
    a.rev = (a.rev || 0) + 1; save(a);
    return [200, { ok: true, rev: a.rev }];
  },
  password({ old, password }, a) {
    if (hashPw(old || '', a.salt) !== a.hash) return [403, { error: '原密码错误' }];
    if (String(password || '').length < 4) return [400, { error: '新密码至少 4 位' }];
    a.salt = crypto.randomBytes(16).toString('hex'); a.hash = hashPw(password, a.salt); save(a);
    return [200, { ok: true }];
  },
  logout(_, a, tk) { delete sessions[tk]; removed.add(tk); saveSessions(); return [200, { ok: true }]; },
};
const NEED_AUTH = new Set(['me', 'data', 'password', 'logout']);

// 处理 /api/account/<op>，返回 true 表示已处理
function handle(req, res, url, send) {
  const m = url.pathname.match(/^\/api\/account\/(\w+)$/); if (!m || !api[m[1]]) return false;
  const op = m[1];
  let body = '';
  req.on('data', d => { body += d; if (body.length > MAX_DATA * 1.5) req.destroy(); });
  req.on('end', () => {
    let j = {}; try { j = body ? JSON.parse(body) : {}; } catch (e) { return send(res, 400, JSON.stringify({ error: '格式错误' }), 'application/json; charset=utf-8'); }
    const tk = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let a = null;
    if (NEED_AUTH.has(op)) { a = bySession(tk); if (!a) return send(res, 401, JSON.stringify({ error: '登录已失效，请重新登录' }), 'application/json; charset=utf-8'); }
    let r; try { r = api[op](j, a, tk); } catch (e) { console.error(e); r = [500, { error: '服务器错误' }]; }
    send(res, r[0], JSON.stringify(r[1]), 'application/json; charset=utf-8');
  });
  return true;
}
module.exports = { handle, bySession, DATA };
