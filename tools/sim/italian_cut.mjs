// ─────────────────────────────────────────────────────────────
//  italian_cut.mjs — 사람 이탈리아 베기 가설 재기 (10/25 20:4x 사장님 '이탈리아 내려 긋기 대부분 둔타 — 무기 스펙 때문일 수도 · 다각도로 가설' ·
//   '수평 베기가 거의 불가능 — 상대 머리 위 허공으로 높게' — docs/strike/italian_cut_2026-10-25.md). 재기만 한다(물리 · 판정 · AI 그대로).
//   적은 획으로 가설을 가린다(사장님 '횟수를 너무 많이 잡지 말고'): 서 있는 상대(이졸데 몸 · 롱소드 · AI 끔 · 칼 아래) 앞 가슴 사이 --d(기본 1.3 · 1.5) 에서
//   봇 손놀림 획 하나(tools/sim 표준 — 손가락을 대고 시작 자리로 1.6 패드 m/s 감기 · 4 프레임 멈춤 · --v(기본 4.5) 패드 m/s 로 긋기 · 뗌) — 기술 --tech(기본 zwerch · zornhau · zornhauL).
//   획마다: 처음 몸에 닿은 판정 — 부위 · 꼴(날 베기 cut · 찌름 stab · 둔 blunt) · 둔이면 왜(칼 면 = 날이 움직임과 안 맞음 · 힘 모자람 = 날은 맞았는데 문턱 아래 · 손잡이) ·
//     날 맞춤 |cos|(STRIKE.edgeAlign 와 견줌) · 칼 축 쪽 움직임 · 칼날 자리(0 손잡이 쪽 ~ 1 칼끝) · 빠르기 · 실효 / 문턱 · 상처 심각도 합
//   긋는 동안(첫 긋기 프레임 ~ 뗀 뒤 0.3 s): 칼날 70 % 가장 높이 · 그때 앞 · 칼날 70 % 가장 빠름 · 상대 줄을 지날 때(옆 0) 높이 · 겨눔 높이각 최대(교정 전 · 뒤) · 칼 높이각 최대 ·
//     겨눔 ↔ 칼 어긋남 가운데값 · 손목 교정 최대 · 획 읽힘(stamina stroke.kind · 고유 동작 이름)
//  판 바꾸기(한 번에 하나): --set=G.k=v,… (config) · --table=<무기 id | none>(사람 자세표만 그 무기 것으로 · none = 유파 자세표 없이 무기 틀 표) ·
//   --spec=k=v,…(사람 무기 칸 — mCut · edged …) · --passive=0(유파 패시브 끔) · --trace(획마다 프레임 줄)
//   --foeHand=x,y(상대 손 패드 — 기본 0,-0.5 칼 아래) · --walk(3 m 에서 걸어 들어가 --d 에서 멈춤 · 0.8 s 쉼 — 브라우저 그림과 같은 꼴)
//  node tools/sim/italian_cut.mjs [--w=rapier] [--tech=zwerch,zornhau,zornhauL] [--d=1.3,1.5] [--v=4.5] [--set=…] [--table=…] [--spec=…] [--passive=0] [--trace]
// ─────────────────────────────────────────────────────────────
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { strokeTechOf } from '../../src/unique_assist.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const has = (k) => args.includes(`--${k}`);
const R2D = 180 / Math.PI;
const FRAME = 2 * DT;
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '-');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const elev = (v) => (v ? Math.atan2(v.y, Math.hypot(v.x, v.z)) * R2D : NaN);
const num = (v) => (v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v);

for (const kv of opt('set', '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('=');
  const p = k.split('.');
  const o = p.slice(0, -1).reduce((a, x) => a[x], CONFIG);
  o[p[p.length - 1]] = num(v);
}
const W = opt('w', 'rapier');
const TECHS = opt('tech', 'zwerch,zornhau,zornhauL').split(',');
const DS = opt('d', '1.3,1.5').split(',').map(Number);
const V = +opt('v', 4.5);
const TABLE = opt('table', '');
const SPEC = opt('spec', '').split(',').filter(Boolean).map((kv) => kv.split('='));
const PASSIVE = opt('passive', '1') !== '0';
const TRACE = has('trace');
const FOEH = opt('foeHand', '0,-0.5').split(',').map(Number); // 상대 손 패드 자리 (기본 칼 아래)
const WALK = has('walk'); // 3 m 에서 스틱 앞으로 걸어 들어가 --d 에서 멈추고 0.8 s 쉰 뒤 (브라우저 그림 it_downcut_shots.mjs 와 같은 꼴) · 없으면 --d 에 서서 1 s
CONFIG.ARENA.startHold = 0;

/** 사람 자세표를 다른 무기 것으로 (none = 유파 자세표 없이 무기 틀 표) */
async function tableOf(id) {
  if (!id) return null;
  if (id === 'none') {
    const { SCHOOL_ART } = await import('../../src/schools.js');
    const keep = SCHOOL_ART.table;
    SCHOOL_ART.table = false;
    const G = newRound({ weapon: W, weapon2: 'longsword', seed: 1 });
    const t = G.player.guardPose.table;
    G.world.free();
    SCHOOL_ART.table = keep;
    return t;
  }
  const G = newRound({ weapon: id, weapon2: 'longsword', seed: 1 });
  const t = G.player.guardPose.table;
  G.world.free();
  return t;
}
const swapTable = await tableOf(TABLE);

function stroke(tech, gap) {
  const G = newRound({ weapon: W, weapon2: 'longsword', seed: 1, gap: WALK ? 3 : gap });
  const P = G.player, E = G.enemy;
  if (swapTable) P.guardPose.table = P.bodyGuard.table = swapTable;
  for (const [k, v] of SPEC) P.weaponCfg[k] = num(v);
  if (!PASSIVE) P.schoolPassive = null;
  G.ai.update = () => E.move.set(0, 0);
  P.foe = E;
  E.foe = P;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  if (WALK) for (let t = 0; t < 8 && P.foeDistance() > gap; t += DT) { P.move.set(0, 1); E.handOffset.set(...FOEH); G.step(); } // 걸어 들어감 (브라우저 그림과 같은 꼴)
  P.move.set(0, 0);
  for (let t = 0; t < (WALK ? 0.8 : 1.0); t += DT) { E.handOffset.set(...FOEH); G.step(); }
  // 판정 엿보기
  let on = false, first = null, sev = 0;
  const C = G.combat, orig = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (r && on && !first && pr.w.fighter === P && pr.v?.fighter === E) {
      const q = P.sword.rotation();
      const Q = new THREE.Quaternion(q.x, q.y, q.z, q.w);
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(Q), edge = new THREE.Vector3(1, 0, 0).applyQuaternion(Q);
      const d = r.dir.clone();
      const along = d.dot(axis);
      const perp = d.clone().addScaledVector(axis, -along);
      const ea = perp.length() > 1e-3 ? Math.abs(perp.dot(edge)) / perp.length() : 0;
      const why = r.type !== 'blunt' ? '' : pr.w.part !== 'blade' ? '손잡이' : r.thr != null ? '힘' : '면';
      first = { part: pr.v.part, type: r.type, why, ea, along, t: r.t, speed: r.speed, eff: r.eff, thr: r.thr, sev: r.severity };
    }
    return r;
  };
  const pw = C.hooks.onWound;
  C.hooks.onWound = (att, vic, r, ...rest) => { pw?.(att, vic, r, ...rest); if (on && att === P && r.severity > 0) sev += r.severity; };
  // 봇 획
  const T = TECH_BY_NAME[tech];
  let fx = P.handOffset.x, fy = P.handOffset.y;
  const to = (p, sp) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, dd = Math.hypot(dx, dy); if (dd < 1e-6) break; const st = Math.min(dd, sp * FRAME); x += (dx / dd) * st; y += (dy / dd) * st; fr.push([(dx / dd) * st, (dy / dd) * st, 0]); } fx = x; fy = y; return fr; };
  const q = to(T.from, 1.6);
  for (let i = 0; i < 4; i++) q.push([0, 0, 0]);
  for (const p of T.path) q.push(...to(p, V).map((f) => [f[0], f[1], 1]));
  let step = 0, t = 0, t0 = null, end = null, prevLat = null;
  const rows = [];
  const kinds = new Set();
  for (let i = 0; i < 6 / DT; i++) {
    if ((step++ & 1) === 0) {
      const f = q.shift();
      if (f) {
        if (f[2] === 1 && t0 == null) { t0 = t; on = true; }
        P.handOffset.x += f[0];
        P.handOffset.y += f[1];
        P.handHeld = true;
        P.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5;
        if (!q.length) end = t;
      } else { P.handHeld = false; P.inputActive = false; }
    }
    P.move.set(0, 0);
    E.handOffset.set(...FOEH);
    G.step();
    t += DT;
    if (t0 == null) continue;
    if (end != null && t > end + 0.3) break;
    const c = P.bodies.chest.translation(), ec = E.bodies.chest.translation();
    const L = Math.hypot(ec.x - c.x, ec.z - c.z), ux = (ec.x - c.x) / L, uz = (ec.z - c.z) / L;
    const a = P.bladePoint(0.7, new THREE.Vector3());
    const fw = (a.x - c.x) * ux + (a.z - c.z) * uz, lat = -(a.x - c.x) * uz + (a.z - c.z) * ux;
    const q2 = P.sword.rotation();
    const bl = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q2.x, q2.y, q2.z, q2.w));
    const aim = P.aimDirW;
    const err = aim && aim.lengthSq() > 0 ? Math.acos(Math.max(-1, Math.min(1, bl.dot(aim) / aim.length()))) * R2D : NaN;
    const cross = prevLat != null && Math.sign(lat) !== Math.sign(prevLat) && fw > 0.3;
    prevLat = lat;
    const kind = P.stamina?.stroke?.kind;
    if (kind) kinds.add(kind);
    const un = strokeTechOf(P);
    if (un) kinds.add(un);
    const hv = P.hitPointVel;
    rows.push({ t: t - t0, v: Math.hypot(hv.x, hv.y, hv.z), fw, lat, y: a.y, elRaw: elev(P.aimRawW), elAim: elev(aim), elB: elev(bl), err, fix: Math.abs(P.wristFixDeg || 0), cross, hand: [P.handOffset.x, P.handOffset.y] });
  }
  G.world.free();
  const top = rows.reduce((m, r) => (r.y > m.y ? r : m), { y: -Infinity });
  const crosses = rows.filter((r) => r.cross).map((r) => r.y);
  return {
    first, sev, rows, kinds: [...kinds].join('/') || '-',
    top: top.y, topF: top.fw, crossY: crosses.length ? crosses[0] : NaN,
    elRaw: Math.max(...rows.map((r) => r.elRaw)), elAim: Math.max(...rows.map((r) => r.elAim)), elB: Math.max(...rows.map((r) => r.elB)),
    errMed: med(rows.filter((r) => r.t <= 0.35).map((r) => r.err)), vMax: Math.max(...rows.map((r) => r.v)), fixMax: Math.max(...rows.map((r) => r.fix)),
  };
}

console.log(`# ${W}${WALK ? ' 걸어 들어감' : ''} table=${TABLE || '그대로'} set=${opt('set', '') || '-'} spec=${opt('spec', '') || '-'} passive=${PASSIVE ? 1 : 0} v=${V} mCut=${(await import('../../src/weapons.js')).getWeapon?.(W)?.mCut ?? '?'}`);
for (const tech of TECHS) {
  const out = [];
  let hits = 0, cuts = 0, sevSum = 0;
  for (const d of DS) {
    const r = stroke(tech, d);
    const F = r.first;
    if (F) hits++;
    if (F?.type === 'cut') cuts++;
    sevSum += r.sev;
    out.push(`  d ${d} | ${F ? `${F.part} ${F.type}${F.why ? `(${F.why})` : ''} 날맞춤 ${f2(F.ea)} 축 ${f2(F.along)} 자리 ${f2(F.t)} ${f2(F.speed)} m/s 실효/문턱 ${f0(F.eff)}/${f0(F.thr)}` : '안 닿음'} · 심각도 ${f2(r.sev)} | 70% 꼭대기 ${f2(r.top)} m @앞 ${f2(r.topF)} · 칼날 70 % 가장 빠름 ${f2(r.vMax)} m/s · 줄 지날 때 ${f2(r.crossY)} · 높이각 겨눔 ${f0(r.elRaw)}→${f0(r.elAim)} 칼 ${f0(r.elB)} · 어긋남 ${f0(r.errMed)}° · 교정 ${f0(r.fixMax)}° · 읽힘 ${r.kinds}`);
    if (TRACE) for (const w of r.rows.filter((_, i) => i % 6 === 0)) out.push(`      t ${f2(w.t)} 손 ${f2(w.hand[0])},${f2(w.hand[1])} 70% 앞 ${f2(w.fw)} 옆 ${f2(w.lat)} 높이 ${f2(w.y)} · 겨눔 ${f0(w.elRaw)}→${f0(w.elAim)} 칼 ${f0(w.elB)} 어긋남 ${f0(w.err)} 교정 ${f0(w.fix)}`);
  }
  console.log(`${tech}: 닿음 ${hits}/${DS.length} · 날 베기 ${cuts} · 심각도 ${sevSum.toFixed(2)}`);
  console.log(out.join('\n'));
}
