// 한손 무기 팔 비틀림 시험 (10/25 01:2x 사장님 '지금 손목 고치다가 자세가 많이 망가졌어 특히 한손무기. 팔 관절이 비틀린 게 많아. 레이피어 첫 자세와 한손검 뻗고 휘두르는 자세 집중적으로 점검해봐. 특히 병마용에서 유독 잘 관찰됨.' —
//  docs/strike/wrist_audit_2026-10-24.md §10 · tools/sim/wrist_audit.mjs shRot · elbowUp):
//   팔꿈치 돌림(JOINTS.elbowSwivel)이 손목을 고치려고 팔꿈치를 어깨 → 손목 줄 위로 들어 올리거나(머리 곁으로 꺾여 든 팔) 위팔 돌림을 AAOS 한도 밖으로 밀던 것 →
//   JOINTS.swivelHuman 1(기본): 사람 팔 범위 밖 돌림은 안 함 · 손목은 교정(wristGuard)이 범위 끝까지만. 0 = 10/24 17:2x 뒤 판(옛 비틀림이 다시 보여야 시험이 산다).
//   자세표(레이피어 · 세이버 · 월왕구천검) · 탭 찌르기(레이피어 · 세이버 — 쟁기 · 황소 · 긴 자세) · 병마용 AI(월왕구천검 · 병마용 기질 대 롱소드) · 레이피어 1번 자세(프리마)
//  10/25 감독 '칼끝이 하늘을 보는 자세는 안 됨 — 사람 칼 자세가 아님' (dbf2120 판 레이피어 프리마 · 월왕구천검 · 세이버 황소 칼끝 30~45° 위) — 기록 §12:
//   JOINTS.wristPronate 1(기본): 엎친 손 + 손목 굽힘(사람 범위 안)으로 칼끝을 상대 쪽에 둔 채 · 이탈리아 1번 자세 손을 원전대로 뻗음(school_kit_map). 0 = dbf2120 판
//  node --test tools/sim/onehand_arm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { guardsRun, tapRun, aiRun, guardAimRun, WristTally, ELBOW_UP_X, ROLL_AT, OOR_EPS } from './wrist_audit.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const { JOINTS } = CONFIG;
const withSets = (L, fn) => {
  const old = L.map(([o, k]) => o[k]);
  L.forEach(([o, k, v]) => (o[k] = v));
  try {
    return fn();
  } finally {
    L.forEach(([o, k], i) => (o[k] = old[i]));
  }
};
const V1024 = [
  [JOINTS, 'swivelHuman', 0],
  [JOINTS, 'wristPronate', 0],
]; // 10/24 17:2x 뒤 판 (사람 팔 범위 안 봄 · 엎친 손 길 없음)
const VDBF = [[JOINTS, 'wristPronate', 0]]; // dbf2120 판 (사람 팔 범위 안 · 엎친 손 길 없음 — 칼끝이 하늘)
/** 묶음 몫: 위팔 돌림 한도 밖 · 팔꿈치 줄 위 · 30° 넘게 위 · 굴림 끝 · 거꾸로 */
function shares(T) {
  let n = 0, rotN = 0, shOut = 0, up0 = 0, up30 = 0, roll78 = 0, rev = 0;
  for (const P of T.k.values()) {
    n += P.n;
    rotN += P.rotN;
    shOut += P.shOut;
    up0 += P.up0;
    up30 += P.up30;
    roll78 += P.roll78;
    rev += P.rev;
  }
  return { n, shOut: rotN ? shOut / rotN : 0, up0: up0 / n, up30: up30 / n, roll78: roll78 / n, rev: rev / n };
}
const pc = (x) => (100 * x).toFixed(1);
const fmt = (s) => `위팔 돌림 밖 ${pc(s.shOut)} % · 팔꿈치 줄 위 ${pc(s.up0)} % · ${ELBOW_UP_X}° 넘게 위 ${pc(s.up30)} % · 굴림 ≥ ${ROLL_AT} ${pc(s.roll78)} % · 거꾸로 ${pc(s.rev)} % (스텝 ${s.n})`;

test('값: 사람 팔 범위 돌림 JOINTS.swivelHuman 1 (사장님 10/25 01:2x) · 엎친 손 길 JOINTS.wristPronate 1 (감독 10/25) · 위팔 돌림 한도 [−70, 90] · 아래팔 굴림 한도 80', () => {
  assert.equal(JOINTS.swivelHuman, 1);
  assert.equal(JOINTS.wristPronate, 1);
  assert.deepEqual(JOINTS.twist, [-70, 90]);
});

// 굴림 끝 ≤ 10 %: 엎친 손 길은 높은 자세(황소 · 지붕)에서 칼끝을 상대 쪽에 두려고 아래팔을 엎침 끝 언저리(사람 엎침 80 — 원전 프리마 · 높은 자세의 손등 위 · 바깥)까지 돌린다 (기록 §12)
test('한손 자세표 (레이피어 · 세이버 · 월왕구천검 — 자리마다 1.4 s 붙잡기): 기본 팔꿈치가 줄 위로 30° 넘게 0 · 위팔 돌림 밖 0 · 굴림 끝 ≤ 10 % · 거꾸로 ≤ 3 % — 10/24 판은 팔꿈치가 줄 위로 돎', () => {
  const run = () => {
    const T = new WristTally();
    for (const w of ['rapier', 'sabre', 'goujian']) T.merge(guardsRun(w).T, `${w}:`);
    return shares(T);
  };
  const now = run();
  const old = withSets(V1024, run);
  assert.ok(now.up30 === 0 && now.shOut === 0 && now.roll78 <= 0.1 && now.rev <= 0.03, `기본: ${fmt(now)}`);
  assert.ok(old.up0 > 0.03 && old.up0 > now.up0 + 0.03, `10/24 판: ${fmt(old)}`);
});

test('한손 탭 찌르기 (레이피어 · 세이버 — 쟁기 · 황소 · 긴 자세): 기본 위팔 돌림 밖 ≤ 1 % · 팔꿈치 30° 넘게 위 ≤ 1 % — 10/24 판은 찌르는 맞춤 돌림이 팔꿈치를 들고 위팔을 한도 밖으로', () => {
  const run = () => {
    const T = new WristTally();
    for (const w of ['rapier', 'sabre']) for (const gd of ['pflug', 'ochs', 'langort']) T.merge(tapRun(w, gd).T, `${w}:${gd}:`);
    return shares(T);
  };
  const now = run();
  const old = withSets(V1024, run);
  assert.ok(now.shOut <= 0.01 && now.up30 <= 0.01, `기본: ${fmt(now)}`);
  assert.ok(old.shOut > 0.03 || old.up30 > 0.05, `10/24 판: ${fmt(old)}`);
});

test('병마용 AI (월왕구천검 · 병마용 기질 대 롱소드 AI · 15 s · 상처 끔): 기본 팔꿈치 30° 넘게 위 ≤ 1 % · 위팔 돌림 밖 ≤ 1 % — 10/24 판은 칼 든 팔이 머리 곁으로 꺾여 듦 (사장님 그림)', () => {
  const persona = CHARACTERS_BY_ID.terracotta.ai.persona;
  const run = () => shares(aiRun('goujian', { foeW: 'longsword', persona, only: 'enemy', seed: 11, wounds: false }).T);
  const now = run();
  const old = withSets(V1024, run);
  assert.ok(now.n > 1000, `스텝 ${now.n}`);
  assert.ok(now.up30 <= 0.01 && now.shOut <= 0.01, `기본: ${fmt(now)}`);
  assert.ok(old.up30 > 0.05, `10/24 판: ${fmt(old)}`);
});

test('레이피어 1번 자세(프리마 — 판 시작 겨눔): 기본 팔꿈치가 줄 아래(−30° 아래) · 손목 사람 범위 안(dev ≥ −30 − 측정 여유) · 칼끝 위로 안 듦 — 10/24 판은 팔꿈치를 줄 가까이 들고 굴림 70 넘게', () => {
  const prima = () => {
    const T = guardsRun('rapier').T;
    const [, P] = [...T.k.entries()].find(([k]) => k.includes('프리마'));
    return P;
  };
  const avg = (P, f) => P[f] / P.n;
  const now = prima();
  const old = withSets(V1024, prima);
  const aim = guardAimRun('rapier', '프리마');
  const say = (P) => `팔꿈치 위 ${avg(P, 'upSum').toFixed(0)}° · 굴림 ${avg(P, 'rollSum').toFixed(0)}° · dev ${avg(P, 'devSum').toFixed(0)}°`;
  assert.ok(avg(now, 'upSum') < -30 && avg(now, 'devSum') >= -30 - OOR_EPS - 2 && aim.pitch <= 0, `기본: ${say(now)} · 칼끝 높이 ${aim.pitch.toFixed(0)}°`);
  assert.ok(avg(old, 'upSum') > -25 && avg(old, 'rollSum') > 70, `10/24 판: ${say(old)}`);
});

// 칼끝이 상대 쪽 (10/25 감독 — dbf2120 판 레이피어 프리마 · 월왕구천검 · 세이버 황소 칼끝 30~45° 위 '사람 칼 자세가 아님'): 높은 자세 셋을 1.4 s 붙잡고 끝 0.4 s —
//  칼끝 높이 ≤ 0°(수평 또는 조금 아래 — 얼굴 · 가슴 쪽) · 칼 ↔ 상대 머리 < 25° · 팔꿈치 줄 아래 · 손목 사람 범위(dev ≥ −30 · 굽힘 · 폄 ≤ wristFE — 서보 흔들림 3° 여유) · 거꾸로 0
//  dbf2120 판(JOINTS.wristPronate 0)은 칼끝이 하늘 (> 20° 위 하나 이상)
test('한손 높은 자세 칼끝이 상대 쪽 (레이피어 1번 자세 · 월왕구천검 · 세이버 황소): 기본 칼끝 ≤ 0° · 상대 머리와 < 25° · 팔꿈치 줄 아래 · 손목 범위 안 — dbf2120 판은 칼끝이 하늘', () => {
  const SPECS = [
    ['rapier', '프리마'],
    ['goujian', '황소'],
    ['sabre', '황소'],
  ];
  const run = () => SPECS.map(([w, f]) => ({ w, ...guardAimRun(w, f) }));
  const say = (a) => `${a.w} ${a.name}: 칼끝 ${a.pitch.toFixed(0)}° · 상대 머리와 ${a.foe.toFixed(0)}° · 팔꿈치 위 ${a.up.toFixed(0)}° · 굴림 ${a.roll.toFixed(0)} · dev ${a.dev.toFixed(0)} · fe ${a.fe.toFixed(0)} · 거꾸로 ${pc(a.rev)} %`;
  for (const a of run()) {
    assert.ok(a.n > 30, say(a));
    assert.ok(a.pitch <= 0 && a.foe < 25 && a.up < 0 && a.dev >= -30 - OOR_EPS - 2 && Math.abs(a.fe) <= JOINTS.wristFE + 3 && a.rev === 0, `기본: ${say(a)}`);
  }
  const old = withSets(VDBF, run);
  assert.ok(old.some((a) => a.pitch > 20), `dbf2120 판: ${old.map(say).join(' / ')}`);
});
