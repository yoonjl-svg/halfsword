// 스킬 칸 입력 줄 시험 (사장님 10/24 14:1x '커맨드가 있는 공격은 스킬 설명 최하단에 커맨드 적어. 최대한 단순하고 이해하기 쉽게 적어봐' →
//  10/25 17:3x '스킬창에서 모든 커맨드 설명은 도식으로 단순화 해. 이런 구조로 써. - 커맨드: 우측 이동(→)과 동시에 베기' · ''커맨드'는 '입력'으로 바꾸자' ·
//  17:4x '베기는 사선 베기 수직 베기 수평 베기 이렇게 구분해. 찌르기는 그냥 찌르기' · 17:5x ''아무 베기'가 찌르기까지 포함하는 아무 공격인 것이면 베기 대신 공격이라고 써'
//  — src/skill_tree_data.js NODE_CMD · 화면 src/skill_tree.js 이름표 '입력:'):
//  ① 정해진 입력으로 내는 칸(고유 공격 · 비기 · 막아찌르기 · 박차기 걸음 · 간격 잡기)만 cmd 가 있고 저절로 붙는 칸(패시브 · 심화 · 편지 · 걷기 맛 · 막기 자리 · 피해 감소 · 흘림)은 없다
//  ② 글 꼴: 33 자 안(카드 맨 아래 한 줄 — 680 × 360 에서도 '입력:' 과 한 줄) · 숫자 · 원어 글자 없음 · 쓰는 기호는 화살표 · '/' · 괄호 · 쉼표 · '!' 만 ·
//     도식 낱말(앞으로 이동(↑) · 뒤로 이동(↓) · 좌우 이동(←/→) · 사선/수직/수평 베기(화살표) · 베기 · 찌르기 · 막기 · 공격 · 느낌표(!)) · 화살표 꼴과 베기 꼴이 맞음
//  ③ 글이 코드와 맞는지: 기본 동작 길(ai_techniques.js TECH — 길 방향 → 화살표 · 베기 꼴(수평 · 수직 · 사선)) · 고유 공격 표(unique_assist.js PLAYER_UNIQUE — 스틱 쪽 · 기본 동작 · 앞 동작 조건) ·
//     비기 조건(schools.js playerSecretDef · config SECRET 기본값) · 걸음 스위치(config GAIT) · 받는 입력(톡도 되면 '공격', 끌기만이면 '베기', 톡만이면 '찌르기' — unique_assist.js · fighter.js · main.js 자리).
//     조작이 바뀌면 여기가 먼저 깨진다 → 글(NODE_CMD)과 docs/text/skill_cmd_2026-10-24.md 를 함께 고친다
//  node --test tools/sim/skill_cmd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const D = await import('../../src/skill_tree_data.js');
const { SECRET, GAIT, SKILL } = await import('../../src/config.js');
const { PLAYER_UNIQUE } = await import('../../src/unique_assist.js');
const { TECH_BY_NAME, G } = await import('../../src/ai_techniques.js');
const { playerSecretDef } = await import('../../src/schools.js');
const src = (f) => fs.readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');

const all = () => D.TREE_SCHOOLS.flatMap((s) => D.nodesOf(s).map((n) => ({ s, n })));
const cmdOf = (school, id) => D.nodeOf(school, id).cmd;
// 정해진 입력으로 내는 칸 (나머지는 cmd 없음)
const WITH_CMD = ['G1', 'G2', 'G5', 'G8', 'G7', 'G10', 'I2', 'I7', 'I6', 'I9', 'I4', 'B2', 'B3', 'B4', 'B5', 'B7', 'J6', 'J7', 'J9', 'J5', 'C3', 'C5', 'C6', 'C9'];

// ── 도식 낱말 ──
const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']; // 화면 쪽 (손가락 · 스틱) — 0° 부터 45° 씩 (x 오른쪽 · y 위 = 손 목표 handOffset · 자세 패드 G 와 같은 축)
const ARROW_ORDER = '←→↑↓↖↗↙↘'; // 글에 여럿 쓸 때 차례 (좌우 이동(←/→) · 사선 베기(↖/↗))
const MOVES = ['앞으로 이동(↑)', '뒤로 이동(↓)', '좌우 이동(←/→)']; // 이동 스틱 (앞 = 스틱 위)
const CUT_OF_ARROW = { '←': '수평', '→': '수평', '↑': '수직', '↓': '수직', '↖': '사선', '↗': '사선', '↙': '사선', '↘': '사선' };
/** 끌기 방향 → 화살표 (가장 가까운 여덟 쪽) */
const arrowOf = (dx, dy) => ARROWS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
/** 끌기 방향 → 베기 꼴: 세로 몫이 작으면 수평 · 가로 몫이 작으면 수직 · 아니면 사선 (작다 = 축에서 22.5° 안 — 화살표 여덟 쪽과 같은 갈림) */
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
const typed = (arrows) => `${CUT_OF_ARROW[arrows[0]]} 베기(${[...arrows].sort((a, b) => ARROW_ORDER.indexOf(a) - ARROW_ORDER.indexOf(b)).join('/')})`;

test('입력 줄이 있는 칸 = 정해진 입력으로 내는 칸: 고유 공격 · 비기는 모두 · 걸음은 박차기 · 간격 잡기만 · 막기는 막아찌르기만 · 패시브 · 심화 · 편지는 없음', () => {
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

test('글 꼴: 한 줄(33 자 안) · 숫자 · 원어 글자 없음 · 쓰는 기호(화살표 · / · 괄호 · 쉼표 · !)만 · 도식 낱말 · 화살표 꼴 = 베기 꼴 · 효과 글(eff)과 다름', () => {
  for (const { n } of all()) {
    if (n.cmd === undefined) continue;
    const c = n.cmd, id = `${n.id} ${c}`;
    assert.equal(typeof c, 'string', n.id);
    assert.equal(c, c.trim(), `${id} — 앞뒤 빈칸`);
    assert.ok(!/\s{2}/.test(c), `${id} — 겹 빈칸`);
    assert.ok([...c].length <= 33, `${id} — ${[...c].length} 자 (680 × 360 카드에서 '입력:' 과 한 줄 — tools/browser/skill_cmd_shots.mjs 가 실제 폭을 잰다)`);
    assert.ok(!/[0-9０-９]/u.test(c), `${id} — 숫자`);
    assert.ok(!/[\p{Script=Latin}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c), `${id} — 원어 글자`);
    assert.ok(/^[가-힣 ←→↑↓↖↗↙↘/(),!]+$/u.test(c), `${id} — 쓰지 않는 기호`);
    assert.ok(!/조작|커맨드|긋|톡|스틱을? (옆|앞|뒤)/.test(c), `${id} — 옛 낱말(조작 · 긋기 · 톡 · 스틱 옆/앞/뒤)`);
    // 괄호 = 화살표(들)이나 느낌표만: 이동(…) · 베기(…) · 느낌표(!)
    for (const [, before, inside] of c.matchAll(/(\S*)\(([^)]*)\)/g)) {
      if (inside === '!') assert.equal(before, '느낌표', `${id} — '!' 는 느낌표(!) 로만`);
      else {
        assert.ok(/^[←→↑↓↖↗↙↘](\/[←→↑↓↖↗↙↘])?$/u.test(inside), `${id} — 괄호 안 (${inside})`);
        assert.ok(['이동', '베기'].includes(before), `${id} — 화살표는 이동(…) · 베기(…) 뒤에만: ${before}(${inside})`);
      }
    }
    assert.equal(c.replace(/\([^)]*\)/g, '').match(/[←→↑↓↖↗↙↘!]/u), null, `${id} — 화살표 · 느낌표는 괄호 안에만`);
    // 이동 스틱 = 정해진 셋
    for (const m of c.matchAll(/\S+ 이동\([^)]*\)/g)) assert.ok(MOVES.includes(m[0]), `${id} — 이동 표기 ${m[0]}`);
    // 베기(화살표) = 꼴 낱말 + 화살표 (꼴은 화살표와 맞음 — 화살표 둘이면 같은 꼴) · 꼴 낱말 뒤엔 늘 베기(화살표)
    for (const m of c.matchAll(/(?:(\S+) )?베기\(([^)]*)\)/g)) {
      assert.ok(['사선', '수직', '수평'].includes(m[1]), `${id} — 베기(…) 앞에 꼴(사선 · 수직 · 수평)`);
      assert.ok(m[2].split('/').every((a) => CUT_OF_ARROW[a] === m[1]), `${id} — ${m[1]} 베기(${m[2]}): 화살표 꼴이 다름`);
    }
    for (const m of c.matchAll(/(사선|수직|수평)(.{0,4})/g)) assert.ok(m[2].startsWith(' 베기('), `${id} — ${m[1]} 뒤엔 ' 베기(화살표)'`);
    assert.notEqual(c, n.eff, n.id);
  }
});

test('기본 동작 길 → 화살표 · 베기 꼴 (ai_techniques.js TECH: 시작 자세 패드 → 끝 자리 · 화면 쪽)', () => {
  // 길 방향 그대로 — 사장님 '사선 베기 수직 베기 수평 베기 이렇게 구분해'
  const want = { zornhau: '사선 베기(↙)', zornhauL: '사선 베기(↘)', zwerch: '수평 베기(←)', zwerchL: '수평 베기(→)', oberhau: '수직 베기(↓)', stichOchs: '사선 베기(↙)', stichPflug: '사선 베기(↖)', stichPflugL: '사선 베기(↗)' };
  for (const [name, w] of Object.entries(want)) {
    const { arrow } = techShape(name);
    assert.equal(typed([arrow]), w, name);
  }
  // 황소 찌르기(위에서 내려 찌르기의 바탕)는 분노의 베기와 같은 ↙ — 시작 자리가 가름: 황소 = 머리 높이(칼자루가 머리 오른쪽) · 어깨 지붕 = 그보다 위
  assert.ok(G.ochsR[1] > 0.2 && G.ochsR[1] < 0.35 && G.tagR[1] > G.ochsR[1] + 0.1, '황소 = 머리 높이 · 어깨 지붕은 더 위');
  assert.equal(TECH_BY_NAME.stichOchs.path.at(-1), G.langort, '황소 찌르기 = 머리 높이에서 가운데로');
});

test('고유 공격 칸 글 = 고유 공격 표(PLAYER_UNIQUE): 스틱 쪽 · 기본 동작 화살표 · 베기 꼴 · 앞 동작 조건 · 받는 입력(끌기만 → 베기)', () => {
  // 고유 공격은 끌기(긋기 읽기)로만 난다: 톡 찌르기가 도는 동안은 발동하지 않는다(unique_assist.js busy — sk.tap) → 받는 입력 낱말은 '베기'('공격' · '찌르기' 아님)
  const ua = src('unique_assist.js');
  assert.match(ua, /busy\(\) \{[\s\S]{0,200}!!sk\.tap/, 'unique_assist.js busy() 가 톡 찌르기 동안 막음 — 바뀌면 이어 긋기 칸 낱말을 다시 본다(톡도 되면 공격)');
  assert.match(ua, /if \(c\.when === 'turn'\) return !L\.tap/, "꺾기('turn')는 톡 찌르기로는 안 됨");
  let n = 0;
  for (const { s, n: x } of all()) {
    if (!x.u) continue;
    n++;
    const e = PLAYER_UNIQUE[s].find((u) => u.name === x.u);
    assert.ok(e, `${x.id} ${x.u}`);
    const c = x.cmd, id = `${x.id} ${c}`;
    // 걸음 명령: 긋기를 시작할 때 스틱이 그 쪽 (unique_assist.js stickOk — 옆은 어느 쪽이든)
    if (e.stick === 'side') assert.ok(c.startsWith('좌우 이동(←/→)과 동시에 '), `${id} — 옆`);
    else if (e.stick === 'fwd') assert.ok(c.startsWith('앞으로 이동(↑)과 동시에 '), `${id} — 앞`);
    else assert.ok(!c.includes('이동('), `${id} — 스틱 없음`);
    assert.ok(!c.includes('공격'), `${id} — 끌기만 받음 → '공격' 아님`);
    const base = e.on.filter((o) => !o.prev);
    const after = e.on.filter((o) => o.prev);
    if (base.length) {
      assert.ok(!c.includes('찌르기'), `${id} — 톡으로는 안 남 → 찌르기 아님(찌르기 길도 끌기 = 베기)`);
      const techs = base.filter((o) => o.tech).map((o) => techShape(o.tech));
      if (techs.length) {
        assert.equal(new Set(techs.map((t) => t.cut)).size, 1, `${x.id} 기본 동작 꼴 하나`);
        const w = typed([...new Set(techs.map((t) => t.arrow))]);
        assert.ok(c.endsWith(w), `${id} — 기본 동작 ${base.map((o) => o.tech).join(' · ')} = ${w}`);
        if (base.some((o) => o.tech === 'stichOchs')) assert.ok(c.startsWith('머리 높이에서 '), `${id} — 황소 자리(머리 높이)에서`);
      }
      for (const o of base.filter((b) => b.pad)) {
        assert.equal(o.pad, 'langort');
        assert.ok(c.startsWith('가운데서 '), `${id} — 긴 자세(가운데) 자리에서`);
        assert.ok(c.endsWith(`수직 베기(${DIR_ARROW[o.dir]})`), `${id} — 방향 ${o.dir}`);
        assert.ok(c.includes('짧게'), `${id} — 길 끝이 긴 자세 바로 밑(짧은 길)`);
      }
    }
    if (after.length) {
      assert.equal(e.role, 'chain', x.id);
      assert.ok(c.includes('바로'), `${id} — 이어 긋기 = 곧바로`);
      const o = after[0];
      // 뒤 칼(받는 입력): 방향 조건이 있으면 꼴 + 화살표, 없으면 꼴 없는 '베기'(아무 끌기 — 톡은 안 셈)
      const tail = o.dir ? `수직 베기(${DIR_ARROW[o.dir]})` : '베기';
      if (o.when === 'bound') {
        assert.ok(after.every((a) => !a.dir), x.id);
        // 앞 칼: 'cut' = 끌기 베기 · 'thrust' = 찌르기(톡 포함 — unique_assist.js track tapRec kind 'thrust')
        assert.ok(c.startsWith(o.prev === 'cut' ? '베기가 상대 칼에 닿으면 바로 ' : '찌르기가 상대 칼에 닿으면 바로 '), `${id} — 맞물림 뒤`);
        assert.ok(c.endsWith(` ${tail}`) && !/(사선|수직|수평) 베기$/.test(c), `${id} — 뒤 칼 = 아무 끌기(꼴 없는 베기)`);
      }
      if (o.when === 'miss') {
        assert.ok(after.every((a) => a.dir === 'up' && TECH_BY_NAME[a.prev]?.path.at(-1)[1] < TECH_BY_NAME[a.prev].from[1]), `${x.id} 앞 칼 = 내려 베기들`);
        assert.ok(c.startsWith('내려 베기가 안 맞으면 바로 '), `${id} — 못 맞힘(막힘 포함 — '빗나가면' 이 아니라 '안 맞으면')`);
        assert.ok(c.endsWith(tail), `${id} — 위로 = ${tail}`);
      }
      if (o.when === 'turn') {
        assert.ok(after.every((a) => a.when === 'turn' && a.prev === 'stichPflug'), x.id);
        const { arrow } = techShape('stichPflug');
        assert.equal(c, `${typed([arrow])} 도중 바로 방향 꺾기`, `${id} — 쟁기 찌르기 끌기를 시작하고 곧 꺾음`);
      }
    }
  }
  assert.equal(n, 14); // 고유 공격 칸 (u) — 이베리아 흐르는 긋기(B5)는 몫 열쇠 ibFlow
  // B5 흐름: 휘두르기(끌기)만 셈 — 톡 찌르기는 휘두르기가 아님 → '베기'
  const flow = /updateIbFlow\(dt\) \{([\s\S]*?)\n  \}/.exec(src('fighter.js'))?.[1] ?? '';
  assert.ok(flow.includes('sk.swinging') && !flow.includes('sk.tap'), 'fighter.js updateIbFlow = 휘두르기만');
  assert.equal(D.nodeOf('iberian', 'B5').f[0], 'ibFlow');
  assert.equal(cmdOf('iberian', 'B5'), '베기를 쉬지 않고 이어 가기');
});

test('걸음 · 막기 칸 글 = 코드 스위치: 뒤 박차기(독일 보법) · 옆 박차기(옆 누르면 늘) · 간격 잡기(상대 헛침 뒤 앞 걸음) · 막아찌르기(막기 새 누름)', () => {
  assert.ok(GAIT.stepBurst && GAIT.burstDe, '뒤 박차기 = 서 있다 뒤로 (독일만)');
  assert.equal(cmdOf('german', 'G1'), '멈춘 상태에서 뒤로 이동(↓)');
  assert.ok(GAIT.burstWalkSide, '옆 박차기 = 옆 누르면 늘 (서 있든 걷든 · 어느 쪽이든)');
  assert.ok(D.nodeOf('iberian', 'B2').f.includes('burstSide'));
  assert.equal(cmdOf('iberian', 'B2'), '좌우 이동(←/→)');
  assert.ok(GAIT.deChase && D.nodeOf('german', 'G2').f.includes('chase'));
  assert.equal(cmdOf('german', 'G2'), '상대가 헛치면 앞으로 이동(↑)');
  assert.ok(SKILL.itOpposition && D.nodeOf('italian', 'I6').f.includes('opposition'));
  assert.equal(cmdOf('italian', 'I6'), '막기');
});

test("비기 칸 글 = 사람 비기 조건 (schools.js playerSecretDef · config SECRET 기본값) · 창에서 받는 입력: 톡도 끌기도 → '공격' · 톡만 → '찌르기' · 원 끌기 → '베기' · 저절로 → 없음", () => {
  // 비기 창: 톡(taps) 또는 끌기(secSwipe — tapOnly 면 끌기는 보통 베기) · 이베리아 원 판은 원 끌기만(atkWin 이 circleOwns 를 뺌) (main.js)
  const main = src('main.js');
  assert.ok(main.includes('const secSwipe = swipe && !playerSecret?.S?.do?.tapOnly;'), 'main.js — 끌기는 tapOnly 가 아닐 때만 비기');
  assert.ok(main.includes('((atkWin || gilReady) && (taps > 0 || secSwipe) || stickGo || circleGo)'), 'main.js — 비기 창 = 톡 · 끌기 · (스틱 · 원)');
  assert.ok(main.includes('!playerSecret.circleOwns()'), 'main.js — 원 판은 톡 · 끌기 하나로 안 남');
  const slot = (def) => (def.do?.tapOnly ? '찌르기' : def.do?.spin && SECRET.ibSpin.input === 'attackCircle' ? '원을 그리며 베기' : '공격');
  const sec = (school) => D.nodesOf(school).find((n) => n.cat === 'secret');
  const de = playerSecretDef('german');
  assert.ok(SECRET.deMord && de.when === 'press' && SECRET.mordPress > 0, '독일 = 밀치기 누르기 (모르트슐라크)');
  // 밀치기 걸쇠: 붙은 거리에서 스틱을 놓아야(멈춤 — stickY ≤ 0) 걸리고, 그 뒤 앞으로 밀어야 밀치기 (fighter.js closeStep) → '멈췄다 앞으로 이동(↑)'
  const fighter = src('fighter.js');
  assert.ok(fighter.includes('const idle = this.stickY <= 0;') && fighter.includes('else if (idle) this.closeArmed = true;'), 'fighter.js closeStep 걸쇠 = 붙은 거리에서 멈춤');
  assert.equal(sec('german').cmd, `붙은 채 멈췄다 앞으로 이동(↑), 느낌표(!)가 뜨면 ${slot(de)}`);
  const it = playerSecretDef('italian');
  assert.ok(SECRET.itSecret === 'risoluto' && it.when === 'risoluto' && it.do.tapOnly, '이탈리아 = 덮인 채 나아가기 → 톡만');
  assert.equal(sec('italian').cmd, `칼을 맞댄 채 앞으로 이동(↑), 느낌표(!)가 뜨면 ${slot(it)}`);
  const ib = playerSecretDef('iberian');
  assert.ok(SECRET.iberianSecret === 'spin' && ib.do.spin && SECRET.ibSpin.input === 'attackCircle', '이베리아 = 무장 → 끌기로 원 한 바퀴');
  assert.equal(sec('iberian').cmd, `거리 밖에서 버티다 느낌표(!)가 뜨면 ${slot(ib)}`);
  const jp = playerSecretDef('japanese');
  assert.ok(jp.cond.armed && jp.do.instant && SECRET.iai && !jp.do.tapOnly, '일본 = 발도 대기(상대 칼 거리 밖) → 상대가 칠 때 창 · 톡도 끌기도');
  assert.equal(sec('japanese').cmd, `거리 밖에서 기다리다 느낌표(!)가 뜨면 ${slot(jp)}`);
  const cn = playerSecretDef('chinese');
  assert.ok(SECRET.gyeoksal.on && cn.when === 'gyeoksal' && SECRET.gyeoksal.auto && SECRET.gyeoksal.press > 0, '동방 = 때맞춰 막기 · 스틱 앞 → 저절로');
  assert.equal(sec('chinese').cmd, '앞으로 이동(↑)과 동시에, 칼이 닿기 직전 막기');
  assert.ok(!/공격|베기|찌르기/.test(sec('chinese').cmd), '격살은 받아 내면 저절로 — 공격 입력 없음');
});

test("'공격' = 톡도 끌기도 받는 자리만 · '찌르기'(받는 입력) = 톡만 받는 자리만 (사장님 17:5x)", () => {
  const withWord = (re) => all().filter(({ n }) => n.cmd && re.test(n.cmd)).map(({ n }) => n.id).sort();
  assert.deepEqual(withWord(/공격/), ['G10', 'J5'], '공격 = 독일 · 일본 비기 창(톡 · 끌기)');
  assert.deepEqual(withWord(/찌르기$/), ['I4'], '찌르기(받는 입력) = 이탈리아 비기 창(톡만)');
  assert.deepEqual(withWord(/찌르기가/), ['I9'], '찌르기가(앞 칼 조건) = 칼끝 돌려 빼기(톡 포함)');
});
