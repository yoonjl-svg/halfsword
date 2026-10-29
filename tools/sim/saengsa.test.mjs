// 생사전 1단계 (사장님 10/29 14:1x · 14:2x · 14:5x — docs/design/saengsa_2026-10-29.md): 시계(신청 창 · 첫 대진 · 쉬는 시간) · 대진표 만들기 · 저절로 끝내기 · 기권 ·
//  빠른 셈 고정 · 부상 회복(경상 2번 쉬면 · 중상 그대로) · 하사품 · 저장 왕복. 시각은 모두 현지 시각으로 만든다(new Date(y, m, d, h, mi)) — 기기 시간대와 무관
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { SAENGSA } = await import('../../src/config.js');
const C = await import('../../src/saengsa_clock.js');
const R = await import('../../src/saengsa_rules.js');
const S = await import('../../src/saengsa_store.js');
const P = await import('../../src/lobby_progress.js');

const at = (d, h, mi = 0) => new Date(2026, 9, d, h, mi).getTime(); // 2026-10-d h:mi (현지)
const ROSTER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
const PROF = { german: 2, italian: 1, iberian: 1, japanese: 0, chinese: 0, none: 1 };
const DATA = { roster: ROSTER, drawWeapon: (r) => ['w1', 'w2', 'w3'][Math.floor(r() * 3)], weaponInfo: () => ({ school: 'german', tier: 'common' }), profOf: () => ({ ...PROF }) };
const make = (seed = 7, extra = {}) => R.createTournament({ day: '2026-10-30', seed, at: at(29, 23), companions: ['a', 'b'], ...DATA, ...extra });
/** 내 경기를 이 쪽이 이긴 결과로 (체력 · 부상은 넘긴 대로) */
const winFor = (t, m, fighters = {}) => ({ winner: R.sidesOf(t, m)[0] === 0 ? 'a' : 'b', fighters });

test('시계: 신청 창은 밤 10시 ~ 새벽 2시(자정을 넘김) · 첫 대진 10시 · 대진 2시간마다', () => {
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
  const t = make(11, { lend: { weapon: 'tree_branch', to: 1 } });
  assert.equal(t.teams.length, SAENGSA.teams);
  assert.equal(t.matches.length, SAENGSA.teams - 1);
  assert.deepEqual(t.teams[0].members.map((f) => f.id), ['player', 'a', 'b']);
  assert.equal(t.teams[0].members[1].weapon, 'tree_branch');
  assert.equal(t.teams[0].members[1].lent, true);
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
  assert.deepEqual(make(11, { lend: { weapon: 'tree_branch', to: 1 } }), t);
  assert.notDeepEqual(make(12), t);
});

test('저절로 끝내기: 10시 전엔 없음 · 10시에 상대끼리 7 경기 · 내 경기는 기다림(입장 가능)', () => {
  const t = make();
  assert.equal(R.advance(t, at(30, 9, 59)), 0);
  assert.equal(R.advance(t, at(30, 10)), 7);
  const m = R.myMatch(t);
  assert.equal(m.round, 0);
  assert.equal(R.matchState(t, m, at(30, 10)), 'ready');
  assert.ok(t.matches.filter((x) => x.result).every((x) => x.result.at === at(30, 10) && x.result.by === 'quick' && Number.isInteger(x.result.seed) && x.result.ver && x.result.pre.a.length === 3));
  assert.equal(R.advance(t, at(30, 12)), 3); // 8강 가운데 상대끼리 셋 (내 쪽 하나는 내 결과를 기다림)
});

test('쉬는 시간: 늦게 저장한 결과에서 2시간 · 그 전엔 다음 경기 못 함', () => {
  const t = make();
  R.advance(t, at(30, 11, 30));
  const m0 = R.myMatch(t), picks = ['0-0', '0-1'];
  assert.ok(R.finishMine(t, m0, picks, at(30, 11, 30), winFor(t, m0)));
  R.advance(t, at(30, 13));
  const m1 = R.myMatch(t);
  assert.equal(m1.round, 1);
  assert.equal(R.readyAt(t, m1), at(30, 13, 30));
  assert.equal(R.matchState(t, m1, at(30, 13)), 'soon');
  assert.equal(R.matchSetup(t, m1, picks, at(30, 13)), null);
  assert.equal(R.matchState(t, m1, at(30, 13, 30)), 'ready');
  const setup = R.matchSetup(t, m1, picks, at(30, 13, 30));
  assert.equal(setup.control, 'player');
  assert.ok(setup.entrants[setup.mineSide === 'a' ? 'b' : 'a'].length >= 1);
  assert.equal(R.matchSetup(t, m1, ['0-1'], at(30, 13, 30)).control, 'watch');
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

test('부상: 경상은 두 번 쉬면 낫고 중상은 대회 동안 그대로 · 쉬면 체력이 조금 찬다', () => {
  const t = make();
  R.advance(t, at(30, 10));
  const m0 = R.myMatch(t);
  const light = { part: 'arm', sev: SAENGSA.seriousAt - 0.1, rests: 0 }, serious = { part: 'leg', sev: SAENGSA.seriousAt, rests: 0 };
  R.finishMine(t, m0, ['0-0'], at(30, 10, 5), winFor(t, m0, { '0-0': { hp: 20, injuries: [light, serious], alive: true } }));
  const me = () => t.teams[0].members[0];
  assert.equal(me().hp, 20 + SAENGSA.restHeal);
  assert.deepEqual(me().injuries.map((i) => [i.part, i.rests]), [['arm', 1], ['leg', 0]]);
  R.advance(t, at(30, 12, 5));
  const m1 = R.myMatch(t);
  R.finishMine(t, m1, ['0-1'], at(30, 12, 5), winFor(t, m1));
  assert.deepEqual(me().injuries.map((i) => i.part), ['leg']); // 경기 k 의 경상은 k + 2 전에 없음
  assert.equal(me().hp, Math.min(SAENGSA.hpMax, 20 + 2 * SAENGSA.restHeal));
  assert.deepEqual(R.injuriesFromWounds([], [{ part: 'uarmS', severity: 0.05 }, { part: 'neck', severity: 0.7 }]), [{ part: 'head', sev: 0.7, rests: 0 }]);
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

test('저장 왕복 · 신청(고용 금화) · 깨진 저장은 버림', () => {
  mem.clear();
  const t = make(5);
  assert.equal(S.updateSaengsa((d) => { d.current = t; return true; }).saved, true);
  assert.deepEqual(S.readSaengsa().current, t);
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, current: { ...t, teams: t.teams.slice(0, 3) } }));
  assert.equal(S.readSaengsa().current, null);
  mem.clear();
  P.setCoins(30);
  const data = { ...DATA, owned: ['tree_branch'], hireCostOf: () => ({ coins: 20 }) };
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], seed: 1, data }).why, 'coins');
  P.setCoins(100);
  assert.equal(S.signUp({ now: at(29, 21), companions: ['a', 'b'], seed: 1, data }).why, 'closed');
  const ok = S.signUp({ now: at(29, 23), companions: ['a', 'b'], lend: { weapon: 'tree_branch', to: 0 }, seed: 1, data });
  assert.deepEqual([ok.ok, ok.cost, P.readProgress().coins], [true, 40, 60]);
  assert.equal(S.readSaengsa().current.teams[0].members[0].weapon, 'tree_branch');
  assert.equal(S.signUp({ now: at(29, 23, 30), companions: ['a', 'b'], seed: 2, data }).why, 'busy');
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1 })); // 빈 저장 (저장소 열쇠가 없으면 이번 실행 값을 쥐고 있으니 빈 판을 적는다)
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'a'], seed: 3, data }).why, 'team');
  assert.equal(S.signUp({ now: at(29, 23), companions: [R.NAMELESS, R.NAMELESS], seed: 3, data }).ok, true); // 무명 검객은 둘 다여도 됨
});

test('로스터 · 숙련도(인물 성향 표) · 고용 값 · 무명 검객', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const { PROFICIENCY } = await import('../../src/character_temperament.js');
  assert.equal(roster.SAENGSA_ROSTER.length, 11);
  assert.ok(!roster.SAENGSA_ROSTER.includes('artoria'));
  assert.deepEqual(roster.HIRE_ROSTER.slice(-1), [R.NAMELESS]);
  for (const id of roster.SAENGSA_ROSTER) {
    const p = roster.profOf(id), c = CHARACTERS_BY_ID[id];
    for (const s of R.SCHOOLS5) assert.equal(p[s], PROFICIENCY[id][s], `${id} ${s}`);
    assert.equal('none' in p, 'none' in PROFICIENCY[id], id); // 무유파 칸은 무유파가 주 유파인 인물만
    assert.equal(p[roster.weaponInfo(c.weapon).school], c.ai.proficiency, id);
    assert.equal(roster.hireCostOf(id).coins, SAENGSA.hire.base + SAENGSA.hire.step * Math.max(...Object.values(p)));
  }
  assert.deepEqual(roster.profOf(R.NAMELESS), { german: 1, italian: 1, iberian: 1, japanese: 1, chinese: 1 });
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
