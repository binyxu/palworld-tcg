'use strict';
// 零依赖的极简 WebSocket 服务端（RFC 6455，仅文本帧）
const crypto = require('crypto');
const EventEmitter = require('events');

class WS extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket; this.buf = Buffer.alloc(0); this.open = true; this.frags = [];
    socket.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.parse(); });
    socket.on('close', () => this.close());
    socket.on('error', () => this.close());
  }
  parse() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 4 * 1024 * 1024) return this.close();
      const mOff = off; if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let data = this.buf.slice(off, off + len);
      if (masked) { const m = this.buf.slice(mOff, mOff + 4); data = Buffer.from(data.map((x, i) => x ^ m[i & 3])); }
      this.buf = this.buf.slice(off + len);
      if (op === 0x8) return this.close();
      if (op === 0x9) { this.frame(0xA, data); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x0) {
        this.frags.push(data);
        if (fin) { const msg = Buffer.concat(this.frags).toString('utf8'); this.frags = []; this.emit('message', msg); }
      }
    }
  }
  frame(op, data) {
    if (!this.open) return;
    const len = data.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    try { this.socket.write(Buffer.concat([head, data])); } catch (e) { this.close(); }
  }
  send(obj) { this.frame(0x1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj))); }
  close() {
    if (!this.open) return;
    this.open = false;
    try { this.socket.end(); } catch (e) { /* ignore */ }
    this.emit('close');
  }
}
function upgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return null; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  socket.setNoDelay(true);
  return new WS(socket);
}
module.exports = { upgrade };
