// ─────────────────────────────────────────────────────────────
//  iberian_spin_ai.mjs — AI 싱지르 손맛 · 균형 재기 (10/24 사장님 02:5x '싱지르 ai에게도 열어' — ai.js spinTick · SECRET.aiOpenSchools 'iberian')
//   이베리아 인물 AI(숙련도 AI_PROFICIENCY.secretAt 이상 — 롤랑 6 · 베르나르도 6) 대 인물 AI 판. --spin=0 = 이베리아를 aiOpenSchools 에서 뺀 판(같은 시드 견줌).
//
//  node tools/sim/iberian_spin_ai.mjs [--heroes=roland,bernardo] [--opps=isolde,heinrich,margarethe,minami] [--seeds=1-9] [--dur=30] [--spin=1|0] [--json=파일]
//   판마다: 이긴 쪽(상대가 죽음 · 끝까지 살면 무) · 영웅 싱지르 낸 수 · 맞힌 수(그 비기 동안 상대 아픔 +0.05 — ai.js secretStat landed) · 준 · 받은 상처 심각도 합 · 판 길이
//   영웅 = 상대 자리(G.ai · 인물 시트의 무기 · 겉모습 · 숙련도 · 부활) · 맞수 = 사람 자리(AI2Class · 인물 시트 그대로)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => {
  const out = [];
  for (const p of String(s).split(',')) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(+p);
  }
  return out;
};
const { SECRET } = CONFIG;
if (arg('spin', '1') === '0') SECRET.aiOpenSchools = SECRET.aiOpenSchools.filter((s) => s !== 'iberian');
const DUR = +arg('dur', 30);

function fight(heroId, oppId, seed) {
  const H = CHARACTERS_BY_ID[heroId];
  const O = CHARACTERS_BY_ID[oppId];
  if (!H || !O) throw new Error(`인물 ${heroId} · ${oppId}?`);
  const G = newRound({ seed, weapon: O.weapon, weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona, look2: H.look, revive: H.revive, AI2Class: AI, difficulty2: O.ai.level, persona2: O.ai.persona, look: O.look, revive2: O.revive });
  const E = G.enemy;
  const P = G.player;
  const sev = (f, by) => (f.wounds ?? []).filter((w) => !by || w.att === by).reduce((a, w) => a + (w.severity ?? 0), 0);
  while (G.t < DUR && P.alive && E.alive) G.step();
  const st = G.ai.stats.secrets?.ibSpin ?? { fired: 0, landed: 0 };
  const dealt = G.wounds.filter((w) => w.att === E && w.vic === P).reduce((a, w) => a + w.severity, 0);
  const taken = G.wounds.filter((w) => w.att === P && w.vic === E).reduce((a, w) => a + w.severity, 0);
  const r = { hero: heroId, opp: oppId, seed, win: E.alive && !P.alive, lose: !E.alive && P.alive, t: +G.t.toFixed(1), spins: st.fired, landed: st.landed, dealt: +dealt.toFixed(2), taken: +taken.toFixed(2), arms: G.ai.spinArm?.ons ?? 0, secret: G.ai.secret?.name ?? null };
  void sev;
  G.world.free();
  return r;
}

const HEROES = list('heroes', 'roland,bernardo');
const OPPS = list('opps', 'isolde,heinrich,margarethe,minami');
const SEEDS = range(arg('seeds', '1-9'));
const all = [];
for (const h of HEROES)
  for (const o of OPPS)
    for (const s of SEEDS) {
      const r = fight(h, o, s);
      all.push(r);
      if (!args.quiet) console.error(`… ${h} vs ${o} ${s}: ${r.win ? '이김' : r.lose ? '짐' : '무'} · 싱지르 ${r.spins} (맞힘 ${r.landed}) · 준 ${r.dealt} · 받은 ${r.taken} · ${r.t} s`);
    }
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
console.log(`설정: aiOpenSchools ${JSON.stringify(SECRET.aiOpenSchools)} · ${DUR} s · 시드 ${SEEDS.join(',')}`);
console.log('| 영웅 | 맞수 | 판 | 이김 · 짐 · 무 | 판당 싱지르 | 맞힘 (낸 수 가운데) | 판당 준 상처 심각도 | 판당 받은 상처 심각도 | 판 길이 평균 s |');
console.log('|---|---|---|---|---|---|---|---|---|');
const groups = new Map();
for (const r of all) {
  for (const k of [`${r.hero}|${r.opp}`, `${r.hero}|합`]) {
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
}
const order = [...groups.keys()].sort((a, b) => (a.split('|')[0] === b.split('|')[0] ? (a.endsWith('|합') ? 1 : b.endsWith('|합') ? -1 : 0) : a < b ? -1 : 1));
for (const k of order) {
  const rs = groups.get(k);
  const [h, o] = k.split('|');
  const n = rs.length;
  const sp = rs.reduce((a, r) => a + r.spins, 0);
  const ld = rs.reduce((a, r) => a + r.landed, 0);
  const B = o === '합' ? '**' : '';
  console.log(`| ${B}${h}${B} | ${B}${o}${B} | ${n} | ${rs.filter((r) => r.win).length} · ${rs.filter((r) => r.lose).length} · ${rs.filter((r) => !r.win && !r.lose).length} | ${f2(sp / n)} | ${ld} / ${sp} | ${f2(rs.reduce((a, r) => a + r.dealt, 0) / n)} | ${f2(rs.reduce((a, r) => a + r.taken, 0) / n)} | ${f2(rs.reduce((a, r) => a + r.t, 0) / n)} |`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(all));
