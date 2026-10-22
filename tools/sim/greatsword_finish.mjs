// 대검 마무리 측정 (10/22 — docs/strike/greatsword_finish_2026-10-22.md)
//  무기마다 쓰러진(누움) · 일어나는 중 · 무릎 꿇은 상대에게 플레이어가 탭 한 번 (skill.thrust — 실제 탭과 같은 길) → WIN 초 동안 본다.
//   맞음   : 마무리 칼(찍기 · 쪼개 내려치기)이 몸통 · 머리에 '마무리로' 들어간 접촉 = 판정 에너지 × FINISH.power 가 실린 접촉 (combat.js finishPower)
//            무릎 꿇은 상대는 마무리가 열리지 않고 약한 자세 겨눔 찌르기(vital_target.js)가 나간다 → 그 탭이 목 · 머리에 칼날(찌르기 · 베기)로 상처를 냈나
//   맞은 곳 · 판정 에너지(배율 뒤 eff, 맞음 접촉 평균) · 상처(이 탭 동안 칼날 상처 하나라도)
//   땅 먼저 : 내려치는 동안(tap.go ~ 끝) 상대 몸에 닿기 전에 칼끝이 땅(높이 0.03 m 아래)에 닿았나 — 내려친 탭 가운데 몫
//   칼면   : 탭 칼의 첫 접촉이 칼날 부품인데 둔기 판정(날이 안 서고 칼끝 축도 아님)인 탭 수
//   시간   : 탭 → 내려치기 시작(go) · 탭 → 맞음 · WIN 초 안 죽음(출혈 포함)과 탭 → 죽음
//  자리: 누움 = 자세 쟁기 · 지붕 × 거리 0.8 · 1.1 · 1.4 m × 넘어진 방향 넷 / 일어나는 중 = 쟁기 × 거리 셋 × 방향 넷 (누운 채 다가간 뒤 일어나기 시작 0.1 s 뒤 탭) /
//        무릎 꿇음 = 거리 1.4 · 1.6 · 1.8 m × 자세 쟁기 · 지붕 × 옆으로 0.3 s 비켜 섬 왼 · 오 (가벼운 넘어짐 뒤 무릎 꿇은 채로 둠 — 서 있는 · 무릎 꿇은 상대에게는
//         1.4 m 안으로 걸어 들어가지 않는다. 그 상대는 시드로 달라지는 것이 없어 자리를 바꿔 잰다 — 10/22 둘째 판)
//   거리 = 내 가슴 ↔ 상대 몸통(가슴 · 배 · 골반) 가장 가까운 곳 수평 거리 (down_hits.mjs torsoDist). 상대는 가만히(AI 끔). 결정적
//  사용법: node tools/sim/greatsword_finish.mjs [무기,무기,…] [--scen=down,getup,kneel] [--n=1] [--win=10] [--armour=none|plate] [--rows]
//   스위치(harness_m.mjs 환경 변수): FINISH_CLEAVE=0 = 사람 칼도 전 찍기 · FINISH_CLEAVE_AI=1 · FINISH_CLEAVE_CHARGE=초
import { newRound, DT, THREE, V, Q } from './harness_m.mjs';
import { torsoDist, FALLS } from './down_hits.mjs';
import { PADS } from './finish_thrust.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { isMain } from './is_main.mjs';

const FIN_PARTS = new Set(['chest', 'abdomen', 'pelvis', 'head']);
const PLATE = CHARACTERS.find((c) => c.id === 'heinrich').look;
export const WEAPONS_DEFAULT = ['longsword', 'zweihander', 'flamberge', 'tizona', 'monohoshizao', 'estoc', 'excalibur', 'kriegsmesser', 'qinggang'];

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  for (const k of ['prev', 'aim', 'aimRaw']) f.skill[k].set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}

export function gsTrial({ weapon, scen, guard = '쟁기', dist, fall = 'toward', seed, plate = false, win = 10, strafe = 0 }) {
  const G = newRound({ walls: false, gap: 2.4, seed, weapon, weapon2: 'longsword', ...(plate ? { look2: PLATE } : {}) });
  G.ai.update = () => {};
  const P = G.player;
  const E = G.enemy;
  const step = (mv = 0) => {
    P.move.set(0, mv);
    G.step();
  };
  setHand(P, PADS.쟁기);
  const j1 = Math.random() - 0.5;
  const j2 = Math.random() - 0.5;
  if (scen === 'kneel') {
    E.knockDown(false);
    E.setState('kneel'); // 다리를 크게 다쳐 무릎 꿇은 채 버티는 상태 (fighter.updateState — kneel 은 스스로 끝나지 않는다)
    for (let i = 0; i < 2.5 / DT; i++) step();
  } else {
    E.knockDown(true);
    E.downTime = 1e9;
    const a = FALLS[fall] + j1 * 0.5;
    const J = 40 * (1 + j2 * 0.4);
    for (let i = 0; i < 2.5 / DT; i++) {
      if (i * DT < 0.25) for (const k of ['chest', 'head']) E.bodies[k].applyImpulse({ x: Math.cos(a) * J * DT * 4, y: 0, z: Math.sin(a) * J * DT * 4 }, true);
      step();
    }
  }
  for (const [tol, mx] of [[0.12, 0.5], [0.03, 0.22]]) {
    for (let i = 0; i < 5 / DT; i++) {
      const d = torsoDist(P, E);
      if (Math.abs(d - dist) < tol) break;
      step(THREE.MathUtils.clamp((d - dist) * 2.5, -mx, mx));
    }
    for (let i = 0; i < 0.6 / DT; i++) step();
  }
  // 옆으로 비켜 서기 (무릎 꿇은 상대 판을 여러 자리로 — 그 상대는 시드로 달라지는 것이 없다): strafe 초 동안 옆걸음 (음수 = 왼쪽)
  if (strafe) {
    for (let i = 0; i < Math.abs(strafe) / DT; i++) {
      P.move.set(Math.sign(strafe) * 0.5, 0);
      G.step();
    }
    for (let i = 0; i < 0.6 / DT; i++) step();
  }
  // 자세로 천천히 (휘두르기로 보이지 않게)
  for (let i = 0; i < 1.2 / DT; i++) {
    const off = P.handOffset;
    const pad = PADS[guard];
    const dx = pad[0] - off.x;
    const dy = pad[1] - off.y;
    const d = Math.hypot(dx, dy);
    if (d > DT) (off.x += (dx / d) * DT), (off.y += (dy / d) * DT);
    else off.set(pad[0], pad[1]);
    step();
  }
  for (let i = 0; i < 0.4 / DT; i++) step();
  if (scen === 'getup') {
    E.downTime = 0; // 다음 스텝에 일어나기 시작
    for (let i = 0; i < 1 / DT && E.state !== 'getup'; i++) step();
    for (let i = 0; i < 0.1 / DT; i++) step();
  }
  const d0 = torsoDist(P, E);
  const eState = E.state;
  const L = P.weaponCfg.hiltLength + P.weaponCfg.bladeLength;
  const log = [];
  const C = G.combat;
  const orig = C.strike.bind(C);
  let t0 = Infinity;
  let tp = null;
  let touchedSinceGo = false;
  let ground = false;
  let goSeen = false;
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (r && G.t >= t0 && pr.w.fighter === P && pr.v?.fighter === E) {
      const strike = !!(tp?.down && tp.go && !tp.ended);
      if (strike || (goSeen && tp?.down)) touchedSinceGo = true;
      log.push({ t: G.t - t0, part: pr.v.part, wpart: pr.w.part, zone: r.zone, type: r.type, eff: r.eff, energy: r.energy, sev: r.severity, power: !!r.finishPower, plate: !!r.plate, helmet: !!r.helmet, inTap: !!tp && P.skill.tap === tp, strike });
    }
    return r;
  };
  G.before = () => {
    if (!tp?.down || !tp.go || tp.ended || P.skill.tap !== tp) return;
    goSeen = true;
    if (touchedSinceGo || ground) return;
    const tip = V(P.sword.translation()).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation())), L);
    if (tip.y < 0.03) ground = true;
  };
  t0 = G.t;
  const w0 = G.wounds.length;
  const ok = P.skill.thrust();
  const ranged = !!P.skill.vitalRange; // 약한 자세 겨눔: 먼저 간격을 맞추러 걷는다 (탭은 그 뒤 skill.updateVitalRange 가 연다)
  tp = P.skill.tap;
  let tDeath = null;
  for (let i = 0; i < win / DT; i++) {
    step();
    if (!tp && P.skill.tap) tp = P.skill.tap;
    if (tDeath == null && (E.state === 'dead' || E.revival)) tDeath = G.t - t0;
  }
  const down = !!tp?.down;
  const cleave = !!tp?.cleave;
  const hitRow = down ? log.find((l) => l.power && FIN_PARTS.has(l.part)) : log.find((l) => l.inTap && (l.zone === 'head' || l.zone === 'neck') && (l.type === 'cut' || l.type === 'stab') && l.sev > 0);
  const firstStrike = log.find((l) => (down ? l.strike : l.inTap)) ?? null;
  const flat = !!firstStrike && firstStrike.wpart === 'blade' && firstStrike.type === 'blunt'; // 칼면 맞음: 마무리 칼(탭)의 첫 접촉이 칼날 부품인데 둔기 판정 (날이 안 섬 — 찌르기 축도 아님)
  const ws = G.wounds.slice(w0).filter((w) => w.att === P && (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
  return {
    weapon, scen, guard, dist, fall, seed, plate, d0, eState, ok, tap: !!tp, ranged, down, cleave, vital: !!tp?.vital,
    go: !!tp?.go, tGo: tp?.tGo ?? null, ground, flat,
    hit: !!hitRow, zone: hitRow ? `${hitRow.zone}${hitRow.plate ? '(판)' : hitRow.helmet ? '(투구)' : ''}` : null, type: hitRow?.type ?? null, eff: hitRow?.eff ?? null, tHit: hitRow?.t ?? null,
    first: firstStrike ? `${firstStrike.part}/${firstStrike.type}` : null,
    wound: ws.length > 0, kill: tDeath != null, tDeath, cause: E.causeOfDeath ?? E.revival?.cause ?? null,
  };
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pc = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : '-');
const count = (a) => a.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});

export function summary(rows) {
  const n = rows.length;
  const go = rows.filter((r) => r.go);
  const hit = rows.filter((r) => r.hit);
  const kill = rows.filter((r) => r.kill);
  return {
    n, open: rows.filter((r) => r.down).length, cleave: rows.filter((r) => r.cleave).length, go: go.length,
    hit: hit.length, wound: rows.filter((r) => r.wound).length, ground: go.filter((r) => r.ground).length, flat: rows.filter((r) => r.flat).length,
    eff: avg(hit.map((r) => r.eff)), zones: count(hit.map((r) => r.zone)), tGo: avg(go.map((r) => r.tGo)), tHit: avg(hit.map((r) => r.tHit)),
    kill: kill.length, tDeath: avg(kill.map((r) => r.tDeath)), miss: count(rows.filter((r) => !r.hit).map((r) => (!r.tap ? '안나감' : r.first ?? '안닿음'))),
    vital: rows.filter((r) => r.vital).length,
  };
}

export function line(label, rows) {
  const s = summary(rows);
  return `${label.padEnd(22)} n ${String(s.n).padStart(3)} · 열림 ${pc(s.open, s.n).padStart(4)}${s.cleave ? ` (내려치기 ${s.cleave})` : ''}${s.vital ? ` (겨눔 찌르기 ${s.vital})` : ''} · 맞음 ${pc(s.hit, s.n).padStart(4)} · 상처 ${pc(s.wound, s.n).padStart(4)} · 땅 먼저 ${s.ground}/${s.go} · 칼면 ${s.flat} · 판정 ${f(s.eff, 0)} J · 탭→시작 ${f(s.tGo)} s · 탭→맞음 ${f(s.tHit)} s · 죽음 ${s.kill} (${f(s.tDeath, 1)} s) · 맞은 곳 ${JSON.stringify(s.zones)} · 못 맞힘 ${JSON.stringify(s.miss)}`;
}

export const SCENES = {
  down: (N) => { const o = []; for (const guard of ['쟁기', '지붕']) for (const dist of [0.8, 1.1, 1.4]) for (const fall of Object.keys(FALLS)) for (let s = 1; s <= N; s++) o.push({ scen: 'down', guard, dist, fall, seed: 500 + 17 * s + Math.round(dist * 100) + Object.keys(FALLS).indexOf(fall) * 1000 }); return o; },
  getup: (N) => { const o = []; for (const dist of [0.8, 1.1, 1.4]) for (const fall of Object.keys(FALLS)) for (let s = 1; s <= N; s++) o.push({ scen: 'getup', dist, fall, seed: 700 + 17 * s + Math.round(dist * 100) + Object.keys(FALLS).indexOf(fall) * 1000 }); return o; },
  kneel: (N) => { const o = []; for (const dist of [1.4, 1.6, 1.8]) for (const guard of ['쟁기', '지붕']) for (const strafe of [-0.3, 0.3]) for (let s = 1; s <= N; s++) o.push({ scen: 'kneel', dist, guard, strafe, seed: 900 + 17 * s + Math.round(dist * 100) }); return o; },
};
export const SCEN_KO = { down: '누움', getup: '일어나는 중', kneel: '무릎 꿇음' };

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const weapons = args.find((a) => !a.startsWith('--'))?.split(',') ?? WEAPONS_DEFAULT;
  const scens = opt('scen')?.split(',') ?? ['down', 'getup', 'kneel'];
  const N = +(opt('n') ?? 1);
  const win = +(opt('win') ?? 10);
  const plate = opt('armour') === 'plate';
  console.log(`대검 마무리 측정 · ${plate ? '판금 (하인리히 겉모습)' : '맨몸'} · 재는 시간 ${win} s · 칸마다 ${N} 판`);
  for (const weapon of weapons) {
    const all = [];
    for (const sc of scens) {
      const rows = SCENES[sc](N).map((o) => gsTrial({ ...o, weapon, plate, win }));
      all.push(...rows);
      console.log(line(`${weapon} ${SCEN_KO[sc]}`, rows));
      if (args.includes('--rows')) for (const r of rows) console.log(JSON.stringify(r));
    }
    if (scens.length > 1) console.log(line(`${weapon} 모두`, all));
  }
}
