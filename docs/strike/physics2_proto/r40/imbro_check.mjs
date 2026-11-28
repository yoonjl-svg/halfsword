// r40 (읽기만) — 새로 깨진 단위 시험 '① 내려 찌르기 닿게'가 한 판의 우연인지: 같은 훈련을 씨앗 여럿으로
//  cd <나무> && node imbro_check.mjs --root=. [--seeds=1-12]   → 씨앗마다 내려 찌르기(imbroccata)의 공격 수 · 맞음 수 · 찌른 상처 수(sev > 0)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const a = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, '').split('=')));
const ROOT = resolve(a.root ?? '.'); const { drillRun } = await import(pathToFileURL(join(ROOT, 'tools/sim/special_balance.mjs')).href);
const [s0, s1] = String(a.seeds ?? '1-12').split('-').map(Number); let T = [0, 0, 0], ok = 0, n = 0;
for (let s = s0; s <= s1; s++) {
  const on = drillRun('italian', s, { foe: 'still', variant: 'on', dur: 14 });
  const hits = on.atts.flatMap((x) => x.hits).filter((h) => h.tech === 'imbroccata'); const stab = hits.filter((h) => h.type === 'stab' && h.sev > 0);
  console.log(`씨앗 ${s}: 공격 ${on.atts.length} · 내려 찌르기 맞음 ${hits.length} · 찌른 상처 ${stab.length}`); T[0] += on.atts.length; T[1] += hits.length; T[2] += stab.length; n++; if (stab.length >= 1) ok++;
}
console.log(`합: 공격 ${T[0]} · 맞음 ${T[1]} · 찌른 상처 ${T[2]} · 찌른 상처가 하나라도 난 판 ${ok} / ${n}`);
