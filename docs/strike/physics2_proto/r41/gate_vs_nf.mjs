// r41 — 칼끝 문(이 걸음의 정의)과 r36 nf 기록의 '칼끝 닿음'(첫 충격량이 칼 축과 cos ≥ 0.7 · r38 push_depth 의 정의)을 판마다 맞대 봄 (시뮬 없음 · json 만 읽음)
//  node gate_vs_nf.mjs --r36=<r36 결과 폴더 ($S/r36/out)> --r41=<r41 결과 폴더 ($S/r41/out)> [--tag=fp10_ff0]
//  런지 · 가까운 장면은 탭 앞까지 두 칸이 같은 길이라(칼끝 문은 닿는 쌍에서만 갈림) 첫 닿음은 판마다 견줄 수 있다. 싸움은 첫 닿음 뒤로 세계가 갈려 판마다는 못 견줌(수만).
//  nf 만의 까닭 어림: 그 판 nf 첫 칼끝 묶음의 첫 스텝 다가옴 빠르기 < 0.5 m/s → slow · 칼 축 몫 ≤ stabAlign − window (레이피어 0.63 · 장검 0.75 — config · weapons 읽은 값) → along · 나머지 → geom (칼끝이 겉 가까이 없음 · 법선 cos · 판금 — 이 기록으로 못 가름)
//  nf 칼끝 묶음 = r36 닿음 토막 가운데 첫 스텝 충격량 J(토막이 받은 쪽)와 칼 축의 cos ≥ 0.7 (판정 줄 · 쉼 여부는 안 봄 — push_depth 는 찌르기 판정 줄이 있는 묶음만 셈)
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const R36 = String(args.r36), R41 = String(args.r41), TAG = String(args.tag ?? 'fp10_ff0');
const J = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const cosFirst = (ep) => { const s = ep.steps[0]; const [jx, jy, jz] = s[1], [ax, ay, az] = s[3]; const n = Math.hypot(jx, jy, jz); return n > 0 ? (jx * ax + jy * ay + jz * az) / n : 0; };
for (const [g, nf] of [['L1', 'L1nf'], ['L2', 'L2nf'], ['N', 'Nnf'], ['F', 'Fnf']]) {
  const A = J(join(R36, nf + '.json')), B = J(join(R41, `${TAG}_${g}.json`)); if (!A || !B) { console.log(g, '파일 없음'); continue; }
  const key = (r) => `${r.W}|${r.add ?? ''}|${r.seed}`; const cells = new Map();
  for (const r of A.runs) { const k = key(r); const c = `${r.W}${r.add != null ? ' +' + r.add : ''}`; if (!cells.has(c)) cells.set(c, { nfEp: 0, gEp: 0, both: 0, gOnly: 0, nfOnly: 0, none: 0, nfFirstPart: {}, runs: 0 }); const C = cells.get(c); C.runs++;
    const tipEps = r.eps.filter((e) => e.att === (g === 'F' ? e.att : 0) && cosFirst(e) >= 0.7); C.nfEp += tipEps.length;
    const rb = B.runs.find((x) => key(x) === k); const gp = rb ? rb.pierces.filter((p) => p.entered) : []; C.gEp += gp.length;
    if (g !== 'F') { const a = tipEps.length > 0, b = gp.length > 0; if (a && b) C.both++; else if (b) C.gOnly++; else if (a) { C.nfOnly++; // 까닭 어림: nf 첫 칼끝 묶음의 첫 스텝 다가옴 빠르기(칼 − 토막 · 스텝 전)로 문 ② 를 다시 봄
        const e = tipEps[0], st = e.steps[0], [vx, vy, vz] = st[2], [ax, ay, az] = st[3]; const sp = Math.hypot(vx, vy, vz), al = sp > 0 ? (vx * ax + vy * ay + vz * az) / sp : 0;
        const why = sp < 0.5 ? 'slow' : al <= (r.W === 'rapier' ? 0.63 : 0.75) ? 'along' : 'geom'; C.why = C.why ?? {}; C.why[why] = (C.why[why] ?? 0) + 1; C.parts = C.parts ?? {}; C.parts[e.part] = (C.parts[e.part] ?? 0) + 1; } else C.none++; }
  }
  for (const [c, C] of [...cells.entries()].sort()) console.log(`${g} | ${c} | 판 ${C.runs} | nf 칼끝 묶음 ${C.nfEp} · 칼끝 문 든 ${C.gEp}` + (g !== 'F' ? ` | 판마다: 둘 다 ${C.both} · 문만 ${C.gOnly} · nf 만 ${C.nfOnly} · 둘 다 없음 ${C.none}` + (C.why ? ` | nf 만의 까닭 어림 ${JSON.stringify(C.why)} · 토막 ${JSON.stringify(C.parts)}` : '') : ' | (싸움은 판마다 못 견줌)'));
}
