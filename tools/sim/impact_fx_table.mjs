// ─────────────────────────────────────────────────────────────
//  impact_fx_table.mjs — 타격감 표 (10/25 — config IMPACT_FX · src/impact_fx.js · docs/strike/impact_feel_2026-10-25.md)
//   맞음 에너지 → 무게 H · 세기 x · 멈칫(ms) · 카메라 밀림(내가 맞음 / 내가 침) · 무게 소리 음량. 게임과 같은 셈(src/impact_fx.js)을 읽는다 — 읽기만.
//
//   node tools/sim/impact_fx_table.mjs                 예시 에너지 표 (레이피어 · 롱소드 · 츠바이핸더 · 플랑베르주 · 칼끼리 부딪힘)
//   node tools/sim/impact_fx_table.mjs ai [판 수=12] [무기,…]      AI 대 롱소드(주인공 대리 — ref_duel 과 같은 판 · 40 s)에서 그 무기가 낸 맞음 · 부딪힘의 에너지 분위 → 효과
//   node tools/sim/impact_fx_table.mjs player [판 수=6] [무기,…]   사람 손가락 봇(player_edge.mjs 대본 · 상대 stand · ai · 24 s)이 낸 맞음의 에너지 분위 → 효과
//   --mass=0 처럼 IMPACT_FX 값을 이 도구 안에서만 바꿔 견줌 (--mass = massExp)
// ─────────────────────────────────────────────────────────────
import { IMPACT_FX, STRIKE, BODY } from '../../src/config.js';
import { woundImpact, clashImpact } from '../../src/impact_fx.js';
import { isMain } from './is_main.mjs';

// 무기 무게 (fighter.swordProps.m — 판을 만들어 읽은 값, kg)
export const MASS = { rapier: 1.1, longsword: 1.6, zweihander: 2.865, flamberge: 3.0, tizona: 2.3, durandal: 2.2, morgenstern: 1.971, pappenheimer: 1.34, sabre: 0.95 };
const NAME = { rapier: '레이피어', longsword: '롱소드', zweihander: '츠바이핸더', flamberge: '플랑베르주', tizona: '티소나', durandal: '뒤랑달', morgenstern: '모르겐슈테른', pappenheimer: '파펜하이머', sabre: '세이버' };

const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const ms = (s) => `${Math.round(s * 1000)}`.padStart(3);
const f2 = (v) => v.toFixed(2);

/** 한 줄: 에너지 E 를 무게 M 의 칼이 냈을 때 */
export function row(E, M, C = IMPACT_FX) {
  const t = woundImpact({ energy: E, mass: M, taken: true }, C);
  const d = woundImpact({ energy: E, mass: M, taken: false }, C);
  return { E, H: t.H, x: t.x, stop: t.stop, camTaken: t.cam, camDealt: d.cam, sound: t.sound };
}
const line = (lab, r) => `${lab.padEnd(26)} ${String(Math.round(r.E)).padStart(4)} J → H ${String(Math.round(r.H)).padStart(4)} · x ${f2(r.x)} · 멈칫 ${ms(r.stop)} ms · 카메라 맞음 ${f2(r.camTaken)} / 침 ${f2(r.camDealt)} · 소리 ${f2(r.sound)}`;

function exampleTable(C) {
  const out = [`타격감 표 (IMPACT_FX massExp ${C.massExp} · h0 ${C.h0} · h1 ${C.h1} J · 멈칫 최대 ${C.stop * 1000} ms)`];
  for (const w of ['rapier', 'longsword', 'zweihander', 'flamberge']) {
    for (const E of [20, 40, 60, 100, 150]) out.push(line(`${NAME[w]} (${MASS[w]} kg)`, row(E, MASS[w], C)));
  }
  out.push('칼끼리 부딪힘 (vn = 맞닿는 방향 빠르기 m/s · 멈칫은 vn 6 넘을 때만)');
  for (const [a, b] of [['rapier', 'longsword'], ['longsword', 'longsword'], ['zweihander', 'longsword'], ['zweihander', 'flamberge']]) {
    for (const vn of [4, 8, 12, 16]) {
      const c = clashImpact({ vn, m1: MASS[a], m2: MASS[b], energyScale: STRIKE.energyScale }, C);
      out.push(`${`${NAME[a]} × ${NAME[b]}`.padEnd(22)} vn ${String(vn).padStart(2)} → H ${String(Math.round(c.H)).padStart(4)} · x ${f2(c.x)} · 멈칫 ${ms(vn > 6 ? c.stop : 0)} ms · 카메라 ${f2(c.cam)} · 소리 ${f2(c.sound)}`);
    }
  }
  return out.join('\n');
}

/** AI 대 롱소드 판에서 무기 X 쪽 맞음 · 부딪힘 에너지 모으기 */
async function measureAI(ids, N) {
  const { newRound, DT } = await import('./harness_m.mjs');
  const { AI } = await import('../../src/ai.js');
  BODY.weightMode = 'hybrid';
  const res = {};
  for (const id of ids) {
    const E = { cut: [], stab: [], blunt: [] };
    const V = [];
    let M = MASS[id];
    for (let s = 1; s <= N; s++) for (const xFirst of [true, false]) {
      const x = { weapon: id, persona: { school: id } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y;
      const Q = xFirst ? y : x;
      const G = newRound({ walls: true, seed: (xFirst ? 1000 : 2000) + s, weapon: P.weapon, weapon2: Q.weapon, difficulty: 'normal', persona: Q.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy;
      M = X.swordProps.m;
      const oc = G.combat.hooks.onClash;
      G.combat.hooks.onClash = (pt, sp, t) => { oc?.(pt, sp, t); if (t && !t.nagashi && (t.fresh || t.vn > 3)) V.push(t.vn); };
      G.onWound = (att, vic, r) => { if (att === X) E[r.type]?.push(r.energy); };
      for (let i = 0; i < 40 / DT; i++) {
        G.step();
        if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
      }
    }
    res[id] = { E, V, M };
  }
  return res;
}

/** 사람 손가락 봇 (player_edge.mjs 대본) — 플레이어 칼이 낸 새 맞음 에너지 */
async function measurePlayer(ids, rounds) {
  const { Combat } = await import('../../src/combat.js');
  const rec = {};
  const orig = Combat.prototype.strike;
  Combat.prototype.strike = function (pr, point, passing) {
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    const key = `${att.index}:${pr.v.part}`;
    const fresh = !vic.hitCooldowns.has(key);
    const r = orig.call(this, pr, point, passing);
    if (fresh && r && vic.hitCooldowns.has(key) && att.index === 0) {
      const o = (rec[att.weapon?.id] ||= { E: { cut: [], stab: [], blunt: [] }, M: att.swordProps.m });
      o.E[r.type]?.push(r.energy);
    }
    return r;
  };
  const argv = process.argv;
  process.argv = [argv[0], argv[1], ids.join(','), '--foes=stand,ai', `--rounds=${rounds}`, '--secs=24', '--quiet'];
  const log = console.log;
  const write = process.stdout.write.bind(process.stdout);
  console.log = () => {};
  process.stdout.write = () => true;
  try {
    await import('./player_edge.mjs');
  } finally {
    console.log = log;
    process.stdout.write = write;
    process.argv = argv;
  }
  return rec;
}

function measuredTable(res, label, C) {
  const out = [`${label} (IMPACT_FX massExp ${C.massExp})`];
  for (const [id, o] of Object.entries(res)) {
    const M = o.M ?? MASS[id];
    out.push(`${NAME[id] ?? id} (${M.toFixed(2)} kg) — 베기 ${o.E.cut.length} · 찌르기 ${o.E.stab.length} · 둔 ${o.E.blunt.length}`);
    for (const [k, ko] of [['cut', '베기'], ['stab', '찌르기'], ['blunt', '둔']]) {
      const a = o.E[k];
      if (a.length < 3) continue;
      for (const [p, pl] of [[0.5, '가운데'], [0.9, '위 10 %']]) out.push(line(`  ${ko} ${pl}`, row(q(a, p), M, C)));
    }
    if (o.V?.length) {
      for (const [p, pl] of [[0.5, '가운데'], [0.9, '위 10 %']]) {
        const vn = q(o.V, p);
        const c = clashImpact({ vn, m1: M, m2: MASS.longsword, energyScale: STRIKE.energyScale }, C);
        out.push(`  ${`부딪힘 ${pl}`.padEnd(24)} vn ${vn.toFixed(1)} → H ${Math.round(c.H)} · x ${f2(c.x)} · 멈칫 ${ms(vn > 6 ? c.stop : 0)} ms · 카메라 ${f2(c.cam)} · 소리 ${f2(c.sound)}`);
      }
    }
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const C = { ...IMPACT_FX };
  const mass = args.find((a) => a.startsWith('--mass='));
  if (mass) C.massExp = +mass.split('=')[1];
  const mode = pos[0];
  const ids = (pos[2] ?? 'rapier,longsword,zweihander,flamberge').split(',');
  if (mode === 'ai') console.log(measuredTable(await measureAI(ids, +(pos[1] ?? 12)), `AI 대 롱소드 · 자리마다 ${pos[1] ?? 12} 판 × 2 · 40 s`, C));
  else if (mode === 'player') console.log(measuredTable(await measurePlayer(ids, +(pos[1] ?? 6)), `사람 손가락 봇(player_edge) · stand · ai · ${pos[1] ?? 6} 판 · 24 s`, C));
  else console.log(exampleTable(C));
}
