// Thermo Quest lecture voice. Mic -> 16 kHz mu-law chunks (40 ms) over the class relay -> jitter-buffered playback.
// Plain WebSocket audio, so it works through Cloudflare Tunnel (which cannot carry WebRTC's UDP media).
const RATE = 16000, CHUNK = 640;
let ctx = null;
export function audioCtx() { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); } return ctx; }
export function resume() {
  const c = audioCtx();
  if (c.state === 'running') return Promise.resolve(true);
  return c.resume().then(() => c.state === 'running').catch(() => false);
}
export function running() { return !!ctx && ctx.state === 'running'; }

function muEnc(x) {
  let s = Math.round(Math.max(-1, Math.min(1, x)) * 32767);
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  s = Math.min(32635, s) + 132;
  let exp = 7;
  for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xff;
}
const DEC = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff, exp = (u >> 4) & 7, s = ((((u & 0x0f) << 3) + 132) << exp) - 132;
  DEC[i] = (u & 0x80 ? -s : s) / 32768;
}

const WORKLET = "class Cap extends AudioWorkletProcessor { process(ins) { const c = ins[0] && ins[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; } } registerProcessor('tq-cap', Cap);";

// onChunk(base64) fires every 40 ms while there is sound; silence (after a short tail) is not sent.
export async function startMic(onChunk) {
  const c = audioCtx();
  await resume();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const src = c.createMediaStreamSource(stream), mute = c.createGain();
  mute.gain.value = 0; mute.connect(c.destination);
  const ratio = c.sampleRate / RATE, buf = new Uint8Array(CHUNK);
  let q = new Float32Array(0), t = 0, n = 0, sq = 0, quiet = 99;
  const api = { level: 0, stop: null };
  const feed = (f) => {
    const nq = new Float32Array(q.length + f.length); nq.set(q); nq.set(f, q.length); q = nq;
    while (t + ratio <= q.length) {
      const a = Math.floor(t), b = Math.max(a + 1, Math.floor(t + ratio));
      let sum = 0; for (let i = a; i < b; i++) sum += q[i];
      const v = sum / (b - a);
      buf[n++] = muEnc(v); sq += v * v; t += ratio;
      if (n === CHUNK) {
        const rms = Math.sqrt(sq / CHUNK); api.level = rms; n = 0; sq = 0;
        quiet = rms < 0.004 ? quiet + 1 : 0;
        if (quiet < 10) onChunk(btoa(String.fromCharCode.apply(null, buf)));
      }
    }
    const drop = Math.floor(t); q = q.slice(drop); t -= drop;
  };
  let node;
  if (c.audioWorklet && window.AudioWorkletNode) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await c.audioWorklet.addModule(url);
    node = new AudioWorkletNode(c, 'tq-cap');
    node.port.onmessage = (e) => feed(e.data);
  } else {
    node = c.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = (e) => feed(e.inputBuffer.getChannelData(0).slice(0));
  }
  src.connect(node); node.connect(mute);
  api.stop = () => { stream.getTracks().forEach((tr) => tr.stop()); try { src.disconnect(); node.disconnect(); mute.disconnect(); } catch (e) {} };
  return api;
}

const players = {};
export function play(from, b64) {
  const c = audioCtx();
  if (c.state !== 'running' || !b64) return;
  const bin = atob(b64), len = bin.length;
  if (!len) return;
  const ab = c.createBuffer(1, len, RATE), ch = ab.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = DEC[bin.charCodeAt(i)];
  let p = players[from];
  if (!p) { p = players[from] = { next: 0, gain: c.createGain() }; p.gain.connect(c.destination); }
  const now = c.currentTime;
  if (p.next < now + 0.02 || p.next > now + 1.2) p.next = now + 0.2;
  const s = c.createBufferSource();
  s.buffer = ab; s.connect(p.gain); s.start(p.next);
  p.next += len / RATE;
}
export function speaking(from) { const p = players[from]; return !!p && !!ctx && ctx.currentTime < p.next + 0.15; }
