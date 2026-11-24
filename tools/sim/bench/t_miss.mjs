// t_miss.mjs — 빗나간 뒤: 겨눈 선을 넘은 칼날과 몸통을 세우는 데 드는 시간 · 토크 · 땅 yaw 각충격. 결정적. 약 1 분.
//   node t_miss.mjs
//   (ii) 는 겨눈 선을 넘는 순간부터 온 힘으로 멈춘다(관절마다 관성에 맞춘 감쇠 · 사람 한도 안 · 땅도 같은 예산). (i) 도 겨눈 선을 넘으면 같은 멈춤 법칙으로 바꾼다(brakeI). (iii) 은 게임 꼴 서보가 끝 자리에 세운다.
//   멈춘 때: 그 뒤 100 ms 동안 칼날 70 % < 2 m/s 가 이어지는 첫 스텝 · 몸통은 가슴의 100 ms 알짜 회전이 0.5 rad/s 아래로 이어지는 첫 스텝 (겨눈 선 넘은 뒤부터 · 1.3 s 까지 봄)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, fmt, DT, DEG, WEAPONS, dot, sub, nrm } from './lib.mjs';
import { runCut, FAMS } from './cuts.mjs';
import { runGame } from './game.mjs';
import { searchII, gainsI } from './tune.mjs';
const R = await loadRapier();
const GI = gainsI();
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', uchigatana: '우치가타나', rapier: '레이피어' };
const sN = { i: '(i) 끝점 힘', ii: '(ii) 차례', iii: '(iii) 게임 꼴' };
const L = []; const P = (x) => L.push(x);
const T_END = 1.3;
function stopStats(rows, sum) {
  const n = rows.length; const c = rows.findIndex((r, i) => sum.tCross != null && r.t <= sum.tCross && (rows[i + 1]?.t ?? 1e9) > sum.tCross);
  if (sum.tCross == null || c < 0) return null;
  // 멈춘 때: 그 뒤 100 ms 동안 칼날 70 % < 2 m/s 가 이어지는 첫 스텝 · 몸통은 가슴의 100 ms 알짜 회전(떨림을 뺀 값)이 0.5 rad/s 아래로 이어지는 첫 스텝
  const HOLD = 12; const first = (ok) => { for (let i = c + 1; i + 2 * HOLD < n; i++) { let good = true; for (let k = 0; k <= HOLD; k++) if (!ok(i + k)) { good = false; break; } if (good) return i; } return null; };
  const net = (i) => { const a = rows[i].qCh, b = rows[Math.min(n - 1, i + HOLD)].qCh; const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return (2 * Math.acos(Math.min(1, d))) / (HOLD * DT); };
  const iB0 = first((i) => rows[i].v70 < 2), iC0 = first((i) => net(i) < 0.5), iS0 = iB0 != null && iC0 != null ? Math.max(iB0, iC0) : null;
  const endless = iS0 == null; const iB = iB0 ?? n - 2, iC = iC0 ?? n - 2; const iS = iS0 ?? n - 2; const noB = iB0 == null, noC = iC0 == null; const tWin = (n - 2 * HOLD - c) * DT;
  let jit = 0, nj = 0; for (let i = iS + 1; i < Math.min(n, iS + 25); i++) { jit += rows[i].om.chestW; nj++; }
  const seg = rows.slice(c + 1, iS + 1);
  const pk = (f) => seg.reduce((a, r) => Math.max(a, f(r) ?? 0), 0);
  let dist = 0, ang = 0, impAbs = 0, imp = 0; for (let i = c + 1; i <= iB; i++) { dist += rows[i].v70 * DT; ang += rows[i].om.swordW * DT; }
  for (const r of seg) { impAbs += Math.abs(r.ground) * DT; imp += r.ground * DT; }
  return {
    v0: rows[c].v70, wCh0: net(c), jit: nj ? jit / nj : NaN, tBlade: noB ? NaN : (iB - c) * DT, tChest: noC ? NaN : (iC - c) * DT, noB, noC, tWin, endless, dist, ang: ang / DEG, impAbs, imp,
    pkTau: { waist: pk((r) => r.tau?.waist), back: pk((r) => r.tau?.back), shS: pk((r) => r.tau?.shS), elS: pk((r) => r.tau?.elS), wr: pk((r) => r.tau?.wr), shO: pk((r) => r.tau?.shO), elO: pk((r) => r.tau?.elO), ground: pk((r) => Math.abs(r.ground)) },
    fh: pk((r) => Math.hypot(r.F[0], r.F[2])), mt: pk((r) => Math.hypot(r.Mf[0], r.Mf[2])),
    limitLoss: rows[c].resid != null && rows[Math.min(n - 1, iS + 1)].resid != null ? -(rows[Math.min(n - 1, iS + 1)].resid - rows[c].resid) : NaN,
    keBody0: null,
  };
}
P('# 표 M — 빗나간 뒤 멈춤 (땅 135 N·m · (iii) 은 닻 100). 겨눈 선을 넘은 순간부터 잰다');
P('#  칼날 멈춤 = 칼날 70 % 가 2 m/s 아래로 내려가 100 ms 넘게 머무는 첫 때 · 몸통 멈춤 = 가슴의 100 ms 알짜 회전 빠르기(스텝마다 뒤집히는 떨림은 뺀 값)가 0.5 rad/s(29 °/s) 아래로 100 ms 넘게 머무는 첫 때 · 토크 최고 = 그동안 관절에 건 값(N·m) · 관절 끝이 받은 에너지 = 근육이 아니라 엔진 관절 한도가 먹은 몫(작을수록 정직)');
P('무기 | 감기 | 획 | 방식 | 선에서 칼날 m/s | 선에서 가슴 °/s(알짜) | 칼날 멈춤 ms | 몸통 멈춤 ms | 칼날이 더 간 길 m (돈 각 °) | 땅 yaw 각충격 |Σ| N·m·s | 토크 최고: 땅 · 허리 · 등 · 칼 어깨 · 칼 팔꿈치 · 손목 · 빈 어깨 · 빈 팔꿈치 | 받침(다리 몫) 수평 힘 최고 N · 기울기 N·m | 관절 끝이 받은 에너지 J');
P('---|---|---|---|---|---|---|---|---|---|---|---|---');
const out = []; const t0 = Date.now();
for (const weapon of ['longsword', 'zweihander', 'uchigatana', 'rapier']) for (const size of ['small', 'large']) for (const fam of ['diag', 'vert', 'horiz']) for (const style of ['i', 'ii', 'iii']) {
  const base = { weapon, fam, size, yawCap: style === 'iii' ? 100 : 135 };
  let r;
  if (style === 'i') r = runCut(R, { ...base, style: 'i', ...GI, tEnd: T_END, brakeI: true });
  else if (style === 'ii') { const d = searchII(R, base); r = runCut(R, { ...base, style: 'ii', tSh: d.tSh, tEl: d.tEl, tWr: d.tWr, tEnd: T_END }); }
  else r = runGame(R, { ...base, tAfter: T_END });
  const s = stopStats(r.rows, r.sum); out.push({ weapon, size, fam, style, s });
  const head = `${KO[weapon]} | ${size === 'small' ? '작게' : '크게'} | ${FAMS[fam].ko} | ${sN[style]}`;
  if (!s) { P(`${head} | 겨눈 선을 못 넘음 | – | – | – | – | – | – | – | –`); continue; }
  const t = s.pkTau;
  P(`${head} | ${fmt(s.v0)} | ${fmt(s.wCh0 / DEG, 0)} | ${s.noB ? '> ' + fmt(s.tWin * 1000, 0) : fmt(s.tBlade * 1000, 0)} | ${s.noC ? '> ' + fmt(s.tWin * 1000, 0) : fmt(s.tChest * 1000, 0)} | ${fmt(s.dist, 2)} (${fmt(s.ang, 0)}) | ${fmt(s.impAbs, 1)} | ${fmt(t.ground, 0)} · ${style === 'iii' ? '– (엔진 모터)' : `${fmt(t.waist, 0)} · ${fmt(t.back, 0)} · ${fmt(t.shS, 0)} · ${fmt(t.elS, 0)}`} · ${fmt(t.wr, 0)}${style === 'iii' ? '' : ` · ${fmt(t.shO, 0)} · ${fmt(t.elO, 0)}`} | ${fmt(s.fh, 0)} · ${fmt(s.mt, 0)} | ${style === 'iii' ? '–' : fmt(s.limitLoss, 0)}`);
  process.stderr.write(`\r${out.length} 칸 · ${fmt((Date.now() - t0) / 1000, 0)} s   `);
}
process.stderr.write('\n');
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const rng = (a, d = 0) => { const b = a.filter(Number.isFinite); return b.length ? `${fmt(Math.min(...b), d)} ~ ${fmt(Math.max(...b), d)}` : '–'; };
P(''); P('# 표 M-요약 — 무기 × 감기 × 방식 (세 획 가운데값 [범위] · 본 구간 안에 안 멈춘 획은 본 구간 길이(약 1 s)로 넣음): 선에서 칼날 빠르기 · 칼날 멈춤 · 몸통 멈춤 · 더 간 길 · 땅 yaw 각충격');
P('무기 | 감기 | 방식 | 선에서 칼날 m/s | 칼날 멈춤 ms | 몸통 멈춤 ms | 더 간 길 m | 땅 yaw 각충격 N·m·s | 관절 끝이 받은 에너지 J | 겨눈 선 못 넘음 / 칼날 안 멈춤 / 몸통 안 멈춤 (획 수)');
P('---|---|---|---|---|---|---|---|---|---');
for (const weapon of ['longsword', 'zweihander', 'uchigatana', 'rapier']) for (const size of ['small', 'large']) for (const style of ['i', 'ii', 'iii']) {
  const cs = out.filter((c) => c.weapon === weapon && c.size === size && c.style === style); const ok = cs.filter((c) => c.s).map((c) => c.s);
  const tB = ok.map((s) => (s.noB ? s.tWin : s.tBlade) * 1000), tC = ok.map((s) => (s.noC ? s.tWin : s.tChest) * 1000);
  P(`${KO[weapon]} | ${size === 'small' ? '작게' : '크게'} | ${sN[style]} | ${fmt(med(ok.map((s) => s.v0)))} | ${fmt(med(tB), 0)} [${rng(tB)}] | ${fmt(med(tC), 0)} [${rng(tC)}] | ${fmt(med(ok.map((s) => s.dist)), 2)} | ${fmt(med(ok.map((s) => s.impAbs)), 1)} | ${style === 'iii' ? '–' : fmt(med(ok.map((s) => s.limitLoss)), 0)} | ${cs.filter((c) => !c.s).length} / ${ok.filter((s) => s.noB).length} / ${ok.filter((s) => s.noC).length}`);
}
writeFileSync(join(HERE, 'out/miss.json'), JSON.stringify(out));
writeFileSync(join(HERE, 'out/miss.txt'), L.join('\n') + '\n'); console.log(L.join('\n'));
