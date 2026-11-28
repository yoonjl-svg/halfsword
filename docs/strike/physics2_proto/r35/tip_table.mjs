// r35 — trace_*.json 의 한 획을 스텝 표로 (읽기만)
//  node tip_table.mjs --trace=<파일> [--seed=4001] [--w=rapier] [--k=0 (그 씨앗 · 무기 안의 획 차례)] [--fast=8 (없으면 모든 빠른 획)] [--every=1]
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const T = JSON.parse(readFileSync(String(args.trace), 'utf8')).strokes; const DT = 1 / 120;
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
let list = T.map((r, idx) => ({ ...r, idx }));
if (args.seed) list = list.filter((r) => r.seed === +args.seed); if (args.w) list = list.filter((r) => r.weapon === String(args.w));
if (args.k != null) list = [list[+args.k]]; else list = list.filter((r) => r.tipPk > +(args.fast ?? 8));
const every = +(args.every ?? 1);
for (const r of list) {
  console.log(`\n■ ${r.weapon} 씨앗 ${r.seed} ${r.who} ${r.scene} ${r.tech} · tipPk ${f(r.tipPk)} @ ${r.iT - r.t0} · 맞음 ${r.hit ? r.hitI - r.t0 : '-'} ${r.wound ? `${r.wound.type} ${f(r.wound.E)} J 닿는 ${f(r.wound.sp)} m/s 관통 ${f(r.wound.eff)}/${f(r.wound.thr)} ${r.wound.zone}` : ''} · 창 끝 ${r.end - r.t0} · 다음 사건 ${r.nextO != null ? r.nextO - r.t0 : '-'} · 사건 ${r.o - r.t0} (스텝 = t0 부터)`);
  console.log('스텝 | 단계 tap.t | 칼끝 축/옆 | 몫 골반 몸통 팔 칼돌림 | 손 | Δ명령손 몸틀 cm | Δ명령칼° | ΔthDir° | Δyaw° | 칼↔명령° | 명령돌림° 극sin | move | 겨눔 | AI mode/phase/기술 | 휘두름 걸음 | 토크/한도 손목 팔꿈치 어깨');
  r.steps.forEach((s, j) => { const i = r.a + j - r.t0; if (j % every && i !== r.iT - r.t0 && i !== r.hitI - r.t0) return;
    console.log(`${String(i).padStart(4)}${i === r.iT - r.t0 ? '*' : i === (r.hitI ?? -1e9) - r.t0 ? 'H' : ' '}| ${s.ph} ${f(s.tt, 3)} | ${f(s.sp)} ${f(s.vax)}/${f(s.vlat)} | ${f(s.sPel, 2)} ${f(s.sTrk, 2)} ${f(s.sArm, 2)} ${f(s.sRot, 2)} | ${f(s.hand)} | ${f(s.dHandB * 100)} | ${f(s.dAim)} | ${f(s.dThDir)} | ${f(s.dYaw, 2)} | ${f(s.aimSword, 0)} | ${f(s.twC, 0)} ${f(s.poleSin, 2)} | ${f(s.mvx, 2)},${f(s.mvy, 2)} | ${f(s.aimx, 2)},${f(s.aimy, 2)} | ${s.mode}/${s.aph}/${s.tech} | ${s.swing ? 'S' : '-'}${s.walk ? 'W' : '-'} | ${f(s.tqWr, 2)} ${f(s.tqEl, 2)} ${f(s.tqSh, 2)}`); });
}
