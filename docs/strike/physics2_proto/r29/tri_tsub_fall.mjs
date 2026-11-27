// r29 새 실패 가름 2 의 넘어짐 보기: '제비 베기 견줌 판' 씨앗 1 의 사람 몸 — 언제 선 자세를 잃는지 · 그때까지 골반 높이 · 앞으로 가는 빠르기 · 거리 · 칼 몸 상태를 0.25 s 마다 찍음.
//  쓰는 법: (cd <나무> && node <이 파일> [--seed=1] [--to=4] [--from=<이 때부터 0.05 s 마다>])
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const { tsubameRun } = await import(pathToFileURL(join(ROOT, 'tools/sim/schielhau_strike.mjs')).href);
const TO = +(args.to ?? 4);
let last = -1, first = null;
tsubameRun(+(args.seed ?? 1), { immortal: true, dur: TO, ghostDown: true, onStep: (G, P) => {
  const t = G.t, st = P.state;
  if (st !== 'stand' && first == null) first = { t, st, cause: P.fallCause ?? P.downCause ?? null };
  const dtp = t > +(args.from ?? 99) ? 0.05 : 0.25; if (Math.floor(t / dtp) === last) return; last = Math.floor(t / dtp);
  const p = P.bodies.pelvis.translation(), v = P.bodies.pelvis.linvel();
  console.log(`t ${t.toFixed(2)} · ${st} · 골반 y ${p.y.toFixed(3)} · 골반 빠르기 ${Math.hypot(v.x, v.z).toFixed(2)} m/s · 거리 ${P.foeDistance().toFixed(2)} · move ${P.move.x.toFixed(2)},${P.move.y.toFixed(2)} · 걸음 ${P.gait?.active ? 'on' : 'off'} · 칼 부딪힘 누적 ${G.clashes} · 디딘 발 ${['F', 'B'].filter((k) => P.legDrive.legs[k].on).join('') || '-'} · 무릎 굽힘 ° ${['F', 'B'].map((k) => { const L = P.legDrive.legs[k], len = L.ph.distanceTo(L.pa), c = Math.min(1, Math.max(-1, (L.lenT ** 2 + L.lenS ** 2 - len * len) / (2 * L.lenT * L.lenS))); return (180 - (Math.acos(c) * 180) / Math.PI).toFixed(0); }).join('/')}`);
} });
console.log('처음 선 자세를 잃은 때:', JSON.stringify(first));
