// 12 판 큰 팔 명령 뜀의 형편 (미리 싣는 재기 · 읽기만): ROOT=<나무> LABEL=<이름> [SEED0=12] node --import file://<이 파일> <fights12.mjs 또는 r9b/fights_blk.mjs>
//  칼 팔 = arm_cmd2.mjs 와 같은 셈(armIK 본 부름마다 uarmS.target x 축 바뀜 각) · 빈 팔 = 서 있는 스텝의 uarmO.target 사원수 바뀜 각
//  칼 팔 > 20° · 빈 팔 > OFFT°(기본 170) 인 스텝마다: 판 번호 · 시각 · 싸움꾼 · 뜀 각 + 스텝 앞 → 뒤로 바뀐 것(f.skill · f.aiCtl 의 짧은 값 · 손 목표 · 겨눔 · 빈 아래팔 굽힘 · 돌림 각 · 빈팔 길) → 큰 차례로 10 씩
const root = process.env.ROOT;
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const HD = Math.PI / 180;
const ids = new WeakMap(); let nF = 0;
const id = (f) => { let v = ids.get(f); if (v == null) ids.set(f, (v = nF++)); return v; };
const SEED0 = +(process.env.SEED0 || 0);
const OFFT = +(process.env.OFFT || 170); // 빈 팔 큰 뜀 문턱 (°)
const prim = (v) => v == null ? v : typeof v === 'object' ? (v.isVector3 ? `v(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})` : '{' + ['name', 'type', 'kind', 'st', 'phase', 'key', 'id', 'dir', 'w'].filter((k) => v[k] != null && typeof v[k] !== 'object' && typeof v[k] !== 'function').map((k) => `${k}:${typeof v[k] === 'number' ? +v[k].toFixed(2) : v[k]}`).join(',') + '}') : typeof v === 'number' ? +v.toFixed(3) : typeof v === 'function' ? undefined : v;
function snap(f) {
  const o = {};
  for (const [pre, obj] of [['sk.', f.skill], ['ai.', f.aiCtl]]) if (obj) for (const k of Object.keys(obj)) { const p = prim(obj[k]); if (p !== undefined && !(typeof p === 'string' && p.startsWith('v('))) o[pre + k] = p; }
  Object.assign(o, { state: f.state, armed: f.armed, pickup: !!f.pickup, iai: !!f.iai, placed: !!f.armsPlaced?.(), armS: f.limbs?.armS, armO: f.limbs?.armO, clrOn: !!f._clrOn, swOk: !!f._swGeoOk, thReach: !!f.thReach, opp: f.opponent ? id(f.opponent) : null });
  o._sw = f.swivelTh || 0; o._aim = f.aimDirW?.clone?.(); o._ht = f.handTarget?.clone?.(); o._ax = f.skill?.aim ? [f.skill.aim.x, f.skill.aim.y] : null;
  const fo = f.jointByName?.farmO?.target; o._flexO = fo ? 2 * Math.acos(Math.min(1, Math.abs(fo.w))) / HD : null;
  o._dO = f._offT ?? null; o._pd = f._offPd ?? null; o._raw = f.aimRawW?.clone?.(); o._wfix = f.wristFixDeg ?? 0;
  return o;
}
function diff(a, b) {
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (k.startsWith('_')) continue; if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k}: ${JSON.stringify(a[k])}→${JSON.stringify(b[k])}`); }
  const ang = (u, v) => u && v && u.lengthSq() > 0 && v.lengthSq() > 0 ? Math.acos(Math.max(-1, Math.min(1, u.clone().normalize().dot(v.clone().normalize())))) / HD : 0;
  out.push(`겨눔 ${ang(a._aim, b._aim).toFixed(1)}° (교정 전 ${ang(a._raw, b._raw).toFixed(1)}° · 손목 교정 ${(+a._wfix).toFixed(0)}→${(+b._wfix).toFixed(0)}°)`, `빈 목표 거리 ${a._dO}→${b._dO} · 팔꿈치 쪽 남음 |pDir| ${a._pd}→${b._pd}`, `손 목표 ${a._ht && b._ht ? (a._ht.distanceTo(b._ht) * 100).toFixed(1) : '-'} cm`, `손가락 ${a._ax ? a._ax.map((x) => x.toFixed(2)) : '-'}→${b._ax ? b._ax.map((x) => x.toFixed(2)) : '-'}`, `돌림 ${(a._sw / HD).toFixed(0)}→${(b._sw / HD).toFixed(0)}°`, `빈 아래팔 굽힘 ${a._flexO?.toFixed(1)}→${b._flexO?.toFixed(1)}°`);
  return out.join(' · ');
}
const big = { S: [], O: [] };
const prevS = new WeakMap(), prevO = new WeakMap(), pre = new WeakMap(), swj = new WeakMap(), path = new WeakMap(), prevPath = new WeakMap();
const X = new THREE.Vector3();
const ik = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (...a) {
  const r = ik.apply(this, a);
  if (this._ikMain) {
    const u = X.set(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
    const p = prevS.get(this);
    if (p) { swj.set(this, Math.acos(Math.max(-1, Math.min(1, u.dot(p)))) / HD); p.copy(u); } else prevS.set(this, u.clone());
  }
  return r;
};
for (const m of ['offArmSchool', 'offHand']) { const o = Fighter.prototype[m]; if (o) Fighter.prototype[m] = function (...a) { path.set(this, (path.get(this) || '') + m[3]); return o.apply(this, a); }; }
const oik = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (t, ...a) {
  const c = this.bodies.chest.translation(); const S = new THREE.Vector3(0, 0.1, -this.side * 0.2);
  const T = new THREE.Vector3(t.x - c.x, t.y - c.y, t.z - c.z).applyQuaternion(new THREE.Quaternion().copy(this.bodies.chest.rotation()).invert());
  const D = T.sub(S); this._offT = +D.length().toFixed(3);
  // 빈팔 IK 의 팔꿈치 쪽(pole − (pole·Dn)Dn)이 얼마나 남나: |pDir| 작으면 팔꿈치 면이 정해지지 않음 · 굽힘 거의 0 이면 위팔 굴림(xA)이 정해지지 않음
  const pole = new THREE.Vector3(-0.25, -1, -this.side * 0.5).normalize(); const Dn = D.clone().normalize();
  this._offPd = +pole.clone().addScaledVector(Dn, -pole.dot(Dn)).length().toFixed(3);
  return oik.call(this, t, ...a);
};
const st = Fighter.prototype.step;
const nst = new WeakMap();
Fighter.prototype.step = function (...a) {
  id(this); const ns = (nst.get(this) || 0) + 1; nst.set(this, ns);
  const s0 = snap(this); const pp = path.get(this) || ''; path.set(this, '');
  swj.set(this, 0);
  const r = st.apply(this, a);
  const s1 = snap(this);
  const rec = (k, d) => { const L = big[k]; const pth = path.get(this) || ''; L.push({ d, fight: SEED0 + Math.floor(id(this) / 2) + 1, who: id(this) % 2, t: +(ns / 120).toFixed(3), txt: `${pp ? '빈팔 길 ' + pp + '→' + pth + ' · ' : ''}${diff(s0, s1)}` }); L.sort((x, y) => y.d - x.d); if (L.length > 10) L.pop(); };
  const dS = swj.get(this) || 0; if (dS > 20) rec('S', dS);
  const J = this.jointByName?.uarmO;
  if (J && this.state === 'stand') {
    const p = prevO.get(this);
    if (p) { const d = (2 * Math.acos(Math.min(1, Math.abs(J.target.dot(p))))) / HD; if (d > OFFT) rec('O', d); p.copy(J.target); } else prevO.set(this, J.target.clone());
  } else prevO.delete(this);
  return r;
};
process.on('exit', () => {
  for (const k of ['S', 'O']) { process.stderr.write(`== ${process.env.LABEL ?? ''} ${k === 'S' ? '칼 팔 > 20°' : `빈 팔 > ${OFFT}°`} 큰 차례 10\n`); for (const b of big[k]) process.stderr.write(`${b.d.toFixed(1)}° 판 ${b.fight} 싸움꾼 ${b.who} t ${b.t} | ${b.txt}\n`); }
});
