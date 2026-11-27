// (r9/main_req/tri.mjs 에 tap · itm 두 갈래를 더함) 뒤집힌 시험 가르기: 시험과 같은 장면을 씨앗 여럿으로 다시 돌려 잰 값과 문턱을 줄마다 찍음
// 쓰기: node tri.mjs <칸 뿌리> <case> <씨앗 목록 1,2,..>   (칸 뿌리의 tools/sim · src 를 씀 — estoc · sabre 안 씀)
const [root, kase, seedArg = '1,2,3,4,5,6,7,8'] = process.argv.slice(2);
const seeds = seedArg.split(',').map(Number);
const sim = (m) => import(`${root}/tools/sim/${m}`);
const srcm = (m) => import(`${root}/src/${m}`);
const tag = root.split('/').pop();
const out = (seed, o) => console.log(JSON.stringify({ tag, case: kase, seed, ...o }));

const C = {
  // arm_real D: 여섯 칸 모두 두 팔 엇갈림 몫 < 0.05 · 두손 칼 빈손 놓침 0
  async arm_real(seed) {
    const { runDir } = await sim('arm_reach_audit.mjs');
    const { WEAPONS } = await srcm('weapons.js');
    const cells = [['longsword', 'up'], ['longsword', 'left'], ['longsword', 'upLeft'], ['longsword', 'right'], ['balisarda', 'left'], ['rapier', 'left']];
    const v = {}; let pass = true;
    for (const [w, dir] of cells) {
      const on = runDir({ weapon: w, dir, mode: 'slow', seed });
      const ok = !on.flags.includes('arms') && on.frac.arms < 0.05 && (!WEAPONS[w].twoHand || on.frac.grip === 0);
      v[`${w}.${dir}`] = +on.frac.arms.toFixed(3) + (WEAPONS[w].twoHand && on.frac.grip ? `g${on.frac.grip.toFixed(2)}` : '');
      pass &&= ok;
    }
    return { pass, thr: 'arms<0.05', v };
  },
  // arm_real D 흔들기: 씨앗으로 안 바뀜(정한 손가락 길) → 판 시작에 물리 스텝 (seed − 1) 번 더 쉬고 시작 · 가장 깊은 겹침 · 뚫은 스텝 수
  async arm_real_p(seed) {
    const { runDir, PEN } = await sim('arm_reach_audit.mjs');
    const cells = [['longsword', 'up'], ['longsword', 'left'], ['longsword', 'upLeft'], ['longsword', 'right'], ['balisarda', 'left'], ['rapier', 'left']];
    const v = {}; let pass = true;
    for (const [w, dir] of cells) {
      const on = runDir({ weapon: w, dir, mode: 'slow', seed: 1, keep: true, onRound: ({ G }) => { for (let i = 0; i < seed - 1; i++) G.step(); } });
      const ar = (on.samples ?? []).map((s) => s.arms).filter((x) => Number.isFinite(x));
      const deep = ar.length ? Math.min(...ar) : null;
      const ok = !on.flags.includes('arms') && on.frac.arms < 0.05 && on.frac.grip === 0;
      pass &&= ok;
      if (w !== 'longsword' || on.frac.arms > 0) v[`${w}.${dir}`] = { frac: +on.frac.arms.toFixed(3), pen: ar.filter((x) => x < -PEN).length, n: on.n, deepCm: deep == null ? null : +(100 * deep).toFixed(1) };
    }
    return { pass, thr: 'arms<0.05 (뚫음 = 겉 겹침 2 cm 넘음)', v };
  },
  // ib_link B12 준비 장면: 츠바이핸더(사람 · 가만) 대 롱소드 AI · 거리 1.6 · 이베리아 칸 모두 — 30 s 안에 AI 칼날이 몸에 듦(베임 · 찌름 · 심각도 > 0)
  async ib_link(seed) {
    const { newRound } = await sim('harness_m.mjs');
    const { kitFromNodes, allNodeIds } = await srcm('skill_tree_data.js');
    const kit = kitFromNodes('iberian', allNodeIds('iberian'));
    const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed, gap: 1.6, kit });
    const P = G.player, E = G.enemy; let cap = null, blunt = 0, any = 0;
    const pw = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, point, pr) => {
      pw?.(att, vic, r, point, pr);
      if (att === E && vic === P) { any++; if (r.type === 'blunt' || !(r.severity > 0)) blunt++; }
      if (!cap && att === E && vic === P && r.type !== 'blunt' && r.severity > 0) cap = { t: +G.t.toFixed(1), type: r.type, part: pr?.v?.part };
    };
    while (!cap && G.t < 30) G.step();
    const r = { tWound: cap?.t ?? null, type: cap?.type ?? null, part: cap?.part ?? null, bluntOrZero: blunt, hitsOnP: any, eAtt: E.stats?.attacks ?? null };
    G.world.free();
    return { pass: !!cap, thr: '30 s 안 AI 칼날 상처 ≥ 1', ...r };
  },
  // cavazione ①: 이탈리아 · 서 있는 상대 · 14 s — imbroccata 찌른 상처 ≥ 1
  async cav(seed) {
    const { drillRun } = await sim('special_balance.mjs');
    const on = drillRun('italian', seed, { foe: 'still', variant: 'on', dur: 14 });
    const hits = on.atts.flatMap((a) => a.hits);
    const stab = hits.filter((h) => h.tech === 'imbroccata' && h.type === 'stab' && h.sev > 0).length;
    const imb = on.atts.filter((a) => a.tech === 'imbroccata' || a.hits.some((h) => h.tech === 'imbroccata')).length;
    const types = {}; for (const h of hits) if (h.tech === 'imbroccata') types[h.type + (h.sev > 0 ? '+' : '0')] = (types[h.type + (h.sev > 0 ? '+' : '0')] ?? 0) + 1;
    return { pass: stab >= 1, thr: 'stab>=1', stab, atts: on.atts.length, imb, types };
  },
  // ai_arc 값: 동방 환도 숙련 5 대 츠바이핸더 — 40 s 안에 둥근 눈(arcSeen) · 칼끝 틈(arcGap) 둘 다 나옴
  async ai_arc(seed) {
    const { newRound, AI } = await sim('harness_m.mjs');
    const G = newRound({ seed, walls: true, weapon: 'zweihander', weapon2: 'hwando', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
    const ai = G.ai; let tArc = null, tGap = null;
    while (G.t < 40 && !((ai.stats.arcSeen ?? 0) > 0 && (ai.stats.arcGap ?? 0) > 0)) {
      G.step();
      if (tArc == null && (ai.stats.arcSeen ?? 0) > 0) tArc = +G.t.toFixed(1);
      if (tGap == null && (ai.stats.arcGap ?? 0) > 0) tGap = +G.t.toFixed(1);
    }
    const r = { arc: ai.stats.arcSeen ?? 0, gap: ai.stats.arcGap ?? 0, tArc, tGap, t: +G.t.toFixed(1), meAlive: G.enemy.alive, foeAlive: G.player.alive };
    G.world.free();
    return { pass: r.arc > 0 && r.gap > 0, thr: 'arc>0 & gap>0 in 40 s', ...r };
  },
  // guard_line 읽는 쪽 (사람 상대): 시험의 humanWalkIn (씨앗 2 고정) 을 씨앗만 바꿔
  async gl_human(seed) {
    const { newRound } = await sim('harness_m.mjs');
    const { G: PAD } = await srcm('ai_techniques.js');
    const { readGuard } = await srcm('guard_line.js');
    const walk = (pad) => {
      const G0 = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', persona: { proficiency: 6 } });
      const P = G0.player, ai = G0.ai; ai.mind = null; ai.level = { ...ai.level, read: 1 };
      const got = []; const go = ai.anticGo.bind(ai);
      ai.anticGo = (s, line) => { if (line) got.push({ line, t: +G0.t.toFixed(2), seen: readGuard(P, s)?.guard }); return go(s, line); };
      G0.before = (t) => { P.handOffset.set(pad[0], pad[1]); P.move.set(0, t > 1.2 ? 0.35 : 0); P.stickY = P.move.y; };
      try {
        while (G0.t < 9 && !got.length) G0.step();
        let cover = null;
        if (got.length) { for (let i = 0; i < 3; i++) G0.step(); cover = { mode: ai.mode, pre: ai.icpPre, glCover: ai.glCover, defLine: ai.defLine }; }
        return { n: got.length, line: got[0]?.line ?? null, t: got[0]?.t ?? null, seen: got[0]?.seen ?? null, cover, tEnd: +G0.t.toFixed(1), gl: ai.stats.gl ?? null };
      } finally { G0.world.free(); }
    };
    const a = walk(PAD.tagR), b = walk(PAD.pflugR), c = walk([0.32, -0.02]);
    const okA = a.n > 0 && a.seen === 'tagR' && a.line === 'highR' && a.cover?.mode === 'defend' && a.cover?.pre === true && a.cover?.glCover === 'highR';
    const okB = b.line === 'thrust', okC = c.n === 0;
    return { pass: okA && okB && okC, thr: 'tagR→highR · pflugR→thrust (9 s 안) · 자세 밖 0', tagR: [a.line, a.t, a.cover?.mode], pflugR: [b.line, b.t, b.gl], none: c.n };
  },
  // guard_line 읽는 쪽 (AI 상대): 시험의 one(seed) — 씨앗마다 따로 (시험은 5,1,3,2,6,7 차례로 첫 성공)
  async gl_ai(seed) {
    const { newRound, AI } = await sim('harness_m.mjs');
    const { readGuard, nearGuard } = await srcm('guard_line.js');
    const G0 = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 6 }, persona2: { proficiency: 6 }, difficulty: 'expert', difficulty2: 'expert' });
    for (const [a, f] of [[G0.ai, G0.enemy], [G0.ai2, G0.player]]) { a.level = { ...a.level, strength: 1.1 }; f.strength = f.vitality = 1.1; }
    try {
      const ai = G0.ai; ai.level = { ...ai.level, read: 1 };
      const got = []; const go = ai.anticGo.bind(ai);
      ai.anticGo = (s, line) => { if (line) got.push({ line, read: readGuard(G0.player, s), near: nearGuard(s, 'german')?.name }); return go(s, line); };
      while (G0.t < 40 && G0.player.alive && G0.enemy.alive) G0.step();
      const S = ai.stats.gl ?? null, aim = ai.stats.icp?.aim ?? 0;
      const consistent = got.every((x) => x.near && x.line === x.read.line);
      return { pass: got.length > 0 && S?.th >= 1 && aim > 0 && consistent, thr: 'got>0 · th≥1 · aim>0', got: got.length, th: S?.th ?? 0, go: S?.go ?? 0, aim, t: +G0.t.toFixed(1), consistent };
    } finally { G0.world.free(); }
  },
  // ib_block_regen 판에서 쓰임: 롱소드 AI 대 츠바이핸더 AI 숙련 5 · 30 s — 막아 내 되찾은 기력 횟수 (시험은 씨앗 1~4 의 합 > 0)
  async ib(seed) {
    const { newRound, AI } = await sim('harness_m.mjs');
    const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'zweihander', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
    while (G.t < 30 && G.player.alive && G.enemy.alive) G.step();
    const n = G.enemy.stamina.counts.blockRegen ?? 0, sum = G.enemy.stamina.blockRegenSum ?? 0;
    const r = { n, sum: +sum.toFixed(1), t: +G.t.toFixed(1), blocks: G.enemy.stamina.counts.block ?? null };
    G.world.free();
    return { pass: n > 0, thr: 'n>0 (시험: 씨앗 1~4 합 > 0)', ...r };
  },
  // onehand_arm 병마용 AI: 월왕구천검 대 롱소드 · 15 s · 상처 끔 — 팔꿈치 30° 넘게 위 ≤ 1 % · 위팔 돌림 밖 ≤ 1 % (시험은 씨앗 11)
  async onehand(seed) {
    const { aiRun } = await sim('wrist_audit.mjs');
    const { CHARACTERS_BY_ID } = await srcm('characters.js');
    const persona = CHARACTERS_BY_ID.terracotta.ai.persona;
    const T = aiRun('goujian', { foeW: 'longsword', persona, only: 'enemy', seed, wounds: false }).T;
    let n = 0, rotN = 0, shOut = 0, up30 = 0;
    for (const P of T.k.values()) { n += P.n; rotN += P.rotN; shOut += P.shOut; up30 += P.up30; }
    const s = { n, shOut: rotN ? shOut / rotN : 0, up30: up30 / n };
    return { pass: n > 1000 && s.up30 <= 0.01 && s.shOut <= 0.01, thr: 'up30≤1% · shOut≤1%', shOut: +(100 * s.shOut).toFixed(1), up30: +(100 * s.up30).toFixed(1), n };
  },
  // onehand_arm 한손 탭 찌르기: 레이피어 · 환도 × 쟁기 · 황소 · 긴 자세 — 위팔 돌림 밖 ≤ 1 % · 30° 넘게 위 ≤ 1 % (시험은 씨앗 311 → 여기 씨앗 1 = 311)
  async tap(seed) {
    const { tapRun, WristTally } = await sim('wrist_audit.mjs');
    const T = new WristTally();
    for (const w of ['rapier', 'hwando']) for (const gd of ['pflug', 'ochs', 'langort']) T.merge(tapRun(w, gd, { seed: 310 + seed }).T, `${w}:${gd}:`);
    let n = 0, rotN = 0, shOut = 0, up30 = 0;
    for (const P of T.k.values()) { n += P.n; rotN += P.rotN; shOut += P.shOut; up30 += P.up30; }
    const s = { shOut: rotN ? shOut / rotN : 0, up30: up30 / n };
    return { pass: s.up30 <= 0.01 && s.shOut <= 0.01, thr: 'up30≤1% · shOut≤1%', shOut: +(100 * s.shOut).toFixed(1), up30: +(100 * s.up30).toFixed(1), n };
  },
  // italian_measure 찌르기 잣대: 레이피어 measureThrust 지금 팔 ↔ 전 팔(swivelHuman · wristPronate 0) 차 < 0.02 m — 씨앗 없음(판 씨앗 1 고정) · 씨앗 k 는 찌르는 거리 gap 을 (k − 1) cm 늘림(흔들기)
  async itm(seed) {
    const { CONFIG } = await sim('harness_m.mjs');
    const { measureThrust } = await sim('weapon_measure.mjs');
    const { JOINTS, ARENA } = CONFIG;
    const W = (L, fn) => { const o = L.map(([a, k]) => a[k]); L.forEach(([a, k, v]) => (a[k] = v)); try { return fn(); } finally { L.forEach(([a, k], i) => (a[k] = o[i])); } };
    const wm = await sim('weapon_measure.mjs');
    const opt = seed > 1 ? { gap: 3.4 + 0.01 * (seed - 1) } : {}; // 3.4 = weapon_measure.mjs THRUST_GAP (내보내지 않음)
    return W([[ARENA, 'startHold', 0], [CONFIG.AI_REACT, 'face', 0.2]], () => {
      const now = measureThrust('rapier', opt).raw;
      const old = W([[JOINTS, 'swivelHuman', 0], [JOINTS, 'wristPronate', 0]], () => measureThrust('rapier', opt).raw);
      return { pass: Math.abs(now - old) < 0.02, thr: '|지금 − 전 팔| < 0.02 m', now: +now.toFixed(3), old: +old.toFixed(3), d: +(now - old).toFixed(3), gap: opt.gap ?? 'test' };
    });
  },
};
C.cav2 = C.cav;
if (!C[kase]) { console.error('case?', Object.keys(C)); process.exit(1); }
for (const s of seeds) {
  const t0 = Date.now();
  try { out(s, { ...(await C[kase](s)), sec: Math.round((Date.now() - t0) / 1000) }); }
  catch (e) { out(s, { pass: null, err: String(e?.message ?? e).slice(0, 200) }); }
}
