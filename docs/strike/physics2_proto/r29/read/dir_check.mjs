// 독립 방향 확인 (싸움 없음): legs_vmc.js 의 clampLeg 글을 그대로 떼어 legLimit 와 함께 돌림.
// 기준: pair(parent, child, τ) 는 부모 +τ · 자식 −τ → 구동 일률 P = τ·ωp − τ·ωc = −τ·w (w = 자식 − 부모).
// 늘어나며 버팀 = P < 0 (일을 받음) = τ·w > 0. 잘린 쪽 한도가 base 보다 커지는 것은 그때뿐이어야 한다.
import { readFileSync } from 'node:fs';
const W = process.argv[2];
const src = readFileSync(W + '/src/legs_vmc.js', 'utf8');
const m = src.match(/const clampLeg = \(t, w, lo, hi, str\) => ([^;]+);/); if (!m) throw new Error('clampLeg 글 없음');
const { LEGS } = await import(W + '/src/config.js');
const { legLimit } = await import(W + '/src/legs_vmc.js');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clampLeg = new Function('clamp', 'legLimit', 'return (t, w, lo, hi, str) => ' + m[1])(clamp, legLimit);
// 일곱 자르기의 (lo, hi) 칸 — 글에서 읽음
const calls = [...src.matchAll(/clampLeg\(([^,]+), ([^,]+), lim\.(\w+), lim\.(\w+), str\)/g)].map((x) => [x[1], x[2], x[3], x[4]]);
console.log('clampLeg 부름', calls.length, calls.map((c) => c.join('|')).join('  '));
let bad = 0, n = 0, raised = 0;
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (const ecc of [1.0, 1.3, 1.4]) {
  LEGS.ecc = ecc;
  for (const [, , lo, hi] of calls) {
    const bl = LEGS.limit[lo], bh = LEGS.limit[hi];
    for (let i = 0; i < 20000; i++) {
      const str = 0.3 + 0.7 * rnd(), w = (rnd() - 0.5) * 6, t = (rnd() - 0.5) * 4 * Math.max(bl, bh);
      const c = clampLeg(t, w, lo === hi ? bl : bl, bh, str); n++;
      const base = t > 0 ? bh * str : bl * str;
      const cut = Math.abs(t) > base;
      const P = -t * w; // 구동 일률 (부모 쪽 τ 성분 · 같은 축)
      const lim = Math.abs(c);
      if (!cut) { if (c !== t) bad++; continue; }
      const up = lim > base * (1 + 1e-12);
      if (up) raised++;
      if (up !== (P < 0 && ecc > 1)) bad++;
      const want = base * (1 + (ecc - 1) * Math.min(1, Math.max(0, Math.abs(w) / LEGS.eccW)) * (P < 0 ? 1 : 0));
      if (Math.abs(Math.min(Math.abs(t), want) - lim) > 1e-9 * want) bad++;
      if (Math.sign(c) !== Math.sign(t)) bad++;
    }
  }
}
console.log(`표본 ${n} · 올라간 한도 ${raised} · 어긋남 ${bad}`);
// 0 둘레 뛰기와 스텝마다 바뀜: 한도의 w 기울기 = base·str·(ecc−1)/eccW
LEGS.ecc = 1.3;
for (const k of ['hipFlex', 'hipAbd', 'hipRot', 'kneeExt', 'kneeFlex', 'anklePlantar', 'ankleDorsi', 'ankleInv', 'ankleRot']) {
  const b = LEGS.limit[k];
  const j0 = legLimit(b, 1, 1e-9) - legLimit(b, 1, -1e-9);
  console.log(`${k.padEnd(13)} base ${b} · 0 둘레 뛰기 ${j0.toExponential(1)} · w 0.1 rad/s 흔들림당 ${(legLimit(b, 1, 0.1) - legLimit(b, 1, 0)).toFixed(2)} N·m (${(((legLimit(b, 1, 0.1) / b) - 1) * 100).toFixed(1)} %) · 0→1 rad/s 다 ${(legLimit(b, 1, 1) - b).toFixed(1)} N·m · ×1.25 칸 ${(legLimit(b * 1.25, 1, 1) - b * 1.25).toFixed(1)}`);
}
