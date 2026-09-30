# 헤드리스 시뮬레이션 도구 (Node, 브라우저 없음)

실제 `src/` 코드를 그대로 불러와 1/120초 고정 스텝으로 돌린다. 결정적(같은 입력 → 같은 결과).
`npm install` 후 저장소 루트에서 실행:

## 관문과 소음 폭
- 체중 방식 기본값(`BODY.weightMode`)은 게임과 같은 `hybrid`다(9/29 감사 R-003). 그 전 levitate 기본값으로 잰 숫자와 곧바로 견주지 않는다. 옛 숫자를 다시 보려면 `node tools/sim/with_config.mjs BODY.weightMode=levitate <스크립트>`.
- 게임 불변 관문: 바꾸기 전·후 stdout 이 바이트 같아야 한다(`cmp`, 기록은 sha256).
  - `node tools/sim/fights12.mjs` (기본 hybrid, 예전 `hybrid.mjs fights12.mjs`와 바이트 같다)
  - `node tools/sim/live_battery.mjs`
  - 기준 sha256 앞 8자리: 9/29 hybrid 기본값 fights12 `afdd8c66` · live_battery `11433650` → **9/30 시작 거리 7.0·2초 정지 뒤(ARENA.startGap·startHold): fights12 `a74bb59c` · live_battery `2f453e0b`** → **9/30 09:10 시작 거리 5.6 뒤: fights12 `38fb5b51` · live_battery `2f453e0b`** (hybrid.mjs fights12.mjs 도 같다) → **9/30 14:30 되튐 통합·판금 이동 ×0.8 뒤: fights12 `12223139`** (live_battery 는 다시 재지 않음). 옛 기준은 `with_config.mjs ARENA.startGap=4.2 ARENA.startHold=0 <스크립트>` 로 바이트 그대로 나온다.
  - **10/1 새 본판 기준 (사장님 9/30 23:40 관절 한도·자기 몸 충돌 켬, `BODY.humanLimits` 기본 true, feat-corr)**: 기본값 `node tools/sim/fights12.mjs` = `5613b5b9` · `node tools/sim/live_battery.mjs` = `37f25f76` (두 번 돌려 같음). 한도 끔 = 오늘 = 옛 기준: `node tools/sim/with_config.mjs BODY.humanLimits=false fights12.mjs` = `12223139` · 같은 깃발 `live_battery.mjs` = `2f453e0b`. 보정 스위치는 AI 판을 바꾸지 않는다: `SKILL.corr=v2` 를 더해도 fights12 는 두 경우 모두 같다(AI 는 `SKILL.corrAI` 'old'). 명령·해설 전체는 `docs/strike/corr_baselines.md`. 이 뒤 모든 실행은 이 값을 재현해야 한다(한도 쪽 버그를 고칠 때만, 까닭을 옆에 적고 다시 잰다).
  - **보정 v2 관문 (feat-corr)**: 한도 끔 = 오늘 = `12223139` / `2f453e0b` (`with_config.mjs BODY.humanLimits=false`, 보정 `SKILL.corr=old SKILL.corrAI=old` 를 더해도 같다) · `with_config.mjs BODY.humanLimits=false SKILL.corr=v2 fights12.mjs` = `12223139` · 기본값(한도 켬) = 새 본판 기준 `5613b5b9` / `37f25f76`, `SKILL.corr=v2` fights12 도 `5613b5b9` · `node tools/sim/corr_s0.mjs --limits=off,on` = 12/12 IDENTICAL (새 보정 설정 0 = 옛 설정 0, 끝점 겨눔 켬, 플레이어·AI 장면), `--s=0.4` 는 달라야 통과(v2 가지가 산다). 10/1 통합에서 다시 돌려 모두 같음.
  - 시작 정지는 시뮬에도 걸린다: 싸움꾼마다 `fightT`(fighter.step 이 센다)로 재서 판을 새로 만든 뒤 처음 2초는 조종 입력·기술 걸음·자세 고쳐 딛기가 없다(팔·칼·균형 걸음은 그대로). 판 초반을 재는 도구는 이 2초를 감안한다.
- **소음 폭**: fights12(12판)는 바이트 동일 관문 전용이다. 좋아졌다/나빠졌다로 읽지 않는다. 설정 하나를 100만분의 1 바꿔도(`BODY.uprightStiffness=2500.001`) 사망이 levitate 9/12 → 11/12, hybrid 8/12 → 7/12로 움직였다. 36판도 사망 24~27, 플레이어 승 12~19로 흔들린다(감사 9/29). 좋다/나쁘다 판단은 36판 이상으로 하고, 시드 묶음을 바꿔 돈 흔들림 폭을 함께 적는다.

## 스크립트

| 스크립트 | 용도 |
|---|---|
| `node tools/sim/fights12.mjs` | AI 대 AI 12판: 사망 수, 넘어짐, 에너지. 바이트 동일 관문 전용(위 '소음 폭') |
| `node tools/sim/live_battery.mjs` | 칼 조작 수락 테스트 (끝 속도, 자세 유지 오차, 흔들림 등) · `with_config SKILL.corr=v2` 로 돌리면 기준 칼 방향(aimOf·fa)이 v2 가지를 따른다(옛 출력 바이트 같음) |
| `node tools/sim/dance.mjs` | "춤추는 느낌" 측정: 떨리는 입력 / 느린 자세 이동 때 몸통 흔들림 |
| `node tools/sim/eval_m.mjs passive\|aiai\|aggro` | AI 평가: 가만히 있는 상대·AI끼리·돌진형 상대 (ai_old.mjs = 옛 AI 기준선) |
| `node tools/sim/weapon_smoke.mjs` | 무기고(src/weapons.js) 전체를 롱소드 상대로 6초씩 돌려 예외·NaN(물리 발산)만 훑는다 |
| `node tools/sim/ref_duel.mjs [vs\|field] [판수(자리마다)] [무기id...] [--seed=첫번호] [--levitate] [--proxy=ls] [--hero] [--json]` | **기준 하니스**(디렉터 10라운드 A6, 기본 hybrid). vs = 무기 X 대 롱소드(캐릭터 무기는 그 캐릭터가, 나머지는 주인공 대리가 쥔다. `--hero`면 캐릭터 무기도 주인공 대리가), field = 주인공 대리가 X로 캐릭터 다섯을 상대. 승·패·무, 윌슨 95% 구간, 파손. 간격은 게임 그대로(applyWeaponMeasure 안 씀) |
| `node tools/sim/weapon_league.mjs run [판수(자리마다)] [조각] [조각수] > 조각.jsonl` · `report 조각…` | **무기 리그전**(사장님 밸런스 기준, 기본 hybrid): 무기 14종 91짝을 모두 붙인다(두 쪽 다 주인공 대리). 승률 표, 등급 평균(쓰레기 < 커먼 < 레어 < 에픽 < 레전드 순서인지), 상성(이기는·지는 상대가 없는 무기), 의외성(짝마다 약한 쪽 승률, 0%인 짝) |
| `node tools/sim/flow_eval.mjs [판수(자리마다)] [무기X] [무기Y] [--flow] [--levitate] [--seed=첫번호] [--json]` | 흐름(SKILL.flow) 판정(디렉터 10라운드 D, 기본 hybrid): AI 대 AI(주인공 대리 둘) 승·패·무, 첫 상처 × 결과 교차표(첫 상처를 낸 쪽이 몇 % 이기나), 판당 공격·이어 치기·흐름·닿음, 간격 안 머문 비율 |
| `node tools/sim/weapon_balance.mjs [판수] [무기id...] [--seed=첫번호]` | 무기별 vs 롱소드 승률·평균 종료 시간·파손 판 수를 잰다 (시드 1000+s·2000+s, `--seed`로 다른 판 묶음) (`newRound({weapon, weapon2})`로 서로 다른 무기를 쥐여주고, `weapon_measures.mjs`의 실측 간격을 AI에 끼워 짧은 칼도 제 간격에서 싸우게 한다). 무기id 생략 시 롱소드를 뺀 전체 |
| `node tools/sim/weapon_measure.mjs [무기id...]` | 무기별 유파 간격(`measure`: contact/reach/clinch/cutTime)을 혼자 휘두르는 베기로 잰다 — 롱소드가 1.62가 되는 배율을 전체에 곱해 schools.js에 그대로 넣을 수 있는 값을 찍는다 |
| `node tools/sim/weapon_break_rate.mjs [무기id...]` | 무기 파손률 표준 측정: 죽지 않는 60초 경합(롱소드 상대, 양쪽 자리 25판씩)에서 한 판에 부러진 비율. `TIER=rare`로 등급 강제, `DUMP=1`로 충돌 충격량 목록 |
| `node tools/sim/weapon_break_check.mjs [--weapons=a,b] [--at=3]` | 무기 파손(칼날 끝쪽이 떨어져 나감) 점검: 콜라이더 끝=절단선, 절단선 위 보이는 꼭짓점 0, 파편이 사라지는지, NaN, AI 간격, 판 바뀜 정리 |
| `node tools/sim/break_trace.mjs fights12.mjs` | 다른 시뮬을 그대로 돌리며 무기가 부러진 판·자리·스텝을 적는다 (부러진 판만 달라졌는지 가를 때) |
| `node tools/sim/broken_duel.mjs 24 short longsword` | 판 시작부터 부러진 무기의 60초 경합 승률 (intact·blunt(예전)·short(지금) 비교, 윌슨 95%) |
| `node tools/sim/weapon_tech_reach.mjs [무기id...]` | 무기 × 기술별 `TECH[].reach` 제안값(원래 롱소드 값 + 무기 차이). 롱소드 자기 검증으로 못 재는 기술은 '(불안정)'으로 걸러낸다 |
| `node tools/sim/weapon_trace.mjs <무기A> <무기B> [seed]` | 두 무기를 AI 대 AI로 붙여 타격 하나하나(에너지·부위·칼날 어디서 맞았는지)를 그대로 찍어 본다 (밸런스 이상 원인 추적용) |
| `node tools/sim/down_hits.mjs [판수] [무기id] [--stand]` | 쓰러진 상대에게 스크립트로 내려베기·사선 베기·아래로 찌르기 → 닿는 거리(0.45~1.35m)별 상처율과 안 들어간 이유(미접촉·문턱 미달·칼 면·칼자루). `--stand` = 서 있는 상대 대조 실험 |
| `node tools/sim/down_ai.mjs [판수] [적 무기id]` | AI가 쓰러진 플레이어를 마무리하는가: 상처 낸 판·첫 상처까지 시간·휘두름당 상처·상처 깊이 (쓰러뜨린 뒤 2.5초 + 주어진 초까지 잰다) |
| `node tools/sim/down_diag.mjs [판수] [적 무기id] [초] [방향...] [--v]` | down_ai 와 같은 판에서 왜 못 끝내나: AI 가 보는 거리 분포·AI 단계 분포·휘두를 때 거리와 칼날~몸통 최소 거리·상처 난 순간의 거리·발 디딤. `--downM=닿는,사거리,붙음` 은 실험용(간격 표를 바꿔 끼움) |
| `node tools/sim/tap_thrust.mjs [stand\|down\|duel\|all] [판수] [무기id] [--seed=첫번호]` | 탭 찌르기(skill.thrust) 검증: 처음 닿은 판정이 찌르기인지, 상처·상처 깊이, 상대 칼에 먼저 막혔는지. 탭 결과 네 갈래(상처 / 칼에 걸렸고 상처 없음 / 몸에만 닿음 / 아무것도 못 닿음), 못 닿은 탭의 까닭(거리 모자람·내딛은 거리 / 옆으로 빗나감), duel 은 탭 연타 판 결과(이김·짐·무)도 |
| 위 세 도구 공통: `--str=0.85` `--foeStr=1.3` `--emo=off` `--emoP=anger:1` `--emoE=fear:1` | 플레이어·상대 근력, 감정 능력 끄기(게임의 `?emo=0`), 플레이어·상대 감정 고정(감정:세기). `str_emo.mjs` 참고 |
| `node tools/sim/revive_check.mjs [판수=16]` | 부활(이졸데, `src/revive.js`) 점검: 이졸데 대 주인공 대리(hybrid). 부활은 한 번만, 4초 안에 칼을 쥐고 다시 선다, 부활 중 상처 0, 다시 싸울 때 집념, 두 번째 죽음은 진짜 죽음, NaN 없음. 갈래: 자연·칼 놓침·칼 부러짐·둘 다(강제), 부활 중 주인공 대리 죽음 |
| `node tools/sim/decap_check.mjs [probe\|fights]` | 참수(사장님 9/30, `COMBAT.decapitate`, fighter.js `decapitate`) 점검. probe = 가만히 선 상대의 목을 벤다(실제 휘두르기를 찾고, 첫 접촉이 치명 목 베기가 아니면 칼을 목으로 몬다): 목 관절 떨어짐(관절 수), 목 자리 틈 1초에 0.3 m 넘게, 3초 동안 최고 속도·NaN, 남은 몸은 인형 그대로, 죽음·참수·목 단면 상처(출혈 = 목 상처), 이졸데 시트면 부활 안 함·횟수 그대로, 스위치 끄면 머리 붙어 있고 이졸데가 되살아남. 둔기·칼 면·못 지나간 목 베기·튕긴 길 pass·찌르기·죽은 몸·권총 목 → 참수 없음. fights = fights12 와 같은 12판(베낌, 줄마다 fights12 표기도 찍는다): 시드마다 참수된 쪽·끝·죽은 까닭, 합계 참수·죽음·NaN·튕긴 길 치명 목 베기 수. 끄고 돌리려면 `with_config.mjs COMBAT.decapitate=false decap_check.mjs fights` |
| `node tools/sim/ai_thrust_pref.mjs [판수] [무기id...]` | AI가 찌르기 무기로 찌르기 기술을 더 고르는지 (고른 기술 비율, 찌르기 판정 수) |
| `node tools/sim/with_config.mjs STRIKE.thrustAssist=2.5 <스크립트> [인자...]` | 설정값 몇 개를 바꾼 채로 다른 시뮬 스크립트를 돌린다 |
| `node tools/sim/hybrid.mjs <스크립트> [인자...]` | 옛 명령줄용 빈 래퍼: 아무것도 바꾸지 않는다(기본값이 이미 hybrid). 새 명령에는 쓰지 않는다 |
| `node tools/sim/with_weapon.mjs estoc characters_eval.mjs both 3` | 모든 캐릭터에게 같은 무기를 쥐여 주고 다른 시뮬 스크립트를 돌린다 (근력·성격은 그대로, 브란의 대체 무기는 끔) |
| `node tools/sim/thrust_strength.mjs [판수] [무기id...]` | 기본 AI 근력만 0.85 / 1.0 / 1.3 으로 바꿔 가만히 겨눈 더미를 상대로 낸 찌르기·베기 상처(분당 수·깊이·에너지)와 처치 시간 |
| `node tools/sim/weapon_anatomy.mjs [duel\|dummy] [판수] [무기id...] [--seed=첫번호]` | 무기가 왜 이기고 지나: 몸 접촉마다 판정 전·후(상처 / 문턱 미달 / 칼 면), 문턱 대비 비율, 칼끝 속도, 유효 질량, 닿은 간격, 간격 띠별 시간, 첫 상처, AI 통계. `dummy` = 막지 않는 더미 상대 공격력 |
| `node tools/sim/armor_eval.mjs [dummy\|duel\|both\|probe] [판수] [캐릭터id...]` | 방어구(투구·판금, config.js `ARMOR`)를 끈 판과 켠 판을 같은 시드로 견준다: 가만히 선 더미(대상 겉모습) 처치 시간, AI 대 AI 대칭 승률, 방어구가 파손된(곁 조각이 떨어져 나간)·완전히 부서진 판 비율(참고로 방어구에 제대로 된 타격을 한 번이라도 받은 판 비율도), 조각마다 부서질 때까지 맞은 수(제대로 된 타격 = `ARMOR.solidJ` 이상)와 첫·둘째 타격을 막았나. `DUEL_S=90` 대결 길이(게임은 판 시간 제한이 없다), `SEED0=101` 시드 시작. `[보이는 부서짐]` 줄 = 방어구를 입은 쪽이 진 판, 가만히 선 더미 판 가운데 눈에 띄는 조각이 떨어져 나간 판 비율(관문이 아니라 보고만 한다, 예전 기준 50% / 60%) — 가는 줄(마르그레테 가슴 이음매·하인리히 가슴 금줄 — 대상마다 맨 앞에 무엇을 뺐는지 찍는다)만 떨어진 판은 빼고 센 값과 줄까지 센 값, `[보이는 부서짐 참고]` = 방어구에 한 번도 닿지 않은 판·맨머리/목 한 방에 죽은 판·방어구에 닿은 판 가운데 부서진 판. `probe` = 싸움 없이 한 부위를 같은 타격(60·100·150J 베기, 라이트세이버, 롱소드·에스톡 찌르기)으로 거듭 쳐서 막음·파손·완전 파손·견갑이 그려진 곳만 막는지 본다. 끝에 부러진 롱소드(토막 날, `BREAK.stubEdge`)로 같은 세기를 쳐서 멀쩡한 칼과 견주고(eff/thr), 칼 조각과 방어구 조각이 함께 떠 있다가 `clearDebris` 한 번에 치워지는지 본다. 캐릭터 라운드로빈에 방어구를 넣으려면 `LOOKS=1 node tools/sim/characters_eval.mjs rr 16` (기본은 예전처럼 기본 겉모습) |
| `node tools/sim/weapon_tempo.mjs [무기id...] [--loop]` | 휘두름 빠르기: 손 목표를 두 자세 사이로 왕복(또는 `--loop` 타원으로 멈추지 않고)시키며 한 번 휘두르는 시간을 줄여 가며 칼날 70% 속도·베기 에너지 지표(상한: 최고 속도·칼날 70%·날 세움 1)·지표×날 세움과 제 힘을 지키는 템포를 잰다 |
| `node tools/sim/tactic_probe.mjs <무기id> '<level json>' [판수] [--seed=첫번호]` | 무기 쪽 AI 에만 난이도 값(공격성 등)을 덮어써 롱소드와 붙인다. 같은 값을 롱소드끼리에도 줘 대조한다 |
| `node tools/sim/with_spec.mjs 'id.field=<json>' <스크립트> [인자...]` | 무기 스펙 필드를 잠깐 바꾼 채로 다른 시뮬 스크립트를 돌린다 (예: 찌르기 장점 thrustStyle 실험) |
| `node tools/sim/body_share.mjs [무기id...]` | 칼끝 속도 중 몸통(가슴·골반)이 만든 몫. 몸통 비틀기를 끄거나 크게 했을 때 칼 속도·에너지 변화 · `with_config SKILL.corr=v2` 로 돌리면 몸 모드 바꿔 끼우기가 v2 가지를 따른다(옛 출력 바이트 같음) |
| `node tools/sim/corr_s0.mjs [--limits=off,on] [--scenes=a,b] [--seeds=1,2,3] [--s=0.4]` | 검술 보정 v2 설정 0 = 옛 설정 0 (스텝마다 비트 해시: 손 목표·칼 쿼터니언·tipVel·골반·가슴·상처·Math.random 수). 장면 a 플레이어 패드 순서 · b AI 대 AI. 다르면 처음 다른 스텝·파이터·양, 종료 1. `--s=0.4` 는 v2 가지가 사는지 확인 |
| `node tools/sim/chain_corr.mjs [--root=트리] [--modes=old0,old07,v204,v207,v21,v207tip0] [--scenes=air,stop,hit,hitMove] [--fams=…] [--input=60,120,30J,J] [--limits=on,off] [--quick] [--json=파일]` | 검술 보정 v2 측정 한 벌 (wbs chain.mjs 장면 틀, 실제 입력 길): 날 각·납작 몫·① 창·② 켜짐·넘김 튐·엄지-손 일치·몸통 몫·되돌아옴·겨눔 오차·관절 범위 이탈. 한 판 한 줄 json + 방식 × 장면 요약. 기본 행렬 1032판 ≈ 25 분 |
| `node tools/sim/envelope_check.mjs <시뮬.mjs> [인자]` | 다른 시뮬을 감싸 관절 각(봉투 anglesAt 정의)·두 발 뜸·제 몸 뚫림이 봉투·설계·문헌 범위 밖인 스텝을 센다 (참고 수). 감싼 stdout 그대로, 표는 stderr, `ENVELOPE_JSON=파일` 이면 json |
| `node tools/sim/corr_ai_battery.mjs [--levels=normal,easy,hard] [--sets=A,B] [--arms=old,v2] [--json=파일]` | AI 거울 결투 36판 × 묶음, SKILL.corrAI old 대 v2: 죽음·승패(윌슨)·쓰러짐·휘두름당 상처·에너지·닿을 때 칼끝·날 각·납작 몫·머리목 %·버틴 막기·첫 상처·마무리율, README 잡음 폭 곁에 (보고만: AI 는 옛 보정) |
| `node tools/sim/skill_level_duel.mjs <S> [N] --both` | 같은 시드로 X 의 skill.corr old 다음 v2, 결과 두 줄 + 차이 + '손 앞뻗음 뜻 바뀜' 한 줄 (--both 없으면 예전 그대로) |
| `node tools/sim/hit_phase.mjs [판수] [무기A] [무기B]` | 한 방이 왜 가벼운가: AI 대 AI 대결에서 몸에 닿은 순간마다 그 휘두름 최고 속도 대비 비율·느려지는 중·손목 제동 중·몸통 몫·닿은 칼날 지점·에너지·맞은 쪽 밀림(상처/멍 따로) |
| `node tools/sim/chain_mass.mjs [무기id...]` | 칼 뒤에 실제로 실리는 질량: 물리 사슬(칼+손+팔+몸)의 유효 질량을 톡 밀어 재고 판정식(칼+0.3kg)과 견준다 |
| `node tools/sim/thrust_review.mjs [skill\|step\|down\|assist\|demote\|snap\|all] [--hybrid]` | (기본값이 hybrid라 `--hybrid`는 이제 효과 없음) 탭 찌르기 검토 지적 수정 전·후: 검술 보정별 찌르기, AI 두 번 내딛기, 찌르다 넘어짐, 팔 질량 싣는 구간·멍으로 바뀐 찌르기 에너지, 내리찌르기 끊김 |
| (공용) `tools/sim/is_main.mjs` | 측정 도구의 "직접 실행" 확인 `isMain(import.meta.url)`과 감싸는 스크립트용 `simPath()` — with_config·hybrid·with_weapon·with_spec 로 감싸도 결과가 찍힌다 |

`jelly_harness.mjs` / `harness_m.mjs` 는 공용 무대(두 파이터 + 전투 판정)를 만든다.

## 브라우저 도구 (`tools/browser/`, 개발 서버 필요)

`npm run dev` 로 개발 서버를 띄운 뒤, playwright 가 있는 곳에서 (저장소 의존성에는 없다: `npm i --no-save playwright`) 돌린다.

| 스크립트 | 용도 |
|---|---|
| `node tools/browser/smoke.mjs http://127.0.0.1:5173` | 한 판 시작 → 무기 카드 한 장 고르기 → 싸움 8초 진행 → 콘솔 에러 0 확인 (싸움이 실제로 흐르지 않았거나 에러가 있으면 종료 코드 1) |
| `node tools/browser/armor_check.mjs http://127.0.0.1:5173 margarethe castle 4 [폴더]` | 방어구 점검: 판을 여러 번 열며(일시정지 → 처음부터 다시, 카드 뽑기) 실제 `combat.strike` 로 투구·판금을 깨 보고, 콘솔 에러 0 · 판마다 장면 물체·모양 수 · 흩어진 조각(부러진 칼날 끝과 방어구 조각, `src/debris.js`)이 판 시작마다 0 이고 새 판·배경 바꾸기·판 끝 메뉴 뒤에서 둘 다 치워지는지, 부러진 칼(토막 날)로 판금을 쳐도 소리가 판정대로인지, 타격마다 판금·투구 소리가 판정대로인지(막음 → `plateBlock`, 뚫림 → 갑옷 쇳소리, 완전 파손 → `plateBreak` 한 번) 본다. 내 카드 두 장 가운데 날 선 무기를 고른다. 견갑 멀쩡/부서지는 순간/부서진 뒤 스크린샷, 배경이 `darkhall` 이면 캐릭터 조명을 받은 판금 스크린샷도 |
| `node tools/browser/touch_thrust.mjs http://127.0.0.1:5173` · `mouse_thrust.mjs` | 탭·클릭 찌르기 입력 시험. 무기 카드 뽑기는 `?weapon=longsword` 로 건너뛴다 (시험용 주소: 뽑기 없이 그 무기로 바로 싸움) |
| `node tools/browser/revive_shots.mjs http://127.0.0.1:5173 <출력 폴더> [castle,cathedral,darkhall,clearing,castle_px,defeat]` | 부활 연출 연속 사진(844×390, 가짜 시계로 한 프레임씩): 쓰러짐·빛이 내려옴·알림·일어섬(+옆에서)·빛이 사라짐·다시 싸움·결과. 콘솔 에러 0, 연출 물체·빛이 남지 않는지(장면 자식 수), 두 번째 죽음 → 승리, `defeat` = 부활 중 주인공 죽음 → 패배 |
| `node tools/browser/decap_shots.mjs http://127.0.0.1:5173 <출력 폴더> [liao,isolde]` | 참수 연출 사진(844×390, 가짜 시계): `?weapon=zweihander&foe=<id>` 로 싸움을 열고 `window.game` 으로 칼을 상대 목으로 몰아 벤 뒤 0.2초·1.5초(기본 카메라 + 옆), 결과 화면, 다시 싸우기. 콘솔 에러 0, 참수(관절 12·목 단면·목 자리 틈), 이졸데는 부활하지 않음, 다시 싸우기 → 새 상대는 머리가 붙어 있다 |
| `node tools/browser/weapon_thumbs.mjs http://127.0.0.1:5173 [무기id...]` | 무기 뽑기 카드의 작은 그림을 만든다: 게임 속 무기 모델(`src/weapons.js`)을 대각선으로 눕혀 찍어 `public/ui/weapons/<id>.webp` (256×256, 투명 배경)로 저장. 무기 겉모습을 바꾸거나 무기를 새로 넣으면 다시 돌린다. 찍는 페이지 `tools/browser/weapon_thumbs.html` 을 브라우저로 열면 결과를 눈으로 볼 수 있다 |
| `node tools/browser/corr_shots.mjs http://127.0.0.1:5173 <폴더> [diag,flat,liftShort,holdShort] [0.7,1]` | 검술 보정: 옛 대 `?corr=v2` (liftShort 는 `tip=1/0`) 장면 사진·프레임 상태 json. 터치 = CDP, 가짜 시계. 켜진 `skill.corr`·`corrTip` 이 주소와 다르면 에러 |
