// r28 P1 읽기 — AI 길 레이피어 탭 찌르기에서 칼끝 > 8 m/s 인 탭이 사람 길과 같은 옆 휘둘림(팔 풀이 가지 뒤집힘)인가 (읽기만)
//  node ai_whip.mjs --root=<나무> [--seeds=4001-4005] [--secs=30]   (관문 AI 장면 runThrustAI 와 같은 싸움 · 레이피어끼리)
//  탭마다 (skill.thrust 부터 탭이 끝날 때까지): 칼끝 가장 빠름 · 명령 위팔 돌림(armIK 가 놓은 위팔 자세 · anatSoft 와 같은 정의)이 한 스텝에 90° 넘게 뛴 적(가지 뒤집힘) · 그때 어깨 → 손 목표와 팔꿈치 극 축의 sin
//   · 칼끝이 탭 때 칼끝 자리에서 옆으로(탭 때 칼 축에 수직) 가장 멀리 간 거리
//  고침 (r28 읽기 지적 4): '한 스텝 90° 넘는 뜀' 은 사람 길의 알려진 휘둘림(지문 base_fp.txt 명령 돌림 76 → 83 → 107 → 180 → −171 · 한 스텝 뜀 7 · 24 · 73 · 9°)도 못 잡았다.
//   새 잣대 flip = 명령 위팔 돌림이 띠 [JOINTS.twist[0] + zone, twist[1] − zone] = [−55, 75]° 밖에 든 스텝이 있고 · 잇단 세 스텝 뜀의 합(감싼 |Δ|)이 90° 넘음.
//   먼저 알려진 사람 휘둘림에 대 봄: node ai_whip.mjs --check=<trace_whip 표> (명령돌림° 칸을 읽어 같은 함수로 판정 — 시뮬레이션 없음)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const { Fighter } = await import(pathToFileURL(join(ROOT, 'src/fighter.js')).href);
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href);
const HD = Math.PI / 180;
const BAND = [-55, 75], J3 = 90; // 띠 = JOINTS.twist [−70, 90] ± zone 15 (anatSoft · drawFit 와 같은 띠) · 세 스텝 뜀 합 문턱
const wrap = (x) => { let j = Math.abs(x); if (j > 180) j = 360 - j; return j; };
export function flipOf(tws) { // tws = 탭 동안 스텝마다 명령 위팔 돌림 (° · 못 잰 스텝 null)
  let out = false, j3 = 0; for (let i = 0; i < tws.length; i++) { const t = tws[i]; if (t != null && (t < BAND[0] || t > BAND[1])) out = true;
    if (i >= 3) { let s = 0, ok = true; for (let k = i - 2; k <= i; k++) { if (tws[k] == null || tws[k - 1] == null) { ok = false; break; } s += wrap(tws[k] - tws[k - 1]); } if (ok && s > j3) j3 = s; } }
  return { out, j3, flip: out && j3 > J3 }; }
if (args.check) { const { readFileSync } = await import('node:fs');
  for (const fn of String(args.check).split(',')) { const L = readFileSync(fn, 'utf8').split('\n'); const hi = L.findIndex((l) => l.startsWith('스텝 |')); const hd = L[hi].split('|').map((x) => x.trim()); const c = hd.indexOf('명령돌림°');
    const tws = L.slice(hi + 1).filter((l) => /^\s*\d+ \|/.test(l)).map((l) => { const v = parseFloat(l.split('|')[c]); return Number.isFinite(v) ? v : null; });
    const r = flipOf(tws); console.log(`check ${fn.split('/').pop()}: 스텝 ${tws.length} · 띠 밖 ${r.out} · 세 스텝 뜀 합 가장 큼 ${r.j3.toFixed(0)}° → flip ${r.flip}`); }
  process.exit(0); }
const [s0, s1] = String(args.seeds ?? '4001-4005').split('-').map(Number);
const taps = new Map(); // fighter → 지금 탭 기록
const done = [];
function twistOf(u, z, side) { const down = new THREE.Vector3(0, -1, 0); if (u.dot(down) <= Math.cos(120 * HD)) return null; const r = new THREE.Vector3(0, 0, side).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(down, u)); return side * Math.atan2(new THREE.Vector3().crossVectors(r, z).dot(u), r.dot(z)); }
const oIK = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (target, alignDir = null) { const r = oIK.call(this, target, alignDir);
  const T = taps.get(this); if (T && this._ikMain) { const qt = this.jointByName.uarmS.target; const tw = twistOf(new THREE.Vector3(1, 0, 0).applyQuaternion(qt), new THREE.Vector3(0, 0, 1).applyQuaternion(qt), this.side);
    const d = tw == null ? null : tw / HD; if (d != null && T.tw != null) { const j = wrap(d - T.tw); if (j > T.jump) T.jump = j; } T.tw = d; T.tws.push(d); }
  return r; };
for (let s = s0; s <= s1; s++) {
  taps.clear();
  const tick = (G) => { for (const f of [G.player, G.enemy]) { const tp = f.skill?.tap; let T = taps.get(f);
      if (tp && !tp.down && (!T || T.tp !== tp)) { if (T) done.push(T); const tip = f.bladePoint(1, new THREE.Vector3()); const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation())); T = { seed: s, tp, tip0: tip, ax, pk: 0, side: 0, jump: 0, tw: null, tws: [] }; taps.set(f, T); }
      if (T && T.tp === tp) { const tip = f.bladePoint(1, new THREE.Vector3()); const v = tip.clone().sub(T.tip0); T.side = Math.max(T.side, v.addScaledVector(T.ax, -v.dot(T.ax)).length()); T.pk = Math.max(T.pk, new THREE.Vector3().copy(f.sword.velocityAtPoint(tip)).length()); }
      if (T && !tp) { done.push(T); taps.delete(f); } } };
  let tickNow = tick;
  const M2 = makeMeasure({ ...H, newRound: (...a) => { const g = H.newRound(...a); const st = g.step.bind(g); g.step = (...b) => { const r = st(...b); tickNow(g); return r; }; return g; } });
  M2.runThrustAI(s, 'rapier', +(args.secs ?? 30));
  for (const T of taps.values()) done.push(T);
}
for (const T of done) Object.assign(T, flipOf(T.tws));
const fast = done.filter((T) => T.pk > 8), slow = done.filter((T) => !(T.pk > 8));
const f = (x, d = 1) => x.toFixed(d);
console.log(`AI 레이피어 탭 ${done.length} · 칼끝 > 8 m/s ${fast.length}`);
for (const T of fast) console.log(`  씨앗 ${T.seed} 칼끝 ${f(T.pk)} m/s · 옆 ${f(T.side, 2)} m · 명령 위팔 돌림 한 스텝 최대 뜀 ${f(T.jump, 0)}° · 세 스텝 합 ${f(T.j3, 0)}° · 띠 밖 ${T.out} → flip ${T.flip}`);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
console.log(`칼끝 > 8: 옆 가운데 ${f(med(fast.map((T) => T.side)), 2)} m · 뜀 > 90° ${fast.filter((T) => T.jump > 90).length}/${fast.length} | 나머지: 옆 가운데 ${f(med(slow.map((T) => T.side)), 2)} m · 뜀 > 90° ${slow.filter((T) => T.jump > 90).length}/${slow.length}`);
console.log(`새 잣대 flip (띠 밖 + 세 스텝 뜀 합 > ${J3}°): 칼끝 > 8 ${fast.filter((T) => T.flip).length}/${fast.length} · 나머지 ${slow.filter((T) => T.flip).length}/${slow.length} · 띠 밖만: ${fast.filter((T) => T.out).length}/${fast.length} · ${slow.filter((T) => T.out).length}/${slow.length}`);
