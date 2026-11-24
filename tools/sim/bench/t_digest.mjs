// t_digest.mjs — out/main.json(t_main 이 만든 것)에서 짧은 표를 뽑는다: 에너지가 어디서 오나 · 마디 차례 · 한도에 닿은 시간 · 땅 · 받침 · 에너지 잔차. 시뮬레이션은 안 돌린다(1 초).
//   node t_digest.mjs        (먼저 node t_main.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, fmt, DEG } from './lib.mjs';
const { cells } = JSON.parse(readFileSync(join(HERE, 'out/main.json'), 'utf8'));
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', uchigatana: '우치가타나', rapier: '레이피어' };
const sN = { i: '(i) 끝점 힘', ii: '(ii) 차례', iii: '(iii) 게임 꼴' };
const L = []; const P = (x) => L.push(x);
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const rng = (a, d = 0) => { const b = a.filter(Number.isFinite); return b.length ? `${fmt(Math.min(...b), d)} ~ ${fmt(Math.max(...b), d)}` : '–'; };
const W = ['longsword', 'zweihander', 'uchigatana', 'rapier'], SZ = ['small', 'large'];
const sel = (f) => cells.filter(f);

// ── E: 에너지가 어디서 오나 (일의 몫) ──
P('# 표 E — 에너지가 어디서 오나: 시작 → 겨눈 선까지 근육 · 땅이 한 일 (땅 135 N·m · 세 획 가운데값). 몫 % = 그 일 ÷ 일의 합. 칼날 빠르기의 마디별 몫(표 K · 운동학)과 다른 물음이다 — 이 표는 에너지의 출처');
P('무기 | 감기 | 방식 | 일의 합 J | 땅 yaw % | 몸통(허리 + 등) % | 두 어깨 % | 두 팔꿈치 % | 손목 % | 목 % | 칼 KE ÷ 일의 합 | 역학 에너지 변화 J | 잔차 J (세 획 범위)');
P('---|---|---|---|---|---|---|---|---|---|---|---|---');
for (const w of W) for (const sz of SZ) for (const st of ['i', 'ii']) {
  const cs = sel((c) => c.weapon === w && c.size === sz && c.style === st && c.yawCap === 135);
  const sh = (f) => med(cs.map((c) => (100 * f(c.work)) / c.Wsum));
  P(`${KO[w]} | ${sz === 'small' ? '작게' : '크게'} | ${sN[st]} | ${fmt(med(cs.map((c) => c.Wsum)), 0)} | ${fmt(sh((x) => x.ground), 0)} | ${fmt(sh((x) => x.waist + x.back), 0)} | ${fmt(sh((x) => x.shS + x.shO), 0)} | ${fmt(sh((x) => x.elS + x.elO), 0)} | ${fmt(sh((x) => x.wr), 0)} | ${fmt(sh((x) => x.neck), 0)} | ${fmt(med(cs.map((c) => c.keS / c.Wsum)), 2)} | ${fmt(med(cs.map((c) => c.dE)), 0)} | ${rng(cs.map((c) => c.resid), 1)}`);
}
// ── 잔차 전체 ──
const all = sel((c) => c.style !== 'iii');
const rp = all.map((c) => (100 * c.resid) / Math.max(1, Math.abs(c.Wsum)));
P(''); P(`# 에너지 맞춤 (방식 (i) · (ii) 모든 칸 ${all.length} 개 · 시작 → 겨눈 선): 잔차 = 역학 에너지 변화 − (근육 일 + 땅 일). 받침은 일을 하지 않는다(자리 · 기울기 고정 · yaw 축은 토크 0).`);
P(`#  잔차 J: 가운데값 ${fmt(med(all.map((c) => c.resid)), 2)} · 범위 ${rng(all.map((c) => c.resid), 1)} · 일의 합에 견줘 % 가운데값 ${fmt(med(rp), 1)} · 범위 ${rng(rp, 1)} · |잔차| > 5 % 인 칸 ${rp.filter((x) => Math.abs(x) > 5).length} 개 · > 10 % 인 칸 ${rp.filter((x) => Math.abs(x) > 10).length} 개 (음수 = 엔진 관절 한도 · 밧줄에 부딪혀 잃은 것)`);

// ── O: 차례 · 때 ──
P(''); P('# 표 O — 최고 각속도의 차례와 때 (땅 135 · 세 획 가운데값). 앞선 ms = 그 관절(마디)의 최고 각속도가 칼날 70 % 최고보다 앞선 시간. 사람 자료(던지기 · 치기): 골반 → 윗몸 → 팔 → 손 · 야구 치기 골반 714 °/s · 윗몸 937 °/s');
P('무기 | 감기 | 방식 | 관절 차례 지킨 획 | 세계 틀 마디 차례 지킨 획 | 앞선 ms: 골반 yaw · 몸통 비틀림 · 어깨 · 팔꿈치 · 손목 | 최고 °/s: 골반 yaw · 몸통 비틀림 · 어깨 · 팔꿈치 · 손목 | 손이 칼날보다 먼저 느려진 획 | 칼날 몫 %: 골반 + 몸통 · 어깨 · 팔꿈치 · 손목');
P('---|---|---|---|---|---|---|---|---');
for (const w of W) for (const sz of SZ) for (const st of ['i', 'ii', 'iii']) {
  const cs = sel((c) => c.weapon === w && c.size === sz && c.style === st && c.yawCap === (st === 'iii' ? 100 : 135));
  const K = ['pelYaw', 'trunkTwist', 'shoulder', 'elbow', 'wrist'];
  P(`${KO[w]} | ${sz === 'small' ? '작게' : '크게'} | ${sN[st]} | ${cs.filter((c) => c.order).length}/${cs.length} | ${cs.filter((c) => c.orderW).length}/${cs.length} | ${K.map((k) => fmt(med(cs.map((c) => c.om[k].lead)), 0)).join(' · ')} | ${K.map((k) => fmt(med(cs.map((c) => c.om[k].v / DEG)), 0)).join(' · ')} | ${cs.filter((c) => c.handFirst).length}/${cs.length} | ${fmt(100 * med(cs.map((c) => c.trunkShare)), 0)} · ${fmt(100 * med(cs.map((c) => c.share.shoulder)), 0)} · ${fmt(100 * med(cs.map((c) => c.share.elbow)), 0)} · ${fmt(100 * med(cs.map((c) => c.share.wrist)), 0)}`);
}
const chk = cells.map((c) => c.share.check);
P(`# 몫의 합 검산 (모든 칸 ${cells.length} 개): ${fmt(Math.min(...chk), 3)} ~ ${fmt(Math.max(...chk), 3)} (1 이어야 함)`);

// ── L: 한도에 닿은 시간 ──
P(''); P('# 표 L — 한도에 닿은 시간 % (시작 → 겨눈 선 · 땅 135 · 세 획 가운데값) · 괄호 = 건 토크 최고 N·m. 등척 한도: 몸통 축 105 · 휨 250 · 어깨 85(+ 비틀기 50) · 팔꿈치 63 / 53 · 손목 두 손 24.4 / 한 손 12.2 · 버티는 쪽 × 1.2');
P('무기 | 감기 | 방식 | 땅 | 허리 | 등 | 칼 어깨 | 칼 팔꿈치 | 손목 | 빈 어깨 | 빈 팔꿈치');
P('---|---|---|---|---|---|---|---|---|---|---');
for (const w of W) for (const sz of SZ) for (const st of ['i', 'ii']) {
  const cs = sel((c) => c.weapon === w && c.size === sz && c.style === st && c.yawCap === 135);
  const f = (j) => `${fmt(100 * med(cs.map((c) => c.sat[j])), 0)} (${fmt(med(cs.map((c) => c.peakTau[j])), 0)})`;
  P(`${KO[w]} | ${sz === 'small' ? '작게' : '크게'} | ${sN[st]} | ${f('ground')} | ${f('waist')} | ${f('back')} | ${f('shS')} | ${f('elS')} | ${f('wr')} | ${f('shO')} | ${f('elO')}`);
}
P('# (iii) 게임 꼴: 손목 서보가 상한에 붙은 스텝 % (세 획 가운데값) — ' + W.map((w) => `${KO[w]} 작게 ${fmt(100 * med(sel((c) => c.weapon === w && c.size === 'small' && c.style === 'iii' && c.yawCap === 100).map((c) => c.sat.wr)), 0)}`).join(' · '));

// ── G: 땅 · 받침 ──
P(''); P('# 표 G — 땅에서 가져온 것과 다리가 대야 하는 것 (롱소드 · 빗겨 + 가로 두 획의 평균 · 겨눈 선까지). 땅 yaw 각충격 = ∫ 땅 토크 dt = 몸이 얻은 수직축 각운동량 · 받침 = 골반 자리 · 기울기를 잡은 고정 장치가 준 힘 · 모멘트(다리 몫) 95 % 값');
P('#  주의: 받침 힘 · 모멘트에는 몸통 휨 버팀의 떨림(스텝마다 뒤집힘 — NOTES.md)이 섞여 크게 읽힌다. 차수만 믿을 것');
P('감기 | 방식 | 땅 예산 N·m | 칼날 70 % m/s | 칼 KE J | 땅 yaw 각충격 N·m·s | 땅이 한 일 J | 땅 한도에 닿은 시간 % | 골반 / 가슴이 돈 폭 ° | 받침 수평 힘 95 % N | 받침 기울기 모멘트 95 % N·m | 받침 수직 힘 5 ~ 95 % N (윗몸 무게 515)');
P('---|---|---|---|---|---|---|---|---|---|---|---');
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
for (const sz of SZ) for (const st of ['i', 'ii', 'iii']) for (const cap of [60, 100, 135, 180]) {
  const cs = sel((c) => c.weapon === 'longsword' && c.size === sz && c.style === st && c.yawCap === cap && c.fam !== 'vert'); if (!cs.length) continue;
  P(`${sz === 'small' ? '작게' : '크게'} | ${sN[st]} | ${cap} | ${fmt(avg(cs.map((c) => c.v70)))} | ${fmt(avg(cs.map((c) => c.keS)), 0)} | ${fmt(avg(cs.map((c) => c.impG)), 1)} | ${st === 'iii' ? '–' : fmt(avg(cs.map((c) => c.work.ground)), 0)} | ${fmt(100 * avg(cs.map((c) => c.sat.ground)), 0)} | ${fmt(avg(cs.map((c) => c.rngPel)), 0)} / ${fmt(avg(cs.map((c) => c.rngCh)), 0)} | ${fmt(avg(cs.map((c) => c.fix.fh95)), 0)} | ${fmt(avg(cs.map((c) => c.fix.mt95)), 0)} | ${fmt(avg(cs.map((c) => c.fix.fv05)), 0)} ~ ${fmt(avg(cs.map((c) => c.fix.fv95)), 0)}`);
}
// ── H: 사람 값과 견줌 ──
P(''); P('# 표 H — 사람 자료 옆에 놓기 (땅 135 · (iii) 은 닻 100 · 세 획 범위). 칼끝 빠르기와 칼 각속도(칼날 축에 수직인 몫 · 세계 틀) 둘 다 — 벤치는 실제 초');
P('#  사람: 롱소드 기술 연습 칼끝 9 ~ 14 m/s(최고의 평균 11.1 · Merkert 2019 — 1.9 kg 칼 · 짝 연습 · 몸 옮김을 뺀 셈이라 아래쪽 값) · 사브르 정상급 칼끝 17.5 ~ 19.5 · 방망이 · 골프채 · 라켓 약 30 m/s');
P('#  사람 칼 각속도: 1000 ~ 2000 °/s (한 사람의 영상 · 1.2 kg 칼 · 동료 평가 아님 — Renk 2025). 게임에서 잰 값(게임 초 · 화면에서는 × 1.1): 롱소드 칼끝 17 ~ 18 m/s · 각속도 약 700 ~ 770 °/s · 우치가타나 930 ~ 1250 °/s');
P('무기 | 감기 | 방식 | 칼끝 최고 m/s | 칼 각속도 최고 °/s | 칼날 70 % m/s | 칼 KE J | 시작 → 겨눈 선 ms | 겨눈 선 벗어남 m');
P('---|---|---|---|---|---|---|---|---');
for (const w of W) for (const sz of SZ) for (const st of ['i', 'ii', 'iii']) {
  const cs = sel((c) => c.weapon === w && c.size === sz && c.style === st && c.yawCap === (st === 'iii' ? 100 : 135));
  P(`${KO[w]} | ${sz === 'small' ? '작게' : '크게'} | ${sN[st]} | ${rng(cs.map((c) => c.tip), 1)} | ${rng(cs.map((c) => c.om.swordW.v / DEG), 0)} | ${rng(cs.map((c) => c.v70), 1)} | ${rng(cs.map((c) => c.keS), 0)} | ${rng(cs.map((c) => (c.tCross ? c.tCross * 1000 : NaN)), 0)}${cs.some((c) => !c.tCross) ? ` (못 넘은 획 ${cs.filter((c) => !c.tCross).length})` : ''} | ${rng(cs.map((c) => (c.cross ? c.cross.dev : NaN)), 2)}`);
}
writeFileSync(join(HERE, 'out/digest.txt'), L.join('\n') + '\n'); console.log(L.join('\n'));
