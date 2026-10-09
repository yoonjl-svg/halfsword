// 걸음 계기 (10/10 유파 걸음 1 단계 — docs/strike/school_gait_design_2026-10-10.md): 무기마다 실제 결투에서 시험 쪽(X) 검객의 걸음을 잰다.
//  판은 `motion_lab.mjs duel <무기> <N> main` 과 같다 — 시험 무기 AI(인물 꾸러미 = 무기 id, 없으면 롱소드) 대 롱소드 AI, 자리 바꿔 N+N, 같은 씨앗(1000+s · 2000+s), 벽, 40 s.
//  읽기만 한다(난수·물리·AI 에 손대지 않음) — 승패 줄은 motion_lab duel main 첫 줄과 같아야 한다(같은 판이라는 확인).
//
//  실행: node tools/sim/gait_metrics.mjs [자리마다 판 수 24] [무기id ...]   (무기를 안 주면 longsword rapier zweihander monohoshizao uchigatana qinggang sabre)
//        설정을 바꿔 재기: node tools/sim/with_config.mjs GAIT.lift=0.04 gait_metrics.mjs 24 rapier
//        JSON=파일 → 무기별 원값을 JSON 으로도 쓴다
//
//  잰 것 (X 가 서 있고(state 'stand') 다리 걸음(gait.active)일 때만):
//   걸음 하나 = 한 발이 땅을 떠서(stance → 떠 있음) 다시 디딘 때까지. 종류 = gait.js 가 그 발을 들 때 정한 kind
//     walk(걷는 걸음) · settle(멈춘 뒤 펜싱 자세로 고쳐 딛기·몸 돌려 딛기) · req(기술 걸음 — 베며 내딛기·런지·비껴 딛기·비기 걸음) · catch(다리가 안 닿아 옮겨 딛기)
//   보폭(걸음 길이) = 디딘 발 → 다른(딛고 있던) 발 사이를 그 발이 옮긴 방향으로 잰 길이(m) — 사람 걸음의 step length. 발 옮긴 거리 = 그 발이 뜬 자리 → 디딘 자리(m, stride 의 한 발 몫)
//   걸음 빈도 = 걷는 동안(gait.walking) 디딘 walk 걸음 수 / 걷는 시간(걸음/s) · 걷는 빠르기 = 걷는 동안 골반 수평 속도 평균(m/s)
//   간 볼 때(AI mode 'watch', 시작 2 s 뺌): 골반 높이(m, 실제) · 골반 높이 목표(gait.h) · 두 발 다 디뎠을 때 두 발 너비(몸 오른쪽 축) · 앞뒤 발 간격(몸 앞 축)
//   옆걸음 비율 = walk 걸음 가운데 옮긴 방향의 옆 몫이 앞뒤 몫보다 큰 걸음 비율 · 간 보는 시간 가운데 스틱 옆 몫이 앞뒤 몫보다 크고 움직이는(|move| > 0.05) 시간 비율
//   발 들림 = 떠 있는 동안 발바닥 가운데 높이 최고 − 뜰 때 높이(m)
//   휘청 = 서 있는 시간 가운데 offBalance > GAIT.hurryFrom(내딛는 발을 서두르기 시작하는 문턱) 비율 · 붙잡기 반사 = gait.levC > 0.3 비율 · 일찍 디딤 = walk 걸음 가운데 정한 발 뜬 시간의 85 % 전에 디딘 비율(발이 땅에 걸림·무게 실림)
//   넘어짐 = stand → down. '걸음 중' = 그때 한 발이 떠 있거나 걷는 중 · '안 맞고' = 그 전 0.6 s 안에 X 가 받은 상처가 없음(맞아 넘어진 것과 가름)
//   런지 = installLunge 가 센 찌르기 런지 수(sk.lunges, 레이피어·에스톡 같은 찌르기 틀) · 기술 걸음 = req 걸음의 길이·수
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS, TRADITIONS, traditionOf } from '../../src/schools.js';
import { GAIT } from '../../src/config.js';
import { wilson } from './ref_duel.mjs';
import { writeFileSync } from 'node:fs';

// 재기 손잡이: GAIT_JSON='{"italian":{"guardWidth":0.17}}' → 그 유파 걸음 칸(TRADITIONS[t].gait)에 덮어 잰다(값 고르기용, src 는 그대로)
if (process.env.GAIT_JSON) for (const [t, o] of Object.entries(JSON.parse(process.env.GAIT_JSON))) TRADITIONS[t].gait = { ...(TRADITIONS[t].gait ?? {}), ...o };
const args = process.argv.slice(2);
const N = +args[0] || 24;
const ids = args.slice(1).length ? args.slice(1) : ['longsword', 'rapier', 'zweihander', 'monohoshizao', 'uchigatana', 'qinggang', 'sabre'];
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mx = (a) => (a.length ? Math.max(...a) : NaN);

function newAgg() {
  return {
    games: 0, W: 0, L: 0, D: 0, tEnd: 0, tN: 0,
    steps: { walk: [], settle: [], req: [], catch: [] }, // 걸음 하나 = { len, travel, fwd, lat, lift, dur }
    walkT: 0, walkSteps: 0, walkV: 0, // 걷는 시간·그동안 디딘 walk 걸음·속도 합(× DT)
    standT: 0,
    watch: { t: 0, pel: 0, h: 0, both: 0, width: 0, sep: 0, sideT: 0, moveT: 0, pelArr: [] },
    falls: 0, fallsStep: 0, fallsSelf: 0, fallsSelfStep: 0,
    wobT: 0, catchT: 0, followT: 0, // 휘청 시간(offBalance > GAIT.hurryFrom) · 붙잡기 반사 시간(gait.levC > 0.3)
    lunges: 0,
  };
}

function runWeapon(id) {
  const W = WEAPONS[id];
  if (!W) throw new Error(`무기 없음: ${id}`);
  const school = SCHOOLS[id] ? id : 'longsword'; // motion_lab duel main 과 같은 꾸러미
  const A = newAgg();
  A.tradition = traditionOf(W);
  for (let s = 1; s <= N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s + (+process.env.SEED0 || 0); // SEED0=24: 씨앗 1025~1048·2025~2048 (새 48 판 — motion_lab DUEL_SEED0 과 같은 꼴)
      const x = { weapon: id, persona: { school } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y;
      const E = xFirst ? y : x;
      const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy;
      const Y = xFirst ? G.enemy : G.player;
      const XA = xFirst ? G.ai2 : G.ai;
      const g = X.gait;
      const open = { F: null, B: null }; // 떠 있는 발의 기록
      let prevState = X.state;
      let lastHitT = -9;
      G.onWound = (att, vic) => { if (vic === X) lastHitT = G.t; };
      let res = 'D';
      for (let i = 0; i < 40 / DT; i++) {
        // 디딤·뜸은 스텝 전 상태와 견준다
        const before = g ? { F: g.legs.F.stance, B: g.legs.B.stance, active: g.active, walking: g.walking } : null;
        G.step();
        const st = X.state;
        if (prevState === 'stand' && st === 'down') {
          const stepping = before && (before.walking || !before.F || !before.B);
          const self = G.t - lastHitT > 0.6;
          A.falls++;
          if (stepping) A.fallsStep++;
          if (self) A.fallsSelf++;
          if (self && stepping) A.fallsSelfStep++;
        }
        prevState = st;
        if (!g) continue;
        const live = st === 'stand' && g.active;
        if (!live) { open.F = open.B = null; }
        else {
          A.standT += DT;
          if (X.offBalance > GAIT.hurryFrom) A.wobT += DT;
          if (g.levC > 0.3) A.catchT += DT;
          X.forward(_f);
          X.right(_r);
          for (const k of ['F', 'B']) {
            const l = g.legs[k];
            const was = before.active ? before[k] : true;
            if (was && !l.stance) {
              open[k] = { kind: l.kind, x: l.p0.x, z: l.p0.z, sole0: l.soleY, maxSole: l.soleY, t0: G.t, T: l.T };
            } else if (!l.stance && open[k]) {
              open[k].maxSole = Math.max(open[k].maxSole, l.soleY);
            } else if (!was && l.stance && open[k]) {
              const o = open[k];
              const other = g.legs[k === 'F' ? 'B' : 'F'];
              const dx = l.plant.x - o.x;
              const dz = l.plant.z - o.z;
              const travel = Math.hypot(dx, dz);
              const fwd = dx * _f.x + dz * _f.z;
              const lat = dx * _r.x + dz * _r.z;
              // 보폭: 디딘 발 − 다른 발 을 옮긴 방향에 비춘 길이
              const ux = travel > 1e-4 ? dx / travel : _f.x;
              const uz = travel > 1e-4 ? dz / travel : _f.z;
              const len = (l.plant.x - other.plant.x) * ux + (l.plant.z - other.plant.z) * uz;
              const rec = { len, travel, fwd, lat, lift: o.maxSole - o.sole0, dur: G.t - o.t0, early: G.t - o.t0 < 0.85 * o.T, cross: ((l.plant.x - other.plant.x) * _r.x + (l.plant.z - other.plant.z) * _r.z) * l.side < 0 };
              (A.steps[o.kind] ??= []).push(rec);
              if (o.kind === 'walk' && g.walking) A.walkSteps++;
              open[k] = null;
            }
          }
          if (g.follow) A.followT += DT;
          if (g.walking) {
            A.walkT += DT;
            const v = X.bodies.pelvis.linvel();
            A.walkV += Math.hypot(v.x, v.z) * DT;
          }
          if (XA && XA.mode === 'watch' && G.t > 2) {
            const w = A.watch;
            const py = X.bodies.pelvis.translation().y;
            w.t += DT;
            w.pel += py * DT;
            w.h += g.h * DT;
            if (w.pelArr.length < 200000 && (i & 3) === 0) w.pelArr.push(py);
            const mvx = Math.abs(X.move.x);
            const mvy = Math.abs(X.move.y);
            if (Math.hypot(mvx, mvy) > 0.05) {
              w.moveT += DT;
              if (mvx > mvy) w.sideT += DT;
            }
            if (g.legs.F.stance && g.legs.B.stance) {
              const dx = g.legs.F.plant.x - g.legs.B.plant.x;
              const dz = g.legs.F.plant.z - g.legs.B.plant.z;
              w.both += DT;
              w.width += Math.abs(dx * _r.x + dz * _r.z) * DT;
              w.sep += Math.abs(dx * _f.x + dz * _f.z) * DT;
            }
          }
        }
        const v = X.sword.linvel();
        if (![v.x, v.y, v.z].every(Number.isFinite)) break;
        const xd = X.state === 'dead';
        const yd = Y.state === 'dead';
        if (xd || yd) {
          res = xd && yd ? 'D' : yd ? 'W' : 'L';
          A.tEnd += G.t;
          A.tN++;
          break;
        }
      }
      A.games++;
      A[res]++;
      A.lunges += X.skill?.lunges ?? 0;
    }
  }
  return A;
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
const pc = (v) => (Number.isFinite(v) ? `${Math.round(100 * v)}%` : '-');
const out = {};
console.log(`걸음 계기 · 자리마다 ${N} 판 (상대 롱소드 AI, motion_lab duel main 과 같은 판) · GAIT.lift ${GAIT.lift} · guardHeight ${GAIT.guardHeight} · guardLength ${GAIT.guardLength} · guardWidth ${GAIT.guardWidth}`);
const rows = [];
const rows2 = [];
const extra = []; // GM_EXTRA=1: follow 시간 몫 · 엇갈린 walk 걸음(디딘 발이 딛고 있던 발의 반대편) · 끌어붙임(draw) 걸음 수·길이 — 기본 출력은 그대로
for (const id of ids) {
  const t0 = Date.now();
  const A = runWeapon(id);
  out[id] = A;
  const wk = A.steps.walk;
  const len = wk.map((s) => s.len);
  const trav = wk.map((s) => s.travel);
  const side = wk.filter((s) => Math.abs(s.lat) > Math.abs(s.fwd)).length;
  const all = Object.values(A.steps).flat();
  const w = A.watch;
  const [lo, hi] = wilson(A.W, A.games);
  const nStep = all.length;
  const rq = A.steps.req ?? [];
  rows.push(`| ${id} (${A.tradition}) | ${A.W}·${A.L}·${A.D} ${pc(A.W / A.games)} (${pc(lo)}~${pc(hi)}) | ${f2(avg(len))} / ${f2(pct(len, 0.9))} / ${f2(mx(len))} | ${f2(avg(trav))} / ${f2(mx(trav))} | ${f2(A.walkSteps / A.walkT)} | ${f2(A.walkV / A.walkT)} | ${f3(w.pel / w.t)} (목표 ${f3(w.h / w.t)}) | ${f3(w.width / w.both)} | ${f3(w.sep / w.both)} | ${pc(side / wk.length)} · ${pc(w.sideT / w.moveT)} | ${f3(avg(wk.map((s) => s.lift)))} / ${f3(avg(all.map((s) => s.lift)))} | ${(A.falls / A.games).toFixed(2)} · 걸음 중 ${pc(A.fallsStep / A.falls)} · 안 맞고 ${A.fallsSelf} (걸음 중 ${A.fallsSelfStep}) · 걸음 1000 당 ${f2((1000 * A.fallsSelfStep) / nStep)} |`);
  if (process.env.GM_EXTRA === '1') extra.push(`| ${id} | ${pc(A.followT / A.standT)} | ${wk.filter((s) => s.cross).length} (${pc(wk.filter((s) => s.cross).length / wk.length)}) | ${(A.steps.draw ?? []).length} | ${f2(avg((A.steps.draw ?? []).map((s) => s.travel)))} |`);
  rows2.push(`| ${id} | ${wk.length} · ${(A.steps.settle ?? []).length} · ${rq.length} · ${(A.steps.catch ?? []).length} | ${f2(A.walkT / A.standT)} | ${f2(avg(rq.map((s) => s.travel)))} / ${f2(mx(rq.map((s) => s.travel)))} | ${A.lunges} | ${f2(avg(wk.map((s) => s.dur)))} | ${f3(pct(w.pelArr, 0.1))} ~ ${f3(pct(w.pelArr, 0.9))} | ${pc(A.wobT / A.standT)} · ${pc(A.catchT / A.standT)} · ${pc(wk.filter((s) => s.early).length / wk.length)} · ${f2(A.steps.catch.length / A.games)} | ${((Date.now() - t0) / 1000).toFixed(0)} s |`);
  process.stderr.write(`${id} 끝 ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}
console.log('| 무기 (유파) | 승·패·무 승률 (95 %) | 보폭 평균 / p90 / 최대 m (walk) | 발 옮긴 거리 평균 / 최대 m | 걸음 빈도 /s | 걷는 빠르기 m/s | 간 볼 때 골반 높이 m | 두 발 너비 m | 앞뒤 발 간격 m | 옆걸음 (walk 걸음 · 간 보는 스틱 시간) | 발 들림 m (walk / 모든 걸음) | 넘어짐 /판 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log('');
console.log('| 무기 | 걸음 수 walk · settle · req · catch | 걷는 시간 몫 | 기술 걸음(req) 발 옮긴 거리 평균 / 최대 m | 런지 수 | walk 걸음 발 뜬 시간 s | 간 볼 때 골반 높이 p10 ~ p90 m | 휘청 · 붙잡기 반사 · 일찍 디딤 · catch 걸음/판 | 잰 시간 |');
console.log('|---|---|---|---|---|---|---|---|---|');
console.log(rows2.join('\n'));
if (extra.length) {
  console.log('');
  console.log('| 무기 | follow 시간 몫 | 엇갈린 walk 걸음 | 끌어붙임 걸음 | 끌어붙임 발 옮긴 거리 m |');
  console.log('|---|---|---|---|---|');
  console.log(extra.join('\n'));
}
if (process.env.JSON) {
  for (const A of Object.values(out)) A.watch.pelArr = undefined;
  writeFileSync(process.env.JSON, JSON.stringify(out));
}
