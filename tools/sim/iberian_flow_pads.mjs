// 이베리아 흐름 문(flowGate) 점검 (10/11): 츠바이핸더 AI 몸의 손 목표를 흐름이 지나는 패드 자리마다 1.4 s 붙들고, 칼끝의 몸 기준 자리(옆 + = 칼 든 쪽 · 위 · 앞)와 문 셋을 찍는다. 읽기만
//  실행: node tools/sim/hybrid.mjs iberian_flow_pads.mjs [무기 zweihander]
import { newRound, THREE } from './harness_m.mjs';
import { G as P } from '../../src/ai_techniques.js';
import { flowGate } from '../../src/secret.js';
const id = process.argv[2] || 'zweihander';
const pads = { wechselR: P.wechselR, wechselL: P.wechselL, ochsR: P.ochsR, ochsL: P.ochsL, tagR: P.tagR, tagL: P.tagL, langort: P.langort, fallR: [0.5, 0], fallL: [-0.5, 0], overR: [0.05, 0.5] };
const G = newRound({ walls: false, weapon: 'longsword', weapon2: id, seed: 1, gap: 4 });
const me = G.enemy;
G.ai.update = () => {};
const _r = new THREE.Vector3(), _f = new THREE.Vector3();
for (let i = 0; i < 120 * 2.6; i++) G.step();
const SEQ = process.env.SEQ; // SEQ=1: 패드를 차례로 (흐름 차례 — 오른 떨어뜨림 → 올려 탈류 → 왼 떨어뜨림 → 올려 레베스 → 머리 위 → 어깨), 없으면 패드마다 긴 자세에서 출발
const list = SEQ ? [['langort', P.langort], ['fallR', [0.5, 0.0]], ['wechselR', P.wechselR], ['midR', [0.04, -0.08]], ['ochsL', P.ochsL], ['fallL', [-0.5, 0]], ['wechselL', P.wechselL], ['midL', [-0.04, -0.08]], ['ochsR', P.ochsR], ['overR', [0.05, 0.5]], ['tagR', P.tagR], ['cutMid', [0.12, 0.14]], ['wechselL', P.wechselL]] : Object.entries(pads);
for (const [k, p] of list) {
  if (!SEQ) for (let i = 0; i < 120 * 1.0; i++) { me.handOffset.set(P.langort[0], P.langort[1]); G.step(); }
  for (let i = 0; i < 120 * (SEQ ? +SEQ : 1.4); i++) {
    me.handOffset.set(p[0], p[1]);
    G.step();
  }
  const c = me.bodies.chest.translation();
  const tp = me.tipPrev;
  me.right(_r);
  me.forward(_f);
  const rx = tp.x - c.x, ry = tp.y - c.y, rz = tp.z - c.z;
  const lat = me.side * (rx * _r.x + rz * _r.z), fw = rx * _f.x + rz * _f.z;
  console.log(`${k.padEnd(9)} [${p}] 칼끝 옆 ${lat.toFixed(2)} 위 ${ry.toFixed(2)} 앞 ${fw.toFixed(2)} · low+ ${flowGate(me, { low: 1 })} low− ${flowGate(me, { low: -1 })} cross+ ${flowGate(me, { cross: 1 })} cross− ${flowGate(me, { cross: -1 })} behind ${flowGate(me, { behind: true })}`);
}
