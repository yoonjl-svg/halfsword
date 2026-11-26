// 코테 뒤 칼끝 높이 · 빠르기를 재는 창 밖(0.9 s)까지: node kote_long.mjs <나무> — 나무의 tools/sim/motion_regress_dbg.mjs (dbg 가 칼끝 높이를 찍는 사본)
const root = process.argv[2];
process.env.MR_DEBUG = '1';
const L = [];
const log = console.log;
console.log = (...a) => L.push(a.join(' '));
const { MOVES } = await import(root + '/tools/sim/motion_regress_dbg.mjs');
const r = MOVES.kote();
console.log = log;
const rows = L.map((s) => s.match(/t ([\d.]+) v ([\d.]+) .*? y ([\d.-]+)/)).filter(Boolean).map((m) => [+m[1], +m[2], +m[3]]);
const at = (t) => rows.reduce((b, x) => (Math.abs(x[0] - t) < Math.abs(b[0] - t) ? x : b), rows[0]);
log(`act ${r.act} · 재는 창 끝 ${r.dur} s · 칼끝 높이(m) @ 0.1 s 마다: ` + [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => at(t)[2].toFixed(2)).join(' ') + ' · 빠르기(m/s): ' + [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t) => at(t)[1].toFixed(1)).join(' '));
const y0 = rows[0][2]; const low = rows.reduce((b, x) => (x[2] < b[2] ? x : b), rows[0]);
const back = rows.find((x) => x[0] > low[0] && x[2] >= y0 - 0.1);
log(`   처음 높이 ${y0.toFixed(2)} · 가장 낮은 ${low[2].toFixed(2)} @${low[0].toFixed(2)} s · 처음 높이 −0.1 m 까지 되돌아온 때 ${back ? back[0].toFixed(2) + ' s' : '0.9 s 안에 못 돌아옴'}`);
