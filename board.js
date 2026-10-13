// Thermo Quest lecture board: paper, pressure ink, eraser hit-tests, PDF/image import, local save.
export const BW = 1600, BH = 900;
export const INKS = {
  light: ['#1b1b22', '#d0302a', '#1f5fbf', '#1e8a4a', '#e07a10', '#7a3fb0'],
  dark: ['#f4f1e8', '#f8d040', '#6cd0f0', '#f088b0', '#8ce070', '#f0a060']
};
export const SIZES = [3, 5.5, 10];
export function isDark(pg) { return !!pg && pg.kind === 'dark'; }

export function paintPaper(g, pg, img, k) {
  const W = BW * k, H = BH * k, kind = pg ? pg.kind : 'blank';
  if (kind === 'dark') {
    g.fillStyle = '#1f2b26'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 240; i++) g.fillRect(((i * 977) % 1600) * k, ((i * 571) % 900) * k, 46 * k, 2 * k);
    return;
  }
  g.fillStyle = kind === 'grid' ? '#f1f6ea' : '#fbfaf6'; g.fillRect(0, 0, W, H);
  if (kind === 'grid') {
    const t = Math.max(1, k);
    for (let x = 0; x <= BW; x += 40) { g.fillStyle = x % 200 ? '#d6e5cc' : '#b2cc9f'; g.fillRect(x * k, 0, t, H); }
    for (let y = 0; y <= BH; y += 40) { g.fillStyle = y % 200 ? '#d6e5cc' : '#b2cc9f'; g.fillRect(0, y * k, W, t); }
  }
  if (kind === 'slide') {
    if (img && img.complete && img.naturalWidth) {
      const s = Math.min(BW / img.naturalWidth, BH / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.drawImage(img, (BW - w) / 2 * k, (BH - h) / 2 * k, w * k, h * k);
    } else {
      g.fillStyle = '#8b83a8'; g.font = Math.round(30 * k) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Loading slide\u2026', W / 2, H / 2);
    }
  }
}

// Pen strokes taper with pressure (p is 0-100); highlighter is one flat translucent path.
export function drawStroke(g, s, k, dark, wm) {
  const p = s.pts, n = Math.floor(p.length / 3);
  if (!n) return;
  wm = wm || 1;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (s.t === 'hl') {
    g.save();
    g.globalAlpha = dark ? 0.4 : 0.34; g.globalCompositeOperation = dark ? 'source-over' : 'multiply';
    g.strokeStyle = s.c; g.lineWidth = s.w * 4 * k * wm;
    g.beginPath(); g.moveTo(p[0] * k, p[1] * k);
    for (let i = 1; i < n; i++) g.lineTo(p[i * 3] * k, p[i * 3 + 1] * k);
    if (n === 1) g.lineTo(p[0] * k + 0.1, p[1] * k);
    g.stroke(); g.restore();
    return;
  }
  g.strokeStyle = s.c; g.fillStyle = s.c;
  const wid = (i) => s.w * k * wm * (0.35 + 0.9 * (p[i * 3 + 2] / 100));
  if (n === 1) { g.beginPath(); g.arc(p[0] * k, p[1] * k, wid(0) / 2, 0, 7); g.fill(); return; }
  let mx = p[0], my = p[1];
  for (let i = 1; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1];
    const nx = i < n - 1 ? (x + p[i * 3 + 3]) / 2 : x, ny = i < n - 1 ? (y + p[i * 3 + 4]) / 2 : y;
    g.lineWidth = (wid(i - 1) + wid(i)) / 2;
    g.beginPath(); g.moveTo(mx * k, my * k); g.quadraticCurveTo(x * k, y * k, nx * k, ny * k); g.stroke();
    mx = nx; my = ny;
  }
}

const BB = new WeakMap();
export function hitStroke(s, x, y, r) {
  let b = BB.get(s);
  if (!b || b.n !== s.pts.length) {
    let a = 1e9, c = 1e9, d = -1e9, e = -1e9;
    for (let i = 0; i < s.pts.length; i += 3) { a = Math.min(a, s.pts[i]); c = Math.min(c, s.pts[i + 1]); d = Math.max(d, s.pts[i]); e = Math.max(e, s.pts[i + 1]); }
    b = { n: s.pts.length, box: [a, c, d, e] }; BB.set(s, b);
  }
  const pad = r + s.w * (s.t === 'hl' ? 2 : 0.7), q = b.box;
  if (x < q[0] - pad || x > q[2] + pad || y < q[1] - pad || y > q[3] + pad) return false;
  for (let i = 0; i < s.pts.length; i += 3) { const dx = s.pts[i] - x, dy = s.pts[i + 1] - y; if (dx * dx + dy * dy < pad * pad) return true; }
  return false;
}

let pdfjs = null;
async function getPdf() {
  if (!pdfjs) {
    pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs';
  }
  return pdfjs;
}
function toUrl(c) { const w = c.toDataURL('image/webp', 0.82); return w.indexOf('data:image/webp') === 0 ? w : c.toDataURL('image/jpeg', 0.84); }
function sheet(w, h) { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); return [c, g]; }

// Every PDF page / image becomes one slide image that fits inside the 1600x900 board.
export async function importFiles(files, onProgress) {
  const out = [];
  for (const f of Array.from(files || [])) {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const lib = await getPdf();
      const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        if (onProgress) onProgress('Reading ' + f.name + ': page ' + i + ' of ' + doc.numPages);
        const page = await doc.getPage(i), v0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(BW / v0.width, BH / v0.height) });
        const [c, g] = sheet(vp.width, vp.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        out.push({ url: toUrl(c) });
      }
    } else if (/^image\//.test(f.type)) {
      if (onProgress) onProgress('Reading ' + f.name);
      const bmp = await createImageBitmap(f), s = Math.min(1, BW / bmp.width, BH / bmp.height);
      const [c, g] = sheet(bmp.width * s, bmp.height * s);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      out.push({ url: toUrl(c) });
    }
  }
  return out;
}

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('thermoquest-board', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function idbGet(k) {
  try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
  catch (e) { return null; }
}
export async function idbSet(k, v) {
  try { const db = await idb(); return await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); }
  catch (e) { return false; }
}
