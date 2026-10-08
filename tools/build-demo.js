#!/usr/bin/env node
// 构建纯浏览器单机版到 dist/（零依赖）。
//   node tools/build-demo.js            → dist/（可直接用任意静态服务器或 GitHub Pages 托管）
// 原理：把 server/ 下的服务端代码（规则引擎、AI、账号、大奖赛…）打包成一个 Web Worker 脚本，
// 用 web/worker-prelude.js 中的替身实现 fs/path/crypto/http；页面端 web/demo.js 拦截 fetch 与 WebSocket 转发给 Worker。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, process.argv[2] || 'dist');
const V = '/app';                                   // Worker 中仓库根目录的虚拟路径
const virt = f => V + '/' + path.relative(ROOT, f).split(path.sep).join('/');
const BUILTIN = new Set(['fs', 'path', 'crypto', 'http', 'events']);
const REPLACE = { [path.join(ROOT, 'server/ws.js')]: '#ws' };
// 运行时通过 fs.readFileSync 读取的数据文件
const DATA_FILES = ['data/cards_base.json', 'server/engine/tuned_decks.json', 'server/engine/deck_winrates.json', 'server/ai_value.json', 'public/rarity.json', 'server/puzzle_guides.json'];

const mods = {};
function resolve(from, spec) {
  if (BUILTIN.has(spec)) return spec;
  const base = path.resolve(path.dirname(from), spec);
  for (const f of [base, base + '.js', base + '.json', path.join(base, 'index.js')]) if (fs.existsSync(f) && fs.statSync(f).isFile()) return REPLACE[f] || f;
  throw new Error(`无法解析 ${spec}（来自 ${from}）`);
}
function add(f) {
  if (BUILTIN.has(f) || f.startsWith('#') || mods[f]) return;
  const src = fs.readFileSync(f, 'utf8');
  const m = mods[f] = { src, deps: {} };
  if (f.endsWith('.json')) return;
  for (const [, spec] of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const r = resolve(f, spec); m.deps[spec] = BUILTIN.has(r) || r.startsWith('#') ? r : virt(r); add(r);
  }
}
const entry = path.join(ROOT, 'server/server.js');
add(entry);
let out = '/* 幻兽帕鲁卡牌游戏 · 浏览器单机版服务端（自动生成，请勿手改）*/\n';
out += 'const __MODULES__ = {\n';
for (const [f, m] of Object.entries(mods)) {
  out += JSON.stringify(virt(f)) + ': ' + (f.endsWith('.json')
    ? `{ json: ${JSON.stringify(m.src)} }`
    : `{ deps: ${JSON.stringify(m.deps)}, fn: function (module, exports, require, __dirname, __filename, process) {\n${m.src}\n} }`) + ',\n';
}
out += '};\nconst __FILES__ = {\n';
for (const f of DATA_FILES) { const p = path.join(ROOT, f); if (fs.existsSync(p)) out += JSON.stringify(V + '/' + f) + ': ' + JSON.stringify(fs.readFileSync(p, 'utf8')) + ',\n'; }
out += `};\nconst __ENTRY__ = ${JSON.stringify(virt(entry))};\n`;
out += fs.readFileSync(path.join(ROOT, 'web/worker-prelude.js'), 'utf8');

// 输出：public/ 全部静态资源 + Worker 脚本 + 页面入口
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'server.bundle.js'), out);
fs.copyFileSync(path.join(ROOT, 'web/demo.js'), path.join(OUT, 'demo.js'));
const idx = path.join(OUT, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
html = html.replace(/<script /, '<script src="/demo.js"></script>\n<script ');
fs.writeFileSync(idx, html);
// 单机版文案：排行榜只有本机记录、账号不跨设备同步
const TXT = { 'app.js': [['全服最佳', '本机最佳']], 'gp.js': [['全服排行榜', '本机排行榜'], ['登录账号后成绩会以账号名上榜，并在各设备同步', '单机版：成绩与存档保存在本机浏览器']] };
for (const [f, reps] of Object.entries(TXT)) { const p = path.join(OUT, f); let t = fs.readFileSync(p, 'utf8'); for (const [a, b] of reps) { if (!t.includes(a)) throw new Error('文案未找到：' + a); t = t.split(a).join(b); } fs.writeFileSync(p, t); }
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '404.html'), html);
console.log(`单机版已生成：${path.relative(process.cwd(), OUT) || '.'}  模块 ${Object.keys(mods).length} 个  server.bundle.js ${(out.length / 1024).toFixed(0)} KB`);
