// 서포트 재기 (11/19 — 사장님 11/19 '동방과 독일이 서포트에 강하고 이베리아가 서포트에 특별히 도움 안 되는 걸로 하자' · 기록 docs/strike/team_support_2026-11-19.md):
//  유파마다 '동료로서 얼마나 돕나'. 동료 자리 X 의 유파만 바꾸고 나머지(상대 · 다른 동료 P · 숙련 · 자리 · 씨앗)는 판 묶음(field)마다 같게 — X 다섯이 같은 판을 돈다(짝 지은 견줌).
//  재기 전용 도구 — 게임 코드는 읽기만 (team_sense.mjs 와 따로 둔 까닭: 다른 가지가 그 도구에 판 짜기 옵션을 넣는 중). 한 과정에서 판을 차례로 (자식 과정 없음).
//  쓰임: node tools/sim/team_support.mjs [판 묶음 수 50] [maxSecs 90] [--modes=2v2,2v1 — 3v3 도 (11/20 · X + 동료 P · P2 대 F1 · F2 · F3 — 같은 편 칼 재기용)] [--field=even|none] [--xs=german,…] [--profs=2,4,6] [--solo2v1=6:4] [--duel] [--duelSecs=60] [--lane=0/2] [--ks=1,5] [--out=파일]
//        node tools/sim/team_support.mjs agg 파일 … — 여러 갈래(--lane) 결과를 합쳐 표
//  판 짜기 (사장님 11/19 '상대 유파가 통제되지 않으면 확률이 오염됨'):
//   --field=even (기본) 다른 동료 P · 상대 F1 · F2 의 유파를 다섯 유파에서 고르게 — 묶음 k 마다 P = 유파[k mod 5] · F1 = 유파[⌊k/5⌋ mod 5] · F2 = 유파[(k + 2⌊k/5⌋ + 1) mod 5]
//                       (25 묶음마다 세 자리 모두 다섯 유파가 다섯 번씩) · 무기 = 그 유파 대표 무기 둘(ai_ring_measure.mjs 와 같음)에서 (k + 자리) 홀짝
//   --field=none        P · F1 · F2 = 무유파 칼잡이 (롱소드 · 꾸러미 tree_branch — 광기의 브론이 팔쉬온을 쥔 꼴과 같은 무유파 몸 · 마음가짐 없음)
//   X 무기 = X 유파 대표 무기 둘에서 k 홀짝 · 숙련 = 판의 모두 같게 --profs 를 k 로 돌림 · 자리: 2:2 는 X 편 = k 홀짝 · 편 안 자리 = ⌊k/2⌋ 홀짝 · 2:1 은 X 가 둘 쪽(자리 0 · 2 를 ⌊k/2⌋ 홀짝) · 혼자 = F1
//   난수 씨앗 = k + 1 (X 다섯이 같은 씨앗)
//  --duel: X 의 1:1 힘 (같은 상대 · 같은 숙련 · 같은 씨앗): X 대 F1 · X 대 F2 (1:1 판 — 판 사본 없음 · 자리 = k 홀짝) · 최대 --duelSecs (60 s)
//  재는 것 (X 마다 — 2:1 의 '혼자'는 F1):
//   이김        X 편 이김 1 · 짐 0 · 끝 안 남 ½ — 판 묶음 평균에서 뺀 몫(lift) · 1:1 힘이 어림하는 몫을 뺀 나머지(resid — 묶음 안에서 뺀 값끼리 곧은 줄 맞춤)
//   돕기(assist) P 가 적 Y 에게 낸 상처(심각도 HIT_SEV 넘음) 가운데 그 앞 W(실제 1.2 s) 안에 X 가 Y 에게: 칼을 맞댐(clash) · 묶음(bind — 칼을 이어 맞댄 지 realS(0.2) 넘음) · 밀치기(shove — X.barge) ·
//                굳힘(stiff — Y 가 넘어짐 · 무릎 · 일어섬 · 비기/헛침 경직에 든 때 그 앞 W 안 X 의 닿음이 있었음 · 그 꼴 동안 이어짐) · 기력 뺌(drain — Y 의 막기 · 클린치 기력 청구가 X 와의 닿음에서 · X 의 사냥 겹) ·
//                상처(wound — 출혈 포함) · 칼 떨어뜨림(disarm — 칼을 놓친 때 그 앞 W 안 X 의 닿음 · 칼 없는 동안 이어짐) — 하나라도(any) · 칸마다 · 죽인 칼 가운데 · 붙듦(held — 그 순간 Y 가 X 를 겨눔)
//   지킴        P 가 받은 상처 / 산 분 · 심각 · P 죽음 몫 · P 열세(서 있는 적 둘이 모두 제 칼끝 + 0.5 안에 P) 표본 몫 (2:2 만)
//   같은 편 칼   X → 동료 상처 · 동료 → X 상처 (심각도 HIT_SEV 넘음 · 그 밑 닿음 따로) · X–P 칼 맞댐 수 · X 가 P 의 칼길(P → P 상대 선분 0.5 m 안 · 그 사이)을 막은 표본 몫 · P 칼길 미룸 수(ai.stats.team.laneHold)
//   자리        X 의 옆 걸음(겨눈 상대 쪽에 수직인 골반 빠르기 적분 m / 산 분) · 앞뒤 걸음 · 밟은 칸(0.5 m 칸 수 × 0.25 m²) · P 와 0.9 m 안 표본 몫
import { RAPIER, THREE, CONFIG, AI, newMatch, DT } from './jelly_harness.mjs';
import { aiAtProficiency } from '../../src/characters.js';
import { reachOf } from '../../src/targeting.js';
import { realS } from '../../src/config.js';
import { bwStiff } from '../../src/burst_whiff.js';
import { huntN } from '../../src/cn_hunt.js';
import { LOOKS } from '../../src/looks.js';
import { writeFileSync, readFileSync, renameSync } from 'node:fs';
import { isMain } from './is_main.mjs';
void RAPIER; void THREE; void AI;

const args = process.argv.slice(2);
const MAIN = isMain(import.meta.url); // 다른 도구가 aggregate 만 읽을 때는 돌리지 않음
const AGG = MAIN && args[0] === 'agg';
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = args.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
export const SCHOOLS5 = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
export const REP = { german: ['longsword', 'kriegsmesser'], italian: ['rapier', 'pappenheimer'], iberian: ['zweihander', 'flamberge'], japanese: ['uchigatana', 'monohoshizao'], chinese: ['hwando', 'qinggang'] };
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방', none: '무유파' };
const HIT_SEV = 0.05; // team_sense.mjs 와 같음 (그 밑 = 닿기만)
const W = realS(1.2); // 돕기 창 (시간 사다리 1.2 s)
const BIND_T = realS(0.2); // 묶음 = 칼을 이어 맞댄 시간
const DRAIN_T = realS(0.2); // 기력 청구를 닿음에 잇는 창
const SAMPLE = 6; // 20 Hz
const CATS = ['clash', 'bind', 'shove', 'stiff', 'drain', 'wound', 'disarm'];

/** 판 묶음 k (0 부터) → 자리 짜기 */
export function fieldOf(k, field, profs) {
  const prof = profs[k % profs.length];
  const rep = (s, slot) => REP[s][(k + slot) % 2];
  const body = (s, slot) => (field === 'none' ? { school: 'none', weapon: 'longsword', pack: 'tree_branch' } : { school: s, weapon: rep(s, slot) });
  const P = body(SCHOOLS5[k % 5], 1);
  const F1 = body(SCHOOLS5[Math.floor(k / 5) % 5], 2);
  const F2 = body(SCHOOLS5[(k + 2 * Math.floor(k / 5) + 1) % 5], 3);
  // 3v3 (11/20 — 생사전 3:3 · 같은 편 상처 짧게): 둘째 동료 P2 · 셋째 적 F3 · X 자리 = 편 안 셋 가운데 k mod 3
  const P2 = body(SCHOOLS5[(k + 3) % 5], 4);
  const F3 = body(SCHOOLS5[(Math.floor(k / 5) + 2 * k + 4) % 5], 5);
  return { k, seed: k + 1, prof, P, F1, F2, P2, F3, xTeam: k % 2, xHi: Math.floor(k / 2) % 2, x3: k % 3 };
}
const xBody = (x, k) => ({ school: x, weapon: REP[x][k % 2] });

const chest = (f) => f.bodies.chest.translation();
const hd = (a, b) => { const p = chest(a), q = chest(b); return Math.hypot(q.x - p.x, q.z - p.z); };
const standing = (f) => f.alive && !f.revival && f.state === 'stand';

function seedRandom(seed) {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
const aiFor = (b, prof) => aiAtProficiency({ ai: { persona: b.pack ? { school: b.pack } : {} }, weapon: b.weapon }, prof);

/** 한 판 (2v2 · 2v1): X 자리 · P 자리 · 적 자리를 짜고 돌림 */
const SOLO = flag('solo2v1', null) ? String(flag('solo2v1')).split(':').map(Number) : null; // --solo2v1=6:4 — 2:1 은 혼자 숙련 6 · 둘 숙련 4 (둘 쪽이 85 ~ 90 % 에 붙지 않게 — 감독 11/19) · 2:2 는 --profs 돌림 그대로
function teamFight(mode, fd, x, MAX) {
  seedRandom(fd.seed);
  const X = xBody(x, fd.k);
  let slots; // 자리 → 몸
  let xi, pi;
  if (mode === '2v2') {
    // 편 0 = 자리 0 · 2 · 편 1 = 자리 1 · 3
    const t = fd.xTeam;
    xi = t + 2 * fd.xHi;
    pi = t + 2 * (1 - fd.xHi);
    const o = 1 - t;
    slots = [];
    slots[xi] = X; slots[pi] = fd.P; slots[o] = fd.F1; slots[o + 2] = fd.F2;
  } else if (mode === '3v3') {
    // 3v3: 편 0 = 자리 0 · 2 · 4 · 편 1 = 자리 1 · 3 · 5 — X = 편 안 (k mod 3) 번째 · P · P2 는 나머지 차례 · 적 F1 · F2 · F3
    const t = fd.xTeam;
    const o = 1 - t;
    xi = t + 2 * fd.x3;
    pi = t + 2 * ((fd.x3 + 1) % 3);
    slots = [];
    slots[xi] = X; slots[pi] = fd.P; slots[t + 2 * ((fd.x3 + 2) % 3)] = fd.P2;
    slots[o] = fd.F1; slots[o + 2] = fd.F2; slots[o + 4] = fd.F3;
  } else {
    // 2v1: 둘 = 자리 0 · 2 (편 0) · 혼자 = 자리 1
    xi = 2 * fd.xHi;
    pi = 2 * (1 - fd.xHi);
    slots = [];
    slots[xi] = X; slots[pi] = fd.P; slots[1] = fd.F1;
  }
  const count = slots.length;
  const profAt = (i) => (mode === '2v1' && SOLO ? (i === 1 ? SOLO[0] : SOLO[1]) : fd.prof);
  const G = newMatch({ count, ai: 'all', seed: fd.seed, walls: true, weapons: slots.map((b) => b.weapon), looks: Array(count).fill(LOOKS.enemy), aiOf: (i) => aiFor(slots[i], profAt(i)) });
  const F = G.fighters;
  const XF = F[xi], PF = F[pi];
  const foes = F.filter((f) => f.team !== XF.team);
  const now = () => G.t;
  // 닿음 장부: touch.get(Y).get(A) = { clash, bind, shove, stiff, drain, wound, disarm, any } — A 가 Y 에게 마지막으로 한 때
  const touch = new Map(F.map((f) => [f, new Map(F.filter((g) => g !== f).map((g) => [g, {}]))]));
  const mark = (y, a, cat) => { if (y === a) return; const r = touch.get(y)?.get(a); if (r) r[cat] = now(); };
  const recentBy = (y, w = W) => { const out = []; for (const [a, r] of touch.get(y)) { const last = Math.max(r.clash ?? -1e9, r.shove ?? -1e9, r.wound ?? -1e9, r.sub ?? -1e9); if (now() - last <= w) out.push(a); } return out; };
  const bindStart = new Map(); // 짝 열쇠 → 이어 맞댄 시작 · 마지막 스텝 때
  const C = {
    xWin: 0, t: 0, over: false,
    pHits: 0, pKills: 0, asHit: 0, asKill: 0, held: 0, heldKill: 0, cat: Object.fromEntries(CATS.map((c) => [c, 0])),
    xHits: 0, xKills: 0, xGot: 0, xDied: 0, pGot: 0, pSevere: 0, pDied: 0, pAliveMin: 0, xAliveMin: 0,
    outS: 0, out2: 0, ffXtoA: 0, ffXtoASub: 0, ffXtoASevere: 0, ffXKill: 0, ffAtoX: 0, ffAtoXSub: 0, xpClash: 0, laneS: 0, laneBlock: 0, pLaneHold: 0,
    lat: 0, rad: 0, cells: 0, nearP: 0, nearS: 0, coS: 0, coSum: 0, co90: 0, sup: null,
  };
  const wasAlive = new Map(F.map((f) => [f, true]));
  const prevHunt = new Map(F.map((f) => [f, 0]));
  G.before = () => { for (const f of F) wasAlive.set(f, f.alive), prevHunt.set(f, huntN(f)); };
  // 기력 청구 감싸기 (재기 — 판 동안만 · 값은 그대로 넘김): 막기 · 클린치 청구를 그 앞 DRAIN_T 안에 칼을 맞댔거나 밀치던 몸에 잇는다
  for (const y of F) {
    const st = y.stamina;
    const sp = st.spend.bind(st);
    st.spend = (kind, amount) => {
      const r = sp(kind, amount);
      if ((kind === 'block' || kind === 'clinch') && amount > 0) for (const [a, rec] of touch.get(y)) if (now() - Math.max(rec.clash ?? -1e9, rec.shove ?? -1e9) <= DRAIN_T) mark(y, a, 'drain');
      return r;
    };
  }
  G.combat.hooks.onWound = (att, vic, r) => {
    if (!att || att === vic || !wasAlive.get(vic)) return;
    const sev = r?.severity ?? 0;
    const same = att.team === vic.team;
    if (same) {
      if (att === XF) { if (sev >= HIT_SEV) { C.ffXtoA++; if (sev >= 0.5) C.ffXtoASevere++; if (!vic.alive) C.ffXKill++; } else C.ffXtoASub++; }
      if (vic === XF) { if (sev >= HIT_SEV) C.ffAtoX++; else C.ffAtoXSub++; }
      return;
    }
    mark(vic, att, sev >= HIT_SEV ? 'wound' : 'sub');
    const h = huntN(vic);
    if (h > prevHunt.get(vic)) mark(vic, att, 'drain'), prevHunt.set(vic, h); // 사냥 겹 (기력 회복 저하 — 그 스텝 처음보다 늘었음)
    if (sev < HIT_SEV) return;
    const killed = !vic.alive;
    if (att === XF) { C.xHits++; if (killed) C.xKills++; }
    if (vic === XF) C.xGot++;
    if (vic === PF) { C.pGot++; if (sev >= 0.5) C.pSevere++; }
    if (att === PF) {
      C.pHits++;
      if (killed) C.pKills++;
      const rec = touch.get(vic).get(XF);
      let any = false;
      for (const c of CATS) if (now() - (rec[c] ?? -1e9) <= W) { C.cat[c]++; any = true; }
      if (any) { C.asHit++; if (killed) C.asKill++; }
      if (vic.foe === XF) { C.held++; if (killed) C.heldKill++; }
    }
  };
  G.combat.hooks.onClash = (point, sp, info) => {
    const a = info?.a, b = info?.b;
    if (!a || !b) return;
    if (a.team === b.team) { if ((a === XF || b === XF) && info.fresh) C.xpClash++; return; }
    mark(a, b, 'clash'); mark(b, a, 'clash');
    const key = a.index * 8 + b.index;
    const s = bindStart.get(key);
    if (info.fresh || !s || now() - s.last > realS(0.1)) bindStart.set(key, { t0: now(), last: now() });
    else { s.last = now(); if (now() - s.t0 >= BIND_T) { mark(a, b, 'bind'); mark(b, a, 'bind'); } }
  };
  const stiffBy = new Map(); // Y → 굳힌 몸들 (그 꼴 동안)
  const disarmBy = new Map();
  const prevStiff = new Map(F.map((f) => [f, false]));
  const prevArmed = new Map(F.map((f) => [f, f.armed]));
  const visited = new Set();
  const n = Math.round(MAX / DT);
  let i = 0;
  for (; i < n && !G.over; i++) {
    G.step();
    const t = now();
    for (const f of F) if (f.alive) { if (f === PF) C.pAliveMin += DT / 60; if (f === XF) C.xAliveMin += DT / 60; }
    // 밀치기 · 굳힘 · 칼 떨어뜨림
    for (const a of F) if (a.alive && a.barge && a.foe && a.foe.team !== a.team) mark(a.foe, a, 'shove');
    for (const y of F) {
      const stiff = y.alive && !y.revival && (y.state !== 'stand' || bwStiff(y) || !!y.secretStiff);
      if (stiff && !prevStiff.get(y)) stiffBy.set(y, recentBy(y).filter((a) => a.team !== y.team));
      if (!stiff) stiffBy.delete(y);
      prevStiff.set(y, stiff);
      for (const a of stiffBy.get(y) ?? []) mark(y, a, 'stiff');
      if (prevArmed.get(y) && !y.armed && y.alive) disarmBy.set(y, recentBy(y).filter((a) => a.team !== y.team));
      if (y.armed) disarmBy.delete(y);
      prevArmed.set(y, y.armed);
      for (const a of disarmBy.get(y) ?? []) mark(y, a, 'disarm');
    }
    // X 자리 · 걸음
    if (standing(XF) && !XF.feetHeld) {
      const v = XF.bodies.pelvis.linvel();
      const x = XF.foe;
      if (x && x.alive) {
        const p = chest(XF), q = chest(x);
        const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
        const along = (v.x * dx + v.z * dz) / L;
        const perp = (v.x * dz - v.z * dx) / L;
        C.lat += Math.abs(perp) * DT;
        C.rad += Math.abs(along) * DT;
      }
      const c = chest(XF);
      visited.add(`${Math.floor(c.x / 0.5)},${Math.floor(c.z / 0.5)}`);
    }
    if (i % SAMPLE) continue;
    // 표본: P 열세 · X 가 P 칼길을 막음 · X–P 붙음
    if (standing(PF)) {
      const fs = foes.filter(standing);
      if (mode === '2v2' && fs.length >= 2) { C.outS++; if (fs.filter((y) => hd(PF, y) <= reachOf(y) + 0.5).length >= 2) C.out2++; }
      const y = PF.foe;
      if (y && standing(y) && standing(XF)) {
        C.laneS++;
        const p = chest(PF), q = chest(y), c = chest(XF);
        const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
        const tt = ((c.x - p.x) * dx + (c.z - p.z) * dz) / L;
        const perp = Math.abs((c.x - p.x) * dz - (c.z - p.z) * dx) / L;
        if (tt > 0 && tt < L && perp < 0.5) C.laneBlock++;
      }
      if (standing(XF)) { C.nearS++; if (hd(XF, PF) <= 0.9) C.nearP++; }
      // 집게 각: X · P 가 같은 적에게 함께 붙음 (둘 다 그 적의 제 칼끝 + 0.5 안) — 그 적 자리에서 본 X · P 사이 각
      if (y && standing(y) && standing(XF) && XF.foe === y && hd(PF, y) <= reachOf(PF) + 0.5 && hd(XF, y) <= reachOf(XF) + 0.5) {
        const o = chest(y), a = chest(XF), b = chest(PF);
        const ang = Math.acos(Math.max(-1, Math.min(1, ((a.x - o.x) * (b.x - o.x) + (a.z - o.z) * (b.z - o.z)) / ((Math.hypot(a.x - o.x, a.z - o.z) * Math.hypot(b.x - o.x, b.z - o.z)) || 1)))) * 180 / Math.PI;
        C.coS++; C.coSum += ang; if (ang >= 90) C.co90++;
      }
    }
  }
  C.t = +G.t.toFixed(2);
  C.over = G.over;
  C.xWin = G.over ? (G.winner === XF.team ? 1 : G.winner == null ? 0.5 : 0) : 0.5;
  C.xDied = XF.alive ? 0 : 1;
  C.pDied = PF.alive ? 0 : 1;
  C.cells = visited.size;
  C.pLaneHold = PF.aiCtl?.stats?.team?.laneHold ?? 0;
  C.sup = XF.aiCtl?.stats?.support ?? null; // 서포트 재기 칸 (X 몸 — src/team_support.js)
  C.lat = +C.lat.toFixed(2); C.rad = +C.rad.toFixed(2);
  C.pAliveMin = +C.pAliveMin.toFixed(4); C.xAliveMin = +C.xAliveMin.toFixed(4);
  return C;
}

/** 1:1 (X 대 상대 하나 — 판 사본 없음) → X 이김 1 · 짐 0 · 끝 안 남 ½ */
function duel(fd, x, foe, MAX) {
  seedRandom(fd.seed);
  const X = xBody(x, fd.k);
  const xi = fd.k % 2;
  const slots = xi === 0 ? [X, foe] : [foe, X];
  const G = newMatch({ count: 2, ai: 'all', seed: fd.seed, walls: true, weapons: slots.map((b) => b.weapon), looks: [LOOKS.enemy, LOOKS.enemy], aiOf: (i) => aiFor(slots[i], fd.prof) });
  const n = Math.round(MAX / DT);
  for (let i = 0; i < n && !G.over; i++) G.step();
  return G.over ? (G.winner === xi ? 1 : G.winner == null ? 0.5 : 0) : 0.5;
}

// ───────────────────────── 돌림 ─────────────────────────
if (MAIN && !AGG) {
  const N = +(pos[0] ?? 50);
  const MAX = +(pos[1] ?? 90);
  const MODES = String(flag('modes', '2v2,2v1')).split(',');
  const FIELD = String(flag('field', 'even'));
  const XS = String(flag('xs', SCHOOLS5.join(','))).split(',');
  const PROFS = String(flag('profs', '2,4,6')).split(',').map(Number);
  const DUEL = !!flag('duel', false);
  const DMAX = +flag('duelSecs', 60); // 1:1 판 최대 (s)
  const [laneI, laneN] = String(flag('lane', '0/1')).split('/').map(Number);
  const KS = flag('ks', null) ? new Set(String(flag('ks')).split(',').map(Number)) : null;
  const OUT = flag('out', null);
  const rows = [];
  const t0 = Date.now();
  const save = () => { if (OUT) writeFileSync(OUT + '.part', JSON.stringify({ N, MAX, MODES, FIELD, XS, PROFS, rows })), renameSync(OUT + '.part', OUT); }; // 새 파일에 다 쓴 뒤 바꿔 넣음 (11/21 — 디스크가 차서 쓰다 끊겨도 앞 판까지는 성함)
  for (let k = 0; k < N; k++) {
    if (k % laneN !== laneI || (KS && !KS.has(k + 1))) continue;
    const fd = fieldOf(k, FIELD, PROFS);
    for (const x of XS) {
      for (const mode of MODES) {
        const r = teamFight(mode, fd, x, MAX);
        rows.push({ kind: 'team', mode, field: FIELD, k, prof: mode === '2v1' && SOLO ? -1 : fd.prof, x, P: fd.P.school, F1: fd.F1.school, F2: fd.F2.school, ...(mode === '3v3' ? { P2: fd.P2.school, F3: fd.F3.school } : {}), ...r });
        save(); // 판마다 적음 (컨테이너가 끊겨도 끝난 판은 남음 — 이어 돌릴 때 --ks 로 빠진 묶음만)
        process.stderr.write(`${mode} k${k + 1} p${fd.prof} X=${x} P=${fd.P.school}${mode === '3v3' ? '+' + fd.P2.school : ''} F=${fd.F1.school}${mode === '2v2' || mode === '3v3' ? '+' + fd.F2.school : ''}${mode === '3v3' ? '+' + fd.F3.school : ''} → ${r.xWin} ${r.t}s 돕기 ${r.asHit}/${r.pHits} 같은편 ${r.ffXtoA}/${r.ffAtoX} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
      }
      if (DUEL) {
        const d1 = duel(fd, x, fd.F1, DMAX);
        const d2 = MODES.includes('2v2') ? duel(fd, x, fd.F2, DMAX) : null;
        rows.push({ kind: 'duel', field: FIELD, k, prof: fd.prof, x, F1: fd.F1.school, F2: fd.F2.school, d1, d2 });
        process.stderr.write(`duel k${k + 1} X=${x} → ${d1} ${d2} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
      }
      save();
    }
  }
  save();
  console.log(`서포트 재기 — 묶음 ${N} · ${MODES.join(' · ')} · 판 짜기 ${FIELD} · 숙련 ${PROFS.join('/')} · 갈래 ${laneI}/${laneN} · ${((Date.now() - t0) / 1000).toFixed(0)} s · 판 ${rows.length}`);
}

// ───────────────────────── 합쳐 표 (agg) ─────────────────────────
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
const f2 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(2));
/**
 * 합쳐 표. 이김 lift = 묶음 안 평균을 뺀 X 편 이김(X 다섯이 다 돈 묶음만).
 *  1:1 어림: X 유파 × 상대 유파 칸의 1:1 평균(같은 판 짜기의 모든 --duel 판 — 한 판짜리 잡음을 덜려고 칸으로 모음) → 그 묶음 상대들의 평균 = 어림 1:1 몫.
 *  β = 묶음 · 유파 둘 다 뺀(두 갈래 평균 뺌) 이김을 어림 1:1 몫에 곧은 줄로 — '상대와의 짝이 1:1 에서 유리한 만큼 편이 더 이기나' (유파 몫 자체는 β 에 안 섞임).
 *  나머지(resid) = lift − β × (X 의 어림 1:1 몫 − 묶음 평균) — 1:1 힘이 어림하는 몫을 뺀 서포트 몫. 판 짜기 none 은 상대가 하나뿐이라 β 를 같은 모드 even 에서 빌림.
 *  죽인 수 나머지(residK) = 같은 셈을 X 가 죽인 수로 (X 의 칼이 낸 몫 — 서포트가 X 의 죽임을 돕기도 해서 덜 깨끗함 · 견줌)
 */
export function aggregate(rows) {
  const out = [];
  const fields = [...new Set(rows.map((r) => r.field))].sort(); // even 먼저 (none 이 β 를 빌림)
  const betas = {};
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((q, v) => q + (v - m) ** 2, 0) / (a.length - 1)) : null; };
  for (const field of fields) for (const mode of ['2v2', '2v1']) {
    const T = rows.filter((r) => r.kind === 'team' && r.mode === mode && r.field === field);
    if (!T.length) continue;
    const D = rows.filter((r) => r.kind === 'duel' && r.field === field);
    const cell = new Map(); // `${x}|${상대 유파}` → [1:1 결과]
    for (const d of D) for (const [s, v] of [[d.F1, d.d1], [d.F2, d.d2]]) if (v != null) { const key = `${d.x}|${s}`; if (!cell.has(key)) cell.set(key, []); cell.get(key).push(v); }
    const cellMean = (x, s) => mean(cell.get(`${x}|${s}`) ?? []);
    const predOf = (r) => { const a = cellMean(r.x, r.F1); if (mode === '2v1') return a; const b = cellMean(r.x, r.F2); return a == null || b == null ? null : (a + b) / 2; };
    const ks = [...new Set(T.map((r) => r.k))];
    const xs = [...new Set(T.map((r) => r.x))];
    const full = ks.filter((k) => xs.every((x) => T.some((r) => r.k === k && r.x === x)));
    const at = (k, x) => T.find((r) => r.k === k && r.x === x);
    // 묶음 안에서 뺀 값
    const dev = (get) => { const o = new Map(xs.map((x) => [x, []])); for (const k of full) { const v = xs.map((x) => get(at(k, x))); if (v.some((q) => q == null)) continue; const m = mean(v); xs.forEach((x, j) => o.get(x).push(v[j] - m)); } return o; };
    const devY = dev((r) => r.xWin);
    const devP = dev(predOf);
    const devK = dev((r) => r.xKills);
    // 유파마다 평균까지 빼고 (두 갈래) 곧은 줄
    const slope = (A, B) => { let sxy = 0, sxx = 0; for (const x of xs) { const a = A.get(x), b = B.get(x); if (a.length !== b.length || !a.length) continue; const ma = mean(a), mb = mean(b); for (let j = 0; j < a.length; j++) (sxy += (a[j] - ma) * (b[j] - mb)), (sxx += (a[j] - ma) ** 2); } return sxx > 1e-9 ? sxy / sxx : null; };
    let beta = slope(devP, devY);
    if (beta == null && betas[mode]) beta = betas[mode].beta;
    else if (field === 'even') betas[mode] = { beta };
    const betaK = slope(devK, devY);
    for (const x of xs) {
      const R = T.filter((r) => r.x === x);
      const S = (k) => R.reduce((s, r) => s + (r[k] ?? 0), 0);
      const Sc = (c) => R.reduce((s, r) => s + r.cat[c], 0);
      const lift = mean(devY.get(x));
      const liftSE = devY.get(x).length > 1 ? sd(devY.get(x)) / Math.sqrt(devY.get(x).length) : null;
      const pl = mean(devP.get(x));
      const kl = mean(devK.get(x));
      const pr = R.map(predOf).filter((v) => v != null);
      out.push({
        field, mode, x, fights: R.length, win: pct(S('xWin'), R.length), lift: f2(lift == null ? null : 100 * lift), liftSE: f2(liftSE == null ? null : 100 * liftSE),
        duel: pr.length ? pct(mean(pr), 1) : null, duelLift: f2(pl == null ? null : 100 * pl),
        resid: f2(lift == null || pl == null || beta == null ? null : 100 * (lift - beta * pl)), beta: f2(beta),
        residK: f2(lift == null || kl == null || betaK == null ? null : 100 * (lift - betaK * kl)), betaK: f2(betaK),
        pHits: S('pHits'), assistPct: pct(S('asHit'), S('pHits')), assistKillPct: pct(S('asKill'), S('pKills')), heldPct: pct(S('held'), S('pHits')),
        cats: Object.fromEntries(CATS.map((c) => [c, pct(Sc(c), S('pHits'))])),
        xHitsMin: f2(S('xHits') / Math.max(1e-9, S('xAliveMin'))), xKills: f2(S('xKills') / R.length), pHitsMin: f2(S('pHits') / Math.max(1e-9, S('pAliveMin'))),
        pGotMin: f2(S('pGot') / Math.max(1e-9, S('pAliveMin'))), pSevere: f2(S('pSevere') / R.length), pDiedPct: pct(S('pDied'), R.length), xDiedPct: pct(S('xDied'), R.length), pOutPct: pct(S('out2'), S('outS')),
        ffXtoA: f2(S('ffXtoA') / R.length), ffXtoASevere: S('ffXtoASevere'), ffXKill: S('ffXKill'), ffXtoASub: f2(S('ffXtoASub') / R.length), ffAtoX: f2(S('ffAtoX') / R.length), xpClash: f2(S('xpClash') / R.length),
        laneBlockPct: pct(S('laneBlock'), S('laneS')), pLaneHold: f2(S('pLaneHold') / R.length),
        coPct: pct(S('coS'), S('laneS')), coDeg: f2(S('coSum') / Math.max(1, S('coS'))), co90Pct: pct(S('co90'), S('coS')),
        sup: (() => { const o = {}; for (const r of R) for (const [k, v] of Object.entries(r.sup ?? {})) o[k] = (o[k] ?? 0) + v; for (const k of Object.keys(o)) o[k] = f2(o[k] / R.length); return o; })(),
        latMin: f2(S('lat') / Math.max(1e-9, S('xAliveMin'))), radMin: f2(S('rad') / Math.max(1e-9, S('xAliveMin'))), latShare: pct(S('lat'), S('lat') + S('rad')), areaM2: f2((S('cells') * 0.25) / R.length), nearPPct: pct(S('nearP'), S('nearS')),
        medSec: (() => { const b = R.map((r) => r.t).sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; })(), unfinished: R.filter((r) => !r.over).length,
      });
    }
  }
  return out;
}
if (AGG) {
  const rows = pos.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).rows);
  const A = aggregate(rows);
  for (const o of A) console.log(JSON.stringify(o));
  // 짧은 표
  for (const field of [...new Set(A.map((o) => o.field))]) for (const mode of ['2v2', '2v1']) {
    const L = A.filter((o) => o.field === field && o.mode === mode);
    if (!L.length) continue;
    console.log(`\n## ${mode} · 판 짜기 ${field}`);
    console.log('| X | 판 | 이김 % | lift ± SE | 1:1 어림 % | 나머지 · 죽임 나머지 | 돕기 % (죽인 칼) | 맞댐 · 묶음 · 밀침 · 굳힘 · 기력 · 상처 · 떨굼 | 붙듦 % | P 받은 상처/분 · 죽음 % · 열세 % | X→동료 (심각) · 동료→X · 맞댐 /판 | 칼길 막음 % · P 미룸 /판 | 옆 m/분 · 옆 몫 % · 칸 m² · P 0.9 m % |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const o of L) {
      const c = o.cats;
      console.log(`| ${KO[o.x] ?? o.x} | ${o.fights} | ${o.win} | ${o.lift} ± ${o.liftSE} | ${o.duel ?? '—'} | ${o.resid ?? '—'} · ${o.residK ?? '—'} | ${o.assistPct} (${o.assistKillPct}) | ${c.clash} · ${c.bind} · ${c.shove} · ${c.stiff} · ${c.drain} · ${c.wound} · ${c.disarm} | ${o.heldPct} | ${o.pGotMin} · ${o.pDiedPct} · ${o.pOutPct ?? '—'} | ${o.ffXtoA} (${o.ffXtoASevere}) · ${o.ffAtoX} · ${o.xpClash} | ${o.laneBlockPct} · ${o.pLaneHold} | ${o.latMin} · ${o.latShare} · ${o.areaM2} · ${o.nearPPct} |`);
    }
    console.log(`β (이김 ÷ 어림 1:1 — 묶음 · 유파 뺌) ${L[0].beta} · β 죽임 ${L[0].betaK}`);
    console.log('| X | 함께 붙음 % · 집게 ° · ≥ 90° % | 서포트 재기 칸 / 판 |');
    console.log('|---|---|---|');
    for (const o of L) console.log(`| ${KO[o.x] ?? o.x} | ${o.coPct} · ${o.coDeg} · ${o.co90Pct} | ${Object.entries(o.sup ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
  }
}
