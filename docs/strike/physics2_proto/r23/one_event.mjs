// 온몸 치기 다시 판정 — '무엇이 먼저'(부호)가 아니라 '얼마나 하나인가'(두 때의 차의 크기). 관문 줄 파일(wb_gate json 의 rows)만 읽음 · 시뮬레이션 없음.
//  찌르기: handFoot = 앞발 뜸 − 손 시작 (s · + 면 손 먼저). 창 |차| ≤ 0.12 s (자료 0.07 ± 0.05 의 먼 끝 · 관문 L5 의 hi 그대로)
//  내려베기: footGap = 앞발 디딤 − 칼 닿음 (s · + 면 칼 먼저). 창 |차| ≤ 0.09 s (자료 +43 ± 16 ms · 관문 C1 의 hi 그대로)
//  한 사건 몫 = 창 안인 획의 몫. 부호(먼저인 쪽)는 읽는 값. '늦지 않음' = 탭(휘두르기) → 맞음 가운데값. '실림' = 골반 최고 빠르기 · 골반 ÷ 손 · 뒷다리 밀기.
//  부르기: node one_event.mjs <이름>=<json,json…> <이름>=<…> …
import fs from 'node:fs';
const WT = 0.12, WC = 0.09;
const sets = process.argv.slice(2).map((a) => { const [n, fl] = a.split('='); return { n, rows: fl.split(',').flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')).rows) }; });
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const med = (a) => q(a, 0.5);
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const sh = (a, fn) => (a.length ? a.filter(fn).length / a.length : NaN);
console.log(`창: 찌르기 |앞발 뜸 − 손 시작| ≤ ${WT} s · 내려베기 |앞발 디딤 − 칼 닿음| ≤ ${WC} s`);
console.log('\n### 찌르기 — 손과 앞발 (걸음이 있는 획만 · 넘어진 획 뺌)');
console.log('| 길 · 무기 · 장면 | 판 | 걸음 있는 획 | 차 가운데 s (부호: + 손 먼저) | 10 ~ 90 % | |차| 가운데 | 한 사건 몫 | 손 먼저 몫(읽기) | 골반 최고 m/s | 골반 ÷ 손 | 뒷다리 밀기 ÷ 몸무게 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const path of ['human', 'ai']) for (const w of ['rapier', 'longsword']) for (const scene of ['far', 'farClose', 'mid', 'near']) for (const s of sets) {
  const all = s.rows.filter((r) => r.scene === scene && r.path === path && r.weapon === w && r.valid && !r.fell);
  const v = all.filter((r) => Number.isFinite(r.handFoot)); if (v.length < 5) continue;
  const d = v.map((r) => r.handFoot);
  console.log(`| ${path} · ${w} · ${scene} | ${s.n} | ${v.length} / ${all.length} | ${f(med(d))} | ${f(q(d, 0.1))} ~ ${f(q(d, 0.9))} | ${f(med(d.map(Math.abs)))} | ${f(sh(d, (x) => Math.abs(x) <= WT + 1e-9), 2)} | ${f(sh(d, (x) => x > 0), 2)} | ${f(med(v.map((r) => r.pelPk)), 2)} | ${f(med(v.map((r) => r.ratio)), 2)} | ${f(med(v.map((r) => r.pushAct)), 2)} |`);
}
console.log('\n### 찌르기 — 늦지 않음 (탭 → 맞음 · 맞은 획)');
console.log('| 길 · 무기 · 장면 | 판 | 맞음 / 획 | 탭 → 맞음 가운데 s | 10 ~ 90 % |');
console.log('|---|---|---|---|---|');
for (const path of ['human', 'ai']) for (const w of ['rapier', 'longsword']) for (const scene of ['far', 'farClose', 'mid', 'near']) for (const s of sets) {
  const all = s.rows.filter((r) => r.scene === scene && r.path === path && r.weapon === w && r.valid && !r.fell); const h = all.filter((r) => r.hit && Number.isFinite(r.tHit) && r.tHit < 5);
  if (h.length < 5) continue; const t = h.map((r) => r.tHit);
  console.log(`| ${path} · ${w} · ${scene} | ${s.n} | ${h.length} / ${all.length} | ${f(med(t))} | ${f(q(t, 0.1))} ~ ${f(q(t, 0.9))} |`);
}
console.log('\n### 내려베기 — 칼 닿음과 앞발 디딤 (맞은 내려베기 · 넘어진 획 뺌)');
console.log('| 길 | 판 | 맞은 획 | 디딤이 잡힌 획 | 차 가운데 s (부호: + 칼 먼저) | 10 ~ 90 % | |차| 가운데 | 한 사건 몫 | 칼 먼저 몫(읽기) | 휘두르기 → 맞음 가운데 s | 칼끝 최고 m/s | 골반 최고 m/s |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const path of ['human', 'ai']) for (const s of sets) {
  const h = s.rows.filter((r) => r.scene === 'cut' && r.path === path && r.desc && r.valid && !r.fell && r.hit);
  const v = h.filter((r) => Number.isFinite(r.footGap)); if (!h.length) continue; const d = v.map((r) => r.footGap);
  console.log(`| ${path} | ${s.n} | ${h.length} | ${v.length} | ${f(med(d))} | ${f(q(d, 0.1))} ~ ${f(q(d, 0.9))} | ${f(med(d.map(Math.abs)))} | ${f(sh(d, (x) => Math.abs(x) <= WC + 1e-9), 2)} | ${f(sh(d, (x) => x > 0), 2)} | ${f(med(h.map((r) => r.tHit)))} | ${f(med(h.map((r) => r.tipPk)), 2)} | ${f(med(h.map((r) => r.pelPk)), 2)} |`);
}
// AI 내려베기: 차의 분포(0.05 s 칸)
console.log('\n### 내려베기 차의 분포 (0.05 s 칸 · 칸의 아래 끝 : 획 수)');
for (const path of ['human', 'ai']) for (const s of sets) {
  const d = s.rows.filter((r) => r.scene === 'cut' && r.path === path && r.desc && r.valid && !r.fell && r.hit && Number.isFinite(r.footGap)).map((r) => r.footGap);
  const hst = {}; for (const x of d) { const k = (Math.floor(x / 0.05 + 1e-9) * 0.05).toFixed(2); hst[k] = (hst[k] || 0) + 1; }
  console.log(`${path} · ${s.n}: ` + Object.keys(hst).sort((a, b) => a - b).map((k) => `${k}:${hst[k]}`).join(' '));
}
