// ─────────────────────────────────────────────────────────────
//  ai_read_measure.mjs — 유파 AI 3 단계 수 읽기 · 공정함 · AI 고노센 재기 (11/14 — src/ai_read.js · ai_plan_jp.js jpGnsFeet · config AI_PLAN.read · 기록 docs/strike/ai_read_2026-11-14.md)
//   사장님 11/14 'ai의 변화 재는 거 최소로 해' — 롱소드 AI(숙련 2 · 사람 자리) 대 일본(우치가타나) · 이탈리아(레이피어) · 동방(청강검) · 이베리아(츠바이핸더) AI 한 짝씩 ·
//   숙련 3 · 5 × 씨앗 1 ~ 6 · 30 s · 벽. 보는 것: 이김 · 짐 · 비김 · 맞음(준 · 받은 칼날 상처 수) · 읽기 행동(상대 유파 위험 · 대가 창 · 상대 기력 판단 수) · AI 고노센 수 · 준비 켜짐 · 지킴 · 꾐.
//   합친 판과 견줄 때는 그 판 파일에 이 도구를 놓고 같은 줄로 돌림 (읽기 칸이 없으면 '-')
//  node tools/sim/ai_read_measure.mjs [--schools=japanese,italian,chinese,iberian] [--profs=3,5] [--seeds=1-6] [--dur=30] [--read=on,fair]
// ─────────────────────────────────────────────────────────────
import { newRound, AI } from './harness_m.mjs';
import { AI_PLAN } from '../../src/config.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const WEAPON = { japanese: 'uchigatana', italian: 'rapier', chinese: 'qinggang', iberian: 'zweihander' };

export function fightOne({ school, seed = 1, prof = 3, dur = 30 }) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: WEAPON[school], AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: 2 } });
  const P = G.player;
  const E = G.enemy;
  const ai = G.ai;
  const n = { E: 0, P: 0 };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (sv > 0 && vic === E) n.E++;
    if (sv > 0 && vic === P) n.P++;
  };
  const out = (f) => !f.alive || f.state === 'dead';
  let ons = null; // 준비 켜진 수 (고노센을 내면 iaiArm 이 비므로 스텝마다 적어 둠)
  while (G.t < dur && !out(P) && !out(E)) {
    G.step();
    if (ai.iaiArm) ons = ai.iaiArm.ons;
  }
  const st = ai.stats;
  const R = st.read;
  const r = {
    school, seed, prof, T: +G.t.toFixed(2), win: out(P) && !out(E), lose: out(E) && !out(P), dealt: n.P, recv: n.E,
    read: R ? { risk: Object.values(R.risk).reduce((a, b) => a + b, 0), cost: R.cost, stamina: R.stamina, notes: R.notes, raises: R.raises } : null,
    gns: st.secrets?.goNoSen?.fired ?? 0, gnsHit: st.secrets?.goNoSen?.landed ?? 0, invite: st.plan?.jp?.invite ?? null, keep: st.plan?.jp?.keep ?? null, armed: ons,
  };
  G.world.free();
  return r;
}

const schools = arg('schools', 'japanese,italian,chinese,iberian').split(',');
const profs = arg('profs', '3,5').split(',').map(Number);
const seeds = range(arg('seeds', '1-6'));
const dur = +arg('dur', 30);
const rdArg = arg('read', null); // --read=on,fair (예: 0,1 = 읽기 끔 · 공정함 켬) — 어느 몫 탓인지 가를 때만 · 없으면 config 그대로
if (rdArg && AI_PLAN.read) {
  const [on, fair] = rdArg.split(',').map(Number);
  AI_PLAN.read = { ...AI_PLAN.read, on, fair };
}
const L = ['| 짝 (숙련) | 판 수 | 이김 · 짐 · 비김 | 맞음/판 준 · 받은 | 읽기 판단/판: 상대 유파 위험 · 대가 창 · 상대 기력 | 본 칼 · 칼 든 거리 적음/판 | AI 고노센/판 (맞힘 · 준비 켜짐 · 지킴 · 꾐) | 판 길이 s |', '|---|---|---|---|---|---|---|---|'];
for (const school of schools) for (const prof of profs) {
  const rs = [];
  for (const seed of seeds) {
    const r = fightOne({ school, seed, prof, dur });
    rs.push(r);
    console.error(JSON.stringify(r));
  }
  const k = rs.length, W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
  const per = (f) => f2(mean(rs.map(f)));
  const rd = rs[0].read ? `${per((r) => r.read.risk)} · ${per((r) => r.read.cost)} · ${per((r) => r.read.stamina)}` : '-';
  const nt = rs[0].read ? `${per((r) => r.read.notes)} · ${per((r) => r.read.raises)}` : '-';
  const gn = school === 'japanese' ? `${per((r) => r.gns)} (${per((r) => r.gnsHit)} · ${rs[0].armed == null ? '-' : per((r) => r.armed)} · ${rs[0].keep == null ? '-' : per((r) => r.keep)} · ${rs[0].invite == null ? '-' : per((r) => r.invite)})` : '-';
  L.push(`| ${WEAPON[school]} (${school}) 숙련 ${prof} 대 롱소드 AI | ${k} | ${W} · ${Ls} · ${k - W - Ls} | ${per((r) => r.dealt)} · ${per((r) => r.recv)} | ${rd} | ${nt} | ${gn} | ${per((r) => r.T)} |`);
}
console.log(L.join('\n'));
