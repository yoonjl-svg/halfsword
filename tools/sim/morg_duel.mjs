// 무기 짝 결투 통계 (마무리 담당 10/2, 모르겐슈테른 측정용 — 로스터 어느 짝에도 쓴다): 자리 바꿔 2판씩(시드 1000+s / 2000+s, 45 s 시한, 시한 넘기면 혈량 많은 쪽 승),
//  승률(윌슨 95 %)·사인·낸/받은 상처(둔/찌)·머리·목 타격·넘어짐·접촉 E 평균/중앙값·상대 의식 최저·판 닳음(13부위 합)·판 완전 파손·투구 벗김·평균 판 길이를 한 줄로 찍는다.
//  사용법: node tools/sim/morg_duel.mjs <무기X> <무기Y> [시드 수=24] [plate]   (plate = Y 가 하인리히 판금을 입는다)
//  스펙 후보는 with_spec 으로: node tools/sim/with_spec.mjs 'morgenstern.mBlunt=1.8' 'morgenstern.controlOverrides={"maxAimTorque":28}' morg_duel.mjs morgenstern longsword 30
import { newRound, DT, AI } from './harness_m.mjs';
import { getWeapon } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { getLook } from '../../src/looks.js';
import { wilson } from './ref_duel.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
const [X0, Y0, nA = '24', plateArg] = process.argv.slice(2);
const n = +nA, plateY = plateArg === 'plate', SECS = 45;
const sch = (w) => (SCHOOLS[w] ? w : 'longsword');
let W = 0, L = 0, D = 0, nan = 0, deathsX = 0, deathsY = 0; const causes = {};
const S = { woundsXtoY: 0, woundsYtoX: 0, headX: 0, headY: 0, fallsX: 0, fallsY: 0, EX: [], EY: [], bluntX: 0, stabX: 0, plateWear: 0, plateBroken: 0, helmLost: 0, plateTot: 0, minConsY: [], t: [], plated: 0 };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
for (let s = 1; s <= n; s++) for (const xFirst of [true, false]) {
  const lk = plateY ? getLook('heinrich') : undefined;
  const G = newRound({ walls: true, seed: (xFirst ? 1000 : 2000) + s, AI2Class: AI,
    weapon: xFirst ? X0 : Y0, weapon2: xFirst ? Y0 : X0,
    persona: { school: sch(xFirst ? Y0 : X0) }, persona2: { school: sch(xFirst ? X0 : Y0) },
    look: xFirst ? undefined : lk, look2: xFirst ? lk : undefined });
  applyWeaponMeasure(G.ai2, getWeapon(xFirst ? X0 : Y0).id); applyWeaponMeasure(G.ai, getWeapon(xFirst ? Y0 : X0).id);
  const X = xFirst ? G.player : G.enemy, Y = xFirst ? G.enemy : G.player;
  const p0 = sum(Y.plate), hl0 = Y.hasHelmet; S.plateTot += p0;
  let prevX = 'stand', prevY = 'stand', minC = 1, res = 'D', t = SECS;
  for (let i = 0; i < SECS / DT; i++) {
    G.step();
    const v = X.sword.linvel(); if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
    if (X.state === 'down' && prevX !== 'down') S.fallsX++; if (Y.state === 'down' && prevY !== 'down') S.fallsY++;
    prevX = X.state; prevY = Y.state; minC = Math.min(minC, Y.consciousness);
    if (X.state === 'dead' || Y.state === 'dead') { res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L'; t = G.t; break; }
  }
  if (res === 'D' && X.alive !== false) { /* time out: decide by blood */ if (X.blood !== Y.blood) res = X.blood > Y.blood ? 'W' : 'L'; }
  S.t.push(t); S.minConsY.push(minC);
  if (X.state === 'dead') { deathsX++; causes['X:' + (X.causeOfDeath ?? '?')] = (causes['X:' + (X.causeOfDeath ?? '?')] ?? 0) + 1; }
  if (Y.state === 'dead') { deathsY++; causes['Y:' + (Y.causeOfDeath ?? '?')] = (causes['Y:' + (Y.causeOfDeath ?? '?')] ?? 0) + 1; }
  for (const w of G.wounds) { if (w.att === X) { S.woundsXtoY++; S.EX.push(w.energy); if (w.zone === 'head' || w.zone === 'neck') S.headX++; if (w.type === 'blunt') S.bluntX++; if (w.type === 'stab') S.stabX++; } else { S.woundsYtoX++; S.EY.push(w.energy); if (w.zone === 'head' || w.zone === 'neck') S.headY++; } }
  S.plateWear += p0 - sum(Y.plate); S.plateBroken += Y.platesBroken ?? 0; if (hl0 && !Y.hasHelmet) S.helmLost++; if (p0 > 0) S.plated++;
  if (res === 'W') W++; else if (res === 'L') L++; else D++;
}
const N = 2 * n, [lo, hi] = wilson(W, N), mean = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-';
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)].toFixed(0) : '-'; };
console.log(`${X0} vs ${Y0}${plateY ? '+heinrich plate' : ''} | N=${N} | 승/패/무 ${W}/${L}/${D} = ${Math.round(100 * W / N)}% (${Math.round(100 * lo)}~${Math.round(100 * hi)}) | 죽음 X ${deathsX} Y ${deathsY} ${JSON.stringify(causes)} | X→Y 상처 ${S.woundsXtoY} (둔 ${S.bluntX} 찌 ${S.stabX}) Y→X ${S.woundsYtoX} | 머리·목 X→Y ${S.headX} Y→X ${S.headY} | 넘어짐 X ${S.fallsX} Y ${S.fallsY} | 접촉E 평균 X ${mean(S.EX)} 중앙 ${med(S.EX)} / Y ${mean(S.EY)} 중앙 ${med(S.EY)} | Y 의식 최저 평균 ${mean(S.minConsY)} | Y판 닳음 합 ${S.plateWear.toFixed(2)}/${S.plateTot.toFixed(0)} (판당 ${(S.plateWear / Math.max(1, S.plated)).toFixed(2)}) 완전파손 ${S.plateBroken} 투구 벗겨짐 ${S.helmLost} | 평균 시간 ${mean(S.t)}s${nan ? ' NaN ' + nan : ''}`);
