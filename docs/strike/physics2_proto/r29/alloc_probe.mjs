// r29 새 각속도 읽기의 할당 세기: LegDrive.drive 안에서 부른 RigidBody.angvel() 의 수 · 그 가운데 엔진까지 간 것(body_reads 의 기억에 없던 것)을 싸움꾼 · 스텝마다 센다.
//  쓰는 법: (cd <나무> && node docs/strike/physics2_proto/r29/alloc_probe.mjs [--secs=10])   — 롱소드 · 씨앗 1 · 두 몸이 싸움(AI) · 흉내 낸 secs 초
//  angvel() 은 늘 새 RAPIER.Vector3 하나를 돌려준다(기억에 있으면 그 숫자로 새로 만듦). 기억에 없으면 엔진 RawVector 하나 + 그 JS 껍데기를 더 만든다(엔진 쪽은 읽고 곧 풂).
//  엔진까지 갔는지: body_reads.js 가 적는 몸의 _rd.eW 가 부름 앞뒤로 바뀌면 엔진 읽기(기억 없음).
//  drive 밖에서 이 도구가 부르는 angvel 은 셈 밖. 이 나무의 다리 몸 일곱 말고 drive 가 원래 읽던 각속도(몸통 넷 · 팔 넷 · 칼)도 함께 세어 따로 적는다.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { LegDrive } = await import(pathToFileURL(join(ROOT, 'src/legs_vmc.js')).href);
const { RAPIER, DT } = H;
const G = H.newRound({ walls: true, weapon: 'longsword', seed: 1 });
const RB = RAPIER.RigidBody.prototype, ang = RB.angvel;
let inDrive = null;
const LEG = new Set(['pelvis', 'thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB']);
const cnt = { drives: 0, leg: 0, legMiss: 0, other: 0, otherMiss: 0 };
const nameOf = new WeakMap();
for (const F of [G.player, G.enemy]) for (const n in F.bodies) nameOf.set(F.bodies[n], n);
RB.angvel = function () {
  if (!inDrive) return ang.call(this);
  const e0 = this._rd?.eW, r = ang.call(this), miss = this._rd?.eW !== e0;
  if (LEG.has(nameOf.get(this))) { cnt.leg++; if (miss) cnt.legMiss++; } else { cnt.other++; if (miss) cnt.otherMiss++; }
  return r;
};
const od = LegDrive.prototype.drive;
LegDrive.prototype.drive = function () { inDrive = this; cnt.drives++; try { return od.call(this); } finally { inDrive = null; } };
const n = Math.round(+(args.secs ?? 10) / DT);
for (let i = 0; i < n; i++) G.step();
const d = cnt.drives;
console.log(`흉내 ${(n * DT).toFixed(1)} s · drive 부름 ${d} (싸움꾼 × 스텝)`);
console.log(`다리 몸 일곱(골반 · 허벅지 · 정강이 · 발 × 2)의 angvel: 싸움꾼 · 스텝마다 ${(cnt.leg / d).toFixed(2)} 번 (새 Vector3 같은 수) · 그 가운데 엔진까지 간 것 ${(cnt.legMiss / d).toFixed(2)} 번 (RawVector + 껍데기 더)`);
console.log(`drive 가 원래 읽던 다른 몸(몸통 · 팔 · 칼)의 angvel: 싸움꾼 · 스텝마다 ${(cnt.other / d).toFixed(2)} 번 · 엔진까지 ${(cnt.otherMiss / d).toFixed(2)} 번`);
