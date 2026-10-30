// 금화 · 머리 그림 — 대기실 지갑(lobby.js)과 결과 창 금화 줄(main.js showRewardLine)이 같은 그림을 쓴다 (사장님 10/16 14:0x '우리가 대기실에서 사용했던 금화 아이콘을 넣어')
//  매끈한 3D 그림 256 × 256 (사장님 10/16 15:3x ⑦ '금화와 주머니도 매끈하게 해' — 스타일 규칙 '겉은 픽셀, 속은 매끈', docs/design_language.md §5).
//  만드는 도구 tools/browser/item_thumbs.mjs (무기 카드 그림과 같은 빛 · 금속) — docs/import/item_art_2026-10-16.md. 크기는 쓰는 곳 CSS (.coin-icon · .reward img)
// 금화 — 여러 닢이 아무렇게나 쌓인 꼴 (사장님 ⑦ '동전이 여러 개 비정형적으로 쌓인 모습이면 더 좋겠어'). 스킬북 값 표지(skill_tree.js)도 같은 그림
export const COIN_SRC = 'ui/wallet/coins.webp';
export const COIN_ICON = `<img class="coin-icon" src="${COIN_SRC}" alt="금화" draggable="false">`;
// 머리 — 천 주머니 (사장님 10/16 04:3x '금화 옆에 천 주머니 모양으로 만들어'): 묶은 끈 · 위로 벌어진 주름 · 불룩한 몸 · 아래가 살짝 피에 젖음 (15:3x ⑧)
export const POUCH_SRC = 'ui/wallet/pouch.webp';
export const POUCH_ICON = `<img class="coin-icon pouch-icon" src="${POUCH_SRC}" alt="머리" draggable="false">`;
// 뿔피리 — 상점 재화 (사장님 10/30 19:0x "뿔피리는 '왕'을 잡으면 50% 확률로 얻어" — config.js SHOP): 굽은 소뿔 + 청동 띠 (tools/browser/item_thumbs.mjs horn — 금화 · 주머니와 같은 빛 · 금속)
export const HORN_SRC = 'ui/wallet/horn.webp';
export const HORN_ICON = `<img class="coin-icon horn-icon" src="${HORN_SRC}" alt="뿔피리" draggable="false">`;
