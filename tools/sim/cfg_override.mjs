// ─────────────────────────────────────────────────────────────
//  cfg_override.mjs — 재기 도구 전용 config 수 덮어쓰기 (11/17 · 게임에는 스위치 없음 — 판 값은 그대로, 이 도구 판에서만 바꿈)
//  --cfg=PATH:값,PATH:값,…  · PATH = config 내보낸 이름부터 점으로 (깊이 무관 · 배열은 번호) · 값은 수
//   예) --cfg=OKORI.T.2:0.3,MEASURE.gap.other:0.1,AI_LEVELS.normal.strikeSpeed:12,STRIKE.stepMass:0
//  없는 칸 · 수가 아닌 값 · 수가 아닌 칸은 멈춤 (오타가 조용히 지나가지 않게)
// ─────────────────────────────────────────────────────────────
import * as CFG from '../../src/config.js';

/** 문자열 'A.b.c:1.5,…' 를 config 에 덮어씀 → 바꾼 [경로, 옛 값, 새 값] 목록 */
export function applyCfg(spec) {
  const done = [];
  for (const kv of (spec ?? '').split(',').filter(Boolean)) {
    const i = kv.lastIndexOf(':');
    const path = kv.slice(0, i);
    const v = +kv.slice(i + 1);
    if (!(i > 0) || !Number.isFinite(v)) throw new Error(`--cfg 값은 수만: ${kv}`);
    const keys = path.split('.');
    let o = CFG;
    for (const k of keys.slice(0, -1)) {
      o = o?.[k];
      if (o == null || typeof o !== 'object') throw new Error(`unknown cfg: ${path}`);
    }
    const last = keys[keys.length - 1];
    if (!(last in o) || typeof o[last] !== 'number') throw new Error(`unknown cfg (수 칸 아님): ${path}`);
    done.push([path, o[last], v]);
    o[last] = v;
  }
  return done;
}

/** argv 의 --cfg= 를 덮어씀 (도구 머리에서 한 번) */
export function applyCfgArgs(argv = process.argv) {
  const a = argv.find((x) => x.startsWith('--cfg='));
  const done = applyCfg(a ? a.slice(6) : '');
  if (done.length) console.error(`cfg: ${done.map(([p, o, n]) => `${p} ${o} → ${n}`).join(' · ')}`);
  return done;
}
