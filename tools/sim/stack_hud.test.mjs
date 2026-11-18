// 스택 칸 시험 (사장님 11/18 '스택을 표시하는 위치를 따로 만들고 머리 위에선 빼버려. 좌측 중상단이나 좌측 중단에 작게?' — src/stack_hud.js · 기록 docs/strike/saengsa_ui_2026-11-18.md §3):
//  줄 = 스택이 하나라도 > 0 인 산 몸 · 나 먼저 → 내 편 → 상대 · 갈래 = 기세(일본 J10 · 상한 10) · 사냥(동방 C12 · 상한 5) · 0 인 갈래는 없음 · 짧은 이름.
//  머리 위 스택 표시(기력 막대 밑 칸 · 위 발톱 자국)가 없어졌는지도 본다.  node --test tools/sim/stack_hud.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JP_TANK, UNIQUE_ASSIST as UA } from '../../src/config.js';
import { STACK_KINDS, stackRows, rowName } from '../../src/stack_hud.js';

/** 가짜 몸: 기세(stackShow — null = 스택 판 아님) · 사냥 겹 n (쌓인 때 = 지금 — 사라지지 않음) */
const body = ({ index = 0, team = index % 2, name = `검객 ${index}`, short, ki = null, hunt = 0, alive = true } = {}) => ({
  index, team, name, ...(short ? { shortName: short } : {}), alive, fightT: 3,
  schoolPassive: { stackShow: ki },
  ...(hunt ? { cnHunt: { n: hunt, hits: hunt, last: new Map(), t5: null, ts: Array(hunt).fill(3) } } : {}),
});

test('갈래 — 게임 속 이름 기세 · 사냥 · 상한 = 그 스택 상한', () => {
  assert.deepEqual(STACK_KINDS.map((k) => [k.key, k.label, k.max()]), [['ki', '기세', JP_TANK.max], ['hunt', '사냥', UA.cnHunt.max]]);
  assert.deepEqual([JP_TANK.max, UA.cnHunt.max], [10, 5]);
});

test('줄 — 스택이 > 0 인 산 몸만 · 0 인 갈래는 뺌 · 나 먼저 → 내 편 → 상대 (자리 차례)', () => {
  const me = body({ index: 0, team: 0, short: '나', ki: 6 });
  const foe1 = body({ index: 1, team: 1, short: '랴오', hunt: 2 });
  const mate = body({ index: 2, team: 0, short: '오토', ki: 0, hunt: 3 });
  const foe2 = body({ index: 3, team: 1, short: 'A.미나미', ki: 10, hunt: 5 });
  const none = body({ index: 4, team: 1, short: '빈몸', ki: 0 });
  const dead = body({ index: 5, team: 1, short: '죽음', ki: 4, alive: false });
  const rows = stackRows([foe2, none, foe1, dead, mate, me], me);
  assert.deepEqual(rows.map((r) => r.name), ['나', '오토', '랴오', 'A.미나미']);
  assert.deepEqual(rows.map((r) => r.stacks.map((s) => `${s.label}${s.n}/${s.max}`).join(' ')), ['기세6/10', '사냥3/5', '사냥2/5', '기세10/10 사냥5/5']);
  assert.deepEqual(stackRows([none, dead], me), [], '줄이 없으면 판을 숨김');
  // 1:1 (편 칸 0 · 1) · 내 몸에 사냥 겹이 쌓이고 상대 일본이 기세를 쌓음 — 나 먼저
  const p = body({ index: 0, team: 0, short: '나', hunt: 1 });
  const e = body({ index: 1, team: 1, short: '미나미', ki: 3 });
  assert.deepEqual(stackRows([e, p], p).map((r) => r.name), ['나', '미나미']);
  // 지켜보기(내 몸 없음): 0 편 먼저
  assert.deepEqual(stackRows([foe1, mate], null).map((r) => r.name), ['오토', '랴오']);
});

test('줄 — 상한 밖 · 소수 값은 칸 안으로 · 사라진 사냥 겹(8 s)은 셈에서 빠짐', () => {
  const big = body({ short: '큰', ki: 14 });
  assert.equal(stackRows([big])[0].stacks[0].n, JP_TANK.max);
  const f = body({ short: '겹', hunt: 3 });
  f.cnHunt.ts = [0, 0, 2.5]; // 0 초에 둘 · 2.5 초에 하나 — 지금 3 초
  f.fightT = UA.cnHunt.life + 0.1; // 앞 둘은 life 가 지남
  assert.deepEqual(stackRows([f])[0].stacks, [{ key: 'hunt', label: '사냥', n: 1, max: 5 }]);
});

test('이름 — 짧은 이름 · 없으면 나 = 나 · 그 밖 이름 첫 낱말', () => {
  const me = { name: '오토 반 아커' }, foe = { name: '이졸데 반 아커러' };
  assert.equal(rowName(me, me), '나');
  assert.equal(rowName(foe, me), '이졸데');
  assert.equal(rowName({ ...foe, shortName: '이졸데' }, me), '이졸데');
});

test('머리 위 스택 표시를 걷음 — 기력 막대 밑 칸 · 위 발톱 자국 (그 판 · 글 · 그림 줄이 없음)', () => {
  const hud = fs.readFileSync(new URL('../../src/stamina_hud.js', import.meta.url), 'utf8');
  assert.ok(!/stackShow|ken-pips/.test(hud), 'stamina_hud.js 에 기세 칸이 남음');
  assert.ok(!fs.existsSync(new URL('../../src/cn_hunt_hud.js', import.meta.url)), 'cn_hunt_hud.js 가 남음');
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(!/\.ken-pips|\.hunt-marks|#teamList/.test(html), 'index.html 에 옛 머리 위 스택 · 왼쪽 위 체력 목록 꼴이 남음');
  assert.ok(/id="stackHud"/.test(html), '스택 칸 자리');
  const main = fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.ok(/createStackHud/.test(main) && !/createHuntHud/.test(main));
});
