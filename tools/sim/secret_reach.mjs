// 비기 팔 뻗음 재기 (10/12 사장님 03:0x '비기에서 팔을 좀 더 뻗는 자세 필요할 때가 많은데 지금 관절 제한이 문제야' — docs/strike/cn_combo_play_2026-10-12.md §11). 읽기만.
//  시험 AI 가 서 있는 롱소드 몸(입력 없음)에게 다가가 간격(reach − 0.1) 안에서 비기를 직접 낸다(secretGo — cn_combo_speed.mjs 와 같은 대본). 낸 때부터 경직 전까지 스텝마다:
//   명령 = 칼 팔 역운동학(armIK)에 들어온 손 목표의 어깨 거리 (위팔 + 아래팔 = 1) · 잘림 = 그 목표가 IK 닿는 거리(ikReach)를 넘어 잘린 스텝 몫 ·
//   실제 = 손목(아래팔 몸체 0.13 m)의 어깨 거리 · 팔꿈치 = 실제 굽힘 각(°, 0 = 곧게) · 접힘 = 붙은 거리 접기(closeReach)가 자세 손 깊이보다 짧은 스텝 몫.
//  실행: node tools/sim/secret_reach.mjs [씨앗 수 6]   ·   끔 비교: node tools/sim/with_config.mjs SECRET.secretReach=0 secret_reach.mjs 6
import { newRound, THREE, CONFIG } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';
const N = +(process.argv[2] || 6);
const { ARM } = CONFIG;
const L = ARM.upper + ARM.fore;
const runs = [
  { id: 'qinggang', ctx: { slot: 'geojeong', held: 0 }, nm: '중국 연환 거정세' },
  { id: 'qinggang', ctx: { slot: 'pyodu', held: 0 }, nm: '중국 연환 표두세' },
  { id: 'qinggang', ctx: { slot: 'bongdu', held: 0 }, nm: '중국 연환 봉두세' },
  { id: 'longsword', ctx: { slot: 'ochsR', held: 0, th: { line: 'highR' } }, nm: '독일 비기 (황소 자리 · 들어오는 줄 highR)' },
  { id: 'rapier', ctx: {}, nm: '이탈리아 passata' },
  { id: 'zweihander', ctx: {}, nm: '이베리아 길목' },
  { id: 'uchigatana', ctx: {}, nm: '일본 고노센(발도)' },
];
let cur = null;
const S = new THREE.Vector3();
const q = new THREE.Quaternion();
const shoulderW = (f) => {
  const c = f.bodies.chest.translation();
  const r = f.bodies.chest.rotation();
  return S.set(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(q.set(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(c.x, c.y, c.z));
};
const ik0 = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (target) {
  const r = ik0.call(this, target);
  if (cur && this === cur.f) {
    const d = target.distanceTo(shoulderW(this)) / L;
    cur.cmd = Math.max(cur.cmd, d);
    cur.n++;
    if (this.armFull) cur.clip++;
  }
  return r;
};
const wv = new THREE.Vector3();
for (const R of runs) {
  const acc = { cmd: [], act: [], elb: [], clip: 0, n: 0, fold: 0, steps: 0, fired: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const G = newRound({ walls: false, weapon: 'longsword', weapon2: R.id, seed });
    const me = G.enemy;
    const A = G.ai;
    const Sx = A.secret;
    if (!Sx) break;
    let t0 = null;
    let st = null;
    for (let i = 0; i < 120 * 10; i++) {
      G.step();
      const near = t0 == null && G.t > 2.6 && me.state === 'stand' && G.player.state === 'stand' && me.foeDistance() < A.M.reach - 0.1 && A.secretFree();
      if (near && A.secretGo(Sx, R.ctx)) {
        t0 = G.t;
        acc.fired++;
        st = cur = { f: me, cmd: 0, act: 0, elb: 180, clip: 0, n: 0, fold: 0, steps: 0 };
      }
      if (t0 == null) continue;
      const run = A.secretRun;
      if (!run || run.stage === 'stiff' || G.t - t0 > 1.5) break;
      const fa = me.bodies.farmS;
      const fr = fa.rotation();
      const ft = fa.translation();
      wv.set(0.13, 0, 0).applyQuaternion(q.set(fr.x, fr.y, fr.z, fr.w)).add(new THREE.Vector3(ft.x, ft.y, ft.z));
      st.act = Math.max(st.act, wv.distanceTo(shoulderW(me)) / L);
      const ua = me.bodies.uarmS.rotation();
      const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(ua.x, ua.y, ua.z, ua.w));
      const bx = new THREE.Vector3(1, 0, 0).applyQuaternion(q.set(fr.x, fr.y, fr.z, fr.w));
      st.elb = Math.min(st.elb, (Math.acos(THREE.MathUtils.clamp(ax.dot(bx), -1, 1)) * 180) / Math.PI);
      st.steps++;
      if (me.handBase && me.closeReach() < me.handBase[0] - 1e-3) st.fold++;
    }
    cur = null;
    if (st) {
      acc.cmd.push(st.cmd);
      acc.act.push(st.act);
      acc.elb.push(st.elb);
      acc.clip += st.clip;
      acc.n += st.n;
      acc.fold += st.fold;
      acc.steps += st.steps;
    }
  }
  const av = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  console.log(
    `${R.nm} (${R.id}) 낸 ${acc.fired}/${N}: 명령 최대 ${av(acc.cmd).toFixed(3)} · 실제 최대 ${av(acc.act).toFixed(3)} (모자람 ${((1 - av(acc.act)) * L * 100).toFixed(1)} cm) · 팔꿈치 가장 편 ${av(acc.elb).toFixed(0)}° · IK 잘림 ${acc.n ? ((100 * acc.clip) / acc.n).toFixed(0) : '-'} % · 붙은 접기 ${acc.steps ? ((100 * acc.fold) / acc.steps).toFixed(0) : '-'} %`,
  );
}
