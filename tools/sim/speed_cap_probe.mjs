// ─────────────────────────────────────────────────────────────
//  speed_cap_probe.mjs — 맞음 판정 '초속 30 m 넘으면 버림'(src/combat.js analyze 의 `if (speed > 30) return null;`) 재기
//   (10/23 사장님 '초속30 제한 아예 풀어버리고나 완화하는 건 어때?' — 기록 docs/strike/speed_cap_2026-10-23.md). **재기만** — 게임 파일(src/)은 그대로.
//
//  어떻게 바꿔 끼우나: node 모듈 불러오기 갈고리(module.register)로 src/combat.js 를 불러올 때만 그 한 줄을
//   `if (globalThis.__speedGate ? globalThis.__speedGate(this, pr, point, S, P, predicting, speed) : speed > 30) return null;` 로 바꿔 읽는다(디스크의 파일은 그대로).
//   갈고리(gate)는 30 이하면 늘 '안 버림'(원래와 같음). 30 을 넘을 때만 그 분석을 적고, 같은 함수를 상한 없이 한 번 더 불러(부작용 없음) '버리지 않았다면'의
//   판정 꼴 · 에너지 · 심각도를 적은 뒤 고른 방식대로 버릴지 정한다. base 면 판이 바이트까지 같다(`wrap fights12.mjs | sha256sum` = fights12 기준).
//   Combat.predict · strike · afterStep 과 Fighter.cacheState 는 이 도구 안에서만 감싼다 — 어디서 불렸나 · 스텝 전 상태 기록(앞뒤 스텝 빠르기) · Rapier 접촉 깊이 ·
//   판(Combat 하나 = 한 판)마다 죽음 · 넘어짐 · 심각도 · 끝난 때. 판정 · 난수에는 손대지 않는다.
//
//  방식(--mode): base = 지금(30 넘으면 버림) · none = 상한 없음 · 45 · 60 = 그 빠르기 넘으면 버림 ·
//   filter = 30 넘을 때만 '튄 값' 거르기(지난 스텝과 견준 한 스텝 빨라짐 · 순간 이동 — 아래 FILTER) ·
//   noise · noise2 = base + 몸 세우기 힘 2500 → 2500.001 · 2500.002 (카오스 소음 폭 대조 — README '소음 폭') · nonenoise = none + 2500.001 (상한 없음 쪽의 소음 폭)
//
//  node tools/sim/speed_cap_probe.mjs run --set=f12|mix|pbot|iai --mode=base [--seeds=…] [--dur=30] [--json=파일]
//     f12  = fights12 와 같은 판(jelly_harness · 롱소드끼리 · AI normal · 30 초 · fights12 시드 난수, 시드 1 ~ 12 면 fights12 출력 sha 도 찍는다)
//     mix  = harness_m · 아홉 무기 서로 한 번씩(36 짝) × 시드 · 둘 다 AI(normal · 숙련도 5 — school_ai_fights 차림) · 30 초
//     pbot = 사람 손가락 흉내(아래 PBOT) 아홉 무기 × 상대 AI 둘(롱소드 · 츠바이핸더) × 시드 · 30 초(죽으면 0.5 초 뒤 끝)
//     iai  = 일본 네 무기 사람이 서 있는 과녁에 고노센(발도)을 곧장 냄 · 간격 1.8 ~ 3.0 m (고노센도 이 판정 길을 거치나 · 그 빠르기)
//  node tools/sim/speed_cap_probe.mjs wrap [--mode=base] [--json=파일] <다른 시뮬.mjs> [인자…]
//     다른 시뮬을 그대로 돌리며 30 넘는 분석을 적어 stderr 에 요약(stdout 은 그 시뮬 그대로). 환경 변수는 그 시뮬에 그대로 간다
//  node tools/sim/speed_cap_probe.mjs all [--jobs=4] [--dir=dist/speed_cap_probe] [--only=f12,mix,…] [--modes=…]
//     아래 JOBS(묶음) × 방식을 프로세스로 나눠(동시 jobs 개) 돌리고 report 를 찍는다 (4 코어 · 한가할 때 약 30 분)
//  node tools/sim/speed_cap_probe.mjs report [--dir=dist/speed_cap_probe]   이미 돈 json 으로 표만
// ─────────────────────────────────────────────────────────────
import { register } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const NEEDLE = 'if (speed > 30) return null;';
const PATCHED = 'if (globalThis.__speedGate ? globalThis.__speedGate(this, pr, point, S, P, predicting, speed) : speed > 30) return null;';

const argv = process.argv.slice(2);
const CMD = argv[0];
const args = {};
const rest = [];
for (const a of argv.slice(1)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m && !rest.length) args[m[1]] = m[2] ?? true;
  else rest.push(a);
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const range = (s) => {
  const out = [];
  for (const p of String(s).split(',').filter(Boolean)) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(+p);
  }
  return out;
};

// 거르기(d)의 가르기 수 — 30 넘는 분석만 본다(30 이하는 지금과 같음). 지난 스텝(n − 1)과 지금(n — 분석에 쓴 스텝 전 상태)만 본다(판 안에서 앞날은 모른다).
//  jump = 맞은 점(칼 · 몸 각각)의 빠르기 크기가 한 스텝에 늘어난 몫 ÷ dt (m/s² — 빠르기 벡터의 바뀜이 아니라 크기만: 도는 칼끝의 구심 가속도 v·ω 는 빼고 '갑자기 빨라짐'만)
//  tel = 그 점이 한 스텝에 실제로 간 자리와 n 의 빠르기 · 회전으로 갔어야 할 자리의 차 ÷ dt (m/s — 순간 이동)
//  값은 판정에 들어간 맞음의 분포 위끝(빨라짐 p99 390 m/s² · 순간 이동 p99 5.5 m/s — docs/strike/speed_cap_2026-10-23.md §3-1)
export const FILTER = { jump: 1200, tel: 8 };
const MIX_WEAPONS = ['longsword', 'zweihander', 'flamberge', 'uchigatana', 'rapier', 'morgenstern', 'druid_whip', 'kriegsmesser', 'qinggang'];
// 사람 손가락 흉내: unique_study_player.mjs 의 손가락 봇과 같은 꼴(60 Hz 프레임마다 손 자리 이동 · 쥠 · 1.35 ~ 1.85 m 간격 · 공격 결정의 15 % 는 탭 찌르기)에
//  긋기 손 빠르기를 셋 중 하나로 — 4 패드/s(unique_study_player 와 같음) · 7 · 10(druid_whip.mjs swing 의 0.12 s 긋기 꼴). 긋기 길은 AI 기술 길(ai_techniques.js TECH) 열둘. 막기 · 비기 없음
const PBOT = { speeds: [4, 7, 10], opps: ['longsword', 'zweihander'] };
const BINS = [[30, 35], [35, 45], [45, 60], [60, Infinity]];
const MODES = ['base', 'noise', 'noise2', 'none', 'nonenoise', '45', '60', 'filter'];
// all 이 돌리는 묶음: run 묶음 + 사람 쪽 도구를 wrap 으로. modes 를 줄인 묶음은 base 에 30 넘는 분석이 없어 상한 방식이 판을 못 바꾼다(none 하나로 확인 · noise 는 소음 폭)
const FEW = ['base', 'none', 'noise'];
const JOBS = {
  spin: { wrap: ['iberian_spin.mjs', 'duel', '--weapons=zweihander,flamberge', '--opps=longsword,isolde,heinrich,tome,omari,minami', '--seeds=1-3'] },
  spinprobe: { wrap: ['iberian_spin.mjs', 'probe', '--gaps=2.0,2.3,2.6'], modes: ['base', 'noise', 'none', '45', '60', 'filter'] },
  f12: { run: ['--set=f12', '--seeds=1-36'], modes: FEW },
  mix: { run: ['--set=mix', '--seeds=1'], modes: FEW },
  pbot: { run: ['--set=pbot', '--seeds=1-2'], modes: FEW },
  whip: { wrap: ['druid_whip.mjs', 'swing', 'tap'], modes: FEW },
  iai: { run: ['--set=iai', '--seeds=1'], modes: FEW },
  // 사람 입력 길 긋기(main.js 와 같은 터치 입력 — 손가락 12 · 5 패드 m/s) 아홉 무기 · 비기 운동학 길(격살 · 죽음의 일격) — base 만 (30 넘는 분석이 있나 · instantWound 빠르기)
  pad: { wrap: ['iberian_flat.mjs', 'pad', `--weapons=${MIX_WEAPONS.join(',')}`, '--reps=2', '--v=12,5', '--dist=1.4,1.7', '--hold=300', '--foe=stand'], modes: ['base'] },
  gyeok: { wrap: ['gyeoksal_strike.mjs'], modes: ['base'] },
  mord: { wrap: ['mordschlag_duel.mjs'], modes: ['base'] },
};

// ── 바꿔 끼우기 · 감싸기 ──
async function install(mode) {
  const loader = `export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  if (!url.endsWith('/src/combat.js')) return r;
  const src = String(r.source);
  if (!src.includes(${JSON.stringify(NEEDLE)})) throw new Error('speed_cap_probe: src/combat.js 에서 빠르기 상한 줄을 못 찾음 — 줄이 바뀌었으면 이 도구의 NEEDLE 을 고친다');
  return { ...r, source: src.replace(${JSON.stringify(NEEDLE)}, ${JSON.stringify(PATCHED)}) };
}`;
  register('data:text/javascript,' + encodeURIComponent(loader));
  const THREE = await import('../../node_modules/three/build/three.module.js');
  const CONFIG = await import('../../src/config.js');
  const { Combat } = await import('../../src/combat.js');
  const { Fighter } = await import('../../src/fighter.js');
  if (!Combat.prototype.analyze.toString().includes('__speedGate')) throw new Error('speed_cap_probe: 바꿔 끼우기 실패');
  const ANALYZE = Combat.prototype.analyze; // 상한 없이 다시 분석할 때는 이 원래 함수로 — 다른 도구가 analyze 를 감싸도(corr_lib tapEdge 등) 그 기록에 안 섞인다
  const NOISE = { noise: 0.001, noise2: 0.002, nonenoise: 0.001 };
  if (NOISE[mode]) CONFIG.BODY.uprightStiffness += NOISE[mode];
  const dt = CONFIG.PHYSICS.timestep;
  const minE = CONFIG.STRIKE.minEnergy;
  const cap = mode === 'none' || mode === 'nonenoise' ? Infinity : mode === '45' ? 45 : mode === '60' ? 60 : 30;
  const L = { mode, events: [], wounds: [], woundCount: 0, combats: [], step: 0, label: null, instant: [], jt: [] };
  const HIST = new WeakMap(); // fighter → Map(step → { sword, seg[], parts{} })
  const CMAP = new WeakMap(); // Combat → 판 기록
  let CTX = null; // 지금 분석을 부른 곳 { kind: predict | pass | bounce, cool, events[] }
  let bypass = false;
  const pending = [];
  const V = (a, i) => new THREE.Vector3(a[i], a[i + 1], a[i + 2]);
  const arr = (b) => [b.p.x, b.p.y, b.p.z, b.q.x, b.q.y, b.q.z, b.q.w, b.com.x, b.com.y, b.com.z, b.v.x, b.v.y, b.v.z, b.w.x, b.w.y, b.w.z];
  const r3 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1000) / 1000);
  const cOf = (combat) => {
    let C = CMAP.get(combat);
    if (!C) {
      const fs = [...combat.fighters].sort((a, b) => a.index - b.index);
      C = { id: L.combats.length, label: L.label, fs, weapons: fs.map((f) => f.weapon?.id), steps: 0, deadAt: null, downs: 0, prev: fs.map(() => 'stand'), wounds: 0, fast: 0, over: 0 };
      CMAP.set(combat, C);
      L.combats.push(C);
    }
    return C;
  };
  // 스냅숏 배열 a 에서 몸 기준 자리 loc 인 점의 월드 자리 · 빠르기
  const kin = (a, loc) => {
    const pt = loc.clone().applyQuaternion(new THREE.Quaternion(a[3], a[4], a[5], a[6])).add(V(a, 0));
    const r = pt.clone().sub(V(a, 7));
    return { pt, v: V(a, 13).cross(r).add(V(a, 10)) };
  };
  // 한 스텝(a0 → a1)의 순간 이동: 그 점이 실제로 간 자리 − (a0 에서 a1 의 빠르기 · 회전으로 갔어야 할 자리), ÷ dt
  const tele = (a0, a1, loc) => {
    const p0 = kin(a0, loc).pt;
    const p1 = kin(a1, loc).pt;
    const w = V(a1, 13);
    const ang = w.length() * dt;
    const dq = ang > 1e-12 ? new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), ang) : new THREE.Quaternion();
    const c0 = V(a0, 7);
    const exp = p0.clone().sub(c0).applyQuaternion(dq).add(c0).addScaledVector(V(a1, 10), dt);
    return p1.distanceTo(exp) / dt;
  };
  const histOf = (f, step) => HIST.get(f)?.get(step) ?? null;
  // S/P 가 어느 몸의 스텝 전 상태인가 (칼 몸체 · 채찍 마디 i · 몸 부위) — 도구가 만든 상태(순간 베기 등)면 null
  const keyOfS = (att, S) => {
    if (S === att.cache?.sword) return 'sword';
    const segs = att.flexWeapon?.segments;
    if (segs) for (let i = 0; i < segs.length; i++) if (segs[i].state === S) return i;
    return null;
  };
  const pick = (h, key) => (h == null ? null : key === 'sword' ? h.sword : typeof key === 'number' ? h.seg[key] : h.parts[key]);
  // 맞은 점의 칼 · 몸 빠르기 내력 (n, n − 1, n − 2, n − 3): 빠르기 · 상대 빠르기 · 그 스텝으로 들어온 가속도 · 순간 이동
  function history(att, vic, pr, point, S, P) {
    const sk = keyOfS(att, S);
    const pk = P === vic.cache?.parts?.[pr.v.part] ? pr.v.part : null;
    if (sk == null || pk == null) return null;
    const locB = new THREE.Vector3().copy(point).sub(S.p).applyQuaternion(S.q.clone().invert());
    const locV = new THREE.Vector3().copy(point).sub(P.p).applyQuaternion(P.q.clone().invert());
    const n = L.step;
    const out = { n, sk, pk, locB: locB.toArray(), locV: locV.toArray(), past: [] };
    for (let k = 0; k <= 3; k++) {
      const a = pick(histOf(att, n - k), sk), b = pick(histOf(vic, n - k), pk);
      if (!a || !b) break;
      const a0 = pick(histOf(att, n - k - 1), sk), b0 = pick(histOf(vic, n - k - 1), pk);
      const kb = kin(a, locB), kv = kin(b, locV);
      const row = { vB: r3(kb.v.length()), vV: r3(kv.v.length()), rel: r3(kb.v.clone().sub(kv.v).length()), wS: r3(V(a, 13).length()) };
      if (a0 && b0) {
        const pb = kin(a0, locB).v, pv = kin(b0, locV).v;
        row.accB = r3(kb.v.distanceTo(pb) / dt); // 벡터 바뀜 (구심 가속도 포함 — 참고)
        row.accV = r3(kv.v.distanceTo(pv) / dt);
        row.jumpB = r3((kb.v.length() - pb.length()) / dt); // 크기만 (+ = 빨라짐)
        row.jumpV = r3((kv.v.length() - pv.length()) / dt);
        row.telB = r3(tele(a0, a, locB));
        row.telV = r3(tele(b0, b, locV));
      }
      out.past.push(row);
    }
    return out;
  }
  const causalSpike = (h) => {
    const p = h?.past?.[0];
    if (!p || p.accB == null) return false;
    return p.jumpB > FILTER.jump || p.jumpV > FILTER.jump || p.telB > FILTER.tel || p.telV > FILTER.tel;
  };
  globalThis.__speedGate = (combat, pr, point, S, P, predicting, speed) => {
    if (bypass) return false;
    if (!CTX) L.instant.push({ weapon: pr.w.fighter.weapon?.id, speed: r3(speed), secret: !!pr.w.fighter.stamina?.inSecret }); // 맞음 판정 길 밖(순간 베기 · 연환 · 격살 instantWound)에서 부른 분석은 빠르기를 다 적는다 (드물다)
    if (speed <= 30) return false; // 30 이하는 늘 원래와 같다
    const att = pr.w.fighter, vic = pr.v.fighter;
    const C = cOf(combat);
    const vB = new THREE.Vector3().copy(point).sub(S.com).cross(S.w).negate().add(S.v);
    const vV = new THREE.Vector3().copy(point).sub(P.com).cross(P.w).negate().add(P.v);
    const dir = vB.clone().sub(vV).divideScalar(speed);
    const h = history(att, vic, pr, point, S, P);
    bypass = true;
    let r = null;
    try { r = ANALYZE.call(combat, pr, point, S, P, predicting); } finally { bypass = false; }
    const ev = {
      combat: C.id, label: C.label, t: r3(combat.stepNo * dt), step: L.step, ctx: CTX ? CTX.kind : h ? 'other' : 'instant', cool: !!CTX?.cool,
      att: att.index, vic: vic.index, weapon: att.weapon?.id, wpart: pr.w.part, seg: typeof h?.sk === 'number' ? h.sk : null, part: pr.v.part,
      speed: r3(speed), vB: r3(vB.length()), vV: r3(vV.length()), shareB: r3(vB.dot(dir)), shareV: r3(-vV.dot(dir)),
      attState: att.state, vicState: vic.state, secret: !!att.stamina?.inSecret, player: !att.aiControlled,
      r: r ? { type: r.type, zone: r.zone, energy: r3(r.energy), eff: r3(r.eff), thr: r3(r.thr), sev: r3(r.severity), pass: r.pass, t: r3(r.t) } : null,
      hist: h ? { past: h.past } : null, spikeCausal: causalSpike(h),
    };
    ev.drop = mode === 'filter' ? ev.spikeCausal : speed > cap;
    C.over++;
    if (h) pending.push({ ev, att, vic, h });
    L.events.push(ev);
    if (CTX) CTX.events.push(ev);
    return ev.drop;
  };
  // 앞날(n + 1, n + 2)의 빠르기 — 가르기 표(§2)에만 쓴다. 판정 · 거르기(d)는 읽지 않는다
  function finalize(force) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const { ev, att, vic, h } = pending[i];
      if (!force && L.step < h.n + 2) continue;
      const locB = new THREE.Vector3().fromArray(h.locB), locV = new THREE.Vector3().fromArray(h.locV);
      ev.next = [];
      for (let k = 1; k <= 2; k++) {
        const a = pick(histOf(att, h.n + k), h.sk), b = pick(histOf(vic, h.n + k), h.pk);
        if (!a || !b) break;
        const kb = kin(a, locB), kv = kin(b, locV);
        ev.next.push({ vB: r3(kb.v.length()), vV: r3(kv.v.length()), rel: r3(kb.v.clone().sub(kv.v).length()) });
      }
      pending.splice(i, 1);
    }
  }
  const depth = (world, wc, vc) => {
    let d = null;
    const c1 = world.getCollider(wc), c2 = world.getCollider(vc);
    if (!c1 || !c2) return null;
    world.contactPair(c1, c2, (m) => { for (let i = 0; i < m.numContacts(); i++) { const x = m.contactDist(i); if (d == null || x < d) d = x; } });
    return d == null ? null : r3(-d * 1000); // mm, + = 파고듦
  };
  const P0 = Combat.prototype;
  const oPredict = P0.predict, oStrike = P0.strike, oAfter = P0.afterStep;
  P0.predict = function (pr) {
    const prev = CTX;
    CTX = { kind: 'predict', cool: false, events: [] };
    try { return oPredict.call(this, pr); } finally { for (const e of CTX.events) e._pair = [pr.wc, pr.vc]; CTX = prev; }
  };
  P0.strike = function (pr, point, passing) {
    const prev = CTX;
    const att = pr.w.fighter, vic = pr.v.fighter;
    const cool = vic.hitCooldowns.has(`${att.index}:${pr.v.part}`);
    CTX = { kind: passing ? 'pass' : 'bounce', cool, events: [] };
    try {
      const r = oStrike.call(this, pr, point, passing);
      if (CTX.events.length && this.__world) { const d = depth(this.__world, pr.wc, pr.vc); for (const e of CTX.events) e.depth = d; }
      if (r && !cool) {
        // 판정에 들어간 맞음 — 빠른 것(20 넘음)은 같은 내력도 (거르기 수를 고를 때 '정상 맞음' 쪽 분포)
        const C = cOf(this);
        L.woundCount++;
        C.wounds++;
        if (r.speed > 30) C.fast++;
        const S = pr.w.state || att.cache?.sword, P = vic.cache?.parts?.[pr.v.part];
        const h = S && P ? history(att, vic, pr, point, S, P) : null;
        const p0 = h?.past?.[0];
        if (p0?.jumpB != null) L.jt.push([r3(r.speed), r3(Math.max(p0.jumpB, p0.jumpV)), r3(Math.max(p0.telB, p0.telV))]); // 모든 맞음의 빠르기 · 빨라짐 · 순간 이동 (튄 값이 30 아래에도 있나)
        if (r.speed > 20) {
          L.wounds.push({ combat: C.id, label: C.label, t: r3(this.stepNo * dt), att: att.index, weapon: att.weapon?.id, part: pr.v.part, type: r.type, energy: r3(r.energy), sev: r3(r.severity), speed: r3(r.speed), player: !att.aiControlled, hist: h ? { past: h.past } : null, spikeCausal: causalSpike(h) });
        }
      }
      return r;
    } finally { CTX = prev; }
  };
  P0.afterStep = function (world, eq) {
    this.__world = world;
    const C = cOf(this);
    for (const e of L.events) if (e._pair && e.step === L.step) { e.depth = depth(world, e._pair[0], e._pair[1]); delete e._pair; }
    const out = oAfter.call(this, world, eq);
    C.steps++;
    C.fs.forEach((f, i) => {
      const s = f.state;
      if (C.prev[i] === 'stand' && (s === 'down' || s === 'getup')) C.downs++;
      C.prev[i] = s;
      if (C.deadAt == null && s === 'dead') C.deadAt = r3(C.steps * dt);
    });
    L.step++;
    return out;
  };
  const oCache = Fighter.prototype.cacheState;
  Fighter.prototype.cacheState = function () {
    oCache.call(this);
    let m = HIST.get(this);
    if (!m) HIST.set(this, (m = new Map()));
    const c = this.cache;
    const parts = {};
    for (const k in c.parts) parts[k] = arr(c.parts[k]);
    m.set(L.step, { sword: arr(c.sword), seg: (this.flexWeapon?.segments ?? []).map((s) => arr(s.state)), parts });
    m.delete(L.step - 8);
    if (this.index === 1) finalize(false);
  };
  // 판 요약 (Combat 하나 = 한 판). sev[i] = i 쪽이 준 심각도(상대 몸의 상처 심각도 합 — 잘린 단면 상처 포함)
  L.summary = () => {
    finalize(true);
    return L.combats.map((C) => {
      const [a, b] = C.fs;
      const sevOf = (f) => +(f?.wounds ?? []).reduce((s, w) => s + (w.severity > 0 ? w.severity : 0), 0).toFixed(3);
      return {
        id: C.id, label: C.label, weapons: C.weapons, end: `${a?.state}/${b?.state}`,
        winner: a?.state === 'dead' && b?.state !== 'dead' ? 1 : b?.state === 'dead' && a?.state !== 'dead' ? 0 : -1,
        tDead: C.deadAt, tEnd: C.deadAt ?? r3(C.steps * dt), downs: C.downs, sev: [sevOf(b), sevOf(a)], wounds: C.wounds, fast: C.fast, over: C.over,
        ...(C.fired != null ? { fired: C.fired } : {}),
      };
    });
  };
  L.dump = () => ({ mode, filter: FILTER, combats: L.summary(), events: L.events, wounds: L.wounds, woundCount: L.woundCount, instant: L.instant, jt: L.jt });
  L.CONFIG = CONFIG;
  return { THREE, CONFIG, L };
}

// ── 판 묶음 ──
async function runSet(set, mode, seeds, dur) {
  const { CONFIG, L } = await install(mode);
  let f12sha = null;
  if (set === 'f12') {
    const { newRound, DT, AI } = await import('./jelly_harness.mjs');
    const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
    const out = [];
    for (const seed of seeds) {
      L.label = `f12:${seed}`;
      seedRand(seed);
      const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
      G.ai2 = new AI(P, E, 'normal');
      const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
      let downs = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null;
      for (let i = 0; i < dur / DT; i++) {
        G.step();
        for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; }
        if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
      }
      out.push({ seed, end: `${P.state}/${E.state}`, tDead, downs, opened: hits.filter((h) => h.type !== 'blunt' && h.severity > 0).length, maxE: Math.round(Math.max(0, ...hits.map((h) => h.energy))) });
    }
    if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every((s, i) => seeds[i] === s)) {
      // fights12.mjs 와 같은 두 줄 (시드 1 ~ 12) — base 면 fights12 기준 sha 와 같아야 한다
      const o = out.slice(0, 12);
      const dead = o.filter((x) => x.end.includes('dead')).length;
      const txt = `energyScale ${CONFIG.STRIKE.energyScale}: dead ${dead}/12, downs/fight ${(o.reduce((s, x) => s + x.downs, 0) / 12).toFixed(1)}, opened/fight ${(o.reduce((s, x) => s + x.opened, 0) / 12).toFixed(1)}\n`
        + o.map((x) => `${x.seed}:${x.end}${x.tDead ? '@' + x.tDead : ''} d${x.downs} o${x.opened} E${x.maxE}`).join('  ') + '\n';
      f12sha = createHash('sha256').update(txt).digest('hex').slice(0, 8);
    }
  } else if (set === 'mix') {
    const { newRound, DT, AI } = await import('./harness_m.mjs');
    const pairs = [];
    for (let i = 0; i < MIX_WEAPONS.length; i++) for (let j = i + 1; j < MIX_WEAPONS.length; j++) pairs.push([MIX_WEAPONS[i], MIX_WEAPONS[j]]);
    for (const seed of seeds) for (let k = 0; k < pairs.length; k++) {
      const [a, b] = seed % 2 ? pairs[k] : [pairs[k][1], pairs[k][0]]; // 시드마다 자리를 바꿔 앉힌다 (홀수 시드 = 앞 무기가 P)
      L.label = `mix:${seed}:${a}-${b}`;
      const G = newRound({ walls: true, seed: seed * 100 + k, weapon: a, weapon2: b, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
      for (let i = 0; i < Math.round(dur / DT); i++) G.step();
      G.world.free?.();
    }
  } else if (set === 'pbot') {
    const { newRound, DT } = await import('./harness_m.mjs');
    const { TECH } = await import('../../src/ai_techniques.js');
    const { SKILL } = CONFIG;
    const FRAME = 2 * DT;
    let k = 0;
    for (const seed of seeds) for (const w of MIX_WEAPONS) for (const opp of PBOT.opps) {
      k++;
      L.label = `pbot:${seed}:${w}-${opp}`;
      let rs = (seed * 7919 + k * 104729) >>> 0;
      const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
      const G = newRound({ walls: true, seed: 700 + seed * 50 + k, weapon: w, weapon2: opp });
      const D = G.player;
      D.skill.corr = SKILL.corr; D.skill.corrTip = SKILL.corrTip; D.skill.autoGuard = true; D.schoolFootwork = true; D.schoolParry = true;
      let queue = [], fx = D.handOffset.x, fy = D.handOffset.y, nextAtk = 2.6, step = 0;
      const to = (p, v, held) => { const fr = []; let x = fx, y = fy; for (let i = 0; i < 400; i++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, v * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, held]); } fx = x; fy = y; return fr; };
      const stroke = (b, v, back) => { const fr = to(b.from, 1.6, false); fr.push(...Array(4).fill([0, 0, false])); for (const p of b.path) fr.push(...to(p, v, true)); if (back) { fr.push(...Array(3).fill([0, 0, true])); fr.push(...to(b.from, v, true)); } fr.push(...Array(6).fill([0, 0, false])); return fr; };
      G.before = () => {
        const t = G.t, dist = D.foeDistance();
        if (!queue.length && t >= nextAtk && dist < 2.0 && D.alive && D.armed && !D.stamina.exhausted) {
          if (rnd() < 0.15) D.skill.thrust();
          else queue = stroke(TECH[Math.floor(rnd() * TECH.length)], PBOT.speeds[Math.floor(rnd() * PBOT.speeds.length)], rnd() < 0.4);
          nextAtk = t + 1.0 + rnd() * 0.6;
        }
        if ((step++ & 1) === 0) {
          const f = queue.shift() ?? [0, 0, false];
          D.handOffset.x += f[0]; D.handOffset.y += f[1];
          D.handHeld = f[2]; D.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5 || f[2];
          if (!queue.length) { fx = D.handOffset.x; fy = D.handOffset.y; }
        }
        if (D.stamina.exhausted || !D.alive) D.move.set(0, 0); else D.move.set(0.18 * Math.sin(t * 0.65 + seed), dist < 1.35 ? -0.55 : dist > 1.85 ? 0.45 : 0);
        D.stickX = D.move.x; D.stickY = D.move.y;
      };
      let end = dur;
      for (let i = 0; i < dur / DT; i++) { G.step(); if ((!D.alive || !G.enemy.alive) && end === dur) end = G.t + 0.5; if (G.t >= end) break; }
      G.world.free?.();
    }
  } else if (set === 'iai') {
    // 일본 비기 고노센(발도 — secret_instant.js) 판정 길 확인: 플레이어가 서 있는 롱소드 과녁(AI 멈춤 · 칼 충돌 끔 · 죽지 않음 — iberian_spin.mjs probe 와 같은 과녁)에
    //  2.6 s 에 비기를 곧장 낸다. instantWound 가 부른 분석의 빠르기는 L.instant 에 다 적힌다
    const { newRound, DT } = await import('./harness_m.mjs');
    const { PlayerSecretWatch } = await import('../../src/secret.js');
    const { SKILL } = CONFIG;
    for (const seed of seeds) for (const w of ['uchigatana', 'monohoshizao', 'kusanagi', 'muramasa']) for (const gap of [1.8, 2.2, 2.6, 3.0]) {
      L.label = `iai:${seed}:${w}:${gap}`;
      const G = newRound({ seed: 7 + seed, weapon: w, weapon2: 'longsword', gap, walls: false });
      const P = G.player, E = G.enemy;
      P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true;
      G.ai.update = () => E.move.set(0, 0);
      for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
      E.die = () => {};
      const watch = new PlayerSecretWatch(P, E, { locked: false });
      let fired = false;
      G.before = () => { watch.update(DT, !!P.skill.sec); P.move.set(0, 0); if (!fired && G.t > 2.6) fired = !!P.skill.secret({ S: P.swordArt.school && watch.S, ctx: {} }); };
      while (G.t < 5) G.step();
      L.combats.at(-1).fired = fired;
      G.world.free?.();
    }
  } else throw new Error(`묶음 ${set}?`);
  return { set, ...L.dump(), seeds, dur, f12sha };
}

// ── 표 ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)} %` : '–');
const med = (xs) => { const s = xs.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const qtl = (xs, p) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const cnt = (xs, key) => { const m = new Map(); for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
const binName = ([a, b]) => `${a}–${b === Infinity ? '' : b}`;
// 버려진 맞음(판정에 들어갔을 것) = 맞음 판정 길(strike — pass · bounce, 순간 베기 instant)에서 쿨다운이 아니고, 상한 없이 분석하면 minEnergy(6 J)를 넘는 것.
//  같은 칼 → 같은 부위가 0.25 s(hitCooldown) 안에 거듭 버려진 것은 한 번으로 묶는다(버리면 쿨다운이 안 걸려 다음 스텝에 또 분석된다)
export function dropHits(events, minE = 6) {
  const hits = [];
  const last = new Map();
  for (const e of events) {
    if (!(e.ctx === 'pass' || e.ctx === 'bounce' || e.ctx === 'instant') || e.cool || !e.r || e.r.energy < minE) continue;
    const k = `${e.combat}|${e.att}|${e.part}`;
    const prev = last.get(k);
    if (prev && e.t - prev.t <= 0.25) { prev.n++; prev.maxSpeed = Math.max(prev.maxSpeed, e.speed); continue; }
    const h = { ...e, n: 1, maxSpeed: e.speed };
    hits.push(h);
    last.set(k, h);
  }
  return hits;
}
// 진짜 · 튄 값 가르기 (앞 스텝까지 봄 — 표 전용, §2):
//  teleport = 그 스텝에 칼 · 몸 점이 빠르기와 안 맞게 옮겨짐(tel > FILTER.tel) · spike = 칼 · 몸 점 빠르기 크기가 한 스텝에 FILTER.jump 넘게 늘었고 바로 앞 스텝 상대 빠르기가 지금의 80 % 아래(한 스텝에 튀어 오름) ·
//  smooth = 그 밖(앞 스텝에도 빨랐다 — 이어진 빠른 획) · instant = 순간 베기 길(내력 없음)
export function label(e) {
  const p = e.hist?.past;
  if (!p || p.length < 2 || p[0].accB == null) return e.ctx === 'instant' ? 'instant' : 'unknown';
  const now = p[0], prev = p[1];
  if (now.telB > FILTER.tel || now.telV > FILTER.tel) return 'teleport';
  if ((now.jumpB > FILTER.jump || now.jumpV > FILTER.jump) && !(prev.rel > 0.8 * now.rel)) return 'spike';
  return 'smooth';
}

function loadDir(dir) {
  const files = [];
  for (const set of Object.keys(JOBS)) for (const mode of MODES) {
    const f = path.join(dir, `${set}_${mode}.json`);
    if (existsSync(f)) files.push({ ...JSON.parse(readFileSync(f, 'utf8')), set, mode });
  }
  return files;
}

function report(dir) {
  const files = loadDir(dir);
  const by = (set, mode) => files.find((x) => x.set === set && x.mode === mode);
  const lines = [];
  const P = (s) => lines.push(s);
  // 1. 묶음마다 30 넘는 분석 · 버려진 맞음 (base)
  P(`## 1. 30 m/s 넘는 분석 · 버려진 맞음 (base — 지금 규칙)`);
  P(`| 묶음 | 판 | 맞음(판정에 듦) | 30 넘는 분석 (predict · pass · bounce · instant) | 버려진 맞음 | 판당 | ${BINS.map(binName).join(' | ')} | 진짜(smooth) · 튐(spike) · 순간이동 · 모름 | 판정 길 밖 분석(순간 베기 · 연환 · 격살) 수 · 빠르기 중앙 · 최대 |`);
  P(`|---|---|---|---|---|---|${BINS.map(() => '---').join('|')}|---|---|`);
  const allHits = [];
  for (const set of Object.keys(JOBS)) {
    const B = by(set, 'base');
    if (!B) continue;
    const ev = B.events;
    const hits = dropHits(ev).map((h) => ({ ...h, set }));
    allHits.push(...hits);
    const nF = B.combats.length;
    const c = (k) => ev.filter((e) => e.ctx === k).length;
    const lab = (k) => hits.filter((h) => label(h) === k).length;
    P(`| ${set}${B.f12sha ? ` (sha ${B.f12sha})` : ''} | ${nF} | ${B.woundCount} | ${ev.length} (${c('predict')} · ${c('pass')} · ${c('bounce')} · ${c('instant')}) | ${hits.length} | ${fx(hits.length / nF, 2)} | ${BINS.map(([a, b]) => hits.filter((h) => h.speed > a && h.speed <= b).length).join(' | ')} | ${lab('smooth')} · ${lab('spike')} · ${lab('teleport')} · ${lab('unknown') + lab('instant')} | ${(B.instant ?? []).length} · ${fx(med((B.instant ?? []).map((x) => x.speed)))} · ${fx(Math.max(-Infinity, ...(B.instant ?? []).map((x) => x.speed)))} |`);
  }
  if (allHits.length) {
    P(`\n### 버려진 맞음 ${allHits.length} 번 — 빠르기 칸별 (모든 묶음)`);
    P(`| 빠르기 | 수 | 칼 몫 · 몸 몫 m/s (중앙) | 칼 점 빠르기 m/s (중앙) | 몸 점 빠르기 (중앙) | 판정 에너지 J (중앙 · 최대) | 상처 날 것(심각도 > 0) | 심각도 (중앙 · 최대) | 판정 꼴 |`);
    P(`|---|---|---|---|---|---|---|---|---|`);
    for (const bin of BINS) {
      const [a, b] = bin;
      const hs = allHits.filter((h) => h.speed > a && h.speed <= b);
      const sev = hs.filter((h) => h.r.sev > 0).map((h) => h.r.sev);
      P(`| ${binName(bin)} | ${hs.length} | ${fx(med(hs.map((h) => h.shareB)))} · ${fx(med(hs.map((h) => h.shareV)))} | ${fx(med(hs.map((h) => h.vB)))} | ${fx(med(hs.map((h) => h.vV)))} | ${fx(med(hs.map((h) => h.r.energy)), 0)} · ${fx(Math.max(0, ...hs.map((h) => h.r.energy)), 0)} | ${sev.length} | ${fx(med(sev), 2)} · ${fx(Math.max(0, ...sev), 2)} | ${cnt(hs, (h) => h.r.type).map(([k, n]) => `${k} ${n}`).join(' · ')} |`);
    }
    P(`\n무기별(친 쪽 — 묶음): ${cnt(allHits, (h) => `${h.weapon}(${h.set})`).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    P(`맞은 부위: ${cnt(allHits, (h) => h.part).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    P(`칼 부품: ${cnt(allHits, (h) => h.wpart + (h.seg != null ? '·마디' + h.seg : '')).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    P(`친 쪽: ${cnt(allHits, (h) => (h.player ? '사람' : 'AI') + '·' + h.attState + (h.secret ? '·비기' : '')).map(([k, n]) => `${k} ${n}`).join(' · ')} · 맞은 쪽 상태: ${cnt(allHits, (h) => h.vicState).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    P(`판정 길: ${cnt(allHits, (h) => h.ctx).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    // 2. 하나하나 (빠른 순)
    P(`\n### 버려진 맞음 하나하나 (빠른 순 40 — 상대 빠르기 n−3 → n(분석) → n+2)`);
    P(`| 묶음 · 판 | 초 | 칼 → 부위 | 빠르기 | 칼 몫 · 몸 몫 | 상대 빠르기 내력 | 빨라짐 칼 · 몸 m/s² (벡터 바뀜) | 순간 이동 칼 · 몸 m/s | 깊이 mm | 상한 없으면 | 가름 |`);
    P(`|---|---|---|---|---|---|---|---|---|---|---|`);
    for (const h of [...allHits].sort((a, b) => b.speed - a.speed).slice(0, 40)) {
      const p = h.hist?.past ?? [];
      P(`| ${h.set} · ${h.label ?? h.combat} | ${h.t} | ${h.weapon}${h.seg != null ? '·' + h.seg : ''} → ${h.part} | ${fx(h.speed)} | ${fx(h.shareB)} · ${fx(h.shareV)} | ${[...p].reverse().map((x) => fx(x.rel)).join(' → ')}${(h.next ?? []).length ? ' → ' + h.next.map((x) => fx(x.rel)).join(' → ') : ''} | ${fx(p[0]?.jumpB, 0)} · ${fx(p[0]?.jumpV, 0)} (${fx(p[0]?.accB, 0)} · ${fx(p[0]?.accV, 0)}) | ${fx(p[0]?.telB, 2)} · ${fx(p[0]?.telV, 2)} | ${h.depth ?? '–'} | ${h.r.type} ${fx(h.r.energy, 0)} J · ${fx(h.r.sev, 2)} | ${label(h)} |`);
    }
  }
  // 거르기 수: 정상 맞음 쪽 분포
  const W = files.filter((x) => x.mode === 'base').flatMap((x) => x.wounds.filter((w) => w.hist?.past?.[0]?.accB != null && w.speed > 20 && w.speed <= 30));
  const H = allHits.filter((h) => h.hist?.past?.[0]?.accB != null);
  const acc = (xs) => xs.map((w) => Math.max(w.hist.past[0].jumpB, w.hist.past[0].jumpV));
  const vac = (xs) => xs.map((w) => Math.max(w.hist.past[0].accB, w.hist.past[0].accV));
  const tel = (xs) => xs.map((w) => Math.max(w.hist.past[0].telB, w.hist.past[0].telV));
  const prevK = (xs) => xs.map((w) => (w.hist.past[1] ? w.hist.past[1].rel / w.hist.past[0].rel : NaN));
  P(`\n### 가르기 수 견줌 — 맞은 점 한 스텝 빨라짐 max(칼, 몸) · 벡터 바뀜 · 순간 이동 max (중앙 · p90 · p99) · 앞 스텝 상대 빠르기 ÷ 지금 (중앙 · p10)`);
  P(`| 묶음 | 수 | 빨라짐 m/s² | 벡터 바뀜 m/s² | 순간 이동 m/s | 앞 스텝 ÷ 지금 | 거르기(d)에 걸림 |`);
  P(`|---|---|---|---|---|---|---|`);
  for (const [name, xs] of [['판정에 들어간 20–30 m/s 맞음 (base 모든 묶음)', W], ['버려진 맞음 (30 넘음)', H]]) {
    P(`| ${name} | ${xs.length} | ${fx(qtl(acc(xs), 0.5), 0)} · ${fx(qtl(acc(xs), 0.9), 0)} · ${fx(qtl(acc(xs), 0.99), 0)} | ${fx(qtl(vac(xs), 0.5), 0)} · ${fx(qtl(vac(xs), 0.9), 0)} · ${fx(qtl(vac(xs), 0.99), 0)} | ${fx(qtl(tel(xs), 0.5), 2)} · ${fx(qtl(tel(xs), 0.9), 2)} · ${fx(qtl(tel(xs), 0.99), 2)} | ${fx(qtl(prevK(xs), 0.5), 2)} · ${fx(qtl(prevK(xs), 0.1), 2)} | ${pct(xs.filter((w) => w.spikeCausal).length, xs.length)} |`);
  }
  const JT = files.filter((x) => x.mode === 'none' || (x.mode === 'base' && !files.some((y) => y.set === x.set && y.mode === 'none'))).flatMap((x) => x.jt ?? []);
  if (JT.length) {
    P(`\n판정에 들어간 모든 맞음 ${JT.length} 개(none — 30 넘는 분석이 없는 묶음은 base 와 같은 판)의 한 스텝 빨라짐 중앙 · p99 · 최대 ${fx(qtl(JT.map((x) => x[1]), 0.5), 0)} · ${fx(qtl(JT.map((x) => x[1]), 0.99), 0)} · ${fx(Math.max(...JT.map((x) => x[1])), 0)} m/s² · 순간 이동 ${fx(qtl(JT.map((x) => x[2]), 0.5), 2)} · ${fx(qtl(JT.map((x) => x[2]), 0.99), 2)} · ${fx(Math.max(...JT.map((x) => x[2])), 2)} m/s · 거르기 수를 넘는 것 ${JT.filter((x) => x[1] > FILTER.jump || x[2] > FILTER.tel).length} 개 (그 빠르기 ${JT.filter((x) => x[1] > FILTER.jump || x[2] > FILTER.tel).map((x) => fx(x[0])).join(' · ') || '–'} m/s)`);
  }
  // 3. 방식 견줌
  P(`\n## 3. 방식별 판 (같은 시드 · 같은 차례)`);
  P(`| 묶음 | 방식 | sha(f12 시드 1–12) | 끝 바뀐 판 | 죽음 | 넘어짐/판 | 준 심각도/판 | 끝난 때 평균 s | 이김 앞 · 뒤 · 무 | 30 넘어 판정에 든 맞음/판 | 30 넘는 분석/판 | 버린 맞음/판 |`);
  P(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  const trans = [];
  for (const set of Object.keys(JOBS)) {
    const B = by(set, 'base');
    if (!B) continue;
    for (const mode of MODES) {
      const M = by(set, mode);
      if (!M) continue;
      const F = M.combats;
      const changed = F.filter((f) => { const b = B.combats[f.id]; return !b || b.end !== f.end || b.tDead !== f.tDead || Math.abs(b.sev[0] + b.sev[1] - f.sev[0] - f.sev[1]) > 1e-6; }).length;
      const drops = dropHits(M.events.filter((e) => e.drop));
      const flip = F.filter((f) => B.combats[f.id] && B.combats[f.id].winner !== f.winner);
      trans.push(`${set} ${mode}: 이긴 쪽 바뀐 판 ${flip.length} (${['앞 → 뒤', '앞 → 무', '뒤 → 앞', '뒤 → 무', '무 → 앞', '무 → 뒤'].map((k, i) => { const [a, b] = [[0, 1], [0, -1], [1, 0], [1, -1], [-1, 0], [-1, 1]][i]; const n = flip.filter((f) => B.combats[f.id].winner === a && f.winner === b).length; return n ? `${k} ${n}` : null; }).filter(Boolean).join(' · ') || '–'}) · 끝 바뀐 판의 끝난 때 차 평균 ${fx(mean(F.filter((f) => B.combats[f.id] && B.combats[f.id].tEnd !== f.tEnd).map((f) => f.tEnd - B.combats[f.id].tEnd)), 1)} s`);
      P(`| ${set} | ${mode} | ${M.f12sha ?? '–'} | ${changed}/${F.length} | ${F.filter((f) => f.end.includes('dead')).length} | ${fx(mean(F.map((f) => f.downs)), 2)} | ${fx(mean(F.map((f) => f.sev[0] + f.sev[1])), 2)} | ${fx(mean(F.map((f) => f.tEnd)), 1)} | ${F.filter((f) => f.winner === 0).length} · ${F.filter((f) => f.winner === 1).length} · ${F.filter((f) => f.winner === -1).length} | ${fx(mean(F.map((f) => f.fast)), 2)} | ${fx(mean(F.map((f) => f.over)), 2)} | ${fx(drops.length / F.length, 2)} |`);
    }
  }
  P(`\n같은 시드 짝 (base 와 견줌):`);
  for (const t of trans) P(`- ${t}`);
  // 상한을 풀었을 때 판정에 들어간 30 넘는 맞음
  for (const mode of ['none', '45', '60', 'filter']) {
    const fast = files.filter((x) => x.mode === mode).flatMap((x) => x.wounds.filter((w) => w.speed > 30).map((w) => ({ ...w, set: x.set })));
    if (!fast.length) continue;
    P(`\n${mode}: 판정에 들어간 30 넘는 맞음 ${fast.length} 번 — ${BINS.map((bn) => `${binName(bn)} ${fast.filter((w) => w.speed > bn[0] && w.speed <= bn[1]).length}`).join(' · ')} · 최고 ${fx(Math.max(...fast.map((w) => w.speed)))} m/s · 판정 에너지 중앙 ${fx(med(fast.map((w) => w.energy)), 0)} · 최대 ${fx(Math.max(...fast.map((w) => w.energy)), 0)} J · 심각도 최대 ${fx(Math.max(...fast.map((w) => w.sev)), 2)}`);
    P(`  꼴: ${cnt(fast, (w) => w.type).map(([k, n]) => `${k} ${n}`).join(' · ')} · 무기: ${cnt(fast, (w) => `${w.weapon}(${w.set})`).map(([k, n]) => `${k} ${n}`).join(' · ')} · 부위: ${cnt(fast, (w) => w.part).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  }
  return lines.join('\n');
}

// ── 명령 ──
if (CMD === 'run') {
  const set = arg('set', 'f12');
  const mode = String(arg('mode', 'base'));
  const seeds = range(arg('seeds', set === 'f12' ? '1-12' : '1'));
  const res = await runSet(set, mode, seeds, +arg('dur', 30));
  const json = arg('json', null);
  if (json) writeFileSync(json, JSON.stringify(res));
  const F = res.combats;
  console.log(`${set} ${mode}: 판 ${F.length} · 죽음 ${F.filter((f) => f.end.includes('dead')).length} · 맞음 ${res.woundCount} · 30 넘는 분석 ${res.events.length} · 버림 ${res.events.filter((e) => e.drop).length} · 버린 맞음 ${dropHits(res.events.filter((e) => e.drop)).length}${res.f12sha ? ` · fights12 sha ${res.f12sha}` : ''}`);
} else if (CMD === 'wrap') {
  const mode = String(arg('mode', 'base'));
  const { L } = await install(mode);
  const [script, ...sargs] = rest;
  if (!script) throw new Error('wrap 다음에 시뮬 스크립트 이름');
  const { simPath } = await import('./is_main.mjs');
  process.argv = [process.argv[0], simPath(script), ...sargs];
  const json = arg('json', null);
  process.on('exit', () => {
    const D = L.dump();
    if (json) writeFileSync(json, JSON.stringify({ set: script, ...D }));
    const ev = D.events;
    const hits = dropHits(ev);
    process.stderr.write(`[speed_cap_probe ${mode}] 판 ${D.combats.length} · 맞음 ${D.woundCount} · 30 넘는 분석 ${ev.length} (predict ${ev.filter((e) => e.ctx === 'predict').length} · pass ${ev.filter((e) => e.ctx === 'pass').length} · bounce ${ev.filter((e) => e.ctx === 'bounce').length} · instant ${ev.filter((e) => e.ctx === 'instant').length}) · 버린 것 ${ev.filter((e) => e.drop).length} · 버려진 맞음(묶음) ${hits.length} — ${BINS.map((b) => `${binName(b)} ${hits.filter((h) => h.speed > b[0] && h.speed <= b[1]).length}`).join(' · ')} · 최고 ${Math.max(0, ...ev.map((e) => e.speed)).toFixed(1)} m/s\n`);
    for (const h of hits.slice(0, 12)) process.stderr.write(`  ${h.t}s ${h.weapon}${h.seg != null ? '·' + h.seg : ''} → ${h.part} ${h.speed} m/s (칼 ${h.shareB} · 몸 ${h.shareV}) ${h.ctx} → 상한 없으면 ${h.r.type} ${h.r.energy} J 심각도 ${h.r.sev} · ${label(h)}\n`);
  });
  await import(new URL('./' + script, import.meta.url));
} else if (CMD === 'all') {
  const dir = path.resolve(ROOT, arg('dir', 'dist/speed_cap_probe'));
  mkdirSync(dir, { recursive: true });
  const modes = String(arg('modes', MODES.join(','))).split(',');
  const only = arg('only', null) ? String(arg('only')).split(',') : Object.keys(JOBS);
  const jobs = [];
  for (const mode of modes) for (const set of only) {
    const J = JOBS[set];
    if (J.modes && !J.modes.includes(mode)) continue;
    const json = path.join(dir, `${set}_${mode}.json`);
    const a = J.run ? ['run', ...J.run, `--mode=${mode}`, `--json=${json}`] : ['wrap', `--mode=${mode}`, `--json=${json}`, ...J.wrap];
    jobs.push({ set, mode, a, env: { ...process.env, ...(J.env ?? {}) } });
  }
  const N = +arg('jobs', 4);
  let next = 0;
  await new Promise((done) => {
    let live = 0;
    const kick = () => {
      if (next >= jobs.length && !live) return done();
      while (live < N && next < jobs.length) {
        const j = jobs[next++];
        live++;
        const t0 = Date.now();
        const p = spawn(process.execPath, [fileURLToPath(import.meta.url), ...j.a], { stdio: ['ignore', 'pipe', 'pipe'], env: j.env });
        let err = '', out = '';
        p.stdout.on('data', (d) => { if (j.a[0] === 'run') out += d; });
        p.stderr.on('data', (d) => (err += d));
        p.on('exit', (code) => {
          live--;
          const say = [...out.split('\n'), ...err.split('\n')].filter((l) => l.startsWith('[speed_cap_probe') || l.startsWith(j.set + ' ') || (code !== 0 && l.trim())).slice(0, 3).join(' | ');
          process.stderr.write(`${j.set} ${j.mode}: ${code === 0 ? '끝' : '실패 ' + code} ${((Date.now() - t0) / 1000).toFixed(0)} s ${say}\n`);
          kick();
        });
      }
    };
    kick();
  });
  console.log(report(dir));
} else if (CMD === 'report') {
  console.log(report(path.resolve(ROOT, arg('dir', 'dist/speed_cap_probe'))));
} else {
  console.log('첫 인자: run | wrap | all | report (머리말 참고)');
}
