// ③ 자세 → 칼길 (11/17 — [사장님 11/17 결정] 기본 판 · 설계 docs/design/guard_line_2026-11-17.md · src/guard_line.js · config GUARD_LINE · schools.js lineMap)
//  ① 표의 기술 이름이 모두 그 유파 꾸러미(techByName)에 있음 · 묶인 고유 기술은 넷뿐 · 간 보는 자세마다 칸 · 이베리아 목록 셋 더함 · 간수세 줄 없음
//  ② 공격하는 쪽: τ(read)가 클수록 약속(기본 줄)을 더 지킴 — 무게 셈 · 실제 AI 고르기 · 기본 기술 = W^τ × 자세마다 한 곱(자세 안 비 그대로) · 묶인 고유 기술 = 버릇 고정 몫(간 보는 목록 평균 = 1)
//  ③ 읽는 쪽: 걸어 들어오는 상대의 보이는 자세(늦게 본 손)가 약속한 기본 줄을 미리 덮음 — 사람 상대 · AI 상대
//  ④ 사람 조작은 묶지 않음: 사람 입력 길(main · skill · 조이스틱 · 긋기 읽기 …)은 이 규칙을 읽지 않고 · 사람 손은 자세 패드로 끌려가지 않음
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { newRound, CONFIG, AI } from './harness_m.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { G } from '../../src/ai_techniques.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { getWeapon } from '../../src/weapons.js';
import { nearGuard, guardsOf, lineClass, lineW, mainLines, readGuard, PARRY_LINE } from '../../src/guard_line.js';

const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const BOUND_UNIQUE = new Set(['schielhau', 'krumphau', 'imbroccata', 'tsubameGaeshi']); // [사장님 11/17 결정 2]
const { GUARD_LINE } = CONFIG;

test('표: 기술 이름이 모두 그 유파 꾸러미에 있음 · 묶인 고유 기술은 넷뿐 · 간 보는 자세마다 칸 · 이베리아 셋 더함 · 간수세 줄 없음', () => {
  for (const sc of SCHOOLS) {
    const T = TRADITIONS[sc];
    const M = T.lineMap;
    assert.ok(M, `${sc} lineMap`);
    const uniques = new Set((T.unique ?? []).map((u) => u.name));
    for (const wid of WEAPONS[sc]) {
      for (const prof of [null, 6]) {
        const pack = resolveSwordArt(getWeapon(wid), null, prof == null ? {} : { proficiency: prof, aiKit: true }).school;
        for (const [g, row] of Object.entries(M)) {
          assert.ok(G[g], `${sc} 자세 열쇠 ${g} = 패드`);
          for (const n of [...row.P, ...row.S]) assert.ok(pack.techByName[n], `${sc} ${wid} ${g}: ${n} 가 techByName 에 없음`);
          for (const n of row.P) assert.ok(!row.S.includes(n), `${sc} ${g}: ${n} 기본 · 보조 겹침`);
        }
        for (const g of pack.guards) assert.ok(M[g.name], `${sc} ${wid}: 간 보는 자세 ${g.name} 칸 없음`);
      }
    }
    const named = new Set(Object.values(M).flatMap((r) => [...r.P, ...r.S]));
    for (const n of named) if (uniques.has(n)) assert.ok(BOUND_UNIQUE.has(n), `${sc}: 고유 기술 ${n} 는 묶지 않음 (결정 2)`);
  }
  assert.deepEqual(TRADITIONS.german.lineMap.tagR.P.filter((n) => BOUND_UNIQUE.has(n)).sort(), ['krumphau', 'schielhau'], '독일 실하우 · 크룸프하우 → 어깨 지붕');
  assert.ok(TRADITIONS.italian.lineMap.tag.P.includes('imbroccata'), '이탈리아 임브로카타 → 1번 자세');
  assert.ok(TRADITIONS.japanese.lineMap.tag.P.includes('tsubameGaeshi'), '일본 츠바메가에시 → 조단');
  const ib = TRADITIONS.iberian.guards.map((g) => g.name);
  for (const g of ['nebenR', 'tagR', 'sideL']) assert.ok(ib.includes(g), `이베리아 간 보는 목록에 ${g} (결정 5)`);
  assert.equal(TRADITIONS.chinese.lineMap.nebenR.free, true, '동방 간수세 free (결정 6)');
  const cnPack = resolveSwordArt(getWeapon(WEAPONS.chinese[0])).school;
  assert.equal(mainLines(cnPack, 'chinese').nebenR, null, '간수세 — 읽을 줄 없음');
  assert.equal(lineClass('chinese', 'nebenR', 'zornhau'), null, '간수세 — 무게 1');
  // 무게: P 1 · S 0.35 · U 0.08 — 0 없음
  assert.deepEqual(GUARD_LINE.w, { P: 1, S: 0.35, U: 0.08 });
  assert.ok(Object.values(GUARD_LINE.w).every((v) => v > 0));
  assert.ok(Math.abs(GUARD_LINE.beat - CONFIG.realS(0.2)) < 1e-12, '공격 직전 자세 한 박자 0.2 s (결정 7)');
});

test('nearGuard: 보이는 손(검객 skill.aim · 늦게 본 hx · hy) 에서 가장 가까운 자세 — 0.2 안일 때만 · 같은 함수', () => {
  const tagR = G.tagR;
  assert.equal(nearGuard({ hx: tagR[0] + 0.1, hy: tagR[1] - 0.1 }, 'german')?.name, 'tagR');
  assert.equal(nearGuard({ hx: tagR[0] + 0.15, hy: tagR[1] + 0.15 }, 'german'), null, '0.21 m — 인정 안 함');
  assert.equal(nearGuard({ skill: { aim: { x: G.alber[0], y: G.alber[1] } }, hx: 9, hy: 9 }, 'german')?.name, 'alber', '검객이면 보이는 손 skill.aim');
  assert.equal(nearGuard({ hx: 0, hy: 0 }, 'none'), null, '표 없는 유파');
  assert.deepEqual(guardsOf('iberian').map((g) => g.name).sort(), Object.keys(TRADITIONS.iberian.lineMap).sort());
});

/** 자세 g 에서 기본(P) 기술이 받는 몫 — 꾸러미 기술 base × W^τ · κ (고르는 무게 그대로 · 굴림 없음) */
function pShare(ai, sc, tau, guards) {
  ai.level = { ...ai.level, read: tau };
  ai.glBook = null;
  let p = 0, all = 0;
  for (const g of guards) {
    const near = { name: g, pad: G[g] };
    for (const t of ai.school.tech) {
      const w = (t.base ?? 1) * lineW(ai, near, t);
      all += w;
      if (lineClass(sc, g, t.name) === 'P') p += w;
    }
  }
  return p / all;
}

test('공격하는 쪽: τ(read)가 클수록 기본 줄 약속을 더 지킴 · 기본 기술 = P 1 · S 0.35 · U 0.08 의 τ 제곱 × 자세마다 한 곱 · 묶인 고유 기술 = 버릇 고정 몫 (간 보는 목록 평균 무게 1 — 유파 맛 그대로)', () => {
  for (const sc of SCHOOLS) {
    const G0 = newRound({ seed: 3, walls: true, weapon: WEAPONS[sc][0], weapon2: WEAPONS[sc][0], persona: { proficiency: 6 } });
    try {
      const ai = G0.ai;
      const gs = Object.entries(TRADITIONS[sc].lineMap).filter(([g, r]) => !r.free && ai.school.tech.some((t) => r.P.includes(t.name))).map(([g]) => g);
      const lo = pShare(ai, sc, 0.35, gs), mid = pShare(ai, sc, 0.65, gs), hi = pShare(ai, sc, 0.9, gs);
      assert.ok(lo < mid && mid < hi, `${sc} 기본 몫 τ 0.35 / 0.65 / 0.9 = ${lo.toFixed(3)} / ${mid.toFixed(3)} / ${hi.toFixed(3)}`);
      // 기본 기술: 무게 곱 = W^τ × c(자세) · 묶인 고유 기술: 간 보는 목록 ŵ 로 평균 낸 무게 곱 = 1 (버릇 고정)
      ai.level = { ...ai.level, read: 0.9 };
      ai.glBook = null;
      const gl = ai.school.guards;
      const raw = gl.map((g) => (g.w ?? 1) * ai.pers.guardPref[g.name]);
      const tot = raw.reduce((a, b) => a + b, 0);
      const uniq = new Set(TRADITIONS[sc].unique.map((u) => u.name));
      const cOf = {};
      let nU = 0;
      for (const t of ai.school.tech) {
        const bound = Object.values(TRADITIONS[sc].lineMap).some((r) => r.P.includes(t.name) || r.S.includes(t.name));
        if (!bound) continue;
        if (uniq.has(t.name)) {
          nU++;
          const avg = gl.reduce((s, g, i) => s + (raw[i] / tot) * lineW(ai, { name: g.name, pad: g.pad }, t), 0);
          assert.ok(Math.abs(avg - 1) < 1e-9, `${sc} ${t.name} 평균 무게 ${avg}`);
        } else for (const g of gl) {
          const k = lineClass(sc, g.name, t.name);
          if (!k) continue;
          const c = lineW(ai, { name: g.name, pad: g.pad }, t) / Math.pow(CONFIG.GUARD_LINE.w[k], 0.9);
          (cOf[g.name] ??= []).push(c);
        }
      }
      // 기본 기술: 한 자세 안에서는 모두 같은 곱 c(자세) ≥ 1 — 자세 안 P : S : U 비 그대로 (가장 센 기본 기술 무게가 전과 같게)
      for (const [g, cs] of Object.entries(cOf)) assert.ok(cs.every((c) => Math.abs(c - cs[0]) < 1e-9 && c >= 1 - 1e-9), `${sc} ${g} 기본 기술 곱 ${cs.map((c) => c.toFixed(3))}`);
      if (sc !== 'iberian' && sc !== 'chinese') assert.ok(nU >= 1, `${sc} 묶인 고유 기술이 꾸러미에 있음`);
      // 묶지 않은 고유 기술 = 어느 자세에서나 1
      for (const t of ai.school.tech) if (!lineClass(sc, gl[0].name, t.name) && !Object.values(TRADITIONS[sc].lineMap).some((r) => r.P.includes(t.name) || r.S.includes(t.name))) assert.equal(lineW(ai, { name: gl[0].name }, t), 1, `${sc} ${t.name} 묶지 않음`);
    } finally {
      G0.world.free();
    }
  }
});

test('공격하는 쪽 (실제 고르기): 손을 자세에 둔 AI 의 pickTech — τ 높을수록 그 자세의 기본 기술 · 드묾은 줄되 0 아님 · 손 자세 없으면 무게 그대로', () => {
  const G0 = newRound({ seed: 5, walls: true, weapon: 'longsword', weapon2: 'longsword', persona: { proficiency: 6 } });
  try {
    for (let i = 0; i < 240; i++) G0.step();
    const ai = G0.ai, me = G0.enemy;
    const s = ai.sense.seen(ai.level.reaction);
    ai.d = ai.M.contact - 0.05; // 곁눈 베기 제자리(상대 칼끝이 겨눔 · 맞닿기 안 — 11/19 사람 · AI 같게 E1 짝)에서 고름 — 밖이면 곁눈 베기가 후보에서 빠져 드묾 칸이 거의 빔 (거리는 이 셈의 다른 무게에 안 들어감)
    // 독일 (고유 기술 넷 가운데 둘 묶임 — 실하우가 버릇): 간 보는 자세 아홉에 손을 두고 고른 기술의 칸 (τ 말고는 같은 몸 · 같은 상대 모습)
    const picks = (tau) => {
      ai.level = { ...ai.level, read: tau };
      ai.glBook = null;
      const c = { P: 0, S: 0, U: 0, free: 0 };
      for (const g of ai.school.guards) {
        me.handOffset.set(g.pad[0], g.pad[1]);
        me.skill.aim.set(g.pad[0], g.pad[1]);
        for (let k = 0; k < 300; k++) c[lineClass('german', g.name, ai.pickTech(s, 'patience').name) ?? 'free']++;
      }
      return c;
    };
    const lo = picks(0.35), hi = picks(0.9);
    assert.ok(hi.P > lo.P * 1.2, `기본 기술 τ 0.35 → 0.9 : ${lo.P} → ${hi.P}`);
    assert.ok(hi.U < lo.U * 0.8, `드묾 τ 0.35 → 0.9 : ${lo.U} → ${hi.U}`);
    assert.ok(hi.U > 0, '드묾도 나옴 (무게 0 없음 — 예외로 나오는 칼)');
    // 손이 어느 자세에서도 0.2 넘게 떨어지면 자세 무게 없음
    me.skill.aim.set(0.3, -0.05);
    assert.equal(nearGuard(me, 'german'), null);
  } finally {
    G0.world.free();
  }
});

/** 사람(하네스 플레이어 — AI 없음)이 자세 pad 를 잡고 걸어 들어옴 → 상대 AI 가 읽어 덮은 줄 (read 1 로 굴림을 늘 나오게) */
function humanWalkIn(weapon, pad) {
  const G0 = newRound({ seed: 2, walls: true, weapon, weapon2: 'longsword', persona: { proficiency: 6 } });
  const P = G0.player, ai = G0.ai;
  ai.mind = null; // 유파 마음가짐 (11/18): 독일 거리 1 의 선(상대 칼끝 안 0.2)이면 들어옴이 늘 걸음에 치기 띠(내 칼끝 + 0.3) 안 — 걸음에 치기가 먼저 굴림. 이 읽기 시험은 옛 선(마음가짐 없는 몸)으로
  ai.level = { ...ai.level, read: 1 };
  const got = [];
  const go = ai.anticGo.bind(ai);
  ai.anticGo = (s, line) => {
    if (line) got.push({ line, t: G0.t, seen: readGuard(P, s), hand: [s.hx, s.hy], aim: [P.skill.aim.x, P.skill.aim.y] });
    return go(s, line);
  };
  G0.before = (t) => {
    P.handOffset.set(pad[0], pad[1]); // 사람 손가락 = 그 자세 자리 (사람 손은 자유 — 여기선 시험이 그 자리에 둠)
    P.move.set(0, t > 1.2 ? 0.35 : 0); // 판 시작 정지 뒤 앞으로 천천히 걸어 들어옴 (달려듦 0.9 m/s 넘으면 칼 듦 낌새 길 — preThreat 이 먼저 맞받기 · 물러남)
    P.stickY = P.move.y;
  };
  try {
    let cover = null, hand = null;
    while (G0.t < 9 && !got.length) G0.step();
    if (got.length) {
      for (let i = 0; i < 3; i++) G0.step(); // 덮은 손이 그 줄 막기 자리로 가는 중
      cover = { mode: ai.mode, pre: ai.icpPre, glCover: ai.glCover, defLine: ai.defLine };
      hand = [ai.hand.x, ai.hand.y];
    }
    return { got, cover, hand, parry: ai.school.parry, human: !P.aiControlled && !G0.ai2, stats: ai.stats.gl };
  } finally {
    G0.world.free();
  }
}

test('읽는 쪽 (사람 상대): 걸어 들어오는 사람의 보이는 자세가 약속한 기본 줄을 미리 덮음 · 늦게 본 손으로', () => {
  // 독일 어깨 지붕 → 실하우(곁눈 베기 — 분노의 베기 자리를 가져감) 기본 → 오른쪽 위에서 옴(내 오른쪽 위 highR)
  const r = humanWalkIn('longsword', G.tagR);
  assert.ok(r.human, '사람 자리 (AI 없음)');
  assert.ok(r.got.length, `읽기 나옴 ${JSON.stringify(r.stats)}`);
  const g = r.got[0];
  assert.equal(g.seen?.guard, 'tagR', '늦게 본 손 자세');
  assert.equal(g.line, 'highR');
  assert.equal(g.line, mainLines(resolveSwordArt(getWeapon('longsword')).school, 'german').tagR);
  assert.deepEqual(r.cover, { mode: 'defend', pre: true, glCover: 'highR', defLine: 'highR' }, '미리 줄 닫기 꼴로 그 줄');
  assert.deepEqual(r.hand, [...r.parry.highR], '손 = 그 줄 막기 자리');
  // 독일 쟁기 → 찌르기 기본 → 가운데(thrust)
  const r2 = humanWalkIn('longsword', G.pflugR);
  assert.equal(r2.got[0]?.line, 'thrust');
  // 자세 밖(어느 자세에서도 0.2 넘게)이면 읽지 않음 — 미리 줄 닫기 읽기(낌새)는 그대로 굴림
  const r3 = humanWalkIn('longsword', [0.32, -0.02]);
  assert.equal(r3.got.length, 0, '자세 없음 — 읽지 않음');
});

test('읽는 쪽 (AI 상대): 덮은 줄 = 늦게 본 상대 손 자세의 기본 줄 · 휘두름이 보이면 실제 칼로 고쳐 겨눔', () => {
  // 씨앗 5 를 앞에 (11/19 §8 — 독일 띠 높음 출발 읽기 · 뒤 칼(docs/strike/burst_whiff_2026-11-19.md §8)이 숙련 6 독일 거울의 판 흐름을 바꿔 씨앗 1 · 3 · 2 · 6 · 7 은 40 s 안에 덮는 중 휘두름이 안 보임 — 씨앗 1 ~ 20 가운데 5 · 9 ~ 12 · 14 · 15 · 17 · 20 은 나옴)
  // 씨앗 4 → 3 (11/19 — 독일 띠 높음 읽고 박차기 · 누르는 동안만 비기 기력(docs/strike/de_band3_2026-11-19.md)이 숙련 6 독일 거울의 판 흐름을 바꿔 씨앗 4 는 40 s 안에 덮은 채 걸어 드는 장면이 안 나옴 — 읽기 장치는 그대로 · 장면만 다시 고름)
  // 유파 마음가짐 (11/18): 씨앗 4 → 1 — 마음가짐 독일 거울판은 씨앗 4 에서 40 s 안에 읽을 들어옴이 없음 (씨앗 1 ~ 8 가운데 1 · 2 · 6 · 7 은 읽기 · 휘두름 고쳐 겨눔 모두 나옴)
  //  (11/19 붙어 남음 · 상대 버릇 판: 씨앗 1 은 읽기는 나오나 덮는 중 휘두름이 안 보임 — 읽기 · 휘두름 고쳐 겨눔이 모두 나온 판까지 씨앗 1 · 2 · 6 · 7 을 차례로)
  const one = (seed) => {
    const G0 = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 6 }, persona2: { proficiency: 6 }, difficulty: 'expert', difficulty2: 'expert' });
    // 몸 값은 11/17 E 전 숙련 6 그대로(힘 1.1 · 버티는 힘 1.1) — 읽기 시험이라 몸은 판 꼴만 정함 · 숙련도별 몸 값이 바뀌어도 판이 그대로이게 (기록 docs/strike/prof_body_2026-11-17.md §7)
    for (const [a, f] of [[G0.ai, G0.enemy], [G0.ai2, G0.player]]) {
      a.level = { ...a.level, strength: 1.1 };
      f.strength = f.vitality = 1.1;
    }
    try {
      const ai = G0.ai;
      ai.level = { ...ai.level, read: 1 };
      const got = [];
      const go = ai.anticGo.bind(ai);
      ai.anticGo = (s, line) => {
        if (line) got.push({ line, read: readGuard(G0.player, s), near: nearGuard(s, 'german')?.name });
        return go(s, line);
      };
      while (G0.t < 40 && G0.player.alive && G0.enemy.alive) G0.step();
      return { got, S: ai.stats.gl ?? null, aim: ai.stats.icp?.aim ?? 0 };
    } finally {
      G0.world.free();
    }
  };
  let r = null;
  for (const seed of [5, 1, 3, 2, 6, 7]) if ((r = one(seed)).got.length > 0 && r.S?.th >= 1 && r.aim > 0) break; // 합침 (11/19): 개발 쪽 씨앗 3 을 먼저 → 사람 · AI 같게 E1(곁눈 베기 제자리 · 11/19) 뒤 씨앗 1 을 먼저 — 씨앗 3 은 줄 없는 데바나 칼 하나가 go 에 더해짐(1 은 읽기 셋 · 덮는 중 휘두름 · 고쳐 겨눔 모두)
  const { got, S, aim } = r;
  assert.ok(got.length > 0, '판에서 읽기 나옴');
  for (const x of got) {
    assert.ok(x.near, '늘 보이는 손 자세에서');
    assert.equal(x.line, x.read.line, '덮은 줄 = 그 자세의 기본 줄');
    assert.ok(Object.values(PARRY_LINE).includes(x.line));
  }
  assert.ok(S.go === got.length && S.th + S.end <= S.go, JSON.stringify(S));
  assert.ok(S.th >= 1 && aim > 0, `읽은 줄을 덮는 중 휘두름이 보임 → 가로막기가 실제 칼 길로 겨눔 ${JSON.stringify(S)} · icp.aim ${aim}`);
});

test('사람 조작은 묶지 않음: 사람 입력 길은 이 규칙을 읽지 않고 · 사람 손은 자세 패드로 끌려가지 않음', () => {
  const src = new URL('../../src/', import.meta.url);
  const code = (f) => readFileSync(new URL(f, src), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // 주석 뺀 코드
  const files = readdirSync(src).filter((f) => f.endsWith('.js'));
  assert.deepEqual(files.filter((f) => /from '\.\/guard_line\.js'/.test(code(f))), ['ai.js'], '자세 → 칼길 셈을 부르는 곳 = AI 뿐');
  assert.deepEqual(files.filter((f) => /import[^;]*\bGUARD_LINE\b[^;]*from/.test(code(f))).sort(), ['ai.js', 'guard_line.js'], '값을 읽는 곳 = AI 와 그 셈뿐');
  assert.deepEqual(files.filter((f) => /\.lineMap\b/.test(code(f))).sort(), ['guard_line.js', 'schools.js'], '표를 읽는 곳 = 그 셈과 표 자리뿐');
  // 사람 손: 두 자세 사이에 둔 손 목표가 그 자리 그대로 (자세로 붙지 않음)
  const G0 = newRound({ seed: 1, walls: true, weapon: 'longsword', weapon2: 'longsword' });
  try {
    const P = G0.player;
    const want = [0.3, -0.02];
    let minPad = Infinity;
    for (const g of guardsOf('german')) minPad = Math.min(minPad, Math.hypot(g.pad[0] - want[0], g.pad[1] - want[1]));
    assert.ok(minPad > GUARD_LINE.near, '자세 밖 자리');
    G0.before = () => P.handOffset.set(want[0], want[1]);
    for (let i = 0; i < 240; i++) G0.step();
    assert.ok(Math.hypot(P.handOffset.x - want[0], P.handOffset.y - want[1]) < 1e-9, '손 목표 그대로');
    assert.ok(Math.hypot(P.skill.aim.x - want[0], P.skill.aim.y - want[1]) < 0.03, `보이는 손 = 사람이 둔 자리 (${P.skill.aim.x.toFixed(3)}, ${P.skill.aim.y.toFixed(3)})`);
    assert.equal(nearGuard(P, 'german'), null);
  } finally {
    G0.world.free();
  }
});
