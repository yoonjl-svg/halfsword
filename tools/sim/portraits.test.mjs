// 캐릭터 프로필 표 시험 (src/portraits.js — docs/import/portraits_px_2026-10-18.md · 전 판 docs/import/portraits_2026-10-17.md §5)
//  기본(pixel) = 샛별 새 투명 배경 도트판 33 장(얼터 16 명도 자기 그림 · 플레이어 = player2) · 예비 hd / low = 10/17 판 17 장(얼터는 바탕 인물 그림)
//  node --test tools/sim/portraits.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { PORTRAIT_IDS, BACKUP_PORTRAIT_IDS, portraitIdOf, portraitSrc, portraitMode, portraitGrid, PORTRAIT_GRID_SRC } = await import('../../src/portraits.js');
const pub = (src) => new URL(`../../public/${src}`, import.meta.url);

test('기본 판(pixel): 모든 인물 · 얼터가 자기 그림 (사장님 10/18 16:3x — 얼터까지 모두) · 그림 없는 상대는 null', () => {
  const ids = Object.keys(CHARACTERS_BY_ID);
  assert.ok(ids.length >= 32, `${ids.length}`);
  for (const id of ids) assert.equal(portraitIdOf(id), id, id);
  assert.equal(portraitIdOf('player'), 'player');
  for (const none of ['default', 'bear', '', null, undefined]) assert.equal(portraitIdOf(none), null, String(none)); // 기본 상대(?foe=default) · 동물 · 빈 값
});

test('예비 판(hd · low): 얼터는 바탕 인물 그림 (10/18 01:0x 판 그대로)', () => {
  for (const mode of ['hd', 'low']) {
    for (const id of Object.keys(CHARACTERS_BY_ID)) assert.equal(portraitIdOf(id, mode), CHARACTERS_BY_ID[id].variantOf || id, `${mode} ${id}`);
  }
});

test('그림 파일: 기본 33 장(768² WebP · 마스터 art/portraits-px-20261018) · 예비 hd / low 17 장 · 칸 줄 SVG — 주소 ?portrait=hd|low · ?portraitGrid=1', () => {
  assert.equal(PORTRAIT_IDS.length, 33); assert.equal(BACKUP_PORTRAIT_IDS.length, 17);
  for (const id of PORTRAIT_IDS) {
    assert.ok(fs.existsSync(pub(portraitSrc(id, 'pixel'))), id);
    assert.ok(fs.existsSync(new URL(`../../art/portraits-px-20261018/${id === 'player' ? 'player2' : id}.png`, import.meta.url)), id);
  }
  for (const id of BACKUP_PORTRAIT_IDS) for (const mode of ['hd', 'low']) assert.ok(fs.existsSync(pub(portraitSrc(id, mode))), `${mode} ${id}`);
  assert.ok(fs.existsSync(pub(PORTRAIT_GRID_SRC)));
  assert.equal(portraitSrc('heinrich_mad'), 'ui/portraits/heinrich_mad.webp'); // 주소 없음(노드) = 기본
  assert.equal(portraitSrc('player'), 'ui/portraits/player.webp');
  assert.equal(portraitSrc('heinrich_mad', 'hd'), 'encounters/portraits-hd-20261017/heinrich.webp');
  assert.equal(portraitSrc('artoria_mad', 'low'), 'encounters/portraits-frame1-20261017/low/artoria.png');
  assert.equal(portraitSrc('default'), null);
  assert.deepEqual(['?portrait=low', '?portrait=hd', '?portrait=original', '?x=1', ''].map(portraitMode), ['low', 'hd', 'pixel', 'pixel', 'pixel']);
  assert.deepEqual(['?portraitGrid=1', '?portraitGrid=0', ''].map(portraitGrid), [true, false, false]);
});
