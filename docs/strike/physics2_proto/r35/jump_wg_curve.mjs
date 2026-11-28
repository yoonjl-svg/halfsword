// r35 jump — 손목 지킴(wristGuardAim) 뜀 스텝에서 '끌어당김 각 → 맞는 손 면이 있나' 곡선 (읽기만 · 게임 함수 wristPlane 을 그 스텝 입력으로 다시 부름)
//  node jump_wg_curve.mjs --root=<칸> --trace=a.json[,b] [--thr=3]
//   입력 wgIn = 탐침 칸이 적은 그 스텝의 아래팔 fx · 경첩 축 zF · 쉬는 칼 면 pref · 교정 전 겨눔 aim. 끌기 각 0 ~ (aim↔fx) 를 1° 씩: 맞는 손 면이 있으면 1.
//   보는 것: ① 가장 작은 맞는 끌기 각(1° 훑음)과 게임의 반씩 찾기(8 번) 값 · ② 맞음이 끌기 각에 단조인가(맞음 → 안 맞음 → 맞음 꼴의 수) · ③ 앞 스텝의 같은 곡선
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const THREE = H.THREE; const { wristPlane } = await imp('src/fighter.js');
const THR = +(args.thr ?? 3); const HD = Math.PI / 180;
const T = String(args.trace).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes.map((s, j) => ({ ...s, j })));
const V = (a) => new THREE.Vector3(...a);
function curve(w) { const fx = V(w.fx).normalize(), zF = V(w.zF), pref = V(w.pref), aim = V(w.aim).normalize(); const ax = new THREE.Vector3().crossVectors(aim, fx); const sl = ax.length(); if (sl < 1e-6) return null; ax.multiplyScalar(1 / sl);
  const hi0 = Math.atan2(sl, aim.dot(fx)) / HD; const out = new THREE.Vector3(); const ok = [];
  for (let d = 0; d <= Math.ceil(hi0); d++) ok.push(!!wristPlane(fx, zF, aim.clone().applyAxisAngle(ax, Math.min(d, hi0) * HD), pref, out));
  let lo = 0, hi = hi0 * HD; for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (wristPlane(fx, zF, aim.clone().applyAxisAngle(ax, mid), pref, out)) hi = mid; else lo = mid; }
  let flips = 0; for (let i = 1; i < ok.length; i++) if (ok[i] !== ok[i - 1]) flips++;
  return { hi0, first: ok.indexOf(true), bis: hi / HD, flips, ok0: ok[0], s: ok.map((x) => (x ? '1' : '.')).join('') }; }
let n = 0; const sum = { mono: 0, non: 0, bisFar: 0 }; const firsts = [];
for (const s of T) { if (s.tech !== 'tap') continue; const i0 = s.t0 - s.a;
  for (let i = Math.max(1, i0); i < s.steps.length; i++) { const c = s.steps[i], p = s.steps[i - 1]; if (!c || !p || !(c.ph === '뻗음' || c.ph === '머묾') || !(c.dAim >= THR)) continue;
    if (!c.as?.wgIn || !['bis', 'clamp'].includes(c.as.wgBr)) continue; const C = curve(c.as.wgIn); if (!C) continue; n++;
    if (C.flips <= 1) sum.mono++; else sum.non++; if (Math.abs(C.bis - C.first) > 2) sum.bisFar++; firsts.push(C.first);
    const P = p.as?.wgIn ? curve(p.as.wgIn) : null;
    if (n <= +(args.show ?? 12)) console.log(`${s.seed} ${s.who} #${s.j} k${i - i0} ${c.as.wgBr} dAim ${c.dAim.toFixed(1)} · 끌기 끝 ${C.hi0.toFixed(0)}° · 가장 작은 맞는 끌기 ${C.first}° · 반씩 ${C.bis.toFixed(1)}° · 바뀜 ${C.flips} | ${C.s}\n     앞 스텝 ${p.as?.wgBr}${P ? ` · 가장 작은 ${P.first}° · ${P.s}` : ''}`); } }
const fs2 = firsts.sort((a, b) => a - b);
console.log(`뜀 스텝(가지 bis · clamp) ${n} · 곡선 단조(바뀜 ≤ 1) ${sum.mono} · 아님 ${sum.non} · 반씩 값이 1° 훑음 첫 맞음과 2° 넘게 다름 ${sum.bisFar} · 가장 작은 맞는 끌기 가운데 ${fs2[Math.floor((fs2.length - 1) / 2)] ?? '-'}°`);
