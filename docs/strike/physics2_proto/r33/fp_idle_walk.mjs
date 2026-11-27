// r33 지문 덧 (판정 줄 R10) — 찌르기 아닌 움직임 둘: 앞으로 걷기 3 s · 서 있기 10 s 가 바탕과 바이트까지 같은가 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//   node fp_idle_walk.mjs --root=<나무> --json=<파일>     장면을 돌려 적음 (사람 몸 · 상대는 AI 끔 · 칼 몸 마다 스텝마다 자리 · 빠르기)
//   node fp_idle_walk.mjs --a=<옛 json> --b=<새 json>     장면마다 견줌: 적은 글이 바이트까지 같은가 · 다르면 처음 다른 스텝과 자리 최대 차
//   장면: 무기 rapier(이탈리아 걸음) · longsword(바탕 걸음) × { walk: 0.8 s 고요 → 스틱 앞으로 3 s → 놓고 1 s · stand: 10 s 가만히 } · 씨앗 4811 · 벽 없음 · 상대 간격 6 m (닿지 않음)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
if (args.root) {
  const ROOT = resolve(String(args.root));
  const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
  const { DT } = H; const SEED = 4811;
  const rec = (P) => { const out = []; for (const [k, rb] of Object.entries(P.bodies)) { if (!rb) continue; const t = rb.translation(), v = rb.linvel(); out.push(k, t.x, t.y, t.z, v.x, v.y, v.z); } if (P.sword) { const t = P.sword.translation(); out.push('sword', t.x, t.y, t.z); } return out.map((x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x)); };
  const scenes = {};
  for (const w of ['rapier', 'longsword']) for (const kind of ['walk', 'stand']) {
    const G = H.newRound({ walls: false, gap: 6, seed: SEED, weapon: w, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player; const rows = [];
    const plan = kind === 'walk' ? [[0.8, 0], [3, 1], [1, 0]] : [[10, 0]];
    for (const [secs, y] of plan) for (let i = 0; i < Math.round(secs / DT); i++) { P.move.set(0, y); G.step(); rows.push(rec(P)); }
    try { G.world.free(); } catch { /* */ }
    scenes[`${kind}_${w}`] = { state: P.state, rows };
  }
  writeFileSync(String(args.json), JSON.stringify({ dt: DT, scenes }));
  console.log('적음', args.json);
}
if (args.a && args.b) {
  const A = JSON.parse(readFileSync(String(args.a), 'utf8')), B = JSON.parse(readFileSync(String(args.b), 'utf8')); let all = true;
  for (const k of Object.keys(A.scenes)) { const a = A.scenes[k], b = B.scenes[k]; if (!b) { console.log(k, '없음'); all = false; continue; }
    const same = JSON.stringify(a) === JSON.stringify(b); if (!same) all = false;
    let first = null, dmax = 0; const n = Math.min(a.rows.length, b.rows.length);
    for (let i = 0; i < n; i++) for (let j = 0; j < a.rows[i].length; j++) { const x = a.rows[i][j], y = b.rows[i][j]; if (typeof x === 'number' && x !== y) { if (first == null) first = i; dmax = Math.max(dmax, Math.abs(x - y)); } }
    console.log(`${k.padEnd(16)} 스텝 ${a.rows.length} / ${b.rows.length} · 바이트 같음 ${same} · 처음 다른 스텝 ${first ?? '-'} · 최대 차 ${dmax}`); }
  console.log(`모두 같음: ${all}`);
}
