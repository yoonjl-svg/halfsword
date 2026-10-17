// 캐릭터 프로필 표 시험 (src/portraits.js — docs/import/portraits_2026-10-17.md §5): 모든 인물 · 변형(얼터)이 그림으로 이어지고 그림 파일이 있다
//  node --test tools/sim/portraits.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { PORTRAIT_IDS, portraitIdOf, portraitSrc, portraitMode } = await import('../../src/portraits.js');

test('모든 인물 · 변형 → 그림: 변형(밤 얼터 · 광기의 ○○)은 바탕 인물 그림을 함께 씀 (사장님 10/18 01:0x) · 그림 없는 상대는 null', () => {
  const ids = Object.keys(CHARACTERS_BY_ID);
  assert.ok(ids.length >= 32, `${ids.length}`);
  for (const id of ids) {
    const base = CHARACTERS_BY_ID[id].variantOf;
    assert.equal(portraitIdOf(id), base || id, id);
  }
  assert.equal(portraitIdOf('player'), 'player');
  for (const none of ['default', 'bear', '', null, undefined]) assert.equal(portraitIdOf(none), null, String(none)); // 기본 상대(?foe=default) · 동물 · 빈 값
});

test('그림 파일 17 장씩: 기본 768² WebP · 예비 low · 원본 마스터 — 주소 스위치 ?portrait=low', () => {
  assert.equal(PORTRAIT_IDS.length, 17);
  for (const id of PORTRAIT_IDS) {
    for (const mode of ['original', 'low']) {
      const src = portraitSrc(id, mode);
      assert.ok(fs.existsSync(new URL(`../../public/${src}`, import.meta.url)), src);
    }
    assert.ok(fs.existsSync(new URL(`../../art/portraits-frame1-20261017/${id}.png`, import.meta.url)), id);
  }
  assert.equal(portraitSrc('heinrich_mad'), 'ui/portraits/heinrich.webp'); // 주소 없음(노드) = 기본
  assert.equal(portraitSrc('artoria_mad', 'low'), 'encounters/portraits-frame1-20261017/low/artoria.png');
  assert.equal(portraitSrc('default'), null);
  assert.deepEqual(['?portrait=low', '?portrait=original', '?x=1', ''].map(portraitMode), ['low', 'original', 'original', 'original']);
});
