// 코테 한 수의 재는 창을 풀어 봄: node kote_trace.mjs <나무> — 치는 구간(act) · 창 끝(dur) · 구간별 칼끝 길 · 빠르기
const root = process.argv[2];
const { MOVES } = await import(root + '/tools/sim/motion_regress.mjs');
for (const k of ['kote', 'koteNear']) {
  const r = MOVES[k]();
  const T = r.trail; // [t, x, y, z] (3 스텝마다)
  const seg = (a, b) => { let p = 0, vm = 0; for (let i = 1; i < T.length; i++) { if (T[i][0] <= a || T[i][0] > b) continue; const s = Math.hypot(T[i][1] - T[i - 1][1], T[i][2] - T[i - 1][2], T[i][3] - T[i - 1][3]); p += s; vm = Math.max(vm, s / (T[i][0] - T[i - 1][0])); } return p.toFixed(3) + ' m (최고 ' + vm.toFixed(1) + ')'; };
  const end = T.at(-1);
  console.log(`${k}: fired ${JSON.stringify(r.fired)} hits ${JSON.stringify(r.hits)} · act ${r.act} s · dur ${r.dur} s · path ${r.path} · vmax ${r.vmax} · 처음→끝 ${r.disp} m`);
  console.log(`   구간 칼끝 길: 0~act ${seg(0, r.act)} · act~act+0.2 ${seg(r.act, r.act + 0.2)} · act+0.2~+0.4 ${seg(r.act + 0.2, r.act + 0.4)} · 끝 자리 [${end.slice(1).join(', ')}] @${end[0]}`);
}
