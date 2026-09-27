# 헤드리스 시뮬레이션 도구 (Node, 브라우저 없음)

실제 `src/` 코드를 그대로 불러와 1/120초 고정 스텝으로 돌린다. 결정적(같은 입력 → 같은 결과).
`npm install` 후 저장소 루트에서 실행:

| 스크립트 | 용도 |
|---|---|
| `node tools/sim/fights12.mjs` | AI 대 AI 12판: 사망 수, 넘어짐, 에너지 (치명도 회귀 기준: 7~8/12) |
| `node tools/sim/live_battery.mjs` | 칼 조작 수락 테스트 (끝 속도, 자세 유지 오차, 흔들림 등) |
| `node tools/sim/dance.mjs` | "춤추는 느낌" 측정: 떨리는 입력 / 느린 자세 이동 때 몸통 흔들림 |
| `node tools/sim/eval_m.mjs passive\|aiai\|aggro` | AI 평가: 가만히 있는 상대·AI끼리·돌진형 상대 (ai_old.mjs = 옛 AI 기준선) |
| `node tools/sim/weapon_smoke.mjs` | 무기고(src/weapons.js) 전체를 롱소드 상대로 6초씩 돌려 예외·NaN(물리 발산)만 훑는다 |
| `node tools/sim/weapon_balance.mjs [판수] [무기id...]` | 무기별 vs 롱소드 승률·평균 종료 시간을 잰다 (`newRound({weapon, weapon2})`로 서로 다른 무기를 쥐여준다). 무기id 생략 시 롱소드를 뺀 전체 |
| `node tools/sim/weapon_trace.mjs <무기A> <무기B> [seed]` | 두 무기를 AI 대 AI로 붙여 타격 하나하나(에너지·부위·칼날 어디서 맞았는지)를 그대로 찍어 본다 (밸런스 이상 원인 추적용) |

`jelly_harness.mjs` / `harness_m.mjs` 는 공용 무대(두 파이터 + 전투 판정)를 만든다.
