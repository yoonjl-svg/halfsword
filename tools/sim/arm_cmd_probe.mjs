// 팔 명령 재기 (미리 싣는 재기 — 재는 도구 앞에 얹는다 · 읽기만 · 싸움 결과는 안 바뀜)
//  ROOT=<나무> LABEL=<이름> node --import file://<이 파일> <나무>/tools/sim/<재는 도구>.mjs …
//  칼 팔 IK 본 부름(driveSword 의 armIK — _ikMain)마다 위팔 명령 방향(가슴 틀)을 읽어, 끝날 때 한 줄을 stderr 에 찍는다:
//   ① 한 스텝에 JUMP_DEG(20°) 넘게 바뀐 스텝 수 · 가장 큰 바뀜 — 팔꿈치 명령 튐 (여섯째 판 검토가 찾은 흠 · physics2_round6 §3)
//   ② 어깨 밧줄이 달린 몸에서 위팔 명령이 밧줄 면(HUMAN.shoulderPlane · shoulderOn 과 같은 반공간) 밖인 스텝 수 — 몸이 못 가는 자세를 시킨 스텝
//  20° 는 재는 문턱이다(게임 값 아님). 줄 꼴: '팔 명령 <이름>: 스텝 N · 20° 넘게 튐 a · 가장 큰 b° · 밧줄 밖 명령 c (밧줄 단 스텝 M)'
const root = process.env.ROOT;
if (!root) throw new Error('arm_cmd_probe: ROOT=<나무> 가 필요하다');
const { Fighter, HUMAN } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const JUMP_DEG = 20;
const HD = Math.PI / 180;
const N = [HUMAN.shoulderPlane[1] - 90, HUMAN.shoulderPlane[0] + 90].map((c) => [Math.sin(c * HD), Math.cos(c * HD)]);
const prev = new WeakMap();
const st = { n: 0, jump: 0, max: 0, roped: 0, out: 0 };
const X = new THREE.Vector3();
const ik = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (...a) {
  const r = ik.apply(this, a);
  if (this._ikMain) {
    const u = X.set(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
    const p = prev.get(this);
    if (p) {
      const d = Math.acos(Math.max(-1, Math.min(1, u.dot(p)))) / HD;
      st.n++;
      if (d > JUMP_DEG) st.jump++;
      if (d > st.max) st.max = d;
      p.copy(u);
    } else prev.set(this, u.clone());
    if (this.shoulderRopes?.length) {
      st.roped++;
      if (N.some(([s, c]) => s * u.x + this.side * c * u.z < -1e-6)) st.out++;
    }
  }
  return r;
};
process.on('exit', () => process.stderr.write(`팔 명령 ${process.env.LABEL ?? ''}: 스텝 ${st.n} · ${JUMP_DEG}° 넘게 튐 ${st.jump} · 가장 큰 ${st.max.toFixed(1)}° · 밧줄 밖 명령 ${st.out} (밧줄 단 스텝 ${st.roped})\n`));
