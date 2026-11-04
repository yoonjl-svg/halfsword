// ─────────────────────────────────────────────────────────────
//  rapier_defence.mjs — 찌르기가 막기를 뚫는 까닭 재기 (사장님 11/04 '찌르기가 막기를 뚫는 까닭 이어서 재.' · 기록 docs/strike/rapier_defence_2026-11-05.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 싸움 = school_balance.mjs fightOne 그대로(사람 손가락 봇 · 실제 Input 터치 길 · 숙련 3 AI · 자연 바인드).
//   거기에 읽기만 하는 꽂개(probe)를 단다 — AI 의 위협 읽기(threat) · 반응(respond) · 공격 중 읽기 굴림(noticedThreat)을 감싸 결과만 적고, 칼끼리 닿음(onClash) · 몸 닿음(onWound)을 적는다.
//   난수 · 몸 · 칼은 그대로 (감싼 함수는 원래 함수를 같은 차례로 부르고 결과를 그대로 돌려준다 — 판 결과는 school_balance 와 바이트 같음).
//  낸 것(fire)마다:
//   결과 = 맞음(칼날 상처 · 의식 0.05 넘게 — school_balance 와 같은 셈) · 몸 닿음만(상처 없음) · 막힘(칼끼리 닿고 몸 닿음 없음) · 헛침(아무것도 없음) · 칼끼리 닿은 뒤 맞음(비껴 들어감)
//   AI = 위협으로 읽었나(처음 읽은 때 · 찌르기로 읽었나) · 못 읽은 까닭(멂 · 느림 3.5 m/s 밑 · 길 밖) · 첫 반응(못 봄 guardChance · 막기 · 물러나 피하기 · 맞받아 베기 · 패시브 ·
//        공격 중 읽기 굴림 실패 · 베는 중이라 안 봄) · 반응한 때 · 그때 AI 꼴
//   때 = 낸 뒤 칼끝이 3.5 m/s(AI 위협 문턱)를 넘은 때 · 첫 칼끼리 닿음 · 첫 몸 닿음 (실제 s) · 거리 = 낸 때 · 닿은 때 · 칼끝 → 상대 가슴 (낸 때 · 가장 가까움)
//   닿음 꼴 = 몸 닿음 종류(찌르기 · 베기 · 둔타) · 칼날 자리(t) · 칼 축 맞음(along) · 빠르기 · 부위 / 칼끼리 닿음 = 내 칼 자리 · 상대 칼 자리 · 충격량
//  node tools/sim/rapier_defence.mjs fight --cells=italian:rapier:longsword,... [--seeds=1-24] [--set=A.b=1,...] [--ts=rapier.window=0.06,...] [--secret=0] [--drop=x] [--tag=이름] [--json=파일]
//   (--ts = 찌르기 무기 장점 weapons.js THRUST_STYLE 을 이 프로세스 안에서만 · 까닭 나누기 --secret=0 --set=THRUST.itDrop=accel)
//  node tools/sim/rapier_defence.mjs agg <json ...> [--by=name|cls|kind]   (Markdown 표)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { CONFIG, THREE } from './harness_m.mjs';
import { fightOne, cellRow } from './school_balance.mjs';
import { THRUST_STYLE } from '../../src/weapons.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const WIN = 1.0; // 낸 것 하나의 창 (실제 s — 다음 낸 것이 먼저 오면 거기까지)
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** 칼날 자리 (0 = 코등이 · 1 = 칼끝) — 점을 칼 선분에 내림 */
function bladeT(f, point) {
  const a = f.bladePoint(0, _a);
  const b = f.bladePoint(1, _b);
  const ab = _c.subVectors(b, a);
  return THREE.MathUtils.clamp(((point.x - a.x) * ab.x + (point.y - a.y) * ab.y + (point.z - a.z) * ab.z) / ab.lengthSq(), 0, 1);
}

/** 꽂개 — fightOne({ probe }) 가 init · step · done 을 부른다 */
export function makeProbe() {
  let G = null;
  let P = null;
  let A = null;
  let ai = null;
  const recs = new Map(); // fire 객체 → 기록
  let R = null; // 지금 창의 기록
  const live = () => R && G.t - R.t0 <= WIN * K + 1e-9 && !R.closed;
  const tipGap = () => {
    const tip = P.bladePoint(1, _a);
    const c = A.bodies.chest.translation();
    return Math.hypot(tip.x - c.x, tip.y - c.y, tip.z - c.z);
  };
  const aiNow = () => ({ mode: ai.mode, phase: ai.phase, void: ai.mode === 'defend' ? !!ai.defVoid : null });
  return {
    init(o) {
      ({ G, P, A } = o);
      ai = G.ai;
      const th0 = ai.threat.bind(ai);
      ai.threat = (s, c, r, d) => {
        const res = th0(s, c, r, d);
        if (live() && R.bodyT == null && R.clashT == null) {
          if (res) {
            if (R.thT == null) Object.assign(R, { thT: G.t, thThrust: res.thrust, thLine: res.line, thAi: aiNow() });
          } else if (R.thT == null) {
            const sp = Math.max(Math.hypot(s.tvx, s.tvy, s.tvz), Math.hypot(s.mvx, s.mvy, s.mvz));
            const why = d > ai.foeReach + 0.9 ? 'far' : sp < 3.5 ? 'slow' : 'geom';
            R.nullWhy[why] = (R.nullWhy[why] ?? 0) + 1;
          }
        }
        return res;
      };
      const rs0 = ai.respond.bind(ai);
      ai.respond = (th, d) => {
        const pre = { seen: ai.threatSeen, ...aiNow() };
        const ok = rs0(th, d);
        if (pre.seen === th.id && !ok) return ok; // 이미 본 위협 (같은 공격 — 다시 판단 안 함)
        let br;
        if (!ok) br = ai.me.parryLockUntil != null && ai.me.fightT < ai.me.parryLockUntil ? 'lock' : 'noGuard';
        else if (ai.mode === 'attack') br = ai.why === 'counter' ? 'counter' : 'passiveAtk';
        else if (ai.mode === 'defend') br = ai.defVoid ? 'void' : 'parry';
        else br = `passive:${ai.mode}`;
        if (live()) {
          R.resps.push(br);
          if (R.resp == null) Object.assign(R, { resp: br, respT: G.t, respAi: { mode: pre.mode, phase: pre.phase }, respThrust: th.thrust });
        }
        return ok;
      };
      const nt0 = ai.noticedThreat.bind(ai);
      ai.noticedThreat = (th) => {
        const ok = nt0(th);
        if (!ok && live() && R.resp == null && R.noReadT == null) R.noReadT = G.t; // 공격 준비 중 읽기 굴림 실패 (L.read)
        return ok;
      };
      const oc = G.combat.hooks.onClash;
      G.combat.hooks.onClash = (point, sp, info) => {
        oc?.(point, sp, info);
        if (!live()) return;
        const mine = (info.a === P && info.b === A) || (info.a === A && info.b === P);
        if (!mine) return;
        R.clashN++;
        if (R.clashT == null) Object.assign(R, { clashT: G.t, clashFresh: !!info.fresh, clashJ: info.impulse, clashVn: info.vn, clashTP: bladeT(P, point), clashTA: bladeT(A, point), clashAi: aiNow(), clashD: P.foeDistance(), clashTap: !!P.skill.tap });
      };
      const ow = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, point, pr) => {
        ow?.(att, vic, r, point, pr);
        if (att !== P || vic !== A || !live()) return;
        R.bodyN++;
        if (r.severity > 0 && r.type !== 'blunt') R.sevBlade += r.severity;
        if (R.hits.length < 6) R.hits.push([r.type, r3(r.t), r3(r.speed > 0 ? r.dir.dot(r.bladeAxis) : null), r3(r.eff), r3(r.thr), r3(r.severity), r.zone, r3(r.speed), r3(r.energy)]); // 몸 닿음마다 [종류 · 칼날 자리 · 칼 축 맞음 · 실효 J · 문턱 J · 심각도 · 부위 · 빠르기 · 판정 J]
        if (R.bodyT == null) Object.assign(R, { bodyT: G.t, bodyType: r.type, bodyZone: r.zone, bodyPart: pr?.v?.part ?? null, bodyAlongT: r.t, bodyAlign: r.speed > 0 ? r.dir.dot(r.bladeAxis) : null, bodySpeed: r.speed, bodyE: r.energy, bodyEff: r.eff, bodyThr: r.thr, bodySev: r.severity, bodyAi: aiNow(), bodyD: P.foeDistance(), bodyTap: !!P.skill.tap, bodyIt: !!P.skill.tap?.it, bodyGap: tipGap() });
      };
    },
    step(cur) {
      if (!G) return;
      if (cur && !recs.has(cur)) {
        if (R) R.closed = true;
        R = { t0: G.t, d0: P.foeDistance(), gap0: tipGap(), gapMin: tipGap(), dMin: P.foeDistance(), ai0: aiNow(), tipMax: 0, tFast: null, nullWhy: {}, resps: [], hits: [], clashN: 0, bodyN: 0, sevBlade: 0, closed: false, tapIt: !!P.skill.tap?.it, itFwd: P.skill.tap?.it?.fwd ?? null, foeReach: ai.foeReach, hold: ai.holdDist() }; // AI 가 어림한 내 칼 거리 · 간 보는 거리 (읽기만 — holdDist 는 난수 없음)
        recs.set(cur, R);
      }
      if (!live()) return;
      const sp = P.tipVel.length();
      if (sp > R.tipMax) R.tipMax = sp;
      if (R.tFast == null && sp >= 3.5) R.tFast = G.t;
      const g = tipGap();
      if (g < R.gapMin) R.gapMin = g;
      const d = P.foeDistance();
      if (d < R.dMin) R.dMin = d;
      // AI 가 물러나는 빠르기 (낸 뒤 0.2 실제 s 째 — 사람 쪽 → AI 쪽 성분 · + = 멀어짐)
      if (R.aiBack == null && G.t - R.t0 >= 0.2 * K) {
        const pa = A.bodies.pelvis.translation();
        const pp = P.bodies.pelvis.translation();
        const v = A.bodies.pelvis.linvel();
        const ux = pa.x - pp.x;
        const uz = pa.z - pp.z;
        const n = Math.hypot(ux, uz) || 1;
        R.aiBack = (v.x * ux + v.z * uz) / n;
        R.ai02 = aiNow();
      }
    },
    done(fires) {
      const rel = (t, t0) => (t == null ? null : r3((t - t0) / K));
      return fires.map((f) => {
        const Q = recs.get(f);
        if (!Q) return null;
        const hit = f.wounds > 0;
        const out = hit ? (Q.clashT != null && Q.clashT <= (Q.bodyT ?? Infinity) ? 'hitAfterClash' : 'hit') : Q.bodyT != null ? 'touch' : Q.clashT != null ? 'blocked' : 'whiff';
        return {
          t: r3(f.t / K), name: f.name, cls: f.cls, out, sev: r3(f.sev),
          d0: r3(Q.d0), dMin: r3(Q.dMin), gap0: r3(Q.gap0), gapMin: r3(Q.gapMin), tipMax: r3(Q.tipMax), fast: rel(Q.tFast, Q.t0), ai0: Q.ai0, ai02: Q.ai02 ?? null, aiBack: r3(Q.aiBack), tapIt: Q.tapIt, itFwd: r3(Q.itFwd), foeReach: r3(Q.foeReach), hold: r3(Q.hold),
          th: rel(Q.thT, Q.t0), thThrust: Q.thThrust ?? null, thLine: Q.thLine ?? null, thAi: Q.thAi ?? null, nullWhy: Q.nullWhy,
          resp: Q.resp ?? null, respT: rel(Q.respT, Q.t0), respAi: Q.respAi ?? null, respThrust: Q.respThrust ?? null, resps: Q.resps, noRead: rel(Q.noReadT, Q.t0),
          clash: rel(Q.clashT, Q.t0), clashN: Q.clashN, clashFresh: Q.clashFresh ?? null, clashJ: r3(Q.clashJ), clashVn: r3(Q.clashVn), clashTP: r3(Q.clashTP), clashTA: r3(Q.clashTA), clashAi: Q.clashAi ?? null, clashD: r3(Q.clashD), clashTap: Q.clashTap ?? null,
          body: rel(Q.bodyT, Q.t0), bodyN: Q.bodyN, bodyType: Q.bodyType ?? null, bodyZone: Q.bodyZone ?? null, bodyPart: Q.bodyPart ?? null, bodyAlongT: r3(Q.bodyAlongT), bodyAlign: r3(Q.bodyAlign), bodySpeed: r3(Q.bodySpeed), bodyE: r3(Q.bodyE), bodyEff: r3(Q.bodyEff), bodyThr: r3(Q.bodyThr), bodySev: r3(Q.bodySev), bodyAi: Q.bodyAi ?? null, bodyD: r3(Q.bodyD), bodyTap: Q.bodyTap ?? null, bodyIt: Q.bodyIt ?? null, bodyGap: r3(Q.bodyGap), hits: Q.hits,
        };
      });
    },
  };
}

// ── 묶음 · 표 ──
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const q = (a, p) => {
  const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const f2 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
/** 기술 갈래: 찌르기(탭 · 강화 탭) · 긋기 · 그 밖 */
export const kindOf = (p) => (p.cls === 'tap' ? 'thrust' : p.cls === 'swing' ? 'cut' : p.cls);
const RESP = ['none', 'defending', 'noRead', 'striking', 'noGuard', 'void', 'parry', 'counter', 'passiveAtk', 'other'];
/** 첫 몸 닿음 · 칼끼리 닿음 전에 AI 가 한 첫 반응 (그 뒤 반응은 늦음 — 'none') */
export function respBefore(p) {
  const tc = Math.min(p.body ?? Infinity, p.clash ?? Infinity);
  if (p.resp && p.respT != null && p.respT <= tc + 1e-9) return RESP.includes(p.resp) ? p.resp : 'other';
  if (p.noRead != null && p.noRead <= tc + 1e-9) return 'noRead';
  if (p.th != null && p.th <= tc + 1e-9 && p.thAi?.mode === 'attack' && (p.thAi.phase === 'strike' || p.thAi.phase === 'follow')) return 'striking';
  if (p.ai0?.mode === 'defend') return 'defending'; // 낸 때 이미 막는 꼴 (앞 공격과 같은 위협 번호 — 새로 판단 안 함)
  return 'none';
}
export function probeRows(runs, by = 'name') {
  const all = runs.flatMap((r) => (r.probe ?? []).filter(Boolean).map((p) => ({ ...p, cell: `${r.school}:${r.weapon}:${r.opp}` })));
  const key = by === 'kind' ? kindOf : by === 'cls' ? (p) => p.cls : (p) => p.name;
  const g = {};
  for (const p of all) (g[key(p)] ??= []).push(p);
  return Object.entries(g).map(([k, ps]) => {
    const n = ps.length;
    const cnt = (f) => ps.filter(f).length;
    const tc = (p) => Math.min(p.body ?? Infinity, p.clash ?? Infinity);
    const contacted = ps.filter((p) => Number.isFinite(tc(p)));
    const rb = {};
    for (const p of ps) rb[respBefore(p)] = (rb[respBefore(p)] ?? 0) + 1;
    const hitBy = {};
    for (const p of ps) {
      const b = respBefore(p);
      (hitBy[b] ??= [0, 0])[1]++;
      if (p.out === 'hit' || p.out === 'hitAfterClash') hitBy[b][0]++;
    }
    const thSeen = ps.filter((p) => p.th != null && p.th <= tc(p) + 1e-9);
    const nw = {};
    for (const p of ps.filter((x) => x.th == null || x.th > tc(x))) for (const [w, c] of Object.entries(p.nullWhy ?? {})) if (c > 0) nw[w] = (nw[w] ?? 0) + 1;
    return {
      key: k, n,
      hit: cnt((p) => p.out === 'hit'), hitAfterClash: cnt((p) => p.out === 'hitAfterClash'), touch: cnt((p) => p.out === 'touch'), blocked: cnt((p) => p.out === 'blocked'), whiff: cnt((p) => p.out === 'whiff'),
      thSeen: thSeen.length, thAsThrust: thSeen.filter((p) => p.thThrust).length, nullWhy: nw, rb, hitBy,
      tFast: q(ps.map((p) => p.fast), 0.5), tTh: q(thSeen.map((p) => p.th), 0.5), tResp: q(ps.filter((p) => respBefore(p) === p.resp).map((p) => p.respT), 0.5),
      tBody: q(ps.map((p) => p.body), 0.5), tClash: q(ps.map((p) => p.clash), 0.5), tContact: q(contacted.map(tc), 0.5), tContact25: q(contacted.map(tc), 0.25), tContact75: q(contacted.map(tc), 0.75),
      d0: q(ps.map((p) => p.d0), 0.5), gap0: q(ps.map((p) => p.gap0), 0.5), gapMin: q(ps.map((p) => p.gapMin), 0.5), tipMax: q(ps.map((p) => p.tipMax), 0.5), aiBack: q(ps.map((p) => p.aiBack), 0.5),
      bodyStab: cnt((p) => p.bodyType === 'stab'), bodyCut: cnt((p) => p.bodyType === 'cut'), bodyBlunt: cnt((p) => p.bodyType === 'blunt'), bodyN: cnt((p) => p.bodyType != null),
      bodySpeed: q(ps.map((p) => p.bodySpeed), 0.5), bodyAlongT: q(ps.map((p) => p.bodyAlongT), 0.5), bodyAlign: q(ps.map((p) => p.bodyAlign), 0.5),
      clashTP: q(ps.map((p) => p.clashTP), 0.5), clashTA: q(ps.map((p) => p.clashTA), 0.5), clashJ: q(ps.map((p) => p.clashJ), 0.5),
      aiDefAtBody: cnt((p) => p.bodyAi?.mode === 'defend'), aiVoidAtBody: cnt((p) => p.bodyAi?.mode === 'defend' && p.bodyAi.void), aiAtkAtBody: cnt((p) => p.bodyAi?.mode === 'attack'),
      zones: ps.reduce((o, p) => (p.bodyZone ? ((o[p.bodyZone] = (o[p.bodyZone] ?? 0) + 1), o) : o), {}),
    };
  }).sort((a, b) => b.n - a.n);
}
export function probeMarkdown(runs, by = 'name') {
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = [];
  out.push('| 칸 | 판 | 이김 | 짐 | 비김 | 준 심각도/판 | 받은 심각도/판 |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [k, rs] of Object.entries(cells)) {
    const c = cellRow(rs);
    out.push(`| ${k} | ${c.n} | ${c.win} | ${c.lose} | ${c.n - c.win - c.lose} | ${f2(c.dealt)} | ${f2(c.recv)} |`);
  }
  for (const [k, rs] of Object.entries(cells)) {
    const rows = probeRows(rs, by);
    out.push('', `### ${k} — 결과 · 때 (실제 s · 가운데 값)`, '', '| 기술 | 낸 수 | 맞음 | 칼 닿은 뒤 맞음 | 몸 닿음만 | 막힘 | 헛침 | 칼끝 3.5 m/s | AI 위협 읽음 (찌르기로) | 읽은 때 | 첫 닿음 (25 · 50 · 75 %) | 낸 거리 | 칼끝 → 가슴 (낸 때 · 가장 가까움) | 칼끝 가장 빠름 | AI 물러남 m/s (0.2 s) |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const t of rows) out.push(`| ${t.key} | ${t.n} | ${pct(t.hit, t.n)} | ${pct(t.hitAfterClash, t.n)} | ${pct(t.touch, t.n)} | ${pct(t.blocked, t.n)} | ${pct(t.whiff, t.n)} | ${f2(t.tFast)} | ${pct(t.thSeen, t.n)} (${pct(t.thAsThrust, t.thSeen)}) | ${f2(t.tTh)} | ${f2(t.tContact25)} · ${f2(t.tContact)} · ${f2(t.tContact75)} | ${f2(t.d0)} | ${f2(t.gap0)} · ${f2(t.gapMin)} | ${f2(t.tipMax, 1)} | ${f2(t.aiBack)} |`);
    out.push('', `### ${k} — 닿기 전 AI 첫 반응 (몫 · 그 반응일 때 맞음)`, '', `| 기술 | ${RESP.join(' | ')} | 못 읽은 까닭 (멂 · 느림 · 길 밖) |`, `|---|${RESP.map(() => '---:').join('|')}|---|`);
    for (const t of rows) out.push(`| ${t.key} | ${RESP.map((b) => (t.rb[b] ? `${pct(t.rb[b], t.n)} (${pct(t.hitBy[b][0], t.hitBy[b][1])})` : '–')).join(' | ')} | ${['far', 'slow', 'geom'].map((w) => t.nullWhy[w] ?? 0).join(' · ')} |`);
    out.push('', `### ${k} — 닿음 꼴`, '', '| 기술 | 몸 닿음 (찌르기 · 베기 · 둔타) | 몸 닿음 빠르기 | 칼날 자리 | 칼 축 맞음 | 칼끼리 닿음: 내 칼 자리 · 상대 칼 자리 · 충격량 | 몸 닿을 때 AI 막기 꼴 (그 가운데 물러나기) · 공격 꼴 | 부위 |', '|---|---:|---:|---:|---:|---:|---:|---|');
    for (const t of rows) out.push(`| ${t.key} | ${t.bodyN} (${t.bodyStab} · ${t.bodyCut} · ${t.bodyBlunt}) | ${f2(t.bodySpeed, 1)} | ${f2(t.bodyAlongT)} | ${f2(t.bodyAlign)} | ${f2(t.clashTP)} · ${f2(t.clashTA)} · ${f2(t.clashJ)} | ${t.aiDefAtBody} (${t.aiVoidAtBody}) · ${t.aiAtkAtBody} | ${Object.entries(t.zones).sort((a, b) => b[1] - a[1]).map(([z, c]) => `${z} ${c}`).join(' · ')} |`);
  }
  return out.join('\n');
}

/** --set=A.b=1,C.d=x — 이 프로세스 안에서만 (school_balance applySets 와 같은 꼴 · 점 길 끝이 배열 칸이어도 됨) */
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(probeMarkdown(runs, arg('by', 'name')));
  } else {
    applySets(arg('set', ''));
    // --ts=rapier.window=0,estoc.reach=0 — 찌르기 무기 장점(weapons.js THRUST_STYLE)을 이 프로세스 안에서만 (무기 명세가 같은 객체를 쥠)
    for (const kv of arg('ts', '').split(',').filter(Boolean)) {
      const [path, v] = kv.split('=');
      const [w, k] = path.split('.');
      THRUST_STYLE[w][k] = +v;
    }
    const cells = arg('cells', 'italian:rapier:longsword').split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = fightOne({ school, weapon, opp, seed, dur: +arg('dur', 30), tech: +arg('tech', 0.35), secret: arg('secret', '1') !== '0', drop: arg('drop', '').split(',').filter(Boolean), probe: makeProbe(), attrib: arg('attrib', 'new') }); // attrib old = 11/04 기술 기록 셈 (school_balance · step_input 기록 §1)
        runs.push(r);
        console.error(JSON.stringify({ c, seed, win: r.win, lose: r.lose, T: r.T, dealt: r.dealt, recv: r.recv, fires: r.fires.length, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set: arg('set', ''), ts: arg('ts', ''), cells, seeds, runs }));
    console.log(probeMarkdown(runs, arg('by', 'name')));
  }
}
