// r23 읽기 지적 2 — 한손 탭 찌르기 한 판의 스텝 줄: 찌르기 시계 · 당김 머묾 · 손 목표 당김 몫 · 위팔 돌림 (onehand_arm.test tapRun 그대로 · updateThrust 를 감싸 읽기만)
//  node trace_swivel.mjs --root=<나무> [--w=rapier] [--g=pflug] [--seed=311]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const W = await import(pathToFileURL(join(ROOT, 'tools/sim/wrist_audit.mjs')).href);
const { Skill } = await import(pathToFileURL(join(ROOT, 'src/skill.js')).href);
const { JOINTS } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href);
const _v = new THREE.Vector3(), _qi = new THREE.Quaternion();
const realAlong = (f, tp) => { if (!tp.line) return NaN; const g = f.sword.translation(), c = f.bodies.chest.translation(); _v.set(g.x - c.x, g.y - c.y, g.z - c.z).applyQuaternion(_qi.copy(f.yaw).invert()); return (_v.x - tp.h0[0]) * tp.line[0] + (_v.y - tp.h0[1]) * tp.line[1] + (_v.z - tp.h0[2]) * tp.line[2]; };
const orig = Skill.prototype.updateThrust; let i = 0;
Skill.prototype.updateThrust = function (dt) {
  const tp = this.tap; const r = orig.call(this, dt);
  if (tp && this.f === globalThis.__P) { const s = W.wristSample(this.f); const h = this.thrustPose.hand; const h0 = tp.h0; const L = tp.line;
    const e = L ? (h[0] - h0[0]) * L[0] + (h[1] - h0[1]) * L[1] + (h[2] - h0[2]) * L[2] : NaN;
    console.log(`${String(i++).padStart(3)} t ${tp.t.toFixed(3)} chT ${(tp.chamberT ?? 0).toFixed(3)} done ${tp.chamberDone ? 1 : 0} ok ${tp.stepOk ? 1 : 0} e ${e.toFixed(3)} real ${realAlong(this.f, tp).toFixed(3)} shRot ${s.shRot == null ? '-' : s.shRot.toFixed(1)}${s.shRot != null && (s.shRot < JOINTS.twist[0] || s.shRot > JOINTS.twist[1]) ? ' OUT' : ''}`); }
  return r;
};
const os = Skill.prototype.thrust; Skill.prototype.thrust = function (...a) { if (!this.f.aiControlled) globalThis.__P = this.f; return os.apply(this, a); };
W.tapRun(String(args.w ?? 'rapier'), String(args.g ?? 'pflug'), { seed: +(args.seed ?? 311) });
