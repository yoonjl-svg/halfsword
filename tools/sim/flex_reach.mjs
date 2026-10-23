// ─────────────────────────────────────────────────────────────
//  flex_reach.mjs — 휘는 무기(채찍)의 간격을 봇 손놀림으로 잰다 (10/23 — docs/import/druid_whip_2026-10-23.md §18). 물리 · 판정은 바꾸지 않는다(재기만).
//
//  왜 따로 재나: 간격 생성기(`weapon_measures.mjs --gen` — 분노의 베기 한 번 · 칼날 70 % 점이 머리 높이를 내려 지나는 가장 먼 앞 거리)는
//   휘는 무기를 바로 재지 못한다.
//   - reach: 베기 뒤 덩굴이 한 바퀴 돌아 0.9 s 쯤 머리 높이를 다시 내려 지난다. 생성기는 3 s 를 다 보고, 그동안 몸이 1 m 넘게 걸어 나가 그 둘째 바퀴를 센다
//     (테이퍼 6 : 1 채찍 생성 3.07 — 실제 덩굴 1.44 m 로 닿을 수 없는 거리).
//   - contact: 0.5 s 가만히 든 손에서 늘어진 덩굴을 한 번 휘두르는 판은 채찍의 가장 잘 나간 획 쪽이다. 단단한 칼은 획마다 거의 같아(롱소드 끝 앞 거리
//     가운데 1.64 · 위 10 % 1.67 m) 한 번이면 되지만, 채찍은 앞 획이 남긴 덩굴 상태와 긋는 쪽에 따라 획마다 크게 흩어진다(덩굴 끝 5 ~ 95 % 0.42 ~ 1.73 m).
//  그래서 사람(봇)이 실제로 휘두르는 대로 여러 번 잰다:
//   - 손놀림: whip_duel.mjs 봇과 같다 — 기본 베기 일곱(ai_techniques.js TECH 의 cut) · 시작 자리로 1.6 패드 m/s 감기 · 4 프레임 쥠 · 4 ~ 6 패드 m/s 긋기 · 손가락 뗌 ·
//     0.9 ~ 1.5 s 박자 · 플레이어 보정(SKILL.corr · autoGuard). 상대는 치운다(park — 칼 · 몸에 걸리지 않게).
//   - 판마다: 1 s 쉼 → 앞 획 --pre 개(무작위 긋기 — 덩굴이 싸움처럼 이미 움직이는 상태) → 잴 획(긋기 일곱 가운데 하나). 같은 판을 선 채 · 한 걸음(잴 획 동안
//     move.y 1 — 생성기 reach 와 같은 걸음)으로 두 번.
//   - 잴 값: 잴 획 시작 ~ 손가락 뗀 뒤 0.3 s 안에, 끝(t = 1 — 칼은 칼끝 · 채찍은 덩굴 끝)이 상대 몸 높이(--band, 기본 땅 ~ 머리 꼭대기 0 ~ 1.75 m)에 있을 때
//     획 시작 때 제 가슴에서 앞으로 간 가장 먼 거리. 채찍 판정은 팔 · 다리에 많아(봇 판정의 팔 42 % · 다리 30 %) 머리 높이만 보지 않는다 —
//     단단한 칼은 가장 먼 점이 늘 몸 높이라 띠와 상관없이 같다.
//   - 묶음: 획들의 가운데 값(반이 닿는 거리). 같은 실행의 롱소드 가운데 값에 대한 비율을 롱소드 손 값(weapon_measured.js — 1.57 / 1.8 / 1.25)에 붙인다
//     (간격표 10/21 줄들과 같은 '같은 실행 롱소드 비율' 규칙): contact = 1.57 × 선 채 비 · reach = 1.8 × 한 걸음 비 · clinch = 1.25 × 선 채 비.
//     베는 시간은 이 도구가 재지 않는다(생성기 첫 바퀴 값 — 간격표 채찍 줄 주석).
//   - 단단한 무기로 맞춰 봄: 같은 잣대로 잰 단단한 칼은 생성기(츠바이핸더는 손 표)보다 0 ~ 0.10 m 짧다(모르겐슈테른 · 세이버 · 레이피어 · 츠바이핸더 — 기록 §18-2). 걸음 몫은 이 손놀림에서 작다(획이 빨라 몸이 덜 나감).
//
//  node tools/sim/flex_reach.mjs [무기 id…(기본 druid_whip — 롱소드는 늘 맨 앞에 잼)] [--seeds=1-36] [--pre=2] [--band=0,1.75] [--json=파일]
//   덩굴 값을 바꿔 재려면 `node tools/sim/with_whip.mjs '{…}' flex_reach.mjs …` (이 도구는 WHIP 칸을 덮어쓰지 않는다)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { TECH } from '../../src/ai_techniques.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { isMain } from './is_main.mjs';

const CUTS = TECH.filter((t) => t.kind === 'cut');
const FRAME = 2 * DT; // 봇 손가락 프레임 (whip_duel.mjs 와 같음)
const AFTER = 0.3; // 손가락 뗀 뒤 더 보는 시간 (s) — 덩굴 끝이 늦게 터지는 몫. 다음 바퀴(0.9 s 쯤)는 넣지 않는다

/** 판 하나: 앞 획 pre 개 뒤 잴 획(cutIdx) 하나 — 끝 · 70 % 점이 간 가장 먼 앞 거리 */
export function strokeReach(wid, seed, cutIdx, { lunge = false, pre = 2, band = [0, 1.75] } = {}) {
  const G = newRound({ weapon: wid, weapon2: wid, seed });
  G.park();
  const P = G.player;
  P.skill.corr = CONFIG.SKILL.corr; P.skill.corrTip = CONFIG.SKILL.corrTip; P.skill.autoGuard = true;
  let rs = (seed * 7919 + cutIdx * 104729) >>> 0; // 선 채 · 한 걸음 판이 같은 앞 획을 쓴다
  const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  let fx = 0, fy = 0;
  const to = (p, v) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, v * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, true, 0]); } fx = x; fy = y; return fr; };
  const swipe = (b, v) => { const fr = to(b.from, 1.6); for (let i = 0; i < 4; i++) fr.push([0, 0, true, 0]); for (const p of b.path) fr.push(...to(p, v).map((f) => [f[0], f[1], true, 1])); fr.push([0, 0, false, 1]); return fr; };
  for (let t = 0; t < 1.0; t += DT) G.step();
  const plan = [];
  for (let i = 0; i < pre; i++) plan.push({ cut: CUTS[Math.floor(rnd() * CUTS.length)], v: 4 + rnd() * 2, gap: 0.9 + rnd() * 0.6 });
  plan.push({ cut: CUTS[cutIdx], v: 4 + rnd() * 2, gap: 0, measure: true });
  let step = 0, queue = [], next = 0, t = 0, cur = null;
  for (let i = 0; i < 12 / DT; i++) {
    if (!queue.length && plan.length && t >= next) {
      const p = plan.shift();
      fx = P.handOffset.x; fy = P.handOffset.y;
      queue = swipe(p.cut, p.v); next = t + p.gap;
      if (p.measure) cur = { start: null, end: null, tip: -Infinity, tTip: null, p70head: -Infinity };
    }
    if ((step++ & 1) === 0) {
      const f = queue.shift();
      if (f) {
        if (cur && f[3] === 1 && cur.start == null) { const c = P.bodies.chest.translation(), fw = P.forward(); cur.c = { x: c.x, z: c.z }; cur.f = { x: fw.x, z: fw.z }; cur.start = t; }
        P.handOffset.x += f[0]; P.handOffset.y += f[1]; P.handHeld = f[2]; P.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5;
        if (cur && !queue.length) cur.end = t;
      } else { P.handHeld = false; P.inputActive = false; fx = P.handOffset.x; fy = P.handOffset.y; }
    }
    P.move.set(0, lunge && cur?.start != null ? 1 : 0); P.stickX = 0; P.stickY = P.move.y;
    G.step(); t += DT;
    if (cur?.start == null) continue;
    if (cur.end != null && t > cur.end + AFTER) break;
    const fwd = (v) => (v.x - cur.c.x) * cur.f.x + (v.z - cur.c.z) * cur.f.z;
    const b = P.bladePoint(1), a = P.bladePoint(0.7);
    if (b.y >= band[0] && b.y <= band[1] && fwd(b) > cur.tip) { cur.tip = fwd(b); cur.tTip = t - cur.start; }
    if (a.y > 1.45 && a.y < 1.75) cur.p70head = Math.max(cur.p70head, fwd(a)); // 생성기와 같은 점 · 띠 (견줌)
  }
  G.world.free();
  return cur && cur.start != null ? { tip: cur.tip, tTip: cur.tTip, p70head: Number.isFinite(cur.p70head) ? cur.p70head : null } : null;
}

const quant = (a, p) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

/** 무기 하나: 긋기 일곱 × 시드 — 선 채 · 한 걸음 */
export function measureFlex(wid, { seeds, pre = 2, band = [0, 1.75] } = {}) {
  const out = { stand: [], step: [] };
  for (const s of seeds) for (let c = 0; c < CUTS.length; c++) for (const lunge of [false, true]) {
    const r = strokeReach(wid, s, c, { lunge, pre, band });
    if (r) out[lunge ? 'step' : 'stand'].push({ cut: CUTS[c].name, seed: s, ...r });
  }
  const sum = (R) => ({ n: R.length, med: quant(R.map((r) => r.tip), 0.5), p25: quant(R.map((r) => r.tip), 0.25), p75: quant(R.map((r) => r.tip), 0.75), p90: quant(R.map((r) => r.tip), 0.9), p70headMed: quant(R.map((r) => r.p70head), 0.5), tMed: quant(R.map((r) => r.tTip), 0.5) });
  return { id: wid, stand: sum(out.stand), step: sum(out.step), raw: out };
}

if (isMain(import.meta.url)) {
  CONFIG.ARENA.startHold = 0; // 생성기 실행과 같은 조건 (with_config ARENA.startHold=0)
  const args = process.argv.slice(2);
  const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [+p]; });
  const ids = args.filter((a) => !a.startsWith('--'));
  const list = ['longsword', ...(ids.length ? ids : ['druid_whip']).filter((x) => x !== 'longsword')];
  const seeds = range(opt('seeds', '1-36')), pre = +opt('pre', 2), band = opt('band', '0,1.75').split(',').map(Number);
  const LS = MEASURED.longsword;
  const res = list.map((id) => measureFlex(id, { seeds, pre, band }));
  const L = res[0];
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-'), f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
  console.log(`휘는 무기 간격 (봇 손놀림 · 긋기 일곱 × 시드 ${seeds.length} · 앞 획 ${pre} · 끝 높이 ${band.join(' ~ ')} m · 시작 정지 0) — 롱소드 손 값 ${LS.slice(0, 3).join(' / ')} 에 같은 실행 롱소드 비율로 붙임`);
  console.log('| 무기 | 획 (선 채 · 한 걸음) | 끝 앞 거리 선 채 가운데 (25 · 75 · 90 %) m | 한 걸음 가운데 (25 · 75 · 90 %) m | 70 % 점 머리 높이 가운데 선 채 · 한 걸음 m | 끝 가장 먼 때 가운데 s | → contact · reach · clinch |');
  console.log('|---|---|---|---|---|---|---|');
  const rows = {};
  for (const r of res) {
    const kc = r.stand.med / L.stand.med, kr = r.step.med / L.step.med;
    rows[r.id] = { contact: +(LS[0] * kc).toFixed(2), reach: +(LS[1] * kr).toFixed(2), clinch: +(LS[2] * kc).toFixed(2), standMed: +r.stand.med.toFixed(4), stepMed: +r.step.med.toFixed(4) };
    console.log(`| ${r.id} | ${r.stand.n} · ${r.step.n} | ${f3(r.stand.med)} (${f2(r.stand.p25)} · ${f2(r.stand.p75)} · ${f2(r.stand.p90)}) | ${f3(r.step.med)} (${f2(r.step.p25)} · ${f2(r.step.p75)} · ${f2(r.step.p90)}) | ${f2(r.stand.p70headMed)} · ${f2(r.step.p70headMed)} | ${f2(r.stand.tMed)} | ${rows[r.id].contact} · ${rows[r.id].reach} · ${rows[r.id].clinch} |`);
  }
  const json = opt('json', null);
  if (json) writeFileSync(json, JSON.stringify({ seeds, pre, band, rows, res: res.map((r) => ({ id: r.id, stand: r.stand, step: r.step, tips: { stand: r.raw.stand.map((x) => [x.cut, x.seed, +x.tip.toFixed(4)]), step: r.raw.step.map((x) => [x.cut, x.seed, +x.tip.toFixed(4)]) } })) }));
}
