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
| `node tools/sim/weapon_balance.mjs [판수] [무기id...]` | 무기별 vs 롱소드 승률·평균 종료 시간·파손 판 수를 잰다 (`newRound({weapon, weapon2})`로 서로 다른 무기를 쥐여주고, `weapon_measures.mjs`의 실측 간격을 AI에 끼워 짧은 칼도 제 간격에서 싸우게 한다). 무기id 생략 시 롱소드를 뺀 전체 |
| `node tools/sim/weapon_measure.mjs [무기id...]` | 무기별 유파 간격(`measure`: contact/reach/clinch/cutTime)을 혼자 휘두르는 베기로 잰다 — 롱소드가 1.62가 되는 배율을 전체에 곱해 schools.js에 그대로 넣을 수 있는 값을 찍는다 |
| `node tools/sim/weapon_break_rate.mjs [무기id...]` | 무기 파손률 표준 측정: 죽지 않는 60초 경합(롱소드 상대, 양쪽 자리 25판씩)에서 한 판에 부러진 비율. `TIER=rare`로 등급 강제, `DUMP=1`로 충돌 충격량 목록 |
| `node tools/sim/weapon_tech_reach.mjs [무기id...]` | 무기 × 기술별 `TECH[].reach` 제안값(원래 롱소드 값 + 무기 차이). 롱소드 자기 검증으로 못 재는 기술은 '(불안정)'으로 걸러낸다 |
| `node tools/sim/weapon_trace.mjs <무기A> <무기B> [seed]` | 두 무기를 AI 대 AI로 붙여 타격 하나하나(에너지·부위·칼날 어디서 맞았는지)를 그대로 찍어 본다 (밸런스 이상 원인 추적용) |

`jelly_harness.mjs` / `harness_m.mjs` 는 공용 무대(두 파이터 + 전투 판정)를 만든다.
