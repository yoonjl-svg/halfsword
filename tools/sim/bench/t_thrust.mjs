// t_thrust.mjs — 찌르기 표: 팔 뻗기(같은 근육 한도) + 골반 옮김 입력(0 · 1.7 · 2.0 m/s). 허공 빠르기 · 칼 축 유효 질량 · 0.1 m 뚫는 동안의 칼 축 힘.
//   node t_thrust.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, fmt, DT, WEAPONS } from './lib.mjs';
import { runThrust } from './thrust.mjs';
const R = await loadRapier();
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', uchigatana: '우치가타나', rapier: '레이피어' };
const L = []; const P = (x) => L.push(x);
const cases = [['longsword', true], ['longsword', false], ['zweihander', true], ['uchigatana', true], ['rapier', false]];
P('# 표 T1 — 허공 찌르기: 칼 축 쪽 칼끝 빠르기 최고 (팔 뻗기 시작 때는 0 ~ 0.25 s 에서 가장 빠른 것) · 골반은 0.25 s 에 입력 빠르기까지 올림');
P('무기 | 손 | 골반 입력 m/s | 팔 시작 ms | 칼끝 축 빠르기 최고 m/s | 그때 (시작 뒤 ms) | 손이 골반에 견준 빠르기 최고 m/s | 칼끝이 나간 거리 m | 최고 순간 팔꿈치 굽힘 ° | 받침 앞뒤 힘 크기 최고 N');
P('---|---|---|---|---|---|---|---|---|---');
const best = {};
for (const [weapon, th] of cases) for (const vL of [0, 1.7, 2.0]) {
  let b = null;
  for (const tArm of [0, 0.05, 0.1, 0.15, 0.2, 0.25]) { const r = runThrust(R, { weapon, twoHand: th, vL, tArm }).sum; if (!b || r.vAx > b.vAx) b = { ...r, tArm }; }
  best[`${weapon}|${th}|${vL}`] = b;
  P(`${KO[weapon]} | ${th ? '두 손' : '한 손'} | ${vL} | ${fmt(b.tArm * 1000, 0)} | ${fmt(b.vAx, 2)} | ${fmt(b.tPk * 1000, 0)} | ${fmt(b.handRel, 2)} | ${fmt(b.reach, 2)} | ${fmt(b.elAtPk, 0)} | ${fmt(b.fxMax, 0)}`);
}
P(''); P('# 표 T2 — 칼 축 유효 질량 (칼끝에 칼 축 반대로 5 N·s 를 한 스텝에 · 안 건 판과의 칼끝 축 빠르기 차로 J ÷ Δv) · 재는 때 = 칼끝 축 빠르기 최고 2 스텝 앞 (근육은 같은 법칙으로 계속 민다)');
P('무기 | 손 | 골반 입력 | 8 ms 뒤 kg | 17 ms | 33 ms | 칼만(자유 강체 · 칼 축) kg | 게임 판정식 (칼 + thrustAssist 3.5) kg');
P('---|---|---|---|---|---|---|---');
for (const [weapon, th] of cases) for (const vL of [0, 1.7]) {
  const b = best[`${weapon}|${th}|${vL}`]; const tI = b.tPk - 2 * DT; const J = 5;
  const base = runThrust(R, { weapon, twoHand: th, vL, tArm: b.tArm }).rows; const hit = runThrust(R, { weapon, twoHand: th, vL, tArm: b.tArm, impulse: { t: tI, J } }).rows;
  const i0 = base.findIndex((r) => Math.abs(r.t - tI) < DT / 2);
  const me = (k) => { const dv = base[i0 + k].vAx - hit[i0 + k].vAx; return dv > 1e-6 ? J / dv : NaN; };
  const m = WEAPONS[weapon].parts.reduce((a, p_) => a + p_.m, 0);
  P(`${KO[weapon]} | ${th ? '두 손' : '한 손'} | ${vL} | ${fmt(me(1), 1)} | ${fmt(me(2), 1)} | ${fmt(me(4), 1)} | ${fmt(m, 2)} | ${fmt(m + 3.5, 2)}`);
}
P(''); P('# 표 T3 — 0.1 m 를 뚫는 동안 버틸 수 있는 가장 큰 칼 축 저항 힘 (닿는 면 = 칼끝 축 빠르기 최고인 자리 · 그 뒤 칼 축 쪽 0.1 m 동안 일정한 힘 · 칼끝이 0.3 m/s 아래로 멈추지 않고 0.1 m 를 다 가는 가장 큰 힘을 이분법으로) → 에너지 = 힘 × 0.1 m');
P('무기 | 손 | 골반 입력 | 닿는 빠르기 m/s | 가장 큰 힘 N | 에너지 J | 뚫는 데 걸린 ms | 나갈 때 빠르기 m/s | 그동안 받침이 몸을 앞으로 민 힘(다리 몫) 평균 / 최고 N | 같은 에너지를 ½·m·v² 로 본 유효 질량 kg');
P('---|---|---|---|---|---|---|---|---|---');
for (const [weapon, th] of cases) for (const vL of [0, 1.7, 2.0]) {
  const b = best[`${weapon}|${th}|${vL}`];
  const tryF = (F) => runThrust(R, { weapon, twoHand: th, vL, tArm: b.tArm, resist: { x0: b.tipXpk, F, depth: 0.1 }, tEnd: b.tPk + 0.35 }).sum;
  let lo = 20, hi = 8000; if (!tryF(lo).through) { P(`${KO[weapon]} | ${th ? '두 손' : '한 손'} | ${vL} | – | < 20 | – | – | – | – | –`); continue; }
  for (let k = 0; k < 14; k++) { const mid = 0.5 * (lo + hi); if (tryF(mid).through) lo = mid; else hi = mid; }
  const s = tryF(lo);
  P(`${KO[weapon]} | ${th ? '두 손' : '한 손'} | ${vL} | ${fmt(s.vIn, 2)} | ${fmt(lo, 0)} | ${fmt(lo * 0.1, 0)} | ${fmt((s.tOut - s.tHit) * 1000, 0)} | ${fmt(s.vOut, 2)} | ${fmt(s.fxResistMean, 0)} / ${fmt(s.fxResist, 0)} | ${fmt((2 * lo * 0.1) / (s.vIn * s.vIn), 1)}`);
}
P(''); P('# 표 T4 — 정해 준 칼 축 저항 힘 200 · 500 · 1000 · 1900 N 에 맞서 0.1 m 를 뚫나 (닿는 면 = 칼끝 축 빠르기 최고인 자리). 칸 = 뚫음: 걸린 ms · 나갈 때 m/s / 못 뚫음: 멈춘 깊이 cm (멈출 때까지 ms) · 괄호 = 과녁이 받은 일 J (힘 × 들어간 깊이)');
P('#  견줌: 사람 칼 찌르기 자료 — 에너지 64 ~ 115 J · 축 힘 95 % 값 1885 N (Horsfall 1999 · Chadwick 1999 — 짧은 칼 · 초록만 읽음)');
P('무기 | 손 | 골반 입력 m/s | 닿는 빠르기 m/s | 200 N | 500 N | 1000 N | 1900 N | 칼 운동 에너지만 ½·m_칼·v² J | 판정식 ½·(m_칼 + 3.5)·v²·2.0 J');
P('---|---|---|---|---|---|---|---|---|---');
for (const [weapon, th] of cases) for (const vL of [0, 1.7, 2.0]) {
  const b = best[`${weapon}|${th}|${vL}`]; const cells = []; let vIn = b.vAx;
  for (const F of [200, 500, 1000, 1900]) {
    const s = runThrust(R, { weapon, twoHand: th, vL, tArm: b.tArm, resist: { x0: b.tipXpk, F, depth: 0.1 }, tEnd: b.tPk + 0.35 }).sum; vIn = s.vIn ?? vIn;
    cells.push(s.through ? `뚫음 ${fmt((s.tOut - s.tHit) * 1000, 0)} ms · ${fmt(s.vOut, 1)} m/s (${fmt(F * 0.1, 0)} J)` : `못 뚫음 ${fmt((s.depthMax ?? 0) * 100, 1)} cm${s.tStall != null ? ` (${fmt((s.tStall - s.tHit) * 1000, 0)} ms)` : ''} (${fmt(F * (s.depthMax ?? 0), 0)} J)`);
  }
  const m = WEAPONS[weapon].parts.reduce((a, p_) => a + p_.m, 0);
  P(`${KO[weapon]} | ${th ? '두 손' : '한 손'} | ${vL} | ${fmt(vIn, 2)} | ${cells.join(' | ')} | ${fmt(0.5 * m * vIn * vIn, 0)} | ${fmt(0.5 * (m + 3.5) * vIn * vIn * 2, 0)}`);
}
writeFileSync(join(HERE, 'out/thrust.txt'), L.join('\n') + '\n'); console.log(L.join('\n'));
