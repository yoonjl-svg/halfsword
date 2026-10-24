// 스킬 칸 조작 줄 시험 (사장님 10/24 14:1x '커맨드가 있는 공격은 스킬 설명 최하단에 커맨드 적어. 최대한 단순하고 이해하기 쉽게 적어봐' — src/skill_tree_data.js NODE_CMD · 화면 src/skill_tree.js):
//  ① 정해진 입력으로 내는 칸(고유 공격 · 비기 · 막아찌르기 · 박차기 걸음 · 간격 잡기)만 cmd 가 있고 저절로 붙는 칸(패시브 · 심화 · 편지 · 걷기 맛 · 막기 자리 · 피해 감소 · 흘림)은 없다
//  ② 글 꼴: 명사형 '~기'(끝 '공격') · 30 자 안(카드 맨 아래 온 폭 한 줄 — 680 × 360 에서도 한 줄) · 숫자 · 원어 글자 · 기호 없음 · 화면이 쓰는 조작 낱말
//  ③ 글이 코드와 맞는지: 고유 공격 표(unique_assist.js PLAYER_UNIQUE — 스틱 쪽 · 기본 동작 · 앞 동작 조건) · 기본 동작 길(ai_techniques.js TECH — 시작 자리 · 첫 방향) ·
//     비기 조건(schools.js playerSecretDef · config SECRET 기본값) · 걸음 스위치(config GAIT). 조작이 바뀌면 여기가 먼저 깨진다 → 글(NODE_CMD)과 docs/text/skill_cmd_2026-10-24.md 를 함께 고친다
//  node --test tools/sim/skill_cmd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const D = await import('../../src/skill_tree_data.js');
const { SECRET, GAIT, SKILL } = await import('../../src/config.js');
const { PLAYER_UNIQUE } = await import('../../src/unique_assist.js');
const { TECH_BY_NAME, G } = await import('../../src/ai_techniques.js');
const { playerSecretDef } = await import('../../src/schools.js');

const all = () => D.TREE_SCHOOLS.flatMap((s) => D.nodesOf(s).map((n) => ({ s, n })));
// 정해진 입력으로 내는 칸 (나머지는 cmd 없음)
const WITH_CMD = ['G1', 'G2', 'G5', 'G8', 'G7', 'G10', 'I2', 'I7', 'I6', 'I9', 'I4', 'B2', 'B3', 'B4', 'B5', 'B7', 'J6', 'J7', 'J9', 'J5', 'C3', 'C5', 'C6', 'C9'];

test('조작 줄이 있는 칸 = 정해진 입력으로 내는 칸: 고유 공격 · 비기는 모두 · 걸음은 박차기 · 간격 잡기만 · 막기는 막아찌르기만 · 패시브 · 심화 · 편지는 없음', () => {
  const have = all().filter(({ n }) => n.cmd !== undefined).map(({ n }) => n.id).sort();
  assert.deepEqual(have, [...WITH_CMD].sort());
  for (const { n } of all()) {
    if (n.cat === 'atk' || n.cat === 'secret') assert.ok(n.cmd, `${n.id} ${n.name} — 고유 공격 · 비기는 조작 줄이 있어야`);
    if (n.cat === 'passive' || n.cat === 'deep' || n.cat === 'letter') assert.equal(n.cmd, undefined, `${n.id} ${n.name} — 저절로 붙는 칸`);
  }
  assert.deepEqual(all().filter(({ n }) => n.cat === 'foot' && n.cmd).map(({ n }) => n.id).sort(), ['B2', 'G1', 'G2']);
  assert.deepEqual(all().filter(({ n }) => n.cat === 'parry' && n.cmd).map(({ n }) => n.id), ['I6']);
});

test('글 꼴: 한 줄(30 자 안) · 명사형(~기 · 공격) · 숫자 · 원어 글자 · 기호(! · → · 가운뎃점 · 쉼표 · 쌍점) 없음 · 화면이 쓰는 조작 낱말 · 효과 글(eff)과 다름', () => {
  for (const { n } of all()) {
    if (n.cmd === undefined) continue;
    const c = n.cmd;
    assert.equal(typeof c, 'string', n.id);
    assert.equal(c, c.trim(), `${n.id} 앞뒤 빈칸`);
    assert.ok(!/\s{2}/.test(c), `${n.id} 겹 빈칸`);
    assert.ok([...c].length <= 30, `${n.id} ${[...c].length} 자: ${c}`);
    assert.ok(/(기|공격)$/.test(c), `${n.id} 끝말: ${c}`);
    assert.ok(!/[0-9０-９]/u.test(c), `${n.id} 숫자: ${c}`);
    assert.ok(!/[\p{Script=Latin}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c), `${n.id} 원어 글자: ${c}`);
    assert.ok(!/[!！→·,:'"“”‘’()]/u.test(c), `${n.id} 기호: ${c}`);
    assert.ok(/스틱|막기|톡|긋|공격|그리기/.test(c), `${n.id} 조작 낱말: ${c}`);
    assert.notEqual(c, n.eff, n.id);
  }
});

// 기본 동작 → 글 (시작 자리에서 · 어느 쪽으로). 아래 시험이 TECH 길(시작 패드 · 첫 방향)과 낱말이 맞는지 본다
const TECH_WORDS = {
  zornhau: ['오른쪽 위에서', '왼쪽 아래로'],
  zornhauL: ['왼쪽 위에서', '오른쪽 아래로'],
  zwerch: ['오른쪽에서', '왼쪽으로 가로로'],
  zwerchL: ['왼쪽에서', '오른쪽으로 가로로'],
  stichOchs: ['머리 오른쪽에서', '가운데로'],
  stichPflug: ['아래에서', '가운데로'],
  stichPflugL: ['아래에서', '가운데로'],
};

test('기본 동작 낱말이 길과 맞음 (ai_techniques.js TECH: 시작 자세 패드 = 화면 쪽 · 첫 방향)', () => {
  for (const [name, [from, to]] of Object.entries(TECH_WORDS)) {
    const T = TECH_BY_NAME[name];
    assert.ok(T, name);
    const [sx, sy] = T.from, dx = T.path[0][0] - sx, dy = T.path[0][1] - sy;
    const side = (x) => (x > 0.1 ? '오른쪽' : x < -0.1 ? '왼쪽' : '');
    if (name.startsWith('stichPflug')) assert.ok(sy < -0.2 && Math.abs(sx) < 0.25, `${name} 시작 = 아래 (허리 쪽 · 좌우 어느 쪽이든)`);
    else assert.ok(from.includes(side(sx)), `${name} 시작 쪽 ${sx}: ${from}`);
    if (sy > 0.2) assert.ok(/위|머리/.test(from), `${name} 시작 높이 ${sy}: ${from}`);
    const end = T.path[T.path.length - 1];
    if (end === G.langort) assert.ok(to.includes('가운데'), `${name} 끝 = 가운데(긴 자세): ${to}`);
    else {
      assert.ok(to.includes(side(dx)), `${name} 가는 쪽 ${dx}: ${to}`);
      if (Math.abs(dy) < 0.1) assert.ok(to.includes('가로'), `${name} 가로: ${to}`);
      else assert.ok(dy < 0 ? to.includes('아래') : to.includes('위'), `${name} 높이 ${dy}: ${to}`);
    }
  }
  assert.ok(TECH_BY_NAME.stichOchs.from[1] > 0.2 && TECH_BY_NAME.stichOchs.path[0][1] < TECH_BY_NAME.stichOchs.from[1], '황소 찌르기 = 머리 높이에서 내려 찌름');
});

test('고유 공격 칸 글 = 고유 공격 표(PLAYER_UNIQUE): 스틱 쪽 · 기본 동작 · 앞 동작 조건', () => {
  let n = 0;
  for (const { s, n: x } of all()) {
    if (!x.u) continue;
    n++;
    const e = PLAYER_UNIQUE[s].find((u) => u.name === x.u);
    assert.ok(e, `${x.id} ${x.u}`);
    const c = x.cmd;
    // 걸음 명령: 긋기를 시작할 때 스틱이 그 쪽 (unique_assist.js stickOk)
    if (e.stick === 'side') assert.ok(c.startsWith('스틱을 옆으로 민 채 '), `${x.id} 옆: ${c}`);
    else if (e.stick === 'fwd') assert.ok(c.startsWith('스틱을 앞으로 민 채 '), `${x.id} 앞: ${c}`);
    else assert.ok(!c.includes('스틱'), `${x.id} 스틱 없음: ${c}`);
    const base = e.on.filter((o) => !o.prev);
    const after = e.on.filter((o) => o.prev);
    for (const o of base) {
      if (o.tech) for (const w of TECH_WORDS[o.tech]) assert.ok(c.includes(w), `${x.id} ${o.tech} '${w}': ${c}`);
      if (o.pad) { assert.equal(o.pad, 'langort'); assert.ok(c.includes('가운데서'), `${x.id} 긴 자세 자리: ${c}`); }
      if (o.dir) assert.ok(c.includes({ down: '아래로', up: '위로' }[o.dir]), `${x.id} 방향 ${o.dir}: ${c}`);
      if (TECH_BY_NAME[o.tech]?.kind === 'thrust') assert.ok(c.includes('찌르듯'), `${x.id} 찌르기 긋기: ${c}`);
    }
    if (after.length) {
      assert.equal(e.role, 'chain', x.id);
      assert.ok(c.includes('바로'), `${x.id} 이어 긋기 = 곧바로: ${c}`);
      const o = after[0];
      if (o.when === 'bound') assert.ok(c.startsWith(o.prev === 'cut' ? '벤 칼이 상대 칼에 닿으면' : '찌른 칼이 상대 칼에 닿으면'), `${x.id} 맞물림 뒤: ${c}`);
      if (o.when === 'miss') { assert.ok(c.includes('내려벤 칼이 안 맞으면') && after.every((a) => a.dir === 'up' && TECH_BY_NAME[a.prev]?.path.at(-1)[1] < TECH_BY_NAME[a.prev].from[1]), `${x.id} 내려벤 칼 · 빗나감: ${c}`); assert.ok(c.includes('위로'), x.id); }
      if (o.when === 'turn') { assert.ok(after.every((a) => a.when === 'turn' && a.prev === 'stichPflug'), x.id); assert.ok(c.includes('오른쪽 아래에서 찌르듯') && c.endsWith('꺾기'), `${x.id} 찌르다 꺾음: ${c}`); }
    }
  }
  assert.equal(n, 14); // 고유 공격 칸 (u) — 이베리아 흐르는 긋기(B5)는 몫 열쇠 ibFlow
  assert.equal(D.nodeOf('iberian', 'B5').f[0], 'ibFlow');
  assert.ok(D.nodeOf('iberian', 'B5').cmd.includes('이어 긋기'));
});

test('걸음 · 막기 칸 글 = 코드 스위치: 뒤 박차기(독일 보법) · 옆 박차기(옆 누르면 늘) · 간격 잡기(상대 헛침 뒤 앞 걸음) · 막아찌르기(막기 새 누름)', () => {
  assert.ok(GAIT.stepBurst && GAIT.burstDe, '뒤 박차기 = 서 있다 뒤로 (독일만)');
  assert.equal(D.nodeOf('german', 'G1').cmd, '멈춰 섰다가 스틱을 뒤로 당기기');
  assert.ok(GAIT.burstWalkSide, '옆 박차기 = 옆 누르면 늘 (서 있든 걷든)');
  assert.ok(D.nodeOf('iberian', 'B2').f.includes('burstSide'));
  assert.equal(D.nodeOf('iberian', 'B2').cmd, '스틱을 옆으로 밀기');
  assert.ok(GAIT.deChase && D.nodeOf('german', 'G2').f.includes('chase'));
  assert.equal(D.nodeOf('german', 'G2').cmd, '상대가 헛치면 스틱을 앞으로 밀기');
  assert.ok(SKILL.itOpposition && D.nodeOf('italian', 'I6').f.includes('opposition'));
  assert.equal(D.nodeOf('italian', 'I6').cmd, '막기 누르기');
});

test('비기 칸 글 = 사람 비기 조건 (schools.js playerSecretDef · config SECRET 기본값)', () => {
  const sec = (school) => D.nodesOf(school).find((n) => n.cat === 'secret');
  const de = playerSecretDef('german');
  assert.ok(SECRET.deMord && de.when === 'press' && SECRET.mordPress > 0, '독일 = 밀치기 누르기 (모르트슐라크)');
  assert.equal(sec('german').cmd, '붙어서 스틱을 놓고 앞으로 밀다가 느낌표가 뜨면 공격'); // 밀치기 걸쇠: 붙은 거리에서 스틱을 놓았다 밀어야 (fighter.js closeStep)
  const it = playerSecretDef('italian');
  assert.ok(SECRET.itSecret === 'risoluto' && it.when === 'risoluto' && it.do.tapOnly, '이탈리아 = 덮인 채 나아가기 → 톡만');
  assert.equal(sec('italian').cmd, '칼을 맞댄 채 걸어 들어가다 느낌표가 뜨면 톡 치기');
  const ib = playerSecretDef('iberian');
  assert.ok(SECRET.iberianSecret === 'spin' && ib.do.spin && SECRET.ibSpin.input === 'attackCircle', '이베리아 = 무장 → 공격으로 원 한 바퀴');
  assert.equal(sec('iberian').cmd, '거리를 두고 버티다 느낌표가 뜨면 원 한 바퀴 그리기');
  const jp = playerSecretDef('japanese');
  assert.ok(jp.cond.armed && jp.do.instant && SECRET.iai, '일본 = 발도 대기(상대 칼 거리 밖) → 상대가 칠 때 창');
  assert.equal(sec('japanese').cmd, '거리를 두고 기다리다 느낌표가 뜨면 공격');
  const cn = playerSecretDef('chinese');
  assert.ok(SECRET.gyeoksal.on && cn.when === 'gyeoksal' && SECRET.gyeoksal.auto && SECRET.gyeoksal.press > 0, '동방 = 때맞춰 막기 · 스틱 앞 → 저절로');
  assert.equal(sec('chinese').cmd, '스틱을 앞으로 민 채 칼이 닿기 직전에 막기 누르기');
  assert.ok(!sec('chinese').cmd.includes('공격'), '격살은 받아 내면 저절로 — 공격 입력 없음');
});
