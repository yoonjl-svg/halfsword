// 스킬트리 칸 그림 (사장님 10/22 00:2x '기존에 가지고 있던 아이콘이 사라져서 서운한데? 우선 지금까지 만들어둔 것들 최대한 사용하고 보강해야 되는 아이콘은 새로 만들어')
//  옛 스킬북 그림 25 장(public/ui/books/<유파>_<급>.webp — 10/16 tools/browser/item_thumbs.mjs · 유파마다 문서 꼴 하나 · 급 = 볼륨 + 끈 색)을 칸 갈래대로 다시 쓴다:
//   보법 → 1급 · 막기 → 2급 · 고유 공격 → 3급 · 패시브 → 4급 · 비기 → 5급. 옛 책 급 = 칸 갈래의 stage(skill_tree_data.js NODE_CAT)이고, 끈 색 = 칸 위 띠 색(등급 색 --tier-*)이라 그대로 맞는다.
//  새로 찍은 열 장(같은 도구 · 같은 빛 · 같은 유파 틀 · 256 × 336 webp — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md §8):
//   편지 <유파>_letter — 그 유파 문서 집안의 접어 봉한 편지(끈 = ??? 청록 · 편지 갈래 색) ·
//   심화 <유파>_deep — 3급 문서 그대로 + 위에 놓인 깃펜 / 붓 (같은 줄 · 바로 위의 고유 공격 칸과 윤곽이 갈리게).
//  이 파일은 칸 자료(skill_tree_data.js)를 고치지 않는다 — 갈래만 읽는다. 그림은 꾸밈이라 화면에서 alt="" · aria-hidden (skill_tree.js).
export const ICON_ART = Object.freeze({ foot: '1', parry: '2', atk: '3', deep: 'deep', passive: '4', secret: '5', letter: 'letter' });
/** 칸 그림 주소 (public/ 기준 — wallet_icons.js 와 같은 꼴) */
export const nodeIconSrc = (school, node) => `ui/books/${school}_${ICON_ART[node.cat] ?? '1'}.webp`;
