// ─────────────────────────────────────────────────────────────
//  ai_arm_cross.mjs — AI 끼리 싸움에서 AI 두 팔 엇갈림 · 팔 꼴 · 세기 재기 (11/12 사장님 '남은 팔 엇갈림 고치고 ai에도 넣어' — 기록 docs/strike/arm_clear2_2026-11-12.md).
//   재기만 한다 (--set 은 이 프로세스 안에서만). 스텝마다 서 있는(stand) AI 몸을 팔 뻗음 점검(arm_reach_audit.mjs armReachSample · flagsOf)과 같은 잣대로 잼:
//    두 팔 = 두 팔이 서로 2 cm 넘게 뚫음(손목 6 cm 뺌) · 뒤집힘 · 위팔 돌림 · 어깨 면 · 손목 범위 · 굴림 끝 · 거꾸로 쥠 · 팔이 몸 뚫음 · 칼이 제 몸 · 빈손 놓침(빈팔을 다쳐 놓은 것 뺌) — 스텝 몫(%)
//    (비기 · 고유 공격 · 운동학 칼 길 동안 = scripted 칸으로 따로 셈 — 그 길은 엇갈림 막기를 안 탐)
//   잼은 --every 스텝마다 (기본 3 — 40 Hz · 몫만 재므로 · 1 = 모든 스텝)
//   판 셈: 이김 · 맞음(칼날 상처 > 0) 수 · 심각도 합 · AI 공격 시작 · 끝남(afterStrike) · 맞힘 · 거둠(abort) · 막기(parry) · 피하기(void) · 상대 공격을 막아 냄(상대 afterStrike 가 bound · 못 벰)
//  장면:
//   fights12            관문 fights12.mjs 와 같은 판 (jelly_harness · 씨앗 1 ~ 12 · 30 s · 두 자리 모두 AI 'normal' · 롱소드 끼리) — 두 AI 모두 잼
//   pair:<무기>:<상대>   harness_m · 두 자리 모두 AI(숙련 3 — school_balance 상대 AI 와 같은 몸) · 무기 실측 간격 — 두 AI 모두 잼 (무기별로 묶음)
//   school:<유파>:<무기>:<상대>  school_balance.mjs fightOne 판 그대로(사람 손가락 봇 대 AI) — AI 쪽만 잼 (--scenes=sb = 표준 열세 칸)
//  node tools/sim/ai_arm_cross.mjs [--scenes=fights12,pair:zweihander:longsword,…|aiw|sb] [--seeds=1-8] [--seeds12=1-12] [--dur=30] [--set=SKILL.armClear.ai=0] [--shard=i/n] [--json=파일] [--trace=장면:씨앗]
//   --scenes=aiw = AI 가 드는 무기 모두(캐릭터 시트 무기) × 롱소드 · 거울 · sb = school_balance 표준 열세 칸
//  node tools/sim/ai_arm_cross.mjs --merge=a.json,b.json [--only=fights12|pair|school]   (묶음 표)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { armReachSample, flagsOf, FLAGS } from './arm_reach_audit.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { isMain } from './is_main.mjs';

/** AI 가 드는 무기 (캐릭터 시트 · 변형 무기 · weaponAlt — 권총 뺌: 팔 IK 없음) — 묶음 */
export const AI_GROUPS = {
  '두손 보통': ['longsword', 'excalibur', 'excalibur_replica'],
  '일본 두손': ['uchigatana', 'kusanagi', 'muramasa'],
  '대검': ['zweihander', 'monohoshizao'],
  '한손 독일 · 무유파': ['sabre', 'falchion', 'tree_branch', 'morgenstern'],
  '한손 동방': ['qinggang', 'hwando', 'goujian'],
  '한손 이탈리아': ['rapier', 'pappenheimer'],
};
export const AI_WEAPONS = Object.values(AI_GROUPS).flat();
export const groupOf = (w) => Object.entries(AI_GROUPS).find(([, ws]) => ws.includes(w))?.[0] ?? '그 밖';
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
function applySets(CONFIG, s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
/** 비기 · 고유 공격 · 운동학 칼 길 · 칼날 쥠 · 대본 팔 · 탭 찌르기 — 엇갈림 막기를 안 타는 때 (fighter.js handScripted 와 같은 가름) */
export function scriptedNow(f) {
  const uq = f.skill?.uniq;
  const aiSc = !!f.aiCtl?.secretRun || (!!f.aiCtl?.specRun && f.aiCtl.specRun.motion == null); // AI 비기 · 특수 공격 동작 (fighter.js aiScripted)
  return aiSc || !!f.skill?.sec || (!!uq && (uq.hold?.st === 'press' || uq.hold?.st === 'wind' || !!uq.running)) || !!f.iai || !!f.iaiOneHold || !!f.mordGrip || !!f.armsPlaced?.() || f.skill?.thrustPose?.w > 0;
}
/** 몸 하나 칸 */
const newTally = () => ({ n: 0, ns: 0, f: Object.fromEntries(FLAGS.map((k) => [k, 0])), fs: Object.fromEntries(FLAGS.map((k) => [k, 0])), deep: 0, minArms: Infinity });
function addSample(T, f, trace) {
  if (f.state !== 'stand' || !f.alive || f.armed === false || !f.sword) return;
  const s = armReachSample(f);
  if (!s) return;
  const sc = scriptedNow(f);
  const fl = flagsOf(s);
  // 빈손 놓침 = 빈손이 쥐려는데(offHand want — 빈팔 · 근육이 성하고 한 손 발도가 아님) 못 쥠 — 빈팔을 크게 다쳐 놓는 것(armO ≤ 0.3 · 근육 ≤ 0.3)은 뺌
  if (fl.grip && !(f.muscle > 0.3 && f.limbs.armO > 0.3 && !(f.iai?.oneHand || f.iaiOneHold))) fl.grip = false;
  T.n++;
  if (sc) T.ns++;
  for (const k of FLAGS) if (fl[k]) (sc ? T.fs : T.f)[k]++;
  if (s.arms < -0.05) T.deep++;
  T.minArms = Math.min(T.minArms, s.arms);
  trace?.(s, fl, sc);
}
/** AI 공격 · 막기 셈 (afterStrike 를 감싸 읽기만) */
function watchAI(ai) {
  const C = { fin: 0, finHit: 0, finBound: 0 };
  const orig = ai.afterStrike.bind(ai);
  ai.afterStrike = (d) => {
    C.fin++;
    if (ai.hitLanded) C.finHit++;
    else if (ai.bound) C.finBound++;
    return orig(d);
  };
  return C;
}
function aiCounts(ai, C, foeC) {
  const S = ai.stats;
  return { attacks: S.attacks, finished: C.fin, landed: S.landed, aborted: S.aborted, parries: S.parries, voids: S.voids, blockedFoe: foeC.finBound, specials: S.specials ?? {} };
}

/** school_balance 판 (사람 손가락 봇 대 숙련 3 AI) — AI 쪽(1 번)만 잼 */
async function runSchool(scene, seed, { dur = 30, trace = null, every = 3 } = {}) {
  const [, school, weapon, opp] = scene.split(':');
  const SB = await import('./school_balance.mjs');
  const TE = newTally();
  let CE = null;
  let ai = null;
  const r = SB.fightOne({ school, weapon, opp, seed, dur, onRound({ G, A }) {
    ai = G.ai;
    CE = watchAI(G.ai);
    const step = G.step.bind(G);
    let i = 0;
    G.step = () => {
      step();
      if (G.t >= 0.5 && !(i++ % every)) addSample(TE, A, trace && ((s, fl, sc) => trace('E', G.t, s, fl, sc, A)));
    };
  } });
  const win = r.win ? 'P' : r.lose ? 'E' : 'draw';
  return { scene, seed, win, tDead: null, downs: 0, P: null, E: { weapon: opp, T: TE, ai: aiCounts(ai, CE, { finBound: 0 }), hits: 0, sev: r.recv ?? 0, maxE: 0, state: r.lose ? 'stand' : 'stand' } };
}

/** 한 판 — scene 'fights12' | 'pair:a:b' | 'school:유파:무기:상대' */
export async function runOne(scene, seed, { dur = 30, trace = null, every = 3 } = {}) {
  if (scene.startsWith('school:')) return runSchool(scene, seed, { dur, trace, every });
  let G, P, E, aiP, aiE;
  if (scene === 'fights12') {
    const J = await import('./jelly_harness.mjs');
    let s = seed * 9301 + 49297; // fights12.mjs seedRand 그대로
    Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    G = J.newRound({ walls: true, seed });
    P = G.player;
    E = G.enemy;
    P.skill.level = 0.7;
    G.ai2 = new J.AI(P, E, 'normal');
    aiP = G.ai2;
    aiE = G.ai;
  } else {
    const [, w1, w2] = scene.split(':');
    const H = await import('./harness_m.mjs');
    G = H.newRound({ seed, weapon: w1, weapon2: w2, AI2Class: H.AI, walls: true, persona: { proficiency: 3 }, persona2: { proficiency: 3 } });
    applyWeaponMeasure(G.ai, w2);
    applyWeaponMeasure(G.ai2, w1);
    P = G.player;
    E = G.enemy;
    aiP = G.ai2;
    aiE = G.ai;
  }
  const CP = watchAI(aiP);
  const CE = watchAI(aiE);
  const wounds = [];
  const prevHook = G.combat.hooks?.onWound;
  if (G.combat.hooks) G.combat.hooks.onWound = (att, vic, r) => { wounds.push({ att: att === P ? 'P' : 'E', type: r.type, sev: r.severity ?? 0, E: r.energy ?? 0, zone: r.zone }); prevHook?.(att, vic, r); };
  const TP = newTally();
  const TE = newTally();
  const DT = G.world.timestep;
  let tDead = null;
  let downs = 0;
  const prev = { P: 'stand', E: 'stand' };
  try {
    for (let i = 0; i < dur / DT; i++) {
      G.step();
      for (const [k, f] of [['P', P], ['E', E]]) {
        if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++;
        prev[k] = f.state;
      }
      if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
      if (G.t < 0.5 || i % every) continue;
      addSample(TP, P, trace && ((s, fl, sc) => trace('P', G.t, s, fl, sc, P)));
      addSample(TE, E, trace && ((s, fl, sc) => trace('E', G.t, s, fl, sc, E)));
    }
  } finally {
    G.world.free();
  }
  const win = P.state === 'dead' && E.state !== 'dead' ? 'E' : E.state === 'dead' && P.state !== 'dead' ? 'P' : 'draw';
  const side = (k, f, T, ai, C, foeC) => {
    const mine = wounds.filter((w) => w.att === k);
    const edged = mine.filter((w) => w.type !== 'blunt' && w.sev > 0);
    return { weapon: f.weaponSpecId ?? f.weapon?.id, T, ai: aiCounts(ai, C, foeC), hits: edged.length, sev: mine.reduce((a, w) => a + w.sev, 0), maxE: Math.max(0, ...mine.map((w) => w.E)), state: f.state };
  };
  return { scene, seed, win, tDead, downs, P: side('P', P, TP, aiP, CP, CE), E: side('E', E, TE, aiE, CE, CP) };
}

/** 무기별 묶음 */
export function aggregate(runs) {
  const byW = {};
  for (const r of runs) for (const k of ['P', 'E']) {
    const s = r[k];
    if (!s) continue;
    const w = s.weapon;
    const A = (byW[w] ??= { weapon: w, group: groupOf(w), n: 0, ns: 0, f: Object.fromEntries(FLAGS.map((x) => [x, 0])), fs: Object.fromEntries(FLAGS.map((x) => [x, 0])), deep: 0, minArms: Infinity, fights: 0, wins: 0, losses: 0, hits: 0, sev: 0, attacks: 0, finished: 0, landed: 0, aborted: 0, parries: 0, voids: 0, blockedFoe: 0 });
    A.n += s.T.n;
    A.ns += s.T.ns;
    for (const x of FLAGS) (A.f[x] += s.T.f[x]), (A.fs[x] += s.T.fs[x]);
    A.deep += s.T.deep;
    A.minArms = Math.min(A.minArms, s.T.minArms);
    A.fights++;
    if (r.win === k) A.wins++;
    else if (r.win !== 'draw') A.losses++;
    A.hits += s.hits;
    A.sev += s.sev;
    for (const x of ['attacks', 'finished', 'landed', 'aborted', 'parries', 'voids', 'blockedFoe']) A[x] += s.ai[x];
  }
  return Object.values(byW);
}
const pc = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '–');
export function tableMd(rows, { by = 'weapon' } = {}) {
  const keys = by === 'group' ? Object.keys(AI_GROUPS) : rows.map((r) => r.weapon);
  const pick = (k) => (by === 'group' ? rows.filter((r) => r.group === k) : rows.filter((r) => r.weapon === k));
  const L = ['| ' + (by === 'group' ? '묶음' : '무기') + ' | 스텝 | 두 팔 % (막기 탐 · 대본 길) | 5 cm 넘게 % | 뒤집힘 % | 위팔 돌림 % | 어깨 면 % | 손목 범위 % | 굴림 끝 % | 거꾸로 % | 몸 뚫음 % | 칼 제 몸 % | 빈손 놓침 % | 판 · 이김 · 짐 | 맞음/판 | 심각도/판 | 공격 · 끝남 · 맞힘 · 거둠 | 막기 · 피함 · 막아 냄 |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|'];
  for (const k of keys) {
    const rs = pick(k);
    if (!rs.length) continue;
    const S = (x) => rs.reduce((a, r) => a + r[x], 0);
    const F = (x) => rs.reduce((a, r) => a + r.f[x], 0);
    const FS = (x) => rs.reduce((a, r) => a + r.fs[x], 0);
    const n = S('n'), ns = S('ns'), nf = n - ns;
    const fights = S('fights');
    L.push(`| ${k} | ${n} | ${pc(F('arms') + FS('arms'), n)} (${pc(F('arms'), nf)} · ${pc(FS('arms'), ns)}) | ${pc(S('deep'), n)} | ${pc(F('elbowUp') + FS('elbowUp'), n)} | ${pc(F('shRot') + FS('shRot'), n)} | ${pc(F('shPlane') + FS('shPlane'), n)} | ${pc(F('oor') + FS('oor'), n)} | ${pc(F('roll') + FS('roll'), n)} | ${pc(F('rev') + FS('rev'), n)} | ${pc(F('body') + FS('body'), n)} | ${pc(F('sword') + FS('sword'), n)} | ${pc(F('grip') + FS('grip'), n)} | ${fights} · ${S('wins')} · ${S('losses')} | ${(S('hits') / fights).toFixed(2)} | ${(S('sev') / fights).toFixed(2)} | ${S('attacks')} · ${S('finished')} · ${S('landed')} · ${S('aborted')} | ${S('parries')} · ${S('voids')} · ${S('blockedFoe')} |`);
  }
  return L.join('\n');
}
/** fights12 줄 (관문과 같은 꼴 — 누가 어떻게 이겼나) */
export function fights12Line(runs) {
  return runs.filter((r) => r.scene === 'fights12').map((r) => `${r.seed}:${r.P.state}/${r.E.state}${r.tDead ? '@' + r.tDead : ''} d${r.downs} hP${r.P.hits} hE${r.E.hits}`).join('  ');
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const mg = arg('merge', null);
  if (mg) {
    // --merge=a.json,b.json [--only=fights12|pair|school] — 여러 판 묶음 표
    const only = arg('only', null);
    const runs = mg.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).runs).filter((r) => !only || r.scene.startsWith(only));
    const rows = aggregate(runs);
    console.log(tableMd(rows, { by: 'group' }));
    console.log('');
    console.log(tableMd(rows));
    if (runs.some((r) => r.scene === 'fights12')) console.log('\nfights12: ' + fights12Line(runs));
    process.exit(0);
  }
  const { CONFIG } = await import('./harness_m.mjs');
  applySets(CONFIG, arg('set', ''));
  let scenes = arg('scenes', 'fights12').split(',');
  if (scenes.includes('sb')) scenes = scenes.flatMap((s) => (s === 'sb' ? ['german:longsword:longsword', 'german:sabre:longsword', 'italian:rapier:longsword', 'iberian:zweihander:longsword', 'japanese:uchigatana:longsword', 'chinese:hwando:longsword', 'none:morgenstern:longsword', 'italian:rapier:rapier', 'iberian:zweihander:zweihander', 'japanese:uchigatana:uchigatana', 'chinese:hwando:hwando', 'german:sabre:sabre', 'none:morgenstern:morgenstern'].map((c) => `school:${c}`) : [s]));
  if (scenes.includes('aiw')) scenes = scenes.flatMap((s) => (s === 'aiw' ? AI_WEAPONS.flatMap((w) => (w === 'longsword' ? ['pair:longsword:longsword'] : [`pair:${w}:longsword`, `pair:${w}:${w}`])) : [s]));
  const [si, sn] = arg('shard', '0/1').split('/').map(Number);
  scenes = scenes.filter((_, i) => i % sn === si);
  const seeds = range(arg('seeds', '1-8'));
  const dur = +arg('dur', 30);
  const tr = arg('trace', null);
  const runs = [];
  for (const sc of scenes) {
    for (const seed of sc === 'fights12' ? range(arg('seeds12', '1-12')) : seeds) {
      const trace = tr && tr === `${sc}:${seed}` ? (k, t, s, fl, scr, f) => { if (fl.arms) console.log(`${k} ${f.weaponSpecId} t ${t.toFixed(2)} arms ${(s.arms * 100).toFixed(1)} scr ${scr ? 1 : 0} aim ${f.skill.aim.x.toFixed(2)},${f.skill.aim.y.toFixed(2)} hand ${s.hand.map((v) => v.toFixed(2)).join(',')} el ${s.elbowP.map((v) => v.toFixed(2)).join(',')} sw ${f.skill.swinging ? 1 : 0}`); } : null;
      const r = await runOne(sc, seed, { dur, trace, every: +arg('every', 3) });
      runs.push(r);
      console.error(`${sc} ${seed} win ${r.win} arms P ${r.P ? pc(r.P.T.f.arms + r.P.T.fs.arms, r.P.T.n) : '-'} E ${pc(r.E.T.f.arms + r.E.T.fs.arms, r.E.T.n)}`);
    }
  }
  const rows = aggregate(runs);
  console.log(tableMd(rows, { by: 'group' }));
  console.log('');
  console.log(tableMd(rows));
  if (runs.some((r) => r.scene === 'fights12')) console.log('\nfights12: ' + fights12Line(runs));
  const json = arg('json', null);
  if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), scenes, seeds, dur, runs }));
}
