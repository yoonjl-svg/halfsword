// ─────────────────────────────────────────────────────────────
//  live_twin.mjs — R2 실전 진단 쌍둥이 (브라우저 없이 main.js frame() 을 그대로 흉내: 같은 차림표·빠르기·표본·요약)
//   출처: hs-diag(가지 wbs-diag 08b864a) tools/sim/live_twin.mjs + 디렉터 사본(scratchpad corr/impl/diag/run, corr·humanLimits 열). 본판 이식(R2′ W1a):
//   --root 기본 = 이 트리, M·C1·C2·C3 칸(src/strike 가 있는 가지에서만 돌던 온몸·손짓·드라이브 칸)과 꼭두각시(--puppet) 제거. 표본·요약·sha 정의는 그대로
//   (같은 트리·같은 칸이면 hs-diag 의 C0 칸과 passive sha 가 같다 — W1a 확인: C0-k1 60 s7 quick a003b0c7b562 n 1319).
//
//   node tools/sim/live_twin.mjs [--cells=k1,k0.7|all] [--pacings=60,30J|all] [--blocks=passive,fight]
//        [--seeds=7] [--out=<폴더>] [--root=<체크아웃>] [--rows|--full] [--quick] [--rounds=2] [--maxS=60] [--foe=heinrich|default] [--mortal] [--table]
//   칸 (live_common 차림표·빠르기·sampleFighter·summarise 를 브라우저 도구와 같이 쓴다):
//     k<0|0.4|0.7|1>  본판 그대로, 검술 보정 세기만 (옛 이름 C0-k<s> 도 받는다 — 파일 이름은 적은 그대로). all = k0,k0.4,k1
//     설정 칸(BODY.chain 'legs' 등)은 with_config.mjs 로 감싸지 않는다 — 아이 과정이 따로 뜨므로 --root 에 그 설정의 트리를 주거나 R2P 탐색판 인자처럼 CONFIG 를 바꾼 트리를 쓴다
//   묶음: passive = 상대 AI 멈춤·1.3 m·둘 다 죽지 않음 (--mortal: 나는 죽는다 = 브라우저 도구와 같게), 차림표 한 벌 + 50 ms
//         fight = heinrich 기본 AI (?foe=heinrich&weapon=longsword), 차림표 되풀이 + 조이스틱 다가가기, 누가 죽으면 (기록 멈춤) 또는 fightT 60 s, 2 판
//   내는 것: <out>/<cell>__<pacing>__s<seed>.json — 브라우저 도구 live_diag.mjs 와 같은 꼴 { meta, blocks: { passive, fight }, errors, worst }
//            (블록: summary · rounds · events · sha (표본 JSON 줄마다) · shaEvents · steps · frames · samples (솎음 4, gzip-base64)).
//            --rows (--full) 면 스텝 표본 전부 <cell>__<pacing>__s<seed>__<block>.samples.jsonl.gz
//   --table: <out> 의 json 을 읽어 표 (table.md) 만 쓴다.
//  칸·묶음마다 새 node 과정 (모듈 상태가 섞이지 않게, nice 10, 하나씩). src 는 읽기만 — 하니스 쪽 바꿈은 페이지에서 하는 것과 같은 것뿐 (AI 멈춤·과녁 죽지 않음·손 쟁기)
//  자르기·한도·바닥 없음 (재기만 한다)
// ─────────────────────────────────────────────────────────────
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as L from './live_common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const COMMON = join(HERE, 'live_common.mjs');
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const ROOT = realpathSync(resolve(arg('root', resolve(HERE, '..', '..'))));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// ───────── 칸 ─────────
const SKILLS = ['0', '0.4', '1'];
export function cellGroup(name) {
  if (name === 'all' || name === 'main' || name === 'C0') return SKILLS.map((k) => `k${k}`);
  return [name];
}
/** 칸 이름 → 요청 (본판: 검술 보정 세기만. kind 'main' = hs-diag 의 C0 칸과 같은 뜻) */
export function parseCell(id) {
  let m;
  const sk = (s) => {
    if (!['0', '0.4', '0.7', '1'].includes(s)) throw new Error(`칸 ${id}: 검술 보정 ${s} (0 | 0.4 | 0.7 | 1)`);
    return s;
  };
  if ((m = /^(?:C0-)?k([\d.]+)$/.exec(id))) return { name: id, kind: 'main', input: null, hand: null, skill: sk(m[1]), whole: null, gesture: null, drive: null };
  throw new Error(`모르는 칸 ${id} (k<0|0.4|0.7|1>)`);
}

// ───────── 차림표 (브라우저 도구 live_diag.mjs programme 과 같다): 보통 = buildProgramme, --quick = 감기 크게 빠르게 · 긋기 보통 느리게 × clean·cont 4 획
export function programme(loops, quick) {
  if (!quick) return L.buildProgramme({ loops });
  const rand = L.rng(L.PROGRAMME.seed);
  const pick = ['wind-large-fast', 'straight-mid-slow'];
  const vs = L.variants().filter((v) => pick.includes(v.id));
  const t0 = L.PROGRAMME.startHoldMs + L.PROGRAMME.idleMs;
  let t = t0;
  const strokes = [];
  for (let l = 0; l < loops; l++)
    for (const v of vs)
      for (const touch of L.PROGRAMME.touches) {
        const s = L.buildStroke(v, touch, t, rand);
        s.loop = l;
        s.idx = strokes.length;
        strokes.push(s);
        t = s.tEnd;
      }
  return { strokes, t0, tEnd: t, map: L.MAP_PHONE, originPx: L.PROGRAMME.originPx, standWinMs: L.PROGRAMME.standWinMs, quick: true };
}
/** FIGHT 되풀이 수 (브라우저 도구와 같은 식: 60 s 의 2.5 배 벽시계가 차림표로 덮이게 — 멈칫·슬로모션이 게임 시간을 늦춘다) */
export const fightLoops = (maxS, quick) => Math.max(1, Math.ceil((maxS * 1000 * 2.5) / (programme(1, quick).tEnd - programme(1, quick).t0)));
const rnd4 = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null) : Array.isArray(v) ? v.map(rnd4) : v);
/** 표본 솎아 싣기 (브라우저 도구 pack 과 같은 꼴: 열 = 첫 표본 열쇠, 값 4 자리, gzip-base64 JSON) */
function pack(rows, every = 1) {
  if (!rows.length) return { every, n: 0, cols: [], enc: 'gzip-base64-json', data: '' };
  const cols = Object.keys(rows[0]);
  const out = [];
  for (let i = 0; i < rows.length; i += every) out.push(cols.map((k) => rnd4(rows[i][k])));
  return { every, n: out.length, cols, enc: 'gzip-base64-json (행 = cols 순서 값, 4 자리 반올림)', data: gzipSync(JSON.stringify(out)).toString('base64') };
}
const DECIM = 4; // 싣는 표본 솎기 (120 Hz → 30 Hz). 요약은 모든 스텝으로


// ═════════════ 아이: 한 칸 · 한 빠르기 · 한 씨앗 · 한 묶음 ═════════════
async function child() {
  process.env.QUIET_ATLAS = '1';
  const cell = parseCell(arg('cell'));
  const pacing = String(arg('pacing', '60'));
  const seed = +arg('seed', 7);
  const block = arg('block', 'passive');
  const quick = !!arg('quick', false);
  const rowsPath = arg('rows-path', null);
  const mortal = !!arg('mortal', false); // PASSIVE 에서 나는 죽는다 (브라우저 도구와 같게: 죽으면 기록 멈춤)
  const u = (p) => pathToFileURL(join(ROOT, p)).href;
  // Rapier 는 전역 window 가 없을 때 불러야 한다 (harness_m.mjs 와 같음)
  const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
  await RAPIER.init();
  const THREE = await import(u('node_modules/three/build/three.module.js'));
  const CONFIG = await import(u('src/config.js'));
  const { Fighter, GROUND_GROUPS } = await import(u('src/fighter.js'));
  const { LOOKS } = await import(u('src/looks.js'));
  const { AI } = await import(u('src/ai.js'));
  const { Combat } = await import(u('src/combat.js'));
  const { Input } = await import(u('src/input.js'));
  const { Emotions } = await import(u('src/emotions.js'));
  const { CHARACTERS_BY_ID } = await import(u('src/characters.js'));
  if (existsSync(join(ROOT, 'src/strike/atlas.js'))) throw new Error('이 이식판은 본판(src/strike 없음) 전용 — 온몸 가지(M·C1~C3 칸)는 hs-diag 의 live_twin 으로');
  const { PHYSICS, ARENA } = CONFIG;
  const DT = PHYSICS.timestep;
  const MAXS = PHYSICS.maxStepsPerFrame;

  // ── 설정 (main.js settings: 본판은 검술 보정 세기뿐 — 파이터를 만들기 전) ──
  const settings = { skill: cell.skill };

  // ── 씨앗 난수 (harness_m.seedRandom 과 같은 식; 판 사이 이어 간다 — 페이지와 같게) ──
  {
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── input.js (브라우저 흉내는 부르는 동안만: 늘 두면 Rapier 가 멈춘다) ──
  const SHIM = { window: { addEventListener() {}, innerHeight: L.MAP_PHONE.innerHeight, innerWidth: L.MAP_PHONE.innerWidth }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
  const withBrowser = (fn) => {
    const added = [];
    for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
    try {
      return fn();
    } finally {
      for (const k of added) delete globalThis[k];
    }
  };
  const input = withBrowser(() => new Input({ addEventListener() {} }, new URLSearchParams('mobileVerticalGain=1')));
  const hasTrace = !!input.fingerTrace;
  const send = (type, x, y, ts, id = 1) => {
    const e = { type, pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: ts };
    withBrowser(() => (type === 'pointerdown' ? input.onDown(e) : type === 'pointermove' ? input.onMove(e) : input.onUp(e)));
  };
  // 조이스틱 (input.js attachStick 과 같은 식: R 40 px, 가운데 0.15 무시)
  const stickTo = (dx, dy) => {
    const R = 40, DEAD = 0.15;
    const len = Math.hypot(dx, dy);
    if (len > R) (dx = (dx / len) * R), (dy = (dy / len) * R);
    const x = dx / R, y = -dy / R;
    const m = Math.hypot(x, y);
    const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD) / m;
    input.stickMove = { x: x * k, y: y * k };
  };

  // ── 판 상태 (main.js 전역) ──
  const scene = new THREE.Scene();
  const foeArg = arg('foe', L.PROGRAMME.fight.foe);
  const foe = foeArg === 'default' ? null : CHARACTERS_BY_ID[foeArg];
  if (foeArg !== 'default' && !foe) throw new Error(`모르는 상대 ${foeArg}`);
  const foeWeapon = L.PROGRAMME.passive.weapon; // ?weapon=longsword → 상대도 롱소드 (prepareRound)
  let world, eventQueue, colliderInfo, player, enemy, ai, combat, playerEmo, playerEv;
  let hitStop = 0, slowMo = 0, clashCooldown = 0, clashStopCooldown = 0, roundOver = false, roundOverTime = 0, result = null;
  const tremor = { x: 0, y: 0, ax: 0, ay: 0, t: 0 };
  let acc = 0, last = 0, now = 0, tStepNow = 0;
  const events = [];
  const wouldDie = {}; // PASSIVE: 죽었을 때 (죽지 않게 둔 판)
  let rdNow = 0, rec = false; // 판 번호 (0 부터) · 기록 중 (브라우저 도구 H.rec 과 같게: 판 끝에서 멈춘다)
  const evBase = () => ({ tw: tStepNow, t: player ? player.fightT : null, rd: rdNow });
  const ev = (e) => { if (rec) events.push(e); };

  function newRound(k) {
    CONFIG.BODY.weightMode = 'hybrid';
    if (world) world.free();
    if (eventQueue) eventQueue.free();
    world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    world.timestep = PHYSICS.timestep;
    world.integrationParameters.numSolverIterations = 6;
    eventQueue = new RAPIER.EventQueue(true);
    colliderInfo = new Map();
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
    const n = 32;
    const R = ARENA.radius + 0.25;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const half = R * Math.tan(Math.PI / n) + 0.05;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS), ground);
    }
    // 무기 파손 씨앗 = 페이지의 Fighter 셈 (메뉴 뒤 판 1·2, k 번째 싸움 판 2k+1·2k+2)
    Fighter._breakCount = 2 * k;
    const xP = -ARENA.startGap / 2;
    const gapE = block === 'passive' ? L.PROGRAMME.passive.gapM : ARENA.startGap;
    player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: '나', x: xP, heading: 0, look: LOOKS.player, weapon: foeWeapon });
    enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: foe ? foe.name : '상대', x: xP + gapE, heading: Math.PI, look: foe ? foe.look : LOOKS.enemy, weapon: foeWeapon, revive: foe?.revive });
    const persona = foe && foeWeapon !== foe.weapon ? { ...foe.ai.persona, school: foeWeapon } : foe?.ai.persona;
    ai = foe ? new AI(enemy, player, foe.ai.level, persona) : new AI(enemy, player, 'normal');
    playerEmo = new Emotions({ fearful: 0.3, angry: 0.3, dogged: 0.3 });
    playerEv = { hurt: false, parried: false, landed: false };
    player.emoMods = playerEmo.mods;
    player.skill.level = +settings.skill;
    player.skill.autoGuard = true;
    input.fingerTrace?.clear();
    input.syncHand?.();
    if (hasTrace) (player.skill.detect = true), (player.skill.trace = input.fingerTrace); // 본판에는 손가락 궤적·detect 가 없다 (null)
    player.ges?.attachTrace(input.fingerTrace);
    player.ges?.reset();
    player.onCommit = (stage, S, fam) => ev({ type: 'commit', stage, S: +S, fam, ...evBase() }); // main.js 의 덮개는 금색 자취·진동뿐 (물리 없음)
    combat = new Combat(colliderInfo, { onWound, onClash });
    roundOver = false;
    roundOverTime = 0;
    hitStop = 0;
    result = null;
    // 하니스 몫 (페이지에서도 하는 것): 쓰러뜨림 부름 기록 (둘 다; 'fall' 은 표본 상태 바뀜에서 — 브라우저 도구와 같게) · PASSIVE 상대 멈춤·죽지 않음
    for (const [f, who] of [[player, 'player'], [enemy, 'enemy']]) {
      const okd = f.knockDown.bind(f);
      f.knockDown = (heavy) => (f.state === 'stand' && ev({ type: 'knock', who, heavy: heavy !== false, ...evBase() }), okd(heavy));
    }
    if (block === 'passive') {
      ai.update = () => enemy.move.set(0, 0);
      // PASSIVE: 둘 다 죽지 않는다 (상처·피·아픔·넘어짐은 그대로). 멈춘 상대 칼에 내 몸이 부딪혀 죽으면 판 끝 슬로모션으로 차림표가 끊긴다
      //  → 죽었을 때를 'death' 사건으로만 적고 차림표를 끝까지 (참수 뒤 목 상처는 건너뜀, chain.mjs 과녁과 같게)
      for (const [f, who] of mortal ? [[enemy, 'enemy']] : [[player, 'player'], [enemy, 'enemy']]) {
        f.die = (cause) => { if (!wouldDie[who]) (wouldDie[who] = { cause: cause ?? null, t: f.fightT, tw: tStepNow }), ev({ type: 'death', who, cause: cause ?? null, ...evBase() }); };
        const aw = f.applyWound.bind(f);
        f.applyWound = (h) => { if (!(f.decapitated && h.zone === 'neck')) aw(h); };
      }
    }
    // beginFight
    input.enabled = true;
  }

  function onWound(att, vic, r) {
    if (vic === player) playerEv.hurt = true;
    if (att === player) playerEv.landed = true;
    const e = r.energy;
    const bone = e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg');
    const stopT = r.pass ? Math.min(0.06, e / 2000) : r.stuck || bone || r.helmet || r.plate ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200);
    hitStop = Math.max(hitStop, stopT);
    if (!vic.alive) slowMo = 1.6;
    ev({ type: 'wound', att: att === player ? 'player' : 'enemy', vic: vic === player ? 'player' : 'enemy', zone: r.zone, kind: r.type, energy: r.energy, severity: r.severity, pass: !!r.pass, stopT, ...evBase() });
  }
  function onClash(point, speed, touch) {
    ev({ type: 'clash', speed, fresh: !!(touch && touch.fresh), ...evBase() });
    if (touch?.fresh && touch.vn > 3 && player?.alive && player.tipVel.length() > 6) playerEv.parried = true;
    const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
    if (clashCooldown > 0) return;
    if (impact < 2.5) {
      if (touch && touch.vt > 5) clashCooldown = 0.12;
      return;
    }
    clashCooldown = 0.09;
    if (impact > 6 && clashStopCooldown <= 0) {
      hitStop = Math.max(hitStop, Math.min(0.08, impact / 200));
      clashStopCooldown = 0.5;
    }
  }
  function updatePlayerEmotion(dt) {
    if (!playerEmo || !player || !enemy) return;
    const ev = playerEv;
    ev.bleeding = player.bleed > 0.01;
    ev.foeBleeding = enemy.bleed > 0.01;
    ev.winning = enemy.blood < player.blood;
    ev.weaponBroken = player.weaponBroken;
    ev.disarmed = !player.armed;
    ev.foeBroke = enemy.weaponBroken;
    const d = ai?.d ?? 3;
    ev.nearMiss = ai?.mode === 'attack' && ai.phase === 'strike' && d < 1.65;
    ev.foeLegendNear = enemy.armed && enemy.weapon?.tier === 'legend' && d < 2.5;
    if (player.alive) playerEmo.update(dt, ev);
    ev.hurt = ev.parried = ev.landed = false;
    player.emoMods = playerEmo.mods;
    const T = tremor;
    const amp = player.emoMods.tremor;
    if (amp > 0 && player.alive) {
      T.t -= dt;
      if (T.t <= 0) {
        T.t = 0.06 + Math.random() * 0.04;
        const a = Math.random() * Math.PI * 2;
        const r = amp * (0.5 + Math.random() * 0.5);
        T.x = Math.cos(a) * r;
        T.y = Math.sin(a) * r;
      }
    } else T.x = T.y = 0;
    player.handOffset.x += T.x - T.ax;
    player.handOffset.y += T.y - T.ay;
    T.ax = T.x;
    T.ay = T.y;
  }
  function checkRoundEnd(dt) {
    if (!roundOver) {
      if (!enemy.alive || !player.alive) {
        roundOver = true;
        result = { result: !enemy.alive ? 'win' : 'loss', t: player.fightT, tw: now };
      }
      return false;
    }
    roundOverTime += dt;
    return roundOverTime > 3.5; // state 'paused'
  }

  // ── 표본 ──
  const samples = [];
  let st = {};
  let own = null;
  let first = true;
  const frames = { n: 0, sum: 0, min: Infinity, max: 0, steps: {}, capped: 0, scaled: 0 };
  // 칼을 놓치면 (dropSword) 관절은 지워지고 f.gripJoint 손잡이만 남는다 → 그 anchor1 을 읽으면 Rapier 가 unreachable 로 멈춘다.
  //  공용 sampleFighter 를 고치지 않고: 놓친 동안만 gripJoint 를 null 로 보이는 겉 (나머지는 그대로 파이터)
  const noGrip = (f) => new Proxy(f, { get: (t, k) => (k === 'gripJoint' ? null : Reflect.get(t, k)) });
  let pView = null, pOf = null;
  let prevState = null, prevCuts = null;
  const onStep = (tStep) => {
    if (!rec) return;
    if (pOf !== player) (pOf = player), (pView = noGrip(player));
    const s = L.sampleFighter({ f: player.armed === false ? pView : player, world, t: player.fightT, tw: tStep, dt: DT, st, meta: first });
    if (first) (own = s.meta), delete s.meta, (first = false);
    if (player.state !== prevState) {
      ev({ type: 'pstate', from: prevState, to: player.state, ...evBase() });
      if (prevState === 'stand' && (player.state === 'down' || player.state === 'getup')) ev({ type: 'fall', to: player.state, ...evBase() });
      prevState = player.state;
    }
    if (s.gCuts != null) {
      if (prevCuts != null && s.gCuts > prevCuts) ev({ type: 'cut', mode: ['none', 'wind', 'stroke'][s.gMode] ?? null, fam: s.gFam, S: s.gS, ...evBase() });
      prevCuts = s.gCuts;
    }
    s.rd = rdNow;
    samples.push(s);
  };

  // ── main.js frame() (싸움 상태) ──
  function frame(frameNow) {
    now = frameNow;
    const frameMs = now - last;
    const dt = Math.min(0.1, frameMs / 1000);
    last = now;
    frames.n++;
    frames.sum += frameMs;
    frames.min = Math.min(frames.min, frameMs);
    frames.max = Math.max(frames.max, frameMs);
    if (hasTrace) input.fingerTrace.tick(now);
    const d = input.consumeHandDelta();
    const inScale = hitStop > 0 ? 0.25 : 1;
    player.inputScale = inScale;
    const perStep = hasTrace && !!CONFIG.INPUT.coalesce;
    if (!perStep && player.alive && !player.weapon?.gun) {
      player.handOffset.x += d.x * inScale;
      player.handOffset.y += d.y * inScale;
    }
    player.handHeld = input.activeTouch !== null;
    player.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    input.tapOnDown = !!player.weapon?.gun;
    if (input.consumeTaps() > 0 && player.alive) player.skill.thrust();
    updatePlayerEmotion(dt);
    const m = input.move;
    const emv = player.emoMods?.move ?? 1;
    player.move.set(player.alive ? m.x * emv : 0, player.alive ? m.y * emv : 0);
    let scale = 1;
    if (hitStop > 0) {
      hitStop -= dt;
      scale = 0.12;
    }
    if (slowMo > 0) {
      slowMo -= dt;
      scale = Math.min(scale, 0.25);
    } else if (roundOver) scale = Math.min(scale, 0.5);
    if (scale < 1) frames.scaled++;
    acc += dt * scale;
    let steps = 0;
    while (acc >= PHYSICS.timestep && steps < MAXS) {
      const tStep = scale < 1 ? now : now - (acc - PHYSICS.timestep) * 1000;
      tStepNow = tStep;
      player.stepT = tStep;
      if (perStep) {
        const s = input.handDeltaAt(tStep);
        if (player.alive && !player.weapon?.gun) {
          player.handOffset.x += s.x * inScale;
          player.handOffset.y += s.y * inScale;
        }
      }
      player.foe = enemy;
      enemy.foe = player;
      player.faceTarget = enemy.bodies.pelvis.translation();
      enemy.faceTarget = player.bodies.pelvis.translation();
      ai.update(PHYSICS.timestep);
      player.step(PHYSICS.timestep);
      enemy.step(PHYSICS.timestep);
      player.cacheState();
      enemy.cacheState();
      world.step(eventQueue, combat.physicsHooks);
      combat.afterStep(world, eventQueue);
      onStep(tStep);
      clashCooldown -= PHYSICS.timestep;
      clashStopCooldown -= PHYSICS.timestep;
      acc -= PHYSICS.timestep;
      steps++;
    }
    frames.steps[steps] = (frames.steps[steps] || 0) + 1;
    if (steps === MAXS) (acc = 0), frames.capped++;
    return checkRoundEnd(dt);
  }

  // ── 판 돌리기: 차림표 표본 → 포인터 이벤트 (프레임 시각까지 먼저), 조이스틱 (FIGHT) ──
  const pace = L.pacer(pacing, seed);
  const fightMaxS = +arg('maxS', quick ? 12 : L.PROGRAMME.fight.maxS);
  const nRounds = block === 'fight' ? +arg('rounds', quick ? 1 : L.PROGRAMME.fight.rounds) : 1;
  const prog = programme(block === 'fight' ? fightLoops(fightMaxS, quick) : 1, quick);
  const rounds = [];
  const roundSpans = [];
  const winsAll = [];
  const setPad = (f, xy) => {
    f.handOffset.set(xy[0], xy[1]);
    const k = f.skill;
    for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(xy[0], xy[1]);
    k.aimVel?.set(0, 0);
    k.vel?.set(0, 0);
    k.follow?.set(0, 0);
  };
  last = 10000; // 페이지 시계 (ms): 첫 판 싸움 시작
  const t0run = performance.now();
  for (let r = 0; r < nRounds; r++) {
    newRound(r + 1);
    st = {};
    first = r === 0;
    rdNow = r;
    prevState = prevCuts = null;
    rec = true;
    const wall0 = last; // 프로그램 시계 0 (beginFight 바로 뒤 첫 프레임의 앞 rAF 시각)
    const frames0 = frames.n;
    setPad(player, L.PROGRAMME.pad0); // 첫 프레임 앞 (브라우저 도구 pad0 atMs 0 과 같다)
    const pts = [];
    for (const s of prog.strokes) for (const [t, x, y, ph] of L.strokePx(s)) pts.push([wall0 + t, x, y, ph]);
    let qi = 0;
    let stickOn = false, stickDown = false;
    const iS0 = samples.length;
    // PASSIVE: 차림표 끝 + 50 ms (브라우저 도구와 같다)
    const endT = block === 'passive' ? wall0 + prog.tEnd + 50 : Infinity;
    let reason = null;
    while (!reason) {
      const next = last + pace.next();
      // 조이스틱 (FIGHT): 앞 프레임 끝의 거리로 (브라우저 도구도 프레임 끝에 본다)
      if (block === 'fight' && player.alive) {
        const c = L.stickCommand(player.foeDistance(), stickOn);
        stickOn = c.on;
        if (c.on) (stickTo(c.dx, c.dy), (stickDown = true));
        else if (stickDown) (input.stickMove = { x: 0, y: 0 }), (stickDown = false);
      }
      // 칼 손가락: 이 프레임 시각까지의 표본
      while (qi < pts.length && pts[qi][0] <= next) {
        const [ts, x, y, ph] = pts[qi++];
        send(ph === 0 ? 'pointerdown' : ph === 2 ? 'pointerup' : 'pointermove', x, y, ts);
      }
      frame(next);
      // 판 끝 (브라우저 도구 H.run 과 같은 차례): 누가 죽음 → 시간 끝 → 차림표 끝
      if (!player.alive || !enemy.alive) reason = 'roundOver';
      else if (block === 'fight' && player.fightT >= fightMaxS) reason = 'maxS';
      else if (now >= endT) reason = 'end';
    }
    rec = false;
    const result = block === 'passive' ? 'end' : reason === 'roundOver' ? (enemy.alive ? 'loss' : 'win') : reason === 'maxS' ? 'timeout' : reason;
    const lastTw = samples.length > iS0 ? samples[samples.length - 1].tw : wall0;
    const winAll = L.strokeWindows(prog, wall0);
    const wins = winAll.filter((w) => w.twEnd <= lastTw); // 판 끝에 끊긴 획은 뺀다
    const cut = winAll.filter((w) => w.twDown < lastTw && w.twEnd > lastTw).length;
    const standWin = [wall0 + L.PROGRAMME.standWinMs[0], wall0 + L.PROGRAMME.standWinMs[1]];
    rounds.push({ rd: r, wall0, reason, result, fightT: player.fightT, frames: frames.n - frames0, steps: samples.length - iS0, strokesDone: wins.length, strokeCut: cut, padAt: wall0, standWin, pState: player.state, dist: player.foeDistance() });
    winsAll.push(...wins);
    roundSpans.push({ i0: iS0, i1: samples.length, wall0, wins, standWin });
    // 손가락·조이스틱을 뗀다. 다음 판이 있으면: 죽었으면 멈춤 화면까지 60 Hz 프레임 (기록 없음, 브라우저 도구와 같다), 시간 끝이면 바로 멈춤
    if (input.activeTouch !== null) send('pointerup', 0, 0, last);
    input.stickMove = { x: 0, y: 0 };
    if (r + 1 < nRounds && reason === 'roundOver') for (let g = 0; g < 20 * 120; g++) if (frame(last + 1000 / 60)) break;
    last += 1000; // 판 사이 (메뉴)
  }
  const secRun = (performance.now() - t0run) / 1000;

  // ── 요약 (브라우저 도구와 같은 meta: 판 기록은 FIGHT 만, 서 있기 창은 첫 판) ──
  const ginput = null; // 본판에는 손짓 입력이 없다
  const bname = block;
  const rMeta = (rs) => (block === 'fight' ? rs.map((x) => ({ result: x.result, t: x.fightT })) : []);
  const summary = L.summarise(samples, events, { dt: DT, who: 'player', ginput, strokes: winsAll, standWin: roundSpans[0].standWin, rounds: rMeta(rounds), cell: cell.name, block: bname });
  // 판마다 요약 (더 붙인 것: 브라우저 도구에는 없다)
  if (roundSpans.length > 1)
    roundSpans.forEach((sp, i) => {
      rounds[i].summary = L.summarise(samples.slice(sp.i0, sp.i1), events.filter((e) => e.rd === i), { dt: DT, who: 'player', ginput, strokes: sp.wins, standWin: sp.standWin, rounds: rMeta([rounds[i]]), cell: cell.name, block: bname });
    });
  // 표본 흐름 sha (브라우저 도구와 같은 정의: 표본 JSON 줄마다 + '\n', 온 정밀도) · 사건 sha 도 같게
  const h = createHash('sha256');
  for (const s of samples) h.update(JSON.stringify(s) + '\n');
  const sampleSha = h.digest('hex');
  const hE = createHash('sha256');
  for (const e of events) hE.update(JSON.stringify(e) + '\n');
  const shaEvents = hE.digest('hex');
  if (rowsPath) writeFileSync(rowsPath, gzipSync(Buffer.from(samples.map((s) => JSON.stringify(s)).join('\n'))));
  const live = {
    'BODY.weightMode': CONFIG.BODY.weightMode,
    'BODY.chain': CONFIG.BODY.chain ?? null, 'BODY.legTorque': CONFIG.BODY.legTorque ?? null, 'GAIT.assist': CONFIG.GAIT?.assist ?? null, // (R2′ 칸 표시 — 읽기만)
    'INPUT.coalesce': CONFIG.INPUT.coalesce ?? null,
    timestep: PHYSICS.timestep,
    maxSteps: PHYSICS.maxStepsPerFrame,
    settings,
    ges: player.ges != null,
    drive: player.drive != null,
    'skill.level': player.skill.level,
    guardWeight: player.guardWeight ? player.guardWeight() : null,
    hasTrace,
    foe: foe ? foe.id : 'default',
    corr: player.skill.corr ?? null, corrTip: player.skill.corrTip ?? null, corrAI: enemy.skill.corr ?? null, humanLimits: CONFIG.BODY.humanLimits ?? null, // (corr 측정)
  };
  // 요청과 살아 있는 값이 다르면 오류 (잘못된 칸을 조용히 재지 않는다)
  const bad = [];
  if (live.ges || live.drive || CONFIG.WHOLE) bad.push('이 트리에 온몸 가지(ges·drive·WHOLE)가 있다 — 본판 이식판이 아니라 hs-diag 의 live_twin 으로');
  if (Math.abs(live['skill.level'] - +cell.skill) > 1e-9) bad.push(`skill ${live['skill.level']}`);
  const out = {
    block: bname, summary, rounds, events, errors: bad.map((b) => `살아 있는 값이 요청과 다르다: ${b}`), ownCollide: own, sha: sampleSha, shaEvents, steps: samples.length, frames: frames.n,
    frameStats: { meanMs: +(frames.sum / Math.max(1, frames.n)).toFixed(4), minMs: +frames.min.toFixed(4), maxMs: +frames.max.toFixed(4), steps: frames.steps, capped: frames.capped, scaled: frames.scaled },
    samples: pack(samples, +arg('every', DECIM)), wallS: secRun, live, wouldDie, mortal,
    programme: { strokes: prog.strokes.length, t0: prog.t0, tEnd: prog.tEnd, quick: !!prog.quick, loops: block === 'fight' ? fightLoops(fightMaxS, quick) : 1, maxS: block === 'fight' ? fightMaxS : null, rounds: nRounds },
  };
  writeFileSync(arg('tmp'), JSON.stringify(out));
}

// ═════════════ 어버이: 격자 → 아이 과정 하나씩 → 칸 파일 ═════════════
function gitHead(dir) {
  if (existsSync(join(dir, '.sha'))) return readFileSync(join(dir, '.sha'), 'utf8').trim(); // git archive 로 만든 탐침 나무 (만든 쪽이 남긴 sha)
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}
const f3 = (x) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(3));
const f2 = (x) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(2));
function line(run) {
  const b = run.blocks;
  const s = (k) => b[k]?.summary;
  const P = s('passive'), F = s('fight');
  const one = (S, k) =>
    S
      ? `${k} dist ${f3(S.distortion.index)} pen/str ${f3(S.selfPen.perStroke)} tele/str ${f3(S.selfPen.teleports.perStroke)} bothOff ${f3(S.boneless.feet.bothOffFrac)} load ${f2(S.boneless.load.median)} pelStd ${f3(S.boneless.pelvis.stdMedian)} dip ${f3(S.boneless.pelvis.dip)} osc>8 ${f3(S.boneless.osc.highShareMean)} tip ${f2(S.task.tipPeakMedian)} hits/str ${f2(S.task.hitsPerStroke)} falls ${S.task.falls}${S.control ? ` miscl ${S.control.misclass.count}/${S.control.strokes} spur c/t ${S.control.spuriousCommits.clean}/${S.control.spuriousCommits.cont} drv+ ${f2(S.control.driveAfterReleaseMs.median)}ms ret ${f2(S.control.postLiftHandSpeed.median)}` : ''}`
      : '';
  return [one(P, 'P'), one(F, 'F'), F ? `rounds ${b.fight.rounds.map((r) => `${r.result}@${f2(r.fightT)}`).join(',')}` : ''].filter(Boolean).join(' | ');
}
function parent() {
  const OUT = resolve(arg('out', 'tools/sim/out/live_twin'));
  mkdirSync(OUT, { recursive: true });
  if (arg('table', false)) return table(OUT);
  const cells = list('cells', 'k1').flatMap(cellGroup);
  const pacings = list('pacings', '60').flatMap((p) => (p === 'all' ? L.PACING_NAMES : [p]));
  for (const p of pacings) if (!L.PACINGS[p]) throw new Error(`모르는 pacing ${p}`);
  const seeds = list('seeds', '7').map(Number);
  const blocks = list('blocks', 'passive,fight');
  const quick = !!arg('quick', false);
  const toolSha256 = sha(readFileSync(SELF));
  const commonSha256 = sha(readFileSync(COMMON));
  const rootHead = gitHead(ROOT);
  const tag = quick ? '__quick' : '';
  for (const c of cells) parseCell(c);
  const summaryRows = [];
  for (const cell of cells)
    for (const pacing of pacings)
      for (const seed of seeds) {
        const file = join(OUT, `${cell}__${pacing}__s${seed}${tag}.json`);
        const C = parseCell(cell);
        // 브라우저 도구 live_diag.mjs 와 같은 꼴: { meta, blocks, errors, worst } (쌍둥이는 그리지 않아 worst 는 빈 것)
        const T0 = Date.now();
        const run = { meta: null, blocks: {}, errors: [], worst: [] };
        const meta = {
          tool: 'live_twin.mjs', format: 'r2-live-run/1', toolSha256, commonSha256, tree: ROOT, rootHead, url: null, cell, request: C, pacing, pacingDef: L.PACINGS[pacing], blocks,
          seed, programmeSeed: L.PROGRAMME.seed, quick, rounds: +arg('rounds', quick ? 1 : L.PROGRAMME.fight.rounds), maxS: +arg('maxS', quick ? 12 : L.PROGRAMME.fight.maxS), pad0: { atMs: 0, xy: L.PROGRAMME.pad0 },
          foe: arg('foe', L.PROGRAMME.fight.foe), mortal: !!arg('mortal', false),
          mapping: { pxPerPad: L.pxPerPad(), touchSensitivity: L.MAP_PHONE.touchSensitivity, innerHeight: L.MAP_PHONE.innerHeight, originPx: L.PROGRAMME.originPx, stickDeflectPx: L.PROGRAMME.fight.stickR * L.PROGRAMME.fight.stickDeflect, rule: '포인터 이벤트를 input.js Input.onDown/onMove/onUp 에 바로 (clientX·Y px, timeStamp = 페이지 ms); 조이스틱 = attachStick 식 → input.stickMove' },
          passive: { gapM: L.PROGRAMME.passive.gapM, ai: 'ai.update = () => enemy.move.set(0, 0)', undying: arg('mortal', false) ? 'enemy.die 막음 · 목 없는 과녁의 목 상처 건너뜀' : 'player·enemy 둘 다 die 막음 (죽을 때는 death 사건) · 목 없는 몸의 목 상처 건너뜀', relocate: '적을 처음부터 x = −startGap/2 + 1.3 에 세운다' },
          hook: '되풀이한 main.js frame() 의 물리 스텝마다 combat.afterStep 바로 뒤 sampleFighter',
        };
        run.meta = meta;
        const secPerBlock = {};
        for (const block of blocks) {
          const tmp = join(OUT, `.tmp_${process.pid}_${block}.json`);
          const rowsPath = arg('rows', false) || arg('full', false) ? file.replace(/\.json$/, `__${block}.samples.jsonl.gz`) : null;
          const cargs = [SELF, '--child', `--root=${ROOT}`, `--cell=${cell}`, `--pacing=${pacing}`, `--seed=${seed}`, `--block=${block}`, `--tmp=${tmp}`];
          if (quick) cargs.push('--quick');
          if (rowsPath) cargs.push(`--rows-path=${rowsPath}`);
          for (const k of ['rounds', 'maxS', 'every', 'foe', 'mortal']) if (args[k] != null) cargs.push(`--${k}=${args[k]}`);
          const t0 = Date.now();
          const r = spawnSync('nice', ['-n', '10', process.execPath, ...cargs], { encoding: 'utf8', maxBuffer: 1 << 26 });
          const sec = (Date.now() - t0) / 1000;
          if (r.status !== 0) {
            console.error(`[twin] ${cell} ${pacing} s${seed} ${block}: 실패 (${r.status})\n${(r.stderr || '').slice(-4000)}`);
            run.errors.push(`${block}: 아이 과정 실패 (${r.status}) ${(r.stderr || '').slice(-1500)}`);
            continue;
          }
          const B = JSON.parse(readFileSync(tmp, 'utf8'));
          try { execFileSync('rm', ['-f', tmp]); } catch {}
          meta.live = meta.live || B.live;
          if (B.errors.length) console.error(`[twin] ${cell} ${block}: ${B.errors.join(', ')}`);
          run.errors.push(...B.errors.map((e) => `${block}: ${e}`));
          B.procS = +sec.toFixed(2);
          run.blocks[block] = B;
          secPerBlock[block] = +sec.toFixed(2);
        }
        const full = createHash('sha256');
        for (const b of blocks) if (run.blocks[b]?.sha) full.update(run.blocks[b].sha);
        meta.sampleSha256 = full.digest('hex');
        meta.wallS = (Date.now() - T0) / 1000;
        meta.secPerBlock = secPerBlock;
        writeFileSync(file, JSON.stringify(run));
        const msg = `${run.errors.length ? 'NG' : 'OK'} ${cell} ${pacing} s${seed}: ${Object.entries(secPerBlock).map(([k, v]) => `${k} ${v}s`).join(' ')} | ${Object.entries(run.blocks).map(([k, b]) => `${k} sha ${b.sha?.slice(0, 12)} n ${b.steps}`).join(' ')}`;
        console.log(msg);
        console.log('   ' + line(run));
        summaryRows.push({ file, cell, pacing, seed, sec: secPerBlock, sampleSha256: meta.sampleSha256, sha: Object.fromEntries(Object.entries(run.blocks).map(([k, b]) => [k, b.sha])), errors: run.errors });
      }
  // 목차: 같은 폴더에 여러 번 돌려도 앞 줄을 잃지 않게 (파일 이름으로 덮어 씀)
  const ix = join(OUT, `index${tag}.json`);
  let prev = [];
  try { prev = JSON.parse(readFileSync(ix, 'utf8')); } catch {}
  const seen = new Set(summaryRows.map((r) => r.file));
  writeFileSync(ix, JSON.stringify([...prev.filter((r) => !seen.has(r.file)), ...summaryRows], null, 1));
}

// ───────── 표 (--table): 칸 파일 → table.md ─────────
function table(OUT) {
  const runs = readdirSync(OUT).filter((f) => f.endsWith('.json') && f.includes('__') && !f.startsWith('.')).map((f) => JSON.parse(readFileSync(join(OUT, f), 'utf8'))).filter((r) => r.meta && r.blocks).map((r) => ({ ...r, cell: r.meta.cell, pacing: r.meta.pacing, seed: r.meta.seed, quick: r.meta.quick }));
  runs.sort((a, b) => a.cell.localeCompare(b.cell) || String(a.pacing).localeCompare(String(b.pacing)) || a.seed - b.seed);
  const cols = [
    ['distortion', (S) => f3(S.distortion.index)],
    ['worst joint', (S) => Object.entries(S.distortion.perJoint).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${f2(v)}`).join(' ')],
    ['selfPen/str', (S) => f3(S.selfPen.perStroke)],
    ['arm>torso/str', (S) => f3(S.selfPen.armThroughTorsoPerStroke)],
    ['tele/str', (S) => f3(S.selfPen.teleports.perStroke)],
    ['poleFlip/str', (S) => f3(S.selfPen.poleFlipsPerStroke)],
    ['ω>peak worst (×p99)', (S) => Object.entries(S.boneless.speed).sort((a, b) => b[1].xPeak - a[1].xPeak).slice(0, 2).map(([k, v]) => `${k} ${f2(v.xPeak)}`).join(' ')],
    ['α worst (×p99)', (S) => Object.entries(S.boneless.accel).sort((a, b) => b[1].xPeak - a[1].xPeak).slice(0, 1).map(([k, v]) => `${k} ${f2(v.xPeak)}`).join(' ')],
    ['osc>8Hz', (S) => f3(S.boneless.osc.highShareMean)],
    ['pelStd m', (S) => f3(S.boneless.pelvis.stdMedian)],
    ['dip m', (S) => f3(S.boneless.pelvis.dip)],
    ['bothOff', (S) => f3(S.boneless.feet.bothOffFrac)],
    ['off>0.1s', (S) => String(S.boneless.feet.episodes)],
    ['load', (S) => f2(S.boneless.load.median)],
    ['tip m/s', (S) => f2(S.task.tipPeakMedian)],
    ['hits/str', (S) => f2(S.task.hitsPerStroke)],
    ['recv/str', (S) => f2(S.task.woundsReceivedPerStroke)],
    ['falls/min', (S) => f2(S.task.fallsPerMin)],
    ['W/L/T', (S) => `${S.task.rounds.won}/${S.task.rounds.lost}/${S.task.rounds.timeout}`],
    ['miscl', (S) => (S.control ? `${S.control.misclass.count}/${S.control.strokes}` : '-')],
    ['spur c/t', (S) => (S.control ? `${f2(S.control.spuriousCommits.perStrokeClean)}/${f2(S.control.spuriousCommits.perStrokeCont)}` : '-')],
    ['drive+ ms', (S) => (S.control ? f2(S.control.driveAfterReleaseMs.median) : '-')],
    ['ret m/s', (S) => (S.control ? f2(S.control.postLiftHandSpeed.median) : '-')],
    ['hitch max', (S) => (S.control ? f2(S.control.hitch.max) : '-')],
  ];
  const md = ['# live_twin 표', '', `칸 파일 ${runs.length} 개 (${OUT}). 칸 = k<검술 보정> (본판)`, ''];
  for (const blk of ['passive', 'fight']) {
    md.push(`## ${blk}`, '', `| cell | pacing | seed | ${cols.map((c) => c[0]).join(' | ')} |`, `|${'---|'.repeat(cols.length + 3)}`);
    for (const r of runs) {
      const S = r.blocks[blk]?.summary;
      if (!S) continue;
      md.push(`| ${r.cell} | ${r.pacing} | ${r.seed}${r.quick ? 'q' : ''} | ${cols.map(([, fn]) => { try { return fn(S); } catch { return '-'; } }).join(' | ')} |`);
    }
    md.push('');
  }
  writeFileSync(join(OUT, 'table.md'), md.join('\n'));
  console.log(`표 ${join(OUT, 'table.md')} (${runs.length} 칸 파일)`);
}

if (arg('child', false)) await child();
else parent();
