// 모르겐슈테른 전용 측정 (설계 docs/strike/morgenstern_design_2026-10-02.md 7-1): 로스터 id 'morgenstern' 으로 상대 × 토크 × 둔기 부위 효과표 × mBlunt 격자를 돌려
//  한 표에 승률(윌슨 95 %)·낸 둔타 E 중앙값/상위 25 %/최대·맞은 자리의 팔 비율·머리·목 둔타·판금 완전 파손 수를 찍는다.
//  스펙은 판마다 WEAPONS.morgenstern 의 controlOverrides.maxAimTorque·mBlunt 만 잠깐 바꾼다 (with_spec.mjs 와 같은 식 — 저장소 값은 안 바뀐다. 확인표 줄 134·137 의 대안 값을 재는 용도).
//  부위 효과표 'on' 은 tools/sim/blunt_zones.mjs 시제품(R3, 줄 141)을 맞는 쪽에 감싼다 — 판금 위 둔타는 h.plateBlunt(줄 140)만큼만 효과에 싣는다.
//  사용법: node tools/sim/morg_eval.mjs [자리마다 판 수=6] [--foes=longsword,sabre,heinrich] [--torques=22,28] [--zones=off,on] [--mblunt=1.0,1.3,1.8] [--secs=40] [--seed=1]
//   heinrich = 롱소드 + 하인리히 겉모습(판금 13부위, config.js ARMOR). 자리마다 n 판 × 자리 바꿔 2 (시드 1000+s / 2000+s, weapon_balance 와 같은 틀)
import { newRound, DT, AI } from './harness_m.mjs';
import { WEAPONS, getWeapon } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { weaponPhysics } from '../../src/weapon_class.js';
import { getLook } from '../../src/looks.js';
import { wilson } from './ref_duel.mjs';
import { zoneEffects, zoneTick } from './blunt_zones.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const n = +(argv.find((a) => !a.startsWith('--')) ?? 6);
const foes = opt('foes', 'longsword,sabre,heinrich').split(',');
const torques = opt('torques', '22,28').split(',').map(Number);
const zonesL = opt('zones', 'off,on').split(',');
const mblunts = opt('mblunt', '1.0,1.3,1.8').split(',').map(Number);
const SECS = +opt('secs', 40);
const S0 = +opt('seed', 1);
const ID = 'morgenstern';
const W = WEAPONS[ID];
const base = { torque: W.controlOverrides.maxAimTorque, mBlunt: W.mBlunt };
const p = weaponPhysics(W);
console.log(`${ID}: 질량 ${p.mass.toFixed(2)} kg · 무게중심 ${p.com.toFixed(3)} m · I(손) ${p.I.toFixed(3)} kg·m² · 손~끝 ${p.length.toFixed(2)} m · 기본 토크 ${base.torque} · mBlunt ${base.mBlunt} · 자리마다 ${n} 판 × 2 · ${SECS} s`);
console.log('상대 | 토크 | mBlunt | 부위표 | 승/패/무 | 승률 (95 %) | 둔타 n · E 중앙값/상위25 %/최대 (J) | 팔 비율 | 머리·목 n | 판 완전 파손 | 부위표 사건');

function cell(foe, torque, mb, zOn) {
  W.controlOverrides = { ...W.controlOverrides, maxAimTorque: torque };
  W.mBlunt = mb;
  const foeW = foe === 'heinrich' ? 'longsword' : foe;
  let Wn = 0, Ln = 0, D = 0, nan = 0;
  const Es = [], Eh = []; let arm = 0, plateBroken = 0; const zlog = {};
  for (let s = S0; s < S0 + n; s++) {
    for (const xFirst of [true, false]) {
      const lk = foe === 'heinrich' ? getLook('heinrich') : undefined;
      const G = newRound({
        walls: true, seed: (xFirst ? 1000 : 2000) + s, AI2Class: AI,
        weapon: xFirst ? ID : foeW, weapon2: xFirst ? foeW : ID,
        persona: { school: SCHOOLS[xFirst ? foeW : ID] ? (xFirst ? foeW : ID) : 'longsword' }, persona2: { school: SCHOOLS[xFirst ? ID : foeW] ? (xFirst ? ID : foeW) : 'longsword' },
        look: xFirst ? undefined : lk, look2: xFirst ? lk : undefined,
      });
      applyWeaponMeasure(G.ai2, getWeapon(xFirst ? ID : foeW).id);
      applyWeaponMeasure(G.ai, getWeapon(xFirst ? foeW : ID).id);
      const X = xFirst ? G.player : G.enemy, Y = xFirst ? G.enemy : G.player;
      if (zOn) (zoneEffects(Y, zlog), zoneEffects(X, {}));
      let res = 'D';
      for (let i = 0; i < SECS / DT; i++) {
        G.step();
        if (zOn) (zoneTick(Y, DT), zoneTick(X, DT));
        const v = X.sword.linvel();
        if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
        if (X.state === 'dead' || Y.state === 'dead') { res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L'; break; }
      }
      for (const w of G.wounds) if (w.att === X) { Es.push(Math.round(w.energy)); if (w.zone === 'head' || w.zone === 'neck') Eh.push(Math.round(w.energy)); if (w.zone === 'arm') arm++; }
      if (res === 'W') Wn++; else if (res === 'L') Ln++; else D++;
      if (foe === 'heinrich') plateBroken += Y.platesBroken ?? 0;
    }
  }
  const N = 2 * n; const [lo, hi] = wilson(Wn, N);
  Es.sort((a, b) => a - b); const q = (f) => (Es.length ? Es[Math.min(Es.length - 1, Math.floor(f * Es.length))] : '-');
  const zs = Object.entries(zlog).filter(([k]) => k !== 'hist' && k !== 'cos').map(([k, v]) => `${k} ${v}`).join(' ');
  console.log(`${foe} | ${torque} | ${mb} | ${zOn ? '켬' : '끔'} | ${Wn}/${Ln}/${D} | ${Math.round((100 * Wn) / N)} % (${Math.round(100 * lo)}~${Math.round(100 * hi)}) | ${Es.length} · ${q(0.5)}/${q(0.75)}/${Es.at(-1) ?? '-'} | ${Es.length ? Math.round((100 * arm) / Es.length) : 0} % | ${Eh.length} | ${foe === 'heinrich' ? plateBroken : '-'} | ${zs || '-'}${nan ? ` · NaN ${nan}` : ''}`);
}
for (const foe of foes) for (const torque of torques) for (const zOn of zonesL.map((z) => z === 'on')) for (const mb of mblunts) cell(foe, torque, mb, zOn);
W.controlOverrides = { ...W.controlOverrides, maxAimTorque: base.torque };
W.mBlunt = base.mBlunt;
