// 무기별 간격 상수(measure: contact/reach/clinch/cutTime) 실측 도구.
// 캐릭터 PM의 유파 꾸러미 계약(docs/school_contract.md, claude/pm-characters)에 맞춰,
// AI 없이 "가만히 선 상대"에게 정수리 베기(oberhau, ai_techniques.js)를 반복해서 재 본다.
//   - contact: 제자리에서(내딛지 않고) 벤 정수리 베기가 머리·목에 실제로 "베기"(cut) 판정으로
//     닿는 최대 거리. 이분 탐색으로 찾는다.
//   - reach: 같은 베기에 한 걸음 내딛기(move.y=1)를 더했을 때 닿는 최대 거리.
//   - clinch: 실측하지 않고, 롱소드 기준(clinch/contact = 1.25/1.62)의 비율로 contact에서 유도한다
//     ("너무 붙어 칼을 못 쓰는 거리"는 이분 탐색으로 정의하기 애매해 기존 비율을 그대로 옮긴다).
//   - cutTime: 손이 준비 자세를 벗어나기 시작해서 실제로 닿기까지 걸린 시간(그 거리에서).
// 사용법: node tools/sim/weapon_measure.mjs [무기id...] (생략 시 전체)
import { newRound, DT } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { G, TECH_BY_NAME } from '../../src/ai_techniques.js';

const TECH = TECH_BY_NAME.oberhau; // 정수리 베기: tag(지붕) → [0,0.14] → alber(바보). 곧게 내려베어 머리·목을 노린다
const CHAMBER_TIME = 0.5; // 준비 자세로 먼저 가라앉히는 시간
const SWING_TIME = 0.35; // 손이 path를 따라 움직이는 시간 (AI_LEVELS.normal.strikeSpeed 언저리)

/** attacker가 정지한 target(챔피언 자세 그대로)에게 oberhau를 한 번 치는 시뮬. dist=가슴 간 시작 거리(m) */
function trySwing(weaponId, dist, { lunge = false } = {}) {
  const G_ = newRound({ walls: false, weapon: weaponId, weapon2: weaponId, gap: dist });
  const att = G_.player;
  const tgt = G_.enemy;
  att.faceTarget = tgt.bodies.pelvis.translation();
  tgt.faceTarget = att.bodies.pelvis.translation();
  tgt.handOffset.set(G.alber[0], G.alber[1]); // 정말로 "가만히 선" 상대: 칼을 아래로 늘어뜨려 머리를 가리지 않는다
  let hitT = null;
  let hitInfo = null;
  let swingStarted = false;
  let swingStartT = 0;
  G_.combat.hooks.onWound = (a, v, r) => {
    // 준비 자세로 가라앉는 동안(손을 처음 그 자리로 홱 옮기는 순간)의 우발적 접촉은 무시한다
    if (a === att && v === tgt && swingStarted && hitT == null) {
      hitT = G_.t - swingStartT;
      hitInfo = r;
    }
  };
  let phase = 'chamber';
  let phaseT = 0;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const path = [G.tag, ...TECH.path];
  for (let i = 0; i < 4 / DT; i++) {
    const dt = DT;
    phaseT += dt;
    tgt.move.set(0, 0);
    if (phase === 'chamber') {
      att.handOffset.set(G.tag[0], G.tag[1]);
      att.move.set(0, 0);
      if (phaseT > CHAMBER_TIME) {
        phase = 'swing';
        phaseT = 0;
        swingStarted = true;
        swingStartT = G_.t;
      }
    } else if (phase === 'swing') {
      const u = Math.min(1, phaseT / SWING_TIME);
      // path: [tag, mid, alber] 세 점을 두 구간으로 선형 보간
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const [x, y] = lerp(seg[0], seg[1], seg[2]);
      att.handOffset.set(x, y);
      att.move.set(0, lunge ? 1 : 0);
      if (phaseT > SWING_TIME + 0.5) phase = 'done';
    }
    att.foe = tgt;
    tgt.foe = att;
    G_.step();
    if (hitT != null && G_.t - swingStartT - hitT > 0.15) break; // 맞은 뒤 충분히 지나가면 그만
    if (phase === 'done' && G_.t > CHAMBER_TIME + SWING_TIME + 1) break;
  }
  const landed = hitInfo && (hitInfo.type === 'cut' || hitInfo.type === 'stab') && hitInfo.severity > 0 && (hitInfo.zone === 'head' || hitInfo.zone === 'neck');
  return { landed, hitT, hitInfo };
}

/** 이분 탐색으로 "닿는 최대 거리"를 찾는다 (lo=반드시 닿음, hi=반드시 안 닿음에서 시작) */
function bisectMaxDist(weaponId, opts) {
  let lo = 0.9;
  let hi = 2.6;
  // hi에서 안 닿는지, lo에서 닿는지 먼저 확인 (범위를 벗어나면 늘림/줄임)
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const r = trySwing(weaponId, mid, opts);
    if (r.landed) lo = mid;
    else hi = mid;
  }
  return { dist: lo, ...trySwing(weaponId, lo, opts) };
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WEAPONS);
const rows = [];
for (const id of ids) {
  const contactR = bisectMaxDist(id, { lunge: false });
  const reachR = bisectMaxDist(id, { lunge: true });
  const contact = +contactR.dist.toFixed(2);
  const reach = +reachR.dist.toFixed(2);
  const clinch = +(contact * (1.25 / 1.62)).toFixed(2); // 롱소드 비율로 유도 (실측 아님)
  const cutTime = contactR.hitT != null ? +contactR.hitT.toFixed(2) : null;
  rows.push({ id, contact, reach, clinch, cutTime });
  console.log(`${id.padEnd(16)} contact=${contact}  reach=${reach}  clinch=${clinch}  cutTime=${cutTime ?? '-'}`);
}
console.log('\n' + JSON.stringify(rows, null, 1));
