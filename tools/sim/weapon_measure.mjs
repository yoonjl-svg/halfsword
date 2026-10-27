// 무기별 간격 상수(measure: contact/reach/clinch/cutTime) 실측 도구, 2차 버전.
// 캐릭터 PM의 유파 꾸러미 계약(docs/school_contract.md, …/pm-characters)에 맞춰 잰다.
//
// 1차 시도(상대에게 실제로 맞혀서 이분 탐색)는 몸이 손 목표를 따라가며 흔들리는 탓에 거리에
// 비례해 깔끔히 명중/불명중이 갈리지 않아 버렸다(같은 파일의 git 기록 참고). 이번엔 상대를
// 아예 치우고(park()) 혼자 휘두르는 궤적만 본다:
//   - 정수리를 노리는 분노의 베기(zornhau — 코드 주석에 "가장 잘 통함"이라고 되어 있다)를
//     스크립트로 한 번 휘두르면서, 칼날 70% 지점이 "머리 높이"(y 1.45~1.75m)를 지나는 순간의
//     내 가슴 기준 앞쪽 거리를 매 스텝 기록한다. 그 최댓값이 "이 무기+이 몸이 닿을 수 있는
//     최대 거리"의 kinematic 대응치다 — 상대 몸과의 충돌 판정이 전혀 없어 거리를 몰라도 한 번만
//     돌리면 되고(이분 탐색 불필요), 노이즈도 없다.
//   - 다만 이 값 자체가 원래 개발자가 롱소드를 재서 얻은 contact(1.62m)와 그대로 맞아떨어지진
//     않는다(측정한 롱소드 raw 값은 ~1.41m) — 정확히 같은 기술·타이밍으로 쟀다는 보장이 없어서
//     생기는 체계적 오차로 보고, 롱소드 raw 값이 1.62가 되도록 하는 배율(CALIBRATION)을 모든
//     무기에 똑같이 곱해 보정한다. (상대적인 무기별 차이는 그대로 살아 있다고 본다.)
//   - reach는 같은 스윙에 한 걸음 내딛기(move.y=1)를 더해서 잰다. clinch는 이번에도 실측하지
//     않고 롱소드 비율(0.7716 = clinch/contact)로 유도한다.
//   - cutTime은 그 최대 도달 순간까지 걸린 시간을 그대로 쓴다(거리 보정과 무관하니 배율 없음).
//
// 사용법: node tools/sim/weapon_measure.mjs [무기id...] [--ruler=auto|zornhau|thrust] (생략 시 전체 · auto = 이탈리아 유파 무기만 찌르기 잣대 — 아래 measureThrust, 10/25)
//  10/8 ① 구조: 재는 함수(measureSwing·measureAll)를 내보낸다 — 생성기 `node tools/sim/weapon_measures.mjs --gen` 이 같은 측정을 부른다.
//   직접 실행할 때 찍는 글은 전과 같다
import { newRound, DT } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { traditionOf } from '../../src/schools.js';

const TECH = TECH_BY_NAME.zornhau;
const CHAMBER_TIME = 0.5;
const SWING_TIME = 0.35; // 이 값에서 롱소드 raw contact가 가장 크게(가장 "제대로 휘두른") 나왔다
const HEAD_Y_LO = 1.45;
const HEAD_Y_HI = 1.75;
const CLINCH_RATIO = 1.25 / 1.62; // 롱소드 기준값의 비율을 그대로 물려받는다 (clinch는 따로 안 잰다)

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** weaponId로 혼자 zornhau를 한 번 휘두르며 칼날 70% 지점이 머리 높이를 지나는 순간의
 * 최대 전방 거리(가슴 기준)와 그때까지 걸린 시간을 잰다. lunge=true면 내딛기를 더한다. */
//  down=true (10/9 검토 docs/strike/weapon_measures_review_2026-10-09.md): 칼날 70% 지점이 '내려오는' 동안만 센다.
//   기본(false)은 전과 같다. 한손·찌르기 무기(레이피어·에스톡)는 준비 0.5 s 동안 칼이 머리 위로 안 올라가고 앞으로 누운 채라,
//   휘두르기 시작에 칼이 머리 높이를 '올라가며' 지나는 순간(0.09 s)을 닿는 순간으로 잘못 셌다.
//  swingTime (10/25 — italian_measure.mjs sweep): 휘두르는 시간 (기본 SWING_TIME 0.35 — 생성기 그대로)
export function measureSwing(weaponId, { lunge = false, down = false, swingTime = SWING_TIME } = {}) {
  const G = newRound({ weapon: weaponId, weapon2: weaponId, seed: 1 });
  G.park();
  const att = G.player;
  const path = [TECH.from, ...TECH.path];
  let phase = 'chamber';
  let phaseT = 0;
  let maxFwd = -Infinity;
  let atT = 0;
  let startChest = null;
  let startFwd = null;
  let prevY = null;
  for (let i = 0; i < 3 / DT; i++) {
    phaseT += DT;
    if (phase === 'chamber') {
      att.handOffset.set(TECH.from[0], TECH.from[1]);
      att.move.set(0, 0);
      if (phaseT > CHAMBER_TIME) {
        phase = 'swing';
        phaseT = 0;
        // "닿는 거리"는 스윙을 시작하는 순간의 가슴 위치·방향 기준이다 — 내딛기(lunge)로
        // 몸이 앞으로 나가는 동안 계속 기준을 다시 잡으면(현재 가슴 기준) 그 전진분이
        // 사라져 버려서, 스윙 시작 시점에 고정해 둔다.
        startChest = att.bodies.chest.translation();
        startChest = { x: startChest.x, y: startChest.y, z: startChest.z };
        startFwd = att.forward();
        startFwd = { x: startFwd.x, y: startFwd.y, z: startFwd.z };
      }
    } else if (phase === 'swing') {
      const u = Math.min(1, phaseT / swingTime);
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const [x, y] = lerp(seg[0], seg[1], seg[2]);
      att.handOffset.set(x, y);
      att.move.set(0, lunge ? 1 : 0);
    }
    G.step();
    if (phase === 'swing') {
      const p = att.bladePoint(0.7);
      const falling = prevY == null || p.y < prevY;
      prevY = p.y;
      if (p.y > HEAD_Y_LO && p.y < HEAD_Y_HI && (!down || falling)) {
        const forwardDist = (p.x - startChest.x) * startFwd.x + (p.z - startChest.z) * startFwd.z;
        if (forwardDist > maxFwd) {
          maxFwd = forwardDist;
          atT = phaseT;
        }
      }
    }
  }
  return { raw: maxFwd, cutTime: atT };
}

// ── 찌르기 잣대 (10/25 — docs/strike/italian_measure_2026-10-25.md) ─────────────────────────────────────────────
//  위 분노의 베기 잣대는 이탈리아 유파 무기(이탈리아 자세표 — 칼끝이 늘 상대 쪽)를 못 잰다: 그 표에서 분노의 베기 길은 베기가 아니라 칼끝을 앞으로 둔 채 쓸고 지나가,
//   칼날 70 % 지점이 머리 높이 띠(1.45 ~ 1.75)에 걸리느냐가 몇 cm 높이 차로 갈린다(전 팔 — swivelHuman 0 — 에서도 빠르게 휘두르면 띠에 안 걸려 −∞).
//   전 값(레이피어 1.57 등)은 팔꿈치를 150 ~ 170° 돌린(줄 위로 든) 팔이 칼을 수평으로 눕혀 반쯤 뻗은 손에서 띠를 스친 값 — 지금 팔(사람 팔 범위)은 그 돌림을 안 하고
//   손목 교정이 칼끝을 43 ~ 60° 들어 칼이 머리 위로 올라갔다 몸 가까이로 내려온다(0.35 s 대본 베기만 — AI 베기 · 사람 획은 빨라 그렇게 안 됨).
//  그래서 이탈리아 유파 무기는 그 유파의 주된 칼(AI 찌르기 ×1.8 · 베기 ×0.7)인 탭 찌르기로 잰다:
//   - 3번 자세(쟁기 자리 패드 — 스토카타 「si parta dalla terza」) 손으로 THRUST_SETTLE 초 서 있다가 탭 찌르기 하나(skill.thrust · 걸음 없음 — 이탈리아 런지 걸음도 안 함).
//     상대는 THRUST_GAP m 에 서 있기만(AI 끔 — 칼끝이 닿지 않는 거리 · 겨눔 방향만 정함).
//   - 잴 값: 탭이 끝날 때까지 칼날 70 % 지점이 몸 높이(THRUST_BAND)에 있을 때 찌르기 시작 때 제 가슴에서 앞으로 간 가장 먼 거리 · 그때까지 걸린 시간. 칼끝(1)도 같이 적음(견줌).
//   - 같은 실행의 롱소드 탭 찌르기에 대한 비율을 분노의 베기 잣대의 롱소드(contact 1.62 · reach · cutTime)에 붙인다 — 생성기 다른 줄과 같은 단위.
//     reach 는 비율로(서 있다 걸으며 찔러도 0.4 s 안엔 몸이 거의 안 나가 — 롱소드 −0.03 · 레이피어 +0.07 m — 걸음 몫을 이 잣대로 못 잼. clinch 를 contact 로 유도하는 것과 같은 방식)
//   - 맞춰 봄: 분노의 베기 잣대가 그대로 재는 한손 무기(세이버 · 팔쉬온 · 청강검 · 간장 · 막야 · 사인검 · 월왕구천검 · 환도)와 에스톡(× 유효 0.914)은 이 잣대로도
//     손 표와 −0.06 ~ +0.02 m(가운데 0) — 팔 두 판(swivelHuman 0 · 1)에서 0.01 m 안으로 같다. 베는 시간은 탭 시간(THRUST.aim · extend 고정)이라 무기마다 거의 같다(맞춰 봄 안 됨 — 문서 §5)
const THRUST_SETTLE = 1.0;
const THRUST_GAP = 3.4;
const THRUST_BAND = [0.9, 1.75];
const THRUST_WINDOW = 0.9;

/** weaponId 로 3번 자세에서 탭 찌르기를 한 번 — 칼날 70 % 지점 · 칼끝이 몸 높이에서 간 가장 먼 앞 거리(찌르기 시작 때 가슴 기준)와 그때까지의 시간 */
export function measureThrust(weaponId, { gap = THRUST_GAP } = {}) {
  const G = newRound({ weapon: weaponId, weapon2: 'longsword', seed: 1, gap });
  G.ai.update = () => {}; // 상대는 서 있기만 (겨눔 과녁)
  const att = G.player;
  const pad = TECH_BY_NAME.stichPflug.from; // 쟁기 자리 = 이탈리아 3번 자세(테르차) · 롱소드 쉴 자세
  let t = 0, fired = false, start = null, fwd0 = null;
  let raw = -Infinity, tip = -Infinity, atT = 0;
  for (let i = 0; i < (THRUST_SETTLE + THRUST_WINDOW + 0.1) / DT; i++) {
    att.handOffset.set(pad[0], pad[1]);
    att.move.set(0, 0);
    G.enemy.move.set(0, 0);
    if (!fired && t >= THRUST_SETTLE) {
      const c = att.bodies.chest.translation();
      start = { x: c.x, z: c.z };
      const f = att.forward();
      fwd0 = { x: f.x, z: f.z };
      fired = att.skill.thrust({ step: false });
      if (!fired) throw new Error(`${weaponId}: 탭 찌르기가 시작되지 않음`);
    }
    G.step();
    t += DT;
    if (!fired || t - THRUST_SETTLE > THRUST_WINDOW) continue;
    const fw = (v) => (v.x - start.x) * fwd0.x + (v.z - start.z) * fwd0.z;
    const p = att.bladePoint(0.7);
    if (p.y > THRUST_BAND[0] && p.y < THRUST_BAND[1] && fw(p) > raw) {
      raw = fw(p);
      atT = t - THRUST_SETTLE;
    }
    const b = att.bladePoint(1);
    if (b.y > THRUST_BAND[0] && b.y < THRUST_BAND[1]) tip = Math.max(tip, fw(b));
  }
  G.world.free();
  return { raw, tip, cutTime: atT };
}

/** 무기 하나를 어느 잣대로 재나: 'auto' = 이탈리아 유파 무기(schools.js traditionOf)만 찌르기 · 'zornhau' = 모두 분노의 베기(10/25 전) · 'thrust' = 모두 찌르기(맞춰 봄) */
export function rulerOf(id, ruler = 'auto') {
  if (ruler === 'zornhau' || ruler === 'thrust') return ruler;
  return traditionOf(WEAPONS[id]) === 'italian' ? 'thrust' : 'zornhau';
}

/** 무기 여럿을 한 번에: 롱소드 raw 로 보정 배율을 정하고 무기마다 선 채·내디디며 한 번씩 휘두른다 (값은 직접 실행과 같다)
 *  ruler (10/25): 'auto'(기본) = 이탈리아 유파 무기는 위 찌르기 잣대(같은 실행 롱소드 찌르기 비율 × 분노의 베기 잣대 롱소드) · 'zornhau' = 모두 전과 같음 · 'thrust' = 모두 찌르기 */
export function measureAll(ids = Object.keys(WEAPONS), { down = false, ruler = 'auto' } = {}) {
  // 보정 배율: 롱소드의 raw contact가 정확히 1.62가 되도록 맞춘다
  const lsC = measureSwing('longsword', { lunge: false, down });
  const longswordRaw = lsC.raw;
  const CALIBRATION = 1.62 / longswordRaw;
  const rows = [];
  let lsR = null, lsT = null; // 찌르기 잣대 다리: 분노의 베기 잣대 롱소드 reach · 롱소드 찌르기
  for (const id of ids) {
    if (rulerOf(id, ruler) === 'thrust') {
      lsR ??= measureSwing('longsword', { lunge: true, down });
      lsT ??= measureThrust('longsword');
      const m = measureThrust(id);
      const k = m.raw / lsT.raw;
      const contact = +(1.62 * k).toFixed(2);
      const reach = +(lsR.raw * CALIBRATION * k).toFixed(2);
      const clinch = +(contact * CLINCH_RATIO).toFixed(2);
      const cutTime = +(lsC.cutTime * (m.cutTime / lsT.cutTime)).toFixed(2);
      rows.push({ id, contact, reach, clinch, cutTime, ruler: 'thrust', thrust: { p70: +m.raw.toFixed(4), tip: +m.tip.toFixed(4), t: +m.cutTime.toFixed(3) } });
      continue;
    }
    const c = id === 'longsword' ? lsC : measureSwing(id, { lunge: false, down });
    const r = measureSwing(id, { lunge: true, down });
    const contact = +(c.raw * CALIBRATION).toFixed(2);
    const reach = +(r.raw * CALIBRATION).toFixed(2);
    const clinch = +(contact * CLINCH_RATIO).toFixed(2);
    const cutTime = +c.cutTime.toFixed(2);
    rows.push({ id, contact, reach, clinch, cutTime, ruler: 'zornhau' });
  }
  const thrustRef = lsT ? { p70: +lsT.raw.toFixed(4), tip: +lsT.tip.toFixed(4), t: +lsT.cutTime.toFixed(3) } : null;
  return { longswordRaw, calibration: CALIBRATION, rows, thrustRef };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const rulerArg = args.find((a) => a.startsWith('--ruler='));
  const ids = args.filter((a) => !a.startsWith('--'));
  const { longswordRaw, calibration: CALIBRATION, rows } = measureAll(ids.length ? ids : Object.keys(WEAPONS), { ruler: rulerArg ? rulerArg.slice(8) : 'auto' });
  console.log(`보정 배율(롱소드 raw ${longswordRaw.toFixed(3)}m → 1.62m 기준): ${CALIBRATION.toFixed(4)}\n`);
  for (const { id, contact, reach, clinch, cutTime, ruler } of rows) console.log(`${id.padEnd(16)} contact=${contact}  reach=${reach}  clinch=${clinch}  cutTime=${cutTime}${ruler === 'thrust' ? '  (찌르기 잣대)' : ''}`);
  console.log('\n' + JSON.stringify(rows, null, 1));
}
