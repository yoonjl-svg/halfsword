// ─────────────────────────────────────────────────────────────
//  iberian_spin_circle.mjs — 싱지르 칼 높이 재기 · 공격 원 입력 그대로 (10/24 10:4x 사장님 '싱지르 개편 뒤에 또 허공 위로 날아가는 싱지르가 많아졌어. 몸통을 겨누기로 했었는데.
//   속도가 변하면 자세도 변하나?' · '작게 그으면 싱지르가 나가다 말고 좀 이상한 작은 동작이 되어 실패하던데 최소 크기 제한 때문인가?' — src/iberian_spin.js · docs/strike/iberian_spin_2026-10-22.md §16)
//
//  node tools/sim/iberian_spin_circle.mjs [--weapons=zweihander,flamberge,tizona] [--inputs=direct,circle] [--starts=langort,ochsR,tag,wechselR,ochsL]
//                                         [--r=15,50,80] [--T=0.8] [--a0=0,90,180,270] [--dirs=ccw,cw] [--close=380] [--targets=none,stand]
//                                         [--set=share=0.6,torso=1,...] [--rows] [--json=파일]
//   input direct = 무장 창을 곧장 씀 (손은 자세 패드에 멈춘 채 — 10/22 공격 하나 · 10/23 스틱 판과 같은 손) · turnDir = dirs (ccw = 반시계 = 왼쪽 · cw = 시계)
//   input circle = main.js 와 같은 길: 무장(금색 '!') 뒤 화면 프레임(60 fps · 게임 시간 TEMPO 1.1 배)마다 손가락 길(px — 폰 가로 390 px 터치 · mobile_intent)을 손 움직임으로 바꿔
//    PlayerSecretWatch.spinCircle 에 넣고 · 원이 되면 fire → skill.secret · 비기가 아닌 동안 손 목표(handOffset)에 더한다 (그리는 동안 칼은 손가락대로 돈다 — 보통 휘두름)
//    원 = 반지름 r px · 한 바퀴 T s · 닫는 각 close° · 시작 각 a0°(0 = 손가락이 원의 오른쪽 끝에서 시작) · 도는 쪽 dir · 손 떨림 1 px (씨앗 고정)
//   target none = 상대를 8 m 앞에 (몸꼴만) · stand = 서 있는 과녁(칼 충돌 끔 · 죽지 않음)을 칼끝 거리 + 0.3 m 에 (무장되는 거리)
//   잰 것 (물리 스텝마다 — 낸 때 ~ 비기 끝 + 0.6 s · 그리는 동안은 따로):
//    칼 가장 높은 점(칼자루 · 칼날 다섯 점) − 내 가슴 점 · 칼끝 − 가슴 · 손목 − 가슴, 단계별 (pre 먼저 감기 · ramp 오름 · wind 감은 채 · free 놓은 뒤(대본 안) · settle 받아 멈춤 · follow · stiff · after)
//    '허공' = 칼 가장 높은 점이 몸통 위 끝(어깨 관절 높이 = 가슴 점 + ARM.shoulder[1] 0.1)을 넘은 스텝 몫 · 그 위로 나간 최대
//    낸 때: 손 목표 높이 · 칼 가장 높은 점 − 가슴 · 칼끝 위아래 빠르기 · 먼저 감기 했나 · 대본 끝 까닭(done · blocked) · 진행 q · 그리는 동안 칼 가장 높은 점 − 가슴
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { G as PADS } from '../../src/ai_techniques.js';
import { mapMobileHandDelta } from '../../src/mobile_intent.js';

const CLI = import.meta.url === pathToFileURL(process.argv[1] ?? '').href; // 바로 돌렸나 (시험이 runCircle 만 가져다 쓰면 거짓 — 인자 · 표 없음)
const args = {};
for (const a of CLI ? process.argv.slice(2) : []) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const { SKILL, SECRET, INPUT, ARM } = CONFIG;
for (const kv of list('set', '')) {
  const [k, v] = kv.split('=');
  if (!(k in SECRET.ibSpin)) throw new Error(`SECRET.ibSpin.${k}?`);
  SECRET.ibSpin[k] = Number.isFinite(+v) ? +v : v;
}
const SH = ARM.shoulder[1]; // 몸통 위 끝 = 가슴 점 + 0.1 (어깨 관절 높이 — 있는 몸 수)
const H = 390; // 폰 가로 화면 높이 (CSS px)
const TEMPO = 1.1; // main.js 기본 빠르기 (게임 시간 = 화면 시간 × 1.1)
const FR = 1 / 60; // 화면 프레임 (s)
const PH = ['pre', 'ramp', 'wind', 'free', 'settle', 'follow', 'stiff', 'after'];
const SPIN = ['ramp', 'wind', 'free', 'settle']; // 몸이 도는 대본 (먼저 감기 뺌)
const REACH = {};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 원 손가락 길 (px · 화면 y 아래로) — 프레임마다 [x, y]. 닿고 lead 프레임 머묾 → close° · T s (한 바퀴) */
function circlePath(c, seed) {
  const R = rng(seed);
  const fr = [];
  const a0 = (c.a0 * Math.PI) / 180;
  const s = c.dir === 'cw' ? -1 : 1;
  const x0 = 600, y0 = 200;
  const cx = x0 - c.r * Math.cos(a0);
  const cy = y0 + c.r * Math.sin(a0);
  const n = Math.max(2, Math.round((c.T * c.close) / 360 / FR));
  for (let i = 0; i < 3; i++) fr.push([x0, y0]);
  for (let i = 1; i <= n; i++) {
    const a = a0 + (s * ((c.close * Math.PI) / 180) * i) / n;
    fr.push([cx + c.r * Math.cos(a) + (R() - 0.5) * 2, cy - c.r * Math.sin(a) + (R() - 0.5) * 2]);
  }
  for (let i = 0; i < 6; i++) fr.push(fr[fr.length - 1]);
  return fr;
}

/** 판 하나 — w 무기 · start 자세 패드 · input 'direct' | 'circle' · c 원 { r, T, a0, dir, close } (direct 는 { dir }) · target 'none' | 'stand'. 시험(iberian_spin.test.mjs)도 쓴다
 *  hook (10/24 12:5x — 발디딤 재기 iberian_spin_feet.mjs): 물리 스텝마다 hook({ G, P, E, tFire, tEnd }) — 읽기만 · 없으면 아무 일 없음 */
export function runCircle(w, start, input, c, target = 'none', hook = null) {
  if (REACH[w] == null) {
    const G0 = newRound({ seed: 7, weapon: w, weapon2: 'longsword', gap: 8, walls: false });
    REACH[w] = G0.player.swordArt.measure.reach;
    G0.world.free();
  }
  const gap = target === 'none' ? 8 : REACH[w] + 0.3;
  const G = newRound({ seed: 7, weapon: w, weapon2: 'longsword', gap, walls: false });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  E.die = () => {};
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  const pad = PADS[start];
  if (!pad) throw new Error(`자세 ${start}?`);
  const r = { w, start, input, c: input === 'circle' ? `${c.r}px ${c.T}s ${c.a0}° ${c.dir}` : c.dir, target, armed: false, circle: false, fired: false, ph: {}, at: null, draw: { top: -9, over: 0, n: 0 }, ownWind: 0, ownFree: 0, freeN: 0, fell: false, why: null, q: null, cuts: 0, T: null };
  for (const k of [...PH, 'spin']) r.ph[k] = { top: -9, tip: -9, hand: -9, n: 0, over: 0, head: 0 };
  const path = input === 'circle' ? circlePath(c, 1000 + Math.round(c.r * 31 + c.a0 * 7 + c.T * 101 + (c.dir === 'cw' ? 5 : 0))) : null;
  let tFire = null, tEnd = null, armT = null, fi = 0, acc = 0, steps = 0, tPathEnd = null, armAfter;
  const w0 = G.wounds.length;
  const _p = new THREE.Vector3();
  const topOf = () => {
    let y = P.sword.translation().y;
    for (const u of [0, 0.25, 0.5, 0.75, 1]) y = Math.max(y, P.bladePoint(u, _p).y);
    return y;
  };
  const mine = new Map(Object.entries(P.bodies).map(([k, b]) => [b.handle, k]));
  const ownOverlap = () => {
    let m = 0;
    for (const c1 of P.swordColliders) G.world.contactPairsWith(c1, (c2) => { if (!mine.has(c2.parent()?.handle)) return; G.world.contactPair(c1, c2, (mf) => { for (let i = 0; i < mf.numContacts(); i++) m = Math.min(m, mf.contactDist(i)); }); });
    return m;
  };
  const wrist = () => {
    const b = P.bodies.farmS;
    const q = b.rotation();
    return new THREE.Vector3(0.13, 0, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(b.translation()).y;
  };
  const fire = (o) => {
    if (!o) return false;
    const ok = P.skill.secret(o);
    if (ok) {
      r.fired = true;
      tFire = G.t;
      r.T = P.ibSpin?.T ?? null;
      const cy = P.bodies.chest.translation().y;
      const tv = P.tipVel;
      r.at = { hand: +P.handOffset.y.toFixed(2), top: +(topOf() - cy).toFixed(2), tipVy: +(P.sword.velocityAtPoint(P.bladePoint(1, _p)).y).toFixed(1), tip: +tv.length().toFixed(1), pre: !!P.ibSpin?.pre, dir: P.ibSpin?.dir ?? null };
    }
    return ok;
  };
  // 화면 프레임 (main.js frame — 손 움직임 · 원 읽기 · 낼지 · 손 목표). 그리기는 무장 뒤 0.3 s 부터
  let fingerPrev = null;
  const frame = () => {
    const can = !P.skill.secretPhase && P.alive && !P.stamina.exhausted;
    if (input !== 'circle' || armT == null || G.t < armT + 0.3 || fi >= path.length) {
      if (input === 'circle') W.spinCircle(FR, { x: 0, y: 0 }, false, can);
      P.handHeld = false;
      return;
    }
    const [x, y] = path[fi++];
    let d = { x: 0, y: 0 };
    if (fingerPrev) d = mapMobileHandDelta({ dx: x - fingerPrev[0], dy: y - fingerPrev[1], height: H, sensitivity: INPUT.touchSensitivity, pointerType: 'touch', verticalGain: 1.35 });
    fingerPrev = [x, y];
    const down = fi < path.length;
    const go = W.spinCircle(FR, d, down, can);
    let busy = !!P.skill.secretPhase;
    if (go && can) {
      r.circle = true;
      if (fire(W.fire())) busy = true;
    }
    if (!busy && down) {
      P.handOffset.x += d.x;
      P.handOffset.y += d.y;
    }
    P.handHeld = down;
    P.inputActive = !busy && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
  };
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    P.move.set(0, 0);
    if (G.t > 1.2 && tFire == null && (input !== 'circle' || armT == null || G.t < armT + 0.3)) P.handOffset.set(pad[0], pad[1]); // 자세를 잡고
    if (armT == null && W.open?.ctx?.ev === 'spin') {
      armT = G.t;
      r.armed = true;
    }
    if (input === 'direct' && armT != null && tFire == null && G.t > Math.max(2.6, armT + 0.3)) {
      const nat = P.side >= 0 ? 1 : -1;
      const o = W.fire();
      if (o) o.ctx = { ...o.ctx, turnDir: c.dir === 'cw' ? -1 : c.dir === 'ccw' ? 1 : nat };
      fire(o);
    }
    if (steps++ % 2 === 0) {
      // 화면 프레임: 게임 시간 TEMPO 배 — 물리 스텝 2 개 ≈ 프레임 1 개 (1/120 × 2 ÷ 1.1 = 프레임 0.0152 s)
      acc += 2 * DT;
      while (acc >= FR * TEMPO - 1e-9) {
        acc -= FR * TEMPO;
        frame();
      }
    }
  };
  const after = () => {
    const cy = P.bodies.chest.translation().y;
    if (tFire == null) {
      if (input === 'circle' && armT != null && G.t >= armT + 0.3 && P.armed) {
        const t = topOf() - cy;
        r.draw.top = Math.max(r.draw.top, t);
        r.draw.n++;
        if (t > SH) r.draw.over++;
      }
      return;
    }
    const sec = P.skill.sec;
    const S = P.ibSpin;
    let ph;
    if (S) ph = S.tp < S.pre ? 'pre' : S.settle ? 'settle' : S.free ? 'free' : S.t < S.r ? 'ramp' : 'wind';
    else if (sec) ph = sec.stage === 'stiff' ? 'stiff' : 'follow';
    else ph = 'after';
    if (S) r.q = S.q;
    if (P.state !== 'stand' && ph !== 'after') r.fell = true;
    if (!S && r.why == null) r.why = P.skill.sec?.spin?.why ?? 'none';
    if (!sec && tEnd == null) tEnd = G.t;
    if (ph === 'after' && G.t - tEnd > 0.6) return;
    if (!P.armed) return;
    const top = topOf() - cy;
    const tip = P.bladePoint(1, _p).y - cy;
    const hd = wrist() - cy;
    const hy = P.bodies.head.translation().y - cy;
    if (ph === 'wind' || ph === 'free' || ph === 'ramp') {
      // 내 칼 ↔ 내 몸 겹침 (m — 접촉 거리 음수 = 파고듦 · BODY.humanLimits 제 칼 ↔ 제 몸통): 감은 채 가장 깊음 · 놓은 때(놓은 첫 두 스텝) 가장 깊음
      const o = ownOverlap();
      if (ph !== 'free') r.ownWind = Math.min(r.ownWind, o);
      else if (r.freeN++ < 2) r.ownFree = Math.min(r.ownFree, o);
    }
    for (const k of SPIN.includes(ph) ? [ph, 'spin'] : [ph]) {
      const R = r.ph[k];
      R.top = Math.max(R.top, top);
      R.tip = Math.max(R.tip, tip);
      R.hand = Math.max(R.hand, hd);
      R.n++;
      if (top > SH) R.over++;
      if (top > hy) R.head++;
    }
  };
  while (G.t < 12 && (tEnd == null || G.t < tEnd + 0.65)) {
    G.step();
    after();
    hook?.({ G, P, E, tFire, tEnd });
    if (input === 'circle' && tFire == null && fi >= path.length && armAfter === undefined) {
      tPathEnd ??= G.t;
      if (G.t >= tPathEnd + 0.3) armAfter = !!W.spinArm.armed;
    }
    if (tFire == null && armT != null && G.t > armT + 4) break; // 못 냄
  }
  r.cuts = G.wounds.slice(w0).filter((x) => x.att === P && x.vic === E && x.severity > 0).length;
  r.armedAfter = !r.fired ? armAfter : null; // 못 냈으면 획이 끝나고 0.3 s 뒤 무장이 남았나 (원이 안 된 획이 휘두름이었으면 풀림 — secret.js spinTick circSwung)
  r.q = r.q != null ? +r.q.toFixed(2) : null;
  r.circleFires = W.circleFires ?? 0;
  G.world.free();
  return r;
}

if (CLI) cli();
function cli() {
const run = runCircle;
const WEAPONS = list('weapons', 'zweihander,flamberge,tizona');
const INPUTS = list('inputs', 'direct,circle');
const STARTS = list('starts', 'langort,ochsR,tag,wechselR,ochsL');
const TARGETS = list('targets', 'none');
const DIRS = list('dirs', 'ccw,cw');
const CIRCLES = [];
for (const rp of list('r', '15,50,80').map(Number)) for (const T of list('T', '0.8').map(Number)) for (const a0 of list('a0', '0,90,180,270').map(Number)) for (const dir of DIRS) CIRCLES.push({ r: rp, T, a0, dir, close: +arg('close', 380) });
const all = [];
for (const w of WEAPONS)
  for (const target of TARGETS)
    for (const s of STARTS)
      for (const input of INPUTS)
        for (const c of input === 'circle' ? CIRCLES : DIRS.map((dir) => ({ dir }))) {
          const r = run(w, s, input, c, target);
          all.push(r);
          if (args.rows) console.log(JSON.stringify(r));
        }
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const f2 = (x) => (x < -8 || x > 8 || !Number.isFinite(x) ? '-' : (x >= 0 ? '+' : '') + x.toFixed(2));
const pc = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '-');
console.log(`설정: ${JSON.stringify(Object.fromEntries(Object.entries(SECRET.ibSpin).filter(([k]) => ['share', 'torso', 'upright', 'reverse', 'settle', 'circleR', 'tame', 'tameEl'].includes(k))))} · 칸 = 칼 가장 높은 점 − 가슴 (m) · '허공' = 어깨(가슴 + ${SH}) 위 스텝 몫`);
const key = (r) => `${r.w}|${r.input}`;
const by = new Map();
for (const r of all) {
  if (!by.has(key(r))) by.set(key(r), []);
  by.get(key(r)).push(r);
}
console.log('| 무기 | 입력 | 판 | 낸 판 | 넘어짐 | 먼저 감기 | 대본 끝 done · blocked | 진행 q 평균 (최소) | 도는 동안 허공 몫 (스텝) · 머리 위 몫 | 허공 판 (도는 동안 한 번이라도) | 도는 동안 가장 높은 점 − 가슴 평균 · 최대 | 단계별 허공 몫 — ' + PH.join(' · ') + ' | 단계별 최대 − 가슴 — ' + PH.join(' · ') + ' | 낸 때 칼 가장 높은 점 − 가슴 평균 | 그리는 동안 허공 몫 · 최대 |');
console.log('|' + '---|'.repeat(15));
for (const [k, rs] of by) {
  const [w, input] = k.split('|');
  const F = rs.filter((r) => r.fired);
  const sp = F.map((r) => r.ph.spin);
  const spN = sp.reduce((a, x) => a + x.n, 0);
  const spO = sp.reduce((a, x) => a + x.over, 0);
  const phO = PH.map((p) => pc(F.reduce((a, r) => a + r.ph[p].over, 0), F.reduce((a, r) => a + r.ph[p].n, 0))).join(' · ');
  const phM = PH.map((p) => f2(Math.max(...F.filter((r) => r.ph[p].n).map((r) => r.ph[p].top)))).join(' · ');
  const D = rs.filter((r) => r.draw.n);
  console.log(`| ${w} | ${input} | ${rs.length} | ${F.length} | ${F.filter((r) => r.fell).length} | ${F.filter((r) => r.at?.pre).length} | ${F.filter((r) => r.why === 'done').length} · ${F.filter((r) => r.why === 'blocked').length} | ${mean(F.map((r) => r.q ?? 0)).toFixed(2)} (${Math.min(...F.map((r) => r.q ?? 0)).toFixed(2)}) | ${pc(spO, spN)} · ${pc(sp.reduce((a, x) => a + x.head, 0), spN)} | ${F.filter((r) => r.ph.spin.over > 0).length} / ${F.length} | ${f2(mean(sp.map((x) => x.top)))} · ${f2(Math.max(...sp.map((x) => x.top)))} | ${phO} | ${phM} | ${f2(mean(F.map((r) => r.at.top)))} | ${D.length ? `${pc(D.reduce((a, r) => a + r.draw.over, 0), D.reduce((a, r) => a + r.draw.n, 0))} · ${f2(Math.max(...D.map((r) => r.draw.top)))}` : '-'} |`);
}
// 자세별 · 원 크기별 (circle) 묶음
const sub = (name, kf) => {
  const m = new Map();
  for (const r of all.filter((x) => x.fired)) {
    const k = kf(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  console.log(`\n| ${name} | 낸 판 | 도는 동안 허공 몫 | 허공 판 | 도는 동안 최대 − 가슴 평균 · 최대 | 놓은 뒤(free) 최대 평균 | 따라 · 굳음 최대 |`);
  console.log('|---|---|---|---|---|---|---|');
  for (const [k, rs] of [...m].sort()) {
    const sp = rs.map((r) => r.ph.spin);
    console.log(`| ${k} | ${rs.length} | ${pc(sp.reduce((a, x) => a + x.over, 0), sp.reduce((a, x) => a + x.n, 0))} | ${rs.filter((r) => r.ph.spin.over > 0).length} | ${f2(mean(sp.map((x) => x.top)))} · ${f2(Math.max(...sp.map((x) => x.top)))} | ${f2(mean(rs.filter((r) => r.ph.free.n).map((r) => r.ph.free.top)))} | ${f2(Math.max(...rs.flatMap((r) => ['follow', 'stiff'].filter((p) => r.ph[p].n).map((p) => r.ph[p].top))))} |`);
  }
};
sub('입력 · 자세', (r) => `${r.input} · ${r.start}`);
sub('입력 · 쪽 (ccw 왼쪽 · cw 오른쪽)', (r) => `${r.input} · ${r.at?.dir === 1 ? 'ccw' : 'cw'}`);
if (INPUTS.includes('circle')) sub('원 (반지름 px · 시간 · 시작 각 · 쪽)', (r) => (r.input === 'circle' ? r.c.split(' ').slice(0, 2).join(' ') : 'direct'));
const nf = all.filter((x) => !x.fired);
if (nf.length) console.log(`\n못 냄 ${nf.length}: ${nf.map((r) => `${r.w} ${r.start} ${r.input} ${r.c} (무장 ${r.armed} · 원 ${r.circle})`).join(' | ')}`);
if (args.json) writeFileSync(args.json, JSON.stringify(all, null, 1));
}
