#!/usr/bin/env node
// Thermo Quest pre-commit check. Run from this folder:  node check.js
// 1. Every script parses (one syntax error blanks the whole game).
// 2. Template holes are plain names (an expression silently renders nothing).
// 3. World maps: size, exits, open gaps, NPC spots.
// 4. Steam tables are self-consistent (h = u + Pv, s_fg = h_fg / T, Clapeyron).
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { execFileSync } = require('child_process');

const GAME = 'Thermo Quest.dc.html';
const errors = [], warnings = [];
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const lineAt = (text, i) => text.slice(0, i).split('\n').length;

// ---- 1. syntax ----
function parse(label, src, esm) {
  const tmp = path.join(os.tmpdir(), 'thermo-check-' + process.pid + (esm ? '.mjs' : '.cjs'));
  fs.writeFileSync(tmp, src);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    return true;
  } catch (e) {
    const msg = String(e.stderr || e.message).split(tmp).join(label).split('\n');
    const cut = msg.findIndex((l) => /^\s+at /.test(l));
    errors.push(msg.slice(0, cut < 0 ? msg.length : cut).join('\n').trim());
    return false;
  } finally {
    fs.unlinkSync(tmp);
  }
}
const html = read(GAME);
const sm = /<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/.exec(html);
const logic = sm ? sm[1] : '';
if (!sm) errors.push(GAME + ': logic block <script type="text/x-dc" data-dc-script> not found');
// Pad with blank lines so error line numbers match the .dc.html file.
const logicOk = !!sm && parse(GAME, '\n'.repeat(lineAt(html, sm.index + sm[0].indexOf('>') + 1) - 1) + logic, false);
['steam.js', 'multiplayer-config.js', 'net.js', 'board.js', 'voice.js', 'server/relay.js'].forEach((f) => {
  const src = read(f);
  parse(f, src, /^\s*(import|export)\s/m.test(src));
});

// ---- 2. template holes ----
const tm = /<x-dc>([\s\S]*?)<\/x-dc>/.exec(html);
if (!tm) errors.push(GAME + ': <x-dc> template not found');
else {
  const base = tm.index + '<x-dc>'.length, re = /\{\{([^}]*)\}\}/g;
  let h;
  while ((h = re.exec(tm[1]))) {
    const inner = h[1].trim();
    if (!/^([A-Za-z_$][\w$]*(\.[\w$]+)*|true|false|null|-?\d+(\.\d+)?)$/.test(inner)) {
      errors.push(GAME + ':' + lineAt(html, base + h.index) + ': {{ ' + inner + ' }} must be a plain name. Compute it in renderVals() and expose it by name.');
    }
  }
  if (/<script[\s>]/i.test(tm[1].replace(/<helmet>[\s\S]*?<\/helmet>/, ''))) errors.push(GAME + ': <script> tags belong in <helmet> or the logic block, not the template');
}

// ---- 3. world maps ----
let W = null;
if (logicOk) {
  const ctx = { DCLogic: class {}, React: { createRef: () => ({ current: null }), createElement: () => null }, window: {}, console, __out: null };
  try {
    vm.runInNewContext(logic + '\n;__out = { MAPS, SCREENS, SOLID, CRITTERS, npcsOf };', ctx, { filename: GAME });
    W = ctx.__out;
  } catch (e) {
    warnings.push('map checks skipped: the game data could not be loaded outside a browser (' + e.message + ')');
  }
}
if (W) {
  const COLS = 16, ROWS = 11, OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const open = (ch) => W.SOLID.indexOf(ch) < 0;
  const edge = (m, d) => (d === 'n' ? m[0].split('') : d === 's' ? m[m.length - 1].split('') : m.map((r) => (d === 'w' ? r[0] : r[r.length - 1])));
  Object.keys(W.MAPS).forEach((k) => {
    const m = W.MAPS[k], S = W.SCREENS[k];
    if (m.length !== ROWS || m.some((r) => r.length !== COLS)) errors.push('MAPS.' + k + ' must be ' + COLS + ' x ' + ROWS + ' tiles');
    if (!S) { errors.push('MAPS.' + k + ' has no SCREENS entry'); return; }
    const ex = S.exits || {};
    ['n', 's', 'e', 'w'].forEach((d) => {
      const gap = edge(m, d).some(open), to = ex[d];
      if (!to) {
        if (gap) errors.push(k + ': open gap on the ' + d + ' edge leads nowhere. Add an exit or wall it off.');
        return;
      }
      if (!W.MAPS[to]) { errors.push(k + ': exit ' + d + ' goes to unknown screen "' + to + '"'); return; }
      if (!gap) errors.push(k + ': exit ' + d + ' -> ' + to + ', but the ' + d + ' edge is all wall');
      if (S.exitAt) return; // interiors drop you back at their door
      if (!edge(W.MAPS[to], OPP[d]).some(open)) errors.push(to + ': needs an opening on its ' + OPP[d] + ' edge to arrive from ' + k);
      if (((W.SCREENS[to] || {}).exits || {})[OPP[d]] !== k) warnings.push(k + ' ' + d + ' -> ' + to + ', but ' + to + ' ' + OPP[d] + ' does not lead back');
    });
    W.npcsOf(k).forEach((n) => {
      const ch = (m[n.y] || '')[n.x];
      if (ch == null || !open(ch)) errors.push(k + ': NPC ' + n.who + ' at ' + n.x + ',' + n.y + ' stands inside a wall');
      if (!W.CRITTERS[n.who]) errors.push(k + ': NPC ' + n.who + ' has no CRITTERS entry');
    });
  });
}

// ---- 4. steam tables ----
const sctx = { window: {} };
try { vm.runInNewContext(read('steam.js'), sctx, { filename: 'steam.js' }); } catch (e) { errors.push('steam.js failed to load: ' + e.message); }
const TH = sctx.window.THERMO;
if (TH) {
  const rowsOf = (tbl) => tbl.map((r) => { const o = {}; TH.KEYS.forEach((k, i) => (o[k] = r[i])); return o; });
  [['SAT', 'P', 'kPa'], ['SATT', 'T', 'C']].forEach(([name, key, unit]) => {
    rowsOf(TH[name]).forEach((o, i, all) => {
      const id = 'steam.js ' + name + ' ' + key + ' = ' + o[key] + ' ' + unit + ': ', Tk = o.T + 273.15;
      if (Math.abs(o.hf + o.hfg - o.hg) > 0.5) errors.push(id + 'hf + hfg should equal hg');
      if (Math.abs(o.uf + o.P * o.vf - o.hf) > 0.6) errors.push(id + 'uf + P vf should equal hf');
      if (Math.abs(o.ug + o.P * o.vg - o.hg) > 1) errors.push(id + 'ug + P vg should equal hg');
      if (o.hfg > 1 && Math.abs(o.sg - o.sf - o.hfg / Tk) > 0.003) errors.push(id + 'sg - sf should equal hfg / T(K)');
      if (i && !(o.T > all[i - 1].T && o.P > all[i - 1].P)) errors.push(id + 'P and T must both increase down the table');
      if (i && i < all.length - 1 && o.T < 360) {
        const a = all[i - 1], c = all[i + 1];
        const slope = o.P * Math.log(c.P / a.P) / (c.T - a.T), clap = o.hfg / (Tk * (o.vg - o.vf));
        if (Math.abs(slope / clap - 1) > 0.05) errors.push(id + 'P, vg or hfg looks mistyped (Clapeyron is off by ' + Math.round((slope / clap - 1) * 100) + '%)');
      }
    });
  });
  [['SUP', true], ['CPL', false]].forEach(([name, rising]) => {
    (TH[name] || []).forEach((b) => b.rows.forEach((r, i, rows) => {
      const [T, v, u, h, s] = r, id = 'steam.js ' + name + ' P = ' + b.P + ' kPa, T = ' + T + ' C: ';
      if (Math.abs(u + b.P * v - h) > 0.6) errors.push(id + 'u + P v should equal h');
      if (!i) return;
      const p = rows[i - 1];
      if (rising && !(v > p[1] && h > p[3] && s > p[4])) errors.push(id + 'v, h and s should all rise with T');
      const ds = s - p[4], est = (h - p[3]) / ((T + p[0]) / 2 + 273.15);
      if (Math.abs(ds - est) > 0.012 + 0.02 * Math.abs(est)) errors.push(id + 's does not match dh / T from the row above');
    }));
  });
}

warnings.forEach((w) => console.log('warning: ' + w));
if (errors.length) {
  errors.forEach((e) => console.log('\u2717 ' + e));
  console.log('\n' + errors.length + ' problem(s). Fix them before committing.');
  process.exit(1);
}
console.log('\u2713 All checks passed.');
