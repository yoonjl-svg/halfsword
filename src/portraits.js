// 캐릭터 프로필 그림 (화면 docs/design/portrait_ui_2026-10-17.md · 들여옴 docs/import/portraits_px_2026-10-18.md · 전 판 docs/import/portraits_2026-10-17.md)
//  그림 = 정사각 · 액자 1(금색 이중선 + 네 모서리 장식)이 그림 안에 그려져 있다 — 쓰는 곳에서 CSS 틀을 겹치지 않는다(바탕은 쓰는 곳의 어두운 네모 #30261c).
//  사장님 10/18 16:3x "샛별이 새 캐릭터 프로필 얼터까지 모두 그렸어. 가져와서 적용하고 플레이어 프로필은 '플래이어2'로 사용해. 배경이 투명한 것으로 하되 …":
//   pixel(기본) = 샛별 저장소 pixel-profiles-low128 의 low.png(22 × 22 칸 도트 · 배경 투명) → 768² WebP — public/ui/portraits/<id>.webp · 설치 묶음에 든다
//                 얼터(광기의 ○○) 16 명도 자기 그림 · 플레이어 = player2 그림 (tools/ui/portraits_px_build.py · 마스터 art/portraits-px-20261018/)
//                 + 손님 인물 셋 10/24 확정본 (마스터 art/hero-profiles-20261024/<id>/low.png — 아래 GUEST_IDS)
//  우리 인물 id → 프로필 id: 판에 그림이 있으면 그대로 · 없으면 변형(characters.js variantOf)의 바탕 인물 · 그림이 없는 상대(기본 상대 ?foe=default · 동물 …)는 null
//   — 시험 tools/sim/portraits.test.mjs
import { CHARACTERS_BY_ID } from './characters.js';

const BASE_IDS = ['player', 'bran', 'isolde', 'artoria', 'chanda', 'eira', 'heinrich', 'liao', 'margarethe', 'minami', 'omari', 'ratna', 'renji', 'samira', 'silver_wanderer', 'terracotta', 'tome'];
const ALTER_IDS = ['heinrich_mad', 'eira_mad', 'liao_mad', 'margarethe_mad', 'isolde_mad', 'tome_mad', 'omari_mad', 'bran_mad', 'minami_mad', 'ratna_mad', 'chanda_mad', 'renji_mad', 'terracotta_mad', 'silver_wanderer_mad', 'samira_mad', 'artoria_mad'];
// 손님 인물 셋(롤랑 · 백린의 전사 · 베르나르도 — 방랑 전용): 사장님 10/24 "샛별이가 프로필 사진 보냈대. 모두 적용해." → 샛별 저장소 손그림 확정본
//  (같은 22 × 22 칸 · 액자 1 · 투명 바탕 · 마스터 art/hero-profiles-20261024/<id>/low.png → tools/ui/portraits_px_build.py · docs/import/hero_profiles_import_2026-10-24.md).
//  베르나르도 그림 = 10/24 복식 수정본(샛별 저장소 100a5971 — 흰 금테 겉옷 · 금관 쓴 검은 사자 · 금빛 망토 · 얼굴 그대로)으로 지금 모델 v2 와 같은 옷
//  (전 판은 v1 복식 — docs/import/bernardo_whip_import_2026-10-24.md)
const GUEST_IDS = ['roland', 'white_scale', 'bernardo'];
/** 손님 인물 그림 id (위) */
export const GUEST_PORTRAIT_IDS = Object.freeze([...GUEST_IDS]);
// 임시 그림 (게임 모델을 찍어 도트 프로필 꼴로 줄인 그림 — tools/browser/portrait_temp_shots.mjs → tools/ui/portraits_temp_build.py): 지금은 없음.
//  10/23 손님 인물 셋의 임시 그림은 10/24 확정본으로 바뀜(옛 마스터 art/portraits-temp-20261023/ 는 기록으로 둠). 새 인물에 그림이 없으면 여기에 두고, 진짜 그림이 오면 뺀다.
const TEMP_IDS = [];
/** 임시 그림 id (위) */
export const TEMP_PORTRAIT_IDS = Object.freeze([...TEMP_IDS]);
// 쥘리아 크리스테바 · 광기의 쥘리아 크리스테바 (10/30 샛별 저장소 전달 C-JULIA-20261030 — 손그림 확정본 · 같은 22 × 22 칸 · 액자 1 · 투명 바탕):
//  마스터 art/julia-profiles-20261030/<id>/low.png → tools/ui/portraits_px_build.py (docs/import/julia_import_2026-10-30.md)
const JULIA_IDS = ['julia', 'julia_mad'];
/** 쥘리아 둘 그림 id (위) */
export const JULIA_PORTRAIT_IDS = Object.freeze([...JULIA_IDS]);
/** 그림이 있는 id 38 (바탕 17 + 얼터 16 + 손님 3 + 쥘리아 2) */
export const PORTRAIT_IDS = Object.freeze([...BASE_IDS, ...ALTER_IDS, ...GUEST_IDS, ...TEMP_IDS, ...JULIA_IDS]);
const PORTRAIT_DIR = 'ui/portraits/'; // 768² WebP
const HAS = new Set(PORTRAIT_IDS);

/** 인물 id(또는 'player') → 프로필 id. 그림이 없으면 변형의 바탕 인물로(여러 겹이어도 따라감) · 끝내 없으면 null */
export function portraitIdOf(characterId) {
  let id = characterId, hops = 0;
  while (id && !HAS.has(id) && hops++ < 4) id = CHARACTERS_BY_ID[id]?.variantOf ?? null;
  return id && HAS.has(id) ? id : null;
}

/** 프로필 그림 주소 (페이지 기준 상대 주소 — vite base './'). 그림이 없는 인물이면 null */
export function portraitSrc(characterId) {
  const id = portraitIdOf(characterId);
  return id ? `${PORTRAIT_DIR}${id}.webp` : null;
}
