// 싸움 중 멈춤 = 모두 멈춤 (11/21 감사 N-011 · 사장님 11/21 '멈춤 동안 멈춰.' · 기록 docs/strike/perf_2026-11-21.md)
//  ① 보는 시계(src/view_clock.js)는 멈춘 동안 흐르지 않고, 풀면 멈춘 그 자리에서 이어 간다 (앞으로 튐 · 몰아 흐름 없음) — 벽시계를 바꿔 끼워 잼
//  ② main.js frame: 일시정지 창 · 판 끝 결과 창이 떠 있으면(state 'paused' — 결과 창은 11/22 사장님 '권고대로') 한 장(dt 0)만 그린 뒤 돌아가고 · 무대 움직임은 싸움 · 무기 뽑기 · 알림 창에서만 ·
//     기운은 보는 시계로 · 겉모습만 도는 벽시계 셈(잔상 호 · 장식 진자 · 손 돌림 · 몸 그늘 · 권총 효과 · 등 뒤 알림)은 보는 시계로
//  실제 화면에서 그리기 수 · 무대 시계 · 보는 시계가 멈춤 동안 그대로인지는 tools/browser/pause_freeze.mjs (헤드리스 크롬)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { viewNow, holdView, viewHeld } from '../../src/view_clock.js';

const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('① 보는 시계: 멈춘 동안 그대로 · 풀면 멈춘 자리에서 이어 감', () => {
  const real = performance.now;
  let wall = 50_000;
  performance.now = () => wall;
  try {
    const t0 = viewNow();
    wall += 16;
    assert.equal(viewNow() - t0, 16, '멈추기 전에는 벽시계와 같이 흐른다');
    holdView(true);
    assert.ok(viewHeld());
    const held = viewNow();
    for (const step of [16, 1000, 60_000]) {
      wall += step;
      assert.equal(viewNow(), held, `멈춘 동안 ${step} ms 가 흘러도 그대로`);
    }
    holdView(true); // 거듭 불러도 한 번
    wall += 5;
    assert.equal(viewNow(), held);
    holdView(false);
    assert.ok(!viewHeld());
    assert.equal(viewNow(), held, '풀자마자 멈춘 자리 (앞으로 튀지 않음)');
    wall += 16;
    assert.equal(viewNow(), held + 16, '그다음은 다시 벽시계 빠르기로');
    holdView(false); // 거듭 풀어도 그대로
    assert.equal(viewNow(), held + 16);
    // 두 번째 멈춤도 같은 셈 (빠진 시간이 쌓임)
    holdView(true);
    wall += 3000;
    holdView(false);
    wall += 10;
    assert.equal(viewNow(), held + 26);
  } finally {
    performance.now = real;
  }
});

test('② main.js: 멈춤 창 · 결과 창이 떠 있으면 한 장만 그리고 셈 · 그리기를 쉰다 · 무대 · 기운은 멈춘 시계로', () => {
  const m = src('src/main.js');
  const frame = m.slice(m.indexOf('function frame(now)'), m.indexOf('// 메뉴 뒤 배경으로 보일 첫 판'));
  assert.ok(frame.length > 1000, 'frame() 을 찾음');
  const frozenAt = frame.indexOf("const frozen = state === 'paused';");
  assert.ok(frozenAt > 0, '멈춤 판정 (일시정지 창 · 판 끝 결과 창 — 11/22 결과 창도 한 장만 그리고 쉼)');
  assert.match(frame, /perf\?\.raf\(frozen && pauseOpen\)/, '성능 표 다음 판 멈칫은 사람이 연 멈춤만 뺀다 (결과 창은 예전처럼 센다)');
  const head = frame.slice(frozenAt, frame.indexOf('const frameMs'));
  assert.match(head, /holdView\(true\)/, '멈추면 보는 시계를 멈춘다');
  assert.match(head, /if \(frozenDrawn\) \{\s*last = now;\s*if \(!pauseOpen\) prepNextStage\(\);[^\n]*\n\s*return;/, '한 장 그린 뒤로는 셈 · 그리기 없이 돌아간다 (결과 창만 다음 무대를 화면 밖에서 미리 — 일시정지 창은 아무것도)');
  assert.match(head, /holdView\(false\)/, '풀면 보는 시계를 다시 흘린다');
  assert.match(frame, /let dt = frozen \? 0 :/, '멈춤에 든 한 장은 시간 0');
  assert.match(frame, /const paint = frozen \|\|/, '멈춤에 든 한 장은 늘 그린다');
  assert.match(frame, /a\.update\(viewNow\(\) \/ 1000\)/, '기운은 보는 시계');
  // 무대 움직임(arena.update)은 stageTick 한 곳 · stageTick 은 싸움 · 무기 뽑기 · 알림 창 갈래에서만
  assert.equal((m.match(/arena\.update\(/g) || []).length, 1, 'arena.update 는 stageTick 안 한 곳');
  const calls = frame.match(/stageTick\(dt\)/g) || [];
  assert.equal(calls.length, 3, '싸움 · 무기 뽑기 · 알림 창');
  assert.match(frame, /if \(state === 'draw'\) \{\s*updateDraw\(dt\);\s*stageTick\(dt\);\s*\} else if \(state === 'encounter'\) stageTick\(dt\);/);
  // 화면 크기가 바뀌면(캔버스가 지워짐) 멈춘 장면을 한 번 더
  assert.match(m, /function resize\(\) \{\s*frozenDrawn = false;/);
  // 겉모습만 도는 벽시계 셈은 보는 시계로
  for (const f of ['src/sword_trail.js', 'src/outfit_tuyana.js', 'src/hands.js', 'src/fighter_light.js', 'src/gun_fx.js', 'src/team_hud.js']) {
    const s = src(f);
    assert.match(s, /from '\.\/view_clock\.js'/, `${f} 가 보는 시계를 읽음`);
    assert.doesNotMatch(s, /performance\.now\(\)/, `${f} 에 벽시계가 남지 않음`);
  }
});
