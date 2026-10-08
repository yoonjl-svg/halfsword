// 손잡이(자루·폼멜·코등이) 맞음 세기 — 오늘 결투에서 자루가 상대 몸을 몇 번·얼마나 세게 치나 (10/9, docs/strike/pommel_count_2026-10-09.md).
//  사장님 아이디어 3] '손잡이 찍기' 설계 메모(docs/strike/owner_ideas_design_2026-10-09.md §3-6)의 '오늘 값부터' 측정. 측정만 — src 는 건드리지 않는다.
//  판 차림은 motion_lab.mjs duel 과 같다: 시험 무기 X(유파 = 그 무기 유파, 없으면 롱소드) vs 롱소드 AI Y, 둘 다 AI normal,
//   씨앗 1000+s(X 가 P 자리)·2000+s(X 가 E 자리), 40 s, 한쪽이 죽으면 끝.
//  동작 라이브러리는 기본 = 본판(src 기본 MOTION.lib 그대로). --lib=off 면 motion_lab duel 기본(끔)과 같다.
//  맞은 점이 칼의 어디인가: combat.js strike() 는 hooks.onWound(att, vic, r, point, pr) 로 무기 콜라이더 부품
//   (pr.w.part = 'blade' | 'hilt', fighter.js:597)과 맞은 점을 넘긴다. 칼날 위 비율(t)은 결과에 없다.
//   자루(part 'hilt')는 칼 원점(손잡이 가운데) 기준 칼 축 좌표 y 로 다시 나눈다:
//   y < −0.07 m = 폼멜, y > hiltLength − 0.05 = 코등이, 그 사이 = 손잡이(쥔 자리).
//   칼날 부품: cut = 날, stab = 칼끝, blunt = 칼 면(납작)·날 뿌리.
//  실행: node tools/sim/pommel_count.mjs <무기id> [--N=24] [--lib=off]
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { MOTION } from '../../src/motion_library.js';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const id = pos[0] ?? 'longsword';
if (!WEAPONS[id]) throw new Error(`무기 없음: ${id}`);
const N = +(args.N ?? 24);
if (args.lib === 'off') MOTION.lib = false;
const school = SCHOOLS[id] ? id : 'longsword';

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[Math.floor(b.length / 2)].toFixed(1); };
const max = (a) => (a.length ? +Math.max(...a).toFixed(1) : null);
const fresh = () => ({ hits: 0, cut: 0, stab: 0, flat: 0, hilt: 0, hiltPart: { pommel: 0, grip: 0, guard: 0 }, hiltZone: {}, hiltE: [], pommelE: [], hiltClinch: 0, hiltSev: 0, hiltHeadBig: 0, hiltState: {}, hiltMode: {}, hiltY: [], hiltDist: [] });
const side = { X: fresh(), Y: fresh() };
const _q = new THREE.Quaternion();
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
let W = 0, L = 0, D = 0;

for (let s = 1; s <= N; s++) {
  for (const xFirst of [true, false]) {
    const seed = (xFirst ? 1000 : 2000) + s;
    const x = { weapon: id, persona: { school } };
    const y = { weapon: 'longsword', persona: { school: 'longsword' } };
    const P = xFirst ? x : y, E = xFirst ? y : x;
    const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
    const X = xFirst ? G.player : G.enemy, Y = xFirst ? G.enemy : G.player;
    const aiOf = new Map([[X, xFirst ? G.ai2 : G.ai], [Y, xFirst ? G.ai : G.ai2]]);
    const orig = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, point, pr) => {
      orig(att, vic, r, point, pr);
      const S = side[att === X ? 'X' : 'Y'];
      S.hits++;
      if (pr?.w?.part !== 'hilt') {
        if (r.type === 'cut') S.cut++;
        else if (r.type === 'stab') S.stab++;
        else S.flat++;
        return;
      }
      S.hilt++;
      const sw = att.cache?.sword; // analyze 가 쓴 스텝 직전 칼 상태
      const p = sw?.p ?? att.sword.translation(), q = sw?.q ?? att.sword.rotation();
      const ly = point.clone().sub(new THREE.Vector3(p.x, p.y, p.z)).applyQuaternion(_q.set(q.x, q.y, q.z, q.w).invert()).y;
      const HL = att.weaponCfg.hiltLength;
      const part = ly < -0.07 ? 'pommel' : ly > HL - 0.05 ? 'guard' : 'grip';
      S.hiltPart[part]++;
      S.hiltY.push(ly);
      bump(S.hiltZone, r.zone);
      S.hiltE.push(r.energy);
      if (part === 'pommel') S.pommelE.push(r.energy);
      if (r.severity > 0) S.hiltSev++;
      if ((r.zone === 'head' || r.zone === 'neck') && r.energy > 45) S.hiltHeadBig++;
      const a = att.bodies.chest.translation(), b = vic.bodies.chest.translation();
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      S.hiltDist.push(d);
      if (d < 0.9) S.hiltClinch++;
      bump(S.hiltState, att.state);
      const ai = aiOf.get(att);
      bump(S.hiltMode, ai ? `${ai.mode}${ai.phase ? '/' + ai.phase : ''}` : '?');
    };
    let res = 'D';
    for (let i = 0; i < 40 / DT; i++) {
      G.step();
      const xd = X.state === 'dead', yd = Y.state === 'dead';
      if (xd || yd) { res = xd && yd ? 'D' : yd ? 'W' : 'L'; break; }
    }
    if (res === 'W') W++; else if (res === 'L') L++; else D++;
  }
}
const row = (k) => {
  const S = side[k];
  return { side: k === 'X' ? id : 'longsword(상대)', hits: S.hits, cut: S.cut, stab: S.stab, flat: S.flat, hilt: S.hilt, hiltPct: +(100 * S.hilt / Math.max(1, S.hits)).toFixed(1), hiltPart: S.hiltPart, hiltZone: S.hiltZone, hiltE_med: med(S.hiltE), hiltE_max: max(S.hiltE), pommelE_med: med(S.pommelE), hiltClinch: S.hiltClinch, hiltDist_med: med(S.hiltDist), hiltSev: S.hiltSev, hiltHeadOver45: S.hiltHeadBig, hiltState: S.hiltState, hiltMode: S.hiltMode, hiltY_cm_med: med(S.hiltY.map((v) => v * 100)) };
};
console.log(JSON.stringify({ weapon: id, school, lib: MOTION.lib, fights: 2 * N, X_W: W, X_L: L, D, X: row('X'), Y: row('Y') }));
