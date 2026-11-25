// ─────────────────────────────────────────────────────────────
//  getup_ledger.mjs — 쓰러졌다 일어서는 동안 몸 밖에서 받는 힘 · 토크를 구간마다 장부로 잰다 (물리 2.0). 재기만 한다.
//
//   node tools/sim/getup_ledger.mjs [--root=<나무>] [--weapons=longsword,rapier,zweihander] [--n=4] [--mode=knock|kick] [--kick=150] [--json=<파일>]
//
//  장부: 늘 이 저장소의 honesty.mjs (재는 쪽이 고른 도구 — 재는 나무가 들고 온 장부를 쓰지 않는다 · 11/24 검토). 몸과 판은 --root 나무의 harness_m.mjs.
//  구간 — 스텝마다 '그 스텝이 끝난 뒤의 상태'로 가른다(상태가 바뀐 스텝은 새 상태 쪽 · 예전에는 한 스텝 늦게 옛 상태 쪽에 들어갔다):
//    pre    넘어지기 앞 서 있음 (--mode=kick 에서 맞고 쓰러지기까지 — 예전에는 '선 뒤(stand)' 와 한 칸에 섞였다 · knock 은 0 스텝)
//    down · getup · kneel   그 상태
//    after  일어선 바로 뒤 AID.after s (선언된 일어서기 도움이 이어지는 창 — Fighter.driveAid 와 같은 셈 · config AID 가 없는 나무에는 없음)
//    stand  그 뒤 선 채 버팀 (선언된 일어서기 도움이 끝난 뒤)
//  일어섬 n/N: 쓰러진 뒤 stand 로 돌아와 2 s + AID.after 를 내내 선 상태로 버틴 판 (예전: 2 s — 그 가운데 AID.after 는 도움을 받는 시간이었다).
//    재기는 그 버팀이 끝날 때까지(못 버티면 14 s) 돈다 — 버틴 창 전체가 장부에 들어간다. 걸린 시간 = 쓰러진 때 → 그 버틴 창이 시작된 때.
//  ÷ 체중: 분모는 하나 — 맨몸 체중(honesty.mjs bareWeight = 싸움꾼 자기 토막들의 충돌 모양 질량 합 × g. 칼 · 디딘 발 덧질량은 안 넣는다 — 두 나무 · 세 무기 모두 736.7 N,
//    config AID.liftMax 가 곱하는 체중과 같은 값). 예전에는 재는 순간의 강체 질량 합(칼 + 지금 게임의 발 덧질량 4 kg 포함 — 792 N 대 752 N)이라 나무마다 달랐다. 힘은 N 으로도 같이 찍는다.
//  갈래: 받침 · 걷기 밀기 · 닻(옛 판의 숨은 힘) · 선언된 밖 도움(config AID — honesty.mjs 갈래 aid 의 네 값: 드는 힘 · 수평 힘 · 기울기 토크 · yaw 토크)
//    + 숨을 곳이 없게 늘 찍는 셋: 그 밖 선언 힘(other — 이름표 없이 건 짝 없는 힘) · 짝 없는 힘(unpaired — 몸 안 쌍이어야 할 단계의 안 맞는 몫) · 속도 쓰기(write — setLinvel · setAngvel).
//    값은 구간 시간으로 나눈 평균(N · N·m), '최고' 는 그 구간의 한 스텝 최고. 도움의 토크는 계 질량중심 둘레 알짜(골반에 건 드는 힘의 팔 몫 포함) — 옛 셈(addTorque 만 · yaw 와 기울기를 합친 크기)도 곁에 찍는다.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const Hn = await import(pathToFileURL(join(HERE, 'honesty.mjs')).href); // 늘 이 저장소의 장부
let AID = null; try { AID = (await import(u('src/config.js'))).AID ?? null; } catch { /* 옛 나무 */ }
const AFTER = AID?.after ?? 0, HOLD = 2 + AFTER;
const DT = H.DT, N = +(args.n ?? 4), MODE = String(args.mode ?? 'knock'), KICK = +(args.kick ?? 150);
const WEAPONS = String(args.weapons ?? 'longsword,rapier,zweihander').split(',');
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
// 장부의 쌓인 값(스텝마다 읽어 차를 구간에 더함): 충격량 N·s · 토크 충격량 N·m·s
const KEYS = ['sup', 'push', 'aT', 'aY', 'lift', 'aPush', 'aTilt', 'aYaw', 'aPure', 'aGross', 'oF', 'oT', 'uF', 'uT', 'wF', 'wT'];
const PEAKS = ['lift', 'aPush', 'aTilt', 'aYaw', 'aGross', 'oF', 'uF', 'wF'];
const cum = (L) => { const a = L.acc, q = L.aid ?? {}, v = (k, c) => a[k]?.[c] ?? 0; return { sup: v('support', 'Fy'), push: v('push', 'Fimp'), aT: v('anchorTilt', 'Timp'), aY: v('anchorYaw', 'Timp'), lift: q.liftNs ?? 0, aPush: q.pushNs ?? 0, aTilt: q.tiltNms ?? 0, aYaw: q.yawNms ?? 0, aPure: q.pureTnms ?? 0, aGross: q.grossNs ?? 0, oF: v('other', 'Fimp'), oT: v('other', 'Timp'), uF: v('unpaired', 'Fimp'), uT: v('unpaired', 'Timp'), wF: v('write', 'Fimp'), wT: v('write', 'Timp') }; };
const mkPh = () => ({ T: 0, ...Object.fromEntries(KEYS.map((k) => [k, 0])), pk: Object.fromEntries(PEAKS.map((k) => [k, 0])) });
function run(weapon, v) {
  const G = H.newRound({ walls: false, weapon, seed: 100 + v });
  G.park();
  const P = G.player;
  const settle = Math.round((2.0 + 0.11 * v) / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); G.step(); }
  const named = []; const seen = new Set();
  for (const [n, b] of [...Object.entries(P.bodies), ['sword', P.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); named.push([n, b]); }
  let mass = 0; for (const [, b] of named) mass += b.mass();
  const bare = Hn.bareWeight(P, 9.81);
  if (MODE === 'knock') P.knockDown(true); else hitChest(P, KICK, [0, Math.PI, Math.PI / 2, -Math.PI / 2][v % 4]);
  P.move.set(0, 0); G.step(); // 쓰러뜨린(친) 그 스텝은 예전처럼 장부를 붙이기 앞에 돌린다 — 시험이 넣은 충격 · 상태를 갈아 끼우는 스텝은 장부에 안 들어간다 (옛 기록과 같은 시작점)
  const L = Hn.attach(G.world, named, { fighter: P });
  Hn.hook(G, [L]);
  const ph = {}; let prev = P.state, stT = 0, aft = false, fell = prev !== 'stand', fellAt = fell ? 0 : null, stoodAt = null, up = 0, minPel = 9, last = cum(L);
  const n = Math.round(14 / DT);
  for (let i = 0; i < n; i++) {
    P.move.set(0, 0); G.step();
    const t = (i + 1) * DT, st = P.state, now = cum(L);
    minPel = Math.min(minPel, P.bodies.pelvis.translation().y);
    // 이 스텝의 구간: 끝난 뒤 상태로 (선 뒤 도움 창은 Fighter.driveAid 와 같은 셈 — 그 상태가 된 뒤 시간 stT 는 바뀐 스텝이 0)
    stT = st === prev ? stT + DT : 0;
    if (st === 'getup' || st === 'kneel') aft = true; else if (st !== 'stand' || stT >= AFTER) aft = false;
    if (st !== 'stand' && !fell) { fell = true; fellAt = t; }
    const name = st !== 'stand' ? st : !fell ? 'pre' : AID && aft ? 'after' : 'stand';
    const o = (ph[name] ||= mkPh()); o.T += DT;
    for (const k of KEYS) o[k] += now[k] - last[k];
    for (const k of PEAKS) o.pk[k] = Math.max(o.pk[k], Math.abs(now[k] - last[k]) / DT);
    last = now; prev = st;
    if (st !== 'stand') up = 0; else if (fell) { up += DT; if (up >= HOLD - 1e-9) { stoodAt = t - HOLD; break; } }
  }
  try { G.world.free(); } catch { /* */ }
  return { fell, fellAt, stoodAt, minPel, ph, bare, allMg: mass * 9.81 };
}
const NAME = { pre: '넘어지기 앞(pre)', down: '누움(down)', getup: '일어서는 중(getup)', kneel: '무릎 꿇음(kneel)', after: `선 바로 뒤 ${AFTER} s(after)`, stand: '그 뒤 버팀(stand)' };
const f0 = (x) => (+x).toFixed(0), f1 = (x) => (+x).toFixed(1), pc = (x) => (100 * x).toFixed(1) + ' %';
const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const out = [];
console.log(`일어서기 장부 · ${ROOT} · ${MODE}${MODE === 'kick' ? ' ' + KICK + ' N·s' : ''} · 무기마다 ${N} 판 · 버팀 = 2 s + AID.after ${AFTER} s = ${HOLD} s${AID ? '' : ' (이 나무는 config AID 없음)'} · ÷ 체중 = 맨몸 체중(칼 · 발 덧질량 빼고) · 장부 = 이 저장소 honesty.mjs`);
for (const w of WEAPONS) {
  const rs = []; for (let v = 0; v < N; v++) rs.push(run(w, v));
  const stood = rs.filter((r) => r.stoodAt != null), bare = rs[0].bare;
  console.log(`${w} · 넘어진 판 ${rs.filter((r) => r.fell).length}/${N} · 일어섬 ${stood.length}/${N} · 걸린 시간 가운데값 ${med(stood.map((r) => r.stoodAt - (r.fellAt ?? 0)))?.toFixed(2) ?? '-'} s · 골반 가장 낮은 높이 가운데값 ${med(rs.map((r) => r.minPel)).toFixed(2)} m · 맨몸 체중 ${f1(bare)} N (칼 · 덧질량을 넣은 온 무게 ${f0(rs[0].allMg)} N — 예전 분모)`);
  const row = { weapon: w, mode: MODE, n: N, fell: rs.filter((r) => r.fell).length, stood: stood.length, holdSecs: HOLD, bareMg: bare, allMg: rs[0].allMg, phases: {} };
  for (const name of ['pre', 'down', 'getup', 'kneel', 'after', 'stand', ...new Set(rs.flatMap((r) => Object.keys(r.ph)).filter((k) => !(k in NAME)))]) {
    const xs = rs.map((r) => r.ph[name]).filter(Boolean); if (!xs.length) continue;
    const T = xs.reduce((s, x) => s + x.T, 0), A = Object.fromEntries(KEYS.map((k) => [k, xs.reduce((s, x) => s + x[k], 0) / T])), K = Object.fromEntries(PEAKS.map((k) => [k, Math.max(...xs.map((x) => x.pk[k]))]));
    row.phases[name] = { runs: xs.length, meanSecs: T / xs.length, avg: A, peak: K, supportShare: A.sup / bare, liftShare: A.lift / bare, liftPeakShare: K.lift / bare };
    console.log(`   ${(NAME[name] ?? name).padEnd(20)} 평균 ${(T / xs.length).toFixed(2)} s (${xs.length} 판) · 받침 ${f0(A.sup)} N (÷ 체중 ${pc(A.sup / bare)}) · 밀기 ${f0(A.push)} N · 닻 기울기 ${f1(A.aT)} · 닻 yaw ${f1(A.aY)} N·m`
      + ` · 선언된 도움: 드는 힘 ${f0(A.lift)} N (÷ 체중 ${pc(A.lift / bare)} · 최고 ${f0(K.lift)} N = ${pc(K.lift / bare)}) · 수평 힘 ${f1(A.aPush)} N (최고 ${f0(K.aPush)}) · 기울기 토크 ${f1(A.aTilt)} N·m (최고 ${f0(K.aTilt)}) · yaw 토크 ${f1(A.aYaw)} N·m (최고 ${f0(K.aYaw)}) · addTorque 만의 합 크기 ${f1(A.aPure)} N·m · 힘 크기 합 ${f0(A.aGross)} N (최고 ${f0(K.aGross)})`
      + ` · 그 밖 선언 힘 ${f1(A.oF)} N (토크 ${f1(A.oT)} N·m · 최고 ${f0(K.oF)} N) · 짝 없는 힘 ${f1(A.uF)} N (토크 ${f1(A.uT)} N·m · 최고 ${f0(K.uF)} N) · 속도 쓰기 ${f1(A.wF)} N (토크 ${f1(A.wT)} N·m · 최고 ${f0(K.wF)} N)`);
  }
  out.push(row);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify({ root: ROOT, mode: MODE, kick: MODE === 'kick' ? KICK : null, aid: AID, holdSecs: HOLD, rows: out }, null, 1));
