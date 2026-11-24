// t_main.mjs — 큰 표: 무기 넷 × 획 셋 × 방식 셋 × 땅 yaw 예산 넷 × 감기 둘. 결정적(같은 명령 = 같은 표).
//   node t_main.mjs [--weapons=longsword,...] [--caps=60,100,135,180] [--out=out/main]
//   (ii) 는 칸마다 켜지는 때를 찾는다(152 번) — 전체 약 6 분.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, args, fmt, DEG, WEAPONS } from './lib.mjs';
import { runCut, FAMS } from './cuts.mjs';
import { runGame } from './game.mjs';
import { searchII, gainsI, score } from './tune.mjs';
const R = await loadRapier();
const weapons = String(args.weapons ?? 'longsword,zweihander,uchigatana,rapier').split(',');
const caps = String(args.caps ?? '60,100,135,180').split(',').map(Number);
const fams = String(args.fams ?? 'diag,vert,horiz').split(',');
const sizes = String(args.sizes ?? 'small,large').split(',');
const styles = String(args.styles ?? 'i,ii,iii').split(',');
const outBase = join(HERE, String(args.out ?? 'out/main'));
const GI = gainsI();
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', uchigatana: '우치가타나', rapier: '레이피어' };
const slim = (s, extra) => ({ ...extra, v70: s.v70, tPk: s.tPk, tip: s.tip, keS: s.keS, hand: s.hand, share: s.share, trunkShare: s.trunkShare, om: s.om, lead: s.lead, order: s.order, orderW: s.orderW, leadW: s.leadW, workPk: s.workPk, WsumPk: s.WsumPk, residPk: s.residPk, impGpk: s.impGpk, handFirst: s.handFirst, tCross: s.tCross, cross: s.cross, work: s.work, Wsum: s.Wsum, dE: s.dE, resid: s.resid, impG: s.impG, sat: s.sat, peakTau: s.peakTau, fix: s.fix, gapMax: s.gapMax, rngPel: s.rngPel, rngCh: s.rngCh, stop: s.stop, bad: s.bad });
const out = []; const t0 = Date.now();
for (const weapon of weapons) for (const size of sizes) for (const fam of fams) for (const style of styles) for (const yawCap of caps) {
  const base = { weapon, fam, size, yawCap };
  let s, extra = { ...base, style, twoHand: WEAPONS[weapon].twoHand };
  if (style === 'i') s = runCut(R, { ...base, style: 'i', ...GI }).sum;
  else if (style === 'ii') { const b = searchII(R, base); s = runCut(R, { ...base, style: 'ii', tSh: b.tSh, tEl: b.tEl, tWr: b.tWr }).sum; extra.delays = [b.tSh, b.tEl, b.tWr]; }
  else s = runGame(R, base).sum;
  out.push(slim(s, extra));
  process.stderr.write(`\r${out.length} 칸 · ${fmt((Date.now() - t0) / 1000, 0)} s   `);
}
process.stderr.write('\n');
writeFileSync(outBase + '.json', JSON.stringify({ gainsI: GI, cells: out }));
// ── 표 A: 칸마다 한 줄 ──
const L = [];
const P = (x) => L.push(x);
const sN = { i: '(i) 끝점 힘', ii: '(ii) 차례', iii: '(iii) 게임 꼴' };
P(`# 표 A — 칼날 70 % 최고 · 칼끝 최고 · 칼 운동 에너지(최고 순간) · 겨눈 선 (시작 → 넘는 때 ms · 그때 칼날 70 % m/s · 벗어남 m) · 몸통 몫 % · 차례 지킴 · 땅 yaw 각충격(겨눈 선까지 N·m·s) · 골반 / 가슴이 돈 폭 °`);
P(`# (i) 이득 한 벌: ${JSON.stringify(GI)} · (ii) 는 칸마다 찾은 켜지는 때 ms(어깨/팔꿈치/손목 풀림)`);
P('무기 | 감기 | 획 | 방식 | 땅 | 칼날70 | 칼끝 | KE J | 선까지 ms | 선에서 m/s | 벗어남 m | 몸통 % | 차례 | 땅 각충격 | 골반°/가슴° | 비고');
P('---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---');
for (const c of out) {
  const note = [c.delays ? `때 ${c.delays.map((x) => fmt(x * 1000, 0)).join('/')}` : '', c.style !== 'iii' && c.resid < -0.05 * Math.max(1, c.Wsum) ? `관절 끝 손실 ${fmt(-c.resid, 0)} J` : '', c.style === 'iii' && c.gapMax > 0.25 ? `빈손 놓침 ${fmt(c.gapMax, 2)} m` : '', c.bad ? '터짐' : ''].filter(Boolean).join(' · ');
  P(`${KO[c.weapon]} | ${c.size === 'small' ? '작게' : '크게'} | ${FAMS[c.fam].ko} | ${c.style} | ${c.yawCap} | ${fmt(c.v70)} | ${fmt(c.tip)} | ${fmt(c.keS, 0)} | ${c.tCross ? fmt(c.tCross * 1000, 0) : '못 넘음'} | ${c.cross ? fmt(c.cross.v70) : '–'} | ${c.cross ? fmt(c.cross.dev, 2) : '–'} | ${fmt(100 * c.trunkShare, 0)} | ${c.order ? '○' : '×'} | ${fmt(c.impG, 1)} | ${fmt(c.rngPel, 0)}/${fmt(c.rngCh, 0)} | ${note}`);
}
// ── 표 K: 무기 × 방식 (세 획 가운데값) ──
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const rng = (a, d = 1) => { const b = a.filter(Number.isFinite); return b.length ? `${fmt(Math.min(...b), d)} ~ ${fmt(Math.max(...b), d)}` : '–'; };
for (const capK of caps.includes(135) ? [135] : [caps[0]]) {
  P(''); P(`# 표 K — 무기 × 방식 (땅 ${capK} N·m · 세 획의 가운데값 [범위]) : 칼날 70 % · 칼끝 · 칼 KE · 몸통 몫 · 차례 지킨 획 수 · 땅 yaw 각충격(빗겨 · 가로 가운데값) · 겨눈 선 벗어남`);
  P('무기 | 감기 | 방식 | 칼날 70 % m/s | 칼끝 m/s | 칼 KE J | 몸통 몫 % | 차례 | 손이 먼저 | 땅 각충격 N·m·s | 벗어남 m');
  P('---|---|---|---|---|---|---|---|---|---|---');
  for (const weapon of weapons) for (const size of sizes) for (const style of styles) {
    const cs = out.filter((c) => c.weapon === weapon && c.size === size && c.style === style && c.yawCap === capK); if (!cs.length) continue;
    const yawCs = cs.filter((c) => c.fam !== 'vert');
    P(`${KO[weapon]} | ${size === 'small' ? '작게' : '크게'} | ${sN[style]} | ${fmt(med(cs.map((c) => c.v70)))} [${rng(cs.map((c) => c.v70))}] | ${fmt(med(cs.map((c) => c.tip)))} [${rng(cs.map((c) => c.tip))}] | ${fmt(med(cs.map((c) => c.keS)), 0)} [${rng(cs.map((c) => c.keS), 0)}] | ${fmt(100 * med(cs.map((c) => c.trunkShare)), 0)} [${rng(cs.map((c) => 100 * c.trunkShare), 0)}] | ${cs.filter((c) => c.order).length}/${cs.length} | ${cs.filter((c) => c.handFirst).length}/${cs.length} | ${fmt(med(yawCs.map((c) => c.impG)), 1)} | ${rng(cs.map((c) => (c.cross ? c.cross.dev : NaN)), 2)}`);
  }
}
// ── 표 Y: 땅 예산에 따른 값 (롱소드 · 크게) ──
P(''); P('# 표 Y — 땅 yaw 예산에 따른 칼날 70 % 최고 m/s / 칼 KE J / 쓴 각충격 N·m·s (크게 감기)');
P('무기 | 획 | 방식 | ' + caps.map((c) => `땅 ${c}`).join(' | ')); P('---|---|---|' + caps.map(() => '---').join('|'));
for (const weapon of weapons) for (const fam of fams) for (const style of styles) {
  const cs = caps.map((cap) => out.find((c) => c.weapon === weapon && c.size === 'large' && c.fam === fam && c.style === style && c.yawCap === cap)); if (!cs[0]) continue;
  P(`${KO[weapon]} | ${FAMS[fam].ko} | ${style} | ` + cs.map((c) => `${fmt(c.v70)} / ${fmt(c.keS, 0)} / ${fmt(c.impG, 1)}`).join(' | '));
}
// ── 표 D: 칸마다 속 (땅 135) ──
const capD = caps.includes(135) ? 135 : caps[0];
P(''); P(`# 표 D — 속 (땅 ${capD} N·m). 몫 = 칼날 70 % 최고 순간 (tools/sim/chain_probe.mjs 와 같은 식 · 합 = 검산). 앞선 ms = 그 관절 최고 각속도가 칼날 최고보다 앞선 시간(− = 뒤). 일 = 시작 → 겨눈 선(못 넘으면 칼날 최고). (iii) 은 엔진 모터라 일 · 잔차를 못 잰다.`);
for (const c of out.filter((c) => c.yawCap === capD)) {
  const sh = c.share, o = c.om, w = c.work || {}, st = c.sat || {};
  P(`## ${KO[c.weapon]} · ${c.size === 'small' ? '작게' : '크게'} · ${FAMS[c.fam].ko} · ${sN[c.style]}${c.delays ? ` · 때 ${c.delays.map((x) => fmt(x * 1000, 0)).join('/')} ms` : ''}`);
  P(`  몫 %: 골반 돌림 ${fmt(100 * sh.pelRot, 0)} · 허리 ${fmt(100 * sh.waist, 0)} · 등 ${fmt(100 * sh.back, 0)} · 어깨 ${fmt(100 * sh.shoulder, 0)} · 팔꿈치 ${fmt(100 * sh.elbow, 0)} · 손목 ${fmt(100 * sh.wrist, 0)} (합 ${fmt(sh.check, 3)})`);
  P(`  최고 각속도 °/s (앞선 ms): 골반 yaw ${fmt(o.pelYaw.v / DEG, 0)} (${fmt(o.pelYaw.lead, 0)}) · 몸통 비틀림 ${fmt(o.trunkTwist.v / DEG, 0)} (${fmt(o.trunkTwist.lead, 0)}) · 어깨 ${fmt(o.shoulder.v / DEG, 0)} (${fmt(o.shoulder.lead, 0)}) · 팔꿈치 ${fmt(o.elbow.v / DEG, 0)} (${fmt(o.elbow.lead, 0)}) · 손목 ${fmt(o.wrist.v / DEG, 0)} (${fmt(o.wrist.lead, 0)}) → 차례 ${c.order ? '지킴' : '안 지킴'} | 세계 틀 마디(골반 → 가슴 → 위팔 → 아래팔 → 칼) 앞선 ms ${c.leadW.map((x) => fmt(x, 0)).join(' / ')} → ${c.orderW ? '지킴' : '안 지킴'} | 손 ${fmt(c.hand.v)} m/s (${fmt(c.hand.lead, 0)} ms ${c.handFirst ? '— 손이 먼저 느려짐' : '— 손이 칼날 뒤'})`);
  if (c.style !== 'iii') {
    P(`  일 J: 땅 ${fmt(w.ground, 1)} · 허리 ${fmt(w.waist, 1)} · 등 ${fmt(w.back, 1)} · 칼 어깨 ${fmt(w.shS, 1)} · 칼 팔꿈치 ${fmt(w.elS, 1)} · 손목 ${fmt(w.wr, 1)} · 빈 어깨 ${fmt(w.shO, 1)} · 빈 팔꿈치 ${fmt(w.elO, 1)} · 목 ${fmt(w.neck, 1)} | 합 ${fmt(c.Wsum, 1)} · 역학 에너지 변화 ${fmt(c.dE, 1)} · 잔차 ${fmt(c.resid, 2)} J (${fmt((100 * c.resid) / Math.max(1, Math.abs(c.Wsum)), 1)} %)`);
    P(`  한도에 닿은 시간 %: 땅 ${fmt(100 * st.ground, 0)} · 허리 ${fmt(100 * st.waist, 0)} · 등 ${fmt(100 * st.back, 0)} · 칼 어깨 ${fmt(100 * st.shS, 0)} · 칼 팔꿈치 ${fmt(100 * st.elS, 0)} · 손목 ${fmt(100 * st.wr, 0)} · 빈 어깨 ${fmt(100 * st.shO, 0)} · 빈 팔꿈치 ${fmt(100 * st.elO, 0)} | 토크 최고 N·m: 허리 ${fmt(c.peakTau.waist, 0)} · 등 ${fmt(c.peakTau.back, 0)} · 칼 어깨 ${fmt(c.peakTau.shS, 0)} · 칼 팔꿈치 ${fmt(c.peakTau.elS, 0)} · 손목 ${fmt(c.peakTau.wr, 0)} · 빈 어깨 ${fmt(c.peakTau.shO, 0)} · 빈 팔꿈치 ${fmt(c.peakTau.elO, 0)}`);
  } else P(`  손목 서보 포화 ${fmt(100 * st.wr, 0)} % 스텝 · 닻 yaw 상한에 걸린 스텝 ${fmt(100 * st.ground, 0)} % · 빈손–칼자루 벌어짐 최고 ${fmt(c.gapMax * 1000, 0)} mm`);
  P(`  땅 yaw 각충격 ${fmt(c.impG, 1)} N·m·s (겨눈 선까지) · 받침(다리가 대야 하는 것): 수평 힘 평균 ${fmt(c.fix.fhMean, 0)} · 95 % ${fmt(c.fix.fh95, 0)} · 최고 ${fmt(c.fix.fh, 0)} N · 수직 힘 5 ~ 95 % ${fmt(c.fix.fv05, 0)} ~ ${fmt(c.fix.fv95, 0)} N (윗몸 + 칼 무게 ${fmt(c.fix.weight, 0)}) · 기울기 모멘트 95 % ${fmt(c.fix.mt95, 0)} · 최고 ${fmt(c.fix.mt, 0)} N·m${c.stop ? ` | 벤 뒤: 칼날 70 % 가 2 m/s 아래로 ${c.stop.t != null ? fmt(c.stop.t * 1000, 0) + ' ms' : '안 내려감(끝까지)'} · 더 간 길 ${fmt(c.stop.dist, 2)} m · 그동안 땅 각충격 ${fmt(c.stop.impG, 1)} N·m·s · 받침 수평 힘 ${fmt(c.stop.fh, 0)} N · 기울기 ${fmt(c.stop.mt, 0)} N·m · 관절 끝이 받은 에너지 ${fmt(-c.stop.residEnd, 0)} J` : ''}`);
}
writeFileSync(outBase + '.txt', L.join('\n') + '\n');
console.log(L.join('\n'));
