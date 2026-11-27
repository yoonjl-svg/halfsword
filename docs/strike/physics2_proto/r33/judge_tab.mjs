// r33 런지 — 선임 판정 표 (시뮬레이션 없음 — run_judge.sh 가 낸 json 만 읽음). 줄은 physics2_notes/r33_lunge.md §5 (R1 ~ R12 · 짓기 앞에 적음)
//  node judge_tab.mjs <나온 곳($S/r33j)> <바탕 관문 폴더($S/r32b/a)>
//   칸 base = r32_a · new = r33_j. 런지 장면 씨앗 7001 ~ 7020 · 8001 ~ 8020 (짓는 쪽이 안 본 것). 관문 다섯 묶음의 바탕은 같은 칸 r32_a 로 앞서 잰 것.
//   읽는 규칙(§5): 금을 못 넘어도 차가 판 사이 표준편차보다 작으면 '금 위'. 값은 금에 맞춰 고치지 않음.
import { readFileSync, existsSync } from 'node:fs';
const [O, GB] = process.argv.slice(2);
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const SD = ['7001-7020', '8001-8020']; const BL = ['4001-4040', '4041-4080', '5001-5040', '6001-6040', '7001-7040']; const WS = ['longsword', 'rapier']; const KO = { longsword: '장검', rapier: '레이피어' };
const fin = (a) => a.filter((x) => x != null && Number.isFinite(x));
const q = (a, p = 0.5) => { a = fin(a).sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const sd = (a) => { a = fin(a); if (a.length < 2) return NaN; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const mean = (a) => { a = fin(a); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const binom = (b, c) => { const n = b + c; if (!n) return 1; const k = Math.min(b, c); let p = 0, C = 1; for (let i = 0; i <= k; i++) { if (i > 0) C = C * (n - i + 1) / i; p += C; } return Math.min(1, 2 * p / 2 ** n); };
const has = (n, k) => SD.every((s) => existsSync(`${O}/${n}/${k}_${s}.json`));
const rowsOf = (n, k) => SD.flatMap((s) => { const a = J(`${O}/${n}/${k}_${s}.json`); return (a.rows ?? a).map((r) => ({ ...r, blk: s })); });
const band = (v, lo, hi, s) => (v >= lo && v <= hi ? '넘음' : (Math.min(Math.abs(v - lo), Math.abs(v - hi)) < s ? '금 위 (차 < 판 사이 표준편차)' : '못 넘음'));

// ── 1. 런지 거리 장면 (걸어 들어와 선 자세 · 나란한 자세는 읽기)
for (const [k, name] of [['scene_w', '걸어 들어와 선 자세 (판정)'], ['scene_p', '태어난 나란한 자세 (읽기)']]) {
  if (!has('base', k) || !has('new', k)) { console.log(`■ 런지 장면 · ${name}: 아직 없음\n`); continue; }
  const B = rowsOf('base', k), N = rowsOf('new', k);
  console.log(`■ 런지 장면 · ${name} — 씨앗 ${SD.join(' · ')} (칸마다 40 판) · 바탕 → 새`);
  console.log('| 무기 | 팔 닿음 넘어 m | 맞음 (묶음마다) | 무게중심 최고 앞 m/s 가운데 (판 사이 표준편차) | 무게중심 ÷ 칼 든 손 | 뒷다리 수평 밀기 ÷ 몸무게 | 첫 움직임 → 맞음 s 가운데 | 맞닿는 빠르기 m/s | 넘어짐 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const W of WS) for (const add of [0, 0.15, 0.3, 0.45]) { const b = B.filter((r) => r.W === W && r.add === add), n = N.filter((r) => r.W === W && r.add === add); if (!b.length && !n.length) continue;
    const h = (R) => `${R.filter((r) => r.hit).length} / ${R.length} (${SD.map((s) => R.filter((r) => r.blk === s && r.hit).length).join(' · ')})`;
    const c = (g, d = 2, hitOnly = false) => `${f(q((hitOnly ? b.filter((r) => r.hit) : b).map(g)), d)} → ${f(q((hitOnly ? n.filter((r) => r.hit) : n).map(g)), d)}`;
    console.log(`| ${KO[W]} | +${add} | ${h(b)} → ${h(n)} | ${c((r) => r.comPk)} (${f(sd(b.map((r) => r.comPk)))} → ${f(sd(n.map((r) => r.comPk)))}) | ${c((r) => r.comRatio)} | ${c((r) => r.pushAct)} | ${c((r) => r.tHit, 3, true)} | ${c((r) => r.vHit, 2, true)} | ${b.filter((r) => r.fell).length} → ${n.filter((r) => r.fell).length} |`); }
  // 가까운 칸(+0 · +0.15)의 줄이 바탕과 같은가
  for (const W of WS) { const key = (r) => JSON.stringify({ ...r, blk: 0 }); const b = B.filter((r) => r.W === W && r.add < 0.2), n = N.filter((r) => r.W === W && r.add < 0.2); let same = 0; for (let i = 0; i < Math.min(b.length, n.length); i++) if (key(b[i]) === key(n[i])) same++;
    console.log(`  가까운 칸(+0 · +0.15) ${KO[W]}: 줄 ${b.length} 가운데 바탕과 글자까지 같은 줄 ${same}`); }
  if (k === 'scene_w') { console.log('  판정 (새 칸 · 걸어 들어와 선 자세):');
    for (const W of WS) { const n45 = N.filter((r) => r.W === W && r.add === 0.45), s = sd(n45.map((r) => r.comPk)); const v1 = q(n45.map((r) => r.comPk)), v2 = q(n45.map((r) => r.comRatio)), v3 = q(n45.map((r) => r.pushAct)), v4 = q(n45.filter((r) => r.hit).map((r) => r.tHit));
      console.log(`   ${KO[W]} +0.45 — R1 무게중심 최고 ${f(v1)} (금 1.5 ~ 2.6 · 판 사이 표준편차 ${f(s)}): ${band(v1, 1.5, 2.6, s)} · R2 ÷ 손 ${f(v2)} (0.45 ~ 0.75 · 표준편차 ${f(sd(n45.map((r) => r.comRatio)))}): ${band(v2, 0.45, 0.75, sd(n45.map((r) => r.comRatio)))} · R3 밀기 ${f(v3)} (0.56 ~ 1.04 · 표준편차 ${f(sd(n45.map((r) => r.pushAct)))}): ${band(v3, 0.56, 1.04, sd(n45.map((r) => r.pushAct)))} · R4 첫 움직임 → 맞음 ${f(v4, 3)} (0.43 ~ 0.84 · 표준편차 ${f(sd(n45.filter((r) => r.hit).map((r) => r.tHit)), 3)}): ${Number.isFinite(v4) ? band(v4, 0.43, 0.84, sd(n45.filter((r) => r.hit).map((r) => r.tHit))) : '맞음 없음'}`);
      for (const add of [0.3, 0.45]) { const n = N.filter((r) => r.W === W && r.add === add), b = B.filter((r) => r.W === W && r.add === add), h = n.filter((r) => r.hit).length; console.log(`   ${KO[W]} +${add} — R5 맞음 ${h} / ${n.length} = ${f(100 * h / n.length, 0)} % (금 80 % · 바탕 ${b.filter((r) => r.hit).length}): ${h / n.length >= 0.8 ? '넘음' : '못 넘음'}`); } } }
  console.log('');
}

// ── 2. 받기와 돌아옴 (R9)
if (has('base', 'rec') && has('new', 'rec')) { const B = rowsOf('base', 'rec'), N = rowsOf('new', 'rec');
  console.log('■ 받기와 돌아옴 (R9) — 걸어 들어와 선 자세 · 칸마다 40 판 · 바탕 → 새');
  console.log('| 무기 | 넘어 m | 런지 걸음이 나온 판 | 넘어짐 | 앞발 미끄러짐 가운데 m · 0.05 m 안 판 | 1.2 s 안 자세로 돌아온 판 | 몸통이 상대 몸에 닿은 스텝 합 |'); console.log('|---|---|---|---|---|---|---|');
  for (const W of WS) for (const add of [0.3, 0.45]) { const c = (R) => { R = R.filter((r) => r.W === W && r.add === add); const L = R.filter((r) => r.land != null); return { n: R.length, land: L.length, fell: R.filter((r) => r.fell).length, slip: q(L.map((r) => r.slip)), slipOk: L.filter((r) => r.slip <= 0.05).length, rec: L.filter((r) => r.tRec != null && r.tRec <= 1.2).length, touch: R.reduce((a, r) => a + (r.touch || 0), 0) }; }; const b = c(B), n = c(N);
    console.log(`| ${KO[W]} | +${add} | ${b.land} → ${n.land} / ${n.n} | ${b.fell} → ${n.fell} | ${f(b.slip, 3)} · ${b.slipOk} → ${f(n.slip, 3)} · ${n.slipOk} | ${b.rec} → ${n.rec} (${f(100 * n.rec / Math.max(1, n.land), 0)} % · 금 90 %) | ${b.touch} → ${n.touch} |`); }
  console.log('');
}

// ── 3. 연달아 누르기 · 런지 중 물러남 입력 (R7 사람 길)
if (has('base', 'feel') && has('new', 'feel')) { const B = rowsOf('base', 'feel'), N = rowsOf('new', 'feel');
  console.log('■ 연달아 누르기(dbl) · 런지 중 물러남 입력(back) — 칸마다 40 판 · 바탕 → 새'); console.log('| 갈래 | 무기 | 넘어 m | 맞음 | 넘어짐 (새 칸의 씨앗) |'); console.log('|---|---|---|---|---|');
  for (const mode of ['dbl', 'back']) for (const W of WS) for (const add of [0.3, 0.45]) { const b = B.filter((r) => r.mode === mode && r.W === W && r.add === add), n = N.filter((r) => r.mode === mode && r.W === W && r.add === add);
    console.log(`| ${mode} | ${KO[W]} | +${add} | ${b.filter((r) => r.hit).length} → ${n.filter((r) => r.hit).length} / ${n.length} | ${b.filter((r) => r.fell).length} → ${n.filter((r) => r.fell).length} ${n.filter((r) => r.fell).map((r) => r.seed).join(' ')} |`); }
  console.log('');
}

// ── 4. 정직 심판 (R8): 한도를 넘는 표본 몫 · 골반 밖 토크(driveAid) 쓰임
if (has('base', 'hon') && has('new', 'hon')) { const B = rowsOf('base', 'hon'), N = rowsOf('new', 'hon');
  const over = (s) => s?.legOver?.share ?? s?.over?.share ?? s?.overShare ?? null; // 요약 꼴에 따라 (아래에서 못 찾으면 '-' — 그때는 요약 키를 찍음)
  console.log('■ 정직 심판 (R8) — 걸어 들어와 선 자세 · 칸마다 20 판 · 탭 뒤 1.5 s · 바탕 → 새');
  console.log('| 무기 | 넘어 m | 골반 밖 토크 평균 N·m | 걸린 스텝 몫 % | 스텝 최고 N·m | yaw 평균 · 기울기 평균 |'); console.log('|---|---|---|---|---|---|');
  for (const W of WS) for (const add of [0.3, 0.45]) { const a = (R) => R.filter((r) => r.W === W && r.add === add).map((r) => r.sum?.aid).filter(Boolean); const b = a(B), n = a(N); const c = (g, d = 1) => `${f(mean(b.map(g)), d)} → ${f(mean(n.map(g)), d)}`;
    console.log(`| ${KO[W]} | +${add} | ${c((x) => x.torqueRate)} | ${c((x) => 100 * x.stepShare, 0)} | ${f(Math.max(...b.map((x) => x.peakNm)), 0)} → ${f(Math.max(...n.map((x) => x.peakNm)), 0)} | ${c((x) => x.yaw?.avg)} · ${c((x) => x.tilt?.avg)} |`); }
  void over; const LEG = ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
  // 다리 여섯 관절의 전달(운동량) 토크가 한도를 넘는 표본 몫 — 관절 · 판을 재어진 몫(measCover)으로 무게 줘 합침 (짓기 2 와 같은 셈) · 금 0.26 %
  const ov = (R, W) => { let a = 0, c = 0; const top = {}; for (const r of R.filter((x) => x.W === W)) for (const k of LEG) { const j = r.sum?.joints?.[k]; if (!j) continue; a += (j.measOverShare ?? 0) * (j.measCover ?? 0); c += j.measCover ?? 0; (top[k] ??= []).push(j.measOverShare ?? 0); } const worst = Object.entries(top).map(([k, v]) => [k, mean(v)]).sort((x, y) => y[1] - x[1])[0]; return { share: c ? 100 * a / c : NaN, worst }; };
  for (const W of WS) { const b = ov(B, W), n = ov(N, W); console.log(`  ${KO[W]} — 다리 전달 토크가 한도를 넘는 표본 몫: ${f(b.share, 3)} % → ${f(n.share, 3)} % (금 0.26 %): ${n.share <= 0.26 ? '넘음' : '못 넘음'} · 가장 큰 관절 ${b.worst?.[0]} ${f(100 * (b.worst?.[1] ?? NaN), 1)} % → ${n.worst?.[0]} ${f(100 * (n.worst?.[1] ?? NaN), 1)} %`); }
  console.log('');
}

// ── 5. 관문 다섯 묶음 (R6 가까운 찌르기 · R7 넘어짐 · R10 다른 움직임) — 바탕 GB · 새 O/new
if (GB && BL.every((b) => existsSync(`${O}/new/gate_${b}.json`))) {
  const gb = BL.map((b) => J(`${GB}/gate_${b}.json`)), gn = BL.map((b) => J(`${O}/new/gate_${b}.json`));
  console.log('■ 관문 다섯 묶음 — 사람 길 (짝 = 묶음 · 무기 · 줄 차례) · 바탕 → 새');
  console.log('| 장면 | 무기 | 줄 | 글자까지 같은 줄 | 맞음 | 바탕만 · 새만 · 양쪽 p | 첫 움직임 → 맞음 가운데 s | 골반 최고 가운데 m/s | 넘어짐 |'); console.log('|---|---|---|---|---|---|---|---|---|');
  for (const sc of ['near', 'far', 'cut']) for (const W of WS) { let N = 0, same = 0, hb = 0, hn = 0, ob = 0, on = 0, fb = 0, fn = 0, odd = ''; const tb = [], tn = [], pb = [], pn = [];
    for (let i = 0; i < BL.length; i++) { const sel = (g) => g.rows.filter((r) => r.path === 'human' && r.scene === sc && r.weapon === W); const b = sel(gb[i]), n = sel(gn[i]); if (b.length !== n.length) odd = ' (줄 수 다름)';
      for (let k = 0; k < Math.min(b.length, n.length); k++) { const x = b[k], y = n[k]; if (x.seed !== y.seed) { odd = ' (씨앗 어긋남)'; break; } N++; if (JSON.stringify(x) === JSON.stringify(y)) same++; hb += x.hit ? 1 : 0; hn += y.hit ? 1 : 0; if (x.hit && !y.hit) ob++; if (!x.hit && y.hit) on++; fb += x.fell ? 1 : 0; fn += y.fell ? 1 : 0; if (x.hit) tb.push(x.tHit); if (y.hit) tn.push(y.tHit); pb.push(x.pelPk); pn.push(y.pelPk); } }
    if (!N) continue; console.log(`| ${sc} | ${KO[W]} | ${N}${odd} | ${same} | ${hb} → ${hn} | ${ob} · ${on} · ${f(binom(ob, on), 3)} | ${f(q(tb), 3)} → ${f(q(tn), 3)} | ${f(q(pb))} → ${f(q(pn))} | ${fb} → ${fn} |`); }
  console.log('\n  관문 줄 판정 (사람 · AI) 바탕 → 새 — 달라진 줄만:');
  for (let i = 0; i < BL.length; i++) for (const lb of gb[i].lines) { const ln = gn[i].lines.find((l) => l.id === lb.id && l.weapon === lb.weapon && l.path === lb.path && l.name === lb.name); if (!ln) continue; if (lb.verdict !== ln.verdict || Math.abs((lb.med ?? 0) - (ln.med ?? 0)) > 1e-9) console.log(`   ${BL[i]} ${lb.id} ${lb.weapon ?? ''} ${lb.path ?? ''}: ${f(lb.med, 3)} (${lb.verdict}) → ${f(ln.med, 3)} (${ln.verdict}) · n ${lb.n} → ${ln.n}`); }
  console.log('');
} else console.log('■ 관문 다섯 묶음: 아직 없음\n');

// ── 6. AI 찌르기 (R12 읽기)
for (const n of ['base', 'new']) if (existsSync(`${O}/${n}/aifar.txt`)) console.log(`■ AI 대 AI 탭 (R12 읽기) — ${n}\n${readFileSync(`${O}/${n}/aifar.txt`, 'utf8').split('\n').filter((l) => l.includes('|') || l.startsWith('AI')).join('\n')}\n`);
