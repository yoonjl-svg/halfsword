// ─────────────────────────────────────────────────────────────
//  gns_belly.mjs — 고노센 배 높이 길 재기 (사장님 11/06 '그래 배 쪽으로 재봐. 사선 베기의 모양도 지금보다는 완만해져도 돼' · 기록 docs/strike/gns_belly_2026-11-06.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만).
//  stand: 서 있는 과녁(AI 생각 끔 — 손 목표를 자세 패드에 묶음 · 걸음 0)에게 사람 고노센(requestIai player — 게임 발도 그대로)을 내고 스텝마다 칼날 선분으로
//   ① 상대 몸 부위마다 칼이 처음 닿는 때(u — 발도 0 ~ 1 · secret_instant.js stepIai 와 같은 닿음 instantTouch) · 차례 ② 게임이 판정한 첫 닿음(부위 · 구역 · 심각도) · 베고 지나감 둘째 닿음
//   ③ 칼이 상대 몸 가운데 줄(가슴 세로 축)을 지날 때 높이(땅 위 m) ④ 칼 가장 낮은 점(땅 위) · 제 다리 · 골반과 가장 가까운 거리 ⑤ 칼 팔 펴짐(어깨 ↔ 손목 / 팔 길이 — 가운데 · 끝) ⑥ 끝에 서 있나
//   를 적는다. 자세 = 롱소드 AI 간 보는 자세(WATCH_GUARDS 아홉) · 일본 AI(JAPANESE_WATCH 일곱 — schools.js) · 처음 손 = 허리 대기(hip — 사람 준비 SECRET.gnsReadyHip 자세) · 겨눔(guard — 손 그대로) ·
//   웅크림(crouch — AI 고노센의 발도 대기 iaiReadyPose 에서 AI 처럼 냄 · req.player 아님)
//  fight: jp_strength.mjs 싸움 그대로 + 고노센마다(발도 하나) 첫 닿음 부위 · 둘째 닿음 · 막힘 · 그때 AI 자세 · AI 몸짓(꽂개 — 읽기만)
//  node tools/sim/gns_belly.mjs stand [--set=SECRET.iaiBelly=1,...] [--foe=longsword,uchigatana] [--start=hip,guard] [--gap=+0.3,+0.75] [--json=파일] [--trace=파일 (그림용 — 한 자세)]
//  node tools/sim/gns_belly.mjs fight [--cells=...] [--seeds=1-24] [--set=...] [--par=4] [--tag=이름] [--json=파일]
//  node tools/sim/gns_belly.mjs agg <json ...>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { requestIai, iaiReadyPose, iaiReadyPosePlayer } from '../../src/secret_instant.js';
import { applySets } from './rapier_defence.mjs';
import { strengthProbe, strengthRow } from './jp_strength.mjs';
import { fightOne } from './school_balance.mjs';
import { isMain, simPath } from './is_main.mjs';

const { SECRET, ARM } = CONFIG;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const tv = (t) => new THREE.Vector3(t.x, t.y, t.z);
const tq = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);

// 칼날 선분 ↔ 콜라이더 겉 거리 — secret_instant.js segToCollider 와 같은 셈(그쪽은 안 내보냄 · 여기서 읽기만)
function segPointD(a, b, p) {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-12, ab.lengthSq())));
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}
function segSeg(a, b, c, d) {
  let best = Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 8; i++) {
    p.lerpVectors(a, b, i / 8);
    best = Math.min(best, segPointD(c, d, p));
  }
  return best;
}
export function segToCollider(a, b, col) {
  const sh = col.shape;
  const ct = tv(col.translation());
  const cq = tq(col.rotation());
  if (sh.type === 0) return segPointD(a, b, ct) - sh.radius;
  if (sh.type === 2) {
    const ax = new THREE.Vector3(0, sh.halfHeight, 0).applyQuaternion(cq);
    return segSeg(a, b, ct.clone().sub(ax), ct.clone().add(ax)) - sh.radius;
  }
  if (sh.type === 1) {
    const he = sh.halfExtents;
    const inv = cq.clone().invert();
    let best = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 8; i++) {
      p.lerpVectors(a, b, i / 8).sub(ct).applyQuaternion(inv);
      const qx = Math.abs(p.x) - he.x;
      const qy = Math.abs(p.y) - he.y;
      const qz = Math.abs(p.z) - he.z;
      best = Math.min(best, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0));
    }
    return best;
  }
  return Infinity;
}

/** 자세 목록: 상대 무기 → 그 AI 유파의 간 보는 자세 (그 AI 몸의 school.guards 그대로 — 롱소드 = 독일 WATCH_GUARDS · 우치가타나 = 일본 JAPANESE_WATCH) */
const guardCache = {};
export function guardsOf(foeW) {
  if (!guardCache[foeW]) {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: foeW, seed: 1 });
    guardCache[foeW] = G.ai.school.guards.map((g) => ({ name: g.name, pad: g.pad.slice() }));
    G.world.free();
  }
  return guardCache[foeW];
}

/**
 * 서 있는 과녁에게 사람 고노센 한 번. { touch: {부위: u}, order, first, second, crossY, minY, legGap, ext, stand }
 *  foeW 상대 무기 · guard 자세 이름 · start 'hip' | 'guard' · gapAdd = 맞닿기 거리(내 칼 measure.contact) 위로 더한 가슴 사이 (m) · trace = 프레임 적기(그림)
 */
export function standShot({ foeW = 'longsword', guard = 'langort', start = 'hip', gapAdd = 0.3, seed = 1, trace = false } = {}) {
  const pad = guardsOf(foeW).find((g) => g.name === guard)?.pad;
  if (!pad) throw new Error(`자세 없음 ${foeW} ${guard}`);
  // 가슴 사이를 먼저 어림 — 맞닿기 거리는 내 칼(우치가타나) 실측 measure.contact
  const G0 = newRound({ walls: false, weapon: 'uchigatana', weapon2: foeW, seed });
  const contact = G0.player.swordArt.measure.contact;
  G0.world.free();
  const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: foeW, seed, gap: contact + gapAdd });
  const P = G.player;
  const A = G.enemy;
  G.ai.update = () => {
    A.move.set(0, 0);
    A.handOffset.set(pad[0], pad[1]);
  };
  const settle = CONFIG.ARENA.startHold + 1.4;
  G.before = () => {
    if (start === 'hip' && !P.iai && !fired) iaiReadyPosePlayer(P, true, false, DT, true);
    if (start === 'crouch') iaiReadyPose(P, !fired, DT); // AI 고노센(숙련 5 일본)의 웅크린 발도 대기 — 그 자리에서 곧장 (req.player 아님 · 발도 중엔 AI 처럼 iaiBusy 로 0)
  };
  let fired = false;
  while (G.t < settle) G.step();
  const d0 = P.foeDistance();
  const foeY0 = Object.fromEntries(['chest', 'abdomen', 'pelvis'].map((n) => [n, A.bodies[n].translation().y]));
  requestIai(P, start === 'crouch' ? {} : { player: true });
  fired = true;
  const touch = {};
  // 그림 틀 (tools/sim/secret_trace.mjs 와 같은 꼴 — 낸 때 내 가슴 원점 · x 앞 · y 위 · z 칼 든 쪽): secret_trace_draw.py 가 그대로 읽음
  const c0 = tv(P.bodies.chest.translation());
  const inv = P.yaw.clone().invert();
  const BF = (v) => v.clone().sub(c0).applyQuaternion(inv).toArray().map(r3);
  const t0 = G.t;
  const res = { touch, order: [], first: null, second: null, crossY: null, minY: Infinity, legGap: Infinity, ext: { M: null, E: null }, d0: r3(d0), contact: r3(contact), frames: trace ? [] : null };
  const foeCols = [];
  const ownLeg = [];
  for (const [h, info] of G.combat.colliderInfo ?? P.colliderInfo) {
    if (info.kind === 'weapon' || info.detached) continue;
    if (info.fighter === A) foeCols.push({ h, info });
    else if (info.fighter === P && (info.kind === 'leg' || info.kind === 'pelvis')) ownLeg.push({ h, info });
  }
  let I = null;
  let nArc = 0;
  let bestCross = Infinity;
  const Lf = ARM.upper + ARM.fore;
  const shoulderW = () => new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], P.side * ARM.shoulder[2]).applyQuaternion(tq(P.bodies.chest.rotation())).add(tv(P.bodies.chest.translation()));
  const wristW = () => new THREE.Vector3(0.13, 0, 0).applyQuaternion(tq(P.bodies.farmS.rotation())).add(tv(P.bodies.farmS.translation()));
  for (let i = 0; i < Math.round(0.6 / DT); i++) {
    G.step();
    if (P.iai && P.iai.kind === 'iai') I = P.iai;
    if (!I) continue;
    const pts = I.arc?.pts ?? [];
    const u = I.u ?? 0;
    const fc = tv(A.bodies.chest.translation());
    for (; nArc < pts.length; nArc++) {
      const q = pts[nArc];
      const B = new THREE.Vector3(q[0], q[1], q[2]);
      const T = new THREE.Vector3(q[3], q[4], q[5]);
      for (const { h, info } of foeCols) {
        const col = G.world.getCollider(h);
        if (!col) continue;
        const r = segToCollider(B, T, col);
        if (r <= SECRET.instantTouch && touch[info.part] == null) {
          touch[info.part] = r3(u);
          res.order.push(info.part);
        }
      }
      for (const { h } of ownLeg) {
        const col = G.world.getCollider(h);
        if (col) res.legGap = Math.min(res.legGap, segToCollider(B, T, col));
      }
      res.minY = Math.min(res.minY, B.y, T.y);
      // 상대 몸 가운데 세로 축(가슴 x · z)에 가장 가까운 칼 점 — 그 높이
      for (let k = 0; k <= 16; k++) {
        const p = B.clone().lerp(T, k / 16);
        const hd = Math.hypot(p.x - fc.x, p.z - fc.z);
        if (hd < bestCross) (bestCross = hd), (res.crossY = r3(p.y));
      }
    }
    const v = I.ab < 1 ? (u - I.ab) / (1 - I.ab) : 1;
    if (res.ext.M == null && v >= 0.5) res.ext.M = r3(wristW().distanceTo(shoulderW()) / Lf);
    if (trace) {
      const fx = new THREE.Vector3(1, 0, 0).applyQuaternion(tq(P.bodies.farmS.rotation()));
      res.frames.push({ t: r3(G.t - t0), u: r3(u), sh: BF(shoulderW()), el: BF(tv(P.bodies.farmS.translation()).addScaledVector(fx, -0.135)), wr: BF(wristW()), hi: BF(P.bladePoint(0, new THREE.Vector3())), tip: BF(P.bladePoint(1, new THREE.Vector3())), fc: BF(tv(A.bodies.chest.translation())), fp: BF(tv(A.bodies.pelvis.translation())), fa: BF(tv(A.bodies.abdomen.translation())), fh: BF(tv(A.bodies.head.translation())), fua: BF(tv(A.bodies.uarmS.translation())), ffa: BF(tv(A.bodies.farmS.translation())), fuo: BF(tv(A.bodies.uarmO.translation())), ffo: BF(tv(A.bodies.farmO.translation())), mc: BF(tv(P.bodies.chest.translation())), mp: BF(tv(P.bodies.pelvis.translation())), cut: true, stiff: false, grip: false });
    }
    if (!P.iai) break;
  }
  if (I) {
    res.ext.E = r3(wristW().distanceTo(shoulderW()) / Lf);
    if (I.hit) res.first = { part: I.hit.info.part, kind: I.hit.info.kind, zone: I.res?.zone ?? null, type: I.res?.type ?? null, sev: r3(I.res?.severity), E: r3(I.res?.energy) };
    if (I.hit2) res.second = { part: I.hit2.info.part, kind: I.hit2.info.kind, zone: I.res2?.zone ?? null, sev: r3(I.res2?.severity) };
    res.blocked = !!I.blocked;
    res.ab = r3(I.ab);
  }
  // 굳음 끝까지 더 돌려 서 있나 본다 (발도 뒤 경직 · 잔심)
  for (let i = 0; i < Math.round(1.6 / DT); i++) G.step();
  res.foeY = Object.fromEntries(['chest', 'abdomen', 'pelvis'].map((n) => [n, r3(foeY0[n])]));
  res.stand = P.state === 'stand';
  res.pelvisY = r3(P.bodies.pelvis.translation().y);
  res.minY = r3(res.minY);
  res.legGap = r3(res.legGap);
  G.world.free();
  return res;
}

/** 첫 닿음을 네 몫으로: 팔 · 배 · 가슴(목 포함) · 그 밖 */
export const zoneGroup = (z) => (z == null ? '헛침' : z === 'arm' ? '팔' : z === 'abdomen' ? '배' : z === 'chest' || z === 'neck' ? '가슴' : '그 밖');

/** fight 꽂개 — jp_strength 꽂개 + 고노센(발도 하나)마다 첫 · 둘째 닿음 부위 · 막힘 · 낸 때 AI 자세 · AI 몸짓. 읽기만 */
export function bellyProbe() {
  const base = strengthProbe();
  let G = null;
  let P = null;
  let A = null;
  let cur = null;
  const gns = [];
  return {
    init(o) {
      base.init(o);
      ({ G, P, A } = o);
    },
    step(c, act) {
      base.step(c, act);
      const I = P?.iai;
      if (I && I.kind === 'iai' && I !== cur?.I) {
        cur = { I, t: G.t, guard: G.ai.guard?.name ?? null, mode: G.ai.mode ?? null, phase: G.ai.phase ?? null, d: P.foeDistance() };
      }
      if (cur && P.iai !== cur.I) {
        const J = cur.I;
        gns.push({ t: r3(cur.t / CONFIG.TIME.k), guard: cur.guard, mode: cur.mode, phase: cur.phase, d: r3(cur.d), first: J.hit ? J.res?.zone ?? J.hit.info.kind : null, part: J.hit?.info.part ?? null, sev: r3(J.res?.severity), type: J.res?.type ?? null, E: r3(J.res?.energy), second: J.hit2 ? J.res2?.zone ?? J.hit2.info.kind : null, sev2: r3(J.res2?.severity), blocked: !!J.blocked });
        cur = null;
      }
    },
    done(fires) {
      return { ...base.done(fires), gns };
    },
  };
}

const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const f2 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));

/** 칸 한 줄 (판 + 고노센 부위) */
export function bellyRow(rs) {
  const s = strengthRow(rs);
  const g = rs.flatMap((r) => r.probe?.gns ?? []);
  const by = { 팔: 0, 배: 0, 가슴: 0, '그 밖': 0, 헛침: 0 };
  for (const x of g) by[zoneGroup(x.first)]++;
  const hit = g.filter((x) => x.first);
  const sevPer = hit.length ? hit.reduce((a, x) => a + (x.sev ?? 0) + (x.sev2 ?? 0), 0) / hit.length : null;
  const blocked = g.filter((x) => x.blocked).length;
  const second = g.filter((x) => x.second).length;
  return { ...s, gnsN: g.length, gnsBy: by, gnsHitN: hit.length, sevPer, blocked, second, bigPer: mean(rs.map((r) => r.probe?.big?.dealt?.length ?? 0)) };
}

export function bellyMarkdown(runs, label = '') {
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = ['| 칸 | 견줌 | 판 | 이김 · 짐 · 비김 | 준 · 받은 심각도/판 | 넘어짐/판 | 고노센 낸 (판당) | 맞음 | 맞은 부위 팔 · 배 · 가슴 · 그 밖 (헛침) | 둘째 닿음 | 하나당 심각도 | 큰 상처/판 준 · 받은 | 막힘 |', '|---|---|---:|---|---|---:|---|---:|---|---:|---:|---|---:|'];
  for (const [k, rs] of Object.entries(cells)) {
    const s = bellyRow(rs);
    const b = s.gnsBy;
    out.push(`| ${k} | ${label} | ${s.n} | ${s.win} · ${s.lose} · ${s.draw} | ${f2(s.dealt)} · ${f2(s.recv)} | ${f2(s.fallsP)} | ${s.gnsN} (${f2(s.gnsN / s.n)}) | ${s.gnsHitN} | ${b.팔} · ${b.배} · ${b.가슴} · ${b['그 밖']} (${b.헛침}) | ${s.second} | ${f2(s.sevPer)} | ${f2(s.bigD)} · ${f2(s.bigR)} | ${s.blocked} |`);
  }
  return out.join('\n');
}

/** 고노센 하나하나 (낸 때 AI 자세 · 첫 닿음) */
export function gnsList(runs) {
  const out = [];
  for (const r of runs) for (const x of r.probe?.gns ?? []) out.push(`${r.opp} 씨앗 ${r.seed} ${x.t}s · AI ${x.guard ?? '-'}/${x.mode ?? '-'} · 가슴 사이 ${x.d} · 첫 ${x.first ?? '헛침'}(${x.part ?? '-'} ${x.sev ?? '-'})${x.second ? ` · 둘째 ${x.second} ${x.sev2}` : ''}${x.blocked ? ' · 막힘' : ''}`);
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'stand') {
    applySets(arg('set', ''));
    const foes = arg('foe', 'longsword,uchigatana').split(',');
    const starts = arg('start', 'hip,guard').split(',');
    const gaps = arg('gap', '0.3,0.75').split(',').map(Number);
    const only = arg('guards', null)?.split(',');
    const rows = [];
    for (const foeW of foes) {
      for (const g of guardsOf(foeW)) {
        if (only && !only.includes(g.name)) continue;
        for (const start of starts) for (const gapAdd of gaps) {
          const r = standShot({ foeW, guard: g.name, start, gapAdd, trace: !!arg('trace', null) });
          rows.push({ foeW, guard: g.name, start, gapAdd, ...r });
          console.log(`${foeW.padEnd(10)} ${g.name.padEnd(9)} ${start.padEnd(5)} +${gapAdd} | 첫 ${r.first ? `${r.first.zone}(${r.first.part}) ${r.first.sev}` : '헛침'}${r.second ? ` · 둘째 ${r.second.zone} ${r.second.sev}` : ''} | 차례 ${r.order.map((p) => `${p}@${r.touch[p]}`).join(' ')} | 가운데 줄 높이 ${r.crossY} | 칼 낮은 점 ${r.minY} · 제 다리 틈 ${r.legGap} | 팔 펴짐 ${r.ext.M} · ${r.ext.E} | 섬 ${r.stand ? 'o' : 'X'} | ab ${r.ab} · 과녁 가슴 · 배 · 골반 ${r.foeY.chest} · ${r.foeY.abdomen} · ${r.foeY.pelvis}`);
        }
      }
    }
    // 묶음: 첫 닿음 몫
    const sum = {};
    for (const r of rows) {
      const k = `${r.foeW} ${r.start}`;
      const s = (sum[k] ??= { n: 0, 팔: 0, 배: 0, 가슴: 0, '그 밖': 0, 헛침: 0, legMin: Infinity, minY: Infinity, fall: 0 });
      s.n++;
      s[zoneGroup(r.first?.zone)]++;
      s.legMin = Math.min(s.legMin, r.legGap);
      s.minY = Math.min(s.minY, r.minY);
      if (!r.stand) s.fall++;
    }
    for (const [k, s] of Object.entries(sum)) console.log(`== ${k}: ${s.n} 번 — 팔 ${s.팔} · 배 ${s.배} · 가슴 ${s.가슴} · 그 밖 ${s['그 밖']} · 헛침 ${s.헛침} | 칼 낮은 점 ${s.minY} · 제 다리 틈 ${s.legMin} | 넘어짐 ${s.fall}`);
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), rows: rows.map(({ frames, ...r }) => r) }));
    // 그림 (secret_trace.mjs 꼴 { iai: { id, seed, frames } } — 첫 줄 하나): python3 tools/sim/secret_trace_draw.py <전> <후> iai <png>
    const tr = arg('trace', null);
    if (tr && rows[0]?.frames) writeFileSync(tr, JSON.stringify({ iai: { id: `uchigatana vs ${rows[0].foeW} ${rows[0].guard}`, seed: 1, frames: rows[0].frames } }));
  } else if (mode === 'agg') {
    for (const p of rest.filter((x) => !x.startsWith('--'))) {
      const J = JSON.parse(readFileSync(p, 'utf8'));
      console.log(bellyMarkdown(J.runs, J.tag || J.set || '지금'));
      if (arg('list', '0') !== '0') console.log(gnsList(J.runs));
    }
  } else if (mode === 'fight') {
    const cells = arg('cells', 'japanese:uchigatana:longsword').split(',');
    const seeds = range(arg('seeds', '1-24'));
    const par = Math.max(1, +arg('par', 1));
    const set = arg('set', '');
    let runs;
    if (par > 1 && !arg('child', null)) {
      const dir = mkdtempSync(path.join(path.resolve('.tmp'), 'gnb-'));
      const chunks = Array.from({ length: par }, (_, i) => seeds.filter((_, j) => j % par === i)).filter((x) => x.length);
      const jobs = chunks.map((ch, i) => new Promise((res, rej) => {
        const out = path.join(dir, `c${i}.json`);
        const p = spawn(process.execPath, [simPath('gns_belly.mjs'), 'fight', `--cells=${cells.join(',')}`, `--seeds=${ch.join(',')}`, `--set=${set}`, `--json=${out}`, '--child=1'], { stdio: ['ignore', 'ignore', 'inherit'] });
        p.on('exit', (code) => (code === 0 ? res(JSON.parse(readFileSync(out, 'utf8')).runs) : rej(new Error(`자식 ${i} 끝남 ${code}`))));
      }));
      runs = (await Promise.all(jobs)).flat();
      rmSync(dir, { recursive: true, force: true });
      const order = (r) => cells.indexOf(`${r.school}:${r.weapon}:${r.opp}`) * 1e6 + r.seed;
      runs.sort((a, b) => order(a) - order(b));
    } else {
      applySets(set);
      runs = [];
      for (const c of cells) {
        const [school, weapon, opp] = c.split(':');
        for (const seed of seeds) {
          const r = fightOne({ school, weapon, opp, seed, dur: 30, tech: 0.35, probe: bellyProbe() });
          delete r.reads;
          runs.push(r);
        }
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set, cells, seeds, runs }));
    if (!arg('child', null)) {
      console.log(bellyMarkdown(runs, arg('tag', '') || set || '지금'));
      console.log(gnsList(runs));
    }
  }
}
