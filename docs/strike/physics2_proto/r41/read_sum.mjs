// trace.mjs 출력 요약: 장부 d(빌더 깊이) 대 엔진 질의 깊이 (칼날 안 길이 inLen · 칼끝 겉 밑 dS)
import { readFileSync } from 'node:fs';
const q = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const f2 = (x) => Number.isFinite(x) ? (x * 100).toFixed(1) : '-';
for (const f of process.argv.slice(2)) {
  const o = JSON.parse(readFileSync(f)); const E = o.flatMap((r) => r.list.filter((e) => !e.wasAtOn).map((e) => ({ ...e, seed: r.seed })));
  const dM = [], inM = [], dsM = []; let over = 0, through = 0, side = 0, pierced = 0, noend = 0;
  for (const e of E) {
    const st = e.steps; const d = Math.max(...st.map((x) => x.d)); const il = Math.max(...st.map((x) => x.inLen)); const ds = Math.max(...st.map((x) => x.depthSurf ?? -1));
    dM.push(d); inM.push(il); dsM.push(ds); if (st.some((x) => x.pierced)) pierced++; if (!e.end) noend++;
    if (d > il + 0.02) over++;
    const thr = st.some((x) => !x.inside && x.inLen > 0.01 && e.Lexit != null && x.d > e.Lexit - 0.005); if (thr) through++;
    else if (d > il + 0.02) side++;
  }
  console.log(`${f.split('/').pop()} 든 ${E.length} 뚫림 ${pierced} 안끝남 ${noend} | d 50/90/max ${f2(q(dM, .5))}/${f2(q(dM, .9))}/${f2(Math.max(...dM))} | 칼날안 ${f2(q(inM, .5))}/${f2(q(inM, .9))}/${f2(Math.max(...inM))} | 칼끝겉밑 ${f2(q(dsM, .5))}/${f2(q(dsM, .9))}/${f2(Math.max(...dsM))} | d>안+2cm ${over} (꿰뚫고나감 ${through} · 옆으로빠짐 ${E.length ? side : 0})`);
}
