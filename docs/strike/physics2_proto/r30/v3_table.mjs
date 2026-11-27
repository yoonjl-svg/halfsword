// r30 V2 (ii) · V3 표: tap_<장면>.json 을 읽어 다리 관절마다 95 % · 최고 · 250 넘은 몫(옛 심판) · 312.5 넘은 몫(overBase) · 늘어나는 몫 곱한 한도 넘은 몫(새 심판).
//  싸움꾼이 여럿이면(fights12 는 12 판 × 둘 · reqlunge 는 2 판) 관절 이름(앞발 F · 뒷발 B)끼리 모은다. node v3_table.mjs <폴더>
import { readFileSync, existsSync } from 'node:fs';
const dir = process.argv[2];
const SC = ['stand', 'walk', 'back', 'strafe', 'reqlunge', 'fights12'];
const JN = ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
const p = (x) => (100 * x).toFixed(1);
const q95 = (a) => { const s = Float64Array.from(a).sort(); return s.length ? s[Math.floor(0.95 * (s.length - 1))] : 0; };
const lines = [];
for (const kind of ['req', 'meas']) {
  lines.push(kind === 'req' ? '## 요구(다시 센 토크 · over 줄) — 95 % · 최고 N·m · 넘은 몫 % : >250(옛) · >312.5(overBase) · >늘어나는 몫 곱한 한도(새)' : '## 전달(운동량으로 잰 토크 · mOver 줄) — 같은 칸 · 잴 수 있던 표본만');
  lines.push('장면 | 관절 | 표본 | 95 % | 최고 | >250 | >312.5 | >새 한도');
  for (const sc of SC) {
    const f = `${dir}/tap_${sc}.json`; if (!existsSync(f)) { lines.push(`${sc} | (없음)`); continue; }
    const T = JSON.parse(readFileSync(f, 'utf8')).joints;
    for (const jn of JN) {
      const ks = Object.keys(T).filter((k) => k.split(':')[1] === jn); if (!ks.length) continue;
      let n = 0, a = 0, b = 0, c = 0; const v = [];
      for (const k of ks) { const s = T[k]; if (kind === 'req') { n += s.n; a += s.o250; b += s.oBase; c += s.oAdj; v.push(...s.vals); } else { n += s.mN; a += s.m250; b += s.mBase; c += s.mAdj; v.push(...s.mVals); } }
      lines.push(`${sc} | ${jn} | ${n} | ${q95(v).toFixed(0)} | ${(v.length ? Math.max(...v) : 0).toFixed(0)} | ${p(a / Math.max(1, n))} | ${p(b / Math.max(1, n))} | ${p(c / Math.max(1, n))}`);
    }
  }
  lines.push('');
}
lines.push('## V2 (ii) 부호 견줌 — 게임 다리 구동(같은 스텝 · 그 관절 토크를 실제로 건 스텝 · |토크| > TMIN N·m · |빠르기| > WMIN rad/s) 의 늘어남 부호 ↔ 잣대 wEcc 부호');
lines.push('장면 | 관절 | 견준 표본 | 같음 | 둘 다 늘어남 | 둘 다 줄어듦 | 게임만 늘어남 | 잣대만 늘어남 | 쓴 축 | 무릎 검산(게임 토크만 · 같음/표본 · wRel 축 몫 − wK 최대)');
for (const sc of SC) {
  const f = `${dir}/tap_${sc}.json`; if (!existsSync(f)) continue;
  const D = JSON.parse(readFileSync(f, 'utf8')), A = D.agree;
  for (const jn of ['knee', 'hip', 'ankle']) {
    const g = (k) => A[`${jn}:${k}`] ?? 0;
    const ax = ['x', 'y', 'z'].map((x) => `${x} ${g('axis' + x)}`).join(' ');
    lines.push(`${sc} | ${jn} | ${g('n')} | ${g('agree')} (${p(g('agree') / Math.max(1, g('n')))} %) | ${g('bothLen')} | ${g('bothShort')} | ${g('gameOnlyLen')} | ${g('judgeOnlyLen')} | ${jn === 'knee' ? '경첩' : ax} | ${jn === 'knee' ? `${A['knee:selfAgree'] ?? 0}/${A['knee:selfN'] ?? 0} · ${(A.kneeWdiffMax ?? 0).toExponential(1)}` : ''}`);
  }
  lines.push(`  (TMIN ${D.TMIN} · WMIN ${D.WMIN})`);
}
console.log(lines.join('\n'));
