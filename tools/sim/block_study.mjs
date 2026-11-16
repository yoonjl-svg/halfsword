// ─────────────────────────────────────────────────────────────
//  block_study.mjs — 막기가 왜 안 남는가 (11/17 조사 · 게임 값은 건드리지 않음 — AI 메서드를 인스턴스에서만 감싸 읽는다)
//  숙련 4 거울(높음 · 칸 같음) · 유파 다섯 × 무기 둘 × 씨앗 × 자리 둘 · 60 s · 한쪽이 죽으면 끝.
//  판마다 '공격 한 번(공격 에피소드 = 공격자 ai.startAttack 이 참을 돌려준 때 ~ 공격자 mode 가 attack 을 떠난 때 + 0.5 s)' 에 일어난 일을 모은다:
//   위협 읽힘(threat) · 반응 굴림(respond — 굴림 통과 여부 · 맞받기 / 물러나 피하기 / 막기) · 칼끼리 닿음(onClash) · 상처(onWound)
//  node tools/sim/block_study.mjs run --seeds=1-3 [--shard=i/n] [--out=path.json] [--dur=60]
//  node tools/sim/block_study.mjs agg a.json b.json …          (표 · 시간 줄)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, DT } from './harness_m.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { bladesTouch } from '../../src/secret.js';
import { isMain } from './is_main.mjs';

const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const TAIL = 0.5; // 공격이 끝난 뒤에도 이 초 안의 칼 닿음 · 상처는 그 공격 몫
const out = (f) => !f.alive || f.state === 'dead';

export function studyFight({ school, weapon, wi, seed, swap, dur = 60, keepLog = false, persona, persona2, wrapSetup, fixThreat = '' }) {
  const pX = persona ?? { proficiency: 4 }, pY = persona2 ?? { proficiency: 4 };
  const G = newRound({ seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: AI, difficulty: 'hard', difficulty2: 'hard', persona: pX, persona2: pY });
  if (wrapSetup) wrapSetup(G);
  const P = G.player, E = G.enemy;
  const aiOf = new Map([[E, G.ai], [P, G.ai2]]);
  const foeOf = (f) => (f === P ? E : P);
  const nm = (f) => (f === P ? 'P' : 'E');
  const eps = []; // 공격 에피소드
  const openEp = new Map([[P, null], [E, null]]);
  const lastEp = new Map([[P, null], [E, null]]);
  const resp = []; // 반응 굴림 기록
  const clashes = [], wounds = [], atkStarts = [];
  const lastAtkEnd = new Map([[P, -9], [E, -9]]);
  const log = [];
  const readFail = new Set();

  const epOf = (att, t) => { // att 의 공격 에피소드 가운데 지금(t)이 창 안인 것
    const e = lastEp.get(att);
    if (!e) return null;
    return e.tEnd == null || t <= e.tEnd + TAIL ? e : null;
  };
  // 칼 닿음 · 상처의 몫: 새 공격이 막 시작했거나(0.1 s 안) 이어치기면 아직 앞 공격의 칼이 닿은 것 (칼은 시작 뒤 0.1 s 넘게 걸려 닿는다)
  const epOfEv = (att, t) => {
    const e = epOf(att, t);
    if (e && e.prev && (e.chain || t - e.t0 < 0.1) && (e.prev.tEnd == null || t <= e.prev.tEnd + TAIL)) return e.prev;
    return e;
  };
  const handDist = (f) => { // 막는 자리까지 손 거리
    const ai = aiOf.get(f);
    const p = ai.school.parry[ai.defLine] || ai.school.pose.point;
    return Math.hypot(f.handOffset.x - p[0], f.handOffset.y - p[1]);
  };

  for (const f of [P, E]) {
    const ai = aiOf.get(f);
    const foe = foeOf(f);
    const oSA = ai.startAttack.bind(ai);
    ai.startAttack = (tech, why, opt = {}) => {
      const r = oSA(tech, why, opt);
      if (r) {
        const prev = lastEp.get(f);
        const chain = !!opt.chain;
        // 이어 치기(chain)도 새 에피소드로 센다 (칼이 따로 나감)
        const e = { prev, id: eps.length, att: nm(f), def: nm(foe), t0: G.t, tEnd: null, tech: tech?.name, why, secret: !!(opt.secret), passive: !!opt.passive, chain, detected: null, resp: null, clashes: [], wounds: [], defMode0: aiOf.get(foe).mode, defPhase0: aiOf.get(foe).phase };
        eps.push(e);
        if (prev && prev.tEnd == null) prev.tEnd = G.t;
        openEp.set(f, e);
        lastEp.set(f, e);
        if (fixThreat.includes(nm(foe))) aiOf.get(foe).threatId++; // A/B (도구 안에서만 · src 기본 그대로): 새 공격마다 새 위협 번호 — 앞 공격과 한 위협으로 묶이지 않게
        atkStarts.push({ t: G.t, att: nm(f), why, tech: tech?.name });
      }
      return r;
    };
    const oTh = ai.threat.bind(ai);
    ai.threat = (...a) => {
      const th = oTh(...a);
      if (th) {
        const e = epOf(foe, G.t);
        if (e && e.detected == null) e.detected = { t: G.t, line: th.line, thrust: th.thrust, defMode: ai.mode, defPhase: ai.phase, id: th.id, seen: th.id === ai.threatSeen };
        ai._thLast = th;
      }
      return th;
    };
    const oNo = ai.noticedThreat.bind(ai);
    ai.noticedThreat = (th) => { const r = oNo(th); if (!r) readFail.add(nm(f) + th.id); return r; };
    const oRe = ai.respond.bind(ai);
    ai.respond = (th, d) => {
      const before = ai.threatSeen;
      const c0 = ai.stats.counters;
      const modeBefore = ai.mode;
      const r = oRe(th, d);
      if (before !== th.id && ai.threatSeen === th.id) {
        let branch;
        if (!r) branch = 'rollfail';
        else if (ai.mode === 'attack' || ai.stats.counters > c0) branch = 'counter';
        else if (ai.defVoid) branch = 'void';
        else if (ai.mode === 'defend') branch = 'parry';
        else branch = 'other:' + ai.mode;
        const e = epOf(foe, G.t);
        const rec = { hd0: handDist(f), t: G.t, id: th.id, def: nm(f), att: nm(foe), branch, line: th.line, thrust: th.thrust, ep: e ? e.id : -1, modeBefore, dist: d };
        resp.push(rec);
        if (e && !e.resp) e.resp = rec;
      }
      return r;
    };
  }
  G.combat.hooks.onClash = (point, sp, info) => {
    G.clashes++;
    const ev = { t: G.t, fresh: !!info.fresh, vn: info.vn, vt: info.vt, force: info.force, a: nm(info.a), b: nm(info.b) };
    clashes.push(ev);
    for (const att of [P, E]) {
      const e = epOfEv(att, G.t);
      if (e) e.clashes.push({ t: G.t, fresh: ev.fresh, vn: info.vn, hd: handDist(foeOf(att)), defMode: aiOf.get(foeOf(att)).mode });
    }
  };
  G.onWound = (att, vic, r) => {
    if (!(r.severity > 0)) return;
    const ai = aiOf.get(vic), aiA = aiOf.get(att);
    const e = epOfEv(att, G.t);
    const w = {
      t: G.t, att: nm(att), vic: nm(vic), zone: r.zone, type: r.type, sev: r.severity, energy: r.energy, ep: e ? e.id : -1,
      vMode: ai.mode, vPhase: ai.phase, vVoid: !!ai.defVoid, vState: vic.state, sinceAtkEnd: G.t - lastAtkEnd.get(vic), vAtkOpen: !!(openEp.get(vic)),
      aMode: aiA.mode, aSecret: aiA.mode === 'secret' || !!(e && e.secret), tech: e ? e.tech : null, hd: handDist(vic), vLine: ai.defLine,
      epAge: e ? G.t - e.t0 : null, nClashBefore: e ? e.clashes.length : 0, lastClashAge: e && e.clashes.length ? G.t - e.clashes[e.clashes.length - 1].t : null,
      resp: e && e.resp ? e.resp.branch : null, detected: e ? e.detected != null : null,
    };
    wounds.push(w);
    if (e) e.wounds.push(w);
  };
  // 매 스텝 관측 (공격 에피소드 끝 · 기록)
  let sampleT = 0;
  const samples = []; // 기준 — 0.5 s 마다 그 뒤 1 s 안에 상처가 났나를 위해 시각만
  while (G.t < dur && !out(P) && !out(E)) {
    G.step();
    for (const f of [P, E]) {
      const ai = aiOf.get(f);
      const e = openEp.get(f);
      if (e && ai.mode !== 'attack') {
        // 비기(secret) 모드도 공격으로 본다 — secret 이면 닫지 않음
        if (ai.mode !== 'secret') {
          e.tEnd = G.t;
          openEp.set(f, null);
          lastAtkEnd.set(f, G.t);
        }
      }
    }
    if (G.t >= sampleT) { samples.push(G.t); sampleT += 0.5; }
    if (keepLog) {
      const A = aiOf.get(P), B = aiOf.get(E);
      const tipP = P.bladePoint(1), tipE = E.bladePoint(1);
      log.push({ t: G.t, tipD: tipP.distanceTo(tipE), touch: bladesTouch(P, E), P: { m: A.mode, ph: A.phase, v: A.defVoid ? 1 : 0, hd: handDist(P), st: P.state, ln: A.defLine }, E: { m: B.mode, ph: B.phase, v: B.defVoid ? 1 : 0, hd: handDist(E), st: E.state, ln: B.defLine } });
    }
  }
  for (const e of eps) if (e.detected) e.detected.readFail = readFail.has(e.def + e.detected.id);
  const res = out(P) && !out(E) ? 'E' : out(E) && !out(P) ? 'P' : 'd';
  for (const e of eps) delete e.prev;
  const rec = { school, weapon, seed, swap, res, endT: G.t, eps, resp, clashes, wounds, atkStarts, samples, stats: { P: aiOf.get(P).stats, E: aiOf.get(E).stats } };
  if (keepLog) rec.log = log;
  G.world.free();
  return rec;
}

// ───────── 모으기 ─────────
const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '-');
const ko = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };

export function aggregate(recs) {
  const O = [];
  const W = (s = '') => O.push(s);
  const nF = recs.length;
  const epsAll = recs.flatMap((r) => r.eps.map((e) => ({ ...e, school: r.school, fight: r })));
  // 1) 깔때기 — 사슬(chain) 아닌 새 공격만 / 전체 둘 다
  const funnel = (rows, title) => {
    const n = rows.length;
    const det = rows.filter((e) => e.detected);
    const rsp = rows.filter((e) => e.resp);
    const cnt = rows.filter((e) => e.resp?.branch === 'counter');
    const vd = rows.filter((e) => e.resp?.branch === 'void');
    const pr = rows.filter((e) => e.resp?.branch === 'parry');
    const rf = rows.filter((e) => e.resp?.branch === 'rollfail');
    const oth = rows.filter((e) => e.resp && !['counter', 'void', 'parry', 'rollfail'].includes(e.resp.branch));
    const noResp = rows.filter((e) => !e.resp);
    const wounded = (r) => r.filter((e) => e.wounds.length > 0);
    const contact = (r) => r.filter((e) => e.clashes.length > 0);
    const intime = (r) => r.filter((e) => e.clashes.length > 0 && (e.wounds.length === 0 || e.clashes[0].t <= e.wounds[0].t));
    const rowOf = (name, r) => `| ${name} | ${r.length} | ${pc(r.length, n)} | ${pc(contact(r).length, r.length)} | ${pc(intime(r).length, r.length)} | ${pc(wounded(r).length, r.length)} | ${pc(contact(r).filter((e) => e.wounds.length > 0).length, contact(r).length)} |`;
    W(`### ${title}`);
    W();
    W(`| 단계 | 수 | 전체 대비 | 칼 닿음 | 닿고 나서야 상처 (제때) | 상처 | 닿은 것 중 상처 |`);
    W('|---|---|---|---|---|---|---|');
    W(rowOf('공격 (시작한 것)', rows));
    W(rowOf('· 막는 쪽이 위협으로 읽음 (threat)', det));
    W(rowOf('· 반응 굴림까지 감 (respond 첫 호출)', rsp));
    W(rowOf('  · 굴림 탈락 (guardChance)', rf));
    W(rowOf('  · 맞받아 베기 (Indes)', cnt));
    W(rowOf('  · 물러나 피하기', vd));
    W(rowOf('  · 칼로 막기', pr));
    if (oth.length) W(rowOf('  · 그 밖', oth));
    W(rowOf('· 반응 굴림에 안 닿음 (읽기 실패 · 바쁨)', noResp));
    W();
  };
  funnel(epsAll.filter((e) => !e.chain), `깔때기 (새 공격만, 이어치기 제외) — 판 ${nF}`);
  funnel(epsAll, `깔때기 (이어치기 포함)`);
  // 읽기 실패 쪽 사정
  {
    const nd = epsAll.filter((e) => !e.chain && !e.detected);
    const ndMode = {};
    for (const e of nd) ndMode[`${e.defMode0}/${e.defPhase0}`] = (ndMode[`${e.defMode0}/${e.defPhase0}`] ?? 0) + 1;
    W(`#### 위협으로 못 읽은 공격(${nd.length}) 시작 때 막는 쪽 상태`);
    W();
    W('| 막는 쪽 mode/phase | 수 |'); W('|---|---|');
    for (const [k, v] of Object.entries(ndMode).sort((a, b) => b[1] - a[1]).slice(0, 8)) W(`| ${k} | ${v} |`);
    W();
    const ds = epsAll.filter((e) => !e.chain && e.detected && !e.resp);
    const dm = {};
    for (const e of ds) dm[`${e.detected.defMode}/${e.detected.defPhase}`] = (dm[`${e.detected.defMode}/${e.detected.defPhase}`] ?? 0) + 1;
    const why = {};
    for (const e of ds) { const k = e.detected.seen ? '같은 위협 번호를 이미 답함 (앞 공격과 한 위협으로 묶임)' : e.detected.readFail ? '읽기 굴림(read) 탈락' : ['attack', 'secret'].includes(e.detected.defMode) && ['strike', 'follow'].includes(e.detected.defPhase) ? '막는 쪽이 휘두르는 중·마무리 (반응 길 없음)' : `그 밖 (${e.detected.defMode}/${e.detected.defPhase})`; why[k] = (why[k] ?? 0) + 1; }
    W(`#### 읽혔는데 반응 굴림에 안 간 공격(${ds.length}) 이유`);
    W();
    W('| 이유 | 수 | 몫 |'); W('|---|---|---|');
    for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1])) W(`| ${k} | ${v} | ${pc(v, ds.length)} |`);
    W();
    W(`#### 읽혔는데 반응 굴림에 안 간 공격(${ds.length}) 읽힌 때 막는 쪽 상태`);
    W();
    W('| 막는 쪽 mode/phase | 수 |'); W('|---|---|');
    for (const [k, v] of Object.entries(dm).sort((a, b) => b[1] - a[1]).slice(0, 8)) W(`| ${k} | ${v} |`);
    W();
  }
  // 칼 닿음의 위치 — 제때? 손 거리
  {
    const cl = epsAll.filter((e) => !e.chain && e.resp?.branch === 'parry' && e.clashes.length);
    const hd = cl.map((e) => e.clashes[0].hd).sort((a, b) => a - b);
    const q = (p) => hd[Math.floor(p * (hd.length - 1))]?.toFixed(3);
    W(`#### 막기(parry)로 굴린 공격 가운데 칼이 닿은 것(${cl.length}) — 첫 닿음 때 손에서 막는 자리까지 거리(패드 m): p25 ${q(0.25)} · 중앙 ${q(0.5)} · p75 ${q(0.75)}`);
    W();
    const pr = epsAll.filter((e) => !e.chain && e.resp?.branch === 'parry');
    const lead = pr.filter((e) => e.clashes.length).map((e) => e.clashes[0].t - e.resp.t).sort((a, b) => a - b);
    const lq = (p) => lead[Math.floor(p * (lead.length - 1))]?.toFixed(2);
    const h0 = pr.map((e) => e.resp.hd0).sort((a, b) => a - b);
    const hq = (p) => h0[Math.floor(p * (h0.length - 1))]?.toFixed(2);
    W(`막기로 굴린 공격(${pr.length}) — 굴린 순간 손-막는 자리 거리 p25 ${hq(0.25)} · 중앙 ${hq(0.5)} · p75 ${hq(0.75)} m · 굴림에서 첫 닿음까지(닿은 ${lead.length}) p25 ${lq(0.25)} · 중앙 ${lq(0.5)} · p75 ${lq(0.75)} s`);
    W();
    const inPad = cl.filter((e) => e.clashes[0].hd <= 0.15).length;
    W(`첫 닿음 때 손이 막는 자리 패드(0.15 m) 안: ${inPad} / ${cl.length} = ${pc(inPad, cl.length)}`);
    W();
    const wnd = pr.filter((e) => e.wounds.length);
    const hdw = wnd.map((e) => e.wounds[0].hd).sort((a, b) => a - b);
    const q2 = (p) => hdw[Math.floor(p * (hdw.length - 1))]?.toFixed(3);
    W(`막기로 굴렸는데 첫 상처가 난 것(${wnd.length}) — 상처 때 손-막는 자리 거리: p25 ${q2(0.25)} · 중앙 ${q2(0.5)} · p75 ${q2(0.75)} (패드 반경 PARRY 0.15 가 '자리에 들어옴')`);
    W();
  }
  // 2) 상처 분류
  const wAll = recs.flatMap((r) => r.wounds.map((w) => ({ ...w, school: r.school })));
  const cls = (w) => {
    if (w.vState !== 'stand') return '넘어짐 · 일어나는 중';
    if (w.vMode === 'attack' || w.vMode === 'secret') return w.vPhase === 'follow' ? '내 공격 마무리(follow)' : '내 공격 중(준비 · 다가감 · 휘두름)';
    if (w.vMode === 'defend') {
      if (w.vVoid) return '물러나 피하는 중';
      return w.nClashBefore > 0 ? '막는 중 — 칼은 닿았음(뚫림 · 흘러내림 · 두 번째)' : '막는 중 — 칼 닿기 전(늦음)';
    }
    if (w.sinceAtkEnd < 0.8) return '내 공격 직후 0.8 s (회복 — 물러남 · 간 보기)';
    if (w.vMode === 'withdraw') return '물러나는 중';
    if (w.vMode === 'watch') return '간 보기 · 서 있음';
    return `그 밖 (${w.vMode})`;
  };
  const tab = (rows, keyf, title, head) => {
    const m = {};
    for (const r of rows) m[keyf(r)] = (m[keyf(r)] ?? 0) + 1;
    W(`### ${title}`);
    W();
    W(`| ${head} | 수 | 몫 |`); W('|---|---|---|');
    for (const [k, v] of Object.entries(m).sort((a, b) => b[1] - a[1])) W(`| ${k} | ${v} | ${pc(v, rows.length)} |`);
    W();
  };
  tab(wAll, cls, `상처 ${wAll.length} 개 — 맞은 순간 맞은 쪽이 하던 일`, '맞은 쪽 상태');
  tab(wAll.filter((w) => w.vState === 'stand'), cls, `상처 중 맞은 쪽이 서 있던 것 (${wAll.filter((w) => w.vState === 'stand').length} 개 — 넘어진 뒤 마무리 제외)`, '맞은 쪽 상태');
  {
    const first = recs.map((r) => r.wounds[0]).filter(Boolean);
    tab(first, cls, `판마다 첫 상처 ${first.length} 개 — 맞은 순간 맞은 쪽이 하던 일`, '맞은 쪽 상태');
    tab(first, (w) => (w.ep < 0 ? '공격 에피소드 밖' : w.resp ? `반응: ${w.resp}` : w.detected ? '읽었으나 굴림에 안 감' : '위협으로 못 읽음'), '판마다 첫 상처 — 막는 쪽 반응', '막는 쪽');
  }
  tab(wAll, (w) => (w.aSecret ? '비기 · 고유(secret)' : w.type === 'stab' ? '찌르기(stab)' : w.type === 'cut' ? '베기(cut)' : w.type), '상처 종류 (공격 쪽)', '종류');
  tab(wAll, (w) => (w.ep < 0 ? '공격 에피소드 밖(꼬리 0.5 s 넘음 · 몸 부딪침 등)' : w.resp ? `반응: ${w.resp}` : w.detected ? '읽었으나 굴림에 안 감' : '위협으로 못 읽음'), '상처가 난 공격에서 막는 쪽 반응', '막는 쪽');
  // 3) 반응별 0.6 s 안 상처
  {
    const wl = recs.map((r) => r.wounds);
    const rows = recs.flatMap((r, i) => r.resp.map((x) => ({ ...x, i })));
    const g = {};
    for (const x of rows) {
      const ws = recs[x.i].wounds;
      const after = ws.filter((w) => w.t >= x.t && w.t <= x.t + 0.6);
      const nxt = ws.find((w) => w.t >= x.t && w.t <= x.t + 1.5);
      const k = x.branch;
      const o = (g[k] ??= { n: 0, dW: 0, aW: 0, any: 0, nextD: 0, nextA: 0, none: 0, dDeath: 0 });
      o.n++;
      if (after.some((w) => w.vic === x.def)) o.dW++;
      if (after.some((w) => w.vic === x.att)) o.aW++;
      if (nxt) { if (nxt.vic === x.def) o.nextD++; else o.nextA++; } else o.none++;
    }
    W('### 반응별 결과 (반응을 정한 순간부터)');
    W();
    W('| 반응 | 수 | 막는 쪽이 0.6 s 안에 다침 | 공격 쪽이 0.6 s 안에 다침 | 다음 1.5 s 첫 상처: 막는 쪽 | 공격 쪽 | 없음 |');
    W('|---|---|---|---|---|---|---|');
    for (const [k, o] of Object.entries(g).sort((a, b) => b[1].n - a[1].n)) W(`| ${k} | ${o.n} | ${pc(o.dW, o.n)} | ${pc(o.aW, o.n)} | ${pc(o.nextD, o.n)} | ${pc(o.nextA, o.n)} | ${pc(o.none, o.n)} |`);
    W();
    // 기준선: 아무 때나 (0.5 s 격자) 1 s 안에 한쪽이 다칠 확률
    let tot = 0, hitAny = 0;
    for (const r of recs) for (const t of r.samples) { tot++; if (r.wounds.some((w) => w.t >= t && w.t < t + 1)) hitAny++; }
    W(`기준선: 판 안 아무 때나 잡은 1 s 창에서 두 쪽 중 누구든 다칠 확률 ${pc(hitAny, tot)} (0.6 s 창은 약 ${pc(hitAny * 0.6, tot)} 로 환산)`);
    W();
  }
  // 4) 막기 성공 뒤
  {
    const ok = epsAll.filter((e) => !e.chain && e.clashes.length && !e.wounds.length && e.resp?.branch === 'parry');
    const okV = epsAll.filter((e) => !e.chain && e.resp?.branch === 'void' && !e.wounds.length);
    const okC = epsAll.filter((e) => !e.chain && e.resp?.branch === 'counter' && e.clashes.length && !e.wounds.length);
    const post = (rows, label) => {
      let nA = 0, nD = 0, dAtk = 0, aAtk = 0, firstD = 0, firstA = 0, n = rows.length;
      const gaps = [];
      for (const e of rows) {
        const r = e.fight;
        const t0 = e.clashes.length ? e.clashes[0].t : e.resp.t;
        const win = (w) => w.t >= t0 && w.t <= t0 + 1.0;
        if (r.wounds.some((w) => win(w) && w.vic === e.att)) nA++;
        if (r.wounds.some((w) => win(w) && w.vic === e.def)) nD++;
        const ds = r.atkStarts.find((s) => s.t >= t0 && s.att === e.def && s.t <= t0 + 0.6);
        const as = r.atkStarts.find((s) => s.t >= t0 && s.att === e.att && s.t <= t0 + 0.6);
        if (ds) dAtk++;
        if (as) aAtk++;
        const nxt = r.wounds.find((w) => w.t >= t0 && w.t <= t0 + 1.5);
        if (nxt) { if (nxt.vic === e.att) firstA++; else firstD++; }
      }
      W(`| ${label} | ${n} | ${pc(nA, n)} | ${pc(nD, n)} | ${pc(dAtk, n)} | ${pc(aAtk, n)} | ${pc(firstA, n)} | ${pc(firstD, n)} |`);
    };
    W('### 막고(또는 피하고) 난 뒤 1 s — 막은 쪽에 무엇이 오나');
    W();
    W('| 성공한 반응 (그 공격에서 상처 없음) | 수 | 공격 쪽이 1 s 안에 다침 | 막은 쪽이 1 s 안에 다침 | 막은 쪽이 0.6 s 안에 새 공격 시작 | 공격 쪽이 0.6 s 안에 새 공격 시작 | 1.5 s 첫 상처: 공격 쪽 | 막은 쪽 |');
    W('|---|---|---|---|---|---|---|---|');
    post(ok, '칼로 막아 칼 닿고 무사');
    post(okC, '맞받아 베기가 칼 닿고 무사');
    post(okV, '물러나 피해 무사 (칼 닿음 무관)');
    W();
    // 막기 깔때기 (막기로 굴린 새 공격만): 굴림 뒤 닿음 → 막는 모드 · 손이 자리(0.15 m) 안에서 닿음 → 그 공격에서 상처 없음
    {
      const pr = epsAll.filter((e) => !e.chain && e.resp?.branch === 'parry');
      const woundBefore = pr.filter((e) => e.wounds.length && e.wounds[0].t <= e.resp.t);
      const aft = pr.map((e) => ({ e, c: e.clashes.find((c) => c.t >= e.resp.t) })).filter((x) => x.c);
      const solid = pr.map((e) => ({ e, c: e.clashes.find((c) => c.t >= e.resp.t && c.defMode === 'defend' && c.hd <= 0.15) })).filter((x) => x.c);
      const okS = solid.filter((x) => !x.e.wounds.length);
      const nAll = epsAll.filter((e) => !e.chain).length;
      W('### 막기 깔때기 (막기로 굴린 새 공격)');
      W();
      W('| 단계 | 수 | 막기 굴림 대비 | 전체 공격(' + nAll + ') 대비 |'); W('|---|---|---|---|');
      const row = (n, a) => W(`| ${n} | ${a} | ${pc(a, pr.length)} | ${pc(a, nAll)} |`);
      row('막기로 굴림', pr.length);
      row('굴림 앞에 이미 상처 (늦음)', woundBefore.length);
      row('굴림 뒤 칼끼리 닿음 (어느 손 · 어느 모드든)', aft.length);
      row('굴림 뒤 닿음, 막는 모드 + 손이 자리 0.15 m 안 (제대로 막음)', solid.length);
      row('· 그 가운데 그 공격에서 끝까지 무상처', okS.length);
      W();
      W(`제대로 막은 ${solid.length} 중 무상처 ${pc(okS.length, solid.length)} — 막는 힘 자체는 있다`);
      W();
    }
    // 칼 닿고 나서 공격 쪽이 에피소드를 얼마나 더 끌었나
    const gap = ok.map((e) => (e.tEnd ?? e.t0) - e.clashes[0].t).filter((x) => x >= 0).sort((a, b) => a - b);
    W(`막기 성공(${ok.length}) — 첫 닿음에서 공격 쪽 공격이 끝나기까지(mode 가 attack 을 떠남): 중앙 ${gap[Math.floor(gap.length / 2)]?.toFixed(2)} s · p25 ${gap[Math.floor(gap.length * 0.25)]?.toFixed(2)} · p75 ${gap[Math.floor(gap.length * 0.75)]?.toFixed(2)}`);
    W();
  }
  // 시간 줄 후보: 막기로 굴렸고 칼이 닿았는데 같은 공격에서 상처가 난 것 (닿은 뒤 상처 · 닿기 전 상처 갈래)
  {
    const cand = epsAll.filter((e) => e.resp?.branch === 'parry' && e.clashes.length && e.wounds.length);
    W(`### 시간 줄 후보 — 막기 굴림 + 칼 닿음 + 같은 공격 상처 (${cand.length})`);
    W();
    const byGap = (e) => (e.wounds[0].t - e.clashes[0].t);
    W('| 갈래 | 수 |'); W('|---|---|');
    W(`| 상처가 첫 닿음보다 먼저 (닿기 전에 맞음) | ${cand.filter((e) => byGap(e) < 0).length} |`);
    W(`| 첫 닿음 뒤 0.1 s 안 상처 (닿자마자 뚫림 · 미끄러짐) | ${cand.filter((e) => byGap(e) >= 0 && byGap(e) < 0.1).length} |`);
    W(`| 첫 닿음 뒤 0.1 ~ 0.3 s | ${cand.filter((e) => byGap(e) >= 0.1 && byGap(e) < 0.3).length} |`);
    W(`| 첫 닿음 뒤 0.3 s 넘어 | ${cand.filter((e) => byGap(e) >= 0.3).length} |`);
    W();
    W('후보 (판 · 에피소드): ' + cand.slice(0, 12).map((e) => `${e.fight.school}/${e.fight.weapon}/seed${e.fight.seed}/swap${e.fight.swap ? 1 : 0}#${e.id}(${byGap(e).toFixed(2)})`).join(' · '));
    W();
  }
  return O.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args[0];
  const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'tl') { // tl school wi seed swap epId — 한 판을 다시 돌려 그 공격 둘레 0.05 s 줄 (같은 씨앗 = 같은 판)
    const [school, wi, seed, swap, epId, from, to] = args.slice(1);
    const r = studyFight({ school, weapon: WEAPONS[school][+wi], wi: +wi, seed: +seed, swap: swap === '1', keepLog: true });
    const e = r.eps[+epId];
    const w0 = e.wounds[0]?.t ?? e.t0 + 0.6;
    const f2 = (x) => (x == null ? '-' : x.toFixed(2));
    console.log(`공격 ${e.att}→${e.def} ${e.tech}(${e.why}${e.chain ? ' 이어치기' : ''}) 시작 ${f2(e.t0)} 끝 ${f2(e.tEnd)} · 위협 읽음 ${f2(e.detected?.t)} ${e.detected ? e.detected.line + (e.detected.thrust ? ' 찌르기' : '') : ''} · 반응 ${e.resp ? `${e.resp.branch} ${f2(e.resp.t)} 줄=${e.resp.line} 손거리=${f2(e.resp.hd0)}` : '없음'}`);
    console.log('  닿음: ' + (e.clashes.map((c) => `${f2(c.t)}(손거리 ${f2(c.hd)} ${c.defMode})`).join(' ') || '없음'));
    console.log('  상처: ' + (e.wounds.map((w) => `${f2(w.t)} ${w.zone} ${w.type} 맞은쪽 ${w.vMode}/${w.vPhase}${w.vVoid ? '/피하기' : ''} 손거리 ${f2(w.hd)}`).join(' | ') || '없음'));
    const lo = from != null ? +from : e.t0 - 0.15, hi = to != null ? +to : w0 + 0.25;
    let last = -1;
    for (const l of r.log) if (l.t >= lo && l.t <= hi && l.t - last >= 0.049) { last = l.t; console.log(`${l.t.toFixed(2)} tipD=${l.tipD.toFixed(2)} touch=${l.touch ? 1 : 0} P=${l.P.m}/${l.P.ph}${l.P.v ? '/void' : ''} hd=${l.P.hd.toFixed(2)} ${l.P.st} | E=${l.E.m}/${l.E.ph}${l.E.v ? '/void' : ''} hd=${l.E.hd.toFixed(2)} ${l.E.st}`); }
  } else if (mode === 'agg') {
    const recs = args.slice(1).filter((x) => !x.startsWith('--')).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
    console.log(aggregate(recs));
  } else {
    const [s0, s1] = arg('seeds', '1-1').split('-').map(Number);
    const [si, sn] = arg('shard', '1/1').split('/').map(Number);
    const list = [];
    for (const school of SCHOOLS) WEAPONS[school].forEach((weapon, wi) => { for (let seed = s0; seed <= (s1 ?? s0); seed++) for (const swap of [false, true]) list.push({ school, weapon, wi, seed, swap }); });
    const mine = list.filter((_, i) => i % sn === si - 1);
    const recs = mine.map((f) => studyFight({ ...f, dur: +arg('dur', 60), keepLog: args.includes('--log'), fixThreat: arg('fix', '') }));
    writeFileSync(arg('out', 'block_study.json'), JSON.stringify(recs));
    console.error(`done ${recs.length} fights`);
  }
}
