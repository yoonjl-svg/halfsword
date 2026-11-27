// r33 런지 장면 공용 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음). lunge_trace.mjs · lunge_scene.mjs · lunge_reso.mjs 가 씀.
//  runLunge(M, H, seed, W, opt) = tools/sim/wb_measure.mjs runThrust 와 같은 틀(서 있는 과녁 · 상대 칼 치움 · 쟁기 손 패드 1.2 s · 고요 0.8 s · 탭)에
//   opt.walk (s) 만 더함: 처음에 스틱을 앞으로 walk 초 밀었다 놓음(사람 조종과 같은 길 — P.move) → 몸이 펜싱 자세(두 발 앞뒤 guardLength)로 섬.
//   walk 0 이면 runThrust 와 같은 장면(태어난 자리 그대로 · 두 발 나란함 — 앞뒤 0.0 m · 옆 0.19 m).
//  opt.gap = 탭 때 골반 간격(수평 · placeE 로 상대를 통째로 옮김 — runThrust 의 pelvisGap 과 같은 셈) · opt.post · opt.onTap(G,P,E) · opt.onStep(G,P,E,i) · opt.wb (관문 셈 strokeWB) · opt.tap = (P) => bool (기본 P.skill.thrust())
export function runLunge(M, H, seed, W, opt = {}) {
  const { DT } = H; const R = (() => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const PADS = [[0.18, -0.28], [0.22, 0.26], [0.0, 0.03]]; const pad = PADS[Math.floor(R() * 3)].map((v) => v + (R() - 0.5) * 0.06); R(); // (runThrust 와 같은 난수 차례 · 씨앗 간격 몫은 버림)
  const gap = opt.gap ?? 2.58;
  const G = H.newRound({ walls: false, gap: gap + (opt.walk ? 0.6 : 0), seed, weapon: W, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player, E = G.enemy;
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.skill.level = 0.7; P.skill.autoGuard = true; M.setHand(P, [0.18, -0.28]); M.setHand(E, [0, -0.5]);
  const line = []; const hits = M.hookHits(G, P, E, () => line.length);
  const nW = Math.round((opt.walk ?? 0) / DT);
  for (let i = 0; i < nW; i++) { P.move.set(0, 1); G.step(); const s = M.sample(P); if (s) line.push(s); }
  for (let i = 0; i < Math.round(1.2 / DT); i++) { const off = P.handOffset; const dx = pad[0] - off.x, dy = pad[1] - off.y, d = Math.hypot(dx, dy); if (d > DT) { off.x += (dx / d) * DT; off.y += (dy / d) * DT; } else off.set(pad[0], pad[1]); P.move.set(0, 0); G.step(); const s = M.sample(P); if (s) line.push(s); }
  const placeE = () => { const pp = P.bodies.pelvis.translation(), ep = E.bodies.pelvis.translation(); const d = Math.hypot(ep.x - pp.x, ep.z - pp.z), k = (gap - d) / d, dx = (ep.x - pp.x) * k, dz = (ep.z - pp.z) * k; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); } };
  for (let i = 0; i < Math.round(0.8 / DT); i++) { if (i === 0 || i === Math.round(0.4 / DT)) placeE(); P.move.set(0, 0); G.step(); const s = M.sample(P); if (s) line.push(s); }
  hits.length = 0; const o = line.length; opt.onTap?.(G, P, E); const ok = opt.tap ? opt.tap(P) : P.skill.thrust();
  for (let i = 0; i < Math.round((opt.post ?? 1.5) / DT); i++) { P.move.set(0, 0); G.step(); const s = M.sample(P); if (!s) break; line.push(s); opt.onStep?.(G, P, E, i); }
  M.freeWorld(G);
  if (opt.wb) return ok ? { seed, gap, path: 'human', ...M.strokeWB(line, o, hits, 'thrust') } : null;
  return { ok, line, o, hits, pad };
}
