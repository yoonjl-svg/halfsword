// lab.mjs --dump 파일 여럿을 한 표로: 때(--from ~ --to · --every 스텝마다) 줄마다 판별 골반 높이 · 목표 · 거리 · 걸음 · 무릎 · 잘림
//  node look.mjs --from=10.3 --to=11.2 --every=6 [--cols=py,h,dist,legs,sat,mv,sk] a.jsonl b.jsonl ... > 표
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const files = argv.filter((a) => !a.startsWith('--'));
const FROM = +(args.from ?? 9.5), TO = +(args.to ?? 13), EV = +(args.every ?? 6);
const cols = String(args.cols ?? 'py,h,dist,legs,sat').split(',');
const runs = files.map((f) => { const m = new Map(); for (const l of readFileSync(f, 'utf8').split('\n')) if (l) { const r = JSON.parse(l); m.set(r.s, r); } return { name: f.split('/').pop().replace(/^dump_|\.jsonl$/g, ''), m }; });
const sats = (L) => ['hx', 'hy', 'hz', 'k', 'ax', 'ay', 'az'].filter((n) => L[n][2]).join('');
const leg = (L) => (L.st ? (L.on ? 'S' : 's') : `${(L.kind ?? 'w')[0]}${Math.round((L.u ?? 0) * 9)}`) + Math.round(L.phi);
const f2 = (x) => (x == null ? '-' : (+x).toFixed(2));
const cell = (r) => {
  if (!r) return '';
  const o = [];
  for (const c of cols) {
    if (c === 'py') o.push(`${f2(r.py)}${r.vy < -0.15 ? 'v' : r.vy > 0.15 ? '^' : ' '}`);
    else if (c === 'h') o.push(`h${f2(r.g?.h)}/${f2(r.g?.hNom)}`);
    else if (c === 'dist') o.push(`d${f2(r.dist)} v${f2(r.vh)}`);
    else if (c === 'legs') o.push(`F${leg(r.F)} B${leg(r.B)}`);
    else if (c === 'sat') o.push(`[${sats(r.F)}|${sats(r.B)}]`);
    else if (c === 'kr') o.push(`kF${f2(-r.F.k[0] / r.F.k[1])} kB${f2(-r.B.k[0] / r.B.k[1])}`);
    else if (c === 'mv') o.push(`m${f2(r.mv[1])}`);
    else if (c === 'sk') o.push(`${r.sk.swing ? 'SW' : ''}${r.sk.uniq ?? ''}${r.sk.cur != null ? 'C' : ''}${r.sk.held ? 'H' : ''}`);
    else if (c === 'cap') o.push(`c${f2(r.g?.cap)} t${Math.round(r.tilt)}`);
    else if (c === 'vf') o.push(`vf${f2(r.vf)} vr${f2(r.vr)}`)
    else if (c === 'at') o.push(`F@${(r.F.at ?? []).map(f2).join(',')} B@${(r.B.at ?? []).map(f2).join(',')}`)
    else if (c === 'xc') o.push(`xc${(r.xcap ?? []).map(f2).join(',')}`)
    else if (c === 'kq') o.push(`kF${f2(r.F.k[0])}/${f2(r.F.k[1])} kB${f2(r.B.k[0])}/${f2(r.B.k[1])}`)
    else if (c === 'st') o.push(r.st === 'stand' ? '' : r.st);
  }
  return o.join(' ');
};
console.log('t     | ' + runs.map((r) => r.name).join(' | '));
for (let s = Math.round(FROM * 120); s <= Math.round(TO * 120); s += EV) console.log(`${(s / 120).toFixed(3)} | ` + runs.map((r) => cell(r.m.get(s))).join(' | '));
