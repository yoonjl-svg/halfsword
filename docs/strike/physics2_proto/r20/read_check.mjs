// 읽기 지적 확인 (r20 §6): node docs/strike/physics2_proto/r20/read_check.mjs <관문 json> — 처음 json 의 지적 1 ~ 6 수
import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync(process.argv[2], 'utf8')); const rows = J.rows;
const q = (a, p) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p, l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const sel = (sc, w, p) => rows.filter((r) => r.scene === sc && r.weapon === w && r.path === p);
for (const w of ['rapier', 'longsword']) for (const p of ['human', 'ai']) {
  const far = sel('far', w, p), v = far.filter((r) => r.valid), h = v.filter((r) => r.hit);
  const ord = h.filter((r) => r.order === 1), ties = ord.filter((r) => r.wHip === r.wKnee || r.wKnee === r.wAnk), strict = h.filter((r) => r.wHip < r.wKnee && r.wKnee < r.wAnk && r.wAnk < 100);
  console.log(`F1/2 ${w} ${p} far strokes ${far.length} valid ${v.length} hits ${h.length} | order=1 ${ord.length} ties ${ties.length} strict(no100) ${strict.length} -> ${(strict.length / h.length).toFixed(2)} vs ${(ord.length / h.length).toFixed(2)}`);
  if (p === 'human') for (const sc of ['far', 'near']) { const s = sel(sc, w, p); const d = s.map((r) => r.gap0 - r.gap); console.log(`F3 ${w} ${sc} set ${q(s.map((r) => r.gap), 0).toFixed(3)}-${q(s.map((r) => r.gap), 1).toFixed(3)} gap0 ${q(s.map((r) => r.gap0), 0).toFixed(3)}-${q(s.map((r) => r.gap0), 1).toFixed(3)} offset med ${q(d, .5).toFixed(3)} min ${q(d, 0).toFixed(3)} max ${q(d, 1).toFixed(3)} hits ${s.filter(r=>r.hit).length}/${s.length}`); }
  else {
    console.log(`F4 ${w} ai far gap0 med ${q(far.map((r) => r.gap0), .5).toFixed(2)} p90 ${q(far.map((r) => r.gap0), .9).toFixed(2)} travel med ${q(h.map((r) => r.pelTravel), .5).toFixed(2)} hits<0.43 ${h.filter((r) => r.tHit < 0.43).length}/${h.length} >0.84 ${h.filter((r) => r.tHit > 0.84).length}`);
    for (const sc of ['far', 'near']) { const s = sel(sc, w, p).filter((r) => r.valid); const t = s.map((r) => r.t0rel);
      console.log(`F5/6 ${w} ${sc} pelPk hit ${q(s.filter(r=>r.hit).map(r=>r.pelPk),.5).toFixed(3)} miss ${q(s.filter(r=>!r.hit).map(r=>r.pelPk),.5).toFixed(3)} | t0rel<=-200 ${(t.filter(x=>x<=-200).length/t.length*100).toFixed(0)}% min ${Math.min(...t)} neg ${(t.filter(x=>x<0).length/t.length*100).toFixed(0)}%`); }
  }
}
