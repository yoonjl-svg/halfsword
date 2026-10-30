// ─────────────────────────────────────────────────────────────
//  redondo_trace.mjs — 풍차 베기(B4 레돈두) 칼끝 길 재기 (사장님 10/30 00:1x '근데 궤적이 8자 모양으로 현란해 보이는데. 바로 내려치는 게 아닌가?' · docs/strike/redondo_hold_2026-10-29.md §8-9)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 으로 바꿔 견줌). 사람 몸(0 번)이 서서 탭을 끌지 않고 길게 누름 → 감기 → 감기 시작부터 release 초 뒤 뗌 → 내려침 → after 초.
//   상대는 그 무기 닿는 거리 가운데(MEASURED 맞닿기 ~ 닿음 사이)에 가만히 (AI 끔 · 상처 안 받음 — 몸이 쓰러지지 않게).
//   스텝마다 칼끝 · 손(칼 원점)을 몸 틀(가슴 원점 · 지금 몸 방향 — x 앞 · y 위 · z 칼 든 쪽 +)로 적고 그 때의 몫(blend 섞기 · wind 감기 · lead 드는 이음 · cut 벰 · after 뒤)을 붙인다.
//   8 자 재기 (위에서 본 x–z · 뒤에서 본 z–y): 감기 마지막 한 바퀴의 도는 쪽(σ)에 대해 뗀 뒤 길(lead + cut)이 거꾸로 돈 각(°) · 뗀 뒤 길이 감기 원을 가로지른 수 · 칼끝 길이(m)
//   사용법: node tools/sim/redondo_trace.mjs [--ws=zweihander] [--release=1.6,1.9,2.2,2.5] [--after=0.5] [--set=UNIQUE_ASSIST.rdRelease="chamber";…] [--json=.tmp/파일]
//    --release 를 여럿 주면 원 위 여러 자리에서 뗌 (안 A 한 바퀴 실제 1.2 s — 0.3 s 씩이면 네 자리)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
const r3 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(3));

/** 한 판: 몫이 붙은 몸 틀 칼끝 · 손 점들 */
export function traceRun({ w = 'zweihander', seed = 1, press = 3.0, release = 1.6, after = 0.5, gap = null } = {}) {
  const [C, R] = MEASURED[w] ?? MEASURED.longsword;
  const G = newRound({ walls: true, seed, weapon: w, weapon2: 'longsword', persona: { proficiency: 4 }, gap: gap ?? (C + R) / 2 });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  if (!uq.holdE) throw new Error('풍차 베기가 열리지 않음');
  const relG = CONFIG.realS(release);
  const aftG = CONFIG.realS(after);
  const rec = { w, seed, release, pts: [], tRel: null, tCut: null, tEnd: null, turns: null, fell: false };
  let down = false;
  let tWind = null;
  let tRel = null;
  let tEnd = null;
  G.before = () => {
    const t = G.t;
    P.move.set(0, 0);
    P.stickX = 0;
    P.stickY = 0;
    if (t >= press && tRel == null) down = true;
    if (tWind == null && uq.winding) tWind = t;
    if (tWind != null && tRel == null && t - tWind >= relG) {
      tRel = t;
      down = false;
      rec.turns = r3(P.rdWind?.turns ?? 0);
    }
    uq.holdInput(down, true, false);
    P.handHeld = t >= press && tRel == null; // 손가락이 닿아 있음 (게임 main.js handHeld — redondo_sway 'press' 와 같음)
  };
  const s = P.side >= 0 ? 1 : -1;
  try {
    while (P.alive && G.t < press + 10) {
      G.step();
      const t = G.t;
      const W = P.rdWind;
      const I = P.iai?.moves?.[0]?.rd ? P.iai : null;
      let ph = null;
      if (W) ph = W.k < 1 ? 'blend' : 'wind';
      else if (I) ph = I.segs?.[I.si]?.cut ? 'cut' : 'lead';
      else if (tRel != null) {
        tEnd ??= t;
        if (t - tEnd > aftG) break;
        ph = 'after';
      }
      if (P.state !== 'stand') rec.fell = true;
      if (!ph) continue;
      if (ph === 'cut' && rec.tCut == null) rec.tCut = r3((t - tRel) / CONFIG.TIME.k);
      const inv = P.yaw.clone().invert();
      const c = P.bodies.chest.translation();
      const loc = (p) => {
        const v = new THREE.Vector3(p.x - c.x, p.y - c.y, p.z - c.z).applyQuaternion(inv);
        return [r3(v.x), r3(v.y), r3(s * v.z)];
      };
      rec.pts.push([ph, r3((t - (tWind ?? t)) / CONFIG.TIME.k), ...loc(P.bladePoint(1, new THREE.Vector3())), ...loc(P.sword.translation())]);
    }
  } finally {
    G.world.free();
  }
  rec.tRel = tRel != null && tWind != null ? r3((tRel - tWind) / CONFIG.TIME.k) : null;
  rec.tEnd = tEnd != null && tRel != null ? r3((tEnd - tRel) / CONFIG.TIME.k) : null;
  return rec;
}

/** 꺾인 줄 두 토막이 서로 가로지르나 (2D) */
function crosses(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
/** 도는 각 합 (2D 꺾인 줄 — 1 mm 넘는 걸음만): { turn 부호 있는 합 °, pos + 쪽 합, neg − 쪽 합 } */
function turning(pts) {
  const st = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    if (Math.hypot(dx, dy) > 1e-3) st.push(Math.atan2(dy, dx));
  }
  let pos = 0;
  let neg = 0;
  for (let i = 1; i < st.length; i++) {
    let a = st[i] - st[i - 1];
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    if (a > 0) pos += a;
    else neg -= a;
  }
  return { turn: (pos - neg) * R2D, pos: pos * R2D, neg: neg * R2D };
}
const PROJ = { top: (p) => [p[2], p[4]], back: (p) => [p[4], p[3]] }; // 위에서 (앞 x · 칼 든 쪽 z) · 뒤에서 (칼 든 쪽 z · 위 y)

/** 8 자 재기: 감기 마지막 한 바퀴(뗀 때 앞 loopT) 도는 쪽 σ · 뗀 뒤 길(lead + cut)이 σ 반대로 돈 각 · 감기 원과 가로지른 수 · 뗀 뒤 칼끝 길이 */
export function figure8(rec, loopT = CONFIG.UNIQUE_ASSIST.rdSlow.loopT / CONFIG.TIME.k) {
  const P = rec.pts;
  const wind = P.filter((p) => p[0] === 'wind' && p[1] >= (rec.tRel ?? 0) - loopT);
  const rel = P.filter((p) => p[0] === 'lead' || p[0] === 'cut');
  const out = {};
  for (const [k, pr] of Object.entries(PROJ)) {
    const W = wind.map(pr);
    const Rl = rel.map(pr);
    const tw = turning(W);
    const sg = Math.sign(tw.turn) || 1;
    const tr = turning(W.length ? [W.at(-1), ...Rl] : Rl);
    let x = 0;
    for (let i = 1; i < Rl.length; i++) for (let j = 1; j < W.length - 1; j++) if (crosses(Rl[i - 1], Rl[i], W[j - 1], W[j])) x++;
    out[k] = { wind: +tw.turn.toFixed(0), rel: +tr.turn.toFixed(0), against: +(sg > 0 ? tr.neg : tr.pos).toFixed(0), cross: x };
  }
  let L = 0;
  for (let i = 1; i < rel.length; i++) L += Math.hypot(rel[i][2] - rel[i - 1][2], rel[i][3] - rel[i - 1][3], rel[i][4] - rel[i - 1][4]);
  out.relLen = r3(L);
  const ld = P.filter((p) => p[0] === 'lead');
  out.leadLen = (() => {
    let s = 0;
    for (let i = 1; i < ld.length; i++) s += Math.hypot(ld[i][2] - ld[i - 1][2], ld[i][3] - ld[i - 1][3], ld[i][4] - ld[i - 1][4]);
    return r3(s);
  })();
  // 드는 이음이 몸 뒤로 간 거리(칼끝 앞 x 의 가장 뒤 — 음수 = 가슴 뒤) · 가장 낮은 칼끝(가슴 기준 y — 어깨 뒤로 떨어뜨리면 낮음)
  if (ld.length) Object.assign(out, { leadBack: r3(Math.min(...ld.map((p) => p[2]))), leadLow: r3(Math.min(...ld.map((p) => p[3]))) });
  // 벰 칼끝 높이 · 칼 든 쪽: 첫 → 끝 (왼 위 → 오른 아래면 y 줄고 z 늚)
  const cut = P.filter((p) => p[0] === 'cut');
  if (cut.length) Object.assign(out, { cutY: [cut[0][3], cut.at(-1)[3]], cutZ: [cut[0][4], cut.at(-1)[4]] });
  return out;
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const out = [];
  for (const w of String(args.ws || 'zweihander').split(','))
    for (const rl of String(args.release || '1.6').split(',').map(Number)) {
      const rec = traceRun({ w, release: rl, after: +(args.after || 0.5), seed: +(args.seed || 1) });
      rec.f8 = figure8(rec);
      out.push(rec);
      console.log(`${w} 뗌 ${rl} s: ${JSON.stringify({ turns: rec.turns, tCut: rec.tCut, tEnd: rec.tEnd, fell: rec.fell, ...rec.f8 })}`);
    }
  if (args.json) writeFileSync(args.json, JSON.stringify({ set: args.set ?? '', runs: out }));
}
