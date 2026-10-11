// 약한 자세 겨눔 장면 (10/12 — docs/import/saetbyeol_vital_2026-10-12.md): 무릎 꿇은 상대(다리 힘 0.2 + 가벼운 넘어짐 → 무릎, 반격 없음)에게
//  ① cut : 플레이어가 손가락으로 칼을 천천히 옆으로 옮겼다가(준비 0.6 s, 0.5 m/s) 반대쪽으로 빠르게 가로 벤다 (손 높이 세 가지)
//  ② tap : 플레이어가 화면을 톡 친다 (급소 찌르기 — 간격 맞추기 포함)
//  ③ ai  : 플레이어 자리 롱소드 AI 가 8 s 동안 친다
//  센다: 첫 몸 접촉 부위(목·머리 / 팔 / 다른 몸 / 헛침) · 목·머리 상처 · 참수 · 3 s · 10 s 안 죽음(장면 시작부터, 출혈 포함).
//  재현용 부상·입력 조건이다 (자연 결투의 빈도·승률이 아니다). 결정적 (같은 입력 → 같은 출력). 스위치는 환경 변수 VITAL=0|1 (harness_m.mjs)
//  사용법: node tools/sim/vital_scene.mjs [cut|tap|ai] [판 수=2]
import { newRound, DT, AI } from './harness_m.mjs';
import { FINISH } from '../../src/finish.js';
import { isMain } from './is_main.mjs';

class Dummy {
  constructor(me) {
    this.me = me;
  }
  update() {
    this.me.move.set(0, 0);
  }
}

export function scene({ kind, seed, gap, padY = 0.15 }) {
  const G = newRound({ seed, gap, weapon: 'longsword', AIClass: Dummy, ...(kind === 'ai' ? { AI2Class: AI } : {}) });
  const P = G.player;
  const E = G.enemy;
  const contacts = [];
  let tDead = null;
  let decap = false;
  const C = G.combat;
  const orig = C.strike.bind(C);
  let watch = kind === 'ai' ? -1 : 0; // ai: 늘 · 나머지: 공격을 시작한 뒤만
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (r && watch !== 0 && pr.w.fighter === P && pr.v?.fighter === E) contacts.push({ zone: r.zone, type: r.type, sev: r.severity, t: G.t });
    return r;
  };
  const ai2 = G.ai2;
  G.ai2 = null; // 무릎 꿇기까지 기다린다
  E.limbs.legF = E.limbs.legB = 0.2; // 다리 힘 0.2 — 일어나다 무릎에서 멈춘다 (fighter.js getup → kneel)
  E.knockDown(false);
  let t0 = null;
  let stage = -1;
  let stageT = 0;
  const H = P.handOffset;
  for (let i = 0; i < 14 / DT; i++) {
    if (t0 == null && E.state === 'kneel' && G.t > 1.2) {
      t0 = G.t;
      if (kind === 'ai') (G.ai2 = ai2), (watch = -1);
      if (kind === 'tap') (P.skill.thrust(), (watch = 1));
    }
    if (kind === 'cut' && t0 != null) {
      // 손가락 입력 (main.js 와 같은 칸): 닿음 · 움직임 · 손 목표
      stageT += DT;
      const goTo = (x, y, sp) => {
        const dx = x - H.x;
        const dy = y - H.y;
        const d = Math.hypot(dx, dy);
        const st = sp * DT;
        if (d > st) H.set(H.x + (dx / d) * st, H.y + (dy / d) * st);
        else H.set(x, y);
        P.inputActive = d > 1e-5;
        return d <= st;
      };
      P.handHeld = stage < 2;
      // 먼저 손 높이를 정하고(빠르게, 0.8 s 쉼) 그 높이에서 옆으로 천천히 준비한다 — 준비 보정은 손가락의 위아래 뜻을 거스르지 않으므로
      if (stage === -1) {
        if (goTo(0.05, padY, 3) && stageT > 0.8) (stage = 0), (stageT = 0);
        G.step();
        continue;
      }
      if (stage === 0 && (goTo(0.35, padY, 0.5) || stageT > 1.2) && stageT > 0.6) { (stage = 1), (stageT = 0), (watch = 1); if (process.env.VDBG) { const st = P.vitalPlayer; const n = E.bodies.head.translation(); console.log('dbg', padY, st?.phase, JSON.stringify(P.vitalCmd), 'cross', st?.cross?.height?.toFixed(2), 'neckY', n.y.toFixed(2), 'chestY', P.bodies.chest.translation().y.toFixed(2), 'local', st?.local?.toArray().map(v=>v.toFixed(2))); } }
      else if (stage === 1 && goTo(-0.45, padY, 4)) (stage = 2), (stageT = 0);
      else if (stage === 2) P.inputActive = false;
    }
    G.step();
    if (E.decapitated && t0 != null) decap = true;
    if (tDead == null && t0 != null && (E.state === 'dead' || E.revival)) tDead = G.t - t0;
    if (t0 != null && G.t - t0 > 10) break;
  }
  const body = contacts.find((c) => c.zone);
  const first = !body ? '헛침' : body.zone === 'neck' || body.zone === 'head' ? '목머리' : body.zone === 'arm' ? '팔' : '딴몸';
  return { kind, seed, gap, padY, kneel: t0 != null, first, firstZone: body ? `${body.zone}/${body.type}` : '-', vitalWound: contacts.some((c) => (c.zone === 'neck' || c.zone === 'head') && c.sev > 0), decap, tDead, cap: P.vitalPlayer?.captures ?? 0, taps: P.skill.vitalThrusts ?? 0, vs: ai2?.stats?.vital ?? 0 };
}

if (isMain(import.meta.url)) {
  const kind = process.argv[2] ?? 'cut';
  const N = +(process.argv[3] ?? 2);
  const rows = [];
  for (const gap of [1.3, 1.6, 1.9])
    for (const padY of kind === 'cut' ? [-0.05, 0.15, 0.35] : [0.15])
      for (let s = 0; s < N; s++) rows.push(scene({ kind, seed: 900 + 31 * s + Math.round(gap * 10), gap, padY }));
  const cnt = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
  console.log(`vital_scene ${kind} · vital=${FINISH.vital ? 1 : 0} · ${rows.length}판 (무릎 ${rows.filter((r) => r.kneel).length})`);
  console.log(`  첫 몸 접촉 ${JSON.stringify(cnt('first'))} · 목·머리 상처 ${rows.filter((r) => r.vitalWound).length} · 참수 ${rows.filter((r) => r.decap).length} · 3 s 안 죽음 ${rows.filter((r) => r.tDead != null && r.tDead <= 3).length} · 10 s 안 ${rows.filter((r) => r.tDead != null && r.tDead <= 10).length}`);
  console.log(`  플레이어 준비 보정 잡음 ${rows.filter((r) => r.cap).length} · 급소 찌르기 ${rows.reduce((m, r) => m + r.taps, 0)} · AI 급소 공격 ${rows.reduce((m, r) => m + r.vs, 0)}`);
  for (const r of rows) console.log(`   ${r.gap} y${r.padY} s${r.seed}: ${r.firstZone} ${r.decap ? '참수 ' : ''}${r.tDead != null ? `죽음 ${r.tDead.toFixed(1)}s` : ''}`);
}
