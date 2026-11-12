// 생사전 바로 시작 (사장님 11/12 '그리고 생사전 플레이어가 참여하면 바로 시작되도록 바꿔. 대신 특정 시간에만 열리게. 밤 10시부터 새벽 2시 사이.'
//  — 설계 docs/design/saengsa_instant_2026-11-12.md): 열리는 때(밤 10시 ~ 새벽 2시 · 기기 현지 시각) · 그 밖엔 새로 못 들어감(다음 열림을 보임) ·
//  들어가면 곧장 첫 경기 · 경기 사이 기다림 없음 · 새벽 2시를 넘겨도 시작한 대회는 이어 함(기권 마감 = 다음 열림 그대로) · 한 열림에 대회 하나 · 저장 · 다시 열기.
//  시각은 모두 현지 시각으로 만든다(new Date(y, m, d, h, mi)) — 기기 시간대와 무관
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { SAENGSA } = await import('../../src/config.js');
const C = await import('../../src/saengsa_clock.js');
const R = await import('../../src/saengsa_rules.js');
const S = await import('../../src/saengsa_store.js');
const P = await import('../../src/lobby_progress.js');
const TX = await import('../../src/saengsa_text.js');

const at = (d, h, mi = 0) => new Date(2026, 10, d, h, mi).getTime(); // 2026-11-d h:mi (현지)
const ROSTER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
const PROF = { german: 2, italian: 1, iberian: 1, japanese: 0, chinese: 0, none: 1 };
const OWNED = ['w1', 'w2', 'w3', 'w4', 'w5'];
const DATA = { roster: ROSTER, drawWeapon: (r) => ['w1', 'w2', 'w3'][Math.floor(r() * 3)], weaponInfo: () => ({ school: 'german', tier: 'common' }), profOf: () => ({ ...PROF }),
  owned: OWNED, hasTitle: true, hireCostOf: () => ({ coins: 20 }) };
const join = (now, seed = 1) => S.signUp({ now, companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], seed, data: DATA });
const fresh = () => { mem.clear(); mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1 })); P.setCoins(1000); }; // 빈 저장 (열쇠가 없으면 저장 모듈이 이번 실행 값을 쥐고 있음)
/** 내 경기를 내 팀이 이긴 엔진 결과 (체력 · 부상 그대로) */
const winMine = (t, m) => ({ winner: R.sidesOf(t, m)[0] === 0 ? 'a' : 'b', fighters: {} });
const cur = () => S.readSaengsa().current;

test('값: 바로 시작 켬 · 열리는 때 밤 10시 ~ 새벽 2시 (신청 창 그대로)', () => {
  assert.equal(SAENGSA.instant, true);
  assert.deepEqual([SAENGSA.signupFrom, SAENGSA.signupTo], [22, 2]);
  assert.equal(R.noWait(), true);
  assert.equal(R.noWait({ ...SAENGSA, instant: false }), false);
  assert.equal(R.noWait({ ...SAENGSA, instant: false, testMode: true }), true, '시험판은 늘');
});

test('열리는 때: 밤 10시 ~ 새벽 2시만 새로 들어감 · 그 밖엔 닫힘과 다음 열림', () => {
  fresh();
  for (const [now, open] of [[at(12, 21, 59), false], [at(12, 22), true], [at(12, 23, 30), true], [at(13, 1, 59), true], [at(13, 2), false], [at(13, 3), false], [at(13, 15), false]]) {
    assert.equal(C.signupWindow(now).open, open, new Date(now).toString());
    assert.equal(R.canSignUp(now, null), open);
  }
  // 닫힘: 일정 알약 '다음 신청 · 밤 10시' · 안내 '신청은 밤 10시부터 새벽 2시까지입니다.'
  for (const now of [at(12, 21, 59), at(13, 3), at(13, 15)]) {
    const s = R.scheduleState(now, null), w = C.signupWindow(now);
    assert.equal(s.kind, 'closed');
    assert.equal(s.opensAt, now < at(12, 22) ? at(12, 22) : at(13, 22));
    assert.equal(TX.stateLine(s), '다음 신청 · 밤 10시');
    assert.equal(TX.signupHours(w.from, w.to), '신청은 밤 10시부터 새벽 2시까지입니다.');
  }
  assert.equal(join(at(13, 3)).why, 'closed');
  assert.equal(join(at(12, 21, 59)).why, 'closed');
  assert.equal(P.readProgress().coins, 1000, '닫힌 때엔 고용 금화를 내지 않음');
  assert.equal(cur(), null);
  assert.deepEqual(R.scheduleState(at(12, 23), null), { kind: 'signup', until: at(13, 2), day: '2026-11-13' });
  assert.equal(TX.stateLine(R.scheduleState(at(12, 23), null)), '신청 받는 중 · 새벽 2시까지');
});

test('들어가면 곧장 시작: 신청한 때 첫 경기 입장 가능 · 상대끼리 16강 일곱은 그때 끝남', () => {
  fresh();
  const now = at(12, 22, 30);
  assert.equal(join(now).ok, true);
  const t = S.syncSaengsa(now).current, m = R.myMatch(t);
  assert.equal(t.day, '2026-11-13');
  assert.deepEqual(R.scheduleState(now, t), { kind: 'running' });
  assert.equal(TX.stateLine(R.scheduleState(now, t)), '대회 진행 중');
  assert.equal(m.round, 0);
  assert.equal(R.matchState(t, m, now), 'ready');
  assert.ok(R.matchSetup(t, m, ['0-0', '0-1'], now), '신청한 그 때 싸울 수 있음');
  const done = t.matches.filter((x) => x.result);
  assert.equal(done.length, 7);
  assert.ok(done.every((x) => x.round === 0 && x.result.at === now && x.result.by === 'quick'));
  assert.equal(TX.nextMatchLine('16강', R.readyAt(t, m), 'ready', now), '내 경기 · 16강 · 지금 싸울 수 있습니다.');
  assert.equal(TX.SAENGSA_TEXT.willSignNow, '입장하면 이 팀으로 첫 경기가 시작됩니다.');
});

test('이어지는 경기 기다림 없음: 결과를 적으면 다음 경기가 곧바로 · 결승까지 · 상대끼리는 앞 대진이 끝나면 바로', () => {
  fresh();
  let now = at(12, 23);
  join(now);
  for (let r = 0; r < 4; r++) {
    const t = S.syncSaengsa(now).current, m = R.myMatch(t);
    assert.equal(m.round, r);
    assert.equal(R.matchState(t, m, now), 'ready', `대진 ${r} 곧바로`);
    assert.equal(t.matches.filter((x) => x.round === r && !x.result).length, 1, `대진 ${r} — 내 경기만 남음`);
    assert.ok(S.playMine(m.id, ['0-0'], now, winMine(t, m)), `대진 ${r} 결과`);
    now += 60e3; // 1 분 뒤 (쉬는 시간 없음)
  }
  const t = S.syncSaengsa(now).current;
  assert.deepEqual([t.status, R.placeOf(t), R.chestCount(t)], ['done', 'champion', 3]);
  assert.ok(t.endedAt < at(12, 23, 5), '네 경기를 5 분 안에');
  // 지면: 남은 경기는 곧바로 끝까지 (내 경기를 기다릴 것이 없음)
  fresh();
  join(at(12, 23), 9);
  const u = S.syncSaengsa(at(12, 23)).current, m = R.myMatch(u), w = winMine(u, m);
  S.playMine(m.id, ['0-0'], at(12, 23, 1), { ...w, winner: w.winner === 'a' ? 'b' : 'a' });
  const v = S.syncSaengsa(at(12, 23, 1)).current;
  assert.deepEqual([v.status, R.myTeamOut(v), R.placeOf(v)], ['done', true, 'first']);
});

test('한 열림에 대회 하나: 오늘 밤 대회를 마치면 다음 날 밤 10시까지 닫힘 · 다음 열림에 새로', () => {
  fresh();
  let now = at(12, 22, 10);
  join(now);
  for (let r = 0; r < 4; r++) { const t = S.syncSaengsa(now).current, m = R.myMatch(t); S.playMine(m.id, ['0-0'], now, winMine(t, m)); now += 60e3; }
  const t = cur();
  assert.equal(t.status, 'done');
  assert.equal(C.signupWindow(now).open, true, '아직 열린 때');
  assert.equal(R.canSignUp(now, t), false, '같은 열림에 둘째 대회 없음 (그대로)');
  const s = R.scheduleState(now, t);
  assert.deepEqual(s, { kind: 'done', opensAt: at(13, 22) });
  assert.equal(TX.stateLine(s), '다음 신청 · 밤 10시', "전 '대회 끝' — 다음 열림을 보임");
  assert.equal(join(now, 2).why, 'busy');
  assert.equal(R.canSignUp(at(13, 21, 59), t), false);
  assert.equal(R.canSignUp(at(13, 22), t), true);
  assert.equal(join(at(13, 22), 3).ok, true);
  assert.equal(cur().day, '2026-11-14');
  assert.equal(P.readProgress().coins, 1000 - 40 + 1500 - 40, '지난 대회 하사품은 새 신청 때 열림 (그대로)');
});

test('새벽 2시를 넘기면: 새로 들어가기만 막힘 · 시작한 대회는 이어 함 · 기권 마감은 다음 열림(밤 10시) 그대로', () => {
  fresh();
  assert.equal(join(at(13, 1, 50)).ok, true);
  let t = S.syncSaengsa(at(13, 1, 55)).current;
  const m0 = R.myMatch(t);
  assert.ok(S.playMine(m0.id, ['0-0'], at(13, 1, 55), winMine(t, m0)));
  const late = at(13, 2, 30);
  t = S.syncSaengsa(late).current;
  assert.equal(C.signupWindow(late).open, false);
  assert.equal(R.canSignUp(late, t), false);
  assert.deepEqual(R.scheduleState(late, t), { kind: 'running' }, '2시 뒤에도 진행 중');
  const m1 = R.myMatch(t);
  assert.equal(m1.round, 1);
  assert.equal(R.matchState(t, m1, late), 'ready');
  assert.ok(S.playMine(m1.id, ['0-0'], at(13, 3), winMine(t, m1)), '새벽 3시에 이어 싸움');
  t = S.syncSaengsa(at(13, 21, 59)).current;
  const m2 = R.myMatch(t);
  assert.equal(R.matchState(t, m2, at(13, 21, 59)), 'ready', '다음 열림 직전까지');
  t = S.syncSaengsa(at(13, 22)).current; // 다음 열림 = 마감 — 하지 않은 내 경기는 기권 (사장님 10/29 14:5x 규칙 그대로)
  const lost = t.matches.find((x) => x.result?.by === 'forfeit');
  assert.deepEqual([lost.id, lost.result.at, R.myTeamOut(t), t.status], [m2.id, at(13, 22), true, 'done']);
  assert.equal(R.canSignUp(at(13, 22), t), true, '다음 열림에 새로 들어감');
});

test('이어하기: 새로고침 · 앱 다시 열기(같은 저장 · 새 모듈)에서 진행 중인 대회 · 싸우던 몸 그대로 · 2시 뒤에도', async () => {
  fresh();
  join(at(12, 23, 40));
  let t = S.syncSaengsa(at(12, 23, 45)).current;
  const m0 = R.myMatch(t);
  S.playMine(m0.id, ['0-0', '0-1'], at(12, 23, 45), winMine(t, m0));
  const m1 = R.myMatch(S.syncSaengsa(at(12, 23, 50)).current);
  const bodies = { '0-0': { v: 1, blood: 0.7, wounds: [] }, '0-1': { v: 1, blood: 0.9, wounds: [] }, x: { v: 1, blood: 1, wounds: [] }, y: { v: 1, blood: 0.4, wounds: [] } };
  assert.equal(S.saveResume(m1.id, { picks: ['0-0', '0-1'], arms: ['w1', 'w2', 'w3'], bodies, at: at(12, 23, 52) }), true); // 싸우다 정지 창 '대기실' · 앱을 닫음
  const saved = mem.get(S.SAENGSA_KEY);
  const S2 = await import('../../src/saengsa_store.js?reopen'); // 다시 연 앱 — 메모리 값 없이 저장만
  for (const now of [at(12, 23, 55), at(13, 2, 40)]) {
    const t2 = S2.syncSaengsa(now).current;
    assert.equal(R.myMatch(t2).id, m1.id);
    assert.equal(R.matchState(t2, R.myMatch(t2), now), 'ready');
    assert.deepEqual(R.resumeOf(t2, m1.id).bodies, bodies, '싸우던 넷의 몸');
    assert.deepEqual(R.scheduleState(now, t2), { kind: 'running' });
  }
  assert.deepEqual(JSON.parse(mem.get(S.SAENGSA_KEY)).current.matches, JSON.parse(saved).current.matches, '다시 열기만으로는 결과가 바뀌지 않음');
  t = S2.readSaengsa().current;
  assert.ok(S2.playMine(m1.id, ['0-0', '0-1'], at(13, 2, 45), winMine(t, R.matchById(t, m1.id))), '2시 뒤 다시 연 앱에서 이어 싸워 결과');
  assert.equal(S.readSaengsa().current.resume, undefined);
  assert.equal(R.myMatch(S.readSaengsa().current).round, 2);
});

test('옛 규칙 스위치(instant false): 신청 뒤 아침 10시 첫 대진까지 기다림 · 결과 뒤 2시간 — 그대로 돈다', () => {
  const OLD = { ...SAENGSA, instant: false };
  fresh();
  assert.equal(S.signUp({ now: at(12, 22, 30), companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], seed: 1, data: DATA, cfg: OLD }).ok, true);
  const t = S.syncSaengsa(at(12, 22, 30), { cfg: OLD }).current;
  assert.deepEqual(R.scheduleState(at(12, 22, 30), t, OLD), { kind: 'waiting', startAt: at(13, 10) });
  assert.equal(TX.stateLine(R.scheduleState(at(12, 22, 30), t, OLD)), '첫 대진 아침 10시');
  assert.equal(R.matchState(t, R.myMatch(t), at(12, 22, 30), OLD), 'soon');
  assert.equal(t.matches.filter((x) => x.result).length, 0);
  const u = S.syncSaengsa(at(13, 10), { cfg: OLD }).current, m = R.myMatch(u);
  assert.equal(R.matchState(u, m, at(13, 10), OLD), 'ready');
  S.playMine(m.id, ['0-0'], at(13, 10, 30), winMine(u, m), { cfg: OLD });
  const v = S.syncSaengsa(at(13, 12, 0), { cfg: OLD }).current;
  assert.equal(R.readyAt(v, R.myMatch(v), OLD), at(13, 12, 30));
});
