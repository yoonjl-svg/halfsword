// ─────────────────────────────────────────────────────────────
//  vs_src.mjs — 오늘 게임을 잰 자료(r12_sources.md §3 · §8)의 수 옆에 놓는 재기 (물리 2.0 열셋째 판 · 재기만 한다 — 몸에 아무것도 걸지 않는다)
//   r11 chain_line.mjs 의 장면 꼴(서 있는 과녁 · 손가락 길 autoGuard · handHeld · inputActive / AI 대 AI)을 따르고, 자료와 견줄 칸을 더 뽑는다.
//  장면:
//   cut     : 서 있는 과녁 · 사람 손가락 길 · 롱소드 — --cut=desc(내려베기: 세로 지붕→바보 · 사선 어깨 지붕→왼 바꿈 반반) | horiz(옆 자세 오른→왼)
//   cutai   : AI 대 AI 롱소드 — --cut=desc(zornhau · zornhauL · oberhau) | horiz(zwerch · zwerchL · zwerchAbtritt — AI 가 실제로 고르는 가로 베기)
//   thrust  : 서 있는 과녁 · 사람 탭 찌르기(main.js 의 탭 = skill.thrust()) — --weapon=rapier|longsword · 겨눔 쟁기 · 황소 · 늘어뜨림 가운데 하나
//   thrustai: AI 대 AI — rapier: 탭 찌르기 길(skill.thrusts 가 는 순간 · 쓰러진 상대 찍기 빼고) · longsword: stich* 기술(자세 지도 길 · 휘두르기 시작)
//  node vs_src.mjs --root=<나무> --scene=cut|cutai|thrust|thrustai [--cut=desc|horiz] [--weapon=rapier|longsword] [--seeds=3001-3060] [--secs=30] [--json=파일]
//  시작(첫 움직임) o: 사람 길 = 손가락이 움직이기 시작한 스텝(베기) · 탭 스텝(찌르기). AI 길 = 휘두르기(skill.swinging)가 켜진 스텝 (rapier AI = 탭 스텝).
//   AI 는 기술이 정해진 스텝 oT(들기 · 감기 · 기다림 포함)도 적는다 — 칸 이름 끝 2 (tHit2 · tTip2 · tLift2) 가 oT 기준.
//  발 닿음 = 발 토막이 땅과 엔진 접촉 충격량 > 0. 뜸 = 3 스텝 내리 떨어짐 · 디딤 = 3 스텝 내리 닿음. 앞발 = 시작 때 앞 자리가 더 앞인 발.
//  뒷다리 앞 밀기 ÷ 체중: pushCmd = 다리 제어기가 뒷발에 바란 수평 땅 반력(관절 토크로 냄) · pushAct = 앞발이 뜨고 뒷발만 닿은 스텝의 몸 전체 앞 운동량 변화율(엔진이 실제 준 밖 힘 · 9 스텝 평균).
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { THREE, DT } = H; const V = (o) => new THREE.Vector3(o.x, o.y, o.z);
const g = 9.81;
function seedList(s) { const out = []; for (const part of String(s).split(',')) { const m = part.match(/^(\d+)-(\d+)$/); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else out.push(+part); } return out; }
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── 한 스텝 표본 ──
function sample(f) {
  if (!f.sword || !f.jointByName.farmS?.joint) return null;
  const B = f.bodies; const fwd = new THREE.Vector3(Math.cos(f.heading), 0, -Math.sin(f.heading));
  const tip = f.bladePoint(1, new THREE.Vector3()); const tipSp = V(f.sword.velocityAtPoint(tip)).length();
  const hp = H.handPos(f); const hv = V(B.farmS.velocityAtPoint(hp));
  const hH = Math.hypot(hv.x, hv.z), hF = hv.x * fwd.x + hv.z * fwd.z;
  const pv = V(B.pelvis.linvel()); const pelF = pv.x * fwd.x + pv.z * fwd.z;
  // 몸 전체 운동량 (토막 + 칼) — 무게중심 빠르기 · 밖 수평 힘(dP/dt)
  let M = 0, Px = 0, Pz = 0; const seen = new Set();
  for (const rb of [...Object.values(B), f.sword]) { if (!rb || seen.has(rb.handle)) continue; seen.add(rb.handle); const m = rb.mass(); const v = rb.linvel(); M += m; Px += m * v.x; Pz += m * v.z; }
  const comF = (Px * fwd.x + Pz * fwd.z) / M; const PF = Px * fwd.x + Pz * fwd.z;
  const D = f.legDrive; const onF = touch(f, B.footF), onB = touch(f, B.footB); // 발이 땅에 닿음 = 엔진이 푼 땅 접촉의 법선 충격량 > 0 (몸이 실제로 딛음 · 다리 제어기 on 깃발이 아님)
  const Gx = (k) => (D?.legs?.[k].on ? D.legs[k].Gx * fwd.x + D.legs[k].Gz * fwd.z : 0);
  const rel = (c) => { const j = f.jointByName[c]; if (!j?.joint) return NaN; return V(j.child.angvel()).sub(V(j.parent.angvel())).length(); };
  const xF = V(B.footF.translation()), xB = V(B.footB.translation()); const pF = xF.x * fwd.x + xF.z * fwd.z, pB = xB.x * fwd.x + xB.z * fwd.z; // 발의 앞 자리 (어느 발이 앞인가)
  return { tipSp, hH, hF, pelF, comF, PF, M, onF, onB, GxF: Gx('F'), GxB: Gx('B'), pF, pB, wHipF: rel('thighF'), wKneeF: rel('shinF'), wAnkF: rel('footF'), wHipB: rel('thighB'), wKneeB: rel('shinB'), wAnkB: rel('footB'), sw: !!f.skill?.swinging, st: f.state, thr: f.skill?.thrusts ?? 0, down: !!f.skill?.tap?.down, mass: f.totalMass };
}

function touch(f, rb) {
  if (!rb) return false; let J = 0;
  for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci); f.world.contactPairsWith(col, (other) => { if (!other.parent()?.isFixed()) return; f.world.contactPair(col, other, (m) => { for (let k = 0, nk = m.numContacts(); k < nk; k++) J += Math.abs(m.contactImpulse(k)); }); }); }
  return J > 1e-6;
}

// ── 한 획 셈 (line = 표본 줄 · o = 시작 스텝 · o2 = 둘째 시작(휘두르기) · hit = 닿은 스텝 or null) ──
// 발이 뜸 = 앞 스텝에 딛었고 이 스텝부터 3 스텝(25 ms) 내리 떠 있음 (한 스텝 깜빡임은 셈 밖)
const offRun = (line, i, on) => line[i - 1][on] && !line[i][on] && !line[i + 1]?.[on] && !line[i + 2]?.[on] && line[i + 2] != null;
const ms = (i) => (i == null ? null : Math.round(i * DT * 1000));
function stroke(line, oT, o2, hit, kind) {
  // o = 칼이 움직이기 시작한 스텝(사람: 손가락 시작 · 탭 / AI: 휘두르기 시작 — 없으면 탭) · oT = AI 기술이 정해진 스텝(들기 · 감기 포함)
  const o = o2 ?? oT; const n = line.length; const a = Math.max(0, o - 36); const end = Math.min(n - 1, hit != null ? hit + 6 : o + 96);
  const r = { tHit: hit != null ? ms(hit - o) : null, tHit2: hit != null ? ms(hit - oT) : null };
  // 칼끝 꼭대기 (시작 ~ 닿기 + 0.05 s · 없으면 0.8 s)
  let iT = o; for (let i = o; i <= end; i++) if (line[i].tipSp > line[iT].tipSp) iT = i;
  r.tipPk = line[iT].tipSp; r.tTip = ms(iT - o); r.tTip2 = ms(iT - oT);
  // 딛는 발: 시작 − 0.3 s ~ (닿기 or 시작 + 0.8 s) 에 처음 뜬 발 · 그 발이 다시 디딘 때
  let lift = null, foot = null; const lend = Math.min(n - 1, hit != null ? hit + 24 : o + 96);
  for (let i = a + 1; i <= lend && lift == null; i++) for (const k of ['F', 'B']) { const on = k === 'F' ? 'onF' : 'onB'; if (offRun(line, i, on)) { lift = i; foot = k; break; } }
  let land = null; if (lift != null) { const on = foot === 'F' ? 'onF' : 'onB'; for (let i = lift + 1; i < Math.min(n - 2, lift + 180); i++) if (line[i][on] && line[i + 1][on] && line[i + 2][on]) { land = i; break; } }
  r.foot = foot; r.front = line[o].pF >= line[o].pB ? 'F' : 'B'; r.tLift = lift != null ? ms(lift - o) : null; r.tLift2 = lift != null ? ms(lift - oT) : null; r.tLand = land != null ? ms(land - o) : null;
  r.footGap = land != null && hit != null ? ms(land - hit) : null;
  // 골반 앞 빠르기: 닿기 바로 앞 · 꼭대기(시작 − 0.3 s ~ 시작 + 1.0 s) · 꼭대기 − 디딤
  r.pelHit = hit != null ? line[Math.max(0, hit - 1)].pelF : null;
  let iP = a; for (let i = a; i <= Math.min(n - 1, o + 120); i++) if (line[i].pelF > line[iP].pelF) iP = i;
  r.pelPk = line[iP].pelF; r.tPel = ms(iP - o); r.pelMinusLand = land != null ? ms(iP - land) : null;
  if (kind === 'thrust') {
    let iH = o; for (let i = o; i <= end; i++) if (line[i].hH > line[iH].hH) iH = i;
    r.handPk = line[iH].hH; r.tHand = ms(iH - o); r.comAtHand = line[iH].comF;
    let iPe = o; for (let i = o; i <= end; i++) if (line[i].pelF > line[iPe].pelF) iPe = i; r.pelPkT = line[iPe].pelF; r.ratio = r.pelPkT / r.handPk;
    // 뒷다리 앞 밀기 ÷ 체중: (ㄱ) 다리 제어기가 뒷발에 바란 땅 반력(관절 토크로 냄) · (ㄴ) 몸 전체 앞 운동량의 변화(dP/dt · 9 스텝 가운데 평균) — 앞발이 떠 있고 뒷발만 딛은 스텝
    const Mg = line[o].mass * g; let cmd = 0, act = null; const FR = line[o].pF >= line[o].pB ? 'F' : 'B', RE = FR === 'F' ? 'B' : 'F'; r.front = FR;
    for (let i = o; i <= end; i++) { cmd = Math.max(cmd, line[i]['Gx' + RE]); if (i >= 4 && i + 4 < n && !line[i]['on' + FR] && line[i]['on' + RE]) { const F = (line[i + 4].PF - line[i - 4].PF) / (8 * DT); act = Math.max(act ?? -Infinity, F); } }
    r.pushCmd = cmd / Mg; r.pushAct = act != null ? act / Mg : null;
    // 뒷다리 엉덩 · 무릎 · 발목 상대 각속도 꼭대기의 때 (시작 ~ 닿기 · 닿기 시간의 %)
    if (hit != null && hit > o) { for (const k of ['wHip', 'wKnee', 'wAnk']) { const K = k + RE; let ib = o; for (let i = o; i <= hit; i++) if (line[i][K] > line[ib][K]) ib = i; r[k] = Math.round((100 * (ib - o)) / (hit - o)); r[k + 'v'] = line[ib][K]; } }
    // 손 · 발 시간차: 손 움직임 시작(손의 수평 앞 빠르기 − 골반 앞 빠르기 > 0.5 m/s 인 첫 스텝 · 시작 − 0.2 s 부터) − 앞발 뜸
    let hs = null; for (let i = Math.max(0, o - 24); i <= end; i++) if (line[i].hF - line[i].pelF > 0.5) { hs = i; break; }
    let fl = null; for (let i = Math.max(1, o - 24); i <= end; i++) if (offRun(line, i, 'on' + FR)) { fl = i; break; }
    r.tHandStart = hs != null ? ms(hs - o) : null; r.tFrontLift = fl != null ? ms(fl - o) : null; r.handFoot = hs != null && fl != null ? ms(fl - hs) : null; // + = 손이 앞발보다 먼저
  }
  return r;
}

const CUT_PAD = { Tag: [0.02, 0.52], Alber: [0, -0.5], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], SideR: [0.52, 0.06], SideL: [-0.52, 0.06] };
function setHand(f, xy) { f.handOffset.set(xy[0], xy[1]); for (const k of ['prev', 'aim', 'aimRaw']) f.skill[k]?.set(xy[0], xy[1]); f.skill.anchor?.set(xy[0], xy[1]); f.skill.aimVel?.set(0, 0); f.skill.vel?.set(0, 0); f.skill.follow?.set(0, 0); }
function hookHits(G, att, vic, getI) { const hits = []; const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (A === att && Vc === vic) hits.push(getI()); }; return hits; }

/** 사람 손가락 베기 · 서 있는 과녁 (chain_line runStand 와 같은 장면 · 가로 베기 꼴을 더함) */
function runCut(seed, cut) {
  const R = rng(seed); let a, b, form;
  if (cut === 'horiz') { a = CUT_PAD.SideR; b = CUT_PAD.SideL; form = 'horiz'; } else { const diag = R() < 0.5; a = diag ? CUT_PAD.ShR : CUT_PAD.Tag; b = diag ? CUT_PAD.WechselL : CUT_PAD.Alber; form = diag ? 'diag' : 'vert'; }
  const ch = a.map((v) => v + (R() - 0.5) * 0.08), en = b.map((v) => v + (R() - 0.5) * 0.08); const v = 10 + R() * 4; const gap0 = 1.5 + R() * 0.35;
  class Passive { update() {} }
  const G = H.newRound({ walls: false, weapon: 'longsword', weapon2: 'longsword', seed, AIClass: Passive }); const P = G.player, E = G.enemy;
  P.skill.level = 0.7; P.skill.autoGuard = true;
  const dx = P.pelvisPos.x + gap0 - E.pelvisPos.x; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z }, true); }
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.handOffset.set(ch[0], ch[1]); P.handHeld = true; P.inputActive = false;
  const line = []; const hits = hookHits(G, P, E, () => line.length);
  for (let i = 0; i < Math.round(3.5 / DT); i++) { P.move.set(0, 0); E.move.set(0, 0); G.step(); const s = sample(P); if (s) line.push(s); }
  const o = line.length; let iSw = null, tEnd = 0; hits.length = 0;
  for (let k = 0; k < Math.round(2.0 / DT); k++) {
    const off = P.handOffset; const ddx = en[0] - off.x, ddy = en[1] - off.y, d = Math.hypot(ddx, ddy), st = v * DT;
    if (d > st) { off.x += (ddx / d) * st; off.y += (ddy / d) * st; } else if (d > 0) off.set(en[0], en[1]);
    if (d > 0) tEnd = k; P.inputActive = d > 0; P.handHeld = k <= tEnd + Math.round(0.15 / DT);
    P.move.set(0, 0); E.move.set(0, 0); G.step(); const s = sample(P); if (!s) break; line.push(s);
    if (iSw == null && s.sw) iSw = line.length - 1;
  }
  try { G.world.free(); } catch { /* */ }
  const hit = hits.find((i) => i >= o) ?? null; const r = stroke(line, o, o, hit, "cut");
  return [{ seed, form, ...r }];
}

/** AI 대 AI 롱소드 — 베기 기술 획 */
function runCutAI(seed, cut, secs) {
  const NAMES = cut === 'horiz' ? new Set(['zwerch', 'zwerchL', 'zwerchAbtritt']) : new Set(['zornhau', 'zornhauL', 'oberhau']);
  const G = H.newRound({ walls: true, seed, weapon: 'longsword', AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
  return fightLoop(G, ais, secs, (f, s, prev, st) => {
    const tech = ais.get(f)?.tech; const tn = tech?.name;
    if (tech !== st.lastTech) { st.lastTech = tech; st.techAt = NAMES.has(tn) ? s : null; st.techName = tn; }
    if (s > 0 && st.techAt != null && f.skill.swinging && !st.prevSw && f.state === 'stand') { const ev = { o: st.techAt, o2: s, tech: st.techName }; st.techAt = null; st.prevSw = true; return ev; }
    st.prevSw = !!f.skill.swinging; return null;
  }, 'cut');
}

/** AI 대 AI 찌르기 */
function runThrustAI(seed, weapon, secs) {
  const G = H.newRound({ walls: true, seed, weapon, weapon2: weapon, AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
  const STICH = new Set(['stichPflug', 'stichPflugL', 'stichOchs', 'stichOchsL', 'stichAlber']);
  return fightLoop(G, ais, secs, (f, s, prev, st) => {
    const tech = ais.get(f)?.tech;
    if (weapon === 'rapier') { const th = f.skill?.thrusts ?? 0; const ev = th > (st.th ?? th) && !f.skill.tap?.down && f.state === 'stand' ? { o: s, o2: null, tech: tech?.name ?? '?' } : null; st.th = th; return ev; }
    if (tech !== st.lastTech) { st.lastTech = tech; st.techAt = STICH.has(tech?.name) ? s : null; st.techName = tech?.name; }
    if (st.techAt != null && f.skill.swinging && !st.prevSw && f.state === 'stand') { const ev = { o: st.techAt, o2: s, tech: st.techName }; st.techAt = null; st.prevSw = true; return ev; }
    st.prevSw = !!f.skill.swinging; return null;
  }, 'thrust');
}

function fightLoop(G, ais, secs, detect, kind) {
  const F = [G.player, G.enemy]; const L = new Map(F.map((f) => [f, []])); const ST = new Map(F.map((f) => [f, {}])); const EV = new Map(F.map((f) => [f, []])); const HI = new Map(F.map((f) => [f, []]));
  const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (L.has(A) && Vc !== A) HI.get(A).push(L.get(A).length); };
  const dead = new Set();
  for (let k = 0; k < Math.round(secs / DT); k++) {
    G.step();
    for (const f of F) { if (dead.has(f)) continue; const s = sample(f); if (!s || !f.alive) { dead.add(f); continue; } const ln = L.get(f); ln.push(s); const ev = detect(f, ln.length - 1, ln[ln.length - 2], ST.get(f)); if (ev) EV.get(f).push(ev); }
  }
  try { G.world.free(); } catch { /* */ }
  const out = [];
  for (const f of F) {
    const ln = L.get(f); const ev = EV.get(f);
    for (let j = 0; j < ev.length; j++) {
      const e = ev[j]; const next = ev[j + 1]?.o ?? Infinity; const o2 = e.o2 ?? e.o;
      if (ln.length - 1 < o2 + 130) continue; // 끝이 잘린 획은 버림
      const hit = HI.get(f).find((i) => i >= o2 && i <= o2 + 120 && i < next) ?? null;
      out.push({ tech: e.tech, ...stroke(ln, e.o, e.o2, hit, kind) });
    }
  }
  return out;
}

/** 사람 탭 찌르기 · 서 있는 과녁 (finish_thrust standTrial 꼴 · 상대 칼 치움) */
function runThrust(seed, weapon) {
  const R = rng(seed); const PADS = [[0.18, -0.28], [0.22, 0.26], [0.0, 0.03]]; const pad = PADS[Math.floor(R() * 3)].map((v) => v + (R() - 0.5) * 0.06); const gap = 1.3 + R() * 0.45;
  const G = H.newRound({ walls: false, gap, seed, weapon, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player, E = G.enemy;
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.skill.level = 0.7; P.skill.autoGuard = true; setHand(P, [0.18, -0.28]); setHand(E, [0, -0.5]);
  const line = []; const hits = hookHits(G, P, E, () => line.length);
  for (let i = 0; i < Math.round(1.2 / DT); i++) { const off = P.handOffset; const dx = pad[0] - off.x, dy = pad[1] - off.y, d = Math.hypot(dx, dy); if (d > DT) { off.x += (dx / d) * DT; off.y += (dy / d) * DT; } else off.set(pad[0], pad[1]); P.move.set(0, 0); G.step(); const s = sample(P); if (s) line.push(s); }
  for (let i = 0; i < Math.round(0.8 / DT); i++) { P.move.set(0, 0); G.step(); const s = sample(P); if (s) line.push(s); }
  hits.length = 0; const o = line.length; const ok = P.skill.thrust();
  for (let i = 0; i < Math.round(1.2 / DT); i++) { P.move.set(0, 0); G.step(); const s = sample(P); if (!s) break; line.push(s); }
  try { G.world.free(); } catch { /* */ }
  const hit = hits.find((i) => i >= o) ?? null;
  return ok ? [{ seed, gap, ...stroke(line, o, null, hit, "thrust") }] : [];
}

// ── 요약 ──
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const cnt = (a) => a.filter((x) => x != null && Number.isFinite(x)).length;
function summ(rows, keys) { const o = { n: rows.length }; for (const k of keys) { const a = rows.map((r) => r[k]); o[k] = { n: cnt(a), p10: q(a, 0.1), med: q(a, 0.5), p90: q(a, 0.9) }; } return o; }

const scene = String(args.scene ?? 'cut'); const seeds = seedList(args.seeds ?? '3001-3040'); const cut = String(args.cut ?? 'desc'); const weapon = String(args.weapon ?? 'rapier'); const secs = +(args.secs ?? 30);
if (/estoc|sabre/.test(weapon)) throw new Error('이 무기는 쓰지 않는다');
let rows = [];
for (const s of seeds) {
  if (scene === 'cut') rows.push(...runCut(s, cut)); else if (scene === 'cutai') rows.push(...runCutAI(s, cut, secs));
  else if (scene === 'thrust') rows.push(...runThrust(s, weapon)); else if (scene === 'thrustai') rows.push(...runThrustAI(s, weapon, secs));
}
const KC = ['tHit', 'tHit2', 'tipPk', 'tTip', 'tTip2', 'tLift', 'tLift2', 'tLand', 'footGap', 'pelHit', 'pelPk', 'tPel', 'pelMinusLand'];
const KT = ['tHit', 'tHit2', 'handPk', 'tHand', 'pelPkT', 'ratio', 'comAtHand', 'pushCmd', 'pushAct', 'wHip', 'wKnee', 'wAnk', 'wHipv', 'wKneev', 'wAnkv', 'tHandStart', 'tFrontLift', 'handFoot', 'tipPk', 'tLand', 'footGap'];
const S = summ(rows, /thrust/.test(scene) ? KT : KC);
const gaps = rows.map((r) => r.footGap).filter((x) => x != null); S.gap50 = gaps.length ? gaps.filter((x) => Math.abs(x) <= 50).length / gaps.length : NaN;
S.hitN = rows.filter((r) => r.tHit != null).length; S.liftN = rows.filter((r) => r.tLift != null).length;
if (/thrust/.test(scene)) { const hr = rows.filter((r) => r.wHip != null); S.order = hr.filter((r) => r.wHip <= r.wKnee && r.wKnee <= r.wAnk).length + '/' + hr.length; const hf = rows.filter((r) => r.handFoot != null); S.armFirst = hf.filter((r) => r.handFoot > 0).length + '/' + hf.length; }
const tech = {}; for (const r of rows) if (r.tech) tech[r.tech] = (tech[r.tech] ?? 0) + 1; for (const r of rows) if (r.form) tech[r.form] = (tech[r.form] ?? 0) + 1; S.forms = tech;
const p = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
console.log(`${scene} ${cut} ${scene.startsWith('thrust') ? weapon : 'longsword'} · 씨앗 ${seeds[0]}~${seeds[seeds.length - 1]} · 획 ${S.n} · 맞음 ${S.hitN} · 발 뜸 ${S.liftN} · 꼴 ${JSON.stringify(tech)}`);
for (const k of Object.keys(S)) if (S[k]?.med !== undefined) console.log(`  ${k.padEnd(13)} n ${String(S[k].n).padStart(3)} · 가운데 ${p(S[k].med)} · 10-90 % ${p(S[k].p10)} ~ ${p(S[k].p90)}`);
console.log(`  발 디딤 − 닿음 ±50 ms 안 ${p(100 * S.gap50, 0)} %` + (S.order ? ` · 엉덩→무릎→발목 차례 ${S.order} · 손이 앞발보다 먼저 ${S.armFirst}` : ''));
if (args.json) writeFileSync(String(args.json), JSON.stringify({ args, S, rows }));
