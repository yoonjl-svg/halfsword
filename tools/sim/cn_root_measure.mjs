// ─────────────────────────────────────────────────────────────
//  cn_root_measure.mjs — 동방 AI 는 왜 긴 칼을 못 막나 (11/15 사장님 '그럼 동방 보법 패치 아무 의미가 없네 지금. 근본적으로 싸우는 방식에 문제 있는 거 아냐?
//   공격에서 뚫리는 일 잘 없다며. 근데 긴 칼의 공격은 왜 못막아? 모순인데?' · 기록 docs/strike/cn_root_2026-11-15.md) — 재기만 (판은 바꾸지 않음)
//  받는 쪽 AI(숙련 5)가 입은 칼날 상처 하나마다: 그 상처를 낸 상대 공격(상대 AI startAttack 하나)에서 받는 쪽이 칼을 봤나(ai.threat) · 봤으면 respond 가 무엇을 골랐나 ·
//   맞은 때 받는 쪽 꼴 · 거리(가슴 사이 — 참 거리) · 내 칼끝 거리(M.reach) · 상대 칼끝 어림(foeReach) · 상대가 휘두르기 시작(startStrike)부터 맞기까지 · 반응 시간.
//  까닭 칸 (위에서부터 먼저):
//   c  치는 중(공격 꼴 strike · follow — respond 가 불리지 않는 꼴)에 맞음
//   d  막기를 골랐는데 맞음 (칼로 받기 parry · 물러나 피하기 void)
//   b  봤지만 다른 것을 고름 (맞받아 베기 · 파고들기 받으며 들어감 · 偏閃奏進 · 패시브 · 공격 중 알아채기 굴림 실패 · 무모 · 붙음)
//   a  못 봄 (위협으로 안 잡힘 — 칼이 닿기 전에 늦게 본 눈에 안 들어옴 · 알아챔 굴림 guardChance 실패)
//   g  그 밖 (3 s 안에 시작한 상대 공격이 없음)
//  꼴 칸: 간 보기 · 다가감(공격 준비 · 다가감) · 치는 중 · 물러남 · 막기 · 비기 · 그 밖 / 칼끝 틈 = 내 칼끝 밖 · 상대 칼끝 안에서 맞음
//  node tools/sim/cn_root_measure.mjs [--weapons=hwando,qinggang] [--foes=zweihander,longsword,rapier,uchigatana] [--vars=0,on] [--seeds=1-6] [--json=..]
//  node tools/sim/cn_root_measure.mjs agg a.json …
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const K = CONFIG.TIME.k;
const KO = { eastern: '동방 (환도 · 청강검)', hwando: '환도', qinggang: '청강검', longsword: '롱소드', rapier: '레이피어', zweihander: '츠바이핸더', uchigatana: '우치가타나' };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

/** 판 v: '0' = 편섬 꺼짐(개발 가지 머리 판) · 'on' = 꺾음 + 偏閃奏進 (이 가지 기본) */
function withVar(v, fn) {
  const keep = CONFIG.CN_STEP.mode;
  CONFIG.CN_STEP.mode = v === 'on' ? 'turn' : 0;
  try { return fn(); } finally { CONFIG.CN_STEP.mode = keep; }
}
const hdist = (a, b) => { const p = a.bodies.chest?.translation() ?? a.bodies.pelvis.translation(); const q = b.bodies.chest?.translation() ?? b.bodies.pelvis.translation(); return Math.hypot(p.x - q.x, p.z - q.z); };
const stateOf = (ai) => ai.mode === 'attack' ? (ai.phase === 'strike' || ai.phase === 'follow' || ai.phase === 'rdStrike' ? 'strike' : 'approach') : ai.mode === 'watch' ? 'watch' : ai.mode === 'withdraw' ? 'withdraw' : ai.mode === 'defend' ? 'defend' : ai.mode === 'secret' ? 'secret' : 'other';

// ── 근본 고침 안 재 보기 (재기 꽂개 — src 는 안 바꿈 · 받는 쪽 AI 하나에만 · --fix=gap,dig0,arc) ──
const NEW_T = CONFIG.realS(0.25); // ai.js NEW_THREAT_T 와 같은 수
const OPEN_WHY = new Set(['recover', 'finish', 'counter', 'riposte', 'dive', 'follow', 'stepin', 'stop']);
/** gap — 상대 칼이 0.3 m(걸음 사다리 첫 칸) 넘게 길면 내 칼끝 밖에서 여는 보통 공격(간 보다 · 밀어붙임 · 비스듬히 …)을 띠 기울기만큼 안 냄 — 상대가 헛치거나 · 들어오거나 · 받아 친 틈(recover · stepin · counter …)만 건넘 */
function fixGap(ai, st) {
  const sa = ai.startAttack;
  ai.startAttack = function (t, why, o = {}) {
    if (!o.chain && !o.secret && !o.passive && !OPEN_WHY.has(why) && this.foeReach - this.M.reach >= 0.3 && this.d > this.M.reach + 0.05 && Math.random() < (this.planK ?? 1)) return void st.gapSkip++, false;
    return sa.call(this, t, why, o);
  };
}
/** arc — 위협 읽기에 둥근 칼(츠바이핸더 둥근 베기 등) 내다보기를 덧댐: 늦게 본 칼끝 · 타격점 빠르기로 칼의 순간 회전(축 · 중심)을 셈해 0.6 s 까지 돌려 봄 — 곧은 줄 0.45 s 가 못 잡을 때만 */
function fixArc(ai, st) {
  const th0 = ai.threat;
  ai.threat = function (s, c, r, d) {
    const hit0 = th0.call(this, s, c, r, d);
    if (hit0 || d > this.foeReach + 0.9) return hit0;
    const T = [s.tx, s.ty, s.tz], M = [s.mx, s.my, s.mz], vT = [s.tvx, s.tvy, s.tvz], vM = [s.mvx, s.mvy, s.mvz];
    if (Math.hypot(...vT) < 3.5) return null;
    const e = [T[0] - M[0], T[1] - M[1], T[2] - M[2]], dv = [vT[0] - vM[0], vT[1] - vM[1], vT[2] - vM[2]];
    const e2 = e[0] * e[0] + e[1] * e[1] + e[2] * e[2] || 1;
    const w = [(e[1] * dv[2] - e[2] * dv[1]) / e2, (e[2] * dv[0] - e[0] * dv[2]) / e2, (e[0] * dv[1] - e[1] * dv[0]) / e2]; // ω = e × Δv / |e|²
    const wn = Math.hypot(...w);
    if (wn < 1) return null;
    const ax = w.map((x) => x / wn);
    const ctr = [M[0] + (w[1] * vM[2] - w[2] * vM[1]) / (wn * wn), M[1] + (w[2] * vM[0] - w[0] * vM[2]) / (wn * wn), M[2] + (w[0] * vM[1] - w[1] * vM[0]) / (wn * wn)]; // 순간 중심 c = m + ω × v / |ω|²
    const drift = vM[0] * ax[0] + vM[1] * ax[1] + vM[2] * ax[2];
    const rot = (p, a) => { const q = [p[0] - ctr[0], p[1] - ctr[1], p[2] - ctr[2]]; const cs = Math.cos(a), sn = Math.sin(a), dt = q[0] * ax[0] + q[1] * ax[1] + q[2] * ax[2]; const cx = [ax[1] * q[2] - ax[2] * q[1], ax[2] * q[0] - ax[0] * q[2], ax[0] * q[1] - ax[1] * q[0]]; return [0, 1, 2].map((i) => ctr[i] + q[i] * cs + cx[i] * sn + ax[i] * dt * (1 - cs)); };
    for (let k = 1; k <= 12; k++) {
      const t = 0.05 * k, a = wn * t;
      for (const P of [T, M]) {
        const q = rot(P, a);
        const hx = q[0] + ax[0] * drift * t - c.x, hy = q[1] + ax[1] * drift * t - c.y, hz = q[2] + ax[2] * drift * t - c.z;
        if (Math.hypot(hx, hz) > 0.55 || hy < -1.3 || hy > 0.75) continue;
        if (this.noThreat > NEW_T) this.threatId++;
        st.arcSeen++;
        const lat = hx * r.x + hz * r.z;
        const line = hy > -0.1 ? (lat > 0.12 ? 'highR' : lat < -0.12 ? 'highL' : 'highC') : lat >= 0 ? 'lowR' : 'lowL';
        return { id: this.threatId, line, thrust: false };
      }
    }
    return null;
  };
}

/** 한 판 — 받는 쪽(weapon) AI 가 입은 칼날 상처마다 까닭 */
export function rootFight({ weapon, foe, seed, prof = 5, dur = 30, fix = [] }) {
  const subjE = seed % 2 === 1;
  const G = newRound({ seed, walls: true, weapon: subjE ? foe : weapon, weapon2: subjE ? weapon : foe, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const me = subjE ? G.enemy : G.player;
  const op = subjE ? G.player : G.enemy;
  const ai = subjE ? G.ai : G.ai2;
  const oa = subjE ? G.ai2 : G.ai;
  const fx = { gapSkip: 0, arcSeen: 0 };
  const keepDig = CONFIG.AI_PLAN.digKeep;
  if (fix.includes('dig0')) CONFIG.AI_PLAN.digKeep = 0; // dig0 — 파고들기 '칼로 받으며 계속 들어감'(11/14) 끔
  if (fix.includes('gap')) fixGap(ai, fx);
  if (fix.includes('arc')) fixArc(ai, fx);
  let rec = null; // 상대 공격 하나
  const recs = [];
  const sa = oa.startAttack;
  oa.startAttack = function (t, why, o) {
    const n0 = this.atkSeq;
    const r = sa.call(this, t, why, o);
    if (r && this.atkSeq !== n0) recs.push((rec = { t0: G.t, ts: null, tsTip: null, why, tech: this.tech?.name, seenT: null, seenId: null, seenSt: null, resp: null, readMiss: false, reck: false }));
    return r;
  };
  const ss = oa.startStrike;
  oa.startStrike = function (...a) { if (rec && rec.ts == null) rec.ts = G.t; return ss.apply(this, a); };
  const th0 = ai.threat;
  ai.threat = function (...a) {
    const r = th0.apply(this, a);
    if (r && rec && rec.seenT == null && G.t - rec.t0 < 3) (rec.seenT = G.t), (rec.seenId = r.id), (rec.seenSt = `${this.mode}/${this.phase}`);
    return r;
  };
  const nt = ai.noticedThreat;
  ai.noticedThreat = function (th) { const r = nt.call(this, th); if (!r && rec && th.id === rec.seenId) rec.readMiss = true; return r; };
  const pr = ai.planReck;
  ai.planReck = function (th) { const r = pr.call(this, th); if (r && rec && th.id === rec.seenId) rec.reck = true; return r; };
  const rp = ai.respond;
  ai.respond = function (th, d) {
    const was = this.threatSeen;
    const r = rp.call(this, th, d);
    if (th.id !== was && rec && rec.resp == null && th.id === rec.seenId) {
      rec.resp = !r ? (this.threatSeen === th.id ? 'gcFail' : 'skip')
        : this.mode === 'attack' ? (this.why === 'counter' ? 'counter' : `atk:${this.why}`)
          : this.mode === 'defend' ? (this.cnDive ? 'dive' : this.digDef ? 'digKeep' : this.defVoid ? 'void' : 'parry')
            : `other:${this.mode}`;
    }
    return r;
  };
  const W = [];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (vic !== me || !(sv > 0)) return;
    const st = stateOf(ai);
    const d = hdist(me, op);
    const R = rec;
    const fresh = R && G.t - R.t0 < 3; // 그 상처를 낸 공격 = 3 s 안에 시작한 상대의 마지막 공격 (상대가 이미 물러남 · 막기 꼴로 바뀐 뒤 칼이 닿은 것 · 비기 칼도)
    let cls, why;
    if (!fresh) (cls = 'g'), (why = `noAtk:${oa.mode}`);
    else if (st === 'strike' && (R.resp == null || R.resp === 'gcFail')) (cls = 'c'), (why = 'committed');
    else if (R.resp === 'parry' || R.resp === 'void') (cls = 'd'), (why = R.resp);
    else if (R.resp && R.resp !== 'gcFail' && R.resp !== 'skip') (cls = 'b'), (why = R.resp);
    else if (R.seenT != null && (R.readMiss || R.reck)) (cls = 'b'), (why = R.reck ? 'reck' : 'readMiss');
    else if (R.seenT != null && R.resp === 'gcFail') (cls = 'a'), (why = 'gcFail');
    else if (R.seenT != null) (cls = 'b'), (why = `seenNoResp:${R.seenSt}`);
    else (cls = 'a'), (why = st === 'strike' ? 'unseenStrike' : 'unseen');
    W.push({
      sv, cls, why, st, zone: r.zone, type: r.type, d,
      myReach: ai.M.reach, foeReach: ai.foeReach, foeOwn: oa.M.reach,
      gap: d > ai.M.reach && d <= oa.M.reach + 0.1,
      fromStrike: R?.tsTip != null ? (G.t - R.tsTip) / K : R?.ts != null ? (G.t - R.ts) / K : null, fromAtk: R ? (G.t - R.t0) / K : null,
      seenLead: R?.seenT != null ? (G.t - R.seenT) / K : null, react: ai.level.reaction / K, foeWhy: R?.why, foeTech: R?.tech, foeMode: oa.mode,
    });
  };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(me) && !out(op)) {
    G.step();
    if (rec && rec.tsTip == null && op.tipVel && op.tipVel.length() > 3.5) rec.tsTip = G.t; // 상대 칼끝이 3.5 m/s 넘게 움직이기 시작한 때 (위협 문턱과 같은 수 — 비기 칼도)
  }
  CONFIG.AI_PLAN.digKeep = keepDig;
  const res = { fx, dealt: op.wounds?.reduce?.((a, w) => a + (w.severity ?? 0), 0) ?? null, weapon, foe, seed, win: out(op) && !out(me), lose: out(me) && !out(op), W, foeAtk: recs.length, foeSeen: recs.filter((x) => x.seenT != null).length, resp: recs.reduce((o, x) => ((o[x.resp ?? (x.seenT != null ? 'seenNoResp' : 'unseen')] = (o[x.resp ?? (x.seenT != null ? 'seenNoResp' : 'unseen')] ?? 0) + 1), o), {}), T: G.t / K };
  G.world.free();
  return res;
}

const vlab = (v) => { const [b, f] = String(v).split('+'); return `${b === 'on' ? '편섬 켬' : '끔'}${f ? ` + 고침 ${f}` : ''}`; };
const CLS = { a: 'a 못 봄', b: 'b 봤지만 다른 것', c: 'c 치는 중', d: 'd 막기 골랐는데 맞음', g: 'g 그 밖' };
const ST = ['watch', 'approach', 'strike', 'withdraw', 'defend', 'secret', 'other'];
const STK = { watch: '간 보기', approach: '다가감', strike: '치는 중', withdraw: '물러남', defend: '막기', secret: '비기', other: '그 밖' };
export function tables(runs) {
  const groups = [...new Set(runs.map((r) => `${r.weapon}|${r.foe}|${r.v}`))];
  const L = ['| 받는 쪽 대 상대 (숙련 5) | 판 | 판 수 | 받은 칼날 심각도 / 판 | a 못 봄 | b 봤지만 다른 것 | c 치는 중 | d 막기 골랐는데 맞음 | g 그 밖 | 칼끝 틈에서 맞음 | 이김 · 짐 · 비김 |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const g of groups) {
    const [w, fo, v] = g.split('|');
    const rs = runs.filter((r) => `${r.weapon}|${r.foe}|${r.v}` === g);
    const W = rs.flatMap((r) => r.W);
    const tot = W.reduce((a, x) => a + x.sv, 0);
    const pc = (f) => { const s = W.filter(f).reduce((a, x) => a + x.sv, 0); return `${((100 * s) / Math.max(1e-9, tot)).toFixed(0)} %`; };
    const win = rs.filter((r) => r.win).length, lose = rs.filter((r) => r.lose).length;
    L.push(`| ${KO[w] ?? w} 대 ${KO[fo] ?? fo} | ${vlab(v)} | ${rs.length} | ${f2(tot / rs.length)} | ${pc((x) => x.cls === 'a')} | ${pc((x) => x.cls === 'b')} | ${pc((x) => x.cls === 'c')} | ${pc((x) => x.cls === 'd')} | ${pc((x) => x.cls === 'g')} | ${pc((x) => x.gap)} | ${win} · ${lose} · ${rs.length - win - lose} |`);
  }
  return L.join('\n');
}
/** 까닭 잘게 (심각도 몫) · 꼴 · 거리 · 때 */
export function detail(runs, label) {
  const W = runs.flatMap((r) => r.W);
  const tot = W.reduce((a, x) => a + x.sv, 0);
  const by = (key) => { const o = {}; for (const x of W) o[key(x)] = (o[key(x)] ?? 0) + x.sv; return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, s]) => `${k} ${((100 * s) / tot).toFixed(0)} %`).join(' · '); };
  const med = (xs) => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
  const n = runs.length;
  const atk = runs.reduce((a, r) => a + r.foeAtk, 0), seen = runs.reduce((a, r) => a + r.foeSeen, 0);
  const resp = {}; for (const r of runs) for (const [k, c] of Object.entries(r.resp)) resp[k] = (resp[k] ?? 0) + c;
  return [
    `**${label}** — 판 ${n} · 상처 ${W.length} · 심각도 / 판 ${f2(tot / n)}`,
    `- 까닭 잘게: ${by((x) => `${x.cls}:${x.why}`)}`,
    `- 맞은 때 꼴: ${by((x) => STK[x.st] ?? x.st)}`,
    `- 상대 칼(공격 까닭 · 기술): ${by((x) => `${x.foeWhy ?? '-'}/${x.foeTech ?? '-'}`)}`,
    `- 거리(가운데 값): 맞은 때 가슴 사이 ${f2(med(W.map((x) => x.d)))} m · 내 칼끝 ${f2(med(W.map((x) => x.myReach)))} · 상대 칼끝(제 값) ${f2(med(W.map((x) => x.foeOwn)))} · 상대 칼끝 어림 ${f2(med(W.map((x) => x.foeReach)))} · 칼끝 틈에서 맞음 ${((100 * W.filter((x) => x.gap).reduce((a, x) => a + x.sv, 0)) / tot).toFixed(0)} %`,
    `- 때(가운데 값 · 실제 초): 상대 휘두르기 시작(칼끝 3.5 m/s) → 맞음 ${f2(med(W.map((x) => x.fromStrike)))} · 상대 공격 결정 → 맞음 ${f2(med(W.map((x) => x.fromAtk)))} · 처음 본 때 → 맞음 ${f2(med(W.map((x) => x.seenLead)))} · 반응 시간 ${f2(med(W.map((x) => x.react)))}`,
    `- 상대 공격 ${atk} 번 (판당 ${f2(atk / n)}) · 그 가운데 받는 쪽이 칼을 본 것 ${seen} (${((100 * seen) / Math.max(1, atk)).toFixed(0)} %) · 고른 것: ${Object.entries(resp).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${c}`).join(' · ')}`,
  ].join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    const runs = args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(tables(runs));
    console.log('');
    for (const g of [...new Set(runs.map((r) => `${r.weapon}|${r.foe}|${r.v}`))]) {
      const [w, fo, v] = g.split('|');
      console.log(detail(runs.filter((r) => `${r.weapon}|${r.foe}|${r.v}` === g), `${KO[w] ?? w} 대 ${KO[fo] ?? fo} · ${vlab(v)}`));
      console.log('');
    }
  } else {
    const ws = arg('weapons', 'hwando,qinggang').split(',');
    const foes = arg('foes', 'zweihander,longsword,rapier,uchigatana').split(',');
    const vars = arg('vars', '0,on').split(',');
    const fixes = arg('fix', '').split('|').filter((x) => x !== undefined);
    const seeds = range(arg('seeds', '1-6'));
    const runs = [];
    for (const fixS of fixes) for (const foe of foes) for (const v of vars) for (const weapon of ws) for (const seed of seeds) {
      const fix = fixS ? fixS.split(',') : [];
      const r = withVar(v, () => rootFight({ weapon, foe, seed, fix }));
      runs.push({ ...r, v: fixS ? `${v}+${fixS}` : v, weapon: ws.length > 1 && ws.every((x) => ['hwando', 'qinggang'].includes(x)) ? 'eastern' : weapon, w0: weapon });
      console.error(weapon, foe, v, fixS, seed, r.W.length, r.win ? 'W' : r.lose ? 'L' : 'D', JSON.stringify(r.fx));
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(tables(runs));
  }
}
