// 11/14 일본 기다리는 중전차를 전 판으로 묶기 (docs/strike/jp_tank_2026-11-14.md §5): 옛 장면(씨앗 판 — 사람 손가락 봇 일본)을 본 시험이 그 장면을 잰 때의 판으로 돌게.
//  JP_TANK.stack 0(기다림과 침 = 시간 곧은 오름) · lowShove 0 · rock 0(바위 몸 없음) — 11/14 전 main 과 바이트 같음. fn 이 약속을 돌려주면 끝난 뒤 되돌림
import { JP_TANK } from '../../src/config.js';

export const JP_OLD = { stack: 0, lowShove: 0, rock: 0 };

export function withJpOld(fn) {
  const keep = { ...JP_TANK };
  Object.assign(JP_TANK, JP_OLD);
  const back = () => Object.assign(JP_TANK, keep);
  let r;
  try {
    r = fn();
  } catch (e) {
    back();
    throw e;
  }
  if (r && typeof r.then === 'function') return r.finally(back);
  back();
  return r;
}
