// 캐릭터 프로필 그림 (사장님 10/17 22:1x · 22:2x · 23:0x — 샛별 저장소 786e102f 에서 들여옴, docs/import/portraits_2026-10-17.md · 화면 docs/design/portrait_ui_2026-10-17.md)
//  그림 = 정사각 · 액자 1(어두운 갈색 바깥 + 금색 이중선 + 네 모서리 네모 장식)이 그림 안에 그려져 있다 — 쓰는 곳에서 CSS 틀을 겹치지 않는다.
//  사장님 23:0x "원본으로 먼저 적용하고 low를 예비로 견줘볼게":
//   original(기본) = 원본 1254² 를 768² 로 줄인 WebP(LANCZOS · 품질 88 · method 6) — public/ui/portraits/<id>.webp · 설치 묶음에 든다 · 매끈하게 보임
//   low(예비)      = 4 px 덩어리 픽셀판 low.png 그대로 — public/encounters/portraits-frame1-20261017/low/<id>.png · encounters 라 설치 묶음에서 빠짐(온라인에서만) · 주소 ?portrait=low · 픽셀 그대로 보임
//   원본 PNG(2 MB · 기록용 마스터)는 art/portraits-frame1-20261017/ — 배포 · 설치 묶음 밖
//  우리 인물 id → 프로필 id: 같은 이름은 그대로 · 변형(밤 얼터 · 광기의 ○○ — characters.js variantOf)은 바탕 인물 그림 · 그림이 없는 상대(무작위 · 동물 · 그 밖)는 null
import { CHARACTERS_BY_ID } from './characters.js';

export const PORTRAIT_IDS = Object.freeze(['player', 'bran', 'isolde', 'artoria', 'chanda', 'eira', 'heinrich', 'liao', 'margarethe', 'minami', 'omari', 'ratna', 'renji', 'samira', 'silver_wanderer', 'terracotta', 'tome']);
const HAS = new Set(PORTRAIT_IDS);
export const PORTRAIT_FILES = Object.freeze({
  original: Object.freeze({ dir: 'ui/portraits/', ext: '.webp' }),
  low: Object.freeze({ dir: 'encounters/portraits-frame1-20261017/low/', ext: '.png' }),
});

/** 인물 id(또는 'player') → 프로필 id. 변형은 바탕 인물로(여러 겹이어도 따라감) · 그림이 없으면 null */
export function portraitIdOf(characterId) {
  let id = characterId, hops = 0;
  while (id && !HAS.has(id) && hops++ < 4) id = CHARACTERS_BY_ID[id]?.variantOf ?? null;
  return id && HAS.has(id) ? id : null;
}

/** 지금 보일 판: 'original'(기본 — 원본을 줄인 그림) · 'low'(?portrait=low — 예비 픽셀판, 사장님 견주기) */
export function portraitMode(search = typeof location === 'undefined' ? '' : location.search) {
  return new URLSearchParams(search).get('portrait') === 'low' ? 'low' : 'original';
}

/** 프로필 그림 주소 (페이지 기준 상대 주소 — vite base './'). 그림이 없는 인물이면 null */
export function portraitSrc(characterId, mode = portraitMode()) {
  const id = portraitIdOf(characterId), f = PORTRAIT_FILES[mode] ?? PORTRAIT_FILES.original;
  return id ? `${f.dir}${id}${f.ext}` : null;
}
