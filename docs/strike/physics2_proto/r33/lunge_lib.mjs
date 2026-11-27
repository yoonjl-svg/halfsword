// r33 런지 장면 공용 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음). lunge_trace.mjs · lunge_scene.mjs 가 씀.
//  runLunge(M, H, seed, W, opt) = tools/sim/wb_measure.mjs runThrust 와 같은 틀(서 있는 과녁 · 상대 칼 치움 · 쟁기 손 패드 · 고요 0.8 s · 탭)에
//   opt.walk (s) 만 더함: 처음에 스틱을 앞으로 walk 초 밀었다 놓음(사람 조종과 같은 길 — P.move) → 몸이 펜싱 자세(두 발 앞뒤 guardLength)로 섬.
//   walk 0 이면 태어난 자리 그대로(두 발 나란함 — 앞뒤 0.0 m · 옆 0.19 m).
//  씨앗마다 실제로 다른 판 (짓기 1 고침 — 반박이 짚은 흠: 예전엔 손 패드 세 갈래 ± 3 cm 만 바뀌어 여러 씨앗이 같은 판):
//   ① 탭 때 골반 간격 gap ± 0.05 m ② 걸어 들어오는 시간 walk × 0.75 ~ 1.25 (걸음 박자가 달라 선 자세의 두 발 자리가 바뀜) · 패드 잡는 시간 1.0 ~ 1.4 s
//   ③ 상대를 놓는 쪽을 지금 바라보는 쪽에서 ± 6° 돌림(몸이 돌아서며 발을 고쳐 디딤). opt.fixed = true 면 ①~③ 없이 예전 판(바탕 비교용).
//  opt.gap = 탭 때 골반 간격(수평 · placeE 로 상대를 통째로 옮김) · opt.post · opt.onTap(G,P,E) · opt.onStep(G,P,E,i) · opt.wb (관문 셈 strokeWB + 아래 덧셈) · opt.tap = (P) => bool (기본 P.skill.thrust())
//  wb 덧셈: comPk = 탭 ~ 맞음(못 맞으면 1.5 s) 무게중심(온몸 + 칼) 앞 빠르기 최고 · comRatio = comPk ÷ 손 최고 · vHit = 센 맞음의 맞닿는 빠르기(칼 − 맞은 몸체, 그 점에서) · gapUsed · walkUsed · yawDeg
export function runLunge(M, H, seed, W, opt = {}) {
  const { DT } = H; const R = (() => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const PADS = [[0.18, -0.28], [0.22, 0.26], [0.0, 0.03]]; const pad = PADS[Math.floor(R() * 3)].map((v) => v + (R() - 0.5) * 0.06); R(); // (runThrust 와 같은 난수 차례)
  const vary = !opt.fixed;
  const dGap = vary ? (R() - 0.5) * 0.1 : 0; const kWalk = vary ? 0.75 + 0.5 * R() : 1; const tPad = vary ? 1.0 + 0.4 * R() : 1.2; const yaw = vary ? ((R() - 0.5) * 12 * Math.PI) / 180 : 0;
  const gap = (opt.gap ?? 2.58) + dGap; const walk = (opt.walk ?? 0) * kWalk;
  const G = H.newRound({ walls: false, gap: gap + (walk ? 0.6 : 0), seed, weapon: W, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player, E = G.enemy;
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.skill.level = 0.7; P.skill.autoGuard = true; M.setHand(P, [0.18, -0.28]); M.setHand(E, [0, -0.5]);
  const line = []; const hits = M.hookHits(G, P, E, () => line.length);
  const vHits = []; { const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, point, pr, ...x) => { ow?.(A, Vc, r, point, pr, ...x); if (A === P && Vc === E && point) { let v = null; try { const a = P.sword.velocityAtPoint(point); const rb = pr?.vc?.parent?.(); const b = rb ? rb.velocityAtPoint(point) : { x: 0, y: 0, z: 0 }; v = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); } catch { /* */ } vHits.push({ i: line.length, v, E: r?.energy ?? null }); } }; }
  const nW = Math.round(walk / DT);
  for (let i = 0; i < nW; i++) { P.move.set(0, 1); G.step(); const s = M.sample(P); if (s) line.push(s); }
  for (let i = 0; i < Math.round(tPad / DT); i++) { const off = P.handOffset; const dx = pad[0] - off.x, dy = pad[1] - off.y, d = Math.hypot(dx, dy); if (d > DT) { off.x += (dx / d) * DT; off.y += (dy / d) * DT; } else off.set(pad[0], pad[1]); P.move.set(0, 0); G.step(); const s = M.sample(P); if (s) line.push(s); }
  // 상대 놓기: 지금 내 골반 → 상대 골반 쪽을 yaw 만큼 돌린 쪽 · 간격 gap (상대 몸을 통째로 옮김 — 상대는 재는 몸이 아님)
  const placeE = (rot) => { const pp = P.bodies.pelvis.translation(), ep = E.bodies.pelvis.translation(); let ux = ep.x - pp.x, uz = ep.z - pp.z; const d = Math.hypot(ux, uz); ux /= d; uz /= d;
    if (rot) { const c = Math.cos(rot), s = Math.sin(rot); [ux, uz] = [ux * c - uz * s, ux * s + uz * c]; }
    const dx = pp.x + ux * gap - ep.x, dz = pp.z + uz * gap - ep.z; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); } };
  for (let i = 0; i < Math.round(0.8 / DT); i++) { if (i === 0) placeE(yaw); else if (i === Math.round(0.4 / DT)) placeE(0); P.move.set(0, 0); G.step(); const s = M.sample(P); if (s) line.push(s); }
  hits.length = 0; vHits.length = 0; const o = line.length; opt.onTap?.(G, P, E); const ok = opt.tap ? opt.tap(P) : P.skill.thrust();
  for (let i = 0; i < Math.round((opt.post ?? 1.5) / DT); i++) { P.move.set(0, 0); G.step(); const s = M.sample(P); if (!s) break; line.push(s); opt.onStep?.(G, P, E, i); }
  M.freeWorld(G);
  const extra = { gapUsed: +gap.toFixed(3), walkUsed: +walk.toFixed(3), yawDeg: +((yaw * 180) / Math.PI).toFixed(1) };
  if (opt.wb) {
    if (!ok) return null;
    const r = { seed, gap, path: 'human', ...M.strokeWB(line, o, hits, 'thrust'), ...extra };
    const L0 = line[o]; let ux = L0.fx - L0.px, uz = L0.fz - L0.pz; const gl = Math.hypot(ux, uz); ux /= gl; uz /= gl;
    const iHit = hits.find((i) => i >= o) ?? null; const e = Math.min(line.length - 1, iHit ?? o + Math.round(1.5 / DT));
    let cpk = -Infinity; for (let i = o; i <= e; i++) { const s = line[i]; cpk = Math.max(cpk, (s.Px * ux + s.Pz * uz) / s.M); }
    r.comPk = cpk; r.comRatio = r.handPk > 0 ? cpk / r.handPk : null;
    const vh = vHits.filter((h) => h.i >= o && h.v != null); r.vHit = vh.length ? vh.reduce((m, h) => ((h.E ?? 0) > (m.E ?? 0) ? h : m)).v : null;
    return r;
  }
  return { ok, line, o, hits, pad, ...extra };
}
