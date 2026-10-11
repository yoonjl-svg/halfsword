// 막기 연환 탐침 (10/11 — docs/strike/parry_combo_secret_2026-10-11.md). 읽기만.
//  시험 무기 AI 가 서 있는 롱소드 몸(입력 없음)에게 다가가 간격(reach − 0.1) 안에 들면 막기 연환을 직접 낸다(secretGo — 막기 조건을 기다리지 않음) —
//  비기 빠르기 원칙(사장님 10/9 '비기는 통상의 움직임보다 훨씬 빨라야')을 재는 것: 수마다 칼끝 최고 빠르기 · 낸 때부터 그 수 끝까지 시간 · 맞힘.
//  SLOT=자리 열쇠(중국 geojeong·pyodu · 독일 ochsR·ochsL — 없으면 첫 자리) · HELD=s(독일 붙은 시간 어드밴티지 — bindGain) ·
//  CMP=기술 이름: 비기 대신 그 보통 기술을 같은 자리에서 낸다(startAttack — 손 속도·힘 창 없음) — 칼끝 빠르기 견줌
//  실행: node tools/sim/with_config.mjs SECRET.deSecret=parry parry_combo_probe.mjs [무기 qinggang] [씨앗 수 6]
import { newRound, DT } from './harness_m.mjs';
const id = process.argv[2] || 'qinggang';
const N = +(process.argv[3] || 6);
const agg = {};
let fired = 0;
let landedN = 0;
for (let seed = 1; seed <= N; seed++) {
  const G = newRound({ walls: false, weapon: 'longsword', weapon2: id, seed });
  const me = G.enemy;
  const A = G.ai; // 시험 무기 AI (상대 = 입력 없는 플레이어 몸)
  if (!A?.secret) {
    console.log('비기 없음');
    process.exit(1);
  }
  const S = A.secret;
  const slot = process.env.SLOT || Object.keys(S.do.combo ?? {})[0];
  const CMP = process.env.CMP ? A.school.techByName[process.env.CMP] : null;
  let t0 = null;
  let cur = null;
  let landed = false;
  for (let i = 0; i < 120 * 10; i++) {
    G.step();
    const near = t0 == null && G.t > 2.6 && me.state === 'stand' && G.player.state === 'stand' && me.foeDistance() < A.M.reach - 0.1 && A.secretFree();
    if (near) {
      const ok = CMP ? A.startAttack(CMP, 'test', { noFeint: true }) : A.secretGo(S, { slot, held: +(process.env.HELD || 0) });
      if (ok) (t0 = G.t), fired++;
    }
    if (t0 == null) continue;
    const run = CMP ? (A.mode === 'attack' ? { stage: 'strike' } : null) : A.secretRun;
    if (!run || run.stage === 'stiff') break;
    const nm = A.tech?.name ?? '-';
    if (nm !== cur?.n) {
      cur = { n: nm, v: 0, t: G.t - t0 };
      (agg[nm] ??= []).push(cur);
    }
    cur.v = Math.max(cur.v, me.tipVel.length());
    cur.end = G.t - t0;
    if (A.hitLanded) landed = true;
  }
  if (landed) landedN++;
}
console.log(`${id} ${process.env.CMP ? `보통 ${process.env.CMP}` : `비기 ${process.env.SLOT || '첫 자리'}${process.env.HELD ? ` 붙은 ${process.env.HELD} s` : ''}`} — 낸 ${fired}/${N} · 맞힘 ${landedN}`);
for (const [k, a] of Object.entries(agg)) {
  const av = (f) => (a.reduce((s, x) => s + f(x), 0) / a.length).toFixed(2);
  console.log(`  ${k}: 칼끝 최고 ${av((x) => x.v)} m/s · 시작 ${av((x) => x.t)} s · 끝 ${av((x) => x.end)} s (n ${a.length})`);
}
void DT;
