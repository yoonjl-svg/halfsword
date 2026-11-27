// r30 엿보기 (node --import <이 파일> …): honesty.mjs 의 다리 관절 엿보기(__honestyLegDbg · 읽기만)를 받아 셈을 모은다. 게임 · 도구 값은 바꾸지 않는다.
//  R30_TAP_OUT=<json> 에 끝날 때 쓴다. 모으는 것:
//   (V3) 관절마다(싸움꾼 이름 · 관절 이름) 요구(tot) · 잰 값(meas) 의 값 목록 · 250 넘음 · 312.5 넘음 · 늘어나는 몫 곱한 한도 넘음
//   (V2) 같은 스텝의 게임 다리 구동 부호와 잣대 부호 견줌: 무릎 = raw.k × wK > 0 (부모 쪽 토크 · 자식 − 부모 빠르기) ↔ 잣대 wEcc > 0.
//        엉덩이 · 발목 = 그 스텝 raw 의 가장 큰 축 하나로 같은 견줌. 그 관절 토크를 이 스텝에 실제로 걸었을 때만(stat.n 이 늘었을 때).
import { writeFileSync } from 'node:fs';
const OUT = process.env.R30_TAP_OUT;
const TMIN = +(process.env.R30_TMIN ?? 30), WMIN = +(process.env.R30_WMIN ?? 0.3); // 또렷한 표본: |토크| N·m · |빠르기| rad/s
const J = {}, A = {}, last = new Map();
const key = (f, name) => `${f?.name ?? '?'}:${name}`;
const cnt = (o, k) => (o[k] = (o[k] || 0) + 1);
globalThis.__honestyLegDbg = (d) => {
  const k = key(d.f, d.name), s = (J[k] ||= { n: 0, o250: 0, oBase: 0, oAdj: 0, vals: [], mN: 0, m250: 0, mBase: 0, mAdj: 0, mVals: [] });
  s.n++; s.vals.push(+d.tot.toFixed(2)); if (d.tot > 250) s.o250++; if (d.tot > d.limit) s.oBase++; if (d.tot > d.limit * d.aT.k) s.oAdj++;
  if (d.meas) { const mm = Math.hypot(d.meas.x, d.meas.y, d.meas.z); s.mN++; s.mVals.push(+mm.toFixed(2)); if (mm > 250) s.m250++; if (mm > d.limit) s.mBase++; if (mm > d.limit * d.aM.k) s.mAdj++; }
  // V2: 게임 구동과 견줌
  const LD = d.f?.legDrive; if (!LD?.legs) return;
  const leg = d.name.slice(-1), Lg = LD.legs[leg]; if (!Lg) return;
  const jn = d.name.startsWith('shin') ? 'knee' : d.name.startsWith('thigh') ? 'hip' : 'ankle';
  const st = Lg.stat?.[jn]; const lk = k; const n0 = last.get(lk); last.set(lk, st?.n);
  if (st == null || n0 == null || st.n === n0) { cnt(A, `${jn}:notDriven`); return; } // 이 스텝에 그 관절 토크를 안 걸었음
  let gT, gW;
  if (jn === 'knee') { gT = Lg.raw.k; gW = Lg.wK; }
  else { const r = jn === 'hip' ? [Lg.raw.hx, Lg.raw.hy, Lg.raw.hz] : [Lg.raw.ax, Lg.raw.ay, Lg.raw.az], w = jn === 'hip' ? Lg.wH : Lg.wA; const i = [0, 1, 2].reduce((b, j) => (Math.abs(r[j]) > Math.abs(r[b]) ? j : b), 0); gT = r[i]; gW = [w.x, w.y, w.z][i]; cnt(A, `${jn}:axis${'xyz'[i]}`); }
  if (jn === 'knee' && Lg.qT) { // 같은 벡터 검산: 게임 무릎 토크만으로(먼 쪽이 받는 −t·b) 잣대 식을 쓰면 게임 규칙과 늘 같은 부호여야 함 · 잣대 wRel 의 축 몫 = 게임 wK 인가
    const q = Lg.qT, b = { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) }; // (0,0,1) 을 qT 로 돌림
    const wb = b.x * d.wRel.x + b.y * d.wRel.y + b.z * d.wRel.z; A.kneeWdiffMax = Math.max(A.kneeWdiffMax ?? 0, Math.abs(wb - Lg.wK));
    if (Math.abs(gT) > TMIN && Math.abs(gW) > WMIN) { cnt(A, 'knee:selfN'); if ((gT * wb > 0) === (gT * gW > 0)) cnt(A, 'knee:selfAgree'); }
  }
  const tauN = Math.hypot(d.tau.x, d.tau.y, d.tau.z);
  if (!(tauN > TMIN && Math.abs(gT) > TMIN && Math.abs(gW) > WMIN && Math.abs(d.aT.wEcc) > WMIN)) { cnt(A, `${jn}:small`); return; }
  const g = gT * gW > 0, j = d.aT.wEcc > 0;
  cnt(A, `${jn}:n`); if (g === j) cnt(A, `${jn}:agree`); if (g && j) cnt(A, `${jn}:bothLen`); if (!g && !j) cnt(A, `${jn}:bothShort`); if (g && !j) cnt(A, `${jn}:gameOnlyLen`); if (!g && j) cnt(A, `${jn}:judgeOnlyLen`);
};
process.on('exit', () => { if (OUT) writeFileSync(OUT, JSON.stringify({ joints: J, agree: A, TMIN, WMIN })); });
