// r23 읽기 지적 1 — AI 레이피어 탭 찌르기의 제 걸음이 팔 뒤에 나오는가 (관문 AI 장면과 같은 AI 대 AI 레이피어 싸움 · 읽기만)
//  탭마다: 팔이 뻗기 시작한 때(찌르기 시계가 겨눔 끝 K.aim 을 마지막으로 넘은 스텝) · AI 가 제 걸음 부탁에 성공한 때(ai.requestedStep 이 켜진 스텝) · 탭 때 이미 뜬 발이 있었나(gait 다리 stance)
//  node diag_aitap.mjs --root=<나무> [--seeds=4001-4010] [--secs=30]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { seedList, q } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const DT = 1 / 120; const secs = +(args.secs ?? 30);
const rows = [];
for (const seed of seedList(args.seeds ?? '4001-4010')) {
  const G = H.newRound({ walls: true, seed, weapon: 'rapier', weapon2: 'rapier', AI2Class: H.AI });
  const ais = [[G.player, G.ai2], [G.enemy, G.ai]];
  const st = new Map(ais.map(([f]) => [f, { tap: null, rec: null }]));
  for (let k = 0; k < Math.round(secs / DT); k++) {
    G.step();
    for (const [f, ai] of ais) {
      if (!ai) continue; const s = st.get(f); const tp = f.skill?.tap;
      if (tp && tp !== s.tap && !tp.down) {
        if (s.rec) rows.push(s.rec);
        const g = f.gait; const swing = !!g && (!g.legs.F.stance || !g.legs.B.stance);
        s.rec = { seed, t0: k, swingAtTap: swing, ext: null, req: null, reqBefore: ai.requestedStep };
        s.tap = tp;
      }
      if (s.rec && s.tap) {
        if (s.tap.t <= s.tap.K.aim + 1e-9) s.rec.ext = null; else if (s.rec.ext == null) s.rec.ext = k;
        if (!s.rec.reqBefore && s.rec.req == null && ai.requestedStep) s.rec.req = k;
        if (k - s.rec.t0 > 120) { rows.push(s.rec); s.rec = null; }
      }
      if (!tp) s.tap = null;
    }
  }
  for (const [f] of ais) { const s = st.get(f); if (s.rec) rows.push(s.rec); }
  try { G.world.free(); } catch {}
}
const withReq = rows.filter((r) => r.req != null && r.ext != null);
const d = withReq.map((r) => (r.req - r.ext) * DT);
console.log(`탭 ${rows.length} · 제 걸음 낸 탭 ${withReq.length} · 걸음 − 뻗기 시작 (s) 가운데 ${q(d, 0.5)?.toFixed(3)} · 10 % ${q(d, 0.1)?.toFixed(3)} · 90 % ${q(d, 0.9)?.toFixed(3)} · 뻗기 앞에 걸음 ${d.filter((x) => x < 0).length}`);
console.log(`탭 때 이미 뜬 발 ${rows.filter((r) => r.swingAtTap).length} / ${rows.length}`);
