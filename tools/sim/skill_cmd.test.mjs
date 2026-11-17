// 스킬 칸 입력 줄 시험 (사장님 10/24 14:1x '커맨드가 있는 공격은 스킬 설명 최하단에 커맨드 적어. 최대한 단순하고 이해하기 쉽게 적어봐' →
//  10/25 17:3x '스킬창에서 모든 커맨드 설명은 도식으로 단순화 해. 이런 구조로 써. - 커맨드: 우측 이동(→)과 동시에 베기' · ''커맨드'는 '입력'으로 바꾸자' ·
//  17:4x '베기는 사선 베기 수직 베기 수평 베기 이렇게 구분해. 찌르기는 그냥 찌르기' · 17:5x ''아무 베기'가 찌르기까지 포함하는 아무 공격인 것이면 베기 대신 공격이라고 써' ·
//  18:3x '그럼 입력 설명에서는 베기와 찌르기라는 말 대신 긋기와 탭이라고 하자' — src/skill_tree_data.js NODE_CMD · 화면 src/skill_tree.js 이름표 '입력:'):
//  ① 정해진 입력으로 내는 칸(고유 공격 · 비기 · 막아찌르기 · 박차기 걸음 · 파고들기 — 11/14 전 간격 잡기)만 cmd 가 있고 저절로 붙는 칸(패시브 · 심화 · 편지 · 걷기 맛 · 막기 자리 · 피해 감소 · 흘림)은 없다
//  ② 글 꼴: 33 자 안(카드 맨 아래 한 줄 — 680 × 360 에서도 '입력:' 과 한 줄) · 숫자 · 원어 글자 없음 · 쓰는 기호는 화살표 · '/' · 괄호 · 쉼표 · '!' 만 ·
//     손이 하는 낱말만(앞으로 이동(↑) · 뒤로 이동(↓) · 좌우 이동(←/→) · 사선/수직/수평 긋기(화살표) · 긋기 · 탭 · 공격 · 막기 · 느낌표(!)) — 칼 동작 말 '베기' · '찌르기' 는 안 씀 ·
//     화살표 꼴과 긋기 꼴이 맞음
//  ③ 글이 코드와 맞는지: 기본 동작 길(ai_techniques.js TECH — 길 방향 → 화살표 · 긋기 꼴(수평 · 수직 · 사선)) · 고유 공격 표(unique_assist.js PLAYER_UNIQUE — 스틱 쪽 · 기본 동작 · 앞 동작 조건) ·
//     비기 조건(schools.js playerSecretDef · config SECRET 기본값) · 걸음 스위치(config GAIT) · 받는 입력(탭도 긋기도 되면 '공격', 긋기만이면 '긋기', 탭만이면 '탭' — unique_assist.js · fighter.js · main.js 자리).
//     조작이 바뀌면 여기가 먼저 깨진다 → 글(NODE_CMD)과 docs/text/skill_cmd_2026-10-24.md 를 함께 고친다
//  ④ 10/25 22:3x · 23:1x 사장님 확정 비기 글 다섯(I4 · B7 · J5 · C9 · G10 — OWNER): 글 그대로 · 창이 열림 = '비기 활성화' · 기다리는 시간 숫자 = config 값 · '움직이면(↑/↓)' 등 — ② 의 33 자 · 숫자 · 기호 규칙 밖(두 줄 · docs/text/editing_guide.md 입력 줄)
//  node --test tools/sim/skill_cmd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const D = await import('../../src/skill_tree_data.js');
const { SECRET, GAIT, SKILL, realS } = await import('../../src/config.js'); // realS: 글 속 초 = 실제 초 (표준 시간 10/25 — 게임 값 × 1.1)
const { PLAYER_UNIQUE } = await import('../../src/unique_assist.js');
const { UNIQUE_ASSIST: UA } = await import('../../src/config.js');
// 10/31 이탈리아 자리 바꿈 글 (감독 안 · 사장님 검수 전 — 글 그대로 둠 · 사장님 글이 오면 OWNER 로): 칼끝 돌려 빼기 I2 · 비껴서며 찌르기 I9(특수 공격) · 내려 찌르기 I7(아래로 내려 긋기 모두)
const DRAFT = {
  I2: '칼이 상대 칼에 닿은 채 박자를 맞추어 탭',
  I9: '상대가 공격해 올 때 옆으로 움직이며(←/→) 탭',
  I7: '아래로 내려 긋기(↓/↙/↘)',
  B7: '긋기 뒤 곧장 다음 긋기', // 11/14 이어 돌리기 (사장님 '모두 본판에 넣어' — §6 안 확정 · 확인표 3923) · 전 11/11 '원을 그리며 긋기(↻/↺)'(특수 공격 싱지르 — 지금은 `?ibLink=0` 판 글 B7_WINDMILL)
};
const { TECH_BY_NAME, G } = await import('../../src/ai_techniques.js');
const { playerSecretDef } = await import('../../src/schools.js');
const src = (f) => fs.readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');

const all = () => D.TREE_SCHOOLS.flatMap((s) => D.nodesOf(s).map((n) => ({ s, n })));
const cmdOf = (school, id) => D.nodeOf(school, id).cmd;
// 정해진 입력으로 내는 칸 (나머지는 cmd 없음)
const WITH_CMD = ['G1', 'G2', 'G5', 'G8', 'G7', 'G10', 'I2', 'I7', 'I6', 'I9', 'I4', 'B2', 'B3', 'B4', 'B5', 'B7', 'J6', 'J7', 'J9', 'J5', 'C3', 'C5', 'C6', 'C9'];
// 10/25 22:3x 사장님 확정 비기 글 (감독 전달 — 사장님 원문 '아무 행동 없이 2초 기다리면 준비 활성화, …' · '4] 이베리아와 이탈리아 비기도 활성화 앞에 '비기'를 붙여줘' · '5] 이베리아 비기도 기다리는 시간 2초로'):
//  글 그대로 — ② 의 도식 규칙(33 자 · 숫자 없음 · 기호 · 낱말) 밖. 코드 조건은 아래 비기 시험이 본다. G10 은 23:1x
const OWNER = {
  I4: '칼을 맞대고 상대 걸음 따라 움직이면(↑/↓) 비기 활성화', // 10/28 18:3x 사장님 '라솔루토 설명은 1' (전 10/25 22:3x '칼 길이 바깥에서 칼을 맞대고 움직이면(↑/↓) 비기 활성화')
  // 11/11 이베리아 자리 바꿈 (사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자') — 비기 칸이 B7 → B4: 무장 = 10/25 확정 글 앞 토막 그대로 · 발동 = 10/29 B4 글(길게 누름) [이어 붙인 안 — 사장님 확인 전]
  //  전 B7 '칼 길이 바깥에서 2초 기다리면 비기 활성화 · 원을 그리며 긋기(↻/↺)로 발동' · 전 B4 '탭을 길게 누르다 떼기'
  B4: '칼 길이 바깥에서 2초 기다리면 비기 활성화 · 탭을 길게 누르다 떼기로 발동',
  J5: '아무 행동 없이 2초 기다리면 준비 활성화, 상대가 내 간격에서 공격을 시도하거나 빠르게 움직이면 비기 활성화',
  C9: '앞으로 움직이며(↑) 상대 공격을 정확한 타이밍에 막으면 자동 발동',
  G10: '상대와 몸이 붙은 채 1.5초 이상 밀치면(↑) 비기 활성화', // 10/25 23:1x (감독 전달) — 글 속 시간 = SECRET.mordPress · 11/11 사장님 '1.5초로 해.' 로 숫자만 (전 '2초')
  // 10/29 14:1x · 14:2x 사장님 글 (감독 전달) — 특수 공격 넷: 풍차 베기(길게 누름 — 11/11 비기가 되어 위 B4) · 탭으로 내는 셋
  C6: '뒤로 움직이며(↓) 탭',
  G7: '가까이서 칼을 맞대거나 연달아 부딪히면 자동 발동', // 11/14 사장님 결정 '겹치기 글. 저절로 나간다 말고 자동 발동' — 겹치기 자동 ⓒ 'both' · 전 10/31 18:xx '가까이서 칼을 맞댄 채 버티면 자동 발동'('bind' 판 — D.G7_CMD_AUTO.bind) · 그 전 10/29 '긋기가 상대 칼에 닿은 채 탭' = D.G7_CMD_TAP (dupAuto 0)
};

// ── 도식 낱말 ──
const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']; // 화면 쪽 (손가락 · 스틱) — 0° 부터 45° 씩 (x 오른쪽 · y 위 = 손 목표 handOffset · 자세 패드 G 와 같은 축)
const ARROW_ORDER = '←→↑↓↖↗↙↘'; // 글에 여럿 쓸 때 차례 (좌우 이동(←/→) · 사선 긋기(↖/↗))
const MOVES = ['앞으로 이동(↑)', '뒤로 이동(↓)', '좌우 이동(←/→)']; // 이동 스틱 (앞 = 스틱 위)
const CUT_OF_ARROW = { '←': '수평', '→': '수평', '↑': '수직', '↓': '수직', '↖': '사선', '↗': '사선', '↙': '사선', '↘': '사선' };
/** 긋는 방향 → 화살표 (가장 가까운 여덟 쪽) */
const arrowOf = (dx, dy) => ARROWS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
/** 긋는 방향 → 긋기 꼴: 세로 몫이 작으면 수평 · 가로 몫이 작으면 수직 · 아니면 사선 (작다 = 축에서 22.5° 안 — 화살표 여덟 쪽과 같은 갈림) */
const T225 = Math.tan(Math.PI / 8);
const cutOf = (dx, dy) => (Math.abs(dy) < T225 * Math.abs(dx) ? '수평' : Math.abs(dx) < T225 * Math.abs(dy) ? '수직' : '사선');
/** 기본 동작 길 → { arrow, cut }: 길 전체(시작 자리 → 끝 자리)와 첫 토막(긋기 읽기 classifyStroke 가 보는 처음 방향)이 같은 쪽 · 같은 꼴이어야 한다 */
function techShape(name) {
  const T = TECH_BY_NAME[name];
  assert.ok(T, name);
  const [sx, sy] = T.from, end = T.path.at(-1), first = T.path[0];
  const whole = [end[0] - sx, end[1] - sy], head = [first[0] - sx, first[1] - sy];
  const arrow = arrowOf(...whole), cut = cutOf(...whole);
  assert.equal(arrowOf(...head), arrow, `${name} 첫 토막 쪽 = 길 전체 쪽`);
  assert.equal(cutOf(...head), cut, `${name} 첫 토막 꼴 = 길 전체 꼴`);
  assert.equal(CUT_OF_ARROW[arrow], cut, `${name} 화살표 ${arrow} ↔ 꼴 ${cut}`);
  return { arrow, cut, T };
}
const DIR_ARROW = { up: '↑', down: '↓' }; // 조건 방향 (unique_assist.js dirOk — 위 · 아래)
const typed = (arrows) => `${CUT_OF_ARROW[arrows[0]]} 긋기(${[...arrows].sort((a, b) => ARROW_ORDER.indexOf(a) - ARROW_ORDER.indexOf(b)).join('/')})`;

test('입력 줄이 있는 칸 = 정해진 입력으로 내는 칸: 고유 공격 · 비기는 모두 · 걸음은 박차기 · 파고들기만 · 막기는 막아찌르기만 · 패시브 · 심화 · 편지는 없음', () => {
  const have = all().filter(({ n }) => n.cmd !== undefined).map(({ n }) => n.id).sort();
  assert.deepEqual(have, [...WITH_CMD].sort());
  for (const { n } of all()) {
    if (n.cat === 'atk' || n.cat === 'secret') assert.ok(n.cmd, `${n.id} ${n.name} — 고유 공격 · 비기는 입력 줄이 있어야`);
    if (n.cat === 'passive' || n.cat === 'deep' || n.cat === 'letter') assert.equal(n.cmd, undefined, `${n.id} ${n.name} — 저절로 붙는 칸`);
  }
  assert.deepEqual(all().filter(({ n }) => n.cat === 'foot' && n.cmd).map(({ n }) => n.id).sort(), ['B2', 'G1', 'G2']);
  assert.deepEqual(all().filter(({ n }) => n.cat === 'parry' && n.cmd).map(({ n }) => n.id), ['I6']);
});

test("화면 이름표 = '입력:' (사장님 ''커맨드'는 '입력'으로') — 카드 맨 아래 '입력: …' 한 줄", () => {
  const t = src('skill_tree.js');
  assert.ok(t.includes('<b class="detail-cmd-label">입력:</b> <span id="nodeCmdText"></span>'), '이름표 입력: + 글');
  assert.ok(!/detail-cmd-label">(조작|커맨드)/.test(t), '옛 이름표 없음');
});

test("글 꼴: 한 줄(33 자 안) · 숫자 · 원어 글자 없음 · 쓰는 기호(화살표 · / · 괄호 · 쉼표 · !)만 · 손 낱말(긋기 · 탭 — '베기' · '찌르기' 없음) · 화살표 꼴 = 긋기 꼴 · 효과 글(eff)과 다름 (사장님 확정 비기 글 넷은 글 그대로 — 아래)", () => {
  for (const { n } of all()) {
    if (n.cmd === undefined) continue;
    const c = n.cmd, id = `${n.id} ${c}`;
    assert.equal(typeof c, 'string', n.id);
    assert.equal(c, c.trim(), `${id} — 앞뒤 빈칸`);
    assert.ok(!/\s{2}/.test(c), `${id} — 겹 빈칸`);
    assert.notEqual(c, n.eff, n.id);
    // 10/31 I7 '아래로 내려 긋기(↓/↙/↘)' (감독 안 · 사장님 검수 전 — 글 그대로): 도식 규칙 둘 밖 — 긋기(…) 앞 꼴 낱말이 '내려'(사선 · 수직 · 수평 아님) · 괄호 안 화살표 셋에 꼴 둘(수직 ↓ · 사선 ↙/↘).
    //  아래로 가는 긋기 모두를 한 줄로 적는 꼴이라 비기 확정 글처럼 글 그대로 보고 · 원어 글자 · 33 자만 본다 (여쭐 것 — 규칙에 맞추면 '수직 긋기(↓)나 사선 긋기(↙/↘)')
    //  I9 '상대가 공격해 올 때 옆으로 움직이며(←/→) 탭' 도 같음 — '움직이며(…)' 는 사장님 확정 글 C6 '뒤로 움직이며(↓) 탭' 꼴(이동(…) · 긋기(…) 밖)
    if (OWNER[n.id] || n.id === 'I7' || n.id === 'I9' || n.id === 'B7') {
      assert.equal(c, OWNER[n.id] ?? DRAFT[n.id], `${n.id} — 정해진 글 그대로 (10/25 22:3x 사장님 확정 · 10/31 I7 · I9 검수 전)`);
      if (!OWNER[n.id]) assert.ok([...c].length <= 33, `${id} — ${[...c].length} 자`);
      assert.ok(!/[\p{Script=Latin}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c), `${id} — 원어 글자`);
      continue;
    }
    assert.ok([...c].length <= 33, `${id} — ${[...c].length} 자 (680 × 360 카드에서 '입력:' 과 한 줄 — tools/browser/skill_cmd_shots.mjs 가 실제 폭을 잰다)`);
    assert.ok(!/[0-9０-９]/u.test(c), `${id} — 숫자`);
    assert.ok(!/[\p{Script=Latin}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c), `${id} — 원어 글자`);
    assert.ok(/^[가-힣 ←→↑↓↖↗↙↘/(),!]+$/u.test(c), `${id} — 쓰지 않는 기호`);
    // 사장님 18:3x '입력 설명에서는 베기와 찌르기라는 말 대신 긋기와 탭' — 칼 동작 말 · 옛 조작 말은 안 씀 ('찌르는 긋기' 는 앞 칼 조건의 긋기 꾸밈말로만 — 아래 시험)
    assert.ok(!/베기|베는|벤 |찌르기|찌른|톡|끌기|조작|커맨드|스틱을? (옆|앞|뒤)/.test(c), `${id} — 칼 동작 말(베기 · 찌르기) · 옛 낱말(톡 · 끌기 · 조작 · 스틱 옆/앞/뒤)`);
    for (const m of c.matchAll(/찌르는(.{0,3})/g)) assert.equal(m[1], ' 긋기', `${id} — '찌르는' 은 '찌르는 긋기' 로만`);
    // 괄호 = 화살표(들)이나 느낌표만: 이동(…) · 긋기(…) · 느낌표(!)
    for (const [, before, inside] of c.matchAll(/(\S*)\(([^)]*)\)/g)) {
      if (inside === '!') assert.equal(before, '느낌표', `${id} — '!' 는 느낌표(!) 로만`);
      else {
        assert.ok(/^[←→↑↓↖↗↙↘](\/[←→↑↓↖↗↙↘])?$/u.test(inside), `${id} — 괄호 안 (${inside})`);
        assert.ok(['이동', '긋기'].includes(before), `${id} — 화살표는 이동(…) · 긋기(…) 뒤에만: ${before}(${inside})`);
      }
    }
    assert.equal(c.replace(/\([^)]*\)/g, '').match(/[←→↑↓↖↗↙↘!]/u), null, `${id} — 화살표 · 느낌표는 괄호 안에만`);
    // 이동 스틱 = 정해진 셋
    for (const m of c.matchAll(/\S+ 이동\([^)]*\)/g)) assert.ok(MOVES.includes(m[0]), `${id} — 이동 표기 ${m[0]}`);
    // 긋기(화살표) = 꼴 낱말 + 화살표 (꼴은 화살표와 맞음 — 화살표 둘이면 같은 꼴) · 꼴 낱말 뒤엔 늘 긋기(화살표)
    for (const m of c.matchAll(/(?:(\S+) )?긋기\(([^)]*)\)/g)) {
      assert.ok(['사선', '수직', '수평'].includes(m[1]), `${id} — 긋기(…) 앞에 꼴(사선 · 수직 · 수평)`);
      assert.ok(m[2].split('/').every((a) => CUT_OF_ARROW[a] === m[1]), `${id} — ${m[1]} 긋기(${m[2]}): 화살표 꼴이 다름`);
    }
    for (const m of c.matchAll(/(사선|수직|수평)(.{0,4})/g)) assert.ok(m[2].startsWith(' 긋기('), `${id} — ${m[1]} 뒤엔 ' 긋기(화살표)'`);
  }
});

test('기본 동작 길 → 화살표 · 긋기 꼴 (ai_techniques.js TECH: 시작 자세 패드 → 끝 자리 · 화면 쪽)', () => {
  // 길 방향 그대로 — 사장님 '사선 베기 수직 베기 수평 베기 이렇게 구분해' (18:3x 부터 낱말은 긋기)
  const want = { zornhau: '사선 긋기(↙)', zornhauL: '사선 긋기(↘)', zwerch: '수평 긋기(←)', zwerchL: '수평 긋기(→)', oberhau: '수직 긋기(↓)', stichOchs: '사선 긋기(↙)', stichPflug: '사선 긋기(↖)', stichPflugL: '사선 긋기(↗)' };
  for (const [name, w] of Object.entries(want)) {
    const { arrow } = techShape(name);
    assert.equal(typed([arrow]), w, name);
  }
  // 황소 찌르기(위에서 내려 찌르기의 바탕)는 분노의 베기와 같은 ↙ — 시작 자리가 가름: 황소 = 머리 높이(칼자루가 머리 오른쪽) · 어깨 지붕 = 그보다 위
  assert.ok(G.ochsR[1] > 0.2 && G.ochsR[1] < 0.35 && G.tagR[1] > G.ochsR[1] + 0.1, '황소 = 머리 높이 · 어깨 지붕은 더 위');
  assert.equal(TECH_BY_NAME.stichOchs.path.at(-1), G.langort, '황소 찌르기 = 머리 높이에서 가운데로');
});

test('걸음 · 막기 칸 글 = 코드 스위치: 뒤 박차기(독일 보법) · 옆 박차기(옆 누르면 늘) · 파고들기(멈춘 채 앞 — 11/14 · 전 간격 잡기 상대 헛침 뒤 앞 걸음) · 막아찌르기(막기 새 누름)', () => {
  assert.equal(cmdOf('german', 'G1'), '멈춘 상태에서 뒤로 이동(↓)');
  assert.ok(D.nodeOf('iberian', 'B2').f.includes('burstSide'));
  assert.equal(cmdOf('iberian', 'B2'), '좌우 이동(←/→)');
  // 11/14 사장님 '간격 잡기를 파고들기로 바꿔' (서서 앞으로 세게 밀면 두 걸음 · 헛침 조건 없음): G1 글의 거울 · 몫 열쇠 'chase' 그대로 · 전 글 '상대가 헛치면 앞으로 이동(↑)'(`?deDig=0` 판)
  assert.ok(GAIT.digSteps === 2 && D.nodeOf('german', 'G2').f.includes('chase'));
  assert.equal(cmdOf('german', 'G2'), '멈춘 상태에서 앞으로 이동(↑)');
  assert.ok(SKILL.itOpposition && D.nodeOf('italian', 'I6').f.includes('opposition'));
  assert.equal(cmdOf('italian', 'I6'), '막기');
});

test("비기 칸 글 = 사람 비기 조건 (schools.js playerSecretDef · config SECRET 기본값) · 10/25 22:3x · 23:1x 사장님 확정 글 다섯(I4 · B7 → 11/11 B4 · J5 · C9 · G10)은 글 속 시간 · 스틱 · 받는 입력이 코드와 맞는지", async () => {
  // 비기 창: 탭(taps) 또는 긋기(secSwipe — tapOnly 면 긋기는 보통 공격) (main.js)
  const main = src('main.js');
  assert.ok(main.includes('const secSwipe = swipe && !playerSecret?.S?.do?.tapOnly;'), 'main.js — 긋기는 tapOnly 가 아닐 때만 비기');
  assert.ok(main.includes('((atkWin || gilReady) && (taps > 0 || secSwipe))'), 'main.js — 비기 창 = 탭 · 긋기');
  const sec = (school) => D.nodesOf(school).find((n) => n.cat === 'secret');
  /** 글 속 'n초' = 그 기다림 값 (s) */
  const secs = (c) => +/(\d+(?:\.\d+)?)초/.exec(c)?.[1];
  const de = playerSecretDef('german');
  assert.ok(de.when === 'press' && SECRET.mordPress > 0, '독일 = 밀치기 누르기 (모르트슐라크)');
  // 10/25 23:3x 밀치기 걸쇠 없앰(닿는 거리 안에서 밀면 곧장 · fighter.js closeStep) → '붙은 채 … 밀치면(↑)' · 글 속 시간 = mordPress
  const { CLOSE } = await import('../../src/config.js');
  assert.ok(src('fighter.js').includes('push && (this.closeArmed || (!latch && !g?.req))'), 'fighter.js closeStep — 걸쇠 없는 판은 밂이 곧 발사');
  assert.equal(realS(secs(OWNER.G10)), SECRET.mordPress, 'G10 글 속 시간(실제 초) = SECRET.mordPress');
  assert.equal(sec('german').cmd, OWNER.G10);
  // 이탈리아 (10/25 21:0x 조건 · 22:3x 글): 칼끼리 risolutoCover 안에 댄 채(맞대고) 스틱 앞이나 뒤(움직이면(↑/↓)) · 가슴 사이 ≥ 맞닿기 거리(칼 길이 바깥 — lungeGapOk) → 창(비기 활성화) → 공격(탭 · 긋기)
  const it = playerSecretDef('italian');
  assert.equal(sec('italian').cmd, OWNER.I4);
  // 이베리아 (11/11 자리 바꿈 — 비기 = 알티바슈 포르트 B4): 칼끝 거리 밖 altib.armTime 초 무장(비기 활성화) → 그 창에서 탭을 길게 누르다 떼기(메고 내려침) · 톡 · 끌기 · 원으로는 안 남
  const ib = playerSecretDef('iberian');
  assert.ok(src('secret.js').includes('this.spinArm.tick(dt, d0 > V.reach,'), "B4 '칼 길이 바깥' = 내 칼끝 거리(reach) 밖에서 무장");
  assert.ok(main.includes('!playerSecret.holdOwns()'), 'main.js — 알티바슈 포르트 창은 탭 · 긋기 하나로 안 남');
  assert.equal(realS(secs(OWNER.B4)), SECRET.altib.armTime, 'B4 글 속 시간(실제 초) = SECRET.altib.armTime');
  assert.equal(sec('iberian').id, 'B4');
  assert.equal(sec('iberian').cmd, OWNER.B4);
  // 일본 (10/25 22:3x · 22:5x): 거리와 상관없이 iaiArmTime 초 이동 입력 · 공격 · 막기 · 맞음 · 비기 없음(아무 행동 없이 — gnsReady 'idle' · 준비된 뒤엔 걸어도 유지) → 준비 → 상대가 칼을 듦 · 헛침(공격을 시도) · 빠르게 움직임(foeCharge) + 내 발도가 닿는 거리(내 간격) → 창(비기 활성화)
  const jp = playerSecretDef('japanese');
  assert.equal(realS(secs(OWNER.J5)), SECRET.iaiArmTime, 'J5 글 속 시간(실제 초) = SECRET.iaiArmTime');
  assert.ok(['foeRaise', 'foeRecover', 'foeCharge'].every((w) => jp.when.includes(w)), "J5 '공격을 시도하거나 빠르게 움직이면' = 칼을 듦 · 헛침 · 달려듦");
  assert.equal(sec('japanese').cmd, OWNER.J5);
  // 동방: 막기 새 누름 뒤 gyeoksal.press 초 안에 칼이 닿음(정확한 타이밍) · 그때 스틱 앞(앞으로 움직이며(↑)) · 받아 내면 저절로(자동 발동)
  const cn = playerSecretDef('chinese');
  assert.ok(cn.when === 'gyeoksal' && SECRET.gyeoksal.press > 0, '동방 = 때맞춰 막기 · 스틱 앞 → 저절로');
  assert.equal(sec('chinese').cmd, OWNER.C9);
  assert.ok(!/긋기|탭/.test(sec('chinese').cmd) && sec('chinese').cmd.endsWith('자동 발동'), '격살은 받아 내면 저절로 — 내 공격 입력 없음');
});

test("'공격' = 탭도 긋기도 받는 자리만 · '탭' = 탭을 받는(또는 앞 칼로 세는) 자리만 (사장님 17:5x · 18:3x · 10/25 22:3x 확정 글의 '상대 공격' 은 상대 쪽 말)", () => {
  const withWord = (re) => all().filter(({ n }) => n.cmd && re.test(n.cmd)).map(({ n }) => n.id).sort();
  assert.deepEqual(withWord(/공격$/), [], "받는 입력을 '공격' 으로 끝맺는 칸 없음 (10/25 비기 글은 '비기 활성화' 꼴)");
  assert.deepEqual(withWord(/공격/), ['C9', 'I9', 'J5'], "'공격' 낱말 = 일본 · 동방 확정 글 · 이탈리아 비껴서며 찌르기(10/31 검수 전)의 상대 공격");
  assert.deepEqual(withWord(/탭$/), ['C6', 'I2', 'I9'], '탭으로 내는 칸만 탭으로 끝남 — 특수 공격 둘(날개 접기 · 비껴서며 찌르기) · 칼끝 돌려 빼기(10/31 기본 기술) · 겹치기는 10/31 18:xx 부터 저절로(자동 발동) · 비기 창은 탭만 받지 않음');
  assert.deepEqual(withWord(/탭/), ['B4', 'C6', 'I2', 'I9'], '탭 = 탭으로 내는 칸 셋 · 풍차 베기(B4 — 탭을 길게 누름)');
  assert.deepEqual(withWord(/자동 발동$/), ['C9', 'G7'], '저절로 나가는 칸 = 동방 격살(사장님 확정 글) · 겹치기 자동(10/31 18:xx 사장님 초안 ok)');
  assert.deepEqual(withWord(/찌르는 긋기/), [], "'찌르는 긋기' 쓰는 칸 없음 (10/29 I9 사장님 글)");
});
