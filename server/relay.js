// Thermo Quest class server: serves the game files and relays chat, walking, emotes and the
// lecture board. Needs Node 18 or newer. In this folder run:  npm install   then   npm start
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// Your settings live in config.json (a copy of config.example.json). Git ignores it, so pulling updates never touches your password.
const CFG_FILE = ['config.json', 'config.example.json'].map((f) => path.join(__dirname, f)).find((f) => fs.existsSync(f));
const CFG = Object.assign({ port: 8080, teacherPassword: 'change-me', room: 'thermo-quest', gameDir: '..' },
  CFG_FILE ? JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')) : {});
if (process.env.PORT) CFG.port = Number(process.env.PORT);
if (process.env.TEACHER_PASSWORD) CFG.teacherPassword = process.env.TEACHER_PASSWORD;
const ROOT = path.resolve(__dirname, CFG.gameDir);
const HIST_FILE = path.join(__dirname, 'chat-history.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8' };
// Everything else (announcements, mutes, every lecture-board stroke) is teacher-only.
// Students may only send voice ('vc') while the teacher has given them the floor.
const STUDENT_EVENTS = new Set(['pos', 'chat', 'emote', 'vc', 'bd-hello', 'bd-need', 'bd-pull']);
const REC_DIR = path.join(__dirname, 'recordings');
try { fs.mkdirSync(REC_DIR, { recursive: true }); } catch (e) {}

let history = {};
try { history = JSON.parse(fs.readFileSync(HIST_FILE, 'utf8')); } catch (e) {}
let histTimer = null;
function saveHistory() { clearTimeout(histTimer); histTimer = setTimeout(() => fs.writeFile(HIST_FILE, JSON.stringify(history), () => {}), 1000); }
function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }

// ---- static files (the server folder itself is never served, so config.json stays private) ----
const server = http.createServer((req, res) => {
  let url = '/';
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) {}
  if (url === '/multiplayer-config.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end('window.THERMO_NET = { RELAY_URL: "auto", ROOM: ' + JSON.stringify(CFG.room) + ' };\n');
  }
  if (url === '/recordings/index.json') {
    let list = '[]';
    try { list = fs.readFileSync(path.join(REC_DIR, 'index.json'), 'utf8'); } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(list);
  }
  const rm = /^\/recordings\/([A-Za-z0-9_-]+\.(wav|jsonl))$/.exec(url);
  if (rm) return sendFile(req, res, path.join(REC_DIR, rm[1]), rm[2] === 'wav' ? 'audio/wav' : 'application/x-ndjson');
  if (url === '/') url = '/Thermo Quest.dc.html';
  const file = path.resolve(ROOT, '.' + url), rel = path.relative(ROOT, file), parts = rel.split(path.sep);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || parts[0] === 'server' || parts.some((p) => p.startsWith('.'))) { res.writeHead(404); return res.end('Not found'); }
  sendFile(req, res, file, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
});
// Range requests let the replay player seek inside long lecture recordings.
function sendFile(req, res, file, type) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let a = m[1] ? parseInt(m[1], 10) : st.size - parseInt(m[2], 10), b = m[1] && m[2] ? parseInt(m[2], 10) : st.size - 1;
      a = Math.max(0, a); b = Math.min(b, st.size - 1);
      if (a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + a + '-' + b + '/' + st.size, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// ---- relay ----
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });
const rooms = new Map();
function roomOf(name) {
  let r = rooms.get(name);
  if (!r) { r = { clients: new Map(), muted: new Set(), timer: null }; rooms.set(name, r); }
  return r;
}
function send(c, o) { if (c.ws.readyState === 1) c.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
function cleanLook(l) {
  const o = {};
  if (l && typeof l === 'object') ['skin', 'hair', 'shirt', 'pants', 'hat', 'style'].forEach((k) => { if (typeof l[k] === 'string') o[k] = l[k].slice(0, 12); });
  return o;
}
function cleanState(c, st) {
  st = st && typeof st === 'object' ? st : {};
  const o = { name: clip(st.name, 14), look: cleanLook(st.look), sc: clip(st.sc, 16), x: Number(st.x) || 0, y: Number(st.y) || 0,
    inside: clip(st.inside, 24), teacher: c.teacher, hand: !!st.hand };
  if (c.teacher) {
    o.muted = Array.isArray(st.muted) ? st.muted.slice(0, 80).map((v) => clip(v, 16)) : [];
    o.announce = clip(st.announce, 140); o.lec = clip(st.lec, 16); o.floor = clip(st.floor, 16);
  }
  return o;
}
function presence(r) {
  clearTimeout(r.timer);
  r.timer = setTimeout(() => {
    const list = [];
    r.clients.forEach((c) => { if (c.st) list.push(Object.assign({ id: c.id }, c.st)); });
    const msg = JSON.stringify({ t: 'presence', list: list });
    r.clients.forEach((c) => send(c, msg));
  }, 150);
}

// ---- lecture recording: every broadcast board event + all voice, written while the lecture is live ----
const DEC = new Int16Array(256);
for (let i = 0; i < 256; i++) { const u = ~i & 0xff, e = (u >> 4) & 7, v = ((((u & 0x0f) << 3) + 132) << e) - 132; DEC[i] = u & 0x80 ? -v : v; }
function recStart(r, c) {
  recStop(r);
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const id = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '-' + crypto.randomBytes(2).toString('hex');
  r.rec = { id: id, t0: Date.now(), by: c.id, teacher: c.st ? c.st.name : '', parts: {}, voice: [], next: {},
    out: fs.createWriteStream(path.join(REC_DIR, id + '.jsonl'), { flags: 'a' }) };
}
function recEvent(r, ev, p) {
  const rec = r.rec, t = Date.now() - rec.t0;
  if (ev === 'bd-z') {
    const e = rec.parts[p.m] || (rec.parts[p.m] = { n: p.n, got: 0, d: [] });
    if (e.d[p.i] == null) { e.d[p.i] = p.d; e.got++; }
    if (e.got < e.n) return;
    delete rec.parts[p.m];
    try { rec.out.write(JSON.stringify({ t: t, ev: p.e, p: JSON.parse(e.d.join('')) }) + '\n'); } catch (x) {}
    return;
  }
  const q = Object.assign({}, p); delete q.from;
  rec.out.write(JSON.stringify({ t: t, ev: ev, p: q }) + '\n');
}
function recVoice(r, from, b64) {
  const rec = r.rec, bytes = Buffer.from(String(b64), 'base64');
  if (!bytes.length) return;
  // Keep each speaker's chunks back to back; after a pause, start again at the real arrival time.
  const at = Math.max(0, Math.round((Date.now() - rec.t0) * 16) - bytes.length), nx = rec.next[from];
  const start = nx != null && Math.abs(at - nx) < 4800 ? nx : at;
  rec.next[from] = start + bytes.length;
  rec.voice.push([start, bytes]);
}
function recStop(r) {
  const rec = r.rec;
  if (!rec) return;
  r.rec = null;
  rec.out.end();
  const ms = Date.now() - rec.t0;
  if (ms < 5000) return;
  let len = Math.round(ms * 16);
  rec.voice.forEach((v) => { len = Math.max(len, v[0] + v[1].length); });
  const mix = new Int32Array(len);
  rec.voice.forEach((v) => { for (let i = 0; i < v[1].length; i++) mix[v[0] + i] += DEC[v[1][i]]; });
  const wav = Buffer.alloc(44 + len * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + len * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(len * 2, 40);
  for (let i = 0; i < len; i++) wav.writeInt16LE(Math.max(-32768, Math.min(32767, mix[i])), 44 + i * 2);
  fs.writeFile(path.join(REC_DIR, rec.id + '.wav'), wav, () => {
    let list = [];
    try { list = JSON.parse(fs.readFileSync(path.join(REC_DIR, 'index.json'), 'utf8')); } catch (e) {}
    list.unshift({ id: rec.id, started: new Date(rec.t0).toISOString(), minutes: Math.max(1, Math.round(ms / 60000)), teacher: rec.teacher });
    fs.writeFile(path.join(REC_DIR, 'index.json'), JSON.stringify(list, null, 1), () => {});
    console.log('Saved lecture recording ' + rec.id + ' (' + Math.round(ms / 60000) + ' min)');
  });
}

wss.on('connection', (ws) => {
  const c = { ws: ws, id: null, room: null, st: null, teacher: false, alive: true, tokens: 150, at: Date.now() };
  ws.c = c;
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    c.tokens = Math.min(150, c.tokens + (now - c.at) * 0.1); c.at = now;   // about 100 messages a second per person
    if (c.tokens < 1) return;
    c.tokens -= 1;
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (c.room) return;
      c.id = clip(m.id, 16).replace(/[^a-z0-9]/gi, '') || crypto.randomBytes(4).toString('hex');
      c.room = clip(m.room || CFG.room, 40).replace(/[^a-z0-9_-]/gi, '') || CFG.room;
      const r = roomOf(c.room), old = r.clients.get(c.id);
      if (old && old !== c) { try { old.ws.close(); } catch (e) {} }
      r.clients.set(c.id, c);
      if (m.st) c.st = cleanState(c, m.st);
      presence(r);
      return;
    }
    if (!c.room) return;
    const r = roomOf(c.room);
    if (m.t === 'track') {
      c.st = cleanState(c, m.st);
      if (c.teacher) r.muted = new Set(c.st.muted);
      presence(r);
    } else if (m.t === 'auth') {
      const ok = typeof m.pw === 'string' && m.pw.length > 0 && same(m.pw, CFG.teacherPassword);
      c.teacher = ok;
      if (c.st) c.st = cleanState(c, c.st);
      send(c, { t: 'auth', ok: ok });
      presence(r);
    } else if (m.t === 'hist') {
      send(c, { t: 'hist', list: history[c.room] || [] });
    } else if (m.t === 'save') {
      const mm = m.m || {};
      if (mm.kind === 'clear') { if (c.teacher) { history[c.room] = []; saveHistory(); } return; }
      if (r.muted.has(c.id)) return;
      const list = history[c.room] || (history[c.room] = []);
      list.push({ name: clip(mm.name, 14), body: clip(mm.body, 200), kind: 'chat' });
      if (list.length > 50) list.splice(0, list.length - 50);
      saveHistory();
    } else if (m.t === 'ev') {
      const ev = clip(m.ev, 16), p = m.p && typeof m.p === 'object' ? m.p : {};
      if (!STUDENT_EVENTS.has(ev) && !c.teacher) return;
      if (ev === 'chat' && r.muted.has(c.id)) return;
      if (ev === 'vc') {
        if (!c.teacher) { let ok = false; r.clients.forEach((o) => { if (o.teacher && o.st && o.st.floor === c.id) ok = true; }); if (!ok) return; }
        const vm = JSON.stringify({ t: 'ev', ev: 'vc', p: { from: c.id, d: clip(p.d, 4000) } });
        r.clients.forEach((o) => { if (o !== c && o.st && o.st.sc === 'lecture') send(o, vm); });   // voice is heard in the Lecture Hall only
        if (r.rec) recVoice(r, c.id, p.d);
        return;
      }
      if (ev === 'bd-live' && c.teacher) { if (p.on) recStart(r, c); else recStop(r); }
      if (r.rec && c.teacher && !p.to && ev.indexOf('bd-') === 0) recEvent(r, ev, p);
      if (ev === 'mute') { const who = clip(p.target, 16); if (p.on) r.muted.add(who); else r.muted.delete(who); }
      p.from = c.id;
      const msg = JSON.stringify({ t: 'ev', ev: ev, p: p });
      if (p.to) { const dest = r.clients.get(clip(p.to, 16)); if (dest) send(dest, msg); return; }
      r.clients.forEach((o) => {
        if (o === c) return;
        if (ev === 'pos' && o.st && o.st.sc !== p.sc) return;   // walking only matters on the same screen
        send(o, msg);
      });
    }
  });
  ws.on('close', () => {
    if (!c.room) return;
    const r = roomOf(c.room);
    if (r.clients.get(c.id) === c) r.clients.delete(c.id);
    if (r.rec && r.rec.by === c.id) recStop(r);
    presence(r);
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    const c = ws.c;
    if (!c) return;
    if (!c.alive) { ws.terminate(); return; }
    c.alive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 25000);

server.listen(CFG.port, () => {
  console.log('Thermo Quest server is running.');
  console.log('  Game:  http://localhost:' + CFG.port + '/');
  console.log('  Relay: ws://localhost:' + CFG.port + '/ws');
  if (CFG.teacherPassword === 'change-me') console.log('  WARNING: set a real password: cp config.example.json config.json, edit teacherPassword, restart.');
});
