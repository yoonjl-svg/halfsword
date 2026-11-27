// ─────────────────────────────────────────────────────────────
//  wb_measure.mjs — 온몸 치기 재기의 한 벌 (물리 2.0 스무째 판). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//   r13 vs_src.mjs 의 재는 부분(표본 · 발 닿음 · 획 셈 · 장면)을 여기로 옮겼다. vs_src.mjs 와 wb_gate.mjs 가 둘 다 이 파일을 쓴다 (두 벌로 갈라지지 않게).
//   makeMeasure(H) — H = 잴 나무의 tools/sim/harness_m.mjs (나무마다 다른 harness 를 넘긴다).
//   stroke() = r13 정의 그대로 (vs_src 의 표가 바뀌지 않게) · strokeWB() = 관문 정의 (앞 = 시작 때 과녁 쪽 · 첫 움직임 → 맞음 또는 1.5 s · 넘어짐 · 자세 돌아옴).
// ─────────────────────────────────────────────────────────────

export function seedList(s) { const out = []; for (const part of String(s).split(',')) { const m = part.match(/^(\d+)-(\d+)$/); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else out.push(+part); } return out; }
export function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
export const cnt = (a) => a.filter((x) => x != null && Number.isFinite(x)).length;
export function summ(rows, keys) { const o = { n: rows.length }; for (const k of keys) { const a = rows.map((r) => r[k]); o[k] = { n: cnt(a), p10: q(a, 0.1), med: q(a, 0.5), p90: q(a, 0.9) }; } return o; }

export function makeMeasure(H) {
  const { THREE, DT } = H; const V = (o) => new THREE.Vector3(o.x, o.y, o.z);
  const g = 9.81;
  const ms = (i) => (i == null ? null : Math.round(i * DT * 1000));

  // 발이 땅에 닿음 = 엔진이 푼 땅 접촉의 법선 충격량 > 0 (몸이 실제로 딛음 · 다리 제어기 on 깃발이 아님)
  function touch(f, rb) {
    if (!rb) return false; let J = 0;
    for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci); f.world.contactPairsWith(col, (other) => { if (!other.parent()?.isFixed()) return; f.world.contactPair(col, other, (m) => { for (let k = 0, nk = m.numContacts(); k < nk; k++) J += Math.abs(m.contactImpulse(k)); }); }); }
    return J > 1e-6;
  }

  // ── 한 스텝 표본 (r13 칸 그대로 + 관문이 쓰는 날것 칸: 자리 · 빠르기 벡터 · 상대 골반 · 상태) ──
  function sample(f) {
    if (!f.sword || !f.jointByName.farmS?.joint) return null;
    const B = f.bodies; const fwd = new THREE.Vector3(Math.cos(f.heading), 0, -Math.sin(f.heading));
    const tipP = f.bladePoint(1, new THREE.Vector3()); const tipV = V(f.sword.velocityAtPoint(tipP)); const tipSp = tipV.length();
    const hp = H.handPos(f); const hv = V(B.farmS.velocityAtPoint(hp));
    const hH = Math.hypot(hv.x, hv.z), hF = hv.x * fwd.x + hv.z * fwd.z;
    const pv = V(B.pelvis.linvel()); const pelF = pv.x * fwd.x + pv.z * fwd.z; const pp = B.pelvis.translation();
    let M = 0, Px = 0, Pz = 0; const seen = new Set();
    for (const rb of [...Object.values(B), f.sword]) { if (!rb || seen.has(rb.handle)) continue; seen.add(rb.handle); const m = rb.mass(); const v = rb.linvel(); M += m; Px += m * v.x; Pz += m * v.z; }
    const comF = (Px * fwd.x + Pz * fwd.z) / M; const PF = Px * fwd.x + Pz * fwd.z;
    const D = f.legDrive; const onF = touch(f, B.footF), onB = touch(f, B.footB);
    const Gx = (k) => (D?.legs?.[k].on ? D.legs[k].Gx * fwd.x + D.legs[k].Gz * fwd.z : 0);
    const GxW = (k) => (D?.legs?.[k].on ? [D.legs[k].Gx, D.legs[k].Gz] : [0, 0]);
    const rel = (c) => { const j = f.jointByName[c]; if (!j?.joint) return NaN; return V(j.child.angvel()).sub(V(j.parent.angvel())).length(); };
    const xF = V(B.footF.translation()), xB = V(B.footB.translation()); const pF = xF.x * fwd.x + xF.z * fwd.z, pB = xB.x * fwd.x + xB.z * fwd.z;
    const fp = f.foe?.bodies?.pelvis?.translation();
    return {
      tipSp, hH, hF, pelF, comF, PF, M, onF, onB, GxF: Gx('F'), GxB: Gx('B'), pF, pB, wHipF: rel('thighF'), wKneeF: rel('shinF'), wAnkF: rel('footF'), wHipB: rel('thighB'), wKneeB: rel('shinB'), wAnkB: rel('footB'), sw: !!f.skill?.swinging, st: f.state, thr: f.skill?.thrusts ?? 0, down: !!f.skill?.tap?.down, mass: f.totalMass,
      // 관문 칸 (월드 좌표 · 수평)
      px: pp.x, py: pp.y, pz: pp.z, pvx: pv.x, pvz: pv.z, hvx: hv.x, hvz: hv.z, Px, Pz, fx: fp ? fp.x : NaN, fz: fp ? fp.z : NaN,
      fFx: xF.x, fFz: xF.z, fBx: xB.x, fBz: xB.z, tipx: tipP.x, tipy: tipP.y, tipz: tipP.z, tvx: tipV.x, tvy: tipV.y, tvz: tipV.z, GwF: GxW('F'), GwB: GxW('B'),
      busy: !!f.skill?.tap || !!f.skill?.swinging, alive: !!f.alive,
    };
  }

  // ── 한 획 셈 · r13 정의 (vs_src.mjs 의 표 — 바꾸지 않음) ──
  const offRun = (line, i, on) => line[i - 1][on] && !line[i][on] && !line[i + 1]?.[on] && !line[i + 2]?.[on] && line[i + 2] != null;
  function stroke(line, oT, o2, hit, kind) {
    const o = o2 ?? oT; const n = line.length; const a = Math.max(0, o - 36); const end = Math.min(n - 1, hit != null ? hit + 6 : o + 96);
    const r = { tHit: hit != null ? ms(hit - o) : null, tHit2: hit != null ? ms(hit - oT) : null };
    let iT = o; for (let i = o; i <= end; i++) if (line[i].tipSp > line[iT].tipSp) iT = i;
    r.tipPk = line[iT].tipSp; r.tTip = ms(iT - o); r.tTip2 = ms(iT - oT);
    let lift = null, foot = null; const lend = Math.min(n - 1, hit != null ? hit + 24 : o + 96);
    for (let i = a + 1; i <= lend && lift == null; i++) for (const k of ['F', 'B']) { const on = k === 'F' ? 'onF' : 'onB'; if (offRun(line, i, on)) { lift = i; foot = k; break; } }
    let land = null; if (lift != null) { const on = foot === 'F' ? 'onF' : 'onB'; for (let i = lift + 1; i < Math.min(n - 2, lift + 180); i++) if (line[i][on] && line[i + 1][on] && line[i + 2][on]) { land = i; break; } }
    r.foot = foot; r.front = line[o].pF >= line[o].pB ? 'F' : 'B'; r.tLift = lift != null ? ms(lift - o) : null; r.tLift2 = lift != null ? ms(lift - oT) : null; r.tLand = land != null ? ms(land - o) : null;
    r.footGap = land != null && hit != null ? ms(land - hit) : null;
    r.pelHit = hit != null ? line[Math.max(0, hit - 1)].pelF : null;
    let iP = a; for (let i = a; i <= Math.min(n - 1, o + 120); i++) if (line[i].pelF > line[iP].pelF) iP = i;
    r.pelPk = line[iP].pelF; r.tPel = ms(iP - o); r.pelMinusLand = land != null ? ms(iP - land) : null;
    if (kind === 'thrust') {
      let iH = o; for (let i = o; i <= end; i++) if (line[i].hH > line[iH].hH) iH = i;
      r.handPk = line[iH].hH; r.tHand = ms(iH - o); r.comAtHand = line[iH].comF;
      let iPe = o; for (let i = o; i <= end; i++) if (line[i].pelF > line[iPe].pelF) iPe = i; r.pelPkT = line[iPe].pelF; r.ratio = r.pelPkT / r.handPk;
      const Mg = line[o].mass * g; let cmd = 0, act = null; const FR = line[o].pF >= line[o].pB ? 'F' : 'B', RE = FR === 'F' ? 'B' : 'F'; r.front = FR;
      for (let i = o; i <= end; i++) { cmd = Math.max(cmd, line[i]['Gx' + RE]); if (i >= 4 && i + 4 < n && !line[i]['on' + FR] && line[i]['on' + RE]) { const F = (line[i + 4].PF - line[i - 4].PF) / (8 * DT); act = Math.max(act ?? -Infinity, F); } }
      r.pushCmd = cmd / Mg; r.pushAct = act != null ? act / Mg : null;
      if (hit != null && hit > o) { for (const k of ['wHip', 'wKnee', 'wAnk']) { const K = k + RE; let ib = o; for (let i = o; i <= hit; i++) if (line[i][K] > line[ib][K]) ib = i; r[k] = Math.round((100 * (ib - o)) / (hit - o)); r[k + 'v'] = line[ib][K]; } }
      let hs = null; for (let i = Math.max(0, o - 24); i <= end; i++) if (line[i].hF - line[i].pelF > 0.5) { hs = i; break; }
      let fl = null; for (let i = Math.max(1, o - 24); i <= end; i++) if (offRun(line, i, 'on' + FR)) { fl = i; break; }
      r.tHandStart = hs != null ? ms(hs - o) : null; r.tFrontLift = fl != null ? ms(fl - o) : null; r.handFoot = hs != null && fl != null ? ms(fl - hs) : null;
    }
    return r;
  }

  // ── 한 획 셈 · 관문 정의 (r20 · 글 r20_wb_gate.md §3) ──
  //  iCmd = 획을 부른 스텝(사람 탭 · 손가락 시작 / AI 휘두르기 시작 · 레이피어 AI 탭). hits = 이 몸이 상대에게 낸 상처의 스텝들.
  //  앞 = 시작(iCmd) 때 내 골반 → 상대 골반의 수평 방향 (그 뒤 고정). 첫 움직임 t0 = min(iCmd, 손 시작) · 손 시작 = 손 앞 빠르기 − 골반 앞 빠르기 > 0.5 m/s 인 첫 스텝(iCmd − 0.25 s 부터).
  //  맞음 = t0 ~ t0 + 1.5 s 안의 첫 상처 (다음 획 시작 전). 재는 창 = t0 ~ 맞음 (못 맞으면 t0 + 1.5 s) — 기술 깃발과 무관.
  //  넘어짐 = t0 ~ t0 + 3 s 에 state 가 stand 아님 · 돌아옴 = 끝(맞음 또는 1.5 s) 뒤 3 s(t0 기준) 안에 선 채 두 발 닿고 · 탭/휘두르기 꺼지고 · 골반 높이 ≥ 시작의 90 % 인 스텝.
  function strokeWB(line, iCmd, hits, kind, nextCmd = Infinity) {
    const n = line.length; const W = Math.round(1.5 / DT), R3 = Math.round(3.0 / DT);
    const L0 = line[iCmd]; let ux = L0.fx - L0.px, uz = L0.fz - L0.pz; const gap0 = Math.hypot(ux, uz); ux /= gap0; uz /= gap0;
    const fw = (x, z) => x * ux + z * uz;
    const pelF = (s) => fw(s.pvx, s.pvz), hF = (s) => fw(s.hvx, s.hvz);
    // 손 시작 = 손 앞 − 골반 앞이 0.5 m/s 를 아래에서 위로 넘는 첫 스텝 (읽기 지적 6: 찾기 처음에 이미 넘어 있으면 그 움직임은 앞 동작 → 다시 내려간 뒤 넘는 것만 침 · 못 찾으면 t0 = iCmd)
    const rel = (i) => hF(line[i]) - pelF(line[i]); const lb = Math.max(0, iCmd - Math.round(0.25 / DT));
    let hs = null; for (let i = lb + 1; i < Math.min(n, iCmd + W); i++) if (rel(i) > 0.5 && rel(i - 1) <= 0.5) { hs = i; break; }
    const t0 = hs != null ? Math.min(iCmd, hs) : iCmd;
    const lim = Math.min(n - 1, nextCmd - 1); // 다음 동작(어떤 휘두르기 · 탭이든) 앞까지만 (읽기 지적 5)
    const hit = hits.find((i) => i >= t0 && i <= t0 + W && i <= lim) ?? null; // 상처 스텝 = 그때까지 쌓인 표본 수 → 표본 줄 밖(싸움 끝)이면 셈 밖
    // 창 끝: 맞으면 맞은 스텝 · 못 맞은 찌르기는 칼끝이 상대 골반에 (수평으로) 가장 다가선 스텝 (t0 ~ t0 + 1.5 s · 다음 동작 앞) — 읽기 지적 5
    let end = hit; if (end == null && kind !== 'thrust') end = Math.min(lim, t0 + W); // 베기는 C2(지킴 · r14 의 오늘 범위)와 같은 창을 둠 — 다음 동작 앞까지만 자름
    if (end == null) { const e2 = Math.min(lim, t0 + W); let best = Infinity; end = t0; for (let i = t0; i <= e2; i++) { const d = Math.hypot(line[i].tipx - line[i].fx, line[i].tipz - line[i].fz); if (d < best) { best = d; end = i; } } }
    end = Math.max(t0, Math.min(n - 1, end));
    const r = { gap0, t0rel: ms(t0 - iCmd), t0Edge: rel(lb) > 0.5, hit: hit != null, tHit: hit != null ? (hit - t0) * DT : null, tEnd: (end - t0) * DT };
    // 넘어짐 · 돌아옴
    if (n - 1 < t0 + R3) r.cut = true; // 3 s 를 못 봄 → 셈 밖
    let fell = false; for (let i = t0; i <= Math.min(n - 1, t0 + R3); i++) if (line[i].st !== 'stand') { fell = true; break; }
    let back = null; const y0 = line[t0].py;
    for (let i = end + 1; i <= Math.min(n - 1, t0 + R3); i++) { const s = line[i]; if (s.st === 'stand' && s.onF && s.onB && !s.busy && s.py >= 0.9 * y0) { back = i; break; } }
    r.fell = fell; r.back = back != null; r.tBack = back != null ? (back - t0) * DT : null; r.valid = !r.cut && !fell && back != null;
    // 골반 · 손 · 몸
    let iP = t0, iH = t0, iT = t0; for (let i = t0; i <= end; i++) { if (pelF(line[i]) > pelF(line[iP])) iP = i; if (line[i].hH > line[iH].hH) iH = i; if (line[i].tipSp > line[iT].tipSp) iT = i; }
    r.pelPk = pelF(line[iP]); r.handPk = line[iH].hH; r.ratio = r.pelPk / r.handPk; r.tipPk = line[iT].tipSp; r.tTip = (iT - t0) * DT;
    r.comAtHand = fw(line[iH].Px, line[iH].Pz) / line[iH].M;
    r.pelTravel = fw(line[end].px - L0.px, line[end].pz - L0.pz);
    r.closing = fw(L0.fx - line[end].fx, L0.fz - line[end].fz); // 상대 골반이 t0 ~ 창 끝에 내 쪽으로 온 거리 (+ = 다가옴 · 읽기 지적 4)
    // 앞발 · 뒷발 (시작 때 과녁 쪽으로 더 나간 발)
    const FR = fw(L0.fFx, L0.fFz) >= fw(L0.fBx, L0.fBz) ? 'F' : 'B', RE = FR === 'F' ? 'B' : 'F'; r.front = FR;
    if (kind === 'thrust') {
      const Mg = line[t0].mass * g; let act = null, cmd = 0;
      let fl = null; for (let i = Math.max(1, t0 - 24); i <= end; i++) if (offRun(line, i, 'on' + FR)) { fl = i; break; }
      let fland = null; if (fl != null) for (let i = fl + 1; i < n - 2; i++) if (line[i]['on' + FR] && line[i + 1]['on' + FR] && line[i + 2]['on' + FR]) { fland = i; break; }
      // 뒷다리 밀기는 이 획의 앞발이 뜬 스텝 ~ 내려앉은 스텝 안에서만 (읽기 지적 5: 걷는 걸음의 한 발 딛기를 밀기로 세지 않게)
      const pa = fl ?? Infinity, pb = Math.min(end, fland ?? end);
      for (let i = t0; i <= end; i++) { const G = line[i]['Gw' + RE]; cmd = Math.max(cmd, fw(G[0], G[1])); if (i >= pa && i <= pb && i >= 4 && i + 4 < n && !line[i]['on' + FR] && line[i]['on' + RE]) { const F = (fw(line[i + 4].Px, line[i + 4].Pz) - fw(line[i - 4].Px, line[i - 4].Pz)) / (8 * DT); act = Math.max(act ?? -Infinity, F); } }
      r.pushAct = act != null ? act / Mg : null; r.pushCmd = cmd / Mg;
      // 차례: 꼭대기 스텝이 엉덩 < 무릎 < 발목 (같은 스텝 = 차례 아님 · 읽기 지적 2) · 꼭대기가 맞은 스텝에 걸리면(아직 오르는 중 = 잘린 꼭대기) 셈 밖
      if (hit != null && hit > t0) { const ib = {}; for (const k of ['wHip', 'wKnee', 'wAnk']) { const K = k + RE; let b = t0; for (let i = t0; i <= hit; i++) if (line[i][K] > line[b][K]) b = i; ib[k] = b; r[k] = Math.round((100 * (b - t0)) / (hit - t0)); }
        r.orderTrunc = ib.wHip === hit || ib.wKnee === hit || ib.wAnk === hit; r.orderTie = ib.wHip === ib.wKnee || ib.wKnee === ib.wAnk;
        r.order = r.orderTrunc ? null : ib.wHip < ib.wKnee && ib.wKnee < ib.wAnk ? 1 : 0; }
      const hs2 = hs != null && hs <= end ? hs : null;
      r.handFoot = hs2 != null && fl != null ? (fl - hs2) * DT : null; // + = 손이 앞발보다 먼저
    } else {
      // 베기: 딛는 발 = t0 − 0.3 s ~ 맞음 + 0.2 s 에 처음 뜬 발 · 디딤 = 그 발이 3 스텝 내리 닿은 첫 스텝 · footGap = 디딤 − 맞음 (+ = 칼 먼저)
      let lift = null, foot = null; const a = Math.max(1, t0 - 36), lend = Math.min(n - 3, (hit ?? t0 + W) + 24);
      for (let i = a; i <= lend && lift == null; i++) for (const k of ['F', 'B']) { if (offRun(line, i, 'on' + k)) { lift = i; foot = k; break; } }
      let land = null; if (lift != null) for (let i = lift + 1; i < Math.min(n - 2, lift + 180); i++) if (line[i]['on' + foot] && line[i + 1]['on' + foot] && line[i + 2]['on' + foot]) { land = i; break; }
      r.footGap = land != null && hit != null ? (land - hit) * DT : null;
    }
    return r;
  }

  const CUT_PAD = { Tag: [0.02, 0.52], Alber: [0, -0.5], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], SideR: [0.52, 0.06], SideL: [-0.52, 0.06] };
  function setHand(f, xy) { f.handOffset.set(xy[0], xy[1]); for (const k of ['prev', 'aim', 'aimRaw']) f.skill[k]?.set(xy[0], xy[1]); f.skill.anchor?.set(xy[0], xy[1]); f.skill.aimVel?.set(0, 0); f.skill.vel?.set(0, 0); f.skill.follow?.set(0, 0); }
  function hookHits(G, att, vic, getI) { const hits = []; const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (A === att && Vc === vic) hits.push(getI()); }; return hits; }
  const freeWorld = (G) => { try { G.world.free(); } catch { /* */ } };

  /** 사람 손가락 베기 · 서 있는 과녁 (r13 장면). post = 칼을 끝낸 뒤 더 도는 시간(관문은 3 s 를 봐야 해서 길게) · wb = 관문 셈을 함께 */
  function runCut(seed, cut, opt = {}) {
    const R = rng(seed); let a, b, form;
    if (cut === 'horiz') { a = CUT_PAD.SideR; b = CUT_PAD.SideL; form = 'horiz'; } else { const diag = opt.form ? opt.form === 'diag' : R() < 0.5; if (opt.form) R(); a = diag ? CUT_PAD.ShR : CUT_PAD.Tag; b = diag ? CUT_PAD.WechselL : CUT_PAD.Alber; form = diag ? 'diag' : 'vert'; }
    const ch = a.map((v) => v + (R() - 0.5) * 0.08), en = b.map((v) => v + (R() - 0.5) * 0.08); const v = 10 + R() * 4; const gap0 = 1.5 + R() * 0.35;
    class Passive { update() {} }
    const G = H.newRound({ walls: false, weapon: 'longsword', weapon2: 'longsword', seed, AIClass: Passive }); const P = G.player, E = G.enemy;
    P.skill.level = 0.7; P.skill.autoGuard = true;
    const dx = P.pelvisPos.x + gap0 - E.pelvisPos.x; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z }, true); }
    for (const c of E.swordColliders) c.setCollisionGroups(0);
    P.handOffset.set(ch[0], ch[1]); P.handHeld = true; P.inputActive = false;
    const line = []; const hits = hookHits(G, P, E, () => line.length);
    for (let i = 0; i < Math.round(3.5 / DT); i++) { P.move.set(0, 0); E.move.set(0, 0); G.step(); const s = sample(P); if (s) line.push(s); }
    const o = line.length; let tEnd = 0; hits.length = 0; opt.onStart?.(G, P, E);
    for (let k = 0; k < Math.round((opt.post ?? 2.0) / DT); k++) {
      const off = P.handOffset; const ddx = en[0] - off.x, ddy = en[1] - off.y, d = Math.hypot(ddx, ddy), st = v * DT;
      if (d > st) { off.x += (ddx / d) * st; off.y += (ddy / d) * st; } else if (d > 0) off.set(en[0], en[1]);
      if (d > 0) tEnd = k; P.inputActive = d > 0; P.handHeld = k <= tEnd + Math.round(0.15 / DT);
      P.move.set(0, 0); E.move.set(0, 0); G.step(); const s = sample(P); if (!s) break; line.push(s); opt.onStep?.(G, P, E, k);
    }
    freeWorld(G);
    const hit = hits.find((i) => i >= o) ?? null;
    if (opt.wb) return [{ seed, form, path: 'human', ...strokeWB(line, o, hits, 'cut') }];
    return [{ seed, form, ...stroke(line, o, o, hit, 'cut') }];
  }

  /** AI 대 AI 롱소드 — 베기 기술 획 (r13) */
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

  /** AI 대 AI 찌르기 (r13) */
  function runThrustAI(seed, weapon, secs) {
    const G = H.newRound({ walls: true, seed, weapon, weapon2: weapon, AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
    return fightLoop(G, ais, secs, thrustDetect(weapon, ais), 'thrust');
  }
  const STICH = new Set(['stichPflug', 'stichPflugL', 'stichOchs', 'stichOchsL', 'stichAlber']);
  function thrustDetect(weapon, ais) {
    return (f, s, prev, st) => {
      const tech = ais.get(f)?.tech;
      if (weapon === 'rapier') { const th = f.skill?.thrusts ?? 0; const ev = th > (st.th ?? th) && !f.skill.tap?.down && f.state === 'stand' ? { o: s, o2: null, tech: tech?.name ?? '?' } : null; st.th = th; return ev; }
      if (tech !== st.lastTech) { st.lastTech = tech; st.techAt = STICH.has(tech?.name) ? s : null; st.techName = tech?.name; }
      if (st.techAt != null && f.skill.swinging && !st.prevSw && f.state === 'stand') { const ev = { o: st.techAt, o2: s, tech: st.techName }; st.techAt = null; st.prevSw = true; return ev; }
      st.prevSw = !!f.skill.swinging; return null;
    };
  }

  /** 싸움 돌리기 → 몸마다 표본 줄 · 사건 · 상처 스텝 (관문도 이 날것을 씀) */
  function fightRaw(G, ais, secs, detect) {
    const F = [G.player, G.enemy]; const L = new Map(F.map((f) => [f, []])); const ST = new Map(F.map((f) => [f, {}])); const EV = new Map(F.map((f) => [f, []])); const HI = new Map(F.map((f) => [f, []]));
    const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (L.has(A) && Vc !== A) HI.get(A).push(L.get(A).length); };
    const dead = new Set();
    for (let k = 0; k < Math.round(secs / DT); k++) {
      G.step();
      for (const f of F) { if (dead.has(f)) continue; const s = sample(f); if (!s || !f.alive) { dead.add(f); continue; } const ln = L.get(f); ln.push(s); const ev = detect(f, ln.length - 1, ln[ln.length - 2], ST.get(f)); if (ev) EV.get(f).push(ev); }
    }
    freeWorld(G);
    return F.map((f) => ({ f, line: L.get(f), ev: EV.get(f), hits: HI.get(f) }));
  }
  function fightLoop(G, ais, secs, detect, kind) {
    const out = [];
    for (const { line: ln, ev, hits } of fightRaw(G, ais, secs, detect)) {
      for (let j = 0; j < ev.length; j++) {
        const e = ev[j]; const next = ev[j + 1]?.o ?? Infinity; const o2 = e.o2 ?? e.o;
        if (ln.length - 1 < o2 + 130) continue; // 끝이 잘린 획은 버림
        const hit = hits.find((i) => i >= o2 && i <= o2 + 120 && i < next) ?? null;
        out.push({ tech: e.tech, ...stroke(ln, e.o, e.o2, hit, kind) });
      }
    }
    return out;
  }

  /** 사람 탭 찌르기 · 서 있는 과녁 (r13 장면 · finish_thrust standTrial 꼴 · 상대 칼 치움).
   *  opt.gap = 골반 간격(주면 씨앗의 간격 대신) · opt.post = 탭 뒤 도는 시간 · opt.step = thrust({step}) · opt.wb = 관문 셈 · opt.onTap(G,P,E) = 탭 직전 부름(장부 붙이기) */
  function runThrust(seed, weapon, opt = {}) {
    const R = rng(seed); const PADS = [[0.18, -0.28], [0.22, 0.26], [0.0, 0.03]]; const pad = PADS[Math.floor(R() * 3)].map((v) => v + (R() - 0.5) * 0.06); const gapSeed = 1.3 + R() * 0.45; const gap = opt.gap ?? gapSeed;
    const G = H.newRound({ walls: false, gap, seed, weapon, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player, E = G.enemy;
    for (const c of E.swordColliders) c.setCollisionGroups(0);
    P.skill.level = 0.7; P.skill.autoGuard = true; setHand(P, [0.18, -0.28]); setHand(E, [0, -0.5]);
    const line = []; const hits = hookHits(G, P, E, () => line.length);
    for (let i = 0; i < Math.round(1.2 / DT); i++) { const off = P.handOffset; const dx = pad[0] - off.x, dy = pad[1] - off.y, d = Math.hypot(dx, dy); if (d > DT) { off.x += (dx / d) * DT; off.y += (dy / d) * DT; } else off.set(pad[0], pad[1]); P.move.set(0, 0); G.step(); const s = sample(P); if (s) line.push(s); }
    // opt.pelvisGap = 탭 때 골반 간격(수평)을 이 값으로: 겨눔이 끝난 뒤 · 0.8 s 고요 앞에 과녁을 통째로 옮김 (newRound 의 gap 은 서는 자리라 탭 때 골반 간격이 0.14 ~ 0.17 m 더 김)
    //   (두 번: 고요 처음 · 가운데 — 둘째는 첫 옮김 뒤 남은 차 몇 cm 만)
    const placeE = () => { if (opt.pelvisGap == null) return; const pp = P.bodies.pelvis.translation(), ep = E.bodies.pelvis.translation(); const d = Math.hypot(ep.x - pp.x, ep.z - pp.z), k = (opt.pelvisGap - d) / d, dx = (ep.x - pp.x) * k, dz = (ep.z - pp.z) * k; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); } };
    for (let i = 0; i < Math.round(0.8 / DT); i++) { if (i === 0 || i === Math.round(0.4 / DT)) placeE(); P.move.set(0, 0); G.step(); const s = sample(P); if (s) line.push(s); }
    hits.length = 0; const o = line.length; opt.onTap?.(G, P, E); const ok = opt.step === false ? P.skill.thrust({ step: false }) : P.skill.thrust();
    for (let i = 0; i < Math.round((opt.post ?? 1.2) / DT); i++) { P.move.set(0, 0); G.step(); const s = sample(P); if (!s) break; line.push(s); opt.onStep?.(G, P, E, i); }
    freeWorld(G);
    if (opt.raw) return { ok, line, o, hits, pad };
    const hit = hits.find((i) => i >= o) ?? null;
    if (opt.wb) return ok ? [{ seed, gap, path: 'human', ...strokeWB(line, o, hits, 'thrust') }] : [];
    return ok ? [{ seed, gap, ...stroke(line, o, null, hit, 'thrust') }] : [];
  }

  return { DT, THREE, sample, touch, offRun, ms, stroke, strokeWB, CUT_PAD, setHand, hookHits, runCut, runCutAI, runThrustAI, thrustDetect, STICH, fightRaw, fightLoop, runThrust, freeWorld };
}
