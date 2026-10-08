'use strict';
// 用 Chrome DevTools 协议截图：node test/shot.js URL out.png waitMs [js...]
const { spawn } = require('child_process');
const fs = require('fs');
const [url, out, wait = 5000, ...scripts] = process.argv.slice(2);
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333 + Math.floor(Math.random() * 500);
const ch = spawn(C, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, '--window-size=1500,950', `--user-data-dir=/tmp/ptcg-chrome-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs;
  for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const tab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pend = {};
  const call = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) pend[m.id](m.result || m); if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Runtime.exceptionThrown') console.log('console:', JSON.stringify(m.params).slice(0, 300)); };
  await new Promise(r => ws.onopen = r);
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url });
  await sleep(+wait);
  for (const s of scripts) {
    const r = await call('Runtime.evaluate', { expression: s, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.value !== undefined) console.log('eval:', JSON.stringify(r.result.value).slice(0, 500));
    await sleep(1500);
  }
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  ch.kill(); process.exit(0);
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
