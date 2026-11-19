// 무리 싸움 판단 바탕 재기 (11/18 — docs/design/team_sense_2026-11-18.md §2): 2:2 · 2:1 · 셋 따로(ffa3) AI 판의 '편 싸움 판단'이 지금 얼마나 있나.
//  재기 전용 도구 — 게임 코드는 읽기만 한다. 한 과정에서 판을 차례로 돌린다 (자식 과정 없음 — 기계를 나눠 쓰므로).
//  AI = aiAtProficiency(무기만 가진 시트 — 무명 검객 꼴, 숙련도 p) · 한 판의 넷은 같은 숙련도(판마다 --profs 를 돌아가며) · 섞인 무기(team_fights.mjs 와 같은 loadout) ·
//   겉모습 모두 같음(투구 없음) · 벽 있음 · 한 편 전멸(ffa3 = 하나 남음) 또는 maxSecs.
//  ffa3 = 셋이 저마다 따로인 판 — 게임에는 없는 판이다(Fighter 편은 0 · 1 만 · 편 전멸도 두 편). 이 도구만 몸을 세운 뒤 f.team 을 자리 번호로 바꿔 흉내 낸다
//   (셋 이상 판의 ffa 비트는 자리마다라 물리는 그대로 · sameSide 가 자기만 같은 편 → 상대 고르기 · 상대 목록이 셋 따로).
//  쓰임: node tools/sim/team_sense.mjs [판 수/모드 48] [maxSecs 90] [--modes=2v2,2v1,ffa3] [--profs=2,4,6] [--sides=6:5] [--lone=german] [--field=even|none] [--lever=none] [--seeding=old] [--ks=1,5] [--json] [--out=파일]
//   --sides=A:B  편마다 숙련도 (2:2 는 A 편을 판마다 0 편 · 1 편 번갈아 · 2:1 은 A = 혼자) — sideAWinPct (ffa3 는 쓰지 않음)
//  판 짜기 (11/18 P1 — 무리 싸움 판단 작업에서 고침): 무기 배정(loadout)의 씨앗과 숙련 · 편을 서로 엇갈리게 —
//   예전 짜기(--seeding=old)는 판 k 의 씨앗 k + 1 로 무기를 나눠 ① 2:2 --sides 에서 A 편이 늘 홀수 칸 무기(츠바이핸더 · 사브르 · 에스톡)를,
//   B 편이 늘 짝수 칸 무기(롱소드 · 레이피어 · 우치가타나)를 들었고 ② 숙련도를 판마다 돌릴 때 숙련마다 무기 배정이 두 벌뿐이었다(씨앗 mod 6).
//   새 짜기: 2:2 --sides 는 무기 씨앗 하나를 두 판(A 편 = 0 편 · 1 편)으로 거울 — 같은 무기 · 같은 난수 씨앗에서 숙련만 맞바꿈 ·
//   숙련 돌림은 무기 씨앗 = ⌊k ÷ 숙련 수⌋ + 1 (숙련마다 같은 무기 배정 차례). 난수 씨앗은 판마다 k + 1 (거울 짝은 같은 씨앗)
//  더한 잣대 (11/18 P1): hitBackPct 상처 가운데 등 뒤(맞은 서 있는 몸이 바라보는 쪽에서 120° 넘게)에서 · firstKillMedSec 첫 죽음 판 시간 가운데 · maxQuietMedSec 상처 없이 흐른
//   가장 긴 시간 가운데(멈춘 판 잣대) · teamSense 무리 싸움 판단 재기 칸 합(ai.stats.team — 칼길 미룸 · 비킴 · 집게 돎 · 기습 … · 역할 수)
//  편마다 재기 (--sides): sideStats — 편 A · B 의 공격 시작 / 산 분 · 상처 낸 수 / 산 분 · 받은 상처 가운데 겨누지 않은 몸에게(옆 · 뒤에서 온 칼) 몫 · 꼴 몫(간 보기 · 공격 · 막기 · 물러남) ·
//   (11/19 고수 혼자) outFrontPct 4 m 안 적 둘 표본에서 둘 다 앞(±60°) · outLinePct 그 둘 사이 각 45° 밑(한 줄) · in2Pct · in1Pct 서 있는 적 둘 이상인 표본에서 내게 닿는(그 적 칼끝 + 0.5 안) 적이 둘 · 하나 ·
//   killMedSec · killN 그 편의 적이 처음 죽은 판 시간 가운데 · 판 수 · exhPct 탈진(제자리 숨 고르기) 표본 몫 · lowPct 기력 20 밑(탈진 아님) 몫
//  재는 것 (뜻은 docs/design/team_sense_2026-11-18.md §2 표 — 아래 주석과 같음):
//   표본(20 Hz — 6 스텝마다, 판이 살아 있는 동안):
//    focus      같은 편 둘(서 있음)이 같은 상대를 겨눈 몫 (상대도 둘 이상 서 있을 때 — 2:2 만 뜻이 있음)
//    coEngage   같은 편 둘이 같은 상대에게 '닿는 거리'(제 칼끝 reach + 0.5 m) 안에 함께 있는 몫 (같은 편 둘 · 그 상대 서 있음)
//    pincer     coEngage 표본에서 그 상대 자리에서 본 두 몸 사이 각 (°) — 가운데 · ≥ 90° 몫 · ≥ 135° 몫
//    backExp    서 있는 몸 표본 가운데 2.5 m 안에 서 있는 적이 등 뒤(바라보는 쪽에서 120° 넘게)에 있는 몫
//    outnum     서 있는 적 둘 이상이 4 m 안에 있는 몸 표본: 둘 다 앞(±60°) 몫 · 두 적 사이 각 가운데 · ≤ 45°(한 줄) 몫 · ≥ 120°(집게) 몫
//    blocked    내 상대와 나 사이에 같은 편 몸이 있는 몫 (같은 편이 나보다 상대에 가깝지 않고 · 나 → 상대 선분에서 0.5 m 안)
//    ambushOpp  기습 기회: 내 편이 아닌 다른 몸과 붙은(그 몸을 겨눔 · 제 닿는 거리 안) 적이 4 m 안 · 그 적의 앞(±60°) 밖에 내가 있는 표본 —
//               그 동안 내가 그 적을 겨눈 몫(uptake) · 그 적에게 닿는 거리 안인 몫(close)
//   사건:
//    hits       다른 편 산 몸에 난 상처 — unattended(맞은 몸이 친 몸을 겨누지 않음) · busy(맞은 몸이 다른 몸과 붙어 있음 = 기습) · blind(busy 이고 친 몸이 맞은 몸 앞 ±60° 밖) · onDown(맞은 몸이 서 있지 않음)
//    attacks    AI 공격 시작(꼴이 attack 으로) — coAtk(같은 편이 0.6 s 안에 같은 상대에게 공격을 시작했거나 공격 중) · intoBusy(그 상대가 다른 몸과 붙어 있음)
//    switches   상대 바꿈 / 산 분 · 까닭(gone 죽음 · attacked 나를 침 · held 더 나은 상대가 1.2 s)
//    help       같은 편이 쓰러짐(서 있지 않음 — 산 채) 또는 피 0.75 밑으로: 3 s 안에 서 있던 동료가 그 몸을 친(겨눈) 적을 겨눔 · 그 적의 닿는 거리 안에 듦 · 쓰러진 몸이 다시 베임
//    mate       같은 편 상처 (산 몸) / 판 · 심각도 0.5 넘음 · 그 칼에 죽음
//   상처 = 심각도 HIT_SEV(0.05) 넘는 것만 (닿기만 한 심각도 0 은 뺌 — team_fights.mjs 의 '상처'는 이것까지 셈)
//    pairOneWaits 같은 편 둘이 같은 상대를 겨눴는데 하나만 닿는 거리 (다른 하나는 뒤에서 기다림) 몫 — coEngage 와 같은 바탕
//  뛰기 재기 (11/19 AI 뛰기 — docs/strike/ai_run_2026-11-19.md):
//    runs · runSec   판마다 뛰기 시작 수 · 뛴 시간 (몸마다 f.run.runs · runT 합) · runKinds = ai.stats.run 칸 합 (까닭마다 시작 수)
//    runEnd          뛰기가 끝난 때(on → off): 까닭(f.run.end) · 기력 · 겨눈 상대 칼끝까지 남은 거리(가슴 사이 − 상대 칼끝 reach — 0 밑 = 칼끝 안에서 끝남)
//    far             먼 다가감: 서 있는 몸(판 시작 발 묶임 뒤)이 겨눈 상대(서 있음)와 제 칼끝 + FAR 넘게 떨어진 때부터 그 상대에게 닿는 거리(칼끝 + 0.5) 안에 들 때까지 —
//                    걸린 시간 · 닿은 때 기력 · 그 사이 뛰었나 (상대를 바꾸거나 쓰러지면 버림) · farLate = 판 시작 다가감(발 묶임이 풀린 뒤 1 s 안에 시작)을 뺀 것
//    hitRun          상처 가운데 맞은 몸이 뛰는 중이거나 뛴 뒤 상대 쪽으로 돌아오는 중(f.run.back) · 친 몸이 살아 있음(막 죽은 몸의 쓰러지는 칼은 뺌) · 그 가운데 등 뒤(120° 넘게)에서
import { RAPIER, THREE, CONFIG, AI, newMatch, DT } from './jelly_harness.mjs';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { Combat } from '../../src/combat.js';
import { setSupportFloor } from '../../src/gait.js';
import { createMatch, stepMatch, orderControllers, pairFoe } from '../../src/match.js';
import { targetable, reachOf } from '../../src/targeting.js';
import { aiAtProficiency } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = args.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const N = +(pos[0] ?? 48);
const MAX = +(pos[1] ?? 90);
const MODES = String(flag('modes', '2v2,2v1,ffa3')).split(',');
const PROFS = String(flag('profs', '2,4,6')).split(',').map(Number);
const LEVER_OFF = flag('lever', '') === 'none'; // --lever=none: 숙련도 레버(TEAM_FIGHT.lever 줄 세우기 · 피하기)를 끈 판 (재기 전용 — 까닭 가르기)
if (LEVER_OFF) for (const v of Object.values(CONFIG.TEAM_FIGHT.lever)) if (v && typeof v === 'object' && 'on' in v) v.on = false;
const KS = flag('ks', null) ? new Set(String(flag('ks')).split(',').map(Number)) : null; // --ks=3,7: 그 판 번호(1 부터)만 돌림 (까닭 가르기 — 판 짜기는 그대로)
const SIDES = flag('sides', null) ? String(flag('sides')).split(':').map(Number) : null; // --sides=6:5 — 편마다 숙련도 (A:B · 판마다 A 편을 0 편 · 1 편으로 번갈아 — 자리 쏠림 없게). 2:1 은 A = 혼자(자리 1) 고정
// --lone=german (11/19 고수 혼자 · 유파별): 2:1 --sides 판의 혼자(자리 1) 무기를 그 유파 대표 무기 둘(ai_ring_measure.mjs 와 같음)에서 씨앗 홀짝으로 · 둘 쪽은 그대로(loadout 섞인 무기)
const LONE_W = { german: ['longsword', 'kriegsmesser'], italian: ['rapier', 'pappenheimer'], iberian: ['zweihander', 'flamberge'], japanese: ['uchigatana', 'monohoshizao'], chinese: ['hwando', 'qinggang'] };
const LONE = flag('lone', null);
if (LONE && !LONE_W[LONE]) throw new Error(`--lone=${LONE}`);
// --field=even · none (11/19 — 사장님 '상대 쪽 유파가 통제되지 않으면 확률이 오염됨' · 2:1 --sides 판의 둘 쪽 · 안 주면 loadout 섞인 무기 그대로):
//  even  둘 쪽 두 몸의 유파를 다섯 유파 순서 있는 짝 25 가지(같은 유파 짝 포함)로 판마다 돌림 (판 k → 짝 k mod 25) · 무기는 그 유파 대표 무기 둘(LONE_W)에서 씨앗 홀짝
//  none  둘 쪽 두 몸을 무유파 칼잡이로 — 롱소드를 쥐되 AI 꾸러미 유파 none (재기 전용 꾸러미 SCHOOLS.none_sword = weaponSchool(롱소드, 'none') — 무유파 기술 · 비기 · 패시브 · 마음가짐 없음 ·
//        몸 걸음은 롱소드 몸 그대로 = 독일 · 무유파 걸음 칸 없음)
const FIELD = flag('field', null);
const FIELD_SCH = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
if (FIELD && FIELD !== 'even' && FIELD !== 'none') throw new Error(`--field=${FIELD}`);
if (FIELD === 'none') { const S = await import('../../src/schools.js'); const { WEAPONS: WP } = await import('../../src/weapons.js'); S.SCHOOLS.none_sword ??= S.weaponSchool(WP.longsword, 'none'); }
/** 2:1 --field 판의 둘 쪽 몸 i(자리 0 · 2) 무기 · 꾸러미 (판 k · 씨앗 seed) */
const fieldBody = (k, seed, i) => (FIELD === 'none' ? { weapon: 'longsword', school: 'none_sword' } : { weapon: LONE_W[FIELD_SCH[i === 0 ? Math.floor((k % 25) / 5) : k % 5]][seed % 2] });
const OLD_SEEDING = flag('seeding', '') === 'old'; // --seeding=old: 예전 판 짜기 (무기 씨앗 = 판 씨앗 = k + 1 — 위 '판 짜기' — 견줌 전용)
const WEAPONS = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang']; // 11/19 사장님 '잴 때(뭘 재는 거든) 에스톡과 세이버는 쓰지 마' — 다섯 유파 대표 무기 열 (유파마다 둘 · ai_ring_measure.mjs 와 같음)
const loadout = (seed, count) => Array.from({ length: count }, (_, i) => WEAPONS[(seed * 7 + i * 3) % WEAPONS.length]); // 걸음 3 — 한 판 넷까지 서로 다른 무기 (0 · 3 · 6 · 9) · 씨앗 7 걸음으로 열을 다 돎
const SAMPLE = 6; // 6 스텝 = 20 Hz
const FAR = 3; // 먼 다가감 문턱 (m — 제 칼끝 + 이만큼 넘게 떨어짐)
const OPEN_T = CONFIG.ARENA.startHold + 1; // 판 시작 다가감(발 묶임이 풀린 뒤 1 s 안에 시작)을 뺀 먼 다가감 = farLate
const HIT_SEV = 0.05; // 상처로 세는 심각도 (그 밑 = 닿기만 한 것 — 같은 편끼리 부딪힘이 대부분)
const deg = (r) => (r * 180) / Math.PI;

// ── 셋 따로 판 (ffa3) — newMatch 와 같은 세계 · 세모 자리 · 편을 자리 번호로 (재기 전용) ──
function newFfa(count, { seed, weapons, aiOf }) {
  const { PHYSICS, ARENA } = CONFIG;
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor);
  const nw = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < nw; i++) {
    const a = (i / nw) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / nw) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS), ground);
  }
  const scene = new THREE.Scene();
  const r = ARENA.startGap / (2 * Math.sin(Math.PI / count)); // 이웃 사이 = startGap
  const fighters = [];
  for (let i = 0; i < count; i++) {
    const a = Math.PI + (2 * Math.PI * i) / count; // 자리 0 = −x (1:1 의 자리 0 과 같은 쪽)
    fighters.push(new Fighter(RAPIER, world, scene, colliderInfo, { index: i, team: i % 2, name: `F${i}`, x: r * Math.cos(a), z: r * Math.sin(a), heading: Math.PI - a, look: LOOKS.enemy, breakSeed: seed, weapon: weapons[i], ffa: true }));
  }
  for (const f of fighters) f.team = f.index; // 셋 따로 (재기 전용 — 물리 비트는 ffa 자리마다라 그대로)
  const M0 = { fighters };
  const order = orderControllers(fighters.map((f) => ({ me: f }))).map((c) => c.me.index);
  const ais = [];
  for (const i of order) { const a = aiOf(i); ais[i] = new AI(fighters[i], pairFoe(fighters[i], M0), a.level, a.persona); }
  const combat = new Combat(colliderInfo, { onWound: () => {}, onClash: () => {} });
  const G = createMatch({ world, eventQueue, combat, fighters, controllers: order.map((i) => ais[i]) });
  Object.assign(G, { ais });
  const hooks = { afterControl: () => G.before?.(G.t) };
  G.step = () => stepMatch(G, DT, hooks);
  return G;
}

const chest = (f) => f.bodies.chest.translation();
const hd = (a, b) => { const p = chest(a), q = chest(b); return Math.hypot(q.x - p.x, q.z - p.z); };
/** a 의 바라보는 쪽에서 b 까지 각 (rad, 0 ~ π) */
const offFacing = (a, b) => {
  const p = chest(a), q = chest(b), F = a.forward(new THREE.Vector3());
  const x = q.x - p.x, z = q.z - p.z, d = Math.hypot(x, z) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (x * F.x + z * F.z) / d)));
};
/** o 자리에서 본 a · b 사이 각 (rad) */
const angAt = (o, a, b) => {
  const c = chest(o), p = chest(a), q = chest(b);
  const ax = p.x - c.x, az = p.z - c.z, bx = q.x - c.x, bz = q.z - c.z;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1))));
};
const standing = (f) => f.alive && !f.revival && f.state === 'stand';
const engaged = (a, x) => hd(a, x) <= reachOf(a) + 0.5; // 닿는 거리
const isAtk = (f) => !!f.aiCtl && (f.aiCtl.mode === 'attack' || !!f.aiCtl.secretRun);
/** x 가 a 아닌 다른 몸과 붙어 있나 (그 몸을 겨눔 · 서로 닿는 거리) */
const busyWithOther = (x, a) => !!x.foe && x.foe !== a && targetable(x.foe) && engaged(x, x.foe);

function fight(mode, seed, prof, sideA = null, wseed = seed, k = seed - 1) {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const count = mode === '2v1' || mode === 'ffa3' ? 3 : 4;
  const weapons = loadout(wseed, count);
  if (LONE && mode === '2v1' && sideA === 1) weapons[1] = LONE_W[LONE][seed % 2]; // 혼자 유파 (--lone)
  const packs = [];
  if (FIELD && mode === '2v1' && sideA === 1) for (const i of [0, 2]) { const b = fieldBody(k, seed, i); weapons[i] = b.weapon; packs[i] = b.school; } // 둘 쪽 (--field)
  const profOf = (i) => (sideA == null ? prof : (i % 2 === sideA ? SIDES[0] : SIDES[1])); // --sides: 자리 홀짝 = 편
  const aiOf = (i) => aiAtProficiency({ ai: { persona: packs[i] ? { school: packs[i] } : {} }, weapon: weapons[i] }, profOf(i));
  const G = mode === 'ffa3' ? newFfa(count, { seed, weapons, aiOf }) : newMatch({ count, ai: 'all', seed, walls: true, weapons, looks: Array(count).fill(LOOKS.enemy), aiOf });
  const F = G.fighters;
  const mates = (f) => F.filter((g) => g !== f && g.team === f.team);
  const foes = (f) => F.filter((g) => g.team !== f.team);
  const C = { samples: 0, pairS: 0, focus: 0, coS: 0, co: 0, solo: 0, pincer: [], fS: 0, back: 0, outS: 0, outFront: 0, outSep: [], blockS: 0, blocked: 0, oppS: 0, oppUp: 0, oppClose: 0,
    hits: 0, unatt: 0, busy: 0, blind: 0, onDown: 0, atk: 0, coAtk: 0, intoBusy: 0, mate: 0, mateSevere: 0, mateKill: 0, helpEv: 0, helpSwitch: 0, helpClose: 0, helpHitAgain: 0, downEv: 0, aliveMin: 0,
    hitBack: 0, firstKill: null, lastHitT: 0, maxQuiet: 0, hitRun: 0, hitRunBack: 0, runEnd: [], far: [],
    side: [0, 1].map(() => ({ aliveMin: 0, atk: 0, hits: 0, hitBusy: 0, hitBack: 0, got: 0, gotUnatt: 0, modeS: 0, watch: 0, attack: 0, defend: 0, withdraw: 0, outS: 0, outFront: 0, outLine: 0, inS: 0, in2: 0, in1: 0, killT: null, exh: 0, low: 0 })) }; // 편마다 (--sides: 0 = A 편 · 1 = B 편) · 열세 · 닿는 적 수 · 첫 적 죽인 때 (11/19 고수 혼자)
  const sideOf = (f) => (sideA == null ? (f.team === 0 ? 0 : 1) : f.team === sideA ? 0 : 1);
  const wasAlive = new Map();
  const lastAtk = new Map(); // 싸움꾼 → { t, foe } 마지막 공격 시작
  const prevMode = new Map();
  const prevStand = new Map(F.map((f) => [f, true]));
  const prevBlood = new Map(F.map((f) => [f, f.blood]));
  const watches = []; // 동료 돕기 창 { b(다친 몸), x(그 적), mates, until, sw:Set, close:Set, hitAgain, down }
  const runOn = new Map(); // 뛰기 켜짐 (지난 스텝)
  const farEp = new Map(); // 먼 다가감 { x, t, runs }
  G.combat.hooks.onWound = (att, vic, r) => {
    if (!wasAlive.get(vic) || att === vic || (r?.severity ?? 0) < HIT_SEV) return; // 심각도 0 의 닿음(몸 · 칼 부딪힘)은 빼고 상처만
    if (att.team === vic.team) { C.mate++; if ((r?.severity ?? 0) >= 0.5) C.mateSevere++; if (!vic.alive) C.mateKill++; return; }
    C.hits++;
    C.side[sideOf(att)].hits++;
    C.side[sideOf(vic)].got++;
    if (vic.state !== 'stand') C.onDown++;
    if (vic.foe !== att) C.unatt++, C.side[sideOf(vic)].gotUnatt++;
    if (vic.state === 'stand' && busyWithOther(vic, att)) { C.busy++; C.side[sideOf(att)].hitBusy++; if (offFacing(vic, att) > Math.PI / 3) C.blind++; }
    if (vic.state === 'stand' && offFacing(vic, att) > (2 * Math.PI) / 3) C.hitBack++, C.side[sideOf(att)].hitBack++; // 등 뒤에서 (맞은 몸이 바라보는 쪽에서 120° 넘게)
    if ((vic.run?.on || vic.run?.back) && att.alive) { C.hitRun++; if (offFacing(vic, att) > (2 * Math.PI) / 3) C.hitRunBack++; } // 뛰는 중 · 뛴 뒤 돌아오는 중에 산 적에게 맞음 (막 죽은 몸의 쓰러지는 칼은 뺌)
    C.maxQuiet = Math.max(C.maxQuiet, G.t - C.lastHitT);
    C.lastHitT = G.t;
    for (const w of watches) if (w.b === vic && G.t <= w.until) w.hitAgain = true;
  };
  G.before = () => { for (const f of F) wasAlive.set(f, f.alive); };
  const n = Math.round(MAX / DT);
  const live = () => (mode === 'ffa3' ? F.filter((f) => f.alive).length > 1 : !G.over);
  let i = 0;
  for (; i < n && live(); i++) {
    G.step();
    for (const f of F) if (f.alive) (C.aliveMin += DT / 60), (C.side[sideOf(f)].aliveMin += DT / 60);
    if (C.firstKill == null && F.some((f) => !f.alive)) C.firstKill = G.t; // 첫 죽음 (판 시간)
    for (const k of [0, 1]) if (C.side[k].killT == null && F.some((f) => !f.alive && sideOf(f) !== k)) C.side[k].killT = G.t; // 편 k 의 적이 처음 죽은 때
    // 뛰기 끝 · 먼 다가감
    for (const f of F) {
      const on = !!f.run?.on;
      if (runOn.get(f) && !on) C.runEnd.push({ why: f.run.end, st: +f.stamina.value.toFixed(1), gap: f.foe ? +(hd(f, f.foe) - reachOf(f.foe)).toFixed(2) : null });
      runOn.set(f, on);
      const x = f.foe;
      if (!standing(f) || f.feetHeld || !x || !standing(x)) { farEp.delete(f); continue; }
      const ep = farEp.get(f);
      const D = hd(f, x);
      if (ep && ep.x !== x) farEp.delete(f);
      if (!farEp.get(f)) { if (D > reachOf(f) + FAR) farEp.set(f, { x, t: G.t, d: D - reachOf(f), runs: f.run?.runs ?? 0 }); continue; }
      if (D <= reachOf(f) + 0.5) { C.far.push({ t0: +ep.t.toFixed(2), d0: +ep.d.toFixed(2), dt: +(G.t - ep.t).toFixed(2), st: +f.stamina.value.toFixed(1), ran: (f.run?.runs ?? 0) > ep.runs }); farEp.delete(f); }
    }
    // 사건: AI 공격 시작
    for (const f of F) {
      const m = f.aiCtl?.mode;
      const was = prevMode.get(f);
      prevMode.set(f, m);
      if (!f.alive || m !== 'attack' || was === 'attack' || !f.foe) continue;
      C.atk++;
      C.side[sideOf(f)].atk++;
      const x = f.foe;
      if (mates(f).some((g) => g.alive && g.foe === x && (isAtk(g) || (lastAtk.get(g)?.foe === x && G.t - lastAtk.get(g).t <= 0.6)))) C.coAtk++;
      if (busyWithOther(x, f)) C.intoBusy++;
      lastAtk.set(f, { t: G.t, foe: x });
    }
    // 사건: 동료가 쓰러짐 · 피 0.75 밑으로
    for (const b of F) {
      const st = standing(b), was = prevStand.get(b);
      const down = was && !st && b.alive && !b.revival;
      const hurt = prevBlood.get(b) >= 0.75 && b.blood < 0.75 && b.alive;
      prevStand.set(b, st);
      prevBlood.set(b, b.blood);
      if (!(down || hurt)) continue;
      const ms = mates(b).filter(standing);
      if (!ms.length) continue;
      const fx = foes(b).filter(standing);
      const x = fx.filter((g) => g.foe === b).sort((p, q) => hd(p, b) - hd(q, b))[0] ?? fx.sort((p, q) => hd(p, b) - hd(q, b))[0];
      if (!x) continue;
      watches.push({ b, x, ms, until: G.t + 3, sw: new Set(), close: new Set(), hitAgain: false, down });
      if (down) C.downEv++;
    }
    for (const w of watches) {
      if (G.t > w.until || w.done) continue;
      for (const a of w.ms) if (a.alive) { if (a.foe === w.x) w.sw.add(a); if (engaged(a, w.x)) w.close.add(a); }
    }
    for (const w of watches) if (!w.done && G.t > w.until) {
      w.done = true;
      C.helpEv += w.ms.length;
      C.helpSwitch += w.sw.size;
      C.helpClose += w.close.size;
      if (w.down && w.hitAgain) C.helpHitAgain++;
    }
    if (i % SAMPLE) continue;
    C.samples++;
    // 표본
    for (const a of F) {
      if (!standing(a)) continue;
      const fs = foes(a).filter(standing);
      if (!fs.length) continue;
      C.fS++;
      const sd = C.side[sideOf(a)], am = a.aiCtl?.mode;
      sd.modeS++;
      if (am === 'watch' || am === 'attack' || am === 'defend' || am === 'withdraw') sd[am]++;
      if (a.stamina.exhausted) sd.exh++; // 탈진 (제자리 숨 고르기)
      else if (a.stamina.value < 20) sd.low++; // 기력 20 밑
      if (fs.some((x) => hd(a, x) <= 2.5 && offFacing(a, x) > (2 * Math.PI) / 3)) C.back++;
      const near = fs.filter((x) => hd(a, x) <= 4).sort((p, q) => hd(a, p) - hd(a, q));
      if (near.length >= 2) {
        C.outS++;
        sd.outS++;
        if (offFacing(a, near[0]) <= Math.PI / 3 && offFacing(a, near[1]) <= Math.PI / 3) C.outFront++, sd.outFront++;
        C.outSep.push(deg(angAt(a, near[0], near[1])));
        if (angAt(a, near[0], near[1]) <= Math.PI / 4) sd.outLine++;
      }
      if (fs.length >= 2) { // 적 둘 이상 서 있음: 내게 닿는(그 적 칼끝 + 0.5 안) 적 수
        sd.inS++;
        const nIn = fs.filter((x) => hd(a, x) <= reachOf(x) + 0.5).length;
        if (nIn >= 2) sd.in2++;
        else if (nIn === 1) sd.in1++;
      }
      const x = a.foe;
      const ms = mates(a).filter(standing);
      if (x && standing(x) && ms.length) {
        C.blockS++;
        const p = chest(a), q = chest(x), dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
        if (ms.some((b) => { const c = chest(b); const t = ((c.x - p.x) * dx + (c.z - p.z) * dz) / L; const perp = Math.abs((c.x - p.x) * dz - (c.z - p.z) * dx) / L; return t > 0 && t < L && perp < 0.5; })) C.blocked++;
      }
      // 기습 기회 (다른 몸과 붙은 적 · 4 m 안 · 그 적 앞 ±60° 밖)
      for (const y of fs) {
        if (hd(a, y) > 4 || !busyWithOther(y, a) || offFacing(y, a) <= Math.PI / 3) continue;
        C.oppS++;
        if (a.foe === y) C.oppUp++;
        if (engaged(a, y)) C.oppClose++;
        break;
      }
    }
    // 같은 편 둘
    for (const t of new Set(F.map((f) => f.team))) {
      const pair = F.filter((f) => f.team === t && standing(f));
      if (pair.length < 2) continue;
      const [a, b] = pair;
      const fs = foes(a).filter(standing);
      if (!fs.length) continue;
      if (fs.length >= 2) { C.pairS++; if (a.foe === b.foe) C.focus++; }
      C.coS++;
      const x = fs.find((y) => engaged(a, y) && engaged(b, y));
      if (x) { C.co++; C.pincer.push(deg(angAt(x, a, b))); }
      else if (fs.some((y) => (engaged(a, y) && b.foe === y) || (engaged(b, y) && a.foe === y))) C.solo++; // 둘이 같은 상대를 겨눴는데 하나만 닿는 거리 — 다른 하나는 뒤에서 기다림
    }
  }
  for (const w of watches) if (!w.done) { w.done = true; C.helpEv += w.ms.length; C.helpSwitch += w.sw.size; C.helpClose += w.close.size; if (w.down && w.hitAgain) C.helpHitAgain++; }
  const sw = { n: 0, gone: 0, attacked: 0, held: 0 };
  for (const f of F) { const st = G.targeting?.get(f); if (!st) continue; sw.n += st.switches; for (const k of ['gone', 'attacked', 'held']) sw[k] += st.why[k]; }
  C.maxQuiet = Math.max(C.maxQuiet, G.t - C.lastHitT); // 상처 없이 흐른 가장 긴 시간 (멈춘 판 잣대)
  const runs = F.reduce((q, f) => q + (f.run?.runs ?? 0), 0);
  const runSec = +F.reduce((q, f) => q + (f.run?.runT ?? 0), 0).toFixed(2);
  const runKinds = {};
  for (const f of F) for (const [k, v] of Object.entries(f.aiCtl?.stats?.run ?? {})) runKinds[k] = (runKinds[k] ?? 0) + v;
  const team = {}; // 무리 싸움 판단 재기 칸 (ai.stats.team — 몸마다 더함 · 판 사본 역할 수)
  for (const f of F) for (const [k, v] of Object.entries(f.aiCtl?.stats?.team ?? {})) team[k] = (team[k] ?? 0) + v;
  for (const [k, v] of Object.entries(G.sense?.roleN ?? {})) team[`role_${k}`] = v;
  const alive = F.filter((f) => f.alive);
  const winner = mode === 'ffa3' ? (alive.length === 1 ? alive[0].index : null) : G.winner;
  const end = F.map((f) => `${sideOf(f) ? 'B' : 'A'}${f.alive ? (f.state === 'stand' ? '' : f.state[0]) + f.blood.toFixed(2) : 'x'}`).join(' '); // 판 끝 몸 (편 · 꼴 첫 글자 · 피 · x 죽음)
  return { mode, seed, wseed, prof, sideA, team, end, runs, runSec, runKinds, weapons: [...weapons], packs: [...packs], aWon: sideA == null ? null : winner === sideA, t: +G.t.toFixed(2), over: mode === 'ffa3' ? alive.length <= 1 : G.over, winner, sw, ...C };
}

const rows = [];
const t0 = Date.now();
for (const mode of MODES) for (let k = 0; k < N; k++) {
  if (KS && !KS.has(k + 1)) continue;
  const prof = SIDES ? -1 : PROFS[k % PROFS.length];
  const sideA = SIDES ? (mode === '2v1' ? 1 : k % 2) : null;
  // 판 짜기 (위 머리 주석): 새 = 2:2 편 숙련은 거울 짝(같은 씨앗 · A 편 0 · 1) · 숙련 돌림은 숙련마다 같은 무기 차례 · 2:1 편 숙련은 예전과 같음
  const mirror = SIDES && mode !== '2v1';
  const seed = OLD_SEEDING ? k + 1 : mirror ? Math.floor(k / 2) + 1 : k + 1;
  const wseed = OLD_SEEDING ? k + 1 : mirror ? seed : SIDES ? k + 1 : Math.floor(k / PROFS.length) + 1;
  const r = fight(mode, seed, prof, sideA, wseed, k);
  rows.push(r);
  process.stderr.write(`${mode} #${k + 1} p${prof} ${r.t}s ${r.over ? `이김 ${r.winner}` : '끝 안 남'} [${r.end}] (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? +(b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2).toFixed(1) : null; };
function summary(R, label) {
  const S = (k) => R.reduce((s, r) => s + r[k], 0);
  const cat = (k) => R.flatMap((r) => r[k]);
  const am = S('aliveMin');
  const pin = cat('pincer'), sep = cat('outSep');
  return {
    label, fights: R.length, medianSec: med(R.map((r) => r.t)), unfinished: R.filter((r) => !r.over).length,
    focusPct: pct(S('focus'), S('pairS')), coEngagePct: pct(S('co'), S('coS')), pairOneWaitsPct: pct(S('solo'), S('coS')),
    pincerMedDeg: med(pin), pincerGe90Pct: pct(pin.filter((x) => x >= 90).length, pin.length), pincerGe135Pct: pct(pin.filter((x) => x >= 135).length, pin.length),
    backExposedPct: pct(S('back'), S('fS')),
    outnumberedSamplesPct: pct(S('outS'), S('fS')), outBothFrontPct: pct(S('outFront'), S('outS')), outSepMedDeg: med(sep), outSepLe45Pct: pct(sep.filter((x) => x <= 45).length, sep.length), outSepGe120Pct: pct(sep.filter((x) => x >= 120).length, sep.length),
    blockedByMatePct: pct(S('blocked'), S('blockS')),
    ambushOppPct: pct(S('oppS'), S('fS')), ambushUptakePct: pct(S('oppUp'), S('oppS')), ambushClosePct: pct(S('oppClose'), S('oppS')),
    firstKillMedSec: med(R.filter((r) => r.firstKill != null).map((r) => r.firstKill)), maxQuietMedSec: med(R.map((r) => r.maxQuiet)), hitBackPct: pct(S('hitBack'), S('hits')),
    hitsPerAliveMin: +(S('hits') / Math.max(1e-9, am)).toFixed(2), hitUnattendedPct: pct(S('unatt'), S('hits')), hitBusyPct: pct(S('busy'), S('hits')), hitBlindBusyPct: pct(S('blind'), S('hits')), hitOnDownPct: pct(S('onDown'), S('hits')),
    attacksPerAliveMin: +(S('atk') / Math.max(1e-9, am)).toFixed(2), coAttackPct: pct(S('coAtk'), S('atk')), attackIntoBusyPct: pct(S('intoBusy'), S('atk')),
    switchesPerAliveMin: +(R.reduce((s, r) => s + r.sw.n, 0) / Math.max(1e-9, am)).toFixed(2), switchWhy: ['gone', 'attacked', 'held'].map((k) => `${k} ${R.reduce((s, r) => s + r.sw[k], 0)}`).join(' · '),
    helpEvents: S('helpEv'), helpSwitchPct: pct(S('helpSwitch'), S('helpEv')), helpClosePct: pct(S('helpClose'), S('helpEv')), downEvents: S('downEv'), downedHitAgainPct: pct(S('helpHitAgain'), S('downEv')),
    mateWoundsPerFight: +(S('mate') / Math.max(1, R.length)).toFixed(2), mateSevere: S('mateSevere'), mateKills: S('mateKill'),
    ...(SIDES ? { sideAWinPct: pct(R.filter((r) => r.aWon).length, R.length), sideAWins: R.filter((r) => r.aWon).length, sideBWins: R.filter((r) => r.over && r.winner != null && !r.aWon).length, sideA: SIDES[0], sideB: SIDES[1] } : {}),
    sideStats: [0, 1].map((k) => {
      const Sd = (q) => R.reduce((s, r) => s + r.side[k][q], 0);
      const m = Sd('aliveMin');
      return { atkPerMin: +(Sd('atk') / Math.max(1e-9, m)).toFixed(2), hitsPerMin: +(Sd('hits') / Math.max(1e-9, m)).toFixed(2), gotPerMin: +(Sd('got') / Math.max(1e-9, m)).toFixed(2), gotUnattPct: pct(Sd('gotUnatt'), Sd('got')),
        hitBusyPct: pct(Sd('hitBusy'), Sd('hits')), hitBackPct: pct(Sd('hitBack'), Sd('hits')),
        watchPct: pct(Sd('watch'), Sd('modeS')), attackPct: pct(Sd('attack'), Sd('modeS')), defendPct: pct(Sd('defend'), Sd('modeS')), withdrawPct: pct(Sd('withdraw'), Sd('modeS')),
        outFrontPct: pct(Sd('outFront'), Sd('outS')), outLinePct: pct(Sd('outLine'), Sd('outS')), in2Pct: pct(Sd('in2'), Sd('inS')), in1Pct: pct(Sd('in1'), Sd('inS')),
        killMedSec: med(R.filter((r) => r.side[k].killT != null).map((r) => r.side[k].killT)), killN: R.filter((r) => r.side[k].killT != null).length,
        exhPct: pct(Sd('exh'), Sd('modeS')), lowPct: pct(Sd('low'), Sd('modeS')) };
    }),
    teamSense: (() => { const o = {}; for (const r of R) for (const [k, v] of Object.entries(r.team ?? {})) o[k] = (o[k] ?? 0) + v; return o; })(),
    ...runSummary(R),
    wins: (() => { const w = {}; for (const r of R) w[r.winner ?? 'none'] = (w[r.winner ?? 'none'] ?? 0) + 1; return w; })(),
  };
}
/** 뛰기 재기 묶음 (11/19) */
function runSummary(R) {
  const ends = R.flatMap((r) => r.runEnd);
  const far = R.flatMap((r) => r.far);
  const farRan = far.filter((e) => e.ran);
  const why = {};
  for (const e of ends) why[e.why] = (why[e.why] ?? 0) + 1;
  const kinds = {};
  for (const r of R) for (const [k, v] of Object.entries(r.runKinds ?? {})) kinds[k] = (kinds[k] ?? 0) + v;
  const S = (k) => R.reduce((s, r) => s + r[k], 0);
  return {
    runsPerFight: +(S('runs') / Math.max(1, R.length)).toFixed(2), runSecPerFight: +(S('runSec') / Math.max(1, R.length)).toFixed(2), fightsWithRun: R.filter((r) => r.runs > 0).length, runKinds: kinds,
    runEndWhy: why, runEndStMed: med(ends.map((e) => e.st)), runEndStMin: ends.length ? Math.min(...ends.map((e) => e.st)) : null,
    runEndGapMed: med(ends.filter((e) => e.gap != null).map((e) => e.gap)), runEndInReach: ends.filter((e) => e.gap != null && e.gap < 0).length,
    farN: far.length, farSecMed: med(far.map((e) => e.dt)), farStMed: med(far.map((e) => e.st)), farStLow: far.filter((e) => e.st < 35).length,
    farLateN: far.filter((e) => e.t0 > OPEN_T).length, farLateSecMed: med(far.filter((e) => e.t0 > OPEN_T).map((e) => e.dt)), farLateStMed: med(far.filter((e) => e.t0 > OPEN_T).map((e) => e.st)),
    farRanN: farRan.length, farRanSecMed: med(farRan.map((e) => e.dt)), farRanStMed: med(farRan.map((e) => e.st)), farRanStLow: farRan.filter((e) => e.st < 35).length,
    hitRun: S('hitRun'), hitRunBack: S('hitRunBack'),
  };
}
const out = [];
for (const mode of MODES) {
  const R = rows.filter((r) => r.mode === mode);
  out.push(summary(R, SIDES ? `${mode} ${SIDES.join(' vs ')}${LONE ? ` lone ${LONE}` : ''}${FIELD ? ` field ${FIELD}` : ''}` : `${mode} all`));
  if (!SIDES) for (const p of PROFS) out.push(summary(R.filter((r) => r.prof === p), `${mode} p${p}`));
}
console.log(`무리 싸움 판단 바탕 — 모드마다 ${N} 판 · 최대 ${MAX} s · ${SIDES ? `편 숙련 ${SIDES.join(' 대 ')}` : `숙련도 ${PROFS.join('/')} 돌아가며`}${LEVER_OFF ? ' · 숙련도 레버 끔' : ''}${OLD_SEEDING ? ' · 예전 판 짜기' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const o of out) console.log(JSON.stringify(o));
if (flag('json', false)) for (const r of rows) console.log(JSON.stringify({ ...r, pincer: undefined, outSep: undefined, runEnd: undefined, far: undefined }));
const OUT = flag('out', null);
if (OUT) writeFileSync(OUT, JSON.stringify({ N, MAX, MODES, PROFS, summary: out, rows: rows.map((r) => ({ ...r, pincer: undefined, outSep: undefined })) }, null, 1));
