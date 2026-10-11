// 비기 길 흔적 (10/12 — docs/strike/cn_combo_play_2026-10-12.md §11 그림). 읽기만.
//  cn_combo_speed.mjs 와 같은 대본(시험 AI 가 서 있는 롱소드 몸에게 직접 냄)으로 낸 때부터 경직 전까지 스텝마다 — 낸 때의 몸 틀(가슴 원점 · x 앞 · y 위 · z 칼 든 쪽) 자리로:
//   칼 어깨·팔꿈치·손목 · 빈팔 어깨·팔꿈치·손목 · 칼자루 끝(칼날 0)·칼끝 · 상대 가슴·골반 몸체 가운데. JSON 으로 쓴다 → tools/sim/secret_trace_draw.py 가 옆·앞 그림으로.
//  실행: node tools/sim/secret_trace.mjs <나갈 json> [씨앗 1]   ·   전: node tools/sim/with_config.mjs SECRET.cnPath=0 SECRET.secretReach=0 SECRET.iaiRise=0 secret_trace.mjs <json>
import fs from 'node:fs';
import { newRound, THREE } from './harness_m.mjs';
const out = process.argv[2] || 'secret_trace.json';
const seed0 = +(process.argv[3] || 1);
const runs = [
  { id: 'qinggang', ctx: { slot: 'geojeong', held: 0 }, key: 'geojeong' },
  { id: 'qinggang', ctx: { slot: 'pyodu', held: 0 }, key: 'pyodu' },
  { id: 'qinggang', ctx: { slot: 'bongdu', held: 0 }, key: 'bongdu' },
  { id: 'uchigatana', ctx: {}, key: 'iai' },
];
const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const res = {};
for (const R of runs) {
  for (let seed = seed0; seed < seed0 + 12 && !res[R.key]; seed++) {
    const G = newRound({ walls: false, weapon: 'longsword', weapon2: R.id, seed });
    const me = G.enemy;
    const A = G.ai;
    let t0 = null;
    let c0 = null;
    let inv = null;
    const fr = [];
    for (let i = 0; i < 120 * 10; i++) {
      G.step();
      const near = t0 == null && G.t > 2.6 && me.state === 'stand' && G.player.state === 'stand' && me.foeDistance() < A.M.reach - 0.1 && A.secretFree();
      if (near && A.secretGo(A.secret, R.ctx)) {
        t0 = G.t;
        c0 = V(me.bodies.chest.translation());
        inv = me.yaw.clone().invert();
      }
      if (t0 == null) continue;
      const run = A.secretRun;
      if (!run || run.stage === 'stiff' || G.t - t0 > 1.2) break;
      const B = (v) => v.sub(c0).applyQuaternion(inv).toArray().map((x) => +x.toFixed(3));
      const ua = me.bodies.uarmS;
      const fa = me.bodies.farmS;
      const ux = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(ua.rotation()));
      const fx = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(fa.rotation()));
      fr.push({
        t: +(G.t - t0).toFixed(3),
        sh: B(V(ua.translation()).addScaledVector(ux, -0.15)),
        el: B(V(fa.translation()).addScaledVector(fx, -0.135)),
        wr: B(V(fa.translation()).addScaledVector(fx, 0.13)),
        hi: B(me.bladePoint(0, new THREE.Vector3())),
        tip: B(me.bladePoint(1, new THREE.Vector3())),
        fc: B(V(G.player.bodies.chest.translation())),
        fp: B(V(G.player.bodies.pelvis.translation())),
        cut: !!me.iai?.cutting || me.iai?.kind === 'iai',
        ...(me.bodies.uarmO && me.bodies.farmO
          ? (() => {
              const uo = me.bodies.uarmO;
              const fo = me.bodies.farmO;
              const uy = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(uo.rotation()));
              const fy = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(fo.rotation()));
              const oel = V(fo.translation()).addScaledVector(fy, 0.14);
              return { osh: B(V(uo.translation()).addScaledVector(uy, 0.15)), oel: B(oel.clone()), owr: B(oel.addScaledVector(fy, -0.27)) }; // 빈팔: 몸체가 −y 로 누움 (poseEnd 빈팔 자리와 같은 기하)
            })()
          : {}),
      });
    }
    if (fr.length) res[R.key] = { id: R.id, seed, frames: fr };
  }
}
fs.writeFileSync(out, JSON.stringify(res));
console.log(`wrote ${out}: ${Object.entries(res).map(([k, v]) => `${k} ${v.frames.length}`).join(' · ')}`);
