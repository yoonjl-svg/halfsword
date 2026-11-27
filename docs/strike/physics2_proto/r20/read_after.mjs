// 읽기 지적 고친 뒤 (r20 §6): node docs/strike/physics2_proto/r20/read_after.mjs <관문 json> ... — 차례 · 창 · t0 · 간격 수
import { readFileSync } from 'node:fs';
const q = (a, p) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p, l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
for (const f of process.argv.slice(2)) { const rows = JSON.parse(readFileSync(f, 'utf8')).rows; console.log('==', f.split('/').slice(-2).join('/'));
  for (const w of ['rapier', 'longsword']) for (const sc of ['far', 'near']) { const s = rows.filter((r) => r.path === 'ai' && r.weapon === w && r.scene === sc && r.valid); const h = s.filter((r) => r.hit);
    const t = s.map((r) => r.t0rel); const oo = h.filter((r) => r.wHip <= r.wKnee && r.wKnee <= r.wAnk).length;
    console.log(`${w} ai ${sc} valid ${s.length} hits ${h.length} | order old(<=) ${oo} strict ${h.filter(r=>r.order===1).length} ties ${h.filter(r=>r.orderTie).length} trunc ${h.filter(r=>r.orderTrunc).length} | pelPk hit ${q(h.map(r=>r.pelPk),.5).toFixed(3)} miss ${q(s.filter(r=>!r.hit).map(r=>r.pelPk),.5).toFixed(3)} | t0rel<=-200 ${(100*t.filter(x=>x<=-200).length/t.length).toFixed(0)}% min ${Math.min(...t)} edge ${s.filter(r=>r.t0Edge).length} | tHit>0.84 ${h.filter(r=>r.tHit>0.84).length}`); }
  const hf = rows.filter((r) => r.path === 'human'); for (const w of ['rapier','longsword']) for (const sc of ['far','near']) { const s = hf.filter(r=>r.weapon===w&&r.scene===sc); if (s[0]?.gap0 != null) console.log(`human ${w} ${sc} gap0 ${q(s.map(r=>r.gap0),0).toFixed(3)}-${q(s.map(r=>r.gap0),1).toFixed(3)} set ${q(s.map(r=>r.gap),0).toFixed(3)}-${q(s.map(r=>r.gap),1).toFixed(3)} hits ${s.filter(r=>r.hit).length}/${s.length}`); }
}
