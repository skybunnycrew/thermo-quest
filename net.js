// Thermo Quest class server transport. Three interchangeable back ends with one tiny interface:
// your own server (server/relay.js, WebSocket), Supabase Realtime, or a same-browser demo.
const BAD = ['f+u+c+k+\\w*', 'sh[i1]+t+\\w*', 'b[i1]tch\\w*', 'a+ss+hole\\w*', 'cunt\\w*', 'd[i1]ck\\w*', 'pussy', 'n[i1]gg\\w*', 'f[a4]g+\\w*',
  'retard\\w*', 'whore\\w*', 'slut\\w*', 'cock\\w*', 'bastard\\w*', 'p[i1]ss\\w*', 'twat\\w*', 'wank\\w*', 'kys'];
const badRe = new RegExp('\\b(' + BAD.join('|') + ')\\b', 'gi');
const EVENTS = ['pos', 'chat', 'emote', 'announce', 'clear', 'mute', 'bd-live', 'bd-deck', 'bd-s', 'bd-a', 'bd-e', 'bd-x', 'bd-c', 'bd-l', 'bd-z', 'bd-hello', 'bd-need', 'bd-pull', 'vc'];
export function clean(s) { return String(s == null ? '' : s).replace(badRe, (m) => '*'.repeat(m.length)); }

function sid() {
  try {
    let v = window.sessionStorage.getItem('thermoquest.sid');
    if (!v) { v = Math.random().toString(36).slice(2, 10); window.sessionStorage.setItem('thermoquest.sid', v); }
    return v;
  } catch (e) { return Math.random().toString(36).slice(2, 10); }
}

export async function createNet(cfg, h) {
  cfg = cfg || {};
  const room = String(cfg.ROOM || 'thermo-quest').replace(/[^a-z0-9_-]/gi, '') || 'thermo-quest';
  const id = sid();
  if (cfg.RELAY_URL) {
    try { return await relayNet(cfg, room, id, h); }
    catch (e) {
      const n = localNet(room, id, h);
      h.onStatus('error', 'Could not reach the class server (' + String(e && e.message || e) + '). Running in demo mode.');
      return n;
    }
  }
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    try { return await supaNet(cfg, room, id, h); }
    catch (e) {
      const n = localNet(room, id, h);
      h.onStatus('error', 'Could not reach Supabase (' + String(e && e.message || e) + '). Running in demo mode.');
      return n;
    }
  }
  return localNet(room, id, h);
}

async function supaNet(cfg, room, id, h) {
  h.onStatus('connecting');
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const ch = sb.channel('tq-' + room, { config: { broadcast: { self: false }, presence: { key: id } } });
  let last = null, ready = false;
  EVENTS.forEach((ev) => ch.on('broadcast', { event: ev }, (m) => h.onEvent(ev, m.payload)));
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState(), list = [];
    Object.keys(st).forEach((k) => { const a = st[k]; if (a && a.length) list.push(Object.assign({ id: k }, a[a.length - 1])); });
    h.onPresence(list);
  });
  await new Promise((resolve, reject) => {
    const to = window.setTimeout(() => reject(new Error('no answer in 12 s; check the URL and key')), 12000);
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') { window.clearTimeout(to); ready = true; h.onStatus('online'); if (last) ch.track(last); resolve(); }
      else if (status === 'CHANNEL_ERROR') { window.clearTimeout(to); reject(err || new Error('channel error')); }
      else if (status === 'TIMED_OUT') h.onStatus('error', 'Realtime timed out; retrying.');
      else if (status === 'CLOSED') { ready = false; h.onStatus('offline'); }
    });
  });
  return {
    mode: 'supabase', id: id,
    send: (ev, payload) => { if (ready) ch.send({ type: 'broadcast', event: ev, payload: Object.assign({ from: id }, payload || {}) }); },
    track: (st) => { last = st; if (ready) ch.track(st); },
    history: async () => {
      const { data, error } = await sb.from('messages').select('name,body,kind,created_at').eq('room', room).order('created_at', { ascending: false }).limit(80);
      if (error) return { ok: false, error: error.message, list: [] };
      const rows = (data || []).reverse();
      let cut = -1; rows.forEach((r, i) => { if (r.kind === 'clear') cut = i; });
      return { ok: true, list: rows.slice(cut + 1).filter((r) => r.kind !== 'clear').slice(-50) };
    },
    save: async (m) => { try { await sb.from('messages').insert({ room: room, name: m.name || '', body: m.body || '', kind: m.kind || 'chat' }); } catch (e) {} },
    close: () => { try { sb.removeChannel(ch); } catch (e) {} }
  };
}

function localNet(room, id, h) {
  let bc = null;
  try { bc = new BroadcastChannel('thermoquest.' + room); } catch (e) {}
  const peers = {}; let last = null;
  const post = (ev, payload) => { if (bc) { try { bc.postMessage({ from: id, event: ev, payload: payload }); } catch (e) {} } };
  const emit = () => h.onPresence(Object.keys(peers).map((k) => Object.assign({ id: k }, peers[k].st)));
  if (bc) bc.onmessage = (e) => {
    const m = e.data; if (!m || m.from === id) return;
    if (m.event === 'presence') {
      const had = peers[m.from]; peers[m.from] = { st: m.payload, seen: Date.now() };
      if (!had || JSON.stringify(had.st) !== JSON.stringify(m.payload)) emit();
    } else if (m.event === 'leave') { delete peers[m.from]; emit(); }
    else if (m.event === 'hello') { if (last) post('presence', last); }
    else h.onEvent(m.event, Object.assign({ from: m.from }, m.payload || {}));
  };
  const timer = window.setInterval(() => {
    const now = Date.now(); let ch = false;
    Object.keys(peers).forEach((k) => { if (now - peers[k].seen > 4000) { delete peers[k]; ch = true; } });
    if (ch) emit();
    if (last) post('presence', last);
  }, 1000);
  window.addEventListener('beforeunload', () => post('leave'));
  post('hello');
  h.onStatus(bc ? 'demo' : 'solo');
  const HK = 'thermoquest.chat.' + room;
  const load = () => { try { return JSON.parse(window.localStorage.getItem(HK) || '[]'); } catch (e) { return []; } };
  return {
    mode: 'local', id: id,
    send: (ev, payload) => post(ev, payload),
    track: (st) => { last = st; post('presence', st); },
    history: async () => ({ ok: true, list: load() }),
    save: async (m) => {
      try {
        const list = m.kind === 'clear' ? [] : load().concat([{ name: m.name, body: m.body, kind: m.kind || 'chat' }]).slice(-50);
        window.localStorage.setItem(HK, JSON.stringify(list));
      } catch (e) {}
    },
    close: () => { window.clearInterval(timer); post('leave'); if (bc) bc.close(); }
  };
}

// Your own server: one WebSocket to server/relay.js. The server checks the teacher password,
// only forwards walking updates to people on the same screen, and keeps the last 50 chat lines.
function relayNet(cfg, room, id, h) {
  const url = cfg.RELAY_URL === 'auto' ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' : cfg.RELAY_URL;
  return new Promise((resolve, reject) => {
    let ws = null, ready = false, done = false, closed = false, tries = 0, last = null, pw = null, histWait = null;
    const authWait = [];
    const raw = (o) => { if (ready && ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (e) {} } };
    const api = {
      mode: 'relay', id: id,
      send: (ev, p) => raw({ t: 'ev', ev: ev, p: Object.assign({ from: id }, p || {}) }),
      track: (st) => { last = st; raw({ t: 'track', st: st }); },
      history: () => new Promise((r) => {
        histWait = r; raw({ t: 'hist' });
        setTimeout(() => { if (histWait === r) { histWait = null; r({ ok: false, error: 'no answer', list: [] }); } }, 6000);
      }),
      save: async (m) => raw({ t: 'save', m: m }),
      auth: (p) => new Promise((r) => {
        pw = p; authWait.push(r); raw({ t: 'auth', pw: p });
        setTimeout(() => { const i = authWait.indexOf(r); if (i >= 0) { authWait.splice(i, 1); r(false); } }, 6000);
      }),
      close: () => { closed = true; try { ws.close(); } catch (e) {} }
    };
    const open = () => {
      h.onStatus('connecting');
      try { ws = new WebSocket(url); } catch (e) { if (!done) { done = true; closed = true; reject(e); } return; }
      ws.onopen = () => {
        ready = true; tries = 0;
        ws.send(JSON.stringify({ t: 'hello', room: room, id: id, st: last }));
        if (pw) ws.send(JSON.stringify({ t: 'auth', pw: pw }));
        h.onStatus('online');
        if (!done) { done = true; resolve(api); }
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === 'presence') h.onPresence(m.list || []);
        else if (m.t === 'ev') h.onEvent(m.ev, m.p || {});
        else if (m.t === 'hist') { if (histWait) { const r = histWait; histWait = null; r({ ok: true, list: m.list || [] }); } }
        else if (m.t === 'auth') { if (!m.ok) pw = null; const r = authWait.shift(); if (r) r(!!m.ok); }
        else if (m.t === 'err') h.onStatus('error', String(m.msg || 'server error'));
      };
      ws.onclose = () => {
        ready = false;
        if (closed) return;
        if (!done) { done = true; closed = true; reject(new Error('no answer from ' + url)); return; }
        h.onStatus('offline');
        tries++; setTimeout(open, Math.min(10000, 1000 * tries));
      };
    };
    open();
    setTimeout(() => { if (!done) { done = true; closed = true; try { ws.close(); } catch (e) {} reject(new Error('no answer from ' + url + ' in 8 s')); } }, 8000);
  });
}
