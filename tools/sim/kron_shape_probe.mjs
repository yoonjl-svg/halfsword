// 독일 왕관 꼴 정적 막기 점검 (10/12 — docs/strike/kron_shape_2026-10-12.md §4). 읽기만.
//  school_parry.mjs(중국 막기 점검)와 같은 방법: 치는 쪽 = 롱소드가 정수리 베기(oberhau) 길을 11 m/s 로 긋고, 막는 쪽 = 이 무기가 왕관 패드 G.kron 을 들고 버틴다.
//  막는 쪽 AI 는 멈춰 두되 '막는 중'(mode 'defend' · defLine 'highC')으로 두어 본판과 같은 덧씌우기(frames.js installCover)가 걸리게 한다 — 'true' 꼴이면 왕관 몸꼴, 'pad' 꼴이면 덧씌우기 없음.
//  꼴마다: 막음(치는 쪽 상처 0) · 칼날 상처 없음(벰·찌름 0 — 멍만) · 칼 부딪침 · 처음 맞닿은 자리(내 칼날 위 — 코등이 0 → 칼끝 1, combat.js bindFeel 과 같은 셈: 0.02 밑 = 코등이·자루, 0.5 밑 = 밑동(강한 쪽), 그 위 = 약한 쪽) ·
//   치기 직전 자세(손 = 칼 원점, 가슴 기준 [앞, 위, 칼 쪽] m · 칼 올려본 각 · 칼 면이 상대 쪽을 보는 정도 |면·앞| — 1 = 칼 면이 상대 쪽(날 좌우), 0 = 칼 면이 옆(날 앞뒤)).
//   node tools/sim/kron_shape_probe.mjs [막는 무기 longsword]   (KRON_GAPS=1.25~1.8 0.05 간격 12 곳 · KRON_SEEDS=1 — 이 판은 멈춘 두 몸이라 씨앗을 바꿔도 같은 판이 나온다(10/12 확인), 간격을 넓게 본다) · KRON_DEBUG=1 판마다 한 줄
import { newRound, DT, V, Q, toBody } from './harness_m.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { SKILL } from '../../src/config.js';
import { TECH, G as PAD } from '../../src/ai_techniques.js';

const id = process.argv[2] ?? 'longsword';
const GAPS = process.env.KRON_GAPS ? process.env.KRON_GAPS.split(',').map(Number) : Array.from({ length: 12 }, (_, i) => +(1.25 + 0.05 * i).toFixed(2));
const SEEDS = (process.env.KRON_SEEDS ?? '1').split(',').map(Number);
const SPD = 11;
const tech = TECH.find((t) => t.name === 'oberhau');
const setPad = (P, x, y) => {
  P.handOffset.set(x, y);
  P.skill.aimRaw?.set?.(x, y);
};
const D2 = 180 / Math.PI;
const rows = [];
for (const shape of ['true', 'pad']) {
  SKILL.deKron = 1;
  SKILL.deKronShape = shape;
  const r = { shape, n: 0, block: 0, noCut: 0, clash: 0, first: { hilt: 0, strong: 0, weak: 0, none: 0 }, at: [], hand: [0, 0, 0], el: 0, face: 0 };
  for (const gap of GAPS) for (const seed of SEEDS) {
    const Gm = newRound({ walls: false, weapon: 'longsword', weapon2: id, seed, gap });
    Gm.ai.update = () => {};
    Object.assign(Gm.ai, { mode: 'defend', defVoid: false, defLine: 'highC' });
    const A = Gm.player, D = Gm.enemy;
    setPad(D, PAD.kron[0], PAD.kron[1]);
    setPad(A, tech.from[0], tech.from[1]);
    for (let t = 0; t < 0.8; t += DT) Gm.step();
    // 치기 직전 자세
    const o = V(D.sword.translation());
    const q = Q(D.sword.rotation());
    const h = toBody(D, o);
    const inv = D.yaw.clone().invert();
    const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q).applyQuaternion(inv);
    const fl = new THREE.Vector3(0, 0, 1).applyQuaternion(q).applyQuaternion(inv);
    r.hand[0] += h.x; r.hand[1] += h.y; r.hand[2] += h.z * D.side;
    r.el += Math.asin(Math.max(-1, Math.min(1, ax.y))) * D2;
    r.face += Math.abs(fl.x);
    let firstAt = null;
    const hook = Gm.combat.hooks.onClash;
    Gm.combat.hooks.onClash = (point, sp, info) => {
      hook?.(point, sp, info);
      if (firstAt != null) return;
      const so = D.sword.translation();
      const sax = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(D.sword.rotation()));
      const along = new THREE.Vector3(point.x - so.x, point.y - so.y, point.z - so.z).dot(sax);
      firstAt = (along - D.weaponCfg.hiltLength) / Math.max(1e-6, D.weaponCfg.bladeLength);
    };
    const pts = tech.path.map((p) => p.slice());
    let cur = tech.from.slice();
    const w0 = Gm.wounds.length, c0 = Gm.clashes ?? 0;
    for (let t = 0; t < 1.0; t += DT) {
      if (pts.length) {
        const [tx, ty] = pts[0];
        const dx = tx - cur[0], dy = ty - cur[1], dd = Math.hypot(dx, dy), st = SPD * DT;
        if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
        else (cur = [tx, ty]), pts.shift();
      }
      setPad(A, cur[0], cur[1]);
      Gm.step();
    }
    const hit = Gm.wounds.slice(w0).some((w) => w.att === A);
    if (process.env.KRON_DEBUG) console.log(shape, gap, seed, firstAt?.toFixed(2), Gm.wounds.slice(w0).filter((w) => w.att === A).map((w) => w.zone + ":" + w.type).join(" "));
    r.n++;
    if (!hit) r.block++;
    if (!Gm.wounds.slice(w0).some((w) => w.att === A && w.type !== 'blunt')) r.noCut++; // 칼날 상처(벰·찌름) 없음 — 칼등·칼 면으로 눌린 멍(blunt)만
    r.clash += (Gm.clashes ?? 0) - c0;
    if (firstAt == null) r.first.none++;
    else {
      r.at.push(firstAt);
      r.first[firstAt < 0.02 ? 'hilt' : firstAt < 0.5 ? 'strong' : 'weak']++;
    }
  }
  rows.push(r);
}
console.log(`왕관 꼴 정적 막기 — 치는 쪽 롱소드 정수리 베기(oberhau ${SPD} m/s) · 막는 쪽 ${id} 패드 G.kron · 판 ${GAPS.length * SEEDS.length} / 꼴`);
for (const r of rows) {
  const k = r.n;
  const med = r.at.length ? [...r.at].sort((a, b) => a - b)[Math.floor(r.at.length / 2)] : NaN;
  console.log(`  ${r.shape.padEnd(4)} 막음 ${r.block}/${k} · 칼날 상처 없음 ${r.noCut}/${k} · 칼 부딪침 ${r.clash} · 처음 맞닿은 자리 코등이·자루 ${r.first.hilt} · 밑동 ${r.first.strong} · 약한 쪽 ${r.first.weak} · 없음 ${r.first.none} (가운데 값 ${med.toFixed(2)}) · ` +
    `치기 전 손 [${r.hand.map((v) => (v / k).toFixed(2)).join(', ')}] m · 칼 올려본 각 ${(r.el / k).toFixed(0)}° · |면·앞| ${(r.face / k).toFixed(2)}`);
}
