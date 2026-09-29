// ─────────────────────────────────────────────────────────────
//  게임이 읽을 참고 동작 모음 (동작 연구 PM) — 재설계 §2-2 (2) atlas 의 채널·세 벌 구조에 맞춘 내보내기
//   node tools/motion/build_atlas.mjs   → docs/motion/atlas/<베기>_<right|left>.json + docs/motion/atlas/index.json
//
//  한 파일에 작게·보통·크게 세 벌. 벌마다 같은 위상 격자 φ(−1 ~ 2.2, 0.025 간격, 129칸)로 뽑았다
//   → 벌끼리 같은 칸을 바로 섞을 수 있다(S). 방향 채널은 섞은 뒤 길이 1로 다시 맞춘다.
//  클립(docs/motion/clips, 120 Hz)을 다시 뽑은 것이라 값은 클립과 같다. 막대 인형 관절(J)·측정용 채널은 뺐다.
//  좌표·부호는 clip_format.md §2 와 같다 (가슴 틀 = 가슴 가운데 원점, 가슴과 함께 돎. 발은 땅 틀).
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS } from './lib/cuts.mjs';
import { v3, m3, frame, BODY } from './lib/body.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLIPS = join(ROOT, 'docs', 'motion', 'clips');
const OUT = join(ROOT, 'docs', 'motion', 'atlas');
const PHI = Array.from({ length: 129 }, (_, i) => +(-1 + i * 0.025).toFixed(3)); // 0.025 간격 — 표시(−1, 0, 0.55, 0.85, 1.6, 2.2)가 모두 칸 위에 온다
const SIZES = ['small', 'medium', 'large'];
const r3 = (x) => Math.round(x * 1000) / 1000;
const r1 = (x) => Math.round(x * 10) / 10;

// 선분 - 선분 거리 (틈 재기)
function segSeg(p1, q1, p2, q2) {
  const d1 = v3.sub(q1, p1), d2 = v3.sub(q2, p2), r = v3.sub(p1, p2);
  const a = v3.dot(d1, d1), e = v3.dot(d2, d2), f = v3.dot(d2, r), c = v3.dot(d1, r), b = v3.dot(d1, d2), den = a * e - b * b;
  let s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) (t = 0), (s = Math.min(1, Math.max(0, -c / a)));
  else if (t > 1) (t = 1), (s = Math.min(1, Math.max(0, (b - c) / a)));
  return v3.len(v3.sub(v3.add(p1, v3.mul(d1, s)), v3.add(p2, v3.mul(d2, t))));
}
const smooth = (a, b, x) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

function sampleSet(clip) {
  const n = clip.data.n, cols = clip.data.cols, W = clip.data.width ?? {};
  const nj = clip.joints.length * 3;
  const JI = Object.fromEntries(clip.joints.map((name, i) => [name, i * 3]));
  const width = (ch) => W[ch] ?? cols[ch].length / n;
  // φ → 표본 위치 (φ 는 표시 사이에서 시간에 선형이라 단조)
  const at = (phi) => {
    const p = cols.phi;
    if (phi <= p[0]) return { i: 0, u: 0 };
    for (let i = 0; i < n - 1; i++) if (phi <= p[i + 1]) return { i, u: p[i + 1] > p[i] ? (phi - p[i]) / (p[i + 1] - p[i]) : 0 };
    return { i: n - 2, u: 1 };
  };
  const get = (ch, { i, u }) => {
    const w = width(ch), a = cols[ch].slice(i * w, i * w + w), b = cols[ch].slice((i + 1) * w, (i + 1) * w + w);
    return a.map((v, k) => v + (b[k] - v) * u);
  };
  const joint = (name, s) => {
    const A = cols.J, a = s.i * nj + JI[name], b = (s.i + 1) * nj + JI[name];
    return [0, 1, 2].map((k) => A[a + k] + (A[b + k] - A[a + k]) * s.u);
  };
  const ch = { t: [], handS: [], handO: [], sword: [], edge: [], pole: [], pelvisYaw: [], pelvisPitch: [], pelvisDrop: [], xFactor: [], lean: [], side: [], girdleLift: [], girdleProt: [], openness: [], guardGap: [], balanceAssist: [] };
  for (const f of ['L', 'R']) for (const k of ['x', 'z', 'yaw', 'lift']) ch[`foot${f}_${k}`] = [];
  for (const phi of PHI) {
    const s = at(phi);
    ch.t.push(r3(get('t', s)[0]));
    for (const [k, c] of [['handS', 'handS'], ['handO', 'handO'], ['sword', 'sword'], ['edge', 'edge'], ['pole', 'elbowPoleS']]) {
      let v = get(c, s);
      if (k !== 'handS' && k !== 'handO') v = v3.norm(v);
      ch[k].push(...v.map(r3));
    }
    ch.pelvisYaw.push(r1(get('pelvis.yaw', s)[0]));
    ch.pelvisPitch.push(r1(get('pelvis.pitch', s)[0]));
    ch.pelvisDrop.push(r3(get('pelvis.drop', s)[0]));
    ch.xFactor.push(r1(get('chest.xFactor', s)[0]));
    ch.lean.push(r1(get('chest.lean', s)[0]));
    ch.side.push(r1(get('chest.side', s)[0]));
    // 어깨띠: 칼 든 어깨가 기본 자리(가슴 틀 (0, 0.1, 0.2))에서 위로·앞으로 나간 양
    const Rc = frame(get('chest.yaw', s)[0], get('chest.lean', s)[0], get('chest.side', s)[0]);
    const C = joint('chest', s);
    const sh = m3.applyT(Rc, v3.sub(joint('shS', s), C));
    ch.girdleLift.push(r3(Math.max(0, sh[1] - BODY.shoulder[1])));
    ch.girdleProt.push(r3(Math.max(0, sh[0] - BODY.shoulder[0])));
    // 틈: 칼(자루 끝 → 칼끝)이 가슴 앞 0.45 m 의 세로 띠에서 떨어진 거리 (clip.mjs summarize 와 같은 띠). 0.2 → 0.4 m 를 0 → 1 로
    const gap = segSeg(joint('pommel', s), joint('tip', s), [C[0] + 0.45, C[1] - 0.25, C[2]], [C[0] + 0.45, C[1] + 0.4, C[2]]);
    ch.guardGap.push(r3(gap));
    ch.openness.push(r3(smooth(0.2, 0.4, gap)));
    // 균형 서보 풀기: 재설계 §4 기본값(풀기 ~ 지나가기 0.5, 그 밖 1.0) — 사람 자료가 아니라 자리만 채워 둔다
    ch.balanceAssist.push(phi >= 0.55 && phi <= 1.6 ? 0.5 : 1);
    for (const f of ['L', 'R']) {
      const a = joint(`ankle${f}`, s);
      ch[`foot${f}_x`].push(r3(a[0]));
      ch[`foot${f}_z`].push(r3(a[2]));
      ch[`foot${f}_yaw`].push(r1(get(`feet.${f}.yaw`, s)[0]));
      ch[`foot${f}_lift`].push(r3(get(`feet.${f}.lift`, s)[0]));
    }
  }
  // 걸음: 가장 많이 옮긴 발, 뜨는 φ(발목이 1 cm 넘게 뜸) · 딛는 φ(다시 내려옴)
  const moved = (f) => Math.hypot(ch[`foot${f}_x`].at(-1) - ch[`foot${f}_x`][0], ch[`foot${f}_z`].at(-1) - ch[`foot${f}_z`][0]);
  const foot = moved('L') > moved('R') ? 'L' : 'R';
  let step = null;
  if (moved(foot) > 0.05) {
    const y0 = (() => {
      const s = at(PHI[0]);
      return joint(`ankle${foot}`, s)[1];
    })();
    let lift = null, land = null;
    for (const phi of PHI) {
      const y = joint(`ankle${foot}`, at(phi))[1];
      if (lift == null && y > y0 + 0.01) lift = phi;
      else if (lift != null && land == null && y <= y0 + 0.004) land = phi;
    }
    step = { foot, from: [ch[`foot${foot}_x`][0], ch[`foot${foot}_z`][0]], to: [ch[`foot${foot}_x`].at(-1), ch[`foot${foot}_z`].at(-1)], liftPhi: lift, landPhi: land };
  }
  const m = clip.marks;
  return {
    marks: m,
    durations: { wind: r3(m.tw - m.t0), release: r3(m.tc - m.tw), follow: r3(m.tf - m.tc), recover: r3(m.tg - m.tf) },
    step,
    summary: { tipPeak: clip.summary.tipPeak, handPeak: clip.summary.handPeak, chestRange: clip.summary.range.chestYaw, pelvisRange: clip.summary.range.pelvisYaw, openTime: clip.summary.opening.openTime },
    ch,
  };
}

mkdirSync(OUT, { recursive: true });
const index = [];
let bytes = 0;
for (const cut of CUTS) {
  for (const side of ['right', 'left']) {
    const clips = Object.fromEntries(SIZES.map((sz) => [sz, JSON.parse(readFileSync(join(CLIPS, `${cut.id}_${side}_${sz}.json`), 'utf8'))]));
    const L = clips.large;
    const atlas = {
      format: 'stillness-motion-atlas/1',
      id: `${cut.id}_${side}`,
      cut: cut.id,
      side,
      nameKo: L.nameKo,
      nameDe: L.nameDe,
      family: L.family,
      weapon: 'longsword',
      handedness: 'right',
      phi: PHI,
      phiMarks: L.phiMarks,
      channels: {
        t: '그 벌의 시각 s (φ 칸마다)',
        'handS · handO': '앞손(코등이 쪽)·뒷손(폼멜 쪽 = 빈손이 당기는 점) 자리, 가슴 틀 m, 칸마다 [x, y, z] 평면 배열',
        sword: '칼 방향 단위 벡터(손 → 칼끝), 가슴 틀', edge: '앞날 방향 단위 벡터, 가슴 틀', pole: '칼 든 팔 팔꿈치 방향, 가슴 틀',
        'pelvisYaw · pelvisPitch · pelvisDrop': '골반 돌림° · 숙임° · 낮춤 m (월드)', 'xFactor · lean · side': '골반에 대한 가슴 돌림° · 몸 숙임 합° · 옆굽힘°',
        'girdleLift · girdleProt': '칼 든 어깨띠가 올라간·나간 양 m (최대 0.06·0.04)',
        'footL_* · footR_*': '발목 자리 x·z m (땅 틀, 클립 시작 골반 밑 원점) · 발끝 돌림° · 뒤꿈치 들림 0~1',
        'openness · guardGap': '틈 0~1 (칼이 가슴 앞 0.45 m 띠에서 0.2 → 0.4 m 떨어짐) · 그 거리 m',
        balanceAssist: '재설계 §4 기본값을 자리만 채움 (φ 0.55~1.6 에서 0.5, 그 밖 1.0) — 사람 자료 아님',
      },
      blendNote: '작게↔크게를 곧게 섞으면 사이 자세의 손목이 사람 어림(약 160°)을 넘는다 — 보통 벌을 사이에 두고 두 구간으로 섞기를 권한다(작게↔보통, 보통↔크게). 방향 채널은 섞은 뒤 길이 1로.',
      sources: L.sources.map((s) => ({ id: s.id, kind: s.kind, cite: s.cite })),
      license: '동작 연구 PM 저작 (교본 서술·공개 측정값으로 만듦, 남의 모캡 데이터 없음) — 이 게임 안에서 제한 없이 씀',
      provenance: Object.fromEntries(SIZES.map((sz) => [sz, clips[sz].provenance])),
      sets: Object.fromEntries(SIZES.map((sz) => [sz, sampleSet(clips[sz])])),
    };
    const s = JSON.stringify(atlas);
    bytes += s.length;
    writeFileSync(join(OUT, `${atlas.id}.json`), s);
    index.push({ id: atlas.id, cut: cut.id, side, nameKo: atlas.nameKo, file: `${atlas.id}.json`, durations: Object.fromEntries(SIZES.map((sz) => [sz, atlas.sets[sz].durations])), step: atlas.sets.large.step });
  }
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ format: 'stillness-motion-atlas-index/1', phiCount: PHI.length, atlases: index }, null, 1));
console.log(`atlas ${index.length}개 → docs/motion/atlas (${(bytes / 1e6).toFixed(2)} MB)`);
