// 막기 셈 감싸개 (10/12 왕관 꼴 — docs/strike/kron_shape_2026-10-12.md §4). 읽기만: AI 의 respond·afterStrike 결과를 세고 난수·물리에 손대지 않는다(감싼 스크립트 출력은 바이트 같음).
//  센 것 (두 AI 모두 — 롱소드 대 롱소드면 두 쪽 다 독일): 막는 쪽이 그 공격을 칼로 막기로 정한(respond → defend, 피하기 아님) 수를 막기 줄마다,
//   그 공격이 끝날 때(afterStrike) 결과로 — 맞음(landed) · 막힘(parried — 칼끼리 맞물리고 안 맞음) · 헛침(missed). 그리고 모든 공격의 결과.
//   node tools/sim/kron_parry_count.mjs motion_lab.mjs duel longsword 24 main
//   node tools/sim/with_config.mjs SKILL.deKronShape=pad kron_parry_count.mjs motion_lab.mjs duel longsword 24 main
import { AI } from '../../src/ai.js';
import { simPath } from './is_main.mjs';

const C = { strikes: 0, all: { landed: 0, parried: 0, missed: 0 }, byLine: {}, decided: {} };
const upd = AI.prototype.update;
AI.prototype.update = function (dt) {
  this.me.__kronAi = this;
  return upd.call(this, dt);
};
const resp = AI.prototype.respond;
AI.prototype.respond = function (th, d) {
  const r = resp.call(this, th, d);
  if (r && this.mode === 'defend' && !this.defVoid) {
    C.decided[this.defLine] = (C.decided[this.defLine] ?? 0) + 1;
    const A = this.foe?.__kronAi; // 치는 쪽 AI — 그 공격이 끝날 때 이 줄로 센다
    if (A && A.mode === 'attack') A.__kronDef = this.defLine;
  }
  return r;
};
const aft = AI.prototype.afterStrike;
AI.prototype.afterStrike = function (...a) {
  if (!this.strikeTallied) {
    const ev = this.hitLanded ? 'landed' : this.bound ? 'parried' : 'missed';
    C.strikes++;
    C.all[ev]++;
    if (this.__kronDef) {
      const o = (C.byLine[this.__kronDef] ??= { landed: 0, parried: 0, missed: 0 });
      o[ev]++;
    }
  }
  this.__kronDef = null;
  return aft.apply(this, a);
};
process.on('exit', () => {
  const f = (o) => `맞음 ${o.landed} · 막힘 ${o.parried} · 헛침 ${o.missed}` + (o.landed + o.parried ? ` · 막아 낸 몫 ${Math.round((100 * o.parried) / (o.landed + o.parried))} % (막힘/(맞음+막힘), n ${o.landed + o.parried})` : '');
  console.log(`  [막기 셈] 공격 ${C.strikes} 수 — 모두: ${f(C.all)}`);
  for (const [k, o] of Object.entries(C.byLine).sort()) console.log(`  [막기 셈] 칼로 막기로 정한 수 ${k}: ${f(o)}`);
  console.log(`  [막기 셈] 칼로 막기로 정한 줄: ${Object.entries(C.decided).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`);
});
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
