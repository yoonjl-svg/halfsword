// r22 부호 검사: 칸 안에서 (cd <칸> && node <이 파일> --root=. [--J=40])
//  1) 축 검사 (선 자세 2 s 뒤, 두 다리): 무릎 · 엉덩이 · 발목 축의 + 회전이 어느 쪽 움직임인지 기하로 읽는다.
//     무릎: (zT × (발목 − 무릎)) · 앞 > 0 → 정강이 +z = 무릎 폄 · 엉덩이: (zT × (무릎 −엉덩이)) · 앞 > 0 → 허벅지 +z = 엉덩이 굽힘 ·
//     발목: (zF × xF) · 위 > 0 → 발 +z = 발등 굽힘 (곧 발바닥 굽힘 토크 = 발이 받는 −τ_z < 0 ⇔ t_z > 0, legs_vmc.js 주석과 맞는지)
//  2) 가라앉기 · 일어서기: 장면 sink = 2 s 선 뒤 골반 · 가슴에 아래로 J N·s (나눠) → 골반이 내려가는 동안(vy < −0.05) 'sink' · 되올라오는 동안(vy > 0.05) 'rise'.
//     장면 lift = 같은 크기를 위로 → 올라가는 동안 'rise' · 내려가는 동안 'sink'. 1.5 s 동안 잰다. 상대는 멀리 치우고(park) 그 몸의 다리 값은 세지 않음.
//     칸 코드(clE)가 딛은 다리(ankleOn)의 축마다 편심 표시 몫 · 평균 s 를 창(window)마다 쌓는다. 이 파일은 같은 창에서 무릎 굽힘 빠르기(기하)와 w = (ω허벅지 − ω정강이) · zT 의 부호가 맞는지 따로 센다.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { THREE } = H;
const DT = H.DT, J = +(args.J ?? 40);
const V3 = () => new THREE.Vector3();
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

function scene(name, dir) {
  globalThis.__ecc = {}; globalThis.__eccWin = null;
  const G = H.newRound({ walls: false, weapon: 'longsword', seed: 100 });
  G.park();
  const P = G.player, E = G.enemy, D = P.legDrive;
  const es = E.step.bind(E);
  E.step = (dt) => { const w = globalThis.__eccWin; globalThis.__eccWin = null; es(dt); globalThis.__eccWin = w; };
  const settle = Math.round(2.0 / DT), n = settle + Math.round(1.5 / DT);
  const axis = {}, kn = { sink: { n: 0, ok: 0, ext: 0, cnt: 0 }, rise: { n: 0, ok: 0, ext: 0, cnt: 0 } }, prevPhi = {};
  let minY = 9, maxY = 0, y0 = 0;
  const zT = V3(), zF = V3(), xF = V3(), a = V3(), b = V3();
  const phiOf = (L) => { const len = L.ph.distanceTo(L.pa); const c = Math.min(1, Math.max(-1, (L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS))); return Math.PI - Math.acos(c); };
  for (let i = 0; i < n; i++) {
    if (i === settle) {
      y0 = P.bodies.pelvis.translation().y;
      // 축 검사 (지금 자세)
      const fwd = V3().set(Math.cos(P.heading), 0, -Math.sin(P.heading));
      for (const k of ['F', 'B']) {
        const L = D.legs[k];
        zT.set(0, 0, 1).applyQuaternion(L.qT); zF.set(0, 0, 1).applyQuaternion(L.qF); xF.set(1, 0, 0).applyQuaternion(L.qF);
        axis[k] = {
          knee: a.copy(zT).cross(b.copy(L.pa).sub(L.pk)).dot(fwd),
          hip: a.copy(zT).cross(b.copy(L.pk).sub(L.ph)).dot(fwd),
          ankle: a.copy(zF).cross(xF).y,
        };
      }
      const s = dir * J;
      P.bodies.pelvis.applyImpulse({ x: 0, y: s / 2, z: 0 }, true);
      P.bodies.chest.applyImpulse({ x: 0, y: s / 2, z: 0 }, true);
    }
    let win = null;
    if (i >= settle) { const vy = P.bodies.pelvis.linvel().y; win = vy < -0.05 ? 'sink' : vy > 0.05 ? 'rise' : null; }
    globalThis.__eccWin = win;
    G.step();
    if (i >= settle) {
      const y = P.bodies.pelvis.translation().y; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const k of ['F', 'B']) {
        const L = D.legs[k];
        const phi = phiOf(L), dphi = prevPhi[k] == null ? 0 : (phi - prevPhi[k]) / DT; prevPhi[k] = phi;
        if (!win || !L.on) continue;
        const th = P.bodies[L.thighN], sh = P.bodies[L.shinN], wt = th.angvel(), ws = sh.angvel();
        zT.set(0, 0, 1).applyQuaternion(L.qT);
        const w = (wt.x - ws.x) * zT.x + (wt.y - ws.y) * zT.y + (wt.z - ws.z) * zT.z;
        const K = kn[win]; K.cnt++; if (L.raw.k < 0) K.ext++;
        if (Math.abs(dphi) > 0.2) { K.n++; if (Math.sign(dphi) === Math.sign(w)) K.ok++; }
      }
    } else prevPhi.F = prevPhi.B = null;
  }
  const R = globalThis.__ecc;
  console.log(`\n장면 ${name} (${dir < 0 ? '아래' : '위'}로 ${J} N·s) · 골반 높이 ${f2(y0)} → 가장 낮음 ${f2(minY)} · 가장 높음 ${f2(maxY)} m · 넘어짐 ${P.state ?? '-'}`);
  console.log(`  축 검사 (+ 이면 각각 정강이 +z = 무릎 폄 · 허벅지 +z = 엉덩이 굽힘 · 발 +z = 발등 굽힘): ` + ['F', 'B'].map((k) => `${k} 무릎 ${f2(axis[k].knee)} 엉덩이 ${f2(axis[k].hip)} 발목 ${f2(axis[k].ankle)}`).join(' · '));
  for (const W of ['sink', 'rise']) {
    const K = kn[W];
    console.log(`  창 ${W}: 딛은 다리 스텝 ${K.cnt} · 무릎 날 토크가 폄 쪽 ${K.cnt ? ((100 * K.ext) / K.cnt).toFixed(0) : '-'} % · 무릎 굽힘 빠르기(기하)와 w 부호가 같은 몫 ${K.n ? ((100 * K.ok) / K.n).toFixed(0) : '-'} % (|dφ/dt| > 0.2 인 ${K.n} 스텝)`);
    const r = R[W] ?? {};
    console.log('    ' + ['knee', 'hipZ', 'hipX', 'hipY', 'ankleZ', 'ankleX', 'ankleY'].map((j) => { const o = r[j]; return o ? `${j} 편심 ${((100 * o.ecc) / o.n).toFixed(0)} % s ${(o.sumS / o.n).toFixed(3)}` : `${j} -`; }).join(' · '));
  }
}
scene('sink', -1);
scene('lift', +1);
