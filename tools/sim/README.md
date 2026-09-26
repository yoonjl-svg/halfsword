# 헤드리스 시뮬레이션 도구 (Node, 브라우저 없음)

실제 `src/` 코드를 그대로 불러와 1/120초 고정 스텝으로 돌린다. 결정적(같은 입력 → 같은 결과).
`npm install` 후 저장소 루트에서 실행:

| 스크립트 | 용도 |
|---|---|
| `node tools/sim/fights12.mjs` | AI 대 AI 12판: 사망 수, 넘어짐, 에너지 (치명도 회귀 기준: 7~8/12) |
| `node tools/sim/live_battery.mjs` | 칼 조작 수락 테스트 (끝 속도, 자세 유지 오차, 흔들림 등) |
| `node tools/sim/dance.mjs` | "춤추는 느낌" 측정: 떨리는 입력 / 느린 자세 이동 때 몸통 흔들림 |
| `node tools/sim/eval_m.mjs passive\|aiai\|aggro` | AI 평가: 가만히 있는 상대·AI끼리·돌진형 상대 (ai_old.mjs = 옛 AI 기준선) |

`jelly_harness.mjs` / `harness_m.mjs` 는 공용 무대(두 파이터 + 전투 판정)를 만든다.
