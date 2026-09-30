// ─────────────────────────────────────────────────────────────
//  corr_s0.mjs — 검술 보정 새 방식(v2)을 설정 0 에 두면 옛 방식 설정 0 과 스텝마다 비트까지 같은가 (설계 '스위치·바이트 동일' ③)
//   같은 프로세스·같은 시드에서 두 번 돈다: 모든 파이터 skill.corr = 'old' / 'v2' (끝점 겨눔 켬, skill.corrTip = true), newRound 뒤에 넣는다
//   장면 a: 플레이어 skill.level 0 을 고정 패드 순서(chain_corr 무리 9개, 게임과 같은 입력 길 corr_lib inputPump)로 몰고, 상대는 가만히 (칼 충돌 끔, 죽지 않음, skill.level 도 0), 1.55 m
//   장면 b: AI 대 AI (harness_m AI2Class), 두 쪽 persona level.skill = 0 (with_config 로는 AI 레벨 안쪽을 못 바꾼다)
//   시드 1·2·3, 20 s. 스텝마다 전정밀(float 비트 해시): 손 목표 · 칼 쿼터니언 · tipVel · 골반·가슴 자리 · 상처(부위·에너지) · Math.random 부른 수
//   출력: 장면·시드·한도마다 IDENTICAL, 또는 처음 다른 스텝·파이터·양. 하나라도 다르면 종료 코드 1
//   node tools/sim/corr_s0.mjs [--limits=off,on] [--scenes=a,b] [--seeds=1,2,3] [--secs=20] [--s=0]
//     --limits: BODY.humanLimits 를 판마다 이 값으로 (생략 = 설정 그대로 한 번). 기능이 없는 트리면 'limits absent' 로 한 번
//     --s=0.4 : 확인 모드 — v2 가지가 살아 있으면 첫 휘두름 안(옛 방식 첫 skill.swings 증가 + 0.5 s)에 달라야 한다. 달라지면 종료 0, 아니면 1
//   SKILL.corr 가 없는 트리: 'feature absent' 를 찍고 old 대 old 를 돈다 (도구 자체의 결정성 확인)
// ─────────────────────────────────────────────────────────────
import { newRound, DT, AI, CONFIG, THREE } from './harness_m.mjs';
import { Input } from '../../src/input.js';
import { hasCorr, hasLimits, setCorr, inputPump, feedTrace, pacer, stroke, setPad, FAM, SHORT_DEG, padYForEl } from './corr_lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m) throw new Error(`모르는 인자 ${a}`); return [m[1], m[2] ?? true]; }));
const list = (k, d) => String(args[k] ?? d).split(',').filter(Boolean);
const SCENES = list('scenes', 'a,b');
const SEEDS = list('seeds', '1,2,3').map(Number);
const SECS = +(args.secs ?? 20);
const S = +(args.s ?? 0);
const SANITY = S > 0;
const HAS = hasCorr(CONFIG);
const HASL = hasLimits(CONFIG);
const LIMITS = args.limits == null ? [HASL ? String(CONFIG.BODY.humanLimits) : 'absent'] : list('limits', 'off').map((x) => (x === 'on' || x === 'true' ? 'true' : x === 'off' || x === 'false' ? 'false' : x));
const ARMS = HAS ? ['old', 'v2'] : ['old', 'old'];
const deps = { Input, CONFIG, DT };
if (!HAS) console.log('feature absent (SKILL.corr 없음): old 대 old 를 돈다');
if (!HASL && args.limits != null) console.log('limits absent (BODY.humanLimits 없음): 한도 값마다 같은 판');

// ── 비트 해시 ──
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
let H = 0;
const hf = (x) => {
  F64[0] = x;
  H = Math.imul(H ^ U32[0], 16777619);
  H = Math.imul(H ^ U32[1], 16777619);
};
const QTY = ['handTarget', 'swordQ', 'tipVel', 'pelvis', 'chest', 'wounds', 'random'];
const NQ = QTY.length;
const ZONES = ['head', 'neck', 'chest', 'abdomen', 'pelvis', 'arm', 'leg'];

/** 장면 a 의 패드 순서: 무리마다 감기(3 m/s, 누른 채) → 베기 획 → 0.6 s 쉼 */
const PROG = ['diagR', 'vert', 'horizR', 'riseR', 'novA', 'novB', 'novC', 'liftShort', 'holdShort'];
function programme(G, P, E) {
  let k = 0;
  let phase = 0;
  return () => {
    if (G.pump.queue.length) return;
    const F = FAM[PROG[k % PROG.length]];
    if (phase === 0) {
      const off = [P.handOffset.x, P.handOffset.y];
      feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 3, { lift: false, hold: F.chHold ?? 0 }));
      phase = 1;
    } else if (phase === 1) {
      let end = F.end;
      if (F.short) {
        // 칼자루 → 상대 머리 가운데 선 올림각 + SHORT_DEG
        const hilt = P.bladePoint(0, new THREE.Vector3());
        const h = E.bodies.head.translation();
        const v = new THREE.Vector3(h.x - hilt.x, h.y - hilt.y, h.z - hilt.z);
        const el = Math.atan2(v.y, Math.hypot(v.x, v.z)) + (SHORT_DEG * Math.PI) / 180;
        end = [F.ch[0], Math.min(F.ch[1], padYForEl(el))];
      }
      const off = [P.handOffset.x, P.handOffset.y];
      feedTrace(G, stroke(end[0] - off[0], end[1] - off[1], F.v, { down: false, lift: true, hold: F.hold ?? 0 }));
      phase = 2;
    } else {
      feedTrace(G, { fn: () => [0, 0], T: 600, down: false, lift: false });
      phase = 0;
      k++;
    }
  };
}

function run(scene, seed, arm, limits) {
  if (HASL && limits !== 'absent') CONFIG.BODY.humanLimits = limits === 'true';
  let G;
  if (scene === 'a') {
    G = newRound({ walls: false, gap: 1.55 + 0.17, seed, skill: S });
    const P = G.player, E = G.enemy;
    G.ai.update = () => E.move.set(0, 0);
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
    E.die = () => {};
    const aw = E.applyWound.bind(E);
    E.applyWound = (h) => { if (!(E.decapitated && h.zone === 'neck')) aw(h); };
    P.skill.level = S;
    E.skill.level = S; // 가만히 선 상대도 같은 설정 (AI 'normal' 의 0.7 이 남으면 v2 가지가 상대에서 돈다)
    setPad(P, [0.18, -0.28]);
    inputPump(G, deps, { pace: pacer(60, seed) });
  } else {
    const per = () => ({ school: 'longsword', level: { skill: S } });
    G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'longsword', difficulty: 'normal', persona: per(), AI2Class: AI, difficulty2: 'normal', persona2: per() });
  }
  const P = G.player, E = G.enemy;
  for (const f of [P, E]) setCorr(CONFIG, f, arm, true);
  // Math.random 세기 (newRound 가 시드 난수로 바꾼 뒤)
  let nRand = 0;
  const rnd = Math.random;
  Math.random = () => (nRand++, rnd());
  const wounds = [];
  const ow = G.onWound;
  G.onWound = (att, vic, r) => {
    wounds.push([att.index, ZONES.indexOf(r.zone), r.energy]);
    ow?.(att, vic, r);
  };
  const next = scene === 'a' ? programme(G, P, E) : null;
  const n = Math.round(SECS / DT);
  const dig = new Uint32Array(n * 2 * NQ);
  let firstSwing = null;
  const sw0 = P.skill.swings + E.skill.swings;
  const FS = [P, E];
  for (let i = 0; i < n; i++) {
    next?.();
    wounds.length = 0;
    G.step();
    if (firstSwing == null && P.skill.swings + E.skill.swings > sw0) firstSwing = i;
    for (let fi = 0; fi < 2; fi++) {
      const f = FS[fi];
      const o = (i * 2 + fi) * NQ;
      H = 0x811c9dc5; hf(f.handTarget.x); hf(f.handTarget.y); hf(f.handTarget.z); dig[o] = H;
      const q = f.sword.rotation();
      H = 0x811c9dc5; hf(q.x); hf(q.y); hf(q.z); hf(q.w); dig[o + 1] = H;
      H = 0x811c9dc5; hf(f.tipVel.x); hf(f.tipVel.y); hf(f.tipVel.z); dig[o + 2] = H;
      const pp = f.bodies.pelvis.translation();
      H = 0x811c9dc5; hf(pp.x); hf(pp.y); hf(pp.z); dig[o + 3] = H;
      const cp = f.bodies.chest.translation();
      H = 0x811c9dc5; hf(cp.x); hf(cp.y); hf(cp.z); dig[o + 4] = H;
      H = 0x811c9dc5;
      for (const w of wounds) if (w[0] === f.index) { hf(w[1]); hf(w[2]); }
      dig[o + 5] = H;
      H = 0x811c9dc5; hf(nRand); dig[o + 6] = H;
    }
  }
  Math.random = rnd;
  return { dig, firstSwing, nRand, swings: P.skill.swings + E.skill.swings - sw0, wounds: G.wounds.length };
}

const t0 = Date.now();
let bad = 0;
for (const limits of LIMITS) {
  for (const scene of SCENES) {
    for (const seed of SEEDS) {
      const A = run(scene, seed, ARMS[0], limits);
      const B = run(scene, seed, ARMS[1], limits);
      let d = -1;
      for (let i = 0; i < A.dig.length; i++) if (A.dig[i] !== B.dig[i]) { d = i; break; }
      const tag = `장면 ${scene} 시드 ${seed} 한도 ${limits} s ${S} (${ARMS.join(' 대 ')})`;
      const info = `스텝 ${A.dig.length / (2 * NQ)}, 휘두름 ${A.swings}, 상처 ${A.wounds}, Math.random ${A.nRand}/${B.nRand}번`;
      if (d < 0) {
        console.log(`${tag}: IDENTICAL (${info})`);
        if (SANITY) bad++;
      } else {
        const step = Math.floor(d / (2 * NQ)), fi = Math.floor(d / NQ) % 2, qty = QTY[d % NQ];
        const where = `처음 다른 스텝 ${step} (t ${((step + 1) * DT).toFixed(3)} s) 파이터 ${fi ? 'E' : 'P'} 양 ${qty}`;
        if (SANITY) {
          const lim = A.firstSwing == null ? Infinity : A.firstSwing + Math.round(0.5 / DT);
          const ok = step <= lim;
          console.log(`${tag}: DIFF ${where} · 첫 휘두름 스텝 ${A.firstSwing ?? 'n/a'} → 확인 ${ok ? 'OK (v2 가지가 산다)' : 'FAIL (첫 휘두름 뒤에야 다름)'} (${info})`);
          if (!ok) bad++;
        } else {
          console.log(`${tag}: DIFF ${where} (${info})`);
          bad++;
        }
      }
    }
  }
}
console.log(`${SANITY ? '확인 모드' : '동일성'}: ${bad ? `실패 ${bad}` : '모두 통과'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
