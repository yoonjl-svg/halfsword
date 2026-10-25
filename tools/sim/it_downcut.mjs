// ─────────────────────────────────────────────────────────────
//  it_downcut.mjs — 사람 내려 긋기 재기 (10/25 19:0x 사장님 '이탈리아 내려 긋기의 문제를 살펴보고 수정해' — docs/strike/wrist_audit_2026-10-24.md §15)
//   재기만 한다(물리 · 판정 · AI 그대로). 판 견줌은 --set=JOINTS.cutPronate=0 (10/25 전 판) · --set=JOINTS.swivelHuman=0,JOINTS.wristPronate=0 (10/24 팔) 처럼.
//
//   script [무기…] : 간격 생성기 대본(weapon_measure.mjs measureSwing — 분노의 베기 · 오른 어깨 지붕 0.5 s 붙잡고 0.35 s 긋기 · 상대 치움)을 스텝마다 —
//        맞닿음(--down 과 같은 셈 · 같은 실행 롱소드 raw 로 1.62 보정) · 칼날 70 % 가장 높이 · 손목 · 팔 잣대(긋기 0 ~ 0.5 s) · --trace 면 스텝 기록
//   swipe [무기…] : 봇 손놀림 획(tools/sim 표준 — flex_reach · whip_duel 과 같은 꼴: 손가락을 대고 시작 자리로 1.6 패드 m/s 감기 · 4 프레임 멈춤 · --v 패드 m/s 로 긋기 · 뗌 · 상대 치움)
//        — 70 % 지점 가장 높이 · 그때 앞 · 칼끝이 몸 높이로 간 가장 먼 앞 · 70 % 지점이 머리 높이(1.45 ~ 1.75 m)를 내려 지난 가장 먼 앞 · 교정 최대 · 손목 범위 밖 · 거꾸로 ·
//        팔꿈치 줄 위 · 30° 넘게 위 · 위팔 돌림 밖 · 굴림 ≥ 78 · 날 맞춤(칼날 70 % 빠르기 4 m/s 넘는 스텝 가운데 날이 움직임과 |cos| > STRIKE.edgeAlign) · 칼날 70 % 가장 빠름
//        (잣대는 onehand_arm.mjs 와 같음 — 범위 밖 = dev [−31, 136] 밖 · 아래팔이 칼 면에서 70° 안 · 거꾸로 = dev < −45 · fe 45° 안)
//   board [무기…]  : 서 있는 상대(이졸데 몸 · 롱소드 · AI 끔 · 칼 아래) 앞 가슴 사이 --d(기본 1.1 ~ 1.7 m 7 자리) × --v(기본 4.5 · 6)에서 같은 봇 획 하나 —
//        긋기를 시작한 뒤 몸에 처음 닿은 판정(부위 · 날 베기 / 둔) · 그 획의 상처 심각도 합. 줄 = 무기 · 기술마다 닿은 획 / 획 · 날 베기 · 심각도 합
//   drill [무기…]  : 그 무기 AI 가 제 베기 기술을 그 자리에서(헛스윙 연습 자리 · 상대 4.5 m · 걸음 없음 · --n 번) — 긋기 시간 · 70 % 지점이 머리 높이를 내려 지난 가장 먼 앞 · 가장 높이 · 교정 최대
//  node tools/sim/it_downcut.mjs <script|swipe|board|drill> [--set=G.k=v,…] [--tech=zornhau,oberhau,zornhauL] [--v=4.5,6] [--d=…] [--n=4] [--trace] [무기…]
// ─────────────────────────────────────────────────────────────
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { wristSample } from './wrist_audit.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
const FRAME = 2 * DT; // 봇 손가락 프레임 (flex_reach · whip_duel 과 같음)
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const elev = (v) => (v ? Math.atan2(v.y, Math.hypot(v.x, v.z)) * R2D : NaN);
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);

/** 한 스텝 칼 · 손목 표본 (fw = 앞 거리 함수) */
function sample(f, fw) {
  const a = f.bladePoint(0.7, new THREE.Vector3()), b = f.bladePoint(1, new THREE.Vector3());
  const qs = Qr(f.sword.rotation());
  const bl = new THREE.Vector3(0, 1, 0).applyQuaternion(qs), xS = new THREE.Vector3(1, 0, 0).applyQuaternion(qs);
  const hv = f.hitPointVel;
  const vp = new THREE.Vector3(hv.x, hv.y, hv.z);
  vp.addScaledVector(bl, -vp.dot(bl));
  const v = vp.length();
  return { p70: [fw(a), a.y], tip: [fw(b), b.y], el: [elev(f.aimRawW), elev(f.aimDirW), elev(bl)], fix: f.wristFixDeg || 0, swivel: (f.swivelTh || 0) * R2D, plane: f.wristPlaneOk ? 1 : 0, v, edge: v > 1e-3 ? Math.abs(vp.dot(xS)) / v : null, s: wristSample(f) };
}

/** 획 묶음 (rows = sample 들) */
function tally(rows) {
  const M = { n: 0, oor: 0, rev: 0, up0: 0, up30: 0, upMax: -90, rotN: 0, rotOut: 0, roll78: 0, fixMax: 0, top: -Infinity, topF: 0, tipBody: -Infinity, headFall: -Infinity, eN: 0, eOk: 0, vMax: 0 };
  let prevY = null;
  for (const r of rows) {
    const falling = prevY == null || r.p70[1] < prevY;
    prevY = r.p70[1];
    if (r.p70[1] > M.top) { M.top = r.p70[1]; M.topF = r.p70[0]; }
    if (r.tip[1] >= 0.9 && r.tip[1] <= 1.75) M.tipBody = Math.max(M.tipBody, r.tip[0]);
    if (falling && r.p70[1] > 1.45 && r.p70[1] < 1.75) M.headFall = Math.max(M.headFall, r.p70[0]);
    M.fixMax = Math.max(M.fixMax, Math.abs(r.fix));
    M.vMax = Math.max(M.vMax, r.v);
    if (r.v > 4 && r.edge != null) { M.eN++; if (r.edge > CONFIG.STRIKE.edgeAlign) M.eOk++; }
    const s = r.s;
    if (!s) continue;
    M.n++;
    if (Math.abs(s.fe) <= 70 && (s.dev < -31 || s.dev > 136)) M.oor++;
    if (s.dev < -45 && Math.abs(s.fe) < 45) M.rev++;
    if (s.elbowUp > 0) M.up0++;
    if (s.elbowUp > 30) M.up30++;
    M.upMax = Math.max(M.upMax, s.elbowUp);
    if (s.roll >= 78) M.roll78++;
    if (s.shRot != null) { M.rotN++; if (s.shRot < -70 || s.shRot > 90) M.rotOut++; }
  }
  const pc = (x, n = M.n) => (n ? +((100 * x) / n).toFixed(0) : 0);
  return { ...M, oorPc: pc(M.oor), revPc: pc(M.rev), up0Pc: pc(M.up0), up30Pc: pc(M.up30), rotOutPc: pc(M.rotOut, M.rotN), roll78Pc: pc(M.roll78), edgePc: pc(M.eOk, M.eN) };
}

/** 대본 한 판 (weapon_measure.mjs measureSwing down 과 같은 길 · 같은 셈) */
export function scriptRun(weapon) {
  const T = TECH_BY_NAME.zornhau;
  const G = newRound({ weapon, weapon2: weapon, seed: 1 });
  G.park();
  const f = G.player;
  const path = [T.from, ...T.path];
  let phase = 'chamber', t = 0, c0 = null, fw0 = null, prevY = null, maxF = -Infinity, atT = 0;
  const rows = [];
  for (let i = 0; i < 3 / DT; i++) {
    t += DT;
    if (phase === 'chamber') {
      f.handOffset.set(T.from[0], T.from[1]);
      if (t > 0.5) {
        phase = 'swing';
        t = 0;
        const c = f.bodies.chest.translation(), fw = f.forward();
        c0 = { x: c.x, z: c.z };
        fw0 = { x: fw.x, z: fw.z };
      }
    } else {
      const u = Math.min(1, t / 0.35);
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      f.handOffset.set(...lerp(...seg));
    }
    f.move.set(0, 0);
    G.step();
    if (phase !== 'swing') continue;
    const fw = (p) => (p.x - c0.x) * fw0.x + (p.z - c0.z) * fw0.z;
    const p70 = f.bladePoint(0.7, new THREE.Vector3());
    const falling = prevY == null || p70.y < prevY;
    prevY = p70.y;
    if (p70.y > 1.45 && p70.y < 1.75 && falling && fw(p70) > maxF) { maxF = fw(p70); atT = t; }
    if (t <= 0.5) rows.push({ t, ...sample(f, fw) });
  }
  G.world.free();
  return { raw: maxF, cutTime: atT, rows };
}

/** 봇 손가락 획 하나 — 감기(1.6 패드 m/s) · 4 프레임 멈춤 · 긋기(v) · 뗌. 긋기 첫 프레임에 onStart() · 그 뒤 스텝마다 표본 (뗀 뒤 0.3 s 까지) */
function botStroke(G, tech, v, { foeLow = false, onStart = null } = {}) {
  const P = G.player;
  const T = TECH_BY_NAME[tech];
  let fx = P.handOffset.x, fy = P.handOffset.y;
  const to = (p, sp) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, sp * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, 0]); } fx = x; fy = y; return fr; };
  const q = to(T.from, 1.6);
  for (let i = 0; i < 4; i++) q.push([0, 0, 0]);
  for (const p of T.path) q.push(...to(p, v).map((f) => [f[0], f[1], 1]));
  let step = 0, t = 0, cur = null, end = null;
  const rows = [];
  for (let i = 0; i < 6 / DT; i++) {
    if ((step++ & 1) === 0) {
      const f = q.shift();
      if (f) {
        if (f[2] === 1 && !cur) {
          const c = P.bodies.chest.translation(), fw = P.forward();
          cur = { c: { x: c.x, z: c.z }, f: { x: fw.x, z: fw.z }, t0: t };
          onStart?.();
        }
        P.handOffset.x += f[0];
        P.handOffset.y += f[1];
        P.handHeld = true;
        P.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5;
        if (!q.length) end = t;
      } else {
        P.handHeld = false;
        P.inputActive = false;
      }
    }
    P.move.set(0, 0);
    if (foeLow) G.enemy.handOffset.set(0, -0.5);
    G.step();
    t += DT;
    if (!cur) continue;
    if (end != null && t > end + 0.3) break;
    rows.push({ t: t - cur.t0, ...sample(P, (p) => (p.x - cur.c.x) * cur.f.x + (p.z - cur.c.z) * cur.f.z) });
  }
  return { dur: end != null && cur ? end - cur.t0 : NaN, rows };
}

const playerHand = (P) => {
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
};

/** swipe — 상대 치움 · 1 s 쉼 뒤 획 하나 */
export function swipeRun(wid, tech, v) {
  const G = newRound({ weapon: wid, weapon2: wid, seed: 3 });
  G.park();
  playerHand(G.player);
  for (let t = 0; t < 1.0; t += DT) G.step();
  const r = botStroke(G, tech, v);
  G.world.free();
  return { dur: r.dur, rows: r.rows, ...tally(r.rows) };
}

/** board — 서 있는 상대 앞 가슴 사이 gap 에서 획 하나: 긋기 시작 뒤 처음 몸에 닿은 판정 · 상처 심각도 합 */
export function boardRun(wid, tech, v, gap) {
  const G = newRound({ weapon: wid, weapon2: 'longsword', seed: 1, gap });
  G.ai.update = () => G.enemy.move.set(0, 0);
  G.player.foe = G.enemy;
  G.enemy.foe = G.player;
  const P = G.player;
  playerHand(P);
  for (let t = 0; t < 1.0; t += DT) {
    G.enemy.handOffset.set(0, -0.5);
    G.step();
  }
  let first = null, on = false, sev = 0;
  const C = G.combat, orig = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (r && on && !first && pr.w.fighter === P && pr.v?.fighter === G.enemy) first = { part: pr.v.part, type: r.type, sev: r.severity, e: r.energy, speed: r.speed };
    return r;
  };
  const pw = C.hooks.onWound;
  C.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (on && att === P && r.severity > 0) sev += r.severity;
  };
  botStroke(G, tech, v, { foeLow: true, onStart: () => (on = true) });
  G.world.free();
  return { first, sev };
}

/** drill — AI 가 제 기술을 그 자리에서 (헛스윙 연습 자리 · 걸음 없음) */
export function drillRun(wid, tn, N = 4, gap = 4.5) {
  const G = newRound({ weapon: 'longsword', weapon2: wid, seed: 7, gap });
  applyWeaponMeasure(G.ai, wid);
  const ai = G.ai, E = G.enemy;
  const tech = ai.school.techByName?.[tn];
  if (!tech) {
    G.world.free();
    return null;
  }
  ai.drill = { out: () => true, dist: () => gap, due: () => false, fired() {}, feet: () => 0, atkFeet: () => 0 };
  const res = [];
  let cur = null, t = 0, fired = 0, wait = 1.0, prevY = null;
  while ((fired < N || cur) && t < 60) {
    if (!cur && ai.mode !== 'attack' && (wait -= DT) <= 0 && ai.startAttack(tech, 'drill', { noFeint: true, noPending: true, drill: true })) {
      fired++;
      cur = { on: false, headFall: -Infinity, top: -Infinity, topF: 0, fix: 0, dur: 0 };
    }
    G.step();
    t += DT;
    if (!cur) continue;
    if (!cur.on && ai.phase === 'strike') {
      const c = E.bodies.chest.translation(), f = E.forward();
      cur.c = { x: c.x, z: c.z };
      cur.f = { x: f.x, z: f.z };
      cur.on = true;
      cur.t0 = t;
      prevY = null;
    }
    if (!cur.on) continue;
    const fw = (v) => (v.x - cur.c.x) * cur.f.x + (v.z - cur.c.z) * cur.f.z;
    const p = E.bladePoint(0.7, new THREE.Vector3());
    const falling = prevY == null || p.y < prevY;
    prevY = p.y;
    if (p.y > cur.top) { cur.top = p.y; cur.topF = fw(p); }
    if (p.y > 1.45 && p.y < 1.75 && falling) cur.headFall = Math.max(cur.headFall, fw(p));
    cur.fix = Math.max(cur.fix, Math.abs(E.wristFixDeg || 0));
    if (ai.phase === 'strike') cur.dur = t - cur.t0;
    if (ai.mode !== 'attack' || t - cur.t0 > 1.2) {
      res.push(cur);
      cur = null;
      wait = 0.8;
    }
  }
  G.world.free();
  return { dur: med(res.map((r) => r.dur)), headFall: med(res.map((r) => r.headFall)), top: med(res.map((r) => r.top)), topF: med(res.map((r) => r.topF)), fix: med(res.map((r) => r.fix)), each: res.map((r) => r.headFall) };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args[0] && !args[0].startsWith('--') ? args.shift() : 'script';
  const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  for (const kv of opt('set', '').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    const [g, key] = k.split('.');
    CONFIG[g][key] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  }
  CONFIG.ARENA.startHold = 0; // 간격 생성기 실행과 같은 시작 정지 0
  const ids = args.filter((a) => !a.startsWith('--'));
  const techs = opt('tech', 'zornhau,oberhau,zornhauL').split(',');
  const speeds = opt('v', '4.5,6').split(',').map(Number);
  const set = opt('set', '') || '기본';
  const trace = args.includes('--trace');
  if (mode === 'script') {
    const weapons = ids.length ? ids : ['rapier', 'dartagnan', 'balisarda', 'pappenheimer', 'sabre', 'falchion', 'qinggang', 'hwando'];
    const K = 1.62 / scriptRun('longsword').raw;
    console.log(`대본 분노의 베기 (생성기 길) · ${set} — 롱소드 1.62 보정 ${K.toFixed(4)}`);
    console.log('| 무기 | 맞닿음 · 때 s | 70 % 가장 높이 m @ 앞 m | 70 % 머리 높이 내려 지남 앞 m | 교정 최대 ° | 손목 범위 밖 · 거꾸로 % | 팔꿈치 줄 위 · 30° 넘게 % | 위팔 돌림 밖 % | 굴림 ≥ 78 % | 날 맞춤 % · 가장 빠름 m/s |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const w of weapons) {
      const r = scriptRun(w);
      const M = tally(r.rows);
      console.log(`| ${w} | ${f2(r.raw * K)} · ${f2(r.cutTime)} | ${f2(M.top)} @ ${f2(M.topF)} | ${f2(M.headFall)} | ${M.fixMax.toFixed(0)} | ${M.oorPc} · ${M.revPc} | ${M.up0Pc} · ${M.up30Pc} | ${M.rotOutPc} | ${M.roll78Pc} | ${M.edgePc} · ${M.vMax.toFixed(1)} |`);
      if (trace) for (const x of r.rows.filter((_, i) => i % 3 === 0)) console.log(`  ${x.t.toFixed(3)} | 70 % ${f2(x.p70[0])},${f2(x.p70[1])} | 칼끝 ${f2(x.tip[0])},${f2(x.tip[1])} | 높이각 명령 ${x.el[0].toFixed(0)} · 교정 뒤 ${x.el[1].toFixed(0)} · 칼 ${x.el[2].toFixed(0)} | 돌림 ${x.swivel.toFixed(0)} · 교정 ${x.fix.toFixed(0)} · 엎친 손 ${x.plane} | dev ${x.s?.dev.toFixed(0)} · fe ${x.s?.fe.toFixed(0)} · 굴림 ${x.s?.roll.toFixed(0)} · 팔꿈치 위 ${x.s?.elbowUp.toFixed(0)}`);
    }
  } else if (mode === 'swipe') {
    const weapons = ids.length ? ids : ['sabre', 'falchion', 'rapier', 'pappenheimer', 'qinggang', 'hwando'];
    console.log(`봇 획 (상대 치움 · 감기 1.6 · 긋기 ${speeds.join(' · ')} 패드 m/s) · ${set}`);
    console.log('| 무기 · 기술 · 빠르기 | 획 s | 70 % 가장 높이 m @ 앞 m | 칼끝 몸 높이 가장 앞 m | 70 % 머리 높이 내려 지남 앞 m | 교정 최대 ° | 손목 범위 밖 · 거꾸로 % | 팔꿈치 줄 위 · 30° 넘게 % | 위팔 돌림 밖 % | 굴림 ≥ 78 % | 날 맞춤 % · 70 % 가장 빠름 m/s |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const w of weapons) for (const tn of techs) for (const v of speeds) {
      const M = swipeRun(w, tn, v);
      console.log(`| ${w} ${tn} ${v} | ${f2(M.dur)} | ${f2(M.top)} @ ${f2(M.topF)} | ${f2(M.tipBody)} | ${f2(M.headFall)} | ${M.fixMax.toFixed(0)} | ${M.oorPc} · ${M.revPc} | ${M.up0Pc} · ${M.up30Pc} | ${M.rotOutPc} | ${M.roll78Pc} | ${M.edgePc} · ${M.vMax.toFixed(1)} |`);
      if (trace) for (const x of M.rows.filter((_, i) => i % 2 === 0)) console.log(`  ${x.t.toFixed(3)} | 70 % ${f2(x.p70[0])},${f2(x.p70[1])} | 높이각 ${x.el.map((e) => e.toFixed(0)).join(' · ')} | 돌림 ${x.swivel.toFixed(0)} · 교정 ${x.fix.toFixed(0)} · 엎친 손 ${x.plane} | dev ${x.s?.dev.toFixed(0)} · fe ${x.s?.fe.toFixed(0)} · 팔꿈치 위 ${x.s?.elbowUp.toFixed(0)} | 날 ${f2(x.edge)} · ${x.v.toFixed(1)}`);
    }
  } else if (mode === 'board') {
    const weapons = ids.length ? ids : ['sabre', 'falchion', 'rapier', 'pappenheimer', 'qinggang', 'hwando'];
    const gaps = opt('d', '1.1,1.2,1.3,1.4,1.5,1.6,1.7').split(',').map(Number);
    console.log(`서 있는 상대 판 (롱소드 · 칼 아래 · AI 끔 · 가슴 사이 ${gaps.join(' · ')} m × 긋기 ${speeds.join(' · ')} 패드 m/s) · ${set}`);
    console.log('| 무기 · 기술 | 몸에 닿은 획 / 획 | 날 베기 | 상처 심각도 합 | 처음 닿은 부위 |');
    console.log('|---|---|---|---|---|');
    for (const w of weapons) for (const tn of techs) {
      let n = 0, h = 0, c = 0, s = 0;
      const parts = {};
      for (const d of gaps) for (const v of speeds) {
        const r = boardRun(w, tn, v, d);
        n++;
        s += r.sev;
        if (r.first) {
          h++;
          if (r.first.type === 'cut') c++;
          parts[r.first.part] = (parts[r.first.part] ?? 0) + 1;
        }
      }
      console.log(`| ${w} ${tn} | ${h} / ${n} | ${c} | ${s.toFixed(2)} | ${Object.entries(parts).map(([k, x]) => `${k} ${x}`).join(' · ') || '-'} |`);
    }
  } else if (mode === 'drill') {
    const weapons = ids.length ? ids : ['rapier', 'pappenheimer', 'sabre', 'falchion'];
    const N = +opt('n', 4);
    console.log(`AI 기술 그 자리에서 (상대 4.5 m · ${N} 번) · ${set}`);
    console.log('| 무기 · 기술 | 긋기 s | 70 % 머리 높이 내려 지남 앞 m (가운데 · 번마다) | 70 % 가장 높이 m @ 앞 m | 교정 최대 ° |');
    console.log('|---|---|---|---|---|');
    for (const w of weapons) for (const tn of techs) {
      const r = drillRun(w, tn, N);
      if (!r) {
        console.log(`| ${w} ${tn} | 꾸러미에 없음 | | | |`);
        continue;
      }
      console.log(`| ${w} ${tn} | ${f2(r.dur)} | ${f2(r.headFall)} (${r.each.map(f2).join(' ')}) | ${f2(r.top)} @ ${f2(r.topF)} | ${r.fix.toFixed(0)} |`);
    }
  } else {
    console.error('mode: script | swipe | board | drill');
    process.exit(1);
  }
}
