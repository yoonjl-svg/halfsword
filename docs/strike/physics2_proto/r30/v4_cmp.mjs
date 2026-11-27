// r30 V4 견줌: tap 출력의 실패 이름(not ok … - 이름 · 파일 줄 빼고) ↔ 본판 실패 목록. node v4_cmp.mjs <tests.tap> <목록 파일>
import { readFileSync } from 'node:fs';
const [tap, list] = process.argv.slice(2);
const T = readFileSync(tap, 'utf8').split('\n');
const fails = new Set(), passes = new Set();
for (const l of T) {
  const m = l.match(/^\s*(not ok|ok) \d+ - (.*?)(\s+# .*)?$/); if (!m) continue;
  const name = m[2].trim(); if (/\.test\.mjs$/.test(name)) continue;
  (m[1] === 'ok' ? passes : fails).add(name);
}
const base = new Set(readFileSync(list, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
const newFail = [...fails].filter((n) => !base.has(n)), newPass = [...base].filter((n) => !fails.has(n));
const tot = T.find((l) => /^# tests /.test(l)), fl = T.find((l) => /^# fail /.test(l)), ps = T.find((l) => /^# pass /.test(l));
console.log(`${tot ?? ''} · ${ps ?? ''} · ${fl ?? ''} · 실패 이름 ${fails.size} · 본판 목록 ${base.size} · 같이 실패 ${[...fails].filter((n) => base.has(n)).length}`);
console.log(`새 실패 ${newFail.length}${newFail.map((n) => '\n  - ' + n).join('')}`);
console.log(`새 통과(목록에 있는데 이번엔 실패 아님) ${newPass.length}${newPass.map((n) => '\n  - ' + n + (passes.has(n) ? ' (ok 로 찍힘)' : ' (이름을 못 찾음)')).join('')}`);
