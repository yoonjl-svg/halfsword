// r29 tsub: '제비 베기 견줌 판' 한 판을 돌리며 다리 값을 바꿔 보는 재기 도구 (src · 시험 · 도구는 안 고침 — 이 대본이 값 칸 사본의 모듈을 불러 LEGS 를 런타임에 바꿈)
//  쓰는 법: (cd <칸> && nice -n 15 node <이 파일> --root=. [옵션] --out=<결과 jsonl(덧붙임)>)
//   --seed=1 --dur=14            판 (시험과 같은 값: immortal · ghostDown)
//   --ecc=E --lm=M               LEGS.ecc = E · LEGS.limit 칸마다 × M (불러온 값 기준) · 안 주면 칸 값 그대로
//   --t0=T                       값 바꿈을 G.t >= T 인 스텝부터 (T 전에는 불러온 값)
//   --side=clamp|gait            ×M 을 다리 토크 자르기(LegDrive.legTorques 안)에서만 / 그 밖(걸음 장치 · kneeBendMax · hipReach · footContact)에서만 읽히게 (ecc 는 늘 자르기 몫)
//   --hold=kneeExt,kneeFlex,...  이 칸은 ×M 을 안 함 (바탕 값 유지)
//   --dz=cm --dx=cm              첫 스텝 뒤 사람 몸 전체를 상대 쪽(앞) · 옆으로 옮김 (시작 거리 흔들기)
//   --nudge=mm                   첫 스텝 뒤 사람 골반만 위로 mm (자세 흔들기)
//   --mv=0.46                    걷기 명령 0.45 를 이 값으로 (같은 판 대본의 G.before 를 감쌈)
//   --dump=<jsonl> --from=9.5    from 부터 넘어질 때(+0.3 s) 또는 판 끝까지 스텝마다 다리 · 걸음 · 기술 상태
//   --tag=<이름>                 결과 줄 이름
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { appendFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const CFG = await import(u('src/config.js'));
const LV = await import(u('src/legs_vmc.js'));
const { tsubameRun, tsubameSummary } = await import(u('tools/sim/schielhau_strike.mjs'));
const { classify } = await import(u('tools/sim/fall_mech.mjs'));
const { LEGS, AID, BODY, BALANCE } = CFG;
const legLimit = LV.legLimit ?? ((b, s) => b * s); // 바탕(본판 src)에는 legLimit 이 없다 — 그때 한도 = 칸 × 근력
const seed = +(args.seed ?? 1), dur = +(args.dur ?? 14);

// ── 값 바꿈 ──
const BASE = { ...LEGS.limit }, ECC0 = LEGS.ecc;
const E = args.ecc != null ? +args.ecc : null, M = args.lm != null ? +args.lm : null;
const hold = new Set(String(args.hold ?? '').split(',').filter(Boolean));
const side = args.side ?? 'all';
const t0 = args.t0 != null ? +args.t0 : -1;
let on = false, inClamp = 0;
const scaled = Object.fromEntries(Object.keys(BASE).map((k) => [k, M != null && !hold.has(k) ? BASE[k] * M : BASE[k]]));
if (side !== 'all') {
  LEGS.limit = new Proxy(BASE, { get: (o, k) => { if (!on || !(k in scaled)) return o[k]; const c = inClamp > 0; return (side === 'clamp') === c ? scaled[k] : o[k]; } });
  const pT = LV.LegDrive.prototype.legTorques;
  LV.LegDrive.prototype.legTorques = function (...a) { inClamp++; try { return pT.apply(this, a); } finally { inClamp--; } };
}
const apply = () => {
  on = true;
  if (E != null) LEGS.ecc = E;
  if (side === 'all') for (const k of Object.keys(BASE)) LEGS.limit[k] = scaled[k];
};
if (t0 <= 0) apply();

// ── 걷기 명령 · 시작 흔들기 ──
const mv = args.mv != null ? +args.mv : null;
const dz = +(args.dz ?? 0) / 100, dx = +(args.dx ?? 0) / 100, nudge = +(args.nudge ?? 0) / 1000;
let first = true;
const shiftFighter = (P, ox, oy, oz, only) => {
  const bs = only ? [P.bodies[only]] : [...Object.values(P.bodies), ...(P.sword ? [P.sword] : [])];
  for (const b of bs) { const t = b.translation(); b.setTranslation({ x: t.x + ox, y: t.y + oy, z: t.z + oz }, true); }
};

// ── 기록 ──
const DUMP = args.dump ? String(args.dump) : null, FROM = +(args.from ?? 9.5);
if (DUMP) writeFileSync(DUMP, '');
const r3 = (x) => (x == null || !isFinite(x) ? x : +x.toFixed(3));
const JL = [['hx', 'hipAbd', 'hipAbd', 'wH', 'x'], ['hy', 'hipRot', 'hipRot', 'wH', 'y'], ['hz', 'hipFlex', 'hipFlex', 'wH', 'z'], ['k', 'kneeExt', 'kneeFlex', 'wK', null], ['ax', 'ankleInv', 'ankleInv', 'wA', 'x'], ['ay', 'ankleRot', 'ankleRot', 'wA', 'y'], ['az', 'ankleDorsi', 'anklePlantar', 'wA', 'z']];
const legRow = (P, k) => {
  const D = P.legDrive, L = D.legs[k], g = P.gait?.legs?.[k], str = D.strengthOf(k), lim = LEGS.limit;
  inClamp++; // 자르기가 읽는 한도로 셈 (side=clamp 에서도 맞게)
  const o = { on: L.on ? 1 : 0, st: g?.stance ? 1 : 0, str: r3(str) };
  for (const [n, lo, hi, wn, ax] of JL) {
    const raw = L.raw?.[n] ?? 0, w = ax ? L[wn][ax] : L[wn];
    const cap = raw >= 0 ? legLimit(lim[hi], str, w) : legLimit(lim[lo], str, -w);
    o[n] = [r3(raw), r3(cap), Math.abs(raw) > cap ? 1 : 0, r3(raw >= 0 ? w : -w)]; // [자르기 앞 토크, 걸린 한도, 잘림, 거스르는 빠르기 wEcc]
  }
  inClamp--;
  const len = L.ph.distanceTo(L.pa), c = Math.max(-1, Math.min(1, (L.lenT ** 2 + L.lenS ** 2 - len * len) / (2 * L.lenT * L.lenS)));
  o.phi = r3((Math.PI - Math.acos(c)) * 180 / Math.PI); o.wK = r3(L.wK);
  // 발 자리를 몸 틀(상대 쪽 앞 a · 오른쪽 r · 골반 기준 m)로: 디딘 발 = plant · 뜬 발 = 디딜 자리 p1
  const fr = (q) => { const pp = P.bodies.pelvis.translation(), e = P.__fw; const x = q.x - pp.x, z = q.z - pp.z; return [r3(x * e[0] + z * e[1]), r3(-x * e[1] + z * e[0])]; };
  if (g?.stance && g.plant) o.at = fr(g.plant);
  if (g && !g.stance && g.p1) o.at = fr(g.p1);
  if (g && !g.stance) { o.kind = g.kind ?? null; o.u = r3((g.t ?? 0) / Math.max(1e-3, g.T ?? 1)); o.T = r3(g.T); if (g.p1) o.p1 = [r3(g.p1.x), r3(g.p1.z)]; }
  return o;
};
const ring = [];
let myB, foeB, myC, firstTouch = null;
let prevSt = 'stand', lowFor = 0, why = null, fall = null, firstNon = null, firstCombo = null, firstContact = null, minD = 9, maxStep = 0, lastClash = 0, ended = false, stepN = 0;
const hash = { n: 0, h: 0 };
const res = tsubameRun(seed, { immortal: true, dur, ghostDown: true, onStep: (G, P, cur) => {
  stepN++;
  if (first) {
    first = false;
    const nm = (f) => { const m = new Map(); for (const [k, b] of Object.entries(f.bodies)) m.set(b.handle, k); if (f.sword) m.set(f.sword.handle, 'sword'); return m; };
    myB = nm(P); foeB = nm(G.enemy);
    myC = [...Object.values(P.bodies).map((b) => b.collider(0))]; if (P.sword) for (let k = 0; k < P.sword.numColliders(); k++) myC.push(P.sword.collider(k));
    if (dz || dx) { const v = P.bodies.pelvis.translation(), q = G.enemy.bodies.pelvis.translation(); const ax = q.x - v.x, az = q.z - v.z, l = Math.hypot(ax, az); shiftFighter(P, (ax / l) * dz - (az / l) * dx, 0, (az / l) * dz + (ax / l) * dx); }
    if (nudge) shiftFighter(P, 0, nudge, 0, 'pelvis');
    if (mv != null) { const ob = G.before; G.before = () => { ob(); if (Math.abs(P.move.y - 0.45) < 1e-9) { P.move.set(0, mv); P.stickY = mv; } }; }
    const oK = P.knockDown;
    P.knockDown = function (heavy) { if (this.state === 'stand') { const tilt = this.tiltDeg() - (this.hunch || 0) * 180 / Math.PI; why = tilt > BODY.fallTiltDeg ? 'tilt' : this.balance <= 0 ? 'balance0' : this.offBalanceTime > BALANCE.fallDelay ? 'footing' : this.sitTime > (BALANCE.sitDelay ?? 9) ? 'sit' : this.legsCannotSupport ? 'legs' : 'other'; } return oK.call(this, heavy); };
  }
  if (!on && t0 > 0 && G.t >= t0 - 1e-9) apply(); // 이 스텝 다음부터 새 값
  const t = G.t, st = P.state, p = P.bodies.pelvis.translation(), v = P.bodies.pelvis.linvel();
  const dist = P.foeDistance();
  hash.n++; hash.h = (hash.h * 31 + Math.round(p.y * 1e6) + Math.round(p.x * 1e6)) % 1000000007;
  if (st === 'stand' && !fall) minD = Math.min(minD, dist);
  if (cur && firstCombo == null) firstCombo = t;
  if (G.clashes > lastClash && firstContact == null) firstContact = { t, by: 'clash' };
  lastClash = G.clashes;
  if (firstContact == null && G.wounds.length) firstContact = { t, by: 'wound' };
  // 엔진 접촉: 내 몸 · 칼 토막 ↔ 상대 몸 · 칼 토막 (칼 부딪힘 문턱 밑 닿음도)
  const touch = {};
  for (const c of myC) G.world.contactPairsWith(c, (o) => {
    const fp = foeB.get(o.parent()?.handle); if (!fp) return;
    G.world.contactPair(c, o, (m) => { const n = m.numContacts(); if (!n) return; let J = 0; for (let j = 0; j < n; j++) J += m.contactImpulse(j); const key = `${myB.get(c.parent()?.handle)}>${fp}`; touch[key] = (touch[key] ?? 0) + J; });
  });
  const tk = Object.keys(touch);
  if (tk.length && firstTouch == null) firstTouch = { t: r3(t), pairs: tk.join(',') };
  if (st !== 'stand' && firstNon == null) firstNon = { t, st };
  // fall_cost 와 같은 고리 줄
  const D = P.legDrive, g = P.gait;
  if (!fall) {
    lowFor = p.y < 0.5 ? lowFor + 1 / 120 : 0;
    const lim = LEGS.limit, mk = (k) => { const L = D.legs[k], r = L.raw, str = D.strengthOf(k); return { on: L.on ? 1 : 0, kr: -r.k / Math.max(1e-6, lim.kneeExt * str), hs: Math.abs(r.hx) > lim.hipAbd * str || Math.abs(r.hy) > lim.hipRot * str || Math.abs(r.hz) > lim.hipFlex * str ? 1 : 0, as: r.az > lim.anklePlantar * str || r.az < -lim.ankleDorsi * str || Math.abs(r.ax) > lim.ankleInv * str ? 1 : 0 }; };
    ring.push({ t, st, y: p.y, tilt: P.tiltDeg(), cap: D?.capDist ?? 0, off: P.offBalance ?? 0, F: g?.legs?.F?.stance ? null : g?.legs?.F?.kind ?? null, B: g?.legs?.B?.stance ? null : g?.legs?.B?.kind ?? null, kF: mk('F'), kB: mk('B'), h: g?.h ?? 0, aidT: D ? Math.min(1, Math.hypot(D.rem.x, D.rem.z) / AID.tiltMax) : 0, stroke: P.skill?.swinging ? 'cut' : 'idle', sinceStand: st === 'stand' ? P.stateTime : 0 });
    if (ring.length > 360) ring.shift();
    const fallNow = (prevSt === 'stand' && (st === 'down' || st === 'getup')) || (st === 'stand' && lowFor > 0.25);
    if (fallNow) {
      const R = ring.slice(0, -1).filter((x) => x.st === 'stand'), N = R.length;
      let o = N; while (o > 0 && (R[o - 1].off > 0 || R[o - 1].tilt > 30)) o--;
      if (o >= N) o = Math.max(0, N - 1);
      const rec = { onsetBefore: +((N - o) / 120).toFixed(2), afterGetup: false, sinceStand: R[N - 1]?.sinceStand ?? 9, why: why ?? (st === 'stand' ? 'low' : 'other') };
      const rg = ring.filter((_, k) => k % 2 === (ring.length - 1) % 2);
      fall = { t: r3(t), st, why: rec.why, onsetBefore: rec.onsetBefore, onsetT: r3(t - rec.onsetBefore), ...classify(rec, rg) };
    }
  }
  prevSt = st;
  if (DUMP && t >= FROM && !ended) {
    if (fall && t > fall.t + 0.3) ended = true;
    else {
      const sk = P.skill ?? {}, uq = sk.uniq;
      { const q = G.enemy.bodies.pelvis.translation(), l = Math.hypot(q.x - p.x, q.z - p.z) || 1; P.__fw = [(q.x - p.x) / l, (q.z - p.z) / l]; }
      const vf = v.x * P.__fw[0] + v.z * P.__fw[1], vr = -v.x * P.__fw[1] + v.z * P.__fw[0];
      const com = P.com, cv = P.comVel, w0 = D?.w0 || 3.3;
      const xcap = com && cv ? [r3((com.x + cv.x / w0 - p.x) * P.__fw[0] + (com.z + cv.z / w0 - p.z) * P.__fw[1]), r3(-(com.x + cv.x / w0 - p.x) * P.__fw[1] + (com.z + cv.z / w0 - p.z) * P.__fw[0])] : null;
      const row = { s: Math.round(t * 120), t: r3(t), st, py: r3(p.y), vy: r3(v.y), vh: r3(Math.hypot(v.x, v.z)), vf: r3(vf), vr: r3(vr), xcap, dist: r3(dist), mv: [r3(P.move.x), r3(P.move.y)],
        g: g ? { h: r3(g.h), hNom: r3(g.hNom), hv: r3(g.hv), walking: !!g.walking, req: g.req ? g.req.kind : null, cap: r3(D.capDist) } : null,
        sk: { swing: !!sk.swinging, uniq: uq ? (uq.r?.e?.name ?? (uq.running ? 'run' : null)) : null, cur: cur ? r3(cur.t0) : null, stam: r3(P.stamina?.value), hand: [r3(P.handOffset.x), r3(P.handOffset.y)], held: !!P.handHeld },
        touch: tk.length ? Object.fromEntries(tk.map((k) => [k, r3(touch[k])])) : null, tilt: r3(P.tiltDeg()), off: r3(P.offBalance ?? 0), F: legRow(P, 'F'), B: legRow(P, 'B') };
      appendFileSync(DUMP, JSON.stringify(row) + '\n');
    }
  }
} });
const sum = tsubameSummary([res]);
const pass = sum.combos >= 2 && sum.firedCombos >= 1 && sum.downContacts === 0;
const contactT = firstContact?.t ?? null;
const out = { tag: args.tag ?? null, root: ROOT.split('/').pop(), seed, ecc: E ?? ECC0, lm: M ?? 1, t0: t0 > 0 ? t0 : null, side, hold: [...hold], dz: dz * 100, dx: dx * 100, nudge: nudge * 1000, mv,
  pass, combos: sum.combos, fired: sum.firedCombos, down: sum.downContacts, falls: res.falls, firstNon: firstNon ? { t: r3(firstNon.t), st: firstNon.st } : null,
  firstCombo: r3(firstCombo), firstTouch, firstContact: contactT != null ? { t: r3(contactT), by: firstContact.by } : null, minD: r3(minD),
  preFall: !!(fall && (contactT == null || fall.t < contactT) && (firstCombo == null || fall.t < firstCombo)), fall, hash: hash.h, steps: hash.n };
if (args.out) appendFileSync(String(args.out), JSON.stringify(out) + '\n');
console.log(`${out.tag ?? ''} ${out.root} e${out.ecc} m${out.lm} t0 ${out.t0} ${side} pass ${pass} combos ${sum.combos} fall ${fall ? fall.t + ' ' + fall.cause : '-'} combo1 ${out.firstCombo} touch ${firstTouch ? firstTouch.t + ' ' + firstTouch.pairs : '-'} minD ${out.minD} hash ${hash.h}`);
