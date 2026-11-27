// 칼 팔 위팔 명령이 한 스텝에 20° 넘게 뛴 스텝의 형편 (읽기만 — 미리 싣는 재기): ROOT=<나무> node --import file://<이 파일> tools/sim/fights12.mjs
const root = process.env.ROOT;
const { Fighter } = await import(root + '/src/fighter.js');
const { JOINTS } = await import(root + '/src/config.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const st = new WeakMap();
const ik = Fighter.prototype.armIK;
const HD = 180 / Math.PI;
let n = 0;
Fighter.prototype.armIK = function (target, alignDir = null) {
  const sw0 = this.swivelTh || 0;
  const r = ik.call(this, target, alignDir);
  if (!this._ikMain) return r;
  n++;
  const u = new THREE.Vector3(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
  const c = this.bodies.chest.translation();
  const T = new THREE.Vector3(target.x - c.x, target.y - c.y, target.z - c.z);
  const S = st.get(this);
  if (S) {
    const d = Math.acos(Math.max(-1, Math.min(1, u.dot(S.u)))) * HD;
    if (d > 20) {
      const tp = this.skill?.tap;
      process.stderr.write(`명령 뜀 ${d.toFixed(1)}° · 본 부름 ${n} · 싸움꾼 ${this.index} ${this.weapon?.id} · 칼 ${this.armed} (앞 ${S.armed}) · 상태 ${this.state} (앞 ${S.state}) · 탭 ${tp ? `t ${tp.t.toFixed(2)} go ${!!tp.go} down ${!!tp.down}` : '-'} · 줍기 ${!!this.pickup} · 비기 ${!!this.iai || !!this.skill?.sec} · 팔꿈치 돌림 ${(sw0 * HD).toFixed(0)} → ${((this.swivelTh || 0) * HD).toFixed(0)} · 손 목표 옮김 ${T.distanceTo(S.T).toFixed(3)} m · 두 팔 붙음 ${!!this._clrOn}\n`);
    }
  }
  st.set(this, { u, T, armed: this.armed, state: this.state });
  return r;
};
