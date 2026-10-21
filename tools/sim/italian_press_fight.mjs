// 막아찌르기 입력형 측정 (10/21 — docs/strike/italian_opposition_2026-10-20.md 10/21 절): 플레이어 레이피어(막기 책) · 막기 단추를 쥔 채 · 상대 새 공격을 읽고 GAP m 안이면 HUM_RT s 뒤 한 번 눌렀다 다시 누름
//  꼴: off(막아찌르기 끔 = 그냥 막기) · p50(판 값) · p65(샛별안) · p0(감소 없음). VARIANTS=off,p50 SEEDS=1-2 DUR=20 FOES=id,… OUT=<json> node tools/sim/italian_press_fight.mjs
import { newRound, DT } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { SKILL } from '../../src/config.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { STAGE_ORDER, STAGE_FOE, STAGE_FOE_EXTRA } from '../../src/stages.js';
import { getWeapon } from '../../src/weapons.js';
const VARIANTS = (process.env.VARIANTS ?? 'off,p50,p65,p0').split(',');
const [s0, s1] = (process.env.SEEDS ?? '1-3').split('-').map(Number);
const DUR = +(process.env.DUR ?? 20), HUM_RT = +(process.env.HUM_RT ?? 0.2), GAP = +(process.env.GAP ?? 2.0);
const journey = [...new Set(STAGE_ORDER.flatMap((st) => [STAGE_FOE[st], ...(STAGE_FOE_EXTRA[st] ?? [])]))].filter((id) => id && (!id.endsWith('_mad') || id === 'heinrich_mad'));
const FOES = (process.env.FOES ? process.env.FOES.split(',') : journey).filter((id) => CHARACTERS_BY_ID[id] && !getWeapon(CHARACTERS_BY_ID[id].weapon)?.gun);
const keep0 = { on: SKILL.itOpposition, cut: SKILL.itOppositionVals.shieldCut };
function fight(id, seed, v) {
  SKILL.itOpposition = v === 'off' ? 0 : 1;
  SKILL.itOppositionVals.shieldCut = v === 'p65' ? 0.65 : v === 'p0' ? 0 : 0.5;
  SKILL.parryAssist = 0;
  const F = CHARACTERS_BY_ID[id];
  const G = newRound({ seed, difficulty: F.ai.level, persona: F.ai.persona, weapon2: F.weapon, weapon: 'rapier', revive: F.revive });
  const D = G.player, A = G.enemy;
  D.skill.corr = SKILL.corr; D.skill.corrTip = SKILL.corrTip; D.skill.autoGuard = true;
  const guard = new PlayerParryGuard(D, A); D.stamina.controller = guard;
  guard.held = true; guard.opposition.lastHeld = true; // 판 시작에 누른 것으로 치지 않음
  let got = 0, gave = 0; const presses = []; const clashes = [];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, res, point, pr) => {
    pw?.(att, vic, res, point, pr);
    if (res.type === 'blunt' || !(res.severity > 0)) return;
    if (vic === D) { got += res.severity; for (const p of presses) if (G.t - p.t <= 1) p.got += res.severity; }
    else if (vic === A && att === D) { gave += res.severity; for (const p of presses) if (G.t - p.t <= 1) p.gave += res.severity; }
  };
  const pc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (point, sp, touch) => {
    pc?.(point, sp, touch);
    if (touch && (touch.fresh || touch.vn > 3)) clashes.push({ run: !!guard.opposition.run, vn: +touch.vn.toFixed(2), vt: +(touch.vt ?? 0).toFixed(2), nag: !!touch.nagashi });
  };
  let lastThreats = 0, tap = null;
  G.before = () => {
    if (v !== 'off') {
      if (guard.stats.threats > lastThreats) { lastThreats = guard.stats.threats; if (!tap && D.foeDistance() <= GAP) tap = { at: G.t + HUM_RT, phase: 0 }; }
      if (tap && G.t >= tap.at) {
        if (tap.phase === 0) { guard.held = false; tap.phase = 1; }
        else { guard.held = true; tap = null; presses.push({ t: G.t, got: 0, gave: 0 }); }
      }
    }
    guard.step(DT); D.inputActive = guard.active;
  };
  for (let i = 0; i < Math.round(DUR / DT); i++) { G.step(); if (!D.alive || !A.alive) break; }
  const r = { id, seed, v, t: +G.t.toFixed(2), got: +got.toFixed(3), gave: +gave.toFixed(3), dDead: !D.alive, aDead: !A.alive, presses: presses.length, starts: guard.opposition.starts,
    p1got: +presses.reduce((s, p) => s + p.got, 0).toFixed(3), p1gave: +presses.reduce((s, p) => s + p.gave, 0).toFixed(3), clashes, stam: +D.stamina.value.toFixed(1) };
  G.world.free();
  return r;
}
const out = [];
for (const id of FOES) for (let s = s0; s <= s1; s++) for (const v of VARIANTS) { out.push(fight(id, s, v)); }
SKILL.itOpposition = keep0.on; SKILL.itOppositionVals.shieldCut = keep0.cut;
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));
for (const v of VARIANTS) {
  const R = out.filter((r) => r.v === v), n = R.length, sum = (k) => R.reduce((s, r) => s + r[k], 0);
  console.log(v, 'n', n, 'got', (sum('got') / n).toFixed(2), 'gave', (sum('gave') / n).toFixed(2), 'dDead', R.filter((r) => r.dDead).length, 'aDead', R.filter((r) => r.aDead).length,
    'presses', (sum('presses') / n).toFixed(1), '1s got', (sum('p1got') / n).toFixed(2), '1s gave', (sum('p1gave') / n).toFixed(2), 'stam', (sum('stam') / n).toFixed(0));
}
