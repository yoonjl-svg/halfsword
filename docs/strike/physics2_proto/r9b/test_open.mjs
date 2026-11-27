// 뒤집힌 시험 둘의 판을 그대로 돌려 봄 (재기만): ROOT=<나무> node test_open.mjs
//  ① ib_link '맞바꿈 B12' 판 (츠바이핸더 사람 몸 자리 대 롱소드 AI · 씨앗 1 · gap 1.6 · 이베리아 칸 모두) — 30 s 안 상대 칼날이 내 몸에 든 때 · 그때까지 상처 · 칼끼리 닿음
//  ② onehand_arm '병마용 AI' 판 (월왕구천검 병마용 기질 대 롱소드 AI · 15 s · 씨앗 11 · 상처 끔) — 한손 팔 몫 · 위팔 돌림 밖 스텝이 난 때(0.5 s 칸)
const root = process.env.ROOT;
const { newRound } = await import(root + '/tools/sim/harness_m.mjs');
const { kitFromNodes, allNodeIds } = await import(root + '/src/skill_tree_data.js');
if (kitFromNodes) {
  const kit = kitFromNodes('iberian', allNodeIds('iberian'));
  const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed: 1, gap: 1.6, kit });
  const P = G.player, E = G.enemy;
  const ev = [];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, point, pr) => { pw?.(att, vic, r, point, pr); ev.push(`${G.t.toFixed(2)} ${att === E ? 'E→P' : 'P→E'} ${pr?.v?.part} ${r.type} sev ${r.severity?.toFixed?.(2)}`); };
  let cap = null;
  while (!cap && G.t < 30) { G.step(); cap = ev.find((e) => e.includes('E→P') && !e.includes('blunt') && !/sev 0\.00/.test(e)) ?? null; }
  console.log(`① 상대 칼날이 몸에 듦: ${cap ?? '없음(30 s)'} · 끝 t ${G.t.toFixed(1)} · 상태 P ${P.state} E ${E.state} · 칼끼리 ${G.clashes ?? '-'} · 맞음 기록 ${ev.length}: ${ev.slice(0, 8).join(' | ')}`);
}
const { aiRun } = await import(root + '/tools/sim/onehand_arm.mjs');
const { CHARACTERS_BY_ID } = await import(root + '/src/characters.js');
const r = aiRun('goujian', { foeW: 'longsword', persona: CHARACTERS_BY_ID.terracotta.ai.persona, only: 'enemy', seed: 11, wounds: false });
const T = r.T;
console.log('② ' + JSON.stringify(T, (k, v) => (v instanceof Map ? [...v.entries()] : typeof v === 'number' ? +v.toFixed(3) : v)).slice(0, 1500));
