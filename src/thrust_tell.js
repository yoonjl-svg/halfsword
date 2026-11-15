// ─────────────────────────────────────────────────────────────
//  찌르기 낌새 눈 (11/15 시제품 — 사장님 '찌르기의 맛은 살려야 해. 혹은 찌르기를 더 잘 방어할 방법? 지금 찌르기 막기 거의 불가능하지 않아?' ·
//   기록 docs/strike/it_tone_2026-11-15.md · config AI_TELL · 기본 끔 — 사장님 확인 전).
//  곧은 줄 눈(ai.js threat · secret.js threatNow)은 칼끝이 3.5 m/s 를 넘어야 '오는 칼'로 본다. 찌르기는 칼끝이 움직인 뒤 0.12 s 만에 닿아
//   (반응 0.10 s) 거의 다 못 본다. 펜서는 칼끝 빠르기가 아니라 '팔이 뻗기 시작함 · 앞발이 나감'을 읽는다 — 그 모습은 칼이 제 칼날 줄을 따라
//   내 몸 쪽으로 나오기 시작하는 것(팔 뻗기 · 런지 몸 실림 모두 칼끝을 칼날 줄로 민다)으로 보인다.
//  낌새 = 늦게 본 모습(반응 시간 — 공정)에서 ① 칼끝의 칼날 줄 몫 빠르기(앞 · 뒤 모두 — 뒤는 찌르기 전 당김) ≥ AI_TELL.v(칼을 드는 낌새 preThreat 와 같은 1.6 m/s) ·
//   ② 칼날 줄(칼끝에서 앞으로 AI_TELL.ray m — 걸음 사다리 0.9)이 내 몸통 원통(곧은 줄 눈과 같은 0.55 m · 높이 −1.3 ~ 0.75)을 지남.
//   → 곧은 줄 눈과 같은 꼴의 맞을 자리 { tc, hx, hy, hz, vx, vy, vz, sp, tell } (찌르기 줄). 셈만 한다(새 객체 하나 · 굴림 없음).
// ─────────────────────────────────────────────────────────────
import { AI_TELL } from './config.js';

/**
 * s = 늦게 본 상대 모습(ai_sense.js 기록 — 칼끝 tx · 타격점 mx · 칼끝 빠르기 tvx) · c = 내 가슴(세상) → 찌르기 낌새면 맞을 자리 · 아니면 null
 */
export function thrustTell(s, c) {
  if (!s.armed) return null;
  const bx = s.tx - s.mx;
  const by = s.ty - s.my;
  const bz = s.tz - s.mz;
  const bl = Math.hypot(bx, by, bz);
  if (bl < 1e-3) return null;
  const ux = bx / bl;
  const uy = by / bl;
  const uz = bz / bl;
  const va = s.tvx * ux + s.tvy * uy + s.tvz * uz; // 칼끝 빠르기의 칼날 줄 몫 (앞으로 + · 당김 −)
  const sp = Math.abs(va);
  if (!(sp >= AI_TELL.v)) return null;
  // 칼날 줄(칼끝에서 앞으로)이 내 가슴 세로축에 가장 가까운 자리 (수평) — ray 안
  const rx = s.tx - c.x;
  const rz = s.tz - c.z;
  const uh2 = ux * ux + uz * uz;
  const k = Math.max(0, Math.min(AI_TELL.ray, uh2 > 1e-6 ? -(rx * ux + rz * uz) / uh2 : 0));
  const hx = rx + ux * k;
  const hz = rz + uz * k;
  const hy = s.ty - c.y + uy * k;
  if (Math.hypot(hx, hz) > 0.55 || hy < -1.3 || hy > 0.75) return null;
  return { tc: k / sp, hx, hy, hz, vx: ux * sp, vy: uy * sp, vz: uz * sp, sp, tell: true };
}
