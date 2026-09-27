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
| `node tools/sim/down_ai.mjs [판수] [적 무기id]` | AI가 쓰러진 플레이어를 마무리하는가: 상처 낸 판·첫 상처까지 시간·휘두름당 상처·상처 깊이 |
| `node tools/sim/tap_thrust.mjs [stand\|down\|duel\|all] [판수] [무기id]` | 탭 찌르기(skill.thrust) 검증: 처음 닿은 판정이 찌르기인지, 상처·상처 깊이, 상대 칼에 먼저 막혔는지 |
| 위 세 도구 공통: `--str=0.85` `--foeStr=1.3` `--emo=off` `--emoP=anger:1` `--emoE=fear:1` | 플레이어·상대 근력, 감정 능력 끄기(게임의 `?emo=0`), 플레이어·상대 감정 고정(감정:세기). `str_emo.mjs` 참고 |
| `node tools/sim/ai_thrust_pref.mjs [판수] [무기id...]` | AI가 찌르기 무기로 찌르기 기술을 더 고르는지 (고른 기술 비율, 찌르기 판정 수) |
| `node tools/sim/with_config.mjs STRIKE.thrustAssist=2.5 <스크립트> [인자...]` | 설정값 몇 개를 바꾼 채로 다른 시뮬 스크립트를 돌린다 (`true`/`false`는 불리언: `WHOLE.on=false`) |
| `node tools/sim/with_weapon.mjs estoc characters_eval.mjs both 3` | 모든 캐릭터에게 같은 무기를 쥐여 주고 다른 시뮬 스크립트를 돌린다 (근력·성격은 그대로, 브란의 대체 무기는 끔) |
| `node tools/sim/thrust_strength.mjs [판수] [무기id...]` | 기본 AI 근력만 0.85 / 1.0 / 1.3 으로 바꿔 가만히 겨눈 더미를 상대로 낸 찌르기·베기 상처(분당 수·깊이·에너지)와 처치 시간 |
| `node tools/sim/weapon_anatomy.mjs [duel\|dummy] [판수] [무기id...]` | 무기가 왜 이기고 지나: 몸 접촉마다 판정 전·후(상처 / 문턱 미달 / 칼 면), 문턱 대비 비율, 칼끝 속도, 유효 질량, 닿은 간격, 간격 띠별 시간, 첫 상처, AI 통계. `dummy` = 막지 않는 더미 상대 공격력 |
| `node tools/sim/weapon_tempo.mjs [무기id...] [--loop]` | 휘두름 빠르기: 손 목표를 두 자세 사이로 왕복(또는 `--loop` 타원으로 멈추지 않고)시키며 한 번 휘두르는 시간을 줄여 가며 칼날 70% 속도·베기 실효 에너지와 제 힘을 지키는 템포를 잰다 |
| `node tools/sim/tactic_probe.mjs <무기id> '<level json>' [판수]` | 무기 쪽 AI 에만 난이도 값(공격성 등)을 덮어써 롱소드와 붙인다. 같은 값을 롱소드끼리에도 줘 대조한다 |
| `node tools/sim/with_spec.mjs 'id.field=<json>' <스크립트> [인자...]` | 무기 스펙 필드를 잠깐 바꾼 채로 다른 시뮬 스크립트를 돌린다 (예: 찌르기 장점 thrustStyle 실험) |
| `node tools/sim/body_share.mjs [무기id...]` | 칼끝 속도 중 몸통(가슴·골반)이 만든 몫. 몸통 비틀기를 끄거나 크게 했을 때 칼 속도·에너지 변화 |
| `node tools/sim/chain_mass.mjs [무기id...]` | 칼 뒤에 실제로 실리는 질량: 물리 사슬(칼+손+팔+몸)의 유효 질량을 톡 밀어 재고 판정식(칼+0.3kg)과 견준다 |
| `node tools/sim/thrust_review.mjs [skill\|step\|down\|assist\|demote\|snap\|all] [--hybrid]` | 탭 찌르기 검토 지적 수정 전·후: 검술 보정별 찌르기, AI 두 번 내딛기, 찌르다 넘어짐, 팔 질량 싣는 구간·멍으로 바뀐 찌르기 에너지, 내리찌르기 끊김 |
| `node tools/sim/hybrid.mjs wholebody.mjs <부분> [N]` | 온몸 베기 측정 묶음 (docs/whole_body_strike.md L0·7장): `support` `cuts` `detect` `react` `combo` `sweep` `trunkoff` `strength` `power` `stand` `miss` `block` `react_body` `ai` `aistep` `tapstep` `duel` `defend` `hitstop` `feedcheck` (`aistep` = AI 대 AI 기술 걸음 하나하나의 발 이동·닿은 뒤 밀림(발에 실린 동안 / 전체)·다시 딛기, 더듬기(`stutter_pct`: 내디딘 발이 딛은 지 0.3초 안에 다른 발보다 먼저 다시 뜸, 걸음 종류·AI 모드·조이스틱별 `stutterBy`), 딛은 뒤 0.1~0.3초 그 발에 실린 몸무게(`lungeLoad`), 내딛는 동안 낸 상처 때 그 발이 딛고 있었나(`woundWhileLunge`), 딛지 못한 부탁의 까닭(`notLanded`), 같은 싸움의 보통 걸음과 견줌. `AITRACE=1`이면 다시 딛은 걸음의 까닭과 시간표를 찍는다. `AISEED=<판>`은 그 판부터, `AITRACE_T=<판>:<P|E>:<시작초>:<끝초>`는 그 싸움꾼의 모드·조이스틱·붙잡기 반사·골반·두 발 상태를 0.025초마다 찍는다. `tapstep` = 탭 찌르기 내딛기의 앞발 이동·무게중심 전진). 플레이어 입력은 모두 손가락 궤적 길(`harness_m.mjs` `feedTrace`: input.js → handOffset → skill.update, 60/90/120 Hz는 `HZ=`)로 넣는다. 층 끄기: `with_config.mjs WHOLE.chain=false hybrid.mjs wholebody.mjs cuts`. 결과 JSON은 `OUTDIR=`/`OUT=` |
| `node tools/sim/hybrid.mjs legs_gates.mjs <stand\|walk\|circle\|turn\|turnR\|mash\|getup\|push\|fight\|step\|all> [N]` | 다리 1.5 합격선 G1~G8·G10 (발이 받친 몸무게, 딛은 발 미끄러짐, 걷기·마구 흔들기 넘어짐, 제자리 돌기, 일어서기, AI 대결 넘어짐/선 채 분, requestStep 발 이동·밀림). `turnR` = 처음 방향·각도·쉬는 시간을 시드로 섞은 제자리 돌기(`turn`·`circle`·`push`는 난수를 안 써서 시드를 바꿔도 같은 판이다, `TRACE=<판>:<시작초>:<끝초>`로 두 발 상태를 찍는다). 걷기 방향·세기 고르기 `WDIRS=FR,FL WMAGS=1`. `MODE=levitate`로 견줌 |
| `node --expose-gc tools/sim/hybrid.mjs perf_ab.mjs [블록=10] [스텝=2000]` | G9 성능: 온몸 베기 켬/끔(`SWITCH=WHOLE.commit` 처럼 층 하나도)을 한 프로세스에서 번갈아 — 스텝 시간 비 평균·95% 구간, THREE 생성 수 차이, 힙 할당 차이(끔 두 벌끼리 잡음 바닥과 함께) |
| `node tools/sim/film_wholebody.cjs <장면> [hybrid\|levitate] [--off] [--size=844x390] [--out=폴더]` | 온몸 베기 연속 사진 (8장): 떠 있는 개발 서버(기본 5174)의 실제 게임을 수동 프레임 시계로, 손가락 궤적을 터치 이벤트로 넣는다. 폰 카메라·옆·앞 비스듬히 × 8칸, 칼끝·손·무게중심·발 자취와 칸별 수치. `--off` = 설정 '온몸 베기' 끔(전), `--fixoff` = `GAIT.fwdFix` 끔(R1 전). 장면 `walk-<F|FR|R|BR|B|BL|L|FL>`(조이스틱 1.2초 걷고 놓기), `tap-thrust`, `ai-step`(AI 기술 걸음, 찍히는 쪽 = AI), R2 결심 베기 `zornhau-stand` `pflug-zornhau` `pflug-hook` `oberhau-stand` `zwerch-stand` `unterhau-stand` `guard-change` |
| `node tools/sim/hybrid.mjs wholebody.mjs detect\|replay\|snap` (R2 결심) | `detect` = 결심 판정 표 (큰 긋기 22가지·들었다 베기·작은 V·자세 바꾸기 29가지 × 4~12 m/s × 60/90/120 Hz × 멈춤·떼기, 상대 공격 중). 가짜 1단계 늦어짐 = 칼끝이 출발 → 목표 거리의 80% 를 간 시각의 결심 켬 − 끔 (`noise` = 끈 긋기를 한 스텝 늦춰 잰 잡음 바닥). 나눠 돌리기 `DHZ=60` `DPART=big,fp,foe`. `replay` = 멈칫 뒤 흘려 넣은 조각(`TRACE_REPLAY`)으로 생긴 결심 수 (0 이어야). `snap` = 돌려주기 때 칼 튐 (획 끝 뒤 0.3초 칼끝 빠르기 / 그때 빠르기 > 1.5, `NOREBASE=1` 대조). `cuts` 의 `SHAPE=minjerk`(사람 손가락 모양, v = 평균 빠르기), `CUTFAMS=diagR` `CUTDIST=2.0` 로 줄여 돌리기. `cuts` 의 `handSpanB`(손 직선 이동, 감기 포함)·`arcTotal`(칼 호, 칼 젖히기부터) |
| `PATCH='{"STROKE":{"diagR":{"over":40}}}' node tools/sim/with_patch.mjs hybrid.mjs wholebody.mjs cuts` | 설정 객체 안쪽 값을 JSON 으로 덮어쓴 채 돌린다 (`with_config.mjs` 는 맨 위 값만) |
| `node tools/sim/hybrid.mjs live_battery.mjs commitcuts` · `DETECT=1 node tools/sim/hybrid.mjs dance.mjs` | 결심 판정을 켠 새 부분 (손 목표를 옮긴 만큼을 손가락 궤적으로도 넣는다). 기본 목록·기본 실행은 예전과 바이트까지 같다 |
| `SEED0=13 node tools/sim/fights12.mjs` | fights12 시드 묶음 바꾸기 (13~24판). 온몸 베기 합격선은 1/13/25/37/49 다섯 묶음 |
| `SOFF=1000 node tools/sim/hybrid.mjs wholebody.mjs aistep 12` | 시드 더하기: `harness_m.mjs`(`seedRandom`을 쓰는 도구 모두)와 `legs_gates.mjs`의 모든 시드에 더한다. 도구를 고치지 않고 다른 시드 묶음으로 다시 잰다 (0 = 예전과 같다) |
| (공용) `tools/sim/is_main.mjs` | 측정 도구의 "직접 실행" 확인 `isMain(import.meta.url)`과 감싸는 스크립트용 `simPath()` — with_config·hybrid·with_weapon·with_spec 로 감싸도 결과가 찍힌다 |

`jelly_harness.mjs` / `harness_m.mjs` 는 공용 무대(두 파이터 + 전투 판정)를 만든다.
