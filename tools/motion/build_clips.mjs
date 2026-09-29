// ─────────────────────────────────────────────────────────────
//  기준 동작 클립 만들기 (동작 연구 PM)
//   node tools/motion/build_clips.mjs            → docs/motion/clips/*.json, docs/motion/clips/index.json, docs/motion/spec_table.md
//   node tools/motion/build_clips.mjs --print    → 요약만 찍는다 (파일 안 씀)
//   node tools/motion/build_clips.mjs zornhau    → 이 베기만
//
//  키프레임(lib/cuts.mjs) → 크기 세 벌(small·medium·large) × 좌우 → 120 Hz 표본 + 측정값.
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS, GAME_GUARDS } from './lib/cuts.mjs';
import { SOURCES } from './lib/sources.mjs';
import { sampleClip, measure, summarize, toJSONFrames, toColumns, fromGameGuard, HZ } from './lib/clip.mjs';
import { JOINTS, BONES } from './lib/body.mjs';
import { v3, m3, frame } from './lib/body.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion', 'clips');
const args = process.argv.slice(2);
const PRINT = args.includes('--print');
const only = args.filter((a) => !a.startsWith('--'));

const MIRROR_GUARD = { tag: null, langort: null, alber: null, neben: null,  tagR: 'tagL', tagL: 'tagR', ochs: 'ochsL', ochsL: 'ochs', side: 'sideL', sideL: 'side', pflug: 'pflugL', pflugL: 'pflug', wechsel: 'wechselL', wechselL: 'wechsel' };

/** 저작 키 (p/c/h/d + 걸음 키) → clip.mjs 키 */
function toKeys(set) {
  const keys = set.keys.map((k) => ({
    t: k.t,
    tag: k.tag,
    pelvis: { yaw: k.p[0], drop: k.p[1], pitch: k.p[2] ?? 0, roll: 0 },
    chest: { yaw: k.c[0], lean: k.c[1], side: k.c[2] ?? 0 },
    hand: k.h,
    // 칼 방향: 저작 키는 그 키의 가슴 틀 → 월드로 바꿔 둔다 (보간은 월드에서)
    dirV: m3.apply(frame(k.p[0] + k.c[0], (k.p[2] ?? 0) + k.c[1], k.c[2] ?? 0), k.d),
  }));
  for (const s of set.steps) {
    const f = {};
    for (const side of ['L', 'R']) {
      const a = s.feet[side];
      f[side] = { x: a[0], z: a[1], yaw: a[2], lift: a[3], up: a[4] };
    }
    keys.push({ t: s.t, feet: f, pelvis: { x: s.px ?? 0, z: s.pz ?? 0 } });
  }
  keys.sort((a, b) => a.t - b.t);
  return keys;
}
function marksOf(set) {
  const m = {};
  for (const k of set.keys) if (k.tag) m[k.tag] = k.t;
  m.t0 = set.keys[0].t;
  for (const need of ['t0', 'tw', 'tr', 'tc', 'tf', 'tg']) if (m[need] == null) throw new Error(`표시 ${need} 없음`);
  return m;
}

/** 크기 섞기: small 과 large 키를 u 만큼 (키 개수·표시가 같아야 한다) */
function blend(small, large, u) {
  if (small.keys.length !== large.keys.length) throw new Error('small·large 키 개수가 다르다');
  const L = (a, b) => a.map((v, i) => v + (b[i] - v) * u);
  const keys = small.keys.map((a, i) => {
    const b = large.keys[i];
    return { t: a.t + (b.t - a.t) * u, tag: a.tag ?? b.tag, p: L(a.p, b.p), c: L(a.c, b.c), h: L(a.h, b.h), d: v3.norm(L(a.d, b.d)) };
  });
  // 걸음: large 걸음을 시간은 새 표시에 맞춰 옮기고, 발 옮김은 u 만큼만
  const mL = marksOf(large);
  const mB = marksOf({ keys });
  const tmap = (t) => {
    const pts = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = mL[pts[i]], b = mL[pts[i + 1]];
      if (t <= b + 1e-9) return mB[pts[i]] + ((mB[pts[i + 1]] - mB[pts[i]]) * (t - a)) / (b - a);
    }
    return mB.tg;
  };
  const base = large.steps[0];
  const steps = large.steps.map((s) => {
    const f = {};
    for (const side of ['L', 'R']) f[side] = L(base.feet[side], s.feet[side]);
    return { t: tmap(s.t), feet: f, px: (s.px ?? 0) * u, pz: (s.pz ?? 0) * u };
  });
  const chain = {};
  for (const k of Object.keys(large.chain)) {
    if (k === 'seq') {
      chain.seq = {};
      for (const j of Object.keys(large.chain.seq)) chain.seq[j] = small.chain.seq[j] + (large.chain.seq[j] - small.chain.seq[j]) * u;
    } else chain[k] = small.chain[k] + (large.chain[k] - small.chain[k]) * u;
  }
  return { keys, steps, chain };
}

/** 보통 벌 걸음: 크게 벌 걸음 시각을 보통 벌 표시로 옮긴다 */
function retimeSteps(med, large) {
  const mL = marksOf(large);
  const mM = marksOf(med);
  const pts = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
  const tmap = (t) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = mL[pts[i]], b = mL[pts[i + 1]];
      if (t <= b + 1e-9) return mM[pts[i]] + ((mM[pts[i + 1]] - mM[pts[i]]) * (t - a)) / (b - a);
    }
    return mM.tg;
  };
  return { ...med, steps: med.steps.map((s) => ({ ...s, t: tmap(s.t) })) };
}

/** 왼쪽에서 베기 = 거울 (게임 자세표 키는 게임의 왼쪽 자세 값으로 바꾼다) */
function mirror(set) {
  const keys = set.keys.map((k) => {
    if (k.guard && MIRROR_GUARD[k.guard]) {
      const g = fromGameGuard(GAME_GUARDS[MIRROR_GUARD[k.guard]]);
      return { t: k.t, tag: k.tag, p: [g.pelvis.yaw, g.pelvis.drop, 0], c: [g.chest.yaw, g.chest.lean, 0], h: g.hand, d: g.dirV };
    }
    return { t: k.t, tag: k.tag, p: [-k.p[0], k.p[1], k.p[2] ?? 0], c: [-k.c[0], k.c[1], -(k.c[2] ?? 0)], h: [k.h[0], k.h[1], -k.h[2]], d: [k.d[0], k.d[1], -k.d[2]] };
  });
  const steps = set.steps.map((s) => {
    const m = (a) => [a[0], -a[1], -a[2], a[3], a[4]];
    return { t: s.t, feet: { L: m(s.feet.R), R: m(s.feet.L) }, px: s.px, pz: -(s.pz ?? 0) };
  });
  return { keys, steps, chain: set.chain };
}

function build(cut, sizeName, sideName) {
  let set = sizeName === 'small' ? cut.small : sizeName === 'large' ? cut.large : cut.medium ? retimeSteps(cut.medium, cut.large) : blend(cut.small, cut.large, 0.5);
  if (sideName === 'left') set = mirror(set);
  const marks = marksOf(set);
  const chain = { ...set.chain };
  // 운동 사슬 곡선: 골반·가슴 돌림을 감기 끝 값 → 지나가기 끝 값으로, 최고 속도가 겨눈 선(tc)보다 앞서게
  //  (골프 프로: 골반 → 가슴 → 팔 → 채, 간격 약 20~40 ms · 야구: 골반 → 어깨 [측정] — lib/cuts.mjs CHAIN.seq)
  if (chain.seq) {
    const kw = set.keys.find((k) => k.tag === 'tw');
    const kc = set.keys.find((k) => k.tag === 'tc');
    const kf = set.keys.find((k) => k.tag === 'tf');
    const q = chain.seq;
    // 겨눈 선에서의 돌림은 저작한 tc 키 값을 지킨다. 나머지(겨눈 선 → 지나가기 끝)는 느린 두 번째 곡선이 낸다
    const slow = { peak2: marks.tc + 0.1, dur2: Math.max(0.3, (marks.tf - marks.tc) * 1.6) };
    chain.profiles = {
      pelvis: { v0: kw.p[0], vc: kc.p[0], v1: kf.p[0], tc: marks.tc, peak: marks.tc - q.pelvis, dur: q.dur, ...slow },
      chest: { v0: kw.p[0] + kw.c[0], vc: kc.p[0] + kc.c[0], v1: kf.p[0] + kf.c[0], tc: marks.tc, peak: marks.tc - q.chest, dur: q.dur, ...slow },
    };
    chain.pelvis = 0;
    chain.chest = 0;
  }
  const def = { keys: toKeys(set), marks, chain };
  const { frames } = sampleClip(def, 1);
  const rows = measure(frames, marks);
  const summary = summarize(rows, marks);
  const over = rows.filter((r) => r.J.overS > 0.01 || r.J.overO > 0.01).map((r) => `${r.t.toFixed(2)}:${Math.max(r.J.overS, r.J.overO).toFixed(2)}`);
  return { marks, rows, summary, def, over };
}

const SIZES = ['small', 'medium', 'large'];
const SIDES = ['right', 'left'];
const index = [];
if (!PRINT) mkdirSync(OUT, { recursive: true });
for (const cut of CUTS) {
  if (only.length && !only.includes(cut.id)) continue;
  for (const side of SIDES) {
    for (const size of SIZES) {
      const { marks, rows, summary, over } = build(cut, size, side);
      const name = `${cut.id}_${side}_${size}`;
      const s = summary;
      const seq = s.sequence.map((q) => `${q.part} ${q.t > 0 ? '+' : ''}${q.t}`).join(' → ');
      console.log(
        `${name.padEnd(26)} 칼끝 ${String(s.tipPeak).padStart(5)} m/s (선 ${s.tipAtLine}) 손 ${s.handPeak} | 가슴 ${s.range.chestYaw}° 골반 ${s.range.pelvisYaw}° X ${s.range.xFactorMax}° | 손 위 ${s.wind.handAboveHeadTop} 뒤 ${s.wind.handBehindTorsoFront} 어깨 ${s.wind.shoulderElev}° | 지나감 ${s.followThrough.handSidePelvis} | 손길 ${s.range.handPath} m | 몸통 ${s.shareAtTipPeak.trunk} 손목 ${s.shareAtTipPeak.wrist} | ${s.ordered ? '순서 OK' : '순서 뒤섞임'} | 넘침 팔 ${s.checks.reachOver} 다리 ${s.checks.legOver}`,
      );
      if (args.includes('--seq')) console.log('   ', seq);
      if (args.includes('--over') && over.length) console.log('    팔 넘침', over.filter((_, i) => i % 3 === 0).join(' '));
      if (PRINT) continue;
      const clip = {
        format: 'stillness-motion-clip/1', // data.cols[채널] = 120 Hz 표본 (벡터는 3칸씩 평면), J = joints 순서 관절 위치
        id: name,
        cut: cut.id,
        nameKo: cut.nameKo,
        nameDe: cut.nameDe,
        family: cut.family,
        desc: cut.desc,
        side,
        size,
        hz: HZ,
        weapon: 'longsword',
        handedness: 'right',
        units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
        frame:
          '월드 = 클립 시작 때 골반 밑 땅, x 앞(상대 쪽) · y 위 · z 칼 든 쪽(오른쪽). 가슴 틀 값(handS·handO·sword·edge·elbow·shoulderS) = 가슴 가운데 원점, 가슴 상자와 함께 돈다. handS_face = 골반이 향하는 쪽 틀(게임의 지금 손 목표 틀과 같은 종류). yaw + = 칼 든 쪽 어깨·골반이 뒤로 (게임 guards.js 부호).',
        marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +v.toFixed(4)])),
        phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
        sources: cut.sources.map((id) => ({ id, ...SOURCES[id] })),
        provenance:
          size === 'small'
            ? '지금 게임의 팔 베기 자세표(src/guards.js) 값을 그대로 옮김 + 저작 사이 키'
            : size === 'large'
              ? '교본 서술(시작·끝 자세·걸음)과 스포츠 생체역학의 운동 사슬 시간차로 저작한 v0 [추정 포함] — 모캡 실측 아님'
              : '크게 벌을 겨눈 선 자세 쪽으로 줄임(몸·손 75%, 칼 각 85%), 시각은 작게와 크게의 가운데 [추정]',
        summary,
        joints: JOINTS,
        bones: BONES,
        data: toColumns(toJSONFrames(rows)),
      };
      writeFileSync(join(OUT, `${name}.json`), JSON.stringify(clip));
      index.push({ id: name, cut: cut.id, nameKo: cut.nameKo, nameDe: cut.nameDe, family: cut.family, desc: cut.desc, side, size, file: `${name}.json`, summary });
    }
  }
}
if (!PRINT && !only.length) {
  writeFileSync(join(OUT, 'index.json'), JSON.stringify({ format: 'stillness-motion-index/1', generated: new Date().toISOString().slice(0, 10), clips: index }, null, 1));
  writeFileSync(join(ROOT, 'docs', 'motion', 'spec_table.md'), specTable(index));
  console.log(`\n${index.length}개 클립 → ${OUT}, 사양표 → docs/motion/spec_table.md`);
}

/** 사양표 (오른쪽에서 베기만 — 왼쪽은 거울이라 같은 값) */
function specTable(list) {
  const R = list.filter((c) => c.side === 'right');
  const L = [];
  L.push('# 롱소드 베기 기준 동작 — 측정 사양표 (자동 생성)');
  L.push('');
  L.push('> `node tools/motion/build_clips.mjs` 가 만든다. 손으로 고치지 말 것. 오른쪽에서 베기만 적는다(왼쪽은 거울이라 같은 값).');
  L.push('> 값은 v0 기준 동작(교본 서술 + 생체역학 운동 사슬로 저작, 게임 뼈대 치수)에서 잰 것이다. 모캡 실측이 아니다 — 출처와 믿을 정도는 `docs/motion/sources.md`.');
  L.push('> small = 지금 게임의 팔 베기(자세표를 그대로 이음), large = 온몸 베기, medium = 크게 벌을 겨눈 선 자세 쪽으로 줄인 것(몸·손 75%, 칼 각 85%, 시각은 작게와 크게의 가운데).');
  L.push('');
  L.push('## 1. 빠르기·시간');
  L.push('');
  L.push('| 베기 | 크기 | 칼끝 최고 m/s | 칼끝 (겨눈 선) m/s | 손 최고 m/s | small 대비 칼끝 | 감기 s | 풀기→선 s | 지나가기 s | 복귀 s | 합 s |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    const sm = R.find((x) => x.cut === c.cut && x.size === 'small').summary;
    L.push(`| ${c.nameKo} ${c.nameDe} | ${c.size} | ${s.tipPeak} | ${s.tipAtLine} | ${s.handPeak} | ${(s.tipPeak / sm.tipPeak).toFixed(2)}× | ${s.time.wind} | ${s.time.releaseToLine} | ${s.time.follow} | ${s.time.recover} | ${s.time.total} |`);
  }
  L.push('');
  L.push('## 2. 운동 사슬 — 최고 속도 시각 (ms, 칼이 겨눈 선을 지나는 때 = 0) · 최고값');
  L.push('');
  L.push('골반·가슴 = 수직축 둘레 각속도(rad/s), 어깨 = 가슴 틀에서 위팔 방향이 도는 빠르기(rad/s), 손목 = 칼과 아래팔 사이 각이 바뀌는 빠르기(rad/s), 손·칼끝 = m/s.');
  L.push('최고 시각은 최고값의 95% 이상 구간의 가운데다. 어깨·손목은 방향 변화율이라 흔들림이 커서 참고로만 본다.');
  L.push('');
  L.push('| 베기 | 크기 | 골반 | 가슴 | 어깨 | 손 | 손목 | 칼끝 | 순서 | 칼끝 최고 때 가슴 각속도 (자기 최고 대비) | 칼끝 빠르기 중 몸통 몫 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    const q = Object.fromEntries(s.sequence.map((x) => [x.part, x]));
    const f = (k) => `${q[k].t} · ${q[k].value}`;
    L.push(`| ${c.nameKo} | ${c.size} | ${f('골반')} | ${f('가슴')} | ${f('어깨(위팔)')} | ${f('손')} | ${f('손목(칼)')} | ${f('칼끝')} | ${s.ordered ? '골반→가슴→손→칼끝' : '뒤섞임'} | ${Math.round(s.trunkCarry * 100)}% | ${Math.round(s.shareAtTipPeak.trunk * 100)}% |`);
  }
  L.push('');
  L.push('## 3. 크기 — 몸 둘레 어디까지 가나');
  L.push('');
  L.push('| 베기 | 크기 | 가슴 회전 범위° | 골반 회전 범위° | 척추 비틀림 최대° | 감기 손 높이 (머리 꼭대기 위) m | 감기 손 (가슴 앞면보다 뒤) m | 감기 어깨 들림° | 지나가기 손 (반대 엉덩이 쪽 옆 거리) m | 지나가기 끝 손 높이 (엉덩이 위) m | 손 길 m | 칼끝 길 m |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    L.push(`| ${c.nameKo} | ${c.size} | ${s.range.chestYaw} | ${s.range.pelvisYaw} | ${s.range.xFactorMax} | ${s.wind.handAboveHeadTop} | ${s.wind.handBehindTorsoFront} | ${s.wind.shoulderElev} | ${s.followThrough.handSidePelvis} | ${s.followThrough.handHeightOverHip} | ${s.range.handPath} | ${s.range.tipPath} |`);
  }
  L.push('');
  L.push('## 4. 반동·허점 (어림값)');
  L.push('');
  L.push('| 베기 | 크기 | 앞이 빈 시간 s | 칼끝이 몸 뒤에 있는 시간 s | 가장 많이 돌아선 각° | 무게중심 옮김 m | 팔 넘침 m | 칼끝 가장 낮은 높이 m | 아래팔-칼 각 최대° | 135° 넘은 시간 s | 160° 넘은 시간 s |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R) {
    const s = c.summary;
    L.push(`| ${c.nameKo} | ${c.size} | ${s.opening.openTime} | ${s.opening.bladeBehindTime} | ${s.opening.maxTurn} | ${s.range.comShift} | ${s.checks.reachOver} | ${s.checks.tipMin} | ${s.checks.wristMax} | ${s.checks.wristClampTime} | ${s.checks.wristOver160} |`);
  }
  L.push('');
  L.push('## 5. 표시 자세 — 관절각과 몸 둘레 자리 (large, 오른쪽)');
  L.push('');
  L.push('각: 골반·가슴 = 월드 돌림(+ = 칼 쪽으로 감음), 척추 = 가슴−골반, 숙임 + = 앞. 어깨 들림 = 가슴 아래 방향과 위팔 사이(180 = 머리 위로 곧게). 팔꿈치·무릎 = 굽힘(0 = 곧음). 손목 = 아래팔과 칼 사이.');
  L.push('자리: 손(가슴 틀) = [앞, 위, 칼 쪽] m · 칼끝(땅 틀) = [앞, 높이, 칼 쪽] m · 칼 방향 = [올려본 각, 옆 각](옆 + = 칼 쪽, ±180 = 뒤) · 발 = 발목 [앞, 옆] m.');
  L.push('');
  L.push('| 베기 | 때 | 시각 s | 골반° | 가슴° | 척추° | 숙임° | 어깨 들림° | 칼 팔꿈치° | 손목° | 무릎 L/R° | 손 (가슴 틀) | 칼끝 (땅 틀) | 칼 방향 | 왼발 / 오른발 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const TAG = { t0: '준비', tw: '감기 끝', tr: '손목 풀림', tc: '겨눈 선', tf: '지나가기 끝' };
  for (const c of R.filter((x) => x.size === 'large')) {
    for (const [k, p] of Object.entries(c.summary.keyPoses)) {
      L.push(`| ${c.nameKo} | ${TAG[k]} | ${p.t} | ${p.pelvisYaw} | ${p.chestYaw} | ${p.xFactor} | ${p.lean} | ${p.shoulderElev} | ${p.elbowS} | ${p.wrist} | ${p.kneeL}/${p.kneeR} | ${p.handChest.join(', ')} | ${p.tipWorld.join(', ')} | ${p.swordElAz.join(', ')} | ${p.footL.join(', ')} / ${p.footR.join(', ')} |`);
    }
  }
  L.push('');
  L.push('아래팔-칼 각은 칼과 칼 든 아래팔 사이 각이다. 사람 어림 [추정, 측정 자료 없음]: 두손 망치 쥐기 약 90° + 손목 옆굽힘으로 약 135°, 손목 폄(최대 70°)까지 보태면 약 160°. 160° 를 넘는 순간은 저작한 칼이 손목으로 낼 수 없는 늦춤을 요구한 것이다(v0 는 막지 않고 적기만 한다 — `tools/motion/lib/body.mjs` WRIST_MAX 주석). 크게 벌은 대부분 160° 안이다. 작게(게임 자세)와 크게를 곧게 섞으면 사이 자세가 165~177° 까지 간다(v0 보통 벌) — 게임에서 작은 벌과 큰 벌을 곧게 섞어도 같은 일이 생긴다. 지금 보통 벌은 크게 벌을 줄여 만들어 대부분 안이다.');
  L.push('');
  L.push('칼끝 가장 낮은 높이가 0 가까이거나 − 이면 칼끝이 땅에 닿는다. 작게 벌의 왼쪽 바꿈·바보 자세는 게임 자세표 값 그대로라 칼끝이 땅 높이까지 내려간다(게임에서는 땅이 막는다). ');
  L.push('');
  L.push('앞이 빈 시간 = 감기 끝~복귀 동안 칼(폼멜~칼끝)이 가슴 앞 0.45 m 의 세로 띠(가슴 아래 0.25 ~ 위 0.4 m)에서 0.3 m 넘게 떨어져 있던 시간. 팔 넘침 0.033 m 는 지금 게임 쟁기 자세 자체가 게임 팔 길이보다 조금 먼 것이다.');
  L.push('');
  return L.join('\n');
}
