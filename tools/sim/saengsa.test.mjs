// 생사전 1단계 (사장님 10/29 14:1x · 14:2x · 14:5x — docs/design/saengsa_2026-10-29.md): 시계(신청 창 · 첫 대진 · 쉬는 시간) · 대진표 만들기 · 저절로 끝내기 · 기권 ·
//  빠른 셈 고정 · 부상 회복(경상 2번 쉬면 · 중상 그대로) · 하사품 · 저장 왕복. 시각은 모두 현지 시각으로 만든다(new Date(y, m, d, h, mi)) — 기기 시간대와 무관
//  11/12 바로 시작 (사장님 '그리고 생사전 플레이어가 참여하면 바로 시작되도록 바꿔. 대신 특정 시간에만 열리게. 밤 10시부터 새벽 2시 사이.' — docs/design/saengsa_instant_2026-11-12.md):
//   본판 기본(SAENGSA.instant true)은 경기 사이 기다림이 없다. 옛 규칙(아침 10시 첫 대진 · 2시간 쉼)을 지키던 시험은 새 규칙으로 고치고, 옛 셈은 OLD(instant false — 스위치)로 그대로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { SAENGSA } = await import('../../src/config.js');
SAENGSA.anytime = false; // 본판 임시 상시 열림(사장님 11/21 — config SAENGSA.anytime)은 끈 판에서 일정 규칙을 시험 · 켠 판은 saengsa.test 의 따로 시험
const C = await import('../../src/saengsa_clock.js');
const R = await import('../../src/saengsa_rules.js');
const S = await import('../../src/saengsa_store.js');
const P = await import('../../src/lobby_progress.js');

const at = (d, h, mi = 0) => new Date(2026, 9, d, h, mi).getTime(); // 2026-10-d h:mi (현지)
const ROSTER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
const PROF = { german: 2, italian: 1, iberian: 1, japanese: 0, chinese: 0, none: 1 };
const DATA = { roster: ROSTER, drawWeapon: (r) => ['w1', 'w2', 'w3'][Math.floor(r() * 3)], weaponInfo: () => ({ school: 'german', tier: 'common' }), profOf: () => ({ ...PROF }) };
const make = (seed = 7, extra = {}) => R.createTournament({ day: '2026-10-30', seed, at: at(29, 23), companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], ...DATA, ...extra }); // 11/18: 신청은 무기 없이(첫 경기 배정) — 시험은 무기를 든 팀을 바로 만든다
const OLD = { ...SAENGSA, instant: false }; // 옛 규칙 (11/12 전 — 아침 10시 첫 대진 · 대진 2시간마다 · 결과 뒤 2시간 쉼) — 스위치가 그대로 도는지
/** 내 경기를 이 쪽이 이긴 결과로 (체력 · 부상은 넘긴 대로) */
const winFor = (t, m, fighters = {}) => ({ winner: R.sidesOf(t, m)[0] === 0 ? 'a' : 'b', fighters });

test('시계: 신청 창은 밤 10시 ~ 새벽 2시(자정을 넘김) · 첫 대진 10시 · 대진 2시간마다', () => {
  // 11/12: 신청 창 = 생사전이 열리는 때(그대로) · startAt · roundAt 는 옛 규칙(instant false)에서만 쓰는 셈 — 시계 함수는 그대로 본다
  assert.deepEqual({ ...C.signupWindow(at(29, 21, 59)) }, { day: '2026-10-30', from: at(29, 22), to: at(30, 2), open: false });
  assert.equal(C.signupWindow(at(29, 22)).open, true);
  assert.equal(C.signupWindow(at(30, 1, 59)).open, true);
  assert.equal(C.signupWindow(at(30, 1, 59)).day, '2026-10-30');
  const after = C.signupWindow(at(30, 2));
  assert.deepEqual([after.open, after.day, after.from], [false, '2026-10-31', at(30, 22)]);
  assert.equal(C.startAt('2026-10-30'), at(30, 10));
  assert.deepEqual([0, 1, 2, 3].map((r) => C.roundAt('2026-10-30', r)), [at(30, 10), at(30, 12), at(30, 14), at(30, 16)]);
  assert.equal(C.parseLocal('2026-10-30T09:59'), at(30, 9, 59));
  const clock = C.clockFrom('?saengsaNow=2026-10-30T09:59', () => 1000);
  assert.equal(clock(), at(30, 9, 59));
});

test('대진표: 16 팀 · 15 경기 · 이름난 인물은 한 번씩 · 남는 자리는 무명 검객(팀 안 옷 색 다름) · 씨앗이 같으면 같은 대회', () => {
  const t = make(11, { weapons: ['tree_branch', 'w9', 'w8'] });
  assert.equal(t.teams.length, SAENGSA.teams);
  assert.equal(t.matches.length, SAENGSA.teams - 1);
  assert.deepEqual(t.teams[0].members.map((f) => f.id), ['player', 'a', 'b']);
  assert.deepEqual(t.teams[0].members.map((f) => f.weapon), ['tree_branch', 'w9', 'w8']); // 내 팀 무기 = 내가 배정 (사장님 10/29 18:2x)
  const ai = t.teams.slice(1).flatMap((team) => team.members);
  const named = ai.filter((f) => f.id !== R.NAMELESS).map((f) => f.id);
  assert.deepEqual([...named].sort(), ROSTER.filter((id) => !['a', 'b'].includes(id)).sort()); // 아홉 명이 한 번씩
  assert.equal(ai.length - named.length, 45 - 9);
  for (const team of t.teams.slice(1)) {
    assert.ok(team.members.filter((f) => f.id !== R.NAMELESS).length <= 1);
    const cloth = team.members.filter((f) => f.id === R.NAMELESS).map((f) => f.cloth);
    assert.equal(new Set(cloth).size, cloth.length);
  }
  const hired = make(3, { companions: [R.NAMELESS, R.NAMELESS] });
  assert.deepEqual(hired.teams[0].members.map((f) => [f.id, f.cloth]), [['player', undefined], [R.NAMELESS, 0], [R.NAMELESS, 1]]);
  assert.equal(hired.teams.slice(1).flatMap((x) => x.members).filter((f) => f.id !== R.NAMELESS).length, 11);
  assert.deepEqual([...R.seatOrder(t)].sort((x, y) => x - y), [...Array(16).keys()]);
  assert.deepEqual(make(11, { weapons: ['tree_branch', 'w9', 'w8'] }), t);
  assert.notDeepEqual(make(12), t);
});

test('저절로 끝내기: 신청하면 곧바로 상대끼리 7 경기 · 내 경기는 입장 가능 · 8강 상대끼리는 16강이 다 끝나야 (11/12 바로 시작)', () => {
  // 11/12 전 이 시험은 '10시 전엔 없음 · 10시에 7 경기'(아침 10시 첫 대진)를 봤다 — 사장님 11/12 '참여하면 바로 시작'으로 신청한 때(밤 11시) 바로 끝난다. 옛 셈은 아래 OLD 로 그대로
  const t = make(), now = at(29, 23);
  assert.equal(R.advance(t, now), 7);
  const m = R.myMatch(t);
  assert.equal(m.round, 0);
  assert.equal(R.readyAt(t, m), 0);
  assert.equal(R.matchState(t, m, now), 'ready');
  assert.ok(t.matches.filter((x) => x.result).every((x) => x.result.at === now && x.result.by === 'quick' && Number.isInteger(x.result.seed) && x.result.ver && x.result.pre.a.length === 3)); // 결과 시각 = 셈한 때
  assert.equal(R.advance(t, at(30, 12)), 0); // 8강 상대끼리는 내 16강 결과를 기다림 (시각이 지나도)
  assert.ok(R.finishMine(t, m, ['0-0'], at(29, 23, 5), winFor(t, m)));
  assert.equal(R.advance(t, at(29, 23, 5)), 3); // 16강이 다 끝나자 8강 가운데 상대끼리 셋 (내 쪽 하나는 내 결과를 기다림)
  // 옛 규칙 (instant false): 10시 전엔 없음 · 10시에 7 경기(결과 시각 = 10시) · 12시에 8강 상대끼리 셋
  const o = make();
  assert.equal(R.advance(o, at(30, 9, 59), OLD), 0);
  assert.equal(R.advance(o, at(30, 10), OLD), 7);
  assert.equal(R.matchState(o, R.myMatch(o), at(30, 10), OLD), 'ready');
  assert.ok(o.matches.filter((x) => x.result).every((x) => x.result.at === at(30, 10)));
  assert.equal(R.advance(o, at(30, 12), OLD), 3);
});

test('쉬는 시간 없음: 결과를 적으면 다음 경기를 곧바로 (11/12 바로 시작) · 옛 규칙은 늦게 저장한 결과에서 2시간', () => {
  // 11/12 전 이 시험은 '늦게 저장한 결과에서 2시간 · 그 전엔 다음 경기 못 함'(restH)을 봤다 — 사장님 11/12 '참여하면 바로 시작'으로 다음 경기도 기다림 없이. 옛 셈은 아래 OLD 로 그대로
  const t = make(), picks = ['0-0', '0-1'];
  R.advance(t, at(29, 23, 30));
  const m0 = R.myMatch(t);
  assert.ok(R.finishMine(t, m0, picks, at(29, 23, 30), winFor(t, m0)));
  R.advance(t, at(29, 23, 30));
  const m1 = R.myMatch(t);
  assert.equal(m1.round, 1);
  assert.equal(R.readyAt(t, m1), 0);
  assert.equal(R.matchState(t, m1, at(29, 23, 30)), 'ready'); // 같은 때 곧바로
  const setup = R.matchSetup(t, m1, picks, at(29, 23, 30));
  assert.equal(setup.control, 'player');
  assert.ok(setup.entrants[setup.mineSide === 'a' ? 'b' : 'a'].length >= 1);
  assert.equal(R.matchSetup(t, m1, ['0-1'], at(29, 23, 30)).control, 'watch');
  // 옛 규칙 (instant false)
  const o = make();
  R.advance(o, at(30, 11, 30), OLD);
  const o0 = R.myMatch(o);
  assert.ok(R.finishMine(o, o0, picks, at(30, 11, 30), winFor(o, o0), OLD));
  R.advance(o, at(30, 13), OLD);
  const o1 = R.myMatch(o);
  assert.equal(o1.round, 1);
  assert.equal(R.readyAt(o, o1, OLD), at(30, 13, 30));
  assert.equal(R.matchState(o, o1, at(30, 13), OLD), 'soon');
  assert.equal(R.matchSetup(o, o1, picks, at(30, 13), OLD), null);
  assert.equal(R.matchState(o, o1, at(30, 13, 30), OLD), 'ready');
  assert.equal(R.matchSetup(o, o1, picks, at(30, 13, 30), OLD).control, 'player');
});

test('기권: 내 경기를 밤 10시(다음 신청 창)까지 안 하면 진다 · 대회는 끝까지 간다', () => {
  const t = make();
  R.advance(t, at(30, 21, 59));
  assert.ok(R.myMatch(t));
  R.advance(t, at(30, 22));
  assert.equal(R.myMatch(t), null);
  assert.equal(R.myTeamOut(t), true);
  const lost = t.matches.find((m) => m.result?.by === 'forfeit');
  assert.equal(lost.result.at, at(30, 22));
  R.advance(t, Infinity);
  assert.equal(t.status, 'done');
  assert.notEqual(t.champion, 0);
  assert.equal(R.placeOf(t), 'first');
  assert.equal(R.chestCount(t), 0);
  assert.equal(R.canSignUp(at(30, 22, 5), t), true);
});

test('빠른 셈: 같은 판 · 같은 씨앗이면 같은 결과 · 이긴 쪽은 적어도 한 사람이 산다', () => {
  const f = (key, hp, tier = 'common') => ({ key, id: key, weapon: 'w', school: 'german', tier, prof: { ...PROF }, hp, injuries: [], dead: false });
  const sides = { a: [f('0-0', 100), f('0-1', 30)], b: [f('1-0', 100, 'legend')] };
  const one = R.quickResolve(sides, 42), again = R.quickResolve(structuredClone(sides), 42);
  assert.deepEqual(one, again);
  for (let s = 0; s < 200; s++) {
    const low = { a: [f('0-0', 3), f('0-1', 2)], b: [f('1-0', 2)] };
    const r = R.quickResolve(low, s);
    assert.ok(low[r.winner].some((x) => r.fighters[x.key].alive), `씨앗 ${s}`);
  }
  assert.ok(R.winChance([f('x', 100, 'legend')], [f('y', 30, 'trash')]) > 0.8);
});

test('빠른 셈 이긴 쪽 피해 = 경기 전 이김 확률 P 꼴 (11/21 · 설계안 §2-4 권고): 수 몫 1 · 0.85 · 0.78 · 쓰러짐 0.12 + 0.25(1 − P) — 그 가운데 즉사 42 % · 나머지 코마 (11/21 (나)) · 잃는 체력 0 ~ 90(1.1 − P) · 새 부상 0.45 + 0.4(1 − P) · 진 쪽 그대로', () => {
  const q = SAENGSA.quick;
  assert.deepEqual(q.countK, [1, 0.85, 0.78]);
  assert.deepEqual([q.winDie, q.winInstant, q.winLoss, q.winInjury, q.loseDmg, q.injury.lose], [[0.12, 0.25], 0.42, [90, 1.1], [0.45, 0.4], [50, 120], 0.6]);
  assert.equal(SAENGSA.downedHp, 10);
  assert.equal(q.pairK, undefined, '전 pairK 0.85 (둘 · 셋 같음) 걷음');
  const f = (key, hp = 100) => ({ key, id: key, weapon: 'w', school: 'german', tier: 'common', prof: { ...PROF }, hp, injuries: [], dead: false });
  const one = R.power(f('x'));
  assert.ok(Math.abs(R.sidePower([f('1')]) - one) < 1e-12);
  assert.ok(Math.abs(R.sidePower([f('1'), f('2')]) - 2 * 0.85 * one) < 1e-12);
  assert.ok(Math.abs(R.sidePower([f('1'), f('2'), f('3')]) - 3 * 0.78 * one) < 1e-12);
  const p32 = R.winChance([f('1'), f('2'), f('3')], [f('4'), f('5')]);
  assert.ok(Math.abs(p32 - 0.6545) < 0.001, `같은 힘 셋 대 둘 ${p32}`); // 전 69 %
  // 같은 판을 씨앗 0 ~ 5999 로 굴려 이긴 쪽 · 진 쪽 한 사람 피해를 셈 (P 는 이긴 편의 경기 전 이김 확률)
  const roll = (sides, n = 6000) => {
    const pa = R.winChance(sides.a, sides.b);
    const blank = (P) => ({ n: 0, die: 0, coma: 0, comaOk: 0, loss: 0, live: 0, inj: 0, P });
    const acc = { a: blank(pa), b: blank(1 - pa), lose: { n: 0, loss: 0, inj: 0, coma: 0 } };
    for (let s = 0; s < n; s++) {
      const r = R.quickResolve(sides, s), W = r.winner, L = W === 'a' ? 'b' : 'a';
      for (const x of sides[W]) {
        const o = r.fighters[x.key], c = acc[W];
        c.n++;
        if (!o.alive) { c.die++; continue; }
        if (o.downed) { c.coma++; c.comaOk += o.hp === SAENGSA.downedHp && o.injuries.some((i) => R.isSerious(i)); continue; }
        if (o.lost?.length) continue; // 잘린 사람(11/21 C — 그 부위 중상이 더해짐)은 새 부상 셈에서 뺌 (잘림 몫은 따로 시험)
        c.live++; c.loss += x.hp - o.hp; c.inj += o.injuries.length > 0;
      }
      for (const x of sides[L]) { const o = r.fighters[x.key]; acc.lose.n++; acc.lose.loss += Math.min(x.hp, x.hp - o.hp); acc.lose.inj += o.injuries.length > 0; acc.lose.coma += !!o.downed; }
    }
    return acc;
  };
  const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)} (기대 ${want.toFixed(3)})`);
  const acc = roll({ a: [f('0-0'), f('0-1'), f('0-2')], b: [f('1-0'), f('1-1')] }); // 셋 대 둘 — P 0.65 · 0.35
  for (const side of ['a', 'b']) {
    const c = acc[side], P = c.P, fall = 0.12 + 0.25 * (1 - P);
    near(c.die / c.n, fall * 0.42, 0.025, `${side} 즉사`); // 모두 즉사(한 사람 체력 1 로 삶)는 드물어 셈에서 뺌
    near(c.coma / c.n, fall * 0.58, 0.025, `${side} 코마 (체력 100 에서는 잃는 체력이 100 을 못 넘어 쓰러짐 굴림만)`);
    assert.equal(c.comaOk, c.coma, `${side} 코마 = 체력 10 · 중상 하나 넘게`);
    near(c.loss / c.live, 45 * (1.1 - P), 3, `${side} 서 있던 사람 잃은 체력`);
    near(c.inj / c.live, 0.45 + 0.4 * (1 - P), 0.03, `${side} 서 있던 사람 새 부상`);
  }
  assert.ok(acc.a.loss / acc.a.live < acc.b.loss / acc.b.live, '셋으로 이기면 둘로 이길 때보다 덜 다침');
  assert.equal(acc.lose.coma, 0, '진 쪽은 코마 없음');
  near(acc.lose.inj / acc.lose.n, 0.6, 0.03, '진 쪽 새 부상');
  near(acc.lose.loss / acc.lose.n, 85, 3, '진 쪽 잃은 체력 (50 ~ 120 — 체력 100 에서 끊김)');
  // 다친 사람은 이겨도 더 잘 쓰러진다 (잃은 체력이 남은 체력 이상 → 코마 · 엔진의 출혈 쓰러짐과 같은 뜻) — 죽음(즉사)은 체력과 상관없음
  let hurtComa = 0, fitComa = 0, hurtDie = 0, fitDie = 0, wins = 0;
  for (let s = 0; s < 3000; s++) {
    const r = R.quickResolve({ a: [f('0-0', 20), f('0-1')], b: [f('1-0'), f('1-1')] }, s);
    if (r.winner !== 'a') continue;
    const h = r.fighters['0-0'], g = r.fighters['0-1'];
    wins++; hurtComa += !!h.downed; fitComa += !!g.downed; hurtDie += !h.alive; fitDie += !g.alive;
    if (h.downed) assert.equal(h.hp, SAENGSA.downedHp);
  }
  assert.ok(hurtComa / wins > fitComa / wins + 0.2, `이긴 쪽 코마 체력 20 ${(hurtComa / wins).toFixed(2)} · 체력 100 ${(fitComa / wins).toFixed(2)}`);
  assert.ok(Math.abs(hurtDie - fitDie) / wins < 0.06, `즉사는 체력과 상관없음 ${(hurtDie / wins).toFixed(2)} · ${(fitDie / wins).toFixed(2)}`);
});

test('쉼 (사장님 11/21 \'쉬면 체력+35 부상 1단계씩 회복(중상->경상->완치.. 예시임) 출전하면 회복 불가.\'): 쉰 사람 체력 + 35 · 부상마다 한 단계 · 나선 사람 그대로 · 결과에 되찾은 것', () => {
  assert.equal(SAENGSA.restHeal, 35);
  assert.equal(SAENGSA.restEdge, 0.01);
  assert.equal(SAENGSA.restLightSev, undefined, '전 restLightSev 0.3 (경상 띠 가운데) 걷음 — 11/21 끝쪽 띠');
  assert.equal(SAENGSA.lightRests, undefined, '10/29 규칙 값(경상 두 번 쉬면 나음)은 걷음');
  // 한 단계 (사장님 11/21 '중상에서 경상이 될 때는 경상에서 중상에 가장 가까운 끝쪽 띠에 넣어. 경상이 나을 때도 마찬가지.'): 중상 → 경상 0.49 · 경상 → 나은 흔적 0.09 · 흔적은 그대로
  assert.deepEqual(R.healStep({ part: 'leg', sev: 0.9, rests: 0 }), { part: 'leg', sev: 0.49, rests: 0 });
  assert.deepEqual(R.healStep({ part: 'leg', sev: SAENGSA.seriousAt, rests: 0 }), { part: 'leg', sev: 0.49, rests: 0 });
  assert.deepEqual(R.healStep({ part: 'arm', sev: 0.49, rests: 1 }), { part: 'arm', sev: 0.09, rests: 1 });
  assert.deepEqual(R.healStep({ part: 'arm', sev: SAENGSA.woundMin, rests: 0 }), { part: 'arm', sev: 0.09, rests: 0 });
  assert.deepEqual(R.healStep({ part: 'arm', sev: 0.09, rests: 0 }), { part: 'arm', sev: 0.09, rests: 0 }, '나은 흔적은 더 나아가지 않음');
  assert.ok(!R.isSerious({ sev: 0.49 }) && !R.isTrace({ sev: 0.49 }) && R.isTrace({ sev: 0.09 }) && !R.isTrace({ sev: 0.1 }), '0.49 = 경상 · 0.09 = 흔적');
  const t = make();
  R.advance(t, at(30, 10));
  const team = t.teams[0].members, me = () => team[0];
  const light = { part: 'arm', sev: SAENGSA.seriousAt - 0.1, rests: 0 }, serious = { part: 'leg', sev: SAENGSA.seriousAt + 0.2, rests: 0 };
  Object.assign(team[1], { hp: 50, injuries: [{ ...serious }, { ...light, part: 'head' }] }); // 쉴 사람 (경기 전 다침)
  Object.assign(team[2], { hp: 90, injuries: [] });
  // ① 나만 나서서 이김: 나 = 경기 끝 몸 그대로(되찾음 없음) · 동료 둘 = 쉼
  const m0 = R.myMatch(t);
  const r0 = R.finishMine(t, m0, ['0-0'], at(30, 10, 5), winFor(t, m0, { '0-0': { hp: 20, injuries: [light, serious], alive: true } }));
  assert.equal(me().hp, 20, '나선 사람은 체력을 되찾지 않음');
  assert.deepEqual(me().injuries.map((i) => [i.part, i.sev]), [['arm', light.sev], ['leg', serious.sev]], '나선 사람 부상 그대로');
  assert.equal(team[1].hp, 85);
  assert.deepEqual(team[1].injuries.map((i) => [i.part, i.sev]), [['leg', 0.49], ['head', 0.09]], '중상 → 경상(0.49) · 경상 → 나은 흔적(0.09)');
  assert.deepEqual(R.injuriesOf(team[1].injuries).map((i) => i.part), ['leg'], '흔적은 부상이 아님');
  assert.equal(team[2].hp, 100, '체력은 가득까지만');
  assert.deepEqual(r0.rest, {
    '0-1': { gain: 35, steps: [{ part: 'leg', from: 'serious' }, { part: 'head', from: 'light' }], hp: 85, injuries: [{ part: 'leg', sev: 0.49, rests: 0 }, { part: 'head', sev: 0.09, rests: 0 }] },
    '0-2': { gain: 10, steps: [], hp: 100, injuries: [] },
  });
  assert.equal(r0.ver, 'saengsa-7');
  assert.equal(r0.rest['0-0'], undefined);
  // ② 나는 쉬고 동료 둘이 나섬: 나 = + 35 · 중상 → 경상 · 경상 → 나음 / 동료 = 그대로
  R.advance(t, at(30, 10, 5));
  const m1 = R.myMatch(t);
  const r1 = R.finishMine(t, m1, ['0-1', '0-2'], at(30, 10, 6), winFor(t, m1, { '0-1': { hp: 70, injuries: team[1].injuries, alive: true }, '0-2': { hp: 60, injuries: [], alive: true } }));
  assert.equal(me().hp, 55);
  assert.deepEqual(me().injuries.map((i) => [i.part, i.sev]), [['arm', 0.09], ['leg', 0.49]]);
  assert.deepEqual(r1.rest, { '0-0': { gain: 35, steps: [{ part: 'arm', from: 'light' }, { part: 'leg', from: 'serious' }], hp: 55, injuries: [{ part: 'arm', sev: 0.09, rests: 0 }, { part: 'leg', sev: 0.49, rests: 0 }] } });
  assert.deepEqual([team[1].hp, team[2].hp], [70, 60], '나선 동료는 그대로');
  // ③ 또 쉼: 경상 → 나음 · 죽은 사람은 쉬지 않음 · 결승 뒤에는 쉼 없음
  R.advance(t, at(30, 10, 6));
  const m2 = R.myMatch(t);
  const r2 = R.finishMine(t, m2, ['0-1'], at(30, 10, 7), winFor(t, m2, { '0-1': { hp: 40, injuries: [], alive: true } }));
  assert.deepEqual([me().hp, me().injuries.map((i) => [i.part, i.sev])], [90, [['arm', 0.09], ['leg', 0.09]]], '팔 흔적은 그대로 · 다리 경상 → 흔적');
  assert.deepEqual(r2.rest['0-0'].steps, [{ part: 'leg', from: 'light' }], '흔적은 단계 글 없음');
  assert.deepEqual(R.injuriesOf(me().injuries), []);
  assert.deepEqual(Object.keys(r2.rest).sort(), ['0-0', '0-2']);
  R.advance(t, at(30, 10, 7));
  const m3 = R.myMatch(t);
  assert.equal(m3.round, 3);
  const r3 = R.finishMine(t, m3, ['0-0'], at(30, 10, 8), winFor(t, m3, { '0-0': { hp: 50, injuries: [], alive: true } }));
  assert.equal(r3.rest, undefined, '결승 뒤에는 쉼이 없음');
  assert.equal(t.status, 'done');
  // 상대 팀(빠른 셈 · AI 고르기)도 같은 규칙: 나서지 않은 산 사람만 쉼 (대회 넷을 끝까지 — 상대끼리 경기 모두)
  let rested = 0;
  for (const seed of [21, 22, 23, 24]) {
    const u = make(seed);
    R.advance(u, Infinity);
    for (const x of u.matches.filter((y) => y.result?.by === 'quick' && y.round < 3)) {
      const side = x.result.winner, ent = x.result.entrants[side];
      for (const f of x.result.pre[side]) {
        const got = x.result.rest?.[f.key];
        if (ent.includes(f.key) || f.dead) { assert.equal(got, undefined, `${x.id} ${f.key} 나섬 · 죽음 — 쉼 없음`); continue; }
        rested++;
        assert.equal(got.gain, Math.min(SAENGSA.hpMax, f.hp + SAENGSA.restHeal) - f.hp, `${x.id} ${f.key} 쉼 체력`);
        assert.deepEqual(got.injuries, f.injuries.map((i) => R.healStep(i)), `${x.id} ${f.key} 쉼 부상`);
      }
    }
  }
  assert.ok(rested > 0, `상대끼리 경기에서 쉰 사람 ${rested}`);
  // 상대끼리 경기에 직접 적어도 같음 (두 사람만 나섬 → 셋째 쉼)
  const v = make(22);
  R.advance(v, at(30, 10));
  const qm = v.matches.find((x) => !x.result && x.round === 1 && R.sidesOf(v, x).every((k) => k != null && k !== 0));
  const [QA] = R.sidesOf(v, qm), qa = v.teams[QA].members;
  Object.assign(qa[2], { hp: 30, injuries: [{ part: 'torso', sev: 0.7, rests: 0 }], dead: false });
  const qres = R.applyResult(v, qm, { winner: 'a', fighters: { [qa[0].key]: { hp: 60, injuries: [], alive: true }, [qa[1].key]: { hp: 50, injuries: [], alive: true } }, entrants: { a: [qa[0].key, qa[1].key], b: [] } }, at(30, 10));
  const aided = qres.gift[qa[2].key]?.kind === 'aid'; // 쉰 사람 몫 물건(11/21 E · F): AI 가 응급처치약을 고르면 곧바로 써서 한 단계 더
  assert.deepEqual([qa[2].hp, qa[2].injuries], [65, [{ part: 'torso', sev: aided ? 0.09 : 0.49, rests: 0 }]]);
  assert.deepEqual([qa[0].hp, qa[1].hp], [60, 50]);
  assert.deepEqual(Object.keys(qres.rest), [qa[2].key]);
  assert.deepEqual(R.injuriesFromWounds([], [{ part: 'uarmS', severity: 0.05 }, { part: 'neck', severity: 0.7 }]), [{ part: 'head', sev: 0.7, rests: 0 }]);
});

test('나은 흔적 (11/21 — 경상이 나으면 woundMin − restEdge 0.09 로 남음): 부상 줄 · 힘 · 무기 나눠 주기 · 고르기 · 쉼 단계 어디에도 부상이 아님 · 같은 부위를 또 다치면 새 부상 · 실제 싸움에는 닫힌 상처 (팔 기능 0.063 깎임)', async () => {
  const X = await import('../../src/saengsa_text.js');
  const M = await import('../../src/saengsa_match.js');
  const { LIMB_LOSS } = await import('../../src/fighter.js');
  const trace = { part: 'arm', sev: 0.09, rests: 0 }, light = { part: 'leg', sev: 0.3, rests: 0 }, serious = { part: 'torso', sev: 0.49 + 0.31, rests: 0 };
  const f = (key, injuries = [], hp = 100) => ({ key, id: key, weapon: 'w', school: 'german', tier: 'common', prof: { ...PROF }, hp, injuries, dead: false });
  // 부상 줄 (경기 화면 카드 — saengsa_page.js card 가 injuriesOf 로 거른 목록을 injuryText 에)
  assert.deepEqual(R.injuriesOf([trace, light, serious]), [light, serious]);
  assert.equal(X.injuryText(R.injuriesOf([trace]), (i) => R.isSerious(i)), '부상 없음');
  assert.equal(X.injuryText(R.injuriesOf([trace, light]), (i) => R.isSerious(i)), '다리 경상');
  // 힘 · 무기 나눠 주기 · 고르기: 흔적은 안 셈
  assert.equal(R.power(f('a', [trace])), R.power(f('a')));
  assert.ok(R.power(f('a', [light])) < R.power(f('a')));
  const w = { weapon: 'w1', school: 'german', tier: 'common' };
  assert.equal(R.armScore(f('a', [trace]), w), R.armScore(f('a'), w));
  assert.deepEqual(R.aiPick([f('0', [trace, trace], 70), f('1', [], 70), f('2', [light], 70)]), ['0', '1', '2']); // 흔적이 있어도 힘 차례 그대로(같은 힘이면 열쇠 차례)
  // 쉼: 흔적은 단계 글 없음 · 그대로 남음
  const team = [f('0-0', [trace, light], 50)];
  const got = R.rest(team, []);
  assert.deepEqual(got['0-0'].steps, [{ part: 'leg', from: 'light' }]);
  assert.deepEqual(team[0].injuries, [trace, { ...light, sev: 0.09 }]);
  assert.deepEqual(R.rest(team, [])['0-0'].steps, [], '흔적만 남으면 단계 없음');
  // 같은 부위를 또 다치면 새 부상이 덮음 (실제 싸움 상처 · 빠른 셈 새 부상 모두 addInjury)
  assert.deepEqual(R.injuriesFromWounds([trace], [{ part: 'farmO', severity: 0.2 }]), [{ part: 'arm', sev: 0.2, rests: 0 }]);
  assert.deepEqual(R.injuriesFromWounds([trace], [{ part: 'farmO', severity: 0.05 }]), [trace], '긁힘(woundMin 밑)은 흔적을 바꾸지 않음');
  for (let s = 0; s < 400; s++) { // 빠른 셈 새 부상은 늘 woundMin 이상 — 흔적 자리를 덮어도 흔적이 되지 않음
    const r = R.quickResolve({ a: [f('0-0', [trace, { ...trace, part: 'leg' }, { ...trace, part: 'torso' }, { ...trace, part: 'head' }])], b: [f('1-0')] }, s);
    for (const i of r.fighters['0-0'].injuries) assert.ok(i.sev === 0.09 || i.sev >= SAENGSA.woundMin, `씨앗 ${s} ${JSON.stringify(i)}`);
  }
  // 실제 싸움: 흔적도 닫힌 상처로 들고 감 — 팔 = 빈손 팔(uarmO) 기능 1 − 0.09 × LIMB_LOSS
  const snap = M.snapshotFromPerson({ hp: 100, injuries: [trace, { ...trace, part: 'leg' }, { ...trace, part: 'torso' }] });
  assert.deepEqual(snap.wounds.map((x) => [x.part, x.severity, x.carried, x.bleed]), [['uarmO', 0.09, true, 0], ['thighB', 0.09, true, 0], ['abdomen', 0.09, true, 0]]);
  assert.ok(Math.abs(snap.limbs.armO - (1 - 0.09 * LIMB_LOSS)) < 1e-12 && Math.abs(snap.limbs.armO - 0.937) < 1e-9, `빈손 팔 ${snap.limbs.armO}`);
  assert.ok(Math.abs(snap.limbs.legB - 0.937) < 1e-9 && snap.limbs.armS === 1 && snap.limbs.legF === 1);
});

test('코마 (11/21 (나)) 결과 적기 · 다음 쉼: 체력 10 · 중상 → 산 사람으로 적힘(죽음 아님) · 쉬면 45 · 중상 → 경상 0.49 · 결과 카드 글 코마', async () => {
  const X = await import('../../src/saengsa_text.js');
  assert.equal(X.SAENGSA_TEXT.downed, '코마');
  const t = make();
  R.advance(t, at(30, 10));
  const team = t.teams[0].members;
  const m0 = R.myMatch(t);
  const r0 = R.finishMine(t, m0, ['0-0', '0-1', '0-2'], at(30, 10, 5), winFor(t, m0, {
    '0-0': { hp: 70, injuries: [], alive: true }, '0-1': { hp: 55, injuries: [{ part: 'arm', sev: 0.3, rests: 0 }], alive: true },
    '0-2': { hp: 10, injuries: [{ part: 'leg', sev: 0.5, rests: 0 }, { part: 'arm', sev: 0.2, rests: 0 }], alive: true, downed: true },
  }));
  assert.equal(r0.fighters['0-2'].downed, true);
  assert.deepEqual([team[2].dead, team[2].hp], [false, 10], '코마는 산 사람');
  // 다음 경기에 둘만 나서고 코마였던 사람은 쉼: 체력 45 · 다리 중상 → 경상 0.49 · 팔 경상 → 흔적
  R.advance(t, at(30, 10, 5));
  const m1 = R.myMatch(t);
  const r1 = R.finishMine(t, m1, ['0-0', '0-1'], at(30, 10, 6), winFor(t, m1, { '0-0': { hp: 60, injuries: [], alive: true }, '0-1': { hp: 50, injuries: [], alive: true } }));
  assert.deepEqual([team[2].hp, team[2].injuries.map((i) => [i.part, i.sev])], [45, [['leg', 0.49], ['arm', 0.09]]]);
  assert.deepEqual(r1.rest['0-2'].steps, [{ part: 'leg', from: 'serious' }, { part: 'arm', from: 'light' }]);
  // 상대끼리 경기(빠른 셈)에도 코마가 적힘 · 코마는 이긴 편에만
  let comas = 0;
  for (const seed of [31, 32, 33, 34, 35, 36]) {
    const u = make(seed);
    R.advance(u, Infinity);
    for (const x of u.matches.filter((y) => y.result?.by === 'quick')) {
      for (const [key, o] of Object.entries(x.result.fighters)) {
        if (!o.downed) continue;
        comas++;
        assert.ok(x.result.entrants[x.result.winner].includes(key), `${x.id} ${key} 코마는 이긴 편`);
        assert.ok(o.alive && o.hp === SAENGSA.downedHp && o.injuries.some((i) => R.isSerious(i)), `${x.id} ${key}`);
      }
    }
  }
  assert.ok(comas > 0, `상대끼리 경기 코마 ${comas}`);
});

test('쉼 글 (결과 카드 — 11/21): \'쉼 체력 + 35 · 다리 중상 → 경상 · 팔 경상 → 나음\' · 되찾은 것이 없으면 \'쉼\'', async () => {
  const X = await import('../../src/saengsa_text.js');
  assert.equal(X.restText({ gain: 35, steps: [{ part: 'leg', from: 'serious' }, { part: 'arm', from: 'light' }] }), '쉼 체력 + 35 · 다리 중상 → 경상 · 팔 경상 → 나음');
  assert.equal(X.restText({ gain: 10, steps: [] }), '쉼 체력 + 10');
  assert.equal(X.restText({ gain: 0, steps: [{ part: 'head', from: 'light' }] }), '쉼 머리 경상 → 나음');
  assert.equal(X.restText({ gain: 0, steps: [] }), '쉼');
  assert.equal(X.SAENGSA_TEXT.rested, '쉼');
});

test('옛 저장 (판 saengsa-1 · 10/29 쉼 규칙 · 둘씩 나선 경기): 그대로 읽힘 · 옛 결과는 그대로 · 이어 하면 새 쉼 규칙 · 새 결과는 saengsa-7', () => {
  assert.equal(R.SAENGSA_VER, 'saengsa-7');
  mem.clear();
  // 옛 꼴로 바꾼 진행 중 대회: 결과 ver 'saengsa-1' · 쉼 기록(rest) 없음 · 부상 쉰 수(rests) 1 · 둘씩 나섬
  const t = make(9);
  R.advance(t, at(30, 10));
  const m0 = R.myMatch(t);
  R.finishMine(t, m0, ['0-0', '0-1'], at(30, 10, 5), winFor(t, m0, { '0-0': { hp: 70, injuries: [], alive: true }, '0-1': { hp: 60, injuries: [], alive: true } }));
  for (const x of t.matches.filter((y) => y.result)) { x.result.ver = 'saengsa-1'; delete x.result.rest; delete x.result.gift; }
  for (const team of t.teams) { delete team.items; delete team.boxes; } // 쉼 물건 칸(11/21 E)도 없는 옛 꼴
  Object.assign(t.teams[0].members[2], { hp: 40, injuries: [{ part: 'arm', sev: 0.3, rests: 1 }, { part: 'leg', sev: 0.8, rests: 1 }] });
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, current: t, draft: { companions: ['a', 'b'] } }));
  const old = S.readSaengsa().current;
  assert.ok(old, '옛 저장이 버려지지 않음');
  assert.deepEqual(old, JSON.parse(JSON.stringify(t)));
  const before = old.matches.filter((x) => x.result).map((x) => JSON.stringify(x.result));
  // 이어 함: 나 · 동료 하나가 나서고 셋째(옛 부상)는 쉼 → 새 규칙(+ 35 · 경상 나음 · 중상 → 경상)
  const m1 = R.myMatch(old);
  const res = S.playMine(m1.id, ['0-0', '0-1'], at(30, 10, 10), winFor(old, m1, { '0-0': { hp: 50, injuries: [], alive: true }, '0-1': { hp: 40, injuries: [], alive: true } }));
  assert.ok(res);
  assert.equal(res.ver, 'saengsa-7');
  const now = S.readSaengsa().current;
  assert.deepEqual(now.teams[0].members[2].injuries, [{ part: 'arm', sev: 0.09, rests: 1 }, { part: 'leg', sev: 0.49, rests: 1 }], '옛 경상 0.3 → 흔적 · 옛 중상 → 0.49');
  assert.equal(now.teams[0].members[2].hp, 75);
  assert.deepEqual(res.rest['0-2'].steps, [{ part: 'arm', from: 'light' }, { part: 'leg', from: 'serious' }]);
  // 옛 저장에도 쉼 물건: 고를 몫이 생기고 · 무기상자 더미가 없으니 상자는 못 고름(응급처치약만)
  assert.deepEqual(res.gift, { '0-2': null });
  assert.equal(S.chooseGift(m1.id, '0-2', 'box'), null, '상자 더미 없음');
  assert.deepEqual(S.chooseGift(m1.id, '0-2', 'aid'), { kind: 'aid' });
  assert.equal(R.aidCount(S.readSaengsa().current.teams[0]), 1);
  const oldResults = now.matches.filter((x) => x.result && x.result.ver === 'saengsa-1');
  assert.equal(oldResults.length, before.length, '옛 결과는 다시 셈하지 않음');
  assert.deepEqual(oldResults.map((x) => JSON.stringify(x.result)), before);
  assert.ok(oldResults.every((x) => x.result.rest === undefined));
  // 끝까지 (상대끼리 경기 · 하사품) 깨지지 않음
  S.syncSaengsa(Infinity);
  assert.equal(S.readSaengsa().current.status, 'done');
  mem.clear();
});

test('하사품: 우승 셋 · 준우승 하나 · 하나에 금화 500 · 한 번만 받음', () => {
  const t = make();
  for (const h of [10, 12, 14, 16]) {
    R.advance(t, at(30, h));
    const m = R.myMatch(t);
    R.finishMine(t, m, ['0-0'], at(30, h), winFor(t, m));
  }
  assert.equal(t.status, 'done');
  assert.equal(R.placeOf(t), 'champion');
  assert.deepEqual(R.openChests(t), [{ kind: 'coins', amount: 500 }, { kind: 'coins', amount: 500 }, { kind: 'coins', amount: 500 }]);
  S.updateSaengsa((d) => { d.current = t; return true; });
  const before = P.readProgress().coins;
  assert.equal(S.claimChests().length, 3);
  assert.equal(S.claimChests(), null);
  assert.equal(P.readProgress().coins, before + 1500);
  const u = make();
  for (const h of [10, 12, 14, 16]) {
    R.advance(u, at(30, h));
    const m = R.myMatch(u), w = winFor(u, m);
    R.finishMine(u, m, ['0-0'], at(30, h), h < 16 ? w : { ...w, winner: w.winner === 'a' ? 'b' : 'a' });
  }
  assert.deepEqual([u.status, R.placeOf(u), R.chestCount(u)], ['done', 'final', 1]);
});

test('저장 왕복 · 신청(입장 조건 · 고용 금화 — 11/18 무기 배정 없음) · 첫 경기 무기 배정 · 깨진 저장은 버림', () => {
  mem.clear();
  const t = make(5);
  assert.equal(S.updateSaengsa((d) => { d.current = t; return true; }).saved, true);
  assert.deepEqual(S.readSaengsa().current, t);
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, current: { ...t, teams: t.teams.slice(0, 3) } }));
  assert.equal(S.readSaengsa().current, null);
  mem.clear();
  P.setCoins(30);
  const OWNED = ['tree_branch', 'druid_whip', 'w1', 'w2', 'w3'], W = ['tree_branch', 'w1', 'w2'];
  const data = { ...DATA, owned: OWNED, hasTitle: true, hireCostOf: () => ({ coins: 20 }) };
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data: { ...data, hasTitle: false } }).why, 'entry'); // 정복자 호칭 없음
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data: { ...data, owned: OWNED.slice(0, 4) } }).why, 'entry'); // 무기 넷
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data }).why, 'coins');
  P.setCoins(100);
  assert.equal(S.signUp({ now: at(29, 21), companions: ['a', 'b'], seed: 1, data }).why, 'closed');
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a'], seed: 1, data }).why, 'team'); // 동료 둘
  assert.equal(P.readProgress().coins, 100);
  const ok = S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data }); // 11/18: 무기 없이 — 옛 weapons 를 넘겨도 쓰지 않음
  assert.deepEqual([ok.ok, ok.cost, P.readProgress().coins], [true, { coins: 40, heads: 0, horns: 0 }, 60]); // 11/19: 값 = 금화 · 머리 · 뿔피리 합
  const t0 = S.readSaengsa().current;
  assert.deepEqual(t0.teams[0].members.map((f) => [f.weapon, f.school, f.tier]), [[null, null, null], [null, null, null], [null, null, null]]); // 내 팀은 무기 없이 대회에 듦
  assert.equal(S.validTournament(t0), true, '무기 없는 내 팀도 저장 모양이 맞음');
  assert.deepEqual(S.readSaengsa().draft, { companions: ['a', 'b'] });
  assert.equal(S.signUp({ now: at(29, 23, 30), companions: ['a', 'b'], seed: 2, data }).why, 'busy');
  // 무기를 받기 전에는 나서지 못함 (빠른 셈 · 엔진 판 모두 — validPicks)
  S.syncSaengsa(at(30, 10));
  const m0 = R.myMatch(S.readSaengsa().current);
  assert.equal(R.matchSetup(S.readSaengsa().current, m0, ['0-0'], at(30, 10)), null);
  assert.equal(S.playMine(m0.id, ['0-0'], at(30, 10), null), null);
  // 경기마다 배정: 살아 있는 사람만 · 가진 무기 · 서로 다르게 — 결과의 pre 에 그 경기 무기 (첫 경기 배정 = 처음 받는 무기)
  const info = (w) => ({ school: w === 'w3' ? 'italian' : 'german', tier: 'rare' });
  assert.equal(S.playMine(m0.id, ['0-0'], at(30, 10), null, { arm: { weapons: ['w3', 'w1', 'w1'], owned: OWNED, weaponInfo: info } }), null);
  assert.equal(S.playMine(m0.id, ['0-0'], at(30, 10), null, { arm: { weapons: ['w3', 'w1'], owned: OWNED, weaponInfo: info } }), null); // 셋 다
  const res = S.playMine(m0.id, ['0-0'], at(30, 10), null, { arm: { weapons: ['w3', 'druid_whip', 'w2'], owned: OWNED, weaponInfo: info } });
  const mineSide = R.sidesOf(S.readSaengsa().current, m0)[0] === 0 ? 'a' : 'b';
  assert.deepEqual([res.pre[mineSide][0].weapon, res.pre[mineSide][0].school, res.pre[mineSide][0].tier], ['w3', 'italian', 'rare']);
  assert.deepEqual(S.readSaengsa().current.teams[0].members.map((f) => f.weapon), ['w3', 'druid_whip', 'w2']);
  const dead = make(4, { weapons: W });
  dead.teams[0].members[2].dead = true;
  assert.equal(R.assignWeapons(dead, ['w1', 'w2', 'w2'], { owned: OWNED, weaponInfo: info }), true); // 죽은 사람 자리는 셈 밖
  assert.deepEqual(dead.teams[0].members.map((f) => f.weapon), ['w1', 'w2', 'w2']);
  assert.deepEqual(R.entryMissing({ hasTitle: false, owned: 2 }), [{ kind: 'title' }, { kind: 'weapons', have: 2, need: 5 }]);
  assert.deepEqual(R.entryMissing({ hasTitle: true, owned: 5 }), []);
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1 })); // 빈 저장 (저장소 열쇠가 없으면 이번 실행 값을 쥐고 있으니 빈 판을 적는다)
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'a'], seed: 3, data }).why, 'team');
  assert.equal(S.signUp({ now: at(29, 23), companions: [R.NAMELESS, R.NAMELESS], seed: 3, data }).ok, true); // 무명 검객은 둘 다여도 됨
  // 옛 저장 (11/18 전): draft.weapons · 그 전 lend 는 버림 · 빈 자리는 뒤로 · 신청 때 무기를 받은 진행 중 대회는 그대로
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, draft: { companions: ['a', 'b'], lend: { weapon: 'w2', to: 1 } } }));
  assert.deepEqual(S.readSaengsa().draft, { companions: ['a', 'b'] });
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, current: make(6, { weapons: W }), draft: { companions: [null, 'b'], weapons: W } }));
  assert.deepEqual(S.readSaengsa().draft, { companions: ['b', null] });
  assert.deepEqual(S.readSaengsa().current.teams[0].members.map((f) => f.weapon), W);
  assert.equal(S.saveDraft({ companions: ['c', R.NAMELESS], weapons: W }), true);
  assert.deepEqual(JSON.parse(mem.get(S.SAENGSA_KEY)).draft, { companions: ['c', R.NAMELESS] });
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1 })); // 빈 저장으로 돌려 둠 (저장소 열쇠가 없으면 이번 실행 값을 쥐고 있어 뒤 시험이 진행 중 대회를 봄)
  S.readSaengsa();
});

test('동료 고르기 한 번 누름 (사장님 11/18 — 한 번에 둘 · 고른 차례 = 동료 1 · 2 · 누르면 빼고 뒤가 앞으로 · 무명 검객 0 → 1 → 2 → 0)', () => {
  const T = (ids, id) => R.toggleCompanion(ids, id, 2);
  assert.deepEqual(T([], 'a'), ['a']);
  assert.deepEqual(T(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(T(['a', 'b'], 'c'), ['a', 'b'], '둘을 다 고르면 그대로');
  assert.deepEqual(T(['a', 'b'], 'a'), ['b'], '앞을 빼면 뒤가 동료 1');
  assert.deepEqual(T(['a', 'b'], 'b'), ['a']);
  assert.deepEqual(T([null, 'b'], 'c'), ['b', 'c'], '빈 자리는 건너뜀');
  const N = R.NAMELESS;
  assert.deepEqual(T([], N), [N]);
  assert.deepEqual(T([N], N), [N, N], '무명 검객은 둘 다여도 됨');
  assert.deepEqual(T([N, N], N), [], '다 찼으면 모두 뺌');
  assert.deepEqual(T(['a', N], N), ['a']);
  assert.deepEqual(T([N, 'a'], N), ['a']);
  assert.deepEqual(T([N, 'a'], 'a'), [N]);
  const ids = ['a'];
  T(ids, 'b');
  assert.deepEqual(ids, ['a'], '원본은 그대로');
  assert.deepEqual(R.toggleCompanion([], 'a'), ['a'], '기본 상한 = 팀 인원 − 나');
  assert.equal(SAENGSA.teamSize - 1, 2);
});

test('가진 무기 · 입장 조건 글 (사장님 10/29 18:2x)', async () => {
  const { ownedWeapons, weaponReceipt } = await import('../../src/owned_weapons.js');
  const { entryLine } = await import('../../src/saengsa_text.js');
  const { TITLE } = await import('../../src/title_rules.js');
  assert.deepEqual(ownedWeapons({ acquisitions: [] }), ['tree_branch', 'druid_whip']);
  const acq = [{ receipt: weaponReceipt('longsword'), kind: 'item' }, { receipt: 'skill:german:G1', kind: 'skill' }, { receipt: weaponReceipt('nope'), kind: 'item' }, { receipt: weaponReceipt('rapier'), kind: 'item' }];
  assert.deepEqual(ownedWeapons({ acquisitions: acq }), ['tree_branch', 'druid_whip', 'longsword', 'rapier']);
  assert.equal(entryLine(R.entryMissing({ hasTitle: false, owned: 2 })), '정복자 호칭이 필요합니다 · 무기 5개가 필요합니다 (지금 2개)');
  assert.deepEqual([SAENGSA.entry.title, SAENGSA.entry.weapons, TITLE.conquerWins], ['conqueror', 5, 10]);
  assert.ok(SAENGSA.testWeapons.length + 2 >= 8 && SAENGSA.testWeapons.length + 2 <= 10);
  const schools = new Set((await Promise.all(SAENGSA.testWeapons.map(async (id) => (await import('../../src/saengsa_roster.js')).weaponInfo(id).school))));
  assert.equal(schools.size, 5); // 다섯 유파 (+ 시작 무기 무유파)
});

test('로스터 · 숙련도(인물 성향 표) · 고용 값 · 무명 검객', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const { PROFICIENCY } = await import('../../src/character_temperament.js');
  // 로스터 = 그림이 있는 모든 인물 (사장님 10/29 22:3x — 손님 · 아르토리아 · 얼터도 생사전 인물 · 기본 인물과 얼터는 다른 사람)
  assert.equal(roster.SAENGSA_ROSTER.length, Object.keys(CHARACTERS_BY_ID).length);
  for (const id of ['artoria', 'roland', 'bernardo', 'white_scale', 'silver_wanderer', 'silver_wanderer_mad', 'minami_mad', 'liao_mad']) assert.ok(roster.SAENGSA_ROSTER.includes(id), id);
  assert.deepEqual(roster.HIRE_ROSTER.slice(-1), [R.NAMELESS]);
  for (const id of roster.SAENGSA_ROSTER) {
    const p = roster.profOf(id), c = CHARACTERS_BY_ID[id], base = PROFICIENCY[id] ?? PROFICIENCY[c.variantOf];
    const sheet = roster.weaponInfo(c.weapon).school;
    for (const s of R.SCHOOLS5) if (!(c.variantOf && s === sheet)) assert.equal(p[s], base[s], `${id} ${s}`); // 얼터는 원본 칸(시트 무기 유파 칸만 +1)
    assert.equal('none' in p, 'none' in base, id); // 무유파 칸은 무유파가 주 유파인 인물만
    assert.equal(p[sheet], c.ai.proficiency, id); // 시트 무기 유파 = 실력 숙련도 (얼터 +1 · 상한 6 포함)
    assert.equal(roster.hireCostOf(id).coins, SAENGSA.hire.base + SAENGSA.hire.step * Math.max(...Object.values(p)));
  }
  assert.deepEqual(roster.profOf(R.NAMELESS), { german: 0, italian: 0, iberian: 0, japanese: 0, chinese: 0 }); // 만들기 전 빈 칸 — 신청 때 makeNameless
  assert.equal(roster.hireCostOf(R.NAMELESS).coins, 20);
  assert.equal(R.profFor({ school: 'none', prof: { german: 2, italian: 0, iberian: 0, japanese: 3, chinese: 0 } }), 2); // 무유파 무기 · none 칸 없음 → 가장 높은 값 − 1
  assert.equal(R.profFor({ school: 'none', prof: { german: 0, italian: 0, iberian: 0, japanese: 0, chinese: 0, none: 3 } }), 3);
  assert.ok(roster.SAENGSA_WEAPONS.length > 20 && !roster.SAENGSA_WEAPONS.includes('excalibur_replica'));
});

test('무명 검객 겉모습: 광기의 브론 옷차림 · 옷 일곱 색만 옷 색 줄로 · 살갗 · 머리 그대로 · 프로필 옷 칸 가리기', async () => {
  const N = await import('../../src/saengsa_nameless.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const base = CHARACTERS_BY_ID.bran_mad.look;
  const looks = Array.from({ length: N.clothCount() }, (_, i) => N.namelessLook(i));
  for (const look of looks) {
    assert.deepEqual(Object.keys(look.outfitPalette), Object.keys(base.outfitPalette));
    assert.equal(look.alter, 'bran');
    for (const k of ['skin', 'hair', 'helmet', 'eyeColor']) assert.equal(look[k], base[k], k);
    assert.notEqual(look.tunic, base.tunic);
  }
  assert.equal(new Set(looks.map((l) => l.tunic)).size, looks.length); // 옷 색 줄마다 다른 옷
  assert.equal(N.isClothPixel(0x24, 0x39, 0x6b), true); // 광기의 브론 남색 옷
  assert.equal(N.isClothPixel(0xf5, 0xa8, 0x78), false); // 살갗
  assert.equal(N.isClothPixel(0x6e, 0x3a, 0x2c), false); // 머리 · 가죽끈
});

test('무명 검객 숙련도 · 이름: 대회마다 새로 — 메인 0 ~ 2 · 보조 0 ~ 2(겹치면 높은 쪽) · 나머지 0 · 이름은 메인 유파 문화 (사장님 10/29 18:2x)', async () => {
  const { NAMELESS_NAMES } = await import('../../src/saengsa_names.js');
  const roster = await import('../../src/saengsa_roster.js');
  assert.deepEqual([SAENGSA.nameless.main, SAENGSA.nameless.sub, SAENGSA.nameless.other], [[0, 2], [0, 2], [0, 0]]);
  for (const [culture, names] of Object.entries(NAMELESS_NAMES)) {
    assert.ok(R.SCHOOLS5.includes(culture), culture);
    assert.ok(names.length >= 10 && names.length <= 15, culture);
    assert.equal(new Set(names).size, names.length, culture);
  }
  assert.equal(new Set(Object.values(NAMELESS_NAMES).flat()).size, Object.values(NAMELESS_NAMES).flat().length); // 문화끼리도 안 겹침
  let overlap = 0, allZero = 0, highMain = 0, total = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const t = make(seed, { companions: [R.NAMELESS, 'a'] });
    const nameless = t.teams.flatMap((team) => team.members).filter((f) => f.id === R.NAMELESS);
    assert.equal(nameless.length, 45 - 10 + 1); // 상대 자리 45 − 이름난 열 + 내가 고용한 하나
    const perCulture = {};
    for (const f of nameless) {
      total++;
      assert.ok(R.SCHOOLS5.includes(f.main) && R.SCHOOLS5.includes(f.sub));
      for (const s of R.SCHOOLS5) {
        const v = f.prof[s];
        assert.ok(Number.isInteger(v), `${seed} ${s}`);
        if (s !== f.main && s !== f.sub) assert.equal(v, 0, `${seed} ${f.key} ${s} 나머지`);
        else assert.ok(v >= 0 && v <= 2, `${seed} ${f.key} ${s}`);
      }
      if (f.main === f.sub) overlap++;
      if (R.SCHOOLS5.every((s) => f.prof[s] === 0)) allZero++;
      if (f.prof[f.main] === 2) highMain++;
      assert.ok(NAMELESS_NAMES[f.main].includes(f.tag), `${f.tag} ∈ ${f.main}`);
      assert.equal(roster.fighterName(f), `무명 검객 ${f.tag}`);
      (perCulture[f.main] ??= []).push(f.tag);
      seen.add(f.tag);
    }
    for (const [c, tags] of Object.entries(perCulture)) assert.equal(new Set(tags).size, Math.min(tags.length, NAMELESS_NAMES[c].length), `${seed} ${c} 한 대회 안 이름`);
    assert.ok(t.teams[0].members[1].tag, '내가 고용한 무명 검객도 새로');
  }
  assert.ok(overlap > 0 && overlap < total / 3, `메인 · 보조 겹침 ${overlap}/${total}`);
  assert.ok(allZero > 0, '모두 0 도 나올 수 있음');
  assert.ok(highMain > 0);
  assert.ok(seen.size > 40, `이름 ${seen.size} 가지`);
  // 겹치면 높은 쪽: 나머지 5 · 메인 독일 · 보조 독일 · 메인 값 0 · 보조 값 2 → 독일 2
  const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0.99, 0];
  let i = 0;
  const one = R.makeNameless(() => seq[i++] ?? 0);
  assert.deepEqual([one.main, one.sub, one.prof], ['german', 'german', { german: 2, italian: 0, iberian: 0, japanese: 0, chinese: 0 }]);
  assert.equal(one.tag, NAMELESS_NAMES.german[0]);
  assert.deepEqual(make(9), make(9)); // 씨앗이 같으면 같은 무명 검객
});

test('내 숙련도 (11/16 사장님 \'사람 셈도 문턱 기준으로 바꿔\'): 4 칸까지 1 · 5 칸 = 2 · 7 = 3 · 9 = 4 · 11(전부) = 5 · 편지 칸은 셈 밖 · 가장 낮게 1', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { nodesOf, isClosed } = await import('../../src/skill_tree_data.js');
  assert.deepEqual(SAENGSA.playerProf, { at2: 5, at3: 7, at4: 9, at5: 11 });
  assert.deepEqual(roster.playerProficiency({}), { german: 1, italian: 1, iberian: 1, japanese: 1, chinese: 1 });
  for (const s of R.SCHOOLS5) {
    const skills = nodesOf(s).filter((n) => n.cat !== 'letter' && !isClosed(s, n)).map((n) => n.id);
    const letter = nodesOf(s).find((n) => n.cat === 'letter').id;
    assert.equal(skills.length, 11, s);
    const p = (n, extra = []) => roster.playerProficiency({ [s]: new Set([...skills.slice(0, n), ...extra]) })[s];
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => p(n)), [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5], s);
    assert.equal(p(4, [letter]), 1, `${s} 편지는 칸으로 세지 않음`);
    // 비기 + 특수공격만 (10/29 옛 규칙의 4) = 2 칸 → 1
    const special = { german: 'G7', italian: 'I9', iberian: 'B4', japanese: 'J9', chinese: 'C6' }[s], secret = nodesOf(s).find((n) => n.cat === 'secret').id;
    assert.equal(roster.playerProficiency({ [s]: new Set([special, secret]) })[s], 1, s);
  }
});

test('시험판(testMode): 신청 늘 열림 · 모든 경기 바로 · 쉬는 시간 · 기권 없음 · 끝나면 바로 다음 대회', () => {
  const cfg = { ...SAENGSA, testMode: true };
  const now = at(30, 15, 7); // 신청 창 밖 · 대진 시각과 무관한 때
  assert.deepEqual(C.signupWindow(now, cfg), { open: true, day: '2026-10-30', from: now, to: null });
  const t = R.createTournament({ day: '2026-10-30', seed: 21, at: now, companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], ...DATA, cfg });
  assert.deepEqual(R.scheduleState(now, t, cfg), { kind: 'running' });
  assert.equal(R.advance(t, now, cfg), 7); // 16강 상대끼리 일곱은 바로
  for (let r = 0; r < 4; r++) {
    const m = R.myMatch(t);
    assert.equal(m.round, r);
    assert.equal(R.matchState(t, m, now, cfg), 'ready', `대진 ${r}`);
    assert.equal(R.advance(t, Infinity, cfg), 0, '내 경기는 기권 없음');
    assert.ok(R.finishMine(t, m, ['0-0'], now, winFor(t, m), cfg));
    const left = t.matches.filter((x) => x.round === r + 1 && !R.isMine(t, x)).length;
    assert.equal(R.advance(t, now, cfg), left, `대진 ${r + 1} 상대끼리`);
    assert.ok(t.matches.filter((x) => x.result).every((x) => x.result.at === now));
  }
  assert.deepEqual([t.status, R.placeOf(t), R.chestCount(t, cfg)], ['done', 'champion', 3]);
  assert.equal(R.canSignUp(now, t, cfg), true); // 같은 날 바로 다음 대회
  // 앞 대진이 다 끝나기 전엔 상대끼리 다음 경기도 기다림 · 내가 지면 대회는 바로 끝까지
  const u = R.createTournament({ day: '2026-10-30', seed: 22, at: now, companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], ...DATA, cfg });
  R.advance(u, now, cfg);
  assert.equal(u.matches.filter((x) => x.round === 1 && x.result).length, 0);
  const m = R.myMatch(u), w = winFor(u, m);
  R.finishMine(u, m, ['0-0'], now, { ...w, winner: w.winner === 'a' ? 'b' : 'a' }, cfg);
  R.advance(u, now, cfg);
  assert.deepEqual([u.status, R.myTeamOut(u), R.canSignUp(now, u, cfg)], ['done', true, true]);
  // 본판은 그대로: 같은 때 신청 창은 닫힘
  assert.equal(C.signupWindow(now).open, false);
});

test('상대 팀 무기 묶음 · 전용무기 · AI 나눠 주기 (사장님 10/29 19:5x · 11/19 아홉 \'9개로 하자\' · 무작위뿐 — 전용무기를 먼저 넣지 않음 · 저마다 가장 잘 맞는 무기)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { getWeapon } = await import('../../src/weapons.js');
  // 전용무기 = 시트 무기 등급 에픽 이상 — 로스터에서는 랴오 청강검 · 미나미 모노호시자오 (마야 · 김씨의 ??? 무기는 아님 — 확인 전)
  assert.deepEqual(Object.fromEntries(roster.SAENGSA_ROSTER.map((id) => [id, roster.signatureOf(id)]).filter(([, w]) => w)),
    { liao: 'qinggang', minami: 'kusanagi', artoria: 'excalibur', silver_wanderer_mad: 'monohoshizao', roland: 'durandal', bernardo: 'tizona', julia: 'dartagnan' }); // 사장님 10/29 22:3x 표 (랴오 청강검은 남김) · 쥘리아 달타냥 (10/30 초안 · 사장님 확인 전)
  assert.deepEqual([roster.signatureOf('samira'), roster.signatureOf('renji'), roster.signatureOf(R.NAMELESS), roster.signatureOf('roland')], [null, null, null, 'durandal']);
  assert.equal(roster.AI_TIER_DRAW.mystery, 0);
  let sigs = 0, sigHeld = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const t = R.createTournament({ day: '2026-10-30', seed, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['tree_branch', 'druid_whip', 'longsword'], ...roster.SAENGSA_DATA });
    assert.equal(t.teams[0].pool, undefined);
    for (const team of t.teams.slice(1)) {
      const ids = team.pool.map((w) => w.weapon);
      assert.equal(ids.length, SAENGSA.aiPool.size);
      assert.equal(SAENGSA.aiPool.size, 6, '사장님 11/21 \'무기 6개로 해.\' (전 9 — 11/19 · 5 — 10/29)');
      assert.equal(new Set(ids).size, ids.length, '서로 다른 여섯');
      assert.ok(team.pool.every((w) => w.tier !== 'mystery' && getWeapon(w.weapon).tier === w.tier), '??? 없음');
      for (const f of team.members) {
        assert.ok(ids.includes(f.weapon), '받은 무기 묶음 가운데서');
        if (f.sig && ids.includes(f.sig)) { sigs++; sigHeld += f.weapon === f.sig; } // 전용무기가 우연히 묶음에 든 때만 셈
      }
      assert.equal(new Set(team.members.map((f) => f.weapon)).size, team.members.length, '한 무기는 한 사람');
      // 다 세어 본 가장 큰 합과 같은가 · 숙련도 0 인 사람 수는 줄일 수 없는가
      const zeros = (ws) => team.members.filter((f, i) => R.profFor({ prof: f.prof, school: ws[i].school }) <= 0).length;
      const sum = (ws) => team.members.reduce((a, f, i) => a + R.armScore(f, ws[i]), 0);
      const now = team.members.map((f) => team.pool.find((w) => w.weapon === f.weapon));
      let bestSum = -Infinity, fewest = Infinity;
      for (const a of team.pool) for (const b of team.pool) for (const c of team.pool) {
        if (a === b || b === c || a === c) continue;
        bestSum = Math.max(bestSum, sum([a, b, c])); fewest = Math.min(fewest, zeros([a, b, c]));
      }
      assert.ok(Math.abs(sum(now) - bestSum) < 1e-9, `씨앗 ${seed} 가장 좋은 배분`);
      assert.equal(zeros(now), fewest, `씨앗 ${seed} 0 을 피함`);
    }
  }
  assert.ok(sigs === 0 || sigHeld / sigs > 0.8, `묶음에 든 전용무기를 주인이 듦 ${sigHeld}/${sigs}`);
  // 무기 묶음 = 무작위 뽑기뿐 (11/19 사장님 '늘 전용무기가 아니라') — 뽑기는 팀마다 아홉을 · 미리 든 무기 없이 · 주인의 전용무기는 우연히 들 때만(씨앗 400 개에서 약 22 %)
  const calls = [];
  const spy = (rnd, n, taken) => { calls.push([n, taken.length]); return roster.drawPool(rnd, n, taken); };
  let owners = 0, inPool = 0, held = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const c0 = calls.length;
    const t = R.createTournament({ day: '2026-10-30', seed, at: 0, companions: [R.NAMELESS, R.NAMELESS], ...roster.SAENGSA_DATA, drawPool: spy });
    calls.splice(c0 + t.teams.length - 1); // 상대 팀 무기 묶음 뽑기만 (그 뒤는 무기상자 더미 — 11/21 E · 팀이 가진 무기를 뺌)
    for (const team of t.teams.slice(1)) for (const f of team.members) if (f.sig) { owners++; const has = team.pool.some((w) => w.weapon === f.sig); inPool += has; held += has && f.weapon === f.sig; }
  }
  assert.ok(calls.length > 0 && calls.every(([n, k]) => n === SAENGSA.aiPool.size && k === 0), '여섯을 미리 든 무기 없이 뽑음');
  assert.ok(owners > 1000 && inPool > 0 && inPool / owners < 0.4, `전용무기가 묶음에 든 몫 ${inPool}/${owners} (우연히만)`);
  assert.ok(held / inPool > 0.8, `묶음에 든 전용무기를 주인이 듦 ${held}/${inPool}`);
  // 다친 · 죽은 사람이 생기면 다시 나눈다 (산 사람만 · 죽은 사람의 무기도 쓸 수 있음)
  const pool = [{ weapon: 'a1', school: 'german', tier: 'legend' }, { weapon: 'a2', school: 'italian', tier: 'common' }, { weapon: 'a3', school: 'japanese', tier: 'common' }];
  const p = (o) => ({ german: 0, italian: 0, iberian: 0, japanese: 0, chinese: 0, ...o });
  const team = { mine: false, pool, members: [
    { key: '1-0', id: 'x', prof: p({ german: 2, italian: 2 }), hp: 100, injuries: [], dead: false },
    { key: '1-1', id: 'y', prof: p({ german: 2 }), hp: 100, injuries: [], dead: false },
    { key: '1-2', id: 'z', prof: p({ japanese: 1 }), hp: 100, injuries: [], dead: false }] };
  R.aiArm(team);
  assert.deepEqual(team.members.map((f) => f.weapon), ['a2', 'a1', 'a3']); // x 는 이탈리아로 비켜 y 가 0 이 되지 않게
  team.members[1].dead = true;
  R.aiArm(team);
  assert.deepEqual(team.members.map((f) => f.weapon), ['a1', 'a1', 'a3']); // y 가 죽자 x 가 레전드를 (죽은 y 는 마지막 무기 그대로)
  team.members[1].dead = false;
  team.members[0].hp = 10;
  team.members[0].prof = p({ german: 2 });
  team.members[2].prof = p({ italian: 1, japanese: 1 });
  R.aiArm(team);
  assert.equal(team.members[1].weapon, 'a1'); // 똑같이 독일 2 라도 다친 x 보다 성한 y 가 레전드
  // 이긴 상대 팀은 결과 뒤 다시 나눔 (applyResult)
  const t = R.createTournament({ day: '2026-10-30', seed: 3, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['tree_branch', 'druid_whip', 'longsword'], ...roster.SAENGSA_DATA });
  const m = t.matches.find((x) => x.round === 0 && x.a !== 0 && x.b !== 0), A = t.teams[m.a];
  const key = A.members[0].key, before = structuredClone(A.members);
  R.applyResult(t, m, { winner: 'a', fighters: { [key]: { hp: 0, injuries: [], alive: false } }, entrants: { a: [key], b: [] } }, 0);
  const alive = A.members.filter((f) => !f.dead);
  assert.ok(alive.length === 2 && new Set(alive.map((f) => f.weapon)).size === 2);
  assert.deepEqual(m.result.pre.a.map((f) => f.weapon), before.map((f) => f.weapon)); // 결과의 pre 는 그 경기 무기
});

test('부러진 무기는 대회 끝까지 · 빠른 셈 부러짐 · 레전드는 안 부러짐 (사장님 10/29 20:1x)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const f = (key, weapon, extra = {}) => ({ key, id: key, weapon, ...roster.weaponInfo(weapon), prof: { ...PROF }, hp: 100, injuries: [], dead: false, ...extra });
  // 경기 한 번 부러질 확률 = 1 − (1 − 파손률)^breakClashes — 레전드 · 플라스마 · 참치 0
  const rate = (w) => 1 - (1 - roster.weaponInfo(w).frag) ** SAENGSA.quick.breakClashes;
  assert.deepEqual(['excalibur', 'durandal', 'lightsaber', 'frozen_tuna'].map(rate), [0, 0, 0, 0]);
  assert.ok(rate('tree_branch') > 0.7 && rate('longsword') > 0.12 && rate('longsword') < 0.2 && rate('goujian') < 0.05);
  let legend = 0, branch = 0;
  for (let s = 0; s < 300; s++) {
    const sides = { a: [f('0-0', 'excalibur')], b: [f('1-0', 'tree_branch')] };
    const r = R.quickResolve(sides, s);
    legend += !!r.fighters['0-0'].broken; branch += !!r.fighters['1-0'].broken;
    const plain = R.quickResolve({ a: [{ ...sides.a[0], frag: 0 }], b: [{ ...sides.b[0], frag: 0 }] }, s); // 부러짐을 빼도 승패 · 체력 · 부상은 같다
    assert.deepEqual([r.winner, r.fighters['0-0'].hp, r.fighters['1-0'].hp, r.fighters['1-0'].injuries], [plain.winner, plain.fighters['0-0'].hp, plain.fighters['1-0'].hp, plain.fighters['1-0'].injuries]);
  }
  assert.equal(legend, 0);
  assert.ok(branch > 200, `나뭇가지 ${branch}/300`);
  assert.equal(R.quickResolve({ a: [f('0-0', 'excalibur', { broken: true })], b: [f('1-0', 'excalibur')] }, 1).fighters['0-0'].broken, true); // 이미 부러진 것은 그대로
  assert.ok(R.power(f('x', 'longsword', { broken: true })) < R.power(f('x', 'longsword')));
  // 결과에 부러짐이 오면: 내 팀 = t.broken (다시 배정해도 부러진 채) · 상대 팀 = 무기 묶음의 그 줄 (다시 나눠도 부러진 채 · 점수 감점)
  const t = R.createTournament({ day: '2026-10-30', seed: 8, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['longsword', 'rapier', 'uchigatana'], ...roster.SAENGSA_DATA });
  assert.deepEqual(t.broken, []);
  R.advance(t, at(30, 10));
  const m = R.myMatch(t), mineSide = R.sidesOf(t, m)[0] === 0 ? 'a' : 'b', foe = t.teams[R.sidesOf(t, m)[mineSide === 'a' ? 1 : 0]];
  const foeKey = foe.members[0].key, foeWeapon = foe.members[0].weapon;
  R.applyResult(t, m, { winner: mineSide, fighters: { '0-0': { hp: 80, injuries: [{ part: 'arm', sev: 2.23, rests: 0 }], alive: true, broken: true }, [foeKey]: { hp: 0, injuries: [], alive: false, broken: true } }, entrants: { [mineSide]: ['0-0'], [mineSide === 'a' ? 'b' : 'a']: [foeKey] } }, at(30, 10));
  assert.deepEqual(t.broken, ['longsword']);
  assert.equal(t.teams[0].members[0].broken, true);
  assert.equal(t.teams[0].members[0].injuries[0].sev, 1); // 실제 싸움 심각도 1 넘음 → 1
  assert.equal(foe.pool.find((w) => w.weapon === foeWeapon).broken, true);
  const owned = ['longsword', 'rapier', 'uchigatana', 'hwando'];
  assert.ok(R.assignWeapons(t, ['hwando', 'rapier', 'longsword'], { owned, weaponInfo: roster.weaponInfo }));
  assert.deepEqual(t.teams[0].members.map((x) => !!x.broken), [false, false, true]); // 부러진 롱소드는 누구에게 줘도 부러진 채
  const setup = R.matchSetup(t, R.myMatch(t) ?? m, ['0-2'], at(30, 13));
  if (setup) assert.equal(setup.sides[setup.mineSide][0].broken, true); // 2단계 엔진에 broken: true 로 넘김
  const team = { mine: false, members: [{ key: 'k', id: 'x', prof: { ...PROF }, hp: 100, injuries: [], dead: false }], pool: [{ weapon: 'g1', school: 'german', tier: 'legend', broken: true }, { weapon: 'g2', school: 'german', tier: 'common' }] };
  R.aiArm(team);
  assert.equal(team.members[0].weapon, 'g2'); // 같은 유파면 부러진 레전드보다 성한 커먼
  team.pool[1].school = 'japanese';
  R.aiArm(team);
  assert.deepEqual([team.members[0].weapon, team.members[0].broken], ['g1', true]); // 0 을 피할 길이 부러진 칼뿐이면 그것 (그래도 줄 수 있음)
  // 대회가 끝나면: keepBrokenAfterCup false(기본) = 다음 대회 성함 · true = 넘김
  assert.equal(SAENGSA.keepBrokenAfterCup, false);
  mem.clear();
  P.setCoins(1000);
  const OWNED = ['tree_branch', 'druid_whip', 'w1', 'w2', 'w3'];
  const data = { ...DATA, owned: OWNED, hasTitle: true, hireCostOf: () => ({ coins: 20 }) };
  const cfgT = { ...SAENGSA, testMode: true };
  assert.ok(S.signUp({ now: at(30, 15), companions: ['a', 'b'], seed: 4, data, cfg: cfgT }).ok);
  S.updateSaengsa((d) => { d.current.broken = ['w1']; d.current.status = 'done'; return true; });
  assert.ok(S.signUp({ now: at(30, 15), companions: ['a', 'b'], seed: 5, data, cfg: cfgT }).ok);
  assert.deepEqual(S.readSaengsa().current.broken, []);
  S.updateSaengsa((d) => { d.current.broken = ['w1']; d.current.status = 'done'; return true; });
  assert.ok(S.signUp({ now: at(30, 15), companions: ['a', 'b'], seed: 6, data, cfg: { ...cfgT, keepBrokenAfterCup: true } }).ok);
  const kept = S.readSaengsa().current;
  assert.deepEqual(kept.broken, ['w1']);
  assert.ok(R.assignWeapons(kept, ['w1', 'w2', 'w3'], { owned: OWNED, weaponInfo: DATA.weaponInfo })); // 11/18: 신청은 무기 없이 — 첫 배정에서 넘어온 부러진 무기를 받으면 부러진 채
  assert.deepEqual(kept.teams[0].members.map((x) => !!x.broken), [true, false, false]);
});

test('엔진 잇기: 내 경기 = game.launchSaengsa (스위치 SAENGSA.engine.mine) · 없으면 빠른 셈 · 판 사람에 broken', async () => {
  const { makeEngine } = await import('../../src/saengsa_engine.js');
  let got = null;
  const game = { launchSaengsa: async (setup) => { got = setup; return null; } };
  assert.equal(makeEngine(game).real, true);
  assert.equal(makeEngine(game, { ...SAENGSA, engine: { mine: false, ai: false } }).real, false);
  assert.equal(makeEngine({}).real, false);
  assert.equal(await makeEngine({}).play({}), null);
  const t = make(7);
  R.advance(t, at(30, 10));
  t.broken = [t.teams[0].members[1].weapon];
  t.teams[0].members[1].broken = true;
  const m = R.myMatch(t);
  const setup = R.matchSetup(t, m, ['0-1'], at(30, 10));
  assert.equal(setup.control, 'watch');
  assert.equal(await makeEngine(game).play(setup), null); // 그만두기 = null (적지 않음)
  assert.equal(got.sides[setup.mineSide][0].broken, true);
  assert.equal(R.matchSetup(t, m, ['0-0', '0-1'], at(30, 10)).control, 'player');
});

test('전용무기 표 — 한 무기는 한 사람 (10/29 22:3x) · 전용무기는 팀마다 하나 — 팀 사이에는 막지 않음 (사장님 11/18 \'전용무기는 팀당 하나야\' · 11/19 우연히 들 때만)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { getWeapon } = await import('../../src/weapons.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const sig = SAENGSA.signature, ws = Object.values(sig);
  assert.equal(new Set(ws).size, ws.length, '한 무기는 한 사람');
  for (const [id, w] of Object.entries(sig)) { assert.ok(CHARACTERS_BY_ID[id], id); assert.ok(roster.SAENGSA_WEAPONS.includes(w), w); }
  assert.deepEqual(Object.fromEntries(Object.entries(sig).map(([id, w]) => [w, getWeapon(w).tier])), { kusanagi: 'legend', monohoshizao: 'epic', durandal: 'legend', tizona: 'epic', excalibur: 'legend', qinggang: 'epic', dartagnan: 'epic' });
  assert.equal(CHARACTERS_BY_ID.minami.weapon, 'kusanagi'); // 인물 시트 무기도 쿠사나기 (사장님 10/29 22:4x '미나미 스테이지 무기도 쿠사나기로 바꿔' — 본판 8980a3f4) · 광기의 미나미 무라마사(레어 — 전용무기 아님)
  assert.equal(CHARACTERS_BY_ID.minami_mad.weapon, 'muramasa');
  for (const id of ['minami_mad', 'silver_wanderer', 'liao_mad', 'artoria_mad', 'julia_mad']) assert.equal(roster.signatureOf(id), null, id);
  // 상대 팀마다: 무기 묶음은 서로 다름(한 팀 안에 같은 무기 둘 없음) · 주인 표시(f.sig)는 그대로 — 내 동료 · 내가 가진 무기와 상관없이
  const OWNED = ['tree_branch', 'druid_whip', 'longsword', 'excalibur', 'kusanagi'];
  let seenArt = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const t = R.createTournament({ day: '2026-10-30', seed, at: 0, companions: ['minami', R.NAMELESS], ...roster.SAENGSA_DATA });
    assert.ok(t.teams[0].members.every((f) => f.weapon === null), '신청은 무기 없이');
    for (const x of t.teams.slice(1)) {
      const ids = x.pool.map((w) => w.weapon);
      assert.equal(new Set(ids).size, ids.length, `씨앗 ${seed} 한 팀에 같은 무기 둘`);
      for (const f of x.members) if (sig[f.id]) assert.equal(f.sig, sig[f.id], `${f.id} 주인`); // 주인 표시만 — 묶음에 드는지는 우연 (11/19)
    }
    const art = t.teams.slice(1).flatMap((x) => x.members).find((f) => f.id === 'artoria');
    if (art) seenArt++;
  }
  assert.ok(seenArt > 0);
  // 팀 사이에는 막지 않음: 모든 상대 팀 무기 묶음에 엑스칼리버가 들게(뽑기를 바꿔) — 여러 팀이 함께 들고 · 아르토리아 팀에선 아르토리아가 듦(덤) · 내 팀도 배정
  const withExc = (rnd, n, taken) => ['excalibur', ...roster.drawPool(rnd, n - 1, [...taken, 'excalibur'])];
  const t = R.createTournament({ day: '2026-10-30', seed: 5, at: 0, companions: [R.NAMELESS, R.NAMELESS], ...roster.SAENGSA_DATA, drawPool: withExc });
  const foes = t.teams.slice(1);
  assert.ok(foes.every((x) => x.pool.filter((w) => w.weapon === 'excalibur').length === 1), '팀마다 하나 — 모든 상대 팀이 하나씩');
  const art = foes.flatMap((x) => x.members).find((f) => f.id === 'artoria');
  if (art) assert.equal(art.weapon, 'excalibur', '묶음에 들면 주인에게 (덤)');
  assert.equal(R.assignWeapons(t, ['excalibur', 'kusanagi', 'longsword'], { owned: OWNED, weaponInfo: roster.weaponInfo }), true, '상대 팀이 든 전용무기도 내 팀에 배정');
  assert.deepEqual(t.teams[0].members.map((f) => f.weapon), ['excalibur', 'kusanagi', 'longsword']);
  assert.equal(R.assignWeapons(t, ['excalibur', 'excalibur', 'longsword'], { owned: OWNED, weaponInfo: roster.weaponInfo }), false, '내 팀 안에서는 한 무기 한 사람');
  assert.equal(typeof R.lockedSignatures, 'undefined', '팀 사이 잠금은 걷음');
  // 고용 값: 숙련도 6 → 20 + 20 × 6 = 140 (손님 둘 · 아르토리아 6 — 사장님 10/29 22:4x) · 광기의 미나미 6(얼터 +1 · 상한 6 — 사장님 '광기는 상한에 걸려서 6임')
  assert.deepEqual([roster.hireCostOf('roland').coins, roster.hireCostOf('bernardo').coins, roster.hireCostOf('artoria').coins, roster.profOf('minami_mad').japanese, roster.profOf('artoria').german], [140, 140, 140, 6, 6]);
});

test('몸 상태 이어받기 (사장님 10/30 08:2x "몸 상태 이어받기 방랑 · 생사전 둘 다 켜."): 내 경기에만 적힘 · 같은 사람 · 같은 무기 · 결과가 적히면 지움 · 끄면 없음', () => {
  assert.equal(SAENGSA.resumeState, true);
  mem.clear();
  const t = make(5);
  S.updateSaengsa((d) => { d.current = t; return true; });
  S.syncSaengsa(at(30, 10));
  const m0 = R.myMatch(S.readSaengsa().current), other = S.readSaengsa().current.matches.find((m) => m.id !== m0.id && !m.result);
  const body = (blood) => ({ v: 1, blood, wounds: [{ part: 'thighB', type: 'cut', severity: 0.3, bleed: 0, local: [0, 0, 0], carried: true }, { part: 'chest', type: 'stab', severity: 0.5, bleed: 0.01, local: [0, 0, 0] }] });
  const bodies = { '0-0': body(0.8), '0-1': body(0.7), x: body(0.6), y: { ...body(0.2), dead: true } };
  assert.equal(S.saveResume(other.id, { picks: ['0-0'], arms: ['w1', 'w2', 'w3'], bodies }), false, '내 경기가 아니면 안 적음');
  assert.equal(S.saveResume(m0.id, { picks: ['0-0', '0-1'], arms: ['w1', 'w2', 'w3'], bodies, at: at(30, 10, 5) }), true);
  const t1 = S.readSaengsa().current, Rm = R.resumeOf(t1, m0.id);
  assert.deepEqual([Rm.matchId, Rm.picks, Rm.arms, Rm.bodies.y.dead, Rm.bodies['0-0'].wounds[0].carried], [m0.id, ['0-0', '0-1'], ['w1', 'w2', 'w3'], true, true]);
  assert.equal(R.resumeOf(t1, other.id), null, '다른 경기 열쇠로는 없음');
  assert.equal(R.resumeOf(t1, m0.id, { ...SAENGSA, resumeState: false }), null, '끄면 없음');
  assert.equal(R.resumeOf({ ...t1, resume: { ...t1.resume, picks: [] } }, m0.id), null, '모양이 틀리면 버림');
  // 경기 결과가 적히면 지움 (실제 싸움 결과 · 빠른 셈 모두 applyResult)
  const res = S.playMine(m0.id, ['0-0', '0-1'], at(30, 10, 6), null);
  assert.ok(res);
  assert.equal(S.readSaengsa().current.resume, undefined, '끝난 경기는 이어받을 몸이 없다');
  assert.equal(S.saveResume(m0.id, null), false, '지울 것이 없으면 저장 안 함');
});

test('맵 = 회차 (사장님 11/21 G \'16강전은 열린 원, 8강전은 두 다리, 4강전과 결승은 성벽 안뜰로 하자.\'): 판(matchSetup · spec)에 회차 · 고르기 화면 = 싸움 판 = 다시보기 · 옛 저장(옛 씨앗 규칙 · 이어받던 경기)도 깨지지 않음', async () => {
  const M = await import('../../src/saengsa_maps.js');
  const SM = await import('../../src/saengsa_match.js');
  const id = (m) => m?.id ?? 'circle';
  mem.clear();
  S.updateSaengsa((d) => { d.current = make(5); return true; });
  S.syncSaengsa(at(30, 10));
  const cur = () => S.readSaengsa().current;
  const seen = [];
  for (let round = 0; round < 4; round++) {
    const t = cur(), m = R.myMatch(t);
    assert.equal(m.round, round);
    const setup = R.matchSetup(t, m, ['0-0', '0-1'], at(30, 10 + round));
    const spec = SM.specFromSetup(setup);
    assert.deepEqual([setup.round, setup.rounds, spec.round, spec.rounds], [round, 4, round, 4]);
    assert.equal(M.mapOfSetup(setup), M.mapOfMatch(t, m), '싸움 판 = 고르기 화면');
    assert.equal(M.mapOfSetup(spec), M.mapOfMatch(t, m), 'main.js 가 읽는 spec 도 같음');
    seen.push(id(M.mapOfMatch(t, m)));
    if (round === 1) {
      // 옛 저장 흉내: 이어받던 8강(옛 씨앗 규칙 때 적은 몸) · 앞 결과 판 saengsa-6 · 판에 rounds 없음 → 회차 맵(두 다리) · 깨지지 않음
      const bodies = { '0-0': { v: 1, blood: 0.8, wounds: [] } };
      assert.equal(S.saveResume(m.id, { picks: ['0-0', '0-1'], arms: ['w1', 'w2', 'w3'], bodies, at: at(30, 11, 1) }), true);
      S.updateSaengsa((d) => { for (const x of d.current.matches) if (x.result) x.result.ver = 'saengsa-6'; return true; });
      const old = cur(), Rm = R.resumeOf(old, m.id);
      assert.deepEqual(Rm.picks, ['0-0', '0-1']);
      const again = R.matchSetup(old, R.myMatch(old), Rm.picks, at(30, 11, 2));
      const { rounds: _gone, ...oldSetup } = again;
      assert.equal(M.mapOfSetup(oldSetup), M.SAENGSA_MAP_BY_ID.bridges, 'rounds 없는 옛 판 = 본판 크기로 회차 맵');
      assert.equal(M.mapOfSetup(SM.specFromSetup(oldSetup)), M.SAENGSA_MAP_BY_ID.bridges);
    }
    assert.ok(S.playMine(m.id, ['0-0', '0-1'], at(30, 10 + round, 30), winFor(t, m)), `${round} 회차 이김`);
  }
  assert.deepEqual(seen, ['circle', 'bridges', 'court', 'court']);
  // 다시보기 몫: 끝난 경기도 같은 맵 (결과 판 saengsa-7 · 옛 판 결과도 회차로 셈 — 깨지지 않음)
  const done = cur();
  assert.equal(done.status, 'done');
  const mine = done.matches.filter((m) => R.isMine(done, m)).sort((x, y) => x.round - y.round);
  assert.deepEqual(mine.map((m) => id(M.mapOfMatch(done, m))), seen);
  assert.deepEqual(mine.map((m) => m.result.ver), ['saengsa-6', R.SAENGSA_VER, R.SAENGSA_VER, R.SAENGSA_VER]);
  assert.equal(R.SAENGSA_VER, 'saengsa-7');
});

test('몸 사본 (생사전 넷): 들고 온 상처(carried) · 죽은 몸은 죽은 채 · 흙 몸도', async () => {
  const { snapshotFighter, applyFighterSnapshot } = await import('../../src/fight_snapshot.js');
  const mk = (over = {}) => ({ weapon: { id: 'longsword', fragile: true }, blood: 1, bleed: 0, consciousness: 1, pain: 0, limbs: { armS: 1, armO: 1 }, wounds: [], weaponBroken: false, stamina: { value: 100, max: 100 }, secretUsed: 0, revive: null, armed: true, state: 'stand', canDie: true,
    get alive() { return this.state !== 'dead'; }, setState(s) { if (s === 'dead' && !this.canDie) return; this.state = s; }, breakWeapon(quiet) { this.weaponBroken = true; this.quiet = quiet; }, dropSword() { this.armed = false; }, ...over });
  const a = mk({ blood: 0.3, wounds: [{ part: 'thighB', type: 'cut', severity: 0.3, bleed: 0, local: { x: 0, y: 0, z: 0 }, carried: true }, { part: 'neck', type: 'cut', severity: 1.4, bleed: 0.2, local: { x: 0, y: 0, z: 0 } }], state: 'dead', causeOfDeath: '출혈', weaponBroken: true });
  const s = JSON.parse(JSON.stringify(snapshotFighter(a)));
  assert.deepEqual([s.dead, s.cause, s.wounds[0].carried, s.wounds[1].carried], [true, '출혈', true, undefined]);
  const b = mk();
  applyFighterSnapshot(b, s);
  assert.deepEqual([b.alive, b.causeOfDeath, b.wounds.map((w) => !!w.carried), b.weaponBroken, b.quiet], [false, '출혈', [true, false], true, true], '죽은 채 · 들고 온 상처 표시 · 조용히 부러짐');
  const clay = mk({ canDie: false });
  applyFighterSnapshot(clay, s);
  assert.equal(clay.alive, false, '흙 몸(머리가 떨어져 죽었던 몸)도 죽은 채');
  const live = mk();
  applyFighterSnapshot(live, { ...s, dead: undefined });
  assert.equal(live.alive, true, '산 몸은 산 채');
});

test('쥘리아 생사전 몫 (사장님 10/30 22:1x \'상점주인이자 방랑과 생사전에 나오게 해\' — 숙련도 · 성향 · 고용 · 전용무기 초안 · 사장님 확인 전)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const T = await import('../../src/character_temperament.js');
  assert.ok(roster.SAENGSA_ROSTER.includes('julia') && roster.SAENGSA_ROSTER.includes('julia_mad'));
  assert.deepEqual(roster.profOf('julia'), { german: 1, italian: 4, iberian: 3, japanese: 1, chinese: 2 }); // 이베리아 3 · 동방 2 = 사장님 10/30 22:4x 결정
  assert.deepEqual(roster.profOf('julia_mad'), { german: 1, italian: 5, iberian: 3, japanese: 1, chinese: 2 }, '얼터 +1 (이탈리아 — 시트 무기 유파)');
  assert.deepEqual([roster.hireCostOf('julia').coins, roster.hireCostOf('julia_mad').coins], [100, 120], '20 + 20 × 가장 높은 숙련도');
  assert.deepEqual([roster.signatureOf('julia'), roster.signatureOf('julia_mad')], ['dartagnan', null], '전용무기는 한 꼴에만');
  assert.equal(Object.values(SAENGSA.signature).filter((w) => w === 'dartagnan').length, 1, '달타냥은 다른 사람 전용무기가 아님');
  const a = T.temperamentOf('julia'), b = T.temperamentOf('julia_mad');
  assert.deepEqual([a.distance, a.feint, a.counter, a.wounded, a.team.target], [0.45, 0.84, 0.481, 'withdraw', 'weakest'], '최신 본판 쥘리아 시트의 간격 · 속임 · 받아치기와 일치 — 실제 AI는 유지');
  assert.ok(b !== a && b.press > a.press && b.patience < a.patience && b.composure === 1 && b.finisher === 1, '얼터: 더 차갑고 끈질김');
  assert.equal(T.temperamentOf('minami_mad'), T.temperamentOf('minami'), '다른 얼터는 원본 칸 그대로');
});

test('고용 값 덤 (사장님 11/19 \'숙련 6 캐릭터들은 금화에 더해 뿔피리 1개로 가격 책정. 5 캐릭은 금화에 더해 머리 1~3개 랜덤\'): 규칙 · 그날 안에는 같은 값 · 날마다 다시', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const T = await import('../../src/saengsa_text.js');
  assert.deepEqual(SAENGSA.hire, { base: 20, step: 20, extra: { 6: { horns: [1, 1] }, 5: { heads: [1, 3] } } });
  // 규칙: 금화 = 20 + 20 × 가장 높은 숙련도(그대로) · 6 = 뿔피리 1 · 5 = 머리 1 ~ 3 · 그 밖 덤 없음
  assert.deepEqual(R.hireCost(6, { id: 'x', day: '2026-11-19' }), { coins: 140, horns: 1 });
  assert.deepEqual(R.hireCost(4, { id: 'x', day: '2026-11-19' }), { coins: 100 });
  assert.deepEqual(R.hireCost(0, { id: 'x', day: '2026-11-19' }), { coins: 20 });
  const days = Array.from({ length: 60 }, (_, i) => C.shiftDay('2026-11-01', i));
  const seen = new Set();
  for (const day of days) for (const id of ['a', 'b', 'c']) {
    const c = R.hireCost(5, { id, day });
    assert.equal(c.coins, 120);
    assert.equal(c.horns, undefined);
    assert.ok(Number.isInteger(c.heads) && c.heads >= 1 && c.heads <= 3, `${id} ${day} 머리 ${c.heads}`);
    assert.deepEqual(R.hireCost(5, { id, day }), c, '같은 날 · 같은 인물 = 같은 값');
    seen.add(c.heads);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3], '날 · 인물마다 1 · 2 · 3 이 다 나옴');
  const byDay = new Set(days.map((day) => R.hireCost(5, { id: 'a', day }).heads));
  assert.ok(byDay.size > 1, '날이 바뀌면 다시 굴림');
  // 로스터: 가장 높은 숙련도 6 → 뿔피리 1 · 5 → 머리 1 ~ 3 · 무명 검객 덤 없음 · 같은 날은 몇 번을 불러도 같음 · day 를 안 주면 지금 신청 창의 날
  const day = C.signupWindow(at(29, 23)).day;
  let six = 0, five = 0;
  for (const id of roster.SAENGSA_ROSTER) {
    const best = Math.max(...Object.values(roster.profOf(id))), c = roster.hireCostOf(id, day);
    assert.equal(c.coins, SAENGSA.hire.base + SAENGSA.hire.step * best, id);
    assert.equal(c.horns, best === 6 ? 1 : undefined, `${id} 뿔피리`);
    assert.ok(best === 5 ? c.heads >= 1 && c.heads <= 3 : c.heads === undefined, `${id} 머리`);
    assert.deepEqual(roster.hireCostOf(id, day), c);
    six += best === 6; five += best === 5;
  }
  assert.ok(six > 0 && five > 0, `숙련 6 ${six} · 5 ${five}`);
  assert.deepEqual(roster.hireCostOf(R.NAMELESS, day), { coins: 20 });
  assert.equal(roster.hireDay(at(30, 1, 30)), roster.hireDay(at(29, 22, 10)), '자정을 넘어도 그 신청 창의 날');
  // 화면 글 (화면 읽기 · 모자란 것 — ~습니다)
  assert.equal(T.hireLine({ coins: 140, horns: 1 }), '고용 금화 140 · 뿔피리 1');
  assert.equal(T.hireLine({ coins: 120, heads: 2 }), '고용 금화 120 · 머리 2');
  assert.equal(T.hireLine(40), '고용 금화 40');
  assert.deepEqual([T.shortLine(['heads']), T.shortLine(['horns', 'coins']), T.shortLine(['coins', 'heads', 'horns']), T.shortLine([])], ['머리가 모자랍니다.', '금화와 뿔피리가 모자랍니다.', '금화 · 머리 · 뿔피리가 모자랍니다.', '']);
});

test('고용 값 내기 (11/19): 신청은 금화 · 머리 · 뿔피리를 한꺼번에 · 하나라도 모자라면 신청 안 됨(아무것도 안 냄) · 돌려줄 때 셋 모두 · 번 것 그대로', () => {
  mem.clear();
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1 })); // 빈 저장 (열쇠가 없으면 앞 시험의 대회를 쥐고 있음)
  const OWNED = ['tree_branch', 'druid_whip', 'w1', 'w2', 'w3'];
  const days = [];
  const cost = { a: { coins: 140, horns: 1 }, b: { coins: 120, heads: 2 } };
  const data = { ...DATA, owned: OWNED, hasTitle: true, hireCostOf: (id, day) => { days.push(day); return cost[id]; } };
  const wallet = () => { const p = P.readProgress(); return { coins: p.coins, heads: p.heads, horns: p.horns }; };
  P.setCoins(300); P.setHeads(1); P.setHorns(0);
  const earned0 = structuredClone(P.readProgress().earned);
  // 머리 · 뿔피리가 모자람 → 신청 안 됨 · 지갑 그대로 · 대회 없음 · 모자란 것 모두(차례 금화 · 머리 · 뿔피리)
  let r = S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data });
  assert.deepEqual([r.ok, r.why, r.short, r.cost], [false, 'heads', ['heads', 'horns'], { coins: 260, heads: 2, horns: 1 }]);
  assert.deepEqual(wallet(), { coins: 300, heads: 1, horns: 0 });
  assert.equal(S.readSaengsa().current, null);
  assert.ok(days.length === 2 && days.every((d) => d === C.signupWindow(at(29, 23)).day), '신청 창의 날을 넘김 (고르기 카드와 같은 값)');
  P.setHeads(5);
  r = S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data });
  assert.deepEqual([r.why, r.short], ['horns', ['horns']]);
  P.setCoins(100); P.setHorns(3);
  r = S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data });
  assert.deepEqual([r.why, r.short], ['coins', ['coins']]);
  assert.deepEqual(wallet(), { coins: 100, heads: 5, horns: 3 });
  // 다 있으면 셋을 한 번에 냄
  P.setCoins(300);
  r = S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data });
  assert.equal(r.ok, true);
  assert.deepEqual(wallet(), { coins: 40, heads: 3, horns: 2 });
  assert.ok(S.readSaengsa().current);
  // 돌려주기 (신청 저장 실패 때 signUp 이 쓰는 길): 셋 모두 · payHire 의 거꾸로 · 모자라면 payHire 는 아무것도 안 냄
  assert.equal(S.refundHire(r.cost), true);
  assert.deepEqual(wallet(), { coins: 300, heads: 5, horns: 3 });
  assert.deepEqual(S.payHire({ coins: 10, heads: 9, horns: 0 }), { ok: false, short: ['heads'] });
  assert.deepEqual(wallet(), { coins: 300, heads: 5, horns: 3 });
  assert.deepEqual(S.payHire({ coins: 10, heads: 1, horns: 1 }), { ok: true, short: [] });
  assert.deepEqual(wallet(), { coins: 290, heads: 4, horns: 2 });
  assert.deepEqual(P.readProgress().earned, earned0, '번 것(도살자 · 대부호 셈)은 내고 돌려받아도 그대로');
});

test('본판 임시 상시 열림 (사장님 11/21 \'생사전은 일시적으로 상시 무한 참여 가능으로 열어둬. 그래야 테스트 가능.\'): 언제든 신청 창 열림 · 같은 날 다시 신청 · 기권 없음', async () => {
  const C = await import('../../src/saengsa_clock.js');
  const R = await import('../../src/saengsa_rules.js');
  const ON = { ...SAENGSA, anytime: true, testMode: false };
  assert.equal(C.openAlways(ON), true);
  assert.equal(C.openAlways({ ...SAENGSA, anytime: false, testMode: false }), false);
  for (const h of [3, 10, 15, 21]) {
    const now = new Date(2026, 10, 21, h, 0, 0).getTime();
    assert.equal(C.signupWindow(now, ON).open, true, `${h} 시`);
    assert.equal(C.signupWindow(now, { ...ON, anytime: false }).open, false, `${h} 시 (끈 판은 닫힘)`);
    const w = C.signupWindow(now, ON);
    assert.equal(R.canSignUp(now, { status: 'done', day: w.day }, ON), true, '같은 날 끝낸 대회 뒤 다시');
  }
});

test('3:3 (사장님 11/20 \'생사전에서 3:3 쓸게.\'): 나서는 사람 셋까지 · 상대 고르기(11/21 쉼 규칙 아래 — 센 둘 + 셋째는 체력 aiThirdHp 이상 · 결승은 모두) · 빠른 셈 3:3', () => {
  assert.equal(SAENGSA.entrantsMax, 3);
  assert.equal(SAENGSA.teamSize, 3);
  assert.equal(SAENGSA.aiThirdHp, 60);
  assert.equal(SAENGSA.aiPairHp, undefined, '전 문턱(체력 40 이상 모두 · 둘 밑이면 하나) 걷음');
  // 상대 고르기 (aiPick): 산 사람을 센 차례로 · 센 둘은 늘 · 셋째(가장 약한 사람)는 체력 H 이상일 때만 · 결승은 모두 · 죽은 사람은 빼고
  const f = (key, hp, tier = 'common', dead = false, injuries = []) => ({ key, id: key, weapon: 'w', school: 'german', tier, prof: { ...PROF }, hp, injuries, dead });
  const H = SAENGSA.aiThirdHp;
  assert.deepEqual(R.aiPick([f('1-0', 100), f('1-1', 80), f('1-2', H)]), ['1-0', '1-1', '1-2']);
  assert.deepEqual(R.aiPick([f('1-0', 100), f('1-1', H - 1), f('1-2', 90, 'legend')]), ['1-2', '1-0'], '셋째가 체력 H 밑이면 쉼');
  assert.deepEqual(R.aiPick([f('1-0', 100), f('1-1', H - 1), f('1-2', 90, 'legend')], SAENGSA, { final: true }), ['1-2', '1-0', '1-1'], '결승은 모두 (뒤에 쉼이 없음)');
  assert.deepEqual(R.aiPick([f('1-0', H - 1), f('1-1', 100), f('1-2', 20)]), ['1-1', '1-0'], '센 둘은 지쳤어도 나감 (전 규칙은 하나만)');
  assert.deepEqual(R.aiPick([f('1-0', 100), f('1-1', 100, 'common', true), f('1-2', 30)]), ['1-0', '1-2'], '산 사람이 둘이면 둘 다');
  assert.deepEqual(R.aiPick([f('1-0', 10), f('1-1', 5)]), ['1-0', '1-1']);
  assert.deepEqual(R.aiPick([f('1-0', 10, 'common', true), f('1-1', 5), f('1-2', 0, 'common', true)]), ['1-1']);
  assert.deepEqual(R.aiPick([f('1-0', 100), f('1-1', 100), f('1-2', 100, 'common', false, [{ part: 'leg', sev: 0.8, rests: 0 }])]), ['1-0', '1-1', '1-2'], '문턱은 체력만 (부상은 센 차례에만)');
  // 2 일 때: 센 둘
  const TWO = { ...SAENGSA, entrantsMax: 2 };
  assert.deepEqual(R.aiPick([f('1-0', 100), f('1-1', 80), f('1-2', H)], TWO), ['1-0', '1-1']);
  // 결승 가름 (대진 넷째)
  const tt = make(7);
  assert.deepEqual(tt.matches.filter((x) => R.isFinal(tt, x)).map((x) => x.round), [3]);
  // 내 고름: 한 명 ~ 세 명 · 넷 · 겹침은 안 됨 → 엔진 판 setup 이 셋 대 셋
  const t = make(7);
  R.advance(t, at(30, 10));
  const m = R.myMatch(t);
  assert.equal(R.validPicks(t, ['0-0', '0-1', '0-2']), true);
  assert.equal(R.validPicks(t, ['0-0', '0-1', '0-2', '0-0']), false);
  assert.equal(R.validPicks(t, ['0-0', '0-1', '0-1']), false);
  assert.equal(R.validPicks(t, ['0-0', '0-1', '0-2'], TWO), false);
  const setup = R.matchSetup(t, m, ['0-2', '0-0', '0-1'], at(30, 10));
  assert.equal(setup.control, 'player');
  assert.deepEqual(setup.entrants[setup.mineSide], ['0-2', '0-0', '0-1']);
  const foeSide = setup.mineSide === 'a' ? 'b' : 'a';
  assert.equal(setup.entrants[foeSide].length, 3, '첫 경기 상대는 모두 체력 100 — 셋');
  assert.equal(setup.sides[foeSide].length, 3);
  // 빠른 셈 3:3: 같은 씨앗 같은 결과 · 여섯 모두 적힘 · 이긴 쪽에 산 사람 · 셋은 같은 둘보다 셈 힘이 큼(합 × 수 몫 countK)
  const sides = { a: [f('0-0', 100), f('0-1', 70), f('0-2', 50)], b: [f('1-0', 100), f('1-1', 100), f('1-2', 100)] };
  for (let s = 0; s < 50; s++) {
    const r = R.quickResolve(sides, s);
    assert.deepEqual(r, R.quickResolve(structuredClone(sides), s));
    assert.equal(Object.keys(r.fighters).length, 6);
    assert.ok(sides[r.winner].some((x) => r.fighters[x.key].alive), `씨앗 ${s}`);
  }
  assert.ok(R.sidePower(sides.b) > R.sidePower(sides.b.slice(0, 2)));
  // 상대끼리 경기(빠른 셈)도 셋씩 나감: 신청 직후 끝난 16 강 경기 결과의 나선 사람 수
  const done = t.matches.filter((x) => x.result && x.result.by === 'quick');
  assert.ok(done.length >= 7);
  assert.ok(done.every((x) => x.result.entrants.a.length === 3 && x.result.entrants.b.length === 3), '첫 대진은 모두 체력 100 — 셋 대 셋');
});

test('팔다리 잘림 · 이탈 (11/21 C — 사장님 \'팔다리 부상은 권고대로 할게 but 은퇴 대신 이탈\'): 잃은 팔다리는 대회 끝까지 · 쉼으로도 안 돌아옴 · 칼 팔 · 다리 = 이탈(못 나섬 · AI 고르기 뺌 · 무기 안 받음) · 빈손 팔만 = 나섬 · 힘 × oneArmK', () => {
  assert.deepEqual(SAENGSA.outLimbs, ['armS', 'legF', 'legB']);
  const q = SAENGSA.quick;
  assert.ok(q.oneArmK > 0 && q.oneArmK <= 1 && q.winSever.out >= 0 && q.winSever.armO >= 0);
  const f = (key, extra = {}) => ({ key, id: key, weapon: 'w', school: 'german', tier: 'common', prof: { ...PROF }, hp: 100, injuries: [], dead: false, ...extra });
  assert.equal(R.isOut(f('a', { lost: ['armS'] })), true);
  assert.equal(R.isOut(f('a', { lost: ['legB'] })), true);
  assert.equal(R.isOut(f('a', { lost: ['armO'] })), false);
  assert.equal(R.isOut(f('a')), false, '옛 저장(칸 없음) = 잃은 것 없음');
  assert.ok(Math.abs(R.power(f('a', { lost: ['armO'] })) - q.oneArmK * R.power(f('a'))) < 1e-12);
  // AI 고르기: 이탈은 빼고 · 빈손 팔만 잃은 사람은 그대로
  assert.deepEqual(R.aiPick([f('0', { lost: ['armS'] }), f('1'), f('2', { lost: ['armO'] })]).sort(), ['1', '2']);
  // 내 고르기 · 잃은 것은 결과 · 쉼으로 지워지지 않음
  const t = make();
  R.advance(t, at(30, 10));
  const team = t.teams[0].members;
  const m0 = R.myMatch(t);
  R.finishMine(t, m0, ['0-0', '0-1', '0-2'], at(30, 10, 5), winFor(t, m0, {
    '0-0': { hp: 60, injuries: [{ part: 'arm', sev: 1, rests: 0 }], alive: true, lost: ['armO'] },
    '0-1': { hp: 40, injuries: [{ part: 'leg', sev: 1, rests: 0 }], alive: true, lost: ['legF'] },
    '0-2': { hp: 70, injuries: [], alive: true },
  }));
  assert.deepEqual([team[0].lost, team[1].lost, team[2].lost], [['armO'], ['legF'], undefined]);
  R.advance(t, at(30, 10, 5));
  const m1 = R.myMatch(t);
  assert.equal(R.validPicks(t, ['0-1']), false, '이탈은 못 나섬');
  assert.equal(R.validPicks(t, ['0-0', '0-2']), true, '빈손 팔만 잃은 사람은 나섬');
  const w1 = team[1].weapon;
  assert.equal(R.assignWeapons(t, ['w2', null, 'w3'], { owned: ['w1', 'w2', 'w3'], weaponInfo: DATA.weaponInfo }), true, '이탈한 사람은 무기 배정에서 뺌');
  assert.deepEqual([team[0].weapon, team[1].weapon, team[2].weapon], ['w2', w1, 'w3']);
  const set = R.matchSetup(t, m1, ['0-0', '0-2'], at(30, 10, 6));
  assert.deepEqual(set.sides[set.mineSide].find((p) => p.key === '0-0').lost, ['armO'], '판에 넘기는 사람에 lost');
  R.finishMine(t, m1, ['0-2'], at(30, 10, 6), winFor(t, m1, { '0-2': { hp: 50, injuries: [], alive: true } }));
  // 0-0 · 0-1 은 쉼: 단면 상처(중상)는 한 단계 · 잃은 팔다리는 그대로
  assert.deepEqual([team[0].lost, team[0].injuries.map((i) => i.sev)], [['armO'], [0.49]]);
  assert.deepEqual([team[1].lost, team[1].injuries.map((i) => i.sev), R.isOut(team[1])], [['legF'], [0.49], true]);
  R.advance(t, at(30, 10, 6));
  const m2 = R.myMatch(t);
  R.finishMine(t, m2, ['0-2'], at(30, 10, 7), winFor(t, m2, { '0-2': { hp: 40, injuries: [], alive: true } }));
  assert.deepEqual([team[0].lost, team[0].injuries.map((i) => i.sev)], [['armO'], [0.09]], '두 번 쉬어 단면 상처는 흔적 · 팔은 돌아오지 않음');
  assert.equal(R.isOut(team[1]), true, '두 번 쉬어도 이탈 그대로');
  // 상대 팀 무기 나눠 주기: 이탈한 사람은 무기를 받지 않음
  const u = make(41);
  R.advance(u, at(30, 10));
  const foe = u.teams.find((x) => !x.mine && Array.isArray(x.pool) && x.members.every((y) => !y.dead));
  const before = foe.members[0].weapon;
  foe.members[0].lost = ['armS'];
  R.aiArm(foe);
  assert.equal(foe.members[0].weapon, before, '이탈한 사람 무기 그대로(마지막 무기)');
});

test('나설 사람이 없는 팀 (11/21 C — 모두 죽음 · 이탈): 그 경기를 기권으로 짐 · 대회가 멈추지 않음 · 둘 다 없으면 씨앗 굴림', () => {
  // ① 상대끼리: 한 팀이 모두 이탈 → 기권 · 다른 팀은 모두 쉼 · 대회 끝까지
  const t = make(51);
  const m = t.matches.find((x) => !x.result && x.round === 0 && R.sidesOf(t, x).every((k) => k != null && k !== 0)); // 16 강 상대끼리 (advance 전)
  const [A] = R.sidesOf(t, m);
  for (const f of t.teams[A].members) f.lost = ['legB'];
  R.advance(t, at(30, 10));
  assert.ok(m.result, '경기가 끝남');
  assert.deepEqual([m.result.by, m.result.winner, m.result.entrants], ['forfeit', 'b', { a: [], b: [] }]);
  assert.ok(Object.keys(m.result.rest ?? {}).length > 0 || m.round === 3, '이긴 팀은 모두 쉼');
  // ② 둘 다 모두 이탈 → 씨앗 굴림으로 한 쪽 (같은 씨앗 = 같은 쪽)
  const u = make(52), w = make(52);
  for (const v of [u, w]) {
    const x = v.matches.find((y) => !y.result && y.round === 0 && R.sidesOf(v, y).every((k) => k != null && k !== 0));
    for (const side of R.sidesOf(v, x)) for (const f of v.teams[side].members) f.lost = ['armS'];
    R.advance(v, at(30, 10));
    assert.equal(x.result.by, 'forfeit');
  }
  assert.deepEqual(u.matches.map((x) => x.result?.winner ?? null), w.matches.map((x) => x.result?.winner ?? null));
  // ③ 내 팀이 모두 이탈 · 죽음 → 내 경기 곧바로 기권(늘 열림 · 시험판도) → 대회는 끝까지
  for (const cfg of [SAENGSA, { ...SAENGSA, testMode: true }]) {
    const v = make(53, cfg === SAENGSA ? {} : { cfg });
    R.advance(v, at(30, 10), cfg);
    const mine = R.myMatch(v);
    v.teams[0].members[0].lost = ['armS']; v.teams[0].members[1].dead = true; v.teams[0].members[2].lost = ['legF'];
    R.advance(v, at(30, 10), cfg);
    assert.deepEqual([mine.result?.by, R.winnerOf(v, mine) === 0], ['forfeit', false], '내 기권');
    assert.equal(R.myMatch(v), null);
    R.advance(v, Infinity, cfg);
    assert.equal(v.status, 'done');
  }
  // ④ 내 경기 상대가 모두 이탈 → 상대 기권 (내가 이김 · 내 팀은 모두 쉼)
  const x = make(54);
  R.advance(x, at(30, 10));
  const mm = R.myMatch(x), [XA, XB] = R.sidesOf(x, mm), foe = XA === 0 ? XB : XA;
  for (const f of x.teams[foe].members) f.lost = ['legB'];
  R.advance(x, at(30, 10));
  assert.deepEqual([mm.result?.by, R.winnerOf(x, mm)], ['forfeit', 0]);
  assert.ok(R.myMatch(x), '다음 내 경기');
});

test('빠른 셈 잘림 (11/21 C — 엔진 재기 몫 winSever): 이긴 쪽 산 사람만 · 이탈은 칼 팔 · 다리 + 그 부위 중상 · 빈손 팔 + 팔 중상 · 들고 온 lost 는 그대로', () => {
  const q = SAENGSA.quick;
  const f = (key, extra = {}) => ({ key, id: key, weapon: 'w', school: 'german', tier: 'common', prof: { ...PROF }, hp: 100, injuries: [], dead: false, ...extra });
  let n = 0, out = 0, armO = 0;
  const limbs = {};
  for (let s = 0; s < 6000; s++) {
    const sides = { a: [f('a0'), f('a1'), f('a2')], b: [f('b0'), f('b1'), f('b2')] };
    const r = R.quickResolve(sides, s);
    for (const side of ['a', 'b']) for (const x of sides[side]) {
      const o = r.fighters[x.key];
      if (side !== r.winner) { assert.equal(o.lost, undefined, '진 쪽은 잘림 셈 없음'); continue; }
      if (!o.alive) { assert.equal(o.lost, undefined); continue; }
      n++;
      for (const l of o.lost ?? []) limbs[l] = (limbs[l] ?? 0) + 1;
      if (R.isOut(o)) { out++; assert.ok(o.injuries.some((i) => i.part === (o.lost[0] === 'armS' ? 'arm' : 'leg') && R.isSerious(i))); }
      else if (o.lost?.includes('armO')) { armO++; assert.ok(o.injuries.some((i) => i.part === 'arm' && R.isSerious(i))); }
    }
  }
  const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(4)} (기대 ${want.toFixed(4)})`);
  near(out / n, q.winSever.out, 0.012, '이탈');
  near(armO / n, q.winSever.armO, 0.012, '빈손 팔');
  const r = R.quickResolve({ a: [f('a0', { lost: ['armO'] })], b: [f('b0', { hp: 1 })] }, 3);
  if (r.winner === 'a' && r.fighters.a0.alive) assert.ok(r.fighters.a0.lost === undefined || r.fighters.a0.lost.includes('armO'));
});

test('쉼 물건 (11/21 E — 사장님 \'한 캐릭터가 쉴 때마다 … 응급처치약이나 무기상자 하나를 주자.\'): 쉰 사람마다 하나 · 내 팀은 결과 화면에서 고름(안 고르면 다음 경기 전 응급처치약) · 응급처치약 = 부상 한 단계 · 무기상자 = 이번 대회 무기', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  assert.deepEqual(SAENGSA.items, { boxStock: 9 });
  const owned = ['longsword', 'rapier', 'uchigatana'];
  const t = R.createTournament({ day: '2026-10-30', seed: 61, at: at(29, 23), companions: ['a', 'b'], ...DATA, drawWeapon: roster.drawWeapon, drawPool: roster.drawPool, weaponInfo: roster.weaponInfo, owned });
  const again = R.createTournament({ day: '2026-10-30', seed: 61, at: at(29, 23), companions: ['a', 'b'], ...DATA, drawWeapon: roster.drawWeapon, drawPool: roster.drawPool, weaponInfo: roster.weaponInfo, owned });
  assert.deepEqual(t.teams.map((x) => x.boxes), again.teams.map((x) => x.boxes), '같은 씨앗 = 같은 상자 더미');
  for (const team of t.teams) {
    assert.equal(team.boxes.length, 9);
    assert.deepEqual(team.items, { aid: 0 });
    const have = team.mine ? owned : team.pool.map((w) => w.weapon);
    assert.ok(team.boxes.every((w) => !have.includes(w.weapon) && w.school && w.tier), '팀이 가진 무기는 빼고 뽑음');
  }
  R.assignWeapons(t, owned, { owned, weaponInfo: roster.weaponInfo });
  R.advance(t, at(30, 10));
  const team = t.teams[0];
  // ① 나 + 0-1 이 나서 이김 → 0-2 만 쉼 → 0-2 몫 하나 (나선 사람 몫 없음)
  const m0 = R.myMatch(t);
  const r0 = R.finishMine(t, m0, ['0-0', '0-1'], at(30, 10, 5), winFor(t, m0, { '0-0': { hp: 60, injuries: [{ part: 'leg', sev: 0.7, rests: 0 }, { part: 'arm', sev: 0.3, rests: 0 }], alive: true }, '0-1': { hp: 50, injuries: [], alive: true } }));
  assert.deepEqual(r0.gift, { '0-2': null });
  assert.equal(R.takeGift(t, m0, '0-0', 'aid'), null, '나선 사람 몫은 없음');
  assert.deepEqual(R.takeGift(t, m0, '0-2', 'box'), { kind: 'box', weapon: team.pool[0].weapon });
  assert.equal(R.takeGift(t, m0, '0-2', 'aid'), null, '한 번만');
  const boxW = team.pool[0].weapon;
  assert.deepEqual(R.teamWeapons(t, owned), [...owned, boxW], '경기마다 배정에서 고를 수 있음 (가진 무기에는 안 더함)');
  assert.equal(R.assignWeapons(t, [boxW, 'rapier', 'uchigatana'], { owned: R.teamWeapons(t, owned), weaponInfo: roster.weaponInfo }), true);
  assert.equal(team.members[0].weapon, boxW);
  assert.equal(owned.length, 3);
  // ② 다음 경기: 0-2 만 나섬 → 나 · 0-1 쉼 → 몫 둘 · 하나만 고르고 다음 경기를 하면 남은 하나는 응급처치약
  R.advance(t, at(30, 10, 5));
  const m1 = R.myMatch(t);
  const r1 = R.finishMine(t, m1, ['0-2'], at(30, 10, 6), winFor(t, m1, { '0-2': { hp: 70, injuries: [{ part: 'torso', sev: 0.6, rests: 0 }], alive: true } }));
  assert.deepEqual(Object.keys(r1.gift).sort(), ['0-0', '0-1']);
  assert.deepEqual(R.takeGift(t, m1, '0-0', 'aid'), { kind: 'aid' });
  assert.equal(R.aidCount(team), 1);
  // 응급처치약: 나선 사람(0-2 몸통 중상)에게 · 한 단계 · 체력 그대로 · 흔적 · 없는 부위 · 죽은 사람은 안 됨
  assert.equal(R.useAid(team, '0-2', 'leg'), null, '그 부위 부상 없음');
  assert.deepEqual(R.useAid(team, '0-2', 'torso'), { part: 'torso', from: 'serious' });
  assert.deepEqual([team.members[2].hp, team.members[2].injuries.map((i) => i.sev), R.aidCount(team)], [70, [0.49], 0]);
  assert.equal(R.useAid(team, '0-2', 'torso'), null, '약이 없음');
  R.advance(t, at(30, 10, 6));
  const m2 = R.myMatch(t);
  R.finishMine(t, m2, ['0-2'], at(30, 10, 7), winFor(t, m2, { '0-2': { hp: 60, injuries: [], alive: true } }));
  assert.deepEqual(m1.result.gift, { '0-0': { kind: 'aid' }, '0-1': { kind: 'aid' } }, '안 고른 몫은 다음 경기 전 응급처치약');
  assert.equal(R.aidCount(team), 1);
  team.members[0].injuries = [{ part: 'arm', sev: 0.3, rests: 0 }, { part: 'head', sev: 0.09, rests: 0 }];
  assert.equal(R.useAid(team, '0-0', 'head'), null, '나은 흔적은 부상이 아님');
  assert.deepEqual(R.useAid(team, '0-0', 'arm'), { part: 'arm', from: 'light' });
  assert.deepEqual(team.members[0].injuries.map((i) => i.sev), [0.09, 0.09]);
  // 결승 뒤에는 쉼 · 물건 없음
  R.advance(t, at(30, 10, 7));
  const m3 = R.myMatch(t);
  assert.equal(m3.round, 3);
  const r3 = R.finishMine(t, m3, ['0-2'], at(30, 10, 8), winFor(t, m3, { '0-2': { hp: 50, injuries: [], alive: true } }));
  assert.deepEqual([r3.rest, r3.gift], [undefined, undefined]);
});

test('쉼 물건 — AI 팀 (11/21 E · F 사장님 \'ai도 상황에 따라 무기상자나 응급처치약을 고르게 해.\'): 두 물건의 기대 이득(다음 경기에 나설 사람의 빠른 셈 힘 합)을 견줘 큰 쪽 · 같으면 응급처치약 · 상자는 남은 더미의 평균(다음 상자를 보지 않음) · 상자 무기는 무기 묶음에 더해 다시 나눠 줌 · 약은 힘이 가장 오르는 부상부터', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const f = (key, extra = {}) => ({ key, id: key, weapon: 'longsword', school: 'german', tier: 'common', prof: { german: 3, italian: 0, iberian: 0, japanese: 0, chinese: 0 }, hp: 100, injuries: [], dead: false, ...extra });
  const W = (weapon, school, tier = 'common') => ({ weapon, school, tier });
  const mk = (members, pool, boxes) => ({ mine: false, members, pool, boxes, items: { aid: 0 } });
  // ① 다들 성하고 제 유파 칼 · 더미가 같은 무기 = 둘 다 이득 0 → 응급처치약
  const eq = mk([f('1-0'), f('1-1'), f('1-2')], [W('longsword', 'german'), W('w2', 'german'), W('w3', 'german')], [W('w4', 'german')]);
  R.aiArm(eq);
  assert.equal(R.aiGift(eq), 'aid', '같으면 응급처치약');
  // ② 셋 모두 제 유파가 아닌 칼(이탈리아 숙련도 0)만 가진 묶음 · 더미에 독일 칼 → 무기상자
  const off = mk([f('1-0'), f('1-1'), f('1-2')], [W('r1', 'italian'), W('r2', 'italian'), W('r3', 'italian')], [W('g1', 'german'), W('g2', 'german', 'rare')]);
  R.aiArm(off);
  assert.equal(R.aiGift(off), 'box');
  // ③ 같은 팀이라도 한 사람이 중상 셋이면? — 약 이득(중상 → 경상 한 번: × 0.85 → 0.95)과 상자 이득을 견줌: 상자 더미가 다 같은 이탈리아 칼이면 약
  const hurt = mk([f('1-0', { injuries: [{ part: 'torso', sev: 0.8, rests: 0 }] }), f('1-1'), f('1-2')], [W('l1', 'german'), W('l2', 'german'), W('l3', 'german')], [W('r9', 'italian'), W('r8', 'italian')]);
  R.aiArm(hurt);
  assert.equal(R.aiGift(hurt), 'aid', '상자가 쓸모없으면 약');
  // ④ 부러진 무기 하나 · 더미에 성한 같은 유파 칼 → 상자가 약보다 큼 (부러짐 × 0.7)
  const broken = mk([f('1-0', { injuries: [{ part: 'arm', sev: 0.3, rests: 0 }] }), f('1-1'), f('1-2')], [W('l1', 'german'), W('l2', 'german'), { ...W('l3', 'german'), broken: true }], [W('g5', 'german'), W('g6', 'german')]);
  R.aiArm(broken);
  assert.ok(broken.members.some((x) => x.broken));
  assert.equal(R.aiGift(broken), 'box');
  // ⑤ 더미가 없으면 응급처치약 · 다음 상자만 좋아도 평균이 낮으면 약 (다음 상자를 보지 않음)
  assert.equal(R.aiGift({ ...structuredClone(off), boxes: [] }), 'aid');
  const peek = mk([f('1-0', { injuries: [{ part: 'leg', sev: 0.7, rests: 0 }] }), f('1-1', { injuries: [{ part: 'torso', sev: 0.7, rests: 0 }] }), f('1-2')], [W('l1', 'german'), W('l2', 'german'), W('r1', 'italian')], [W('g9', 'german', 'legend'), ...Array.from({ length: 8 }, (_, i) => W(`x${i}`, 'chinese'))]);
  R.aiArm(peek);
  const one = R.aiGift({ ...structuredClone(peek), boxes: [peek.boxes[0]] }), avg = R.aiGift(peek);
  assert.deepEqual([one, avg], ['box', 'aid'], '첫 상자가 레전드여도 더미 평균으로 고름');
  // 약 쓰기: 중상(× 0.85) 을 경상(× 0.95)으로 · 경상을 흔적으로 — 더 오르는 쪽부터
  const team = mk([f('1-0'), f('1-1'), f('1-2')], [], [], {});
  team.items.aid = 2;
  team.members[0].injuries = [{ part: 'leg', sev: 0.3, rests: 0 }];
  team.members[1].injuries = [{ part: 'torso', sev: 0.8, rests: 0 }];
  R.aiUseAids(team);
  assert.deepEqual([team.members[0].injuries[0].sev, team.members[1].injuries[0].sev, team.items.aid], [0.09, 0.49, 0]);
  // 상대끼리 경기에서 받고 씀: 대회를 끝까지 — 상대 팀 결과에 물건이 적히고 · 상자 무기는 그 팀 묶음에 · 약 수는 0 이상
  let gifts = 0, boxes = 0;
  for (const seed of [71, 72, 73]) {
    const t = R.createTournament({ day: '2026-10-30', seed, at: at(29, 23), companions: ['a', 'b'], ...DATA, drawWeapon: roster.drawWeapon, drawPool: roster.drawPool, weaponInfo: roster.weaponInfo, owned: ['longsword'] });
    R.advance(t, Infinity);
    for (const m of t.matches) for (const [k, g] of Object.entries(m.result?.gift ?? {})) {
      if (k.startsWith('0-')) continue;
      gifts++;
      assert.ok(g && (g.kind === 'aid' || (g.kind === 'box' && typeof g.weapon === 'string')), `${m.id} ${k}`);
      if (g.kind === 'box') { boxes++; const tm = t.teams[+k.split('-')[0]]; assert.ok(tm.pool.some((w) => w.weapon === g.weapon), '상자 무기가 묶음에'); }
      assert.ok(m.result.rest[k], '쉰 사람만');
    }
    for (const tm of t.teams) assert.ok(R.aidCount(tm) >= 0);
  }
  assert.ok(gifts > 10 && boxes > 0, `상대 팀 물건 ${gifts} · 상자 ${boxes}`);
});
