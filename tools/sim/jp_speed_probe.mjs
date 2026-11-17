// ─────────────────────────────────────────────────────────────
//  jp_speed_probe.mjs — 일본 기다림과 침 스택 빠르기 재기 (11/16 사장님 '… ai는 스택마다 +2.5%로 하고 사람은 +5%로 할까? 곱연산 말고 합연산.' → '그렇게 해. 고노센과 제비베기에도 적용돼야해.' —
//   config JP_TANK.speed · school_passive.js speedOf · 기록 docs/strike/secret_free_2026-11-16.md §10). 싸움 없음 — 칼 한 번씩: 스택 0 / 5 / 10 · 우치가타나 · 실제 m/s.
//  사람(0 번 몸 · humanInput · 일본 스킬트리 모두): cut = 손가락 큰 베기(zornhau 획 — thrust_motion.mjs 와 같은 손 4.25 패드 m/s) · gns = 고노센(skill.secret) ·
//   tsu = 제비 베기 되돌림 칼(빗나간 앞 칼에서 들고 온 스택 — 묶인 칼의 carryStk) / AI(숙련 5 — 1 번 몸): cut = 큰 베기 기술(zornhau 길) · gns = 고노센(secretGo) · tsu = 제비 베기 기술(startAttack).
//  잰 것: 칼끝 가장 빠름(4 스텝 창 평균 — 운동학 칼 놓임 튐을 거름) · 같은 칼 스택 0 에 대한 몫 · 목표(1 + k × 스택). 상대는 롱소드(서 있음 — 사람 3 m · AI 칼끝 거리 안)
//  node tools/sim/jp_speed_probe.mjs [--stacks=0,5,10] [--seeds=1,2,3 (칼끝 가장 빠름 평균)] [--set=JP_TANK.speedHuman=0.05]
// ─────────────────────────────────────────────────────────────
import { newRound, DT, THREE, CONFIG, AI } from './harness_m.mjs';
import { TECH_BY_NAME, G as PAD } from '../../src/ai_techniques.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { TRADITIONS } from '../../src/schools.js';
import { requestArtSnap } from '../../src/secret_instant.js';
import { specialShare } from '../../src/unique_assist.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k;
const FRAME = 1 / 60;
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'null' ? null : Number.isNaN(+v) ? v : +v;
  }
}

/** 칼끝 가장 빠름 (실제 m/s · 4 스텝 창) — 다음 secs 실제 초 동안 */
function peak(G, f, secs, each) {
  const tips = [];
  let v = 0;
  f.jpSMax = 1;
  for (let i = 0; i < secs * K / DT; i++) {
    each?.(i);
    G.step();
    f.jpSMax = Math.max(f.jpSMax, f.jpSpeedS ?? 1);
    tips.push(f.bladePoint(1, new THREE.Vector3()));
    if (tips.length > 4) v = Math.max(v, tips.at(-1).distanceTo(tips.at(-5)) / ((4 * DT) / K));
  }
  return v;
}

export function humanRun(kind, n, seed = 1) {
  const kit = kitFromNodes('japanese', allNodeIds('japanese'));
  const G = newRound({ weapon: 'uchigatana', weapon2: 'longsword', seed, gap: 3, walls: false, kit, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  G.ai.update = () => G.enemy.move.set(0, 0);
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  for (let t = 0; t < 1.2 * K; t += DT) (P.move.set(0, 0)), G.step();
  const SP = P.schoolPassive;
  let v = 0;
  if (kind === 'cut') {
    const T = TECH_BY_NAME.zornhau;
    const q = [];
    let fx = P.handOffset.x, fy = P.handOffset.y;
    const to = (p, sp, flag) => { for (let k = 0; k < 400; k++) { const dx = p[0] - fx, dy = p[1] - fy, dd = Math.hypot(dx, dy); if (dd < 1e-6) break; const s = Math.min(dd, sp * FRAME); fx += (dx / dd) * s; fy += (dy / dd) * s; q.push([(dx / dd) * s, (dy / dd) * s, flag]); } };
    to(T.from, 1.6, 0);
    for (let i = 0; i < 4; i++) q.push([0, 0, 0]);
    for (const p of T.path) to(p, 4.25, 1);
    let nextF = 0, started = false;
    // 시작 자세로 옮기는 동안은 재지 않음 — 베는 획 첫 프레임에 스택을 n 으로
    const step = () => {
      if (G.t / K < nextF - 1e-9) return;
      nextF += FRAME;
      const f = q.shift();
      if (f) {
        if (f[2] === 1 && !started) started = true;
        P.handOffset.x += f[0];
        P.handOffset.y += f[1];
        P.handHeld = true;
        P.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5;
      } else (P.handHeld = false), (P.inputActive = false);
    };
    nextF = G.t / K;
    while (!started && q.length) (step(), G.step());
    for (let t = 0; t < 0.2 * K; t += DT) G.step(); // 시작 자세에서 멈춤 (옮긴 손이 긋기로 읽혀 묶인 칼이 끝나게) — 그 뒤 스택 n · 베는 획
    SP.stk = n;
    SP.stkT = 0;
    v = peak(G, P, 0.8, step);
  } else if (kind === 'gns') {
    SP.stk = n;
    if (!P.skill.secret({ S: TRADITIONS.japanese.secret, ctx: { ev: 'raise' } })) throw new Error('고노센을 못 냄');
    v = peak(G, P, 0.6);
  } else {
    SP.stk = 0;
    // 제비 베기 되돌림 칼 = 일본 기술 표 tsubameGaeshi 의 올려 긋는 몫(schools.js — 아래 [0.06, −0.15] 에서 오른 황소 자세로) · 손을 그 아래 자리에 두고 냄
    P.handOffset.set(0.06, -0.15);
    for (let t = 0; t < 0.4 * K; t += DT) G.step();
    P.stamina.attack('cut'); // 제비 베기 칼 (빗나간 앞 칼에서 n 스택을 들고 온 것으로 — 묶인 칼의 carryStk)
    SP.lock.carryStk = n;
    if (!requestArtSnap(P, [P.handOffset.x, P.handOffset.y], [PAD.ochsR.slice()], { share: specialShare('tsubameGaeshi'), tech: 'tsubameGaeshi' })) throw new Error('제비 베기를 못 냄');
    v = peak(G, P, 0.6);
  }
  const s = kind === 'cut' ? P.jpSMax : SP.lock ? SP.speedOf(kind === 'tsu' ? 'tsubameGaeshi' : null) : 1;
  G.world.free();
  return { v, s };
}

export function aiRun(kind, n, seed = 1) {
  const G = newRound({ weapon: 'longsword', weapon2: 'uchigatana', seed, gap: kind === 'gns' ? 1.6 : 1.05, walls: false, persona: { proficiency: 5 } }); // 칼끝 거리 안 (다가가지 않고 곧장 벰)
  const E = G.enemy;
  const ai = G.ai;
  const upd = ai.update.bind(ai);
  let live = false;
  ai.update = (dt) => (live ? upd(dt) : E.move.set(0, 0));
  for (let t = 0; t < 1.2 * K; t += DT) G.step();
  const SP = E.schoolPassive;
  live = true;
  let s = 1;
  if (kind === 'gns') {
    SP.stk = n;
    if (!ai.secretGo(ai.secret, { th: null })) throw new Error('AI 고노센을 못 냄');
  } else {
    SP.stk = n;
    const t = ai.school.techByName[kind === 'tsu' ? 'tsubameGaeshi' : 'zornhau'];
    if (!t || !ai.startAttack(t, 'test', { noFeint: true, chain: 1, skipChamber: kind === 'tsu' })) throw new Error(`AI ${kind} 못 냄`);
  }
  const sg = SP.lock ? SP.speedOf() : 1;
  // 베기가 시작되면 과녁을 4 m 밖으로 옮김 (허공 — 칼이 상대 몸 · 칼에 닿아 멎지 않게 · 사람 큰 베기와 같은 허공 잣대)
  let moved = false;
  const away = () => {
    if (moved || (kind !== 'gns' && ai.phase !== 'strike') || (kind === 'gns' && !E.iai)) return;
    moved = true;
    for (const { rb } of G.player.meshes) {
      const t = rb.translation();
      rb.setTranslation({ x: t.x - 4, y: t.y, z: t.z }, true);
    }
  };
  const v = peak(G, E, kind === 'gns' ? 0.6 : 1.2, away);
  s = kind === 'gns' ? sg : E.jpSMax;
  G.world.free();
  return { v, s };
}

if (isMain(import.meta.url)) {
  applySets(arg('set', ''));
  const stacks = arg('stacks', '0,5,10').split(',').map(Number);
  const seeds = arg('seeds', '1,2,3').split(',').map(Number);
  const rows = [];
  const avg = (fn, kind, n) => { const R = seeds.map((sd) => fn(kind, n, sd)); return { v: R.reduce((a, r) => a + r.v, 0) / R.length, s: Math.max(...R.map((r) => r.s)) }; }; // 씨앗 평균 (한 칼 흔들림)
  for (const who of ['사람', 'AI'])
    for (const kind of ['cut', 'gns', 'tsu']) {
      const fn = who === '사람' ? humanRun : aiRun;
      const base = avg(fn, kind, 0).v;
      const cells = stacks.map((n) => {
        const r = n === 0 ? { v: base, s: 1 } : avg(fn, kind, n);
        return `${r.v.toFixed(1)} (${(r.v / base).toFixed(3)} · 목표 ${r.s.toFixed(3)})`;
      });
      rows.push(`| ${who} | ${{ cut: '큰 베기', gns: '고노센', tsu: '제비 베기' }[kind]} | ${cells.join(' | ')} |`);
    }
  console.log(`| 몸 | 칼 | ${stacks.map((n) => `스택 ${n} — m/s (몫 · 목표)`).join(' | ')} |\n|---|---|${stacks.map(() => '---').join('|')}|\n${rows.join('\n')}`);
}
