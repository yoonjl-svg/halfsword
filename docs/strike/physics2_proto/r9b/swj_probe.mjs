// 뒷일 1 재기 (읽기만 — 미리 싣는 재기): 팔꿈치 돌림 길을 안 타는 스텝(칼 없음)과 그 뒤 첫 칼 든 스텝에서 위팔 명령이 기본 팔꿈치보다 크게 뛰나
//  ROOT=<inst_aim.py 를 넣은 나무> SCENE=<이름> OUT=<json> node --import file://<이 파일> <재는 도구>
//  본 부름(driveSword armIK) · 밧줄 단 스텝마다: 잇단 위팔 명령 방향(J.uarmS.target 의 x 축 — 가슴 틀) 사이 각 A · 잇단 기본 팔꿈치 위팔 방향(돌림 0 · 밧줄 돌림 없음 — 고리 ud) 사이 각 B.
//  A > 20° 이고 B < 10° 인 스텝을 가름: 집는 스텝(앞 칼 없음 → 칼 든 길) · 놓친 스텝(앞 칼 든 길 → 칼 없음) · 칼 없는 길 안에서 기본 팔꿈치가 밧줄 밖으로 들어감 / 밧줄 안으로 나감 / 그 밖
const root = process.env.ROOT;
const { Fighter, HUMAN } = await import(root + '/src/fighter.js');
const { JOINTS } = await import(root + '/src/config.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const { writeFileSync } = await import('node:fs');
const HD = Math.PI / 180;
const N = [HUMAN.shoulderPlane[1] - 90, HUMAN.shoulderPlane[0] + 90].map((c) => [Math.sin(c * HD), Math.cos(c * HD)]);
const ropeM = (u, side) => Math.min(...N.map(([s, c]) => s * u.x + side * c * u.z));
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) / HD;
const R = { scene: process.env.SCENE ?? '', nonEs: 0, firstEs: 0, firstNon: 0, jump: {}, max: {}, ex: [], out: 0, roped: 0 };
const st = new WeakMap();
const ik = Fighter.prototype.armIK;
globalThis.__A = {};
Fighter.prototype.armIK = function (target, alignDir = null) {
  globalThis.__A.ud = null;
  const r = ik.call(this, target, alignDir);
  if (!this._ikMain) return r;
  const ud = globalThis.__A.ud;
  const es = !alignDir && !!JOINTS.elbowSwivel && !!this.armed && !!this.aimDirW;
  const roped = !!this.shoulderRopes?.length;
  const u = new THREE.Vector3(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
  const S = st.get(this);
  if (roped && ud && S && S.roped && (!es || !S.es)) {
    const kind = es ? '집는 스텝' : S.es ? '놓친 스텝' : S.in0 && ropeM(ud, this.side) < 0 ? '들어감' : !S.in0 && ropeM(ud, this.side) >= 0 ? '나감' : '그 밖';
    if (!es) R.nonEs++;
    if (es) R.firstEs++;
    if (!es && S.es) R.firstNon++;
    const A = ang(u, S.u), B = ang(ud, S.ud);
    if (A > (R.max[kind] ?? 0) && B < 10) R.max[kind] = +A.toFixed(1);
    if (A > 20 && B < 10) {
      R.jump[kind] = (R.jump[kind] ?? 0) + 1;
      if (R.ex.length < 12) R.ex.push({ kind, A: +A.toFixed(1), B: +B.toFixed(1), sw: [+(S.sw / HD).toFixed(0), +((this.swivelTh || 0) / HD).toFixed(0)] });
    }
  }
  if (roped && !es) {
    R.roped++;
    if (ropeM(u, this.side) < -1e-6) R.out++;
  }
  st.set(this, { u, ud: ud ?? S?.ud ?? u, es, roped: roped && !!ud, in0: ud ? ropeM(ud, this.side) >= 0 : true, sw: this.swivelTh || 0 });
  return r;
};
process.on('exit', () => {
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(R));
  process.stderr.write(`swj ${R.scene}: 칼 없는 스텝 ${R.nonEs} · 집는 스텝 ${R.firstEs} · 놓친 스텝 ${R.firstNon} · 뜀(명령 > 20° · 기본 < 10°) ${JSON.stringify(R.jump)} · 가장 큰 명령 뜀(기본 < 10°) ${JSON.stringify(R.max)} · 칼 없는 스텝 밧줄 밖 명령 ${R.out}/${R.roped}\n` + R.ex.map((e) => '   ' + JSON.stringify(e)).join('\n') + '\n');
});
