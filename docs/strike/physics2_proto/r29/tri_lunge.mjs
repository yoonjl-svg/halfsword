// r29 새 실패 가름 1 — '런지: 가까우면 맞음 · 먼 데서 내면 …' (tools/sim/riso_reach.test.mjs) 를 씨앗 1 ~ 8 로: 시험과 같은 설정(SECRET.risolutoSlide 0.6) · 같은 틈(1.9 · 2.2 맞아야 · 2.8 · 3.2 빗나가야)
//  쓰는 법: (cd <나무> && node <이 파일> [--root=.])  → 씨앗 · 틈마다 맞음 · 칼끝 지남(over m) · 시험이 바라는 대로인가 · 끝에 씨앗마다 통과 수
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const { CONFIG } = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { lungeAt } = await import(pathToFileURL(join(ROOT, 'tools/sim/riso_reach.mjs')).href);
const { SECRET } = CONFIG;
const old = SECRET.risolutoSlide; SECRET.risolutoSlide = 0.6;
let pass = 0;
for (let seed = 1; seed <= 8; seed++) {
  const row = []; let ok = true;
  for (const gap of [1.9, 2.2, 2.8, 3.2]) {
    const r = lungeAt({ gap, seed });
    const want = gap < 2.5 ? r.hit && r.sev > 0 && r.over > 0 : r.hit === false && r.over < -0.1;
    ok &&= want;
    row.push(`${gap} m ${r.hit ? '맞음' : '빗나감'} over ${r.over} sev ${r.sev} (몸 ${r.bodyType ?? '-'} ${r.bodyE ?? '-'} J · 끝 거리 dEnd ${r.dEnd} · 칼끝 최소 틈 ${r.tipGapMin})${want ? '' : ' ✗'}`);
  }
  if (ok) pass++;
  console.log(`씨앗 ${seed}: ${ok ? '통과' : '실패'} · ${row.join(' · ')}`);
}
SECRET.risolutoSlide = old;
console.log(`씨앗 8 가운데 통과 ${pass}`);
