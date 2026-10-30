// 잘못 건드린 손끝이 기력을 얼마나 쓰나 (사장님 10/31 01:5x '실제로 베기를 수행하지 않아도 그냥 화면에 손가락을 아주 조금 대거나 여러 번 잘못 톡톡 건드려질 때
//  실제로 아무 커맨드 입력은 안 되면서 기력은 소모되거든') — 재기만 · 게임 값은 STAMINA.humanStrokeMin 하나만 견줌(old 0 = 전 판 · new = 지금 값)
//  사람 몸(0 번 자리 · humanInput — main.js 플레이어와 같은 기력 길)을 손가락 봇이 몬다 · 상대 = 보통 AI(롱소드). 60 Hz 화면(프레임마다 손가락 움직임을 손 목표에 더함 — main.js 그대로) · 물리 120 Hz.
//   봇(진짜 공격): 1.0 ~ 1.8 s 마다 — 멀면 걸어 듦 · 닿으면 65 % 베기(오른 위 준비 자리 → 겨눔 가운데를 가르는 내려베기 0.15 s) · 35 % 탭 찌르기
//   잘못 건드림(ACC 분당 — 포아송): slideTap(톡 + 떼기 직전 6 ~ 11.5 px 미끄러짐 → 탭 찌르기) · flick(12 ~ 16 px 빠른 작은 끌기 — 탭 아님) · touch(그냥 톡 → 찌르기) · double(slideTap 두 번 0.12 s 사이)
//   손가락 px → 손 목표 m: 844×390 가로 화면(INPUT.touchSensitivity 2.6 m / 390 px · 세로 × 1.35 — mobile_intent.js)
//  센다(실제 1 분당): 공격 기력 · 갈래(진짜 베기 · 진짜 찌르기 · 잘못 건드림 찌르기(보이는 찌르기) · 잘못 건드림 긋기(보이는 공격 없음 = 버린 기력)) · 탈진
//  node tools/sim/accidental_touch.mjs [--seeds=6] [--dur=60] [--acc=8] [--weapon=longsword] [--json=파일]
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { G as PAD } from '../../src/ai_techniques.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEEDS = +arg('seeds', 6);
const DUR = +arg('dur', 60); // 실제 초
const ACC = +arg('acc', 8); // 분당 잘못 건드림
const WEAPON = arg('weapon', 'longsword');
const K = CONFIG.TIME?.k ?? 1;
const H = 390;
const PXX = CONFIG.INPUT.touchSensitivity / H; // 가로 px → m
const PXY = PXX * 1.35; // 세로
const NEW = CONFIG.STAMINA.humanStrokeMin;

function rng(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

function run(seed, variant, acc) {
  CONFIG.STAMINA.humanStrokeMin = variant === 'old' ? 0 : NEW;
  const R = rng(seed * 7919 + 11);
  const tally = { realCut: [0, 0], realThrust: [0, 0], accThrust: [0, 0], accStroke: [0, 0], other: [0, 0], exhaust: 0, rounds: 0, live: 0, acc: {} };
  let left = DUR * K; // 게임 초
  let rs = seed;
  while (left > 0.5) {
    const G = newRound({ seed: rs++, weapon: WEAPON, weapon2: 'longsword', difficulty: 'normal' });
    tally.rounds++;
    const P = G.player;
    P.humanInput = true;
    const S = P.stamina;
    let src = 'idle';
    // 긋기 갈래 붙이기 · 청구 갈래 세기
    const obs = S.observeStroke.bind(S);
    let last = { src: 'idle', t: -1 };
    S.observeStroke = function (dt) { const s0 = S.stroke; const r = obs(dt); if (S.stroke && S.stroke !== s0 && !S.stroke.src) S.stroke.src = src !== 'idle' ? src : t - last.t < 0.3 * K ? last.src : 'idle'; return r; };
    const cs = S.commitStroke.bind(S);
    let cur = null;
    const srcNow = () => (src !== 'idle' ? src : t - last.t < 0.3 * K ? last.src : 'idle');
    S.commitStroke = function (s, kind) { cur = s?.src ?? srcNow(); try { return cs(s, kind); } finally { cur = null; } };
    const ca = S.contactAttack.bind(S);
    let inContact = false;
    S.contactAttack = function (kind) { inContact = true; try { return ca(kind); } finally { inContact = false; } };
    const ch = S.chargeAttack.bind(S);
    let tapSrc = null;
    S.chargeAttack = function (kind, bundled, credit) {
      const v0 = S.value;
      const r = ch(kind, bundled, credit);
      const cost = v0 - S.value;
      const key = cur != null ? (cur === 'acc' ? 'accStroke' : cur === 'real' ? 'realCut' : 'other') : tapSrc === 'acc' ? 'accThrust' : tapSrc === 'real' ? 'realThrust' : 'other';
      tally[key][0]++;
      tally[key][1] += cost;
      if (key === 'accStroke' && inContact) tally.accContact = (tally.accContact ?? 0) + 1; // 잘못 건드린 손길이 칼 · 몸에 닿아 청구 (닿음 = 공격 — 그대로)
      if (process.env.DBG) console.log(variant, acc, (t / K).toFixed(2), key, kind, cost.toFixed(1), JSON.stringify((S.stroke ?? S.strokeTail) && { tr: +(S.stroke ?? S.strokeTail).travel.toFixed(3), src: (S.stroke ?? S.strokeTail).src, m: (S.stroke ?? S.strokeTail).matched, e: (S.stroke ?? S.strokeTail).enters }), 'lastSrc', last.src, ((t - last.t) / K).toFixed(2));
      return r;
    };
    const ex0 = S.counts.exhaustion;
    // 손가락 대본: 프레임마다 [dx, dy(m), down, tap, src]
    const q = [];
    let nextAtk = 0.6 * K;
    let nextAcc = (-Math.log(1 - R()) * 60 * K) / Math.max(1e-6, acc);
    let walkT = 0;
    let t = 0;
    const FR = 2; // 물리 스텝 / 화면 프레임
    const reach = 1.5;
    const slideTap = (s) => { const a = R() * Math.PI * 2; return [[0, 0, true, false, 'acc'], [Math.cos(a) * s * PXX, Math.sin(a) * s * PXY, true, false, 'acc'], [0, 0, false, true, 'acc']]; };
    for (let i = 0; i < 1e6 && t < left; i++) {
      if (!P.alive || !G.enemy.alive) break;
      if (i % FR === 0) {
        // 새 대본
        if (!q.length && t >= nextAcc) {
          const kind = ['slideTap', 'flick', 'touch', 'double'][Math.floor(R() * 4)];
          tally.acc[kind] = (tally.acc[kind] ?? 0) + 1;
          if (kind === 'slideTap') q.push(...slideTap(6 + R() * 5.5));
          else if (kind === 'touch') q.push([0, 0, true, false, 'acc'], [0, 0, false, true, 'acc']);
          else if (kind === 'double') { q.push(...slideTap(6 + R() * 5.5)); for (let k = 0; k < 7; k++) q.push([0, 0, false, false, 'acc']); q.push(...slideTap(6 + R() * 5.5)); }
          else { const a = R() * Math.PI * 2, s = 12 + R() * 4; q.push([0, 0, true, false, 'acc'], [Math.cos(a) * s * 0.5 * PXX, Math.sin(a) * s * 0.5 * PXY, true, false, 'acc'], [Math.cos(a) * s * 0.5 * PXX, Math.sin(a) * s * 0.5 * PXY, true, false, 'acc'], [0, 0, false, false, 'acc']); }
          nextAcc = t + (-Math.log(1 - R()) * 60 * K) / acc;
        }
        if (!q.length && t >= nextAtk) {
          const d = P.foeDistance();
          if (d > reach + 0.2) { walkT = 0.45 * K; nextAtk = t + 0.45 * K; } else if (R() < 0.65) {
            // 준비(오른 위로 0.2 s) → 내려베기 0.15 s (겨눔 가운데를 가름)
            const h0 = [P.handOffset.x, P.handOffset.y];
            const A = PAD.tagR, B = [-0.32, -0.34];
            const n1 = 12, n2 = 9;
            for (let k = 0; k < n1; k++) q.push([(A[0] - h0[0]) / n1, (A[1] - h0[1]) / n1, true, false, 'prep']);
            for (let k = 0; k < n2; k++) q.push([(B[0] - A[0]) / n2, (B[1] - A[1]) / n2, true, false, 'real']);
            q.push([0, 0, false, false, 'real']);
            nextAtk = t + (1.0 + R() * 0.8) * K;
          } else { q.push([0, 0, true, false, 'real'], [0, 0, false, true, 'real']); nextAtk = t + (1.0 + R() * 0.8) * K; }
        }
        const fr = q.shift() ?? [0, 0, false, false, 'idle'];
        src = fr[4] === 'prep' ? 'real' : fr[4];
        if (src !== 'idle') last = { src, t };
        if (!P.skill.secretPhase && !P.stamina.exhausted) {
          P.handOffset.x += fr[0];
          P.handOffset.y += fr[1];
        }
        P.handHeld = !!fr[2];
        P.inputActive = Math.abs(fr[0]) + Math.abs(fr[1]) > 1e-5;
        if (fr[3] && !P.stamina.exhausted) { tapSrc = fr[4]; P.skill.thrust(); tapSrc = null; }
        const mv = walkT > 0 ? 1 : 0;
        if (walkT > 0) walkT -= DT * FR;
        P.move.set(0, P.stamina.exhausted ? 0 : mv);
      }
      G.step();
      t += DT;
    }
    tally.exhaust += S.counts.exhaustion - ex0;
    tally.free = (tally.free ?? 0) + (S.freeStrokes ?? 0);
    tally.live += t;
    left -= t;
    G.world.free();
  }
  return tally;
}

const out = { acc: ACC, dur: DUR, seeds: SEEDS, newMin: NEW, rows: {} };
for (const variant of ['old', 'new']) for (const acc of [0, ACC]) {
  const T = { realCut: [0, 0], realThrust: [0, 0], accThrust: [0, 0], accStroke: [0, 0], other: [0, 0], exhaust: 0, rounds: 0, live: 0, acc: {} };
  for (let s = 1; s <= SEEDS; s++) {
    const r = run(s, variant, acc);
    for (const k of ['realCut', 'realThrust', 'accThrust', 'accStroke', 'other']) { T[k][0] += r[k][0]; T[k][1] += r[k][1]; }
    T.exhaust += r.exhaust; T.rounds += r.rounds; T.live += r.live;
    T.accContact = (T.accContact ?? 0) + (r.accContact ?? 0);
    T.free = (T.free ?? 0) + (r.free ?? 0);
    for (const [k, v] of Object.entries(r.acc)) T.acc[k] = (T.acc[k] ?? 0) + v;
  }
  const min = T.live / K / 60;
  const pm = (x) => +(x / min).toFixed(2);
  out.rows[`${variant}|acc${acc}`] = {
    minutes: +min.toFixed(2), rounds: T.rounds, accTouches: T.acc,
    perMin: { attack: pm(T.realCut[1] + T.realThrust[1] + T.accThrust[1] + T.accStroke[1] + T.other[1]), realCut: pm(T.realCut[1]), realThrust: pm(T.realThrust[1]), accThrust: pm(T.accThrust[1]), wastedStroke: pm(T.accStroke[1]), other: pm(T.other[1]) },
    counts: { realCut: T.realCut[0], realThrust: T.realThrust[0], accThrust: T.accThrust[0], accStroke: T.accStroke[0], other: T.other[0] },
    exhaust: T.exhaust, accContact: T.accContact, freeStrokes: T.free,
  };
  console.log(variant, `acc ${acc}/min`, JSON.stringify(out.rows[`${variant}|acc${acc}`]));
}
CONFIG.STAMINA.humanStrokeMin = NEW;
if (arg('json')) writeFileSync(arg('json'), JSON.stringify(out, null, 2));
