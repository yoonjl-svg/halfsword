# 일본 J8 손목 치기 심화 · 칼 떨구기 (2026-10-24)

사장님 10/24 11:4x ~ 12:0x 결정. 원문은 `docs/decisions.md` 10/24, 확인표는 2396 ~ 2399.

## 하는 일

- 손목 치기(강화동작 `kote`)가 칼을 쥔 손의 아래팔(손 · 손목)에 맞거나, 상대 칼의 손 쪽 절반(코등이 · 자루 쪽 포함)을 세게 치면, 두 번에 한 번꼴로(50 %) 상대가 칼을 떨어뜨린다.
  - 10/24 12:3x 판정 완화(확인표 2415 ~ 2418): 전에는 칼날로 베어 상처가 날 때만이었다. 칼면으로 맞아도 되고, 상대 칼을 쳐도 된다.
  - 손목 치기 한 번에 한 번만 굴린다.
- 못 떨어뜨리면 보통 맞음 그대로다.
- 사람만 쓴다. AI 가 모는 몸은 굴리지 않는다.
- 떨어진 칼은 줍지 않는다. 부활하는 인물만 일어설 때 칼이 돌아온다.
- 칼 없는 AI 는 치지 않는다. 물러나 간격을 벌리고, 막는 대신 피한다.

## 그림 (폰 가로 844 × 390 · 화면 배율 2)

| 파일 | 무엇 |
|---|---|
| `tree_j8_open.webp` | 일본 스킬트리 — J8 '칼 떨구기'가 '준비 중' 아닌 배울 수 있는 칸(금화 300) |
| `tree_j8_card.webp` | J8 상세 카드 — 제목 · 오의(오륜서 물의 권 단풍 치기) · 효과 한 줄 · 배우기 |
| `foe_disarmed.webp` | 손목 치기에 칼을 떨군 상대 — 칼이 발치 땅에 있고 두 손이 비었다 |

다시 찍기: `npx vite build --outDir <임시>/dist` · `node tools/pwa/build.mjs <임시>/dist` · `npx vite preview --outDir <임시>/dist --port 5493 --strictPort` → `node tools/browser/kote_drop_shots.mjs http://127.0.0.1:5493`

## 코드 자리

- 판정: `src/combat.js` `koteCheck`(`strike` — 아래팔 맞음) · `koteSword`(`bladeClash` — 상대 칼 손 쪽 절반) · `koteRoll`(굴림) · 값 `src/config.js` `UNIQUE_ASSIST.koteDrop`
- 칸: `src/skill_tree_data.js` J8(`perk: 'kote'`) · 떨굼: `src/fighter.js` `dropSword`
- 시험: `tools/sim/skill_tree.test.mjs` · `tools/sim/titles.test.mjs` · 재기: `tools/sim/kote_drop_duel.mjs`
