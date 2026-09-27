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
| `node tools/sim/down_hits.mjs [판수] [무기id] [--stand]` | 쓰러진 상대에게 스크립트로 내려베기·사선 베기·아래로 찌르기 → 닿는 거리(0.45~1.35m)별 상처율과 안 들어간 이유(미접촉·문턱 미달·칼 면·칼자루). `--stand` = 서 있는 상대 대조 실험 |
| `node tools/sim/down_ai.mjs [판수] [적 무기id]` | AI가 쓰러진 플레이어를 마무리하는가: 상처 낸 판·첫 상처까지 시간·휘두름당 상처·상처 깊이 (쓰러뜨린 뒤 2.5초 + 주어진 초까지 잰다) |
| `node tools/sim/down_diag.mjs [판수] [적 무기id] [초] [방향...] [--v]` | down_ai 와 같은 판에서 왜 못 끝내나: AI 가 보는 거리 분포·AI 단계 분포·휘두를 때 거리와 칼날~몸통 최소 거리·상처 난 순간의 거리·발 디딤. `--downM=닿는,사거리,붙음` 은 실험용(간격 표를 바꿔 끼움) |
| `node tools/sim/tap_thrust.mjs [stand\|down\|duel\|all] [판수] [무기id]` | 탭 찌르기(skill.thrust) 검증: 처음 닿은 판정이 찌르기인지, 상처·상처 깊이, 상대 칼에 먼저 막혔는지 |
| 위 세 도구 공통: `--str=0.85` `--foeStr=1.3` `--emo=off` `--emoP=anger:1` `--emoE=fear:1` | 플레이어·상대 근력, 감정 능력 끄기(게임의 `?emo=0`), 플레이어·상대 감정 고정(감정:세기). `str_emo.mjs` 참고 |
| `node tools/sim/ai_thrust_pref.mjs [판수] [무기id...]` | AI가 찌르기 무기로 찌르기 기술을 더 고르는지 (고른 기술 비율, 찌르기 판정 수) |
| `node tools/sim/with_config.mjs STRIKE.thrustAssist=2.5 <스크립트> [인자...]` | 설정값 몇 개를 바꾼 채로 다른 시뮬 스크립트를 돌린다 |
| `node tools/sim/with_weapon.mjs estoc characters_eval.mjs both 3` | 모든 캐릭터에게 같은 무기를 쥐여 주고 다른 시뮬 스크립트를 돌린다 (근력·성격은 그대로, 브란의 대체 무기는 끔) |
| `node tools/sim/thrust_strength.mjs [판수] [무기id...]` | 기본 AI 근력만 0.85 / 1.0 / 1.3 으로 바꿔 가만히 겨눈 더미를 상대로 낸 찌르기·베기 상처(분당 수·깊이·에너지)와 처치 시간 |
| `node tools/sim/weapon_anatomy.mjs [duel\|dummy] [판수] [무기id...]` | 무기가 왜 이기고 지나: 몸 접촉마다 판정 전·후(상처 / 문턱 미달 / 칼 면), 문턱 대비 비율, 칼끝 속도, 유효 질량, 닿은 간격, 간격 띠별 시간, 첫 상처, AI 통계. `dummy` = 막지 않는 더미 상대 공격력 |
| `node tools/sim/weapon_tempo.mjs [무기id...] [--loop]` | 휘두름 빠르기: 손 목표를 두 자세 사이로 왕복(또는 `--loop` 타원으로 멈추지 않고)시키며 한 번 휘두르는 시간을 줄여 가며 칼날 70% 속도·베기 실효 에너지와 제 힘을 지키는 템포를 잰다 |
| `node tools/sim/tactic_probe.mjs <무기id> '<level json>' [판수]` | 무기 쪽 AI 에만 난이도 값(공격성 등)을 덮어써 롱소드와 붙인다. 같은 값을 롱소드끼리에도 줘 대조한다 |
| `node tools/sim/with_spec.mjs 'id.field=<json>' <스크립트> [인자...]` | 무기 스펙 필드를 잠깐 바꾼 채로 다른 시뮬 스크립트를 돌린다 (예: 찌르기 장점 thrustStyle 실험) |
| `node tools/sim/body_share.mjs [무기id...]` | 칼끝 속도 중 몸통(가슴·골반)이 만든 몫. 몸통 비틀기를 끄거나 크게 했을 때 칼 속도·에너지 변화 |
| `node tools/sim/hit_phase.mjs [판수] [무기A] [무기B]` | 한 방이 왜 가벼운가: AI 대 AI 대결에서 몸에 닿은 순간마다 그 휘두름 최고 속도 대비 비율·느려지는 중·손목 제동 중·몸통 몫·닿은 칼날 지점·에너지·맞은 쪽 밀림(상처/멍 따로) |
| `node tools/sim/chain_mass.mjs [무기id...]` | 칼 뒤에 실제로 실리는 질량: 물리 사슬(칼+손+팔+몸)의 유효 질량을 톡 밀어 재고 판정식(칼+0.3kg)과 견준다 |
| `node tools/sim/thrust_review.mjs [skill\|step\|down\|assist\|demote\|snap\|all] [--hybrid]` | 탭 찌르기 검토 지적 수정 전·후: 검술 보정별 찌르기, AI 두 번 내딛기, 찌르다 넘어짐, 팔 질량 싣는 구간·멍으로 바뀐 찌르기 에너지, 내리찌르기 끊김 |
| (공용) `tools/sim/is_main.mjs` | 측정 도구의 "직접 실행" 확인 `isMain(import.meta.url)`과 감싸는 스크립트용 `simPath()` — with_config·hybrid·with_weapon·with_spec 로 감싸도 결과가 찍힌다 |

`jelly_harness.mjs` / `harness_m.mjs` 는 공용 무대(두 파이터 + 전투 판정)를 만든다.
